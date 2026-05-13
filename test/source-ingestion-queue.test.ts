import { describe, expect, it } from "vitest";
import { SourceIngestionIntakeService, SourceIngestionQueueService, SourceIngestionStagingService } from "../src/agent";
import type { SourceIngestionIntakeRequest, SourceIngestionStageFailure } from "../src/types/ingestion";
import type { ValidationIssue } from "../src/types/vault";
import { makeIsoTimestamp } from "../src/types/vault";
import {
	QUEUE_CITATION_FAILURE_REQUEST,
	QUEUE_DUPLICATE_SOURCE_REQUESTS,
	QUEUE_PARTIAL_FAILURE_REQUESTS,
	QUEUE_PROVIDER_DENIED_REQUEST,
	QUEUE_SAFE_BATCH_REQUESTS,
	QUEUE_SAFE_MARKDOWN_REQUEST,
	QUEUE_SAFE_TEXT_REQUEST,
	QUEUE_SAFE_URL_REQUEST,
} from "./fixtures/vault/source-ingestion-queue-fixtures";

const fixedNow = () => new Date("2026-05-13T00:00:00.000Z");

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

const validationIssue = (message: string): ValidationIssue => ({
	code: "record.invalid-state",
	message,
	field: "queue",
});

const stageFailureFor = async (
	request: SourceIngestionIntakeRequest,
	code: SourceIngestionStageFailure["code"],
	message: string,
): Promise<SourceIngestionStageFailure> => {
	const preview = await new SourceIngestionIntakeService({ now: fixedNow }).createPreview(request);
	const validationOutput = [validationIssue(message)];
	if (!preview.ok) {
		return {
			ok: false,
			code: "ingestion.input-invalid",
			message,
			retryable: true,
			stagedChangeIds: [],
			targetPaths: [],
			providerDecision,
			validationOutput: preview.errors,
		};
	}

	return {
		ok: false,
		code,
		message,
		retryable: true,
		sourcePath: preview.value.sourcePath,
		stagedChangeIds: [],
		targetPaths: [
			preview.value.targetPaths.source,
			...preview.value.targetPaths.entities,
			...preview.value.targetPaths.concepts,
			preview.value.targetPaths.summary,
		],
		providerDecision,
		validationOutput,
		recovery: {
			commandId: "voidbrain.ingest-source",
			sourcePath: preview.value.sourcePath,
			contentSha256: preview.value.contentSha256,
			stagedChangeIds: [],
			targetPaths: [
				preview.value.targetPaths.source,
				...preview.value.targetPaths.entities,
				...preview.value.targetPaths.concepts,
				preview.value.targetPaths.summary,
			],
			providerDecision,
			validationOutput,
			retryGuidance: "Resolve synthetic queue validation and retry.",
			updatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
		},
	};
};

