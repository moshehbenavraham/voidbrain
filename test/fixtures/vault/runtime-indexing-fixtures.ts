import { makeNormalizedVaultPath } from "../../../src/types/vault";
import type { IndexableMarkdownNote } from "../../../src/vectorstore/indexing-service";

export interface RuntimeIndexingFixtureFile {
	readonly path: string;
	readonly content: string;
	readonly ctime?: number;
	readonly mtime?: number;
	readonly size?: number;
	readonly shouldFailRead?: boolean;
}

export interface RuntimeFixtureTFile {
	readonly path: string;
	readonly name: string;
	readonly basename: string;
	readonly extension: string;
	readonly stat: {
		readonly ctime: number;
		readonly mtime: number;
		readonly size: number;
	};
}

export interface RuntimeFixtureVault {
	getFiles: () => readonly RuntimeFixtureTFile[];
	read: (file: RuntimeFixtureTFile) => Promise<string>;
}

export const RUNTIME_INDEXING_FIXTURE_MESSAGE =
	"Runtime indexing fixtures are synthetic vault notes only and contain no provider secrets or private paths.";

export const RUNTIME_INDEXING_FIXTURE_FILES: readonly RuntimeIndexingFixtureFile[] = [
	{
		path: "sources/runtime-source.md",
		content: [
			"---",
			"title: Runtime Source",
			"tags: [fixture, runtime]",
			"---",
			"# Runtime Source",
			"",
			"Local indexing reads this synthetic source through the Obsidian vault API.",
			"It links to [[runtime-concept]] and supports deterministic retrieval tests.",
		].join("\n"),
		ctime: 1,
		mtime: 10,
	},
	{
		path: "concepts/runtime-concept.md",
		content: [
			"---",
			"title: Runtime Concept",
			"aliases: [runtime-concept]",
			"tags: [fixture]",
			"---",
			"# Runtime Concept",
			"",
			"This synthetic concept explains local-first runtime indexing readiness.",
		].join("\n"),
		ctime: 2,
		mtime: 11,
	},
	{
		path: "archive/excluded-note.md",
		content: "# Excluded Note\n\nThis synthetic note should be skipped by folder filters.",
		ctime: 3,
		mtime: 12,
	},
	{
		path: "sources/oversized-note.md",
		content: "# Oversized Note\n\nThis synthetic note is skipped when maxNoteBytes is small.",
		size: 200000,
		ctime: 4,
		mtime: 13,
	},
	{
		path: "sources/read-failure.md",
		content: "# Read Failure\n\nThis content must never appear in diagnostics.",
		shouldFailRead: true,
		ctime: 5,
		mtime: 14,
	},
	{
		path: "attachments/runtime-image.png",
		content: "not markdown",
		ctime: 6,
		mtime: 15,
	},
] as const;

export const loadRuntimeIndexingFixtureNotes = (): readonly IndexableMarkdownNote[] =>
	RUNTIME_INDEXING_FIXTURE_FILES.filter((file) => file.path.endsWith(".md") && file.shouldFailRead !== true).map(
		(file) => ({
			path: makeNormalizedVaultPath(file.path),
			content: file.content,
		}),
	);

export const createRuntimeFixtureTFile = (fixture: RuntimeIndexingFixtureFile): RuntimeFixtureTFile => {
	const file = {
		path: fixture.path,
		name: fixture.path.split("/").at(-1) ?? fixture.path,
		basename: (fixture.path.split("/").at(-1) ?? fixture.path).replace(/\.md$/u, ""),
		extension: fixture.path.split(".").at(-1) ?? "",
		stat: {
			ctime: fixture.ctime ?? 0,
			mtime: fixture.mtime ?? 0,
			size: fixture.size ?? new TextEncoder().encode(fixture.content).byteLength,
		},
	};

	return file;
};

export const createRuntimeFixtureFiles = (
	fixtures: readonly RuntimeIndexingFixtureFile[] = RUNTIME_INDEXING_FIXTURE_FILES,
): readonly RuntimeFixtureTFile[] => fixtures.map(createRuntimeFixtureTFile);

export const createRuntimeFixtureReadMap = (
	fixtures: readonly RuntimeIndexingFixtureFile[] = RUNTIME_INDEXING_FIXTURE_FILES,
): ReadonlyMap<string, RuntimeIndexingFixtureFile> => new Map(fixtures.map((fixture) => [fixture.path, fixture]));

export const configureRuntimeFixtureVault = (
	vault: RuntimeFixtureVault,
	fixtures: readonly RuntimeIndexingFixtureFile[] = RUNTIME_INDEXING_FIXTURE_FILES,
): readonly RuntimeFixtureTFile[] => {
	const files = createRuntimeFixtureFiles(fixtures);
	const fixtureMap = createRuntimeFixtureReadMap(fixtures);
	vault.getFiles = () => [...files];
	vault.read = async (file: RuntimeFixtureTFile): Promise<string> => {
		const fixture = fixtureMap.get(file.path);
		if (fixture === undefined) {
			throw new Error("Synthetic fixture file is not registered.");
		}
		if (fixture.shouldFailRead === true) {
			throw new Error("Synthetic fixture read failed.");
		}

		return fixture.content;
	};

	return files;
};
