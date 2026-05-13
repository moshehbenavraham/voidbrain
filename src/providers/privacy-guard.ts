import {
	type ContentSensitivity,
	type DisclosureDecision,
	type DisclosureDeniedDecision,
	type DisclosureRequest,
	type ModelCapability,
	type ModelRole,
	type ProviderDefinition,
	type ProviderId,
	type ProviderInvocationPreflightDecision,
	type ProviderModelId,
	type ProviderPrivacyPolicy,
	isCloudProviderKind,
	isContentSensitivity,
	isModelCapability,
	isModelRole,
	isTrustedProviderForCloud,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";
import { type NormalizedVaultPath, makeNormalizedVaultPath } from "../types/vault";
import { findProvider, selectProviderModel } from "./capability-selection";

type UnknownRecord = Record<string, unknown>;

interface SourcePathParseSuccess {
	readonly ok: true;
	readonly value: readonly NormalizedVaultPath[];
}

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDisclosureDenied = (
	decision: DisclosureRequest | DisclosureDeniedDecision,
): decision is DisclosureDeniedDecision => "allowed" in decision && decision.allowed === false;

const isSourcePathParseFailure = (
	decision: SourcePathParseSuccess | DisclosureDeniedDecision,
): decision is DisclosureDeniedDecision => "allowed" in decision;

const readNonEmptyString = (source: UnknownRecord, field: string): string | null => {
	const value = source[field];

	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	return value.trim();
};

const invalidDisclosure = (message: string, field: string): DisclosureDeniedDecision => ({
	allowed: false,
	code: "invalid-request",
	userMessage: "Provider disclosure request is malformed.",
	diagnosticReason: message,
	diagnostic: {
		field,
		code: "invalid-request",
	},
});

const diagnosticForRequest = (
	provider: ProviderDefinition,
	request: DisclosureRequest,
): Record<string, string | number | boolean | null> => ({
	providerId: provider.id,
	providerKind: provider.kind,
	providerTrustLevel: provider.trustLevel,
	endpointClassification: provider.setupMetadata?.openaiCompatible?.endpointClassification ?? null,
	endpointHost: provider.setupMetadata?.openaiCompatible?.endpointHost ?? null,
	isRemoteDisclosureRequired: provider.setupMetadata?.openaiCompatible?.isRemoteDisclosureRequired ?? null,
	requiredCapability: request.requiredCapability,
	contentSensitivity: request.contentSensitivity,
	sourcePathCount: request.sourcePaths?.length ?? 0,
	workflowId: request.workflowId ?? null,
});

const parseSourcePaths = (sourcePaths: unknown): SourcePathParseSuccess | DisclosureDeniedDecision => {
	if (sourcePaths === undefined) {
		return { ok: true, value: [] };
	}

	if (!Array.isArray(sourcePaths)) {
		return invalidDisclosure("sourcePaths must be an array when present.", "sourcePaths");
	}

	const normalizedPaths: NormalizedVaultPath[] = [];
	for (const [index, sourcePath] of sourcePaths.entries()) {
		if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
			return invalidDisclosure(`sourcePaths[${index}] must be a non-empty string.`, `sourcePaths[${index}]`);
		}
		normalizedPaths.push(makeNormalizedVaultPath(sourcePath.trim()));
	}

	return { ok: true, value: normalizedPaths };
};

export const parseDisclosureRequest = (input: unknown): DisclosureRequest | DisclosureDeniedDecision => {
	if (!isRecord(input)) {
		return invalidDisclosure("Disclosure request must be an object.", "root");
	}

	const providerId = readNonEmptyString(input, "providerId");
	if (providerId === null) {
		return invalidDisclosure("providerId must be a non-empty string.", "providerId");
	}

	const requiredCapability = input.requiredCapability;
	if (!isModelCapability(requiredCapability)) {
		return invalidDisclosure("requiredCapability is not supported.", "requiredCapability");
	}

	const contentSensitivity = input.contentSensitivity;
	if (!isContentSensitivity(contentSensitivity)) {
		return invalidDisclosure("contentSensitivity is not supported.", "contentSensitivity");
	}

	const rawPreferredModelId = input.preferredModelId;
	let preferredModelId: ProviderModelId | undefined;
	if (rawPreferredModelId !== undefined) {
		if (typeof rawPreferredModelId !== "string" || rawPreferredModelId.trim().length === 0) {
			return invalidDisclosure("preferredModelId must be a non-empty string when present.", "preferredModelId");
		}
		preferredModelId = makeProviderModelId(rawPreferredModelId.trim());
	}

	const rawRequiredRole = input.requiredRole;
	let requiredRole: ModelRole | undefined;
	if (rawRequiredRole !== undefined) {
		if (!isModelRole(rawRequiredRole)) {
			return invalidDisclosure("requiredRole is not supported.", "requiredRole");
		}
		requiredRole = rawRequiredRole;
	}

	const sourcePaths = parseSourcePaths(input.sourcePaths);
	if (isSourcePathParseFailure(sourcePaths)) {
		return sourcePaths;
	}

	const rawWorkflowId = input.workflowId;
	const workflowId = rawWorkflowId === undefined ? undefined : readNonEmptyString(input, "workflowId");
	if (rawWorkflowId !== undefined && workflowId === null) {
		return invalidDisclosure("workflowId must be a non-empty string when present.", "workflowId");
	}

	const rawUserFacingPurpose = input.userFacingPurpose;
	const userFacingPurpose =
		rawUserFacingPurpose === undefined ? undefined : readNonEmptyString(input, "userFacingPurpose");
	if (rawUserFacingPurpose !== undefined && userFacingPurpose === null) {
		return invalidDisclosure("userFacingPurpose must be a non-empty string when present.", "userFacingPurpose");
	}

	return {
		providerId: makeProviderId(providerId),
		requiredCapability: requiredCapability as ModelCapability,
		contentSensitivity: contentSensitivity as ContentSensitivity,
		...(preferredModelId === undefined ? {} : { preferredModelId }),
		...(requiredRole === undefined ? {} : { requiredRole }),
		...(sourcePaths.value.length === 0 ? {} : { sourcePaths: sourcePaths.value }),
		...(workflowId === null || workflowId === undefined ? {} : { workflowId }),
		...(userFacingPurpose === null || userFacingPurpose === undefined ? {} : { userFacingPurpose }),
	};
};

