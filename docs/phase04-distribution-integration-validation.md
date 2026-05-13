# Phase 04 Distribution Integration Validation

Phase 04 distribution integration validation is the local-first closeout record
for release artifacts, Obsidian install and update guidance, agent surface
packages, onboarding, provider readiness, and ecosystem export or handoff
boundaries.

This record uses only synthetic fixtures such as `fixtures/demo-vault/` and
repository framework paths. It does not include provider secrets,
authorization headers, prompt bodies, raw private note bodies, hidden provider
state, private path hints, screenshots, live provider output, or real vault
content.

## Evidence Scope

| Area | Source of Truth | Validation Evidence |
|------|-----------------|---------------------|
| Release artifacts | `scripts/validate-release-artifacts.ts` | Package version, manifest version, version map, build artifact list, and SHA-256 checksums |
| Install and update | `src/utils/obsidian-install-workflow.ts` | Dry-run plans, rollback intent, downgrade blocking, troubleshooting, and no direct user-vault mutation |
| Agent packages | `src/agent/agent-surface-packaging.ts` | AGENTS, CLAUDE, GEMINI, Voidbrain skill, human command docs, supported paths, and fixture-safe examples |
| Onboarding and providers | `src/providers/provider-readiness-guidance.ts` | Local runtime, custom remote, trusted cloud, untrusted cloud, denied disclosure, and lexical fallback behavior |
| Ecosystem handoff | `src/agent/ecosystem-handoff-boundaries.ts` | Selected-output handoff, citation ID, source record, staged-change ID, report ID, artifact path, checksum, and validation output |
| Fixture safety | `scripts/check-fixture-safety.ts` | Fail-closed scans for secret-like values, private path hints, prompt bodies, hidden provider state, raw private note bodies, full-vault defaults, and direct publishing claims |

## Provider Disclosure Boundary

Local runtime paths stay local. Custom remote and cloud provider paths require
provider review, trust, auth, capability, and disclosure gates before private
vault content can leave the machine. Untrusted cloud providers remain blocked
for private vault content, and local workflows do not silently fall back to a
cloud provider when a local provider or semantic index is unavailable.

## Staged Mutation Boundary

Distribution validation does not directly mutate user vault files. Any
AI-proposed note output must remain a staged change with a before/after diff,
backup intent, audit record, staged-change ID, validation output, and retry
guidance before apply.

## Recovery Evidence

Closeout diagnostics preserve bounded recovery fields:

- command ID
- target path
- artifact path
- cache path
- report ID
- staged-change ID
- checksum
- issue code
- validation output
- retry guidance

## Validation Commands

Run these commands from the repository root for Phase 04 closeout:

```bash
bun run test -- test/phase04-distribution-integration-validation.test.ts test/agent-validation-scripts.test.ts
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-surface-package
bun run validate:agent-docs
bun run validate
```

## Integrated Test Coverage

`test/phase04-distribution-integration-validation.test.ts` validates the Phase
04 distribution path as one synthetic workflow:

- Release artifact alignment checks package metadata, Obsidian manifest
  metadata, version map entries, build artifact paths, SHA-256 checksums, and
  release validation output.
- Install/update checks dry-run planning, artifact-only plugin copy execution,
  rollback intent, downgrade blocking, explicit downgrade allowance, and safe
  install diagnostics.
- Agent package checks AGENTS, CLAUDE, GEMINI, the Voidbrain skill, human
  command docs, supported package output paths, checksums, command IDs, and
  bounded package diagnostics.
- Provider readiness checks local runtime, custom remote, trusted cloud,
  untrusted cloud, disabled cloud disclosure, and lexical fallback for blocked
  semantic readiness.
- Ecosystem handoff checks selected-output paths, citation IDs, source records,
  staged-change IDs, report IDs, artifact paths, checksums, validation output,
  cloud review gates, full-vault rejection, and direct publishing rejection.
- Redaction checks fixture-safety entries, release diagnostics, install
  diagnostics, provider diagnostics, provider recovery redaction, and unsafe
  handoff outputs.

`test/agent-validation-scripts.test.ts` adds Phase 04 regression coverage for
synchronized agent surfaces, stale command statuses, missing safety phrases,
fixture-safe examples, package paths, provider disclosure language, dry-run
language, and recovery phrases.

## Closeout Evidence

| Evidence | Path | Recovery Fields |
|----------|------|-----------------|
| Integration tests | `test/phase04-distribution-integration-validation.test.ts` | Command ID, target path, artifact path, report ID, staged-change ID, issue code, validation output |
| Shared fixtures | `test/fixtures/release/phase04-distribution-integration-fixtures.ts` | Synthetic report ID, staged-change ID, cache path, checksums, retry guidance |
| Security review | `.spec_system/specs/phase04-session06-distribution-integration-validation/security-compliance.md` | Risk map, scan coverage, validation evidence |
| Validation report | `.spec_system/specs/phase04-session06-distribution-integration-validation/validation.md` | Command output, residual failures, retry guidance |
| Final summary | `.spec_system/specs/phase04-session06-distribution-integration-validation/IMPLEMENTATION_SUMMARY.md` | Deliverables, tests, security posture, residual risks, next workflow handoff |

## Residual Risk Log

No release, install, package, provider, or handoff workflow in this closeout
uses live provider calls, public marketplace publishing, hosted sync, direct
framework update apply behavior, or unreviewed user-vault mutation.

Residual failures from final validation, if any, must be recorded with command
ID, target path, artifact path, cache path, report ID, staged-change ID, issue
code, validation output, and retry guidance.
