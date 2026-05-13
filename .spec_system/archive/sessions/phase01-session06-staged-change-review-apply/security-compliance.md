# Security and Recovery Checklist

**Session ID**: `phase01-session06-staged-change-review-apply`
**Created**: 2026-05-13 04:04
**Last Updated**: 2026-05-13 05:31

---

## Required Controls

- [x] Local-first review/apply workflow only; no provider calls or cloud disclosure paths.
- [x] User vault notes remain unchanged until explicit confirmation is present.
- [x] Delete, move, overwrite, and batch apply require stronger confirmation than additive create.
- [x] Destructive apply writes backup support records before mutating user notes.
- [x] Audit entries preserve command ID, target path, staged-change ID, action, outcome, and validation output.
- [x] Rejected, dismissed, conflicted, and failed records retain recovery metadata for inspection or retry.
- [x] Failed apply output preserves target path, staged-change ID, backup path intent, and validation output.
- [x] Documentation, fixtures, logs, and tests use synthetic paths and contain no provider secrets.
- [x] Runtime apply uses Obsidian vault and adapter APIs instead of arbitrary filesystem writes.
- [x] Index refresh failures are visible and recoverable without hiding completed apply results.

## Session Risks

- Duplicate apply triggers can mutate a target twice unless in-flight IDs are guarded.
- Stale target content can cause data loss unless current hashes are rechecked immediately before mutation.
- Partial batch success can hide recovery context unless outcomes are per-record.
- Backup support writes can fail before destructive mutations and must stop the mutation.
- Modal re-entry can show stale selected records unless state is reset or revalidated.

## Fixture Boundary

Use only `test/fixtures/vault/` content and clearly synthetic paths such as `sources/demo-article.md`, `summaries/demo-article-summary.md`, and `.voidbrain/staged-changes/*.backup.md`.

## Validation Result

- [x] Agent surface validation passed.
- [x] Fixture safety validation passed.
- [x] Agent docs validation passed.
- [x] Full local validation passed.
- [x] No provider call or cloud disclosure path was introduced.
- [x] No provider secrets, hidden provider state, or private paths were added to fixtures, docs, or tests.
