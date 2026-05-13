import { describe, expect, it, vi } from "vitest";
import {
	buildProviderDefinitionsForSettings,
	mergeProviderDefinitions,
	normalizeProviderProfiles,
	preflightProviderSetup,
	providerProfileToDefinition,
	runProviderAuthTest,
} from "../src/providers";
import { REDACTED_VALUE } from "../src/providers/redaction";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import type { ProviderAuthTestRecord, UserProviderProfile } from "../src/types/provider-setup";
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
	SYNTHETIC_CLOUD_PROFILE_ID,
	SYNTHETIC_CLOUD_PROFILE_INPUT,
	SYNTHETIC_DUPLICATE_PROFILE_INPUTS,
	SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD,
	SYNTHETIC_LOCAL_PROFILE_INPUT,
	SYNTHETIC_LOCAL_READY_READINESS_RECORD,
	failedOpenAICompatibleAuthStatus,
	fixedOpenAICompatibleCheckedAt,
	passedOpenAICompatibleAuthStatus,
} from "./fixtures/providers/provider-setup-fixtures";

const fixedCheckedAt = "2026-05-13T00:00:00.000Z";

const expectFirstProfile = (input: unknown): UserProviderProfile => {
	const normalized = normalizeProviderProfiles([input]);

	if (normalized.profiles[0] === undefined) {
		throw new Error("Expected provider profile fixture to be valid");
	}

	return normalized.profiles[0];
};

const passedAuthStatus = (profile: UserProviderProfile): ProviderAuthTestRecord => ({
	providerId: profile.id,
	status: "passed",
	checkedAt: fixedCheckedAt,
	statusCode: 200,
	modelCount: profile.models.length,
	durationMs: 1,
	diagnostic: {
		providerId: profile.id,
		modelCount: profile.models.length,
	},
});

const settingsWithCloudProfile = (profile: UserProviderProfile): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	areCloudProvidersEnabled: true,
	trustedProviderIds: [profile.id],
	providerProfiles: [profile],
	providerAuthStatuses: [passedAuthStatus(profile)],
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: profile.id,
			modelId: profile.models[0]?.id ?? null,
		},
	},
});

const settingsWithLocalProfile = (
	profile: UserProviderProfile,
	authStatus: ProviderAuthTestRecord,
): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	providerProfiles: [profile],
	providerAuthStatuses: [authStatus],
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: profile.id,
			modelId: profile.models[0]?.id ?? null,
		},
		embedding: {
			providerId: profile.id,
			modelId: profile.models[1]?.id ?? null,
		},
	},
});

const settingsWithOpenAICompatibleProfile = (
	profile: UserProviderProfile,
	authStatus: ProviderAuthTestRecord,
	options: {
		readonly areCloudProvidersEnabled?: boolean;
		readonly trustedProviderIds?: readonly UserProviderProfile["id"][];
		readonly modelIndex?: number;
	} = {},
): VoidbrainPluginSettings => {
	const selectedModel =
		options.modelIndex === undefined
			? (profile.models.find((model) => model.roles.includes("chat")) ?? profile.models[0])
			: profile.models[options.modelIndex];

	return {
		...DEFAULT_PLUGIN_SETTINGS,
		areCloudProvidersEnabled: options.areCloudProvidersEnabled ?? false,
		trustedProviderIds: options.trustedProviderIds ?? [],
		providerProfiles: [profile],
		providerAuthStatuses: [authStatus],
		providerRoles: {
			...DEFAULT_PLUGIN_SETTINGS.providerRoles,
			chat: {
				providerId: profile.id,
				modelId: selectedModel?.id ?? null,
			},
		},
	};
};

const missingSecretOpenAICompatibleAuthStatus = (
	profile: UserProviderProfile,
	endpointClassification: "trusted-cloud",
): ProviderAuthTestRecord => ({
	providerId: profile.id,
	status: "missing-secret",
	checkedAt: fixedOpenAICompatibleCheckedAt,
	statusCode: null,
	modelCount: profile.models.length,
	durationMs: 0,
	diagnostic: {
		providerId: profile.id,
		reason: "missing-runtime-reference",
	},
	openaiCompatibleReadiness: {
		providerId: profile.id,
		status: "not-ready",
		code: "missing-secret",
		endpointClassification,
		checkedAt: fixedOpenAICompatibleCheckedAt,
		durationMs: 0,
		statusCode: null,
		modelCount: profile.models.length,
		diagnostic: {
			providerId: profile.id,
			reason: "missing-runtime-reference",
		},
	},
});

