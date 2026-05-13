# Session Specification

**Session ID**: `phase03-session04-offline-embeddings-index-compatibility`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens semantic indexing and retrieval behavior when embedding providers are offline, blocked by privacy preflight, or changed to an incompatible model family. It builds on the provider transport invocation boundary from session 03 and makes embedding readiness visible as a deterministic compatibility decision instead of an implicit runtime assumption.

The work matters because semantic vectors are only safe when they match the active embedding provider role, model family, dimensions, source fingerprints, and privacy decision. If those inputs are stale, missing, incompatible, canceled, or provider-blocked, retrieval must fail closed for semantic vectors while lexical retrieval remains available with clear reindex guidance.

This is an index compatibility and fallback session. It should introduce typed semantic compatibility records, runtime compatibility evaluation, lexical fallback selection, bounded recovery details, and focused tests. It should not add real provider SDK adapters, non-text attachment embeddings, smart graph visualization, or large-vault performance tuning beyond compatibility and fallback behavior.

---

## 2. Objectives

1. Define semantic index compatibility contracts for active embedding provider, model family, dimensions, source fingerprints, readiness code, fallback mode, and reindex guidance.
2. Detect stale, missing, incompatible, canceled, provider-blocked, and offline semantic index states before retrieval can use semantic vectors.
3. Keep lexical retrieval available as the fallback path when semantic readiness fails closed, with deterministic ordering and bounded result limits.
4. Preserve recovery metadata for indexing and retrieval without storing raw note bodies, embedding text chunks, credentials, authorization headers, prompt bodies, or hidden provider state.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-local-runtime-provider-profiles` - Provides local runtime provider profiles, readiness records, and no-secret diagnostics.
- [x] `phase03-session02-openai-compatible-provider-profiles` - Provides endpoint classification, trust, auth readiness, and model capability handling.
- [x] `phase03-session03-provider-transport-invocation-boundaries` - Provides embedding invocation contracts, timeout, cancellation, retry, duplicate guards, and redacted diagnostics.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides lexical indexing runtime, retrieval readiness, freshness, and runtime index controls.
- [x] `phase01-session04-grounded-vault-chat` - Provides cited vault chat over retrieval results and provider preflight.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest indexing, retrieval, provider, runtime status, settings, and grounded chat fixture patterns under `test/`.
- Existing semantic index adapter, embedding provider invoker, indexing runtime service, lexical retrieval composition, and runtime status surfaces.
- Strict TypeScript contracts under `src/types/retrieval.ts`, `src/types/indexing-runtime.ts`, `src/types/runtime.ts`, and `src/types/provider-invocation.ts`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/voidbrain`.
- Validation runs from the repository root with Bun available.
- Tests use synthetic vault and provider fixtures only.
- No live local runtime, cloud provider call, private vault file, credential, authorization header, remote account, or network access is required.

---

## 4. Scope

### In Scope (MVP)
- User can see whether semantic indexing is ready, disabled, missing, stale, incompatible, canceled, or provider-blocked - expose a typed compatibility state with safe message and recovery fields.
- User can keep querying through lexical retrieval when semantic vectors cannot be trusted - choose lexical fallback with deterministic ordering and bounded limits.
- User can receive reindex guidance for embedding provider/model switches - include provider IDs, model IDs, model family, index IDs, source path counts, readiness codes, and validation output.
- Developer can prevent stale semantic vectors from being used - verify active embedding family, dimensions, source fingerprints, and readiness before semantic search is eligible.
- Developer can inspect failures safely - preserve command IDs, provider IDs, model IDs, index IDs, source path counts, report IDs, readiness codes, attempt statuses, and validation output without raw private content.
- Developer can validate offline and compatibility paths locally - add synthetic tests for model switches, local runtime outage, provider-blocked embeddings, stale indexes, canceled embedding attempts, lexical fallback, and reindex guidance.

