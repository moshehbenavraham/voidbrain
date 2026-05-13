import { Notice, Plugin, type TFile } from "obsidian";
import "./styles.css";
import {
	GroundedVaultChatService,
	SourceIngestionIntakeService,
	SourceIngestionStagingService,
	StagedChangeReviewService,
	createRuntimeCommandHandlers,
	createRuntimeStatusSnapshot,
} from "./agent";
import {
	buildProviderDefinitionsForSettings,
	createInMemoryProviderSecretStore,
	summarizeProviderRoleCapabilities,
	summarizeProviderSetup,
} from "./providers";
import { BASELINE_PROVIDERS } from "./providers/provider-registry";
import { type ChatThreadStore, createChatThreadStore } from "./stores/chat-thread-store";
import {
	type IngestionStagingStore,
	type PersistedIngestionStagingState,
	createIngestionStagingStore,
} from "./stores/ingestion-staging-store";
import { type RuntimeStatusStore, createRuntimeStatusStore } from "./stores/runtime-status-store";
import { type StagedChangeReviewStore, createStagedChangeReviewStore } from "./stores/staged-change-review-store";
import type { IndexingRuntimeState } from "./types/indexing-runtime";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID, type VoidbrainPluginSettings } from "./types/plugin";
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
import type { NormalizedVaultPath, StagedChangeRecord } from "./types/vault";
import {
	type SettingsLoadStatus,
	type SettingsValidationError,
	loadPluginSettings,
	savePluginSettings,
} from "./utils/settings";
import { normalizeVaultPath } from "./utils/vault-paths";
import { IndexingRuntimeService, createObsidianMarkdownIndexSource } from "./vectorstore";
import { VOIDBRAIN_CHAT_VIEW_TYPE, VoidbrainChatView } from "./views/chat-view";
import { VoidbrainSettingsTab } from "./views/settings-tab";
import { SourceIngestionModal } from "./views/source-ingestion-modal";
import { StagedChangeReviewModal } from "./views/staged-change-review-modal";
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
	private chatService: GroundedVaultChatService | null = null;
	private chatThreadStore: ChatThreadStore | null = null;
	private ingestionIntakeService: SourceIngestionIntakeService | null = null;
	private ingestionStagingService: SourceIngestionStagingService | null = null;
	private ingestionStagingStore: IngestionStagingStore | null = null;
	private ingestionPersistenceState: PersistedIngestionStagingState | null = null;
	private readonly ingestionStagedChanges: StagedChangeRecord[] = [];
	private stagedChangeReviewService: StagedChangeReviewService | null = null;
	private stagedChangeReviewStore: StagedChangeReviewStore | null = null;
	private readonly stagedReviewAuditEntries: StagedReviewAuditEntry[] = [];
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
		this.createChatRuntime();
		this.createIngestionRuntime();
		this.createStagedReviewRuntime();
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
			this.chatThreadStore?.clear();
			this.chatThreadStore = null;
			this.chatService = null;
			this.ingestionStagingStore?.clear();
			this.ingestionStagingStore = null;
			this.ingestionStagingService = null;
			this.ingestionIntakeService = null;
			this.stagedChangeReviewStore?.clear();
			this.stagedChangeReviewStore = null;
			this.stagedChangeReviewService = null;
			this.stagedReviewAuditEntries.splice(0, this.stagedReviewAuditEntries.length);
			this.ingestionStagedChanges.splice(0, this.ingestionStagedChanges.length);
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
			stagedChanges: this.ingestionStagedChanges,
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

	private createChatRuntime(): void {
		this.chatThreadStore = createChatThreadStore();
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
	}

	private createStagedReviewRuntime(): void {
		this.stagedChangeReviewService = new StagedChangeReviewService();
		this.stagedChangeReviewStore = createStagedChangeReviewStore();
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
				}

				return result;
			},
			readSourcePath: (path) => this.readVaultSourcePath(path),
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
