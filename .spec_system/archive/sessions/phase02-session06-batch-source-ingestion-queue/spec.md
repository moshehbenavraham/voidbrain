# Session Specification

**Session ID**: `phase02-session06-batch-source-ingestion-queue`
**Phase**: 02 - Agentic Maintenance
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session extends the implemented single-source ingestion workflow into a bounded, recoverable batch queue for approved markdown, text, pasted, and URL source records. It should let the runtime accept multiple source requests, process them with deterministic ordering and bounded concurrency, and preserve per-source status, citation state, provider review decisions, staged-change IDs, cancellation, retry, and recovery details.

The work matters because batch ingestion amplifies every existing safety boundary. The queue must preserve the local-first product contract: source content stays local unless explicit provider review allows a provider path, generated notes stay staged until review, and durable support records include enough metadata for recovery without storing provider secrets, hidden provider state, raw private source bodies, or private paths.

The implementation builds on the completed ingestion staging service, staged-change review/apply flow, provider privacy preflight, hot cache support records, and read-only recovery command. It should keep Obsidian lifecycle wiring in `src/main.ts`, keep queue and recovery logic testable under `src/agent/`, place UI state in stores and views, and validate everything with synthetic fixtures under `test/fixtures/vault/`.

---

## 2. Objectives

1. Define typed batch ingestion queue contracts for source items, statuses, cancellation, retry, provider review, staged outputs, summaries, and recovery records.
2. Implement a bounded queue service that processes multiple approved sources through the existing `SourceIngestionStagingService` without direct vault writes.
3. Persist deterministic queue summaries into hot cache support records without raw source bodies or secret-like diagnostics.
4. Surface queue progress, partial failures, cancellation, retry, and staged output through runtime status and the ingestion modal.
5. Cover ordering, duplicate sources, provider gates, citation checks, cancellation, retry, and partial failure recovery with synthetic tests.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase01-session05-source-ingestion-staging` - Provides source intake, provider preflight handoff, citation validation, generated artifact rendering, staged-change output, and ingestion modal/store foundations.
- [x] `phase01-session06-staged-change-review-apply` - Provides staged-change review, apply, backup intent, conflict revalidation, and recovery metadata.
- [x] `phase01-session08-hot-cache-mvp-integration-validation` - Provides hot cache support records, persistence patterns, and recovery-safe summary rendering.
- [x] `phase02-session01-recover-session-command` - Provides read-only recovery over hot cache, staged changes, reports, logs, validation output, and redacted diagnostics.
- [x] `phase02-session05-similar-note-placement-suggestions` - Provides recent patterns for local evidence records, staged handoff, duplicate prevention, and runtime status summaries.

### Required Tools/Knowledge

- Existing source ingestion contracts in `src/types/ingestion.ts`.
- Existing `SourceIngestionStagingService`, `SourceIngestionIntakeService`, renderer, and citation validation helpers under `src/agent/`.
- Existing `StagedChangeService` duplicate prevention, conflicts, recovery records, and staged output contracts.
- Existing provider preflight, redaction, and provider capability checks under `src/providers/`.
- Existing hot cache capture and recovery service patterns.
- Vitest fixture patterns under `test/fixtures/vault/`.

### Environment Requirements

- Work from the repository root.
- Use synthetic fixture vault content only in tests and examples.
- Do not fetch live URLs, call live providers, or send vault content to cloud providers during tests.
- Do not write provider secrets, authorization headers, hidden provider state, raw private source bodies, or private paths to docs, fixtures, logs, screenshots, support records, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can queue multiple approved markdown, text, pasted, or URL source records - validate each item, assign stable IDs, preserve deterministic queue ordering, and reject unsafe or duplicate entries with explicit diagnostics.
- User can process the queue with bounded concurrency - run through existing single-source staging, keep generated notes as staged changes, and expose queued, running, staged, failed, canceled, and skipped statuses.
- User can cancel queued or running work and retry failed or canceled items - preserve cleanup on scope exit, duplicate-trigger prevention while in flight, retry counts, and recovery details.
- User can inspect provider review and citation state for every source - run provider preflight per item before any cloud path and block staging when generated artifacts lack citations.
- User can recover queue context from hot cache support records - persist command ID, queue ID, item IDs, source paths, target paths, provider decisions, staged-change IDs, validation output, and retry or discard guidance.
- Developer can validate batch behavior with synthetic fixtures - cover ordering, duplicate sources, provider denial, partial failures, cancellation, retry, staged output, and fixture safety.

### Out of Scope (Deferred)

- Image, audio, video, or large PDF ingestion - *Reason: Phase 02 batch queue extends only the already implemented text-like source types.*
- Multi-agent cloud fan-out - *Reason: batch processing must preserve explicit provider review and bounded local queue behavior first.*
- Automatically applying generated notes - *Reason: all generated notes continue through staged-change review/apply workflows.*
- Live URL fetching or autonomous research - *Reason: URL records must remain explicitly approved source records with user-supplied content.*
- Distribution packaging or Phase 03 provider hardening - *Reason: this session is focused on batch queue behavior and recovery.*

---

## 5. Technical Approach

### Architecture

Create batch queue contracts in `src/types/ingestion-queue.ts` and a pure queue orchestrator in `src/agent/source-ingestion-queue-service.ts`. The queue service should accept existing `SourceIngestionIntakeRequest` values, normalize item IDs, validate duplicate source paths and fingerprints, apply a bounded concurrency limit, process each item through `SourceIngestionStagingService`, and emit a deterministic summary with per-item recovery details.

The queue service must not introduce a second mutation path. Generated notes continue to flow through `SourceIngestionStagingService` and `StagedChangeService`, so every note remains staged and reviewable before application. Cancellation should stop queued items before staging, request best-effort abort behavior for running items, and always return a recovery-safe result with target paths, staged-change IDs when available, provider decisions, and validation output.

Runtime wiring should stay in `src/main.ts`. Add an ingestion queue store for modal state and plugin-owned persistence, update the existing ingestion modal rather than creating an unrelated UI surface, and extend runtime status plus hot cache capture with bounded queue summaries. Hot cache records should store counts, IDs, paths, statuses, provider decisions, and validation issues, never raw source content or hidden provider state.

### Design Patterns

- Contract-first queue model: define item, status, summary, cancellation, retry, provider review, citation, staged output, and recovery records before runtime wiring.
- Single mutation boundary: reuse `SourceIngestionStagingService` and `StagedChangeService` for all generated notes.
- Bounded concurrency: process a small fixed number of items at once and keep deterministic order in final summaries.
- Fail-closed provider review: run provider preflight per item before any provider-assisted extraction.
- Redacted support records: persist IDs, paths, counts, decisions, and validation output without raw bodies or secrets.
- Retryable item state: failed and canceled items keep enough recovery context for retry or discard.

### Technology Stack

- TypeScript 5.9 strict mode for queue contracts, services, stores, and runtime wiring.
- Obsidian API 1.12 for command registration, modal lifecycle, vault reads, plugin data, notices, and cleanup.
- Existing provider preflight, source ingestion staging, staged-change, hot cache, runtime status, and recovery services.
- Svelte 5 and DOM-based Obsidian modal patterns already present in the repository.
- Vitest 4, jsdom, Bun validation scripts, and synthetic fixture vaults.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/ingestion-queue.ts` | Batch ingestion item, queue, status, summary, cancellation, retry, provider review, staged output, and recovery contracts. | ~260 |
| `src/agent/source-ingestion-queue-service.ts` | Bounded queue orchestration over existing single-source staging, with duplicate prevention, cancellation, retry, partial failure, and recovery summaries. | ~460 |
| `src/stores/ingestion-queue-store.ts` | Queue UI/runtime state store with persistence recovery, active item tracking, retry state, and redacted failure handling. | ~240 |
| `test/fixtures/vault/source-ingestion-queue-fixtures.ts` | Synthetic batch source requests, duplicates, provider denial cases, cancellation cases, partial failures, and expected summaries. | ~260 |
| `test/source-ingestion-queue.test.ts` | Service tests for queue ordering, bounded concurrency, duplicate sources, provider gates, citation checks, cancellation, retry, staged output, and recovery. | ~420 |
| `docs/batch-source-ingestion-queue.md` | Human-readable batch queue behavior, privacy notes, staged output, cancellation, retry, and recovery contract. | ~140 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/ingestion.ts` | Add shared failure/status helpers or exports needed by queue items without changing single-source behavior. | ~40 |
| `src/types/hot-cache.ts` | Add bounded source-ingestion queue support record input and entry kind. | ~60 |
| `src/types/runtime.ts` | Add optional ingestion queue status input and runtime area support if needed. | ~50 |
| `src/agent/hot-cache-service.ts` | Capture redacted queue summaries, item statuses, staged IDs, validation output, and recovery references. | ~130 |
| `src/agent/runtime-status.ts` | Summarize queued, running, staged, failed, canceled, retryable, and provider-blocked item counts. | ~120 |
| `src/agent/index.ts` | Export queue service constructors and public queue types. | ~30 |
| `src/views/source-ingestion-modal.ts` | Extend the existing ingestion modal with batch queue input, progress, cancellation, retry, staged IDs, loading, empty, error, and cleanup states. | ~260 |
| `src/main.ts` | Create queue service/store, wire modal options, plugin-owned persistence, hot cache capture, runtime status, and cleanup. | ~220 |
| `src/agent/command-catalog.ts` | Update `voidbrain.ingest-source` behavior notes to include bounded batch queue support and recovery evidence. | ~50 |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `skills/voidbrain/SKILL.md`, `docs/agent-surfaces-commands.md` | Synchronize command behavior, safety language, staged-change notes, provider review, citations, and recovery details. | ~120 |
| `test/source-ingestion-modal.test.ts` | Cover queue UI behavior, accessibility, cancellation, retry, provider denial, and no direct vault writes. | ~180 |
| `test/hot-cache-service.test.ts` | Cover redacted queue summary support records and recovery references. | ~120 |
| `test/runtime-status.test.ts` | Cover queue status summary counts and sample paths without raw source bodies. | ~100 |
| `test/plugin-lifecycle.test.ts` | Cover queue service wiring, modal opening, persistence recovery, hot cache capture, cleanup, and no direct vault writes. | ~160 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Queue accepts multiple approved markdown, text, pasted, and URL source records with stable item IDs, deterministic ordering, and bounded duplicate detection.
- [ ] Each queue item reports queued, running, staged, failed, canceled, or skipped state plus source path, target paths, citation state, provider decision, staged-change IDs, validation output, and retry or discard guidance.
- [ ] Provider-assisted processing runs per-source provider review and preflight before any private source content can leave the local machine.
- [ ] Generated source, entity, concept, and summary notes are staged changes only and never written directly to user vault files.
- [ ] Cancellation and retry preserve cleanup on scope exit, duplicate-trigger prevention while in flight, partial failure context, and deterministic recovery summaries.
- [ ] Hot cache support records preserve queue summaries without raw private source bodies, provider secrets, authorization headers, or hidden provider state.

### Testing Requirements

- [ ] Unit tests cover queue ordering, bounded concurrency, duplicate source paths, duplicate content, active staged changes, provider denial, and target conflicts.
- [ ] Unit tests cover cancellation, retry, partial failure, citation validation failures, staged output, and recovery summaries.
- [ ] Store and modal tests cover loading, empty, error, offline, queued, running, canceled, retry, staged, focus, and cleanup behavior.
- [ ] Hot cache and recovery tests cover redacted queue summaries, validation output, staged-change IDs, provider decisions, and no raw source bodies.
- [ ] Runtime/lifecycle tests cover command wiring, modal opening, persistence recovery, status summaries, plugin unload cleanup, and no direct vault writes.

### Non-Functional Requirements

- [ ] Privacy: 100% of source content remains local unless provider review explicitly allows the selected provider path for that item.
- [ ] Security: provider secrets, tokens, authorization headers, hidden provider state, raw private source bodies, and private paths are not written to docs, fixtures, logs, support records, screenshots, or generated examples.
- [ ] Reliability: all generated notes remain staged, diffable, recoverable, and un-applied until explicit staged-change review.
- [ ] Performance: batch processing uses bounded concurrency and stable summaries so large queues do not block the Obsidian UI.
- [ ] Recoverability: failures preserve command ID, queue ID, item ID, source path, target paths, cache path, staged-change IDs, provider decision, validation output, and retry or discard guidance.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with recovery details

---

## 8. Implementation Notes

### Key Considerations

- Batch ingestion is an orchestration layer, not a replacement for single-source staging.
- The queue should store request metadata and status summaries durably, but raw source bodies should remain transient runtime input.
- Use bounded concurrency and deterministic sort order so tests, recovery records, and user-facing summaries are stable.
- Cancellation should prevent new work, mark queued items canceled, and return recovery details for any running item that already produced staged changes.
- Retry should operate at the item level and should not duplicate active staged changes or already staged target paths.
- Command catalog and agent surfaces should continue to describe `voidbrain.ingest-source`; no new command ID is required unless implementation proves otherwise.

### Potential Challenges

- Partial staging can create mixed queue outcomes: keep per-item recovery records and aggregate summaries instead of flattening everything into one success or failure.
- Provider preflight can vary per item: capture item-level decisions and keep denied cloud paths retryable without silently escalating to another provider.
- Hot cache summaries can accidentally become raw source archives: store counts, IDs, paths, hashes, statuses, and diagnostics only.
- Modal state can become stale across retries or plugin reloads: reset or revalidate queue items on re-entry and recover interrupted running states as failed or retryable.
- Bounded concurrency can hide ordering bugs: preserve original enqueue order for summaries even when processing finishes out of order.

### Relevant Considerations

- [P01] **Workflow drift risk**: Update command catalog, docs, agent surfaces, session artifacts, and validation outputs alongside the code.
- [P01] **Obsidian runtime variance**: Keep queue logic pure and testable; use Obsidian APIs only at runtime boundaries for reads, notices, persistence, and cleanup.
- [P01] **Disclosure gates stay mandatory**: Run provider review and preflight per item before any provider-assisted extraction.
- [P01] **Redaction must remain fail-closed**: Durable queue summaries, hot cache records, fixtures, and docs must exclude secrets, raw bodies, private paths, and hidden provider state.
- [P01] **Review-first mutations**: Queue output remains staged changes with before/after review, backup intent, conflict revalidation, and recovery details.
- [P01] **Duplicate prevention**: Guard duplicate queue items, content hashes, target paths, active staged changes, and in-flight work.
- [P01] **Hot cache as support state**: Queue recovery should reuse bounded support records with IDs, paths, counts, and validation output.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:

- A queued item or retry starts provider-assisted extraction before explicit provider review.
- Concurrent workers stage duplicate target paths or duplicate active staged changes.
- Canceling the queue leaves running items, subscriptions, timers, or abort controllers alive after modal close or plugin unload.
- Partial failures lose staged-change IDs, provider decisions, validation output, or target paths needed for retry.
- Hot cache or persisted queue state stores raw source content, provider secrets, hidden provider state, or private diagnostics.

---

## 9. Testing Strategy

### Unit Tests

- Test queue item creation for stable IDs, deterministic ordering, unsupported source kinds, duplicate source paths, duplicate content, duplicate target paths, and active staged changes.
- Test bounded concurrency with synthetic slow workers and confirm summary ordering remains deterministic.
- Test provider preflight per item for local allowed, trusted cloud allowed, untrusted cloud denied, missing role, timeout, and deterministic fallback.
- Test cancellation before run, cancellation during run, retry of failed items, retry of canceled items, and duplicate-trigger prevention during retry.
- Test staged-change output aggregation, citation validation failures, partial staging failures, compensation metadata, and recovery summaries.

### Integration Tests

- Test ingestion modal queue input, progress rendering, cancel, retry, staged IDs, denied provider state, focus behavior, and cleanup on close.
- Test plugin lifecycle wiring for queue services, store persistence recovery, hot cache capture, runtime status refresh, and unload cleanup.
- Test hot cache restore/recovery paths include queue ID, item IDs, source paths, target paths, staged-change IDs, provider decisions, validation output, and retry guidance.
- Test agent surface validation after command catalog and documentation updates.

### Manual Testing

- Open `voidbrain.ingest-source` in Obsidian, queue two synthetic source records, stage them, and verify all generated notes are staged changes.
- Cancel a queue with one queued and one running item, then retry the canceled item.
- Verify provider-denied items remain local, retryable, and do not create generated notes.
- Run repository validation commands from the root.

### Edge Cases

- Empty queue, all duplicates, one item succeeds while another fails, cancellation during provider preflight, retry after partial staged output, persisted running state after reload, and hot cache persistence failure.

---

## 10. Dependencies

### External Libraries

- None new. Use existing TypeScript, Obsidian API, Vitest, jsdom, Bun scripts, and repository utilities.

### Other Sessions

- **Depends on**: `phase01-session05-source-ingestion-staging`, `phase01-session06-staged-change-review-apply`, `phase01-session08-hot-cache-mvp-integration-validation`, `phase02-session01-recover-session-command`, `phase02-session05-similar-note-placement-suggestions`
- **Depended by**: `phase02-session07-agentic-maintenance-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
