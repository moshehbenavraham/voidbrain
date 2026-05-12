# Session 03: Provider Privacy Boundaries

**Session ID**: `phase00-session03-provider-privacy-boundaries`
**Status**: Complete
**Completed**: 2026-05-12
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Implement provider, model capability, trust, and secret-handling boundaries that
make local-first privacy rules enforceable by code.

---

## Scope

### In Scope (MVP)

- Provider capability model for chat, embeddings, streaming, tools, and
  attachment handling
- Local and cloud provider trust settings
- Secret storage abstraction that avoids markdown, logs, fixtures, and exports
- Privacy guard checks before workflows can send vault content to a provider
- Tests for secret redaction, provider capability selection, and cloud opt-in

### Out of Scope

- Production-grade provider clients for every vendor
- Provider setup UI beyond service contracts or minimal placeholders
- Hosted account, billing, or team permissions

---

## Prerequisites

- [ ] Tooling scaffold exists
- [ ] Vault data model identifies which content may be sent to providers

---

## Deliverables

1. Typed provider and model capability contracts
2. Privacy guard service for vault-content disclosure decisions
3. Secret storage and redaction boundaries
4. Regression tests for no secret leakage in logs or markdown artifacts

---

## Success Criteria

- [ ] Cloud provider use requires explicit trusted configuration
- [ ] Provider secrets are never written to markdown, fixtures, or logs
- [ ] Unsupported capabilities fail before provider invocation
- [ ] Tests cover local-first defaults and cloud opt-in behavior
