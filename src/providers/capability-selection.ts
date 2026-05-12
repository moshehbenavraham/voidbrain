import {
	type CapabilitySelectionDecision,
	type CapabilitySelectionDenied,
	type CapabilitySelectionRequest,
	type ModelCapability,
	type ModelRole,
	type ProviderDefinition,
	type ProviderId,
	type ProviderModelDefinition,
	type ProviderModelId,
	isModelCapability,
	isModelRole,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const deny = (code: CapabilitySelectionDenied["code"], message: string, field?: string): CapabilitySelectionDenied => {
	if (field === undefined) {
		return { ok: false, code, message };
	}

	return { ok: false, code, message, field };
};

const isCapabilitySelectionDenied = (
	decision: CapabilitySelectionRequest | CapabilitySelectionDenied,
): decision is CapabilitySelectionDenied => "ok" in decision && decision.ok === false;

const readNonEmptyString = (source: UnknownRecord, field: string): string | null => {
	const value = source[field];

	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	return value.trim();
};

export const parseCapabilitySelectionRequest = (
	input: unknown,
): CapabilitySelectionRequest | CapabilitySelectionDenied => {
	if (!isRecord(input)) {
		return deny("invalid-request", "Capability selection request must be an object.", "root");
	}

	const providerId = readNonEmptyString(input, "providerId");
	if (providerId === null) {
		return deny("invalid-request", "providerId must be a non-empty string.", "providerId");
	}

	const requiredCapability = input.requiredCapability;
	if (!isModelCapability(requiredCapability)) {
		return deny("invalid-request", "requiredCapability is not supported.", "requiredCapability");
	}

	const rawPreferredModelId = input.preferredModelId;
	let preferredModelId: ProviderModelId | undefined;
	if (rawPreferredModelId !== undefined) {
		if (typeof rawPreferredModelId !== "string" || rawPreferredModelId.trim().length === 0) {
			return deny(
				"invalid-request",
				"preferredModelId must be a non-empty string when present.",
				"preferredModelId",
			);
		}
		preferredModelId = makeProviderModelId(rawPreferredModelId.trim());
	}

	const rawRequiredRole = input.requiredRole;
	let requiredRole: ModelRole | undefined;
	if (rawRequiredRole !== undefined) {
		if (!isModelRole(rawRequiredRole)) {
			return deny("invalid-request", "requiredRole is not supported.", "requiredRole");
		}
		requiredRole = rawRequiredRole;
	}

	return {
		providerId: makeProviderId(providerId),
		requiredCapability,
		...(preferredModelId === undefined ? {} : { preferredModelId }),
		...(requiredRole === undefined ? {} : { requiredRole }),
	};
};

export const modelSupportsCapability = (
	model: ProviderModelDefinition,
	requiredCapability: ModelCapability,
	requiredRole?: ModelRole,
): boolean => {
	if (!model.capabilities.includes(requiredCapability)) {
		return false;
	}

	if (requiredRole === undefined) {
		return true;
	}

	return model.roles.includes(requiredRole);
};

export const findProvider = (
	providers: readonly ProviderDefinition[],
	providerId: ProviderId,
): ProviderDefinition | undefined => providers.find((provider) => provider.id === providerId);

export const findModel = (
	provider: ProviderDefinition,
	modelId: ProviderModelId,
): ProviderModelDefinition | undefined => provider.models.find((model) => model.id === modelId);

export const selectProviderModel = (
	providers: readonly ProviderDefinition[],
	input: unknown,
): CapabilitySelectionDecision => {
	const request = parseCapabilitySelectionRequest(input);
	if (isCapabilitySelectionDenied(request)) {
		return request;
	}

	const provider = findProvider(providers, request.providerId);
	if (provider === undefined) {
		return deny("provider-not-found", `Provider ${request.providerId} is not registered.`, "providerId");
	}

	if (request.preferredModelId !== undefined) {
		const preferredModel = findModel(provider, request.preferredModelId);
		if (preferredModel === undefined) {
			return deny("model-not-found", `Model ${request.preferredModelId} is not registered.`, "preferredModelId");
		}

		if (!modelSupportsCapability(preferredModel, request.requiredCapability, request.requiredRole)) {
			return deny(
				"capability-unsupported",
				`Model ${preferredModel.id} does not support ${request.requiredCapability}.`,
				"requiredCapability",
			);
		}

		return {
			ok: true,
			provider,
			model: preferredModel,
			requiredCapability: request.requiredCapability,
		};
	}

	const supportedModels = provider.models.filter((model) =>
		modelSupportsCapability(model, request.requiredCapability, request.requiredRole),
	);
	const selectedModel = supportedModels.find((model) => model.isDefault === true) ?? supportedModels[0];

	if (selectedModel === undefined) {
		return deny(
			"capability-unsupported",
			`Provider ${provider.id} has no model that supports ${request.requiredCapability}.`,
			"requiredCapability",
		);
	}

	return {
		ok: true,
		provider,
		model: selectedModel,
		requiredCapability: request.requiredCapability,
	};
};
