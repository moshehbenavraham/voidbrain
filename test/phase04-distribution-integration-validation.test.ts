import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAgentSurfacePackageValidationScript } from "../scripts/validate-agent-surface-package";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES, planAgentSurfacePackage, planEcosystemHandoff } from "../src/agent";
import { validateFixtureSafetyEntries } from "../src/agent/fixture-safety";
import { PROVIDER_READINESS_GATE_KINDS, buildProviderReadinessGuidance } from "../src/providers";
import {
	createProviderReadinessRecovery,
	validateProviderReadinessDiagnosticsSafety,
} from "../src/providers/provider-readiness-guidance";
import { OBSIDIAN_INSTALL_COMMAND_ID, type ObsidianInstallIssue } from "../src/types/obsidian-install";
import { RELEASE_VALIDATION_COMMAND_ID, type ReleaseValidationIssue } from "../src/types/release";
import { makeNormalizedVaultPath } from "../src/types/vault";
import {
	createObsidianInstallPlan,
	executeObsidianInstallPlan,
	validateObsidianInstallDiagnosticSafety,
} from "../src/utils/obsidian-install-workflow";
import {
	createReleaseArtifactDiagnostic,
	releaseArtifactPackageFiles,
	validateReleaseArtifacts,
	validateReleaseDiagnosticSafety,
} from "../src/utils/release-artifacts";
import {
	PROVIDER_READINESS_CACHE_PATH,
	PROVIDER_READINESS_REPORT_ID,
	PROVIDER_READINESS_VALIDATION_OUTPUT,
	cloudDisabledReadinessScenario,
	customRemoteReadinessScenario,
	localRuntimeReadinessScenario,
	semanticFallbackReadinessScenario,
	trustedCloudReadinessScenario,
	untrustedCloudReadinessScenario,
} from "./fixtures/providers/provider-readiness-guidance-fixtures";
import {
	OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION,
	type ObsidianInstallFixtureEnvironment,
	createObsidianInstallFixtureEnvironment,
} from "./fixtures/release/obsidian-install-fixtures";
import {
	PHASE04_DISTRIBUTION_CACHE_PATH,
	PHASE04_DISTRIBUTION_FIXED_DATE,
	PHASE04_DISTRIBUTION_REPORT_ID,
	PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
	createPhase04AgentSurfaceContentMap,
	createPhase04DistributionRecoveryRecords,
	createPhase04FixtureSafetyEntries,
	createPhase04SelectedDistributionEvidence,
} from "./fixtures/release/phase04-distribution-integration-fixtures";
import {
	RELEASE_FIXTURE_MIN_APP_VERSION,
	RELEASE_FIXTURE_VERSION,
	type ReleaseFixtureOptions,
	createReleaseFixtureRepo,
} from "./fixtures/release/release-artifacts-fixtures";
import {
	cloudHandoffInput,
	fullVaultSelection,
	localCopyHandoffInput,
	localFilesystemHandoffInput,
	localGitHandoffInput,
	missingHandoffDisclosureState,
	unsafeAuthorizationOutput,
	unsafeHiddenProviderStateOutput,
	unsafePrivatePathOutput,
	unsafePromptBodyOutput,
	unsafePublishingHandoffInput,
	unsafeRawNoteBodyOutput,
	unsafeSecretOutput,
} from "./fixtures/vault/ecosystem-handoff-fixtures";

interface HarnessFixtureFile {
	readonly path: string;
	readonly content: string;
}

interface HarnessPathError extends Error {
	readonly code: "phase04.invalid-fixture-path";
	readonly path: string;
}

const tempRoots: string[] = [];

const createTempRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "voidbrain-phase04-distribution-"));
	tempRoots.push(root);
	return root;
};

const isAllowedHarnessPath = (path: string): boolean =>
	path.startsWith("docs/") || path.startsWith("test/fixtures/") || path === "README.md";

const createHarnessPathError = (path: string): HarnessPathError =>
	Object.assign(new Error(`Unsupported Phase 04 harness fixture path: ${path}`), {
		code: "phase04.invalid-fixture-path" as const,
		path,
	});

