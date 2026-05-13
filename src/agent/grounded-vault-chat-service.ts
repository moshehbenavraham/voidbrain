import { type ProviderChatInvoker, defaultProviderChatInvoker } from "../providers/chat-provider";
import { createProviderInvocationKey } from "../providers/provider-invocation";
import { buildProviderDefinitionsForSettings, preflightProviderSetup } from "../providers/provider-preflight";
import { redactDiagnostic } from "../providers/redaction";
import type {
	ChatActionResult,
	ChatBranchId,
	ChatCitation,
	ChatContextChip,
	ChatFailure,
	ChatFailureCode,
	ChatFailureStage,
	ChatProviderDecisionRecord,
	ChatProviderRequest,
	ChatQuestionInput,
	ChatRetrievalPreviewItem,
	ChatRetryMetadata,
	ChatThreadId,
	ChatThreadState,
	ChatTurn,
	ChatTurnId,
	ValidatedChatQuestion,
} from "../types/chat";
import {
	CHAT_COMMAND_ID,
	CHAT_CONTEXT_CHIP_KINDS,
	makeChatBranchId,
	makeChatCitationId,
	makeChatContextChipId,
	makeChatThreadId,
	makeChatTurnId,
} from "../types/chat";
import type { IndexingRuntimeState } from "../types/indexing-runtime";
import type { VoidbrainPluginSettings } from "../types/plugin";
import type { ProviderDefinition, ProviderId, ProviderModelId, RedactedDiagnosticObject } from "../types/providers";
import type { RetrievalQuery, RetrievalResult, RetrievalSearchResult } from "../types/retrieval";
import { type IsoTimestamp, type NormalizedVaultPath, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths, normalizeVaultPath } from "../utils/vault-paths";
import { searchLexicalIndex } from "../vectorstore/lexical-index";
import { composeLexicalRetrievalResults } from "../vectorstore/retrieval-service";

export interface GroundedVaultChatServiceOptions {
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly getIndexingState: () => IndexingRuntimeState | null;
	readonly getProviders?: () => readonly ProviderDefinition[];
	readonly chatInvoker?: ProviderChatInvoker;
	readonly now?: () => Date;
	readonly maxQuestionCharacters?: number;
	readonly maxContextChips?: number;
	readonly defaultRetrievalLimit?: number;
	readonly maxRetrievalLimit?: number;
	readonly minStrongNormalizedScore?: number;
	readonly providerTimeoutMs?: number;
}

export interface GroundedVaultChatAskSuccess {
	readonly ok: true;
	readonly result: ChatActionResult;
}

export interface GroundedVaultChatAskFailure {
	readonly ok: false;
	readonly result: ChatActionResult;
}

export type GroundedVaultChatAskResult = GroundedVaultChatAskSuccess | GroundedVaultChatAskFailure;

interface UnknownRecord {
	readonly [key: string]: unknown;
}

interface QuestionValidationSuccess {
	readonly ok: true;
	readonly question: ValidatedChatQuestion;
}

interface QuestionValidationFailure {
	readonly ok: false;
	readonly failure: ChatFailure;
}

type QuestionValidationResult = QuestionValidationSuccess | QuestionValidationFailure;

interface RetrievalFailureResult {
	readonly ok: false;
	readonly failure: ChatFailure;
	readonly turn: ChatTurn;
}

interface RetrievalSuccessResult {
	readonly ok: true;
	readonly turn: ChatTurn;
	readonly query: RetrievalQuery;
	readonly preview: readonly ChatRetrievalPreviewItem[];
	readonly citations: readonly ChatCitation[];
}

type EvidenceRetrievalResult = RetrievalSuccessResult | RetrievalFailureResult;

interface RetrievalReadinessFailureResult {
	readonly failure: ChatFailure;
	readonly turn: ChatTurn;
}

