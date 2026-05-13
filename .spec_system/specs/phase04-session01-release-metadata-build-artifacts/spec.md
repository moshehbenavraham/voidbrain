# Session Specification

**Session ID**: `phase04-session01-release-metadata-build-artifacts`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session starts Phase 04 by turning the existing Obsidian plugin build
surface into a deterministic, locally reproducible release artifact workflow.
The current repository already has aligned `package.json`, `manifest.json`,
`versions.json`, Vite production output under `build/voidbrain/`, and a local
dev-vault deploy helper. The work is to make that release surface validated,
documented, and recoverable.

The session matters because distribution is where metadata drift and accidental
leakage become user-facing. Version values, minimum Obsidian app compatibility,
declared package files, generated bundle files, checksums, and validation
output need one fail-closed check before later sessions add install, update,
agent packaging, onboarding, and ecosystem handoff workflows.

The implementation must preserve Voidbrain's local-first contract. Release
diagnostics can record command IDs, artifact paths, version values, checksums,
and validation output, but must not persist provider secrets, private vault
content, raw prompt bodies, authorization headers, hidden provider state, or
private path hints.

---

## 2. Objectives

1. Add a deterministic release artifact validation path for package metadata,
   Obsidian manifest metadata, version map entries, declared files, and build
   outputs.
2. Produce bounded release diagnostics that include command IDs, artifact
   paths, checksums, version values, and validation output only.
3. Update local release documentation so contributors can reproduce the bundle
   and understand recovery steps without touching user vault content.
