# Session Specification

**Session ID**: `phase01-session07-vault-health-repair-staging`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session makes vault health checks usable from the Obsidian plugin runtime. The existing Phase 00 scanner already detects orphan notes, broken wikilinks, stale indexes, and missing citations from parsed notes and index freshness snapshots. This session wires those primitives into a user-facing command, report UI, markdown export, and status snapshot so users can inspect health findings without leaving the local vault workflow.

The work also introduces repair staging for findings that are deterministic and low risk. Safe repairs become normal staged-change records and must flow through the already implemented staged review/apply workflow. Ambiguous, destructive, or confidence-sensitive findings remain report-only so the plugin never guesses at a vault mutation.

The session fits between staged-change review/apply and hot cache validation. Session 06 made review and confirmed apply available; this session uses that safety boundary for health repair suggestions. Session 08 can then validate the complete MVP workflow with provider setup, indexing, chat, ingestion, staged review, health reporting, and recent context.

---

## 2. Objectives

1. Register and implement `voidbrain.health-check` as a local-first runtime workflow that scans the vault through Obsidian APIs.
2. Present grouped health findings with severity, type, affected paths, evidence, remediation, and recovery details.
3. Export deterministic markdown health reports and stage only safe repair suggestions through staged-change records.
4. Update command catalog, agent surfaces, docs, and tests so health behavior matches implemented runtime behavior.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session06-staged-changes-health-foundation` - Provides health scanner contracts, remediation kinds, staged-change builders, and deterministic fixture tests.
- [x] `phase01-session01-obsidian-runtime-settings` - Provides plugin lifecycle ownership, commands, status view, settings, and cleanup patterns.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides Obsidian markdown indexing, parser behavior, index freshness snapshots, and reindex controls.
- [x] `phase01-session06-staged-change-review-apply` - Provides the review/apply surface that health repair staging must use before any note mutation.

### Required Tools/Knowledge

- Existing `scanVaultHealth` behavior in `src/agent/vault-health.ts`.
- Existing `StagedChangeService` and staged review runtime behavior.
- Existing markdown parser and Obsidian index source helpers under `src/vectorstore/`.
- Obsidian vault, metadata cache, command, modal, notice, and adapter APIs.
- Vitest fixture and mock patterns under `test/`.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content from `test/fixtures/vault/` in tests and examples.
- Do not call live providers, fetch external sources, or send vault content to cloud providers.
- Do not write provider secrets, authorization headers, raw hidden provider state, private diagnostics, or raw private note bodies to docs, fixtures, logs, screenshots, or generated examples.
- Preserve the staged-write rule: health repairs are staged for review, never applied directly.

---

## 4. Scope

### In Scope (MVP)

- User can run a vault health check from the command palette and plugin UI - execute a local scan over markdown notes and current index freshness.
- User can inspect health findings grouped by severity, kind, affected path, evidence, and remediation - render a focused report UI with accessible controls.
- User can export a markdown health report - write deterministic, redacted, inspectable report content with paths and evidence but no provider secrets or raw hidden provider state.
- User can stage safe repairs for low-risk findings - create staged-change records for deterministic citation or source-trace fixes and route them through staged review/apply.
- User can see unsafe repairs remain report-only - broken links, broad orphans, stale indexes, and content gaps are reported with clear remediation rather than guessed edits.
- Developer can test scans, grouping, export, safe repair staging, report-only blocking, command handling, and status updates against synthetic fixtures.

### Out of Scope (Deferred)

- Autonomous repair apply - *Reason: apply must remain explicit through staged review and user confirmation.*
- Graph-based maintenance suggestions - *Reason: smart graph workflows are deferred beyond the MVP health command.*
- Multi-vault or team policy workflows - *Reason: MVP is a local Obsidian plugin for one vault.*
- Hot cache persistence of health state - *Reason: Session 08 owns recent context and full MVP reload validation.*
- Hosted provider analysis of health findings - *Reason: this session is local-only and does not need model calls.*

---

## 5. Technical Approach

### Architecture

Keep pure scanner logic in `src/agent/vault-health.ts` and extend it only with deterministic report grouping, content-gap detection, markdown export rendering, and repair-safety helpers. Add a runtime orchestration service under `src/agent/vault-health-runtime-service.ts` that can be tested without Obsidian UI code. The service should consume parsed notes, index freshness snapshots, and existing staged changes, then return a report, export result, or staged repair result with explicit validation output.

Runtime ownership remains in `src/main.ts`. The plugin reads markdown through Obsidian vault APIs, reuses current indexing runtime state for freshness, owns the latest health report state, and appends safe repair staged changes into the shared staged-change queue used by the review modal. The new health modal under `src/views/vault-health-modal.ts` should render the report and call service actions through a typed store, not mutate plugin state directly.

Command behavior should move `voidbrain.health-check` from planned placeholder to implemented runtime flow. The command opens the health report modal, scan actions remain local, export writes use plugin-owned support paths, and any repair suggestion must become a staged-change record before it can affect user notes.

### Design Patterns

- Local-first scan boundary: health checks read local vault/index state and never call providers.
- Review-first repair boundary: every generated repair is a staged change with diff, recovery, and later confirmation.
- Report-only default: ambiguous or unsafe findings do not create staged changes.
- Deterministic output: sorting, grouping, report IDs, exported markdown, and staged repair IDs stay stable for fixture inputs.
- Fail-closed validation: malformed paths, invalid frontmatter, export failures, duplicate repair staging, and scan failures return structured errors.
- Obsidian-owned runtime I/O: plugin runtime reads and writes through Obsidian vault and adapter APIs.

### Technology Stack

- TypeScript strict mode for health contracts, runtime service, store, and command wiring.
- Obsidian API for vault reads, report export support writes, commands, notices, and modal lifecycle.
- Existing vectorstore parser, index freshness, runtime status, staged-change service, and staged review workflow.
- Vitest with synthetic fixture vault content and Obsidian mocks.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/agent/vault-health-runtime-service.ts` | Runtime orchestration for scans, report export, safe repair staging, and report-only blocking. | ~360 |
| `src/stores/vault-health-store.ts` | UI state for health scan status, selected groups, export state, staged repair state, and re-entry reset. | ~220 |
| `src/views/vault-health-modal.ts` | Obsidian modal for health report scan, grouping, evidence, export, and staged repair actions. | ~380 |
| `docs/vault-health-repair-staging.md` | Human-readable health workflow, safety boundaries, report export, staged repair behavior, and limitations. | ~170 |
| `test/fixtures/vault/vault-health-runtime-fixtures.ts` | Synthetic fixtures for health reports, content gaps, safe repairs, and report-only findings. | ~260 |
| `test/vault-health-runtime-service.test.ts` | Runtime service tests for scan orchestration, export, safe repair staging, and report-only blocking. | ~360 |
| `test/vault-health-modal.test.ts` | Modal and store tests for loading, empty, error, offline, grouping, export, staging, and cleanup states. | ~320 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/health.ts` | Add content-gap finding kind, grouped report, markdown export, repair safety, action result, and runtime state contracts. | ~140 |
| `src/agent/vault-health.ts` | Add grouping, content-gap detection, redacted markdown export helpers, and deterministic remediation safety helpers. | ~220 |
| `src/agent/index.ts` | Export health runtime service and report utilities. | ~20 |
| `src/agent/command-catalog.ts` | Mark `voidbrain.health-check` implemented and update intent, outputs, notes, safety phrases, and recovery behavior. | ~70 |
| `src/agent/runtime-command-handlers.ts` | Add health command runtime options and implemented outcome for opening the health flow. | ~80 |
| `src/agent/runtime-status.ts` | Include latest health report details, affected path samples, and recovery guidance in status summaries. | ~80 |
| `src/main.ts` | Instantiate health service/store, open modal, scan vault notes, export reports, stage repairs, update status, and clean up. | ~260 |
| `src/styles.css` | Style health report modal groups, severity rows, evidence tables, export state, and action controls. | ~180 |
| `test/vault-health.test.ts` | Add grouping, content-gap, markdown export, and deterministic ordering coverage. | ~180 |
| `test/plugin-lifecycle.test.ts` | Cover health command registration, modal opening, scan/export/stage actions, status refresh, and cleanup. | ~220 |
| `AGENTS.md` | Synchronize implemented health-check behavior and safety language. | ~20 |
| `CLAUDE.md` | Synchronize implemented health-check behavior and safety language. | ~20 |
| `GEMINI.md` | Synchronize implemented health-check behavior and safety language. | ~20 |
| `skills/voidbrain/SKILL.md` | Synchronize health-check command behavior, safe examples, and recovery notes. | ~30 |
| `docs/agent-surfaces-commands.md` | Document implemented health-check flow, report export, staged repair limits, and recovery behavior. | ~90 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] `voidbrain.health-check` opens an implemented runtime health flow instead of a placeholder notice.
- [ ] Health scans read local markdown notes and index freshness through Obsidian-owned runtime paths.
- [ ] Reports include severity, kind, affected path, evidence, remediation, report ID, generated time, and scanned path count.
- [ ] Findings are grouped deterministically by severity, type, and affected path.
- [ ] Markdown report export produces redacted, deterministic content with no provider secrets or raw hidden provider state.
- [ ] Safe repair staging creates staged-change records only for deterministic low-risk repairs and routes them to staged review.
- [ ] Unsafe or ambiguous findings stay report-only and explain why no staged change was created.
- [ ] Runtime status includes the latest health report and sampled affected paths without raw note bodies.

### Testing Requirements

- [ ] Unit tests cover grouping, sorting, content-gap detection, markdown export, and scan failures.
- [ ] Unit tests cover safe repair staging, duplicate repair prevention, report-only blocking, and validation output.
- [ ] Modal/store tests cover loading, empty, error, offline, grouped report, export, staged repair, re-entry reset, and cleanup states.
- [ ] Plugin lifecycle tests cover command registration, modal opening, scan action, export action, repair staging, status refresh, and unload cleanup.
- [ ] Agent surface and fixture safety validation cover updated command catalog and synchronized docs.

### Non-Functional Requirements

- [ ] Privacy: no health workflow sends vault content to cloud providers.
- [ ] Security: exported reports and docs exclude provider secrets, tokens, authorization headers, raw hidden provider state, private diagnostics, and raw private note bodies.
- [ ] Reliability: repair suggestions are staged, diffable, and recoverable before any note mutation can occur.
- [ ] Performance: scan output is deterministic and bounded enough for fixture and MVP vault workflows.
- [ ] Accessibility: health report actions are keyboard reachable and labelled.
- [ ] Data portability: exported reports are readable markdown.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with recovery details

---

## 8. Implementation Notes

### Key Considerations

- The existing scanner already returns structured findings. This session should build on it rather than replacing the health model.
- Current runtime status accepts a `healthReport` input but the plugin does not yet generate one. The session should connect latest report state into status refreshes.
- Staged review/apply is implemented and should remain the only path from a repair suggestion to a vault mutation.
- Health report export is a user-requested support artifact, not a direct note repair. It still must be deterministic, redacted, and recoverable.
- Broken wikilinks and broad orphan findings are unsafe to auto-fix because the correct target or relationship may be ambiguous.
- Stale index findings should lead to a rebuild action or guidance, not a staged note edit.

### Potential Challenges

- Parsing live Obsidian notes can fail per path: preserve path diagnostics and continue where safe.
- Repair staging can duplicate existing staged changes: check active staged records before creating new repair records.
- Exporting a report can leak too much context: include paths, headings, evidence summaries, and remediation, but not raw note bodies.
- Scan results can become stale when the modal is reopened: reset/revalidate state on open and expose generated time.
- Large reports can overwhelm the modal: use grouped summaries and bounded evidence previews.

### Relevant Considerations

- [P00] **Tracker synchronization**: Update command catalog, docs, agent surfaces, tests, state, and session artifacts together.
- [P00] **Staged-write gap**: Health repair suggestions must use staged changes and never bypass review/apply.
- [P00] **Provider disclosure boundary**: Health checks are local-only and must not introduce provider calls.
- [P00] **Fixture safety**: Tests and examples must use synthetic fixture data and avoid secrets, personal data, private paths, and credential-like values.
- [P00] **Contract-first boundaries**: Keep scan, report, repair staging, UI state, and runtime I/O contracts separate.
- [P00] **Deterministic state models**: Report IDs, grouping, staged repair results, export paths, and validation output must be explicit and testable.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A user can trigger overlapping scans, exports, or repair staging and create duplicate state.
- A repair suggestion can be staged for an ambiguous finding that should remain report-only.
- An exported report can include raw note content, provider secrets, hidden provider state, or private diagnostics.
- The modal can show stale findings after the vault or index changes.
- A failed export or staging action can hide the report ID, target path, staged-change ID, or validation output needed for recovery.
- Health status can imply readiness even when no report has been generated.

---

## 9. Testing Strategy

### Unit Tests

- Test content-gap detection for generated notes with missing required summary structure and source trace evidence.
- Test report grouping by severity, kind, affected path, and stable finding ID.
- Test markdown export rendering for deterministic order, redaction, summary counts, evidence, and remediation.
- Test safe repair classification for missing citations or source traces that can be deterministically staged.
- Test report-only classification for broken links, broad orphans, stale indexes, and content gaps.

### Integration Tests

- Test `voidbrain.health-check` command registration opens the health modal.
- Test runtime scans parse synthetic Obsidian vault files and include index freshness evidence.
- Test export writes a markdown report to the intended support path and handles adapter write failures.
- Test safe repair staging adds staged-change records and refreshes staged-change/runtime status.
- Test plugin cleanup resets health store subscriptions and in-flight scan state.

### Manual Testing

- Open the health check command from Obsidian command palette.
- Run a scan on a synthetic fixture vault and inspect grouped findings.
- Export the report and verify it contains paths, evidence, remediation, and no raw note bodies or secrets.
- Stage one safe repair and confirm it appears in staged-change review rather than applying immediately.
- Confirm ambiguous findings remain report-only and index findings point to rebuild behavior.

### Edge Cases

- No markdown files exist.
- Parser fails for one file while other files remain scannable.
- Index freshness snapshot is missing.
- Report contains only informational findings.
- Export path already exists.
- Adapter write fails during report export.
- A safe repair is already staged for the same target.
- Staged repair validation fails because the target note changed.
- Modal closes while scan or export is in flight.
- Health status is hidden through settings.

---

## 10. Dependencies

### External Libraries

- No new external libraries planned.

### Other Sessions

- **Depends on**: `phase00-session06-staged-changes-health-foundation`, `phase01-session01-obsidian-runtime-settings`, `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session06-staged-change-review-apply`
- **Depended by**: `phase01-session08-hot-cache-mvp-integration-validation`, Phase 02 agentic maintenance workflows

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