interface ChatPreflightAllowed {
	readonly allowed: true;
	readonly providerId: ProviderId;
	readonly modelId: ProviderModelId;
	readonly record: ChatProviderDecisionRecord;
}

interface ChatPreflightDenied {
	readonly allowed: false;
	readonly code: string;
	readonly userMessage: string;
	readonly diagnostic: RedactedDiagnosticObject;
	readonly record: ChatProviderDecisionRecord;
}

type ChatPreflightResult = ChatPreflightAllowed | ChatPreflightDenied;

const defaultMaxQuestionCharacters = 2000;
const defaultMaxContextChips = 20;
const defaultRetrievalLimit = 5;
const defaultMaxRetrievalLimit = 10;
const defaultMinStrongNormalizedScore = 0.05;
const defaultProviderTimeoutMs = 15000;
const defaultMaxSnippetCharacters = 360;
const defaultThreadId = makeChatThreadId("chat-thread-default");
const defaultBranchId = makeChatBranchId("branch-main");

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isAbortSignal = (value: unknown): value is AbortSignal =>
	typeof value === "object" &&
	value !== null &&
	"aborted" in value &&
	"addEventListener" in value &&
	typeof (value as { readonly addEventListener?: unknown }).addEventListener === "function";

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

const emptyRetry = (turnId: ChatTurnId): ChatRetryMetadata => ({
	sourceTurnId: turnId,
	retryOfTurnId: null,
	attempt: 1,
	lastFailureCode: null,
	canRetry: false,
});

const uniqueSortedSourcePaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	[...new Set(paths)].sort(compareVaultPaths);

const sourcePathsFromCitations = (citations: readonly ChatCitation[]): readonly NormalizedVaultPath[] =>
	uniqueSortedSourcePaths(citations.flatMap((citation) => citation.sourcePaths));

const makeChatContextualCitationId = (index: number) => makeChatCitationId(`citation-${index + 1}`);

export class GroundedVaultChatService {
	private readonly now: () => Date;
	private readonly maxQuestionCharacters: number;
	private readonly maxContextChips: number;
	private readonly fallbackRetrievalLimit: number;
	private readonly maxRetrievalLimit: number;
	private readonly minStrongNormalizedScore: number;
	private readonly providerTimeoutMs: number;
	private readonly chatInvoker: ProviderChatInvoker;
	private readonly inFlightThreads = new Set<ChatThreadId>();
	private turnCounter = 0;

	constructor(private readonly options: GroundedVaultChatServiceOptions) {
		this.now = options.now ?? (() => new Date());
		this.maxQuestionCharacters = Math.max(1, options.maxQuestionCharacters ?? defaultMaxQuestionCharacters);
		this.maxContextChips = Math.max(0, options.maxContextChips ?? defaultMaxContextChips);
		this.fallbackRetrievalLimit = Math.max(1, options.defaultRetrievalLimit ?? defaultRetrievalLimit);
		this.maxRetrievalLimit = Math.max(
			this.fallbackRetrievalLimit,
			options.maxRetrievalLimit ?? defaultMaxRetrievalLimit,
		);
		this.minStrongNormalizedScore = Math.max(
			0,
			options.minStrongNormalizedScore ?? defaultMinStrongNormalizedScore,
		);
		this.providerTimeoutMs = Math.max(1, options.providerTimeoutMs ?? defaultProviderTimeoutMs);
		this.chatInvoker = options.chatInvoker ?? defaultProviderChatInvoker;
	}

