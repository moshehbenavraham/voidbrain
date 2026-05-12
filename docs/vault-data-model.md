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
| `.voidbrain/cache/` | Voidbrain support data | Hot cache state for recently used source, note, and retrieval metadata. |
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
