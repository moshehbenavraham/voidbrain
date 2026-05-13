import { describe, expect, it } from "vitest";
import { classifyHealthRepairSafety, renderVaultHealthMarkdownReport, scanVaultHealth } from "../src/agent";
import type { MarkdownParseResult, ParsedMarkdownNote } from "../src/types/retrieval";
import { makeNormalizedVaultPath } from "../src/types/vault";
import { evaluateIndexFreshness, parseMarkdownNote } from "../src/vectorstore";
import { INDEXING_PARSE_OPTIONS, loadIndexingFixtureNotes } from "./fixtures/vault/indexing-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");

const expectParsed = (result: MarkdownParseResult): ParsedMarkdownNote => {
	if (!result.ok) {
		throw new Error(`Expected parse success, got ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

const parseFixtureNotes = (): readonly ParsedMarkdownNote[] =>
	loadIndexingFixtureNotes().map((note) =>
		expectParsed(parseMarkdownNote(note.path, note.content, INDEXING_PARSE_OPTIONS)),
	);

const fixtureContent = (path: string): string => {
	const fixture = loadIndexingFixtureNotes().find((note) => note.path === path);
	if (fixture === undefined) {
		throw new Error(`Missing fixture ${path}`);
	}

	return fixture.content;
};

const parseSyntheticNote = (path: string, content: string): ParsedMarkdownNote =>
	expectParsed(parseMarkdownNote(path, content, INDEXING_PARSE_OPTIONS));

const orphanConcept = parseSyntheticNote(
	"concepts/orphan-health-fixture.md",
	`---
voidbrain-id: concept-orphan-health-fixture
artifact-kind: concept
created-at: 2026-05-13T00:00:00Z
updated-at: 2026-05-13T00:00:00Z
source-paths: []
tags: [fixture, health]
title: Orphan Health Fixture
concept-type: topic
aliases: []
related-notes: []
---

# Orphan Health Fixture

This synthetic concept is intentionally disconnected for a health check test.
`,
);

const uncitedSummary = parseSyntheticNote(
	"summaries/uncited-health-summary.md",
	`---
voidbrain-id: summary-uncited-health-fixture
artifact-kind: summary
created-at: 2026-05-13T00:00:00Z
updated-at: 2026-05-13T00:00:00Z
source-paths: [sources/demo-article.md]
tags: [fixture, health]
title: Uncited Health Summary
summary-type: source-summary
summary-of: sources/demo-article.md
---

# Uncited Health Summary

This synthetic summary points at a source but intentionally omits citation
frontmatter.
`,
);

const contentGapSummary = parseSyntheticNote(
	"summaries/content-gap-health-summary.md",
	`---
voidbrain-id: summary-content-gap-health-fixture
artifact-kind: summary
created-at: 2026-05-13T00:00:00Z
updated-at: 2026-05-13T00:00:00Z
source-paths: [sources/demo-article.md]
tags: [fixture, health]
title: Content Gap Health Summary
summary-type: source-summary
summary-of: sources/demo-article.md
citations: [vault:sources/demo-article.md]
---

# Content Gap Health Summary

`,
);

describe("vault health scanner", () => {
	it("reports orphans, broken links, stale indexes, and missing citations deterministically", () => {
		const brokenSource = parseSyntheticNote(
			"sources/demo-article.md",
			`${fixtureContent("sources/demo-article.md")}\n\nBroken fixture link: [[missing-health-note]].\n`,
		);
		const baseNotes = parseFixtureNotes().filter((note) => note.path !== "sources/demo-article.md");
		const notes = [...baseNotes, brokenSource, orphanConcept, uncitedSummary, contentGapSummary];
		const currentSources = notes.map((note) => ({
			path: note.path,
			contentFingerprint: note.contentFingerprint,
		}));
		const firstSource = currentSources[0];
		if (firstSource === undefined) {
			throw new Error("Expected at least one health fixture source");
		}
		const staleSnapshot = evaluateIndexFreshness(
			"lexical-health-fixture",
			[
				{ ...firstSource, contentFingerprint: "stale-fingerprint" },
				{ path: makeNormalizedVaultPath("summaries/extra-index-entry.md"), contentFingerprint: "extra" },
			],
			currentSources,
			fixedDate,
		);

		const firstScan = scanVaultHealth({
			notes,
			freshnessSnapshots: [staleSnapshot],
			generatedAt: fixedDate,
			reportId: "health-fixture-report",
		});
		const secondScan = scanVaultHealth({
			notes,
			freshnessSnapshots: [staleSnapshot],
			generatedAt: fixedDate,
			reportId: "health-fixture-report",
		});

		expect(firstScan).toMatchObject({ ok: true });
		expect(secondScan).toEqual(firstScan);
		if (!firstScan.ok) {
			throw new Error(JSON.stringify(firstScan.issues));
		}

		expect(firstScan.report.summary.findingCounts).toMatchObject({
			"broken-wikilink": 1,
			"content-gap": 1,
			"missing-citation": 1,
			"orphan-note": 1,
		});
		expect(firstScan.report.summary.findingCounts["stale-index"]).toBeGreaterThanOrEqual(3);
		expect(firstScan.report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "broken-wikilink",
					affectedPaths: ["sources/demo-article.md"],
					evidence: [expect.objectContaining({ expected: "missing-health-note" })],
				}),
				expect.objectContaining({
					kind: "orphan-note",
					affectedPaths: ["concepts/orphan-health-fixture.md"],
				}),
				expect.objectContaining({
					kind: "missing-citation",
					affectedPaths: ["summaries/uncited-health-summary.md"],
					remediation: expect.objectContaining({ kind: "stage-change" }),
				}),
				expect.objectContaining({
					kind: "content-gap",
					affectedPaths: ["summaries/content-gap-health-summary.md"],
					remediation: expect.objectContaining({ kind: "report-only" }),
				}),
				expect.objectContaining({
					kind: "stale-index",
					evidence: [expect.objectContaining({ indexId: "lexical-health-fixture" })],
				}),
			]),
		);
		expect(firstScan.report.groups.length).toBeGreaterThan(0);
	});

	it("returns validation issues for malformed citation frontmatter", () => {
		const malformedSummary = parseSyntheticNote(
			"summaries/malformed-health-summary.md",
			`---
voidbrain-id: summary-malformed-health-fixture
artifact-kind: summary
created-at: 2026-05-13T00:00:00Z
updated-at: 2026-05-13T00:00:00Z
source-paths: sources/demo-article.md
tags: [fixture, health]
title: Malformed Health Summary
summary-type: source-summary
summary-of: sources/demo-article.md
citations: []
---

# Malformed Health Summary

This synthetic summary has malformed source path frontmatter.
`,
		);

		expect(
			scanVaultHealth({
				notes: [malformedSummary],
				generatedAt: fixedDate,
			}),
		).toMatchObject({
			ok: false,
			issues: [expect.objectContaining({ field: "source-paths" })],
		});
	});

	it("renders redacted markdown export and classifies only missing citations as safe repairs", () => {
		const scan = scanVaultHealth({
			notes: [uncitedSummary, contentGapSummary],
			generatedAt: fixedDate,
			reportId: "health-export-fixture",
		});
		if (!scan.ok) {
			throw new Error(JSON.stringify(scan.issues));
		}

		const markdown = renderVaultHealthMarkdownReport(scan.report);
		expect(markdown).toContain("# Vault Health Report");
		expect(markdown).toContain("health-export-fixture");
		expect(markdown).toContain("summaries/uncited-health-summary.md");
		expect(markdown).not.toContain("This synthetic summary points at a source");
		expect(markdown).not.toMatch(/token\s*[:=]/iu);

		const missingCitation = scan.report.findings.find((finding) => finding.kind === "missing-citation");
		const contentGap = scan.report.findings.find((finding) => finding.kind === "content-gap");
		if (missingCitation === undefined || contentGap === undefined) {
			throw new Error("Expected missing citation and content gap findings.");
		}

		expect(classifyHealthRepairSafety(missingCitation)).toMatchObject({
			kind: "safe-stage-change",
			targetPath: "summaries/uncited-health-summary.md",
		});
		expect(classifyHealthRepairSafety(contentGap)).toMatchObject({
			kind: "report-only",
		});
	});
});
