import { preflightProviderSetup } from "../providers/provider-preflight";
import {
	INGEST_SOURCE_COMMAND_ID,
	type SourceIngestionIntakeRequest,
	type SourceIngestionPreview,
	type SourceIngestionProviderDecisionRecord,
	type SourceIngestionStageResult,
} from "../types/ingestion";
import {
	SOURCE_INGESTION_QUEUE_DEFAULT_CONCURRENCY,
	SOURCE_INGESTION_QUEUE_MAX_CONCURRENCY,
	type SourceIngestionQueueCancelResult,
	type SourceIngestionQueueFailureCode,
	type SourceIngestionQueueItemRecoveryRecord,
	type SourceIngestionQueueItemStatus,
	type SourceIngestionQueueItemSummary,
	type SourceIngestionQueueRecoveryRecord,
	type SourceIngestionQueueRetryInput,
	type SourceIngestionQueueRunInput,
	type SourceIngestionQueueRunResult,
	type SourceIngestionQueueStatus,
	type SourceIngestionQueueSummary,
	type SourceIngestionQueueSummaryCounts,
} from "../types/ingestion-queue";
import type { VoidbrainPluginSettings } from "../types/plugin";
import type { ProviderSetupPreflightDecision } from "../types/provider-setup";
import type { ProviderDefinition } from "../types/providers";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";
import { SourceIngestionIntakeService } from "./source-ingestion-intake-service";
import { SourceIngestionStagingService } from "./source-ingestion-staging-service";

export type SourceIngestionQueueStageSource = (
	request: SourceIngestionIntakeRequest,
) => Promise<SourceIngestionStageResult>;

export interface SourceIngestionQueueServiceOptions {
	readonly intakeService?: SourceIngestionIntakeService;
	readonly stagingService?: SourceIngestionStagingService;
	readonly stageSource?: SourceIngestionQueueStageSource;
	readonly getSettings?: () => VoidbrainPluginSettings;
	readonly baselineProviders?: readonly ProviderDefinition[];
	readonly providerPreflight?: (preview: SourceIngestionPreview) => ProviderSetupPreflightDecision;
	readonly now?: () => Date;
}

interface ActiveQueueState {
	cancelRequested: boolean;
	readonly controllers: Map<string, AbortController>;
	cancelQueued: () => readonly string[];
}

interface PreparedQueueItem {
	readonly request: SourceIngestionIntakeRequest;
	readonly summary: SourceIngestionQueueItemSummary;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const safeIdSegment = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 80);

