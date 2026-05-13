import { describe, expect, it, vi } from "vitest";
import { GroundedVaultChatService } from "../src/agent";
import { createProviderChatInvoker } from "../src/providers";
import { LOCAL_FIXTURE_PROVIDER_ID, TRUSTED_CLOUD_FIXTURE_PROVIDER_ID, makeProviderModelId } from "../src/providers";
import { makeChatThreadId, makeChatTurnId } from "../src/types/chat";
import type { IndexingRuntimeState, SemanticIndexReadiness } from "../src/types/indexing-runtime";
import { DEFAULT_PLUGIN_SETTINGS, type VoidbrainPluginSettings } from "../src/types/plugin";
import type { LexicalIndexSnapshot, SemanticIndexCompatibility } from "../src/types/retrieval";
import { makeIsoTimestamp } from "../src/types/vault";
import { FixtureIndexingService, evaluateSemanticIndexCompatibility } from "../src/vectorstore";
import {
	SYNTHETIC_INVOCATION_SOURCE_PATH,
	SYNTHETIC_PRIVATE_CONTENT_PROBE,
	cancellationAwareChatTransport,
	retryThenSuccessChatTransport,
	secretLikeFailureChatTransport,
} from "./fixtures/providers/provider-invocation-fixtures";
import {
	CHAT_FIXTURE_FILES,
	CHAT_FIXTURE_MESSAGE,
	CHAT_FIXTURE_QUESTION,
	CHAT_FIXTURE_WEAK_QUESTION,
	EXPECTED_CHAT_CITATIONS,
	loadChatFixtureNotes,
} from "./fixtures/vault/chat-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");
const fixedTimestamp = makeIsoTimestamp("2026-05-13T00:00:00.000Z");

const semanticDisabled = (): SemanticIndexReadiness => ({
	state: "disabled",
	readinessState: "disabled",
	checkedAt: fixedTimestamp,
	contentSensitivity: "private-vault",
	providerId: null,
	modelId: null,
	sourcePathCount: 0,
	message: "Semantic indexing is disabled in settings.",
	diagnosticCode: null,
});

const semanticCompatibility = (
	readiness: SemanticIndexReadiness,
	index: LexicalIndexSnapshot | null,
	readinessState: IndexingRuntimeState["lexicalReport"]["readinessState"],
): SemanticIndexCompatibility =>
	evaluateSemanticIndexCompatibility({
		semanticReadiness: readiness,
		semanticSnapshot: null,
		currentSources: index?.sources ?? [],
		lexicalReadinessState: readinessState,
		checkedAt: fixedDate,
	});

const buildFixtureIndex = async (): Promise<LexicalIndexSnapshot> => {
	const result = await new FixtureIndexingService().buildLexicalIndexJob({
		jobId: "chat-fixture-job",
		indexId: "chat-fixture-index",
		notes: loadChatFixtureNotes(),
		now: () => fixedDate,
	});
	if (!result.ok) {
		throw new Error(result.message);
	}

	return result.index;
};

const readyState = (index: LexicalIndexSnapshot): IndexingRuntimeState => ({
	lexicalIndex: index,
	lexicalReport: {
		indexId: index.indexId,
		jobId: "chat-fixture-job",
		status: "ready",
		readinessState: "ready",
		progress: null,
		freshness: null,
		indexedNoteCount: index.sources.length,
		totalNoteCount: index.sources.length,
		skippedPaths: [],
		failedPaths: [],
		stalePaths: [],
		missingPaths: [],
		extraPaths: [],
		currentPath: null,
		updatedAt: fixedTimestamp,
		message: "Lexical index is ready.",
	},
	semanticReadiness: semanticDisabled(),
	semanticCompatibility: semanticCompatibility(semanticDisabled(), index, "ready"),
});

const missingState = (): IndexingRuntimeState => ({
	lexicalIndex: null,
	lexicalReport: {
		indexId: "chat-fixture-index",
		jobId: null,
		status: "missing",
		readinessState: "missing",
		progress: null,
		freshness: null,
		indexedNoteCount: 0,
		totalNoteCount: 0,
		skippedPaths: [],
		failedPaths: [],
		stalePaths: [],
		missingPaths: [],
		extraPaths: [],
		currentPath: null,
		updatedAt: fixedTimestamp,
		message: "No lexical index has been built yet.",
	},
	semanticReadiness: semanticDisabled(),
	semanticCompatibility: semanticCompatibility(semanticDisabled(), null, "missing"),
});

