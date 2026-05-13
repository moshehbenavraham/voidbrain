# Session 02: Provider Setup and Privacy Preflight

**Session ID**: `phase01-session02-provider-setup-privacy-preflight`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Build provider configuration and privacy preflight flows so users can select local or cloud-compatible models with explicit trust and capability review.

---

## Scope

### In Scope (MVP)

- Create provider setup UI for local and OpenAI-compatible provider profiles.
- Store secrets through the secret-store boundary without writing raw values to markdown, logs, fixtures, screenshots, or docs.
- Test provider capability and auth status with redacted diagnostics.
- Block private-vault cloud use until the user has explicitly approved the disclosure boundary.
- Show model role selection for chat and embeddings using existing capability contracts.

### Out of Scope

- Provider marketplace support.
- Multi-user account management.
- Sending vault content during setup tests.

---

## Prerequisites

- [ ] Session 01 completed.
- [ ] Phase 00 provider registry, secret-store, capability selection, privacy guard, and redaction helpers are available.

---

## Deliverables

1. Provider setup modal or settings section with secure fields and validation.
2. Capability, auth, trust, and model-role status shown in the plugin UI.
3. Privacy preflight service that fails closed for private vault content.
4. Tests proving secrets and authorization material are redacted from diagnostics.

---

## Success Criteria

- [ ] Provider secrets never appear in markdown, logs, fixtures, generated examples, or test snapshots.
- [ ] Cloud/private-data use is blocked until explicit user review is recorded.
- [ ] Capability mismatches are visible before chat or embedding workflows run.
- [ ] Fixture-safe provider tests pass.
