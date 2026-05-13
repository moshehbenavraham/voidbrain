# Task Checklist

**Session ID**: `phase04-session01-release-metadata-build-artifacts`
**Total Tasks**: 21
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-13

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[SNNMM]` = Session reference (NN=phase number, MM=session number)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0401] Verify Phase 03 completion, release metadata versions, and build output prerequisites (`package.json`)
- [x] T002 [S0401] Audit Obsidian artifact names and Vite production output paths (`vite.config.ts`)
- [x] T003 [S0401] [P] Create release artifact documentation skeleton (`docs/release-artifacts.md`)

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T004 [S0401] [P] Define release metadata, artifact, diagnostic, and validation issue interfaces (`src/types/release.ts`)
- [x] T005 [S0401] [P] Create synthetic release fixture builders for temp repositories and fake artifacts (`test/fixtures/release/release-artifacts-fixtures.ts`)
- [x] T006 [S0401] Implement package, manifest, and version-map parser contracts with schema-validated input and explicit error mapping (`src/utils/release-artifacts.ts`)
- [x] T007 [S0401] Implement artifact file contract and checksum helpers with bounded paths and deterministic ordering (`src/utils/release-artifacts.ts`)
- [x] T008 [S0401] Implement redacted release diagnostic shape with command IDs, version values, checksums, and validation output only (`src/utils/release-artifacts.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S0401] Implement release metadata alignment validation for package version, manifest version, version map, minimum app version, and package files (`src/utils/release-artifacts.ts`)
- [x] T010 [S0401] Implement build artifact validation for `main.js`, `styles.css`, `manifest.json`, and `versions.json` with missing-file error mapping (`src/utils/release-artifacts.ts`)
- [x] T011 [S0401] Implement checksum generation for release artifacts with sorted output and no raw file content retention (`src/utils/release-artifacts.ts`)
- [x] T012 [S0401] Create CLI adapter for release artifact validation with explicit exit codes and redacted stdout/stderr (`scripts/validate-release-artifacts.ts`)
- [x] T013 [S0401] Add release artifact validation package script and validation workflow hook (`package.json`)
- [x] T014 [S0401] Harden deploy script to share the declared artifact contract and report bounded validation output with failure-path handling (`scripts/deploy-obsidian-plugin.ts`)
- [x] T015 [S0401] Update deployment guide with reproducible local bundle, checksums, dry-run usage, and recovery details (`docs/deployment.md`)
- [x] T016 [S0401] Update release documentation links and validation command list (`README.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T017 [S0401] Write unit tests for aligned release metadata, version maps, declared files, and artifact checksum success cases (`test/release-metadata-build-artifacts.test.ts`)
- [x] T018 [S0401] Write unit tests for version drift, missing artifacts, private path hints, and secret-like diagnostics (`test/release-metadata-build-artifacts.test.ts`)
- [x] T019 [S0401] Run focused release tests and refine validation failures with recovery details (`test/release-metadata-build-artifacts.test.ts`)
- [x] T020 [S0401] Run agent fixture and documentation validations for release doc safety (`docs/release-artifacts.md`)
- [x] T021 [S0401] Run full repository validation and record command output in implementation notes (`.spec_system/specs/phase04-session01-release-metadata-build-artifacts/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] `implementation-notes.md` updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the validate workflow step to verify session completeness.
