import type {
	LocalRuntimeReadinessProbe,
	ProviderAuthTestProbe,
	ProviderAuthTestProbeInput,
	ProviderAuthTestProbeResult,
	ProviderAuthTestRecord,
	UserProviderProfile,
} from "../types/provider-setup";
import type { RedactedDiagnosticObject } from "../types/providers";
import { localRuntimeReadinessToAuthRecord, runLocalRuntimeReadinessProbe } from "./local-runtime-readiness";
import { createOpenAICompatibleAuthReadinessRecord } from "./openai-compatible-profiles";
import { redactDiagnostic } from "./redaction";
import type { ProviderSecretStore } from "./secret-store";

export interface ProviderAuthTestRunnerOptions {
	readonly secretStore?: ProviderSecretStore;
	readonly probe?: ProviderAuthTestProbe;
	readonly localRuntimeProbe?: LocalRuntimeReadinessProbe;
	readonly useLocalRuntimeReadiness?: boolean;
	readonly timeoutMs?: number;
	readonly maxAttempts?: number;
	readonly retryBackoffMs?: number;
	readonly now?: () => Date;
	readonly sleep?: (durationMs: number) => Promise<void>;
}

interface TimedProbeResult {
	readonly timedOut: boolean;
	readonly result?: ProviderAuthTestProbeResult;
	readonly error?: unknown;
	readonly durationMs: number;
}

const defaultTimeoutMs = 5000;
const defaultMaxAttempts = 2;
const defaultRetryBackoffMs = 100;

const isCloudProfile = (profile: UserProviderProfile): boolean => profile.providerKind === "cloud";

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

const nullableStatusCode = (statusCode: unknown): number | null =>
	typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
		? statusCode
		: null;

const nonNegativeModelCount = (modelCount: unknown, fallback: number): number =>
	typeof modelCount === "number" && Number.isInteger(modelCount) && modelCount >= 0 ? modelCount : fallback;

const defaultSleep = (durationMs: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});

const defaultProbe: ProviderAuthTestProbe = async ({ profile, runtimeCredential, signal }) => {
	if (signal.aborted) {
		return {
			ok: false,
			diagnostic: {
				providerId: profile.id,
				reason: "aborted",
			},
		};
	}

	return {
		ok: true,
		modelCount: profile.models.length,
		...(profile.providerKind === "cloud" ? { statusCode: 200 } : {}),
		diagnostic: {
			providerId: profile.id,
			providerKind: profile.providerKind,
			endpointHost: profile.endpoint.hostname ?? null,
			hasRuntimeCredential: runtimeCredential !== null,
			modelCount: profile.models.length,
		},
	};
};

const createRecord = (
	profile: UserProviderProfile,
	status: ProviderAuthTestRecord["status"],
	checkedAt: Date,
	durationMs: number,
	statusCode: number | null,
	modelCount: number,
	diagnostic: unknown,
): ProviderAuthTestRecord => {
	const checkedAtIso = checkedAt.toISOString();
	const redactedDiagnostic = toDiagnosticObject(diagnostic);
	const openaiCompatibleReadiness = createOpenAICompatibleAuthReadinessRecord(
		profile,
		status,
		checkedAtIso,
		durationMs,
		statusCode,
		modelCount,
		redactedDiagnostic,
	);

	return {
		providerId: profile.id,
		status,
		checkedAt: checkedAtIso,
		durationMs,
		statusCode,
		modelCount,
		diagnostic: redactedDiagnostic,
		...(openaiCompatibleReadiness === undefined ? {} : { openaiCompatibleReadiness }),
	};
};

