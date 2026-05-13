import { redactDiagnostic } from "../providers/redaction";
import {
	type ChatContextChip,
	type ChatContextChipKind,
	type PersistedChatThreadState,
	makeChatBranchId,
	makeChatContextChipId,
	makeChatThreadId,
} from "../types/chat";
import {
	HOT_CACHE_COMMAND_ID,
	HOT_CACHE_DEFAULT_ENTRY_LIMIT,
	HOT_CACHE_MAX_METADATA_STRING_LENGTH,
	HOT_CACHE_MAX_PATHS,
	HOT_CACHE_MAX_SUMMARY_LENGTH,
	HOT_CACHE_SESSION_SUMMARY_COMMAND_ID,
	type HotCacheCaptureInput,
	type HotCacheCaptureResult,
	type HotCacheMetadata,
	type HotCacheMetadataPrimitive,
	type HotCacheMetadataValue,
	type HotCacheRecoveryReference,
	type HotCacheRestoreInput,
	type HotCacheRestoreResult,
	type HotCacheSessionSummaryInput,
	type HotCacheSessionSummaryResult,
} from "../types/hot-cache";
import type { IndexingPathDiagnostic, IndexingRuntimeReport } from "../types/indexing-runtime";
import type { SourceIngestionQueueSummary } from "../types/ingestion-queue";
import type {
	HotCacheEntry,
	HotCacheEntryKind,
	HotCacheState,
	IsoTimestamp,
	NormalizedVaultPath,
	StagedChangeRecord,
	ValidationIssue,
} from "../types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../types/vault";
import { HOT_CACHE_SUPPORT_PATH, normalizeVaultPath } from "../utils/vault-paths";
import { validateHotCacheState } from "../utils/vault-validation";
import { StagedChangeService } from "./staged-change-service";

const activeStagedStatuses = new Set(["proposed", "review-ready", "conflicted", "approved"]);

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const issue = (
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

const safeIdSegment = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 80);

const truncate = (value: string, maxLength: number): string => {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const redactString = (value: string, maxLength: number): string => {
	const redacted = redactDiagnostic(value);
	if (redacted.ok && typeof redacted.value === "string") {
		return truncate(redacted.value, maxLength);
	}

	return truncate(value, maxLength);
};

const limitedUniquePaths = (paths: readonly (NormalizedVaultPath | string | undefined | null)[]) => {
	const normalizedPaths: NormalizedVaultPath[] = [];
	for (const path of paths) {
		if (path === undefined || path === null) {
			continue;
		}
		const normalized = normalizeVaultPath(path);
		if (normalized.ok) {
			normalizedPaths.push(normalized.value);
		}
	}

	return [...new Set(normalizedPaths)].sort((left, right) => left.localeCompare(right)).slice(0, HOT_CACHE_MAX_PATHS);
};

const pathFromDiagnostic = (diagnostic: IndexingPathDiagnostic): NormalizedVaultPath | null => {
	const normalized = normalizeVaultPath(diagnostic.path);
	return normalized.ok ? normalized.value : null;
};

const metadataValue = (value: HotCacheMetadataValue): HotCacheMetadataValue => {
	if (typeof value === "string") {
		return redactString(value, HOT_CACHE_MAX_METADATA_STRING_LENGTH);
	}

	if (Array.isArray(value)) {
		return value.map(
			(item): HotCacheMetadataPrimitive =>
				typeof item === "string" ? redactString(item, HOT_CACHE_MAX_METADATA_STRING_LENGTH) : item,
		);
	}

	return value;
};

const metadata = (input: Record<string, HotCacheMetadataValue>): HotCacheMetadata =>
	Object.fromEntries(Object.entries(input).map(([key, value]) => [key, metadataValue(value)]));

const recovery = (
	cachePath: NormalizedVaultPath,
	commandId: string,
	input: Partial<Omit<HotCacheRecoveryReference, "cachePath" | "commandId" | "validationOutput">> & {
		readonly validationOutput?: readonly ValidationIssue[];
	} = {},
): HotCacheRecoveryReference => ({
	commandId,
	cachePath,
	...(input.targetPath === undefined ? {} : { targetPath: input.targetPath }),
	...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
	...(input.reportId === undefined ? {} : { reportId: input.reportId }),
	validationOutput: input.validationOutput ?? [],
});

const entry = (input: {
	readonly key: string;
	readonly kind: HotCacheEntryKind;
	readonly cachePath: NormalizedVaultPath;
	readonly commandId: string;
	readonly lastAccessedAt: IsoTimestamp;
	readonly summary: string;
	readonly sourcePaths?: readonly (NormalizedVaultPath | string | undefined | null)[];
	readonly path?: NormalizedVaultPath | string | null;
	readonly metadata?: Record<string, HotCacheMetadataValue>;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
	readonly validationOutput?: readonly ValidationIssue[];
}): HotCacheEntry => {
	const normalizedPath = input.path === undefined || input.path === null ? null : normalizeVaultPath(input.path);
	const path = normalizedPath?.ok === true ? normalizedPath.value : undefined;

	return {
		key: safeIdSegment(input.key) || input.kind,
		kind: input.kind,
		...(path === undefined ? {} : { path }),
		sourcePaths: limitedUniquePaths(input.sourcePaths ?? []),
		lastAccessedAt: input.lastAccessedAt,
		summary: redactString(input.summary, HOT_CACHE_MAX_SUMMARY_LENGTH),
		metadata: metadata(input.metadata ?? {}),
		recovery: recovery(input.cachePath, input.commandId, {
			...(path === undefined ? {} : { targetPath: path }),
			...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
			...(input.reportId === undefined ? {} : { reportId: input.reportId }),
			validationOutput: input.validationOutput ?? [],
		}),
	};
};

const compareEntries = (left: HotCacheEntry, right: HotCacheEntry): number =>
	`${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`, "en", { sensitivity: "base" });

