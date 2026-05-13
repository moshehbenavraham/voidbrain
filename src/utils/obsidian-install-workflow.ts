import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
	OBSIDIAN_INSTALL_COMMAND_ID,
	OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
	type ObsidianInstallActionDiagnostic,
	type ObsidianInstallArtifactPlan,
	type ObsidianInstallDiagnosticRecord,
	type ObsidianInstallDiagnosticSafetyResult,
	type ObsidianInstallExecutionFilesystem,
	type ObsidianInstallExecutionResult,
	type ObsidianInstallFileInfo,
	type ObsidianInstallFilesystem,
	type ObsidianInstallIssue,
	type ObsidianInstallIssueCode,
	type ObsidianInstallOperationKind,
	type ObsidianInstallOptions,
	type ObsidianInstallPlan,
	type ObsidianInstallPlanRequest,
	type ObsidianInstallReleaseArtifactLookup,
	type ObsidianInstallRollbackIntent,
	type ObsidianInstallTargetPaths,
	type ObsidianInstalledManifest,
} from "../types/obsidian-install";
import { RELEASE_PLUGIN_ID, type ReleaseArtifactName, type ReleaseValidationResult } from "../types/release";
import { RELEASE_ARTIFACT_CONTRACT } from "./release-artifacts";

type JsonRecord = Readonly<Record<string, unknown>>;

interface IssueInput {
	readonly code: ObsidianInstallIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly path?: string;
	readonly field?: string;
	readonly expected?: string | readonly string[];
	readonly actual?: string | readonly string[] | null;
}

interface TargetResolution {
	readonly target: ObsidianInstallTargetPaths | null;
	readonly shouldCreateObsidianFolder: boolean;
	readonly issues: readonly ObsidianInstallIssue[];
}

interface ManifestReadResult {
	readonly manifest: ObsidianInstalledManifest | null;
	readonly issues: readonly ObsidianInstallIssue[];
}

const secretLikeKeyPattern = /\b(api[_-]?key|access[_-]?key|secret|token|password|authorization)\b\s*[:=]/i;
const credentialLikeValuePattern =
	/\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})\b/;
const privatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;
const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/u;

let isExecutingInstallPlan = false;

const issue = (input: IssueInput): ObsidianInstallIssue => {
	const created: {
		code: ObsidianInstallIssueCode;
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

const sortIssues = (issues: readonly ObsidianInstallIssue[]): readonly ObsidianInstallIssue[] =>
	[...issues].sort((left, right) => {
		const leftKey = `${left.path ?? ""}:${left.field ?? ""}:${left.code}:${left.message}`;
		const rightKey = `${right.path ?? ""}:${right.field ?? ""}:${right.code}:${right.message}`;
		return leftKey.localeCompare(rightKey);
	});

const defaultFilesystem: ObsidianInstallFilesystem = {
	fileInfo: async (path: string): Promise<ObsidianInstallFileInfo> => {
		try {
			const pathStat = await stat(path);
			return {
				exists: true,
				isDirectory: pathStat.isDirectory(),
				isFile: pathStat.isFile(),
			};
		} catch {
			return {
				exists: false,
				isDirectory: false,
				isFile: false,
			};
		}
	},
	readTextFile: async (path: string): Promise<string> => readFile(path, "utf8"),
};

const defaultExecutionFilesystem: ObsidianInstallExecutionFilesystem = {
	ensureDir: async (path: string): Promise<void> => {
		await mkdir(path, { recursive: true });
	},
	removeFile: async (path: string): Promise<void> => {
		await rm(path, { force: true });
	},
	copyFile: async (sourcePath: string, targetPath: string): Promise<void> => {
		await copyFile(sourcePath, targetPath);
		await access(targetPath, constants.R_OK);
	},
};

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const hasControlCharacters = (value: string): boolean =>
	Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});

const normalizePathForChecks = (value: string): string => value.replaceAll("\\", "/");
const hasUrlScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u.test(value);

