import type {
	LocalRuntimeFamily,
	LocalRuntimeProfileMetadata,
	OpenAICompatibleEndpointClassification,
	OpenAICompatibleProfileMetadata,
	ProviderEndpointMetadata,
	ProviderProfileNormalizationResult,
	ProviderProfileParseFailure,
	ProviderProfileValidationError,
	ProviderProfileValidationResult,
	UserProviderModelProfile,
	UserProviderProfile,
	UserProviderProfileKind,
} from "../types/provider-setup";
import { isLocalRuntimeFamily, isOpenAICompatibleEndpointClassification } from "../types/provider-setup";
import {
	type ModelCapability,
	type ModelRole,
	type ProviderAuthState,
	type ProviderDefinition,
	type ProviderId,
	type ProviderKind,
	type ProviderModelId,
	type ProviderTrustLevel,
	type SecretReference,
	assertNeverProviderValue,
	isModelCapability,
	isModelRole,
	isProviderKind,
	isProviderTrustLevel,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";
import { classifyOpenAICompatibleEndpoint, createOpenAICompatibleProfileMetadata } from "./openai-compatible-profiles";
import { isSecretLikeKey } from "./redaction";

type UnknownRecord = Record<string, unknown>;

const unsafeValuePatterns: readonly RegExp[] = [
	/\bBearer\s+[A-Za-z0-9._-]{8,}\b/i,
	/\bsk-[A-Za-z0-9_-]{8,}\b/i,
	/\b(api[_-]?key|password|secret|token)=([^&\s]+)/i,
];

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const profileError = (
	code: ProviderProfileValidationError["code"],
	field: string,
	message: string,
): ProviderProfileValidationError => ({ code, field, message });

const failure = (errors: readonly ProviderProfileValidationError[]): ProviderProfileParseFailure => ({
	ok: false,
	errors,
});

const readRequiredString = (
	source: UnknownRecord,
	field: string,
	errors: ProviderProfileValidationError[],
	sourceField: string = field,
): string | null => {
	const value = source[sourceField];

	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(profileError("invalid-profile", field, `${field} must be a non-empty string.`));
		return null;
	}

	return value.trim();
};

const readOptionalString = (
	source: UnknownRecord,
	field: string,
	errors: ProviderProfileValidationError[],
	sourceField: string = field,
): string | undefined => {
	const value = source[sourceField];

	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(profileError("invalid-profile", field, `${field} must be a non-empty string when present.`));
		return undefined;
	}

	return value.trim();
};

const compareById = <TValue extends { readonly id: string }>(left: TValue, right: TValue): number =>
	left.id.localeCompare(right.id, "en", { sensitivity: "base" });

const isLocalHost = (hostname: string): boolean =>
	hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");

const containsUnsafeProviderState = (value: unknown): boolean => containsUnsafeProviderStateAt(value, new Set());

const containsUnsafeProviderStateAt = (value: unknown, seen: Set<unknown>): boolean => {
	if (typeof value === "string") {
		return unsafeValuePatterns.some((pattern) => pattern.test(value));
	}

	if (value === null || value === undefined || typeof value !== "object") {
		return false;
	}

	if (seen.has(value)) {
		return false;
	}
	seen.add(value);

	if (Array.isArray(value)) {
		return value.some((item) => containsUnsafeProviderStateAt(item, seen));
	}

	if (!isRecord(value)) {
		return false;
	}

	for (const [key, child] of Object.entries(value)) {
		if (isSecretLikeKey(key)) {
			return true;
		}

		if (containsUnsafeProviderStateAt(child, seen)) {
			return true;
		}
	}

	return false;
};

