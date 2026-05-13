import type { ProviderChatTransport, ProviderChatTransportResult } from "../../../src/providers/chat-provider";
import { LOCAL_FIXTURE_PROVIDER_ID, TRUSTED_CLOUD_FIXTURE_PROVIDER_ID } from "../../../src/providers/provider-registry";
import type { ChatProviderRequest } from "../../../src/types/chat";
import { CHAT_COMMAND_ID, makeChatCitationId, makeChatThreadId, makeChatTurnId } from "../../../src/types/chat";
import type {
	ProviderEmbeddingRequest,
	ProviderEmbeddingTransport,
	ProviderEmbeddingTransportResult,
} from "../../../src/types/provider-invocation";
import { makeProviderModelId } from "../../../src/types/providers";
import { makeNormalizedVaultPath } from "../../../src/types/vault";

export const PROVIDER_INVOCATION_FIXED_ISO = "2026-05-13T00:00:00.000Z";
export const PROVIDER_INVOCATION_FIXED_DATE = new Date(PROVIDER_INVOCATION_FIXED_ISO);

export const SYNTHETIC_INVOCATION_THREAD_ID = makeChatThreadId("fixture-thread-provider-boundary");
export const SYNTHETIC_INVOCATION_TURN_ID = makeChatTurnId("fixture-turn-provider-boundary");
export const SYNTHETIC_INVOCATION_CITATION_ID = makeChatCitationId("fixture-citation-provider-boundary");
export const SYNTHETIC_INVOCATION_SOURCE_PATH = makeNormalizedVaultPath("fixtures/demo-vault/provider-boundary.md");
export const SYNTHETIC_INVOCATION_MODEL_ID = makeProviderModelId("local-chat-fixture");
export const SYNTHETIC_INVOCATION_EMBEDDING_MODEL_ID = makeProviderModelId("local-embedding-fixture");
export const SYNTHETIC_CLOUD_INVOCATION_MODEL_ID = makeProviderModelId("trusted-cloud-chat-fixture");

export const SYNTHETIC_PRIVATE_CONTENT_PROBE = "Synthetic private note body for provider invocation boundary tests.";

export const SYNTHETIC_SECRET_LIKE_DIAGNOSTIC = {
	providerId: LOCAL_FIXTURE_PROVIDER_ID,
	transportHeaderValue: "Bearer fixture",
	credentialProbe: "fixture-credential-probe",
	promptBody: SYNTHETIC_PRIVATE_CONTENT_PROBE,
	sourcePath: SYNTHETIC_INVOCATION_SOURCE_PATH,
	hiddenTransportState: {
		sessionValue: "synthetic-hidden-session",
	},
};

export const SYNTHETIC_EMBEDDING_CHUNK_ID = "fixture-provider-boundary-embedding-chunk";
export const SYNTHETIC_EMBEDDING_VECTOR = [0.1, 0.2, 0.3, 0.4] as const;

export const SYNTHETIC_DENIAL_DIAGNOSTIC = {
	providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	modelId: SYNTHETIC_CLOUD_INVOCATION_MODEL_ID,
	reason: "cloud-disabled",
	sourcePathCount: 1,
};

export const syntheticChatProviderRequest = (overrides: Partial<ChatProviderRequest> = {}): ChatProviderRequest => ({
	commandId: CHAT_COMMAND_ID,
	threadId: SYNTHETIC_INVOCATION_THREAD_ID,
	turnId: SYNTHETIC_INVOCATION_TURN_ID,
	providerId: LOCAL_FIXTURE_PROVIDER_ID,
	modelId: SYNTHETIC_INVOCATION_MODEL_ID,
	contentSensitivity: "private-vault",
	question: "What does the synthetic provider boundary fixture say?",
	evidence: [
		{
			citationId: SYNTHETIC_INVOCATION_CITATION_ID,
			vaultPath: SYNTHETIC_INVOCATION_SOURCE_PATH,
			heading: "Provider Boundary",
			chunkId: "fixture-provider-boundary-chunk",
			snippet: SYNTHETIC_PRIVATE_CONTENT_PROBE,
			sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
			score: 1,
		},
	],
	citations: [
		{
			id: SYNTHETIC_INVOCATION_CITATION_ID,
			label: "[1]",
			resultId: "fixture-provider-boundary-result",
			vaultPath: SYNTHETIC_INVOCATION_SOURCE_PATH,
			heading: "Provider Boundary",
			chunkId: "fixture-provider-boundary-chunk",
			sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
			score: 1,
		},
	],
	sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
	timeoutMs: 25,
	...overrides,
});

export const syntheticEmbeddingProviderRequest = (
	overrides: Partial<ProviderEmbeddingRequest> = {},
): ProviderEmbeddingRequest => ({
	commandId: "voidbrain.semantic-index-readiness",
	providerId: LOCAL_FIXTURE_PROVIDER_ID,
	modelId: SYNTHETIC_INVOCATION_EMBEDDING_MODEL_ID,
	contentSensitivity: "private-vault",
	chunks: [
		{
			id: SYNTHETIC_EMBEDDING_CHUNK_ID,
			text: SYNTHETIC_PRIVATE_CONTENT_PROBE,
			path: SYNTHETIC_INVOCATION_SOURCE_PATH,
			chunkId: SYNTHETIC_EMBEDDING_CHUNK_ID,
			sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
			contentFingerprint: "synthetic-provider-boundary-fingerprint",
		},
	],
	sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
	timeoutMs: 25,
	embeddingModelFamily: "fixture-local-embeddings",
	expectedDimensions: SYNTHETIC_EMBEDDING_VECTOR.length,
	recovery: {
		commandId: "voidbrain.semantic-index-readiness",
		providerId: LOCAL_FIXTURE_PROVIDER_ID,
		modelId: SYNTHETIC_INVOCATION_EMBEDDING_MODEL_ID,
		sourcePathCount: 1,
		reportId: "fixture-provider-boundary-embedding-report",
		validationOutput: ["synthetic embedding preflight allowed"],
	},
	...overrides,
});

