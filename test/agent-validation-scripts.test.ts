import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runFixtureSafetyScript } from "../scripts/check-fixture-safety";
import { runAgentSurfaceValidationScript } from "../scripts/validate-agent-surfaces";
import { formatAgentValidationIssue } from "../src/agent/agent-validation-reporting";
import { AGENT_SURFACES } from "../src/agent/command-catalog";
import {
	createPhase03FixtureSafetyEntries,
	createPhase03SurfaceFixtureSet,
} from "./fixtures/providers/phase03-provider-integration-fixtures";
import {
	createPhase02FixtureSafetyEntries,
	createPhase02SurfaceFixtureSet,
} from "./fixtures/vault/phase02-integration-fixtures";

const withTempRepo = (callback: (repoRoot: string) => void): void => {
	const repoRoot = mkdtempSync(join(tmpdir(), "voidbrain-validation-"));
	try {
		callback(repoRoot);
	} finally {
		rmSync(repoRoot, { recursive: true, force: true });
	}
};

describe("agent surface validation script adapter", () => {
	it("fails closed for missing required surfaces", () => {
		withTempRepo((repoRoot) => {
			const result = runAgentSurfaceValidationScript(repoRoot);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "surface.missing-required-surface",
						path: "AGENTS.md",
					}),
				]),
			);
			expect(result.inputs).toEqual([]);
		});
	});

	it("fails closed for unreadable required surfaces", () => {
		withTempRepo((repoRoot) => {
			mkdirSync(join(repoRoot, "AGENTS.md"), { recursive: true });
			const result = runAgentSurfaceValidationScript(repoRoot);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "surface.unreadable-required-surface",
						path: "AGENTS.md",
					}),
				]),
			);
		});
	});

	it("accepts synchronized Phase 02 closeout surfaces with implemented statuses", () => {
		withTempRepo((repoRoot) => {
			const { completeMarkdown } = createPhase02SurfaceFixtureSet();

			for (const surface of AGENT_SURFACES) {
				const surfacePath = join(repoRoot, surface.path);
				mkdirSync(dirname(surfacePath), { recursive: true });
				writeFileSync(surfacePath, completeMarkdown);
			}

			const result = runAgentSurfaceValidationScript(repoRoot);

			expect(result.issues).toEqual([]);
			expect(
				result.inputs.map((input) => input.surface.path).sort((left, right) => left.localeCompare(right)),
			).toEqual(AGENT_SURFACES.map((surface) => surface.path).sort((left, right) => left.localeCompare(right)));
		});
	});

	it("accepts synchronized Phase 03 provider closeout surfaces with disclosure and recovery language", () => {
		withTempRepo((repoRoot) => {
			const { completeMarkdown, requiredSurfacePhrases } = createPhase03SurfaceFixtureSet();

			for (const surface of AGENT_SURFACES) {
				const surfacePath = join(repoRoot, surface.path);
				mkdirSync(dirname(surfacePath), { recursive: true });
				writeFileSync(surfacePath, completeMarkdown);
			}

			const result = runAgentSurfaceValidationScript(repoRoot);

			expect(result.issues).toEqual([]);
			for (const phrase of requiredSurfacePhrases) {
				expect(completeMarkdown.toLowerCase()).toContain(phrase.toLowerCase());
			}
		});
	});

	it("fails closed for Phase 03 closeout command status drift", () => {
		withTempRepo((repoRoot) => {
			const { staleStatusMarkdown } = createPhase03SurfaceFixtureSet();

			for (const surface of AGENT_SURFACES) {
				const surfacePath = join(repoRoot, surface.path);
				mkdirSync(dirname(surfacePath), { recursive: true });
				writeFileSync(surfacePath, staleStatusMarkdown);
			}

			const result = runAgentSurfaceValidationScript(repoRoot);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "surface.stale-command-status",
						commandId: "voidbrain.validate-agent-surfaces",
					}),
				]),
			);
		});
	});
});

