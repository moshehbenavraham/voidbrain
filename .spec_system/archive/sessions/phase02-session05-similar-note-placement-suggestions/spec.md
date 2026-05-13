# Session Specification

**Session ID**: `phase02-session05-similar-note-placement-suggestions`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session adds local, reviewable similar-note and placement suggestions to the Phase 02 maintenance system. It turns parsed vault metadata, local retrieval evidence, wikilinks, tags, headings, aliases, folders, and source-path relationships into ranked suggestion records that explain why notes appear related and what reviewable action might help.

The work matters because the existing maintenance recommendation planner can rank health, retrieval, index, citation, and staged-change findings, but it does not yet suggest richer knowledge-graph improvements such as related links, tag additions, aliases, or note placement. This session fills that gap without changing the local-first rule: suggestions are evidence records first, and any note mutation must become a staged change with diffs and recovery details.

The implementation fits the repository conventions by keeping Obsidian lifecycle wiring out of the planner, placing testable domain logic under `src/agent/`, defining public contracts under `src/types/`, using synthetic fixture vault data under `test/fixtures/vault/`, and preserving provider-free deterministic behavior unless a later workflow explicitly adds provider review.

---

## 2. Objectives

1. Define typed similar-note and placement suggestion contracts for candidate signals, evidence, confidence, stageability, recovery, and staging results.
2. Implement deterministic related-note ranking from lexical, semantic, wikilink, tag, heading, alias, folder, and source-path signals.
3. Generate reviewable wikilink, alias, tag, related-notes, folder, and frontmatter placement suggestions with local citations.
4. Stage accepted suggestions through existing staged-change services with duplicate prevention, before/after diffs, and recovery details.
5. Add command-facing/runtime summary and synthetic tests for ranking, citations, duplicate prevention, staging, and low-confidence handling.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides parsed markdown notes, lexical retrieval, semantic readiness, and index freshness contracts.
- [x] `phase01-session04-grounded-vault-chat` - Provides retrieval result records with paths, headings, source paths, snippets, scores, and failure states.
- [x] `phase01-session06-staged-change-review-apply` - Provides staged-change records, diffs, duplicate detection, review metadata, and apply boundaries.
- [x] `phase01-session07-vault-health-repair-staging` - Provides local health scanning, report-only safety defaults, and deterministic staged repair behavior.
- [x] `phase02-session04-maintenance-recommendation-planner` - Provides ranked maintenance recommendation patterns, bounded evidence, stageability, and runtime summary conventions.

### Required Tools/Knowledge

- TypeScript strict mode, Vitest, Bun validation scripts, existing markdown parser, retrieval result contracts, staged-change service, runtime status service, and synthetic fixture vaults.
- Project safety rules for local-first operation, citations, staged changes, redaction, provider secrets, fixture safety, and recoverable diagnostics.

### Environment Requirements

- Repository root with Bun dependencies installed.
- No provider calls are required for this session.
- Tests and examples must use `test/fixtures/vault/` or clearly fake paths only.
- Any suggested note mutation must become a staged change and must not touch user vault files directly.

---

## 4. Scope

### In Scope (MVP)

- User can inspect related-note candidates grounded in lexical, semantic, wikilink, tag, heading, alias, folder, and source-path signals - implement deterministic suggestion records with scores, evidence, and recovery details.
- User can review suggested wikilinks, aliases, tags, related-notes frontmatter, folder placement, and frontmatter placement - include citations to the source note, related note, headings, source records, and signal evidence.
- User can stage accepted link, tag, alias, related-notes, and placement suggestions through existing staged-change paths - use before/after diffs, duplicate prevention, conflict checks, and backup intent for move suggestions.
- User can see weak or ambiguous matches as low-confidence or report-only suggestions - avoid hiding uncertain signals while preventing unsafe edits.
- Developer can validate deterministic ranking, duplicate prevention, citation evidence, and staged diffs with synthetic fixture tests.

### Out of Scope (Deferred)

- Automatically reorganizing folders - Reason: placement changes must remain suggestions or explicit staged moves.
- Moving attachments - Reason: attachment movement needs stronger review and Obsidian attachment handling.
- Graph-only visual clustering - Reason: this session focuses on command-facing records and staged maintenance actions.
- Cloud-assisted similarity generation - Reason: local signals are sufficient for this session and provider review belongs to later provider hardening.
- Applying generated suggestions directly - Reason: all note mutations must remain staged and reviewable.

---

## 5. Technical Approach

### Architecture

