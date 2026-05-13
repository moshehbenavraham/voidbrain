# Session Specification

**Session ID**: `phase04-session06-distribution-integration-validation`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session validates Phase 04 as one integrated local-first distribution
workflow. It connects the completed release artifact, Obsidian install and
update, agent surface packaging, onboarding, provider readiness, and ecosystem
handoff work through synthetic integration coverage and closeout records.

The work matters because distribution is the point where privacy, packaging,
documentation, and agent reuse can drift. The session should prove that release
artifacts are deterministic, local install and update guidance is vault-safe,
agent packages remain fixture-safe, provider guidance keeps disclosure explicit,
and ecosystem handoff examples stay selected-output only.

This is a validation and closeout session, not a new publishing or provider
feature session. It should strengthen tests, documentation, security review,
phase tracking, and recovery evidence without live cloud calls, public
marketplace publishing, hosted sync, direct framework apply behavior, or
mutation of user vault files outside review-first staged-change workflows.

---

## 2. Objectives

1. Add synthetic integration coverage for the complete Phase 04 distribution
   path across release artifacts, local install/update, agent packaging,
   onboarding, provider readiness, and ecosystem handoff.
2. Verify provider secrecy, fixture safety, cloud disclosure denial,
   staged-mutation boundaries, citation requirements, recovery records, and
   docs sync.
3. Synchronize distribution docs, agent surfaces, PRD records, implementation
   notes, validation report, security posture, carryforward notes, and final
   summary artifacts.
