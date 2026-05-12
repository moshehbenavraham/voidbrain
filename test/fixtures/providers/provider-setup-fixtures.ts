import { makeProviderId, makeProviderModelId } from "../../../src/types/providers";
import type { SecretReference } from "../../../src/types/providers";

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
