import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { VaultHealthRuntimeService } from "../src/agent";
import { createVaultHealthStore } from "../src/stores/vault-health-store";
import type { VaultHealthReport } from "../src/types/health";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../src/types/vault";
import { VaultHealthModal } from "../src/views/vault-health-modal";
import { App as MockApp } from "./__mocks__/obsidian";
import {
	VAULT_HEALTH_RUNTIME_ALIASES,
	VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
	loadVaultHealthRuntimeFixtureNotes,
} from "./fixtures/vault/vault-health-runtime-fixtures";

const fixedDate = new Date("2026-05-13T00:00:00.000Z");

const flushPromises = async (count = 8): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const waitForCondition = async (predicate: () => boolean, count = 1000): Promise<void> => {
	for (let index = 0; index < count; index += 1) {
		if (predicate()) {
			return;
		}
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(0);
	}
};

const createReport = (): VaultHealthReport => {
	const result = new VaultHealthRuntimeService({ now: () => fixedDate }).scanMarkdownNotes({
		notes: loadVaultHealthRuntimeFixtureNotes(),
		knownPaths: VAULT_HEALTH_RUNTIME_KNOWN_PATHS,
		pathAliases: VAULT_HEALTH_RUNTIME_ALIASES,
		reportId: "modal-health-report",
	});
	if (!result.ok) {
		throw new Error(result.message);
	}

	return result.report;
};

describe("VaultHealthModal", () => {
	it("renders grouped reports, exports, stages repairs, and resets on close", async () => {
		const report = createReport();
		const store = createVaultHealthStore({ now: () => fixedDate });
		const service = new VaultHealthRuntimeService({ now: () => fixedDate });
		const modal = new VaultHealthModal(new MockApp() as unknown as App, {
			store,
			runScan: vi.fn(async () => ({
				ok: true as const,
				report,
				recovery: {
					commandId: "voidbrain.health-check",
					reportId: report.reportId,
					validationOutput: [],
				},
			})),
			exportReport: vi.fn(async () => ({
				ok: true as const,
				export: {
					reportId: report.reportId,
					exportedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
					exportPath: makeNormalizedVaultPath(".voidbrain/reports/modal-health-report.md"),
					byteLength: 128,
				},
				recovery: {
					commandId: "voidbrain.health-check",
					reportId: report.reportId,
					exportPath: makeNormalizedVaultPath(".voidbrain/reports/modal-health-report.md"),
					validationOutput: [],
				},
			})),
			stageRepair: (findingId) =>
				service.stageSafeRepair({
					report,
					findingId,
					existingNotes: loadVaultHealthRuntimeFixtureNotes(),
					existingStagedChanges: [],
				}),
			isOnline: () => true,
		});

		modal.open();
		await flushPromises();

		expect(document.body.textContent).toContain("Report modal-health-report");
		expect(document.body.querySelectorAll("[data-health-group-id]").length).toBeGreaterThan(0);
		expect(document.body.textContent).toContain("missing-citation");

		document.body.querySelector<HTMLButtonElement>("[data-health-action='export']")?.click();
		await flushPromises();
		expect(document.body.textContent).toContain(".voidbrain/reports/modal-health-report.md");

		[...document.body.querySelectorAll<HTMLButtonElement>("[data-health-group-id]")]
			.find((button) => button.textContent?.includes("missing-citation"))
			?.click();
		await flushPromises();
		document.body.querySelector<HTMLButtonElement>("[data-health-stage-finding]")?.click();
		await waitForCondition(() => document.body.textContent?.includes("Staged repair:") === true);
		expect(document.body.textContent).toContain("Staged repair:");

		modal.close();
		expect(store.getState().status).toBe("idle");
		expect(document.body.textContent).not.toContain("modal-health-report");
	});

	it("renders failed and offline states without mutating vault files", async () => {
		const failedStore = createVaultHealthStore({ now: () => fixedDate });
		const failedModal = new VaultHealthModal(new MockApp() as unknown as App, {
			store: failedStore,
			runScan: vi.fn(async () => ({
				ok: false as const,
				message: "Synthetic scan failure.",
				issues: [],
				recovery: {
					commandId: "voidbrain.health-check",
					validationOutput: [],
				},
			})),
			exportReport: vi.fn(),
			stageRepair: vi.fn(),
			isOnline: () => true,
		});
		failedModal.open();
		await flushPromises();
		expect(document.body.textContent).toContain("Synthetic scan failure.");
		failedModal.close();

		const offlineRunScan = vi.fn();
		const offlineModal = new VaultHealthModal(new MockApp() as unknown as App, {
			store: createVaultHealthStore({ now: () => fixedDate }),
			runScan: offlineRunScan,
			exportReport: vi.fn(),
			stageRepair: vi.fn(),
			isOnline: () => false,
		});
		offlineModal.open();
		await flushPromises();
		expect(document.body.textContent).toContain("Health runtime is offline.");
		expect(offlineRunScan).not.toHaveBeenCalled();
	});
});
