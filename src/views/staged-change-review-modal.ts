import { type App, Modal, Notice } from "obsidian";
import type { StagedChangeReviewStore } from "../stores/staged-change-review-store";
import type {
	StagedReviewAction,
	StagedReviewActionRequest,
	StagedReviewActionResult,
	StagedReviewApplyOutcome,
	StagedReviewGroup,
	StagedReviewModel,
	StagedReviewPreview,
	StagedReviewStoreState,
	StagedReviewStoreUnsubscribe,
} from "../types/staged-review";

export interface StagedChangeReviewModalOptions {
	readonly store: StagedChangeReviewStore;
	readonly loadReviewModel: () => StagedReviewModel;
	readonly applyReviewAction: (request: StagedReviewActionRequest) => Promise<StagedReviewActionResult>;
	readonly applySelectedChanges: (request: StagedReviewActionRequest) => Promise<StagedReviewApplyOutcome>;
	readonly isOnline?: () => boolean;
	readonly onNotice?: (message: string) => void;
}

export class StagedChangeReviewModal extends Modal {
	private unsubscribe: StagedReviewStoreUnsubscribe | null = null;
	private isClosed = true;
	private isBusy = false;

	public constructor(
		app: App,
		private readonly options: StagedChangeReviewModalOptions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.isClosed = false;
		this.unsubscribe = this.options.store.subscribe((state) => {
			this.render(state);
		});
		void this.reloadModel();
	}

	override onClose(): void {
		this.isClosed = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.isBusy = false;
		this.options.store.reset();
		this.contentEl.replaceChildren();
	}

	private async reloadModel(): Promise<void> {
		try {
			this.options.store.setLoading();
			this.options.store.setModel(this.options.loadReviewModel());
		} catch {
			this.options.store.setFailure("Staged-change review could not be loaded. No vault files were changed.");
			this.notice("Staged-change review could not be loaded. No vault files were changed.");
		}
	}

	private render(state: StagedReviewStoreState): void {
		if (this.isClosed) {
			return;
		}

		const root = document.createElement("section");
		root.className = "voidbrain-staged-review";
		root.setAttribute("aria-label", "Voidbrain staged-change review");
		root.append(this.createHeader(state), this.createBody(state), this.createActions(state));

		this.contentEl.replaceChildren(root);
		if (document.activeElement === document.body || document.activeElement === null) {
			this.contentEl.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
		}
	}

	private createHeader(state: StagedReviewStoreState): HTMLElement {
		const header = document.createElement("header");
		const title = document.createElement("h2");
		title.textContent = "Staged changes";
		const status = document.createElement("p");
		status.textContent = `Status: ${state.status}`;
		header.append(title, status);

		if (this.options.isOnline?.() === false) {
			const offline = document.createElement("p");
			offline.setAttribute("role", "status");
			offline.textContent = "Review is offline. No vault files can be changed.";
			header.append(offline);
		}

		return header;
	}

	private createBody(state: StagedReviewStoreState): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Staged-change review state");

		if (state.status === "loading") {
			const loading = document.createElement("p");
			loading.textContent = "Loading staged changes.";
			section.append(loading);
			return section;
		}

		if (state.failureMessage !== null) {
			const failure = document.createElement("p");
			failure.setAttribute("role", "alert");
			failure.textContent = state.failureMessage;
			section.append(failure);
		}

		if (state.model === null || state.model.groups.length === 0) {
			const empty = document.createElement("p");
			empty.textContent = "No staged changes are waiting for review.";
			section.append(empty);
			return section;
		}

		const groupNav = document.createElement("div");
		groupNav.setAttribute("role", "tablist");
		groupNav.setAttribute("aria-label", "Staged-change groups");
		for (const group of state.model.groups) {
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.groupId = group.groupId;
			button.setAttribute("role", "tab");
			button.setAttribute("aria-selected", String(group.groupId === state.selectedGroupId));
			button.textContent = `${group.key.operationKind} ${group.key.status} ${group.key.targetPath}`;
			button.disabled = this.isBusy;
			button.addEventListener("click", () => {
				this.options.store.selectGroup(group.groupId);
			});
			groupNav.append(button);
		}
		section.append(groupNav);

		const selectedGroup = this.selectedGroup(state);
		if (selectedGroup !== null) {
			section.append(
				this.createGroupSummary(selectedGroup),
				this.createPreviewList(selectedGroup),
				this.createConfirmation(state, selectedGroup),
			);
		}

