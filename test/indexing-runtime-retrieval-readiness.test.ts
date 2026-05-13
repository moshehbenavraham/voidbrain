import { describe, expect, it } from "vitest";
import {
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	createProviderEmbeddingInvoker,
	makeProviderModelId,
} from "../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import type { IndexSourceFingerprint, SemanticIndexSnapshot, SemanticVectorEntry } from "../src/types/retrieval";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { FixtureIndexingService, IndexingRuntimeService, createObsidianMarkdownIndexSource } from "../src/vectorstore";
import { App as MockApp } from "./__mocks__/obsidian";
import {
	SYNTHETIC_INVOCATION_SOURCE_PATH,
	SYNTHETIC_PRIVATE_CONTENT_PROBE,
	cancellationAwareEmbeddingTransport,
	syntheticEmbeddingProviderRequest,
	timeoutEmbeddingTransport,
} from "./fixtures/providers/provider-invocation-fixtures";
import {
	RUNTIME_INDEXING_FIXTURE_FILES,
	RUNTIME_INDEXING_FIXTURE_MESSAGE,
	type RuntimeIndexingFixtureFile,
	createRuntimeFixtureFiles,
} from "./fixtures/vault/runtime-indexing-fixtures";
import {
	SEMANTIC_COMPATIBILITY_DIMENSIONS,
	SEMANTIC_COMPATIBILITY_FAMILY,
	SEMANTIC_COMPATIBILITY_INDEX_ID,
} from "./fixtures/vault/semantic-index-compatibility-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");

const basePreferences = {
	...DEFAULT_PLUGIN_SETTINGS.indexing,
	excludedFolders: [makeNormalizedVaultPath("archive")],
	maxNoteBytes: 100000,
};

const runtimeNotesOnly = RUNTIME_INDEXING_FIXTURE_FILES.filter(
	(file) => file.path === "sources/runtime-source.md" || file.path === "concepts/runtime-concept.md",
);

const configureVault = (
	app: MockApp,
	fixtures: readonly RuntimeIndexingFixtureFile[] = RUNTIME_INDEXING_FIXTURE_FILES,
): void => {
	const files = createRuntimeFixtureFiles(fixtures);
	app.vault.setFiles(files);
	for (const fixture of fixtures) {
		if (fixture.shouldFailRead === true) {
			app.vault.setReadFailure(fixture.path);
			continue;
		}
		app.vault.setReadContent(fixture.path, fixture.content);
	}
	app.metadataCache.setFileCache("concepts/runtime-concept.md", {
		frontmatter: {
			title: "Runtime Concept",
			aliases: ["runtime-concept"],
		},
	});
};

const createRuntimeService = (
	input: {
		readonly app?: MockApp;
		readonly settings?: VoidbrainPluginSettings;
		readonly fixtures?: readonly RuntimeIndexingFixtureFile[];
		readonly getSemanticSnapshot?: () => SemanticIndexSnapshot | null;
		readonly createIndexingService?: ConstructorParameters<
			typeof IndexingRuntimeService
		>[0]["createIndexingService"];
	} = {},
): { readonly app: MockApp; readonly service: IndexingRuntimeService; settings: VoidbrainPluginSettings } => {
	const app = input.app ?? new MockApp();
	const settings = input.settings ?? { ...DEFAULT_PLUGIN_SETTINGS, indexing: basePreferences };
	configureVault(app, input.fixtures ?? runtimeNotesOnly);
	const source = createObsidianMarkdownIndexSource({
		vault: app.vault,
		metadataCache: app.metadataCache,
	});
	const service = new IndexingRuntimeService({
		source,
		getSettings: () => settings,
		now: () => fixedDate,
		...(input.getSemanticSnapshot === undefined ? {} : { getSemanticSnapshot: input.getSemanticSnapshot }),
		...(input.createIndexingService === undefined ? {} : { createIndexingService: input.createIndexingService }),
	});

	return { app, service, settings };
};

const semanticEntriesForSources = (sources: readonly IndexSourceFingerprint[]): readonly SemanticVectorEntry[] =>
	sources.map((source, index) => ({
		id: `runtime-semantic-vector-${index + 1}`,
		path: source.path,
		chunkId: `runtime-semantic-chunk-${index + 1}`,
		embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
		dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		vector: [0.1 + index, 0.2 + index, 0.3 + index, 0.4 + index],
		sourcePaths: [source.path],
		contentFingerprint: source.contentFingerprint,
	}));

const semanticSnapshotForSources = (
	sources: readonly IndexSourceFingerprint[],
	overrides: Partial<SemanticIndexSnapshot> = {},
): SemanticIndexSnapshot => ({
	config: {
		indexId: SEMANTIC_COMPATIBILITY_INDEX_ID,
		embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
		dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		distanceMetric: "cosine",
	},
	status: "ready",
	builtAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
	sources,
	entries: semanticEntriesForSources(sources),
	...overrides,
});

