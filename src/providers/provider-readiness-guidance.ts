import type { VoidbrainPluginSettings } from "../types/plugin";
import {
	PROVIDER_READINESS_GATE_KINDS,
	type ProviderReadinessAction,
	type ProviderReadinessActionKind,
	type ProviderReadinessBlocker,
	type ProviderReadinessBlockerCode,
	type ProviderReadinessCopy,
	type ProviderReadinessFallbackMode,
	type ProviderReadinessFallbackSummary,
	type ProviderReadinessGate,
	type ProviderReadinessGateKind,
	type ProviderReadinessGateStatus,
	type ProviderReadinessGuidance,
	type ProviderReadinessGuidanceInput,
	type ProviderReadinessPathClass,
	type ProviderReadinessPathGuidance,
	type ProviderReadinessProviderParseResult,
	type ProviderReadinessRecoveryFields,
	type ProviderReadinessSafetyIssue,
	type ProviderReadinessSafetyResult,
	type ProviderReadinessValidationError,
	toProviderReadinessFallbackMode,
} from "../types/provider-readiness-guidance";
import type {
	LocalRuntimeReadinessRecord,
	OpenAICompatibleAuthReadinessRecord,
	ProviderAuthTestRecord,
	ProviderRoleCapabilitySummary,
	ProviderSetupSeverity,
	ProviderSetupSummary,
	ProviderTroubleshootingReport,
} from "../types/provider-setup";
import { isOpenAICompatibleEndpointClassification } from "../types/provider-setup";
import type {
	ModelRole,
	ProviderAuthState,
	ProviderDefinition,
	ProviderId,
	ProviderKind,
	ProviderModelId,
	ProviderTrustLevel,
} from "../types/providers";
import { assertNeverProviderValue, isProviderKind, isProviderTrustLevel } from "../types/providers";
import type { SemanticIndexCompatibility } from "../types/retrieval";
import type { NormalizedVaultPath } from "../types/vault";
import { summarizeProviderRoleCapabilities, summarizeProviderSetup } from "./provider-preflight";
import { composeProviderTroubleshootingReport } from "./provider-troubleshooting";
import { isSecretLikeKey } from "./redaction";

export const PROVIDER_READINESS_GUIDANCE_COMMAND_ID = "voidbrain.provider-readiness-guidance";
export const PROVIDER_READINESS_GUIDANCE_DEFAULT_REPORT_ID = "provider-readiness-guidance-report";

type UnknownRecord = Record<string, unknown>;

interface GuidanceContext {
	readonly settings: VoidbrainPluginSettings;
	readonly setupSummary: ProviderSetupSummary;
	readonly roleSummaries: readonly ProviderRoleCapabilitySummary[];
	readonly troubleshooting: ProviderTroubleshootingReport;
	readonly semanticCompatibility: SemanticIndexCompatibility | null;
	readonly cachePath: NormalizedVaultPath | null;
	readonly reportId: string;
	readonly validationOutput: readonly string[];
}

interface GateInput {
	readonly kind: ProviderReadinessGateKind;
	readonly status: ProviderReadinessGateStatus;
	readonly required: boolean;
	readonly label: string;
	readonly description: string;
	readonly readinessCode?: string | null;
}

const severityRank: Readonly<Record<ProviderSetupSeverity, number>> = {
	error: 0,
	warning: 1,
	missing: 2,
	ready: 3,
};

const pathRank: Readonly<Record<ProviderReadinessPathClass, number>> = {
	"local-runtime": 0,
	"openai-compatible-local": 1,
	"custom-remote": 2,
	"trusted-cloud": 3,
	"untrusted-cloud": 4,
};

const actionRank: Readonly<Record<ProviderReadinessActionKind, number>> = {
	"test-provider": 0,
	"retry-provider-setup": 1,
	"reset-provider-state": 2,
	"review-disclosure": 3,
	"trust-provider": 4,
	"select-role": 5,
	"refresh-index": 6,
	"inspect-recovery": 7,
};

const validationSecretPatterns: readonly RegExp[] = [
	/\bBearer\s+[A-Za-z0-9._~+/-]{8,}\b/gi,
	/\bsk-[A-Za-z0-9_-]{8,}\b/gi,
	/\b(api[_-]?key|password|secret|token)=([^&\s]+)/gi,
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/gi,
];

const credentialLikeValuePattern =
	/\b(Bearer\s+[A-Za-z0-9._~+/-]{8,}|sk-[A-Za-z0-9_-]{8,}|(api[_-]?key|password|secret|token)=([^&\s]+))\b/i;
const privatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;
const promptBodyHintPattern = /\b(raw prompt|prompt body|raw note body|model response body)\b/i;
const hiddenStateHintPattern = /\b(hidden provider state|hidden-runtime-state|raw hidden state)\b/i;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const compareStrings = (left: string, right: string): number =>
	left.localeCompare(right, "en", { sensitivity: "base" });

const worseSeverity = (left: ProviderSetupSeverity, right: ProviderSetupSeverity): ProviderSetupSeverity =>
	severityRank[left] <= severityRank[right] ? left : right;

const validationError = (
	code: ProviderReadinessValidationError["code"],
	field: string,
	message: string,
): ProviderReadinessValidationError => ({ code, field, message });

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

const containsUnsafeProviderState = (value: unknown): boolean => containsUnsafeProviderStateAt(value, new Set());

