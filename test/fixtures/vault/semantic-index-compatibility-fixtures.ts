import { LOCAL_FIXTURE_PROVIDER_ID, TRUSTED_CLOUD_FIXTURE_PROVIDER_ID } from "../../../src/providers";
import type { SemanticIndexReadiness } from "../../../src/types/indexing-runtime";
import { makeProviderModelId } from "../../../src/types/providers";
import type {
	IndexSourceFingerprint,
	SemanticIndexConfig,
	SemanticIndexSnapshot,
	SemanticVectorEntry,
} from "../../../src/types/retrieval";
import { makeEmbeddingModelFamily } from "../../../src/types/retrieval";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";

export const SEMANTIC_COMPATIBILITY_FIXED_ISO = "2026-05-13T00:00:00.000Z";
export const SEMANTIC_COMPATIBILITY_FIXED_DATE = new Date(SEMANTIC_COMPATIBILITY_FIXED_ISO);
export const SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP = makeIsoTimestamp(SEMANTIC_COMPATIBILITY_FIXED_ISO);

export const SEMANTIC_COMPATIBILITY_FIXTURE_MESSAGE =
	"Semantic compatibility fixtures are synthetic metadata only and contain no note bodies, prompt bodies, provider secrets, or private absolute paths.";

export const SEMANTIC_COMPATIBILITY_INDEX_ID = "semantic-compatibility-fixture-index";
export const SEMANTIC_COMPATIBILITY_REPORT_ID = "semantic-compatibility-fixture-report";
export const SEMANTIC_COMPATIBILITY_MODEL_ID = makeProviderModelId("local-embedding-fixture");
export const SEMANTIC_COMPATIBILITY_CLOUD_MODEL_ID = makeProviderModelId("trusted-cloud-embedding-fixture");
export const SEMANTIC_COMPATIBILITY_FAMILY = makeEmbeddingModelFamily("local-fixture-embeddings");
export const SEMANTIC_COMPATIBILITY_ALTERNATE_FAMILY = makeEmbeddingModelFamily("alternate-fixture-embeddings");
export const SEMANTIC_COMPATIBILITY_DIMENSIONS = 4;

export const SEMANTIC_COMPATIBILITY_SOURCE_A = makeNormalizedVaultPath("fixtures/demo-vault/semantic-source-a.md");
export const SEMANTIC_COMPATIBILITY_SOURCE_B = makeNormalizedVaultPath("fixtures/demo-vault/semantic-source-b.md");
export const SEMANTIC_COMPATIBILITY_SOURCE_C = makeNormalizedVaultPath("fixtures/demo-vault/semantic-source-c.md");

export const semanticCompatibilitySources = (): readonly IndexSourceFingerprint[] => [
	{
		path: SEMANTIC_COMPATIBILITY_SOURCE_A,
		contentFingerprint: "semantic-fixture-source-a-v1",
	},
	{
		path: SEMANTIC_COMPATIBILITY_SOURCE_B,
		contentFingerprint: "semantic-fixture-source-b-v1",
	},
];

export const staleSemanticCompatibilitySources = (): readonly IndexSourceFingerprint[] => [
	{
		path: SEMANTIC_COMPATIBILITY_SOURCE_A,
		contentFingerprint: "semantic-fixture-source-a-v2",
	},
	{
		path: SEMANTIC_COMPATIBILITY_SOURCE_B,
		contentFingerprint: "semantic-fixture-source-b-v1",
	},
];

export const partialSemanticCompatibilitySources = (): readonly IndexSourceFingerprint[] => [
	...semanticCompatibilitySources(),
	{
		path: SEMANTIC_COMPATIBILITY_SOURCE_C,
		contentFingerprint: "semantic-fixture-source-c-v1",
	},
];

export const semanticCompatibilityConfig = (overrides: Partial<SemanticIndexConfig> = {}): SemanticIndexConfig => ({
	indexId: SEMANTIC_COMPATIBILITY_INDEX_ID,
	embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
	dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
	distanceMetric: "cosine",
	...overrides,
});

