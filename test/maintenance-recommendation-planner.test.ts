import { describe, expect, it, vi } from "vitest";
import { MaintenanceRecommendationPlanner, VaultHealthRuntimeService } from "../src/agent";
import type { VaultHealthFinding, VaultHealthReport } from "../src/types/health";
import type { VaultHealthRepairStageResult } from "../src/types/health";
import type { MaintenanceRecommendation } from "../src/types/maintenance";
import { makeNormalizedVaultPath } from "../src/types/vault";
import {
	MAINTENANCE_FIXED_DATE,
	createMaintenanceActiveStagedChange,
	createMaintenanceHealthReport,
	createMaintenanceIndexFreshnessSnapshots,
	createMaintenanceRetrievalResults,
	loadMaintenanceCurrentNotes,
} from "./fixtures/vault/maintenance-recommendation-fixtures";
import { HEALTH_SOURCE_PATH, HEALTH_SUMMARY_PATH } from "./fixtures/vault/vault-health-runtime-fixtures";

const createPlanner = () =>
	new MaintenanceRecommendationPlanner({
		now: () => MAINTENANCE_FIXED_DATE,
	});

const recommendationByCategory = (
	recommendations: readonly MaintenanceRecommendation[],
	category: MaintenanceRecommendation["category"],
): MaintenanceRecommendation => {
	const recommendation = recommendations.find((candidate) => candidate.category === category);
	if (recommendation === undefined) {
		throw new Error(`Expected maintenance recommendation category ${category}`);
	}

	return recommendation;
};

const missingCitationFinding = (report: VaultHealthReport): VaultHealthFinding => {
	const finding = report.findings.find((candidate) => candidate.kind === "missing-citation");
	if (finding === undefined) {
		throw new Error("Expected missing-citation fixture finding");
	}

	return finding;
};

const replaceFinding = (
	report: VaultHealthReport,
	findingId: string,
	replacement: VaultHealthFinding,
): VaultHealthReport => ({
	...report,
	findings: report.findings.map((finding) => (finding.id === findingId ? replacement : finding)),
});

