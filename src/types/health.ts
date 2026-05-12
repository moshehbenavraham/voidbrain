import type { IndexFreshnessState } from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath, ValidationIssue } from "./vault";

export const VAULT_HEALTH_SEVERITIES = ["info", "warning", "error"] as const;
export const VAULT_HEALTH_FINDING_KINDS = [
	"orphan-note",
	"broken-wikilink",
	"stale-index",
	"missing-citation",
] as const;
export const VAULT_HEALTH_REMEDIATION_KINDS = ["report-only", "stage-change", "rebuild-index"] as const;

export type VaultHealthSeverity = (typeof VAULT_HEALTH_SEVERITIES)[number];
export type VaultHealthFindingKind = (typeof VAULT_HEALTH_FINDING_KINDS)[number];
export type VaultHealthRemediationKind = (typeof VAULT_HEALTH_REMEDIATION_KINDS)[number];

export interface VaultHealthEvidence {
	readonly path?: NormalizedVaultPath;
	readonly sourcePath?: NormalizedVaultPath;
	readonly targetPath?: NormalizedVaultPath;
	readonly indexId?: string;
	readonly line?: number;
	readonly expected?: string;
	readonly actual?: string;
	readonly detail: string;
}

export interface VaultHealthRemediation {
	readonly kind: VaultHealthRemediationKind;
	readonly summary: string;
	readonly commandId?: string;
}

export interface VaultHealthFinding {
	readonly id: string;
	readonly kind: VaultHealthFindingKind;
	readonly severity: VaultHealthSeverity;
	readonly message: string;
	readonly affectedPaths: readonly NormalizedVaultPath[];
	readonly evidence: readonly VaultHealthEvidence[];
	readonly remediation: VaultHealthRemediation;
}

export interface VaultHealthSummary {
	readonly totalFindings: number;
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
	readonly findingCounts: Readonly<Record<VaultHealthFindingKind, number>>;
}

export interface VaultHealthReport {
	readonly reportId: string;
	readonly generatedAt: IsoTimestamp;
	readonly scannedPaths: readonly NormalizedVaultPath[];
	readonly indexStates: Readonly<Record<string, IndexFreshnessState>>;
	readonly findings: readonly VaultHealthFinding[];
	readonly summary: VaultHealthSummary;
}

export interface VaultHealthScanSuccess {
	readonly ok: true;
	readonly report: VaultHealthReport;
}

export interface VaultHealthScanFailure {
	readonly ok: false;
	readonly issues: readonly ValidationIssue[];
}

export type VaultHealthScanResult = VaultHealthScanSuccess | VaultHealthScanFailure;
