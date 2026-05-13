import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runRepositoryHealthScript } from "../scripts/repo-health";

const withTempRepo = (callback: (repoRoot: string) => void): void => {
	const repoRoot = mkdtempSync(join(tmpdir(), "voidbrain-health-"));
	try {
		callback(repoRoot);
	} finally {
		rmSync(repoRoot, { recursive: true, force: true });
	}
};

const writeBaselineRepo = (repoRoot: string): void => {
	mkdirSync(join(repoRoot, ".spec_system"), { recursive: true });
	mkdirSync(join(repoRoot, ".github", "workflows"), { recursive: true });
	mkdirSync(join(repoRoot, "docs"), { recursive: true });

	writeFileSync(
		join(repoRoot, ".spec_system", "state.json"),
		JSON.stringify(
			{
				current_phase: 2,
				current_session: null,
				phases: {
					"2": { status: "complete" },
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(repoRoot, "package.json"),
		JSON.stringify(
			{
				scripts: {
					build: "bun run build",
					validate: "bun run validate",
					health: "bun scripts/repo-health.ts",
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(repoRoot, "docs", "deployment.md"),
		"# Deployment Guide\n\nVoidbrain does not have a hosted deployment target in the current phase.\nThe build step is the main local release gate for plugin artifacts.\n",
	);
	writeFileSync(
		join(repoRoot, "docs", "environments.md"),
		"# Environments\n\nThere is no hosted backend or separate production service for the MVP.\nDistribution is centered on the Obsidian plugin and local vault workflows.\n",
	);
	writeFileSync(join(repoRoot, ".github", "workflows", "health.yml"), "name: Repository Health\n");
	writeFileSync(join(repoRoot, ".github", "workflows", "quality.yml"), "name: Code Quality\n");
	writeFileSync(join(repoRoot, ".github", "workflows", "test.yml"), "name: Build and Test\n");
	writeFileSync(join(repoRoot, ".github", "workflows", "security.yml"), "name: Security\n");
};

describe("repository health script", () => {
	it("passes when the repo documents the current local-first infra posture", () => {
		withTempRepo((repoRoot) => {
			writeBaselineRepo(repoRoot);

			const result = runRepositoryHealthScript(repoRoot);

			expect(result.checks.every((check) => check.passed)).toBe(true);
			expect(result.checks.map((check) => check.id)).toEqual([
				"spec-state",
				"package-scripts",
				"deployment-guide",
				"environment-guide",
				"health-workflow",
				"ci-workflows",
			]);
		});
	});

	it("fails closed when the health workflow or spec state drifts", () => {
		withTempRepo((repoRoot) => {
			writeBaselineRepo(repoRoot);
			writeFileSync(
				join(repoRoot, ".spec_system", "state.json"),
				JSON.stringify(
					{
						current_phase: 2,
						current_session: "phase02-session07-agentic-maintenance-integration-validation",
						phases: {
							"2": { status: "in-progress" },
						},
					},
					null,
					2,
				),
			);
			rmSync(join(repoRoot, ".github", "workflows", "health.yml"));

			const result = runRepositoryHealthScript(repoRoot);

			expect(result.checks).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ id: "spec-state", passed: false }),
					expect.objectContaining({ id: "health-workflow", passed: false }),
				]),
			);
		});
	});
});
