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
	SYNTHETIC_CLOUD_PROFILE_ID,
	SYNTHETIC_CLOUD_PROFILE_INPUT,
	SYNTHETIC_DUPLICATE_PROFILE_INPUTS,
	SYNTHETIC_LOCAL_PROFILE_INPUT,
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
});
