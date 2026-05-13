import { describe, expect, it } from "vitest";
import {
	UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderReadinessGuidance,
	composeProviderTroubleshootingReport,
	createProviderTroubleshootingRecovery,
	makeProviderModelId,
} from "../src/providers";
import { DEFAULT_PLUGIN_SETTINGS } from "../src/types/plugin";
import { makeNormalizedVaultPath } from "../src/types/vault";
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
} from "./fixtures/providers/provider-troubleshooting-fixtures";

const reportFor = (scenario: ReturnType<typeof localOutageTroubleshootingScenario>) =>
	composeProviderTroubleshootingReport({
		settings: scenario.settings,
		providers: scenario.providers,
		semanticCompatibility: scenario.semanticCompatibility,
		cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
		reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
		now: PROVIDER_TROUBLESHOOTING_FIXED_DATE,
	});

const readinessCodes = (scenario: ReturnType<typeof localOutageTroubleshootingScenario>) =>
	reportFor(scenario).diagnostics.map((diagnostic) => diagnostic.readinessCode);

const actionKinds = (scenario: ReturnType<typeof localOutageTroubleshootingScenario>) =>
	reportFor(scenario).actions.map((action) => action.kind);

describe("provider troubleshooting recovery UX", () => {
	it("composes local outage, missing secret, auth failure, timeout, and ready reports", () => {
		expect(readinessCodes(localOutageTroubleshootingScenario())).toContain("offline");
		expect(actionKinds(localOutageTroubleshootingScenario())).toEqual(
			expect.arrayContaining(["retest-auth", "retry-provider-setup", "reset-provider-state"]),
		);

		expect(readinessCodes(missingSecretTroubleshootingScenario())).toContain("missing-secret");
		expect(readinessCodes(authFailureTroubleshootingScenario())).toContain("auth-failed");

		const timeoutScenario = authFailureTroubleshootingScenario();
		const timeoutStatus = timeoutScenario.settings.providerAuthStatuses[0];
		if (timeoutStatus === undefined) {
			throw new Error("Expected synthetic auth status.");
		}
		const timeoutReadiness = timeoutStatus.openaiCompatibleReadiness;
		if (timeoutReadiness === undefined) {
			throw new Error("Expected synthetic OpenAI-compatible readiness.");
		}
		const timeoutReport = reportFor({
			...timeoutScenario,
			settings: {
				...timeoutScenario.settings,
				providerAuthStatuses: [
					{
						...timeoutStatus,
						status: "timeout",
						openaiCompatibleReadiness: {
							...timeoutReadiness,
							status: "not-ready",
							code: "auth-timeout",
						},
					},
				],
			},
		});
		expect(timeoutReport.diagnostics.map((diagnostic) => diagnostic.readinessCode)).toContain("auth-timeout");

		const ready = reportFor(readyTroubleshootingScenario());
		expect(ready).toMatchObject({
			severity: "ready",
			diagnostics: [],
		});
	});

	it("reports cloud disclosure, untrusted cloud, capability mismatch, and semantic fallback", () => {
		const cloudDisabled = reportFor(cloudDisabledTroubleshootingScenario());
		expect(cloudDisabled).toMatchObject({
			severity: "warning",
			cloudDisclosureRequired: true,
			isCloudProviderBlocked: true,
		});
		expect(cloudDisabled.diagnostics.map((diagnostic) => diagnostic.readinessCode)).toContain("cloud-disabled");
		expect(cloudDisabled.actions.map((action) => action.kind)).toContain("review-disclosure");

		const untrustedSettings = {
			...DEFAULT_PLUGIN_SETTINGS,
			areCloudProvidersEnabled: true,
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				chat: {
					providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					modelId: makeProviderModelId("untrusted-cloud-chat-fixture"),
				},
			},
			providerAuthStatuses: [
				{
					providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					status: "passed" as const,
					checkedAt: "2026-05-13T00:00:00.000Z",
					statusCode: 200,
					modelCount: 1,
					durationMs: 1,
					diagnostic: {
						providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					},
				},
			],
		};
		const untrusted = composeProviderTroubleshootingReport({
			settings: untrustedSettings,
			providers: trustedCloudReadyTroubleshootingScenario().providers,
			now: PROVIDER_TROUBLESHOOTING_FIXED_DATE,
		});
		expect(untrusted.severity).toBe("error");
		expect(untrusted.diagnostics.map((diagnostic) => diagnostic.readinessCode)).toContain("provider-not-trusted");

		expect(readinessCodes(capabilityMismatchTroubleshootingScenario())).toContain("capability-mismatch");

		const semanticFallback = reportFor(semanticFallbackTroubleshootingScenario());
		expect(semanticFallback.severity).toBe("warning");
		expect(semanticFallback.diagnostics.map((diagnostic) => diagnostic.kind)).toContain("semantic-compatibility");
		expect(semanticFallback.actions.map((action) => action.kind)).toContain("retry-provider-setup");
	});

	it("keeps recovery and diagnostic fields bounded and redacted", () => {
		const secretProbe = ["sk", "provider-troubleshooting-fixture"].join("-");
		const privatePathProbe = ["/", "home", "fixture", "vault", "secret-note.md"].join("/");
		const recovery = createProviderTroubleshootingRecovery({
			reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
			cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
			validationOutput: [
				`auth failed with ${secretProbe}`,
				`read failed at ${privatePathProbe}`,
				"provider-readiness:synthetic-fixture",
			],
		});
		const serializedRecovery = JSON.stringify(recovery);

		expect(serializedRecovery).not.toContain(secretProbe);
		expect(serializedRecovery).not.toContain(privatePathProbe);
		expect(serializedRecovery).toContain("[REDACTED]");

		const report = reportFor(missingSecretTroubleshootingScenario());
		const serializedReport = JSON.stringify(report);
		expect(serializedReport).not.toContain("authorization");
		expect(serializedReport).not.toContain("password");
		expect(serializedReport).not.toContain("raw note");
		expect(report.recovery).toMatchObject({
			commandId: "voidbrain.provider-troubleshooting",
			cachePath: PROVIDER_TROUBLESHOOTING_CACHE_PATH,
			reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
		});
	});

	it("keeps provider readiness guidance bounded in troubleshooting scenarios", () => {
		const scenario = semanticFallbackTroubleshootingScenario();
		const report = reportFor(scenario);
		const guidance = buildProviderReadinessGuidance({
			settings: scenario.settings,
			providers: scenario.providers,
			providerTroubleshooting: report,
			semanticCompatibility: scenario.semanticCompatibility,
			cachePath: makeNormalizedVaultPath(".voidbrain/cache/provider-readiness.json"),
			reportId: PROVIDER_TROUBLESHOOTING_REPORT_ID,
			validationOutput: report.recovery.validationOutput,
		});
		const serializedGuidance = JSON.stringify(guidance);

		expect(guidance.paths[0]?.fallback).toMatchObject({
			mode: "lexical",
			status: "warning",
			readinessCode: "provider-offline",
		});
		expect(guidance.paths[0]?.fallback.summary).toContain("lexical fallback remains available");
		expect(guidance.actions.map((action) => action.kind)).toContain("refresh-index");
		expect(serializedGuidance).not.toContain("runtimeSecret");
		expect(serializedGuidance).not.toContain("authorization");
		expect(serializedGuidance).not.toContain("raw note");
	});
});
