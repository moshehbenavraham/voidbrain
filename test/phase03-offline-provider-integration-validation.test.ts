import { describe, expect, it, vi } from "vitest";
import { scanFixtureSafetyText } from "../src/agent/fixture-safety";
import {
	buildProviderPrivacyPolicy,
	composeProviderTroubleshootingReport,
	createProviderChatInvoker,
	createProviderEmbeddingInvoker,
	createProviderInvocationKey,
	createProviderTroubleshootingRecovery,
	normalizeProviderInvocationDiagnostic,
	preflightProviderInvocation,
	runLocalRuntimeReadinessProbe,
	runProviderAuthTest,
	summarizeOpenAICompatibleCapabilityReadiness,
	summarizeProviderRoleCapabilities,
} from "../src/providers";
import type { ProviderChatInvocationResult } from "../src/providers/chat-provider";
import { REDACTED_VALUE } from "../src/providers/redaction";
import type { ProviderSecretStore } from "../src/providers/secret-store";
import type { ProviderEmbeddingInvocationResult } from "../src/types/provider-invocation";
import type { ProviderDefinition, ProviderId, ProviderModelId } from "../src/types/providers";
import type { SemanticIndexCompatibility } from "../src/types/retrieval";
import { evaluateSemanticIndexCompatibility } from "../src/vectorstore";
import {
	SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
	SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	readyLocalRuntimeProbe,
} from "./fixtures/providers/local-runtime-provider-fixtures";
import {
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	fixedOpenAICompatibleCheckedAt,
} from "./fixtures/providers/openai-compatible-provider-fixtures";
import {
	PHASE03_PROVIDER_INTEGRATION_CACHE_PATH,
	PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
	PHASE03_PROVIDER_INTEGRATION_REPORT_ID,
	PHASE03_PROVIDER_INTEGRATION_STAGED_CHANGE_ID,
	PHASE03_PROVIDER_INTEGRATION_TARGET_PATH,
	PHASE03_PROVIDER_INTEGRATION_VALIDATION_OUTPUT,
	PHASE03_REDACTION_SENTINELS,
	PHASE03_TROUBLESHOOTING_FIXED_DATE,
	createPhase03BaseSettings,
	createPhase03FixtureSafetyEntries,
	createPhase03ProviderProfiles,
	createPhase03ProviderScenarios,
	createPhase03SemanticCompatibilityCases,
	createPhase03TroubleshootingRecoveryInput,
	createPhase03TroubleshootingScenarios,
} from "./fixtures/providers/phase03-provider-integration-fixtures";
import {
	SYNTHETIC_INVOCATION_SOURCE_PATH,
	cancellationAwareChatTransport,
	cancellationAwareEmbeddingTransport,
	retryThenSuccessChatTransport,
	retryThenSuccessEmbeddingTransport,
	secretLikeFailureChatTransport,
	secretLikeFailureEmbeddingTransport,
	successfulChatTransport,
	successfulEmbeddingTransport,
	syntheticChatProviderRequest,
	syntheticEmbeddingProviderRequest,
	timeoutChatTransport,
	timeoutEmbeddingTransport,
} from "./fixtures/providers/provider-invocation-fixtures";
import {
	PROVIDER_TROUBLESHOOTING_CACHE_PATH,
	PROVIDER_TROUBLESHOOTING_REPORT_ID,
} from "./fixtures/providers/provider-troubleshooting-fixtures";

type Phase03HarnessIssueCode =
	| "phase03.invalid-scenario"
	| "phase03.name-missing"
	| "phase03.settings-missing"
	| "phase03.providers-missing"
	| "phase03.provider-missing"
	| "phase03.model-missing"
	| "phase03.recovery-field-missing";

interface Phase03HarnessIssue {
	readonly code: Phase03HarnessIssueCode;
	readonly field: string;
	readonly message: string;
}

