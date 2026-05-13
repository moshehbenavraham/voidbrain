import type { IsoTimestamp, NormalizedVaultPath, ValidationIssue } from "./vault";

export const RECOVER_SESSION_COMMAND_ID = "voidbrain.recover-session";
export const RECOVERY_SCHEMA_VERSION = 1;
export const RECOVERY_DEFAULT_ITEM_LIMIT = 24;
export const RECOVERY_MAX_ITEM_LIMIT = 50;
export const RECOVERY_DEFAULT_DIAGNOSTIC_LIMIT = 24;
export const RECOVERY_MAX_DIAGNOSTIC_LIMIT = 50;
export const RECOVERY_STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;
export const RECOVERY_MAX_SUMMARY_LENGTH = 240;

export const RECOVERY_SOURCE_KINDS = [
	"hot-cache",
	"staged-change",
	"health-report",
	"operation-log",
	"ingestion-recovery",
	"adapter-read",
] as const;

export const RECOVERY_SUMMARY_STATUSES = ["ready", "partial", "missing", "invalid"] as const;
export const RECOVERY_DIAGNOSTIC_SEVERITIES = ["info", "warning", "error"] as const;
export const RECOVERY_ACTION_KINDS = [
	"retry-command",
	"review-staged-change",
	"inspect-report",
	"refresh-cache",
	"discard-record",
] as const;

export const RECOVERY_DIAGNOSTIC_CODES = [
	"recovery.missing-record",
	"recovery.malformed-record",
	"recovery.stale-record",
	"recovery.unsupported-record",
	"recovery.secret-redacted",
	"recovery.body-omitted",
	"recovery.read-failed",
	"recovery.invalid-filter",
	"recovery.bounded-output",
] as const;

export type RecoverySourceKind = (typeof RECOVERY_SOURCE_KINDS)[number];
export type RecoverySummaryStatus = (typeof RECOVERY_SUMMARY_STATUSES)[number];
export type RecoveryDiagnosticSeverity = (typeof RECOVERY_DIAGNOSTIC_SEVERITIES)[number];
export type RecoveryActionKind = (typeof RECOVERY_ACTION_KINDS)[number];
export type RecoveryDiagnosticCode = (typeof RECOVERY_DIAGNOSTIC_CODES)[number];

export interface RecoverySummaryRequest {
	readonly commandId?: string;
	readonly cachePath?: NormalizedVaultPath | string;
	readonly targetPath?: NormalizedVaultPath | string;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
	readonly itemLimit?: number;
	readonly diagnosticLimit?: number;
	readonly now?: Date;
	readonly staleAfterMs?: number;
}

export interface RecoverySupportRecordInput {
	readonly sourceKind: RecoverySourceKind;
	readonly sourcePath?: NormalizedVaultPath | string;
	readonly value: unknown;
}

export interface RecoverySupportReadFailure {
	readonly sourceKind: RecoverySourceKind;
	readonly sourcePath: NormalizedVaultPath | string;
	readonly error: unknown;
}

export interface RecoverSessionInput extends RecoverySummaryRequest {
	readonly hotCache?: unknown;
	readonly hotCachePath?: NormalizedVaultPath | string;
	readonly stagedChanges?: readonly unknown[];
	readonly healthReport?: unknown;
	readonly operationLog?: unknown;
	readonly ingestionRecoveries?: readonly unknown[];
	readonly supportRecords?: readonly RecoverySupportRecordInput[];
	readonly readFailures?: readonly RecoverySupportReadFailure[];
}

export interface RecoveryEvidenceItem {
	readonly evidenceId: string;
	readonly sourceKind: RecoverySourceKind;
	readonly sourcePath?: NormalizedVaultPath;
	readonly commandId: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly reportIds: readonly string[];
	readonly stagedChangeIds: readonly string[];
	readonly backupPathIntents: readonly NormalizedVaultPath[];
	readonly operationLogIds: readonly string[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly summary: string;
	readonly updatedAt?: IsoTimestamp;
}

export interface RecoveryDiagnostic {
	readonly diagnosticId: string;
	readonly severity: RecoveryDiagnosticSeverity;
	readonly code: RecoveryDiagnosticCode;
	readonly message: string;
	readonly sourceKind?: RecoverySourceKind;
	readonly sourcePath?: NormalizedVaultPath;
	readonly field?: string;
}

export interface RecoveryAction {
	readonly actionId: string;
	readonly kind: RecoveryActionKind;
	readonly label: string;
	readonly reason: string;
	readonly commandId?: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
}

export interface RecoveryRedactionSummary {
	readonly redacted: boolean;
	readonly redactedFieldCount: number;
	readonly omittedBodyCount: number;
	readonly notes: readonly string[];
}

export interface RecoverySummaryCounts {
	readonly sourceRecordCount: number;
	readonly itemCount: number;
	readonly diagnosticCount: number;
	readonly actionCount: number;
}

export interface RecoverySummary {
	readonly schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
	readonly commandId: typeof RECOVER_SESSION_COMMAND_ID;
	readonly generatedAt: IsoTimestamp;
	readonly status: RecoverySummaryStatus;
	readonly query: RecoverySummaryRequest;
	readonly sourceRecordPaths: readonly NormalizedVaultPath[];
	readonly items: readonly RecoveryEvidenceItem[];
	readonly diagnostics: readonly RecoveryDiagnostic[];
	readonly actions: readonly RecoveryAction[];
	readonly redaction: RecoveryRedactionSummary;
	readonly counts: RecoverySummaryCounts;
}
