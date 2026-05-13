#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ObsidianInstallActionDiagnostic,
	ObsidianInstallIssue,
	ObsidianInstallPlan,
} from "../src/types/obsidian-install";
import { RELEASE_PLUGIN_ID } from "../src/types/release";
import { createObsidianInstallPlan, executeObsidianInstallPlan } from "../src/utils/obsidian-install-workflow";
import { validateReleaseArtifacts } from "../src/utils/release-artifacts";

const vaultEnvVar = "VOIDBRAIN_DEV_VAULT";
const defaultEnvPath = ".env";

const banner = String.raw`
 __     __  ___   ___  ____   ____   ____      _     ___  _   _
 \ \   / / / _ \ |_ _||  _ \ | __ ) |  _ \    / \   |_ _|| \ | |
  \ \ / / | | | | | | | | | ||  _ \ | |_) |  / _ \   | | |  \| |
   \ V /  | |_| | | | | |_| || |_) ||  _ <  / ___ \  | | | |\  |
    \_/    \___/ |___||____/ |____/ |_| \_\/_/   \_\|___||_| \_|

                 local-first obsidian plugin deploy
`;

interface DeployOptions {
	readonly envPath: string;
	readonly vaultPath: string | null;
	readonly skipBuild: boolean;
	readonly dryRun: boolean;
	readonly clean: boolean;
	readonly createObsidianFolder: boolean;
	readonly allowDowngrade: boolean;
	readonly help: boolean;
}

interface VaultPathResolution {
	readonly path: string;
	readonly source: "cli" | "environment" | "env-file";
}

class UsageError extends Error {
	override readonly name = "UsageError";
}

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");

const usage = (): string => `${banner}
Usage:
  bun scripts/deploy-obsidian-plugin.ts [options]
  bun run deploy:obsidian -- [options]

Options:
  --vault <path>              Use this vault root instead of ${vaultEnvVar}.
  --env <path>                Read a dotenv-style file. Default: ${defaultEnvPath}
  --skip-build                Copy the current build output without running bun run build.
  --clean                    Remove existing deploy artifacts before copying.
  --create-obsidian-folder    Create .obsidian/ if the vault folder exists without it.
  --allow-downgrade           Permit installing an older incoming version after review.
  --dry-run                   Validate inputs and print planned actions without building, copying, cleaning, or backup.
  -h, --help                  Show this help.

Environment:
  ${vaultEnvVar} must point at the Obsidian vault root, not the plugin folder.
  Final target: $${vaultEnvVar}/.obsidian/plugins/${RELEASE_PLUGIN_ID}
`;

const parseArgs = (args: readonly string[]): DeployOptions => {
	let envPath = defaultEnvPath;
	let vaultPath: string | null = null;
	let skipBuild = false;
	let dryRun = false;
	let clean = false;
	let createObsidianFolder = false;
	let allowDowngrade = false;
	let help = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		const nextValue = (flag: string): string => {
			const value = args[index + 1];
			if (value === undefined || value.startsWith("-")) {
				throw new UsageError(`${flag} requires a value.`);
			}
			index += 1;
			return value;
		};

		if (arg === "-h" || arg === "--help") {
			help = true;
		} else if (arg === "--env") {
			envPath = nextValue(arg);
		} else if (arg.startsWith("--env=")) {
			envPath = arg.slice("--env=".length);
		} else if (arg === "--vault") {
			vaultPath = nextValue(arg);
		} else if (arg.startsWith("--vault=")) {
			vaultPath = arg.slice("--vault=".length);
		} else if (arg === "--skip-build") {
			skipBuild = true;
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--clean") {
			clean = true;
		} else if (arg === "--create-obsidian-folder") {
			createObsidianFolder = true;
		} else if (arg === "--allow-downgrade") {
			allowDowngrade = true;
		} else if (!arg.startsWith("-") && vaultPath === null) {
			vaultPath = arg;
		} else {
			throw new UsageError(`Unknown option: ${arg}`);
		}
	}

	return {
		envPath,
		vaultPath,
		skipBuild,
		dryRun,
		clean,
		createObsidianFolder,
		allowDowngrade,
		help,
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

const stripInlineComment = (value: string): string => {
	const match = value.match(/\s+#/u);
	return match === null ? value.trim() : value.slice(0, match.index).trim();
};

const parseDotEnvValue = (rawValue: string): string => {
	const value = rawValue.trim();
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		return value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
	}
	if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1);
	}
	return stripInlineComment(value);
};