4. Run local validation commands and record any residual failures with command
   IDs, target paths, artifact paths, report IDs, staged-change IDs, and
   validation output.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase04-session01-release-metadata-build-artifacts` - Provides
      deterministic package, manifest, version map, checksum, and release
      artifact validation.
- [x] `phase04-session02-obsidian-install-update-workflow` - Provides local
      install, update, rollback, troubleshooting, dry-run, and vault-safety
      workflow guidance.
- [x] `phase04-session03-agent-skill-surface-packaging` - Provides packageable
      AGENTS, CLAUDE, GEMINI, Voidbrain skill, command docs, and agent package
      validation.
- [x] `phase04-session04-onboarding-provider-readiness-guides` - Provides
      onboarding and provider readiness guidance for local, custom remote,
      trusted cloud, and untrusted cloud paths.
- [x] `phase04-session05-ecosystem-export-handoff-boundaries` - Provides
      selected-output ecosystem handoff boundaries with citations, recovery
      records, and explicit provider review gates.

### Required Tools/Knowledge

- Bun validation scripts from `package.json`.
- Release and install fixtures under `test/fixtures/release/`.
- Provider, vault, package, and handoff fixtures under `test/fixtures/`.
- Agent validation scripts under `scripts/`.
- Distribution docs under `docs/`.
- Agent surfaces: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and
  `skills/voidbrain/SKILL.md`.

### Environment Requirements

- Run commands from the repository root.
- Use only synthetic fixtures under `test/fixtures/` and fake paths such as
  `fixtures/demo-vault/`.
- Do not use real provider credentials, private vault content, hidden provider
  state, prompt bodies, authorization headers, screenshots, or live publishing
  targets.
- Keep all generated files ASCII-only with Unix LF line endings.

---

## 4. Scope

### In Scope (MVP)

- Developer can validate release readiness end to end - add synthetic coverage
  across release metadata, generated artifacts, checksums, install/update
  guidance, agent packages, onboarding docs, provider readiness, and ecosystem
  handoff boundaries.
- User can trust distribution docs remain local-first - verify local runtime
  paths stay local and cloud or custom remote paths require provider review,
  trust, auth, capability, and disclosure gates before private vault content
  can leave the machine.
- Contributor can validate examples safely - fail closed on provider secrets,
  authorization headers, prompt bodies, raw private note bodies, hidden provider
  state, private path hints, unsupported package paths, direct publishing
  claims, and real vault content.
- Agent users can inspect recovery context - preserve command IDs, target
  paths, artifact paths, cache paths, report IDs, staged-change IDs, validation
  output, checksums, and retry guidance where applicable.
- Phase records can close cleanly - synchronize PRD progress, session stub,
  security posture, carryforward notes, validation report, implementation
  notes, and final implementation summary after validation.

### Out of Scope (Deferred)

- Publishing to Obsidian community plugins or public marketplaces - *Reason:
  Phase 04 prepares local release artifacts and guidance only.*
- Direct publishing to Confluence, Notion, Slack, hosted sync, or team
  knowledge-base services - *Reason: ecosystem handoff remains selected-output
  and review-gated.*
- Live cloud provider calls with private vault content - *Reason: validation
  must stay deterministic and fixture-safe.*
- Applying framework updates to user vault files - *Reason: framework update
  behavior remains dry-run until a later apply workflow exists.*
- Adding new user-facing command IDs - *Reason: this session validates and
  closes existing Phase 04 distribution surfaces.*

---

## 5. Technical Approach

### Architecture

Add one focused Phase 04 integration test module that orchestrates existing
release artifact validators, install/update fixtures, agent package checks,
provider readiness examples, ecosystem handoff boundaries, and documentation
validation. Keep scenario data in a shared synthetic fixture module under
`test/fixtures/release/` so the integration test can assert the distribution
story without reading user vault content or calling live services.

Use existing validators and docs as the source of truth. Release metadata
alignment stays in `scripts/validate-release-artifacts.ts`, agent surfaces stay
under `scripts/validate-agent-surfaces.ts` and
`scripts/validate-agent-surface-package.ts`, fixture safety stays under
`scripts/check-fixture-safety.ts`, provider readiness stays in the provider
guides and tests, and handoff boundaries stay in
`src/agent/ecosystem-handoff-boundaries.ts`.

Closeout artifacts should be markdown records with validation output, recovery
evidence, residual risks, phase tracking updates, security posture, and next
workflow handoff. They must stay fixture-safe, ASCII-only, and free of secrets,
private vault content, hidden provider state, raw prompts, and live provider
outputs.

### Design Patterns

- Synthetic closeout orchestration: combine release, install, agent package,
  provider, and handoff fixtures without adding a runtime distribution path.
- Source-of-truth validation: call or mirror existing validation contracts
  instead of inventing separate release rules.
- Fail-closed privacy gates: missing provider review, trust, auth, capability,
  or disclosure blocks cloud and custom remote private-vault examples.
- Review-first mutation boundary: any AI-created note mutation evidence must
  point to staged changes, not direct writes.
- Bounded recovery records: diagnostics use IDs, paths, checksums, counts,
  issue codes, report IDs, staged-change IDs, and validation output only.
- Surface synchronization: docs, agent surfaces, PRD records, and summary files
  are updated together when validation evidence changes.

### Technology Stack

- TypeScript 5.9 and strict contracts for test fixtures and validation helpers.
- Vitest 4 for synthetic integration and regression coverage.
- Bun scripts for build, release artifact validation, agent docs validation,
  fixture safety, linting, and full repository validation.
- Markdown docs for release, install, agent packaging, onboarding, provider
  readiness, ecosystem handoff, security, validation, and PRD records.
- Existing Obsidian API mocks and fixture vault records where needed.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `test/phase04-distribution-integration-validation.test.ts` | End-to-end synthetic Phase 04 distribution workflow validation | ~320 |
| `test/fixtures/release/phase04-distribution-integration-fixtures.ts` | Shared synthetic release, install, package, onboarding, provider, handoff, and recovery records | ~240 |
| `docs/phase04-distribution-integration-validation.md` | Human-readable validation and recovery evidence for Phase 04 closeout | ~180 |
| `.spec_system/specs/phase04-session06-distribution-integration-validation/implementation-notes.md` | Implementation notes for this session | ~140 |
| `.spec_system/specs/phase04-session06-distribution-integration-validation/security-compliance.md` | Session security and privacy review | ~110 |
| `.spec_system/specs/phase04-session06-distribution-integration-validation/validation.md` | Validation command results and residual failures | ~130 |
| `.spec_system/specs/phase04-session06-distribution-integration-validation/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~100 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `test/agent-validation-scripts.test.ts` | Add Phase 04 closeout regression coverage for surface sync, fixture safety, disclosure language, package paths, and out-of-scope claims | ~70 |
| `docs/agent-surfaces-commands.md` | Synchronize command statuses, provider disclosure language, recovery details, dry-run wording, and distribution validation evidence | ~60 |
| `docs/release-artifacts.md` | Link Phase 04 closeout evidence and align checksums, artifact paths, version map, and validation output guidance | ~40 |
| `docs/obsidian-install-update.md` | Link install/update closeout evidence and preserve local install, rollback, dry-run, and no-vault-mutation guidance | ~40 |
| `docs/agent-surface-packaging.md` | Link package validation evidence and fixture-safe reuse guidance | ~40 |
| `docs/onboarding.md` | Link onboarding readiness closeout evidence and local-first first-run guidance | ~30 |
| `docs/provider-readiness-guide.md` | Link provider closeout evidence and explicit custom remote/cloud disclosure gates | ~40 |
| `docs/ecosystem-export-handoff-boundaries.md` | Link selected-output handoff closeout evidence and recovery context requirements | ~40 |
| `README.md` | Link Phase 04 distribution validation from release and safety guidance | ~20 |
| `AGENTS.md` | Synchronize command catalog and safety language if implementation changes require it | ~30 |
| `CLAUDE.md` | Synchronize command catalog and safety language if implementation changes require it | ~30 |
| `GEMINI.md` | Synchronize command catalog and safety language if implementation changes require it | ~30 |
| `skills/voidbrain/SKILL.md` | Synchronize skill command table and safety language if implementation changes require it | ~40 |
| `.spec_system/PRD/PRD.md` | Mark Phase 04 session and phase completion state after validation passes | ~20 |
| `.spec_system/PRD/phase_04/PRD_phase_04.md` | Mark session 06 validated and update phase progress after validation passes | ~50 |
| `.spec_system/PRD/phase_04/session_06_distribution_integration_validation.md` | Mark stub prerequisites and success criteria complete after validation passes | ~30 |
| `.spec_system/CONSIDERATIONS.md` | Capture carryforward-worthy distribution lessons and residual concerns | ~70 |
| `.spec_system/SECURITY-COMPLIANCE.md` | Record Phase 04 cumulative security and GDPR posture | ~70 |
| `.spec_system/state.json` | Move session from planned to completed during the update workflow, not during implementation | ~20 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Phase 04 distribution workflows pass synthetic integration validation
      across release artifacts, install/update guidance, agent packages,
      onboarding, provider readiness, and ecosystem handoff boundaries.
