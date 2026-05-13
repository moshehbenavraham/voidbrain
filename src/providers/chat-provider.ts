import type { ChatFailureCode, ChatProviderAttempt, ChatProviderRequest, ChatProviderResponse } from "../types/chat";
import type { RedactedDiagnosticObject } from "../types/providers";
import { makeIsoTimestamp } from "../types/vault";
import { redactDiagnostic } from "./redaction";

export interface ProviderChatTransportInput {
	readonly request: ChatProviderRequest;
	readonly attempt: number;
	readonly signal: AbortSignal;
}

export interface ProviderChatTransportSuccess {
	readonly ok: true;
	readonly response: ChatProviderResponse;
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ProviderChatTransportFailure {
	readonly ok: false;
	readonly code: ChatFailureCode;
	readonly message: string;
	readonly diagnostic?: unknown;
	readonly retryable?: boolean;
}

export type ProviderChatTransportResult = ProviderChatTransportSuccess | ProviderChatTransportFailure;

export type ProviderChatTransport = (input: ProviderChatTransportInput) => Promise<ProviderChatTransportResult>;

export interface ProviderChatInvocationSuccess {
	readonly ok: true;
	readonly response: ChatProviderResponse;
	readonly attempts: readonly ChatProviderAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface ProviderChatInvocationFailure {
	readonly ok: false;
	readonly code: ChatFailureCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly attempts: readonly ChatProviderAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export type ProviderChatInvocationResult = ProviderChatInvocationSuccess | ProviderChatInvocationFailure;

export type ProviderChatInvoker = (request: ChatProviderRequest) => Promise<ProviderChatInvocationResult>;

export interface ProviderChatInvokerOptions {
	readonly transport?: ProviderChatTransport;
	readonly maxAttempts?: number;
	readonly retryBackoffMs?: number;
	readonly now?: () => Date;
	readonly sleep?: (durationMs: number) => Promise<void>;
}

interface TimedTransportResult {
	readonly timedOut: boolean;
	readonly result?: ProviderChatTransportResult;
	readonly error?: unknown;
}

const defaultMaxAttempts = 2;
const defaultRetryBackoffMs = 100;

const defaultSleep = (durationMs: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});

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

const defaultTransport: ProviderChatTransport = async ({ request }) => ({
	ok: false,
	code: "chat.provider-unavailable",
	message: "Provider chat invocation is not configured.",
	diagnostic: {
		providerId: request.providerId,
		modelId: request.modelId,
		commandId: request.commandId,
		reason: "missing-runtime-adapter",
	},
	retryable: false,
});

const runTransportWithTimeout = async (
	transport: ProviderChatTransport,
	input: Omit<ProviderChatTransportInput, "signal">,
	timeoutMs: number,
): Promise<TimedTransportResult> => {
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
			transport({
				...input,
				signal: controller.signal,
			}),
			timeoutPromise,
		]);

		if (result === "timeout") {
			return {
				timedOut: true,
			};
		}

		return {
			timedOut: false,
			result,
		};
	} catch (error) {
		return {
			timedOut: false,
			error,
		};
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		controller.abort();
	}
};

const createAttempt = (
	now: () => Date,
	attempt: number,
	status: ChatProviderAttempt["status"],
	diagnostic: unknown,
): ChatProviderAttempt => ({
	attempt,
	startedAt: makeIsoTimestamp(now().toISOString()),
	completedAt: makeIsoTimestamp(now().toISOString()),
	status,
	diagnostic: toDiagnosticObject(diagnostic),
});

const validateProviderResponse = (
	request: ChatProviderRequest,
	response: ChatProviderResponse,
): ProviderChatInvocationFailure | null => {
	if (response.answer.trim().length === 0) {
		return {
			ok: false,
			code: "chat.provider-failed",
			message: "Provider returned an empty answer.",
			retryable: true,
			attempts: [],
			diagnostic: toDiagnosticObject({
				providerId: request.providerId,
				modelId: request.modelId,
				reason: "empty-answer",
			}),
		};
	}

	const knownCitationIds = new Set(request.citations.map((citation) => citation.id));
	if (response.citations.length === 0 || response.citations.some((citationId) => !knownCitationIds.has(citationId))) {
		return {
			ok: false,
			code: "chat.citation-missing",
			message: "Provider answer did not cite the retrieved evidence.",
			retryable: false,
			attempts: [],
			diagnostic: toDiagnosticObject({
				providerId: request.providerId,
				modelId: request.modelId,
				reason: "citation-missing",
				citationCount: response.citations.length,
			}),
		};
	}

	return null;
};