interface Phase03HarnessScenario {
	readonly name: string;
	readonly settings: unknown;
	readonly providers: readonly ProviderDefinition[];
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const issue = (code: Phase03HarnessIssueCode, field: string, message: string): Phase03HarnessIssue => ({
	code,
	field,
	message,
});

const validatePhase03HarnessScenario = (input: unknown): readonly Phase03HarnessIssue[] => {
	if (!isRecord(input)) {
		return [issue("phase03.invalid-scenario", "root", "Scenario must be an object.")];
	}

	const issues: Phase03HarnessIssue[] = [];
	if (typeof input.name !== "string" || input.name.trim().length === 0) {
		issues.push(issue("phase03.name-missing", "name", "Scenario name is required."));
	}

	if (!isRecord(input.settings)) {
		issues.push(issue("phase03.settings-missing", "settings", "Scenario settings are required."));
	}

	if (!Array.isArray(input.providers) || input.providers.length === 0) {
		issues.push(issue("phase03.providers-missing", "providers", "At least one provider definition is required."));
	}

	return issues;
};

const expectValidPhase03Scenario = (input: unknown): Phase03HarnessScenario => {
	const issues = validatePhase03HarnessScenario(input);
	if (issues.length > 0) {
		throw new Error(`Invalid Phase 03 scenario: ${JSON.stringify(issues)}`);
	}

	return input as Phase03HarnessScenario;
};

const providerById = (
	providers: readonly ProviderDefinition[],
	providerId: ProviderId,
): ProviderDefinition | undefined => providers.find((provider) => provider.id === providerId);

const expectProvider = (providers: readonly ProviderDefinition[], providerId: ProviderId): ProviderDefinition => {
	const provider = providerById(providers, providerId);
	if (provider === undefined) {
		throw new Error(
			JSON.stringify([issue("phase03.provider-missing", "providerId", `Missing provider ${providerId}.`)]),
		);
	}
	return provider;
};

const expectProviderModel = (
	providers: readonly ProviderDefinition[],
	providerId: ProviderId,
	modelId: ProviderModelId,
) => {
	const provider = expectProvider(providers, providerId);
	const model = provider.models.find((candidate) => candidate.id === modelId);
	if (model === undefined) {
		throw new Error(JSON.stringify([issue("phase03.model-missing", "modelId", `Missing model ${modelId}.`)]));
	}
	return model;
};

const expectNoSerializedSentinels = (value: unknown, sentinels: readonly string[]): void => {
	const serialized = JSON.stringify(value).toLowerCase();
	for (const sentinel of sentinels) {
		expect(serialized).not.toContain(sentinel.toLowerCase());
	}
};

const expectRecoveryFields = (value: unknown, fields: readonly string[]): void => {
	const serialized = JSON.stringify(value);
	for (const field of fields) {
		if (!serialized.includes(field)) {
			throw new Error(
				JSON.stringify([issue("phase03.recovery-field-missing", field, `Missing recovery field ${field}.`)]),
			);
		}
	}
};

const invocationStatusCodes = (
	results: readonly (ProviderChatInvocationResult | ProviderEmbeddingInvocationResult)[],
): readonly string[] => results.map((result) => (result.ok ? "ok" : result.code));

const compatibilityCodes = (compatibilities: readonly SemanticIndexCompatibility[]): readonly string[] =>
	compatibilities.map((compatibility) => compatibility.code);

const phase03Recovery = {
	commandId: "voidbrain.chat-with-vault",
	providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	modelId: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
	targetPath: PHASE03_PROVIDER_INTEGRATION_TARGET_PATH,
	cachePath: PHASE03_PROVIDER_INTEGRATION_CACHE_PATH,
	stagedChangeId: PHASE03_PROVIDER_INTEGRATION_STAGED_CHANGE_ID,
	reportId: PHASE03_PROVIDER_INTEGRATION_REPORT_ID,
	readinessCode: "ready",
	sourcePathCount: 1,
	validationOutput: PHASE03_PROVIDER_INTEGRATION_VALIDATION_OUTPUT,
} as const;

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
		value: "phase03-runtime-value",
	}),
	delete: async () => ({ ok: true, value: false }),
	listReferences: () => [],
};

const expectBoundedProviderRecovery = (value: unknown): void => {
	expectRecoveryFields(value, [
		"commandId",
		"providerId",
		"modelId",
		"targetPath",
		"cachePath",
		"stagedChangeId",
		"reportId",
		"validationOutput",
	]);
	expectNoSerializedSentinels(value, PHASE03_REDACTION_SENTINELS);
};

