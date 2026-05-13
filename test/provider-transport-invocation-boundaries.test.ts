import { describe, expect, it, vi } from "vitest";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderDefinitionsForSettings,
	buildProviderPrivacyPolicy,
	createProviderChatInvoker,
	createProviderEmbeddingInvoker,
	createProviderInvocationKey,
	makeProviderModelId,
} from "../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import { makeNormalizedVaultPath } from "../src/types/vault";
import { createSemanticIndexAdapter, makeEmbeddingModelFamily } from "../src/vectorstore";
import {
	SYNTHETIC_INVOCATION_CITATION_ID,
	SYNTHETIC_INVOCATION_SOURCE_PATH,
	SYNTHETIC_PRIVATE_CONTENT_PROBE,
	cancellationAwareChatTransport,
	cancellationAwareEmbeddingTransport,
	retryThenSuccessChatTransport,
	retryThenSuccessEmbeddingTransport,
	secretLikeFailureChatTransport,
	secretLikeFailureEmbeddingTransport,
	successfulChatTransport,
	successfulEmbeddingTransport,
	syntheticChatProviderRequest,
	syntheticEmbeddingProviderRequest,
	timeoutChatTransport,
	timeoutEmbeddingTransport,
} from "./fixtures/providers/provider-invocation-fixtures";

