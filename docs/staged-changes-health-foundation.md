# Staged Changes and Health Foundation

This session adds pure domain primitives for reviewable note mutations and
fixture-safe vault health reports. The primitives are local-first and do not
call providers, mutate user notes, or apply staged changes.

## Staged Change Records

Every proposed note mutation is represented as a `staged-change` support
record before any user vault file can be changed. The record preserves:

- `changeId`, operation kind, status, target path, source paths, and rationale.
- Before and after content hashes for existing-note edits.
- Before and after content plus deterministic line diff context for review.
- Conflict records for missing targets, path collisions, stale before hashes,
  duplicate active staged changes, and validation failures.
- Destructive review metadata for deletes and moves.
- Recovery metadata with command ID, staged-change ID, target path, backup path
  intent, status, and validation output.

Supported operations are:

| Operation | Purpose | Review behavior |
|-----------|---------|-----------------|
| `create-note` | Propose a new markdown note. | Blocks when the target path already exists. |
| `update-note` | Propose replacing note content. | Blocks when the target is missing or the before hash changed. |
| `delete-note` | Propose deleting an existing note. | Always marked destructive and review-only. |
| `move-note` | Propose moving an existing note. | Always marked destructive and blocks on destination collision. |
| `update-frontmatter` | Propose a frontmatter-only edit. | Stores patch metadata and full diff context. |

The staged-change service validates vault-relative markdown target paths and
rejects `.voidbrain/` support records as mutation targets. Source paths are
normalized and required so review records remain traceable.

## Conflict And Recovery Behavior

Conflict detection is fail-closed. A staged record with blocking conflicts uses
`conflicted` status and includes recovery validation output. Non-conflicting
records use `review-ready` status and still require explicit review.

Backup path intent is metadata only in this foundation session. No backup file
is written and no apply workflow exists yet.

## Vault Health Reports

The vault health scanner consumes parsed markdown notes and index freshness
snapshots. It returns deterministic findings with affected paths, evidence, and
remediation guidance for:

- Orphan generated notes with no inbound wikilink or valid source trace.
- Broken wikilinks from parser output.
- Stale, missing, partial, or extra index fingerprints.
- Missing citations on source-grounded summaries.

Health reports are report-only. Suggested remediation may name
`voidbrain.stage-change`, but the scanner does not stage repairs or edit notes.

## Safety Boundaries

- Provider calls are out of scope.
- Examples and tests use `test/fixtures/vault/` synthetic content only.
- Provider secrets and hidden provider state are rejected by durable support
  validation.
- User-facing synthesis must still cite vault paths, headings, and source
  records when retrieval output is used.
- Destructive apply behavior remains deferred until a later explicit review
  workflow exists.
