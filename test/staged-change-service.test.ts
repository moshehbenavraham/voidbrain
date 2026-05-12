import { describe, expect, it } from "vitest";
import {
	StagedChangeService,
	createContentSha256,
	stageCreateNote,
	stageDeleteNote,
	stageMoveNote,
	stageUpdateNote,
} from "../src/agent";
import type { StagedChangeRecord, ValidationResult } from "../src/types/vault";

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const expectOk = <TValue>(result: ValidationResult<TValue>): TValue => {
	if (!result.ok) {
		throw new Error(`Expected staged-change success, got ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

const existingSummary = {
	path: "summaries/demo-article-summary.md",
	content: "# Demo Article Summary\n\nOriginal fixture summary.\n",
};

describe("staged-change service", () => {
	it("stages a new note with review-ready diff context and deterministic metadata", async () => {
		const staged = expectOk(
			await stageCreateNote(
				{
					commandId: "voidbrain.stage-change",
					targetPath: "summaries/new-demo-summary.md",
					sourcePaths: ["sources/demo-article.md"],
					rationale: "Create a synthetic summary for review.",
					afterContent: "# New Demo Summary\n\nSynthetic review content.\n",
				},
				{ now: fixedNow },
			),
		);

		expect(staged).toMatchObject({
			artifactKind: "staged-change",
			operationKind: "create-note",
			status: "review-ready",
			targetPath: "summaries/new-demo-summary.md",
			review: {
				requiresExplicitReview: true,
				destructive: false,
			},
			recovery: {
				commandId: "voidbrain.stage-change",
				targetPath: "summaries/new-demo-summary.md",
				status: "pending-review",
			},
		});
		expect(staged.changeId).toContain("stage-create-note-summaries-new-demo-summary-md");
		expect(staged.diff.beforeContent).toBeUndefined();
		expect(staged.diff.afterContent).toContain("Synthetic review content");
		expect(staged.diff.lineDiff.some((line) => line.kind === "added")).toBe(true);
	});

	it("stages updates with before and after hashes and blocks stale before content", async () => {
		const beforeSha256 = await createContentSha256(existingSummary.content);
		const staged = expectOk(
			await stageUpdateNote(
				{
					commandId: "voidbrain.stage-change",
					targetPath: existingSummary.path,
					sourcePaths: ["sources/demo-article.md"],
					rationale: "Refresh summary wording.",
					existingNotes: [existingSummary],
					expectedBeforeSha256: beforeSha256,
					afterContent: "# Demo Article Summary\n\nUpdated fixture summary.\n",
				},
				{ now: fixedNow },
			),
		);

		expect(staged.status).toBe("review-ready");
		expect(staged.beforeSha256).toBe(beforeSha256);
		expect(staged.afterSha256).not.toBe(beforeSha256);
		expect(staged.diff.lineDiff.map((line) => line.kind)).toEqual(expect.arrayContaining(["removed", "added"]));

		const conflicted = expectOk(
			await stageUpdateNote(
				{
					commandId: "voidbrain.stage-change",
					targetPath: existingSummary.path,
					sourcePaths: ["sources/demo-article.md"],
					rationale: "Refresh summary wording.",
					existingNotes: [existingSummary],
					expectedBeforeSha256: "000000",
					afterContent: "# Demo Article Summary\n\nUpdated fixture summary.\n",
				},
				{ now: fixedNow },
			),
		);

		expect(conflicted.status).toBe("conflicted");
		expect(conflicted.conflicts).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "target-changed", severity: "blocking" })]),
		);
		expect(conflicted.recovery.validationOutput).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "record.invalid-state" })]),
		);
	});

	it("marks delete and move operations as destructive review paths", async () => {
		const stagedDelete = expectOk(
			await stageDeleteNote(
				{
					commandId: "voidbrain.stage-change",
					targetPath: existingSummary.path,
					sourcePaths: ["sources/demo-article.md"],
					rationale: "Remove obsolete synthetic summary.",
					existingNotes: [existingSummary],
				},
				{ now: fixedNow },
			),
		);

		expect(stagedDelete.review.destructive).toBe(true);
		expect(stagedDelete.recovery.backupPathIntent).toContain(".voidbrain/staged-changes/");
		expect(stagedDelete.diff.afterContent).toBeUndefined();

		const stagedMove = expectOk(
			await stageMoveNote(
				{
					commandId: "voidbrain.stage-change",
					targetPath: existingSummary.path,
					destinationPath: "summaries/existing-target.md",
					sourcePaths: ["sources/demo-article.md"],
					rationale: "Move synthetic summary.",
					existingNotes: [
						existingSummary,
						{ path: "summaries/existing-target.md", content: "# Existing Target\n" },
					],
				},
				{ now: fixedNow },
			),
		);

		expect(stagedMove.review.destructive).toBe(true);
		expect(stagedMove.status).toBe("conflicted");
		expect(stagedMove.conflicts).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "destination-exists" })]),
		);
	});

	it("prevents duplicate staged builds while a target operation is in flight", async () => {
		let releaseBuild: (() => void) | undefined;
		const service = new StagedChangeService({
			now: fixedNow,
			hooks: {
				beforeBuild: () =>
					new Promise<void>((resolve) => {
						releaseBuild = resolve;
					}),
			},
		});
		const input = {
			commandId: "voidbrain.stage-change",
			targetPath: "summaries/duplicate-demo-summary.md",
			sourcePaths: ["sources/demo-article.md"],
			rationale: "Create a duplicate-trigger fixture.",
			afterContent: "# Duplicate Demo Summary\n",
		};

		const firstBuild = service.stageCreateNote(input);
		await Promise.resolve();

		const duplicate = await service.stageCreateNote(input);
		expect(duplicate).toMatchObject({
			ok: false,
			errors: [{ code: "record.invalid-operation" }],
		});

		releaseBuild?.();
		const completed: ValidationResult<StagedChangeRecord> = await firstBuild;
		expect(completed).toMatchObject({ ok: true });
	});
});
