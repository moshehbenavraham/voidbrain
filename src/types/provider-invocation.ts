import type { AgentCommandId } from "./agent-commands";
import type {
	ContentSensitivity,
	ModelCapability,
	ModelRole,
	ProviderId,
	ProviderModelId,
	RedactedDiagnosticObject,
} from "./providers";
import type { IsoTimestamp, NormalizedVaultPath } from "./vault";

export const PROVIDER_INVOCATION_ATTEMPT_STATUSES = [
	"started",
	"succeeded",
	"failed",
	"timed-out",
	"canceled",
	"duplicate",
] as const;

export type ProviderInvocationAttemptStatus = (typeof PROVIDER_INVOCATION_ATTEMPT_STATUSES)[number];
export type ProviderInvocationDuplicateKey = string & { readonly __providerInvocationDuplicateKey: unique symbol };

export const makeProviderInvocationDuplicateKey = (key: string): ProviderInvocationDuplicateKey =>
	key as ProviderInvocationDuplicateKey;

export interface ProviderInvocationRecoveryMetadata {
	readonly commandId: AgentCommandId | string;
	readonly providerId?: ProviderId | null;
	readonly modelId?: ProviderModelId | null;
	readonly targetPath?: NormalizedVaultPath | string;
	readonly cachePath?: NormalizedVaultPath | string;
	readonly stagedChangeId?: string;
	readonly reportId?: string;
	readonly readinessCode?: string | null;
	readonly sourcePathCount?: number;
	readonly validationOutput: readonly string[];
}

export interface ProviderInvocationMetadata {
	readonly commandId: AgentCommandId | string;
	readonly providerId: ProviderId;
	readonly modelId: ProviderModelId;
	readonly role: ModelRole;
	readonly requiredCapability: ModelCapability;
	readonly contentSensitivity: ContentSensitivity;
	readonly invocationKey: ProviderInvocationDuplicateKey;
	readonly sourcePathCount: number;
	readonly recovery: ProviderInvocationRecoveryMetadata;
}

export interface ProviderInvocationPolicy {
	readonly timeoutMs: number;
	readonly maxAttempts: number;
	readonly retryBackoffMs: number;
}

export interface ProviderInvocationAttempt {
	readonly attempt: number;
	readonly startedAt: IsoTimestamp;
	readonly completedAt?: IsoTimestamp;
	readonly status: ProviderInvocationAttemptStatus;
	readonly retryable: boolean;
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ProviderInvocationTransportInput<TPayload> {
	readonly metadata: ProviderInvocationMetadata;
	readonly payload: TPayload;
	readonly attempt: number;
	readonly signal: AbortSignal;
}

export interface ProviderInvocationTransportSuccess<TValue> {
	readonly ok: true;
	readonly value: TValue;
	readonly diagnostic?: unknown;
}

export interface ProviderInvocationTransportFailure<TCode extends string> {
	readonly ok: false;
	readonly code: TCode;
	readonly message: string;
	readonly retryable?: boolean;
	readonly diagnostic?: unknown;
}

export type ProviderInvocationTransportResult<TValue, TCode extends string> =
	| ProviderInvocationTransportSuccess<TValue>
	| ProviderInvocationTransportFailure<TCode>;

export type ProviderInvocationTransport<TPayload, TValue, TCode extends string> = (
	input: ProviderInvocationTransportInput<TPayload>,
) => Promise<ProviderInvocationTransportResult<TValue, TCode>>;

export interface ProviderInvocationBoundaryRequest<TPayload> {
	readonly metadata: ProviderInvocationMetadata;
	readonly payload: TPayload;
	readonly policy: ProviderInvocationPolicy;
	readonly parentSignal?: AbortSignal;
}

export interface ProviderInvocationBoundarySuccess<TValue> {
	readonly ok: true;
	readonly value: TValue;
	readonly attempts: readonly ProviderInvocationAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface ProviderInvocationBoundaryFailure<TCode extends string> {
	readonly ok: false;
	readonly code: TCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly attempts: readonly ProviderInvocationAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export type ProviderInvocationBoundaryResult<TValue, TCode extends string> =
	| ProviderInvocationBoundarySuccess<TValue>
	| ProviderInvocationBoundaryFailure<TCode>;

export const PROVIDER_EMBEDDING_FAILURE_CODES = [
	"embedding.provider-denied",
	"embedding.provider-unavailable",
	"embedding.provider-timeout",
	"embedding.provider-canceled",
	"embedding.provider-failed",
	"embedding.duplicate-action",
	"embedding.invalid-response",
] as const;

export type ProviderEmbeddingFailureCode = (typeof PROVIDER_EMBEDDING_FAILURE_CODES)[number];

export interface ProviderEmbeddingTextChunk {
	readonly id: string;
	readonly text: string;
	readonly path?: NormalizedVaultPath;
	readonly heading?: string | null;
	readonly chunkId?: string;
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly contentFingerprint?: string;
}

export interface ProviderEmbeddingRequest {
	readonly commandId: AgentCommandId | string;
	readonly providerId: ProviderId;
	readonly modelId: ProviderModelId;
	readonly contentSensitivity: ContentSensitivity;
	readonly chunks: readonly ProviderEmbeddingTextChunk[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly timeoutMs: number;
	readonly embeddingModelFamily?: string;
	readonly expectedDimensions?: number;
	readonly invocationKey?: ProviderInvocationDuplicateKey;
	readonly recovery?: ProviderInvocationRecoveryMetadata;
	readonly signal?: AbortSignal;
}

export interface ProviderEmbeddingVector {
	readonly chunkId: string;
	readonly vector: readonly number[];
	readonly dimensions: number;
}

export interface ProviderEmbeddingResponse {
	readonly vectors: readonly ProviderEmbeddingVector[];
	readonly embeddingModelFamily?: string;
	readonly dimensions?: number;
	readonly diagnostic?: RedactedDiagnosticObject;
}

export interface ProviderEmbeddingTransportInput {
	readonly request: ProviderEmbeddingRequest;
	readonly attempt: number;
	readonly signal: AbortSignal;
}

export interface ProviderEmbeddingTransportSuccess {
	readonly ok: true;
	readonly response: ProviderEmbeddingResponse;
	readonly diagnostic?: unknown;
}

export interface ProviderEmbeddingTransportFailure {
	readonly ok: false;
	readonly code: ProviderEmbeddingFailureCode;
	readonly message: string;
	readonly retryable?: boolean;
	readonly diagnostic?: unknown;
}

export type ProviderEmbeddingTransportResult = ProviderEmbeddingTransportSuccess | ProviderEmbeddingTransportFailure;

export type ProviderEmbeddingTransport = (
	input: ProviderEmbeddingTransportInput,
) => Promise<ProviderEmbeddingTransportResult>;

export interface ProviderEmbeddingInvocationSuccess {
	readonly ok: true;
	readonly response: ProviderEmbeddingResponse;
	readonly attempts: readonly ProviderInvocationAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export interface ProviderEmbeddingInvocationFailure {
	readonly ok: false;
	readonly code: ProviderEmbeddingFailureCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly attempts: readonly ProviderInvocationAttempt[];
	readonly diagnostic: RedactedDiagnosticObject;
}

export type ProviderEmbeddingInvocationResult = ProviderEmbeddingInvocationSuccess | ProviderEmbeddingInvocationFailure;

export type ProviderEmbeddingInvoker = (
	request: ProviderEmbeddingRequest,
) => Promise<ProviderEmbeddingInvocationResult>;
