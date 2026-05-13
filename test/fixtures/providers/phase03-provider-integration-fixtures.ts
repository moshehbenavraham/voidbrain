import { AGENT_COMMAND_CATALOG, REQUIRED_AGENT_SURFACE_PHRASES } from "../../../src/agent/command-catalog";
import {
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderDefinitionsForSettings,
	makeProviderModelId,
	normalizeProviderProfiles,
} from "../../../src/providers";
import type { FixtureSafetyEntry } from "../../../src/types/agent-commands";
import type { SemanticIndexReadiness } from "../../../src/types/indexing-runtime";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../../../src/types/plugin";
import type { ProviderAuthTestRecord, UserProviderProfile } from "../../../src/types/provider-setup";
import type { ProviderDefinition } from "../../../src/types/providers";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import type { SemanticIndexCompatibilityEvaluationInput } from "../../../src/vectorstore";
import {
	completeSurfaceMarkdownForCommands,
	surfaceMarkdownWithStaleStatus,
} from "../vault/agent-surface-validation-fixtures";
import {
	SEMANTIC_COMPATIBILITY_ALTERNATE_FAMILY,
	SEMANTIC_COMPATIBILITY_DIMENSIONS,
	SEMANTIC_COMPATIBILITY_FAMILY,
	SEMANTIC_COMPATIBILITY_FIXED_DATE,
	SEMANTIC_COMPATIBILITY_INDEX_ID,
	SEMANTIC_COMPATIBILITY_MODEL_ID,
	SEMANTIC_COMPATIBILITY_REPORT_ID,
	canceledSemanticReadinessFixture,
	partialSemanticCompatibilitySources,
	providerBlockedSemanticReadinessFixture,
	semanticCompatibilitySnapshot,
	semanticCompatibilitySources,
	semanticReadinessFixture,
	staleSemanticCompatibilitySources,
} from "../vault/semantic-index-compatibility-fixtures";
import {
	SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT,
	SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	SYNTHETIC_LOCAL_RUNTIME_READY_MODELS,
} from "./local-runtime-provider-fixtures";
import {
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT,
	failedOpenAICompatibleAuthStatus,
	fixedOpenAICompatibleCheckedAt,
	passedOpenAICompatibleAuthStatus,
} from "./openai-compatible-provider-fixtures";
import {
	PROVIDER_TROUBLESHOOTING_CACHE_PATH,
	PROVIDER_TROUBLESHOOTING_FIXED_DATE,
	PROVIDER_TROUBLESHOOTING_REPORT_ID,
	authFailureTroubleshootingScenario,
	capabilityMismatchTroubleshootingScenario,
	cloudDisabledTroubleshootingScenario,
	localOutageTroubleshootingScenario,
	missingSecretTroubleshootingScenario,
	readyTroubleshootingScenario,
	semanticFallbackTroubleshootingScenario,
	trustedCloudReadyTroubleshootingScenario,
} from "./provider-troubleshooting-fixtures";

export const PHASE03_PROVIDER_INTEGRATION_FIXED_ISO = "2026-05-13T00:00:00.000Z";
export const PHASE03_PROVIDER_INTEGRATION_FIXED_DATE = new Date(PHASE03_PROVIDER_INTEGRATION_FIXED_ISO);
export const PHASE03_PROVIDER_INTEGRATION_TIMESTAMP = makeIsoTimestamp(PHASE03_PROVIDER_INTEGRATION_FIXED_ISO);
export const PHASE03_PROVIDER_INTEGRATION_REPORT_ID = "phase03-provider-integration-report";
export const PHASE03_PROVIDER_INTEGRATION_CACHE_PATH = makeNormalizedVaultPath(
	".voidbrain/cache/phase03-provider-integration.json",
);
export const PHASE03_PROVIDER_INTEGRATION_TARGET_PATH = makeNormalizedVaultPath(
	"summaries/phase03-provider-integration-summary.md",
);
export const PHASE03_PROVIDER_INTEGRATION_STAGED_CHANGE_ID = "stage-phase03-provider-integration-summary";
export const PHASE03_PROVIDER_INTEGRATION_VALIDATION_OUTPUT = [
	"phase03-provider-integration:synthetic-fixture",
] as const;

export const PHASE03_PROVIDER_INTEGRATION_SAFE_MESSAGE =
	"Phase 03 integration fixtures are synthetic local records only and contain no provider secrets, raw note bodies, hidden provider state, authorization headers, prompt bodies, or private path hints.";

export interface Phase03ProviderProfileSet {
	readonly localRuntime: UserProviderProfile;
	readonly openAICompatibleLocal: UserProviderProfile;
	readonly customRemote: UserProviderProfile;
	readonly trustedCloud: UserProviderProfile;
	readonly untrustedCloud: UserProviderProfile;
	readonly missingSecret: UserProviderProfile;
	readonly authFailed: UserProviderProfile;
	readonly capabilityMismatch: UserProviderProfile;
	readonly all: readonly UserProviderProfile[];
}

