import { preflightProviderInvocation } from "../providers/privacy-guard";
import type { ProviderDefinition, ProviderPrivacyPolicy } from "../types/providers";
import {
	type EmbeddingModelFamily,
	type SemanticCompatibilityDecision,
	type SemanticEmbeddingInvocationDecision,
	type SemanticEmbeddingInvocationInput,
	type SemanticIndexConfig,
	type SemanticIndexSnapshot,
	type SemanticProviderPreflightRequest,
	type SemanticProviderPreflightResult,
	type SemanticVectorEntry,
	makeEmbeddingModelFamily,
} from "../types/retrieval";
import type { IsoTimestamp } from "../types/vault";
import { sortSemanticSourceFingerprints } from "./semantic-index-compatibility";

export interface SemanticCompatibilityInput {
	readonly expectedFamily: EmbeddingModelFamily;
	readonly actualFamily?: string | EmbeddingModelFamily | undefined;
	readonly expectedDimensions?: number | undefined;
	readonly actualDimensions?: number | undefined;
}

export interface SemanticEmbeddingPreparationAllowed {
	readonly ok: true;
	readonly preflight: SemanticProviderPreflightResult;
	readonly embeddingModelFamily: EmbeddingModelFamily;
}

export interface SemanticEmbeddingPreparationDenied {
	readonly ok: false;
	readonly message: string;
	readonly preflight: SemanticProviderPreflightResult;
	readonly compatibility?: SemanticCompatibilityDecision;
}

export type SemanticEmbeddingPreparationDecision =
	| SemanticEmbeddingPreparationAllowed
	| SemanticEmbeddingPreparationDenied;

export interface SemanticIndexAdapter {
	readonly config: SemanticIndexConfig;
	prepareEmbedding: (
		providers: readonly ProviderDefinition[],
		policy: ProviderPrivacyPolicy,
		request: SemanticProviderPreflightRequest,
	) => SemanticEmbeddingPreparationDecision;
	prepareEmbeddingInvocation: (
		providers: readonly ProviderDefinition[],
		policy: ProviderPrivacyPolicy,
		request: SemanticProviderPreflightRequest,
		invocation: SemanticEmbeddingInvocationInput,
	) => SemanticEmbeddingInvocationDecision;
	validateEntry: (entry: SemanticVectorEntry) => SemanticCompatibilityDecision;
	createSnapshot: (
		entries: readonly SemanticVectorEntry[],
		builtAt?: IsoTimestamp,
	) => SemanticIndexSnapshot | SemanticCompatibilityDecision;
}

const normalizeFamily = (family: string | EmbeddingModelFamily | undefined): EmbeddingModelFamily | undefined => {
	if (typeof family !== "string" || family.trim().length === 0) {
		return undefined;
	}

	return makeEmbeddingModelFamily(family.trim());
};

export const embeddingFamiliesMatch = (
	expectedFamily: EmbeddingModelFamily,
	actualFamily: string | EmbeddingModelFamily | undefined,
): boolean => normalizeFamily(actualFamily) === expectedFamily;

export const checkSemanticCompatibility = (input: SemanticCompatibilityInput): SemanticCompatibilityDecision => {
	const actualFamily = normalizeFamily(input.actualFamily);
	if (actualFamily === undefined) {
		return {
			ok: false,
			code: "missing-embedding-family",
			message: "Semantic index entries must declare an embedding model family.",
			field: "embeddingModelFamily",
		};
	}

	if (actualFamily !== input.expectedFamily) {
		return {
			ok: false,
			code: "family-mismatch",
			message: `Expected embedding family ${input.expectedFamily}, got ${actualFamily}.`,
			field: "embeddingModelFamily",
		};
	}

	if (
		input.expectedDimensions !== undefined &&
		input.actualDimensions !== undefined &&
		input.expectedDimensions !== input.actualDimensions
	) {
		return {
			ok: false,
			code: "dimension-mismatch",
			message: `Expected ${input.expectedDimensions} dimensions, got ${input.actualDimensions}.`,
			field: "dimensions",
		};
	}

	return {
		ok: true,
		code: "compatible",
		embeddingModelFamily: actualFamily,
		dimensions: input.actualDimensions ?? input.expectedDimensions ?? 0,
	};
};

export const checkSemanticEntryCompatibility = (
	config: SemanticIndexConfig,
	entry: SemanticCompatibilityInput,
): SemanticCompatibilityDecision =>
	checkSemanticCompatibility({
		expectedFamily: config.embeddingModelFamily,
		actualFamily: entry.actualFamily,
		expectedDimensions: config.dimensions,
		actualDimensions: entry.actualDimensions,
	});

export const checkSemanticVectorEntryCompatibility = (
	config: SemanticIndexConfig,
	entry: SemanticVectorEntry,
): SemanticCompatibilityDecision => {
	const compatibility = checkSemanticEntryCompatibility(config, {
		expectedFamily: config.embeddingModelFamily,
		actualFamily: entry.embeddingModelFamily,
		expectedDimensions: config.dimensions,
		actualDimensions: entry.dimensions,
	});
	if (!compatibility.ok) {
		return compatibility;
	}

	if (entry.vector.length !== config.dimensions) {
		return {
			ok: false,
			code: "dimension-mismatch",
			message: `Expected vector length ${config.dimensions}, got ${entry.vector.length}.`,
			field: "vector",
		};
	}

	return compatibility;
};

