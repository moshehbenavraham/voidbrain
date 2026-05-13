import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureLastError, createVoidbrainLogger } from "../src/utils/logger";

describe("logger", () => {
	let tempRoot: string | null = null;

	afterEach(() => {
		if (tempRoot !== null) {
			rmSync(tempRoot, { force: true, recursive: true });
			tempRoot = null;
		}
	});

	it("captures a structured last error record", () => {
		tempRoot = mkdtempSync(join(tmpdir(), "voidbrain-logger-"));

		const outputPath = captureLastError(new Error("Logger failed"), {
			context: {
				notePath: "notes/demo.md",
				providerToken: "secret-value",
				nested: {
					password: "hidden-value",
					safe: "visible-value",
				},
			},
			fallbackMessage: "Fallback message.",
			logger: createVoidbrainLogger("test.logger"),
			repoRoot: tempRoot,
		});

		const record = JSON.parse(readFileSync(outputPath, "utf8")) as {
			timestamp: string;
			level: string;
			msg: string;
			error: { type: string; message: string; stack?: string };
			context: Record<string, unknown>;
		};

		expect(record.level).toBe("error");
		expect(record.msg).toBe("Logger failed");
		expect(record.error.type).toBe("Error");
		expect(record.error.message).toBe("Logger failed");
		expect(record.timestamp).toContain("T");
		expect(record.context.providerToken).toBe("[redacted]");
		expect((record.context.nested as Record<string, unknown>).password).toBe("[redacted]");
		expect((record.context.nested as Record<string, unknown>).safe).toBe("visible-value");
	});
});
