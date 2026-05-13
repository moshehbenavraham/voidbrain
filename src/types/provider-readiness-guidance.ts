import type { VoidbrainPluginSettings } from "./plugin";
import type {
	ProviderRoleCapabilitySummary,
	ProviderSetupSeverity,
	ProviderSetupSummary,
	ProviderTroubleshootingReport,
} from "./provider-setup";
import type {
	ModelCapability,
	ModelRole,
	ProviderDefinition,
	ProviderId,
	ProviderKind,
	ProviderModelId,
	ProviderTrustLevel,
} from "./providers";
import type { SemanticIndexCompatibility, SemanticRetrievalFallbackMode } from "./retrieval";
import type { NormalizedVaultPath } from "./vault";

export const PROVIDER_READINESS_PATH_CLASSES = [
	"local-runtime",
	"openai-compatible-local",
	"custom-remote",
	"trusted-cloud",
	"untrusted-cloud",
] as const;
export const PROVIDER_READINESS_GATE_KINDS = [
	"provider-review",
	"locality",
	"trust",
	"auth",
	"capability",
	"disclosure",
	"semantic-fallback",
] as const;
export const PROVIDER_READINESS_GATE_STATUSES = ["ready", "warning", "blocked", "not-required", "unknown"] as const;
export const PROVIDER_READINESS_ACTION_KINDS = [
	"test-provider",
	"retry-provider-setup",
	"reset-provider-state",
	"review-disclosure",
	"trust-provider",
	"select-role",
	"refresh-index",
	"inspect-recovery",
] as const;
export const PROVIDER_READINESS_BLOCKER_CODES = [
	"provider-invalid",
	"provider-review-disabled",
	"local-runtime-not-ready",
	"auth-not-ready",
	"missing-secret",
	"auth-failed",
	"auth-timeout",
	"provider-not-trusted",
	"cloud-disabled",
	"capability-mismatch",
	"role-not-selected",
	"unsafe-provider-state",
	"semantic-fallback",
	"lexical-fallback-unavailable",
	"untrusted-cloud-blocked",
] as const;
export const PROVIDER_READINESS_FALLBACK_MODES = ["semantic", "lexical", "unavailable", "not-evaluated"] as const;
export const PROVIDER_READINESS_SAFETY_ISSUE_CODES = [
	"unsafe-diagnostic-key",
	"credential-like-value",
	"private-path-hint",
	"prompt-body-hint",
	"hidden-state-hint",
] as const;

export type ProviderReadinessPathClass = (typeof PROVIDER_READINESS_PATH_CLASSES)[number];
export type ProviderReadinessGateKind = (typeof PROVIDER_READINESS_GATE_KINDS)[number];
export type ProviderReadinessGateStatus = (typeof PROVIDER_READINESS_GATE_STATUSES)[number];
export type ProviderReadinessActionKind = (typeof PROVIDER_READINESS_ACTION_KINDS)[number];
export type ProviderReadinessBlockerCode = (typeof PROVIDER_READINESS_BLOCKER_CODES)[number];
export type ProviderReadinessFallbackMode = (typeof PROVIDER_READINESS_FALLBACK_MODES)[number];
export type ProviderReadinessSafetyIssueCode = (typeof PROVIDER_READINESS_SAFETY_ISSUE_CODES)[number];

export interface ProviderReadinessCopy {
	readonly label: string;
	readonly summary: string;
	readonly detail: string;
}

export interface ProviderReadinessGate {
	readonly kind: ProviderReadinessGateKind;
	readonly status: ProviderReadinessGateStatus;
	readonly required: boolean;
	readonly label: string;
	readonly description: string;
	readonly readinessCode: string | null;
}

export interface ProviderReadinessBlocker {
	readonly code: ProviderReadinessBlockerCode;
	readonly severity: Exclude<ProviderSetupSeverity, "ready">;
	readonly gate: ProviderReadinessGateKind;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly role: ModelRole | null;
	readonly message: string;
}

export interface ProviderReadinessAction {
	readonly kind: ProviderReadinessActionKind;
	readonly label: string;
	readonly description: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly role: ModelRole | null;
	readonly disabledReason: string | null;
}