export const successfulChatTransport =
	(): ProviderChatTransport =>
	async ({ request }) => {
		const firstCitation = request.citations[0];
		if (firstCitation === undefined) {
			return {
				ok: false,
				code: "chat.citation-missing",
				message: "Synthetic fixture request did not include a citation.",
				retryable: false,
				diagnostic: {
					providerId: request.providerId,
					modelId: request.modelId,
				},
			};
		}

		return {
			ok: true,
			response: {
				answer: "Synthetic provider boundary answer with citation.",
				citations: [firstCitation.id],
				diagnostic: {
					providerId: request.providerId,
					modelId: request.modelId,
				},
			},
			diagnostic: {
				providerId: request.providerId,
				modelId: request.modelId,
				sourcePathCount: request.sourcePaths.length,
			},
		};
	};

export const timeoutChatTransport = (): ProviderChatTransport => () => new Promise(() => undefined);

export const cancellationAwareChatTransport =
	(): ProviderChatTransport =>
	({ signal }) =>
		new Promise<ProviderChatTransportResult>((resolve) => {
			signal.addEventListener(
				"abort",
				() => {
					resolve({
						ok: false,
						code: "chat.provider-failed",
						message: "Synthetic provider transport observed cancellation.",
						retryable: false,
						diagnostic: {
							reason: "aborted",
						},
					});
				},
				{ once: true },
			);
		});

export const retryThenSuccessChatTransport = (): ProviderChatTransport => {
	let calls = 0;

	return async (input) => {
		calls += 1;
		if (calls === 1) {
			return {
				ok: false,
				code: "chat.provider-failed",
				message: "Synthetic retryable provider failure.",
				retryable: true,
				diagnostic: {
					attempt: input.attempt,
					reason: "retryable-fixture-failure",
				},
			};
		}

		return successfulChatTransport()(input);
	};
};

export const secretLikeFailureChatTransport = (): ProviderChatTransport => async () => ({
	ok: false,
	code: "chat.provider-failed",
	message: "Synthetic provider failed with unsafe diagnostic.",
	retryable: false,
	diagnostic: SYNTHETIC_SECRET_LIKE_DIAGNOSTIC,
});

export const successfulEmbeddingTransport =
	(): ProviderEmbeddingTransport =>
	async ({ request }) => {
		const firstChunk = request.chunks[0];
		if (firstChunk === undefined) {
			return {
				ok: false,
				code: "embedding.invalid-response",
				message: "Synthetic fixture request did not include embedding chunks.",
				retryable: false,
				diagnostic: {
					providerId: request.providerId,
					modelId: request.modelId,
				},
			};
		}

		return {
			ok: true,
			response: {
				vectors: [
					{
						chunkId: firstChunk.id,
						vector: SYNTHETIC_EMBEDDING_VECTOR,
						dimensions: SYNTHETIC_EMBEDDING_VECTOR.length,
					},
				],
				dimensions: SYNTHETIC_EMBEDDING_VECTOR.length,
				diagnostic: {
					providerId: request.providerId,
					modelId: request.modelId,
				},
				...(request.embeddingModelFamily === undefined
					? {}
					: { embeddingModelFamily: request.embeddingModelFamily }),
			},
			diagnostic: {
				providerId: request.providerId,
				modelId: request.modelId,
				sourcePathCount: request.sourcePaths.length,
			},
		};
	};

export const timeoutEmbeddingTransport = (): ProviderEmbeddingTransport => () => new Promise(() => undefined);

export const cancellationAwareEmbeddingTransport =
	(): ProviderEmbeddingTransport =>
	({ signal }) =>
		new Promise<ProviderEmbeddingTransportResult>((resolve) => {
			signal.addEventListener(
				"abort",
				() => {
					resolve({
						ok: false,
						code: "embedding.provider-failed",
						message: "Synthetic embedding transport observed cancellation.",
						retryable: false,
						diagnostic: {
							reason: "aborted",
						},
					});
				},
				{ once: true },
			);
		});

export const retryThenSuccessEmbeddingTransport = (): ProviderEmbeddingTransport => {
	let calls = 0;

	return async (input) => {
		calls += 1;
		if (calls === 1) {
			return {
				ok: false,
				code: "embedding.provider-failed",
				message: "Synthetic retryable embedding failure.",
				retryable: true,
				diagnostic: {
					attempt: input.attempt,
					reason: "retryable-fixture-failure",
				},
			};
		}

		return successfulEmbeddingTransport()(input);
	};
};

export const secretLikeFailureEmbeddingTransport = (): ProviderEmbeddingTransport => async () => ({
	ok: false,
	code: "embedding.provider-failed",
	message: "Synthetic embedding provider failed with unsafe diagnostic.",
	retryable: false,
	diagnostic: SYNTHETIC_SECRET_LIKE_DIAGNOSTIC,
});
