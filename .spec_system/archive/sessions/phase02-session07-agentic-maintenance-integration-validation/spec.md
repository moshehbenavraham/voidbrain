# Session Specification

**Session ID**: `phase02-session07-agentic-maintenance-integration-validation`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session validates Phase 02 as one integrated agentic maintenance system. It exercises recovery, agent surface validation, framework update preview, maintenance recommendations, similar-note and placement suggestions, and batch source ingestion together with synthetic vault data and fixture-safe records.

The work closes the phase by proving the local-first, review-first, provider-aware behavior remains consistent across commands. It also synchronizes docs, agent surfaces, phase tracking, validation output, and residual risk records so the next workflow step can make a clean phase completion decision.

This is an integration and closeout session, not a new feature session. It should strengthen coverage, documentation, and recovery evidence without applying framework updates, adding Phase 03 provider hardening, or mutating user vault files outside staged-change workflows.

---

## 2. Objectives

1. Add synthetic integration coverage that runs the Phase 02 maintenance workflows through their shared safety boundaries.
2. Verify provider secrecy, fixture safety, staged-change behavior, dry-run framework update behavior, citations, and recovery details.
3. Synchronize command docs, agent surfaces, PRD tracking, implementation notes, validation report, and summary artifacts for Phase 02 closeout.
4. Run local validation commands and record any residual failures with command IDs, target paths, staged-change IDs, report IDs, cache paths, and validation output.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session01-recover-session-command` - Provides read-only recovery diagnostics over hot cache, logs, reports, staged changes, and validation output.
- [x] `phase02-session02-agent-surface-validation-hardening` - Provides fail-closed validation for command surfaces, safety phrases, stale references, fixtures, private paths, and secret-like examples.
- [x] `phase02-session03-framework-update-preview-planner` - Provides dry-run framework update planning with exclusions, conflicts, hashes, issues, and recovery details.
- [x] `phase02-session04-maintenance-recommendation-planner` - Provides citation-backed maintenance recommendation planning and staged-change handoff metadata.
- [x] `phase02-session05-similar-note-placement-suggestions` - Provides related-note, wikilink, tag, folder, and frontmatter placement suggestions through staged review.
- [x] `phase02-session06-batch-source-ingestion-queue` - Provides bounded source ingestion queue behavior with provider review, cancellation, retry, citations, staged output, and recovery records.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest synthetic fixture patterns under `test/fixtures/vault/`.
- Agent command catalog and surface validation contracts in `src/agent/command-catalog.ts`.
- Obsidian plugin lifecycle and service wiring in `src/main.ts`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/voidbrain`.
- Validation runs from the repository root with Bun available.
- Tests use only `test/fixtures/vault/` or clearly fake fixture paths.
- No cloud provider calls and no live URL fetches are required for this session.

---

## 4. Scope

### In Scope (MVP)
- User can trust Phase 02 maintenance commands as one integrated system - add synthetic integration coverage over recovery, validation, preview, recommendation, suggestions, and batch ingestion.
- User can inspect provider and privacy behavior before any disclosure - verify provider-denied and local-only paths fail closed without exposing secrets or raw vault content.
- User can review AI-created maintenance outputs before note mutation - verify recommendation, suggestion, and ingestion outputs route through staged changes.
- User can rely on preview-only framework updates - verify framework update planning remains dry-run and excludes user vault content.
- Developer can validate phase completion locally - run and document `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate`.
- Agent surfaces remain synchronized - update command docs, AGENTS, CLAUDE, GEMINI, the Voidbrain skill, PRD tracking, and summary artifacts as implementation changes require.

### Out of Scope (Deferred)
- Phase 03 provider hardening - *Reason: Phase 03 is a separate unfinished phase focused on offline and provider hardening.*
- Distribution packaging or marketplace release - *Reason: distribution belongs to a later release phase.*
- Applying framework updates - *Reason: Phase 02 framework update behavior is preview-only.*
- Direct user vault mutation - *Reason: all AI-proposed note edits must remain staged until explicit approval.*

---

## 5. Technical Approach

### Architecture
Add one focused integration test module that orchestrates existing Phase 02 services and fixtures without introducing a new runtime path. Keep service-level assertions close to the domain contracts under `src/agent/`, provider redaction helpers under `src/providers/`, and synthetic fixtures under `test/fixtures/vault/`.

Use the existing command catalog as the command-surface source of truth, and keep markdown surfaces synchronized with implemented behavior. Closeout artifacts should be markdown records with validation output, recovery evidence, residual risks, and phase tracking notes.

