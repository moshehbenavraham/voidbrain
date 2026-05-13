import { describe, expect, it } from "vitest";
import {
	normalizeProviderProfiles,
	providerProfileToDefinition,
	runProviderAuthTest,
	summarizeOpenAICompatibleCapabilityReadiness,
} from "../src/providers";
import { REDACTED_VALUE } from "../src/providers/redaction";
import type { ProviderSecretStore } from "../src/providers/secret-store";
import type { UserProviderProfile } from "../src/types/provider-setup";
import {
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	OPENAI_COMPATIBLE_REMOTE_WITHOUT_REFERENCE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT,
	fixedOpenAICompatibleCheckedAt,
} from "./fixtures/providers/openai-compatible-provider-fixtures";

const expectFirstProfile = (input: unknown): UserProviderProfile => {
	const normalized = normalizeProviderProfiles([input]);

	if (normalized.profiles[0] === undefined) {
		throw new Error(`Expected profile fixture to parse: ${JSON.stringify(normalized.errors)}`);
	}

	return normalized.profiles[0];
};

const readableSecretStore: ProviderSecretStore = {
	save: async () => ({
		ok: false,
		error: {
			code: "invalid-secret-input",
			message: "Synthetic test store is read-only.",
		},
	}),
	read: async () => ({
		ok: true,
		value: "synthetic-runtime-value",
	}),
	delete: async () => ({ ok: true, value: false }),
	listReferences: () => [],
};

describe("OpenAI-compatible provider profile contracts", () => {
	it("classifies local-compatible, custom remote, trusted cloud, and untrusted cloud profiles", () => {
		const localProfile = expectFirstProfile(OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT);
		const customRemoteProfile = expectFirstProfile(OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT);
		const trustedCloudProfile = expectFirstProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
		const untrustedCloudProfile = expectFirstProfile(OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT);

		expect(localProfile).toMatchObject({
			profileKind: "openai-compatible",
			providerKind: "local",
			trustLevel: "local-runtime",
			openaiCompatible: {
				endpointClassification: "local-compatible",
				isRemoteDisclosureRequired: false,
				isCredentialRequired: false,
			},
		});
		expect(customRemoteProfile.openaiCompatible).toMatchObject({
			endpointClassification: "custom-remote",
			isRemoteDisclosureRequired: true,
			isCredentialRequired: true,
		});
		expect(trustedCloudProfile.openaiCompatible).toMatchObject({
			endpointClassification: "trusted-cloud",
			isTrustRequired: true,
		});
		expect(untrustedCloudProfile.openaiCompatible).toMatchObject({
			endpointClassification: "untrusted-cloud",
			isRemoteDisclosureRequired: true,
		});
	});

	it("adds setup-safe endpoint classification metadata to provider definitions", () => {
		const profile = expectFirstProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
		const definition = providerProfileToDefinition(profile, "passed");

		expect(definition.setupMetadata?.openaiCompatible).toMatchObject({
			endpointClassification: "trusted-cloud",
			endpointHost: "api.openai.example.invalid",
			isRemoteDisclosureRequired: true,
			chatModelCount: 1,
			streamingModelCount: 1,
			embeddingModelCount: 1,
			toolModelCount: 1,
			attachmentModelCount: 1,
		});
		expect(JSON.stringify(definition)).not.toContain("synthetic-runtime-value");
	});

	it("rejects remote profiles without opaque credential references or with unsafe provider state", () => {
		const missingReference = normalizeProviderProfiles([OPENAI_COMPATIBLE_REMOTE_WITHOUT_REFERENCE_PROFILE_INPUT]);
		const unsafeProfile = normalizeProviderProfiles([
			{
				...OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
				["api" + "Key"]: "synthetic-runtime-value",
			},
		]);
		const endpointWithCredential = normalizeProviderProfiles([
			{
				...OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
				endpoint: {
					baseUrl: "https://synthetic-user:synthetic-pass@api.openai.example.invalid/v1",
				},
			},
		]);

		expect(missingReference.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "missing-credential-reference" })]),
		);
		expect(unsafeProfile.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "unsafe-provider-state" })]),
		);
		expect(endpointWithCredential.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "endpoint-invalid" })]),
		);
	});

	it("maps auth readiness to stable codes and redacts diagnostics", async () => {
		const profile = expectFirstProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
		const passedRecord = await runProviderAuthTest(profile, {
			secretStore: readableSecretStore,
			maxAttempts: 1,
			now: () => new Date(fixedOpenAICompatibleCheckedAt),
			probe: async () => ({
				ok: true,
				statusCode: 200,
				modelCount: profile.models.length,
				diagnostic: {
					providerId: profile.id,
					runtimeSecret: "synthetic-runtime-value",
				},
			}),
		});
		const missingSecretProfile = expectFirstProfile(OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT);
		const missingSecretRecord = await runProviderAuthTest(missingSecretProfile, {
			maxAttempts: 1,
			now: () => new Date(fixedOpenAICompatibleCheckedAt),
		});

		expect(passedRecord).toMatchObject({
			status: "passed",
			openaiCompatibleReadiness: {
				status: "ready",
				code: "ready",
				endpointClassification: "trusted-cloud",
			},
		});
		expect(passedRecord.openaiCompatibleReadiness?.diagnostic).toMatchObject({
			runtimeSecret: REDACTED_VALUE,
		});
		expect(missingSecretRecord).toMatchObject({
			status: "missing-secret",
			openaiCompatibleReadiness: {
				status: "not-ready",
				code: "missing-secret",
			},
		});
		expect(JSON.stringify([passedRecord, missingSecretRecord])).not.toContain("synthetic-runtime-value");
	});

	it("maps capability readiness to ready, missing model, and capability mismatch codes", () => {
		const trustedProfile = expectFirstProfile(OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT);
		const trustedDefinition = providerProfileToDefinition(trustedProfile, "passed");
		const mismatchProfile = expectFirstProfile(OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT);
		const mismatchDefinition = providerProfileToDefinition(mismatchProfile, "passed");

		expect(summarizeOpenAICompatibleCapabilityReadiness(trustedDefinition, "chat", "chat", null)).toMatchObject({
			status: "ready",
			code: "ready",
			modelId: trustedProfile.models.find((model) => model.roles.includes("chat"))?.id,
		});
		expect(
			summarizeOpenAICompatibleCapabilityReadiness(
				mismatchDefinition,
				"chat",
				"chat",
				mismatchProfile.models[0]?.id ?? null,
			),
		).toMatchObject({
			status: "not-ready",
			code: "capability-mismatch",
		});
		expect(summarizeOpenAICompatibleCapabilityReadiness(mismatchDefinition, "chat", "chat", null)).toMatchObject({
			status: "not-ready",
			code: "model-missing",
		});
	});
});
