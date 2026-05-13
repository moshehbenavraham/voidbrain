# AGENTS.md

Voidbrain is a local-first Obsidian-style AI second-brain scaffold. Treat the
vault as user-owned data and the durable source of truth. Agent work must stay
inspectable, provider-aware, and recoverable.

## Core Rules

- Local-first: do not send vault content to cloud providers unless the workflow
  has explicit provider review and the user approves that disclosure.
- Staged changes: never apply AI-proposed note edits directly to user vault
  files; create reviewable staged changes first.
- Provider secrets: never write API keys, tokens, passwords, authorization
  headers, or raw hidden provider state to docs, fixtures, logs, screenshots, or
  generated examples.
- Synthetic fixtures: examples and tests use `test/fixtures/vault/` or clearly
  fake paths such as `fixtures/demo-vault/`.
- Citations: user-facing answers grounded in retrieval must cite vault paths,
  headings, and source records.
- Dry-run: framework update behavior is preview-only until a later apply
  workflow is implemented.
- Recovery: failures should preserve command ID, target path, cache path,
  staged-change ID, report ID, and validation output needed for inspection or
  retry.

## Command Catalog

| Command ID | Status | Agent Behavior |
|------------|--------|----------------|
| `voidbrain.ingest-source` | implemented | Preview approved markdown, text, pasted content, or URL source records; stage generated artifacts with citations and recovery details only. |
| `voidbrain.chat-with-vault` | implemented | Require retrieval citations and explicit provider review before any cloud call. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted reports, and stage only deterministic safe repairs through staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with before/after diffs, backup intent, audit records, and recovery details. |
| `voidbrain.recover-session` | implemented | Read hot cache support records, staged recovery state, health reports, operation logs, and validation output; return redacted retry or discard diagnostics without mutating vault files. |
| `voidbrain.validate-agent-surfaces` | implemented | Fail closed on stale command IDs, status drift, safety phrases, and fixture-safe examples from bounded repository paths. |
| `voidbrain.preview-framework-update` | scaffolded | Produce a dry-run plan for framework files and exclude user vault content. |

## Repository Workflow

Read `.spec_system/CONVENTIONS.md` and the relevant session spec before code
changes. Keep Obsidian lifecycle wiring in `src/main.ts`; keep testable domain
logic under `src/agent/`, `src/providers/`, `src/vectorstore/`, `src/stores/`,
`src/views/`, `src/components/`, `src/utils/`, and `src/types/`.

Use these validation commands from the repository root:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
bun run validate
```

The first two commands are local read-only checks for agent documentation and
synthetic fixtures. They must fail closed on stale command references, missing
safety language, secret-like examples, private path hints, or credential-like
values.
