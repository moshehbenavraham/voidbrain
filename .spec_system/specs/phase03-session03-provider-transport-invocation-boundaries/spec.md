# Session Specification

**Session ID**: `phase03-session03-provider-transport-invocation-boundaries`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens the boundary between provider setup decisions and runtime provider adapter calls. It turns the local runtime and OpenAI-compatible readiness contracts from sessions 01 and 02 into cancellable, timeout-bounded, retry-aware invocation paths for chat and embeddings.

The work matters because private vault content must not reach any provider adapter until setup preflight has allowed the selected provider, model, capability, trust, auth, and disclosure state. Invocation failures must remain recoverable without writing prompt bodies, note bodies, credentials, authorization headers, or hidden transport state into durable diagnostics.

This is a transport boundary session. It should create reusable invocation contracts, refactor chat transport handling onto those contracts, add embedding invocation contracts for later index compatibility work, and add focused regression coverage. It should not add live provider SDK adapters, streaming UI, tool-call execution, or semantic index compatibility behavior that belongs to later Phase 03 sessions.

---

## 2. Objectives

1. Define reusable provider invocation contracts for prepared chat and embedding requests, adapter inputs, attempts, recovery metadata, and redacted diagnostics.
2. Ensure provider adapters only receive private-vault content after provider setup and privacy preflight return allowed decisions for the selected role and capability.
3. Add timeout, cancellation, retry/backoff, and duplicate-invocation guards for chat and embedding invocation paths.
4. Preserve useful recovery metadata while excluding secrets, authorization headers, prompt bodies, raw private note bodies, private path hints, and hidden provider transport state.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-local-runtime-provider-profiles` - Provides local runtime profiles, readiness records, local setup preflight behavior, and safe diagnostics.
- [x] `phase03-session02-openai-compatible-provider-profiles` - Provides endpoint classification, opaque credential references, auth readiness, capability readiness, and fail-closed remote disclosure gates.
- [x] `phase01-session04-grounded-vault-chat` - Provides cited retrieval chat flow, chat state contracts, and provider preflight integration.
- [x] `phase01-session05-source-ingestion-staging` - Provides provider-assisted ingestion staging and existing timeout/cancellation patterns.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides semantic readiness and embedding provider preflight foundations.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest provider, chat, ingestion, and indexing fixture patterns under `test/`.
- Provider setup, preflight, privacy guard, redaction, registry, chat provider, semantic index, and indexing runtime services.
- Strict TypeScript provider contracts under `src/types/providers.ts`, `src/types/provider-setup.ts`, `src/types/chat.ts`, and `src/types/retrieval.ts`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/newproject`.
- Validation runs from the repository root with Bun available.
- Tests use synthetic provider and vault fixtures only.
- No live local runtime, cloud provider call, private vault file, credential, authorization header, or remote account is required.

---

## 4. Scope

### In Scope (MVP)
- User can run cited vault chat through a prepared provider invocation boundary - require setup preflight before chat transport receives question, evidence, citations, or source path counts.
- User can rely on provider calls being cancellable and timeout-bounded - use abort signals, timeout cleanup, retry/backoff, and deterministic failure records.
- User can avoid duplicate provider calls from repeated actions - guard in-flight invocation keys for chat and embedding requests.
- Developer can prepare embedding provider calls safely for future index compatibility work - add embedding invocation contracts that require embedding-role setup preflight before text chunks reach an adapter.
- Developer can inspect failures safely - preserve command IDs, provider IDs, model IDs, target paths, cache paths, staged-change IDs, report IDs, attempt statuses, readiness codes, and validation output without raw private content.
- Developer can validate transport boundaries locally - add synthetic tests for allowed local calls, denied cloud calls, timeouts, retries, cancellation, duplicate guards, and redacted diagnostics.