- [ ] Provider secrets, authorization headers, prompt bodies, raw private note
      bodies, hidden provider state, private path hints, real vault content,
      and credential-like values are absent from docs, fixtures, release
      artifacts, logs, screenshots, and generated examples.
- [ ] Cloud and custom remote private-vault paths remain blocked until explicit
      provider review, trust, auth, capability, and disclosure settings allow
      them.
- [ ] AI-proposed vault mutations remain staged, diffable, backed up, or
      recoverable before apply; distribution validation does not directly
      mutate user vault files.
- [ ] Retrieval-grounded examples and selected handoff outputs preserve vault
      paths, headings, source records, citation IDs, staged-change IDs, report
      IDs, artifact paths, checksums, and validation output where applicable.
- [ ] Phase tracking is synchronized across PRD, validation, summary, security,
      carryforward, docs, and agent surfaces.

### Testing Requirements

- [ ] Integration tests cover release metadata, build artifacts, version map,
      checksums, install/update/rollback guidance, agent package validation,
      provider readiness, ecosystem handoff, and recovery records.
- [ ] Tests cover blocked cloud disclosure, unsupported publishing claims,
      full-vault export defaults, missing citations, private path hints,
      secret-like values, prompt bodies, hidden provider state, and raw note
      body failures.
- [ ] Agent validation script tests cover command statuses, implemented
      behavior, fixture-safe examples, packageable instruction surfaces, and
      required safety language.
- [ ] Repository validation commands pass or residual failures are recorded
      with recovery details.

### Non-Functional Requirements

- [ ] Distribution validation is deterministic under synthetic fixtures and
      does not depend on live provider availability, network calls, or private
      vault files.
- [ ] Local-first privacy behavior remains explicit and no workflow silently
      escalates from local runtime to cloud provider.
- [ ] Release and support diagnostics preserve command ID, target path, cache
      path, artifact path, report ID, staged-change ID, validation output,
      issue code, and retry guidance when available.