const containsUnsafeProviderStateAt = (value: unknown, seen: Set<unknown>): boolean => {
	if (typeof value === "string") {
		return (
			credentialLikeValuePattern.test(value) ||
			promptBodyHintPattern.test(value) ||
			hiddenStateHintPattern.test(value)
		);
	}

	if (value === null || value === undefined || typeof value !== "object") {
		return false;
	}

	if (seen.has(value)) {
		return false;
	}
	seen.add(value);

	if (Array.isArray(value)) {
		return value.some((item) => containsUnsafeProviderStateAt(item, seen));
	}

	if (!isRecord(value)) {
		return false;
	}

	for (const [key, child] of Object.entries(value)) {
		if (isSecretLikeKey(key) || promptBodyHintPattern.test(key) || hiddenStateHintPattern.test(key)) {
			return true;
		}

		if (containsUnsafeProviderStateAt(child, seen)) {
			return true;
		}
	}

	return false;
};

export const parseProviderReadinessProvider = (input: unknown, index = 0): ProviderReadinessProviderParseResult => {
	const errors: ProviderReadinessValidationError[] = [];
	const prefix = `providers[${index}]`;

	if (!isRecord(input)) {
		return {
			ok: false,
			errors: [validationError("invalid-provider", prefix, "Provider readiness input must be an object.")],
		};
	}

	const id = input.id;
	const displayName = input.displayName;
	const kind = input.kind;
	const trustLevel = input.trustLevel;
	const models = input.models;

	if (typeof id !== "string" || id.trim().length === 0) {
		errors.push(validationError("invalid-provider", `${prefix}.id`, "Provider ID must be a non-empty string."));
	}

	if (typeof displayName !== "string" || displayName.trim().length === 0) {
		errors.push(
			validationError(
				"invalid-provider",
				`${prefix}.displayName`,
				"Provider display name must be a non-empty string.",
			),
		);
	}

	if (!isProviderKind(kind)) {
		errors.push(validationError("invalid-provider-kind", `${prefix}.kind`, "Provider kind is not supported."));
	}

	if (!isProviderTrustLevel(trustLevel)) {
		errors.push(
			validationError("invalid-provider-trust", `${prefix}.trustLevel`, "Provider trust level is not supported."),
		);
	}

	if (!Array.isArray(models)) {
		errors.push(validationError("invalid-model", `${prefix}.models`, "Provider models must be an array."));
	} else {
		for (const [modelIndex, model] of models.entries()) {
			if (!isRecord(model) || typeof model.id !== "string" || typeof model.displayName !== "string") {
				errors.push(
					validationError(
						"invalid-model",
						`${prefix}.models[${modelIndex}]`,
						"Provider model must expose bounded ID and display name fields.",
					),
				);
			}
		}
	}

	if (containsUnsafeProviderState(input)) {
		errors.push(
			validationError(
				"unsafe-provider-state",
				`${prefix}.root`,
				"Provider readiness input contains secret, prompt, hidden state, or credential-like data.",
			),
		);
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		provider: input as unknown as ProviderDefinition,
	};
};

export const classifyProviderReadinessPath = (provider: ProviderDefinition): ProviderReadinessPathClass => {
	const classification = provider.setupMetadata?.openaiCompatible?.endpointClassification;

	if (isOpenAICompatibleEndpointClassification(classification)) {
		switch (classification) {
			case "local-compatible":
				return "openai-compatible-local";
			case "custom-remote":
				return "custom-remote";
			case "trusted-cloud":
				return "trusted-cloud";
			case "untrusted-cloud":
				return "untrusted-cloud";
			default:
				return assertNeverProviderValue(classification);
		}
	}

	if (provider.kind === "local") {
		return "local-runtime";
	}

	return provider.trustLevel === "trusted-cloud" ? "trusted-cloud" : "untrusted-cloud";
};

const pathLabel = (pathClass: ProviderReadinessPathClass): string => {
	switch (pathClass) {
		case "local-runtime":
			return "Local runtime";
		case "openai-compatible-local":
			return "OpenAI-compatible local";
		case "custom-remote":
			return "Custom remote";
		case "trusted-cloud":
			return "Trusted cloud";
		case "untrusted-cloud":
			return "Untrusted cloud";
		default:
			return assertNeverProviderValue(pathClass);
	}
};

const localityForPath = (pathClass: ProviderReadinessPathClass): ProviderReadinessPathGuidance["locality"] => {
	switch (pathClass) {
		case "local-runtime":
		case "openai-compatible-local":
			return "local";
		case "custom-remote":
			return "remote";
		case "trusted-cloud":
		case "untrusted-cloud":
			return "cloud";
		default:
			return assertNeverProviderValue(pathClass);
	}
};

const isRemoteOrCloudPath = (pathClass: ProviderReadinessPathClass): boolean =>
	pathClass === "custom-remote" || pathClass === "trusted-cloud" || pathClass === "untrusted-cloud";

const createGate = (input: GateInput): ProviderReadinessGate => ({
	kind: input.kind,
	status: input.status,
	required: input.required,
	label: input.label,
	description: input.description,
	readinessCode: input.readinessCode ?? null,
});

const authRecordForProvider = (
	settings: VoidbrainPluginSettings,
	providerId: ProviderId,
): ProviderAuthTestRecord | undefined =>
	settings.providerAuthStatuses.find((authStatus) => authStatus.providerId === providerId);

