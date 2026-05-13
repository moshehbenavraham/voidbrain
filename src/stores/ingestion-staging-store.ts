import type {
	SourceIngestionPreview,
	SourceIngestionStageFailure,
	SourceIngestionStageResult,
	SourceIngestionStoreState,
	SourceIngestionStoreSubscriber,
	SourceIngestionStoreUnsubscribe,
} from "../types/ingestion";
import { INGESTION_STATE_SCHEMA_VERSION } from "../types/ingestion";
import type { IsoTimestamp } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";

export interface PersistedIngestionStagingState {
	readonly schemaVersion: typeof INGESTION_STATE_SCHEMA_VERSION;
	readonly status: SourceIngestionStoreState["status"];
	readonly preview: SourceIngestionPreview | null;
	readonly failure: SourceIngestionStageFailure | null;
	readonly stagedChangeIds: readonly string[];
	readonly recovery: SourceIngestionStoreState["recovery"];
	readonly updatedAt: IsoTimestamp;
}

export interface IngestionStagingPersistenceAdapter {
	readonly save: (state: PersistedIngestionStagingState) => Promise<void>;
}

export interface IngestionStagingStore {
	readonly getState: () => SourceIngestionStoreState;
	readonly subscribe: (subscriber: SourceIngestionStoreSubscriber) => SourceIngestionStoreUnsubscribe;
	readonly setPreviewing: () => Promise<void>;
	readonly setPreview: (preview: SourceIngestionPreview) => Promise<void>;
	readonly setStaging: () => Promise<void>;
	readonly applyStageResult: (result: SourceIngestionStageResult) => Promise<void>;
	readonly setFailure: (failure: SourceIngestionStageFailure) => Promise<void>;
	readonly reset: () => Promise<void>;
	readonly clear: () => void;
}

export interface CreateIngestionStagingStoreOptions {
	readonly initialState?: SourceIngestionStoreState;
	readonly initialPersistedState?: PersistedIngestionStagingState;
	readonly now?: () => Date;
	readonly persistence?: IngestionStagingPersistenceAdapter;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const createInitialState = (now: Date): SourceIngestionStoreState => ({
	schemaVersion: INGESTION_STATE_SCHEMA_VERSION,
	status: "idle",
	preview: null,
	failure: null,
	stagedChangeIds: [],
	recovery: null,
	updatedAt: toIsoTimestamp(now),
});

export const toPersistedIngestionStagingState = (state: SourceIngestionStoreState): PersistedIngestionStagingState => ({
	schemaVersion: INGESTION_STATE_SCHEMA_VERSION,
	status: state.status,
	preview: state.preview,
	failure: state.failure,
	stagedChangeIds: state.stagedChangeIds,
	recovery: state.recovery,
	updatedAt: state.updatedAt,
});

const recoverPersistedState = (persisted: PersistedIngestionStagingState, now: Date): SourceIngestionStoreState => {
	if (persisted.status === "previewing" || persisted.status === "staging") {
		return {
			...persisted,
			status: "failed",
			failure:
				persisted.failure ??
				({
					ok: false,
					code: "ingestion.persistence-failed",
					message: "Source ingestion was interrupted before completion. No generated notes were applied.",
					retryable: true,
					stagedChangeIds: persisted.stagedChangeIds,
					targetPaths: persisted.recovery?.targetPaths ?? [],
					providerDecision: persisted.recovery?.providerDecision ?? {
						kind: "not-requested",
						allowed: false,
						providerId: null,
						modelId: null,
						code: null,
						userMessage: "Provider-assisted extraction was not requested.",
						attempts: [],
						diagnostic: { mode: "none" },
					},
					validationOutput: persisted.recovery?.validationOutput ?? [],
					...(persisted.recovery === null ? {} : { recovery: persisted.recovery }),
				} satisfies SourceIngestionStageFailure),
			updatedAt: toIsoTimestamp(now),
		};
	}

	return {
		...persisted,
		updatedAt: toIsoTimestamp(now),
	};
};

export const createIngestionStagingStore = (
	options: CreateIngestionStagingStoreOptions = {},
): IngestionStagingStore => {
	const now = options.now ?? (() => new Date());
	let state =
		options.initialState ??
		(options.initialPersistedState === undefined
			? undefined
			: recoverPersistedState(options.initialPersistedState, now())) ??
		createInitialState(now());
	const subscribers = new Set<SourceIngestionStoreSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const commit = async (nextState: SourceIngestionStoreState): Promise<void> => {
		const previousState = state;
		state = nextState;
		notify();

		try {
			await options.persistence?.save(toPersistedIngestionStagingState(state));
		} catch {
			state = {
				...previousState,
				status: "failed",
				failure: {
					ok: false,
					code: "ingestion.persistence-failed",
					message: "Source ingestion state could not be persisted. No generated notes were applied.",
					retryable: true,
					stagedChangeIds: previousState.stagedChangeIds,
					targetPaths: previousState.recovery?.targetPaths ?? [],
					providerDecision: previousState.recovery?.providerDecision ?? {
						kind: "not-requested",
						allowed: false,
						providerId: null,
						modelId: null,
						code: null,
						userMessage: "Provider-assisted extraction was not requested.",
						attempts: [],
						diagnostic: { mode: "none" },
					},
					validationOutput: previousState.recovery?.validationOutput ?? [],
					...(previousState.recovery === null ? {} : { recovery: previousState.recovery }),
				},
				updatedAt: toIsoTimestamp(now()),
			};
			notify();
		}
	};

	return {
		getState: () => state,
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(state);
			return () => {
				subscribers.delete(subscriber);
			};
		},
		setPreviewing: () =>
			commit({
				...state,
				status: "previewing",
				failure: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		setPreview: (preview) =>
			commit({
				...state,
				status: "ready",
				preview,
				failure: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		setStaging: () =>
			commit({
				...state,
				status: "staging",
				failure: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyStageResult: (result) => {
			if (!result.ok) {
				return commit({
					...state,
					status: "failed",
					failure: result,
					stagedChangeIds: result.stagedChangeIds,
					recovery: result.recovery ?? state.recovery,
					updatedAt: toIsoTimestamp(now()),
				});
			}

			return commit({
				...state,
				status: "staged",
				preview: result.preview,
				failure: null,
				stagedChangeIds: result.stagedChanges.map((change) => change.changeId),
				recovery: result.recovery,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		setFailure: (failure) =>
			commit({
				...state,
				status: "failed",
				failure,
				stagedChangeIds: failure.stagedChangeIds,
				recovery: failure.recovery ?? state.recovery,
				updatedAt: toIsoTimestamp(now()),
			}),
		reset: () => commit(createInitialState(now())),
		clear: () => {
			subscribers.clear();
			state = createInitialState(now());
		},
	};
};