### Design Patterns
- Contract-first validation: Assert command IDs, statuses, write policies, recovery records, citation fields, and staged-change IDs against typed contracts.
- Synthetic fixture orchestration: Combine existing fake vault fixtures instead of reading user vault content or live URLs.
- Fail-closed safety checks: Treat missing citations, unsafe paths, secret-like values, and provider disclosure gaps as validation failures.
- Review-first mutation flow: Verify generated note changes become staged records rather than direct vault writes.
- Dry-run planner boundary: Verify framework update planning reports intended operations without applying them.

### Technology Stack
- TypeScript 5.9 and strict service contracts.
- Vitest 4 for integration and regression coverage.
- Bun scripts for repository validation.
- Obsidian API mocks from `test/__mocks__/obsidian.ts`.
- Existing Voidbrain services under `src/agent/`, `src/providers/`, `src/vectorstore/`, `src/stores/`, `src/views/`, `src/components/`, `src/utils/`, and `src/types/`.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `test/phase02-agentic-maintenance-integration.test.ts` | End-to-end synthetic Phase 02 workflow validation | ~220 |
| `test/fixtures/vault/phase02-integration-fixtures.ts` | Shared fake records for recovery, reports, preview plans, suggestions, queue items, and staged changes | ~160 |
| `docs/phase02-agentic-maintenance-integration-validation.md` | Human-readable validation and recovery evidence for the phase closeout | ~140 |
| `.spec_system/specs/phase02-session07-agentic-maintenance-integration-validation/implementation-notes.md` | Implementation notes for this session | ~120 |
| `.spec_system/specs/phase02-session07-agentic-maintenance-integration-validation/security-compliance.md` | Session security and privacy review | ~100 |
| `.spec_system/specs/phase02-session07-agentic-maintenance-integration-validation/validation.md` | Validation command results and residual failures | ~120 |
| `.spec_system/specs/phase02-session07-agentic-maintenance-integration-validation/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~100 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `test/agent-validation-scripts.test.ts` | Add regression coverage for Phase 02 closeout surface sync and fixture safety | ~50 |
| `docs/agent-surfaces-commands.md` | Synchronize command catalog wording, statuses, recovery details, and dry-run language | ~80 |
| `AGENTS.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `CLAUDE.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `GEMINI.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `skills/voidbrain/SKILL.md` | Synchronize skill command table and safety language if implementation changes require it | ~60 |
| `.spec_system/PRD/PRD.md` | Mark Phase 02 session completion state after validation passes | ~20 |
| `.spec_system/PRD/phase_02/PRD_phase_02.md` | Mark session 07 validated and update phase progress after validation passes | ~50 |
| `.spec_system/CONSIDERATIONS.md` | Capture carryforward-worthy lessons and residual concerns | ~80 |
| `.spec_system/SECURITY-COMPLIANCE.md` | Record Phase 02 cumulative security and GDPR posture | ~80 |
| `.spec_system/state.json` | Move session from planned to completed during update workflow, not during implementation | ~20 |

---

## 7. Success Criteria

### Functional Requirements
- [x] Phase 02 workflows pass synthetic integration validation across recovery, agent surface validation, framework preview, maintenance recommendations, similar-note suggestions, and batch ingestion.
- [x] Provider secrets, raw private note bodies, authorization headers, hidden provider state, private path hints, and credential-like values are rejected or redacted in fixtures, reports, logs, and docs.
- [x] Maintenance recommendations, similar-note suggestions, and batch ingestion outputs produce staged-change handoff evidence instead of direct note mutation.
- [x] Framework update preview remains dry-run and records create, update, skip, conflict, excluded, hash, issue, and recovery details without applying changes.
- [x] Agent surfaces and command statuses match the implemented command catalog.
- [x] Validation reports include command IDs, target paths, cache paths, staged-change IDs, report IDs, and validation output needed for retry or discard.

### Testing Requirements
- [x] Unit and integration tests written and passing.
- [x] Agent surface validation tests written and passing.
- [x] Fixture safety tests written and passing.
- [x] Manual review of docs and phase tracking completed.

### Non-Functional Requirements
- [x] Local-first privacy behavior remains explicit and no vault content leaves the machine during validation.
- [x] 100% of automated note mutations remain staged, diffable, or recoverable before apply.
- [x] Build, type check, lint, unit tests, integration tests, and agent docs validation pass before closeout.

