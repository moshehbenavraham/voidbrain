# Session Specification

**Session ID**: `phase04-session02-obsidian-install-update-workflow`
**Phase**: 04 - Distribution and Ecosystem
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session hardens the local Obsidian install and update path that follows
the release artifact validation work from Session 01. The repository already
has deterministic artifact validation, a `deploy:obsidian` helper, and
deployment documentation. This session turns that surface into an inspectable
workflow for fresh installs, updates, dry runs, compatibility notes, and
rollback diagnostics.

The work matters because distribution tooling touches an Obsidian vault
boundary. It must copy only plugin framework artifacts into
`.obsidian/plugins/voidbrain`, never move or mutate user notes, and keep all
diagnostics bounded to command IDs, artifact paths, target plugin paths,
version values, checksums, validation output, and rollback intent.

The implementation should reuse the Session 01 release artifact contract
instead of creating a second artifact list. The deploy script should remain a
thin CLI adapter over typed, testable install/update planning logic, while
docs should explain local install, update, rollback, and troubleshooting with
synthetic paths only.

---

## 2. Objectives

1. Add a typed install/update planning layer for Obsidian plugin deployment
   that validates target plugin boundaries and release artifacts before copy.
2. Surface compatibility and update diagnostics for fresh install, reinstall,
   upgrade, downgrade, invalid existing manifest, and release validation
   failure cases.
3. Preserve vault safety by ensuring deploy tooling copies only plugin
   artifacts and does not read, move, rewrite, delete, or stage user vault
   notes.
