import type {
	LocalRuntimeReadinessDenialCode,
	LocalRuntimeReadinessProbe,
	LocalRuntimeReadinessProbeResult,
	UserProviderProfile,
} from "../../../src/types/provider-setup";
import { makeProviderId, makeProviderModelId } from "../../../src/types/providers";

export const SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID = makeProviderId("synthetic-local-runtime");
export const SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID = makeProviderModelId("synthetic-local-runtime-chat");
export const SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID = makeProviderModelId("synthetic-local-runtime-embedding");

export const SYNTHETIC_LOCAL_RUNTIME_PROFILE_INPUT = {
	id: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	displayName: "Synthetic Local Runtime",
	providerKind: "local",
	profileKind: "local",
	trustLevel: "local-runtime",
	runtimeFamily: "generic-openai-compatible",
	endpoint: {
		baseUrl: "http://localhost:11434/v1",
		isCloudEndpoint: false,
	},
	credentialReference: null,
	models: [
		{
			id: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
			displayName: "Synthetic Local Runtime Chat",
			roles: ["chat"],
			capabilities: ["chat", "streaming"],
			isDefault: true,
		},
		{
			id: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
			displayName: "Synthetic Local Runtime Embedding",
			roles: ["embedding"],
			capabilities: ["embeddings"],
			embeddingFamily: "synthetic-local-runtime-embeddings",
		},
	],
} as const;

export const SYNTHETIC_LOCAL_RUNTIME_READY_MODELS = [
	{
		id: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
		displayName: "Synthetic Local Runtime Chat",
		roles: ["chat"],
		capabilities: ["chat", "streaming"],
	},
	{
		id: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
		displayName: "Synthetic Local Runtime Embedding",
		roles: ["embedding"],
		capabilities: ["embeddings"],
		embeddingFamily: "synthetic-local-runtime-embeddings",
	},
] as const;

export const SYNTHETIC_LOCAL_RUNTIME_CHAT_ONLY_MODELS = [SYNTHETIC_LOCAL_RUNTIME_READY_MODELS[0]] as const;

export const SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_ONLY_MODELS = [SYNTHETIC_LOCAL_RUNTIME_READY_MODELS[1]] as const;

export const SYNTHETIC_LOCAL_RUNTIME_DUPLICATE_MODELS = [
	SYNTHETIC_LOCAL_RUNTIME_READY_MODELS[0],
	SYNTHETIC_LOCAL_RUNTIME_READY_MODELS[0],
] as const;

export const SYNTHETIC_LOCAL_RUNTIME_MALFORMED_MODELS = [
	{
		displayName: "Synthetic Runtime Model Without Id",
		roles: ["chat"],
		capabilities: ["chat"],
	},
] as const;

export const SYNTHETIC_LOCAL_RUNTIME_MISMATCH_MODELS = [
	{
		id: SYNTHETIC_LOCAL_RUNTIME_CHAT_MODEL_ID,
		displayName: "Synthetic Runtime Mismatch",
		roles: ["chat"],
		capabilities: ["embeddings"],
	},
	{
		id: SYNTHETIC_LOCAL_RUNTIME_EMBEDDING_MODEL_ID,
		displayName: "Synthetic Runtime Embedding",
		roles: ["embedding"],
		capabilities: ["embeddings"],
	},
] as const;

export const SYNTHETIC_LOCAL_RUNTIME_SAFE_DIAGNOSTIC = {
	providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	endpointHost: "localhost",
	statusCode: 200,
	modelCount: 2,
} as const;

export const SYNTHETIC_LOCAL_RUNTIME_REDACTION_DIAGNOSTIC = {
	providerId: SYNTHETIC_LOCAL_RUNTIME_PROVIDER_ID,
	runtimeSecret: "inline-runtime-value",
	promptPreview: "Synthetic setup probe text only.",
} as const;

export const readyLocalRuntimeProbe =
	(
		models: readonly unknown[] = SYNTHETIC_LOCAL_RUNTIME_READY_MODELS,
		diagnostic: unknown = SYNTHETIC_LOCAL_RUNTIME_SAFE_DIAGNOSTIC,
	): LocalRuntimeReadinessProbe =>
	async () => ({
		ok: true,
		statusCode: 200,
		models,
		diagnostic,
	});

export const failedLocalRuntimeProbe =
	(code: LocalRuntimeReadinessDenialCode, diagnostic: unknown): LocalRuntimeReadinessProbe =>
	async () => ({
		ok: false,
		code,
		diagnostic,
	});

export const timeoutLocalRuntimeProbe = (): LocalRuntimeReadinessProbe => () =>
	new Promise<LocalRuntimeReadinessProbeResult>(() => undefined);

export const localRuntimeProfileWithModels = (
	profile: UserProviderProfile,
	models: UserProviderProfile["models"],
): UserProviderProfile => {
	if (profile.localRuntime === undefined) {
		return {
			...profile,
			models,
		};
	}

	return {
		...profile,
		models,
		localRuntime: {
			...profile.localRuntime,
			modelCount: models.length,
			chatModelCount: models.filter((model) => model.roles.includes("chat")).length,
			embeddingModelCount: models.filter((model) => model.roles.includes("embedding")).length,
		},
	};
};
