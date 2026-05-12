import { describe, expect, it } from "vitest";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	REDACTED_VALUE,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	createInMemoryProviderSecretStore,
	decideVaultDisclosure,
	hasDuplicateProviderIds,
	listProviders,
	makeProviderId,
	makeProviderModelId,
	preflightProviderInvocation,
	redactDiagnostic,
	selectProviderModel,
} from "../src/providers";
import type { CapabilitySelectionDecision, ProviderPrivacyPolicy } from "../src/types/providers";
import { SYNTHETIC_PROVIDERS, SYNTHETIC_PROVIDER_FIXTURE_NOTE } from "./fixtures/providers/synthetic-providers";

const localFirstPolicy: ProviderPrivacyPolicy = {
	areCloudProvidersEnabled: false,
	trustedProviderIds: [],
};

const trustedCloudPolicy: ProviderPrivacyPolicy = {
	areCloudProvidersEnabled: true,
	trustedProviderIds: [TRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
};

const expectCapabilityAllowed = (decision: CapabilitySelectionDecision) => {
	if (!decision.ok) {
		throw new Error(`Expected capability selection to pass, got ${decision.code}`);
	}

	return decision;
};

describe("provider registry and capability selection", () => {
	it("lists synthetic providers deterministically without duplicate provider IDs", () => {
		const providerIds = listProviders(SYNTHETIC_PROVIDERS).map((provider) => provider.id);

		expect(providerIds).toEqual([
			LOCAL_FIXTURE_PROVIDER_ID,
			TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
		]);
		expect(hasDuplicateProviderIds(SYNTHETIC_PROVIDERS)).toBe(false);
		expect(SYNTHETIC_PROVIDER_FIXTURE_NOTE).not.toContain("sk-");
	});

	it("selects a supported local chat model before invocation", () => {
		const decision = expectCapabilityAllowed(
			selectProviderModel(BASELINE_PROVIDERS, {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				requiredCapability: "chat",
			}),
		);

		expect(decision.model.id).toBe(makeProviderModelId("local-chat-fixture"));
	});

	it("denies unknown providers and unsupported preferred model capabilities", () => {
		expect(
			selectProviderModel(BASELINE_PROVIDERS, {
				providerId: makeProviderId("missing-provider"),
				requiredCapability: "chat",
			}),
		).toMatchObject({
			ok: false,
			code: "provider-not-found",
		});

		expect(
			selectProviderModel(BASELINE_PROVIDERS, {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				preferredModelId: makeProviderModelId("local-chat-fixture"),
				requiredCapability: "embeddings",
			}),
		).toMatchObject({
			ok: false,
			code: "capability-unsupported",
		});
	});
});

describe("provider privacy guard", () => {
	it("allows local private vault content without cloud opt-in", () => {
		const decision = decideVaultDisclosure(BASELINE_PROVIDERS, localFirstPolicy, {
			providerId: LOCAL_FIXTURE_PROVIDER_ID,
			requiredCapability: "chat",
			contentSensitivity: "private-vault",
		});

		expect(decision).toMatchObject({
			allowed: true,
			reason: "Local provider disclosure stays on this machine.",
		});
	});

	it("denies cloud disclosure until cloud is enabled and the provider is trusted", () => {
		expect(
			decideVaultDisclosure(BASELINE_PROVIDERS, localFirstPolicy, {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				requiredCapability: "chat",
				contentSensitivity: "private-vault",
			}),
		).toMatchObject({
			allowed: false,
			code: "cloud-disabled",
		});

		expect(
			decideVaultDisclosure(
				BASELINE_PROVIDERS,
				{ areCloudProvidersEnabled: true, trustedProviderIds: [] },
				{
					providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					requiredCapability: "chat",
					contentSensitivity: "private-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "provider-not-trusted",
		});
	});

	it("allows trusted cloud providers and denies untrusted private vault disclosure", () => {
		expect(
			decideVaultDisclosure(BASELINE_PROVIDERS, trustedCloudPolicy, {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				requiredCapability: "chat",
				contentSensitivity: "private-vault",
			}),
		).toMatchObject({
			allowed: true,
			reason: "Cloud provider disclosure is enabled and trusted for this request.",
		});

		expect(
			decideVaultDisclosure(
				BASELINE_PROVIDERS,
				{
					areCloudProvidersEnabled: true,
					trustedProviderIds: [UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID],
				},
				{
					providerId: UNTRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
					requiredCapability: "chat",
					contentSensitivity: "private-vault",
				},
			),
		).toMatchObject({
			allowed: false,
			code: "private-content-cloud-denied",
		});
	});

	it("composes privacy and capability preflight before invocation", () => {
		expect(
			preflightProviderInvocation(BASELINE_PROVIDERS, trustedCloudPolicy, {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				requiredCapability: "tools",
				contentSensitivity: "private-vault",
			}),
		).toMatchObject({
			allowed: true,
			model: { id: makeProviderModelId("trusted-cloud-chat-fixture") },
		});

		expect(
			preflightProviderInvocation(BASELINE_PROVIDERS, trustedCloudPolicy, {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				preferredModelId: makeProviderModelId("trusted-cloud-chat-fixture"),
				requiredCapability: "embeddings",
				contentSensitivity: "private-vault",
			}),
		).toMatchObject({
			allowed: false,
			code: "capability-unsupported",
		});
	});
});

describe("provider secret references and redaction", () => {
	it("stores runtime credentials behind opaque references", async () => {
		const store = createInMemoryProviderSecretStore({
			now: () => new Date("2026-05-12T00:00:00.000Z"),
		});

		const saved = await store.save({
			providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			label: "Test Credential",
			value: "runtime-credential-value",
		});

		expect(saved).toMatchObject({
			ok: true,
			value: {
				kind: "provider-secret",
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				label: "Test Credential",
			},
		});
		expect(JSON.stringify(saved)).not.toContain("runtime-credential-value");

		if (!saved.ok) {
			throw new Error("Expected secret save to pass");
		}

		const read = await store.read(saved.value);
		expect(read).toEqual({ ok: true, value: "runtime-credential-value" });

		await store.delete(saved.value);
		expect(await store.read(saved.value)).toMatchObject({
			ok: false,
			error: { code: "secret-not-found" },
		});
	});

	it("prevents duplicate secret writes while an earlier write is in flight", async () => {
		let releaseWrite: (() => void) | undefined;
		const store = createInMemoryProviderSecretStore({
			beforeWrite: () =>
				new Promise<void>((resolve) => {
					releaseWrite = resolve;
				}),
		});

		const firstWrite = store.save({
			providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
			label: "Test Credential",
			value: "first-runtime-value",
		});
		await Promise.resolve();

		await expect(
			store.save({
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				label: "Test Credential",
				value: "second-runtime-value",
			}),
		).resolves.toMatchObject({
			ok: false,
			error: { code: "write-in-flight" },
		});

		releaseWrite?.();
		await expect(firstWrite).resolves.toMatchObject({ ok: true });
	});

	it("redacts nested diagnostics, arrays, errors, and secret-like keys", () => {
		const redacted = redactDiagnostic({
			apiKey: "runtime-credential-value",
			nested: [
				{ authorization: "Bearer abcdefghijklmnop" },
				{ message: "token=abcdefgh and provider key sk-abcdefgh12345678" },
			],
			error: new Error("password=runtime-credential-value"),
		});

		expect(redacted).toEqual({
			ok: true,
			value: {
				apiKey: REDACTED_VALUE,
				nested: [
					{ authorization: REDACTED_VALUE },
					{ message: `token=${REDACTED_VALUE} and provider key ${REDACTED_VALUE}` },
				],
				error: {
					name: "Error",
					message: `password=${REDACTED_VALUE}`,
				},
			},
		});
	});

	it("returns explicit redaction failures for unsupported diagnostic values", () => {
		expect(redactDiagnostic({ handler: () => undefined })).toMatchObject({
			ok: false,
			code: "invalid-diagnostic-input",
			field: "root.handler",
		});
	});
});