const localChatSettings = (): VoidbrainPluginSettings => ({
	...DEFAULT_PLUGIN_SETTINGS,
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("local-chat-fixture"),
		},
	},
});

describe("GroundedVaultChatService", () => {
	it("validates questions and fails closed when retrieval is not ready", async () => {
		const service = new GroundedVaultChatService({
			getSettings: () => DEFAULT_PLUGIN_SETTINGS,
			getIndexingState: () => missingState(),
			now: () => fixedDate,
		});

		await expect(service.ask({ text: "   " })).resolves.toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.question-empty",
					stage: "validation",
				},
			},
		});

		await expect(service.ask({ text: CHAT_FIXTURE_QUESTION })).resolves.toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.retrieval-not-ready",
					stage: "retrieval-readiness",
				},
			},
		});
	});

	it("builds retrieval previews and citations before synthetic provider synthesis", async () => {
		const index = await buildFixtureIndex();
		const service = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: async (request) => {
				const firstCitation = request.citations[0];
				if (firstCitation === undefined) {
					throw new Error("Expected cited retrieval evidence.");
				}

				return {
					ok: true,
					response: {
						answer: "Grounded chat protects private evidence with retrieval citations and provider preflight.",
						citations: [firstCitation.id],
					},
					attempts: [],
					diagnostic: {},
				};
			},
			now: () => fixedDate,
		});

		const result = await service.ask({ text: CHAT_FIXTURE_QUESTION });
		const expectedCitation = EXPECTED_CHAT_CITATIONS[0];
		if (expectedCitation === undefined) {
			throw new Error("Expected chat citation fixture");
		}

		expect(result).toMatchObject({
			ok: true,
			result: {
				turn: {
					status: "answer-ready",
					providerDecision: {
						allowed: true,
					},
				},
			},
		});
		const turn = result.result.turn;
		if (turn === undefined) {
			throw new Error("Expected answer turn");
		}
		expect(turn?.retrievalPreview[0]).toMatchObject({
			vaultPath: expectedCitation.vaultPath,
			sourcePaths: expectedCitation.sourcePaths,
		});
		expect(turn?.citations[0]).toMatchObject({
			vaultPath: expectedCitation.vaultPath,
			chunkId: expect.any(String),
			score: expect.any(Number),
		});
		expect(turn?.retrievalFallback).toMatchObject({
			mode: "lexical",
			semanticCompatibilityCode: "semantic-disabled",
			semanticSearchEligible: false,
		});
		expect(JSON.stringify(result)).not.toContain("runtime-value");
		expect(CHAT_FIXTURE_MESSAGE).not.toContain("sk-");
	});

	it("blocks weak retrieval and missing providers without invoking chat transport", async () => {
		const index = await buildFixtureIndex();
		const invoker = vi.fn();
		const weakService = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: invoker,
			now: () => fixedDate,
		});

		await expect(weakService.ask({ text: CHAT_FIXTURE_WEAK_QUESTION })).resolves.toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.retrieval-weak",
				},
			},
		});
		expect(invoker).not.toHaveBeenCalled();

		const missingProvider = new GroundedVaultChatService({
			getSettings: () => DEFAULT_PLUGIN_SETTINGS,
			getIndexingState: () => readyState(index),
			chatInvoker: invoker,
			now: () => fixedDate,
		});
		await expect(missingProvider.ask({ text: CHAT_FIXTURE_QUESTION })).resolves.toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.provider-denied",
					stage: "provider-preflight",
				},
			},
		});
		expect(invoker).not.toHaveBeenCalled();
	});

	it("prevents duplicate asks while provider invocation is in flight", async () => {
		const index = await buildFixtureIndex();
		let releaseProvider: ((value: unknown) => void) | undefined;
		const service = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: (request) =>
				new Promise((resolve) => {
					const firstCitation = request.citations[0];
					if (firstCitation === undefined) {
						throw new Error("Expected cited retrieval evidence.");
					}
					releaseProvider = () =>
						resolve({
							ok: true,
							response: {
								answer: "Synthetic answer with a citation.",
								citations: [firstCitation.id],
							},
							attempts: [],
							diagnostic: {},
						});
				}),
			now: () => fixedDate,
		});

		const first = service.ask({ text: CHAT_FIXTURE_QUESTION });
		await Promise.resolve();
		await expect(service.ask({ text: CHAT_FIXTURE_QUESTION })).resolves.toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.duplicate-action",
				},
			},
		});

		releaseProvider?.({});
		await expect(first).resolves.toMatchObject({ ok: true });
	});

	it("keeps cloud provider content blocked until trust and auth are ready", async () => {
		const index = await buildFixtureIndex();
		const service = new GroundedVaultChatService({
			getSettings: () => ({
				...DEFAULT_PLUGIN_SETTINGS,
				providerRoles: {
					...DEFAULT_PLUGIN_SETTINGS.providerRoles,
					chat: {
						providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
						modelId: makeProviderModelId("trusted-cloud-chat-fixture"),
					},
				},
			}),
			getIndexingState: () => readyState(index),
			now: () => fixedDate,
		});

		const result = await service.ask({ text: CHAT_FIXTURE_QUESTION });

		expect(result).toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.provider-denied",
				},
			},
		});
		expect(JSON.stringify(result)).not.toContain(CHAT_FIXTURE_FILES[0]?.content ?? "missing");
	});

	it("propagates cancellation and retries through grounded chat provider invocation", async () => {
		const index = await buildFixtureIndex();
		const controller = new AbortController();
		const canceledService = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: createProviderChatInvoker({
				transport: cancellationAwareChatTransport(),
				now: () => fixedDate,
			}),
			now: () => fixedDate,
		});

		const canceled = canceledService.ask({
			text: CHAT_FIXTURE_QUESTION,
			signal: controller.signal,
		});
		await Promise.resolve();
		controller.abort();
		await expect(canceled).resolves.toMatchObject({
			ok: false,
			result: {
				turn: {
					status: "canceled",
				},
				failure: {
					code: "chat.provider-canceled",
				},
			},
		});

		const retryService = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: createProviderChatInvoker({
				maxAttempts: 2,
				retryBackoffMs: 1,
				transport: retryThenSuccessChatTransport(),
				now: () => fixedDate,
			}),
			now: () => fixedDate,
		});
		const retried = retryService.ask({ text: CHAT_FIXTURE_QUESTION });
		await vi.advanceTimersByTimeAsync(1);
		await expect(retried).resolves.toMatchObject({
			ok: true,
			result: {
				turn: {
					providerAttempts: [{ status: "failed" }, { status: "succeeded" }],
				},
			},
		});
	});

	it("redacts unsafe provider diagnostics from grounded chat failures", async () => {
		const index = await buildFixtureIndex();
		const service = new GroundedVaultChatService({
			getSettings: localChatSettings,
			getIndexingState: () => readyState(index),
			chatInvoker: createProviderChatInvoker({
				maxAttempts: 1,
				transport: secretLikeFailureChatTransport(),
				now: () => fixedDate,
			}),
			now: () => fixedDate,
		});

		const result = await service.ask({ text: CHAT_FIXTURE_QUESTION });
		expect(result).toMatchObject({
			ok: false,
			result: {
				failure: {
					code: "chat.provider-failed",
					stage: "provider-invocation",
				},
			},
		});
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain(SYNTHETIC_PRIVATE_CONTENT_PROBE);
		expect(serialized).not.toContain(SYNTHETIC_INVOCATION_SOURCE_PATH);
		expect(serialized).not.toContain("Bearer fixture");
		expect(serialized).not.toContain("fixture-credential-probe");
	});
});

describe("provider chat invoker", () => {
	it("times out external provider calls with redacted diagnostics", async () => {
		const invoker = createProviderChatInvoker({
			maxAttempts: 1,
			now: () => fixedDate,
			transport: () => new Promise(() => undefined),
		});
		const resultPromise = invoker({
			commandId: "voidbrain.chat-with-vault",
			threadId: makeChatThreadId("thread-timeout"),
			turnId: makeChatTurnId("turn-timeout"),
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: makeProviderModelId("local-chat-fixture"),
			contentSensitivity: "private-vault",
			question: CHAT_FIXTURE_QUESTION,
			evidence: [],
			citations: [],
			sourcePaths: [],
			timeoutMs: 1,
		});
		await vi.advanceTimersByTimeAsync(1);
		const result = await resultPromise;

		expect(result).toMatchObject({
			ok: false,
			code: "chat.provider-timeout",
			retryable: false,
		});
		expect(JSON.stringify(result)).not.toContain("runtime-value");
	});
});
