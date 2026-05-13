# Session Specification

**Session ID**: `phase03-session06-offline-provider-integration-validation`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session validates Phase 03 as one integrated offline and provider hardening workflow. It exercises local runtime provider profiles, OpenAI-compatible profile handling, provider invocation boundaries, offline embedding compatibility, lexical fallback, provider troubleshooting, cloud disclosure denial, cancellation, timeout, retry, and recovery behavior through synthetic tests and fixture-safe records.

The work closes the phase by proving provider behavior remains local-first, provider-aware, recoverable, and redacted across runtime services, docs, command surfaces, and phase tracking. It also synchronizes the closeout artifacts that downstream phase transition commands need: validation output, implementation notes, security posture, PRD records, carryforward considerations, and the implementation summary.

This is an integration and closeout session, not a provider feature expansion. It should strengthen coverage, documentation, and phase state without adding live provider SDK adapters, fetching real URLs, reading private vault content, silently enabling cloud workflows, or mutating user vault files outside existing staged-change review paths.

---

## 2. Objectives

1. Add synthetic integration coverage for the complete Phase 03 provider workflow across local runtime profiles, OpenAI-compatible profiles, invocation boundaries, semantic compatibility, fallback retrieval, and troubleshooting.
2. Verify provider secrecy, fixture safety, cloud disclosure denial, cancellation, timeout, retry, semantic index compatibility, and recovery details.
3. Synchronize docs, command catalog references, agent surfaces, PRD tracking, implementation notes, validation report, security posture, carryforward notes, and summary artifacts.
4. Run local validation commands and record any residual failures with command IDs, provider IDs, target paths, cache paths, report IDs, staged-change IDs, and validation output.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-local-runtime-provider-profiles` - Provides local runtime provider profile, readiness, and no-secret diagnostic contracts.
- [x] `phase03-session02-openai-compatible-provider-profiles` - Provides endpoint classification, credential references, trust, auth readiness, and model capability handling.
- [x] `phase03-session03-provider-transport-invocation-boundaries` - Provides preflight-gated chat and embedding invocation with timeout, cancellation, retry, duplicate guards, and redacted recovery records.
- [x] `phase03-session04-offline-embeddings-index-compatibility` - Provides semantic index compatibility, lexical fallback, reindex guidance, and provider-blocked readiness behavior.
- [x] `phase03-session05-provider-troubleshooting-recovery-ux` - Provides troubleshooting reports, safe recovery fields, settings/status rendering, retry/reset guidance, and provider recovery documentation.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest synthetic provider fixtures under `test/fixtures/providers/`.
- Synthetic vault fixtures under `test/fixtures/vault/`.
- Provider, retrieval, runtime status, command catalog, and validation contracts under `src/`.
- Agent surface validation and fixture safety scripts under `scripts/`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/voidbrain`.
- Validation runs from the repository root with Bun available.
- Tests use only synthetic provider data and fixture vault paths.
- No live provider calls, cloud credentials, network calls, private vault files, raw note bodies, prompt bodies, authorization headers, or hidden provider state are required.

---

## 4. Scope

### In Scope (MVP)
- User can trust the Phase 03 provider workflow as one integrated system - add synthetic integration coverage across local provider setup, OpenAI-compatible setup, invocation preflight, offline embeddings, fallback retrieval, and troubleshooting.
- User can rely on provider secrecy and fixture safety - verify docs, fixtures, reports, logs, and examples omit provider secrets, authorization headers, prompt bodies, raw private note bodies, hidden provider state, and private path hints.
- User can verify cloud/private-vault paths fail closed - assert cloud disclosure remains denied until explicit provider review, trust, auth, capability, and disclosure settings allow it.
- User can recover blocked provider work - verify timeout, cancellation, retry, provider-denied, semantic-incompatible, and troubleshooting paths preserve bounded recovery details.
- Developer can validate phase completion locally - run and document `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate`.
- Agent surfaces remain synchronized - update command docs, AGENTS, CLAUDE, GEMINI, the Voidbrain skill, PRD tracking, security records, and summary artifacts as implementation changes require.