const loadEnvFile = async (envPath: string): Promise<ReadonlyMap<string, string>> => {
	if (!(await isReadableFile(envPath))) {
		return new Map();
	}

	const raw = await readFile(envPath, "utf8");
	const entries = new Map<string, string>();
	for (const line of raw.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue;
		}

		const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
		if (match === null) {
			continue;
		}

		entries.set(match[1], parseDotEnvValue(match[2]));
	}

	return entries;
};

const expandHome = (path: string): string => {
	if (path === "~") {
		return homedir();
	}
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
};

const resolveVaultPath = async (options: DeployOptions): Promise<VaultPathResolution> => {
	const envPath = isAbsolute(options.envPath) ? options.envPath : resolve(repoRoot, options.envPath);
	const envFile = await loadEnvFile(envPath);
	const cliVaultPath = options.vaultPath?.trim();
	const shellVaultPath = process.env[vaultEnvVar]?.trim();
	const fileVaultPath = envFile.get(vaultEnvVar)?.trim();

	const selected =
		cliVaultPath !== undefined && cliVaultPath.length > 0
			? { path: cliVaultPath, source: "cli" as const }
			: shellVaultPath !== undefined && shellVaultPath.length > 0
				? { path: shellVaultPath, source: "environment" as const }
				: fileVaultPath !== undefined && fileVaultPath.length > 0
					? { path: fileVaultPath, source: "env-file" as const }
					: null;

	if (selected === null) {
		throw new UsageError(
			`Missing vault path. Set ${vaultEnvVar} in ${options.envPath}, export it, or pass --vault <path>.`,
		);
	}

	return {
		path: resolveVaultPathValue(selected.path, selected.source === "env-file" ? dirname(envPath) : process.cwd()),
		source: selected.source,
	};
};

const resolveVaultPathValue = (path: string, baseDir: string): string => {
	const expanded = expandHome(path);
	return isAbsolute(expanded) ? resolve(expanded) : resolve(baseDir, expanded);
};

const validateRepository = async (): Promise<void> => {
	const requiredFiles = ["package.json", "manifest.json", "versions.json", "vite.config.ts"] as const;

	for (const path of requiredFiles) {
		if (!(await isReadableFile(join(repoRoot, path)))) {
			throw new UsageError(`Run from a complete Voidbrain checkout; missing ${path}.`);
		}
	}

	try {
		const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as {
			readonly name?: string;
		};
		if (packageJson.name !== RELEASE_PLUGIN_ID) {
			throw new UsageError(
				`Expected package name "${RELEASE_PLUGIN_ID}", got "${packageJson.name ?? "unknown"}".`,
			);
		}
	} catch (error) {
		if (error instanceof UsageError) {
			throw error;
		}
		throw new UsageError("Could not parse package.json while validating the deploy repository.");
	}
};

