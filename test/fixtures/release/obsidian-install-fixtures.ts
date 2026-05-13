import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RELEASE_PLUGIN_ID, type ReleaseManifestMetadata } from "../../../src/types/release";
import { type ReleaseFixtureOptions, createReleaseFixtureRepo } from "./release-artifacts-fixtures";

export const OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION = "9.9.8";
export const OBSIDIAN_INSTALL_FIXTURE_TARGET = "fixtures/demo-vault/.obsidian/plugins/voidbrain";

export interface FakeVaultOptions {
	readonly createObsidianFolder?: boolean;
	readonly createPluginFolder?: boolean;
	readonly installedManifest?: Partial<ReleaseManifestMetadata> | string;
	readonly extraPluginFiles?: Readonly<Record<string, string>>;
}

export interface ObsidianInstallFixtureEnvironment {
	readonly repoRoot: string;
	readonly vaultRoot: string;
	readonly pluginDir: string;
	readonly cleanup: () => void;
}

const writeTextFile = (path: string, content: string): void => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
};

const writeJsonFile = (path: string, value: unknown): void => {
	writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

export const fakeVaultPaths = (vaultRoot: string): { readonly obsidianDir: string; readonly pluginDir: string } => ({
	obsidianDir: join(vaultRoot, ".obsidian"),
	pluginDir: join(vaultRoot, ".obsidian", "plugins", RELEASE_PLUGIN_ID),
});

export const createFakeVault = (vaultRoot: string, options: FakeVaultOptions = {}): string => {
	const paths = fakeVaultPaths(vaultRoot);
	mkdirSync(vaultRoot, { recursive: true });

	if (options.createObsidianFolder ?? true) {
		mkdirSync(paths.obsidianDir, { recursive: true });
	}

	const shouldCreatePluginFolder =
		options.createPluginFolder ??
		(options.installedManifest !== undefined || options.extraPluginFiles !== undefined);
	if (shouldCreatePluginFolder) {
		mkdirSync(paths.pluginDir, { recursive: true });
	}

	if (options.installedManifest !== undefined) {
		if (typeof options.installedManifest === "string") {
			writeTextFile(join(paths.pluginDir, "manifest.json"), options.installedManifest);
		} else {
			writeJsonFile(join(paths.pluginDir, "manifest.json"), {
				id: options.installedManifest.id ?? RELEASE_PLUGIN_ID,
				name: options.installedManifest.name ?? "Voidbrain Fixture",
				version: options.installedManifest.version ?? OBSIDIAN_INSTALL_FIXTURE_INSTALLED_VERSION,
				minAppVersion: options.installedManifest.minAppVersion ?? "1.5.0",
			});
		}
	}

	for (const [relativePath, content] of Object.entries(options.extraPluginFiles ?? {})) {
		writeTextFile(join(paths.pluginDir, relativePath), content);
	}

	return paths.pluginDir;
};

export const createObsidianInstallFixtureEnvironment = (
	baseDir: string,
	releaseOptions: ReleaseFixtureOptions = {},
	vaultOptions: FakeVaultOptions = {},
): ObsidianInstallFixtureEnvironment => {
	const repoRoot = join(baseDir, "repo");
	const vaultRoot = join(baseDir, "fixtures", "demo-vault");
	createReleaseFixtureRepo(repoRoot, releaseOptions);
	const pluginDir = createFakeVault(vaultRoot, vaultOptions);

	return {
		repoRoot,
		vaultRoot,
		pluginDir,
		cleanup: () => {
			rmSync(baseDir, { recursive: true, force: true });
		},
	};
};