const isPathInside = (parentPath: string, childPath: string): boolean => {
	const childRelativePath = relative(parentPath, childPath);
	return childRelativePath.length === 0 || (!childRelativePath.startsWith("..") && !isAbsolute(childRelativePath));
};

const validatePathInput = (value: string, field: string): readonly ObsidianInstallIssue[] => {
	const normalized = normalizePathForChecks(value.trim());
	const segments = normalized.split("/");

	if (normalized.length === 0) {
		return [
			issue({
				code: "install.missing-vault-root",
				message: "Vault root path is required.",
				path: "vault-root",
				field,
				remediation: "Pass the Obsidian vault root with --vault or VOIDBRAIN_DEV_VAULT.",
			}),
		];
	}

	if (
		hasUrlScheme(normalized) ||
		hasControlCharacters(normalized) ||
		segments.includes("..") ||
		normalized.endsWith(`/.obsidian/plugins/${RELEASE_PLUGIN_ID}`) ||
		normalized === `.obsidian/plugins/${RELEASE_PLUGIN_ID}`
	) {
		return [
			issue({
				code: "install.invalid-target-path",
				message: "Vault root must be a filesystem vault root, not a URL, traversal path, or plugin folder.",
				path: "vault-root",
				field,
				remediation: "Pass the vault root; the deploy workflow appends .obsidian/plugins/voidbrain itself.",
			}),
		];
	}

	return [];
};

export const resolveObsidianInstallTarget = async (
	options: ObsidianInstallOptions,
	filesystem: ObsidianInstallFilesystem = defaultFilesystem,
): Promise<TargetResolution> => {
	const issues: ObsidianInstallIssue[] = [...validatePathInput(options.vaultRoot, "vaultRoot")];
	if (issues.length > 0) {
		return {
			target: null,
			shouldCreateObsidianFolder: false,
			issues: sortIssues(issues),
		};
	}

	const vaultRootAbsolutePath = resolve(options.vaultRoot);
	const obsidianDirAbsolutePath = join(vaultRootAbsolutePath, ".obsidian");
	const pluginDirAbsolutePath = join(obsidianDirAbsolutePath, "plugins", RELEASE_PLUGIN_ID);

	if (
		!isPathInside(vaultRootAbsolutePath, obsidianDirAbsolutePath) ||
		!isPathInside(vaultRootAbsolutePath, pluginDirAbsolutePath) ||
		normalizePathForChecks(relative(vaultRootAbsolutePath, pluginDirAbsolutePath)) !==
			OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH
	) {
		return {
			target: null,
			shouldCreateObsidianFolder: false,
			issues: [
				issue({
					code: "install.invalid-target-path",
					message: "Resolved plugin target escaped the expected vault plugin boundary.",
					path: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
					remediation: "Use a normal Obsidian vault root and retry.",
				}),
			],
		};
	}

	const vaultInfo = await filesystem.fileInfo(vaultRootAbsolutePath);
	if (!vaultInfo.exists) {
		issues.push(
			issue({
				code: "install.missing-vault-root",
				message: "Vault root does not exist.",
				path: "vault-root",
				remediation: "Create the vault root or pass the correct --vault path.",
			}),
		);
	} else if (!vaultInfo.isDirectory) {
		issues.push(
			issue({
				code: "install.invalid-vault-root",
				message: "Vault root is not a directory.",
				path: "vault-root",
				remediation: "Pass an Obsidian vault directory, not a file.",
			}),
		);
	}

	const obsidianInfo = await filesystem.fileInfo(obsidianDirAbsolutePath);
	let shouldCreateObsidianFolder = false;
	if (!obsidianInfo.exists) {
		if (options.createObsidianFolder) {
			shouldCreateObsidianFolder = true;
		} else {
			issues.push(
				issue({
					code: "install.missing-obsidian-folder",
					message: "Vault root is missing .obsidian/.",
					path: ".obsidian",
					remediation: "Open the vault in Obsidian first or rerun with --create-obsidian-folder.",
				}),
			);
		}
	} else if (!obsidianInfo.isDirectory) {
		issues.push(
			issue({
				code: "install.invalid-target-path",
				message: ".obsidian exists but is not a directory.",
				path: ".obsidian",
				remediation: "Restore .obsidian as a directory before deploying the plugin.",
			}),
		);
	}

	return {
		target: {
			vaultRootAbsolutePath,
			obsidianDirAbsolutePath,
			pluginDirAbsolutePath,
			pluginRelativePath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
		},
		shouldCreateObsidianFolder,
		issues: sortIssues(issues),
	};
};

