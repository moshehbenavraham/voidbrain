import type { VoidbrainPluginSettings } from "../types/plugin";
import type {
	ProviderRoleCapabilitySummary,
	ProviderSetupSummary,
	ProviderTroubleshootingAction,
	ProviderTroubleshootingActionKind,
	ProviderTroubleshootingDiagnostic,
	ProviderTroubleshootingDiagnosticKind,
	ProviderTroubleshootingRecovery,
	ProviderTroubleshootingReport,
	ProviderTroubleshootingSafeDiagnostic,
	ProviderTroubleshootingSeverity,
} from "../types/provider-setup";
import type { ModelRole, ProviderDefinition, ProviderId, ProviderModelId } from "../types/providers";
import { assertNeverProviderValue } from "../types/providers";
import type { SemanticIndexCompatibility } from "../types/retrieval";
import { type IsoTimestamp, type NormalizedVaultPath, makeIsoTimestamp } from "../types/vault";
import { findProvider } from "./capability-selection";
import { summarizeProviderRoleCapabilities, summarizeProviderSetup } from "./provider-preflight";

export const PROVIDER_TROUBLESHOOTING_COMMAND_ID = "voidbrain.provider-troubleshooting";
export const PROVIDER_TROUBLESHOOTING_DEFAULT_REPORT_ID = "provider-troubleshooting-runtime-report";

export interface ProviderTroubleshootingInput {
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly ProviderDefinition[];
	readonly providerSetup?: ProviderSetupSummary;
	readonly providerRoleCapabilities?: readonly ProviderRoleCapabilitySummary[];
	readonly semanticCompatibility?: SemanticIndexCompatibility | null;
	readonly cachePath?: NormalizedVaultPath | null;
	readonly reportId?: string | null;
	readonly validationOutput?: readonly string[];
	readonly now?: Date;
}

interface DiagnosticInput {
	readonly kind: ProviderTroubleshootingDiagnosticKind;
	readonly severity: ProviderTroubleshootingSeverity;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly role?: ModelRole | null;
	readonly readinessCode?: string | null;
	readonly message: string;
	readonly sourcePathCount?: number;
}

interface ActionInput {
	readonly kind: ProviderTroubleshootingActionKind;
	readonly severity: ProviderTroubleshootingSeverity;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly role?: ModelRole | null;
	readonly disabledReason?: string;
}

const severityRank: Readonly<Record<ProviderTroubleshootingSeverity, number>> = {
	error: 0,
	warning: 1,
	missing: 2,
	ready: 3,
};

const actionRank: Readonly<Record<ProviderTroubleshootingActionKind, number>> = {
	"retest-auth": 0,
	"retry-provider-setup": 1,
	"reset-provider-state": 2,
	"review-disclosure": 3,
	"refresh-index": 4,
	"inspect-recovery": 5,
};

const validationSecretPatterns: readonly RegExp[] = [
	/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi,
	/\bsk-[A-Za-z0-9_-]{8,}\b/gi,
	/\b(api[_-]?key|password|secret|token)=([^&\s]+)/gi,
	/\/home\/[^\s]+/gi,
];

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const worseSeverity = (
	left: ProviderTroubleshootingSeverity,
	right: ProviderTroubleshootingSeverity,
): ProviderTroubleshootingSeverity => (severityRank[left] <= severityRank[right] ? left : right);

const severityForSemanticCompatibility = (
	compatibility: SemanticIndexCompatibility,
): ProviderTroubleshootingSeverity => {
	if (compatibility.semanticSearchEligible || compatibility.state === "disabled") {
		return "ready";
	}

	if (compatibility.fallbackMode === "lexical") {
		return "warning";
	}

	switch (compatibility.state) {
		case "missing":
			return "missing";
		case "stale":
		case "canceled":
			return "warning";
		case "incompatible":
		case "provider-blocked":
		case "offline":
			return "error";
		case "ready":
			return "ready";
		default: {
			const exhaustive: never = compatibility.state;
			throw new Error(`Unhandled semantic compatibility state: ${String(exhaustive)}`);
		}
	}
};

const sanitizeValidationLine = (value: string): string => {
	let sanitized = value.trim();
	for (const pattern of validationSecretPatterns) {
		sanitized = sanitized.replace(pattern, "[REDACTED]");
	}

	return sanitized.slice(0, 240);
};

