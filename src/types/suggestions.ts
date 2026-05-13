import type { RetrievalScoreMethod } from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "./vault";

export const SIMILAR_NOTE_SIGNAL_KINDS = [
	"lexical",
	"semantic",
	"wikilink",
	"tag",
	"heading",
	"alias",
	"folder",
	"source-path",
	"frontmatter",
] as const;

export const SIMILAR_NOTE_SUGGESTION_KINDS = [
	"wikilink",
	"tag",
	"alias",
	"related-note",
	"folder-placement",
	"frontmatter-placement",
] as const;

export const SIMILAR_NOTE_CONFIDENCES = ["high", "medium", "low"] as const;
export const SIMILAR_NOTE_STAGEABILITY_KINDS = ["stageable", "report-only", "blocked"] as const;
export const SIMILAR_NOTE_SOURCE_KINDS = ["parsed-note", "retrieval-result", "staged-change"] as const;
export const SIMILAR_NOTE_STAGE_FAILURE_REASONS = [
	"not-found",
	"report-only",
	"blocked",
	"missing-content",
	"unsupported-kind",
	"unsupported-path",
	"active-staged-change",
	"in-flight",
	"validation-failed",
	"no-op",
] as const;

export type SimilarNoteSignalKind = (typeof SIMILAR_NOTE_SIGNAL_KINDS)[number];
export type SimilarNoteSuggestionKind = (typeof SIMILAR_NOTE_SUGGESTION_KINDS)[number];
export type SimilarNoteConfidence = (typeof SIMILAR_NOTE_CONFIDENCES)[number];
export type SimilarNoteStageabilityKind = (typeof SIMILAR_NOTE_STAGEABILITY_KINDS)[number];
export type SimilarNoteSourceKind = (typeof SIMILAR_NOTE_SOURCE_KINDS)[number];
export type SimilarNoteStageFailureReason = (typeof SIMILAR_NOTE_STAGE_FAILURE_REASONS)[number];

export interface SimilarNoteSignalEvidence {
	readonly id: string;
	readonly kind: SimilarNoteSignalKind;
	readonly detail: string;
	readonly score: number;
	readonly sourcePath: NormalizedVaultPath;
	readonly relatedPath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly heading?: string;
	readonly value?: string;
	readonly sourceRecordId?: string;
	readonly retrievalResultId?: string;
	readonly retrievalMethod?: RetrievalScoreMethod;
	readonly validationOutput?: readonly ValidationIssue[];
}

export interface SimilarNoteSourceRecord {
	readonly kind: SimilarNoteSourceKind;
	readonly id: string;
	readonly path?: NormalizedVaultPath;
	readonly relatedPath?: NormalizedVaultPath;
	readonly heading?: string;
	readonly retrievalResultId?: string;
	readonly stagedChangeId?: string;
}

export interface SimilarNoteCandidate {
	readonly candidateId: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly relatedPath: NormalizedVaultPath;
	readonly score: number;
	readonly confidence: SimilarNoteConfidence;
	readonly rank: number;
	readonly evidence: readonly SimilarNoteSignalEvidence[];
	readonly sourceRecords: readonly SimilarNoteSourceRecord[];
	readonly rankReasons: readonly string[];
}

export interface SimilarNoteStageability {
	readonly kind: SimilarNoteStageabilityKind;
	readonly reason: string;
	readonly commandId?: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly blockedByStagedChangeId?: string;
}

export interface SimilarNoteSuggestionRecovery {
	readonly commandId: string;
	readonly suggestionId?: string;
	readonly sourcePath?: NormalizedVaultPath;
	readonly relatedPath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput: readonly ValidationIssue[];
}

export interface SimilarNoteSuggestion {
	readonly suggestionId: string;
	readonly kind: SimilarNoteSuggestionKind;
	readonly confidence: SimilarNoteConfidence;
	readonly score: number;
	readonly rank: number;
	readonly title: string;
	readonly summary: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly relatedPath?: NormalizedVaultPath;
	readonly targetPath: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly suggestedValue?: string;
	readonly existingValue?: string;
	readonly evidence: readonly SimilarNoteSignalEvidence[];
	readonly sourceRecords: readonly SimilarNoteSourceRecord[];
	readonly stageability: SimilarNoteStageability;
	readonly recovery: SimilarNoteSuggestionRecovery;
	readonly rankReasons: readonly string[];
}

export interface SimilarNoteSuggestionSummary {
	readonly totalSuggestions: number;
	readonly highConfidenceCount: number;
	readonly mediumConfidenceCount: number;
	readonly lowConfidenceCount: number;
	readonly stageableCount: number;
	readonly reportOnlyCount: number;
	readonly blockedCount: number;
	readonly affectedPaths: readonly NormalizedVaultPath[];
}

export interface SimilarNoteSuggestionPlan {
	readonly schemaVersion: 1;
	readonly generatedAt: IsoTimestamp;
	readonly candidates: readonly SimilarNoteCandidate[];
	readonly suggestions: readonly SimilarNoteSuggestion[];
	readonly summary: SimilarNoteSuggestionSummary;
}

export interface SimilarNoteStageSuccess {
	readonly ok: true;
	readonly suggestionId: string;
	readonly targetPath: NormalizedVaultPath;
	readonly stagedChangeId: string;
	readonly stagedChange: StagedChangeRecord;
	readonly recovery: SimilarNoteSuggestionRecovery;
}

export interface SimilarNoteStageFailure {
	readonly ok: false;
	readonly suggestionId?: string;
	readonly reason: SimilarNoteStageFailureReason;
	readonly message: string;
	readonly recovery: SimilarNoteSuggestionRecovery;
}

export type SimilarNoteStageResult = SimilarNoteStageSuccess | SimilarNoteStageFailure;
