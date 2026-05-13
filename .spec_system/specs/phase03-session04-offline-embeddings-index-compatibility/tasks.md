# Task Checklist

**Session ID**: `phase03-session04-offline-embeddings-index-compatibility`
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
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **22** | **22** | **0** |

---

## Setup (3 tasks)

Initial configuration, assumptions, and fixture setup.

- [x] T001 [S0304] Verify session 03 provider invocation prerequisites and record implementation ordering (`.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/implementation-notes.md`)
- [x] T002 [S0304] Record semantic compatibility, lexical fallback, provider disclosure, redaction, and fixture-safety assumptions (`.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/security-compliance.md`)
- [x] T003 [S0304] [P] Create synthetic semantic compatibility fixtures for model switches, stale sources, provider-blocked states, cancellation, and fallback probes (`test/fixtures/vault/semantic-index-compatibility-fixtures.ts`)

---

## Foundation (6 tasks)

Core contracts and compatibility primitives.

- [x] T004 [S0304] Define semantic index compatibility, fallback mode, reindex guidance, and safe recovery contracts with exhaustive enum handling (`src/types/retrieval.ts`)
- [x] T005 [S0304] Extend indexing runtime state with semantic compatibility and bounded recovery fields matching declared retrieval contracts (`src/types/indexing-runtime.ts`)
- [x] T006 [S0304] Add runtime status input fields for semantic compatibility and lexical fallback details (`src/types/runtime.ts`)
- [x] T007 [S0304] Create semantic compatibility evaluator for ready, disabled, missing, stale, incompatible, canceled, and provider-blocked states (`src/vectorstore/semantic-index-compatibility.ts`)
- [x] T008 [S0304] Add deterministic source fingerprint, model family, dimension, and guidance helpers with no raw note body diagnostics (`src/vectorstore/semantic-index-compatibility.ts`)
- [x] T009 [S0304] Export semantic compatibility helpers from the vectorstore barrel (`src/vectorstore/index.ts`)

---

## Implementation (8 tasks)

Main semantic compatibility, fallback, and status behavior.

- [x] T010 [S0304] Align semantic snapshot creation and validation with compatibility contracts (`src/vectorstore/semantic-index.ts`)
- [x] T011 [S0304] Evaluate semantic readiness and compatibility in indexing runtime refresh paths with cleanup on scope exit for all acquired resources (`src/vectorstore/indexing-runtime-service.ts`)
- [x] T012 [S0304] Add lexical fallback and reindex guidance updates for stale, missing, incompatible, canceled, timeout, and provider-blocked semantic states (`src/vectorstore/indexing-runtime-service.ts`)
- [x] T013 [S0304] Add lexical fallback selector with bounded limits, validated filters, and deterministic ordering (`src/vectorstore/retrieval-service.ts`)
- [x] T014 [S0304] Gate grounded chat retrieval through semantic compatibility and record lexical fallback metadata without raw question or note body diagnostics (`src/agent/grounded-vault-chat-service.ts`)
- [x] T015 [S0304] Surface semantic compatibility, fallback mode, source path counts, and reindex guidance in runtime index status (`src/agent/runtime-status.ts`)
- [x] T016 [S0304] Show semantic compatibility and reindex guidance in settings runtime controls with state reset or revalidation on re-entry (`src/views/settings-tab.ts`)
- [x] T017 [S0304] Ensure semantic compatibility diagnostics are excluded from persisted settings and hot cache state (`src/utils/settings.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T018 [S0304] [P] Add semantic compatibility unit tests for model switches, dimension mismatch, stale sources, missing index, provider-blocked states, and guidance (`test/offline-embeddings-index-compatibility.test.ts`)
- [x] T019 [S0304] [P] Extend runtime indexing tests for local outage, auth-not-ready, privacy-denied, canceled, stale, fallback, and safe recovery metadata (`test/indexing-runtime-retrieval-readiness.test.ts`)
- [x] T020 [S0304] [P] Extend semantic adapter and lexical fallback regression tests with bounded deterministic results (`test/indexing-retrieval-foundation.test.ts`)
- [x] T021 [S0304] [P] Extend chat fallback, runtime status, and settings non-persistence regression tests (`test/grounded-vault-chat.test.ts`, `test/runtime-status.test.ts`, `test/plugin-settings-runtime.test.ts`)
- [x] T022 [S0304] Run validation commands and record results, residual failures, recovery fields, and ASCII/LF checks (`.spec_system/specs/phase03-session04-offline-embeddings-index-compatibility/validation.md`)

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

Run the validate workflow step to verify session completeness.
