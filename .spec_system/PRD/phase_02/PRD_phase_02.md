# PRD Phase 02: Agentic Maintenance

**Status**: In Progress
**Sessions**: 7
**Estimated Duration**: 7-10 days

**Progress**: 4/7 sessions (57%)

---

## Overview

Phase 02 turns the completed local-first MVP into an inspectable maintenance
system. It implements recovery from local support records, hardens agent command
surface validation, keeps framework updates dry-run and vault-safe, and adds
reviewable maintenance recommendations for citations, links, related notes,
note placement, and batch source ingestion.

The phase must preserve the vault as user-owned data. Maintenance plans,
generated note edits, and source-derived records remain staged until explicit
approval. Cloud provider paths require provider review before any vault content
can leave the local machine.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Recover Session Command | Complete | ~12-25 | PASS |
| 02 | Agent Surface Validation Hardening | Complete | ~12-25 | PASS |
| 03 | Framework Update Preview Planner | Complete | ~12-25 | PASS |
| 04 | Maintenance Recommendation Planner | Complete | ~12-25 | PASS |
| 05 | Similar Note and Placement Suggestions | Not Started | ~12-25 | - |
| 06 | Batch Source Ingestion Queue | Not Started | ~12-25 | - |
| 07 | Agentic Maintenance Integration Validation | Not Started | ~12-25 | - |

---

## Completed Sessions

- Session 01: Recover Session Command
- Session 02: Agent Surface Validation Hardening
- Session 03: Framework Update Preview Planner
- Session 04: Maintenance Recommendation Planner

---

## Upcoming Sessions

- Session 05: Similar Note and Placement Suggestions
- Session 06: Batch Source Ingestion Queue
- Session 07: Agentic Maintenance Integration Validation

---

## Objectives

1. Implement read-only recovery workflows that reconstruct command context from
   hot cache, logs, staged-change records, reports, and validation output.
2. Harden agent command validation and framework update previews so command
   surfaces stay synchronized while user vault content remains excluded.
3. Produce prioritized vault maintenance recommendations with citations,
   affected paths, confidence, recovery details, and staged-change handoff.
4. Extend ingestion into bounded, recoverable batch workflows that preserve
   provider review, citation requirements, and review-first mutation behavior.

---

## Prerequisites

- Phase 01 completed.
- Hot cache support records, staged-change review/apply, health reporting,
  source ingestion staging, grounded chat, and runtime status are available.
- Agent surfaces and local validation scripts exist for AGENTS, CLAUDE, GEMINI,
  the Voidbrain skill, docs, and command catalog contracts.

---

## Technical Considerations

### Architecture

Keep Obsidian lifecycle wiring in `src/main.ts`. Place testable maintenance,
recovery, validation, preview, ingestion queue, and recommendation logic under
`src/agent/`, `src/providers/`, `src/vectorstore/`, `src/stores/`, `src/views/`,
`src/components/`, `src/utils/`, and `src/types/`.

All note mutations produced by maintenance workflows must route through staged
changes. Recovery and validation workflows are read-only unless they explicitly
stage a proposed repair for review.

### Technologies

- TypeScript strict mode for command, recovery, queue, and recommendation
  contracts.
- Obsidian API for vault, metadata cache, commands, notices, views, and adapter
  reads or writes.
- Existing retrieval, health, hot cache, staged-change, source ingestion, and
  runtime status services.
- Vitest, Svelte Check, Biome, Bun validation scripts, and synthetic fixture
  vaults.

### Risks

- Recovery output can leak private state: redaction must fail closed and report
  missing or malformed records without dumping raw content.
- Maintenance suggestions can become direct edits: every note mutation must be a
  staged change with before and after review.
- Framework update previews can drift into apply behavior: Phase 02 keeps update
  behavior dry-run only.
- Batch ingestion can amplify provider or citation mistakes: each queued source
  needs provider review, citation checks, cancellation, and recovery metadata.
- Agent surfaces can drift from command contracts: validation should fail closed
  on stale command IDs, missing safety phrases, unsafe examples, and private
  path hints.

### Relevant Considerations

- [P01] **Recovery surface gap**: Implement recovery on top of hot cache and
  support records without storing raw vault content.
- [P01] **Workflow drift risk**: Keep phase tracking, command docs, and phase
  artifacts synchronized during every session.
- [P01] **Disclosure gates stay mandatory**: Provider-dependent maintenance and
  ingestion workflows require explicit trust, auth, capability, and disclosure
  preflight.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records,
  and reports must exclude secrets, raw private note bodies, and hidden provider
  state.
- [P01] **Review-first mutations**: Maintenance suggestions and generated notes
  flow through staged review/apply paths with backup intent and conflict
  revalidation.
- [P01] **Framework-vault separation**: Framework docs, support files, and user
  vault content remain isolated so updates stay inspectable and reversible.

---

## Success Criteria

Phase complete when:
- [ ] All 7 sessions completed.
- [ ] `voidbrain.recover-session` reconstructs recoverable local context from
      hot cache, logs, reports, and staged-change records without exposing
      secrets or raw private note bodies.
- [ ] Agent surface validation fails closed on stale command IDs, missing safety
      language, unsafe examples, private path hints, and credential-like values.
- [ ] Framework update previews remain dry-run and exclude user vault content,
      generated knowledge notes, and provider secrets.
- [ ] Vault maintenance recommendations cite affected paths, headings, source
      records, confidence, and recovery details before staging any repair.
- [ ] Similar-note, placement, and link suggestions are reviewable and never
      mutate notes without explicit staged-change approval.
- [ ] Batch ingestion has bounded queues, cancellation, retry, provider review,
      citation checks, and recovery metadata.
- [ ] `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`,
      `bun run validate:agent-docs`, and `bun run validate` pass or residual
      failures are recorded with recovery details.

---

## Dependencies

### Depends On

- Phase 01: Vault Intelligence MVP

### Enables

- Phase 03: Offline and Provider Hardening
