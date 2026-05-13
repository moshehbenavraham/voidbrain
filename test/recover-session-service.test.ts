import { describe, expect, it } from "vitest";
import { RecoverSessionService } from "../src/agent";
import { HOT_CACHE_SUPPORT_PATH } from "../src/utils/vault-paths";
import {
	createRecoveryCompleteInput,
	createRecoveryMalformedRecords,
	createRecoveryMissingInput,
	createRecoveryRecordWithBodyFields,
	createRecoverySecretLikeRecord,
	createRecoveryStaleInput,
} from "./fixtures/vault/recovery-fixtures";

const diagnosticCodes = (summary: ReturnType<RecoverSessionService["buildSummary"]>): readonly string[] =>
	summary.diagnostics.map((diagnostic) => diagnostic.code);

describe("RecoverSessionService", () => {
	it("builds a complete bounded recovery summary from support records", () => {
		const summary = new RecoverSessionService().buildSummary(createRecoveryCompleteInput());

		expect(summary).toMatchObject({
			commandId: "voidbrain.recover-session",
			status: "ready",
		});
		expect(summary.diagnostics.every((diagnostic) => diagnostic.severity === "info")).toBe(true);
		expect(summary.sourceRecordPaths).toContain(HOT_CACHE_SUPPORT_PATH);
		expect(summary.items.map((item) => item.commandId)).toEqual(
			expect.arrayContaining([
				"voidbrain.chat-with-vault",
				"voidbrain.health-check",
				"voidbrain.hot-cache",
				"voidbrain.ingest-source",
				"voidbrain.save-session-summary",
				"voidbrain.stage-change",
			]),
		);
		expect(summary.items.flatMap((item) => item.stagedChangeIds)).toContain("stage-hot-cache-summary");
		expect(summary.actions.map((action) => action.kind)).toEqual(
			expect.arrayContaining(["inspect-report", "refresh-cache", "retry-command", "review-staged-change"]),
		);
		expect(JSON.stringify(summary)).not.toContain("Synthetic source content");
	});

	it("reports missing support records without throwing", () => {
		const summary = new RecoverSessionService().buildSummary(createRecoveryMissingInput());

		expect(summary.status).toBe("missing");
		expect(summary.items).toEqual([]);
		expect(summary.diagnostics).toEqual([
			expect.objectContaining({
				code: "recovery.missing-record",
				sourceKind: "hot-cache",
			}),
		]);
	});

	it("maps malformed and unsupported records to diagnostics", () => {
		const summary = new RecoverSessionService().buildSummary(createRecoveryMalformedRecords());

		expect(summary.status).toBe("invalid");
		expect(diagnosticCodes(summary)).toEqual(
			expect.arrayContaining(["recovery.malformed-record", "recovery.unsupported-record"]),
		);
		expect(JSON.stringify(summary)).not.toContain("not-an-array");
	});

	it("marks stale support records as partial recovery evidence", () => {
		const summary = new RecoverSessionService().buildSummary(createRecoveryStaleInput());

		expect(summary.status).toBe("partial");
		expect(summary.items.length).toBeGreaterThan(0);
		expect(diagnosticCodes(summary)).toContain("recovery.stale-record");
	});

	it("redacts sensitive diagnostics and omits raw staged-change bodies", () => {
		const summary = new RecoverSessionService().buildSummary({
			hotCache: createRecoverySecretLikeRecord(),
			stagedChanges: [createRecoveryRecordWithBodyFields()],
			now: new Date("2026-05-13T02:00:00.000Z"),
		});
		const serialized = JSON.stringify(summary);

		expect(summary.status).toBe("partial");
		expect(summary.redaction.redactedFieldCount).toBeGreaterThan(0);
		expect(summary.redaction.omittedBodyCount).toBeGreaterThanOrEqual(2);
		expect(diagnosticCodes(summary)).toEqual(
			expect.arrayContaining(["recovery.body-omitted", "recovery.malformed-record", "recovery.secret-redacted"]),
		);
		expect(serialized).not.toContain("fixture-redaction-value");
		expect(serialized).not.toContain("This raw body must not appear");
	});
});
