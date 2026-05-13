# Task Checklist

**Session ID**: `phase03-session02-openai-compatible-provider-profiles`
**Total Tasks**: 21
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-13

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0302]` = Session reference (03=phase number, 02=session number)
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

- [x] T001 [S0302] Verify Session 01 completion, provider test baseline, and current dirty worktree context (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/implementation-notes.md`)
- [x] T002 [S0302] Record provider disclosure, redaction, credential-reference, and fixture-safety assumptions (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/security-compliance.md`)
- [x] T003 [S0302] Inspect current provider contracts and capture implementation ordering for profile, auth, preflight, settings, and tests (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/implementation-notes.md`)

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T004 [S0302] Define OpenAI-compatible endpoint classification, readiness, and denial contracts (`src/types/provider-setup.ts`)
- [x] T005 [S0302] Add setup-safe OpenAI-compatible metadata fields for endpoint classification and auth/capability evidence (`src/types/providers.ts`)
- [x] T006 [S0302] [P] Create synthetic OpenAI-compatible provider fixtures for local-compatible, custom remote, trusted cloud, untrusted cloud, missing-secret, auth-failed, and capability mismatch states (`test/fixtures/providers/openai-compatible-provider-fixtures.ts`)
- [x] T007 [S0302] Create OpenAI-compatible profile helper service with schema-validated endpoint classification and explicit error mapping (`src/providers/openai-compatible-profiles.ts`)
- [x] T008 [S0302] Export OpenAI-compatible helper contracts from the provider barrel (`src/providers/index.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S0302] Update provider profile parsing for OpenAI-compatible local-compatible, custom remote, trusted cloud, and untrusted cloud profiles with schema-validated input and explicit error mapping (`src/providers/provider-profile-service.ts`)
- [x] T010 [S0302] Update provider auth-test handling for opaque credential references, missing-secret states, auth failures, timeouts, and redacted diagnostics with timeout and failure-path handling (`src/providers/provider-auth-test.ts`)
- [x] T011 [S0302] Enforce OpenAI-compatible cloud enablement, trusted provider IDs, auth readiness, and capability readiness in setup preflight with denied/restricted fallback behavior (`src/providers/provider-preflight.ts`)
- [x] T012 [S0302] Include endpoint classification and stable denial diagnostics in vault disclosure decisions without storing private source paths or prompt bodies (`src/providers/privacy-guard.ts`)
- [x] T013 [S0302] Parse, recover, deduplicate, and redact persisted OpenAI-compatible auth and readiness records with revalidation on load (`src/utils/settings.ts`)
- [x] T014 [S0302] Extend shared provider setup fixtures with reusable synthetic OpenAI-compatible profiles and auth records (`test/fixtures/providers/provider-setup-fixtures.ts`)
- [x] T015 [S0302] Add OpenAI-compatible provider profile tests covering classification, credential references, trust state, redaction, and capability mapping (`test/openai-compatible-provider-profiles.test.ts`)
- [x] T016 [S0302] Add setup preflight regression tests for local-compatible allowed paths, trusted cloud allowed paths, untrusted cloud denial, custom remote denial until trusted, missing-secret, auth-failed, and capability mismatch states (`test/provider-setup-privacy-preflight.test.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T017 [S0302] Add settings parse and recovery tests for OpenAI-compatible provider profiles, auth statuses, trust lists, duplicate records, and redacted diagnostics (`test/plugin-settings-runtime.test.ts`)
- [x] T018 [S0302] Run focused provider tests and record command output with recovery details (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/validation.md`)
- [x] T019 [S0302] Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, and `bun run validate:agent-docs` and record results (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/validation.md`)
- [x] T020 [S0302] Run `bun run validate` and record final validation output or residual failures with command IDs and retry details (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/validation.md`)
- [x] T021 [S0302] Complete implementation summary, security review, ASCII/LF review, and handoff notes (`.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/IMPLEMENTATION_SUMMARY.md`)

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

Run the validate workflow step to verify session completeness.
