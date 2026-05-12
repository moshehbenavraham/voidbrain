import type { Plugin } from "obsidian";
import { getAgentCommandById } from "../agent/command-catalog";
import { findRegisteredModel, findRegisteredProvider } from "../providers/provider-registry";
import {
	DEFAULT_PLUGIN_SETTINGS,
	type IndexingPreferences,
	type PluginUiState,
	type ProviderRoleSelection,
	type ProviderRoleSettings,
	SETTINGS_SCHEMA_VERSION,
	type StatusSurfaceSettings,
	type StatusViewLocation,
	type VoidbrainPluginSettings,
} from "../types/plugin";
import {
	type ModelRole,
	type ProviderId,
	type ProviderModelId,
	isContentSensitivity,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";
import type { NormalizedVaultPath } from "../types/vault";
import { normalizeVaultPath } from "./vault-paths";

export type SettingsValidationCode =
	| "invalid-type"
	| "unsupported-value"
	| "unsupported-schema"
	| "storage-read-failed"
	| "storage-write-failed";

export type SettingsLoadStatus = "defaulted" | "loaded" | "recovered";

export interface SettingsValidationError {
	code: SettingsValidationCode;
	field: string;
	message: string;
}

export interface SettingsLoadResult {
	settings: VoidbrainPluginSettings;
	status: SettingsLoadStatus;
	errors: SettingsValidationError[];
}

type PluginDataLoader = Pick<Plugin, "loadData">;
type PluginDataWriter = Pick<Plugin, "saveData">;
type SupportedSettingsSchemaVersion = 1 | typeof SETTINGS_SCHEMA_VERSION;

export class PluginSettingsError extends Error {
	readonly code: SettingsValidationCode;
	readonly errors: SettingsValidationError[];

	constructor(code: SettingsValidationCode, message: string, errors: SettingsValidationError[]) {
		super(message);
		this.name = "PluginSettingsError";
		this.code = code;
		this.errors = errors;
	}
}

export const createDefaultPluginSettings = (): VoidbrainPluginSettings => {
	return {
		...DEFAULT_PLUGIN_SETTINGS,
		trustedProviderIds: [...DEFAULT_PLUGIN_SETTINGS.trustedProviderIds],
		providerRoles: cloneProviderRoles(DEFAULT_PLUGIN_SETTINGS.providerRoles),
		indexing: {
			...DEFAULT_PLUGIN_SETTINGS.indexing,
			excludedFolders: [...DEFAULT_PLUGIN_SETTINGS.indexing.excludedFolders],
		},
		ui: { ...DEFAULT_PLUGIN_SETTINGS.ui },
		status: { ...DEFAULT_PLUGIN_SETTINGS.status },
	};
};

export const loadPluginSettings = async (plugin: PluginDataLoader): Promise<SettingsLoadResult> => {
	try {
		const persistedSettings = await plugin.loadData();

		return parsePluginSettings(persistedSettings);
	} catch {
		return {
			settings: createDefaultPluginSettings(),
			status: "recovered",
			errors: [
				{
					code: "storage-read-failed",
					field: "root",
					message: "Stored plugin settings could not be read; local-first defaults were applied.",
				},
			],
		};
	}
};

export const savePluginSettings = async (
	plugin: PluginDataWriter,
	settings: VoidbrainPluginSettings,
): Promise<VoidbrainPluginSettings> => {
	const validation = parsePluginSettings(settings);

	if (validation.errors.length > 0) {
		throw new PluginSettingsError(
			"unsupported-value",
			"Plugin settings failed validation before save.",
			validation.errors,
		);
	}

	try {
		await plugin.saveData(validation.settings);
		return validation.settings;
	} catch {
		const errors: SettingsValidationError[] = [
			{
				code: "storage-write-failed",
				field: "root",
				message: "Plugin settings could not be saved.",
			},
		];

		throw new PluginSettingsError("storage-write-failed", "Plugin settings could not be saved.", errors);
	}
};

export const parsePluginSettings = (rawSettings: unknown): SettingsLoadResult => {
	if (rawSettings === null || rawSettings === undefined) {
		return {
			settings: createDefaultPluginSettings(),
			status: "defaulted",
			errors: [],
		};
	}

	if (!isRecord(rawSettings)) {
		return {
			settings: createDefaultPluginSettings(),
			status: "recovered",
			errors: [
				{
					code: "invalid-type",
					field: "root",
					message: "Stored plugin settings must be an object; local-first defaults were applied.",
				},
			],
		};
	}

	const schemaVersion = readSchemaVersion(rawSettings);

	if (!schemaVersion.ok) {
		return {
			settings: createDefaultPluginSettings(),
			status: "recovered",
			errors: [schemaVersion.error],
		};
	}

	const errors: SettingsValidationError[] = [];
	const areCloudProvidersEnabled = readBoolean(rawSettings, "areCloudProvidersEnabled", false, errors);
	const trustedProviderErrorStart = errors.length;
	const trustedProviderIds = readProviderIdArray(rawSettings, "trustedProviderIds", errors);
	const hasTrustedProviderErrors = errors.length > trustedProviderErrorStart;
	const settings: VoidbrainPluginSettings = {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		privacyMode: readLiteral(rawSettings, "privacyMode", "local-first", errors),
		vaultScope: readLiteral(rawSettings, "vaultScope", "active-vault", errors),
		defaultContentSensitivity: readContentSensitivity(rawSettings, "defaultContentSensitivity", errors),
		areCloudProvidersEnabled: hasTrustedProviderErrors ? false : areCloudProvidersEnabled,
		shouldRequireProviderReview: readRequiredTrue(rawSettings, "shouldRequireProviderReview", errors),
		trustedProviderIds,
		providerRoles: readProviderRoleSettings(rawSettings, errors),
		indexing: readIndexingPreferences(rawSettings, errors),
		ui: readPluginUiState(rawSettings, errors),
		status: readStatusSurfaceSettings(rawSettings, errors),
		areStagedWritesRequired: readRequiredTrue(rawSettings, "areStagedWritesRequired", errors),
		shouldShowStatusNotices: readBoolean(rawSettings, "shouldShowStatusNotices", true, errors),
	};

	return {
		settings,
		status: errors.length > 0 ? "recovered" : "loaded",
		errors,
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const cloneProviderRoles = (roles: ProviderRoleSettings): ProviderRoleSettings => ({
	chat: { ...roles.chat },
	embedding: { ...roles.embedding },
	utility: { ...roles.utility },
});

const settingError = (code: SettingsValidationCode, field: string, message: string): SettingsValidationError => ({
	code,
	field,
	message,
});

const readSchemaVersion = (
	source: Record<string, unknown>,
):
	| { readonly ok: true; readonly version: SupportedSettingsSchemaVersion }
	| { readonly ok: false; readonly error: SettingsValidationError } => {
	const schemaVersion = source.schemaVersion;

	if (schemaVersion === undefined) {
		return { ok: true, version: 1 };
	}

	if (schemaVersion !== 1 && schemaVersion !== SETTINGS_SCHEMA_VERSION) {
		return {
			ok: false,
			error:
				typeof schemaVersion === "number"
					? settingError(
							"unsupported-schema",
							"schemaVersion",
							`Settings schema must be 1 or ${SETTINGS_SCHEMA_VERSION}; local-first defaults were applied.`,
						)
					: settingError(
							"invalid-type",
							"schemaVersion",
							"Settings schema version must be a number; local-first defaults were applied.",
						),
		};
	}

	return { ok: true, version: schemaVersion };
};

const readLiteral = <Value extends string>(
	source: Record<string, unknown>,
	field: keyof VoidbrainPluginSettings,
	expectedValue: Value,
	errors: SettingsValidationError[],
): Value => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return expectedValue;
	}

	if (rawValue === expectedValue) {
		return expectedValue;
	}

	errors.push({
		code: "unsupported-value",
		field,
		message: `${field} must be ${expectedValue}; default value was applied.`,
	});

	return expectedValue;
};

const readRequiredTrue = (
	source: Record<string, unknown>,
	field: keyof VoidbrainPluginSettings,
	errors: SettingsValidationError[],
): true => {
	const rawValue = source[field];

	if (rawValue === undefined || rawValue === true) {
		return true;
	}

	errors.push(
		settingError("unsupported-value", field, `${field} must stay enabled; local-first default was applied.`),
	);

	return true;
};

const readBoolean = (
	source: Record<string, unknown>,
	field: string,
	defaultValue: boolean,
	errors: SettingsValidationError[],
): boolean => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return defaultValue;
	}

	if (typeof rawValue === "boolean") {
		return rawValue;
	}

	errors.push({
		code: "invalid-type",
		field,
		message: `${field} must be a boolean; default value was applied.`,
	});

	return defaultValue;
};

