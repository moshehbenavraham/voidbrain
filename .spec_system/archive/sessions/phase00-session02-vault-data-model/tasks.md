# Task Checklist

**Session ID**: `phase00-session02-vault-data-model`
**Total Tasks**: 22
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
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **22** | **22** | **0** |

---

## Setup (3 tasks)

Initial setup, documentation entry points, and fixture boundaries.

- [x] T001 [S0002] Verify Session 01 scaffold prerequisites and record implementation assumptions (`.spec_system/specs/phase00-session02-vault-data-model/implementation-notes.md`)
- [x] T002 [S0002] [P] Create fixture vault directory guide with synthetic-data and no-secrets policy (`test/fixtures/vault/README.md`)
- [x] T003 [S0002] [P] Create vault data model documentation shell with folder, frontmatter, JSON, and safety sections (`docs/vault-data-model.md`)

---

## Foundation (7 tasks)

Core data model contracts, path rules, and validation primitives.

- [x] T004 [S0002] Define durable folder conventions for sources, entities, concepts, summaries, conversations, indexes, hot cache, logs, and staged changes (`docs/vault-data-model.md`)
- [x] T005 [S0002] [P] Define artifact kind, normalized vault path, wikilink, timestamp, and validation result contracts (`src/types/vault.ts`)
- [x] T006 [S0002] Define source, entity, concept, summary, conversation, and generated-note frontmatter contracts (`src/types/vault.ts`)
- [x] T007 [S0002] Define source manifest, index metadata, hot cache, operation log, and staged-change JSON contracts without secret-bearing fields (`src/types/vault.ts`)
- [x] T008 [S0002] [P] Implement vault path constants and normalization with schema-validated input and explicit error mapping (`src/utils/vault-paths.ts`)
- [x] T009 [S0002] Implement frontmatter and durable record validation helpers with exhaustive artifact kind handling (`src/utils/vault-validation.ts`)
- [x] T010 [S0002] Update source layout guide to document data model ownership under `types/` and `utils/` (`src/README.md`)

---

## Implementation (8 tasks)

Representative synthetic fixture vault and artifact-specific validation.

- [x] T011 [S0002] [P] Create synthetic source note fixture with frontmatter, body content, and no provider secrets (`test/fixtures/vault/sources/demo-article.md`)
- [x] T012 [S0002] [P] Create synthetic entity note fixture linked to the source note (`test/fixtures/vault/entities/demo-researcher.md`)
- [x] T013 [S0002] [P] Create synthetic concept note fixture with source references and wikilinks (`test/fixtures/vault/concepts/local-first-vaults.md`)
- [x] T014 [S0002] [P] Create synthetic summary note fixture with citations back to the source record (`test/fixtures/vault/summaries/demo-article-summary.md`)
- [x] T015 [S0002] [P] Create synthetic conversation fixture with recoverable thread metadata and tags (`test/fixtures/vault/conversations/2026-05-12-demo-chat.md`)
- [x] T016 [S0002] [P] Create source manifest fixture with schema-validated records and deterministic ordering (`test/fixtures/vault/.voidbrain/manifests/sources.json`)
- [x] T017 [S0002] [P] Create runtime support fixture covering index metadata, hot cache, staged changes, and operation log examples (`test/fixtures/vault/.voidbrain/runtime-state.json`)
- [x] T018 [S0002] Connect artifact-specific validators to markdown and JSON fixture contracts with explicit error mapping (`src/utils/vault-validation.ts`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T019 [S0002] Write unit tests for vault path normalization, deterministic ordering, and unsafe path rejection (`test/vault-data-model.test.ts`)
- [x] T020 [S0002] Write unit tests for frontmatter and JSON contract validation using fixture vault data (`test/vault-data-model.test.ts`)
- [x] T021 [S0002] Run build, type check, lint, and tests; record command output summary and blockers (`.spec_system/specs/phase00-session02-vault-data-model/implementation-notes.md`)
- [x] T022 [S0002] Validate ASCII encoding and Unix LF line endings for created data model files (`.spec_system/specs/phase00-session02-vault-data-model/implementation-notes.md`)

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