const activeStagedChanges = (records: readonly StagedChangeRecord[]): readonly StagedChangeRecord[] =>
	records.filter((record) => activeStagedStatuses.has(record.status));

const sourcePathsForThread = (thread: HotCacheCaptureInput["chatThread"]): readonly NormalizedVaultPath[] => {
	if (thread === undefined || thread === null) {
		return [];
	}

	return limitedUniquePaths([
		...thread.draft.contextChips.map((chip) => chip.path),
		...thread.turns.flatMap((turn) => [
			...turn.contextChips.map((chip) => chip.path),
			...turn.citations.flatMap((citation) => citation.sourcePaths),
		]),
	]);
};

const chatThreadEntries = (
	input: HotCacheCaptureInput,
	cachePath: NormalizedVaultPath,
	now: IsoTimestamp,
): readonly HotCacheEntry[] => {
	const thread = input.chatThread ?? null;
	if (thread === null) {
		return [];
	}

	const selectedChips = input.selectedContextChips ?? thread.draft.contextChips;
	const sourcePaths = sourcePathsForThread(thread);
	const conversationPath = makeNormalizedVaultPath(`conversations/${safeIdSegment(thread.threadId)}.md`);
	const threadEntry = entry({
		key: thread.threadId,
		kind: "chat-thread",
		cachePath,
		commandId: "voidbrain.chat-with-vault",
		lastAccessedAt: now,
		path: conversationPath,
		sourcePaths,
		summary: `Thread ${thread.threadId} has ${thread.turns.length} bounded turn(s) and ${selectedChips.length} selected context chip(s).`,
		metadata: {
			threadId: thread.threadId,
			activeBranchId: thread.activeBranchId,
			draftPreview: thread.draft.text,
			turnCount: thread.turns.length,
			branchCount: thread.branches.length,
			lastTurnStatus: thread.turns.at(-1)?.status ?? "none",
			inFlightRecovered: thread.inFlightTurnId !== null,
		},
	});

	const chipEntries = selectedChips.map((chip) =>
		entry({
			key: chip.id,
			kind: "context-chip",
			cachePath,
			commandId: "voidbrain.chat-with-vault",
			lastAccessedAt: now,
			path: chip.path ?? null,
			sourcePaths: chip.path === undefined ? [] : [chip.path],
			summary:
				chip.path === undefined
					? `Selected context chip ${chip.label}.`
					: `Selected context chip ${chip.label} for ${chip.path}.`,
			metadata: {
				chipId: chip.id,
				chipKind: chip.kind,
				label: chip.label,
				heading: chip.heading ?? null,
				sourceRecordId: chip.sourceRecordId ?? null,
			},
		}),
	);

	return [threadEntry, ...chipEntries];
};

