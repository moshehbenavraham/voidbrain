import type {
	IsoTimestamp,
	NormalizedVaultPath,
	OperationLogEntry,
	StagedChangeConflict,
	StagedChangeOperationKind,
	StagedChangeRecord,
	StagedChangeStatus,
	ValidationIssue,
} from "./vault";

export const STAGED_REVIEW_ACTIONS = ["approve", "reject", "retry", "dismiss", "apply"] as const;

export const STAGED_REVIEW_CONFIRMATION_KINDS = [
	"none",
	"additive",
	"update",
	"destructive",
	"overwrite",
	"batch",
] as const;

export const STAGED_REVIEW_PREVIEW_KINDS = [
	"create-preview",
	"diff-preview",
	"delete-preview",
	"move-preview",
	"frontmatter-preview",
] as const;

export const STAGED_REVIEW_OUTCOME_STATUSES = [
	"planned",
	"applied",
	"rejected",
	"dismissed",
	"conflicted",
	"failed",
	"skipped",
] as const;

export type StagedReviewAction = (typeof STAGED_REVIEW_ACTIONS)[number];
export type StagedReviewConfirmationKind = (typeof STAGED_REVIEW_CONFIRMATION_KINDS)[number];
export type StagedReviewPreviewKind = (typeof STAGED_REVIEW_PREVIEW_KINDS)[number];
export type StagedReviewOutcomeStatus = (typeof STAGED_REVIEW_OUTCOME_STATUSES)[number];

export interface StagedReviewGroupKey {
	readonly commandId: string;
	readonly operationKind: StagedChangeOperationKind;
	readonly status: StagedChangeStatus;
	readonly destructive: boolean;
	readonly targetPath: NormalizedVaultPath;
}

export interface StagedReviewSummary {
	readonly totalRecords: number;
	readonly activeRecords: number;
	readonly approvedRecords: number;
	readonly appliedRecords: number;
	readonly rejectedRecords: number;
	readonly dismissedRecords: number;
	readonly conflictedRecords: number;
	readonly failedRecords: number;
	readonly destructiveRecords: number;
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
}

export interface StagedReviewConfirmationRequirement {
	readonly kind: StagedReviewConfirmationKind;
	readonly required: boolean;
	readonly requiredText?: string;
	readonly reasons: readonly string[];
	readonly appliesToChangeIds: readonly string[];
}

export interface StagedReviewPreviewLine {
	readonly kind: "context" | "added" | "removed";
	readonly oldLineNumber?: number;
	readonly newLineNumber?: number;
	readonly content: string;
}

