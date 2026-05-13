import { summarizeProviderRoleCapabilities, summarizeProviderSetup } from "../providers/provider-preflight";
import type { IndexingPathDiagnostic, IndexingRuntimeReport, SemanticIndexReadiness } from "../types/indexing-runtime";
import type { IndexFreshnessState, IndexJobStatus } from "../types/retrieval";
import type {
	RuntimeStatusCounts,
	RuntimeStatusInput,
	RuntimeStatusItem,
	RuntimeStatusSeverity,
	RuntimeStatusSnapshot,
} from "../types/runtime";
import { type IsoTimestamp, type NormalizedVaultPath, type StagedChangeRecord, makeIsoTimestamp } from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";

const activeStagedStatuses = new Set(["proposed", "review-ready", "conflicted", "approved"]);
const maxStatusPaths = 10;

const severityWeight: Readonly<Record<RuntimeStatusSeverity, number>> = {
	error: 0,
	warning: 1,
	missing: 2,
	ready: 3,
};

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const bySeverity = (left: RuntimeStatusSeverity, right: RuntimeStatusSeverity): RuntimeStatusSeverity =>
	severityWeight[left] <= severityWeight[right] ? left : right;

const summarizeCounts = (items: readonly RuntimeStatusItem[]): RuntimeStatusCounts => {
	const counts = {
		ready: 0,
		warning: 0,
		error: 0,
		missing: 0,
	};

	for (const item of items) {
		counts[item.severity] += 1;
	}

	return counts;
};

const overallSeverity = (items: readonly RuntimeStatusItem[]): RuntimeStatusSeverity => {
	if (items.length === 0) {
		return "ready";
	}

	return items.map((item) => item.severity).reduce(bySeverity, "ready");
};

const limitedPaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	[...new Set(paths)].sort((left, right) => left.localeCompare(right)).slice(0, maxStatusPaths);

const isActiveStagedChange = (change: StagedChangeRecord): boolean => activeStagedStatuses.has(change.status);

const providerStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const setupSummary = input.providerSetup ?? summarizeProviderSetup(input.settings, input.providers);
	const roleSummaries =
		input.providerRoleCapabilities ?? summarizeProviderRoleCapabilities(input.settings, input.providers);
	const failedAuthStatuses = input.settings.providerAuthStatuses.filter(
		(status) => status.status === "failed" || status.status === "timeout" || status.status === "missing-secret",
	);
	const capabilityProblems = roleSummaries.filter(
		(summary) =>
			summary.status === "provider-missing" ||
			summary.status === "model-missing" ||
			summary.status === "capability-mismatch",
	);
	const details = [
		...setupSummary.details,
		`${failedAuthStatuses.length} provider auth status(es) need attention.`,
		`${capabilityProblems.length} role capability problem(s).`,
		...roleSummaries.map((summary) => `${summary.role}: ${summary.message}`),
	];
	const severity =
		failedAuthStatuses.length > 0 ? "error" : capabilityProblems.length > 0 ? "error" : setupSummary.severity;

	const summary =
		severity === "ready"
			? "Provider setup, auth, trust, and role capabilities are ready."
			: severity === "error"
				? "Provider setup has auth or capability issues."
				: severity === "missing"
					? "Provider setup is incomplete."
					: "Provider setup has trust or auth warnings.";

	return {
		id: "provider-readiness",
		area: "provider",
		label: "Provider readiness",
		severity,
		summary,
		details,
		paths: [],
		count: setupSummary.providerCount,
	};
};

