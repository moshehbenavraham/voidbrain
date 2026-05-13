import type { ChatThreadState } from "../../../src/types/chat";
import {
	makeChatBranchId,
	makeChatCitationId,
	makeChatContextChipId,
	makeChatThreadId,
	makeChatTurnId,
} from "../../../src/types/chat";
import type { VaultHealthReport } from "../../../src/types/health";
import type { IndexingRuntimeReport, SemanticIndexReadiness } from "../../../src/types/indexing-runtime";
import type { HotCacheState, StagedChangeRecord } from "../../../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../../../src/utils/vault-paths";

export const HOT_CACHE_FIXTURE_TIMESTAMP = makeIsoTimestamp("2026-05-13T01:00:00.000Z");
export const HOT_CACHE_FIXTURE_CACHE_ID = "hot-cache-fixture";
export const HOT_CACHE_FIXTURE_SOURCE_PATH = makeNormalizedVaultPath("sources/hot-cache-source.md");
export const HOT_CACHE_FIXTURE_SUMMARY_PATH = makeNormalizedVaultPath("summaries/hot-cache-summary.md");
export const HOT_CACHE_FIXTURE_CONVERSATION_PATH = makeNormalizedVaultPath(
	"conversations/hot-cache-session-summary.md",
);

export const HOT_CACHE_FIXTURE_SOURCE_MARKDOWN = [
	"---",
	"title: Hot Cache Source",
	"tags: [fixture, hot-cache]",
	"---",
	"# Hot Cache Source",
	"",
	"Hot cache fixtures are synthetic and cover reload recovery without provider secrets.",
	"They store bounded summaries, citation paths, command ids, and validation output only.",
].join("\n");

export const createHotCacheChatThread = (): ChatThreadState => ({
	schemaVersion: 1,
	threadId: makeChatThreadId("thread-hot-cache-fixture"),
	activeBranchId: makeChatBranchId("branch-main"),
	draft: {
		text: "Summarize the synthetic hot cache recovery path.",
		updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
		contextChips: [
			{
				id: makeChatContextChipId("context-hot-cache-source"),
				kind: "selected-path",
				label: "Hot cache source",
				path: HOT_CACHE_FIXTURE_SOURCE_PATH,
				heading: "Hot Cache Source",
				sourceRecordId: "source-hot-cache",
			},
		],
	},
	turns: [
		{
			id: makeChatTurnId("turn-hot-cache-answer"),
			parentTurnId: null,
			branchId: makeChatBranchId("branch-main"),
			status: "answer-ready",
			question: "How does the synthetic hot cache preserve recovery context?",
			contextChips: [
				{
					id: makeChatContextChipId("context-hot-cache-source"),
					kind: "selected-path",
					label: "Hot cache source",
					path: HOT_CACHE_FIXTURE_SOURCE_PATH,
					heading: "Hot Cache Source",
					sourceRecordId: "source-hot-cache",
				},
			],
			retrievalQuery: null,
			retrievalPreview: [],
			persistedRetrieval: [],
			citations: [
				{
					id: makeChatCitationId("cite-hot-cache-source"),
					label: "[1]",
					resultId: "result-hot-cache-source",
					vaultPath: HOT_CACHE_FIXTURE_SOURCE_PATH,
					heading: "Hot Cache Source",
					chunkId: "chunk-hot-cache-source",
					sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
					score: 0.92,
				},
			],
			answer: "It keeps bounded summaries and recovery identifiers in local support records.",
			failure: null,
			retry: {
				sourceTurnId: makeChatTurnId("turn-hot-cache-answer"),
				retryOfTurnId: null,
				attempt: 0,
				lastFailureCode: null,
				canRetry: false,
			},
			providerDecision: null,
			providerAttempts: [],
			createdAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
		},
	],
	branches: [
		{
			branchId: makeChatBranchId("branch-main"),
			parentBranchId: null,
			sourceTurnId: null,
			label: "Main",
			createdAt: HOT_CACHE_FIXTURE_TIMESTAMP,
		},
	],
	inFlightTurnId: null,
	lastFailure: null,
	createdAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
});

export const createHotCacheIndexReport = (): IndexingRuntimeReport => ({
	indexId: "hot-cache-lexical-index",
	jobId: "hot-cache-job",
	status: "ready",
	readinessState: "ready",
	progress: null,
	freshness: null,
	indexedNoteCount: 1,
	totalNoteCount: 1,
	skippedPaths: [],
	failedPaths: [],
	stalePaths: [],
	missingPaths: [],
	extraPaths: [],
	currentPath: null,
	updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	message: "Synthetic hot cache lexical index is ready.",
});

export const createHotCacheSemanticReadiness = (): SemanticIndexReadiness => ({
	state: "disabled",
	readinessState: "disabled",
	checkedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	contentSensitivity: "private-vault",
	providerId: null,
	modelId: null,
	sourcePathCount: 1,
	message: "Semantic indexing is disabled for the synthetic hot cache fixture.",
	diagnosticCode: null,
});

export const createHotCacheHealthReport = (): VaultHealthReport => ({
	reportId: "health-hot-cache-fixture",
	generatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	scannedPaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
	indexStates: {},
	findings: [],
	groups: [],
	summary: {
		totalFindings: 0,
		errorCount: 0,
		warningCount: 0,
		infoCount: 0,
		findingCounts: {
			"broken-wikilink": 0,
			"content-gap": 0,
			"missing-citation": 0,
			"orphan-note": 0,
			"stale-index": 0,
		},
	},
});