export interface ProviderReadinessFallbackSummary {
	readonly mode: ProviderReadinessFallbackMode;
	readonly status: ProviderReadinessGateStatus;
	readonly readinessCode: string | null;
	readonly summary: string;
	readonly sourcePathCount: number;
}

export interface ProviderReadinessRecoveryFields {
	readonly commandId: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly readinessCode: string | null;
	readonly cachePath: NormalizedVaultPath | null;
	readonly reportId: string | null;
	readonly sourcePathCount: number;
	readonly fallbackMode: ProviderReadinessFallbackMode;
	readonly validationOutput: readonly string[];
}

export interface ProviderReadinessPathGuidance {
	readonly providerId: ProviderId;
	readonly displayName: string;
	readonly providerKind: ProviderKind;
	readonly trustLevel: ProviderTrustLevel;
	readonly pathClass: ProviderReadinessPathClass;
	readonly pathLabel: string;
	readonly locality: "local" | "remote" | "cloud";
	readonly copy: ProviderReadinessCopy;
	readonly gates: readonly ProviderReadinessGate[];
	readonly blockers: readonly ProviderReadinessBlocker[];
	readonly actions: readonly ProviderReadinessAction[];
	readonly fallback: ProviderReadinessFallbackSummary;
	readonly recovery: ProviderReadinessRecoveryFields;
}

export interface ProviderReadinessGuidance {
	readonly reportId: string;
	readonly severity: ProviderSetupSeverity;
	readonly summary: string;
	readonly providerCount: number;
	readonly userProfileCount: number;
	readonly cloudDisclosureRequired: boolean;
	readonly paths: readonly ProviderReadinessPathGuidance[];
	readonly actions: readonly ProviderReadinessAction[];
	readonly recovery: ProviderReadinessRecoveryFields;
	readonly copy: ProviderReadinessCopy;
}

export interface ProviderReadinessValidationError {
	readonly code:
		| "invalid-provider"
		| "invalid-provider-kind"
		| "invalid-provider-trust"
		| "invalid-model"
		| "unsafe-provider-state";
	readonly field: string;
	readonly message: string;
}

export interface ProviderReadinessProviderParseSuccess {
	readonly ok: true;
	readonly provider: ProviderDefinition;
}

export interface ProviderReadinessProviderParseFailure {
	readonly ok: false;
	readonly errors: readonly ProviderReadinessValidationError[];
}

export type ProviderReadinessProviderParseResult =
	| ProviderReadinessProviderParseSuccess
	| ProviderReadinessProviderParseFailure;

export interface ProviderReadinessGuidanceInput {
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly unknown[];
	readonly providerSetup?: ProviderSetupSummary;
	readonly providerRoleCapabilities?: readonly ProviderRoleCapabilitySummary[];
	readonly providerTroubleshooting?: ProviderTroubleshootingReport;
	readonly semanticCompatibility?: SemanticIndexCompatibility | null;
	readonly cachePath?: NormalizedVaultPath | null;
	readonly reportId?: string | null;
	readonly validationOutput?: readonly string[];
}

export interface ProviderReadinessSafetyIssue {
	readonly code: ProviderReadinessSafetyIssueCode;
	readonly field: string;
	readonly message: string;
}

export interface ProviderReadinessSafetyPass {
	readonly ok: true;
	readonly issues: readonly [];
}

export interface ProviderReadinessSafetyFailure {
	readonly ok: false;
	readonly issues: readonly ProviderReadinessSafetyIssue[];
}

export type ProviderReadinessSafetyResult = ProviderReadinessSafetyPass | ProviderReadinessSafetyFailure;

export const isProviderReadinessFallbackMode = (value: unknown): value is ProviderReadinessFallbackMode =>
	typeof value === "string" && PROVIDER_READINESS_FALLBACK_MODES.includes(value as ProviderReadinessFallbackMode);

export const toProviderReadinessFallbackMode = (
	value: SemanticRetrievalFallbackMode | null | undefined,
): ProviderReadinessFallbackMode => value ?? "not-evaluated";
