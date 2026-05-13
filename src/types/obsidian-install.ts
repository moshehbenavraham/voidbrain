import type {
	ReleaseArtifactChecksum,
	ReleaseArtifactDiagnostic,
	ReleaseArtifactName,
	ReleaseValidationOutput,
	ReleaseValidationResult,
} from "./release";

export const OBSIDIAN_INSTALL_COMMAND_ID = "voidbrain.deploy-obsidian-plugin";
export const OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH = ".obsidian/plugins/voidbrain";

export const OBSIDIAN_INSTALL_OPERATION_KINDS = [
	"fresh-install",
	"upgrade",
	"reinstall",
	"downgrade",
	"invalid-existing-install",
] as const;

export const OBSIDIAN_INSTALL_ISSUE_CODES = [
	"install.invalid-vault-root",
	"install.missing-vault-root",
	"install.missing-obsidian-folder",
	"install.invalid-target-path",
	"install.invalid-installed-manifest",
	"install.version-compare-unknown",
	"install.downgrade-blocked",
	"install.release-validation-failed",
	"install.missing-artifact",
	"install.unsupported-artifact",
	"install.unsafe-diagnostic-value",
	"install.private-path-hint",
	"install.invalid-diagnostic-input",
	"install.execution-in-flight",
	"install.execution-failed",
] as const;

export type ObsidianInstallCommandId = typeof OBSIDIAN_INSTALL_COMMAND_ID;
export type ObsidianInstallOperationKind = (typeof OBSIDIAN_INSTALL_OPERATION_KINDS)[number];
export type ObsidianInstallIssueCode = (typeof OBSIDIAN_INSTALL_ISSUE_CODES)[number];
export type ObsidianInstallPlanStatus = "ready" | "blocked";
export type ObsidianInstallRollbackMode = "none" | "backup-existing-plugin-artifacts";
export type ObsidianInstallActionKind =
	| "create-obsidian-folder"
	| "create-plugin-folder"
	| "copy-artifact"
	| "clean-artifact"
	| "backup-existing-artifact";

export interface ObsidianInstallOptions {
	readonly repoRoot: string;
	readonly vaultRoot: string;
	readonly createObsidianFolder: boolean;
	readonly clean: boolean;
	readonly dryRun: boolean;
	readonly allowDowngrade: boolean;
}

export interface ObsidianInstallTargetPaths {
	readonly vaultRootAbsolutePath: string;
	readonly obsidianDirAbsolutePath: string;
	readonly pluginDirAbsolutePath: string;
	readonly pluginRelativePath: typeof OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH;
}

export interface ObsidianInstalledManifest {
	readonly id: string;
	readonly version: string;
	readonly minAppVersion: string | null;
}

export interface ObsidianInstallIssue {
	readonly code: ObsidianInstallIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly path?: string;
	readonly field?: string;
	readonly expected?: string | readonly string[];
	readonly actual?: string | readonly string[] | null;
}

export interface ObsidianInstallArtifactPlan {
	readonly name: ReleaseArtifactName;
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly sourceAbsolutePath: string;
	readonly targetAbsolutePath: string;
	readonly sizeBytes: number;
	readonly checksum: ReleaseArtifactChecksum;
}

export interface ObsidianInstallActionDiagnostic {
	readonly kind: ObsidianInstallActionKind;
	readonly artifactName?: ReleaseArtifactName;
	readonly sourcePath?: string;
	readonly targetPath: string;
}

export interface ObsidianInstallRollbackIntent {
	readonly mode: ObsidianInstallRollbackMode;
	readonly reason: string;
	readonly targetPath: typeof OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH;
	readonly artifactPaths: readonly string[];
	readonly backupDirectoryName: string | null;
}

export interface ObsidianInstallDiagnosticRecord {
	readonly commandId: ObsidianInstallCommandId;
	readonly operationKind: ObsidianInstallOperationKind;
	readonly status: ObsidianInstallPlanStatus;
	readonly targetPluginPath: typeof OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH;
	readonly installedVersion: string | null;
	readonly incomingVersion: string | null;
	readonly releaseValidation: ReleaseValidationOutput;
	readonly rollbackIntent: ObsidianInstallRollbackIntent;
	readonly actions: readonly ObsidianInstallActionDiagnostic[];
	readonly issues: readonly ObsidianInstallIssue[];
}

export interface ObsidianInstallPlan {
	readonly commandId: ObsidianInstallCommandId;
	readonly status: ObsidianInstallPlanStatus;
	readonly operationKind: ObsidianInstallOperationKind;
	readonly target: ObsidianInstallTargetPaths | null;
	readonly installedManifest: ObsidianInstalledManifest | null;
	readonly installedVersion: string | null;
	readonly incomingVersion: string | null;
	readonly releaseValidation: ReleaseValidationResult;
	readonly artifacts: readonly ObsidianInstallArtifactPlan[];
	readonly cleanActions: readonly ObsidianInstallArtifactPlan[];
	readonly rollbackIntent: ObsidianInstallRollbackIntent;
	readonly issues: readonly ObsidianInstallIssue[];
	readonly diagnostic: ObsidianInstallDiagnosticRecord;
}

export interface ObsidianInstallFileInfo {
	readonly exists: boolean;
	readonly isDirectory: boolean;
	readonly isFile: boolean;
}

export interface ObsidianInstallFilesystem {
	readonly fileInfo: (path: string) => Promise<ObsidianInstallFileInfo>;
	readonly readTextFile: (path: string) => Promise<string>;
}

export interface ObsidianInstallExecutionFilesystem {
	readonly ensureDir: (path: string) => Promise<void>;
	readonly removeFile: (path: string) => Promise<void>;
	readonly copyFile: (sourcePath: string, targetPath: string) => Promise<void>;
}

export interface ObsidianInstallExecutionResult {
	readonly ok: boolean;
	readonly completedActions: readonly ObsidianInstallActionDiagnostic[];
	readonly compensationActions: readonly ObsidianInstallActionDiagnostic[];
	readonly issues: readonly ObsidianInstallIssue[];
}

export interface ObsidianInstallPlanRequest {
	readonly options: ObsidianInstallOptions;
	readonly releaseValidation: ReleaseValidationResult;
	readonly filesystem?: ObsidianInstallFilesystem;
}

export interface ObsidianInstallDiagnosticSafetyResult {
	readonly ok: boolean;
	readonly issues: readonly ObsidianInstallIssue[];
}

export type ObsidianInstallReleaseArtifactLookup = ReadonlyMap<ReleaseArtifactName, ReleaseArtifactDiagnostic>;
