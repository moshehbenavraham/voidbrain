# Session 07: Vault Health Check and Repair Staging

**Session ID**: `phase01-session07-vault-health-repair-staging`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Surface vault health findings in the plugin, export inspectable reports, and stage safe repairs while unsafe findings remain report-only.

---

## Scope

### In Scope (MVP)

- Run health checks for orphan notes, broken wikilinks, stale indexes, missing citations, and content gaps.
- Group findings by severity, type, affected path, evidence, and suggested remediation.
- Export a markdown health report with synthetic-safe examples and no provider secrets.
- Stage safe repair suggestions through staged-change records.
- Keep unsafe or ambiguous repair suggestions report-only.

### Out of Scope

- Autonomous repair apply.
- Graph-based maintenance suggestions.
- Enterprise policy or team review workflows.

---

## Prerequisites

- [ ] Session 03 completed.
- [ ] Session 06 completed.
- [ ] Phase 00 health scanner and staged-change primitives are available.

---

## Deliverables

1. Vault health command and report UI.
2. Markdown export for health reports with affected paths and evidence.
3. Safe-repair staging path for low-risk findings.
4. Tests for report grouping, stale index evidence, unsafe repair blocking, and export redaction.

---

## Success Criteria

- [ ] Health findings link to affected vault paths and include actionable evidence.
- [ ] Unsafe repairs are never applied or staged as automatic changes.
- [ ] Exported reports exclude provider secrets and raw hidden provider state.
- [ ] Health checks remain deterministic on synthetic fixtures.
