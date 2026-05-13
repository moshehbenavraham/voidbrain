import type {
	LocalRuntimeCapabilityReadinessSummary,
	LocalRuntimeFamily,
	LocalRuntimeModelMetadata,
	LocalRuntimeReadinessCode,
	LocalRuntimeReadinessDenialCode,
	LocalRuntimeReadinessProbe,
	LocalRuntimeReadinessProbeInput,
	LocalRuntimeReadinessProbeResult,
	LocalRuntimeReadinessRecord,
	LocalRuntimeReadinessStatus,
	ProviderAuthTestRecord,
	UserProviderModelProfile,
	UserProviderProfile,
} from "../types/provider-setup";
import {
	type ModelCapability,
	type ModelRole,
	type ProviderModelId,
	type RedactedDiagnosticObject,
	assertNeverProviderValue,
	isModelCapability,
	isModelRole,
	makeProviderModelId,
} from "../types/providers";
import { redactDiagnostic } from "./redaction";

export interface LocalRuntimeReadinessRunnerOptions {
	readonly probe?: LocalRuntimeReadinessProbe;
	readonly timeoutMs?: number;
	readonly now?: () => Date;
	readonly clock?: () => number;
	readonly fetch?: typeof globalThis.fetch;
}

interface TimedLocalProbeResult {
	readonly timedOut: boolean;
	readonly aborted: boolean;
	readonly result?: LocalRuntimeReadinessProbeResult;
	readonly error?: unknown;
	readonly durationMs: number;
}

interface ParsedModelsSuccess {
	readonly ok: true;
	readonly models: readonly LocalRuntimeModelMetadata[];
}

interface ParsedModelsFailure {
	readonly ok: false;
	readonly code: LocalRuntimeReadinessDenialCode;
	readonly diagnostic: RedactedDiagnosticObject;
}

type ParsedModelsResult = ParsedModelsSuccess | ParsedModelsFailure;

type UnknownRecord = Record<string, unknown>;

const defaultTimeoutMs = 5000;
const readinessRoles: readonly Exclude<ModelRole, "utility">[] = ["chat", "embedding"];

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isParsedModelsFailure = (value: LocalRuntimeModelMetadata | ParsedModelsFailure): value is ParsedModelsFailure =>
	"ok" in value && value.ok === false;

const compareStrings = (left: string, right: string): number =>
	left.localeCompare(right, "en", { sensitivity: "base" });

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

const requiredCapabilityForRole = (role: Exclude<ModelRole, "utility">): ModelCapability => {
	switch (role) {
		case "chat":
			return "chat";
		case "embedding":
			return "embeddings";
		default:
			return assertNeverProviderValue(role);
	}
};

const readinessStatusForCode = (code: LocalRuntimeReadinessCode): LocalRuntimeReadinessStatus => {
	switch (code) {
		case "ready":
			return "ready";
		case "not-checked":
			return "untested";
		case "missing-chat-capability":
		case "missing-embedding-capability":
			return "warning";
		case "offline":
		case "timeout":
		case "aborted":
		case "probe-failed":
		case "malformed-model-metadata":
		case "duplicate-model-id":
		case "capability-mismatch":
		case "invalid-profile":
			return "not-ready";
		default:
			return assertNeverProviderValue(code);
	}
};

const statusForAuthRecord = (code: LocalRuntimeReadinessCode): ProviderAuthTestRecord["status"] => {
	switch (code) {
		case "ready":
			return "passed";
		case "timeout":
			return "timeout";
		case "not-checked":
			return "untested";
		case "offline":
		case "aborted":
		case "probe-failed":
		case "malformed-model-metadata":
		case "duplicate-model-id":
		case "missing-chat-capability":
		case "missing-embedding-capability":
		case "capability-mismatch":
		case "invalid-profile":
			return "failed";
		default:
			return assertNeverProviderValue(code);
	}
};

const readString = (source: UnknownRecord, fields: readonly string[]): string | null => {
	for (const field of fields) {
		const value = source[field];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}

	return null;
};

const readStringArray = (
	source: UnknownRecord,
	field: string,
	guard: (value: unknown) => boolean,
): readonly string[] | null => {
	const value = source[field];

	if (value === undefined) {
		return null;
	}

	if (!Array.isArray(value) || value.length === 0) {
		return [];
	}

	const values: string[] = [];
	const seenValues = new Set<string>();
	for (const item of value) {
		if (!guard(item)) {
			return [];
		}

		const stringValue = item as string;
		if (!seenValues.has(stringValue)) {
			seenValues.add(stringValue);
			values.push(stringValue);
		}
	}

	return values;
};

