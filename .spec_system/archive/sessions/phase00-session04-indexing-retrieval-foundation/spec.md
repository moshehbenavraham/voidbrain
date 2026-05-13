# Session Specification

**Session ID**: `phase00-session04-indexing-retrieval-foundation`
**Phase**: 00 - Foundation
**Status**: Completed
**Completed**: 2026-05-12
**Created**: 2026-05-12

---

## 1. Session Overview

This session creates the indexing and retrieval foundation for grounded vault workflows. It turns the durable vault contracts from Session 02 and the provider capability boundaries from Session 03 into typed parsing, indexing, and retrieval services that can operate on synthetic Obsidian-style markdown notes without requiring a hosted database or live model call.

The work is foundation-level, not final chat ranking. It should parse vault notes into traceable units, maintain index freshness metadata, provide a deterministic lexical baseline, define semantic index contracts keyed by embedding model family, and return retrieval results that preserve vault paths, headings, snippets, and scores for later citation use.

This is the fourth Phase 00 implementation session. It depends on the fixture vault and vault data model from Session 02, and on provider embedding capability checks from Session 03. It enables later vault chat, source ingestion, staged write synchronization, and health checks to build on a tested indexing surface instead of ad hoc parsing.

---

## 2. Objectives

1. Define typed parsing, indexing, semantic index, progress, cancellation, stale-state, and retrieval result contracts.
2. Implement markdown parsing for frontmatter, headings, wikilinks, tags, and traceable text chunks.
3. Implement a deterministic lexical index and retrieval baseline that returns vault paths, headings, snippets, and scores.
4. Add fixture-based tests for extraction, index freshness, cancellation, embedding model compatibility, and traceable retrieval.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-repo-tooling-scaffold` - Provides TypeScript, Vite, Vitest, Biome, fixture test setup, and local validation scripts.
- [x] `phase00-session02-vault-data-model` - Provides durable vault artifact contracts, fixture vault notes, source manifests, runtime state examples, and no-secret validation rules.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides provider capability contracts, embedding capability checks, local-first disclosure preflight, and secret-safe diagnostics.

### Required Tools/Knowledge
- TypeScript strict mode, discriminated unions, branded vault paths, and typed validation results.
- Obsidian markdown conventions, frontmatter, headings, tags, wikilinks, and vault-relative paths.
- Existing fixture vault layout under `test/fixtures/vault`.
- Provider capability and privacy preflight behavior for embedding workflows.

### Environment Requirements
- Dependencies installed through the existing Bun workflow.
- No live provider calls, cloud embeddings, real vault content, or provider secrets.
- Synthetic fixture notes only.

---

## 4. Scope

### In Scope (MVP)
- Developer can parse markdown notes into frontmatter, headings, wikilinks, tags, and body chunks - use fixture-safe pure helpers with explicit validation failures.
- Developer can build and query a lexical index - provide deterministic in-memory indexing with bounded results and citation traceability.
- Developer can reason about semantic indexes - define an abstraction keyed by embedding model family and guarded by provider embedding capability preflight.
- Runtime can report index progress, cancellation, freshness, and stale states - model long-running indexing jobs without corrupting durable support records.
- Developer can run fixture-based regression tests - cover broken wikilink extraction, tags, headings, frontmatter, freshness, cancellation, and traceable retrieval results.

### Out of Scope (Deferred)
- Final ranking strategy for chat answers - *Reason: this session creates the retrieval foundation, not complete answer synthesis.*
- Production vector database integration - *Reason: MVP core must not require an external database or hosted backend.*
- Live embedding generation through provider adapters - *Reason: provider clients and retry policy are deferred until after contracts are stable.*
- Full graph visualization behavior - *Reason: graph and canvas workflows are deferred beyond the foundation session.*
- Vault health repair automation - *Reason: health reporting and staged repair belong to Session 06 and later phases.*

---

## 5. Technical Approach

### Architecture

Keep retrieval-facing public contracts in `src/types/retrieval.ts` and domain services under `src/vectorstore/`. The services should remain pure or depend on small interfaces so they are testable without Obsidian desktop, network access, or real provider credentials. Obsidian runtime code can later supply vault file reads and metadata cache events, but parsing, indexing, scoring, freshness, and retrieval result shaping should not live in lifecycle code or Svelte components.

The lexical baseline should parse validated markdown notes, chunk text by heading, tokenize deterministically, and return bounded results ordered by score and stable vault path tie-breakers. Retrieval results must always preserve `path`, optional `heading`, `snippet`, and score details so later chat answers can cite actual notes instead of opaque index records.

Semantic index support should be contract-first. This session should define embedding model family compatibility, vector entry metadata, and capability preflight requirements without performing live model calls. Any workflow that prepares semantic indexing must prove the selected provider model supports `embeddings` and must preserve local-first disclosure rules before raw vault content can leave the local boundary.

### Design Patterns
- Contract-first retrieval: Define parse, index, semantic, and result shapes before chat workflows use them.
- Deterministic pure services: Keep tokenization, scoring, sorting, and snippet extraction stable for tests.
- Bounded query behavior: Require limits, validated filters, and deterministic ordering for all retrieval lists.
- Cancellable indexing: Thread abort signals and progress snapshots through indexing jobs.
- Citation traceability: Carry vault paths, headings, and source paths through every result.

### Technology Stack
- TypeScript 5.9 for strict interfaces, discriminated unions, and pure service contracts.
- Vitest 4 for parser, lexical index, semantic contract, and cancellation regression tests.
- Existing vault data model utilities for path normalization and fixture validation.
- Existing provider privacy utilities for embedding capability and cloud disclosure preflight.
- Existing Bun scripts for build, type check, lint, test, and validation.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/indexing-retrieval-foundation.md` | Human-readable indexing, freshness, retrieval result, and semantic index contract documentation | ~130 |
| `src/types/retrieval.ts` | Public markdown parse, chunk, index job, semantic index, and retrieval result contracts | ~220 |
| `src/vectorstore/index.ts` | Vectorstore and retrieval domain exports | ~40 |
| `src/vectorstore/markdown-parser.ts` | Frontmatter, heading, wikilink, tag, and chunk extraction helpers | ~180 |
| `src/vectorstore/index-state.ts` | Freshness, progress, cancellation, and index metadata helpers | ~140 |
| `src/vectorstore/lexical-index.ts` | Deterministic in-memory lexical index and bounded search implementation | ~220 |
| `src/vectorstore/semantic-index.ts` | Semantic index abstraction, embedding family checks, and provider preflight bridge | ~170 |
| `src/vectorstore/indexing-service.ts` | Fixture-safe indexing orchestrator with progress and cancellation behavior | ~180 |
| `src/vectorstore/retrieval-service.ts` | Retrieval result composer that maps index hits to citation-ready results | ~130 |
| `test/fixtures/vault/indexing-fixtures.ts` | Synthetic fixture loading helpers for indexing and retrieval tests | ~90 |
| `test/indexing-retrieval-foundation.test.ts` | Unit tests for parsing, indexing, semantic guards, freshness, and retrieval results | ~330 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `docs/vault-data-model.md` | Document derived index metadata, freshness, and traceable retrieval result expectations | ~40 |
| `src/README.md` | Document vectorstore domain ownership and privacy/citation boundaries | ~30 |
| `.spec_system/specs/phase00-session04-indexing-retrieval-foundation/implementation-notes.md` | Implementation evidence and validation results | ~80 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Markdown parser extracts frontmatter, headings, wikilinks, tags, and traceable chunks from fixture notes.
- [ ] Retrieval results include vault path, optional heading, bounded snippet, score, and deterministic ordering.
- [ ] Index metadata records freshness and embedding model family compatibility.
- [ ] Indexing progress can be reported, canceled, and resumed without corrupting durable support records.
- [ ] Semantic index setup checks provider embedding capability and local-first privacy policy before accepting private vault content for embedding.

