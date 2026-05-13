# Session Specification

**Session ID**: `phase03-session01-local-runtime-provider-profiles`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens local runtime provider profiles so Voidbrain can represent offline chat and embedding models with explicit endpoint, model role, capability, readiness, and diagnostic contracts. It turns the existing provider setup foundation into a local-runtime specific workflow that can tell the user whether a local provider is ready without sending private vault content anywhere.

The work matters because Phase 03 depends on separating local runtime readiness from later OpenAI-compatible cloud and custom remote provider behavior. Local profiles should stay inside the selected local boundary, fail closed when a runtime is unavailable or malformed, and persist only provider IDs, model IDs, capability codes, readiness codes, and redacted diagnostics.

This is a contract and readiness session. It should strengthen provider profile parsing, local runtime probes, setup summaries, and synthetic tests, but it should not add cloud trust configuration, live provider marketplace discovery, or provider adapter invocation paths that belong to later Phase 03 sessions.

---

## 2. Objectives

1. Define typed local runtime profile contracts for endpoint, runtime family, model role, capability, readiness, and redacted diagnostic metadata.
2. Add bounded local runtime readiness probes that validate model lists, chat capability, embedding capability, offline state, malformed metadata, and timeout behavior.
3. Persist and summarize local readiness using safe provider IDs, model IDs, capability codes, readiness codes, counts, and redacted diagnostics only.
4. Add synthetic tests proving local setup probes do not send private vault content, do not store secrets, and fail closed for unavailable or incompatible runtimes.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session07-agentic-maintenance-integration-validation` - Confirms Phase 02 recovery, fixture safety, staged-change, command-surface, and validation behavior is complete.
- [x] `phase01-session02-provider-setup-privacy-preflight` - Provides provider setup, privacy preflight, profile parsing, auth-test, redaction, and settings foundations.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides baseline provider, capability, trust, redaction, and secret-store contracts.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Vitest fixture patterns under `test/fixtures/providers/`.
- Provider profile, auth-test, preflight, registry, redaction, and settings services under `src/providers/` and `src/utils/`.
- Strict TypeScript provider contracts under `src/types/providers.ts` and `src/types/provider-setup.ts`.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/voidbrain`.
- Validation runs from the repository root with Bun available.
- Tests use synthetic provider fixtures only.
- No live local runtime, cloud provider call, private vault content, credential, or authorization header is required.

---

## 4. Scope

### In Scope (MVP)
- User can configure local runtime provider profiles for chat and embedding roles - add typed local runtime profile and readiness contracts that preserve explicit role and capability metadata.
- User can inspect local runtime readiness before workflows run - add bounded synthetic probes for endpoint reachability, model list parsing, chat capability, embedding capability, malformed metadata, timeout, and offline states.
- User can persist safe local readiness evidence - store provider IDs, model IDs, capability codes, readiness codes, model counts, checked timestamps, and redacted diagnostics only.
- User can keep settings and status behavior stable when local runtime setup fails - summarize offline, missing, slow, malformed, and capability-mismatch states without treating unavailable local providers as ready.
- Developer can validate provider safety locally - add tests covering local runtime success, offline, malformed, timeout, capability mismatch, redaction, and no private-vault payload disclosure.

### Out of Scope (Deferred)
- Cloud provider trust configuration - *Reason: OpenAI-compatible cloud and custom remote endpoint handling belongs to Session 02.*
- Provider chat or embedding transport invocation boundaries - *Reason: cancellable adapter calls, retries, and invocation preflight belong to Session 03.*
- Offline embedding index compatibility and reindex guidance - *Reason: index compatibility belongs to Session 04.*
- Provider troubleshooting UI and recovery docs - *Reason: user-facing troubleshooting surfaces belong to Session 05.*
- Sending private vault content during setup probes - *Reason: setup readiness must use bounded synthetic probes only.*
- Provider marketplace discovery - *Reason: marketplace behavior is outside Phase 03 MVP scope.*

---

## 5. Technical Approach

### Architecture
Extend provider setup around explicit local runtime contracts rather than adding UI-first behavior. Keep contract types in `src/types/provider-setup.ts` and `src/types/providers.ts`, local readiness logic in a focused provider service, and settings normalization in `src/utils/settings.ts`. Existing provider preflight and setup summaries should consume local readiness state so local runtimes are not assumed ready when offline or malformed.

