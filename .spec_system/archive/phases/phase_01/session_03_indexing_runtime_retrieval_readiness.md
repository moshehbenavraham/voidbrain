# Session 03: Indexing Runtime and Retrieval Readiness

**Session ID**: `phase01-session03-indexing-runtime-retrieval-readiness`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Run vault indexing through Obsidian runtime APIs with progress, cancellation, freshness tracking, and retrieval readiness status.

---

## Scope

### In Scope (MVP)

- Orchestrate background lexical and optional semantic indexing over markdown notes.
- Report indexed, skipped, stale, failed, and current-path progress without exposing note content in logs.
- Support cancellation and safe retry for index operations.
- Surface retrieval readiness in settings and chat entry points.
- Keep semantic indexing behind provider capability and disclosure checks.

### Out of Scope

- Smart graph clustering and lasso selection.
- Non-markdown attachment indexing beyond explicit metadata placeholders.
- Hosted database or external vector-store dependencies.

---

## Prerequisites

- [ ] Session 01 completed.
- [ ] Session 02 completed for semantic provider selection.
- [ ] Phase 00 indexing and retrieval services are available.

---

## Deliverables

1. Obsidian-backed indexing orchestrator with progress, cancellation, and retry state.
2. Retrieval readiness status for lexical, semantic, stale, and failed states.
3. Settings controls for reindex, cancel, and index report review.
4. Tests covering fixture vault indexing, stale-state detection, and cancellation outcomes.

---

## Success Criteria

- [ ] Indexing does not write generated notes or send vault content to a provider without explicit approval.
- [ ] Progress and errors include useful paths while avoiding raw hidden provider state.
- [ ] Retrieval readiness is available before chat workflows run.
- [ ] Index validation stays deterministic for synthetic fixtures.
