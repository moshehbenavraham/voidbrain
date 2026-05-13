# Task Checklist

**Session ID**: `phase02-session05-similar-note-placement-suggestions`
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

- [x] T001 [S0205] Verify analyzer state, session 04 completion artifacts, and session 05 stub scope (`.spec_system/PRD/phase_02/session_05_similar_note_and_placement_suggestions.md`)
- [x] T002 [S0205] Review parsed note, retrieval, maintenance, runtime status, and staged-change contracts (`src/types/retrieval.ts`)
- [x] T003 [S0205] Review staged update, frontmatter edit, move, duplicate, and conflict behavior (`src/agent/staged-change-service.ts`)

---

## Foundation (6 tasks)

Core contracts, fixtures, signal extraction, and ranking boundaries.

- [x] T004 [S0205] [P] Create similar-note suggestion contracts for signal evidence, suggestion kinds, confidence, stageability, recovery, and staging results with types matching declared contract; exhaustive enum handling (`src/types/suggestions.ts`)
- [x] T005 [S0205] [P] Create synthetic related-note fixtures for duplicate links, tags, aliases, folders, frontmatter placement, retrieval evidence, and active staged changes (`test/fixtures/vault/similar-note-suggestion-fixtures.ts`)
- [x] T006 [S0205] Define suggestion ID, normalized signal, score, confidence, rank reason, and deterministic sorting helpers (`src/agent/similar-note-suggestion-service.ts`)
- [x] T007 [S0205] Extract comparable note signals from parsed notes for wikilinks, tags, headings, aliases, source paths, folder segments, and retrieval evidence (`src/agent/similar-note-suggestion-service.ts`)
- [x] T008 [S0205] Score related-note candidates from lexical, semantic, wikilink, tag, heading, alias, folder, and source-path evidence without raw note body leakage (`src/agent/similar-note-suggestion-service.ts`)
- [x] T009 [S0205] Export suggestion service constructors and public suggestion contracts through the agent barrel (`src/agent/index.ts`)

---

## Implementation (7 tasks)

Planner behavior, staged-change handoff, runtime summary, and documentation sync.

- [x] T010 [S0205] Implement deterministic similar-note and placement plan generation with bounded candidate limits, validated filters, and deterministic ordering (`src/agent/similar-note-suggestion-service.ts`)
- [x] T011 [S0205] Implement duplicate prevention for existing wikilinks, aliases, tags, related-notes values, destination paths, and active staged changes (`src/agent/similar-note-suggestion-service.ts`)
- [x] T012 [S0205] Implement wikilink and related-notes staging through existing staged-change flows with duplicate-trigger prevention while in-flight (`src/agent/similar-note-suggestion-service.ts`)
- [x] T013 [S0205] Implement tag, alias, folder, and frontmatter placement staging with schema-validated input and explicit error mapping (`src/agent/similar-note-suggestion-service.ts`)
- [x] T014 [S0205] Add optional similar-note suggestion runtime status input and summary contracts with exhaustive status handling (`src/types/runtime.ts`)
- [x] T015 [S0205] Summarize suggestion totals, confidence counts, stageable items, report-only items, blocked items, and sample paths in runtime status (`src/agent/runtime-status.ts`)
- [x] T016 [S0205] Document similar-note and placement suggestions, citations, duplicate prevention, staged review, and recovery fields (`docs/similar-note-placement-suggestions.md`)

---

## Testing (4 tasks)

Regression coverage and validation gates.

- [x] T017 [S0205] [P] Add planner tests for signal extraction, ranking, confidence, citations, deterministic ordering, and low-confidence suggestions (`test/similar-note-suggestion-service.test.ts`)
- [x] T018 [S0205] [P] Add staged handoff tests for wikilinks, frontmatter edits, placement moves, duplicate blocking, in-flight prevention, and validation failures (`test/similar-note-suggestion-service.test.ts`)
- [x] T019 [S0205] Add runtime status tests for suggestion summaries synchronized with maintenance and staged-change readiness (`test/runtime-status.test.ts`)
- [x] T020 [S0205] Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate` (`package.json`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for the updateprd workflow step

---

## Next Steps

Session complete. Run `updateprd` to sync PRD and state records.
