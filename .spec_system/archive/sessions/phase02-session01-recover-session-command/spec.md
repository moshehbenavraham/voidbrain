# Session Specification

**Session ID**: `phase02-session01-recover-session-command`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session implements `voidbrain.recover-session` as a read-only local workflow over existing support records. It turns the Phase 01 hot cache, staged-change recovery metadata, health report summaries, validation output, and command recovery details into bounded recovery summaries that a user can inspect after failures, reloads, or interrupted workflows.

The work matters because Voidbrain already preserves support metadata, but the command catalog still marks recovery as planned. This session closes that gap without applying recovered note changes, replaying provider calls, or exposing raw vault content. The vault remains the source of truth, and recovery output stays a local diagnostic surface.

The implementation fits Phase 02 by establishing the recovery substrate needed by later maintenance, framework preview, recommendation, placement, and batch ingestion workflows. It should keep Obsidian lifecycle wiring in `src/main.ts` and place testable recovery logic under `src/agent/`, `src/types/`, and synthetic fixtures under `test/fixtures/vault/`.

---

## 2. Objectives

1. Define typed recovery contracts for command, cache, staged-change, report, target path, and validation evidence.
2. Implement a read-only recovery service that normalizes hot cache, staged-change, health report, and operation-log support records into redacted summaries.
3. Wire `voidbrain.recover-session` into runtime command execution without mutating user vault notes or support records.
4. Update command catalog, agent surfaces, and docs so recovery is described as implemented behavior.
5. Cover happy path, missing records, malformed records, stale records, and secret-like diagnostics with synthetic fixtures and tests.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session08-hot-cache-mvp-integration-validation` - Provides hot cache support records, recent context recovery, and Phase 01 integration coverage.
- [x] `phase01-session07-vault-health-repair-staging` - Provides health report IDs, export paths, staged repair recovery details, and validation output.
- [x] `phase01-session06-staged-change-review-apply` - Provides staged-change recovery metadata, backup intent, audit records, and review/apply state transitions.
- [x] `phase00-session05-agent-surfaces-commands` - Provides command catalog, agent surfaces, and surface validation contracts.

### Required Tools/Knowledge

- TypeScript strict mode, Vitest, Bun validation scripts, Obsidian adapter APIs, and existing redaction helpers.
- Existing hot cache, staged-change, health, runtime status, command catalog, and fixture safety contracts.

### Environment Requirements

- Repository root with Bun dependencies installed.
- Synthetic fixture vault data only for tests and examples.
- No cloud provider calls and no real vault content disclosure during recovery.

---

## 4. Scope

### In Scope (MVP)

- User can run `voidbrain.recover-session` and receive a local, bounded recovery summary - implement service and runtime handler over support records.
- User can inspect command ID, target path, cache path, report ID, staged-change ID, backup path intent, validation output, and retry or discard guidance - normalize evidence from hot cache, health, staged-change, and operation-log records.
- User can recover from missing, malformed, stale, or invalid support records without plugin startup or command execution throwing - return explicit read-only diagnostics.
- User can trust that provider secrets, authorization headers, hidden provider state, and raw note bodies are omitted - reuse redaction and add fail-closed tests.
- Developer can validate recovery behavior with synthetic fixtures - add unit, runtime handler, lifecycle, and documentation validation tests.

### Out of Scope (Deferred)

- Applying recovered note changes automatically - Reason: note mutation remains under staged-change review/apply.
- Replaying cloud provider calls or model invocations - Reason: provider calls require explicit review and are not recoverable from local diagnostics.
- Persisting raw provider attempts, authorization headers, hidden provider state, or unbounded note bodies - Reason: violates local-first redaction and fixture-safety rules.
- Building a full recovery UI modal - Reason: this session implements command/service behavior; richer UI can follow later if needed.

---

## 5. Technical Approach

### Architecture

Add recovery contracts in `src/types/recovery.ts` and a testable `RecoverSessionService` in `src/agent/recover-session-service.ts`. The service should accept already-loaded support records plus optional adapter reads, validate record shape with `unknown` inputs, normalize evidence into sorted recovery items, and return a `RecoverySummary` with status, diagnostics, source record paths, and recommended retry or discard options.

Runtime wiring stays in `src/main.ts`. The plugin should create a recovery runtime near the existing hot cache, staged review, and health services, then pass a `recovery` execution option into `createRuntimeCommandHandlers`. The handler for `voidbrain.recover-session` should be duplicate-trigger safe, read-only, and notice-based for the first runtime pass. It must not write support files, mutate notes, or call providers.

Command catalog and docs should be updated alongside code so `voidbrain.recover-session` moves from `planned` to `implemented`, required evidence lists cache path, target paths, report IDs, staged-change IDs, and validation output, and agent surfaces keep local-first recovery safety language synchronized.

### Design Patterns

- Contract-first service: Typed recovery contracts define the public behavior before runtime wiring.
- Adapter boundary: Obsidian file reads stay in `src/main.ts`; service logic remains testable without Obsidian.
- Fail-closed redaction: Any secret-like keys or invalid diagnostic values become validation issues rather than raw output.
- Bounded summary model: Recovery output uses counts, IDs, paths, and short diagnostics instead of note bodies or provider payloads.
- Deterministic sorting: Recovery items and diagnostics sort by source, command ID, and path for stable tests.

### Technology Stack

- TypeScript 5.9 strict mode.
- Obsidian API 1.12 for adapter reads and command registration.
- Vitest 4 for service, command handler, and lifecycle tests.
- Existing provider redaction, vault path validation, hot cache, staged review, and health contracts.
- Bun scripts for validation.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/recovery.ts` | Recovery request, evidence, summary, diagnostic, and action contracts | ~170 |
| `src/agent/recover-session-service.ts` | Read-only service that builds redacted recovery summaries from support records | ~320 |
| `test/fixtures/vault/recovery-fixtures.ts` | Synthetic recovery fixtures for hot cache, staged changes, health reports, logs, and malformed records | ~220 |
| `test/recover-session-service.test.ts` | Service coverage for happy, missing, malformed, stale, and secret-like record paths | ~240 |
| `docs/recover-session-command.md` | Human-readable implemented recovery workflow documentation | ~90 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agent/index.ts` | Export recovery service and types | ~10 |
| `src/agent/runtime-command-handlers.ts` | Add recovery execution option and implemented command outcome | ~90 |
| `src/agent/command-catalog.ts` | Mark `voidbrain.recover-session` implemented and update evidence/safety notes | ~45 |
| `src/main.ts` | Create recovery runtime adapter and wire command execution with read-only Obsidian reads | ~150 |
| `src/types/agent-commands.ts` | Adjust status assumptions only if existing tests require explicit implemented list updates | ~10 |
| `test/agent-surfaces-commands.test.ts` | Update implemented/planned command expectations | ~20 |
| `test/plugin-lifecycle.test.ts` | Cover runtime command notice, no direct vault writes, and malformed support handling | ~90 |
| `docs/agent-surfaces-commands.md` | Update recovery command status and behavior details | ~45 |
| `docs/hot-cache-mvp-integration-validation.md` | Replace residual planned-recovery note with implemented handoff | ~20 |
| `docs/ARCHITECTURE.md` | Add recovery command service to architecture overview | ~20 |
| `AGENTS.md` | Mark `voidbrain.recover-session` implemented with read-only recovery behavior | ~8 |
| `CLAUDE.md` | Mark recovery command implemented and preserve safety phrasing | ~8 |
| `GEMINI.md` | Mark recovery command implemented and preserve safety phrasing | ~8 |
| `skills/voidbrain/SKILL.md` | Update command table and recovery example to implemented behavior | ~20 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] `voidbrain.recover-session` returns a read-only recovery summary from hot cache, staged-change metadata, health report records, operation logs, and validation output.
- [ ] Missing, malformed, stale, and unsupported recovery records return actionable diagnostics without throwing during plugin startup or command execution.
- [ ] Recovery summaries include command ID, cache path, target path, report ID, staged-change ID, backup path intent, validation output, and retry or discard options when available.
- [ ] Runtime command execution prevents duplicate in-flight recovery and never writes notes, support records, or provider state.
- [ ] Command catalog, docs, and agent surfaces describe implemented recovery behavior consistently.

### Testing Requirements

- [ ] Unit tests written and passing for the recovery service.
- [ ] Runtime command handler tests cover implemented recovery outcomes and duplicate-trigger prevention.
- [ ] Plugin lifecycle tests cover command registration, notices, malformed support records, and no direct vault writes.
- [ ] Agent surface command tests updated for implemented recovery status.
- [ ] Manual testing completed in the Obsidian command palette or mock runtime.

### Non-Functional Requirements

- [ ] Recovery stays local-first and performs no cloud provider calls.
- [ ] Provider secrets, authorization headers, hidden provider state, and raw note bodies are never emitted.
- [ ] Recovery output remains bounded by item and diagnostic limits.
- [ ] All examples and tests use `test/fixtures/vault/` or clearly fake paths.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.
- [ ] `bun run validate:agent-surfaces` passes.
- [ ] `bun run validate:fixture-safety` passes.
- [ ] `bun run validate:agent-docs` passes.
- [ ] `bun run validate` passes or residual failures are documented with recovery details.

---

## 8. Implementation Notes

### Key Considerations

- Recovery is diagnostic, not restorative apply behavior. Any note mutation remains under `voidbrain.stage-change`.
- The service should accept `unknown` support records and validate them; do not trust cache or staged-change files merely because they are under `.voidbrain/`.
- Recovery summaries should reference paths and IDs, not full note bodies, raw diffs, raw provider attempts, or unbounded snippets.
- Runtime handler notices can be concise while tests inspect the structured result from the command handler/service.
- Command docs and agent surfaces must move in the same session as the command status change to avoid workflow drift.

### Potential Challenges

- Obsidian adapter listing support folders may be limited: Start from known hot cache path plus in-memory latest health and staged records, then add bounded adapter reads where the mock/runtime supports them.
- Staged-change diffs may contain note bodies: Summaries must include IDs, target paths, statuses, hashes, conflict counts, and validation output, not `beforeContent` or `afterContent`.
- Health report exports are markdown while runtime reports are typed objects: Prefer typed runtime report input and summarize markdown exports only by path/report ID unless a safe parser exists.
- Existing tests assume only one planned command: Update those expectations deliberately with command catalog changes.

### Relevant Considerations

- [P01] **Recovery surface gap**: This session implements recovery using bounded hot cache and support records without raw vault content.
- [P01] **Workflow drift risk**: Command catalog, docs, agent surfaces, PRD session artifacts, and tests must be synchronized.
- [P01] **Obsidian runtime variance**: Keep recovery service logic adapter-light and cover plugin lifecycle behavior with mocks.
- [P01] **Disclosure gates stay mandatory**: Recovery must not replay provider calls or silently escalate to cloud behavior.
- [P01] **Redaction must remain fail-closed**: Invalid or secret-like support fields become diagnostics, not emitted values.
- [P01] **Review-first mutations**: Retry guidance can point to staged review/apply, but recovery cannot apply note edits itself.
- [P01] **Framework-vault separation**: Recovery reads `.voidbrain/` support artifacts and reports without treating user vault notes as framework files.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- Recovery command is triggered repeatedly while adapter reads are in flight.
- Malformed support records crash startup or command execution.
- Recovery summaries accidentally include raw diffs, note bodies, provider attempts, or secret-like diagnostics.
- Missing paths or unsupported records produce vague messages that prevent retry.
- Command docs claim implemented behavior that runtime or tests do not support.

---

## 9. Testing Strategy

### Unit Tests

- Test `RecoverSessionService` with a complete synthetic hot cache record, staged-change records, a health report, and operation-log entries.
- Test malformed JSON-like inputs, missing records, stale timestamps, invalid paths, secret-like keys, and unbounded body fields.
- Test deterministic sorting, bounded item limits, redacted diagnostics, and retry/discard action generation.

### Integration Tests

- Test `createRuntimeCommandHandlers` with a recovery option and duplicate in-flight recovery prevention.
- Test plugin lifecycle command registration, command execution notice text, adapter read failures, and no direct vault writes.
- Test command catalog and agent surface validation after moving recovery to implemented status.

### Manual Testing

- Run the Obsidian command palette command `voidbrain.recover-session` with a synthetic `.voidbrain/cache/hot-cache.json` present.
- Trigger the command with missing support records and confirm the notice remains actionable and read-only.
- Inspect docs and agent surfaces for synchronized status, evidence, and safety phrasing.

### Edge Cases

- Empty `.voidbrain/cache/hot-cache.json`.
- Invalid JSON or wrong artifact kind.
- Hot cache record with secret-like metadata keys.
- Staged-change record containing raw `beforeContent` or `afterContent`.
- Health report with missing report ID or affected paths.
- Duplicate command invocation while a recovery summary is being built.
- Adapter read permission failure.

---

## 10. Dependencies

### External Libraries

- None planned. Use existing TypeScript, Vitest, Obsidian API, and local helpers.

### Other Sessions

- **Depends on**: `phase01-session08-hot-cache-mvp-integration-validation`, `phase01-session07-vault-health-repair-staging`, `phase01-session06-staged-change-review-apply`, `phase00-session05-agent-surfaces-commands`.
- **Depended by**: `phase02-session02-agent-surface-validation-hardening`, `phase02-session04-maintenance-recommendation-planner`, `phase02-session06-batch-source-ingestion-queue`, `phase02-session07-agentic-maintenance-integration-validation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
