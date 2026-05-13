import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pino, { type Logger } from "pino";

export interface LastErrorRecord {
	timestamp: string;
	level: "error";
	msg: string;
	error: {
		type: string;
		message: string;
		stack?: string;
	};
	context: Record<string, unknown>;
}

export interface CaptureLastErrorOptions {
	repoRoot?: string;
	context?: Record<string, unknown>;
	fallbackMessage?: string;
	logger?: Logger;
}

const REDACTED_VALUE = "[redacted]";
const SECRET_KEY_PATTERN = /(authorization|credential|passwd|password|secret|token|api[-_]?key)/i;

export const createVoidbrainLogger = (name: string): Logger =>
	pino({
		base: {
			service: "voidbrain",
		},
		level: "info",
		name,
	});

export const captureLastError = (error: unknown, options: CaptureLastErrorOptions = {}): string => {
	const repoRoot = options.repoRoot ?? process.cwd();
	const timestamp = new Date().toISOString();
	const record = createLastErrorRecord(error, {
		context: options.context ?? {},
		fallbackMessage: options.fallbackMessage ?? "Unexpected error.",
		timestamp,
	});
	const logsDir = join(repoRoot, "logs");
	mkdirSync(logsDir, { recursive: true });
	const outputPath = join(logsDir, `last_error_${timestamp.replace(/:/g, "-")}.json`);
	writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
	options.logger?.error(record, record.msg);
	return outputPath;
};

const createLastErrorRecord = (
	error: unknown,
	options: {
		context: Record<string, unknown>;
		fallbackMessage: string;
		timestamp: string;
	},
): LastErrorRecord => {
	const normalizedError = normalizeError(error, options.fallbackMessage);

	return {
		timestamp: options.timestamp,
		level: "error",
		msg: normalizedError.message,
		error: normalizedError,
		context: sanitizeStructuredValue(options.context) as Record<string, unknown>,
	};
};

const normalizeError = (error: unknown, fallbackMessage: string): LastErrorRecord["error"] => {
	if (error instanceof Error) {
		const record: LastErrorRecord["error"] = {
			type: error.name,
			message: error.message.trim().length > 0 ? error.message : fallbackMessage,
		};

		if (error.stack !== undefined) {
			record.stack = error.stack;
		}

		return record;
	}

	if (typeof error === "string") {
		return {
			type: "Error",
			message: error.trim().length > 0 ? error : fallbackMessage,
		};
	}

	return {
		type: "Error",
		message: fallbackMessage,
	};
};

const sanitizeStructuredValue = (value: unknown, depth = 0): unknown => {
	if (depth > 4) {
		return "[depth-limit]";
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeStructuredValue(item, depth + 1));
	}

	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
				key,
				SECRET_KEY_PATTERN.test(key) ? REDACTED_VALUE : sanitizeStructuredValue(entry, depth + 1),
			]),
		);
	}

	return value;
};
