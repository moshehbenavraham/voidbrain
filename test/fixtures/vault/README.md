# Synthetic Fixture Vault

This directory is a small, commit-safe Obsidian-style vault used by tests for
voidbrain vault contracts. Every file is synthetic. Do not copy personal notes,
provider responses, API headers, credentials, private URLs, or customer data
into this fixture.

## Layout

| Path | Purpose |
|------|---------|
| `sources/` | Source notes that describe original reference material. |
| `entities/` | Generated entity notes linked back to source notes. |
| `concepts/` | Generated concept notes linked to sources and related notes. |
| `summaries/` | Generated summaries with citations to source records. |
| `conversations/` | Recoverable chat transcripts and thread metadata. |
| `.voidbrain/manifests/` | Durable source manifests and support records. |
| `.voidbrain/runtime-state.json` | Derived index, cache, log, and staged-change examples. |

## Safety Policy

- Use stable demo identifiers and deterministic ordering.
- Keep examples readable as local markdown or JSON.
- Link factual generated content back to a fixture source note or source record.
- Never include provider secrets, tokens, passwords, authorization headers, or
  raw hidden provider state.
- Treat `.voidbrain` indexes and cache records as derived support files, not as
  the durable source of truth.
