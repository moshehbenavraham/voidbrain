# Session Specification

**Session ID**: `phase01-session04-grounded-vault-chat`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session turns the completed provider preflight and runtime indexing work into the first usable vault chat workflow. It creates a cited chat service, local thread state, and an Obsidian chat view so a user can ask a question against the indexed vault and inspect the retrieval evidence before provider synthesis.

The work matters because chat is the first user-facing workflow that combines private vault content, retrieval snippets, citations, provider capability selection, and cloud disclosure gates. The system must fail closed when retrieval is weak, the index is stale or missing, a provider is not configured, or a cloud provider has not been explicitly trusted for private vault content.

The implementation remains local-first and non-mutating. Chat can persist recoverable thread state and draft input locally, but it must not create, update, or delete vault notes. Any future generated note changes stay deferred to staged-change and ingestion sessions.

---

## 2. Objectives

1. Create a contract-first grounded chat service that requires citation-ready retrieval results before answer synthesis.
2. Guard every provider chat invocation with model capability checks, auth/trust readiness, and explicit provider disclosure preflight.
3. Add a recoverable chat thread and draft state path that preserves failures, retries, and branch metadata without exposing secrets or raw hidden provider state.
4. Register an Obsidian chat view and command flow with context chips, retrieval preview, answer timeline, and weak retrieval or provider failure states.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session01-repo-tooling-scaffold` - Provides Bun, Vite, Vitest, Svelte, Obsidian mocks, and validation scripts.
- [x] `phase00-session04-indexing-retrieval-foundation` - Provides markdown parsing, lexical retrieval, citation-ready result composition, and source traceability.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides provider profiles, capability checks, auth status, trust settings, redaction, and preflight helpers.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides runtime lexical index state, readiness reporting, semantic readiness gates, and Obsidian vault indexing.

### Required Tools/Knowledge

- Obsidian `ItemView`, command registration, workspace leaf ownership, notices, plugin data APIs, and cleanup APIs.
- Existing retrieval contracts in `src/types/retrieval.ts` and runtime index state in `src/types/indexing-runtime.ts`.
- Existing provider preflight helpers in `src/providers/provider-preflight.ts` and privacy guard behavior in `src/providers/privacy-guard.ts`.
- Existing status, settings, lifecycle, fixture, and Obsidian mock test patterns.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content from `test/fixtures/vault/` in tests.
- Do not send real vault content to any cloud provider during tests or examples.
- Do not write provider secrets, authorization headers, raw hidden provider state, raw note bodies, or private paths to docs, fixtures, logs, screenshots, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can open a chat view and enter a vault question - Render input, context chips, retrieval preview, answer timeline, retry, and branch controls with explicit loading, empty, error, and offline states.
- User can retrieve evidence before synthesis - Query the runtime lexical index with bounded limits, deterministic ordering, snippets, vault paths, headings, chunk IDs, and source paths.
- User can receive citation-enforced answers - Require citations to vault paths, headings where available, and source records or source paths before an answer is marked ready.
- User can run provider synthesis only after preflight - Check selected chat provider, model capability, auth state, cloud trust, and content sensitivity before private vault content leaves the device.
- User can recover from failed chat attempts - Preserve draft input, retrieval evidence metadata, provider denial reason, thread ID, retry metadata, and branch relationships locally.

### Out of Scope (Deferred)

- Source ingestion and generated note creation - *Reason: owned by Session 05 and must use staged artifacts.*
- Automated vault edits from chat responses - *Reason: note mutations are owned by staged-change review and apply sessions.*
- Smart graph selection as a context source - *Reason: graph selection is deferred beyond this session stub.*
- Full attachment, image, PDF, audio, or video chat - *Reason: MVP chat uses markdown retrieval evidence first.*
- Multi-agent autonomous tool execution from chat - *Reason: this session establishes safe cited chat before agent tools.*

---

## 5. Technical Approach

### Architecture

Keep Obsidian lifecycle ownership in `src/main.ts`. The plugin should instantiate a grounded chat service, pass it current settings, provider definitions, indexing runtime state, and a provider chat invoker, then register a chat view and command callback that open the view without mutating notes.

The chat service should live under `src/agent/` and compose existing vectorstore and provider modules. It validates the user question, verifies lexical retrieval readiness, runs bounded lexical search against the current index, converts hits into citation records, blocks weak or empty retrieval unless the UI clearly reports that state, and runs provider setup preflight before any synthesis call.

Provider invocation should be represented through a narrow adapter interface under `src/providers/`. The default runtime adapter can return a controlled "not configured" failure until real provider networking is implemented, while tests inject a deterministic synthetic invoker. This keeps the safety path implementable now without embedding live network calls or secrets in fixtures.

Thread state should be held in a typed store under `src/stores/`. The store keeps current draft input, submitted turns, retrieval previews, provider denials, answer text, retry state, and branch metadata. Persistence must be local, redacted, idempotent, and recoverable without writing generated note changes to the vault.

### Design Patterns

- Composition root: `src/main.ts` owns Obsidian view registration, command wiring, service creation, subscriptions, and cleanup.
- Contract-first chat state: define questions, turns, citations, provider decisions, failures, and recovery records before UI implementation.
- Citation gate: answers are not ready unless they reference citation records derived from retrieval results.
- Fail-closed provider boundary: deny provider synthesis unless role, capability, auth, trust, and disclosure checks pass.
- Duplicate-trigger prevention: reject repeated ask, retry, or branch actions while a turn is already in flight.
- Bounded diagnostics: persist paths, headings, counts, command IDs, thread IDs, and provider denial codes, but never raw secrets or hidden provider state.

### Technology Stack

- TypeScript strict mode for chat contracts, service orchestration, provider adapter, and store state.
- Obsidian API for commands, item views, workspace leaves, notices, plugin-owned state, and cleanup.
- Existing lexical retrieval and citation-ready result composition from `src/vectorstore/`.
- Existing provider setup, capability selection, privacy preflight, and redaction helpers from `src/providers/`.
- Vitest with synthetic fixture vault notes and Obsidian mocks.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/chat.ts` | Chat question, context, citation, turn, provider request, failure, retry, branch, and persistence contracts. | ~260 |
| `src/providers/chat-provider.ts` | Narrow provider chat invoker abstraction with timeout, retry, redacted failure, and deterministic test hooks. | ~220 |
| `src/agent/grounded-vault-chat-service.ts` | Grounded chat orchestration for retrieval readiness, citation building, provider preflight, answer synthesis, and recovery metadata. | ~360 |
| `src/stores/chat-thread-store.ts` | Local chat thread state facade with draft recovery, subscriber updates, idempotent persistence, and branch metadata. | ~220 |
| `src/views/chat-view.ts` | Obsidian item view for chat input, context chips, retrieval preview, answer timeline, retry, branch, and state rendering. | ~360 |
| `test/fixtures/vault/chat-fixtures.ts` | Synthetic chat fixture helpers and expected citation records for grounded chat tests. | ~160 |
| `test/grounded-vault-chat.test.ts` | Service tests for retrieval, citations, provider gates, weak retrieval, failure recovery, and no direct note mutation. | ~360 |
| `test/chat-view.test.ts` | View and interaction tests for loading, empty, error, offline, ask, retry, branch, and cleanup behavior. | ~260 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agent/index.ts` | Export grounded chat service entry points. | ~20 |
| `src/agent/command-catalog.ts` | Mark `voidbrain.chat-with-vault` as implemented only when runtime command and view wiring are complete. | ~40 |
| `src/agent/runtime-command-handlers.ts` | Allow implemented chat command execution while keeping planned workflows as safe placeholders. | ~120 |
| `src/providers/index.ts` | Export provider chat invoker contracts. | ~20 |
| `src/main.ts` | Instantiate chat service/store, register chat view, open command, ribbon action if needed, and cleanup subscriptions. | ~260 |
| `src/styles.css` | Add Obsidian-native chat view layout, citation, timeline, state, and focus styles. | ~220 |
| `test/__mocks__/obsidian.ts` | Extend mocks for chat view leaf creation, active file context, plugin data persistence, and view cleanup assertions if needed. | ~160 |
| `test/plugin-lifecycle.test.ts` | Cover chat view registration, command opening, cleanup, and no direct vault writes. | ~180 |
| `test/runtime-status.test.ts` | Cover chat command readiness outcomes when retrieval or provider setup is missing, blocked, or ready if handler state changes. | ~120 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Chat questions run only when lexical retrieval is ready or return a clear recoverable readiness failure.
- [ ] Retrieval preview includes bounded snippets, vault paths, headings where available, chunk IDs, score details, and source paths.
- [ ] User-facing answers marked ready include citations to vault paths, headings where available, and source records or source paths.
- [ ] Cloud provider synthesis is blocked without explicit provider review, trust, capability, and auth readiness.
- [ ] Failed chat attempts preserve draft input, thread ID, retrieval evidence metadata, denial code or failure code, and retry instructions.
- [ ] Chat view and service do not create, update, delete, move, or rewrite vault notes.

### Testing Requirements

- [ ] Unit tests cover question validation, retrieval readiness failures, bounded lexical search, weak retrieval, citation construction, and no raw content in diagnostics.
- [ ] Unit tests cover provider preflight for missing provider, local provider, untrusted cloud, disabled cloud, auth-not-ready cloud, and trusted cloud synthetic paths.
- [ ] Unit tests cover provider invocation timeout, retry/backoff, duplicate-trigger prevention, failure-path handling, and redacted diagnostics.
- [ ] View or lifecycle tests cover chat view loading, empty, error, offline, ask, retry, branch, draft recovery, focus behavior, and cleanup on close/unload.
- [ ] Manual testing scenario is recorded for opening chat, asking against indexed fixtures, provider denial, retry, branch, and view reopen.

### Non-Functional Requirements

- [ ] Chat UI remains responsive while retrieval and provider synthesis are in flight.
- [ ] Retrieval query limits are bounded and results are deterministically ordered.
- [ ] Provider secrets, API keys, authorization headers, raw hidden provider state, and raw private note bodies are not written to markdown, logs, fixtures, examples, diagnostics, or snapshots.
- [ ] Runtime chat uses Obsidian vault, workspace, and plugin-owned APIs rather than arbitrary filesystem paths.
- [ ] All recoverable state uses local storage and remains inspectable without uncontrolled note mutation.

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

- Existing `IndexingRuntimeService` exposes the current lexical index and readiness report; chat should consume it instead of rebuilding indexes.
- Existing `composeLexicalRetrievalResults` returns citation-ready retrieval records; chat should add answer citations around those records instead of inventing a parallel retrieval shape.
- Existing provider setup preflight should be the gate before any provider chat adapter runs.
- Runtime provider invocation should be dependency-injected so tests stay deterministic and fixture-safe.
- Chat persistence must not overwrite settings or other plugin-owned data; if a persistence envelope is needed, migrate existing settings safely and keep recovery details.

### Potential Challenges

- Provider networking is not fully implemented yet: Use a narrow adapter and synthetic invoker tests so the safety boundary is complete before live adapters are added.
- Retrieval snippets contain vault text: Persist only the minimum needed for recovery, redact diagnostics, and avoid writing raw private note bodies into logs or docs.
- View state can survive reopen and branch operations: Revalidate draft, context, and provider readiness on re-entry.
- Command status can drift from markdown surfaces: Update command catalog behavior and validate agent docs together.

### Relevant Considerations

- [P00] **Tracker synchronization**: Keep state, spec, tasks, command catalog, docs, and validation artifacts aligned so workflow commands can trust repo state.
- [P00] **Staged-write gap**: Chat must not introduce direct note writes or generated note mutations.
- [P00] **Provider disclosure boundary**: Private vault content cannot leave the device without fail-closed preflight and explicit provider review.
- [P00] **Fixture safety**: Chat tests must use synthetic fixture vault data and avoid secret-like values, private paths, and raw credentials.
- [P00] **Contract-first boundaries**: Compose chat from existing provider, retrieval, runtime status, and store contracts.
- [P00] **Deterministic state models**: Thread state, retry metadata, provider decisions, and citation records should be explicit and testable.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A user can submit, retry, or branch while a previous turn is still running and produce duplicate turns or stale provider calls.
- Chat can accidentally send private vault snippets to a cloud provider before trust, auth, capability, and disclosure checks pass.
- Answers can be displayed without citations or with citations detached from the retrieved evidence.
- View close, plugin unload, or reopen can leave subscriptions, draft state, or in-flight requests in an inconsistent state.
- Failure diagnostics can expose provider secrets, hidden provider state, or raw private note bodies.

---

## 9. Testing Strategy

### Unit Tests

- Test chat question validation for empty, oversized, and unsupported context input.
- Test retrieval readiness handling for missing, building, stale, canceled, error, disabled, and ready lexical index states.
- Test lexical retrieval composition for bounded result counts, deterministic ordering, weak retrieval state, source paths, headings, and snippets.
- Test citation construction so each ready answer has at least one citation linked to a retrieval result.
- Test provider preflight denial paths and local synthetic allowed paths without live network calls.
- Test provider invoker timeout, retry/backoff, redaction, and duplicate-trigger prevention.

### Integration Tests

- Test plugin lifecycle registration for the chat view and command callback.
- Test opening the chat view from the command and ribbon path if added.
- Test view cleanup removes subscriptions and aborts or ignores in-flight turn updates on close/unload.
- Test chat command outcomes with missing retrieval, missing provider, and ready synthetic service state.

### Manual Testing

- Open the chat view from Obsidian command registration.
- Reindex the fixture vault, ask a local-first vault question, inspect retrieval preview, and confirm citations appear.
- Disable provider setup or cloud trust, ask again, and confirm the provider denial is explicit and draft input remains recoverable.
- Close and reopen the chat view and verify draft or recent thread recovery.

### Edge Cases

- Empty vault index or no retrieval matches.
- Stale index after fixture note change.
- Provider role selected but model lacks `chat` capability.
- Cloud provider trusted but auth status missing or failed.
- Duplicate ask/retry while an answer is in flight.
- View closes before retrieval or provider synthesis resolves.
- Retrieval result has no heading but still needs a path-level citation.

---

## 10. Dependencies

### External Libraries

- None expected. Use existing TypeScript, Obsidian API, Vitest, Svelte/Vite stack, and in-repo provider and retrieval services.

### Internal Dependencies

- `src/vectorstore/indexing-runtime-service.ts` for lexical index state and readiness.
- `src/vectorstore/lexical-index.ts` and `src/vectorstore/retrieval-service.ts` for bounded retrieval and result composition.
- `src/providers/provider-preflight.ts` and `src/providers/privacy-guard.ts` for provider setup and disclosure gates.
- `src/stores/runtime-status-store.ts` patterns for subscriptions and local store cleanup.
- `src/views/status-view.ts` and `src/views/settings-tab.ts` patterns for Obsidian-native UI rendering.

### Other Sessions

- **Depends on**: `phase01-session02-provider-setup-privacy-preflight`, `phase01-session03-indexing-runtime-retrieval-readiness`
- **Depended by**: `phase01-session05-source-ingestion-staging`, `phase01-session08-hot-cache-mvp-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
