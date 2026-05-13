# Vault Data Model

Voidbrain stores durable knowledge in the user's local vault as markdown and
JSON. Markdown notes are the readable source of truth for generated knowledge.
JSON support files are used for manifests, indexes, caches, logs, and staged
changes that can be rebuilt or audited.

## Artifact Ownership

The vault remains user-owned. Voidbrain may generate notes and support files
only inside documented vault-relative locations after validation. Runtime code
must treat existing user content as untrusted input and preserve user-authored
notes unless a staged change is approved.

## Folder Contracts

Generated artifacts use normalized vault-relative paths. Folder names are stable
MVP contracts unless marked as an example.

| Folder | Artifact owner | Durable role |
|--------|----------------|--------------|
| `sources/` | User and Voidbrain imports | Source notes that describe original material, external references, or user-selected vault notes. |
| `entities/` | Voidbrain generated notes | People, organizations, projects, and other named things extracted from source notes. |
| `concepts/` | Voidbrain generated notes | Reusable ideas, patterns, claims, and topics derived from source notes. |
| `summaries/` | Voidbrain generated notes | Source-grounded summaries and synthesis notes with citations. |
| `conversations/` | Voidbrain generated notes | Recoverable chat transcripts and thread summaries. |
| `.voidbrain/manifests/` | Voidbrain support data | Source manifests and other durable inventory records. |
| `.voidbrain/indexes/` | Voidbrain support data | Derived lexical and semantic index metadata and shards. |
| `.voidbrain/cache/` | Voidbrain support data | Hot cache state for recent chat, context, index, staged-change, and health recovery metadata. |
| `.voidbrain/logs/` | Voidbrain support data | Append-only operation logs for recovery and audit. |
| `.voidbrain/staged-changes/` | Voidbrain support data | Proposed vault mutations awaiting user review or explicit auto-apply policy. |

Generated markdown knowledge belongs in `sources/`, `entities/`, `concepts/`,
`summaries/`, or `conversations/`. Generated support files belong under
`.voidbrain/`. Runtime code must not place generated artifacts at vault root or
inside arbitrary user folders unless a later workflow adds an explicit staged
change contract for that behavior.

Indexes, cache files, logs, and staged-change records are support artifacts.
They may describe user notes, but they are not the durable source of truth. A
healthy implementation can delete and rebuild indexes or cache records from
markdown notes and manifests.

## Derived Index Metadata

Lexical and semantic indexes are derived support artifacts. They may be stored
under `.voidbrain/indexes/` or represented in `.voidbrain/runtime-state.json`,
but they must always be rebuildable from markdown notes and manifests.

Index metadata records:

- Index ID and kind (`lexical` or `semantic`).
- Status and update timestamp.
- Sorted source paths used to build the index.
- Content fingerprints for freshness checks in runtime service contracts.
- Embedding model family for semantic indexes.

Freshness is not inferred from file presence alone. Runtime code compares the
source path set and content fingerprints from the current vault scan against the
index metadata. Missing sources, extra sources, or changed fingerprints make the
index partial or stale until rebuilt. A stale index can still be useful for
diagnostics, but chat and agent workflows must not treat it as current evidence.

## Retrieval Traceability

Retrieval results are citation-ready evidence records, not synthesized answers.
Every result must preserve:

- Vault-relative path.
- Heading text and level when the chunk came from a heading section.
- Bounded snippet.
- Score and score details.
- Chunk ID.
- Source paths inherited from generated note frontmatter or the source note
  itself.

Later answer synthesis must cite these fields instead of citing opaque vector
IDs or untraceable cache records.

## Embedding Compatibility

Semantic indexes are keyed by embedding model family, not provider display
name. A semantic index built with one embedding family must reject entries from
another family or from vectors with mismatched dimensions.

Before private vault content is prepared for embedding, runtime code must run
provider preflight with `embeddings` capability and local-first disclosure
policy. Cloud providers require explicit cloud enablement and a trusted provider
ID before any private vault content can leave the local boundary.

## Artifact Kinds

| Kind | File type | Allowed location |
|------|-----------|------------------|
| `source` | Markdown | `sources/**/*.md` |
| `entity` | Markdown | `entities/**/*.md` |
| `concept` | Markdown | `concepts/**/*.md` |
| `summary` | Markdown | `summaries/**/*.md` |
| `conversation` | Markdown | `conversations/**/*.md` |
| `source-manifest` | JSON | `.voidbrain/manifests/**/*.json` |
| `index-metadata` | JSON | `.voidbrain/indexes/**/*.json` or `.voidbrain/runtime-state.json` |
| `hot-cache` | JSON | `.voidbrain/cache/**/*.json` or `.voidbrain/runtime-state.json` |
| `operation-log` | JSON | `.voidbrain/logs/**/*.json` or `.voidbrain/runtime-state.json` |
| `staged-change` | JSON | `.voidbrain/staged-changes/**/*.json` or `.voidbrain/runtime-state.json` |