4. Update install, update, rollback, compatibility, and troubleshooting docs
   with fake vault paths, bounded diagnostics, and recovery details.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase04-session01-release-metadata-build-artifacts` - Release artifact
      contract, validation CLI, checksums, docs, and deploy validation hook are
      available.
- [x] `phase03-session06-offline-provider-integration-validation` - Provider
      closeout validation, redaction posture, fixture safety, and recovery
      expectations are complete.

### Required Tools/Knowledge

- Bun package scripts, Vitest, and synthetic fixture patterns.
- Existing deploy helper behavior in `scripts/deploy-obsidian-plugin.ts`.
- Release artifact types and validators in `src/types/release.ts` and
  `src/utils/release-artifacts.ts`.
- Obsidian plugin folder layout under `.obsidian/plugins/<plugin-id>`.
- Fixture-safety expectations for fake vault paths and secret redaction.

### Environment Requirements

- Run commands from the repository root.
- No real vault content or provider credentials are required.
- Tests must use temporary directories or `test/fixtures/` data with fake
  vault paths.
- Runtime install/update logic may target a real dev vault only when the user
  explicitly provides `VOIDBRAIN_DEV_VAULT` or `--vault`.

---

## 4. Scope

### In Scope (MVP)

- Developer can preview and run a vault-safe local install or update - reuse
  release artifact validation and validate the target plugin path before copy.
- Developer can inspect update diagnostics - include command ID, operation
  kind, target plugin path, artifact path, installed version, incoming version,
  validation output, and rollback intent.
- Developer can detect compatibility and update risk - classify fresh install,
  upgrade, reinstall, downgrade, invalid existing manifest, missing artifact,
  and target path errors.
- User and contributor docs explain local install, update, rollback, dry-run,
  compatibility, and troubleshooting with synthetic examples and no secrets.

### Out of Scope (Deferred)

- Automatic Obsidian marketplace installation - *Reason: Phase 04 is preparing
  local release readiness, not hosted registry distribution.*
- Syncing, migrating, or rewriting user vault content - *Reason: install and
  update tooling must be framework-only and vault-safe.*
- Auto-applying AI-proposed note changes during install or update - *Reason:
  note mutations must continue through staged review workflows.*
- Live Obsidian app version detection - *Reason: the local script can report
  required `minAppVersion`, but Obsidian runtime inspection is not available
  from the repository CLI.*

---

## 5. Technical Approach

### Architecture

Create a pure install/update workflow utility that receives repository root,
vault root, deploy options, release validation output, and filesystem adapter
operations. The utility should normalize paths, validate that the target is
bounded to `.obsidian/plugins/voidbrain`, read any existing installed
`manifest.json`, classify the operation, and produce a bounded diagnostic plan.

Keep `scripts/deploy-obsidian-plugin.ts` as the CLI adapter. It should parse
arguments, run or skip the build, call release validation, ask the workflow
utility for a plan, print redacted dry-run or execution output, and copy only
the artifact contract files. Any rollback support should be explicit as backup
or rollback intent for plugin artifacts only, not user note files.

Documentation should be updated alongside code so local install, update,
dry-run, rollback, and troubleshooting instructions remain synchronized with
the implemented CLI behavior.

### Design Patterns

- Pure planner plus CLI adapter: keeps path, compatibility, and rollback logic
  testable without invoking Bun or touching a real vault.
- Single artifact contract: reuse `RELEASE_ARTIFACT_CONTRACT` so release
  validation and deployment copy plans cannot drift.
- Fail-closed issue list: every blocked install/update path reports a stable
  code, target path, artifact path, validation output, and remediation.
- Bounded diagnostics: support records use IDs, relative paths, versions,
  checksums, operation kinds, and rollback intent only.
- Fixture-safe examples: tests and docs use temp directories or fake paths such
  as `fixtures/demo-vault/`.

### Technology Stack

- TypeScript strict mode for install/update contracts and planners.
- Bun for deploy CLI execution and validation scripts.
- Vitest for install/update planner coverage.
- Node filesystem and path APIs behind small testable helpers.
- Existing release artifact validation from `src/utils/release-artifacts.ts`.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/obsidian-install.ts` | Typed install/update options, issues, operation kinds, target paths, rollback intent, and diagnostics | ~150 |
| `src/utils/obsidian-install-workflow.ts` | Pure install/update planner, target path validation, installed manifest parsing, update classification, rollback intent, and diagnostic safety checks | ~300 |
| `test/fixtures/release/obsidian-install-fixtures.ts` | Synthetic repo and fake vault fixture helpers for install/update tests | ~160 |
| `test/obsidian-install-update-workflow.test.ts` | Focused Vitest coverage for safe install, update, downgrade, invalid target, rollback, and redaction cases | ~260 |
| `docs/obsidian-install-update.md` | User-facing local install, update, rollback, compatibility, dry-run, and troubleshooting guide | ~160 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `scripts/deploy-obsidian-plugin.ts` | Route deploy through the install/update planner, print bounded diagnostics, and preserve dry-run preview-only behavior | ~120 |
| `docs/deployment.md` | Link the install/update guide and summarize vault-safe deploy behavior, diagnostics, and recovery | ~60 |
| `docs/release-artifacts.md` | Cross-link install/update flow and clarify artifact validation handoff to deploy | ~30 |
| `README.md` | Add local install/update workflow link and command summary | ~20 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Deploy planning validates release artifacts and target plugin path before
      any copy or clean operation.
- [ ] Dry run remains preview-only and reports planned actions without
      building, copying, cleaning, backing up, or touching vault files.
- [ ] Install/update diagnostics include command ID, operation kind, target
      plugin path, artifact path, installed version when available, incoming
      version, validation output, and rollback intent.
- [ ] Existing user notes and vault data are not read, moved, rewritten,
      deleted, staged, or indexed by install/update tooling.
- [ ] Invalid target paths, invalid existing manifests, missing artifacts,
      downgrade risk, and release validation failure paths fail closed with
      remediation.

### Testing Requirements

- [ ] Unit tests cover fresh install, upgrade, reinstall, downgrade handling,
      invalid target path, invalid installed manifest, dry-run, and rollback
      diagnostics.
- [ ] Fixture tests use synthetic temp vaults and fake paths only.
- [ ] Documentation and fixture-safety validation pass.

### Non-Functional Requirements

- [ ] Automated workflows write zero provider secrets, API keys, private vault
      content, raw prompts, authorization headers, hidden provider state, or
      private path hints into docs, fixtures, logs, examples, or diagnostics.
- [ ] Install/update planning uses deterministic ordering for artifact copy
      plans and validation issues.
- [ ] Recovery details preserve command ID, target path, artifact path,
      validation output, rollback intent, and remediation.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations

- Session 01 changed package and manifest version values to `0.1.31`; the
  install/update planner should compare installed and incoming versions without
  hardcoding a specific version.
- `scripts/deploy-obsidian-plugin.ts` already avoids printing the absolute
  vault path and copies only release artifacts. Preserve that safety while
  moving path and operation classification into a testable utility.
- The target path must remain `.obsidian/plugins/voidbrain`; helper code should
  reject traversal, URL-like values, private path hints in persisted examples,
  and unexpected artifact names.
- Rollback details should describe plugin artifact recovery only. They must not
  imply user note backups, vault migrations, or staged note changes.

### Potential Challenges

- Existing dev vaults may have partial or malformed plugin installs: classify
  them explicitly and provide remediation instead of silently overwriting.
- Version comparison can be misleading for prerelease or malformed values:
  prefer conservative classification and warnings over broad semver behavior.
- Clean deploy can remove old plugin artifacts: bound the clean list to the
  artifact contract and never delete arbitrary plugin or vault paths.
- Runtime output can accidentally expose absolute private paths: keep persisted
  diagnostics and docs repository-relative or plugin-relative.

### Relevant Considerations

- [P02] **Workflow drift risk**: Update docs and session artifacts alongside
  deploy behavior so Phase 04 tracking stays synchronized.
- [P02] **Spec script parity**: Keep local validation instructions explicit
  and avoid assumptions about missing helper scripts.
- [P01] **Obsidian runtime variance**: Install/update guidance should account
  for different vault states and platform paths without relying on live
  Obsidian internals.
- [P01] **Redaction must remain fail-closed**: Tests should assert diagnostic
  safety for private path hints, secret-like values, and raw payloads.
- [P01] **Review-first mutations**: Install/update workflows must not apply
  note edits or bypass staged changes.
- [P03] **Bounded recovery metadata**: Use IDs, paths, versions, checksums,
  issue codes, validation output, and rollback intent instead of raw payloads.

### Behavioral Quality Focus

Checklist active: Yes
Top behavioral risks for this session:
- Deploy code accidentally copies to or cleans outside `.obsidian/plugins/voidbrain`.
- Dry-run or diagnostics leak private absolute paths, provider secrets, or raw
  vault content.
- Update or rollback handling silently overwrites a malformed existing install
  without enough recovery context.

---

## 9. Testing Strategy

### Unit Tests

- Test install/update planner outputs for fresh install, upgrade, reinstall,
  downgrade risk, invalid target path, malformed installed manifest, and
  release validation failure.
- Test diagnostic safety for private path hints, secret-like values, raw
  provider state, and unexpected artifact names.

### Integration Tests

- Exercise the deploy helper through synthetic temp repositories and fake vault
  directories where practical, without requiring a real Obsidian vault.
- Confirm deploy copy plans use the same artifact names and ordering as
  `RELEASE_ARTIFACT_CONTRACT`.

### Manual Testing

- Run `bun run deploy:obsidian -- --dry-run --vault fixtures/demo-vault` or an
  equivalent fake path to confirm no build or copy occurs.
- If a real dev vault is explicitly configured, run a dry run first and then a
  normal deploy only after release validation passes.

### Edge Cases

- Missing `.obsidian/` directory with and without `--create-obsidian-folder`.
- Existing plugin folder with no manifest or malformed manifest.
- Downgrade attempt from a higher installed version to a lower incoming
  artifact version.
- Clean deploy with extra files present in the plugin folder.
- Missing build output or release artifact validation failure.

---

## 10. Dependencies

### External Libraries

- No new external runtime dependencies expected.

### Internal Dependencies

- `src/types/release.ts` and `src/utils/release-artifacts.ts` for artifact
  contract and validation output.
- `scripts/deploy-obsidian-plugin.ts` for CLI integration.
- `test/fixtures/release/release-artifacts-fixtures.ts` for synthetic release
  fixture patterns.

### Other Sessions

- **Depends on**: `phase04-session01-release-metadata-build-artifacts`
- **Depended by**: `phase04-session03-agent-skill-surface-packaging`,
  `phase04-session04-onboarding-provider-readiness-guides`,
  `phase04-session06-distribution-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
