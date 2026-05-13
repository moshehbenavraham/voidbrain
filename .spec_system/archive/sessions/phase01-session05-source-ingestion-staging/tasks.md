# Task Checklist

**Session ID**: `phase01-session05-source-ingestion-staging`
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

- [x] T001 [S0105] Verify completed provider preflight, indexing runtime, grounded chat, staged-change, command catalog, fixture, and validation prerequisites (`.spec_system/specs/phase01-session05-source-ingestion-staging/implementation-notes.md`)
- [x] T002 [S0105] [P] Audit current `voidbrain.ingest-source` placeholder behavior and synchronized markdown command surfaces for required status changes (`.spec_system/specs/phase01-session05-source-ingestion-staging/implementation-notes.md`)
- [x] T003 [S0105] [P] Create session security and recovery checklist for source content privacy, provider preflight, staged IDs, validation output, and no direct note mutation (`.spec_system/specs/phase01-session05-source-ingestion-staging/security-compliance.md`)

---

## Foundation (7 tasks)

Core contracts, preview services, renderer, and state foundations.

- [x] T004 [S0105] Define ingestion contracts for source inputs, previews, extraction plans, generated artifacts, citations, provider decisions, staged outputs, and recovery records with types matching declared contracts and exhaustive enum handling (`src/types/ingestion.ts`)
- [x] T005 [S0105] Create source intake preview service skeleton with schema-validated input and explicit error mapping for paths, source types, URL approval, duplicate status, and provider requirements (`src/agent/source-ingestion-intake-service.ts`)
- [x] T006 [S0105] [P] Create citation validation helpers for source paths, source records, wikilinks, summary citations, and recoverable validation output (`src/agent/source-citation-validation.ts`)
- [x] T007 [S0105] [P] Create source ingestion markdown renderer for source, entity, concept, and summary notes with stable frontmatter, wikilinks, and citation sections (`src/agent/source-ingestion-renderer.ts`)
- [x] T008 [S0105] Create ingestion staging service skeleton with duplicate-trigger prevention while in-flight and transaction boundaries for multi-artifact staged output (`src/agent/source-ingestion-staging-service.ts`)
- [x] T009 [S0105] [P] Create ingestion staging store for preview, staging progress, failure, retry, staged IDs, and redacted persistence with scoped rollback on error (`src/stores/ingestion-staging-store.ts`)
- [x] T010 [S0105] [P] Create synthetic ingestion fixtures for safe sources, duplicates, unsafe paths, provider-denied paths, and expected staged artifact metadata (`test/fixtures/vault/source-ingestion-fixtures.ts`)

---

## Implementation (11 tasks)

Main source ingestion staging, command, and documentation implementation.

- [x] T011 [S0105] Implement source preview for markdown files, text files, pasted content, and approved URL source records with bounded input size, denied/restricted handling, and deterministic target paths (`src/agent/source-ingestion-intake-service.ts`)
- [x] T012 [S0105] Implement duplicate source detection from content hashes, source manifests, existing notes, and active staged changes with deterministic conflict ordering (`src/agent/source-ingestion-intake-service.ts`)
- [x] T013 [S0105] Implement provider extraction plan checks through existing provider preflight with timeout, retry/backoff, and failure-path handling for optional provider-assisted summaries (`src/agent/source-ingestion-staging-service.ts`)
- [x] T014 [S0105] Implement deterministic local extraction fallback for source metadata, candidate entities, candidate concepts, and summary outline when provider use is denied or unavailable (`src/agent/source-ingestion-staging-service.ts`)
- [x] T015 [S0105] Implement generated source, entity, concept, and summary markdown rendering with source-path citations, stable frontmatter, wikilinks, and ASCII-safe output (`src/agent/source-ingestion-renderer.ts`)
- [x] T016 [S0105] Implement citation validation gate that blocks staging when generated notes lack source paths, source records, summary citations, or safe target paths (`src/agent/source-citation-validation.ts`)
- [x] T017 [S0105] Implement staged-change creation for each generated note using `StagedChangeService` with idempotency protection, transaction boundaries, and compensation on partial failure (`src/agent/source-ingestion-staging-service.ts`)
- [x] T018 [S0105] Implement ingestion modal preview, approval, stage, retry, loading, empty, error, denied URL, and cleanup states with platform-appropriate accessibility labels, focus management, and input support (`src/views/source-ingestion-modal.ts`)
- [x] T019 [S0105] Wire ingestion command execution, service/store creation, modal opening, provider-denial notices, plugin-owned persistence, and cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T020 [S0105] Update `voidbrain.ingest-source` command catalog status, prerequisites, outputs, recovery behavior, and limitations after runtime staging is wired (`src/agent/command-catalog.ts`)
- [x] T021 [S0105] Synchronize markdown command surfaces for implemented ingestion staging while preserving local-first, staged changes, provider secrets, citations, dry-run, and recovery safety phrases (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `skills/voidbrain/SKILL.md`, `docs/agent-surfaces-commands.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T022 [S0105] [P] Add ingestion staging service tests for preview, duplicate detection, unsafe paths, provider preflight, deterministic fallback, staged IDs, recovery metadata, and no direct note mutation (`test/source-ingestion-staging.test.ts`)
- [x] T023 [S0105] [P] Add modal and lifecycle tests for source input, preview, approve, stage, retry, provider denial, close/unload cleanup, focus behavior, and no vault writes (`test/source-ingestion-modal.test.ts`)
- [x] T024 [S0105] [P] Extend plugin lifecycle and Obsidian mocks for ingestion command registration, modal lifecycle, vault reads, notices, plugin data persistence, and cleanup assertions (`test/plugin-lifecycle.test.ts`, `test/__mocks__/obsidian.ts`)
- [x] T025 [S0105] Run validation commands and record results, residual risks, command ID, source path, staged-change IDs, target paths, validation output, and recovery details (`.spec_system/specs/phase01-session05-source-ingestion-staging/implementation-notes.md`)

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