	public validateQuestion(input: unknown): QuestionValidationResult {
		const threadId =
			isRecord(input) && typeof input.threadId === "string" ? makeChatThreadId(input.threadId) : defaultThreadId;
		const branchId =
			isRecord(input) && typeof input.branchId === "string" ? makeChatBranchId(input.branchId) : defaultBranchId;

		if (!isRecord(input)) {
			return {
				ok: false,
				failure: this.createFailure({
					code: "chat.context-invalid",
					stage: "validation",
					message: "Chat question input must be an object.",
					retryable: false,
					threadId,
					validationOutput: ["root must be an object"],
				}),
			};
		}

		const rawText = input.text;
		if (typeof rawText !== "string" || rawText.trim().length === 0) {
			return {
				ok: false,
				failure: this.createFailure({
					code: "chat.question-empty",
					stage: "validation",
					message: "Chat question must not be empty.",
					retryable: false,
					threadId,
					validationOutput: ["text must be a non-empty string"],
				}),
			};
		}

		const text = rawText.trim();
		if (text.length > this.maxQuestionCharacters) {
			return {
				ok: false,
				failure: this.createFailure({
					code: "chat.question-too-long",
					stage: "validation",
					message: `Chat question must be ${this.maxQuestionCharacters} characters or fewer.`,
					retryable: false,
					threadId,
					validationOutput: [`text length ${text.length} exceeds ${this.maxQuestionCharacters}`],
				}),
			};
		}

		const contextChips = this.parseContextChips(input.contextChips);
		if (!contextChips.ok) {
			return {
				ok: false,
				failure: this.createFailure({
					code: "chat.context-invalid",
					stage: "validation",
					message: "Chat context chips are invalid.",
					retryable: false,
					threadId,
					validationOutput: contextChips.errors,
				}),
			};
		}

		const retrievalLimit = this.parseRetrievalLimit(input.retrievalLimit);
		if (typeof retrievalLimit === "string") {
			return {
				ok: false,
				failure: this.createFailure({
					code: "chat.context-invalid",
					stage: "validation",
					message: "Chat retrieval limit is invalid.",
					retryable: false,
					threadId,
					validationOutput: [retrievalLimit],
				}),
			};
		}

		const signal = isAbortSignal(input.signal) ? input.signal : undefined;
		return {
			ok: true,
			question: {
				text,
				contextChips: contextChips.value,
				retrievalLimit,
				threadId,
				branchId,
				...(signal === undefined ? {} : { signal }),
			},
		};
	}

	public async ask(input: ChatQuestionInput | unknown): Promise<GroundedVaultChatAskResult> {
		const validated = this.validateQuestion(input);
		if (!validated.ok) {
			const state = this.createSyntheticFailureState(validated.failure);
			return {
				ok: false,
				result: {
					accepted: false,
					action: "ask",
					state,
					failure: validated.failure,
				},
			};
		}

		if (this.inFlightThreads.has(validated.question.threadId)) {
			const failure = this.createFailure({
				code: "chat.duplicate-action",
				stage: "validation",
				message: "A chat turn is already in flight for this thread.",
				retryable: true,
				threadId: validated.question.threadId,
				validationOutput: [`thread ${validated.question.threadId} already has an in-flight turn`],
			});
			return this.failureResult(failure);
		}

		this.inFlightThreads.add(validated.question.threadId);
		try {
			return await this.runValidatedAsk(validated.question);
		} finally {
			this.inFlightThreads.delete(validated.question.threadId);
		}
	}

