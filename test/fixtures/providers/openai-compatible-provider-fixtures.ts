import type { OpenAICompatibleEndpointClassification, ProviderAuthTestRecord } from "../../../src/types/provider-setup";
import { type SecretReference, makeProviderId, makeProviderModelId } from "../../../src/types/providers";

export const OPENAI_COMPATIBLE_LOCAL_PROFILE_ID = makeProviderId("synthetic-openai-local-compatible");
export const OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID = makeProviderId("synthetic-openai-custom-remote");
export const OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID = makeProviderId("synthetic-openai-trusted-cloud");
export const OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID = makeProviderId("synthetic-openai-untrusted-cloud");
export const OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID = makeProviderId("synthetic-openai-missing-secret");
export const OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID = makeProviderId("synthetic-openai-auth-failed");
export const OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID = makeProviderId("synthetic-openai-capability-mismatch");

export const fixedOpenAICompatibleCheckedAt = "2026-05-13T00:00:00.000Z";

const createReference = (providerId: ReturnType<typeof makeProviderId>, label: string): SecretReference => ({
	kind: "provider-secret",
	id: `provider-reference:${providerId}:runtime-reference`,
	providerId,
	label,
	createdAt: fixedOpenAICompatibleCheckedAt,
	updatedAt: fixedOpenAICompatibleCheckedAt,
});

export const OPENAI_COMPATIBLE_CUSTOM_REMOTE_REFERENCE = createReference(
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
	"Synthetic Custom Remote Reference",
);
export const OPENAI_COMPATIBLE_TRUSTED_CLOUD_REFERENCE = createReference(
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	"Synthetic Trusted Cloud Reference",
);
export const OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_REFERENCE = createReference(
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
	"Synthetic Untrusted Cloud Reference",
);
export const OPENAI_COMPATIBLE_MISSING_SECRET_REFERENCE = createReference(
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	"Synthetic Missing Secret Reference",
);
export const OPENAI_COMPATIBLE_AUTH_FAILED_REFERENCE = createReference(
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	"Synthetic Failed Auth Reference",
);
export const OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_REFERENCE = createReference(
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	"Synthetic Capability Mismatch Reference",
);

export const OPENAI_COMPATIBLE_CHAT_MODEL_INPUT = {
	id: makeProviderModelId("synthetic-openai-chat"),
	displayName: "Synthetic OpenAI Compatible Chat",
	roles: ["chat"],
	capabilities: ["chat", "streaming", "tools"],
	isDefault: true,
} as const;

export const OPENAI_COMPATIBLE_EMBEDDING_MODEL_INPUT = {
	id: makeProviderModelId("synthetic-openai-embedding"),
	displayName: "Synthetic OpenAI Compatible Embedding",
	roles: ["embedding"],
	capabilities: ["embeddings"],
	embeddingFamily: "synthetic-openai-compatible-embeddings",
} as const;

export const OPENAI_COMPATIBLE_ATTACHMENT_MODEL_INPUT = {
	id: makeProviderModelId("synthetic-openai-attachment"),
	displayName: "Synthetic OpenAI Compatible Attachment",
	roles: ["utility"],
	capabilities: ["attachments"],
} as const;

export const OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
	displayName: "Synthetic OpenAI Local Compatible",
	profileKind: "openai-compatible",
	providerKind: "local",
	trustLevel: "local-runtime",
	endpointClassification: "local-compatible",
	endpoint: {
		baseUrl: "http://localhost:12345/v1",
		isCloudEndpoint: false,
	},
	credentialReference: null,
	models: [OPENAI_COMPATIBLE_CHAT_MODEL_INPUT, OPENAI_COMPATIBLE_EMBEDDING_MODEL_INPUT],
} as const;

export const OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
	displayName: "Synthetic OpenAI Custom Remote",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "trusted-cloud",
	endpointClassification: "custom-remote",
	endpoint: {
		baseUrl: "https://llm-gateway.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_CUSTOM_REMOTE_REFERENCE,
	models: [OPENAI_COMPATIBLE_CHAT_MODEL_INPUT, OPENAI_COMPATIBLE_EMBEDDING_MODEL_INPUT],
} as const;