describe("Obsidian runtime indexing source", () => {
	it("collects markdown notes through vault APIs with bounded diagnostics", async () => {
		const app = new MockApp();
		configureVault(app);
		const source = createObsidianMarkdownIndexSource({
			vault: app.vault,
			metadataCache: app.metadataCache,
		});

		const result = await source.readMarkdownNotes({
			preferences: basePreferences,
		});

		expect(result.notes.map((note) => note.path)).toEqual([
			makeNormalizedVaultPath("concepts/runtime-concept.md"),
			makeNormalizedVaultPath("sources/runtime-source.md"),
		]);
		expect(result.pathAliases["runtime-concept"]).toBe(makeNormalizedVaultPath("concepts/runtime-concept.md"));
		expect(result.skippedPaths.map((path) => path.code)).toEqual(
			expect.arrayContaining(["excluded-folder", "max-note-bytes", "non-markdown"]),
		);
		expect(result.failedPaths).toEqual([
			expect.objectContaining({
				path: makeNormalizedVaultPath("sources/read-failure.md"),
				code: "read-failed",
			}),
		]);
		expect(JSON.stringify(result)).not.toContain("This content must never appear");
		expect(RUNTIME_INDEXING_FIXTURE_MESSAGE).not.toContain("sk-");
	});
});

describe("IndexingRuntimeService lexical readiness", () => {
	it("reports progress, ready state, and stale paths without mutating notes", async () => {
		const { app, service } = createRuntimeService();
		const statuses: string[] = [];
		service.subscribe((state) => {
			statuses.push(state.lexicalReport.status);
		});

		await expect(service.reindexLexical()).resolves.toMatchObject({
			accepted: true,
			status: "ready",
		});

		expect(statuses).toEqual(expect.arrayContaining(["building", "ready"]));
		expect(service.getState().lexicalIndex?.sources.map((source) => source.path)).toEqual([
			makeNormalizedVaultPath("concepts/runtime-concept.md"),
			makeNormalizedVaultPath("sources/runtime-source.md"),
		]);
		expect(service.getState().lexicalReport.freshness?.state).toBe("fresh");

		app.vault.setReadContent(
			"sources/runtime-source.md",
			"# Runtime Source\n\nSynthetic changed content for stale detection.",
		);
		await expect(service.refreshLexicalFreshness()).resolves.toMatchObject({
			accepted: true,
			status: "stale",
		});
		expect(service.getState().lexicalReport.stalePaths).toEqual([
			makeNormalizedVaultPath("sources/runtime-source.md"),
		]);
	});

	it("prevents duplicate jobs, supports cancellation, and retries safely", async () => {
		let releaseFirstNote: (() => void) | undefined;
		let shouldBlock = true;
		const { service } = createRuntimeService({
			createIndexingService: (parseOptions) =>
				new FixtureIndexingService({
					parseOptions,
					hooks: {
						beforeNote: () => {
							if (!shouldBlock) {
								return undefined;
							}

							shouldBlock = false;
							return new Promise<void>((resolve) => {
								releaseFirstNote = resolve;
							});
						},
					},
				}),
		});

		const firstRun = service.reindexLexical();
		await Promise.resolve();

		await expect(service.reindexLexical()).resolves.toMatchObject({
			accepted: false,
			message: expect.stringContaining("already running"),
		});
		expect(service.cancelLexical()).toMatchObject({
			accepted: true,
			status: "canceled",
		});

		releaseFirstNote?.();
		await expect(firstRun).resolves.toMatchObject({
			status: "canceled",
		});
		await expect(service.retryLexical()).resolves.toMatchObject({
			accepted: true,
			status: "ready",
		});
	});
});

