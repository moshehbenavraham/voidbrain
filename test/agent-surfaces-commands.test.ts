import { describe, expect, it } from "vitest";
import { formatAgentValidationIssue } from "../src/agent/agent-validation-reporting";
import {
	AGENT_COMMAND_CATALOG,
	AGENT_SURFACES,
	getAgentCommandById,
	getAgentCommandsByStatus,
	getSupportedAgentSurfaces,
	sortAgentCommandsDeterministically,
	validateAgentCommandCatalog,
} from "../src/agent/command-catalog";
import { scanFixtureSafetyText } from "../src/agent/fixture-safety";
import { createFrameworkUpdatePreviewPlanner, planFrameworkUpdatePreview } from "../src/agent/framework-update-preview";
import { validateRepositoryScanPath } from "../src/agent/repository-scan-boundary";
import {
	extractAgentCommandIdsFromMarkdown,
	extractAgentCommandReferencesFromMarkdown,
	findMissingRequiredSafetyPhrases,
	validateAgentSurfaceMarkdown,
} from "../src/agent/surface-validation";
import { AGENT_COMMAND_IDS, agentCommandStatusLabel } from "../src/types/agent-commands";
import {
	completeSurfaceMarkdownForCommands,
	fixtureSurface,
	surfaceMarkdownWithStaleStatus,
	unsafeFixtureExampleText,
} from "./fixtures/vault/agent-surface-validation-fixtures";

const firstSurface = () => {
	const surface = AGENT_SURFACES[0];
	if (surface === undefined) {
		throw new Error("Expected at least one agent surface");
	}

	return surface;
};

const completeSurfaceMarkdown = (): string =>
	[
		...AGENT_COMMAND_CATALOG.map((command) => `- \`${command.id}\``),
		"local-first staged changes provider secrets synthetic fixtures citations dry-run recovery",
	].join("\n");

describe("agent command catalog", () => {
	it("keeps canonical command IDs unique and deterministic", () => {
		expect(validateAgentCommandCatalog(AGENT_COMMAND_CATALOG)).toMatchObject({ ok: true });
		expect(
			sortAgentCommandsDeterministically([...AGENT_COMMAND_CATALOG].reverse()).map((command) => command.id),
		).toEqual(AGENT_COMMAND_IDS);
		expect(new Set(AGENT_COMMAND_CATALOG.map((command) => command.id)).size).toBe(AGENT_COMMAND_CATALOG.length);
	});

	it("exposes status labels, status queries, and supported surface mappings", () => {
		expect(agentCommandStatusLabel("planned")).toBe("Planned");
		expect(getAgentCommandsByStatus("planned").map((command) => command.id)).toEqual([]);
		expect(getAgentCommandsByStatus("implemented").map((command) => command.id)).toEqual([
			"voidbrain.ingest-source",
			"voidbrain.chat-with-vault",
			"voidbrain.health-check",
			"voidbrain.stage-change",
			"voidbrain.recover-session",
			"voidbrain.validate-agent-surfaces",
		]);
		expect(getAgentCommandsByStatus("scaffolded").map((command) => command.id)).toEqual([
			"voidbrain.preview-framework-update",
		]);
		expect(getAgentCommandById("voidbrain.chat-with-vault")).toMatchObject({
			privacyLevel: "explicit-provider-review",
		});
		expect(getAgentCommandById("voidbrain.unknown")).toBeUndefined();
		expect(getSupportedAgentSurfaces("voidbrain.ingest-source").map((surface) => surface.path)).toContain(
			"AGENTS.md",
		);
	});
});

describe("agent surface validation", () => {
	it("accepts a complete markdown surface", () => {
		const report = validateAgentSurfaceMarkdown({
			surface: firstSurface(),
			markdown: completeSurfaceMarkdown(),
			commands: AGENT_COMMAND_CATALOG,
		});

		expect(report.issues).toEqual([]);
		expect(report.commandIds).toEqual([...AGENT_COMMAND_IDS].sort((left, right) => left.localeCompare(right)));
	});

	it("detects missing command IDs, stale command IDs, and missing safety phrases", () => {
		const missingCommandMarkdown = completeSurfaceMarkdown().replace("voidbrain.ingest-source", "");
		expect(
			validateAgentSurfaceMarkdown({
				surface: firstSurface(),
				markdown: missingCommandMarkdown,
				commands: AGENT_COMMAND_CATALOG,
			}).issues,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "surface.missing-command-id",
					commandId: "voidbrain.ingest-source",
				}),
			]),
		);

		expect(
			validateAgentSurfaceMarkdown({
				surface: firstSurface(),
				markdown: `${completeSurfaceMarkdown()}\n- \`voidbrain.unknown-command\``,
				commands: AGENT_COMMAND_CATALOG,
			}).issues,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "surface.unknown-command-id",
					commandId: "voidbrain.unknown-command",
				}),
			]),
		);

		expect(findMissingRequiredSafetyPhrases("local-first recovery", ["local-first", "dry-run"])).toEqual([
			"dry-run",
		]);
	});

	it("extracts command IDs with line and heading context", () => {
		expect(
			extractAgentCommandIdsFromMarkdown(
				"`voidbrain.stage-change`\n`voidbrain.chat-with-vault`\n`voidbrain.stage-change`",
			),
		).toEqual(["voidbrain.chat-with-vault", "voidbrain.stage-change"]);
		expect(
			extractAgentCommandReferencesFromMarkdown(
				["# Catalog", "`voidbrain.stage-change`", "## Runtime", "`voidbrain.chat-with-vault`"].join("\n"),
			),
		).toEqual([
			expect.objectContaining({
				commandId: "voidbrain.chat-with-vault",
				line: 4,
				heading: "Runtime",
			}),
			expect.objectContaining({
				commandId: "voidbrain.stage-change",
				line: 2,
				heading: "Catalog",
			}),
		]);
	});

	it("detects stale command status labels with remediation context", () => {
		const report = validateAgentSurfaceMarkdown({
			surface: fixtureSurface,
			markdown: surfaceMarkdownWithStaleStatus(
				AGENT_COMMAND_CATALOG,
				"voidbrain.validate-agent-surfaces",
				"scaffolded",
			),
			commands: AGENT_COMMAND_CATALOG,
		});

		expect(report.issues).toEqual([
			expect.objectContaining({
				code: "surface.stale-command-status",
				commandId: "voidbrain.validate-agent-surfaces",
				heading: "Command Catalog",
				line: expect.any(Number),
				remediation: expect.stringContaining("implemented"),
			}),
		]);
	});
});

