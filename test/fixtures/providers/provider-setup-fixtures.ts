import type { LocalRuntimeReadinessRecord } from "../../../src/types/provider-setup";
import { makeProviderId, makeProviderModelId } from "../../../src/types/providers";
import type { SecretReference } from "../../../src/types/providers";

export {
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_ID,
	OPENAI_COMPATIBLE_AUTH_FAILED_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_ID,
	OPENAI_COMPATIBLE_CAPABILITY_MISMATCH_PROFILE_INPUT,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_ID,
	OPENAI_COMPATIBLE_CUSTOM_REMOTE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_ID,
	OPENAI_COMPATIBLE_LOCAL_PROFILE_INPUT,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_ID,
	OPENAI_COMPATIBLE_MISSING_SECRET_PROFILE_INPUT,
	OPENAI_COMPATIBLE_REMOTE_WITHOUT_REFERENCE_PROFILE_INPUT,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_TRUSTED_CLOUD_PROFILE_INPUT,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_ID,
	OPENAI_COMPATIBLE_UNTRUSTED_CLOUD_PROFILE_INPUT,
	failedOpenAICompatibleAuthStatus,
	fixedOpenAICompatibleCheckedAt,
	passedOpenAICompatibleAuthStatus,
} from "./openai-compatible-provider-fixtures";

export const SYNTHETIC_LOCAL_PROFILE_ID = makeProviderId("synthetic-local-profile");
export const SYNTHETIC_CLOUD_PROFILE_ID = makeProviderId("synthetic-openai-compatible-profile");
export const SYNTHETIC_DUPLICATE_PROFILE_ID = makeProviderId("synthetic-duplicate-profile");

export const SYNTHETIC_PROFILE_REFERENCE: SecretReference = {
	kind: "provider-secret",
	id: "provider-reference:synthetic-openai-compatible-profile:runtime-reference",
	providerId: SYNTHETIC_CLOUD_PROFILE_ID,
	label: "Synthetic Runtime Reference",
	createdAt: "2026-05-13T00:00:00.000Z",
	updatedAt: "2026-05-13T00:00:00.000Z",
};

export const SYNTHETIC_LOCAL_PROFILE_INPUT = {
	id: SYNTHETIC_LOCAL_PROFILE_ID,
	displayName: "Synthetic Local Profile",
	providerKind: "local",
	profileKind: "local",
	trustLevel: "local-runtime",
	runtimeFamily: "generic-openai-compatible",
	endpoint: {
		baseUrl: "http://127.0.0.1:11434/v1",
		isCloudEndpoint: false,
	},
	credentialReference: null,
	models: [
		{
			id: makeProviderModelId("synthetic-local-chat"),
			displayName: "Synthetic Local Chat",
			roles: ["chat"],
			capabilities: ["chat", "streaming"],
			isDefault: true,
		},
		{
			id: makeProviderModelId("synthetic-local-embedding"),
			displayName: "Synthetic Local Embedding",
			roles: ["embedding"],
			capabilities: ["embeddings"],
			embeddingFamily: "synthetic-local-embeddings",
		},
	],
} as const;

export const SYNTHETIC_CLOUD_PROFILE_INPUT = {
	id: SYNTHETIC_CLOUD_PROFILE_ID,
	displayName: "Synthetic OpenAI Compatible Profile",
	providerKind: "cloud",
	profileKind: "openai-compatible",
	trustLevel: "trusted-cloud",
	endpoint: {
		baseUrl: "https://provider.example.invalid/v1",
		isCloudEndpoint: true,
	},
	credentialReference: SYNTHETIC_PROFILE_REFERENCE,
	models: [
		{
			id: makeProviderModelId("synthetic-cloud-chat"),
			displayName: "Synthetic Cloud Chat",
			roles: ["chat"],
			capabilities: ["chat", "streaming", "tools"],
			isDefault: true,
		},
		{
			id: makeProviderModelId("synthetic-cloud-embedding"),
			displayName: "Synthetic Cloud Embedding",
			roles: ["embedding"],
			capabilities: ["embeddings"],
			embeddingFamily: "synthetic-cloud-embeddings",
		},
	],
} as const;

export const SYNTHETIC_DUPLICATE_PROFILE_INPUTS = [
	{
		...SYNTHETIC_LOCAL_PROFILE_INPUT,
		id: SYNTHETIC_DUPLICATE_PROFILE_ID,
		displayName: "Synthetic Duplicate One",
	},
	{
		...SYNTHETIC_LOCAL_PROFILE_INPUT,
		id: SYNTHETIC_DUPLICATE_PROFILE_ID,
		displayName: "Synthetic Duplicate Two",
	},
] as const;

export const SYNTHETIC_SAFE_AUTH_DIAGNOSTIC = {
	providerId: SYNTHETIC_CLOUD_PROFILE_ID,
	statusCode: 200,
	modelCount: 2,
	headerCount: 1,
} as const;

export const SYNTHETIC_LOCAL_READY_READINESS_RECORD: LocalRuntimeReadinessRecord = {
	providerId: SYNTHETIC_LOCAL_PROFILE_ID,
	status: "ready",
	code: "ready",
	checkedAt: "2026-05-13T00:00:00.000Z",
	durationMs: 1,
	modelCount: 2,
	chatModelCount: 1,
	embeddingModelCount: 1,
	modelIds: [makeProviderModelId("synthetic-local-chat"), makeProviderModelId("synthetic-local-embedding")],
	chatModelIds: [makeProviderModelId("synthetic-local-chat")],
	embeddingModelIds: [makeProviderModelId("synthetic-local-embedding")],
	diagnostic: {
		providerId: SYNTHETIC_LOCAL_PROFILE_ID,
		modelCount: 2,
	},
};

export const SYNTHETIC_LOCAL_OFFLINE_READINESS_RECORD: LocalRuntimeReadinessRecord = {
	providerId: SYNTHETIC_LOCAL_PROFILE_ID,
	status: "not-ready",
	code: "offline",
	checkedAt: "2026-05-13T00:00:00.000Z",
	durationMs: 1,
	modelCount: 0,
	chatModelCount: 0,
	embeddingModelCount: 0,
	modelIds: [],
	chatModelIds: [],
	embeddingModelIds: [],
	diagnostic: {
		providerId: SYNTHETIC_LOCAL_PROFILE_ID,
		reason: "offline",
	},
};
