import { describe, expect, it } from "vitest";
import { SimilarNoteSuggestionService, StagedChangeService, planSimilarNoteSuggestions } from "../src/agent";
import type { SimilarNoteSuggestion } from "../src/types/suggestions";
import {
	SIMILAR_CONCEPT_PATH,
	SIMILAR_DUPLICATE_LINK_PATH,
	SIMILAR_NOTE_FIXED_DATE,
	SIMILAR_SUMMARY_PATH,
	createSimilarActiveStagedChange,
	createSimilarNoteRetrievalResults,
	loadSimilarNoteCurrentNotes,
	loadSimilarNoteFixtureNotes,
} from "./fixtures/vault/similar-note-suggestion-fixtures";

const createService = () =>
	new SimilarNoteSuggestionService({
		now: () => SIMILAR_NOTE_FIXED_DATE,
	});

const createPlan = () =>
	planSimilarNoteSuggestions({
		notes: loadSimilarNoteFixtureNotes(),
		retrievalResults: createSimilarNoteRetrievalResults(),
		now: SIMILAR_NOTE_FIXED_DATE,
	});

const requiredSuggestion = (
	suggestions: readonly SimilarNoteSuggestion[],
	predicate: (suggestion: SimilarNoteSuggestion) => boolean,
	description: string,
): SimilarNoteSuggestion => {
	const suggestion = suggestions.find(predicate);
	if (suggestion === undefined) {
		throw new Error(`Expected ${description}`);
	}

	return suggestion;
};

