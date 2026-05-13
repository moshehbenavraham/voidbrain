import type {
	ProviderInvocationAttempt,
	ProviderInvocationAttemptStatus,
	ProviderInvocationBoundaryFailure,
	ProviderInvocationBoundaryRequest,
	ProviderInvocationBoundaryResult,
	ProviderInvocationDuplicateKey,
	ProviderInvocationMetadata,
	ProviderInvocationTransport,
	ProviderInvocationTransportResult,
} from "../types/provider-invocation";
import { makeProviderInvocationDuplicateKey } from "../types/provider-invocation";
import type { RedactedDiagnostic, RedactedDiagnosticObject } from "../types/providers";
import { makeIsoTimestamp } from "../types/vault";
import { REDACTED_VALUE, redactDiagnostic } from "./redaction";

export interface ProviderInvocationBoundaryOptions<TPayload, TValue, TCode extends string> {
	readonly transport: ProviderInvocationTransport<TPayload, TValue, TCode>;
	readonly defaultFailureCode: TCode;
	readonly timeoutFailureCode: TCode;
	readonly canceledFailureCode: TCode;
	readonly duplicateFailureCode: TCode;
	readonly defaultFailureMessage: string;
	readonly timeoutMessage: string;
	readonly canceledMessage: string;
	readonly duplicateMessage: string;
	readonly now?: () => Date;
	readonly sleep?: (durationMs: number) => Promise<void>;
}

interface TimedTransportSuccess<TValue, TCode extends string> {
	readonly kind: "result";
	readonly result: ProviderInvocationTransportResult<TValue, TCode>;
}

interface TimedTransportTimeout {
	readonly kind: "timeout";
}

interface TimedTransportCanceled {
	readonly kind: "canceled";
}

interface TimedTransportError {
	readonly kind: "error";
	readonly error: unknown;
}

type TimedTransportResult<TValue, TCode extends string> =
	| TimedTransportSuccess<TValue, TCode>
	| TimedTransportTimeout
	| TimedTransportCanceled
	| TimedTransportError;

const unsafeDiagnosticKeyFragments = [
	"authorization",
	"credential",
	"header",
	"prompt",
	"body",
	"content",
	"question",
	"evidence",
	"snippet",
	"sourcepath",
	"sourcepaths",
	"vaultpath",
	"hiddenproviderstate",
	"transportstate",
	"raw",
] as const;

const defaultSleep = (durationMs: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});

const normalizeDiagnosticKey = (key: string): string => key.replaceAll(/[\s_-]/g, "").toLowerCase();

const isUnsafeDiagnosticKey = (key: string): boolean => {
	const normalized = normalizeDiagnosticKey(key);
	if (normalized.endsWith("count")) {
		return false;
	}

	return unsafeDiagnosticKeyFragments.some((fragment) => normalized.includes(fragment));
};

const isRedactedDiagnosticObject = (value: RedactedDiagnostic): value is RedactedDiagnosticObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isSignalAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

const sanitizeRedactedDiagnostic = (value: RedactedDiagnostic, key = ""): RedactedDiagnostic => {
	if (key.length > 0 && isUnsafeDiagnosticKey(key)) {
		return REDACTED_VALUE;
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeRedactedDiagnostic(item));
	}

	if (isRedactedDiagnosticObject(value)) {
		const sanitized: Record<string, RedactedDiagnostic> = {};
		for (const [childKey, childValue] of Object.entries(value)) {
			sanitized[childKey] = sanitizeRedactedDiagnostic(childValue, childKey);
		}
		return sanitized;
	}

	return value;
};

export const createProviderInvocationKey = (
	parts: readonly (string | number | boolean | null | undefined)[],
): ProviderInvocationDuplicateKey =>
	makeProviderInvocationDuplicateKey(parts.map((part) => String(part ?? "none").replaceAll("|", "%7C")).join("|"));

export const providerInvocationRecoveryDiagnostic = (
	metadata: ProviderInvocationMetadata,
): RedactedDiagnosticObject => ({
	commandId: metadata.commandId,
	providerId: metadata.providerId,
	modelId: metadata.modelId,
	role: metadata.role,
	requiredCapability: metadata.requiredCapability,
	contentSensitivity: metadata.contentSensitivity,
	sourcePathCount: metadata.sourcePathCount,
	targetPath: metadata.recovery.targetPath ?? null,
	cachePath: metadata.recovery.cachePath ?? null,
	stagedChangeId: metadata.recovery.stagedChangeId ?? null,
	reportId: metadata.recovery.reportId ?? null,
	readinessCode: metadata.recovery.readinessCode ?? null,
	validationOutput: metadata.recovery.validationOutput,
});