### Out of Scope (Deferred)
- Phase 04 distribution and ecosystem work - *Reason: distribution begins after Phase 03 closeout and phase transition workflows.*
- Provider marketplace publishing - *Reason: marketplace packaging is not part of provider hardening validation.*
- Live provider calls against user credentials or private vault content - *Reason: this session validates with synthetic fixtures only.*
- Automatic cloud fallback when local providers fail - *Reason: cloud disclosure must remain explicit and user-approved.*
- Applying framework updates or user note edits - *Reason: framework updates remain dry-run and note mutations remain staged until approved.*

---

## 5. Technical Approach

### Architecture
Add one focused Phase 03 integration test module that orchestrates existing provider, retrieval, runtime status, and validation services without introducing a new runtime path. Keep provider scenario records in `test/fixtures/providers/`, fixture vault records in existing `test/fixtures/vault/` modules, and service assertions close to the typed contracts under `src/providers/`, `src/vectorstore/`, `src/agent/`, and `src/types/`.

Use existing service boundaries as the source of truth: provider setup and auth stay in `src/providers/`, invocation protection stays in provider invocation and chat/embedding adapters, semantic compatibility stays in `src/vectorstore/`, troubleshooting summary stays in `src/providers/provider-troubleshooting.ts`, and Obsidian lifecycle ownership stays in `src/main.ts`.

Closeout artifacts should be markdown records with validation output, recovery evidence, residual risks, and phase tracking notes. They must remain ASCII-only, fixture-safe, and free of secrets, private vault content, hidden provider state, and live provider outputs.

