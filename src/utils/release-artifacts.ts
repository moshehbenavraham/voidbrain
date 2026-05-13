import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
	RELEASE_ARTIFACT_NAMES,
	RELEASE_BUILD_ARTIFACT_NAMES,
	RELEASE_BUILD_DIR,
	RELEASE_PLUGIN_ID,
	RELEASE_VALIDATION_COMMAND_ID,
	type ReleaseArtifactContract,
	type ReleaseArtifactDiagnostic,
	type ReleaseArtifactDiagnosticRecord,
	type ReleaseArtifactName,
	type ReleaseManifestMetadata,
	type ReleasePackageMetadata,
	type ReleaseParseResult,
	type ReleaseValidationIssue,
	type ReleaseValidationIssueCode,
	type ReleaseValidationRequest,
	type ReleaseValidationResult,
	type ReleaseVersionMap,
	type ReleaseVersionValues,
} from "../types/release";

type JsonRecord = Readonly<Record<string, unknown>>;

interface IssueInput {
	readonly code: ReleaseValidationIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly path?: string;
	readonly field?: string;
	readonly expected?: string | readonly string[];
	readonly actual?: string | readonly string[] | null;
}

export const RELEASE_ARTIFACT_CONTRACT = [
	{
		name: "main.js",
		source: "build-output",
		repositoryPath: `${RELEASE_BUILD_DIR}/main.js`,
		packageFile: "main.js",
	},
	{
		name: "manifest.json",
		source: "repository-root",
		repositoryPath: "manifest.json",
		packageFile: "manifest.json",
	},
	{
		name: "styles.css",
		source: "build-output",
		repositoryPath: `${RELEASE_BUILD_DIR}/styles.css`,
		packageFile: "styles.css",
	},
	{
		name: "versions.json",
		source: "repository-root",
		repositoryPath: "versions.json",
		packageFile: "versions.json",
	},
] as const satisfies readonly ReleaseArtifactContract[];

const secretLikeKeyPattern = /\b(api[_-]?key|access[_-]?key|secret|token|password|authorization)\b\s*[:=]/i;
const credentialLikeValuePattern =
	/\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})\b/;
const privatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const success = <TValue>(value: TValue): ReleaseParseResult<TValue> => ({ ok: true, value });

const failure = <TValue>(issues: readonly ReleaseValidationIssue[]): ReleaseParseResult<TValue> => ({
	ok: false,
	issues,
});

const issue = (input: IssueInput): ReleaseValidationIssue => {
	const created: {
		code: ReleaseValidationIssueCode;
		message: string;
		remediation: string;
		path?: string;
		field?: string;
		expected?: string | readonly string[];
		actual?: string | readonly string[] | null;
	} = {
		code: input.code,
		message: input.message,
		remediation: input.remediation,
	};

	if (input.path !== undefined) {
		created.path = input.path;
	}
	if (input.field !== undefined) {
		created.field = input.field;
	}
	if (input.expected !== undefined) {
		created.expected = input.expected;
	}
	if (input.actual !== undefined) {
		created.actual = input.actual;
	}

	return created;
};

const sortIssues = (issues: readonly ReleaseValidationIssue[]): readonly ReleaseValidationIssue[] =>
	[...issues].sort((left, right) => {
		const leftKey = `${left.path ?? ""}:${left.field ?? ""}:${left.code}:${left.message}`;
		const rightKey = `${right.path ?? ""}:${right.field ?? ""}:${right.code}:${right.message}`;
		return leftKey.localeCompare(rightKey);
	});

const sortArtifacts = (artifacts: readonly ReleaseArtifactDiagnostic[]): readonly ReleaseArtifactDiagnostic[] =>
	[...artifacts].sort((left, right) => left.name.localeCompare(right.name));

const hasControlCharacters = (value: string): boolean =>
	Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});

const hasUrlScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);

const hasWindowsDrive = (value: string): boolean => /^[a-zA-Z]:[\\/]/.test(value);

const normalizeRepositoryPath = (value: string): string => value.replaceAll("\\", "/");