describe("SimilarNoteSuggestionService", () => {
	it("plans deterministic ranked suggestions with bounded evidence and low-confidence report-only records", () => {
		const firstPlan = createPlan();
		const secondPlan = createPlan();

		expect(secondPlan).toEqual(firstPlan);
		expect(firstPlan.summary.totalSuggestions).toBeGreaterThan(0);
		expect(firstPlan.candidates.map((candidate) => candidate.rank)).toEqual(
			firstPlan.candidates.map((_, index) => index + 1),
		);
		expect(firstPlan.suggestions.map((suggestion) => suggestion.rank)).toEqual(
			firstPlan.suggestions.map((_, index) => index + 1),
		);
		expect(firstPlan.summary.affectedPaths).toContain(SIMILAR_CONCEPT_PATH);

		const retrievalBacked = requiredSuggestion(
			firstPlan.suggestions,
			(suggestion) => suggestion.sourceRecords.some((record) => record.kind === "retrieval-result"),
			"retrieval-backed suggestion",
		);
		expect(retrievalBacked.evidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					retrievalResultId: "retrieval-similar-memory",
					heading: "Local First Memory",
				}),
			]),
		);
		expect(JSON.stringify(firstPlan)).not.toContain("Synthetic retrieval body text");
		expect(JSON.stringify(firstPlan)).not.toContain("Synthetic placement retrieval body text");

		const duplicateWikilink = firstPlan.suggestions.find(
			(suggestion) =>
				suggestion.kind === "wikilink" &&
				suggestion.targetPath === SIMILAR_DUPLICATE_LINK_PATH &&
				suggestion.relatedPath === SIMILAR_CONCEPT_PATH,
		);
		expect(duplicateWikilink).toBeUndefined();

		const lowConfidence = requiredSuggestion(
			firstPlan.suggestions,
			(suggestion) => suggestion.confidence === "low",
			"low-confidence suggestion",
		);
		expect(lowConfidence.stageability.kind).toBe("report-only");
	});

	it("blocks existing destination paths and active staged-change duplicates", () => {
		const activeChange = createSimilarActiveStagedChange("review-ready", SIMILAR_SUMMARY_PATH);
		const plan = planSimilarNoteSuggestions({
			notes: loadSimilarNoteFixtureNotes(),
			retrievalResults: createSimilarNoteRetrievalResults(),
			stagedChanges: [activeChange],
			now: SIMILAR_NOTE_FIXED_DATE,
		});

		const blockedByActiveChange = requiredSuggestion(
			plan.suggestions,
			(suggestion) =>
				suggestion.targetPath === SIMILAR_SUMMARY_PATH &&
				suggestion.stageability.blockedByStagedChangeId === activeChange.changeId,
			"active staged-change blocked suggestion",
		);
		expect(blockedByActiveChange.stageability.kind).toBe("blocked");

		const blockedMove = requiredSuggestion(
			plan.suggestions,
			(suggestion) =>
				suggestion.kind === "folder-placement" &&
				suggestion.stageability.kind === "blocked" &&
				suggestion.stageability.reason.includes("already exists"),
			"existing destination blocked move",
		);
		expect(blockedMove.destinationPath).toBeDefined();
	});

	it("stages wikilink, frontmatter, and folder suggestions through staged-change records", async () => {
		const service = createService();
		const plan = createPlan();
		const existingNotes = loadSimilarNoteCurrentNotes();
		const stageable = (kind: SimilarNoteSuggestion["kind"]) =>
			requiredSuggestion(
				plan.suggestions,
				(suggestion) => suggestion.kind === kind && suggestion.stageability.kind === "stageable",
				`${kind} stageable suggestion`,
			);

		const wikilink = await service.stageSuggestion({
			plan,
			suggestionId: stageable("wikilink").suggestionId,
			existingNotes,
			existingStagedChanges: [],
		});
		expect(wikilink).toMatchObject({ ok: true });
		if (!wikilink.ok) {
			throw new Error(wikilink.message);
		}
		expect(wikilink.stagedChange.operationKind).toBe("update-note");
		expect(wikilink.stagedChange.diff.afterContent).toContain("Related: [[");

		for (const kind of ["related-note", "tag", "alias", "frontmatter-placement"] as const) {
			const result = await service.stageSuggestion({
				plan,
				suggestionId: stageable(kind).suggestionId,
				existingNotes,
				existingStagedChanges: [],
			});
			expect(result).toMatchObject({ ok: true });
			if (!result.ok) {
				throw new Error(result.message);
			}
			expect(result.stagedChange.operationKind).toBe("update-frontmatter");
			expect(result.stagedChange.operationMetadata?.frontmatterPatch?.length).toBeGreaterThan(0);
		}

		const folder = await service.stageSuggestion({
			plan,
			suggestionId: stageable("folder-placement").suggestionId,
			existingNotes,
			existingStagedChanges: [],
		});
		expect(folder).toMatchObject({ ok: true });
		if (!folder.ok) {
			throw new Error(folder.message);
		}
		expect(folder.stagedChange.operationKind).toBe("move-note");
		expect(folder.stagedChange.operationMetadata?.destinationPath).toBeDefined();
	});

	it("returns explicit failures for report-only, duplicate, in-flight, and malformed staging", async () => {
		const plan = createPlan();
		const reportOnly = requiredSuggestion(
			plan.suggestions,
			(suggestion) => suggestion.stageability.kind === "report-only",
			"report-only suggestion",
		);
		await expect(
			createService().stageSuggestion({
				plan,
				suggestionId: reportOnly.suggestionId,
				existingNotes: loadSimilarNoteCurrentNotes(),
				existingStagedChanges: [],
			}),
		).resolves.toMatchObject({ ok: false, reason: "report-only" });

		const stageableFrontmatter = requiredSuggestion(
			plan.suggestions,
			(suggestion) => suggestion.kind === "tag" && suggestion.stageability.kind === "stageable",
			"stageable tag suggestion",
		);
		await expect(
			createService().stageSuggestion({
				plan,
				suggestionId: stageableFrontmatter.suggestionId,
				existingNotes: loadSimilarNoteCurrentNotes(),
				existingStagedChanges: [
					createSimilarActiveStagedChange("review-ready", stageableFrontmatter.targetPath),
				],
			}),
		).resolves.toMatchObject({ ok: false, reason: "active-staged-change" });

		await expect(
			createService().stageSuggestion({
				plan,
				suggestionId: stageableFrontmatter.suggestionId,
				existingNotes: [{ path: stageableFrontmatter.targetPath, content: "# Missing Frontmatter" }],
				existingStagedChanges: [],
			}),
		).resolves.toMatchObject({ ok: false, reason: "validation-failed" });

		let releaseBuild: (() => void) | undefined;
		const pendingBuild = new Promise<void>((resolve) => {
			releaseBuild = resolve;
		});
		const stagedChangeService = new StagedChangeService({
			now: () => SIMILAR_NOTE_FIXED_DATE,
			hooks: {
				beforeBuild: () => pendingBuild,
			},
		});
		const inFlightService = new SimilarNoteSuggestionService({
			now: () => SIMILAR_NOTE_FIXED_DATE,
			stagedChangeService,
		});
		const firstStage = inFlightService.stageSuggestion({
			plan,
			suggestionId: stageableFrontmatter.suggestionId,
			existingNotes: loadSimilarNoteCurrentNotes(),
			existingStagedChanges: [],
		});
		const duplicateStage = await inFlightService.stageSuggestion({
			plan,
			suggestionId: stageableFrontmatter.suggestionId,
			existingNotes: loadSimilarNoteCurrentNotes(),
			existingStagedChanges: [],
		});
		expect(duplicateStage).toMatchObject({ ok: false, reason: "in-flight" });
		if (releaseBuild === undefined) {
			throw new Error("Expected staged-change hook release");
		}
		releaseBuild();
		await expect(firstStage).resolves.toMatchObject({ ok: true });
	});
});