describe("provider transport invocation boundaries", () => {
	it("allows local chat and embedding transports through the shared boundary", async () => {
		const chat = createProviderChatInvoker({
			transport: successfulChatTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		await expect(chat(syntheticChatProviderRequest())).resolves.toMatchObject({
			ok: true,
			response: {
				citations: [SYNTHETIC_INVOCATION_CITATION_ID],
			},
			attempts: [
				{
					status: "succeeded",
				},
			],
		});

		const embedding = createProviderEmbeddingInvoker({
			transport: successfulEmbeddingTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		await expect(embedding(syntheticEmbeddingProviderRequest())).resolves.toMatchObject({
			ok: true,
			response: {
				vectors: [
					{
						dimensions: 4,
					},
				],
			},
			attempts: [
				{
					status: "succeeded",
				},
			],
		});
	});

	it("denies cloud embedding preparation before text chunks become provider requests", () => {
		const settings: VoidbrainPluginSettings = {
			...DEFAULT_PLUGIN_SETTINGS,
			providerAuthStatuses: [
				{
					providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					status: "passed",
					checkedAt: "2026-05-13T00:00:00.000Z",
					statusCode: 200,
					modelCount: 2,
					durationMs: 1,
					diagnostic: {},
				},
			],
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				embedding: {
					providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					modelId: makeProviderModelId("trusted-cloud-embedding-fixture"),
				},
			},
		};
		const adapter = createSemanticIndexAdapter({
			indexId: "fixture-semantic-index",
			embeddingModelFamily: makeEmbeddingModelFamily("trusted-cloud-embeddings"),
			dimensions: 4,
			distanceMetric: "cosine",
		});

		const decision = adapter.prepareEmbeddingInvocation(
			buildProviderDefinitionsForSettings(settings, BASELINE_PROVIDERS),
			buildProviderPrivacyPolicy(settings),
			{
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				preferredModelId: makeProviderModelId("trusted-cloud-embedding-fixture"),
				contentSensitivity: "private-vault",
				sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
				workflowId: "voidbrain.semantic-index-readiness",
				userFacingPurpose: "Fixture cloud denial before embedding invocation.",
			},
			{
				chunks: syntheticEmbeddingProviderRequest().chunks,
				timeoutMs: 25,
			},
		);

		expect(decision).toMatchObject({
			ok: false,
			preflight: {
				preflight: {
					allowed: false,
					code: "cloud-disabled",
				},
			},
		});
		expect(JSON.stringify(decision)).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
	});

	it("handles timeout, retry, cancellation, duplicate guards, and redacted diagnostics for chat", async () => {
		const timeout = createProviderChatInvoker({
			maxAttempts: 1,
			transport: timeoutChatTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const timeoutPromise = timeout(syntheticChatProviderRequest({ timeoutMs: 5 }));
		await vi.advanceTimersByTimeAsync(5);
		await expect(timeoutPromise).resolves.toMatchObject({
			ok: false,
			code: "chat.provider-timeout",
			attempts: [{ status: "timed-out" }],
		});

		const retry = createProviderChatInvoker({
			maxAttempts: 2,
			retryBackoffMs: 1,
			transport: retryThenSuccessChatTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const retryPromise = retry(syntheticChatProviderRequest());
		await vi.advanceTimersByTimeAsync(1);
		await expect(retryPromise).resolves.toMatchObject({
			ok: true,
			attempts: [{ status: "failed" }, { status: "succeeded" }],
		});

		const controller = new AbortController();
		const canceled = createProviderChatInvoker({
			transport: cancellationAwareChatTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const canceledPromise = canceled(syntheticChatProviderRequest({ signal: controller.signal }));
		controller.abort();
		await expect(canceledPromise).resolves.toMatchObject({
			ok: false,
			code: "chat.provider-canceled",
			attempts: [{ status: "canceled" }],
		});

		let releaseDuplicate: (() => void) | undefined;
		const duplicate = createProviderChatInvoker({
			transport: (input) =>
				new Promise((resolve) => {
					releaseDuplicate = () => resolve(successfulChatTransport()(input));
				}),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const duplicateRequest = syntheticChatProviderRequest({
			invocationKey: createProviderInvocationKey(["fixture", "duplicate-chat"]),
		});
		const firstDuplicate = duplicate(duplicateRequest);
		await Promise.resolve();
		await expect(duplicate(duplicateRequest)).resolves.toMatchObject({
			ok: false,
			code: "chat.duplicate-action",
			attempts: [{ status: "duplicate" }],
		});
		releaseDuplicate?.();
		await expect(firstDuplicate).resolves.toMatchObject({ ok: true });

		const redacted = await createProviderChatInvoker({
			maxAttempts: 1,
			transport: secretLikeFailureChatTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		})(syntheticChatProviderRequest());
		const serialized = JSON.stringify(redacted);
		expect(serialized).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
		expect(serialized).not.toContain("Bearer fixture");
		expect(serialized).not.toContain("fixture-credential-probe");
		expect(serialized).not.toContain(SYNTHETIC_INVOCATION_SOURCE_PATH);
	});

	it("handles timeout, retry, cancellation, duplicate guards, and redacted diagnostics for embeddings", async () => {
		const timeout = createProviderEmbeddingInvoker({
			maxAttempts: 1,
			transport: timeoutEmbeddingTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const timeoutPromise = timeout(syntheticEmbeddingProviderRequest({ timeoutMs: 5 }));
		await vi.advanceTimersByTimeAsync(5);
		await expect(timeoutPromise).resolves.toMatchObject({
			ok: false,
			code: "embedding.provider-timeout",
			attempts: [{ status: "timed-out" }],
		});

		const retry = createProviderEmbeddingInvoker({
			maxAttempts: 2,
			retryBackoffMs: 1,
			transport: retryThenSuccessEmbeddingTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const retryPromise = retry(syntheticEmbeddingProviderRequest());
		await vi.advanceTimersByTimeAsync(1);
		await expect(retryPromise).resolves.toMatchObject({
			ok: true,
			attempts: [{ status: "failed" }, { status: "succeeded" }],
		});

		const controller = new AbortController();
		const canceled = createProviderEmbeddingInvoker({
			transport: cancellationAwareEmbeddingTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const canceledPromise = canceled(syntheticEmbeddingProviderRequest({ signal: controller.signal }));
		controller.abort();
		await expect(canceledPromise).resolves.toMatchObject({
			ok: false,
			code: "embedding.provider-canceled",
			attempts: [{ status: "canceled" }],
		});

		let releaseDuplicate: (() => void) | undefined;
		const duplicate = createProviderEmbeddingInvoker({
			transport: (input) =>
				new Promise((resolve) => {
					releaseDuplicate = () => resolve(successfulEmbeddingTransport()(input));
				}),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});
		const duplicateRequest = syntheticEmbeddingProviderRequest({
			invocationKey: createProviderInvocationKey(["fixture", "duplicate-embedding"]),
		});
		const firstDuplicate = duplicate(duplicateRequest);
		await Promise.resolve();
		await expect(duplicate(duplicateRequest)).resolves.toMatchObject({
			ok: false,
			code: "embedding.duplicate-action",
			attempts: [{ status: "duplicate" }],
		});
		releaseDuplicate?.();
		await expect(firstDuplicate).resolves.toMatchObject({ ok: true });

		const redacted = await createProviderEmbeddingInvoker({
			maxAttempts: 1,
			transport: secretLikeFailureEmbeddingTransport(),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		})(syntheticEmbeddingProviderRequest());
		const serialized = JSON.stringify(redacted);
		expect(serialized).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
		expect(serialized).not.toContain("Bearer fixture");
		expect(serialized).not.toContain("fixture-credential-probe");
		expect(serialized).not.toContain(SYNTHETIC_INVOCATION_SOURCE_PATH);
	});

	it("rejects malformed embedding responses deterministically", async () => {
		const invoker = createProviderEmbeddingInvoker({
			transport: async () => ({
				ok: true,
				response: {
					vectors: [
						{
							chunkId: "unexpected-fixture-chunk",
							vector: [0.1, 0.2],
							dimensions: 2,
						},
					],
				},
			}),
			now: () => new Date("2026-05-13T00:00:00.000Z"),
		});

		await expect(invoker(syntheticEmbeddingProviderRequest())).resolves.toMatchObject({
			ok: false,
			code: "embedding.invalid-response",
			retryable: false,
		});
	});
});