const indexEntries = (
	reports: readonly IndexingRuntimeReport[] | undefined,
	cachePath: NormalizedVaultPath,
	now: IsoTimestamp,
): readonly HotCacheEntry[] =>
	(reports ?? []).map((report) => {
		const failedPaths = limitedUniquePaths(report.failedPaths.map(pathFromDiagnostic));
		const sourcePaths = limitedUniquePaths([
			...report.stalePaths,
			...report.missingPaths,
			...report.extraPaths,
			report.currentPath,
			...failedPaths,
		]);

		return entry({
			key: report.indexId,
			kind: "index-readiness",
			cachePath,
			commandId: HOT_CACHE_COMMAND_ID,
			lastAccessedAt: report.updatedAt ?? now,
			sourcePaths,
			summary: `Index ${report.indexId} is ${report.readinessState} with ${report.indexedNoteCount} of ${report.totalNoteCount} note(s) indexed.`,
			metadata: {
				indexId: report.indexId,
				status: report.status,
				readinessState: report.readinessState,
				indexedNoteCount: report.indexedNoteCount,
				totalNoteCount: report.totalNoteCount,
				failedPathCount: report.failedPaths.length,
				skippedPathCount: report.skippedPaths.length,
				message: report.message,
			},
		});
	});

const stagedChangeEntries = (
	records: readonly StagedChangeRecord[] | undefined,
	cachePath: NormalizedVaultPath,
	now: IsoTimestamp,
): readonly HotCacheEntry[] =>
	activeStagedChanges(records ?? []).map((record) =>
		entry({
			key: record.changeId,
			kind: "staged-change",
			cachePath,
			commandId: record.recovery.commandId,
			lastAccessedAt: record.updatedAt ?? now,
			path: record.targetPath,
			sourcePaths: record.sourcePaths,
			summary: `Staged change ${record.changeId} is ${record.status} for ${record.targetPath}.`,
			metadata: {
				changeId: record.changeId,
				operationKind: record.operationKind,
				status: record.status,
				targetPath: record.targetPath,
				conflictCount: record.conflicts.length,
				destructive: record.review.destructive,
			},
			stagedChangeId: record.changeId,
			validationOutput: record.recovery.validationOutput,
		}),
	);

const healthReportEntry = (
	report: HotCacheCaptureInput["healthReport"],
	cachePath: NormalizedVaultPath,
	now: IsoTimestamp,
): readonly HotCacheEntry[] => {
	if (report === undefined || report === null) {
		return [];
	}

	const affectedPaths = limitedUniquePaths(report.findings.flatMap((finding) => finding.affectedPaths));
	const sourcePaths = affectedPaths.length === 0 ? limitedUniquePaths(report.scannedPaths) : affectedPaths;

	return [
		entry({
			key: report.reportId,
			kind: "health-report",
			cachePath,
			commandId: "voidbrain.health-check",
			lastAccessedAt: report.generatedAt ?? now,
			sourcePaths,
			summary: `Health report ${report.reportId} scanned ${report.scannedPaths.length} path(s) with ${report.summary.totalFindings} finding(s).`,
			metadata: {
				reportId: report.reportId,
				scannedPathCount: report.scannedPaths.length,
				totalFindings: report.summary.totalFindings,
				errorCount: report.summary.errorCount,
				warningCount: report.summary.warningCount,
				infoCount: report.summary.infoCount,
			},
			reportId: report.reportId,
		}),
	];
};

