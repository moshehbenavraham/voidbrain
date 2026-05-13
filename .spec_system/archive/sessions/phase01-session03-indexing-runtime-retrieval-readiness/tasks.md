# Task Checklist

**Session ID**: `phase01-session03-indexing-runtime-retrieval-readiness`
**Total Tasks**: 23
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
| Testing | 5 | 5 | 0 |
| **Total** | **23** | **23** | **0** |

---

## Setup (3 tasks)

Initial configuration and implementation context.

- [x] T001 [S0103] Verify runtime, provider preflight, vectorstore, settings, and fixture prerequisites and record the implementation baseline (`.spec_system/specs/phase01-session03-indexing-runtime-retrieval-readiness/implementation-notes.md`)
- [x] T002 [S0103] [P] Create synthetic runtime indexing fixtures and Obsidian mock file helpers with no private paths or secret-like values (`test/fixtures/vault/runtime-indexing-fixtures.ts`)
- [x] T003 [S0103] [P] Audit current indexing, runtime status, and settings integration points for reuse decisions (`.spec_system/specs/phase01-session03-indexing-runtime-retrieval-readiness/implementation-notes.md`)

---

## Foundation (6 tasks)

Core contracts, adapters, and service foundations.

- [x] T004 [S0103] Create runtime indexing contracts for job actions, reports, readiness, skipped paths, failed paths, and subscriber state (`src/types/indexing-runtime.ts`)
- [x] T005 [S0103] Extend shared retrieval contracts only where runtime readiness fields must be reusable outside the runtime service (`src/types/retrieval.ts`)
- [x] T006 [S0103] [P] Create Obsidian vault markdown source adapter with excluded-folder filtering, max-size skipping, deterministic ordering, and bounded diagnostics (`src/vectorstore/obsidian-index-source.ts`)
- [x] T007 [S0103] Implement runtime indexing coordinator for lexical reindex, freshness checks, duplicate-trigger prevention while in-flight, cancellation, and retry (`src/vectorstore/indexing-runtime-service.ts`)
- [x] T008 [S0103] Extend runtime status input contracts for index reports, progress, semantic readiness, and recent failures (`src/types/runtime.ts`)
- [x] T009 [S0103] Export runtime indexing source and coordinator modules from the vectorstore barrel (`src/vectorstore/index.ts`)

---

## Implementation (9 tasks)

Main runtime, UI, provider-gate, and status implementation.

- [x] T010 [S0103] Wire indexing runtime ownership into plugin lifecycle with startup opt-in and cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T011 [S0103] Add indexing runtime actions to settings tab options for reindex, cancel, retry, and report inspection with typed contracts (`src/views/settings-tab.ts`)
- [x] T012 [S0103] Add reindex, cancel, retry, and report controls to the Indexing settings section with duplicate-trigger prevention while in-flight (`src/views/settings-tab.ts`)
- [x] T013 [S0103] Surface lexical readiness, progress, stale paths, skipped paths, failed paths, and current path without raw note content (`src/agent/runtime-status.ts`)
- [x] T014 [S0103] Render index report details and sampled paths in the status view with explicit loading, empty, error, and offline states (`src/views/status-view.ts`)
- [x] T015 [S0103] Gate semantic indexing readiness through provider role, capability, auth, trust, and disclosure preflight before any embedding workflow runs (`src/vectorstore/indexing-runtime-service.ts`)
- [x] T016 [S0103] Update planned chat and ingestion command notices to mention retrieval readiness before provider work (`src/agent/runtime-command-handlers.ts`)
- [x] T017 [S0103] Extend Obsidian mocks for markdown files, file stats, vault reads, metadata cache events, and status control assertions (`test/__mocks__/obsidian.ts`)
- [x] T018 [S0103] Add or recover indexing preference migration only if new persisted runtime fields are introduced (`src/utils/settings.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T019 [S0103] [P] Add runtime indexing tests for source collection, progress, ready state, stale detection, cancellation, retry, and duplicate-trigger prevention (`test/indexing-runtime-retrieval-readiness.test.ts`)
- [x] T020 [S0103] [P] Extend runtime status tests for fresh, stale, missing, canceled, error, skipped, failed, and semantic gate summaries (`test/runtime-status.test.ts`)
- [x] T021 [S0103] [P] Extend lifecycle tests for indexing runtime startup opt-in, settings action wiring, status refresh, and cancel-on-unload behavior (`test/plugin-lifecycle.test.ts`)
- [x] T022 [S0103] [P] Extend settings migration tests for any new indexing preferences and secret-free persistence (`test/plugin-settings-runtime.test.ts`)
- [x] T023 [S0103] Run validation commands and record results, residual risks, command ID, target paths, and recovery details (`.spec_system/specs/phase01-session03-indexing-runtime-retrieval-readiness/implementation-notes.md`)

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