const authStateForProvider = (
	provider: ProviderDefinition,
	authRecord: ProviderAuthTestRecord | undefined,
): ProviderAuthState => {
	if (authRecord !== undefined) {
		switch (authRecord.status) {
			case "passed":
				return "passed";
			case "failed":
				return "failed";
			case "timeout":
				return "timeout";
			case "missing-secret":
				return "missing-secret";
			case "running":
			case "untested":
				return "untested";
			default:
				return assertNeverProviderValue(authRecord.status);
		}
	}

	if (provider.kind === "local" && provider.setupMetadata === undefined) {
		return "passed";
	}

	return provider.setupMetadata?.authState ?? "untested";
};

const localReadinessForProvider = (
	provider: ProviderDefinition,
	authRecord: ProviderAuthTestRecord | undefined,
): LocalRuntimeReadinessRecord | undefined =>
	authRecord?.localRuntimeReadiness ??
	(provider.setupMetadata?.localReadiness === undefined
		? undefined
		: {
				providerId: provider.id,
				status:
					provider.setupMetadata.localReadiness.status === "ready"
						? "ready"
						: provider.setupMetadata.localReadiness.status === "warning"
							? "warning"
							: provider.setupMetadata.localReadiness.status === "untested"
								? "untested"
								: "not-ready",
				code: provider.setupMetadata.localReadiness.code as LocalRuntimeReadinessRecord["code"],
				checkedAt: provider.setupMetadata.localReadiness.checkedAt,
				durationMs: provider.setupMetadata.localReadiness.durationMs,
				modelCount: provider.setupMetadata.localReadiness.modelCount,
				chatModelCount: provider.setupMetadata.localReadiness.chatModelCount,
				embeddingModelCount: provider.setupMetadata.localReadiness.embeddingModelCount,
				modelIds: [],
				chatModelIds: [],
				embeddingModelIds: [],
				diagnostic: {},
			});

const openAIReadinessForProvider = (
	provider: ProviderDefinition,
	authRecord: ProviderAuthTestRecord | undefined,
): OpenAICompatibleAuthReadinessRecord | undefined =>
	authRecord?.openaiCompatibleReadiness ??
	(provider.setupMetadata?.authReadiness === undefined
		? undefined
		: {
				providerId: provider.id,
				status: provider.setupMetadata.authReadiness.status,
				code: provider.setupMetadata.authReadiness.code,
				endpointClassification: provider.setupMetadata.authReadiness.endpointClassification,
				checkedAt: provider.setupMetadata.authReadiness.checkedAt,
				durationMs: provider.setupMetadata.authReadiness.durationMs,
				statusCode: provider.setupMetadata.authReadiness.statusCode,
				modelCount: provider.setupMetadata.authReadiness.modelCount,
				diagnostic: {},
			});

const providerReviewGate = (
	settings: VoidbrainPluginSettings,
	pathClass: ProviderReadinessPathClass,
): ProviderReadinessGate => {
	if (!isRemoteOrCloudPath(pathClass)) {
		return createGate({
			kind: "provider-review",
			status: "not-required",
			required: false,
			label: "Provider review",
			description: "Local provider paths stay on this machine.",
		});
	}

	return createGate({
		kind: "provider-review",
		status: settings.shouldRequireProviderReview ? "ready" : "blocked",
		required: true,
		label: "Provider review",
		description: settings.shouldRequireProviderReview
			? "Provider review remains required before private vault content can leave the machine."
			: "Provider review is disabled and remote provider use is blocked.",
		readinessCode: settings.shouldRequireProviderReview ? null : "provider-review-disabled",
	});
};

const localityGate = (pathClass: ProviderReadinessPathClass): ProviderReadinessGate => {
	if (pathClass === "untrusted-cloud") {
		return createGate({
			kind: "locality",
			status: "blocked",
			required: true,
			label: "Locality",
			description: "Untrusted cloud providers are blocked for private vault content.",
			readinessCode: "untrusted-cloud-blocked",
		});
	}

	if (isRemoteOrCloudPath(pathClass)) {
		return createGate({
			kind: "locality",
			status: "ready",
			required: true,
			label: "Locality",
			description: "This path can send private vault content outside the machine after all gates pass.",
			readinessCode: "remote-disclosure-required",
		});
	}

	return createGate({
		kind: "locality",
		status: "ready",
		required: true,
		label: "Locality",
		description: "This provider path stays on the local machine.",
	});
};

const trustGate = (
	settings: VoidbrainPluginSettings,
	provider: ProviderDefinition,
	pathClass: ProviderReadinessPathClass,
): ProviderReadinessGate => {
	if (!isRemoteOrCloudPath(pathClass)) {
		return createGate({
			kind: "trust",
			status: "not-required",
			required: false,
			label: "Trust",
			description: "Local provider paths do not require cloud trust.",
		});
	}

	const isTrusted = provider.trustLevel === "trusted-cloud" && settings.trustedProviderIds.includes(provider.id);
	return createGate({
		kind: "trust",
		status: isTrusted ? "ready" : "blocked",
		required: true,
		label: "Trust",
		description: isTrusted
			? "Provider is explicitly trusted for the remote or cloud path."
			: "Provider must be explicitly trusted before private vault content can leave the machine.",
		readinessCode: isTrusted ? null : "provider-not-trusted",
	});
};

