import { describe, expect, it } from "vitest";
import {
	MaintenanceRecommendationPlanner,
	RecoverSessionService,
	SimilarNoteSuggestionService,
	SourceIngestionIntakeService,
	SourceIngestionQueueService,
	SourceIngestionStagingService,
	planSimilarNoteSuggestions,
} from "../src/agent";
import { AGENT_COMMAND_CATALOG } from "../src/agent/command-catalog";
import { scanFixtureSafetyText } from "../src/agent/fixture-safety";
import { planFrameworkUpdatePreview } from "../src/agent/framework-update-preview";
import { validateRepositoryScanPath } from "../src/agent/repository-scan-boundary";
import { validateAgentSurfaceMarkdown } from "../src/agent/surface-validation";
import type { AgentValidationErrorCode } from "../src/types/agent-commands";
import type { SourceIngestionIntakeRequest, SourceIngestionStageFailure } from "../src/types/ingestion";
import type { MaintenanceRecommendation } from "../src/types/maintenance";
import type { SimilarNoteSuggestion } from "../src/types/suggestions";
import type { ValidationIssue } from "../src/types/vault";
import { makeIsoTimestamp } from "../src/types/vault";
import {
	PHASE02_CLOSEOUT_COMMAND_IDS,
	PHASE02_INTEGRATION_NOW,
	PHASE02_PRIVATE_CONTENT_SENTINELS,
	PHASE02_REQUIRED_RECOVERY_FIELDS,
	createPhase02FixtureSafetyEntries,
	createPhase02FrameworkPreviewFixtureSet,
	createPhase02MaintenanceFixtureSet,
	createPhase02QueueFixtureSet,
	createPhase02RecoveryFixtureSet,
	createPhase02SimilarNoteFixtureSet,
	createPhase02SurfaceFixtureSet,
	phase02CloseoutSupportRecord,
} from "./fixtures/vault/phase02-integration-fixtures";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const expectRecordFields = (value: unknown, fields: readonly string[]): void => {
	expect(isRecord(value)).toBe(true);
	if (!isRecord(value)) {
		throw new Error("Expected integration fixture to be a record.");
	}

	for (const field of fields) {
		expect(Object.hasOwn(value, field)).toBe(true);
	}
};

const expectNoPrivateSentinels = (value: unknown): void => {
	const serialized = JSON.stringify(value);

	for (const sentinel of PHASE02_PRIVATE_CONTENT_SENTINELS) {
		expect(serialized).not.toContain(sentinel);
	}
};

const expectIssueCodes = (issues: readonly { readonly code: AgentValidationErrorCode }[]) => ({
	toInclude: (codes: readonly AgentValidationErrorCode[]): void => {
		expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([...codes]));
	},
});

const requiredMaintenanceRecommendation = (
	recommendations: readonly MaintenanceRecommendation[],
	predicate: (recommendation: MaintenanceRecommendation) => boolean,
	description: string,
): MaintenanceRecommendation => {
	const recommendation = recommendations.find(predicate);
	if (recommendation === undefined) {
		throw new Error(`Expected maintenance recommendation: ${description}`);
	}

	return recommendation;
};

const requiredSuggestion = (
	suggestions: readonly SimilarNoteSuggestion[],
	predicate: (suggestion: SimilarNoteSuggestion) => boolean,
	description: string,
): SimilarNoteSuggestion => {
	const suggestion = suggestions.find(predicate);
	if (suggestion === undefined) {
		throw new Error(`Expected similar-note suggestion: ${description}`);
	}

	return suggestion;
};

const fixedNow = () => PHASE02_INTEGRATION_NOW;

const phase02ProviderDecision = {
	kind: "not-requested" as const,
	allowed: false,
	providerId: null,
	modelId: null,
	code: null,
	userMessage: "Provider-assisted extraction was not requested for the synthetic closeout fixture.",
	attempts: [],
	diagnostic: { mode: "none" },
};

