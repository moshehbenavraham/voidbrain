import { describe, expect, it } from "vitest";
import { HotCacheService, captureHotCacheState, restoreHotCacheState } from "../src/agent";
import { HOT_CACHE_SESSION_SUMMARY_COMMAND_ID } from "../src/types/hot-cache";
import type { HotCacheState } from "../src/types/vault";
import { validateHotCacheState } from "../src/utils/vault-validation";
import {
	HOT_CACHE_FIXTURE_CONVERSATION_PATH,
	HOT_CACHE_FIXTURE_SOURCE_MARKDOWN,
	HOT_CACHE_FIXTURE_SOURCE_PATH,
	createHotCacheChatThread,
	createHotCacheHealthReport,
	createHotCacheIndexReport,
	createHotCacheStagedChange,
	createHotCacheStateFixture,
} from "./fixtures/vault/hot-cache-fixtures";
import { createQueueFixtureSummary } from "./fixtures/vault/source-ingestion-queue-fixtures";

describe("HotCacheService", () => {
	it("captures bounded redacted entries with deterministic validation", () => {
		const result = captureHotCacheState({
			cacheId: "hot-cache-service-test",
			chatThread: createHotCacheChatThread(),
			indexReports: [createHotCacheIndexReport()],
			stagedChanges: [createHotCacheStagedChange()],
			healthReport: createHotCacheHealthReport(),
			now: new Date("2026-05-13T01:00:00.000Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected hot cache capture to succeed.");
		}

		expect(result.state.entries.map((entry) => `${entry.kind}:${entry.key}`)).toEqual([
			"chat-thread:thread-hot-cache-fixture",
			"context-chip:context-hot-cache-source",
			"health-report:health-hot-cache-fixture",
			"index-readiness:hot-cache-lexical-index",
			"staged-change:stage-hot-cache-summary",
		]);
		expect(validateHotCacheState(result.state)).toMatchObject({ ok: true });
		expect(JSON.stringify(result.state)).not.toContain(HOT_CACHE_FIXTURE_SOURCE_MARKDOWN);
		expect(JSON.stringify(result.state)).not.toContain("authorization");
	});

	it("captures redacted source ingestion queue summaries for recovery", () => {
		const result = captureHotCacheState({
			cacheId: "hot-cache-queue-test",
			sourceIngestionQueues: [createQueueFixtureSummary()],
			now: new Date("2026-05-13T01:00:00.000Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected hot cache capture to succeed.");
		}

		const queueEntry = result.state.entries.find((entry) => entry.kind === "source-ingestion-queue");
		expect(queueEntry).toMatchObject({
			key: "queue-fixture",
			recovery: {
				commandId: "voidbrain.ingest-source",
			},
			metadata: {
				queueId: "queue-fixture",
				itemCount: 2,
				stagedChangeIds: ["stage-queue-safe"],
			},
		});
		expect(validateHotCacheState(result.state)).toMatchObject({ ok: true });
		expect(JSON.stringify(result.state)).not.toContain("Synthetic URL source record supplied by the user");
		expect(JSON.stringify(result.state)).not.toContain("authorization");
	});

	it("rejects secret-like fields and unsorted durable records", () => {
		const secretRecord = createHotCacheStateFixture() as HotCacheState & {
			entries: Array<HotCacheState["entries"][number] & { metadata: Record<string, unknown> }>;
		};
		const firstEntry = secretRecord.entries[0];
		if (firstEntry === undefined) {
			throw new Error("Expected hot cache fixture entry.");
		}
		firstEntry.metadata.token = "synthetic-token";
		expect(validateHotCacheState(secretRecord)).toMatchObject({
			ok: false,
			errors: expect.arrayContaining([expect.objectContaining({ code: "metadata.secret-field" })]),
		});

		const unsorted = {
			...createHotCacheStateFixture(),
			entries: [...createHotCacheStateFixture().entries].reverse(),
		};
		expect(validateHotCacheState(unsorted)).toMatchObject({
			ok: false,
			errors: [{ code: "record.unsorted", message: expect.any(String), field: "entries" }],
		});
	});

	it("restores chat draft and context chips from a validated support record", () => {
		const result = restoreHotCacheState({
			value: createHotCacheStateFixture(),
			now: new Date("2026-05-13T01:05:00.000Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected hot cache restore to succeed.");
		}

		expect(result.chatThread?.threadId).toBe("thread-hot-cache-fixture");
		expect(result.chatThread?.draft.text).toContain("Summarize the synthetic hot cache");
		expect(result.contextChips[0]).toMatchObject({
			label: "Hot cache source",
			path: HOT_CACHE_FIXTURE_SOURCE_PATH,
		});
	});

	it("maps malformed persisted cache to recoverable validation errors", () => {
		const result = restoreHotCacheState({
			value: {
				artifactKind: "hot-cache",
				schemaVersion: 1,
				cacheId: "",
			},
			now: new Date("2026-05-13T01:05:00.000Z"),
		});

		expect(result).toMatchObject({
			ok: false,
			recovery: {
				commandId: "voidbrain.hot-cache",
				cachePath: ".voidbrain/cache/hot-cache.json",
			},
		});
	});

	it("stages session summaries with citations and prevents duplicate in-flight staging", async () => {
		const service = new HotCacheService();
		const first = service.stageSessionSummary({
			chatThread: createHotCacheChatThread(),
			targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
			now: new Date("2026-05-13T01:00:00.000Z"),
		});
		const duplicate = await service.stageSessionSummary({
			chatThread: createHotCacheChatThread(),
			targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
			now: new Date("2026-05-13T01:00:00.000Z"),
		});
		const result = await first;

		expect(duplicate).toMatchObject({
			ok: false,
			errors: [{ code: "record.invalid-operation" }],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected staged session summary.");
		}

		expect(result.recovery.commandId).toBe(HOT_CACHE_SESSION_SUMMARY_COMMAND_ID);
		expect(result.targetPath).toBe(HOT_CACHE_FIXTURE_CONVERSATION_PATH);
		expect(result.markdown).toContain("sources/hot-cache-source.md");
		expect(result.stagedChange).toMatchObject({
			status: "review-ready",
			targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
		});
	});
});