const authGate = (
	provider: ProviderDefinition,
	pathClass: ProviderReadinessPathClass,
	authRecord: ProviderAuthTestRecord | undefined,
): ProviderReadinessGate => {
	const authState = authStateForProvider(provider, authRecord);
	const localReadiness = localReadinessForProvider(provider, authRecord);
	const openAIReadiness = openAIReadinessForProvider(provider, authRecord);

	if (pathClass === "local-runtime") {
		if (provider.setupMetadata?.source !== "user-profile") {
			return createGate({
				kind: "auth",
				status: "ready",
				required: true,
				label: "Runtime readiness",
				description: "Built-in local provider metadata stays local and is ready for fixture workflows.",
			});
		}

		if (localReadiness === undefined || localReadiness.code === "not-checked") {
			return createGate({
				kind: "auth",
				status: "warning",
				required: true,
				label: "Runtime readiness",
				description: "Local runtime has not been tested in this settings state.",
				readinessCode: localReadiness?.code ?? "not-checked",
			});
		}

		return createGate({
			kind: "auth",
			status:
				localReadiness.code === "ready" ? "ready" : localReadiness.status === "warning" ? "warning" : "blocked",
			required: true,
			label: "Runtime readiness",
			description:
				localReadiness.code === "ready"
					? "Local runtime model metadata is ready."
					: `Local runtime readiness is ${localReadiness.status} (${localReadiness.code}).`,
			readinessCode: localReadiness.code,
		});
	}

	if (authState === "passed") {
		return createGate({
			kind: "auth",
			status: "ready",
			required: true,
			label: "Auth",
			description: "Provider auth readiness has passed.",
			readinessCode: openAIReadiness?.code ?? "ready",
		});
	}

	if (authState === "untested") {
		return createGate({
			kind: "auth",
			status: "warning",
			required: true,
			label: "Auth",
			description: "Provider auth has not been tested from current settings.",
			readinessCode: openAIReadiness?.code ?? "not-checked",
		});
	}

	return createGate({
		kind: "auth",
		status: "blocked",
		required: true,
		label: "Auth",
		description: `Provider auth is ${authState}.`,
		readinessCode: openAIReadiness?.code ?? authState,
	});
};

const capabilityGate = (
	provider: ProviderDefinition,
	roleSummaries: readonly ProviderRoleCapabilitySummary[],
): ProviderReadinessGate => {
	const providerRoleSummaries = roleSummaries.filter((summary) => summary.providerId === provider.id);

	if (providerRoleSummaries.length === 0) {
		return createGate({
			kind: "capability",
			status: "warning",
			required: true,
			label: "Capability",
			description: "No chat, embedding, or utility role currently selects this provider.",
			readinessCode: "role-not-selected",
		});
	}

	const problem = providerRoleSummaries.find((summary) => summary.status !== "ready");
	if (problem !== undefined) {
		return createGate({
			kind: "capability",
			status: "blocked",
			required: true,
			label: "Capability",
			description: problem.message,
			readinessCode: problem.status,
		});
	}

	const roleNames = providerRoleSummaries.map((summary) => summary.role).join(", ");
	return createGate({
		kind: "capability",
		status: "ready",
		required: true,
		label: "Capability",
		description: `Selected role capability checks are ready for ${roleNames}.`,
	});
};

const disclosureGate = (
	settings: VoidbrainPluginSettings,
	provider: ProviderDefinition,
	pathClass: ProviderReadinessPathClass,
): ProviderReadinessGate => {
	if (!isRemoteOrCloudPath(pathClass)) {
		return createGate({
			kind: "disclosure",
			status: "not-required",
			required: false,
			label: "Disclosure",
			description: "Local provider paths do not disclose private vault content to a remote provider.",
		});
	}

	const isTrusted = provider.trustLevel === "trusted-cloud" && settings.trustedProviderIds.includes(provider.id);
	if (!settings.areCloudProvidersEnabled) {
		return createGate({
			kind: "disclosure",
			status: "blocked",
			required: true,
			label: "Disclosure",
			description:
				"Cloud and remote provider workflows are disabled until explicit disclosure review is complete.",
			readinessCode: "cloud-disabled",
		});
	}

	if (!isTrusted) {
		return createGate({
			kind: "disclosure",
			status: "blocked",
			required: true,
			label: "Disclosure",
			description: "Disclosure remains blocked until provider trust is explicit.",
			readinessCode: "provider-not-trusted",
		});
	}

	return createGate({
		kind: "disclosure",
		status: "ready",
		required: true,
		label: "Disclosure",
		description: "Remote or cloud disclosure gates are enabled and trusted for this provider path.",
	});
};

const semanticFallbackGate = (
	provider: ProviderDefinition,
	semanticCompatibility: SemanticIndexCompatibility | null,
): ProviderReadinessGate => {
	if (semanticCompatibility === null || semanticCompatibility.providerId !== provider.id) {
		return createGate({
			kind: "semantic-fallback",
			status: "unknown",
			required: false,
			label: "Semantic fallback",
			description:
				"Semantic compatibility has not been evaluated for this provider in the current status snapshot.",
		});
	}

	if (semanticCompatibility.semanticSearchEligible) {
		return createGate({
			kind: "semantic-fallback",
			status: "ready",
			required: false,
			label: "Semantic fallback",
			description: "Semantic search is eligible for the selected provider and model.",
			readinessCode: semanticCompatibility.code,
		});
	}

	return createGate({
		kind: "semantic-fallback",
		status: semanticCompatibility.fallbackMode === "lexical" ? "warning" : "blocked",
		required: false,
		label: "Semantic fallback",
		description:
			semanticCompatibility.fallbackMode === "lexical"
				? "Semantic readiness is blocked; lexical fallback remains available when the lexical index is ready."
				: "Semantic readiness is blocked and lexical fallback is unavailable.",
		readinessCode: semanticCompatibility.code,
	});
};

