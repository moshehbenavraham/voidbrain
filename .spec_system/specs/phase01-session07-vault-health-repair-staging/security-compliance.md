# Security and Recovery Checklist

**Session ID**: `phase01-session07-vault-health-repair-staging`
**Created**: 2026-05-13 04:44
**Last Updated**: 2026-05-13 05:07

---

## Scope

This checklist applies to the `voidbrain.health-check` runtime workflow, grouped health reports, markdown report export, status summaries, and safe repair staging. The workflow is local-first and must not call providers or send vault content outside the Obsidian runtime.

## Privacy Boundaries

- [x] Health scans read local markdown notes and index freshness only.
- [x] Provider calls are out of scope for this session.
- [x] Exported reports include paths, finding summaries, bounded evidence, remediation, command IDs, and recovery context only.
- [x] Exported reports exclude raw private note bodies, provider secrets, authorization headers, raw hidden provider state, and private diagnostics.
- [x] Tests and docs use `test/fixtures/vault/` synthetic notes or clearly fake paths.

## Mutation Boundaries

- [x] Health findings are report-only by default.
- [x] Safe repairs must become staged-change records with before/after diffs and review metadata.
- [x] No health workflow applies note mutations directly.
- [x] Broken wikilinks, broad orphans, stale indexes, and content gaps remain report-only unless a later user-confirmed workflow defines a deterministic repair.
- [x] Duplicate repair staging is blocked while an action is in flight and when an active staged change already targets the same path.

## Recovery Requirements

- [x] Scan failures preserve command ID `voidbrain.health-check`, validation output, and affected target paths where available.
- [x] Export failures preserve report ID, export path, command ID, and validation output.
- [x] Repair staging results preserve finding ID, target path, staged-change ID when created, command ID, and validation output.
- [x] Runtime status includes latest report ID, generated time, finding counts, and bounded affected path samples without note bodies.
- [x] Modal and store state reset on re-entry so stale results are visible and recoverable instead of silently reused.

## Validation Notes

- Run `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate`.
- Record residual failures in `implementation-notes.md` with command, target path, staged-change ID when applicable, and validation output.

## Final Validation

- [x] `bun run validate:agent-surfaces` passed.
- [x] `bun run validate:fixture-safety` passed.
- [x] `bun run validate:agent-docs` passed.
- [x] `bun run validate` passed.
