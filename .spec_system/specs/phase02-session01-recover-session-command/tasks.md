# Task Checklist

**Session ID**: `phase02-session01-recover-session-command`
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

Initial configuration and environment preparation.

- [x] T001 [S0201] Verify Phase 01 recovery prerequisites, current command catalog status, and validation scripts from the repository root (`package.json`)
- [x] T002 [S0201] Create recovery service, type, fixture, test, and documentation file placeholders (`src/agent/recover-session-service.ts`)
- [x] T003 [S0201] Confirm existing hot cache, staged-change, health, runtime command, and redaction contracts that recovery will consume (`src/types/hot-cache.ts`)

---

## Foundation (6 tasks)

Core structures and base implementations.

- [x] T004 [S0201] [P] Define recovery request, evidence, source, diagnostic, action, and summary contracts with bounded output limits (`src/types/recovery.ts`)
- [x] T005 [S0201] [P] Create synthetic recovery fixtures for complete, missing, malformed, stale, and secret-like support records (`test/fixtures/vault/recovery-fixtures.ts`)
- [x] T006 [S0201] Implement recovery evidence normalization for command IDs, cache paths, target paths, report IDs, staged-change IDs, backup intent, and validation output with schema-validated input and explicit error mapping (`src/agent/recover-session-service.ts`)
- [x] T007 [S0201] Implement fail-closed redaction and body omission for recovery diagnostics with bounded pagination, validated filters, and deterministic ordering (`src/agent/recover-session-service.ts`)
- [x] T008 [S0201] Implement missing, malformed, stale, and unsupported record diagnostics without throwing on invalid support records (`src/agent/recover-session-service.ts`)
- [x] T009 [S0201] Export recovery service and contracts through the agent barrel for runtime and tests (`src/agent/index.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T010 [S0201] Add recovery runtime command execution options and duplicate-trigger prevention while in-flight (`src/agent/runtime-command-handlers.ts`)
- [x] T011 [S0201] Implement `voidbrain.recover-session` runtime outcome mapping with retry or discard guidance and no provider calls (`src/agent/runtime-command-handlers.ts`)
- [x] T012 [S0201] Wire the recovery service into plugin lifecycle and command registration with cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T013 [S0201] Add read-only Obsidian adapter recovery inputs for hot cache, latest health report, active staged changes, and support-record read failures (`src/main.ts`)
- [x] T014 [S0201] Update command catalog status, required evidence, recovery behavior, and notes for `voidbrain.recover-session` (`src/agent/command-catalog.ts`)
- [x] T015 [S0201] [P] Update AGENTS, CLAUDE, GEMINI, and Voidbrain skill command surfaces to mark recovery implemented while preserving local-first, provider secret, synthetic fixture, citation, dry-run, and recovery safety phrasing (`AGENTS.md`)
- [x] T016 [S0201] [P] Update human docs for recovery command behavior, hot cache handoff, and architecture placement (`docs/recover-session-command.md`)
- [x] T017 [S0201] Review generated docs and surfaces for stale planned-language references and command status drift (`docs/agent-surfaces-commands.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T018 [S0201] [P] Write recovery service unit tests for complete records, malformed records, missing records, stale records, and secret-like diagnostics (`test/recover-session-service.test.ts`)
- [x] T019 [S0201] [P] Update command catalog and agent surface tests for implemented recovery status and synchronized safety language (`test/agent-surfaces-commands.test.ts`)
- [x] T020 [S0201] Add plugin lifecycle tests for recovery command notices, adapter failures, duplicate trigger behavior, and no direct vault writes (`test/plugin-lifecycle.test.ts`)
- [x] T021 [S0201] Run agent documentation and fixture safety validation from the repository root (`package.json`)
- [x] T022 [S0201] Run full repository validation and record any residual failure with command ID, target path, cache path, staged-change ID, report ID, and validation output (`package.json`)

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
