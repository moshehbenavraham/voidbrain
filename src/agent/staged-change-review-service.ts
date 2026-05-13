import type {
	StagedReviewAction,
	StagedReviewActionRequest,
	StagedReviewActionResult,
	StagedReviewApplyFailure,
	StagedReviewApplyOutcome,
	StagedReviewApplyPlan,
	StagedReviewApplyPlanEntry,
	StagedReviewApplyPlanFailure,
	StagedReviewApplyPlanResult,
	StagedReviewAuditEntry,
	StagedReviewConfirmationKind,
	StagedReviewConfirmationRequirement,
	StagedReviewGroup,
	StagedReviewIndexRefreshResult,
	StagedReviewModel,
	StagedReviewOutcomeStatus,
	StagedReviewPreflightAdapter,
	StagedReviewPreview,
	StagedReviewPreviewKind,
	StagedReviewRecordOutcome,
	StagedReviewRecoverySummary,
	StagedReviewSummary,
} from "../types/staged-review";
import type {
	IsoTimestamp,
	NormalizedVaultPath,
	OperationKind,
	OperationLogEntry,
	StagedChangeConflict,
	StagedChangeOperationKind,
	StagedChangeRecord,
	StagedChangeStatus,
	ValidationIssue,
} from "../types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../types/vault";
import { validateStagedChangeRecord } from "../utils/vault-validation";
import { createContentSha256 } from "./staged-change-service";

export interface StagedChangeReviewServiceOptions {
	readonly now?: () => Date;
	readonly maxPreviewCharacters?: number;
	readonly maxDiffLines?: number;
}