const sortedUnique = <TValue extends string>(values: readonly TValue[]): readonly TValue[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

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

const targetPathsFromPreview = (preview: SourceIngestionPreview): readonly NormalizedVaultPath[] => [
	preview.targetPaths.source,
	...preview.targetPaths.entities,
	...preview.targetPaths.concepts,
	preview.targetPaths.summary,
];

const requestIdentity = (request: SourceIngestionIntakeRequest, index: number): string => {
	switch (request.input.kind) {
		case "markdown-file":
		case "text-file":
			return request.input.path;
		case "pasted-content":
			return request.input.sourcePath ?? request.input.title;
		case "url-record":
			return request.input.sourcePath ?? request.input.sourceUrl;
		default: {
			const exhaustive: never = request.input;
			return `item-${index}-${String(exhaustive)}`;
		}
	}
};

const createQueueId = (now: Date, explicitQueueId: string | undefined): string => {
	if (explicitQueueId !== undefined && explicitQueueId.trim().length > 0) {
		return safeIdSegment(explicitQueueId) || "source-ingestion-queue";
	}

	return `source-ingestion-queue-${now
		.toISOString()
		.replaceAll(/[^0-9]/g, "")
		.slice(0, 14)}`;
};

const normalizeConcurrency = (value: number | undefined): number =>
	Math.max(
		1,
		Math.min(
			SOURCE_INGESTION_QUEUE_MAX_CONCURRENCY,
			Math.trunc(value ?? SOURCE_INGESTION_QUEUE_DEFAULT_CONCURRENCY),
		),
	);

const notRequestedDecision = (): SourceIngestionProviderDecisionRecord => ({
	kind: "not-requested",
	allowed: false,
	providerId: null,
	modelId: null,
	code: null,
	userMessage: "Provider-assisted extraction was not requested.",
	attempts: [],
	diagnostic: {
		mode: "none",
	},
});

const decisionFromPreflight = (decision: ProviderSetupPreflightDecision): SourceIngestionProviderDecisionRecord => {
	if (decision.allowed) {
		return {
			kind: "allowed",
			allowed: true,
			providerId: decision.provider.id,
			modelId: decision.modelId,
			code: null,
			userMessage: "Provider preflight allowed optional source ingestion assistance.",
			attempts: [],
			diagnostic: decision.diagnostic,
		};
	}

	return {
		kind: "denied",
		allowed: false,
		providerId: null,
		modelId: null,
		code: decision.code,
		userMessage: decision.userMessage,
		attempts: [],
		diagnostic: decision.diagnostic,
	};
};

const defaultProviderPreflight = (
	preview: SourceIngestionPreview,
	getSettings: (() => VoidbrainPluginSettings) | undefined,
	baselineProviders: readonly ProviderDefinition[] | undefined,
): ProviderSetupPreflightDecision => {
	if (getSettings === undefined) {
		return {
			allowed: false,
			code: "role-not-selected",
			userMessage: "Provider role is not selected.",
			diagnosticReason: "No plugin settings were available for batch source ingestion preflight.",
			diagnostic: {
				workflowId: INGEST_SOURCE_COMMAND_ID,
				queue: true,
			},
		};
	}

	return preflightProviderSetup(
		{
			settings: getSettings(),
			...(baselineProviders === undefined ? {} : { baselineProviders }),
		},
		{
			role: preview.extractionPlan.providerRequirement.role,
			requiredCapability: preview.extractionPlan.providerRequirement.requiredCapability,
			contentSensitivity: preview.contentSensitivity,
			sourcePaths: [preview.sourcePath],
			workflowId: INGEST_SOURCE_COMMAND_ID,
			userFacingPurpose: preview.extractionPlan.providerRequirement.purpose,
		},
	);
};

const itemIdForPreview = (queueId: string, index: number, preview: SourceIngestionPreview): string =>
	`${queueId}-item-${String(index + 1).padStart(2, "0")}-${safeIdSegment(preview.sourcePath).slice(0, 48)}-${preview.contentSha256.slice(0, 12)}`;

const itemIdForRequest = (queueId: string, index: number, request: SourceIngestionIntakeRequest): string =>
	`${queueId}-item-${String(index + 1).padStart(2, "0")}-${safeIdSegment(requestIdentity(request, index)).slice(0, 48) || "invalid"}`;

const retryGuidanceForStatus = (status: SourceIngestionQueueItemStatus): string => {
	switch (status) {
		case "queued":
		case "running":
			return "Wait for the queue to finish or cancel it before retrying this item.";
		case "staged":
			return "Review staged-change IDs before applying or discarding generated notes.";
		case "failed":
			return "Inspect validation output, then retry or discard this item.";
		case "canceled":
			return "Retry this item when the queue is idle, or discard it.";
		case "skipped":
			return "Resolve duplicate source or target-path diagnostics before retrying.";
		default: {
			const exhaustive: never = status;
			return `Unhandled queue item status: ${String(exhaustive)}`;
		}
	}
};

const itemRecovery = (input: {
	readonly queueId: string;
	readonly itemId: string;
	readonly status: SourceIngestionQueueItemStatus;
	readonly sourcePath?: NormalizedVaultPath;
	readonly contentSha256?: string;
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly cachePath?: NormalizedVaultPath;
	readonly stagedChangeIds: readonly string[];
	readonly providerDecision?: SourceIngestionProviderDecisionRecord;
	readonly validationOutput: readonly ValidationIssue[];
	readonly updatedAt: IsoTimestamp;
}): SourceIngestionQueueItemRecoveryRecord => ({
	commandId: INGEST_SOURCE_COMMAND_ID,
	queueId: input.queueId,
	itemId: input.itemId,
	...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
	...(input.contentSha256 === undefined ? {} : { contentSha256: input.contentSha256 }),
	targetPaths: input.targetPaths,
	...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
	stagedChangeIds: input.stagedChangeIds,
	...(input.providerDecision === undefined ? {} : { providerDecision: input.providerDecision }),
	validationOutput: input.validationOutput,
	retryGuidance: retryGuidanceForStatus(input.status),
	updatedAt: input.updatedAt,
});

const createItemSummary = (input: {
	readonly queueId: string;
	readonly itemId: string;
	readonly index: number;
	readonly status: SourceIngestionQueueItemStatus;
	readonly retryCount: number;
	readonly updatedAt: IsoTimestamp;
	readonly cachePath?: NormalizedVaultPath;
	readonly preview?: SourceIngestionPreview;
	readonly targetPaths?: readonly NormalizedVaultPath[];
	readonly stagedChangeIds?: readonly string[];
	readonly providerDecision?: SourceIngestionProviderDecisionRecord;
	readonly validationOutput?: readonly ValidationIssue[];
	readonly retryable?: boolean;
	readonly failureCode?: SourceIngestionQueueFailureCode;
	readonly message?: string;
	readonly startedAt?: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
}): SourceIngestionQueueItemSummary => {
	const targetPaths = input.targetPaths ?? (input.preview === undefined ? [] : targetPathsFromPreview(input.preview));
	const stagedChangeIds = input.stagedChangeIds ?? [];
	const validationOutput = input.validationOutput ?? [];
	const citationState =
		input.status === "staged"
			? "valid"
			: input.failureCode === "ingestion.citation-invalid"
				? "invalid"
				: "not-checked";
	const recovery = itemRecovery({
		queueId: input.queueId,
		itemId: input.itemId,
		status: input.status,
		...(input.preview === undefined ? {} : { sourcePath: input.preview.sourcePath }),
		...(input.preview === undefined ? {} : { contentSha256: input.preview.contentSha256 }),
		targetPaths,
		...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
		stagedChangeIds,
		...(input.providerDecision === undefined ? {} : { providerDecision: input.providerDecision }),
		validationOutput,
		updatedAt: input.updatedAt,
	});

	return {
		itemId: input.itemId,
		queueId: input.queueId,
		index: input.index,
		status: input.status,
		...(input.preview === undefined
			? {}
			: {
					sourceKind: input.preview.sourceKind,
					title: input.preview.title,
					sourcePath: input.preview.sourcePath,
					...(input.preview.sourceUrl === undefined ? {} : { sourceUrl: input.preview.sourceUrl }),
					contentSha256: input.preview.contentSha256,
					contentBytes: input.preview.contentBytes,
				}),
		targetPaths,
		citationState,
		stagedChangeIds,
		...(input.providerDecision === undefined ? {} : { providerDecision: input.providerDecision }),
		validationOutput,
		retryable: input.retryable ?? (input.status === "failed" || input.status === "canceled"),
		retryCount: input.retryCount,
		...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
		...(input.message === undefined ? {} : { message: input.message }),
		...(input.startedAt === undefined ? {} : { startedAt: input.startedAt }),
		...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
		recovery,
	};
};

const countItems = (items: readonly SourceIngestionQueueItemSummary[]): SourceIngestionQueueSummaryCounts => ({
	total: items.length,
	queued: items.filter((item) => item.status === "queued").length,
	running: items.filter((item) => item.status === "running").length,
	staged: items.filter((item) => item.status === "staged").length,
	failed: items.filter((item) => item.status === "failed").length,
	canceled: items.filter((item) => item.status === "canceled").length,
	skipped: items.filter((item) => item.status === "skipped").length,
	retryable: items.filter((item) => item.retryable).length,
	providerBlocked: items.filter(
		(item) => item.failureCode === "ingestion.provider-denied" || item.providerDecision?.kind === "denied",
	).length,
	citationBlocked: items.filter(
		(item) => item.failureCode === "ingestion.citation-invalid" || item.citationState === "invalid",
	).length,
});

const statusFromCounts = (
	counts: SourceIngestionQueueSummaryCounts,
	cancelRequested: boolean,
): SourceIngestionQueueStatus => {
	if (cancelRequested && (counts.queued > 0 || counts.running > 0)) {
		return "canceling";
	}
	if (counts.queued > 0 || counts.running > 0) {
		return "running";
	}
	if (counts.total > 0 && counts.canceled === counts.total) {
		return "canceled";
	}
	if (counts.failed > 0) {
		return "failed";
	}
	if (counts.canceled > 0) {
		return "canceled";
	}
	return "completed";
};

const queueRecovery = (input: {
	readonly queueId: string;
	readonly cachePath?: NormalizedVaultPath;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly targetPaths: readonly NormalizedVaultPath[];
	readonly stagedChangeIds: readonly string[];
	readonly validationOutput: readonly ValidationIssue[];
	readonly updatedAt: IsoTimestamp;
}): SourceIngestionQueueRecoveryRecord => ({
	commandId: INGEST_SOURCE_COMMAND_ID,
	queueId: input.queueId,
	...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
	sourcePaths: input.sourcePaths,
	targetPaths: input.targetPaths,
	stagedChangeIds: input.stagedChangeIds,
	validationOutput: input.validationOutput,
	retryGuidance: "Retry failed or canceled queue items after reviewing validation output.",
	updatedAt: input.updatedAt,
});

const buildSummary = (input: {
	readonly queueId: string;
	readonly concurrency: number;
	readonly startedAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly cachePath?: NormalizedVaultPath;
	readonly items: readonly SourceIngestionQueueItemSummary[];
	readonly cancelRequested: boolean;
}): SourceIngestionQueueSummary => {
	const sortedItems = [...input.items].sort((left, right) => left.index - right.index);
	const counts = countItems(sortedItems);
	const sourcePaths = sortedUnique(
		sortedItems.flatMap((item) => (item.sourcePath === undefined ? [] : [item.sourcePath])),
	);
	const targetPaths = sortedUnique(sortedItems.flatMap((item) => item.targetPaths));
	const stagedChangeIds = sortedUnique(sortedItems.flatMap((item) => item.stagedChangeIds));
	const validationOutput = sortedItems.flatMap((item) => item.validationOutput);
	const status = statusFromCounts(counts, input.cancelRequested);

	return {
		commandId: INGEST_SOURCE_COMMAND_ID,
		queueId: input.queueId,
		status,
		concurrency: input.concurrency,
		startedAt: input.startedAt,
		updatedAt: input.updatedAt,
		...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
		counts,
		items: sortedItems,
		sourcePaths,
		targetPaths,
		stagedChangeIds,
		validationOutput,
		recovery: queueRecovery({
			queueId: input.queueId,
			...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
			sourcePaths,
			targetPaths,
			stagedChangeIds,
			validationOutput,
			updatedAt: input.updatedAt,
		}),
	};
};

const mergeRequestContext = (
	request: SourceIngestionIntakeRequest,
	input: SourceIngestionQueueRunInput,
): SourceIngestionIntakeRequest => ({
	...request,
	...(request.existingNotes !== undefined
		? { existingNotes: request.existingNotes }
		: input.existingNotes === undefined
			? {}
			: { existingNotes: input.existingNotes }),
	existingStagedChanges: [...(input.existingStagedChanges ?? []), ...(request.existingStagedChanges ?? [])],
});

export class SourceIngestionQueueService {
	private readonly intakeService: SourceIngestionIntakeService;
	private readonly stagingService: SourceIngestionStagingService;
	private readonly now: () => Date;
	private readonly activeQueues = new Map<string, ActiveQueueState>();

	public constructor(private readonly options: SourceIngestionQueueServiceOptions = {}) {
		this.now = options.now ?? (() => new Date());
		const serviceTimeOptions = options.now === undefined ? {} : { now: options.now };
		this.intakeService = options.intakeService ?? new SourceIngestionIntakeService(serviceTimeOptions);
		this.stagingService = options.stagingService ?? new SourceIngestionStagingService(serviceTimeOptions);
	}

	public async runQueue(input: SourceIngestionQueueRunInput): Promise<SourceIngestionQueueRunResult> {
		const startedAt = toIsoTimestamp(this.now());
		const queueId = createQueueId(this.now(), input.queueId);
		const concurrency = normalizeConcurrency(input.concurrency);
		if (this.activeQueues.has(queueId)) {
			return {
				summary: this.failedQueueSummary({
					queueId,
					concurrency,
					startedAt,
					...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
					validationOutput: [
						issue(
							"record.invalid-operation",
							`Source ingestion queue ${queueId} is already running.`,
							"queueId",
						),
					],
				}),
				stagedChanges: [],
			};
		}

		const active: ActiveQueueState = {
			cancelRequested: false,
			controllers: new Map(),
			cancelQueued: () => [],
		};
		this.activeQueues.set(queueId, active);

		try {
			const prepared = await this.prepareItems(input, queueId, startedAt);
			const summaries = prepared.map((item) => item.summary);
			const stagedChanges: StagedChangeRecord[] = [];
			active.cancelQueued = () => {
				const canceledIds: string[] = [];
				for (const [index, summary] of summaries.entries()) {
					if (summary.status !== "queued") {
						continue;
					}
					canceledIds.push(summary.itemId);
					summaries[index] = this.updateItemSummary(summary, {
						status: "canceled",
						failureCode: "ingestion.queue-canceled",
						message: "Source ingestion queue was canceled before this item started.",
						completedAt: toIsoTimestamp(this.now()),
					});
				}
				this.emit(input, queueId, concurrency, startedAt, summaries, active.cancelRequested, input.cachePath);
				return canceledIds;
			};
			this.emit(input, queueId, concurrency, startedAt, summaries, active.cancelRequested, input.cachePath);

			const runnable = prepared.filter((item) => item.summary.status === "queued");
			let nextIndex = 0;
			const workerCount = Math.min(concurrency, runnable.length);
			const runWorker = async (): Promise<void> => {
				while (true) {
					const item = runnable[nextIndex];
					nextIndex += 1;
					if (item === undefined) {
						return;
					}
					if (active.cancelRequested) {
						this.replaceSummary(summaries, item.summary.itemId, {
							status: "canceled",
							failureCode: "ingestion.queue-canceled",
							message: "Source ingestion queue was canceled before this item started.",
							completedAt: toIsoTimestamp(this.now()),
						});
						this.emit(input, queueId, concurrency, startedAt, summaries, true, input.cachePath);
						continue;
					}

					await this.runItem({
						item,
						input,
						queueId,
						concurrency,
						startedAt,
						summaries,
						stagedChanges,
						active,
					});
				}
			};

			await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
			const completedAt = toIsoTimestamp(this.now());
			const summary = buildSummary({
				queueId,
				concurrency,
				startedAt,
				updatedAt: completedAt,
				completedAt,
				...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
				items: summaries,
				cancelRequested: false,
			});
			input.onUpdate?.(summary);
			return {
				summary,
				stagedChanges,
			};
		} finally {
			const running = this.activeQueues.get(queueId);
			if (running !== undefined) {
				for (const controller of running.controllers.values()) {
					controller.abort();
				}
			}
			this.activeQueues.delete(queueId);
		}
	}

	public cancelQueue(queueId: string): SourceIngestionQueueCancelResult {
		const active = this.activeQueues.get(queueId);
		if (active === undefined) {
			return {
				ok: false,
				queueId,
				canceledItemIds: [],
				runningItemIds: [],
				message: `Source ingestion queue ${queueId} is not running.`,
			};
		}

		active.cancelRequested = true;
		for (const controller of active.controllers.values()) {
			controller.abort();
		}
		const canceledItemIds = active.cancelQueued();
		return {
			ok: true,
			queueId,
			canceledItemIds,
			runningItemIds: [...active.controllers.keys()].sort((left, right) => left.localeCompare(right)),
			message: `Source ingestion queue ${queueId} cancellation was requested.`,
		};
	}

	public retryItems(input: SourceIngestionQueueRetryInput): Promise<SourceIngestionQueueRunResult> {
		const sourceQueueId = input.sourceQueueId ?? input.queueId ?? "source-ingestion-queue";
		return this.runQueue({
			...input,
			queueId:
				input.queueId ??
				`${safeIdSegment(sourceQueueId)}-retry-${this.now()
					.toISOString()
					.replaceAll(/[^0-9]/g, "")
					.slice(0, 14)}`,
			retryCount: 1,
		});
	}

	public dispose(): void {
		for (const queueId of this.activeQueues.keys()) {
			this.cancelQueue(queueId);
		}
		this.activeQueues.clear();
	}

	private async prepareItems(
		input: SourceIngestionQueueRunInput,
		queueId: string,
		startedAt: IsoTimestamp,
	): Promise<readonly PreparedQueueItem[]> {
		if (input.items.length === 0) {
			return [];
		}

		const seenSourcePaths = new Set<NormalizedVaultPath>();
		const seenContentHashes = new Set<string>();
		const seenTargetPaths = new Set<NormalizedVaultPath>();
		const prepared: PreparedQueueItem[] = [];
		for (const [index, rawRequest] of input.items.entries()) {
			const request = mergeRequestContext(rawRequest, input);
			const preview = await this.intakeService.createPreview(request);
			if (!preview.ok) {
				const itemId = itemIdForRequest(queueId, index, rawRequest);
				prepared.push({
					request,
					summary: createItemSummary({
						queueId,
						itemId,
						index,
						status: "failed",
						retryCount: input.retryCount ?? 0,
						updatedAt: startedAt,
						...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
						validationOutput: preview.errors,
						failureCode: "ingestion.input-invalid",
						message: "Source ingestion queue item failed input validation.",
						retryable: true,
						completedAt: startedAt,
					}),
				});
				continue;
			}

			const previewValue = preview.value;
			const itemId = itemIdForPreview(queueId, index, previewValue);
			const duplicate = this.queueDuplicateIssue(
				previewValue,
				seenSourcePaths,
				seenContentHashes,
				seenTargetPaths,
			);
			if (previewValue.duplicateStatus.isBlocking || duplicate !== null) {
				const duplicateIssue =
					duplicate ??
					issue(
						"record.invalid-state",
						previewValue.duplicateStatus.message,
						"duplicateStatus",
						previewValue.sourcePath,
					);
				prepared.push({
					request,
					summary: createItemSummary({
						queueId,
						itemId,
						index,
						status: "skipped",
						retryCount: input.retryCount ?? 0,
						updatedAt: startedAt,
						...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
						preview: previewValue,
						validationOutput: [duplicateIssue],
						failureCode: duplicate === null ? "ingestion.duplicate-source" : "ingestion.queue-duplicate",
						message: duplicateIssue.message,
						retryable: true,
						completedAt: startedAt,
					}),
				});
				continue;
			}

			for (const path of targetPathsFromPreview(previewValue)) {
				seenTargetPaths.add(path);
			}
			seenSourcePaths.add(previewValue.sourcePath);
			seenContentHashes.add(previewValue.contentSha256);

			const providerDecision = this.reviewProvider(previewValue);
			if (previewValue.extractionPlan.providerRequirement.mode !== "none" && providerDecision.kind === "denied") {
				const providerIssue = issue(
					"record.invalid-state",
					providerDecision.userMessage,
					"providerDecision",
					previewValue.sourcePath,
				);
				prepared.push({
					request,
					summary: createItemSummary({
						queueId,
						itemId,
						index,
						status: "failed",
						retryCount: input.retryCount ?? 0,
						updatedAt: startedAt,
						...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
						preview: previewValue,
						providerDecision,
						validationOutput: [providerIssue],
						failureCode: "ingestion.provider-denied",
						message: providerDecision.userMessage,
						retryable: true,
						completedAt: startedAt,
					}),
				});
				continue;
			}

			prepared.push({
				request,
				summary: createItemSummary({
					queueId,
					itemId,
					index,
					status: "queued",
					retryCount: input.retryCount ?? 0,
					updatedAt: startedAt,
					...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
					preview: previewValue,
					providerDecision,
					retryable: false,
				}),
			});
		}

		return prepared;
	}

	private async runItem(input: {
		readonly item: PreparedQueueItem;
		readonly input: SourceIngestionQueueRunInput;
		readonly queueId: string;
		readonly concurrency: number;
		readonly startedAt: IsoTimestamp;
		readonly summaries: SourceIngestionQueueItemSummary[];
		readonly stagedChanges: StagedChangeRecord[];
		readonly active: ActiveQueueState;
	}): Promise<void> {
		const controller = new AbortController();
		const itemId = input.item.summary.itemId;
		input.active.controllers.set(itemId, controller);
		this.replaceSummary(input.summaries, itemId, {
			status: "running",
			startedAt: toIsoTimestamp(this.now()),
			message: "Source ingestion queue item is running.",
		});
		this.emit(
			input.input,
			input.queueId,
			input.concurrency,
			input.startedAt,
			input.summaries,
			input.active.cancelRequested,
			input.input.cachePath,
		);

		try {
			const stageSource = this.options.stageSource ?? ((request) => this.stagingService.stageSource(request));
			const result = await stageSource({
				...input.item.request,
				existingStagedChanges: [
					...(input.input.existingStagedChanges ?? []),
					...(input.item.request.existingStagedChanges ?? []),
					...input.stagedChanges,
				],
				signal: controller.signal,
			});
			const completedAt = toIsoTimestamp(this.now());
			if (result.ok) {
				input.stagedChanges.push(...result.stagedChanges);
				this.replaceSummary(input.summaries, itemId, {
					status: "staged",
					providerDecision: result.providerDecision,
					targetPaths: result.recovery.targetPaths,
					stagedChangeIds: result.stagedChanges.map((change) => change.changeId),
					validationOutput: result.validation.issues,
					retryable: false,
					message: `Staged ${result.stagedChanges.length} generated change(s).`,
					completedAt,
				});
				return;
			}

			const wasCanceled = controller.signal.aborted || result.code === "ingestion.canceled";
			this.replaceSummary(input.summaries, itemId, {
				status: wasCanceled ? "canceled" : "failed",
				providerDecision: result.providerDecision,
				targetPaths: result.targetPaths,
				stagedChangeIds: result.stagedChangeIds,
				validationOutput: result.validationOutput,
				retryable: result.retryable,
				failureCode: result.code,
				message: result.message,
				completedAt,
			});
		} finally {
			input.active.controllers.delete(itemId);
			this.emit(
				input.input,
				input.queueId,
				input.concurrency,
				input.startedAt,
				input.summaries,
				input.active.cancelRequested,
				input.input.cachePath,
			);
		}
	}

	private reviewProvider(preview: SourceIngestionPreview): SourceIngestionProviderDecisionRecord {
		if (preview.extractionPlan.providerRequirement.mode === "none") {
			return notRequestedDecision();
		}

		return decisionFromPreflight(
			this.options.providerPreflight?.(preview) ??
				defaultProviderPreflight(preview, this.options.getSettings, this.options.baselineProviders),
		);
	}

	private queueDuplicateIssue(
		preview: SourceIngestionPreview,
		seenSourcePaths: ReadonlySet<NormalizedVaultPath>,
		seenContentHashes: ReadonlySet<string>,
		seenTargetPaths: ReadonlySet<NormalizedVaultPath>,
	): ValidationIssue | null {
		if (seenSourcePaths.has(preview.sourcePath)) {
			return issue(
				"record.invalid-state",
				"Queue already contains this source path.",
				"sourcePath",
				preview.sourcePath,
			);
		}
		if (seenContentHashes.has(preview.contentSha256)) {
			return issue(
				"record.invalid-state",
				"Queue already contains this source content hash.",
				"contentSha256",
				preview.sourcePath,
			);
		}
		const duplicateTarget = targetPathsFromPreview(preview).find((path) => seenTargetPaths.has(path));
		if (duplicateTarget !== undefined) {
			return issue(
				"record.invalid-state",
				"Queue already contains a source that would stage the same target path.",
				"targetPaths",
				duplicateTarget,
			);
		}

		return null;
	}

	private failedQueueSummary(input: {
		readonly queueId: string;
		readonly concurrency: number;
		readonly startedAt: IsoTimestamp;
		readonly cachePath?: NormalizedVaultPath;
		readonly validationOutput: readonly ValidationIssue[];
	}): SourceIngestionQueueSummary {
		const updatedAt = toIsoTimestamp(this.now());
		return {
			...buildSummary({
				queueId: input.queueId,
				concurrency: input.concurrency,
				startedAt: input.startedAt,
				updatedAt,
				completedAt: updatedAt,
				...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
				items: [],
				cancelRequested: false,
			}),
			status: "failed",
			validationOutput: input.validationOutput,
			recovery: queueRecovery({
				queueId: input.queueId,
				...(input.cachePath === undefined ? {} : { cachePath: input.cachePath }),
				sourcePaths: [],
				targetPaths: [],
				stagedChangeIds: [],
				validationOutput: input.validationOutput,
				updatedAt,
			}),
		};
	}

	private replaceSummary(
		summaries: SourceIngestionQueueItemSummary[],
		itemId: string,
		patch: Partial<Omit<SourceIngestionQueueItemSummary, "recovery" | "queueId" | "itemId" | "index">>,
	): void {
		const index = summaries.findIndex((summary) => summary.itemId === itemId);
		const current = summaries[index];
		if (index === -1 || current === undefined) {
			return;
		}

		summaries[index] = this.updateItemSummary(current, patch);
	}

	private updateItemSummary(
		current: SourceIngestionQueueItemSummary,
		patch: Partial<Omit<SourceIngestionQueueItemSummary, "recovery" | "queueId" | "itemId" | "index">>,
	): SourceIngestionQueueItemSummary {
		const updatedAt = toIsoTimestamp(this.now());
		const next = {
			...current,
			...patch,
		};

		return {
			...next,
			citationState:
				patch.status === "staged"
					? "valid"
					: patch.failureCode === "ingestion.citation-invalid"
						? "invalid"
						: next.citationState,
			recovery: itemRecovery({
				queueId: next.queueId,
				itemId: next.itemId,
				status: next.status,
				...(next.sourcePath === undefined ? {} : { sourcePath: next.sourcePath }),
				...(next.contentSha256 === undefined ? {} : { contentSha256: next.contentSha256 }),
				targetPaths: next.targetPaths,
				...(next.recovery.cachePath === undefined ? {} : { cachePath: next.recovery.cachePath }),
				stagedChangeIds: next.stagedChangeIds,
				...(next.providerDecision === undefined ? {} : { providerDecision: next.providerDecision }),
				validationOutput: next.validationOutput,
				updatedAt,
			}),
		};
	}

	private emit(
		input: SourceIngestionQueueRunInput,
		queueId: string,
		concurrency: number,
		startedAt: IsoTimestamp,
		items: readonly SourceIngestionQueueItemSummary[],
		cancelRequested: boolean,
		cachePath: NormalizedVaultPath | undefined,
	): void {
		input.onUpdate?.(
			buildSummary({
				queueId,
				concurrency,
				startedAt,
				updatedAt: toIsoTimestamp(this.now()),
				...(cachePath === undefined ? {} : { cachePath }),
				items,
				cancelRequested,
			}),
		);
	}
}

export const createSourceIngestionQueueService = (
	options?: SourceIngestionQueueServiceOptions,
): SourceIngestionQueueService => new SourceIngestionQueueService(options);

export const runSourceIngestionQueue = (
	input: SourceIngestionQueueRunInput,
	options?: SourceIngestionQueueServiceOptions,
): Promise<SourceIngestionQueueRunResult> => new SourceIngestionQueueService(options).runQueue(input);