const parseEndpoint = (
	input: unknown,
	profileKind: UserProviderProfileKind,
	providerKind: ProviderKind,
	errors: ProviderProfileValidationError[],
): ProviderEndpointMetadata | null => {
	if (!isRecord(input)) {
		errors.push(profileError("endpoint-invalid", "endpoint", "endpoint must be an object."));
		return null;
	}

	const baseUrl = input.baseUrl;
	if (baseUrl === null && profileKind === "local") {
		errors.push(
			profileError("endpoint-invalid", "endpoint.baseUrl", "local runtime endpoint.baseUrl is required."),
		);
		return null;
	}

	if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
		errors.push(profileError("endpoint-invalid", "endpoint.baseUrl", "endpoint.baseUrl must be a URL string."));
		return null;
	}

	let parsed: URL;
	try {
		parsed = new URL(baseUrl.trim());
	} catch {
		errors.push(profileError("endpoint-invalid", "endpoint.baseUrl", "endpoint.baseUrl must be a valid URL."));
		return null;
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		errors.push(profileError("endpoint-invalid", "endpoint.baseUrl", "endpoint.baseUrl must use http or https."));
	}

	if (parsed.username.length > 0 || parsed.password.length > 0) {
		errors.push(
			profileError("endpoint-invalid", "endpoint.baseUrl", "endpoint.baseUrl must not contain credentials."),
		);
	}

	const isCloudEndpoint = !isLocalHost(parsed.hostname);
	if (providerKind === "local" && isCloudEndpoint) {
		errors.push(
			profileError("endpoint-non-local", "endpoint.baseUrl", "local providers must use a local endpoint."),
		);
	}

	if (providerKind === "cloud" && !isCloudEndpoint) {
		errors.push(
			profileError("endpoint-invalid", "endpoint.baseUrl", "cloud providers must use a non-local endpoint."),
		);
	}

	return {
		baseUrl: parsed.toString(),
		isCloudEndpoint,
		hostname: parsed.hostname,
	};
};

const parseSecretReference = (
	input: unknown,
	providerId: ProviderId,
	errors: ProviderProfileValidationError[],
): SecretReference | null => {
	if (input === null || input === undefined) {
		return null;
	}

	if (!isRecord(input)) {
		errors.push(
			profileError("invalid-profile", "credentialReference", "credentialReference must be an object or null."),
		);
		return null;
	}

	const kind = input.kind;
	const id = input.id;
	const rawProviderId = input.providerId;
	const label = input.label;
	const createdAt = input.createdAt;
	const updatedAt = input.updatedAt;

	if (
		kind !== "provider-secret" ||
		typeof id !== "string" ||
		id.trim().length === 0 ||
		typeof rawProviderId !== "string" ||
		rawProviderId.trim().length === 0 ||
		typeof label !== "string" ||
		label.trim().length === 0 ||
		typeof createdAt !== "string" ||
		createdAt.trim().length === 0 ||
		typeof updatedAt !== "string" ||
		updatedAt.trim().length === 0
	) {
		errors.push(
			profileError(
				"invalid-profile",
				"credentialReference",
				"credentialReference must contain opaque provider-secret metadata.",
			),
		);
		return null;
	}

	const referenceProviderId = makeProviderId(rawProviderId.trim());
	if (referenceProviderId !== providerId) {
		errors.push(
			profileError(
				"invalid-profile",
				"credentialReference.providerId",
				"credentialReference.providerId must match the provider profile ID.",
			),
		);
		return null;
	}

	return {
		kind: "provider-secret",
		id: id.trim(),
		providerId: referenceProviderId,
		label: label.trim(),
		createdAt: createdAt.trim(),
		updatedAt: updatedAt.trim(),
	};
};

const parseStringEnumArray = <TValue extends string>(
	input: unknown,
	field: string,
	guard: (value: unknown) => value is TValue,
	errors: ProviderProfileValidationError[],
): readonly TValue[] => {
	if (!Array.isArray(input) || input.length === 0) {
		errors.push(profileError("model-invalid", field, `${field} must be a non-empty array.`));
		return [];
	}

	const values: TValue[] = [];
	const seenValues = new Set<TValue>();
	for (const [index, value] of input.entries()) {
		if (!guard(value)) {
			errors.push(profileError("model-invalid", `${field}[${index}]`, `${field} contains an unsupported value.`));
			return [];
		}

		if (!seenValues.has(value)) {
			seenValues.add(value);
			values.push(value);
		}
	}

	return values;
};

