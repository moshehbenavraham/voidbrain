import type { AgentCommandId } from "./agent-commands";
import type { ContentSensitivity, ModelRole, ProviderId, ProviderModelId } from "./providers";
import type { NormalizedVaultPath } from "./vault";

export const PLUGIN_ID = "voidbrain";
export const PLUGIN_NAME = "Voidbrain";
export const PLUGIN_VERSION = "0.1.0";
export const SHOW_STATUS_COMMAND_ID = "show-local-first-status";
export const SETTINGS_SCHEMA_VERSION = 2;

export type PrivacyMode = "local-first";
export type VaultScope = "active-vault";
export type StatusViewLocation = "right-sidebar" | "left-sidebar";

export interface ProviderRoleSelection {
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
}

export type ProviderRoleSettings = Readonly<Record<ModelRole, ProviderRoleSelection>>;

export interface IndexingPreferences {
	readonly isLexicalIndexEnabled: boolean;
	readonly isSemanticIndexEnabled: boolean;
	readonly shouldIndexOnStartup: boolean;
	readonly excludedFolders: readonly NormalizedVaultPath[];
	readonly maxNoteBytes: number;
}

export interface PluginUiState {
	readonly statusViewLocation: StatusViewLocation;
	readonly shouldOpenStatusOnLoad: boolean;
	readonly lastOpenedCommandId: AgentCommandId | null;
}

export interface StatusSurfaceSettings {
	readonly shouldShowProviderStatus: boolean;
	readonly shouldShowIndexStatus: boolean;
	readonly shouldShowStagedChangeStatus: boolean;
	readonly shouldShowHealthStatus: boolean;
}

export interface PluginMetadata {
	id: typeof PLUGIN_ID;
	name: typeof PLUGIN_NAME;
	version: typeof PLUGIN_VERSION;
}

export interface VoidbrainPluginSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	privacyMode: PrivacyMode;
	vaultScope: VaultScope;
	defaultContentSensitivity: ContentSensitivity;
	areCloudProvidersEnabled: boolean;
	shouldRequireProviderReview: boolean;
	trustedProviderIds: readonly ProviderId[];
	providerRoles: ProviderRoleSettings;
	indexing: IndexingPreferences;
	ui: PluginUiState;
	status: StatusSurfaceSettings;
	areStagedWritesRequired: boolean;
	shouldShowStatusNotices: boolean;
}

export const PLUGIN_METADATA: PluginMetadata = {
	id: PLUGIN_ID,
	name: PLUGIN_NAME,
	version: PLUGIN_VERSION,
};

export const DEFAULT_PLUGIN_SETTINGS: VoidbrainPluginSettings = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	privacyMode: "local-first",
	vaultScope: "active-vault",
	defaultContentSensitivity: "private-vault",
	areCloudProvidersEnabled: false,
	shouldRequireProviderReview: true,
	trustedProviderIds: [],
	providerRoles: {
		chat: {
			providerId: null,
			modelId: null,
		},
		embedding: {
			providerId: null,
			modelId: null,
		},
		utility: {
			providerId: null,
			modelId: null,
		},
	},
	indexing: {
		isLexicalIndexEnabled: true,
		isSemanticIndexEnabled: false,
		shouldIndexOnStartup: false,
		excludedFolders: [],
		maxNoteBytes: 250000,
	},
	ui: {
		statusViewLocation: "right-sidebar",
		shouldOpenStatusOnLoad: false,
		lastOpenedCommandId: null,
	},
	status: {
		shouldShowProviderStatus: true,
		shouldShowIndexStatus: true,
		shouldShowStagedChangeStatus: true,
		shouldShowHealthStatus: true,
	},
	areStagedWritesRequired: true,
	shouldShowStatusNotices: true,
};
