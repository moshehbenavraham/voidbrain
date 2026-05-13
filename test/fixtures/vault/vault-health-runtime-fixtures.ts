import { type NormalizedVaultPath, makeNormalizedVaultPath } from "../../../src/types/vault";
import type { IndexableMarkdownNote } from "../../../src/vectorstore";

export const VAULT_HEALTH_RUNTIME_FIXTURE_MESSAGE =
	"Vault health runtime fixtures are synthetic notes only and contain no provider secrets, private paths, or live provider payloads.";

export const HEALTH_SOURCE_PATH = makeNormalizedVaultPath("sources/health-source.md");
export const HEALTH_SUMMARY_PATH = makeNormalizedVaultPath("summaries/health-summary-missing-citation.md");
export const HEALTH_CONTENT_GAP_PATH = makeNormalizedVaultPath("summaries/health-content-gap.md");
export const HEALTH_ORPHAN_PATH = makeNormalizedVaultPath("concepts/health-orphan.md");
export const HEALTH_BROKEN_LINK_PATH = makeNormalizedVaultPath("concepts/health-broken-link.md");

export const HEALTH_SOURCE_CONTENT = [
	"---",
	"voidbrain-id: health-source",
	"artifact-kind: source",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: []",
	"tags: [fixture, health]",
	"title: Health Source",
	"source-type: article",
	"---",
	"",
	"# Health Source",
	"",
	"This synthetic source supports deterministic vault health tests.",
].join("\n");

export const HEALTH_SUMMARY_MISSING_CITATION_CONTENT = [
	"---",
	"voidbrain-id: health-summary-missing-citation",
	"artifact-kind: summary",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/health-source.md]",
	"tags: [fixture, health]",
	"title: Health Summary Missing Citation",
	"summary-type: source-summary",
	"summary-of: sources/health-source.md",
	"citations: []",
	"---",
	"",
	"# Health Summary Missing Citation",
	"",
	"This synthetic summary intentionally omits citation records while keeping a source trace.",
].join("\n");

export const HEALTH_CONTENT_GAP_CONTENT = [
	"---",
	"voidbrain-id: health-content-gap",
	"artifact-kind: summary",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/health-source.md]",
	"tags: [fixture, health]",
	"title: Health Content Gap",
	"summary-type: source-summary",
	"summary-of: sources/health-source.md",
	"citations: [vault:sources/health-source.md]",
	"---",
	"",
	"# Health Content Gap",
	"",
].join("\n");

export const HEALTH_ORPHAN_CONTENT = [
	"---",
	"voidbrain-id: health-orphan",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: []",
	"tags: [fixture, health]",
	"title: Health Orphan",
	"concept-type: topic",
	"aliases: []",
	"related-notes: []",
	"---",
	"",
	"# Health Orphan",
	"",
	"This synthetic concept is disconnected so health reporting can flag it.",
].join("\n");

export const HEALTH_BROKEN_LINK_CONTENT = [
	"---",
	"voidbrain-id: health-broken-link",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/health-source.md]",
	"tags: [fixture, health]",
	"title: Health Broken Link",
	"concept-type: topic",
	"aliases: [health-broken-link]",
	"related-notes: []",
	"---",
	"",
	"# Health Broken Link",
	"",
	"This synthetic concept links to [[missing-health-target]] for a report-only finding.",
].join("\n");

export const VAULT_HEALTH_RUNTIME_NOTES: readonly IndexableMarkdownNote[] = [
	{ path: HEALTH_SOURCE_PATH, content: HEALTH_SOURCE_CONTENT },
	{ path: HEALTH_SUMMARY_PATH, content: HEALTH_SUMMARY_MISSING_CITATION_CONTENT },
	{ path: HEALTH_CONTENT_GAP_PATH, content: HEALTH_CONTENT_GAP_CONTENT },
	{ path: HEALTH_ORPHAN_PATH, content: HEALTH_ORPHAN_CONTENT },
	{ path: HEALTH_BROKEN_LINK_PATH, content: HEALTH_BROKEN_LINK_CONTENT },
];

export const VAULT_HEALTH_RUNTIME_KNOWN_PATHS: readonly NormalizedVaultPath[] = [
	HEALTH_SOURCE_PATH,
	HEALTH_SUMMARY_PATH,
	HEALTH_CONTENT_GAP_PATH,
	HEALTH_ORPHAN_PATH,
	HEALTH_BROKEN_LINK_PATH,
];

export const VAULT_HEALTH_RUNTIME_ALIASES: Readonly<Record<string, NormalizedVaultPath>> = {
	"health-source": HEALTH_SOURCE_PATH,
	"health-broken-link": HEALTH_BROKEN_LINK_PATH,
};

export const loadVaultHealthRuntimeFixtureNotes = (): readonly IndexableMarkdownNote[] =>
	VAULT_HEALTH_RUNTIME_NOTES.map((note) => ({
		path: note.path,
		content: note.content,
	}));
