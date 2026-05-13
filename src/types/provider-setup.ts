import type {
	ContentSensitivity,
	ModelCapability,
	ModelRole,
	ProviderDefinition,
	ProviderId,
	ProviderKind,
	ProviderModelId,
	ProviderPrivacyPolicy,
	ProviderTrustLevel,
	RedactedDiagnosticObject,
	SecretReference,
} from "./providers";
import type { IsoTimestamp, NormalizedVaultPath } from "./vault";

export const USER_PROVIDER_PROFILE_KINDS = ["local", "openai-compatible"] as const;
export const PROVIDER_AUTH_TEST_STATUSES = [
	"untested",
	"running",
	"passed",
	"failed",
	"timeout",
	"missing-secret",
] as const;
export const PROVIDER_SETUP_SEVERITIES = ["ready", "warning", "error", "missing"] as const;
export const PROVIDER_ROLE_CAPABILITY_STATUSES = [
	"ready",
	"not-selected",
	"provider-missing",
	"model-missing",
	"capability-mismatch",
	"readiness-not-ready",
] as const;
export const LOCAL_RUNTIME_FAMILIES = [
	"ollama",
	"lm-studio",
	"llama-cpp",
	"vllm",
	"generic-openai-compatible",
] as const;
export const LOCAL_RUNTIME_READINESS_STATUSES = ["untested", "ready", "warning", "not-ready"] as const;
export const LOCAL_RUNTIME_READINESS_CODES = [
	"ready",
	"not-checked",
	"offline",
	"timeout",
	"aborted",
	"probe-failed",
	"malformed-model-metadata",
	"duplicate-model-id",
	"missing-chat-capability",
	"missing-embedding-capability",
	"capability-mismatch",
	"invalid-profile",
] as const;
export const OPENAI_COMPATIBLE_ENDPOINT_CLASSIFICATIONS = [
	"local-compatible",
	"custom-remote",
	"trusted-cloud",
	"untrusted-cloud",
] as const;
export const OPENAI_COMPATIBLE_READINESS_STATUSES = ["ready", "warning", "not-ready", "untested"] as const;
export const OPENAI_COMPATIBLE_READINESS_CODES = [
	"ready",
	"not-checked",
	"endpoint-invalid",
	"endpoint-classification-mismatch",
	"missing-credential-reference",
	"missing-secret",
	"auth-failed",
	"auth-timeout",
	"provider-not-trusted",
	"cloud-disabled",
	"model-missing",
	"capability-mismatch",
	"unsafe-provider-state",
] as const;
export const PROVIDER_TROUBLESHOOTING_DIAGNOSTIC_KINDS = [
	"setup",
	"auth",
	"local-runtime",
	"openai-compatible",
	"role-capability",
	"disclosure",
	"semantic-compatibility",
	"recovery",
] as const;
export const PROVIDER_TROUBLESHOOTING_ACTION_KINDS = [
	"retest-auth",
	"retry-provider-setup",
	"reset-provider-state",
	"review-disclosure",
	"refresh-index",
	"inspect-recovery",
] as const;

export type UserProviderProfileKind = (typeof USER_PROVIDER_PROFILE_KINDS)[number];
export type ProviderAuthTestStatus = (typeof PROVIDER_AUTH_TEST_STATUSES)[number];
export type ProviderSetupSeverity = (typeof PROVIDER_SETUP_SEVERITIES)[number];
export type ProviderRoleCapabilityStatus = (typeof PROVIDER_ROLE_CAPABILITY_STATUSES)[number];
export type LocalRuntimeFamily = (typeof LOCAL_RUNTIME_FAMILIES)[number];
export type LocalRuntimeReadinessStatus = (typeof LOCAL_RUNTIME_READINESS_STATUSES)[number];
export type LocalRuntimeReadinessCode = (typeof LOCAL_RUNTIME_READINESS_CODES)[number];
export type LocalRuntimeReadinessDenialCode = Exclude<LocalRuntimeReadinessCode, "ready">;
export type OpenAICompatibleEndpointClassification = (typeof OPENAI_COMPATIBLE_ENDPOINT_CLASSIFICATIONS)[number];
export type OpenAICompatibleReadinessStatus = (typeof OPENAI_COMPATIBLE_READINESS_STATUSES)[number];
export type OpenAICompatibleReadinessCode = (typeof OPENAI_COMPATIBLE_READINESS_CODES)[number];
export type OpenAICompatibleReadinessDenialCode = Exclude<OpenAICompatibleReadinessCode, "ready">;
export type ProviderTroubleshootingDiagnosticKind = (typeof PROVIDER_TROUBLESHOOTING_DIAGNOSTIC_KINDS)[number];
export type ProviderTroubleshootingActionKind = (typeof PROVIDER_TROUBLESHOOTING_ACTION_KINDS)[number];
export type ProviderTroubleshootingSeverity = ProviderSetupSeverity;

