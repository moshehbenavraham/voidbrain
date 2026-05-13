# Task Checklist

**Session ID**: `phase04-session03-agent-skill-surface-packaging`
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

Initial configuration and environment preparation.

- [x] T001 [S0403] Verify current agent surfaces, command catalog, and validation scripts are synchronized (`src/agent/command-catalog.ts`)
- [x] T002 [S0403] Audit packageable surface paths and excluded vault/support roots with schema-validated input and explicit error mapping (`src/agent/repository-scan-boundary.ts`)
- [x] T003 [S0403] [P] Create agent surface packaging documentation skeleton with synthetic reuse examples (`docs/agent-surface-packaging.md`)

---

## Foundation (6 tasks)

Core structures and base implementations.

- [x] T004 [S0403] [P] Define agent surface package manifest, ecosystem, checksum, issue, diagnostic, and result contracts (`src/types/agent-surface-package.ts`)
- [x] T005 [S0403] [P] Create synthetic package fixture builders for temp repositories and fake surfaces (`test/fixtures/vault/agent-surface-package-fixtures.ts`)
- [x] T006 [S0403] Implement packageable path normalization and candidate validation with schema-validated input and explicit error mapping (`src/agent/agent-surface-packaging.ts`)
- [x] T007 [S0403] Implement package surface loading and ecosystem classification with deterministic ordering and unsupported-path failures (`src/agent/agent-surface-packaging.ts`)
- [x] T008 [S0403] Implement checksum and manifest diagnostic creation with bounded repository-relative paths (`src/agent/agent-surface-packaging.ts`)
- [x] T009 [S0403] Implement package diagnostic safety checks for secret-like values, private path hints, prompt bodies, hidden provider state, and unsupported output paths (`src/agent/agent-surface-packaging.ts`)

---

## Implementation (9 tasks)

Main feature implementation.

- [x] T010 [S0403] Reuse agent surface validation results inside package readiness planning with failure-path handling (`src/agent/agent-surface-packaging.ts`)
- [x] T011 [S0403] Reuse fixture-safety scanning for packageable surfaces with deterministic issue aggregation (`src/agent/agent-surface-packaging.ts`)
- [x] T012 [S0403] Implement ready, blocked, missing-surface, unsafe-content, stale-catalog, and unsupported-path package states with explicit issue codes (`src/agent/agent-surface-packaging.ts`)
- [x] T013 [S0403] Create package readiness CLI adapter with human and JSON output plus bounded error reporting (`scripts/validate-agent-surface-package.ts`)
- [x] T014 [S0403] Wire package readiness validation into package scripts with duplicate command coverage and no new agent command behavior (`package.json`)
- [x] T015 [S0403] Export package planner helpers for tests and future integration without widening runtime provider boundaries (`src/agent/index.ts`)
- [x] T016 [S0403] Update AGENTS, CLAUDE, GEMINI, and Voidbrain skill packaging guidance while preserving local-first, staged-change, provider review, fixture, citation, dry-run, and recovery language (`AGENTS.md`)
- [x] T017 [S0403] Update human command documentation with package readiness behavior, recovery details, and synthetic install/reuse examples (`docs/agent-surfaces-commands.md`)
- [x] T018 [S0403] Add README packaging guide links and validation command summary (`README.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T019 [S0403] Write unit tests for ready package manifests, deterministic ordering, ecosystem labels, checksums, and bounded diagnostics (`test/agent-surface-packaging.test.ts`)
- [x] T020 [S0403] Write unit tests for unknown command IDs, stale statuses, missing safety phrases, unsupported paths, private path hints, secret-like values, and unsafe output paths (`test/agent-surface-packaging.test.ts`)
- [x] T021 [S0403] Run focused package tests plus agent-surface, fixture-safety, and agent-doc validation (`test/agent-surface-packaging.test.ts`)
- [x] T022 [S0403] Run full repository validation and record command output in implementation notes (`.spec_system/specs/phase04-session03-agent-skill-surface-packaging/implementation-notes.md`)

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

Run the validate workflow step to create session validation artifacts.
