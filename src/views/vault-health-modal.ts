import { type App, Modal, Notice } from "obsidian";
import type { VaultHealthStore } from "../stores/vault-health-store";
import type {
	VaultHealthEvidence,
	VaultHealthExportResult,
	VaultHealthFinding,
	VaultHealthFindingGroup,
	VaultHealthRepairStageResult,
	VaultHealthReport,
	VaultHealthRuntimeScanResult,
	VaultHealthStoreState,
	VaultHealthStoreUnsubscribe,
} from "../types/health";

export interface VaultHealthModalOptions {
	readonly store: VaultHealthStore;
	readonly runScan: () => Promise<VaultHealthRuntimeScanResult>;
	readonly exportReport: (report: VaultHealthReport) => Promise<VaultHealthExportResult>;
	readonly stageRepair: (findingId: string, report: VaultHealthReport) => Promise<VaultHealthRepairStageResult>;
	readonly isOnline?: () => boolean;
	readonly onNotice?: (message: string) => void;
}

export class VaultHealthModal extends Modal {
	private unsubscribe: VaultHealthStoreUnsubscribe | null = null;
	private isClosed = true;
	private isBusy = false;

	public constructor(
		app: App,
		private readonly options: VaultHealthModalOptions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.isClosed = false;
		this.options.store.reset();
		this.unsubscribe = this.options.store.subscribe((state) => {
			this.render(state);
		});

		if (this.options.isOnline?.() === false) {
			this.options.store.setOffline();
			return;
		}

		void this.runScan();
	}

	override onClose(): void {
		this.isClosed = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.isBusy = false;
		this.options.store.reset();
		this.contentEl.replaceChildren();
	}

	private render(state: VaultHealthStoreState): void {
		if (this.isClosed) {
			return;
		}

		const root = document.createElement("section");
		root.className = "voidbrain-vault-health";
		root.setAttribute("aria-label", "Voidbrain vault health");
		root.append(this.createHeader(state), this.createBody(state), this.createActions(state));
		this.contentEl.replaceChildren(root);

		if (document.activeElement === document.body || document.activeElement === null) {
			this.contentEl.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
		}
	}

	private createHeader(state: VaultHealthStoreState): HTMLElement {
		const header = document.createElement("header");
		const title = document.createElement("h2");
		title.textContent = "Vault health";
		const status = document.createElement("p");
		status.textContent =
			state.report === null
				? `Status: ${state.status}`
				: `Report ${state.report.reportId} - ${state.report.summary.totalFindings} finding(s)`;
		header.append(title, status);

		if (state.status === "offline") {
			const offline = document.createElement("p");
			offline.setAttribute("role", "status");
			offline.textContent = "Health runtime is offline. No vault files were changed.";
			header.append(offline);
		}

		return header;
	}

	private createBody(state: VaultHealthStoreState): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Vault health report state");

		if (state.status === "loading") {
			const loading = document.createElement("p");
			loading.textContent = "Scanning local vault notes.";
			section.append(loading);
			return section;
		}

		if (state.failureMessage !== null) {
			const failure = document.createElement("p");
			failure.setAttribute("role", "alert");
			failure.textContent = state.failureMessage;
			section.append(failure);
		}

		if (state.report === null) {
			const empty = document.createElement("p");
			empty.textContent =
				state.status === "offline" ? "Vault health is unavailable." : "No health report loaded.";
			section.append(empty);
			return section;
		}

		section.append(this.createSummary(state.report));

		if (state.report.groups.length === 0) {
			const empty = document.createElement("p");
			empty.textContent = "No health findings.";
			section.append(empty);
			return section;
		}

		const groupNav = document.createElement("div");
		groupNav.setAttribute("role", "tablist");
		groupNav.setAttribute("aria-label", "Health finding groups");
		for (const group of state.report.groups) {
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.healthGroupId = group.groupId;
			button.setAttribute("role", "tab");
			button.setAttribute("aria-selected", String(group.groupId === state.selectedGroupId));
			button.textContent = `${group.key.severity} ${group.key.kind} ${group.key.affectedPath ?? "vault"}`;
			button.disabled = this.isBusy;
			button.addEventListener("click", () => {
				this.options.store.selectGroup(group.groupId);
			});
			groupNav.append(button);
		}
		section.append(groupNav);

		const selectedGroup = this.selectedGroup(state);
		if (selectedGroup !== null) {
			section.append(this.createGroup(selectedGroup, state.report));
		}

		if (state.exportResult !== null) {
			section.append(this.createExportResult(state.exportResult));
		}

		if (state.stagedRepairResult !== null) {
			section.append(this.createStageResult(state.stagedRepairResult));
		}

