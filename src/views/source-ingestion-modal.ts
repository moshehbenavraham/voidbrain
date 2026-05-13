import { type App, Modal, Notice } from "obsidian";
import type { IngestionQueueStore } from "../stores/ingestion-queue-store";
import type { IngestionStagingStore } from "../stores/ingestion-staging-store";
import type {
	SourceIngestionInput,
	SourceIngestionIntakeRequest,
	SourceIngestionPreview,
	SourceIngestionStageFailure,
	SourceIngestionStageResult,
	SourceIngestionStoreState,
	SourceIngestionStoreUnsubscribe,
} from "../types/ingestion";
import type {
	SourceIngestionQueueCancelResult,
	SourceIngestionQueueRunInput,
	SourceIngestionQueueRunResult,
	SourceIngestionQueueStoreState,
} from "../types/ingestion-queue";
import type { StagedChangeRecord, ValidationIssue, ValidationResult } from "../types/vault";

export interface SourceIngestionModalOptions {
	readonly store: IngestionStagingStore;
	readonly previewSource: (
		request: SourceIngestionIntakeRequest,
	) => Promise<ValidationResult<SourceIngestionPreview>>;
	readonly stageSource: (request: SourceIngestionIntakeRequest) => Promise<SourceIngestionStageResult>;
	readonly readSourcePath: (path: string) => Promise<string>;
	readonly queueStore?: IngestionQueueStore;
	readonly runQueue?: (input: SourceIngestionQueueRunInput) => Promise<SourceIngestionQueueRunResult>;
	readonly cancelQueue?: (queueId: string) => SourceIngestionQueueCancelResult;
	readonly getExistingNotes?: () => SourceIngestionIntakeRequest["existingNotes"];
	readonly getExistingStagedChanges?: () => readonly StagedChangeRecord[];
	readonly onNotice?: (message: string) => void;
}

interface DraftState {
	kind: SourceIngestionInput["kind"];
	path: string;
	title: string;
	content: string;
	approved: boolean;
}

const emptyDraft = (): DraftState => ({
	kind: "markdown-file",
	path: "",
	title: "",
	content: "",
	approved: false,
});

const providerDecision = {
	kind: "not-requested" as const,
	allowed: false,
	providerId: null,
	modelId: null,
	code: null,
	userMessage: "Provider-assisted extraction was not requested.",
	attempts: [],
	diagnostic: { mode: "none" },
};

const failureFromValidation = (
	message: string,
	validationOutput: readonly ValidationIssue[],
): SourceIngestionStageFailure => ({
	ok: false,
	code: "ingestion.input-invalid",
	message,
	retryable: true,
	stagedChangeIds: [],
	targetPaths: [],
	providerDecision,
	validationOutput,
});

export class SourceIngestionModal extends Modal {
	private draft = emptyDraft();
	private activeRequest: SourceIngestionIntakeRequest | null = null;
	private readonly queueRequests: SourceIngestionIntakeRequest[] = [];
	private readonly retryRequestsByItemId = new Map<string, SourceIngestionIntakeRequest>();
	private unsubscribe: SourceIngestionStoreUnsubscribe | null = null;
	private unsubscribeQueue: SourceIngestionStoreUnsubscribe | null = null;
	private queueState: SourceIngestionQueueStoreState | null = null;
	private isBusy = false;
	private isClosed = true;

	public constructor(
		app: App,
		private readonly options: SourceIngestionModalOptions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.isClosed = false;
		this.unsubscribe = this.options.store.subscribe((state) => {
			this.render(state, this.queueState);
		});
		this.unsubscribeQueue =
			this.options.queueStore?.subscribe((state) => {
				this.queueState = state;
				this.render(this.options.store.getState(), state);
			}) ?? null;
	}

	override onClose(): void {
		this.isClosed = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.unsubscribeQueue?.();
		this.unsubscribeQueue = null;
		this.contentEl.replaceChildren();
	}

