import { type App, Notice, type Plugin, PluginSettingTab, Setting } from "obsidian";
import { listProviderModels, listProviders } from "../providers/provider-registry";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../types/plugin";
import { type ModelRole, type ProviderId, makeProviderId, makeProviderModelId } from "../types/providers";
import type { NormalizedVaultPath } from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";

export interface VoidbrainSettingsTabOptions {
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly saveSettings: (settings: VoidbrainPluginSettings) => Promise<void>;
}

type SettingsUpdater = (settings: VoidbrainPluginSettings) => VoidbrainPluginSettings;

const providerRoles: readonly ModelRole[] = ["chat", "embedding", "utility"];

const providerOptions = (): Record<string, string> => {
	const options: Record<string, string> = {
		"": "Not selected",
	};

	for (const provider of listProviders()) {
		options[provider.id] = provider.displayName;
	}

	return options;
};

const modelOptions = (providerId: ProviderId | null): Record<string, string> => {
	const options: Record<string, string> = {
		"": "Not selected",
	};

	if (providerId === null) {
		return options;
	}

	for (const model of listProviderModels(providerId)) {
		options[model.id] = model.displayName;
	}

	return options;
};

const parseExcludedFolders = (value: string): readonly NormalizedVaultPath[] => {
	const paths = value
		.split(",")
		.map((path) => path.trim())
		.filter((path) => path.length > 0);
	const normalizedPaths: NormalizedVaultPath[] = [];

	for (const path of paths) {
		const normalized = normalizeVaultPath(path);
		if (!normalized.ok) {
			throw new Error(normalized.errors[0]?.message ?? "Excluded folders must be vault-relative paths.");
		}

		normalizedPaths.push(normalized.value);
	}

	return normalizedPaths.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
};

export class VoidbrainSettingsTab extends PluginSettingTab {
	private isSaving = false;

	constructor(
		app: App,
		plugin: Plugin,
		private readonly options: VoidbrainSettingsTabOptions,
	) {
		super(app, plugin);
	}

	override display(): void {
		const settings = this.options.getSettings();
		this.containerEl.replaceChildren();
		this.containerEl.classList.add("voidbrain-settings");

		this.addPrivacySection(settings);
		this.addProviderSection(settings);
		this.addIndexingSection(settings);
		this.addUiSection(settings);
		this.addStatusSection(settings);
	}

	override hide(): void {
		this.containerEl.replaceChildren();
	}

	private addPrivacySection(settings: VoidbrainPluginSettings): void {
		new Setting(this.containerEl).setName("Privacy").setHeading();
		new Setting(this.containerEl)
			.setName("Cloud provider workflows")
			.setDesc("Explicit review is required before private vault content can leave this device.")
			.addToggle((toggle) =>
				toggle.setValue(settings.areCloudProvidersEnabled).onChange((value) =>
					this.persist((current) => ({
						...current,
						areCloudProvidersEnabled: value,
					})),
				),
			);
		new Setting(this.containerEl).setName("Default content sensitivity").addDropdown((dropdown) =>
			dropdown
				.addOptions({
					"private-vault": "Private vault",
					"vault-metadata": "Vault metadata",
					public: "Public",
				})
				.setValue(settings.defaultContentSensitivity)
				.onChange((value) =>
					this.persist((current) => ({
						...current,
						defaultContentSensitivity:
							value === "public" || value === "vault-metadata" ? value : "private-vault",
					})),
				),
		);
		new Setting(this.containerEl)
			.setName("Provider review")
			.setDesc("Required")
			.addToggle((toggle) => toggle.setValue(settings.shouldRequireProviderReview).setDisabled(true));
		new Setting(this.containerEl)
			.setName("Staged writes")
			.setDesc("Required")
			.addToggle((toggle) => toggle.setValue(settings.areStagedWritesRequired).setDisabled(true));
	}

	private addProviderSection(settings: VoidbrainPluginSettings): void {
		new Setting(this.containerEl).setName("Providers").setHeading();

		for (const role of providerRoles) {
			const selection = settings.providerRoles[role];
			new Setting(this.containerEl).setName(`${role} provider`).addDropdown((dropdown) =>
				dropdown
					.addOptions(providerOptions())
					.setValue(selection.providerId ?? "")
					.onChange((value) => {
						const providerId = value.length === 0 ? null : makeProviderId(value);
						void this.persist((current) => ({
							...current,
							providerRoles: {
								...current.providerRoles,
								[role]: {
									providerId,
									modelId: null,
								},
							},
						})).then(() => this.display());
					}),
			);
			new Setting(this.containerEl).setName(`${role} model`).addDropdown((dropdown) =>
				dropdown
					.addOptions(modelOptions(selection.providerId))
					.setValue(selection.modelId ?? "")
					.onChange((value) => {
						const modelId = value.length === 0 ? null : makeProviderModelId(value);
						void this.persist((current) => ({
							...current,
							providerRoles: {
								...current.providerRoles,
								[role]: {
									providerId: current.providerRoles[role].providerId,
									modelId,
								},
							},
						}));
					}),
			);
		}
	}

