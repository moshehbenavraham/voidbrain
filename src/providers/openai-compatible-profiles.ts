import type {
	OpenAICompatibleAuthReadinessRecord,
	OpenAICompatibleCapabilityReadinessRecord,
	OpenAICompatibleEndpointClassification,
	OpenAICompatibleProfileMetadata,
	OpenAICompatibleReadinessCode,
	OpenAICompatibleReadinessStatus,
	ProviderAuthTestRecord,
	ProviderEndpointMetadata,
	ProviderProfileValidationError,
	UserProviderModelProfile,
	UserProviderProfile,
} from "../types/provider-setup";
import type {
	ModelCapability,
	ModelRole,
	ProviderDefinition,
	ProviderKind,
	ProviderModelDefinition,
	ProviderModelId,
	ProviderTrustLevel,
	RedactedDiagnosticObject,
} from "../types/providers";
import { assertNeverProviderValue } from "../types/providers";
import { findModel, modelSupportsCapability } from "./capability-selection";
import { redactDiagnostic } from "./redaction";

export interface OpenAICompatibleEndpointClassificationInput {
	readonly providerKind: ProviderKind;
	readonly trustLevel: ProviderTrustLevel;
	readonly endpoint: ProviderEndpointMetadata;
	readonly declaredClassification?: OpenAICompatibleEndpointClassification;
}

export interface OpenAICompatibleEndpointClassificationSuccess {
	readonly ok: true;
	readonly endpointClassification: OpenAICompatibleEndpointClassification;
	readonly isRemoteDisclosureRequired: boolean;
	readonly isTrustRequired: boolean;
	readonly isCredentialRequired: boolean;
}

export interface OpenAICompatibleEndpointClassificationFailure {
	readonly ok: false;
	readonly errors: readonly ProviderProfileValidationError[];
}

export type OpenAICompatibleEndpointClassificationResult =
	| OpenAICompatibleEndpointClassificationSuccess
	| OpenAICompatibleEndpointClassificationFailure;

const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

const profileError = (
	code: ProviderProfileValidationError["code"],
	field: string,
	message: string,
): ProviderProfileValidationError => ({ code, field, message });

const isLocalHost = (hostname: string | null): boolean => {
	if (hostname === null) {
		return false;
	}

	return localHostnames.has(hostname) || hostname.endsWith(".localhost");
};

const endpointIsLocalCompatible = (endpoint: ProviderEndpointMetadata): boolean =>
	!endpoint.isCloudEndpoint || isLocalHost(endpoint.hostname);

const inferredRemoteClassification = (
	trustLevel: ProviderTrustLevel,
	declaredClassification?: OpenAICompatibleEndpointClassification,
): OpenAICompatibleEndpointClassification => {
	if (
		declaredClassification === "custom-remote" ||
		declaredClassification === "trusted-cloud" ||
		declaredClassification === "untrusted-cloud"
	) {
		return declaredClassification;
	}

	return trustLevel === "trusted-cloud" ? "trusted-cloud" : "untrusted-cloud";
};

export const isOpenAICompatibleRemoteClassification = (
	classification: OpenAICompatibleEndpointClassification,
): boolean => classification !== "local-compatible";

export const classifyOpenAICompatibleEndpoint = (
	input: OpenAICompatibleEndpointClassificationInput,
): OpenAICompatibleEndpointClassificationResult => {
	const errors: ProviderProfileValidationError[] = [];
	const isLocalEndpoint = endpointIsLocalCompatible(input.endpoint);
	const classification = isLocalEndpoint
		? "local-compatible"
		: inferredRemoteClassification(input.trustLevel, input.declaredClassification);

	if (input.declaredClassification === "local-compatible" && !isLocalEndpoint) {
		errors.push(
			profileError(
				"endpoint-classification-mismatch",
				"endpointClassification",
				"local-compatible OpenAI-compatible endpoints must resolve to a local host.",
			),
		);
	}

	if (
		input.declaredClassification !== undefined &&
		isLocalEndpoint &&
		input.declaredClassification !== "local-compatible"
	) {
		errors.push(
			profileError(
				"endpoint-classification-mismatch",
				"endpointClassification",
				"local OpenAI-compatible endpoints must use local-compatible classification.",
			),
		);
	}

	if (classification === "local-compatible") {
		if (input.providerKind !== "local") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"providerKind",
					"local-compatible OpenAI-compatible profiles must use local provider kind.",
				),
			);
		}

		if (input.trustLevel !== "local-runtime") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"trustLevel",
					"local-compatible OpenAI-compatible profiles must use local-runtime trust level.",
				),
			);
		}
	} else {
		if (input.providerKind !== "cloud") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"providerKind",
					"remote OpenAI-compatible profiles must use cloud provider kind.",
				),
			);
		}

		if (input.trustLevel === "local-runtime") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"trustLevel",
					"remote OpenAI-compatible profiles cannot use local-runtime trust level.",
				),
			);
		}

		if (classification === "trusted-cloud" && input.trustLevel !== "trusted-cloud") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"trustLevel",
					"trusted-cloud OpenAI-compatible profiles must use trusted-cloud trust level.",
				),
			);
		}

		if (classification === "untrusted-cloud" && input.trustLevel !== "untrusted-cloud") {
			errors.push(
				profileError(
					"endpoint-classification-mismatch",
					"trustLevel",
					"untrusted-cloud OpenAI-compatible profiles must use untrusted-cloud trust level.",
				),
			);
		}
	}

	if (errors.length > 0) {
		return {
			ok: false,
			errors,
		};
	}

	const isRemoteDisclosureRequired = isOpenAICompatibleRemoteClassification(classification);

	return {
		ok: true,
		endpointClassification: classification,
		isRemoteDisclosureRequired,
		isTrustRequired: isRemoteDisclosureRequired,
		isCredentialRequired: isRemoteDisclosureRequired,
	};
};

