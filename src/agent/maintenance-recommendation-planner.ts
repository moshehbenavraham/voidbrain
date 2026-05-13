import type {
	VaultHealthFinding,
	VaultHealthFindingKind,
	VaultHealthRepairStageResult,
	VaultHealthReport,
} from "../types/health";
import type {
	HealthMaintenanceRecommendationCategory,
	MaintenanceRecommendation,
	MaintenanceRecommendationConfidence,
	MaintenanceRecommendationEvidence,
	MaintenanceRecommendationPlan,
	MaintenanceRecommendationRecovery,
	MaintenanceRecommendationSeverity,
	MaintenanceRecommendationSourceRecord,
	MaintenanceRecommendationStageFailureReason,
	MaintenanceRecommendationStageResult,
	MaintenanceRecommendationStageability,
	MaintenanceRecommendationSummary,
} from "../types/maintenance";
import type { IndexFreshnessSnapshot, RetrievalResult, RetrievalSearchResult } from "../types/retrieval";
import {
	type IsoTimestamp,
	type NormalizedVaultPath,
	type StagedChangeRecord,
	type ValidationIssue,
	makeIsoTimestamp,
} from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";
import { citationIdsForFinding, classifyHealthRepairSafety } from "./vault-health";
import {
	VAULT_HEALTH_COMMAND_ID,
	type VaultHealthRuntimeMarkdownNote,
	VaultHealthRuntimeService,
	type VaultHealthStageRepairInput,
} from "./vault-health-runtime-service";

export interface MaintenanceRecommendationPlannerInput {
	readonly healthReport?: VaultHealthReport | null;
	readonly indexFreshness?: readonly IndexFreshnessSnapshot[];
	readonly retrievalResults?: readonly RetrievalSearchResult[];
	readonly stagedChanges?: readonly StagedChangeRecord[];
	readonly now?: Date;
}

export interface MaintenanceRecommendationStageInput {
	readonly plan: MaintenanceRecommendationPlan;
	readonly recommendationId: string;
	readonly report: VaultHealthReport;
	readonly existingNotes: readonly VaultHealthRuntimeMarkdownNote[];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
}

export interface MaintenanceRecommendationRepairService {
	readonly stageSafeRepair: (input: VaultHealthStageRepairInput) => Promise<VaultHealthRepairStageResult>;
}

export interface MaintenanceRecommendationPlannerOptions {
	readonly now?: () => Date;
	readonly repairService?: MaintenanceRecommendationRepairService;
}

type RankedCandidate = Omit<MaintenanceRecommendation, "rank" | "rankReasons">;

const activeStagedStatuses = new Set<StagedChangeRecord["status"]>([
	"proposed",
	"review-ready",
	"conflicted",
	"approved",
]);
const attentionStagedStatuses = new Set<StagedChangeRecord["status"]>([
	"proposed",
	"review-ready",
	"conflicted",
	"approved",
	"failed",
]);
const severityWeight: Readonly<Record<MaintenanceRecommendationSeverity, number>> = {
	error: 0,
	warning: 1,
	info: 2,
};
const confidenceWeight: Readonly<Record<MaintenanceRecommendationConfidence, number>> = {
	high: 0,
	medium: 1,
	low: 2,
};
const stageabilityWeight: Readonly<Record<MaintenanceRecommendationStageability["kind"], number>> = {
	stageable: 0,
	blocked: 1,
	"report-only": 2,
};

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const validationIssue = (
	code: ValidationIssue["code"],
	message: string,
	field?: string,
	path?: NormalizedVaultPath | string,
): ValidationIssue => ({
	code,
	message,
	...(field === undefined ? {} : { field }),
	...(path === undefined ? {} : { path }),
});

const stableIdPart = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9._-]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 96);

const recommendationId = (...parts: readonly string[]): string =>
	`maintenance-${parts
		.map(stableIdPart)
		.filter((part) => part.length > 0)
		.join("-")}`;