export interface ProviderEndpointMetadata {
	readonly baseUrl: string | null;
	readonly isCloudEndpoint: boolean;
	readonly hostname: string | null;
}

export interface UserProviderModelProfile {
	readonly id: ProviderModelId;
	readonly displayName: string;
	readonly roles: readonly ModelRole[];
	readonly capabilities: readonly ModelCapability[];
	readonly isDefault?: boolean;
	readonly embeddingFamily?: string;
}

export interface LocalRuntimeProfileMetadata {
	readonly runtimeFamily: LocalRuntimeFamily;
	readonly endpoint: ProviderEndpointMetadata;
	readonly modelCount: number;
	readonly chatModelCount: number;
	readonly embeddingModelCount: number;
}

export interface OpenAICompatibleProfileMetadata {
	readonly endpointClassification: OpenAICompatibleEndpointClassification;
	readonly endpoint: ProviderEndpointMetadata;
	readonly isRemoteDisclosureRequired: boolean;
	readonly isTrustRequired: boolean;
	readonly isCredentialRequired: boolean;
	readonly modelCount: number;
	readonly chatModelCount: number;
	readonly streamingModelCount: number;
	readonly embeddingModelCount: number;
	readonly toolModelCount: number;
	readonly attachmentModelCount: number;
}

export interface UserProviderProfile {
	readonly id: ProviderId;
	readonly displayName: string;
	readonly profileKind: UserProviderProfileKind;
	readonly providerKind: ProviderKind;
	readonly trustLevel: ProviderTrustLevel;
	readonly endpoint: ProviderEndpointMetadata;
	readonly credentialReference: SecretReference | null;
	readonly models: readonly UserProviderModelProfile[];
	readonly localRuntime?: LocalRuntimeProfileMetadata;
	readonly openaiCompatible?: OpenAICompatibleProfileMetadata;
}

export type ProviderProfileValidationCode =
	| "invalid-profile"
	| "unsafe-provider-state"
	| "duplicate-profile-id"
	| "endpoint-invalid"
	| "endpoint-classification-invalid"
	| "endpoint-classification-mismatch"
	| "endpoint-non-local"
	| "missing-credential-reference"
	| "runtime-family-invalid"
	| "model-invalid"
	| "model-capability-mismatch"
	| "duplicate-model-id"
	| "missing-chat-model"
	| "missing-embedding-model";

export interface ProviderProfileValidationError {
	readonly code: ProviderProfileValidationCode;
	readonly field: string;
	readonly message: string;
}

export interface ProviderProfileParseResult {
	readonly ok: true;
	readonly profile: UserProviderProfile;
}

export interface ProviderProfileParseFailure {
	readonly ok: false;
	readonly errors: readonly ProviderProfileValidationError[];
}

export type ProviderProfileValidationResult = ProviderProfileParseResult | ProviderProfileParseFailure;

export interface ProviderProfileNormalizationResult {
	readonly profiles: readonly UserProviderProfile[];
	readonly errors: readonly ProviderProfileValidationError[];
}

export interface ProviderDefinitionMergeResult {
	readonly providers: readonly ProviderDefinition[];
	readonly profileErrors: readonly ProviderProfileValidationError[];
}

export interface ProviderAuthTestRecord {
	readonly providerId: ProviderId;
	readonly status: ProviderAuthTestStatus;
	readonly checkedAt: string;
	readonly statusCode: number | null;
	readonly modelCount: number;
	readonly durationMs: number;
	readonly diagnostic: RedactedDiagnosticObject;
	readonly localRuntimeReadiness?: LocalRuntimeReadinessRecord;
	readonly openaiCompatibleReadiness?: OpenAICompatibleAuthReadinessRecord;
}

export interface ProviderAuthTestProbeInput {
	readonly profile: UserProviderProfile;
	readonly runtimeCredential: string | null;
	readonly attempt: number;
	readonly signal: AbortSignal;
}

