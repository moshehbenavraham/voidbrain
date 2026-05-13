import { describe, expect, it } from "vitest";
import { createRuntimeStatusSnapshot, planMaintenanceRecommendations, planSimilarNoteSuggestions } from "../src/agent";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderDefinitionsForSettings,
	makeProviderModelId,
	normalizeProviderProfiles,
} from "../src/providers";
import type { VaultHealthReport } from "../src/types/health";
import type { IndexingRuntimeReport, SemanticIndexReadiness } from "../src/types/indexing-runtime";
import { DEFAULT_PLUGIN_SETTINGS } from "../src/types/plugin";
import type { IndexSourceFingerprint } from "../src/types/retrieval";
import type { StagedChangeRecord, StagedChangeStatus } from "../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { createProgressSnapshot, evaluateIndexFreshness } from "../src/vectorstore";
import { SYNTHETIC_CLOUD_PROFILE_INPUT } from "./fixtures/providers/provider-setup-fixtures";
import { createHotCacheStateFixture } from "./fixtures/vault/hot-cache-fixtures";
import {
	createMaintenanceActiveStagedChange,
	createMaintenanceHealthReport,
	createMaintenanceIndexFreshnessSnapshots,
	createMaintenanceRetrievalResults,
} from "./fixtures/vault/maintenance-recommendation-fixtures";
import {
	SIMILAR_CONCEPT_PATH,
	SIMILAR_NOTE_FIXED_DATE,
	createSimilarNoteRetrievalResults,
	loadSimilarNoteFixtureNotes,
} from "./fixtures/vault/similar-note-suggestion-fixtures";
import { createQueueFixtureSummary } from "./fixtures/vault/source-ingestion-queue-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");
const fixedTimestamp = makeIsoTimestamp("2026-05-13T00:00:00.000Z");
const hotCacheStatus = () => ({
	state: createHotCacheStateFixture(),
	cachePath: makeNormalizedVaultPath(".voidbrain/cache/hot-cache.json"),
	isWriteInFlight: false,
});

const sourceFingerprint = (path: string, fingerprint: string): IndexSourceFingerprint => ({
	path: makeNormalizedVaultPath(path),
	contentFingerprint: fingerprint,
});

const indexingReport = (overrides: Partial<IndexingRuntimeReport> = {}): IndexingRuntimeReport => ({
	indexId: "runtime-index",
	jobId: "runtime-job",
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
	updatedAt: fixedTimestamp,
	message: "Synthetic runtime index report.",
	...overrides,
});

const semanticReadiness = (overrides: Partial<SemanticIndexReadiness> = {}): SemanticIndexReadiness => ({
	state: "disabled",
	readinessState: "disabled",
	checkedAt: fixedTimestamp,
	contentSensitivity: "private-vault",
	providerId: null,
	modelId: null,
	sourcePathCount: 0,
	message: "Semantic indexing is disabled in settings.",
	diagnosticCode: null,
	...overrides,
});

const readySettings = {
	...DEFAULT_PLUGIN_SETTINGS,
	providerRoles: {
		...DEFAULT_PLUGIN_SETTINGS.providerRoles,
		chat: {
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			modelId: null,
		},
	},
};

const syntheticCloudProfile = normalizeProviderProfiles([SYNTHETIC_CLOUD_PROFILE_INPUT]).profiles[0];

const healthReport = (errorCount: number, warningCount: number): VaultHealthReport => ({
	reportId: "runtime-health-fixture",
	generatedAt: fixedTimestamp,
	scannedPaths: [makeNormalizedVaultPath("sources/demo-article.md")],
	indexStates: {},
	findings:
		errorCount > 0 || warningCount > 0
			? [
					{
						id: "runtime-health-finding",
						kind: errorCount > 0 ? "broken-wikilink" : "orphan-note",
						severity: errorCount > 0 ? "error" : "warning",
						message: "Synthetic runtime health finding.",
						affectedPaths: [makeNormalizedVaultPath("sources/demo-article.md")],
						evidence: [
							{ path: makeNormalizedVaultPath("sources/demo-article.md"), detail: "Synthetic evidence." },
						],
						remediation: { kind: "report-only", summary: "Review synthetic finding." },
					},
				]
			: [],
	groups: [],
	summary: {
		totalFindings: errorCount + warningCount,
		errorCount,
		warningCount,
		infoCount: 0,
		findingCounts: {
			"broken-wikilink": errorCount,
			"content-gap": 0,
			"missing-citation": 0,
			"orphan-note": warningCount,
			"stale-index": 0,
		},
	},
});

