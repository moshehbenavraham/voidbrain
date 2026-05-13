export const MARKDOWN_ARTIFACT_KINDS = ["source", "entity", "concept", "summary", "conversation"] as const;

export const SUPPORT_ARTIFACT_KINDS = [
	"source-manifest",
	"index-metadata",
	"hot-cache",
	"operation-log",
	"staged-change",
] as const;

export type MarkdownArtifactKind = (typeof MARKDOWN_ARTIFACT_KINDS)[number];
export type SupportArtifactKind = (typeof SUPPORT_ARTIFACT_KINDS)[number];
export type VaultArtifactKind = MarkdownArtifactKind | SupportArtifactKind;

export type NormalizedVaultPath = string & { readonly __normalizedVaultPath: unique symbol };
export type Wikilink = string & { readonly __wikilink: unique symbol };
export type IsoTimestamp = string & { readonly __isoTimestamp: unique symbol };

export type ValidationErrorCode =
	| "path.empty"
	| "path.absolute"
	| "path.traversal"
	| "path.url"
	| "path.invalid-extension"
	| "path.unsupported-location"
	| "metadata.not-object"
	| "metadata.missing-field"
	| "metadata.invalid-type"
	| "metadata.unsupported-artifact-kind"
	| "metadata.secret-field"
	| "metadata.missing-source-trace"
	| "record.invalid-state"
	| "record.invalid-operation"
	| "record.unsorted";

export interface ValidationIssue {
	readonly code: ValidationErrorCode;
	readonly message: string;
	readonly path?: NormalizedVaultPath | string;
	readonly field?: string;
}

export interface ValidationSuccess<TValue> {
	readonly ok: true;
	readonly value: TValue;
}

export interface ValidationFailure {
	readonly ok: false;
	readonly errors: readonly ValidationIssue[];
}

export type ValidationResult<TValue> = ValidationSuccess<TValue> | ValidationFailure;

export interface VaultLocationContract {
	readonly artifactKind: VaultArtifactKind;
	readonly baseFolder: NormalizedVaultPath;
	readonly fileExtension: ".md" | ".json";
	readonly isSupportArtifact: boolean;
}

export const makeNormalizedVaultPath = (path: string): NormalizedVaultPath => path as NormalizedVaultPath;

export const makeWikilink = (wikilink: string): Wikilink => wikilink as Wikilink;

export const makeIsoTimestamp = (timestamp: string): IsoTimestamp => timestamp as IsoTimestamp;

export type SourceType = "article" | "book" | "web-page" | "user-note" | "conversation" | "other";
export type EntityType = "person" | "organization" | "project" | "place" | "tool" | "other";
export type ConceptType = "principle" | "workflow" | "claim" | "topic" | "question" | "other";
export type SummaryType = "source-summary" | "entity-summary" | "concept-summary" | "conversation-summary";

export interface CommonGeneratedFrontmatter {
	readonly "voidbrain-id": string;
	readonly "artifact-kind": MarkdownArtifactKind;
	readonly "created-at": IsoTimestamp;
	readonly "updated-at": IsoTimestamp;
	readonly "source-paths": readonly NormalizedVaultPath[];
	readonly tags: readonly string[];
}

export interface SourceFrontmatter extends CommonGeneratedFrontmatter {
	readonly "artifact-kind": "source";
	readonly title: string;
	readonly "source-type": SourceType;
	readonly "source-url"?: string;
	readonly "external-id"?: string;
}

export interface EntityFrontmatter extends CommonGeneratedFrontmatter {
	readonly "artifact-kind": "entity";
	readonly title: string;
	readonly "entity-type": EntityType;
	readonly aliases: readonly string[];
}

export interface ConceptFrontmatter extends CommonGeneratedFrontmatter {
	readonly "artifact-kind": "concept";
	readonly title: string;
	readonly "concept-type": ConceptType;
	readonly aliases: readonly string[];
	readonly "related-notes": readonly NormalizedVaultPath[];
}

