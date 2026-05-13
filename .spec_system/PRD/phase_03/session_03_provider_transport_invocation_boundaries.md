# Session 03: Provider Transport Invocation Boundaries

**Session ID**: `phase03-session03-provider-transport-invocation-boundaries`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Implement provider transport invocation boundaries for chat and embeddings so
adapters run only after preflight, cancellation, timeout, retry, and redaction
requirements are satisfied.

---

## Scope

### In Scope (MVP)

- Define provider adapter interfaces for chat and embedding invocation behind
  selected provider and model details.
- Build request preparation paths that run provider preflight before an adapter
  receives private-vault content.
- Add timeout, cancellation, retry, and duplicate-invocation guards with
  bounded recovery metadata.
- Redact diagnostics before status, hot cache, logs, or user-facing reports can
  reference provider failures.

### Out of Scope

- New chat timeline UX beyond existing status integration.
- Tool-call execution beyond current provider capability metadata.
- Live URL fetching or autonomous web research.

---

## Prerequisites

- [ ] Session 01 completed.
- [ ] Session 02 completed.
- [ ] Existing grounded chat, source ingestion, semantic readiness, redaction,
      and runtime status services are available.

---

## Deliverables

1. Chat and embedding provider adapter invocation contracts.
2. Preflight-gated request preparation with cancellation and timeout behavior.
3. Tests for allowed local calls, denied cloud calls, timeouts, retries,
   cancellation, duplicate guards, and redacted diagnostics.

---

## Success Criteria

- [ ] No adapter can receive private-vault content unless provider preflight
      returns allowed.
- [ ] Timeout, cancellation, and retry paths preserve command IDs, provider IDs,
      model IDs, cache paths, and validation output needed for inspection.
- [ ] Prompt bodies, raw note bodies, credentials, authorization headers, and
      hidden provider state are excluded from durable diagnostics.
- [ ] Existing chat and ingestion tests remain compatible with provider
      boundaries.
