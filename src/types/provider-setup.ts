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
import type { NormalizedVaultPath } from "./vault";

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
] as const;

export type UserProviderProfileKind = (typeof USER_PROVIDER_PROFILE_KINDS)[number];
export type ProviderAuthTestStatus = (typeof PROVIDER_AUTH_TEST_STATUSES)[number];
export type ProviderSetupSeverity = (typeof PROVIDER_SETUP_SEVERITIES)[number];
export type ProviderRoleCapabilityStatus = (typeof PROVIDER_ROLE_CAPABILITY_STATUSES)[number];

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

export interface UserProviderProfile {
	readonly id: ProviderId;
	readonly displayName: string;
	readonly profileKind: UserProviderProfileKind;
	readonly providerKind: ProviderKind;
	readonly trustLevel: ProviderTrustLevel;
	readonly endpoint: ProviderEndpointMetadata;
	readonly credentialReference: SecretReference | null;
	readonly models: readonly UserProviderModelProfile[];
}

export type ProviderProfileValidationCode =
	| "invalid-profile"
	| "unsafe-provider-state"
	| "duplicate-profile-id"
	| "endpoint-invalid"
	| "model-invalid";

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

export interface ProviderSetupSummary {
	readonly severity: ProviderSetupSeverity;
	readonly providerCount: number;
	readonly userProfileCount: number;
	readonly configuredCredentialCount: number;
	readonly passedAuthCount: number;
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

export type ProviderSetupPreflightDenialCode =
	| "role-not-selected"
	| "auth-not-ready"
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