const parseModel = (
	input: unknown,
	providerId: ProviderId,
	index: number,
	errors: ProviderProfileValidationError[],
): UserProviderModelProfile | null => {
	if (!isRecord(input)) {
		errors.push(profileError("model-invalid", `models[${index}]`, "Provider model must be an object."));
		return null;
	}

	const modelId = readRequiredString(input, `models[${index}].id`, errors, "id");
	const displayName = readRequiredString(input, `models[${index}].displayName`, errors, "displayName");
	const roles = parseStringEnumArray<ModelRole>(input.roles, `models[${index}].roles`, isModelRole, errors);
	const capabilities = parseStringEnumArray<ModelCapability>(
		input.capabilities,
		`models[${index}].capabilities`,
		isModelCapability,
		errors,
	);
	const embeddingFamily = readOptionalString(input, `models[${index}].embeddingFamily`, errors, "embeddingFamily");
	const isDefault = input.isDefault === true ? true : undefined;

	if (modelId === null || displayName === null || roles.length === 0 || capabilities.length === 0) {
		return null;
	}

	return {
		id: makeProviderModelId(modelId),
		displayName,
		roles,
		capabilities,
		...(isDefault === undefined ? {} : { isDefault }),
		...(embeddingFamily === undefined ? {} : { embeddingFamily }),
	};
};

const parseModels = (
	input: unknown,
	providerId: ProviderId,
	errors: ProviderProfileValidationError[],
): readonly UserProviderModelProfile[] => {
	if (!Array.isArray(input) || input.length === 0) {
		errors.push(profileError("model-invalid", "models", "models must be a non-empty array."));
		return [];
	}

	const models: UserProviderModelProfile[] = [];
	const seenModelIds = new Set<ProviderModelId>();

	for (const [index, rawModel] of input.entries()) {
		const model = parseModel(rawModel, providerId, index, errors);
		if (model === null) {
			continue;
		}

		if (seenModelIds.has(model.id)) {
			errors.push(
				profileError("duplicate-model-id", `models[${index}].id`, "model IDs must be unique within a profile."),
			);
			continue;
		}

		seenModelIds.add(model.id);
		models.push(model);
	}

	return models.sort(compareById);
};

const parseLocalRuntimeFamily = (
	input: UnknownRecord,
	errors: ProviderProfileValidationError[],
): LocalRuntimeFamily => {
	const rawLocalRuntime = input.localRuntime;
	const rawFamily = input.runtimeFamily ?? (isRecord(rawLocalRuntime) ? rawLocalRuntime.runtimeFamily : undefined);

	if (rawFamily === undefined) {
		return "generic-openai-compatible";
	}

	if (!isLocalRuntimeFamily(rawFamily)) {
		errors.push(
			profileError(
				"runtime-family-invalid",
				"runtimeFamily",
				"runtimeFamily must be a supported local runtime family.",
			),
		);
		return "generic-openai-compatible";
	}

	return rawFamily;
};

const parseOpenAICompatibleEndpointClassification = (
	input: UnknownRecord,
	errors: ProviderProfileValidationError[],
): OpenAICompatibleEndpointClassification | undefined => {
	const rawOpenAICompatible = input.openaiCompatible;
	const rawClassification =
		input.endpointClassification ??
		(isRecord(rawOpenAICompatible) ? rawOpenAICompatible.endpointClassification : undefined);

	if (rawClassification === undefined) {
		return undefined;
	}

	if (isOpenAICompatibleEndpointClassification(rawClassification)) {
		return rawClassification;
	}

	errors.push(
		profileError(
			"endpoint-classification-invalid",
			"endpointClassification",
			"endpointClassification must be local-compatible, custom-remote, trusted-cloud, or untrusted-cloud.",
		),
	);
	return undefined;
};

