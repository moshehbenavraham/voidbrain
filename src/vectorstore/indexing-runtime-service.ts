import { buildProviderDefinitionsForSettings, preflightProviderSetup } from "../providers/provider-preflight";
import type {
	IndexingRuntimeAction,
	IndexingRuntimeActionResult,
	IndexingRuntimeReport,
	IndexingRuntimeReportStatus,
	IndexingRuntimeState,
	IndexingRuntimeSubscriber,
	IndexingRuntimeUnsubscribe,
	ObsidianMarkdownSourceReadResult,
	SemanticIndexReadiness,
	SemanticIndexReadinessState,
} from "../types/indexing-runtime";
import type { VoidbrainPluginSettings } from "../types/plugin";
import type { ProviderDefinition } from "../types/providers";
import type {
	IndexFreshnessSnapshot,
	IndexProgressSnapshot,
	IndexSourceFingerprint,
	LexicalIndexSnapshot,
	RetrievalReadinessState,
} from "../types/retrieval";
import { type IsoTimestamp, type NormalizedVaultPath, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths } from "../utils/vault-paths";
import { evaluateIndexFreshness, fingerprintsFromParsedNotes } from "./index-state";
import { FixtureIndexingService } from "./indexing-service";
import type { MarkdownParseOptions } from "./markdown-parser";
import { parseMarkdownNote } from "./markdown-parser";
import { type ObsidianMarkdownIndexSource, createEmptyObsidianMarkdownSourceReadResult } from "./obsidian-index-source";
import { preflightSemanticIndexProvider } from "./semantic-index";

export const DEFAULT_RUNTIME_LEXICAL_INDEX_ID = "voidbrain-vault-lexical-index";
export const SEMANTIC_INDEX_READINESS_WORKFLOW_ID = "voidbrain.semantic-index-readiness";

export interface IndexingRuntimeServiceOptions {
	readonly source: ObsidianMarkdownIndexSource;
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly getProviders?: () => readonly ProviderDefinition[];
	readonly now?: () => Date;
	readonly indexId?: string;
	readonly createIndexingService?: (parseOptions: MarkdownParseOptions) => FixtureIndexingService;
}

interface InFlightLexicalJob {
	readonly jobId: string;
	readonly controller: AbortController;
}