describe("IndexingRuntimeService semantic readiness gates", () => {
	it("fails closed for missing, mismatched, auth, and privacy-gated embedding providers", () => {
		const missingProvider = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
			},
		}).service;
		expect(missingProvider.getState().semanticReadiness).toMatchObject({
			state: "missing-provider",
			readinessState: "missing",
		});

		const capabilityMismatch = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
				providerRoles: {
					...DEFAULT_PLUGIN_SETTINGS.providerRoles,
					embedding: {
						providerId: LOCAL_FIXTURE_PROVIDER_ID,
						modelId: makeProviderModelId("local-chat-fixture"),
					},
				},
			},
		}).service;
		expect(capabilityMismatch.getState().semanticReadiness).toMatchObject({
			state: "capability-mismatch",
			readinessState: "blocked",
			recovery: {
				commandId: "voidbrain.semantic-index-readiness",
				validationOutput: ["capability-denied"],
			},
		});

		const authNotReady = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				areCloudProvidersEnabled: true,
				trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
				providerRoles: {
					...DEFAULT_PLUGIN_SETTINGS.providerRoles,
					embedding: {
						providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
						modelId: makeProviderModelId("trusted-cloud-embedding-fixture"),
					},
				},
			},
		}).service;
		expect(authNotReady.getState().semanticReadiness).toMatchObject({
			state: "auth-not-ready",
			diagnosticCode: "auth-not-ready",
			recovery: {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("trusted-cloud-embedding-fixture"),
				validationOutput: ["auth-not-ready"],
			},
		});

		const cloudDisabled = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
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
			},
		}).service;
		expect(cloudDisabled.getState().semanticReadiness).toMatchObject({
			state: "privacy-denied",
			diagnosticCode: "privacy-denied",
			recovery: {
				readinessCode: "privacy-denied",
				validationOutput: ["privacy-denied"],
			},
		});

		const localReady = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
				providerRoles: {
					...DEFAULT_PLUGIN_SETTINGS.providerRoles,
					embedding: {
						providerId: LOCAL_FIXTURE_PROVIDER_ID,
						modelId: makeProviderModelId("local-embedding-fixture"),
					},
				},
			},
		}).service;
		expect(localReady.getState().semanticReadiness).toMatchObject({
			state: "ready",
			readinessState: "ready",
			recovery: {
				readinessCode: null,
				validationOutput: ["semantic provider preflight ready"],
			},
		});
		expect(JSON.stringify(localReady.getState().semanticReadiness)).not.toContain("Synthetic runtime source");
	});

	it("updates semantic compatibility for missing, stale, provider-blocked, and canceled snapshots", async () => {
		const localSettings: VoidbrainPluginSettings = {
			...DEFAULT_PLUGIN_SETTINGS,
			indexing: {
				...basePreferences,
				isSemanticIndexEnabled: true,
			},
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				embedding: {
					providerId: LOCAL_FIXTURE_PROVIDER_ID,
					modelId: makeProviderModelId("local-embedding-fixture"),
				},
			},
		};
		let semanticSnapshot: SemanticIndexSnapshot | null = null;
		const { app, service } = createRuntimeService({
			settings: localSettings,
			getSemanticSnapshot: () => semanticSnapshot,
		});

		await expect(service.reindexLexical()).resolves.toMatchObject({ status: "ready" });
		expect(service.getState().semanticCompatibility).toMatchObject({
			state: "missing",
			code: "missing-index",
			fallbackMode: "lexical",
			guidance: {
				action: "rebuild-semantic-index",
			},
		});

		const indexedSources = service.getState().lexicalIndex?.sources ?? [];
		semanticSnapshot = semanticSnapshotForSources(indexedSources);
		service.refreshReadiness();
		expect(service.getState().semanticCompatibility).toMatchObject({
			state: "ready",
			code: "compatible",
			semanticSearchEligible: true,
		});

		app.vault.setReadContent(
			"sources/runtime-source.md",
			"# Runtime Source\n\nSynthetic semantic compatibility stale content.",
		);
		await expect(service.refreshLexicalFreshness()).resolves.toMatchObject({ status: "stale" });
		expect(service.getState().semanticCompatibility).toMatchObject({
			state: "stale",
			code: "stale-source-fingerprints",
			fallbackMode: "lexical",
			sourcePathCounts: {
				stale: 1,
			},
		});

		semanticSnapshot = semanticSnapshotForSources(indexedSources, { status: "canceled" });
		service.refreshReadiness();
		expect(service.getState().semanticCompatibility).toMatchObject({
			state: "canceled",
			code: "provider-canceled",
			fallbackMode: "lexical",
		});

		const blocked = createRuntimeService({
			settings: {
				...DEFAULT_PLUGIN_SETTINGS,
				indexing: {
					...basePreferences,
					isSemanticIndexEnabled: true,
				},
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
			},
			getSemanticSnapshot: () => semanticSnapshotForSources(indexedSources),
		}).service;
		await expect(blocked.reindexLexical()).resolves.toMatchObject({ status: "ready" });
		expect(blocked.getState().semanticCompatibility).toMatchObject({
			state: "provider-blocked",
			code: "provider-blocked",
			fallbackMode: "lexical",
			guidance: {
				action: "review-provider-setup",
			},
		});

		expect(JSON.stringify(service.getState().semanticCompatibility)).not.toContain(
			"Synthetic semantic compatibility stale content",
		);
	});

	it("keeps embedding timeout and cancellation recovery metadata safe", async () => {
		const timeout = createProviderEmbeddingInvoker({
			maxAttempts: 1,
			transport: timeoutEmbeddingTransport(),
			now: () => fixedDate,
		});
		const timeoutPromise = timeout(syntheticEmbeddingProviderRequest({ timeoutMs: 5 }));
		await vi.advanceTimersByTimeAsync(5);
		const timeoutResult = await timeoutPromise;
		expect(timeoutResult).toMatchObject({
			ok: false,
			code: "embedding.provider-timeout",
			diagnostic: {
				sourcePathCount: 1,
			},
		});

		const controller = new AbortController();
		const canceled = createProviderEmbeddingInvoker({
			transport: cancellationAwareEmbeddingTransport(),
			now: () => fixedDate,
		});
		const canceledPromise = canceled(syntheticEmbeddingProviderRequest({ signal: controller.signal }));
		controller.abort();
		const canceledResult = await canceledPromise;
		expect(canceledResult).toMatchObject({
			ok: false,
			code: "embedding.provider-canceled",
			diagnostic: {
				sourcePathCount: 1,
			},
		});

		const serialized = JSON.stringify([timeoutResult, canceledResult]);
		expect(serialized).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
		expect(serialized).not.toContain(SYNTHETIC_INVOCATION_SOURCE_PATH);
	});
});
