import type { RedactedDiagnostic, RedactionFailure, RedactionResult } from "../types/providers";

export const REDACTED_VALUE = "[REDACTED]";
export const CIRCULAR_VALUE = "[CIRCULAR]";

const SECRET_FIELD_NAMES: ReadonlySet<string> = new Set([
	"access-token",
	"apikey",
	"api-key",
	"authorization",
	"bearer",
	"client-secret",
	"credential",
	"credentials",
	"password",
	"refresh-token",
	"secret",
	"token",
]);

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
	/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
	/\bsk-[A-Za-z0-9_-]{8,}\b/g,
	/\b(api[_-]?key|password|secret|token)=([^&\s]+)/gi,
];

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const failure = (message: string, field?: string): RedactionFailure => {
	if (field === undefined) {
		return { ok: false, code: "invalid-diagnostic-input", message };
	}

	return { ok: false, code: "invalid-diagnostic-input", message, field };
};

const success = (value: RedactedDiagnostic): RedactionResult => ({ ok: true, value });

const normalizeFieldName = (field: string): string => field.replaceAll(/[\s_]/g, "-").toLowerCase();

export const isSecretLikeKey = (field: string): boolean => {
	const normalized = normalizeFieldName(field);

	return (
		SECRET_FIELD_NAMES.has(normalized) ||
		normalized.includes("secret") ||
		normalized.includes("token") ||
		normalized.includes("password")
	);
};

const redactString = (value: string): string => {
	let redactedValue = value;

	for (const pattern of SECRET_VALUE_PATTERNS) {
		redactedValue = redactedValue.replace(pattern, (match: string, key?: string) => {
			if (typeof key === "string" && key.length > 0 && match.includes("=")) {
				return `${key}=${REDACTED_VALUE}`;
			}

			if (match.toLowerCase().startsWith("bearer ")) {
				return `Bearer ${REDACTED_VALUE}`;
			}

			return REDACTED_VALUE;
		});
	}

	return redactedValue;
};

const redactError = (error: Error, seen: WeakSet<object>, field: string): RedactionResult => {
	const redactedMessage = redactValue(error.message, seen, `${field}.message`);
	if (!redactedMessage.ok) {
		return redactedMessage;
	}

	return success({
		name: redactString(error.name),
		message: redactedMessage.value,
	});
};

const redactArray = (items: readonly unknown[], seen: WeakSet<object>, field: string): RedactionResult => {
	const redactedItems: RedactedDiagnostic[] = [];

	for (const [index, item] of items.entries()) {
		const redactedItem = redactValue(item, seen, `${field}[${index}]`);
		if (!redactedItem.ok) {
			return redactedItem;
		}
		redactedItems.push(redactedItem.value);
	}

	return success(redactedItems);
};

const redactObject = (record: UnknownRecord, seen: WeakSet<object>, field: string): RedactionResult => {
	if (seen.has(record)) {
		return success(CIRCULAR_VALUE);
	}

	seen.add(record);
	const redactedRecord: Record<string, RedactedDiagnostic> = {};

	for (const [key, value] of Object.entries(record)) {
		if (isSecretLikeKey(key)) {
			redactedRecord[key] = REDACTED_VALUE;
			continue;
		}

		const childField = field.length > 0 ? `${field}.${key}` : key;
		const redactedValue = redactValue(value, seen, childField);
		if (!redactedValue.ok) {
			return redactedValue;
		}
		redactedRecord[key] = redactedValue.value;
	}

	return success(redactedRecord);
};

const redactValue = (value: unknown, seen: WeakSet<object>, field: string): RedactionResult => {
	if (value === null || typeof value === "boolean" || typeof value === "number") {
		return success(value);
	}

	if (typeof value === "string") {
		return success(redactString(value));
	}

	if (value === undefined) {
		return success(null);
	}

	if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
		return failure("Diagnostic input must be JSON-compatible, an Error, or nested arrays/objects.", field);
	}

	if (value instanceof Error) {
		return redactError(value, seen, field);
	}

	if (Array.isArray(value)) {
		return redactArray(value, seen, field);
	}

	if (isRecord(value)) {
		return redactObject(value, seen, field);
	}

	return failure("Diagnostic input contains an unsupported value.", field);
};

export const redactDiagnostic = (input: unknown): RedactionResult => redactValue(input, new WeakSet<object>(), "root");
