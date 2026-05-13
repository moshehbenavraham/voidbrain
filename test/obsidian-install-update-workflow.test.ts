import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBSIDIAN_INSTALL_COMMAND_ID, type ObsidianInstallIssue } from "../src/types/obsidian-install";
import {
	createObsidianInstallPlan,
	executeObsidianInstallPlan,
	validateObsidianInstallDiagnosticSafety,
} from "../src/utils/obsidian-install-workflow";
import { validateReleaseArtifacts } from "../src/utils/release-artifacts";
import {
	type FakeVaultOptions,
	OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION,
	type ObsidianInstallFixtureEnvironment,
	createObsidianInstallFixtureEnvironment,
} from "./fixtures/release/obsidian-install-fixtures";
import type { ReleaseFixtureOptions } from "./fixtures/release/release-artifacts-fixtures";

const fixedNow = new Date("2026-05-13T12:00:00.000Z");

const withInstallFixture = async (
	callback: (environment: ObsidianInstallFixtureEnvironment) => Promise<void>,
	releaseOptions: ReleaseFixtureOptions = {},
	vaultOptions: FakeVaultOptions = {},
): Promise<void> => {
	const baseDir = mkdtempSync(join(tmpdir(), "voidbrain-install-"));
	const environment = createObsidianInstallFixtureEnvironment(baseDir, releaseOptions, vaultOptions);
	try {
		await callback(environment);
	} finally {
		environment.cleanup();
	}
};

const createPlan = async (
	environment: ObsidianInstallFixtureEnvironment,
	options: {
		readonly vaultRoot?: string;
		readonly clean?: boolean;
		readonly dryRun?: boolean;
		readonly createObsidianFolder?: boolean;
		readonly allowDowngrade?: boolean;
	} = {},
) => {
	const releaseValidation = await validateReleaseArtifacts({ repoRoot: environment.repoRoot, now: fixedNow });
	return createObsidianInstallPlan({
		options: {
			repoRoot: environment.repoRoot,
			vaultRoot: options.vaultRoot ?? environment.vaultRoot,
			clean: options.clean ?? false,
			dryRun: options.dryRun ?? true,
			createObsidianFolder: options.createObsidianFolder ?? false,
			allowDowngrade: options.allowDowngrade ?? false,
		},
		releaseValidation,
	});
};

const issueCodes = (issues: readonly ObsidianInstallIssue[]): readonly string[] =>
	issues.map((issue) => issue.code).sort((left, right) => left.localeCompare(right));

