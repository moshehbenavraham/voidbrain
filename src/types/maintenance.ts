import type { VaultHealthFindingKind } from "./health";
import type { IndexFreshnessState } from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "./vault";

export const MAINTENANCE_RECOMMENDATION_CATEGORIES = [
	"broken-wikilink",
	"orphan-note",
	"stale-index",
	"missing-citation",
	"content-gap",
	"retrieval-evidence",
	"active-staged-change",
] as const;

export const MAINTENANCE_RECOMMENDATION_SEVERITIES = ["error", "warning", "info"] as const;
export const MAINTENANCE_RECOMMENDATION_CONFIDENCES = ["high", "medium", "low"] as const;
export const MAINTENANCE_RECOMMENDATION_STAGEABILITY_KINDS = ["stageable", "report-only", "blocked"] as const;
export const MAINTENANCE_RECOMMENDATION_EVIDENCE_KINDS = [
	"health-finding",
	"index-freshness",
	"retrieval-result",
	"staged-change",
	"validation",
] as const;
export const MAINTENANCE_RECOMMENDATION_SOURCE_KINDS = [
	"health-report",
	"health-finding",
	"index",
	"retrieval-result",
	"staged-change",
] as const;
export const MAINTENANCE_RECOMMENDATION_STAGE_FAILURE_REASONS = [
	"not-found",
	"report-only",
	"missing-evidence",
	"unsupported-path",
	"active-staged-change",
	"in-flight",
	"validation-failed",
] as const;

export type MaintenanceRecommendationCategory = (typeof MAINTENANCE_RECOMMENDATION_CATEGORIES)[number];
export type MaintenanceRecommendationSeverity = (typeof MAINTENANCE_RECOMMENDATION_SEVERITIES)[number];
export type MaintenanceRecommendationConfidence = (typeof MAINTENANCE_RECOMMENDATION_CONFIDENCES)[number];
export type MaintenanceRecommendationStageabilityKind = (typeof MAINTENANCE_RECOMMENDATION_STAGEABILITY_KINDS)[number];
export type MaintenanceRecommendationEvidenceKind = (typeof MAINTENANCE_RECOMMENDATION_EVIDENCE_KINDS)[number];
export type MaintenanceRecommendationSourceKind = (typeof MAINTENANCE_RECOMMENDATION_SOURCE_KINDS)[number];
export type MaintenanceRecommendationStageFailureReason =
	(typeof MAINTENANCE_RECOMMENDATION_STAGE_FAILURE_REASONS)[number];

export type HealthMaintenanceRecommendationCategory = Extract<
	MaintenanceRecommendationCategory,
	VaultHealthFindingKind
>;

export interface MaintenanceRecommendationEvidence {
	readonly id: string;
	readonly kind: MaintenanceRecommendationEvidenceKind;
	readonly detail: string;
	readonly path?: NormalizedVaultPath;
	readonly sourcePath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly heading?: string;
	readonly line?: number;
	readonly reportId?: string;
	readonly findingId?: string;
	readonly indexId?: string;
	readonly indexState?: IndexFreshnessState;
	readonly retrievalResultId?: string;
	readonly stagedChangeId?: string;
	readonly score?: number;
	readonly validationOutput?: readonly ValidationIssue[];
}

export interface MaintenanceRecommendationSourceRecord {
	readonly kind: MaintenanceRecommendationSourceKind;
	readonly id: string;
	readonly path?: NormalizedVaultPath;
	readonly heading?: string;
	readonly indexId?: string;
	readonly reportId?: string;
	readonly findingId?: string;
	readonly retrievalResultId?: string;
	readonly stagedChangeId?: string;
}

export interface MaintenanceRecommendationStageability {
	readonly kind: MaintenanceRecommendationStageabilityKind;
	readonly reason: string;
	readonly commandId?: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly blockedByStagedChangeId?: string;
}

export interface MaintenanceRecommendationRecovery {
	readonly commandId: string;
	readonly reportId?: string;
	readonly findingId?: string;
	readonly indexId?: string;
	readonly retrievalResultId?: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput: readonly ValidationIssue[];
}

export interface MaintenanceRecommendation {
	readonly recommendationId: string;
	readonly category: MaintenanceRecommendationCategory;
	readonly severity: MaintenanceRecommendationSeverity;
	readonly confidence: MaintenanceRecommendationConfidence;
	readonly rank: number;
	readonly title: string;
	readonly summary: string;
	readonly affectedPaths: readonly NormalizedVaultPath[];
	readonly evidence: readonly MaintenanceRecommendationEvidence[];
	readonly sourceRecords: readonly MaintenanceRecommendationSourceRecord[];
	readonly stageability: MaintenanceRecommendationStageability;
	readonly recovery: MaintenanceRecommendationRecovery;
	readonly rankReasons: readonly string[];
}

export interface MaintenanceRecommendationSummary {
	readonly totalRecommendations: number;
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
	readonly highConfidenceCount: number;
	readonly mediumConfidenceCount: number;
	readonly lowConfidenceCount: number;
	readonly stageableCount: number;
	readonly reportOnlyCount: number;
	readonly blockedCount: number;
	readonly affectedPaths: readonly NormalizedVaultPath[];
}

export interface MaintenanceRecommendationPlan {
	readonly schemaVersion: 1;
	readonly generatedAt: IsoTimestamp;
	readonly recommendations: readonly MaintenanceRecommendation[];
	readonly summary: MaintenanceRecommendationSummary;
}

export interface MaintenanceRecommendationStageSuccess {
	readonly ok: true;
	readonly recommendationId: string;
	readonly findingId: string;
	readonly targetPath: NormalizedVaultPath;
	readonly stagedChangeId: string;
	readonly stagedChange: StagedChangeRecord;
	readonly recovery: MaintenanceRecommendationRecovery;
}

export interface MaintenanceRecommendationStageFailure {
	readonly ok: false;
	readonly recommendationId?: string;
	readonly reason: MaintenanceRecommendationStageFailureReason;
	readonly message: string;
	readonly recovery: MaintenanceRecommendationRecovery;
}

export type MaintenanceRecommendationStageResult =
	| MaintenanceRecommendationStageSuccess
	| MaintenanceRecommendationStageFailure;
