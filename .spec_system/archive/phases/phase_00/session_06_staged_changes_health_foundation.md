# Session 06: Staged Changes and Health Foundation

**Session ID**: `phase00-session06-staged-changes-health-foundation`
**Status**: Complete
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Implement the foundational staged-change and vault-health primitives that make
AI-created note mutations reviewable, reversible, and auditable.

---

## Scope

### In Scope (MVP)

- Staged change record model for create, update, delete, move, and frontmatter
  edit operations
- Diff and conflict detection contracts for existing user notes
- Recovery metadata for backups, rejected changes, and failed applies
- Health check report model for orphans, broken links, stale indexes, and
  missing citations
- Tests for safe staging, conflict handling, and report generation on fixtures

### Out of Scope

- Complete review UI for every staged change type
- Automated repair of unsafe findings
- Destructive auto-apply workflows

---

## Prerequisites

- [x] Vault data model and indexing foundation exist
- [x] Privacy boundaries and agent command rules are documented

---

## Deliverables

1. Staged change service contracts and baseline implementation
2. Conflict and recovery metadata for note mutations
3. Vault health report types and fixture-based scanner skeleton
4. Tests proving destructive changes require explicit review paths

---

## Success Criteria

- [x] AI-proposed note mutations are represented as staged changes first
- [x] Existing note edits expose before and after content
- [x] Health findings link to affected vault paths
- [x] Tests cover data loss, stale index, broken link, and missing citation cases