const requiredCapabilityForRole = (role: ModelRole): ModelCapability => {
	switch (role) {
		case "chat":
			return "chat";
		case "embedding":
			return "embeddings";
		case "utility":
			return "attachments";
		default:
			return assertNeverProviderValue(role);
	}
};

const modelSupportsRequiredRole = (model: UserProviderModelProfile, role: ModelRole): boolean =>
	model.roles.includes(role) && model.capabilities.includes(requiredCapabilityForRole(role));

const validateModelRoleCapabilityContracts = (
	models: readonly UserProviderModelProfile[],
	errors: ProviderProfileValidationError[],
): void => {
	for (const [index, model] of models.entries()) {
		for (const role of model.roles) {
			if (!model.capabilities.includes(requiredCapabilityForRole(role))) {
				errors.push(
					profileError(
						"model-capability-mismatch",
						`models[${index}].capabilities`,
						`${role} models must include ${requiredCapabilityForRole(role)} capability.`,
					),
				);
			}
		}
	}
};

const validateLocalRuntimeModelContracts = (
	models: readonly UserProviderModelProfile[],
	errors: ProviderProfileValidationError[],
): void => {
	validateModelRoleCapabilityContracts(models, errors);

	if (!models.some((model) => modelSupportsRequiredRole(model, "chat"))) {
		errors.push(profileError("missing-chat-model", "models", "local runtime profiles must include a chat model."));
	}

	if (!models.some((model) => modelSupportsRequiredRole(model, "embedding"))) {
		errors.push(
			profileError(
				"missing-embedding-model",
				"models",
				"local runtime profiles must include an embedding model.",
			),
		);
	}
};

const createLocalRuntimeMetadata = (
	runtimeFamily: LocalRuntimeFamily,
	endpoint: ProviderEndpointMetadata,
	models: readonly UserProviderModelProfile[],
): LocalRuntimeProfileMetadata => ({
	runtimeFamily,
	endpoint,
	modelCount: models.length,
	chatModelCount: models.filter((model) => modelSupportsRequiredRole(model, "chat")).length,
	embeddingModelCount: models.filter((model) => modelSupportsRequiredRole(model, "embedding")).length,
});

const parseProfileKind = (value: unknown, errors: ProviderProfileValidationError[]): UserProviderProfileKind | null => {
	if (value === "local" || value === "openai-compatible") {
		return value;
	}

	errors.push(profileError("invalid-profile", "profileKind", "profileKind must be local or openai-compatible."));
	return null;
};

