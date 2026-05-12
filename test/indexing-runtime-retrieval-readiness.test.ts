import { describe, expect, it } from "vitest";
import { LOCAL_FIXTURE_PROVIDER_ID, TRUSTED_CLOUD_FIXTURE_PROVIDER_ID, makeProviderModelId } from "../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import { makeNormalizedVaultPath } from "../src/types/vault";
import { FixtureIndexingService, IndexingRuntimeService, createObsidianMarkdownIndexSource } from "../src/vectorstore";
import { App as MockApp } from "./__mocks__/obsidian";
import {
	RUNTIME_INDEXING_FIXTURE_FILES,
	RUNTIME_INDEXING_FIXTURE_MESSAGE,
	type RuntimeIndexingFixtureFile,
	createRuntimeFixtureFiles,
} from "./fixtures/vault/runtime-indexing-fixtures";

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
		...(input.createIndexingService === undefined ? {} : { createIndexingService: input.createIndexingService }),
	});

	return { app, service, settings };
};

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
		});
	});
});
