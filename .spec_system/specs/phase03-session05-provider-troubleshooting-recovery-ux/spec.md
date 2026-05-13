# Session Specification

**Session ID**: `phase03-session05-provider-troubleshooting-recovery-ux`
**Phase**: 03 - Offline and Provider Hardening
**Status**: Complete
**Created**: 2026-05-13

---

## 1. Session Overview

This session turns the provider readiness, auth, disclosure, invocation, and semantic compatibility work from Phase 03 into user-facing troubleshooting and recovery surfaces. Users should be able to inspect why a provider-backed workflow is blocked, retest or retry the relevant setup path, reset stale provider state, and review cloud disclosure requirements before private vault content can leave the local runtime boundary.

The work matters because provider failure states are currently spread across settings, runtime status, preflight decisions, auth records, and semantic index compatibility. This session creates a small troubleshooting layer that composes those signals into bounded diagnostics and action guidance without storing provider secrets, authorization headers, prompt bodies, raw note bodies, private absolute paths, or hidden provider state.

This is a UX and diagnostics hardening session. It should improve settings and status surfaces, add recovery-safe provider reports, update documentation, and add focused tests for retry, reset, disclosure review, and redaction. It should not add live provider SDK adapters, automatically enable cloud providers, or apply any note changes from troubleshooting flows.

---

## 2. Objectives

