import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceIngestionIntakeService } from "../src/agent";
import { createIngestionQueueStore } from "../src/stores/ingestion-queue-store";
import { createIngestionStagingStore } from "../src/stores/ingestion-staging-store";
import {
	INGEST_SOURCE_COMMAND_ID,
	type SourceIngestionPreview,
	type SourceIngestionStageFailure,
	type SourceIngestionStageResult,
} from "../src/types/ingestion";
import { type StagedChangeRecord, makeIsoTimestamp } from "../src/types/vault";
import { SourceIngestionModal } from "../src/views/source-ingestion-modal";
import { App as MockApp, notices, resetObsidianMockState } from "./__mocks__/obsidian";
import {
	INGESTION_FIXTURE_MARKDOWN,
	INGESTION_FIXTURE_MARKDOWN_PATH,
	SAFE_MARKDOWN_SOURCE_INPUT,
} from "./fixtures/vault/source-ingestion-fixtures";
import {
	createQueueFixtureStagedChange,
	createQueueFixtureSummary,
} from "./fixtures/vault/source-ingestion-queue-fixtures";

const flushPromises = async (count = 200): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const waitForCondition = async (predicate: () => boolean, count = 1000): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		if (predicate()) {
			return;
		}
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

const stageSuccessFor = (preview: SourceIngestionPreview): SourceIngestionStageResult => {
	const stagedChange = {
		changeId: "stage-create-note-synthetic-source-ingestion-demo",
	} as StagedChangeRecord;

	return {
		ok: true,
		preview,
		providerDecision: {
			kind: "not-requested",
			allowed: false,
			providerId: null,
			modelId: null,
			code: null,
			userMessage: "Provider-assisted extraction was not requested.",
			attempts: [],
			diagnostic: {},
		},
		artifacts: [],
		stagedChanges: [stagedChange],
		validation: {
			ok: true,
			issues: [],
			checkedArtifactPaths: [preview.targetPaths.source],
		},
		recovery: {
			commandId: INGEST_SOURCE_COMMAND_ID,
			sourcePath: preview.sourcePath,
			contentSha256: preview.contentSha256,
			stagedChangeIds: [stagedChange.changeId],
			targetPaths: [preview.targetPaths.source],
			providerDecision: {
				kind: "not-requested",
				allowed: false,
				providerId: null,
				modelId: null,
				code: null,
				userMessage: "Provider-assisted extraction was not requested.",
				attempts: [],
				diagnostic: {},
			},
			validationOutput: [],
			retryGuidance: "Inspect staged changes before apply.",
			updatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
		},
	};
};

const getPathInput = (root: ParentNode): HTMLInputElement => {
	const input = root.querySelector<HTMLInputElement>("[data-source-field='path']");
	if (input === null) {
		throw new Error("Expected path input");
	}

	return input;
};

const getTitleInput = (root: ParentNode): HTMLInputElement => {
	const inputs = [...root.querySelectorAll<HTMLInputElement>("input[type='text']")];
	const input = inputs[1];
	if (input === undefined) {
		throw new Error("Expected title input");
	}

	return input;
};

const getButton = (root: ParentNode, text: string): HTMLButtonElement => {
	const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
		(candidate) => candidate.textContent === text,
	);
	if (button === undefined) {
		throw new Error(`Expected ${text} button`);
	}

	return button;
};

