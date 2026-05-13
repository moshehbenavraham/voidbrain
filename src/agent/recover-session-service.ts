import { isSecretLikeKey, redactDiagnostic } from "../providers/redaction";
import {
	RECOVERY_DEFAULT_DIAGNOSTIC_LIMIT,
	RECOVERY_DEFAULT_ITEM_LIMIT,
	RECOVERY_MAX_DIAGNOSTIC_LIMIT,
	RECOVERY_MAX_ITEM_LIMIT,
	RECOVERY_MAX_SUMMARY_LENGTH,
	RECOVERY_SCHEMA_VERSION,
	RECOVERY_STALE_AFTER_MS,
	RECOVER_SESSION_COMMAND_ID,
	type RecoverSessionInput,
	type RecoveryAction,
	type RecoveryDiagnostic,
	type RecoveryEvidenceItem,
	type RecoverySourceKind,
	type RecoverySummary,
} from "../types/recovery";
import type {
	HotCacheEntry,
	HotCacheState,
	IsoTimestamp,
	NormalizedVaultPath,
	OperationKind,
	OperationLog,
	OperationLogEntry,
	StagedChangeRecord,
	ValidationIssue,
} from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";
import { validateHotCacheState, validateOperationLog, validateStagedChangeRecord } from "../utils/vault-validation";

type UnknownRecord = Readonly<Record<string, unknown>>;

interface RedactionState {
	redactedFieldCount: number;
	omittedBodyCount: number;
}

interface RecoveryFilters {
	readonly commandId?: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

const issueText = (issues: readonly ValidationIssue[]): string =>
	issues.map((issue) => issue.message).join(" ") || "Support record failed validation.";

const clampLimit = (value: number | undefined, fallback: number, max: number): number => {
	if (value === undefined || !Number.isInteger(value) || value < 1) {
		return fallback;
	}

	return Math.min(value, max);
};

const truncate = (value: string, maxLength: number): string => {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const redactText = (value: string, maxLength = RECOVERY_MAX_SUMMARY_LENGTH): string => {
	const result = redactDiagnostic(value);
	if (result.ok && typeof result.value === "string") {
		return truncate(result.value, maxLength);
	}

	return "[REDACTED]";
};

const sanitizeValidationIssue = (issue: ValidationIssue): ValidationIssue => ({
	code: issue.code,
	message: redactText(issue.message),
	...(issue.path === undefined ? {} : { path: redactText(String(issue.path)) }),
	...(issue.field === undefined ? {} : { field: redactText(issue.field) }),
});

const normalizePath = (input: unknown): NormalizedVaultPath | null => {
	const normalized = normalizeVaultPath(input);
	return normalized.ok ? normalized.value : null;
};

const uniqueStrings = (values: readonly (string | undefined | null)[]): readonly string[] =>
	[...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))].sort(
		(left, right) => left.localeCompare(right),
	);

const uniquePaths = (
	values: readonly (NormalizedVaultPath | string | undefined | null)[],
): readonly NormalizedVaultPath[] =>
	[
		...new Set(
			values.map((value) => normalizePath(value)).filter((value): value is NormalizedVaultPath => value !== null),
		),
	].sort((left, right) => left.localeCompare(right));

const sourcePathFor = (path: NormalizedVaultPath | string | undefined): NormalizedVaultPath | undefined =>
	path === undefined ? undefined : (normalizePath(path) ?? undefined);

const diagnostic = (input: {
	readonly severity: RecoveryDiagnostic["severity"];
	readonly code: RecoveryDiagnostic["code"];
	readonly message: string;
	readonly sourceKind?: RecoverySourceKind | undefined;
	readonly sourcePath?: NormalizedVaultPath | undefined;
	readonly field?: string | undefined;
}): RecoveryDiagnostic => ({
	diagnosticId: [
		input.sourceKind ?? "recovery",
		input.code,
		input.sourcePath ?? "unknown",
		input.field ?? "record",
		input.message,
	]
		.join(":")
		.replaceAll(/[^a-zA-Z0-9._:-]+/g, "-")
		.slice(0, 180),
	severity: input.severity,
	code: input.code,
	message: redactText(input.message),
	...(input.sourceKind === undefined ? {} : { sourceKind: input.sourceKind }),
	...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
	...(input.field === undefined ? {} : { field: input.field }),
});