describe("provider profile service", () => {
	it("validates profiles and converts them to setup-safe provider definitions", () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const definition = providerProfileToDefinition(profile);

		expect(definition).toMatchObject({
			id: profile.id,
			kind: "local",
			setupMetadata: {
				source: "user-profile",
				hasCredentialReference: false,
				authState: "untested",
				modelCount: 2,
			},
		});
		expect(JSON.stringify(definition)).not.toContain("runtime-value");
	});

	it("deduplicates provider profiles and rejects unsafe raw provider state", () => {
		const duplicateResult = normalizeProviderProfiles(SYNTHETIC_DUPLICATE_PROFILE_INPUTS);
		expect(duplicateResult.profiles).toHaveLength(1);
		expect(duplicateResult.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "duplicate-profile-id" })]),
		);

		const unsafeResult = normalizeProviderProfiles([
			{
				...SYNTHETIC_LOCAL_PROFILE_INPUT,
				["api" + "Key"]: "inline-runtime-value",
			},
		]);
		expect(unsafeResult.profiles).toHaveLength(0);
		expect(unsafeResult.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "unsafe-provider-state" })]),
		);
	});

	it("merges user profiles without overriding baseline provider IDs", () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const merged = mergeProviderDefinitions([], [profile]);

		expect(merged.providers.map((provider) => provider.id)).toEqual([profile.id]);
		expect(merged.profileErrors).toEqual([]);
	});
});

describe("provider auth-test runner", () => {
	it("returns timeout status with redacted diagnostics", async () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const recordPromise = runProviderAuthTest(profile, {
			timeoutMs: 1,
			maxAttempts: 1,
			probe: () => new Promise(() => undefined),
			now: () => new Date(fixedCheckedAt),
		});
		await vi.advanceTimersByTimeAsync(1);
		const record = await recordPromise;

		expect(record).toMatchObject({
			providerId: profile.id,
			status: "timeout",
			checkedAt: fixedCheckedAt,
		});
		expect(JSON.stringify(record)).not.toContain("runtime-value");
	});

	it("redacts probe failure diagnostics before returning auth status", async () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const record = await runProviderAuthTest(profile, {
			maxAttempts: 1,
			probe: async () => ({
				ok: false,
				statusCode: 401,
				diagnostic: {
					providerId: profile.id,
					runtimeSecret: "inline-runtime-value",
				},
			}),
			now: () => new Date(fixedCheckedAt),
		});

		expect(record.status).toBe("failed");
		expect(record.statusCode).toBe(401);
		expect(record.diagnostic).toMatchObject({
			runtimeSecret: REDACTED_VALUE,
		});
		expect(JSON.stringify(record)).not.toContain("inline-runtime-value");
	});
});

