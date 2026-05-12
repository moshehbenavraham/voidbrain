import { Notice, Plugin, type TFile } from "obsidian";
import "./styles.css";
import { createRuntimeCommandHandlers, createRuntimeStatusSnapshot } from "./agent";
import {
	buildProviderDefinitionsForSettings,
	createInMemoryProviderSecretStore,
	summarizeProviderRoleCapabilities,
	summarizeProviderSetup,
} from "./providers";
import { BASELINE_PROVIDERS } from "./providers/provider-registry";
import { type RuntimeStatusStore, createRuntimeStatusStore } from "./stores/runtime-status-store";
import type { IndexingRuntimeState } from "./types/indexing-runtime";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID, type VoidbrainPluginSettings } from "./types/plugin";
import type { RuntimeCommandOutcome, RuntimeStatusSnapshot } from "./types/runtime";
import {
	type SettingsLoadStatus,
	type SettingsValidationError,
	loadPluginSettings,
	savePluginSettings,
} from "./utils/settings";
import { IndexingRuntimeService, createObsidianMarkdownIndexSource } from "./vectorstore";
import { VoidbrainSettingsTab } from "./views/settings-tab";
import { VOIDBRAIN_STATUS_VIEW_TYPE, VoidbrainStatusView } from "./views/status-view";

type CleanupCallback = () => void;

interface PluginRuntimeStatus {
	isLoaded: boolean;
	ownedResourceCount: number;
	registeredCommandCount: number;
	ribbonActionCount: number;
	registeredViewCount: number;
	settingsTabCount: number;
	settingsLoadErrorCount: number;
	settingsLoadStatus: SettingsLoadStatus;
}

export default class VoidbrainPlugin extends Plugin {
	private readonly cleanupCallbacks: CleanupCallback[] = [];
	private readonly registeredCommandIds: string[] = [];
	private readonly registeredViewTypes: string[] = [];
	private isRuntimeLoaded = false;
	private settings: VoidbrainPluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
	private settingsLoadErrors: SettingsValidationError[] = [];
	private settingsLoadStatus: SettingsLoadStatus = "defaulted";
	private readonly providerSecretStore = createInMemoryProviderSecretStore();
	private indexingRuntime: IndexingRuntimeService | null = null;
	private unsubscribeFromIndexingRuntime: CleanupCallback | null = null;
	private ribbonActionCount = 0;
	private settingsTabCount = 0;
	private runtimeStatusSnapshot: RuntimeStatusSnapshot = createRuntimeStatusSnapshot({
		settings: DEFAULT_PLUGIN_SETTINGS,
		providers: BASELINE_PROVIDERS,
		now: new Date(0),
	});
	private runtimeStatusStore: RuntimeStatusStore = createRuntimeStatusStore(this.runtimeStatusSnapshot);

	override async onload(): Promise<void> {
		const settingsLoadResult = await loadPluginSettings(this);
		this.settings = settingsLoadResult.settings;
		this.settingsLoadErrors = settingsLoadResult.errors;
		this.settingsLoadStatus = settingsLoadResult.status;
		this.createIndexingRuntime();
		this.refreshRuntimeStatusSnapshot();
		this.isRuntimeLoaded = true;

		if (this.settings.shouldShowStatusNotices && settingsLoadResult.status === "recovered") {
			new Notice("voidbrain settings were reset to local-first defaults.", 5000);
		}

		this.registerStatusCommand();
		this.registerCatalogCommands();
		this.registerStatusView();
		this.registerRibbonAction();
		this.registerSettingsTab();
		this.startIndexingOnStartup();

		this.registerOwnedCleanup(() => {
			this.unsubscribeFromIndexingRuntime?.();
			this.unsubscribeFromIndexingRuntime = null;
			this.indexingRuntime?.dispose();
			this.indexingRuntime = null;
			this.isRuntimeLoaded = false;
			this.runtimeStatusStore.clear();
		});
	}

	override onunload(): void {
		this.runOwnedCleanups();
	}

	getRuntimeStatus(): PluginRuntimeStatus {
		return {
			isLoaded: this.isRuntimeLoaded,
			ownedResourceCount: this.cleanupCallbacks.length,
			registeredCommandCount: this.registeredCommandIds.length,
			ribbonActionCount: this.ribbonActionCount,
			registeredViewCount: this.registeredViewTypes.length,
			settingsTabCount: this.settingsTabCount,
			settingsLoadErrorCount: this.settingsLoadErrors.length,
			settingsLoadStatus: this.settingsLoadStatus,
		};
	}

	getSettings(): VoidbrainPluginSettings {
		return clonePluginSettings(this.settings);
	}

	getRuntimeStatusSnapshot(): RuntimeStatusSnapshot {
		return this.runtimeStatusSnapshot;
	}

