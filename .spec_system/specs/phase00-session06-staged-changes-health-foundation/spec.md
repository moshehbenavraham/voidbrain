# Session Specification

**Session ID**: `phase00-session06-staged-changes-health-foundation`
**Phase**: 00 - Foundation
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session implements the foundational staged-change and vault-health primitives that make AI-created note mutations inspectable before any user vault file is touched. It turns the current data-model contracts into service-level behavior for proposed note creates, updates, deletes, moves, and frontmatter edits.

The work also adds a fixture-based health scanner skeleton for the first safety checks that matter to local-first vault workflows: orphan notes, broken wikilinks, stale indexes, and missing citations. These are pure domain services, not UI flows or destructive apply workflows.

This is the final Phase 00 foundation session. It builds on the repository scaffold, vault data model, provider privacy boundaries, indexing foundation, and agent command surfaces so later MVP sessions can implement chat, ingestion, and maintenance workflows without bypassing staged review.

---

## 2. Objectives

1. Represent every AI-proposed note mutation as a staged change with review, conflict, and recovery metadata.
2. Expose before and after diff context for existing note edits without applying changes directly to user vault files.
3. Produce deterministic vault health reports for fixture notes covering orphans, broken links, stale indexes, and missing citations.
4. Add regression tests proving destructive or conflicting changes stay in explicit review paths.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session01-repo-tooling-scaffold` - Provides Bun, Vite, Vitest, Biome, Svelte Check, and baseline validation commands.
- [x] `phase00-session02-vault-data-model` - Provides vault artifact contracts, synthetic fixtures, runtime state, and staged-change support records.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides local-first privacy and secret-handling boundaries.
- [x] `phase00-session04-indexing-retrieval-foundation` - Provides parsed note, wikilink, source fingerprint, and index freshness contracts.
- [x] `phase00-session05-agent-surfaces-commands` - Provides command catalog language for health check, stage change, and recovery workflows.

### Required Tools/Knowledge

- TypeScript strict-mode domain services and discriminated unions.
- Vitest fixture-based tests using `test/fixtures/vault/`.
- Existing parser, path validation, runtime-state validation, and index freshness helpers.
- Local-first staged-write policy from `AGENTS.md` and `.spec_system/CONVENTIONS.md`.

### Environment Requirements

- Run from repository root.
- Use Bun and existing package scripts.
- Keep examples synthetic and bounded to `test/fixtures/vault/`.
- Do not call live providers or send vault content to cloud services.

---

## 4. Scope

### In Scope (MVP)

- Agent can stage proposed note creates, updates, deletes, moves, and frontmatter edits - add typed contracts and service builders for reviewable proposed mutations.
- User can inspect proposed changes before apply - preserve before content, after content, diff context, operation kind, target path, source paths, and rationale.
- User can recover failed or rejected mutation work - capture command ID, staged-change ID, target path, backup path intent, conflict state, and validation output.
- Developer can scan a synthetic fixture vault for health issues - produce a deterministic report for orphan notes, broken wikilinks, stale indexes, and missing citations.
- Agent command surfaces can rely on actual primitives - keep command behavior local-first, staged, and non-destructive until later apply workflows exist.

### Out of Scope (Deferred)

- Complete staged-change review UI - *Reason: this session implements pure primitives; UI review belongs in a later Svelte view session.*
- Applying staged changes to user vault files - *Reason: apply behavior needs explicit confirmation design and Obsidian runtime wiring.*
- Automated repair of unsafe findings - *Reason: health findings must remain report-only until safe repair staging is specified.*
- Live provider calls, embedding rebuilds, or answer synthesis - *Reason: this session has no provider disclosure workflow.*
- Full Obsidian command execution for health or stage-change commands - *Reason: command runtime orchestration follows after primitives are stable.*

---

## 5. Technical Approach

### Architecture

Extend the durable vault contracts first, then build pure services over those contracts. Staged-change logic belongs under `src/agent/` because it is used by agent workflows and can be tested without Obsidian. Health report types live in `src/types/health.ts`, while health scanning logic lives in `src/agent/vault-health.ts` and consumes parsed notes, runtime state, and freshness snapshots produced by existing vectorstore helpers.

The staged-change service should validate vault-relative paths, compute deterministic content hashes, produce reviewable before and after content, mark conflict states, and record recovery metadata. It must not write to target notes. Health scanning should return deterministic issue lists with severity, kind, affected paths, evidence, and suggested staged or report-only remediation.

### Design Patterns

- Discriminated unions: model staged operations, health finding kinds, conflict states, and recovery outcomes exhaustively.
- Pure service functions: keep domain behavior testable without Obsidian runtime APIs.
- Fail-closed validation: return structured issues for unsafe paths, missing content, conflict states, stale indexes, and missing citations.
- Deterministic sorting: keep health reports, diffs, and validation output stable across runs.

### Technology Stack

- TypeScript 5.9.3 for strict typed contracts and services.
- Vitest 4.0.18 for unit and fixture integration tests.
- Existing Obsidian-compatible vault path and markdown parser utilities.
- Existing lexical index freshness and fixture vault support data.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/health.ts` | Vault health report, finding, severity, evidence, and remediation contracts. | ~110 |
| `src/agent/staged-change-service.ts` | Pure staged-change builders, diff context, conflict detection, and recovery metadata helpers. | ~260 |
| `src/agent/vault-health.ts` | Fixture-safe health scanner for orphans, broken links, stale indexes, and missing citations. | ~230 |
| `docs/staged-changes-health-foundation.md` | Human-readable contract summary for staged changes and health checks. | ~120 |
| `test/staged-change-service.test.ts` | Regression tests for staging, conflicts, destructive review, and recovery metadata. | ~220 |
| `test/vault-health.test.ts` | Regression tests for health findings on synthetic fixture vault data. | ~200 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/vault.ts` | Expand staged-change operation, status, conflict, diff, and recovery contracts. | ~80 |
| `src/utils/vault-validation.ts` | Validate expanded staged-change records and reject unsafe support metadata. | ~90 |
| `src/agent/index.ts` | Export staged-change and health primitives. | ~12 |
| `src/agent/command-catalog.ts` | Update health and stage-change command notes to reference scaffolded primitives without claiming full runtime apply behavior. | ~20 |
| `docs/vault-data-model.md` | Document expanded staged-change support records and report-only health behavior. | ~80 |
| `docs/agent-surfaces-commands.md` | Clarify that health and staged-change primitives are scaffolded while apply workflows remain deferred. | ~50 |
| `test/fixtures/vault/.voidbrain/runtime-state.json` | Update synthetic staged-change fixture with expanded recovery and diff metadata. | ~40 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] AI-proposed note mutations are represented as staged changes before any apply path exists.
- [ ] Existing note edits expose before content, after content, content hashes, and conflict metadata.
- [ ] Delete and move operations are marked as destructive review paths and are never auto-applied.
- [ ] Health findings include affected vault paths, finding kind, severity, evidence, and remediation guidance.
- [ ] Stale index, broken link, orphan note, and missing citation cases are covered by deterministic fixture reports.

### Testing Requirements

- [ ] Unit tests written and passing for staged-change service behavior.
- [ ] Unit tests written and passing for vault health scanner behavior.
- [ ] Fixture runtime state remains valid after staged-change schema expansion.
- [ ] Manual review confirms no provider secrets, private paths, or real vault content in examples.

### Non-Functional Requirements

- [ ] Privacy: no vault content leaves the local process and no provider call is made.
- [ ] Reliability: mutation workflows remain staged, diffable, and recoverable before apply.
- [ ] Security: support records and docs contain zero provider secrets, tokens, raw authorization headers, or hidden provider state.
- [ ] Quality: generated reports and staged-change IDs are deterministic for fixture inputs.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes

---

## 8. Implementation Notes

### Key Considerations

- The vault remains the durable source of truth; service output may describe a target note but must not write it.
- Existing `StagedChangeRecord` is intentionally narrow and should be expanded without breaking synthetic fixture validation.
- Health checks should reuse parser output for wikilinks and source traceability instead of reparsing markdown ad hoc.
- Recovery details must preserve command ID, target path, staged-change ID, and validation output needed for retry.

### Potential Challenges

- Expanded staged-change schema may invalidate the runtime fixture: update tests and fixture data together.
- Delete and move operations can imply destructive behavior: model them as staged records only and include explicit review flags.
- Missing citation detection can overreach: restrict MVP behavior to generated notes with source-path and citation expectations already present in fixtures.
- Health scanner could become too broad: keep this session to deterministic fixture-level report primitives.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- Duplicate staging calls could produce conflicting staged records for the same target path.
- Revisited staged records could show stale before content if the target note changed after staging.
- Health reports could hide important path evidence or return nondeterministic issue ordering.

---

## 9. Testing Strategy

### Unit Tests

- Staged create, update, delete, move, and frontmatter edit builders validate paths and preserve operation-specific metadata.
- Diff context includes before and after content hashes for existing note edits.
- Conflict detection marks missing targets, path collisions, stale before hashes, and duplicate in-flight staging.
- Recovery metadata preserves command ID, staged-change ID, target path, status, and validation output.

### Integration Tests

- Fixture runtime state validates with expanded staged-change records.
- Health scanner consumes synthetic fixture notes and runtime state to report broken wikilinks, stale indexes, orphans, and missing citations.
- Command catalog and documentation validation continue to pass with updated primitive status language.

### Manual Testing

- Run the local validation commands from the repository root.
- Review docs and fixtures for secret-like values, private path hints, and accidental real vault examples.
- Inspect generated health report ordering for stable path and finding ordering.

### Edge Cases

- Empty, absolute, URL-like, or traversal target paths.
- Update or delete staged against a missing existing note.
- Create staged against an existing note path collision.
- Existing note changed after staged before hash was captured.
- Generated summary lacks citations even though it references source paths.
- Index metadata contains missing, extra, or changed source fingerprints.

---

## 10. Dependencies

### External Libraries

- None planned. Use the existing TypeScript, Vitest, and repository utilities.

### Other Sessions

- **Depends on**: `phase00-session01-repo-tooling-scaffold`, `phase00-session02-vault-data-model`, `phase00-session03-provider-privacy-boundaries`, `phase00-session04-indexing-retrieval-foundation`, `phase00-session05-agent-surfaces-commands`
- **Depended by**: Phase 01 chat with vault, source ingestion, review UI, vault maintenance, health check, and recovery workflows.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
