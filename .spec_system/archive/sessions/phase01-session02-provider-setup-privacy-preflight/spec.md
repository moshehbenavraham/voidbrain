# Session Specification

**Session ID**: `phase01-session02-provider-setup-privacy-preflight`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session builds the provider setup and privacy preflight path that the remaining Phase 01 workflows depend on. It turns the Phase 00 provider registry, capability selection, secret-store, redaction, and privacy guard contracts into user-configurable runtime behavior inside the Obsidian settings surface.

The work matters because indexing, chat, ingestion, and semantic retrieval cannot safely call a provider until the user has selected models, stored credentials through the secret boundary, and explicitly reviewed cloud disclosure for private vault content. The session keeps setup tests free of vault content and keeps all diagnostics redacted.

The implementation remains local-first. Provider profiles and model role selections can be saved, but raw secrets stay outside markdown, logs, fixtures, screenshots, and plugin settings. Cloud/private-vault workflows fail closed until trust and disclosure requirements are recorded.

---

## 2. Objectives

1. Let users configure local and OpenAI-compatible provider profiles without persisting raw credentials.
2. Show auth, capability, trust, and model-role readiness before chat, embedding, or ingestion workflows run.
3. Block cloud/private-vault provider use until explicit disclosure review and trusted-provider settings exist.
4. Add redaction and fixture-safety tests proving diagnostics never expose provider secrets or authorization material.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session01-repo-tooling-scaffold` - Provides Bun, Vite, Vitest, Svelte, Obsidian mocks, and validation scripts.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides provider registry, secret-store, capability selection, privacy guard, and redaction contracts.
- [x] `phase00-session05-agent-surfaces-commands` - Provides command catalog vocabulary for provider setup and health surfaces.
- [x] `phase01-session01-obsidian-runtime-settings` - Provides settings tab, runtime status surface, typed plugin settings, and lifecycle wiring.

### Required Tools/Knowledge

- Obsidian settings tab APIs, secure text inputs, buttons, notices, and plugin data persistence.
- Existing provider contracts in `src/types/providers.ts` and `src/providers/`.
- Existing settings migration behavior in `src/types/plugin.ts` and `src/utils/settings.ts`.
- Vitest patterns for fixture-safe provider, settings, and runtime-status tests.

### Environment Requirements

- Work from the repository root.
- Use only synthetic provider fixtures and `test/fixtures/vault/` paths in tests.
- Do not send vault content during setup or auth checks.
- Do not write provider secrets, API keys, authorization headers, raw hidden provider state, or private paths to docs, fixtures, logs, snapshots, or generated examples.

---

## 4. Scope

### In Scope (MVP)

- User can define local and OpenAI-compatible provider profiles - Persist sanitized profile metadata and opaque secret references through typed settings.
- User can enter provider credentials securely - Save credentials through the secret-store boundary without writing raw values to markdown or plugin settings.
- User can test provider auth and model capability readiness - Report redacted diagnostics and never include vault note content in setup tests.
- User can approve cloud provider trust for private-vault workflows - Keep disclosure review explicit, provider-specific, and fail-closed by default.
- User can select chat and embedding model roles - Validate selections against capability contracts before later workflows invoke providers.
- User can inspect provider readiness in settings and runtime status - Show missing setup, auth failure, capability mismatch, and cloud trust warnings.

### Out of Scope (Deferred)

- Provider marketplace support - Reason: MVP needs local and OpenAI-compatible setup only.
- Multi-user account management - Reason: Product is local-first and single-vault for the MVP.
- Sending vault content during setup tests - Reason: Setup must verify auth/capability without disclosure of user notes.
- Running indexing, chat, ingestion, or semantic embedding workflows - Reason: Sessions 03, 04, and 05 own those execution paths.
- Applying AI-generated vault changes - Reason: Staged review and apply are owned by later Phase 01 sessions.

---

## 5. Technical Approach

### Architecture

Provider setup behavior is split between pure provider services and thin Obsidian UI wiring. Provider profile and auth-test contracts live under `src/types/` and `src/providers/`, while the settings tab remains the Obsidian-facing configuration surface. `src/main.ts` keeps lifecycle ownership from Session 01 and should only need minimal dependency injection changes if the settings tab needs a provider setup service.

Plugin settings store sanitized provider profiles, trust decisions, and model-role selections. Raw credentials are written only through the `ProviderSecretStore` boundary and represented in settings by opaque `SecretReference` metadata. Preflight decisions are composed from `VoidbrainPluginSettings`, `ProviderPrivacyPolicy`, provider definitions, and existing capability selection.

Runtime status summarizes setup readiness without exposing secret values or raw vault content. Later indexing and chat sessions consume the preflight facade instead of calling provider registry or settings objects directly.

### Design Patterns

- Contract-first setup: Define provider profile, auth status, and preflight view models before UI wiring.
- Secret reference separation: Persist only opaque references and profile metadata; keep runtime credential values in the secret store.
- Fail-closed disclosure: Deny cloud/private-vault workflows unless cloud use is enabled and the provider is explicitly trusted.
- Redacted diagnostics: Route auth, capability, and preflight diagnostics through recursive redaction before surfacing or testing them.
- Role capability validation: Validate chat and embedding selections against provider model capabilities before later workflows run.

### Technology Stack

- TypeScript strict mode for provider setup contracts and services.
- Obsidian `Setting`, secure text fields, buttons, dropdowns, toggles, and notices for setup UI.
- Existing provider modules: registry, capability selection, privacy guard, redaction, and secret store.
- Existing Svelte and status surfaces for compact readiness display.
- Vitest, Obsidian mocks, and synthetic provider fixtures for tests.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/provider-setup.ts` | Provider profile, auth-test, setup status, and preflight view-model contracts. | ~150 |
| `src/providers/provider-profile-service.ts` | Validate, normalize, merge, and summarize persisted provider profiles. | ~220 |
| `src/providers/provider-auth-test.ts` | Auth/capability test runner abstraction with timeout and redacted diagnostics. | ~180 |
| `src/providers/provider-preflight.ts` | Settings-aware preflight facade for disclosure and model capability decisions. | ~180 |
| `test/fixtures/providers/provider-setup-fixtures.ts` | Synthetic provider setup profiles, secret references, and diagnostics fixtures. | ~120 |
| `test/provider-setup-privacy-preflight.test.ts` | Tests for profile validation, auth diagnostics, preflight blocking, and redaction. | ~260 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/providers.ts` | Add provider profile, endpoint, auth status, and setup-safe metadata contracts if not isolated in setup types. | ~100 |
| `src/types/plugin.ts` | Add provider profile settings, schema version migration target, and local-first defaults. | ~80 |
| `src/utils/settings.ts` | Parse, validate, deduplicate, and recover provider profiles without preserving raw secret-like values. | ~180 |
| `src/providers/index.ts` | Export setup, auth-test, and preflight services. | ~20 |
| `src/views/settings-tab.ts` | Add provider setup controls, secure credential actions, trust approval, auth test, and role status. | ~260 |
| `src/types/runtime.ts` | Add provider setup/auth status fields for runtime readiness snapshots. | ~80 |
| `src/agent/runtime-status.ts` | Include provider auth, trust, and capability mismatch status in readiness output. | ~140 |
| `test/__mocks__/obsidian.ts` | Add mock support needed for secure text fields, buttons, and setup status assertions. | ~100 |
| `test/plugin-settings-runtime.test.ts` | Cover provider profile migration, secret-reference persistence, and raw-secret recovery. | ~140 |
| `test/runtime-status.test.ts` | Cover provider auth, trust, capability, and missing setup readiness states. | ~140 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Local and OpenAI-compatible provider profiles can be configured with sanitized metadata and opaque credential references.
- [ ] Provider setup tests report auth and capability readiness without sending vault content.
- [ ] Cloud/private-vault provider use is blocked until cloud workflows are enabled and the selected provider is trusted.
- [ ] Chat and embedding role selections surface capability mismatches before later workflows run.
- [ ] Settings and status surfaces show actionable setup, auth, trust, and capability states.

### Testing Requirements

- [ ] Unit tests cover provider profile validation, duplicate profile handling, and model capability summaries.
- [ ] Unit tests cover auth-test timeout/failure diagnostics with recursive redaction.
- [ ] Settings migration tests prove raw secrets and unsupported hidden provider state are dropped.
- [ ] Runtime status tests cover missing setup, auth failure, cloud trust warning, and ready provider states.
- [ ] Fixture-safety tests continue to pass with only synthetic provider examples.

### Non-Functional Requirements

- [ ] Automated workflows write zero provider secrets or API keys into markdown, logs, fixtures, generated examples, or snapshots.
- [ ] Setup and preflight paths fail closed when settings are malformed, providers are unknown, capabilities mismatch, or trust is missing.
- [ ] UI controls are keyboard reachable and use Obsidian theme variables.
- [ ] Provider diagnostics expose provider IDs, status codes, and counts only; they do not expose raw vault content or authorization material.

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

- Keep Obsidian lifecycle ownership in `src/main.ts`; provider setup logic belongs in typed services and settings UI helpers.
- Treat setup auth checks as provider metadata checks only; do not include note text, snippets, embeddings, or source content.
- Make cloud trust provider-specific so enabling one trusted cloud provider does not imply blanket trust for every cloud provider.
- Preserve the Session 01 local-first defaults when settings migration sees unsupported values.
- Keep diagnostics useful for recovery by preserving provider ID, model ID, command/workflow ID, status code, and redacted failure reason.

### Potential Challenges

- Secure credential UX in Obsidian settings can be easy to overfit: Keep the first pass limited to save, replace, delete reference, and test auth.
- User-defined provider profiles can conflict with baseline fixture providers: Deduplicate IDs deterministically and recover invalid profiles.
- Auth checks may need provider-specific behavior later: Use a small tester interface so local and OpenAI-compatible tests can diverge without changing callers.
- Status output can leak too much detail: Keep summaries based on IDs, statuses, and counts, with all diagnostics redacted before display.

### Relevant Considerations

- [P00] **Tracker synchronization**: Keep state, spec, tasks, and later validation artifacts aligned so workflow commands can trust repo state.
- [P00] **Provider disclosure boundary**: This session directly implements the fail-closed disclosure preflight for cloud/private-vault workflows.
- [P00] **Fixture safety**: Provider setup tests and examples must use synthetic providers, fake endpoints, and no secret-like credential values.
- [P00] **Contract-first boundaries**: Compose provider setup from existing provider, capability, privacy, redaction, settings, and runtime-status contracts.
- [P00] **Implicit provider trust**: Never infer cloud trust from provider kind, model role, endpoint URL, or a successful auth test.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- A credential save, replace, delete, or auth-test action can be triggered twice and leave stale or contradictory UI state.
- A cloud provider can become available for private-vault workflows without an explicit trust review.
- Capability mismatches are discovered only after later chat or embedding workflows try to invoke the provider.
- Error diagnostics accidentally include raw provider credentials, authorization headers, hidden provider state, or vault content.

---

## 9. Testing Strategy

### Unit Tests

- Validate provider profile parsing, duplicate ID handling, endpoint validation, and profile-to-definition conversion.
- Validate provider role capability summaries for chat and embedding selections.
- Validate settings migration for schema changes, malformed provider profiles, unknown provider IDs, and secret-like raw values.
- Validate preflight decisions for local providers, disabled cloud workflows, untrusted cloud providers, trusted cloud providers, and unsupported capabilities.

### Integration Tests

- Extend settings tab tests or lifecycle tests to cover provider setup controls, duplicate-save prevention, and status refresh behavior.
- Extend runtime status tests to include auth, trust, capability, and missing provider states.
- Verify Obsidian mocks support the exact settings controls used by this session.

### Manual Testing

- Open settings in the mock/runtime path and verify provider setup controls are reachable.
- Save a synthetic local provider profile, select chat and embedding roles, and confirm readiness improves.
- Enable a synthetic cloud provider and verify private-vault preflight remains blocked until explicit trust is recorded.
- Trigger an auth failure and confirm the UI shows a redacted, actionable diagnostic.

### Edge Cases

- Persisted settings contain raw secret-looking fields, unsupported hidden provider state, duplicate provider IDs, or malformed endpoint URLs.
- A provider profile has a credential reference whose runtime secret is missing.
- Cloud workflows are enabled but no trusted provider is selected.
- A selected chat or embedding model is deleted, renamed, or lacks the required capability.
- Auth test fails, times out, or is triggered while a previous test is still pending.

---

## 10. Dependencies

### External Libraries

- No new external runtime dependencies expected.
- Existing `obsidian`, `svelte`, `vitest`, `vite`, `typescript`, `biome`, and `bun` toolchain remain in use.

### Other Sessions

- **Depends on**: `phase01-session01-obsidian-runtime-settings`, `phase00-session03-provider-privacy-boundaries`
- **Depended by**: `phase01-session03-indexing-runtime-retrieval-readiness`, `phase01-session04-grounded-vault-chat`, `phase01-session05-source-ingestion-staging`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