const modelSupportsRole = (model: LocalRuntimeModelMetadata, role: Exclude<ModelRole, "utility">): boolean =>
	model.roles.includes(role) && model.capabilities.includes(requiredCapabilityForRole(role));

const findDeclaredModel = (
	profile: UserProviderProfile,
	modelId: ProviderModelId,
): UserProviderModelProfile | undefined => profile.models.find((model) => model.id === modelId);

const normalizeRawModel = (
	rawModel: unknown,
	index: number,
	profile: UserProviderProfile,
): LocalRuntimeModelMetadata | ParsedModelsFailure => {
	const rawId =
		typeof rawModel === "string" && rawModel.trim().length > 0
			? rawModel.trim()
			: isRecord(rawModel)
				? readString(rawModel, ["id", "name", "model"])
				: null;

	if (rawId === null) {
		return {
			ok: false,
			code: "malformed-model-metadata",
			diagnostic: toDiagnosticObject({
				reason: "model-id-missing",
				index,
			}),
		};
	}

	const modelId = makeProviderModelId(rawId);
	const declaredModel = findDeclaredModel(profile, modelId);
	const record = isRecord(rawModel) ? rawModel : {};
	const displayName = readString(record, ["displayName", "name", "label"]) ?? declaredModel?.displayName ?? rawId;
	const rawRoles = readStringArray(record, "roles", isModelRole);
	const rawCapabilities = readStringArray(record, "capabilities", isModelCapability);
	const roles = rawRoles === null ? (declaredModel?.roles ?? []) : (rawRoles as readonly ModelRole[]);
	const capabilities =
		rawCapabilities === null
			? (declaredModel?.capabilities ?? [])
			: (rawCapabilities as readonly ModelCapability[]);
	const embeddingFamily =
		readString(record, ["embeddingFamily", "embedding_family"]) ?? declaredModel?.embeddingFamily;

	if (roles.length === 0 || capabilities.length === 0) {
		return {
			ok: false,
			code: "malformed-model-metadata",
			diagnostic: toDiagnosticObject({
				providerId: profile.id,
				modelId,
				reason: "model-roles-or-capabilities-missing",
			}),
		};
	}

	const hasMismatchedRole = roles.some(
		(role) => role !== "utility" && !capabilities.includes(requiredCapabilityForRole(role)),
	);
	if (hasMismatchedRole) {
		return {
			ok: false,
			code: "capability-mismatch",
			diagnostic: toDiagnosticObject({
				providerId: profile.id,
				modelId,
				reason: "model-role-capability-mismatch",
				roles,
				capabilities,
			}),
		};
	}

	return {
		id: modelId,
		displayName,
		roles,
		capabilities,
		...(embeddingFamily === undefined ? {} : { embeddingFamily }),
	};
};

const parseProbeModels = (profile: UserProviderProfile, rawModels: readonly unknown[]): ParsedModelsResult => {
	if (!Array.isArray(rawModels) || rawModels.length === 0) {
		return {
			ok: false,
			code: "malformed-model-metadata",
			diagnostic: toDiagnosticObject({
				providerId: profile.id,
				reason: "model-list-empty-or-missing",
			}),
		};
	}

	const parsedModels: LocalRuntimeModelMetadata[] = [];
	const seenModelIds = new Set<ProviderModelId>();
	for (const [index, rawModel] of rawModels.entries()) {
		const model = normalizeRawModel(rawModel, index, profile);
		if (isParsedModelsFailure(model)) {
			return model;
		}

		if (seenModelIds.has(model.id)) {
			return {
				ok: false,
				code: "duplicate-model-id",
				diagnostic: toDiagnosticObject({
					providerId: profile.id,
					modelId: model.id,
					reason: "duplicate-model-id",
				}),
			};
		}

		seenModelIds.add(model.id);
		parsedModels.push(model);
	}

	return {
		ok: true,
		models: parsedModels.sort((left, right) => compareStrings(left.id, right.id)),
	};
};

const createRecord = (
	profile: UserProviderProfile,
	code: LocalRuntimeReadinessCode,
	checkedAt: Date,
	durationMs: number,
	models: readonly LocalRuntimeModelMetadata[],
	diagnostic: unknown,
): LocalRuntimeReadinessRecord => {
	const chatModelIds = models.filter((model) => modelSupportsRole(model, "chat")).map((model) => model.id);
	const embeddingModelIds = models.filter((model) => modelSupportsRole(model, "embedding")).map((model) => model.id);
	const modelIds = models.map((model) => model.id);

	return {
		providerId: profile.id,
		status: readinessStatusForCode(code),
		code,
		checkedAt: checkedAt.toISOString(),
		durationMs: Math.max(0, Math.round(durationMs)),
		modelCount: modelIds.length,
		chatModelCount: chatModelIds.length,
		embeddingModelCount: embeddingModelIds.length,
		modelIds,
		chatModelIds,
		embeddingModelIds,
		diagnostic: toDiagnosticObject(diagnostic),
	};
};

