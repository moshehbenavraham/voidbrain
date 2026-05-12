import { makeNormalizedVaultPath } from "../../../src/types/vault";
import type { IndexableMarkdownNote } from "../../../src/vectorstore/indexing-service";
import type { MarkdownParseOptions } from "../../../src/vectorstore/markdown-parser";
import conceptNote from "./concepts/local-first-vaults.md?raw";
import conversationNote from "./conversations/2026-05-12-demo-chat.md?raw";
import entityNote from "./entities/demo-researcher.md?raw";
import sourceNote from "./sources/demo-article.md?raw";
import summaryNote from "./summaries/demo-article-summary.md?raw";

export const INDEXING_FIXTURE_NOTE_MESSAGE =
	"Indexing fixtures are synthetic notes only. They contain no provider secrets, tokens, personal vault content, or live provider payloads.";

export const INDEXING_FIXTURE_NOTES: readonly IndexableMarkdownNote[] = [
	{ path: makeNormalizedVaultPath("concepts/local-first-vaults.md"), content: conceptNote },
	{ path: makeNormalizedVaultPath("conversations/2026-05-12-demo-chat.md"), content: conversationNote },
	{ path: makeNormalizedVaultPath("entities/demo-researcher.md"), content: entityNote },
	{ path: makeNormalizedVaultPath("sources/demo-article.md"), content: sourceNote },
	{ path: makeNormalizedVaultPath("summaries/demo-article-summary.md"), content: summaryNote },
] as const;

export const INDEXING_KNOWN_PATHS = INDEXING_FIXTURE_NOTES.map((note) =>
	typeof note.path === "string" ? makeNormalizedVaultPath(note.path) : note.path,
);

export const INDEXING_PATH_ALIASES: MarkdownParseOptions["pathAliases"] = {
	"demo article about local vaults": makeNormalizedVaultPath("sources/demo-article.md"),
	"demo researcher": makeNormalizedVaultPath("entities/demo-researcher.md"),
	"demo-article": makeNormalizedVaultPath("sources/demo-article.md"),
	"demo-researcher": makeNormalizedVaultPath("entities/demo-researcher.md"),
	"local-first-vaults": makeNormalizedVaultPath("concepts/local-first-vaults.md"),
};

export const INDEXING_PARSE_OPTIONS: MarkdownParseOptions = {
	knownPaths: INDEXING_KNOWN_PATHS,
	pathAliases: INDEXING_PATH_ALIASES,
};

export const loadIndexingFixtureNotes = (): readonly IndexableMarkdownNote[] =>
	INDEXING_FIXTURE_NOTES.map((note) => ({
		path: note.path,
		content: note.content,
	}));