	private async runValidatedAsk(question: ValidatedChatQuestion): Promise<GroundedVaultChatAskResult> {
		const indexingState = this.options.getIndexingState();
		const readinessFailure = this.checkRetrievalReadiness(question, indexingState);
		if (readinessFailure !== null) {
			return this.failureResult(readinessFailure.failure, readinessFailure.turn);
		}

		const retrieval = this.retrieveEvidence(question, indexingState);
		if (!retrieval.ok) {
			return this.failureResult(retrieval.failure, retrieval.turn);
		}

		const preflight = this.preflightProvider(question, retrieval.citations);
		if (!preflight.allowed) {
			const failure = this.createFailure({
				code: "chat.provider-denied",
				stage: "provider-preflight",
				message: preflight.userMessage,
				retryable: true,
				threadId: question.threadId,
				turnId: retrieval.turn.id,
				validationOutput: [preflight.code],
				diagnostic: preflight.diagnostic,
			});
			const turn = this.withFailure(retrieval.turn, failure, "provider-denied", preflight.record);
			return this.failureResult(failure, turn);
		}

		const sourcePaths = sourcePathsFromCitations(retrieval.citations);
		const providerRequest: ChatProviderRequest = {
			commandId: CHAT_COMMAND_ID,
			threadId: question.threadId,
			turnId: retrieval.turn.id,
			providerId: preflight.providerId,
			modelId: preflight.modelId,
			contentSensitivity: this.options.getSettings().defaultContentSensitivity,
			question: question.text,
			evidence: retrieval.preview.map((item) => ({
				citationId: item.citationId,
				vaultPath: item.vaultPath,
				heading: item.heading,
				chunkId: item.chunkId,
				snippet: item.snippet,
				sourcePaths: item.sourcePaths,
				score: item.score,
			})),
			citations: retrieval.citations,
			sourcePaths,
			timeoutMs: this.providerTimeoutMs,
			invocationKey: createProviderInvocationKey([
				"chat",
				CHAT_COMMAND_ID,
				question.threadId,
				retrieval.turn.id,
				preflight.providerId,
				preflight.modelId,
			]),
			recovery: {
				commandId: CHAT_COMMAND_ID,
				providerId: preflight.providerId,
				modelId: preflight.modelId,
				sourcePathCount: sourcePaths.length,
				reportId: "grounded-vault-chat-provider-invocation",
				validationOutput: ["provider preflight allowed"],
			},
			...(question.signal === undefined ? {} : { signal: question.signal }),
		};
		const invocation = await this.chatInvoker(providerRequest);
		if (!invocation.ok) {
			const failure = this.createFailure({
				code: invocation.code,
				stage: "provider-invocation",
				message: invocation.message,
				retryable: invocation.retryable,
				threadId: question.threadId,
				turnId: retrieval.turn.id,
				validationOutput: [invocation.code],
				diagnostic: invocation.diagnostic,
			});
			const failedTurn: ChatTurn = {
				...retrieval.turn,
				status: invocation.code === "chat.provider-canceled" ? "canceled" : "failed",
				failure,
				retry: {
					...retrieval.turn.retry,
					lastFailureCode: failure.code,
					canRetry: failure.retryable,
				},
				providerDecision: preflight.record,
				providerAttempts: invocation.attempts,
				updatedAt: toIsoTimestamp(this.now()),
			};
			return this.failureResult(failure, failedTurn);
		}

		const answerTurn: ChatTurn = {
			...retrieval.turn,
			status: "answer-ready",
			answer: invocation.response.answer.trim(),
			citations: retrieval.citations.filter((citation) => invocation.response.citations.includes(citation.id)),
			providerDecision: preflight.record,
			providerAttempts: invocation.attempts,
			updatedAt: toIsoTimestamp(this.now()),
		};
		return {
			ok: true,
			result: {
				accepted: true,
				action: "ask",
				state: this.createStateForTurn(answerTurn, question.threadId),
				turn: answerTurn,
			},
		};
	}

