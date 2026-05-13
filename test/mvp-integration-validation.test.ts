import type { App, PluginManifest } from "obsidian";
import { describe, expect, it } from "vitest";
import VoidbrainPlugin from "../src/main";
import { LOCAL_FIXTURE_PROVIDER_ID, makeProviderModelId } from "../src/providers";
import type { HotCacheSessionSummaryResult } from "../src/types/hot-cache";
import type { SourceIngestionIntakeRequest, SourceIngestionStageResult } from "../src/types/ingestion";
import { DEFAULT_PLUGIN_SETTINGS } from "../src/types/plugin";
import type { RuntimeStatusSnapshot } from "../src/types/runtime";
import type { StagedChangeRecord } from "../src/types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../src/utils/vault-paths";
import { VOIDBRAIN_CHAT_VIEW_TYPE } from "../src/views/chat-view";
import type { Command } from "./__mocks__/obsidian";
import { App as MockApp, resetObsidianMockState } from "./__mocks__/obsidian";
import { RUNTIME_INDEXING_FIXTURE_FILES } from "./fixtures/vault/runtime-indexing-fixtures";
import {
	INGESTION_FIXTURE_MARKDOWN,
	INGESTION_FIXTURE_MARKDOWN_PATH,
} from "./fixtures/vault/source-ingestion-fixtures";
import { loadVaultHealthRuntimeFixtureNotes } from "./fixtures/vault/vault-health-runtime-fixtures";

interface MvpPluginRuntime {
	commands: Command[];
	loadData: ReturnType<typeof vi.fn>;
	onload: () => Promise<void>;
	onunload: () => void;
	getRuntimeStatusSnapshot: () => RuntimeStatusSnapshot;
	stageChatSessionSummary: () => Promise<HotCacheSessionSummaryResult>;
	runVaultHealthScan: (service: unknown) => Promise<{ readonly ok: boolean }>;
	healthService: unknown;
	ingestionStagingService: {
		readonly stageSource: (request: SourceIngestionIntakeRequest) => Promise<SourceIngestionStageResult>;
	};
	ingestionStagedChanges: StagedChangeRecord[];
}

const createPlugin = (app: MockApp): MvpPluginRuntime =>
	new VoidbrainPlugin(
		app as unknown as App,
		{
			id: "voidbrain",
			name: "voidbrain",
			version: "0.1.0",
		} as PluginManifest,
	) as unknown as MvpPluginRuntime;

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

const configureMvpVault = (app: MockApp): void => {
	for (const fixture of RUNTIME_INDEXING_FIXTURE_FILES.filter(
		(file) => file.path === "sources/runtime-source.md" || file.path === "concepts/runtime-concept.md",
	)) {
		app.vault.setReadContent(fixture.path, fixture.content);
	}

	app.vault.setReadContent(INGESTION_FIXTURE_MARKDOWN_PATH, INGESTION_FIXTURE_MARKDOWN);
	for (const note of loadVaultHealthRuntimeFixtureNotes()) {
		app.vault.setReadContent(note.path, note.content);
	}
};

const runCommand = async (plugin: MvpPluginRuntime, commandId: string): Promise<void> => {
	const command = plugin.commands.find((candidate) => candidate.id === commandId);
	if (command === undefined) {
		throw new Error(`Missing command ${commandId}.`);
	}

	command.callback?.();
	await flushPromises();
};

const stageSourceIngestion = async (plugin: MvpPluginRuntime, app: MockApp): Promise<void> => {
	const result = await plugin.ingestionStagingService.stageSource({
		input: {
			kind: "markdown-file",
			path: INGESTION_FIXTURE_MARKDOWN_PATH,
			content: INGESTION_FIXTURE_MARKDOWN,
			providerMode: "none",
		},
		existingNotes: app.vault
			.getFiles()
			.filter((file) => file.path.endsWith(".md"))
			.map((file) => ({ path: file.path, content: "" })),
		existingStagedChanges: plugin.ingestionStagedChanges,
	});
	if (!result.ok) {
		throw new Error(result.message);
	}

	plugin.ingestionStagedChanges.push(...result.stagedChanges);
};

const submitChatQuestion = async (app: MockApp): Promise<void> => {
	const textarea = app.workspace
		.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]
		?.view?.containerEl.querySelector("textarea");
	if (!(textarea instanceof HTMLTextAreaElement)) {
		throw new Error("Expected chat textarea.");
	}

	textarea.value = "How does runtime indexing support deterministic retrieval tests?";
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
	await flushPromises();
	app.workspace
		.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]
		?.view?.containerEl.querySelector("form")
		?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	await flushPromises(20);
};

const applyFirstStagedReviewGroup = async (): Promise<void> => {
	await waitForCondition(
		() => document.body.querySelector<HTMLButtonElement>("[data-review-action='apply']") !== null,
	);
	document.body.querySelector<HTMLButtonElement>("[data-review-action='apply']")?.click();
	await flushPromises(20);
};

describe("Phase 01 MVP integration validation", () => {
	it("runs provider, index, chat, ingestion, staged review, health, hot cache, and reload recovery with fixtures", async () => {
		resetObsidianMockState();
		const app = new MockApp();
		configureMvpVault(app);
		const plugin = createPlugin(app);
		plugin.loadData.mockResolvedValue({
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
				shouldIndexOnStartup: true,
			},
		});

		await plugin.onload();
		await flushPromises(20);
		expect(plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "provider-readiness")).toMatchObject({
			severity: "ready",
		});
		expect(plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "index-readiness")).toMatchObject({
			severity: "ready",
		});

		await runCommand(plugin, "voidbrain.chat-with-vault");
		await submitChatQuestion(app);
		expect(app.workspace.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]?.view?.containerEl.textContent).toContain(
			"Provider chat invocation is not configured.",
		);

		await stageSourceIngestion(plugin, app);
		expect(plugin.ingestionStagedChanges.length).toBeGreaterThan(0);

		const healthResult = await plugin.runVaultHealthScan(plugin.healthService);
		expect(healthResult.ok).toBe(true);
		expect(plugin.getRuntimeStatusSnapshot().items.find((item) => item.id === "health-readiness")).toMatchObject({
			severity: "error",
		});

		await runCommand(plugin, "voidbrain.stage-change");
		await applyFirstStagedReviewGroup();
		expect(app.vault.create).toHaveBeenCalled();

		const summary = await plugin.stageChatSessionSummary();
		expect(summary.ok).toBe(true);
		await waitForCondition(
			() => app.vault.getReadContent(HOT_CACHE_SUPPORT_PATH)?.includes("chat-thread-default") === true,
		);
		expect(app.vault.adapter.write).toHaveBeenCalledWith(
			HOT_CACHE_SUPPORT_PATH,
			expect.stringContaining("hot-cache"),
		);
		expect(app.vault.getReadContent(HOT_CACHE_SUPPORT_PATH)).toContain("chat-thread-default");

		plugin.onunload();
		const reloaded = createPlugin(app);
		reloaded.loadData.mockResolvedValue(undefined);
		await reloaded.onload();
		await runCommand(reloaded, "voidbrain.chat-with-vault");
		const restoredTextarea = app.workspace
			.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0]
			?.view?.containerEl.querySelector("textarea");
		expect((restoredTextarea as HTMLTextAreaElement | null)?.value).toContain("How does runtime indexing support");
	});
});
