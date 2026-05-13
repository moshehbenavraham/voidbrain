# Session Specification

**Session ID**: `phase01-session01-obsidian-runtime-settings`
**Phase**: 01 - Vault Intelligence MVP
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-13

---

## 1. Session Overview

This session wires the Phase 01 Obsidian runtime surface that later MVP workflows will use. It turns the Phase 00 plugin scaffold, command catalog, provider contracts, retrieval contracts, staged-change primitives, and health primitives into visible Obsidian entry points with typed settings and compact readiness status.

The work matters because provider setup, indexing, grounded chat, ingestion, staged review, and health reporting all need a shared runtime owner before their deeper behavior can be implemented. The plugin lifecycle remains the composition root in `src/main.ts`, while testable status, command-handler, settings, and view logic move into domain modules under `src/agent/`, `src/stores/`, `src/views/`, `src/components/`, `src/types/`, and `src/utils/`.

The session stays local-first. It does not authenticate providers, index real vault content, call cloud models, or apply note edits. Runtime status and placeholder command handlers must make missing setup explicit without exposing secrets or mutating user vault files.

---

## 2. Objectives

1. Register Phase 01 command, ribbon, view, and settings entry points from the existing command catalog.
2. Persist typed MVP settings for privacy defaults, provider roles, indexing preferences, and UI state.
3. Show compact provider, index, staged-change, and health readiness without provider calls or direct note writes.
4. Cover lifecycle registration, settings migration, and status composition with deterministic tests.

---

## 3. Prerequisites

### Required Sessions

- [x] `phase00-session01-repo-tooling-scaffold` - Provides Obsidian plugin scaffold, build tooling, and baseline lifecycle tests.
- [x] `phase00-session02-vault-data-model` - Provides durable vault contracts and synthetic fixture vocabulary.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides provider registry, capability, secret-store, redaction, and privacy guard contracts.
- [x] `phase00-session04-indexing-retrieval-foundation` - Provides index state, parsing, lexical, semantic, and retrieval primitives.
- [x] `phase00-session05-agent-surfaces-commands` - Provides canonical command catalog and synchronized agent surfaces.
- [x] `phase00-session06-staged-changes-health-foundation` - Provides staged-change and vault-health primitives for readiness reporting.

### Required Tools/Knowledge

- Bun validation commands from `package.json`.
- Obsidian plugin lifecycle APIs for commands, ribbon icons, views, settings tabs, notices, and cleanup.
- TypeScript strict typing, Svelte 5 components, Vitest, and Obsidian test mocks.
- Existing provider, retrieval, staged-change, health, and command-catalog contracts.

### Environment Requirements

- Work from the repository root.
- Use only synthetic fixtures and repository-owned paths for tests.
- Do not write provider secrets, authorization headers, raw hidden provider state, or real vault content to docs, fixtures, logs, or snapshots.

---

## 4. Scope

### In Scope (MVP)

- User can open command, ribbon, settings, and status entry points for the Phase 01 workflows - Register Obsidian lifecycle surfaces while keeping behavior explicit and recoverable.
- User can persist privacy defaults, provider role selections, indexing preferences, and UI state - Extend typed settings with migration and fail-closed validation.
- User can inspect provider, index, staged-change, and health readiness - Compose status from existing contracts without provider calls or note mutation.
- Developer can verify runtime registration and settings migration - Add Vitest coverage for lifecycle, settings, mocks, and status snapshots.

### Out of Scope (Deferred)

- Live provider authentication and model calls - Reason: Session 02 owns provider setup and privacy preflight.
- Background indexing and retrieval readiness execution - Reason: Session 03 owns indexing orchestration.
- Grounded chat, source ingestion, health scan execution, and staged-change apply - Reason: Later Phase 01 sessions own these workflows.
- Smart graph visualization - Reason: Not part of the Phase 01 Session 01 stub.

---

## 5. Technical Approach

### Architecture

`src/main.ts` remains the Obsidian composition root. It loads settings, creates runtime status state, registers catalog-backed commands, adds ribbon actions, registers the compact status view, adds the settings tab, and owns cleanup on unload.

