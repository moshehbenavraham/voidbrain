# Session 01: Local Runtime Provider Profiles

**Session ID**: `phase03-session01-local-runtime-provider-profiles`
**Status**: Complete
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Harden local runtime provider profiles so users can configure offline chat and
embedding models without writing secrets or sending vault content outside the
selected local boundary.

---

## Scope

### In Scope (MVP)

- Define typed local provider profile contracts for local runtime endpoints and
  model roles.
- Validate local endpoint, model list, chat capability, embedding capability,
  and offline readiness through bounded synthetic probes.
- Persist local profile readiness with provider IDs, model IDs, capability
  codes, and redacted diagnostics only.
- Preserve settings and status behavior when the local runtime is offline,
  missing, slow, or returns malformed model metadata.

### Out of Scope

- Cloud provider trust configuration.
- Sending private vault content to a provider during setup probes.
- Provider marketplace discovery.

---

## Prerequisites

- [ ] Phase 02 completed.
- [ ] Existing provider registry, provider profile service, auth-test runner,
      redaction, and secret-store contracts are available.
- [ ] Synthetic provider fixtures exist for local runtime success and failure
      paths.

---

## Deliverables

1. Local provider profile contracts and validation helpers.
2. Local runtime readiness probes with redacted diagnostics.
3. Tests covering offline, malformed, timeout, and capability mismatch states.

---

## Success Criteria

- [ ] Local profiles can represent chat and embedding models with explicit
      capability and role metadata.
- [ ] Offline or unavailable local runtimes fail closed with retryable readiness
      details.
- [ ] Setup probes do not send private vault content and do not write secrets or
      raw transport state.
- [ ] Synthetic provider tests pass.
