# Considerations

> Institutional memory for AI assistants. Updated between phases via carryforward.
> **Line budget**: 600 max | **Last updated**: Phase 04 (2026-05-13)

---

## Active Concerns

Items requiring attention in upcoming phases. Review before each session.

### Technical Debt

- [P02] **Workflow drift risk**: phase tracking, command docs, and archived session stubs still need synchronized updates whenever session or phase state changes; phase 04 closeout reinforced that PRD, validation, summary, and support docs can drift if they are not updated together.
- [P04] **Spec script parity**: project-local `.spec_system/scripts/` still has `analyze-project.sh` but lacks `check-prereqs.sh`; the bundled fallback worked, but local script parity should be restored in a workflow update.

### External Dependencies

- [P01] **Obsidian runtime variance**: vault APIs, metadata cache timing, and modal lifecycle behavior can differ across vault sizes and platforms; keep fixture coverage broad.
- [P01] **Bun validation baseline**: local validation still assumes Bun and repo-local analyzer scripts are available; preserve explicit setup and fallback guidance.

### Performance / Security

- [P01] **Disclosure gates stay mandatory**: any future cloud/provider path must keep explicit trust, auth, capability, and disclosure preflight before sending vault content.
- [P01] **Redaction must remain fail-closed**: fixtures, logs, recovery records, and exported reports must continue to exclude secrets, raw private note bodies, and hidden provider state.

### Architecture

- [P01] **Review-first mutations**: note edits should keep flowing through staged review/apply paths with backup intent and conflict revalidation.
- [P01] **Framework-vault separation**: support files, framework docs, and user vault content must stay isolated so updates remain inspectable and reversible.

---

## Lessons Learned

Proven patterns and anti-patterns. Reference during implementation.

### What Worked

- [P00] **Contract-first modeling**: Define typed contracts and safety helpers before behavior so retrieval, ingestion, and staged changes share one vocabulary.
- [P00] **Synthetic fixtures**: Use fake vault data to validate path, metadata, retrieval, and health rules without exposing user content.
- [P00] **Canonical command catalog**: Keep markdown surfaces and scripts tied to one command source of truth.
- [P00] **Deterministic state models**: Explicit freshness, progress, staged-change, and recovery metadata are easier to validate than inferred state.
- [P00] **Fail-closed boundaries**: Explicit provider disclosure and redaction checks simplify safe defaults.
- [P01] **Bounded diagnostics**: Paths, counts, IDs, and readiness codes were enough for runtime status, chat, ingestion, and health flows.
- [P01] **Fail-closed preflight**: Provider auth, trust, and disclosure gates kept chat, indexing, and ingestion deterministic and local-first.
- [P01] **Review-first mutation flow**: Staged-change review and repair staging kept destructive changes inspectable and reversible.
- [P01] **Duplicate prevention**: Guarding in-flight IDs and modal/store re-entry prevented repeat apply, repair, and cache writes.
- [P01] **Local analyzer fallback**: Shipping a repo-local analyzer made validation and carryforward independent of missing bundled scripts.
- [P01] **Command-surface sync**: Updating AGENTS, CLAUDE, GEMINI, docs, and skills alongside code reduced drift.
- [P01] **Hot cache as support state**: Keeping recovery records bounded and local made session resume and summary staging safer.
- [P02] **Integrated fixture orchestration**: One closeout fixture module can exercise recovery, validation, previews, recommendations, suggestions, and queues without duplicating service tests.
- [P02] **Preview-only enforcement**: Framework update dry-run plans are easier to audit when create, update, skip, conflict, excluded, hash, issue, and recovery fields are asserted together.
- [P02] **Maintenance remains review-first**: Recommendations, placement suggestions, and ingestion outputs stay safer when integration tests assert staged-change handoff instead of direct vault mutation.
- [P02] **Queue recovery metadata**: Provider-denied, citation-blocked, canceled, retried, staged, and failed queue states are recoverable when summaries keep item IDs, source paths, target paths, staged-change IDs, validation output, and provider decisions.
- [P02] **Closeout integration coverage**: Phase-end integration tests are most useful when they exercise recovery, validation, preview, recommendation, suggestion, and queue boundaries together.
- [P03] **Provider closeout fixture orchestration**: One synthetic provider fixture module can validate local profiles, OpenAI-compatible profiles, invocation boundaries, semantic fallback, troubleshooting, and surface safety without live provider calls.
- [P03] **Endpoint classification before trust**: Schema-compatible endpoints are not safe by URL shape alone; keep remote, cloud, and local profile classification explicit.
- [P03] **Shared invocation boundaries**: One timeout/cancellation/retry/duplicate guard path keeps chat and embedding behavior aligned and easier to recover.
- [P03] **Bounded recovery metadata**: IDs, counts, readiness codes, fallback mode, and validation output were enough to diagnose failures without exposing payloads.
- [P03] **Semantic fallback evidence**: Phase 03 showed that stale, missing, incompatible, canceled, provider-blocked, and offline semantic states are easier to recover when lexical fallback and reindex guidance are asserted together.
- [P03] **Closeout integration coverage**: End-to-end phase closeout tests are most useful when they span profile readiness, invocation, fallback, troubleshooting, fixture safety, and docs sync together.
- [P04] **Distribution closeout fixture orchestration**: One synthetic distribution fixture module can validate release artifacts, install/update, agent packages, provider readiness, selected-output handoff, fixture safety, and recovery evidence without live provider calls.
- [P04] **Selected-output boundaries**: Centralize export and ecosystem handoff rules so docs can cross-link a single planner instead of repeating direct-publish and full-vault caveats.
- [P04] **Closeout validation coverage**: Run release, install/update, package, onboarding, provider readiness, handoff, and agent-doc checks together to catch drift across surfaces.
- [P04] **Distribution evidence cross-links**: Release, install, package, onboarding, provider, handoff, agent surfaces, README, PRD, security, and summary records should point to one closeout evidence page to reduce drift.

