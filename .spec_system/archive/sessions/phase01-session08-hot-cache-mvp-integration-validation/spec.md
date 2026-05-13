# Session Specification

**Session ID**: `phase01-session08-hot-cache-mvp-integration-validation`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session finishes Phase 01 by making recent runtime context recoverable from local, readable support records and by validating the complete MVP workflow end to end. Sessions 01-07 already wired settings, provider privacy, indexing, grounded chat, source ingestion, staged review/apply, and vault health reporting. Session 08 adds the missing hot cache layer that preserves a bounded summary of recent chat, context selections, staged changes, health state, and index readiness across reloads.

The implementation must keep the vault as the durable source of truth. Hot cache records are recoverable support artifacts under `.voidbrain/cache/`, while any generated conversation or session-summary note must use the staged-change path before it can touch user-visible markdown. The work should not introduce cloud calls, raw vault-body dumps, provider secrets, hidden provider state, or direct AI note mutations.

The second half of the session validates the Phase 01 MVP as a composed workflow. Tests should exercise provider setup, indexing readiness, cited chat state, source ingestion staging, staged review/apply, health reporting, hot cache persistence, and reload recovery against synthetic fixtures. Documentation and agent surfaces should reflect the actual implemented Phase 01 behavior and record residual risks needed for the validate workflow.

---

## 2. Objectives