const sanitizeValidationOutput = (validationOutput: readonly string[]): readonly string[] =>
	validationOutput
		.map(sanitizeValidationLine)
		.filter((line) => line.length > 0)
		.slice(0, 20);

export const createProviderTroubleshootingRecovery = (input: {
	readonly commandId?: string;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly readinessCode?: string | null;
	readonly cachePath?: NormalizedVaultPath | null;
	readonly reportId?: string | null;
	readonly sourcePathCount?: number;
	readonly validationOutput?: readonly string[];
}): ProviderTroubleshootingRecovery => ({
	commandId: input.commandId ?? PROVIDER_TROUBLESHOOTING_COMMAND_ID,
	providerId: input.providerId ?? null,
	modelId: input.modelId ?? null,
	readinessCode: input.readinessCode ?? null,
	cachePath: input.cachePath ?? null,
	reportId: input.reportId ?? null,
	sourcePathCount: Math.max(0, input.sourcePathCount ?? 0),
	validationOutput: sanitizeValidationOutput(input.validationOutput ?? []),
});

export const createProviderTroubleshootingSafeDiagnostic = (input: {
	readonly commandId?: string;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly role?: ModelRole | null;
	readonly readinessCode?: string | null;
	readonly cachePath?: NormalizedVaultPath | null;
	readonly reportId?: string | null;
	readonly sourcePathCount?: number;
	readonly validationOutput?: readonly string[];
}): ProviderTroubleshootingSafeDiagnostic => ({
	commandId: input.commandId ?? PROVIDER_TROUBLESHOOTING_COMMAND_ID,
	providerId: input.providerId ?? null,
	modelId: input.modelId ?? null,
	role: input.role ?? null,
	readinessCode: input.readinessCode ?? null,
	cachePath: input.cachePath ?? null,
	reportId: input.reportId ?? null,
	sourcePathCount: Math.max(0, input.sourcePathCount ?? 0),
	validationOutput: sanitizeValidationOutput(input.validationOutput ?? []),
});

const diagnosticId = (input: DiagnosticInput): string =>
	[
		input.kind,
		input.severity,
		input.providerId ?? "none",
		input.modelId ?? "none",
		input.role ?? "none",
		input.readinessCode ?? "none",
	]
		.join(":")
		.toLowerCase();

const createDiagnostic = (
	input: DiagnosticInput,
	context: {
		readonly cachePath: NormalizedVaultPath | null;
		readonly reportId: string;
		readonly validationOutput: readonly string[];
	},
): ProviderTroubleshootingDiagnostic => ({
	id: diagnosticId(input),
	kind: input.kind,
	severity: input.severity,
	providerId: input.providerId ?? null,
	modelId: input.modelId ?? null,
	role: input.role ?? null,
	readinessCode: input.readinessCode ?? null,
	message: input.message,
	safeDiagnostic: createProviderTroubleshootingSafeDiagnostic({
		providerId: input.providerId ?? null,
		modelId: input.modelId ?? null,
		role: input.role ?? null,
		readinessCode: input.readinessCode ?? null,
		cachePath: context.cachePath,
		reportId: context.reportId,
		sourcePathCount: input.sourcePathCount ?? 0,
		validationOutput: context.validationOutput,
	}),
});

const actionLabel = (kind: ProviderTroubleshootingActionKind): string => {
	switch (kind) {
		case "retest-auth":
			return "Retest provider auth";
		case "retry-provider-setup":
			return "Retry provider setup";
		case "reset-provider-state":
			return "Reset provider status";
		case "review-disclosure":
			return "Review cloud disclosure";
		case "refresh-index":
			return "Refresh index readiness";
		case "inspect-recovery":
			return "Inspect recovery details";
		default:
			return assertNeverProviderValue(kind);
	}
};

const actionDescription = (kind: ProviderTroubleshootingActionKind): string => {
	switch (kind) {
		case "retest-auth":
			return "Run the existing provider setup test again and replace stale auth readiness records.";
		case "retry-provider-setup":
			return "Recompute provider setup, role capability, and runtime readiness state.";
		case "reset-provider-state":
			return "Clear stale provider auth and role readiness state without deleting opaque secret references.";
		case "review-disclosure":
			return "Review explicit cloud disclosure, trust, auth, and capability gates before cloud use.";
		case "refresh-index":
			return "Refresh lexical and semantic index readiness after provider compatibility changes.";
		case "inspect-recovery":
			return "Inspect bounded command, provider, model, cache, report, and validation recovery fields.";
		default:
			return assertNeverProviderValue(kind);
	}
};