	private addIndexingSection(settings: VoidbrainPluginSettings): void {
		new Setting(this.containerEl).setName("Indexing").setHeading();
		new Setting(this.containerEl).setName("Lexical index").addToggle((toggle) =>
			toggle.setValue(settings.indexing.isLexicalIndexEnabled).onChange((value) =>
				this.persist((current) => ({
					...current,
					indexing: {
						...current.indexing,
						isLexicalIndexEnabled: value,
					},
				})),
			),
		);
		new Setting(this.containerEl).setName("Semantic index").addToggle((toggle) =>
			toggle.setValue(settings.indexing.isSemanticIndexEnabled).onChange((value) =>
				this.persist((current) => ({
					...current,
					indexing: {
						...current.indexing,
						isSemanticIndexEnabled: value,
					},
				})),
			),
		);
		new Setting(this.containerEl).setName("Index on startup").addToggle((toggle) =>
			toggle.setValue(settings.indexing.shouldIndexOnStartup).onChange((value) =>
				this.persist((current) => ({
					...current,
					indexing: {
						...current.indexing,
						shouldIndexOnStartup: value,
					},
				})),
			),
		);
		new Setting(this.containerEl).setName("Maximum note size").addSlider((slider) =>
			slider
				.setLimits(1000, 5000000, 1000)
				.setValue(settings.indexing.maxNoteBytes)
				.onChange((value) =>
					this.persist((current) => ({
						...current,
						indexing: {
							...current.indexing,
							maxNoteBytes: value,
						},
					})),
				),
		);
		new Setting(this.containerEl).setName("Excluded folders").addText((text) =>
			text.setValue(settings.indexing.excludedFolders.join(", ")).onChange((value) =>
				this.persist((current) => ({
					...current,
					indexing: {
						...current.indexing,
						excludedFolders: parseExcludedFolders(value),
					},
				})),
			),
		);
	}

	private addUiSection(settings: VoidbrainPluginSettings): void {
		new Setting(this.containerEl).setName("Interface").setHeading();
		new Setting(this.containerEl).setName("Status view location").addDropdown((dropdown) =>
			dropdown
				.addOptions({
					"right-sidebar": "Right sidebar",
					"left-sidebar": "Left sidebar",
				})
				.setValue(settings.ui.statusViewLocation)
				.onChange((value) =>
					this.persist((current) => ({
						...current,
						ui: {
							...current.ui,
							statusViewLocation: value === "left-sidebar" ? "left-sidebar" : "right-sidebar",
						},
					})),
				),
		);
		new Setting(this.containerEl).setName("Open status on load").addToggle((toggle) =>
			toggle.setValue(settings.ui.shouldOpenStatusOnLoad).onChange((value) =>
				this.persist((current) => ({
					...current,
					ui: {
						...current.ui,
						shouldOpenStatusOnLoad: value,
					},
				})),
			),
		);
	}

	private addStatusSection(settings: VoidbrainPluginSettings): void {
		new Setting(this.containerEl).setName("Status Sections").setHeading();
		this.addStatusToggle("Provider status", "shouldShowProviderStatus", settings);
		this.addStatusToggle("Index status", "shouldShowIndexStatus", settings);
		this.addStatusToggle("Staged-change status", "shouldShowStagedChangeStatus", settings);
		this.addStatusToggle("Health status", "shouldShowHealthStatus", settings);
		new Setting(this.containerEl).setName("Reset runtime settings").addButton((button) =>
			button.setButtonText("Reset").onClick(() => {
				void this.persist(() => ({
					...DEFAULT_PLUGIN_SETTINGS,
					trustedProviderIds: [...DEFAULT_PLUGIN_SETTINGS.trustedProviderIds],
					providerRoles: {
						chat: { ...DEFAULT_PLUGIN_SETTINGS.providerRoles.chat },
						embedding: { ...DEFAULT_PLUGIN_SETTINGS.providerRoles.embedding },
						utility: { ...DEFAULT_PLUGIN_SETTINGS.providerRoles.utility },
					},
					indexing: {
						...DEFAULT_PLUGIN_SETTINGS.indexing,
						excludedFolders: [...DEFAULT_PLUGIN_SETTINGS.indexing.excludedFolders],
					},
					ui: { ...DEFAULT_PLUGIN_SETTINGS.ui },
					status: { ...DEFAULT_PLUGIN_SETTINGS.status },
				})).then(() => this.display());
			}),
		);
	}

	private addStatusToggle(
		label: string,
		key: keyof VoidbrainPluginSettings["status"],
		settings: VoidbrainPluginSettings,
	): void {
		new Setting(this.containerEl).setName(label).addToggle((toggle) =>
			toggle.setValue(settings.status[key]).onChange((value) =>
				this.persist((current) => ({
					...current,
					status: {
						...current.status,
						[key]: value,
					},
				})),
			),
		);
	}

	private async persist(updater: SettingsUpdater): Promise<void> {
		if (this.isSaving) {
			new Notice("Voidbrain settings save is already in progress.", 4000);
			return;
		}

		this.isSaving = true;
		try {
			await this.options.saveSettings(updater(this.options.getSettings()));
		} catch {
			new Notice("Voidbrain settings could not be saved. Local-first defaults remain available.", 7000);
		} finally {
			this.isSaving = false;
		}
	}
}