	private render(state: SourceIngestionStoreState, queueState: SourceIngestionQueueStoreState | null): void {
		if (this.isClosed) {
			return;
		}

		const root = document.createElement("section");
		root.className = "voidbrain-source-ingestion";
		root.setAttribute("aria-label", "Voidbrain source ingestion staging");
		root.append(
			this.createHeader(state),
			this.createForm(state),
			this.createStatus(state, queueState),
			this.createActions(state, queueState),
		);

		this.contentEl.replaceChildren(root);
		const primaryInput = this.contentEl.querySelector<HTMLInputElement>("[data-source-field='path']");
		if (document.activeElement === document.body || document.activeElement === null) {
			primaryInput?.focus();
		}
	}

	private createHeader(state: SourceIngestionStoreState): HTMLElement {
		const header = document.createElement("header");
		const title = document.createElement("h2");
		title.textContent = "Ingest source";
		const status = document.createElement("p");
		status.textContent = `Status: ${state.status}`;
		header.append(title, status);
		return header;
	}

	private createForm(state: SourceIngestionStoreState): HTMLElement {
		const form = document.createElement("form");
		form.setAttribute("aria-label", "Source ingestion input");
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.handlePreview();
		});

		const typeLabel = document.createElement("label");
		typeLabel.textContent = "Source type";
		const typeSelect = document.createElement("select");
		typeSelect.setAttribute("aria-label", "Source type");
		for (const [value, label] of [
			["markdown-file", "Markdown file"],
			["text-file", "Text file"],
			["pasted-content", "Pasted content"],
			["url-record", "URL record"],
		] as const) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			typeSelect.append(option);
		}
		typeSelect.value = this.draft.kind;
		typeSelect.disabled = this.isBusy;
		typeSelect.addEventListener("change", () => {
			this.draft = {
				...this.draft,
				kind: typeSelect.value as SourceIngestionInput["kind"],
			};
			this.render(state, this.queueState);
		});
		typeLabel.append(typeSelect);

		const pathLabel = document.createElement("label");
		pathLabel.textContent = this.draft.kind === "url-record" ? "Source URL" : "Source path";
		const pathInput = document.createElement("input");
		pathInput.type = "text";
		pathInput.value = this.draft.path;
		pathInput.disabled = this.isBusy;
		pathInput.dataset.sourceField = "path";
		pathInput.setAttribute("aria-label", pathLabel.textContent);
		pathInput.addEventListener("input", () => {
			this.draft = { ...this.draft, path: pathInput.value };
		});
		pathLabel.append(pathInput);

		const titleLabel = document.createElement("label");
		titleLabel.textContent = "Title";
		const titleInput = document.createElement("input");
		titleInput.type = "text";
		titleInput.value = this.draft.title;
		titleInput.disabled = this.isBusy;
		titleInput.setAttribute("aria-label", "Source title");
		titleInput.addEventListener("input", () => {
			this.draft = { ...this.draft, title: titleInput.value };
		});
		titleLabel.append(titleInput);

		const contentLabel = document.createElement("label");
		contentLabel.textContent = "Content";
		const contentInput = document.createElement("textarea");
		contentInput.value = this.draft.content;
		contentInput.disabled = this.isBusy || this.draft.kind === "markdown-file" || this.draft.kind === "text-file";
		contentInput.setAttribute("aria-label", "Source content");
		contentInput.addEventListener("input", () => {
			this.draft = { ...this.draft, content: contentInput.value };
		});
		contentLabel.append(contentInput);

		const approvedLabel = document.createElement("label");
		const approvedInput = document.createElement("input");
		approvedInput.type = "checkbox";
		approvedInput.checked = this.draft.approved;
		approvedInput.disabled = this.isBusy || this.draft.kind !== "url-record";
		approvedInput.setAttribute("aria-label", "URL source record is approved");
		approvedInput.addEventListener("change", () => {
			this.draft = { ...this.draft, approved: approvedInput.checked };
		});
		approvedLabel.append(approvedInput, " Approved URL source record");

		const previewButton = document.createElement("button");
		previewButton.type = "submit";
		previewButton.textContent = this.isBusy && state.status === "previewing" ? "Previewing" : "Preview";
		previewButton.disabled = this.isBusy;

		const addQueueButton = document.createElement("button");
		addQueueButton.type = "button";
		addQueueButton.textContent = "Add to queue";
		addQueueButton.disabled = this.isBusy || this.options.queueStore === undefined;
		addQueueButton.setAttribute("aria-label", "Add source to batch queue");
		addQueueButton.addEventListener("click", () => {
			void this.handleAddToQueue();
		});

		form.append(typeLabel, pathLabel, titleLabel, contentLabel, approvedLabel, previewButton, addQueueButton);
		return form;
	}

	private createStatus(
		state: SourceIngestionStoreState,
		queueState: SourceIngestionQueueStoreState | null,
	): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Source ingestion status");
		if (state.preview !== null) {
			const preview = document.createElement("div");
			preview.className = "voidbrain-source-ingestion__preview";
			preview.textContent = [
				`Preview: ${state.preview.title}`,
				`Source: ${state.preview.sourcePath}`,
				`Duplicate: ${state.preview.duplicateStatus.kind}`,
				`Targets: ${[
					state.preview.targetPaths.source,
					...state.preview.targetPaths.entities,
					...state.preview.targetPaths.concepts,
					state.preview.targetPaths.summary,
				].join(", ")}`,
			].join(" | ");
			section.append(preview);
		}

		if (state.failure !== null) {
			const failure = document.createElement("p");
			failure.setAttribute("role", "alert");
			failure.textContent = state.failure.message;
			section.append(failure);
		}

		if (state.stagedChangeIds.length > 0) {
			const staged = document.createElement("p");
			staged.textContent = `Staged changes: ${state.stagedChangeIds.join(", ")}`;
			section.append(staged);
		}

		if (queueState !== null) {
			section.append(this.createQueueStatus(queueState));
		}

		return section;
	}

	private createQueueStatus(queueState: SourceIngestionQueueStoreState): HTMLElement {
		const queue = document.createElement("section");
		queue.setAttribute("aria-label", "Batch source ingestion queue status");
		const heading = document.createElement("h3");
		heading.textContent = "Batch queue";
		const summary = document.createElement("p");
		const queueSummary = queueState.summary;
		summary.textContent =
			queueSummary === null
				? `Queued drafts: ${this.queueRequests.length || queueState.draftItemCount}. Status: ${queueState.status}.`
				: `Queue ${queueSummary.queueId}: ${queueSummary.counts.staged} staged, ${queueSummary.counts.failed} failed, ${queueSummary.counts.canceled} canceled, ${queueSummary.counts.skipped} skipped.`;
		queue.append(heading, summary);

		if (queueState.lastFailureMessage !== null) {
			const failure = document.createElement("p");
			failure.setAttribute("role", "alert");
			failure.textContent = queueState.lastFailureMessage;
			queue.append(failure);
		}

		if (queueSummary !== null) {
			const list = document.createElement("ul");
			for (const item of queueSummary.items.slice(0, 6)) {
				const row = document.createElement("li");
				row.textContent = `${item.status}: ${item.sourcePath ?? item.title ?? item.itemId}${item.stagedChangeIds.length === 0 ? "" : ` (${item.stagedChangeIds.join(", ")})`}`;
				list.append(row);
			}
			queue.append(list);
		}

		return queue;
	}

	private createActions(
		state: SourceIngestionStoreState,
		queueState: SourceIngestionQueueStoreState | null,
	): HTMLElement {
		const actions = document.createElement("div");
		const stageButton = document.createElement("button");
		stageButton.type = "button";
		stageButton.textContent = this.isBusy && state.status === "staging" ? "Staging" : "Stage";
		stageButton.disabled = this.isBusy || (state.preview === null && this.activeRequest === null);
		stageButton.setAttribute("aria-label", "Stage generated source notes");
		stageButton.addEventListener("click", () => {
			void this.handleStage();
		});

		const runQueueButton = document.createElement("button");
		runQueueButton.type = "button";
		runQueueButton.textContent = this.isBusy && queueState?.status === "running" ? "Running queue" : "Run queue";
		runQueueButton.disabled = this.isBusy || this.options.runQueue === undefined;
		runQueueButton.setAttribute("aria-label", "Run batch source ingestion queue");
		runQueueButton.addEventListener("click", () => {
			void this.handleRunQueue();
		});

		const cancelQueueButton = document.createElement("button");
		cancelQueueButton.type = "button";
		cancelQueueButton.textContent = "Cancel queue";
		cancelQueueButton.disabled =
			this.options.cancelQueue === undefined ||
			queueState?.summary === null ||
			queueState?.summary === undefined ||
			(queueState.summary.status !== "running" && queueState.summary.status !== "canceling");
		cancelQueueButton.setAttribute("aria-label", "Cancel batch source ingestion queue");
		cancelQueueButton.addEventListener("click", () => {
			void this.handleCancelQueue();
		});

		const retryQueueButton = document.createElement("button");
		retryQueueButton.type = "button";
		retryQueueButton.textContent = "Retry queue";
		retryQueueButton.disabled =
			this.isBusy ||
			this.options.runQueue === undefined ||
			queueState?.summary === null ||
			queueState?.summary === undefined ||
			queueState.summary.items.every((item) => !item.retryable);
		retryQueueButton.setAttribute("aria-label", "Retry failed or canceled source ingestion queue items");
		retryQueueButton.addEventListener("click", () => {
			void this.handleRetryQueue();
		});

		const retryButton = document.createElement("button");
		retryButton.type = "button";
		retryButton.textContent = "Retry";
		retryButton.disabled = this.isBusy || this.activeRequest === null;
		retryButton.setAttribute("aria-label", "Retry source ingestion staging");
		retryButton.addEventListener("click", () => {
			void this.handleStage();
		});

		actions.append(stageButton, retryButton, runQueueButton, cancelQueueButton, retryQueueButton);
		return actions;
	}

	private async buildRequest(): Promise<SourceIngestionIntakeRequest> {
		const existingNotes = this.options.getExistingNotes?.();
		const existingStagedChanges = this.options.getExistingStagedChanges?.();
		const base = {
			...(existingNotes === undefined ? {} : { existingNotes }),
			...(existingStagedChanges === undefined ? {} : { existingStagedChanges }),
		};

		if (this.draft.kind === "markdown-file" || this.draft.kind === "text-file") {
			const content = await this.options.readSourcePath(this.draft.path);
			return {
				...base,
				input: {
					kind: this.draft.kind,
					path: this.draft.path,
					content,
					...(this.draft.title.trim().length === 0 ? {} : { title: this.draft.title }),
				},
			};
		}

		if (this.draft.kind === "url-record") {
			return {
				...base,
				input: {
					kind: "url-record",
					sourceUrl: this.draft.path,
					title: this.draft.title,
					content: this.draft.content,
					approved: this.draft.approved,
				},
			};
		}

		return {
			...base,
			input: {
				kind: "pasted-content",
				title: this.draft.title,
				content: this.draft.content,
			},
		};
	}

	private async handlePreview(): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		try {
			await this.options.store.setPreviewing();
			const request = await this.buildRequest();
			const preview = await this.options.previewSource(request);
			if (!preview.ok) {
				await this.options.store.setFailure(failureFromValidation("Source preview failed.", preview.errors));
				this.notice("Source preview failed. No vault files were changed.");
				return;
			}

			this.activeRequest = request;
			await this.options.store.setPreview(preview.value);
		} catch {
			await this.options.store.setFailure(failureFromValidation("Source preview failed before staging.", []));
			this.notice("Source preview failed before staging. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState(), this.queueState);
		}
	}

	private async handleStage(): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		try {
			const request = this.activeRequest ?? (await this.buildRequest());
			this.activeRequest = request;
			await this.options.store.setStaging();
			const result = await this.options.stageSource(request);
			await this.options.store.applyStageResult(result);
			this.notice(
				result.ok
					? `Source ingestion staged ${result.stagedChanges.length} change(s).`
					: `${result.message} No vault files were changed.`,
			);
		} catch {
			await this.options.store.setFailure(failureFromValidation("Source staging failed before completion.", []));
			this.notice("Source staging failed before completion. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState(), this.queueState);
		}
	}

	private async handleAddToQueue(): Promise<void> {
		if (this.isBusy || this.options.queueStore === undefined) {
			return;
		}

		this.isBusy = true;
		try {
			const request = await this.buildRequest();
			this.queueRequests.push(request);
			await this.options.queueStore.setDraftItemCount(this.queueRequests.length);
			this.notice(`Added source ${this.queueRequests.length} to the batch queue.`);
		} catch {
			await this.options.queueStore.setFailure("Source could not be added to the batch queue.");
			this.notice("Source could not be added to the batch queue. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState(), this.queueState);
		}
	}

	private async handleRunQueue(requests?: readonly SourceIngestionIntakeRequest[]): Promise<void> {
		if (this.isBusy || this.options.runQueue === undefined || this.options.queueStore === undefined) {
			return;
		}

		this.isBusy = true;
		const queueRequests = [...(requests ?? this.queueRequests)];
		try {
			if (queueRequests.length === 0) {
				queueRequests.push(this.activeRequest ?? (await this.buildRequest()));
			}
			await this.options.queueStore.beginRun();
			const result = await this.options.runQueue({
				items: queueRequests,
				onUpdate: (summary) => {
					this.cacheRetryRequests(summary, queueRequests);
					void this.options.queueStore?.applySummary(summary);
				},
			});
			this.cacheRetryRequests(result.summary, queueRequests);
			await this.options.queueStore.applySummary(result.summary);
			this.queueRequests.splice(0, this.queueRequests.length);
			this.notice(
				`Source ingestion queue ${result.summary.status}: ${result.summary.counts.staged} staged, ${result.summary.counts.failed} failed, ${result.summary.counts.canceled} canceled.`,
			);
		} catch {
			await this.options.queueStore.setFailure("Source ingestion queue failed before completion.");
			this.notice("Source ingestion queue failed before completion. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState(), this.queueState);
		}
	}

	private async handleCancelQueue(): Promise<void> {
		const queueId = this.queueState?.summary?.queueId;
		if (queueId === undefined || this.options.cancelQueue === undefined || this.options.queueStore === undefined) {
			return;
		}

		await this.options.queueStore.requestCancel();
		const result = this.options.cancelQueue(queueId);
		this.notice(result.message);
	}

	private async handleRetryQueue(): Promise<void> {
		const retryableItems = this.queueState?.summary?.items.filter((item) => item.retryable) ?? [];
		const requests = retryableItems.flatMap((item) => {
			const request = this.retryRequestsByItemId.get(item.itemId);
			return request === undefined ? [] : [request];
		});
		if (requests.length === 0) {
			this.notice("No retryable queue items are available in this modal session.");
			return;
		}

		await this.handleRunQueue(requests);
	}

	private cacheRetryRequests(
		summary: SourceIngestionQueueRunResult["summary"],
		requests: readonly SourceIngestionIntakeRequest[],
	): void {
		for (const item of summary.items) {
			const request = requests[item.index];
			if (request !== undefined) {
				this.retryRequestsByItemId.set(item.itemId, request);
			}
		}
	}

	private notice(message: string): void {
		if (this.options.onNotice !== undefined) {
			this.options.onNotice(message);
			return;
		}

		new Notice(message, 7000);
	}
}
