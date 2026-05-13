import { redactDiagnostic } from "../providers/redaction";
import type {
	ChatActionKind,
	ChatActionResult,
	ChatBranchMetadata,
	ChatContextChip,
	ChatFailure,
	ChatThreadId,
	ChatThreadState,
	ChatThreadSubscriber,
	ChatThreadUnsubscribe,
	ChatTurn,
	ChatTurnId,
	ChatTurnStatus,
	PersistedChatThreadState,
} from "../types/chat";
import { CHAT_COMMAND_ID, CHAT_STATE_SCHEMA_VERSION, makeChatBranchId, makeChatThreadId } from "../types/chat";
import type { RedactedDiagnosticObject } from "../types/providers";
import { type IsoTimestamp, makeIsoTimestamp } from "../types/vault";

export interface ChatThreadPersistenceAdapter {
	readonly save: (state: PersistedChatThreadState) => Promise<void>;
}

export interface ChatThreadStore {
	readonly getState: () => ChatThreadState;
	readonly subscribe: (subscriber: ChatThreadSubscriber) => ChatThreadUnsubscribe;
	readonly setDraft: (text: string, contextChips?: readonly ChatContextChip[]) => Promise<ChatActionResult>;
	readonly clearDraft: () => Promise<ChatActionResult>;
	readonly startTurn: (turn: ChatTurn) => Promise<ChatActionResult>;
	readonly applyActionResult: (result: ChatActionResult) => Promise<ChatActionResult>;
	readonly retryTurn: (sourceTurnId: ChatTurnId) => Promise<ChatActionResult>;
	readonly branchFromTurn: (sourceTurnId: ChatTurnId) => Promise<ChatActionResult>;
	readonly clear: () => void;
}

export interface CreateChatThreadStoreOptions {
	readonly initialState?: ChatThreadState;
	readonly initialPersistedState?: PersistedChatThreadState;
	readonly threadId?: ChatThreadId;
	readonly now?: () => Date;
	readonly persistence?: ChatThreadPersistenceAdapter;
}

const mainBranchId = makeChatBranchId("branch-main");
const defaultThreadId = makeChatThreadId("chat-thread-default");

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const toDiagnosticObject = (input: unknown): RedactedDiagnosticObject => {
	const redacted = redactDiagnostic(input);

	if (
		!redacted.ok ||
		typeof redacted.value !== "object" ||
		redacted.value === null ||
		Array.isArray(redacted.value)
	) {
		return {
			redaction: "failed",
		};
	}

	return redacted.value as RedactedDiagnosticObject;
};

