# Session Specification

**Session ID**: `phase04-session04-onboarding-provider-readiness-guides`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Implemented - Ready for Validate
**Created**: 2026-05-13

---

## 1. Session Overview

This session strengthens first-run onboarding and provider readiness guidance
for the Phase 04 local-first release path. The current repository already has
provider setup, troubleshooting, local runtime, OpenAI-compatible endpoint,
semantic fallback, release artifact, install/update, and agent-surface
packaging foundations. This session turns those foundations into clear user
guidance that distinguishes local runtime, OpenAI-compatible local, custom
remote, and cloud provider paths before a user chooses a model workflow.

The work keeps provider disclosure explicit. Local runtime paths remain local;
custom remote and cloud paths must show provider review, trust, auth,
capability, and disclosure requirements before private vault content can leave
the machine. Onboarding examples must use synthetic providers and fake vault
paths only, and troubleshooting records must remain bounded to IDs, counts,
readiness codes, report IDs, cache paths, fallback mode, and validation output.

The implementation should avoid adding new provider integrations or live
provider calls. It should centralize copy and guidance in typed, testable
provider readiness helpers, then reuse those helpers in settings/status UI and
documentation so release users see consistent setup, retry, fallback, and
recovery language.

---

## 2. Objectives

1. Create a typed provider readiness guidance layer for local runtime,
   OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud
   provider paths.
2. Update settings and status UI copy so readiness, trust, auth, capability,
   disclosure, retry, and lexical fallback states are explicit and consistent.
3. Update onboarding, provider setup, and troubleshooting docs with
   fixture-safe first-run guidance and no secret-bearing examples.
