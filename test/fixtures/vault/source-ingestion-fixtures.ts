import type { SourceIngestionInput } from "../../../src/types/ingestion";
import { type SourceManifest, makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";

export const SOURCE_INGESTION_FIXTURE_MESSAGE =
	"Source ingestion fixtures are synthetic vault notes only and contain no provider secrets or private paths.";

export const INGESTION_FIXTURE_MARKDOWN_PATH = "inbox/source-ingestion-demo.md";
export const INGESTION_FIXTURE_SOURCE_TARGET = "sources/synthetic-source-ingestion-demo.md";
export const INGESTION_FIXTURE_SUMMARY_TARGET = "summaries/synthetic-source-ingestion-demo-summary.md";

export const INGESTION_FIXTURE_MARKDOWN = [
	"# Synthetic Source Ingestion Demo",
	"",
	"Voidbrain keeps source ingestion local-first until explicit provider review allows a provider path.",
	"Generated notes remain staged changes with citations back to synthetic source records.",
	"Retrieval and privacy boundaries are validated before user-facing summaries are trusted.",
].join("\n");

export const INGESTION_FIXTURE_TEXT = [
	"Synthetic Text Source",
	"",
	"Local-first ingestion accepts bounded text content and creates reviewable staged changes.",
].join("\n");

export const SAFE_MARKDOWN_SOURCE_INPUT: SourceIngestionInput = {
	kind: "markdown-file",
	path: INGESTION_FIXTURE_MARKDOWN_PATH,
	content: INGESTION_FIXTURE_MARKDOWN,
};

export const SAFE_TEXT_SOURCE_INPUT: SourceIngestionInput = {
	kind: "text-file",
	path: "inbox/synthetic-text-source.txt",
	title: "Synthetic Text Source",
	content: INGESTION_FIXTURE_TEXT,
};

export const SAFE_PASTED_SOURCE_INPUT: SourceIngestionInput = {
	kind: "pasted-content",
	title: "Synthetic Pasted Source",
	content: "Synthetic pasted content explains staged changes, citations, and recovery metadata.",
	sourcePath: "sources/synthetic-pasted-source-record.md",
};

export const APPROVED_URL_SOURCE_INPUT: SourceIngestionInput = {
	kind: "url-record",
	title: "Synthetic URL Source",
	sourceUrl: "https://example.test/synthetic-source",
	approved: true,
	content: "Synthetic URL source record supplied by the user. No live URL fetching occurs.",
	sourcePath: "sources/synthetic-url-source-record.md",
};

export const DENIED_URL_SOURCE_INPUT: SourceIngestionInput = {
	...APPROVED_URL_SOURCE_INPUT,
	approved: false,
};

export const UNSAFE_PATH_SOURCE_INPUT: SourceIngestionInput = {
	kind: "markdown-file",
	path: "../outside-vault.md",
	content: INGESTION_FIXTURE_MARKDOWN,
};

export const PROVIDER_OPTIONAL_SOURCE_INPUT: SourceIngestionInput = {
	...SAFE_MARKDOWN_SOURCE_INPUT,
	providerMode: "optional-summary",
};

export const DUPLICATE_SOURCE_MANIFEST: SourceManifest = {
	artifactKind: "source-manifest",
	schemaVersion: 1,
	generatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
	records: [
		{
			id: "source-record-demo-existing",
			path: makeNormalizedVaultPath(INGESTION_FIXTURE_MARKDOWN_PATH),
			title: "Synthetic Source Ingestion Demo",
			sourceType: "article",
			contentSha256: "duplicate-content-hash",
			createdAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
			updatedAt: makeIsoTimestamp("2026-05-13T00:00:00.000Z"),
			tags: ["fixture", "source-ingestion"],
		},
	],
};

export const TARGET_COLLISION_NOTE = {
	path: INGESTION_FIXTURE_SOURCE_TARGET,
	content: "# Synthetic Source Ingestion Demo\n\nExisting synthetic target note.",
};

export const EXPECTED_INGESTION_TARGETS = {
	source: INGESTION_FIXTURE_SOURCE_TARGET,
	summary: INGESTION_FIXTURE_SUMMARY_TARGET,
	entityFolder: "entities/",
	conceptFolder: "concepts/",
} as const;