export interface Phase03ProviderScenario {
	readonly name: string;
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly ProviderDefinition[];
}

export interface Phase03SemanticCompatibilityCase {
	readonly name: string;
	readonly input: SemanticIndexCompatibilityEvaluationInput;
	readonly expected: {
		readonly state: string;
		readonly code: string;
		readonly fallbackMode: string;
		readonly guidanceAction: string;
	};
}

const parseProfile = (input: unknown, label: string): UserProviderProfile => {
	const normalized = normalizeProviderProfiles([input]);
	const profile = normalized.profiles[0];
	if (profile === undefined || normalized.errors.length > 0) {
		throw new Error(`Expected ${label} provider profile fixture to parse.`);
	}
	return profile;
};

const providerDefinitionsForSettings = (settings: VoidbrainPluginSettings): readonly ProviderDefinition[] =>
	buildProviderDefinitionsForSettings(settings);

export const createPhase03ProviderProfiles = (): Phase03ProviderProfileSet => {
	const localRuntime = parseProfile(SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT, "local runtime");
	const openAICompatibleLocal = parseProfile(OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT, "OpenAI local-compatible");
	const customRemote = parseProfile(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT, "OpenAI custom remote");
	const trustedCloud = parseProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT, "OpenAI trusted cloud");
	const untrustedCloud = parseProfile(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT, "OpenAI untrusted cloud");
	const missingSecret = parseProfile(OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT, "OpenAI missing secret");
	const authFailed = parseProfile(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT, "OpenAI auth failed");
	const capabilityMismatch = parseProfile(
		OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT,
		"OpenAI capability mismatch",
	);

	return {
		localRuntime,
		openAICompatibleLocal,
		customRemote,
		trustedCloud,
		untrustedCloud,
		missingSecret,
		authFailed,
		capabilityMismatch,
		all: [
			localRuntime,
			openAICompatibleLocal,
			customRemote,
			trustedCloud,
			untrustedCloud,
			missingSecret,
			authFailed,
			capabilityMismatch,
		],
	};
};

export const phase03ReadyLocalRuntimeAuthStatus = (): ProviderAuthTestRecord => ({
	providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	status: "passed",
	checkedAt: PHASE03_PROVIDER_INTEGRATION_TIMESTAMP,
	statusCode: 200,
	modelCount: SYNTHETIC_LOCAL_RUNTIME_READY_MODELS.length,
	durationMs: 1,
	diagnostic: {
		providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
		modelCount: SYNTHETIC_LOCAL_RUNTIME_READY_MODELS.length,
	},
	localRuntimeReadiness: {
		providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
		status: "ready",
		code: "ready",
		checkedAt: PHASE03_PROVIDER_INTEGRATION_TIMESTAMP,
		durationMs: 1,
		modelCount: SYNTHETIC_LOCAL_RUNTIME_READY_MODELS.length,
		chatModelCount: 1,
		embeddingModelCount: 1,
		modelIds: [SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID, SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID],
		chatModelIds: [SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID],
		embeddingModelIds: [SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID],
		diagnostic: {
			providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
			modelCount: SYNTHETIC_LOCAL_RUNTIME_READY_MODELS.length,
		},
	},
});

export const phase03MissingSecretAuthStatus = (): ProviderAuthTestRecord => ({
	providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	status: "missing-secret",
	checkedAt: fixedOpenAICompatibleCheckedAt,
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
		checkedAt: fixedOpenAICompatibleCheckedAt,
		durationMs: 1,
		statusCode: null,
		modelCount: 0,
		diagnostic: {
			providerId: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
			reason: "missing-secret",
		},
	},
});

export const createPhase03BaseSettings = (
	overrides: Partial<VoidbrainPluginSettings> = {},
): VoidbrainPluginSettings => {
	const profiles = createPhase03ProviderProfiles();
	const base: VoidbrainPluginSettings = {
		...DEFAULT_PLUGIN_SETTINGS,
		providerProfiles: profiles.all,
		trustedProviderIds: [
			OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
			OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
			OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
			OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
		],
		providerAuthStatuses: [
			phase03ReadyLocalRuntimeAuthStatus(),
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID, "trusted-cloud", 3),
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID, "untrusted-cloud", 1),
			phase03MissingSecretAuthStatus(),
			failedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID, "trusted-cloud"),
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID, "trusted-cloud", 1),
		],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
				modelId: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
			},
			embedding: {
				providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
				modelId: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
			},
		},
	};

	return {
		...base,
		...overrides,
		providerRoles: {
			...base.providerRoles,
			...overrides.providerRoles,
		},
	};
};

