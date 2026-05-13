import {
	createProviderInvocationAttempt,
	normalizeProviderInvocationDiagnostic,
} from "../providers/provider-invocation";
import { preflightProviderSetup } from "../providers/provider-preflight";
import {
	INGEST_SOURCE_COMMAND_ID,
	type SourceIngestionIntakeRequest,
	type SourceIngestionPreview,
	type SourceIngestionProviderDecisionRecord,
	type SourceIngestionRecoveryRecord,
	type SourceIngestionStageFailure,
	type SourceIngestionStageResult,
} from "../types/ingestion";
import type { VoidbrainPluginSettings } from "../types/plugin";
import type { ProviderInvocationAttempt } from "../types/provider-invocation";
import type { ProviderSetupPreflightDecision } from "../types/provider-setup";
import type { ProviderDefinition } from "../types/providers";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";
import { validateGeneratedIngestionArtifacts } from "./source-citation-validation";
import { SourceIngestionIntakeService } from "./source-ingestion-intake-service";
import {
	type SourceIngestionExtractionCandidate,
	renderSourceIngestionArtifacts,
	toAsciiText,
} from "./source-ingestion-renderer";
import { StagedChangeService } from "./staged-change-service";

export interface SourceIngestionProviderExtractionInput {
	readonly preview: SourceIngestionPreview;
	readonly content: string;
	readonly signal: AbortSignal;
	readonly attempt: number;
}

export type SourceIngestionProviderExtractor = (
	input: SourceIngestionProviderExtractionInput,
) => Promise<SourceIngestionExtractionCandidate>;

export interface SourceIngestionStagingServiceOptions {
	readonly intakeService?: SourceIngestionIntakeService;
	readonly stagedChangeService?: StagedChangeService;
	readonly getSettings?: () => VoidbrainPluginSettings;
	readonly baselineProviders?: readonly ProviderDefinition[];
	readonly providerPreflight?: (preview: SourceIngestionPreview) => ProviderSetupPreflightDecision;
	readonly providerExtractor?: SourceIngestionProviderExtractor;
	readonly providerTimeoutMs?: number;
	readonly maxProviderAttempts?: number;
	readonly retryBackoffMs?: number;
	readonly sleep?: (durationMs: number) => Promise<void>;
	readonly now?: () => Date;
}

interface TimedProviderExtraction {
	readonly timedOut: boolean;
	readonly aborted?: boolean;
	readonly extraction?: SourceIngestionExtractionCandidate;
	readonly error?: unknown;
}

interface ProviderExtractionResolution {
	readonly decision: SourceIngestionProviderDecisionRecord;
	readonly extraction: SourceIngestionExtractionCandidate;
}

const defaultSleep = (durationMs: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});

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

const sourceContentFromInput = (request: SourceIngestionIntakeRequest): string => {
	switch (request.input.kind) {
		case "markdown-file":
		case "text-file":
			return request.input.content ?? "";
		case "pasted-content":
		case "url-record":
			return request.input.content;
		default: {
			const exhaustive: never = request.input;
			return String(exhaustive);
		}
	}
};

const normalizeText = (value: string): string => toAsciiText(value).replaceAll(/\s+/g, " ").trim();

const deterministicEntities = (title: string, content: string): readonly string[] => {
	const phrases = Array.from(content.matchAll(/\b[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,2}\b/g))
		.map((match) => normalizeText(match[0]))
		.filter((value) => value.length >= 4 && value.toLowerCase() !== title.toLowerCase());
	const unique = phrases.filter(
		(value, index, values) =>
			values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
	);

	return unique.length === 0 ? [`${title} Entity`] : unique.slice(0, 2);
};

const deterministicConcepts = (title: string, content: string): readonly string[] => {
	const lowerContent = content.toLowerCase();
	const candidates = [
		lowerContent.includes("local-first") ? "Local First" : null,
		lowerContent.includes("privacy") ? "Privacy Boundary" : null,
		lowerContent.includes("staged") ? "Staged Changes" : null,
		lowerContent.includes("retrieval") ? "Retrieval" : null,
		`${title} Topic`,
	].filter((value): value is string => value !== null);

	return candidates
		.filter(
			(value, index, values) =>
				values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
		)
		.slice(0, 2);
};

const deterministicSummarySentences = (title: string, content: string): readonly string[] => {
	const sentences = normalizeText(content)
		.split(/(?<=[.!?])\s+/u)
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 0)
		.slice(0, 2);

	return sentences.length === 0 ? [`${title} was staged from approved source content.`] : sentences;
};

const createDeterministicExtraction = (
	preview: SourceIngestionPreview,
	content: string,
): SourceIngestionExtractionCandidate => ({
	entities: deterministicEntities(preview.title, content),
	concepts: deterministicConcepts(preview.title, content),
	summarySentences: deterministicSummarySentences(preview.title, content),
	excerpt: normalizeText(content).slice(0, 500),
});