const codeForParsedModels = (models: readonly LocalRuntimeModelMetadata[]): LocalRuntimeReadinessCode => {
	if (!models.some((model) => modelSupportsRole(model, "chat"))) {
		return "missing-chat-capability";
	}

	if (!models.some((model) => modelSupportsRole(model, "embedding"))) {
		return "missing-embedding-capability";
	}

	return "ready";
};

const extractModelEntries = (body: unknown): readonly unknown[] => {
	if (Array.isArray(body)) {
		return body;
	}

	if (!isRecord(body)) {
		return [];
	}

	if (Array.isArray(body.data)) {
		return body.data;
	}

	if (Array.isArray(body.models)) {
		return body.models;
	}

	return [];
};

const buildModelsUrl = (baseUrl: string, runtimeFamily: LocalRuntimeFamily): string => {
	const url = new URL(baseUrl);

	if (runtimeFamily === "ollama") {
		url.pathname = "/api/tags";
		url.search = "";
		url.hash = "";
		return url.toString();
	}

	if (!url.pathname.endsWith("/")) {
		url.pathname = `${url.pathname}/`;
	}

	return new URL("models", url).toString();
};

const createDefaultProbe =
	(fetchImpl: typeof globalThis.fetch | undefined): LocalRuntimeReadinessProbe =>
	async ({ profile, signal }: LocalRuntimeReadinessProbeInput): Promise<LocalRuntimeReadinessProbeResult> => {
		if (profile.endpoint.baseUrl === null) {
			return {
				ok: false,
				code: "invalid-profile",
				diagnostic: {
					providerId: profile.id,
					reason: "missing-local-endpoint",
				},
			};
		}

		if (fetchImpl === undefined) {
			return {
				ok: false,
				code: "probe-failed",
				diagnostic: {
					providerId: profile.id,
					reason: "fetch-unavailable",
				},
			};
		}

		const modelsUrl = buildModelsUrl(
			profile.endpoint.baseUrl,
			profile.localRuntime?.runtimeFamily ?? "generic-openai-compatible",
		);

		try {
			const response = await fetchImpl(modelsUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
				signal,
			});

			const diagnostic = {
				providerId: profile.id,
				endpointHost: profile.endpoint.hostname ?? null,
				statusCode: response.status,
			};

			if (!response.ok) {
				return {
					ok: false,
					code: "offline",
					statusCode: response.status,
					diagnostic,
				};
			}

			const body = await response.json();
			return {
				ok: true,
				statusCode: response.status,
				models: extractModelEntries(body),
				diagnostic,
			};
		} catch (error) {
			if (signal.aborted) {
				return {
					ok: false,
					code: "aborted",
					diagnostic: {
						providerId: profile.id,
						reason: "aborted",
					},
				};
			}

			return {
				ok: false,
				code: "offline",
				diagnostic: {
					providerId: profile.id,
					endpointHost: profile.endpoint.hostname ?? null,
					error,
				},
			};
		}
	};

const runProbeWithTimeout = async (
	probe: LocalRuntimeReadinessProbe,
	input: LocalRuntimeReadinessProbeInput,
	timeoutMs: number,
	clock: () => number,
): Promise<TimedLocalProbeResult> => {
	const startedAt = clock();
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
		const durationMs = Math.max(0, clock() - startedAt);

		if (result === "timeout") {
			return {
				timedOut: true,
				aborted: true,
				durationMs,
			};
		}

		return {
			timedOut: false,
			aborted: controller.signal.aborted,
			result,
			durationMs,
		};
	} catch (error) {
		return {
			timedOut: false,
			aborted: controller.signal.aborted,
			error,
			durationMs: Math.max(0, clock() - startedAt),
		};
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		controller.abort();
	}
};