		return section;
	}

	private createGroupSummary(group: StagedReviewGroup): HTMLElement {
		const summary = document.createElement("section");
		summary.setAttribute("aria-label", "Selected staged-change group");
		const heading = document.createElement("h3");
		heading.textContent = `${group.key.commandId} ${group.key.operationKind}`;
		const details = document.createElement("p");
		details.textContent = [
			`${group.summary.totalRecords} record(s)`,
			`${group.summary.conflictedRecords} conflict(s)`,
			`${group.summary.failedRecords} failed`,
			`${group.summary.destructiveRecords} destructive`,
		].join(" | ");
		summary.append(heading, details);
		return summary;
	}

	private createPreviewList(group: StagedReviewGroup): HTMLElement {
		const list = document.createElement("section");
		list.setAttribute("aria-label", "Staged-change previews");
		for (const preview of group.previews) {
			list.append(this.createPreview(preview));
		}
		return list;
	}

	private createPreview(preview: StagedReviewPreview): HTMLElement {
		const article = document.createElement("article");
		article.dataset.changeId = preview.changeId;

		const heading = document.createElement("h4");
		heading.textContent = `${preview.operationKind}: ${preview.targetPath}`;
		article.append(heading);

		if (preview.destinationPath !== undefined) {
			const destination = document.createElement("p");
			destination.textContent = `Destination: ${preview.destinationPath}`;
			article.append(destination);
		}

		const rationale = document.createElement("p");
		rationale.textContent = preview.rationale;
		article.append(rationale);

		if (preview.conflicts.length > 0) {
			const conflicts = document.createElement("ul");
			conflicts.setAttribute("aria-label", "Conflicts");
			for (const conflict of preview.conflicts) {
				const item = document.createElement("li");
				item.textContent = `${conflict.kind}: ${conflict.message}`;
				conflicts.append(item);
			}
			article.append(conflicts);
		}

		const diff = document.createElement("pre");
		diff.textContent =
			preview.diffLines.length === 0
				? (preview.afterPreview ?? preview.beforePreview ?? "")
				: preview.diffLines
						.map(
							(line) =>
								`${line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "} ${line.content}`,
						)
						.join("\n");
		article.append(diff);

		if (preview.backupPathIntent !== undefined) {
			const backup = document.createElement("p");
			backup.textContent = `Backup intent: ${preview.backupPathIntent}`;
			article.append(backup);
		}

		return article;
	}

	private createConfirmation(state: StagedReviewStoreState, group: StagedReviewGroup): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Apply confirmation");
		if (group.confirmation.requiredText === undefined) {
			const text = document.createElement("p");
			text.textContent = `Confirmation: ${group.confirmation.kind}`;
			section.append(text);
			return section;
		}

		const label = document.createElement("label");
		label.textContent = "Confirmation text";
		const input = document.createElement("input");
		input.type = "text";
		input.value = state.confirmationText;
		input.disabled = this.isBusy;
		input.dataset.confirmationInput = "true";
		input.setAttribute("aria-label", `Type ${group.confirmation.requiredText} to confirm`);
		input.addEventListener("input", () => {
			this.options.store.setConfirmationText(input.value);
		});
		label.append(input);

		const required = document.createElement("p");
		required.textContent = group.confirmation.requiredText;
		section.append(label, required);
		return section;
	}

	private createActions(state: StagedReviewStoreState): HTMLElement {
		const actions = document.createElement("div");
		actions.setAttribute("aria-label", "Staged-change actions");
		const selectedGroup = this.selectedGroup(state);
		const selectedChangeIds =
			state.selectedChangeIds.length > 0 ? state.selectedChangeIds : (selectedGroup?.changeIds ?? []);
		const disabled = this.isBusy || selectedChangeIds.length === 0 || this.options.isOnline?.() === false;
		const confirmation = selectedGroup?.confirmation;
		const applyDisabled =
			disabled ||
			(confirmation?.requiredText !== undefined && confirmation.requiredText !== state.confirmationText);

		actions.append(
			this.actionButton("Approve", "approve", disabled, () => this.handleAction("approve", selectedChangeIds)),
			this.actionButton("Apply", "apply", applyDisabled, () =>
				this.handleApply(selectedChangeIds, state.confirmationText),
			),
			this.actionButton("Reject", "reject", disabled, () => this.handleAction("reject", selectedChangeIds)),
			this.actionButton("Retry", "retry", disabled, () => this.handleAction("retry", selectedChangeIds)),
			this.actionButton("Dismiss", "dismiss", disabled, () => this.handleAction("dismiss", selectedChangeIds)),
			this.actionButton("Refresh", "refresh", this.isBusy, () => {
				void this.reloadModel();
			}),
		);
		return actions;
	}

	private actionButton(
		label: string,
		action: StagedReviewAction | "refresh",
		disabled: boolean,
		onClick: () => void,
	): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = this.isBusy && action !== "refresh" ? `${label}ing` : label;
		button.disabled = disabled;
		button.dataset.reviewAction = action;
		button.setAttribute("aria-label", `${label} staged changes`);
		button.addEventListener("click", onClick);
		return button;
	}

	private async handleAction(
		action: Exclude<StagedReviewAction, "apply">,
		changeIds: readonly string[],
	): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.options.store.setInFlight(action);
		try {
			const result = await this.options.applyReviewAction({ action, changeIds });
			this.options.store.applyActionResult(result);
			await this.reloadModel();
			this.notice(result.ok ? `Staged change ${action} completed.` : `Staged change ${action} failed.`);
		} catch {
			this.options.store.setFailure(`Staged change ${action} failed. No unconfirmed vault mutation occurred.`);
			this.notice(`Staged change ${action} failed. No unconfirmed vault mutation occurred.`);
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState());
		}
	}

	private async handleApply(changeIds: readonly string[], confirmationText: string): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.options.store.setInFlight("apply");
		try {
			const outcome = await this.options.applySelectedChanges({ action: "apply", changeIds, confirmationText });
			this.options.store.applyOutcome(outcome);
			await this.reloadModel();
			this.notice(outcome.ok ? "Staged changes applied." : "One or more staged changes failed during apply.");
		} catch {
			this.options.store.setFailure("Staged change apply failed. Recovery details remain in staged records.");
			this.notice("Staged change apply failed. Recovery details remain in staged records.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState());
		}
	}

	private selectedGroup(state: StagedReviewStoreState): StagedReviewGroup | null {
		return (
			state.model?.groups.find((group) => group.groupId === state.selectedGroupId) ??
			state.model?.groups[0] ??
			null
		);
	}

	private notice(message: string): void {
		if (this.options.onNotice !== undefined) {
			this.options.onNotice(message);
			return;
		}

		new Notice(message, 7000);
	}
}