const activeStatuses = new Set<StagedChangeStatus>(["proposed", "review-ready", "conflicted", "approved"]);
const applyableStatuses = new Set<StagedChangeStatus>(["review-ready", "approved"]);
const defaultMaxPreviewCharacters = 1200;
const defaultMaxDiffLines = 80;

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const sortStrings = <TValue extends string>(values: readonly TValue[]): readonly TValue[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

const byRecordSortKey = (left: StagedChangeRecord, right: StagedChangeRecord): number =>
	recordSortKey(left).localeCompare(recordSortKey(right));

const recordSortKey = (record: StagedChangeRecord): string =>
	[
		record.recovery.commandId,
		record.operationKind,
		record.status,
		record.review.destructive ? "1" : "0",
		record.targetPath,
		record.sourcePaths.join(","),
		record.changeId,
	].join("|");

const groupIdFor = (record: StagedChangeRecord): string =>
	[
		record.recovery.commandId,
		record.operationKind,
		record.status,
		record.review.destructive ? "destructive" : "non-destructive",
		record.targetPath,
	]
		.join("__")
		.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");

const successIndexRefresh = (targetPaths: readonly NormalizedVaultPath[]): StagedReviewIndexRefreshResult => ({
	attempted: false,
	ok: true,
	message: "Index refresh was not requested.",
	retryable: false,
	targetPaths,
});

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

const safeErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const operationLogKindForAction = (action: StagedReviewAuditEntry["action"]): OperationKind => {
	switch (action) {
		case "approve":
			return "staged-change-approved";
		case "reject":
			return "staged-change-rejected";
		case "dismiss":
			return "staged-change-dismissed";
		case "retry":
			return "staged-change-created";
		case "apply":
			return "staged-change-applied";
		case "backup-written":
			return "staged-change-backup-written";
		case "index-refresh":
			return "note-indexed";
		default: {
			const exhaustive: never = action;
			throw new Error(`Unhandled staged review action: ${String(exhaustive)}`);
		}
	}
};

const previewKindForOperation = (operationKind: StagedChangeOperationKind): StagedReviewPreviewKind => {
	switch (operationKind) {
		case "create-note":
			return "create-preview";
		case "update-note":
			return "diff-preview";
		case "delete-note":
			return "delete-preview";
		case "move-note":
			return "move-preview";
		case "update-frontmatter":
			return "frontmatter-preview";
		default: {
			const exhaustive: never = operationKind;
			throw new Error(`Unhandled staged-change operation: ${String(exhaustive)}`);
		}
	}
};

const isOverwriteOperation = (record: StagedChangeRecord): boolean =>
	record.operationKind === "update-note" || record.operationKind === "update-frontmatter";

const confirmationKindForRecords = (records: readonly StagedChangeRecord[]): StagedReviewConfirmationKind => {
	if (records.length === 0) {
		return "none";
	}

	if (records.length > 1) {
		return "batch";
	}

	const [record] = records;
	if (record === undefined) {
		return "none";
	}

	if (record.review.destructive) {
		return "destructive";
	}

	if (isOverwriteOperation(record)) {
		return "overwrite";
	}

	return record.operationKind === "create-note" ? "additive" : "update";
};

const requiredTextFor = (
	kind: StagedReviewConfirmationKind,
	records: readonly StagedChangeRecord[],
): string | undefined => {
	if (kind === "none" || kind === "additive") {
		return undefined;
	}

	if (kind === "batch") {
		return `APPLY ${records.length} STAGED CHANGES`;
	}

	const targetPath = records[0]?.targetPath ?? makeNormalizedVaultPath("unknown.md");
	if (kind === "destructive") {
		return `APPLY DESTRUCTIVE ${targetPath}`;
	}

	if (kind === "overwrite") {
		return `APPLY OVERWRITE ${targetPath}`;
	}

	return `APPLY ${targetPath}`;
};

const recoverySummaryFor = (record: StagedChangeRecord): StagedReviewRecoverySummary => ({
	commandId: record.recovery.commandId,
	stagedChangeId: record.recovery.stagedChangeId,
	targetPath: record.recovery.targetPath,
	status: record.recovery.status,
	...(record.recovery.backupPathIntent === undefined ? {} : { backupPathIntent: record.recovery.backupPathIntent }),
	validationOutput: record.recovery.validationOutput,
	...(record.recovery.rejectedAt === undefined ? {} : { rejectedAt: record.recovery.rejectedAt }),
	...(record.recovery.dismissedAt === undefined ? {} : { dismissedAt: record.recovery.dismissedAt }),
	...(record.recovery.failedAt === undefined ? {} : { failedAt: record.recovery.failedAt }),
	...(record.recovery.lastFailureMessage === undefined
		? {}
		: { lastFailureMessage: record.recovery.lastFailureMessage }),
});

const assertValidRecord = (record: StagedChangeRecord): StagedChangeRecord => {
	const result = validateStagedChangeRecord(record);
	if (!result.ok) {
		throw new Error(`Invalid staged-change transition: ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

export class StagedChangeReviewService {
	private readonly inFlightActions = new Set<string>();
	private readonly maxPreviewCharacters: number;
	private readonly maxDiffLines: number;

	public constructor(private readonly options: StagedChangeReviewServiceOptions = {}) {
		this.maxPreviewCharacters = options.maxPreviewCharacters ?? defaultMaxPreviewCharacters;
		this.maxDiffLines = options.maxDiffLines ?? defaultMaxDiffLines;
	}

	public createModel(records: readonly StagedChangeRecord[]): StagedReviewModel {
		const sortedRecords = [...records].sort(byRecordSortKey);
		const groupsById = new Map<string, StagedChangeRecord[]>();

		for (const record of sortedRecords) {
			const groupId = groupIdFor(record);
			const group = groupsById.get(groupId) ?? [];
			group.push(record);
			groupsById.set(groupId, group);
		}

		const groups = [...groupsById.entries()]
			.map(([groupId, groupRecords]) => this.createGroup(groupId, groupRecords))
			.sort((left, right) => left.groupId.localeCompare(right.groupId));

		return {
			generatedAt: this.now(),
			groups,
			summary: summarizeRecords(sortedRecords),
		};
	}

	public createPreview(record: StagedChangeRecord): StagedReviewPreview {
		const before = this.boundPreview(record.diff.beforeContent);
		const after = this.boundPreview(record.diff.afterContent);
		const diffLines = record.diff.lineDiff.slice(0, this.maxDiffLines).map((line) => ({
			kind: line.kind,
			...(line.oldLineNumber === undefined ? {} : { oldLineNumber: line.oldLineNumber }),
			...(line.newLineNumber === undefined ? {} : { newLineNumber: line.newLineNumber }),
			content: this.boundLine(line.content),
		}));

		return {
			changeId: record.changeId,
			previewKind: previewKindForOperation(record.operationKind),
			operationKind: record.operationKind,
			status: record.status,
			targetPath: record.targetPath,
			...(record.operationMetadata?.destinationPath === undefined
				? {}
				: { destinationPath: record.operationMetadata.destinationPath }),
			sourcePaths: record.sourcePaths,
			rationale: record.rationale,
			...(before.content === undefined ? {} : { beforePreview: before.content }),
			...(after.content === undefined ? {} : { afterPreview: after.content }),
			truncatedBefore: before.truncated,
			truncatedAfter: after.truncated,
			diffLines,
			conflicts: record.conflicts,
			validationOutput: record.recovery.validationOutput,
			...(record.recovery.backupPathIntent === undefined
				? {}
				: { backupPathIntent: record.recovery.backupPathIntent }),
		};
	}

	public getConfirmationRequirement(records: readonly StagedChangeRecord[]): StagedReviewConfirmationRequirement {
		const sortedRecords = [...records].sort(byRecordSortKey);
		const kind = confirmationKindForRecords(sortedRecords);
		const requiredText = requiredTextFor(kind, sortedRecords);
		const reasons = sortStrings([
			...sortedRecords.flatMap((record) => record.review.reasons),
			...(sortedRecords.length > 1 ? ["batch-apply"] : []),
		]);

		return {
			kind,
			required:
				requiredText !== undefined || sortedRecords.some((record) => record.review.requiresExplicitReview),
			...(requiredText === undefined ? {} : { requiredText }),
			reasons,
			appliesToChangeIds: sortedRecords.map((record) => record.changeId),
		};
	}

	public applyAction(
		records: readonly StagedChangeRecord[],
		request: StagedReviewActionRequest,
	): StagedReviewActionResult {
		const selected = selectRecords(records, request.changeIds);
		if (!selected.ok) {
			return this.actionFailure(records, request.action, selected.errors);
		}

		const inFlightKey = this.inFlightKey(request.action, selected.records);
		if (this.inFlightActions.has(inFlightKey)) {
			return this.actionFailure(records, request.action, [
				validationIssue(
					"record.invalid-operation",
					"A staged-review action is already in flight.",
					"changeIds",
				),
			]);
		}

		this.inFlightActions.add(inFlightKey);
		try {
			const changedRecords = new Map<string, StagedChangeRecord>();
			const outcomes: StagedReviewRecordOutcome[] = [];
			const auditEntries: StagedReviewAuditEntry[] = [];

			for (const record of selected.records) {
				const transition = this.transitionRecord(record, request);
				changedRecords.set(record.changeId, transition.record);
				outcomes.push(transition.outcome);
				if (transition.outcome.auditEntry !== undefined) {
					auditEntries.push(transition.outcome.auditEntry);
				}
			}

			const nextRecords = records.map((record) => changedRecords.get(record.changeId) ?? record);
			return {
				ok: outcomes.every((outcome) => outcome.status !== "failed" && outcome.status !== "skipped"),
				action: request.action,
				records: nextRecords,
				outcomes,
				auditEntries,
				recovery: outcomes.map((outcome) => outcome.recovery),
			};
		} finally {
			this.inFlightActions.delete(inFlightKey);
		}
	}

	public async planApply(
		records: readonly StagedChangeRecord[],
		request: StagedReviewActionRequest,
		adapter: StagedReviewPreflightAdapter,
	): Promise<StagedReviewApplyPlanResult> {
		const selected = selectRecords(records, request.changeIds);
		if (!selected.ok) {
			return this.planFailure(records, "apply", selected.errors);
		}

		const inFlightKey = this.inFlightKey("apply", selected.records);
		if (this.inFlightActions.has(inFlightKey)) {
			return this.planFailure(records, "apply", [
				validationIssue("record.invalid-operation", "A staged-review apply is already in flight.", "changeIds"),
			]);
		}

		this.inFlightActions.add(inFlightKey);
		try {
			const confirmation = this.getConfirmationRequirement(selected.records);
			const confirmationError = this.validateConfirmation(confirmation, request.confirmationText);
			if (confirmationError !== null) {
				return this.planFailure(records, "apply", [confirmationError]);
			}

			const duplicateErrors = findDuplicateApplyPaths(selected.records);
			if (duplicateErrors.length > 0) {
				const conflicted = selected.records.map((record) => this.markConflicted(record, duplicateErrors));
				return this.planFailureWithRecords(records, "apply", conflicted, duplicateErrors);
			}

			const entries: StagedReviewApplyPlanEntry[] = [];
			const conflictedRecords: StagedChangeRecord[] = [];
			const errors: ValidationIssue[] = [];

			for (const record of selected.records) {
				if (!applyableStatuses.has(record.status)) {
					const error = validationIssue(
						"record.invalid-state",
						`Staged change ${record.changeId} must be review-ready or approved before apply.`,
						"status",
						record.targetPath,
					);
					errors.push(error);
					conflictedRecords.push(this.markConflicted(record, [error]));
					continue;
				}

				const preflight = await this.preflightRecord(record, adapter);
				if (preflight.ok) {
					entries.push(preflight.entry);
				} else {
					errors.push(...preflight.errors);
					conflictedRecords.push(this.markConflicted(record, preflight.errors));
				}
			}

			if (errors.length > 0) {
				return this.planFailureWithRecords(records, "apply", conflictedRecords, errors);
			}

			const createdAt = this.now();
			const planId = `apply-${createdAt.replaceAll(/[^0-9]/g, "")}-${entries.length}`;
			return {
				ok: true,
				plan: {
					planId,
					createdAt,
					confirmation,
					entries,
					auditEntries: entries.map((entry) =>
						this.auditEntry(
							"apply",
							entry.record,
							"succeeded",
							"Staged change passed apply preflight.",
							createdAt,
						),
					),
					recovery: entries.map((entry) => recoverySummaryFor(entry.record)),
				},
			};
		} finally {
			this.inFlightActions.delete(inFlightKey);
		}
	}

	public finalizeApplyPlan(
		plan: StagedReviewApplyPlan,
		failures: readonly StagedReviewApplyFailure[] = [],
		indexRefresh: StagedReviewIndexRefreshResult = successIndexRefresh(
			plan.entries.map((entry) => entry.record.targetPath),
		),
	): StagedReviewApplyOutcome {
		const failureById = new Map(failures.map((failure) => [failure.changeId, failure]));
		const now = this.now();
		const outcomes = plan.entries.map((entry) => {
			const failure = failureById.get(entry.record.changeId);
			if (failure !== undefined) {
				const record = this.markFailed(entry.record, failure.message, failure.validationOutput, now);
				const auditEntry = this.auditEntry("apply", record, "failed", failure.message, now);
				return this.recordOutcome("failed", record, failure.message, auditEntry);
			}

			const record = this.markApplied(entry.record, entry.backupPath, now);
			const auditEntry = this.auditEntry("apply", record, "succeeded", "Staged change was applied.", now);
			return this.recordOutcome("applied", record, "Staged change was applied.", auditEntry);
		});
		const records = outcomes.map((outcome) => outcome.record);
		const auditEntries = [
			...plan.auditEntries,
			...outcomes.flatMap((outcome) => (outcome.auditEntry === undefined ? [] : [outcome.auditEntry])),
			...(indexRefresh.attempted
				? [
						this.indexRefreshAuditEntry(
							indexRefresh.ok ? "succeeded" : "failed",
							indexRefresh.message,
							indexRefresh.targetPaths,
							now,
						),
					]
				: []),
		];

		return {
			ok: outcomes.every((outcome) => outcome.status === "applied"),
			planId: plan.planId,
			records,
			outcomes,
			auditEntries,
			recovery: outcomes.map((outcome) => outcome.recovery),
			indexRefresh,
		};
	}

	private createGroup(groupId: string, records: readonly StagedChangeRecord[]): StagedReviewGroup {
		const sortedRecords = [...records].sort(byRecordSortKey);
		const [first] = sortedRecords;
		if (first === undefined) {
			throw new Error("Cannot create a staged-review group without records.");
		}

		return {
			groupId,
			key: {
				commandId: first.recovery.commandId,
				operationKind: first.operationKind,
				status: first.status,
				destructive: first.review.destructive,
				targetPath: first.targetPath,
			},
			changeIds: sortedRecords.map((record) => record.changeId),
			records: sortedRecords,
			previews: sortedRecords.map((record) => this.createPreview(record)),
			summary: summarizeRecords(sortedRecords),
			confirmation: this.getConfirmationRequirement(sortedRecords),
		};
	}

	private async preflightRecord(
		record: StagedChangeRecord,
		adapter: StagedReviewPreflightAdapter,
	): Promise<
		| { readonly ok: true; readonly entry: StagedReviewApplyPlanEntry }
		| { readonly ok: false; readonly errors: readonly ValidationIssue[] }
	> {
		const errors: ValidationIssue[] = [];
		try {
			const canWrite = adapter.canWrite === undefined ? true : await adapter.canWrite(record.targetPath);
			if (!canWrite) {
				errors.push(
					validationIssue(
						"record.invalid-operation",
						`Vault permission check failed for ${record.targetPath}.`,
						"targetPath",
						record.targetPath,
					),
				);
			}
		} catch (error) {
			errors.push(
				validationIssue(
					"record.invalid-operation",
					safeErrorMessage(error, `Vault permission check failed for ${record.targetPath}.`),
					"targetPath",
					record.targetPath,
				),
			);
		}

		const targetExists = await this.safeExists(adapter, record.targetPath, errors);
		const destinationPath = record.operationMetadata?.destinationPath;
		const destinationExists =
			destinationPath === undefined ? false : await this.safeExists(adapter, destinationPath, errors);

		let currentContent: string | undefined;
		if (targetExists) {
			currentContent = await this.safeRead(adapter, record.targetPath, errors);
		}

		await this.checkOperationPreflight(record, targetExists, destinationExists, currentContent, errors);

		if (errors.length > 0) {
			return { ok: false, errors };
		}

		return {
			ok: true,
			entry: {
				record,
				...(currentContent === undefined ? {} : { currentContent }),
				...(record.review.destructive && currentContent !== undefined ? { backupContent: currentContent } : {}),
				...(record.recovery.backupPathIntent === undefined
					? {}
					: { backupPath: record.recovery.backupPathIntent }),
				...(destinationPath === undefined ? {} : { destinationPath }),
				validationOutput: record.recovery.validationOutput,
			},
		};
	}

	private async checkOperationPreflight(
		record: StagedChangeRecord,
		targetExists: boolean,
		destinationExists: boolean,
		currentContent: string | undefined,
		errors: ValidationIssue[],
	): Promise<void> {
		if (record.operationKind === "create-note" && targetExists) {
			errors.push(
				validationIssue(
					"record.invalid-state",
					`Cannot create ${record.targetPath} because the target already exists.`,
					"targetPath",
					record.targetPath,
				),
			);
			return;
		}

		if (record.operationKind !== "create-note" && !targetExists) {
			errors.push(
				validationIssue(
					"record.invalid-state",
					`Cannot apply ${record.operationKind} because ${record.targetPath} is missing.`,
					"targetPath",
					record.targetPath,
				),
			);
			return;
		}

		if (record.operationKind === "move-note" && destinationExists) {
			errors.push(
				validationIssue(
					"record.invalid-state",
					`Cannot move ${record.targetPath} because the destination already exists.`,
					"operationMetadata.destinationPath",
					record.operationMetadata?.destinationPath,
				),
			);
		}

		if (record.beforeSha256 !== undefined && currentContent !== undefined) {
			const actualSha256 = await createContentSha256(currentContent);
			if (actualSha256 !== record.beforeSha256) {
				errors.push(
					validationIssue(
						"record.invalid-state",
						`Cannot apply ${record.targetPath} because the current content hash changed.`,
						"beforeSha256",
						record.targetPath,
					),
				);
			}
		}
	}

	private async safeExists(
		adapter: StagedReviewPreflightAdapter,
		path: NormalizedVaultPath,
		errors: ValidationIssue[],
	): Promise<boolean> {
		try {
			return await adapter.exists(path);
		} catch (error) {
			errors.push(
				validationIssue(
					"record.invalid-operation",
					safeErrorMessage(error, `Could not check whether ${path} exists.`),
					"targetPath",
					path,
				),
			);
			return false;
		}
	}

	private async safeRead(
		adapter: StagedReviewPreflightAdapter,
		path: NormalizedVaultPath,
		errors: ValidationIssue[],
	): Promise<string | undefined> {
		try {
			return await adapter.read(path);
		} catch (error) {
			errors.push(
				validationIssue(
					"record.invalid-operation",
					safeErrorMessage(error, `Could not read ${path} before apply.`),
					"targetPath",
					path,
				),
			);
			return undefined;
		}
	}

	private transitionRecord(
		record: StagedChangeRecord,
		request: StagedReviewActionRequest,
	): { readonly record: StagedChangeRecord; readonly outcome: StagedReviewRecordOutcome } {
		const now = this.now();
		if (request.action === "apply") {
			const auditEntry = this.auditEntry("apply", record, "failed", "Use planApply for apply execution.", now);
			return {
				record,
				outcome: this.recordOutcome("skipped", record, "Use planApply for apply execution.", auditEntry),
			};
		}

		if (request.action === "approve") {
			if (record.conflicts.some((conflict) => conflict.severity === "blocking")) {
				const conflicted = this.markConflicted(record, record.recovery.validationOutput);
				const auditEntry = this.auditEntry(
					"approve",
					conflicted,
					"failed",
					"Blocking conflicts must be resolved.",
					now,
				);
				return {
					record: conflicted,
					outcome: this.recordOutcome(
						"conflicted",
						conflicted,
						"Blocking conflicts must be resolved.",
						auditEntry,
					),
				};
			}

			const approved = this.updateRecord(record, {
				status: "approved",
				recoveryStatus: "pending-review",
				updatedAt: now,
				auditAction: "approve",
			});
			const auditEntry = this.auditEntry("approve", approved, "succeeded", "Staged change was approved.", now);
			return {
				record: approved,
				outcome: this.recordOutcome("planned", approved, "Staged change was approved.", auditEntry),
			};
		}

		if (request.action === "reject") {
			const rejected = this.updateRecord(record, {
				status: "rejected",
				recoveryStatus: "rejected",
				updatedAt: now,
				rejectedAt: now,
				auditAction: "reject",
			});
			const auditEntry = this.auditEntry(
				"reject",
				rejected,
				"succeeded",
				request.reason ?? "Staged change was rejected.",
				now,
			);
			return {
				record: rejected,
				outcome: this.recordOutcome("rejected", rejected, "Staged change was rejected.", auditEntry),
			};
		}

		if (request.action === "dismiss") {
			const dismissed = this.updateRecord(record, {
				status: "dismissed",
				recoveryStatus: "dismissed",
				updatedAt: now,
				dismissedAt: now,
				auditAction: "dismiss",
			});
			const auditEntry = this.auditEntry(
				"dismiss",
				dismissed,
				"succeeded",
				request.reason ?? "Staged change was dismissed from review.",
				now,
			);
			return {
				record: dismissed,
				outcome: this.recordOutcome("dismissed", dismissed, "Staged change was dismissed.", auditEntry),
			};
		}

		if (request.action === "retry") {
			const hasBlockingConflict = record.conflicts.some((conflict) => conflict.severity === "blocking");
			const retried = this.updateRecord(record, {
				status: hasBlockingConflict ? "conflicted" : "review-ready",
				recoveryStatus: hasBlockingConflict ? "retryable" : "pending-review",
				updatedAt: now,
				auditAction: "retry",
			});
			const auditEntry = this.auditEntry(
				"retry",
				retried,
				"succeeded",
				"Staged change was returned to review.",
				now,
			);
			return {
				record: retried,
				outcome: this.recordOutcome(
					hasBlockingConflict ? "conflicted" : "planned",
					retried,
					auditEntry.message,
					auditEntry,
				),
			};
		}

		const exhaustive: never = request.action;
		throw new Error(`Unhandled staged-review action: ${String(exhaustive)}`);
	}

	private markConflicted(
		record: StagedChangeRecord,
		validationOutput: readonly ValidationIssue[],
	): StagedChangeRecord {
		const conflicts = mergeConflicts(record.conflicts, validationOutput, record);
		return this.updateRecord(record, {
			status: "conflicted",
			recoveryStatus: "retryable",
			updatedAt: this.now(),
			validationOutput: [...record.recovery.validationOutput, ...validationOutput],
			conflicts,
			auditAction: "apply",
		});
	}

	private markApplied(
		record: StagedChangeRecord,
		backupPath: NormalizedVaultPath | undefined,
		appliedAt: IsoTimestamp,
	): StagedChangeRecord {
		return this.updateRecord(record, {
			status: "applied",
			recoveryStatus: "applied",
			updatedAt: appliedAt,
			appliedAt,
			...(backupPath === undefined ? {} : { backupWrittenAt: appliedAt }),
			auditAction: "apply",
		});
	}

	private markFailed(
		record: StagedChangeRecord,
		message: string,
		validationOutput: readonly ValidationIssue[],
		failedAt: IsoTimestamp,
	): StagedChangeRecord {
		return this.updateRecord(record, {
			status: "failed",
			recoveryStatus: "failed-apply",
			updatedAt: failedAt,
			failedAt,
			lastFailureMessage: message,
			validationOutput: [...record.recovery.validationOutput, ...validationOutput],
			auditAction: "apply",
		});
	}

	private updateRecord(
		record: StagedChangeRecord,
		update: {
			readonly status: StagedChangeStatus;
			readonly recoveryStatus: StagedChangeRecord["recovery"]["status"];
			readonly updatedAt: IsoTimestamp;
			readonly validationOutput?: readonly ValidationIssue[];
			readonly conflicts?: readonly StagedChangeConflict[];
			readonly backupWrittenAt?: IsoTimestamp;
			readonly appliedAt?: IsoTimestamp;
			readonly rejectedAt?: IsoTimestamp;
			readonly dismissedAt?: IsoTimestamp;
			readonly failedAt?: IsoTimestamp;
			readonly lastFailureMessage?: string;
			readonly auditAction: StagedReviewAction;
		},
	): StagedChangeRecord {
		const auditId = auditIdFor(update.auditAction, record, update.updatedAt);
		const recovery = {
			commandId: record.recovery.commandId,
			stagedChangeId: record.recovery.stagedChangeId,
			targetPath: record.recovery.targetPath,
			status: update.recoveryStatus,
			...(record.recovery.backupPathIntent === undefined
				? {}
				: { backupPathIntent: record.recovery.backupPathIntent }),
			...(update.backupWrittenAt === undefined ? {} : { backupWrittenAt: update.backupWrittenAt }),
			...(update.appliedAt === undefined ? {} : { appliedAt: update.appliedAt }),
			validationOutput: update.validationOutput ?? record.recovery.validationOutput,
			...(update.rejectedAt === undefined ? {} : { rejectedAt: update.rejectedAt }),
			...(update.dismissedAt === undefined ? {} : { dismissedAt: update.dismissedAt }),
			...(update.failedAt === undefined ? {} : { failedAt: update.failedAt }),
			...(update.lastFailureMessage === undefined ? {} : { lastFailureMessage: update.lastFailureMessage }),
			auditLogEntryIds: sortStrings([...(record.recovery.auditLogEntryIds ?? []), auditId]),
		};

		return assertValidRecord({
			...record,
			status: update.status,
			updatedAt: update.updatedAt,
			conflicts: update.conflicts ?? record.conflicts,
			recovery,
		});
	}

	private auditEntry(
		action: StagedReviewAuditEntry["action"],
		record: StagedChangeRecord,
		status: "succeeded" | "failed",
		message: string,
		occurredAt: IsoTimestamp,
	): StagedReviewAuditEntry {
		const operationKind = operationLogKindForAction(action);
		const id = auditIdFor(action, record, occurredAt);
		const paths = sortStrings([
			record.targetPath,
			...(record.operationMetadata?.destinationPath === undefined
				? []
				: [record.operationMetadata.destinationPath]),
		]);
		const operationLogEntry: OperationLogEntry = {
			id,
			operationKind,
			occurredAt,
			status,
			summary: message,
			paths,
		};

		return {
			id,
			commandId: record.recovery.commandId,
			stagedChangeId: record.changeId,
			action,
			operationKind: record.operationKind,
			occurredAt,
			status,
			targetPath: record.targetPath,
			...(record.operationMetadata?.destinationPath === undefined
				? {}
				: { destinationPath: record.operationMetadata.destinationPath }),
			...(record.recovery.backupPathIntent === undefined ? {} : { backupPath: record.recovery.backupPathIntent }),
			validationOutput: record.recovery.validationOutput,
			message,
			operationLogEntry,
		};
	}

	private indexRefreshAuditEntry(
		status: "succeeded" | "failed",
		message: string,
		targetPaths: readonly NormalizedVaultPath[],
		occurredAt: IsoTimestamp,
	): StagedReviewAuditEntry {
		const targetPath = targetPaths[0] ?? makeNormalizedVaultPath(".voidbrain/staged-changes/index-refresh.json");
		const operationLogEntry: OperationLogEntry = {
			id: `audit-index-refresh-${occurredAt.replaceAll(/[^0-9]/g, "")}`,
			operationKind: "note-indexed",
			occurredAt,
			status,
			summary: message,
			paths: sortStrings(targetPaths),
		};

		return {
			id: operationLogEntry.id,
			commandId: "voidbrain.stage-change",
			stagedChangeId: "index-refresh",
			action: "index-refresh",
			operationKind: "update-note",
			occurredAt,
			status,
			targetPath,
			validationOutput: [],
			message,
			operationLogEntry,
		};
	}

	private recordOutcome(
		status: StagedReviewOutcomeStatus,
		record: StagedChangeRecord,
		message: string,
		auditEntry?: StagedReviewAuditEntry,
	): StagedReviewRecordOutcome {
		return {
			changeId: record.changeId,
			status,
			record,
			message,
			recovery: recoverySummaryFor(record),
			...(auditEntry === undefined ? {} : { auditEntry }),
		};
	}

	private planFailure(
		records: readonly StagedChangeRecord[],
		action: StagedReviewAction,
		errors: readonly ValidationIssue[],
	): StagedReviewApplyPlanFailure {
		return this.planFailureWithRecords(records, action, [], errors);
	}

	private planFailureWithRecords(
		records: readonly StagedChangeRecord[],
		action: StagedReviewAction,
		changedRecords: readonly StagedChangeRecord[],
		errors: readonly ValidationIssue[],
	): StagedReviewApplyPlanFailure {
		const changedById = new Map(changedRecords.map((record) => [record.changeId, record]));
		const nextRecords = records.map((record) => changedById.get(record.changeId) ?? record);
		const auditEntries = changedRecords.map((record) =>
			this.auditEntry(action, record, "failed", "Staged change apply preflight failed.", this.now()),
		);
		const outcomes = changedRecords.map((record, index) =>
			this.recordOutcome(
				"conflicted",
				record,
				errors[index]?.message ?? "Staged change apply preflight failed.",
				auditEntries[index],
			),
		);

		return {
			ok: false,
			records: nextRecords,
			outcomes,
			auditEntries,
			recovery: outcomes.map((outcome) => outcome.recovery),
			errors,
		};
	}

	private actionFailure(
		records: readonly StagedChangeRecord[],
		action: StagedReviewAction,
		errors: readonly ValidationIssue[],
	): StagedReviewActionResult {
		return {
			ok: false,
			action,
			records,
			outcomes: [],
			auditEntries: [],
			recovery: records.filter((record) => activeStatuses.has(record.status)).map(recoverySummaryFor),
		};
	}

	private validateConfirmation(
		confirmation: StagedReviewConfirmationRequirement,
		confirmationText: string | undefined,
	): ValidationIssue | null {
		if (confirmation.requiredText === undefined) {
			return null;
		}

		if (confirmationText === confirmation.requiredText) {
			return null;
		}

		return validationIssue(
			"record.invalid-operation",
			`Confirmation text must match ${confirmation.requiredText}.`,
			"confirmationText",
		);
	}

	private boundPreview(content: string | undefined): { readonly content?: string; readonly truncated: boolean } {
		if (content === undefined) {
			return { truncated: false };
		}

		if (content.length <= this.maxPreviewCharacters) {
			return { content, truncated: false };
		}

		return {
			content: `${content.slice(0, this.maxPreviewCharacters)}\n[preview truncated]`,
			truncated: true,
		};
	}

	private boundLine(content: string): string {
		if (content.length <= 240) {
			return content;
		}

		return `${content.slice(0, 240)} [line truncated]`;
	}

	private now(): IsoTimestamp {
		return toIsoTimestamp(this.options.now?.() ?? new Date());
	}

	private inFlightKey(action: StagedReviewAction, records: readonly StagedChangeRecord[]): string {
		return `${action}:${records
			.map((record) => record.changeId)
			.sort((left, right) => left.localeCompare(right))
			.join(",")}`;
	}
}

const auditIdFor = (
	action: StagedReviewAuditEntry["action"],
	record: StagedChangeRecord,
	occurredAt: IsoTimestamp,
): string => `audit-${action}-${record.changeId}-${occurredAt.replaceAll(/[^0-9]/g, "")}`;

const summarizeRecords = (records: readonly StagedChangeRecord[]): StagedReviewSummary => ({
	totalRecords: records.length,
	activeRecords: records.filter((record) => activeStatuses.has(record.status)).length,
	approvedRecords: records.filter((record) => record.status === "approved").length,
	appliedRecords: records.filter((record) => record.status === "applied").length,
	rejectedRecords: records.filter((record) => record.status === "rejected").length,
	dismissedRecords: records.filter((record) => record.status === "dismissed").length,
	conflictedRecords: records.filter((record) => record.status === "conflicted").length,
	failedRecords: records.filter((record) => record.status === "failed").length,
	destructiveRecords: records.filter((record) => record.review.destructive).length,
	targetPaths: sortStrings(records.map((record) => record.targetPath)),
	sourcePaths: sortStrings(records.flatMap((record) => record.sourcePaths)),
});

const selectRecords = (
	records: readonly StagedChangeRecord[],
	changeIds: readonly string[],
):
	| { readonly ok: true; readonly records: readonly StagedChangeRecord[] }
	| { readonly ok: false; readonly errors: readonly ValidationIssue[] } => {
	if (changeIds.length === 0) {
		return {
			ok: false,
			errors: [
				validationIssue("metadata.missing-field", "At least one staged-change ID is required.", "changeIds"),
			],
		};
	}

	const requested = new Set(changeIds);
	const selectedById = new Map<string, StagedChangeRecord>();
	for (const record of records.filter((candidate) => requested.has(candidate.changeId)).sort(byRecordSortKey)) {
		if (!selectedById.has(record.changeId)) {
			selectedById.set(record.changeId, record);
		}
	}
	const selected = [...selectedById.values()];
	if (selectedById.size === requested.size) {
		return { ok: true, records: selected };
	}

	const missing = [...requested].filter((changeId) => !selectedById.has(changeId));
	return {
		ok: false,
		errors: missing.map((changeId) =>
			validationIssue("metadata.missing-field", `Staged change ${changeId} is not available.`, "changeIds"),
		),
	};
};

const findDuplicateApplyPaths = (records: readonly StagedChangeRecord[]): readonly ValidationIssue[] => {
	const pathOwners = new Map<string, string[]>();
	for (const record of records) {
		for (const path of [record.targetPath, record.operationMetadata?.destinationPath].filter(
			(path): path is NormalizedVaultPath => path !== undefined,
		)) {
			pathOwners.set(path, [...(pathOwners.get(path) ?? []), record.changeId]);
		}
	}

	return [...pathOwners.entries()]
		.filter(([, owners]) => owners.length > 1)
		.map(([path, owners]) =>
			validationIssue(
				"record.invalid-state",
				`Multiple active staged changes in this apply plan touch ${path}: ${owners.join(", ")}.`,
				"targetPath",
				makeNormalizedVaultPath(path),
			),
		);
};

const conflictKindForIssue = (issue: ValidationIssue): StagedChangeConflict["kind"] => {
	if (issue.message.includes("already exists")) {
		return issue.field === "operationMetadata.destinationPath" ? "destination-exists" : "target-exists";
	}

	if (issue.message.includes("missing")) {
		return "target-missing";
	}

	if (issue.message.includes("hash changed")) {
		return "target-changed";
	}

	if (issue.message.includes("Multiple active staged changes")) {
		return "duplicate-in-flight";
	}

	return "validation-failed";
};

const mergeConflicts = (
	conflicts: readonly StagedChangeConflict[],
	issues: readonly ValidationIssue[],
	record: StagedChangeRecord,
): readonly StagedChangeConflict[] => {
	const nextConflicts = [...conflicts];
	for (const issue of issues) {
		nextConflicts.push({
			kind: conflictKindForIssue(issue),
			severity: "blocking",
			message: issue.message,
			paths: [record.targetPath],
			...(record.beforeSha256 === undefined ? {} : { expectedSha256: record.beforeSha256 }),
		});
	}

	return nextConflicts;
};

export const createStagedReviewModel = (
	records: readonly StagedChangeRecord[],
	options?: StagedChangeReviewServiceOptions,
): StagedReviewModel => new StagedChangeReviewService(options).createModel(records);

export const createStagedChangeReviewService = (
	options?: StagedChangeReviewServiceOptions,
): StagedChangeReviewService => new StagedChangeReviewService(options);
