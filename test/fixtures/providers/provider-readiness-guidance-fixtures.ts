import {
	buildProviderDefinitionsForSettings,
	makeProviderModelId,
	normalizeProviderProfiles,
} from "../../../src/providers";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../../../src/types/plugin";
import type { ProviderAuthTestRecord, UserProviderProfile } from "../../../src/types/provider-setup";
import type { SemanticIndexCompatibility } from "../../../src/types/retrieval";
import { makeIsoTimestamp } from "../../../src/types/vault";
import {
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT,
	failedOpenAICompatibleAuthStatus,
	passedOpenAICompatibleAuthStatus,
} from "./openai-compatible-provider-fixtures";
import {
	SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD,
	SYNTHETIC_LOCAL_PROFILE_ID,
	SYNTHETIC_LOCAL_PROFILE_INPUT,
	SYNTHETIC_LOCAL_READY_READINESS_RECORD,
} from "./provider-setup-fixtures";

export const PROVIDER_READINESS_FIXED_TIMESTAMP = makeIsoTimestamp("2026-05-13T00:00:00.000Z");
export const PROVIDER_READINESS_REPORT_ID = "provider-readiness-fixture-report";
export const PROVIDER_READINESS_CACHE_PATH = ".voidbrain/cache/provider-readiness.json";
export const PROVIDER_READINESS_VALIDATION_OUTPUT = ["provider-readiness:synthetic-fixture"] as const;

export interface ProviderReadinessFixtureScenario {
	readonly name: string;
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly unknown[];
	readonly semanticCompatibility: SemanticIndexCompatibility | null;
}

const parsedProfile = (input: unknown): UserProviderProfile => {
	const result = normalizeProviderProfiles([input]);
	const profile = result.profiles[0];

	if (profile === undefined) {
		throw new Error("Expected synthetic provider profile fixture.");
	}

	return profile;
};

const withProviders = (
	name: string,
	settings: VoidbrainPluginSettings,
	semanticCompatibility: SemanticIndexCompatibility | null = null,
): ProviderReadinessFixtureScenario => ({
	name,
	settings,
	providers: buildProviderDefinitionsForSettings(settings),
	semanticCompatibility,
});

const localProfile = parsedProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
const localCompatibleProfile = parsedProfile(OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT);
const customRemoteProfile = parsedProfile(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT);
const trustedCloudProfile = parsedProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
const untrustedCloudProfile = parsedProfile(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT);
const missingSecretProfile = parsedProfile(OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT);
const authFailedProfile = parsedProfile(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT);
const capabilityMismatchProfile = parsedProfile(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT);

export const localRuntimeReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("local-runtime", {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: [localProfile],
		providerAuthStatuses: [
			{
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				status: "passed",
				checkedAt: PROVIDER_READINESS_FIXED_TIMESTAMP,
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
	});

export const openAICompatibleLocalReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("openai-compatible-local", {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: [localCompatibleProfile],
		providerAuthStatuses: [
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_LOCAL_PROFILE_ID, "local-compatible", 2),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
			embedding: {
				providerId: OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-embedding"),
			},
		},
	});

export const customRemoteReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("custom-remote", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID],
		providerProfiles: [customRemoteProfile],
		providerAuthStatuses: [
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID, "custom-remote", 2),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
			embedding: {
				providerId: OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-embedding"),
			},
		},
	});

export const trustedCloudReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("trusted-cloud", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID],
		providerProfiles: [trustedCloudProfile],
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
	});

export const untrustedCloudReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("untrusted-cloud", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		providerProfiles: [untrustedCloudProfile],
		providerAuthStatuses: [
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID, "untrusted-cloud", 1),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	});

export const missingSecretReadinessScenario = (): ProviderReadinessFixtureScenario => {
	const status: ProviderAuthTestRecord = {
		providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
		status: "missing-secret",
		checkedAt: PROVIDER_READINESS_FIXED_TIMESTAMP,
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
			checkedAt: PROVIDER_READINESS_FIXED_TIMESTAMP,
			durationMs: 1,
			statusCode: null,
			modelCount: 0,
			diagnostic: {
				providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
				reason: "missing-secret",
			},
		},
	};

	return withProviders("missing-secret", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID],
		providerProfiles: [missingSecretProfile],
		providerAuthStatuses: [status],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	});
};

