# Task Checklist

**Session ID**: `phase01-session04-grounded-vault-chat`
**Total Tasks**: 23
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
| Foundation | 7 | 7 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **23** | **23** | **0** |

---

## Setup (3 tasks)

Initial configuration and implementation context.

- [x] T001 [S0104] Verify provider preflight, indexing runtime, retrieval, command catalog, view, store, and fixture prerequisites and record implementation baseline (`.spec_system/specs/phase01-session04-grounded-vault-chat/implementation-notes.md`)
- [x] T002 [S0104] [P] Audit chat command surfaces and runtime placeholder behavior for status changes without stale command references (`.spec_system/specs/phase01-session04-grounded-vault-chat/implementation-notes.md`)
- [x] T003 [S0104] [P] Create synthetic chat fixtures with citation expectations, weak retrieval cases, and no secret-like or private-path values (`test/fixtures/vault/chat-fixtures.ts`)

---

## Foundation (7 tasks)

Core contracts, provider boundary, and state foundations.

- [x] T004 [S0104] Create chat contracts for questions, context chips, retrieval preview, citations, turns, failures, retry, branch, and persisted state with types matching declared contracts and exhaustive enum handling (`src/types/chat.ts`)
- [x] T005 [S0104] Create provider chat invoker abstraction with timeout, retry/backoff, failure-path handling, and redacted diagnostics for external provider calls (`src/providers/chat-provider.ts`)
- [x] T006 [S0104] Create grounded chat service skeleton with schema-validated question input and explicit error mapping (`src/agent/grounded-vault-chat-service.ts`)
- [x] T007 [S0104] Create chat thread store with draft recovery, subscriber updates, idempotency protection, transaction boundaries, and compensation on persistence failure (`src/stores/chat-thread-store.ts`)
- [x] T008 [S0104] Export grounded chat service entry points for runtime composition (`src/agent/index.ts`)
- [x] T009 [S0104] Export provider chat invoker contracts from the provider barrel (`src/providers/index.ts`)
- [x] T010 [S0104] Define chat command execution options for runtime handlers without changing planned command behavior yet (`src/agent/runtime-command-handlers.ts`)

---

## Implementation (9 tasks)

Main chat service, UI, command, and lifecycle implementation.

- [x] T011 [S0104] Implement lexical retrieval flow using runtime index readiness, bounded pagination, validated filters, deterministic ordering, and weak-retrieval failure state (`src/agent/grounded-vault-chat-service.ts`)
- [x] T012 [S0104] Implement citation assembly that requires vault path, heading when available, chunk ID, source paths, and retrieval score before answer readiness (`src/agent/grounded-vault-chat-service.ts`)
- [x] T013 [S0104] Implement provider setup preflight and chat invocation path with duplicate-trigger prevention while in-flight (`src/agent/grounded-vault-chat-service.ts`)
- [x] T014 [S0104] Implement retry, branch, draft recovery, and failure preservation with state reset or revalidation on re-entry (`src/stores/chat-thread-store.ts`)
- [x] T015 [S0104] Implement Obsidian chat view with input, context chips, retrieval preview, answer timeline, retry, branch, and explicit loading, empty, error, and offline states (`src/views/chat-view.ts`)
- [x] T016 [S0104] Wire chat service, store, view registration, command opening, subscriptions, and cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T017 [S0104] Mark `voidbrain.chat-with-vault` implemented only after runtime command wiring is complete and citation requirements remain documented (`src/agent/command-catalog.ts`)
- [x] T018 [S0104] Complete chat command handler execution while preserving safe placeholders for other planned commands (`src/agent/runtime-command-handlers.ts`)
- [x] T019 [S0104] Add Obsidian-native chat layout, state, citation, timeline, focus, and keyboard styles with platform-appropriate accessibility labels and input support (`src/styles.css`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T020 [S0104] [P] Add grounded chat service tests for readiness, retrieval, weak matches, citations, provider gates, duplicate-trigger prevention, and no direct note mutation (`test/grounded-vault-chat.test.ts`)
- [x] T021 [S0104] [P] Add chat view tests for loading, empty, error, offline, ask, retry, branch, draft recovery, focus behavior, and cleanup (`test/chat-view.test.ts`)
- [x] T022 [S0104] [P] Extend plugin lifecycle tests for chat view registration, command opening, provider-denial notices, cleanup, and no vault writes (`test/plugin-lifecycle.test.ts`)
- [x] T023 [S0104] Run validation commands and record results, residual risks, command ID, target paths, and recovery details (`.spec_system/specs/phase01-session04-grounded-vault-chat/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