Settings parsing and migration stay in `src/utils/settings.ts` with public settings contracts in `src/types/plugin.ts`. Runtime status contracts live in `src/types/runtime.ts`, while status composition and command handler mapping live in `src/agent/` so they can be tested without Obsidian running. UI surfaces live in `src/views/`, `src/components/`, and `src/stores/`, with Obsidian-specific wiring kept thin.

### Design Patterns

- Composition root: Keep Obsidian lifecycle registration in one owner and delegate behavior to typed services.
- Contract-first settings: Extend settings types before UI wiring so validation and migration stay deterministic.
- Fail-closed placeholders: Planned workflow commands show explicit not-ready status and never perform provider calls or note writes.
- Snapshot status: Represent provider, index, staged-change, and health readiness as serializable status snapshots.

### Technology Stack

- TypeScript with strict public contracts.
- Svelte 5 for compact status rendering.
- Obsidian API for commands, ribbon icons, item views, settings tabs, notices, and cleanup.
- Vitest and Obsidian mocks for lifecycle, settings, and status tests.
- Bun for validation commands.

---

## 6. Deliverables

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/types/runtime.ts` | Runtime readiness, status severity, and surface state contracts. | ~120 |
| `src/agent/runtime-status.ts` | Pure status snapshot builder for provider, index, staged-change, and health readiness. | ~180 |
| `src/agent/runtime-command-handlers.ts` | Catalog-backed command handler registry with local-first not-ready behavior. | ~160 |
| `src/stores/runtime-status-store.ts` | Small status store for subscriptions and deterministic snapshot updates. | ~120 |
| `src/views/settings-tab.ts` | Obsidian settings tab sections for privacy, providers, indexing, and UI state. | ~220 |
| `src/views/status-view.ts` | Obsidian status item view wrapper. | ~180 |
| `src/components/StatusSurface.svelte` | Compact provider/index/staged-change/health readiness component. | ~160 |
| `test/plugin-settings-runtime.test.ts` | Settings migration and fail-closed persistence tests. | ~160 |
| `test/runtime-status.test.ts` | Pure runtime status composition tests. | ~180 |

### Files to Modify

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/main.ts` | Register commands, ribbon actions, status view, settings tab, and runtime cleanup. | ~180 |
| `src/types/plugin.ts` | Expand plugin settings schema for Phase 01 runtime settings. | ~80 |
| `src/utils/settings.ts` | Add schema migration and validation for new settings fields. | ~160 |
| `src/styles.css` | Add Obsidian-theme status and settings surface styles. | ~120 |
| `test/__mocks__/obsidian.ts` | Mock ribbon icons, views, leaves, item views, and settings tabs. | ~180 |
| `test/plugin-lifecycle.test.ts` | Cover command, ribbon, view, settings tab, and cleanup registration. | ~180 |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Phase 01 command, ribbon, status view, and settings tab entry points register on load and clean up on unload.
- [ ] Settings persist typed privacy defaults, provider roles, indexing preferences, and UI state through Obsidian plugin storage.
- [ ] Status surface distinguishes missing setup, ready, warning, and error states for provider, index, staged-change, and health readiness.
- [ ] Planned commands do not call providers, index real vault content, or mutate vault notes.

### Testing Requirements

- [ ] Unit tests cover settings migration, fail-closed recovery, and secret-free persisted settings.
- [ ] Lifecycle tests cover commands, ribbon actions, status view registration, settings tab registration, and unload cleanup.
- [ ] Status tests cover ready, warning, error, and missing setup status composition.
- [ ] Manual smoke testing in the mock lifecycle verifies notices are explicit and local-first.

### Non-Functional Requirements

- [ ] Runtime I/O remains bounded to Obsidian plugin APIs and does not write arbitrary filesystem paths.
- [ ] Automated workflows write zero provider secrets or API keys into markdown, logs, fixtures, generated examples, or snapshots.
- [ ] UI surfaces are keyboard reachable and follow Obsidian light and dark theme variables.
- [ ] Status snapshots avoid raw vault content and expose only paths, counts, and setup state.

### Quality Gates

- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.
- [ ] `bun run validate:agent-surfaces` passes.
- [ ] `bun run validate:fixture-safety` passes.
- [ ] `bun run validate:agent-docs` passes.
- [ ] `bun run validate` passes or residual failures are recorded with recovery details.

---

## 8. Implementation Notes

### Key Considerations

- Keep plugin lifecycle wiring in `src/main.ts`; do not move Obsidian ownership into lower-level services.
- Keep command handlers fail-closed until their owning Phase 01 sessions implement real behavior.
- Settings migration must preserve local-first defaults when unsupported values are present.
- Status labels should be specific enough to guide the user but must not include provider secrets or raw vault note content.

### Potential Challenges

- Obsidian API mock coverage may lag runtime needs: Expand mocks only for APIs used by this session and keep them deterministic.
- Settings schema expansion can break persisted data: Add versioned migration and default recovery tests.
- Svelte component wiring can overreach the session: Keep the component compact and status-only.
- Command catalog may include planned workflows: Register entry points with explicit not-ready behavior instead of implementing later workflows early.

### Relevant Considerations

- [P00] **Tracker synchronization**: Keep state, spec, task checklist, and later validation artifacts aligned so workflow commands can trust repo state.
- [P00] **Staged-write gap**: Do not introduce any direct note write path; planned staged-change commands remain review-first placeholders.
- [P00] **Provider disclosure boundary**: Runtime status and settings must preserve explicit provider review before any cloud/private-data workflow.
- [P00] **Fixture safety**: Tests and snapshots must use synthetic fixtures and avoid secret-like values or private path hints.
- [P00] **Contract-first boundaries**: Compose runtime status from existing provider, retrieval, staged-change, health, and command contracts.

### Behavioral Quality Focus

Checklist active: Yes

Top behavioral risks for this session:
- Lifecycle resources remain registered after unload and duplicate commands or views appear after reload.
- Settings migration accepts unsupported privacy or provider values and silently enables unsafe behavior.
- Status or notices accidentally expose secrets, raw vault content, or hidden provider state.
- Placeholder commands make users think workflows ran when they only opened a not-ready surface.

---

## 9. Testing Strategy

### Unit Tests

- Validate settings parsing, migration, recovery, and save behavior for all new settings fields.
- Validate runtime status snapshot composition for missing setup, ready, warning, and error states.
- Validate command handler registry returns explicit local-first not-ready outcomes for planned workflows.

### Integration Tests

- Extend plugin lifecycle tests to verify commands, ribbon icons, view registration, settings tab registration, notices, and cleanup.
- Verify Obsidian mocks expose only the APIs needed by this session and preserve deterministic state between tests.

### Manual Testing

- Run the plugin lifecycle test path and inspect command notices for local-first, not-ready, and no-direct-write wording.
- Check the compact status surface in both missing setup and ready fixture states where possible.

### Edge Cases

- Persisted settings have an older schema version or missing new fields.
- Persisted provider role IDs are empty, unknown, duplicated, or cloud-only while cloud workflows are disabled.
- Status snapshot has no providers, no index state, zero staged changes, and no health report.
- Plugin unload runs more than once after partial load or failed registration.

---

## 10. Closeout

This session completed successfully and passed validation. The next workflow step is `plansession` because Phase 01 still has unfinished sessions.

---

## 10. Dependencies

### External Libraries

- No new external runtime dependencies expected.
- Existing `obsidian`, `svelte`, `vitest`, `vite`, `typescript`, `biome`, and `bun` toolchain remain in use.

### Internal Modules

- `src/agent/command-catalog.ts`
- `src/providers/provider-registry.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/redaction.ts`
- `src/vectorstore/index-state.ts`
- `src/agent/staged-change-service.ts`
- `src/agent/vault-health.ts`
- `src/utils/settings.ts`
- `test/__mocks__/obsidian.ts`

### Other Sessions

- **Depends on**: Phase 00 Sessions 01-06.
- **Depended by**: Phase 01 Sessions 02, 03, 06, 07, and 08.

---

## Next Steps

Run the `plansession` workflow step to begin the next Phase 01 session.