const writeHarnessFiles = (repoRoot: string, files: readonly HarnessFixtureFile[]): readonly string[] => {
	const orderedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));

	for (const file of orderedFiles) {
		if (!isAllowedHarnessPath(file.path)) {
			throw createHarnessPathError(file.path);
		}

		const targetPath = join(repoRoot, file.path);
		mkdirSync(dirname(targetPath), { recursive: true });
		writeFileSync(targetPath, file.content);
	}

	return orderedFiles.map((file) => file.path);
};

const releaseIssueCodes = (issues: readonly ReleaseValidationIssue[]): readonly string[] =>
	issues.map((issue) => issue.code).sort((left, right) => left.localeCompare(right));

const installIssueCodes = (issues: readonly ObsidianInstallIssue[]): readonly string[] =>
	issues.map((issue) => issue.code).sort((left, right) => left.localeCompare(right));

const createInstallFixtureEnvironment = (
	releaseOptions: ReleaseFixtureOptions = {},
	vaultOptions: Parameters<typeof createObsidianInstallFixtureEnvironment>[2] = {},
): ObsidianInstallFixtureEnvironment =>
	createObsidianInstallFixtureEnvironment(createTempRoot(), releaseOptions, vaultOptions);

const createInstallPlan = async (
	environment: ObsidianInstallFixtureEnvironment,
	options: {
		readonly dryRun?: boolean;
		readonly allowDowngrade?: boolean;
	} = {},
) => {
	const releaseValidation = await validateReleaseArtifacts({
		repoRoot: environment.repoRoot,
		now: PHASE04_DISTRIBUTION_FIXED_DATE,
	});

	return createObsidianInstallPlan({
		options: {
			repoRoot: environment.repoRoot,
			vaultRoot: environment.vaultRoot,
			clean: false,
			dryRun: options.dryRun ?? true,
			createObsidianFolder: false,
			allowDowngrade: options.allowDowngrade ?? false,
		},
		releaseValidation,
	});
};

const providerGuidanceFor = (scenario: ReturnType<typeof localRuntimeReadinessScenario>) =>
	buildProviderReadinessGuidance({
		settings: scenario.settings,
		providers: scenario.providers,
		semanticCompatibility: scenario.semanticCompatibility,
		cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
		reportId: PROVIDER_READINESS_REPORT_ID,
		validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
	});

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("phase 04 distribution integration harness", () => {
	it("writes synthetic fixture inputs in deterministic order with explicit path failures", () => {
		const repoRoot = createTempRoot();
		const orderedPaths = writeHarnessFiles(repoRoot, [
			{ path: "docs/zeta.md", content: "# Zeta\n" },
			{ path: "README.md", content: "# Readme\n" },
			{ path: "test/fixtures/release/alpha.md", content: "# Alpha\n" },
		]);

		expect(orderedPaths).toEqual(["docs/zeta.md", "README.md", "test/fixtures/release/alpha.md"]);
		try {
			writeHarnessFiles(repoRoot, [{ path: "vault/private.md", content: "# Unsafe\n" }]);
			throw new Error("Expected invalid harness path to fail.");
		} catch (error) {
			expect(error).toMatchObject({
				code: "phase04.invalid-fixture-path",
				path: "vault/private.md",
			});
		}
	});

	it("keeps closeout recovery records bounded and deterministic", () => {
		const records = createPhase04DistributionRecoveryRecords();

		expect(records).toHaveLength(3);
		expect(records.map((record) => record.commandId)).toEqual([
			"voidbrain.validate-release-artifacts",
			"voidbrain.stage-change",
			"voidbrain.recover-session",
		]);
		expect(records[1]).toMatchObject({
			cachePath: PHASE04_DISTRIBUTION_CACHE_PATH,
			reportId: PHASE04_DISTRIBUTION_REPORT_ID,
			stagedChangeId: PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
			validationOutput: ["phase04-distribution:synthetic-fixture"],
		});
		expect(JSON.stringify(records)).not.toContain("authorization");
	});
});