	private checkRetrievalReadiness(
		question: ValidatedChatQuestion,
		indexingState: IndexingRuntimeState | null,
	): RetrievalReadinessFailureResult | null {
		if (indexingState === null) {
			const turn = this.createTurn(question, "retrieving", null, [], [], null);
			const failure = this.createFailure({
				code: "chat.retrieval-not-ready",
				stage: "retrieval-readiness",
				message: "Retrieval index state is not available.",
				retryable: true,
				threadId: question.threadId,
				turnId: turn.id,
				validationOutput: ["indexing runtime state is null"],
			});
			return {
				failure,
				turn: this.withFailure(turn, failure, "failed"),
			};
		}

		if (indexingState.lexicalReport.readinessState !== "ready" || indexingState.lexicalIndex === null) {
			const turn = this.createTurn(question, "retrieving", null, [], [], null);
			const failure = this.createFailure({
				code: "chat.retrieval-not-ready",
				stage: "retrieval-readiness",
				message: indexingState.lexicalReport.message,
				retryable: indexingState.lexicalReport.readinessState !== "building",
				threadId: question.threadId,
				turnId: turn.id,
				validationOutput: [
					`lexical readiness: ${indexingState.lexicalReport.readinessState}`,
					`lexical status: ${indexingState.lexicalReport.status}`,
				],
				diagnostic: {
					indexId: indexingState.lexicalReport.indexId,
					readinessState: indexingState.lexicalReport.readinessState,
					status: indexingState.lexicalReport.status,
					indexedNoteCount: indexingState.lexicalReport.indexedNoteCount,
					totalNoteCount: indexingState.lexicalReport.totalNoteCount,
				},
			});
			return {
				failure,
				turn: this.withFailure(turn, failure, "failed"),
			};
		}

		return null;
	}

	private retrieveEvidence(
		question: ValidatedChatQuestion,
		indexingState: IndexingRuntimeState | null,
	): EvidenceRetrievalResult {
		const turn = this.createTurn(question, "retrieving", null, [], [], null);
		const lexicalIndex = indexingState?.lexicalIndex;
		if (lexicalIndex === undefined || lexicalIndex === null) {
			const failure = this.createFailure({
				code: "chat.retrieval-not-ready",
				stage: "retrieval-readiness",
				message: "Lexical index is missing.",
				retryable: true,
				threadId: question.threadId,
				turnId: turn.id,
				validationOutput: ["lexical index missing"],
			});
			return {
				ok: false,
				failure,
				turn: this.withFailure(turn, failure, "failed"),
			};
		}

		const query = this.createRetrievalQuery(question);
		const search = searchLexicalIndex(lexicalIndex, query);
		const retrieval = composeLexicalRetrievalResults(search, {
			maxSnippetCharacters: defaultMaxSnippetCharacters,
		});
		if (!retrieval.ok) {
			const failure = this.failureFromRetrieval(question, turn.id, retrieval);
			return {
				ok: false,
				failure,
				turn: this.withFailure(turn, failure, "failed"),
			};
		}

		const preview = this.createRetrievalPreview(retrieval.results);
		const citations = this.createCitations(preview);
		const readyTurn = this.createTurn(question, "synthesizing", retrieval.query, preview, citations, null);

		if (preview.length === 0 || !this.hasStrongRetrieval(preview)) {
			const failure = this.createFailure({
				code: "chat.retrieval-weak",
				stage: "retrieval",
				message: "Retrieval evidence is too weak for grounded chat synthesis.",
				retryable: true,
				threadId: question.threadId,
				turnId: readyTurn.id,
				validationOutput: [
					`retrieval results: ${preview.length}`,
					`minimum normalized score: ${this.minStrongNormalizedScore}`,
				],
				diagnostic: {
					resultCount: preview.length,
					sourcePathCount: sourcePathsFromCitations(citations).length,
				},
			});
			return {
				ok: false,
				failure,
				turn: this.withFailure(readyTurn, failure, "weak-retrieval"),
			};
		}

		if (citations.length === 0) {
			const failure = this.createFailure({
				code: "chat.citation-missing",
				stage: "retrieval",
				message: "Retrieval evidence did not produce citation records.",
				retryable: false,
				threadId: question.threadId,
				turnId: readyTurn.id,
				validationOutput: ["citation count is 0"],
			});
			return {
				ok: false,
				failure,
				turn: this.withFailure(readyTurn, failure, "failed"),
			};
		}

		return {
			ok: true,
			turn: readyTurn,
			query: retrieval.query,
			preview,
			citations,
		};
	}