- [ ] Build, type check, lint, unit tests, integration tests, release artifact
      validation, fixture safety, and agent docs validation pass before
      closeout.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-surface-package` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with
      recovery details

---

## 8. Implementation Notes

### Key Considerations

- Keep validation local and synthetic; do not fetch URLs or call live providers.
- Do not add a second release, package, or provider readiness source of truth.
- Preserve explicit local, custom remote, and cloud disclosure boundaries in
  every distribution artifact.
- Keep direct note mutations out of the distribution workflow; assert staged
  changes or review-first handoff records when note output is involved.
- Update docs, agent surfaces, PRD records, security notes, considerations,
  validation report, and summary artifacts together to avoid tracker drift.

### Potential Challenges

- Integration scope sprawl: Use one focused closeout test and one shared
  fixture module so this session validates the distribution path without
  duplicating service-level tests.
- Surface drift: Run agent-surface and package validation before closeout and
  update only the surfaces that actually need synchronization.
- Privacy regressions in examples: Keep all examples under synthetic fixture
  paths and fail closed on secret-like values, raw note bodies, prompt bodies,
  hidden provider state, and private paths.
- Phase state timing: Plan now, implement next, validate after implementation,
  and mark completion through the later update workflow.

### Relevant Considerations

- [P02] **Workflow drift risk**: This session directly mitigates drift by
  synchronizing phase tracking, command docs, validation artifacts, and summary
  records.
- [P02] **Spec script parity**: Preserve local analyzer behavior and record any
  missing local spec script support in validation or carryforward notes.
- [P01] **Obsidian runtime variance**: Install, update, and onboarding behavior
  should remain resilient across vault sizes, platforms, and Obsidian versions.
- [P01] **Bun validation baseline**: Keep Bun setup and validation command
  guidance explicit for contributors.
- [P01] **Disclosure gates stay mandatory**: Cloud and custom remote paths must
  require provider review, trust, auth, capability, and disclosure preflight
  before private vault content can leave the machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, release records, logs,
  recovery records, exported reports, screenshots, and generated examples must
  exclude secrets, raw private note bodies, prompt bodies, authorization
  headers, and hidden provider state.
- [P01] **Review-first mutations**: Distribution validation must not bypass
  staged review/apply paths for AI-proposed note changes.
- [P01] **Framework-vault separation**: Packages and docs must remain framework
  surfaces, not user vault content.
- [P03] **Bounded recovery metadata**: Closeout diagnostics should use IDs,
  counts, readiness codes, artifact paths, checksums, and validation output
  instead of raw payloads.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- Integration tests can cover happy distribution paths while missing blocked
  cloud disclosure, direct publishing, full-vault export, missing citation, and
  unsafe diagnostic failures.
- Docs and agent surfaces can drift from implemented command IDs, package
  rules, dry-run language, and provider disclosure requirements.
- Validation failures can become hard to retry if command IDs, target paths,
  artifact paths, report IDs, staged-change IDs, cache paths, issue codes, and
  validation output are omitted.

---

## 9. Testing Strategy

### Unit Tests

- Add fixture-level assertions for release metadata, artifact records, install
  plans, agent package manifests, onboarding examples, provider readiness
  states, handoff records, and recovery diagnostics.
- Verify unsafe examples fail for secrets, authorization headers, prompt
  bodies, raw private note bodies, hidden provider state, private path hints,
  real vault content, unsupported package paths, direct publishing claims, and
  full-vault defaults.

### Integration Tests

- Run a synthetic Phase 04 validation that combines release artifact
  validation, install/update safety, agent package validation, onboarding and
  provider readiness checks, ecosystem handoff checks, citation requirements,
  and bounded recovery records.
- Verify local-only paths stay local, cloud/private-vault paths fail closed,
  framework update behavior stays dry-run, and user vault mutations remain
  staged or review-required.
- Verify docs and agent surfaces remain synchronized with the implemented
  command catalog and required safety language.

### Manual Testing

- Review generated docs, agent surfaces, phase records, security-compliance
  record, carryforward considerations, validation report, and final summary for
  command/status consistency.
- Confirm validation commands were run from the repository root and results
  were recorded with residual failure context if needed.

### Edge Cases

- Release metadata drifts across `package.json`, `manifest.json`,
  `versions.json`, docs, and generated artifacts.
- Agent package includes unsupported paths, prompt bodies, hidden provider
  state, `.voidbrain` support records, user vault notes, or private path hints.
- Cloud provider examples omit provider review, trust, auth, capability, or
  disclosure gates.
- Ecosystem handoff attempts full-vault export, direct publishing, hosted sync,
  missing citations, or selected outputs without recovery context.
- Local install/update guidance implies moving or mutating existing vault
  content without review.
- Framework update guidance implies apply behavior instead of preview-only
  dry-run plans.
- Validation command fails and the report lacks command ID, target path,
  artifact path, report ID, staged-change ID, issue code, or retry guidance.

---

## 10. Dependencies

### External Libraries

- No new external libraries expected.

### Internal Dependencies

- `scripts/validate-release-artifacts.ts`
- `scripts/validate-agent-surfaces.ts`
- `scripts/validate-agent-surface-package.ts`
- `scripts/check-fixture-safety.ts`
- `scripts/preview-framework-update.ts`
- `scripts/deploy-obsidian-plugin.ts`
- `src/agent/agent-surface-packaging.ts`
- `src/agent/ecosystem-handoff-boundaries.ts`
- `src/agent/fixture-safety.ts`
- `src/agent/surface-validation.ts`
- `src/agent/command-catalog.ts`
- `src/utils/obsidian-install-workflow.ts`
- `src/types/release.ts`
- `src/types/obsidian-install.ts`
- `src/types/agent-surface-package.ts`
- `src/types/ecosystem-handoff.ts`
- Existing fixture modules under `test/fixtures/release/`,
  `test/fixtures/providers/`, and `test/fixtures/vault/`

### Other Sessions

- **Depends on**: `phase04-session01-release-metadata-build-artifacts`,
  `phase04-session02-obsidian-install-update-workflow`,
  `phase04-session03-agent-skill-surface-packaging`,
  `phase04-session04-onboarding-provider-readiness-guides`,
  `phase04-session05-ecosystem-export-handoff-boundaries`
- **Depended by**: Phase 04 validation, updateprd, audit, pipeline, infra,
  carryforward, documents, and final release-readiness review.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
