# Task Checklist

**Session ID**: `phase04-session04-onboarding-provider-readiness-guides`
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

- [x] T001 [S0404] Verify completed Phase 03 and Phase 04 provider, release, install, and packaging prerequisites against the current stub (`.spec_system/PRD/phase_04/session_04_onboarding_provider_readiness_guides.md`)
- [x] T002 [S0404] Audit existing onboarding, provider setup, troubleshooting, settings, and status copy for stale or ambiguous provider readiness language with revalidation on re-entry (`docs/provider-setup.md`)
- [x] T003 [S0404] [P] Create provider readiness guide skeleton with fixture-safe examples and explicit local, custom remote, and cloud boundaries (`docs/provider-readiness-guide.md`)

---

## Foundation (6 tasks)

Core structures and base implementations.

- [x] T004 [S0404] [P] Define provider readiness guidance contracts for path class, gate, blocker, action, fallback, copy, and recovery fields (`src/types/provider-readiness-guidance.ts`)
- [x] T005 [S0404] [P] Create synthetic provider guidance fixtures for local runtime, local-compatible, custom remote, trusted cloud, untrusted cloud, and semantic fallback scenarios (`test/fixtures/providers/provider-readiness-guidance-fixtures.ts`)
- [x] T006 [S0404] Implement provider path classification and gate mapping from existing profile metadata with schema-validated input and explicit error mapping (`src/providers/provider-readiness-guidance.ts`)
- [x] T007 [S0404] Implement readiness summaries, blocker descriptions, and fallback guidance with bounded recovery fields and deterministic ordering (`src/providers/provider-readiness-guidance.ts`)
- [x] T008 [S0404] Implement secret, prompt, hidden-state, and private-path redaction checks for serialized guidance diagnostics (`src/providers/provider-readiness-guidance.ts`)
- [x] T009 [S0404] Export provider readiness guidance helpers and types without widening runtime provider invocation boundaries (`src/providers/index.ts`)

---

## Implementation (9 tasks)

Main feature implementation.

- [x] T010 [S0404] Integrate provider setup readiness guidance into settings copy with explicit loading, empty, error, and offline states (`src/views/settings-tab.ts`)
- [x] T011 [S0404] Integrate provider profile, role selection, and cloud trust descriptions with state reset or revalidation on re-entry (`src/views/settings-tab.ts`)
- [x] T012 [S0404] Render bounded provider readiness details and action labels in the status surface with platform-appropriate accessibility labels, focus management, and input support (`src/components/StatusSurface.svelte`)
- [x] T013 [S0404] Update onboarding with first-run provider readiness order, local-first verification, and no live provider call examples (`docs/onboarding.md`)
- [x] T014 [S0404] Update provider setup guidance for local runtime, OpenAI-compatible local, custom remote, and cloud paths while preserving disclosure gates (`docs/provider-setup.md`)
- [x] T015 [S0404] Update troubleshooting recovery docs for retry, reset, disclosure review, refresh, semantic fallback, and bounded recovery records (`docs/provider-troubleshooting-recovery.md`)
- [x] T016 [S0404] Link the provider readiness guide from the README and summarize the local-first release setup path (`README.md`)
- [x] T017 [S0404] Complete provider readiness guide sections for trust, auth, capability, disclosure, retry, fallback, and synthetic examples (`docs/provider-readiness-guide.md`)
- [x] T018 [S0404] Add agent validation regression coverage for provider readiness docs, fixture safety, and required disclosure language (`test/agent-validation-scripts.test.ts`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T019 [S0404] Write unit tests for provider path classification, gate ordering, readiness summaries, blocker descriptions, and fallback copy (`test/provider-readiness-guidance.test.ts`)
- [x] T020 [S0404] Write unit tests for missing secret, auth failed, timeout, local outage, capability mismatch, cloud disabled, provider not trusted, unsafe state, and redaction failures (`test/provider-readiness-guidance.test.ts`)
- [x] T021 [S0404] Update troubleshooting and UI-facing regression tests for bounded provider readiness copy, duplicate-trigger prevention while in-flight, and lexical fallback language (`test/provider-troubleshooting-recovery-ux.test.ts`)
- [x] T022 [S0404] Run provider guidance tests plus agent-surface, fixture-safety, agent-doc, and full repository validation; record command output in implementation notes (`.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md`)

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