const sourceIngestionQueueEntries = (
	summaries: readonly SourceIngestionQueueSummary[] | undefined,
	cachePath: NormalizedVaultPath,
	now: IsoTimestamp,
): readonly HotCacheEntry[] =>
	(summaries ?? []).map((summary) =>
		entry({
			key: summary.queueId,
			kind: "source-ingestion-queue",
			cachePath,
			commandId: "voidbrain.ingest-source",
			lastAccessedAt: summary.updatedAt ?? now,
			path: summary.targetPaths[0] ?? null,
			sourcePaths: summary.sourcePaths,
			summary: `Source ingestion queue ${summary.queueId} is ${summary.status} with ${summary.counts.staged} staged, ${summary.counts.failed} failed, and ${summary.counts.canceled} canceled item(s).`,
			metadata: {
				queueId: summary.queueId,
				status: summary.status,
				itemCount: summary.counts.total,
				stagedCount: summary.counts.staged,
				failedCount: summary.counts.failed,
				canceledCount: summary.counts.canceled,
				skippedCount: summary.counts.skipped,
				retryableCount: summary.counts.retryable,
				providerBlockedCount: summary.counts.providerBlocked,
				citationBlockedCount: summary.counts.citationBlocked,
				itemIds: summary.items.map((item) => item.itemId).slice(0, HOT_CACHE_MAX_PATHS),
				itemStatuses: summary.items
					.map((item) => `${item.itemId}:${item.status}`)
					.slice(0, HOT_CACHE_MAX_PATHS),
				stagedChangeIds: summary.stagedChangeIds.slice(0, HOT_CACHE_MAX_PATHS),
			},
			validationOutput: summary.validationOutput,
		}),
	);

const validationFailure = (
	cachePath: NormalizedVaultPath,
	errors: readonly ValidationIssue[],
): HotCacheCaptureResult => ({
	ok: false,
	errors,
	recovery: recovery(cachePath, HOT_CACHE_COMMAND_ID, { validationOutput: errors }),
});

const valueAsString = (value: HotCacheMetadataValue | undefined): string | null =>
	typeof value === "string" && value.trim().length > 0 ? value : null;

const contextChipKind = (value: string | null): ChatContextChipKind => {
	switch (value) {
		case "active-file":
		case "selected-path":
		case "retrieval-filter":
		case "manual":
			return value;
		default:
			return "manual";
	}
};

const restoreContextChips = (state: HotCacheState): readonly ChatContextChip[] =>
	state.entries
		.filter((candidate) => candidate.kind === "context-chip")
		.map((candidate): ChatContextChip => {
			const id = valueAsString(candidate.metadata.chipId) ?? candidate.key;
			const label = valueAsString(candidate.metadata.label) ?? candidate.summary;
			const heading = valueAsString(candidate.metadata.heading);
			const sourceRecordId = valueAsString(candidate.metadata.sourceRecordId);

			return {
				id: makeChatContextChipId(id),
				kind: contextChipKind(valueAsString(candidate.metadata.chipKind)),
				label,
				...(candidate.path === undefined ? {} : { path: candidate.path }),
				...(heading === null ? {} : { heading }),
				...(sourceRecordId === null ? {} : { sourceRecordId }),
			};
		});

const restoreChatThread = (
	state: HotCacheState,
	contextChips: readonly ChatContextChip[],
	now: IsoTimestamp,
): PersistedChatThreadState | null => {
	const threadEntry = state.entries.find((candidate) => candidate.kind === "chat-thread");
	if (threadEntry === undefined) {
		return null;
	}

	const threadId = valueAsString(threadEntry.metadata.threadId) ?? threadEntry.key;
	const activeBranchId = valueAsString(threadEntry.metadata.activeBranchId) ?? "branch-main";
	const draftPreview = valueAsString(threadEntry.metadata.draftPreview) ?? "";

	return {
		schemaVersion: 1,
		threadId: makeChatThreadId(threadId),
		activeBranchId: makeChatBranchId(activeBranchId),
		draft: {
			text: draftPreview,
			contextChips,
			updatedAt: threadEntry.lastAccessedAt,
		},
		turns: [],
		branches: [
			{
				branchId: makeChatBranchId(activeBranchId),
				parentBranchId: null,
				sourceTurnId: null,
				label: "Recovered",
				createdAt: threadEntry.lastAccessedAt,
			},
		],
		inFlightTurnId: null,
		lastFailure: null,
		createdAt: threadEntry.lastAccessedAt,
		updatedAt: now,
	};
};

const markdownList = (items: readonly string[]): readonly string[] =>
	items.length === 0 ? ["- None recorded."] : items.map((item) => `- ${item}`);

