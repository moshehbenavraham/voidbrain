import type { AgentCommandId } from "./agent-commands";
import type { IndexingRuntimeReport } from "./indexing-runtime";
import type { ContentSensitivity, ProviderId, ProviderModelId, RedactedDiagnosticObject } from "./providers";
import type { RetrievalQuery, RetrievalReadinessState, RetrievalResult } from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath } from "./vault";

export const CHAT_COMMAND_ID = "voidbrain.chat-with-vault" satisfies AgentCommandId;
export const CHAT_STATE_SCHEMA_VERSION = 1;

export const CHAT_CONTEXT_CHIP_KINDS = ["active-file", "selected-path", "retrieval-filter", "manual"] as const;

export const CHAT_TURN_STATUSES = [
	"queued",
	"retrieving",
	"weak-retrieval",
	"provider-denied",
	"synthesizing",
	"answer-ready",
	"failed",
	"canceled",
] as const;

export const CHAT_FAILURE_STAGES = [
	"validation",
	"retrieval-readiness",
	"retrieval",
	"provider-preflight",
	"provider-invocation",
	"persistence",
	"view",
] as const;

export const CHAT_FAILURE_CODES = [
	"chat.question-empty",
	"chat.question-too-long",
	"chat.context-invalid",
	"chat.duplicate-action",
	"chat.retrieval-not-ready",
	"chat.retrieval-failed",
	"chat.retrieval-weak",
	"chat.citation-missing",
	"chat.provider-denied",
	"chat.provider-unavailable",
	"chat.provider-timeout",
	"chat.provider-failed",
	"chat.persistence-failed",
	"chat.view-closed",
] as const;

export const CHAT_ACTION_KINDS = ["ask", "retry", "branch", "recover-draft", "clear-draft"] as const;

export type ChatContextChipKind = (typeof CHAT_CONTEXT_CHIP_KINDS)[number];
export type ChatTurnStatus = (typeof CHAT_TURN_STATUSES)[number];
export type ChatFailureStage = (typeof CHAT_FAILURE_STAGES)[number];
export type ChatFailureCode = (typeof CHAT_FAILURE_CODES)[number];
export type ChatActionKind = (typeof CHAT_ACTION_KINDS)[number];

export type ChatThreadId = string & { readonly __chatThreadId: unique symbol };
export type ChatTurnId = string & { readonly __chatTurnId: unique symbol };
export type ChatBranchId = string & { readonly __chatBranchId: unique symbol };
export type ChatCitationId = string & { readonly __chatCitationId: unique symbol };
export type ChatContextChipId = string & { readonly __chatContextChipId: unique symbol };

export const makeChatThreadId = (id: string): ChatThreadId => id as ChatThreadId;
export const makeChatTurnId = (id: string): ChatTurnId => id as ChatTurnId;
export const makeChatBranchId = (id: string): ChatBranchId => id as ChatBranchId;
export const makeChatCitationId = (id: string): ChatCitationId => id as ChatCitationId;
export const makeChatContextChipId = (id: string): ChatContextChipId => id as ChatContextChipId;

export interface ChatContextChip {
	readonly id: ChatContextChipId;
	readonly kind: ChatContextChipKind;
	readonly label: string;
	readonly path?: NormalizedVaultPath;
	readonly heading?: string;
	readonly sourceRecordId?: string;
}

export interface ChatQuestionInput {
	readonly text: string;
	readonly contextChips?: readonly ChatContextChip[];
	readonly retrievalLimit?: number;
	readonly threadId?: ChatThreadId;
	readonly branchId?: ChatBranchId;
}

export interface ValidatedChatQuestion {
	readonly text: string;
	readonly contextChips: readonly ChatContextChip[];
	readonly retrievalLimit: number;
	readonly threadId: ChatThreadId;
	readonly branchId: ChatBranchId;
}

export interface ChatRetrievalReadinessFailure {
	readonly readinessState: RetrievalReadinessState;
	readonly report: IndexingRuntimeReport;
	readonly message: string;
}

export interface ChatRetrievalPreviewItem {
	readonly resultId: RetrievalResult["id"];
	readonly citationId: ChatCitationId;
	readonly vaultPath: NormalizedVaultPath;
	readonly heading: string | null;
	readonly chunkId: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly snippet: string;
	readonly score: number;
	readonly normalizedScore: number | null;
	readonly matchedTokens: readonly string[];
}

export interface ChatPersistedRetrievalRecord {
	readonly resultId: RetrievalResult["id"];
	readonly citationId: ChatCitationId;
	readonly vaultPath: NormalizedVaultPath;
	readonly heading: string | null;
	readonly chunkId: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly score: number;
	readonly normalizedScore: number | null;
	readonly matchedTokenCount: number;
}

export interface ChatCitation {
	readonly id: ChatCitationId;
	readonly label: string;
	readonly resultId: RetrievalResult["id"];
	readonly vaultPath: NormalizedVaultPath;
	readonly heading: string | null;
	readonly chunkId: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly score: number;
}

export interface ChatProviderEvidence {
	readonly citationId: ChatCitationId;
	readonly vaultPath: NormalizedVaultPath;
	readonly heading: string | null;
	readonly chunkId: string;
	readonly snippet: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly score: number;
}