	getIndexingRuntimeState(): IndexingRuntimeState | null {
		return this.indexingRuntime?.getState() ?? null;
	}

	async saveSettings(settings: VoidbrainPluginSettings): Promise<void> {
		this.settings = await savePluginSettings(this, settings);
		this.indexingRuntime?.refreshReadiness();
		this.refreshRuntimeStatusSnapshot();
	}

	private refreshRuntimeStatusSnapshot(): RuntimeStatusSnapshot {
		const providers = buildProviderDefinitionsForSettings(this.settings, BASELINE_PROVIDERS);
		const indexingState = this.indexingRuntime?.getState() ?? null;
		const lexicalReport = indexingState?.lexicalReport ?? null;
		this.runtimeStatusSnapshot = createRuntimeStatusSnapshot({
			settings: this.settings,
			providers,
			providerSetup: summarizeProviderSetup(this.settings, providers),
			providerRoleCapabilities: summarizeProviderRoleCapabilities(this.settings, providers),
			...(lexicalReport === null ? {} : { indexReports: [lexicalReport] }),
			...(lexicalReport?.progress === undefined || lexicalReport.progress === null
				? {}
				: { indexProgress: [lexicalReport.progress] }),
			...(lexicalReport?.freshness === undefined || lexicalReport.freshness === null
				? {}
				: { indexFreshness: [lexicalReport.freshness] }),
			...(indexingState === null ? {} : { semanticIndexReadiness: indexingState.semanticReadiness }),
			...(lexicalReport === null || lexicalReport.failedPaths.length === 0
				? {}
				: { recentIndexFailures: lexicalReport.failedPaths }),
		});
		this.runtimeStatusStore.setSnapshot(this.runtimeStatusSnapshot);

		return this.runtimeStatusSnapshot;
	}

	private createIndexingRuntime(): void {
		const source = createObsidianMarkdownIndexSource({
			vault: {
				getFiles: () => this.app.vault.getFiles(),
				read: (file) => this.app.vault.read(file as TFile),
			},
			metadataCache: {
				getFileCache: (file) => this.app.metadataCache.getFileCache(file as TFile),
			},
		});
		this.indexingRuntime = new IndexingRuntimeService({
			source,
			getSettings: () => this.settings,
			getProviders: () => buildProviderDefinitionsForSettings(this.settings, BASELINE_PROVIDERS),
		});
		this.unsubscribeFromIndexingRuntime = this.indexingRuntime.subscribe(() => {
			this.refreshRuntimeStatusSnapshot();
		});
	}

	private startIndexingOnStartup(): void {
		if (!this.settings.indexing.shouldIndexOnStartup || this.indexingRuntime === null) {
			return;
		}

		void this.indexingRuntime.reindexLexical().then((result) => {
			if (!result.accepted || !this.settings.shouldShowStatusNotices) {
				return;
			}

			new Notice(result.message, 5000);
		});
	}

	private registerStatusCommand(): void {
		this.addCommand({
			id: SHOW_STATUS_COMMAND_ID,
			name: "Show local-first status",
			callback: () => {
				const providerStatus = this.settings.areCloudProvidersEnabled
					? "Cloud provider workflows still require explicit review."
					: "Cloud provider workflows are disabled.";
				const statusSnapshot = this.refreshRuntimeStatusSnapshot();

				void this.openStatusView();
				new Notice(
					`voidbrain is running locally. ${providerStatus} Readiness: ${statusSnapshot.overallSeverity}.`,
					5000,
				);
			},
		});
		this.trackCommandRegistration(SHOW_STATUS_COMMAND_ID);
	}

	private registerCatalogCommands(): void {
		const handlers = createRuntimeCommandHandlers({
			getSettings: () => this.getSettings(),
			getStatusSnapshot: () => this.refreshRuntimeStatusSnapshot(),
		});

		for (const handler of handlers) {
			this.addCommand({
				id: handler.command.id,
				name: handler.command.name,
				callback: () => {
					this.showCommandOutcome(handler.run());
				},
			});
			this.trackCommandRegistration(handler.command.id);
		}
	}

	private registerStatusView(): void {
		this.registerView(
			VOIDBRAIN_STATUS_VIEW_TYPE,
			(leaf) =>
				new VoidbrainStatusView(leaf, {
					getSnapshot: () => this.refreshRuntimeStatusSnapshot(),
					isOnline: () => this.isRuntimeLoaded,
					onRefresh: () => {
						this.refreshRuntimeStatusSnapshot();
					},
					subscribe: (subscriber) => this.runtimeStatusStore.subscribe(subscriber),
				}),
		);
		this.trackViewRegistration(VOIDBRAIN_STATUS_VIEW_TYPE);
	}

