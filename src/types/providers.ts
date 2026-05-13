import type {
	OpenAICompatibleEndpointClassification,
	OpenAICompatibleReadinessCode,
	OpenAICompatibleReadinessStatus,
} from "./provider-setup";
import type { NormalizedVaultPath } from "./vault";

export const PROVIDER_KINDS = ["local", "cloud"] as const;
export const PROVIDER_TRUST_LEVELS = ["local-runtime", "trusted-cloud", "untrusted-cloud"] as const;
export const MODEL_ROLES = ["chat", "embedding", "utility"] as const;
export const MODEL_CAPABILITIES = ["chat", "embeddings", "streaming", "tools", "attachments"] as const;
export const CONTENT_SENSITIVITIES = ["public", "vault-metadata", "private-vault"] as const;
export const PROVIDER_PROFILE_SOURCES = ["baseline", "user-profile"] as const;
export const PROVIDER_AUTH_STATES = ["untested", "passed", "failed", "timeout", "missing-secret"] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];
export type ProviderTrustLevel = (typeof PROVIDER_TRUST_LEVELS)[number];
export type ModelRole = (typeof MODEL_ROLES)[number];
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export type ContentSensitivity = (typeof CONTENT_SENSITIVITIES)[number];
export type ProviderProfileSource = (typeof PROVIDER_PROFILE_SOURCES)[number];
export type ProviderAuthState = (typeof PROVIDER_AUTH_STATES)[number];

export type ProviderId = string & { readonly __providerId: unique symbol };
export type ProviderModelId = string & { readonly __providerModelId: unique symbol };

export interface ProviderIdentity {
	readonly id: ProviderId;
	readonly displayName: string;
	readonly kind: ProviderKind;
	readonly trustLevel: ProviderTrustLevel;
}

export interface ProviderDefinition extends ProviderIdentity {
	readonly models: readonly ProviderModelDefinition[];
	readonly setupMetadata?: ProviderSetupSafeMetadata;
}

export interface ProviderModelDefinition {
	readonly id: ProviderModelId;
	readonly providerId: ProviderId;
	readonly displayName: string;
	readonly roles: readonly ModelRole[];
	readonly capabilities: readonly ModelCapability[];
	readonly isDefault?: boolean;
	readonly embeddingFamily?: string;
}

export interface ProviderPrivacyPolicy {
	readonly areCloudProvidersEnabled: boolean;
	readonly trustedProviderIds: readonly ProviderId[];
}

export interface ProviderEndpointContract {
	readonly baseUrl: string | null;
	readonly isCloudEndpoint: boolean;
	readonly hostname: string | null;
}

export interface ProviderSetupSafeMetadata {
	readonly source: ProviderProfileSource;
	readonly endpoint: ProviderEndpointContract | null;
	readonly hasCredentialReference: boolean;
	readonly authState: ProviderAuthState;
	readonly modelCount: number;
	readonly localRuntime?: ProviderSetupSafeLocalRuntimeMetadata;
	readonly localReadiness?: ProviderSetupSafeLocalReadinessEvidence;
	readonly openaiCompatible?: ProviderSetupSafeOpenAICompatibleMetadata;
	readonly authReadiness?: ProviderSetupSafeAuthReadinessEvidence;
	readonly capabilityReadiness?: readonly ProviderSetupSafeCapabilityReadinessEvidence[];
}

export interface ProviderSetupSafeModelMetadata {
	readonly providerId: ProviderId;
	readonly modelId: ProviderModelId;
	readonly roles: readonly ModelRole[];
	readonly capabilities: readonly ModelCapability[];
	readonly embeddingFamily?: string;
}

export interface ProviderSetupSafeLocalRuntimeMetadata {
	readonly runtimeFamily: string;
	readonly endpointHost: string | null;
	readonly chatModelCount: number;
	readonly embeddingModelCount: number;
}

export interface ProviderSetupSafeLocalReadinessEvidence {
	readonly status: string;
	readonly code: string;
	readonly checkedAt: string;
	readonly durationMs: number;
	readonly modelCount: number;
	readonly chatModelCount: number;
	readonly embeddingModelCount: number;
}

export interface ProviderSetupSafeOpenAICompatibleMetadata {
	readonly endpointClassification: OpenAICompatibleEndpointClassification;
	readonly endpointHost: string | null;
	readonly isRemoteDisclosureRequired: boolean;
	readonly isTrustRequired: boolean;
	readonly isCredentialRequired: boolean;
	readonly chatModelCount: number;
	readonly streamingModelCount: number;
	readonly embeddingModelCount: number;
	readonly toolModelCount: number;
	readonly attachmentModelCount: number;
}

export interface ProviderSetupSafeAuthReadinessEvidence {
	readonly status: OpenAICompatibleReadinessStatus;
	readonly code: OpenAICompatibleReadinessCode;
	readonly endpointClassification: OpenAICompatibleEndpointClassification;
	readonly checkedAt: string;
	readonly durationMs: number;
	readonly statusCode: number | null;
	readonly modelCount: number;
}

export interface ProviderSetupSafeCapabilityReadinessEvidence {
	readonly role: ModelRole;
	readonly requiredCapability: ModelCapability;
	readonly status: OpenAICompatibleReadinessStatus;
	readonly code: OpenAICompatibleReadinessCode;
	readonly modelId: ProviderModelId | null;
	readonly modelCount: number;
}

export const makeProviderId = (id: string): ProviderId => id as ProviderId;

export const makeProviderModelId = (id: string): ProviderModelId => id as ProviderModelId;

export const assertNeverProviderValue = (value: never): never => {
	throw new Error(`Unhandled provider contract value: ${String(value)}`);
};

