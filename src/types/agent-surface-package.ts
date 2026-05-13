import type {
	AgentCommandStatus,
	AgentSurfaceId,
	AgentValidationBoundary,
	AgentValidationIssue,
} from "./agent-commands";

export const AGENT_SURFACE_PACKAGE_SCRIPT_ID = "validate-agent-surface-package" as const;

export const AGENT_SURFACE_PACKAGE_ECOSYSTEMS = [
	"codex",
	"claude-code",
	"gemini-cli",
	"voidbrain-skill",
	"human-docs",
	"unknown",
] as const;

export const AGENT_SURFACE_PACKAGE_STATES = [
	"ready",
	"blocked",
	"missing-surface",
	"unsafe-content",
	"stale-catalog",
	"unsupported-path",
] as const;

export const AGENT_SURFACE_PACKAGE_ISSUE_CODES = [
	"package.invalid-input",
	"package.missing-surface",
	"package.unreadable-surface",
	"package.unsupported-path",
	"package.unsupported-output-path",
	"package.unsafe-content",
	"package.stale-catalog",
	"package.blocked",
] as const;

export type AgentSurfacePackageScriptId = typeof AGENT_SURFACE_PACKAGE_SCRIPT_ID;
export type AgentSurfacePackageEcosystem = (typeof AGENT_SURFACE_PACKAGE_ECOSYSTEMS)[number];
export type AgentSurfacePackageState = (typeof AGENT_SURFACE_PACKAGE_STATES)[number];
export type AgentSurfacePackageIssueCode =
	| (typeof AGENT_SURFACE_PACKAGE_ISSUE_CODES)[number]
	| AgentValidationIssue["code"];

export interface AgentSurfacePackageChecksum {
	readonly algorithm: "sha256";
	readonly value: string;
}

export interface AgentSurfacePackageIssue {
	readonly code: AgentSurfacePackageIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly surfaceId?: AgentSurfaceId | string | undefined;
	readonly path?: string | undefined;
	readonly commandId?: string | undefined;
	readonly line?: number | undefined;
	readonly heading?: string | undefined;
	readonly excerpt?: string | undefined;
	readonly boundary?: AgentValidationBoundary | undefined;
	readonly sourceCode?: AgentValidationIssue["code"] | undefined;
}

export interface AgentSurfacePackageRecoveryDetails {
	readonly scriptId: AgentSurfacePackageScriptId;
	readonly surfaceId: AgentSurfaceId | string;
	readonly targetEcosystem: AgentSurfacePackageEcosystem;
	readonly path: string;
	readonly packagePath?: string | undefined;
	readonly checksum?: AgentSurfacePackageChecksum | undefined;
	readonly issueCode?: AgentSurfacePackageIssueCode | undefined;
	readonly validationContext: string;
}

export interface AgentSurfacePackageEntry {
	readonly surfaceId: AgentSurfaceId | string;
	readonly label: string;
	readonly targetEcosystem: AgentSurfacePackageEcosystem;
	readonly path: string;
	readonly required: boolean;
	readonly state: AgentSurfacePackageState;
	readonly commandCatalogStatus: AgentCommandStatus | "mixed" | "unknown";
	readonly commandIds: readonly string[];
	readonly checksum?: AgentSurfacePackageChecksum | undefined;
	readonly sizeBytes?: number | undefined;
	readonly issues: readonly AgentSurfacePackageIssue[];
	readonly recovery: AgentSurfacePackageRecoveryDetails;
}

export interface AgentSurfacePackageManifest {
	readonly scriptId: AgentSurfacePackageScriptId;
	readonly generatedAt: string;
	readonly surfaces: readonly AgentSurfacePackageEntry[];
	readonly commandCatalog: {
		readonly commandCount: number;
		readonly statuses: readonly AgentCommandStatus[];
		readonly checksum: AgentSurfacePackageChecksum;
	};
	readonly issues: readonly AgentSurfacePackageIssue[];
}

export interface AgentSurfacePackageDiagnostic {
	readonly scriptId: AgentSurfacePackageScriptId;
	readonly generatedAt: string;
	readonly ready: boolean;
	readonly surfaceCount: number;
	readonly issues: readonly AgentSurfacePackageIssue[];
	readonly manifest: AgentSurfacePackageManifest;
}

export interface AgentSurfacePackagePlanningInput {
	readonly repoRoot: string;
	readonly surfacePaths?: readonly string[] | undefined;
	readonly outputPath?: string | undefined;
	readonly now?: Date | undefined;
}

export interface AgentSurfacePackageReadyResult {
	readonly ok: true;
	readonly manifest: AgentSurfacePackageManifest;
	readonly diagnostic: AgentSurfacePackageDiagnostic;
}

export interface AgentSurfacePackageBlockedResult {
	readonly ok: false;
	readonly manifest: AgentSurfacePackageManifest;
	readonly diagnostic: AgentSurfacePackageDiagnostic;
	readonly issues: readonly AgentSurfacePackageIssue[];
}

export type AgentSurfacePackagePlanningResult = AgentSurfacePackageReadyResult | AgentSurfacePackageBlockedResult;
