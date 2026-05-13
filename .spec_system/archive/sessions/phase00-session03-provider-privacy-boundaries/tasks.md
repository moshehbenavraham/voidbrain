# Task Checklist

**Session ID**: `phase00-session03-provider-privacy-boundaries`
**Total Tasks**: 23
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-12
**Completed**: 2026-05-12

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
| Foundation | 6 | 6 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **23** | **23** | **0** |

---

## Setup (3 tasks)

Initial setup, documentation entry points, and provider-domain boundaries.

- [x] T001 [S0003] Verify Session 01 and Session 02 prerequisites, provider privacy assumptions, and no-secret implementation constraints (`.spec_system/specs/phase00-session03-provider-privacy-boundaries/implementation-notes.md`)
- [x] T002 [S0003] [P] Create provider privacy boundary documentation shell with trust, capability, secret, and redaction sections (`docs/provider-privacy-boundaries.md`)
- [x] T003 [S0003] [P] Create provider domain export surface for future services and tests (`src/providers/index.ts`)

---

## Foundation (6 tasks)

Core provider contracts, capability metadata, and local-first policy primitives.

- [x] T004 [S0003] Define provider kind, trust level, provider identity, model role, and content sensitivity contracts with exhaustive enum handling (`src/types/providers.ts`)
- [x] T005 [S0003] Define model capability contracts for chat, embeddings, streaming, tools, and attachments with types matching declared contract (`src/types/providers.ts`)
- [x] T006 [S0003] Define disclosure request, disclosure decision, secret reference, and redacted diagnostic contracts without raw secret-bearing fields (`src/types/providers.ts`)
- [x] T007 [S0003] Implement capability preflight helper with schema-validated input and explicit error mapping (`src/providers/capability-selection.ts`)
- [x] T008 [S0003] Implement synthetic baseline provider registry and deterministic lookup helpers with exhaustive enum handling (`src/providers/provider-registry.ts`)
- [x] T009 [S0003] Update source layout guide to document provider domain ownership and where privacy checks must run (`src/README.md`)

---

## Implementation (9 tasks)

Provider policy, secret handling, redaction, and docs implementation.

- [x] T010 [S0003] Extend plugin settings with local-first provider policy fields and safe cloud opt-in defaults (`src/types/plugin.ts`)
- [x] T011 [S0003] Extend settings parser for provider policy fields with schema-validated input and explicit error mapping (`src/utils/settings.ts`)
- [x] T012 [S0003] Implement privacy guard service for vault disclosure decisions with authorization enforced at the boundary closest to the resource (`src/providers/privacy-guard.ts`)
- [x] T013 [S0003] Implement provider invocation preflight composition for privacy and capability checks with exhaustive denial reasons (`src/providers/privacy-guard.ts`)
- [x] T014 [S0003] [P] Implement secret storage abstraction and safe in-memory test implementation with duplicate-trigger prevention while in-flight (`src/providers/secret-store.ts`)
- [x] T015 [S0003] [P] Implement nested diagnostic redaction helper with schema-validated input and explicit error mapping (`src/providers/redaction.ts`)
- [x] T016 [S0003] [P] Create synthetic provider fixture metadata with no real endpoints, keys, tokens, or personal vault content (`test/fixtures/providers/synthetic-providers.ts`)
- [x] T017 [S0003] Wire provider domain exports for contracts, registry, guards, secret store, and redaction helpers (`src/providers/index.ts`)
- [x] T018 [S0003] Complete provider privacy documentation with cloud opt-in, capability failure, secret storage, and log redaction behavior (`docs/provider-privacy-boundaries.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T019 [S0003] Update plugin lifecycle tests for provider policy defaults and recovered malformed provider settings (`test/plugin-lifecycle.test.ts`)
- [x] T020 [S0003] Write unit tests for provider registry and capability selection denial before unsupported invocation (`test/provider-privacy-boundaries.test.ts`)
- [x] T021 [S0003] Write unit tests for privacy guard local-first defaults, cloud opt-in, trusted providers, and private vault content (`test/provider-privacy-boundaries.test.ts`)
- [x] T022 [S0003] Write unit tests for secret references and nested diagnostic redaction of logs, errors, arrays, and secret-like keys (`test/provider-privacy-boundaries.test.ts`)
- [x] T023 [S0003] Run build, type check, lint, tests, ASCII validation, and record command output summary (`.spec_system/specs/phase00-session03-provider-privacy-boundaries/implementation-notes.md`)

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

Run the validate workflow step to verify session completeness.