## Markdown Frontmatter Contracts

Generated markdown notes use frontmatter to identify artifact kind, stable IDs,
source traceability, timestamps, and recoverable metadata.

Required common fields:

| Field | Type | Notes |
|-------|------|-------|
| `voidbrain-id` | String | Stable ID scoped to the artifact kind. |
| `artifact-kind` | Artifact kind | One of the markdown artifact kinds. |
| `created-at` | ISO timestamp | Creation time in UTC. |
| `updated-at` | ISO timestamp | Last update time in UTC. |
| `source-paths` | String array | Vault-relative source note paths. Required for generated factual notes. |
| `tags` | String array | Plain tags without provider secrets or hidden state. |

Artifact-specific fields should extend the common fields instead of replacing
them. For example, a source note may include `source-type` and `source-url`,
while a conversation may include `thread-id` and `message-count`.

## JSON Support File Contracts

JSON support files store source manifests, index metadata, hot cache state,
operation logs, and staged changes. Support files must not contain provider
secrets or hidden provider state.

Support records use explicit `artifactKind` discriminators and vault-relative
paths. They can reference generated markdown notes but cannot embed provider API
keys, raw authorization headers, passwords, session cookies, or private model
transport state.

Durable support file examples:

| File | Contract |
|------|----------|
| `.voidbrain/manifests/sources.json` | Ordered source records with stable IDs, paths, titles, and optional public URLs. |
| `.voidbrain/runtime-state.json` | Synthetic test aggregate for index metadata, hot cache, staged changes, and operation logs. |

## Hot Cache Support Records

Hot cache records are local readable support artifacts under
`.voidbrain/cache/`. They are used for recent context recovery after reload and
can be discarded without deleting user knowledge.

Each hot cache record stores:

- Cache ID, cache path, update timestamp, entry limit, and redaction summary.
- Sorted entries keyed by kind and stable key.
- Entry kinds for chat thread metadata, context chips, index readiness, staged
  changes, health reports, and runtime status.
- Bounded summaries and primitive metadata only.
- Source paths, target paths, staged-change IDs, report IDs, cache path, and
  validation output for recovery.

Hot cache entries intentionally omit raw note bodies, raw retrieval snippets,
provider attempts, provider secrets, authorization headers, hidden provider
state, and private diagnostics. Validation rejects secret-like keys and
unsorted entries.

Session-summary markdown is not a cache record. It is a generated conversation
note proposal under `conversations/` and must be staged before apply.

## Staged Change Support Records

Staged changes are review records for proposed markdown note mutations. They do
not apply edits by themselves and must not target `.voidbrain/` support files.

Each staged change records:

- Operation kind: `create-note`, `update-note`, `delete-note`, `move-note`, or
  `update-frontmatter`.
- Review status, target path, source paths, rationale, timestamps, and content
  hashes.
- Before and after content plus deterministic line diff context.
- Conflict metadata for missing targets, path collisions, stale before hashes,
  duplicate active staged changes, and validation failures.
- Destructive review metadata for delete and move operations.
- Recovery metadata with command ID, staged-change ID, target path, backup path
  intent, and validation output.

Delete and move records are destructive review paths. This foundation does not
include an apply workflow or automatic backup creation.

## Health Report Contracts

Vault health reports are local diagnostic records derived from parsed notes and
index freshness snapshots. They are report-only and can be regenerated.

Foundation findings cover:

- Orphan generated notes with no inbound wikilink or valid source trace.
- Broken wikilinks with line evidence.
- Stale, missing, partial, or extra index fingerprints.
- Missing citations on source-grounded summaries.

Findings include severity, kind, affected paths, evidence, and remediation
guidance. Repair behavior remains staged or manual in later workflows.

## Validation and Safety

All vault-relative paths and durable metadata are validated before use. Expected
validation failures return explicit error codes rather than throwing.

Validation rejects:

- Empty paths, absolute paths, Windows drive paths, URL-like paths, and parent
  traversal.
- Markdown artifacts outside their allowed folders.
- JSON support artifacts outside `.voidbrain/`.
- Unsupported artifact kinds.
- Frontmatter or support records with secret-like keys such as `apiKey`,
  `authorization`, `password`, `secret`, or `token`.
- Generated factual notes that lack source traceability.
