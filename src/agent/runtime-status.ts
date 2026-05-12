import type { IndexFreshnessState, IndexJobStatus } from "../types/retrieval";
import type {
	RuntimeStatusCounts,
	RuntimeStatusInput,
	RuntimeStatusItem,
	RuntimeStatusSeverity,
	RuntimeStatusSnapshot,
} from "../types/runtime";
import { type IsoTimestamp, type NormalizedVaultPath, type StagedChangeRecord, makeIsoTimestamp } from "../types/vault";

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
	const localProviders = input.providers.filter((provider) => provider.kind === "local");
	const trustedProviderIds = new Set(input.settings.trustedProviderIds);
	const trustedCloudProviders = input.providers.filter(
		(provider) => provider.kind === "cloud" && trustedProviderIds.has(provider.id),
	);
	const selectedRoles = Object.entries(input.settings.providerRoles).filter(
		([, selection]) => selection.providerId !== null,
	);
	const details = [
		`${localProviders.length} local provider(s) available.`,
		`${trustedCloudProviders.length} trusted cloud provider(s) selected.`,
		`${selectedRoles.length} provider role(s) selected.`,
	];

	if (input.providers.length === 0 || localProviders.length === 0) {
		return {
			id: "provider-readiness",
			area: "provider",
			label: "Provider readiness",
			severity: "error",
			summary: "No local provider runtime is registered.",
			details,
			paths: [],
			count: input.providers.length,
		};
	}

	if (selectedRoles.length === 0) {
		return {
			id: "provider-readiness",
			area: "provider",
			label: "Provider readiness",
			severity: "missing",
			summary: "Provider roles are not selected yet.",
			details,
			paths: [],
			count: input.providers.length,
		};
	}

	if (input.settings.areCloudProvidersEnabled && trustedCloudProviders.length === 0) {
		return {
			id: "provider-readiness",
			area: "provider",
			label: "Provider readiness",
			severity: "warning",
			summary: "Cloud workflows are enabled but no trusted cloud provider is selected.",
			details,
			paths: [],
			count: input.providers.length,
		};
	}

	return {
		id: "provider-readiness",
		area: "provider",
		label: "Provider readiness",
		severity: "ready",
		summary: "Provider settings are explicit and local-first safeguards are active.",
		details,
		paths: [],
		count: input.providers.length,
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

const indexStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const progress = input.indexProgress ?? [];
	const freshness = input.indexFreshness ?? [];
	const allSeverities = [
		...progress.map((snapshot) => progressSeverity(snapshot.status)),
		...freshness.map((snapshot) => freshnessSeverity(snapshot.state)),
	];
	const paths = limitedPaths(
		freshness.flatMap((snapshot) => [
			...snapshot.staleSourcePaths,
			...snapshot.missingSourcePaths,
			...snapshot.extraSourcePaths,
		]),
	);

	if (allSeverities.length === 0) {
		return {
			id: "index-readiness",
			area: "index",
			label: "Index readiness",
			severity: "missing",
			summary: "No index snapshot has been created yet.",
			details: ["Index orchestration is planned for a later session."],
			paths,
			count: 0,
		};
	}

	const severity = allSeverities.reduce(bySeverity, "ready");
	const detail = `${progress.length} progress snapshot(s), ${freshness.length} freshness snapshot(s).`;
	const summary =
		severity === "ready"
			? "Index snapshots are ready or fresh."
			: severity === "error"
				? "At least one index snapshot is in an error state."
				: severity === "missing"
					? "At least one index snapshot is missing."
					: "At least one index snapshot needs attention.";

	return {
		id: "index-readiness",
		area: "index",
		label: "Index readiness",
		severity,
		summary,
		details: [detail],
		paths,
		count: progress.length + freshness.length,
	};
};

const stagedChangeStatusItem = (input: RuntimeStatusInput): RuntimeStatusItem => {
	const stagedChanges = input.stagedChanges ?? [];
	const activeChanges = stagedChanges.filter(isActiveStagedChange);
	const conflictedChanges = stagedChanges.filter((change) => change.status === "conflicted");
	const failedChanges = stagedChanges.filter((change) => change.status === "failed");
	const paths = limitedPaths(activeChanges.map((change) => change.targetPath));

	if (failedChanges.length > 0) {
		return {
			id: "staged-change-readiness",
			area: "staged-change",
			label: "Staged changes",
			severity: "error",
			summary: "At least one staged change has failed and needs recovery.",
			details: [`${failedChanges.length} failed staged change(s).`],
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
			details: [`${conflictedChanges.length} conflicted staged change(s).`],
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
			details: [`${activeChanges.length} active staged change(s).`],
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
		details: ["Direct note writes remain disabled."],
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
			details: ["Health scan execution is planned for a later session."],
			paths: [],
			count: 0,
		};
	}

	if (report.summary.errorCount > 0) {
		return {
			id: "health-readiness",
			area: "health",
			label: "Vault health",
			severity: "error",
			summary: "Vault health has error findings.",
			details: [`${report.summary.errorCount} error finding(s).`],
			paths: limitedPaths(report.findings.flatMap((finding) => finding.affectedPaths)),
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
			details: [`${report.summary.warningCount} warning finding(s).`],
			paths: limitedPaths(report.findings.flatMap((finding) => finding.affectedPaths)),
			count: report.summary.totalFindings,
		};
	}

	return {
		id: "health-readiness",
		area: "health",
		label: "Vault health",
		severity: "ready",
		summary: "Vault health report has no findings.",
		details: [`Report ${report.reportId} scanned ${report.scannedPaths.length} path(s).`],
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
