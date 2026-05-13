# Session 04: Maintenance Recommendation Planner

**Session ID**: `phase02-session04-maintenance-recommendation-planner`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Build a local maintenance recommendation planner that turns health, retrieval,
index, and citation findings into prioritized, citation-backed repair proposals.

---

## Scope

### In Scope (MVP)

- Aggregate broken wikilinks, orphans, stale index state, missing citations, and
  source-record gaps into a ranked maintenance queue.
- Attach affected vault paths, headings, source records, confidence, severity,
  and recovery details to each recommendation.
- Stage deterministic safe repair proposals through existing staged-change
  flows and keep unsafe findings report-only.
- Add tests with synthetic fixture vaults for ranking, citation evidence, and
  staged repair handoff.

### Out of Scope

- Directly editing notes.
- Fully autonomous background repair.
- Smart graph production UI.

---

## Prerequisites

- [ ] Vault health reporting and safe repair staging are implemented.
- [ ] Retrieval and index readiness summaries expose citation and freshness
      evidence.
- [ ] Staged-change review/apply handles additive and update proposals.

---

## Deliverables

1. Maintenance recommendation contracts, planner service, and runtime status
   summary.
2. Staged-change handoff for deterministic safe repairs.
3. Tests for prioritization, citation requirements, report-only findings, and
   recovery details.

---

## Success Criteria

- [ ] Each recommendation includes affected paths, evidence, confidence,
      severity, and recovery context.
- [ ] Safe repairs are staged for review and unsafe findings remain report-only.
- [ ] Missing citation or source evidence prevents recommendation staging.
- [ ] Health, retrieval, and staged-change status surfaces stay synchronized.
