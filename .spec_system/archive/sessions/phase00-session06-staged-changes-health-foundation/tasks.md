# Task Checklist

**Session ID**: `phase00-session06-staged-changes-health-foundation`
**Total Tasks**: 20
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
| Setup | 2 | 2 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0006] Verify completed Session 02-05 prerequisites, fixture boundaries, and validation commands (`.spec_system/specs/phase00-session06-staged-changes-health-foundation/implementation-notes.md`)
- [x] T002 [S0006] Create session security and recovery checklist skeleton for staged-change and health work (`.spec_system/specs/phase00-session06-staged-changes-health-foundation/security-compliance.md`)

---

## Foundation (6 tasks)

Core structures and base implementations.

- [x] T003 [S0006] Extend staged-change operation and status unions for create, update, delete, move, and frontmatter edits with exhaustive enum handling (`src/types/vault.ts`)
- [x] T004 [S0006] Add staged-change diff, conflict, destructive review, and recovery metadata interfaces (`src/types/vault.ts`)
- [x] T005 [S0006] Update durable support validation for expanded staged-change records with schema-validated input and explicit error mapping (`src/utils/vault-validation.ts`)
- [x] T006 [S0006] [P] Define vault health report severity, finding kind, evidence, remediation, and scanner result contracts (`src/types/health.ts`)
- [x] T007 [S0006] [P] Create deterministic staged-change ID, content hash, and line diff helper scaffolding (`src/agent/staged-change-service.ts`)
- [x] T008 [S0006] [P] Create vault health scanner input contracts and deterministic sorting helpers (`src/agent/vault-health.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S0006] Implement create, update, delete, move, and frontmatter staging builders with validated vault paths and duplicate-trigger prevention while in-flight (`src/agent/staged-change-service.ts`)
- [x] T010 [S0006] Implement before/after diff context and conflict detection for missing, changed, or colliding notes with schema-validated input and explicit error mapping (`src/agent/staged-change-service.ts`)
- [x] T011 [S0006] Implement recovery metadata capture for command ID, target path, staged-change ID, backup intent, rejected changes, failed applies, and validation output (`src/agent/staged-change-service.ts`)
- [x] T012 [S0006] Implement orphan and broken wikilink health checks from parsed fixture notes with bounded deterministic ordering (`src/agent/vault-health.ts`)
- [x] T013 [S0006] Implement stale index health checks using freshness snapshots with explicit missing, extra, partial, and stale source evidence (`src/agent/vault-health.ts`)
- [x] T014 [S0006] Implement missing citation health checks for generated summaries and source-grounded notes with schema-validated input (`src/agent/vault-health.ts`)
- [x] T015 [S0006] Export staged-change and health primitives from the agent barrel with exhaustive enum handling (`src/agent/index.ts`)
- [x] T016 [S0006] Document staged-change and health foundation contracts without secrets, provider calls, or direct user-vault apply behavior (`docs/staged-changes-health-foundation.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0006] [P] Write staged-change service tests for safe staging, before/after diffs, destructive review requirements, stale conflicts, and duplicate-trigger prevention (`test/staged-change-service.test.ts`)
- [x] T018 [S0006] [P] Write vault health scanner tests for orphans, broken links, stale indexes, and missing citations using synthetic fixtures (`test/vault-health.test.ts`)
- [x] T019 [S0006] Update synthetic runtime-state staged-change fixture for expanded metadata while preserving fixture-safety guarantees (`test/fixtures/vault/.voidbrain/runtime-state.json`)
- [x] T020 [S0006] Run validation commands and record results for agent surfaces, fixture safety, agent docs, and full validation (`.spec_system/specs/phase00-session06-staged-changes-health-foundation/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness.