const orderedGates = (gates: readonly ProviderReadinessGate[]): readonly ProviderReadinessGate[] =>
	PROVIDER_READINESS_GATE_KINDS.map((kind) => gates.find((gate) => gate.kind === kind)).filter(
		(gate): gate is ProviderReadinessGate => gate !== undefined,
	);

const blockerCodeForGate = (gate: ProviderReadinessGate): ProviderReadinessBlockerCode => {
	switch (gate.kind) {
		case "provider-review":
			return "provider-review-disabled";
		case "locality":
			return "untrusted-cloud-blocked";
		case "trust":
			return "provider-not-trusted";
		case "auth":
			if (gate.readinessCode === "missing-secret") {
				return "missing-secret";
			}
			if (gate.readinessCode === "auth-failed") {
				return "auth-failed";
			}
			if (gate.readinessCode === "auth-timeout") {
				return "auth-timeout";
			}
			if (gate.readinessCode === "unsafe-provider-state") {
				return "unsafe-provider-state";
			}
			return gate.label === "Runtime readiness" ? "local-runtime-not-ready" : "auth-not-ready";
		case "capability":
			if (gate.readinessCode === "role-not-selected") {
				return "role-not-selected";
			}
			if (gate.readinessCode === "readiness-not-ready") {
				return "auth-not-ready";
			}
			return "capability-mismatch";
		case "disclosure":
			return gate.readinessCode === "cloud-disabled" ? "cloud-disabled" : "provider-not-trusted";
		case "semantic-fallback":
			return gate.status === "warning" ? "semantic-fallback" : "lexical-fallback-unavailable";
		default:
			return assertNeverProviderValue(gate.kind);
	}
};

const roleSummaryForGate = (
	provider: ProviderDefinition,
	gate: ProviderReadinessGate,
	roleSummaries: readonly ProviderRoleCapabilitySummary[],
): ProviderRoleCapabilitySummary | undefined => {
	if (gate.kind !== "capability") {
		return undefined;
	}

	return roleSummaries.find((summary) => summary.providerId === provider.id && summary.status !== "ready");
};

const blockersForGates = (
	provider: ProviderDefinition,
	gates: readonly ProviderReadinessGate[],
	roleSummaries: readonly ProviderRoleCapabilitySummary[],
	semanticCompatibility: SemanticIndexCompatibility | null,
): readonly ProviderReadinessBlocker[] =>
	gates
		.filter((gate) => gate.status === "blocked" || gate.status === "warning")
		.map((gate) => {
			const roleSummary = roleSummaryForGate(provider, gate, roleSummaries);
			const semanticModelId =
				gate.kind === "semantic-fallback" && semanticCompatibility?.providerId === provider.id
					? semanticCompatibility.modelId
					: null;
			return {
				code: blockerCodeForGate(gate),
				severity: gate.status === "blocked" ? "error" : "warning",
				gate: gate.kind,
				providerId: provider.id,
				modelId: roleSummary?.modelId ?? semanticModelId,
				role: roleSummary?.role ?? null,
				message: gate.description,
			};
		});

const actionCopy = (kind: ProviderReadinessActionKind): Pick<ProviderReadinessAction, "label" | "description"> => {
	switch (kind) {
		case "test-provider":
			return {
				label: "Test provider",
				description: "Run the provider setup test again from current settings.",
			};
		case "retry-provider-setup":
			return {
				label: "Retry setup",
				description: "Recompute provider setup, role capability, and readiness state.",
			};
		case "reset-provider-state":
			return {
				label: "Reset provider state",
				description: "Clear stale auth and selected model state without deleting opaque secret references.",
			};
		case "review-disclosure":
			return {
				label: "Review disclosure",
				description: "Review remote or cloud disclosure before private vault content can leave the machine.",
			};
		case "trust-provider":
			return {
				label: "Trust provider",
				description:
					"Trust this provider only after reviewing its endpoint, auth, capability, and disclosure boundary.",
			};
		case "select-role":
			return {
				label: "Select role",
				description: "Choose this provider and a compatible model for a chat, embedding, or utility role.",
			};
		case "refresh-index":
			return {
				label: "Refresh index",
				description: "Refresh lexical and semantic readiness after provider compatibility changes.",
			};
		case "inspect-recovery":
			return {
				label: "Inspect recovery",
				description: "Inspect bounded command, provider, model, cache, report, and validation recovery fields.",
			};
		default:
			return assertNeverProviderValue(kind);
	}
};

const createAction = (
	kind: ProviderReadinessActionKind,
	input: {
		readonly providerId: ProviderId | null;
		readonly modelId?: ProviderModelId | null;
		readonly role?: ModelRole | null;
		readonly disabledReason?: string | null;
	},
): ProviderReadinessAction => ({
	kind,
	...actionCopy(kind),
	providerId: input.providerId,
	modelId: input.modelId ?? null,
	role: input.role ?? null,
	disabledReason: input.disabledReason ?? null,
});

const addAction = (actions: ProviderReadinessAction[], action: ProviderReadinessAction): void => {
	const isRoleScoped = action.kind === "select-role";
	const duplicate = actions.some(
		(candidate) =>
			candidate.kind === action.kind &&
			candidate.providerId === action.providerId &&
			(!isRoleScoped || (candidate.modelId === action.modelId && candidate.role === action.role)),
	);

	if (!duplicate) {
		actions.push(action);
	}
};

