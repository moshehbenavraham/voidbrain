import type { ChatFailureCode, ChatProviderAttempt, ChatProviderRequest, ChatProviderResponse } from "../types/chat";
import type { ProviderInvocationMetadata, ProviderInvocationRecoveryMetadata } from "../types/provider-invocation";
import type { RedactedDiagnosticObject } from "../types/providers";
import {
	createProviderInvocationBoundary,
	createProviderInvocationKey,
	normalizeProviderInvocationDiagnostic,
	providerInvocationRecoveryDiagnostic,
} from "./provider-invocation";

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

const defaultMaxAttempts = 2;
const defaultRetryBackoffMs = 100;

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

const chatRecoveryForRequest = (request: ChatProviderRequest): ProviderInvocationRecoveryMetadata => ({
	commandId: request.commandId,
	providerId: request.providerId,
	modelId: request.modelId,
	sourcePathCount: request.sourcePaths.length,
	validationOutput: [],
	...request.recovery,
});

const chatMetadataForRequest = (request: ChatProviderRequest): ProviderInvocationMetadata => {
	const recovery = chatRecoveryForRequest(request);

	return {
		commandId: request.commandId,
		providerId: request.providerId,
		modelId: request.modelId,
		role: "chat",
		requiredCapability: "chat",
		contentSensitivity: request.contentSensitivity,
		invocationKey:
			request.invocationKey ??
			createProviderInvocationKey([
				"chat",
				request.commandId,
				request.threadId,
				request.turnId,
				request.providerId,
				request.modelId,
			]),
		sourcePathCount: request.sourcePaths.length,
		recovery,
	};
};

const validateProviderResponse = (
	request: ChatProviderRequest,
	response: ChatProviderResponse,
	attempts: readonly ChatProviderAttempt[],
): ProviderChatInvocationFailure | null => {
	const metadataDiagnostic = providerInvocationRecoveryDiagnostic(chatMetadataForRequest(request));

	if (response.answer.trim().length === 0) {
		return {
			ok: false,
			code: "chat.provider-failed",
			message: "Provider returned an empty answer.",
			retryable: true,
			attempts,
			diagnostic: normalizeProviderInvocationDiagnostic(
				{
					...metadataDiagnostic,
					reason: "empty-answer",
				},
				metadataDiagnostic,
			),
		};
	}

	const knownCitationIds = new Set(request.citations.map((citation) => citation.id));
	if (response.citations.length === 0 || response.citations.some((citationId) => !knownCitationIds.has(citationId))) {
		return {
			ok: false,
			code: "chat.citation-missing",
			message: "Provider answer did not cite the retrieved evidence.",
			retryable: false,
			attempts,
			diagnostic: normalizeProviderInvocationDiagnostic(
				{
					...metadataDiagnostic,
					reason: "citation-missing",
					citationCount: response.citations.length,
				},
				metadataDiagnostic,
			),
		};
	}

	return null;
};

export const createProviderChatInvoker = (options: ProviderChatInvokerOptions = {}): ProviderChatInvoker => {
	const transport = options.transport ?? defaultTransport;
	const maxAttempts = Math.max(1, options.maxAttempts ?? defaultMaxAttempts);
	const retryBackoffMs = Math.max(0, options.retryBackoffMs ?? defaultRetryBackoffMs);
	const boundary = createProviderInvocationBoundary<ChatProviderRequest, ChatProviderResponse, ChatFailureCode>({
		transport: async ({ payload, attempt, signal }) => {
			const result = await transport({
				request: payload,
				attempt,
				signal,
			});

			if (result.ok) {
				return {
					ok: true,
					value: result.response,
					diagnostic: result.diagnostic ?? result.response.diagnostic,
				};
			}

			return {
				ok: false,
				code: result.code,
				message: result.message,
				diagnostic: result.diagnostic,
				...(result.retryable === undefined ? {} : { retryable: result.retryable }),
			};
		},
		defaultFailureCode: "chat.provider-failed",
		timeoutFailureCode: "chat.provider-timeout",
		canceledFailureCode: "chat.provider-canceled",
		duplicateFailureCode: "chat.duplicate-action",
		defaultFailureMessage: "Provider chat invocation failed.",
		timeoutMessage: "Provider chat invocation timed out.",
		canceledMessage: "Provider chat invocation was canceled.",
		duplicateMessage: "Provider chat invocation is already in flight.",
		...(options.now === undefined ? {} : { now: options.now }),
		...(options.sleep === undefined ? {} : { sleep: options.sleep }),
	});

	return async (request) => {
		const invocation = await boundary({
			metadata: chatMetadataForRequest(request),
			payload: request,
			policy: {
				timeoutMs: Math.max(1, request.timeoutMs),
				maxAttempts,
				retryBackoffMs,
			},
			...(request.signal === undefined ? {} : { parentSignal: request.signal }),
		});

		if (!invocation.ok) {
			return invocation;
		}

		const invalidResponse = validateProviderResponse(request, invocation.value, invocation.attempts);
		if (invalidResponse !== null) {
			return invalidResponse;
		}

		return {
			ok: true,
			response: invocation.value,
			attempts: invocation.attempts,
			diagnostic: invocation.diagnostic,
		};
	};
};

export const defaultProviderChatInvoker = createProviderChatInvoker();