const evidence = (input: {
	readonly evidenceId: string;
	readonly sourceKind: RecoverySourceKind;
	readonly sourcePath?: NormalizedVaultPath | undefined;
	readonly commandId: string;
	readonly cachePath?: NormalizedVaultPath | string | undefined;
	readonly targetPaths?: readonly (NormalizedVaultPath | string | undefined | null)[];
	readonly reportIds?: readonly (string | undefined | null)[];
	readonly stagedChangeIds?: readonly (string | undefined | null)[];
	readonly backupPathIntents?: readonly (NormalizedVaultPath | string | undefined | null)[];
	readonly operationLogIds?: readonly (string | undefined | null)[];
	readonly validationOutput?: readonly ValidationIssue[];
	readonly summary: string;
	readonly updatedAt?: IsoTimestamp | undefined;
}): RecoveryEvidenceItem => {
	const cachePath = input.cachePath === undefined ? null : normalizePath(input.cachePath);

	return {
		evidenceId: input.evidenceId,
		sourceKind: input.sourceKind,
		...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
		commandId: input.commandId,
		...(cachePath === null ? {} : { cachePath }),
		targetPaths: uniquePaths(input.targetPaths ?? []),
		reportIds: uniqueStrings(input.reportIds ?? []),
		stagedChangeIds: uniqueStrings(input.stagedChangeIds ?? []),
		backupPathIntents: uniquePaths(input.backupPathIntents ?? []),
		operationLogIds: uniqueStrings(input.operationLogIds ?? []),
		validationOutput: (input.validationOutput ?? []).map(sanitizeValidationIssue),
		summary: redactText(input.summary),
		...(input.updatedAt === undefined ? {} : { updatedAt: input.updatedAt }),
	};
};

const commandIdForOperation = (operationKind: OperationKind): string => {
	if (operationKind.startsWith("staged-change-")) {
		return "voidbrain.stage-change";
	}
	if (operationKind.startsWith("hot-cache-") || operationKind === "session-summary-staged") {
		return "voidbrain.hot-cache";
	}
	if (operationKind === "source-imported" || operationKind === "summary-generated") {
		return "voidbrain.ingest-source";
	}
	if (operationKind === "note-indexed") {
		return "voidbrain.health-check";
	}

	return "voidbrain.recover-session";
};

const findSecretLikeFields = (value: unknown, prefix = ""): readonly string[] => {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => findSecretLikeFields(item, `${prefix}[${index}]`));
	}

	if (!isRecord(value)) {
		return [];
	}

	return Object.entries(value).flatMap(([key, childValue]) => {
		const fieldPath = prefix.length === 0 ? key : `${prefix}.${key}`;
		return [...(isSecretLikeKey(key) ? [fieldPath] : []), ...findSecretLikeFields(childValue, fieldPath)];
	});
};

const addSecretDiagnostics = (
	value: unknown,
	sourceKind: RecoverySourceKind,
	sourcePath: NormalizedVaultPath | undefined,
	diagnostics: RecoveryDiagnostic[],
	redaction: RedactionState,
): void => {
	const secretFields = findSecretLikeFields(value);
	if (secretFields.length === 0) {
		return;
	}

	redaction.redactedFieldCount += secretFields.length;
	diagnostics.push(
		diagnostic({
			severity: "warning",
			code: "recovery.secret-redacted",
			message: `Secret-like support fields were omitted: ${secretFields.join(", ")}.`,
			sourceKind,
			sourcePath,
		}),
	);
};

const addBodyOmissionDiagnostics = (
	record: StagedChangeRecord,
	sourcePath: NormalizedVaultPath | undefined,
	diagnostics: RecoveryDiagnostic[],
	redaction: RedactionState,
): void => {
	const omittedFields = [
		...(record.diff.beforeContent === undefined ? [] : ["diff.beforeContent"]),
		...(record.diff.afterContent === undefined ? [] : ["diff.afterContent"]),
	];
	if (omittedFields.length === 0) {
		return;
	}

	redaction.omittedBodyCount += omittedFields.length;
	diagnostics.push(
		diagnostic({
			severity: "info",
			code: "recovery.body-omitted",
			message: `Raw staged-change body fields were omitted: ${omittedFields.join(", ")}.`,
			sourceKind: "staged-change",
			sourcePath,
			field: record.changeId,
		}),
	);
};

