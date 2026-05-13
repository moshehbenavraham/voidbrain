# Task Checklist

**Session ID**: `phase04-session05-ecosystem-export-handoff-boundaries`
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
| Foundation | 5 | 5 | 0 |
| Implementation | 11 | 11 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **23** | **23** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0405] Verify Phase 04 Session 05 prerequisites against completed chat, ingestion, staged-change, health, recovery, provider, release, install, packaging, and onboarding sessions (`.spec_system/PRD/phase_04/session_05_ecosystem_export_handoff_boundaries.md`)
- [x] T002 [S0405] Audit existing docs for export, handoff, report, staged-change, source-record, release-evidence, agent-package, provider-review, and publishing language with deterministic notes for implementation (`docs/ecosystem-export-handoff-boundaries.md`)
- [x] T003 [S0405] [P] Create ecosystem handoff boundary guide skeleton with fixture-safe Git, filesystem, copy, and markdown-bundle examples (`docs/ecosystem-export-handoff-boundaries.md`)

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T004 [S0405] [P] Define selected-output, handoff mode, disclosure state, citation evidence, diagnostic issue, and recovery contracts (`src/types/ecosystem-handoff.ts`)
- [x] T005 [S0405] [P] Create synthetic handoff fixtures for selected reports, staged-change summaries, source records, release evidence, markdown bundles, unsafe publishing targets, and cloud disclosure scenarios (`test/fixtures/vault/ecosystem-handoff-fixtures.ts`)
- [x] T006 [S0405] Implement selected output normalization and handoff mode validation with schema-validated input and explicit error mapping (`src/agent/ecosystem-handoff-boundaries.ts`)
- [x] T007 [S0405] Implement citation, source-record, staged-change ID, report ID, artifact path, checksum, and validation output requirements with deterministic ordering (`src/agent/ecosystem-handoff-boundaries.ts`)
- [x] T008 [S0405] Implement diagnostic safety checks for provider secrets, authorization headers, prompt bodies, hidden provider state, private path hints, raw note bodies, and full-vault defaults (`src/agent/ecosystem-handoff-boundaries.ts`)

---

## Implementation (11 tasks)

Main feature implementation.

- [x] T009 [S0405] Implement handoff plan builder for local Git, filesystem, copy, and markdown-bundle modes with duplicate-trigger prevention while in-flight (`src/agent/ecosystem-handoff-boundaries.ts`)
- [x] T010 [S0405] Implement remote, cloud, and unsupported publishing target outcomes with provider review, trust, auth, capability, disclosure, and explicit error mapping (`src/agent/ecosystem-handoff-boundaries.ts`)
- [x] T011 [S0405] Export ecosystem handoff helpers without adding a new user-facing command ID or runtime publishing path (`src/agent/index.ts`)
- [x] T012 [S0405] Complete user-facing boundary guide with selected-output requirements, citation-preserving summaries, recovery records, and out-of-scope publishing language (`docs/ecosystem-export-handoff-boundaries.md`)
- [x] T013 [S0405] Update source ingestion docs to link source-record handoff guidance and preserve citation IDs, source paths, target paths, provider decisions, and validation output (`docs/source-ingestion-staging.md`)
- [x] T014 [S0405] Update staged-change docs to link handoff guidance while preserving review-first mutation boundaries and staged-change recovery IDs (`docs/staged-change-review-apply.md`)
- [x] T015 [S0405] Update health docs to link redacted report handoff guidance with report IDs, staged-change IDs, and validation output (`docs/vault-health-repair-staging.md`)
- [x] T016 [S0405] Update release artifact docs to link release-evidence handoff guidance with artifact paths, checksums, and validation output (`docs/release-artifacts.md`)
- [x] T017 [S0405] Update agent packaging docs to clarify local framework surface handoff as selected file reuse, not hosted publishing (`docs/agent-surface-packaging.md`)
- [x] T018 [S0405] Update provider readiness docs to route remote and cloud handoff through provider review, trust, auth, capability, and disclosure gates (`docs/provider-readiness-guide.md`)
- [x] T019 [S0405] Link the ecosystem handoff boundary guide from README distribution and safety guidance (`README.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T020 [S0405] Write unit tests for selected output normalization, handoff modes, citation requirements, recovery fields, deterministic ordering, and local-only allowed plans (`test/ecosystem-export-handoff-boundaries.test.ts`)
- [x] T021 [S0405] Write unit tests for missing selection, missing citation, missing source record, full-vault default, unsupported publishing target, untrusted cloud, unsafe diagnostic, private path, secret-like value, prompt body, and hidden provider state failures (`test/ecosystem-export-handoff-boundaries.test.ts`)
- [x] T022 [S0405] Add agent validation regression tests for handoff docs, fixture-safe examples, provider review language, citations, staged changes, recovery details, and out-of-scope direct publishing claims (`test/agent-validation-scripts.test.ts`)
- [x] T023 [S0405] Run ecosystem handoff tests plus agent-surface, fixture-safety, agent-doc, and full repository validation; record command output in implementation notes (`.spec_system/specs/phase04-session05-ecosystem-export-handoff-boundaries/implementation-notes.md`)

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
