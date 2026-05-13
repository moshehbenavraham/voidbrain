# Session 04: Grounded Vault Chat

**Session ID**: `phase01-session04-grounded-vault-chat`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Implement retrieval-grounded vault chat that streams or returns answers with citations to vault paths, headings, and source records.

---

## Scope

### In Scope (MVP)

- Build chat view state, input, context chips, retrieval preview, and answer timeline.
- Use retrieval results with citation metadata before provider synthesis.
- Run provider privacy preflight before any cloud call with private vault content.
- Persist recoverable thread state and draft input locally.
- Show weak retrieval, missing provider, context-limit, and generation failure states.

### Out of Scope

- Source ingestion and generated note creation.
- Automated vault edits from chat responses.
- Smart graph selection as a context source.

---

## Prerequisites

- [ ] Session 02 completed.
- [ ] Session 03 completed.
- [ ] Retrieval services can provide source paths, headings, snippets, and source records.

---

## Deliverables

1. Cited vault chat service and UI flow.
2. Provider invocation path guarded by privacy and capability checks.
3. Thread persistence, retry, branch, and draft recovery primitives.
4. Tests for citation requirements, preflight blocking, weak retrieval, and failure recovery.

---

## Success Criteria

- [ ] User-facing answers grounded in retrieval include citations to vault paths, headings, and source records.
- [ ] Cloud calls are blocked without explicit provider review.
- [ ] Failed chat attempts preserve draft input and recoverable thread metadata.
- [ ] Chat does not apply note mutations directly.
