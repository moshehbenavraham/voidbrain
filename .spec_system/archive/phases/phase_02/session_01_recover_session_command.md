# Session 01: Recover Session Command

**Session ID**: `phase02-session01-recover-session-command`
**Status**: Complete
**Completed**: 2026-05-13
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Implement `voidbrain.recover-session` as a read-only local workflow that
reconstructs recoverable command context from hot cache records, logs, reports,
staged changes, and validation output.

---

## Scope

### In Scope (MVP)

- Read hot cache support records, staged-change metadata, health reports, and
  command recovery records from local support paths.
- Produce redacted recovery summaries with command ID, target path, cache path,
  report ID, staged-change ID, validation output, and retry or discard options.
- Surface malformed, missing, or stale recovery records without throwing during
  plugin startup or command execution.
- Add unit and lifecycle tests using synthetic fixture vault data.

### Out of Scope

- Applying recovered note changes automatically.
- Replaying cloud provider calls.
- Storing raw provider attempts, authorization headers, hidden provider state,
  or unbounded note bodies.

---

## Prerequisites

- [ ] Phase 01 hot cache support records are available.
- [ ] Staged-change review/apply records preserve recovery IDs and target paths.
- [ ] Health reports and validation outputs expose stable report IDs.

---

## Deliverables

1. Recovery command service, contracts, and runtime handler for
   `voidbrain.recover-session`.
2. Redaction and validation helpers for recovery summaries.
3. Tests covering happy path, missing records, malformed records, stale records,
   and secret-like field rejection.

---

## Success Criteria

- [ ] Recovery summaries are local-first, bounded, and readable.
- [ ] Missing or malformed records fail read-only with actionable diagnostics.
- [ ] Provider secrets, raw hidden provider state, and raw note bodies are never
      emitted.
- [ ] Command surfaces and docs describe implemented recovery behavior.
