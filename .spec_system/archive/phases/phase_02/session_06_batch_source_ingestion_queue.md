# Session 06: Batch Source Ingestion Queue

**Session ID**: `phase02-session06-batch-source-ingestion-queue`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Extend source ingestion into a bounded, recoverable queue for multiple approved
markdown, text, pasted, or URL source records.

---

## Scope

### In Scope (MVP)

- Queue multiple approved sources with per-source status, provider review,
  citation checks, cancellation, retry, and recovery metadata.
- Reuse source ingestion staging so generated notes remain reviewable before
  application.
- Preserve bounded concurrency and deterministic queue summaries in hot cache
  support records.
- Add tests for queue ordering, duplicate sources, partial failures, provider
  disclosure gates, and staged output.

### Out of Scope

- Image, audio, video, or large PDF ingestion.
- Multi-agent cloud fan-out without explicit provider approval.
- Automatically applying generated notes.

---

## Prerequisites

- [ ] Single-source ingestion staging is implemented.
- [ ] Provider privacy preflight and disclosure gates are available.
- [ ] Hot cache and recovery records can preserve queue summaries.

---

## Deliverables

1. Batch ingestion queue contracts, service, and runtime status summary.
2. Recovery records for queued, running, failed, canceled, and staged sources.
3. Tests for bounded queue behavior, provider gates, citation checks, and
   partial failure recovery.

---

## Success Criteria

- [ ] Every queued source has a stable ID, status, citation state, and recovery
      details.
- [ ] Cloud provider processing requires explicit review before private content
      leaves the local machine.
- [ ] Generated source notes are staged changes with citations.
- [ ] Partial failures preserve enough context for retry or discard.