const validateRepositoryRelativePath = (
	value: string,
	path: string,
	field: string,
): readonly ReleaseValidationIssue[] => {
	const normalized = normalizeRepositoryPath(value.trim());

	if (normalized.length === 0) {
		return [
			issue({
				code: "release.unsupported-path",
				message: "Release path cannot be empty.",
				path,
				field,
				remediation: "Use a repository-relative release artifact path.",
			}),
		];
	}

	if (
		isAbsolute(normalized) ||
		hasWindowsDrive(value) ||
		hasUrlScheme(normalized) ||
		normalized.split("/").includes("..") ||
		hasControlCharacters(normalized)
	) {
		return [
			issue({
				code: "release.unsupported-path",
				message: "Release path must be repository-relative and bounded.",
				path,
				field,
				actual: value,
				remediation: "Use deterministic repository-relative artifact paths only.",
			}),
		];
	}

	return [];
};

const readJsonFile = async (repoRoot: string, relativePath: string): Promise<ReleaseParseResult<unknown>> => {
	try {
		const raw = await readFile(join(repoRoot, relativePath), "utf8");
		try {
			return success(JSON.parse(raw) as unknown);
		} catch (error) {
			return failure([
				issue({
					code: "release.invalid-json",
					message: `Could not parse JSON file: ${error instanceof Error ? error.message : String(error)}`,
					path: relativePath,
					remediation: "Fix the JSON syntax and rerun release artifact validation.",
				}),
			]);
		}
	} catch (error) {
		return failure([
			issue({
				code: "release.missing-artifact",
				message: `Required release metadata file is missing or unreadable: ${relativePath}`,
				path: relativePath,
				remediation: "Restore the required metadata file and rerun release artifact validation.",
				actual: error instanceof Error ? error.name : "read-failed",
			}),
		]);
	}
};

const stringFieldIssue = (code: ReleaseValidationIssueCode, path: string, field: string): ReleaseValidationIssue =>
	issue({
		code,
		message: `Expected ${field} to be a non-empty string.`,
		path,
		field,
		remediation: "Restore the release metadata field to the expected string value.",
	});

const stringArrayFieldIssue = (code: ReleaseValidationIssueCode, path: string, field: string): ReleaseValidationIssue =>
	issue({
		code,
		message: `Expected ${field} to be an array of strings.`,
		path,
		field,
		remediation: "Restore the release metadata field to an array of repository-relative artifact names.",
	});

const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export const parseReleasePackageMetadata = (
	input: unknown,
	path = "package.json",
): ReleaseParseResult<ReleasePackageMetadata> => {
	if (!isRecord(input)) {
		return failure([
			issue({
				code: "release.invalid-package-metadata",
				message: "Expected package metadata to be a JSON object.",
				path,
				remediation: "Restore package.json to a valid package metadata object.",
			}),
		]);
	}

	const issues: ReleaseValidationIssue[] = [];
	if (!nonEmptyString(input.name)) {
		issues.push(stringFieldIssue("release.invalid-package-metadata", path, "name"));
	}
	if (!nonEmptyString(input.version)) {
		issues.push(stringFieldIssue("release.invalid-package-metadata", path, "version"));
	}
	if (!Array.isArray(input.files) || !input.files.every((entry) => typeof entry === "string")) {
		issues.push(stringArrayFieldIssue("release.invalid-package-metadata", path, "files"));
	} else {
		for (const [index, filePath] of input.files.entries()) {
			issues.push(...validateRepositoryRelativePath(filePath, path, `files[${index}]`));
		}
	}

	if (issues.length > 0) {
		return failure(sortIssues(issues));
	}

	return success({
		name: input.name as string,
		version: input.version as string,
		files: input.files as readonly string[],
	});
};

export const parseReleaseManifestMetadata = (
	input: unknown,
	path = "manifest.json",
): ReleaseParseResult<ReleaseManifestMetadata> => {
	if (!isRecord(input)) {
		return failure([
			issue({
				code: "release.invalid-manifest-metadata",
				message: "Expected manifest metadata to be a JSON object.",
				path,
				remediation: "Restore manifest.json to a valid Obsidian manifest object.",
			}),
		]);
	}

	const issues: ReleaseValidationIssue[] = [];
	for (const field of ["id", "name", "version", "minAppVersion"] as const) {
		if (!nonEmptyString(input[field])) {
			issues.push(stringFieldIssue("release.invalid-manifest-metadata", path, field));
		}
	}

	if (issues.length > 0) {
		return failure(sortIssues(issues));
	}

	return success({
		id: input.id as string,
		name: input.name as string,
		version: input.version as string,
		minAppVersion: input.minAppVersion as string,
	});
};

