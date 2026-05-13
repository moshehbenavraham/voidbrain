# Session Specification

**Session ID**: `phase04-session05-ecosystem-export-handoff-boundaries`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session defines the safe boundary for exporting or handing off selected
Voidbrain markdown outputs. Phase 04 already has deterministic release
artifacts, local install and update guidance, agent surface packaging, and
provider readiness docs. This work closes the remaining ecosystem gap by
making clear what users may copy, version, export, or hand off without implying
hosted publishing, external sync, or silent cloud disclosure.

The work must preserve the vault as user-owned data and the durable source of
truth. Export and handoff guidance should only cover explicitly selected
outputs such as markdown reports, staged-change summaries, source records, and
release evidence. When an output is grounded in retrieval or source ingestion,
the exported summary must keep enough citation, heading, source record,
staged-change ID, report ID, artifact path, and validation output context for
inspection and retry.

The implementation should add a small typed boundary layer and fixture-backed
validation so docs, examples, and release surfaces cannot drift into unsafe
publishing language. Direct publishing to Confluence, Notion, Slack, hosted
sync, team knowledge bases, or cloud providers remains out of MVP scope unless
a future workflow adds explicit provider review, trust, auth, capability, and
disclosure gates.

---

## 2. Objectives

1. Define typed contracts for selected markdown export and external handoff
   boundaries, evidence, disclosure state, and recovery records.
2. Implement deterministic validation for fixture-safe handoff examples,
   citation traceability, provider review language, and redacted diagnostics.
3. Document Git, filesystem, copy, and markdown-based handoff workflows using
   synthetic paths and explicit user selection only.