const actionsForBlockers = (blockers: readonly ProviderReadinessBlocker[]): readonly ProviderReadinessAction[] => {
	const actions: ProviderReadinessAction[] = [];

	for (const blocker of blockers) {
		switch (blocker.code) {
			case "provider-review-disabled":
			case "cloud-disabled":
				addAction(actions, createAction("review-disclosure", blocker));
				break;
			case "provider-not-trusted":
			case "untrusted-cloud-blocked":
				addAction(actions, createAction("trust-provider", blocker));
				addAction(actions, createAction("review-disclosure", blocker));
				break;
			case "local-runtime-not-ready":
			case "auth-not-ready":
			case "missing-secret":
			case "auth-failed":
			case "auth-timeout":
			case "unsafe-provider-state":
				addAction(actions, createAction("test-provider", blocker));
				addAction(actions, createAction("reset-provider-state", blocker));
				break;
			case "capability-mismatch":
				addAction(actions, createAction("select-role", blocker));
				addAction(actions, createAction("reset-provider-state", blocker));
				break;
			case "role-not-selected":
				addAction(actions, createAction("select-role", blocker));
				break;
			case "semantic-fallback":
			case "lexical-fallback-unavailable":
				addAction(actions, createAction("refresh-index", blocker));
				break;
			case "provider-invalid":
				addAction(actions, createAction("inspect-recovery", blocker));
				break;
			default:
				return assertNeverProviderValue(blocker.code);
		}
	}

	if (blockers.length > 0) {
		addAction(actions, createAction("inspect-recovery", { providerId: blockers[0]?.providerId ?? null }));
	}

	return orderActions(actions);
};

const orderActions = (actions: readonly ProviderReadinessAction[]): readonly ProviderReadinessAction[] =>
	[...actions].sort((left, right) => {
		const kindComparison = actionRank[left.kind] - actionRank[right.kind];
		if (kindComparison !== 0) {
			return kindComparison;
		}

		return compareStrings(
			`${left.providerId ?? ""}:${left.modelId ?? ""}:${left.role ?? ""}`,
			`${right.providerId ?? ""}:${right.modelId ?? ""}:${right.role ?? ""}`,
		);
	});

const fallbackSummary = (
	provider: ProviderDefinition,
	semanticCompatibility: SemanticIndexCompatibility | null,
): ProviderReadinessFallbackSummary => {
	if (semanticCompatibility === null || semanticCompatibility.providerId !== provider.id) {
		return {
			mode: "not-evaluated",
			status: "unknown",
			readinessCode: null,
			summary: "Semantic compatibility has not been evaluated; lexical retrieval remains the first-run baseline.",
			sourcePathCount: 0,
		};
	}

	const mode = toProviderReadinessFallbackMode(semanticCompatibility.fallbackMode);
	if (semanticCompatibility.semanticSearchEligible) {
		return {
			mode,
			status: "ready",
			readinessCode: semanticCompatibility.code,
			summary: "Semantic search is eligible for the selected provider and model.",
			sourcePathCount: semanticCompatibility.sourcePathCounts.current,
		};
	}

	return {
		mode,
		status: mode === "lexical" ? "warning" : "blocked",
		readinessCode: semanticCompatibility.code,
		summary:
			mode === "lexical"
				? "Semantic readiness is blocked; lexical fallback remains available when lexical indexing is ready."
				: "Semantic readiness is blocked and lexical fallback is unavailable.",
		sourcePathCount: semanticCompatibility.sourcePathCounts.current,
	};
};

const pathCopy = (
	provider: ProviderDefinition,
	pathClass: ProviderReadinessPathClass,
	severity: ProviderSetupSeverity,
): ProviderReadinessCopy => {
	const label = `${provider.displayName} (${pathLabel(pathClass)})`;
	const summary =
		severity === "ready"
			? "Provider path is ready for selected roles."
			: severity === "error"
				? "Provider path has blocking readiness gates."
				: severity === "missing"
					? "Provider path needs setup before workflows can run."
					: "Provider path has readiness warnings to review.";
	const detail =
		pathClass === "local-runtime"
			? "Local runtime guidance keeps vault content on this machine and requires runtime/model readiness."
			: pathClass === "openai-compatible-local"
				? "OpenAI-compatible local guidance uses the OpenAI API shape while keeping the endpoint local."
				: pathClass === "custom-remote"
					? "Custom remote guidance requires provider review, trust, auth, capability, and disclosure gates."
					: pathClass === "trusted-cloud"
						? "Trusted cloud guidance requires cloud workflows, trust, auth, capability, and disclosure gates."
						: "Untrusted cloud guidance is blocked for private vault content.";

	return { label, summary, detail };
};

const pathSeverity = (blockers: readonly ProviderReadinessBlocker[]): ProviderSetupSeverity => {
	if (blockers.length === 0) {
		return "ready";
	}

	return blockers.map((blocker) => blocker.severity).reduce(worseSeverity, "ready");
};

export const createProviderReadinessRecovery = (input: {
	readonly commandId?: string;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly readinessCode?: string | null;
	readonly cachePath?: NormalizedVaultPath | null;
	readonly reportId?: string | null;
	readonly sourcePathCount?: number;
	readonly fallbackMode?: ProviderReadinessFallbackMode;
	readonly validationOutput?: readonly string[];
}): ProviderReadinessRecoveryFields => ({
	commandId: input.commandId ?? PROVIDER_READINESS_GUIDANCE_COMMAND_ID,
	providerId: input.providerId ?? null,
	modelId: input.modelId ?? null,
	readinessCode: input.readinessCode ?? null,
	cachePath: input.cachePath ?? null,
	reportId: input.reportId ?? null,
	sourcePathCount: Math.max(0, input.sourcePathCount ?? 0),
	fallbackMode: input.fallbackMode ?? "not-evaluated",
	validationOutput: sanitizeValidationOutput(input.validationOutput ?? []),
});

