# Session Specification

**Session ID**: `phase02-session03-framework-update-preview-planner`
**Phase**: 02 - Agentic Maintenance
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens `voidbrain.preview-framework-update` into an implemented dry-run planner for framework-owned files. It normalizes candidate paths, excludes vault and generated knowledge content, compares proposed framework candidates with current repository files, and returns create, update, skip, conflict, and excluded actions with deterministic recovery details.

The work matters because framework updates are high trust operations. Voidbrain must help users inspect agent instructions, docs, scripts, and framework source changes without crossing into user-owned vault notes, generated knowledge, provider secrets, or private diagnostics. This session keeps update behavior preview-only while making the preview output useful enough for later manual review and a future apply workflow.

The implementation fits existing conventions by keeping Obsidian lifecycle wiring untouched, placing planner logic under `src/agent/`, using typed contracts in `src/types/`, using synthetic fixture data under `test/fixtures/vault/`, and preserving local-first, provider-free, no-direct-write behavior.

---

## 2. Objectives

1. Implement a deterministic dry-run framework update planner that reports create, update, skip, conflict, and excluded actions.
2. Normalize and classify candidate paths so user vault content, generated knowledge notes, cache records, provider secrets, private diagnostics, and unsafe traversal fail closed.
3. Compare proposed framework candidates against current repository files without writing files or staging note mutations.
4. Preserve duplicate in-flight preview protection and deterministic output for CLI and runtime surfaces.
5. Synchronize command catalog, agent surfaces, docs, and tests so dry-run preview behavior is marked implemented while apply behavior stays out of scope.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session05-agent-surfaces-commands` - Provides the initial command catalog, agent surfaces, and framework preview scaffold.
- [x] `phase00-session06-staged-changes-health-foundation` - Provides staged-change and backup primitives that future apply behavior must use, but this session does not invoke.
- [x] `phase01-session08-hot-cache-mvp-integration-validation` - Provides synchronized MVP agent surfaces, docs, runtime status, and recovery expectations.
- [x] `phase02-session02-agent-surface-validation-hardening` - Provides fail-closed agent surface validation, bounded repository scan helpers, and deterministic issue reporting.

### Required Tools/Knowledge

- TypeScript strict mode, Vitest, Bun scripts, Node filesystem APIs, repository-relative path normalization, and deterministic hash or content comparison.
- Existing `FrameworkUpdatePreviewInput`, `FrameworkUpdatePreviewPlan`, `createFrameworkUpdatePreviewPlanner`, `validateRepositoryScanPath`, fixture safety checks, and command catalog metadata.
- Project safety rules for local-first behavior, dry-run framework updates, provider secret redaction, synthetic fixtures, staged changes, citations, and recovery details.

### Environment Requirements

- Repository root with Bun dependencies installed.
- Candidate examples and tests use synthetic fixtures only.
- No provider calls, no vault note mutation, and no framework apply behavior.

---

## 4. Scope

### In Scope (MVP)

- Developer can run `bun run preview:framework-update` and receive deterministic dry-run actions - normalize candidates, compare against current framework files, and report create, update, skip, conflict, or excluded results.
- Developer can inspect excluded user-content paths - reject vault notes, generated knowledge notes, `.voidbrain` support records, cache records, provider secret files, diagnostics, absolute paths, and parent traversal.
- Developer can inspect conflicts before any apply workflow exists - surface unsupported file types, unsafe content, duplicate candidates, path collisions, and missing comparison inputs as typed issues.
- User vault content remains protected - preview reads bounded repository framework paths only and never writes files, stages note mutations, or calls a provider.
- Agent surfaces stay synchronized - command catalog, AGENTS, CLAUDE, GEMINI, the Voidbrain skill, and human docs describe dry-run preview as implemented and apply behavior as deferred.

### Out of Scope (Deferred)

- Applying framework updates - Reason: Phase 02 explicitly keeps framework update behavior dry-run only.
- Modifying user vault files or generated knowledge notes - Reason: user-owned vault content must stay outside framework update previews.
- Fetching remote framework bundles automatically - Reason: remote retrieval needs explicit user action and later provider or source review rules.
- Building a UI for framework update review - Reason: this session targets domain logic, CLI output, runtime command messaging, and tests.
- Auto-staging framework update changes - Reason: staging or apply flows belong to a future explicitly approved workflow.

---

## 5. Technical Approach

### Architecture

Extend the framework preview domain around a pure planner with injectable repository reads. `src/agent/framework-update-preview.ts` should keep normalization, exclusion, comparison, conflict mapping, duplicate in-flight protection, and deterministic sorting testable without Obsidian. It should accept candidate records with repository-relative paths and optional proposed content while preserving path-only CLI compatibility for default framework paths.

Use existing validation and safety helpers where practical instead of creating a separate path policy. Repository boundary checks should reject absolute paths, parent traversal, unsupported extensions, user-content roots, `.voidbrain` support records, generated note roots, and secret-bearing files. Candidate content should be scanned for credential-like values before it can become a planned create or update action.

The Bun script remains a thin adapter. It should collect candidate arguments, call the planner from the repository root, print JSON, and exit nonzero only when typed issues or conflicts require user attention. Runtime command handling should keep `voidbrain.preview-framework-update` as a dry-run outcome even after the catalog marks the dry-run planner implemented.

### Design Patterns

- Pure planner with injected readers: Domain logic can be tested without mutating the filesystem.
- Fail-closed path classification: Unsafe candidates become excluded paths or conflict issues, not planned actions.
- Deterministic action model: Sort output by path and action type so CLI, tests, and recovery logs are stable.
- Content-safety gate: Proposed content containing credential-like values never becomes a create or update action.
- Preview-only contract: Runtime and docs state that apply behavior remains deferred.

### Technology Stack

- TypeScript 5.9 strict mode.
- Bun script runner for `preview:framework-update`.
- Vitest 4 for planner, CLI-adapter, catalog, and surface regression coverage.
- Biome for formatting and linting.
- Existing Obsidian plugin repository structure with no Obsidian runtime dependency for this session.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `test/fixtures/vault/framework-update-preview-fixtures.ts` | Synthetic framework candidates, unsafe path examples, and current file snapshots for preview tests | ~160 |
| `test/framework-update-preview.test.ts` | Focused planner and CLI adapter tests for dry-run actions, conflicts, exclusions, and duplicate preview behavior | ~220 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/agent-commands.ts` | Extend preview contracts for candidate records, action classifications, hashes, conflict metadata, and recovery details | ~80 |
| `src/agent/framework-update-preview.ts` | Implement path policy, content safety checks, repository comparison, deterministic actions, and duplicate in-flight protection | ~260 |
| `src/agent/index.ts` | Export any new preview helper types or constructors needed by scripts and tests | ~12 |
| `scripts/preview-framework-update.ts` | Use the hardened planner, validate root/candidate input, print stable JSON, and exit nonzero on conflicts or issues | ~90 |
| `src/agent/runtime-command-handlers.ts` | Keep runtime preview command as dry-run with duplicate-safe messaging after implemented status | ~50 |
| `src/agent/command-catalog.ts` | Mark dry-run preview behavior implemented and document output, exclusions, conflicts, and recovery details | ~60 |
| `test/agent-surfaces-commands.test.ts` | Update catalog and surface regression coverage for implemented preview status and compatibility | ~70 |
| `AGENTS.md` | Mark dry-run preview implemented while preserving framework update safety language | ~10 |
| `CLAUDE.md` | Mark dry-run preview implemented while preserving framework update safety language | ~10 |
| `GEMINI.md` | Mark dry-run preview implemented while preserving framework update safety language | ~10 |
| `skills/voidbrain/SKILL.md` | Update command table and workflow guidance for implemented dry-run previews | ~16 |
| `docs/agent-surfaces-commands.md` | Document planner action types, exclusions, conflicts, CLI use, and apply deferral | ~80 |
| `README.md` | Keep contributor command examples aligned with the implemented dry-run preview command | ~12 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] `bun run preview:framework-update` returns a dry-run plan with deterministic create, update, skip, conflict, and excluded actions.
- [ ] Candidate paths are normalized and unsafe paths fail closed before any repository read.
- [ ] User vault content, generated knowledge notes, `.voidbrain` support records, provider secret files, private diagnostics, and fixture vault notes are excluded from planned framework actions.
- [ ] Proposed framework content with credential-like values or private path hints becomes a conflict issue, not an update action.
- [ ] Preview planning never writes files, stages note mutations, or calls a provider.
- [ ] `voidbrain.preview-framework-update` is marked implemented for dry-run behavior in catalog, docs, and agent surfaces while apply behavior remains deferred.

