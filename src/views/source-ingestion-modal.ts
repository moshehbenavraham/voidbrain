import { type App, Modal, Notice } from "obsidian";
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
import type { StagedChangeRecord, ValidationIssue, ValidationResult } from "../types/vault";

export interface SourceIngestionModalOptions {
	readonly store: IngestionStagingStore;
	readonly previewSource: (
		request: SourceIngestionIntakeRequest,
	) => Promise<ValidationResult<SourceIngestionPreview>>;
	readonly stageSource: (request: SourceIngestionIntakeRequest) => Promise<SourceIngestionStageResult>;
	readonly readSourcePath: (path: string) => Promise<string>;
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
	private unsubscribe: SourceIngestionStoreUnsubscribe | null = null;
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
			this.render(state);
		});
	}

	override onClose(): void {
		this.isClosed = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.contentEl.replaceChildren();
	}

	private render(state: SourceIngestionStoreState): void {
		if (this.isClosed) {
			return;
		}

		const root = document.createElement("section");
		root.className = "voidbrain-source-ingestion";
		root.setAttribute("aria-label", "Voidbrain source ingestion staging");
		root.append(
			this.createHeader(state),
			this.createForm(state),
			this.createStatus(state),
			this.createActions(state),
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
			this.render(state);
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

		form.append(typeLabel, pathLabel, titleLabel, contentLabel, approvedLabel, previewButton);
		return form;
	}

	private createStatus(state: SourceIngestionStoreState): HTMLElement {
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

		return section;
	}

	private createActions(state: SourceIngestionStoreState): HTMLElement {
		const actions = document.createElement("div");
		const stageButton = document.createElement("button");
		stageButton.type = "button";
		stageButton.textContent = this.isBusy && state.status === "staging" ? "Staging" : "Stage";
		stageButton.disabled = this.isBusy || (state.preview === null && this.activeRequest === null);
		stageButton.setAttribute("aria-label", "Stage generated source notes");
		stageButton.addEventListener("click", () => {
			void this.handleStage();
		});

		const retryButton = document.createElement("button");
		retryButton.type = "button";
		retryButton.textContent = "Retry";
		retryButton.disabled = this.isBusy || this.activeRequest === null;
		retryButton.setAttribute("aria-label", "Retry source ingestion staging");
		retryButton.addEventListener("click", () => {
			void this.handleStage();
		});

		actions.append(stageButton, retryButton);
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
			this.render(this.options.store.getState());
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
			this.render(this.options.store.getState());
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