describe("obsidian install/update workflow planning", () => {
	it("plans a bounded fresh install with deterministic copy order and safe diagnostics", async () => {
		await withInstallFixture(async (environment) => {
			const plan = await createPlan(environment);
			const serializedDiagnostic = JSON.stringify(plan.diagnostic);

			expect(plan.commandId).toBe(OBSIDIAN_INSTALL_COMMAND_ID);
			expect(plan.status).toBe("ready");
			expect(plan.operationKind).toBe("fresh-install");
			expect(plan.installedVersion).toBeNull();
			expect(plan.incomingVersion).toBe("9.9.9");
			expect(plan.rollbackIntent.mode).toBe("none");
			expect(plan.artifacts.map((artifact) => artifact.sourcePath)).toEqual([
				"build/voidbrain/main.js",
				"manifest.json",
				"build/voidbrain/styles.css",
				"versions.json",
			]);
			expect(
				plan.diagnostic.actions
					.filter((action) => action.kind === "copy-artifact")
					.map((action) => action.targetPath),
			).toEqual([
				".obsidian/plugins/voidbrain/main.js",
				".obsidian/plugins/voidbrain/manifest.json",
				".obsidian/plugins/voidbrain/styles.css",
				".obsidian/plugins/voidbrain/versions.json",
			]);
			expect(serializedDiagnostic).not.toContain(environment.vaultRoot);
			expect(serializedDiagnostic).not.toContain(environment.repoRoot);
			expect(validateObsidianInstallDiagnosticSafety(plan.diagnostic)).toMatchObject({ ok: true, issues: [] });
		});
	});

	it("classifies upgrade and reinstall states from the installed plugin manifest", async () => {
		await withInstallFixture(
			async (environment) => {
				const plan = await createPlan(environment);

				expect(plan.status).toBe("ready");
				expect(plan.operationKind).toBe("upgrade");
				expect(plan.installedVersion).toBe(OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION);
				expect(plan.rollbackIntent.mode).toBe("backup-existing-plugin-artifacts");
			},
			{},
			{ installedManifest: { version: OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION } },
		);

		await withInstallFixture(
			async (environment) => {
				const plan = await createPlan(environment);

				expect(plan.status).toBe("ready");
				expect(plan.operationKind).toBe("reinstall");
				expect(plan.installedVersion).toBe("9.9.9");
				expect(plan.rollbackIntent.mode).toBe("backup-existing-plugin-artifacts");
			},
			{},
			{ installedManifest: { version: "9.9.9" } },
		);
	});

	it("executes a safe fresh install by copying only release artifacts into the plugin folder", async () => {
		await withInstallFixture(async (environment) => {
			const plan = await createPlan(environment);
			const execution = await executeObsidianInstallPlan(plan);

			expect(execution.ok).toBe(true);
			expect(execution.issues).toEqual([]);
			expect(execution.completedActions.filter((action) => action.kind === "copy-artifact")).toHaveLength(4);
			expect(existsSync(join(environment.pluginDir, "manifest.json"))).toBe(true);
			expect(readFileSync(join(environment.pluginDir, "main.js"), "utf8")).toContain("fixture");
			expect(existsSync(join(environment.vaultRoot, "notes.md"))).toBe(false);
		});
	});

	it("fails closed for invalid target paths and malformed installed manifests", async () => {
		await withInstallFixture(async (environment) => {
			const plan = await createPlan(environment, {
				vaultRoot: join(environment.vaultRoot, ".obsidian", "plugins", "voidbrain"),
			});

			expect(plan.status).toBe("blocked");
			expect(issueCodes(plan.issues)).toContain("install.invalid-target-path");
		});

		await withInstallFixture(
			async (environment) => {
				const plan = await createPlan(environment);

				expect(plan.status).toBe("blocked");
				expect(plan.operationKind).toBe("invalid-existing-install");
				expect(issueCodes(plan.issues)).toContain("install.invalid-installed-manifest");
			},
			{},
			{ installedManifest: "{ invalid json" },
		);
	});

	it("blocks downgrade risk by default and allows it only with explicit review", async () => {
		await withInstallFixture(
			async (environment) => {
				const blockedPlan = await createPlan(environment);
				const allowedPlan = await createPlan(environment, { allowDowngrade: true });

				expect(blockedPlan.status).toBe("blocked");
				expect(blockedPlan.operationKind).toBe("downgrade");
				expect(issueCodes(blockedPlan.issues)).toContain("install.downgrade-blocked");
				expect(allowedPlan.status).toBe("ready");
				expect(allowedPlan.operationKind).toBe("downgrade");
			},
			{},
			{ installedManifest: { version: "10.0.0" } },
		);
	});

	it("carries release validation failures into blocked install/update plans", async () => {
		await withInstallFixture(
			async (environment) => {
				const plan = await createPlan(environment);

				expect(plan.status).toBe("blocked");
				expect(plan.releaseValidation.ok).toBe(false);
				expect(issueCodes(plan.issues)).toEqual(
					expect.arrayContaining(["install.missing-artifact", "install.release-validation-failed"]),
				);
				expect(plan.diagnostic.releaseValidation.status).toBe("failed");
			},
			{ omitArtifacts: ["main.js"] },
		);
	});

	it("fails diagnostic safety checks for private paths and credential-like values", () => {
		const privatePathProbe = ["", "home", "fixture", "vault", "note.md"].join("/");
		const secretProbe = ["sk", "obsidianInstallFixture123456"].join("-");
		const result = validateObsidianInstallDiagnosticSafety({
			commandId: OBSIDIAN_INSTALL_COMMAND_ID,
			targetPluginPath: privatePathProbe,
			value: secretProbe,
		});

		expect(result.ok).toBe(false);
		expect(issueCodes(result.issues)).toEqual(["install.private-path-hint", "install.unsafe-diagnostic-value"]);
	});
});