const phase02ValidationIssue = (message: string): ValidationIssue => ({
	code: "record.invalid-state",
	message,
	field: "phase02.queue",
});

const stageFailureFor = async (
	request: SourceIngestionIntakeRequest,
	code: SourceIngestionStageFailure["code"],
	message: string,
): Promise<SourceIngestionStageFailure> => {
	const preview = await new SourceIngestionIntakeService({ now: fixedNow }).createPreview(request);
	const validationOutput = [phase02ValidationIssue(message)];

	if (!preview.ok) {
		return {
			ok: false,
			code: "ingestion.input-invalid",
			message,
			retryable: true,
			stagedChangeIds: [],
			targetPaths: [],
			providerDecision: phase02ProviderDecision,
			validationOutput: preview.errors,
		};
	}

	const targetPaths = [
		preview.value.targetPaths.source,
		...preview.value.targetPaths.entities,
		...preview.value.targetPaths.concepts,
		preview.value.targetPaths.summary,
	];

	return {
		ok: false,
		code,
		message,
		retryable: true,
		sourcePath: preview.value.sourcePath,
		stagedChangeIds: [],
		targetPaths,
		providerDecision: phase02ProviderDecision,
		validationOutput,
		recovery: {
			commandId: "voidbrain.ingest-source",
			sourcePath: preview.value.sourcePath,
			contentSha256: preview.value.contentSha256,
			stagedChangeIds: [],
			targetPaths,
			providerDecision: phase02ProviderDecision,
			validationOutput,
			retryGuidance: "Resolve synthetic Phase 02 queue validation and retry.",
			updatedAt: makeIsoTimestamp(PHASE02_INTEGRATION_NOW.toISOString()),
		},
	};
};

describe("Phase 02 agentic maintenance integration harness", () => {
	it("uses bounded closeout fixtures with explicit recovery fields and issue mapping", () => {
		expect(PHASE02_CLOSEOUT_COMMAND_IDS).toEqual(AGENT_COMMAND_CATALOG.map((command) => command.id));
		expectRecordFields(phase02CloseoutSupportRecord, PHASE02_REQUIRED_RECOVERY_FIELDS);
		expectNoPrivateSentinels(phase02CloseoutSupportRecord);

		const [safeEntry, unsafeEntry] = createPhase02FixtureSafetyEntries();
		if (safeEntry === undefined || unsafeEntry === undefined) {
			throw new Error("Expected safe and unsafe Phase 02 fixture safety entries.");
		}

		expect(scanFixtureSafetyText(safeEntry.path, safeEntry.content).issues).toEqual([]);
		expectIssueCodes(scanFixtureSafetyText(unsafeEntry.path, unsafeEntry.content).issues).toInclude([
			"fixture.secret-like-key",
			"fixture.credential-like-value",
			"fixture.private-path-hint",
		]);
	});
});

