import type {
	ProviderEmbeddingRequest,
	ProviderEmbeddingTextChunk,
	ProviderInvocationDuplicateKey,
	ProviderInvocationRecoveryMetadata,
} from "./provider-invocation";
import type { ContentSensitivity, ProviderId, ProviderInvocationPreflightDecision, ProviderModelId } from "./providers";
import type { IsoTimestamp, NormalizedVaultPath, Wikilink } from "./vault";

export const MARKDOWN_PARSE_ERROR_CODES = [
	"parse.invalid-path",
	"parse.invalid-content",
	"parse.invalid-frontmatter",
	"parse.invalid-heading",
	"parse.empty-chunk",
] as const;

export const WIKILINK_TARGET_STATUSES = ["resolved", "missing", "unknown"] as const;
export const MARKDOWN_TAG_SOURCES = ["frontmatter", "inline"] as const;
export const RETRIEVAL_SCORE_METHODS = ["lexical", "semantic"] as const;
export const RETRIEVAL_ERROR_CODES = [
	"retrieval.invalid-query",
	"retrieval.invalid-limit",
	"retrieval.index-not-ready",
	"retrieval.unsupported-filter",
] as const;
export const RETRIEVAL_READINESS_STATES = [
	"ready",
	"building",
	"stale",
	"missing",
	"error",
	"canceled",
	"disabled",
	"blocked",
] as const;
export const INDEX_JOB_STATUSES = ["idle", "building", "ready", "stale", "error", "canceled"] as const;
export const INDEX_FRESHNESS_STATES = ["fresh", "stale", "missing", "partial"] as const;
export const SEMANTIC_DISTANCE_METRICS = ["cosine", "dot-product", "euclidean"] as const;
export const SEMANTIC_COMPATIBILITY_CODES = [
	"compatible",
	"family-mismatch",
	"dimension-mismatch",
	"missing-embedding-family",
] as const;

export type MarkdownParseErrorCode = (typeof MARKDOWN_PARSE_ERROR_CODES)[number];
export type WikilinkTargetStatus = (typeof WIKILINK_TARGET_STATUSES)[number];
export type MarkdownTagSource = (typeof MARKDOWN_TAG_SOURCES)[number];
export type RetrievalScoreMethod = (typeof RETRIEVAL_SCORE_METHODS)[number];
export type RetrievalErrorCode = (typeof RETRIEVAL_ERROR_CODES)[number];
export type RetrievalReadinessState = (typeof RETRIEVAL_READINESS_STATES)[number];
export type IndexJobStatus = (typeof INDEX_JOB_STATUSES)[number];
export type IndexFreshnessState = (typeof INDEX_FRESHNESS_STATES)[number];
export type SemanticDistanceMetric = (typeof SEMANTIC_DISTANCE_METRICS)[number];
export type SemanticCompatibilityCode = (typeof SEMANTIC_COMPATIBILITY_CODES)[number];
export type EmbeddingModelFamily = string & { readonly __embeddingModelFamily: unique symbol };

export type FrontmatterPrimitive = string | number | boolean | null;
export type FrontmatterValue = FrontmatterPrimitive | readonly FrontmatterPrimitive[];
export type ParsedFrontmatter = Readonly<Record<string, FrontmatterValue>>;

export interface MarkdownParseIssue {
	readonly code: MarkdownParseErrorCode;
	readonly message: string;
	readonly path?: NormalizedVaultPath | string;
	readonly field?: string;
	readonly line?: number;
}

export interface MarkdownHeading {
	readonly id: string;
	readonly path: NormalizedVaultPath;
	readonly level: 1 | 2 | 3 | 4 | 5 | 6;
	readonly text: string;
	readonly slug: string;
	readonly lineStart: number;
	readonly lineEnd: number;
}

export interface ParsedWikilink {
	readonly raw: Wikilink;
	readonly target: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly heading?: string;
	readonly alias?: string;
	readonly status: WikilinkTargetStatus;
	readonly line: number;
}