describe("Phase 03 offline provider integration harness", () => {
	it("fails closed for malformed scenario input with explicit issue codes", () => {
		expect(validatePhase03HarnessScenario(null)).toEqual([
			{
				code: "phase03.invalid-scenario",
				field: "root",
				message: "Scenario must be an object.",
			},
		]);
		expect(validatePhase03HarnessScenario({ name: "", settings: {}, providers: [] })).toEqual([
			{
				code: "phase03.name-missing",
				field: "name",
				message: "Scenario name is required.",
			},
			{
				code: "phase03.providers-missing",
				field: "providers",
				message: "At least one provider definition is required.",
			},
		]);
	});

	it("accepts the shared Phase 03 provider scenarios", () => {
		const scenarios = createPhase03ProviderScenarios().map(expectValidPhase03Scenario);

		expect(scenarios.map((scenario) => scenario.name)).toEqual([
			"local-runtime-ready",
			"trusted-cloud-disabled",
			"trusted-cloud-enabled",
			"untrusted-cloud",
		]);
	});
});

describe("Phase 03 provider profile and readiness integration", () => {
	it("validates local runtime and OpenAI-compatible profiles without leaking setup diagnostics", async () => {
		const profiles = createPhase03ProviderProfiles();
		const localReadiness = await runLocalRuntimeReadinessProbe(profiles.localRuntime, {
			probe: readyLocalRuntimeProbe(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const runtimeSecretKey = ["runtime", "Secret"].join("");
		const authRecord = await runProviderAuthTest(profiles.trustedCloud, {
			secretStore: readableSecretStore,
			maxAttempts: 1,
			now: () => new Date(fixedOpenAICompatibleCheckedAt),
			probe: async () => ({
				ok: true,
				statusCode: 200,
				modelCount: profiles.trustedCloud.models.length,
				diagnostic: {
					providerId: profiles.trustedCloud.id,
					[runtimeSecretKey]: "phase03-runtime-value",
				},
			}),
		});
		const missingSecret = await runProviderAuthTest(profiles.missingSecret, {
			maxAttempts: 1,
			now: () => new Date(fixedOpenAICompatibleCheckedAt),
		});
		const trustedChatModel = profiles.trustedCloud.models.find((model) => model.roles.includes("chat"));
		if (trustedChatModel === undefined) {
			throw new Error("Expected trusted cloud chat model fixture.");
		}
		const settings = createPhase03BaseSettings({
			areCloudProvidersEnabled: true,
			providerRoles: {
				...createPhase03BaseSettings().providerRoles,
				chat: {
					providerId: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
					modelId: trustedChatModel.id,
				},
			},
		});
		const scenario = expectValidPhase03Scenario({
			name: "profile-readiness",
			settings,
			providers: createPhase03ProviderScenarios()[2]?.providers ?? [],
		});
		const trustedDefinition = expectProvider(scenario.providers, OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID);
		const mismatchDefinition = expectProvider(scenario.providers, OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID);
		const roleSummaries = summarizeProviderRoleCapabilities(settings, scenario.providers);

		expect(localReadiness).toMatchObject({
			status: "ready",
			code: "ready",
			chatModelCount: 1,
			embeddingModelCount: 1,
		});
		expect(profiles.openAICompatibleLocal.openaiCompatible).toMatchObject({
			endpointClassification: "local-compatible",
			isRemoteDisclosureRequired: false,
		});
		expect(profiles.trustedCloud.openaiCompatible).toMatchObject({
			endpointClassification: "trusted-cloud",
			isRemoteDisclosureRequired: true,
			isTrustRequired: true,
		});
		expect(profiles.untrustedCloud.openaiCompatible).toMatchObject({
			endpointClassification: "untrusted-cloud",
			isRemoteDisclosureRequired: true,
		});
		expect(authRecord).toMatchObject({
			status: "passed",
			openaiCompatibleReadiness: {
				status: "ready",
				code: "ready",
				endpointClassification: "trusted-cloud",
			},
		});
		expect(authRecord.openaiCompatibleReadiness?.diagnostic).toMatchObject({
			[runtimeSecretKey]: REDACTED_VALUE,
		});
		expect(missingSecret).toMatchObject({
			status: "missing-secret",
			openaiCompatibleReadiness: {
				code: "missing-secret",
			},
		});
		expect(
			summarizeOpenAICompatibleCapabilityReadiness(trustedDefinition, "chat", "chat", trustedChatModel.id),
		).toMatchObject({
			status: "ready",
			code: "ready",
		});
		expect(
			summarizeOpenAICompatibleCapabilityReadiness(
				mismatchDefinition,
				"chat",
				"chat",
				profiles.capabilityMismatch.models[0]?.id ?? null,
			),
		).toMatchObject({
			status: "not-ready",
			code: "capability-mismatch",
		});
		expect(roleSummaries.map((summary) => summary.status)).toContain("ready");
		expectNoSerializedSentinels(
			[localReadiness, authRecord, missingSecret, scenario.providers],
			["phase03-runtime-value", ...PHASE03_REDACTION_SENTINELS],
		);
	});
});

describe("Phase 03 provider invocation boundary integration", () => {
	it("blocks cloud disclosure before private vault chunks become provider requests", () => {
		const cloudDisabled = expectValidPhase03Scenario(createPhase03ProviderScenarios()[1]);
		const trustedCloud = expectProvider(cloudDisabled.providers, OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID);
		const trustedEmbeddingModel = trustedCloud.models.find((model) => model.roles.includes("embedding"));
		if (trustedEmbeddingModel === undefined) {
			throw new Error("Expected trusted cloud embedding model fixture.");
		}

		const preflight = preflightProviderInvocation(
			cloudDisabled.providers,
			buildProviderPrivacyPolicy(cloudDisabled.settings as ReturnType<typeof createPhase03BaseSettings>),
			{
				providerId: trustedCloud.id,
				preferredModelId: trustedEmbeddingModel.id,
				requiredCapability: "embeddings",
				requiredRole: "embedding",
				contentSensitivity: "private-vault",
				sourcePaths: [SYNTHETIC_INVOCATION_SOURCE_PATH],
				workflowId: "voidbrain.semantic-index-readiness",
				userFacingPurpose: "Synthetic Phase 03 cloud denial before embedding invocation.",
			},
		);

		expect(preflight).toMatchObject({
			allowed: false,
			code: "cloud-disabled",
		});
		expectNoSerializedSentinels(preflight, PHASE03_REDACTION_SENTINELS);
	});

	it("handles timeout, cancellation, retry, duplicate prevention, and redacted recovery records", async () => {
		const timeoutChat = createProviderChatInvoker({
			maxAttempts: 1,
			transport: timeoutChatTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const timeoutChatPromise = timeoutChat(
			syntheticChatProviderRequest({ timeoutMs: 5, recovery: phase03Recovery }),
		);
		await vi.advanceTimersByTimeAsync(5);
		const timedOutChat = await timeoutChatPromise;

		const retryChat = createProviderChatInvoker({
			maxAttempts: 2,
			retryBackoffMs: 1,
			transport: retryThenSuccessChatTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const retryChatPromise = retryChat(syntheticChatProviderRequest({ recovery: phase03Recovery }));
		await vi.advanceTimersByTimeAsync(1);
		const retriedChat = await retryChatPromise;

		const canceledController = new AbortController();
		const canceledChat = createProviderChatInvoker({
			transport: cancellationAwareChatTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const canceledChatPromise = canceledChat(
			syntheticChatProviderRequest({ signal: canceledController.signal, recovery: phase03Recovery }),
		);
		canceledController.abort();
		const canceledResult = await canceledChatPromise;

		let releaseDuplicate: (() => void) | undefined;
		const duplicateChat = createProviderChatInvoker({
			transport: (input) =>
				new Promise((resolve) => {
					releaseDuplicate = () => resolve(successfulChatTransport()(input));
				}),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const duplicateRequest = syntheticChatProviderRequest({
			invocationKey: createProviderInvocationKey(["phase03", "duplicate-chat"]),
			recovery: phase03Recovery,
		});
		const firstDuplicate = duplicateChat(duplicateRequest);
		await Promise.resolve();
		const duplicateBlocked = await duplicateChat(duplicateRequest);
		releaseDuplicate?.();
		const duplicateReleased = await firstDuplicate;

		const timeoutEmbedding = createProviderEmbeddingInvoker({
			maxAttempts: 1,
			transport: timeoutEmbeddingTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const timeoutEmbeddingPromise = timeoutEmbedding(
			syntheticEmbeddingProviderRequest({
				timeoutMs: 5,
				recovery: {
					...phase03Recovery,
					commandId: "voidbrain.semantic-index-readiness",
					modelId: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
				},
			}),
		);
		await vi.advanceTimersByTimeAsync(5);
		const timedOutEmbedding = await timeoutEmbeddingPromise;

		const retryEmbedding = createProviderEmbeddingInvoker({
			maxAttempts: 2,
			retryBackoffMs: 1,
			transport: retryThenSuccessEmbeddingTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const retryEmbeddingPromise = retryEmbedding(syntheticEmbeddingProviderRequest());
		await vi.advanceTimersByTimeAsync(1);
		const retriedEmbedding = await retryEmbeddingPromise;

		const canceledEmbeddingController = new AbortController();
		const canceledEmbedding = createProviderEmbeddingInvoker({
			transport: cancellationAwareEmbeddingTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		});
		const canceledEmbeddingPromise = canceledEmbedding(
			syntheticEmbeddingProviderRequest({ signal: canceledEmbeddingController.signal }),
		);
		canceledEmbeddingController.abort();
		const canceledEmbeddingResult = await canceledEmbeddingPromise;

		const redactedChat = await createProviderChatInvoker({
			maxAttempts: 1,
			transport: secretLikeFailureChatTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		})(syntheticChatProviderRequest({ recovery: phase03Recovery }));
		const redactedEmbedding = await createProviderEmbeddingInvoker({
			maxAttempts: 1,
			transport: secretLikeFailureEmbeddingTransport(),
			now: () => PHASE03_PROVIDER_INTEGRATION_FIXED_DATE,
		})(syntheticEmbeddingProviderRequest());

		expect(
			invocationStatusCodes([timedOutChat, retriedChat, canceledResult, duplicateBlocked, duplicateReleased]),
		).toEqual(["chat.provider-timeout", "ok", "chat.provider-canceled", "chat.duplicate-action", "ok"]);
		expect(invocationStatusCodes([timedOutEmbedding, retriedEmbedding, canceledEmbeddingResult])).toEqual([
			"embedding.provider-timeout",
			"ok",
			"embedding.provider-canceled",
		]);
		expect(retriedChat.attempts.map((attempt) => attempt.status)).toEqual(["failed", "succeeded"]);
		expect(retriedEmbedding.attempts.map((attempt) => attempt.status)).toEqual(["failed", "succeeded"]);
		expectBoundedProviderRecovery([timedOutChat, retriedChat, redactedChat, redactedEmbedding]);
	});
});

describe("Phase 03 semantic compatibility and offline fallback integration", () => {
	it("evaluates ready, stale, missing, incompatible, canceled, provider-blocked, and offline states", () => {
		const compatibilities = createPhase03SemanticCompatibilityCases().map((testCase) => {
			const compatibility = evaluateSemanticIndexCompatibility(testCase.input);

			expect(compatibility).toMatchObject({
				state: testCase.expected.state,
				code: testCase.expected.code,
				fallbackMode: testCase.expected.fallbackMode,
				guidance: {
					action: testCase.expected.guidanceAction,
				},
			});
			if (compatibility.code !== "compatible") {
				expect(compatibility.semanticSearchEligible).toBe(false);
			}
			if (compatibility.fallbackMode === "lexical") {
				expect(compatibility.recovery.fallbackMode).toBe("lexical");
			}

			return compatibility;
		});

		expect(compatibilityCodes(compatibilities)).toEqual([
			"compatible",
			"missing-index",
			"stale-source-fingerprints",
			"family-mismatch",
			"provider-blocked",
			"provider-canceled",
			"provider-offline",
		]);
		expectRecoveryFields(compatibilities, [
			"commandId",
			"providerId",
			"modelId",
			"indexId",
			"reportId",
			"validationOutput",
			"fallbackMode",
		]);
		expectNoSerializedSentinels(compatibilities, PHASE03_REDACTION_SENTINELS);
	});
});

describe("Phase 03 provider troubleshooting integration", () => {
	it("reports local outage, missing secret, auth failure, cloud denial, capability mismatch, and semantic fallback", () => {
		for (const fixture of createPhase03TroubleshootingScenarios()) {
			const report = composeProviderTroubleshootingReport({
				settings: fixture.scenario.settings,
				providers: fixture.scenario.providers,
				semanticCompatibility: fixture.scenario.semanticCompatibility,
				cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
				reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
				now: PHASE03_TROUBLESHOOTING_FIXED_DATE,
			});
			const readinessCodes = report.diagnostics.map((diagnostic) => diagnostic.readinessCode);
			const actionKinds = report.actions.map((action) => action.kind);

			for (const expectedCode of fixture.expectedCodes) {
				expect(readinessCodes).toContain(expectedCode);
			}
			for (const expectedAction of fixture.expectedActions) {
				expect(actionKinds).toContain(expectedAction);
			}
			expectNoSerializedSentinels(report, PHASE03_REDACTION_SENTINELS);
		}

		const untrustedCloud = expectValidPhase03Scenario(createPhase03ProviderScenarios()[3]);
		const untrustedReport = composeProviderTroubleshootingReport({
			settings: untrustedCloud.settings as ReturnType<typeof createPhase03BaseSettings>,
			providers: untrustedCloud.providers,
			now: PHASE03_TROUBLESHOOTING_FIXED_DATE,
		});

		expect(untrustedReport.severity).toBe("error");
		expect(untrustedReport.diagnostics.map((diagnostic) => diagnostic.readinessCode)).toContain(
			"provider-not-trusted",
		);
		expect(untrustedReport.actions.map((action) => action.kind)).toContain("review-disclosure");
	});

	it("redacts troubleshooting recovery validation output while preserving retry context", () => {
		const recovery = createProviderTroubleshootingRecovery(createPhase03TroubleshootingRecoveryInput());

		expect(recovery).toMatchObject({
			commandId: "voidbrain.provider-troubleshooting",
			cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
			reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
		});
		expectNoSerializedSentinels(recovery, PHASE03_REDACTION_SENTINELS);
		expect(JSON.stringify(recovery)).toContain("[REDACTED]");
	});
});

describe("Phase 03 redaction and fixture safety integration", () => {
	it("rejects unsafe closeout examples and redacts provider diagnostics", () => {
		const entries = createPhase03FixtureSafetyEntries();
		const unsafeEntry = entries.find((entry) => entry.path.includes("unsafe"));
		if (unsafeEntry === undefined) {
			throw new Error("Expected unsafe Phase 03 fixture safety entry.");
		}
		const fixtureSafety = scanFixtureSafetyText(unsafeEntry.path, unsafeEntry.content);
		const authHeaderKey = ["authorization", "Header"].join("");
		const promptBodyKey = ["prompt", "Body"].join("");
		const hiddenStateKey = ["hidden", "Provider", "State"].join("");
		const redactedDiagnostic = normalizeProviderInvocationDiagnostic({
			providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
			[authHeaderKey]: ["Bearer", " phase03syntheticvalue000000"].join(""),
			[promptBodyKey]: "raw private note body",
			[hiddenStateKey]: {
				cache: "hidden provider state",
			},
			sourcePathCount: 1,
		});

		expect(fixtureSafety.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "fixture.secret-like-key" }),
				expect.objectContaining({ code: "fixture.credential-like-value" }),
				expect.objectContaining({ code: "fixture.private-path-hint" }),
			]),
		);
		expect(redactedDiagnostic).toMatchObject({
			providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
			[authHeaderKey]: REDACTED_VALUE,
			[promptBodyKey]: REDACTED_VALUE,
			[hiddenStateKey]: REDACTED_VALUE,
			sourcePathCount: 1,
		});
		expectNoSerializedSentinels(redactedDiagnostic, PHASE03_REDACTION_SENTINELS);
	});
});
