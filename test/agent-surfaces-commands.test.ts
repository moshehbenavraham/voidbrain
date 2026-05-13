import { readFileSync } from "node:fs";
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
import { validateRepositoryScanPath } from "../src/agent/repository-scan-boundary";
import { createRuntimeCommandHandlers } from "../src/agent/runtime-command-handlers";
import { createRuntimeStatusSnapshot } from "../src/agent/runtime-status";
import {
	extractAgentCommandIdsFromMarkdown,
	extractAgentCommandReferencesFromMarkdown,
	findMissingRequiredSafetyPhrases,
	validateAgentSurfaceMarkdown,
} from "../src/agent/surface-validation";
import { AGENT_COMMAND_IDS, agentCommandStatusLabel } from "../src/types/agent-commands";
import { DEFAULT_PLUGIN_SETTINGS } from "../src/types/plugin";
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
			"voidbrain.preview-framework-update",
		]);
		expect(getAgentCommandsByStatus("scaffolded").map((command) => command.id)).toEqual([]);
		expect(getAgentCommandById("voidbrain.chat-with-vault")).toMatchObject({
			privacyLevel: "explicit-provider-review",
		});
		expect(getAgentCommandById("voidbrain.preview-framework-update")).toMatchObject({
			status: "implemented",
			writePolicy: "dry-run",
			requiredEvidence: expect.arrayContaining(["conflict issue codes", "content hashes", "validation context"]),
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

describe("framework update preview command surface", () => {
	it("keeps checked agent surfaces compatible with implemented dry-run status", () => {
		for (const surface of AGENT_SURFACES) {
			const markdown = readFileSync(surface.path, "utf8");
			expect(
				validateAgentSurfaceMarkdown({
					surface,
					markdown,
					commands: AGENT_COMMAND_CATALOG,
				}).issues,
			).toEqual([]);
		}
	});

	it("returns a dry-run runtime outcome and blocks immediate duplicate triggers", async () => {
		const handlers = createRuntimeCommandHandlers({
			getSettings: () => DEFAULT_PLUGIN_SETTINGS,
			getStatusSnapshot: () =>
				createRuntimeStatusSnapshot({
					settings: DEFAULT_PLUGIN_SETTINGS,
					providers: [],
					now: new Date("2026-05-13T00:00:00.000Z"),
				}),
		});
		const handler = handlers.find((entry) => entry.command.id === "voidbrain.preview-framework-update");
		if (handler === undefined) {
			throw new Error("Expected preview command handler");
		}

		expect(handler.run()).toMatchObject({
			commandId: "voidbrain.preview-framework-update",
			kind: "dry-run",
			severity: "ready",
		});
		expect(handler.run()).toMatchObject({
			commandId: "voidbrain.preview-framework-update",
			kind: "not-ready",
			severity: "warning",
			userMessage: expect.stringContaining("already in flight"),
		});

		await Promise.resolve();

		expect(handler.run()).toMatchObject({
			commandId: "voidbrain.preview-framework-update",
			kind: "dry-run",
			severity: "ready",
		});
	});
});