export interface MarkdownTag {
	readonly value: string;
	readonly source: MarkdownTagSource;
	readonly line?: number;
}

export interface MarkdownTextChunk {
	readonly id: string;
	readonly path: NormalizedVaultPath;
	readonly heading?: string;
	readonly headingLevel?: MarkdownHeading["level"];
	readonly startLine: number;
	readonly endLine: number;
	readonly text: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
}

export interface ParsedMarkdownNote {
	readonly path: NormalizedVaultPath;
	readonly frontmatter: ParsedFrontmatter;
	readonly body: string;
	readonly headings: readonly MarkdownHeading[];
	readonly wikilinks: readonly ParsedWikilink[];
	readonly tags: readonly MarkdownTag[];
	readonly chunks: readonly MarkdownTextChunk[];
	readonly contentFingerprint: string;
}

export interface MarkdownParseSuccess {
	readonly ok: true;
	readonly value: ParsedMarkdownNote;
}

export interface MarkdownParseFailure {
	readonly ok: false;
	readonly errors: readonly MarkdownParseIssue[];
}

export type MarkdownParseResult = MarkdownParseSuccess | MarkdownParseFailure;

export interface RetrievalScoreDetails {
	readonly method: RetrievalScoreMethod;
	readonly score: number;
	readonly matchedTokens: readonly string[];
	readonly normalizedScore?: number;
	readonly vectorSimilarity?: number;
}

export interface RetrievalResult {
	readonly id: string;
	readonly path: NormalizedVaultPath;
	readonly heading?: string;
	readonly headingLevel?: MarkdownHeading["level"];
	readonly snippet: string;
	readonly score: number;
	readonly scoreDetails: RetrievalScoreDetails;
	readonly chunkId: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
}

export interface RetrievalQueryFilters {
	readonly paths?: readonly NormalizedVaultPath[];
	readonly tags?: readonly string[];
}

export interface RetrievalQuery {
	readonly query: string;
	readonly limit: number;
	readonly offset?: number;
	readonly filters?: RetrievalQueryFilters;
}

export interface RetrievalFailure {
	readonly ok: false;
	readonly code: RetrievalErrorCode;
	readonly message: string;
	readonly field?: string;
}

export interface RetrievalSuccess {
	readonly ok: true;
	readonly query: RetrievalQuery;
	readonly results: readonly RetrievalResult[];
}

export type RetrievalSearchResult = RetrievalSuccess | RetrievalFailure;

export interface IndexSourceFingerprint {
	readonly path: NormalizedVaultPath;
	readonly contentFingerprint: string;
}

export interface IndexProgressSnapshot {
	readonly jobId: string;
	readonly indexId: string;
	readonly status: IndexJobStatus;
	readonly totalNotes: number;
	readonly indexedNotes: number;
	readonly currentPath?: NormalizedVaultPath;
	readonly startedAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly errorMessage?: string;
}

export interface IndexJobOptions {
	readonly jobId: string;
	readonly indexId: string;
	readonly now: () => Date;
	readonly signal?: AbortSignal;
	readonly onProgress?: (snapshot: IndexProgressSnapshot) => void;
}

export interface IndexJobSuccess<TIndex> {
	readonly ok: true;
	readonly status: "ready";
	readonly index: TIndex;
	readonly progress: IndexProgressSnapshot;
}

export interface IndexJobCanceled {
	readonly ok: false;
	readonly status: "canceled";
	readonly message: string;
	readonly progress: IndexProgressSnapshot;
}

export interface IndexJobFailed {
	readonly ok: false;
	readonly status: "error";
	readonly message: string;
	readonly progress: IndexProgressSnapshot;
}

export type IndexJobResult<TIndex> = IndexJobSuccess<TIndex> | IndexJobCanceled | IndexJobFailed;

