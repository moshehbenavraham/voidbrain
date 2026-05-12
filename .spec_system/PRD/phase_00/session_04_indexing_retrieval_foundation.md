# Session 04: Indexing and Retrieval Foundation

**Session ID**: `phase00-session04-indexing-retrieval-foundation`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Create the indexing and retrieval service foundation needed for later grounded
vault chat and health workflows.

---

## Scope

### In Scope (MVP)

- Markdown parsing boundaries for paths, headings, wikilinks, tags, and
  frontmatter
- Lexical index interface and initial in-memory or file-backed implementation
- Semantic index abstraction keyed by embedding model family
- Retrieval result contract with vault paths, headings, snippets, and scores
- Progress, cancellation, and stale-index state contracts
- Fixture-based tests for indexing and traceable retrieval results

### Out of Scope

- Final ranking strategy for chat answers
- Production vector database integration
- Full graph visualization behavior

---

## Prerequisites

- [ ] Vault data model and fixture vault exist
- [ ] Provider capability contracts define embedding support

---

## Deliverables

1. Indexing service interfaces and lexical baseline implementation
2. Semantic index contract ready for model-backed embeddings
3. Retrieval result types that preserve citation traceability
4. Tests using fixture vault notes and generated metadata

---

## Success Criteria

- [ ] Retrieval results can be traced to vault paths and headings
- [ ] Index metadata records freshness and embedding model compatibility
- [ ] Indexing can be canceled or resumed without corrupting durable data
- [ ] Tests cover broken links, tags, headings, and frontmatter extraction