### Testing Requirements
- [ ] Unit tests written and passing for frontmatter, headings, wikilinks, tags, and broken wikilink extraction.
- [ ] Unit tests written and passing for lexical indexing, bounded search limits, deterministic ordering, and traceable snippets.
- [ ] Unit tests written and passing for index freshness, stale state, progress, cancellation, and resume behavior.
- [ ] Unit tests written and passing for embedding model family compatibility and provider preflight denial paths.
- [ ] Manual review confirms fixtures and docs contain no real secrets, provider payloads, or personal vault content.

### Non-Functional Requirements
- [ ] Warm lexical retrieval over the synthetic fixture vault is deterministic and returns within unit-test runtime expectations.
- [ ] Retrieval output remains citation-ready and does not synthesize uncited claims.
- [ ] Derived indexes are treated as rebuildable support artifacts, not the durable source of truth.
- [ ] No cloud provider call occurs unless a future workflow explicitly enables and trusts that provider.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations
- Retrieval result contracts must preserve enough source context for later chat citations and health reports.
- Index metadata should describe recoverable support state only; markdown notes remain the durable source of truth.
- Semantic index contracts must use embedding model family compatibility rather than provider display names.
- Long-running indexing should be cancellable and should report stale or partial state explicitly.
- Query APIs should reject unbounded result requests and keep ordering deterministic.