	private preflightProvider(
		question: ValidatedChatQuestion,
		citations: readonly ChatCitation[],
	): ChatPreflightResult {
		const settings = this.options.getSettings();
		const providers = this.options.getProviders?.() ?? buildProviderDefinitionsForSettings(settings);
		const decision = preflightProviderSetup(
			{
				settings,
				baselineProviders: providers,
			},
			{
				role: "chat",
				requiredCapability: "chat",
				contentSensitivity: settings.defaultContentSensitivity,
				sourcePaths: sourcePathsFromCitations(citations),
				workflowId: CHAT_COMMAND_ID,
				userFacingPurpose: "Answer a vault question from cited retrieval evidence.",
			},
		);

		if (!decision.allowed) {
			return {
				allowed: false,
				code: decision.code,
				userMessage: decision.userMessage,
				diagnostic: decision.diagnostic,
				record: {
					allowed: false,
					providerId: null,
					modelId: null,
					code: decision.code,
					userMessage: decision.userMessage,
					diagnostic: decision.diagnostic,
				},
			};
		}

		return {
			allowed: true,
			providerId: decision.provider.id,
			modelId: decision.modelId,
			record: {
				allowed: true,
				providerId: decision.provider.id,
				modelId: decision.modelId,
				code: null,
				userMessage: "Provider preflight is ready for cited vault chat.",
				diagnostic: decision.diagnostic,
			},
		};
	}

	private createRetrievalQuery(question: ValidatedChatQuestion): RetrievalQuery {
		const contextPaths = uniqueSortedSourcePaths(
			question.contextChips.flatMap((chip) => (chip.path === undefined ? [] : [chip.path])),
		);

		return {
			query: question.text,
			limit: question.retrievalLimit,
			...(contextPaths.length === 0 ? {} : { filters: { paths: contextPaths } }),
		};
	}

	private failureFromRetrieval(
		question: ValidatedChatQuestion,
		turnId: ChatTurnId,
		retrieval: Extract<RetrievalSearchResult, { readonly ok: false }>,
	): ChatFailure {
		return this.createFailure({
			code: "chat.retrieval-failed",
			stage: "retrieval",
			message: retrieval.message,
			retryable: retrieval.code === "retrieval.index-not-ready",
			threadId: question.threadId,
			turnId,
			validationOutput: [retrieval.code, ...(retrieval.field === undefined ? [] : [retrieval.field])],
			diagnostic: {
				retrievalCode: retrieval.code,
				field: retrieval.field ?? null,
			},
		});
	}

	private createRetrievalPreview(results: readonly RetrievalResult[]): readonly ChatRetrievalPreviewItem[] {
		return results.map((result, index) => ({
			resultId: result.id,
			citationId: makeChatContextualCitationId(index),
			vaultPath: result.path,
			heading: result.heading ?? null,
			chunkId: result.chunkId,
			sourcePaths: result.sourcePaths.length === 0 ? [result.path] : result.sourcePaths,
			snippet: result.snippet,
			score: result.score,
			normalizedScore: result.scoreDetails.normalizedScore ?? null,
			matchedTokens: result.scoreDetails.matchedTokens,
		}));
	}

	private createCitations(preview: readonly ChatRetrievalPreviewItem[]): readonly ChatCitation[] {
		return preview.map((item, index) => ({
			id: item.citationId,
			label: `[${index + 1}]`,
			resultId: item.resultId,
			vaultPath: item.vaultPath,
			heading: item.heading,
			chunkId: item.chunkId,
			sourcePaths: item.sourcePaths,
			score: item.score,
		}));
	}

	private hasStrongRetrieval(preview: readonly ChatRetrievalPreviewItem[]): boolean {
		const topScore = preview[0]?.normalizedScore ?? 0;
		return topScore >= this.minStrongNormalizedScore;
	}