export interface SummaryFrontmatter extends CommonGeneratedFrontmatter {
	readonly "artifact-kind": "summary";
	readonly title: string;
	readonly "summary-type": SummaryType;
	readonly "summary-of": NormalizedVaultPath;
	readonly citations: readonly string[];
}

export interface ConversationFrontmatter extends CommonGeneratedFrontmatter {
	readonly "artifact-kind": "conversation";
	readonly title: string;
	readonly "thread-id": string;
	readonly "message-count": number;
	readonly participants: readonly string[];
}

export type GeneratedNoteFrontmatter =
	| SourceFrontmatter
	| EntityFrontmatter
	| ConceptFrontmatter
	| SummaryFrontmatter
	| ConversationFrontmatter;

export interface GeneratedMarkdownNote<TFrontmatter extends GeneratedNoteFrontmatter = GeneratedNoteFrontmatter> {
	readonly path: NormalizedVaultPath;
	readonly frontmatter: TFrontmatter;
	readonly body: string;
	readonly wikilinks: readonly Wikilink[];
}

export interface SourceManifestRecord {
	readonly id: string;
	readonly path: NormalizedVaultPath;
	readonly title: string;
	readonly sourceType: SourceType;
	readonly sourceUrl?: string;
	readonly contentSha256: string;
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly tags: readonly string[];
}

export interface SourceManifest {
	readonly artifactKind: "source-manifest";
	readonly schemaVersion: 1;
	readonly generatedAt: IsoTimestamp;
	readonly records: readonly SourceManifestRecord[];
}

export type IndexKind = "lexical" | "semantic";
export type IndexStatus = "ready" | "building" | "stale" | "error";

export interface IndexMetadata {
	readonly artifactKind: "index-metadata";
	readonly schemaVersion: 1;
	readonly indexId: string;
	readonly indexKind: IndexKind;
	readonly status: IndexStatus;
	readonly updatedAt: IsoTimestamp;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly embeddingModelFamily?: string;
}

export interface HotCacheEntry {
	readonly key: string;
	readonly path: NormalizedVaultPath;
	readonly lastAccessedAt: IsoTimestamp;
	readonly summary: string;
}

export interface HotCacheState {
	readonly artifactKind: "hot-cache";
	readonly schemaVersion: 1;
	readonly cacheId: string;
	readonly updatedAt: IsoTimestamp;
	readonly entries: readonly HotCacheEntry[];
}

export type OperationKind =
	| "source-imported"
	| "note-indexed"
	| "summary-generated"
	| "staged-change-created"
	| "staged-change-approved"
	| "staged-change-applied"
	| "staged-change-rejected"
	| "staged-change-dismissed"
	| "staged-change-failed"
	| "staged-change-conflicted"
	| "staged-change-backup-written";

export interface OperationLogEntry {
	readonly id: string;
	readonly operationKind: OperationKind;
	readonly occurredAt: IsoTimestamp;
	readonly status: "succeeded" | "failed";
	readonly summary: string;
	readonly paths: readonly NormalizedVaultPath[];
}

export interface OperationLog {
	readonly artifactKind: "operation-log";
	readonly schemaVersion: 1;
	readonly logId: string;
	readonly entries: readonly OperationLogEntry[];
}

export const STAGED_CHANGE_OPERATION_KINDS = [
	"create-note",
	"update-note",
	"delete-note",
	"move-note",
	"update-frontmatter",
] as const;

export const STAGED_CHANGE_STATUSES = [
	"proposed",
	"review-ready",
	"conflicted",
	"approved",
	"applied",
	"rejected",
	"dismissed",
	"failed",
] as const;

export type StagedChangeOperationKind = (typeof STAGED_CHANGE_OPERATION_KINDS)[number];
export type StagedChangeStatus = (typeof STAGED_CHANGE_STATUSES)[number];

export const STAGED_CHANGE_CONFLICT_KINDS = [
	"target-missing",
	"target-exists",
	"target-changed",
	"destination-exists",
	"duplicate-in-flight",
	"validation-failed",
] as const;

