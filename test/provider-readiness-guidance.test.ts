import { describe, expect, it } from "vitest";
import {
	PROVIDER_READINESS_GATE_KINDS,
	buildProviderReadinessGuidance,
	createProviderReadinessRecovery,
	validateProviderReadinessDiagnosticsSafety,
} from "../src/providers";
import { makeNormalizedVaultPath } from "../src/types/vault";
import {
	PROVIDER_READINESS_CACHE_PATH,
	PROVIDER_READINESS_REPORT_ID,
	PROVIDER_READINESS_VALIDATION_OUTPUT,
	authFailedReadinessScenario,
	authTimeoutReadinessScenario,
	capabilityMismatchReadinessScenario,
	cloudDisabledReadinessScenario,
	customRemoteReadinessScenario,
	localOutageReadinessScenario,
	localRuntimeReadinessScenario,
	missingSecretReadinessScenario,
	openAICompatibleLocalReadinessScenario,
	providerNotTrustedReadinessScenario,
	semanticFallbackReadinessScenario,
	trustedCloudReadinessScenario,
	unsafeProviderReadinessScenario,
	untrustedCloudReadinessScenario,
} from "./fixtures/providers/provider-readiness-guidance-fixtures";

const guidanceFor = (scenario: ReturnType<typeof localRuntimeReadinessScenario>) =>
	buildProviderReadinessGuidance({
		settings: scenario.settings,
		providers: scenario.providers,
		semanticCompatibility: scenario.semanticCompatibility,
		cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
		reportId: PROVIDER_READINESS_REPORT_ID,
		validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
	});

const firstPath = (scenario: ReturnType<typeof localRuntimeReadinessScenario>) => {
	const path = guidanceFor(scenario).paths[0];
	if (path === undefined) {
		throw new Error("Expected provider readiness path.");
	}

	return path;
};

