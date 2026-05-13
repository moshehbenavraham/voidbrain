# Task Checklist

**Session ID**: `phase01-session06-staged-change-review-apply`
**Total Tasks**: 25
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
| Foundation | 7 | 7 | 0 |
| Implementation | 11 | 11 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **25** | **25** | **0** |

---

## Setup (3 tasks)

Initial configuration and implementation context.

- [x] T001 [S0106] Verify completed runtime, indexing, source ingestion, staged-change, command catalog, fixture, and validation prerequisites (`.spec_system/specs/phase01-session06-staged-change-review-apply/implementation-notes.md`)
- [x] T002 [S0106] [P] Audit current `voidbrain.stage-change` placeholder behavior and synchronized markdown command surfaces for required status changes (`.spec_system/specs/phase01-session06-staged-change-review-apply/implementation-notes.md`)
- [x] T003 [S0106] [P] Create session security and recovery checklist for explicit confirmation, backups, audit records, staged-change IDs, validation output, and no unconfirmed note mutation (`.spec_system/specs/phase01-session06-staged-change-review-apply/security-compliance.md`)

---

## Foundation (7 tasks)

Core contracts, fixtures, review service, store, modal, and mock foundations.

- [x] T004 [S0106] Define staged-review contracts for groups, actions, confirmations, apply plans, outcomes, audit entries, and recovery summaries with types matching declared contract and exhaustive enum handling (`src/types/staged-review.ts`)
- [x] T005 [S0106] Extend vault operation log and staged-change recovery contracts for applied, rejected, failed, backup, and audit events with schema-validated input and explicit error mapping (`src/types/vault.ts`)
- [x] T006 [S0106] [P] Create synthetic staged-review fixtures for create, update, frontmatter edit, delete, move, conflicts, stale hashes, failed applies, backups, and recovery metadata (`test/fixtures/vault/staged-change-review-fixtures.ts`)
- [x] T007 [S0106] Create staged-change review service skeleton for grouping, action validation, confirmation policy, preflight, transitions, and apply result mapping (`src/agent/staged-change-review-service.ts`)
- [x] T008 [S0106] [P] Create staged-change review store for selected groups, confirmation text, in-flight actions, failure state, retry state, and state reset on modal re-entry (`src/stores/staged-change-review-store.ts`)
- [x] T009 [S0106] [P] Create staged-change review modal skeleton with explicit loading, empty, error, conflict, offline, confirmation, and cleanup states (`src/views/staged-change-review-modal.ts`)
- [x] T010 [S0106] [P] Extend Obsidian mocks for create, modify, delete, rename, adapter backup writes, permission failures, stale file contents, and deterministic vault state inspection (`test/__mocks__/obsidian.ts`)

---

## Implementation (11 tasks)

Main staged-change review, apply, runtime, and documentation implementation.

- [x] T011 [S0106] Implement deterministic staged-change grouping by command ID, operation kind, status, destructive flag, target path, and source paths (`src/agent/staged-change-review-service.ts`)
- [x] T012 [S0106] Implement diff and preview view models for create, update, delete, move, and frontmatter-edit records with bounded display content and deterministic ordering (`src/agent/staged-change-review-service.ts`)
- [x] T013 [S0106] Implement confirmation policy for additive, update, destructive, overwrite, and batch actions with stronger typed confirmation for delete, move, overwrite, and batch apply (`src/agent/staged-change-review-service.ts`)
- [x] T014 [S0106] Implement approve, reject, retry, and dismiss transitions with duplicate-trigger prevention while in-flight and recovery metadata preserved (`src/agent/staged-change-review-service.ts`)
- [x] T015 [S0106] Implement apply preflight revalidation for current target content, expected hashes, missing targets, existing create targets, destination collisions, duplicate active records, and permission failures (`src/agent/staged-change-review-service.ts`)
- [x] T016 [S0106] Implement create, update, and frontmatter-edit apply execution through the Obsidian runtime adapter with idempotency protection, transaction boundaries, and compensation on failure (`src/main.ts`)
- [x] T017 [S0106] Implement delete and move apply execution with stronger confirmation, backup support writes before mutation, transaction boundaries, and compensation on failure (`src/main.ts`)
- [x] T018 [S0106] Implement audit trail and recovery updates for applied, rejected, dismissed, conflicted, and failed records without provider secrets, hidden state, or raw private diagnostics (`src/agent/staged-change-review-service.ts`)
- [x] T019 [S0106] Wire staged-review service/store/modal into plugin lifecycle, command handlers, runtime status refresh, notices, cleanup, and `voidbrain.stage-change` implemented command outcome (`src/main.ts`, `src/agent/runtime-command-handlers.ts`)
- [x] T020 [S0106] Trigger or queue index refresh after successful apply with timeout, retry/backoff, visible failure-path handling, and recoverable status details (`src/main.ts`)
- [x] T021 [S0106] Synchronize command catalog, docs, and markdown agent surfaces for implemented staged-change review/apply while preserving local-first, staged changes, provider secrets, synthetic fixtures, citations, dry-run, and recovery safety phrases (`src/agent/command-catalog.ts`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `skills/voidbrain/SKILL.md`, `docs/agent-surfaces-commands.md`, `docs/staged-change-review-apply.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T022 [S0106] [P] Add staged-review service tests for grouping, sorting, selection, diff view models, confirmation policy, action transitions, validation output, and recovery details (`test/staged-change-review-service.test.ts`)
- [x] T023 [S0106] [P] Add apply-path tests for create, update, frontmatter edit, delete, move, backup writes, stale hashes, collisions, permission failures, partial failures, compensation, and audit entries (`test/staged-change-review-service.test.ts`, `test/plugin-lifecycle.test.ts`)
- [x] T024 [S0106] [P] Add modal and lifecycle tests for command opening, loading, empty, conflict, error, confirm, apply, reject, retry, dismiss, focus behavior, duplicate-trigger prevention, and cleanup on close/unload (`test/staged-change-review-modal.test.ts`, `test/plugin-lifecycle.test.ts`)
- [x] T025 [S0106] Run validation commands and record results, residual risks, command ID, target path, staged-change ID, backup path intent, validation output, and recovery details (`.spec_system/specs/phase01-session06-staged-change-review-apply/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] `security-compliance.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness.