### Out of Scope (Deferred)
- Real embedding provider SDK adapters for Ollama, OpenAI, Anthropic, OpenRouter, Gemini, or custom endpoints - *Reason: session 03 defined adapter boundaries; vendor adapters remain later work.*
- Full semantic vector search ranking and hybrid score tuning - *Reason: this session gates compatibility and fallback, not large-scale retrieval ranking.*
- Smart graph visualization or canvas generation - *Reason: outside Phase 03 provider hardening scope.*
- Non-text attachment embeddings for PDFs, images, audio, or video - *Reason: MVP indexing currently targets markdown text notes.*
- Provider troubleshooting UI and recovery documentation - *Reason: this belongs to Session 05.*
- Direct note mutation from embedding or retrieval output - *Reason: note edits remain staged through review-first workflows.*

---

## 5. Technical Approach

### Architecture
Add a semantic index compatibility layer under `src/vectorstore/` with typed contracts in `src/types/retrieval.ts` and runtime state fields in `src/types/indexing-runtime.ts`. The compatibility layer should compare the active embedding provider/model family and dimensions against any semantic snapshot metadata and current lexical/source fingerprints. It should return a fail-closed decision whenever semantic vectors are missing, stale, incompatible, provider-blocked, canceled, or disabled.

Update `IndexingRuntimeService` to evaluate semantic readiness and semantic compatibility together whenever settings, lexical freshness, or runtime readiness refreshes. Keep semantic index state in memory and bounded; do not persist raw note bodies or embedding chunks. Retrieval composition should expose a lexical fallback decision so `GroundedVaultChatService` can keep answering from lexical results while recording safe validation and recovery metadata.

Runtime status and settings surfaces should show semantic compatibility, fallback mode, source path counts, and reindex guidance as short diagnostic text. They should reuse existing Obsidian lifecycle wiring in `src/main.ts` and keep domain logic testable in services and utility modules.

### Design Patterns
- Fail-closed semantic eligibility: semantic vectors are eligible only when readiness, model family, dimensions, and source fingerprints all match.
- Lexical fallback by design: retrieval remains available through lexical search when semantic compatibility fails.
- Contract-first modeling: add compatibility and fallback contracts before runtime services consume them.
- Bounded diagnostics: recovery records keep IDs, counts, codes, and validation output, never private note bodies or embedding chunks.
- Deterministic comparison: sort source fingerprints and fallback results before reporting state.
- Re-entry revalidation: settings and status refreshes recompute compatibility instead of reusing stale UI state.

