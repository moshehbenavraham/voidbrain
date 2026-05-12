import type { IndexingPathDiagnostic, ObsidianMarkdownSourceReadResult } from "../types/indexing-runtime";
import type { IndexingPreferences } from "../types/plugin";
import type { NormalizedVaultPath } from "../types/vault";
import { compareVaultPaths, normalizeVaultPath } from "../utils/vault-paths";

export interface ObsidianIndexFile {
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

export interface ObsidianIndexCachedMetadata {
	readonly frontmatter?: Record<string, unknown>;
}

export interface ObsidianIndexVault {
	readonly getFiles: () => readonly ObsidianIndexFile[];
	readonly read: (file: ObsidianIndexFile) => Promise<string>;
}

export interface ObsidianIndexMetadataCache {
	readonly getFileCache: (file: ObsidianIndexFile) => ObsidianIndexCachedMetadata | null;
}

export interface ObsidianMarkdownIndexSourceOptions {
	readonly vault: ObsidianIndexVault;
	readonly metadataCache?: ObsidianIndexMetadataCache;
}

export interface ObsidianMarkdownIndexSourceReadOptions {
	readonly preferences: Pick<IndexingPreferences, "excludedFolders" | "maxNoteBytes">;
	readonly signal?: AbortSignal;
}

const textEncoder = new TextEncoder();

const byteLength = (content: string): number => textEncoder.encode(content).byteLength;

const isMarkdownFile = (file: ObsidianIndexFile): boolean =>
	file.extension.toLowerCase() === "md" || file.path.toLowerCase().endsWith(".md");

const diagnostic = (
	path: NormalizedVaultPath | string,
	code: IndexingPathDiagnostic["code"],
	reason: string,
	sizeBytes?: number,
): IndexingPathDiagnostic => ({
	path,
	code,
	reason,
	...(sizeBytes === undefined ? {} : { sizeBytes }),
});

const isInsideFolder = (path: NormalizedVaultPath, folder: NormalizedVaultPath): boolean =>
	path === folder || path.startsWith(`${folder}/`);

const isExcluded = (
	path: NormalizedVaultPath,
	excludedFolders: readonly NormalizedVaultPath[],
): NormalizedVaultPath | null => {
	for (const folder of excludedFolders) {
		if (isInsideFolder(path, folder)) {
			return folder;
		}
	}

	return null;
};

const ensureNotAborted = (signal: AbortSignal | undefined): void => {
	if (signal?.aborted === true) {
		throw new Error("Runtime indexing source collection was canceled.");
	}
};

const normalizeAliasKey = (value: string): string => value.trim().toLowerCase();

const withoutMarkdownExtension = (path: NormalizedVaultPath): string => path.replace(/\.md$/iu, "");

const basenameWithoutExtension = (file: ObsidianIndexFile): string => file.basename.replace(/\.md$/iu, "");

const frontmatterAliasValues = (cache: ObsidianIndexCachedMetadata | null | undefined): readonly string[] => {
	const frontmatter = cache?.frontmatter;
	if (frontmatter === undefined) {
		return [];
	}

	const values = [frontmatter.title, frontmatter.alias, frontmatter.aliases].flatMap((value) =>
		Array.isArray(value) ? value : [value],
	);

	return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
};

const aliasEntriesForFile = (
	file: ObsidianIndexFile,
	path: NormalizedVaultPath,
	cache: ObsidianIndexCachedMetadata | null | undefined,
): readonly [string, NormalizedVaultPath][] => {
	const aliases = [withoutMarkdownExtension(path), basenameWithoutExtension(file), ...frontmatterAliasValues(cache)]
		.map(normalizeAliasKey)
		.filter((alias) => alias.length > 0);

	return [...new Set(aliases)].map((alias) => [alias, path] as const);
};

export class ObsidianMarkdownIndexSource {
	public constructor(private readonly options: ObsidianMarkdownIndexSourceOptions) {}

	public async readMarkdownNotes(
		options: ObsidianMarkdownIndexSourceReadOptions,
	): Promise<ObsidianMarkdownSourceReadResult> {
		const skippedPaths: IndexingPathDiagnostic[] = [];
		const failedPaths: IndexingPathDiagnostic[] = [];
		const notes: Array<ObsidianMarkdownSourceReadResult["notes"][number]> = [];
		const knownPaths: NormalizedVaultPath[] = [];
		const pathAliases: Record<string, NormalizedVaultPath> = {};
		const files = [...this.options.vault.getFiles()].sort((left, right) =>
			left.path.localeCompare(right.path, "en", { sensitivity: "base" }),
		);

		for (const file of files) {
			ensureNotAborted(options.signal);

			const normalized = normalizeVaultPath(file.path);
			if (!normalized.ok) {
				failedPaths.push(
					diagnostic(file.path, "invalid-path", normalized.errors[0]?.message ?? "Invalid vault path."),
				);
				continue;
			}

			if (!isMarkdownFile(file)) {
				skippedPaths.push(diagnostic(normalized.value, "non-markdown", "Only markdown notes are indexed."));
				continue;
			}

			const excludedFolder = isExcluded(normalized.value, options.preferences.excludedFolders);
			if (excludedFolder !== null) {
				skippedPaths.push(
					diagnostic(normalized.value, "excluded-folder", `Path is under excluded folder ${excludedFolder}.`),
				);
				continue;
			}

			const sizeBytes = file.stat.size;
			if (sizeBytes > options.preferences.maxNoteBytes) {
				skippedPaths.push(
					diagnostic(
						normalized.value,
						"max-note-bytes",
						"Note exceeds the configured maximum indexing size.",
						sizeBytes,
					),
				);
				continue;
			}

			try {
				const content = await this.options.vault.read(file);
				ensureNotAborted(options.signal);
				const contentSizeBytes = byteLength(content);
				if (contentSizeBytes > options.preferences.maxNoteBytes) {
					skippedPaths.push(
						diagnostic(
							normalized.value,
							"max-note-bytes",
							"Note content exceeds the configured maximum indexing size.",
							contentSizeBytes,
						),
					);
					continue;
				}

				notes.push({
					path: normalized.value,
					content,
				});
				knownPaths.push(normalized.value);

				const cache = this.options.metadataCache?.getFileCache(file);
				for (const [alias, aliasPath] of aliasEntriesForFile(file, normalized.value, cache)) {
					if (pathAliases[alias] === undefined) {
						pathAliases[alias] = aliasPath;
					}
				}
			} catch {
				if (options.signal?.aborted === true) {
					throw new Error("Runtime indexing source collection was canceled.");
				}
				failedPaths.push(diagnostic(normalized.value, "read-failed", "Vault note could not be read."));
			}
		}

		return {
			notes,
			knownPaths: [...knownPaths].sort(compareVaultPaths),
			pathAliases,
			skippedPaths,
			failedPaths,
		};
	}
}

export const createObsidianMarkdownIndexSource = (
	options: ObsidianMarkdownIndexSourceOptions,
): ObsidianMarkdownIndexSource => new ObsidianMarkdownIndexSource(options);

export const createEmptyObsidianMarkdownSourceReadResult = (): ObsidianMarkdownSourceReadResult => ({
	notes: [],
	knownPaths: [],
	pathAliases: {},
	skippedPaths: [],
	failedPaths: [],
});
