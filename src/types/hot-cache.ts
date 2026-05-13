import type { ChatContextChip, ChatThreadState, PersistedChatThreadState } from "./chat";
import type { VaultHealthReport } from "./health";
import type { IndexingRuntimeReport } from "./indexing-runtime";
import type {
	HotCacheEntry,
	HotCacheState,
	IsoTimestamp,
	NormalizedVaultPath,
	StagedChangeRecord,
	ValidationIssue,
	ValidationResult,
} from "./vault";

export const HOT_CACHE_COMMAND_ID = "voidbrain.hot-cache";
export const HOT_CACHE_SCHEMA_VERSION = 1;
export const HOT_CACHE_DEFAULT_ENTRY_LIMIT = 24;
export const HOT_CACHE_MAX_SUMMARY_LENGTH = 240;
export const HOT_CACHE_MAX_METADATA_STRING_LENGTH = 180;
export const HOT_CACHE_MAX_PATHS = 10;
export const HOT_CACHE_SUPPORT_PATH = ".voidbrain/cache/hot-cache.json" as NormalizedVaultPath;
export const HOT_CACHE_SESSION_SUMMARY_COMMAND_ID = "voidbrain.save-session-summary";

export const HOT_CACHE_ENTRY_KINDS = [
	"chat-thread",
	"context-chip",
	"index-readiness",
	"staged-change",
	"health-report",
	"runtime-status",
] as const;

export const HOT_CACHE_STORE_STATUSES = [
	"idle",
	"capturing",
	"persisted",
	"restored",
	"staging-summary",
	"failed",
	"offline",
] as const;

export type HotCacheEntryKind = (typeof HOT_CACHE_ENTRY_KINDS)[number];
export type HotCacheStoreStatus = (typeof HOT_CACHE_STORE_STATUSES)[number];

export type HotCacheMetadataPrimitive = string | number | boolean | null;
export type HotCacheMetadataValue = HotCacheMetadataPrimitive | readonly HotCacheMetadataPrimitive[];
export type HotCacheMetadata = Readonly<Record<string, HotCacheMetadataValue>>;

export interface HotCacheRecoveryReference {
	readonly commandId: string;
	readonly cachePath: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
	readonly validationOutput: readonly ValidationIssue[];
}

export interface HotCacheRedactionSummary {
	readonly redacted: boolean;
	readonly redactedFieldCount: number;
	readonly omittedBodyCount: number;
	readonly notes: readonly string[];
}

export interface HotCacheCaptureInput {
	readonly cacheId?: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly entryLimit?: number;
	readonly chatThread?: ChatThreadState | null;
	readonly selectedContextChips?: readonly ChatContextChip[];
	readonly indexReports?: readonly IndexingRuntimeReport[];
	readonly stagedChanges?: readonly StagedChangeRecord[];
	readonly healthReport?: VaultHealthReport | null;
	readonly priorEntries?: readonly HotCacheEntry[];
	readonly now?: Date;
}

export interface HotCacheCaptureSuccess {
	readonly ok: true;
	readonly state: HotCacheState;
	readonly recovery: HotCacheRecoveryReference;
}

export interface HotCacheCaptureFailure {
	readonly ok: false;
	readonly errors: readonly ValidationIssue[];
	readonly recovery: HotCacheRecoveryReference;
}

export type HotCacheCaptureResult = HotCacheCaptureSuccess | HotCacheCaptureFailure;

export interface HotCacheRestoreInput {
	readonly cachePath?: NormalizedVaultPath;
	readonly value: unknown;
	readonly now?: Date;
}

export interface HotCacheRestoreSuccess {
	readonly ok: true;
	readonly state: HotCacheState;
	readonly chatThread: PersistedChatThreadState | null;
	readonly contextChips: readonly ChatContextChip[];
	readonly recoveredAt: IsoTimestamp;
	readonly recovery: HotCacheRecoveryReference;
}

export interface HotCacheRestoreFailure {
	readonly ok: false;
	readonly errors: readonly ValidationIssue[];
	readonly recoveredAt: IsoTimestamp;
	readonly recovery: HotCacheRecoveryReference;
}

export type HotCacheRestoreResult = HotCacheRestoreSuccess | HotCacheRestoreFailure;

export interface HotCacheStatusInput {
	readonly state: HotCacheState | null;
	readonly cachePath: NormalizedVaultPath;
	readonly lastPersistedAt?: IsoTimestamp;
	readonly lastRestoredAt?: IsoTimestamp;
	readonly lastFailureMessage?: string;
	readonly isWriteInFlight: boolean;
}

export interface HotCacheStatusSnapshot {
	readonly severity: "ready" | "warning" | "error" | "missing";
	readonly summary: string;
	readonly details: readonly string[];
	readonly paths: readonly NormalizedVaultPath[];
	readonly entryCount: number;
}

export interface HotCacheSessionSummaryInput {
	readonly chatThread: ChatThreadState;
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
	readonly existingNotes?: readonly { readonly path: NormalizedVaultPath | string; readonly content: string }[];
	readonly targetPath?: NormalizedVaultPath;
	readonly title?: string;
	readonly now?: Date;
}

export interface HotCacheSessionSummarySuccess {
	readonly ok: true;
	readonly markdown: string;
	readonly stagedChange: StagedChangeRecord;
	readonly targetPath: NormalizedVaultPath;
	readonly recovery: HotCacheRecoveryReference;
}

export interface HotCacheSessionSummaryFailure {
	readonly ok: false;
	readonly errors: readonly ValidationIssue[];
	readonly recovery: HotCacheRecoveryReference;
}

export type HotCacheSessionSummaryResult = HotCacheSessionSummarySuccess | HotCacheSessionSummaryFailure;

export interface HotCacheStoreState {
	readonly status: HotCacheStoreStatus;
	readonly cacheState: HotCacheState | null;
	readonly restoreResult: HotCacheRestoreResult | null;
	readonly summaryResult: HotCacheSessionSummaryResult | null;
	readonly lastFailureMessage: string | null;
	readonly isWriteInFlight: boolean;
	readonly isSummaryInFlight: boolean;
	readonly updatedAt: IsoTimestamp;
}

export type HotCacheStoreSubscriber = (state: HotCacheStoreState) => void;
export type HotCacheStoreUnsubscribe = () => void;

export type HotCacheValidationResult = ValidationResult<HotCacheState>;