export interface StagedReviewPreview {
	readonly changeId: string;
	readonly previewKind: StagedReviewPreviewKind;
	readonly operationKind: StagedChangeOperationKind;
	readonly status: StagedChangeStatus;
	readonly targetPath: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly rationale: string;
	readonly beforePreview?: string;
	readonly afterPreview?: string;
	readonly truncatedBefore: boolean;
	readonly truncatedAfter: boolean;
	readonly diffLines: readonly StagedReviewPreviewLine[];
	readonly conflicts: readonly StagedChangeConflict[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly backupPathIntent?: NormalizedVaultPath;
}

export interface StagedReviewGroup {
	readonly groupId: string;
	readonly key: StagedReviewGroupKey;
	readonly changeIds: readonly string[];
	readonly records: readonly StagedChangeRecord[];
	readonly previews: readonly StagedReviewPreview[];
	readonly summary: StagedReviewSummary;
	readonly confirmation: StagedReviewConfirmationRequirement;
}

export interface StagedReviewModel {
	readonly generatedAt: IsoTimestamp;
	readonly groups: readonly StagedReviewGroup[];
	readonly summary: StagedReviewSummary;
}

export interface StagedReviewActionRequest {
	readonly action: StagedReviewAction;
	readonly changeIds: readonly string[];
	readonly confirmationText?: string;
	readonly reason?: string;
}

export interface StagedReviewRecoverySummary {
	readonly commandId: string;
	readonly stagedChangeId: string;
	readonly targetPath: NormalizedVaultPath;
	readonly status: StagedChangeRecord["recovery"]["status"];
	readonly backupPathIntent?: NormalizedVaultPath;
	readonly validationOutput: readonly ValidationIssue[];
	readonly rejectedAt?: IsoTimestamp;
	readonly failedAt?: IsoTimestamp;
	readonly lastFailureMessage?: string;
}

export interface StagedReviewAuditEntry {
	readonly id: string;
	readonly commandId: string;
	readonly stagedChangeId: string;
	readonly action: StagedReviewAction | "backup-written" | "index-refresh";
	readonly operationKind: StagedChangeOperationKind;
	readonly occurredAt: IsoTimestamp;
	readonly status: "succeeded" | "failed";
	readonly targetPath: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly backupPath?: NormalizedVaultPath;
	readonly validationOutput: readonly ValidationIssue[];
	readonly message: string;
	readonly operationLogEntry?: OperationLogEntry;
}

export interface StagedReviewRecordOutcome {
	readonly changeId: string;
	readonly status: StagedReviewOutcomeStatus;
	readonly record: StagedChangeRecord;
	readonly message: string;
	readonly recovery: StagedReviewRecoverySummary;
	readonly auditEntry?: StagedReviewAuditEntry;
}

export interface StagedReviewActionResult {
	readonly ok: boolean;
	readonly action: StagedReviewAction;
	readonly records: readonly StagedChangeRecord[];
	readonly outcomes: readonly StagedReviewRecordOutcome[];
	readonly auditEntries: readonly StagedReviewAuditEntry[];
	readonly recovery: readonly StagedReviewRecoverySummary[];
}

export interface StagedReviewApplyPlanEntry {
	readonly record: StagedChangeRecord;
	readonly currentContent?: string;
	readonly backupContent?: string;
	readonly backupPath?: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly validationOutput: readonly ValidationIssue[];
}

export interface StagedReviewApplyPlan {
	readonly planId: string;
	readonly createdAt: IsoTimestamp;
	readonly confirmation: StagedReviewConfirmationRequirement;
	readonly entries: readonly StagedReviewApplyPlanEntry[];
	readonly auditEntries: readonly StagedReviewAuditEntry[];
	readonly recovery: readonly StagedReviewRecoverySummary[];
}

export interface StagedReviewApplyPlanSuccess {
	readonly ok: true;
	readonly plan: StagedReviewApplyPlan;
}

export interface StagedReviewApplyPlanFailure {
	readonly ok: false;
	readonly records: readonly StagedChangeRecord[];
	readonly outcomes: readonly StagedReviewRecordOutcome[];
	readonly auditEntries: readonly StagedReviewAuditEntry[];
	readonly recovery: readonly StagedReviewRecoverySummary[];
	readonly errors: readonly ValidationIssue[];
}

export type StagedReviewApplyPlanResult = StagedReviewApplyPlanSuccess | StagedReviewApplyPlanFailure;

export interface StagedReviewApplyFailure {
	readonly changeId: string;
	readonly message: string;
	readonly validationOutput: readonly ValidationIssue[];
}

export interface StagedReviewIndexRefreshResult {
	readonly attempted: boolean;
	readonly ok: boolean;
	readonly message: string;
	readonly retryable: boolean;
	readonly targetPaths: readonly NormalizedVaultPath[];
}

export interface StagedReviewApplyOutcome {
	readonly ok: boolean;
	readonly planId: string;
	readonly records: readonly StagedChangeRecord[];
	readonly outcomes: readonly StagedReviewRecordOutcome[];
	readonly auditEntries: readonly StagedReviewAuditEntry[];
	readonly recovery: readonly StagedReviewRecoverySummary[];
	readonly indexRefresh: StagedReviewIndexRefreshResult;
}

export interface StagedReviewPreflightAdapter {
	readonly exists: (path: NormalizedVaultPath) => Promise<boolean>;
	readonly read: (path: NormalizedVaultPath) => Promise<string>;
	readonly canWrite?: (path: NormalizedVaultPath) => Promise<boolean>;
}

export interface StagedReviewApplyRuntimeAdapter extends StagedReviewPreflightAdapter {
	readonly create: (path: NormalizedVaultPath, content: string) => Promise<void>;
	readonly modify: (path: NormalizedVaultPath, content: string) => Promise<void>;
	readonly delete: (path: NormalizedVaultPath) => Promise<void>;
	readonly rename: (path: NormalizedVaultPath, destinationPath: NormalizedVaultPath) => Promise<void>;
	readonly writeSupportRecord: (path: NormalizedVaultPath, content: string) => Promise<void>;
	readonly refreshIndex?: (paths: readonly NormalizedVaultPath[]) => Promise<StagedReviewIndexRefreshResult>;
}

export interface StagedReviewStoreState {
	readonly status: "idle" | "loading" | "ready" | "applying" | "failed";
	readonly model: StagedReviewModel | null;
	readonly selectedGroupId: string | null;
	readonly selectedChangeIds: readonly string[];
	readonly confirmationText: string;
	readonly inFlightAction: StagedReviewAction | null;
	readonly failureMessage: string | null;
	readonly lastOutcome: StagedReviewApplyOutcome | StagedReviewActionResult | null;
	readonly updatedAt: IsoTimestamp;
}

export type StagedReviewStoreSubscriber = (state: StagedReviewStoreState) => void;
export type StagedReviewStoreUnsubscribe = () => void;