1. Compose provider troubleshooting summaries from provider profiles, auth readiness, role capability status, privacy gates, runtime index compatibility, and recovery context.
2. Surface actionable provider readiness, retry, reset, and disclosure-review guidance in settings and status views with duplicate-trigger prevention.
3. Export or report bounded provider diagnostics with command IDs, provider IDs, model IDs, readiness codes, cache paths, report IDs, and validation output only.
4. Update provider setup and recovery documentation so local-first behavior, cloud disclosure gates, offline fallback, and secret-handling boundaries are inspectable.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-local-runtime-provider-profiles` - Provides local runtime profile, readiness, and no-secret diagnostic contracts.
- [x] `phase03-session02-openai-compatible-provider-profiles` - Provides OpenAI-compatible endpoint, trust, credential, auth, and capability readiness.
- [x] `phase03-session03-provider-transport-invocation-boundaries` - Provides invocation preflight, timeout, cancellation, retry, and redacted diagnostics.
- [x] `phase03-session04-offline-embeddings-index-compatibility` - Provides semantic compatibility, lexical fallback, and safe reindex guidance.

### Required Tools/Knowledge
- Bun validation scripts from `package.json`.
- Existing provider setup, auth-test, preflight, local runtime readiness, semantic compatibility, runtime status, and recovery service tests.
- Obsidian settings tab, status view, Svelte status surface, and plugin lifecycle wiring.

### Environment Requirements
- Repository root is `/home/aiwithapex/projects/newproject`.
- Validation runs from the repository root with Bun available.
- Tests use synthetic provider and fixture vault data only.
- No live provider calls, cloud credentials, private vault files, raw note bodies, or network access are required.

---

## 4. Scope

### In Scope (MVP)
- User can inspect provider auth, trust, capability, disclosure, local runtime, and index compatibility readiness before running provider-backed workflows - compose a troubleshooting summary from existing typed state.
- User can retry, retest, reset, or review disclosure from settings/status surfaces - disable duplicate actions while in flight and reset stale action state on re-entry.
- User can inspect bounded provider diagnostics - include command IDs, provider IDs, model IDs, readiness codes, cache paths, report IDs, source path counts, and validation output only.
- Developer can verify provider recovery behavior locally - add synthetic tests for local outage, auth failure, missing secret, capability mismatch, untrusted cloud, cloud disabled, semantic fallback, duplicate action prevention, and redaction.
- Documentation explains local runtime setup, OpenAI-compatible endpoint setup, cloud disclosure gates, offline fallback, provider recovery, and secret boundaries.

### Out of Scope (Deferred)
- Live vendor SDK adapters for chat, embeddings, or model listing - *Reason: this session reports and retries existing setup paths only.*
- Automatic cloud fallback when local providers fail - *Reason: cloud disclosure must remain explicit and user-approved.*
- Applying AI-generated note edits directly from troubleshooting flows - *Reason: note mutations remain staged through review-first workflows.*
- Phase 04 distribution packaging or marketplace release - *Reason: this session remains inside Phase 03 provider hardening.*

---

## 5. Technical Approach

### Architecture
Add a provider troubleshooting composition layer under `src/providers/` with public contracts in `src/types/provider-setup.ts`. The layer should consume existing provider definitions, plugin settings, auth records, role capability summaries, local runtime readiness, OpenAI-compatible readiness, semantic compatibility, and optional cache/report context. It should return a deterministic troubleshooting report with severity, safe diagnostics, recommended actions, and recovery fields.

Update `runtime-status.ts` so the provider status item includes the troubleshooting report and summarizes retry, reset, disclosure, and compatibility guidance without exposing raw diagnostics. Update `settings-tab.ts` to render a provider troubleshooting section near provider setup and indexing controls, using existing save/test/index refresh actions and in-flight guards. Keep Obsidian lifecycle wiring in `src/main.ts`; domain logic stays in providers, types, stores, views, and tests.

Provider reports and UI strings must remain bounded and redacted. Persistent settings must continue to store provider profiles, opaque credential references, auth status records, and selected roles only; runtime troubleshooting diagnostics remain status/report data and must not be persisted into settings, hot cache bodies, fixtures, screenshots, or generated examples.

### Design Patterns
- Contract-first troubleshooting: define typed report, diagnostic, action, and recovery contracts before rendering.
- Fail-closed disclosure: troubleshooting can explain cloud requirements but must never enable cloud silently.
- Duplicate action guards: retest, retry, reset, and refresh actions are disabled while in flight.
- Re-entry revalidation: settings and status surfaces recompute troubleshooting state on display or refresh.
- Bounded diagnostics: recovery details contain IDs, codes, counts, cache paths, report IDs, and validation output only.

### Technology Stack
- TypeScript 5.9 strict contracts.
- Obsidian Setting API and ItemView rendering.
- Svelte 5 status surface.
- Vitest 4 unit and UI/lifecycle tests.
- Bun validation scripts and existing fixture safety checks.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/providers/provider-troubleshooting.ts` | Compose provider troubleshooting reports, actions, safe diagnostics, and recovery fields | ~260 |
| `test/fixtures/providers/provider-troubleshooting-fixtures.ts` | Synthetic provider troubleshooting scenarios and expected recovery context | ~180 |
| `test/provider-troubleshooting-recovery-ux.test.ts` | Regression tests for troubleshooting reports, actions, redaction, and recovery fields | ~320 |
| `docs/provider-troubleshooting-recovery.md` | User-facing provider troubleshooting and recovery guide | ~140 |
| `.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/implementation-notes.md` | Implementation notes for this session | ~100 |
| `.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/security-compliance.md` | Session security and privacy review | ~90 |
| `.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/validation.md` | Validation command results and residual failures | ~100 |
| `.spec_system/specs/phase03-session05-provider-troubleshooting-recovery-ux/IMPLEMENTATION_SUMMARY.md` | Final session summary for archive and handoff | ~90 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/types/provider-setup.ts` | Add troubleshooting report, diagnostic, action, and recovery contracts | ~130 |
| `src/providers/index.ts` | Export troubleshooting helpers | ~10 |
| `src/agent/runtime-status.ts` | Include provider troubleshooting details, actions, and safe recovery metadata in provider status | ~120 |
| `src/types/runtime.ts` | Allow provider status input to carry optional troubleshooting reports if needed | ~40 |
| `src/views/settings-tab.ts` | Render troubleshooting summaries and retest, retry, reset, disclosure-review controls | ~180 |
| `src/views/status-view.ts` | Render provider troubleshooting details with accessible action/state text | ~80 |
| `src/components/StatusSurface.svelte` | Keep status surface provider details readable, accessible, and non-overlapping | ~70 |
| `src/main.ts` | Wire runtime refresh and safe provider troubleshooting action outcomes through existing lifecycle ownership | ~80 |
| `docs/provider-setup.md` | Link and align troubleshooting guidance with current setup docs | ~80 |
| `README.md` | Add provider troubleshooting documentation link | ~20 |
| `test/runtime-status.test.ts` | Cover provider troubleshooting summary and redaction in status snapshots | ~120 |
| `test/plugin-settings-runtime.test.ts` | Verify troubleshooting diagnostics are not persisted into settings | ~80 |
| `test/plugin-lifecycle.test.ts` | Verify provider retry/reset/status refresh lifecycle behavior | ~100 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Users can inspect provider auth, trust, capability, disclosure, local runtime, and index compatibility status before provider-backed workflows run.
- [ ] Settings and status surfaces provide retest, retry, reset, and disclosure-review guidance without starting duplicate operations.
- [ ] Runtime state is reset or revalidated when settings/status surfaces are reopened or refreshed.
- [ ] Provider diagnostics include command IDs, provider IDs, model IDs, readiness codes, cache paths, report IDs, source path counts, and validation output only.
- [ ] Cloud provider workflows remain disabled unless explicit provider review, trust, auth, capability, and disclosure settings allow them.
- [ ] Documentation covers local runtime setup, OpenAI-compatible endpoints, offline fallback, provider recovery, and secret boundaries.

### Testing Requirements
- [ ] Unit tests cover troubleshooting report composition for local outage, missing secret, auth failure, capability mismatch, untrusted cloud, cloud disabled, semantic fallback, and ready states.
- [ ] UI/lifecycle tests cover duplicate-trigger prevention and state reset or revalidation on re-entry.
- [ ] Runtime status tests prove provider troubleshooting details are bounded and redacted.
- [ ] Settings tests prove troubleshooting diagnostics do not persist into plugin settings.
- [ ] Documentation and fixture safety validations pass.

### Non-Functional Requirements
- [ ] Local-first privacy behavior remains explicit and no provider path silently escalates from local to cloud.
- [ ] Troubleshooting reports are deterministic under synthetic fixtures.
- [ ] UI text fits inside Obsidian settings and status surfaces in light and dark themes.
- [ ] No provider secrets, authorization headers, prompt bodies, raw private note bodies, private absolute paths, or hidden provider state appear in docs, fixtures, logs, screenshots, examples, settings, reports, or tests.

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
- Keep troubleshooting reports derived from existing state; do not introduce a second provider readiness source of truth.
- Keep provider action controls tied to existing auth-test, indexing refresh, settings save, and status refresh paths.
- Keep report data runtime-only unless it is already safe, bounded auth status metadata.
- Use existing fixture providers and fake vault paths for all tests.
- Preserve status and settings behavior when no provider profiles exist.

### Potential Challenges
- Provider readiness signals span several modules; centralize composition without moving Obsidian lifecycle wiring out of `src/main.ts`.
- The settings tab already has provider and index controls; keep troubleshooting dense and scannable instead of adding a bulky help surface.
- Reset actions must clear stale auth/role state without deleting opaque secret references unless the user chooses the existing delete-reference flow.
- Status view details can become noisy; summarize actions and diagnostics while keeping detailed recovery fields in the typed report.

### Relevant Considerations
- [P02] **Workflow drift risk**: Keep Phase 03 records, docs, agent surfaces, and validation artifacts synchronized as provider UX changes.
- [P02] **Spec script parity**: Preserve local analyzer behavior and record any fallback requirements in validation.
- [P01] **Obsidian runtime variance**: Recompute troubleshooting state on settings/status re-entry and avoid stale modal state.
- [P01] **Disclosure gates stay mandatory**: Cloud and remote endpoint paths require explicit trust, auth, capability, and disclosure review before private vault content can leave the local machine.
- [P01] **Redaction must remain fail-closed**: Fixtures, docs, reports, recovery records, and generated examples must exclude secrets, raw private note bodies, prompts, headers, and hidden provider state.
- [P01] **Review-first mutations**: Troubleshooting flows must not apply note edits or bypass staged review.

### Behavioral Quality Focus
Checklist active: Yes
Top behavioral risks for this session:
- Retry or reset actions may fire twice and leave stale auth/status state.
- Provider troubleshooting could imply cloud fallback when local runtime setup fails.
- Diagnostics could leak credentials, headers, prompt text, raw note bodies, private paths, or hidden provider state.

---

## 9. Testing Strategy

### Unit Tests
- Test troubleshooting report composition for ready, missing role, missing model, local offline, missing secret, auth timeout, auth failed, capability mismatch, untrusted cloud, cloud disabled, provider-blocked semantic compatibility, and lexical fallback states.
- Test provider recovery records include allowed IDs, codes, counts, cache paths, report IDs, and validation output only.
- Test action recommendations are deterministic and sorted by severity and provider role.

### Integration Tests
- Test runtime status includes provider troubleshooting details without raw diagnostics.
- Test settings tab provider troubleshooting controls disable while in flight and revalidate on display.
- Test plugin lifecycle refreshes status after provider retest, reset, and indexing refresh actions.

### Manual Testing
- Review settings and status surfaces for compact, readable provider troubleshooting text.
- Review generated docs and fixtures for fixture-safe examples only.
- Run local validation commands from the repository root and record output in `validation.md`.

### Edge Cases
- No provider profiles exist.
- Provider role is selected but provider profile was deleted.
- Model ID is stale or lacks the required capability.
- Local runtime profile is offline, timed out, or missing embedding support.
- OpenAI-compatible profile has a missing secret, failed auth, untrusted endpoint, or cloud workflows disabled.
- Semantic index compatibility is provider-blocked while lexical retrieval remains available.
- Settings/status surface is reopened after a failed action.
- Duplicate retest, retry, reset, or refresh is triggered while an action is in flight.

---

## 10. Dependencies

### External Libraries
- No new external libraries expected.

### Internal Dependencies
- `src/types/provider-setup.ts`
- `src/types/providers.ts`
- `src/types/runtime.ts`
- `src/types/retrieval.ts`
- `src/providers/provider-preflight.ts`
- `src/providers/provider-auth-test.ts`
- `src/providers/local-runtime-readiness.ts`
- `src/providers/openai-compatible-profiles.ts`
- `src/providers/privacy-guard.ts`
- `src/providers/redaction.ts`
- `src/agent/runtime-status.ts`
- `src/stores/runtime-status-store.ts`
- `src/views/settings-tab.ts`
- `src/views/status-view.ts`
- `src/components/StatusSurface.svelte`
- `src/main.ts`
- `test/fixtures/providers/provider-setup-fixtures.ts`
- `test/fixtures/vault/semantic-index-compatibility-fixtures.ts`
- `test/runtime-status.test.ts`
- `test/plugin-settings-runtime.test.ts`
- `test/plugin-lifecycle.test.ts`

### Other Sessions
- **Depends on**: `phase03-session01-local-runtime-provider-profiles`, `phase03-session02-openai-compatible-provider-profiles`, `phase03-session03-provider-transport-invocation-boundaries`, `phase03-session04-offline-embeddings-index-compatibility`
- **Depended by**: `phase03-session06-offline-provider-integration-validation`

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
