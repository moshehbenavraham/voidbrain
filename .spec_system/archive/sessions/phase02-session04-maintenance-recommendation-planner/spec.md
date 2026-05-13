# Session Specification

**Session ID**: `phase02-session04-maintenance-recommendation-planner`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Created**: 2026-05-13
**Validated**: 2026-05-13

---

## 1. Session Overview

This session adds a local maintenance recommendation planner that turns existing vault health findings, index freshness, retrieval evidence, citation state, and staged-change readiness into a prioritized repair queue. The planner does not edit notes directly. It produces bounded recommendation records with affected paths, evidence, confidence, severity, recovery details, and explicit stageability so users can inspect proposed maintenance before any vault mutation exists.

The work matters because Phase 02 shifts Voidbrain from isolated maintenance tools into an inspectable agentic maintenance system. Health reports already identify broken wikilinks, orphans, stale indexes, missing citations, and content gaps; this session makes those findings actionable by ranking them, attaching traceable evidence, and routing deterministic safe repairs through existing staged-change flows.

The implementation fits current project conventions by keeping Obsidian lifecycle wiring in `src/main.ts`, placing planner and runtime logic under `src/agent/`, defining public contracts under `src/types/`, using synthetic fixture vault data under `test/fixtures/vault/`, and preserving local-first, provider-free, review-first behavior.

---

## 2. Objectives

1. Define typed maintenance recommendation contracts for ranked findings, evidence, confidence, stageability, and recovery details.
2. Implement a deterministic planner that combines vault health findings, index freshness, retrieval evidence, citation gaps, and active staged-change state.
3. Route deterministic safe repair proposals through existing staged-change services while keeping unsafe or ambiguous findings report-only.
4. Add runtime status summaries so health, retrieval, staged-change, and recommendation state stay synchronized.
5. Add synthetic fixture tests for ranking, citation evidence, report-only behavior, duplicate prevention, and staged repair handoff.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides index freshness snapshots, retrieval readiness, and local indexing status.
- [x] `phase01-session04-grounded-vault-chat` - Provides retrieval result contracts with vault paths, headings, snippets, scores, and source paths.
- [x] `phase01-session06-staged-change-review-apply` - Provides staged-change records, duplicate detection, review diffs, recovery details, and apply boundaries.
- [x] `phase01-session07-vault-health-repair-staging` - Provides health findings, report export, safe citation repair staging, and report-only classification.
- [x] `phase02-session01-recover-session-command` - Provides local recovery expectations over cache paths, report IDs, target paths, staged-change IDs, and validation output.
- [x] `phase02-session03-framework-update-preview-planner` - Confirms dry-run framework updates and command surface synchronization are complete before broader maintenance planning.

### Required Tools/Knowledge

- TypeScript strict mode, Vitest, Bun validation scripts, existing vault health and staged-change services, index freshness contracts, retrieval result contracts, and synthetic fixture vaults.
- Project safety rules for local-first operation, provider review, citations, staged changes, redaction, dry-run framework behavior, and recoverable diagnostics.

### Environment Requirements

- Repository root with Bun dependencies installed.
- No provider calls are required for this session.
- Tests and examples must use `test/fixtures/vault/` or clearly fake paths only.
- Any note mutation produced by the planner must become a staged change and must not touch user vault files directly.

---

## 4. Scope

### In Scope (MVP)

- User can inspect a ranked maintenance queue derived from health, retrieval, index, citation, and staged-change state - implement deterministic recommendation records with severity, confidence, affected paths, evidence, and recovery details.
- User can distinguish safe staged repairs from ambiguous report-only findings - map missing-citation repairs to staged changes and keep broken wikilinks, broad orphans, stale indexes, and content gaps report-only unless deterministic evidence exists.
- User can see why a recommendation exists - include cited vault paths, headings where available, source records, report IDs, finding IDs, index IDs, staged-change IDs, issue codes, and validation context.
- User vault content remains protected - the planner reads supplied local records, does not call providers, does not write files, and only delegates repair creation to staged-change services.
- Runtime status stays synchronized - summarize recommendation counts and severity alongside health, retrieval, index, and staged-change readiness.

### Out of Scope (Deferred)

- Directly editing notes - Reason: all AI-proposed note mutations must remain staged for review.
- Fully autonomous background repair - Reason: Phase 02 requires inspectable maintenance proposals before action.
- Smart graph production UI - Reason: graph-focused suggestion UX belongs to later similar-note and placement work.
- Cloud-assisted recommendation generation - Reason: this session uses local health, retrieval, and index evidence only.
- Batch source ingestion or queue orchestration - Reason: session 06 owns multi-source ingestion queues.

---

## 5. Technical Approach

### Architecture