export const createHotCacheStagedChange = (): StagedChangeRecord => ({
	artifactKind: "staged-change",
	schemaVersion: 1,
	changeId: "stage-hot-cache-summary",
	operationKind: "create-note",
	status: "review-ready",
	targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
	createdAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	rationale: "Stage a synthetic conversation summary for review.",
	sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
	afterSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	diff: {
		afterContent: "# Hot Cache Session Summary\n\nSynthetic summary with source trace.\n",
		afterSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		lineDiff: [
			{ kind: "added", newLineNumber: 1, content: "# Hot Cache Session Summary" },
			{ kind: "added", newLineNumber: 2, content: "" },
			{ kind: "added", newLineNumber: 3, content: "Synthetic summary with source trace." },
		],
		hasTextChanges: true,
	},
	conflicts: [],
	review: {
		requiresExplicitReview: true,
		destructive: false,
		reasons: ["new-note"],
	},
	recovery: {
		commandId: "voidbrain.save-session-summary",
		stagedChangeId: "stage-hot-cache-summary",
		targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
		status: "pending-review",
		validationOutput: [],
	},
});

export const createHotCacheStateFixture = (): HotCacheState => ({
	artifactKind: "hot-cache",
	schemaVersion: 1,
	cacheId: HOT_CACHE_FIXTURE_CACHE_ID,
	cachePath: HOT_CACHE_SUPPORT_PATH,
	updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
	entryLimit: 24,
	redaction: {
		redacted: true,
		redactedFieldCount: 0,
		omittedBodyCount: 2,
		notes: ["Raw note bodies and provider state are omitted from this synthetic cache."],
	},
	entries: [
		{
			key: "thread-hot-cache-fixture",
			kind: "chat-thread",
			path: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
			lastAccessedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			summary: "Thread thread-hot-cache-fixture has 1 bounded turn and 1 selected context chip.",
			metadata: {
				threadId: "thread-hot-cache-fixture",
				activeBranchId: "branch-main",
				draftPreview: "Summarize the synthetic hot cache recovery path.",
				turnCount: 1,
				lastTurnStatus: "answer-ready",
			},
			recovery: {
				commandId: "voidbrain.chat-with-vault",
				cachePath: HOT_CACHE_SUPPORT_PATH,
				targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
				validationOutput: [],
			},
		},
		{
			key: "context-hot-cache-source",
			kind: "context-chip",
			path: HOT_CACHE_FIXTURE_SOURCE_PATH,
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
			lastAccessedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			summary: "Selected context chip for sources/hot-cache-source.md.",
			metadata: {
				chipId: "context-hot-cache-source",
				chipKind: "selected-path",
				label: "Hot cache source",
				heading: "Hot Cache Source",
				sourceRecordId: "source-hot-cache",
			},
			recovery: {
				commandId: "voidbrain.chat-with-vault",
				cachePath: HOT_CACHE_SUPPORT_PATH,
				targetPath: HOT_CACHE_FIXTURE_SOURCE_PATH,
				validationOutput: [],
			},
		},
		{
			key: "health-hot-cache-fixture",
			kind: "health-report",
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
			lastAccessedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			summary: "Health report health-hot-cache-fixture scanned 1 path with 0 findings.",
			metadata: {
				reportId: "health-hot-cache-fixture",
				scannedPathCount: 1,
				totalFindings: 0,
				errorCount: 0,
				warningCount: 0,
			},
			recovery: {
				commandId: "voidbrain.health-check",
				cachePath: HOT_CACHE_SUPPORT_PATH,
				reportId: "health-hot-cache-fixture",
				validationOutput: [],
			},
		},
		{
			key: "hot-cache-lexical-index",
			kind: "index-readiness",
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
			lastAccessedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			summary: "Index hot-cache-lexical-index is ready with 1 of 1 notes indexed.",
			metadata: {
				indexId: "hot-cache-lexical-index",
				status: "ready",
				readinessState: "ready",
				indexedNoteCount: 1,
				totalNoteCount: 1,
				failedPathCount: 0,
			},
			recovery: {
				commandId: "voidbrain.hot-cache",
				cachePath: HOT_CACHE_SUPPORT_PATH,
				validationOutput: [],
			},
		},
		{
			key: "stage-hot-cache-summary",
			kind: "staged-change",
			path: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
			sourcePaths: [HOT_CACHE_FIXTURE_SOURCE_PATH],
			lastAccessedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			summary:
				"Staged change stage-hot-cache-summary is review-ready for conversations/hot-cache-session-summary.md.",
			metadata: {
				changeId: "stage-hot-cache-summary",
				operationKind: "create-note",
				status: "review-ready",
				targetPath: "conversations/hot-cache-session-summary.md",
			},
			recovery: {
				commandId: "voidbrain.save-session-summary",
				cachePath: HOT_CACHE_SUPPORT_PATH,
				targetPath: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
				stagedChangeId: "stage-hot-cache-summary",
				validationOutput: [],
			},
		},
	],
	recovery: {
		commandId: "voidbrain.hot-cache",
		cachePath: HOT_CACHE_SUPPORT_PATH,
		validationOutput: [],
	},
});

export const createHotCacheFixtureFiles = () => [
	{
		path: HOT_CACHE_FIXTURE_SOURCE_PATH,
		content: HOT_CACHE_FIXTURE_SOURCE_MARKDOWN,
	},
];
