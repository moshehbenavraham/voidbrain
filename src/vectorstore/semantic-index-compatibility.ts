import type { SemanticIndexReadiness } from "../types/indexing-runtime";
import type {
	EmbeddingModelFamily,
	IndexJobStatus,
	IndexSourceFingerprint,
	RetrievalReadinessState,
	SemanticIndexCompatibility,
	SemanticIndexCompatibilityCode,
	SemanticIndexCompatibilityRecovery,
	SemanticIndexCompatibilityState,
	SemanticIndexSnapshot,
	SemanticIndexSourcePathCounts,
	SemanticReindexGuidance,
	SemanticRetrievalFallbackMode,
} from "../types/retrieval";
import { makeEmbeddingModelFamily } from "../types/retrieval";
import { type IsoTimestamp, type NormalizedVaultPath, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths } from "../utils/vault-paths";
import { sortSourceFingerprints } from "./index-state";

export const SEMANTIC_INDEX_COMPATIBILITY_COMMAND_ID = "voidbrain.semantic-index-compatibility";

export interface SemanticIndexCompatibilityEvaluationInput {
	readonly semanticReadiness: SemanticIndexReadiness;
	readonly semanticSnapshot: SemanticIndexSnapshot | null;
	readonly currentSources: readonly IndexSourceFingerprint[];
	readonly lexicalReadinessState: RetrievalReadinessState;
	readonly checkedAt: Date;
	readonly activeEmbeddingModelFamily?: string | EmbeddingModelFamily | null;
	readonly activeDimensions?: number | null;
	readonly reportId?: string | null;
	readonly validationOutput?: readonly string[];
}

interface SourceFingerprintDiff {
	readonly indexedSources: readonly IndexSourceFingerprint[];
	readonly currentSources: readonly IndexSourceFingerprint[];
	readonly staleSourcePaths: readonly NormalizedVaultPath[];
	readonly missingSourcePaths: readonly NormalizedVaultPath[];
	readonly extraSourcePaths: readonly NormalizedVaultPath[];
}