Create a pure recommendation planner in `src/agent/maintenance-recommendation-planner.ts` with typed inputs for `VaultHealthReport`, `IndexFreshnessSnapshot`, `RetrievalSearchResult`, `StagedChangeRecord`, and current note content needed for safe staged repair handoff. Keep the planner deterministic by normalizing recommendation IDs, sorting by severity, confidence, actionability, affected path, and source record, and limiting copied evidence to bounded, redacted summaries.

Add public contracts in `src/types/maintenance.ts`. Recommendation records should include a stable recommendation ID, category, severity, confidence, rank, affected paths, evidence records, source records, stageability, recovery details, and optional staged-change result references. Recovery details should preserve command ID, report ID, finding ID, index ID, retrieval result ID, target path, staged-change ID, and validation output without raw note bodies or provider state.

For staged repair handoff, reuse `VaultHealthRuntimeService.stageSafeRepair` for deterministic missing-citation findings. The recommendation service should block duplicate in-flight recommendation staging and refuse staging when evidence is missing, when an active staged change already targets the path, or when the recommendation is report-only. Runtime status can be extended with an optional maintenance summary or a helper that projects recommendations into existing health and staged-change status messages.

### Design Patterns

- Pure planner with injected repair service: Ranking and evidence mapping stay testable without Obsidian.
- Fail-closed evidence requirements: Missing citations or source evidence prevent staging instead of creating weak repairs.
- Report-only by default: Ambiguous findings stay visible but non-mutating.
- Deterministic ranking: Equal recommendations sort by path and ID for stable output.
- Duplicate-trigger prevention: Repeated staging for the same recommendation is blocked while in flight and when an active staged change already exists.

### Technology Stack

- TypeScript 5.9 strict mode.
- Vitest 4 for planner, runtime service, fixture, and status coverage.
- Existing vault health, retrieval, index freshness, runtime status, and staged-change services.
- Bun validation scripts and Biome formatting.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/maintenance.ts` | Public recommendation, evidence, confidence, stageability, recovery, and staging result contracts | ~180 |
| `src/agent/maintenance-recommendation-planner.ts` | Deterministic planner and safe staged-repair handoff service | ~320 |
| `test/fixtures/vault/maintenance-recommendation-fixtures.ts` | Synthetic health, retrieval, index, staged-change, and note fixtures | ~220 |
| `test/maintenance-recommendation-planner.test.ts` | Planner ranking, evidence, report-only, duplicate prevention, and staged handoff tests | ~260 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/index.ts` | Export maintenance contracts if the type barrel is used by consumers | ~8 |
| `src/agent/index.ts` | Export recommendation planner constructors and helper types | ~16 |
| `src/types/runtime.ts` | Add optional maintenance recommendation status input and status area if needed | ~40 |
| `src/agent/runtime-status.ts` | Summarize recommendation counts, stageable items, report-only items, and blocked staged changes | ~90 |
| `test/runtime-status.test.ts` | Cover recommendation status synchronization with health, index, and staged changes | ~70 |
| `test/agent-surfaces-commands.test.ts` | Preserve command catalog compatibility when maintenance recommendations extend health-check behavior | ~25 |
| `docs/vault-health-repair-staging.md` | Document recommendation planner behavior, citations, recovery details, and staged-change handoff | ~70 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Recommendation planning returns a deterministic ranked queue for health, retrieval, index freshness, citation, and staged-change inputs.
- [ ] Each recommendation includes affected paths, evidence, confidence, severity, source records where available, recovery details, and a report-only or stageable decision.
- [ ] Missing citation or source evidence prevents staged repair creation and records validation output.
- [ ] Deterministic safe repairs are staged through existing staged-change services and unsafe findings remain report-only.
- [ ] Duplicate active staged changes or duplicate in-flight recommendation staging are blocked with recovery details.
- [ ] Runtime status surfaces recommendation totals without exposing raw note bodies, provider secrets, hidden provider state, or private diagnostics.

### Testing Requirements

- [ ] Unit tests cover recommendation ranking, confidence scoring, evidence mapping, deterministic ordering, and report-only findings.
- [ ] Unit tests cover missing-citation staged repair handoff, duplicate active staged changes, in-flight duplicate prevention, and validation failures.
- [ ] Runtime status tests cover recommendation summaries synchronized with health, index, and staged-change readiness.
- [ ] Fixture safety tests cover all new synthetic fixtures.
- [ ] Manual validation commands completed from the repository root.

### Non-Functional Requirements

- [ ] Planner remains local-first, provider-free, deterministic, and read-only until a staged repair is explicitly requested.
- [ ] No user vault content, provider secrets, hidden provider state, authorization headers, or private diagnostics are written to docs, fixtures, logs, screenshots, or generated examples.
- [ ] Recovery details include command ID, report ID, finding ID, target path, staged-change ID when present, index ID when present, and validation output needed for retry or discard.
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

