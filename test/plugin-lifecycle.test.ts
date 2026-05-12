import type { App, PluginManifest } from "obsidian";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";
import VoidbrainPlugin from "../src/main";
import { TRUSTED_CLOUD_FIXTURE_PROVIDER_ID } from "../src/providers/provider-registry";
import { AGENT_COMMAND_IDS } from "../src/types/agent-commands";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID } from "../src/types/plugin";
import { VOIDBRAIN_STATUS_VIEW_TYPE } from "../src/views/status-view";
import type { Command, PluginSettingTab, RibbonAction } from "./__mocks__/obsidian";
import { App as MockApp } from "./__mocks__/obsidian";
import { notices, resetObsidianMockState } from "./__mocks__/obsidian";

interface MockedPluginRuntime extends VoidbrainPlugin {
	commands: Command[];
	ribbonActions: RibbonAction[];
	settingTabs: PluginSettingTab[];
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
			ownedResourceCount: 12,
			registeredCommandCount: AGENT_COMMAND_IDS.length + 1,
			ribbonActionCount: 1,
			registeredViewCount: 1,
			settingsTabCount: 1,
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "defaulted",
		});
		expect(plugin.commands).toHaveLength(AGENT_COMMAND_IDS.length + 1);
		expect(plugin.commands[0]?.id).toBe(SHOW_STATUS_COMMAND_ID);
		expect(plugin.commands.map((command) => command.id)).toEqual([SHOW_STATUS_COMMAND_ID, ...AGENT_COMMAND_IDS]);
		expect(plugin.ribbonActions).toHaveLength(1);
		expect(plugin.settingTabs).toHaveLength(1);
		expect(plugin.getRegisteredCleanupCount()).toBe(12);
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
		expect(notices[0]?.message).toContain("Cloud provider workflows still require explicit review.");
		expect(notices[0]?.message).toContain("Readiness:");
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
			registeredCommandCount: 0,
			ribbonActionCount: 0,
			registeredViewCount: 0,
			settingsTabCount: 0,
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "defaulted",
		});
	});

	it("registers ribbon, status view, settings tab, and cleans view leaves on unload", async () => {
		const app = new MockApp();
		const plugin = new VoidbrainPlugin(
			app as unknown as App,
			{
				id: "voidbrain",
				name: "voidbrain",
				version: "0.1.0",
			} as PluginManifest,
		) as MockedPluginRuntime;
		plugin.loadData.mockResolvedValue(undefined);

		await plugin.onload();
		plugin.ribbonActions[0]?.callback(new MouseEvent("click"));
		await Promise.resolve();
		await Promise.resolve();

		expect(plugin.getRuntimeStatusSnapshot().items).toHaveLength(4);
		expect(app.workspace.getLeavesOfType(VOIDBRAIN_STATUS_VIEW_TYPE)).toHaveLength(1);
		expect(plugin.settingTabs[0]?.containerEl.childElementCount).toBe(0);

		plugin.settingTabs[0]?.display();
		expect(plugin.settingTabs[0]?.containerEl.childElementCount).toBeGreaterThan(0);

		plugin.onunload();
		expect(app.workspace.detachedViewTypes).toContain(VOIDBRAIN_STATUS_VIEW_TYPE);
		expect(plugin.getRuntimeStatus()).toMatchObject({
			isLoaded: false,
			registeredCommandCount: 0,
			ribbonActionCount: 0,
			registeredViewCount: 0,
			settingsTabCount: 0,
		});
	});

	it("shows explicit local-first placeholder notices for planned catalog commands", async () => {
		const plugin = createPlugin();
		plugin.loadData.mockResolvedValue(undefined);

		await plugin.onload();
		const chatCommand = plugin.commands.find((command) => command.id === "voidbrain.chat-with-vault");
		chatCommand?.callback?.();

		expect(notices[0]?.message).toContain("Grounded vault chat is not ready yet.");
		expect(notices[0]?.message).toContain("Provider review remains required.");
		expect(notices[0]?.message).not.toContain("sk-");
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
