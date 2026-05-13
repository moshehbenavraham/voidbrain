# PRD Phase 01: Vault Intelligence MVP

**Status**: In Progress
**Sessions**: 8
**Estimated Duration**: 8-12 days

**Progress**: 7/8 sessions (88%)
**Last Completed Session**: Session 07 - Vault Health Check and Repair Staging (2026-05-13)

---

## Overview

Phase 01 turns the Phase 00 foundations into the first usable local-first Obsidian MVP. The phase wires the plugin runtime, settings, provider setup, indexing orchestration, grounded chat, source ingestion, staged-change review, health reporting, and recent-context recovery into inspectable workflows.

The phase preserves the vault as user-owned data. Provider calls require explicit review, generated note mutations remain staged until confirmed, and examples stay limited to synthetic fixtures.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Obsidian Runtime and Settings Surface | Complete | ~12-25 | PASS |
| 02 | Provider Setup and Privacy Preflight | Complete | ~12-25 | PASS |
| 03 | Indexing Runtime and Retrieval Readiness | Complete | ~12-25 | PASS |
| 04 | Grounded Vault Chat | Complete | ~12-25 | PASS |
| 05 | Source Ingestion Staging | Complete | ~12-25 | PASS |
| 06 | Staged Change Review and Apply | Complete | ~12-25 | PASS |
| 07 | Vault Health Check and Repair Staging | Complete | ~12-25 | PASS |
| 08 | Hot Cache and MVP Integration Validation | Not Started | ~12-25 | - |

---

## Completed Sessions

- `phase01-session01-obsidian-runtime-settings`
- `phase01-session02-provider-setup-privacy-preflight`
- `phase01-session03-indexing-runtime-retrieval-readiness`
- `phase01-session04-grounded-vault-chat`
- `phase01-session05-source-ingestion-staging`
- `phase01-session06-staged-change-review-apply`
- `phase01-session07-vault-health-repair-staging`

---

## Upcoming Sessions

- Session 08: Hot Cache and MVP Integration Validation

---

## Objectives

1. Let users configure provider, privacy, vault, index, and settings state without exposing secrets or mutating notes unexpectedly.
2. Let users index a vault and ask retrieval-grounded questions that return cited vault paths, headings, and source records.
3. Let users ingest source material into reviewable staged markdown changes before anything touches user vault files.
4. Let users review, apply, reject, recover, and audit AI-created changes through explicit local workflows.

---

## Prerequisites

- Phase 00 completed.
- Repository scaffold, provider boundaries, retrieval primitives, staged-change primitives, health primitives, command catalog, and synthetic fixtures are available.
- Bun validation commands remain available from the repository root.

---

## Technical Considerations

### Architecture

Keep Obsidian lifecycle wiring in `src/main.ts` and move workflow behavior into typed services under `src/agent/`, `src/providers/`, `src/vectorstore/`, `src/stores/`, `src/views/`, `src/components/`, `src/utils/`, and `src/types/`. Runtime I/O must use Obsidian vault and adapter APIs rather than arbitrary filesystem paths.

### Technologies

- TypeScript and Svelte for plugin runtime, settings, views, and modals.
- Obsidian API for commands, views, settings, notices, vault reads, and confirmed writes.
- Existing provider, retrieval, staged-change, and health contracts from Phase 00.
- Vitest, Svelte Check, Biome, and Bun validation scripts for quality gates.

### Risks

- Provider disclosure mistakes: keep fail-closed privacy preflight and recursive redaction mandatory.
- Direct vault mutation: route AI-generated note edits through staged review and explicit confirmation.
- Tracker drift: update session, phase, docs, and state artifacts together.
- Index freshness drift: include progress, cancellation, stale-state, and refresh evidence in user-visible status.
- Fixture leakage: keep tests and examples synthetic and bounded to `test/fixtures/vault/`.

### Relevant Considerations

- [P00] **Tracker synchronization**: Update phase state, PRD rows, session specs, and validation artifacts together.
- [P00] **Staged-write gap**: This phase must close the user-approved apply path without introducing direct AI writes.
- [P00] **Provider disclosure boundary**: Cloud/private-data workflows require explicit preflight before provider calls.
- [P00] **Fixture safety**: Synthetic vault and example files must stay free of secrets, personal data, and private paths.
- [P00] **Contract-first boundaries**: Compose MVP workflows from existing durable vault, provider, retrieval, agent, and staged-change contracts.
- [P00] **Framework-vault separation**: Framework updates and plugin behavior must remain separate from user vault content.

---

## Success Criteria

Phase complete when:
- [ ] All 8 sessions completed.
- [ ] User can configure local or cloud-compatible provider settings without secrets entering markdown, logs, fixtures, or docs.
- [ ] User can index a vault and inspect retrieval readiness, stale state, and progress.
- [ ] User can ask a vault question and receive cited results grounded in vault paths, headings, and source records.
- [ ] User can ingest approved source material into staged notes with source links and citation evidence.
- [ ] User can review, explicitly apply, reject, or recover staged changes without uncontrolled note mutation.
- [x] User can run a health check and inspect report-only or staged-repair findings.
- [ ] Hot cache and recent thread state are recoverable from local, readable files.
- [ ] `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`, `bun run validate:agent-docs`, and `bun run validate` pass.

---

## Dependencies

### Depends On

- Phase 00: Foundation

### Enables

- Phase 02: Agentic Maintenance
