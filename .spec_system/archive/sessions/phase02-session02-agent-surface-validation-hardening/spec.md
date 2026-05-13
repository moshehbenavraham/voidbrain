# Session Specification

**Session ID**: `phase02-session02-agent-surface-validation-hardening`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens `voidbrain.validate-agent-surfaces` from scaffolded local checks into an implemented fail-closed validation workflow. It keeps the command catalog as the canonical source of truth, checks markdown agent surfaces and fixture-safe examples from bounded repository paths, and emits deterministic issues with path, heading, command ID, line, and remediation context.

The work matters because Phase 02 depends on agent surfaces staying synchronized while recovery, framework previews, recommendations, placement suggestions, and batch ingestion expand the command surface. Validation must catch stale command IDs, missing safety phrases, unsafe examples, private path hints, and credential-like values before docs or examples drift into misleading or unsafe instructions.

The implementation fits the project conventions by keeping Obsidian lifecycle wiring untouched, placing testable validation logic under `src/agent/` and `src/types/`, and using synthetic fixtures under `test/fixtures/vault/`. The workflow remains local-first, read-only, bounded to framework paths, and free of provider calls or user vault scanning.

---

## 2. Objectives

1. Make `voidbrain.validate-agent-surfaces` fail closed for stale command IDs, missing command IDs, stale status text, and missing safety language.
2. Harden fixture and example scanning for secret-like keys, credential-like values, private path hints, and unsafe repository path boundaries.
3. Emit deterministic validation output with repository path, heading, line, command ID, issue code, and remediation hint.
4. Mark validation behavior as implemented in the command catalog, agent surfaces, and human docs only after tests cover the behavior.
5. Preserve read-only local validation with no provider calls, no vault content scanning, and no repository mutations.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session05-agent-surfaces-commands` - Provides command catalog, markdown surfaces, and initial surface validation contracts.
- [x] `phase01-session08-hot-cache-mvp-integration-validation` - Provides synchronized MVP agent surfaces, docs, and validation command expectations.
- [x] `phase02-session01-recover-session-command` - Provides the implemented recovery command status that current surfaces must validate against.

### Required Tools/Knowledge

- TypeScript strict mode, Vitest, Bun scripts, markdown heading parsing, and deterministic issue formatting.
- Existing `AGENT_COMMAND_CATALOG`, `AGENT_SURFACES`, fixture safety scanner, and local validation scripts.
- Repository safety rules for local-first behavior, staged changes, provider secrets, synthetic fixtures, citations, dry-run previews, and recovery details.

### Environment Requirements

- Repository root with Bun dependencies installed.
- Synthetic fixture examples only under `test/fixtures/vault/` or clearly fake paths such as `fixtures/demo-vault/`.
- No cloud provider calls and no scanning of user vault content outside bounded repository framework paths.

---

## 4. Scope

### In Scope (MVP)

- Developer can run `bun run validate:agent-surfaces` and receive deterministic pass or fail output - harden catalog, surface, and script validation around the canonical command source.
- Developer can catch stale agent documentation before release - validate missing command IDs, unknown command IDs, stale command status text, and missing safety language across AGENTS, CLAUDE, GEMINI, the Voidbrain skill, and human docs.
- Developer can catch unsafe examples in bounded repository paths - scan docs, skills, synthetic fixtures, README surfaces, and known standalone framework files for secret-like keys, credential-like values, and private path hints.
- Developer can inspect actionable failures - include repository path, heading, line, command ID, issue code, and remediation hint in stable order.
- User vault content remains protected - validation reads only bounded repository paths and remains read-only.

### Out of Scope (Deferred)

- Mutating or auto-fixing agent surfaces - Reason: this session validates and reports only; docs are updated by implementation tasks, not by runtime auto-repair.
- Scanning user vault content or generated knowledge notes - Reason: validation is limited to framework docs, skills, scripts, source contracts, and synthetic fixtures.
- Accepting live provider credentials as validation input - Reason: provider secrets must never appear in docs, fixtures, logs, screenshots, or examples.
- Implementing framework update apply behavior - Reason: `voidbrain.preview-framework-update` remains dry-run until a later apply workflow exists.

---

## 5. Technical Approach

### Architecture

Extend the agent validation domain around three small boundaries. `src/agent/surface-validation.ts` should own markdown command and safety validation, including heading and line context. `src/agent/fixture-safety.ts` should own text safety scanning for fixture and example content. New helper modules should keep repository path boundary checks and deterministic issue rendering testable without running Bun scripts.

The Bun scripts should become thin adapters: collect only allowed repository files, read text, call the domain validators, sort and format issues deterministically, and exit nonzero on any issue. They should fail closed for missing required surfaces, unreadable files, invalid root paths, or unsafe scan candidates without mutating repository files.

Command catalog metadata should move `voidbrain.validate-agent-surfaces` from scaffolded to implemented once validation behavior and tests are in place. Agent surfaces and docs should describe the implemented behavior consistently and preserve local-first, staged-change, provider-secret, synthetic-fixture, citation, dry-run, and recovery language.

### Design Patterns

- Canonical catalog validation: Command IDs and statuses come from `AGENT_COMMAND_CATALOG` and `AGENT_COMMAND_IDS`.
- Bounded scan adapter: Scripts enumerate known framework paths and reject absolute paths, parent traversal, user vault paths, and unsupported extensions.
- Deterministic issue model: Validators return sorted codes, paths, headings, lines, command IDs, and remediation hints for stable tests and CI output.
- Fail-closed text safety: Secret-like or private examples become validation failures instead of warnings.
- Contract-first helpers: Types define validation issue metadata before script output formatting consumes it.

### Technology Stack

- TypeScript 5.9 strict mode.
- Bun script runner for validation commands.
- Vitest 4 for unit and script adapter coverage.
- Biome for formatting and linting.
- Existing Obsidian plugin repository structure; no Obsidian runtime dependency for this session.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/agent/repository-scan-boundary.ts` | Normalize and classify bounded repository paths for validation scripts | ~140 |
| `src/agent/agent-validation-reporting.ts` | Format validation issues with stable path, heading, line, command, and remediation output | ~120 |
| `test/fixtures/vault/agent-surface-validation-fixtures.ts` | Synthetic markdown surfaces and unsafe example strings for validation tests | ~160 |
| `test/agent-validation-scripts.test.ts` | Script adapter and bounded scan coverage for fail-closed validation behavior | ~180 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/agent-commands.ts` | Add validation issue heading, remediation, and boundary metadata fields or codes as needed | ~30 |
| `src/agent/command-catalog.ts` | Harden catalog validation and mark `voidbrain.validate-agent-surfaces` implemented | ~70 |
| `src/agent/surface-validation.ts` | Add heading-aware line reporting, status drift checks, and remediation hints | ~160 |
| `src/agent/fixture-safety.ts` | Tighten unsafe example detection and bounded line excerpts | ~80 |
| `src/agent/index.ts` | Export new validation helpers | ~10 |
| `scripts/validate-agent-surfaces.ts` | Use bounded readers, deterministic reporting, and fail-closed missing or unreadable surface behavior | ~90 |
| `scripts/check-fixture-safety.ts` | Use shared repository scan boundaries and deterministic reporting | ~90 |
| `test/agent-surfaces-commands.test.ts` | Expand catalog, surface, fixture, and status drift regression tests | ~160 |
| `AGENTS.md` | Mark validation implemented and preserve safety language | ~12 |
| `CLAUDE.md` | Mark validation implemented and preserve safety language | ~12 |
| `GEMINI.md` | Mark validation implemented and preserve safety language | ~12 |
| `skills/voidbrain/SKILL.md` | Update command table and validation workflow language | ~20 |
| `docs/agent-surfaces-commands.md` | Document implemented validation behavior and deterministic issue output | ~60 |
| `docs/development.md` | Reflect validation command expectations for contributors | ~20 |

---

## 7. Success Criteria

### Functional Requirements

- [x] `bun run validate:agent-surfaces` fails nonzero for missing command IDs, unknown command IDs, stale command status text, missing safety phrases, missing required surfaces, and unreadable required surfaces.
- [x] `bun run validate:fixture-safety` fails nonzero for secret-like keys, credential-like values, private path hints, unsupported scan boundaries, and unreadable scan candidates.
- [x] Validation issues include deterministic repository path, heading when available, line when available, command ID when relevant, issue code, and remediation hint.
- [x] Validation scans only known framework docs, agent surfaces, scripts, source contracts, and synthetic fixture paths.
- [x] `voidbrain.validate-agent-surfaces` is marked implemented in catalog, docs, and agent surfaces after tests cover the hardened behavior.

### Testing Requirements

- [x] Unit tests cover catalog completeness, duplicate command IDs, status drift, missing safety phrases, unknown command IDs, and deterministic extraction.
- [x] Fixture safety tests cover secret-like keys, credential-like values, private path hints, safe synthetic fixtures, and redacted line excerpts.
- [x] Script adapter tests cover bounded path collection, missing required files, unreadable files, deterministic output ordering, and nonzero failure behavior.
- [x] Manual validation commands completed from the repository root.

### Non-Functional Requirements

- [x] Validation remains local-first, read-only, and provider-free.
- [x] No user vault content outside bounded repository paths is scanned.
- [x] Provider secrets, authorization headers, private path hints, and hidden provider state are never written to docs, fixtures, logs, screenshots, or generated examples.
- [x] Output remains deterministic across repeated runs on the same file set.

### Quality Gates

- [x] All files ASCII-encoded.
- [x] Unix LF line endings.
- [x] Code follows project conventions.
- [x] `bun run validate:agent-surfaces` passes.
- [x] `bun run validate:fixture-safety` passes.
- [x] `bun run validate:agent-docs` passes.
- [x] `bun run validate` passes or residual failures are documented with recovery details.

---

## 8. Implementation Notes

### Key Considerations

- The command catalog is the source of truth. Do not duplicate command lists in scripts or docs beyond generated or validated references.
- This command is a validator, not a repair workflow. The scripts should report issues and exit nonzero without rewriting files.
- Keep scan roots explicit and conservative. Docs and skills can be scanned; user vault notes, generated knowledge notes, `.voidbrain/` support records, and arbitrary local paths are out of scope.
- Validation output should be useful in CI and local terminals: stable ordering, concise one-line issues, and enough context to fix without dumping unsafe content.
- Agent surfaces must move in the same session as catalog status changes to avoid workflow drift.

### Potential Challenges

- Markdown command IDs may appear in code fences, tables, and prose: treat all markdown text as a documented surface and report command drift consistently.
- Status drift may be phrased differently across docs: start by detecting command table rows and explicit status labels, then fall back to command presence and required phrase checks.
- Fixture examples may contain false positives for intentionally fake credentials: keep fake credentials obviously fake and document safe placeholder patterns.
- Path hints in docs can overlap with developer setup examples: use `test/fixtures/vault/`, `fixtures/demo-vault/`, or repository-relative examples instead of private home paths.

### Relevant Considerations

- [P01] **Workflow drift risk**: Catalog, scripts, docs, agent surfaces, PRD artifacts, and tests must stay synchronized.
- [P01] **Bun validation baseline**: Validation should remain runnable from the repository root with clear local command expectations.
- [P01] **Redaction must remain fail-closed**: Unsafe examples, private paths, and credential-like values become failures.
- [P01] **Synthetic fixtures**: Tests and examples use fake fixture paths and never user vault content.
- [P01] **Framework-vault separation**: The scanner must distinguish framework files from user vault content and generated knowledge notes.
- [P01] **Command-surface sync**: Updating command implementation status requires AGENTS, CLAUDE, GEMINI, docs, and skill updates in the same session.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- Validation scripts silently skip missing, unreadable, or out-of-bound paths.
- Markdown surfaces show stale command statuses even though command IDs are present.
- Fixture safety output echoes unsafe credential-like values or private path hints too verbosely.
- Path collection expands into user vault content or generated support records.
- Catalog status changes land without synchronized docs and regression tests.

---

## 9. Testing Strategy

### Unit Tests

- Test command catalog validation for canonical completeness, duplicate IDs, invalid statuses, implemented validation status, and supported surfaces.
- Test markdown surface validation for missing IDs, unknown IDs, stale status labels, missing safety phrases, heading detection, line reporting, and remediation hints.
- Test fixture safety scanning for secret-like keys, credential-like values, private path hints, safe placeholders, and redacted issue messages.

### Integration Tests

- Test script adapter helpers for bounded path collection, missing required surfaces, unreadable candidate handling, deterministic issue formatting, and nonzero failure status.
- Test `validate:agent-docs` behavior through the shared domain helpers without writing repository files.

### Manual Testing

- Run `bun run validate:agent-surfaces` from the repository root.
- Run `bun run validate:fixture-safety` from the repository root.
- Run `bun run validate:agent-docs` from the repository root.
- Inspect the command table in AGENTS, CLAUDE, GEMINI, the Voidbrain skill, and `docs/agent-surfaces-commands.md` for synchronized implemented status.

### Edge Cases

- Required surface file is missing.
- Required surface exists but cannot be read.
- Surface includes a removed or misspelled `voidbrain.*` command ID.
- Surface lists a command with a stale status label.
- Surface lacks one required safety phrase but includes the others.
- Example contains `api_key = demo`, a credential-shaped value, or a private home path.
- Candidate scan path uses absolute path, parent traversal, unsupported extension, `.voidbrain/`, or fixture vault content outside the approved fixture root.

---

## 10. Dependencies

### External Libraries

- None planned. Use existing TypeScript, Bun, Vitest, Biome, and Node standard library APIs.

### Other Sessions

- **Depends on**: `phase00-session05-agent-surfaces-commands`, `phase01-session08-hot-cache-mvp-integration-validation`, `phase02-session01-recover-session-command`.
- **Depended by**: `phase02-session03-framework-update-preview-planner`, `phase02-session04-maintenance-recommendation-planner`, `phase02-session06-batch-source-ingestion-queue`, `phase02-session07-agentic-maintenance-integration-validation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