const hotCacheItem = (state: HotCacheState, sourcePath: NormalizedVaultPath | undefined): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `hot-cache:${state.cacheId}`,
		sourceKind: "hot-cache",
		sourcePath,
		commandId: state.recovery.commandId,
		cachePath: state.cachePath,
		targetPaths: state.entries.flatMap((entry) => [entry.path, entry.recovery.targetPath, ...entry.sourcePaths]),
		reportIds: state.entries.map((entry) => entry.recovery.reportId),
		stagedChangeIds: state.entries.map((entry) => entry.recovery.stagedChangeId),
		validationOutput: state.recovery.validationOutput,
		summary: `Hot cache ${state.cacheId} has ${state.entries.length} recoverable item(s).`,
		updatedAt: state.updatedAt,
	});

const hotCacheEntryItem = (entry: HotCacheEntry, sourcePath: NormalizedVaultPath | undefined): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `hot-cache:${entry.kind}:${entry.key}`,
		sourceKind: "hot-cache",
		sourcePath,
		commandId: entry.recovery.commandId,
		cachePath: entry.recovery.cachePath,
		targetPaths: [entry.path, entry.recovery.targetPath, ...entry.sourcePaths],
		reportIds: [entry.recovery.reportId],
		stagedChangeIds: [entry.recovery.stagedChangeId],
		validationOutput: entry.recovery.validationOutput,
		summary: entry.summary,
		updatedAt: entry.lastAccessedAt,
	});

const stagedChangeItem = (
	record: StagedChangeRecord,
	sourcePath: NormalizedVaultPath | undefined,
): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `staged-change:${record.changeId}`,
		sourceKind: "staged-change",
		sourcePath,
		commandId: record.recovery.commandId,
		targetPaths: [record.targetPath, record.recovery.targetPath],
		stagedChangeIds: [record.changeId, record.recovery.stagedChangeId],
		backupPathIntents: [record.recovery.backupPathIntent],
		validationOutput: record.recovery.validationOutput,
		summary: `Staged change ${record.changeId} is ${record.status} for ${record.targetPath}.`,
		updatedAt: record.updatedAt,
	});

const operationLogItem = (
	log: OperationLog,
	entry: OperationLogEntry,
	sourcePath: NormalizedVaultPath | undefined,
): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `operation-log:${log.logId}:${entry.id}`,
		sourceKind: "operation-log",
		sourcePath,
		commandId: commandIdForOperation(entry.operationKind),
		targetPaths: entry.paths,
		operationLogIds: [log.logId, entry.id],
		summary: entry.summary,
		updatedAt: entry.occurredAt,
	});

const isHealthReport = (
	value: unknown,
): value is {
	readonly reportId: string;
	readonly generatedAt: IsoTimestamp;
	readonly scannedPaths: readonly NormalizedVaultPath[];
	readonly findings: readonly { readonly affectedPaths: readonly NormalizedVaultPath[] }[];
	readonly summary: { readonly totalFindings: number };
} =>
	isRecord(value) &&
	typeof value.reportId === "string" &&
	typeof value.generatedAt === "string" &&
	Array.isArray(value.scannedPaths) &&
	Array.isArray(value.findings) &&
	isRecord(value.summary) &&
	typeof value.summary.totalFindings === "number";

const buildHealthReportItem = (
	report: {
		readonly reportId: string;
		readonly generatedAt: IsoTimestamp;
		readonly scannedPaths: readonly NormalizedVaultPath[];
		readonly findings: readonly { readonly affectedPaths: readonly NormalizedVaultPath[] }[];
		readonly summary: { readonly totalFindings: number };
	},
	sourcePath: NormalizedVaultPath | undefined,
): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `health-report:${report.reportId}`,
		sourceKind: "health-report",
		sourcePath,
		commandId: "voidbrain.health-check",
		targetPaths:
			report.findings.length === 0
				? report.scannedPaths
				: report.findings.flatMap((finding) => finding.affectedPaths),
		reportIds: [report.reportId],
		summary: `Health report ${report.reportId} has ${report.summary.totalFindings} finding(s).`,
		updatedAt: report.generatedAt,
	});

