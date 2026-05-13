# Staged Change Review and Apply

Voidbrain keeps note mutation local-first and review-first. Generated or
agent-proposed edits stay as staged changes until the user opens
`voidbrain.stage-change`, inspects the diff, and confirms any apply action.

## Review Model

The review service groups staged records by command ID, operation kind, status,
destructive flag, and target path. Each group exposes:

- Staged-change IDs, target path, destination path when present, source paths,
  rationale, and operation kind.
- Bounded before/after previews or diff lines for create, update, delete, move,
  and frontmatter-edit records.
- Conflict messages, validation output, backup path intent, and recovery
  details.
- Confirmation requirements for additive, update, destructive, overwrite, and
  batch actions.

## Apply Boundary

Apply uses Obsidian vault APIs. The runtime revalidates every selected record
immediately before mutation:

- Create fails closed when the target already exists.
- Update and frontmatter edit fail closed when the target is missing or the
  current before hash differs from the reviewed hash.
- Delete fails closed when the target is missing or stale.
- Move fails closed when the source is missing, stale, or the destination
  already exists.
- Duplicate active changes touching the same target or destination are blocked.

Delete, move, overwrite, and batch apply require exact confirmation text.
Destructive apply writes a `.voidbrain/staged-changes/` backup support record
before deleting or renaming a user note. Backup write failure stops the
destructive mutation.

## Recovery

Apply, reject, dismiss, conflict, and failure outcomes preserve command ID,
target path, staged-change ID, backup path intent, validation output, audit
entry IDs, and stable failure messages. Failed and conflicted records remain
inspectable and retryable until dismissed.

Index refresh is triggered after successful apply with a timeout and retry.
Refresh failure is reported as retryable recovery context and does not hide a
completed vault mutation.

## Limitations

There is no auto-apply mode. Remote sync conflict resolution, vault health
repair staging, and hot cache integration are handled by later workflows.
Provider calls are not part of staged-change review/apply.
