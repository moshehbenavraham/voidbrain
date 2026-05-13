import { AGENT_COMMAND_CATALOG, REQUIRED_AGENT_SURFACE_PHRASES } from "../../../src/agent/command-catalog";
import type { MaintenanceRecommendationPlannerInput } from "../../../src/agent/maintenance-recommendation-planner";
import type { SimilarNoteSuggestionPlannerInput } from "../../../src/agent/similar-note-suggestion-service";
import type { FrameworkUpdatePreviewInput } from "../../../src/types/agent-commands";
import type { FixtureSafetyEntry } from "../../../src/types/agent-commands";
import type { SourceIngestionIntakeRequest } from "../../../src/types/ingestion";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../../../src/utils/vault-paths";
import {
	completeSurfaceMarkdownForCommands,
	fixtureSurface,
	surfaceMarkdownWithStaleStatus,
} from "./agent-surface-validation-fixtures";
import {
	conflictingFrameworkPreviewCandidates,
	frameworkPreviewCurrentFiles,
	frameworkPreviewNow,
	pathOnlyPreviewCandidates,
	safeFrameworkPreviewCandidates,
	unsafeFrameworkPreviewCandidate,
} from "./framework-update-preview-fixtures";
import {
	MAINTENANCE_FIXED_DATE,
	createMaintenanceActiveStagedChange,
	createMaintenanceHealthReport,
	createMaintenanceIndexFreshnessSnapshots,
	createMaintenanceRetrievalResults,
	loadMaintenanceCurrentNotes,
} from "./maintenance-recommendation-fixtures";
import {
	RECOVERY_FIXTURE_NOW,
	createRecoveryCompleteInput,
	createRecoveryMalformedRecords,
	createRecoveryMissingInput,
	createRecoveryRecordWithBodyFields,
	createRecoverySecretLikeRecord,
	createRecoveryStaleInput,
} from "./recovery-fixtures";
import {
	SIMILAR_NOTE_FIXED_DATE,
	createSimilarActiveStagedChange,
	createSimilarNoteRetrievalResults,
	loadSimilarNoteCurrentNotes,
	loadSimilarNoteFixtureNotes,
} from "./similar-note-suggestion-fixtures";
import {
	QUEUE_CITATION_FAILURE_REQUEST,
	QUEUE_DUPLICATE_SOURCE_REQUESTS,
	QUEUE_PARTIAL_FAILURE_REQUESTS,
	QUEUE_PROVIDER_DENIED_REQUEST,
	QUEUE_SAFE_BATCH_REQUESTS,
	QUEUE_SAFE_MARKDOWN_REQUEST,
	QUEUE_SAFE_TEXT_REQUEST,
	QUEUE_SAFE_URL_REQUEST,
} from "./source-ingestion-queue-fixtures";

export const PHASE02_INTEGRATION_FIXTURE_MESSAGE =
	"Phase 02 integration fixtures are synthetic local records only and contain no provider secrets, private paths, or live provider payloads.";

export const PHASE02_INTEGRATION_NOW = new Date("2026-05-13T00:00:00.000Z");
export const PHASE02_INTEGRATION_TIMESTAMP = makeIsoTimestamp("2026-05-13T00:00:00.000Z");
export const PHASE02_INTEGRATION_REPORT_ID = "phase02-integration-report";
export const PHASE02_INTEGRATION_CACHE_PATH = HOT_CACHE_SUPPORT_PATH;
export const PHASE02_INTEGRATION_STAGED_CHANGE_ID = "stage-phase02-integration-summary";
export const PHASE02_INTEGRATION_TARGET_PATH = makeNormalizedVaultPath("summaries/phase02-integration-summary.md");

export const PHASE02_CLOSEOUT_COMMAND_IDS = [
	"voidbrain.ingest-source",
	"voidbrain.chat-with-vault",
	"voidbrain.health-check",
	"voidbrain.stage-change",
	"voidbrain.recover-session",
	"voidbrain.validate-agent-surfaces",
	"voidbrain.preview-framework-update",
] as const;

export const PHASE02_REQUIRED_RECOVERY_FIELDS = [
	"commandId",
	"targetPath",
	"cachePath",
	"stagedChangeId",
	"reportId",
	"validationOutput",
] as const;

export const PHASE02_PRIVATE_CONTENT_SENTINELS = [
	"Synthetic source content",
	"Synthetic retrieval body text",
	"Synthetic placement retrieval body text",
	"This raw body must not appear",
	"fixture-redaction-value",
] as const;

export const phase02CloseoutSupportRecord = {
	commandId: "voidbrain.recover-session",
	cachePath: PHASE02_INTEGRATION_CACHE_PATH,
	targetPath: PHASE02_INTEGRATION_TARGET_PATH,
	stagedChangeId: PHASE02_INTEGRATION_STAGED_CHANGE_ID,
	reportId: PHASE02_INTEGRATION_REPORT_ID,
	validationOutput: [
		{
			code: "record.invalid-state",
			message: "Synthetic closeout validation issue.",
			path: PHASE02_INTEGRATION_TARGET_PATH,
			field: "phase02.closeout",
		},
	],
	updatedAt: PHASE02_INTEGRATION_TIMESTAMP,
} as const;