describe("provider readiness guidance", () => {
	it("classifies provider path classes and keeps gate ordering deterministic", () => {
		const cases = [
			[localRuntimeReadinessScenario(), "local-runtime", "ready"],
			[openAICompatibleLocalReadinessScenario(), "openai-compatible-local", "ready"],
			[customRemoteReadinessScenario(), "custom-remote", "ready"],
			[trustedCloudReadinessScenario(), "trusted-cloud", "ready"],
			[untrustedCloudReadinessScenario(), "untrusted-cloud", "error"],
		] as const;

		for (const [scenario, expectedClass, expectedSeverity] of cases) {
			const guidance = guidanceFor(scenario);
			const path = guidance.paths[0];

			expect(path?.pathClass).toBe(expectedClass);
			expect(path?.gates.map((gate) => gate.kind)).toEqual([...PROVIDER_READINESS_GATE_KINDS]);
			expect(guidance.severity).toBe(expectedSeverity);
			expect(JSON.stringify(guidance)).not.toContain("runtimeSecret");
			expect(JSON.stringify(guidance)).not.toContain("authorization");
		}
	});

	it("summarizes ready local and trusted paths with bounded recovery fields", () => {
		const local = guidanceFor(localRuntimeReadinessScenario());
		expect(local).toMatchObject({
			severity: "ready",
			providerCount: 1,
			cloudDisclosureRequired: false,
			recovery: {
				commandId: "voidbrain.provider-readiness-guidance",
				cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
				reportId: PROVIDER_READINESS_REPORT_ID,
			},
		});
		expect(local.paths[0]?.fallback.mode).toBe("not-evaluated");

		const trusted = guidanceFor(trustedCloudReadinessScenario());
		expect(trusted).toMatchObject({
			severity: "ready",
			cloudDisclosureRequired: true,
		});
		expect(trusted.paths[0]?.gates.find((gate) => gate.kind === "disclosure")).toMatchObject({
			status: "ready",
			required: true,
		});
	});

	it("reports auth, local outage, capability, trust, and disclosure blockers", () => {
		expect(firstPath(missingSecretReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"missing-secret",
		);
		expect(firstPath(authFailedReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"auth-failed",
		);
		expect(firstPath(authTimeoutReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"auth-timeout",
		);
		expect(firstPath(localOutageReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"local-runtime-not-ready",
		);
		expect(firstPath(capabilityMismatchReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"capability-mismatch",
		);
		expect(firstPath(cloudDisabledReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"cloud-disabled",
		);
		expect(firstPath(providerNotTrustedReadinessScenario()).blockers.map((blocker) => blocker.code)).toContain(
			"provider-not-trusted",
		);
		expect(firstPath(untrustedCloudReadinessScenario()).blockers.map((blocker) => blocker.code)).toEqual(
			expect.arrayContaining(["untrusted-cloud-blocked", "provider-not-trusted"]),
		);
	});

	it("orders blocker actions deterministically with visible next steps", () => {
		const missingSecretActions = firstPath(missingSecretReadinessScenario()).actions.map((action) => action.kind);
		expect(missingSecretActions).toEqual(["test-provider", "reset-provider-state", "inspect-recovery"]);

		const cloudDisabledActions = firstPath(cloudDisabledReadinessScenario()).actions.map((action) => action.kind);
		expect(cloudDisabledActions).toEqual(["review-disclosure", "inspect-recovery"]);
	});

	it("keeps semantic lexical fallback explicit without cloud substitution", () => {
		const guidance = guidanceFor(semanticFallbackReadinessScenario());
		const path = guidance.paths[0];

		expect(path?.fallback).toMatchObject({
			mode: "lexical",
			status: "warning",
			readinessCode: "provider-offline",
			sourcePathCount: 3,
		});
		expect(path?.blockers.map((blocker) => blocker.code)).toContain("semantic-fallback");
		expect(path?.actions.map((action) => action.kind)).toContain("refresh-index");
		expect(path?.recovery).toMatchObject({
			fallbackMode: "lexical",
			sourcePathCount: 3,
			validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
		});
		expect(JSON.stringify(guidance).toLowerCase()).not.toContain(
			"silently fall back from local providers to cloud",
		);
	});

	it("fails closed for unsafe provider state and diagnostic safety issues", () => {
		const unsafeGuidance = guidanceFor(unsafeProviderReadinessScenario());
		expect(unsafeGuidance).toMatchObject({
			severity: "error",
			providerCount: 0,
			recovery: {
				readinessCode: "unsafe-provider-state",
			},
		});

		const secretProbe = ["sk", "providerreadinessfixture"].join("-");
		const privatePathProbe = ["", "home", "fixture", "vault", "source.md"].join("/");
		const recovery = createProviderReadinessRecovery({
			reportId: PROVIDER_READINESS_REPORT_ID,
			cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
			validationOutput: [`auth failed with ${secretProbe}`, `read failed at ${privatePathProbe}`],
		});
		const serializedRecovery = JSON.stringify(recovery);

		expect(serializedRecovery).not.toContain(secretProbe);
		expect(serializedRecovery).not.toContain(privatePathProbe);
		expect(serializedRecovery).toContain("[REDACTED]");
		expect(validateProviderReadinessDiagnosticsSafety(recovery)).toEqual({ ok: true, issues: [] });

		const unsafeDiagnostics = validateProviderReadinessDiagnosticsSafety({
			authorization: "Bearer abcdefghijk",
			message: "raw prompt body fixture",
			nested: {
				path: privatePathProbe,
				hiddenProviderState: "raw hidden state fixture",
			},
		});
		expect(unsafeDiagnostics.ok).toBe(false);
		if (!unsafeDiagnostics.ok) {
			expect(unsafeDiagnostics.issues.map((issue) => issue.code)).toEqual(
				expect.arrayContaining([
					"unsafe-diagnostic-key",
					"credential-like-value",
					"private-path-hint",
					"prompt-body-hint",
					"hidden-state-hint",
				]),
			);
		}
	});
});
