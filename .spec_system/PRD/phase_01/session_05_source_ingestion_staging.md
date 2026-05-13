# Session 05: Source Ingestion Staging

**Session ID**: `phase01-session05-source-ingestion-staging`
**Status**: Complete
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Convert approved source material into citation-backed staged markdown records for sources, entities, concepts, and summaries.

---

## Scope

### In Scope (MVP)

- Accept markdown, text, pasted content, and explicitly approved URL source records.
- Preview source metadata, privacy boundary, duplicate detection, and extraction plan before provider use.
- Generate staged source, entity, concept, and summary notes with frontmatter, wikilinks, and source citations.
- Validate staged records for safe vault paths, citation evidence, and fixture-safe examples.
- Preserve command ID, source path, staged-change ID, and validation output for recovery.

### Out of Scope

- Image, PDF, audio, video, and large batch ingestion.
- Applying generated notes without staged review.
- Autonomous web research beyond a user-approved source.

---

## Prerequisites

- [ ] Session 02 completed.
- [ ] Session 03 completed.
- [ ] Session 04 completed if ingestion summaries use the chat provider path.
- [ ] Phase 00 staged-change and vault data contracts are available.

---

## Deliverables

1. Source intake and preview service for MVP source types.
2. Ingestion staging service that creates reviewable staged-change records.
3. Citation validation for generated source-derived notes.
4. Tests for duplicate sources, unsafe paths, provider preflight, and recovery metadata.

---

## Success Criteria

- [x] Ingestion never writes directly to user notes.
- [x] Generated notes link back to source paths or source records.
- [x] Unsupported or unsafe sources fail closed with recoverable diagnostics.
- [x] Tests use only synthetic fixture vault content.