export const createPhase03ProviderScenarios = (): readonly Phase03ProviderScenario[] => {
	const baseSettings = createPhase03BaseSettings();
	const cloudDisabledSettings = createPhase03BaseSettings({
		areCloudProvidersEnabled: false,
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	});
	const trustedCloudSettings = createPhase03BaseSettings({
		areCloudProvidersEnabled: true,
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
			embedding: {
				providerId: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-embedding"),
			},
		},
	});
	const untrustedCloudSettings = createPhase03BaseSettings({
		areCloudProvidersEnabled: true,
		trustedProviderIds: [OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
				modelId: makeProviderModelId("synthetic-openai-chat"),
			},
		},
	});

	return [
		{
			name: "local-runtime-ready",
			settings: baseSettings,
			providers: providerDefinitionsForSettings(baseSettings),
		},
		{
			name: "trusted-cloud-disabled",
			settings: cloudDisabledSettings,
			providers: providerDefinitionsForSettings(cloudDisabledSettings),
		},
		{
			name: "trusted-cloud-enabled",
			settings: trustedCloudSettings,
			providers: providerDefinitionsForSettings(trustedCloudSettings),
		},
		{
			name: "untrusted-cloud",
			settings: untrustedCloudSettings,
			providers: providerDefinitionsForSettings(untrustedCloudSettings),
		},
	];
};

const offlineSemanticReadinessFixture = (): SemanticIndexReadiness =>
	semanticReadinessFixture({
		state: "offline",
		readinessState: "blocked",
		message: "Synthetic local embedding runtime is offline; lexical fallback remains available.",
		diagnosticCode: "provider-offline",
		recovery: {
			commandId: "voidbrain.semantic-index-readiness",
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: SEMANTIC_COMPATIBILITY_MODEL_ID,
			sourcePathCount: semanticCompatibilitySources().length,
			readinessCode: "provider-offline",
			reportId: SEMANTIC_COMPATIBILITY_REPORT_ID,
			validationOutput: ["provider-offline"],
			retryGuidance: "Retry after the local runtime is reachable.",
			updatedAt: PHASE03_PROVIDER_INTEGRATION_TIMESTAMP,
		},
	});

export const createPhase03SemanticCompatibilityCases = (): readonly Phase03SemanticCompatibilityCase[] => [
	{
		name: "ready-semantic",
		input: {
			semanticReadiness: semanticReadinessFixture({
				embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
			}),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "ready",
			code: "compatible",
			fallbackMode: "semantic",
			guidanceAction: "none",
		},
	},
	{
		name: "missing-index",
		input: {
			semanticReadiness: semanticReadinessFixture({
				embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
			}),
			semanticSnapshot: null,
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "missing",
			code: "missing-index",
			fallbackMode: "lexical",
			guidanceAction: "rebuild-semantic-index",
		},
	},
	{
		name: "stale-sources",
		input: {
			semanticReadiness: semanticReadinessFixture({
				embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
			}),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: staleSemanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "stale",
			code: "stale-source-fingerprints",
			fallbackMode: "lexical",
			guidanceAction: "rebuild-semantic-index",
		},
	},
	{
		name: "family-mismatch",
		input: {
			semanticReadiness: semanticReadinessFixture({
				embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
			}),
			semanticSnapshot: semanticCompatibilitySnapshot({
				config: {
					...semanticCompatibilitySnapshot().config,
					indexId: SEMANTIC_COMPATIBILITY_INDEX_ID,
					embeddingModelFamily: SEMANTIC_COMPATIBILITY_ALTERNATE_FAMILY,
				},
			}),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "incompatible",
			code: "family-mismatch",
			fallbackMode: "lexical",
			guidanceAction: "rebuild-semantic-index",
		},
	},
	{
		name: "provider-blocked",
		input: {
			semanticReadiness: providerBlockedSemanticReadinessFixture(),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: partialSemanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "provider-blocked",
			code: "provider-blocked",
			fallbackMode: "lexical",
			guidanceAction: "review-provider-setup",
		},
	},
	{
		name: "canceled",
		input: {
			semanticReadiness: canceledSemanticReadinessFixture(),
			semanticSnapshot: semanticCompatibilitySnapshot({ status: "canceled" }),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "canceled",
			code: "provider-canceled",
			fallbackMode: "lexical",
			guidanceAction: "review-provider-setup",
		},
	},
	{
		name: "offline",
		input: {
			semanticReadiness: offlineSemanticReadinessFixture(),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		},
		expected: {
			state: "offline",
			code: "provider-offline",
			fallbackMode: "lexical",
			guidanceAction: "review-provider-setup",
		},
	},
];

