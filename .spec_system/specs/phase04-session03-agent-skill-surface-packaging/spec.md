# Session Specification

**Session ID**: `phase04-session03-agent-skill-surface-packaging`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session packages Voidbrain's agent-readable surfaces for reuse across
Codex-style repository instructions, Claude Code, Gemini CLI, and the bundled
Voidbrain skill. The repository already has synchronized AGENTS, CLAUDE,
GEMINI, skill, and human command docs plus fail-closed validation for command
IDs, statuses, safety phrases, and fixture-safe examples.

The work turns those existing surfaces into an inspectable local distribution
surface. Packaging must produce deterministic metadata about which files are
packageable, which ecosystem each file targets, which command catalog version
and checksums were validated, and which safety gates protect against user vault
content, provider secrets, private paths, prompt bodies, and hidden provider
state.

This session does not add new agent command behavior or publish to hosted
marketplaces. It keeps packaging as repository-local tooling and docs that
reuse existing validation, fixture-safety, command catalog, and release
diagnostic patterns while preserving the local-first and review-first rules.

---

## 2. Objectives

1. Define a typed package manifest for agent surfaces, command catalog metadata,
   target ecosystems, checksums, safety status, and recovery details.
2. Add a local packaging validator or planner that reuses agent-surface and
   fixture-safety checks before any packageable output is treated as ready.
3. Update packageable AGENTS, CLAUDE, GEMINI, Voidbrain skill, and human docs
   so distribution guidance stays synchronized with implemented command
   behavior.
