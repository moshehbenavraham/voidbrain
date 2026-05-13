# Session Specification

**Session ID**: `phase00-session03-provider-privacy-boundaries`
**Phase**: 00 - Foundation
**Status**: Complete
**Completed**: 2026-05-12
**Created**: 2026-05-12

---

## 1. Session Overview

This session implements the provider privacy boundaries that make voidbrain's local-first promises enforceable in code. It converts the PRD requirements around local and cloud providers, model capabilities, secret handling, and cloud opt-in into typed contracts and pure services that later chat, indexing, ingestion, and agent workflows must call before provider invocation.

The work is intentionally boundary-first, not provider-client-first. The session should define provider and model metadata, capability checks, trust policy decisions, secret references, and redaction utilities without building full production adapters for every vendor. Unsupported capabilities and untrusted cloud disclosures must fail before any workflow can send vault content to a provider.

This is the third Phase 00 implementation session. It depends on the repository scaffold from Session 01 and the durable vault data model from Session 02. It enables Session 04 indexing and retrieval to reason about embedding capability, Session 05 agent surfaces to explain privacy rules accurately, and Session 06 staged-change and health workflows to keep logs and generated artifacts free of secrets.

---

## 2. Objectives

1. Define typed provider, model capability, trust, data-sensitivity, disclosure, secret-reference, and redaction contracts.
2. Implement provider capability selection and privacy guard services that fail closed for unsupported capabilities and untrusted cloud disclosure.
3. Add a secret storage abstraction and diagnostic redaction boundary that never writes raw secrets to markdown, logs, fixtures, or exported artifacts.
4. Extend local-first plugin settings validation enough to persist explicit cloud opt-in and trusted provider choices safely.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-repo-tooling-scaffold` - Provides TypeScript, Vite, Vitest, Biome, Obsidian plugin scaffolding, settings loading, and local validation scripts.
- [x] `phase00-session02-vault-data-model` - Provides vault artifact contracts, path validation, fixture vault data, and no-secret validation rules for durable markdown and JSON records.

### Required Tools/Knowledge
- TypeScript strict mode, discriminated unions, exhaustive enum checks, and typed validation results.
- Obsidian plugin settings behavior through `loadData` and `saveData`.
- Local-first provider architecture, cloud opt-in semantics, and provider capability modeling.
- Project terminology from `PRD.md`, `PRD_UX.md`, `CONVENTIONS.md`, and `docs/vault-data-model.md`.

### Environment Requirements
- Dependencies installed through the existing Bun workflow.
- No real provider secrets, API keys, personal vault content, or cloud calls required.
- Synthetic provider fixtures and docs examples only.

---

## 4. Scope

### In Scope (MVP)
- Developer can import provider and model contracts - define provider kind, trust level, model roles, model capabilities, content sensitivity, disclosure requests, secret references, and diagnostic redaction shapes.
- Workflow can fail before unsupported provider invocation - implement capability validation for chat, embeddings, streaming, tools, and attachment handling.
- Workflow can fail before untrusted cloud disclosure - implement a privacy guard that considers local-first settings, provider trust, cloud enablement, content sensitivity, and requested capability.
- Automated workflows can avoid raw secret persistence - add secret store and secret reference contracts that avoid markdown, logs, fixtures, and exports.
- Developer can run regression tests for local-first defaults, cloud opt-in, capability selection, and secret redaction.

### Out of Scope (Deferred)
- Production-grade provider clients for every vendor - *Reason: this session creates boundaries and preflight checks only.*
- Provider setup UI beyond settings contracts and minimal placeholders - *Reason: UI work belongs in later provider setup and settings sessions.*
- Live model list discovery from provider APIs - *Reason: network discovery requires concrete provider clients and retry policies.*
- Hosted account, billing, or team permission behavior - *Reason: explicitly outside the MVP PRD scope.*
- Final embedding or retrieval implementation - *Reason: deferred to `phase00-session04-indexing-retrieval-foundation`.*

---

## 5. Technical Approach

### Architecture

Keep provider-facing public contracts in `src/types/providers.ts` and provider services under `src/providers/`. The services should be pure or depend on small interfaces so they remain testable without Obsidian running. The plugin runtime can later wire these services into commands, settings, and views, but the privacy and capability decisions should not live in Svelte components or Obsidian lifecycle code.

Model provider metadata explicitly. A provider should describe whether it is local or cloud, whether it is trusted for private vault content, and which models satisfy chat, embedding, streaming, tool, and attachment capabilities. Workflows should submit a typed disclosure request that includes vault content sensitivity and required capability. The privacy guard should return a typed allow/deny decision with user-facing and diagnostic reasons, not throw for expected policy denial.

Secrets should flow through opaque references and redacted diagnostics. This session should provide a storage interface and a small baseline implementation suitable for tests, while leaving operating-system keychain integration or provider-specific auth flows for later. Redaction helpers must handle nested diagnostic objects and secret-like keys consistently with the vault data model's no-secret posture.

### Design Patterns
- Contract-first modeling: Define provider and model shapes before invocation adapters exist.
- Fail-closed privacy guards: Deny cloud disclosure unless settings and provider trust explicitly allow it.
- Capability preflight: Validate required capabilities before provider calls, not after provider failure.
- Secret references over secret values: Persist opaque IDs and metadata instead of raw credentials in durable artifacts.
- Pure service tests: Exercise policy decisions without Obsidian desktop or network calls.

### Technology Stack
- TypeScript 5.9 for strict interfaces, discriminated unions, and exhaustive switch checks.
- Vitest 4 for capability, privacy, settings, and redaction regression tests.
- Existing Obsidian plugin settings storage for local-first settings validation.
- Existing Bun scripts for build, type check, lint, test, and validation.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/provider-privacy-boundaries.md` | Human-readable provider, capability, trust, secret, and redaction boundary documentation | ~140 |
| `src/types/providers.ts` | Public provider, model capability, disclosure, trust, secret reference, and redaction contracts | ~220 |
| `src/providers/provider-registry.ts` | Synthetic baseline provider and model metadata plus deterministic lookup helpers | ~130 |
| `src/providers/capability-selection.ts` | Capability preflight service for selecting supported models before invocation | ~130 |
| `src/providers/privacy-guard.ts` | Local-first disclosure decision service for vault content and cloud opt-in | ~170 |
| `src/providers/secret-store.ts` | Secret storage abstraction, secret reference helpers, and safe test implementation | ~150 |
| `src/providers/redaction.ts` | Diagnostic redaction helper for nested secret-like keys and values | ~120 |
| `src/providers/index.ts` | Provider domain exports | ~40 |
| `test/fixtures/providers/synthetic-providers.ts` | Synthetic provider metadata fixtures with no real secrets | ~90 |
| `test/provider-privacy-boundaries.test.ts` | Unit tests for capability selection, privacy guard, settings, and redaction behavior | ~260 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/plugin.ts` | Add local-first provider policy settings with safe defaults | ~35 |
| `src/utils/settings.ts` | Validate provider privacy settings and reject malformed trusted-provider data | ~80 |
| `test/plugin-lifecycle.test.ts` | Cover provider policy defaults and recovery from malformed persisted settings | ~40 |
| `src/README.md` | Document provider domain ownership and privacy boundary placement | ~20 |
| `.spec_system/specs/phase00-session03-provider-privacy-boundaries/implementation-notes.md` | Implementation evidence and validation results | ~80 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Provider and model contracts represent chat, embeddings, streaming, tool calls, and attachment handling explicitly.
- [ ] Cloud provider use requires explicit cloud enablement plus trusted provider configuration.
- [ ] Vault content disclosure decisions fail closed for private content, unknown providers, unsupported capabilities, and malformed requests.
- [ ] Provider secrets are represented by opaque references and are never written to markdown, fixtures, logs, or diagnostic output.
- [ ] Unsupported capabilities fail before provider invocation.

### Testing Requirements
- [ ] Unit tests written and passing for model capability selection and unsupported capability denial.
- [ ] Unit tests written and passing for local-first defaults, cloud opt-in, and trusted cloud provider decisions.
- [ ] Unit tests written and passing for settings validation around provider privacy policy fields.
- [ ] Unit tests written and passing for secret reference behavior and nested diagnostic redaction.
- [ ] Manual review confirms synthetic fixtures and docs examples contain no real secrets or personal vault content.

### Non-Functional Requirements
- [ ] Automated workflows write zero provider secrets or API keys into markdown notes, logs, Git-tracked examples, fixtures, or generated exports.
- [ ] 100% of vault content remains local unless a cloud provider is explicitly enabled and trusted for the requested workflow.
- [ ] Provider decisions return actionable denial reasons suitable for later UI notices and agent surfaces.
- [ ] Provider services remain testable outside the Obsidian runtime.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations
- Privacy checks must run before provider invocation, retrieval synthesis, embedding creation, or agent tool execution.
- Local providers may still need capability checks; local does not mean every model supports embeddings, streaming, tool calls, or attachments.
- Cloud provider trust is explicit per provider or model role and should not be inferred from a non-empty endpoint or secret reference.
- Secrets should be passed as values only at runtime boundaries that actually authenticate, and diagnostics should contain redacted placeholders only.
- Settings validation should recover malformed provider policy data back to safe local-first defaults.

### Potential Challenges
- Provider capability scope can sprawl into full adapter design: keep this session focused on metadata, preflight, and tests.
- Secret storage can become platform-specific: define a small interface and test implementation now, leaving keychain or OS integrations for later.
- Cloud opt-in rules can become ambiguous: model denial reasons explicitly so later UI and agent surfaces can explain what blocked a workflow.
- Existing settings tests assume a small schema: update defaults and parser tests carefully so local-first recovery behavior stays intact.

### Relevant Considerations
- No active concerns or lessons in `CONSIDERATIONS.md` apply yet.
- `SECURITY-COMPLIANCE.md` currently reports no open findings; this session should preserve that posture by adding secret-leakage regression tests.

### Behavioral Quality Focus
Checklist active: Yes

Top behavioral risks for this session:
- A workflow could send private vault content to a cloud provider because trust and cloud enablement were modeled too loosely.
- A provider call could be attempted before checking that the selected model supports embeddings, streaming, tools, or attachments.
- A secret could leak through markdown examples, test fixtures, logs, thrown errors, or diagnostic objects.
- Settings recovery could preserve malformed trusted-provider state instead of returning to safe defaults.

---

## 9. Testing Strategy

### Unit Tests
- Test provider registry lookup, deterministic provider/model ordering, and unknown provider denial.
- Test capability selection for chat, embeddings, streaming, tools, and attachment handling.
- Test privacy guard decisions for local providers, disabled cloud providers, trusted cloud providers, untrusted providers, private vault content, and malformed requests.
- Test settings parser behavior for missing, valid, and malformed provider policy fields.
- Test secret references and redaction across nested objects, arrays, errors, and secret-like key names.

### Integration Tests
- Run `bun run build`, `bun run check`, `bun run lint`, and `bun run test`.
- Keep live provider API calls, network discovery, and Obsidian desktop runtime testing out of scope.

### Manual Testing
- Review `docs/provider-privacy-boundaries.md` against the PRD, UX PRD provider setup flow, and `CONVENTIONS.md` provider rules.
- Inspect synthetic provider fixtures to confirm they include no real provider keys, tokens, endpoints with credentials, or personal vault content.
- Confirm denial reasons are clear enough for later settings UI, notices, and agent markdown surfaces.

### Edge Cases
- Unknown provider IDs and model IDs.
- Cloud provider configured but global cloud workflows disabled.
- Cloud provider enabled but not trusted for private vault content.
- Requested capability not supported by the selected model.
- Attachment capability requested for a model that supports chat but not attachments.
- Secret-like keys nested in arrays, error objects, diagnostics, and provider metadata.
- Malformed settings arrays or non-string trusted provider IDs.

---

## 10. Dependencies

### External Libraries
- No new external libraries planned.

### Other Sessions
- **Depends on**: `phase00-session01-repo-tooling-scaffold`, `phase00-session02-vault-data-model`.
- **Depended by**: `phase00-session04-indexing-retrieval-foundation`, `phase00-session05-agent-surfaces-commands`, `phase00-session06-staged-changes-health-foundation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