const runProbeWithTimeout = async (
	probe: ProviderAuthTestProbe,
	input: Omit<ProviderAuthTestProbeInput, "signal">,
	timeoutMs: number,
): Promise<TimedProbeResult> => {
	const startedAt = Date.now();
	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<"timeout">((resolve) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			resolve("timeout");
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([
			probe({
				...input,
				signal: controller.signal,
			}),
			timeoutPromise,
		]);
		const durationMs = Math.max(0, Date.now() - startedAt);

		if (result === "timeout") {
			return {
				timedOut: true,
				durationMs,
			};
		}

		return {
			timedOut: false,
			result,
			durationMs,
		};
	} catch (error) {
		return {
			timedOut: false,
			error,
			durationMs: Math.max(0, Date.now() - startedAt),
		};
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		controller.abort();
	}
};

export const runProviderAuthTest = async (
	profile: UserProviderProfile,
	options: ProviderAuthTestRunnerOptions = {},
): Promise<ProviderAuthTestRecord> => {
	const now = options.now ?? (() => new Date());
	const checkedAt = now();
	const timeoutMs = Math.max(1, options.timeoutMs ?? defaultTimeoutMs);
	const maxAttempts = Math.max(1, options.maxAttempts ?? defaultMaxAttempts);
	const retryBackoffMs = Math.max(0, options.retryBackoffMs ?? defaultRetryBackoffMs);
	const sleep = options.sleep ?? defaultSleep;
	const probe = options.probe ?? defaultProbe;

	if (profile.providerKind === "local" && options.useLocalRuntimeReadiness === true) {
		const readiness = await runLocalRuntimeReadinessProbe(profile, {
			...(options.localRuntimeProbe === undefined ? {} : { probe: options.localRuntimeProbe }),
			timeoutMs,
			now,
		});

		return localRuntimeReadinessToAuthRecord(profile, readiness);
	}

	let runtimeCredential: string | null = null;
	if (profile.credentialReference !== null) {
		const readResult = await options.secretStore?.read(profile.credentialReference);
		if (readResult === undefined || !readResult.ok) {
			return createRecord(profile, "missing-secret", checkedAt, 0, null, profile.models.length, {
				providerId: profile.id,
				reason: "missing-runtime-reference",
			});
		}
		runtimeCredential = readResult.value;
	} else if (isCloudProfile(profile)) {
		return createRecord(profile, "missing-secret", checkedAt, 0, null, profile.models.length, {
			providerId: profile.id,
			reason: "missing-runtime-reference",
		});
	}

	let lastDiagnostic: unknown = {
		providerId: profile.id,
		reason: "not-run",
	};
	let lastDurationMs = 0;
	let lastStatusCode: number | null = null;
	const lastModelCount = profile.models.length;
	let didTimeout = false;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const probeResult = await runProbeWithTimeout(
			probe,
			{
				profile,
				runtimeCredential,
				attempt,
			},
			timeoutMs,
		);

		lastDurationMs += probeResult.durationMs;
		if (probeResult.timedOut) {
			didTimeout = true;
			lastDiagnostic = {
				providerId: profile.id,
				attempt,
				reason: "timeout",
				timeoutMs,
			};
		} else if (probeResult.error !== undefined) {
			lastDiagnostic = {
				providerId: profile.id,
				attempt,
				error: probeResult.error,
			};
		} else if (probeResult.result?.ok) {
			return createRecord(
				profile,
				"passed",
				checkedAt,
				lastDurationMs,
				nullableStatusCode(probeResult.result.statusCode),
				nonNegativeModelCount(probeResult.result.modelCount, profile.models.length),
				probeResult.result.diagnostic ?? {
					providerId: profile.id,
					attempt,
					modelCount: profile.models.length,
				},
			);
		} else if (probeResult.result !== undefined) {
			lastStatusCode = nullableStatusCode(probeResult.result.statusCode);
			lastDiagnostic = probeResult.result.diagnostic ?? {
				providerId: profile.id,
				attempt,
				reason: "auth-failed",
			};
		}

		if (attempt < maxAttempts && retryBackoffMs > 0) {
			await sleep(retryBackoffMs);
		}
	}

	return createRecord(
		profile,
		didTimeout ? "timeout" : "failed",
		checkedAt,
		lastDurationMs,
		lastStatusCode,
		lastModelCount,
		lastDiagnostic,
	);
};