const readContentSensitivity = (
	source: Record<string, unknown>,
	field: keyof VoidbrainPluginSettings,
	errors: SettingsValidationError[],
) => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return DEFAULT_PLUGIN_SETTINGS.defaultContentSensitivity;
	}

	if (isContentSensitivity(rawValue)) {
		return rawValue;
	}

	errors.push(
		settingError(
			"unsupported-value",
			field,
			`${field} must be a supported content sensitivity; private-vault default was applied.`,
		),
	);

	return DEFAULT_PLUGIN_SETTINGS.defaultContentSensitivity;
};

const readRecordField = (
	source: Record<string, unknown>,
	field: string,
	errors: SettingsValidationError[],
): Record<string, unknown> | undefined => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return undefined;
	}

	if (isRecord(rawValue)) {
		return rawValue;
	}

	errors.push(settingError("invalid-type", field, `${field} must be an object; defaults were applied.`));
	return undefined;
};

const readProviderId = (rawValue: unknown, field: string, errors: SettingsValidationError[]): ProviderId | null => {
	if (rawValue === undefined || rawValue === null) {
		return null;
	}

	if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
		errors.push(settingError("invalid-type", field, `${field} must be a registered provider ID or null.`));
		return null;
	}

	const providerId = makeProviderId(rawValue.trim());
	if (findRegisteredProvider(providerId) === undefined) {
		errors.push(settingError("unsupported-value", field, `${field} references an unknown provider.`));
		return null;
	}

	return providerId;
};

