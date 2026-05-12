import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { RuntimeStatusSubscriber, RuntimeStatusUnsubscribe } from "../stores/runtime-status-store";
import type { RuntimeStatusSnapshot } from "../types/runtime";

export const VOIDBRAIN_STATUS_VIEW_TYPE = "voidbrain-status";
export const VOIDBRAIN_STATUS_VIEW_DISPLAY_TEXT = "Voidbrain status";

export interface StatusViewOwnershipNote {
	readonly owner: "src/main.ts";
	readonly viewType: typeof VOIDBRAIN_STATUS_VIEW_TYPE;
	readonly responsibility: string;
}

export const STATUS_VIEW_OWNERSHIP: StatusViewOwnershipNote = {
	owner: "src/main.ts",
	viewType: VOIDBRAIN_STATUS_VIEW_TYPE,
	responsibility:
		"src/main.ts owns Obsidian view registration and cleanup; this module owns only status view rendering.",
};

export type StatusViewFactory = (leaf: WorkspaceLeaf) => ItemView;

export interface VoidbrainStatusViewOptions {
	readonly getSnapshot: () => RuntimeStatusSnapshot;
	readonly isOnline?: () => boolean;
	readonly onRefresh?: () => void;
	readonly subscribe?: (subscriber: RuntimeStatusSubscriber) => RuntimeStatusUnsubscribe;
}

export class VoidbrainStatusView extends ItemView {
	override icon = "brain-circuit";
	private unsubscribeFromStatus: RuntimeStatusUnsubscribe | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly options: VoidbrainStatusViewOptions,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VOIDBRAIN_STATUS_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return VOIDBRAIN_STATUS_VIEW_DISPLAY_TEXT;
	}

	protected override async onOpen(): Promise<void> {
		this.renderLoading();
		if (this.options.subscribe === undefined) {
			this.renderSnapshot();
			return;
		}

		this.unsubscribeFromStatus = this.options.subscribe((snapshot) => {
			this.renderSnapshotValue(snapshot);
		});
	}

	protected override async onClose(): Promise<void> {
		this.unsubscribeFromStatus?.();
		this.unsubscribeFromStatus = null;
		this.contentEl.replaceChildren();
	}

	private renderLoading(): void {
		this.contentEl.replaceChildren();
		const root = document.createElement("section");
		root.className = "voidbrain-status-view voidbrain-status-view--loading";
		root.setAttribute("aria-busy", "true");
		root.setAttribute("role", "status");
		root.textContent = "Loading Voidbrain status.";
		this.contentEl.append(root);
	}

	private renderSnapshot(): void {
		try {
			if (this.options.isOnline?.() === false) {
				this.contentEl.replaceChildren(this.createStateElement("offline", "Voidbrain runtime is offline."));
				return;
			}

			const snapshot = this.options.getSnapshot();
			this.renderSnapshotValue(snapshot);
		} catch {
			this.contentEl.replaceChildren(this.createStateElement("error", "Status could not be loaded."));
		}
	}

	private renderSnapshotValue(snapshot: RuntimeStatusSnapshot): void {
		if (this.options.isOnline?.() === false) {
			this.contentEl.replaceChildren(this.createStateElement("offline", "Voidbrain runtime is offline."));
			return;
		}

		this.contentEl.replaceChildren(this.createSnapshotElement(snapshot));
	}

	private createSnapshotElement(snapshot: RuntimeStatusSnapshot): HTMLElement {
		if (snapshot.items.length === 0) {
			return this.createStateElement("empty", "No status sections are enabled.");
		}

		const root = document.createElement("section");
		root.className = "voidbrain-status-view";
		root.setAttribute("aria-label", "Voidbrain runtime readiness");

		const header = document.createElement("div");
		header.className = "voidbrain-status-view__header";

		const title = document.createElement("h2");
		title.textContent = "Runtime status";

		const refreshButton = document.createElement("button");
		refreshButton.className = "voidbrain-status-view__refresh";
		refreshButton.type = "button";
		refreshButton.textContent = "Refresh";
		refreshButton.addEventListener("click", () => {
			this.options.onRefresh?.();
			this.renderSnapshot();
		});

		header.append(title, refreshButton);
		root.append(header);

		const list = document.createElement("div");
		list.className = "voidbrain-status-view__list";
		for (const item of snapshot.items) {
			const article = document.createElement("article");
			article.className = `voidbrain-status-card voidbrain-status-card--${item.severity}`;
			article.setAttribute("aria-label", `${item.label}: ${item.severity}`);

			const label = document.createElement("h3");
			label.textContent = item.label;

			const meta = document.createElement("p");
			meta.className = "voidbrain-status-card__meta";
			meta.textContent =
				item.count === undefined
					? `Severity: ${item.severity}.`
					: `Severity: ${item.severity}; count: ${item.count}.`;

			const summary = document.createElement("p");
			summary.textContent = item.summary;

			const details = document.createElement("ul");
			details.className = "voidbrain-status-card__details";
			for (const detail of item.details.length === 0 ? ["No details reported."] : item.details) {
				const detailItem = document.createElement("li");
				detailItem.textContent = detail;
				details.append(detailItem);
			}

			article.append(label, meta, summary, details);
			if (item.paths.length > 0) {
				article.append(this.createPathList(item.paths));
			}
			list.append(article);
		}

		root.append(list);
		return root;
	}

	private createStateElement(state: "empty" | "error" | "offline", message: string): HTMLElement {
		const root = document.createElement("section");
		root.className = `voidbrain-status-view voidbrain-status-view--${state}`;
		root.setAttribute("role", state === "error" ? "alert" : "status");
		root.textContent = message;
		return root;
	}

	private createPathList(paths: readonly string[]): HTMLElement {
		const section = document.createElement("section");
		section.className = "voidbrain-status-card__paths";
		section.setAttribute("aria-label", "Sampled vault paths");

		const title = document.createElement("h4");
		title.textContent = "Paths";

		const list = document.createElement("ul");
		for (const path of paths) {
			const item = document.createElement("li");
			item.textContent = path;
			list.append(item);
		}

		section.append(title, list);
		return section;
	}
}