const createAction = (input: ActionInput): ProviderTroubleshootingAction => ({
	id: [
		input.kind,
		input.providerId ?? "none",
		input.modelId ?? "none",
		input.role ?? "none",
		input.disabledReason ?? "enabled",
	].join(":"),
	kind: input.kind,
	severity: input.severity,
	label: actionLabel(input.kind),
	description: actionDescription(input.kind),
	providerId: input.providerId ?? null,
	modelId: input.modelId ?? null,
	role: input.role ?? null,
	...(input.disabledReason === undefined ? {} : { disabledReason: input.disabledReason }),
});

const addAction = (actions: ProviderTroubleshootingAction[], input: ActionInput): void => {
	const action = createAction(input);
	const duplicate = actions.some(
		(candidate) =>
			candidate.kind === action.kind &&
			candidate.providerId === action.providerId &&
			candidate.modelId === action.modelId &&
			candidate.role === action.role,
	);

	if (!duplicate) {
		actions.push(action);
	}
};

const sortActions = (actions: readonly ProviderTroubleshootingAction[]): readonly ProviderTroubleshootingAction[] =>
	[...actions].sort((left, right) => {
		const kindComparison = actionRank[left.kind] - actionRank[right.kind];
		if (kindComparison !== 0) {
			return kindComparison;
		}

		const severityComparison = severityRank[left.severity] - severityRank[right.severity];
		if (severityComparison !== 0) {
			return severityComparison;
		}

		return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
	});

const selectedProviderIds = (settings: VoidbrainPluginSettings): readonly ProviderId[] =>
	[
		settings.providerRoles.chat.providerId,
		settings.providerRoles.embedding.providerId,
		settings.providerRoles.utility.providerId,
	].filter((providerId): providerId is ProviderId => providerId !== null);

const roleSummariesWithProblems = (
	roleSummaries: readonly ProviderRoleCapabilitySummary[],
): readonly ProviderRoleCapabilitySummary[] =>
	roleSummaries.filter(
		(summary) =>
			summary.status === "provider-missing" ||
			summary.status === "model-missing" ||
			summary.status === "capability-mismatch" ||
			summary.status === "readiness-not-ready",
	);

const setupDiagnosticMessage = (setupSummary: ProviderSetupSummary): string => {
	if (setupSummary.providerCount === 0) {
		return "No providers are registered for provider-backed workflows.";
	}

	if (setupSummary.roleSelectionCount === 0) {
		return "No provider role is selected for provider-backed workflows.";
	}

	return "Provider setup has warning-level readiness gaps.";
};

const semanticActionKind = (compatibility: SemanticIndexCompatibility): ProviderTroubleshootingActionKind => {
	switch (compatibility.guidance.action) {
		case "none":
			return "inspect-recovery";
		case "review-provider-setup":
			return "retry-provider-setup";
		case "refresh-lexical-index":
		case "rebuild-semantic-index":
			return "refresh-index";
		default: {
			const exhaustive: never = compatibility.guidance.action;
			throw new Error(`Unhandled semantic guidance action: ${String(exhaustive)}`);
		}
	}
};

export const orderProviderTroubleshootingActions = (
	actions: readonly ProviderTroubleshootingAction[],
): readonly ProviderTroubleshootingAction[] => sortActions(actions);

