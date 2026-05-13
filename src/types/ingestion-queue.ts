import type { AgentCommandId } from "./agent-commands";
import type { SourceIngestionFailureCode, SourceIngestionIntakeRequest } from "./ingestion";
import type { SourceIngestionProviderDecisionRecord } from "./ingestion";
import { INGEST_SOURCE_COMMAND_ID } from "./ingestion";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "./vault";

export const INGESTION_QUEUE_STATE_SCHEMA_VERSION = 1;
export const SOURCE_INGESTION_QUEUE_DEFAULT_CONCURRENCY = 2;
export const SOURCE_INGESTION_QUEUE_MAX_CONCURRENCY = 4;

export const SOURCE_INGESTION_QUEUE_STATUSES = [
	"queued",
	"running",
	"completed",
	"failed",
	"canceled",
	"canceling",
] as const;

export const SOURCE_INGESTION_QUEUE_ITEM_STATUSES = [
	"queued",
	"running",
	"staged",
	"failed",
	"canceled",
	"skipped",
] as const;

export const SOURCE_INGESTION_QUEUE_CITATION_STATES = ["not-checked", "valid", "invalid"] as const;

export type SourceIngestionQueueStatus = (typeof SOURCE_INGESTION_QUEUE_STATUSES)[number];
export type SourceIngestionQueueItemStatus = (typeof SOURCE_INGESTION_QUEUE_ITEM_STATUSES)[number];
export type SourceIngestionQueueCitationState = (typeof SOURCE_INGESTION_QUEUE_CITATION_STATES)[number];

export type SourceIngestionQueueFailureCode =
	| SourceIngestionFailureCode
	| "ingestion.queue-empty"
	| "ingestion.queue-duplicate"
	| "ingestion.queue-in-flight"
	| "ingestion.queue-canceled";

export interface SourceIngestionQueueItemRecoveryRecord {
	readonly commandId: typeof INGEST_SOURCE_COMMAND_ID;
	readonly queueId: string;
	readonly itemId: string;
	readonly sourcePath?: NormalizedVaultPath;
	readonly contentSha256?: string;
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly cachePath?: NormalizedVaultPath;
	readonly stagedChangeIds: readonly string[];
	readonly providerDecision?: SourceIngestionProviderDecisionRecord;
	readonly validationOutput: readonly ValidationIssue[];
	readonly retryGuidance: string;
	readonly updatedAt: IsoTimestamp;
}

export interface SourceIngestionQueueItemSummary {
	readonly itemId: string;
	readonly queueId: string;
	readonly index: number;
	readonly status: SourceIngestionQueueItemStatus;
	readonly sourceKind?: SourceIngestionIntakeRequest["input"]["kind"];
	readonly title?: string;
	readonly sourcePath?: NormalizedVaultPath;
	readonly sourceUrl?: string;
	readonly contentSha256?: string;
	readonly contentBytes?: number;
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly citationState: SourceIngestionQueueCitationState;
	readonly stagedChangeIds: readonly string[];
	readonly providerDecision?: SourceIngestionProviderDecisionRecord;
	readonly validationOutput: readonly ValidationIssue[];
	readonly retryable: boolean;
	readonly retryCount: number;
	readonly failureCode?: SourceIngestionQueueFailureCode;
	readonly message?: string;
	readonly startedAt?: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly recovery: SourceIngestionQueueItemRecoveryRecord;
}

export interface SourceIngestionQueueSummaryCounts {
	readonly total: number;
	readonly queued: number;
	readonly running: number;
	readonly staged: number;
	readonly failed: number;
	readonly canceled: number;
	readonly skipped: number;
	readonly retryable: number;
	readonly providerBlocked: number;
	readonly citationBlocked: number;
}

export interface SourceIngestionQueueRecoveryRecord {
	readonly commandId: typeof INGEST_SOURCE_COMMAND_ID;
	readonly queueId: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly stagedChangeIds: readonly string[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly retryGuidance: string;
	readonly updatedAt: IsoTimestamp;
}

export interface SourceIngestionQueueSummary {
	readonly commandId: typeof INGEST_SOURCE_COMMAND_ID;
	readonly queueId: string;
	readonly status: SourceIngestionQueueStatus;
	readonly concurrency: number;
	readonly startedAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly counts: SourceIngestionQueueSummaryCounts;
	readonly items: readonly SourceIngestionQueueItemSummary[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly stagedChangeIds: readonly string[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly recovery: SourceIngestionQueueRecoveryRecord;
}

export interface SourceIngestionQueueRunInput {
	readonly queueId?: string;
	readonly items: readonly SourceIngestionIntakeRequest[];
	readonly concurrency?: number;
	readonly existingNotes?: SourceIngestionIntakeRequest["existingNotes"];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
	readonly cachePath?: NormalizedVaultPath;
	readonly retryCount?: number;
	readonly onUpdate?: (summary: SourceIngestionQueueSummary) => void;
}

export interface SourceIngestionQueueRetryInput extends Omit<SourceIngestionQueueRunInput, "retryCount"> {
	readonly sourceQueueId?: string;
}

export interface SourceIngestionQueueRunResult {
	readonly summary: SourceIngestionQueueSummary;
	readonly stagedChanges: readonly StagedChangeRecord[];
}

export interface SourceIngestionQueueCancelResult {
	readonly ok: boolean;
	readonly queueId: string;
	readonly canceledItemIds: readonly string[];
	readonly runningItemIds: readonly string[];
	readonly message: string;
}

export interface SourceIngestionQueueStatusInput {
	readonly summary: SourceIngestionQueueSummary | null;
	readonly lastFailureMessage?: string;
	readonly isRunning: boolean;
}

export interface SourceIngestionQueueStoreState {
	readonly schemaVersion: typeof INGESTION_QUEUE_STATE_SCHEMA_VERSION;
	readonly status: SourceIngestionQueueStatus | "idle" | "offline";
	readonly draftItemCount: number;
	readonly summary: SourceIngestionQueueSummary | null;
	readonly lastFailureMessage: string | null;
	readonly isWriteInFlight: boolean;
	readonly updatedAt: IsoTimestamp;
}

export type SourceIngestionQueueStoreSubscriber = (state: SourceIngestionQueueStoreState) => void;
export type SourceIngestionQueueStoreUnsubscribe = () => void;

export const isSourceIngestionQueueCommandId = (
	commandId: string,
): commandId is Extract<AgentCommandId, typeof INGEST_SOURCE_COMMAND_ID> => commandId === INGEST_SOURCE_COMMAND_ID;