1. Persist bounded recent context, chat thread state, selected context, index readiness, staged-change summaries, and health-report summaries as local hot cache support records.
2. Restore recent chat and MVP workflow state after plugin reload without exposing provider secrets, raw hidden provider state, or raw private note bodies.
3. Provide a review-first path for saving a readable session summary as a staged conversation note.
4. Add end-to-end synthetic integration validation and documentation updates for the complete Phase 01 MVP workflow.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session01-obsidian-runtime-settings` - Provides plugin lifecycle ownership, settings, status surface, and cleanup patterns.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides provider settings, trust state, auth checks, and provider disclosure gates.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides Obsidian indexing runtime, readiness reports, and index freshness state.
- [x] `phase01-session04-grounded-vault-chat` - Provides cited chat service, chat thread store, retry, branch, and draft recovery primitives.
- [x] `phase01-session05-source-ingestion-staging` - Provides source preview and generated-note staged changes with citations and recovery metadata.
- [x] `phase01-session06-staged-change-review-apply` - Provides explicit review, confirmed apply, backup intent, audit, and recovery behavior for staged changes.
- [x] `phase01-session07-vault-health-repair-staging` - Provides local health reporting, markdown export, safe repair staging, and status integration.

### Required Tools/Knowledge

- Existing `HotCacheState`, `RuntimeState`, and validation contracts in `src/types/vault.ts` and `src/utils/vault-validation.ts`.
- Existing chat persistence hooks in `src/stores/chat-thread-store.ts`.
- Existing staged-change service and review/apply runtime behavior.
- Obsidian vault and adapter APIs for local support-file reads and writes.
- Vitest, Obsidian mocks, and synthetic fixture patterns under `test/`.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content under `test/fixtures/vault/` in tests and examples.
- Do not call live providers, fetch live URLs, or send vault content to cloud providers.
- Do not write provider secrets, authorization headers, raw hidden provider state, private diagnostics, or raw private note bodies to docs, fixtures, logs, screenshots, hot cache records, or generated examples.
- Preserve review-first mutation behavior: generated session-summary markdown must be staged before apply.

---

## 4. Scope

### In Scope (MVP)

- User can recover recent context after reload - persist bounded chat thread state, selected context chips, index readiness, staged-change summaries, and latest health-report summary to local readable support records.
- User can inspect hot cache status - expose cache freshness, entry counts, redaction status, and recovery hints in runtime status surfaces.
- User can save a session summary through staged review - render a conversation-summary markdown proposal with citations, source paths, command IDs, and recovery details as a staged change.
- Developer can validate the complete MVP path - add synthetic integration tests covering provider setup, indexing, grounded chat, ingestion, staged review/apply, health reporting, hot cache persistence, reload recovery, and validation commands.
- Maintainer can understand Phase 01 completion state - update docs, agent surfaces, and residual risk notes to match implemented behavior.

### Out of Scope (Deferred)

- Implementing `voidbrain.recover-session` as a full command - *Reason: the command remains planned; this session preserves recoverable support records and documents the handoff.*
- Smart graph production workflows - *Reason: graph workflows are deferred beyond Phase 01.*
- Distribution packaging or marketplace release - *Reason: Phase transition audit, pipeline, infra, and documents workflows handle release readiness.*
- Multi-agent batch ingestion - *Reason: MVP validation covers one local workflow path with synthetic fixtures.*
- Automatic summary apply - *Reason: generated conversation/session-summary markdown must remain a staged change until user approval.*

---

## 5. Technical Approach

### Architecture

Add a hot cache domain service under `src/agent/hot-cache-service.ts` that composes existing runtime state into bounded, redacted, deterministic records. The service should accept chat thread state, runtime status snapshots, indexing reports, staged changes, and health reports, then produce a `HotCacheState` plus optional staged conversation-summary markdown. It should store references, IDs, statuses, timestamps, citations, and bounded snippets only where already citation-safe. It must not persist raw provider secrets, provider transport state, auth diagnostics, or full private note bodies.

Use `src/stores/hot-cache-store.ts` to keep UI-facing status and persistence outcomes testable without Obsidian. Runtime I/O remains in `src/main.ts`, using Obsidian vault and adapter APIs to read and write `.voidbrain/cache/hot-cache.json` and to initialize the chat store from local persisted state when available. Any generated markdown session summary should be produced through the existing staged-change service and pushed into the staged review queue instead of being written directly.

Extend runtime status with a hot cache area so users can see whether recent context is persisted, recovered, stale, or failed. Add synthetic integration validation that boots the plugin, configures safe provider settings, indexes fixture notes, runs chat and ingestion flows, stages and applies a change, runs health reporting, writes hot cache state, reloads, and verifies that recoverable state survives without leaking fixture secrets or raw private bodies.

### Design Patterns

- Bounded support records: cache entries keep IDs, paths, timestamps, statuses, and short summaries instead of raw note bodies.
- Review-first generated markdown: conversation/session summary notes are staged changes, not direct writes.
- Deterministic recovery: cache IDs, sorted paths, validation output, and recovery hints are stable for fixture inputs.
- Fail-closed redaction: secret-like fields, provider diagnostics, hidden auth state, and private note bodies are rejected or omitted before persistence.
- Obsidian-owned I/O: plugin runtime reads and writes local support records through vault and adapter APIs.
- Re-entry reset and duplicate prevention: cache write, restore, and summary staging should reject overlapping in-flight actions.

### Technology Stack

- TypeScript strict mode for hot cache contracts, service logic, store state, and runtime integration.
- Obsidian API for support-file reads/writes, command wiring, notices, and staged review handoff.
- Existing chat, indexing, provider, health, ingestion, runtime status, and staged-change modules.
- Vitest with synthetic fixture vaults and Obsidian mocks.
- Bun validation scripts for agent surfaces, fixture safety, and full repository validation.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/hot-cache.ts` | Hot cache capture, persistence, restore, redaction, and session-summary contracts. | ~190 |
| `src/agent/hot-cache-service.ts` | Runtime-independent service for cache capture, validation, restore, redacted persistence records, and staged summary generation. | ~380 |
| `src/stores/hot-cache-store.ts` | Store for cache status, in-flight writes, restore results, summary staging state, and re-entry reset. | ~210 |
| `docs/hot-cache-mvp-integration-validation.md` | Human-readable hot cache behavior, reload recovery, Phase 01 validation path, safety boundaries, and residual risks. | ~180 |
| `test/fixtures/vault/hot-cache-fixtures.ts` | Synthetic cache, chat, status, health, staged-change, and workflow fixtures. | ~260 |
| `test/hot-cache-service.test.ts` | Unit tests for capture, redaction, restore, duplicate prevention, staged summary generation, and validation failures. | ~360 |
| `test/mvp-integration-validation.test.ts` | End-to-end synthetic MVP validation across provider, index, chat, ingestion, staged review, health, hot cache, and reload recovery. | ~360 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/vault.ts` | Extend hot cache entry metadata and operation kinds needed for session summary and recovery records. | ~90 |
| `src/utils/vault-validation.ts` | Validate enriched hot cache records, secret-like field rejection, deterministic ordering, and runtime-state compatibility. | ~150 |
| `src/utils/vault-paths.ts` | Add stable hot cache support-file path constants and artifact path checks where needed. | ~35 |
| `src/agent/index.ts` | Export hot cache service and helpers. | ~15 |
| `src/agent/runtime-status.ts` | Add hot cache readiness item, cache entry summaries, stale/failure states, and recovery hints. | ~120 |
| `src/types/runtime.ts` | Add hot cache runtime status area and input contract. | ~35 |
| `src/main.ts` | Instantiate hot cache service/store, load persisted cache, persist chat/cache updates, stage session summaries, update runtime status, and clean up. | ~300 |
| `src/views/chat-view.ts` | Add save-session-summary action wired to staged summary generation with duplicate-trigger prevention and accessible controls. | ~120 |
| `src/components/StatusSurface.svelte` | Render hot cache status item consistently with provider, index, staged-change, and health readiness. | ~60 |
| `test/plugin-lifecycle.test.ts` | Cover hot cache load/save, reload restore, summary staging, status refresh, and unload cleanup. | ~240 |
| `test/runtime-status.test.ts` | Cover hot cache ready, stale, failed, and redacted status snapshots. | ~140 |
| `test/vault-data-model.test.ts` | Cover enriched hot cache validation and runtime-state compatibility. | ~120 |
| `AGENTS.md` | Synchronize recover-session and hot cache behavior with implemented Phase 01 recovery support. | ~20 |
| `CLAUDE.md` | Synchronize recover-session and hot cache behavior with implemented Phase 01 recovery support. | ~20 |
| `GEMINI.md` | Synchronize recover-session and hot cache behavior with implemented Phase 01 recovery support. | ~20 |
| `skills/voidbrain/SKILL.md` | Document hot cache support records, staged summaries, fixture safety, and recovery handoff. | ~35 |
| `docs/agent-surfaces-commands.md` | Document Phase 01 command behavior, hot cache recovery records, and planned recover-session boundary. | ~90 |
| `docs/vault-data-model.md` | Update hot cache support-record schema and staged conversation-summary guidance. | ~90 |
| `README.md` | Update MVP workflow and validation notes for recent context recovery. | ~45 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Hot cache state persists to local readable support records under `.voidbrain/cache/`.
- [ ] Reload recovery restores recent chat draft/thread metadata, selected context chips, latest cache status, and bounded workflow summaries without raw private note bodies.
- [ ] Runtime status reports hot cache readiness, stale/failure states, entry counts, and recovery hints.
- [ ] Session-summary markdown generation creates a staged conversation note proposal with citations, source paths, command IDs, and recovery details.
- [ ] Generated summaries and cache records exclude provider secrets, raw authorization headers, hidden provider state, private diagnostics, and raw unbounded vault content.
- [ ] End-to-end synthetic MVP validation covers provider setup, indexing, grounded chat, source ingestion, staged review/apply, health reporting, hot cache persistence, reload recovery, docs, and validation commands.

### Testing Requirements

- [ ] Unit tests cover cache capture, bounded entries, deterministic ordering, redaction, restore, duplicate write prevention, and validation failures.
- [ ] Unit tests cover staged session-summary generation, citation/source-path requirements, duplicate summary prevention, and recovery metadata.
- [ ] Runtime status tests cover ready, stale, missing, failed, and redacted hot cache snapshots.
- [ ] Plugin lifecycle tests cover cache load, write, reload restore, summary staging, status refresh, and cleanup.
- [ ] Integration tests cover the complete Phase 01 MVP workflow using synthetic fixtures only.
- [ ] Agent-surface and fixture-safety validation cover updated docs and examples.

### Non-Functional Requirements

- [ ] Privacy: no hot cache, summary, or validation workflow sends vault content to cloud providers.
- [ ] Security: provider secrets, API keys, authorization headers, raw hidden provider state, and credential-like fields are rejected from durable records and docs.
- [ ] Reliability: recent context recovery preserves command ID, target path, staged-change ID, report ID, cache path, and validation output where applicable.
- [ ] Performance: hot cache capture remains bounded and does not store unbounded note bodies or retrieval payloads.
- [ ] Accessibility: chat summary controls are keyboard reachable, labelled, and disabled while pending.
- [ ] Data portability: cache records are readable JSON and staged summaries are readable markdown.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with recovery details

---

## 8. Implementation Notes

### Key Considerations

- `src/types/vault.ts` already defines `HotCacheState` and `RuntimeState`; prefer extending those contracts deliberately over adding a parallel cache format.
- `src/stores/chat-thread-store.ts` already accepts a persistence adapter. Session 08 should connect that hook to local hot cache persistence through `src/main.ts`.
- Generated conversation or session summaries must flow through staged changes because they are note mutations.
- Runtime status currently covers provider, index, staged-change, and health areas. Adding hot cache status should keep the same deterministic, redacted summary style.
- Integration validation should use existing Obsidian mocks and fixture vaults rather than live providers or external services.

### Potential Challenges

- Cache records can accidentally become raw data dumps: enforce bounded fields, sorted path references, and validation tests.
- Reload recovery can conflict with malformed persisted state: recover to safe defaults and surface validation output without throwing during plugin load.
- Summary staging can duplicate active staged changes: check active staged records before creating another conversation summary proposal.
- Hot cache writes can fail on missing `.voidbrain/cache/` folders: create support folders through adapter APIs and preserve recovery details on failure.
- End-to-end tests can become brittle: keep the flow focused on stable contracts and fixture-visible outcomes rather than private UI implementation details.

### Relevant Considerations

- [P00] **Tracker synchronization**: Update state, phase docs, session specs, docs, agent surfaces, and validation artifacts together.
- [P00] **Staged-write gap**: Session summaries are generated notes and must use staged review before apply.
- [P00] **Provider disclosure boundary**: Hot cache and integration validation must not introduce provider calls or implicit cloud trust.
- [P00] **Fixture safety**: Tests and examples must use synthetic fixture data and avoid secrets, personal data, private paths, and credential-like values.
- [P00] **Contract-first boundaries**: Keep cache capture, persistence, restore, staged summary generation, UI state, and Obsidian I/O separate.
- [P00] **Deterministic state models**: Cache IDs, entry ordering, recovery metadata, and validation output must be explicit and testable.
- [P00] **Framework-vault separation**: Framework docs and support records must not be confused with user vault content or direct framework update behavior.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A cache write can overlap with another write and corrupt or lose recent context.
- A malformed persisted cache can crash plugin load instead of recovering to safe defaults.
- A session summary can be written directly to the vault rather than staged for review.
- Hot cache records can leak raw private note bodies, provider secrets, auth diagnostics, or hidden provider state.
- Integration validation can pass while command surfaces or docs drift from implemented behavior.

---

## 9. Testing Strategy

### Unit Tests

- Test hot cache capture and restore with chat, context chip, staged-change, health, and index fixtures.
- Test validation rejects secret-like fields, raw hidden provider state, invalid paths, unordered entries, and unbounded summaries.
- Test staged session-summary generation includes citations, source paths, command IDs, staged-change IDs, and recovery metadata.

### Integration Tests

- Exercise plugin lifecycle cache load, save, reload restore, status refresh, and cleanup through Obsidian mocks.
- Exercise a synthetic MVP path covering provider settings, indexing readiness, chat state, ingestion staging, staged review/apply, health reporting, cache persistence, and reload recovery.
- Exercise validation command expectations through agent-surface and fixture-safety tests.

### Manual Testing

- In Obsidian dev mode, run Phase 01 commands from the command palette, save a session summary, review the staged summary, reload the plugin, and verify recent context recovers without direct note mutation.

### Edge Cases

- Missing `.voidbrain/cache/` folder.
- Malformed or older cache schema.
- Cache record containing secret-like keys.
- Stale or missing index state at cache capture time.
- Failed adapter write during cache persistence.
- Duplicate save-summary action while one staged summary is active.
- Reload after an in-flight chat turn or failed staged apply.

---

## 10. Dependencies

### External Libraries

- None expected. Use existing TypeScript, Svelte, Obsidian API, Vitest, and Bun tooling.

### Internal Dependencies

- `src/stores/chat-thread-store.ts` persistence adapter and recovery helpers.
- `src/agent/staged-change-service.ts` for staged session-summary markdown.
- `src/agent/runtime-status.ts` and `src/types/runtime.ts` for status integration.
- `src/agent/vault-health-runtime-service.ts` for latest health report context.
- `src/vectorstore/indexing-runtime-service.ts` for index readiness and freshness context.
- `src/providers/redaction.ts` for safe diagnostic redaction behavior.

### Other Sessions

- **Depends on**: Sessions 01-07 in Phase 01.
- **Depended by**: Phase transition workflows `audit`, `pipeline`, `infra`, `carryforward`, `documents`, and future `voidbrain.recover-session` implementation.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