describe("provider setup preflight", () => {
	it("blocks cloud workflows until trust and auth are both ready", () => {
		const profile = expectFirstProfile(SYNTHETIC_CLOUD_PROFILE_INPUT);
		const untrustedSettings: VoidbrainPluginSettings = {
			...settingsWithCloudProfile(profile),
			trustedProviderIds: [],
		};
		const noAuthSettings: VoidbrainPluginSettings = {
			...settingsWithCloudProfile(profile),
			providerAuthStatuses: [],
		};

		expect(
			preflightProviderSetup(
				{ settings: untrustedSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "privacy-denied",
		});

		expect(
			preflightProviderSetup(
				{ settings: noAuthSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "auth-not-ready",
		});
	});

	it("allows a trusted cloud profile with passed auth and matching capability", () => {
		const profile = expectFirstProfile(SYNTHETIC_CLOUD_PROFILE_INPUT);
		const settings = settingsWithCloudProfile(profile);
		const providers = buildProviderDefinitionsForSettings(settings);

		expect(providers.find((provider) => provider.id === SYNTHETIC_CLOUD_PROFILE_ID)).toBeDefined();
		expect(
			preflightProviderSetup(
				{ settings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: true,
			provider: {
				id: SYNTHETIC_CLOUD_PROFILE_ID,
			},
		});
	});

	it("allows selected local profiles only after local readiness is ready", () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const readyAuthStatus: ProviderAuthTestRecord = {
			...passedAuthStatus(profile),
			localRuntimeReadiness: SYNTHETIC_LOCAL_READY_READINESS_RECORD,
		};
		const settings = settingsWithLocalProfile(profile, readyAuthStatus);

		expect(
			preflightProviderSetup(
				{ settings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: true,
			provider: {
				id: profile.id,
			},
		});
	});

	it("denies selected local profiles with missing or offline readiness", () => {
		const profile = expectFirstProfile(SYNTHETIC_LOCAL_PROFILE_INPUT);
		const missingReadinessSettings = settingsWithLocalProfile(profile, passedAuthStatus(profile));
		const offlineSettings = settingsWithLocalProfile(profile, {
			...passedAuthStatus(profile),
			status: "failed",
			localRuntimeReadiness: SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD,
		});

		expect(
			preflightProviderSetup(
				{ settings: missingReadinessSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "local-readiness-not-ready",
			diagnostic: {
				readinessCode: "not-checked",
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: offlineSettings },
				{
					role: "embedding",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "local-readiness-not-ready",
			diagnostic: {
				readinessCode: "offline",
			},
		});
	});

	it("allows OpenAI-compatible local-compatible and trusted cloud profiles after auth readiness passes", () => {
		const localProfile = expectFirstProfile(OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT);
		const trustedCloudProfile = expectFirstProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
		const localSettings = settingsWithOpenAICompatibleProfile(
			localProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_LOCAL_PROFILE_ID, "local-compatible", 2),
		);
		const trustedCloudSettings = settingsWithOpenAICompatibleProfile(
			trustedCloudProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID, "trusted-cloud", 3),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID],
			},
		);

		expect(
			preflightProviderSetup(
				{ settings: localSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: true,
			provider: {
				id: OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
			},
			diagnostic: {
				providerId: OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: trustedCloudSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: true,
			provider: {
				id: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
			},
		});
	});

	it("denies OpenAI-compatible untrusted cloud and custom remote profiles until trust settings allow disclosure", () => {
		const untrustedProfile = expectFirstProfile(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT);
		const customRemoteProfile = expectFirstProfile(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT);
		const untrustedSettings = settingsWithOpenAICompatibleProfile(
			untrustedProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID, "untrusted-cloud", 1),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID],
			},
		);
		const customRemoteWithoutTrust = settingsWithOpenAICompatibleProfile(
			customRemoteProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID, "custom-remote", 2),
			{
				areCloudProvidersEnabled: true,
			},
		);
		const customRemoteTrusted = settingsWithOpenAICompatibleProfile(
			customRemoteProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID, "custom-remote", 2),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID],
			},
		);

		expect(
			preflightProviderSetup(
				{ settings: untrustedSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "privacy-denied",
			diagnostic: {
				endpointClassification: "untrusted-cloud",
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: customRemoteWithoutTrust },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "privacy-denied",
			diagnostic: {
				endpointClassification: "custom-remote",
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: customRemoteTrusted },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: true,
			provider: {
				id: OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
			},
		});
	});

	it("denies OpenAI-compatible missing-secret, auth-failed, and capability mismatch states", () => {
		const missingSecretProfile = expectFirstProfile(OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT);
		const authFailedProfile = expectFirstProfile(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT);
		const capabilityMismatchProfile = expectFirstProfile(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT);
		const missingSecretSettings = settingsWithOpenAICompatibleProfile(
			missingSecretProfile,
			missingSecretOpenAICompatibleAuthStatus(missingSecretProfile, "trusted-cloud"),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID],
			},
		);
		const authFailedSettings = settingsWithOpenAICompatibleProfile(
			authFailedProfile,
			failedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID, "trusted-cloud"),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID],
			},
		);
		const capabilityMismatchSettings = settingsWithOpenAICompatibleProfile(
			capabilityMismatchProfile,
			passedOpenAICompatibleAuthStatus(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID, "trusted-cloud", 1),
			{
				areCloudProvidersEnabled: true,
				trustedProviderIds: [OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID],
			},
		);

		expect(
			preflightProviderSetup(
				{ settings: missingSecretSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "auth-not-ready",
			diagnostic: {
				authReadinessCode: "missing-secret",
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: authFailedSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "auth-not-ready",
			diagnostic: {
				authReadinessCode: "auth-failed",
			},
		});

		expect(
			preflightProviderSetup(
				{ settings: capabilityMismatchSettings },
				{
					role: "chat",
					contentSensitivity: "private-vault",
					workflowId: "voidbrain.chat-with-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "capability-denied",
			diagnostic: {
				capabilityCode: "capability-unsupported",
				endpointClassification: "trusted-cloud",
			},
		});
	});
});
