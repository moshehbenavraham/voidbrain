# Task Checklist

**Session ID**: `phase01-session08-hot-cache-mvp-integration-validation`
**Total Tasks**: 22
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-13

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[SNNMM]` = Session reference (NN=phase number, MM=session number)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **22** | **22** | **0** |

---

## Setup (3 tasks)

Initial configuration, prerequisite confirmation, and artifact preparation.

- [x] T001 [S0108] Verify Sessions 01-07 validation handoff and Phase 01 requirements before implementation (`.spec_system/specs/phase01-session07-vault-health-repair-staging/validation.md`)
- [x] T002 [S0108] Inspect existing chat, staged-change, health, index, and runtime status contracts for hot cache integration (`src/main.ts`)
- [x] T003 [S0108] Create hot cache session artifact placeholders for implementation notes and validation output (`.spec_system/specs/phase01-session08-hot-cache-mvp-integration-validation/implementation-notes.md`)

---

## Foundation (6 tasks)

Core contracts, validation, fixtures, and service scaffolding.

- [x] T004 [S0108] Define hot cache capture, restore, redaction, persistence, and staged-summary contracts (`src/types/hot-cache.ts`)
- [x] T005 [S0108] Extend durable hot cache and operation-log contracts for bounded recent context (`src/types/vault.ts`)
- [x] T006 [S0108] Update vault validation for enriched hot cache records with secret-like field rejection and deterministic ordering (`src/utils/vault-validation.ts`)
- [x] T007 [S0108] Add stable hot cache support path constants and artifact path helpers (`src/utils/vault-paths.ts`)
- [x] T008 [S0108] [P] Create synthetic hot cache workflow fixtures without secrets, personal data, or private path hints (`test/fixtures/vault/hot-cache-fixtures.ts`)
- [x] T009 [S0108] [P] Create hot cache store state for capture, restore, write, failure, summary staging, and re-entry reset (`src/stores/hot-cache-store.ts`)

---

## Implementation (9 tasks)

Main feature implementation and runtime wiring.

- [x] T010 [S0108] Implement hot cache capture and restore service with schema-validated input and explicit error mapping (`src/agent/hot-cache-service.ts`)
- [x] T011 [S0108] Implement bounded redaction and deterministic cache entry rendering with secret-field rejection (`src/agent/hot-cache-service.ts`)
- [x] T012 [S0108] Implement staged session-summary generation with citation/source-path requirements and duplicate-trigger prevention while in-flight (`src/agent/hot-cache-service.ts`)
- [x] T013 [S0108] Export hot cache service and helpers from the agent barrel (`src/agent/index.ts`)
- [x] T014 [S0108] Add hot cache runtime status area with ready, stale, missing, failed, and recovery details (`src/types/runtime.ts`)
- [x] T015 [S0108] Implement hot cache status snapshot composition with bounded paths and redacted diagnostics (`src/agent/runtime-status.ts`)
- [x] T016 [S0108] Wire hot cache service, store, local support-file reads/writes, chat persistence, reload restore, and cleanup through Obsidian APIs (`src/main.ts`)
- [x] T017 [S0108] Add chat save-session-summary action with disabled-while-pending state, accessibility labels, and staged-review handoff (`src/views/chat-view.ts`)
- [x] T018 [S0108] Update status surface rendering for hot cache readiness with explicit loading, empty, error, and offline states (`src/components/StatusSurface.svelte`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T019 [S0108] [P] Write hot cache service tests for capture, redaction, restore, duplicate prevention, staged summaries, and validation failures (`test/hot-cache-service.test.ts`)
- [x] T020 [S0108] [P] Write runtime and lifecycle tests for hot cache status, load/save, reload restore, summary staging, and cleanup (`test/plugin-lifecycle.test.ts`)
- [x] T021 [S0108] [P] Write end-to-end synthetic MVP integration validation covering provider, index, chat, ingestion, staged review, health, hot cache, and reload recovery (`test/mvp-integration-validation.test.ts`)
- [x] T022 [S0108] Update docs, agent surfaces, implementation notes, and validation records, then run required validation commands and capture residual risks (`docs/hot-cache-mvp-integration-validation.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] `bun run validate:agent-surfaces` passes
- [x] `bun run validate:fixture-safety` passes
- [x] `bun run validate:agent-docs` passes
- [x] `bun run validate` passes or residual failures are documented with recovery details
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness.
