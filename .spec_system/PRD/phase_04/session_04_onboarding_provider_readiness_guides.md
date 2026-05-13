# Session 04: Onboarding and Provider Readiness Guides

**Session ID**: `phase04-session04-onboarding-provider-readiness-guides`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Improve first-run onboarding and provider readiness guidance while preserving
explicit local, custom remote, and cloud disclosure gates.

---

## Scope

### In Scope (MVP)

- Review onboarding docs, settings language, provider setup docs, and runtime
  status guidance for first-release clarity.
- Make local runtime, OpenAI-compatible local, custom remote, and cloud provider
  readiness states explicit in docs and UI copy where appropriate.
- Ensure provider setup guidance keeps trust, auth, capability, and disclosure
  checks visible before private vault content can leave the machine.
- Add or update validation around onboarding copy, setup examples, and provider
  troubleshooting records where needed.

### Out of Scope

- New provider integrations.
- Live provider calls during onboarding examples.
- Silent fallback from local providers to cloud providers.

---

## Prerequisites

- [ ] Phase 03 provider profile, invocation, semantic fallback, and
      troubleshooting workflows are available.
- [ ] Existing onboarding and provider setup docs are available.
- [ ] Synthetic provider fixtures can cover setup and failure examples.

---

## Deliverables

1. Updated onboarding and provider readiness guidance.
2. Provider setup copy that preserves explicit disclosure gates.
3. Tests or validation coverage for fixture-safe setup examples and redaction.

---

## Success Criteria

- [ ] Users can distinguish local, custom remote, and cloud provider paths
      before choosing a model workflow.
- [ ] Provider readiness guidance explains trust, auth, capability, disclosure,
      retry, and fallback behavior without storing secrets or prompt bodies.
- [ ] Examples use synthetic fixtures and fake paths only.
- [ ] Relevant docs and validation checks pass.