export const runLocalRuntimeReadinessProbe = async (
	profile: UserProviderProfile,
	options: LocalRuntimeReadinessRunnerOptions = {},
): Promise<LocalRuntimeReadinessRecord> => {
	const now = options.now ?? (() => new Date());
	const clock = options.clock ?? (() => Date.now());
	const checkedAt = now();
	const timeoutMs = Math.max(1, options.timeoutMs ?? defaultTimeoutMs);
	const probe = options.probe ?? createDefaultProbe(options.fetch ?? globalThis.fetch);

	if (profile.providerKind !== "local" || profile.profileKind !== "local") {
		return createRecord(profile, "invalid-profile", checkedAt, 0, [], {
			providerId: profile.id,
			reason: "profile-is-not-local-runtime",
		});
	}

	const probeResult = await runProbeWithTimeout(
		probe,
		{
			profile,
			signal: new AbortController().signal,
		},
		timeoutMs,
		clock,
	);

	if (probeResult.timedOut) {
		return createRecord(profile, "timeout", checkedAt, probeResult.durationMs, [], {
			providerId: profile.id,
			reason: "timeout",
			timeoutMs,
		});
	}

	if (probeResult.error !== undefined) {
		return createRecord(
			profile,
			probeResult.aborted ? "aborted" : "probe-failed",
			checkedAt,
			probeResult.durationMs,
			[],
			{
				providerId: profile.id,
				reason: probeResult.aborted ? "aborted" : "probe-error",
				error: probeResult.error,
			},
		);
	}

	if (probeResult.result === undefined) {
		return createRecord(profile, "probe-failed", checkedAt, probeResult.durationMs, [], {
			providerId: profile.id,
			reason: "probe-returned-no-result",
		});
	}

	if (!probeResult.result.ok) {
		return createRecord(
			profile,
			probeResult.result.code ?? "probe-failed",
			checkedAt,
			probeResult.durationMs,
			[],
			probeResult.result.diagnostic ?? {
				providerId: profile.id,
				reason: "probe-failed",
				statusCode: probeResult.result.statusCode ?? null,
			},
		);
	}

	const parsedModels = parseProbeModels(profile, probeResult.result.models);
	if (!parsedModels.ok) {
		return createRecord(profile, parsedModels.code, checkedAt, probeResult.durationMs, [], parsedModels.diagnostic);
	}

	const code = codeForParsedModels(parsedModels.models);
	return createRecord(
		profile,
		code,
		checkedAt,
		probeResult.durationMs,
		parsedModels.models,
		probeResult.result.diagnostic ?? {
			providerId: profile.id,
			modelCount: parsedModels.models.length,
		},
	);
};

export const summarizeLocalRuntimeReadiness = (
	record: LocalRuntimeReadinessRecord,
): readonly LocalRuntimeCapabilityReadinessSummary[] =>
	readinessRoles.map((role) => {
		const requiredCapability = requiredCapabilityForRole(role);
		const modelIds = role === "chat" ? record.chatModelIds : record.embeddingModelIds;
		const isReady = record.code === "ready" && modelIds.length > 0;

		return {
			role,
			requiredCapability,
			status: isReady ? "ready" : record.status,
			code: isReady ? "ready" : role === "chat" ? "missing-chat-capability" : "missing-embedding-capability",
			modelCount: modelIds.length,
			modelIds,
			message: isReady ? `${role} local runtime model is ready.` : `${role} local runtime model is not ready.`,
		};
	});

export const isLocalRuntimeReadinessReady = (record: LocalRuntimeReadinessRecord | undefined): boolean =>
	record?.status === "ready" && record.code === "ready";

export const isLocalRuntimeReadinessReadyForRole = (
	record: LocalRuntimeReadinessRecord | undefined,
	role: ModelRole,
	modelId?: ProviderModelId | null,
): boolean => {
	if (record === undefined || !isLocalRuntimeReadinessReady(record)) {
		return false;
	}

	switch (role) {
		case "chat":
			return modelId === undefined || modelId === null
				? record.chatModelIds.length > 0
				: record.chatModelIds.includes(modelId);
		case "embedding":
			return modelId === undefined || modelId === null
				? record.embeddingModelIds.length > 0
				: record.embeddingModelIds.includes(modelId);
		case "utility":
			return true;
		default:
			return assertNeverProviderValue(role);
	}
};

export const localRuntimeReadinessToAuthRecord = (
	profile: UserProviderProfile,
	readiness: LocalRuntimeReadinessRecord,
): ProviderAuthTestRecord => ({
	providerId: profile.id,
	status: statusForAuthRecord(readiness.code),
	checkedAt: readiness.checkedAt,
	statusCode: null,
	modelCount: readiness.modelCount,
	durationMs: readiness.durationMs,
	diagnostic: toDiagnosticObject({
		providerId: profile.id,
		readinessCode: readiness.code,
		readinessStatus: readiness.status,
		modelCount: readiness.modelCount,
		chatModelCount: readiness.chatModelCount,
		embeddingModelCount: readiness.embeddingModelCount,
	}),
	localRuntimeReadiness: readiness,
});
