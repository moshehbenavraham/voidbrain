# Task Checklist

**Session ID**: `phase03-session05-provider-troubleshooting-recovery-ux`
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
| Foundation | 6 | 6 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Setup (3 tasks)

Initial configuration, state recovery context, and fixture preparation.

- [x] T001 [S0305] Verify session 04 completion state, provider troubleshooting prerequisites, and implementation ordering (`.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/implementation-notes.md`)
- [x] T002 [S0305] Record troubleshooting, disclosure-review, redaction, recovery, and fixture-safety assumptions (`.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/security-compliance.md`)
- [x] T003 [S0305] [P] Create synthetic provider troubleshooting fixtures for local outage, missing secret, auth failure, cloud disabled, capability mismatch, semantic fallback, and ready states (`test/fixtures/providers/provider-troubleshooting-fixtures.ts`)

---

## Foundation (6 tasks)

Core contracts and report composition primitives.

- [x] T004 [S0305] Define provider troubleshooting report, diagnostic, action, severity, and recovery contracts with exhaustive enum handling (`src/types/provider-setup.ts`)
- [x] T005 [S0305] Create provider troubleshooting report composer from settings, providers, auth records, role summaries, semantic compatibility, and recovery context (`src/providers/provider-troubleshooting.ts`)
- [x] T006 [S0305] Add safe diagnostic and recovery-field builders that allow IDs, readiness codes, cache paths, report IDs, source counts, and validation output only (`src/providers/provider-troubleshooting.ts`)
- [x] T007 [S0305] Export provider troubleshooting helpers from the provider barrel (`src/providers/index.ts`)
- [x] T008 [S0305] Add optional provider troubleshooting input support for runtime status composition (`src/types/runtime.ts`)
- [x] T009 [S0305] Add deterministic action ordering for retest, retry, reset, disclosure review, refresh index, and inspect recovery guidance (`src/providers/provider-troubleshooting.ts`)

---

## Implementation (8 tasks)

Main provider troubleshooting, UI, status, and documentation behavior.

- [x] T010 [S0305] Integrate provider troubleshooting reports into provider runtime status with bounded details and no raw diagnostics (`src/agent/runtime-status.ts`)
- [x] T011 [S0305] Render provider troubleshooting summary in settings with explicit loading, empty, error, and offline states (`src/views/settings-tab.ts`)
- [x] T012 [S0305] Add retest, retry, reset, disclosure-review, and refresh controls in settings with duplicate-trigger prevention while in flight (`src/views/settings-tab.ts`)
- [x] T013 [S0305] Ensure settings troubleshooting state resets or revalidates on display, save, retest, reset, indexing refresh, and provider profile deletion (`src/views/settings-tab.ts`)
- [x] T014 [S0305] Render provider troubleshooting details in the status view with platform-appropriate labels, focus behavior, and non-overlapping text (`src/views/status-view.ts`)
- [x] T015 [S0305] Keep the Svelte status surface provider details readable and accessible across ready, warning, error, and missing states (`src/components/StatusSurface.svelte`)
- [x] T016 [S0305] Wire runtime refresh and safe provider troubleshooting action outcomes through the Obsidian lifecycle owner (`src/main.ts`)
- [x] T017 [S0305] Update provider troubleshooting, offline fallback, cloud disclosure, and secret-handling documentation (`docs/provider-troubleshooting-recovery.md`, `docs/provider-setup.md`, `README.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T018 [S0305] [P] Add provider troubleshooting report tests for local outage, missing secret, auth failure, timeout, cloud disabled, untrusted cloud, capability mismatch, semantic fallback, and ready states (`test/provider-troubleshooting-recovery-ux.test.ts`)
- [x] T019 [S0305] [P] Extend runtime status and settings persistence tests for bounded troubleshooting details and no persisted diagnostics (`test/runtime-status.test.ts`, `test/plugin-settings-runtime.test.ts`)
- [x] T020 [S0305] [P] Extend plugin lifecycle/settings tests for duplicate-trigger prevention, reset behavior, re-entry revalidation, and status refresh (`test/plugin-lifecycle.test.ts`)
- [x] T021 [S0305] Run validation commands and record results, residual failures, recovery fields, and ASCII/LF checks (`.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/validation.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] `security-compliance.md` updated
- [x] `validation.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness for the spec workflow.
