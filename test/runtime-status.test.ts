import { describe, expect, it } from "vitest";
import { createRuntimeStatusSnapshot } from "../src/agent";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	buildProviderDefinitionsForSettings,
	makeProviderModelId,
	normalizeProviderProfiles,
} from "../src/providers";
import type { VaultHealthReport } from "../src/types/health";
import { DEFAULT_PLUGIN_SETTINGS } from "../src/types/plugin";
import type { IndexSourceFingerprint } from "../src/types/retrieval";
import type { StagedChangeRecord, StagedChangeStatus } from "../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { createProgressSnapshot, evaluateIndexFreshness } from "../src/vectorstore";
import { SYNTHETIC_CLOUD_PROFILE_INPUT } from "./fixtures/providers/provider-setup-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");
const fixedTimestamp = makeIsoTimestamp("2026-05-13T00:00:00.000Z");

const sourceFingerprint = (path: string, fingerprint: string): IndexSourceFingerprint => ({
	path: makeNormalizedVaultPath(path),
	contentFingerprint: fingerprint,
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
	summary: {
		totalFindings: errorCount + warningCount,
		errorCount,
		warningCount,
		infoCount: 0,
		findingCounts: {
			"broken-wikilink": errorCount,
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
			missing: 3,
			ready: 1,
		});
		expect(snapshot.items.map((item) => item.id)).toEqual([
			"provider-readiness",
			"index-readiness",
			"staged-change-readiness",
			"health-readiness",
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
			now: fixedDate,
		});

		expect(snapshot.overallSeverity).toBe("ready");
		expect(snapshot.counts.ready).toBe(4);
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
});