export const parseReleaseVersionMap = (
	input: unknown,
	path = "versions.json",
): ReleaseParseResult<ReleaseVersionMap> => {
	if (!isRecord(input)) {
		return failure([
			issue({
				code: "release.invalid-version-map",
				message: "Expected version map to be a JSON object.",
				path,
				remediation:
					"Restore versions.json to an object mapping plugin versions to minimum Obsidian app versions.",
			}),
		]);
	}

	const issues: ReleaseValidationIssue[] = [];
	for (const [version, minAppVersion] of Object.entries(input)) {
		if (!nonEmptyString(version) || !nonEmptyString(minAppVersion)) {
			issues.push(
				issue({
					code: "release.invalid-version-map",
					message: "Expected each version map key and value to be a non-empty string.",
					path,
					field: version,
					remediation: "Map each plugin version string to a minimum Obsidian app version string.",
				}),
			);
		}
	}

	if (issues.length > 0) {
		return failure(sortIssues(issues));
	}

	return success(input as ReleaseVersionMap);
};

const expectedPackageFiles = (): readonly string[] => RELEASE_ARTIFACT_NAMES;

const validatePackageFiles = (packageMetadata: ReleasePackageMetadata): readonly ReleaseValidationIssue[] => {
	const expected = expectedPackageFiles();
	const actual = packageMetadata.files;

	if (actual.length === expected.length && actual.every((entry, index) => entry === expected[index])) {
		return [];
	}

	return [
		issue({
			code: "release.package-files-drift",
			message: "package.json files do not match the release artifact contract.",
			path: "package.json",
			field: "files",
			expected,
			actual,
			remediation: "Declare exactly the release artifact files in deterministic order.",
		}),
	];
};

const validateMetadataAlignment = (
	packageMetadata: ReleasePackageMetadata,
	manifestMetadata: ReleaseManifestMetadata,
	versionMap: ReleaseVersionMap,
): {
	readonly versions: ReleaseVersionValues;
	readonly issues: readonly ReleaseValidationIssue[];
} => {
	const issues: ReleaseValidationIssue[] = [];
	const versionMapMinAppVersion = versionMap[manifestMetadata.version] ?? null;

	if (packageMetadata.name !== RELEASE_PLUGIN_ID) {
		issues.push(
			issue({
				code: "release.invalid-package-metadata",
				message: "package.json name does not match the release plugin ID.",
				path: "package.json",
				field: "name",
				expected: RELEASE_PLUGIN_ID,
				actual: packageMetadata.name,
				remediation: "Restore the package name to the Voidbrain plugin ID.",
			}),
		);
	}

	if (manifestMetadata.id !== RELEASE_PLUGIN_ID) {
		issues.push(
			issue({
				code: "release.invalid-manifest-metadata",
				message: "manifest.json id does not match the release plugin ID.",
				path: "manifest.json",
				field: "id",
				expected: RELEASE_PLUGIN_ID,
				actual: manifestMetadata.id,
				remediation: "Restore the manifest ID to the Voidbrain plugin ID.",
			}),
		);
	}

	if (packageMetadata.version !== manifestMetadata.version) {
		issues.push(
			issue({
				code: "release.version-drift",
				message: "package.json version and manifest.json version do not match.",
				path: "manifest.json",
				field: "version",
				expected: packageMetadata.version,
				actual: manifestMetadata.version,
				remediation: "Align package.json and manifest.json version values before release.",
			}),
		);
	}

	if (versionMapMinAppVersion === null) {
		issues.push(
			issue({
				code: "release.version-map-entry-missing",
				message: "versions.json is missing an entry for the current manifest version.",
				path: "versions.json",
				field: manifestMetadata.version,
				expected: manifestMetadata.minAppVersion,
				actual: null,
				remediation: "Add the current manifest version to versions.json with the matching minimum app version.",
			}),
		);
	} else if (versionMapMinAppVersion !== manifestMetadata.minAppVersion) {
		issues.push(
			issue({
				code: "release.min-app-version-drift",
				message: "versions.json minimum app version does not match manifest.json.",
				path: "versions.json",
				field: manifestMetadata.version,
				expected: manifestMetadata.minAppVersion,
				actual: versionMapMinAppVersion,
				remediation: "Align versions.json with manifest.json minAppVersion before release.",
			}),
		);
	}

	issues.push(...validatePackageFiles(packageMetadata));

	return {
		versions: {
			packageName: packageMetadata.name,
			packageVersion: packageMetadata.version,
			manifestId: manifestMetadata.id,
			manifestVersion: manifestMetadata.version,
			minAppVersion: manifestMetadata.minAppVersion,
			versionMapMinAppVersion,
		},
		issues: sortIssues(issues),
	};
};

