import type { NormalizedVaultPath } from "../../../src/types/vault";
import { makeNormalizedVaultPath } from "../../../src/types/vault";
import type { IndexableMarkdownNote } from "../../../src/vectorstore/indexing-service";

export interface ChatFixtureFile {
	readonly path: string;
	readonly content: string;
	readonly ctime?: number;
	readonly mtime?: number;
}

export interface ExpectedChatCitationFixture {
	readonly vaultPath: NormalizedVaultPath;
	readonly heading: string | null;
	readonly sourcePaths: readonly NormalizedVaultPath[];
}

export const CHAT_FIXTURE_MESSAGE =
	"Grounded chat fixtures are synthetic vault notes only and contain no provider credentials or private paths.";

export const CHAT_FIXTURE_FILES: readonly ChatFixtureFile[] = [
	{
		path: "sources/chat-source.md",
		content: [
			"---",
			"title: Chat Source",
			"tags: [fixture, chat]",
			"---",
			"# Chat Source",
			"",
			"Grounded vault chat answers must cite retrieved synthetic source notes.",
			"The chat workflow previews evidence before any provider synthesis runs.",
			"",
			"## Privacy Gate",
			"",
			"Cloud provider synthesis requires explicit review before private vault content leaves the device.",
		].join("\n"),
		ctime: 1,
		mtime: 10,
	},
	{
		path: "concepts/citation-check.md",
		content: [
			"---",
			"title: Citation Check",
			"tags: [fixture, citation]",
			"---",
			"# Citation Check",
			"",
			"Every ready answer needs citations with a vault path, optional heading, chunk id, score, and source path.",
			"Retrieval previews expose snippets so the user can inspect answer evidence.",
		].join("\n"),
		ctime: 2,
		mtime: 11,
	},
	{
		path: "notes/branch-retry.md",
		content: [
			"# Branch Retry",
			"",
			"Recoverable chat state preserves draft text, retry counts, branch parents, and provider denial codes.",
			"Duplicate ask and retry actions stay blocked while a turn is in flight.",
		].join("\n"),
		ctime: 3,
		mtime: 12,
	},
	{
		path: "notes/weak-match.md",
		content: [
			"# Weak Match",
			"",
			"This synthetic note intentionally avoids the primary grounded chat query terms.",
			"It supports weak retrieval and empty evidence test cases.",
		].join("\n"),
		ctime: 4,
		mtime: 13,
	},
] as const;

export const CHAT_FIXTURE_QUESTION = "How does grounded vault chat protect private evidence?";
export const CHAT_FIXTURE_WEAK_QUESTION = "unmatched orchard lantern";

export const EXPECTED_CHAT_CITATIONS: readonly ExpectedChatCitationFixture[] = [
	{
		vaultPath: makeNormalizedVaultPath("sources/chat-source.md"),
		heading: "Privacy Gate",
		sourcePaths: [makeNormalizedVaultPath("sources/chat-source.md")],
	},
	{
		vaultPath: makeNormalizedVaultPath("concepts/citation-check.md"),
		heading: "Citation Check",
		sourcePaths: [makeNormalizedVaultPath("concepts/citation-check.md")],
	},
];

export const loadChatFixtureNotes = (): readonly IndexableMarkdownNote[] =>
	CHAT_FIXTURE_FILES.map((file) => ({
		path: makeNormalizedVaultPath(file.path),
		content: file.content,
	}));
