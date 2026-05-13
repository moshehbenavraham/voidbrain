import type {
	ProviderEmbeddingFailureCode,
	ProviderEmbeddingInvocationFailure,
	ProviderEmbeddingInvocationResult,
	ProviderEmbeddingInvoker,
	ProviderEmbeddingRequest,
	ProviderEmbeddingResponse,
	ProviderEmbeddingTransport,
	ProviderInvocationMetadata,
	ProviderInvocationRecoveryMetadata,
} from "../types/provider-invocation";
import type { RedactedDiagnosticObject } from "../types/providers";
import {
	createProviderInvocationBoundary,
	createProviderInvocationKey,
	normalizeProviderInvocationDiagnostic,
	providerInvocationRecoveryDiagnostic,
} from "./provider-invocation";

export interface ProviderEmbeddingInvokerOptions {
	readonly transport?: ProviderEmbeddingTransport;
	readonly maxAttempts?: number;
	readonly retryBackoffMs?: number;
	readonly now?: () => Date;
	readonly sleep?: (durationMs: number) => Promise<void>;
}

const defaultMaxAttempts = 2;
const defaultRetryBackoffMs = 100;

const defaultTransport: ProviderEmbeddingTransport = async ({ request }) => ({
	ok: false,
	code: "embedding.provider-unavailable",
	message: "Provider embedding invocation is not configured.",
	diagnostic: {
		providerId: request.providerId,
		modelId: request.modelId,
		commandId: request.commandId,
		reason: "missing-runtime-adapter",
	},
	retryable: false,
});

const embeddingRecoveryForRequest = (request: ProviderEmbeddingRequest): ProviderInvocationRecoveryMetadata => ({
	commandId: request.commandId,
	providerId: request.providerId,
	modelId: request.modelId,
	sourcePathCount: request.sourcePaths.length,
	validationOutput: [],
	...request.recovery,
});

const embeddingMetadataForRequest = (request: ProviderEmbeddingRequest): ProviderInvocationMetadata => {
	const recovery = embeddingRecoveryForRequest(request);

	return {
		commandId: request.commandId,
		providerId: request.providerId,
		modelId: request.modelId,
		role: "embedding",
		requiredCapability: "embeddings",
		contentSensitivity: request.contentSensitivity,
		invocationKey:
			request.invocationKey ??
			createProviderInvocationKey([
				"embedding",
				request.commandId,
				request.providerId,
				request.modelId,
				request.chunks.map((chunk) => chunk.id).join(","),
			]),
		sourcePathCount: request.sourcePaths.length,
		recovery,
	};
};

const invalidEmbeddingResponse = (
	request: ProviderEmbeddingRequest,
	response: ProviderEmbeddingResponse,
	message: string,
	diagnostic: RedactedDiagnosticObject,
): ProviderEmbeddingInvocationFailure => ({
	ok: false,
	code: "embedding.invalid-response",
	message,
	retryable: false,
	attempts: [],
	diagnostic: normalizeProviderInvocationDiagnostic(
		diagnostic,
		providerInvocationRecoveryDiagnostic(embeddingMetadataForRequest(request)),
	),
});

const validateEmbeddingResponse = (
	request: ProviderEmbeddingRequest,
	response: ProviderEmbeddingResponse,
): ProviderEmbeddingInvocationFailure | null => {
	const metadataDiagnostic = providerInvocationRecoveryDiagnostic(embeddingMetadataForRequest(request));
	if (response.vectors.length !== request.chunks.length) {
		return invalidEmbeddingResponse(request, response, "Provider returned the wrong number of embedding vectors.", {
			...metadataDiagnostic,
			reason: "vector-count-mismatch",
			expectedVectorCount: request.chunks.length,
			actualVectorCount: response.vectors.length,
		});
	}

	const expectedChunkIds = new Set(request.chunks.map((chunk) => chunk.id));
	const seenChunkIds = new Set<string>();
	for (const vector of response.vectors) {
		if (!expectedChunkIds.has(vector.chunkId) || seenChunkIds.has(vector.chunkId)) {
			return invalidEmbeddingResponse(request, response, "Provider returned an unexpected embedding chunk ID.", {
				...metadataDiagnostic,
				reason: "chunk-id-mismatch",
			});
		}
		seenChunkIds.add(vector.chunkId);

		if (vector.dimensions <= 0 || vector.vector.length !== vector.dimensions) {
			return invalidEmbeddingResponse(request, response, "Provider returned an invalid embedding vector shape.", {
				...metadataDiagnostic,
				reason: "invalid-vector-shape",
				dimensions: vector.dimensions,
				vectorLength: vector.vector.length,
			});
		}

		if (request.expectedDimensions !== undefined && vector.dimensions !== request.expectedDimensions) {
			return invalidEmbeddingResponse(
				request,
				response,
				"Provider returned embedding dimensions that do not match the request.",
				{
					...metadataDiagnostic,
					reason: "dimension-mismatch",
					expectedDimensions: request.expectedDimensions,
					actualDimensions: vector.dimensions,
				},
			);
		}
	}

	return null;
};

export const createProviderEmbeddingInvoker = (
	options: ProviderEmbeddingInvokerOptions = {},
): ProviderEmbeddingInvoker => {
	const transport = options.transport ?? defaultTransport;
	const maxAttempts = Math.max(1, options.maxAttempts ?? defaultMaxAttempts);
	const retryBackoffMs = Math.max(0, options.retryBackoffMs ?? defaultRetryBackoffMs);
	const boundary = createProviderInvocationBoundary<
		ProviderEmbeddingRequest,
		ProviderEmbeddingResponse,
		ProviderEmbeddingFailureCode
	>({
		transport: async ({ payload, attempt, signal }) => {
			const result = await transport({
				request: payload,
				attempt,
				signal,
			});

			if (result.ok) {
				return {
					ok: true,
					value: result.response,
					diagnostic: result.diagnostic ?? result.response.diagnostic,
				};
			}

			return {
				ok: false,
				code: result.code,
				message: result.message,
				diagnostic: result.diagnostic,
				...(result.retryable === undefined ? {} : { retryable: result.retryable }),
			};
		},
		defaultFailureCode: "embedding.provider-failed",
		timeoutFailureCode: "embedding.provider-timeout",
		canceledFailureCode: "embedding.provider-canceled",
		duplicateFailureCode: "embedding.duplicate-action",
		defaultFailureMessage: "Provider embedding invocation failed.",
		timeoutMessage: "Provider embedding invocation timed out.",
		canceledMessage: "Provider embedding invocation was canceled.",
		duplicateMessage: "Provider embedding invocation is already in flight.",
		...(options.now === undefined ? {} : { now: options.now }),
		...(options.sleep === undefined ? {} : { sleep: options.sleep }),
	});

	return async (request) => {
		const invocation = await boundary({
			metadata: embeddingMetadataForRequest(request),
			payload: request,
			policy: {
				timeoutMs: Math.max(1, request.timeoutMs),
				maxAttempts,
				retryBackoffMs,
			},
			...(request.signal === undefined ? {} : { parentSignal: request.signal }),
		});

		if (!invocation.ok) {
			return invocation;
		}

		const invalidResponse = validateEmbeddingResponse(request, invocation.value);
		if (invalidResponse !== null) {
			return {
				...invalidResponse,
				attempts: invocation.attempts,
			};
		}

		return {
			ok: true,
			response: invocation.value,
			attempts: invocation.attempts,
			diagnostic: invocation.diagnostic,
		};
	};
};

export const defaultProviderEmbeddingInvoker = createProviderEmbeddingInvoker();
