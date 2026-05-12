import { BASELINE_PROVIDERS } from "../../../src/providers/provider-registry";
import type { ProviderDefinition } from "../../../src/types/providers";

export const SYNTHETIC_PROVIDER_FIXTURE_NOTE =
	"Provider fixtures are synthetic metadata only. They contain no real endpoints, credentials, tokens, or personal vault content.";

export const SYNTHETIC_PROVIDERS: readonly ProviderDefinition[] = BASELINE_PROVIDERS;
