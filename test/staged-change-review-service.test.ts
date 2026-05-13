import { describe, expect, it } from "vitest";
import { StagedChangeReviewService } from "../src/agent";
import type { StagedReviewPreflightAdapter } from "../src/types/staged-review";
import type { NormalizedVaultPath, StagedChangeRecord } from "../src/types/vault";
import {
	STAGED_REVIEW_CREATE_TARGET,
	STAGED_REVIEW_DELETE_CONTENT,
	STAGED_REVIEW_DELETE_TARGET,
	STAGED_REVIEW_MOVE_CONTENT,
	STAGED_REVIEW_MOVE_DESTINATION,
	STAGED_REVIEW_MOVE_TARGET,
	STAGED_REVIEW_UPDATE_AFTER,
	STAGED_REVIEW_UPDATE_BEFORE,
	STAGED_REVIEW_UPDATE_TARGET,
	createStagedReviewFixtureRecords,
} from "./fixtures/vault/staged-change-review-fixtures";

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const findRecord = (
	records: readonly StagedChangeRecord[],
	operationKind: StagedChangeRecord["operationKind"],
	targetPath?: string,
): StagedChangeRecord => {
	const record = records.find(
		(candidate) =>
			candidate.operationKind === operationKind &&
			(targetPath === undefined || candidate.targetPath === targetPath),
	);
	if (record === undefined) {
		throw new Error(`Missing fixture record for ${operationKind}`);
	}

	return record;
};

const adapterFromContent = (
	content: Readonly<Record<string, string>>,
	canWrite: (path: NormalizedVaultPath) => boolean = () => true,
): StagedReviewPreflightAdapter => ({
	exists: async (path) => Object.hasOwn(content, path),
	read: async (path) => {
		const value = content[path];
		if (value === undefined) {
			throw new Error(`Synthetic missing read: ${path}`);
		}

		return value;
	},
	canWrite: async (path) => canWrite(path),
});

