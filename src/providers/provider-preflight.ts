import type { VoidbrainPluginSettings } from "../types/plugin";
import type {
	ProviderRoleCapabilitySummary,
	ProviderSetupPreflightDecision,
	ProviderSetupPreflightDenied,
	ProviderSetupPreflightRequest,
	ProviderSetupSummary,
} from "../types/provider-setup";
import type {
	ModelCapability,
	ModelRole,
	ProviderAuthState,
	ProviderDefinition,
	ProviderId,
	ProviderModelDefinition,
	ProviderPrivacyPolicy,
	RedactedDiagnosticObject,
} from "../types/providers";
import { findModel, findProvider, modelSupportsCapability } from "./capability-selection";
import { preflightProviderInvocation } from "./privacy-guard";
import { capabilityForRole, mergeProviderDefinitions } from "./provider-profile-service";
import { BASELINE_PROVIDERS } from "./provider-registry";
import { redactDiagnostic } from "./redaction";

export interface ProviderSetupContext {
	readonly settings: VoidbrainPluginSettings;
	readonly baselineProviders?: readonly ProviderDefinition[];
}

const providerRoles: readonly ModelRole[] = ["chat", "embedding", "utility"];

const authStateFromStatus = (status: unknown): ProviderAuthState => {
	switch (status) {
		case "passed":
			return "passed";
		case "failed":
			return "failed";
		case "timeout":
			return "timeout";
		case "missing-secret":
			return "missing-secret";
		case "running":
		case "untested":
			return "untested";
	}

	return "untested";
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

const createAuthStateMap = (settings: VoidbrainPluginSettings): ReadonlyMap<ProviderId, ProviderAuthState> => {
	const authStates = new Map<ProviderId, ProviderAuthState>();

	for (const authStatus of settings.providerAuthStatuses) {
		if (!authStates.has(authStatus.providerId)) {
			authStates.set(authStatus.providerId, authStateFromStatus(authStatus.status));
		}
	}

	return authStates;
};

export const buildProviderDefinitionsForSettings = (
	settings: VoidbrainPluginSettings,
	baselineProviders: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): readonly ProviderDefinition[] =>
	mergeProviderDefinitions(baselineProviders, settings.providerProfiles, createAuthStateMap(settings)).providers;

export const buildProviderPrivacyPolicy = (settings: VoidbrainPluginSettings): ProviderPrivacyPolicy => ({
	areCloudProvidersEnabled: settings.areCloudProvidersEnabled,
	trustedProviderIds: settings.trustedProviderIds,
});

const authStateForProvider = (settings: VoidbrainPluginSettings, provider: ProviderDefinition): ProviderAuthState => {
	const status = settings.providerAuthStatuses.find((authStatus) => authStatus.providerId === provider.id);

	if (status !== undefined) {
		return authStateFromStatus(status.status);
	}

	return provider.setupMetadata?.authState ?? "untested";
};

const isProviderAuthReady = (settings: VoidbrainPluginSettings, provider: ProviderDefinition): boolean => {
	if (provider.kind === "local") {
		return true;
	}

	return authStateForProvider(settings, provider) === "passed";
};

const selectedModelForRole = (
	provider: ProviderDefinition,
	modelId: string | null,
	requiredCapability: ModelCapability,
	role: ModelRole,
): ProviderModelDefinition | null => {
	if (modelId !== null) {
		return findModel(provider, modelId as ProviderModelDefinition["id"]) ?? null;
	}

	return (
		provider.models.find(
			(model) => model.isDefault === true && modelSupportsCapability(model, requiredCapability, role),
		) ??
		provider.models.find((model) => modelSupportsCapability(model, requiredCapability, role)) ??
		null
	);
};

const denied = (
	code: ProviderSetupPreflightDenied["code"],
	userMessage: string,
	diagnosticReason: string,
	diagnostic: unknown,
): ProviderSetupPreflightDenied => ({
	allowed: false,
	code,
	userMessage,
	diagnosticReason,
	diagnostic: toDiagnosticObject(diagnostic),
});

export const summarizeProviderRoleCapabilities = (
	settings: VoidbrainPluginSettings,
	providers: readonly ProviderDefinition[] = buildProviderDefinitionsForSettings(settings),
): readonly ProviderRoleCapabilitySummary[] =>
	providerRoles.map((role) => {
		const selection = settings.providerRoles[role];
		const requiredCapability = capabilityForRole(role);

		if (selection.providerId === null) {
			return {
				role,
				requiredCapability,
				providerId: null,
				modelId: null,
				status: "not-selected",
				message: `${role} provider is not selected.`,
			};
		}

		const provider = findProvider(providers, selection.providerId);
		if (provider === undefined) {
			return {
				role,
				requiredCapability,
				providerId: selection.providerId,
				modelId: selection.modelId,
				status: "provider-missing",
				message: `${role} provider is no longer registered.`,
			};
		}

		const model = selectedModelForRole(provider, selection.modelId, requiredCapability, role);
		if (model === null) {
			return {
				role,
				requiredCapability,
				providerId: provider.id,
				modelId: selection.modelId,
				status: selection.modelId === null ? "model-missing" : "model-missing",
				message: `${role} model is not available for the selected provider.`,
			};
		}

		if (!modelSupportsCapability(model, requiredCapability, role)) {
			return {
				role,
				requiredCapability,
				providerId: provider.id,
				modelId: model.id,
				status: "capability-mismatch",
				message: `${role} model does not support ${requiredCapability}.`,
			};
		}

		return {
			role,
			requiredCapability,
			providerId: provider.id,
			modelId: model.id,
			status: "ready",
			message: `${role} model supports ${requiredCapability}.`,
		};
	});

export const summarizeProviderSetup = (
	settings: VoidbrainPluginSettings,
	providers: readonly ProviderDefinition[] = buildProviderDefinitionsForSettings(settings),
): ProviderSetupSummary => {
	const roleSummaries = summarizeProviderRoleCapabilities(settings, providers);
	const selectedProviderIds = new Set(roleSummaries.map((summary) => summary.providerId).filter((id) => id !== null));
	const trustedProviderIds = new Set(settings.trustedProviderIds);
	const trustedCloudCount = providers.filter(
		(provider) => provider.kind === "cloud" && trustedProviderIds.has(provider.id),
	).length;
	const authReadyCount = providers.filter((provider) => isProviderAuthReady(settings, provider)).length;
	const mismatchCount = roleSummaries.filter(
		(summary) =>
			summary.status === "provider-missing" ||
			summary.status === "model-missing" ||
			summary.status === "capability-mismatch",
	).length;
	const selectedCloudProviderMissingAuth = providers.some(
		(provider) =>
			provider.kind === "cloud" &&
			selectedProviderIds.has(provider.id) &&
			!isProviderAuthReady(settings, provider),
	);
	const severity =
		providers.length === 0 || selectedProviderIds.size === 0
			? "missing"
			: mismatchCount > 0
				? "error"
				: selectedCloudProviderMissingAuth || (settings.areCloudProvidersEnabled && trustedCloudCount === 0)
					? "warning"
					: "ready";

	return {
		severity,
		providerCount: providers.length,
		userProfileCount: settings.providerProfiles.length,
		configuredCredentialCount: settings.providerProfiles.filter((profile) => profile.credentialReference !== null)
			.length,
		passedAuthCount: settings.providerAuthStatuses.filter((status) => status.status === "passed").length,
		trustedCloudCount,
		roleSelectionCount: selectedProviderIds.size,
		details: [
			`${settings.providerProfiles.length} user provider profile(s).`,
			`${authReadyCount} provider(s) auth-ready for selected workflow scope.`,
			`${trustedCloudCount} trusted cloud provider(s).`,
			`${roleSummaries.filter((summary) => summary.status === "ready").length} role capability selection(s) ready.`,
		],
	};
};

export const preflightProviderSetup = (
	context: ProviderSetupContext,
	request: ProviderSetupPreflightRequest,
): ProviderSetupPreflightDecision => {
	const providers = buildProviderDefinitionsForSettings(
		context.settings,
		context.baselineProviders ?? BASELINE_PROVIDERS,
	);
	const selection = context.settings.providerRoles[request.role];
	const requiredCapability = request.requiredCapability ?? capabilityForRole(request.role);

	if (selection.providerId === null) {
		return denied(
			"role-not-selected",
			"Provider role is not selected.",
			`${request.role} provider is not selected.`,
			{
				role: request.role,
				requiredCapability,
				workflowId: request.workflowId ?? null,
			},
		);
	}

	const provider = findProvider(providers, selection.providerId);
	if (provider === undefined) {
		return denied("capability-denied", "Selected provider is not registered.", "Provider selection is stale.", {
			role: request.role,
			providerId: selection.providerId,
			requiredCapability,
			workflowId: request.workflowId ?? null,
		});
	}

	if (!isProviderAuthReady(context.settings, provider)) {
		const authState = authStateForProvider(context.settings, provider);
		return denied(
			"auth-not-ready",
			"Selected provider auth is not ready.",
			"Provider auth must pass setup first.",
			{
				role: request.role,
				providerId: provider.id,
				authState,
				requiredCapability,
				workflowId: request.workflowId ?? null,
			},
		);
	}

	const decision = preflightProviderInvocation(providers, buildProviderPrivacyPolicy(context.settings), {
		providerId: provider.id,
		requiredCapability,
		contentSensitivity: request.contentSensitivity,
		preferredModelId: selection.modelId ?? undefined,
		requiredRole: request.role,
		sourcePaths: request.sourcePaths,
		workflowId: request.workflowId,
		userFacingPurpose: request.userFacingPurpose,
	});

	if (!decision.allowed) {
		const isCapabilityDenied =
			decision.code === "invalid-request" ||
			decision.code === "provider-not-found" ||
			decision.code === "model-not-found" ||
			decision.code === "capability-unsupported";

		return denied(
			isCapabilityDenied ? "capability-denied" : "privacy-denied",
			decision.userMessage,
			decision.diagnosticReason,
			decision.diagnostic,
		);
	}

	return {
		allowed: true,
		provider: decision.provider,
		modelId: decision.model.id,
		policy: buildProviderPrivacyPolicy(context.settings),
		diagnostic: toDiagnosticObject({
			providerId: decision.provider.id,
			modelId: decision.model.id,
			requiredCapability,
			contentSensitivity: request.contentSensitivity,
			workflowId: request.workflowId ?? null,
		}),
	};
};