describe("fixture safety script adapter", () => {
	it("rejects unsupported explicit candidates in deterministic order", () => {
		withTempRepo((repoRoot) => {
			mkdirSync(join(repoRoot, "docs"), { recursive: true });
			writeFileSync(join(repoRoot, "docs", "good.md"), "# Fixture\nlocal-first staged changes\n");

			const result = runFixtureSafetyScript(repoRoot, [
				"vault/private.md",
				"docs/good.md",
				"../outside.md",
				"docs/image.png",
			]);
			const formatted = result.issues.map(formatAgentValidationIssue);

			expect(result.entries.map((entry) => entry.path)).toEqual(["docs/good.md"]);
			expect(result.issues).toEqual([
				expect.objectContaining({ code: "fixture.unsupported-scan-path", path: "../outside.md" }),
				expect.objectContaining({ code: "fixture.unsupported-scan-path", path: "docs/image.png" }),
				expect.objectContaining({ code: "fixture.unsupported-scan-path", path: "vault/private.md" }),
			]);
			expect(formatted).toEqual([...formatted].sort((left, right) => left.localeCompare(right)));
		});
	});

	it("reports unreadable scan candidates", () => {
		withTempRepo((repoRoot) => {
			mkdirSync(join(repoRoot, "docs", "unreadable.md"), { recursive: true });
			const result = runFixtureSafetyScript(repoRoot, ["docs/unreadable.md"]);

			expect(result.issues).toEqual([
				expect.objectContaining({
					code: "fixture.unreadable-scan-path",
					path: "docs/unreadable.md",
				}),
			]);
		});
	});

	it("maps Phase 02 closeout fixture safety failures to deterministic issue codes", () => {
		withTempRepo((repoRoot) => {
			const entries = createPhase02FixtureSafetyEntries();

			for (const entry of entries) {
				const entryPath = join(repoRoot, entry.path);
				mkdirSync(dirname(entryPath), { recursive: true });
				writeFileSync(entryPath, entry.content);
			}

			const result = runFixtureSafetyScript(
				repoRoot,
				entries.map((entry) => entry.path),
			);

			expect(result.entries.map((entry) => entry.path)).toEqual(entries.map((entry) => entry.path));
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "fixture.secret-like-key",
						path: "docs/phase02-unsafe-closeout.md",
					}),
					expect.objectContaining({
						code: "fixture.credential-like-value",
						path: "docs/phase02-unsafe-closeout.md",
					}),
					expect.objectContaining({
						code: "fixture.private-path-hint",
						path: "docs/phase02-unsafe-closeout.md",
					}),
				]),
			);
		});
	});

	it("maps Phase 03 provider closeout fixture safety failures to deterministic issue codes", () => {
		withTempRepo((repoRoot) => {
			const entries = createPhase03FixtureSafetyEntries();

			for (const entry of entries) {
				const entryPath = join(repoRoot, entry.path);
				mkdirSync(dirname(entryPath), { recursive: true });
				writeFileSync(entryPath, entry.content);
			}

			const result = runFixtureSafetyScript(
				repoRoot,
				entries.map((entry) => entry.path),
			);

			expect(result.entries.map((entry) => entry.path)).toEqual(entries.map((entry) => entry.path));
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "fixture.secret-like-key",
						path: "docs/phase03-unsafe-provider-closeout.md",
					}),
					expect.objectContaining({
						code: "fixture.credential-like-value",
						path: "docs/phase03-unsafe-provider-closeout.md",
					}),
					expect.objectContaining({
						code: "fixture.private-path-hint",
						path: "docs/phase03-unsafe-provider-closeout.md",
					}),
				]),
			);
		});
	});

	it("accepts provider readiness docs with fixture-safe disclosure language", () => {
		const providerReadinessDocs = [
			"README.md",
			"docs/onboarding.md",
			"docs/provider-readiness-guide.md",
			"docs/provider-setup.md",
			"docs/provider-troubleshooting-recovery.md",
		];
		const result = runFixtureSafetyScript(process.cwd(), providerReadinessDocs);
		const combinedMarkdown = providerReadinessDocs
			.map((path) => readFileSync(path, "utf8"))
			.join("\n")
			.toLowerCase();

		expect(result.issues).toEqual([]);
		expect(combinedMarkdown).toContain("provider review, trust, auth, capability, and disclosure");
		expect(combinedMarkdown).toContain("untrusted cloud providers are blocked for private vault content");
		expect(combinedMarkdown).toContain("does not silently fall back from local providers to cloud providers");
		expect(combinedMarkdown).toContain("fixtures/demo-vault");
	});
});