const recoveryForPath = (
	provider: ProviderDefinition,
	blockers: readonly ProviderReadinessBlocker[],
	fallback: ProviderReadinessFallbackSummary,
	context: GuidanceContext,
): ProviderReadinessRecoveryFields => {
	const firstBlocker = blockers[0];
	const troubleshootingRecovery = context.troubleshooting.recovery;

	return createProviderReadinessRecovery({
		providerId: provider.id,
		modelId: firstBlocker?.modelId ?? troubleshootingRecovery.modelId,
		readinessCode: firstBlocker?.code ?? fallback.readinessCode ?? troubleshootingRecovery.readinessCode,
		cachePath: context.cachePath,
		reportId: context.reportId,
		sourcePathCount: Math.max(fallback.sourcePathCount, troubleshootingRecovery.sourcePathCount),
		fallbackMode: fallback.mode,
		validationOutput:
			context.semanticCompatibility?.providerId === provider.id
				? context.semanticCompatibility.recovery.validationOutput
				: context.validationOutput,
	});
};

const activeProviderIds = (settings: VoidbrainPluginSettings): ReadonlySet<ProviderId> =>
	new Set<ProviderId>([
		...settings.providerProfiles.map((profile) => profile.id),
		...settings.providerAuthStatuses.map((status) => status.providerId),
		...Object.values(settings.providerRoles)
			.map((selection) => selection.providerId)
			.filter((providerId): providerId is ProviderId => providerId !== null),
	]);

const buildPathGuidance = (provider: ProviderDefinition, context: GuidanceContext): ProviderReadinessPathGuidance => {
	const pathClass = classifyProviderReadinessPath(provider);
	const authRecord = authRecordForProvider(context.settings, provider.id);
	const gates = orderedGates([
		providerReviewGate(context.settings, pathClass),
		localityGate(pathClass),
		trustGate(context.settings, provider, pathClass),
		authGate(provider, pathClass, authRecord),
		capabilityGate(provider, context.roleSummaries),
		disclosureGate(context.settings, provider, pathClass),
		semanticFallbackGate(provider, context.semanticCompatibility),
	]);
	const blockers = blockersForGates(provider, gates, context.roleSummaries, context.semanticCompatibility);
	const severity = pathSeverity(blockers);
	const fallback = fallbackSummary(provider, context.semanticCompatibility);
	const actions = actionsForBlockers(blockers);

	return {
		providerId: provider.id,
		displayName: provider.displayName,
		providerKind: provider.kind,
		trustLevel: provider.trustLevel,
		pathClass,
		pathLabel: pathLabel(pathClass),
		locality: localityForPath(pathClass),
		copy: pathCopy(provider, pathClass, severity),
		gates,
		blockers,
		actions,
		fallback,
		recovery: recoveryForPath(provider, blockers, fallback, context),
	};
};

const orderPaths = (paths: readonly ProviderReadinessPathGuidance[]): readonly ProviderReadinessPathGuidance[] =>
	[...paths].sort((left, right) => {
		const classComparison = pathRank[left.pathClass] - pathRank[right.pathClass];
		if (classComparison !== 0) {
			return classComparison;
		}

		return compareStrings(left.providerId, right.providerId);
	});

const aggregateActions = (paths: readonly ProviderReadinessPathGuidance[]): readonly ProviderReadinessAction[] => {
	const actions: ProviderReadinessAction[] = [];
	for (const path of paths) {
		for (const action of path.actions) {
			addAction(actions, action);
		}
	}

	return orderActions(actions);
};

const guidanceCopy = (severity: ProviderSetupSeverity): ProviderReadinessCopy => {
	const label = "Provider readiness";
	const summary =
		severity === "ready"
			? "Provider readiness gates are ready for selected workflows."
			: severity === "error"
				? "Provider readiness has blocking gates to resolve."
				: severity === "missing"
					? "Provider readiness needs a configured or selected provider."
					: "Provider readiness has warnings to review before workflows run.";
	const detail =
		"Readiness is evaluated in local-first order: local runtime, OpenAI-compatible local, custom remote, trusted cloud, then untrusted cloud blocked for private vault content.";

	return { label, summary, detail };
};