describe("Phase 02 recovery integration", () => {
	it("returns recovery diagnostics for complete, missing, malformed, stale, and redacted support records", () => {
		const service = new RecoverSessionService();
		const fixtureSet = createPhase02RecoveryFixtureSet();
		const complete = service.buildSummary(fixtureSet.complete);
		const missing = service.buildSummary(fixtureSet.missing);
		const malformed = service.buildSummary(fixtureSet.malformed);
		const stale = service.buildSummary(fixtureSet.stale);
		const redacted = service.buildSummary(fixtureSet.redaction);

		expect(complete).toMatchObject({
			commandId: "voidbrain.recover-session",
			status: "ready",
		});
		expect(complete.items.map((item) => item.commandId)).toEqual(
			expect.arrayContaining([
				"voidbrain.chat-with-vault",
				"voidbrain.health-check",
				"voidbrain.hot-cache",
				"voidbrain.ingest-source",
				"voidbrain.save-session-summary",
				"voidbrain.stage-change",
			]),
		);
		expect(complete.items.flatMap((item) => item.stagedChangeIds)).toContain("stage-hot-cache-summary");
		expect(complete.actions.map((action) => action.kind)).toEqual(
			expect.arrayContaining(["inspect-report", "refresh-cache", "retry-command", "review-staged-change"]),
		);
		expectNoPrivateSentinels(complete);

		expect(missing).toMatchObject({
			status: "missing",
			items: [],
			diagnostics: [expect.objectContaining({ code: "recovery.missing-record" })],
		});
		expect(malformed.status).toBe("invalid");
		expect(malformed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
			expect.arrayContaining(["recovery.malformed-record", "recovery.unsupported-record"]),
		);
		expect(stale).toMatchObject({
			status: "partial",
			diagnostics: expect.arrayContaining([expect.objectContaining({ code: "recovery.stale-record" })]),
		});

		expect(redacted.status).toBe("partial");
		expect(redacted.redaction.redactedFieldCount).toBeGreaterThan(0);
		expect(redacted.redaction.omittedBodyCount).toBeGreaterThanOrEqual(2);
		expect(redacted.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
			expect.arrayContaining(["recovery.body-omitted", "recovery.secret-redacted"]),
		);
		expectNoPrivateSentinels(redacted);
	});
});

describe("Phase 02 agent surface validation integration", () => {
	it("fails closed on stale IDs, status drift, missing safety language, unsafe examples, and unsupported paths", () => {
		const surfaceFixtures = createPhase02SurfaceFixtureSet();
		const complete = validateAgentSurfaceMarkdown({
			surface: surfaceFixtures.surface,
			markdown: surfaceFixtures.completeMarkdown,
			commands: AGENT_COMMAND_CATALOG,
		});
		const stale = validateAgentSurfaceMarkdown({
			surface: surfaceFixtures.surface,
			markdown: surfaceFixtures.staleStatusMarkdown,
			commands: AGENT_COMMAND_CATALOG,
		});
		const missingSafety = validateAgentSurfaceMarkdown({
			surface: surfaceFixtures.surface,
			markdown: surfaceFixtures.missingSafetyMarkdown,
			commands: AGENT_COMMAND_CATALOG,
		});
		const unknownCommand = validateAgentSurfaceMarkdown({
			surface: surfaceFixtures.surface,
			markdown: `${surfaceFixtures.completeMarkdown}\n| \`voidbrain.unknown-phase02\` | planned | Drift. |`,
			commands: AGENT_COMMAND_CATALOG,
		});
		const [, unsafeEntry] = createPhase02FixtureSafetyEntries();
		if (unsafeEntry === undefined) {
			throw new Error("Expected unsafe fixture entry.");
		}

		expect(complete.issues).toEqual([]);
		expectIssueCodes(stale.issues).toInclude(["surface.stale-command-status"]);
		expect(stale.issues).toEqual([
			expect.objectContaining({
				commandId: "voidbrain.preview-framework-update",
				remediation: expect.stringContaining("implemented"),
			}),
		]);
		expectIssueCodes(missingSafety.issues).toInclude(["surface.missing-safety-phrase"]);
		expectIssueCodes(unknownCommand.issues).toInclude(["surface.unknown-command-id"]);
		expectIssueCodes(scanFixtureSafetyText(unsafeEntry.path, unsafeEntry.content).issues).toInclude([
			"fixture.secret-like-key",
			"fixture.credential-like-value",
			"fixture.private-path-hint",
		]);
		expect(
			validateRepositoryScanPath("../outside.md", {
				allowedRoots: ["docs"],
				allowedStandalonePaths: ["AGENTS.md"],
				allowedExtensions: [".md"],
				excludedRoots: ["vault"],
			}),
		).toMatchObject({
			ok: false,
			issue: expect.objectContaining({ code: "fixture.unsupported-scan-path" }),
		});
	});
});