describe("SourceIngestionQueueService", () => {
	it("stages safe batch items with bounded concurrency and deterministic summary order", async () => {
		let activeWorkers = 0;
		let maxWorkers = 0;
		const staging = new SourceIngestionStagingService({ now: fixedNow });
		const service = new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: async (request) => {
				activeWorkers += 1;
				maxWorkers = Math.max(maxWorkers, activeWorkers);
				await Promise.resolve();
				const result = await staging.stageSource(request);
				activeWorkers -= 1;
				return result;
			},
		});

		const result = await service.runQueue({
			queueId: "queue-safe-batch",
			items: [QUEUE_SAFE_MARKDOWN_REQUEST, QUEUE_SAFE_URL_REQUEST],
			concurrency: 2,
		});

		expect(maxWorkers).toBeLessThanOrEqual(2);
		expect(result.summary.counts).toMatchObject({
			total: 2,
			staged: 2,
			failed: 0,
			canceled: 0,
		});
		expect(result.summary.items.map((item) => item.index)).toEqual([0, 1]);
		expect(result.summary.items.every((item) => item.status === "staged")).toBe(true);
		expect(result.summary.stagedChangeIds.length).toBe(result.stagedChanges.length);
		expect(JSON.stringify(result.summary)).not.toContain("Generated notes remain staged changes");
	});

	it("skips duplicate queue sources before concurrent staging", async () => {
		const result = await new SourceIngestionQueueService({ now: fixedNow }).runQueue({
			queueId: "queue-duplicates",
			items: QUEUE_DUPLICATE_SOURCE_REQUESTS,
			concurrency: 2,
		});

		expect(result.summary.counts).toMatchObject({
			total: 2,
			staged: 1,
			skipped: 1,
		});
		expect(result.summary.items[1]).toMatchObject({
			status: "skipped",
			failureCode: "ingestion.queue-duplicate",
			retryable: true,
		});
	});

	it("fails provider-denied batch items before generated notes are staged", async () => {
		const result = await new SourceIngestionQueueService({ now: fixedNow }).runQueue({
			queueId: "queue-provider-denied",
			items: [QUEUE_PROVIDER_DENIED_REQUEST],
		});

		expect(result.stagedChanges).toHaveLength(0);
		expect(result.summary.counts).toMatchObject({
			failed: 1,
			providerBlocked: 1,
			retryable: 1,
		});
		expect(result.summary.items[0]).toMatchObject({
			status: "failed",
			failureCode: "ingestion.provider-denied",
			providerDecision: {
				kind: "denied",
				allowed: false,
			},
		});
	});

	it("preserves partial failure context for citation failures and staged successes", async () => {
		const staging = new SourceIngestionStagingService({ now: fixedNow });
		const service = new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: (request) =>
				request.input === QUEUE_CITATION_FAILURE_REQUEST.input
					? stageFailureFor(request, "ingestion.citation-invalid", "Synthetic citation validation failed.")
					: staging.stageSource(request),
		});

		const result = await service.runQueue({
			queueId: "queue-partial-failure",
			items: QUEUE_PARTIAL_FAILURE_REQUESTS,
			concurrency: 2,
		});

		expect(result.summary.status).toBe("failed");
		expect(result.summary.counts).toMatchObject({
			staged: 2,
			failed: 1,
			citationBlocked: 1,
			retryable: 1,
		});
		expect(result.summary.stagedChangeIds.length).toBe(result.stagedChanges.length);
		expect(result.summary.items.find((item) => item.status === "failed")).toMatchObject({
			failureCode: "ingestion.citation-invalid",
			citationState: "invalid",
		});
	});

	it("cancels queued work, aborts running work, and retries item-scoped requests", async () => {
		let releaseRunning: (() => void) | undefined;
		let markStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const running = new Promise<void>((resolve) => {
			releaseRunning = resolve;
		});
		const service = new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: async (request) => {
				markStarted?.();
				await running;
				if (request.signal?.aborted === true) {
					return stageFailureFor(request, "ingestion.canceled", "Synthetic queue item was canceled.");
				}
				return new SourceIngestionStagingService({ now: fixedNow }).stageSource(request);
			},
		});

		const queued = service.runQueue({
			queueId: "queue-cancel",
			items: [QUEUE_SAFE_TEXT_REQUEST, QUEUE_SAFE_URL_REQUEST],
			concurrency: 1,
		});
		await started;
		const cancel = service.cancelQueue("queue-cancel");
		releaseRunning?.();
		const canceled = await queued;

		expect(cancel.ok).toBe(true);
		expect(canceled.summary.counts.canceled).toBe(2);
		expect(canceled.summary.stagedChangeIds).toHaveLength(0);

		const retried = await service.retryItems({
			sourceQueueId: canceled.summary.queueId,
			items: [QUEUE_SAFE_TEXT_REQUEST],
		});
		expect(retried.summary.queueId).toContain("queue-cancel-retry");
		expect(retried.summary.counts.staged).toBe(1);
	});
});
