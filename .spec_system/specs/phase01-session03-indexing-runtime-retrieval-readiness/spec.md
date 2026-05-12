# Session Specification

**Session ID**: `phase01-session03-indexing-runtime-retrieval-readiness`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session turns the Phase 00 indexing and retrieval primitives into an Obsidian runtime workflow. It adds a vault-backed indexing path that reads markdown files through Obsidian APIs, reports progress and freshness, supports cancellation and safe retry, and exposes retrieval readiness before chat workflows run.

The work matters because grounded vault chat, source ingestion, health checks, and hot cache behavior all depend on a trustworthy index state. Users need to know when lexical retrieval is ready, stale, failed, or still building, and semantic indexing must stay behind provider capability and disclosure checks before any private vault content can leave the device.

The implementation stays local-first and inspectable. Progress and diagnostics can include bounded vault-relative paths, counts, job IDs, and recovery hints, but must not log raw note content, provider secrets, hidden provider state, or uncontrolled generated note edits.

---

## 2. Objectives

1. Run lexical vault indexing through Obsidian vault and metadata APIs with progress, skipped-path, failed-path, and current-path reporting.
2. Support cancellation, duplicate-trigger prevention, and safe retry for background indexing jobs.
3. Surface retrieval readiness for lexical, semantic, stale, missing, failed, and canceled states in settings and runtime status.
4. Gate semantic indexing readiness through provider capability selection and explicit disclosure preflight.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session01-repo-tooling-scaffold` - Provides Bun, Vite, Vitest, Svelte, Obsidian mocks, and validation scripts.
- [x] `phase00-session04-indexing-retrieval-foundation` - Provides markdown parsing, lexical index, semantic index, progress, freshness, and retrieval contracts.
- [x] `phase01-session01-obsidian-runtime-settings` - Provides plugin lifecycle, settings, status view, runtime status store, and command registration.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides provider profile setup, model role readiness, auth status, and disclosure preflight.

### Required Tools/Knowledge

- Obsidian `Vault`, `TFile`, `MetadataCache`, event registration, settings tab, notices, and plugin cleanup APIs.
- Existing vectorstore contracts in `src/types/retrieval.ts` and `src/vectorstore/`.
- Existing provider preflight helpers in `src/providers/provider-preflight.ts` and `src/vectorstore/semantic-index.ts`.
- Vitest patterns for synthetic vault fixtures, Obsidian mocks, runtime status, and lifecycle tests.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content from `test/fixtures/vault/` in tests.
- Do not send vault content to any cloud provider during indexing without explicit provider review.
- Do not write provider secrets, authorization headers, raw hidden provider state, or raw note bodies to docs, fixtures, logs, snapshots, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can trigger a lexical reindex from the Obsidian runtime - Read markdown notes through vault APIs, filter excluded folders and size limits, and update progress snapshots.
- User can cancel and retry indexing safely - Keep one in-flight job per index, abort current work cleanly, and leave recovery-friendly status.
- User can inspect retrieval readiness - Show lexical readiness, freshness, current path, skipped paths, failed paths, stale paths, and index report summaries without raw note content.
- User can keep semantic indexing disabled or gated - Evaluate embedding provider role readiness and disclosure preflight before semantic indexing can run.
- Developer can validate runtime indexing deterministically - Use synthetic fixture vaults and Obsidian mocks for progress, freshness, cancellation, and stale-state tests.

### Out of Scope (Deferred)

- Full semantic embedding generation against a live provider - *Reason: this session gates readiness and preflight; provider invocation for chat belongs to later workflows.*
- Smart graph clustering and lasso selection - *Reason: not part of the Session 03 stub and deferred beyond indexing readiness.*
- Non-markdown attachment indexing beyond metadata placeholders - *Reason: MVP indexing focuses on markdown notes first.*
- Hosted database or external vector-store dependencies - *Reason: local-first MVP stores readable state locally and uses existing in-repo index snapshots.*
- Applying generated note edits or repair suggestions - *Reason: staged review and apply are owned by later Phase 01 sessions.*

---

## 5. Technical Approach

### Architecture

Keep Obsidian lifecycle ownership in `src/main.ts`. The plugin should instantiate an indexing runtime service, pass it Obsidian vault APIs and current settings, subscribe progress into the runtime status store, and cancel in-flight jobs during unload. The service should live under `src/vectorstore/` and compose existing parsing, lexical index, freshness, and semantic preflight helpers rather than replacing them.

Vault file collection should be isolated in an adapter that accepts Obsidian `TFile` records and reads content through the vault API. The adapter applies indexing preferences such as excluded folders and maximum note size, reports skipped and failed paths as structured metadata, and returns note content only to the in-memory index builder.

Runtime status and settings UI consume structured reports. They should expose counts, job IDs, current path, stale/missing/extra path samples, and provider readiness messages, while avoiding raw note content and raw provider diagnostics. Semantic readiness should use the selected embedding role, provider auth/trust state, and existing disclosure preflight before any embedding workflow is allowed.

### Design Patterns

- Composition root: `src/main.ts` owns Obsidian runtime registration, service creation, subscriptions, and cleanup.
- Contract-first runtime state: define index job reports and readiness summaries before UI and command wiring.
- Fail-closed semantic readiness: deny semantic indexing unless provider role, capability, auth/trust, and disclosure checks pass.
- Duplicate-trigger prevention: reject or no-op repeated reindex actions while the same index job is already building.
- Bounded diagnostics: report paths, counts, job IDs, and status codes only; never report note bodies or provider secrets.

### Technology Stack

- TypeScript strict mode for runtime indexing contracts and services.
- Obsidian API for vault file enumeration, markdown reads, metadata cache hints, settings controls, notices, and cleanup.
- Existing lexical and semantic vectorstore modules for parsing, build jobs, freshness, and provider preflight.
- Existing runtime status store and status view for readiness display.
- Vitest with synthetic fixture vault notes and Obsidian mocks.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/indexing-runtime.ts` | Runtime indexing job, report, readiness, skipped-path, failed-path, and action contracts. | ~180 |
| `src/vectorstore/obsidian-index-source.ts` | Obsidian vault file collector and markdown note reader with filtering and bounded diagnostics. | ~220 |
| `src/vectorstore/indexing-runtime-service.ts` | Runtime coordinator for lexical reindex, cancel, retry, freshness, semantic readiness, and subscriptions. | ~280 |
| `test/fixtures/vault/runtime-indexing-fixtures.ts` | Synthetic Obsidian file and vault-read helpers for runtime indexing tests. | ~140 |
| `test/indexing-runtime-retrieval-readiness.test.ts` | Tests for runtime indexing, progress, cancellation, stale state, semantic gates, and redaction. | ~320 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/retrieval.ts` | Add any reusable readiness/report fields needed by runtime indexing without duplicating existing primitives. | ~80 |
| `src/types/runtime.ts` | Add runtime status inputs for index reports, current progress, semantic readiness, and recent failures. | ~100 |
| `src/types/plugin.ts` | Add indexing preference fields only if runtime report or semantic gating needs persisted user settings. | ~60 |
| `src/utils/settings.ts` | Parse and recover any new indexing preferences with local-first defaults. | ~120 |
| `src/vectorstore/index.ts` | Export runtime indexing source and service modules. | ~20 |
| `src/agent/runtime-status.ts` | Surface index readiness, stale paths, skipped paths, failed paths, and semantic readiness without raw content. | ~180 |
| `src/agent/runtime-command-handlers.ts` | Adjust planned chat/ingestion notices to mention retrieval readiness and preserve local-first blocking. | ~60 |
| `src/views/settings-tab.ts` | Add reindex, cancel, retry, and index report controls with in-flight action protection. | ~220 |
| `src/views/status-view.ts` | Render index report details and sampled paths in the status view with accessible controls. | ~120 |
| `src/main.ts` | Instantiate indexing runtime, wire actions into settings/status surfaces, update snapshots, and cancel on unload. | ~220 |
| `test/__mocks__/obsidian.ts` | Extend mock vault files, metadata cache, event refs, and file reads for runtime indexing tests. | ~180 |
| `test/plugin-lifecycle.test.ts` | Cover indexing runtime creation, startup opt-in behavior, cancel-on-unload, and status refresh. | ~180 |
| `test/plugin-settings-runtime.test.ts` | Cover new indexing preference migration only if settings schema changes. | ~120 |
| `test/runtime-status.test.ts` | Cover ready, stale, missing, canceled, error, skipped, and semantic gate status summaries. | ~180 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Lexical indexing runs through Obsidian vault APIs and produces progress snapshots without mutating notes.
- [ ] Indexing reports indexed, skipped, stale, failed, and current-path state without logging raw note content.
- [ ] Reindex actions prevent duplicate in-flight jobs and support cancellation with cleanup on plugin unload.
- [ ] Retrieval readiness is available before chat workflows run and distinguishes missing, stale, building, ready, canceled, and error states.
- [ ] Semantic indexing remains disabled or preflight-blocked unless the selected embedding provider is capable and trusted for the requested content sensitivity.

### Testing Requirements

- [ ] Unit tests cover Obsidian vault note collection, excluded folders, size limits, skipped paths, failed reads, and no raw-content diagnostics.
- [ ] Unit tests cover runtime lexical reindex progress, duplicate-trigger prevention, cancellation, retry, and stale-state detection.
- [ ] Unit tests cover semantic readiness for no provider, local provider, untrusted cloud provider, trusted cloud provider, and capability mismatch.
- [ ] Lifecycle or settings tests cover reindex/cancel controls and cancel-on-unload behavior.
- [ ] Manual testing scenario is recorded for settings reindex, status refresh, and cancellation.

### Non-Functional Requirements

- [ ] Plugin UI remains interactive while indexing starts and reports progress.
- [ ] Indexing for synthetic fixtures is deterministic and bounded to repository-owned fixture paths.
- [ ] No provider secrets, API keys, authorization headers, hidden provider state, or raw note bodies are written to markdown, logs, fixtures, generated examples, or snapshots.
- [ ] Runtime indexing uses Obsidian vault and adapter APIs rather than arbitrary filesystem paths.

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

- Existing `FixtureIndexingService` already covers in-memory lexical index jobs; runtime work should compose it or a small generalized variant rather than duplicate parser/index logic.
- Keep note content inside the indexing pipeline only. Runtime status, notices, reports, tests, and failure messages should use path/count metadata.
- Settings already include lexical, semantic, startup, excluded folder, and max note size preferences; add persisted fields only if the runtime needs durable user configuration.
- Chat remains planned, but its placeholder should make index readiness explicit so later Session 04 can consume the same readiness surface.

### Potential Challenges

- Obsidian file APIs are asynchronous and platform-dependent: Use a narrow adapter and synthetic mock files so tests stay deterministic.
- Cancellation can race with progress updates: Centralize AbortController ownership and emit one terminal snapshot per job.
- Semantic readiness can look like semantic execution: Keep this session to readiness and preflight gates, not live embedding calls.
- Status details can leak note text through errors: Map parser/read errors to bounded diagnostics before they reach UI or tests.

### Relevant Considerations

- [P00] **Tracker synchronization**: Keep state, spec, tasks, and later validation artifacts aligned so workflow commands can trust repo state.
- [P00] **Staged-write gap**: Runtime indexing must not introduce direct note writes or generated note mutations.
- [P00] **Provider disclosure boundary**: Semantic indexing must use fail-closed disclosure preflight before any private vault content can leave the device.
- [P00] **Fixture safety**: Runtime indexing tests must use synthetic fixture vault files and avoid secret-like values or private paths.
- [P00] **Contract-first boundaries**: Compose runtime indexing from existing provider, retrieval, settings, and runtime-status contracts.
- [P00] **Deterministic state models**: Progress, freshness, skipped-path, and failure metadata should be explicit and testable.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A user can trigger repeated reindex actions and create duplicate jobs or contradictory status snapshots.
- Plugin unload or settings re-entry can leave subscriptions, abort controllers, or progress callbacks alive.
- Error or progress reporting can expose raw note content, provider secrets, or hidden provider state.
- Semantic indexing can appear enabled even though provider capability, auth, trust, or disclosure preflight is not satisfied.

---

## 9. Testing Strategy

### Unit Tests

- Test Obsidian vault markdown collection for markdown-only filtering, excluded folders, max-note-size skipping, failed reads, and deterministic path ordering.
- Test runtime lexical reindex for progress sequence, ready snapshot, stale detection, duplicate job rejection, cancellation, retry, and terminal status handling.
- Test semantic readiness with selected local embedding provider, missing provider role, capability mismatch, disabled cloud workflows, untrusted cloud provider, and trusted cloud provider.
- Test report serialization or status composition to ensure raw fixture note bodies and synthetic secret-like strings do not appear.

### Integration Tests

- Extend plugin lifecycle tests to verify indexing runtime startup opt-in, settings action wiring, runtime status refresh, and cancel-on-unload cleanup.
- Extend settings tab tests to verify reindex and cancel controls disable or no-op while in-flight and reset on completion.
- Extend runtime status tests to verify index report summaries integrate with provider, staged-change, and health status items.

### Manual Testing

- Open settings, run lexical reindex against a synthetic or test vault, and verify progress, current path, completion, and status refresh.
- Start reindex, cancel it, and verify the status reports canceled with a retry path.
- Enable semantic indexing without a ready embedding provider and verify semantic readiness is blocked without provider calls.

### Edge Cases

- Vault has no markdown files, only excluded folders, oversized notes, or files that fail to read.
- Metadata cache is stale or unavailable while file reads still succeed.
- Index job is canceled before first note, during note read, during parse, or after lexical build begins.
- Settings change while indexing is running.
- Plugin unload fires during an in-flight job.
- Selected embedding provider is missing, untrusted, cloud-disabled, unauthenticated, or lacks embeddings capability.

---

## 10. Dependencies

### External Libraries

- No new external runtime dependencies expected.
- Existing `obsidian`, `svelte`, `vitest`, `vite`, `typescript`, `biome`, and `bun` toolchain remain in use.

### Internal Modules

- `src/vectorstore/indexing-service.ts`
- `src/vectorstore/index-state.ts`
- `src/vectorstore/lexical-index.ts`
- `src/vectorstore/markdown-parser.ts`
- `src/vectorstore/semantic-index.ts`
- `src/providers/provider-preflight.ts`
- `src/agent/runtime-status.ts`
- `src/stores/runtime-status-store.ts`
- `src/views/settings-tab.ts`
- `src/main.ts`

### Other Sessions

- **Depends on**: `phase00-session04-indexing-retrieval-foundation`, `phase01-session01-obsidian-runtime-settings`, `phase01-session02-provider-setup-privacy-preflight`
- **Depended by**: `phase01-session04-grounded-vault-chat`, `phase01-session07-vault-health-repair-staging`, `phase01-session08-hot-cache-mvp-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
