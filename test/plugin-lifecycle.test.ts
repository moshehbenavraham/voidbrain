import type { App, PluginManifest } from "obsidian";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";
import VoidbrainPlugin from "../src/main";
import { TRUSTED_CLOUD_FIXTURE_PROVIDER_ID } from "../src/providers/provider-registry";
import { AGENT_COMMAND_IDS } from "../src/types/agent-commands";
import type { HotCacheSessionSummaryResult } from "../src/types/hot-cache";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID } from "../src/types/plugin";
import type { StagedChangeRecord } from "../src/types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../src/utils/vault-paths";
import { VOIDBRAIN_CHAT_VIEW_TYPE } from "../src/views/chat-view";
import { VOIDBRAIN_STATUS_VIEW_TYPE } from "../src/views/status-view";
import type { Command, PluginSettingTab, RibbonAction } from "./__mocks__/obsidian";
import { App as MockApp, TFile } from "./__mocks__/obsidian";
import { notices, resetObsidianMockState } from "./__mocks__/obsidian";
import {
	HOT_CACHE_FIXTURE_SOURCE_MARKDOWN,
	HOT_CACHE_FIXTURE_SOURCE_PATH,
	createHotCacheStateFixture,
} from "./fixtures/vault/hot-cache-fixtures";
import {
	RUNTIME_INDEXING_FIXTURE_FILES,
	configureRuntimeFixtureVault,
	createRuntimeFixtureFiles,
} from "./fixtures/vault/runtime-indexing-fixtures";
import {
	INGESTION_FIXTURE_MARKDOWN,
	INGESTION_FIXTURE_MARKDOWN_PATH,
} from "./fixtures/vault/source-ingestion-fixtures";
import {
	STAGED_REVIEW_CREATE_TARGET,
	STAGED_REVIEW_DELETE_TARGET,
	STAGED_REVIEW_FRONTMATTER_AFTER,
	STAGED_REVIEW_FRONTMATTER_TARGET,
	STAGED_REVIEW_MOVE_DESTINATION,
	STAGED_REVIEW_MOVE_TARGET,
	STAGED_REVIEW_UPDATE_AFTER,
	STAGED_REVIEW_UPDATE_TARGET,
	createStagedReviewFixtureRecords,
} from "./fixtures/vault/staged-change-review-fixtures";
import { loadVaultHealthRuntimeFixtureNotes } from "./fixtures/vault/vault-health-runtime-fixtures";

interface MockedPluginRuntime extends VoidbrainPlugin {
	commands: Command[];
	ribbonActions: RibbonAction[];
	settingTabs: PluginSettingTab[];
	loadData: Mock<() => Promise<unknown>>;
	saveData: Mock<(data: unknown) => Promise<void>>;
	getRegisteredCleanupCount(): number;
}