describe("fixture safety scanning", () => {
	it("allows synthetic fixture examples", () => {
		expect(
			scanFixtureSafetyText(
				"docs/example.md",
				"Use test/fixtures/vault/sources/demo-article.md with staged changes.",
			).issues,
		).toEqual([]);
	});

	it("detects secret-like keys, credential-like values, and private path hints", () => {
		const report = scanFixtureSafetyText("docs/example.md", unsafeFixtureExampleText());

		expect(report.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "fixture.secret-like-key" }),
				expect.objectContaining({ code: "fixture.credential-like-value" }),
				expect.objectContaining({ code: "fixture.private-path-hint" }),
			]),
		);
		const firstIssue = report.issues[0];
		const secondIssue = report.issues[1];
		if (firstIssue === undefined || secondIssue === undefined) {
			throw new Error("Expected fixture safety issues");
		}
		expect(formatAgentValidationIssue(firstIssue)).toContain("[REDACTED");
		expect(formatAgentValidationIssue(secondIssue)).not.toContain("1234567890abcdef12");
	});
});

describe("repository scan boundaries", () => {
	it("accepts bounded framework paths and rejects unsupported paths", () => {
		expect(
			validateRepositoryScanPath("docs/agent-surfaces-commands.md", {
				allowedRoots: ["docs"],
				allowedStandalonePaths: ["AGENTS.md"],
				allowedExtensions: [".md"],
				excludedRoots: ["vault"],
			}),
		).toMatchObject({
			ok: true,
			path: "docs/agent-surfaces-commands.md",
			boundary: expect.objectContaining({ allowed: true }),
		});

		expect(
			validateRepositoryScanPath("../private.md", {
				allowedRoots: ["docs"],
				allowedStandalonePaths: ["AGENTS.md"],
				allowedExtensions: [".md"],
				excludedRoots: ["vault"],
			}),
		).toMatchObject({
			ok: false,
			issue: expect.objectContaining({ code: "fixture.unsupported-scan-path" }),
		});
	});

	it("uses fixture builders for complete catalog surfaces", () => {
		expect(
			validateAgentSurfaceMarkdown({
				surface: fixtureSurface,
				markdown: completeSurfaceMarkdownForCommands(AGENT_COMMAND_CATALOG),
				commands: AGENT_COMMAND_CATALOG,
			}).issues,
		).toEqual([]);
	});
});

describe("framework update preview", () => {
	it("plans dry-run framework actions and excludes user content", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidatePaths: ["AGENTS.md", "test/fixtures/vault/sources/demo-article.md", "../outside.md"],
			now: new Date("2026-05-12T00:00:00.000Z"),
		});

		expect(plan).toMatchObject({
			dryRun: true,
			generatedAt: "2026-05-12T00:00:00.000Z",
		});
		expect(plan.actions).toEqual([
			{
				path: "AGENTS.md",
				action: "update",
				reason: "Framework-owned path eligible for preview only.",
			},
		]);
		expect(plan.excludedUserContentPaths).toEqual(["test/fixtures/vault/sources/demo-article.md"]);
		expect(plan.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "framework.invalid-input" }),
				expect.objectContaining({ code: "framework.user-content-target" }),
			]),
		);
	});

	it("rejects duplicate preview requests while one is in flight", async () => {
		let releaseFirstPreview: (() => void) | undefined;
		const planner = createFrameworkUpdatePreviewPlanner({
			now: () => new Date("2026-05-12T00:00:00.000Z"),
			beforePlan: () =>
				new Promise<void>((resolve) => {
					releaseFirstPreview = resolve;
				}),
		});

		const firstPreview = planner.plan({
			rootDir: ".",
			candidatePaths: ["AGENTS.md"],
		});
		const duplicatePreview = await planner.plan({
			rootDir: ".",
			candidatePaths: ["README.md"],
		});

		expect(duplicatePreview.issues).toEqual([
			expect.objectContaining({
				code: "framework.duplicate-preview",
			}),
		]);

		if (releaseFirstPreview === undefined) {
			throw new Error("Expected first preview to be waiting");
		}
		releaseFirstPreview();

		await expect(firstPreview).resolves.toMatchObject({
			dryRun: true,
			actions: [expect.objectContaining({ path: "AGENTS.md" })],
		});
	});
});