describe("MaintenanceRecommendationPlanner", () => {
	it("plans a deterministic ranked queue with bounded evidence and report-only defaults", () => {
		const planner = createPlanner();
		const input = {
			healthReport: createMaintenanceHealthReport(),
			indexFreshness: createMaintenanceIndexFreshnessSnapshots(),
			retrievalResults: createMaintenanceRetrievalResults(),
			stagedChanges: [createMaintenanceActiveStagedChange("failed")],
			now: MAINTENANCE_FIXED_DATE,
		};

		const firstPlan = planner.plan(input);
		const secondPlan = planner.plan(input);

		expect(secondPlan).toEqual(firstPlan);
		expect(firstPlan.summary.totalRecommendations).toBeGreaterThan(0);
		expect(firstPlan.summary.affectedPaths).toContain(makeNormalizedVaultPath(HEALTH_SUMMARY_PATH));
		expect(firstPlan.recommendations.map((recommendation) => recommendation.rank)).toEqual(
			firstPlan.recommendations.map((_, index) => index + 1),
		);

		const missingCitation = recommendationByCategory(firstPlan.recommendations, "missing-citation");
		expect(missingCitation).toMatchObject({
			rank: 1,
			severity: "error",
			confidence: "high",
			stageability: {
				kind: "stageable",
				commandId: "voidbrain.health-check",
				targetPath: HEALTH_SUMMARY_PATH,
			},
			recovery: {
				commandId: "voidbrain.health-check",
				reportId: "maintenance-health-report",
			},
		});
		expect(missingCitation.evidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "health-finding",
					reportId: "maintenance-health-report",
					sourcePath: makeNormalizedVaultPath(HEALTH_SOURCE_PATH),
				}),
			]),
		);

		expect(recommendationByCategory(firstPlan.recommendations, "broken-wikilink").stageability.kind).toBe(
			"report-only",
		);
		expect(recommendationByCategory(firstPlan.recommendations, "stale-index").stageability.kind).toBe(
			"report-only",
		);
		expect(recommendationByCategory(firstPlan.recommendations, "retrieval-evidence")).toMatchObject({
			severity: "warning",
			stageability: { kind: "report-only" },
		});
		expect(recommendationByCategory(firstPlan.recommendations, "active-staged-change")).toMatchObject({
			severity: "error",
			stageability: { kind: "blocked" },
		});
		expect(JSON.stringify(firstPlan)).not.toContain("Synthetic retrieval body text");
	});

	it("stages missing-citation repairs and blocks active duplicate staged changes", async () => {
		const report = createMaintenanceHealthReport();
		const planner = createPlanner();
		const plan = planner.plan({
			healthReport: report,
			now: MAINTENANCE_FIXED_DATE,
		});
		const recommendation = recommendationByCategory(plan.recommendations, "missing-citation");

		const staged = await planner.stageRecommendation({
			plan,
			recommendationId: recommendation.recommendationId,
			report,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});

		expect(staged).toMatchObject({
			ok: true,
			recommendationId: recommendation.recommendationId,
			targetPath: HEALTH_SUMMARY_PATH,
			recovery: {
				commandId: "voidbrain.health-check",
				reportId: "maintenance-health-report",
			},
		});
		if (!staged.ok) {
			throw new Error(staged.message);
		}
		expect(staged.stagedChange.operationKind).toBe("update-frontmatter");
		expect(staged.stagedChange.diff.afterContent).toContain("citations: [vault:sources/health-source.md]");

		const duplicate = await planner.stageRecommendation({
			plan,
			recommendationId: recommendation.recommendationId,
			report,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [staged.stagedChange],
		});
		expect(duplicate).toMatchObject({
			ok: false,
			reason: "active-staged-change",
			recovery: {
				stagedChangeId: staged.stagedChangeId,
				targetPath: HEALTH_SUMMARY_PATH,
			},
		});
	});

	it("blocks in-flight duplicates, missing evidence, unsupported paths, and validation failures", async () => {
		const report = createMaintenanceHealthReport();
		const recommendation = recommendationByCategory(
			createPlanner().plan({ healthReport: report, now: MAINTENANCE_FIXED_DATE }).recommendations,
			"missing-citation",
		);
		const realService = new VaultHealthRuntimeService({ now: () => MAINTENANCE_FIXED_DATE });
		let releaseRepair: ((result: VaultHealthRepairStageResult) => void) | undefined;
		const pendingRepair = new Promise<VaultHealthRepairStageResult>((resolve) => {
			releaseRepair = resolve;
		});
		const repairService = {
			stageSafeRepair: vi.fn(async () => pendingRepair),
		};
		const inFlightPlanner = new MaintenanceRecommendationPlanner({
			now: () => MAINTENANCE_FIXED_DATE,
			repairService,
		});
		const inFlightPlan = inFlightPlanner.plan({
			healthReport: report,
			now: MAINTENANCE_FIXED_DATE,
		});
		const firstStage = inFlightPlanner.stageRecommendation({
			plan: inFlightPlan,
			recommendationId: recommendation.recommendationId,
			report,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});
		const duplicateInFlight = await inFlightPlanner.stageRecommendation({
			plan: inFlightPlan,
			recommendationId: recommendation.recommendationId,
			report,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});

		expect(duplicateInFlight).toMatchObject({
			ok: false,
			reason: "in-flight",
		});
		if (releaseRepair === undefined) {
			throw new Error("Expected deferred repair resolver");
		}
		releaseRepair(
			await realService.stageSafeRepair({
				report,
				findingId: recommendation.recovery.findingId ?? "",
				existingNotes: loadMaintenanceCurrentNotes(),
				existingStagedChanges: [],
			}),
		);
		await expect(firstStage).resolves.toMatchObject({ ok: true });

		const reportOnly = await createPlanner().stageRecommendation({
			plan: createPlanner().plan({ healthReport: report, now: MAINTENANCE_FIXED_DATE }),
			recommendationId: recommendationByCategory(
				createPlanner().plan({ healthReport: report, now: MAINTENANCE_FIXED_DATE }).recommendations,
				"broken-wikilink",
			).recommendationId,
			report,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});
		expect(reportOnly).toMatchObject({
			ok: false,
			reason: "report-only",
		});

		const sourceFinding = missingCitationFinding(report);
		const missingEvidenceReport = replaceFinding(report, sourceFinding.id, {
			...sourceFinding,
			evidence: [],
		});
		const missingEvidencePlan = createPlanner().plan({
			healthReport: missingEvidenceReport,
			now: MAINTENANCE_FIXED_DATE,
		});
		const missingEvidence = await createPlanner().stageRecommendation({
			plan: missingEvidencePlan,
			recommendationId: recommendationByCategory(missingEvidencePlan.recommendations, "missing-citation")
				.recommendationId,
			report: missingEvidenceReport,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});
		expect(missingEvidence).toMatchObject({
			ok: false,
			reason: "missing-evidence",
		});

		const unsupportedReport = replaceFinding(report, sourceFinding.id, {
			...sourceFinding,
			affectedPaths: [makeNormalizedVaultPath(".voidbrain/reports/unsafe.md")],
		});
		const unsupportedPlan = createPlanner().plan({
			healthReport: unsupportedReport,
			now: MAINTENANCE_FIXED_DATE,
		});
		const unsupported = await createPlanner().stageRecommendation({
			plan: unsupportedPlan,
			recommendationId: recommendationByCategory(unsupportedPlan.recommendations, "missing-citation")
				.recommendationId,
			report: unsupportedReport,
			existingNotes: loadMaintenanceCurrentNotes(),
			existingStagedChanges: [],
		});
		expect(unsupported).toMatchObject({
			ok: false,
			reason: "unsupported-path",
		});

		const validationFailure = await createPlanner().stageRecommendation({
			plan: createPlanner().plan({ healthReport: report, now: MAINTENANCE_FIXED_DATE }),
			recommendationId: recommendation.recommendationId,
			report,
			existingNotes: [],
			existingStagedChanges: [],
		});
		expect(validationFailure).toMatchObject({
			ok: false,
			reason: "validation-failed",
		});
	});
});
