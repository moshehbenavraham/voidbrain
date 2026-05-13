# Session 05: Provider Troubleshooting and Recovery UX

**Session ID**: `phase03-session05-provider-troubleshooting-recovery-ux`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Surface provider readiness, troubleshooting, retry, and recovery details in the
plugin UI and docs without leaking secrets, raw private content, or hidden
provider state.

---

## Scope

### In Scope (MVP)

- Add provider readiness and troubleshooting states to settings, status, and
  relevant modal surfaces.
- Support retest, retry, reset, and disclosure-review actions with duplicate
  prevention and state reset on close.
- Export or report bounded provider diagnostics with command IDs, provider IDs,
  model IDs, readiness codes, cache paths, and validation output.
- Update docs for local runtime setup, OpenAI-compatible endpoints, offline
  fallback, provider recovery, and secret-handling boundaries.

### Out of Scope

- Applying AI-generated note edits directly from troubleshooting flows.
- Enabling cloud providers automatically when local providers fail.
- Distribution packaging or marketplace release.

---

## Prerequisites

- [ ] Session 04 completed.
- [ ] Existing settings tab, status surface, provider setup modal, runtime
      status store, and recovery service are available.
- [ ] Documentation and agent-surface validation commands are available.

---

## Deliverables

1. Provider troubleshooting UX across settings, status, and relevant modals.
2. Recovery-safe provider diagnostics and retry guidance.
3. Documentation updates for offline and OpenAI-compatible provider setup.

---

## Success Criteria

- [ ] Users can inspect provider auth, trust, capability, disclosure, and index
      compatibility status before running provider-backed workflows.
- [ ] Retest, retry, reset, and disclosure-review actions avoid duplicate
      operations and reset stale modal/store state.
- [ ] Exported provider diagnostics remain redacted and fixture-safe.
- [ ] Docs explain local-first behavior, cloud disclosure gates, offline
      fallback, and recovery details.
