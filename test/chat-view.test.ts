import type { WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatThreadStore, createInitialChatThreadState } from "../src/stores/chat-thread-store";
import {
	type ChatActionResult,
	type ChatFailure,
	type ChatThreadState,
	type ChatTurn,
	makeChatBranchId,
	makeChatCitationId,
	makeChatThreadId,
	makeChatTurnId,
} from "../src/types/chat";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { VOIDBRAIN_CHAT_VIEW_TYPE, VoidbrainChatView } from "../src/views/chat-view";
import { App as MockApp, resetObsidianMockState } from "./__mocks__/obsidian";

const fixedTimestamp = makeIsoTimestamp("2026-05-13T00:00:00.000Z");
const threadId = makeChatThreadId("chat-view-thread");
const branchId = makeChatBranchId("branch-main");

const flushPromises = async (count = 4): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
	}
};

const failure = (turnId = makeChatTurnId("turn-failed")): ChatFailure => ({
	code: "chat.provider-denied",
	stage: "provider-preflight",
	message: "Provider review is required.",
	retryable: true,
	commandId: "voidbrain.chat-with-vault",
	threadId,
	turnId,
	validationOutput: ["provider preflight denied"],
	diagnostic: {},
});

const turn = (overrides: Partial<ChatTurn> = {}): ChatTurn => {
	const turnId = overrides.id ?? makeChatTurnId("turn-answer");
	return {
		id: turnId,
		parentTurnId: null,
		branchId,
		status: "answer-ready",
		question: "How does chat cite evidence?",
		contextChips: [],
		retrievalQuery: null,
		retrievalPreview: [
			{
				resultId: "result-1",
				citationId: makeChatCitationId("citation-1"),
				vaultPath: makeNormalizedVaultPath("sources/chat-source.md"),
				heading: "Privacy Gate",
				chunkId: "sources/chat-source.md#privacy-gate:1",
				sourcePaths: [makeNormalizedVaultPath("sources/chat-source.md")],
				snippet: "Synthetic retrieval preview for cited chat.",
				score: 2,
				normalizedScore: 0.2,
				matchedTokens: ["chat"],
			},
		],
		persistedRetrieval: [],
		citations: [
			{
				id: makeChatCitationId("citation-1"),
				label: "[1]",
				resultId: "result-1",
				vaultPath: makeNormalizedVaultPath("sources/chat-source.md"),
				heading: "Privacy Gate",
				chunkId: "sources/chat-source.md#privacy-gate:1",
				sourcePaths: [makeNormalizedVaultPath("sources/chat-source.md")],
				score: 2,
			},
		],
		answer: "Synthetic answer with a citation.",
		failure: null,
		retry: {
			sourceTurnId: turnId,
			retryOfTurnId: null,
			attempt: 1,
			lastFailureCode: null,
			canRetry: false,
		},
		providerDecision: null,
		providerAttempts: [],
		createdAt: fixedTimestamp,
		updatedAt: fixedTimestamp,
		...overrides,
	};
};

const stateWithTurns = (turns: readonly ChatTurn[]): ChatThreadState => ({
	...createInitialChatThreadState({
		threadId,
		now: new Date("2026-05-13T00:00:00.000Z"),
	}),
	turns,
});

const openView = async (
	options: ConstructorParameters<typeof VoidbrainChatView>[1],
): Promise<{ readonly app: MockApp; readonly view: VoidbrainChatView }> => {
	const app = new MockApp();
	const leaf = app.workspace.getLeaf(false) as unknown as WorkspaceLeaf;
	const view = new VoidbrainChatView(leaf, options);
	await (view as unknown as { onOpen: () => Promise<void> }).onOpen();

	return { app, view };
};

