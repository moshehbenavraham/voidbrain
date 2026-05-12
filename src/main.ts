import { Notice, Plugin } from "obsidian";
import "./styles.css";
import { DEFAULT_PLUGIN_SETTINGS, SHOW_STATUS_COMMAND_ID, type VoidbrainPluginSettings } from "./types/plugin";
import {
	type SettingsLoadStatus,
	type SettingsValidationError,
	loadPluginSettings,
	savePluginSettings,
} from "./utils/settings";

type CleanupCallback = () => void;

interface PluginRuntimeStatus {
	isLoaded: boolean;
	ownedResourceCount: number;
	settingsLoadErrorCount: number;
	settingsLoadStatus: SettingsLoadStatus;
}

export default class VoidbrainPlugin extends Plugin {
	private readonly cleanupCallbacks: CleanupCallback[] = [];
	private isRuntimeLoaded = false;
	private settings: VoidbrainPluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
	private settingsLoadErrors: SettingsValidationError[] = [];
	private settingsLoadStatus: SettingsLoadStatus = "defaulted";

	override async onload(): Promise<void> {
		const settingsLoadResult = await loadPluginSettings(this);
		this.settings = settingsLoadResult.settings;
		this.settingsLoadErrors = settingsLoadResult.errors;
		this.settingsLoadStatus = settingsLoadResult.status;
		this.isRuntimeLoaded = true;

		if (this.settings.shouldShowStatusNotices && settingsLoadResult.status === "recovered") {
			new Notice("voidbrain settings were reset to local-first defaults.", 5000);
		}

		this.addCommand({
			id: SHOW_STATUS_COMMAND_ID,
			name: "Show local-first status",
			callback: () => {
				const providerStatus = this.settings.areCloudProvidersEnabled
					? "Cloud provider workflows still require explicit review."
					: "Cloud provider workflows are disabled.";

				new Notice(`voidbrain is running locally. ${providerStatus}`, 5000);
			},
		});

		this.registerOwnedCleanup(() => {
			this.isRuntimeLoaded = false;
		});
	}

	override onunload(): void {
		this.runOwnedCleanups();
	}

	getRuntimeStatus(): PluginRuntimeStatus {
		return {
			isLoaded: this.isRuntimeLoaded,
			ownedResourceCount: this.cleanupCallbacks.length,
			settingsLoadErrorCount: this.settingsLoadErrors.length,
			settingsLoadStatus: this.settingsLoadStatus,
		};
	}

	getSettings(): VoidbrainPluginSettings {
		return { ...this.settings };
	}

	async saveSettings(settings: VoidbrainPluginSettings): Promise<void> {
		this.settings = await savePluginSettings(this, settings);
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