export const createPhase02RecoveryFixtureSet = () => ({
	complete: createRecoveryCompleteInput(),
	missing: createRecoveryMissingInput(),
	malformed: createRecoveryMalformedRecords(),
	stale: createRecoveryStaleInput(),
	redaction: {
		hotCache: createRecoverySecretLikeRecord(),
		stagedChanges: [createRecoveryRecordWithBodyFields()],
		now: RECOVERY_FIXTURE_NOW,
	},
});

export const createPhase02SurfaceFixtureSet = () => ({
	surface: fixtureSurface,
	completeMarkdown: completeSurfaceMarkdownForCommands(AGENT_COMMAND_CATALOG),
	staleStatusMarkdown: surfaceMarkdownWithStaleStatus(
		AGENT_COMMAND_CATALOG,
		"voidbrain.preview-framework-update",
		"planned",
	),
	missingSafetyMarkdown: PHASE02_CLOSEOUT_COMMAND_IDS.map((commandId) => `- \`${commandId}\``).join("\n"),
	requiredSafetyPhrases: REQUIRED_AGENT_SURFACE_PHRASES,
});

export const createPhase02FixtureSafetyEntries = (): readonly FixtureSafetyEntry[] => [
	{
		path: "docs/phase02-safe-closeout.md",
		content: [
			"# Phase 02 Safe Closeout",
			"",
			"Use test/fixtures/vault/ records, staged changes, citations, dry-run plans, and recovery IDs.",
			"",
		].join("\n"),
	},
	{
		path: "docs/phase02-unsafe-closeout.md",
		content: [
			"# Phase 02 Unsafe Closeout",
			"",
			["api", "_key: ", "fixture-value"].join(""),
			["sk-", "fixture", "credential", "example", "0000000000000000"].join(""),
			["/ho", "me/fixture-user/private-vault.md"].join(""),
			"",
		].join("\n"),
	},
];

export const createPhase02FrameworkPreviewFixtureSet = () =>
	({
		safe: {
			rootDir: ".",
			candidates: safeFrameworkPreviewCandidates,
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		},
		excluded: {
			rootDir: ".",
			candidatePaths: pathOnlyPreviewCandidates,
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		},
		conflict: {
			rootDir: ".",
			candidates: conflictingFrameworkPreviewCandidates,
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		},
		unsafe: {
			rootDir: ".",
			candidates: [unsafeFrameworkPreviewCandidate()],
			now: frameworkPreviewNow,
		},
		readFailure: {
			rootDir: ".",
			candidatePaths: ["AGENTS.md", "docs/missing-framework-file.md"],
			currentFileReadFailures: [
				{
					path: "AGENTS.md",
					message: "Synthetic read failure.",
				},
			],
			now: frameworkPreviewNow,
		},
	}) satisfies Readonly<Record<string, FrameworkUpdatePreviewInput>>;

export const createPhase02MaintenanceFixtureSet = () => {
	const healthReport = createMaintenanceHealthReport();
	const planInput = {
		healthReport,
		indexFreshness: createMaintenanceIndexFreshnessSnapshots(),
		retrievalResults: createMaintenanceRetrievalResults(),
		stagedChanges: [createMaintenanceActiveStagedChange("failed")],
		now: MAINTENANCE_FIXED_DATE,
	} satisfies MaintenanceRecommendationPlannerInput;

	return {
		healthReport,
		planInput,
		stageInput: {
			report: healthReport,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		},
	};
};

export const createPhase02SimilarNoteFixtureSet = () => {
	const planInput = {
		notes: loadSimilarNoteFixtureNotes(),
		retrievalResults: createSimilarNoteRetrievalResults(),
		stagedChanges: [createSimilarActiveStagedChange("failed")],
		now: SIMILAR_NOTE_FIXED_DATE,
	} satisfies SimilarNoteSuggestionPlannerInput;

	return {
		planInput,
		stageInput: {
			existingNotes: loadSimilarNoteCurrentNotes(),
			existingStagedChanges: [],
		},
	};
};

export const createPhase02QueueFixtureSet = () =>
	({
		safeBatch: [...QUEUE_SAFE_BATCH_REQUESTS],
		partialFailure: [...QUEUE_PARTIAL_FAILURE_REQUESTS],
		providerDenied: [QUEUE_PROVIDER_DENIED_REQUEST],
		duplicates: [...QUEUE_DUPLICATE_SOURCE_REQUESTS],
		cancelAndRetry: [QUEUE_SAFE_TEXT_REQUEST, QUEUE_SAFE_URL_REQUEST],
		citationFailure: QUEUE_CITATION_FAILURE_REQUEST,
		safeMarkdown: QUEUE_SAFE_MARKDOWN_REQUEST,
		safeUrl: QUEUE_SAFE_URL_REQUEST,
	}) satisfies {
		readonly safeBatch: readonly SourceIngestionIntakeRequest[];
		readonly partialFailure: readonly SourceIngestionIntakeRequest[];
		readonly providerDenied: readonly SourceIngestionIntakeRequest[];
		readonly duplicates: readonly SourceIngestionIntakeRequest[];
		readonly cancelAndRetry: readonly SourceIngestionIntakeRequest[];
		readonly citationFailure: SourceIngestionIntakeRequest;
		readonly safeMarkdown: SourceIngestionIntakeRequest;
		readonly safeUrl: SourceIngestionIntakeRequest;
	};