### Quality Gates
- [x] All files ASCII-encoded.
- [x] Unix LF line endings.
- [x] Code follows project conventions.
- [x] `bun run validate:agent-surfaces` passes.
- [x] `bun run validate:fixture-safety` passes.
- [x] `bun run validate:agent-docs` passes.
- [x] `bun run validate` passes or residual failures are recorded with recovery details.

---

## 8. Implementation Notes

### Key Considerations
- Keep validation local and synthetic; do not fetch URLs or call live providers.
- Do not update source behavior unless tests reveal a real integration gap.
- Keep all direct note mutations out of the integration workflow; assert staged-change handoff records instead.
- Keep closeout updates synchronized across docs, agent surfaces, PRD files, validation report, implementation summary, and state.

### Potential Challenges
- Integration test sprawl: Use one focused Phase 02 test module and shared fixtures to avoid duplicating service-level tests.
- Surface drift: Use the command catalog and validation scripts as the source of truth before editing markdown surfaces.
- Residual validation failure: Preserve failing command output, affected path, and retry context in `validation.md` instead of hiding the failure.
- Phase state timing: Complete implementation and validation first; mark session and phase complete only through the later validation and update workflows.

### Relevant Considerations
- [P01] **Workflow drift risk**: This session directly mitigates drift by synchronizing phase tracking, docs, command surfaces, and validation records.
- [P01] **Obsidian runtime variance**: Integration coverage should use plugin lifecycle mocks and fixture vaults to cover runtime boundaries without relying on a live vault.
- [P01] **Disclosure gates stay mandatory**: Provider-dependent maintenance and ingestion paths must keep trust, auth, capability, and disclosure preflight.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records, reports, and docs must exclude secrets, raw private note bodies, and hidden provider state.
- [P01] **Review-first mutations**: All maintenance suggestions and generated notes must route through staged review/apply paths with recovery details.
- [P01] **Framework-vault separation**: Framework update previews must exclude user vault content and remain inspectable dry runs.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Integration tests can accidentally validate happy paths while missing provider-denied, citation-blocked, and dry-run failure paths.
- Closeout docs can drift from the command catalog, leaving stale instructions in agent surfaces.
- Validation failures can lose recovery context if command IDs, target paths, report IDs, staged-change IDs, cache paths, or validation output are omitted.

---

## 9. Testing Strategy

### Unit Tests
- Add focused assertions for fixture safety, surface synchronization, redaction, recovery details, staged-change handoff, and dry-run preview output.

### Integration Tests
- Run a synthetic Phase 02 maintenance validation that combines recovery records, agent surface validation, framework update preview, recommendation planning, similar-note suggestions, and batch ingestion queue results.
- Verify provider-denied and citation-blocked paths fail closed and remain retryable without staging unsafe output.
- Verify preview-only update plans include excluded user vault paths and do not apply filesystem changes.

### Manual Testing
- Review generated docs, agent surfaces, PRD tracking, implementation notes, security-compliance record, validation report, and final summary for command/status consistency.
- Confirm validation commands were run from the repository root and results were recorded.

### Edge Cases
- Missing or malformed support records.
- Secret-like values in fixture files or docs.
- Private path hints outside fixture-safe locations.
- Framework update plans that encounter conflicts or excluded vault content.
- Batch ingestion items with provider denied, citation blocked, canceled, retried, and staged statuses.
- Staged-change records with target path, validation output, and recovery details but no raw private note body.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/agent/recover-session-service.ts`
- `src/agent/surface-validation.ts`
- `src/agent/framework-update-preview.ts`
- `src/agent/maintenance-recommendation-planner.ts`
- `src/agent/similar-note-suggestion-service.ts`
- `src/agent/source-ingestion-queue-service.ts`
- `src/agent/staged-change-service.ts`
- `src/providers/redaction.ts`
- `src/main.ts`
- `test/__mocks__/obsidian.ts`
- Existing fixture modules under `test/fixtures/vault/`

### Other Sessions
- **Depends on**: `phase02-session01-recover-session-command`, `phase02-session02-agent-surface-validation-hardening`, `phase02-session03-framework-update-preview-planner`, `phase02-session04-maintenance-recommendation-planner`, `phase02-session05-similar-note-placement-suggestions`, `phase02-session06-batch-source-ingestion-queue`
- **Depended by**: Phase 02 transition workflows (`validate`, `updateprd`, `audit`, `pipeline`, `infra`, `carryforward`, `documents`) and Phase 03 planning.

---

## Next Steps

Run the validate workflow step to verify session completeness, then run the update PRD workflow step to update `.spec_system/state.json`.