interface CompatibilityIssue {
	readonly state: SemanticIndexCompatibilityState;
	readonly code: SemanticIndexCompatibilityCode;
	readonly message: string;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const normalizeFamily = (family: string | EmbeddingModelFamily | null | undefined): EmbeddingModelFamily | null => {
	if (typeof family !== "string" || family.trim().length === 0) {
		return null;
	}

	return makeEmbeddingModelFamily(family.trim());
};

const fingerprintMap = (
	sources: readonly IndexSourceFingerprint[],
): ReadonlyMap<NormalizedVaultPath, IndexSourceFingerprint> => new Map(sources.map((source) => [source.path, source]));

export const compareSemanticSourceFingerprints = (
	left: IndexSourceFingerprint,
	right: IndexSourceFingerprint,
): number => compareVaultPaths(left.path, right.path);

export const sortSemanticSourceFingerprints = (
	sources: readonly IndexSourceFingerprint[],
): readonly IndexSourceFingerprint[] => sortSourceFingerprints(sources);

export const diffSemanticSourceFingerprints = (
	indexedSources: readonly IndexSourceFingerprint[],
	currentSources: readonly IndexSourceFingerprint[],
): SourceFingerprintDiff => {
	const sortedIndexed = sortSemanticSourceFingerprints(indexedSources);
	const sortedCurrent = sortSemanticSourceFingerprints(currentSources);
	const indexedByPath = fingerprintMap(sortedIndexed);
	const currentByPath = fingerprintMap(sortedCurrent);
	const missingSourcePaths = sortedCurrent
		.filter((source) => !indexedByPath.has(source.path))
		.map((source) => source.path);
	const extraSourcePaths = sortedIndexed
		.filter((source) => !currentByPath.has(source.path))
		.map((source) => source.path);
	const staleSourcePaths = sortedCurrent
		.filter((source) => indexedByPath.get(source.path)?.contentFingerprint !== source.contentFingerprint)
		.filter((source) => indexedByPath.has(source.path))
		.map((source) => source.path);

	return {
		indexedSources: sortedIndexed,
		currentSources: sortedCurrent,
		staleSourcePaths,
		missingSourcePaths,
		extraSourcePaths,
	};
};

export const summarizeSemanticSourcePathCounts = (diff: SourceFingerprintDiff): SemanticIndexSourcePathCounts => ({
	indexed: diff.indexedSources.length,
	current: diff.currentSources.length,
	stale: diff.staleSourcePaths.length,
	missing: diff.missingSourcePaths.length,
	extra: diff.extraSourcePaths.length,
});

const stateForSnapshotStatus = (status: IndexJobStatus): CompatibilityIssue | null => {
	switch (status) {
		case "ready":
			return null;
		case "canceled":
			return {
				state: "canceled",
				code: "provider-canceled",
				message: "Semantic index build was canceled before vectors became eligible.",
			};
		case "idle":
		case "building":
		case "stale":
		case "error":
			return {
				state: status === "stale" ? "stale" : "missing",
				code: "index-not-ready",
				message: `Semantic index snapshot status is ${status}.`,
			};
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled semantic index snapshot status: ${String(exhaustive)}`);
		}
	}
};

const issueForReadiness = (readiness: SemanticIndexReadiness): CompatibilityIssue | null => {
	if (readiness.readinessState === "ready") {
		return null;
	}

	if (readiness.readinessState === "disabled") {
		return {
			state: "disabled",
			code: "semantic-disabled",
			message: readiness.message,
		};
	}

	if (readiness.readinessState === "canceled" || readiness.state === "canceled") {
		return {
			state: "canceled",
			code: "provider-canceled",
			message: readiness.message,
		};
	}

	if (readiness.state === "offline") {
		return {
			state: "offline",
			code: "provider-offline",
			message: readiness.message,
		};
	}

	return {
		state: "provider-blocked",
		code: readiness.readinessState === "missing" ? "provider-not-ready" : "provider-blocked",
		message: readiness.message,
	};
};

const fallbackModeFor = (
	isSemanticEligible: boolean,
	lexicalReadinessState: RetrievalReadinessState,
): SemanticRetrievalFallbackMode => {
	if (isSemanticEligible) {
		return "semantic";
	}

	return lexicalReadinessState === "ready" || lexicalReadinessState === "stale" ? "lexical" : "unavailable";
};

const guidanceActionFor = (
	code: SemanticIndexCompatibilityCode,
	fallbackMode: SemanticRetrievalFallbackMode,
): SemanticReindexGuidance["action"] => {
	switch (code) {
		case "compatible":
			return "none";
		case "semantic-disabled":
			return "review-provider-setup";
		case "provider-blocked":
		case "provider-canceled":
		case "provider-offline":
		case "provider-not-ready":
		case "missing-embedding-family":
			return "review-provider-setup";
		case "stale-source-fingerprints":
			return fallbackMode === "unavailable" ? "refresh-lexical-index" : "rebuild-semantic-index";
		case "missing-index":
		case "index-not-ready":
		case "missing-vectors":
		case "family-mismatch":
		case "dimension-mismatch":
			return "rebuild-semantic-index";
		default: {
			const exhaustive: never = code;
			throw new Error(`Unhandled semantic compatibility code: ${String(exhaustive)}`);
		}
	}
};

export const createSemanticReindexGuidance = (input: {
	readonly code: SemanticIndexCompatibilityCode;
	readonly message: string;
	readonly fallbackMode: SemanticRetrievalFallbackMode;
	readonly semanticReadiness: SemanticIndexReadiness;
	readonly semanticSnapshot: SemanticIndexSnapshot | null;
	readonly embeddingModelFamily: EmbeddingModelFamily | null;
	readonly dimensions: number | null;
	readonly sourcePathCount: number;
	readonly reportId: string | null;
	readonly validationOutput: readonly string[];
}): SemanticReindexGuidance => ({
	action: guidanceActionFor(input.code, input.fallbackMode),
	message: input.message,
	providerId: input.semanticReadiness.providerId,
	modelId: input.semanticReadiness.modelId,
	embeddingModelFamily: input.embeddingModelFamily,
	dimensions: input.dimensions,
	indexId: input.semanticSnapshot?.config.indexId ?? null,
	sourcePathCount: input.sourcePathCount,
	readinessCode: input.semanticReadiness.diagnosticCode,
	reportId: input.reportId,
	validationOutput: input.validationOutput,
});

export const createSemanticCompatibilityRecovery = (input: {
	readonly fallbackMode: SemanticRetrievalFallbackMode;
	readonly semanticReadiness: SemanticIndexReadiness;
	readonly semanticSnapshot: SemanticIndexSnapshot | null;
	readonly sourcePathCount: number;
	readonly reportId: string | null;
	readonly validationOutput: readonly string[];
}): SemanticIndexCompatibilityRecovery => ({
	commandId: SEMANTIC_INDEX_COMPATIBILITY_COMMAND_ID,
	providerId: input.semanticReadiness.providerId,
	modelId: input.semanticReadiness.modelId,
	indexId: input.semanticSnapshot?.config.indexId ?? null,
	reportId: input.reportId,
	readinessCode: input.semanticReadiness.diagnosticCode,
	sourcePathCount: input.sourcePathCount,
	validationOutput: input.validationOutput,
	fallbackMode: input.fallbackMode,
});

const compatibilityFromIssue = (input: {
	readonly issue: CompatibilityIssue;
	readonly semanticReadiness: SemanticIndexReadiness;
	readonly semanticSnapshot: SemanticIndexSnapshot | null;
	readonly diff: SourceFingerprintDiff;
	readonly checkedAt: Date;
	readonly lexicalReadinessState: RetrievalReadinessState;
	readonly embeddingModelFamily: EmbeddingModelFamily | null;
	readonly dimensions: number | null;
	readonly reportId: string | null;
	readonly validationOutput: readonly string[];
}): SemanticIndexCompatibility => {
	const fallbackMode = fallbackModeFor(false, input.lexicalReadinessState);
	const sourcePathCounts = summarizeSemanticSourcePathCounts(input.diff);
	const guidance = createSemanticReindexGuidance({
		code: input.issue.code,
		message: input.issue.message,
		fallbackMode,
		semanticReadiness: input.semanticReadiness,
		semanticSnapshot: input.semanticSnapshot,
		embeddingModelFamily: input.embeddingModelFamily,
		dimensions: input.dimensions,
		sourcePathCount: sourcePathCounts.current,
		reportId: input.reportId,
		validationOutput: input.validationOutput,
	});

	return {
		state: input.issue.state,
		code: input.issue.code,
		semanticSearchEligible: false,
		fallbackMode,
		checkedAt: toIsoTimestamp(input.checkedAt),
		indexId: input.semanticSnapshot?.config.indexId ?? null,
		providerId: input.semanticReadiness.providerId,
		modelId: input.semanticReadiness.modelId,
		embeddingModelFamily: input.embeddingModelFamily,
		dimensions: input.dimensions,
		snapshotBuiltAt: input.semanticSnapshot?.builtAt ?? null,
		sourcePathCounts,
		staleSourcePaths: input.diff.staleSourcePaths,
		missingSourcePaths: input.diff.missingSourcePaths,
		extraSourcePaths: input.diff.extraSourcePaths,
		message: input.issue.message,
		guidance,
		recovery: createSemanticCompatibilityRecovery({
			fallbackMode,
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot: input.semanticSnapshot,
			sourcePathCount: sourcePathCounts.current,
			reportId: input.reportId,
			validationOutput: input.validationOutput,
		}),
	};
};

export const evaluateSemanticIndexCompatibility = (
	input: SemanticIndexCompatibilityEvaluationInput,
): SemanticIndexCompatibility => {
	const semanticSnapshot = input.semanticSnapshot;
	const currentSources = sortSemanticSourceFingerprints(input.currentSources);
	const snapshotSources = semanticSnapshot?.sources ?? [];
	const diff = diffSemanticSourceFingerprints(snapshotSources, currentSources);
	const activeEmbeddingModelFamily = normalizeFamily(
		input.activeEmbeddingModelFamily ?? input.semanticReadiness.embeddingModelFamily,
	);
	const dimensions =
		input.activeDimensions ?? input.semanticReadiness.dimensions ?? semanticSnapshot?.config.dimensions ?? null;
	const reportId = input.reportId ?? input.semanticReadiness.recovery?.reportId ?? null;
	const validationOutput = [
		...(input.validationOutput ?? []),
		...(input.semanticReadiness.recovery?.validationOutput ?? []),
	];
	const readinessIssue = issueForReadiness(input.semanticReadiness);
	if (readinessIssue !== null) {
		return compatibilityFromIssue({
			issue: readinessIssue,
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (semanticSnapshot === null) {
		return compatibilityFromIssue({
			issue: {
				state: "missing",
				code: "missing-index",
				message: "Semantic index snapshot is missing; lexical fallback remains available when ready.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	const statusIssue = stateForSnapshotStatus(semanticSnapshot.status);
	if (statusIssue !== null) {
		return compatibilityFromIssue({
			issue: statusIssue,
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (activeEmbeddingModelFamily === null) {
		return compatibilityFromIssue({
			issue: {
				state: "incompatible",
				code: "missing-embedding-family",
				message: "Active embedding model family is missing; semantic vectors cannot be trusted.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: null,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (semanticSnapshot.config.embeddingModelFamily !== activeEmbeddingModelFamily) {
		return compatibilityFromIssue({
			issue: {
				state: "incompatible",
				code: "family-mismatch",
				message: "Semantic index embedding family does not match the active embedding provider.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (dimensions !== null && semanticSnapshot.config.dimensions !== dimensions) {
		return compatibilityFromIssue({
			issue: {
				state: "incompatible",
				code: "dimension-mismatch",
				message: "Semantic index dimensions do not match the active embedding provider.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	const incompatibleEntry = semanticSnapshot.entries.find(
		(entry) =>
			entry.embeddingModelFamily !== semanticSnapshot.config.embeddingModelFamily ||
			entry.dimensions !== semanticSnapshot.config.dimensions ||
			entry.vector.length !== semanticSnapshot.config.dimensions,
	);
	if (incompatibleEntry !== undefined) {
		return compatibilityFromIssue({
			issue: {
				state: "incompatible",
				code:
					incompatibleEntry.embeddingModelFamily !== semanticSnapshot.config.embeddingModelFamily
						? "family-mismatch"
						: "dimension-mismatch",
				message: "Semantic index vector entries do not match snapshot metadata.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (semanticSnapshot.entries.length === 0 && currentSources.length > 0) {
		return compatibilityFromIssue({
			issue: {
				state: "missing",
				code: "missing-vectors",
				message: "Semantic index snapshot has no vectors for current vault sources.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	if (diff.staleSourcePaths.length > 0 || diff.missingSourcePaths.length > 0 || diff.extraSourcePaths.length > 0) {
		return compatibilityFromIssue({
			issue: {
				state: "stale",
				code: "stale-source-fingerprints",
				message: "Semantic index source fingerprints do not match current vault sources.",
			},
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			diff,
			checkedAt: input.checkedAt,
			lexicalReadinessState: input.lexicalReadinessState,
			embeddingModelFamily: activeEmbeddingModelFamily,
			dimensions,
			reportId,
			validationOutput,
		});
	}

	const fallbackMode = fallbackModeFor(true, input.lexicalReadinessState);
	const sourcePathCounts = summarizeSemanticSourcePathCounts(diff);
	const message = "Semantic index is compatible with the active embedding provider and current sources.";
	const guidance = createSemanticReindexGuidance({
		code: "compatible",
		message,
		fallbackMode,
		semanticReadiness: input.semanticReadiness,
		semanticSnapshot,
		embeddingModelFamily: activeEmbeddingModelFamily,
		dimensions,
		sourcePathCount: sourcePathCounts.current,
		reportId,
		validationOutput,
	});

	return {
		state: "ready",
		code: "compatible",
		semanticSearchEligible: true,
		fallbackMode,
		checkedAt: toIsoTimestamp(input.checkedAt),
		indexId: semanticSnapshot.config.indexId,
		providerId: input.semanticReadiness.providerId,
		modelId: input.semanticReadiness.modelId,
		embeddingModelFamily: activeEmbeddingModelFamily,
		dimensions,
		snapshotBuiltAt: semanticSnapshot.builtAt ?? null,
		sourcePathCounts,
		staleSourcePaths: [],
		missingSourcePaths: [],
		extraSourcePaths: [],
		message,
		guidance,
		recovery: createSemanticCompatibilityRecovery({
			fallbackMode,
			semanticReadiness: input.semanticReadiness,
			semanticSnapshot,
			sourcePathCount: sourcePathCounts.current,
			reportId,
			validationOutput,
		}),
	};
};
