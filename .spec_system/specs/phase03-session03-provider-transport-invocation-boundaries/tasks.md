# Task Checklist

**Session ID**: `phase03-session03-provider-transport-invocation-boundaries`
**Total Tasks**: 22
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-13

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[SNNMM]` = Session reference (NN=phase number, MM=session number)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **22** | **22** | **0** |

---

## Setup (3 tasks)

Initial configuration, assumptions, and fixture setup.

- [x] T001 [S0303] Verify sessions 01 and 02 prerequisites and record implementation ordering (`.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/implementation-notes.md`)
- [x] T002 [S0303] Record provider disclosure, redaction, cancellation, retry, duplicate-guard, and fixture-safety assumptions (`.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/security-compliance.md`)
- [x] T003 [S0303] [P] Create synthetic provider invocation fixtures for success, denial, timeout, retry, cancellation, duplicate, and redaction paths (`test/fixtures/providers/provider-invocation-fixtures.ts`)

---

## Foundation (6 tasks)

Core contracts and shared invocation boundary primitives.

- [x] T004 [S0303] Define shared provider invocation attempt, policy, duplicate key, cancellation, recovery, and diagnostic contracts (`src/types/provider-invocation.ts`)
- [x] T005 [S0303] Define embedding request, response, vector, transport, and invocation result contracts with types matching declared provider contracts; exhaustive enum handling (`src/types/provider-invocation.ts`)
- [x] T006 [S0303] Align chat provider request and attempt contracts with shared invocation recovery fields (`src/types/chat.ts`)
- [x] T007 [S0303] Create shared provider invocation boundary helper with cleanup on scope exit for all acquired resources (`src/providers/provider-invocation.ts`)
- [x] T008 [S0303] Add redacted diagnostic normalization for provider invocation failures with explicit error mapping (`src/providers/provider-invocation.ts`)
- [x] T009 [S0303] Export provider invocation and embedding provider APIs from the provider barrel (`src/providers/index.ts`)

---

## Implementation (9 tasks)

Main transport boundary behavior for chat, embeddings, and existing provider-assisted flows.

- [x] T010 [S0303] Refactor chat transport timeout and retry handling onto the shared invocation helper with timeout, retry/backoff, and failure-path handling (`src/providers/chat-provider.ts`)
- [x] T011 [S0303] Add chat duplicate-invocation guard keyed by command, thread, turn, provider, and model with duplicate-trigger prevention while in-flight (`src/providers/chat-provider.ts`)
- [x] T012 [S0303] Propagate parent cancellation and safe recovery metadata through grounded chat invocation with cleanup on scope exit for all acquired resources (`src/agent/grounded-vault-chat-service.ts`)
- [x] T013 [S0303] Create embedding provider invoker with timeout, retry/backoff, cancellation, duplicate guard, and failure-path handling (`src/providers/embedding-provider.ts`)
- [x] T014 [S0303] Prepare embedding invocation decisions only after semantic provider preflight succeeds with authorization enforced at the boundary closest to the resource (`src/vectorstore/semantic-index.ts`)
- [x] T015 [S0303] Preserve semantic readiness recovery details for provider-blocked, canceled, timed-out, retried, and failed embedding states (`src/vectorstore/indexing-runtime-service.ts`)
- [x] T016 [S0303] Keep provider-assisted source ingestion attempts compatible with bounded attempt diagnostics and fallback behavior (`src/agent/source-ingestion-staging-service.ts`)
- [x] T017 [S0303] Add provider invocation fixture exports for chat, embeddings, secret-like diagnostics, and private-content probes (`test/fixtures/providers/provider-invocation-fixtures.ts`)
- [x] T018 [S0303] Add provider transport boundary tests for allowed local calls, denied cloud calls, timeouts, retries, cancellation, duplicate guards, and redacted diagnostics (`test/provider-transport-invocation-boundaries.test.ts`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T019 [S0303] [P] Add grounded chat regression tests for no-transport-on-denial, cancellation, duplicate actions, retry, and diagnostic redaction (`test/grounded-vault-chat.test.ts`)
- [x] T020 [S0303] [P] Add semantic embedding boundary tests for auth-not-ready, privacy-denied, provider-blocked, cancellation, timeout, and safe recovery metadata (`test/indexing-runtime-retrieval-readiness.test.ts`)
- [x] T021 [S0303] [P] Add source ingestion regression tests for provider timeout, cancellation, fallback, and safe diagnostics (`test/source-ingestion-staging.test.ts`)
- [x] T022 [S0303] Run validation commands and record results, residual failures, recovery fields, and ASCII/LF checks (`.spec_system/specs/phase03-session03-provider-transport-invocation-boundaries/validation.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] `security-compliance.md` updated
- [x] `validation.md` updated
- [x] `IMPLEMENTATION_SUMMARY.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