export const semanticCompatibilityEntry = (
	index: number,
	overrides: Partial<SemanticVectorEntry> = {},
): SemanticVectorEntry => {
	const source = semanticCompatibilitySources()[index] ?? semanticCompatibilitySources()[0];
	if (source === undefined) {
		throw new Error("Expected synthetic semantic compatibility source.");
	}

	return {
		id: `semantic-fixture-vector-${index + 1}`,
		path: source.path,
		chunkId: `semantic-fixture-chunk-${index + 1}`,
		embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
		dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		vector: [0.1 + index, 0.2 + index, 0.3 + index, 0.4 + index],
		sourcePaths: [source.path],
		contentFingerprint: source.contentFingerprint,
		...overrides,
	};
};

export const semanticCompatibilitySnapshot = (
	overrides: Partial<SemanticIndexSnapshot> = {},
): SemanticIndexSnapshot => ({
	config: semanticCompatibilityConfig(),
	status: "ready",
	builtAt: SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP,
	sources: semanticCompatibilitySources(),
	entries: [semanticCompatibilityEntry(0), semanticCompatibilityEntry(1)],
	...overrides,
});

export const semanticReadinessFixture = (overrides: Partial<SemanticIndexReadiness> = {}): SemanticIndexReadiness => ({
	state: "ready",
	readinessState: "ready",
	checkedAt: SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP,
	contentSensitivity: "private-vault",
	providerId: LOCAL_FIXTURE_PROVIDER_ID,
	modelId: SEMANTIC_COMPATIBILITY_MODEL_ID,
	sourcePathCount: semanticCompatibilitySources().length,
	message: "Semantic indexing preflight is ready for the selected embedding provider.",
	diagnosticCode: null,
	recovery: {
		commandId: "voidbrain.semantic-index-readiness",
		providerId: LOCAL_FIXTURE_PROVIDER_ID,
		modelId: SEMANTIC_COMPATIBILITY_MODEL_ID,
		sourcePathCount: semanticCompatibilitySources().length,
		readinessCode: null,
		reportId: SEMANTIC_COMPATIBILITY_REPORT_ID,
		validationOutput: ["semantic provider preflight ready"],
		retryGuidance: "Recheck provider setup and rebuild the semantic index if compatibility changes.",
		updatedAt: SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP,
	},
	...overrides,
});

export const providerBlockedSemanticReadinessFixture = (): SemanticIndexReadiness =>
	semanticReadinessFixture({
		state: "privacy-denied",
		readinessState: "blocked",
		providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
		modelId: SEMANTIC_COMPATIBILITY_CLOUD_MODEL_ID,
		message: "Cloud provider workflows are disabled.",
		diagnosticCode: "privacy-denied",
		recovery: {
			commandId: "voidbrain.semantic-index-readiness",
			providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			modelId: SEMANTIC_COMPATIBILITY_CLOUD_MODEL_ID,
			sourcePathCount: semanticCompatibilitySources().length,
			readinessCode: "privacy-denied",
			reportId: SEMANTIC_COMPATIBILITY_REPORT_ID,
			validationOutput: ["privacy-denied"],
			retryGuidance: "Review provider disclosure settings before rebuilding semantic vectors.",
			updatedAt: SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP,
		},
	});

export const canceledSemanticReadinessFixture = (): SemanticIndexReadiness =>
	semanticReadinessFixture({
		state: "ready",
		readinessState: "canceled",
		message: "Semantic embedding refresh was canceled.",
		diagnosticCode: "embedding.provider-canceled",
		recovery: {
			commandId: "voidbrain.semantic-index-readiness",
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: SEMANTIC_COMPATIBILITY_MODEL_ID,
			sourcePathCount: semanticCompatibilitySources().length,
			readinessCode: "embedding.provider-canceled",
			reportId: SEMANTIC_COMPATIBILITY_REPORT_ID,
			validationOutput: ["embedding.provider-canceled"],
			retryGuidance: "Retry semantic indexing after the canceled operation is no longer in flight.",
			updatedAt: SEMANTIC_COMPATIBILITY_FIXED_TIMESTAMP,
		},
	});

export const semanticFallbackProbeQuery = () => ({
	query: "semantic compatibility fixture",
	limit: 2,
});
