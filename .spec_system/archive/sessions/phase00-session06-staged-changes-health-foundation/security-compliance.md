# Security and Recovery Checklist

**Session ID**: `phase00-session06-staged-changes-health-foundation`
**Created**: 2026-05-13
**Status**: Complete

---

## Local-First Boundaries

- [x] No live provider calls are required for this session.
- [x] No vault content is sent to cloud providers.
- [x] Health scanner inputs are fixture-safe parsed notes and derived index snapshots.
- [x] Staged-change builders return reviewable records and do not write target notes.

## Provider Secret Safety

- [x] Durable support validation rejects secret-like field names.
- [x] Fixture and documentation examples must avoid API keys, tokens, passwords, authorization headers, and hidden provider state.
- [x] Recovery metadata stores command IDs, paths, validation output, and stable messages only.

## Staged-Change Safety

- [x] Proposed note mutations remain staged until a later apply workflow exists.
- [x] Delete and move operations require explicit destructive review metadata.
- [x] Existing note edits preserve before and after content hashes.
- [x] Conflict metadata is required for stale before content, missing targets, path collisions, and duplicate in-flight staging.

## Recovery Evidence

- [x] Staged records preserve `changeId`, command ID, target path, status, and validation output.
- [x] Backup path intent is metadata only; this session does not create backups or apply writes.
- [x] Rejected or failed apply states remain recoverable through the staged-change record.

## Validation Gates

- [x] `bun run validate:agent-surfaces`
- [x] `bun run validate:fixture-safety`
- [x] `bun run validate:agent-docs`
- [x] `bun run validate`

---

## Open Compliance Items

- None.
