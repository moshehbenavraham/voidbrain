import type { SourceIngestionIntakeRequest } from "../../../src/types/ingestion";
import type { SourceIngestionQueueSummary } from "../../../src/types/ingestion-queue";
import { type StagedChangeRecord, makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import {
	APPROVED_URL_SOURCE_INPUT,
	INGESTION_FIXTURE_MARKDOWN,
	SAFE_MARKDOWN_SOURCE_INPUT,
	SAFE_PASTED_SOURCE_INPUT,
	SAFE_TEXT_SOURCE_INPUT,
} from "./source-ingestion-fixtures";

export const SOURCE_INGESTION_QUEUE_FIXTURE_MESSAGE =
	"Batch source ingestion queue fixtures are synthetic vault records only and contain no provider secrets or private paths.";

export const QUEUE_SAFE_MARKDOWN_REQUEST: SourceIngestionIntakeRequest = {
	input: SAFE_MARKDOWN_SOURCE_INPUT,
};

export const QUEUE_SAFE_TEXT_REQUEST: SourceIngestionIntakeRequest = {
	input: SAFE_TEXT_SOURCE_INPUT,
};

export const QUEUE_SAFE_PASTED_REQUEST: SourceIngestionIntakeRequest = {
	input: SAFE_PASTED_SOURCE_INPUT,
};

export const QUEUE_SAFE_URL_REQUEST: SourceIngestionIntakeRequest = {
	input: APPROVED_URL_SOURCE_INPUT,
};

export const QUEUE_PROVIDER_DENIED_REQUEST: SourceIngestionIntakeRequest = {
	input: {
		kind: "markdown-file",
		title: "Synthetic Provider Denied Source",
		path: "inbox/synthetic-provider-denied-source.md",
		content: [
			"# Synthetic Provider Denied Source",
			"",
			"Provider-assisted extraction requires explicit review before private source content leaves local runtime.",
		].join("\n"),
		providerMode: "optional-summary",
	},
};

export const QUEUE_CITATION_FAILURE_REQUEST: SourceIngestionIntakeRequest = {
	input: {
		kind: "pasted-content",
		title: "Synthetic Citation Failure Source",
		sourcePath: "sources/synthetic-citation-failure-source.md",
		content: "Synthetic citation failure content stays local and should not be written directly.",
	},
};

export const QUEUE_DUPLICATE_SOURCE_REQUESTS: readonly SourceIngestionIntakeRequest[] = [
	QUEUE_SAFE_MARKDOWN_REQUEST,
	{
		input: {
			...SAFE_MARKDOWN_SOURCE_INPUT,
			content: INGESTION_FIXTURE_MARKDOWN,
		},
	},
];

export const QUEUE_SAFE_BATCH_REQUESTS: readonly SourceIngestionIntakeRequest[] = [
	QUEUE_SAFE_MARKDOWN_REQUEST,
	QUEUE_SAFE_TEXT_REQUEST,
	QUEUE_SAFE_PASTED_REQUEST,
	QUEUE_SAFE_URL_REQUEST,
];

export const QUEUE_PARTIAL_FAILURE_REQUESTS: readonly SourceIngestionIntakeRequest[] = [
	QUEUE_SAFE_MARKDOWN_REQUEST,
	QUEUE_CITATION_FAILURE_REQUEST,
	QUEUE_SAFE_URL_REQUEST,
];

export const createQueueFixtureStagedChange = (
	changeId: string,
	targetPath = "sources/synthetic-source-ingestion-demo.md",
): StagedChangeRecord =>
	({
		artifactKind: "staged-change",
		schemaVersion: 1,
		changeId,
		operationKind: "create-note",
		status: "review-ready",
		targetPath: makeNormalizedVaultPath(targetPath),
		sourcePaths: [makeNormalizedVaultPath("inbox/source-ingestion-demo.md")],
		rationale: "Stage synthetic queue fixture output.",
		diff: {
			afterContent: "# Synthetic Queue Fixture\n",
			afterSha256: "0".repeat(64),
			lineDiff: [],
			hasTextChanges: true,
		},
		conflicts: [],
		review: {
			requiresExplicitReview: true,
			destructive: false,
			reasons: ["Synthetic queue fixture staged change."],
		},
		recovery: {
			commandId: "voidbrain.ingest-source",
			stagedChangeId: changeId,
			targetPath: makeNormalizedVaultPath(targetPath),
			status: "retryable",
			validationOutput: [],
		},
		createdAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
		updatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
	}) satisfies StagedChangeRecord;

export const createQueueFixtureSummary = (): SourceIngestionQueueSummary => ({
	commandId: "voidbrain.ingest-source",
	queueId: "queue-fixture",
	status: "failed",
	concurrency: 2,
	startedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
	updatedAt: makeIsoTimestamp("2026-05-13T00:01:00.000Z"),
	completedAt: makeIsoTimestamp("2026-05-13T00:01:00.000Z"),
	counts: {
		total: 2,
		queued: 0,
		running: 0,
		staged: 1,
		failed: 1,
		canceled: 0,
		skipped: 0,
		retryable: 1,
		providerBlocked: 1,
		citationBlocked: 0,
	},
	items: [
		{
			itemId: "queue-item-safe",
			queueId: "queue-fixture",
			index: 0,
			status: "staged",
			sourceKind: "markdown-file",
			title: "Synthetic Source Ingestion Demo",
			sourcePath: makeNormalizedVaultPath("inbox/source-ingestion-demo.md"),
			contentSha256: "a".repeat(64),
			contentBytes: 120,
			targetPaths: [makeNormalizedVaultPath("sources/synthetic-source-ingestion-demo.md")],
			citationState: "valid",
			stagedChangeIds: ["stage-queue-safe"],
			validationOutput: [],
			retryable: false,
			retryCount: 0,
			recovery: {
				commandId: "voidbrain.ingest-source",
				queueId: "queue-fixture",
				itemId: "queue-item-safe",
				sourcePath: makeNormalizedVaultPath("inbox/source-ingestion-demo.md"),
				contentSha256: "a".repeat(64),
				targetPaths: [makeNormalizedVaultPath("sources/synthetic-source-ingestion-demo.md")],
				stagedChangeIds: ["stage-queue-safe"],
				validationOutput: [],
				retryGuidance: "Review staged-change IDs before apply.",
				updatedAt: makeIsoTimestamp("2026-05-13T00:01:00.000Z"),
			},
		},
		{
			itemId: "queue-item-provider-denied",
			queueId: "queue-fixture",
			index: 1,
			status: "failed",
			sourceKind: "markdown-file",
			title: "Synthetic Provider Denied Source",
			sourcePath: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
			contentSha256: "b".repeat(64),
			contentBytes: 90,
			targetPaths: [makeNormalizedVaultPath("sources/synthetic-provider-denied-source.md")],
			citationState: "not-checked",
			stagedChangeIds: [],
			validationOutput: [
				{
					code: "record.invalid-state",
					message: "Provider preflight denied optional source ingestion assistance.",
					field: "providerDecision",
					path: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
				},
			],
			retryable: true,
			retryCount: 0,
			failureCode: "ingestion.provider-denied",
			message: "Provider preflight denied optional source ingestion assistance.",
			recovery: {
				commandId: "voidbrain.ingest-source",
				queueId: "queue-fixture",
				itemId: "queue-item-provider-denied",
				sourcePath: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
				contentSha256: "b".repeat(64),
				targetPaths: [makeNormalizedVaultPath("sources/synthetic-provider-denied-source.md")],
				stagedChangeIds: [],
				validationOutput: [
					{
						code: "record.invalid-state",
						message: "Provider preflight denied optional source ingestion assistance.",
						field: "providerDecision",
						path: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
					},
				],
				retryGuidance: "Review provider settings, then retry or discard this item.",
				updatedAt: makeIsoTimestamp("2026-05-13T00:01:00.000Z"),
			},
		},
	],
	sourcePaths: [
		makeNormalizedVaultPath("inbox/source-ingestion-demo.md"),
		makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
	],
	targetPaths: [
		makeNormalizedVaultPath("sources/synthetic-source-ingestion-demo.md"),
		makeNormalizedVaultPath("sources/synthetic-provider-denied-source.md"),
	],
	stagedChangeIds: ["stage-queue-safe"],
	validationOutput: [
		{
			code: "record.invalid-state",
			message: "Provider preflight denied optional source ingestion assistance.",
			field: "providerDecision",
			path: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
		},
	],
	recovery: {
		commandId: "voidbrain.ingest-source",
		queueId: "queue-fixture",
		sourcePaths: [
			makeNormalizedVaultPath("inbox/source-ingestion-demo.md"),
			makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
		],
		targetPaths: [
			makeNormalizedVaultPath("sources/synthetic-source-ingestion-demo.md"),
			makeNormalizedVaultPath("sources/synthetic-provider-denied-source.md"),
		],
		stagedChangeIds: ["stage-queue-safe"],
		validationOutput: [
			{
				code: "record.invalid-state",
				message: "Provider preflight denied optional source ingestion assistance.",
				field: "providerDecision",
				path: makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"),
			},
		],
		retryGuidance: "Retry failed or canceled queue items after reviewing validation output.",
		updatedAt: makeIsoTimestamp("2026-05-13T00:01:00.000Z"),
	},
});
