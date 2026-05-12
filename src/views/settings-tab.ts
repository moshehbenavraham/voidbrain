import { type App, Notice, type Plugin, PluginSettingTab, Setting } from "obsidian";
import {
	buildProviderDefinitionsForSettings,
	parseProviderProfile,
	runProviderAuthTest,
	summarizeProviderRoleCapabilities,
	summarizeProviderSetup,
} from "../providers";
import type { ProviderSecretStore } from "../providers/secret-store";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../types/plugin";
import type { UserProviderProfile, UserProviderProfileKind } from "../types/provider-setup";
import {
	type ModelRole,
	type ProviderDefinition,
	type ProviderId,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";
import type { NormalizedVaultPath } from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";

export interface VoidbrainSettingsTabOptions {
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly saveSettings: (settings: VoidbrainPluginSettings) => Promise<void>;
	readonly secretStore?: ProviderSecretStore;
}

type SettingsUpdater = (settings: VoidbrainPluginSettings) => VoidbrainPluginSettings;

const providerRoles: readonly ModelRole[] = ["chat", "embedding", "utility"];

const providerOptions = (providers: readonly ProviderDefinition[]): Record<string, string> => {
	const options: Record<string, string> = {
		"": "Not selected",
	};

	for (const provider of providers) {
		options[provider.id] = provider.displayName;
	}

	return options;
};

const modelOptions = (
	providers: readonly ProviderDefinition[],
	providerId: ProviderId | null,
): Record<string, string> => {
	const options: Record<string, string> = {
		"": "Not selected",
	};

	if (providerId === null) {
		return options;
	}

	const provider = providers.find((candidate) => candidate.id === providerId);
	if (provider === undefined) {
		return options;
	}

	for (const model of provider.models) {
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
	private readonly inFlightProviderActions = new Set<string>();

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
		const providers = buildProviderDefinitionsForSettings(settings);
		const setupSummary = summarizeProviderSetup(settings, providers);
		const roleSummaries = summarizeProviderRoleCapabilities(settings, providers);
		new Setting(this.containerEl).setName("Providers").setHeading();
		new Setting(this.containerEl)
			.setName("Provider setup readiness")
			.setDesc(`${setupSummary.severity}: ${setupSummary.details.join(" ")}`);

		this.addProviderProfileControls(settings);
		this.addCloudTrustControls(settings, providers);

		for (const role of providerRoles) {
			const selection = settings.providerRoles[role];
			const roleSummary = roleSummaries.find((summary) => summary.role === role);
			new Setting(this.containerEl)
				.setName(`${role} provider`)
				.setDesc(roleSummary?.message ?? "Provider role status is unavailable.")
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(providerOptions(providers))
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
					.addOptions(modelOptions(providers, selection.providerId))
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

	private addProviderProfileControls(settings: VoidbrainPluginSettings): void {
		let profileKind: UserProviderProfileKind = "local";
		let providerId = "";
		let displayName = "";
		let endpointUrl = "http://127.0.0.1:11434/v1";
		let chatModelId = "";
		let embeddingModelId = "";
		let runtimeCredential = "";

		new Setting(this.containerEl).setName("New provider profile").setHeading();
		new Setting(this.containerEl).setName("Profile kind").addDropdown((dropdown) =>
			dropdown
				.addOptions({
					local: "Local",
					"openai-compatible": "OpenAI-compatible",
				})
				.setValue(profileKind)
				.onChange((value) => {
					profileKind = value === "openai-compatible" ? "openai-compatible" : "local";
					endpointUrl =
						profileKind === "local" ? "http://127.0.0.1:11434/v1" : "https://provider.example.invalid/v1";
				}),
		);
		new Setting(this.containerEl).setName("Provider ID").addText((text) =>
			text.setPlaceholder("my-provider").onChange((value) => {
				providerId = value;
			}),
		);
		new Setting(this.containerEl).setName("Display name").addText((text) =>
			text.setPlaceholder("My Provider").onChange((value) => {
				displayName = value;
			}),
		);
		new Setting(this.containerEl).setName("Endpoint URL").addText((text) =>
			text
				.setPlaceholder(endpointUrl)
				.setValue(endpointUrl)
				.onChange((value) => {
					endpointUrl = value;
				}),
		);
		new Setting(this.containerEl).setName("Chat model ID").addText((text) =>
			text.setPlaceholder("model-chat").onChange((value) => {
				chatModelId = value;
			}),
		);
		new Setting(this.containerEl).setName("Embedding model ID").addText((text) =>
			text.setPlaceholder("model-embedding").onChange((value) => {
				embeddingModelId = value;
			}),
		);
		new Setting(this.containerEl)
			.setName("Runtime credential")
			.setDesc("Stored through the runtime secret boundary; settings keep only an opaque reference.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Optional").onChange((value) => {
					runtimeCredential = value;
				});
			});
		new Setting(this.containerEl).setName("Save provider profile").addButton((button) =>
			button.setButtonText("Save").onClick(() => {
				void this.runProviderAction("save-profile", async () => {
					const profile = await this.createProviderProfile({
						profileKind,
						providerId,
						displayName,
						endpointUrl,
						chatModelId,
						embeddingModelId,
						runtimeCredential,
					});

					if (profile === null) {
						return;
					}

					await this.persist((current) => ({
						...current,
						providerProfiles: replaceProviderProfile(current.providerProfiles, profile),
						trustedProviderIds: removeProviderId(current.trustedProviderIds, profile.id),
						providerAuthStatuses: current.providerAuthStatuses.filter(
							(status) => status.providerId !== profile.id,
						),
						providerRoles: resetRoleModelsForProvider(current.providerRoles, profile.id),
					}));
					this.display();
				});
			}),
		);

		for (const profile of settings.providerProfiles) {
			this.addPersistedProviderProfileControl(settings, profile);
		}
	}

	private addPersistedProviderProfileControl(settings: VoidbrainPluginSettings, profile: UserProviderProfile): void {
		const authStatus = settings.providerAuthStatuses.find((status) => status.providerId === profile.id);
		const statusText = authStatus?.status ?? "untested";
		const profileSummary = `${profile.profileKind}; ${profile.endpoint.hostname ?? "local runtime"}; auth ${statusText}.`;
		new Setting(this.containerEl)
			.setName(profile.displayName)
			.setDesc(profileSummary)
			.addButton((button) =>
				button
					.setButtonText("Test")
					.setDisabled(this.inFlightProviderActions.has(`auth:${profile.id}`))
					.onClick(() => {
						void this.runProviderAction(`auth:${profile.id}`, async () => {
							const authRecord = await runProviderAuthTest(
								profile,
								this.options.secretStore === undefined ? {} : { secretStore: this.options.secretStore },
							);
							await this.persist((current) => ({
								...current,
								providerAuthStatuses: replaceAuthStatus(current.providerAuthStatuses, authRecord),
							}));
							this.display();
						});
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Delete reference")
					.setDisabled(profile.credentialReference === null)
					.onClick(() => {
						void this.runProviderAction(`delete-reference:${profile.id}`, async () => {
							if (profile.credentialReference !== null) {
								await this.options.secretStore?.delete(profile.credentialReference);
							}
							await this.persist((current) => ({
								...current,
								providerProfiles: current.providerProfiles.map((currentProfile) =>
									currentProfile.id === profile.id
										? { ...currentProfile, credentialReference: null }
										: currentProfile,
								),
								providerAuthStatuses: current.providerAuthStatuses.filter(
									(status) => status.providerId !== profile.id,
								),
							}));
							this.display();
						});
					}),
			)
			.addButton((button) =>
				button.setButtonText("Delete").onClick(() => {
					void this.runProviderAction(`delete-profile:${profile.id}`, async () => {
						if (profile.credentialReference !== null) {
							await this.options.secretStore?.delete(profile.credentialReference);
						}
						await this.persist((current) => ({
							...current,
							providerProfiles: current.providerProfiles.filter(
								(currentProfile) => currentProfile.id !== profile.id,
							),
							trustedProviderIds: removeProviderId(current.trustedProviderIds, profile.id),
							providerAuthStatuses: current.providerAuthStatuses.filter(
								(status) => status.providerId !== profile.id,
							),
							providerRoles: resetRoleProvider(current.providerRoles, profile.id),
						}));
						this.display();
					});
				}),
			);
	}

	private addCloudTrustControls(settings: VoidbrainPluginSettings, providers: readonly ProviderDefinition[]): void {
		const cloudProviders = providers.filter((provider) => provider.kind === "cloud");

		if (cloudProviders.length === 0) {
			return;
		}

		new Setting(this.containerEl).setName("Cloud trust").setHeading();
		for (const provider of cloudProviders) {
			const canTrust = provider.trustLevel === "trusted-cloud";
			new Setting(this.containerEl)
				.setName(provider.displayName)
				.setDesc(
					canTrust
						? "Approved per provider for cloud workflows."
						: "This provider cannot be trusted for private vault content.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(settings.trustedProviderIds.includes(provider.id))
						.setDisabled(!canTrust)
						.onChange((isTrusted) =>
							this.persist((current) => ({
								...current,
								trustedProviderIds: isTrusted
									? addProviderId(current.trustedProviderIds, provider.id)
									: removeProviderId(current.trustedProviderIds, provider.id),
							})),
						),
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

	private async createProviderProfile(input: {
		readonly profileKind: UserProviderProfileKind;
		readonly providerId: string;
		readonly displayName: string;
		readonly endpointUrl: string;
		readonly chatModelId: string;
		readonly embeddingModelId: string;
		readonly runtimeCredential: string;
	}): Promise<UserProviderProfile | null> {
		const providerId = input.providerId.trim();
		const displayName = input.displayName.trim();
		const chatModelId = input.chatModelId.trim() || `${providerId}-chat`;
		const embeddingModelId = input.embeddingModelId.trim() || `${providerId}-embedding`;
		const credentialValue = input.runtimeCredential.trim();
		let credentialReference: UserProviderProfile["credentialReference"] = null;
		const rawProfile = {
			id: providerId,
			displayName,
			profileKind: input.profileKind,
			providerKind: input.profileKind === "local" ? "local" : "cloud",
			trustLevel: input.profileKind === "local" ? "local-runtime" : "trusted-cloud",
			endpoint: {
				baseUrl: input.endpointUrl.trim(),
			},
			credentialReference,
			models: [
				{
					id: chatModelId,
					displayName: `${displayName} Chat`,
					roles: ["chat"],
					capabilities: ["chat", "streaming"],
					isDefault: true,
				},
				{
					id: embeddingModelId,
					displayName: `${displayName} Embedding`,
					roles: ["embedding"],
					capabilities: ["embeddings"],
					embeddingFamily: `${providerId}-embeddings`,
				},
			],
		};
		const initialProfile = parseProviderProfile(rawProfile);

		if (!initialProfile.ok) {
			new Notice(initialProfile.errors[0]?.message ?? "Provider profile is invalid.", 7000);
			return null;
		}

		if (credentialValue.length > 0) {
			if (this.options.secretStore === undefined) {
				new Notice(
					"Provider credential could not be saved because no runtime secret store is available.",
					7000,
				);
				return null;
			}

			const savedReference = await this.options.secretStore.save({
				providerId,
				label: displayName.length > 0 ? displayName : providerId,
				value: credentialValue,
			});
			if (!savedReference.ok) {
				new Notice("Provider credential could not be saved. No settings were changed.", 7000);
				return null;
			}
			credentialReference = savedReference.value;
		}

		const parsedProfile = parseProviderProfile({
			...rawProfile,
			credentialReference,
		});

		if (!parsedProfile.ok) {
			new Notice(parsedProfile.errors[0]?.message ?? "Provider profile is invalid.", 7000);
			return null;
		}

		return parsedProfile.profile;
	}

	private async runProviderAction(actionKey: string, action: () => Promise<void>): Promise<void> {
		if (this.inFlightProviderActions.has(actionKey)) {
			new Notice("Provider setup action is already in progress.", 4000);
			return;
		}

		this.inFlightProviderActions.add(actionKey);
		try {
			await action();
		} catch {
			new Notice("Provider setup action failed. No vault files were changed.", 7000);
		} finally {
			this.inFlightProviderActions.delete(actionKey);
		}
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

const replaceProviderProfile = (
	profiles: readonly UserProviderProfile[],
	profile: UserProviderProfile,
): readonly UserProviderProfile[] =>
	[...profiles.filter((currentProfile) => currentProfile.id !== profile.id), profile].sort((left, right) =>
		left.id.localeCompare(right.id, "en", { sensitivity: "base" }),
	);

const replaceAuthStatus = (
	statuses: VoidbrainPluginSettings["providerAuthStatuses"],
	status: VoidbrainPluginSettings["providerAuthStatuses"][number],
): VoidbrainPluginSettings["providerAuthStatuses"] =>
	[...statuses.filter((currentStatus) => currentStatus.providerId !== status.providerId), status].sort(
		(left, right) => left.providerId.localeCompare(right.providerId, "en", { sensitivity: "base" }),
	);

const addProviderId = (providerIds: readonly ProviderId[], providerId: ProviderId): readonly ProviderId[] =>
	[...new Set([...providerIds, providerId])].sort((left, right) =>
		left.localeCompare(right, "en", { sensitivity: "base" }),
	);

const removeProviderId = (providerIds: readonly ProviderId[], providerId: ProviderId): readonly ProviderId[] =>
	providerIds.filter((currentProviderId) => currentProviderId !== providerId);

const resetRoleModelsForProvider = (
	roles: VoidbrainPluginSettings["providerRoles"],
	providerId: ProviderId,
): VoidbrainPluginSettings["providerRoles"] => ({
	chat: roles.chat.providerId === providerId ? { providerId, modelId: null } : { ...roles.chat },
	embedding: roles.embedding.providerId === providerId ? { providerId, modelId: null } : { ...roles.embedding },
	utility: roles.utility.providerId === providerId ? { providerId, modelId: null } : { ...roles.utility },
});

const resetRoleProvider = (
	roles: VoidbrainPluginSettings["providerRoles"],
	providerId: ProviderId,
): VoidbrainPluginSettings["providerRoles"] => ({
	chat: roles.chat.providerId === providerId ? { providerId: null, modelId: null } : { ...roles.chat },
	embedding: roles.embedding.providerId === providerId ? { providerId: null, modelId: null } : { ...roles.embedding },
	utility: roles.utility.providerId === providerId ? { providerId: null, modelId: null } : { ...roles.utility },
});
