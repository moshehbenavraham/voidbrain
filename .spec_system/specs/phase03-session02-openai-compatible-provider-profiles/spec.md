# Session Specification

**Session ID**: `phase03-session02-openai-compatible-provider-profiles`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Not Started
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens OpenAI-compatible provider profile handling for local-compatible, custom remote, trusted cloud, and untrusted cloud endpoint shapes. It builds on Session 01 local runtime readiness by making endpoint classification, opaque credential references, trust state, auth readiness, and model capability mapping explicit before provider-backed workflows can run.

The work matters because OpenAI-compatible APIs can point at a local runtime, a self-hosted remote endpoint, or a public cloud endpoint. Voidbrain must not infer that a provider is safe from URL shape alone, silently promote local workflows to remote disclosure, or persist raw credentials, authorization headers, prompt bodies, private note bodies, or hidden provider state while testing auth and model capabilities.

This is a profile, readiness, and preflight session. It should strengthen typed provider contracts, profile parsing, auth-test boundaries, setup summaries, privacy preflight diagnostics, settings recovery, and synthetic tests. Cancellable chat or embedding adapter invocation, retry policy around real provider calls, and offline embedding index compatibility remain deferred to later Phase 03 sessions.

---

## 2. Objectives

1. Define OpenAI-compatible endpoint classification contracts for local-compatible, custom remote, trusted cloud, and untrusted cloud profiles.
2. Require opaque credential references and redacted auth-test diagnostics for remote and cloud OpenAI-compatible providers.
3. Map configured or discovered models to chat, streaming, embeddings, tools, and attachment capability readiness with stable denial codes.
4. Ensure private-vault disclosure fails closed until cloud enablement, provider trust, auth readiness, and capability checks all pass.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-local-runtime-provider-profiles` - Provides local runtime profile contracts, readiness records, settings recovery, and selected local preflight behavior.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides provider setup, auth-test, privacy preflight, trust policy, settings, redaction, and role selection foundations.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides baseline provider, capability, disclosure, trust, redaction, and secret-store contracts.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest provider fixture patterns under `test/fixtures/providers/`.
- Provider profile, auth-test, preflight, privacy guard, redaction, registry, and settings services under `src/providers/` and `src/utils/`.
- Strict TypeScript provider contracts under `src/types/providers.ts` and `src/types/provider-setup.ts`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/newproject`.
- Validation runs from the repository root with Bun available.
- Tests use synthetic provider fixtures only.
- No live cloud provider call, private vault content, credential, authorization header, or remote account is required.

---

## 4. Scope

### In Scope (MVP)
- User can define OpenAI-compatible provider profiles for local-compatible, custom remote, trusted cloud, and untrusted cloud endpoints - add typed endpoint classification and setup-safe metadata.
- User can store provider credentials through opaque secret references only - reject raw credential-like profile fields and keep auth diagnostics redacted.
- User can see auth and capability readiness before workflows run - map model capability support and auth-test status to stable readiness and denial codes.
- User can keep private-vault disclosure gated - require cloud enablement, trusted provider IDs, auth readiness, and model capability compatibility before preflight can pass.
- Developer can validate OpenAI-compatible provider safety locally - add synthetic tests for local-compatible, trusted cloud, untrusted cloud, custom remote, missing-secret, auth-failed, and capability mismatch states.

### Out of Scope (Deferred)
- Provider billing, account management, marketplace discovery, or installation - *Reason: provider account lifecycle is outside Phase 03 MVP scope.*
- Real provider chat or embedding adapter invocation - *Reason: cancellable transport, retry, timeout, duplicate invocation, and adapter payload boundaries belong to Session 03.*
- Semantic index compatibility and reindex guidance - *Reason: embedding family compatibility belongs to Session 04.*
- Provider troubleshooting UI and docs - *Reason: user-facing recovery surfaces belong to Session 05.*
- Automatically trusting custom remote endpoints - *Reason: custom endpoints must remain explicit and fail closed until trusted in settings.*
- Live URL fetching or provider model discovery against user credentials - *Reason: this session uses synthetic fixtures and injected auth probes only.*

