# Task Checklist

**Session ID**: `phase02-session06-batch-source-ingestion-queue`
**Total Tasks**: 21
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
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Setup (3 tasks)

Initial configuration and implementation context.

- [x] T001 [S0206] Verify completed source ingestion, staged-change, hot cache, recovery, provider preflight, and similar-note prerequisites (`.spec_system/specs/phase02-session06-batch-source-ingestion-queue/implementation-notes.md`)
- [x] T002 [S0206] [P] Create session security checklist for provider review, staged writes, redacted queue summaries, cancellation, retry, and recovery evidence (`.spec_system/specs/phase02-session06-batch-source-ingestion-queue/security-compliance.md`)
- [x] T003 [S0206] [P] Audit existing single-source ingestion, hot cache, runtime status, modal, command catalog, and docs seams for batch queue integration (`.spec_system/specs/phase02-session06-batch-source-ingestion-queue/implementation-notes.md`)

---

## Foundation (5 tasks)

Core contracts, fixtures, service skeletons, and status foundations.

- [x] T004 [S0206] [P] Define batch ingestion queue contracts for item status, queue summary, provider review, cancellation, retry, staged output, and recovery records with types matching declared contracts and exhaustive enum handling (`src/types/ingestion-queue.ts`)
- [x] T005 [S0206] [P] Create synthetic batch ingestion fixtures for safe sources, duplicates, provider denial, citation failures, cancellation, retry, and partial staged output (`test/fixtures/vault/source-ingestion-queue-fixtures.ts`)
- [x] T006 [S0206] Create queue service skeleton over `SourceIngestionStagingService` with bounded concurrency, duplicate-trigger prevention while in-flight, and cleanup on scope exit for all acquired resources (`src/agent/source-ingestion-queue-service.ts`)
- [x] T007 [S0206] [P] Create ingestion queue store for queued, running, staged, failed, canceled, retryable, and recovered states with scoped rollback on persistence error (`src/stores/ingestion-queue-store.ts`)
- [x] T008 [S0206] Extend hot cache and runtime status contracts for bounded queue summaries, item paths, staged IDs, validation output, and recovery references (`src/types/hot-cache.ts`, `src/types/runtime.ts`)

---

## Implementation (9 tasks)

Main batch queue behavior, runtime integration, and documentation.

- [x] T009 [S0206] Implement enqueue validation, stable item IDs, deterministic ordering, duplicate source detection, and bounded queue summaries with schema-validated input and explicit error mapping (`src/agent/source-ingestion-queue-service.ts`)
- [x] T010 [S0206] Implement bounded worker scheduling, queued/running/staged/failed/canceled/skipped transitions, and cancellation with cleanup on scope exit for timers and abort controllers (`src/agent/source-ingestion-queue-service.ts`)
- [x] T011 [S0206] Implement per-item provider review and preflight before provider-assisted extraction with timeout, retry/backoff, failure-path handling, and no silent cloud fallback (`src/agent/source-ingestion-queue-service.ts`)
- [x] T012 [S0206] Implement staged output aggregation through `SourceIngestionStagingService` with idempotency protection, transaction boundaries, and compensation metadata on partial failure (`src/agent/source-ingestion-queue-service.ts`)
- [x] T013 [S0206] Implement redacted hot cache queue summaries for queue ID, item IDs, source paths, target paths, provider decisions, staged-change IDs, validation output, and retry guidance without raw source bodies (`src/agent/hot-cache-service.ts`)
- [x] T014 [S0206] Implement runtime status summary for queued, running, staged, failed, canceled, retryable, provider-blocked, and citation-blocked items with bounded sample paths (`src/agent/runtime-status.ts`)
- [x] T015 [S0206] Extend source ingestion modal for batch input, queue progress, cancel, retry, staged IDs, loading, empty, error, offline, and re-entry states with platform-appropriate accessibility labels, focus management, and input support (`src/views/source-ingestion-modal.ts`)
- [x] T016 [S0206] Wire queue service/store creation, modal options, plugin-owned persistence, hot cache capture, runtime status refresh, exports, and unload cleanup (`src/main.ts`, `src/agent/index.ts`)
- [x] T017 [S0206] Synchronize `voidbrain.ingest-source` command catalog, agent surfaces, and human docs for bounded batch queue behavior, provider review, citations, staged changes, cancellation, retry, and recovery details (`src/agent/command-catalog.ts`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `skills/voidbrain/SKILL.md`, `docs/agent-surfaces-commands.md`, `docs/batch-source-ingestion-queue.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T018 [S0206] [P] Add queue service tests for ordering, bounded concurrency, duplicate sources, provider gates, citation checks, cancellation, retry, staged output, partial failures, and recovery summaries (`test/source-ingestion-queue.test.ts`)
- [x] T019 [S0206] [P] Add store and modal tests for queue input, loading, empty, error, offline, queued, running, canceled, retry, staged IDs, focus behavior, cleanup, and no direct vault writes (`test/source-ingestion-modal.test.ts`)
- [x] T020 [S0206] [P] Extend hot cache, runtime status, plugin lifecycle, and fixture safety tests for redacted queue summaries, persistence recovery, command wiring, unload cleanup, and sample paths (`test/hot-cache-service.test.ts`, `test/runtime-status.test.ts`, `test/plugin-lifecycle.test.ts`, `test/fixtures/vault/source-ingestion-queue-fixtures.ts`)
- [x] T021 [S0206] Run validation commands and record results, residual risks, command ID, queue ID, item IDs, source paths, cache path, staged-change IDs, validation output, and recovery details (`.spec_system/specs/phase02-session06-batch-source-ingestion-queue/implementation-notes.md`)

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

Run the implement workflow step to begin AI-led implementation.