const stagedChange = (status: StagedChangeStatus): StagedChangeRecord => ({
	artifactKind: "staged-change",
	schemaVersion: 1,
	changeId: `runtime-${status}-fixture`,
	operationKind: "update-note",
	status,
	targetPath: makeNormalizedVaultPath("summaries/demo-article-summary.md"),
	createdAt: fixedTimestamp,
	updatedAt: fixedTimestamp,
	rationale: "Synthetic runtime status fixture.",
	sourcePaths: [makeNormalizedVaultPath("sources/demo-article.md")],
	diff: {
		lineDiff: [],
		hasTextChanges: false,
	},
	conflicts:
		status === "conflicted"
			? [
					{
						kind: "target-changed",
						severity: "blocking",
						message: "Synthetic conflict.",
						paths: [makeNormalizedVaultPath("summaries/demo-article-summary.md")],
					},
				]
			: [],
	review: {
		requiresExplicitReview: true,
		destructive: false,
		reasons: ["existing-note-edit"],
	},
	recovery: {
		commandId: "voidbrain.stage-change",
		stagedChangeId: `runtime-${status}-fixture`,
		targetPath: makeNormalizedVaultPath("summaries/demo-article-summary.md"),
		status: status === "failed" ? "failed-apply" : "pending-review",
		validationOutput: [],
	},
});

