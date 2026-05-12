# Task Checklist

**Session ID**: `phase00-session01-repo-tooling-scaffold`
**Total Tasks**: 21
**Estimated Duration**: 3-4 hours
**Created**: 2026-05-12

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
| Setup | 4 | 4 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Setup (4 tasks)

Initial package-manager, repository, and dependency setup.

- [x] T001 [S0001] Document Bun-first package-manager inference, prerequisite versions, and install notes (`.spec_system/specs/phase00-session01-repo-tooling-scaffold/implementation-notes.md`)
- [x] T002 [S0001] Update generated-output ignore rules for dependencies, build output, coverage, and local Obsidian plugin artifacts (`.gitignore`)
- [x] T003 [S0001] Create package manifest with build, dev, check, lint, format, and test scripts plus minimal Obsidian plugin metadata (`package.json`)
- [x] T004 [S0001] Generate and commit Bun dependency lockfile after dependency install (`bun.lock`)

---

## Foundation (6 tasks)

Core compiler, bundler, lint, and test configuration.

- [x] T005 [S0001] [P] Create strict TypeScript compiler configuration for plugin and test source (`tsconfig.json`)
- [x] T006 [S0001] [P] Create Svelte preprocessing configuration for future Obsidian views (`svelte.config.ts`)
- [x] T007 [S0001] [P] Create Vite plugin bundling configuration with Obsidian, Electron, CodeMirror, and Node externals (`vite.config.ts`)
- [x] T008 [S0001] [P] Create Biome formatter and linter configuration matching project style (`biome.json`)
- [x] T009 [S0001] [P] Create Vitest configuration with jsdom, globals, and explicit setup file (`vitest.config.ts`)
- [x] T010 [S0001] Create deterministic test setup with UTC timezone and scoped browser global mocks (`test/setup.ts`)

---

## Implementation (7 tasks)

Main scaffold files for the Obsidian plugin shell.

- [x] T011 [S0001] Create Obsidian plugin manifest with local-first product metadata and desktop-only baseline (`manifest.json`)
- [x] T012 [S0001] Create Obsidian compatibility version map for release validation (`versions.json`)
- [x] T013 [S0001] Create plugin entrypoint lifecycle skeleton with registered resource ownership and cleanup on unload for all acquired resources (`src/main.ts`)
- [x] T014 [S0001] Create typed plugin settings contract with local-first defaults and no secret-bearing fields (`src/types/plugin.ts`)
- [x] T015 [S0001] Create settings load/save helper with shape-validated input and explicit error mapping (`src/utils/settings.ts`)
- [x] T016 [S0001] Create domain layout guide for agent, providers, vectorstore, stores, views, components, and utils ownership (`src/README.md`)
- [x] T017 [S0001] Create minimal theme-compatible style entry using Obsidian CSS variables (`src/styles.css`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T018 [S0001] [P] Create explicit Obsidian API mock for lifecycle tests with cleanup assertions (`test/__mocks__/obsidian.ts`)
- [x] T019 [S0001] [P] Write lifecycle and settings unit tests covering default load, malformed settings fallback, and unload cleanup (`test/plugin-lifecycle.test.ts`)
- [x] T020 [S0001] Run build, type check, lint, and test commands; record command output summary and blockers (`.spec_system/specs/phase00-session01-repo-tooling-scaffold/implementation-notes.md`)
- [x] T021 [S0001] Validate ASCII encoding and Unix LF line endings for created scaffold files (`.spec_system/specs/phase00-session01-repo-tooling-scaffold/implementation-notes.md`)

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
