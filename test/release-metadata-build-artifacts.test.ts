import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReleaseArtifactValidationScript } from "../scripts/validate-release-artifacts";
import {
	RELEASE_ARTIFACT_NAMES,
	RELEASE_VALIDATION_COMMAND_ID,
	type ReleaseValidationIssue,
} from "../src/types/release";
import {
	createReleaseArtifactDiagnostic,
	releaseArtifactPackageFiles,
	validateReleaseArtifacts,
	validateReleaseDiagnosticSafety,
} from "../src/utils/release-artifacts";
import {
	RELEASE_FIXTURE_MIN_APP_VERSION,
	RELEASE_FIXTURE_VERSION,
	createReleaseFixtureRepo,
	removeReleaseFixtureArtifact,
} from "./fixtures/release/release-artifacts-fixtures";

const fixedNow = new Date("2026-05-13T12:00:00.000Z");

const withTempRepo = async (callback: (repoRoot: string) => Promise<void>): Promise<void> => {
	const repoRoot = mkdtempSync(join(tmpdir(), "voidbrain-release-"));
	try {
		await callback(repoRoot);
	} finally {
		rmSync(repoRoot, { recursive: true, force: true });
	}
};

const issueCodes = (issues: readonly ReleaseValidationIssue[]): readonly string[] =>
	issues.map((issue) => issue.code).sort((left, right) => left.localeCompare(right));

describe("release metadata and build artifact validation", () => {
	it("validates aligned release metadata, declared files, artifacts, and checksums", async () => {
		await withTempRepo(async (repoRoot) => {
			createReleaseFixtureRepo(repoRoot);

			const result = await validateReleaseArtifacts({ repoRoot, now: fixedNow });
			const serializedDiagnostic = JSON.stringify(result.diagnostic);

			expect(result.ok).toBe(true);
			expect(result.issues).toEqual([]);
			expect(result.commandId).toBe(RELEASE_VALIDATION_COMMAND_ID);
			expect(result.versions).toMatchObject({
				packageName: "voidbrain",
				packageVersion: RELEASE_FIXTURE_VERSION,
				manifestId: "voidbrain",
				manifestVersion: RELEASE_FIXTURE_VERSION,
				minAppVersion: RELEASE_FIXTURE_MIN_APP_VERSION,
				versionMapMinAppVersion: RELEASE_FIXTURE_MIN_APP_VERSION,
			});
			expect(releaseArtifactPackageFiles()).toEqual(RELEASE_ARTIFACT_NAMES);
			expect(result.artifacts.map((artifact) => artifact.path)).toEqual([
				"build/voidbrain/main.js",
				"manifest.json",
				"build/voidbrain/styles.css",
				"versions.json",
			]);
			for (const artifact of result.artifacts) {
				expect(artifact.sizeBytes).toBeGreaterThan(0);
				expect(artifact.checksum).toMatchObject({ algorithm: "sha256" });
				expect(artifact.checksum.value).toMatch(/^[a-f0-9]{64}$/u);
			}
			expect(serializedDiagnostic).not.toContain("module.exports");
			expect(serializedDiagnostic).not.toContain(".voidbrain-fixture");
		});
	});

	it("runs the CLI adapter against a synthetic temp repository", async () => {
		await withTempRepo(async (repoRoot) => {
			createReleaseFixtureRepo(repoRoot);

			const { exitCode, result } = await runReleaseArtifactValidationScript(repoRoot, fixedNow);

			expect(exitCode).toBe(0);
			expect(result.ok).toBe(true);
			expect(result.diagnostic).toMatchObject({
				commandId: RELEASE_VALIDATION_COMMAND_ID,
				generatedAt: fixedNow.toISOString(),
				validationOutput: {
					status: "passed",
					issueCount: 0,
				},
			});
		});
	});

	it("fails closed for version drift, minimum app drift, and package file drift", async () => {
		await withTempRepo(async (repoRoot) => {
			createReleaseFixtureRepo(repoRoot, {
				manifestVersion: "9.9.8",
				versionMap: {
					"9.9.8": "1.4.0",
				},
				packageFiles: [...RELEASE_ARTIFACT_NAMES, "extra.js"],
			});

			const result = await validateReleaseArtifacts({ repoRoot, now: fixedNow });

			expect(result.ok).toBe(false);
			expect(issueCodes(result.issues)).toEqual(
				expect.arrayContaining([
					"release.min-app-version-drift",
					"release.package-files-drift",
					"release.version-drift",
				]),
			);
		});
	});

	it("fails closed for missing version map entries and missing artifacts", async () => {
		await withTempRepo(async (repoRoot) => {
			createReleaseFixtureRepo(repoRoot, {
				versionMap: {},
			});
			removeReleaseFixtureArtifact(repoRoot, "main.js");

			const result = await validateReleaseArtifacts({ repoRoot, now: fixedNow });

			expect(result.ok).toBe(false);
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "release.version-map-entry-missing",
						path: "versions.json",
					}),
					expect.objectContaining({
						code: "release.missing-artifact",
						path: "build/voidbrain/main.js",
					}),
				]),
			);
		});
	});

	it("fails closed for undeclared build files and unsafe diagnostic values", async () => {
		await withTempRepo(async (repoRoot) => {
			createReleaseFixtureRepo(repoRoot, {
				extraBuildFiles: {
					"unexpected.js": "console.log('synthetic build file');\n",
				},
			});

			const result = await validateReleaseArtifacts({ repoRoot, now: fixedNow });

			expect(result.ok).toBe(false);
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "release.undeclared-release-file",
						path: "build/voidbrain/unexpected.js",
					}),
				]),
			);
		});

		const unsafeDiagnostic = createReleaseArtifactDiagnostic(
			null,
			[],
			[
				{
					code: "release.invalid-diagnostic-input",
					message: "Synthetic validation output referenced /home/fixture/private.md and sk-1234567890123456.",
					path: "release-diagnostic",
					remediation: "Use bounded release diagnostics.",
				},
			],
			fixedNow,
		);

		expect(issueCodes(validateReleaseDiagnosticSafety(unsafeDiagnostic))).toEqual([
			"release.private-path-hint",
			"release.unsafe-diagnostic-value",
		]);
	});
});