export const parseProviderProfile = (input: unknown): ProviderProfileValidationResult => {
	if (!isRecord(input)) {
		return failure([profileError("invalid-profile", "root", "Provider profile must be an object.")]);
	}

	if (containsUnsafeProviderState(input)) {
		return failure([
			profileError(
				"unsafe-provider-state",
				"root",
				"Provider profile contains raw secret-like state and was rejected.",
			),
		]);
	}

	const errors: ProviderProfileValidationError[] = [];
	const rawId = readRequiredString(input, "id", errors);
	const displayName = readRequiredString(input, "displayName", errors);
	const profileKind = parseProfileKind(input.profileKind, errors);
	const providerKind = isProviderKind(input.providerKind) ? input.providerKind : null;
	const trustLevel = isProviderTrustLevel(input.trustLevel) ? input.trustLevel : null;

	if (providerKind === null) {
		errors.push(profileError("invalid-profile", "providerKind", "providerKind must be local or cloud."));
	}

	if (trustLevel === null) {
		errors.push(
			profileError(
				"invalid-profile",
				"trustLevel",
				"trustLevel must be local-runtime, trusted-cloud, or untrusted-cloud.",
			),
		);
	}

	if (
		rawId === null ||
		displayName === null ||
		profileKind === null ||
		providerKind === null ||
		trustLevel === null
	) {
		return failure(errors);
	}

	const providerId = makeProviderId(rawId);
	const endpoint = parseEndpoint(input.endpoint, profileKind, providerKind, errors);
	const credentialReference = parseSecretReference(input.credentialReference, providerId, errors);
	const models = parseModels(input.models, providerId, errors);
	const localRuntimeFamily = profileKind === "local" ? parseLocalRuntimeFamily(input, errors) : null;
	const declaredOpenAICompatibleClassification =
		profileKind === "openai-compatible" ? parseOpenAICompatibleEndpointClassification(input, errors) : undefined;

	if (profileKind === "local" && providerKind !== "local") {
		errors.push(profileError("invalid-profile", "providerKind", "local profiles must use local provider kind."));
	}

	if (providerKind === "local" && trustLevel !== "local-runtime") {
		errors.push(
			profileError("invalid-profile", "trustLevel", "local providers must use local-runtime trust level."),
		);
	}

	if (providerKind === "cloud" && trustLevel === "local-runtime") {
		errors.push(
			profileError("invalid-profile", "trustLevel", "cloud providers cannot use local-runtime trust level."),
		);
	}

	if (profileKind === "local" && models.length > 0) {
		validateLocalRuntimeModelContracts(models, errors);
	}

	let openaiCompatible: OpenAICompatibleProfileMetadata | undefined;
	if (profileKind === "openai-compatible" && endpoint !== null) {
		if (models.length > 0) {
			validateModelRoleCapabilityContracts(models, errors);
		}

		const classification = classifyOpenAICompatibleEndpoint({
			providerKind,
			trustLevel,
			endpoint,
			...(declaredOpenAICompatibleClassification === undefined
				? {}
				: { declaredClassification: declaredOpenAICompatibleClassification }),
		});

		if (!classification.ok) {
			errors.push(...classification.errors);
		} else {
			if (classification.isCredentialRequired && credentialReference === null) {
				errors.push(
					profileError(
						"missing-credential-reference",
						"credentialReference",
						"Remote OpenAI-compatible profiles must use an opaque credentialReference.",
					),
				);
			}

			openaiCompatible = createOpenAICompatibleProfileMetadata(endpoint, classification, models);
		}
	}

	if (endpoint === null || models.length === 0 || errors.length > 0) {
		return failure(errors);
	}

	const localRuntime =
		profileKind === "local"
			? createLocalRuntimeMetadata(localRuntimeFamily ?? "generic-openai-compatible", endpoint, models)
			: undefined;

	return {
		ok: true,
		profile: {
			id: providerId,
			displayName,
			profileKind,
			providerKind,
			trustLevel,
			endpoint,
			credentialReference,
			models,
			...(localRuntime === undefined ? {} : { localRuntime }),
			...(openaiCompatible === undefined ? {} : { openaiCompatible }),
		},
	};
};

export const normalizeProviderProfiles = (input: unknown): ProviderProfileNormalizationResult => {
	if (input === undefined) {
		return { profiles: [], errors: [] };
	}

	if (!Array.isArray(input)) {
		return {
			profiles: [],
			errors: [profileError("invalid-profile", "providerProfiles", "providerProfiles must be an array.")],
		};
	}

	const profiles: UserProviderProfile[] = [];
	const errors: ProviderProfileValidationError[] = [];
	const seenProviderIds = new Set<ProviderId>();

	for (const [index, rawProfile] of input.entries()) {
		const parsed = parseProviderProfile(rawProfile);
		if (!parsed.ok) {
			errors.push(
				...parsed.errors.map((error) => ({
					...error,
					field: `providerProfiles[${index}].${error.field}`,
				})),
			);
			continue;
		}

		if (seenProviderIds.has(parsed.profile.id)) {
			errors.push(
				profileError(
					"duplicate-profile-id",
					`providerProfiles[${index}].id`,
					"Duplicate provider profile IDs are ignored after the first valid profile.",
				),
			);
			continue;
		}

		seenProviderIds.add(parsed.profile.id);
		profiles.push(parsed.profile);
	}

	return {
		profiles: profiles.sort(compareById),
		errors,
	};
};