const sourcePathsForSummary = (input: HotCacheSessionSummaryInput): readonly NormalizedVaultPath[] =>
	limitedUniquePaths([
		...input.chatThread.draft.contextChips.map((chip) => chip.path),
		...input.chatThread.turns.flatMap((turn) => [
			...turn.contextChips.map((chip) => chip.path),
			...turn.citations.flatMap((citation) => citation.sourcePaths),
		]),
	]);

const renderSessionSummaryMarkdown = (
	input: HotCacheSessionSummaryInput,
	targetPath: NormalizedVaultPath,
	now: IsoTimestamp,
	sourcePaths: readonly NormalizedVaultPath[],
): string => {
	const title = input.title ?? "Voidbrain Session Summary";
	const turns = input.chatThread.turns.slice(-6);
	const sourcePathList = sourcePaths.map((path) => `\`${path}\``);
	const turnLines = turns.flatMap((turn, index) => [
		`### Turn ${index + 1} - ${turn.status}`,
		"",
		`Question: ${redactString(turn.question, HOT_CACHE_MAX_SUMMARY_LENGTH)}`,
		...(turn.answer === null ? [] : [`Answer: ${redactString(turn.answer, HOT_CACHE_MAX_SUMMARY_LENGTH)}`]),
		`Citations: ${turn.citations.map((citation) => `${citation.label} ${citation.vaultPath}`).join(", ") || "none"}`,
		"",
	]);

	return [
		"---",
		`voidbrain-id: session-summary-${safeIdSegment(input.chatThread.threadId)}`,
		"artifact-kind: conversation",
		`created-at: ${now}`,
		`updated-at: ${now}`,
		`source-paths: [${sourcePaths.join(", ")}]`,
		"tags: [voidbrain, conversation-summary]",
		`title: ${title}`,
		`thread-id: ${input.chatThread.threadId}`,
		`message-count: ${input.chatThread.turns.length}`,
		"participants: [user, assistant]",
		"---",
		"",
		`# ${title}`,
		"",
		"## Source Paths",
		"",
		...markdownList(sourcePathList),
		"",
		"## Recovery",
		"",
		`- Command ID: \`${HOT_CACHE_SESSION_SUMMARY_COMMAND_ID}\``,
		`- Target path: \`${targetPath}\``,
		`- Thread ID: \`${input.chatThread.threadId}\``,
		"",
		"## Recent Turns",
		"",
		...(turnLines.length === 0 ? ["No completed turns were available for summary staging.", ""] : turnLines),
	].join("\n");
};

export class HotCacheService {
	private summaryInFlight = false;

	public capture(input: HotCacheCaptureInput = {}): HotCacheCaptureResult {
		const now = toIsoTimestamp(input.now ?? new Date());
		const cachePath = input.cachePath ?? HOT_CACHE_SUPPORT_PATH;
		const entryLimit = input.entryLimit ?? HOT_CACHE_DEFAULT_ENTRY_LIMIT;
		const preflightErrors =
			entryLimit < 1
				? [issue("metadata.invalid-type", "entryLimit must be greater than zero.", "entryLimit")]
				: [];
		if (preflightErrors.length > 0) {
			return validationFailure(cachePath, preflightErrors);
		}

		const entries = [
			...chatThreadEntries(input, cachePath, now),
			...indexEntries(input.indexReports, cachePath, now),
			...stagedChangeEntries(input.stagedChanges, cachePath, now),
			...healthReportEntry(input.healthReport, cachePath, now),
			...sourceIngestionQueueEntries(input.sourceIngestionQueues, cachePath, now),
			...(input.priorEntries ?? []),
		]
			.sort(compareEntries)
			.slice(0, entryLimit);
		const state: HotCacheState = {
			artifactKind: "hot-cache",
			schemaVersion: 1,
			cacheId: input.cacheId ?? `hot-cache-${now.replaceAll(/[^0-9]/g, "").slice(0, 14)}`,
			cachePath,
			updatedAt: now,
			entryLimit,
			redaction: {
				redacted: true,
				redactedFieldCount: 0,
				omittedBodyCount: entries.length,
				notes: ["Raw note bodies, provider secrets, auth diagnostics, and hidden provider state are omitted."],
			},
			entries,
			recovery: recovery(cachePath, HOT_CACHE_COMMAND_ID),
		};
		const validation = validateHotCacheState(state);
		if (!validation.ok) {
			return validationFailure(cachePath, validation.errors);
		}

		return {
			ok: true,
			state: validation.value,
			recovery: recovery(cachePath, HOT_CACHE_COMMAND_ID),
		};
	}