describe("staged-change review service", () => {
	it("groups records deterministically and creates bounded previews", async () => {
		const records = await createStagedReviewFixtureRecords();
		const service = new StagedChangeReviewService({ now: fixedNow, maxPreviewCharacters: 20, maxDiffLines: 2 });

		const model = service.createModel(records);
		const groupIds = model.groups.map((group) => group.groupId);

		expect(groupIds).toEqual([...groupIds].sort((left, right) => left.localeCompare(right)));
		expect(model.summary.totalRecords).toBe(records.length);
		expect(model.summary.conflictedRecords).toBeGreaterThan(0);
		expect(model.summary.failedRecords).toBe(1);
		expect(model.summary.sourcePaths).toEqual(["sources/demo-article.md"]);

		const createGroup = model.groups.find((group) => group.key.targetPath === STAGED_REVIEW_CREATE_TARGET);
		expect(createGroup).toBeDefined();
		expect(createGroup?.confirmation.kind).toBe("additive");
		expect(createGroup?.previews[0]?.previewKind).toBe("create-preview");
		expect(createGroup?.previews[0]?.truncatedAfter).toBe(true);
		expect(createGroup?.previews[0]?.diffLines).toHaveLength(2);
	});

	it("requires stronger confirmation for overwrite, destructive, and batch apply", async () => {
		const records = await createStagedReviewFixtureRecords();
		const service = new StagedChangeReviewService({ now: fixedNow });
		const updateRecord = findRecord(records, "update-note", STAGED_REVIEW_UPDATE_TARGET);
		const deleteRecord = findRecord(records, "delete-note", STAGED_REVIEW_DELETE_TARGET);
		const createRecord = findRecord(records, "create-note", STAGED_REVIEW_CREATE_TARGET);

		const createConfirmation = service.getConfirmationRequirement([createRecord]);
		expect(createConfirmation.kind).toBe("additive");
		expect(createConfirmation.requiredText).toBeUndefined();
		expect(service.getConfirmationRequirement([updateRecord])).toMatchObject({
			kind: "overwrite",
			requiredText: `APPLY OVERWRITE ${STAGED_REVIEW_UPDATE_TARGET}`,
		});
		expect(service.getConfirmationRequirement([deleteRecord])).toMatchObject({
			kind: "destructive",
			requiredText: `APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`,
		});
		expect(service.getConfirmationRequirement([createRecord, updateRecord])).toMatchObject({
			kind: "batch",
			requiredText: "APPLY 2 STAGED CHANGES",
		});
	});

	it("transitions approve, reject, retry, and dismiss with audit and recovery details", async () => {
		const records = await createStagedReviewFixtureRecords();
		const service = new StagedChangeReviewService({ now: fixedNow });
		const updateRecord = findRecord(records, "update-note", STAGED_REVIEW_UPDATE_TARGET);

		const approved = service.applyAction(records, { action: "approve", changeIds: [updateRecord.changeId] });
		expect(approved.ok).toBe(true);
		expect(approved.records.find((record) => record.changeId === updateRecord.changeId)?.status).toBe("approved");
		expect(approved.auditEntries[0]).toMatchObject({ action: "approve", status: "succeeded" });

		const rejected = service.applyAction(approved.records, {
			action: "reject",
			changeIds: [updateRecord.changeId],
		});
		const rejectedRecord = rejected.records.find((record) => record.changeId === updateRecord.changeId);
		expect(rejectedRecord?.status).toBe("rejected");
		expect(rejectedRecord?.recovery.rejectedAt).toBe("2026-05-13T00:00:00.000Z");

		const retried = service.applyAction(rejected.records, { action: "retry", changeIds: [updateRecord.changeId] });
		expect(retried.records.find((record) => record.changeId === updateRecord.changeId)?.status).toBe(
			"review-ready",
		);

		const dismissed = service.applyAction(retried.records, {
			action: "dismiss",
			changeIds: [updateRecord.changeId],
		});
		expect(dismissed.records.find((record) => record.changeId === updateRecord.changeId)?.status).toBe("dismissed");
		expect(dismissed.recovery[0]).toMatchObject({
			commandId: "voidbrain.stage-change",
			targetPath: STAGED_REVIEW_UPDATE_TARGET,
		});
	});

	it("fails apply preflight for collisions, stale hashes, duplicates, and permission denial", async () => {
		const records = await createStagedReviewFixtureRecords();
		const service = new StagedChangeReviewService({ now: fixedNow });
		const createRecord = findRecord(records, "create-note", STAGED_REVIEW_CREATE_TARGET);
		const updateRecord = findRecord(records, "update-note", STAGED_REVIEW_UPDATE_TARGET);
		const moveRecord = findRecord(records, "move-note", STAGED_REVIEW_MOVE_TARGET);

		const createCollision = await service.planApply(
			records,
			{ action: "apply", changeIds: [createRecord.changeId] },
			adapterFromContent({ [STAGED_REVIEW_CREATE_TARGET]: "# Existing\n" }),
		);
		expect(createCollision.ok).toBe(false);
		expect(createCollision.ok ? [] : createCollision.errors.map((error) => error.message).join(" ")).toContain(
			"already exists",
		);

		const staleUpdate = await service.planApply(
			records,
			{
				action: "apply",
				changeIds: [updateRecord.changeId],
				confirmationText: `APPLY OVERWRITE ${STAGED_REVIEW_UPDATE_TARGET}`,
			},
			adapterFromContent({ [STAGED_REVIEW_UPDATE_TARGET]: `${STAGED_REVIEW_UPDATE_AFTER}\nchanged` }),
		);
		expect(staleUpdate.ok).toBe(false);
		expect(staleUpdate.ok ? [] : staleUpdate.errors.map((error) => error.message).join(" ")).toContain(
			"hash changed",
		);

		const destinationCollision = await service.planApply(
			records,
			{
				action: "apply",
				changeIds: [moveRecord.changeId],
				confirmationText: `APPLY DESTRUCTIVE ${STAGED_REVIEW_MOVE_TARGET}`,
			},
			adapterFromContent({
				[STAGED_REVIEW_MOVE_TARGET]: STAGED_REVIEW_MOVE_CONTENT,
				[STAGED_REVIEW_MOVE_DESTINATION]: "# Existing Destination\n",
			}),
		);
		expect(destinationCollision.ok).toBe(false);
		expect(
			destinationCollision.ok ? [] : destinationCollision.errors.map((error) => error.message).join(" "),
		).toContain("destination already exists");

		const duplicate = await service.planApply(
			[updateRecord, { ...updateRecord, changeId: `${updateRecord.changeId}-duplicate` }],
			{
				action: "apply",
				changeIds: [updateRecord.changeId, `${updateRecord.changeId}-duplicate`],
				confirmationText: "APPLY 2 STAGED CHANGES",
			},
			adapterFromContent({ [STAGED_REVIEW_UPDATE_TARGET]: STAGED_REVIEW_UPDATE_BEFORE }),
		);
		expect(duplicate.ok).toBe(false);
		expect(duplicate.ok ? [] : duplicate.errors.map((error) => error.message).join(" ")).toContain(
			"Multiple active staged changes",
		);

		const permissionDenied = await service.planApply(
			records,
			{
				action: "apply",
				changeIds: [updateRecord.changeId],
				confirmationText: `APPLY OVERWRITE ${STAGED_REVIEW_UPDATE_TARGET}`,
			},
			adapterFromContent({ [STAGED_REVIEW_UPDATE_TARGET]: STAGED_REVIEW_UPDATE_BEFORE }, () => false),
		);
		expect(permissionDenied.ok).toBe(false);
		expect(permissionDenied.ok ? [] : permissionDenied.errors.map((error) => error.message).join(" ")).toContain(
			"permission check failed",
		);
	});

	it("plans apply and maps applied or failed outcomes with recovery metadata", async () => {
		const records = await createStagedReviewFixtureRecords();
		const service = new StagedChangeReviewService({ now: fixedNow });
		const createRecord = findRecord(records, "create-note", STAGED_REVIEW_CREATE_TARGET);
		const deleteRecord = findRecord(records, "delete-note", STAGED_REVIEW_DELETE_TARGET);

		const createPlan = await service.planApply(
			records,
			{ action: "apply", changeIds: [createRecord.changeId] },
			adapterFromContent({}),
		);
		if (!createPlan.ok) {
			throw new Error(`Expected create apply plan, got ${JSON.stringify(createPlan.errors)}`);
		}

		const createOutcome = service.finalizeApplyPlan(createPlan.plan, [], {
			attempted: true,
			ok: true,
			message: "Synthetic index refresh passed.",
			retryable: false,
			targetPaths: [createRecord.targetPath],
		});
		expect(createOutcome.ok).toBe(true);
		expect(createOutcome.records[0]?.status).toBe("applied");
		expect(createOutcome.records[0]?.recovery.appliedAt).toBe("2026-05-13T00:00:00.000Z");
		expect(createOutcome.auditEntries.some((entry) => entry.action === "index-refresh")).toBe(true);

		const deletePlan = await service.planApply(
			records,
			{
				action: "apply",
				changeIds: [deleteRecord.changeId],
				confirmationText: `APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`,
			},
			adapterFromContent({ [STAGED_REVIEW_DELETE_TARGET]: STAGED_REVIEW_DELETE_CONTENT }),
		);
		if (!deletePlan.ok) {
			throw new Error(`Expected delete apply plan, got ${JSON.stringify(deletePlan.errors)}`);
		}

		expect(deletePlan.plan.entries[0]?.backupPath).toContain(".voidbrain/staged-changes/");
		const failedOutcome = service.finalizeApplyPlan(deletePlan.plan, [
			{
				changeId: deleteRecord.changeId,
				message: "Synthetic delete failed.",
				validationOutput: [
					{
						code: "record.invalid-operation",
						message: "Synthetic delete failed.",
						path: deleteRecord.targetPath,
					},
				],
			},
		]);
		expect(failedOutcome.ok).toBe(false);
		expect(failedOutcome.records[0]?.status).toBe("failed");
		expect(failedOutcome.records[0]?.recovery.lastFailureMessage).toBe("Synthetic delete failed.");
	});
});