export const createProviderChatInvoker = (options: ProviderChatInvokerOptions = {}): ProviderChatInvoker => {
	const transport = options.transport ?? defaultTransport;
	const now = options.now ?? (() => new Date());
	const maxAttempts = Math.max(1, options.maxAttempts ?? defaultMaxAttempts);
	const retryBackoffMs = Math.max(0, options.retryBackoffMs ?? defaultRetryBackoffMs);
	const sleep = options.sleep ?? defaultSleep;

	return async (request) => {
		const timeoutMs = Math.max(1, request.timeoutMs);
		const attempts: ChatProviderAttempt[] = [];
		let lastFailure: ProviderChatInvocationFailure = {
			ok: false,
			code: "chat.provider-failed",
			message: "Provider chat invocation did not run.",
			retryable: true,
			attempts,
			diagnostic: toDiagnosticObject({
				providerId: request.providerId,
				modelId: request.modelId,
				reason: "not-run",
			}),
		};

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			const timed = await runTransportWithTimeout(
				transport,
				{
					request,
					attempt,
				},
				timeoutMs,
			);

			if (timed.timedOut) {
				const diagnostic = {
					providerId: request.providerId,
					modelId: request.modelId,
					attempt,
					timeoutMs,
					reason: "timeout",
				};
				attempts.push(createAttempt(now, attempt, "timed-out", diagnostic));
				lastFailure = {
					ok: false,
					code: "chat.provider-timeout",
					message: "Provider chat invocation timed out.",
					retryable: attempt < maxAttempts,
					attempts,
					diagnostic: toDiagnosticObject(diagnostic),
				};
			} else if (timed.error !== undefined) {
				const diagnostic = {
					providerId: request.providerId,
					modelId: request.modelId,
					attempt,
					error: timed.error,
				};
				attempts.push(createAttempt(now, attempt, "failed", diagnostic));
				lastFailure = {
					ok: false,
					code: "chat.provider-failed",
					message: "Provider chat invocation failed.",
					retryable: attempt < maxAttempts,
					attempts,
					diagnostic: toDiagnosticObject(diagnostic),
				};
			} else if (timed.result?.ok) {
				attempts.push(createAttempt(now, attempt, "succeeded", timed.result.diagnostic ?? {}));
				const invalidResponse = validateProviderResponse(request, timed.result.response);
				if (invalidResponse !== null) {
					return {
						...invalidResponse,
						attempts,
					};
				}

				return {
					ok: true,
					response: timed.result.response,
					attempts,
					diagnostic: toDiagnosticObject(
						timed.result.diagnostic ?? {
							providerId: request.providerId,
							modelId: request.modelId,
							attempt,
						},
					),
				};
			} else if (timed.result !== undefined) {
				attempts.push(createAttempt(now, attempt, "failed", timed.result.diagnostic ?? {}));
				const retryable = timed.result.retryable ?? attempt < maxAttempts;
				lastFailure = {
					ok: false,
					code: timed.result.code,
					message: timed.result.message,
					retryable: retryable && attempt < maxAttempts,
					attempts,
					diagnostic: toDiagnosticObject(
						timed.result.diagnostic ?? {
							providerId: request.providerId,
							modelId: request.modelId,
							attempt,
						},
					),
				};
			}

			if (!lastFailure.retryable || attempt >= maxAttempts) {
				break;
			}

			if (retryBackoffMs > 0) {
				await sleep(retryBackoffMs);
			}
		}

		return {
			...lastFailure,
			attempts,
			retryable: false,
		};
	};
};

export const defaultProviderChatInvoker = createProviderChatInvoker();