const isReadableFile = async (path: string): Promise<boolean> => {
	try {
		const fileStat = await stat(path);
		if (!fileStat.isFile()) {
			return false;
		}
		await access(path, constants.R_OK);
		return true;
	} catch {
		return false;
	}
};

const checksumArtifact = async (
	repoRoot: string,
	contract: ReleaseArtifactContract,
): Promise<ReleaseParseResult<ReleaseArtifactDiagnostic>> => {
	const pathIssues = validateRepositoryRelativePath(contract.repositoryPath, contract.repositoryPath, "path");
	if (pathIssues.length > 0) {
		return failure(pathIssues);
	}

	const absolutePath = join(repoRoot, contract.repositoryPath);
	if (!(await isReadableFile(absolutePath))) {
		return failure([
			issue({
				code: "release.missing-artifact",
				message: `Required release artifact is missing or unreadable: ${contract.repositoryPath}`,
				path: contract.repositoryPath,
				remediation:
					contract.source === "build-output"
						? "Run bun run build and rerun release artifact validation."
						: "Restore the metadata file and rerun release artifact validation.",
			}),
		]);
	}

	try {
		const content = await readFile(absolutePath);
		return success({
			name: contract.name,
			path: contract.repositoryPath,
			sizeBytes: content.byteLength,
			checksum: {
				algorithm: "sha256",
				value: createHash("sha256").update(content).digest("hex"),
			},
		});
	} catch (error) {
		return failure([
			issue({
				code: "release.unreadable-artifact",
				message: `Could not read release artifact for checksum: ${contract.repositoryPath}`,
				path: contract.repositoryPath,
				remediation: "Fix file permissions or regenerate the artifact, then rerun release artifact validation.",
				actual: error instanceof Error ? error.name : "read-failed",
			}),
		]);
	}
};

const validateBuildDirectory = async (repoRoot: string): Promise<readonly ReleaseValidationIssue[]> => {
	const buildDir = join(repoRoot, RELEASE_BUILD_DIR);
	const expectedBuildFiles = new Set<ReleaseArtifactName>(RELEASE_BUILD_ARTIFACT_NAMES);

	try {
		const entries = await readdir(buildDir, { withFileTypes: true });
		return sortIssues(
			entries
				.filter((entry) => entry.isFile() && !expectedBuildFiles.has(entry.name as ReleaseArtifactName))
				.map((entry) =>
					issue({
						code: "release.undeclared-release-file",
						message: "Build output contains a file outside the release artifact contract.",
						path: `${RELEASE_BUILD_DIR}/${entry.name}`,
						field: "build-output",
						remediation:
							"Remove the undeclared build file or update the release artifact contract intentionally.",
					}),
				),
		);
	} catch {
		return [];
	}
};

const validateArtifacts = async (
	repoRoot: string,
): Promise<{
	readonly artifacts: readonly ReleaseArtifactDiagnostic[];
	readonly issues: readonly ReleaseValidationIssue[];
}> => {
	const artifacts: ReleaseArtifactDiagnostic[] = [];
	const issues: ReleaseValidationIssue[] = [];

	for (const contract of RELEASE_ARTIFACT_CONTRACT) {
		const artifact = await checksumArtifact(repoRoot, contract);
		if (artifact.ok) {
			artifacts.push(artifact.value);
		} else {
			issues.push(...artifact.issues);
		}
	}

	issues.push(...(await validateBuildDirectory(repoRoot)));

	return {
		artifacts: sortArtifacts(artifacts),
		issues: sortIssues(issues),
	};
};

