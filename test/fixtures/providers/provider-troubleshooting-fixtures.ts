import {
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderDefinitionsForSettings,
	makeProviderModelId,
	normalizeProviderProfiles,
} from "../../../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../../../src/types/plugin";
import type { ProviderAuthTestRecord } from "../../../src/types/provider-setup";
import type { ProviderDefinition } from "../../../src/types/providers";
import type { SemanticIndexCompatibility } from "../../../src/types/retrieval";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import {
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
	failedOpenAICompatibleAuthStatus,
	passedOpenAICompatibleAuthStatus,
} from "./openai-compatible-provider-fixtures";
import {
	SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD,
	SYNTHETIC_LOCAL_PROFILE_ID,
	SYNTHETIC_LOCAL_PROFILE_INPUT,
	SYNTHETIC_LOCAL_READY_READINESS_RECORD,
} from "./provider-setup-fixtures";

export const PROVIDER_TROUBLESHOOTING_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");
export const PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP = makeIsoTimestamp("2026-05-13T00:00:00.000Z");
export const PROVIDER_TROUBLESHOOTING_CACHE_PATH = makeNormalizedVaultPath(
	".voidbrain/cache/provider-troubleshooting.json",
);
export const PROVIDER_TROUBLESHOOTING_REPORT_ID = "provider-troubleshooting-fixture-report";
export const PROVIDER_TROUBLESHOOTING_VALIDATION_OUTPUT = ["provider-readiness:synthetic-fixture"] as const;
export const PROVIDER_TROUBLESHOOTING_SOURCE_COUNT = 3;

const parsedLocalProfile = normalizeProviderProfiles([SYNTHETIC_LOCAL_PROFILE_INPUT]).profiles[0];
const parsedMissingSecretProfile = normalizeProviderProfiles([OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT])
	.profiles[0];
const parsedAuthFailedProfile = normalizeProviderProfiles([OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT]).profiles[0];
const parsedTrustedCloudProfile = normalizeProviderProfiles([OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT])
	.profiles[0];

const missingSecretAuthStatus: ProviderAuthTestRecord = {
	providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	status: "missing-secret",
	checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
	statusCode: null,
	modelCount: 0,
	durationMs: 1,
	diagnostic: {
		providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
		reason: "missing-secret",
	},
	openaiCompatibleReadiness: {
		providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
		status: "not-ready",
		code: "missing-secret",
		endpointClassification: "trusted-cloud",
		checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
		durationMs: 1,
		statusCode: null,
		modelCount: 0,
		diagnostic: {
			providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
			reason: "missing-secret",
		},
	},
};

export interface ProviderTroubleshootingFixtureScenario {
	readonly name: string;
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly ProviderDefinition[];
	readonly semanticCompatibility: SemanticIndexCompatibility | null;
}

const withProviders = (settings: VoidbrainPluginSettings): ProviderTroubleshootingFixtureScenario => ({
	name: "custom",
	settings,
	providers: buildProviderDefinitionsForSettings(settings),
	semanticCompatibility: null,
});

export const localOutageTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	if (parsedLocalProfile === undefined) {
		throw new Error("Expected synthetic local profile fixture.");
	}

	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: [parsedLocalProfile],
		providerAuthStatuses: [
			{
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				status: "failed",
				checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
				statusCode: null,
				modelCount: 0,
				durationMs: 1,
				diagnostic: {
					providerId: SYNTHETIC_LOCAL_PROFILE_ID,
					reason: "offline",
				},
				localRuntimeReadiness: SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD,
			},
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-local-chat"),
			},
		},
	};

	return { ...withProviders(settings), name: "local-outage" };
};

export const missingSecretTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	if (parsedMissingSecretProfile === undefined) {
		throw new Error("Expected synthetic missing secret profile fixture.");
	}

	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID],
		providerProfiles: [parsedMissingSecretProfile],
		providerAuthStatuses: [missingSecretAuthStatus],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	};

	return { ...withProviders(settings), name: "missing-secret" };
};