### Out of Scope (Deferred)
- Real provider SDK adapters for Ollama, OpenAI, Anthropic, OpenRouter, Gemini, or custom endpoints - *Reason: this session defines the safe adapter boundary, not vendor implementations.*
- Streaming chat responses or tool-call execution - *Reason: streaming and tools require separate UI, state, and capability handling.*
- Semantic index compatibility, stale vector detection, lexical fallback, and reindex guidance - *Reason: these belong to Session 04.*
- Provider troubleshooting UI and user-facing recovery docs - *Reason: these belong to Session 05.*
- Direct note mutation from provider output - *Reason: note edits must remain staged through existing review-first flows.*
- Live URL fetching or autonomous web research - *Reason: outside Phase 03 MVP scope.*

---

## 5. Technical Approach

### Architecture
Add a small shared invocation boundary under `src/providers/` with typed contracts under `src/types/`. The boundary should run an already prepared provider transport with an `AbortSignal`, bounded timeout, retry/backoff policy, duplicate invocation key, attempt records, and redacted diagnostics. It should never decide trust or disclosure by itself; callers must prepare requests only after `preflightProviderSetup` or the semantic embedding preflight path returns an allowed decision.

Refactor `src/providers/chat-provider.ts` to use the shared boundary while preserving existing chat response validation and citation checks. Add `src/providers/embedding-provider.ts` for embedding request and transport contracts so later indexing sessions have a safe adapter shape ready. Grounded chat and semantic readiness code should pass only provider IDs, model IDs, command IDs, source path counts, and validation output into recovery diagnostics after preflight.

### Design Patterns
- Preflight-before-payload: Build adapter payloads only after setup and disclosure preflight allow the selected provider and model.
- Cancellable lifecycle: Every invocation owns an abort controller, listens to parent cancellation when provided, clears timers, and aborts transports on scope exit.
- Idempotent invocation keys: Duplicate chat or embedding actions return stable duplicate-denial records while the first call is in flight.
- Redacted diagnostics: Unknown adapter failures pass through existing redaction and fail closed to `{ redaction: "failed" }` when unsafe.
- Contract-first modeling: Add shared invocation and embedding contracts before services consume them.
- Deterministic attempts: Sort and record attempts by attempt number with stable statuses and safe timestamps.