	public restore(input: HotCacheRestoreInput): HotCacheRestoreResult {
		const recoveredAt = toIsoTimestamp(input.now ?? new Date());
		const cachePath = input.cachePath ?? HOT_CACHE_SUPPORT_PATH;
		const validation = validateHotCacheState(input.value);
		if (!validation.ok) {
			return {
				ok: false,
				errors: validation.errors,
				recoveredAt,
				recovery: recovery(cachePath, HOT_CACHE_COMMAND_ID, { validationOutput: validation.errors }),
			};
		}

		const contextChips = restoreContextChips(validation.value);
		return {
			ok: true,
			state: validation.value,
			chatThread: restoreChatThread(validation.value, contextChips, recoveredAt),
			contextChips,
			recoveredAt,
			recovery: recovery(cachePath, HOT_CACHE_COMMAND_ID),
		};
	}

	public async stageSessionSummary(input: HotCacheSessionSummaryInput): Promise<HotCacheSessionSummaryResult> {
		const now = toIsoTimestamp(input.now ?? new Date());
		const targetPath =
			input.targetPath ?? makeNormalizedVaultPath(`conversations/${now.slice(0, 10)}-session-summary.md`);
		const sourcePaths = sourcePathsForSummary(input);
		const sourcePathErrors =
			sourcePaths.length === 0
				? [
						issue(
							"metadata.missing-source-trace",
							"Session summaries require at least one source path.",
							"sourcePaths",
							targetPath,
						),
					]
				: [];

		if (this.summaryInFlight) {
			const errors = [
				issue(
					"record.invalid-operation",
					"A session summary is already being staged.",
					"targetPath",
					targetPath,
				),
			];
			return {
				ok: false,
				errors,
				recovery: recovery(HOT_CACHE_SUPPORT_PATH, HOT_CACHE_SESSION_SUMMARY_COMMAND_ID, {
					targetPath,
					validationOutput: errors,
				}),
			};
		}

		if (sourcePathErrors.length > 0) {
			return {
				ok: false,
				errors: sourcePathErrors,
				recovery: recovery(HOT_CACHE_SUPPORT_PATH, HOT_CACHE_SESSION_SUMMARY_COMMAND_ID, {
					targetPath,
					validationOutput: sourcePathErrors,
				}),
			};
		}

		this.summaryInFlight = true;
		try {
			const markdown = renderSessionSummaryMarkdown(input, targetPath, now, sourcePaths);
			const stageResult = await new StagedChangeService({
				now: () => input.now ?? new Date(),
			}).stageCreateNote({
				commandId: HOT_CACHE_SESSION_SUMMARY_COMMAND_ID,
				targetPath,
				sourcePaths,
				rationale: "Stage a readable Voidbrain conversation summary for review.",
				afterContent: markdown,
				existingNotes: input.existingNotes ?? [],
				existingStagedChanges: input.existingStagedChanges ?? [],
				validationOutput: [],
			});
			if (!stageResult.ok) {
				return {
					ok: false,
					errors: stageResult.errors,
					recovery: recovery(HOT_CACHE_SUPPORT_PATH, HOT_CACHE_SESSION_SUMMARY_COMMAND_ID, {
						targetPath,
						validationOutput: stageResult.errors,
					}),
				};
			}

			return {
				ok: true,
				markdown,
				stagedChange: stageResult.value,
				targetPath,
				recovery: recovery(HOT_CACHE_SUPPORT_PATH, HOT_CACHE_SESSION_SUMMARY_COMMAND_ID, {
					targetPath,
					stagedChangeId: stageResult.value.changeId,
					validationOutput: stageResult.value.recovery.validationOutput,
				}),
			};
		} finally {
			this.summaryInFlight = false;
		}
	}
}

export const createHotCacheService = (): HotCacheService => new HotCacheService();

export const captureHotCacheState = (input: HotCacheCaptureInput = {}): HotCacheCaptureResult =>
	new HotCacheService().capture(input);

export const restoreHotCacheState = (input: HotCacheRestoreInput): HotCacheRestoreResult =>
	new HotCacheService().restore(input);