const boundedText = (value: string, maxLength = 220): string => {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 3).trim()}...`;
};

const uniqueSortedPaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	[...new Set(paths)].sort((left, right) => left.localeCompare(right));

const firstPath = (paths: readonly NormalizedVaultPath[]): string => paths[0] ?? "";

const activeStagedChangeForTarget = (
	stagedChanges: readonly StagedChangeRecord[],
	targetPath: NormalizedVaultPath,
): StagedChangeRecord | undefined =>
	stagedChanges.find(
		(change) =>
			activeStagedStatuses.has(change.status) &&
			(change.targetPath === targetPath || change.operationMetadata?.destinationPath === targetPath),
	);

const healthCategoryFor = (kind: VaultHealthFindingKind): HealthMaintenanceRecommendationCategory => {
	switch (kind) {
		case "broken-wikilink":
			return "broken-wikilink";
		case "orphan-note":
			return "orphan-note";
		case "stale-index":
			return "stale-index";
		case "missing-citation":
			return "missing-citation";
		case "content-gap":
			return "content-gap";
		default: {
			const exhaustive: never = kind;
			throw new Error(`Unhandled health finding kind: ${String(exhaustive)}`);
		}
	}
};

const healthSeverityFor = (finding: VaultHealthFinding): MaintenanceRecommendationSeverity => {
	switch (finding.severity) {
		case "error":
			return "error";
		case "warning":
			return "warning";
		case "info":
			return "info";
		default: {
			const exhaustive: never = finding.severity;
			throw new Error(`Unhandled health finding severity: ${String(exhaustive)}`);
		}
	}
};

const healthConfidenceFor = (finding: VaultHealthFinding): MaintenanceRecommendationConfidence => {
	switch (finding.kind) {
		case "missing-citation":
			return citationIdsForFinding(finding).length > 0 ? "high" : "low";
		case "broken-wikilink":
		case "stale-index":
			return "high";
		case "content-gap":
		case "orphan-note":
			return "medium";
		default: {
			const exhaustive: never = finding.kind;
			throw new Error(`Unhandled health finding kind: ${String(exhaustive)}`);
		}
	}
};

const indexSeverityFor = (snapshot: IndexFreshnessSnapshot): MaintenanceRecommendationSeverity => {
	switch (snapshot.state) {
		case "missing":
			return "error";
		case "partial":
		case "stale":
			return "warning";
		case "fresh":
			return "info";
		default: {
			const exhaustive: never = snapshot.state;
			throw new Error(`Unhandled index freshness state: ${String(exhaustive)}`);
		}
	}
};

const indexConfidenceFor = (snapshot: IndexFreshnessSnapshot): MaintenanceRecommendationConfidence => {
	switch (snapshot.state) {
		case "missing":
			return "high";
		case "partial":
		case "stale":
			return "medium";
		case "fresh":
			return "low";
		default: {
			const exhaustive: never = snapshot.state;
			throw new Error(`Unhandled index freshness state: ${String(exhaustive)}`);
		}
	}
};

const retrievalConfidenceFor = (result: RetrievalResult): MaintenanceRecommendationConfidence => {
	if (result.score >= 0.8) {
		return "high";
	}
	if (result.score >= 0.5) {
		return "medium";
	}

	return "low";
};

const stageabilityForHealthFinding = (
	reportId: string,
	finding: VaultHealthFinding,
	stagedChanges: readonly StagedChangeRecord[],
): MaintenanceRecommendationStageability => {
	const safety = classifyHealthRepairSafety(finding);
	const targetPath = safety.targetPath ?? finding.affectedPaths[0];
	if (safety.kind !== "safe-stage-change" || targetPath === undefined) {
		return {
			kind: finding.kind === "missing-citation" ? "blocked" : "report-only",
			reason: safety.reason,
			...(targetPath === undefined ? {} : { targetPath }),
		};
	}

	const duplicate = activeStagedChangeForTarget(stagedChanges, targetPath);
	if (duplicate !== undefined) {
		return {
			kind: "blocked",
			reason: `An active staged change already targets ${targetPath}.`,
			commandId: VAULT_HEALTH_COMMAND_ID,
			targetPath,
			blockedByStagedChangeId: duplicate.changeId,
		};
	}

	return {
		kind: "stageable",
		reason: `Recommendation can stage deterministic citation repair from report ${reportId}.`,
		commandId: VAULT_HEALTH_COMMAND_ID,
		targetPath,
	};
};

const recoveryForHealthFinding = (
	report: VaultHealthReport,
	finding: VaultHealthFinding,
	stageability: MaintenanceRecommendationStageability,
): MaintenanceRecommendationRecovery => ({
	commandId: VAULT_HEALTH_COMMAND_ID,
	reportId: report.reportId,
	findingId: finding.id,
	...(stageability.targetPath === undefined ? {} : { targetPath: stageability.targetPath }),
	...(stageability.blockedByStagedChangeId === undefined
		? {}
		: { stagedChangeId: stageability.blockedByStagedChangeId }),
	validationOutput:
		stageability.kind === "blocked" && stageability.blockedByStagedChangeId !== undefined
			? [validationIssue("record.invalid-operation", stageability.reason, "targetPath", stageability.targetPath)]
			: [],
});

const evidenceFromHealthFinding = (
	report: VaultHealthReport,
	finding: VaultHealthFinding,
): readonly MaintenanceRecommendationEvidence[] =>
	finding.evidence.map((evidence, index) => ({
		id: recommendationId("evidence", report.reportId, finding.id, String(index)),
		kind: "health-finding",
		detail: boundedText(evidence.detail),
		reportId: report.reportId,
		findingId: finding.id,
		...(evidence.path === undefined ? {} : { path: evidence.path }),
		...(evidence.sourcePath === undefined ? {} : { sourcePath: evidence.sourcePath }),
		...(evidence.targetPath === undefined ? {} : { targetPath: evidence.targetPath }),
		...(evidence.indexId === undefined ? {} : { indexId: evidence.indexId }),
		...(evidence.line === undefined ? {} : { line: evidence.line }),
	}));

const sourceRecordsFromHealthFinding = (
	report: VaultHealthReport,
	finding: VaultHealthFinding,
): readonly MaintenanceRecommendationSourceRecord[] => [
	{
		kind: "health-report",
		id: report.reportId,
		reportId: report.reportId,
	},
	{
		kind: "health-finding",
		id: finding.id,
		reportId: report.reportId,
		findingId: finding.id,
		...(finding.affectedPaths[0] === undefined ? {} : { path: finding.affectedPaths[0] }),
	},
];

const recommendationFromHealthFinding = (
	report: VaultHealthReport,
	finding: VaultHealthFinding,
	stagedChanges: readonly StagedChangeRecord[],
): RankedCandidate => {
	const stageability = stageabilityForHealthFinding(report.reportId, finding, stagedChanges);
	const affectedPaths = uniqueSortedPaths(finding.affectedPaths);

	return {
		recommendationId: recommendationId("health", report.reportId, finding.id),
		category: healthCategoryFor(finding.kind),
		severity: healthSeverityFor(finding),
		confidence: healthConfidenceFor(finding),
		title: `${finding.kind} maintenance finding`,
		summary: boundedText(finding.message),
		affectedPaths,
		evidence: evidenceFromHealthFinding(report, finding),
		sourceRecords: sourceRecordsFromHealthFinding(report, finding),
		stageability,
		recovery: recoveryForHealthFinding(report, finding, stageability),
	};
};

const recommendationPathsForSnapshot = (snapshot: IndexFreshnessSnapshot): readonly NormalizedVaultPath[] =>
	uniqueSortedPaths([...snapshot.staleSourcePaths, ...snapshot.missingSourcePaths, ...snapshot.extraSourcePaths]);

const evidenceFromIndexSnapshot = (
	snapshot: IndexFreshnessSnapshot,
	paths: readonly NormalizedVaultPath[],
): readonly MaintenanceRecommendationEvidence[] => {
	const affectedPaths = paths.length === 0 ? ([undefined] as const) : paths;
	return affectedPaths.map((path, index) => ({
		id: recommendationId("evidence", "index", snapshot.indexId, path ?? snapshot.state, String(index)),
		kind: "index-freshness",
		detail:
			path === undefined
				? `Index ${snapshot.indexId} is ${snapshot.state}.`
				: `Index ${snapshot.indexId} is ${snapshot.state} for ${path}.`,
		indexId: snapshot.indexId,
		indexState: snapshot.state,
		...(path === undefined ? {} : { path }),
	}));
};

const recommendationsFromIndexFreshness = (snapshots: readonly IndexFreshnessSnapshot[]): readonly RankedCandidate[] =>
	snapshots
		.filter((snapshot) => snapshot.state !== "fresh")
		.map((snapshot) => {
			const paths = recommendationPathsForSnapshot(snapshot);
			return {
				recommendationId: recommendationId(
					"index",
					snapshot.indexId,
					snapshot.state,
					paths.join("-") || "vault",
				),
				category: "stale-index",
				severity: indexSeverityFor(snapshot),
				confidence: indexConfidenceFor(snapshot),
				title: `Refresh ${snapshot.indexId}`,
				summary: `Local index ${snapshot.indexId} is ${snapshot.state}; rebuild before relying on retrieval evidence.`,
				affectedPaths: paths,
				evidence: evidenceFromIndexSnapshot(snapshot, paths),
				sourceRecords: [
					{
						kind: "index",
						id: snapshot.indexId,
						indexId: snapshot.indexId,
					},
				],
				stageability: {
					kind: "report-only",
					reason: "Index freshness recommendations require an explicit rebuild workflow, not a note edit.",
				},
				recovery: {
					commandId: VAULT_HEALTH_COMMAND_ID,
					indexId: snapshot.indexId,
					validationOutput: [],
				},
			};
		});

const recommendationsFromRetrievalSuccess = (
	searchIndex: number,
	result: Extract<RetrievalSearchResult, { readonly ok: true }>,
): readonly RankedCandidate[] =>
	result.results.map((retrievalResult) => ({
		recommendationId: recommendationId("retrieval", String(searchIndex), retrievalResult.id),
		category: "retrieval-evidence",
		severity: "info",
		confidence: retrievalConfidenceFor(retrievalResult),
		title: `Retrieval evidence for ${retrievalResult.path}`,
		summary: `Retrieval result ${retrievalResult.id} can support maintenance review without copying note bodies.`,
		affectedPaths: uniqueSortedPaths([retrievalResult.path, ...retrievalResult.sourcePaths]),
		evidence: [
			{
				id: recommendationId("evidence", "retrieval", retrievalResult.id),
				kind: "retrieval-result",
				detail: `Retrieval result ${retrievalResult.id} matched ${retrievalResult.path} with score ${retrievalResult.score}.`,
				path: retrievalResult.path,
				retrievalResultId: retrievalResult.id,
				score: retrievalResult.score,
				...(retrievalResult.heading === undefined ? {} : { heading: retrievalResult.heading }),
			},
			...retrievalResult.sourcePaths.map((sourcePath, index) => ({
				id: recommendationId("evidence", "retrieval", retrievalResult.id, "source", String(index)),
				kind: "retrieval-result" as const,
				detail: `Retrieval source path ${sourcePath}.`,
				path: retrievalResult.path,
				sourcePath,
				retrievalResultId: retrievalResult.id,
				score: retrievalResult.score,
			})),
		],
		sourceRecords: [
			{
				kind: "retrieval-result",
				id: retrievalResult.id,
				path: retrievalResult.path,
				retrievalResultId: retrievalResult.id,
				...(retrievalResult.heading === undefined ? {} : { heading: retrievalResult.heading }),
			},
		],
		stageability: {
			kind: "report-only",
			reason: "Retrieval evidence informs ranking and review; it does not determine a safe note edit.",
		},
		recovery: {
			commandId: "voidbrain.chat-with-vault",
			retrievalResultId: retrievalResult.id,
			targetPath: retrievalResult.path,
			validationOutput: [],
		},
	}));

const recommendationFromRetrievalFailure = (
	searchIndex: number,
	result: Extract<RetrievalSearchResult, { readonly ok: false }>,
): RankedCandidate => {
	const issue = validationIssue(
		"record.invalid-state",
		`Retrieval evidence unavailable: ${result.message}`,
		result.field,
	);
	return {
		recommendationId: recommendationId("retrieval-failure", String(searchIndex), result.code),
		category: "retrieval-evidence",
		severity: result.code === "retrieval.index-not-ready" ? "warning" : "error",
		confidence: "medium",
		title: "Retrieval evidence unavailable",
		summary: boundedText(result.message),
		affectedPaths: [],
		evidence: [
			{
				id: recommendationId("evidence", "retrieval-failure", String(searchIndex), result.code),
				kind: "validation",
				detail: boundedText(result.message),
				validationOutput: [issue],
			},
		],
		sourceRecords: [
			{
				kind: "retrieval-result",
				id: result.code,
			},
		],
		stageability: {
			kind: "report-only",
			reason: "Retrieval failures need index or query recovery before maintenance staging.",
		},
		recovery: {
			commandId: "voidbrain.chat-with-vault",
			validationOutput: [issue],
		},
	};
};

const recommendationsFromRetrievalResults = (results: readonly RetrievalSearchResult[]): readonly RankedCandidate[] =>
	results.flatMap((result, index) =>
		result.ok
			? recommendationsFromRetrievalSuccess(index, result)
			: [recommendationFromRetrievalFailure(index, result)],
	);

const severityForStagedChange = (change: StagedChangeRecord): MaintenanceRecommendationSeverity => {
	switch (change.status) {
		case "conflicted":
		case "failed":
			return "error";
		case "proposed":
		case "review-ready":
		case "approved":
			return "warning";
		case "applied":
		case "rejected":
		case "dismissed":
			return "info";
		default: {
			const exhaustive: never = change.status;
			throw new Error(`Unhandled staged-change status: ${String(exhaustive)}`);
		}
	}
};

const recommendationsFromStagedChanges = (stagedChanges: readonly StagedChangeRecord[]): readonly RankedCandidate[] =>
	stagedChanges
		.filter((change) => attentionStagedStatuses.has(change.status))
		.map((change) => {
			const paths = uniqueSortedPaths([
				change.targetPath,
				...(change.operationMetadata?.destinationPath === undefined
					? []
					: [change.operationMetadata.destinationPath]),
			]);
			return {
				recommendationId: recommendationId("staged-change", change.changeId),
				category: "active-staged-change",
				severity: severityForStagedChange(change),
				confidence: "high",
				title: `Review staged change ${change.changeId}`,
				summary: `Staged change ${change.changeId} is ${change.status} for ${change.targetPath}.`,
				affectedPaths: paths,
				evidence: [
					{
						id: recommendationId("evidence", "staged-change", change.changeId),
						kind: "staged-change",
						detail: `Staged change ${change.changeId} is ${change.status}.`,
						path: change.targetPath,
						targetPath: change.targetPath,
						stagedChangeId: change.changeId,
						validationOutput: change.recovery.validationOutput,
					},
				],
				sourceRecords: [
					{
						kind: "staged-change",
						id: change.changeId,
						path: change.targetPath,
						stagedChangeId: change.changeId,
					},
				],
				stageability: {
					kind: "blocked",
					reason: "Existing staged change must be reviewed, applied, rejected, or dismissed first.",
					commandId: "voidbrain.stage-change",
					targetPath: change.targetPath,
					blockedByStagedChangeId: change.changeId,
				},
				recovery: {
					commandId: change.recovery.commandId,
					targetPath: change.targetPath,
					stagedChangeId: change.changeId,
					validationOutput: change.recovery.validationOutput,
				},
			};
		});

const sortCandidates = (candidates: readonly RankedCandidate[]): readonly RankedCandidate[] =>
	[...candidates].sort((left, right) => {
		const bySeverity = severityWeight[left.severity] - severityWeight[right.severity];
		if (bySeverity !== 0) {
			return bySeverity;
		}

		const byConfidence = confidenceWeight[left.confidence] - confidenceWeight[right.confidence];
		if (byConfidence !== 0) {
			return byConfidence;
		}

		const byStageability = stageabilityWeight[left.stageability.kind] - stageabilityWeight[right.stageability.kind];
		if (byStageability !== 0) {
			return byStageability;
		}

		const byPath = firstPath(left.affectedPaths).localeCompare(firstPath(right.affectedPaths));
		if (byPath !== 0) {
			return byPath;
		}

		const bySource = (left.sourceRecords[0]?.id ?? "").localeCompare(right.sourceRecords[0]?.id ?? "");
		if (bySource !== 0) {
			return bySource;
		}

		return left.recommendationId.localeCompare(right.recommendationId);
	});

const rankReasonsFor = (recommendation: RankedCandidate): readonly string[] => [
	`severity:${recommendation.severity}`,
	`confidence:${recommendation.confidence}`,
	`stageability:${recommendation.stageability.kind}`,
	`path:${firstPath(recommendation.affectedPaths) || "vault"}`,
];

const rankRecommendations = (candidates: readonly RankedCandidate[]): readonly MaintenanceRecommendation[] =>
	sortCandidates(candidates).map((recommendation, index) => ({
		...recommendation,
		rank: index + 1,
		rankReasons: rankReasonsFor(recommendation),
	}));

const summarizeRecommendations = (
	recommendations: readonly MaintenanceRecommendation[],
): MaintenanceRecommendationSummary => ({
	totalRecommendations: recommendations.length,
	errorCount: recommendations.filter((recommendation) => recommendation.severity === "error").length,
	warningCount: recommendations.filter((recommendation) => recommendation.severity === "warning").length,
	infoCount: recommendations.filter((recommendation) => recommendation.severity === "info").length,
	highConfidenceCount: recommendations.filter((recommendation) => recommendation.confidence === "high").length,
	mediumConfidenceCount: recommendations.filter((recommendation) => recommendation.confidence === "medium").length,
	lowConfidenceCount: recommendations.filter((recommendation) => recommendation.confidence === "low").length,
	stageableCount: recommendations.filter((recommendation) => recommendation.stageability.kind === "stageable").length,
	reportOnlyCount: recommendations.filter((recommendation) => recommendation.stageability.kind === "report-only")
		.length,
	blockedCount: recommendations.filter((recommendation) => recommendation.stageability.kind === "blocked").length,
	affectedPaths: uniqueSortedPaths(recommendations.flatMap((recommendation) => recommendation.affectedPaths)),
});

const mergeUniqueCandidates = (candidates: readonly RankedCandidate[]): readonly RankedCandidate[] => {
	const merged = new Map<string, RankedCandidate>();
	for (const candidate of candidates) {
		if (!merged.has(candidate.recommendationId)) {
			merged.set(candidate.recommendationId, candidate);
		}
	}

	return [...merged.values()];
};

const validateTargetPathForStaging = (targetPath: NormalizedVaultPath): readonly ValidationIssue[] => {
	const normalized = normalizeVaultPath(targetPath);
	if (!normalized.ok) {
		return normalized.errors;
	}

	if (!normalized.value.endsWith(".md")) {
		return [
			validationIssue(
				"path.invalid-extension",
				"Maintenance recommendations can stage repairs only for markdown notes.",
				"targetPath",
				normalized.value,
			),
		];
	}

	if (normalized.value.startsWith(".voidbrain/")) {
		return [
			validationIssue(
				"path.unsupported-location",
				"Maintenance recommendations cannot stage repairs for Voidbrain support records.",
				"targetPath",
				normalized.value,
			),
		];
	}

	return [];
};

const failureResult = (
	reason: MaintenanceRecommendationStageFailureReason,
	message: string,
	recovery: MaintenanceRecommendationRecovery,
	recommendationId?: string,
): MaintenanceRecommendationStageResult => ({
	ok: false,
	...(recommendationId === undefined ? {} : { recommendationId }),
	reason,
	message,
	recovery,
});

export class MaintenanceRecommendationPlanner {
	private readonly now: () => Date;
	private readonly repairService: MaintenanceRecommendationRepairService;
	private readonly inFlightRecommendationIds = new Set<string>();

	public constructor(options: MaintenanceRecommendationPlannerOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.repairService = options.repairService ?? new VaultHealthRuntimeService({ now: this.now });
	}

	public plan(input: MaintenanceRecommendationPlannerInput): MaintenanceRecommendationPlan {
		const stagedChanges = input.stagedChanges ?? [];
		const candidates = mergeUniqueCandidates([
			...(input.healthReport === undefined || input.healthReport === null
				? []
				: input.healthReport.findings.map((finding) =>
						recommendationFromHealthFinding(
							input.healthReport as VaultHealthReport,
							finding,
							stagedChanges,
						),
					)),
			...recommendationsFromIndexFreshness(input.indexFreshness ?? []),
			...recommendationsFromRetrievalResults(input.retrievalResults ?? []),
			...recommendationsFromStagedChanges(stagedChanges),
		]);
		const recommendations = rankRecommendations(candidates);

		return {
			schemaVersion: 1,
			generatedAt: toIsoTimestamp(input.now ?? this.now()),
			recommendations,
			summary: summarizeRecommendations(recommendations),
		};
	}

	public async stageRecommendation(
		input: MaintenanceRecommendationStageInput,
	): Promise<MaintenanceRecommendationStageResult> {
		const recommendation = input.plan.recommendations.find(
			(candidate) => candidate.recommendationId === input.recommendationId,
		);
		if (recommendation === undefined) {
			const issue = validationIssue(
				"record.invalid-state",
				`Maintenance recommendation ${input.recommendationId} is not present in the plan.`,
				"recommendationId",
			);
			return failureResult(
				"not-found",
				"Maintenance recommendation was not found.",
				{
					commandId: VAULT_HEALTH_COMMAND_ID,
					validationOutput: [issue],
				},
				input.recommendationId,
			);
		}

		const targetPath = recommendation.stageability.targetPath;
		const findingId = recommendation.recovery.findingId;
		const baseRecovery = recommendation.recovery;
		if (recommendation.stageability.kind === "report-only") {
			const issue = validationIssue(
				"record.invalid-operation",
				recommendation.stageability.reason,
				"recommendationId",
				targetPath,
			);
			return failureResult(
				"report-only",
				"Maintenance recommendation is report-only and was not staged.",
				{
					...baseRecovery,
					validationOutput: [...baseRecovery.validationOutput, issue],
				},
				recommendation.recommendationId,
			);
		}

		if (
			targetPath === undefined ||
			findingId === undefined ||
			citationIdsForFindingId(input.report, findingId).length === 0
		) {
			const issue = validationIssue(
				"metadata.missing-source-trace",
				"Maintenance recommendation requires target path, finding ID, and citation evidence before staging.",
				"recommendationId",
				targetPath,
			);
			return failureResult(
				"missing-evidence",
				"Maintenance recommendation was not staged because required citation evidence is missing.",
				{
					...baseRecovery,
					validationOutput: [...baseRecovery.validationOutput, issue],
				},
				recommendation.recommendationId,
			);
		}

		const targetIssues = validateTargetPathForStaging(targetPath);
		if (targetIssues.length > 0) {
			return failureResult(
				"unsupported-path",
				"Maintenance recommendation target path is not stageable.",
				{
					...baseRecovery,
					validationOutput: [...baseRecovery.validationOutput, ...targetIssues],
				},
				recommendation.recommendationId,
			);
		}

		const activeDuplicate = activeStagedChangeForTarget(input.existingStagedChanges ?? [], targetPath);
		if (activeDuplicate !== undefined) {
			const issue = validationIssue(
				"record.invalid-operation",
				`An active staged change already targets ${targetPath}.`,
				"targetPath",
				targetPath,
			);
			return failureResult(
				"active-staged-change",
				"Maintenance recommendation was not staged because an active staged change already targets the path.",
				{
					...baseRecovery,
					stagedChangeId: activeDuplicate.changeId,
					validationOutput: [...baseRecovery.validationOutput, issue],
				},
				recommendation.recommendationId,
			);
		}

		if (this.inFlightRecommendationIds.has(recommendation.recommendationId)) {
			const issue = validationIssue(
				"record.invalid-operation",
				`Maintenance recommendation staging is already in flight for ${recommendation.recommendationId}.`,
				"recommendationId",
				targetPath,
			);
			return failureResult(
				"in-flight",
				"Maintenance recommendation staging is already in flight.",
				{
					...baseRecovery,
					validationOutput: [...baseRecovery.validationOutput, issue],
				},
				recommendation.recommendationId,
			);
		}

		this.inFlightRecommendationIds.add(recommendation.recommendationId);
		try {
			const result = await this.repairService.stageSafeRepair({
				report: input.report,
				findingId,
				existingNotes: input.existingNotes,
				...(input.existingStagedChanges === undefined
					? {}
					: { existingStagedChanges: input.existingStagedChanges }),
			});
			if (!result.ok) {
				return failureResult(
					"validation-failed",
					result.message,
					{
						commandId: result.recovery.commandId,
						...(result.recovery.reportId === undefined ? {} : { reportId: result.recovery.reportId }),
						...(result.recovery.findingId === undefined ? {} : { findingId: result.recovery.findingId }),
						...(result.recovery.targetPath === undefined ? {} : { targetPath: result.recovery.targetPath }),
						...(result.recovery.stagedChangeId === undefined
							? {}
							: { stagedChangeId: result.recovery.stagedChangeId }),
						validationOutput: result.recovery.validationOutput,
					},
					recommendation.recommendationId,
				);
			}

			return {
				ok: true,
				recommendationId: recommendation.recommendationId,
				findingId: result.findingId,
				targetPath: result.targetPath,
				stagedChangeId: result.stagedChangeId,
				stagedChange: result.stagedChange,
				recovery: {
					commandId: result.recovery.commandId,
					...(result.recovery.reportId === undefined ? {} : { reportId: result.recovery.reportId }),
					...(result.recovery.findingId === undefined ? {} : { findingId: result.recovery.findingId }),
					...(result.recovery.targetPath === undefined ? {} : { targetPath: result.recovery.targetPath }),
					stagedChangeId: result.stagedChangeId,
					validationOutput: result.recovery.validationOutput,
				},
			};
		} finally {
			this.inFlightRecommendationIds.delete(recommendation.recommendationId);
		}
	}
}

const citationIdsForFindingId = (report: VaultHealthReport, findingId: string): readonly string[] => {
	const finding = report.findings.find((candidate) => candidate.id === findingId);
	return finding === undefined ? [] : citationIdsForFinding(finding);
};

export const createMaintenanceRecommendationPlanner = (
	options?: MaintenanceRecommendationPlannerOptions,
): MaintenanceRecommendationPlanner => new MaintenanceRecommendationPlanner(options);

export const planMaintenanceRecommendations = (
	input: MaintenanceRecommendationPlannerInput,
	options?: MaintenanceRecommendationPlannerOptions,
): MaintenanceRecommendationPlan => new MaintenanceRecommendationPlanner(options).plan(input);
