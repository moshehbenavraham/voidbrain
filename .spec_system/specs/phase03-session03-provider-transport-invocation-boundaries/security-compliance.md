# Security Compliance

**Session ID**: `phase03-session03-provider-transport-invocation-boundaries`
**Last Updated**: 2026-05-13 13:03

---

## Provider Boundary Assumptions

- Provider transport adapters may receive private vault content only after setup preflight allows the selected role, provider, model, capability, auth, trust, and disclosure state.
- Invocation helpers do not grant disclosure decisions; they only execute prepared requests with timeout, cancellation, retry, duplicate guard, attempt records, and safe diagnostics.
- Chat payloads may include question text, evidence snippets, citations, and source paths only inside the adapter payload after chat preflight allows the request.
- Embedding payloads may include text chunks only inside a prepared embedding request after embedding preflight allows the request.

## Redaction And Recovery Assumptions

- Durable diagnostics preserve stable recovery fields such as command IDs, provider IDs, model IDs, source path counts, target paths, cache paths, staged-change IDs, report IDs, readiness codes, validation output, attempt statuses, and timestamps.
- Durable diagnostics must not include prompt bodies, raw note bodies, text chunks, snippets, credentials, authorization headers, private source paths, hidden transport state, or raw provider error objects.
- Unknown provider diagnostics are redacted and sanitized; unsupported diagnostic shapes fail closed to `{ redaction: "failed" }`.

## Cancellation, Retry, And Duplicate Guard Assumptions

- Each invocation attempt owns an abort controller and clears timers and listeners when the attempt scope exits.
- Parent cancellation wins over retry/backoff and returns a caller-visible canceled failure.
- Duplicate invocation keys are denied while the first matching invocation is still in flight.
- Retry behavior is bounded by explicit max-attempt and backoff policy values.

## Fixture Safety Assumptions

- Tests use synthetic provider IDs, synthetic models, fake paths under fixture vaults, and local transport stubs.
- Tests must not require live providers, network calls, credentials, authorization headers, private vault files, or user-specific paths.

## Final Review

- Full validation, fixture safety, and ASCII/LF checks passed.
- New diagnostics use redacted and sanitized provider invocation records.
- New tests use synthetic fixture paths and no live provider credentials.
- No provider secrets, authorization headers, raw prompt bodies, embedding text chunks, private source paths, or hidden provider transport state are written to durable diagnostics.

---