export const preflightSemanticIndexProvider = (
	providers: readonly ProviderDefinition[],
	policy: ProviderPrivacyPolicy,
	request: SemanticProviderPreflightRequest,
): SemanticProviderPreflightResult => {
	const preflight = preflightProviderInvocation(providers, policy, {
		providerId: request.providerId,
		preferredModelId: request.preferredModelId,
		requiredCapability: "embeddings",
		requiredRole: "embedding",
		contentSensitivity: request.contentSensitivity,
		sourcePaths: request.sourcePaths,
		workflowId: request.workflowId,
		userFacingPurpose: request.userFacingPurpose,
	});

	if (!preflight.allowed) {
		return { preflight };
	}

	const embeddingModelFamily = normalizeFamily(preflight.model.embeddingFamily);
	return {
		preflight,
		...(embeddingModelFamily === undefined ? {} : { embeddingModelFamily }),
	};
};

export const prepareSemanticEmbeddingInvocation = (
	config: SemanticIndexConfig,
	providers: readonly ProviderDefinition[],
	policy: ProviderPrivacyPolicy,
	request: SemanticProviderPreflightRequest,
	invocation: SemanticEmbeddingInvocationInput,
): SemanticEmbeddingInvocationDecision => {
	const preflight = preflightSemanticIndexProvider(providers, policy, request);
	if (!preflight.preflight.allowed) {
		return {
			ok: false,
			message: preflight.preflight.userMessage,
			preflight,
		};
	}

	const compatibility = checkSemanticCompatibility({
		expectedFamily: config.embeddingModelFamily,
		actualFamily: preflight.embeddingModelFamily,
		expectedDimensions: config.dimensions,
		actualDimensions: config.dimensions,
	});

	if (!compatibility.ok) {
		return {
			ok: false,
			message: compatibility.message,
			preflight,
			compatibility,
		};
	}

	return {
		ok: true,
		preflight,
		request: {
			commandId: request.workflowId,
			providerId: preflight.preflight.provider.id,
			modelId: preflight.preflight.model.id,
			contentSensitivity: request.contentSensitivity,
			chunks: invocation.chunks,
			sourcePaths: request.sourcePaths,
			timeoutMs: invocation.timeoutMs,
			embeddingModelFamily: compatibility.embeddingModelFamily,
			expectedDimensions: compatibility.dimensions,
			...(invocation.invocationKey === undefined ? {} : { invocationKey: invocation.invocationKey }),
			recovery: {
				commandId: request.workflowId,
				providerId: preflight.preflight.provider.id,
				modelId: preflight.preflight.model.id,
				sourcePathCount: request.sourcePaths.length,
				readinessCode: "ready",
				validationOutput: ["semantic embedding provider preflight allowed"],
				...invocation.recovery,
			},
		},
	};
};

const createSemanticSnapshot = (
	config: SemanticIndexConfig,
	entries: readonly SemanticVectorEntry[],
	builtAt?: IsoTimestamp,
): SemanticIndexSnapshot => ({
	config,
	status: "ready",
	...(builtAt === undefined ? {} : { builtAt }),
	sources: sortSemanticSourceFingerprints(
		entries.map((entry) => ({
			path: entry.path,
			contentFingerprint: entry.contentFingerprint,
		})),
	),
	entries: [...entries].sort((left, right) => left.id.localeCompare(right.id, "en", { sensitivity: "base" })),
});

export const createSemanticIndexAdapter = (config: SemanticIndexConfig): SemanticIndexAdapter => ({
	config,
	prepareEmbedding: (providers, policy, request) => {
		const preflight = preflightSemanticIndexProvider(providers, policy, request);
		if (!preflight.preflight.allowed) {
			return {
				ok: false,
				message: preflight.preflight.userMessage,
				preflight,
			};
		}

		const compatibility = checkSemanticCompatibility({
			expectedFamily: config.embeddingModelFamily,
			actualFamily: preflight.embeddingModelFamily,
			expectedDimensions: config.dimensions,
			actualDimensions: config.dimensions,
		});

		if (!compatibility.ok) {
			return {
				ok: false,
				message: compatibility.message,
				preflight,
				compatibility,
			};
		}

		return {
			ok: true,
			preflight,
			embeddingModelFamily: compatibility.embeddingModelFamily,
		};
	},
	prepareEmbeddingInvocation: (providers, policy, request, invocation) =>
		prepareSemanticEmbeddingInvocation(config, providers, policy, request, invocation),
	validateEntry: (entry) => checkSemanticVectorEntryCompatibility(config, entry),
	createSnapshot: (entries, builtAt) => {
		for (const entry of entries) {
			const compatibility = checkSemanticVectorEntryCompatibility(config, entry);
			if (!compatibility.ok) {
				return compatibility;
			}
		}

		return createSemanticSnapshot(config, entries, builtAt);
	},
});
