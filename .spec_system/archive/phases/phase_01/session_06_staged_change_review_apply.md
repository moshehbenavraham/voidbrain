# Session 06: Staged Change Review and Apply

**Session ID**: `phase01-session06-staged-change-review-apply`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Build explicit review, conflict handling, confirmed apply, rejection, and recovery workflows for staged vault changes.

---

## Scope

### In Scope (MVP)

- Show staged changes grouped by thread, command, operation type, and target path.
- Provide before and after diffs for updates and full previews for creates.
- Require stronger confirmation for delete, move, overwrite, and batch apply actions.
- Apply accepted changes through Obsidian vault APIs with conflict checks, backup intent, audit trail, and index refresh.
- Keep rejected, failed, and conflicting staged changes recoverable until dismissed.

### Out of Scope

- Auto-apply of AI-proposed note mutations.
- Bulk destructive changes without per-session user confirmation.
- Sync conflict resolution across external Git remotes.

---

## Prerequisites

- [ ] Session 01 completed.
- [ ] Session 05 completed.
- [ ] Phase 00 staged-change service and health contracts are available.

---

## Deliverables

1. Staged-change review UI and state management.
2. Confirmed apply, reject, retry, and dismiss workflows.
3. Conflict detection for changed files, path collisions, missing targets, and permission failures.
4. Audit and recovery records preserving command ID, target path, staged-change ID, and validation output.

---

## Success Criteria

- [ ] Existing notes are changed only after explicit user confirmation.
- [ ] Destructive operations require stronger confirmation than additive writes.
- [ ] Failed applies preserve recoverable staged records and diagnostics.
- [ ] Index refresh is triggered or clearly queued after applied changes.