describe("phase 04 release artifact integration", () => {
	it("aligns package metadata, manifest metadata, version map, artifacts, checksums, and validation output", async () => {
		const repoRoot = createTempRoot();
		createReleaseFixtureRepo(repoRoot);

		const result = await validateReleaseArtifacts({
			repoRoot,
			now: PHASE04_DISTRIBUTION_FIXED_DATE,
		});

		expect(result.ok).toBe(true);
		expect(result.commandId).toBe(RELEASE_VALIDATION_COMMAND_ID);
		expect(releaseIssueCodes(result.issues)).toEqual([]);
		expect(result.versions).toMatchObject({
			packageVersion: RELEASE_FIXTURE_VERSION,
			manifestVersion: RELEASE_FIXTURE_VERSION,
			minAppVersion: RELEASE_FIXTURE_MIN_APP_VERSION,
			versionMapMinAppVersion: RELEASE_FIXTURE_MIN_APP_VERSION,
		});
		expect(releaseArtifactPackageFiles()).toEqual(["main.js", "manifest.json", "styles.css", "versions.json"]);
		expect(result.artifacts.map((artifact) => artifact.path)).toEqual([
			"build/voidbrain/main.js",
			"manifest.json",
			"build/voidbrain/styles.css",
			"versions.json",
		]);
		expect(result.artifacts.every((artifact) => artifact.checksum.value.length === 64)).toBe(true);
		expect(result.diagnostic.validationOutput).toMatchObject({
			status: "passed",
			issueCount: 0,
		});
		expect(validateReleaseDiagnosticSafety(result.diagnostic)).toEqual([]);
	});
});

describe("phase 04 obsidian install and update integration", () => {
	it("plans dry-run installs and executes only release artifact copies into the plugin folder", async () => {
		const environment = createInstallFixtureEnvironment();
		const dryRunPlan = await createInstallPlan(environment);
		const executionPlan = await createInstallPlan(environment, { dryRun: false });
		const execution = await executeObsidianInstallPlan(executionPlan);

		expect(dryRunPlan.commandId).toBe(OBSIDIAN_INSTALL_COMMAND_ID);
		expect(dryRunPlan.status).toBe("ready");
		expect(dryRunPlan.operationKind).toBe("fresh-install");
		expect(validateObsidianInstallDiagnosticSafety(dryRunPlan.diagnostic)).toMatchObject({
			ok: true,
			issues: [],
		});
		expect(JSON.stringify(dryRunPlan.diagnostic)).not.toContain(environment.repoRoot);
		expect(JSON.stringify(dryRunPlan.diagnostic)).not.toContain(environment.vaultRoot);
		expect(execution.ok).toBe(true);
		expect(execution.completedActions.filter((action) => action.kind === "copy-artifact")).toHaveLength(4);
		expect(existsSync(join(environment.pluginDir, "manifest.json"))).toBe(true);
		expect(readFileSync(join(environment.pluginDir, "main.js"), "utf8")).toContain("fixture");
		expect(existsSync(join(environment.vaultRoot, "notes.md"))).toBe(false);
	});

	it("captures update rollback intent and blocks downgrade troubleshooting paths by default", async () => {
		const upgradeEnvironment = createInstallFixtureEnvironment(
			{},
			{ installedManifest: { version: OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION } },
		);
		const upgradePlan = await createInstallPlan(upgradeEnvironment);
		const downgradeEnvironment = createInstallFixtureEnvironment({}, { installedManifest: { version: "10.0.0" } });
		const blockedDowngradePlan = await createInstallPlan(downgradeEnvironment);
		const allowedDowngradePlan = await createInstallPlan(downgradeEnvironment, { allowDowngrade: true });

		expect(upgradePlan.status).toBe("ready");
		expect(upgradePlan.operationKind).toBe("upgrade");
		expect(upgradePlan.rollbackIntent.mode).toBe("backup-existing-plugin-artifacts");
		expect(blockedDowngradePlan.status).toBe("blocked");
		expect(blockedDowngradePlan.operationKind).toBe("downgrade");
		expect(installIssueCodes(blockedDowngradePlan.issues)).toContain("install.downgrade-blocked");
		expect(allowedDowngradePlan.status).toBe("ready");
		expect(allowedDowngradePlan.operationKind).toBe("downgrade");
	});
});

