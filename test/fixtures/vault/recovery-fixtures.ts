import type { SourceIngestionRecoveryRecord } from "../../../src/types/ingestion";
import { INGEST_SOURCE_COMMAND_ID } from "../../../src/types/ingestion";
import type { OperationLog, StagedChangeRecord, ValidationIssue } from "../../../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../../../src/utils/vault-paths";
import {
	HOT_CACHE_FIXTURE_CONVERSATION_PATH,
	HOT_CACHE_FIXTURE_SOURCE_PATH,
	HOT_CACHE_FIXTURE_TIMESTAMP,
	createHotCacheHealthReport,
	createHotCacheStagedChange,
	createHotCacheStateFixture,
} from "./hot-cache-fixtures";

export const RECOVERY_FIXTURE_NOTE =
	"Recovery fixtures are synthetic support records only and contain no provider secrets or private paths.";

export const RECOVERY_FIXTURE_NOW = new Date("2026-05-13T02:00:00.000Z");
export const RECOVERY_FIXTURE_STALE_NOW = new Date("2026-06-20T02:00:00.000Z");
export const RECOVERY_OPERATION_LOG_PATH = makeNormalizedVaultPath(".voidbrain/logs/recovery-operation-log.json");
export const RECOVERY_STAGED_CHANGE_PATH = makeNormalizedVaultPath(
	".voidbrain/staged-changes/stage-hot-cache-summary.json",
);

export const createRecoveryValidationIssue = (): ValidationIssue => ({
	code: "record.invalid-operation",
	message: "Synthetic recovery validation issue.",
	path: HOT_CACHE_FIXTURE_CONVERSATION_PATH,
	field: "recovery.validationOutput",
});

export const createRecoveryOperationLog = (): OperationLog => ({
	artifactKind: "operation-log",
	schemaVersion: 1,
	logId: "operation-log-recovery-fixture",
	entries: [
		{
			id: "operation-hot-cache-captured",
			operationKind: "hot-cache-captured",
			occurredAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			status: "succeeded",
			summary: "Captured synthetic hot cache recovery support record.",
			paths: [HOT_CACHE_SUPPORT_PATH],
		},
		{
			id: "operation-staged-change-created",
			operationKind: "staged-change-created",
			occurredAt: HOT_CACHE_FIXTURE_TIMESTAMP,
			status: "succeeded",
			summary: "Created synthetic staged conversation summary.",
			paths: [HOT_CACHE_FIXTURE_CONVERSATION_PATH, RECOVERY_STAGED_CHANGE_PATH],
		},
	],
});

export const createRecoveryIngestionRecord = (): SourceIngestionRecoveryRecord => ({
	commandId: INGEST_SOURCE_COMMAND_ID,
	sourcePath: HOT_CACHE_FIXTURE_SOURCE_PATH,
	contentSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	stagedChangeIds: ["stage-hot-cache-summary"],
	targetPaths: [HOT_CACHE_FIXTURE_CONVERSATION_PATH],
	providerDecision: {
		kind: "not-requested",
		allowed: false,
		providerId: null,
		modelId: null,
		code: null,
		userMessage: "Synthetic recovery fixture did not request provider extraction.",
		attempts: [],
		diagnostic: {
			reason: "not-requested",
		},
	},
	validationOutput: [],
	retryGuidance: "Inspect staged-change IDs and rerun ingestion if the synthetic fixture is stale.",
	updatedAt: HOT_CACHE_FIXTURE_TIMESTAMP,
});

export const createRecoveryCompleteInput = () => ({
	hotCache: createHotCacheStateFixture(),
	hotCachePath: HOT_CACHE_SUPPORT_PATH,
	stagedChanges: [createHotCacheStagedChange()],
	healthReport: createHotCacheHealthReport(),
	operationLog: createRecoveryOperationLog(),
	ingestionRecoveries: [createRecoveryIngestionRecord()],
	supportRecords: [
		{
			sourceKind: "staged-change" as const,
			sourcePath: RECOVERY_STAGED_CHANGE_PATH,
			value: createHotCacheStagedChange(),
		},
	],
	now: RECOVERY_FIXTURE_NOW,
});

export const createRecoveryMissingInput = () => ({
	hotCachePath: HOT_CACHE_SUPPORT_PATH,
	stagedChanges: [],
	ingestionRecoveries: [],
	now: RECOVERY_FIXTURE_NOW,
});

export const createRecoveryMalformedRecords = () => ({
	hotCache: {
		artifactKind: "hot-cache",
		schemaVersion: 1,
		cacheId: "",
		cachePath: HOT_CACHE_SUPPORT_PATH,
	},
	operationLog: {
		artifactKind: "operation-log",
		schemaVersion: 1,
		logId: "",
		entries: "not-an-array",
	},
	supportRecords: [
		{
			sourceKind: "adapter-read" as const,
			sourcePath: ".voidbrain/cache/malformed.json",
			value: {
				artifactKind: "unsupported-fixture",
				schemaVersion: 1,
			},
		},
	],
	now: RECOVERY_FIXTURE_NOW,
});

export const createRecoveryStaleInput = () => ({
	hotCache: createHotCacheStateFixture(),
	stagedChanges: [createHotCacheStagedChange()],
	operationLog: createRecoveryOperationLog(),
	now: RECOVERY_FIXTURE_STALE_NOW,
});

export const createRecoveryRecordWithBodyFields = (): StagedChangeRecord => ({
	...createHotCacheStagedChange(),
	diff: {
		...createHotCacheStagedChange().diff,
		beforeContent: "# Synthetic Before\n\nThis raw body must not appear in recovery output.\n",
		afterContent: "# Synthetic After\n\nThis raw body must not appear in recovery output.\n",
	},
	recovery: {
		...createHotCacheStagedChange().recovery,
		validationOutput: [createRecoveryValidationIssue()],
	},
});

export const createRecoverySecretLikeRecord = () => {
	const sensitiveFieldName = ["api", "Key"].join("");
	return {
		...createHotCacheStateFixture(),
		entries: createHotCacheStateFixture().entries.map((entry, index) =>
			index === 0
				? {
						...entry,
						metadata: {
							...entry.metadata,
							[sensitiveFieldName]: "fixture-redaction-value",
						},
					}
				: entry,
		),
	};
};