export const createPhase03TroubleshootingScenarios = () =>
	[
		{
			name: "local-outage",
			scenario: localOutageTroubleshootingScenario(),
			expectedCodes: ["offline"],
			expectedActions: ["retest-auth", "retry-provider-setup", "reset-provider-state"],
		},
		{
			name: "missing-secret",
			scenario: missingSecretTroubleshootingScenario(),
			expectedCodes: ["missing-secret"],
			expectedActions: ["retest-auth", "reset-provider-state"],
		},
		{
			name: "auth-failure",
			scenario: authFailureTroubleshootingScenario(),
			expectedCodes: ["auth-failed"],
			expectedActions: ["retest-auth", "reset-provider-state"],
		},
		{
			name: "cloud-disabled",
			scenario: cloudDisabledTroubleshootingScenario(),
			expectedCodes: ["cloud-disabled"],
			expectedActions: ["review-disclosure"],
		},
		{
			name: "capability-mismatch",
			scenario: capabilityMismatchTroubleshootingScenario(),
			expectedCodes: ["capability-mismatch"],
			expectedActions: ["reset-provider-state"],
		},
		{
			name: "semantic-fallback",
			scenario: semanticFallbackTroubleshootingScenario(),
			expectedCodes: ["provider-offline"],
			expectedActions: ["retry-provider-setup"],
		},
		{
			name: "ready",
			scenario: readyTroubleshootingScenario(),
			expectedCodes: [],
			expectedActions: [],
		},
		{
			name: "trusted-cloud-ready",
			scenario: trustedCloudReadyTroubleshootingScenario(),
			expectedCodes: [],
			expectedActions: [],
		},
	] as const;

export const createPhase03TroubleshootingRecoveryInput = () => ({
	reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
	cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
	validationOutput: [
		"phase03 provider readiness retry failed",
		["Bearer", " phase03syntheticvalue000000"].join(""),
		["/ho", "me/phase03-user/private-vault.md"].join(""),
	],
});

export const createPhase03SurfaceFixtureSet = () => {
	const providerCloseoutMarkdown = [
		"",
		"## Phase 03 Provider Closeout",
		"",
		"Provider disclosure stays explicit for cloud provider workflows.",
		"Provider review, trust, auth, capability, and disclosure gates must pass before private vault content leaves this machine.",
		"Offline fallback uses lexical retrieval when semantic indexes are blocked, stale, missing, canceled, or unavailable.",
		"Provider troubleshooting preserves command ID, provider ID, model ID, target path, cache path, staged-change ID, report ID, and validation output only.",
		"Framework update behavior remains dry-run until a later apply workflow is implemented.",
		"All examples use synthetic fixtures and omit provider secrets, auth headers, prompt bodies, raw note bodies, hidden provider state, and private path hints.",
	].join("\n");
	const completeMarkdown = `${completeSurfaceMarkdownForCommands(
		AGENT_COMMAND_CATALOG,
	)}\n${providerCloseoutMarkdown}\n`;

	return {
		completeMarkdown,
		staleStatusMarkdown: `${surfaceMarkdownWithStaleStatus(
			AGENT_COMMAND_CATALOG,
			"voidbrain.validate-agent-surfaces",
			"planned",
		)}\n${providerCloseoutMarkdown}\n`,
		requiredSurfacePhrases: [
			...REQUIRED_AGENT_SURFACE_PHRASES,
			"provider disclosure",
			"cloud provider",
			"offline fallback",
			"dry-run",
			"recovery",
		],
	};
};

export const createPhase03FixtureSafetyEntries = (): readonly FixtureSafetyEntry[] => [
	{
		path: "docs/phase03-safe-provider-closeout.md",
		content: [
			"# Phase 03 Safe Provider Closeout",
			"",
			"Use synthetic fixtures, staged changes, citations, dry-run plans, provider disclosure gates, and recovery IDs.",
			"Safe records include command ID, provider ID, model ID, target path, cache path, staged-change ID, report ID, source counts, and validation output.",
			"",
		].join("\n"),
	},
	{
		path: "docs/phase03-unsafe-provider-closeout.md",
		content: [
			"# Phase 03 Unsafe Provider Closeout",
			"",
			["api", "_key: ", "phase03-value"].join(""),
			["Bearer", " phase03syntheticvalue000000"].join(""),
			["/ho", "me/phase03-user/private-vault.md"].join(""),
			"",
		].join("\n"),
	},
];

export const PHASE03_REDACTION_SENTINELS = [
	"phase03syntheticvalue000000",
	"private-vault.md",
	"raw private note body",
	"hidden provider state",
	"prompt body",
] as const;

export const PHASE03_TROUBLESHOOTING_FIXED_DATE = PROVIDER_TROUBLESHOOTING_FIXED_DATE;
export const PHASE03_LOCAL_FIXTURE_PROVIDER_ID = LOCAL_FIXTURE_PROVIDER_ID;
export const PHASE03_TRUSTED_CLOUD_FIXTURE_PROVIDER_ID = TRUSTED_CLOUD_FIXTURE_PROVIDER_ID;