export const authFailureTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	if (parsedAuthFailedProfile === undefined) {
		throw new Error("Expected synthetic auth failure profile fixture.");
	}

	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID],
		providerProfiles: [parsedAuthFailedProfile],
		providerAuthStatuses: [
			failedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID, "trusted-cloud"),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	};

	return { ...withProviders(settings), name: "auth-failure" };
};

export const cloudDisabledTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	if (parsedTrustedCloudProfile === undefined) {
		throw new Error("Expected synthetic trusted cloud profile fixture.");
	}

	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: false,
		trustedProviderIds: [OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID],
		providerProfiles: [parsedTrustedCloudProfile],
		providerAuthStatuses: [
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID, "trusted-cloud", 3),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	};

	return { ...withProviders(settings), name: "cloud-disabled" };
};

export const capabilityMismatchTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			embedding: {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("local-chat-fixture"),
			},
		},
	};

	return { ...withProviders(settings), name: "capability-mismatch" };
};

export const semanticFallbackTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			embedding: {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("local-embedding-fixture"),
			},
		},
	};
	const base = withProviders(settings);

	return {
		...base,
		name: "semantic-fallback",
		semanticCompatibility: {
			state: "provider-blocked",
			code: "provider-offline",
			semanticSearchEligible: false,
			fallbackMode: "lexical",
			checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
			indexId: "synthetic-semantic-index",
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("local-embedding-fixture"),
			embeddingModelFamily: null,
			dimensions: null,
			snapshotBuiltAt: null,
			sourcePathCounts: {
				indexed: 1,
				current: PROVIDER_TROUBLESHOOTING_SOURCE_COUNT,
				stale: 0,
				missing: 2,
				extra: 0,
			},
			staleSourcePaths: [],
			missingSourcePaths: [],
			extraSourcePaths: [],
			message: "Synthetic provider is offline; lexical fallback remains available.",
			guidance: {
				action: "review-provider-setup",
				message: "Synthetic provider is offline; lexical fallback remains available.",
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("local-embedding-fixture"),
				embeddingModelFamily: null,
				dimensions: null,
				indexId: "synthetic-semantic-index",
				sourcePathCount: PROVIDER_TROUBLESHOOTING_SOURCE_COUNT,
				readinessCode: "provider-offline",
				reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
				validationOutput: [...PROVIDER_TROUBLESHOOTING_VALIDATION_OUTPUT],
			},
			recovery: {
				commandId: "voidbrain.semantic-index-compatibility",
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("local-embedding-fixture"),
				indexId: "synthetic-semantic-index",
				reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
				readinessCode: "provider-offline",
				sourcePathCount: PROVIDER_TROUBLESHOOTING_SOURCE_COUNT,
				validationOutput: [...PROVIDER_TROUBLESHOOTING_VALIDATION_OUTPUT],
				fallbackMode: "lexical",
			},
		},
	};
};

export const readyTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	if (parsedLocalProfile === undefined) {
		throw new Error("Expected synthetic local profile fixture.");
	}

	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: [parsedLocalProfile],
		providerAuthStatuses: [
			{
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				status: "passed",
				checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
				statusCode: null,
				modelCount: 2,
				durationMs: 1,
				diagnostic: {
					providerId: SYNTHETIC_LOCAL_PROFILE_ID,
					modelCount: 2,
				},
				localRuntimeReadiness: SYNTHETIC_LOCAL_READY_READINESS_RECORD,
			},
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-local-chat"),
			},
			embedding: {
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-local-embedding"),
			},
		},
	};

	return { ...withProviders(settings), name: "ready" };
};

export const trustedCloudReadyTroubleshootingScenario = (): ProviderTroubleshootingFixtureScenario => {
	const settings: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				modelId: makeProviderModelId("trusted-cloud-chat-fixture"),
			},
		},
		providerAuthStatuses: [
			{
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				status: "passed",
				checkedAt: PROVIDER_TROUBLESHOOTING_FIXED_TIMESTAMP,
				statusCode: 200,
				modelCount: 2,
				durationMs: 1,
				diagnostic: {
					providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					modelCount: 2,
				},
			},
		],
	};

	return { ...withProviders(settings), name: "trusted-cloud-ready" };
};