describe("SourceIngestionModal", () => {
	beforeEach(() => {
		resetObsidianMockState();
	});

	it("previews and stages a markdown source with focus behavior and no direct vault writes", async () => {
		const app = new MockApp();
		const intake = new SourceIngestionIntakeService({ now: fixedNow });
		const store = createIngestionStagingStore({ now: fixedNow });
		const modal = new SourceIngestionModal(app as unknown as App, {
			store,
			previewSource: (request) => intake.createPreview(request),
			stageSource: async () => {
				const preview = store.getState().preview;
				if (preview === null) {
					throw new Error("Expected preview before staging");
				}

				return stageSuccessFor(preview);
			},
			readSourcePath: async () => INGESTION_FIXTURE_MARKDOWN,
		});

		modal.open();
		const pathInput = getPathInput(modal.contentEl);
		expect(document.activeElement).toBe(pathInput);
		pathInput.value = INGESTION_FIXTURE_MARKDOWN_PATH;
		pathInput.dispatchEvent(new Event("input", { bubbles: true }));
		modal.contentEl.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await waitForCondition(() => store.getState().status === "ready");

		expect(store.getState().status).toBe("ready");
		expect(modal.contentEl.textContent).toContain("Synthetic Source Ingestion Demo");

		getButton(modal.contentEl, "Stage").click();
		await waitForCondition(() => store.getState().status === "staged");

		expect(store.getState().status).toBe("staged");
		expect(store.getState().stagedChangeIds.length).toBeGreaterThan(0);
		expect(notices.some((notice) => notice.message.includes("staged"))).toBe(true);
		expect(app.vault.adapter.write).not.toHaveBeenCalled();

		modal.close();
		expect(modal.contentEl.childElementCount).toBe(0);
	});

	it("shows denied URL approval and retryable provider failures without applying notes", async () => {
		const app = new MockApp();
		const intake = new SourceIngestionIntakeService({ now: fixedNow });
		const store = createIngestionStagingStore({ now: fixedNow });
		const providerDenied: SourceIngestionStageFailure = {
			ok: false,
			code: "ingestion.provider-denied",
			message: "Provider role is not selected.",
			retryable: true,
			stagedChangeIds: [],
			targetPaths: [],
			providerDecision: {
				kind: "denied",
				allowed: false,
				providerId: null,
				modelId: null,
				code: "role-not-selected",
				userMessage: "Provider role is not selected.",
				attempts: [],
				diagnostic: {},
			},
			validationOutput: [],
		};
		const stageSource = vi.fn(async () => providerDenied);
		const modal = new SourceIngestionModal(app as unknown as App, {
			store,
			previewSource: (request) => intake.createPreview(request),
			stageSource,
			readSourcePath: async () => SAFE_MARKDOWN_SOURCE_INPUT.content ?? "",
		});

		modal.open();
		const select = modal.contentEl.querySelector<HTMLSelectElement>("select");
		if (select === null) {
			throw new Error("Expected source type select");
		}
		select.value = "url-record";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		getPathInput(modal.contentEl).value = "https://example.test/source";
		getPathInput(modal.contentEl).dispatchEvent(new Event("input", { bubbles: true }));
		getTitleInput(modal.contentEl).value = "Synthetic URL Source";
		getTitleInput(modal.contentEl).dispatchEvent(new Event("input", { bubbles: true }));
		const textarea = modal.contentEl.querySelector<HTMLTextAreaElement>("textarea");
		if (textarea === null) {
			throw new Error("Expected content textarea");
		}
		textarea.value = "Synthetic URL content.";
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
		modal.contentEl.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await flushPromises();

		expect(store.getState().status).toBe("failed");
		expect(modal.contentEl.textContent).toContain("Source preview failed");

		const checkbox = modal.contentEl.querySelector<HTMLInputElement>("input[type='checkbox']");
		if (checkbox === null) {
			throw new Error("Expected approval checkbox");
		}
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		modal.contentEl.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await waitForCondition(() => store.getState().status === "ready");
		await waitForCondition(() => !getButton(modal.contentEl, "Stage").disabled);
		getButton(modal.contentEl, "Stage").click();
		await waitForCondition(() => stageSource.mock.calls.length === 1);

		expect(stageSource).toHaveBeenCalledTimes(1);
		expect(store.getState()).toMatchObject({
			status: "failed",
			failure: {
				message: "Provider role is not selected.",
			},
		});
		expect(modal.contentEl.textContent).toContain("Provider role is not selected.");
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});

	it("queues batch input, renders queue progress, and keeps writes staged", async () => {
		const app = new MockApp();
		const intake = new SourceIngestionIntakeService({ now: fixedNow });
		const store = createIngestionStagingStore({ now: fixedNow });
		const queueStore = createIngestionQueueStore({ now: fixedNow });
		const runQueue = vi.fn(async () => ({
			summary: createQueueFixtureSummary(),
			stagedChanges: [createQueueFixtureStagedChange("stage-queue-safe")],
		}));
		const cancelQueue = vi.fn(() => ({
			ok: true,
			queueId: "queue-fixture",
			canceledItemIds: [],
			runningItemIds: [],
			message: "Source ingestion queue queue-fixture cancellation was requested.",
		}));
		const modal = new SourceIngestionModal(app as unknown as App, {
			store,
			queueStore,
			previewSource: (request) => intake.createPreview(request),
			stageSource: async () => {
				const preview = store.getState().preview;
				if (preview === null) {
					throw new Error("Expected preview before staging");
				}

				return stageSuccessFor(preview);
			},
			runQueue,
			cancelQueue,
			readSourcePath: async () => INGESTION_FIXTURE_MARKDOWN,
		});

		modal.open();
		const pathInput = getPathInput(modal.contentEl);
		pathInput.value = INGESTION_FIXTURE_MARKDOWN_PATH;
		pathInput.dispatchEvent(new Event("input", { bubbles: true }));
		getButton(modal.contentEl, "Add to queue").click();
		await waitForCondition(() => queueStore.getState().draftItemCount === 1);

		expect(modal.contentEl.textContent).toContain("Queued drafts: 1");
		getButton(modal.contentEl, "Run queue").click();
		await waitForCondition(() => queueStore.getState().summary !== null);

		expect(runQueue).toHaveBeenCalledTimes(1);
		expect(queueStore.getState().summary?.queueId).toBe("queue-fixture");
		expect(modal.contentEl.textContent).toContain("Queue queue-fixture");
		expect(modal.contentEl.textContent).toContain("stage-queue-safe");
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});
});
