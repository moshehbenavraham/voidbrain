# Task Checklist

**Session ID**: `phase02-session02-agent-surface-validation-hardening`
**Total Tasks**: 18
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
| Implementation | 6 | 6 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (3 tasks)

Initial project and validation surface review.

- [x] T001 [S0202] Verify analyzer state, completed prerequisites, and current planned session (`.spec_system/state.json`)
- [x] T002 [S0202] Review existing validation scripts and command catalog behavior (`scripts/validate-agent-surfaces.ts`)
- [x] T003 [S0202] Review existing fixture safety boundaries and docs scan scope (`scripts/check-fixture-safety.ts`)

---

## Foundation (5 tasks)

Core contracts, helper boundaries, and reusable fixtures.

- [x] T004 [S0202] Extend validation issue contracts for heading, remediation, and boundary metadata (`src/types/agent-commands.ts`)
- [x] T005 [S0202] [P] Create bounded repository scan helper with normalized paths and explicit user-content exclusions (`src/agent/repository-scan-boundary.ts`)
- [x] T006 [S0202] [P] Create deterministic validation issue reporting helper with redacted line excerpts (`src/agent/agent-validation-reporting.ts`)
- [x] T007 [S0202] [P] Create synthetic agent surface validation fixtures for drift and unsafe example cases (`test/fixtures/vault/agent-surface-validation-fixtures.ts`)
- [x] T008 [S0202] Export new validation helpers through the agent module barrel (`src/agent/index.ts`)

---

## Implementation (6 tasks)

Main validation hardening, scripts, and documentation synchronization.

- [x] T009 [S0202] Harden command catalog validation and mark `voidbrain.validate-agent-surfaces` implemented (`src/agent/command-catalog.ts`)
- [x] T010 [S0202] Harden markdown surface validation for line, heading, command status, and remediation output with schema-validated input and explicit error mapping (`src/agent/surface-validation.ts`)
- [x] T011 [S0202] Harden fixture safety scanning for secret-like keys, credential-like values, private path hints, and bounded excerpts with explicit error mapping (`src/agent/fixture-safety.ts`)
- [x] T012 [S0202] Update agent surface validation script for bounded reads, deterministic output, and fail-closed missing or unreadable surfaces (`scripts/validate-agent-surfaces.ts`)
- [x] T013 [S0202] Update fixture safety script for bounded path collection, unsupported path rejection, and deterministic ordering (`scripts/check-fixture-safety.ts`)
- [x] T014 [S0202] Synchronize implemented validation behavior across agent surfaces and human docs (`docs/agent-surfaces-commands.md`)

---

## Testing (4 tasks)

Regression coverage, command execution, and quality gates.

- [x] T015 [S0202] Expand catalog, surface, status drift, and fixture safety unit tests (`test/agent-surfaces-commands.test.ts`)
- [x] T016 [S0202] [P] Add script adapter tests for bounded scan roots, missing files, unreadable files, and deterministic issue output (`test/agent-validation-scripts.test.ts`)
- [x] T017 [S0202] Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, and `bun run validate:agent-docs` (`package.json`)
- [x] T018 [S0202] Run `bun run validate` and record residual failures with recovery details if any (`.spec_system/specs/phase02-session02-agent-surface-validation-hardening/implementation-notes.md`)

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