	private withFailure(
		turn: ChatTurn,
		failure: ChatFailure,
		status: ChatTurn["status"],
		providerDecision: ChatProviderDecisionRecord | null = turn.providerDecision,
	): ChatTurn {
		return {
			...turn,
			status,
			failure,
			providerDecision,
			retry: {
				...turn.retry,
				lastFailureCode: failure.code,
				canRetry: failure.retryable,
			},
			updatedAt: toIsoTimestamp(this.now()),
		};
	}

	private failureResult(failure: ChatFailure, turn?: ChatTurn): GroundedVaultChatAskFailure {
		return {
			ok: false,
			result: {
				accepted: false,
				action: "ask",
				state:
					turn === undefined
						? this.createSyntheticFailureState(failure)
						: this.createStateForTurn(turn, failure.threadId),
				...(turn === undefined ? {} : { turn }),
				failure,
			},
		};
	}

	private parseContextChips(
		input: unknown,
	):
		| { readonly ok: true; readonly value: readonly ChatContextChip[] }
		| { readonly ok: false; readonly errors: readonly string[] } {
		if (input === undefined) {
			return { ok: true, value: [] };
		}
		if (!Array.isArray(input)) {
			return { ok: false, errors: ["contextChips must be an array"] };
		}
		if (input.length > this.maxContextChips) {
			return { ok: false, errors: [`contextChips length ${input.length} exceeds ${this.maxContextChips}`] };
		}

		const chips: ChatContextChip[] = [];
		const errors: string[] = [];
		for (const [index, rawChip] of input.entries()) {
			const parsed = this.parseContextChip(rawChip, index);
			if (typeof parsed === "string") {
				errors.push(parsed);
			} else {
				chips.push(parsed);
			}
		}

		return errors.length === 0 ? { ok: true, value: chips } : { ok: false, errors };
	}

	private parseContextChip(input: unknown, index: number): ChatContextChip | string {
		if (!isRecord(input)) {
			return `contextChips[${index}] must be an object`;
		}
		if (!CHAT_CONTEXT_CHIP_KINDS.includes(input.kind as ChatContextChip["kind"])) {
			return `contextChips[${index}].kind is unsupported`;
		}
		if (typeof input.label !== "string" || input.label.trim().length === 0) {
			return `contextChips[${index}].label must be a non-empty string`;
		}

		const id =
			typeof input.id === "string" && input.id.trim().length > 0
				? makeChatContextChipId(input.id.trim())
				: makeChatContextChipId(`context-chip-${index + 1}`);
		const path = this.parseOptionalPath(input.path, `contextChips[${index}].path`);
		if (typeof path === "string") {
			return path;
		}
		const heading =
			typeof input.heading === "string" && input.heading.trim().length > 0 ? input.heading.trim() : undefined;
		const sourceRecordId =
			typeof input.sourceRecordId === "string" && input.sourceRecordId.trim().length > 0
				? input.sourceRecordId.trim()
				: undefined;

		return {
			id,
			kind: input.kind as ChatContextChip["kind"],
			label: input.label.trim(),
			...(path === undefined ? {} : { path }),
			...(heading === undefined ? {} : { heading }),
			...(sourceRecordId === undefined ? {} : { sourceRecordId }),
		};
	}

	private parseOptionalPath(input: unknown, field: string): NormalizedVaultPath | undefined | string {
		if (input === undefined) {
			return undefined;
		}
		const normalized = normalizeVaultPath(input);
		if (!normalized.ok) {
			return `${field} must be a vault-relative path`;
		}

		return normalized.value;
	}

	private parseRetrievalLimit(input: unknown): number | string {
		if (input === undefined) {
			return this.fallbackRetrievalLimit;
		}
		if (!Number.isInteger(input) || typeof input !== "number" || input < 1 || input > this.maxRetrievalLimit) {
			return `retrievalLimit must be an integer from 1 to ${this.maxRetrievalLimit}`;
		}

		return input;
	}