Create public suggestion contracts in `src/types/suggestions.ts` and a pure planner plus staging service in `src/agent/similar-note-suggestion-service.ts`. The planner should accept parsed markdown notes, optional retrieval search results, optional semantic source signals, and current staged changes. It should emit a deterministic plan with related-note candidates, suggestion actions, evidence records, source records, confidence, rank reasons, stageability, and recovery metadata.

The planner should extract bounded local signals from existing contracts: note path, folder segments, frontmatter tags, aliases, related-notes, source-paths, headings, wikilinks, retrieval result paths, retrieval headings, retrieval source paths, and retrieval scores. It should never copy raw note bodies or unbounded snippets into durable suggestion records.

Accepted suggestions should route through `StagedChangeService`. Wikilink insertions can stage an `update-note` when the target note content is supplied. Tag, alias, and related-notes suggestions can stage `update-frontmatter` with a patch. Folder placement can stage a `move-note` only when the destination path is validated, the source note exists, and no active staged change already targets either path; otherwise the suggestion remains report-only or blocked.

Runtime status should expose a compact maintenance summary when a suggestion plan is supplied: total suggestions, high/medium/low confidence counts, stageable/report-only/blocked counts, and sample affected paths. The summary should stay command-facing without adding a new command ID unless a later session explicitly changes the command catalog.

### Design Patterns

- Pure planner with injected staged-change service: Ranking and evidence mapping stay testable without Obsidian.
- Signal evidence records: Every suggestion explains the local signals that produced it.
- Report-only by default: Ambiguous placement and weak matches stay visible but non-mutating.
- Deterministic ranking: Equal suggestions sort by confidence, score, path, action kind, and ID.
- Duplicate-trigger prevention: Existing wikilinks, aliases, tags, related-notes, destination paths, active staged changes, and in-flight stages block duplicates.

### Technology Stack

- TypeScript 5.9 strict mode.
- Vitest 4 for planner, staging, fixture, and runtime status coverage.
- Existing markdown parser, retrieval result contracts, staged-change service, runtime status service, and vault path utilities.
- Bun validation scripts and Biome formatting.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/suggestions.ts` | Public similar-note, placement, signal evidence, confidence, stageability, recovery, plan summary, and staging result contracts | ~220 |
| `src/agent/similar-note-suggestion-service.ts` | Deterministic suggestion planner, ranking helpers, duplicate checks, and staged-change handoff service | ~420 |
| `test/fixtures/vault/similar-note-suggestion-fixtures.ts` | Synthetic related-note, duplicate link, tag, alias, folder, frontmatter, retrieval, and staged-change fixtures | ~240 |
| `test/similar-note-suggestion-service.test.ts` | Planner ranking, citations, duplicate prevention, low-confidence, report-only, and staged handoff tests | ~320 |
| `docs/similar-note-placement-suggestions.md` | User and agent-facing behavior notes for local signals, citations, staged review, duplicate prevention, and recovery | ~120 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agent/index.ts` | Export suggestion service constructors and public suggestion types | ~24 |
| `src/types/runtime.ts` | Add optional similar-note suggestion status input under the maintenance/runtime status surface | ~40 |
| `src/agent/runtime-status.ts` | Summarize suggestion counts, confidence, stageability, blocked items, and sample paths without raw note bodies | ~100 |
| `test/runtime-status.test.ts` | Cover suggestion status synchronization with maintenance, staged changes, and sample paths | ~80 |
| `test/agent-surfaces-commands.test.ts` | Preserve command catalog compatibility when suggestion docs reference existing commands | ~20 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Suggestion planning returns a deterministic ranked plan for local note, retrieval, wikilink, tag, heading, alias, folder, and source-path evidence.
- [ ] Each suggestion includes source note path, related note path when applicable, headings where available, signal evidence, confidence, rank reasons, stageability, and recovery details.
- [ ] Existing wikilinks, aliases, tags, related-notes frontmatter values, and active staged changes are not duplicated.
- [ ] Accepted wikilink, tag, alias, related-notes, and placement suggestions become staged changes before any vault mutation.
- [ ] Weak or ambiguous matches remain visible as low-confidence or report-only suggestions with explicit reasons.
- [ ] Runtime status surfaces suggestion totals without exposing raw note bodies, provider secrets, hidden provider state, or private diagnostics.

### Testing Requirements

- [ ] Unit tests cover signal extraction, ranking, confidence scoring, deterministic ordering, citations, and bounded evidence.
- [ ] Unit tests cover duplicate prevention for wikilinks, aliases, tags, related-notes, destination paths, active staged changes, and in-flight stages.
- [ ] Unit tests cover staged handoff for note updates, frontmatter edits, placement moves, report-only suggestions, and validation failures.
- [ ] Runtime status tests cover suggestion summaries alongside maintenance and staged-change state.
- [ ] Fixture safety tests cover all new synthetic fixtures.