const readProviderModelId = (
	rawValue: unknown,
	providerId: ProviderId | null,
	field: string,
	errors: SettingsValidationError[],
): ProviderModelId | null => {
	if (rawValue === undefined || rawValue === null) {
		return null;
	}

	if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
		errors.push(settingError("invalid-type", field, `${field} must be a registered provider model ID or null.`));
		return null;
	}

	if (providerId === null) {
		errors.push(settingError("unsupported-value", field, `${field} requires a selected provider.`));
		return null;
	}

	const modelId = makeProviderModelId(rawValue.trim());
	if (findRegisteredModel(providerId, modelId) === undefined) {
		errors.push(settingError("unsupported-value", field, `${field} references an unknown provider model.`));
		return null;
	}

	return modelId;
};

const readProviderRoleSelection = (
	rawValue: unknown,
	role: ModelRole,
	errors: SettingsValidationError[],
): ProviderRoleSelection => {
	const defaults = DEFAULT_PLUGIN_SETTINGS.providerRoles[role];
	const field = `providerRoles.${role}`;

	if (rawValue === undefined) {
		return { ...defaults };
	}

	if (!isRecord(rawValue)) {
		errors.push(settingError("invalid-type", field, `${field} must be an object; role default was applied.`));
		return { ...defaults };
	}

	const providerId = readProviderId(rawValue.providerId, `${field}.providerId`, errors);
	const modelId = readProviderModelId(rawValue.modelId, providerId, `${field}.modelId`, errors);

	return { providerId, modelId };
};

