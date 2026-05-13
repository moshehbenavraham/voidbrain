import type { RetrievalSearchResult } from "../../../src/types/retrieval";
import type { StagedChangeRecord, StagedChangeStatus } from "../../../src/types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../../../src/types/vault";
import { parseMarkdownNote } from "../../../src/vectorstore";

export const SIMILAR_NOTE_SUGGESTION_FIXTURE_MESSAGE =
	"Similar note suggestion fixtures are synthetic vault notes only and contain no provider secrets, private paths, or live provider payloads.";

export const SIMILAR_NOTE_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");
export const SIMILAR_NOTE_FIXED_TIMESTAMP = makeIsoTimestamp("2026-05-13T00:00:00.000Z");

export const SIMILAR_SOURCE_PATH = makeNormalizedVaultPath("sources/local-first-ai-source.md");
export const SIMILAR_CONCEPT_PATH = makeNormalizedVaultPath("concepts/local-first-memory.md");
export const SIMILAR_SUMMARY_PATH = makeNormalizedVaultPath("summaries/local-first-memory-summary.md");
export const SIMILAR_DUPLICATE_LINK_PATH = makeNormalizedVaultPath("concepts/local-first-linked.md");
export const SIMILAR_PLACEMENT_PATH = makeNormalizedVaultPath("inbox/local-first-memory-placement.md");
export const SIMILAR_PLACEMENT_DESTINATION_PATH = makeNormalizedVaultPath("concepts/local-first-memory-placement.md");

export const SIMILAR_SOURCE_CONTENT = [
	"---",
	"voidbrain-id: similar-source",
	"artifact-kind: source",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: []",
	"tags: [fixture, ai, local-first]",
	"title: Local First AI Source",
	"source-type: article",
	"---",
	"",
	"# Local First AI Source",
	"",
	"This synthetic source discusses local AI memory and reviewable knowledge workflows.",
].join("\n");

export const SIMILAR_CONCEPT_CONTENT = [
	"---",
	"voidbrain-id: similar-concept",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/local-first-ai-source.md]",
	"tags: [fixture, ai, memory]",
	"title: Local First Memory",
	"concept-type: workflow",
	"aliases: [local memory]",
	"related-notes: []",
	"---",
	"",
	"# Local First Memory",
	"",
	"Local memory workflows keep note edits reviewable before they touch the vault.",
].join("\n");

export const SIMILAR_SUMMARY_CONTENT = [
	"---",
	"voidbrain-id: similar-summary",
	"artifact-kind: summary",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/local-first-ai-source.md]",
	"tags: [fixture, ai]",
	"title: Local First Memory Summary",
	"summary-type: source-summary",
	"summary-of: sources/local-first-ai-source.md",
	"citations: [vault:sources/local-first-ai-source.md]",
	"---",
	"",
	"# Local First Memory Summary",
	"",
	"This synthetic summary is related to local-first AI memory suggestions.",
].join("\n");

export const SIMILAR_DUPLICATE_LINK_CONTENT = [
	"---",
	"voidbrain-id: similar-duplicate-link",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: [sources/local-first-ai-source.md]",
	"tags: [fixture, ai, memory]",
	"title: Local First Linked",
	"concept-type: topic",
	"aliases: [linked memory]",
	"related-notes: [concepts/local-first-memory.md]",
	"---",
	"",
	"# Local First Linked",
	"",
	"This synthetic note already links to [[concepts/local-first-memory|Local First Memory]].",
].join("\n");

export const SIMILAR_PLACEMENT_CONTENT = [
	"---",
	"voidbrain-id: similar-placement",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: []",
	"tags: [fixture, ai, memory]",
	"title: Local First Memory Placement",
	"concept-type: topic",
	"aliases: []",
	"related-notes: []",
	"---",
	"",
	"# Local First Memory Placement",
	"",
	"This synthetic note has enough local evidence for placement and frontmatter suggestions.",
].join("\n");

export const SIMILAR_DESTINATION_CONTENT = [
	"---",
	"voidbrain-id: similar-existing-destination",
	"artifact-kind: concept",
	"created-at: 2026-05-13T00:00:00Z",
	"updated-at: 2026-05-13T00:00:00Z",
	"source-paths: []",
	"tags: [fixture]",
	"title: Existing Destination",
	"concept-type: topic",
	"aliases: []",
	"related-notes: []",
	"---",
	"",
	"# Existing Destination",
].join("\n");