const modelHasCapability = (
	model: UserProviderModelProfile,
	capability: ModelCapability,
	role?: ModelRole,
): boolean => {
	if (!model.capabilities.includes(capability)) {
		return false;
	}

	return role === undefined || model.roles.includes(role);
};

export const createOpenAICompatibleProfileMetadata = (
	endpoint: ProviderEndpointMetadata,
	classification: OpenAICompatibleEndpointClassificationSuccess,
	models: readonly UserProviderModelProfile[],
): OpenAICompatibleProfileMetadata => ({
	endpointClassification: classification.endpointClassification,
	endpoint,
	isRemoteDisclosureRequired: classification.isRemoteDisclosureRequired,
	isTrustRequired: classification.isTrustRequired,
	isCredentialRequired: classification.isCredentialRequired,
	modelCount: models.length,
	chatModelCount: models.filter((model) => modelHasCapability(model, "chat", "chat")).length,
	streamingModelCount: models.filter((model) => modelHasCapability(model, "streaming", "chat")).length,
	embeddingModelCount: models.filter((model) => modelHasCapability(model, "embeddings", "embedding")).length,
	toolModelCount: models.filter((model) => modelHasCapability(model, "tools", "chat")).length,
	attachmentModelCount: models.filter((model) => modelHasCapability(model, "attachments", "utility")).length,
});

const readinessStatusAndCode = (
	status: ProviderAuthTestRecord["status"],
): {
	readonly status: OpenAICompatibleReadinessStatus;
	readonly code: OpenAICompatibleReadinessCode;
} => {
	switch (status) {
		case "passed":
			return { status: "ready", code: "ready" };
		case "missing-secret":
			return { status: "not-ready", code: "missing-secret" };
		case "timeout":
			return { status: "not-ready", code: "auth-timeout" };
		case "failed":
			return { status: "not-ready", code: "auth-failed" };
		case "running":
		case "untested":
			return { status: "untested", code: "not-checked" };
		default:
			return assertNeverProviderValue(status);
	}
};

const toDiagnosticObject = (input: unknown): RedactedDiagnosticObject => {
	const redacted = redactDiagnostic(input);

	if (
		!redacted.ok ||
		typeof redacted.value !== "object" ||
		redacted.value === null ||
		Array.isArray(redacted.value)
	) {
		return {
			redaction: "failed",
		};
	}

	return redacted.value as RedactedDiagnosticObject;
};

export const createOpenAICompatibleAuthReadinessRecord = (
	profile: UserProviderProfile,
	status: ProviderAuthTestRecord["status"],
	checkedAt: string,
	durationMs: number,
	statusCode: number | null,
	modelCount: number,
	diagnostic: unknown,
): OpenAICompatibleAuthReadinessRecord | undefined => {
	if (profile.openaiCompatible === undefined) {
		return undefined;
	}

	const readiness = readinessStatusAndCode(status);

	return {
		providerId: profile.id,
		status: readiness.status,
		code: readiness.code,
		endpointClassification: profile.openaiCompatible.endpointClassification,
		checkedAt,
		durationMs,
		statusCode,
		modelCount,
		diagnostic: toDiagnosticObject(diagnostic),
	};
};

const capabilityFailureCode = (
	model: ProviderModelDefinition | undefined,
	requiredCapability: ModelCapability,
	requiredRole: ModelRole,
): OpenAICompatibleReadinessCode => {
	if (model === undefined) {
		return "model-missing";
	}

	return modelSupportsCapability(model, requiredCapability, requiredRole) ? "ready" : "capability-mismatch";
};

const selectedModelForCapability = (
	provider: ProviderDefinition,
	requiredCapability: ModelCapability,
	requiredRole: ModelRole,
	modelId: ProviderModelId | null,
): ProviderModelDefinition | undefined => {
	if (modelId !== null) {
		return findModel(provider, modelId);
	}

	return (
		provider.models.find(
			(model) => model.isDefault === true && modelSupportsCapability(model, requiredCapability, requiredRole),
		) ?? provider.models.find((model) => modelSupportsCapability(model, requiredCapability, requiredRole))
	);
};

export const summarizeOpenAICompatibleCapabilityReadiness = (
	provider: ProviderDefinition,
	role: ModelRole,
	requiredCapability: ModelCapability,
	modelId: ProviderModelId | null,
): OpenAICompatibleCapabilityReadinessRecord | undefined => {
	if (provider.setupMetadata?.openaiCompatible === undefined) {
		return undefined;
	}

	const selectedModel = selectedModelForCapability(provider, requiredCapability, role, modelId);
	const code = capabilityFailureCode(selectedModel, requiredCapability, role);
	const status: OpenAICompatibleReadinessStatus = code === "ready" ? "ready" : "not-ready";

	return {
		providerId: provider.id,
		role,
		requiredCapability,
		status,
		code,
		modelId: selectedModel?.id ?? modelId,
		modelCount: provider.models.length,
		diagnostic: toDiagnosticObject({
			providerId: provider.id,
			role,
			requiredCapability,
			modelId: selectedModel?.id ?? modelId,
			code,
		}),
	};
};