export const buildProviderReadinessGuidance = (input: ProviderReadinessGuidanceInput): ProviderReadinessGuidance => {
	const parsedProviders: ProviderDefinition[] = [];
	const validationErrors: ProviderReadinessValidationError[] = [];

	for (const [index, providerInput] of input.providers.entries()) {
		const parsed = parseProviderReadinessProvider(providerInput, index);
		if (parsed.ok) {
			parsedProviders.push(parsed.provider);
		} else {
			validationErrors.push(...parsed.errors);
		}
	}

	const setupSummary = input.providerSetup ?? summarizeProviderSetup(input.settings, parsedProviders);
	const roleSummaries =
		input.providerRoleCapabilities ?? summarizeProviderRoleCapabilities(input.settings, parsedProviders);
	const troubleshooting =
		input.providerTroubleshooting ??
		composeProviderTroubleshootingReport({
			settings: input.settings,
			providers: parsedProviders,
			providerSetup: setupSummary,
			providerRoleCapabilities: roleSummaries,
			semanticCompatibility: input.semanticCompatibility ?? null,
			reportId: input.reportId ?? PROVIDER_READINESS_GUIDANCE_DEFAULT_REPORT_ID,
		});
	const reportId = input.reportId ?? troubleshooting.reportId ?? PROVIDER_READINESS_GUIDANCE_DEFAULT_REPORT_ID;
	const context: GuidanceContext = {
		settings: input.settings,
		setupSummary,
		roleSummaries,
		troubleshooting,
		semanticCompatibility: input.semanticCompatibility ?? null,
		cachePath: input.cachePath ?? null,
		reportId,
		validationOutput: input.validationOutput ?? troubleshooting.recovery.validationOutput,
	};
	const activeIds = activeProviderIds(input.settings);
	const activeProviders = parsedProviders.filter((provider) => activeIds.has(provider.id));
	const paths = orderPaths(activeProviders.map((provider) => buildPathGuidance(provider, context)));
	const validationBlockers: ProviderReadinessBlocker[] = validationErrors.map((error) => ({
		code: error.code === "unsafe-provider-state" ? "unsafe-provider-state" : "provider-invalid",
		severity: "error",
		gate: "auth",
		providerId: null,
		modelId: null,
		role: null,
		message: error.message,
	}));
	const allBlockers = [...validationBlockers, ...paths.flatMap((path) => path.blockers)];
	const severity =
		validationErrors.length > 0
			? "error"
			: paths.length === 0
				? "missing"
				: allBlockers.length === 0
					? "ready"
					: allBlockers.map((blocker) => blocker.severity).reduce(worseSeverity, "ready");
	const actions = aggregateActions(paths);
	const fallbackMode = paths.find((path) => path.fallback.mode !== "not-evaluated")?.fallback.mode ?? "not-evaluated";
	const firstPath = paths[0];
	const firstBlocker = allBlockers[0];
	const recovery = createProviderReadinessRecovery({
		providerId: firstBlocker?.providerId ?? firstPath?.providerId ?? null,
		modelId: firstBlocker?.modelId ?? firstPath?.recovery.modelId ?? null,
		readinessCode: firstBlocker?.code ?? firstPath?.recovery.readinessCode ?? null,
		cachePath: input.cachePath ?? null,
		reportId,
		sourcePathCount: Math.max(0, ...paths.map((path) => path.recovery.sourcePathCount)),
		fallbackMode,
		validationOutput: input.validationOutput ?? troubleshooting.recovery.validationOutput,
	});

	return {
		reportId,
		severity,
		summary: guidanceCopy(severity).summary,
		providerCount: paths.length,
		userProfileCount: setupSummary.userProfileCount,
		cloudDisclosureRequired: paths.some((path) => path.locality !== "local"),
		paths,
		actions,
		recovery,
		copy: guidanceCopy(severity),
	};
};

const safetyIssue = (
	code: ProviderReadinessSafetyIssue["code"],
	field: string,
	message: string,
): ProviderReadinessSafetyIssue => ({ code, field, message });

const collectSafetyIssues = (
	value: unknown,
	field: string,
	issues: ProviderReadinessSafetyIssue[],
	seen: Set<unknown>,
): void => {
	if (typeof value === "string") {
		if (credentialLikeValuePattern.test(value)) {
			issues.push(
				safetyIssue("credential-like-value", field, "Credential-like value found in guidance diagnostics."),
			);
		}
		if (privatePathHintPattern.test(value)) {
			issues.push(
				safetyIssue("private-path-hint", field, "Private absolute path found in guidance diagnostics."),
			);
		}
		if (promptBodyHintPattern.test(value)) {
			issues.push(
				safetyIssue("prompt-body-hint", field, "Prompt or note body hint found in guidance diagnostics."),
			);
		}
		if (hiddenStateHintPattern.test(value)) {
			issues.push(
				safetyIssue("hidden-state-hint", field, "Hidden provider state hint found in guidance diagnostics."),
			);
		}
		return;
	}

	if (value === null || value === undefined || typeof value !== "object") {
		return;
	}

	if (seen.has(value)) {
		return;
	}
	seen.add(value);

	if (Array.isArray(value)) {
		for (const [index, child] of value.entries()) {
			collectSafetyIssues(child, `${field}[${index}]`, issues, seen);
		}
		return;
	}

	if (!isRecord(value)) {
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		const childField = field.length > 0 ? `${field}.${key}` : key;
		if (isSecretLikeKey(key) || promptBodyHintPattern.test(key) || hiddenStateHintPattern.test(key)) {
			issues.push(
				safetyIssue(
					"unsafe-diagnostic-key",
					childField,
					"Unsafe diagnostic key found in guidance diagnostics.",
				),
			);
		}

		collectSafetyIssues(child, childField, issues, seen);
	}
};

export const validateProviderReadinessDiagnosticsSafety = (input: unknown): ProviderReadinessSafetyResult => {
	const issues: ProviderReadinessSafetyIssue[] = [];
	collectSafetyIssues(input, "root", issues, new Set());

	if (issues.length === 0) {
		return { ok: true, issues: [] };
	}

	return {
		ok: false,
		issues: [...issues].sort((left, right) => {
			const fieldComparison = compareStrings(left.field, right.field);
			if (fieldComparison !== 0) {
				return fieldComparison;
			}

			return compareStrings(left.code, right.code);
		}),
	};
};
