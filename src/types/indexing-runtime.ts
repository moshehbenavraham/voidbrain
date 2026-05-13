import type { ProviderInvocationAttempt } from "./provider-invocation";
import type { ContentSensitivity, ProviderId, ProviderModelId } from "./providers";
import type {
	IndexFreshnessSnapshot,
	IndexJobStatus,
	IndexProgressSnapshot,
	LexicalIndexSnapshot,
	RetrievalReadinessState,
} from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath } from "./vault";

export const INDEXING_RUNTIME_ACTIONS = [
	"reindex-lexical",
	"cancel-lexical",
	"retry-lexical",
	"refresh-readiness",
] as const;

export const INDEXING_RUNTIME_REPORT_STATUSES = [
	"disabled",
	"idle",
	"building",
	"ready",
	"stale",
	"missing",
	"error",
	"canceled",
] as const;

export const INDEXING_PATH_DIAGNOSTIC_CODES = [
	"excluded-folder",
	"max-note-bytes",
	"read-failed",
	"invalid-path",
	"parse-failed",
	"non-markdown",
] as const;

export const SEMANTIC_INDEX_READINESS_STATES = [
	"disabled",
	"ready",
	"missing-provider",
	"auth-not-ready",
	"capability-mismatch",
	"privacy-denied",
	"blocked",
] as const;

export type IndexingRuntimeAction = (typeof INDEXING_RUNTIME_ACTIONS)[number];
export type IndexingRuntimeReportStatus = (typeof INDEXING_RUNTIME_REPORT_STATUSES)[number];
export type IndexingPathDiagnosticCode = (typeof INDEXING_PATH_DIAGNOSTIC_CODES)[number];
export type SemanticIndexReadinessState = (typeof SEMANTIC_INDEX_READINESS_STATES)[number];

export interface IndexingPathDiagnostic {
	readonly path: NormalizedVaultPath | string;
	readonly code: IndexingPathDiagnosticCode;
	readonly reason: string;
	readonly sizeBytes?: number;
}

export interface ObsidianMarkdownSourceReadResult {
	readonly notes: readonly {
		readonly path: NormalizedVaultPath;
		readonly content: string;
	}[];
	readonly knownPaths: readonly NormalizedVaultPath[];
	readonly pathAliases: Readonly<Record<string, NormalizedVaultPath>>;
	readonly skippedPaths: readonly IndexingPathDiagnostic[];
	readonly failedPaths: readonly IndexingPathDiagnostic[];
}

export interface IndexingRuntimeReport {
	readonly indexId: string;
	readonly jobId: string | null;
	readonly status: IndexingRuntimeReportStatus;
	readonly readinessState: RetrievalReadinessState;
	readonly progress: IndexProgressSnapshot | null;
	readonly freshness: IndexFreshnessSnapshot | null;
	readonly indexedNoteCount: number;
	readonly totalNoteCount: number;
	readonly skippedPaths: readonly IndexingPathDiagnostic[];
	readonly failedPaths: readonly IndexingPathDiagnostic[];
	readonly stalePaths: readonly NormalizedVaultPath[];
	readonly missingPaths: readonly NormalizedVaultPath[];
	readonly extraPaths: readonly NormalizedVaultPath[];
	readonly currentPath: NormalizedVaultPath | null;
	readonly updatedAt: IsoTimestamp;
	readonly message: string;
}

export interface SemanticIndexRecoveryRecord {
	readonly commandId: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly sourcePathCount: number;
	readonly readinessCode: string | null;
	readonly validationOutput: readonly string[];
	readonly attempts?: readonly ProviderInvocationAttempt[];
	readonly retryGuidance: string;
	readonly updatedAt: IsoTimestamp;
}

export interface SemanticIndexReadiness {
	readonly state: SemanticIndexReadinessState;
	readonly readinessState: RetrievalReadinessState;
	readonly checkedAt: IsoTimestamp;
	readonly contentSensitivity: ContentSensitivity;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly sourcePathCount: number;
	readonly message: string;
	readonly diagnosticCode: string | null;
	readonly recovery?: SemanticIndexRecoveryRecord;
}

export interface IndexingRuntimeState {
	readonly lexicalReport: IndexingRuntimeReport;
	readonly lexicalIndex: LexicalIndexSnapshot | null;
	readonly semanticReadiness: SemanticIndexReadiness;
}

export interface IndexingRuntimeActionResult {
	readonly action: IndexingRuntimeAction;
	readonly accepted: boolean;
	readonly status: IndexJobStatus | IndexingRuntimeReportStatus;
	readonly message: string;
	readonly state: IndexingRuntimeState;
}

export type IndexingRuntimeSubscriber = (state: IndexingRuntimeState) => void;
export type IndexingRuntimeUnsubscribe = () => void;