const readProviderRoleSettings = (
	source: Record<string, unknown>,
	errors: SettingsValidationError[],
): ProviderRoleSettings => {
	const rawRoles = readRecordField(source, "providerRoles", errors);

	if (rawRoles === undefined) {
		return cloneProviderRoles(DEFAULT_PLUGIN_SETTINGS.providerRoles);
	}

	return {
		chat: readProviderRoleSelection(rawRoles.chat, "chat", errors),
		embedding: readProviderRoleSelection(rawRoles.embedding, "embedding", errors),
		utility: readProviderRoleSelection(rawRoles.utility, "utility", errors),
	};
};

const readPositiveInteger = (
	source: Record<string, unknown>,
	field: string,
	defaultValue: number,
	errors: SettingsValidationError[],
	options: { readonly minimum: number; readonly maximum: number },
): number => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return defaultValue;
	}

	if (
		typeof rawValue === "number" &&
		Number.isInteger(rawValue) &&
		rawValue >= options.minimum &&
		rawValue <= options.maximum
	) {
		return rawValue;
	}

	errors.push(
		settingError(
			"unsupported-value",
			field,
			`${field} must be an integer from ${options.minimum} to ${options.maximum}; default was applied.`,
		),
	);

	return defaultValue;
};

const readVaultPathArray = (
	source: Record<string, unknown>,
	field: string,
	errors: SettingsValidationError[],
): readonly NormalizedVaultPath[] => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return [];
	}

	if (!Array.isArray(rawValue)) {
		errors.push(settingError("invalid-type", field, `${field} must be an array of vault-relative paths.`));
		return [];
	}

	const normalizedPaths: NormalizedVaultPath[] = [];
	const seenPaths = new Set<string>();

	for (const [index, value] of rawValue.entries()) {
		const normalized = normalizeVaultPath(value);
		if (!normalized.ok) {
			errors.push(
				...normalized.errors.map((error) =>
					settingError("unsupported-value", `${field}[${index}]`, error.message),
				),
			);
			return [];
		}

		if (!seenPaths.has(normalized.value)) {
			seenPaths.add(normalized.value);
			normalizedPaths.push(normalized.value);
		}
	}

	return normalizedPaths.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
};

const readIndexingPreferences = (
	source: Record<string, unknown>,
	errors: SettingsValidationError[],
): IndexingPreferences => {
	const rawIndexing = readRecordField(source, "indexing", errors);
	const defaults = DEFAULT_PLUGIN_SETTINGS.indexing;

	if (rawIndexing === undefined) {
		return {
			...defaults,
			excludedFolders: [...defaults.excludedFolders],
		};
	}

	return {
		isLexicalIndexEnabled: readBoolean(
			rawIndexing,
			"isLexicalIndexEnabled",
			defaults.isLexicalIndexEnabled,
			errors,
		),
		isSemanticIndexEnabled: readBoolean(
			rawIndexing,
			"isSemanticIndexEnabled",
			defaults.isSemanticIndexEnabled,
			errors,
		),
		shouldIndexOnStartup: readBoolean(rawIndexing, "shouldIndexOnStartup", defaults.shouldIndexOnStartup, errors),
		excludedFolders: readVaultPathArray(rawIndexing, "excludedFolders", errors),
		maxNoteBytes: readPositiveInteger(rawIndexing, "maxNoteBytes", defaults.maxNoteBytes, errors, {
			minimum: 1000,
			maximum: 5000000,
		}),
	};
};

const readStatusViewLocation = (
	rawValue: unknown,
	field: string,
	errors: SettingsValidationError[],
): StatusViewLocation => {
	if (rawValue === undefined) {
		return DEFAULT_PLUGIN_SETTINGS.ui.statusViewLocation;
	}

	if (rawValue === "right-sidebar" || rawValue === "left-sidebar") {
		return rawValue;
	}

	errors.push(settingError("unsupported-value", field, `${field} must be right-sidebar or left-sidebar.`));
	return DEFAULT_PLUGIN_SETTINGS.ui.statusViewLocation;
};