const runBuild = (): void => {
	console.log("==> Building production plugin bundle");
	const result = spawnSync("bun", ["run", "build"], {
		cwd: repoRoot,
		stdio: "inherit",
		env: process.env,
	});

	if (result.error !== undefined) {
		throw new UsageError(`Could not start bun run build: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new UsageError(`bun run build failed with exit code ${result.status ?? "unknown"}.`);
	}
};

const formatInstallIssue = (issue: ObsidianInstallIssue): string => {
	const location = [issue.path, issue.field].filter((value) => value !== undefined).join("#");
	const actual =
		issue.actual === undefined
			? ""
			: ` Actual: ${Array.isArray(issue.actual) ? issue.actual.join(", ") : String(issue.actual)}.`;
	return `[${issue.code}] ${location.length > 0 ? `${location}: ` : ""}${issue.message}${actual} ${issue.remediation}`;
};

const formatAction = (action: ObsidianInstallActionDiagnostic, prefix: string): string => {
	if (action.kind === "copy-artifact") {
		return `${prefix} copy ${action.artifactName ?? "artifact"}: ${action.sourcePath ?? "release-artifact"} -> ${
			action.targetPath
		}`;
	}
	if (action.kind === "clean-artifact") {
		return `${prefix} clean ${action.artifactName ?? "artifact"}: ${action.targetPath}`;
	}
	if (action.kind === "backup-existing-artifact") {
		return `${prefix} backup ${action.artifactName ?? "artifact"}: ${action.targetPath}`;
	}
	return `${prefix} ensure ${action.targetPath}`;
};

const printInstallPlan = (plan: ObsidianInstallPlan): void => {
	console.log("==> Install/update plan");
	console.log(`    command: ${plan.commandId}`);
	console.log(`    status: ${plan.status}`);
	console.log(`    operation: ${plan.operationKind}`);
	console.log(`    target: ${plan.diagnostic.targetPluginPath}`);
	console.log(`    installed version: ${plan.installedVersion ?? "none"}`);
	console.log(`    incoming version: ${plan.incomingVersion ?? "unknown"}`);
	console.log(`    release validation: ${plan.diagnostic.releaseValidation.status}`);
	console.log(`    rollback intent: ${plan.rollbackIntent.mode}`);

	if (plan.issues.length > 0) {
		console.log("==> Plan issues");
		for (const issue of plan.issues) {
			console.log(`    ${formatInstallIssue(issue)}`);
		}
		return;
	}

	console.log("==> Planned actions");
	for (const action of plan.diagnostic.actions) {
		console.log(`    ${formatAction(action, "would")}`);
	}
};

const formatPlanFailure = (plan: ObsidianInstallPlan): string => {
	const issueSummary = plan.issues.map((issue) => issue.code).join(", ");
	return `Install/update plan blocked: ${issueSummary}. Review the plan issues above and rerun after remediation.`;
};

const runDeploy = async (options: DeployOptions): Promise<void> => {
	if (options.help) {
		console.log(usage());
		return;
	}

	console.log(banner);
	await validateRepository();

	const vault = await resolveVaultPath(options);

	console.log(`==> Vault path source: ${vault.source}`);
	console.log(`==> Target plugin dir: .obsidian/plugins/${RELEASE_PLUGIN_ID}`);

	if (options.dryRun) {
		console.log("==> Dry run only; no build, copy, clean, backup, or vault mutation will run.");
	}

	if (!options.dryRun && !options.skipBuild) {
		runBuild();
	} else if (!options.dryRun) {
		console.log("==> Skipping build; using existing build/voidbrain artifacts");
	}

	const releaseValidation = await validateReleaseArtifacts({ repoRoot });
	const plan = await createObsidianInstallPlan({
		options: {
			repoRoot,
			vaultRoot: vault.path,
			createObsidianFolder: options.createObsidianFolder,
			clean: options.clean,
			dryRun: options.dryRun,
			allowDowngrade: options.allowDowngrade,
		},
		releaseValidation,
	});
	printInstallPlan(plan);

	if (options.dryRun) {
		if (plan.status !== "ready") {
			throw new UsageError(formatPlanFailure(plan));
		}
		return;
	}

	if (plan.status !== "ready") {
		throw new UsageError(formatPlanFailure(plan));
	}

	console.log("==> Executing plugin artifact deploy");
	const execution = await executeObsidianInstallPlan(plan);
	if (!execution.ok) {
		for (const issue of execution.issues) {
			console.error(`    ${formatInstallIssue(issue)}`);
		}
		throw new UsageError("Install/update execution failed. Review rollback intent and completed actions above.");
	}

	for (const action of execution.completedActions) {
		console.log(`    ${formatAction(action, "did")}`);
	}

	console.log("");
	console.log("Deploy complete. Reload Obsidian or disable/enable the Voidbrain plugin to pick up changes.");
};

try {
	await runDeploy(parseArgs(process.argv.slice(2)));
} catch (error) {
	console.error("");
	if (error instanceof UsageError) {
		console.error(`Deploy failed: ${error.message}`);
		console.error("");
		console.error("Run with --help for options.");
		process.exitCode = 1;
	} else {
		console.error(`Deploy failed unexpectedly: ${error instanceof Error ? error.name : "UnknownError"}.`);
		process.exitCode = 1;
	}
}
