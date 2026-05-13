#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginId = "voidbrain";
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
	readonly help: boolean;
}

interface VaultPathResolution {
	readonly path: string;
	readonly source: "cli" | "environment" | "env-file";
}

interface ArtifactCopy {
	readonly label: string;
	readonly from: string;
	readonly to: string;
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
  --dry-run                   Validate inputs and print planned actions without building or copying.
  -h, --help                  Show this help.

Environment:
  ${vaultEnvVar} must point at the Obsidian vault root, not the plugin folder.
  Final target: $${vaultEnvVar}/.obsidian/plugins/${pluginId}
`;

const parseArgs = (args: readonly string[]): DeployOptions => {
	let envPath = defaultEnvPath;
	let vaultPath: string | null = null;
	let skipBuild = false;
	let dryRun = false;
	let clean = false;
	let createObsidianFolder = false;
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

const isDirectory = async (path: string): Promise<boolean> => {
	try {
		return (await stat(path)).isDirectory();
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
	const packageJsonPath = join(repoRoot, "package.json");
	const manifestPath = join(repoRoot, "manifest.json");
	const versionsPath = join(repoRoot, "versions.json");
	const viteConfigPath = join(repoRoot, "vite.config.ts");

	for (const path of [packageJsonPath, manifestPath, versionsPath, viteConfigPath]) {
		if (!(await isReadableFile(path))) {
			throw new UsageError(`Run from a complete Voidbrain checkout; missing ${path}.`);
		}
	}

	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { readonly name?: string };
	if (packageJson.name !== pluginId) {
		throw new UsageError(`Expected package name "${pluginId}", got "${packageJson.name ?? "unknown"}".`);
	}
};

const validateVault = async (vaultRoot: string, createObsidianFolder: boolean, dryRun: boolean): Promise<string> => {
	if (!(await isDirectory(vaultRoot))) {
		throw new UsageError(`Vault root does not exist or is not a directory: ${vaultRoot}`);
	}

	const obsidianDir = join(vaultRoot, ".obsidian");
	if (!(await isDirectory(obsidianDir))) {
		if (!createObsidianFolder) {
			throw new UsageError(
				"Vault root is missing .obsidian/. Open it in Obsidian first or rerun with --create-obsidian-folder.",
			);
		}

		if (!dryRun) {
			await mkdir(obsidianDir, { recursive: true });
		}
	}

	return join(obsidianDir, "plugins", pluginId);
};

const buildArtifacts = (pluginDir: string): readonly ArtifactCopy[] => {
	const buildDir = join(repoRoot, "build", pluginId);
	return [
		{
			label: "main.js",
			from: join(buildDir, "main.js"),
			to: join(pluginDir, "main.js"),
		},
		{
			label: "styles.css",
			from: join(buildDir, "styles.css"),
			to: join(pluginDir, "styles.css"),
		},
		{
			label: "manifest.json",
			from: join(repoRoot, "manifest.json"),
			to: join(pluginDir, "manifest.json"),
		},
		{
			label: "versions.json",
			from: join(repoRoot, "versions.json"),
			to: join(pluginDir, "versions.json"),
		},
	];
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

const verifyArtifacts = async (artifacts: readonly ArtifactCopy[]): Promise<void> => {
	const missing: string[] = [];
	for (const artifact of artifacts) {
		if (!(await isReadableFile(artifact.from))) {
			missing.push(artifact.from);
		}
	}

	if (missing.length > 0) {
		throw new UsageError(
			`Missing deploy artifact(s): ${missing.join(", ")}. Run bun run build or retry without --skip-build.`,
		);
	}
};

const cleanArtifacts = async (artifacts: readonly ArtifactCopy[]): Promise<void> => {
	console.log("==> Cleaning previous deploy artifacts");
	for (const artifact of artifacts) {
		await rm(artifact.to, { force: true });
	}
};

const copyArtifacts = async (pluginDir: string, artifacts: readonly ArtifactCopy[]): Promise<void> => {
	console.log("==> Copying plugin artifacts");
	await mkdir(pluginDir, { recursive: true });
	for (const artifact of artifacts) {
		await copyFile(artifact.from, artifact.to);
		const deployedStat = await stat(artifact.to);
		console.log(`    ${artifact.label} -> ${deployedStat.size} bytes`);
	}
};

const runDeploy = async (options: DeployOptions): Promise<void> => {
	if (options.help) {
		console.log(usage());
		return;
	}

	console.log(banner);
	await validateRepository();

	const vault = await resolveVaultPath(options);
	const pluginDir = await validateVault(vault.path, options.createObsidianFolder, options.dryRun);
	const artifacts = buildArtifacts(pluginDir);

	console.log(`==> Vault path source: ${vault.source}`);
	console.log(`==> Target plugin dir: ${pluginDir}`);

	if (options.dryRun) {
		console.log("==> Dry run only; no build or copy will run.");
		for (const artifact of artifacts) {
			console.log(`    would copy ${artifact.label}: ${artifact.from} -> ${artifact.to}`);
		}
		return;
	}

	if (!options.skipBuild) {
		runBuild();
	} else {
		console.log("==> Skipping build; using existing build/voidbrain artifacts");
	}

	await verifyArtifacts(artifacts);
	if (options.clean) {
		await cleanArtifacts(artifacts);
	}
	await copyArtifacts(pluginDir, artifacts);

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
		console.error(error instanceof Error ? error.stack : String(error));
		process.exitCode = 1;
	}
}
