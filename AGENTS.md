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
- Provider closeout: local runtime paths stay local; cloud or custom remote
  providers require provider review, trust, auth, capability, and disclosure
  gates before private vault content can leave the machine. Offline semantic
  failures should expose lexical fallback when available.

## Command Catalog

| Command ID | Status | Agent Behavior |
|------------|--------|----------------|
| `voidbrain.ingest-source` | implemented | Preview approved markdown, text, pasted content, URL source records, or bounded batch queues; stage generated artifacts with citations, provider review, cancellation, retry, and recovery details only. |
| `voidbrain.chat-with-vault` | implemented | Require retrieval citations and explicit provider review before any cloud call. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted reports, and stage only deterministic safe repairs through staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with before/after diffs, backup intent, audit records, and recovery details. |
| `voidbrain.recover-session` | implemented | Read hot cache support records, staged recovery state, health reports, operation logs, and validation output; return redacted retry or discard diagnostics without mutating vault files. |
| `voidbrain.validate-agent-surfaces` | implemented | Fail closed on stale command IDs, status drift, safety phrases, and fixture-safe examples from bounded repository paths. |
| `voidbrain.preview-framework-update` | implemented | Produce deterministic dry-run framework update plans with create, update, skip, conflict, excluded, hash, issue, and recovery details while excluding user vault content; apply behavior remains deferred. |

## Repository Workflow

Read `.spec_system/CONVENTIONS.md` and the relevant session spec before code
changes. Keep Obsidian lifecycle wiring in `src/main.ts`; keep testable domain
logic under `src/agent/`, `src/providers/`, `src/vectorstore/`, `src/stores/`,
`src/views/`, `src/components/`, `src/utils/`, and `src/types/`.

Use these validation commands from the repository root:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-surface-package
bun run validate:agent-docs
bun run validate
```

The agent validation commands are local read-only checks for agent
documentation, synthetic fixtures, and packageable instruction surfaces. They
must fail closed on stale command references, missing safety language,
secret-like examples, private path hints, credential-like values, unsupported
package paths, prompt bodies, hidden provider state, or output paths outside
framework-owned build, dist, or docs roots.

Package AGENTS, CLAUDE, GEMINI, the Voidbrain skill, and human command docs
only as local framework surfaces. Reuse guidance must point to
`docs/agent-surface-packaging.md`, use synthetic paths such as
`fixtures/demo-vault/`, and must not copy user vault notes, `.voidbrain`
support records, provider secrets, authorization headers, raw hidden provider
state, prompt bodies, or `EXAMPLES` research input into packages.

Phase 03 provider integration evidence lives in
`docs/phase03-offline-provider-integration-validation.md` and validates local
providers, OpenAI-compatible providers, invocation boundaries, semantic
fallback, provider troubleshooting, dry-run language, staged changes, citations,
provider secrets redaction, synthetic fixtures, and recovery records.

Phase 04 distribution integration evidence lives in
`docs/phase04-distribution-integration-validation.md` and validates release
artifacts, local install/update dry runs, agent surface packaging, onboarding,
provider readiness, selected-output handoff boundaries, fixture safety, staged
mutation policy, dry-run language, provider disclosure gates, and recovery
records.