export const SIMILAR_NOTE_CONTENTS: Readonly<Record<string, string>> = {
	[SIMILAR_SOURCE_PATH]: SIMILAR_SOURCE_CONTENT,
	[SIMILAR_CONCEPT_PATH]: SIMILAR_CONCEPT_CONTENT,
	[SIMILAR_SUMMARY_PATH]: SIMILAR_SUMMARY_CONTENT,
	[SIMILAR_DUPLICATE_LINK_PATH]: SIMILAR_DUPLICATE_LINK_CONTENT,
	[SIMILAR_PLACEMENT_PATH]: SIMILAR_PLACEMENT_CONTENT,
	[SIMILAR_PLACEMENT_DESTINATION_PATH]: SIMILAR_DESTINATION_CONTENT,
};

export const SIMILAR_KNOWN_PATHS = [
	SIMILAR_SOURCE_PATH,
	SIMILAR_CONCEPT_PATH,
	SIMILAR_SUMMARY_PATH,
	SIMILAR_DUPLICATE_LINK_PATH,
	SIMILAR_PLACEMENT_PATH,
	SIMILAR_PLACEMENT_DESTINATION_PATH,
] as const;

export const SIMILAR_PATH_ALIASES: Readonly<Record<string, typeof SIMILAR_CONCEPT_PATH>> = {
	"local-first-memory": SIMILAR_CONCEPT_PATH,
	"local memory": SIMILAR_CONCEPT_PATH,
};

export const loadSimilarNoteFixtureNotes = () =>
	Object.entries(SIMILAR_NOTE_CONTENTS).map(([path, content]) => {
		const parsed = parseMarkdownNote(path, content, {
			knownPaths: SIMILAR_KNOWN_PATHS,
			pathAliases: SIMILAR_PATH_ALIASES,
		});
		if (!parsed.ok) {
			throw new Error(`Similar-note fixture parse failed for ${path}: ${JSON.stringify(parsed.errors)}`);
		}

		return parsed.value;
	});

export const loadSimilarNoteCurrentNotes = () =>
	Object.entries(SIMILAR_NOTE_CONTENTS).map(([path, content]) => ({
		path: makeNormalizedVaultPath(path),
		content,
	}));

export const createSimilarNoteRetrievalResults = (): readonly RetrievalSearchResult[] => [
	{
		ok: true,
		query: {
			query: "local first memory",
			limit: 3,
		},
		results: [
			{
				id: "retrieval-similar-memory",
				path: SIMILAR_CONCEPT_PATH,
				heading: "Local First Memory",
				headingLevel: 1,
				snippet: "Synthetic retrieval body text that must not be copied into suggestion output.",
				score: 0.92,
				scoreDetails: {
					method: "lexical",
					score: 0.92,
					normalizedScore: 0.92,
					matchedTokens: ["local", "memory"],
				},
				chunkId: "chunk-similar-memory",
				sourcePaths: [SIMILAR_SUMMARY_PATH],
			},
			{
				id: "retrieval-similar-placement",
				path: SIMILAR_PLACEMENT_PATH,
				heading: "Local First Memory Placement",
				headingLevel: 1,
				snippet: "Synthetic placement retrieval body text that stays out of durable records.",
				score: 0.61,
				scoreDetails: {
					method: "semantic",
					score: 0.61,
					normalizedScore: 0.61,
					vectorSimilarity: 0.61,
					matchedTokens: ["memory"],
				},
				chunkId: "chunk-similar-placement",
				sourcePaths: [SIMILAR_CONCEPT_PATH],
			},
		],
	},
];

export const createSimilarActiveStagedChange = (
	status: StagedChangeStatus = "review-ready",
	targetPath = SIMILAR_SUMMARY_PATH,
): StagedChangeRecord => ({
	artifactKind: "staged-change",
	schemaVersion: 1,
	changeId: `similar-${status}-change`,
	operationKind: "update-frontmatter",
	status,
	targetPath,
	createdAt: SIMILAR_NOTE_FIXED_TIMESTAMP,
	updatedAt: SIMILAR_NOTE_FIXED_TIMESTAMP,
	rationale: "Synthetic similar-note staged change fixture.",
	sourcePaths: [SIMILAR_SOURCE_PATH],
	diff: {
		lineDiff: [],
		hasTextChanges: false,
	},
	conflicts: [],
	review: {
		requiresExplicitReview: true,
		destructive: false,
		reasons: ["frontmatter-edit"],
	},
	recovery: {
		commandId: "voidbrain.stage-change",
		stagedChangeId: `similar-${status}-change`,
		targetPath,
		status: status === "failed" ? "failed-apply" : "pending-review",
		validationOutput: [],
	},
});
