# Implementation Notes

**Session ID**: `phase04-session04-onboarding-provider-readiness-guides`
**Started**: 2026-05-13 16:55
**Last Updated**: 2026-05-13 19:23

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 22 / 22 |
| Estimated Remaining | 0 minutes |
| Blockers | 0 |

---

### Task T022 - Run Provider Guidance and Repository Validation

**Started**: 2026-05-13 19:21
**Completed**: 2026-05-13 19:23
**Duration**: 2 minutes

**Notes**:
- Ran focused provider readiness guidance tests.
- Ran agent-surface, fixture-safety, agent-surface-package, agent-doc, ASCII, and full repository validation gates.
- Full validation initially failed on Biome formatting/import ordering in files touched by this session. Applied `bunx biome check --write` to the touched files and reran the full gate successfully.
- A later full validation rerun exposed a timing hole in an existing source-ingestion lifecycle test. Added an explicit wait for the notice that the test asserts, verified `test/plugin-lifecycle.test.ts`, and reran the full gate successfully.

**Files Changed**:
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/spec.md` - Updated status to implemented and ready for validate.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T022 and completion checklist complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded final validation output.
- `test/plugin-lifecycle.test.ts` - Hardened source ingestion notice assertion wait after full-suite timing failure.

**Validation Output**:
- `bun run test -- test/provider-readiness-guidance.test.ts`: passed, 1 test file and 6 tests.
- `bun run validate:agent-surfaces`: passed, 5 surfaces and 7 commands checked.
- `bun run validate:fixture-safety`: passed, 75 files checked.
- `bun run validate:agent-surface-package`: passed, 5 surfaces checked.
- `bun run validate:agent-docs`: passed.
- `LC_ALL=C rg -n "[^[:ascii:]]" ...`: passed with no non-ASCII matches in touched files.
- `bun run test -- test/plugin-lifecycle.test.ts`: passed, 1 test file and 23 tests.
- `bun run validate`: passed after final rerun. Build, release artifact validation, Svelte check, Biome, Vitest, and agent docs all passed; Vitest reported 39 test files and 256 tests.

**BQC Fixes**:
- Contract alignment: full TypeScript/Svelte check and test suite validate the new guidance contracts across provider, status, and UI surfaces.
- Error information boundaries: fixture-safety and focused tests validate docs and diagnostics remain free of provider secrets, private paths, prompt bodies, and hidden provider state.

---

## Final Session Summary

Implemented Phase 04 Session 04 provider readiness onboarding guidance. The
session added a typed provider readiness guidance layer, synthetic fixtures,
settings/status UI integration, provider readiness docs, README links, and
regression coverage for path classification, gate ordering, blockers, actions,
fallback, redaction, fixture safety, and UI duplicate-action behavior.

The implementation is ready for the `validate` workflow step.

---

### Task T021 - Update Troubleshooting and UI-Facing Regression Tests

**Started**: 2026-05-13 18:51
**Completed**: 2026-05-13 19:21
**Duration**: 30 minutes

**Notes**:
- Added provider readiness guidance assertions to troubleshooting recovery tests for bounded lexical fallback output.
- Updated plugin lifecycle duplicate-trigger coverage to assert the settings UI shows the loading state while provider reset is in flight.
- Updated runtime status tests to assert bounded provider readiness recovery details and readiness guidance copy are present.
- Ran `bun run test -- test/provider-troubleshooting-recovery-ux.test.ts test/plugin-lifecycle.test.ts test/runtime-status.test.ts` successfully.

**Files Changed**:
- `test/provider-troubleshooting-recovery-ux.test.ts` - Added bounded provider readiness guidance and lexical fallback assertions.
- `test/plugin-lifecycle.test.ts` - Added duplicate-trigger loading state and provider readiness recovery assertions.
- `test/runtime-status.test.ts` - Added provider readiness payload assertions for runtime status.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T021 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T021 progress.

**BQC Fixes**:
- Duplicate action prevention: UI regression confirms duplicate provider reset remains rejected while an action is in flight.
- Failure path completeness: troubleshooting tests assert lexical fallback guidance remains visible and bounded.

---

### Task T019 - Add Provider Guidance Path and Fallback Unit Tests

**Started**: 2026-05-13 18:34
**Completed**: 2026-05-13 18:45
**Duration**: 11 minutes

**Notes**:
- Added tests for local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud path classification.
- Added deterministic gate ordering, readiness summary, recovery field, action ordering, and lexical fallback assertions.
- Ran `bun test test/provider-readiness-guidance.test.ts` successfully.

**Files Changed**:
- `test/provider-readiness-guidance.test.ts` - Added provider path, gate, summary, recovery, action, and fallback tests.
- `src/providers/provider-readiness-guidance.ts` - Adjusted remote locality gate and action deduplication based on test feedback.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T019 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T019 progress.

**BQC Fixes**:
- Contract alignment: test feedback changed remote locality from warning to ready when disclosure gates pass, while untrusted cloud remains blocked.

---

### Task T020 - Add Provider Guidance Failure and Redaction Tests

**Started**: 2026-05-13 18:45
**Completed**: 2026-05-13 18:51
**Duration**: 6 minutes

**Notes**:
- Added tests for missing secret, auth failed, auth timeout, local outage, capability mismatch, cloud disabled, provider not trusted, untrusted cloud, unsafe provider state, recovery redaction, and diagnostic safety failures.
- Verified credential-like values and private absolute paths are redacted from recovery validation output.
- Ran `bun test test/provider-readiness-guidance.test.ts` successfully.

**Files Changed**:
- `test/provider-readiness-guidance.test.ts` - Added failure, blocker, action, redaction, and safety tests.
- `src/providers/provider-readiness-guidance.ts` - Mapped capability readiness-not-ready blockers back to auth-not-ready for clearer actions.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T020 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T020 progress.

**BQC Fixes**:
- Error information boundaries: tests assert serialized recovery records omit credential probes and private path probes.
- Failure path completeness: blocker tests assert user-visible next actions for each failure class.

---

### Task T018 - Add Agent Validation Regression Coverage

**Started**: 2026-05-13 18:30
**Completed**: 2026-05-13 18:34
**Duration**: 4 minutes

**Notes**:
- Added fixture-safety regression coverage for README, onboarding, provider readiness, setup, and troubleshooting docs.
- Asserted required disclosure language, untrusted cloud blocking, no silent cloud fallback, and synthetic fixture path language remain present.

**Files Changed**:
- `test/agent-validation-scripts.test.ts` - Added provider readiness docs fixture-safety and disclosure language regression test.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T018 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T018 progress.

**BQC Fixes**:
- Trust boundary enforcement: docs regression coverage now fails when required disclosure and untrusted-cloud blocking language is removed.

---

### Task T017 - Complete Provider Readiness Guide

**Started**: 2026-05-13 18:23
**Completed**: 2026-05-13 18:30
**Duration**: 7 minutes

**Notes**:
- Completed path details for local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud providers.
- Added deterministic gate order, troubleshooting actions, fallback behavior, fixture-safe remote examples, and bounded recovery record examples.
- Reiterated that lexical fallback is local retrieval fallback, not silent cloud fallback.

**Files Changed**:
- `docs/provider-readiness-guide.md` - Expanded trust, auth, capability, disclosure, retry, fallback, and synthetic example sections.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T017 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T017 progress.

---

### Task T016 - Link Provider Readiness Guide From README

**Started**: 2026-05-13 18:21
**Completed**: 2026-05-13 18:23
**Duration**: 2 minutes

**Notes**:
- Added a README summary of the local-first provider setup path.
- Linked the provider readiness guide from project docs.
- Reiterated that custom remote and trusted cloud paths require provider review, trust, auth, capability, and disclosure gates.

**Files Changed**:
- `README.md` - Added provider readiness guide link and local-first setup summary.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T016 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T016 progress.

---

### Task T015 - Update Troubleshooting Recovery Docs

**Started**: 2026-05-13 18:16
**Completed**: 2026-05-13 18:21
**Duration**: 5 minutes

**Notes**:
- Aligned troubleshooting docs with the provider readiness path order.
- Added revalidation language for retry, reset, disclosure review, refresh, and retest actions.
- Split OpenAI-compatible local recovery from custom remote and cloud recovery, preserving disclosure gates.
- Clarified lexical fallback as local retrieval fallback, not cloud provider substitution.

**Files Changed**:
- `docs/provider-troubleshooting-recovery.md` - Updated recovery, fallback, and remote/cloud guidance.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T015 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T015 progress.

---

### Task T014 - Update Provider Setup Path Guidance

**Started**: 2026-05-13 18:11
**Completed**: 2026-05-13 18:16
**Duration**: 5 minutes

**Notes**:
- Linked the provider readiness guide from provider setup docs.
- Replaced the older local vs OpenAI-compatible wording with explicit local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud path classes.
- Preserved provider review, trust, auth, capability, and disclosure gates for custom remote and cloud paths.

**Files Changed**:
- `docs/provider-setup.md` - Updated provider path class and disclosure gate guidance.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T014 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T014 progress.

---

### Task T013 - Update Onboarding Provider Readiness Order

**Started**: 2026-05-13 18:07
**Completed**: 2026-05-13 18:11
**Duration**: 4 minutes

**Notes**:
- Added the provider readiness guide to the first-read docs list.
- Added first-run provider readiness order, local-first verification, semantic indexing prerequisites, and cloud disclosure boundaries.
- Clarified that onboarding examples use fake fixture paths and no live provider calls.

**Files Changed**:
- `docs/onboarding.md` - Added provider readiness order and local-first verification guidance.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T013 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T013 progress.

---

### Task T010 - Integrate Provider Setup Readiness Guidance Into Settings Copy

**Started**: 2026-05-13 17:44
**Completed**: 2026-05-13 17:53
**Duration**: 9 minutes

**Notes**:
- Settings provider setup readiness now uses `buildProviderReadinessGuidance` instead of ad hoc setup summary text.
- Provider troubleshooting copy now exposes loading, empty, offline, warning, error, and ready states through the shared guidance severity.
- Lexical fallback language is visible in provider troubleshooting copy when semantic readiness is blocked.

**Files Changed**:
- `src/views/settings-tab.ts` - Wired provider readiness guidance into setup and troubleshooting settings copy.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T010 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T010 progress.

**BQC Fixes**:
- State freshness on re-entry: settings recompute provider guidance from current settings and runtime semantic compatibility every display render.

---

### Task T011 - Integrate Profile, Role, and Cloud Trust Descriptions

**Started**: 2026-05-13 17:53
**Completed**: 2026-05-13 18:00
**Duration**: 7 minutes

**Notes**:
- Persisted provider profile rows now show path-class guidance and revalidation language after save, test, reset, or refresh.
- Role selectors now include selected provider path readiness summaries.
- Cloud trust rows now reuse trust and disclosure gate descriptions from the guidance layer.

**Files Changed**:
- `src/views/settings-tab.ts` - Added provider readiness guidance to profile summaries, role descriptions, and cloud trust descriptions.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T011 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T011 progress.

**BQC Fixes**:
- Duplicate action prevention: existing in-flight provider action guards remain in place while guidance copy is recomputed.
- Trust boundary enforcement: cloud trust copy now reflects trust and disclosure gate state from the shared presenter.

---

### Task T012 - Render Provider Readiness Details in Status Surface

**Started**: 2026-05-13 18:00
**Completed**: 2026-05-13 18:07
**Duration**: 7 minutes

**Notes**:
- Runtime provider status items now include bounded provider readiness guidance alongside troubleshooting reports.
- Status surface renders provider readiness severity, disclosure requirement, command ID, path summaries, fallback mode, and action labels with ARIA labels.
- Added CSS coverage for provider readiness summary rows and path lists.
- Verified with `bun run check`.

**Files Changed**:
- `src/agent/runtime-status.ts` - Added provider readiness guidance to provider runtime status details.
- `src/types/runtime.ts` - Added optional provider readiness field to runtime status items.
- `src/components/StatusSurface.svelte` - Rendered bounded provider readiness details and action labels.
- `src/styles.css` - Reused status styling for provider readiness rows and paths.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T012 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T012 progress.

**BQC Fixes**:
- Accessibility and platform compliance: provider readiness and action lists use explicit ARIA labels; the existing refresh button retains its accessible label.
- Error information boundaries: status rendering uses bounded guidance fields only.

---

### Task T009 - Export Provider Readiness Guidance Helpers and Types

**Started**: 2026-05-13 17:43
**Completed**: 2026-05-13 17:44
**Duration**: 1 minute

**Notes**:
- Exported the typed guidance contracts and pure provider readiness helpers through the existing provider barrel.
- Did not add new provider transport or invocation exports; runtime provider call boundaries remain unchanged.

**Files Changed**:
- `src/providers/index.ts` - Exported provider readiness guidance types and helpers.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T009 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T009 progress.

**BQC Fixes**:
- Contract alignment: exports expose presenter output only and avoid widening provider invocation APIs.

---

### Task T006 - Implement Provider Path Classification and Gate Mapping

**Started**: 2026-05-13 17:18
**Completed**: 2026-05-13 17:32
**Duration**: 14 minutes

**Notes**:
- Added schema-style provider input parsing with explicit validation errors for invalid kind, trust, models, and unsafe provider state.
- Added deterministic path classification for local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud providers from existing setup metadata.
- Added provider review, locality, trust, auth, capability, disclosure, and semantic fallback gate mapping.

**Files Changed**:
- `src/providers/provider-readiness-guidance.ts` - Added provider validation, path classification, and readiness gate mapping.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T006 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T006 progress.

**BQC Fixes**:
- Trust boundary enforcement: remote and cloud path gates fail closed until provider review, trust, auth, capability, and disclosure are explicit.
- Contract alignment: `bun run check` passed after the guidance contracts were wired.

---

### Task T007 - Implement Summaries, Blockers, Fallback Guidance, and Recovery

**Started**: 2026-05-13 17:32
**Completed**: 2026-05-13 17:38
**Duration**: 6 minutes

**Notes**:
- Added path and global readiness copy, deterministic blocker/action ordering, lexical fallback summaries, and aggregate severity.
- Kept active guidance limited to configured, selected, or auth-tested providers so unselected baseline providers do not create false cloud blockers.
- Added bounded recovery fields for command ID, provider ID, model ID, readiness code, cache path, report ID, source path count, fallback mode, and validation output.

**Files Changed**:
- `src/providers/provider-readiness-guidance.ts` - Added summaries, blockers, actions, fallback, and recovery builders.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T007 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T007 progress.

**BQC Fixes**:
- Failure path completeness: readiness blockers carry user-visible actions and recovery metadata instead of silent failed states.

---

### Task T008 - Implement Serialized Guidance Diagnostic Safety Checks

**Started**: 2026-05-13 17:38
**Completed**: 2026-05-13 17:43
**Duration**: 5 minutes

**Notes**:
- Added diagnostic safety validation for unsafe keys, credential-like values, private absolute paths, prompt body hints, and hidden provider state hints.
- Sanitized validation output before it enters guidance recovery records.
- Verified the new guidance module with `bun run check`.

**Files Changed**:
- `src/providers/provider-readiness-guidance.ts` - Added safety validation and validation-output redaction helpers.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T008 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T008 progress.

**BQC Fixes**:
- Error information boundaries: guidance diagnostics reject or redact secrets, prompt bodies, hidden state, and private path hints before UI/status exposure.

---

### Task T005 - Create Provider Readiness Fixtures

**Started**: 2026-05-13 17:08
**Completed**: 2026-05-13 17:18
**Duration**: 10 minutes

**Notes**:
- Added synthetic readiness scenarios for local runtime, OpenAI-compatible local, custom remote, trusted cloud, untrusted cloud, and semantic lexical fallback.
- Added failure scenarios for missing secret, auth failure, auth timeout, local outage, capability mismatch, cloud disabled, provider not trusted, and unsafe provider state.
- Reused existing synthetic provider fixtures and fake `.voidbrain` cache paths without adding live provider calls or real credentials.

**Files Changed**:
- `test/fixtures/providers/provider-readiness-guidance-fixtures.ts` - Added provider readiness scenario builders.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T005 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T005 progress.

**BQC Fixes**:
- Trust boundary enforcement: fixtures use synthetic providers and fake paths only, keeping test examples outside user vault content.

---

### Task T004 - Define Provider Readiness Guidance Contracts

**Started**: 2026-05-13 17:01
**Completed**: 2026-05-13 17:08
**Duration**: 7 minutes

**Notes**:
- Added typed path classes for local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud providers.
- Added gate, blocker, action, fallback, copy, recovery, input, provider validation, and serialized diagnostic safety contracts.
- Kept recovery fields bounded to IDs, readiness codes, cache/report fields, source counts, fallback mode, and validation output.

**Files Changed**:
- `src/types/provider-readiness-guidance.ts` - Added provider readiness guidance contracts and fallback helpers.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T004 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T004 progress.

**BQC Fixes**:
- Contract alignment: modeled gate, action, fallback, and recovery fields explicitly so UI and docs tests can assert bounded guidance shape.

---

### Task T003 - Create Provider Readiness Guide Skeleton

**Started**: 2026-05-13 16:59
**Completed**: 2026-05-13 17:01
**Duration**: 2 minutes

**Notes**:
- Added a new first-run provider readiness guide with local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud path classes.
- Used fixture-safe provider IDs and fake vault/cache paths only.
- Kept remote and cloud provider paths gated behind provider review, trust, auth, capability, and disclosure.

**Files Changed**:
- `docs/provider-readiness-guide.md` - Added initial guide skeleton and safe example.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T003 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded T003 progress.

---

### Task T002 - Audit Provider Readiness Copy

**Started**: 2026-05-13 16:56
**Completed**: 2026-05-13 16:59
**Duration**: 3 minutes

**Notes**:
- Audited `docs/onboarding.md`, `docs/provider-setup.md`, `docs/provider-troubleshooting-recovery.md`, `src/views/settings-tab.ts`, `src/components/StatusSurface.svelte`, and runtime provider status composition.
- Found provider path taxonomy split between docs and inline UI strings; local runtime, OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud language needs one typed source.
- Found settings copy already resets auth/model state on profile edits and blocks duplicate provider troubleshooting actions, but it does not explain revalidation on re-entry in centralized guidance.
- Found status copy exposes bounded troubleshooting report details but does not render path-class gates or lexical fallback guidance from a reusable presenter.

**Files Changed**:
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T002 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded audit findings.

---

### Task T001 - Verify Phase 03 and Phase 04 Prerequisites

**Started**: 2026-05-13 16:55
**Completed**: 2026-05-13 16:56
**Duration**: 1 minute

**Notes**:
- Confirmed Phase 03 provider profile, invocation, semantic fallback, troubleshooting, and closeout sessions are listed as complete in `.spec_system/state.json`.
- Confirmed Phase 04 release metadata, install/update, and agent surface packaging sessions are complete before this session.
- Updated the current Phase 04 session stub prerequisite checklist to reflect verified prerequisites.

**Files Changed**:
- `.spec_system/PRD/phase_04/session_04_onboarding_provider_readiness_guides.md` - Marked prerequisite checklist complete and moved stub status to in progress.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/tasks.md` - Marked T001 complete.
- `.spec_system/specs/phase04-session04-onboarding-provider-readiness-guides/implementation-notes.md` - Recorded session start, environment verification, and T001 progress.

---

## Task Log

### 2026-05-13 - Session Start

**Environment verified**:
- [x] Deterministic project state resolved current session.
- [x] Prerequisites confirmed with bundled `check-prereqs.sh`.
- [x] Directory structure ready.
- [x] Repository is not configured as a monorepo.

## Blockers & Solutions

### Blocker 1: Missing Local Prerequisite Script

**Description**: `.spec_system/scripts/` exists but does not contain `check-prereqs.sh`, so the local-first prereq command failed with `No such file or directory`.
**Impact**: Environment verification before implementation.
**Resolution**: Used the bundled apex-spec prerequisite checker at `/home/aiwithapex/.codex/skills/apex-spec/scripts/check-prereqs.sh`, which passed for `.spec_system`, `jq`, and `git`.
**Time Lost**: 2 minutes

---
