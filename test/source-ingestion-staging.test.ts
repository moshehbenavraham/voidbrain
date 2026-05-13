import { describe, expect, it, vi } from "vitest";
import {
	SourceIngestionIntakeService,
	SourceIngestionStagingService,
	createContentSha256,
	stageSourceIngestion,
} from "../src/agent";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
} from "../src/providers/provider-registry";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import type { ProviderSetupPreflightDecision } from "../src/types/provider-setup";
import { makeProviderModelId } from "../src/types/providers";
import { type SourceManifest, makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { SYNTHETIC_PRIVATE_CONTENT_PROBE } from "./fixtures/providers/provider-invocation-fixtures";
import {
	APPROVED_URL_SOURCE_INPUT,
	DENIED_URL_SOURCE_INPUT,
	DUPLICATE_SOURCE_MANIFEST,
	EXPECTED_INGESTION_TARGETS,
	INGESTION_FIXTURE_MARKDOWN,
	SAFE_MARKDOWN_SOURCE_INPUT,
	SOURCE_INGESTION_FIXTURE_MESSAGE,
	TARGET_COLLISION_NOTE,
	UNSAFE_PATH_SOURCE_INPUT,
} from "./fixtures/vault/source-ingestion-fixtures";

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const expectOk = <TValue>(
	result: { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly errors: readonly unknown[] },
): TValue => {
	if (!result.ok) {
		throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

const localChatSettings = (): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("local-chat-fixture"),
		},
	},
});

const trustedCloudSettings = (): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	areCloudProvidersEnabled: true,
	trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
	providerAuthStatuses: [
		{
			providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			status: "passed",
			checkedAt: "2026-05-13T00:00:00.000Z",
			statusCode: 200,
			modelCount: 1,
			durationMs: 1,
			diagnostic: {},
		},
	],
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("trusted-cloud-chat-fixture"),
		},
	},
});

const untrustedCloudSettings = (): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	areCloudProvidersEnabled: true,
	providerAuthStatuses: [
		{
			providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			status: "passed",
			checkedAt: "2026-05-13T00:00:00.000Z",
			statusCode: 200,
			modelCount: 1,
			durationMs: 1,
			diagnostic: {},
		},
	],
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("untrusted-cloud-chat-fixture"),
		},
	},
});

const allowedPreflight = (): ProviderSetupPreflightDecision => {
	const provider = BASELINE_PROVIDERS[0];
	const model = provider?.models[0];
	if (provider === undefined || model === undefined) {
		throw new Error("Expected local fixture provider");
	}

	return {
		allowed: true,
		provider,
		modelId: model.id,
		policy: {
			areCloudProvidersEnabled: false,
			trustedProviderIds: [],
		},
		diagnostic: {},
	};
};