export interface IndexFreshnessSnapshot {
	readonly indexId: string;
	readonly state: IndexFreshnessState;
	readonly checkedAt: IsoTimestamp;
	readonly indexedSources: readonly IndexSourceFingerprint[];
	readonly currentSources: readonly IndexSourceFingerprint[];
	readonly staleSourcePaths: readonly NormalizedVaultPath[];
	readonly missingSourcePaths: readonly NormalizedVaultPath[];
	readonly extraSourcePaths: readonly NormalizedVaultPath[];
}

export interface LexicalTokenRecord {
	readonly token: string;
	readonly count: number;
}

export interface LexicalIndexChunkRecord {
	readonly chunk: MarkdownTextChunk;
	readonly tokens: readonly LexicalTokenRecord[];
	readonly totalTokenCount: number;
}

export interface LexicalIndexSnapshot {
	readonly indexId: string;
	readonly status: IndexJobStatus;
	readonly builtAt?: IsoTimestamp;
	readonly sources: readonly IndexSourceFingerprint[];
	readonly chunks: readonly LexicalIndexChunkRecord[];
}

export interface LexicalSearchHit {
	readonly chunk: MarkdownTextChunk;
	readonly score: number;
	readonly matchedTokens: readonly string[];
}

export interface SemanticIndexConfig {
	readonly indexId: string;
	readonly embeddingModelFamily: EmbeddingModelFamily;
	readonly dimensions: number;
	readonly distanceMetric: SemanticDistanceMetric;
}

export interface SemanticVectorEntry {
	readonly id: string;
	readonly path: NormalizedVaultPath;
	readonly chunkId: string;
	readonly embeddingModelFamily: EmbeddingModelFamily;
	readonly dimensions: number;
	readonly vector: readonly number[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly contentFingerprint: string;
}

export interface SemanticIndexSnapshot {
	readonly config: SemanticIndexConfig;
	readonly status: IndexJobStatus;
	readonly builtAt?: IsoTimestamp;
	readonly sources: readonly IndexSourceFingerprint[];
	readonly entries: readonly SemanticVectorEntry[];
}

export interface SemanticCompatibilityAllowed {
	readonly ok: true;
	readonly code: "compatible";
	readonly embeddingModelFamily: EmbeddingModelFamily;
	readonly dimensions: number;
}

export interface SemanticCompatibilityDenied {
	readonly ok: false;
	readonly code: Exclude<SemanticCompatibilityCode, "compatible">;
	readonly message: string;
	readonly field?: string;
}

export type SemanticCompatibilityDecision = SemanticCompatibilityAllowed | SemanticCompatibilityDenied;

export interface SemanticProviderPreflightRequest {
	readonly providerId: ProviderId;
	readonly preferredModelId?: ProviderModelId;
	readonly contentSensitivity: ContentSensitivity;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly workflowId: string;
	readonly userFacingPurpose: string;
}

export interface SemanticProviderPreflightResult {
	readonly preflight: ProviderInvocationPreflightDecision;
	readonly embeddingModelFamily?: EmbeddingModelFamily;
}

export interface SemanticEmbeddingInvocationInput {
	readonly chunks: readonly ProviderEmbeddingTextChunk[];
	readonly timeoutMs: number;
	readonly invocationKey?: ProviderInvocationDuplicateKey;
	readonly recovery?: ProviderInvocationRecoveryMetadata;
}

export interface SemanticEmbeddingInvocationAllowed {
	readonly ok: true;
	readonly preflight: SemanticProviderPreflightResult;
	readonly request: ProviderEmbeddingRequest;
}

export interface SemanticEmbeddingInvocationDenied {
	readonly ok: false;
	readonly message: string;
	readonly preflight: SemanticProviderPreflightResult;
	readonly compatibility?: SemanticCompatibilityDecision;
}

export type SemanticEmbeddingInvocationDecision =
	| SemanticEmbeddingInvocationAllowed
	| SemanticEmbeddingInvocationDenied;

export const makeEmbeddingModelFamily = (family: string): EmbeddingModelFamily => family as EmbeddingModelFamily;

export const assertNeverRetrievalValue = (value: never): never => {
	throw new Error(`Unhandled retrieval contract value: ${String(value)}`);
};
