# Session 04: Offline Embeddings and Index Compatibility

**Session ID**: `phase03-session04-offline-embeddings-index-compatibility`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Make semantic indexing and retrieval resilient across offline embedding models,
local runtime outages, and embedding model family changes.

---

## Scope

### In Scope (MVP)

- Key semantic index compatibility by embedding model family and provider role.
- Detect stale, missing, incompatible, canceled, and provider-blocked semantic
  index states before retrieval uses vectors.
- Provide lexical fallback and reindex guidance when offline embeddings are not
  ready.
- Preserve indexing progress, cancellation, source path counts, and validation
  output without storing raw note bodies or provider transport state.

### Out of Scope

- Smart graph visualization work.
- Large-vault performance tuning beyond compatibility and fallback behavior.
- Non-text attachment embeddings.

---

## Prerequisites

- [ ] Session 03 completed.
- [ ] Existing indexing runtime, retrieval, semantic index, provider preflight,
      and runtime status services are available.
- [ ] Synthetic vault indexing fixtures are available.

---

## Deliverables

1. Semantic index compatibility checks for local and OpenAI-compatible embedding
   profiles.
2. Retrieval fallback and reindex guidance for offline or incompatible
   embeddings.
3. Tests covering model switches, local runtime outage, capability mismatch,
   cancellation, and stale index states.

---

## Success Criteria

- [ ] Retrieval does not use semantic vectors when the active embedding model
      family is stale, missing, incompatible, or provider-blocked.
- [ ] Lexical fallback remains available when semantic readiness fails closed.
- [ ] Reindex guidance names provider IDs, model IDs, index IDs, and readiness
      codes without exposing private note bodies.
- [ ] Indexing tests pass for offline and compatibility failure paths.