describe("runtime status composition", () => {
	it("reports missing setup without raw vault content when runtime inputs are absent", () => {
		const snapshot = createRuntimeStatusSnapshot({
			settings: DEFAULT_PLUGIN_SETTINGS,
			providers: BASELINE_PROVIDERS,
			now: fixedDate,
		});

		expect(snapshot.overallSeverity).toBe("missing");
		expect(snapshot.counts).toMatchObject({
			missing: 4,
			ready: 1,
		});
		expect(snapshot.items.map((item) => item.id)).toEqual([
			"provider-readiness",
			"index-readiness",
			"staged-change-readiness",
			"health-readiness",
			"hot-cache-readiness",
		]);
		expect(JSON.stringify(snapshot)).not.toContain("Synthetic runtime note body");
	});

	it("reports ready when providers, indexes, staged changes, and health are ready", () => {
		const sources = [sourceFingerprint("sources/demo-article.md", "source-a")];
		const snapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			indexProgress: [
				createProgressSnapshot({
					jobId: "runtime-ready-job",
					indexId: "runtime-index",
					status: "ready",
					totalNotes: 1,
					indexedNotes: 1,
					now: fixedDate,
				}),
			],
			indexFreshness: [evaluateIndexFreshness("runtime-index", sources, sources, fixedDate)],
			stagedChanges: [],
			healthReport: healthReport(0, 0),
			hotCache: hotCacheStatus(),
			now: fixedDate,
		});

		expect(snapshot.overallSeverity).toBe("ready");
		expect(snapshot.counts.ready).toBe(5);
	});

	it("reports source ingestion queue failures with bounded recovery paths", () => {
		const summary = createQueueFixtureSummary();
		const snapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			ingestionQueue: {
				summary,
				isRunning: false,
			},
			now: fixedDate,
		});
		const item = snapshot.items.find((candidate) => candidate.id === "source-ingestion-queue");

		expect(item).toMatchObject({
			area: "ingestion",
			severity: "error",
			count: 2,
		});
		expect(item?.details.join(" ")).toContain("provider-blocked");
		expect(item?.paths).toContain(makeNormalizedVaultPath("inbox/synthetic-provider-denied-source.md"));
		expect(JSON.stringify(item)).not.toContain("Synthetic URL source record supplied by the user");
	});

	it("reports warnings for cloud trust gaps, stale indexes, staged conflicts, and health warnings", () => {
		const sources = [sourceFingerprint("sources/demo-article.md", "source-a")];
		const staleSources = [sourceFingerprint("sources/demo-article.md", "source-b")];
		const snapshot = createRuntimeStatusSnapshot({
			settings: {
				...readySettings,
				areCloudProvidersEnabled: true,
				trustedProviderIds: [],
			},
			providers: BASELINE_PROVIDERS,
			indexFreshness: [evaluateIndexFreshness("runtime-index", sources, staleSources, fixedDate)],
			stagedChanges: [stagedChange("conflicted")],
			healthReport: healthReport(0, 1),
			hotCache: hotCacheStatus(),
			now: fixedDate,
		});

		expect(snapshot.overallSeverity).toBe("warning");
		expect(snapshot.counts.warning).toBe(4);
		expect(snapshot.items.find((item) => item.area === "index")?.paths).toEqual([
			makeNormalizedVaultPath("sources/demo-article.md"),
		]);
	});

	it("reports provider auth failures without exposing auth diagnostics", () => {
		if (syntheticCloudProfile === undefined) {
			throw new Error("Expected synthetic cloud profile fixture");
		}

		const settings = {
			...DEFAULT_PLUGIN_SETTINGS,
			areCloudProvidersEnabled: true,
			trustedProviderIds: [syntheticCloudProfile.id],
			providerProfiles: [syntheticCloudProfile],
			providerAuthStatuses: [
				{
					providerId: syntheticCloudProfile.id,
					status: "failed" as const,
					checkedAt: "2026-05-13T00:00:00.000Z",
					statusCode: 401,
					modelCount: 0,
					durationMs: 1,
					diagnostic: {
						runtimeSecret: "inline-runtime-value",
					},
				},
			],
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				chat: {
					providerId: syntheticCloudProfile.id,
					modelId: syntheticCloudProfile.models[0]?.id ?? null,
				},
			},
		};
		const snapshot = createRuntimeStatusSnapshot({
			settings,
			providers: buildProviderDefinitionsForSettings(settings),
			now: fixedDate,
		});
		const providerItem = snapshot.items.find((item) => item.id === "provider-readiness");

		expect(providerItem).toMatchObject({
			severity: "error",
			summary: "Provider setup has auth or capability issues.",
		});
		expect(JSON.stringify(providerItem)).not.toContain("inline-runtime-value");
		expect(JSON.stringify(providerItem)).not.toContain("runtimeSecret");
	});

	it("reports provider capability mismatches before workflow execution", () => {
		const settings = {
			...DEFAULT_PLUGIN_SETTINGS,
			providerRoles: {
				...DEFAULT_PLUGIN_SETTINGS.providerRoles,
				embedding: {
					providerId: LOCAL_FIXTURE_PROVIDER_ID,
					modelId: makeProviderModelId("local-chat-fixture"),
				},
			},
		};
		const snapshot = createRuntimeStatusSnapshot({
			settings,
			providers: BASELINE_PROVIDERS,
			now: fixedDate,
		});
		const providerItem = snapshot.items.find((item) => item.id === "provider-readiness");

		expect(providerItem).toMatchObject({
			severity: "error",
		});
		expect(providerItem?.details.join(" ")).toContain("embedding model does not support embeddings.");
	});

	it("reports errors for failed subsystem snapshots", () => {
		const snapshot = createRuntimeStatusSnapshot({
			settings: {
				...readySettings,
				areCloudProvidersEnabled: true,
				trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
			},
			providers: [],
			indexProgress: [
				createProgressSnapshot({
					jobId: "runtime-error-job",
					indexId: "runtime-index",
					status: "error",
					totalNotes: 1,
					indexedNotes: 0,
					errorMessage: "Synthetic index failure.",
					now: fixedDate,
				}),
			],
			stagedChanges: [stagedChange("failed")],
			healthReport: healthReport(1, 0),
			now: fixedDate,
		});

		expect(snapshot.overallSeverity).toBe("error");
		expect(snapshot.counts.error).toBe(4);
	});

	it("reports runtime index reports with canceled, skipped, failed, and semantic gate details", () => {
		const report = indexingReport({
			status: "canceled",
			readinessState: "canceled",
			indexedNoteCount: 1,
			totalNoteCount: 3,
			currentPath: makeNormalizedVaultPath("sources/runtime-source.md"),
			skippedPaths: [
				{
					path: makeNormalizedVaultPath("archive/excluded-note.md"),
					code: "excluded-folder",
					reason: "Path is under an excluded folder.",
				},
			],
			failedPaths: [
				{
					path: makeNormalizedVaultPath("sources/read-failure.md"),
					code: "read-failed",
					reason: "Vault note could not be read.",
				},
			],
			stalePaths: [makeNormalizedVaultPath("sources/runtime-source.md")],
			message: "Lexical index job was canceled.",
		});
		const snapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			indexReports: [report],
			semanticIndexReadiness: semanticReadiness({
				state: "privacy-denied",
				readinessState: "blocked",
				message: "Cloud provider workflows are disabled.",
				diagnosticCode: "cloud-disabled",
			}),
			now: fixedDate,
		});
		const indexItem = snapshot.items.find((item) => item.id === "index-readiness");

		expect(indexItem).toMatchObject({
			severity: "error",
			summary: "At least one retrieval index report is in an error state.",
		});
		expect(indexItem?.details.join(" ")).toContain("1 skipped; 1 failed");
		expect(indexItem?.details.join(" ")).toContain("Semantic indexing: blocked");
		expect(indexItem?.paths).toEqual(
			expect.arrayContaining([
				makeNormalizedVaultPath("archive/excluded-note.md"),
				makeNormalizedVaultPath("sources/read-failure.md"),
				makeNormalizedVaultPath("sources/runtime-source.md"),
			]),
		);
		expect(JSON.stringify(indexItem)).not.toContain("Synthetic runtime note body");
	});

	it("distinguishes semantic disabled and missing-provider readiness in index summaries", () => {
		const disabledSnapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			indexReports: [indexingReport()],
			semanticIndexReadiness: semanticReadiness(),
			now: fixedDate,
		});
		expect(disabledSnapshot.items.find((item) => item.id === "index-readiness")?.severity).toBe("ready");

		const missingSnapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			indexReports: [indexingReport()],
			semanticIndexReadiness: semanticReadiness({
				state: "missing-provider",
				readinessState: "missing",
				message: "embedding provider is not selected.",
			}),
			now: fixedDate,
		});
		expect(missingSnapshot.items.find((item) => item.id === "index-readiness")?.severity).toBe("missing");
	});

	it("reports hot cache ready, stale, and failed recovery states", () => {
		const hotCacheOnlySettings = {
			...DEFAULT_PLUGIN_SETTINGS,
			status: {
				shouldShowProviderStatus: false,
				shouldShowIndexStatus: false,
				shouldShowStagedChangeStatus: false,
				shouldShowHealthStatus: false,
				shouldShowHotCacheStatus: true,
			},
		};
		const readySnapshot = createRuntimeStatusSnapshot({
			settings: hotCacheOnlySettings,
			providers: BASELINE_PROVIDERS,
			hotCache: hotCacheStatus(),
			now: fixedDate,
		});
		expect(readySnapshot.items[0]).toMatchObject({
			id: "hot-cache-readiness",
			severity: "ready",
			count: 5,
		});

		const staleSnapshot = createRuntimeStatusSnapshot({
			settings: hotCacheOnlySettings,
			providers: BASELINE_PROVIDERS,
			hotCache: hotCacheStatus(),
			now: new Date("2026-05-15T01:00:00.000Z"),
		});
		expect(staleSnapshot.items[0]).toMatchObject({
			severity: "warning",
			summary: "Hot cache is stale and may not match recent runtime state.",
		});

		const failedSnapshot = createRuntimeStatusSnapshot({
			settings: hotCacheOnlySettings,
			providers: BASELINE_PROVIDERS,
			hotCache: {
				...hotCacheStatus(),
				lastFailureMessage: "Synthetic cache write failed.",
			},
			now: fixedDate,
		});
		expect(failedSnapshot.items[0]).toMatchObject({
			severity: "error",
			summary: "Hot cache persistence or recovery failed.",
		});
		expect(JSON.stringify(failedSnapshot)).not.toContain("runtimeSecret");
	});

	it("reports maintenance recommendation summaries with synchronized health, index, and staged-change state", () => {
		const maintenanceHealthReport = createMaintenanceHealthReport();
		const maintenanceIndexFreshness = createMaintenanceIndexFreshnessSnapshots();
		const maintenanceStagedChange = createMaintenanceActiveStagedChange("review-ready");
		const maintenancePlan = planMaintenanceRecommendations({
			healthReport: maintenanceHealthReport,
			indexFreshness: maintenanceIndexFreshness,
			retrievalResults: createMaintenanceRetrievalResults(),
			stagedChanges: [maintenanceStagedChange],
			now: fixedDate,
		});
		const snapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			indexFreshness: maintenanceIndexFreshness,
			stagedChanges: [maintenanceStagedChange],
			healthReport: maintenanceHealthReport,
			maintenanceRecommendations: {
				plan: maintenancePlan,
			},
			now: fixedDate,
		});
		const maintenanceItem = snapshot.items.find((item) => item.id === "maintenance-recommendations");

		expect(maintenanceItem).toMatchObject({
			area: "maintenance",
			severity: "error",
			count: maintenancePlan.summary.totalRecommendations,
		});
		expect(maintenanceItem?.details.join(" ")).toContain(`${maintenancePlan.summary.stageableCount} stageable`);
		expect(maintenanceItem?.details.join(" ")).toContain(`${maintenancePlan.summary.blockedCount} blocked`);
		expect(maintenanceItem?.paths).toContain(
			makeNormalizedVaultPath("summaries/health-summary-missing-citation.md"),
		);
		expect(JSON.stringify(maintenanceItem)).not.toContain("Synthetic retrieval body text");
		expect(JSON.stringify(maintenanceItem)).not.toContain("runtimeSecret");
	});

	it("reports similar-note suggestion summaries without exposing note bodies", () => {
		const suggestionPlan = planSimilarNoteSuggestions({
			notes: loadSimilarNoteFixtureNotes(),
			retrievalResults: createSimilarNoteRetrievalResults(),
			now: SIMILAR_NOTE_FIXED_DATE,
		});
		const snapshot = createRuntimeStatusSnapshot({
			settings: readySettings,
			providers: BASELINE_PROVIDERS,
			similarNoteSuggestions: {
				plan: suggestionPlan,
			},
			now: fixedDate,
		});
		const suggestionItem = snapshot.items.find((item) => item.id === "similar-note-suggestions");

		expect(suggestionItem).toMatchObject({
			area: "maintenance",
			severity: "warning",
			count: suggestionPlan.summary.totalSuggestions,
		});
		expect(suggestionItem?.details.join(" ")).toContain(`${suggestionPlan.summary.stageableCount} stageable`);
		expect(suggestionItem?.details.join(" ")).toContain(`${suggestionPlan.summary.blockedCount} blocked`);
		expect(suggestionItem?.details.join(" ")).toContain(
			`${suggestionPlan.summary.lowConfidenceCount} low-confidence`,
		);
		expect(suggestionItem?.paths).toContain(SIMILAR_CONCEPT_PATH);
		expect(JSON.stringify(suggestionItem)).not.toContain("Synthetic retrieval body text");
		expect(JSON.stringify(suggestionItem)).not.toContain("Synthetic placement retrieval body text");
		expect(JSON.stringify(suggestionItem)).not.toContain("runtimeSecret");
	});
});
