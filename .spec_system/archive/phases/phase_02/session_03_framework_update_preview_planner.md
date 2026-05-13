# Session 03: Framework Update Preview Planner

**Session ID**: `phase02-session03-framework-update-preview-planner`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Harden `voidbrain.preview-framework-update` as a dry-run planner that reports
framework file actions, exclusions, conflicts, and recovery details without
touching user vault content.

---

## Scope

### In Scope (MVP)

- Normalize candidate framework paths and exclude user vault content, generated
  knowledge notes, cache records, provider secrets, and private diagnostics.
- Compare candidate framework files against current repository files and report
  create, update, skip, conflict, and excluded actions.
- Preserve duplicate in-flight preview protection and deterministic output.
- Add tests for path normalization, exclusions, conflict summaries, and dry-run
  behavior.

### Out of Scope

- Applying framework updates.
- Modifying user vault files.
- Fetching remote framework bundles without explicit user action.

---

## Prerequisites

- [ ] Phase 00 framework preview scaffold exists.
- [ ] Framework-vault separation rules are documented.
- [ ] Staged-change and backup primitives exist for future apply workflows.

---

## Deliverables

1. Dry-run framework update preview planner with conflict and exclusion output.
2. CLI script and runtime command behavior aligned with the command catalog.
3. Tests covering dry-run invariants, duplicate requests, and unsafe paths.

---

## Success Criteria

- [ ] Preview output lists planned framework actions and excluded user-content
      paths.
- [ ] Preview never writes files or stages note mutations.
- [ ] Unsafe paths and credential-like values fail closed.
- [ ] Agent surfaces clearly state that apply behavior remains out of scope.