The local readiness probe should accept a local profile and a synthetic probe adapter, use an `AbortSignal`, bounded timeout, and deterministic model metadata parsing, then return a record with only safe IDs, codes, counts, timestamps, durations, and redacted diagnostics. Tests should use fake profiles and fake probe responses from `test/fixtures/providers/`, not live runtimes or user vault data.

### Design Patterns
- Contract-first modeling: Add local runtime readiness and capability contracts before behavior consumes them.
- Fail-closed readiness: Offline, timeout, malformed model metadata, missing chat model, or missing embedding model should produce denied or warning states instead of ready states.
- Bounded synthetic probes: Readiness probes use synthetic requests and model metadata only, with timeout, abort, and no private-vault payload.
- Redacted diagnostics: Probe diagnostics are passed through existing redaction helpers before persistence or summaries.
- Deterministic ordering: Model and readiness summaries sort by stable provider and model IDs.

### Technology Stack
- TypeScript 5.9 strict contracts.
- Vitest 4 for provider service and settings regression tests.
- Bun validation scripts.
- Existing Obsidian plugin settings types and provider services.
- Existing `src/providers/redaction.ts`, `src/providers/provider-profile-service.ts`, `src/providers/provider-auth-test.ts`, and `src/providers/provider-preflight.ts`.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/providers/local-runtime-readiness.ts` | Local runtime readiness probe runner, model metadata parser, capability summary, and safe diagnostics | ~240 |
| `test/fixtures/providers/local-runtime-provider-fixtures.ts` | Synthetic local runtime profiles, probe results, malformed metadata, timeout helpers, and safe diagnostics | ~180 |
| `test/local-runtime-provider-profiles.test.ts` | Unit and regression tests for local runtime contracts, readiness, redaction, and setup preflight | ~260 |
| `.spec_system/specs/phase03-session01-local-runtime-provider-profiles/implementation-notes.md` | Implementation notes for this session | ~100 |
| `.spec_system/specs/phase03-session01-local-runtime-provider-profiles/security-compliance.md` | Session security and privacy review | ~90 |
| `.spec_system/specs/phase03-session01-local-runtime-provider-profiles/validation.md` | Validation command results and residual failures | ~100 |
| `.spec_system/specs/phase03-session01-local-runtime-provider-profiles/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~90 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/provider-setup.ts` | Add local runtime profile, readiness status, readiness code, probe result, and safe diagnostic contracts | ~120 |
| `src/types/providers.ts` | Add local runtime model metadata and readiness-safe provider setup metadata fields if needed | ~60 |
| `src/providers/provider-profile-service.ts` | Validate local runtime endpoint and model contracts with explicit capability mismatch errors | ~90 |
| `src/providers/provider-auth-test.ts` | Reuse or bridge auth-test records for local runtime readiness without secrets or private payloads | ~80 |
| `src/providers/provider-preflight.ts` | Require selected local runtime readiness for local chat and embedding setup preflight | ~80 |
| `src/providers/index.ts` | Export local runtime readiness contracts and helpers | ~10 |
| `src/utils/settings.ts` | Parse, recover, and redact persisted local runtime readiness state in plugin settings | ~100 |
| `test/fixtures/providers/provider-setup-fixtures.ts` | Add reusable safe local runtime profile fixtures | ~80 |
| `test/provider-setup-privacy-preflight.test.ts` | Add local runtime readiness regression coverage | ~120 |
| `test/plugin-settings-runtime.test.ts` | Add settings parse and recovery coverage for local readiness records | ~90 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Local profiles represent chat and embedding models with explicit role, capability, runtime family, endpoint, and readiness metadata.
- [ ] Local readiness probes fail closed for offline, missing, slow, malformed, or capability-mismatched local runtimes.
- [ ] Setup probes use synthetic model metadata only and never include private vault content, prompts, raw credentials, authorization headers, or hidden provider state.
- [ ] Provider setup summaries and preflight decisions do not treat unavailable selected local runtimes as ready.
- [ ] Readiness diagnostics are redacted and persist only safe provider IDs, model IDs, capability codes, readiness codes, counts, timestamps, and durations.

### Testing Requirements
- [ ] Unit tests written and passing for local profile validation, readiness parsing, redaction, timeout, malformed metadata, and capability mismatch.
- [ ] Settings parse and recovery tests written and passing for local readiness records.
- [ ] Provider setup preflight regression tests written and passing for ready and not-ready local providers.
- [ ] Manual review confirms generated examples and fixtures are synthetic and fixture-safe.

### Non-Functional Requirements
- [ ] Local-first privacy behavior remains explicit and no setup probe sends vault content outside the local runtime boundary.
- [ ] Provider diagnostics contain no secrets, authorization headers, prompt bodies, raw private note bodies, private path hints, or hidden transport state.
- [ ] Readiness probe behavior is cancellable or timeout-bounded and deterministic under test.

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
- Keep local runtime readiness separate from OpenAI-compatible remote trust behavior.
- Do not introduce live runtime calls into tests; use injected probes and synthetic metadata.
- Do not let local providers bypass readiness when selected for chat or embedding roles.
- Preserve existing settings defaults and recover gracefully from malformed persisted readiness records.
- Keep durable support records useful for recovery without storing raw transport payloads.

### Potential Challenges
- Existing local providers are currently treated as auth-ready: update setup/preflight behavior carefully so baseline fixture providers remain usable in tests while user-configured local runtimes can be marked not ready.
- Model metadata can vary by local runtime: normalize only the bounded MVP fields needed for chat and embedding readiness.
- Timeout tests can become flaky: inject sleep, clock, timeout, and probe behavior instead of relying on live timers where possible.
- Redaction regressions can be subtle: assert serialized readiness records do not contain secret-like or prompt-like values.

### Relevant Considerations
- [P02] **Workflow drift risk**: Keep Phase 03 session records, task lists, and provider docs synchronized with provider behavior changes.
- [P02] **Spec script parity**: Preserve local analyzer behavior and do not rely on missing local spec scripts for validation.
- [P01] **Obsidian runtime variance**: Keep readiness and settings behavior resilient without assuming a live Obsidian runtime or specific local provider installation.
- [P01] **Disclosure gates stay mandatory**: Local setup must not silently escalate to cloud or remote endpoints when a local runtime is unavailable.
- [P01] **Redaction must remain fail-closed**: Fixtures, logs, readiness records, and summaries must exclude secrets, raw note bodies, prompts, and hidden provider state.
- [P01] **Review-first mutations**: Provider-assisted note output remains outside this session and must continue through staged review paths later.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Local providers may appear ready even when selected runtime probes are offline, timed out, malformed, or missing required capabilities.
- Readiness diagnostics may accidentally preserve raw endpoint errors, headers, prompts, or secret-like values.
- Settings recovery may drop or misclassify readiness state, causing confusing provider setup and preflight behavior on reload.

---

## 9. Testing Strategy

### Unit Tests
- Test local runtime profile validation for valid local endpoints, non-local endpoint rejection, duplicate model IDs, missing chat or embedding capabilities, and malformed model metadata.
- Test readiness probe outcomes for ready, offline, timeout, malformed metadata, missing chat capability, missing embedding capability, and redacted diagnostic failure paths.
- Test setup summary and preflight decisions for selected local providers with ready and not-ready records.

### Integration Tests
- Test settings load and recovery with persisted local readiness records, malformed records, duplicate records, and secret-like diagnostic values.
- Test provider definition merging so local runtime setup metadata is safe, deterministic, and does not override baseline provider IDs.

### Manual Testing
- Review generated fixtures and diagnostics for fixture-safe paths and fake provider data only.
- Run local validation commands from the repository root and record output in `validation.md`.
- Confirm no setup probe task requires a live provider, cloud account, credential, or private vault file.

### Edge Cases
- Local runtime unavailable or connection refused.
- Probe timeout with aborted signal.
- Probe returns non-object or malformed model metadata.
- Model list has duplicate IDs or unbounded extra fields.
- Chat model exists but embedding model is missing, or the reverse.
- Endpoint contains credentials or points to a non-local host.
- Diagnostics include secret-like keys, authorization-like headers, prompt-like text, or private path hints.

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
- `src/providers/provider-registry.ts`
- `src/providers/redaction.ts`
- `src/providers/secret-store.ts`
- `src/utils/settings.ts`
- `test/fixtures/providers/provider-setup-fixtures.ts`
- `test/provider-setup-privacy-preflight.test.ts`
- `test/plugin-settings-runtime.test.ts`

### Other Sessions
- **Depends on**: `phase02-session07-agentic-maintenance-integration-validation`, `phase01-session02-provider-setup-privacy-preflight`, `phase00-session03-provider-privacy-boundaries`
- **Depended by**: `phase03-session02-openai-compatible-provider-profiles`, `phase03-session03-provider-transport-invocation-boundaries`, `phase03-session04-offline-embeddings-index-compatibility`, `phase03-session05-provider-troubleshooting-recovery-ux`, `phase03-session06-offline-provider-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
