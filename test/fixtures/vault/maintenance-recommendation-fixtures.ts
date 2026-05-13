import { VaultHealthRuntimeService } from "../../../src/agent";
import type { VaultHealthReport } from "../../../src/types/health";
import type {
	IndexFreshnessSnapshot,
	IndexSourceFingerprint,
	RetrievalSearchResult,
} from "../../../src/types/retrieval";
import type { StagedChangeRecord, StagedChangeStatus } from "../../../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import { evaluateIndexFreshness } from "../../../src/vectorstore";
import {
	HEALTH_BROKEN_LINK_PATH,
	HEALTH_CONTENT_GAP_PATH,
	HEALTH_ORPHAN_PATH,
	HEALTH_SOURCE_PATH,
	HEALTH_SUMMARY_PATH,
	VAULT_HEALTH_RUNTIME_ALIASES,
	VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
	loadVaultHealthRuntimeFixtureNotes,
} from "./vault-health-runtime-fixtures";

export const MAINTENANCE_RECOMMENDATION_FIXTURE_MESSAGE =
	"Maintenance recommendation fixtures are synthetic vault notes only and contain no provider secrets, private paths, or live provider payloads.";

export const MAINTENANCE_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");
export const MAINTENANCE_FIXED_TIMESTAMP = makeIsoTimestamp("2026-05-13T00:00:00.000Z");

const fingerprint = (path: string, contentFingerprint: string): IndexSourceFingerprint => ({
	path: makeNormalizedVaultPath(path),
	contentFingerprint,
});

export const createMaintenanceIndexFreshnessSnapshots = (): readonly IndexFreshnessSnapshot[] => {
	const currentSources = [
		fingerprint(HEALTH_SOURCE_PATH, "current-source"),
		fingerprint(HEALTH_SUMMARY_PATH, "current-summary"),
		fingerprint(HEALTH_CONTENT_GAP_PATH, "current-gap"),
		fingerprint(HEALTH_ORPHAN_PATH, "current-orphan"),
		fingerprint(HEALTH_BROKEN_LINK_PATH, "current-broken-link"),
	];
	const indexedSources = [
		fingerprint(HEALTH_SOURCE_PATH, "stale-source"),
		fingerprint("summaries/obsolete-maintenance-summary.md", "obsolete"),
	];

	return [
		evaluateIndexFreshness("maintenance-lexical-index", indexedSources, currentSources, MAINTENANCE_FIXED_DATE),
	];
};

export const createMaintenanceHealthReport = (): VaultHealthReport => {
	const service = new VaultHealthRuntimeService({
		now: () => MAINTENANCE_FIXED_DATE,
	});
	const result = service.scanMarkdownNotes({
		notes: loadVaultHealthRuntimeFixtureNotes(),
		knownPaths: VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
		pathAliases: VAULT_HEALTH_RUNTIME_ALIASES,
		freshnessSnapshots: createMaintenanceIndexFreshnessSnapshots(),
		reportId: "maintenance-health-report",
	});
	if (!result.ok) {
		throw new Error(`Maintenance health fixture scan failed: ${JSON.stringify(result.issues)}`);
	}

	return result.report;
};

export const createMaintenanceRetrievalResults = (): readonly RetrievalSearchResult[] => [
	{
		ok: true,
		query: {
			query: "health source citation",
			limit: 2,
		},
		results: [
			{
				id: "retrieval-maintenance-summary",
				path: makeNormalizedVaultPath(HEALTH_SUMMARY_PATH),
				heading: "Health Summary Missing Citation",
				headingLevel: 1,
				snippet: "Synthetic retrieval body text that must not be copied into recommendation output.",
				score: 0.86,
				scoreDetails: {
					method: "lexical",
					score: 0.86,
					normalizedScore: 0.86,
					matchedTokens: ["health", "citation"],
				},
				chunkId: "chunk-maintenance-summary",
				sourcePaths: [makeNormalizedVaultPath(HEALTH_SOURCE_PATH)],
			},
		],
	},
	{
		ok: false,
		code: "retrieval.index-not-ready",
		message: "Synthetic retrieval index is stale.",
		field: "indexId",
	},
];

export const createMaintenanceActiveStagedChange = (
	status: StagedChangeStatus = "review-ready",
): StagedChangeRecord => ({
	artifactKind: "staged-change",
	schemaVersion: 1,
	changeId: `maintenance-${status}-change`,
	operationKind: "update-frontmatter",
	status,
	targetPath: makeNormalizedVaultPath(HEALTH_SUMMARY_PATH),
	createdAt: MAINTENANCE_FIXED_TIMESTAMP,
	updatedAt: MAINTENANCE_FIXED_TIMESTAMP,
	rationale: "Synthetic maintenance staged change fixture.",
	sourcePaths: [makeNormalizedVaultPath(HEALTH_SOURCE_PATH)],
	diff: {
		lineDiff: [],
		hasTextChanges: false,
	},
	conflicts: [],
	review: {
		requiresExplicitReview: true,
		destructive: false,
		reasons: ["frontmatter-edit"],
	},
	recovery: {
		commandId: "voidbrain.health-check",
		stagedChangeId: `maintenance-${status}-change`,
		targetPath: makeNormalizedVaultPath(HEALTH_SUMMARY_PATH),
		status: status === "failed" ? "failed-apply" : "pending-review",
		validationOutput: [],
	},
});

export const loadMaintenanceCurrentNotes = () => loadVaultHealthRuntimeFixtureNotes();
