# Session 02: Agent Surface Validation Hardening

**Session ID**: `phase02-session02-agent-surface-validation-hardening`
**Status**: Complete
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Harden `voidbrain.validate-agent-surfaces` into a fail-closed local validation
workflow for command IDs, safety language, fixture-safe examples, and stale
agent documentation.

---

## Scope

### In Scope (MVP)

- Validate AGENTS, CLAUDE, GEMINI, the Voidbrain skill, docs, and command
  catalog references against one canonical command source.
- Fail on stale command IDs, missing local-first or staged-change safety
  language, unsafe examples, private path hints, and credential-like values.
- Emit deterministic issue output with file paths, headings, command IDs, and
  remediation hints.
- Preserve read-only validation behavior and bounded repository scanning.

### Out of Scope

- Mutating agent surfaces automatically.
- Scanning user vault content outside known framework and fixture paths.
- Accepting live provider credentials as validation inputs.

---

## Prerequisites

- [x] Canonical command catalog exists under `src/agent/`.
- [x] Existing `validate:agent-surfaces`, `validate:fixture-safety`, and
      `validate:agent-docs` scripts run from the repository root.
- [x] Synthetic fixture paths are clearly separated from user vault content.

---

## Deliverables

1. Hardened validation service and script output for agent surfaces.
2. Expanded fixture safety and command drift tests.
3. Updated agent docs describing fail-closed validation behavior.

---

## Success Criteria

- [x] Validation returns deterministic nonzero failures for stale or unsafe
      agent surfaces.
- [x] Validation remains read-only and bounded to repository framework paths.
- [x] Tests cover stale command IDs, missing safety phrases, private path hints,
      and credential-like examples.
- [x] The command status is updated from scaffolded when implementation is
      validated.
