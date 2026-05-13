import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { GroundedVaultChatAskResult } from "../agent";
import type {
	ChatActionResult,
	ChatContextChip,
	ChatQuestionInput,
	ChatRetrievalPreviewItem,
	ChatThreadState,
	ChatThreadSubscriber,
	ChatThreadUnsubscribe,
	ChatTurn,
} from "../types/chat";
import { makeChatContextChipId } from "../types/chat";
import type { HotCacheSessionSummaryResult } from "../types/hot-cache";
import type { NormalizedVaultPath } from "../types/vault";

export const VOIDBRAIN_CHAT_VIEW_TYPE = "voidbrain-chat";
export const VOIDBRAIN_CHAT_VIEW_DISPLAY_TEXT = "Voidbrain chat";

export interface ChatViewOwnershipNote {
	readonly owner: "src/main.ts";
	readonly viewType: typeof VOIDBRAIN_CHAT_VIEW_TYPE;
	readonly responsibility: string;
}

export const CHAT_VIEW_OWNERSHIP: ChatViewOwnershipNote = {
	owner: "src/main.ts",
	viewType: VOIDBRAIN_CHAT_VIEW_TYPE,
	responsibility:
		"src/main.ts owns Obsidian chat view registration, service wiring, and cleanup; this module owns rendering and local interactions.",
};

export interface VoidbrainChatViewOptions {
	readonly getState: () => ChatThreadState;
	readonly subscribe?: (subscriber: ChatThreadSubscriber) => ChatThreadUnsubscribe;
	readonly ask: (input: ChatQuestionInput) => Promise<GroundedVaultChatAskResult>;
	readonly applyActionResult: (result: ChatActionResult) => Promise<ChatActionResult>;
	readonly setDraft: (text: string, contextChips?: readonly ChatContextChip[]) => Promise<ChatActionResult>;
	readonly retryTurn: (turnId: ChatTurn["id"]) => Promise<ChatActionResult>;
	readonly branchFromTurn: (turnId: ChatTurn["id"]) => Promise<ChatActionResult>;
	readonly stageSessionSummary?: () => Promise<HotCacheSessionSummaryResult>;
	readonly isSummaryStaging?: () => boolean;
	readonly isOnline?: () => boolean;
	readonly getActivePath?: () => NormalizedVaultPath | null;
	readonly onNotice?: (message: string) => void;
}

