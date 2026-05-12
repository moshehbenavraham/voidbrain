import type { App, PluginManifest } from "obsidian";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";
import VoidbrainPlugin from "../src/main";
import { TRUSTED_CLOUD_FIXTURE_PROVIDER_ID } from "../src/providers/provider-registry";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID } from "../src/types/plugin";
import type { Command } from "./__mocks__/obsidian";
import { App as MockApp } from "./__mocks__/obsidian";
import { notices, resetObsidianMockState } from "./__mocks__/obsidian";

interface MockedPluginRuntime extends VoidbrainPlugin {
	commands: Command[];
	loadData: Mock<() => Promise<unknown>>;
	saveData: Mock<(data: unknown) => Promise<void>>;
	getRegisteredCleanupCount(): number;
}

const createPlugin = (): MockedPluginRuntime => {
	return new VoidbrainPlugin(
		new MockApp() as unknown as App,
		{
			id: "voidbrain",
			name: "voidbrain",
			version: "0.1.0",
		} as PluginManifest,
	) as MockedPluginRuntime;
};

describe("VoidbrainPlugin lifecycle", () => {
	beforeEach(() => {
		resetObsidianMockState();
	});

	it("loads local-first default settings when no persisted settings exist", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue(undefined);

		await plugin.onload();

		expect(plugin.getSettings()).toEqual(DEFAULT_PLUGIN_SETTINGS);
		expect(plugin.getRuntimeStatus()).toEqual({
			isLoaded: true,
			ownedResourceCount: 1,
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "defaulted",
		});
		expect(plugin.commands).toHaveLength(1);
		expect(plugin.commands[0]?.id).toBe(SHOW_STATUS_COMMAND_ID);
		expect(plugin.getRegisteredCleanupCount()).toBe(1);
	});

	it("recovers malformed persisted settings to safe defaults", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue({
			schemaVersion: 1,
			privacyMode: "cloud-first",
			areCloudProvidersEnabled: "yes",
		});

		await plugin.onload();

		expect(plugin.getSettings()).toEqual(DEFAULT_PLUGIN_SETTINGS);
		expect(plugin.getRuntimeStatus()).toMatchObject({
			isLoaded: true,
			settingsLoadErrorCount: 2,
			settingsLoadStatus: "recovered",
		});
		expect(notices[0]?.message).toBe("voidbrain settings were reset to local-first defaults.");
	});

	it("merges valid persisted settings with local-first defaults", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue({
			schemaVersion: 1,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
			shouldShowStatusNotices: false,
		});

		await plugin.onload();
		plugin.commands[0]?.callback?.();

		expect(plugin.getSettings()).toEqual({
			...DEFAULT_PLUGIN_SETTINGS,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
			shouldShowStatusNotices: false,
		});
		expect(plugin.getRuntimeStatus()).toMatchObject({
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "loaded",
		});
		expect(notices[0]?.message).toBe(
			"voidbrain is running locally. Cloud provider workflows still require explicit review.",
		);
	});

	it("recovers malformed trusted provider settings to safe cloud defaults", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue({
			schemaVersion: 1,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID, 42],
		});

		await plugin.onload();

		expect(plugin.getSettings()).toEqual(DEFAULT_PLUGIN_SETTINGS);
		expect(plugin.getRuntimeStatus()).toMatchObject({
			settingsLoadErrorCount: 1,
			settingsLoadStatus: "recovered",
		});
		expect(notices[0]?.message).toBe("voidbrain settings were reset to local-first defaults.");
	});

	it("cleans up owned resources idempotently on unload", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue(undefined);

		await plugin.onload();
		plugin.onunload();
		plugin.onunload();

		expect(plugin.getRuntimeStatus()).toEqual({
			isLoaded: false,
			ownedResourceCount: 0,
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "defaulted",
		});
	});

	it("saves validated settings through Obsidian plugin storage", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue(undefined);
		plugin.saveData.mockResolvedValue(undefined);

		await plugin.onload();
		await plugin.saveSettings({
			...DEFAULT_PLUGIN_SETTINGS,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
		});

		expect(plugin.saveData).toHaveBeenCalledWith({
			...DEFAULT_PLUGIN_SETTINGS,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
		});
		expect(plugin.getSettings().areCloudProvidersEnabled).toBe(true);
	});
});
