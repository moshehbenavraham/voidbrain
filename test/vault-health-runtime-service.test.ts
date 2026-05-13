import { describe, expect, it, vi } from "vitest";
import { VaultHealthRuntimeService } from "../src/agent";
import type { VaultHealthFinding } from "../src/types/health";
import {
	HEALTH_SUMMARY_PATH,
	VAULT_HEALTH_RUNTIME_ALIASES,
	VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
	loadVaultHealthRuntimeFixtureNotes,
} from "./fixtures/vault/vault-health-runtime-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");

const createService = (): VaultHealthRuntimeService =>
	new VaultHealthRuntimeService({
		now: () => fixedDate,
	});

const scanRuntimeFixtures = () => {
	const result = createService().scanMarkdownNotes({
		notes: loadVaultHealthRuntimeFixtureNotes(),
		knownPaths: VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
		pathAliases: VAULT_HEALTH_RUNTIME_ALIASES,
		reportId: "runtime-health-report",
	});
	if (!result.ok) {
		throw new Error(JSON.stringify(result.issues));
	}

	return result.report;
};

const findingByKind = (kind: VaultHealthFinding["kind"]): VaultHealthFinding => {
	const finding = scanRuntimeFixtures().findings.find((candidate) => candidate.kind === kind);
	if (finding === undefined) {
		throw new Error(`Expected finding kind ${kind}`);
	}

	return finding;
};

describe("VaultHealthRuntimeService", () => {
	it("scans markdown notes into grouped health reports", () => {
		const result = createService().scanMarkdownNotes({
			notes: loadVaultHealthRuntimeFixtureNotes(),
			knownPaths: VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
			pathAliases: VAULT_HEALTH_RUNTIME_ALIASES,
			reportId: "runtime-health-report",
		});

		expect(result).toMatchObject({ ok: true });
		if (!result.ok) {
			throw new Error(result.message);
		}

		expect(result.report.summary.findingCounts).toMatchObject({
			"broken-wikilink": 1,
			"content-gap": 1,
			"missing-citation": 1,
			"orphan-note": 1,
		});
		expect(result.recovery).toMatchObject({
			commandId: "voidbrain.health-check",
			reportId: "runtime-health-report",
		});
	});

	it("exports redacted markdown and fails closed on write errors", async () => {
		const report = scanRuntimeFixtures();
		const written = new Map<string, string>();
		const service = createService();
		const success = await service.exportMarkdownReport({
			report,
			adapter: {
				exists: vi.fn(async () => false),
				write: vi.fn(async (path, content) => {
					written.set(path, content);
				}),
			},
		});

		expect(success).toMatchObject({
			ok: true,
			export: { exportPath: ".voidbrain/reports/runtime-health-report.md" },
		});
		expect(written.get(".voidbrain/reports/runtime-health-report.md")).toContain("runtime-health-report");
		expect(written.get(".voidbrain/reports/runtime-health-report.md")).not.toContain(
			"This synthetic summary intentionally omits citation records",
		);

		const failure = await service.exportMarkdownReport({
			report,
			adapter: {
				exists: vi.fn(async () => false),
				write: vi.fn(async () => {
					throw new Error("Synthetic export failure.");
				}),
			},
		});
		expect(failure).toMatchObject({
			ok: false,
			recovery: {
				commandId: "voidbrain.health-check",
				reportId: "runtime-health-report",
				exportPath: ".voidbrain/reports/runtime-health-report.md",
			},
		});
	});

	it("stages deterministic missing-citation repairs and blocks duplicate active repairs", async () => {
		const report = scanRuntimeFixtures();
		const finding = findingByKind("missing-citation");
		const service = createService();
		const staged = await service.stageSafeRepair({
			report,
			findingId: finding.id,
			existingNotes: loadVaultHealthRuntimeFixtureNotes(),
			existingStagedChanges: [],
		});

		expect(staged).toMatchObject({
			ok: true,
			findingId: finding.id,
			targetPath: HEALTH_SUMMARY_PATH,
			recovery: {
				commandId: "voidbrain.health-check",
				reportId: "runtime-health-report",
			},
		});
		if (!staged.ok) {
			throw new Error(staged.message);
		}
		expect(staged.stagedChange.operationKind).toBe("update-frontmatter");
		expect(staged.stagedChange.diff.afterContent).toContain("citations: [vault:sources/health-source.md]");

		const duplicate = await service.stageSafeRepair({
			report,
			findingId: finding.id,
			existingNotes: loadVaultHealthRuntimeFixtureNotes(),
			existingStagedChanges: [staged.stagedChange],
		});
		expect(duplicate).toMatchObject({
			ok: false,
			message: "Vault health repair staging failed validation.",
		});
	});

	it("keeps report-only findings from creating staged changes", async () => {
		const report = scanRuntimeFixtures();
		const finding = findingByKind("content-gap");
		const result = await createService().stageSafeRepair({
			report,
			findingId: finding.id,
			existingNotes: loadVaultHealthRuntimeFixtureNotes(),
			existingStagedChanges: [],
		});

		expect(result).toMatchObject({
			ok: false,
			findingId: finding.id,
			safety: { kind: "report-only" },
		});
	});
});