const progressSeverity = (status: IndexJobStatus): RuntimeStatusSeverity => {
	switch (status) {
		case "ready":
			return "ready";
		case "idle":
			return "missing";
		case "building":
		case "stale":
		case "canceled":
			return "warning";
		case "error":
			return "error";
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled index job status: ${String(exhaustive)}`);
		}
	}
};

const freshnessSeverity = (state: IndexFreshnessState): RuntimeStatusSeverity => {
	switch (state) {
		case "fresh":
			return "ready";
		case "missing":
			return "missing";
		case "partial":
		case "stale":
			return "warning";
		default: {
			const exhaustive: never = state;
			throw new Error(`Unhandled index freshness state: ${String(exhaustive)}`);
		}
	}
};

const reportSeverity = (report: IndexingRuntimeReport): RuntimeStatusSeverity => {
	if (report.failedPaths.length > 0) {
		return "error";
	}

	switch (report.readinessState) {
		case "ready":
			return report.skippedPaths.length > 0 ||
				report.stalePaths.length > 0 ||
				report.missingPaths.length > 0 ||
				report.extraPaths.length > 0
				? "warning"
				: "ready";
		case "disabled":
			return "ready";
		case "missing":
			return "missing";
		case "building":
		case "stale":
		case "canceled":
			return "warning";
		case "blocked":
		case "error":
			return "error";
		default: {
			const exhaustive: never = report.readinessState;
			throw new Error(`Unhandled report readiness state: ${String(exhaustive)}`);
		}
	}
};

const semanticSeverity = (readiness: SemanticIndexReadiness): RuntimeStatusSeverity => {
	switch (readiness.readinessState) {
		case "ready":
		case "disabled":
			return "ready";
		case "missing":
			return "missing";
		case "building":
		case "stale":
		case "canceled":
			return "warning";
		case "blocked":
		case "error":
			return readiness.state === "privacy-denied" ? "warning" : "error";
		default: {
			const exhaustive: never = readiness.readinessState;
			throw new Error(`Unhandled semantic readiness state: ${String(exhaustive)}`);
		}
	}
};

const diagnosticPaths = (diagnostics: readonly IndexingPathDiagnostic[]): readonly NormalizedVaultPath[] =>
	diagnostics.flatMap((diagnostic) => {
		const normalized = normalizeVaultPath(diagnostic.path);
		return normalized.ok ? [normalized.value] : [];
	});

const reportPaths = (reports: readonly IndexingRuntimeReport[]): readonly NormalizedVaultPath[] =>
	reports.flatMap((report) => [
		...report.stalePaths,
		...report.missingPaths,
		...report.extraPaths,
		...(report.currentPath === null ? [] : [report.currentPath]),
		...diagnosticPaths(report.skippedPaths),
		...diagnosticPaths(report.failedPaths),
	]);

const reportDetails = (reports: readonly IndexingRuntimeReport[]): readonly string[] =>
	reports.flatMap((report) => [
		`${report.indexId}: ${report.readinessState}; ${report.indexedNoteCount}/${report.totalNoteCount} indexed; ${report.skippedPaths.length} skipped; ${report.failedPaths.length} failed.`,
		...(report.currentPath === null ? [] : [`Current path: ${report.currentPath}.`]),
		...(report.freshness === null ? [] : [`Freshness: ${report.freshness.state}.`]),
		report.message,
	]);

const indexStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const reports = input.indexReports ?? [];
	const progress = input.indexProgress ?? [];
	const freshness = input.indexFreshness ?? [];
	const semanticReadiness = input.semanticIndexReadiness ?? null;
	const recentFailures = input.recentIndexFailures ?? [];
	const allSeverities = [
		...reports.map(reportSeverity),
		...progress.map((snapshot) => progressSeverity(snapshot.status)),
		...freshness.map((snapshot) => freshnessSeverity(snapshot.state)),
		...(semanticReadiness === null ? [] : [semanticSeverity(semanticReadiness)]),
	];
	const paths = limitedPaths([
		...reportPaths(reports),
		...diagnosticPaths(recentFailures),
		...freshness.flatMap((snapshot) => [
			...snapshot.staleSourcePaths,
			...snapshot.missingSourcePaths,
			...snapshot.extraSourcePaths,
		]),
	]);

	if (allSeverities.length === 0) {
		return {
			id: "index-readiness",
			area: "index",
			label: "Index readiness",
			severity: "missing",
			summary: "No index snapshot has been created yet.",
			details: ["Runtime indexing has not reported readiness yet."],
			paths,
			count: 0,
		};
	}

	const severity = allSeverities.reduce(bySeverity, "ready");
	const details = [
		...reportDetails(reports),
		`${progress.length} progress snapshot(s), ${freshness.length} freshness snapshot(s).`,
		...(semanticReadiness === null
			? []
			: [`Semantic indexing: ${semanticReadiness.readinessState}; ${semanticReadiness.message}`]),
		...(recentFailures.length === 0 ? [] : [`${recentFailures.length} recent failed path(s).`]),
	];
	const summary =
		severity === "ready"
			? "Retrieval indexes are ready or intentionally disabled."
			: severity === "error"
				? "At least one retrieval index report is in an error state."
				: severity === "missing"
					? "At least one retrieval index report is missing."
					: "At least one retrieval index report needs attention.";

	return {
		id: "index-readiness",
		area: "index",
		label: "Index readiness",
		severity,
		summary,
		details,
		paths,
		count: reports.length + progress.length + freshness.length + (semanticReadiness === null ? 0 : 1),
	};
};

const stagedChangeStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const stagedChanges = input.stagedChanges ?? [];
	const activeChanges = stagedChanges.filter(isActiveStagedChange);
	const conflictedChanges = stagedChanges.filter((change) => change.status === "conflicted");
	const failedChanges = stagedChanges.filter((change) => change.status === "failed");
	const rejectedChanges = stagedChanges.filter((change) => change.status === "rejected");
	const dismissedChanges = stagedChanges.filter((change) => change.status === "dismissed");
	const appliedChanges = stagedChanges.filter((change) => change.status === "applied");
	const paths = limitedPaths([...activeChanges, ...failedChanges].map((change) => change.targetPath));
	const details = [
		`${activeChanges.length} active staged change(s).`,
		`${conflictedChanges.length} conflicted, ${failedChanges.length} failed, ${rejectedChanges.length} rejected, ${dismissedChanges.length} dismissed, ${appliedChanges.length} applied.`,
		...limitedPaths(
			[...conflictedChanges, ...failedChanges].flatMap((change) => [
				change.targetPath,
				...(change.operationMetadata?.destinationPath === undefined
					? []
					: [change.operationMetadata.destinationPath]),
			]),
		).map((path) => `Recovery path: ${path}.`),
	];

	if (failedChanges.length > 0) {
		return {
			id: "staged-change-readiness",
			area: "staged-change",
			label: "Staged changes",
			severity: "error",
			summary: "At least one staged change has failed and needs recovery.",
			details,
			paths,
			count: activeChanges.length,
		};
	}

	if (conflictedChanges.length > 0) {
		return {
			id: "staged-change-readiness",
			area: "staged-change",
			label: "Staged changes",
			severity: "warning",
			summary: "At least one staged change has a review conflict.",
			details,
			paths,
			count: activeChanges.length,
		};
	}

	if (activeChanges.length > 0) {
		return {
			id: "staged-change-readiness",
			area: "staged-change",
			label: "Staged changes",
			severity: "warning",
			summary: "Staged changes are waiting for review.",
			details,
			paths,
			count: activeChanges.length,
		};
	}

	return {
		id: "staged-change-readiness",
		area: "staged-change",
		label: "Staged changes",
		severity: "ready",
		summary: "No staged changes are waiting for review.",
		details:
			appliedChanges.length === 0 && rejectedChanges.length === 0 && dismissedChanges.length === 0
				? ["Direct note writes require explicit staged-change confirmation."]
				: details,
		paths,
		count: 0,
	};
};

const healthStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const report = input.healthReport ?? null;

	if (report === null) {
		return {
			id: "health-readiness",
			area: "health",
			label: "Vault health",
			severity: "missing",
			summary: "No vault health report has been generated yet.",
			details: ["Run voidbrain.health-check to scan local vault notes and index freshness."],
			paths: [],
			count: 0,
		};
	}

	const affectedPaths = limitedPaths(report.findings.flatMap((finding) => finding.affectedPaths));
	const details = [
		`Report ${report.reportId} generated at ${report.generatedAt}.`,
		`${report.scannedPaths.length} scanned path(s), ${report.groups.length} group(s), ${report.summary.totalFindings} finding(s).`,
		`${report.summary.errorCount} error, ${report.summary.warningCount} warning, ${report.summary.infoCount} info.`,
		...affectedPaths.map((path) => `Affected path sample: ${path}.`),
		"Repairs remain staged changes and require review before apply.",
	];

	if (report.summary.errorCount > 0) {
		return {
			id: "health-readiness",
			area: "health",
			label: "Vault health",
			severity: "error",
			summary: "Vault health has error findings.",
			details,
			paths: affectedPaths,
			count: report.summary.totalFindings,
		};
	}

	if (report.summary.warningCount > 0) {
		return {
			id: "health-readiness",
			area: "health",
			label: "Vault health",
			severity: "warning",
			summary: "Vault health has warning findings.",
			details,
			paths: affectedPaths,
			count: report.summary.totalFindings,
		};
	}

	return {
		id: "health-readiness",
		area: "health",
		label: "Vault health",
		severity: "ready",
		summary: "Vault health report has no findings.",
		details,
		paths: [],
		count: report.summary.totalFindings,
	};
};

export const createRuntimeStatusSnapshot = (input: RuntimeStatusInput): RuntimeStatusSnapshot => {
	const candidateItems = [
		input.settings.status.shouldShowProviderStatus ? providerStatusItem(input) : undefined,
		input.settings.status.shouldShowIndexStatus ? indexStatusItem(input) : undefined,
		input.settings.status.shouldShowStagedChangeStatus ? stagedChangeStatusItem(input) : undefined,
		input.settings.status.shouldShowHealthStatus ? healthStatusItem(input) : undefined,
	];
	const items = candidateItems.filter((item): item is RuntimeStatusItem => item !== undefined);

	return {
		schemaVersion: 1,
		generatedAt: toIsoTimestamp(input.now ?? new Date()),
		overallSeverity: overallSeverity(items),
		counts: summarizeCounts(items),
		items,
	};
};
