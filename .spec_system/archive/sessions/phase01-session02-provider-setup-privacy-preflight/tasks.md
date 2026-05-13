# Task Checklist

**Session ID**: `phase01-session02-provider-setup-privacy-preflight`
**Total Tasks**: 21
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
| Foundation | 5 | 5 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0102] Verify provider prerequisites and record the implementation baseline (`.spec_system/specs/phase01-session02-provider-setup-privacy-preflight/implementation-notes.md`)
- [x] T002 [S0102] [P] Create synthetic provider setup fixtures with fake endpoints and no credential-like values (`test/fixtures/providers/provider-setup-fixtures.ts`)
- [x] T003 [S0102] [P] Create provider setup contracts for profiles, auth tests, setup status, and preflight summaries (`src/types/provider-setup.ts`)

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T004 [S0102] Extend provider contracts for user provider profiles, endpoint metadata, auth status, and setup-safe fields (`src/types/providers.ts`)
- [x] T005 [S0102] [P] Implement provider profile validation, normalization, deduplication, and profile-to-definition conversion (`src/providers/provider-profile-service.ts`)
- [x] T006 [S0102] Add provider profile settings defaults and schema migration target (`src/types/plugin.ts`)
- [x] T007 [S0102] Implement provider profile settings parsing and recovery with raw-secret rejection (`src/utils/settings.ts`)
- [x] T008 [S0102] Export provider setup, auth-test, profile, and preflight services (`src/providers/index.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S0102] Implement provider auth-test runner abstraction with timeout, retry/backoff, and failure-path handling (`src/providers/provider-auth-test.ts`)
- [x] T010 [S0102] Implement settings-aware privacy preflight facade with schema-validated input and explicit error mapping (`src/providers/provider-preflight.ts`)
- [x] T011 [S0102] Merge persisted provider profiles into provider and model role options with types matching declared contracts (`src/views/settings-tab.ts`)
- [x] T012 [S0102] Add secure provider profile controls for save, replace, delete reference, and auth test with duplicate-trigger prevention while in-flight (`src/views/settings-tab.ts`)
- [x] T013 [S0102] Add cloud trust approval controls with state reset or revalidation on provider changes (`src/views/settings-tab.ts`)
- [x] T014 [S0102] Add chat and embedding capability status summaries with exhaustive enum handling (`src/views/settings-tab.ts`)
- [x] T015 [S0102] Extend runtime status input contracts for provider setup, auth, trust, and capability readiness (`src/types/runtime.ts`)
- [x] T016 [S0102] Surface provider auth, trust, and capability readiness without secrets or raw vault content (`src/agent/runtime-status.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T017 [S0102] Update Obsidian mocks for secure provider settings fields, buttons, and setup status assertions (`test/__mocks__/obsidian.ts`)
- [x] T018 [S0102] [P] Add provider setup and privacy preflight tests for profile validation, auth diagnostics, cloud blocking, and redaction (`test/provider-setup-privacy-preflight.test.ts`)
- [x] T019 [S0102] [P] Extend settings migration tests for provider profiles, secret-reference persistence, and raw-secret recovery (`test/plugin-settings-runtime.test.ts`)
- [x] T020 [S0102] [P] Extend runtime status tests for missing setup, auth failure, cloud trust warning, capability mismatch, and ready states (`test/runtime-status.test.ts`)
- [x] T021 [S0102] Run validation commands and record results, residual risks, command ID, and recovery details (`.spec_system/specs/phase01-session02-provider-setup-privacy-preflight/implementation-notes.md`)

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