export const STAGED_CHANGE_RECOVERY_STATUSES = [
	"not-needed",
	"pending-review",
	"retryable",
	"applied",
	"rejected",
	"dismissed",
	"failed-apply",
] as const;

export type StagedChangeConflictKind = (typeof STAGED_CHANGE_CONFLICT_KINDS)[number];
export type StagedChangeConflictSeverity = "warning" | "blocking";
export type StagedChangeRecoveryStatus = (typeof STAGED_CHANGE_RECOVERY_STATUSES)[number];
export type StagedChangeDiffLineKind = "context" | "added" | "removed";
export type StagedFrontmatterValue = string | number | boolean | null | readonly (string | number | boolean | null)[];

export interface StagedChangeDiffLine {
	readonly kind: StagedChangeDiffLineKind;
	readonly oldLineNumber?: number;
	readonly newLineNumber?: number;
	readonly content: string;
}

export interface StagedChangeDiffContext {
	readonly beforeContent?: string;
	readonly afterContent?: string;
	readonly beforeSha256?: string;
	readonly afterSha256?: string;
	readonly lineDiff: readonly StagedChangeDiffLine[];
	readonly hasTextChanges: boolean;
}

export interface StagedChangeConflict {
	readonly kind: StagedChangeConflictKind;
	readonly severity: StagedChangeConflictSeverity;
	readonly message: string;
	readonly paths: readonly NormalizedVaultPath[];
	readonly expectedSha256?: string;
	readonly actualSha256?: string;
}

export interface StagedChangeReviewMetadata {
	readonly requiresExplicitReview: boolean;
	readonly destructive: boolean;
	readonly reasons: readonly string[];
}

export interface StagedFrontmatterPatchEntry {
	readonly key: string;
	readonly before?: StagedFrontmatterValue;
	readonly after?: StagedFrontmatterValue;
}

export interface StagedChangeOperationMetadata {
	readonly destinationPath?: NormalizedVaultPath;
	readonly frontmatterPatch?: readonly StagedFrontmatterPatchEntry[];
}

export interface StagedChangeRecoveryMetadata {
	readonly commandId: string;
	readonly stagedChangeId: string;
	readonly targetPath: NormalizedVaultPath;
	readonly status: StagedChangeRecoveryStatus;
	readonly backupPathIntent?: NormalizedVaultPath;
	readonly backupWrittenAt?: IsoTimestamp;
	readonly appliedAt?: IsoTimestamp;
	readonly validationOutput: readonly ValidationIssue[];
	readonly rejectedAt?: IsoTimestamp;
	readonly dismissedAt?: IsoTimestamp;
	readonly failedAt?: IsoTimestamp;
	readonly lastFailureMessage?: string;
	readonly auditLogEntryIds?: readonly string[];
}

export interface StagedChangeRecord {
	readonly artifactKind: "staged-change";
	readonly schemaVersion: 1;
	readonly changeId: string;
	readonly operationKind: StagedChangeOperationKind;
	readonly status: StagedChangeStatus;
	readonly targetPath: NormalizedVaultPath;
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly rationale: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly beforeSha256?: string;
	readonly afterSha256?: string;
	readonly diff: StagedChangeDiffContext;
	readonly conflicts: readonly StagedChangeConflict[];
	readonly review: StagedChangeReviewMetadata;
	readonly recovery: StagedChangeRecoveryMetadata;
	readonly operationMetadata?: StagedChangeOperationMetadata;
}

export interface RuntimeState {
	readonly schemaVersion: 1;
	readonly indexMetadata: IndexMetadata;
	readonly hotCache: HotCacheState;
	readonly stagedChanges: readonly StagedChangeRecord[];
	readonly operationLog: OperationLog;
}

export type DurableJsonRecord =
	| SourceManifest
	| IndexMetadata
	| HotCacheState
	| OperationLog
	| StagedChangeRecord
	| RuntimeState;
