import type { AgentCommandId } from "./agent-commands";
import type { ChatProviderAttempt } from "./chat";
import type { ProviderSetupPreflightDecision } from "./provider-setup";
import type { ContentSensitivity, ProviderId, ProviderModelId, RedactedDiagnosticObject } from "./providers";
import type {
	EntityType,
	IsoTimestamp,
	MarkdownArtifactKind,
	NormalizedVaultPath,
	SourceManifest,
	SourceType,
	StagedChangeRecord,
	SummaryType,
	ValidationIssue,
} from "./vault";

export const INGEST_SOURCE_COMMAND_ID = "voidbrain.ingest-source" satisfies AgentCommandId;
export const INGESTION_STATE_SCHEMA_VERSION = 1;

export const SOURCE_INGESTION_KINDS = ["markdown-file", "text-file", "pasted-content", "url-record"] as const;
export const SOURCE_INGESTION_ARTIFACT_KINDS = ["source", "entity", "concept", "summary"] as const;
export const SOURCE_INGESTION_PROVIDER_MODES = ["none", "optional-summary"] as const;
export const SOURCE_INGESTION_PROVIDER_DECISION_KINDS = ["not-requested", "allowed", "denied", "failed"] as const;
export const SOURCE_INGESTION_STAGE_STATUSES = ["idle", "previewing", "ready", "staging", "staged", "failed"] as const;
export const SOURCE_INGESTION_FAILURE_CODES = [
	"ingestion.input-invalid",
	"ingestion.path-invalid",
	"ingestion.source-unsupported",
	"ingestion.source-too-large",
	"ingestion.url-unapproved",
	"ingestion.duplicate-source",
	"ingestion.target-conflict",
	"ingestion.provider-denied",
	"ingestion.provider-failed",
	"ingestion.citation-invalid",
	"ingestion.staging-failed",
	"ingestion.persistence-failed",
	"ingestion.canceled",
] as const;

export type SourceIngestionKind = (typeof SOURCE_INGESTION_KINDS)[number];
export type SourceIngestionArtifactKind = (typeof SOURCE_INGESTION_ARTIFACT_KINDS)[number];
export type SourceIngestionProviderMode = (typeof SOURCE_INGESTION_PROVIDER_MODES)[number];
export type SourceIngestionProviderDecisionKind = (typeof SOURCE_INGESTION_PROVIDER_DECISION_KINDS)[number];
export type SourceIngestionStageStatus = (typeof SOURCE_INGESTION_STAGE_STATUSES)[number];
export type SourceIngestionFailureCode = (typeof SOURCE_INGESTION_FAILURE_CODES)[number];

export interface SourceIngestionFileInput {
	readonly kind: "markdown-file" | "text-file";
	readonly path: string;
	readonly content?: string;
	readonly title?: string;
	readonly contentSensitivity?: ContentSensitivity;
	readonly providerMode?: SourceIngestionProviderMode;
}

export interface SourceIngestionPastedInput {
	readonly kind: "pasted-content";
	readonly content: string;
	readonly title: string;
	readonly sourcePath?: string;
	readonly contentSensitivity?: ContentSensitivity;
	readonly providerMode?: SourceIngestionProviderMode;
}

export interface SourceIngestionUrlInput {
	readonly kind: "url-record";
	readonly sourceUrl: string;
	readonly approved: boolean;
	readonly title: string;
	readonly content: string;
	readonly sourcePath?: string;
	readonly contentSensitivity?: ContentSensitivity;
	readonly providerMode?: SourceIngestionProviderMode;
}

export type SourceIngestionInput = SourceIngestionFileInput | SourceIngestionPastedInput | SourceIngestionUrlInput;

export interface SourceIngestionTargetPaths {
	readonly source: NormalizedVaultPath;
	readonly entities: readonly NormalizedVaultPath[];
	readonly concepts: readonly NormalizedVaultPath[];
	readonly summary: NormalizedVaultPath;
}

export type SourceIngestionDuplicateKind =
	| "none"
	| "content-hash"
	| "source-path"
	| "target-path"
	| "active-staged-change";

export interface SourceIngestionDuplicateStatus {
	readonly kind: SourceIngestionDuplicateKind;
	readonly isBlocking: boolean;
	readonly matchedPaths: readonly NormalizedVaultPath[];
	readonly matchedStagedChangeIds: readonly string[];
	readonly message: string;
}

export interface SourceIngestionProviderRequirement {
	readonly mode: SourceIngestionProviderMode;
	readonly isRequired: boolean;
	readonly role: "chat";
	readonly requiredCapability: "chat";
	readonly contentSensitivity: ContentSensitivity;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly purpose: string;
}

export interface SourceCitationEvidence {
	readonly citationId: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly sourceRecordId?: string;
	readonly heading?: string;
	readonly quote?: string;
}

export interface SourceIngestionExtractionPlan {
	readonly planId: string;
	readonly providerRequirement: SourceIngestionProviderRequirement;
	readonly expectedArtifacts: readonly SourceIngestionArtifactKind[];
	readonly citationExpectations: readonly string[];
	readonly targetPaths: SourceIngestionTargetPaths;
}