		return section;
	}

	private createSummary(report: VaultHealthReport): HTMLElement {
		const summary = document.createElement("section");
		summary.setAttribute("aria-label", "Vault health summary");
		const text = document.createElement("p");
		text.textContent = [
			`${report.scannedPaths.length} scanned path(s)`,
			`${report.summary.errorCount} error(s)`,
			`${report.summary.warningCount} warning(s)`,
			`${report.summary.infoCount} info`,
		].join(" | ");
		summary.append(text);
		return summary;
	}

	private createGroup(group: VaultHealthFindingGroup, report: VaultHealthReport): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Selected health finding group");
		const heading = document.createElement("h3");
		heading.textContent = `${group.key.severity} ${group.key.kind}`;
		const summary = document.createElement("p");
		summary.textContent = [
			`${group.totalFindings} finding(s)`,
			`${group.stageableFindings} stageable`,
			`${group.reportOnlyFindings} report-only`,
		].join(" | ");
		section.append(heading, summary);

		for (const finding of group.findings) {
			section.append(this.createFinding(finding, report));
		}

		return section;
	}

	private createFinding(finding: VaultHealthFinding, report: VaultHealthReport): HTMLElement {
		const article = document.createElement("article");
		article.dataset.healthFindingId = finding.id;
		const heading = document.createElement("h4");
		heading.textContent = finding.message;
		const metadata = document.createElement("p");
		metadata.textContent = `${finding.severity} | ${finding.kind} | ${finding.remediation.kind}`;
		const paths = document.createElement("p");
		paths.textContent = `Affected: ${finding.affectedPaths.join(", ") || "vault"}`;
		const remediation = document.createElement("p");
		remediation.textContent = finding.remediation.summary;
		article.append(heading, metadata, paths, remediation, this.createEvidenceTable(finding.evidence));

		if (finding.remediation.kind === "stage-change") {
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.healthStageFinding = finding.id;
			button.textContent = this.isBusy ? "Staging" : "Stage repair";
			button.disabled = this.isBusy || this.options.isOnline?.() === false;
			button.setAttribute("aria-label", `Stage repair for ${finding.id}`);
			button.addEventListener("click", () => {
				void this.stageRepair(finding.id, report);
			});
			article.append(button);
		}

		return article;
	}

	private createEvidenceTable(evidenceRows: readonly VaultHealthEvidence[]): HTMLElement {
		const table = document.createElement("table");
		table.setAttribute("aria-label", "Finding evidence");
		const head = document.createElement("thead");
		const headerRow = document.createElement("tr");
		for (const label of ["Path", "Line", "Detail"]) {
			const cell = document.createElement("th");
			cell.scope = "col";
			cell.textContent = label;
			headerRow.append(cell);
		}
		head.append(headerRow);
		const body = document.createElement("tbody");
		for (const evidence of evidenceRows) {
			const row = document.createElement("tr");
			for (const value of [
				evidence.path ?? evidence.sourcePath ?? evidence.targetPath ?? "",
				evidence.line?.toString() ?? "",
				evidence.detail,
			]) {
				const cell = document.createElement("td");
				cell.textContent = value;
				row.append(cell);
			}
			body.append(row);
		}
		table.append(head, body);
		return table;
	}

	private createExportResult(result: VaultHealthExportResult): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Health report export result");
		const text = document.createElement("p");
		text.textContent = result.ok ? `Exported: ${result.export.exportPath}` : `Export failed: ${result.message}`;
		section.append(text);
		return section;
	}

	private createStageResult(result: VaultHealthRepairStageResult): HTMLElement {
		const section = document.createElement("section");
		section.setAttribute("aria-label", "Health repair staging result");
		const text = document.createElement("p");
		text.textContent = result.ok
			? `Staged repair: ${result.stagedChangeId}`
			: `Repair not staged: ${result.message}`;
		section.append(text);
		return section;
	}

	private createActions(state: VaultHealthStoreState): HTMLElement {
		const actions = document.createElement("div");
		actions.setAttribute("aria-label", "Vault health actions");
		const canUseRuntime = this.options.isOnline?.() !== false;
		const canExport = state.report !== null && !this.isBusy && canUseRuntime;
		actions.append(
			this.actionButton("Scan", "scan", this.isBusy || !canUseRuntime, () => {
				void this.runScan();
			}),
			this.actionButton("Export", "export", !canExport, () => {
				if (state.report !== null) {
					void this.exportReport(state.report);
				}
			}),
		);
		return actions;
	}

	private actionButton(label: string, action: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = this.isBusy ? `${label}...` : label;
		button.disabled = disabled;
		button.dataset.healthAction = action;
		button.setAttribute("aria-label", `${label} vault health`);
		button.addEventListener("click", onClick);
		return button;
	}

	private selectedGroup(state: VaultHealthStoreState): VaultHealthFindingGroup | null {
		return (
			state.report?.groups.find((group) => group.groupId === state.selectedGroupId) ??
			state.report?.groups[0] ??
			null
		);
	}

	private async runScan(): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.options.store.setLoading();
		try {
			const result = await this.options.runScan();
			this.options.store.applyScanResult(result);
			this.notice(result.ok ? "Vault health scan completed." : "Vault health scan failed.");
		} catch {
			this.options.store.setFailure("Vault health scan failed. No vault files were changed.");
			this.notice("Vault health scan failed. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState());
		}
	}

	private async exportReport(report: VaultHealthReport): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.options.store.setExporting();
		try {
			const result = await this.options.exportReport(report);
			this.options.store.applyExportResult(result);
			this.notice(result.ok ? "Vault health report exported." : "Vault health report export failed.");
		} catch {
			this.options.store.setFailure("Vault health report export failed. No vault notes were changed.");
			this.notice("Vault health report export failed. No vault notes were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState());
		}
	}

	private async stageRepair(findingId: string, report: VaultHealthReport): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.options.store.setStaging();
		try {
			const result = await this.options.stageRepair(findingId, report);
			this.options.store.applyStageResult(result);
			this.notice(result.ok ? "Vault health repair staged." : "Vault health repair was not staged.");
		} catch {
			this.options.store.setFailure("Vault health repair staging failed. No vault files were changed.");
			this.notice("Vault health repair staging failed. No vault files were changed.");
		} finally {
			this.isBusy = false;
			this.render(this.options.store.getState());
		}
	}

	private notice(message: string): void {
		if (this.options.onNotice !== undefined) {
			this.options.onNotice(message);
			return;
		}

		new Notice(message, 7000);
	}
}