4. Add tests and docs checks that fail closed on full-vault export defaults,
   direct publishing claims, private path hints, provider secrets, prompt
   bodies, hidden provider state, and missing citations.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session04-grounded-vault-chat` - Retrieval-grounded answers
      preserve vault paths, headings, and source records as citations.
- [x] `phase01-session05-source-ingestion-staging` - Approved sources can be
      converted into staged, citation-backed source, entity, concept, and
      summary artifacts.
- [x] `phase01-session06-staged-change-review-apply` - AI-proposed note
      mutations are reviewed, applied, rejected, retried, or dismissed through
      staged changes.
- [x] `phase01-session07-vault-health-repair-staging` - Health reports can be
      exported with redacted findings and safe repairs staged for review.
- [x] `phase02-session01-recover-session-command` - Recovery summaries can
      expose command IDs, report IDs, staged-change IDs, validation output, and
      retry guidance without raw private payloads.
- [x] `phase03-session06-offline-provider-integration-validation` - Provider
      closeout evidence validates disclosure gates, redaction, fixture safety,
      semantic fallback, and recovery records.
- [x] `phase04-session01-release-metadata-build-artifacts` - Release artifact
      diagnostics expose repository paths, checksums, and validation output
      without user vault content.
- [x] `phase04-session02-obsidian-install-update-workflow` - Local install,
      update, rollback, dry-run, and troubleshooting docs are vault-safe.
- [x] `phase04-session03-agent-skill-surface-packaging` - Agent surface
      packages are validated as local framework surfaces with fixture-safe
      reuse guidance.
- [x] `phase04-session04-onboarding-provider-readiness-guides` - Provider
      readiness docs distinguish local, custom remote, trusted cloud, and
      untrusted cloud disclosure paths.

### Required Tools/Knowledge

- Existing citation, staged-change, recovery, fixture-safety, agent-surface,
  release-artifact, and provider-readiness contracts.
- Docs under `docs/` for source ingestion, staged changes, health reports,
  recovery, release artifacts, install/update, agent packaging, and provider
  readiness.
- Vitest patterns for fixture-backed validation and script adapters.
- Bun validation commands from the repository root.

### Environment Requirements

- Run commands from the repository root.
- Use synthetic fixtures under `test/fixtures/vault/` and fake paths such as
  `fixtures/demo-vault/`.
- Do not use real provider credentials, private vault content, hidden provider
  state, prompt bodies, screenshots, or live external publishing targets.

---

## 4. Scope

### In Scope (MVP)

- User can export or hand off explicitly selected markdown outputs - document
  and validate Git, filesystem, clipboard/copy, and markdown-bundle patterns
  for selected reports, staged-change summaries, source records, and release
  evidence.
- User can preserve traceability in selected summaries - require vault paths,
  headings, source records, citation IDs, staged-change IDs, report IDs,
  artifact paths, checksums, and validation output when applicable.
- User can understand external disclosure gates - make remote, cloud, and
  third-party handoff examples require provider review and user approval before
  private vault content leaves the machine.
- Contributor can validate examples safely - add fixture-backed tests that
  reject secrets, private paths, raw note bodies, prompt bodies, hidden provider
  state, direct publishing claims, and full-vault export defaults.

### Out of Scope (Deferred)

- Direct publishing to Confluence, Notion, Slack, hosted sync, or team
  knowledge-base services - *Reason: the MVP only documents safe selected
  output handoff boundaries.*
- Exporting full vaults by default - *Reason: user-owned vault content must
  remain local unless the user explicitly selects content and approves the
  disclosure path.*
- Applying framework updates or staged changes as part of export - *Reason:
  mutation workflows remain separate review-first commands.*
- Live provider calls or live external service checks - *Reason: examples and
  validation must stay deterministic and fixture-safe.*
- Adding a new user-facing command ID - *Reason: this session defines and
  validates boundaries for existing outputs rather than adding a new command
  surface.*

---

## 5. Technical Approach

### Architecture

Add a small typed handoff boundary model under `src/types/` and a pure planner
and validator under `src/agent/`. The planner should accept selected outputs,
their evidence records, requested handoff mode, disclosure state, and recovery
context. It should return deterministic allow, block, or review-required
outcomes with bounded diagnostics and no raw note bodies.

The validation layer should treat selected export as a documentation and
support-record boundary, not as a publishing pipeline. It should require
explicit selected paths, reject full-vault defaults, reject unsupported
external publishing targets, require provider review language for remote or
cloud handoff, and require citations when outputs are grounded in retrieval,
source records, health reports, staged changes, or release evidence.

Documentation should describe safe local workflows with repository-relative or
fixture-safe paths only. Existing docs should link to the new boundary guide
where they mention reports, staged changes, release evidence, provider
readiness, or agent-surface packages so the distribution story stays
synchronized.

### Design Patterns

- Pure boundary planner: keep export and handoff decisions testable without
  Obsidian runtime, live providers, or external services.
- Explicit selection required: every allowed plan starts from user-selected
  paths or records, never an implicit whole-vault export.
- Citation-preserving summaries: grounded outputs keep path, heading, source
  record, citation, staged-change, report, artifact, and validation evidence.
- Fail-closed disclosure gates: remote or cloud handoff remains blocked until
  provider review, trust, auth, capability, and disclosure state are explicit.
- Bounded diagnostics: recovery records include IDs, paths, checksums, counts,
  issue codes, and validation output, not raw private content.
- Fixture-safe docs: examples use `test/fixtures/vault/` or
  `fixtures/demo-vault/` and fake provider names only.

### Technology Stack

- TypeScript strict mode for handoff contracts and validators.
- Vitest for fixture-backed unit tests and script-adapter regression tests.
- Markdown docs for ecosystem handoff guidance and cross-links.
- Existing Bun validation scripts for agent surfaces, fixture safety, agent
  docs, and repository validation.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/ecosystem-handoff.ts` | Typed selected-output, handoff mode, disclosure, citation, diagnostic, issue, and recovery contracts | ~180 |