const defaultNow = (): Date => new Date();

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const readinessStateForReportStatus = (status: IndexingRuntimeReportStatus): RetrievalReadinessState => {
	switch (status) {
		case "disabled":
			return "disabled";
		case "idle":
		case "missing":
			return "missing";
		case "building":
			return "building";
		case "ready":
			return "ready";
		case "stale":
			return "stale";
		case "error":
			return "error";
		case "canceled":
			return "canceled";
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled indexing report status: ${String(exhaustive)}`);
		}
	}
};

const readinessStateForSemantic = (state: SemanticIndexReadinessState): RetrievalReadinessState => {
	switch (state) {
		case "disabled":
			return "disabled";
		case "ready":
			return "ready";
		case "missing-provider":
			return "missing";
		case "auth-not-ready":
		case "capability-mismatch":
		case "privacy-denied":
		case "blocked":
			return "blocked";
		default: {
			const exhaustive: never = state;
			throw new Error(`Unhandled semantic readiness state: ${String(exhaustive)}`);
		}
	}
};

const emptyReport = (indexId: string, now: Date): IndexingRuntimeReport => ({
	indexId,
	jobId: null,
	status: "missing",
	readinessState: "missing",
	progress: null,
	freshness: null,
	indexedNoteCount: 0,
	totalNoteCount: 0,
	skippedPaths: [],
	failedPaths: [],
	stalePaths: [],
	missingPaths: [],
	extraPaths: [],
	currentPath: null,
	updatedAt: toIsoTimestamp(now),
	message: "No lexical index has been built yet.",
});

const reportFromParts = (input: {
	readonly indexId: string;
	readonly jobId: string | null;
	readonly status: IndexingRuntimeReportStatus;
	readonly progress: IndexProgressSnapshot | null;
	readonly freshness: IndexFreshnessSnapshot | null;
	readonly sourceRead: ObsidianMarkdownSourceReadResult;
	readonly indexedNoteCount: number;
	readonly now: Date;
	readonly message: string;
}): IndexingRuntimeReport => ({
	indexId: input.indexId,
	jobId: input.jobId,
	status: input.status,
	readinessState: readinessStateForReportStatus(input.status),
	progress: input.progress,
	freshness: input.freshness,
	indexedNoteCount: input.indexedNoteCount,
	totalNoteCount: input.sourceRead.notes.length,
	skippedPaths: input.sourceRead.skippedPaths,
	failedPaths: input.sourceRead.failedPaths,
	stalePaths: input.freshness?.staleSourcePaths ?? [],
	missingPaths: input.freshness?.missingSourcePaths ?? [],
	extraPaths: input.freshness?.extraSourcePaths ?? [],
	currentPath: input.progress?.currentPath ?? null,
	updatedAt: input.progress?.updatedAt ?? input.freshness?.checkedAt ?? toIsoTimestamp(input.now),
	message: input.message,
});

const uniqueSortedPaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	[...new Set(paths)].sort(compareVaultPaths);

const sourcePathsForSemanticReadiness = (report: IndexingRuntimeReport): readonly NormalizedVaultPath[] => {
	const currentSourcePaths = report.freshness?.currentSources.map((source) => source.path) ?? [];
	const indexedSourcePaths = report.freshness?.indexedSources.map((source) => source.path) ?? [];
	const progressPath = report.currentPath === null ? [] : [report.currentPath];

	return uniqueSortedPaths([...currentSourcePaths, ...indexedSourcePaths, ...progressPath]);
};

const parseSourceFingerprints = (
	sourceRead: ObsidianMarkdownSourceReadResult,
	parseOptions: MarkdownParseOptions,
): readonly IndexSourceFingerprint[] => {
	const parsedNotes = sourceRead.notes.flatMap((note) => {
		const parsed = parseMarkdownNote(note.path, note.content, parseOptions);
		return parsed.ok ? [parsed.value] : [];
	});

	return fingerprintsFromParsedNotes(parsedNotes);
};

const semanticReadiness = (input: {
	readonly state: SemanticIndexReadinessState;
	readonly checkedAt: Date;
	readonly settings: VoidbrainPluginSettings;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly message: string;
	readonly diagnosticCode?: string;
}): SemanticIndexReadiness => ({
	state: input.state,
	readinessState: readinessStateForSemantic(input.state),
	checkedAt: toIsoTimestamp(input.checkedAt),
	contentSensitivity: input.settings.defaultContentSensitivity,
	providerId: input.settings.providerRoles.embedding.providerId,
	modelId: input.settings.providerRoles.embedding.modelId,
	sourcePathCount: input.sourcePaths.length,
	message: input.message,
	diagnosticCode: input.diagnosticCode ?? null,
});

export class IndexingRuntimeService {
	private readonly subscribers = new Set<IndexingRuntimeSubscriber>();
	private readonly now: () => Date;
	private readonly indexId: string;
	private readonly createIndexingService: (parseOptions: MarkdownParseOptions) => FixtureIndexingService;
	private lexicalIndex: LexicalIndexSnapshot | null = null;
	private inFlightLexicalJob: InFlightLexicalJob | null = null;
	private jobCounter = 0;
	private state: IndexingRuntimeState;

	public constructor(private readonly options: IndexingRuntimeServiceOptions) {
		this.now = options.now ?? defaultNow;
		this.indexId = options.indexId ?? DEFAULT_RUNTIME_LEXICAL_INDEX_ID;
		this.createIndexingService =
			options.createIndexingService ??
			((parseOptions) =>
				new FixtureIndexingService({
					parseOptions,
				}));
		const initialReport = emptyReport(this.indexId, this.now());
		this.state = {
			lexicalReport: initialReport,
			lexicalIndex: null,
			semanticReadiness: this.evaluateSemanticReadiness(initialReport),
		};
	}

	public getState(): IndexingRuntimeState {
		return this.state;
	}

	public subscribe(subscriber: IndexingRuntimeSubscriber): IndexingRuntimeUnsubscribe {
		this.subscribers.add(subscriber);
		subscriber(this.state);

		return () => {
			this.subscribers.delete(subscriber);
		};
	}

	public refreshReadiness(): IndexingRuntimeActionResult {
		this.setState({
			...this.state,
			semanticReadiness: this.evaluateSemanticReadiness(this.state.lexicalReport),
		});

		return this.actionResult("refresh-readiness", true, "ready", "Indexing readiness was refreshed.");
	}

	public async reindexLexical(): Promise<IndexingRuntimeActionResult> {
		const settings = this.options.getSettings();
		if (!settings.indexing.isLexicalIndexEnabled) {
			const report = reportFromParts({
				indexId: this.indexId,
				jobId: null,
				status: "disabled",
				progress: null,
				freshness: null,
				sourceRead: createEmptyObsidianMarkdownSourceReadResult(),
				indexedNoteCount: 0,
				now: this.now(),
				message: "Lexical indexing is disabled in settings.",
			});
			this.lexicalIndex = null;
			this.setState({
				lexicalReport: report,
				lexicalIndex: null,
				semanticReadiness: this.evaluateSemanticReadiness(report),
			});

			return this.actionResult("reindex-lexical", false, "disabled", report.message);
		}

		if (this.inFlightLexicalJob !== null) {
			return this.actionResult(
				"reindex-lexical",
				false,
				this.state.lexicalReport.status,
				`Lexical index job ${this.inFlightLexicalJob.jobId} is already running.`,
			);
		}

		const jobId = this.nextJobId();
		const controller = new AbortController();
		const initialSourceRead = createEmptyObsidianMarkdownSourceReadResult();
		this.inFlightLexicalJob = { jobId, controller };
		this.setLexicalReport(
			reportFromParts({
				indexId: this.indexId,
				jobId,
				status: "building",
				progress: null,
				freshness: null,
				sourceRead: initialSourceRead,
				indexedNoteCount: 0,
				now: this.now(),
				message: "Lexical index is collecting markdown notes from the vault.",
			}),
		);

		let sourceRead = initialSourceRead;
		try {
			sourceRead = await this.options.source.readMarkdownNotes({
				preferences: settings.indexing,
				signal: controller.signal,
			});
			const parseOptions: MarkdownParseOptions = {
				knownPaths: sourceRead.knownPaths,
				pathAliases: sourceRead.pathAliases,
			};
			const indexingService = this.createIndexingService(parseOptions);
			const result = await indexingService.buildLexicalIndexJob({
				jobId,
				indexId: this.indexId,
				notes: sourceRead.notes,
				signal: controller.signal,
				now: this.now,
				onProgress: (progress) => {
					this.setLexicalReport(
						reportFromParts({
							indexId: this.indexId,
							jobId,
							status: progress.status === "idle" ? "building" : progress.status,
							progress,
							freshness: null,
							sourceRead,
							indexedNoteCount: progress.indexedNotes,
							now: this.now(),
							message: this.messageForProgress(progress),
						}),
					);
				},
			});

			if (!result.ok) {
				this.lexicalIndex = null;
				this.setLexicalReport(
					reportFromParts({
						indexId: this.indexId,
						jobId,
						status: result.status,
						progress: result.progress,
						freshness: null,
						sourceRead,
						indexedNoteCount: result.progress.indexedNotes,
						now: this.now(),
						message: result.message,
					}),
				);

				return this.actionResult(
					"reindex-lexical",
					result.status === "canceled",
					result.status,
					result.message,
				);
			}

			this.lexicalIndex = result.index;
			const freshness = evaluateIndexFreshness(
				this.indexId,
				result.index.sources,
				result.index.sources,
				this.now(),
			);
			const report = reportFromParts({
				indexId: this.indexId,
				jobId,
				status: freshness.state === "missing" ? "missing" : "ready",
				progress: result.progress,
				freshness,
				sourceRead,
				indexedNoteCount: result.index.sources.length,
				now: this.now(),
				message:
					result.index.sources.length === 0
						? "Lexical index completed with no markdown notes."
						: "Lexical index is ready.",
			});
			this.setState({
				lexicalReport: report,
				lexicalIndex: this.lexicalIndex,
				semanticReadiness: this.evaluateSemanticReadiness(report),
			});

			return this.actionResult("reindex-lexical", true, report.status, report.message);
		} catch (error) {
			const wasCanceled = controller.signal.aborted;
			const status = wasCanceled ? "canceled" : "error";
			const message = wasCanceled
				? "Lexical index job was canceled."
				: error instanceof Error
					? error.message
					: "Lexical index job failed.";
			this.lexicalIndex = null;
			this.setLexicalReport(
				reportFromParts({
					indexId: this.indexId,
					jobId,
					status,
					progress: null,
					freshness: null,
					sourceRead,
					indexedNoteCount: 0,
					now: this.now(),
					message,
				}),
			);

			return this.actionResult("reindex-lexical", wasCanceled, status, message);
		} finally {
			if (this.inFlightLexicalJob?.jobId === jobId) {
				this.inFlightLexicalJob = null;
			}
		}
	}

	public cancelLexical(): IndexingRuntimeActionResult {
		const inFlightJob = this.inFlightLexicalJob;
		if (inFlightJob === null) {
			return this.actionResult(
				"cancel-lexical",
				false,
				this.state.lexicalReport.status,
				"No lexical index job is running.",
			);
		}

		inFlightJob.controller.abort();
		this.setLexicalReport({
			...this.state.lexicalReport,
			status: "canceled",
			readinessState: "canceled",
			message: `Lexical index job ${inFlightJob.jobId} was canceled.`,
			updatedAt: toIsoTimestamp(this.now()),
		});

		return this.actionResult("cancel-lexical", true, "canceled", "Lexical index cancellation was requested.");
	}

	public async retryLexical(): Promise<IndexingRuntimeActionResult> {
		if (this.inFlightLexicalJob !== null) {
			return this.actionResult(
				"retry-lexical",
				false,
				this.state.lexicalReport.status,
				`Lexical index job ${this.inFlightLexicalJob.jobId} is already running.`,
			);
		}

		return this.reindexLexical();
	}

	public async refreshLexicalFreshness(): Promise<IndexingRuntimeActionResult> {
		if (this.lexicalIndex === null) {
			this.refreshReadiness();
			return this.actionResult("refresh-readiness", false, "missing", "No lexical index is available.");
		}

		const sourceRead = await this.options.source.readMarkdownNotes({
			preferences: this.options.getSettings().indexing,
		});
		const currentSources = parseSourceFingerprints(sourceRead, {
			knownPaths: sourceRead.knownPaths,
			pathAliases: sourceRead.pathAliases,
		});
		const freshness = evaluateIndexFreshness(this.indexId, this.lexicalIndex.sources, currentSources, this.now());
		const reportStatus =
			freshness.state === "fresh" ? "ready" : freshness.state === "partial" ? "stale" : freshness.state;
		const report = reportFromParts({
			indexId: this.indexId,
			jobId: this.state.lexicalReport.jobId,
			status: reportStatus,
			progress: this.state.lexicalReport.progress,
			freshness,
			sourceRead,
			indexedNoteCount: this.lexicalIndex.sources.length,
			now: this.now(),
			message: this.messageForFreshness(freshness),
		});
		this.setState({
			lexicalReport: report,
			lexicalIndex: this.lexicalIndex,
			semanticReadiness: this.evaluateSemanticReadiness(report),
		});

		return this.actionResult("refresh-readiness", true, report.status, report.message);
	}

	public dispose(): void {
		this.inFlightLexicalJob?.controller.abort();
		this.inFlightLexicalJob = null;
		this.subscribers.clear();
	}

	private nextJobId(): string {
		this.jobCounter += 1;
		return `${this.indexId}-job-${this.jobCounter}`;
	}

	private providerDefinitions(): readonly ProviderDefinition[] {
		return this.options.getProviders?.() ?? buildProviderDefinitionsForSettings(this.options.getSettings());
	}

	private evaluateSemanticReadiness(report: IndexingRuntimeReport): SemanticIndexReadiness {
		const settings = this.options.getSettings();
		const sourcePaths = sourcePathsForSemanticReadiness(report);
		const checkedAt = this.now();

		if (!settings.indexing.isSemanticIndexEnabled) {
			return semanticReadiness({
				state: "disabled",
				checkedAt,
				settings,
				sourcePaths,
				message: "Semantic indexing is disabled in settings.",
			});
		}

		const setupDecision = preflightProviderSetup(
			{
				settings,
				baselineProviders: this.providerDefinitions(),
			},
			{
				role: "embedding",
				requiredCapability: "embeddings",
				contentSensitivity: settings.defaultContentSensitivity,
				...(sourcePaths.length === 0 ? {} : { sourcePaths }),
				workflowId: SEMANTIC_INDEX_READINESS_WORKFLOW_ID,
				userFacingPurpose: "Check semantic indexing readiness before embedding vault content.",
			},
		);

		if (!setupDecision.allowed) {
			return semanticReadiness({
				state: this.semanticStateForSetupDenial(setupDecision.code),
				checkedAt,
				settings,
				sourcePaths,
				message: setupDecision.userMessage,
				diagnosticCode: setupDecision.code,
			});
		}

		const semanticDecision = preflightSemanticIndexProvider(this.providerDefinitions(), setupDecision.policy, {
			providerId: setupDecision.provider.id,
			preferredModelId: setupDecision.modelId,
			contentSensitivity: settings.defaultContentSensitivity,
			sourcePaths,
			workflowId: SEMANTIC_INDEX_READINESS_WORKFLOW_ID,
			userFacingPurpose: "Check semantic indexing readiness before embedding vault content.",
		});

		if (!semanticDecision.preflight.allowed) {
			return semanticReadiness({
				state: this.semanticStateForPreflightDenial(semanticDecision.preflight.code),
				checkedAt,
				settings,
				sourcePaths,
				message: semanticDecision.preflight.userMessage,
				diagnosticCode: semanticDecision.preflight.code,
			});
		}

		if (semanticDecision.embeddingModelFamily === undefined) {
			return semanticReadiness({
				state: "capability-mismatch",
				checkedAt,
				settings,
				sourcePaths,
				message: "Selected embedding model does not declare an embedding family.",
				diagnosticCode: "missing-embedding-family",
			});
		}

		return semanticReadiness({
			state: "ready",
			checkedAt,
			settings,
			sourcePaths,
			message: "Semantic indexing preflight is ready for the selected embedding provider.",
		});
	}

	private semanticStateForSetupDenial(code: string): SemanticIndexReadinessState {
		switch (code) {
			case "role-not-selected":
				return "missing-provider";
			case "auth-not-ready":
				return "auth-not-ready";
			case "capability-denied":
				return "capability-mismatch";
			case "privacy-denied":
				return "privacy-denied";
			default:
				return "blocked";
		}
	}

	private semanticStateForPreflightDenial(code: string): SemanticIndexReadinessState {
		switch (code) {
			case "cloud-disabled":
			case "provider-not-trusted":
			case "private-content-cloud-denied":
				return "privacy-denied";
			case "provider-not-found":
				return "missing-provider";
			case "model-not-found":
			case "capability-unsupported":
				return "capability-mismatch";
			default:
				return "blocked";
		}
	}

	private setLexicalReport(report: IndexingRuntimeReport): void {
		this.setState({
			lexicalReport: report,
			lexicalIndex: this.lexicalIndex,
			semanticReadiness: this.evaluateSemanticReadiness(report),
		});
	}

	private setState(state: IndexingRuntimeState): void {
		this.state = state;
		for (const subscriber of this.subscribers) {
			subscriber(this.state);
		}
	}

	private actionResult(
		action: IndexingRuntimeAction,
		accepted: boolean,
		status: IndexingRuntimeActionResult["status"],
		message: string,
	): IndexingRuntimeActionResult {
		return {
			action,
			accepted,
			status,
			message,
			state: this.state,
		};
	}

	private messageForProgress(progress: IndexProgressSnapshot): string {
		if (progress.status === "building") {
			return progress.currentPath === undefined
				? "Lexical index is building."
				: `Lexical index is processing ${progress.currentPath}.`;
		}

		if (progress.status === "ready") {
			return "Lexical index is ready.";
		}

		if (progress.status === "canceled") {
			return "Lexical index job was canceled.";
		}

		if (progress.status === "error") {
			return progress.errorMessage ?? "Lexical index job failed.";
		}

		return `Lexical index status is ${progress.status}.`;
	}

	private messageForFreshness(freshness: IndexFreshnessSnapshot): string {
		switch (freshness.state) {
			case "fresh":
				return "Lexical index is fresh.";
			case "stale":
				return "Lexical index has stale source paths.";
			case "partial":
				return "Lexical index is missing or retaining some source paths.";
			case "missing":
				return "Lexical index has no indexed markdown sources.";
			default: {
				const exhaustive: never = freshness.state;
				throw new Error(`Unhandled freshness state: ${String(exhaustive)}`);
			}
		}
	}
}