export const OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	displayName: "Synthetic OpenAI Trusted Cloud",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "trusted-cloud",
	endpointClassification: "trusted-cloud",
	endpoint: {
		baseUrl: "https://api.openai.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_TRUSTED_CLOUD_REFERENCE,
	models: [
		OPENAI_COMPATIBLE_CHAT_MODEL_INPUT,
		OPENAI_COMPATIBLE_EMBEDDING_MODEL_INPUT,
		OPENAI_COMPATIBLE_ATTACHMENT_MODEL_INPUT,
	],
} as const;

export const OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
	displayName: "Synthetic OpenAI Untrusted Cloud",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "untrusted-cloud",
	endpointClassification: "untrusted-cloud",
	endpoint: {
		baseUrl: "https://untrusted-openai.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_REFERENCE,
	models: [OPENAI_COMPATIBLE_CHAT_MODEL_INPUT],
} as const;

export const OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	displayName: "Synthetic OpenAI Missing Secret",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "trusted-cloud",
	endpointClassification: "trusted-cloud",
	endpoint: {
		baseUrl: "https://missing-secret.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_MISSING_SECRET_REFERENCE,
	models: [OPENAI_COMPATIBLE_CHAT_MODEL_INPUT],
} as const;

export const OPENAI_COMPATIBLE_REMOTE_WITHOUT_REFERENCE_PROFILE_INPUT = {
	...OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	credentialReference: null,
} as const;

export const OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	displayName: "Synthetic OpenAI Auth Failed",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "trusted-cloud",
	endpointClassification: "trusted-cloud",
	endpoint: {
		baseUrl: "https://auth-failed.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_AUTH_FAILED_REFERENCE,
	models: [OPENAI_COMPATIBLE_CHAT_MODEL_INPUT],
} as const;

export const OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT = {
	id: OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	displayName: "Synthetic OpenAI Capability Mismatch",
	profileKind: "openai-compatible",
	providerKind: "cloud",
	trustLevel: "trusted-cloud",
	endpointClassification: "trusted-cloud",
	endpoint: {
		baseUrl: "https://capability-mismatch.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_REFERENCE,
	models: [OPENAI_COMPATIBLE_EMBEDDING_MODEL_INPUT],
} as const;

export const passedOpenAICompatibleAuthStatus = (
	providerId: ReturnType<typeof makeProviderId>,
	endpointClassification: OpenAICompatibleEndpointClassification,
	modelCount = 2,
): ProviderAuthTestRecord => ({
	providerId,
	status: "passed",
	checkedAt: fixedOpenAICompatibleCheckedAt,
	statusCode: 200,
	modelCount,
	durationMs: 1,
	diagnostic: {
		providerId,
		modelCount,
	},
	openaiCompatibleReadiness: {
		providerId,
		status: "ready",
		code: "ready",
		endpointClassification,
		checkedAt: fixedOpenAICompatibleCheckedAt,
		durationMs: 1,
		statusCode: 200,
		modelCount,
		diagnostic: {
			providerId,
			modelCount,
		},
	},
});

export const failedOpenAICompatibleAuthStatus = (
	providerId: ReturnType<typeof makeProviderId>,
	endpointClassification: OpenAICompatibleEndpointClassification,
): ProviderAuthTestRecord => ({
	providerId,
	status: "failed",
	checkedAt: fixedOpenAICompatibleCheckedAt,
	statusCode: 401,
	modelCount: 0,
	durationMs: 1,
	diagnostic: {
		providerId,
		reason: "synthetic-auth-failed",
	},
	openaiCompatibleReadiness: {
		providerId,
		status: "not-ready",
		code: "auth-failed",
		endpointClassification,
		checkedAt: fixedOpenAICompatibleCheckedAt,
		durationMs: 1,
		statusCode: 401,
		modelCount: 0,
		diagnostic: {
			providerId,
			reason: "synthetic-auth-failed",
		},
	},
});
