# Session 02: Vault Data Model

**Session ID**: `phase00-session02-vault-data-model`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Define the durable markdown and JSON data contracts for vault intelligence
objects before ingestion, retrieval, and mutation workflows are implemented.

---

## Scope

### In Scope (MVP)

- Folder and file conventions for sources, entities, concepts, summaries,
  conversations, hot cache, logs, indexes, and staged changes
- Frontmatter contracts for generated and user-facing markdown artifacts
- JSON schemas or typed interfaces for manifests, staging records, and index
  metadata
- Fixture vault with representative notes, wikilinks, frontmatter, and source
  records
- Tests for schema validation and path normalization

### Out of Scope

- Full ingestion pipeline
- Semantic embeddings or vector storage
- Bulk migration of existing user vault content

---

## Prerequisites

- [ ] Repository and tooling scaffold is available
- [ ] Product language from PRD and `CONVENTIONS.md` is reflected in names

---

## Deliverables

1. Documented vault folder and artifact contracts
2. Typed data models for durable files and generated support files
3. Fixture vault covering the core data shapes
4. Validation tests for schemas, paths, and frontmatter rules

---

## Success Criteria

- [ ] Durable knowledge remains readable as markdown or JSON
- [ ] Generated notes can link back to source records
- [ ] Tests reject malformed frontmatter or unsafe paths
- [ ] Contracts avoid storing secrets, raw credentials, or hidden provider state
