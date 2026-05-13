import { describe, expect, it, vi } from "vitest";
import {
	localRuntimeReadinessToAuthRecord,
	normalizeProviderProfiles,
	runLocalRuntimeReadinessProbe,
	summarizeLocalRuntimeReadiness,
} from "../src/providers";
import { REDACTED_VALUE } from "../src/providers/redaction";
import type { UserProviderProfile } from "../src/types/provider-setup";
import {
	SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_CHAT_ONLY_MODELS,
	SYNTHETIC_LOCAL_RUNTIME_DUPLICATE_MODELS,
	SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_ONLY_MODELS,
	SYNTHETIC_LOCAL_RUNTIME_MALFORMED_MODELS,
	SYNTHETIC_LOCAL_RUNTIME_MISMATCH_MODELS,
	SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT,
	SYNTHETIC_LOCAL_RUNTIME_REDACTION_DIAGNOSTIC,
	failedLocalRuntimeProbe,
	readyLocalRuntimeProbe,
	timeoutLocalRuntimeProbe,
} from "./fixtures/providers/local-runtime-provider-fixtures";

const fixedCheckedAt = "2026-01-01T00:00:00.000Z";

const expectLocalProfile = (input: unknown = SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT): UserProviderProfile => {
	const normalized = normalizeProviderProfiles([input]);

	if (normalized.profiles[0] === undefined) {
		throw new Error(`Expected local runtime profile to parse: ${JSON.stringify(normalized.errors)}`);
	}

	return normalized.profiles[0];
};

describe("local runtime provider profile contracts", () => {
	it("parses setup-safe local profile metadata", () => {
		const profile = expectLocalProfile();

		expect(profile.localRuntime).toMatchObject({
			runtimeFamily: "generic-openai-compatible",
			modelCount: 2,
			chatModelCount: 1,
			embeddingModelCount: 1,
		});
		expect(JSON.stringify(profile)).not.toContain("inline-runtime-value");
	});

	it("rejects non-local endpoints and missing embedding capability", () => {
		const nonLocal = normalizeProviderProfiles([
			{
				...SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT,
				endpoint: {
					baseUrl: "https://runtime.example.invalid/v1",
					isCloudEndpoint: true,
				},
			},
		]);
		const missingEmbedding = normalizeProviderProfiles([
			{
				...SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT,
				models: [SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT.models[0]],
			},
		]);

		expect(nonLocal.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "endpoint-non-local" })]),
		);
		expect(missingEmbedding.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "missing-embedding-model" })]),
		);
	});
});

describe("local runtime readiness probes", () => {
	it("returns ready readiness from ID-only model metadata using declared profile contracts", async () => {
		const profile = expectLocalProfile();
		const readiness = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe([
				{ id: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID },
				{ id: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID },
			]),
			now: () => new Date(fixedCheckedAt),
		});
		const summaries = summarizeLocalRuntimeReadiness(readiness);

		expect(readiness).toMatchObject({
			status: "ready",
			code: "ready",
			checkedAt: fixedCheckedAt,
			modelCount: 2,
			chatModelCount: 1,
			embeddingModelCount: 1,
		});
		expect(summaries.map((summary) => summary.status)).toEqual(["ready", "ready"]);
		expect(localRuntimeReadinessToAuthRecord(profile, readiness)).toMatchObject({
			status: "passed",
			localRuntimeReadiness: {
				code: "ready",
			},
		});
	});

	it("fails closed for offline and timeout probes", async () => {
		const profile = expectLocalProfile();
		const offline = await runLocalRuntimeReadinessProbe(profile, {
			probe: failedLocalRuntimeProbe("offline", { providerId: profile.id, reason: "connection-refused" }),
			now: () => new Date(fixedCheckedAt),
		});
		const timeoutPromise = runLocalRuntimeReadinessProbe(profile, {
			probe: timeoutLocalRuntimeProbe(),
			timeoutMs: 1,
			now: () => new Date(fixedCheckedAt),
		});
		await vi.advanceTimersByTimeAsync(1);
		const timeout = await timeoutPromise;

		expect(offline).toMatchObject({ status: "not-ready", code: "offline" });
		expect(timeout).toMatchObject({ status: "not-ready", code: "timeout" });
	});

	it("fails closed for malformed, duplicate, and capability-mismatched model metadata", async () => {
		const profile = expectLocalProfile();
		const malformed = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(SYNTHETIC_LOCAL_RUNTIME_MALFORMED_MODELS),
		});
		const duplicate = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(SYNTHETIC_LOCAL_RUNTIME_DUPLICATE_MODELS),
		});
		const mismatch = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(SYNTHETIC_LOCAL_RUNTIME_MISMATCH_MODELS),
		});

		expect(malformed.code).toBe("malformed-model-metadata");
		expect(duplicate.code).toBe("duplicate-model-id");
		expect(mismatch.code).toBe("capability-mismatch");
	});

	it("fails closed when chat or embedding capability is missing", async () => {
		const profile = expectLocalProfile();
		const chatOnly = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(SYNTHETIC_LOCAL_RUNTIME_CHAT_ONLY_MODELS),
		});
		const embeddingOnly = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_ONLY_MODELS),
		});

		expect(chatOnly).toMatchObject({
			status: "warning",
			code: "missing-embedding-capability",
		});
		expect(embeddingOnly).toMatchObject({
			status: "warning",
			code: "missing-chat-capability",
		});
	});

	it("redacts diagnostics before returning readiness records", async () => {
		const profile = expectLocalProfile();
		const readiness = await runLocalRuntimeReadinessProbe(profile, {
			probe: readyLocalRuntimeProbe(undefined, {
				...SYNTHETIC_LOCAL_RUNTIME_REDACTION_DIAGNOSTIC,
				authorization: "Bearer inline-runtime-value",
			}),
		});

		expect(readiness.diagnostic).toMatchObject({
			runtimeSecret: REDACTED_VALUE,
			authorization: REDACTED_VALUE,
		});
		expect(JSON.stringify(readiness)).not.toContain("inline-runtime-value");
	});
});