describe("phase 04 agent surface package integration", () => {
	it("validates packageable agent surfaces, supported package paths, command status, and fixture-safe examples", () => {
		const repoRoot = createTempRoot();
		const contentMap = createPhase04AgentSurfaceContentMap();

		for (const [path, content] of contentMap.entries()) {
			const absolutePath = join(repoRoot, path);
			mkdirSync(dirname(absolutePath), { recursive: true });
			writeFileSync(absolutePath, content);
		}

		const packagePlan = planAgentSurfacePackage({
			repoRoot,
			outputPath: "build/agent-surfaces/manifest.json",
			now: PHASE04_DISTRIBUTION_FIXED_DATE,
		});
		const scriptResult = runAgentSurfacePackageValidationScript(
			repoRoot,
			["--json"],
			PHASE04_DISTRIBUTION_FIXED_DATE,
		);

		expect(packagePlan.ok).toBe(true);
		expect(scriptResult.exitCode).toBe(0);
		expect(packagePlan.manifest.surfaces.map((surface) => surface.path)).toEqual(
			AGENT_SURFACES.map((surface) => surface.path).sort((left, right) => left.localeCompare(right)),
		);
		expect(packagePlan.manifest.surfaces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "AGENTS.md", targetEcosystem: "codex" }),
				expect.objectContaining({ path: "CLAUDE.md", targetEcosystem: "claude-code" }),
				expect.objectContaining({ path: "GEMINI.md", targetEcosystem: "gemini-cli" }),
				expect.objectContaining({ path: "docs/agent-surfaces-commands.md", targetEcosystem: "human-docs" }),
				expect.objectContaining({ path: "skills/voidbrain/SKILL.md", targetEcosystem: "voidbrain-skill" }),
			]),
		);
		expect(packagePlan.manifest.surfaces.every((surface) => surface.state === "ready")).toBe(true);
		expect(packagePlan.manifest.surfaces.every((surface) => surface.checksum?.value.length === 64)).toBe(true);
		expect(
			packagePlan.manifest.surfaces.every(
				(surface) => surface.commandIds.length === AGENT_COMMAND_CATALOG.length,
			),
		).toBe(true);
		expect(JSON.stringify(packagePlan.diagnostic)).not.toContain("Phase 04 fixture entry");
		expect(JSON.stringify(packagePlan.diagnostic)).not.toContain("fixtures/demo-vault selected-output");
	});
});

describe("phase 04 onboarding and provider readiness integration", () => {
	it("keeps local, custom remote, and trusted cloud readiness gates explicit and deterministic", () => {
		const local = providerGuidanceFor(localRuntimeReadinessScenario());
		const customRemote = providerGuidanceFor(customRemoteReadinessScenario());
		const trustedCloud = providerGuidanceFor(trustedCloudReadinessScenario());

		expect(local).toMatchObject({
			severity: "ready",
			cloudDisclosureRequired: false,
			recovery: {
				commandId: "voidbrain.provider-readiness-guidance",
				cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
				reportId: PROVIDER_READINESS_REPORT_ID,
			},
		});
		expect(customRemote.paths[0]?.pathClass).toBe("custom-remote");
		expect(trustedCloud.paths[0]?.pathClass).toBe("trusted-cloud");
		for (const guidance of [customRemote, trustedCloud]) {
			expect(guidance.cloudDisclosureRequired).toBe(true);
			expect(guidance.paths[0]?.gates.map((gate) => gate.kind)).toEqual([...PROVIDER_READINESS_GATE_KINDS]);
			expect(guidance.paths[0]?.gates.find((gate) => gate.kind === "disclosure")).toMatchObject({
				status: "ready",
				required: true,
			});
		}
		expect(JSON.stringify([local, customRemote, trustedCloud])).not.toContain("runtimeSecret");
	});

	it("blocks untrusted or denied cloud disclosure and exposes lexical fallback for offline semantic readiness", () => {
		const untrustedCloud = providerGuidanceFor(untrustedCloudReadinessScenario());
		const cloudDisabled = providerGuidanceFor(cloudDisabledReadinessScenario());
		const semanticFallback = providerGuidanceFor(semanticFallbackReadinessScenario());

		expect(untrustedCloud.severity).toBe("error");
		expect(untrustedCloud.paths[0]?.blockers.map((blocker) => blocker.code)).toEqual(
			expect.arrayContaining(["untrusted-cloud-blocked", "provider-not-trusted"]),
		);
		expect(cloudDisabled.paths[0]?.blockers.map((blocker) => blocker.code)).toContain("cloud-disabled");
		expect(semanticFallback.paths[0]?.fallback).toMatchObject({
			mode: "lexical",
			status: "warning",
			readinessCode: "provider-offline",
			sourcePathCount: 3,
		});
		expect(semanticFallback.paths[0]?.recovery).toMatchObject({
			fallbackMode: "lexical",
			sourcePathCount: 3,
			validationOutput: [...PROVIDER_READINESS_VALIDATION_OUTPUT],
		});
	});
});