export const createInitialChatThreadState = (
	input: {
		readonly threadId?: ChatThreadId;
		readonly now?: Date;
	} = {},
): ChatThreadState => {
	const timestamp = toIsoTimestamp(input.now ?? new Date());

	return {
		schemaVersion: CHAT_STATE_SCHEMA_VERSION,
		threadId: input.threadId ?? defaultThreadId,
		activeBranchId: mainBranchId,
		draft: {
			text: "",
			updatedAt: timestamp,
			contextChips: [],
		},
		turns: [],
		branches: [
			{
				branchId: mainBranchId,
				parentBranchId: null,
				sourceTurnId: null,
				label: "Main",
				createdAt: timestamp,
			},
		],
		inFlightTurnId: null,
		lastFailure: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
};

export const toPersistedChatThreadState = (state: ChatThreadState): PersistedChatThreadState => ({
	schemaVersion: CHAT_STATE_SCHEMA_VERSION,
	threadId: state.threadId,
	activeBranchId: state.activeBranchId,
	draft: state.draft,
	turns: state.turns.map((turn) => {
		const { retrievalPreview: _retrievalPreview, providerAttempts: _providerAttempts, ...persistedTurn } = turn;
		return persistedTurn;
	}),
	branches: state.branches,
	inFlightTurnId: null,
	lastFailure: state.lastFailure,
	createdAt: state.createdAt,
	updatedAt: state.updatedAt,
});

const replaceTurn = (turns: readonly ChatTurn[], turn: ChatTurn): readonly ChatTurn[] => {
	const existingIndex = turns.findIndex((candidate) => candidate.id === turn.id);
	if (existingIndex === -1) {
		return [...turns, turn];
	}

	return turns.map((candidate) => (candidate.id === turn.id ? turn : candidate));
};

const findTurn = (state: ChatThreadState, turnId: ChatTurnId): ChatTurn | null =>
	state.turns.find((turn) => turn.id === turnId) ?? null;

const isTransientTurnStatus = (status: ChatTurnStatus): boolean =>
	status === "queued" || status === "retrieving" || status === "synthesizing";

export const recoverChatThreadStateFromPersistence = (
	persisted: PersistedChatThreadState,
	now: Date = new Date(),
): ChatThreadState => {
	const recoveredAt = toIsoTimestamp(now);
	const branches =
		persisted.branches.length === 0
			? [
					{
						branchId: mainBranchId,
						parentBranchId: null,
						sourceTurnId: null,
						label: "Main",
						createdAt: recoveredAt,
					},
				]
			: persisted.branches;
	const branchIds = new Set(branches.map((branch) => branch.branchId));
	const activeBranchId = branchIds.has(persisted.activeBranchId)
		? persisted.activeBranchId
		: (branches[0]?.branchId ?? mainBranchId);
	const turns = persisted.turns.map((turn): ChatTurn => {
		if (!isTransientTurnStatus(turn.status)) {
			return {
				...turn,
				retrievalPreview: [],
				providerAttempts: [],
			};
		}

		const failure: ChatFailure = {
			code: "chat.view-closed",
			stage: "view",
			message: "Chat turn was interrupted before recovery completed.",
			retryable: true,
			commandId: CHAT_COMMAND_ID,
			threadId: persisted.threadId,
			turnId: turn.id,
			validationOutput: ["transient turn recovered from local state"],
			diagnostic: toDiagnosticObject({
				recoveredStatus: turn.status,
			}),
		};

		return {
			...turn,
			status: "failed",
			failure,
			retry: {
				...turn.retry,
				lastFailureCode: failure.code,
				canRetry: true,
			},
			retrievalPreview: [],
			providerAttempts: [],
			updatedAt: recoveredAt,
		};
	});

	return {
		schemaVersion: CHAT_STATE_SCHEMA_VERSION,
		threadId: persisted.threadId,
		activeBranchId,
		draft: persisted.draft,
		turns,
		branches,
		inFlightTurnId: null,
		lastFailure: persisted.lastFailure,
		createdAt: persisted.createdAt,
		updatedAt: recoveredAt,
	};
};

export const createChatThreadStore = (options: CreateChatThreadStoreOptions = {}): ChatThreadStore => {
	const now = options.now ?? (() => new Date());
	let state =
		options.initialState ??
		(options.initialPersistedState === undefined
			? undefined
			: recoverChatThreadStateFromPersistence(options.initialPersistedState, now())) ??
		createInitialChatThreadState({
			...(options.threadId === undefined ? {} : { threadId: options.threadId }),
			now: now(),
		});
	const subscribers = new Set<ChatThreadSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const failure = (input: {
		readonly action: ChatActionKind;
		readonly code: ChatFailure["code"];
		readonly stage: ChatFailure["stage"];
		readonly message: string;
		readonly retryable: boolean;
		readonly turnId?: ChatTurnId;
		readonly validationOutput: readonly string[];
		readonly diagnostic?: unknown;
	}): ChatFailure => ({
		code: input.code,
		stage: input.stage,
		message: input.message,
		retryable: input.retryable,
		commandId: CHAT_COMMAND_ID,
		threadId: state.threadId,
		...(input.turnId === undefined ? {} : { turnId: input.turnId }),
		validationOutput: input.validationOutput,
		diagnostic: toDiagnosticObject({
			action: input.action,
			...(input.diagnostic === undefined ? {} : { diagnostic: input.diagnostic }),
		}),
	});

	const commit = async (
		action: ChatActionKind,
		nextState: ChatThreadState,
		turn?: ChatTurn,
		actionFailure?: ChatFailure,
	): Promise<ChatActionResult> => {
		const previousState = state;
		state = nextState;
		notify();

		try {
			await options.persistence?.save(toPersistedChatThreadState(state));
			return {
				accepted: actionFailure === undefined,
				action,
				state,
				...(turn === undefined ? {} : { turn }),
				...(actionFailure === undefined ? {} : { failure: actionFailure }),
			};
		} catch (error) {
			const persistenceFailure = failure({
				action,
				code: "chat.persistence-failed",
				stage: "persistence",
				message: "Chat thread state could not be persisted locally.",
				retryable: true,
				validationOutput: ["local persistence save failed"],
				diagnostic: error,
			});
			state = {
				...previousState,
				lastFailure: persistenceFailure,
				updatedAt: toIsoTimestamp(now()),
			};
			notify();

			return {
				accepted: false,
				action,
				state,
				failure: persistenceFailure,
			};
		}
	};

	const rejectDuplicate = (action: ChatActionKind): ChatActionResult | null => {
		if (state.inFlightTurnId === null) {
			return null;
		}

		const duplicateFailure = failure({
			action,
			code: "chat.duplicate-action",
			stage: "validation",
			message: "A chat turn is already in flight.",
			retryable: true,
			turnId: state.inFlightTurnId,
			validationOutput: [`in-flight turn ${state.inFlightTurnId}`],
		});
		state = {
			...state,
			lastFailure: duplicateFailure,
			updatedAt: toIsoTimestamp(now()),
		};
		notify();

		return {
			accepted: false,
			action,
			state,
			failure: duplicateFailure,
		};
	};

	const branchMetadata = (sourceTurn: ChatTurn): ChatBranchMetadata => ({
		branchId: makeChatBranchId(`branch-${state.branches.length + 1}`),
		parentBranchId: sourceTurn.branchId,
		sourceTurnId: sourceTurn.id,
		label: `Branch ${state.branches.length + 1}`,
		createdAt: toIsoTimestamp(now()),
	});

	return {
		getState: () => state,
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(state);

			return () => {
				subscribers.delete(subscriber);
			};
		},
		setDraft: async (text, contextChips = []) => {
			const nextState: ChatThreadState = {
				...state,
				draft: {
					text,
					contextChips,
					updatedAt: toIsoTimestamp(now()),
				},
				updatedAt: toIsoTimestamp(now()),
			};
			return commit("recover-draft", nextState);
		},
		clearDraft: async () => {
			const nextState: ChatThreadState = {
				...state,
				draft: {
					text: "",
					contextChips: [],
					updatedAt: toIsoTimestamp(now()),
				},
				updatedAt: toIsoTimestamp(now()),
			};
			return commit("clear-draft", nextState);
		},
		startTurn: async (turn) => {
			const duplicate = rejectDuplicate("ask");
			if (duplicate !== null) {
				return duplicate;
			}

			const nextState: ChatThreadState = {
				...state,
				activeBranchId: turn.branchId,
				turns: replaceTurn(state.turns, turn),
				inFlightTurnId: turn.id,
				lastFailure: null,
				updatedAt: toIsoTimestamp(now()),
			};
			return commit("ask", nextState, turn);
		},
		applyActionResult: async (result) => {
			const turn = result.turn;
			const turns = turn === undefined ? state.turns : replaceTurn(state.turns, turn);
			const shouldClearDraft = turn?.status === "answer-ready";
			const nextState: ChatThreadState = {
				...state,
				turns,
				inFlightTurnId: null,
				lastFailure: result.failure ?? null,
				draft: shouldClearDraft
					? {
							text: "",
							contextChips: [],
							updatedAt: toIsoTimestamp(now()),
						}
					: state.draft,
				updatedAt: toIsoTimestamp(now()),
			};
			return commit(result.action, nextState, turn, result.failure);
		},
		retryTurn: async (sourceTurnId) => {
			const duplicate = rejectDuplicate("retry");
			if (duplicate !== null) {
				return duplicate;
			}

			const sourceTurn = findTurn(state, sourceTurnId);
			if (sourceTurn === null) {
				const missingFailure = failure({
					action: "retry",
					code: "chat.context-invalid",
					stage: "validation",
					message: "Retry source turn does not exist.",
					retryable: false,
					validationOutput: [`turn ${sourceTurnId} was not found`],
				});
				return commit(
					"retry",
					{
						...state,
						lastFailure: missingFailure,
						updatedAt: toIsoTimestamp(now()),
					},
					undefined,
					missingFailure,
				);
			}

			return commit("retry", {
				...state,
				activeBranchId: sourceTurn.branchId,
				draft: {
					text: sourceTurn.question,
					contextChips: sourceTurn.contextChips,
					updatedAt: toIsoTimestamp(now()),
				},
				lastFailure: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		branchFromTurn: async (sourceTurnId) => {
			const duplicate = rejectDuplicate("branch");
			if (duplicate !== null) {
				return duplicate;
			}

			const sourceTurn = findTurn(state, sourceTurnId);
			if (sourceTurn === null) {
				const missingFailure = failure({
					action: "branch",
					code: "chat.context-invalid",
					stage: "validation",
					message: "Branch source turn does not exist.",
					retryable: false,
					validationOutput: [`turn ${sourceTurnId} was not found`],
				});
				return commit(
					"branch",
					{
						...state,
						lastFailure: missingFailure,
						updatedAt: toIsoTimestamp(now()),
					},
					undefined,
					missingFailure,
				);
			}

			const branch = branchMetadata(sourceTurn);
			return commit("branch", {
				...state,
				activeBranchId: branch.branchId,
				branches: [...state.branches, branch],
				draft: {
					text: sourceTurn.question,
					contextChips: sourceTurn.contextChips,
					updatedAt: toIsoTimestamp(now()),
				},
				lastFailure: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		clear: () => {
			subscribers.clear();
		},
	};
};