export const composeProviderTroubleshootingReport = (
	input: ProviderTroubleshootingInput,
): ProviderTroubleshootingReport => {
	const reportId = input.reportId ?? PROVIDER_TROUBLESHOOTING_DEFAULT_REPORT_ID;
	const generatedAt = toIsoTimestamp(input.now ?? new Date());
	const setupSummary = input.providerSetup ?? summarizeProviderSetup(input.settings, input.providers);
	const roleSummaries =
		input.providerRoleCapabilities ?? summarizeProviderRoleCapabilities(input.settings, input.providers);
	const context = {
		cachePath: input.cachePath ?? null,
		reportId,
		validationOutput: input.validationOutput ?? [],
	};
	const diagnostics: ProviderTroubleshootingDiagnostic[] = [];
	const actions: ProviderTroubleshootingAction[] = [];
	const selectedIds = selectedProviderIds(input.settings);

	if (setupSummary.severity === "missing" || setupSummary.severity === "warning") {
		diagnostics.push(
			createDiagnostic(
				{
					kind: "setup",
					severity: setupSummary.severity,
					readinessCode:
						setupSummary.roleSelectionCount === 0 ? "provider-role-not-selected" : "provider-setup-warning",
					message: setupDiagnosticMessage(setupSummary),
				},
				context,
			),
		);
		addAction(actions, {
			kind: "retry-provider-setup",
			severity: setupSummary.severity,
		});
	}

	for (const authStatus of input.settings.providerAuthStatuses) {
		if (authStatus.status === "passed" || authStatus.status === "untested") {
			continue;
		}

		const readinessCode =
			authStatus.openaiCompatibleReadiness?.code ??
			authStatus.localRuntimeReadiness?.code ??
			(authStatus.status === "running" ? "auth-running" : authStatus.status);
		const severity: ProviderTroubleshootingSeverity = authStatus.status === "running" ? "warning" : "error";
		diagnostics.push(
			createDiagnostic(
				{
					kind: "auth",
					severity,
					providerId: authStatus.providerId,
					readinessCode,
					message: `Provider auth status is ${authStatus.status} (${readinessCode}).`,
				},
				context,
			),
		);
		addAction(actions, {
			kind: "retest-auth",
			severity,
			providerId: authStatus.providerId,
		});
		addAction(actions, {
			kind: "reset-provider-state",
			severity,
			providerId: authStatus.providerId,
		});
	}

	for (const authStatus of input.settings.providerAuthStatuses) {
		const readiness = authStatus.localRuntimeReadiness;
		if (readiness !== undefined && readiness.code !== "ready") {
			const severity: ProviderTroubleshootingSeverity =
				readiness.status === "warning" || readiness.code === "not-checked" ? "warning" : "error";
			diagnostics.push(
				createDiagnostic(
					{
						kind: "local-runtime",
						severity,
						providerId: readiness.providerId,
						readinessCode: readiness.code,
						message: `Local runtime readiness is ${readiness.status} (${readiness.code}).`,
					},
					context,
				),
			);
			addAction(actions, {
				kind: "retry-provider-setup",
				severity,
				providerId: readiness.providerId,
			});
		}

		const openaiReadiness = authStatus.openaiCompatibleReadiness;
		if (openaiReadiness !== undefined && openaiReadiness.code !== "ready") {
			const severity: ProviderTroubleshootingSeverity =
				openaiReadiness.status === "untested" || openaiReadiness.code === "not-checked" ? "warning" : "error";
			diagnostics.push(
				createDiagnostic(
					{
						kind: "openai-compatible",
						severity,
						providerId: openaiReadiness.providerId,
						readinessCode: openaiReadiness.code,
						message: `OpenAI-compatible readiness is ${openaiReadiness.status} (${openaiReadiness.code}).`,
					},
					context,
				),
			);
			addAction(actions, {
				kind: "retest-auth",
				severity,
				providerId: openaiReadiness.providerId,
			});
		}
	}

	for (const summary of roleSummariesWithProblems(roleSummaries)) {
		diagnostics.push(
			createDiagnostic(
				{
					kind: "role-capability",
					severity: "error",
					providerId: summary.providerId,
					modelId: summary.modelId,
					role: summary.role,
					readinessCode: summary.status,
					message: summary.message,
				},
				context,
			),
		);
		addAction(actions, {
			kind: summary.status === "readiness-not-ready" ? "retry-provider-setup" : "reset-provider-state",
			severity: "error",
			providerId: summary.providerId,
			modelId: summary.modelId,
			role: summary.role,
		});
	}

	for (const providerId of selectedIds) {
		const provider = findProvider(input.providers, providerId);
		if (provider === undefined || provider.kind !== "cloud") {
			continue;
		}

		if (!input.settings.areCloudProvidersEnabled) {
			diagnostics.push(
				createDiagnostic(
					{
						kind: "disclosure",
						severity: "warning",
						providerId,
						readinessCode: "cloud-disabled",
						message: "Cloud provider workflows are disabled until explicit disclosure review is complete.",
					},
					context,
				),
			);
			addAction(actions, {
				kind: "review-disclosure",
				severity: "warning",
				providerId,
			});
			continue;
		}

		if (provider.trustLevel !== "trusted-cloud" || !input.settings.trustedProviderIds.includes(providerId)) {
			diagnostics.push(
				createDiagnostic(
					{
						kind: "disclosure",
						severity: provider.trustLevel === "trusted-cloud" ? "warning" : "error",
						providerId,
						readinessCode: "provider-not-trusted",
						message: "Selected cloud provider still requires trust and disclosure review.",
					},
					context,
				),
			);
			addAction(actions, {
				kind: "review-disclosure",
				severity: provider.trustLevel === "trusted-cloud" ? "warning" : "error",
				providerId,
			});
		}
	}

	if (
		input.semanticCompatibility !== null &&
		input.semanticCompatibility !== undefined &&
		!input.semanticCompatibility.semanticSearchEligible &&
		input.semanticCompatibility.state !== "disabled"
	) {
		const semanticSeverity = severityForSemanticCompatibility(input.semanticCompatibility);
		diagnostics.push(
			createDiagnostic(
				{
					kind: "semantic-compatibility",
					severity: semanticSeverity,
					providerId: input.semanticCompatibility.providerId,
					modelId: input.semanticCompatibility.modelId,
					readinessCode: input.semanticCompatibility.code,
					message: `${input.semanticCompatibility.message} Fallback: ${input.semanticCompatibility.fallbackMode}.`,
					sourcePathCount: input.semanticCompatibility.sourcePathCounts.current,
				},
				context,
			),
		);
		addAction(actions, {
			kind: semanticActionKind(input.semanticCompatibility),
			severity: semanticSeverity,
			providerId: input.semanticCompatibility.providerId,
			modelId: input.semanticCompatibility.modelId,
		});
	}

	if (diagnostics.length > 0) {
		addAction(actions, {
			kind: "inspect-recovery",
			severity: diagnostics.map((diagnostic) => diagnostic.severity).reduce(worseSeverity, "ready"),
		});
	}

	const sortedDiagnostics = [...diagnostics].sort((left, right) => {
		const severityComparison = severityRank[left.severity] - severityRank[right.severity];
		if (severityComparison !== 0) {
			return severityComparison;
		}

		return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
	});
	const severity =
		sortedDiagnostics.length === 0
			? "ready"
			: sortedDiagnostics.map((diagnostic) => diagnostic.severity).reduce(worseSeverity, "ready");
	const firstDiagnostic = sortedDiagnostics[0];
	const semanticSourceCount = input.semanticCompatibility?.sourcePathCounts.current ?? 0;
	const sourcePathCount = Math.max(
		semanticSourceCount,
		...sortedDiagnostics.map((diagnostic) => diagnostic.safeDiagnostic.sourcePathCount),
	);
	const recovery = createProviderTroubleshootingRecovery({
		providerId: firstDiagnostic?.providerId ?? input.semanticCompatibility?.providerId ?? null,
		modelId: firstDiagnostic?.modelId ?? input.semanticCompatibility?.modelId ?? null,
		readinessCode: firstDiagnostic?.readinessCode ?? input.semanticCompatibility?.code ?? null,
		cachePath: context.cachePath,
		reportId,
		sourcePathCount,
		validationOutput: input.semanticCompatibility?.recovery.validationOutput ?? context.validationOutput,
	});
	const roleProblemCount = roleSummariesWithProblems(roleSummaries).length;
	const cloudDisclosureRequired = selectedIds.some((providerId) => {
		const provider = findProvider(input.providers, providerId);
		return (
			provider?.kind === "cloud" || provider?.setupMetadata?.openaiCompatible?.isRemoteDisclosureRequired === true
		);
	});
	const isCloudProviderBlocked = sortedDiagnostics.some(
		(diagnostic) =>
			diagnostic.readinessCode === "cloud-disabled" ||
			diagnostic.readinessCode === "provider-not-trusted" ||
			diagnostic.readinessCode === "private-content-cloud-denied",
	);
	const summary =
		severity === "ready"
			? "Provider troubleshooting did not find blocking auth, disclosure, capability, or semantic compatibility issues."
			: severity === "error"
				? "Provider troubleshooting found blocking provider readiness issues."
				: severity === "missing"
					? "Provider troubleshooting needs provider setup before workflows can run."
					: "Provider troubleshooting found recoverable provider warnings.";

	return {
		reportId,
		generatedAt,
		severity,
		summary,
		providerCount: setupSummary.providerCount,
		roleProblemCount,
		cloudDisclosureRequired,
		isCloudProviderBlocked,
		diagnostics: sortedDiagnostics,
		actions: sortActions(actions),
		recovery,
	};
};
