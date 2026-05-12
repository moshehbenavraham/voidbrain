import type { Plugin } from "obsidian";
import { DEFAULT_PLUGIN_SETTINGS, SETTINGS_SCHEMA_VERSION, type VoidbrainPluginSettings } from "../types/plugin";
import { type ProviderId, makeProviderId } from "../types/providers";

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

	const schemaError = readSchemaError(rawSettings);

	if (schemaError) {
		return {
			settings: createDefaultPluginSettings(),
			status: "recovered",
			errors: [schemaError],
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
		areCloudProvidersEnabled: hasTrustedProviderErrors ? false : areCloudProvidersEnabled,
		trustedProviderIds,
		areStagedWritesRequired: readBoolean(rawSettings, "areStagedWritesRequired", true, errors),
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

const readSchemaError = (source: Record<string, unknown>): SettingsValidationError | null => {
	const schemaVersion = source.schemaVersion;

	if (schemaVersion === undefined || schemaVersion === SETTINGS_SCHEMA_VERSION) {
		return null;
	}

	return {
		code: "unsupported-schema",
		field: "schemaVersion",
		message: `Settings schema must be ${SETTINGS_SCHEMA_VERSION}; local-first defaults were applied.`,
	};
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

const readBoolean = (
	source: Record<string, unknown>,
	field: keyof VoidbrainPluginSettings,
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
		if (!seenProviderIds.has(providerId)) {
			seenProviderIds.add(providerId);
			providerIds.push(makeProviderId(providerId));
		}
	}

	return providerIds.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
};