	private registerRibbonAction(): void {
		const ribbonElement = this.addRibbonIcon("brain-circuit", "Open Voidbrain status", () => {
			void this.openStatusView();
		});
		this.ribbonActionCount += 1;
		this.registerOwnedCleanup(() => {
			this.ribbonActionCount = Math.max(0, this.ribbonActionCount - 1);
			if ("detach" in ribbonElement && typeof ribbonElement.detach === "function") {
				ribbonElement.detach();
				return;
			}

			ribbonElement.remove();
		});
	}

	private registerSettingsTab(): void {
		const indexingRuntime = this.indexingRuntime;
		const settingsTab = new VoidbrainSettingsTab(this.app, this, {
			getSettings: () => this.getSettings(),
			saveSettings: (settings) => this.saveSettings(settings),
			secretStore: this.providerSecretStore,
			...(indexingRuntime === null
				? {}
				: {
						indexingRuntime: {
							getState: () => indexingRuntime.getState(),
							reindexLexical: () => indexingRuntime.reindexLexical(),
							cancelLexical: () => indexingRuntime.cancelLexical(),
							retryLexical: () => indexingRuntime.retryLexical(),
							refreshReadiness: () => indexingRuntime.refreshReadiness(),
							subscribe: (subscriber) => indexingRuntime.subscribe(subscriber),
						},
					}),
		});

		this.addSettingTab(settingsTab);
		this.settingsTabCount += 1;
		this.registerOwnedCleanup(() => {
			this.settingsTabCount = Math.max(0, this.settingsTabCount - 1);
			settingsTab.hide();
		});
	}

	private async openStatusView(): Promise<void> {
		try {
			const existingLeaf = this.app.workspace.getLeavesOfType(VOIDBRAIN_STATUS_VIEW_TYPE)[0];
			const leaf = existingLeaf ?? this.createStatusLeaf();

			await leaf.setViewState({
				type: VOIDBRAIN_STATUS_VIEW_TYPE,
				active: true,
			});
			await this.app.workspace.revealLeaf(leaf);
		} catch {
			if (this.settings.shouldShowStatusNotices) {
				new Notice("Voidbrain status view could not be opened. No vault files were changed.", 7000);
			}
		}
	}

	private createStatusLeaf() {
		if (this.settings.ui.statusViewLocation === "left-sidebar") {
			return this.app.workspace.getLeftLeaf(false) ?? this.app.workspace.getLeaf(false);
		}

		return this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(false);
	}

	private showCommandOutcome(outcome: RuntimeCommandOutcome): void {
		if (this.settings.shouldShowStatusNotices) {
			new Notice(`${outcome.userMessage} ${outcome.recoveryHint}`, 7000);
		}
	}

	private trackCommandRegistration(commandId: string): void {
		this.registeredCommandIds.push(commandId);
		this.registerOwnedCleanup(() => {
			const index = this.registeredCommandIds.indexOf(commandId);
			if (index !== -1) {
				this.registeredCommandIds.splice(index, 1);
			}
		});
	}

	private trackViewRegistration(viewType: string): void {
		this.registeredViewTypes.push(viewType);
		this.registerOwnedCleanup(() => {
			this.app.workspace.detachLeavesOfType(viewType);
			const index = this.registeredViewTypes.indexOf(viewType);
			if (index !== -1) {
				this.registeredViewTypes.splice(index, 1);
			}
		});
	}

	private registerOwnedCleanup(callback: CleanupCallback): void {
		this.cleanupCallbacks.push(callback);

		this.register(() => {
			this.runOwnedCleanup(callback);
		});
	}

	private runOwnedCleanups(): void {
		while (this.cleanupCallbacks.length > 0) {
			const callback = this.cleanupCallbacks.pop();

			if (callback) {
				this.runCleanupSafely(callback);
			}
		}
	}

	private runOwnedCleanup(callback: CleanupCallback): void {
		const callbackIndex = this.cleanupCallbacks.indexOf(callback);

		if (callbackIndex === -1) {
			return;
		}

		this.cleanupCallbacks.splice(callbackIndex, 1);
		this.runCleanupSafely(callback);
	}

	private runCleanupSafely(callback: CleanupCallback): void {
		try {
			callback();
		} catch (error) {
			console.error("voidbrain cleanup failed", error);
		}
	}
}

const clonePluginSettings = (settings: VoidbrainPluginSettings): VoidbrainPluginSettings => ({
	...settings,
	trustedProviderIds: [...settings.trustedProviderIds],
	providerProfiles: [...settings.providerProfiles],
	providerAuthStatuses: [...settings.providerAuthStatuses],
	providerRoles: {
		chat: { ...settings.providerRoles.chat },
		embedding: { ...settings.providerRoles.embedding },
		utility: { ...settings.providerRoles.utility },
	},
	indexing: {
		...settings.indexing,
		excludedFolders: [...settings.indexing.excludedFolders],
	},
	ui: { ...settings.ui },
	status: { ...settings.status },
});
