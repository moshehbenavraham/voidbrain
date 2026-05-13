export const RELEASE_VALIDATION_COMMAND_ID = "voidbrain.validate-release-artifacts";
export const RELEASE_PLUGIN_ID = "voidbrain";
export const RELEASE_BUILD_DIR = "build/voidbrain";

export const RELEASE_ARTIFACT_NAMES = ["main.js", "manifest.json", "styles.css", "versions.json"] as const;
export const RELEASE_BUILD_ARTIFACT_NAMES = ["main.js", "styles.css"] as const;
export const RELEASE_METADATA_ARTIFACT_NAMES = ["manifest.json", "versions.json"] as const;

export type ReleaseArtifactName = (typeof RELEASE_ARTIFACT_NAMES)[number];
export type ReleaseBuildArtifactName = (typeof RELEASE_BUILD_ARTIFACT_NAMES)[number];
export type ReleaseMetadataArtifactName = (typeof RELEASE_METADATA_ARTIFACT_NAMES)[number];
export type ReleaseArtifactSource = "build-output" | "repository-root";
export type ReleaseChecksumAlgorithm = "sha256";
export type ReleaseValidationStatus = "passed" | "failed";

export const RELEASE_VALIDATION_ISSUE_CODES = [
	"release.invalid-json",
	"release.invalid-package-metadata",
	"release.invalid-manifest-metadata",
	"release.invalid-version-map",
	"release.version-drift",
	"release.min-app-version-drift",
	"release.version-map-entry-missing",
	"release.package-files-drift",
	"release.missing-artifact",
	"release.unreadable-artifact",
	"release.undeclared-release-file",
	"release.unsupported-path",
	"release.unsafe-diagnostic-value",
	"release.private-path-hint",
	"release.invalid-diagnostic-input",
] as const;

export type ReleaseValidationIssueCode = (typeof RELEASE_VALIDATION_ISSUE_CODES)[number];

export interface ReleaseArtifactContract {
	readonly name: ReleaseArtifactName;
	readonly source: ReleaseArtifactSource;
	readonly repositoryPath: string;
	readonly packageFile: ReleaseArtifactName;
}

export interface ReleasePackageMetadata {
	readonly name: string;
	readonly version: string;
	readonly files: readonly string[];
}

export interface ReleaseManifestMetadata {
	readonly id: string;
	readonly name: string;
	readonly version: string;
	readonly minAppVersion: string;
}

export type ReleaseVersionMap = Readonly<Record<string, string>>;

export interface ReleaseVersionValues {
	readonly packageName: string;
	readonly packageVersion: string;
	readonly manifestId: string;
	readonly manifestVersion: string;
	readonly minAppVersion: string;
	readonly versionMapMinAppVersion: string | null;
}

export interface ReleaseValidationIssue {
	readonly code: ReleaseValidationIssueCode;
	readonly message: string;
	readonly path?: string;
	readonly field?: string;
	readonly expected?: string | readonly string[];
	readonly actual?: string | readonly string[] | null;
	readonly remediation: string;
}

export interface ReleaseArtifactChecksum {
	readonly algorithm: ReleaseChecksumAlgorithm;
	readonly value: string;
}

export interface ReleaseArtifactDiagnostic {
	readonly name: ReleaseArtifactName;
	readonly path: string;
	readonly sizeBytes: number;
	readonly checksum: ReleaseArtifactChecksum;
}

export interface ReleaseValidationOutput {
	readonly status: ReleaseValidationStatus;
	readonly issueCount: number;
	readonly issues: readonly ReleaseValidationIssue[];
}

export interface ReleaseArtifactDiagnosticRecord {
	readonly commandId: typeof RELEASE_VALIDATION_COMMAND_ID;
	readonly generatedAt: string;
	readonly versions: ReleaseVersionValues | null;
	readonly artifacts: readonly ReleaseArtifactDiagnostic[];
	readonly validationOutput: ReleaseValidationOutput;
}

export interface ReleaseValidationRequest {
	readonly repoRoot?: string;
	readonly now?: Date;
}

export interface ReleaseValidationResult {
	readonly ok: boolean;
	readonly commandId: typeof RELEASE_VALIDATION_COMMAND_ID;
	readonly versions: ReleaseVersionValues | null;
	readonly artifacts: readonly ReleaseArtifactDiagnostic[];
	readonly issues: readonly ReleaseValidationIssue[];
	readonly diagnostic: ReleaseArtifactDiagnosticRecord;
}

export interface ReleaseParseSuccess<TValue> {
	readonly ok: true;
	readonly value: TValue;
}

export interface ReleaseParseFailure {
	readonly ok: false;
	readonly issues: readonly ReleaseValidationIssue[];
}

export type ReleaseParseResult<TValue> = ReleaseParseSuccess<TValue> | ReleaseParseFailure;

export const assertNeverReleaseValue = (value: never): never => {
	throw new Error(`Unhandled release contract value: ${String(value)}`);
};
