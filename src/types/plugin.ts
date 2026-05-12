export const PLUGIN_ID = "voidbrain";
export const PLUGIN_NAME = "Voidbrain";
export const PLUGIN_VERSION = "0.1.0";
export const SHOW_STATUS_COMMAND_ID = "show-local-first-status";
export const SETTINGS_SCHEMA_VERSION = 1;

export type PrivacyMode = "local-first";
export type VaultScope = "active-vault";

export interface PluginMetadata {
	id: typeof PLUGIN_ID;
	name: typeof PLUGIN_NAME;
	version: typeof PLUGIN_VERSION;
}

export interface VoidbrainPluginSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	privacyMode: PrivacyMode;
	vaultScope: VaultScope;
	areCloudProvidersEnabled: boolean;
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
	areCloudProvidersEnabled: false,
	areStagedWritesRequired: true,
	shouldShowStatusNotices: true,
};
