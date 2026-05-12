import { describe, expect, it, vi } from "vitest";
import { LOCAL_FIXTURE_PROVIDER_ID, TRUSTED_CLOUD_FIXTURE_PROVIDER_ID, makeProviderModelId } from "../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, SETTINGS_SCHEMA_VERSION } from "../src/types/plugin";
import { makeNormalizedVaultPath } from "../src/types/vault";
import { parsePluginSettings, savePluginSettings } from "../src/utils/settings";

describe("Phase 01 plugin settings migration", () => {
	it("migrates schema 1 settings into schema 2 local-first defaults", () => {
		const result = parsePluginSettings({
			schemaVersion: 1,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
			shouldShowStatusNotices: false,
		});

		expect(result).toMatchObject({
			status: "loaded",
			errors: [],
			settings: {
				schemaVersion: SETTINGS_SCHEMA_VERSION,
				areCloudProvidersEnabled: true,
				trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
				shouldRequireProviderReview: true,
				areStagedWritesRequired: true,
				providerRoles: DEFAULT_PLUGIN_SETTINGS.providerRoles,
				indexing: DEFAULT_PLUGIN_SETTINGS.indexing,
				ui: DEFAULT_PLUGIN_SETTINGS.ui,
				status: DEFAULT_PLUGIN_SETTINGS.status,
			},
		});
	});

	it("recovers unknown provider values and disables cloud trust when trust data is invalid", () => {
		const result = parsePluginSettings({
			schemaVersion: SETTINGS_SCHEMA_VERSION,
			areCloudProvidersEnabled: true,
			trustedProviderIds: ["missing-provider"],
			providerRoles: {
				chat: {
					providerId: "missing-provider",
					modelId: "missing-model",
				},
			},
		});

		expect(result.status).toBe("recovered");
		expect(result.settings.areCloudProvidersEnabled).toBe(false);
		expect(result.settings.trustedProviderIds).toEqual([]);
		expect(result.settings.providerRoles.chat).toEqual({
			providerId: null,
			modelId: null,
		});
		expect(result.errors.map((error) => error.field)).toEqual(
			expect.arrayContaining(["trustedProviderIds[0]", "providerRoles.chat.providerId"]),
		);
	});

	it("keeps provider review and staged writes enabled when persisted settings try to disable them", () => {
		const result = parsePluginSettings({
			schemaVersion: SETTINGS_SCHEMA_VERSION,
			shouldRequireProviderReview: false,
			areStagedWritesRequired: false,
		});

		expect(result.status).toBe("recovered");
		expect(result.settings.shouldRequireProviderReview).toBe(true);
		expect(result.settings.areStagedWritesRequired).toBe(true);
		expect(result.errors.map((error) => error.field)).toEqual(
			expect.arrayContaining(["shouldRequireProviderReview", "areStagedWritesRequired"]),
		);
	});

	it("saves typed runtime settings without hidden provider state", async () => {
		const writer = {
			saveData: vi.fn(async (_data: unknown): Promise<void> => undefined),
		};
		const settings = {
			...DEFAULT_PLUGIN_SETTINGS,
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				chat: {
					providerId: LOCAL_FIXTURE_PROVIDER_ID,
					modelId: makeProviderModelId("local-chat-fixture"),
				},
			},
			indexing: {
				...DEFAULT_PLUGIN_SETTINGS.indexing,
				excludedFolders: [makeNormalizedVaultPath("fixtures/demo-vault/archive")],
				maxNoteBytes: 64000,
			},
			ui: {
				...DEFAULT_PLUGIN_SETTINGS.ui,
				statusViewLocation: "left-sidebar" as const,
			},
		};

		await expect(savePluginSettings(writer, settings)).resolves.toEqual(settings);

		const saved = writer.saveData.mock.calls[0]?.[0];
		expect(JSON.stringify(saved)).not.toContain("hidden-runtime-state");
		expect(saved).toMatchObject({
			providerRoles: {
				chat: {
					providerId: LOCAL_FIXTURE_PROVIDER_ID,
					modelId: "local-chat-fixture",
				},
			},
			indexing: {
				excludedFolders: ["fixtures/demo-vault/archive"],
			},
		});
	});

	it("drops unsupported hidden provider state from raw persisted objects", () => {
		const result = parsePluginSettings({
			...DEFAULT_PLUGIN_SETTINGS,
			hiddenProviderState: "hidden-runtime-state",
		});

		expect(result.status).toBe("loaded");
		expect(JSON.stringify(result.settings)).not.toContain("hidden-runtime-state");
	});
});