const readLastOpenedCommandId = (rawValue: unknown, field: string, errors: SettingsValidationError[]) => {
	if (rawValue === undefined || rawValue === null) {
		return null;
	}

	if (typeof rawValue === "string") {
		const command = getAgentCommandById(rawValue);
		if (command !== undefined) {
			return command.id;
		}
	}

	errors.push(settingError("unsupported-value", field, `${field} must be a known command ID or null.`));
	return null;
};

const readPluginUiState = (source: Record<string, unknown>, errors: SettingsValidationError[]): PluginUiState => {
	const rawUi = readRecordField(source, "ui", errors);
	const defaults = DEFAULT_PLUGIN_SETTINGS.ui;

	if (rawUi === undefined) {
		return { ...defaults };
	}

	return {
		statusViewLocation: readStatusViewLocation(rawUi.statusViewLocation, "ui.statusViewLocation", errors),
		shouldOpenStatusOnLoad: readBoolean(rawUi, "shouldOpenStatusOnLoad", defaults.shouldOpenStatusOnLoad, errors),
		lastOpenedCommandId: readLastOpenedCommandId(rawUi.lastOpenedCommandId, "ui.lastOpenedCommandId", errors),
	};
};

const readStatusSurfaceSettings = (
	source: Record<string, unknown>,
	errors: SettingsValidationError[],
): StatusSurfaceSettings => {
	const rawStatus = readRecordField(source, "status", errors);
	const defaults = DEFAULT_PLUGIN_SETTINGS.status;

	if (rawStatus === undefined) {
		return { ...defaults };
	}

	return {
		shouldShowProviderStatus: readBoolean(
			rawStatus,
			"shouldShowProviderStatus",
			defaults.shouldShowProviderStatus,
			errors,
		),
		shouldShowIndexStatus: readBoolean(rawStatus, "shouldShowIndexStatus", defaults.shouldShowIndexStatus, errors),
		shouldShowStagedChangeStatus: readBoolean(
			rawStatus,
			"shouldShowStagedChangeStatus",
			defaults.shouldShowStagedChangeStatus,
			errors,
		),
		shouldShowHealthStatus: readBoolean(
			rawStatus,
			"shouldShowHealthStatus",
			defaults.shouldShowHealthStatus,
			errors,
		),
	};
};

const readProviderIdArray = (
	source: Record<string, unknown>,
	field: keyof VoidbrainPluginSettings,
	errors: SettingsValidationError[],
): readonly ProviderId[] => {
	const rawValue = source[field];

	if (rawValue === undefined) {
		return [];
	}

	if (!Array.isArray(rawValue)) {
		errors.push({
			code: "invalid-type",
			field,
			message: `${field} must be an array of provider IDs; cloud trust defaults were applied.`,
		});

		return [];
	}

	const providerIds: ProviderId[] = [];
	const seenProviderIds = new Set<string>();

	for (const [index, value] of rawValue.entries()) {
		if (typeof value !== "string" || value.trim().length === 0) {
			errors.push({
				code: "invalid-type",
				field: `${field}[${index}]`,
				message: `${field} entries must be non-empty strings; cloud trust defaults were applied.`,
			});

			return [];
		}

		const providerId = value.trim();
		if (findRegisteredProvider(makeProviderId(providerId)) === undefined) {
			errors.push({
				code: "unsupported-value",
				field: `${field}[${index}]`,
				message: `${field} entries must reference registered providers; cloud trust defaults were applied.`,
			});

			return [];
		}

		if (!seenProviderIds.has(providerId)) {
			seenProviderIds.add(providerId);
			providerIds.push(makeProviderId(providerId));
		}
	}

	return providerIds.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
};
