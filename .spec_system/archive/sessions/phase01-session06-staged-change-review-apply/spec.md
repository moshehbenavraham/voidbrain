# Session Specification

**Session ID**: `phase01-session06-staged-change-review-apply`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Created**: 2026-05-13
**Completed**: 2026-05-13

---

## 1. Session Overview

This session turns staged-change records from review-only support data into an explicit review and confirmed apply workflow. Users need to inspect proposed vault mutations, understand before and after content, resolve conflicts, reject unwanted changes, and apply accepted changes only after clear confirmation.

The work is the safety bridge between source ingestion and later vault health repairs. Session 05 can now create staged source-derived notes, but those generated notes must stay inert until this session adds grouped review, conflict handling, stronger destructive confirmations, recovery metadata, backups, audit records, and index refresh behavior.

The implementation must preserve the local-first contract. Apply behavior can mutate user vault notes only after user confirmation, and failed, rejected, or conflicting staged changes must remain inspectable enough for recovery or retry without exposing provider secrets, raw hidden provider state, or private diagnostics.

---

## 2. Objectives

1. Create typed staged-review, confirmation, apply, rejection, audit, and recovery contracts for staged-change records.
2. Build a staged-change review UI and state store that groups records by command, operation type, status, and target path with inspectable diffs.
3. Apply accepted staged changes through Obsidian vault APIs with conflict checks, stronger destructive confirmation, backup intent, audit trail, and index-refresh handoff.
4. Update command catalog, runtime command handling, docs, agent surfaces, fixtures, and tests so `voidbrain.stage-change` reflects implemented review/apply behavior.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session02-vault-data-model` - Provides generated note, support record, operation log, and validation contracts.
- [x] `phase00-session06-staged-changes-health-foundation` - Provides staged-change builders, diff context, conflict metadata, destructive review flags, and recovery metadata.
- [x] `phase01-session01-obsidian-runtime-settings` - Provides plugin lifecycle, command registration, status surfaces, settings, and cleanup ownership.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides index readiness, runtime reports, and reindex hooks needed after applied changes.
- [x] `phase01-session05-source-ingestion-staging` - Provides runtime-generated staged changes from approved source ingestion.

### Required Tools/Knowledge

- Existing `StagedChangeService` behavior in `src/agent/staged-change-service.ts`.
- Runtime staged-change status composition in `src/agent/runtime-status.ts`.
- Current in-memory ingestion staged-change wiring in `src/main.ts`.
- Obsidian vault APIs for create, modify, delete, rename, adapter support writes, and metadata refresh behavior.
- Vitest fixture and Obsidian mock patterns under `test/`.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content from `test/fixtures/vault/` in tests and examples.
- Do not call live providers, fetch external sources, or send vault content to cloud providers.
- Do not write provider secrets, authorization headers, raw hidden provider state, raw private note bodies, or private paths to docs, fixtures, logs, screenshots, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can inspect staged changes grouped by command, operation type, status, and target path - render clear review groups from active, rejected, conflicted, failed, and applied records.
- User can view before and after diffs or full previews - show create, update, delete, move, and frontmatter-edit changes with source paths, rationale, conflicts, and recovery details.
- User can approve, reject, retry, dismiss, and apply staged changes - preserve state transitions, duplicate-trigger prevention, and revalidation when dialogs reopen.
- User can apply accepted changes through Obsidian vault APIs - run conflict checks, create backups for destructive operations, write audit records, and trigger or queue index refresh.
- Developer can test review/apply workflows against synthetic fixtures - cover conflicts, stale hashes, path collisions, permission failures, rejected records, failed applies, and no secret leakage.

### Out of Scope (Deferred)

- Auto-apply of AI-proposed note mutations - *Reason: MVP requires explicit review and confirmation.*
- Vault health repair staging - *Reason: Session 07 stages health repairs after apply primitives exist.*
- Sync conflict resolution across external Git remotes - *Reason: this session handles local Obsidian runtime conflicts only.*
- Hot cache persistence and full MVP integration validation - *Reason: Session 08 owns recent context and end-to-end validation.*
- Provider-assisted generation of new staged changes - *Reason: Session 05 already handles source ingestion staging and provider preflight.*

---

## 5. Technical Approach

### Architecture

Add staged-review contracts under `src/types/staged-review.ts` for grouped records, review actions, confirmation requirements, apply plans, apply outcomes, audit entries, and redacted recovery output. Extend existing vault operation log types only where needed to describe applied, rejected, and failed staged-change events.

Implement a pure staged-change review service under `src/agent/staged-change-review-service.ts`. It should group staged records deterministically, compute review summaries and confirmation requirements, revalidate conflict state before apply, transition records through approved, rejected, applied, and failed statuses, and return explicit apply plans without depending on Obsidian UI code.

Keep runtime wiring in `src/main.ts`. The plugin should own the Obsidian vault adapter for create, modify, delete, rename, backup support writes, and index refresh handoff. A focused review modal under `src/views/staged-change-review-modal.ts` can render grouped staged changes, diffs, conflicts, confirmations, and action buttons while delegating state to a typed store under `src/stores/staged-change-review-store.ts`.

### Design Patterns

- Review-first mutation boundary: staged changes remain inert until the user explicitly confirms apply.
- Contract-first review service: model review groups, actions, confirmations, apply results, audit entries, and recovery states before UI wiring.
- Fail-closed apply preflight: reject stale hashes, missing targets, path collisions, duplicate active changes, invalid operations, and permission failures before mutation.
- Stronger destructive confirmation: delete, move, overwrite, and batch apply require stricter confirmation than additive create operations.
- Obsidian-owned runtime I/O: plugin runtime reads and writes through Obsidian vault and adapter APIs, not arbitrary filesystem paths.
- Recoverable transitions: rejected, failed, and conflicting records retain command ID, target path, staged-change ID, backup path intent, and validation output.

### Technology Stack

- TypeScript strict mode for staged-review contracts, services, stores, and runtime wiring.
- Obsidian API for vault mutations, support-file backup writes, notices, modal lifecycle, command registration, and cleanup.
- Existing runtime status, staged-change, vault path, vault validation, and indexing runtime services.
- Vitest with synthetic staged-change fixtures and Obsidian mocks.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/staged-review.ts` | Review groups, actions, confirmations, apply plans, outcomes, audit entries, and recovery contracts. | ~260 |
| `src/agent/staged-change-review-service.ts` | Pure review/apply planning service for grouping, transition rules, preflight checks, and recovery output. | ~430 |
| `src/stores/staged-change-review-store.ts` | UI state for selected groups, confirmations, in-flight actions, errors, status reset, and persistence-safe summaries. | ~240 |
| `src/views/staged-change-review-modal.ts` | Obsidian modal for grouped staged changes, diffs, conflicts, confirmation, reject, retry, dismiss, and apply actions. | ~380 |
| `docs/staged-change-review-apply.md` | Human-readable review/apply workflow, safety boundaries, recovery behavior, and limitations. | ~170 |
| `test/fixtures/vault/staged-change-review-fixtures.ts` | Synthetic staged create, update, delete, move, conflict, stale-hash, failed-apply, and recovery fixtures. | ~260 |
| `test/staged-change-review-service.test.ts` | Service tests for grouping, confirmations, preflight, transitions, apply plans, audit entries, and recovery metadata. | ~460 |
| `test/staged-change-review-modal.test.ts` | Modal tests for loading, empty, error, conflict, confirmation, apply, reject, retry, dismiss, and cleanup states. | ~320 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/vault.ts` | Extend operation log kinds and recovery/status details for staged apply, reject, and failure events if needed. | ~80 |
| `src/agent/index.ts` | Export staged-review service and helpers. | ~20 |
| `src/agent/command-catalog.ts` | Update `voidbrain.stage-change` status, intent, outputs, safety phrases, recovery behavior, and notes after runtime review/apply is wired. | ~70 |
| `src/agent/runtime-command-handlers.ts` | Add runtime options and implemented command outcome for opening staged-change review. | ~90 |
| `src/agent/runtime-status.ts` | Improve staged-change status details for active, conflicted, failed, rejected, and applied records. | ~80 |
| `src/main.ts` | Instantiate review service/store, open review modal, wire Obsidian apply adapter, update staged records, write backups/audit, refresh status, and trigger index refresh. | ~280 |
| `test/__mocks__/obsidian.ts` | Add vault create, modify, delete, rename, adapter write, and failure simulation helpers. | ~160 |
| `test/plugin-lifecycle.test.ts` | Cover staged review command registration, modal opening, apply adapter behavior, status refresh, index refresh, and cleanup. | ~220 |
| `AGENTS.md` | Synchronize `voidbrain.stage-change` implemented review/apply behavior and safety language. | ~20 |
| `CLAUDE.md` | Synchronize `voidbrain.stage-change` implemented review/apply behavior and safety language. | ~20 |
| `GEMINI.md` | Synchronize `voidbrain.stage-change` implemented review/apply behavior and safety language. | ~20 |
| `skills/voidbrain/SKILL.md` | Synchronize staged-change review/apply command behavior and recovery notes. | ~30 |
| `docs/agent-surfaces-commands.md` | Document implemented staged review/apply, confirmations, backups, audit trail, limitations, and recovery behavior. | ~80 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Staged changes are grouped by command, operation type, status, and target path with deterministic ordering.
- [ ] Review UI shows before/after diffs, full create previews, source paths, rationale, conflicts, destructive flags, and recovery details.
- [ ] Create, update, delete, move, and frontmatter-edit operations apply only after explicit confirmation and preflight revalidation.
- [ ] Delete, move, overwrite, and batch apply require stronger confirmation than additive writes.
- [ ] Reject, retry, dismiss, failed apply, and conflicted states preserve command ID, target path, staged-change ID, validation output, and backup intent.
- [ ] Applied changes trigger or queue index refresh and report refresh failures without hiding apply results.
- [ ] `voidbrain.stage-change` surfaces implemented review/apply behavior without claiming auto-apply or remote sync support.

### Testing Requirements

- [ ] Unit tests cover grouping, sorting, selection, confirmation policy, action transitions, and recovery output.
- [ ] Unit tests cover apply preflight for missing targets, stale before hashes, existing create targets, destination collisions, duplicate active changes, and permission failures.
- [ ] Unit tests cover create, update, frontmatter edit, delete, and move apply paths with backup, audit, and compensation behavior.
- [ ] Runtime and modal tests cover loading, empty, conflict, error, offline, confirm, apply, reject, retry, dismiss, focus behavior, and cleanup on close/unload.
- [ ] Agent surface and fixture safety validation cover the updated command catalog and synchronized docs.

### Non-Functional Requirements

- [ ] Privacy: no provider call or cloud disclosure path is introduced by staged review/apply.
- [ ] Security: provider secrets, tokens, authorization headers, hidden provider state, private paths, and raw private diagnostics are not written to docs, fixtures, logs, or snapshots.
- [ ] Reliability: every automated note mutation is explicitly confirmed, backed by conflict checks, and recoverable through staged-change metadata.
- [ ] Data portability: staged records, audit entries, and recovery details remain readable as markdown or JSON support records.
- [ ] Accessibility: review controls are keyboard reachable and expose clear labels for destructive and batch actions.

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

- Existing staged-change records already contain before/after diff context, conflict metadata, destructive flags, backup path intent, and recovery metadata. This session should consume and update those records instead of replacing the staged-change model.
- Current runtime stores ingestion-created staged changes in memory. The review/apply workflow should centralize staged-change ownership enough for source ingestion and future health repairs to share one review surface.
- Apply behavior must read current target content through Obsidian before mutation so stale hashes, missing targets, and collisions are caught at the last responsible moment.
- Backups for destructive changes should use plugin-owned support paths and must not target user note locations as backup files.
- Index refresh should be triggered or clearly queued after successful applies, but an index refresh failure should not obscure the completed vault mutation or recovery details.

### Potential Challenges

- Applying several records can partially succeed: use per-record results, transaction boundaries, compensation where possible, and failed status with recovery details.
- Staged records can be stale after the modal opens: revalidate on modal open, before approve, and before apply.
- Move and delete paths are destructive: require stronger confirmation and write backup support records before mutation.
- In-memory staged records can drift from persisted plugin data: keep the session focused on a single runtime owner and explicit status refresh after each action.
- Obsidian API behavior differs from unit mocks: extend mocks only to model needed contracts and keep integration tests around plugin lifecycle.

### Relevant Considerations

- [P00] **Tracker synchronization**: Update state, spec, tasks, command catalog, agent surfaces, docs, tests, and validation artifacts together.
- [P00] **Staged-write gap**: This session closes the review/apply gap while preserving explicit confirmation and recoverable staged records.
- [P00] **Provider disclosure boundary**: Review/apply must not introduce provider calls or cloud disclosure paths.
- [P00] **Fixture safety**: Tests and examples must use synthetic staged records and avoid secrets, personal data, private paths, and credential-like values.
- [P00] **Contract-first boundaries**: Keep review/apply contracts separate from ingestion, health, retrieval, and UI so future repair staging can compose with them.
- [P00] **Deterministic state models**: Review status, action transitions, audit entries, backup paths, staged IDs, and validation output should be explicit and testable.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A user can click apply twice and perform the same staged mutation more than once.
- A destructive action can apply without stronger confirmation or a backup support record.
- A target file can change between review and apply, causing data loss if stale hashes are not rechecked.
- Batch apply can partially fail without preserving per-record recovery details.
- Closing and reopening the review modal can show stale selected records or stale confirmation text.
- Index refresh can fail after apply without visible recovery guidance.

---

## 9. Testing Strategy

### Unit Tests

- Test grouping by command ID, operation kind, status, target path, destructive flag, and deterministic source path ordering.
- Test confirmation policy for create, update, frontmatter edit, delete, move, overwrite, and batch apply.
- Test action transitions for approve, reject, retry, dismiss, applied, failed, and conflicted records.
- Test apply preflight for target missing, target exists, target changed, destination exists, duplicate active staged changes, and permission failures.
- Test audit and recovery metadata for command ID, target path, staged-change ID, backup path intent, validation output, rejectedAt, failedAt, and last failure message.

### Integration Tests

- Test runtime command registration opens the staged review modal for `voidbrain.stage-change`.
- Test Obsidian mock vault create, modify, delete, rename, and support backup writes through the plugin apply adapter.
- Test index refresh is triggered or queued after successful apply and that refresh failures become recoverable notices.
- Test runtime status changes after apply, reject, conflict, and failed apply.
- Test agent command catalog and markdown agent surfaces remain synchronized after `voidbrain.stage-change` status changes.

### Manual Testing

- Stage one synthetic source note through the ingestion modal.
- Open staged-change review from the command palette.
- Inspect grouped changes, preview diffs, apply one additive change, and confirm the index refresh notice.
- Stage or load a destructive fixture, verify stronger confirmation is required, reject it, and confirm recovery details remain visible.
- Simulate a stale target path before apply and confirm the record becomes conflicted without mutating the vault.

### Edge Cases

- No staged changes exist.
- Several active staged changes target the same path.
- Create target already exists.
- Update target hash differs from the reviewed before hash.
- Move destination already exists.
- Delete target is missing.
- Backup support write fails before destructive mutation.
- Vault mutation succeeds but index refresh fails.
- Modal closes while apply is in flight.
- Rejected or failed record is reopened for retry.

---

## 10. Dependencies

### External Libraries

- None planned. Use existing Obsidian APIs, TypeScript, Svelte-free modal patterns, and Vitest.

### Other Sessions

- **Depends on**: `phase00-session02-vault-data-model`, `phase00-session06-staged-changes-health-foundation`, `phase01-session01-obsidian-runtime-settings`, `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session05-source-ingestion-staging`
- **Depended by**: `phase01-session07-vault-health-repair-staging`, `phase01-session08-hot-cache-mvp-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
