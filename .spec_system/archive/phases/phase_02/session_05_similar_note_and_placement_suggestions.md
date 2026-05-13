# Session 05: Similar Note and Placement Suggestions

**Session ID**: `phase02-session05-similar-note-placement-suggestions`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Add reviewable similar-note, wikilink, tag, and placement suggestions grounded
in local retrieval and vault metadata.

---

## Scope

### In Scope (MVP)

- Generate related-note candidates from lexical, semantic, wikilink, tag, and
  heading signals.
- Suggest wikilinks, aliases, folders, tags, or frontmatter placement with
  citations to the source note and related notes.
- Stage accepted suggestions through existing staged-change review paths with
  before and after diffs.
- Provide deterministic ranking, duplicate prevention, and synthetic fixture
  tests.

### Out of Scope

- Automatically reorganizing folders.
- Moving attachments without explicit review.
- Graph-only visual clustering.

---

## Prerequisites

- [ ] Lexical and semantic retrieval services are available.
- [ ] Vault path, frontmatter, wikilink, and metadata helpers exist.
- [ ] Staged-change review/apply supports update and frontmatter operations.

---

## Deliverables

1. Similar-note and placement suggestion service with typed evidence records.
2. UI or command-facing summary for suggested links, tags, and placement.
3. Tests for ranking, citations, duplicate prevention, and staged diffs.

---

## Success Criteria

- [ ] Suggestions cite local paths, headings, and source evidence.
- [ ] Existing wikilinks, aliases, and tags are not duplicated.
- [ ] Accepted suggestions are staged before any note mutation.
- [ ] Weak or ambiguous matches stay visible as low-confidence suggestions.