export const isProviderKind = (value: unknown): value is ProviderKind =>
	typeof value === "string" && PROVIDER_KINDS.includes(value as ProviderKind);

export const isProviderTrustLevel = (value: unknown): value is ProviderTrustLevel =>
	typeof value === "string" && PROVIDER_TRUST_LEVELS.includes(value as ProviderTrustLevel);

export const isModelRole = (value: unknown): value is ModelRole =>
	typeof value === "string" && MODEL_ROLES.includes(value as ModelRole);

export const isModelCapability = (value: unknown): value is ModelCapability =>
	typeof value === "string" && MODEL_CAPABILITIES.includes(value as ModelCapability);

export const isContentSensitivity = (value: unknown): value is ContentSensitivity =>
	typeof value === "string" && CONTENT_SENSITIVITIES.includes(value as ContentSensitivity);

export const isProviderAuthState = (value: unknown): value is ProviderAuthState =>
	typeof value === "string" && PROVIDER_AUTH_STATES.includes(value as ProviderAuthState);

export const isCloudProviderKind = (kind: ProviderKind): boolean => {
	switch (kind) {
		case "cloud":
			return true;
		case "local":
			return false;
		default:
			return assertNeverProviderValue(kind);
	}
};

export const isTrustedProviderForCloud = (trustLevel: ProviderTrustLevel): boolean => {
	switch (trustLevel) {
		case "trusted-cloud":
			return true;
		case "local-runtime":
		case "untrusted-cloud":
			return false;
		default:
			return assertNeverProviderValue(trustLevel);
	}
};

export const isRoleCapabilityCompatible = (role: ModelRole, capability: ModelCapability): boolean => {
	switch (role) {
		case "chat":
			return capability === "chat" || capability === "streaming" || capability === "tools";
		case "embedding":
			return capability === "embeddings";
		case "utility":
			return capability === "attachments";
		default:
			return assertNeverProviderValue(role);
	}
};

export interface CapabilitySelectionRequest {
	readonly providerId: ProviderId;
	readonly requiredCapability: ModelCapability;
	readonly preferredModelId?: ProviderModelId;
	readonly requiredRole?: ModelRole;
}

export type CapabilitySelectionDenialCode =
	| "invalid-request"
	| "provider-not-found"
	| "model-not-found"
	| "capability-unsupported";

export interface CapabilitySelectionDenied {
	readonly ok: false;
	readonly code: CapabilitySelectionDenialCode;
	readonly message: string;
	readonly field?: string;
}

export interface CapabilitySelectionAllowed {
	readonly ok: true;
	readonly provider: ProviderDefinition;
	readonly model: ProviderModelDefinition;
	readonly requiredCapability: ModelCapability;
}

export type CapabilitySelectionDecision = CapabilitySelectionAllowed | CapabilitySelectionDenied;

export interface DisclosureRequest {
	readonly providerId: ProviderId;
	readonly requiredCapability: ModelCapability;
	readonly contentSensitivity: ContentSensitivity;
	readonly preferredModelId?: ProviderModelId;
	readonly requiredRole?: ModelRole;
	readonly sourcePaths?: readonly NormalizedVaultPath[];
	readonly workflowId?: string;
	readonly userFacingPurpose?: string;
}

export type DisclosureDenialCode =
	| "invalid-request"
	| "provider-not-found"
	| "cloud-disabled"
	| "provider-not-trusted"
	| "private-content-cloud-denied";

export interface DisclosureAllowedDecision {
	readonly allowed: true;
	readonly provider: ProviderDefinition;
	readonly request: DisclosureRequest;
	readonly reason: string;
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface DisclosureDeniedDecision {
	readonly allowed: false;
	readonly code: DisclosureDenialCode;
	readonly request?: DisclosureRequest;
	readonly userMessage: string;
	readonly diagnosticReason: string;
	readonly diagnostic: RedactedDiagnosticObject;
}

export type DisclosureDecision = DisclosureAllowedDecision | DisclosureDeniedDecision;

export type ProviderInvocationPreflightDenialCode = DisclosureDenialCode | CapabilitySelectionDenialCode;

export interface ProviderInvocationPreflightAllowed {
	readonly allowed: true;
	readonly provider: ProviderDefinition;
	readonly model: ProviderModelDefinition;
	readonly disclosure: DisclosureAllowedDecision;
}

export interface ProviderInvocationPreflightDenied {
	readonly allowed: false;
	readonly code: ProviderInvocationPreflightDenialCode;
	readonly userMessage: string;
	readonly diagnosticReason: string;
	readonly diagnostic: RedactedDiagnosticObject;
}

export type ProviderInvocationPreflightDecision =
	| ProviderInvocationPreflightAllowed
	| ProviderInvocationPreflightDenied;

export interface SecretReference {
	readonly kind: "provider-secret";
	readonly id: string;
	readonly providerId: ProviderId;
	readonly label: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export type RedactedDiagnosticPrimitive = string | number | boolean | null;
export type RedactedDiagnostic = RedactedDiagnosticPrimitive | readonly RedactedDiagnostic[] | RedactedDiagnosticObject;

export interface RedactedDiagnosticObject {
	readonly [key: string]: RedactedDiagnostic;
}

export type RedactionErrorCode = "invalid-diagnostic-input";

export interface RedactionFailure {
	readonly ok: false;
	readonly code: RedactionErrorCode;
	readonly message: string;
	readonly field?: string;
}

export interface RedactionSuccess {
	readonly ok: true;
	readonly value: RedactedDiagnostic;
}

export type RedactionResult = RedactionSuccess | RedactionFailure;