export interface SourceIngestionPreview {
	readonly commandId: typeof INGEST_SOURCE_COMMAND_ID;
	readonly sourceKind: SourceIngestionKind;
	readonly sourceType: SourceType;
	readonly title: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly sourceUrl?: string;
	readonly contentSha256: string;
	readonly contentBytes: number;
	readonly contentSensitivity: ContentSensitivity;
	readonly duplicateStatus: SourceIngestionDuplicateStatus;
	readonly targetPaths: SourceIngestionTargetPaths;
	readonly extractionPlan: SourceIngestionExtractionPlan;
	readonly citationEvidence: readonly SourceCitationEvidence[];
	readonly createdAt: IsoTimestamp;
}

export interface SourceIngestionIntakeRequest {
	readonly input: SourceIngestionInput;
	readonly existingSourceManifest?: SourceManifest;
	readonly existingNotes?: readonly { readonly path: string | NormalizedVaultPath; readonly content: string }[];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
	readonly signal?: AbortSignal;
}

export interface SourceIngestionProviderDecisionRecord {
	readonly kind: SourceIngestionProviderDecisionKind;
	readonly allowed: boolean;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly code: string | null;
	readonly userMessage: string;
	readonly attempts: readonly ChatProviderAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface SourceIngestionGeneratedArtifactBase {
	readonly artifactKind: SourceIngestionArtifactKind;
	readonly markdownArtifactKind: MarkdownArtifactKind;
	readonly targetPath: NormalizedVaultPath;
	readonly title: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly citations: readonly SourceCitationEvidence[];
	readonly markdown: string;
}

export interface SourceIngestionGeneratedSourceArtifact extends SourceIngestionGeneratedArtifactBase {
	readonly artifactKind: "source";
	readonly markdownArtifactKind: "source";
	readonly sourceType: SourceType;
	readonly sourceUrl?: string;
}

export interface SourceIngestionGeneratedEntityArtifact extends SourceIngestionGeneratedArtifactBase {
	readonly artifactKind: "entity";
	readonly markdownArtifactKind: "entity";
	readonly entityType: EntityType;
	readonly aliases: readonly string[];
}

export interface SourceIngestionGeneratedConceptArtifact extends SourceIngestionGeneratedArtifactBase {
	readonly artifactKind: "concept";
	readonly markdownArtifactKind: "concept";
	readonly conceptType: "topic" | "claim" | "principle" | "workflow" | "question" | "other";
	readonly aliases: readonly string[];
	readonly relatedNotes: readonly NormalizedVaultPath[];
}

export interface SourceIngestionGeneratedSummaryArtifact extends SourceIngestionGeneratedArtifactBase {
	readonly artifactKind: "summary";
	readonly markdownArtifactKind: "summary";
	readonly summaryType: SummaryType;
	readonly summaryOf: NormalizedVaultPath;
	readonly summaryCitations: readonly string[];
}

export type SourceIngestionGeneratedArtifact =
	| SourceIngestionGeneratedSourceArtifact
	| SourceIngestionGeneratedEntityArtifact
	| SourceIngestionGeneratedConceptArtifact
	| SourceIngestionGeneratedSummaryArtifact;

export interface SourceIngestionValidationOutput {
	readonly ok: boolean;
	readonly issues: readonly ValidationIssue[];
	readonly checkedArtifactPaths: readonly NormalizedVaultPath[];
}

export interface SourceIngestionRecoveryRecord {
	readonly commandId: typeof INGEST_SOURCE_COMMAND_ID;
	readonly sourcePath: NormalizedVaultPath;
	readonly contentSha256: string;
	readonly stagedChangeIds: readonly string[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly providerDecision: SourceIngestionProviderDecisionRecord;
	readonly validationOutput: readonly ValidationIssue[];
	readonly retryGuidance: string;
	readonly updatedAt: IsoTimestamp;
}

export interface SourceIngestionStageSuccess {
	readonly ok: true;
	readonly preview: SourceIngestionPreview;
	readonly providerDecision: SourceIngestionProviderDecisionRecord;
	readonly artifacts: readonly SourceIngestionGeneratedArtifact[];
	readonly stagedChanges: readonly StagedChangeRecord[];
	readonly validation: SourceIngestionValidationOutput;
	readonly recovery: SourceIngestionRecoveryRecord;
}

export interface SourceIngestionStageFailure {
	readonly ok: false;
	readonly code: SourceIngestionFailureCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly sourcePath?: NormalizedVaultPath;
	readonly stagedChangeIds: readonly string[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly providerDecision: SourceIngestionProviderDecisionRecord;
	readonly validationOutput: readonly ValidationIssue[];
	readonly recovery?: SourceIngestionRecoveryRecord;
}

export type SourceIngestionStageResult = SourceIngestionStageSuccess | SourceIngestionStageFailure;

export interface SourceIngestionStoreState {
	readonly schemaVersion: typeof INGESTION_STATE_SCHEMA_VERSION;
	readonly status: SourceIngestionStageStatus;
	readonly preview: SourceIngestionPreview | null;
	readonly failure: SourceIngestionStageFailure | null;
	readonly stagedChangeIds: readonly string[];
	readonly recovery: SourceIngestionRecoveryRecord | null;
	readonly updatedAt: IsoTimestamp;
}

export type SourceIngestionStoreSubscriber = (state: SourceIngestionStoreState) => void;
export type SourceIngestionStoreUnsubscribe = () => void;