const isIngestionRecovery = (
	value: unknown,
): value is {
	readonly commandId: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly stagedChangeIds: readonly string[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly retryGuidance: string;
	readonly updatedAt: IsoTimestamp;
} =>
	isRecord(value) &&
	value.commandId === "voidbrain.ingest-source" &&
	typeof value.sourcePath === "string" &&
	isStringArray(value.stagedChangeIds) &&
	isStringArray(value.targetPaths) &&
	Array.isArray(value.validationOutput) &&
	typeof value.retryGuidance === "string" &&
	typeof value.updatedAt === "string";

const buildIngestionRecoveryItem = (
	record: {
		readonly commandId: string;
		readonly sourcePath: NormalizedVaultPath;
		readonly stagedChangeIds: readonly string[];
		readonly targetPaths: readonly NormalizedVaultPath[];
		readonly validationOutput: readonly ValidationIssue[];
		readonly retryGuidance: string;
		readonly updatedAt: IsoTimestamp;
	},
	sourcePath: NormalizedVaultPath | undefined,
): RecoveryEvidenceItem =>
	evidence({
		evidenceId: `ingestion-recovery:${record.sourcePath}`,
		sourceKind: "ingestion-recovery",
		sourcePath,
		commandId: record.commandId,
		targetPaths: [record.sourcePath, ...record.targetPaths],
		stagedChangeIds: record.stagedChangeIds,
		validationOutput: record.validationOutput,
		summary: record.retryGuidance,
		updatedAt: record.updatedAt,
	});

const statusFor = (items: readonly RecoveryEvidenceItem[], diagnostics: readonly RecoveryDiagnostic[]) => {
	if (items.length === 0) {
		return diagnostics.some((item) => item.severity === "error") ? "invalid" : "missing";
	}

	return diagnostics.some((item) => item.severity !== "info") ? "partial" : "ready";
};

const compareItems = (left: RecoveryEvidenceItem, right: RecoveryEvidenceItem): number =>
	[
		left.sourceKind,
		left.commandId,
		left.cachePath ?? "",
		left.targetPaths.join(","),
		left.reportIds.join(","),
		left.stagedChangeIds.join(","),
		left.evidenceId,
	]
		.join("|")
		.localeCompare(
			[
				right.sourceKind,
				right.commandId,
				right.cachePath ?? "",
				right.targetPaths.join(","),
				right.reportIds.join(","),
				right.stagedChangeIds.join(","),
				right.evidenceId,
			].join("|"),
		);

const compareDiagnostics = (left: RecoveryDiagnostic, right: RecoveryDiagnostic): number =>
	[left.severity, left.code, left.sourceKind ?? "", left.sourcePath ?? "", left.field ?? "", left.diagnosticId]
		.join("|")
		.localeCompare(
			[
				right.severity,
				right.code,
				right.sourceKind ?? "",
				right.sourcePath ?? "",
				right.field ?? "",
				right.diagnosticId,
			].join("|"),
		);

const validateFilters = (input: RecoverSessionInput, diagnostics: RecoveryDiagnostic[]): RecoveryFilters => {
	const cachePath = input.cachePath === undefined ? null : normalizeVaultPath(input.cachePath);
	const targetPath = input.targetPath === undefined ? null : normalizeVaultPath(input.targetPath);

	if (cachePath !== null && !cachePath.ok) {
		diagnostics.push(
			diagnostic({
				severity: "error",
				code: "recovery.invalid-filter",
				message: "Recovery cache path filter must be vault-relative.",
				field: "cachePath",
			}),
		);
	}
	if (targetPath !== null && !targetPath.ok) {
		diagnostics.push(
			diagnostic({
				severity: "error",
				code: "recovery.invalid-filter",
				message: "Recovery target path filter must be vault-relative.",
				field: "targetPath",
			}),
		);
	}

	return {
		...(input.commandId === undefined ? {} : { commandId: input.commandId }),
		...(cachePath?.ok ? { cachePath: cachePath.value } : {}),
		...(targetPath?.ok ? { targetPath: targetPath.value } : {}),
		...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
		...(input.reportId === undefined ? {} : { reportId: input.reportId }),
	};
};

const matchesFilters = (item: RecoveryEvidenceItem, filters: RecoveryFilters): boolean => {
	if (filters.commandId !== undefined && item.commandId !== filters.commandId) {
		return false;
	}
	if (filters.cachePath !== undefined && item.cachePath !== filters.cachePath) {
		return false;
	}
	if (filters.targetPath !== undefined && !item.targetPaths.includes(filters.targetPath)) {
		return false;
	}
	if (filters.stagedChangeId !== undefined && !item.stagedChangeIds.includes(filters.stagedChangeId)) {
		return false;
	}
	if (filters.reportId !== undefined && !item.reportIds.includes(filters.reportId)) {
		return false;
	}

	return true;
};

const hasFilters = (filters: RecoveryFilters): boolean =>
	filters.commandId !== undefined ||
	filters.cachePath !== undefined ||
	filters.targetPath !== undefined ||
	filters.stagedChangeId !== undefined ||
	filters.reportId !== undefined;

const isStale = (item: RecoveryEvidenceItem, now: Date, staleAfterMs: number): boolean => {
	if (item.updatedAt === undefined) {
		return false;
	}

	const timestamp = Date.parse(item.updatedAt);
	return Number.isFinite(timestamp) && now.getTime() - timestamp > staleAfterMs;
};

const errorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const bounded = <TValue>(
	values: readonly TValue[],
	limit: number,
	diagnostics: RecoveryDiagnostic[],
	itemKind: "item" | "diagnostic",
): readonly TValue[] => {
	if (values.length <= limit) {
		return values;
	}

	diagnostics.push(
		diagnostic({
			severity: "warning",
			code: "recovery.bounded-output",
			message: `Recovery ${itemKind} output was limited to ${limit} of ${values.length} record(s).`,
		}),
	);
	return values.slice(0, limit);
};

const buildActions = (items: readonly RecoveryEvidenceItem[]): readonly RecoveryAction[] => {
	const actions = new Map<string, RecoveryAction>();
	for (const item of items) {
		for (const stagedChangeId of item.stagedChangeIds) {
			const targetPath = item.targetPaths[0];
			actions.set(`review-staged-change:${stagedChangeId}`, {
				actionId: `review-staged-change:${stagedChangeId}`,
				kind: "review-staged-change",
				label: "Review staged change",
				reason: "Inspect staged-change diff, backup intent, conflicts, and validation output before apply.",
				commandId: "voidbrain.stage-change",
				stagedChangeId,
				...(targetPath === undefined ? {} : { targetPath }),
			});
		}
		for (const reportId of item.reportIds) {
			const targetPath = item.targetPaths[0];
			actions.set(`inspect-report:${reportId}`, {
				actionId: `inspect-report:${reportId}`,
				kind: "inspect-report",
				label: "Inspect health report",
				reason: "Review report findings and affected paths before staging repairs.",
				commandId: "voidbrain.health-check",
				reportId,
				...(targetPath === undefined ? {} : { targetPath }),
			});
		}
		if (item.cachePath !== undefined) {
			actions.set(`refresh-cache:${item.cachePath}`, {
				actionId: `refresh-cache:${item.cachePath}`,
				kind: "refresh-cache",
				label: "Refresh hot cache",
				reason: "Rebuild recent context from local runtime state when cache evidence is stale or malformed.",
				commandId: "voidbrain.hot-cache",
				cachePath: item.cachePath,
			});
		}
		const targetPath = item.targetPaths[0];
		const reportId = item.reportIds[0];
		const stagedChangeId = item.stagedChangeIds[0];
		actions.set(`retry-command:${item.commandId}`, {
			actionId: `retry-command:${item.commandId}`,
			kind: "retry-command",
			label: "Retry command",
			reason: "Retry only after inspecting recovery diagnostics and required evidence.",
			commandId: item.commandId,
			...(targetPath === undefined ? {} : { targetPath }),
			...(reportId === undefined ? {} : { reportId }),
			...(stagedChangeId === undefined ? {} : { stagedChangeId }),
		});
	}

	return [...actions.values()].sort((left, right) => left.actionId.localeCompare(right.actionId));
};

export class RecoverSessionService {
	public readonly commandId = RECOVER_SESSION_COMMAND_ID;

	public buildSummary(input: RecoverSessionInput = {}): RecoverySummary {
		const generatedAt = toIsoTimestamp(input.now ?? new Date());
		const now = input.now ?? new Date();
		const staleAfterMs = input.staleAfterMs ?? RECOVERY_STALE_AFTER_MS;
		const itemLimit = clampLimit(input.itemLimit, RECOVERY_DEFAULT_ITEM_LIMIT, RECOVERY_MAX_ITEM_LIMIT);
		const diagnosticLimit = clampLimit(
			input.diagnosticLimit,
			RECOVERY_DEFAULT_DIAGNOSTIC_LIMIT,
			RECOVERY_MAX_DIAGNOSTIC_LIMIT,
		);
		const items: RecoveryEvidenceItem[] = [];
		const diagnostics: RecoveryDiagnostic[] = [];
		const redaction: RedactionState = {
			redactedFieldCount: 0,
			omittedBodyCount: 0,
		};
		const sourceRecordPaths: NormalizedVaultPath[] = [];
		const filters = validateFilters(input, diagnostics);

		const addSourcePath = (path: NormalizedVaultPath | undefined): void => {
			if (path !== undefined) {
				sourceRecordPaths.push(path);
			}
		};

		this.collectHotCache(
			input.hotCache,
			sourcePathFor(input.hotCachePath),
			items,
			diagnostics,
			addSourcePath,
			redaction,
		);
		this.collectStagedChanges(input.stagedChanges ?? [], undefined, items, diagnostics, addSourcePath, redaction);
		this.collectHealthReport(input.healthReport, undefined, items, diagnostics, addSourcePath);
		this.collectOperationLog(input.operationLog, undefined, items, diagnostics, addSourcePath);
		this.collectIngestionRecoveries(input.ingestionRecoveries ?? [], undefined, items, diagnostics, addSourcePath);

		for (const readFailure of input.readFailures ?? []) {
			const sourcePath = sourcePathFor(readFailure.sourcePath);
			addSourcePath(sourcePath);
			diagnostics.push(
				diagnostic({
					severity: "error",
					code: "recovery.read-failed",
					message: errorMessage(readFailure.error, "Support record could not be read."),
					sourceKind: readFailure.sourceKind,
					sourcePath,
				}),
			);
		}

		for (const supportRecord of input.supportRecords ?? []) {
			const sourcePath = sourcePathFor(supportRecord.sourcePath);
			switch (supportRecord.sourceKind) {
				case "hot-cache":
					this.collectHotCache(supportRecord.value, sourcePath, items, diagnostics, addSourcePath, redaction);
					break;
				case "staged-change":
					this.collectStagedChanges(
						[supportRecord.value],
						sourcePath,
						items,
						diagnostics,
						addSourcePath,
						redaction,
					);
					break;
				case "health-report":
					this.collectHealthReport(supportRecord.value, sourcePath, items, diagnostics, addSourcePath);
					break;
				case "operation-log":
					this.collectOperationLog(supportRecord.value, sourcePath, items, diagnostics, addSourcePath);
					break;
				case "ingestion-recovery":
					this.collectIngestionRecoveries(
						[supportRecord.value],
						sourcePath,
						items,
						diagnostics,
						addSourcePath,
					);
					break;
				case "adapter-read":
					diagnostics.push(
						diagnostic({
							severity: "warning",
							code: "recovery.unsupported-record",
							message: "Adapter support record kind was not recognized by recovery.",
							sourceKind: supportRecord.sourceKind,
							sourcePath,
						}),
					);
					break;
				default: {
					const exhaustive: never = supportRecord.sourceKind;
					throw new Error(`Unhandled recovery support record kind: ${String(exhaustive)}`);
				}
			}
		}

		if (input.hotCache === undefined && input.hotCachePath !== undefined) {
			diagnostics.push(
				diagnostic({
					severity: "warning",
					code: "recovery.missing-record",
					message: "Hot cache support record is missing or unavailable.",
					sourceKind: "hot-cache",
					sourcePath: sourcePathFor(input.hotCachePath),
				}),
			);
		}

		if (
			items.length === 0 &&
			diagnostics.length === 0 &&
			(input.supportRecords?.length ?? 0) === 0 &&
			(input.readFailures?.length ?? 0) === 0
		) {
			diagnostics.push(
				diagnostic({
					severity: "warning",
					code: "recovery.missing-record",
					message: "No recovery support records were available.",
				}),
			);
		}

		for (const item of items) {
			if (!isStale(item, now, staleAfterMs)) {
				continue;
			}
			diagnostics.push(
				diagnostic({
					severity: "warning",
					code: "recovery.stale-record",
					message: `Recovery evidence ${item.evidenceId} is older than the configured stale window.`,
					sourceKind: item.sourceKind,
					sourcePath: item.sourcePath,
					field: item.evidenceId,
				}),
			);
		}

		const filteredItems = items.filter((item) => matchesFilters(item, filters)).sort(compareItems);
		if (items.length > 0 && filteredItems.length === 0 && hasFilters(filters)) {
			diagnostics.push(
				diagnostic({
					severity: "warning",
					code: "recovery.missing-record",
					message: "No recovery evidence matched the requested filters.",
				}),
			);
		}
		const boundedItems = bounded(filteredItems, itemLimit, diagnostics, "item");
		const sortedDiagnostics = diagnostics.sort(compareDiagnostics);
		const boundedDiagnostics = bounded(sortedDiagnostics, diagnosticLimit, sortedDiagnostics, "diagnostic");
		const actions = buildActions(boundedItems);
		const paths = [...new Set(sourceRecordPaths)].sort((left, right) => left.localeCompare(right));

		return {
			schemaVersion: RECOVERY_SCHEMA_VERSION,
			commandId: RECOVER_SESSION_COMMAND_ID,
			generatedAt,
			status: statusFor(boundedItems, boundedDiagnostics),
			query: {
				...(input.commandId === undefined ? {} : { commandId: input.commandId }),
				...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
				...(input.targetPath === undefined ? {} : { targetPath: input.targetPath }),
				...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
				...(input.reportId === undefined ? {} : { reportId: input.reportId }),
				...(input.itemLimit === undefined ? {} : { itemLimit: input.itemLimit }),
				...(input.diagnosticLimit === undefined ? {} : { diagnosticLimit: input.diagnosticLimit }),
				...(input.staleAfterMs === undefined ? {} : { staleAfterMs: input.staleAfterMs }),
			},
			sourceRecordPaths: paths,
			items: boundedItems,
			diagnostics: boundedDiagnostics,
			actions,
			redaction: {
				redacted: true,
				redactedFieldCount: redaction.redactedFieldCount,
				omittedBodyCount: redaction.omittedBodyCount,
				notes: [
					"Recovery summaries include IDs, paths, and validation output only.",
					"Raw note bodies, provider attempts, authorization headers, and hidden provider state are omitted.",
				],
			},
			counts: {
				sourceRecordCount: paths.length,
				itemCount: boundedItems.length,
				diagnosticCount: boundedDiagnostics.length,
				actionCount: actions.length,
			},
		};
	}

	private collectHotCache(
		value: unknown,
		sourcePath: NormalizedVaultPath | undefined,
		items: RecoveryEvidenceItem[],
		diagnostics: RecoveryDiagnostic[],
		addSourcePath: (path: NormalizedVaultPath | undefined) => void,
		redaction: RedactionState,
	): void {
		if (value === undefined || value === null) {
			return;
		}
		addSourcePath(sourcePath);
		addSecretDiagnostics(value, "hot-cache", sourcePath, diagnostics, redaction);
		const validation = validateHotCacheState(value);
		if (!validation.ok) {
			diagnostics.push(
				diagnostic({
					severity: "error",
					code: "recovery.malformed-record",
					message: issueText(validation.errors),
					sourceKind: "hot-cache",
					sourcePath,
				}),
			);
			return;
		}

		items.push(hotCacheItem(validation.value, sourcePath));
		items.push(...validation.value.entries.map((entry) => hotCacheEntryItem(entry, sourcePath)));
		redaction.omittedBodyCount += validation.value.redaction.omittedBodyCount;
	}

	private collectStagedChanges(
		values: readonly unknown[],
		sourcePath: NormalizedVaultPath | undefined,
		items: RecoveryEvidenceItem[],
		diagnostics: RecoveryDiagnostic[],
		addSourcePath: (path: NormalizedVaultPath | undefined) => void,
		redaction: RedactionState,
	): void {
		if (values.length === 0) {
			return;
		}
		addSourcePath(sourcePath);
		for (const value of values) {
			addSecretDiagnostics(value, "staged-change", sourcePath, diagnostics, redaction);
			const validation = validateStagedChangeRecord(value);
			if (!validation.ok) {
				diagnostics.push(
					diagnostic({
						severity: "error",
						code: "recovery.malformed-record",
						message: issueText(validation.errors),
						sourceKind: "staged-change",
						sourcePath,
					}),
				);
				continue;
			}
			addBodyOmissionDiagnostics(validation.value, sourcePath, diagnostics, redaction);
			items.push(stagedChangeItem(validation.value, sourcePath));
		}
	}

	private collectHealthReport(
		value: unknown,
		sourcePath: NormalizedVaultPath | undefined,
		items: RecoveryEvidenceItem[],
		diagnostics: RecoveryDiagnostic[],
		addSourcePath: (path: NormalizedVaultPath | undefined) => void,
	): void {
		if (value === undefined || value === null) {
			return;
		}
		addSourcePath(sourcePath);
		if (!isHealthReport(value)) {
			diagnostics.push(
				diagnostic({
					severity: "error",
					code: "recovery.malformed-record",
					message: "Health report support record is missing report ID, timestamp, findings, or summary.",
					sourceKind: "health-report",
					sourcePath,
				}),
			);
			return;
		}
		items.push(buildHealthReportItem(value, sourcePath));
	}

	private collectOperationLog(
		value: unknown,
		sourcePath: NormalizedVaultPath | undefined,
		items: RecoveryEvidenceItem[],
		diagnostics: RecoveryDiagnostic[],
		addSourcePath: (path: NormalizedVaultPath | undefined) => void,
	): void {
		if (value === undefined || value === null) {
			return;
		}
		addSourcePath(sourcePath);
		const validation = validateOperationLog(value);
		if (!validation.ok) {
			diagnostics.push(
				diagnostic({
					severity: "error",
					code: "recovery.malformed-record",
					message: issueText(validation.errors),
					sourceKind: "operation-log",
					sourcePath,
				}),
			);
			return;
		}
		items.push(...validation.value.entries.map((entry) => operationLogItem(validation.value, entry, sourcePath)));
	}

	private collectIngestionRecoveries(
		values: readonly unknown[],
		sourcePath: NormalizedVaultPath | undefined,
		items: RecoveryEvidenceItem[],
		diagnostics: RecoveryDiagnostic[],
		addSourcePath: (path: NormalizedVaultPath | undefined) => void,
	): void {
		if (values.length === 0) {
			return;
		}
		addSourcePath(sourcePath);
		for (const value of values) {
			if (!isIngestionRecovery(value)) {
				diagnostics.push(
					diagnostic({
						severity: "error",
						code: "recovery.malformed-record",
						message:
							"Ingestion recovery record is missing command ID, source path, targets, or validation output.",
						sourceKind: "ingestion-recovery",
						sourcePath,
					}),
				);
				continue;
			}
			items.push(buildIngestionRecoveryItem(value, sourcePath));
		}
	}
}

export const createRecoverSessionService = (): RecoverSessionService => new RecoverSessionService();