export interface ChatProviderRequest {
	readonly commandId: typeof CHAT_COMMAND_ID;
	readonly threadId: ChatThreadId;
	readonly turnId: ChatTurnId;
	readonly providerId: ProviderId;
	readonly modelId: ProviderModelId;
	readonly contentSensitivity: ContentSensitivity;
	readonly question: string;
	readonly evidence: readonly ChatProviderEvidence[];
	readonly citations: readonly ChatCitation[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly timeoutMs: number;
}

export interface ChatProviderAttempt {
	readonly attempt: number;
	readonly startedAt: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly status: "started" | "succeeded" | "failed" | "timed-out";
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ChatProviderResponse {
	readonly answer: string;
	readonly citations: readonly ChatCitationId[];
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ChatProviderDecisionRecord {
	readonly allowed: boolean;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly code: string | null;
	readonly userMessage: string;
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface ChatFailure {
	readonly code: ChatFailureCode;
	readonly stage: ChatFailureStage;
	readonly message: string;
	readonly retryable: boolean;
	readonly commandId: typeof CHAT_COMMAND_ID;
	readonly threadId: ChatThreadId;
	readonly turnId?: ChatTurnId;
	readonly targetPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput: readonly string[];
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ChatRetryMetadata {
	readonly sourceTurnId: ChatTurnId;
	readonly retryOfTurnId: ChatTurnId | null;
	readonly attempt: number;
	readonly lastFailureCode: ChatFailureCode | null;
	readonly canRetry: boolean;
}

export interface ChatBranchMetadata {
	readonly branchId: ChatBranchId;
	readonly parentBranchId: ChatBranchId | null;
	readonly sourceTurnId: ChatTurnId | null;
	readonly label: string;
	readonly createdAt: IsoTimestamp;
}

export interface ChatTurn {
	readonly id: ChatTurnId;
	readonly parentTurnId: ChatTurnId | null;
	readonly branchId: ChatBranchId;
	readonly status: ChatTurnStatus;
	readonly question: string;
	readonly contextChips: readonly ChatContextChip[];
	readonly retrievalQuery: RetrievalQuery | null;
	readonly retrievalPreview: readonly ChatRetrievalPreviewItem[];
	readonly persistedRetrieval: readonly ChatPersistedRetrievalRecord[];
	readonly citations: readonly ChatCitation[];
	readonly answer: string | null;
	readonly failure: ChatFailure | null;
	readonly retry: ChatRetryMetadata;
	readonly providerDecision: ChatProviderDecisionRecord | null;
	readonly providerAttempts: readonly ChatProviderAttempt[];
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
}

export interface ChatDraftState {
	readonly text: string;
	readonly updatedAt: IsoTimestamp;
	readonly contextChips: readonly ChatContextChip[];
}

export interface ChatThreadState {
	readonly schemaVersion: typeof CHAT_STATE_SCHEMA_VERSION;
	readonly threadId: ChatThreadId;
	readonly activeBranchId: ChatBranchId;
	readonly draft: ChatDraftState;
	readonly turns: readonly ChatTurn[];
	readonly branches: readonly ChatBranchMetadata[];
	readonly inFlightTurnId: ChatTurnId | null;
	readonly lastFailure: ChatFailure | null;
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
}

export interface PersistedChatThreadState {
	readonly schemaVersion: typeof CHAT_STATE_SCHEMA_VERSION;
	readonly threadId: ChatThreadId;
	readonly activeBranchId: ChatBranchId;
	readonly draft: ChatDraftState;
	readonly turns: readonly Omit<ChatTurn, "retrievalPreview" | "providerAttempts">[];
	readonly branches: readonly ChatBranchMetadata[];
	readonly inFlightTurnId: null;
	readonly lastFailure: ChatFailure | null;
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
}

export interface ChatPersistenceEnvelope {
	readonly schemaVersion: typeof CHAT_STATE_SCHEMA_VERSION;
	readonly threads: readonly PersistedChatThreadState[];
	readonly updatedAt: IsoTimestamp;
}

export interface ChatActionResult {
	readonly accepted: boolean;
	readonly action: ChatActionKind;
	readonly state: ChatThreadState;
	readonly turn?: ChatTurn;
	readonly failure?: ChatFailure;
}

export type ChatThreadSubscriber = (state: ChatThreadState) => void;
export type ChatThreadUnsubscribe = () => void;

export const isChatTurnStatus = (value: unknown): value is ChatTurnStatus =>
	typeof value === "string" && CHAT_TURN_STATUSES.includes(value as ChatTurnStatus);

export const isChatFailureCode = (value: unknown): value is ChatFailureCode =>
	typeof value === "string" && CHAT_FAILURE_CODES.includes(value as ChatFailureCode);

export const isChatFailureStage = (value: unknown): value is ChatFailureStage =>
	typeof value === "string" && CHAT_FAILURE_STAGES.includes(value as ChatFailureStage);

export const assertNeverChatValue = (value: never): never => {
	throw new Error(`Unhandled chat contract value: ${String(value)}`);
};