export const decideVaultDisclosure = (
	providers: readonly ProviderDefinition[],
	policy: ProviderPrivacyPolicy,
	input: unknown,
): DisclosureDecision => {
	const request = parseDisclosureRequest(input);
	if (isDisclosureDenied(request)) {
		return request;
	}

	const provider = findProvider(providers, request.providerId);
	if (provider === undefined) {
		return {
			allowed: false,
			code: "provider-not-found",
			request,
			userMessage: "Selected provider is not registered.",
			diagnosticReason: `Provider ${request.providerId} is not registered.`,
			diagnostic: {
				providerId: request.providerId,
				requiredCapability: request.requiredCapability,
				contentSensitivity: request.contentSensitivity,
			},
		};
	}

	const diagnostic = diagnosticForRequest(provider, request);
	if (!isCloudProviderKind(provider.kind)) {
		return {
			allowed: true,
			provider,
			request,
			reason: "Local provider disclosure stays on this machine.",
			diagnostic,
		};
	}

	if (!policy.areCloudProvidersEnabled) {
		return {
			allowed: false,
			code: "cloud-disabled",
			request,
			userMessage: "Cloud provider workflows are disabled.",
			diagnosticReason: "Cloud provider disclosure was denied because cloud workflows are disabled.",
			diagnostic,
		};
	}

	if (!policy.trustedProviderIds.includes(provider.id)) {
		return {
			allowed: false,
			code: "provider-not-trusted",
			request,
			userMessage: "Cloud provider is not trusted for this vault.",
			diagnosticReason: "Cloud provider disclosure was denied because the provider is not trusted in settings.",
			diagnostic,
		};
	}

	if (!isTrustedProviderForCloud(provider.trustLevel)) {
		const isPrivateContent = request.contentSensitivity === "private-vault";

		return {
			allowed: false,
			code: isPrivateContent ? "private-content-cloud-denied" : "provider-not-trusted",
			request,
			userMessage: "Cloud provider is not trusted for the requested vault content.",
			diagnosticReason: `Cloud provider disclosure was denied because provider trust is ${provider.trustLevel}.`,
			diagnostic,
		};
	}

	return {
		allowed: true,
		provider,
		request,
		reason: "Cloud provider disclosure is enabled and trusted for this request.",
		diagnostic,
	};
};

export const preflightProviderInvocation = (
	providers: readonly ProviderDefinition[],
	policy: ProviderPrivacyPolicy,
	input: unknown,
): ProviderInvocationPreflightDecision => {
	const disclosure = decideVaultDisclosure(providers, policy, input);
	if (!disclosure.allowed) {
		return {
			allowed: false,
			code: disclosure.code,
			userMessage: disclosure.userMessage,
			diagnosticReason: disclosure.diagnosticReason,
			diagnostic: disclosure.diagnostic,
		};
	}

	const capabilityDecision = selectProviderModel(providers, {
		providerId: disclosure.request.providerId,
		requiredCapability: disclosure.request.requiredCapability,
		preferredModelId: disclosure.request.preferredModelId,
		requiredRole: disclosure.request.requiredRole,
	});

	if (!capabilityDecision.ok) {
		return {
			allowed: false,
			code: capabilityDecision.code,
			userMessage: "Selected provider model does not satisfy the requested capability.",
			diagnosticReason: capabilityDecision.message,
			diagnostic: {
				...disclosure.diagnostic,
				field: capabilityDecision.field ?? null,
				capabilityCode: capabilityDecision.code,
			},
		};
	}

	return {
		allowed: true,
		provider: capabilityDecision.provider,
		model: capabilityDecision.model,
		disclosure,
	};
};