| `src/agent/ecosystem-handoff-boundaries.ts` | Pure handoff planner and validator for selected outputs, citation traceability, provider review gates, and redacted diagnostics | ~320 |
| `test/fixtures/vault/ecosystem-handoff-fixtures.ts` | Synthetic selected report, staged-change, source record, release evidence, unsafe publishing, and cloud-disclosure fixtures | ~180 |
| `test/ecosystem-export-handoff-boundaries.test.ts` | Unit tests for allow, block, review-required, citation, redaction, and deterministic ordering behavior | ~300 |
| `docs/ecosystem-export-handoff-boundaries.md` | User and contributor guide for selected markdown export and ecosystem handoff boundaries | ~220 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agent/index.ts` | Export handoff boundary helpers for tests and future command wiring | ~4 |
| `test/agent-validation-scripts.test.ts` | Add regression coverage for handoff docs, fixture safety, disclosure language, and out-of-scope publishing claims | ~70 |
| `docs/source-ingestion-staging.md` | Link source-record export guidance and citation-preserving handoff requirements | ~30 |
| `docs/staged-change-review-apply.md` | Link staged-change summary handoff guidance and review-first mutation boundaries | ~30 |
| `docs/vault-health-repair-staging.md` | Link redacted report export guidance and recovery fields | ~30 |
| `docs/release-artifacts.md` | Link release evidence handoff guidance for checksums, artifact paths, and validation output | ~30 |
| `docs/agent-surface-packaging.md` | Clarify local agent package reuse as selected framework surface handoff, not hosted publishing | ~30 |
| `docs/provider-readiness-guide.md` | Cross-link remote/cloud handoff to provider review and disclosure gates | ~24 |
| `README.md` | Link ecosystem handoff boundary docs from distribution and safety guidance | ~16 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Handoff validation requires explicit user selection for every exported
      vault-derived output.
- [x] Grounded selected outputs preserve citations to vault paths, headings,
      source records, citation IDs, and relevant recovery records.
- [x] Remote or cloud handoff is blocked or marked review-required until
      provider review, trust, auth, capability, and disclosure gates are
      explicit.
- [x] Git, filesystem, copy, and markdown-bundle examples use synthetic paths
      and do not imply direct publishing or hosted sync.
- [x] Full-vault export defaults, direct publishing claims, and silent cloud
      disclosure examples fail validation.

### Testing Requirements

- [x] Unit tests cover selected report, staged-change summary, source record,
      release evidence, markdown bundle, Git, filesystem, and copy handoff
      modes.
- [x] Unit tests cover missing citation, missing source record, full-vault
      selection, unsupported publishing target, untrusted cloud, secret-like
      value, private path hint, prompt body, and hidden provider state
      failures.
- [x] Agent validation script tests cover handoff docs, required disclosure
      language, fixture-safe examples, and out-of-scope publishing wording.
- [x] Fixture-safety and agent-doc validation pass for all updated docs and
      fixtures.

### Non-Functional Requirements

- [x] Export and handoff diagnostics write zero provider secrets, API keys,
      passwords, authorization headers, private vault content, raw prompt
      bodies, hidden provider state, private path hints, or real vault content
      into docs, fixtures, logs, examples, or diagnostics.
- [x] Handoff plans are deterministic across repeated runs.
- [x] Recovery records preserve command ID, target path, artifact path, report
      ID, staged-change ID, validation output, issue code, and retry guidance
      when available.
- [x] All files are ASCII-encoded and use Unix LF line endings.
- [x] Code follows project conventions.

### Quality Gates

- [x] All files ASCII-encoded
- [x] Unix LF line endings
- [x] Code follows project conventions
- [x] `bun run validate:agent-surfaces` passes
- [x] `bun run validate:fixture-safety` passes
- [x] `bun run validate:agent-surface-package` passes
- [x] `bun run validate:agent-docs` passes
- [x] `bun run validate` passes or residual failures are recorded with
      recovery details

---

## 8. Implementation Notes

### Key Considerations

- Keep the session focused on selected output boundaries and validation. Do
  not add hosted publishing, external sync, or a new user-facing command.
- Reuse existing fixture-safety, citation, provider-readiness, staged-change,
  recovery, and release diagnostic patterns instead of inventing a parallel
  export subsystem.
- Treat docs and examples as product surface. Unsafe wording around publishing
  or cloud handoff should fail tests before it reaches release docs.
- Keep support records bounded to identifiers, paths, counts, checksums,
  issue codes, validation output, and retry guidance.

### Potential Challenges

- Boundary scope can expand into publishing automation: keep direct publishing
  explicitly out of scope and validate wording.
- Citation requirements vary by output kind: model evidence records by kind so
  report, staged-change, source, chat, and release outputs can each require the
  right trace fields.
- Fixture-safety scans may not cover every new source file by default: add
  focused tests for handoff docs and fixtures.
- Existing docs may duplicate handoff language: centralize detailed guidance in
  `docs/ecosystem-export-handoff-boundaries.md` and use short cross-links
  elsewhere.

### Relevant Considerations

- [P02] **Workflow drift risk**: Update docs, tests, specs, and validation
  artifacts together so Phase 04 tracking stays synchronized.
- [P01] **Disclosure gates stay mandatory**: Remote and cloud handoff examples
  must require explicit provider review, trust, auth, capability, and
  disclosure gates.
- [P01] **Redaction must remain fail-closed**: Fixtures, recovery records, and
  exported examples must exclude secrets, raw private note bodies, private
  paths, prompt bodies, and hidden provider state.
- [P01] **Review-first mutations**: Handoff guidance must not apply staged
  changes or mutate vault notes directly.
- [P01] **Framework-vault separation**: Agent surfaces and framework docs may
  be packaged, but user vault content and `.voidbrain` support records are not
  bundled by default.
- [P03] **Bounded recovery metadata**: IDs, counts, paths, checksums, fallback
  mode, and validation output are enough for retry without exposing payloads.

### Behavioral Quality Focus

Checklist active: Yes
Top behavioral risks for this session:
- Unsafe examples imply full-vault export, hosted publishing, or silent cloud
  disclosure.
- Grounded summaries lose citations, headings, source records, staged-change
  IDs, report IDs, or validation output during handoff.
- Diagnostics leak provider secrets, prompt bodies, hidden provider state,
  private paths, or raw private note content.

---

## 9. Testing Strategy

### Unit Tests

- Test handoff plan outcomes for selected report, staged-change summary,
  source record, release evidence, markdown bundle, Git, filesystem, and copy
  modes.
- Test fail-closed issue codes for missing selected paths, missing citations,
  unsupported publishing targets, full-vault defaults, and unsafe diagnostics.
- Test provider review state for local-only, custom remote, trusted cloud, and
  untrusted cloud handoff requests.

### Integration Tests

- Extend agent validation script tests to scan the handoff docs and ensure
  required local-first, fixture-safe, provider-review, citation, staged-change,
  and recovery language is present.
- Run fixture-safety checks on updated docs and synthetic handoff fixtures.

### Manual Testing

- Review the docs as a release user moving selected markdown evidence between
  local Git, filesystem copy, clipboard, and markdown bundle workflows.
- Confirm the docs never instruct the user to publish private vault content to
  external services without explicit selection and disclosure review.

### Edge Cases

- Empty selected output list.
- Selected output lacks citation evidence.
- Report export includes only issue counts and no private note bodies.
- Staged-change summary includes IDs but no before/after raw note content.
- Release evidence includes checksums and artifact paths only.
- Remote/cloud target selected without provider review, trust, auth,
  capability, or disclosure state.
- Unsafe example contains secret-like keys, authorization headers, prompt body
  fields, hidden provider state, or private local paths.

---

## 10. Dependencies

### External Libraries

- None planned.

### Other Sessions

- **Depends on**: Phase 01 source, chat, health, staged-change, and recovery
  foundations; Phase 03 provider disclosure hardening; Phase 04 sessions
  01-04 distribution, install, agent packaging, and provider readiness work.
- **Depended by**: `phase04-session06-distribution-integration-validation`
  validates this session as part of the Phase 04 closeout path.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