### Technology Stack
- TypeScript 5.9 strict contracts.
- Vitest 4 for unit and integration-style service tests.
- Bun validation scripts.
- Existing Obsidian plugin settings and runtime status surfaces.
- Existing `src/vectorstore/semantic-index.ts`, `src/vectorstore/indexing-runtime-service.ts`, `src/vectorstore/retrieval-service.ts`, `src/providers/embedding-provider.ts`, and provider preflight services.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/vectorstore/semantic-index-compatibility.ts` | Evaluate semantic snapshot compatibility, fallback mode, and reindex guidance | ~240 |
| `test/fixtures/vault/semantic-index-compatibility-fixtures.ts` | Synthetic semantic snapshots, source fingerprints, provider states, and fallback probes | ~180 |
| `test/offline-embeddings-index-compatibility.test.ts` | Regression tests for semantic compatibility, fallback, and guidance | ~320 |
| `.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/implementation-notes.md` | Implementation notes for this session | ~100 |
| `.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/security-compliance.md` | Session security and privacy review | ~90 |
| `.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/validation.md` | Validation command results and residual failures | ~100 |
| `.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~90 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/retrieval.ts` | Add semantic compatibility, fallback, and reindex guidance contracts | ~120 |
| `src/types/indexing-runtime.ts` | Add semantic compatibility state and recovery fields to indexing runtime state | ~80 |
| `src/types/runtime.ts` | Allow runtime status input to carry semantic compatibility details | ~30 |
| `src/vectorstore/semantic-index.ts` | Align semantic snapshot validation and provider preparation with compatibility contracts | ~80 |
| `src/vectorstore/indexing-runtime-service.ts` | Evaluate semantic readiness, compatibility, lexical fallback, and guidance on refresh and reindex | ~180 |
| `src/vectorstore/retrieval-service.ts` | Add lexical fallback selection helper with bounded pagination and deterministic ordering | ~90 |
| `src/vectorstore/index.ts` | Export semantic compatibility helpers | ~10 |
| `src/agent/grounded-vault-chat-service.ts` | Respect semantic compatibility and record lexical fallback metadata during retrieval | ~100 |
| `src/agent/runtime-status.ts` | Surface semantic compatibility, fallback, and reindex guidance in index status | ~80 |
| `src/views/settings-tab.ts` | Show semantic compatibility and reindex guidance in runtime indexing controls | ~70 |
| `src/utils/settings.ts` | Confirm compatibility diagnostics remain runtime-only and are not persisted into settings | ~40 |
| `test/indexing-runtime-retrieval-readiness.test.ts` | Extend runtime readiness coverage for compatibility, outage, canceled, and stale states | ~160 |
| `test/indexing-retrieval-foundation.test.ts` | Extend semantic adapter and lexical fallback coverage | ~120 |
| `test/grounded-vault-chat.test.ts` | Verify chat uses lexical fallback when semantic vectors fail closed | ~120 |
| `test/runtime-status.test.ts` | Verify runtime status reports compatibility and guidance safely | ~100 |
| `test/plugin-settings-runtime.test.ts` | Verify semantic compatibility diagnostics are not persisted into settings | ~70 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Retrieval does not use semantic vectors when the active embedding model family is stale, missing, incompatible, canceled, or provider-blocked.
- [ ] Lexical fallback remains available when semantic readiness fails closed, with deterministic ordering and bounded result limits.
- [ ] Reindex guidance names provider IDs, model IDs, embedding model family, index IDs, source path counts, readiness codes, report IDs, and validation output.
- [ ] Runtime status and settings surfaces report semantic compatibility without exposing raw note bodies, embedding chunks, prompt bodies, credentials, authorization headers, private path hints, or hidden provider state.
- [ ] Compatibility checks handle local runtime outage, cloud-disabled embeddings, auth-not-ready embeddings, model family switches, dimension mismatches, stale source fingerprints, missing vectors, and cancellation.
- [ ] Existing indexing, retrieval, provider setup, grounded chat, and runtime status tests remain compatible with the new compatibility layer.

### Testing Requirements
- [ ] Unit tests written and passing for semantic compatibility decisions, stale/missing/incompatible states, lexical fallback, and reindex guidance.
- [ ] Runtime indexing tests cover local embedding readiness, provider-blocked embeddings, canceled attempts, model switches, stale source fingerprints, and no raw content in recovery metadata.
- [ ] Grounded chat regression tests prove lexical fallback is used when semantic vectors are not eligible.
- [ ] Runtime status and settings tests prove compatibility diagnostics stay bounded and are not persisted into settings.
- [ ] Manual review confirms generated examples and fixtures are synthetic and fixture-safe.

### Non-Functional Requirements
- [ ] Local-first privacy behavior remains explicit and no provider path silently escalates from local to cloud.
- [ ] Semantic compatibility decisions are deterministic under fake timers and synthetic fixtures.
- [ ] Diagnostics remain bounded and redacted for support, cache, logs, reports, staged-change, status, settings, and validation surfaces.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.
- [ ] `bun run validate:agent-surfaces` passes.
- [ ] `bun run validate:fixture-safety` passes.
- [ ] `bun run validate:agent-docs` passes.
- [ ] `bun run validate` passes or residual failures are recorded with recovery details.

---

## 8. Implementation Notes

### Key Considerations
- Keep semantic compatibility separate from provider trust and disclosure decisions; use existing setup and privacy preflight decisions as inputs.
- Do not let semantic search run from a stale or incompatible snapshot even if lexical retrieval is ready.
- Keep fallback decisions explicit so chat, runtime status, and settings can explain why lexical search was used.
- Keep fixtures synthetic and avoid private-looking absolute paths, secrets, authorization headers, or raw provider state.
- Prefer IDs, counts, readiness codes, model family names, report IDs, and validation output over raw content in diagnostics.

### Potential Challenges
- `IndexingRuntimeService` currently tracks lexical index state and semantic readiness, but not a semantic snapshot; add compatibility state without overbuilding a full semantic index pipeline.
- Retrieval currently composes lexical results only; add fallback metadata without changing result scoring semantics more than necessary.
- Status and settings surfaces can become noisy; keep compatibility guidance concise and bounded.
- Semantic snapshot source fingerprints must be sorted and compared consistently with existing lexical freshness helpers.

### Relevant Considerations
- [P02] **Workflow drift risk**: Keep Phase 03 session records, task lists, command docs, and validation artifacts synchronized with provider behavior changes.
- [P02] **Spec script parity**: Preserve local analyzer behavior and do not rely on missing local spec scripts for validation.
- [P01] **Obsidian runtime variance**: Keep indexing refresh, cancellation, and settings re-entry behavior resilient without assuming a live Obsidian runtime.
- [P01] **Disclosure gates stay mandatory**: Cloud and custom remote endpoints require explicit trust, auth, capability, and disclosure preflight before private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records, reports, and summaries must exclude secrets, raw note bodies, prompts, and hidden provider state.
- [P01] **Review-first mutations**: Provider-assisted note output remains staged through existing review and apply paths.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Semantic vectors may be reused after an embedding model family or dimension switch.
- Provider-blocked or offline embedding states may accidentally disable all retrieval instead of using lexical fallback.
- Compatibility and recovery diagnostics may expose raw note bodies, embedding chunks, private paths, credentials, headers, or hidden provider state.

---

## 9. Testing Strategy

### Unit Tests
- Test semantic compatibility helpers for compatible, missing index, stale source, family mismatch, dimension mismatch, provider-blocked, canceled, disabled, and ready states.
- Test reindex guidance records provider IDs, model IDs, model family, index IDs, source path counts, readiness codes, report IDs, and validation output.
- Test lexical fallback selection for bounded limits, deterministic ordering, no semantic-vector use when blocked, and no raw note body diagnostics.

### Integration Tests
- Test `IndexingRuntimeService` recomputes semantic compatibility after settings changes, lexical reindex, freshness refresh, provider readiness refresh, and cancellation.
- Test `GroundedVaultChatService` continues with lexical retrieval when semantic compatibility fails closed and records safe fallback metadata.
- Test runtime status and settings controls render semantic compatibility and guidance without persisting diagnostics into settings.

### Manual Testing
- Review generated fixtures and diagnostics for fixture-safe paths and fake provider data only.
- Run local validation commands from the repository root and record output in `validation.md`.
- Confirm no task requires a live provider, cloud account, credential, private vault file, raw note body, or network access.

### Edge Cases
- Semantic indexing disabled while lexical index is ready.
- Embedding provider role is not selected.
- Local runtime provider is selected but readiness is missing or failed.
- Cloud embedding provider is trusted but cloud workflows are disabled.
- Active model family changes after a semantic snapshot was built.
- Active model dimensions change after a semantic snapshot was built.
- Lexical freshness is stale while semantic snapshot still looks compatible.
- Current source fingerprints include missing, extra, or changed paths.
- Embedding invocation is canceled or times out while refreshing compatibility.
- Duplicate refresh actions occur while a lexical job is in flight.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/types/retrieval.ts`
- `src/types/indexing-runtime.ts`
- `src/types/provider-invocation.ts`
- `src/types/providers.ts`
- `src/types/runtime.ts`
- `src/providers/provider-preflight.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/embedding-provider.ts`
- `src/vectorstore/semantic-index.ts`
- `src/vectorstore/indexing-runtime-service.ts`
- `src/vectorstore/retrieval-service.ts`
- `src/vectorstore/index-state.ts`
- `src/agent/grounded-vault-chat-service.ts`
- `src/agent/runtime-status.ts`
- `src/views/settings-tab.ts`
- `src/utils/settings.ts`
- `test/fixtures/vault/runtime-indexing-fixtures.ts`
- `test/fixtures/providers/provider-invocation-fixtures.ts`
- `test/indexing-runtime-retrieval-readiness.test.ts`
- `test/indexing-retrieval-foundation.test.ts`
- `test/grounded-vault-chat.test.ts`
- `test/runtime-status.test.ts`

### Other Sessions
- **Depends on**: `phase03-session01-local-runtime-provider-profiles`, `phase03-session02-openai-compatible-provider-profiles`, `phase03-session03-provider-transport-invocation-boundaries`
- **Depended by**: `phase03-session05-provider-troubleshooting-recovery-ux`, `phase03-session06-offline-provider-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
