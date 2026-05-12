# Task Checklist

**Session ID**: `phase01-session01-obsidian-runtime-settings`
**Total Tasks**: 20
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
| Setup | 2 | 2 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial configuration and implementation context.

- [x] T001 [S0101] Verify Phase 00 runtime, settings, command catalog, provider, index, staged-change, and health prerequisites and record assumptions (`.spec_system/specs/phase01-session01-obsidian-runtime-settings/implementation-notes.md`)
- [x] T002 [S0101] Create runtime UI module directories for views, components, and stores with initial view ownership notes (`src/views/status-view.ts`)

---

## Foundation (5 tasks)

Core contracts, migration, status composition, and test runtime support.

- [x] T003 [S0101] Expand typed plugin settings for privacy defaults, provider roles, indexing preferences, UI state, and status toggles (`src/types/plugin.ts`)
- [x] T004 [S0101] Implement versioned settings migration and fail-closed validation for new fields (`src/utils/settings.ts`)
- [x] T005 [S0101] [P] Create runtime status contracts for provider, index, staged-change, and health readiness (`src/types/runtime.ts`)
- [x] T006 [S0101] Create runtime status snapshot builder for provider, index, staged-change, and health inputs without raw vault content (`src/agent/runtime-status.ts`)
- [x] T007 [S0101] Extend Obsidian test mocks for ribbon icons, setting tabs, item views, workspace leaves, and cleanup (`test/__mocks__/obsidian.ts`)

---

## Implementation (8 tasks)

Main runtime, command, settings, and status surface implementation.

- [x] T008 [S0101] [P] Create command handler registry for catalog commands with catalog-validated command IDs and explicit error mapping (`src/agent/runtime-command-handlers.ts`)
- [x] T009 [S0101] Wire catalog-backed command registration in plugin lifecycle with cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T010 [S0101] Register ribbon actions and status view entry point with cleanup on scope exit for all acquired resources (`src/main.ts`)
- [x] T011 [S0101] Create settings tab sections for privacy defaults, provider roles, indexing preferences, and UI state with state reset or revalidation on re-entry (`src/views/settings-tab.ts`)
- [x] T012 [S0101] Create compact status item view with explicit loading, empty, error, and offline states (`src/views/status-view.ts`)
- [x] T013 [S0101] [P] Create StatusSurface Svelte component for provider, index, staged-change, and health readiness with accessibility labels, focus management, and input support (`src/components/StatusSurface.svelte`)
- [x] T014 [S0101] Create runtime status store with subscription cleanup and deterministic snapshot updates (`src/stores/runtime-status-store.ts`)
- [x] T015 [S0101] Add Obsidian-theme styles for compact status surface and settings sections (`src/styles.css`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T016 [S0101] Update lifecycle tests for command, ribbon, view, settings tab, notice, and unload cleanup behavior (`test/plugin-lifecycle.test.ts`)
- [x] T017 [S0101] [P] Add settings migration tests for new settings fields and secret-free persistence (`test/plugin-settings-runtime.test.ts`)
- [x] T018 [S0101] [P] Add runtime status tests for ready, warning, error, and missing setup composition (`test/runtime-status.test.ts`)
- [x] T019 [S0101] Run agent surface and fixture safety validation and record results (`.spec_system/specs/phase01-session01-obsidian-runtime-settings/implementation-notes.md`)
- [x] T020 [S0101] Run full validation and record residual risks or recovery details (`.spec_system/specs/phase01-session01-obsidian-runtime-settings/implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for the validate workflow step

---

## Next Steps

Run the `plansession` workflow step to begin the next Phase 01 session.