export class VoidbrainChatView extends ItemView {
	override icon = "messages-square";
	private unsubscribeFromThread: ChatThreadUnsubscribe | null = null;
	private isClosed = false;
	private isSubmitting = false;
	private isStagingSummary = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly options: VoidbrainChatViewOptions,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VOIDBRAIN_CHAT_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return VOIDBRAIN_CHAT_VIEW_DISPLAY_TEXT;
	}

	protected override async onOpen(): Promise<void> {
		this.isClosed = false;
		this.renderLoading();
		if (this.options.subscribe === undefined) {
			this.renderState(this.options.getState());
			return;
		}

		this.unsubscribeFromThread = this.options.subscribe((state) => {
			this.renderState(state);
		});
	}

	protected override async onClose(): Promise<void> {
		this.isClosed = true;
		this.unsubscribeFromThread?.();
		this.unsubscribeFromThread = null;
		this.contentEl.replaceChildren();
	}

	private renderLoading(): void {
		this.contentEl.replaceChildren();
		const root = document.createElement("section");
		root.className = "voidbrain-chat-view voidbrain-chat-view--loading";
		root.setAttribute("aria-busy", "true");
		root.setAttribute("role", "status");
		root.textContent = "Loading Voidbrain chat.";
		this.contentEl.append(root);
	}

	private renderState(state: ChatThreadState): void {
		if (this.isClosed) {
			return;
		}

		if (this.options.isOnline?.() === false) {
			this.contentEl.replaceChildren(this.createStateElement("offline", "Voidbrain chat is offline."));
			return;
		}

		const root = document.createElement("section");
		root.className = "voidbrain-chat-view";
		root.setAttribute("aria-label", "Voidbrain cited vault chat");

		root.append(this.createHeader(state));
		if (state.turns.length === 0) {
			root.append(this.createStateElement("empty", "No chat turns yet."));
		} else {
			root.append(this.createTimeline(state));
		}
		root.append(this.createComposer(state));

		this.contentEl.replaceChildren(root);
	}

	private createHeader(state: ChatThreadState): HTMLElement {
		const header = document.createElement("header");
		header.className = "voidbrain-chat-view__header";

		const title = document.createElement("h2");
		title.textContent = "Vault chat";

		const chips = document.createElement("div");
		chips.className = "voidbrain-chat-view__chips";
		chips.append(
			this.createChip(`Thread ${state.threadId}`),
			this.createChip(`Branch ${state.activeBranchId}`),
			this.createChip(state.inFlightTurnId === null ? "Ready" : "Working"),
		);

		const actions = document.createElement("div");
		actions.className = "voidbrain-chat-view__header-actions";
		const saveSummary = document.createElement("button");
		saveSummary.type = "button";
		saveSummary.textContent =
			this.isStagingSummary || this.options.isSummaryStaging?.() === true ? "Staging" : "Save summary";
		saveSummary.dataset.chatAction = "save-session-summary";
		saveSummary.setAttribute("aria-label", "Stage a Voidbrain chat session summary for review");
		saveSummary.disabled =
			this.isSubmitting ||
			this.isStagingSummary ||
			this.options.isSummaryStaging?.() === true ||
			this.options.stageSessionSummary === undefined ||
			state.turns.length === 0;
		saveSummary.addEventListener("click", () => {
			void this.handleStageSessionSummary();
		});
		actions.append(saveSummary);

		header.append(title, chips, actions);
		return header;
	}

	private createTimeline(state: ChatThreadState): HTMLElement {
		const timeline = document.createElement("div");
		timeline.className = "voidbrain-chat-timeline";
		timeline.setAttribute("aria-label", "Chat turns");

		for (const turn of state.turns) {
			const article = document.createElement("article");
			article.className = `voidbrain-chat-turn voidbrain-chat-turn--${turn.status}`;

			const question = document.createElement("p");
			question.className = "voidbrain-chat-turn__question";
			question.textContent = turn.question;
			article.append(question, this.createTurnMeta(turn));

			if (turn.retrievalPreview.length > 0) {
				article.append(this.createRetrievalPreview(turn.retrievalPreview));
			}

			if (turn.answer !== null) {
				const answer = document.createElement("p");
				answer.className = "voidbrain-chat-turn__answer";
				answer.textContent = turn.answer;
				article.append(answer, this.createCitationList(turn));
			}

			if (turn.failure !== null) {
				const failure = document.createElement("p");
				failure.className = "voidbrain-chat-turn__failure";
				failure.setAttribute("role", "alert");
				failure.textContent = turn.failure.message;
				article.append(failure);
			}

			article.append(this.createTurnActions(turn));
			timeline.append(article);
		}

		return timeline;
	}

	private createTurnMeta(turn: ChatTurn): HTMLElement {
		const meta = document.createElement("div");
		meta.className = "voidbrain-chat-turn__meta";
		meta.append(this.createChip(turn.status), this.createChip(`${turn.citations.length} citation(s)`));
		return meta;
	}

	private createRetrievalPreview(preview: readonly ChatRetrievalPreviewItem[]): HTMLElement {
		const section = document.createElement("section");
		section.className = "voidbrain-chat-retrieval";
		section.setAttribute("aria-label", "Retrieval preview");

		const title = document.createElement("h3");
		title.textContent = "Retrieval preview";
		section.append(title);

		const list = document.createElement("ol");
		for (const item of preview) {
			const row = document.createElement("li");
			const path = document.createElement("span");
			path.className = "voidbrain-chat-retrieval__path";
			path.textContent = item.heading === null ? item.vaultPath : `${item.vaultPath} > ${item.heading}`;

			const snippet = document.createElement("p");
			snippet.textContent = item.snippet;

			const score = document.createElement("span");
			score.className = "voidbrain-chat-retrieval__score";
			score.textContent = `Score ${item.score.toFixed(2)}`;

			row.append(path, snippet, score);
			list.append(row);
		}
		section.append(list);
		return section;
	}

	private createCitationList(turn: ChatTurn): HTMLElement {
		const list = document.createElement("ol");
		list.className = "voidbrain-chat-citations";
		list.setAttribute("aria-label", "Answer citations");

		for (const citation of turn.citations) {
			const item = document.createElement("li");
			item.textContent =
				citation.heading === null
					? `${citation.label} ${citation.vaultPath}`
					: `${citation.label} ${citation.vaultPath} > ${citation.heading}`;
			list.append(item);
		}

		return list;
	}

	private createTurnActions(turn: ChatTurn): HTMLElement {
		const actions = document.createElement("div");
		actions.className = "voidbrain-chat-turn__actions";

		const retry = document.createElement("button");
		retry.type = "button";
		retry.textContent = "Retry";
		retry.disabled = this.isSubmitting || !turn.retry.canRetry;
		retry.addEventListener("click", () => {
			void this.handleRetry(turn.id);
		});

		const branch = document.createElement("button");
		branch.type = "button";
		branch.textContent = "Branch";
		branch.disabled = this.isSubmitting;
		branch.addEventListener("click", () => {
			void this.handleBranch(turn.id);
		});

		actions.append(retry, branch);
		return actions;
	}

	private createComposer(state: ChatThreadState): HTMLElement {
		const form = document.createElement("form");
		form.className = "voidbrain-chat-composer";
		form.setAttribute("aria-label", "Ask the vault");
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.handleSubmit(state);
		});

		const context = document.createElement("div");
		context.className = "voidbrain-chat-view__chips";
		for (const chip of this.contextChipsForState(state)) {
			context.append(this.createChip(chip.label));
		}

		const input = document.createElement("textarea");
		input.className = "voidbrain-chat-composer__input";
		input.rows = 4;
		input.value = state.draft.text;
		input.placeholder = "Ask from indexed vault evidence";
		input.setAttribute("aria-label", "Vault question");
		input.disabled = this.isSubmitting || state.inFlightTurnId !== null;
		input.addEventListener("input", () => {
			void this.options.setDraft(input.value, this.contextChipsForState(state));
		});
		input.addEventListener("keydown", (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
				event.preventDefault();
				void this.handleSubmit(state, input.value);
			}
		});

		const submit = document.createElement("button");
		submit.type = "submit";
		submit.textContent = this.isSubmitting ? "Asking" : "Ask";
		submit.disabled = this.isSubmitting || state.inFlightTurnId !== null || state.draft.text.trim().length === 0;

		form.append(context, input, submit);
		return form;
	}

	private contextChipsForState(state: ChatThreadState): readonly ChatContextChip[] {
		const activePath = this.options.getActivePath?.() ?? null;
		const activeChip =
			activePath === null
				? []
				: [
						{
							id: makeChatContextChipId("active-file"),
							kind: "active-file" as const,
							label: activePath,
							path: activePath,
						},
					];
		const hasActivePath = activePath !== null && state.draft.contextChips.some((chip) => chip.path === activePath);
		return hasActivePath ? state.draft.contextChips : [...state.draft.contextChips, ...activeChip];
	}

	private async handleSubmit(state: ChatThreadState, explicitText?: string): Promise<void> {
		if (this.isSubmitting || this.isClosed) {
			return;
		}

		const text = (explicitText ?? state.draft.text).trim();
		if (text.length === 0) {
			return;
		}

		this.isSubmitting = true;
		this.renderState({
			...state,
			inFlightTurnId: state.inFlightTurnId,
		});
		try {
			const contextChips = this.contextChipsForState(state);
			await this.options.setDraft(text, contextChips);
			const result = await this.options.ask({
				text,
				contextChips,
				threadId: state.threadId,
				branchId: state.activeBranchId,
			});
			if (this.isClosed) {
				return;
			}
			await this.options.applyActionResult(result.result);
			if (!result.ok && result.result.failure !== undefined) {
				this.options.onNotice?.(result.result.failure.message);
			}
		} catch {
			this.options.onNotice?.("Voidbrain chat failed before provider work. No vault files were changed.");
		} finally {
			this.isSubmitting = false;
			if (!this.isClosed) {
				this.renderState(this.options.getState());
			}
		}
	}

	private async handleRetry(turnId: ChatTurn["id"]): Promise<void> {
		if (this.isSubmitting || this.isClosed) {
			return;
		}
		const result = await this.options.retryTurn(turnId);
		if (result.failure !== undefined) {
			this.options.onNotice?.(result.failure.message);
		}
	}

	private async handleBranch(turnId: ChatTurn["id"]): Promise<void> {
		if (this.isSubmitting || this.isClosed) {
			return;
		}
		const result = await this.options.branchFromTurn(turnId);
		if (result.failure !== undefined) {
			this.options.onNotice?.(result.failure.message);
		}
	}

	private async handleStageSessionSummary(): Promise<void> {
		if (
			this.isSubmitting ||
			this.isStagingSummary ||
			this.isClosed ||
			this.options.stageSessionSummary === undefined
		) {
			return;
		}

		this.isStagingSummary = true;
		this.renderState(this.options.getState());
		try {
			const result = await this.options.stageSessionSummary();
			if (this.isClosed) {
				return;
			}

			if (result.ok) {
				this.options.onNotice?.(`Session summary staged for review: ${result.targetPath}`);
				return;
			}

			this.options.onNotice?.(result.errors[0]?.message ?? "Session summary could not be staged.");
		} catch {
			this.options.onNotice?.("Session summary could not be staged. No vault files were changed.");
		} finally {
			this.isStagingSummary = false;
			if (!this.isClosed) {
				this.renderState(this.options.getState());
			}
		}
	}

	private createStateElement(state: "empty" | "error" | "offline", message: string): HTMLElement {
		const root = document.createElement("section");
		root.className = `voidbrain-chat-view voidbrain-chat-view--${state}`;
		root.setAttribute("role", state === "error" ? "alert" : "status");
		root.textContent = message;
		return root;
	}

	private createChip(label: string): HTMLElement {
		const chip = document.createElement("span");
		chip.className = "voidbrain-chat-chip";
		chip.textContent = label;
		return chip;
	}
}
