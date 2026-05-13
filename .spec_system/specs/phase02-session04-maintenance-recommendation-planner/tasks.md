# Task Checklist

**Session ID**: `phase02-session04-maintenance-recommendation-planner`
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
| Setup | 3 | 3 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial state verification and service review.

- [x] T001 [S0204] Verify session 04 prerequisites, analyzer state, and existing session 03 completion artifacts (`.spec_system/state.json`)
- [x] T002 [S0204] Review existing health, retrieval, index freshness, staged-change, and runtime status contracts (`src/types/health.ts`)
- [x] T003 [S0204] Review safe repair staging and duplicate active staged-change behavior (`src/agent/vault-health-runtime-service.ts`)

---

## Foundation (6 tasks)

Core contracts, fixtures, and deterministic planner boundaries.

- [x] T004 [S0204] [P] Create maintenance recommendation contracts for categories, evidence, confidence, stageability, recovery, and staging results with types matching declared contract; exhaustive enum handling (`src/types/maintenance.ts`)
- [x] T005 [S0204] [P] Create synthetic maintenance fixtures for health findings, retrieval results, stale indexes, active staged changes, and current note content (`test/fixtures/vault/maintenance-recommendation-fixtures.ts`)
- [x] T006 [S0204] Define recommendation ID, severity, confidence, rank reason, and deterministic sorting helpers (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T007 [S0204] Map vault health findings into recommendation evidence with affected paths, source records, report IDs, and report-only defaults (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T008 [S0204] Map index freshness and retrieval result evidence into bounded recommendation records without raw note body leakage (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T009 [S0204] Export maintenance recommendation contracts and planner constructors through project barrels (`src/agent/index.ts`)

---

## Implementation (7 tasks)

Planner behavior, staged repair handoff, runtime status, and documentation sync.

- [x] T010 [S0204] Implement deterministic recommendation planning for health, retrieval, index, citation, and staged-change inputs (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T011 [S0204] Implement safe missing-citation recommendation staging through existing vault health staged repair flow with duplicate-trigger prevention while in-flight (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T012 [S0204] Block report-only, missing-evidence, unsupported-path, and active-staged-change recommendation staging with explicit error mapping (`src/agent/maintenance-recommendation-planner.ts`)
- [x] T013 [S0204] Add maintenance recommendation runtime status input and summary types with exhaustive status handling (`src/types/runtime.ts`)
- [x] T014 [S0204] Summarize recommendation totals, stageable items, report-only items, blocked items, and sample paths in runtime status (`src/agent/runtime-status.ts`)
- [x] T015 [S0204] Preserve command catalog compatibility for health-check-driven recommendations without adding stale command IDs (`test/agent-surfaces-commands.test.ts`)
- [x] T016 [S0204] Document recommendation planning, citations, report-only findings, staged-change handoff, and recovery fields (`docs/vault-health-repair-staging.md`)

---

## Testing (4 tasks)

Regression coverage and validation gates.

- [x] T017 [S0204] [P] Add planner tests for ranking, confidence, evidence mapping, deterministic ordering, and report-only findings (`test/maintenance-recommendation-planner.test.ts`)
- [x] T018 [S0204] [P] Add staged handoff tests for missing-citation repair, duplicate active staged changes, in-flight duplicate prevention, and validation failures (`test/maintenance-recommendation-planner.test.ts`)
- [x] T019 [S0204] Add runtime status tests for recommendation summaries synchronized with health, index, and staged-change readiness (`test/runtime-status.test.ts`)
- [x] T020 [S0204] Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate` (`package.json`)

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

Session validated and ready for `updateprd`.