describe("phase 04 ecosystem handoff integration", () => {
	it("allows selected local handoff with citations, source records, recovery records, artifacts, and validation output", () => {
		const selectedOutputs = createPhase04SelectedDistributionEvidence();
		const result = planEcosystemHandoff(
			localGitHandoffInput({
				selectedOutputs,
				target: "docs/phase04-distribution-integration-validation.md",
			}),
		);

		expect(result.ok).toBe(true);
		expect(result.plan.outcome).toBe("allowed");
		expect(result.plan.actions).toEqual([
			expect.objectContaining({
				mode: "git",
				target: "docs/phase04-distribution-integration-validation.md",
				requiresProviderReview: false,
			}),
		]);
		expect(result.plan.selectedOutputs.map((output) => output.path)).toEqual(
			[...selectedOutputs.map((output) => output.path)].sort((left, right) => left.localeCompare(right)),
		);
		expect(result.plan.selectedOutputs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					citations: expect.arrayContaining([
						expect.objectContaining({
							citationId: "citation-demo-project-handoff",
							sourceRecordId: "source-record-demo-project",
						}),
					]),
				}),
				expect.objectContaining({
					reportId: PHASE04_DISTRIBUTION_REPORT_ID,
					stagedChangeId: PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
					validationOutput: ["phase04-distribution:synthetic-fixture"],
				}),
			]),
		);
		expect(result.plan.recovery).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					commandId: "voidbrain.validate-release-artifacts",
					artifactPath: "build/voidbrain/main.js",
					validationOutput: ["release-artifacts:synthetic-fixture"],
				}),
				expect.objectContaining({
					commandId: "voidbrain.stage-change",
					reportId: PHASE04_DISTRIBUTION_REPORT_ID,
					stagedChangeId: PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
				}),
			]),
		);
		expect(JSON.stringify(result.plan.diagnostic)).not.toContain("Synthetic Phase 04 distribution validation");
	});

	it("requires provider review for cloud handoff and blocks full-vault or direct publishing requests", () => {
		const selectedOutputs = createPhase04SelectedDistributionEvidence();
		const reviewRequired = planEcosystemHandoff(cloudHandoffInput({ selectedOutputs }));
		const blockedCloud = planEcosystemHandoff(
			cloudHandoffInput({
				selectedOutputs,
				disclosure: missingHandoffDisclosureState(),
			}),
		);
		const fullVault = planEcosystemHandoff(
			localFilesystemHandoffInput({
				selectedOutputs: [fullVaultSelection()],
			}),
		);
		const directPublishing = planEcosystemHandoff(unsafePublishingHandoffInput({ selectedOutputs }));

		expect(reviewRequired.ok).toBe(true);
		expect(reviewRequired.plan.outcome).toBe("review-required");
		expect(reviewRequired.plan.actions).toEqual([
			expect.objectContaining({
				mode: "cloud-provider",
				requiresProviderReview: true,
			}),
		]);
		expect(blockedCloud.ok).toBe(false);
		expect(blockedCloud.plan.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "handoff.provider-trust-required" }),
				expect.objectContaining({ code: "handoff.provider-auth-required" }),
				expect.objectContaining({ code: "handoff.provider-capability-required" }),
				expect.objectContaining({ code: "handoff.disclosure-required" }),
			]),
		);
		expect(fullVault.plan.issues).toEqual([expect.objectContaining({ code: "handoff.full-vault-selection" })]);
		expect(directPublishing.plan.issues).toEqual([
			expect.objectContaining({ code: "handoff.unsupported-target", mode: "direct-publishing" }),
		]);
	});
});