describe("Phase 02 framework update preview integration", () => {
	it("keeps preview output dry-run with create, update, skip, conflict, excluded, hash, issue, and recovery details", () => {
		const fixtureSet = createPhase02FrameworkPreviewFixtureSet();
		const safe = planFrameworkUpdatePreview(fixtureSet.safe);
		const excluded = planFrameworkUpdatePreview(fixtureSet.excluded);
		const conflict = planFrameworkUpdatePreview(fixtureSet.conflict);
		const unsafe = planFrameworkUpdatePreview(fixtureSet.unsafe);
		const readFailure = planFrameworkUpdatePreview(fixtureSet.readFailure);

		expect(safe).toMatchObject({
			dryRun: true,
			commandId: "voidbrain.preview-framework-update",
			issues: [],
		});
		expect(safe.actions.map((action) => [action.path, action.action])).toEqual([
			["AGENTS.md", "update"],
			["docs/framework-update-preview.md", "create"],
			["README.md", "skip"],
		]);
		expect(safe.actions.every((action) => action.recovery.commandId === "voidbrain.preview-framework-update")).toBe(
			true,
		);
		expect(safe.actions.some((action) => action.action === "create" && action.proposedHash !== undefined)).toBe(
			true,
		);
		expect(safe.actions.some((action) => action.action === "update" && action.currentHash !== undefined)).toBe(
			true,
		);

		expect(excluded.excludedUserContentPaths).toContain("test/fixtures/vault/sources/demo-article.md");
		expect(excluded.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "test/fixtures/vault/sources/demo-article.md",
					action: "excluded",
					recovery: expect.objectContaining({ issueCode: "framework.user-content-target" }),
				}),
			]),
		);
		expectIssueCodes(excluded.issues).toInclude(["framework.invalid-input", "framework.user-content-target"]);

		expect(conflict.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "AGENTS.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "path-collision" }),
				}),
				expect.objectContaining({
					path: "src/agent/runtime-command-handlers.exe",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "unsupported-path" }),
				}),
			]),
		);
		expectIssueCodes(conflict.issues).toInclude(["framework.path-collision", "framework.unsupported-path"]);

		expect(unsafe.actions).toEqual([
			expect.objectContaining({
				action: "conflict",
				conflict: expect.objectContaining({ kind: "unsafe-content" }),
				recovery: expect.objectContaining({ issueCode: "framework.unsafe-content" }),
			}),
		]);
		expectIssueCodes(unsafe.issues).toInclude(["framework.unsafe-content"]);
		expectNoPrivateSentinels(unsafe);

		expect(readFailure.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "AGENTS.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "current-file-read-failed" }),
				}),
				expect.objectContaining({
					path: "docs/missing-framework-file.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "missing-comparison-input" }),
				}),
			]),
		);
		expectIssueCodes(readFailure.issues).toInclude([
			"framework.current-file-read-failed",
			"framework.invalid-input",
		]);
	});
});

