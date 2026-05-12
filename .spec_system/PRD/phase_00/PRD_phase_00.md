# PRD Phase 00: Foundation

**Status**: In Progress
**Sessions**: 6 (initial estimate)
**Estimated Duration**: 3-5 days

**Progress**: 3/6 sessions (50%)

---

## Overview

Phase 00 establishes the repository, product boundaries, runtime contracts, and
developer tooling needed to build the Obsidian-compatible AI second-brain MVP.
The phase focuses on a local-first plugin shell, agent-readable command
surfaces, vault data contracts, privacy guardrails, indexing foundations, staged
write safety, and repeatable validation.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Repository and Tooling Scaffold | Complete | ~12-25 | PASS |
| 02 | Vault Data Model | Complete | ~12-25 | PASS |
| 03 | Provider Privacy Boundaries | Complete | ~12-25 | PASS |
| 04 | Indexing and Retrieval Foundation | Not Started | ~12-25 | - |
| 05 | Agent Surfaces and Commands | Not Started | ~12-25 | - |
| 06 | Staged Changes and Health Foundation | Not Started | ~12-25 | - |

---

## Completed Sessions

- `phase00-session01-repo-tooling-scaffold`
- `phase00-session02-vault-data-model`
- `phase00-session03-provider-privacy-boundaries`

---

## Upcoming Sessions

- Session 04: Indexing and Retrieval Foundation
- Session 05: Agent Surfaces and Commands
- Session 06: Staged Changes and Health Foundation

---

## Objectives

1. Establish the repository shape, plugin shell, and local validation toolchain.
2. Define durable vault data contracts for sources, entities, concepts,
   conversations, hot cache, logs, and staged changes.
3. Make privacy, provider trust, secret handling, and staged write behavior
   explicit before feature work begins.
4. Provide agent-readable surfaces and scripts that match the planned MVP
   workflows.

---

## Prerequisites

- Spec system initialized.
- Master PRD and UX PRD available.
- Upstream reference repositories are linked from the master PRD; local `EXAMPLES/`
  copies are ignored research input only.

---

## Technical Considerations

### Architecture

The plugin runtime should keep Obsidian lifecycle wiring thin and move durable
logic into typed services that can be tested outside Obsidian. Vault markdown
must remain the durable source of truth, with generated indexes and logs treated
as recoverable support files.

### Technologies

- TypeScript
- Svelte
- Obsidian API
- Vite
- Vitest
- Biome
- Markdown and JSON

### Risks

- Scope can sprawl across plugin UI, retrieval, agents, and vault maintenance:
  keep Phase 00 limited to scaffolds, contracts, guardrails, and testable
  primitives.
- Privacy mistakes are high impact: create provider and secret boundaries before
  workflows can call models.
- AI writes can damage user trust: require staged writes and recoverable audit
  trails from the first implementation sessions.
- Obsidian runtime behavior can be hard to test directly: isolate service logic
  and use fixture vaults for validation.

---

## Success Criteria

Phase complete when:

- [ ] All 6 sessions completed
- [ ] Plugin shell builds, type checks, lints, and tests locally
- [ ] Vault data contracts and fixture vaults are documented and tested
- [ ] Provider privacy and secret handling boundaries are implemented
- [ ] Agent markdown surfaces and local scripts exist for MVP workflows
- [ ] Staged write and health check foundations are in place

---

## Dependencies

### Depends On

- Spec system initialization
- Master PRD and UX PRD

### Enables

- Phase 01: Vault Intelligence MVP