### What to Avoid

- [P00] **Direct user-vault writes**: Avoid bypassing staged-review flows when note mutations are introduced.
- [P00] **Tracker drift**: Do not update code without updating session and phase tracking artifacts at the same time.
- [P00] **Implicit provider trust**: Never assume cloud use is allowed without explicit settings and capability checks.
- [P00] **Hidden local assumptions**: Do not assume bundled scripts or input files are present; provide clear fallbacks and validation.
- [P01] **Raw support blobs**: Do not store unbounded note bodies, provider state, or auth material in recovery, cache, or export records.
- [P01] **Stale modal state**: Reuse of modal/store state without reset or revalidation causes misleading recovery and retry behavior.
- [P01] **Command/doc drift**: Updating a command implementation without updating docs and tests invites stale instructions.
- [P01] **Silent fallback to cloud**: Local workflows should not quietly escalate to cloud providers when preflight fails.
- [P02] **Late-only doc updates**: Waiting until the end of a session to update docs increases drift; update command docs and PRD records as validation evidence becomes available.
- [P03] **State update timing drift**: Keep `.spec_system/state.json` changes in the explicit update workflow even when implementation closeout updates PRD and validation artifacts.
- [P03] **Cloud safety by shape**: Do not infer disclosure safety from an OpenAI-compatible URL or API shape; trust must stay explicit.
- [P03] **Runtime-only diagnostics**: Do not persist semantic compatibility or troubleshooting diagnostics into plugin settings when they are only needed for live support flows.
- [P04] **Package and handoff scope creep**: Do not let package reuse or ecosystem handoff language imply hosted publishing, direct sync, full-vault export defaults, or copying `.voidbrain` support records into downstream packages.
- [P04] **Subtle publishing language**: Fixture-safe docs must reject wording that suggests hosted sync, public publishing, or default full-vault export even when the implementation is local-only.

### Tool/Library Notes

- [P00] **Bun**: Use Bun for local validation in this repo, but keep installation guidance explicit for contributors.
- [P00] **Local analyzer fallback**: If local spec scripts are missing, use the bundled analyzer path instead of assuming `.spec_system/scripts/` already exists.
- [P01] **Obsidian APIs**: Keep vault and metadata-cache interaction behind thin adapters so service logic stays testable.
- [P01] **Svelte/Obsidian UI**: Modal and status surfaces need explicit cleanup and re-entry handling because stale UI state can outlive the underlying service.
- [P01] **Repo-local scripts**: Keeping `scripts/analyze-project.sh` in-repo removed a workflow dependency on skill-bundled helpers.
- [P04] **Spec prereq checker fallback**: `.spec_system/scripts/` still lacks `check-prereqs.sh`; bundled apex-spec prereq fallback works, but local script parity remains a workflow maintenance item.
- [P04] **Validation harness ordering**: Phase 04 closeout surfaced one deterministic path-order assertion fix, so integration harnesses should pin expected ordering explicitly when sorting mixed docs and reports.

---

## Resolved

Recently closed items (buffer - rotates out after 2 phases).

| Phase | Item | Resolution |
|-------|------|------------|
| P01 | Local analyzer entry points | `scripts/analyze-project.sh` and `.spec_system/scripts/analyze-project.sh` now exist for deterministic apex-spec validation and update flows. |
| P01 | Recovery surface gap | Phase 02 implemented `voidbrain.recover-session` and validated redacted local support-record recovery across hot cache, logs, reports, staged changes, and validation output. |
| P01 | Workflow drift risk | Phase 02 closeout added integration validation, command docs, PRD progress, summary artifacts, and full validation evidence for the agentic maintenance phase. |
| P02 | Provider hardening closeout risk | Phase 03 added synthetic integration validation across local runtime, OpenAI-compatible, invocation, semantic fallback, troubleshooting, surface validation, fixture safety, and full repository validation. |

*Auto-generated by carryforward. Manual edits allowed but may be overwritten.*