4. Cover release metadata drift and unsafe diagnostics with focused Vitest and
   fixture-safety checks.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase03-session01-local-runtime-provider-profiles` - Local provider
      readiness and redacted diagnostics are available.
- [x] `phase03-session02-openai-compatible-provider-profiles` - Endpoint,
      credential, trust, and capability boundaries are explicit.
- [x] `phase03-session03-provider-transport-invocation-boundaries` - Provider
      invocation failure paths are cancellable, bounded, and redacted.
- [x] `phase03-session04-offline-embeddings-index-compatibility` - Offline
      semantic fallback evidence and compatibility diagnostics are available.
- [x] `phase03-session05-provider-troubleshooting-recovery-ux` - Recovery
      details use IDs, codes, paths, and validation output instead of payloads.
- [x] `phase03-session06-offline-provider-integration-validation` - Phase 03
      closeout validation, docs sync, and security posture are complete.

### Required Tools/Knowledge

- Bun scripts and Vitest test patterns used in `scripts/` and `test/`.
- Vite Obsidian plugin build output conventions from `vite.config.ts`.
- Obsidian plugin metadata requirements in `manifest.json` and `versions.json`.
- Existing deploy helper behavior in `scripts/deploy-obsidian-plugin.ts`.
- Fixture-safety and agent-doc validation expectations.

### Environment Requirements

- Run commands from the repository root.
- No real vault content or provider credentials are needed.
- Release validation uses local files only: `package.json`, `manifest.json`,
  `versions.json`, Vite build output, docs, scripts, and synthetic fixtures.
- Build output may be regenerated locally with `bun run build`.

---

## 4. Scope

### In Scope (MVP)

- Developer can validate package, manifest, version map, release file, and
  generated bundle alignment - implement a local TypeScript validation helper
  and CLI script.
- Developer can inspect deterministic release artifact diagnostics - include
  command ID, artifact paths, SHA-256 checksums, version values, and validation
  output without raw file payloads.
- Developer can reproduce the local Obsidian plugin bundle - document build,
  validation, dry-run deploy, expected artifact names, and recovery details.
- Repository validation can catch release drift - add focused tests and package
  script coverage that fit the current Bun/Vitest validation stack.

### Out of Scope (Deferred)

- Publishing to the Obsidian community plugin directory - *Reason: Phase 04
  focuses on local release readiness before public registry submission.*
- Hosted release automation, signing, or CI publishing - *Reason: MVP has no
  hosted deployment target and no release-signing infrastructure.*
- Install, update, rollback, and user-facing Obsidian workflow polish -
  *Reason: covered by Phase 04 Session 02.*
- Agent ecosystem package exports - *Reason: covered by Phase 04 Session 03.*
- Writing provider secrets, private vault content, prompt bodies, or hidden
  provider state to release records - *Reason: explicitly forbidden by the
  local-first and provider-secrets rules.*

---

## 5. Technical Approach

### Architecture

Add release artifact validation as a testable domain utility with a small CLI
adapter. The utility reads repository metadata and build artifacts, compares
declared package files with actual release files, validates version alignment
across `package.json`, `manifest.json`, and `versions.json`, and computes
checksums for release artifacts without retaining raw file content.

The CLI adapter should fail closed with explicit exit codes and redacted
messages. Existing deploy behavior should either reuse the same declared
artifact contract or mirror it from one source so deploy validation and release
validation cannot drift. Documentation should describe local build, validation,
dry-run deploy, expected files, checksums, and retry details.

### Design Patterns

- Pure validation utility plus CLI adapter: keeps release logic testable without
  shelling out in unit tests.
- Fail-closed issue list: reports every metadata or artifact problem with a
  stable code, path, and remediation.
- Bounded diagnostics: stores IDs, paths, sizes, hashes, versions, and command
  output summaries only.
- Fixture-safe examples: tests use synthetic temp repos and `test/fixtures/`
  helpers, never private vault paths or real credentials.

### Technology Stack

- TypeScript strict mode for release contracts and validators.
- Bun for CLI execution and package scripts.
- Vitest for release metadata and artifact validation tests.
- Node `crypto` for SHA-256 checksums.
- Vite production build output under `build/voidbrain/`.
- Obsidian metadata files: `manifest.json` and `versions.json`.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/release.ts` | Typed release validation issues, artifacts, diagnostics, and result contracts | ~120 |
| `src/utils/release-artifacts.ts` | Pure release metadata, artifact, checksum, and redaction validation logic | ~260 |
| `scripts/validate-release-artifacts.ts` | Bun CLI adapter for local release validation | ~90 |
| `test/fixtures/release/release-artifacts-fixtures.ts` | Synthetic temp-repo release metadata and artifact fixture helpers | ~140 |
| `test/release-metadata-build-artifacts.test.ts` | Focused Vitest coverage for success, drift, missing artifact, and safety failures | ~220 |
| `docs/release-artifacts.md` | Local release artifact reproduction, validation, checksum, and recovery guide | ~120 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `package.json` | Add `validate:release-artifacts` and wire it into the validation workflow if scoped runtime is acceptable | ~6 |
| `scripts/deploy-obsidian-plugin.ts` | Share or mirror the release artifact contract and improve bounded validation output | ~60 |
| `docs/deployment.md` | Link the release artifact guide and document expected bundle validation | ~50 |
| `README.md` | Add release artifact validation command and docs link | ~15 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Package version, manifest version, version-map entry, minimum Obsidian app
      version, and package `files` entries are validated together.
- [ ] Release validation checks `main.js`, `styles.css`, `manifest.json`, and
      `versions.json` as the local plugin artifact bundle.
- [ ] Diagnostics include command ID, artifact paths, artifact sizes,
      SHA-256 checksums, version values, and validation output only.
- [ ] Validation fails closed for missing artifacts, version drift, undeclared
      release files, private path hints, and secret-like diagnostic values.

### Testing Requirements

- [ ] Unit tests written and passing.
- [ ] CLI adapter test coverage uses synthetic temp repositories or
      `test/fixtures/` helpers.
- [ ] Manual release validation completed with local build output.

### Non-Functional Requirements

- [ ] Automated workflows write zero provider secrets, API keys, private vault
      content, raw prompts, authorization headers, or hidden provider state into
      docs, logs, fixtures, examples, or release diagnostics.
- [ ] Build, type check, lint, tests, agent docs checks, and release validation
      pass before artifacts are treated as release-ready.
- [ ] Release documentation preserves the local-only deployment model and makes
      provider disclosure boundaries explicit.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations

- `package.json`, `manifest.json`, and `versions.json` currently align on
  version `0.1.30` and minimum Obsidian app version `1.5.0`; tests should make
  drift explicit.
