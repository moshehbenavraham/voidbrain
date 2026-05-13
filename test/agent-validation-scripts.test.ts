import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runFixtureSafetyScript } from "../scripts/check-fixture-safety";
import { runAgentSurfaceValidationScript } from "../scripts/validate-agent-surfaces";
import { formatAgentValidationIssue } from "../src/agent/agent-validation-reporting";

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
});