### Technology Stack
- TypeScript 5.9 strict contracts.
- Vitest 4 for provider, chat, ingestion, and indexing regression tests.
- Bun validation scripts.
- Existing Obsidian plugin settings types and provider services.
- Existing `src/providers/provider-preflight.ts`, `src/providers/privacy-guard.ts`, `src/providers/redaction.ts`, `src/providers/chat-provider.ts`, `src/vectorstore/semantic-index.ts`, and `src/vectorstore/indexing-runtime-service.ts`.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/provider-invocation.ts` | Shared provider invocation, attempt, policy, embedding request, embedding response, and recovery contracts | ~180 |
| `src/providers/provider-invocation.ts` | Shared timeout, cancellation, retry/backoff, duplicate guard, and redacted diagnostic helpers | ~260 |
| `src/providers/embedding-provider.ts` | Embedding provider transport contracts and invoker built on the shared invocation boundary | ~220 |
| `test/fixtures/providers/provider-invocation-fixtures.ts` | Synthetic invocation requests, transports, failures, cancellation, timeout, retry, and redaction fixtures | ~180 |
| `test/provider-transport-invocation-boundaries.test.ts` | Regression tests for provider invocation boundaries across chat and embeddings | ~300 |
| `.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/implementation-notes.md` | Implementation notes for this session | ~100 |
| `.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/security-compliance.md` | Session security and privacy review | ~90 |
| `.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/validation.md` | Validation command results and residual failures | ~100 |
| `.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~90 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/chat.ts` | Align chat provider attempt and request recovery fields with shared invocation contracts | ~80 |
| `src/types/retrieval.ts` | Add or reference embedding invocation preparation fields needed by semantic provider boundaries | ~70 |
| `src/providers/chat-provider.ts` | Refactor chat transport timeout, retry, cancellation, duplicate guards, and diagnostics onto shared invocation helpers | ~140 |
| `src/providers/index.ts` | Export provider invocation and embedding provider helpers | ~10 |
| `src/agent/grounded-vault-chat-service.ts` | Preserve preflight-before-payload behavior and pass cancellation/recovery metadata into chat invocation | ~90 |
| `src/vectorstore/semantic-index.ts` | Prepare embedding invocation decisions only after embedding provider preflight succeeds | ~90 |
| `src/vectorstore/indexing-runtime-service.ts` | Preserve semantic readiness recovery metadata for provider-blocked, canceled, timeout, and retry states | ~90 |
| `src/agent/source-ingestion-staging-service.ts` | Keep provider-assisted ingestion compatible with shared attempt and redaction expectations | ~60 |
| `test/grounded-vault-chat.test.ts` | Add chat cancellation, duplicate, denied cloud, retry, and redaction regression coverage | ~140 |
| `test/indexing-runtime-retrieval-readiness.test.ts` | Add embedding invocation boundary and provider-blocked readiness regression coverage | ~120 |
| `test/source-ingestion-staging.test.ts` | Preserve ingestion provider timeout, cancellation, fallback, and redaction behavior | ~80 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] No chat adapter receives private-vault question text, retrieval evidence, citations, or source path counts unless chat setup preflight returns allowed.
- [ ] No embedding adapter receives text chunks or private-vault source details unless embedding setup and privacy preflight return allowed.
- [ ] Chat and embedding invocations support timeout, cancellation, retry/backoff, duplicate-trigger prevention, and deterministic attempt records.
- [ ] Provider failures preserve command IDs, provider IDs, model IDs, source path counts, cache paths, staged-change IDs, report IDs, readiness codes, and validation output needed for inspection or retry.
- [ ] Prompt bodies, raw note bodies, credentials, authorization headers, private path hints, and hidden provider state are excluded from durable diagnostics.
- [ ] Existing chat, ingestion, provider setup, and indexing tests remain compatible with the new boundary.

### Testing Requirements
- [ ] Unit tests written and passing for allowed local calls, denied cloud calls, auth-not-ready calls, timeout, cancellation, retry/backoff, duplicate guards, and redacted diagnostics.
- [ ] Grounded chat regression tests prove provider transport is not invoked when retrieval or preflight fails.
- [ ] Embedding boundary tests prove private text is prepared only after embedding-role setup and privacy preflight succeeds.
- [ ] Source ingestion regression tests still pass for provider timeout, cancellation, fallback, and safe diagnostics.
- [ ] Manual review confirms generated examples and fixtures are synthetic and fixture-safe.

### Non-Functional Requirements
- [ ] Local-first privacy behavior remains explicit and no provider invocation silently escalates from local to cloud.
- [ ] Invocation behavior is deterministic under fake timers and injected transports.
- [ ] Diagnostics remain bounded and redacted for support, cache, logs, reports, staged-change, and validation surfaces.

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
- Keep provider trust and disclosure decisions in existing preflight services; invocation helpers should enforce transport mechanics after an allowed decision.
- Do not let tests use live providers, live network calls, private vault content, credentials, authorization headers, or private paths.
- Keep chat citation validation in the chat provider layer after transport returns.
- Keep embedding invocation contracts narrow so Session 04 can add index compatibility without reworking provider safety boundaries.
- Prefer safe counts, IDs, codes, and timestamps over raw payloads in all diagnostics.

### Potential Challenges
- `chat-provider.ts` already has local timeout and retry logic: extract or wrap carefully so current chat tests continue to pass while adding parent cancellation and duplicate guards.
- Source ingestion has its own provider extraction attempt model: preserve behavior and avoid broad refactors beyond compatibility with shared attempt expectations.
- Embedding invocation contracts may be tempting to over-integrate into indexing: keep the session focused on safe adapter boundaries and leave stale index handling to Session 04.
- Redaction failures can be subtle: assert serialized diagnostics do not contain secret-like, prompt-like, private-path, or raw note values.

### Relevant Considerations
- [P02] **Workflow drift risk**: Keep Phase 03 session records, task lists, command docs, and validation artifacts synchronized with provider behavior changes.
- [P02] **Spec script parity**: Preserve local analyzer behavior and do not rely on missing local spec scripts for validation.
- [P01] **Obsidian runtime variance**: Keep cancellation, timeout, and view lifecycle behavior resilient without assuming a live Obsidian runtime.
- [P01] **Disclosure gates stay mandatory**: Cloud and custom remote endpoints require explicit trust, auth, capability, and disclosure preflight before private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records, reports, and summaries must exclude secrets, raw note bodies, prompts, and hidden provider state.
- [P01] **Review-first mutations**: Provider-assisted note output remains staged through existing review and apply paths.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Adapter payloads may be assembled before preflight, allowing private vault content to exist in a path that later gets denied.
- Timed-out, canceled, or retried transports may leak resources or produce duplicate provider calls.
- Failure diagnostics may accidentally preserve prompt text, retrieved snippets, raw note bodies, credentials, headers, or private paths.

---

## 9. Testing Strategy

### Unit Tests
- Test shared invocation helpers for success, timeout, parent cancellation, thrown errors, retryable failures, non-retryable failures, duplicate keys, and redacted diagnostics.
- Test chat invoker behavior for allowed local transport, denied cloud preflight handoff, citation validation, timeout, retry/backoff, cancellation, duplicate guard, and diagnostic redaction.
- Test embedding invoker behavior for allowed local embedding calls, denied cloud calls, missing auth, timeout, cancellation, retry/backoff, duplicate guard, and redacted diagnostics.

### Integration Tests
- Test grounded chat service does not invoke transport when retrieval readiness, weak retrieval, provider setup, auth, capability, or privacy preflight fails.
- Test semantic indexing readiness exposes provider-blocked, auth-not-ready, privacy-denied, canceled, timeout, and retry-safe recovery details without raw note bodies.
- Test source ingestion provider fallback still preserves bounded attempts and safe diagnostics.

### Manual Testing
- Review generated fixtures and diagnostics for fixture-safe paths and fake provider data only.
- Run local validation commands from the repository root and record output in `validation.md`.
- Confirm no task requires a live provider, cloud account, credential, private vault file, or network access.

### Edge Cases
- Parent abort fires before transport starts.
- Parent abort fires during transport execution.
- Timeout fires while transport ignores the signal.
- Retryable failure succeeds on a later attempt.
- Non-retryable failure stops immediately.
- Duplicate invocation key is submitted while the first call is in flight.
- Adapter throws a secret-like diagnostic object.
- Adapter returns an empty chat answer or missing citations.
- Embedding adapter returns vectors for the wrong number of inputs.
- Cloud provider is trusted but cloud workflows are disabled.
- Local-compatible profile is selected but auth readiness is missing.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/types/providers.ts`
- `src/types/provider-setup.ts`
- `src/types/chat.ts`
- `src/types/retrieval.ts`
- `src/types/plugin.ts`
- `src/providers/provider-preflight.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/chat-provider.ts`
- `src/providers/redaction.ts`
- `src/vectorstore/semantic-index.ts`
- `src/vectorstore/indexing-runtime-service.ts`
- `src/agent/grounded-vault-chat-service.ts`
- `src/agent/source-ingestion-staging-service.ts`
- `test/fixtures/providers/provider-setup-fixtures.ts`
- `test/grounded-vault-chat.test.ts`
- `test/indexing-runtime-retrieval-readiness.test.ts`
- `test/source-ingestion-staging.test.ts`

### Other Sessions
- **Depends on**: `phase03-session01-local-runtime-provider-profiles`, `phase03-session02-openai-compatible-provider-profiles`, `phase01-session04-grounded-vault-chat`, `phase01-session05-source-ingestion-staging`, `phase01-session03-indexing-runtime-retrieval-readiness`
- **Depended by**: `phase03-session04-offline-embeddings-index-compatibility`, `phase03-session05-provider-troubleshooting-recovery-ux`, `phase03-session06-offline-provider-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