- `vite.config.ts` writes production output to `build/voidbrain/` with
  `main.js` and `styles.css`; manifest and version map are copied from the repo
  root by the deploy helper.
- `package.json` declares release files as `main.js`, `manifest.json`,
  `styles.css`, and `versions.json`; release validation should compare this
  list with the artifact contract in deterministic order.
- Documentation should keep local build and dev-vault deploy separate from user
  vault note mutation workflows.

### Potential Challenges

- Build artifacts may be absent on a clean checkout: return explicit missing
  artifact issues with a remediation to run `bun run build`.
- Deploy and validation artifact lists can drift: define or mirror one typed
  artifact contract and assert it in tests.
- Diagnostic output can accidentally include absolute user paths: normalize to
  repository-relative artifact paths and reject private path hints in docs and
  fixtures.
- Full validation can be slower after adding build-dependent checks: keep unit
  tests synthetic and make CLI validation explicit in the package script.

### Relevant Considerations

- [P02] **Workflow drift risk**: Update package scripts, release docs, tests,
  and session state together so distribution docs do not lag behavior.
- [P02] **Spec script parity**: Keep local scripts authoritative and avoid
  relying on missing bundled helpers for release validation.
- [P01] **Bun validation baseline**: Preserve explicit Bun setup and fallback
  guidance in release docs.
- [P01] **Disclosure gates stay mandatory**: Release docs must not imply cloud
  or remote provider use without explicit provider review and approval.
- [P01] **Redaction must remain fail-closed**: Release diagnostics, fixtures,
  docs, and validation output must exclude secrets, raw private note bodies,
  prompt bodies, hidden provider state, and private path hints.
- [P03] **Bounded recovery metadata**: Use command IDs, artifact paths,
  checksums, version values, and validation output instead of raw payloads.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- CLI validation reads external repository files; inputs need schema validation
  and explicit error mapping.
- Release diagnostics summarize filesystem artifacts; output must stay bounded
  and must not include raw file content or private absolute paths.
- Deploy validation can touch a dev vault plugin directory; existing dry-run and
  failure-path behavior should remain explicit and non-mutating when requested.

---

## 9. Testing Strategy

### Unit Tests

- Validate aligned `package.json`, `manifest.json`, `versions.json`, and
  declared package files.
- Validate version drift, missing version map entries, missing artifact files,
  unexpected artifact names, and unsafe diagnostic values.
- Validate deterministic checksum and artifact ordering without retaining raw
  file content.

### Integration Tests

- Run `bun run validate:release-artifacts` after `bun run build` against the
  real repository release surface.
- Run `bun run validate:fixture-safety` so release docs and fixtures fail
  closed on secrets, private paths, and credential-like values.
- Run `bun run validate:agent-docs` to keep release-facing command guidance
  synchronized.

### Manual Testing

- Run `bun run build`.
- Run `bun run validate:release-artifacts`.
- Run `bun run deploy:obsidian -- --dry-run` with a fake or omitted vault path
  to confirm errors stay bounded and actionable.

### Edge Cases

- Clean checkout with no `build/voidbrain/` artifacts.
- `package.json` and `manifest.json` versions diverge.
- `versions.json` lacks the current manifest version or maps it to a different
  minimum app version.
- Artifact checksum generation encounters unreadable files.
- Diagnostic text contains a secret-like value or private path hint.

---

## 10. Dependencies

### External Libraries

- None expected. Use Node and Bun built-ins before adding dependencies.

### Internal Dependencies

- `scripts/deploy-obsidian-plugin.ts` for current artifact copy behavior.
- `scripts/check-fixture-safety.ts` for fixture-safe docs and examples.
- `scripts/validate-agent-surfaces.ts` for synchronized command surfaces.
- `vite.config.ts` for production build output names.
- `manifest.json`, `versions.json`, and `package.json` for release metadata.

### Other Sessions

- **Depends on**: Phase 03 completed, especially
  `phase03-session06-offline-provider-integration-validation`.
- **Depended by**: `phase04-session02-obsidian-install-update-workflow` and
  `phase04-session06-distribution-integration-validation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