### Testing Requirements

- [ ] Unit tests cover path normalization, exclusions, duplicate candidates, action classification, conflict summaries, and deterministic ordering.
- [ ] Unit tests cover create, update, skip, conflict, excluded, and invalid-input paths using synthetic fixtures.
- [ ] Runtime command tests cover dry-run command outcome after implemented status and duplicate-safe messaging.
- [ ] Manual validation commands completed from the repository root.

### Non-Functional Requirements

- [ ] Preview behavior remains local-first, provider-free, dry-run only, and read-only.
- [ ] No user vault content, provider secrets, hidden provider state, or private diagnostics are written to docs, fixtures, logs, screenshots, or generated examples.
- [ ] Output includes recovery details useful for retry or discard decisions: command ID, target path, action, issue code, and validation context.
- [ ] Results remain deterministic across repeated runs with the same candidate set.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.
- [ ] `bun run validate:agent-surfaces` passes.
- [ ] `bun run validate:fixture-safety` passes.
- [ ] `bun run validate:agent-docs` passes.
- [ ] `bun run validate` passes or residual failures are documented with recovery details.

---

## 8. Implementation Notes

### Key Considerations

- This session implements preview behavior only. Any future apply workflow must route through explicit review and staged changes.
- Candidate path policy should be conservative and explicit. Framework files can be planned; user vault notes, generated knowledge, `.voidbrain` support state, provider secret files, and diagnostics are not framework update targets.
- The planner should preserve backwards compatibility for current path-only tests while adding richer candidate comparison for proposed content.
- Runtime command handling must not accidentally label preview as a normal opened UI command after the catalog status changes to implemented.
- Agent surface synchronization is part of the implementation, not cleanup.