export const providerInvocationErrorDiagnostic = (
	metadata: ProviderInvocationMetadata,
	attempt: number,
	error: unknown,
): RedactedDiagnosticObject =>
	normalizeProviderInvocationDiagnostic(
		{
			...providerInvocationRecoveryDiagnostic(metadata),
			attempt,
			error,
		},
		providerInvocationRecoveryDiagnostic(metadata),
	);

export const normalizeProviderInvocationDiagnostic = (
	input: unknown,
	fallback: RedactedDiagnosticObject = {},
): RedactedDiagnosticObject => {
	const redacted = redactDiagnostic(input);
	if (
		!redacted.ok ||
		typeof redacted.value !== "object" ||
		redacted.value === null ||
		Array.isArray(redacted.value)
	) {
		return {
			...fallback,
			redaction: "failed",
		};
	}

	const sanitized = sanitizeRedactedDiagnostic(redacted.value);
	if (!isRedactedDiagnosticObject(sanitized)) {
		return {
			...fallback,
			redaction: "failed",
		};
	}

	return {
		...fallback,
		...sanitized,
	};
};

export const createProviderInvocationAttempt = (input: {
	readonly attempt: number;
	readonly startedAt: Date;
	readonly completedAt?: Date;
	readonly status: ProviderInvocationAttemptStatus;
	readonly retryable: boolean;
	readonly diagnostic?: RedactedDiagnosticObject;
}): ProviderInvocationAttempt => ({
	attempt: input.attempt,
	startedAt: makeIsoTimestamp(input.startedAt.toISOString()),
	...(input.completedAt === undefined ? {} : { completedAt: makeIsoTimestamp(input.completedAt.toISOString()) }),
	status: input.status,
	retryable: input.retryable,
	...(input.diagnostic === undefined ? {} : { diagnostic: input.diagnostic }),
});

const runTransportWithBoundary = async <TPayload, TValue, TCode extends string>(
	transport: ProviderInvocationTransport<TPayload, TValue, TCode>,
	request: ProviderInvocationBoundaryRequest<TPayload>,
	attempt: number,
): Promise<TimedTransportResult<TValue, TCode>> => {
	if (isSignalAborted(request.parentSignal)) {
		return { kind: "canceled" };
	}

	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let abortListener: (() => void) | undefined;
	const timeout = new Promise<"timeout">((resolve) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			resolve("timeout");
		}, request.policy.timeoutMs);
	});
	const races: Array<Promise<ProviderInvocationTransportResult<TValue, TCode> | "timeout" | "canceled">> = [
		transport({
			metadata: request.metadata,
			payload: request.payload,
			attempt,
			signal: controller.signal,
		}),
		timeout,
	];

	if (request.parentSignal !== undefined) {
		races.push(
			new Promise<"canceled">((resolve) => {
				abortListener = () => {
					controller.abort();
					resolve("canceled");
				};
				request.parentSignal?.addEventListener("abort", abortListener, { once: true });
			}),
		);
	}

	try {
		const result = await Promise.race(races);
		if (result === "timeout") {
			return { kind: "timeout" };
		}
		if (result === "canceled") {
			return { kind: "canceled" };
		}

		return {
			kind: "result",
			result,
		};
	} catch (error) {
		if (isSignalAborted(request.parentSignal)) {
			return { kind: "canceled" };
		}

		return {
			kind: "error",
			error,
		};
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		if (abortListener !== undefined) {
			request.parentSignal?.removeEventListener("abort", abortListener);
		}
		controller.abort();
	}
};

const failure = <TCode extends string>(
	code: TCode,
	message: string,
	retryable: boolean,
	attempts: readonly ProviderInvocationAttempt[],
	diagnostic: RedactedDiagnosticObject,
): ProviderInvocationBoundaryFailure<TCode> => ({
	ok: false,
	code,
	message,
	retryable,
	attempts,
	diagnostic,
});