describe("VoidbrainChatView", () => {
	beforeEach(() => {
		resetObsidianMockState();
	});

	it("renders empty and offline states", async () => {
		const store = createChatThreadStore({ threadId });
		const { view } = await openView({
			getState: () => store.getState(),
			subscribe: (subscriber) => store.subscribe(subscriber),
			ask: vi.fn(),
			applyActionResult: (result) => store.applyActionResult(result),
			setDraft: (text, contextChips) => store.setDraft(text, contextChips),
			retryTurn: (turnId) => store.retryTurn(turnId),
			branchFromTurn: (turnId) => store.branchFromTurn(turnId),
			isOnline: () => true,
		});

		expect(view.contentEl.textContent).toContain("No chat turns yet.");

		const offline = await openView({
			getState: () => store.getState(),
			ask: vi.fn(),
			applyActionResult: (result) => store.applyActionResult(result),
			setDraft: (text, contextChips) => store.setDraft(text, contextChips),
			retryTurn: (turnId) => store.retryTurn(turnId),
			branchFromTurn: (turnId) => store.branchFromTurn(turnId),
			isOnline: () => false,
		});
		expect(offline.view.contentEl.textContent).toContain("Voidbrain chat is offline.");
	});

	it("submits a question and renders retrieval preview with citations", async () => {
		const store = createChatThreadStore({ threadId });
		await store.setDraft("How does chat cite evidence?");
		const answerTurn = turn();
		const ask = vi.fn(
			async (): Promise<{ ok: true; result: ChatActionResult }> => ({
				ok: true,
				result: {
					accepted: true,
					action: "ask",
					state: store.getState(),
					turn: answerTurn,
				},
			}),
		);
		const { view } = await openView({
			getState: () => store.getState(),
			subscribe: (subscriber) => store.subscribe(subscriber),
			ask,
			applyActionResult: (result) => store.applyActionResult(result),
			setDraft: (text, contextChips) => store.setDraft(text, contextChips),
			retryTurn: (turnId) => store.retryTurn(turnId),
			branchFromTurn: (turnId) => store.branchFromTurn(turnId),
			isOnline: () => true,
		});

		view.contentEl.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await flushPromises();

		expect(ask).toHaveBeenCalledWith(
			expect.objectContaining({
				text: "How does chat cite evidence?",
				threadId,
				branchId,
			}),
		);
		expect(view.contentEl.textContent).toContain("Retrieval preview");
		expect(view.contentEl.textContent).toContain("Synthetic answer with a citation.");
		expect(view.contentEl.textContent).toContain("sources/chat-source.md");
	});

	it("recovers retry drafts and creates branch metadata from turn actions", async () => {
		const failedTurnId = makeChatTurnId("turn-failed");
		const failedTurn = turn({
			id: failedTurnId,
			status: "failed",
			answer: null,
			failure: failure(failedTurnId),
			retry: {
				sourceTurnId: failedTurnId,
				retryOfTurnId: null,
				attempt: 1,
				lastFailureCode: "chat.provider-denied",
				canRetry: true,
			},
		});
		const store = createChatThreadStore({ initialState: stateWithTurns([failedTurn]) });
		const { view } = await openView({
			getState: () => store.getState(),
			subscribe: (subscriber) => store.subscribe(subscriber),
			ask: vi.fn(),
			applyActionResult: (result) => store.applyActionResult(result),
			setDraft: (text, contextChips) => store.setDraft(text, contextChips),
			retryTurn: (turnId) => store.retryTurn(turnId),
			branchFromTurn: (turnId) => store.branchFromTurn(turnId),
			isOnline: () => true,
		});

		const buttons = [...view.contentEl.querySelectorAll("button")];
		buttons.find((button) => button.textContent === "Retry")?.click();
		await flushPromises();
		expect(store.getState().draft.text).toBe(failedTurn.question);

		buttons.find((button) => button.textContent === "Branch")?.click();
		await flushPromises();
		expect(store.getState().branches).toHaveLength(2);
		expect(store.getState().activeBranchId).toBe(makeChatBranchId("branch-2"));
	});

	it("cleans up subscriptions and content on close", async () => {
		const store = createChatThreadStore({ threadId });
		let unsubscribeCount = 0;
		const { view } = await openView({
			getState: () => store.getState(),
			subscribe: (subscriber) => {
				const unsubscribe = store.subscribe(subscriber);
				return () => {
					unsubscribeCount += 1;
					unsubscribe();
				};
			},
			ask: vi.fn(),
			applyActionResult: (result) => store.applyActionResult(result),
			setDraft: (text, contextChips) => store.setDraft(text, contextChips),
			retryTurn: (turnId) => store.retryTurn(turnId),
			branchFromTurn: (turnId) => store.branchFromTurn(turnId),
			isOnline: () => true,
		});

		await (view as unknown as { onClose: () => Promise<void> }).onClose();

		expect(unsubscribeCount).toBe(1);
		expect(view.contentEl.childElementCount).toBe(0);
	});
});
