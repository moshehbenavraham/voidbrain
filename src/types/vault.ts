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

export type OperationKind = "source-imported" | "note-indexed" | "summary-generated" | "staged-change-created";

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

export type StagedChangeOperationKind = "create-note" | "update-frontmatter" | "append-section";
export type StagedChangeStatus = "proposed" | "approved" | "applied" | "rejected";

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
