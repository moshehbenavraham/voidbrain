import { StagedChangeService, createContentSha256 } from "../../../src/agent";
import type { StagedChangeRecord, ValidationResult } from "../../../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";

export const STAGED_REVIEW_FIXTURE_MESSAGE =
	"Staged review fixtures are synthetic vault notes only and contain no provider secrets or private paths.";

export const STAGED_REVIEW_SOURCE_PATH = "sources/demo-article.md";
export const STAGED_REVIEW_CREATE_TARGET = "summaries/staged-review-create.md";
export const STAGED_REVIEW_UPDATE_TARGET = "summaries/demo-article-summary.md";
export const STAGED_REVIEW_DELETE_TARGET = "summaries/obsolete-demo-summary.md";
export const STAGED_REVIEW_MOVE_TARGET = "summaries/move-demo-summary.md";
export const STAGED_REVIEW_MOVE_DESTINATION = "archive/move-demo-summary.md";
export const STAGED_REVIEW_FRONTMATTER_TARGET = "concepts/local-first-vaults.md";

export const STAGED_REVIEW_SOURCE_CONTENT = [
	"# Demo Article",
	"",
	"Synthetic source content for staged review and apply tests.",
].join("\n");

export const STAGED_REVIEW_UPDATE_BEFORE = [
	"# Demo Article Summary",
	"",
	"Original synthetic summary for staged review tests.",
].join("\n");

export const STAGED_REVIEW_UPDATE_AFTER = [
	"# Demo Article Summary",
	"",
	"Updated synthetic summary with local-first staged review details.",
].join("\n");

export const STAGED_REVIEW_DELETE_CONTENT = [
	"# Obsolete Demo Summary",
	"",
	"Synthetic content that can be backed up before deletion.",
].join("\n");

export const STAGED_REVIEW_MOVE_CONTENT = [
	"# Move Demo Summary",
	"",
	"Synthetic note that can be moved after review.",
].join("\n");

export const STAGED_REVIEW_FRONTMATTER_BEFORE = [
	"---",
	"title: Local First Vaults",
	"status: draft",
	"---",
	"",
	"# Local First Vaults",
].join("\n");

export const STAGED_REVIEW_FRONTMATTER_AFTER = [
	"---",
	"title: Local First Vaults",
	"status: reviewed",
	"---",
	"",
	"# Local First Vaults",
].join("\n");

export const STAGED_REVIEW_EXISTING_NOTES = [
	{ path: STAGED_REVIEW_UPDATE_TARGET, content: STAGED_REVIEW_UPDATE_BEFORE },
	{ path: STAGED_REVIEW_DELETE_TARGET, content: STAGED_REVIEW_DELETE_CONTENT },
	{ path: STAGED_REVIEW_MOVE_TARGET, content: STAGED_REVIEW_MOVE_CONTENT },
	{ path: STAGED_REVIEW_FRONTMATTER_TARGET, content: STAGED_REVIEW_FRONTMATTER_BEFORE },
] as const;

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const unwrap = <TValue>(result: ValidationResult<TValue>): TValue => {
	if (!result.ok) {
		throw new Error(`Fixture staged-change build failed: ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

export const createStagedReviewFixtureRecords = async (): Promise<readonly StagedChangeRecord[]> => {
	const service = new StagedChangeService({ now: fixedNow });
	const beforeSha256 = await createContentSha256(STAGED_REVIEW_UPDATE_BEFORE);
	const createRecord = unwrap(
		await service.stageCreateNote({
			commandId: "voidbrain.ingest-source",
			targetPath: STAGED_REVIEW_CREATE_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Create a synthetic staged review summary.",
			afterContent: "# Staged Review Create\n\nSynthetic staged review content.\n",
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
		}),
	);
	const updateRecord = unwrap(
		await service.stageUpdateNote({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_UPDATE_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Update a synthetic staged review summary.",
			afterContent: STAGED_REVIEW_UPDATE_AFTER,
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
			expectedBeforeSha256: beforeSha256,
		}),
	);
	const frontmatterRecord = unwrap(
		await service.stageFrontmatterEdit({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_FRONTMATTER_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Update synthetic frontmatter review status.",
			afterContent: STAGED_REVIEW_FRONTMATTER_AFTER,
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
			frontmatterPatch: [{ key: "status", before: "draft", after: "reviewed" }],
		}),
	);
	const deleteRecord = unwrap(
		await service.stageDeleteNote({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_DELETE_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Delete an obsolete synthetic staged review summary.",
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
		}),
	);
	const moveRecord = unwrap(
		await service.stageMoveNote({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_MOVE_TARGET,
			destinationPath: STAGED_REVIEW_MOVE_DESTINATION,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Move a synthetic staged review summary.",
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
		}),
	);
	const rawStaleHashRecord = unwrap(
		await service.stageUpdateNote({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_UPDATE_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Create a synthetic stale-hash conflict.",
			afterContent: STAGED_REVIEW_UPDATE_AFTER,
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
			expectedBeforeSha256: "000000",
		}),
	);
	const staleHashRecord: StagedChangeRecord = {
		...rawStaleHashRecord,
		changeId: `${rawStaleHashRecord.changeId}-stale`,
		recovery: {
			...rawStaleHashRecord.recovery,
			stagedChangeId: `${rawStaleHashRecord.changeId}-stale`,
		},
	};
	const destinationCollisionRecord = unwrap(
		await service.stageMoveNote({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_MOVE_TARGET,
			destinationPath: STAGED_REVIEW_UPDATE_TARGET,
			sourcePaths: [STAGED_REVIEW_SOURCE_PATH],
			rationale: "Create a synthetic destination collision.",
			existingNotes: STAGED_REVIEW_EXISTING_NOTES,
		}),
	);
	const failedRecord: StagedChangeRecord = {
		...updateRecord,
		changeId: `${updateRecord.changeId}-failed`,
		status: "failed",
		updatedAt: makeIsoTimestamp("2026-05-13T00:05:00.000Z"),
		recovery: {
			...updateRecord.recovery,
			stagedChangeId: `${updateRecord.changeId}-failed`,
			status: "failed-apply",
			failedAt: makeIsoTimestamp("2026-05-13T00:05:00.000Z"),
			lastFailureMessage: "Synthetic apply failure for recovery tests.",
			validationOutput: [
				...updateRecord.recovery.validationOutput,
				{
					code: "record.invalid-operation",
					message: "Synthetic apply failure for recovery tests.",
					path: makeNormalizedVaultPath(STAGED_REVIEW_UPDATE_TARGET),
				},
			],
		},
	};

	return [
		createRecord,
		updateRecord,
		frontmatterRecord,
		deleteRecord,
		moveRecord,
		staleHashRecord,
		destinationCollisionRecord,
		failedRecord,
	];
};
