# Session 02: OpenAI-Compatible Provider Profiles

**Session ID**: `phase03-session02-openai-compatible-provider-profiles`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Harden OpenAI-compatible provider profile handling for local, custom, and cloud
endpoints with explicit endpoint classification, credential references, trust
state, auth readiness, and model capability mapping.

---

## Scope

### In Scope (MVP)

- Add OpenAI-compatible profile contracts that separate local, custom remote,
  trusted cloud, and untrusted cloud endpoint classifications.
- Store credentials through opaque secret references and auth-test boundaries.
- Map discovered or configured models to chat, streaming, embeddings, tools,
  and attachment capabilities with stable denial codes.
- Require cloud enablement and trusted provider IDs before private-vault
  disclosure can pass preflight.

### Out of Scope

- Provider billing, account management, or marketplace installation.
- Provider-specific feature coverage beyond the current capability contracts.
- Automatically trusting custom remote endpoints.

---

## Prerequisites

- [ ] Session 01 completed.
- [ ] Phase 01 provider setup and privacy preflight behavior is available.
- [ ] Secret redaction and fixture-safety validation are available.

---

## Deliverables

1. OpenAI-compatible provider profile and endpoint classification contracts.
2. Auth, trust, and capability readiness mapping with redacted diagnostics.
3. Tests for local, trusted cloud, untrusted cloud, missing-secret, and
   capability mismatch states.

---

## Success Criteria

- [ ] OpenAI-compatible profiles cannot silently escalate local workflows to
      cloud or remote endpoints.
- [ ] Raw credentials and authorization headers never appear in markdown, logs,
      fixtures, generated examples, or snapshots.
- [ ] Cloud/private-vault preflight fails closed until cloud use and provider
      trust are explicitly configured.
- [ ] Capability mismatches are visible before chat or embedding workflows run.
