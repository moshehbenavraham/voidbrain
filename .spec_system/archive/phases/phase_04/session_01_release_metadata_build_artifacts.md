# Session 01: Release Metadata and Build Artifacts

**Session ID**: `phase04-session01-release-metadata-build-artifacts`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Align release metadata, Obsidian build output, version maps, and bundle
validation so Voidbrain can produce deterministic local release artifacts.

---

## Scope

### In Scope (MVP)

- Audit `package.json`, `manifest.json`, `versions.json`, build output names,
  release files, and repository metadata for version and compatibility drift.
- Add or harden validation for aligned plugin version, minimum Obsidian app
  version, declared release files, generated artifacts, and missing bundle
  files.
- Record release artifact diagnostics with command IDs, artifact paths,
  checksums, version values, and validation output only.
- Update release docs and local scripts needed to reproduce the artifact bundle.

### Out of Scope

- Publishing to the Obsidian community plugin directory.
- Hosted release automation or signing infrastructure.
- Writing provider secrets, private vault content, prompt bodies, or hidden
  provider state to release records.

---

## Prerequisites

- [ ] Phase 03 completed.
- [ ] Existing build, validation, manifest, version map, and deployment scripts
      are available from the repository root.
- [ ] Current package and Obsidian manifest metadata are available for review.

---

## Deliverables

1. Release metadata alignment checks.
2. Deterministic artifact bundle validation.
3. Updated release documentation with recovery details.

---

## Success Criteria

- [ ] Package, manifest, version map, and release file metadata are aligned.
- [ ] Release artifact validation reports command IDs, paths, checksums,
      version values, and validation output without secrets or private content.
- [ ] Build and release docs explain how to reproduce the local artifact
      bundle.
- [ ] Focused release metadata tests and relevant validation commands pass.
