import type { IndexFreshnessState } from "./retrieval";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord, ValidationIssue } from "./vault";

export const VAULT_HEALTH_SEVERITIES = ["info", "warning", "error"] as const;
export const VAULT_HEALTH_FINDING_KINDS = [
	"orphan-note",
	"broken-wikilink",
	"stale-index",
	"missing-citation",
	"content-gap",
] as const;
export const VAULT_HEALTH_REMEDIATION_KINDS = ["report-only", "stage-change", "rebuild-index"] as const;
export const VAULT_HEALTH_EXPORT_STATUSES = ["idle", "exporting", "exported", "failed"] as const;
export const VAULT_HEALTH_REPAIR_SAFETY_KINDS = ["safe-stage-change", "report-only"] as const;
export const VAULT_HEALTH_STORE_STATUSES = [
	"idle",
	"loading",
	"ready",
	"empty",
	"failed",
	"exporting",
	"staging",
	"offline",
] as const;

export type VaultHealthSeverity = (typeof VAULT_HEALTH_SEVERITIES)[number];
export type VaultHealthFindingKind = (typeof VAULT_HEALTH_FINDING_KINDS)[number];
export type VaultHealthRemediationKind = (typeof VAULT_HEALTH_REMEDIATION_KINDS)[number];
export type VaultHealthExportStatus = (typeof VAULT_HEALTH_EXPORT_STATUSES)[number];
export type VaultHealthRepairSafetyKind = (typeof VAULT_HEALTH_REPAIR_SAFETY_KINDS)[number];
export type VaultHealthStoreStatus = (typeof VAULT_HEALTH_STORE_STATUSES)[number];

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

export interface VaultHealthFindingGroupKey {
	readonly severity: VaultHealthSeverity;
	readonly kind: VaultHealthFindingKind;
	readonly affectedPath: NormalizedVaultPath | null;
}

export interface VaultHealthFindingGroup {
	readonly groupId: string;
	readonly key: VaultHealthFindingGroupKey;
	readonly findingIds: readonly string[];
	readonly findings: readonly VaultHealthFinding[];
	readonly totalFindings: number;
	readonly stageableFindings: number;
	readonly reportOnlyFindings: number;
}

export interface VaultHealthReport {
	readonly reportId: string;
	readonly generatedAt: IsoTimestamp;
	readonly scannedPaths: readonly NormalizedVaultPath[];
	readonly indexStates: Readonly<Record<string, IndexFreshnessState>>;
	readonly findings: readonly VaultHealthFinding[];
	readonly groups: readonly VaultHealthFindingGroup[];
	readonly summary: VaultHealthSummary;
}

export interface VaultHealthMarkdownExport {
	readonly reportId: string;
	readonly exportedAt: IsoTimestamp;
	readonly exportPath: NormalizedVaultPath;
	readonly byteLength: number;
}

export interface VaultHealthRepairSafety {
	readonly findingId: string;
	readonly kind: VaultHealthRepairSafetyKind;
	readonly reason: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly commandId?: string;
}

export interface VaultHealthActionRecovery {
	readonly commandId: string;
	readonly reportId?: string;
	readonly findingId?: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly exportPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput: readonly ValidationIssue[];
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

export interface VaultHealthRuntimeScanSuccess {
	readonly ok: true;
	readonly report: VaultHealthReport;
	readonly recovery: VaultHealthActionRecovery;
}

export interface VaultHealthRuntimeScanFailure {
	readonly ok: false;
	readonly message: string;
	readonly issues: readonly ValidationIssue[];
	readonly recovery: VaultHealthActionRecovery;
}

export type VaultHealthRuntimeScanResult = VaultHealthRuntimeScanSuccess | VaultHealthRuntimeScanFailure;

export interface VaultHealthExportSuccess {
	readonly ok: true;
	readonly export: VaultHealthMarkdownExport;
	readonly recovery: VaultHealthActionRecovery;
}

export interface VaultHealthExportFailure {
	readonly ok: false;
	readonly message: string;
	readonly recovery: VaultHealthActionRecovery;
}

export type VaultHealthExportResult = VaultHealthExportSuccess | VaultHealthExportFailure;

export interface VaultHealthRepairStageSuccess {
	readonly ok: true;
	readonly findingId: string;
	readonly stagedChangeId: string;
	readonly stagedChange: StagedChangeRecord;
	readonly targetPath: NormalizedVaultPath;
	readonly recovery: VaultHealthActionRecovery;
}

export interface VaultHealthRepairStageFailure {
	readonly ok: false;
	readonly findingId?: string;
	readonly message: string;
	readonly safety?: VaultHealthRepairSafety;
	readonly recovery: VaultHealthActionRecovery;
}

export type VaultHealthRepairStageResult = VaultHealthRepairStageSuccess | VaultHealthRepairStageFailure;

export interface VaultHealthStoreState {
	readonly status: VaultHealthStoreStatus;
	readonly report: VaultHealthReport | null;
	readonly selectedGroupId: string | null;
	readonly exportResult: VaultHealthExportResult | null;
	readonly stagedRepairResult: VaultHealthRepairStageResult | null;
	readonly failureMessage: string | null;
	readonly updatedAt: IsoTimestamp;
}

export type VaultHealthStoreSubscriber = (state: VaultHealthStoreState) => void;
export type VaultHealthStoreUnsubscribe = () => void;