export const providerProfileToDefinition = (
	profile: UserProviderProfile,
	authState: ProviderAuthState = "untested",
): ProviderDefinition => ({
	id: profile.id,
	displayName: profile.displayName,
	kind: profile.providerKind,
	trustLevel: profile.trustLevel,
	models: profile.models.map((model) => ({
		id: model.id,
		providerId: profile.id,
		displayName: model.displayName,
		roles: model.roles,
		capabilities: model.capabilities,
		...(model.isDefault === undefined ? {} : { isDefault: model.isDefault }),
		...(model.embeddingFamily === undefined ? {} : { embeddingFamily: model.embeddingFamily }),
	})),
	setupMetadata: {
		source: "user-profile",
		endpoint: profile.endpoint,
		hasCredentialReference: profile.credentialReference !== null,
		authState,
		modelCount: profile.models.length,
		...(profile.localRuntime === undefined
			? {}
			: {
					localRuntime: {
						runtimeFamily: profile.localRuntime.runtimeFamily,
						endpointHost: profile.localRuntime.endpoint.hostname,
						chatModelCount: profile.localRuntime.chatModelCount,
						embeddingModelCount: profile.localRuntime.embeddingModelCount,
					},
				}),
		...(profile.openaiCompatible === undefined
			? {}
			: {
					openaiCompatible: {
						endpointClassification: profile.openaiCompatible.endpointClassification,
						endpointHost: profile.openaiCompatible.endpoint.hostname,
						isRemoteDisclosureRequired: profile.openaiCompatible.isRemoteDisclosureRequired,
						isTrustRequired: profile.openaiCompatible.isTrustRequired,
						isCredentialRequired: profile.openaiCompatible.isCredentialRequired,
						chatModelCount: profile.openaiCompatible.chatModelCount,
						streamingModelCount: profile.openaiCompatible.streamingModelCount,
						embeddingModelCount: profile.openaiCompatible.embeddingModelCount,
						toolModelCount: profile.openaiCompatible.toolModelCount,
						attachmentModelCount: profile.openaiCompatible.attachmentModelCount,
					},
				}),
	},
});

export const mergeProviderDefinitions = (
	baselineProviders: readonly ProviderDefinition[],
	userProfiles: readonly UserProviderProfile[],
	authStates: ReadonlyMap<ProviderId, ProviderAuthState> = new Map(),
) => {
	const providers: ProviderDefinition[] = [...baselineProviders];
	const errors: ProviderProfileValidationError[] = [];
	const seenProviderIds = new Set<ProviderId>(baselineProviders.map((provider) => provider.id));

	for (const profile of [...userProfiles].sort(compareById)) {
		if (seenProviderIds.has(profile.id)) {
			errors.push(
				profileError(
					"duplicate-profile-id",
					`providerProfiles.${profile.id}`,
					"Provider profile ID conflicts with an existing provider and was ignored.",
				),
			);
			continue;
		}

		seenProviderIds.add(profile.id);
		providers.push(providerProfileToDefinition(profile, authStates.get(profile.id) ?? "untested"));
	}

	return {
		providers: providers.sort((left, right) => {
			if (left.kind !== right.kind) {
				return left.kind === "local" ? -1 : 1;
			}

			return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
		}),
		profileErrors: errors,
	};
};

export const capabilityForRole = (role: ModelRole): ModelCapability => {
	switch (role) {
		case "chat":
			return "chat";
		case "embedding":
			return "embeddings";
		case "utility":
			return "attachments";
		default:
			return assertNeverProviderValue(role);
	}
};