export const authFailedReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("auth-failed", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID],
		providerProfiles: [authFailedProfile],
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
	});

export const authTimeoutReadinessScenario = (): ProviderReadinessFixtureScenario => {
	const failed = failedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID, "trusted-cloud");
	const readiness = failed.openaiCompatibleReadiness;

	if (readiness === undefined) {
		throw new Error("Expected synthetic auth readiness.");
	}

	return withProviders("auth-timeout", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID],
		providerProfiles: [authFailedProfile],
		providerAuthStatuses: [
			{
				...failed,
				status: "timeout",
				openaiCompatibleReadiness: {
					...readiness,
					status: "not-ready",
					code: "auth-timeout",
				},
			},
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	});
};

export const localOutageReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("local-outage", {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: [localProfile],
		providerAuthStatuses: [
			{
				providerId: SYNTHETIC_LOCAL_PROFILE_ID,
				status: "failed",
				checkedAt: PROVIDER_READINESS_FIXED_TIMESTAMP,
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
	});

export const capabilityMismatchReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("capability-mismatch", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID],
		providerProfiles: [capabilityMismatchProfile],
		providerAuthStatuses: [
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID, "trusted-cloud", 1),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-embedding"),
			},
		},
	});

export const cloudDisabledReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("cloud-disabled", {
		...DEFAULT_PLUGIN_SETTINGS,
		trustedProviderIds: [OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID],
		providerProfiles: [trustedCloudProfile],
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
	});

export const providerNotTrustedReadinessScenario = (): ProviderReadinessFixtureScenario =>
	withProviders("provider-not-trusted", {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: true,
		providerProfiles: [trustedCloudProfile],
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
	});

export const semanticFallbackReadinessScenario = (): ProviderReadinessFixtureScenario => {
	const base = localRuntimeReadinessScenario();
	const semanticCompatibility: SemanticIndexCompatibility = {
		state: "provider-blocked",
		code: "provider-offline",
		semanticSearchEligible: false,
		fallbackMode: "lexical",
		checkedAt: PROVIDER_READINESS_FIXED_TIMESTAMP,
		indexId: "synthetic-semantic-index",
		providerId: SYNTHETIC_LOCAL_PROFILE_ID,
		modelId: makeProviderModelId("synthetic-local-embedding"),
		embeddingModelFamily: null,
		dimensions: null,
		snapshotBuiltAt: null,
		sourcePathCounts: {
			indexed: 1,
			current: 3,
			stale: 0,
			missing: 2,
			extra: 0,
		},
		staleSourcePaths: [],
		missingSourcePaths: [],
		extraSourcePaths: [],
		message: "Synthetic provider is blocked; lexical fallback remains available.",
		guidance: {
			action: "review-provider-setup",
			message: "Synthetic provider is blocked; lexical fallback remains available.",
			providerId: SYNTHETIC_LOCAL_PROFILE_ID,
			modelId: makeProviderModelId("synthetic-local-embedding"),
			embeddingModelFamily: null,
			dimensions: null,
			indexId: "synthetic-semantic-index",
			sourcePathCount: 3,
			readinessCode: "provider-offline",
			reportId: PROVIDER_READINESS_REPORT_ID,
			validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
		},
		recovery: {
			commandId: "voidbrain.semantic-index-compatibility",
			providerId: SYNTHETIC_LOCAL_PROFILE_ID,
			modelId: makeProviderModelId("synthetic-local-embedding"),
			indexId: "synthetic-semantic-index",
			reportId: PROVIDER_READINESS_REPORT_ID,
			readinessCode: "provider-offline",
			sourcePathCount: 3,
			validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
			fallbackMode: "lexical",
		},
	};

	return {
		...base,
		name: "semantic-fallback",
		semanticCompatibility,
	};
};

export const unsafeProviderReadinessScenario = (): ProviderReadinessFixtureScenario => ({
	name: "unsafe-provider-state",
	settings: DEFAULT_PLUGIN_SETTINGS,
	providers: [
		{
			id: "unsafe-provider",
			displayName: "Unsafe Provider",
			kind: "cloud",
			trustLevel: "trusted-cloud",
			hiddenProviderState: "raw hidden state fixture",
			models: [],
		},
	],
	semanticCompatibility: null,
});
