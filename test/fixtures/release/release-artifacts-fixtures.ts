import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	RELEASE_ARTIFACT_NAMES,
	RELEASE_BUILD_DIR,
	RELEASE_PLUGIN_ID,
	type ReleaseArtifactName,
	type ReleaseVersionMap,
} from "../../../src/types/release";

export const RELEASE_FIXTURE_VERSION = "9.9.9";
export const RELEASE_FIXTURE_MIN_APP_VERSION = "1.5.0";

export interface ReleaseFixtureOptions {
	readonly packageName?: string;
	readonly packageVersion?: string;
	readonly manifestId?: string;
	readonly manifestVersion?: string;
	readonly minAppVersion?: string;
	readonly versionMap?: ReleaseVersionMap;
	readonly packageFiles?: readonly string[];
	readonly omitArtifacts?: readonly ReleaseArtifactName[];
	readonly extraBuildFiles?: Readonly<Record<string, string>>;
}

export interface ReleaseFixturePaths {
	readonly packageJson: string;
	readonly manifestJson: string;
	readonly versionsJson: string;
	readonly buildDir: string;
	readonly mainJs: string;
	readonly stylesCss: string;
}

const writeTextFile = (path: string, content: string): void => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
};

const writeJsonFile = (path: string, value: unknown): void => {
	writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

export const releaseFixturePaths = (repoRoot: string): ReleaseFixturePaths => ({
	packageJson: join(repoRoot, "package.json"),
	manifestJson: join(repoRoot, "manifest.json"),
	versionsJson: join(repoRoot, "versions.json"),
	buildDir: join(repoRoot, RELEASE_BUILD_DIR),
	mainJs: join(repoRoot, RELEASE_BUILD_DIR, "main.js"),
	stylesCss: join(repoRoot, RELEASE_BUILD_DIR, "styles.css"),
});

export const createReleaseFixtureRepo = (
	repoRoot: string,
	options: ReleaseFixtureOptions = {},
): ReleaseFixturePaths => {
	const version = options.packageVersion ?? RELEASE_FIXTURE_VERSION;
	const manifestVersion = options.manifestVersion ?? version;
	const minAppVersion = options.minAppVersion ?? RELEASE_FIXTURE_MIN_APP_VERSION;
	const paths = releaseFixturePaths(repoRoot);
	const omittedArtifacts = new Set(options.omitArtifacts ?? []);

	writeJsonFile(paths.packageJson, {
		name: options.packageName ?? RELEASE_PLUGIN_ID,
		version,
		main: "main.js",
		files: options.packageFiles ?? RELEASE_ARTIFACT_NAMES,
	});

	writeJsonFile(paths.manifestJson, {
		id: options.manifestId ?? RELEASE_PLUGIN_ID,
		name: "Voidbrain Fixture",
		version: manifestVersion,
		minAppVersion,
		description: "Synthetic release fixture.",
		author: "Fixture contributors",
		isDesktopOnly: true,
	});

	writeJsonFile(paths.versionsJson, options.versionMap ?? { [manifestVersion]: minAppVersion });

	if (!omittedArtifacts.has("main.js")) {
		writeTextFile(paths.mainJs, "module.exports = { fixture: true };\n");
	}

	if (!omittedArtifacts.has("styles.css")) {
		writeTextFile(paths.stylesCss, ".voidbrain-fixture { display: block; }\n");
	}

	for (const [relativePath, content] of Object.entries(options.extraBuildFiles ?? {})) {
		writeTextFile(join(paths.buildDir, relativePath), content);
	}

	return paths;
};

export const removeReleaseFixtureArtifact = (repoRoot: string, artifactName: ReleaseArtifactName): void => {
	const paths = releaseFixturePaths(repoRoot);
	const artifactPath =
		artifactName === "main.js"
			? paths.mainJs
			: artifactName === "styles.css"
				? paths.stylesCss
				: artifactName === "manifest.json"
					? paths.manifestJson
					: paths.versionsJson;

	rmSync(artifactPath, { force: true });
};