const createAttempt = (
	now: () => Date,
	attempt: number,
	status: ProviderInvocationAttempt["status"],
	diagnostic: Record<string, string | number | boolean | null>,
): ProviderInvocationAttempt => ({
	...createProviderInvocationAttempt({
		attempt,
		startedAt: now(),
		completedAt: now(),
		status,
		retryable: status !== "succeeded",
		diagnostic: normalizeProviderInvocationDiagnostic(diagnostic),
	}),
});

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

const deniedDecision = (decision: ProviderSetupPreflightDecision): SourceIngestionProviderDecisionRecord => {
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

const runProviderExtractorWithTimeout = async (
	extractor: SourceIngestionProviderExtractor,
	input: Omit<SourceIngestionProviderExtractionInput, "signal">,
	timeoutMs: number,
	parentSignal?: AbortSignal,
): Promise<TimedProviderExtraction> => {
	if (parentSignal?.aborted === true) {
		return { timedOut: false, aborted: true };
	}

	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let abortListener: (() => void) | undefined;
	const timeout = new Promise<"timeout">((resolve) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			resolve("timeout");
		}, timeoutMs);
	});
	const aborted = new Promise<"aborted">((resolve) => {
		abortListener = () => {
			controller.abort();
			resolve("aborted");
		};
		parentSignal?.addEventListener("abort", abortListener, { once: true });
	});

	try {
		const result = await Promise.race([
			extractor({
				...input,
				signal: controller.signal,
			}),
			timeout,
			aborted,
		]);
		if (result === "timeout") {
			return { timedOut: true };
		}
		if (result === "aborted") {
			return { timedOut: false, aborted: true };
		}

		return {
			timedOut: false,
			extraction: result,
		};
	} catch (error) {
		return {
			timedOut: false,
			error,
		};
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		if (abortListener !== undefined) {
			parentSignal?.removeEventListener("abort", abortListener);
		}
		controller.abort();
	}
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
			diagnosticReason: "No plugin settings were available for source ingestion preflight.",
			diagnostic: {
				workflowId: INGEST_SOURCE_COMMAND_ID,
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

const validationIssueForFailure = (
	message: string,
	field: string,
	path?: NormalizedVaultPath,
): readonly ValidationIssue[] => [issue("record.invalid-state", message, field, path)];

const isAbortSignalAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

export class SourceIngestionStagingService {
	private readonly intakeService: SourceIngestionIntakeService;
	private readonly stagedChangeService: StagedChangeService;
	private readonly now: () => Date;
	private readonly inFlightFingerprints = new Set<string>();
	private readonly providerTimeoutMs: number;
	private readonly maxProviderAttempts: number;
	private readonly retryBackoffMs: number;
	private readonly sleep: (durationMs: number) => Promise<void>;

	public constructor(private readonly options: SourceIngestionStagingServiceOptions = {}) {
		const serviceTimeOptions = options.now === undefined ? {} : { now: options.now };
		this.intakeService = options.intakeService ?? new SourceIngestionIntakeService(serviceTimeOptions);
		this.stagedChangeService = options.stagedChangeService ?? new StagedChangeService(serviceTimeOptions);
		this.now = options.now ?? (() => new Date());
		this.providerTimeoutMs = Math.max(1, options.providerTimeoutMs ?? 1000);
		this.maxProviderAttempts = Math.max(1, options.maxProviderAttempts ?? 2);
		this.retryBackoffMs = Math.max(0, options.retryBackoffMs ?? 50);
		this.sleep = options.sleep ?? defaultSleep;
	}

	public async stageSource(request: SourceIngestionIntakeRequest): Promise<SourceIngestionStageResult> {
		if (isAbortSignalAborted(request.signal)) {
			return this.failure({
				code: "ingestion.canceled",
				message: "Source ingestion was canceled before preview.",
				retryable: true,
				validationOutput: validationIssueForFailure("Source ingestion was canceled.", "signal"),
			});
		}

		const previewResult = await this.intakeService.createPreview(request);
		if (!previewResult.ok) {
			return this.failure({
				code: "ingestion.input-invalid",
				message: "Source ingestion input failed validation. No vault notes were changed.",
				retryable: true,
				validationOutput: previewResult.errors,
			});
		}

		const preview = previewResult.value;
		if (isAbortSignalAborted(request.signal)) {
			return this.failure({
				code: "ingestion.canceled",
				message: "Source ingestion was canceled before staging.",
				retryable: true,
				preview,
				validationOutput: validationIssueForFailure(
					"Source ingestion was canceled before staging.",
					"signal",
					preview.sourcePath,
				),
			});
		}

		if (preview.duplicateStatus.isBlocking) {
			return this.failure({
				code: "ingestion.duplicate-source",
				message: preview.duplicateStatus.message,
				retryable: true,
				preview,
				validationOutput: [
					issue(
						"record.invalid-state",
						preview.duplicateStatus.message,
						"duplicateStatus",
						preview.sourcePath,
					),
				],
			});
		}

		if (this.inFlightFingerprints.has(preview.contentSha256)) {
			return this.failure({
				code: "ingestion.duplicate-source",
				message: "Source ingestion is already staging this content.",
				retryable: true,
				preview,
				validationOutput: validationIssueForFailure(
					"Source ingestion is already in flight for this content hash.",
					"contentSha256",
					preview.sourcePath,
				),
			});
		}

		this.inFlightFingerprints.add(preview.contentSha256);
		try {
			const content = sourceContentFromInput(request);
			const providerResolution = await this.resolveProviderExtraction(preview, content, request.signal);
			if (isAbortSignalAborted(request.signal)) {
				return this.failure({
					code: "ingestion.canceled",
					message: "Source ingestion was canceled before artifacts were staged.",
					retryable: true,
					preview,
					providerDecision: providerResolution.decision,
					validationOutput: validationIssueForFailure(
						"Source ingestion was canceled before artifacts were staged.",
						"signal",
						preview.sourcePath,
					),
				});
			}
			const artifacts = renderSourceIngestionArtifacts({
				preview,
				extraction: providerResolution.extraction,
				createdAt: makeIsoTimestamp(this.now().toISOString()),
			});
			const validation = validateGeneratedIngestionArtifacts(artifacts);
			if (!validation.ok) {
				return this.failure({
					code: "ingestion.citation-invalid",
					message: "Generated source ingestion artifacts failed citation validation.",
					retryable: true,
					preview,
					providerDecision: providerResolution.decision,
					validationOutput: validation.issues,
				});
			}

			const stagedChanges: StagedChangeRecord[] = [];
			for (const artifact of artifacts) {
				if (isAbortSignalAborted(request.signal)) {
					return this.failure({
						code: "ingestion.canceled",
						message: "Source ingestion was canceled before all artifacts were staged.",
						retryable: true,
						preview,
						providerDecision: providerResolution.decision,
						stagedChanges,
						validationOutput: validationIssueForFailure(
							"Source ingestion was canceled before all artifacts were staged.",
							"signal",
							artifact.targetPath,
						),
					});
				}

				const staged = await this.stagedChangeService.stageCreateNote({
					commandId: INGEST_SOURCE_COMMAND_ID,
					targetPath: artifact.targetPath,
					sourcePaths: artifact.sourcePaths,
					rationale: `Stage generated ${artifact.artifactKind} note from approved source ingestion.`,
					...(request.existingNotes === undefined ? {} : { existingNotes: request.existingNotes }),
					existingStagedChanges: [...(request.existingStagedChanges ?? []), ...stagedChanges],
					validationOutput: validation.issues,
					afterContent: artifact.markdown,
				});
				if (!staged.ok) {
					return this.failure({
						code: "ingestion.staging-failed",
						message: "Generated source ingestion artifact could not be staged.",
						retryable: true,
						preview,
						providerDecision: providerResolution.decision,
						stagedChanges,
						validationOutput: staged.errors,
					});
				}
				if (staged.value.status === "conflicted") {
					return this.failure({
						code: "ingestion.target-conflict",
						message: "Generated source ingestion artifact has a staged-change conflict.",
						retryable: true,
						preview,
						providerDecision: providerResolution.decision,
						stagedChanges: [...stagedChanges, staged.value],
						validationOutput: staged.value.recovery.validationOutput,
					});
				}

				stagedChanges.push(staged.value);
			}

			const recovery = this.recovery(preview, providerResolution.decision, stagedChanges, validation.issues);
			return {
				ok: true,
				preview,
				providerDecision: providerResolution.decision,
				artifacts,
				stagedChanges,
				validation,
				recovery,
			};
		} finally {
			this.inFlightFingerprints.delete(preview.contentSha256);
		}
	}

	private async resolveProviderExtraction(
		preview: SourceIngestionPreview,
		content: string,
		signal?: AbortSignal,
	): Promise<ProviderExtractionResolution> {
		const fallback = createDeterministicExtraction(preview, content);
		if (preview.extractionPlan.providerRequirement.mode === "none") {
			return {
				decision: notRequestedDecision(),
				extraction: fallback,
			};
		}

		const preflight =
			this.options.providerPreflight?.(preview) ??
			defaultProviderPreflight(preview, this.options.getSettings, this.options.baselineProviders);
		if (!preflight.allowed) {
			return {
				decision: deniedDecision(preflight),
				extraction: fallback,
			};
		}

		const extractor = this.options.providerExtractor;
		if (extractor === undefined) {
			return {
				decision: {
					...deniedDecision(preflight),
					kind: "failed",
					allowed: false,
					code: "provider-extractor-missing",
					userMessage: "Provider extraction adapter is unavailable; deterministic local extraction was used.",
					diagnostic: {
						providerId: preflight.provider.id,
						modelId: preflight.modelId,
						reason: "missing-provider-extractor",
					},
				},
				extraction: fallback,
			};
		}

		const attempts: ProviderInvocationAttempt[] = [];
		for (let attempt = 1; attempt <= this.maxProviderAttempts; attempt += 1) {
			const timed = await runProviderExtractorWithTimeout(
				extractor,
				{
					preview,
					content,
					attempt,
				},
				this.providerTimeoutMs,
				signal,
			);

			if (timed.aborted === true) {
				attempts.push(
					createAttempt(this.now, attempt, "canceled", {
						reason: "provider-aborted",
					}),
				);
				break;
			}

			if (timed.timedOut) {
				attempts.push(
					createAttempt(this.now, attempt, "timed-out", {
						reason: "provider-timeout",
						timeoutMs: this.providerTimeoutMs,
					}),
				);
			} else if (timed.error !== undefined) {
				attempts.push(
					createAttempt(this.now, attempt, "failed", {
						reason: "provider-error",
					}),
				);
			} else if (timed.extraction !== undefined) {
				attempts.push(
					createAttempt(this.now, attempt, "succeeded", {
						reason: "provider-extraction-ready",
					}),
				);
				return {
					decision: {
						...deniedDecision(preflight),
						attempts,
					},
					extraction: timed.extraction,
				};
			}

			if (attempt < this.maxProviderAttempts && this.retryBackoffMs > 0) {
				await this.sleep(this.retryBackoffMs);
			}
		}

		return {
			decision: {
				...deniedDecision(preflight),
				kind: "failed",
				allowed: false,
				code: "provider-extraction-failed",
				userMessage: "Provider extraction failed; deterministic local extraction was used.",
				attempts,
				diagnostic: {
					providerId: preflight.provider.id,
					modelId: preflight.modelId,
					reason: "provider-extraction-failed",
				},
			},
			extraction: fallback,
		};
	}

	private recovery(
		preview: SourceIngestionPreview,
		providerDecision: SourceIngestionProviderDecisionRecord,
		stagedChanges: readonly StagedChangeRecord[],
		validationOutput: readonly ValidationIssue[],
	): SourceIngestionRecoveryRecord {
		const targetPaths = [
			preview.targetPaths.source,
			...preview.targetPaths.entities,
			...preview.targetPaths.concepts,
			preview.targetPaths.summary,
		];

		return {
			commandId: INGEST_SOURCE_COMMAND_ID,
			sourcePath: preview.sourcePath,
			contentSha256: preview.contentSha256,
			stagedChangeIds: stagedChanges.map((change) => change.changeId),
			targetPaths,
			providerDecision,
			validationOutput,
			retryGuidance:
				"Inspect staged-change IDs and rerun ingestion after resolving validation or target conflicts.",
			updatedAt: makeIsoTimestamp(this.now().toISOString()),
		};
	}

	private failure(input: {
		readonly code: SourceIngestionStageFailure["code"];
		readonly message: string;
		readonly retryable: boolean;
		readonly preview?: SourceIngestionPreview;
		readonly providerDecision?: SourceIngestionProviderDecisionRecord;
		readonly stagedChanges?: readonly StagedChangeRecord[];
		readonly validationOutput: readonly ValidationIssue[];
	}): SourceIngestionStageFailure {
		const stagedChanges = input.stagedChanges ?? [];
		const providerDecision = input.providerDecision ?? notRequestedDecision();
		const targetPaths =
			input.preview === undefined
				? []
				: [
						input.preview.targetPaths.source,
						...input.preview.targetPaths.entities,
						...input.preview.targetPaths.concepts,
						input.preview.targetPaths.summary,
					];
		const recovery =
			input.preview === undefined
				? undefined
				: this.recovery(input.preview, providerDecision, stagedChanges, input.validationOutput);

		return {
			ok: false,
			code: input.code,
			message: input.message,
			retryable: input.retryable,
			...(input.preview === undefined ? {} : { sourcePath: input.preview.sourcePath }),
			stagedChangeIds: stagedChanges.map((change) => change.changeId),
			targetPaths,
			providerDecision,
			validationOutput: input.validationOutput,
			...(recovery === undefined ? {} : { recovery }),
		};
	}
}

export const stageSourceIngestion = (
	request: SourceIngestionIntakeRequest,
	options?: SourceIngestionStagingServiceOptions,
): Promise<SourceIngestionStageResult> => new SourceIngestionStagingService(options).stageSource(request);
