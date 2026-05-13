# Task Checklist

**Session ID**: `phase01-session07-vault-health-repair-staging`
**Total Tasks**: 25
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
| Implementation | 11 | 11 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **25** | **25** | **0** |

---

## Setup (3 tasks)

Initial validation and session setup.

- [x] T001 [S0107] Verify Session 03 and Session 06 prerequisites, current scanner behavior, staged-review apply handoff, and fixture-only boundaries (`.spec_system/specs/phase01-session07-vault-health-repair-staging/implementation-notes.md`)
- [x] T002 [S0107] Create security and recovery checklist for health scans, report export, repair staging, command IDs, target paths, staged-change IDs, and validation output (`.spec_system/specs/phase01-session07-vault-health-repair-staging/security-compliance.md`)
- [x] T003 [S0107] Map command, modal, status, report export, and staged-repair ownership before implementation (`.spec_system/specs/phase01-session07-vault-health-repair-staging/implementation-notes.md`)

---

## Foundation (6 tasks)

Core contracts, services, and fixtures.

- [x] T004 [S0107] Expand vault health contracts for content-gap findings, grouped reports, markdown export metadata, repair safety, and runtime scan state (`src/types/health.ts`)
- [x] T005 [S0107] Add deterministic grouping, content-gap detection, redacted markdown export helpers, and remediation safety helpers (`src/agent/vault-health.ts`)
- [x] T006 [S0107] Create vault health runtime service for scan orchestration over Obsidian notes, index freshness, report export, and repair staging with schema-validated input and explicit error mapping (`src/agent/vault-health-runtime-service.ts`)
- [x] T007 [S0107] [P] Create vault health store for scan status, selected finding group, export result, staged repair result, and state reset on re-entry (`src/stores/vault-health-store.ts`)
- [x] T008 [S0107] [P] Create synthetic vault health runtime fixtures for broken links, orphans, stale indexes, content gaps, missing citations, safe repair, and report-only findings (`test/fixtures/vault/vault-health-runtime-fixtures.ts`)
- [x] T009 [S0107] Export health runtime service, store-facing helpers, and health report utilities from the agent barrel (`src/agent/index.ts`)

---

## Implementation (11 tasks)

Runtime command, UI, export, repair staging, and documentation.

- [x] T010 [S0107] Wire health runtime ownership into plugin lifecycle, cleanup, status refresh, and shared staged-change review queue with cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T011 [S0107] Implement Obsidian command handling for `voidbrain.health-check` to open the health report flow with duplicate-trigger prevention while in-flight (`src/agent/runtime-command-handlers.ts`)
- [x] T012 [S0107] Create vault health modal shell with loading, empty, error, offline, and latest-report states with explicit loading, empty, error, and offline states (`src/views/vault-health-modal.ts`)
- [x] T013 [S0107] Render grouped health findings with severity tabs, affected paths, evidence rows, remediation labels, and keyboard reachable controls with platform-appropriate accessibility labels, focus management, and input support (`src/views/vault-health-modal.ts`)
- [x] T014 [S0107] Implement markdown health report export to `.voidbrain/reports/` with redaction, deterministic ordering, and no provider secrets with idempotency protection, transaction boundaries, and compensation on failure (`src/agent/vault-health-runtime-service.ts`)
- [x] T015 [S0107] Implement safe repair staging for deterministic low-risk citation or source-trace fixes through staged-change records with duplicate-trigger prevention while in-flight (`src/agent/vault-health-runtime-service.ts`)
- [x] T016 [S0107] Keep unsafe or ambiguous repairs report-only for broken links, broad orphans, stale indexes, and content gaps without creating staged changes (`src/agent/vault-health-runtime-service.ts`)
- [x] T017 [S0107] Include latest health report in runtime status summaries with affected path samples and recovery details (`src/agent/runtime-status.ts`)
- [x] T018 [S0107] Add health report styles for modal groups, evidence tables, export state, and repair action controls (`src/styles.css`)
- [x] T019 [S0107] Update `voidbrain.health-check` catalog status, runtime notes, safety phrases, outputs, and recovery behavior (`src/agent/command-catalog.ts`)
- [x] T020 [S0107] Synchronize health-check behavior across agent surfaces and human docs while preserving local-first, staged changes, provider secrets, citations, dry-run, and recovery language (`docs/agent-surfaces-commands.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T021 [S0107] [P] Write scanner tests for grouping, content-gap detection, markdown export, redaction, and deterministic ordering (`test/vault-health.test.ts`)
- [x] T022 [S0107] [P] Write runtime service tests for scan orchestration, export failures, safe repair staging, duplicate repair prevention, and report-only blocking (`test/vault-health-runtime-service.test.ts`)
- [x] T023 [S0107] [P] Write modal and store tests for loading, empty, error, offline, grouped report, export, staged repair, re-entry reset, and cleanup states (`test/vault-health-modal.test.ts`)
- [x] T024 [S0107] Add plugin lifecycle tests for command registration, modal opening, scan action, export action, staged repair handoff, status refresh, and cleanup (`test/plugin-lifecycle.test.ts`)
- [x] T025 [S0107] Run validation commands and record results for agent surfaces, fixture safety, agent docs, full validation, and residual risks (`.spec_system/specs/phase01-session07-vault-health-repair-staging/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] security-compliance.md updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness.
