# Session Specification

**Session ID**: `phase01-session05-source-ingestion-staging`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session adds the first review-first source ingestion workflow for the Phase 01 MVP. It accepts user-approved markdown, text, pasted content, and URL source records, previews the privacy boundary and extraction plan, then turns the approved source into staged source, entity, concept, and summary notes.

The work matters because ingestion is the first workflow that creates new vault knowledge from outside material. It must preserve the local-first contract: no generated note is written directly to the user vault, no URL or provider path is used without explicit approval, and every generated claim links back to a source path, source record, or citation.

The implementation builds on completed provider preflight, indexing readiness, grounded chat, and staged-change primitives. It should make `voidbrain.ingest-source` usable for staging generated records while leaving diff review and apply behavior to the next session.

---

## 2. Objectives

1. Create typed source intake, preview, extraction plan, generated note, citation, staging, and recovery contracts for MVP source types.
2. Build a source ingestion staging service that creates reviewable staged-change records for source, entity, concept, and summary notes without applying them.
3. Validate generated records for safe vault paths, citation evidence, duplicate source detection, provider preflight, and fixture-safe diagnostics.
4. Wire a minimal Obsidian command surface for approved ingestion staging while keeping staged review and apply deferred.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session02-vault-data-model` - Provides generated note, source manifest, staged-change, runtime state, and validation contracts.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides provider trust, capability, redaction, and disclosure boundaries.
- [x] `phase00-session06-staged-changes-health-foundation` - Provides staged-change builders, diff context, conflicts, and recovery metadata.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides runtime provider setup, auth state, and cloud disclosure preflight.
- [x] `phase01-session03-indexing-runtime-retrieval-readiness` - Provides runtime index state and source traceability helpers.
- [x] `phase01-session04-grounded-vault-chat` - Provides provider chat invocation boundaries and recoverable thread patterns for provider-assisted summaries.

### Required Tools/Knowledge

- Existing `StagedChangeService` behavior in `src/agent/staged-change-service.ts`.
- Vault artifact path contracts in `src/utils/vault-paths.ts` and durable validation in `src/utils/vault-validation.ts`.
- Provider preflight, redaction, and chat provider adapter contracts in `src/providers/`.
- Obsidian command registration, modal lifecycle, plugin-owned data APIs, and cleanup patterns in `src/main.ts`.
- Vitest fixture patterns under `test/fixtures/vault/`.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixture vault content from `test/fixtures/vault/` in tests and examples.
- Do not fetch live URLs, call live providers, or send vault content to cloud providers during tests.
- Do not write provider secrets, authorization headers, raw hidden provider state, raw private source bodies, or private paths to docs, fixtures, logs, screenshots, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can provide approved markdown, text, pasted content, or a user-approved URL source record - validate type, source path, size limits, duplicate fingerprints, and privacy boundary before staging.
- User can preview source metadata and extraction plan - show source title, source type, target paths, provider requirement, citation expectations, and recovery identifiers before provider use.
- User can generate staged source, entity, concept, and summary notes - render frontmatter, wikilinks, source paths, citations, and review rationale for each staged record.
- User can recover ingestion staging attempts - preserve command ID, source path, staged-change IDs, validation output, provider decision, and target paths.
- Developer can test ingestion against synthetic fixtures - cover duplicate sources, unsafe paths, missing citations, provider denial, and no direct note mutation.

### Out of Scope (Deferred)

- Applying generated notes to the vault - *Reason: explicit review and apply behavior belongs to Session 06.*
- Image, PDF, audio, video, and large batch ingestion - *Reason: MVP ingestion starts with text-like source records.*
- Autonomous web research or unapproved URL fetching - *Reason: sources must be explicit and user-approved in this session.*
- Full staged-change review UI - *Reason: this session may preview ingestion output, but diff review and apply are handled later.*
- Multi-agent extraction or background batch jobs - *Reason: session scope stays single-source and recoverable.*

---

## 5. Technical Approach

### Architecture

Add contract-first ingestion types under `src/types/ingestion.ts`, then implement pure services under `src/agent/`. The intake service validates the source input, normalizes vault-relative paths, computes source fingerprints, detects duplicates from source manifests or existing staged records, and returns a preview that can be shown before any provider path is used.

The staging service orchestrates preview, optional provider-assisted extraction, deterministic fallback extraction, markdown rendering, citation validation, and staged-change creation. It should compose the existing `StagedChangeService` rather than creating a parallel mutation model. Staged records may be persisted as plugin-owned support records, but generated note targets must remain staged and never be applied to user notes.

Runtime wiring should stay in `src/main.ts`. A small Obsidian modal or command entry can collect a source path or pasted content, display preview and failure states, and invoke the staging service. Tests should inject synthetic providers and in-memory vault adapters so no live provider or real vault content is needed.

### Design Patterns

- Contract-first ingestion: define source inputs, previews, extraction plans, generated artifacts, citation evidence, validation output, and recovery records before UI wiring.
- Fail-closed source intake: reject absolute paths, traversal, unsafe support locations, unsupported types, unapproved URLs, and missing citation evidence.
- Preview gate: require source metadata, privacy boundary, provider requirement, target paths, and duplicate status before staging.
- Staged mutation boundary: use `StagedChangeService` for generated notes and keep apply behavior out of scope.
- Deterministic target paths: slug titles and artifact kinds into stable vault-relative paths with collision diagnostics.
- Redacted recovery: persist command ID, source path, staged-change IDs, target paths, and validation output, but not provider secrets or hidden state.

### Technology Stack

- TypeScript strict mode for ingestion contracts, services, renderer, store, and runtime wiring.
- Obsidian API for command registration, modal lifecycle, vault reads, plugin data, notices, and cleanup.
- Existing provider preflight and chat provider adapter for optional summary or extraction assistance.
- Existing staged-change, vault path, validation, and fixture safety utilities.
- Vitest with synthetic source fixtures and Obsidian mocks.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/ingestion.ts` | Source input, preview, extraction plan, generated artifact, citation, staging, provider decision, and recovery contracts. | ~280 |
| `src/agent/source-ingestion-intake-service.ts` | Validate source inputs, source paths, URL approval, duplicate fingerprints, target path previews, and provider requirements. | ~260 |
| `src/agent/source-citation-validation.ts` | Validate generated note citations, source paths, wikilinks, and recoverable validation output. | ~190 |
| `src/agent/source-ingestion-renderer.ts` | Render source, entity, concept, and summary markdown with frontmatter, wikilinks, and citation sections. | ~300 |
| `src/agent/source-ingestion-staging-service.ts` | Orchestrate preview, optional provider extraction, deterministic fallback extraction, citation validation, and staged-change creation. | ~420 |
| `src/stores/ingestion-staging-store.ts` | Track preview, staging progress, failure, staged IDs, retry state, and redacted local persistence. | ~210 |
| `src/views/source-ingestion-modal.ts` | Obsidian modal for source path or pasted content, preview, approve, stage, retry, and failure states. | ~320 |
| `docs/source-ingestion-staging.md` | Human-readable ingestion staging contract and privacy notes. | ~140 |
| `test/fixtures/vault/source-ingestion-fixtures.ts` | Synthetic source records, duplicate cases, unsafe examples, and expected staged artifact data. | ~220 |
| `test/source-ingestion-staging.test.ts` | Service tests for preview, duplicate detection, provider preflight, staging, recovery metadata, and no direct note mutation. | ~420 |
| `test/source-ingestion-modal.test.ts` | Modal and lifecycle tests for loading, empty, error, denied URL, approval, retry, and cleanup behavior. | ~260 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agent/index.ts` | Export ingestion intake, renderer, citation validation, staging service, and helpers. | ~30 |
| `src/agent/command-catalog.ts` | Update `voidbrain.ingest-source` from planned placeholder to implemented staging behavior once runtime wiring is complete. | ~60 |
| `src/agent/runtime-command-handlers.ts` | Add ingest command execution options and safe not-ready/error outcomes. | ~140 |
| `src/main.ts` | Instantiate ingestion services and store, register command/modal wiring, notices, plugin persistence, and cleanup. | ~220 |
| `test/__mocks__/obsidian.ts` | Extend mocks for modal lifecycle, vault reads, notices, and plugin data if needed. | ~120 |
| `test/plugin-lifecycle.test.ts` | Cover ingestion command registration, modal opening, provider-denial notices, cleanup, and no vault writes. | ~160 |
| `AGENTS.md` | Synchronize command table and safety language for implemented ingestion staging. | ~20 |
| `CLAUDE.md` | Synchronize command table and safety language for implemented ingestion staging. | ~20 |
| `GEMINI.md` | Synchronize command table and safety language for implemented ingestion staging. | ~20 |
| `skills/voidbrain/SKILL.md` | Synchronize command behavior and recovery notes for ingestion staging. | ~30 |
| `docs/agent-surfaces-commands.md` | Document implemented ingestion staging, limitations, citations, and recovery behavior. | ~60 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Source intake accepts markdown, text, pasted content, and explicitly approved URL source records only.
- [ ] Ingestion preview reports source metadata, privacy boundary, duplicate status, target paths, provider requirement, and citation expectations before provider use.
- [ ] Generated source, entity, concept, and summary notes include valid frontmatter, wikilinks, source paths, and citation evidence.
- [ ] Staging creates `StagedChangeRecord` outputs and never writes generated notes directly to user vault files.
- [ ] Failures preserve command ID, source path, staged-change IDs when available, target paths, validation output, and retry guidance.
- [ ] `voidbrain.ingest-source` surfaces implemented staging behavior without claiming apply support.

### Testing Requirements

- [ ] Unit tests cover source input validation, unsafe paths, unsupported types, unapproved URLs, duplicate detection, and target path collision previews.
- [ ] Unit tests cover citation validation for generated source, entity, concept, and summary notes.
- [ ] Unit tests cover provider preflight for local, trusted cloud, untrusted cloud, denied cloud, timeout, and deterministic fallback paths.
- [ ] Unit tests cover staged-change creation, duplicate in-flight protection, recovery metadata, validation output, and no direct note mutation.
- [ ] Runtime or modal tests cover loading, empty, error, denied URL, approve, stage, retry, focus behavior, and cleanup on close/unload.

### Non-Functional Requirements

- [ ] Privacy: source content remains local unless provider preflight explicitly allows the selected provider path.
- [ ] Security: provider secrets, tokens, authorization headers, hidden provider state, and raw private source bodies are not written to docs, fixtures, logs, diagnostics, or snapshots.
- [ ] Reliability: generated note mutations remain staged, diffable, and recoverable before any apply workflow.
- [ ] Data portability: staged outputs and recovery records remain readable as markdown or JSON support records.
- [ ] Performance: single-source preview and staging use bounded input sizes and deterministic ordering.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with recovery details

---

## 8. Implementation Notes

### Key Considerations

- Existing `StagedChangeService` already handles target validation, duplicate in-flight protection, diffs, conflicts, review flags, and recovery metadata; ingestion should compose it directly.
- Existing vault artifact path contracts already define `sources/`, `entities/`, `concepts/`, `summaries/`, and `.voidbrain/staged-changes/`.
- Source ingestion may use deterministic local extraction for fixtures and provider-assisted extraction only after provider preflight allows it.
- URL ingestion in this session means an explicitly approved source record or pasted URL metadata, not autonomous web crawling.
- Generated summaries need citations that point back to source paths or source records before they can be staged.

### Potential Challenges

- Title-to-path collisions can create confusing staged records: preview target paths first and surface blocking conflicts before staging.
- Provider extraction can accidentally bypass cloud review: route every provider-assisted step through existing provider preflight and redaction helpers.
- Generated entities and concepts can become noisy: keep MVP extraction deterministic, bounded, and citation-backed rather than trying to infer a complete knowledge graph.
- Runtime command input is limited in Obsidian commands: use a modal for source path or pasted content rather than hidden command parameters.
- Recovery records can leak raw source content: persist fingerprints, paths, titles, staged IDs, and validation output instead of full private bodies.

### Relevant Considerations

- [P00] **Tracker synchronization**: Update state, spec, tasks, command catalog, agent surfaces, docs, and validation artifacts together.
- [P00] **Staged-write gap**: Ingestion must create staged records only and leave apply behavior to Session 06.
- [P00] **Provider disclosure boundary**: Provider-assisted extraction or summaries must keep fail-closed disclosure preflight and recursive redaction.
- [P00] **Fixture safety**: Tests and examples must use synthetic source records and avoid secrets, personal data, private paths, and credential-like values.
- [P00] **Contract-first boundaries**: Keep ingestion contracts separate from provider, staged-change, retrieval, and UI wiring so later review/apply workflows can compose them.
- [P00] **Deterministic state models**: Preview status, staged IDs, provider decisions, and validation output should be explicit and testable.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A user can approve staging twice and create duplicate staged records for the same generated target path.
- A URL or cloud provider path can run before explicit approval and provider preflight.
- Generated notes can be staged without citations tied to source paths or source records.
- Modal close, retry, or plugin unload can leave stale preview state or partial staged IDs without recovery context.
- Failure diagnostics can expose provider secrets, hidden provider state, raw private source content, or private local paths.

---

## 9. Testing Strategy

### Unit Tests

- Test source input validation for empty content, unsupported types, unsafe paths, URL-like paths, unapproved URLs, oversized input, and duplicate fingerprints.
- Test preview generation for source metadata, target paths, provider requirement, duplicate status, citation expectations, and deterministic ordering.
- Test renderer output for frontmatter, wikilinks, source links, citation sections, ASCII content, and artifact-specific folders.
- Test citation validation for missing source paths, missing source records, summary citations, entity/concept references, and recoverable validation output.
- Test staging orchestration for success, partial validation failure, duplicate in-flight staging, provider denial, fallback extraction, and no direct note mutation.

### Integration Tests

- Test ingestion command registration and modal opening from plugin lifecycle.
- Test modal cleanup, retry, and close behavior with no leaked subscriptions or stale in-flight state.
- Test synthetic provider preflight denial and allowed local provider paths without live network calls.
- Test command catalog and markdown agent surfaces remain synchronized after `voidbrain.ingest-source` behavior changes.

### Manual Testing

- Open the ingest source command in Obsidian.
- Enter a synthetic source path or pasted markdown sample.
- Confirm preview shows privacy boundary, duplicate status, target paths, and citation requirements before staging.
- Stage generated notes and confirm staged-change IDs appear without applying any generated notes.
- Retry a denied provider path and confirm source content remains local and recoverable.

### Edge Cases

- Empty pasted content or whitespace-only markdown.
- Existing source manifest record with the same content hash.
- Generated target path collision with an existing note or active staged change.
- URL source without explicit approval.
- Cloud provider selected for private source content without trust or auth readiness.
- Generated summary with no citations.
- Modal closed during provider preflight or staged-change creation.
- Existing staged record validation failure after one of several generated artifacts is staged.

---

## 10. Dependencies

### External Libraries

- None expected. Use the existing TypeScript, Obsidian API, Vitest, Svelte/Vite, provider, staged-change, and validation stack.

### Other Sessions

- **Depends on**: `phase00-session02-vault-data-model`, `phase00-session03-provider-privacy-boundaries`, `phase00-session06-staged-changes-health-foundation`, `phase01-session02-provider-setup-privacy-preflight`, `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session04-grounded-vault-chat`
- **Depended by**: `phase01-session06-staged-change-review-apply`, `phase01-session07-vault-health-repair-staging`, `phase01-session08-hot-cache-mvp-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