const validateMetadata = async (
	repoRoot: string,
): Promise<{
	readonly versions: ReleaseVersionValues | null;
	readonly issues: readonly ReleaseValidationIssue[];
}> => {
	const issues: ReleaseValidationIssue[] = [];
	const packageJson = await readJsonFile(repoRoot, "package.json");
	const manifestJson = await readJsonFile(repoRoot, "manifest.json");
	const versionsJson = await readJsonFile(repoRoot, "versions.json");

	if (!packageJson.ok) {
		issues.push(...packageJson.issues);
	}
	if (!manifestJson.ok) {
		issues.push(...manifestJson.issues);
	}
	if (!versionsJson.ok) {
		issues.push(...versionsJson.issues);
	}

	if (!packageJson.ok || !manifestJson.ok || !versionsJson.ok) {
		return {
			versions: null,
			issues: sortIssues(issues),
		};
	}

	const packageMetadata = parseReleasePackageMetadata(packageJson.value);
	const manifestMetadata = parseReleaseManifestMetadata(manifestJson.value);
	const versionMap = parseReleaseVersionMap(versionsJson.value);

	if (!packageMetadata.ok) {
		issues.push(...packageMetadata.issues);
	}
	if (!manifestMetadata.ok) {
		issues.push(...manifestMetadata.issues);
	}
	if (!versionMap.ok) {
		issues.push(...versionMap.issues);
	}

	if (!packageMetadata.ok || !manifestMetadata.ok || !versionMap.ok) {
		return {
			versions: null,
			issues: sortIssues(issues),
		};
	}

	const alignment = validateMetadataAlignment(packageMetadata.value, manifestMetadata.value, versionMap.value);
	return {
		versions: alignment.versions,
		issues: sortIssues([...issues, ...alignment.issues]),
	};
};

export const createReleaseArtifactDiagnostic = (
	versions: ReleaseVersionValues | null,
	artifacts: readonly ReleaseArtifactDiagnostic[],
	issues: readonly ReleaseValidationIssue[],
	now = new Date(),
): ReleaseArtifactDiagnosticRecord => {
	const sortedIssues = sortIssues(issues);

	return {
		commandId: RELEASE_VALIDATION_COMMAND_ID,
		generatedAt: now.toISOString(),
		versions,
		artifacts: sortArtifacts(artifacts),
		validationOutput: {
			status: sortedIssues.length === 0 ? "passed" : "failed",
			issueCount: sortedIssues.length,
			issues: sortedIssues,
		},
	};
};

export const validateReleaseDiagnosticSafety = (
	input: unknown,
	path = "release-diagnostic",
): readonly ReleaseValidationIssue[] => {
	let serialized: string;
	try {
		serialized = JSON.stringify(input);
	} catch (error) {
		return [
			issue({
				code: "release.invalid-diagnostic-input",
				message: `Release diagnostic could not be serialized safely: ${
					error instanceof Error ? error.message : String(error)
				}`,
				path,
				remediation: "Use JSON-compatible diagnostic values only.",
			}),
		];
	}

	if (serialized === undefined) {
		return [
			issue({
				code: "release.invalid-diagnostic-input",
				message: "Release diagnostic did not serialize to a JSON value.",
				path,
				remediation: "Use a JSON-compatible diagnostic object.",
			}),
		];
	}

	const issues: ReleaseValidationIssue[] = [];
	if (secretLikeKeyPattern.test(serialized) || credentialLikeValuePattern.test(serialized)) {
		issues.push(
			issue({
				code: "release.unsafe-diagnostic-value",
				message: "Release diagnostic contains a secret-like key or credential-like value.",
				path,
				remediation:
					"Redact the value or replace it with a clearly fake placeholder before recording diagnostics.",
			}),
		);
	}

	if (privatePathHintPattern.test(serialized)) {
		issues.push(
			issue({
				code: "release.private-path-hint",
				message: "Release diagnostic contains a private local path hint.",
				path,
				remediation: "Use repository-relative paths or placeholder paths in release diagnostics.",
			}),
		);
	}

	return sortIssues(issues);
};

export const validateReleaseArtifacts = async (
	request: ReleaseValidationRequest = {},
): Promise<ReleaseValidationResult> => {
	const repoRoot = request.repoRoot ?? process.cwd();
	const metadata = await validateMetadata(repoRoot);
	const artifactResult = await validateArtifacts(repoRoot);
	const initialIssues = sortIssues([...metadata.issues, ...artifactResult.issues]);
	const initialDiagnostic = createReleaseArtifactDiagnostic(
		metadata.versions,
		artifactResult.artifacts,
		initialIssues,
		request.now,
	);
	const diagnosticIssues = validateReleaseDiagnosticSafety(initialDiagnostic);
	const issues = sortIssues([...initialIssues, ...diagnosticIssues]);
	const diagnostic = createReleaseArtifactDiagnostic(
		metadata.versions,
		artifactResult.artifacts,
		issues,
		request.now,
	);

	return {
		ok: issues.length === 0,
		commandId: RELEASE_VALIDATION_COMMAND_ID,
		versions: metadata.versions,
		artifacts: artifactResult.artifacts,
		issues,
		diagnostic,
	};
};

export const releaseArtifactPackageFiles = (): readonly ReleaseArtifactName[] => RELEASE_ARTIFACT_NAMES;
