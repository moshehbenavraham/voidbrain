# Session Specification

**Session ID**: `phase00-session02-vault-data-model`
**Phase**: 00 - Foundation
**Status**: Not Started
**Created**: 2026-05-12

---

## 1. Session Overview

This session defines the durable vault data model that later ingestion, retrieval, provider, and staged-write workflows will rely on. It turns the PRD language around sources, entities, concepts, summaries, conversations, hot cache, logs, indexes, and staged changes into concrete markdown and JSON contracts.

The work is intentionally contract-first. It should document the vault folder layout, define strict TypeScript interfaces for durable records, add validation helpers for untrusted vault metadata and paths, and create a synthetic fixture vault that tests can use without exposing provider secrets or real user notes.

This is the second Phase 00 implementation session. It depends on the repository and tooling scaffold from Session 01 and enables provider privacy boundaries, indexing and retrieval, agent surfaces, staged changes, and health checks to share the same source-of-truth vocabulary.

---

## 2. Objectives

1. Document the vault folder layout and artifact ownership rules for markdown notes and generated support files.
2. Define typed contracts for generated note frontmatter, source manifests, index metadata, hot cache state, operation logs, and staged-change records.
3. Implement path and record validation helpers that reject unsafe paths, malformed frontmatter, unsupported artifact kinds, and secret-bearing fields.
4. Create a synthetic fixture vault and unit tests that prove the contracts are readable as markdown or JSON and enforce local-first safety rules.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-repo-tooling-scaffold` - Provides TypeScript, Vite, Vitest, Biome, Obsidian plugin scaffolding, and local validation scripts.

### Required Tools/Knowledge
- TypeScript strict mode, discriminated unions, and typed validation results.
- Obsidian markdown conventions: frontmatter, wikilinks, headings, and vault-relative paths.
- Vitest fixture loading and synthetic test data design.
- Project terminology from `PRD.md` and `CONVENTIONS.md`.

### Environment Requirements
- Dependencies installed through the existing Bun workflow.
- No provider secrets, personal vault content, or real user data required.
- All durable examples must be synthetic and safe to commit.

---

## 4. Scope

### In Scope (MVP)
- Developer can inspect the vault data model in one document - add folder, markdown frontmatter, JSON support-file, and staging contract documentation.
- Developer can import typed contracts for vault artifacts - define TypeScript interfaces and unions for source, entity, concept, summary, conversation, hot cache, log, index, and staged-change records.
- Developer can validate untrusted vault paths and metadata - implement helpers that normalize vault-relative paths and reject absolute paths, traversal, malformed frontmatter, and unsupported artifact kinds.
- Developer can run tests against representative vault data - create a synthetic fixture vault with markdown notes, wikilinks, frontmatter, manifest records, index metadata, hot cache state, staged changes, and operation log examples.
- Automated workflows can avoid secret leakage - define contracts and tests that keep provider secrets and raw credentials out of markdown, fixtures, logs, manifests, and generated support files.

### Out of Scope (Deferred)
- Full ingestion pipeline - *Reason: deferred to later MVP workflows after contracts exist.*
- Semantic embeddings or vector persistence - *Reason: deferred to `phase00-session04-indexing-retrieval-foundation`.*
- Provider capability and trust enforcement - *Reason: deferred to `phase00-session03-provider-privacy-boundaries`.*
- Bulk migration of existing user vault content - *Reason: not part of MVP foundation scope.*
- Staged-change application and diff engine - *Reason: deferred to `phase00-session06-staged-changes-health-foundation`.*

---

## 5. Technical Approach

### Architecture

Keep durable data contracts in `src/types/vault.ts` so later services share one vocabulary. Keep validation and normalization logic in small pure utility modules under `src/utils/`, with no Obsidian runtime dependency. The plugin runtime can later call these helpers after receiving paths and metadata from Obsidian APIs, but this session should remain testable without Obsidian running.

Use markdown as the durable knowledge format and JSON as the durable support format. Generated notes should carry explicit artifact kind, stable IDs, source links, creation/update timestamps, and citation/source references where applicable. Generated support files should be recoverable and non-authoritative when they represent indexes or caches.

Tests should load synthetic fixtures and validate both happy paths and rejected inputs. Unsafe path handling, malformed frontmatter, unsupported artifact kinds, and secret-like fields must fail with explicit error codes so later UI and agent workflows can surface actionable diagnostics.

### Design Patterns
- Contract-first modeling: Define public shapes before implementing ingestion or retrieval behavior.
- Discriminated unions: Model artifact kind and operation kind explicitly instead of branching on display strings.
- Pure validation helpers: Return typed success/error results instead of throwing for expected malformed user data.
- Local-first fixture design: Use synthetic markdown and JSON examples that contain no provider secrets or personal vault content.
- Recoverable support files: Treat indexes, hot cache, and logs as support artifacts that can be rebuilt or audited.

### Technology Stack
- TypeScript 5.9 for strict interfaces, unions, and validation helpers.
- Vitest 4 for fixture-based tests.
- Markdown and JSON for durable fixture data.
- Existing Bun scripts for build, type check, lint, test, and validation.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/vault-data-model.md` | Human-readable folder, frontmatter, JSON, and safety contracts | ~180 |
| `src/types/vault.ts` | Public vault artifact, frontmatter, manifest, index, cache, log, and staged-change contracts | ~220 |
| `src/utils/vault-paths.ts` | Vault path constants, normalization, and unsafe path rejection | ~120 |
| `src/utils/vault-validation.ts` | Frontmatter and durable record validation helpers | ~180 |
| `test/fixtures/vault/README.md` | Synthetic fixture vault guide and no-secrets policy | ~40 |
| `test/fixtures/vault/sources/demo-article.md` | Source note fixture with frontmatter and wikilinks | ~40 |
| `test/fixtures/vault/entities/demo-researcher.md` | Entity note fixture linked to source records | ~35 |
| `test/fixtures/vault/concepts/local-first-vaults.md` | Concept note fixture with source references | ~35 |
| `test/fixtures/vault/summaries/demo-article-summary.md` | Summary fixture with citations back to source notes | ~35 |
| `test/fixtures/vault/conversations/2026-05-12-demo-chat.md` | Conversation fixture with tags and recoverable thread metadata | ~40 |
| `test/fixtures/vault/.voidbrain/manifests/sources.json` | Source manifest fixture | ~80 |
| `test/fixtures/vault/.voidbrain/runtime-state.json` | Index metadata, hot cache, staged-change, and operation log fixture | ~140 |
| `test/vault-data-model.test.ts` | Unit tests for path, frontmatter, and JSON contract validation | ~180 |
| `.spec_system/specs/phase00-session02-vault-data-model/implementation-notes.md` | Implementation evidence and validation results | ~80 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/README.md` | Document vault data model ownership under `types/` and `utils/` | ~20 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Durable knowledge contracts are documented as markdown and JSON without requiring an external database.
- [ ] Generated note frontmatter can represent sources, entities, concepts, summaries, and conversations with source traceability.
- [ ] Support-file contracts cover source manifests, index metadata, hot cache state, operation logs, and staged changes.
- [ ] Path validation rejects absolute paths, parent traversal, empty paths, and unsupported generated artifact locations.
- [ ] Validation rejects malformed frontmatter, unsupported artifact kinds, and secret-like fields in fixtures or support records.

### Testing Requirements
- [ ] Unit tests written and passing for path normalization and unsafe path rejection.
- [ ] Unit tests written and passing for frontmatter validation across generated markdown fixtures.
- [ ] Unit tests written and passing for JSON support-file contracts.
- [ ] Manual review confirms fixtures are synthetic and contain no secrets or personal vault content.

### Non-Functional Requirements
- [ ] Durable user-facing and AI-generated knowledge remains readable as local markdown or JSON.
- [ ] Generated notes include traceable source links or source records when making factual claims.
- [ ] Automated workflows write zero provider secrets or API keys into markdown, logs, fixtures, manifests, or exports.
- [ ] Contracts are strict enough to support later indexing, provider privacy, staged-write, and health-check sessions.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations
- The vault remains the source of truth; indexes and hot cache records are derived support data.
- Keep fixtures small, synthetic, and representative enough for later sessions to reuse.
- Prefer explicit enums/unions and validation result codes over permissive stringly typed contracts.
- Avoid storing provider secrets, endpoint credentials, raw API headers, or hidden provider state in any durable artifact.

### Potential Challenges
- Frontmatter parsing can drift into ad hoc YAML parsing: use validation of parsed metadata objects for this session and leave parser choice to a later implementation if needed.
- Data model scope can expand quickly: keep this session focused on contracts and validation, not ingestion, retrieval, graph, or staged apply behavior.
- Test fixtures may accidentally imply production folder names too early: document which paths are stable MVP contracts and which are support-file examples.
- Staged-change records overlap with Session 06: define the durable shape only, leaving apply, diff, conflict, and recovery workflows to Session 06.

### Relevant Considerations
- No active concerns or lessons in `CONSIDERATIONS.md` apply yet.

### Behavioral Quality Focus
Checklist active: Yes

Top behavioral risks for this session:
- Unsafe vault paths could later allow accidental writes outside the vault.
- Malformed or ambiguous frontmatter could make generated notes untraceable.
- Support fixtures or logs could accidentally normalize storing provider secrets.
- Derived index and cache files could be mistaken for the durable source of truth.

---

## 9. Testing Strategy

### Unit Tests
- Test path normalization for valid vault-relative paths, wikilink-safe paths, absolute path rejection, traversal rejection, and empty path rejection.
- Test frontmatter validation for source, entity, concept, summary, and conversation fixtures.
- Test durable JSON validation for source manifests, index metadata, hot cache state, operation logs, and staged-change records.
- Test secret-like field rejection in markdown metadata and support records.

### Integration Tests
- Run `bun run build`, `bun run check`, `bun run lint`, and `bun run test`.
- Keep Obsidian desktop runtime integration out of scope for this contract session.

### Manual Testing
- Review `docs/vault-data-model.md` against the PRD and UX PRD for terminology consistency.
- Inspect fixtures to confirm all content is synthetic and safe to commit.
- Confirm generated notes link back to source records through vault-relative paths or wikilinks.

### Edge Cases
- Empty, absolute, Windows drive, URL-like, and parent traversal paths.
- Unknown artifact kind values and missing required frontmatter fields.
- Secret-like keys such as `apiKey`, `token`, `authorization`, `password`, or `secret`.
- Derived support records that reference missing source notes or unsupported index states.

---

## 10. Dependencies

### External Libraries
- No new external libraries planned.

### Other Sessions
- **Depends on**: `phase00-session01-repo-tooling-scaffold`.
- **Depended by**: `phase00-session03-provider-privacy-boundaries`, `phase00-session04-indexing-retrieval-foundation`, `phase00-session05-agent-surfaces-commands`, `phase00-session06-staged-changes-health-foundation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
