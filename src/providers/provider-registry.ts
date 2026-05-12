import {
	type ProviderDefinition,
	type ProviderId,
	type ProviderKind,
	type ProviderModelDefinition,
	type ProviderModelId,
	assertNeverProviderValue,
	isCloudProviderKind,
	makeProviderId,
	makeProviderModelId,
} from "../types/providers";

export const LOCAL_FIXTURE_PROVIDER_ID = makeProviderId("local-fixture-provider");
export const TRUSTED_CLOUD_FIXTURE_PROVIDER_ID = makeProviderId("trusted-cloud-fixture-provider");
export const UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID = makeProviderId("untrusted-cloud-fixture-provider");

export const BASELINE_PROVIDERS: readonly ProviderDefinition[] = [
	{
		id: LOCAL_FIXTURE_PROVIDER_ID,
		displayName: "Local Fixture Provider",
		kind: "local",
		trustLevel: "local-runtime",
		models: [
			{
				id: makeProviderModelId("local-chat-fixture"),
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				displayName: "Local Chat Fixture",
				roles: ["chat"],
				capabilities: ["chat", "streaming"],
				isDefault: true,
			},
			{
				id: makeProviderModelId("local-embedding-fixture"),
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				displayName: "Local Embedding Fixture",
				roles: ["embedding"],
				capabilities: ["embeddings"],
				embeddingFamily: "local-fixture-embeddings",
			},
		],
	},
	{
		id: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
		displayName: "Trusted Cloud Fixture Provider",
		kind: "cloud",
		trustLevel: "trusted-cloud",
		models: [
			{
				id: makeProviderModelId("trusted-cloud-chat-fixture"),
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				displayName: "Trusted Cloud Chat Fixture",
				roles: ["chat"],
				capabilities: ["chat", "streaming", "tools", "attachments"],
				isDefault: true,
			},
			{
				id: makeProviderModelId("trusted-cloud-embedding-fixture"),
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				displayName: "Trusted Cloud Embedding Fixture",
				roles: ["embedding"],
				capabilities: ["embeddings"],
				embeddingFamily: "trusted-cloud-fixture-embeddings",
			},
		],
	},
	{
		id: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
		displayName: "Untrusted Cloud Fixture Provider",
		kind: "cloud",
		trustLevel: "untrusted-cloud",
		models: [
			{
				id: makeProviderModelId("untrusted-cloud-chat-fixture"),
				providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				displayName: "Untrusted Cloud Chat Fixture",
				roles: ["chat"],
				capabilities: ["chat"],
				isDefault: true,
			},
		],
	},
] as const;

const compareStrings = (left: string, right: string): number =>
	left.localeCompare(right, "en", { sensitivity: "base" });

const providerKindSortWeight = (kind: ProviderKind): number => {
	switch (kind) {
		case "local":
			return 0;
		case "cloud":
			return 1;
		default:
			return assertNeverProviderValue(kind);
	}
};

const compareProviders = (left: ProviderDefinition, right: ProviderDefinition): number => {
	const kindComparison = providerKindSortWeight(left.kind) - providerKindSortWeight(right.kind);

	if (kindComparison !== 0) {
		return kindComparison;
	}

	return compareStrings(left.id, right.id);
};

const compareModels = (left: ProviderModelDefinition, right: ProviderModelDefinition): number =>
	compareStrings(left.id, right.id);

export const listProviders = (
	providers: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): readonly ProviderDefinition[] => [...providers].sort(compareProviders);

export const listCloudProviders = (
	providers: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): readonly ProviderDefinition[] => listProviders(providers).filter((provider) => isCloudProviderKind(provider.kind));

export const findRegisteredProvider = (
	providerId: ProviderId,
	providers: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): ProviderDefinition | undefined => providers.find((provider) => provider.id === providerId);

export const listProviderModels = (
	providerId: ProviderId,
	providers: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): readonly ProviderModelDefinition[] => {
	const provider = findRegisteredProvider(providerId, providers);

	if (provider === undefined) {
		return [];
	}

	return [...provider.models].sort(compareModels);
};

export const findRegisteredModel = (
	providerId: ProviderId,
	modelId: ProviderModelId,
	providers: readonly ProviderDefinition[] = BASELINE_PROVIDERS,
): ProviderModelDefinition | undefined =>
	listProviderModels(providerId, providers).find((model) => model.id === modelId);

export const hasDuplicateProviderIds = (providers: readonly ProviderDefinition[]): boolean => {
	const seen = new Set<ProviderId>();

	for (const provider of providers) {
		if (seen.has(provider.id)) {
			return true;
		}
		seen.add(provider.id);
	}

	return false;
};
