import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAgentSurfacePackageValidationScript } from "../scripts/validate-agent-surface-package";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES, planAgentSurfacePackage } from "../src/agent";
import {
	AGENT_SURFACE_PACKAGE_FIXED_DATE,
	completePackageSurfaceMarkdown,
	packageSurfaceWithStaleStatus,
	packageSurfaceWithUnknownCommand,
	packageSurfaceWithUnsafeExample,
	writeAgentSurfacePackageFixtureRepository,
} from "./fixtures/vault/agent-surface-package-fixtures";

const tempRoots: string[] = [];

const createFixtureRepo = async (): Promise<string> => {
	const repoRoot = await mkdtemp(join(tmpdir(), "voidbrain-agent-surface-package-"));
	tempRoots.push(repoRoot);
	await writeAgentSurfacePackageFixtureRepository(repoRoot);
	return repoRoot;
};

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("agent surface package planning", () => {
	it("creates ready manifests with deterministic ordering, ecosystems, checksums, and bounded diagnostics", async () => {
		const repoRoot = await createFixtureRepo();
		const first = planAgentSurfacePackage({
			repoRoot,
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});
		const second = planAgentSurfacePackage({
			repoRoot,
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});

		expect(first.ok).toBe(true);
		expect(second).toEqual(first);
		expect(first.manifest.generatedAt).toBe("2026-05-13T00:00:00.000Z");
		expect(first.manifest.surfaces.map((surface) => surface.path)).toEqual(
			[...AGENT_SURFACES.map((surface) => surface.path)].sort((left, right) => left.localeCompare(right)),
		);
		expect(first.manifest.surfaces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "AGENTS.md", targetEcosystem: "codex" }),
				expect.objectContaining({ path: "CLAUDE.md", targetEcosystem: "claude-code" }),
				expect.objectContaining({ path: "GEMINI.md", targetEcosystem: "gemini-cli" }),
				expect.objectContaining({ path: "docs/agent-surfaces-commands.md", targetEcosystem: "human-docs" }),
				expect.objectContaining({ path: "skills/voidbrain/SKILL.md", targetEcosystem: "voidbrain-skill" }),
			]),
		);
		expect(first.manifest.surfaces.every((surface) => surface.state === "ready")).toBe(true);
		expect(first.manifest.surfaces.every((surface) => surface.checksum?.value.length === 64)).toBe(true);
		expect(
			first.manifest.surfaces.every((surface) => surface.commandIds.length === AGENT_COMMAND_CATALOG.length),
		).toBe(true);
		expect(first.manifest.commandCatalog.checksum.value).toHaveLength(64);
		expect(JSON.stringify(first.diagnostic)).not.toContain("Package fixture entry");
		expect(JSON.stringify(first.diagnostic)).not.toContain("local-first staged changes");
	});

	it("supports selected surfaces and CLI script diagnostics without writing package output", async () => {
		const repoRoot = await createFixtureRepo();
		const selected = planAgentSurfacePackage({
			repoRoot,
			surfacePaths: ["GEMINI.md", "AGENTS.md"],
			outputPath: "build/agent-surfaces/manifest.json",
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});
		const scriptResult = runAgentSurfacePackageValidationScript(
			repoRoot,
			["--json"],
			AGENT_SURFACE_PACKAGE_FIXED_DATE,
		);

		expect(selected.ok).toBe(true);
		expect(selected.manifest.surfaces.map((surface) => surface.path)).toEqual(["AGENTS.md", "GEMINI.md"]);
		expect(scriptResult.exitCode).toBe(0);
		expect(scriptResult.result.ok).toBe(true);
		expect(scriptResult.result.diagnostic.surfaceCount).toBe(AGENT_SURFACES.length);
	});
});

describe("agent surface package failure states", () => {
	it("detects unknown command IDs, stale statuses, and missing safety phrases as stale catalog issues", async () => {
		const repoRoot = await createFixtureRepo();
		await writeAgentSurfacePackageFixtureRepository(repoRoot, {
			"AGENTS.md": packageSurfaceWithUnknownCommand(),
			"CLAUDE.md": packageSurfaceWithStaleStatus(),
			"GEMINI.md": completePackageSurfaceMarkdown().replace(" dry-run", ""),
		});

		const result = planAgentSurfacePackage({
			repoRoot,
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});

		expect(result.ok).toBe(false);
		expect(result.diagnostic.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "package.stale-catalog",
					sourceCode: "surface.unknown-command-id",
					path: "AGENTS.md",
				}),
				expect.objectContaining({
					code: "package.stale-catalog",
					sourceCode: "surface.stale-command-status",
					path: "CLAUDE.md",
				}),
				expect.objectContaining({
					code: "package.stale-catalog",
					sourceCode: "surface.missing-safety-phrase",
					path: "GEMINI.md",
				}),
			]),
		);
		expect(result.manifest.surfaces.find((surface) => surface.path === "AGENTS.md")?.state).toBe("stale-catalog");
	});

	it("detects missing surfaces, unsupported paths, unsafe content, and unsafe output paths", async () => {
		const repoRoot = await createFixtureRepo();
		await writeAgentSurfacePackageFixtureRepository(repoRoot, {
			"CLAUDE.md": packageSurfaceWithUnsafeExample(),
		});
		await rm(join(repoRoot, "AGENTS.md"));

		const missingAndUnsafe = planAgentSurfacePackage({
			repoRoot,
			outputPath: "vault/package-manifest.json",
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});
		const unsupported = planAgentSurfacePackage({
			repoRoot,
			surfacePaths: ["../outside.md"],
			now: AGENT_SURFACE_PACKAGE_FIXED_DATE,
		});
		const diagnosticText = JSON.stringify(missingAndUnsafe.diagnostic);

		expect(missingAndUnsafe.ok).toBe(false);
		expect(missingAndUnsafe.diagnostic.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "package.missing-surface", path: "AGENTS.md" }),
				expect.objectContaining({ code: "package.unsupported-output-path" }),
				expect.objectContaining({ code: "package.unsafe-content", path: "CLAUDE.md" }),
			]),
		);
		expect(missingAndUnsafe.manifest.surfaces.find((surface) => surface.path === "AGENTS.md")?.state).toBe(
			"missing-surface",
		);
		expect(missingAndUnsafe.manifest.surfaces.find((surface) => surface.path === "CLAUDE.md")?.state).toBe(
			"unsafe-content",
		);
		expect(unsupported.ok).toBe(false);
		expect(unsupported.diagnostic.issues).toEqual([
			expect.objectContaining({ code: "package.unsupported-path", path: "../outside.md" }),
		]);
		expect(diagnosticText).not.toContain("1234567890abcdef12");
		expect(diagnosticText).not.toContain("/Users/demo");
	});
});
