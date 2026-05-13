# Task Checklist

**Session ID**: `phase00-session04-indexing-retrieval-foundation`
**Total Tasks**: 24
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-12

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[SNNMM]` = Session reference (NN=phase number, MM=session number)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 7 | 7 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **24** | **24** | **0** |

---

## Setup (3 tasks)

Initial setup, documentation entry points, and retrieval-domain boundaries.

- [x] T001 [S0004] Verify Session 02 and Session 03 prerequisites, fixture vault coverage, and provider embedding privacy assumptions (`.spec_system/specs/phase00-session04-indexing-retrieval-foundation/implementation-notes.md`)
- [x] T002 [S0004] [P] Create indexing and retrieval foundation documentation shell with parsing, freshness, semantic, and citation sections (`docs/indexing-retrieval-foundation.md`)
- [x] T003 [S0004] [P] Create vectorstore domain export surface for parsing, indexing, semantic, and retrieval services (`src/vectorstore/index.ts`)

---

## Foundation (7 tasks)

Core parsing, retrieval, progress, and semantic index contracts.

- [x] T004 [S0004] Define parsed markdown note, heading, wikilink, tag, text chunk, and retrieval result contracts with types matching declared citation contract (`src/types/retrieval.ts`)
- [x] T005 [S0004] Define index job, progress, cancellation, freshness, lexical index, and semantic index contracts with exhaustive enum handling (`src/types/retrieval.ts`)
- [x] T006 [S0004] Implement markdown parser for frontmatter, body, headings, wikilinks, and tags with schema-validated input and explicit error mapping (`src/vectorstore/markdown-parser.ts`)
- [x] T007 [S0004] Implement deterministic chunk and snippet extraction with bounded lengths, heading context, and vault path traceability (`src/vectorstore/markdown-parser.ts`)
- [x] T008 [S0004] Implement index metadata and freshness helpers with stale-state transitions, deterministic ordering, and state reset on re-entry (`src/vectorstore/index-state.ts`)
- [x] T009 [S0004] Define semantic index compatibility helpers keyed by embedding model family with provider capability preflight contracts (`src/vectorstore/semantic-index.ts`)
- [x] T010 [S0004] Update source layout guide with vectorstore ownership, retrieval citation rules, and privacy boundary placement (`src/README.md`)

---

## Implementation (9 tasks)

Lexical indexing, semantic scaffolding, retrieval composition, and docs.

- [x] T011 [S0004] Implement lexical index builder over parsed notes with bounded tokenization, deterministic ordering, and cancellation checks (`src/vectorstore/lexical-index.ts`)
- [x] T012 [S0004] Implement in-memory lexical search with validated query input, bounded pagination, and deterministic score tie-breakers (`src/vectorstore/lexical-index.ts`)
- [x] T013 [S0004] Implement retrieval result composer for lexical hits with vault path, heading, snippet, score, and exhaustive enum handling (`src/vectorstore/retrieval-service.ts`)
- [x] T014 [S0004] Implement indexing service orchestration for fixture notes with progress callbacks, idempotency protection, and abort handling (`src/vectorstore/indexing-service.ts`)
- [x] T015 [S0004] Implement semantic index adapter skeleton keyed by embedding model family with provider preflight before private vault content embedding (`src/vectorstore/semantic-index.ts`)
- [x] T016 [S0004] [P] Create fixture vault indexing helpers with synthetic note loading and no provider secrets or personal content (`test/fixtures/vault/indexing-fixtures.ts`)
- [x] T017 [S0004] Update vault data model documentation with index freshness, embedding compatibility, and retrieval result traceability (`docs/vault-data-model.md`)
- [x] T018 [S0004] Complete indexing documentation with parsing boundaries, cancellation behavior, stale index state, and deferred ranking scope (`docs/indexing-retrieval-foundation.md`)
- [x] T019 [S0004] Wire vectorstore exports for parser, index state, lexical index, semantic index, indexing service, and retrieval service (`src/vectorstore/index.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T020 [S0004] Write unit tests for frontmatter, heading, wikilink, broken wikilink, tag, and chunk extraction (`test/indexing-retrieval-foundation.test.ts`)
- [x] T021 [S0004] Write unit tests for lexical indexing, bounded search limits, deterministic ordering, and traceable snippets (`test/indexing-retrieval-foundation.test.ts`)
- [x] T022 [S0004] Write unit tests for index freshness, stale state, progress snapshots, cancellation, and resume behavior (`test/indexing-retrieval-foundation.test.ts`)
- [x] T023 [S0004] Write unit tests for semantic embedding family compatibility and provider preflight denial before unsupported embedding (`test/indexing-retrieval-foundation.test.ts`)
- [x] T024 [S0004] Run build, type check, lint, tests, ASCII validation, and record command output summary (`.spec_system/specs/phase00-session04-indexing-retrieval-foundation/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