describe("phase 04 fixture safety and redaction integration", () => {
	it("rejects unsafe fixture entries, release diagnostics, install diagnostics, and provider diagnostics", () => {
		const fixtureSafety = validateFixtureSafetyEntries(createPhase04FixtureSafetyEntries());
		const unsafeReleaseDiagnostic = createReleaseArtifactDiagnostic(
			null,
			[],
			[
				{
					code: "release.invalid-diagnostic-input",
					message: [
						"Synthetic output referenced ",
						["sk", "-phase04releasefixture0000"].join(""),
						" and ",
						["/Users", "/demo", "/Vault/private.md"].join(""),
						".",
					].join(""),
					path: "release-diagnostic",
					remediation: "Use bounded release diagnostics.",
				},
			],
			PHASE04_DISTRIBUTION_FIXED_DATE,
		);
		const unsafeInstall = validateObsidianInstallDiagnosticSafety({
			value: ["sk", "-phase04installfixture0000"].join(""),
			path: ["/Users", "/demo", "/Vault/private.md"].join(""),
		});
		const providerRecovery = createProviderReadinessRecovery({
			reportId: PROVIDER_READINESS_REPORT_ID,
			cachePath: makeNormalizedVaultPath(PROVIDER_READINESS_CACHE_PATH),
			validationOutput: [
				["auth failed ", "Bearer", " phase04providerfixture0000"].join(""),
				["read failed at ", "/Users", "/demo", "/Vault/private.md"].join(""),
			],
		});
		const providerUnsafe = validateProviderReadinessDiagnosticsSafety({
			[["authorization"].join("")]: ["Bearer", " phase04providerfixture0000"].join(""),
			message: ["raw ", "prompt body: synthetic fixture"].join(""),
			nested: {
				path: ["/Users", "/demo", "/Vault/private.md"].join(""),
				hiddenProviderState: ["hidden ", "provider state fixture"].join(""),
			},
		});

		expect(fixtureSafety.ok).toBe(false);
		if (!fixtureSafety.ok) {
			expect(fixtureSafety.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "fixture.secret-like-key" }),
					expect.objectContaining({ code: "fixture.credential-like-value" }),
					expect.objectContaining({ code: "fixture.private-path-hint" }),
				]),
			);
		}
		expect(releaseIssueCodes(validateReleaseDiagnosticSafety(unsafeReleaseDiagnostic))).toEqual([
			"release.private-path-hint",
			"release.unsafe-diagnostic-value",
		]);
		expect(unsafeInstall.ok).toBe(false);
		if (!unsafeInstall.ok) {
			expect(installIssueCodes(unsafeInstall.issues)).toEqual([
				"install.private-path-hint",
				"install.unsafe-diagnostic-value",
			]);
		}
		expect(JSON.stringify(providerRecovery)).not.toContain("phase04providerfixture0000");
		expect(JSON.stringify(providerRecovery)).not.toContain("/Users/demo");
		expect(validateProviderReadinessDiagnosticsSafety(providerRecovery)).toEqual({ ok: true, issues: [] });
		expect(providerUnsafe.ok).toBe(false);
		if (!providerUnsafe.ok) {
			expect(providerUnsafe.issues.map((issue) => issue.code)).toEqual(
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

	it("rejects unsafe handoff outputs for secrets, authorization headers, prompt bodies, raw note bodies, hidden state, private paths, full-vault defaults, and publishing claims", () => {
		const cases = [
			[unsafeSecretOutput(), "handoff.secret-like-value"],
			[unsafeAuthorizationOutput(), "handoff.authorization-header"],
			[unsafePrivatePathOutput(), "handoff.private-path-hint"],
			[unsafePromptBodyOutput(), "handoff.prompt-body"],
			[unsafeHiddenProviderStateOutput(), "handoff.hidden-provider-state"],
			[unsafeRawNoteBodyOutput(), "handoff.raw-note-body"],
		] as const;

		for (const [selectedOutput, expectedCode] of cases) {
			const result = planEcosystemHandoff(localCopyHandoffInput({ selectedOutputs: [selectedOutput] }));

			expect(result.ok).toBe(false);
			expect(result.plan.issues).toEqual([expect.objectContaining({ code: expectedCode })]);
			expect(JSON.stringify(result.plan.diagnostic)).not.toContain("fixturebearertoken1234567890");
			expect(JSON.stringify(result.plan.diagnostic)).not.toContain("/Users/demo");
		}

		const fullVault = planEcosystemHandoff(
			localFilesystemHandoffInput({
				selectedOutputs: [fullVaultSelection()],
			}),
		);
		const directPublishing = planEcosystemHandoff(unsafePublishingHandoffInput());

		expect(fullVault.plan.issues).toEqual([expect.objectContaining({ code: "handoff.full-vault-selection" })]);
		expect(directPublishing.plan.issues).toEqual([
			expect.objectContaining({ code: "handoff.unsupported-target", mode: "direct-publishing" }),
		]);
	});
});