### Design Patterns
- Contract-first integration: Assert provider decisions, invocation attempts, compatibility codes, troubleshooting actions, recovery records, and validation issues against typed contracts.
- Synthetic fixture orchestration: Combine fake provider and fixture vault records instead of reading user vault content or calling live providers.
- Fail-closed privacy gates: Treat missing disclosure, untrusted cloud providers, missing secrets, unsupported capabilities, and provider-blocked semantic indexes as explicit failures.
- Bounded recovery records: Preserve command IDs, provider IDs, model IDs, cache paths, report IDs, target paths, staged-change IDs, source counts, and validation output only.
- Surface synchronization: Use command catalog and validation scripts as the source of truth before editing agent-facing markdown.

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
| `test/phase03-offline-provider-integration-validation.test.ts` | End-to-end synthetic Phase 03 provider workflow validation | ~280 |
| `test/fixtures/providers/phase03-provider-integration-fixtures.ts` | Shared fake provider, invocation, compatibility, disclosure, troubleshooting, and recovery records | ~220 |
| `docs/phase03-offline-provider-integration-validation.md` | Human-readable validation and recovery evidence for Phase 03 closeout | ~150 |
| `.spec_system/specs/phase03-session06-offline-provider-integration-validation/implementation-notes.md` | Implementation notes for this session | ~120 |
| `.spec_system/specs/phase03-session06-offline-provider-integration-validation/security-compliance.md` | Session security and privacy review | ~110 |
| `.spec_system/specs/phase03-session06-offline-provider-integration-validation/validation.md` | Validation command results and residual failures | ~130 |
| `.spec_system/specs/phase03-session06-offline-provider-integration-validation/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~100 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `test/agent-validation-scripts.test.ts` | Add Phase 03 closeout regression coverage for surface sync and fixture safety | ~50 |
| `docs/agent-surfaces-commands.md` | Synchronize command wording, implemented statuses, recovery details, provider disclosure language, and dry-run language | ~80 |
| `docs/provider-setup.md` | Link closeout evidence and align local, OpenAI-compatible, cloud disclosure, offline fallback, and troubleshooting guidance | ~60 |
| `docs/provider-troubleshooting-recovery.md` | Add closeout validation notes for retry, reset, recovery, disclosure, and semantic fallback behavior | ~60 |
| `README.md` | Link provider hardening and closeout validation documentation | ~20 |
| `AGENTS.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `CLAUDE.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `GEMINI.md` | Synchronize command catalog and safety language if implementation changes require it | ~40 |
| `skills/voidbrain/SKILL.md` | Synchronize skill command table and safety language if implementation changes require it | ~60 |
| `.spec_system/PRD/PRD.md` | Mark Phase 03 session completion state after validation passes | ~20 |
| `.spec_system/PRD/phase_03/PRD_phase_03.md` | Mark session 06 validated and update phase progress after validation passes | ~50 |
| `.spec_system/CONSIDERATIONS.md` | Capture carryforward-worthy provider hardening lessons and residual concerns | ~80 |
| `.spec_system/SECURITY-COMPLIANCE.md` | Record Phase 03 cumulative security and GDPR posture | ~80 |
| `.spec_system/state.json` | Move session from planned to completed during the update workflow, not during implementation | ~20 |

---

## 7. Success Criteria

### Functional Requirements
- [x] Phase 03 workflows pass synthetic integration validation across local provider profiles, OpenAI-compatible provider profiles, invocation boundaries, semantic compatibility, fallback retrieval, and troubleshooting.
- [x] Provider secrets, authorization headers, prompt bodies, raw private note bodies, hidden provider state, private path hints, and credential-like values are absent from docs, fixtures, reports, logs, screenshots, and generated examples.
- [x] Cloud/private-vault provider paths remain blocked until explicit provider review, trust, auth, capability, and disclosure settings allow them.
- [x] Timeout, cancellation, retry, provider-denied, missing-secret, auth-failed, capability-mismatch, provider-blocked semantic compatibility, and lexical fallback paths preserve bounded recovery details.
- [x] Agent surfaces, command docs, PRD records, validation records, and summary artifacts match the implemented Phase 03 behavior.

### Testing Requirements
- [x] Unit and integration tests written and passing.
- [x] Agent surface validation tests written and passing.
- [x] Fixture safety tests written and passing.
- [x] Manual review of docs, phase tracking, validation report, security record, and summary artifacts completed.

### Non-Functional Requirements
- [x] Local-first privacy behavior remains explicit and no provider path silently escalates from local to cloud.
- [x] 100% of automated note mutations remain staged, diffable, or recoverable before apply.
- [x] Build, type check, lint, unit tests, integration tests, and agent docs validation pass before closeout.
- [x] Integration evidence is deterministic under synthetic fixtures and does not depend on live provider availability.

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
- Do not introduce a second provider readiness source of truth; compose existing provider, invocation, index, and troubleshooting contracts.
- Keep all direct note mutations out of the integration workflow; assert staged-change or review-first handoff records when note output is involved.
- Keep closeout updates synchronized across docs, agent surfaces, PRD files, validation report, implementation summary, security notes, considerations, and state.
- Record residual validation failures with enough context for retry instead of hiding or broadening the session.

### Potential Challenges
- Integration test sprawl: Use one focused Phase 03 test module and shared fixtures to avoid duplicating service-level tests.
- Provider state coverage: Exercise representative local, trusted cloud, untrusted cloud, missing-secret, timeout, cancellation, retry, and semantic fallback paths without live providers.
- Surface drift: Use the command catalog and validation scripts as the source of truth before editing markdown surfaces.
- Phase state timing: Complete implementation and validation first; mark session and phase complete only through the later validation and update workflows.

### Relevant Considerations
- [P02] **Workflow drift risk**: This session directly mitigates drift by synchronizing phase tracking, command docs, specs, validation artifacts, and summary records.
- [P02] **Spec script parity**: Preserve local analyzer behavior and record any missing local spec script support in validation or carryforward notes.
- [P01] **Obsidian runtime variance**: Provider settings, status, indexing, and modal behavior should remain resilient under synthetic lifecycle and fixture coverage.
- [P01] **Disclosure gates stay mandatory**: Cloud and remote endpoint paths require explicit trust, auth, capability, and disclosure review before private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records, reports, docs, and generated examples must exclude secrets, prompt bodies, authorization headers, raw private note bodies, and hidden provider state.
- [P01] **Review-first mutations**: Provider-assisted outputs must continue to route through staged review/apply paths with recovery details.
- [P02] **Closeout integration coverage**: Phase-end integration tests are most useful when they exercise provider, recovery, validation, compatibility, fallback, and surface boundaries together.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Integration tests can validate happy paths while missing provider-denied, untrusted cloud, timeout, cancellation, retry, missing-secret, and semantic fallback failures.
- Closeout docs can drift from the command catalog, leaving stale safety instructions in agent surfaces.
- Validation failures can lose recovery context if command IDs, provider IDs, model IDs, target paths, report IDs, staged-change IDs, cache paths, or validation output are omitted.

---

## 9. Testing Strategy

### Unit Tests
- Add focused assertions for fixture safety, surface synchronization, redaction, provider disclosure gates, recovery details, invocation attempts, semantic compatibility, and troubleshooting output.
- Verify safe recovery records include IDs, codes, counts, cache paths, report IDs, staged-change IDs, target paths, and validation output only.

### Integration Tests
- Run a synthetic Phase 03 validation that combines local provider readiness, OpenAI-compatible endpoint classification, cloud trust/disclosure gates, provider invocation preparation, timeout, cancellation, retry, semantic index compatibility, lexical fallback, and troubleshooting reports.
- Verify cloud-disabled, untrusted-cloud, missing-secret, auth-failed, capability-mismatch, provider-blocked, canceled, timed-out, and retried paths fail closed and remain recoverable.
- Verify docs and agent surfaces remain synchronized with the implemented command catalog and required safety language.

### Manual Testing
- Review generated docs, agent surfaces, PRD tracking, implementation notes, security-compliance record, validation report, and final summary for command/status consistency.
- Confirm validation commands were run from the repository root and results were recorded.

### Edge Cases
- No provider profiles exist.
- Provider role points to a deleted provider profile.
- OpenAI-compatible profile has a missing secret, failed auth, timeout, untrusted endpoint, or cloud workflows disabled.
- Local runtime profile is offline, timed out, or missing embedding support.
- Model ID is stale or lacks the required capability.
- Semantic index compatibility is stale, missing, incompatible, canceled, provider-blocked, or offline while lexical retrieval remains available.
- Provider invocation is canceled, timed out, retried, or blocked before adapter execution.
- Closeout fixtures contain secret-like values, authorization headers, prompt bodies, private path hints, or raw note bodies.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/providers/provider-registry.ts`
- `src/providers/local-runtime-readiness.ts`
- `src/providers/openai-compatible-profiles.ts`
- `src/providers/provider-preflight.ts`
- `src/providers/provider-auth-test.ts`
- `src/providers/provider-invocation.ts`
- `src/providers/chat-provider.ts`
- `src/providers/embedding-provider.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/provider-troubleshooting.ts`
- `src/providers/redaction.ts`
- `src/vectorstore/semantic-index-compatibility.ts`
- `src/vectorstore/indexing-runtime-service.ts`
- `src/agent/grounded-vault-chat-service.ts`
- `src/agent/runtime-status.ts`
- `src/agent/command-catalog.ts`
- `src/agent/surface-validation.ts`
- `src/agent/fixture-safety.ts`
- `src/main.ts`
- `test/__mocks__/obsidian.ts`
- Existing fixture modules under `test/fixtures/providers/` and `test/fixtures/vault/`

### Other Sessions
- **Depends on**: `phase03-session01-local-runtime-provider-profiles`, `phase03-session02-openai-compatible-provider-profiles`, `phase03-session03-provider-transport-invocation-boundaries`, `phase03-session04-offline-embeddings-index-compatibility`, `phase03-session05-provider-troubleshooting-recovery-ux`
- **Depended by**: Phase 03 transition workflows (`validate`, `updateprd`, `audit`, `pipeline`, `infra`, `carryforward`, `documents`) and Phase 04 planning.

---

## Next Steps

Run the validate workflow step to verify session completeness, then run
`updateprd` to synchronize `.spec_system/state.json`.