describe("Phase 02 maintenance and similar-note suggestion integration", () => {
	it("stages recommendation and suggestion outputs with citations, affected paths, confidence, and no direct vault writes", async () => {
		const maintenanceFixtures = createPhase02MaintenanceFixtureSet();
		const maintenancePlanner = new MaintenanceRecommendationPlanner({ now: fixedNow });
		const maintenancePlan = maintenancePlanner.plan(maintenanceFixtures.planInput);
		const missingCitation = requiredMaintenanceRecommendation(
			maintenancePlan.recommendations,
			(recommendation) => recommendation.category === "missing-citation",
			"stageable missing citation",
		);

		expect(missingCitation).toMatchObject({
			confidence: "high",
			stageability: {
				kind: "stageable",
				commandId: "voidbrain.health-check",
			},
			recovery: {
				commandId: "voidbrain.health-check",
				reportId: "maintenance-health-report",
			},
		});
		expect(missingCitation.affectedPaths.length).toBeGreaterThan(0);
		expect(missingCitation.evidence.length).toBeGreaterThan(0);
		expectNoPrivateSentinels(maintenancePlan);

		const stagedRecommendation = await maintenancePlanner.stageRecommendation({
			plan: maintenancePlan,
			recommendationId: missingCitation.recommendationId,
			report: maintenanceFixtures.stageInput.report,
			existingNotes: maintenanceFixtures.stageInput.existingNotes,
			existingStagedChanges: maintenanceFixtures.stageInput.existingStagedChanges,
		});

		expect(stagedRecommendation).toMatchObject({
			ok: true,
			targetPath: missingCitation.stageability.targetPath,
			recovery: expect.objectContaining({
				commandId: "voidbrain.health-check",
				reportId: "maintenance-health-report",
			}),
		});
		if (!stagedRecommendation.ok) {
			throw new Error(stagedRecommendation.message);
		}
		expect(stagedRecommendation.stagedChange.status).toBe("review-ready");
		expect(stagedRecommendation.stagedChange.operationKind).toBe("update-frontmatter");

		await expect(
			maintenancePlanner.stageRecommendation({
				plan: maintenancePlan,
				recommendationId: missingCitation.recommendationId,
				report: maintenanceFixtures.stageInput.report,
				existingNotes: maintenanceFixtures.stageInput.existingNotes,
				existingStagedChanges: [stagedRecommendation.stagedChange],
			}),
		).resolves.toMatchObject({
			ok: false,
			reason: "active-staged-change",
			recovery: expect.objectContaining({ stagedChangeId: stagedRecommendation.stagedChangeId }),
		});

		const similarFixtures = createPhase02SimilarNoteFixtureSet();
		const similarPlan = planSimilarNoteSuggestions(similarFixtures.planInput);
		const wikilinkSuggestion = requiredSuggestion(
			similarPlan.suggestions,
			(suggestion) => suggestion.kind === "wikilink" && suggestion.stageability.kind === "stageable",
			"stageable wikilink",
		);
		const lowConfidence = requiredSuggestion(
			similarPlan.suggestions,
			(suggestion) => suggestion.confidence === "low",
			"low-confidence report-only suggestion",
		);

		expect(wikilinkSuggestion).toMatchObject({
			confidence: expect.stringMatching(/^(high|medium)$/),
			stageability: {
				kind: "stageable",
				commandId: "voidbrain.stage-change",
			},
		});
		expect(similarPlan.summary.affectedPaths).toContain(wikilinkSuggestion.targetPath);
		expect(wikilinkSuggestion.evidence.length).toBeGreaterThan(0);
		expect(wikilinkSuggestion.sourceRecords.length).toBeGreaterThan(0);
		expect(lowConfidence.stageability.kind).toBe("report-only");
		expectNoPrivateSentinels(similarPlan);

		const stagedSuggestion = await new SimilarNoteSuggestionService({ now: fixedNow }).stageSuggestion({
			plan: similarPlan,
			suggestionId: wikilinkSuggestion.suggestionId,
			existingNotes: similarFixtures.stageInput.existingNotes,
			existingStagedChanges: similarFixtures.stageInput.existingStagedChanges,
		});

		expect(stagedSuggestion).toMatchObject({
			ok: true,
			targetPath: wikilinkSuggestion.targetPath,
			recovery: expect.objectContaining({
				commandId: "voidbrain.stage-change",
			}),
		});
		if (!stagedSuggestion.ok) {
			throw new Error(stagedSuggestion.message);
		}
		expect(stagedSuggestion.stagedChange.status).toBe("review-ready");
		expect(stagedSuggestion.stagedChange.operationKind).toBe("update-note");
	});
});

