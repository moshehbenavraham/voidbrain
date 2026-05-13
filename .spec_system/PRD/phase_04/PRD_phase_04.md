# PRD Phase 04: Distribution and Ecosystem

**Status**: In Progress
**Sessions**: 6
**Estimated Duration**: 6-9 days

**Progress**: 3/6 sessions (50%)

---

## Overview

Phase 04 prepares Voidbrain for local-first release and ecosystem use. It turns
the validated plugin, provider, retrieval, staged-change, recovery, and agent
surface workflows into installable, documented, and validated distribution
artifacts without weakening vault privacy or review-first mutation guarantees.

The phase must preserve the local-first contract. Release artifacts, docs,
agent packages, examples, screenshots, logs, and validation reports must not
contain provider secrets, private vault content, raw prompt bodies, hidden
provider state, or private path hints. Cloud and custom remote provider paths
remain opt-in and require provider review, trust, auth, capability, and
disclosure gates before private vault content can leave the local machine.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Release Metadata and Build Artifacts | Complete | ~12-25 | 2026-05-13 |
| 02 | Obsidian Install and Update Workflow | Complete | ~12-25 | 2026-05-13 |
| 03 | Agent Skill and Surface Packaging | Complete | ~12-25 | 2026-05-13 |
| 04 | Onboarding and Provider Readiness Guides | Not Started | ~12-25 | - |
| 05 | Ecosystem Export and Handoff Boundaries | Not Started | ~12-25 | - |
| 06 | Distribution Integration Validation | Not Started | ~12-25 | - |

---

## Completed Sessions

1. Release Metadata and Build Artifacts
2. Obsidian Install and Update Workflow
3. Agent Skill and Surface Packaging

---

## Upcoming Sessions

- Session 04: Onboarding and Provider Readiness Guides

---

## Objectives

1. Produce deterministic Obsidian plugin release artifacts with aligned package,
   manifest, version map, checksums, and validation evidence.
2. Make local install, update, rollback, and troubleshooting workflows clear for
   Obsidian users without moving or mutating existing vault content.
3. Package markdown agent surfaces and command catalogs for multiple agent
   ecosystems while keeping examples fixture-safe and provider-aware.
4. Strengthen onboarding and provider readiness guidance so users understand
   local, cloud, and custom remote disclosure boundaries before using AI flows.
5. Define safe ecosystem handoff and export boundaries for selected markdown
   outputs without adding hosted sync or third-party publishing to the MVP.
6. Validate the full distribution path with docs, tests, security review,
   fixture safety, and recovery details.

---

## Prerequisites

- Phase 03 completed.
- Obsidian plugin scaffold, build scripts, manifest, version map, deployment
  script, docs, agent surfaces, provider profiles, staged-change workflows,
  recovery records, and validation scripts are available.
- Synthetic fixture vaults and provider fixtures are available under `test/`.
- Local validation commands are available from the repository root.

---

## Technical Considerations

### Architecture

Keep Obsidian lifecycle wiring in `src/main.ts`. Distribution work should
reuse existing build, validation, deployment, provider, staged-change,
recovery, and agent surface modules instead of creating separate release-only
paths.

Release support records may include command IDs, artifact paths, checksums,
version numbers, validation output, report IDs, staged-change IDs, and
compatibility notes. They must not include provider secrets, authorization
headers, prompt bodies, raw private note bodies, hidden provider state, or
private filesystem paths.

### Technologies

- TypeScript strict mode for release helpers, validators, package metadata
  checks, deployment diagnostics, and ecosystem package manifests.
- Obsidian API and existing deployment scripts for local install and update
  workflows.
- Markdown, JSON, and Git for durable release records, docs, agent surfaces,
  manifests, and reviewable distribution evidence.
- Vitest, Svelte Check, Biome, Bun validation scripts, agent-surface checks,
  fixture-safety checks, and synthetic fixtures.

### Risks

- Release metadata can drift across `package.json`, `manifest.json`,
  `versions.json`, docs, and generated artifacts: validate all version and
  compatibility references together.
- Distribution examples can leak secrets or private vault content: fixture
  safety and redaction checks must fail closed before release.
- Installation tooling can mutate existing vault content unexpectedly: install
  and update paths must keep user notes untouched unless a staged workflow is
  explicitly invoked and approved.
- Agent ecosystem packages can drift from implemented command behavior:
  command catalogs, skills, docs, and validation scripts must stay
  synchronized.
- Ecosystem handoff can imply hosted publishing or silent cloud disclosure:
  external publishing stays out of MVP scope unless provider review and user
  approval are explicit.

### Relevant Considerations

- [P02] **Workflow drift risk**: Keep phase tracking, command docs, specs, and
  validation artifacts synchronized as release surfaces change.
- [P02] **Spec script parity**: Restore or preserve local script parity when
  distribution validation relies on spec-system helper scripts.
- [P01] **Obsidian runtime variance**: Install, update, and onboarding behavior
  should stay resilient across vault sizes, platforms, and Obsidian versions.
- [P01] **Bun validation baseline**: Keep Bun setup and fallback guidance
  explicit for contributors and release validation.
- [P01] **Disclosure gates stay mandatory**: Cloud and remote endpoint paths
  require explicit trust, auth, capability, and disclosure preflight before
  private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, release records, logs,
  recovery records, exported reports, screenshots, and generated examples must
  exclude secrets, raw private note bodies, and hidden provider state.
- [P01] **Review-first mutations**: Distribution workflows must not bypass
  staged review/apply paths for any AI-proposed note changes.
- [P03] **Endpoint classification before trust**: OpenAI-compatible or custom
  endpoint shape must not imply disclosure safety.
- [P03] **Bounded recovery metadata**: Release diagnostics should use IDs,
  counts, readiness codes, artifact paths, checksums, and validation output
  instead of raw payloads.

---

## Success Criteria

Phase complete when:
- [ ] All 6 sessions completed.
- [ ] Obsidian release metadata and build artifacts are version-aligned,
      deterministic, and validated.
- [ ] Local install, update, rollback, and troubleshooting docs are complete
      and vault-safe.
- [ ] Agent surfaces and packageable command docs are synchronized with
      implemented behavior and fixture-safety validation.
- [ ] Onboarding and provider readiness guidance clearly distinguishes local,
      custom remote, and cloud disclosure paths.
- [ ] Ecosystem handoff workflows are documented with explicit boundaries and
      no hosted publishing dependency.
- [ ] `bun run validate:agent-surfaces`, `bun run validate:fixture-safety`,
      `bun run validate:agent-docs`, and `bun run validate` pass or residual
      failures are recorded with recovery details.

---

## Dependencies

### Depends On

- Phase 03: Offline and Provider Hardening

### Enables

- Public release preparation and post-MVP ecosystem expansion.
