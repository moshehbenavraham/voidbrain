import { Notice, Plugin, type TFile } from "obsidian";
import "./styles.css";
import {
	GroundedVaultChatService,
	type HotCacheService,
	type RecoverSessionService,
	type RecoverySummary,
	SourceIngestionIntakeService,
	SourceIngestionQueueService,
	SourceIngestionStagingService,
	StagedChangeReviewService,
	VaultHealthRuntimeService,
	createHotCacheService,
	createRecoverSessionService,
	createRuntimeCommandHandlers,
	createRuntimeStatusSnapshot,
} from "./agent";
import {
	buildProviderDefinitionsForSettings,
	composeProviderTroubleshootingReport,
	createInMemoryProviderSecretStore,
	summarizeProviderRoleCapabilities,
	summarizeProviderSetup,
} from "./providers";
import { BASELINE_PROVIDERS } from "./providers/provider-registry";
import { type ChatThreadStore, createChatThreadStore } from "./stores/chat-thread-store";
import { type HotCacheStore, createHotCacheStore } from "./stores/hot-cache-store";
import {
	type IngestionQueueStore,
	type PersistedIngestionQueueState,
	createIngestionQueueStore,
} from "./stores/ingestion-queue-store";
import {
	type IngestionStagingStore,
	type PersistedIngestionStagingState,
	createIngestionStagingStore,
} from "./stores/ingestion-staging-store";
import { type RuntimeStatusStore, createRuntimeStatusStore } from "./stores/runtime-status-store";
import { type StagedChangeReviewStore, createStagedChangeReviewStore } from "./stores/staged-change-review-store";
import { type VaultHealthStore, createVaultHealthStore } from "./stores/vault-health-store";
import type { PersistedChatThreadState } from "./types/chat";
import type {
	VaultHealthExportResult,
	VaultHealthRepairStageResult,
	VaultHealthReport,
	VaultHealthRuntimeScanResult,
} from "./types/health";
import { HOT_CACHE_SESSION_SUMMARY_COMMAND_ID, type HotCacheSessionSummaryResult } from "./types/hot-cache";
import type { IndexingRuntimeState } from "./types/indexing-runtime";
import type { SourceIngestionQueueStatusInput, SourceIngestionQueueSummary } from "./types/ingestion-queue";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID, type VoidbrainPluginSettings } from "./types/plugin";
import type { ProviderTroubleshootingActionOutcome } from "./types/provider-setup";
import type { RecoverySupportReadFailure } from "./types/recovery";
import type { RuntimeCommandOutcome, RuntimeStatusSnapshot } from "./types/runtime";
import type {
	StagedReviewActionRequest,
	StagedReviewApplyFailure,
	StagedReviewApplyOutcome,
	StagedReviewApplyPlanEntry,
	StagedReviewApplyPlanFailure,
	StagedReviewApplyRuntimeAdapter,
	StagedReviewAuditEntry,
	StagedReviewIndexRefreshResult,
} from "./types/staged-review";
import type { HotCacheState, NormalizedVaultPath, OperationLog, StagedChangeRecord } from "./types/vault";
import { captureLastError, createVoidbrainLogger } from "./utils/logger";
import {
	type SettingsLoadStatus,
	type SettingsValidationError,
	loadPluginSettings,
	savePluginSettings,
} from "./utils/settings";
import { HOT_CACHE_SUPPORT_PATH, normalizeVaultPath } from "./utils/vault-paths";
import { IndexingRuntimeService, createObsidianMarkdownIndexSource } from "./vectorstore";
import { VOIDBRAIN_CHAT_VIEW_TYPE, VoidbrainChatView } from "./views/chat-view";
import { VoidbrainSettingsTab } from "./views/settings-tab";
import { SourceIngestionModal } from "./views/source-ingestion-modal";
import { StagedChangeReviewModal } from "./views/staged-change-review-modal";
import { VOIDBRAIN_STATUS_VIEW_TYPE, VoidbrainStatusView } from "./views/status-view";
import { VaultHealthModal } from "./views/vault-health-modal";

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
	private readonly logger = createVoidbrainLogger("voidbrain.plugin");
	private readonly registeredCommandIds: string[] = [];
	private readonly registeredViewTypes: string[] = [];
	private isRuntimeLoaded = false;
	private settings: VoidbrainPluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
	private settingsLoadErrors: SettingsValidationError[] = [];
	private settingsLoadStatus: SettingsLoadStatus = "defaulted";
	private readonly providerSecretStore = createInMemoryProviderSecretStore();
	private indexingRuntime: IndexingRuntimeService | null = null;
	private unsubscribeFromIndexingRuntime: CleanupCallback | null = null;
	private chatService: GroundedVaultChatService | null = null;
	private chatThreadStore: ChatThreadStore | null = null;
	private hotCacheService: HotCacheService | null = null;
	private hotCacheStore: HotCacheStore | null = null;
	private hotCacheState: HotCacheState | null = null;
	private restoredChatThreadState: PersistedChatThreadState | null = null;
	private ingestionIntakeService: SourceIngestionIntakeService | null = null;
	private ingestionStagingService: SourceIngestionStagingService | null = null;
	private ingestionStagingStore: IngestionStagingStore | null = null;
	private ingestionPersistenceState: PersistedIngestionStagingState | null = null;
	private ingestionQueueService: SourceIngestionQueueService | null = null;
	private ingestionQueueStore: IngestionQueueStore | null = null;
	private ingestionQueuePersistenceState: PersistedIngestionQueueState | null = null;
	private latestIngestionQueueSummary: SourceIngestionQueueSummary | null = null;
	private readonly ingestionStagedChanges: StagedChangeRecord[] = [];
	private stagedChangeReviewService: StagedChangeReviewService | null = null;
	private stagedChangeReviewStore: StagedChangeReviewStore | null = null;
	private readonly stagedReviewAuditEntries: StagedReviewAuditEntry[] = [];
	private healthService: VaultHealthRuntimeService | null = null;
	private healthStore: VaultHealthStore | null = null;
	private latestHealthReport: VaultHealthReport | null = null;
	private recoveryService: RecoverSessionService | null = null;
	private latestRecoverySummary: RecoverySummary | null = null;
	private ribbonActionCount = 0;
	private settingsTabCount = 0;
	private runtimeStatusSnapshot: RuntimeStatusSnapshot = createRuntimeStatusSnapshot({
		settings: DEFAULT_PLUGIN_SETTINGS,
		providers: BASELINE_PROVIDERS,
		now: new Date(0),
	});
	private runtimeStatusStore: RuntimeStatusStore = createRuntimeStatusStore(this.runtimeStatusSnapshot);

	override async onload(): Promise<void> {
		try {
			const settingsLoadResult = await loadPluginSettings(this);
			this.settings = settingsLoadResult.settings;
			this.settingsLoadErrors = settingsLoadResult.errors;
			this.settingsLoadStatus = settingsLoadResult.status;
			this.createIndexingRuntime();
			this.createHotCacheRuntime();
			await this.restoreHotCacheRuntime();
			this.createChatRuntime();
			this.createIngestionRuntime();
			this.createStagedReviewRuntime();
			this.createHealthRuntime();
			this.createRecoveryRuntime();
			this.refreshRuntimeStatusSnapshot();
			this.isRuntimeLoaded = true;

			if (this.settings.shouldShowStatusNotices && settingsLoadResult.status === "recovered") {
				new Notice("voidbrain settings were reset to local-first defaults.", 5000);
			}

			this.registerStatusCommand();
			this.registerCatalogCommands();
			this.registerStatusView();
			this.registerChatView();
			this.registerRibbonAction();
			this.registerSettingsTab();
			this.startIndexingOnStartup();

			this.registerOwnedCleanup(() => {
				this.unsubscribeFromIndexingRuntime?.();
				this.unsubscribeFromIndexingRuntime = null;
				this.indexingRuntime?.dispose();
				this.indexingRuntime = null;
				this.hotCacheStore?.clear();
				this.hotCacheStore = null;
				this.hotCacheService = null;
				this.hotCacheState = null;
				this.restoredChatThreadState = null;
				this.chatThreadStore?.clear();
				this.chatThreadStore = null;
				this.chatService = null;
				this.ingestionStagingStore?.clear();
				this.ingestionStagingStore = null;
				this.ingestionQueueService?.dispose();
				this.ingestionQueueService = null;
				this.ingestionQueueStore?.clear();
				this.ingestionQueueStore = null;
				this.ingestionQueuePersistenceState = null;
				this.latestIngestionQueueSummary = null;
				this.ingestionStagingService = null;
				this.ingestionIntakeService = null;
				this.stagedChangeReviewStore?.clear();
				this.stagedChangeReviewStore = null;
				this.stagedChangeReviewService = null;
				this.healthStore?.clear();
				this.healthStore = null;
				this.healthService = null;
				this.latestHealthReport = null;
				this.recoveryService = null;
				this.latestRecoverySummary = null;
				this.stagedReviewAuditEntries.splice(0, this.stagedReviewAuditEntries.length);
				this.ingestionStagedChanges.splice(0, this.ingestionStagedChanges.length);
				this.isRuntimeLoaded = false;
				this.runtimeStatusStore.clear();
			});
		} catch (error) {
			captureLastError(error, {
				context: {
					command: "plugin.onload",
				},
				logger: this.logger,
			});
			throw error;
		}
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
		this.queueHotCachePersist();
	}

	private refreshRuntimeStatusSnapshot(): RuntimeStatusSnapshot {
		const providers = buildProviderDefinitionsForSettings(this.settings, BASELINE_PROVIDERS);
		const providerSetup = summarizeProviderSetup(this.settings, providers);
		const providerRoleCapabilities = summarizeProviderRoleCapabilities(this.settings, providers);
		const indexingState = this.indexingRuntime?.getState() ?? null;
		const lexicalReport = indexingState?.lexicalReport ?? null;
		const ingestionQueueStatus = this.getIngestionQueueStatusInput();
		const providerTroubleshooting = composeProviderTroubleshootingReport({
			settings: this.settings,
			providers,
			providerSetup,
			providerRoleCapabilities,
			semanticCompatibility: indexingState?.semanticCompatibility ?? null,
			cachePath: HOT_CACHE_SUPPORT_PATH,
			reportId: "runtime-provider-troubleshooting",
		});
		this.runtimeStatusSnapshot = createRuntimeStatusSnapshot({
			settings: this.settings,
			providers,
			providerSetup,
			providerRoleCapabilities,
			providerTroubleshooting,
			...(lexicalReport === null ? {} : { indexReports: [lexicalReport] }),
			...(lexicalReport?.progress === undefined || lexicalReport.progress === null
				? {}
				: { indexProgress: [lexicalReport.progress] }),
			...(lexicalReport?.freshness === undefined || lexicalReport.freshness === null
				? {}
				: { indexFreshness: [lexicalReport.freshness] }),
			...(indexingState === null
				? {}
				: {
						semanticIndexReadiness: indexingState.semanticReadiness,
						semanticIndexCompatibility: indexingState.semanticCompatibility,
					}),
			...(lexicalReport === null || lexicalReport.failedPaths.length === 0
				? {}
				: { recentIndexFailures: lexicalReport.failedPaths }),
			stagedChanges: this.ingestionStagedChanges,
			healthReport: this.latestHealthReport,
			hotCache: this.hotCacheStore?.getStatusInput() ?? null,
			...(ingestionQueueStatus === null ? {} : { ingestionQueue: ingestionQueueStatus }),
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
			this.queueHotCachePersist();
		});
	}

	private createHotCacheRuntime(): void {
		this.hotCacheService = createHotCacheService();
		this.hotCacheStore = createHotCacheStore({
			cachePath: HOT_CACHE_SUPPORT_PATH,
		});
	}

	private async restoreHotCacheRuntime(): Promise<void> {
		const service = this.hotCacheService;
		const store = this.hotCacheStore;
		if (service === null || store === null) {
			return;
		}

		try {
			if ((await this.app.vault.adapter.exists(HOT_CACHE_SUPPORT_PATH)) === false) {
				return;
			}

			const raw = await this.app.vault.adapter.read(HOT_CACHE_SUPPORT_PATH);
			const parsed = JSON.parse(raw) as unknown;
			const result = service.restore({
				cachePath: HOT_CACHE_SUPPORT_PATH,
				value: parsed,
			});
			store.applyRestoreResult(result);
			if (result.ok) {
				this.hotCacheState = result.state;
				this.restoredChatThreadState = result.chatThread;
			}
		} catch (error) {
			store.setFailure(safeRuntimeErrorMessage(error, "Hot cache could not be restored."));
		}
	}

	private createChatRuntime(): void {
		this.chatThreadStore = createChatThreadStore({
			...(this.restoredChatThreadState === null ? {} : { initialPersistedState: this.restoredChatThreadState }),
			persistence: {
				save: async () => {
					await this.persistHotCache({ throwOnFailure: true });
				},
			},
		});
		this.chatService = new GroundedVaultChatService({
			getSettings: () => this.settings,
			getIndexingState: () => this.indexingRuntime?.getState() ?? null,
			getProviders: () => buildProviderDefinitionsForSettings(this.settings, BASELINE_PROVIDERS),
		});
	}

	private createIngestionRuntime(): void {
		this.ingestionIntakeService = new SourceIngestionIntakeService({
			maxSourceBytes: this.settings.indexing.maxNoteBytes,
		});
		this.ingestionStagingService = new SourceIngestionStagingService({
			intakeService: this.ingestionIntakeService,
			getSettings: () => this.settings,
			baselineProviders: BASELINE_PROVIDERS,
		});
		this.ingestionStagingStore = createIngestionStagingStore({
			...(this.ingestionPersistenceState === null
				? {}
				: { initialPersistedState: this.ingestionPersistenceState }),
			persistence: {
				save: async (state) => {
					this.ingestionPersistenceState = state;
				},
			},
		});
		this.ingestionQueueService = new SourceIngestionQueueService({
			intakeService: this.ingestionIntakeService,
			stagingService: this.ingestionStagingService,
			getSettings: () => this.settings,
			baselineProviders: BASELINE_PROVIDERS,
		});
		this.ingestionQueueStore = createIngestionQueueStore({
			...(this.ingestionQueuePersistenceState === null
				? {}
				: { initialPersistedState: this.ingestionQueuePersistenceState }),
			persistence: {
				save: async (state) => {
					this.ingestionQueuePersistenceState = state;
				},
			},
		});
	}

	private createStagedReviewRuntime(): void {
		this.stagedChangeReviewService = new StagedChangeReviewService();
		this.stagedChangeReviewStore = createStagedChangeReviewStore();
	}

	private createHealthRuntime(): void {
		this.healthService = new VaultHealthRuntimeService();
		this.healthStore = createVaultHealthStore();
	}

	private createRecoveryRuntime(): void {
		this.recoveryService = createRecoverSessionService();
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
			chat: {
				openChatView: () => this.openChatView(),
				canOpenChat: () => this.chatService !== null && this.chatThreadStore !== null,
			},
			ingestion: {
				openIngestionModal: () => this.openIngestionModal(),
				canOpenIngestion: () =>
					this.ingestionIntakeService !== null &&
					this.ingestionStagingService !== null &&
					this.ingestionStagingStore !== null,
			},
			stagedReview: {
				openStagedChangeReview: () => this.openStagedChangeReviewModal(),
				canOpenStagedChangeReview: () =>
					this.stagedChangeReviewService !== null && this.stagedChangeReviewStore !== null,
			},
			health: {
				openHealthCheck: () => this.openVaultHealthModal(),
				canOpenHealthCheck: () => this.healthService !== null && this.healthStore !== null,
			},
			recovery: {
				recoverSession: () => this.runRecoverSession(),
				canRecoverSession: () => this.recoveryService !== null,
			},
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

	private registerChatView(): void {
		this.registerView(VOIDBRAIN_CHAT_VIEW_TYPE, (leaf) => {
			const chatService = this.chatService;
			const chatThreadStore = this.chatThreadStore;
			if (chatService === null || chatThreadStore === null) {
				throw new Error("Voidbrain chat runtime is not initialized.");
			}

			return new VoidbrainChatView(leaf, {
				getState: () => chatThreadStore.getState(),
				subscribe: (subscriber) => chatThreadStore.subscribe(subscriber),
				ask: (input) => chatService.ask(input),
				applyActionResult: (result) => chatThreadStore.applyActionResult(result),
				setDraft: (text, contextChips) => chatThreadStore.setDraft(text, contextChips),
				retryTurn: (turnId) => chatThreadStore.retryTurn(turnId),
				branchFromTurn: (turnId) => chatThreadStore.branchFromTurn(turnId),
				stageSessionSummary: () => this.stageChatSessionSummary(),
				isSummaryStaging: () => this.hotCacheStore?.getState().isSummaryInFlight ?? false,
				isOnline: () => this.isRuntimeLoaded,
				getActivePath: () => this.getActiveVaultPath(),
				onNotice: (message) => {
					if (this.settings.shouldShowStatusNotices) {
						new Notice(message, 7000);
					}
				},
			});
		});
		this.trackViewRegistration(VOIDBRAIN_CHAT_VIEW_TYPE);
	}

	private async stageChatSessionSummary(): Promise<HotCacheSessionSummaryResult> {
		const service = this.hotCacheService;
		const store = this.hotCacheStore;
		const chatThreadStore = this.chatThreadStore;
		if (service === null || store === null || chatThreadStore === null) {
			const errors = [
				{
					code: "record.invalid-operation" as const,
					message: "Hot cache summary staging is unavailable.",
				},
			];
			return {
				ok: false,
				errors,
				recovery: {
					commandId: HOT_CACHE_SESSION_SUMMARY_COMMAND_ID,
					cachePath: HOT_CACHE_SUPPORT_PATH,
					validationOutput: errors,
				},
			};
		}

		if (!store.beginSummaryStaging()) {
			const errors = [
				{
					code: "record.invalid-operation" as const,
					message: "A session summary is already being staged.",
				},
			];
			const result: HotCacheSessionSummaryResult = {
				ok: false,
				errors,
				recovery: {
					commandId: HOT_CACHE_SESSION_SUMMARY_COMMAND_ID,
					cachePath: HOT_CACHE_SUPPORT_PATH,
					validationOutput: errors,
				},
			};
			store.applySummaryResult(result);
			return result;
		}

		const result = await service.stageSessionSummary({
			chatThread: chatThreadStore.getState(),
			existingNotes: this.getExistingMarkdownNotePlaceholders(),
			existingStagedChanges: this.ingestionStagedChanges,
		});
		store.applySummaryResult(result);
		if (result.ok) {
			this.ingestionStagedChanges.push(result.stagedChange);
			this.refreshRuntimeStatusSnapshot();
			this.queueHotCachePersist();
		}

		return result;
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
			onProviderTroubleshootingAction: (outcome) => this.handleProviderTroubleshootingActionOutcome(outcome),
		});

		this.addSettingTab(settingsTab);
		this.settingsTabCount += 1;
		this.registerOwnedCleanup(() => {
			this.settingsTabCount = Math.max(0, this.settingsTabCount - 1);
			settingsTab.hide();
		});
	}

	private handleProviderTroubleshootingActionOutcome(outcome: ProviderTroubleshootingActionOutcome): void {
		this.refreshRuntimeStatusSnapshot();
		if (this.settings.shouldShowStatusNotices) {
			new Notice(outcome.message, outcome.accepted ? 5000 : 7000);
		}
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

	private async openChatView(): Promise<void> {
		try {
			const existingLeaf = this.app.workspace.getLeavesOfType(VOIDBRAIN_CHAT_VIEW_TYPE)[0];
			const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(false);

			await leaf.setViewState({
				type: VOIDBRAIN_CHAT_VIEW_TYPE,
				active: true,
			});
			await this.app.workspace.revealLeaf(leaf);
		} catch {
			if (this.settings.shouldShowStatusNotices) {
				new Notice("Voidbrain chat view could not be opened. No vault files were changed.", 7000);
			}
		}
	}

	private async openIngestionModal(): Promise<void> {
		const intakeService = this.ingestionIntakeService;
		const stagingService = this.ingestionStagingService;
		const store = this.ingestionStagingStore;
		const queueService = this.ingestionQueueService;
		const queueStore = this.ingestionQueueStore;
		if (intakeService === null || stagingService === null || store === null) {
			if (this.settings.shouldShowStatusNotices) {
				new Notice("Voidbrain source ingestion is unavailable. No vault files were changed.", 7000);
			}
			return;
		}

		new SourceIngestionModal(this.app, {
			store,
			previewSource: async (request) =>
				intakeService.createPreview({
					...request,
					existingNotes: this.getExistingMarkdownNotePlaceholders(),
					existingStagedChanges: this.ingestionStagedChanges,
				}),
			stageSource: async (request) => {
				const result = await stagingService.stageSource({
					...request,
					existingNotes: this.getExistingMarkdownNotePlaceholders(),
					existingStagedChanges: this.ingestionStagedChanges,
				});
				if (result.ok) {
					this.ingestionStagedChanges.push(...result.stagedChanges);
					this.refreshRuntimeStatusSnapshot();
					this.queueHotCachePersist();
				}

				return result;
			},
			readSourcePath: (path) => this.readVaultSourcePath(path),
			...(queueStore === null ? {} : { queueStore }),
			...(queueService === null
				? {}
				: {
						runQueue: async (input) => {
							const result = await queueService.runQueue({
								...input,
								existingNotes: this.getExistingMarkdownNotePlaceholders(),
								existingStagedChanges: this.ingestionStagedChanges,
								onUpdate: (summary) => {
									input.onUpdate?.(summary);
									this.latestIngestionQueueSummary = summary;
									this.refreshRuntimeStatusSnapshot();
								},
							});
							this.latestIngestionQueueSummary = result.summary;
							this.ingestionStagedChanges.push(...result.stagedChanges);
							this.refreshRuntimeStatusSnapshot();
							this.queueHotCachePersist();
							return result;
						},
						cancelQueue: (queueId) => queueService.cancelQueue(queueId),
					}),
			getExistingNotes: () => this.getExistingMarkdownNotePlaceholders(),
			getExistingStagedChanges: () => this.ingestionStagedChanges,
			onNotice: (message) => {
				if (this.settings.shouldShowStatusNotices) {
					new Notice(message, 7000);
				}
			},
		}).open();
	}

	private async openStagedChangeReviewModal(): Promise<void> {
		const service = this.stagedChangeReviewService;
		const store = this.stagedChangeReviewStore;
		if (service === null || store === null) {
			if (this.settings.shouldShowStatusNotices) {
				new Notice("Voidbrain staged-change review is unavailable. No vault files were changed.", 7000);
			}
			return;
		}

		new StagedChangeReviewModal(this.app, {
			store,
			loadReviewModel: () => service.createModel(this.ingestionStagedChanges),
			applyReviewAction: async (request) => {
				const result = service.applyAction(this.ingestionStagedChanges, request);
				this.replaceStagedChanges(result.records);
				this.stagedReviewAuditEntries.push(...result.auditEntries);
				this.refreshRuntimeStatusSnapshot();
				this.queueHotCachePersist();
				return result;
			},
			applySelectedChanges: (request) => this.applySelectedStagedChanges(request),
			isOnline: () => this.isRuntimeLoaded,
			onNotice: (message) => {
				if (this.settings.shouldShowStatusNotices) {
					new Notice(message, 7000);
				}
			},
		}).open();
	}

	private async openVaultHealthModal(): Promise<void> {
		const service = this.healthService;
		const store = this.healthStore;
		if (service === null || store === null) {
			if (this.settings.shouldShowStatusNotices) {
				new Notice("Voidbrain vault health is unavailable. No vault files were changed.", 7000);
			}
			return;
		}

		new VaultHealthModal(this.app, {
			store,
			runScan: () => this.runVaultHealthScan(service),
			exportReport: (report) => this.exportVaultHealthReport(service, report),
			stageRepair: (findingId, report) => this.stageVaultHealthRepair(service, report, findingId),
			isOnline: () => this.isRuntimeLoaded,
			onNotice: (message) => {
				if (this.settings.shouldShowStatusNotices) {
					new Notice(message, 7000);
				}
			},
		}).open();
	}

	private async runRecoverSession(): Promise<RecoverySummary> {
		const service = this.recoveryService;
		if (service === null) {
			throw new Error("Session recovery runtime is unavailable.");
		}

		const hotCacheRead = await this.readRecoveryHotCacheSupportRecord();
		const operationLog = this.createRecoveryOperationLog();
		const hotCache = hotCacheRead.hotCache ?? this.hotCacheState;
		const summary = service.buildSummary({
			...(hotCache === null ? {} : { hotCache }),
			hotCachePath: HOT_CACHE_SUPPORT_PATH,
			stagedChanges: this.ingestionStagedChanges,
			healthReport: this.latestHealthReport,
			...(operationLog === undefined ? {} : { operationLog }),
			readFailures: hotCacheRead.readFailures,
			now: new Date(),
		});
		this.latestRecoverySummary = summary;
		this.showRecoverySummary(summary);
		return summary;
	}

	private async readRecoveryHotCacheSupportRecord(): Promise<{
		readonly hotCache: unknown | null;
		readonly readFailures: readonly RecoverySupportReadFailure[];
	}> {
		try {
			if ((await this.app.vault.adapter.exists(HOT_CACHE_SUPPORT_PATH)) === false) {
				return {
					hotCache: null,
					readFailures: [],
				};
			}

			const raw = await this.app.vault.adapter.read(HOT_CACHE_SUPPORT_PATH);
			return {
				hotCache: JSON.parse(raw) as unknown,
				readFailures: [],
			};
		} catch (error) {
			return {
				hotCache: null,
				readFailures: [
					{
						sourceKind: "hot-cache",
						sourcePath: HOT_CACHE_SUPPORT_PATH,
						error,
					},
				],
			};
		}
	}

	private createRecoveryOperationLog(): OperationLog | undefined {
		const entries = this.stagedReviewAuditEntries.flatMap((entry) =>
			entry.operationLogEntry === undefined ? [] : [entry.operationLogEntry],
		);
		if (entries.length === 0) {
			return undefined;
		}

		return {
			artifactKind: "operation-log",
			schemaVersion: 1,
			logId: "runtime-staged-review-audit",
			entries,
		};
	}

	private showRecoverySummary(summary: RecoverySummary): void {
		if (!this.settings.shouldShowStatusNotices) {
			return;
		}

		new Notice(
			`Session recovery ${summary.status}: ${summary.counts.itemCount} item(s), ${summary.counts.diagnosticCount} diagnostic(s), ${summary.counts.actionCount} action(s). No vault files were changed.`,
			7000,
		);
	}

	private async runVaultHealthScan(service: VaultHealthRuntimeService): Promise<VaultHealthRuntimeScanResult> {
		const source = createObsidianMarkdownIndexSource({
			vault: {
				getFiles: () => this.app.vault.getFiles(),
				read: (file) => this.app.vault.read(file as TFile),
			},
			metadataCache: {
				getFileCache: (file) => this.app.metadataCache.getFileCache(file as TFile),
			},
		});
		const sourceRead = await source.readMarkdownNotes({
			preferences: this.settings.indexing,
		});
		const lexicalFreshness = this.indexingRuntime?.getState().lexicalReport.freshness ?? null;
		const result = service.scanMarkdownNotes({
			notes: sourceRead.notes,
			knownPaths: sourceRead.knownPaths,
			pathAliases: sourceRead.pathAliases,
			...(lexicalFreshness === null ? {} : { freshnessSnapshots: [lexicalFreshness] }),
		});
		if (result.ok) {
			this.latestHealthReport = result.report;
			this.refreshRuntimeStatusSnapshot();
			this.queueHotCachePersist();
		}

		return result;
	}

	private async exportVaultHealthReport(
		service: VaultHealthRuntimeService,
		report: VaultHealthReport,
	): Promise<VaultHealthExportResult> {
		const result = await service.exportMarkdownReport({
			report,
			adapter: {
				exists: (path) => this.app.vault.adapter.exists(path),
				write: async (path, content) => {
					await this.ensureHealthReportFolder();
					await this.app.vault.adapter.write(path, content);
				},
			},
		});
		this.refreshRuntimeStatusSnapshot();
		return result;
	}

	private async stageVaultHealthRepair(
		service: VaultHealthRuntimeService,
		report: VaultHealthReport,
		findingId: string,
	): Promise<VaultHealthRepairStageResult> {
		const result = await service.stageSafeRepair({
			report,
			findingId,
			existingNotes: await this.getExistingMarkdownNotesWithContent(),
			existingStagedChanges: this.ingestionStagedChanges,
		});
		if (result.ok) {
			this.ingestionStagedChanges.push(result.stagedChange);
			this.refreshRuntimeStatusSnapshot();
			this.queueHotCachePersist();
		}

		return result;
	}

	private async applySelectedStagedChanges(request: StagedReviewActionRequest): Promise<StagedReviewApplyOutcome> {
		const service = this.stagedChangeReviewService;
		if (service === null) {
			return this.applyPlanFailureOutcome("preflight-unavailable", {
				ok: false,
				records: this.ingestionStagedChanges,
				outcomes: [],
				auditEntries: [],
				recovery: [],
				errors: [
					{
						code: "record.invalid-operation",
						message: "Staged-change review service is unavailable.",
					},
				],
			});
		}

		const adapter = this.createStagedReviewApplyAdapter();
		const planResult = await service.planApply(this.ingestionStagedChanges, request, adapter);
		if (!planResult.ok) {
			this.replaceStagedChanges(planResult.records);
			this.stagedReviewAuditEntries.push(...planResult.auditEntries);
			this.refreshRuntimeStatusSnapshot();
			this.queueHotCachePersist();
			return this.applyPlanFailureOutcome("preflight-failed", planResult);
		}

		const failures: StagedReviewApplyFailure[] = [];
		for (const entry of planResult.plan.entries) {
			try {
				await this.executeStagedApplyEntry(entry, adapter);
			} catch (error) {
				failures.push({
					changeId: entry.record.changeId,
					message: safeRuntimeErrorMessage(error, `Failed to apply staged change ${entry.record.changeId}.`),
					validationOutput: [
						{
							code: "record.invalid-operation",
							message: safeRuntimeErrorMessage(
								error,
								`Failed to apply staged change ${entry.record.changeId}.`,
							),
							path: entry.record.targetPath,
						},
					],
				});
			}
		}

		const successfulPaths = planResult.plan.entries
			.filter((entry) => !failures.some((failure) => failure.changeId === entry.record.changeId))
			.flatMap((entry) => [
				entry.record.targetPath,
				...(entry.destinationPath === undefined ? [] : [entry.destinationPath]),
			]);
		const indexRefresh =
			successfulPaths.length === 0
				? {
						attempted: false,
						ok: true,
						message: "No staged changes were applied, so index refresh was not requested.",
						retryable: false,
						targetPaths: [],
					}
				: await this.refreshIndexAfterStagedApply(successfulPaths);
		const outcome = service.finalizeApplyPlan(planResult.plan, failures, indexRefresh);
		this.mergeStagedChangeRecords(outcome.records);
		this.stagedReviewAuditEntries.push(...outcome.auditEntries);
		this.refreshRuntimeStatusSnapshot();
		this.queueHotCachePersist();
		return outcome;
	}

	private createStagedReviewApplyAdapter(): StagedReviewApplyRuntimeAdapter {
		return {
			exists: async (path) => this.findVaultFile(path) !== undefined || this.app.vault.adapter.exists(path),
			read: async (path) => {
				const file = this.findVaultFile(path);
				return file === undefined ? this.app.vault.adapter.read(path) : this.app.vault.read(file as TFile);
			},
			canWrite: async (path) => !path.startsWith("../") && !path.startsWith("/"),
			create: async (path, content) => {
				await this.app.vault.create(path, content);
			},
			modify: async (path, content) => {
				await this.app.vault.modify(this.requireVaultFile(path), content);
			},
			delete: async (path) => {
				await this.app.vault.delete(this.requireVaultFile(path));
			},
			rename: async (path, destinationPath) => {
				await this.app.vault.rename(this.requireVaultFile(path), destinationPath);
			},
			writeSupportRecord: async (path, content) => {
				if (!path.startsWith(".voidbrain/")) {
					throw new Error("Backup support records must stay under .voidbrain.");
				}

				await this.app.vault.adapter.write(path, content);
			},
			refreshIndex: (paths) => this.refreshIndexAfterStagedApply(paths),
		};
	}

	private async executeStagedApplyEntry(
		entry: StagedReviewApplyPlanEntry,
		adapter: StagedReviewApplyRuntimeAdapter,
	): Promise<void> {
		const record = entry.record;
		switch (record.operationKind) {
			case "create-note": {
				if (record.diff.afterContent === undefined) {
					throw new Error("Create staged change is missing after content.");
				}
				await adapter.create(record.targetPath, record.diff.afterContent);
				return;
			}
			case "update-note":
			case "update-frontmatter": {
				if (record.diff.afterContent === undefined) {
					throw new Error("Update staged change is missing after content.");
				}
				await adapter.modify(record.targetPath, record.diff.afterContent);
				return;
			}
			case "delete-note": {
				await this.writeDestructiveBackup(entry, adapter);
				await adapter.delete(record.targetPath);
				return;
			}
			case "move-note": {
				if (entry.destinationPath === undefined) {
					throw new Error("Move staged change is missing destination path.");
				}
				await this.writeDestructiveBackup(entry, adapter);
				await adapter.rename(record.targetPath, entry.destinationPath);
				return;
			}
			default: {
				const exhaustive: never = record.operationKind;
				throw new Error(`Unhandled staged-change operation: ${String(exhaustive)}`);
			}
		}
	}

	private async writeDestructiveBackup(
		entry: StagedReviewApplyPlanEntry,
		adapter: StagedReviewApplyRuntimeAdapter,
	): Promise<void> {
		if (entry.backupPath === undefined || entry.backupContent === undefined) {
			throw new Error("Destructive staged changes require a backup support record before apply.");
		}

		await adapter.writeSupportRecord(entry.backupPath, this.renderBackupSupportRecord(entry));
	}

	private renderBackupSupportRecord(entry: StagedReviewApplyPlanEntry): string {
		return [
			"---",
			"artifact-kind: staged-change-backup",
			`staged-change-id: ${entry.record.changeId}`,
			`command-id: ${entry.record.recovery.commandId}`,
			`target-path: ${entry.record.targetPath}`,
			...(entry.destinationPath === undefined ? [] : [`destination-path: ${entry.destinationPath}`]),
			"---",
			"",
			entry.backupContent ?? "",
		].join("\n");
	}

	private async refreshIndexAfterStagedApply(
		targetPaths: readonly NormalizedVaultPath[],
	): Promise<StagedReviewIndexRefreshResult> {
		if (this.indexingRuntime === null) {
			return {
				attempted: false,
				ok: false,
				message: "Index refresh is unavailable; applied notes remain in the vault.",
				retryable: true,
				targetPaths,
			};
		}

		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const result = await withTimeout(this.indexingRuntime.reindexLexical(), 5000);
				return {
					attempted: true,
					ok: result.accepted,
					message: result.message,
					retryable: !result.accepted,
					targetPaths,
				};
			} catch (error) {
				if (attempt === 1) {
					return {
						attempted: true,
						ok: false,
						message: safeRuntimeErrorMessage(error, "Index refresh timed out after staged apply."),
						retryable: true,
						targetPaths,
					};
				}
				await Promise.resolve();
			}
		}

		return {
			attempted: true,
			ok: false,
			message: "Index refresh failed after retry.",
			retryable: true,
			targetPaths,
		};
	}

	private applyPlanFailureOutcome(planId: string, failure: StagedReviewApplyPlanFailure): StagedReviewApplyOutcome {
		return {
			ok: false,
			planId,
			records: failure.records,
			outcomes: failure.outcomes,
			auditEntries: failure.auditEntries,
			recovery: failure.recovery,
			indexRefresh: {
				attempted: false,
				ok: false,
				message: failure.errors.map((error) => error.message).join(" "),
				retryable: true,
				targetPaths: failure.records.map((record) => record.targetPath),
			},
		};
	}

	private replaceStagedChanges(records: readonly StagedChangeRecord[]): void {
		this.ingestionStagedChanges.splice(0, this.ingestionStagedChanges.length, ...records);
	}

	private mergeStagedChangeRecords(records: readonly StagedChangeRecord[]): void {
		const updates = new Map(records.map((record) => [record.changeId, record]));
		for (const [index, record] of this.ingestionStagedChanges.entries()) {
			const updated = updates.get(record.changeId);
			if (updated !== undefined) {
				this.ingestionStagedChanges[index] = updated;
			}
		}
	}

	private findVaultFile(path: NormalizedVaultPath): TFile | undefined {
		return this.app.vault.getFiles().find((file) => file.path === path) as TFile | undefined;
	}

	private requireVaultFile(path: NormalizedVaultPath): TFile {
		const file = this.findVaultFile(path);
		if (file === undefined) {
			throw new Error(`Vault file is missing: ${path}`);
		}

		return file;
	}

	private async readVaultSourcePath(path: string): Promise<string> {
		const normalized = normalizeVaultPath(path);
		if (!normalized.ok) {
			throw new Error("Source path must be vault-relative.");
		}

		const file = this.app.vault.getFiles().find((candidate) => candidate.path === normalized.value);
		if (file === undefined) {
			throw new Error(`Source path is not present in the active vault: ${normalized.value}`);
		}

		return this.app.vault.read(file as TFile);
	}

	private getExistingMarkdownNotePlaceholders(): readonly { readonly path: string; readonly content: string }[] {
		return this.app.vault
			.getFiles()
			.filter((file) => file.path.endsWith(".md"))
			.map((file) => ({
				path: file.path,
				content: "",
			}));
	}

	private async getExistingMarkdownNotesWithContent(): Promise<
		readonly { readonly path: string; readonly content: string }[]
	> {
		const notes: Array<{ readonly path: string; readonly content: string }> = [];
		for (const file of this.app.vault.getFiles().filter((candidate) => candidate.path.endsWith(".md"))) {
			try {
				notes.push({
					path: file.path,
					content: await this.app.vault.read(file as TFile),
				});
			} catch {}
		}

		return notes;
	}

	private getIngestionQueueStatusInput(): SourceIngestionQueueStatusInput | null {
		const status = this.ingestionQueueStore?.getStatusInput();
		if (status === undefined) {
			return null;
		}
		if (status.summary === null && !status.isRunning && status.lastFailureMessage === undefined) {
			return null;
		}

		return status;
	}

	private queueHotCachePersist(): void {
		void this.persistHotCache().catch((error) => {
			const message = safeRuntimeErrorMessage(error, "Hot cache persistence failed.");
			this.hotCacheStore?.setFailure(message);
			this.refreshRuntimeStatusSnapshot();
			if (this.settings.shouldShowStatusNotices) {
				new Notice(`${message} Recent context recovery may be stale.`, 7000);
			}
		});
	}

	private async persistHotCache(options: { readonly throwOnFailure?: boolean } = {}): Promise<void> {
		const service = this.hotCacheService;
		const store = this.hotCacheStore;
		if (service === null || store === null) {
			return;
		}

		if (!store.beginCapture()) {
			return;
		}

		const indexingState = this.indexingRuntime?.getState() ?? null;
		const lexicalReport = indexingState?.lexicalReport ?? null;
		const result = service.capture({
			chatThread: this.chatThreadStore?.getState() ?? null,
			...(lexicalReport === null ? {} : { indexReports: [lexicalReport] }),
			stagedChanges: this.ingestionStagedChanges,
			healthReport: this.latestHealthReport,
			...(this.latestIngestionQueueSummary === null
				? {}
				: { sourceIngestionQueues: [this.latestIngestionQueueSummary] }),
		});
		if (!result.ok) {
			store.applyCaptureResult(result);
			this.refreshRuntimeStatusSnapshot();
			if (options.throwOnFailure === true) {
				throw new Error(result.errors.map((error) => error.message).join(" "));
			}
			return;
		}

		try {
			await this.ensureHotCacheFolder();
			await this.app.vault.adapter.write(HOT_CACHE_SUPPORT_PATH, JSON.stringify(result.state, null, "\t"));
			this.hotCacheState = result.state;
			store.applyCaptureResult(result);
			this.refreshRuntimeStatusSnapshot();
		} catch (error) {
			const message = safeRuntimeErrorMessage(error, "Hot cache support record could not be written.");
			store.setFailure(message);
			this.refreshRuntimeStatusSnapshot();
			if (options.throwOnFailure === true) {
				throw error;
			}
		}
	}

	private async ensureHotCacheFolder(): Promise<void> {
		const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
			readonly mkdir?: (path: string) => Promise<void>;
		};
		if (typeof adapter.mkdir !== "function") {
			return;
		}

		for (const path of [".voidbrain", ".voidbrain/cache"]) {
			if ((await adapter.exists(path)) === false) {
				await adapter.mkdir(path);
			}
		}
	}

	private async ensureHealthReportFolder(): Promise<void> {
		const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
			readonly mkdir?: (path: string) => Promise<void>;
		};
		if (typeof adapter.mkdir !== "function") {
			return;
		}

		for (const path of [".voidbrain", ".voidbrain/reports"]) {
			if ((await adapter.exists(path)) === false) {
				await adapter.mkdir(path);
			}
		}
	}

	private getActiveVaultPath() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile === null) {
			return null;
		}

		const normalized = normalizeVaultPath(activeFile.path);
		return normalized.ok ? normalized.value : null;
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
			captureLastError(error, {
				context: {
					command: "plugin.onunload.cleanup",
				},
				fallbackMessage: "voidbrain cleanup failed.",
				logger: this.logger,
			});
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

const safeRuntimeErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const withTimeout = async <TValue>(promise: Promise<TValue>, timeoutMs: number): Promise<TValue> =>
	new Promise<TValue>((resolve, reject) => {
		const timeoutId = window.setTimeout(() => {
			reject(new Error("Timed out waiting for index refresh."));
		}, timeoutMs);

		promise.then(
			(value) => {
				window.clearTimeout(timeoutId);
				resolve(value);
			},
			(error: unknown) => {
				window.clearTimeout(timeoutId);
				reject(error);
			},
		);
	});