### Potential Challenges
- Markdown parsing scope can expand quickly: support MVP frontmatter, headings, wikilinks, tags, and chunks only.
- Lexical scoring can become ranking research: implement a simple deterministic baseline and document deferred ranking work.
- Semantic index work can drift into live provider adapters: define contracts and preflight only, no network calls.
- Cancellation can be hard to verify if implementation is too synchronous: design indexing service seams that tests can interrupt.

### Relevant Considerations
- No active concerns or lessons in `CONSIDERATIONS.md` apply yet.
- `SECURITY-COMPLIANCE.md` reports no open findings; preserve this by using synthetic fixtures and provider preflight tests only.

### Behavioral Quality Focus
Checklist active: Yes

Top behavioral risks for this session:
- Retrieval results could lose path, heading, or snippet traceability, making later chat citations unverifiable.
- Indexing could ignore cancellation and leave stale metadata looking ready.
- Semantic indexing could bypass provider embedding capability or local-first disclosure checks.
- Query paths could return unbounded or nondeterministically ordered results.

---

## 9. Testing Strategy

### Unit Tests
- Test markdown parsing for frontmatter, headings, wikilinks, tags, and body chunks across existing fixture notes.
- Test broken wikilink extraction by adding a synthetic link target that remains traceable for later health checks.
- Test lexical index build, bounded search limits, score ordering, vault path tie-breakers, and snippets.
- Test index metadata transitions for building, ready, stale, error, canceled, and resumed jobs.
- Test semantic index compatibility by embedding model family and provider `embeddings` capability preflight denial.

### Integration Tests
- Run `bun run build`, `bun run check`, `bun run lint`, and `bun run test`.
- Keep live provider API calls, production vector databases, Obsidian desktop runtime, and network discovery out of scope.

### Manual Testing
- Review `docs/indexing-retrieval-foundation.md` against `PRD.md`, `CONVENTIONS.md`, and `docs/vault-data-model.md`.
- Inspect retrieval result examples to confirm they carry vault paths, headings, snippets, and scores.
- Confirm generated docs and fixtures include no real provider secrets, personal notes, or private URLs.

### Edge Cases
- Empty markdown body or missing frontmatter.
- Duplicate headings and headingless body content.
- Wikilinks with aliases, headings, and missing targets.
- Tags in frontmatter and inline body text.
- Query strings that normalize to no searchable tokens.
- Search limits above allowed bounds or malformed filters.
- Canceled indexing jobs and stale index metadata.
- Semantic index request with unsupported embedding capability or mismatched embedding model family.

---

## 10. Dependencies

### External Libraries
- No new external libraries planned.

### Other Sessions
- **Depends on**: `phase00-session01-repo-tooling-scaffold`, `phase00-session02-vault-data-model`, `phase00-session03-provider-privacy-boundaries`.
- **Depended by**: `phase00-session06-staged-changes-health-foundation`, Phase 01 vault chat and ingestion workflows.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