4. Document how contributors can install, reuse, or copy Voidbrain agent
   surfaces with synthetic examples only and no hosted marketplace publishing.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase04-session01-release-metadata-build-artifacts` - Release artifact
      validation and bounded checksum diagnostics are available.
- [x] `phase04-session02-obsidian-install-update-workflow` - Local install and
      update workflow decisions, dry-run language, rollback intent, and release
      recovery details are available.
- [x] `phase02-session02-agent-surface-validation-hardening` - Agent-surface
      command ID, status, safety phrase, and fixture-safety validation exists.
- [x] `phase03-session06-offline-provider-integration-validation` - Provider
      closeout, redaction, semantic fallback, and surface sync evidence are
      available.

### Required Tools/Knowledge

- Existing command catalog in `src/agent/command-catalog.ts`.
- Existing surface validation in `src/agent/surface-validation.ts`.
- Existing fixture safety checks in `src/agent/fixture-safety.ts`.
- Existing repository scan boundary helpers for framework-owned paths.
- Bun package scripts and Vitest test patterns.

### Environment Requirements

- Run commands from the repository root.
- No real vault content or provider credentials are required.
- Packaging examples must use repository surfaces, `test/fixtures/vault/`, or
  clearly fake paths such as `fixtures/demo-vault/`.
- Packageable output, if written, must stay under framework-owned build or docs
  paths and must not include user vault notes or `.voidbrain` support records.

---

## 4. Scope

### In Scope (MVP)

- Contributor can validate packageable agent surfaces - create a typed local
  planner that loads known surfaces, reuses existing validation checks, records
  checksums, and reports package readiness.
- Contributor can inspect distribution metadata - include surface ID, path,
  target ecosystem, command catalog status, checksum, validation output, and
  recovery details.
- Contributor can reuse Voidbrain surfaces safely - update docs for copying or
  installing AGENTS, CLAUDE, GEMINI, and the Voidbrain skill with fake paths
  and no credentials.
- Repository validation can catch packaging drift - add focused tests and a
  package script that fail closed on unknown command IDs, stale statuses,
  missing safety phrases, unsafe examples, private paths, and unsupported
  output paths.

### Out of Scope (Deferred)

- Hosted agent marketplace publishing - *Reason: Phase 04 prepares local
  packageability before any public registry workflow exists.*
- Adding new runtime agent commands - *Reason: this session packages current
  command behavior and must not change the command catalog semantics.*
- Exporting real vault content, provider state, prompt bodies, or credentials -
  *Reason: packageable outputs are framework-owned instructions only.*
- Applying framework updates into user vaults - *Reason: framework update
  behavior remains dry-run until a reviewed apply workflow exists.*

---

## 5. Technical Approach

### Architecture

Add a small, pure packaging planner around the existing command catalog,
surface validation, fixture safety, and repository path boundary modules. The
planner should accept a repository root and optional package surface list,
normalize and validate candidate paths, read packageable files, compute
SHA-256 checksums, classify each target ecosystem, and return a deterministic
manifest plus issue list.

Keep any CLI adapter thin. It should call the planner, print bounded human or
JSON diagnostics, and exit nonzero when package readiness fails. If a later
implementation writes a package preview, it should write only framework-owned
surfaces under a generated build directory and should never include user vault
content, `.voidbrain` records, EXAMPLES, private paths, provider secrets, or
raw prompt bodies.

Documentation should make the copy/install path explicit for Codex-style
AGENTS files, Claude Code instructions, Gemini CLI instructions, and the
Voidbrain skill. The docs should call out that packageable surfaces are local
framework files, not permission to mutate user vault notes directly.

### Design Patterns

- Pure planner plus CLI adapter: keeps package readiness testable without
  shelling out or touching a real vault.
- Single catalog source of truth: reuse `AGENT_COMMAND_CATALOG` and
  `AGENT_SURFACES` so package metadata cannot drift from validation.
- Fail-closed issue list: unsupported paths, stale command status, missing
  safety phrases, unsafe examples, and private path hints block readiness.
- Bounded diagnostics: output IDs, paths, ecosystems, hashes, status values,
  validation issue codes, and remediation only.
- Fixture-safe examples: tests and docs use synthetic paths and never include
  real provider secrets or private vault content.

### Technology Stack

- TypeScript strict mode for package manifest and issue contracts.
- Bun for CLI script execution and package scripts.
- Vitest for planner, CLI, and fixture-safety coverage.
- Node `crypto` for SHA-256 checksums.
- Existing agent validation and repository scan boundary utilities.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/agent-surface-package.ts` | Typed package manifest, ecosystem, checksum, issue, diagnostic, and readiness result contracts | ~150 |
| `src/agent/agent-surface-packaging.ts` | Pure package planner, path validation, surface loading, checksum creation, ecosystem classification, and safety aggregation | ~320 |
| `scripts/validate-agent-surface-package.ts` | Bun CLI adapter for local package readiness validation and bounded JSON output | ~100 |
| `test/fixtures/vault/agent-surface-package-fixtures.ts` | Synthetic surface package fixture builders for safe package tests | ~120 |
| `test/agent-surface-packaging.test.ts` | Focused Vitest coverage for ready packages, drift, unsafe examples, unsupported paths, and CLI output | ~260 |
| `docs/agent-surface-packaging.md` | Local install and reuse guide for agent surfaces and skill packaging | ~150 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `package.json` | Add package readiness validation script and wire it into `validate:agent-docs` if runtime cost stays small | ~4 |
| `src/agent/index.ts` | Export package planner helpers for tests and future integration | ~6 |
| `AGENTS.md` | Add distribution packaging guidance without changing command behavior | ~12 |
| `CLAUDE.md` | Add Claude reuse guidance and safety reminders | ~10 |
| `GEMINI.md` | Add Gemini reuse guidance and safety reminders | ~10 |
| `skills/voidbrain/SKILL.md` | Add package reuse notes and recovery boundary language | ~12 |
| `docs/agent-surfaces-commands.md` | Link packaging docs and describe package readiness validation | ~30 |
| `README.md` | Link the agent surface packaging guide and validation script | ~8 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Agent package readiness validates all declared packageable surfaces
      against command catalog status, safety phrases, fixture safety, and
      repository path boundaries before reporting ready.
- [ ] Package diagnostics include command ID or script ID, surface ID, target
      ecosystem, repository-relative path, checksum, validation output, issue
      code, and remediation.
- [ ] Packageable outputs exclude user vault content, `.voidbrain` records,
      EXAMPLES, provider secrets, authorization headers, prompt bodies, hidden
      provider state, and private path hints.
- [ ] Docs explain local copy/install or reuse for compatible agent tools with
      synthetic examples only.
- [ ] Existing AGENTS, CLAUDE, GEMINI, skill, and human command docs stay
      synchronized with implemented command IDs and current safety behavior.

### Testing Requirements

- [ ] Unit tests cover ready package manifests, deterministic ordering,
      checksum generation, ecosystem classification, and bounded diagnostics.