describe("Phase 02 batch source ingestion integration", () => {
	it("keeps queue ordering bounded, provider-reviewed, cancelable, retryable, staged, failed, and redacted", async () => {
		const queueFixtures = createPhase02QueueFixtureSet();
		let activeWorkers = 0;
		let maxWorkers = 0;
		const staging = new SourceIngestionStagingService({ now: fixedNow });
		const safeService = new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: async (request) => {
				activeWorkers += 1;
				maxWorkers = Math.max(maxWorkers, activeWorkers);
				await Promise.resolve();
				const result = await staging.stageSource(request);
				activeWorkers -= 1;
				return result;
			},
		});

		const safe = await safeService.runQueue({
			queueId: "phase02-safe-batch",
			items: [queueFixtures.safeMarkdown, queueFixtures.safeUrl],
			concurrency: 2,
		});

		expect(maxWorkers).toBeLessThanOrEqual(2);
		expect(safe.summary.counts).toMatchObject({
			total: 2,
			staged: 2,
			failed: 0,
			canceled: 0,
		});
		expect(safe.summary.items.map((item) => item.index)).toEqual([0, 1]);
		expect(safe.summary.stagedChangeIds.length).toBe(safe.stagedChanges.length);
		expect(safe.stagedChanges.every((change) => change.status === "review-ready")).toBe(true);
		expectNoPrivateSentinels(safe.summary);

		const providerDenied = await new SourceIngestionQueueService({ now: fixedNow }).runQueue({
			queueId: "phase02-provider-denied",
			items: queueFixtures.providerDenied,
		});
		expect(providerDenied.stagedChanges).toHaveLength(0);
		expect(providerDenied.summary.counts).toMatchObject({
			failed: 1,
			providerBlocked: 1,
			retryable: 1,
		});
		expect(providerDenied.summary.items[0]).toMatchObject({
			status: "failed",
			failureCode: "ingestion.provider-denied",
			providerDecision: {
				kind: "denied",
				allowed: false,
			},
		});

		const partial = await new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: (request) =>
				request.input === queueFixtures.citationFailure.input
					? stageFailureFor(
							request,
							"ingestion.citation-invalid",
							"Synthetic Phase 02 citation check failed.",
						)
					: staging.stageSource(request),
		}).runQueue({
			queueId: "phase02-partial-failure",
			items: queueFixtures.partialFailure,
			concurrency: 2,
		});

		expect(partial.summary.status).toBe("failed");
		expect(partial.summary.counts).toMatchObject({
			staged: 2,
			failed: 1,
			citationBlocked: 1,
			retryable: 1,
		});
		expect(partial.summary.items.find((item) => item.status === "failed")).toMatchObject({
			failureCode: "ingestion.citation-invalid",
			citationState: "invalid",
			recovery: expect.objectContaining({
				commandId: "voidbrain.ingest-source",
				validationOutput: [expect.objectContaining({ code: "record.invalid-state" })],
			}),
		});
		expectNoPrivateSentinels(partial.summary);

		let releaseRunning: (() => void) | undefined;
		let markStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const running = new Promise<void>((resolve) => {
			releaseRunning = resolve;
		});
		const cancelableService = new SourceIngestionQueueService({
			now: fixedNow,
			stageSource: async (request) => {
				markStarted?.();
				await running;
				if (request.signal?.aborted === true) {
					return stageFailureFor(request, "ingestion.canceled", "Synthetic Phase 02 queue item canceled.");
				}

				return staging.stageSource(request);
			},
		});
		const queued = cancelableService.runQueue({
			queueId: "phase02-cancel",
			items: queueFixtures.cancelAndRetry,
			concurrency: 1,
		});

		await started;
		const cancel = cancelableService.cancelQueue("phase02-cancel");
		releaseRunning?.();
		const canceled = await queued;

		expect(cancel.ok).toBe(true);
		expect(canceled.summary.counts.canceled).toBe(2);
		expect(canceled.summary.stagedChangeIds).toHaveLength(0);

		const retried = await cancelableService.retryItems({
			sourceQueueId: canceled.summary.queueId,
			items: [queueFixtures.safeMarkdown],
		});
		expect(retried.summary.queueId).toContain("phase02-cancel-retry");
		expect(retried.summary.counts.staged).toBe(1);
		expectNoPrivateSentinels(retried.summary);
	});
});
