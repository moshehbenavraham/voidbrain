# Considerations

> Institutional memory for AI assistants. Updated between phases via carryforward.
> **Line budget**: 600 max | **Last updated**: Phase 01 (2026-05-13)

---

## Active Concerns

Items requiring attention in upcoming phases. Review before each session.

### Technical Debt

- [P01] **Recovery surface gap**: `recover-session` is still planned, so hot cache and support records must stay detailed enough to reconstruct failures without raw vault content.
- [P01] **Workflow drift risk**: phase tracking, command docs, and phase artifacts still need synchronized updates whenever session or phase state changes.

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

### What to Avoid

- [P00] **Direct user-vault writes**: Avoid bypassing staged-review flows when note mutations are introduced.
- [P00] **Tracker drift**: Do not update code without updating session and phase tracking artifacts at the same time.
- [P00] **Implicit provider trust**: Never assume cloud use is allowed without explicit settings and capability checks.
- [P00] **Hidden local assumptions**: Do not assume bundled scripts or input files are present; provide clear fallbacks and validation.
- [P01] **Raw support blobs**: Do not store unbounded note bodies, provider state, or auth material in recovery, cache, or export records.
- [P01] **Stale modal state**: Reuse of modal/store state without reset or revalidation causes misleading recovery and retry behavior.
- [P01] **Command/doc drift**: Updating a command implementation without updating docs and tests invites stale instructions.
- [P01] **Silent fallback to cloud**: Local workflows should not quietly escalate to cloud providers when preflight fails.

### Tool/Library Notes

- [P00] **Bun**: Use Bun for local validation in this repo, but keep installation guidance explicit for contributors.
- [P00] **Local analyzer fallback**: If local spec scripts are missing, use the bundled analyzer path instead of assuming `.spec_system/scripts/` already exists.
- [P01] **Obsidian APIs**: Keep vault and metadata-cache interaction behind thin adapters so service logic stays testable.
- [P01] **Svelte/Obsidian UI**: Modal and status surfaces need explicit cleanup and re-entry handling because stale UI state can outlive the underlying service.
- [P01] **Repo-local scripts**: Keeping `scripts/analyze-project.sh` in-repo removed a workflow dependency on skill-bundled helpers.

---

## Resolved

Recently closed items (buffer - rotates out after 2 phases).

| Phase | Item | Resolution |
|-------|------|------------|
| P01 | Local analyzer entry points | `scripts/analyze-project.sh` and `.spec_system/scripts/analyze-project.sh` now exist for deterministic apex-spec validation and update flows. |
| P00 | Staged-write gap | Session 06 implemented explicit staged-change review/apply flows with conflict revalidation and backups. |
| P00 | Provider disclosure boundary | Phase 01 added auth, trust, capability, and disclosure preflight before provider-dependent workflows. |
| P00 | Command-surface sync | Session 04-08 synchronized command catalogs, AGENTS, CLAUDE, GEMINI, docs, and skills with implemented behavior. |
| P00 | Fixture safety | Phase 01 kept examples and tests synthetic and enforced fixture safety in validation. |
| P00 | Tracker synchronization | Session closeouts now update state, PRD, specs, and implementation records together. |

*Auto-generated by carryforward. Manual edits allowed but may be overwritten.*