### Potential Challenges

- Distinguishing "skip because identical" from "skip because duplicate" can become ambiguous: use issue codes or action reasons that are stable and testable.
- Content comparison without a remote bundle should stay adapter-driven: tests can pass proposed content directly, and the CLI can keep path-only defaults until explicit bundle input exists.
- Safety scanning can produce false positives in tests: keep unsafe examples synthetic, fragmented where needed, and clearly marked as fake.
- Existing docs currently describe preview as scaffolded: update surfaces and tests in the same session to avoid status drift.

### Relevant Considerations

- [P01] **Workflow drift risk**: Catalog, docs, agent surfaces, scripts, PRD artifacts, and tests must stay synchronized when command status changes.
- [P01] **Bun validation baseline**: Preview and validation commands should remain runnable from the repository root with clear failure output.
- [P01] **Disclosure gates stay mandatory**: This preview workflow must not call providers or send vault content anywhere.
- [P01] **Redaction must remain fail-closed**: Credential-like values, private paths, and hidden provider state become issues and are not echoed unsafely.
- [P01] **Framework-vault separation**: Framework update candidates must stay isolated from vault notes, generated knowledge, and support records.
- [P01] **Command-surface sync**: Updating preview command behavior requires AGENTS, CLAUDE, GEMINI, docs, and skill updates in the same session.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- Preview actions accidentally include user vault content or generated knowledge paths.
- A dry-run command is marked implemented and then runtime handling treats it like an apply or opened workflow.
- Candidate content with secrets or private paths leaks through output or gets planned as an update.
- Duplicate or concurrent preview requests produce misleading or nondeterministic output.
- CLI and agent surfaces drift from the command catalog after status changes.

---

## 9. Testing Strategy

### Unit Tests

- Test path normalization for `./`, backslashes, absolute paths, parent traversal, empty paths, duplicate paths, and unsupported extensions.
- Test exclusion rules for vault roots, `test/fixtures/vault/`, `.voidbrain/`, generated note roots, provider secret files, diagnostics, and private path hints.
- Test action classification for create, update, skip identical, skip duplicate, conflict, and excluded candidates.
- Test deterministic sorting of actions, excluded paths, and issues.
- Test duplicate in-flight planner protection and cleanup after success or failure.

### Integration Tests

- Test the script adapter through shared helpers or subprocess coverage so JSON output, nonzero issue handling, and repository-root assumptions are stable.
- Test command catalog and surface validation after `voidbrain.preview-framework-update` moves to implemented dry-run status.
- Test runtime command outcomes so implemented dry-run preview remains `kind: "dry-run"` and never reports apply behavior.

### Manual Testing

- Run `bun run preview:framework-update` from the repository root.
- Run `bun run preview:framework-update AGENTS.md test/fixtures/vault/sources/demo-article.md ../outside.md`.
- Run `bun run validate:agent-surfaces` from the repository root.
- Run `bun run validate:fixture-safety` from the repository root.
- Run `bun run validate:agent-docs` from the repository root.
- Run `bun run validate` from the repository root.

### Edge Cases

- Candidate path is absolute, empty, contains parent traversal, or uses Windows separators.
- Candidate path points to user vault content, generated knowledge, support records, provider secrets, or private diagnostics.
- Candidate appears twice with the same proposed content.
- Candidate appears twice with different proposed content.
- Current file is missing, identical, changed, unreadable, or outside the repository boundary.
- Proposed content contains credential-like text or private path hints.
- Planner throws during current file read and must return a conflict with recovery details.

---

## 10. Dependencies

### External Libraries

- None planned. Use existing TypeScript, Bun, Vitest, Biome, Node standard library APIs, and local validation helpers.

### Other Sessions

- **Depends on**: `phase00-session05-agent-surfaces-commands`, `phase00-session06-staged-changes-health-foundation`, `phase01-session08-hot-cache-mvp-integration-validation`, `phase02-session02-agent-surface-validation-hardening`.
- **Depended by**: `phase02-session04-maintenance-recommendation-planner`, `phase02-session07-agentic-maintenance-integration-validation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
