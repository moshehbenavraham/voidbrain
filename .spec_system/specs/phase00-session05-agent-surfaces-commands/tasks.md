# Task Checklist

**Session ID**: `phase00-session05-agent-surfaces-commands`
**Total Tasks**: 24
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-12

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
| Implementation | 10 | 10 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **24** | **24** | **0** |

---

## Setup (3 tasks)

Initial setup, baseline docs, and script entry points.

- [x] T001 [S0005] Verify Session 01-04 prerequisites, root docs, synthetic fixture boundaries, and no-secret expectations (`.spec_system/specs/phase00-session05-agent-surfaces-commands/implementation-notes.md`)
- [x] T002 [S0005] [P] Create agent command documentation shell with command table, safety policy, validation workflow, and deferred behavior (`docs/agent-surfaces-commands.md`)
- [x] T003 [S0005] [P] Create agent domain export surface for command catalog, surface validation, fixture safety, and update preview helpers (`src/agent/index.ts`)

---

## Foundation (6 tasks)

Canonical command contracts and reusable safety helpers.

- [x] T004 [S0005] Define agent command, surface, privacy level, staged-write policy, implementation status, and validation result contracts with exhaustive enum handling (`src/types/agent-commands.ts`)
- [x] T005 [S0005] Implement canonical MVP command catalog for ingest, chat, health, staging, recovery, validation, and framework update workflows with explicit planned-versus-implemented status (`src/agent/command-catalog.ts`)
- [x] T006 [S0005] Implement command catalog query helpers with deterministic ordering, duplicate ID detection, and schema-validated input (`src/agent/command-catalog.ts`)
- [x] T007 [S0005] Implement markdown surface parser for command IDs and safety phrases with schema-validated input and explicit error mapping (`src/agent/surface-validation.ts`)
- [x] T008 [S0005] Implement fixture and example safety scanner for secret-like keys, credential-like values, and private-path hints with explicit error mapping (`src/agent/fixture-safety.ts`)
- [x] T009 [S0005] Implement dry-run framework update preview helper with user-content exclusion rules and duplicate-trigger prevention while in-flight (`src/agent/framework-update-preview.ts`)

---

## Implementation (10 tasks)

Markdown surfaces, local scripts, package wiring, and documentation sync.

- [x] T010 [S0005] Update root agent instructions with safe workflow principles, command table, local-first privacy rules, staged-write defaults, and recovery expectations (`AGENTS.md`)
- [x] T011 [S0005] [P] Create Claude Code surface synchronized to the canonical command catalog with privacy, staging, citation, and recovery requirements (`CLAUDE.md`)
- [x] T012 [S0005] [P] Create Gemini CLI surface synchronized to the canonical command catalog with privacy, staging, citation, and recovery requirements (`GEMINI.md`)
- [x] T013 [S0005] [P] Create skill-style Voidbrain surface with command usage, prerequisites, and safe examples using synthetic fixture paths only (`skills/voidbrain/SKILL.md`)
- [x] T014 [S0005] Complete agent command documentation with command statuses, inputs, outputs, local validation commands, and framework update preview behavior (`docs/agent-surfaces-commands.md`)
- [x] T015 [S0005] Create local agent surface validation script with bounded repository scanning, deterministic output, and explicit nonzero failures (`scripts/validate-agent-surfaces.ts`)
- [x] T016 [S0005] Create local fixture safety validation script with bounded fixture scanning, deterministic output, and explicit nonzero failures (`scripts/check-fixture-safety.ts`)
- [x] T017 [S0005] Create local framework update preview script with dry-run default behavior and no direct user vault writes (`scripts/preview-framework-update.ts`)
- [x] T018 [S0005] Add package scripts for agent surface validation, fixture safety validation, and combined agent documentation validation (`package.json`)
- [x] T019 [S0005] Update README and source layout documentation with agent surface locations, script usage, and command-domain ownership (`README.md`, `src/README.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T020 [S0005] Write unit tests for command catalog uniqueness, command status labels, surface mappings, and deterministic helper output (`test/agent-surfaces-commands.test.ts`)
- [x] T021 [S0005] Write unit tests for markdown surface validation, missing command detection, stale command detection, and required safety phrase checks (`test/agent-surfaces-commands.test.ts`)
- [x] T022 [S0005] Write unit tests for fixture safety scanning of secret-like keys, credential-like values, private path hints, and allowed synthetic examples (`test/agent-surfaces-commands.test.ts`)
- [x] T023 [S0005] Write unit tests for framework update preview dry-run behavior, user-content exclusion, and duplicate-trigger prevention while in-flight (`test/agent-surfaces-commands.test.ts`)
- [x] T024 [S0005] Run build, type check, lint, tests, agent surface validation, fixture safety validation, ASCII validation, and record command output summary (`.spec_system/specs/phase00-session05-agent-surfaces-commands/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] Validation complete and ready for updateprd

---

## Next Steps

Session complete. Use the validation report and implementation summary as the closeout record.