	private createTurn(
		question: ValidatedChatQuestion,
		status: ChatTurn["status"],
		retrievalQuery: RetrievalQuery | null,
		retrievalPreview: readonly ChatRetrievalPreviewItem[],
		citations: readonly ChatCitation[],
		answer: string | null,
	): ChatTurn {
		const now = toIsoTimestamp(this.now());
		const turnId = this.nextTurnId();

		return {
			id: turnId,
			parentTurnId: null,
			branchId: question.branchId,
			status,
			question: question.text,
			contextChips: question.contextChips,
			retrievalQuery,
			retrievalPreview,
			persistedRetrieval: retrievalPreview.map((item) => ({
				resultId: item.resultId,
				citationId: item.citationId,
				vaultPath: item.vaultPath,
				heading: item.heading,
				chunkId: item.chunkId,
				sourcePaths: item.sourcePaths,
				score: item.score,
				normalizedScore: item.normalizedScore,
				matchedTokenCount: item.matchedTokens.length,
			})),
			citations,
			answer,
			failure: null,
			retry: emptyRetry(turnId),
			providerDecision: null,
			providerAttempts: [],
			createdAt: now,
			updatedAt: now,
		};
	}

	private createStateForTurn(turn: ChatTurn, threadId?: ChatThreadId): ChatThreadState {
		const now = toIsoTimestamp(this.now());
		return {
			schemaVersion: 1 as const,
			threadId: threadId ?? turn.failure?.threadId ?? defaultThreadId,
			activeBranchId: turn.branchId,
			draft: {
				text: turn.status === "answer-ready" ? "" : turn.question,
				updatedAt: now,
				contextChips: turn.status === "answer-ready" ? [] : turn.contextChips,
			},
			turns: [turn],
			branches: [
				{
					branchId: turn.branchId,
					parentBranchId: null,
					sourceTurnId: null,
					label: turn.branchId === defaultBranchId ? "Main" : "Branch",
					createdAt: now,
				},
			],
			inFlightTurnId: null,
			lastFailure: turn.failure,
			createdAt: now,
			updatedAt: now,
		};
	}

	private createSyntheticFailureState(failure: ChatFailure, turn?: ChatTurn): ChatThreadState {
		const now = toIsoTimestamp(this.now());
		return {
			schemaVersion: 1 as const,
			threadId: failure.threadId,
			activeBranchId: defaultBranchId,
			draft: {
				text: "",
				updatedAt: now,
				contextChips: [],
			},
			turns: turn === undefined ? [] : [turn],
			branches: [
				{
					branchId: defaultBranchId,
					parentBranchId: null,
					sourceTurnId: null,
					label: "Main",
					createdAt: now,
				},
			],
			inFlightTurnId: null,
			lastFailure: failure,
			createdAt: now,
			updatedAt: now,
		};
	}

	private createFailure(input: {
		readonly code: ChatFailureCode;
		readonly stage: ChatFailureStage;
		readonly message: string;
		readonly retryable: boolean;
		readonly threadId: ChatThreadId;
		readonly turnId?: ChatTurnId;
		readonly targetPath?: NormalizedVaultPath;
		readonly validationOutput: readonly string[];
		readonly diagnostic?: unknown;
	}): ChatFailure {
		return {
			code: input.code,
			stage: input.stage,
			message: input.message,
			retryable: input.retryable,
			commandId: CHAT_COMMAND_ID,
			threadId: input.threadId,
			...(input.turnId === undefined ? {} : { turnId: input.turnId }),
			...(input.targetPath === undefined ? {} : { targetPath: input.targetPath }),
			validationOutput: input.validationOutput,
			...(input.diagnostic === undefined ? {} : { diagnostic: toDiagnosticObject(input.diagnostic) }),
		};
	}

	private nextTurnId(): ChatTurnId {
		this.turnCounter += 1;
		return makeChatTurnId(`chat-turn-${this.turnCounter}`);
	}
}