4. Add focused tests and validation coverage that fail closed on unsafe
   guidance, stale provider path language, and leaked secret or private path
   examples.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase03-session01-local-runtime-provider-profiles` - Local runtime
      provider profile readiness and redacted diagnostics are available.
- [x] `phase03-session02-openai-compatible-provider-profiles` -
      OpenAI-compatible endpoint classification, credential, trust, and
      capability handling are available.
- [x] `phase03-session03-provider-transport-invocation-boundaries` -
      Provider invocation preflight, cancellation, retry, timeout, and
      disclosure boundaries are available.
- [x] `phase03-session04-offline-embeddings-index-compatibility` - Semantic
      compatibility and lexical fallback evidence are available.
- [x] `phase03-session05-provider-troubleshooting-recovery-ux` - Provider
      troubleshooting, recovery fields, retry, reset, review, and refresh
      actions are available.
- [x] `phase03-session06-offline-provider-integration-validation` - Provider
      closeout validation and synchronized surface safety evidence are
      available.
- [x] `phase04-session01-release-metadata-build-artifacts` - Release artifact
      validation and bounded diagnostics are available.
- [x] `phase04-session02-obsidian-install-update-workflow` - Local install,
      update, dry-run, rollback, and vault-safe release docs are available.
- [x] `phase04-session03-agent-skill-surface-packaging` - Agent surface
      package validation and fixture-safe reuse docs are available.

### Required Tools/Knowledge

- Provider profile and setup contracts in `src/types/provider-setup.ts`.
- Provider profile classification helpers in `src/providers/`.
- Settings provider UI in `src/views/settings-tab.ts`.
- Runtime status UI in `src/components/StatusSurface.svelte`.
- Fixture safety and agent documentation validation scripts.
- Existing provider docs under `docs/`.

### Environment Requirements

- Run commands from the repository root.
- Use Bun for tests and repository validation.
- Do not use real provider credentials, live provider calls, or real vault
  content.
- Examples must use `test/fixtures/vault/` or fake paths such as
  `fixtures/demo-vault/`.

---

## 4. Scope

### In Scope (MVP)

- New Obsidian user can follow first-run provider readiness guidance - update
  onboarding and provider setup docs with a deterministic local-first path and
  explicit remote/cloud decision points.
- User can distinguish provider path classes before model selection - expose
  local runtime, OpenAI-compatible local, custom remote, trusted cloud, and
  untrusted cloud readiness language from typed guidance helpers.
- User can understand provider blockers and next actions - make auth, trust,
  capability, disclosure, retry, reset, refresh, and lexical fallback states
  visible in settings/status copy.
- Contributor can validate onboarding examples safely - add tests and docs
  coverage using synthetic providers, fake paths, and redacted recovery fields.

### Out of Scope (Deferred)

- New provider integrations - *Reason: this session documents and clarifies
  existing provider profile paths only.*
- Live provider calls during onboarding examples - *Reason: examples must stay
  deterministic and fixture-safe.*
- Silent fallback from local providers to cloud providers - *Reason: cloud and
  custom remote disclosure must remain explicit and user-approved.*
- Export or handoff workflows - *Reason: ecosystem export boundaries are
  planned for Session 05.*
- Phase-wide distribution validation closeout - *Reason: end-to-end validation
  is planned for Session 06.*

---

## 5. Technical Approach

### Architecture

Add a small provider readiness guidance layer that consumes existing provider
profile metadata, role capability summaries, troubleshooting reports, and
semantic compatibility state. The layer should return typed, deterministic
guidance sections for provider path label, locality, required gates, current
blockers, allowed next actions, fallback behavior, and bounded recovery fields.

Keep the UI integration thin. `settings-tab.ts` should call the guidance layer
for setup, profile, trust, and troubleshooting descriptions instead of
assembling ad hoc strings. `StatusSurface.svelte` should render bounded
provider readiness labels and actions without exposing raw diagnostics,
credentials, prompt bodies, note bodies, hidden provider state, or private
filesystem paths.

Documentation should mirror the same path taxonomy and gate order: local
runtime first, OpenAI-compatible local where supported, custom remote with
provider review, trusted cloud with explicit disclosure, and untrusted cloud
blocked for private vault content. Docs and examples must stay under
framework-owned paths and be validated by existing fixture-safety and
agent-doc checks.

### Design Patterns

- Pure guidance presenter: keep provider readiness copy testable without
  Obsidian runtime or live providers.
- Existing metadata reuse: derive path labels from current provider profile,
  endpoint classification, auth readiness, and capability records.
- Fail-closed disclosure gates: remote and cloud paths remain blocked until
  review, trust, auth, capability, and disclosure checks pass.
- Bounded diagnostics: expose IDs, counts, readiness codes, report IDs, cache
  paths, fallback mode, and validation output only.
- Fixture-safe docs: use synthetic provider IDs and fake vault paths in all
  examples.

### Technology Stack

- TypeScript strict mode for guidance contracts and provider helpers.
- Svelte and Obsidian settings APIs for UI copy integration.
- Vitest for provider guidance and UI-facing copy tests.
- Bun validation scripts for fixture safety, agent docs, and full repository
  validation.
- Markdown docs for onboarding and provider readiness guidance.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/provider-readiness-guidance.ts` | Typed provider path, gate, action, fallback, copy, and validation contracts | ~140 |
| `src/providers/provider-readiness-guidance.ts` | Pure guidance builder for provider classes, readiness gates, blockers, actions, and fallback summaries | ~320 |
| `test/fixtures/providers/provider-readiness-guidance-fixtures.ts` | Synthetic provider guidance fixtures for local, local-compatible, custom remote, trusted cloud, and untrusted cloud paths | ~160 |
| `test/provider-readiness-guidance.test.ts` | Focused tests for guidance classification, copy, blockers, redaction, and deterministic ordering | ~280 |
| `docs/provider-readiness-guide.md` | First-release readiness guide for local, OpenAI-compatible local, custom remote, and cloud provider paths | ~180 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/providers/index.ts` | Export provider readiness guidance helpers and types | ~4 |
| `src/views/settings-tab.ts` | Replace ad hoc provider setup, profile, trust, and troubleshooting copy with guidance helper output | ~80 |
| `src/components/StatusSurface.svelte` | Render bounded provider readiness guidance and action labels in the status surface | ~40 |
| `docs/onboarding.md` | Add first-run provider readiness sequence and local-first verification guidance | ~80 |
| `docs/provider-setup.md` | Clarify local runtime, OpenAI-compatible local, custom remote, and cloud setup gates | ~120 |
| `docs/provider-troubleshooting-recovery.md` | Align troubleshooting, retry, reset, disclosure review, refresh, and lexical fallback language with the guidance layer | ~80 |
| `README.md` | Link provider readiness guide and summarize the release setup path | ~16 |
| `test/provider-troubleshooting-recovery-ux.test.ts` | Assert provider guidance output stays bounded and redacted in troubleshooting scenarios | ~60 |
| `test/agent-validation-scripts.test.ts` | Add regression coverage for provider readiness docs, fixture safety, and required disclosure language | ~70 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Provider readiness guidance distinguishes local runtime,
      OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud
      paths with explicit gate requirements.
- [ ] Settings and status UI copy shows trust, auth, capability, disclosure,
      retry, reset, refresh, and lexical fallback state without raw diagnostics.
- [ ] Remote and cloud provider guidance remains blocked until provider review,
      trust, auth, capability, and disclosure checks pass.
- [ ] Docs explain first-run setup and troubleshooting with synthetic examples
      and no live provider calls.
- [ ] Guidance never implies that Voidbrain silently falls back from local
      providers to cloud providers.

### Testing Requirements

- [ ] Unit tests cover every provider path class and deterministic gate order.
- [ ] Unit tests cover auth failures, capability mismatches, cloud disabled,
      provider not trusted, local outage, semantic fallback, and ready states.
- [ ] UI-facing tests cover settings/status copy for empty, loading, warning,
      error, offline, and ready provider states.
- [ ] Fixture-safety and agent-doc validation pass for all updated docs.

### Non-Functional Requirements

- [ ] Automated guidance writes zero provider secrets, API keys, passwords,
      authorization headers, private vault content, raw prompt bodies, hidden
      provider state, or private path hints into docs, fixtures, logs,
      examples, or diagnostics.
- [ ] Provider readiness guidance is deterministic across repeated runs.
- [ ] Guidance records preserve command ID, provider ID, model ID, readiness
      code, cache path, report ID, source path count, fallback mode, and
      validation output only.
- [ ] All files are ASCII-encoded and use Unix LF line endings.
- [ ] Code follows project conventions.

### Quality Gates

- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] `bun run validate:agent-surfaces` passes
- [ ] `bun run validate:fixture-safety` passes
- [ ] `bun run validate:agent-surface-package` passes
- [ ] `bun run validate:agent-docs` passes
- [ ] `bun run validate` passes or residual failures are recorded with
      recovery details

---

## 8. Implementation Notes

### Key Considerations

- Keep provider readiness copy centralized so docs and UI do not drift.
- Treat endpoint classification as advisory until trust, auth, capability, and
  disclosure gates are all evaluated.
- Keep examples synthetic and avoid `.env` examples that look like real
  credentials.
- Preserve lexical fallback language when semantic readiness is blocked.
- Keep Obsidian UI code focused on rendering and user interaction; provider
  guidance logic should remain in testable services.

### Potential Challenges

- Existing settings copy is assembled inline: move only provider readiness
  language into helpers and avoid unrelated UI refactors.
- OpenAI-compatible local wording can be confused with remote OpenAI-style
  APIs: describe locality by endpoint classification and gate requirements,
  not by API shape alone.
- Troubleshooting records can become too verbose: keep recovery details
  bounded to IDs, counts, readiness codes, and validation output.
- Docs can trigger fixture-safety false positives: use clearly fake domains
  and paths such as `provider.example.invalid` and `fixtures/demo-vault/`.

### Relevant Considerations

- [P02] **Workflow drift risk**: Keep PRD, docs, agent surfaces, and validation
  artifacts synchronized as provider guidance changes.
- [P01] **Obsidian runtime variance**: Settings/status guidance must remain
  useful across vault sizes, platforms, and Obsidian versions.
- [P01] **Bun validation baseline**: Document Bun setup and run the standard
  validation commands.
- [P01] **Disclosure gates stay mandatory**: Cloud and remote endpoint paths
  must require explicit review, trust, auth, capability, and disclosure before
  private vault content leaves the machine.
- [P01] **Redaction must remain fail-closed**: Docs, fixtures, support records,
  and diagnostics must exclude secrets, raw note bodies, prompt bodies, and
  hidden provider state.
- [P01] **Review-first mutations**: Onboarding should not imply direct note
  mutation outside staged changes.
- [P03] **Endpoint classification before trust**: OpenAI-compatible or custom
  endpoint shape must not imply disclosure safety.
- [P03] **Bounded recovery metadata**: Guidance and troubleshooting should use
  IDs, counts, readiness codes, fallback mode, and validation output instead
  of raw payloads.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- Provider setup copy implies that an OpenAI-compatible or cloud endpoint is
  safe before trust, auth, capability, and disclosure gates pass.
- Settings or status views retain stale provider readiness state after profile
  edits, retry, reset, refresh, or reopening the settings tab.
- Docs or tests accidentally include credential-like values, private path
  hints, raw prompts, hidden provider state, or real vault content.

---

## 9. Testing Strategy

### Unit Tests

- Test provider path classification and guidance output for local runtime,
  OpenAI-compatible local, custom remote, trusted cloud, and untrusted cloud
  fixtures.
- Test blocker and action guidance for missing secret, auth failed, auth
  timeout, local outage, capability mismatch, cloud disabled, provider not
  trusted, semantic fallback, and ready states.
- Test deterministic ordering for gates, blockers, actions, and recovery
  fields.
- Test redaction by scanning serialized guidance for credential-like values,
  private path hints, prompt bodies, raw note bodies, and hidden provider
  state.

### Integration Tests

- Test settings-tab provider readiness descriptions for empty, offline,
  warning, error, and ready provider scenarios.
- Test status surface provider guidance rendering with bounded diagnostics,
  action labels, and accessibility labels.
- Test provider troubleshooting scenarios still expose retry, reset,
  disclosure review, refresh, and lexical fallback language.

### Manual Testing

- Open settings in a synthetic vault and confirm the provider section explains
  local runtime setup, remote/cloud disclosure gates, role selection, test
  status, and troubleshooting actions.
- Review `docs/onboarding.md`, `docs/provider-setup.md`,
  `docs/provider-troubleshooting-recovery.md`, and
  `docs/provider-readiness-guide.md` as a first-time user.
- Run the documented validation commands from the repository root.

### Edge Cases

- No provider profiles are configured.
- Local runtime endpoint is offline or returns malformed model metadata.
- OpenAI-compatible local endpoint is present but misclassified.
- Custom remote endpoint lacks credential or disclosure review.
- Trusted cloud provider is configured but cloud workflows are disabled.
- Untrusted cloud provider is selected for private vault content.
- Semantic retrieval is blocked while lexical retrieval is ready.
- Settings are reopened after a profile edit, auth retest, reset, or refresh.

---

## 10. Dependencies

### External Libraries

- None. Reuse existing TypeScript, Svelte, Obsidian, Vitest, and Bun tooling.

### Other Sessions

- **Depends on**: `phase03-session01-local-runtime-provider-profiles`,
  `phase03-session02-openai-compatible-provider-profiles`,
  `phase03-session03-provider-transport-invocation-boundaries`,
  `phase03-session04-offline-embeddings-index-compatibility`,
  `phase03-session05-provider-troubleshooting-recovery-ux`,
  `phase03-session06-offline-provider-integration-validation`,
  `phase04-session01-release-metadata-build-artifacts`,
  `phase04-session02-obsidian-install-update-workflow`,
  `phase04-session03-agent-skill-surface-packaging`
- **Depended by**: `phase04-session05-ecosystem-export-handoff-boundaries`,
  `phase04-session06-distribution-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