interface HotCacheRuntimeAccess {
	stageChatSessionSummary: () => Promise<HotCacheSessionSummaryResult>;
	ingestionStagedChanges: StagedChangeRecord[];
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

const runtimeIndexingNotes = RUNTIME_INDEXING_FIXTURE_FILES.filter(
	(file) => file.path === "sources/runtime-source.md" || file.path === "concepts/runtime-concept.md",
);

const flushPromises = async (count = 8): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const waitForCondition = async (predicate: () => boolean, count = 1000): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		if (predicate()) {
			return;
		}
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const seedStagedChanges = (plugin: MockedPluginRuntime, records: readonly StagedChangeRecord[]): void => {
	(plugin as unknown as { ingestionStagedChanges: StagedChangeRecord[] }).ingestionStagedChanges.push(...records);
};

const clickStageChangeCommand = async (plugin: MockedPluginRuntime): Promise<void> => {
	const stageCommand = plugin.commands.find((command) => command.id === "voidbrain.stage-change");
	stageCommand?.callback?.();
	await flushPromises();
};

const clickRecoverSessionCommand = async (plugin: MockedPluginRuntime): Promise<void> => {
	const recoveryCommand = plugin.commands.find((command) => command.id === "voidbrain.recover-session");
	recoveryCommand?.callback?.();
	await flushPromises();
};

const selectReviewGroup = (targetPath: string): void => {
	const button = [...document.body.querySelectorAll<HTMLButtonElement>("[data-group-id]")].find((candidate) =>
		candidate.textContent?.includes(targetPath),
	);
	button?.click();
};

const applyVisibleReviewGroup = async (confirmationText?: string): Promise<void> => {
	const input = document.body.querySelector<HTMLInputElement>("[data-confirmation-input='true']");
	if (input !== null && confirmationText !== undefined) {
		input.value = confirmationText;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}
	const applyButton = document.body.querySelector<HTMLButtonElement>("[data-review-action='apply']");
	applyButton?.click();
	await flushPromises(20);
	await waitForCondition(
		() => document.body.querySelector<HTMLButtonElement>("[data-review-action='refresh']")?.disabled === false,
	);
};

const configureVaultHealthFixtures = (app: MockApp): void => {
	for (const note of loadVaultHealthRuntimeFixtureNotes()) {
		app.vault.setReadContent(note.path, note.content);
	}
};

const configureHotCacheSupportRecord = (app: MockApp): void => {
	app.vault.setReadContent(HOT_CACHE_FIXTURE_SOURCE_PATH, HOT_CACHE_FIXTURE_SOURCE_MARKDOWN);
	app.vault.setReadContent(HOT_CACHE_SUPPORT_PATH, JSON.stringify(createHotCacheStateFixture()));
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
			ownedResourceCount: 13,
			registeredCommandCount: AGENT_COMMAND_IDS.length + 1,
			ribbonActionCount: 1,
			registeredViewCount: 2,
			settingsTabCount: 1,
			settingsLoadErrorCount: 0,
			settingsLoadStatus: "defaulted",
		});
		expect(plugin.commands).toHaveLength(AGENT_COMMAND_IDS.length + 1);
		expect(plugin.commands[0]?.id).toBe(SHOW_STATUS_COMMAND_ID);
		expect(plugin.commands.map((command) => command.id)).toEqual([SHOW_STATUS_COMMAND_ID, ...AGENT_COMMAND_IDS]);
		expect(plugin.ribbonActions).toHaveLength(1);
		expect(plugin.settingTabs).toHaveLength(1);
		expect(plugin.getRegisteredCleanupCount()).toBe(13);
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

	it("registers ribbon, status view, chat view, settings tab, and cleans view leaves on unload", async () => {
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

		expect(plugin.getRuntimeStatusSnapshot().items).toHaveLength(5);
		expect(app.workspace.getLeavesOfType(VOIDBRAIN_STATUS_VIEW_TYPE)).toHaveLength(1);
		expect(plugin.settingTabs[0]?.containerEl.childElementCount).toBe(0);

		plugin.settingTabs[0]?.display();
		expect(plugin.settingTabs[0]?.containerEl.childElementCount).toBeGreaterThan(0);

		plugin.onunload();
		expect(app.workspace.detachedViewTypes).toContain(VOIDBRAIN_STATUS_VIEW_TYPE);
		expect(app.workspace.detachedViewTypes).toContain(VOIDBRAIN_CHAT_VIEW_TYPE);
		expect(plugin.getRuntimeStatus()).toMatchObject({
			isLoaded: false,
			registeredCommandCount: 0,
			ribbonActionCount: 0,
			registeredViewCount: 0,
			settingsTabCount: 0,
		});
	});

	it("runs lexical indexing on startup only when the opt-in setting is enabled", async () => {
		const app = new MockApp();
		configureRuntimeFixtureVault(app.vault, runtimeIndexingNotes);
		const plugin = new VoidbrainPlugin(
			app as unknown as App,
			{
				id: "voidbrain",
				name: "voidbrain",
				version: "0.1.0",
			} as PluginManifest,
		) as MockedPluginRuntime;
		plugin.loadData.mockResolvedValue({
			...DEFAULT_PLUGIN_SETTINGS,
			indexing: {
				...DEFAULT_PLUGIN_SETTINGS.indexing,
				shouldIndexOnStartup: true,
			},
		});

		await plugin.onload();
		await flushPromises();

		const indexingState = plugin.getIndexingRuntimeState();
		expect(indexingState?.lexicalReport.status).toBe("ready");
		expect(indexingState?.lexicalIndex?.sources).toHaveLength(2);
		expect(plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "index-readiness")).toMatchObject({
			severity: "ready",
		});
	});

	it("wires settings tab indexing actions into the runtime service", async () => {
		const app = new MockApp();
		configureRuntimeFixtureVault(app.vault, runtimeIndexingNotes);
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
		const settingsTab = plugin.settingTabs[0];
		settingsTab?.display();
		const reindexButton = [...(settingsTab?.containerEl.querySelectorAll("button") ?? [])].find(
			(button) => button.textContent === "Reindex",
		);
		reindexButton?.click();
		await flushPromises();

		expect(plugin.getIndexingRuntimeState()?.lexicalReport.status).toBe("ready");
		expect(notices.at(-1)?.message).toContain("Lexical index");
	});

	it("cancels in-flight indexing and clears runtime state on unload", async () => {
		const app = new MockApp();
		const files = createRuntimeFixtureFiles(runtimeIndexingNotes);
		const firstContent = runtimeIndexingNotes[0]?.content ?? "# Runtime Source";
		let releaseRead: (() => void) | undefined;
		app.vault.setFiles(files);
		app.vault.read.mockImplementation(
			async () =>
				new Promise<string>((resolve) => {
					releaseRead = () => resolve(firstContent);
				}),
		);
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
		const settingsTab = plugin.settingTabs[0];
		settingsTab?.display();
		const reindexButton = [...(settingsTab?.containerEl.querySelectorAll("button") ?? [])].find(
			(button) => button.textContent === "Reindex",
		);
		reindexButton?.click();
		await Promise.resolve();

		expect(plugin.getIndexingRuntimeState()?.lexicalReport.status).toBe("building");

		plugin.onunload();
		expect(plugin.getIndexingRuntimeState()).toBeNull();
		expect(plugin.getRuntimeStatus()).toMatchObject({
			isLoaded: false,
			ownedResourceCount: 0,
		});

		releaseRead?.();
		await Promise.resolve();
		await Promise.resolve();
	});

	it("opens chat command, reports provider denial, and avoids direct vault writes", async () => {
		const app = new MockApp();
		configureRuntimeFixtureVault(app.vault, runtimeIndexingNotes);
		const plugin = new VoidbrainPlugin(
			app as unknown as App,
			{
				id: "voidbrain",
				name: "voidbrain",
				version: "0.1.0",
			} as PluginManifest,
		) as MockedPluginRuntime;
		plugin.loadData.mockResolvedValue({
			...DEFAULT_PLUGIN_SETTINGS,
			indexing: {
				...DEFAULT_PLUGIN_SETTINGS.indexing,
				shouldIndexOnStartup: true,
			},
		});

		await plugin.onload();
		await flushPromises();
		const chatCommand = plugin.commands.find((command) => command.id === "voidbrain.chat-with-vault");
		chatCommand?.callback?.();
		await flushPromises();

		const chatLeaf = app.workspace.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0];
		expect(chatLeaf).toBeDefined();
		expect(notices.at(-1)?.message).toContain("Grounded vault chat opened");

		const textarea = chatLeaf?.view?.containerEl.querySelector("textarea");
		if (!(textarea instanceof HTMLTextAreaElement)) {
			throw new Error("Expected chat composer textarea");
		}
		textarea.value = "How does local indexing support deterministic retrieval tests?";
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();
		const form = app.workspace
			.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]
			?.view?.containerEl.querySelector("form");
		form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await flushPromises();

		expect(notices.at(-1)?.message).toContain("Provider role is not selected.");
		expect(app.vault.adapter.write.mock.calls.every(([path]) => path === HOT_CACHE_SUPPORT_PATH)).toBe(true);
		expect(app.workspace.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]?.view?.containerEl.textContent).toContain(
			"Provider role is not selected.",
		);
	});

	it("loads hot cache support records and restores chat draft context after reload", async () => {
		const app = new MockApp();
		configureHotCacheSupportRecord(app);
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
		const hotCacheItem = plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "hot-cache-readiness");
		expect(hotCacheItem).toMatchObject({
			severity: "ready",
			count: 5,
		});

		const chatCommand = plugin.commands.find((command) => command.id === "voidbrain.chat-with-vault");
		chatCommand?.callback?.();
		await flushPromises();
		const textarea = app.workspace
			.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]
			?.view?.containerEl.querySelector("textarea");

		expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
		expect((textarea as HTMLTextAreaElement).value).toContain("Summarize the synthetic hot cache");
	});

	it("stages a restored chat session summary without direct vault writes", async () => {
		const app = new MockApp();
		configureHotCacheSupportRecord(app);
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
		const runtime = plugin as unknown as HotCacheRuntimeAccess;
		const result = await runtime.stageChatSessionSummary();
		await flushPromises();

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected restored chat summary staging to succeed.");
		}
		expect(result.stagedChange.status).toBe("review-ready");
		expect(runtime.ingestionStagedChanges.map((record) => record.changeId)).toContain(result.stagedChange.changeId);
		expect(app.vault.create).not.toHaveBeenCalledWith(
			expect.stringContaining("conversations/"),
			expect.any(String),
		);
		expect(app.vault.adapter.write).toHaveBeenCalledWith(
			HOT_CACHE_SUPPORT_PATH,
			expect.stringContaining("stage-create-note"),
		);
	});

	it("runs recovery command as a read-only support-record summary", async () => {
		const app = new MockApp();
		configureHotCacheSupportRecord(app);
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
		await clickRecoverSessionCommand(plugin);
		await waitForCondition(() => notices.some((notice) => notice.message.includes("Session recovery ready")));

		expect(notices.some((notice) => notice.message.includes("No providers were called"))).toBe(true);
		expect(notices.some((notice) => notice.message.includes("No vault files were changed"))).toBe(true);
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
		expect(app.vault.create).not.toHaveBeenCalled();
		expect(app.vault.modify).not.toHaveBeenCalled();
	});

	it("reports malformed recovery support records without direct vault writes", async () => {
		const app = new MockApp();
		app.vault.setReadContent(HOT_CACHE_SUPPORT_PATH, "{malformed");
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
		await clickRecoverSessionCommand(plugin);
		await waitForCondition(() => notices.some((notice) => notice.message.includes("Session recovery invalid")));

		expect(notices.some((notice) => notice.message.includes("No vault files were changed"))).toBe(true);
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
		expect(app.vault.create).not.toHaveBeenCalled();
		expect(app.vault.modify).not.toHaveBeenCalled();
	});

	it("prevents duplicate recovery command execution while adapter reads are in flight", async () => {
		const app = new MockApp();
		configureHotCacheSupportRecord(app);
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

		let releaseRead: (() => void) | undefined;
		app.vault.adapter.read.mockImplementation(
			async (path: string) =>
				new Promise<string>((resolve) => {
					if (path === HOT_CACHE_SUPPORT_PATH) {
						releaseRead = () => resolve(JSON.stringify(createHotCacheStateFixture()));
						return;
					}
					resolve("");
				}),
		);

		const recoveryCommand = plugin.commands.find((command) => command.id === "voidbrain.recover-session");
		recoveryCommand?.callback?.();
		await flushPromises(1);
		recoveryCommand?.callback?.();
		await flushPromises(1);

		expect(notices.some((notice) => notice.message.includes("already running"))).toBe(true);

		releaseRead?.();
		await flushPromises(10);
		await waitForCondition(() => notices.some((notice) => notice.message.includes("Session recovery ready")));
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});

	it("opens source ingestion command, stages generated changes, and avoids direct vault writes", async () => {
		const app = new MockApp();
		const sourceFile = new TFile(INGESTION_FIXTURE_MARKDOWN_PATH);
		app.vault.setFiles([sourceFile]);
		app.vault.setReadContent(INGESTION_FIXTURE_MARKDOWN_PATH, INGESTION_FIXTURE_MARKDOWN);
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
		const ingestCommand = plugin.commands.find((command) => command.id === "voidbrain.ingest-source");
		ingestCommand?.callback?.();
		await flushPromises();

		const pathInput = document.body.querySelector<HTMLInputElement>("[data-source-field='path']");
		if (pathInput === null) {
			throw new Error("Expected source ingestion path input");
		}
		pathInput.value = INGESTION_FIXTURE_MARKDOWN_PATH;
		pathInput.dispatchEvent(new Event("input", { bubbles: true }));
		document.body.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await waitForCondition(() => document.body.textContent?.includes("Synthetic Source Ingestion Demo") === true);

		expect(document.body.textContent).toContain("Synthetic Source Ingestion Demo");
		const stageButton = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
			(button) => button.textContent === "Stage",
		);
		stageButton?.click();
		await waitForCondition(() => document.body.textContent?.includes("Staged changes:") === true);

		expect(notices.some((notice) => notice.message.includes("Source ingestion staged"))).toBe(true);
		expect(document.body.textContent).toContain("Staged changes:");
		expect(app.vault.adapter.write.mock.calls.every(([path]) => path === HOT_CACHE_SUPPORT_PATH)).toBe(true);
		expect(
			plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "staged-change-readiness"),
		).toBeDefined();
	});

	it("opens health command, exports report, stages safe repair, and avoids direct note writes", async () => {
		const app = new MockApp();
		configureVaultHealthFixtures(app);
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
		const healthCommand = plugin.commands.find((command) => command.id === "voidbrain.health-check");
		healthCommand?.callback?.();
		await waitForCondition(() => document.body.textContent?.includes("Vault health") === true);
		await waitForCondition(() => document.body.textContent?.includes("missing-citation") === true);

		document.body.querySelector<HTMLButtonElement>("[data-health-action='export']")?.click();
		await waitForCondition(() => document.body.textContent?.includes(".voidbrain/reports/") === true);
		expect(app.vault.adapter.write).toHaveBeenCalledWith(
			expect.stringContaining(".voidbrain/reports/"),
			expect.stringContaining("# Vault Health Report"),
		);

		[...document.body.querySelectorAll<HTMLButtonElement>("[data-health-group-id]")]
			.find((button) => button.textContent?.includes("missing-citation"))
			?.click();
		await flushPromises();
		document.body.querySelector<HTMLButtonElement>("[data-health-stage-finding]")?.click();
		await waitForCondition(() => document.body.textContent?.includes("Staged repair:") === true);

		expect(app.vault.modify).not.toHaveBeenCalled();
		expect(app.vault.create).not.toHaveBeenCalledWith(expect.stringContaining("summaries/"), expect.any(String));
		expect(plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "health-readiness")).toMatchObject({
			severity: "error",
		});
		expect(
			plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "staged-change-readiness"),
		).toMatchObject({
			severity: "warning",
		});
	});

	it("opens staged review command and applies a synthetic create with index refresh", async () => {
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
		const records = await createStagedReviewFixtureRecords();
		seedStagedChanges(
			plugin,
			records.filter((record) => record.operationKind === "create-note"),
		);

		await plugin.onload();
		await clickStageChangeCommand(plugin);
		await waitForCondition(() => document.body.textContent?.includes(STAGED_REVIEW_CREATE_TARGET) === true);
		await applyVisibleReviewGroup();

		expect(app.vault.getReadContent(STAGED_REVIEW_CREATE_TARGET)).toContain("Synthetic staged review content.");
		expect(notices.some((notice) => notice.message.includes("Staged changes applied"))).toBe(true);
		expect(
			plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "staged-change-readiness"),
		).toMatchObject({
			severity: "ready",
		});
	});

	it("applies update, frontmatter edit, delete backup, and move backup through Obsidian APIs", async () => {
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
		const records = await createStagedReviewFixtureRecords();
		for (const record of records) {
			if (record.diff.beforeContent !== undefined) {
				app.vault.setReadContent(record.targetPath, record.diff.beforeContent);
			}
		}
		seedStagedChanges(
			plugin,
			records
				.filter((record) =>
					["update-note", "update-frontmatter", "delete-note", "move-note"].includes(record.operationKind),
				)
				.filter((record) => record.status === "review-ready"),
		);

		await plugin.onload();
		await clickStageChangeCommand(plugin);
		await waitForCondition(() => document.body.textContent?.includes(STAGED_REVIEW_UPDATE_TARGET) === true);

		selectReviewGroup(STAGED_REVIEW_UPDATE_TARGET);
		await applyVisibleReviewGroup(`APPLY OVERWRITE ${STAGED_REVIEW_UPDATE_TARGET}`);
		expect(app.vault.getReadContent(STAGED_REVIEW_UPDATE_TARGET)).toBe(STAGED_REVIEW_UPDATE_AFTER);

		selectReviewGroup(STAGED_REVIEW_FRONTMATTER_TARGET);
		await applyVisibleReviewGroup(`APPLY OVERWRITE ${STAGED_REVIEW_FRONTMATTER_TARGET}`);
		expect(app.vault.getReadContent(STAGED_REVIEW_FRONTMATTER_TARGET)).toBe(STAGED_REVIEW_FRONTMATTER_AFTER);

		selectReviewGroup(STAGED_REVIEW_DELETE_TARGET);
		await applyVisibleReviewGroup(`APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`);
		expect(app.vault.pathExists(STAGED_REVIEW_DELETE_TARGET)).toBe(false);
		expect(app.vault.adapter.write).toHaveBeenCalledWith(
			expect.stringContaining(".voidbrain/staged-changes/"),
			expect.stringContaining("Synthetic content that can be backed up before deletion."),
		);

		selectReviewGroup(STAGED_REVIEW_MOVE_TARGET);
		await applyVisibleReviewGroup(`APPLY DESTRUCTIVE ${STAGED_REVIEW_MOVE_TARGET}`);
		expect(app.vault.pathExists(STAGED_REVIEW_MOVE_TARGET)).toBe(false);
		expect(app.vault.pathExists(STAGED_REVIEW_MOVE_DESTINATION)).toBe(true);
	});

	it("keeps destructive target intact when backup support write fails", async () => {
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
		const records = await createStagedReviewFixtureRecords();
		const deleteRecord = records.find((record) => record.operationKind === "delete-note");
		if (deleteRecord === undefined || deleteRecord.diff.beforeContent === undefined) {
			throw new Error("Expected synthetic delete record.");
		}
		app.vault.setReadContent(deleteRecord.targetPath, deleteRecord.diff.beforeContent);
		if (deleteRecord.recovery.backupPathIntent !== undefined) {
			app.vault.setAdapterWriteFailure(deleteRecord.recovery.backupPathIntent);
		}
		seedStagedChanges(plugin, [deleteRecord]);

		await plugin.onload();
		await clickStageChangeCommand(plugin);
		await waitForCondition(() => document.body.textContent?.includes(STAGED_REVIEW_DELETE_TARGET) === true);
		await applyVisibleReviewGroup(`APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`);

		expect(app.vault.pathExists(STAGED_REVIEW_DELETE_TARGET)).toBe(true);
		expect(
			plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "staged-change-readiness"),
		).toMatchObject({
			severity: "error",
		});
		expect(notices.some((notice) => notice.message.includes("failed during apply"))).toBe(true);
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