- Recommendations are not note edits. They are inspectable proposals with evidence and recovery details.
- The first deterministic staged repair should reuse missing-citation health repair behavior. Other categories should stay report-only unless the implementation can prove a safe edit from local evidence.
- Retrieval evidence must cite paths, headings when present, source paths, result IDs, and scores. Do not copy unbounded snippets into durable recommendation records.
- Index recommendations should point to rebuild guidance or stale paths, not create staged note mutations.
- Command catalog compatibility should be preserved unless a new command is explicitly introduced in a later session.

### Potential Challenges

- Combining health severity and retrieval confidence can make ranking opaque: expose rank reasons and keep scoring weights small and documented in code.
- Ambiguous findings may tempt over-staging: default to report-only unless source evidence and target content make the repair deterministic.
- Active staged changes can make a valid recommendation temporarily blocked: include the conflicting staged-change ID and target path in recovery details.
- Runtime status can become noisy: summarize counts and sample paths instead of embedding full recommendation bodies.

### Relevant Considerations

- [P01] **Recovery surface gap**: Recommendation records must preserve IDs, paths, validation output, and staged-change IDs without raw note bodies.
- [P01] **Workflow drift risk**: Session planning, state, docs, and validation artifacts must stay synchronized.
- [P01] **Disclosure gates stay mandatory**: This planner must not call providers or send vault content anywhere.
- [P01] **Redaction must remain fail-closed**: Fixtures, recommendation summaries, recovery details, and reports must exclude secrets and private diagnostics.
- [P01] **Review-first mutations**: Safe repairs flow through staged review/apply paths with backup intent and conflict revalidation.
- [P01] **Framework-vault separation**: Recommendation planning must not treat framework docs or support records as user vault notes unless supplied as synthetic fixtures.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- A recommendation stages a repair without enough citation or source evidence.
- Ambiguous broken link, orphan, stale index, or content gap findings are accidentally converted into direct edits.
- Duplicate recommendation staging creates multiple active staged changes for the same target path.
- Recommendation summaries leak raw note bodies, provider secrets, private paths, or hidden provider state.
- Runtime status drifts from health, index, retrieval, and staged-change readiness.

---

## 9. Testing Strategy

### Unit Tests

- Test ranked recommendations for broken wikilinks, orphan notes, stale indexes, missing citations, content gaps, and retrieval evidence.
- Test confidence and severity mapping for health findings, index freshness states, retrieval scores, source paths, and active staged changes.
- Test deterministic ordering by severity, stageability, confidence, affected path, and recommendation ID.
- Test report-only decisions for ambiguous findings and rebuild-index recommendations.
- Test staged missing-citation repair handoff through `VaultHealthRuntimeService.stageSafeRepair`.
- Test duplicate active staged-change blocking and duplicate in-flight recommendation staging cleanup.

### Integration Tests

- Test runtime status composition with a recommendation plan, health report, stale index snapshot, and active staged changes.
- Test agent surface and command catalog regression coverage to ensure recommendations extend existing health behavior without introducing stale command IDs.

### Manual Testing

- Run the recommendation planner tests against synthetic fixture vault data.
- Inspect a generated recommendation plan for redacted evidence, stable rank ordering, and recovery fields.
- Stage one deterministic missing-citation recommendation and verify it produces a review-ready staged change without applying it.

### Edge Cases

- Empty health report with stale index snapshots.
- Retrieval search result with no matches or failed readiness.
- Missing source-path evidence for a citation-related recommendation.
- Active staged change already targeting the same note.
- Malformed vault path, unsupported support path, or `.voidbrain` support record supplied as a target.

---

## 10. Dependencies

### External Libraries

- None expected. Use existing TypeScript, Vitest, Bun, and project services.

### Internal Dependencies

- `src/agent/vault-health.ts`
- `src/agent/vault-health-runtime-service.ts`
- `src/agent/staged-change-service.ts`
- `src/agent/runtime-status.ts`
- `src/vectorstore/retrieval-service.ts`
- `src/types/health.ts`
- `src/types/retrieval.ts`
- `src/types/staged-review.ts`
- `src/types/vault.ts`

### Other Sessions

- Depends on: `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session04-grounded-vault-chat`, `phase01-session06-staged-change-review-apply`, `phase01-session07-vault-health-repair-staging`, `phase02-session01-recover-session-command`, `phase02-session03-framework-update-preview-planner`
- Depended by: `phase02-session05-similar-note-placement-suggestions`, `phase02-session07-agentic-maintenance-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
