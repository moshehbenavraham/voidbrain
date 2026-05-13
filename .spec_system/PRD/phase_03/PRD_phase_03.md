# PRD Phase 03: Offline and Provider Hardening

**Status**: In Progress
**Sessions**: 6
**Estimated Duration**: 6-9 days

**Progress**: 5/6 sessions (83%)

---

## Overview

Phase 03 turns the current provider privacy contracts into hardened offline and
OpenAI-compatible provider workflows. The phase focuses on real provider
profiles, explicit trust and auth readiness, cancellable provider invocation
boundaries, offline embedding/index compatibility, and user-facing diagnostics.

The phase must preserve Voidbrain's local-first promise. Local provider paths
stay inside the user's selected local runtime boundary. Cloud and custom remote
endpoints require explicit trust, capability, auth, and disclosure preflight
before any private vault content can be sent. Secrets, authorization headers,
prompt bodies, raw private note bodies, and hidden provider state must never be
written to markdown, logs, fixtures, screenshots, or generated examples.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Local Runtime Provider Profiles | Complete | ~12-25 | 2026-05-13 |
| 02 | OpenAI-Compatible Provider Profiles | Complete | ~12-25 | 2026-05-13 |
| 03 | Provider Transport Invocation Boundaries | Complete | ~12-25 | 2026-05-13 |
| 04 | Offline Embeddings and Index Compatibility | Complete | ~12-25 | 2026-05-13 |
| 05 | Provider Troubleshooting and Recovery UX | Complete | ~12-25 | 2026-05-13 |
| 06 | Offline Provider Integration Validation | Not Started | ~12-25 | - |

---

## Completed Sessions

1. Local Runtime Provider Profiles
2. OpenAI-Compatible Provider Profiles
3. Provider Transport Invocation Boundaries
4. Offline Embeddings and Index Compatibility
5. Provider Troubleshooting and Recovery UX

---

## Upcoming Sessions

- Session 06: Offline Provider Integration Validation

---

## Objectives

1. Let users configure local runtime provider profiles for offline chat and
   embeddings with inspectable readiness and no secret leakage.
2. Harden OpenAI-compatible local, custom, and cloud provider profile handling
   with explicit endpoint, credential, trust, and model capability checks.
3. Route chat and embedding invocations through cancellable provider adapters
   that fail closed, redact diagnostics, and avoid durable prompt or credential
   storage.
4. Keep semantic indexing and retrieval resilient when local runtimes are
   offline, embedding model families change, or provider capability checks fail.
5. Surface provider troubleshooting, retry, recovery, and validation evidence
   without mutating user vault files or disclosing private content.

---

## Prerequisites

- Phase 02 completed.
- Provider registry, capability selection, provider preflight, privacy guard,
  redaction, secret-store, settings, retrieval, indexing, staged-change, hot
  cache, and runtime status services are available.
- Synthetic provider and fixture vault tests are available under `test/`.
- Local validation commands are available from the repository root.

---

## Technical Considerations

### Architecture

Keep Obsidian lifecycle wiring in `src/main.ts`. Place provider profile,
transport, readiness, indexing compatibility, troubleshooting, store, and UI
logic under `src/providers/`, `src/agent/`, `src/vectorstore/`, `src/stores/`,
`src/views/`, `src/components/`, `src/utils/`, and `src/types/`.

Provider adapters must receive only selected, preflight-approved provider and
model details. Durable support records may include provider IDs, capability
names, readiness codes, source path counts, command IDs, cache paths,
staged-change IDs, report IDs, and validation output, but not raw credentials,
authorization headers, prompt bodies, note bodies, or hidden transport state.

### Technologies

- TypeScript strict mode for provider profiles, adapter contracts, diagnostics,
  readiness state, and index compatibility.
- Obsidian API for settings, notices, views, commands, vault-safe status, and
  adapter-mediated runtime workflows.
- Existing provider preflight, redaction, secret-store, retrieval, indexing,
  hot cache, and runtime status services.
- Vitest, Svelte Check, Biome, Bun validation scripts, and synthetic fixtures.

### Risks

- Local provider support can accidentally become remote disclosure: endpoint
  classification, trust state, and content sensitivity must stay explicit.
- Provider diagnostics can leak credentials or private prompts: redaction must
  fail closed and tests must cover secret-like values and private path hints.
- Embedding model switches can make indexes stale or incompatible: model family
  keys and reindex guidance must be visible before retrieval uses stale vectors.
- Retry and timeout logic can duplicate provider calls: invocation paths need
  cancellation, idempotent status updates, and bounded recovery details.
- UI troubleshooting can imply unsafe fallback: cloud use must never be enabled
  silently when local providers fail.

### Relevant Considerations

- [P02] **Workflow drift risk**: Keep phase tracking, command docs, specs, and
  validation artifacts synchronized as provider behavior changes.
- [P02] **Spec script parity**: Restore or preserve local script parity when
  phase closeout updates validation entry points.
- [P01] **Obsidian runtime variance**: Provider status, settings, and modal
  behavior should be resilient across vault sizes and platforms.
- [P01] **Disclosure gates stay mandatory**: Cloud and remote endpoint paths
  require explicit trust, auth, capability, and disclosure preflight before
  private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, recovery records,
  and exported reports must exclude secrets, raw private note bodies, and hidden
  provider state.
- [P01] **Review-first mutations**: Any provider-assisted note output still
  routes through staged review/apply paths.

---

## Success Criteria

Phase complete when:
- [ ] All 6 sessions completed.
- [ ] Local runtime provider profiles support offline chat and embedding
      readiness without requiring cloud disclosure.
- [ ] OpenAI-compatible provider profiles handle endpoint classification,
      credential references, trust state, auth testing, and model capability
      mapping with redacted diagnostics.
- [ ] Provider chat and embedding invocation boundaries enforce preflight,
      cancellation, timeout, retry, and redaction behavior before any adapter
      can run.
- [ ] Semantic indexing detects embedding model family compatibility and
      provides lexical fallback or reindex guidance when local embeddings are
      unavailable or stale.
- [ ] Provider troubleshooting surfaces actionable retry and recovery details
      without writing secrets, prompt bodies, raw private note bodies, or hidden
      provider state.
- [ ] `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`,
      `bun run validate:agent-docs`, and `bun run validate` pass or residual
      failures are recorded with recovery details.

---

## Dependencies

### Depends On

- Phase 02: Agentic Maintenance

### Enables

- Phase 04: Distribution and Ecosystem