export interface ProviderAuthTestProbeSuccess {
	readonly ok: true;
	readonly statusCode?: number;
	readonly modelCount?: number;
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ProviderAuthTestProbeFailure {
	readonly ok: false;
	readonly statusCode?: number;
	readonly diagnostic?: unknown;
}

export type ProviderAuthTestProbeResult = ProviderAuthTestProbeSuccess | ProviderAuthTestProbeFailure;
export type ProviderAuthTestProbe = (input: ProviderAuthTestProbeInput) => Promise<ProviderAuthTestProbeResult>;

export interface LocalRuntimeModelMetadata {
	readonly id: ProviderModelId;
	readonly displayName: string;
	readonly roles: readonly ModelRole[];
	readonly capabilities: readonly ModelCapability[];
	readonly embeddingFamily?: string;
}

export interface LocalRuntimeReadinessRecord {
	readonly providerId: ProviderId;
	readonly status: LocalRuntimeReadinessStatus;
	readonly code: LocalRuntimeReadinessCode;
	readonly checkedAt: string;
	readonly durationMs: number;
	readonly modelCount: number;
	readonly chatModelCount: number;
	readonly embeddingModelCount: number;
	readonly modelIds: readonly ProviderModelId[];
	readonly chatModelIds: readonly ProviderModelId[];
	readonly embeddingModelIds: readonly ProviderModelId[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface OpenAICompatibleAuthReadinessRecord {
	readonly providerId: ProviderId;
	readonly status: OpenAICompatibleReadinessStatus;
	readonly code: OpenAICompatibleReadinessCode;
	readonly endpointClassification: OpenAICompatibleEndpointClassification;
	readonly checkedAt: string;
	readonly durationMs: number;
	readonly statusCode: number | null;
	readonly modelCount: number;
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface OpenAICompatibleCapabilityReadinessRecord {
	readonly providerId: ProviderId;
	readonly role: ModelRole;
	readonly requiredCapability: ModelCapability;
	readonly status: OpenAICompatibleReadinessStatus;
	readonly code: OpenAICompatibleReadinessCode;
	readonly modelId: ProviderModelId | null;
	readonly modelCount: number;
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface LocalRuntimeReadinessProbeInput {
	readonly profile: UserProviderProfile;
	readonly signal: AbortSignal;
}

export interface LocalRuntimeReadinessProbeSuccess {
	readonly ok: true;
	readonly statusCode?: number;
	readonly models: readonly unknown[];
	readonly diagnostic?: unknown;
}

export interface LocalRuntimeReadinessProbeFailure {
	readonly ok: false;
	readonly statusCode?: number;
	readonly code?: LocalRuntimeReadinessDenialCode;
	readonly diagnostic?: unknown;
}

export type LocalRuntimeReadinessProbeResult = LocalRuntimeReadinessProbeSuccess | LocalRuntimeReadinessProbeFailure;

export type LocalRuntimeReadinessProbe = (
	input: LocalRuntimeReadinessProbeInput,
) => Promise<LocalRuntimeReadinessProbeResult>;

export interface LocalRuntimeCapabilityReadinessSummary {
	readonly role: ModelRole;
	readonly requiredCapability: ModelCapability;
	readonly status: LocalRuntimeReadinessStatus;
	readonly code: LocalRuntimeReadinessCode;
	readonly modelCount: number;
	readonly modelIds: readonly ProviderModelId[];
	readonly message: string;
}

export interface ProviderSetupSummary {
	readonly severity: ProviderSetupSeverity;
	readonly providerCount: number;
	readonly userProfileCount: number;
	readonly configuredCredentialCount: number;
	readonly passedAuthCount: number;
	readonly localReadinessReadyCount: number;
	readonly localReadinessNotReadyCount: number;
	readonly trustedCloudCount: number;
	readonly roleSelectionCount: number;
	readonly details: readonly string[];
}

export interface ProviderRoleCapabilitySummary {
	readonly role: ModelRole;
	readonly requiredCapability: ModelCapability;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly status: ProviderRoleCapabilityStatus;
	readonly message: string;
}

export interface ProviderTroubleshootingSafeDiagnostic {
	readonly commandId: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly role: ModelRole | null;
	readonly readinessCode: string | null;
	readonly cachePath: NormalizedVaultPath | null;
	readonly reportId: string | null;
	readonly sourcePathCount: number;
	readonly validationOutput: readonly string[];
}

export interface ProviderTroubleshootingDiagnostic {
	readonly id: string;
	readonly kind: ProviderTroubleshootingDiagnosticKind;
	readonly severity: ProviderTroubleshootingSeverity;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly role: ModelRole | null;
	readonly readinessCode: string | null;
	readonly message: string;
	readonly safeDiagnostic: ProviderTroubleshootingSafeDiagnostic;
}

export interface ProviderTroubleshootingAction {
	readonly id: string;
	readonly kind: ProviderTroubleshootingActionKind;
	readonly severity: ProviderTroubleshootingSeverity;
	readonly label: string;
	readonly description: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly role: ModelRole | null;
	readonly disabledReason?: string;
}

export interface ProviderTroubleshootingRecovery {
	readonly commandId: string;
	readonly providerId: ProviderId | null;
	readonly modelId: ProviderModelId | null;
	readonly readinessCode: string | null;
	readonly cachePath: NormalizedVaultPath | null;
	readonly reportId: string | null;
	readonly sourcePathCount: number;
	readonly validationOutput: readonly string[];
}

export interface ProviderTroubleshootingReport {
	readonly reportId: string;
	readonly generatedAt: IsoTimestamp;
	readonly severity: ProviderTroubleshootingSeverity;
	readonly summary: string;
	readonly providerCount: number;
	readonly roleProblemCount: number;
	readonly cloudDisclosureRequired: boolean;
	readonly isCloudProviderBlocked: boolean;
	readonly diagnostics: readonly ProviderTroubleshootingDiagnostic[];
	readonly actions: readonly ProviderTroubleshootingAction[];
	readonly recovery: ProviderTroubleshootingRecovery;
}

export interface ProviderTroubleshootingActionOutcome {
	readonly action: ProviderTroubleshootingActionKind;
	readonly accepted: boolean;
	readonly message: string;
	readonly providerId: ProviderId | null;
	readonly reportId: string | null;
}

export type ProviderSetupPreflightDenialCode =
	| "role-not-selected"
	| "auth-not-ready"
	| "local-readiness-not-ready"
	| "privacy-denied"
	| "capability-denied"
	| "invalid-preflight-request";

export interface ProviderSetupPreflightRequest {
	readonly role: ModelRole;
	readonly requiredCapability?: ModelCapability;
	readonly contentSensitivity: ContentSensitivity;
	readonly sourcePaths?: readonly NormalizedVaultPath[];
	readonly workflowId?: string;
	readonly userFacingPurpose?: string;
}

export interface ProviderSetupPreflightAllowed {
	readonly allowed: true;
	readonly provider: ProviderDefinition;
	readonly modelId: ProviderModelId;
	readonly policy: ProviderPrivacyPolicy;
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface ProviderSetupPreflightDenied {
	readonly allowed: false;
	readonly code: ProviderSetupPreflightDenialCode;
	readonly userMessage: string;
	readonly diagnosticReason: string;
	readonly diagnostic: RedactedDiagnosticObject;
}

export type ProviderSetupPreflightDecision = ProviderSetupPreflightAllowed | ProviderSetupPreflightDenied;

export const isLocalRuntimeFamily = (value: unknown): value is LocalRuntimeFamily =>
	typeof value === "string" && LOCAL_RUNTIME_FAMILIES.includes(value as LocalRuntimeFamily);

export const isLocalRuntimeReadinessStatus = (value: unknown): value is LocalRuntimeReadinessStatus =>
	typeof value === "string" && LOCAL_RUNTIME_READINESS_STATUSES.includes(value as LocalRuntimeReadinessStatus);

export const isLocalRuntimeReadinessCode = (value: unknown): value is LocalRuntimeReadinessCode =>
	typeof value === "string" && LOCAL_RUNTIME_READINESS_CODES.includes(value as LocalRuntimeReadinessCode);

export const isOpenAICompatibleEndpointClassification = (
	value: unknown,
): value is OpenAICompatibleEndpointClassification =>
	typeof value === "string" &&
	OPENAI_COMPATIBLE_ENDPOINT_CLASSIFICATIONS.includes(value as OpenAICompatibleEndpointClassification);

export const isOpenAICompatibleReadinessStatus = (value: unknown): value is OpenAICompatibleReadinessStatus =>
	typeof value === "string" &&
	OPENAI_COMPATIBLE_READINESS_STATUSES.includes(value as OpenAICompatibleReadinessStatus);

export const isOpenAICompatibleReadinessCode = (value: unknown): value is OpenAICompatibleReadinessCode =>
	typeof value === "string" && OPENAI_COMPATIBLE_READINESS_CODES.includes(value as OpenAICompatibleReadinessCode);

export const isProviderTroubleshootingActionKind = (value: unknown): value is ProviderTroubleshootingActionKind =>
	typeof value === "string" &&
	PROVIDER_TROUBLESHOOTING_ACTION_KINDS.includes(value as ProviderTroubleshootingActionKind);