- [ ] Unit tests cover unknown command IDs, stale status labels, missing safety
      phrases, unsafe examples, unsupported paths, and private path hints.
- [ ] CLI adapter tests use temp repositories or synthetic fixture surfaces.
- [ ] Fixture-safety and agent-doc validation pass.

### Non-Functional Requirements

- [ ] Automated packaging writes zero provider secrets, API keys, private vault
      content, raw prompts, authorization headers, hidden provider state, or
      private path hints into docs, fixtures, logs, examples, or diagnostics.
- [ ] Package planning is deterministic across repeated runs.
- [ ] Recovery details preserve surface path, package path when applicable,
      checksum, validation issue code, and remediation.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations

- Session 03 packages current agent behavior only; do not add a new command ID
  unless a separate PRD session explicitly implements that behavior.
- `AGENT_COMMAND_CATALOG` and `AGENT_SURFACES` should remain the source of
  truth. Avoid copying command tables into a second hardcoded manifest.
- The package planner should reuse existing path boundary, surface validation,
  and fixture-safety helpers instead of adding parallel ad hoc scanners.
- Package outputs should remain framework-owned. They must not include
  generated knowledge notes, `.voidbrain` support records, EXAMPLES, or any
  private vault path.

### Potential Challenges

- Agent tools use different install conventions: keep package metadata generic
  enough for Codex-style AGENTS files, Claude Code markdown, Gemini CLI
  markdown, and skill directories.
- Surface docs can drift from command catalog text: fail readiness when known
  surfaces reference stale statuses or omit required safety language.
- Some docs may contain research links or external examples: keep fixture
  safety focused on unsafe secrets, private paths, raw prompt bodies, and real
  vault content rather than blocking normal public documentation links.

### Relevant Considerations

- [P02] **Workflow drift risk**: Packaging must keep phase tracking, command
  docs, and validation artifacts synchronized as distribution surfaces change.
- [P01] **Disclosure gates stay mandatory**: Reuse guidance must not imply that
  cloud providers can receive private vault content without provider review.
- [P01] **Redaction must remain fail-closed**: Package diagnostics and examples
  must reject provider secrets, raw private note bodies, and hidden provider
  state.
- [P00] **Canonical command catalog**: Use the command catalog as the package
  source of truth.
- [P00] **Synthetic fixtures**: Tests and docs should use fake paths and temp
  repositories.

### Behavioral Quality Focus

Checklist active: Yes
Top behavioral risks for this session:
- Package readiness accidentally includes user vault content or local support
  records.
- Package docs drift from implemented command IDs and status labels.
- Unsafe examples or private paths pass through generated package diagnostics.

---

## 9. Testing Strategy

### Unit Tests

- Validate successful package planning for AGENTS, CLAUDE, GEMINI, the
  Voidbrain skill, and human command docs.
- Validate deterministic surface ordering, checksums, ecosystem labels, and
  bounded issue output.
- Validate fail-closed behavior for stale command statuses, unknown command
  IDs, missing safety phrases, unsafe examples, and unsupported paths.

### Integration Tests

- Exercise the CLI adapter against a synthetic temp repository.
- Confirm `bun run validate:agent-docs` includes the package readiness check if
  it is wired into the package script.

### Manual Testing

- Run package readiness validation from the repository root and inspect human
  and JSON output.
- Review docs for install/reuse clarity and synthetic examples.

### Edge Cases

- Missing packageable surface file.
- Unreadable surface file.
- Duplicate package surface path.
- Candidate path escaping the repository or pointing at `.voidbrain`,
  `EXAMPLES`, `fixtures`, or generated vault content.
- Surface content containing a secret-like value, private path hint, prompt
  body, or hidden provider state.

---

## 10. Dependencies

### External Libraries

- Node `crypto`: Built-in checksum generation.
- Bun: Existing CLI runtime and package script runner.
- Vitest: Existing test runner.

### Other Sessions

- **Depends on**: `phase04-session01-release-metadata-build-artifacts`,
  `phase04-session02-obsidian-install-update-workflow`,
  `phase02-session02-agent-surface-validation-hardening`,
  `phase03-session06-offline-provider-integration-validation`
- **Depended by**: `phase04-session04-onboarding-provider-readiness-guides`,
  `phase04-session05-ecosystem-export-handoff-boundaries`,
  `phase04-session06-distribution-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
