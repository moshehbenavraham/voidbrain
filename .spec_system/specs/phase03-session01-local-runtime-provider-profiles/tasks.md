# Task Checklist

**Session ID**: `phase03-session01-local-runtime-provider-profiles`
**Total Tasks**: 20
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
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial verification and session preparation.

- [x] T001 [S0301] Verify Phase 02 completion, Phase 03 Session 01 scope, provider setup prerequisites, and existing validation baseline (`.spec_system/PRD/phase_03/session_01_local_runtime_provider_profiles.md`)
- [x] T002 [S0301] Create session implementation, security, validation, and summary placeholders with recovery fields for command IDs and validation output (`.spec_system/specs/phase03-session01-local-runtime-provider-profiles/implementation-notes.md`)
- [x] T003 [S0301] Map provider profile, readiness, preflight, settings, redaction, and fixture integration points before edits (`.spec_system/specs/phase03-session01-local-runtime-provider-profiles/implementation-notes.md`)

---

## Foundation (5 tasks)

Core contracts, fixtures, and readiness service structure.

- [x] T004 [S0301] [P] Add local runtime readiness, model metadata, probe input, probe result, and denial code contracts with exhaustive enum handling (`src/types/provider-setup.ts`)
- [x] T005 [S0301] [P] Extend provider setup-safe metadata for local runtime readiness evidence without raw transport state (`src/types/providers.ts`)
- [x] T006 [S0301] [P] Create synthetic local runtime fixtures for ready, offline, timeout, malformed, duplicate, chat-only, embedding-only, and redacted diagnostic paths (`test/fixtures/providers/local-runtime-provider-fixtures.ts`)
- [x] T007 [S0301] [P] Create local runtime readiness service skeleton with injected probe, clock, timeout, and diagnostic redaction boundaries (`src/providers/local-runtime-readiness.ts`)
- [x] T008 [S0301] Export local runtime readiness contracts and helpers through the provider barrel (`src/providers/index.ts`)

---

## Implementation (8 tasks)

Local runtime profile validation, readiness probes, setup summaries, and settings recovery.

- [x] T009 [S0301] Implement local endpoint and model contract validation with schema-validated input and explicit error mapping (`src/providers/provider-profile-service.ts`)
- [x] T010 [S0301] Implement local runtime readiness probe execution with timeout, abort cleanup, deterministic model parsing, and failure-path handling (`src/providers/local-runtime-readiness.ts`)
- [x] T011 [S0301] Implement chat and embedding capability readiness summaries with bounded model counts, validated filters, and deterministic ordering (`src/providers/local-runtime-readiness.ts`)
- [x] T012 [S0301] Bridge local runtime readiness records into existing auth-test/setup status behavior without secrets or private payloads (`src/providers/provider-auth-test.ts`)
- [x] T013 [S0301] Require selected local runtime readiness in provider setup preflight with explicit loading, missing, error, timeout, and offline states (`src/providers/provider-preflight.ts`)
- [x] T014 [S0301] Parse and recover persisted local readiness records in settings with redaction, duplicate-record handling, and safe defaults (`src/utils/settings.ts`)
- [x] T015 [S0301] Extend reusable provider setup fixtures with safe local runtime profile and readiness records (`test/fixtures/providers/provider-setup-fixtures.ts`)
- [x] T016 [S0301] Record implementation decisions, privacy constraints, recovery fields, and residual risks as code paths stabilize (`.spec_system/specs/phase03-session01-local-runtime-provider-profiles/implementation-notes.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0301] [P] Add local runtime profile and readiness unit tests for ready, offline, timeout, malformed, mismatch, duplicate, and redacted diagnostic paths (`test/local-runtime-provider-profiles.test.ts`)
- [x] T018 [S0301] [P] Add provider setup preflight regression tests for ready and not-ready selected local providers (`test/provider-setup-privacy-preflight.test.ts`)
- [x] T019 [S0301] [P] Add plugin settings parse and recovery tests for local readiness records with secret-like diagnostic rejection (`test/plugin-settings-runtime.test.ts`)
- [x] T020 [S0301] Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate`, then record validation output and ASCII/LF checks (`.spec_system/specs/phase03-session01-local-runtime-provider-profiles/validation.md`)

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