### Non-Functional Requirements

- [ ] Planner remains local-first, provider-free, deterministic, and read-only until a suggestion is explicitly staged.
- [ ] No user vault content, provider secrets, hidden provider state, authorization headers, or private diagnostics are written to docs, fixtures, logs, screenshots, or generated examples.
- [ ] Recovery details include command ID, source path, related path, target path, destination path when present, staged-change ID when present, and validation output needed for retry or discard.
- [ ] Results remain stable across repeated runs with the same input records.

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

- Similar-note suggestions are proposals, not edits. They should explain evidence and confidence before any staged-change handoff.
- Local retrieval snippets should inform ranking but should not be copied into durable suggestion records.
- Folder placement suggestions should validate destination paths and avoid direct moves. Staging a move still requires review and conflict checks.
- Frontmatter edits should preserve existing values and append only missing, normalized entries.
- Command catalog compatibility should be preserved unless a later session explicitly introduces a new command.

### Potential Challenges

- Similarity scoring can become opaque: expose concise rank reasons and keep weights deterministic.
- Suggested links can duplicate existing relationships under aliases: normalize path, alias, and wikilink targets before staging.
- Placement suggestions can look like automatic reorganization: keep them report-only until explicitly staged and make conflicts visible.
- Runtime status can become noisy: summarize counts and sample paths instead of embedding full suggestion records.

### Relevant Considerations

- [P01] **Workflow drift risk**: Session planning, state, docs, and validation artifacts must stay synchronized.
- [P01] **Obsidian runtime variance**: Keep planner logic pure and testable; use runtime APIs only at integration boundaries.
- [P01] **Disclosure gates stay mandatory**: This session must not call providers or send vault content anywhere.
- [P01] **Redaction must remain fail-closed**: Fixtures, suggestion summaries, recovery details, and docs must exclude secrets and private diagnostics.
- [P01] **Review-first mutations**: Accepted suggestions flow through staged review/apply paths with backup intent and conflict revalidation.
- [P01] **Duplicate prevention**: Guard staged changes, existing relationships, and in-flight stages to avoid repeated suggestions or repeated staged diffs.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- A suggestion stages a link, tag, alias, related-note, or move without enough local evidence.
- Duplicate relationships are created because existing wikilinks, aliases, tags, or frontmatter values were not normalized.
- Placement suggestions mutate a note path directly instead of using staged review.
- Suggestion summaries leak raw note bodies, provider secrets, private paths, or hidden provider state.
- Runtime status drifts from staged-change and maintenance readiness.

---

## 9. Testing Strategy

### Unit Tests

- Test signal extraction from parsed notes for wikilinks, tags, headings, aliases, source paths, folders, and frontmatter values.
- Test related-note ranking from mixed lexical, semantic, wikilink, tag, heading, folder, and source-path evidence.
- Test deterministic ordering by confidence, score, source path, related path, action kind, and suggestion ID.
- Test low-confidence and report-only behavior for weak or ambiguous matches.
- Test staged wikilink updates, frontmatter tag/alias/related-notes edits, and placement moves through `StagedChangeService`.
- Test duplicate active staged-change blocking and in-flight duplicate staging cleanup.

### Integration Tests

- Test runtime status composition with a suggestion plan, maintenance recommendation plan, and active staged changes.
- Test agent surface command catalog regression coverage so suggestion docs do not introduce stale command IDs.

### Manual Testing

- Run a synthetic fixture suggestion plan and inspect ranked output, citations, stageability, and recovery details.
- Stage one accepted wikilink/frontmatter suggestion and inspect the before/after diff without applying it.

### Edge Cases

- Source note already links to the related note through an alias.
- Suggested tag differs only by case or leading `#`.
- Related-notes frontmatter has an existing path in a different order.
- Destination path already exists or an active staged change targets the same note.
- Retrieval evidence is unavailable, stale, or low scoring.

---

## 10. Dependencies

### External Libraries

- None. Use existing TypeScript, Vitest, markdown parser, retrieval, staged-change, and runtime status utilities.

### Other Sessions

- **Depends on**: `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session04-grounded-vault-chat`, `phase01-session06-staged-change-review-apply`, `phase01-session07-vault-health-repair-staging`, `phase02-session04-maintenance-recommendation-planner`
- **Depended by**: `phase02-session06-batch-source-ingestion-queue`, `phase02-session07-agentic-maintenance-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