export const readInstalledObsidianManifest = async (
	target: ObsidianInstallTargetPaths,
	filesystem: ObsidianInstallFilesystem = defaultFilesystem,
): Promise<ManifestReadResult> => {
	const manifestPath = join(target.pluginDirAbsolutePath, "manifest.json");
	const manifestInfo = await filesystem.fileInfo(manifestPath);

	if (!manifestInfo.exists) {
		return {
			manifest: null,
			issues: [],
		};
	}

	if (!manifestInfo.isFile) {
		return {
			manifest: null,
			issues: [
				issue({
					code: "install.invalid-installed-manifest",
					message: "Installed plugin manifest path exists but is not a file.",
					path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
					remediation: "Remove or replace the invalid installed manifest before retrying.",
				}),
			],
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(await filesystem.readTextFile(manifestPath)) as unknown;
	} catch {
		return {
			manifest: null,
			issues: [
				issue({
					code: "install.invalid-installed-manifest",
					message: "Installed plugin manifest could not be parsed as JSON.",
					path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
					remediation: "Fix or remove the installed plugin manifest before retrying.",
				}),
			],
		};
	}

	if (!isRecord(parsed) || typeof parsed.id !== "string" || typeof parsed.version !== "string") {
		return {
			manifest: null,
			issues: [
				issue({
					code: "install.invalid-installed-manifest",
					message: "Installed plugin manifest is missing required string fields.",
					path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
					expected: ["id", "version"],
					remediation: "Restore a valid Obsidian plugin manifest before retrying.",
				}),
			],
		};
	}

	if (parsed.id !== RELEASE_PLUGIN_ID) {
		return {
			manifest: null,
			issues: [
				issue({
					code: "install.invalid-installed-manifest",
					message: "Installed plugin manifest does not match the Voidbrain plugin ID.",
					path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
					field: "id",
					expected: RELEASE_PLUGIN_ID,
					actual: parsed.id,
					remediation:
						"Verify the target vault path and remove the conflicting plugin folder before retrying.",
				}),
			],
		};
	}

	return {
		manifest: {
			id: parsed.id,
			version: parsed.version,
			minAppVersion: typeof parsed.minAppVersion === "string" ? parsed.minAppVersion : null,
		},
		issues: [],
	};
};

const compareVersions = (left: string, right: string): -1 | 0 | 1 | null => {
	const leftMatch = left.match(versionPattern);
	const rightMatch = right.match(versionPattern);
	if (leftMatch === null || rightMatch === null) {
		return null;
	}

	const leftParts = leftMatch.slice(1).map((value) => Number(value));
	const rightParts = rightMatch.slice(1).map((value) => Number(value));
	for (let index = 0; index < leftParts.length; index += 1) {
		const leftPart = leftParts[index];
		const rightPart = rightParts[index];
		if (leftPart === undefined || rightPart === undefined) {
			return null;
		}
		if (leftPart < rightPart) {
			return -1;
		}
		if (leftPart > rightPart) {
			return 1;
		}
	}
	return 0;
};

const classifyOperation = (
	installedVersion: string | null,
	incomingVersion: string | null,
	hasInvalidInstalledManifest: boolean,
	allowDowngrade: boolean,
): { readonly operationKind: ObsidianInstallOperationKind; readonly issues: readonly ObsidianInstallIssue[] } => {
	if (hasInvalidInstalledManifest) {
		return {
			operationKind: "invalid-existing-install",
			issues: [],
		};
	}

	if (incomingVersion === null) {
		return {
			operationKind: installedVersion === null ? "fresh-install" : "upgrade",
			issues: [
				issue({
					code: "install.release-validation-failed",
					message: "Incoming plugin version is unavailable because release validation did not pass.",
					path: "release-diagnostic",
					remediation: "Run bun run build and bun run validate:release-artifacts before deploying.",
				}),
			],
		};
	}

	if (installedVersion === null) {
		return {
			operationKind: "fresh-install",
			issues: [],
		};
	}

	const comparison = compareVersions(installedVersion, incomingVersion);
	if (comparison === null) {
		return {
			operationKind: installedVersion === incomingVersion ? "reinstall" : "upgrade",
			issues:
				installedVersion === incomingVersion
					? []
					: [
							issue({
								code: "install.version-compare-unknown",
								message: "Installed and incoming versions could not be compared conservatively.",
								path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
								field: "version",
								remediation:
									"Use numeric plugin versions or review the install/update plan manually before retrying.",
							}),
						],
		};
	}

	if (comparison === 0) {
		return {
			operationKind: "reinstall",
			issues: [],
		};
	}

	if (comparison < 0) {
		return {
			operationKind: "upgrade",
			issues: [],
		};
	}

	return {
		operationKind: "downgrade",
		issues: allowDowngrade
			? []
			: [
					issue({
						code: "install.downgrade-blocked",
						message: "Incoming plugin version is lower than the installed version.",
						path: `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/manifest.json`,
						field: "version",
						remediation: "Rerun with --allow-downgrade only after reviewing the rollback intent.",
					}),
				],
	};
};

const releaseArtifactLookup = (releaseValidation: ReleaseValidationResult): ObsidianInstallReleaseArtifactLookup =>
	new Map(releaseValidation.artifacts.map((artifact) => [artifact.name, artifact]));

const validateArtifactPath = (
	artifactName: ReleaseArtifactName,
	sourcePath: string,
	targetPath: string,
): readonly ObsidianInstallIssue[] => {
	const sourceSegments = normalizePathForChecks(sourcePath).split("/");
	const targetSegments = normalizePathForChecks(targetPath).split("/");

	if (
		sourcePath.trim().length === 0 ||
		targetPath.trim().length === 0 ||
		sourceSegments.includes("..") ||
		targetSegments.includes("..") ||
		hasUrlScheme(sourcePath) ||
		hasUrlScheme(targetPath) ||
		hasControlCharacters(sourcePath) ||
		hasControlCharacters(targetPath)
	) {
		return [
			issue({
				code: "install.unsupported-artifact",
				message: "Artifact copy path is not bounded to the release contract.",
				path: artifactName,
				remediation: "Use repository-relative artifact paths and plugin-relative target paths only.",
			}),
		];
	}

	return [];
};

const createArtifactPlans = (
	options: ObsidianInstallOptions,
	target: ObsidianInstallTargetPaths | null,
	releaseValidation: ReleaseValidationResult,
): { readonly artifacts: readonly ObsidianInstallArtifactPlan[]; readonly issues: readonly ObsidianInstallIssue[] } => {
	if (target === null) {
		return {
			artifacts: [],
			issues: [],
		};
	}

	const issues: ObsidianInstallIssue[] = [];
	const artifacts: ObsidianInstallArtifactPlan[] = [];
	const artifactLookup = releaseArtifactLookup(releaseValidation);

	for (const contract of RELEASE_ARTIFACT_CONTRACT) {
		const diagnostic = artifactLookup.get(contract.name);
		if (diagnostic === undefined) {
			issues.push(
				issue({
					code: "install.missing-artifact",
					message: "Release validation did not provide a required deploy artifact.",
					path: contract.repositoryPath,
					remediation: "Run bun run build and bun run validate:release-artifacts before deploying.",
				}),
			);
			continue;
		}

		const targetPath = `${OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH}/${contract.name}`;
		issues.push(...validateArtifactPath(contract.name, contract.repositoryPath, targetPath));
		artifacts.push({
			name: contract.name,
			sourcePath: contract.repositoryPath,
			targetPath,
			sourceAbsolutePath: join(options.repoRoot, contract.repositoryPath),
			targetAbsolutePath: join(target.pluginDirAbsolutePath, contract.name),
			sizeBytes: diagnostic.sizeBytes,
			checksum: diagnostic.checksum,
		});
	}

	return {
		artifacts,
		issues: sortIssues(issues),
	};
};

const releaseValidationIssue = (releaseValidation: ReleaseValidationResult): readonly ObsidianInstallIssue[] => {
	if (releaseValidation.ok) {
		return [];
	}

	return [
		issue({
			code: "install.release-validation-failed",
			message: "Release artifact validation failed before install/update planning.",
			path: "release-diagnostic",
			actual: releaseValidation.issues
				.map((releaseIssue) => releaseIssue.code)
				.sort((left, right) => left.localeCompare(right)),
			remediation: "Run bun run build and bun run validate:release-artifacts, then retry the deploy workflow.",
		}),
	];
};

const createRollbackIntent = (
	operationKind: ObsidianInstallOperationKind,
	installedVersion: string | null,
	artifacts: readonly ObsidianInstallArtifactPlan[],
	clean: boolean,
): ObsidianInstallRollbackIntent => {
	const shouldBackUp =
		clean ||
		operationKind === "upgrade" ||
		operationKind === "reinstall" ||
		operationKind === "downgrade" ||
		operationKind === "invalid-existing-install";

	if (!shouldBackUp) {
		return {
			mode: "none",
			reason: "No installed plugin artifacts were detected for a fresh install plan.",
			targetPath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
			artifactPaths: artifacts.map((artifact) => artifact.targetPath),
			backupDirectoryName: null,
		};
	}

	const versionLabel = installedVersion ?? "invalid-installed-manifest";
	return {
		mode: "backup-existing-plugin-artifacts",
		reason: "Existing plugin artifacts may need plugin-only rollback if deploy execution fails.",
		targetPath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
		artifactPaths: artifacts.map((artifact) => artifact.targetPath),
		backupDirectoryName: `voidbrain-plugin-backup-${versionLabel}`,
	};
};

const actionDiagnostics = (
	artifacts: readonly ObsidianInstallArtifactPlan[],
	cleanActions: readonly ObsidianInstallArtifactPlan[],
	shouldCreateObsidianFolder: boolean,
): readonly ObsidianInstallActionDiagnostic[] => {
	const actions: ObsidianInstallActionDiagnostic[] = [];
	if (shouldCreateObsidianFolder) {
		actions.push({
			kind: "create-obsidian-folder",
			targetPath: ".obsidian",
		});
	}

	actions.push({
		kind: "create-plugin-folder",
		targetPath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
	});

	for (const artifact of cleanActions) {
		actions.push({
			kind: "clean-artifact",
			artifactName: artifact.name,
			targetPath: artifact.targetPath,
		});
	}

	for (const artifact of artifacts) {
		actions.push({
			kind: "copy-artifact",
			artifactName: artifact.name,
			sourcePath: artifact.sourcePath,
			targetPath: artifact.targetPath,
		});
	}

	return actions;
};

const createDiagnostic = (
	operationKind: ObsidianInstallOperationKind,
	status: "ready" | "blocked",
	installedVersion: string | null,
	incomingVersion: string | null,
	releaseValidation: ReleaseValidationResult,
	rollbackIntent: ObsidianInstallRollbackIntent,
	actions: readonly ObsidianInstallActionDiagnostic[],
	issues: readonly ObsidianInstallIssue[],
): ObsidianInstallDiagnosticRecord => ({
	commandId: OBSIDIAN_INSTALL_COMMAND_ID,
	operationKind,
	status,
	targetPluginPath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
	installedVersion,
	incomingVersion,
	releaseValidation: releaseValidation.diagnostic.validationOutput,
	rollbackIntent,
	actions,
	issues: sortIssues(issues),
});

export const validateObsidianInstallDiagnosticSafety = (
	input: unknown,
	path = "obsidian-install-diagnostic",
): ObsidianInstallDiagnosticSafetyResult => {
	let serialized: string;
	try {
		serialized = JSON.stringify(input);
	} catch (error) {
		return {
			ok: false,
			issues: [
				issue({
					code: "install.invalid-diagnostic-input",
					message: `Install diagnostic could not be serialized safely: ${
						error instanceof Error ? error.message : String(error)
					}`,
					path,
					remediation: "Use JSON-compatible install/update diagnostic values only.",
				}),
			],
		};
	}

	if (serialized === undefined) {
		return {
			ok: false,
			issues: [
				issue({
					code: "install.invalid-diagnostic-input",
					message: "Install diagnostic did not serialize to a JSON value.",
					path,
					remediation: "Use a JSON-compatible install/update diagnostic object.",
				}),
			],
		};
	}

	const issues: ObsidianInstallIssue[] = [];
	if (secretLikeKeyPattern.test(serialized) || credentialLikeValuePattern.test(serialized)) {
		issues.push(
			issue({
				code: "install.unsafe-diagnostic-value",
				message: "Install diagnostic contains a secret-like key or credential-like value.",
				path,
				remediation:
					"Redact the value or replace it with a clearly fake placeholder before recording diagnostics.",
			}),
		);
	}

	if (privatePathHintPattern.test(serialized)) {
		issues.push(
			issue({
				code: "install.private-path-hint",
				message: "Install diagnostic contains a private local path hint.",
				path,
				remediation:
					"Use repository-relative paths, plugin-relative paths, or placeholder paths in diagnostics.",
			}),
		);
	}

	return {
		ok: issues.length === 0,
		issues: sortIssues(issues),
	};
};

export const createObsidianInstallPlan = async (request: ObsidianInstallPlanRequest): Promise<ObsidianInstallPlan> => {
	const filesystem = request.filesystem ?? defaultFilesystem;
	const targetResolution = await resolveObsidianInstallTarget(request.options, filesystem);
	const manifestResult =
		targetResolution.target === null
			? { manifest: null, issues: [] }
			: await readInstalledObsidianManifest(targetResolution.target, filesystem);
	const installedVersion = manifestResult.manifest?.version ?? null;
	const incomingVersion = request.releaseValidation.versions?.manifestVersion ?? null;
	const operation = classifyOperation(
		installedVersion,
		incomingVersion,
		manifestResult.issues.length > 0,
		request.options.allowDowngrade,
	);
	const artifactResult = createArtifactPlans(request.options, targetResolution.target, request.releaseValidation);
	const cleanActions = request.options.clean ? artifactResult.artifacts : [];
	const rollbackIntent = createRollbackIntent(
		operation.operationKind,
		installedVersion,
		artifactResult.artifacts,
		request.options.clean,
	);
	const initialIssues = sortIssues([
		...targetResolution.issues,
		...manifestResult.issues,
		...releaseValidationIssue(request.releaseValidation),
		...operation.issues,
		...artifactResult.issues,
	]);
	const initialStatus = initialIssues.length === 0 ? "ready" : "blocked";
	const initialDiagnostic = createDiagnostic(
		operation.operationKind,
		initialStatus,
		installedVersion,
		incomingVersion,
		request.releaseValidation,
		rollbackIntent,
		actionDiagnostics(artifactResult.artifacts, cleanActions, targetResolution.shouldCreateObsidianFolder),
		initialIssues,
	);
	const safety = validateObsidianInstallDiagnosticSafety(initialDiagnostic);
	const issues = sortIssues([...initialIssues, ...safety.issues]);
	const status = issues.length === 0 ? "ready" : "blocked";
	const diagnostic = createDiagnostic(
		operation.operationKind,
		status,
		installedVersion,
		incomingVersion,
		request.releaseValidation,
		rollbackIntent,
		actionDiagnostics(artifactResult.artifacts, cleanActions, targetResolution.shouldCreateObsidianFolder),
		issues,
	);

	return {
		commandId: OBSIDIAN_INSTALL_COMMAND_ID,
		status,
		operationKind: operation.operationKind,
		target: targetResolution.target,
		installedManifest: manifestResult.manifest,
		installedVersion,
		incomingVersion,
		releaseValidation: request.releaseValidation,
		artifacts: artifactResult.artifacts,
		cleanActions,
		rollbackIntent,
		issues,
		diagnostic,
	};
};

const executionIssue = (message: string): ObsidianInstallIssue =>
	issue({
		code: "install.execution-failed",
		message,
		path: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
		remediation:
			"Inspect the plugin folder permissions, rollback intent, and completed action list before retrying.",
	});

export const executeObsidianInstallPlan = async (
	plan: ObsidianInstallPlan,
	filesystem: ObsidianInstallExecutionFilesystem = defaultExecutionFilesystem,
): Promise<ObsidianInstallExecutionResult> => {
	if (isExecutingInstallPlan) {
		return {
			ok: false,
			completedActions: [],
			compensationActions: [],
			issues: [
				issue({
					code: "install.execution-in-flight",
					message: "Another Obsidian install/update execution is already in flight.",
					path: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
					remediation: "Wait for the active deploy command to finish before retrying.",
				}),
			],
		};
	}

	if (plan.status !== "ready" || plan.target === null) {
		return {
			ok: false,
			completedActions: [],
			compensationActions: [],
			issues: plan.issues,
		};
	}

	const completedActions: ObsidianInstallActionDiagnostic[] = [];
	const compensationActions: ObsidianInstallActionDiagnostic[] = [];
	isExecutingInstallPlan = true;

	try {
		await filesystem.ensureDir(plan.target.obsidianDirAbsolutePath);
		completedActions.push({
			kind: "create-obsidian-folder",
			targetPath: ".obsidian",
		});

		await filesystem.ensureDir(plan.target.pluginDirAbsolutePath);
		completedActions.push({
			kind: "create-plugin-folder",
			targetPath: OBSIDIAN_INSTALL_TARGET_RELATIVE_PATH,
		});

		for (const artifact of plan.cleanActions) {
			await filesystem.removeFile(artifact.targetAbsolutePath);
			completedActions.push({
				kind: "clean-artifact",
				artifactName: artifact.name,
				targetPath: artifact.targetPath,
			});
		}

		for (const artifact of plan.artifacts) {
			await filesystem.copyFile(artifact.sourceAbsolutePath, artifact.targetAbsolutePath);
			completedActions.push({
				kind: "copy-artifact",
				artifactName: artifact.name,
				sourcePath: artifact.sourcePath,
				targetPath: artifact.targetPath,
			});
		}

		return {
			ok: true,
			completedActions,
			compensationActions,
			issues: [],
		};
	} catch {
		for (const action of [...completedActions].reverse()) {
			if (action.kind !== "copy-artifact" || action.artifactName === undefined) {
				continue;
			}
			const artifact = plan.artifacts.find((candidate) => candidate.name === action.artifactName);
			if (artifact === undefined) {
				continue;
			}
			try {
				await filesystem.removeFile(artifact.targetAbsolutePath);
				compensationActions.push({
					kind: "clean-artifact",
					artifactName: artifact.name,
					targetPath: artifact.targetPath,
				});
			} catch {
				compensationActions.push({
					kind: "clean-artifact",
					artifactName: artifact.name,
					targetPath: artifact.targetPath,
				});
			}
		}

		return {
			ok: false,
			completedActions,
			compensationActions,
			issues: [executionIssue("Install/update execution failed before all plugin artifacts were copied.")],
		};
	} finally {
		isExecutingInstallPlan = false;
	}
};
