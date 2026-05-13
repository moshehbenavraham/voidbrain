# Task Checklist

**Session ID**: `phase02-session03-framework-update-preview-planner`
**Total Tasks**: 18
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
| Foundation | 5 | 5 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 3 | 3 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (3 tasks)

Initial state verification and preview surface review.

- [x] T001 [S0203] Verify analyzer state, completed prerequisites, and current planned session (`.spec_system/state.json`)
- [x] T002 [S0203] Review existing preview contracts, planner behavior, and CLI adapter (`src/agent/framework-update-preview.ts`)
- [x] T003 [S0203] Review command catalog, runtime dry-run handling, and agent surface status text (`src/agent/command-catalog.ts`)

---

## Foundation (5 tasks)

Core contracts, fixtures, and reusable preview boundaries.

- [x] T004 [S0203] Extend framework preview contracts for candidate records, action classifications, conflicts, hashes, and recovery metadata with types matching declared contract; exhaustive enum handling (`src/types/agent-commands.ts`)
- [x] T005 [S0203] [P] Create synthetic framework update preview fixtures for safe candidates, excluded paths, conflicts, and current file snapshots (`test/fixtures/vault/framework-update-preview-fixtures.ts`)
- [x] T006 [S0203] Define preview path normalization and exclusion helpers for framework-owned paths, generated knowledge roots, support records, provider secret files, and diagnostics with schema-validated input and explicit error mapping (`src/agent/framework-update-preview.ts`)
- [x] T007 [S0203] Define deterministic action sorting, comparison hashes, and issue recovery detail helpers (`src/agent/framework-update-preview.ts`)
- [x] T008 [S0203] Export new preview helper contracts through the agent barrel (`src/agent/index.ts`)

---

## Implementation (7 tasks)

Dry-run planner behavior, adapters, runtime handling, and documentation sync.

- [x] T009 [S0203] Implement create, update, skip, conflict, and excluded action planning with no filesystem writes or staged note mutations (`src/agent/framework-update-preview.ts`)
- [x] T010 [S0203] Implement candidate content safety checks for credential-like values and private path hints with redacted failure-path handling (`src/agent/framework-update-preview.ts`)
- [x] T011 [S0203] Preserve duplicate in-flight preview protection with cleanup on scope exit for all acquired resources (`src/agent/framework-update-preview.ts`)
- [x] T012 [S0203] Update CLI preview adapter for repository-root validation, candidate parsing, stable JSON output, and nonzero issue or conflict exits (`scripts/preview-framework-update.ts`)
- [x] T013 [S0203] Keep runtime preview command outcome dry-run after implemented status with duplicate-trigger prevention while in-flight (`src/agent/runtime-command-handlers.ts`)
- [x] T014 [S0203] Mark `voidbrain.preview-framework-update` implemented for dry-run behavior in the canonical command catalog (`src/agent/command-catalog.ts`)
- [x] T015 [S0203] Synchronize dry-run preview status and apply deferral across agent surfaces and human docs (`docs/agent-surfaces-commands.md`)

---

## Testing (3 tasks)

Regression coverage and validation gates.

- [x] T016 [S0203] [P] Add framework update preview unit tests for normalization, exclusions, action classification, conflicts, deterministic output, and duplicate previews (`test/framework-update-preview.test.ts`)
- [x] T017 [S0203] Expand agent command and surface tests for implemented preview status, runtime dry-run outcome, and documentation compatibility (`test/agent-surfaces-commands.test.ts`)
- [x] T018 [S0203] Run `bun run preview:framework-update`, `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate` (`package.json`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