---

## 5. Technical Approach

### Architecture
Extend provider setup around explicit OpenAI-compatible profile contracts. Keep shared provider types in `src/types/provider-setup.ts` and `src/types/providers.ts`, OpenAI-compatible endpoint and readiness helpers in `src/providers/openai-compatible-profiles.ts`, profile parsing in `src/providers/provider-profile-service.ts`, auth-test boundaries in `src/providers/provider-auth-test.ts`, and privacy/setup preflight enforcement in `src/providers/provider-preflight.ts` and `src/providers/privacy-guard.ts`.

OpenAI-compatible profile parsing should classify endpoints deterministically from the endpoint host, provider kind, trust level, and profile metadata. Local-compatible endpoints stay local. Custom remote and cloud endpoints are remote disclosure paths and must not pass private-vault preflight unless cloud use is enabled, the provider ID is trusted, auth has passed, and the selected model supports the required role and capability. Durable support and setup records may include provider IDs, endpoint classifications, hostnames, model IDs, capability codes, auth status, readiness codes, status codes, durations, and source path counts, but not raw runtime credentials, authorization headers, prompt bodies, note bodies, or hidden transport state.

### Design Patterns
- Contract-first modeling: Add endpoint classification, readiness, and denial contracts before services consume them.
- Fail-closed disclosure: Missing trust, missing secret, failed auth, unsupported capability, or untrusted remote classification denies private-vault preflight.
- Opaque credential references: Profiles store secret references, never credential values or authorization headers.
- Redacted diagnostics: Auth-test and setup diagnostics pass through existing redaction before persistence or user-facing summaries.
- Deterministic ordering: Profiles, models, capability summaries, and diagnostics sort by stable provider and model IDs.