describe("source ingestion staging", () => {
	it("previews approved sources with target paths, citations, and duplicate status", async () => {
		const intake = new SourceIngestionIntakeService({ now: fixedNow });
		const preview = expectOk(await intake.createPreview({ input: SAFE_MARKDOWN_SOURCE_INPUT }));

		expect(preview).toMatchObject({
			title: "Synthetic Source Ingestion Demo",
			sourcePath: "inbox/source-ingestion-demo.md",
			targetPaths: {
				source: EXPECTED_INGESTION_TARGETS.source,
				summary: EXPECTED_INGESTION_TARGETS.summary,
			},
			duplicateStatus: {
				kind: "none",
				isBlocking: false,
			},
		});
		expect(preview.citationEvidence[0]).toMatchObject({
			sourcePath: "inbox/source-ingestion-demo.md",
		});
		expect(SOURCE_INGESTION_FIXTURE_MESSAGE).not.toContain("sk-");
	});

	it("fails closed for unsafe paths, denied URLs, duplicates, and target collisions", async () => {
		const intake = new SourceIngestionIntakeService({ now: fixedNow });

		await expect(intake.createPreview({ input: UNSAFE_PATH_SOURCE_INPUT })).resolves.toMatchObject({
			ok: false,
			errors: [expect.objectContaining({ code: "path.traversal" })],
		});
		await expect(intake.createPreview({ input: DENIED_URL_SOURCE_INPUT })).resolves.toMatchObject({
			ok: false,
			errors: [expect.objectContaining({ code: "record.invalid-state" })],
		});

		const sourcePathDuplicate = expectOk(
			await intake.createPreview({
				input: SAFE_MARKDOWN_SOURCE_INPUT,
				existingSourceManifest: DUPLICATE_SOURCE_MANIFEST,
			}),
		);
		expect(sourcePathDuplicate.duplicateStatus).toMatchObject({
			kind: "source-path",
			isBlocking: true,
		});

		const targetCollision = expectOk(
			await intake.createPreview({
				input: SAFE_MARKDOWN_SOURCE_INPUT,
				existingNotes: [TARGET_COLLISION_NOTE],
			}),
		);
		expect(targetCollision.duplicateStatus).toMatchObject({
			kind: "target-path",
			isBlocking: true,
		});
	});

	it("detects duplicate content hashes from source manifests", async () => {
		const contentSha256 = await createContentSha256(INGESTION_FIXTURE_MARKDOWN);
		const manifest: SourceManifest = {
			artifactKind: "source-manifest",
			schemaVersion: 1,
			generatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
			records: [
				{
					id: "source-record-synthetic-duplicate",
					path: makeNormalizedVaultPath("sources/existing-synthetic-source.md"),
					title: "Existing Synthetic Source",
					sourceType: "article",
					contentSha256,
					createdAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
					updatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
					tags: ["fixture"],
				},
			],
		};

		const preview = expectOk(
			await new SourceIngestionIntakeService({ now: fixedNow }).createPreview({
				input: SAFE_MARKDOWN_SOURCE_INPUT,
				existingSourceManifest: manifest,
			}),
		);

		expect(preview.duplicateStatus).toMatchObject({
			kind: "content-hash",
			matchedPaths: ["sources/existing-synthetic-source.md"],
			isBlocking: true,
		});
	});

	it("stages generated artifacts through staged-change records without direct note mutation", async () => {
		const result = await stageSourceIngestion(
			{
				input: SAFE_MARKDOWN_SOURCE_INPUT,
			},
			{ now: fixedNow },
		);

		expect(result).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "not-requested",
			},
		});
		if (!result.ok) {
			throw new Error(result.message);
		}
		expect(result.stagedChanges).toHaveLength(result.artifacts.length);
		expect(result.stagedChanges.every((change) => change.operationKind === "create-note")).toBe(true);
		expect(result.stagedChanges.every((change) => change.status === "review-ready")).toBe(true);
		expect(result.recovery).toMatchObject({
			commandId: "voidbrain.ingest-source",
			sourcePath: "inbox/source-ingestion-demo.md",
		});
		expect(JSON.stringify(result.recovery)).not.toContain("Generated notes remain staged changes");
	});

	it("uses provider preflight when optional provider assistance is requested", async () => {
		const localService = new SourceIngestionStagingService({
			getSettings: localChatSettings,
			baselineProviders: BASELINE_PROVIDERS,
			providerExtractor: async () => ({
				entities: ["Synthetic Local Entity"],
				concepts: ["Local First"],
				summarySentences: ["Provider-assisted local extraction stayed on the device."],
				excerpt: "Provider-assisted local extraction stayed on the device.",
			}),
			now: fixedNow,
		});
		const localResult = await localService.stageSource({
			input: {
				...SAFE_MARKDOWN_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});

		expect(localResult).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "allowed",
				allowed: true,
			},
		});

		const trustedCloudResult = await new SourceIngestionStagingService({
			getSettings: trustedCloudSettings,
			baselineProviders: BASELINE_PROVIDERS,
			providerExtractor: async () => ({
				entities: ["Synthetic Cloud Entity"],
				concepts: ["Privacy Boundary"],
				summarySentences: ["Trusted cloud extraction passed explicit preflight."],
				excerpt: "Trusted cloud extraction passed explicit preflight.",
			}),
			now: fixedNow,
		}).stageSource({
			input: {
				...SAFE_MARKDOWN_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});
		expect(trustedCloudResult).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "allowed",
				allowed: true,
			},
		});

		const deniedCloudResult = await new SourceIngestionStagingService({
			getSettings: untrustedCloudSettings,
			baselineProviders: BASELINE_PROVIDERS,
			now: fixedNow,
		}).stageSource({
			input: {
				...SAFE_MARKDOWN_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});
		expect(deniedCloudResult).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "denied",
				allowed: false,
			},
		});
	});

	it("falls back deterministically after provider timeout and rejects duplicate in-flight staging", async () => {
		let releaseProvider: (() => void) | undefined;
		let markProviderStarted: (() => void) | undefined;
		const providerStarted = new Promise<void>((resolve) => {
			markProviderStarted = resolve;
		});
		const service = new SourceIngestionStagingService({
			providerPreflight: allowedPreflight,
			providerTimeoutMs: 5,
			maxProviderAttempts: 1,
			providerExtractor: () =>
				new Promise((resolve) => {
					markProviderStarted?.();
					releaseProvider = () =>
						resolve({
							entities: ["Late Entity"],
							concepts: ["Late Concept"],
							summarySentences: ["Late provider output."],
							excerpt: "Late provider output.",
						});
				}),
			now: fixedNow,
		});

		const first = service.stageSource({
			input: {
				...APPROVED_URL_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});
		await providerStarted;
		const duplicate = await service.stageSource({
			input: {
				...APPROVED_URL_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});
		expect(duplicate).toMatchObject({
			ok: false,
			code: "ingestion.duplicate-source",
		});

		await vi.advanceTimersByTimeAsync(10);
		const result = await first;
		releaseProvider?.();

		expect(result).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "failed",
				code: "provider-extraction-failed",
			},
		});
	});

	it("records provider cancellation and unsafe failures without leaking diagnostics", async () => {
		const controller = new AbortController();
		let markProviderStarted: (() => void) | undefined;
		const providerStarted = new Promise<void>((resolve) => {
			markProviderStarted = resolve;
		});
		const canceledService = new SourceIngestionStagingService({
			providerPreflight: allowedPreflight,
			providerExtractor: () => {
				markProviderStarted?.();
				return new Promise(() => undefined);
			},
			providerTimeoutMs: 1000,
			maxProviderAttempts: 1,
			now: fixedNow,
		});
		const canceled = canceledService.stageSource({
			input: {
				...SAFE_MARKDOWN_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
			signal: controller.signal,
		});
		await providerStarted;
		controller.abort();
		const canceledResult = await canceled;
		expect(canceledResult).toMatchObject({
			ok: false,
			code: "ingestion.canceled",
			providerDecision: {
				attempts: [
					{
						status: "canceled",
					},
				],
			},
		});

		const unsafeFailure = await new SourceIngestionStagingService({
			providerPreflight: allowedPreflight,
			providerExtractor: async () => {
				throw new Error(`provider failed with ${SYNTHETIC_PRIVATE_CONTENT_PROBE} and fixture-provider-secret`);
			},
			providerTimeoutMs: 1000,
			maxProviderAttempts: 1,
			now: fixedNow,
		}).stageSource({
			input: {
				...SAFE_MARKDOWN_SOURCE_INPUT,
				providerMode: "optional-summary",
			},
		});
		expect(unsafeFailure).toMatchObject({
			ok: true,
			providerDecision: {
				kind: "failed",
				code: "provider-extraction-failed",
				attempts: [
					{
						status: "failed",
					},
				],
			},
		});
		const serialized = JSON.stringify(unsafeFailure);
		expect(serialized).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
		expect(serialized).not.toContain("fixture-provider-secret");
	});
});
