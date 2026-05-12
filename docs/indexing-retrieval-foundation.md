# Indexing and Retrieval Foundation

Voidbrain treats indexes as rebuildable support state derived from local
markdown notes. Markdown notes and source manifests remain the durable source of
truth. Retrieval code must preserve vault paths, headings, snippets, and score
details so later chat and health workflows can cite the notes they used.

## Parsing Boundary

The markdown parser accepts a vault-relative path and raw markdown content. It
extracts frontmatter, body text, headings, wikilinks, tags, and traceable text
chunks. Expected validation failures return structured parse errors instead of
throwing. Runtime Obsidian APIs can supply file content later, but parsing stays
pure and fixture-testable.

MVP parsing supports:

- YAML-style frontmatter with scalar values and inline string arrays.
- ATX headings from `#` through `######`.
- Wikilinks with aliases, heading fragments, and missing targets preserved.
- Frontmatter tags and inline `#tag` values.
- Heading-scoped chunks with vault path traceability.

The parser does not try to implement the full Obsidian parser. It avoids
runtime metadata cache dependencies so fixture tests can run in Bun and Vitest.
Future Obsidian lifecycle code can pass known paths and alias maps into the
parser to mark wikilinks as resolved or missing.

## Freshness and Progress

Index metadata describes recoverable support state only. A lexical or semantic
index can be building, ready, stale, error, or canceled. Index jobs report
progress snapshots with totals, indexed counts, current paths, and status.
Cancellation must stop work before the next note is indexed and return a
canceled result with partial metadata rather than marking the index ready.

Freshness is computed from source path sets and content fingerprints. When
paths or fingerprints change, the index is stale and must be rebuilt before a
workflow treats it as current.

Indexing services must reset build state when a job is re-entered. Rebuilds
start from empty derived chunks and fresh progress snapshots. Duplicate builds
for the same index ID are rejected while a prior build is in flight.

Expected job outcomes:

- `ready`: all supplied notes parsed and indexed.
- `canceled`: abort signal was observed before completion.
- `error`: parser failure, duplicate in-flight build, or unexpected exception.

## Lexical Retrieval

The lexical baseline tokenizes note chunks deterministically, stores
in-memory postings, and returns bounded search results. Empty queries and
unbounded limits are rejected. Results sort by descending score, then path,
heading, and chunk ID so repeated runs over the same fixture vault are stable.

Lexical results are not final answer synthesis. They are citation-ready
evidence records that preserve source context for later grounded workflows.

The baseline intentionally uses simple term-frequency scoring plus deterministic
tie-breakers. It does not implement hybrid ranking, graph expansion,
personalized ranking, reranking, or answer synthesis. Those behaviors belong in
later chat and agent sessions after evidence contracts are stable.

## Semantic Index Contracts

Semantic indexes are keyed by embedding model family, not provider display name.
Any workflow that prepares private vault content for embedding must first prove
that the selected provider model supports `embeddings` and that local-first
disclosure policy allows the requested content sensitivity.

This session defines compatibility and preflight scaffolding only. It does not
make live provider calls, create cloud embeddings, or require a hosted vector
database.

Semantic preparation is allowed only after:

1. Provider disclosure policy allows the request.
2. The selected model supports `embeddings` with the `embedding` role.
3. The selected model declares an embedding model family.
4. The family and dimensions match the semantic index config.

## Citation Contract

Retrieval results must include:

- Vault-relative `path`.
- Optional `heading` and `headingLevel`.
- Bounded `snippet`.
- Score details with lexical or semantic method information.
- Source chunk IDs that can be traced back to parsed notes.

User-facing synthesis must not treat retrieval output as a source unless these
fields remain intact.

## Validation Surface

Regression tests should cover:

- Frontmatter, headings, tags, wikilinks, and missing wikilinks.
- Chunk IDs, snippets, source paths, and heading context.
- Lexical search bounds, invalid queries, deterministic ordering, and path
  filters.
- Fresh, stale, partial, missing, canceled, and resumed index states.
- Semantic family mismatch, dimension mismatch, unsupported embedding
  capability, and cloud disclosure denial.

Fixture notes must remain synthetic. Tests must not use live provider calls,
real vault content, credentials, private URLs, or production vector stores.