### Technology Stack
- TypeScript 5.9 strict contracts.
- Vitest 4 for provider, settings, and preflight regression tests.
- Bun validation scripts.
- Existing Obsidian plugin settings types and provider services.
- Existing `src/providers/redaction.ts`, `src/providers/provider-profile-service.ts`, `src/providers/provider-auth-test.ts`, `src/providers/provider-preflight.ts`, and `src/providers/privacy-guard.ts`.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/providers/openai-compatible-profiles.ts` | Endpoint classification, trust/auth readiness mapping, capability readiness helpers, and safe diagnostics | ~220 |
| `test/fixtures/providers/openai-compatible-provider-fixtures.ts` | Synthetic local-compatible, custom remote, trusted cloud, untrusted cloud, missing-secret, auth-failed, and capability mismatch fixtures | ~180 |
| `test/openai-compatible-provider-profiles.test.ts` | Unit and regression tests for OpenAI-compatible contracts, classification, redaction, auth readiness, and capability mapping | ~260 |
| `.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/implementation-notes.md` | Implementation notes for this session | ~100 |
| `.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/security-compliance.md` | Session security and privacy review | ~90 |
| `.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/validation.md` | Validation command results and residual failures | ~100 |
| `.spec_system/specs/phase03-session02-openai-compatible-provider-profiles/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~90 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/provider-setup.ts` | Add OpenAI-compatible endpoint classification, readiness, and stable denial contracts | ~130 |
| `src/types/providers.ts` | Add setup-safe OpenAI-compatible metadata fields for endpoint classification, trust, auth, and capability evidence | ~70 |
| `src/providers/provider-profile-service.ts` | Parse and validate OpenAI-compatible endpoint classifications, credential references, trust state, models, and unsafe provider state | ~130 |
| `src/providers/provider-auth-test.ts` | Map OpenAI-compatible auth results to redacted readiness records and missing-secret or failed-auth states | ~90 |
| `src/providers/provider-preflight.ts` | Enforce OpenAI-compatible cloud, trust, auth, and capability gates before private-vault disclosure can pass | ~100 |
| `src/providers/privacy-guard.ts` | Include endpoint classification and stable denial diagnostics in disclosure decisions | ~70 |
| `src/providers/index.ts` | Export OpenAI-compatible profile contracts and helpers | ~10 |
| `src/utils/settings.ts` | Parse, recover, deduplicate, and redact persisted OpenAI-compatible readiness and auth state | ~100 |
| `test/fixtures/providers/provider-setup-fixtures.ts` | Add reusable synthetic OpenAI-compatible profile and auth fixtures | ~90 |
| `test/provider-setup-privacy-preflight.test.ts` | Add remote/cloud preflight denial, trust, auth, and capability regression coverage | ~140 |
| `test/plugin-settings-runtime.test.ts` | Add settings parse and recovery coverage for OpenAI-compatible readiness and trust records | ~100 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] OpenAI-compatible profiles classify endpoints as local-compatible, custom remote, trusted cloud, or untrusted cloud with setup-safe metadata.
- [ ] Remote and cloud OpenAI-compatible profiles use opaque credential references and fail auth readiness when the secret reference is missing or unreadable.
- [ ] Model capabilities map to chat, streaming, embeddings, tools, and attachments with stable capability mismatch denial codes.
- [ ] Private-vault preflight fails closed until cloud use is enabled, the provider ID is trusted, auth has passed, and the selected model supports the requested role and capability.
- [ ] Setup summaries and diagnostics expose only provider IDs, endpoint classifications, hostnames, model IDs, readiness codes, counts, durations, status codes, and redacted diagnostics.

### Testing Requirements
- [ ] Unit tests written and passing for endpoint classification, profile validation, credential reference handling, unsafe provider state rejection, and capability mapping.
- [ ] Provider setup preflight tests written and passing for local-compatible, trusted cloud, untrusted cloud, custom remote, missing-secret, auth-failed, and capability mismatch states.
- [ ] Settings parse and recovery tests written and passing for OpenAI-compatible auth and readiness records.
- [ ] Manual review confirms generated examples and fixtures are synthetic and fixture-safe.

### Non-Functional Requirements
- [ ] Local-first privacy behavior remains explicit and no OpenAI-compatible remote endpoint receives private-vault content without provider review and trust settings.
- [ ] Provider diagnostics contain no secrets, authorization headers, prompt bodies, raw private note bodies, private path hints, or hidden transport state.
- [ ] Auth readiness behavior is timeout-bounded, redacted, and deterministic under synthetic tests.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.
- [ ] `bun run validate:agent-surfaces` passes.
- [ ] `bun run validate:fixture-safety` passes.
- [ ] `bun run validate:agent-docs` passes.
- [ ] `bun run validate` passes or residual failures are recorded with recovery details.

---

## 8. Implementation Notes

### Key Considerations
- Keep endpoint classification separate from provider trust settings; a remote endpoint is not safe just because a profile exists.
- Do not introduce live provider calls into tests; use injected auth probes and synthetic model metadata.
- Do not allow custom remote endpoints to become trusted automatically.
- Preserve existing local runtime behavior from Session 01 while adding OpenAI-compatible remote and cloud profile rules.
- Keep durable support records useful for recovery without storing raw transport payloads.

### Potential Challenges
- Existing code treats `profileKind: "openai-compatible"` as a cloud-only profile: update parsing carefully so local-compatible endpoints and remote endpoints remain explicit and test-covered.
- Trust can be represented both by profile metadata and settings: use profile metadata for classification and settings for disclosure authorization.
- Capability mismatches can be confused with auth failures: keep denial codes stable and specific.
- Redaction regressions can be subtle: assert serialized records do not contain secret-like, authorization-like, prompt-like, or private path values.

### Relevant Considerations
- [P02] **Workflow drift risk**: Keep Phase 03 session records, task lists, and provider docs synchronized with provider behavior changes.
- [P02] **Spec script parity**: Preserve local analyzer behavior and do not rely on missing local spec scripts for validation.
- [P01] **Obsidian runtime variance**: Keep settings and provider setup behavior resilient without assuming a live Obsidian runtime or specific provider account.
- [P01] **Disclosure gates stay mandatory**: Cloud and custom remote endpoints require explicit trust, auth, capability, and disclosure preflight before private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, readiness records, auth records, and summaries must exclude secrets, raw note bodies, prompts, and hidden provider state.
- [P01] **Review-first mutations**: Provider-assisted note output remains outside this session and must continue through staged review paths later.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Remote OpenAI-compatible endpoints may be treated as safe or trusted because they share an OpenAI-compatible API shape.
- Missing secrets, failed auth, or model capability mismatches may surface as generic readiness failures that hide the correct user action.
- Diagnostics may accidentally preserve raw auth material, prompt previews, private paths, or provider transport state.

---

## 9. Testing Strategy

### Unit Tests
- Test endpoint classification for localhost, loopback, custom remote, trusted cloud, and untrusted cloud inputs.
- Test profile validation for invalid URL, endpoint credentials, duplicate model IDs, missing credential reference, unsafe provider state, and unsupported trust combinations.
- Test capability readiness for chat, streaming, embeddings, tools, attachments, missing model, and capability mismatch states.
- Test auth readiness mapping for passed, failed, timeout, missing-secret, and redacted diagnostic paths.

### Integration Tests
- Test settings load and recovery with OpenAI-compatible profiles, auth statuses, trust lists, malformed readiness records, duplicate records, and secret-like diagnostics.
- Test provider setup preflight with local-compatible allowed paths, untrusted cloud denied paths, trusted cloud allowed paths, custom remote denied until trusted paths, missing-secret paths, and capability mismatch paths.
- Test provider definition merging so OpenAI-compatible setup metadata is safe, deterministic, and does not override baseline provider IDs.

### Manual Testing
- Review generated fixtures and diagnostics for fixture-safe paths and fake provider data only.
- Run local validation commands from the repository root and record output in `validation.md`.
- Confirm no setup or auth-test task requires a live provider, cloud account, credential, or private vault file.

### Edge Cases
- Endpoint URL contains username or password.
- Local-compatible endpoint uses a non-local host or a malformed URL.
- Custom remote endpoint is present but not trusted in settings.
- Cloud provider is trusted but cloud workflows are disabled.
- Credential reference is absent, malformed, unreadable, or for the wrong provider ID.
- Auth probe returns unauthorized, timeout, malformed diagnostic, or secret-like diagnostic keys.
- Selected model lacks the requested role or capability.
- Diagnostics include authorization-like headers, prompt-like text, private path hints, or hidden provider state.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/types/providers.ts`
- `src/types/provider-setup.ts`
- `src/types/plugin.ts`
- `src/providers/provider-profile-service.ts`
- `src/providers/provider-auth-test.ts`
- `src/providers/provider-preflight.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/provider-registry.ts`
- `src/providers/redaction.ts`
- `src/providers/secret-store.ts`
- `src/utils/settings.ts`
- `test/fixtures/providers/provider-setup-fixtures.ts`
- `test/provider-setup-privacy-preflight.test.ts`
- `test/plugin-settings-runtime.test.ts`

### Other Sessions
- **Depends on**: `phase03-session01-local-runtime-provider-profiles`, `phase01-session02-provider-setup-privacy-preflight`, `phase00-session03-provider-privacy-boundaries`
- **Depended by**: `phase03-session03-provider-transport-invocation-boundaries`, `phase03-session04-offline-embeddings-index-compatibility`, `phase03-session05-provider-troubleshooting-recovery-ux`, `phase03-session06-offline-provider-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