export const createProviderInvocationBoundary = <TPayload, TValue, TCode extends string>(
	options: ProviderInvocationBoundaryOptions<TPayload, TValue, TCode>,
): ((
	request: ProviderInvocationBoundaryRequest<TPayload>,
) => Promise<ProviderInvocationBoundaryResult<TValue, TCode>>) => {
	const now = options.now ?? (() => new Date());
	const sleep = options.sleep ?? defaultSleep;
	const inFlightKeys = new Set<ProviderInvocationDuplicateKey>();

	return async (request) => {
		const metadataDiagnostic = providerInvocationRecoveryDiagnostic(request.metadata);
		if (inFlightKeys.has(request.metadata.invocationKey)) {
			const diagnostic = normalizeProviderInvocationDiagnostic(
				{
					...metadataDiagnostic,
					reason: "duplicate-invocation",
				},
				metadataDiagnostic,
			);
			return failure(
				options.duplicateFailureCode,
				options.duplicateMessage,
				true,
				[
					createProviderInvocationAttempt({
						attempt: 0,
						startedAt: now(),
						completedAt: now(),
						status: "duplicate",
						retryable: true,
						diagnostic,
					}),
				],
				diagnostic,
			);
		}

		if (isSignalAborted(request.parentSignal)) {
			const diagnostic = normalizeProviderInvocationDiagnostic(
				{
					...metadataDiagnostic,
					reason: "parent-signal-aborted",
				},
				metadataDiagnostic,
			);
			return failure(options.canceledFailureCode, options.canceledMessage, true, [], diagnostic);
		}

		inFlightKeys.add(request.metadata.invocationKey);
		const attempts: ProviderInvocationAttempt[] = [];
		let lastFailure = failure(
			options.defaultFailureCode,
			options.defaultFailureMessage,
			true,
			attempts,
			normalizeProviderInvocationDiagnostic(
				{
					...metadataDiagnostic,
					reason: "not-run",
				},
				metadataDiagnostic,
			),
		);

		try {
			for (let attempt = 1; attempt <= request.policy.maxAttempts; attempt += 1) {
				const startedAt = now();
				const timed = await runTransportWithBoundary(options.transport, request, attempt);
				const completedAt = now();

				if (timed.kind === "canceled") {
					const diagnostic = normalizeProviderInvocationDiagnostic(
						{
							...metadataDiagnostic,
							attempt,
							reason: "canceled",
						},
						metadataDiagnostic,
					);
					attempts.push(
						createProviderInvocationAttempt({
							attempt,
							startedAt,
							completedAt,
							status: "canceled",
							retryable: true,
							diagnostic,
						}),
					);
					lastFailure = failure(
						options.canceledFailureCode,
						options.canceledMessage,
						true,
						attempts,
						diagnostic,
					);
					break;
				}

				if (timed.kind === "timeout") {
					const retryable = attempt < request.policy.maxAttempts;
					const diagnostic = normalizeProviderInvocationDiagnostic(
						{
							...metadataDiagnostic,
							attempt,
							timeoutMs: request.policy.timeoutMs,
							reason: "timeout",
						},
						metadataDiagnostic,
					);
					attempts.push(
						createProviderInvocationAttempt({
							attempt,
							startedAt,
							completedAt,
							status: "timed-out",
							retryable,
							diagnostic,
						}),
					);
					lastFailure = failure(
						options.timeoutFailureCode,
						options.timeoutMessage,
						retryable,
						attempts,
						diagnostic,
					);
				} else if (timed.kind === "error") {
					const retryable = attempt < request.policy.maxAttempts;
					const diagnostic = providerInvocationErrorDiagnostic(request.metadata, attempt, timed.error);
					attempts.push(
						createProviderInvocationAttempt({
							attempt,
							startedAt,
							completedAt,
							status: "failed",
							retryable,
							diagnostic,
						}),
					);
					lastFailure = failure(
						options.defaultFailureCode,
						options.defaultFailureMessage,
						retryable,
						attempts,
						diagnostic,
					);
				} else if (timed.result.ok) {
					const diagnostic = normalizeProviderInvocationDiagnostic(
						timed.result.diagnostic ?? metadataDiagnostic,
						metadataDiagnostic,
					);
					attempts.push(
						createProviderInvocationAttempt({
							attempt,
							startedAt,
							completedAt,
							status: "succeeded",
							retryable: false,
							diagnostic,
						}),
					);
					return {
						ok: true,
						value: timed.result.value,
						attempts,
						diagnostic,
					};
				} else {
					const retryable =
						(timed.result.retryable ?? attempt < request.policy.maxAttempts) &&
						attempt < request.policy.maxAttempts;
					const diagnostic = normalizeProviderInvocationDiagnostic(
						timed.result.diagnostic ?? {
							...metadataDiagnostic,
							attempt,
							reason: timed.result.code,
						},
						metadataDiagnostic,
					);
					attempts.push(
						createProviderInvocationAttempt({
							attempt,
							startedAt,
							completedAt,
							status: "failed",
							retryable,
							diagnostic,
						}),
					);
					lastFailure = failure(timed.result.code, timed.result.message, retryable, attempts, diagnostic);
				}

				if (!lastFailure.retryable || attempt >= request.policy.maxAttempts) {
					break;
				}

				if (request.policy.retryBackoffMs > 0) {
					await sleep(request.policy.retryBackoffMs);
				}

				if (isSignalAborted(request.parentSignal)) {
					const diagnostic = normalizeProviderInvocationDiagnostic(
						{
							...metadataDiagnostic,
							reason: "parent-signal-aborted-during-backoff",
						},
						metadataDiagnostic,
					);
					lastFailure = failure(
						options.canceledFailureCode,
						options.canceledMessage,
						true,
						attempts,
						diagnostic,
					);
					break;
				}
			}

			return {
				...lastFailure,
				attempts,
				retryable: false,
			};
		} finally {
			inFlightKeys.delete(request.metadata.invocationKey);
		}
	};
};
