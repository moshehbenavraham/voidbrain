import { describe, expect, it } from "vitest";
import { StagedChangeReviewService } from "../src/agent";
import { createStagedChangeReviewStore } from "../src/stores/staged-change-review-store";
import type { StagedReviewActionRequest, StagedReviewApplyOutcome } from "../src/types/staged-review";
import type { StagedChangeRecord } from "../src/types/vault";
import { StagedChangeReviewModal } from "../src/views/staged-change-review-modal";
import { App as MockApp } from "./__mocks__/obsidian";
import {
	STAGED_REVIEW_DELETE_TARGET,
	STAGED_REVIEW_UPDATE_TARGET,
	createStagedReviewFixtureRecords,
} from "./fixtures/vault/staged-change-review-fixtures";

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const flushPromises = async (count = 8): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const clickAction = async (action: string): Promise<void> => {
	document.body.querySelector<HTMLButtonElement>(`[data-review-action='${action}']`)?.click();
	await flushPromises();
};

describe("StagedChangeReviewModal", () => {
	it("renders empty and offline states without applying vault changes", async () => {
		const service = new StagedChangeReviewService({ now: fixedNow });
		const store = createStagedChangeReviewStore({ now: fixedNow });
		const modal = new StagedChangeReviewModal(new MockApp() as never, {
			store,
			loadReviewModel: () => service.createModel([]),
			applyReviewAction: async () => {
				throw new Error("No action should run.");
			},
			applySelectedChanges: async () => {
				throw new Error("No apply should run.");
			},
			isOnline: () => false,
		});

		modal.open();
		await flushPromises();

		expect(document.body.textContent).toContain("Review is offline");
		expect(document.body.textContent).toContain("No staged changes are waiting for review.");
		expect(document.body.querySelector<HTMLButtonElement>("[data-review-action='apply']")?.disabled).toBe(true);

		modal.close();
		expect(document.body.textContent).not.toContain("Staged changes");
		expect(store.getState().status).toBe("idle");
	});

	it("renders conflicts and requires destructive confirmation before apply", async () => {
		const service = new StagedChangeReviewService({ now: fixedNow });
		const store = createStagedChangeReviewStore({ now: fixedNow });
		let records = (await createStagedReviewFixtureRecords()).filter(
			(record) => record.status === "conflicted" || record.operationKind === "delete-note",
		);
		let appliedRequest: StagedReviewActionRequest | null = null;
		const modal = new StagedChangeReviewModal(new MockApp() as never, {
			store,
			loadReviewModel: () => service.createModel(records),
			applyReviewAction: async (request) => {
				const result = service.applyAction(records, request);
				records = [...result.records];
				return result;
			},
			applySelectedChanges: async (request) => {
				appliedRequest = request;
				const deleteRecord = records.find((record) => record.operationKind === "delete-note");
				if (deleteRecord === undefined) {
					throw new Error("Expected delete record.");
				}
				return {
					ok: true,
					planId: "synthetic-modal-plan",
					records: [deleteRecord],
					outcomes: [],
					auditEntries: [],
					recovery: [],
					indexRefresh: {
						attempted: false,
						ok: true,
						message: "Synthetic modal apply.",
						retryable: false,
						targetPaths: [deleteRecord.targetPath],
					},
				} satisfies StagedReviewApplyOutcome;
			},
			isOnline: () => true,
		});

		modal.open();
		await flushPromises();

		const conflictedGroup = [...document.body.querySelectorAll<HTMLButtonElement>("[data-group-id]")].find(
			(button) => button.textContent?.includes(STAGED_REVIEW_UPDATE_TARGET),
		);
		conflictedGroup?.click();
		expect(document.body.textContent).toContain("target-changed");
		const deleteGroup = [...document.body.querySelectorAll<HTMLButtonElement>("[data-group-id]")].find((button) =>
			button.textContent?.includes(STAGED_REVIEW_DELETE_TARGET),
		);
		deleteGroup?.click();
		expect(document.body.querySelector<HTMLButtonElement>("[data-review-action='apply']")?.disabled).toBe(true);

		const input = document.body.querySelector<HTMLInputElement>("[data-confirmation-input='true']");
		if (input === null) {
			throw new Error("Expected destructive confirmation input.");
		}
		input.value = `APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`;
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await clickAction("apply");

		expect(appliedRequest).toMatchObject({
			action: "apply",
			confirmationText: `APPLY DESTRUCTIVE ${STAGED_REVIEW_DELETE_TARGET}`,
		});
	});

	it("runs reject, retry, dismiss actions and resets state on close", async () => {
		const service = new StagedChangeReviewService({ now: fixedNow });
		const store = createStagedChangeReviewStore({ now: fixedNow });
		let records = (await createStagedReviewFixtureRecords()).filter(
			(record) => record.operationKind === "update-note" && record.status === "review-ready",
		);
		const modal = new StagedChangeReviewModal(new MockApp() as never, {
			store,
			loadReviewModel: () => service.createModel(records),
			applyReviewAction: async (request) => {
				const result = service.applyAction(records, request);
				records = [...result.records];
				return result;
			},
			applySelectedChanges: async () => {
				throw new Error("Apply is not part of this modal action test.");
			},
			isOnline: () => true,
		});

		modal.open();
		await flushPromises();
		expect(document.body.textContent).toContain(STAGED_REVIEW_UPDATE_TARGET);

		await clickAction("reject");
		expect(records[0]?.status).toBe("rejected");
		await clickAction("retry");
		expect(records[0]?.status).toBe("review-ready");
		await clickAction("dismiss");
		expect(records[0]?.status).toBe("dismissed");

		modal.close();
		expect(store.getState()).toMatchObject({
			status: "idle",
			selectedChangeIds: [],
			confirmationText: "",
		});
	});
});
