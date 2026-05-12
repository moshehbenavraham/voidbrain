# Session Specification

**Session ID**: `phase00-session05-agent-surfaces-commands`
**Phase**: 00 - Foundation
**Status**: Complete
**Completed**: 2026-05-13
**Created**: 2026-05-12

---

## 1. Session Overview

This session creates the agent-readable command surface for Voidbrain. It turns the product requirements, vault data contracts, provider privacy boundaries, and retrieval foundation into synchronized markdown instructions and local validation scripts that AI coding tools can follow without guessing at safety policy.

The work focuses on safe scaffolding, not full autonomous execution. Agent surfaces should describe only implemented or explicitly planned behavior, keep local-first and staged-write defaults visible, and make command intent, prerequisites, privacy boundaries, and recovery paths easy to inspect in plain markdown.

This is the fifth Phase 00 implementation session. It follows the repository scaffold, vault data model, provider privacy boundaries, and indexing foundation. It should give Session 06 a clear command and documentation baseline for staged-change and health-check primitives.

---

## 2. Objectives

1. Define a canonical agent command catalog for ingest, chat, health check, staging, recovery, validation, and framework update workflows.
2. Create synchronized `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and skill-style markdown surfaces that expose only safe MVP behavior.
3. Add local validation scripts that detect stale command references, unsafe examples, and contradictory agent documentation.
4. Document safe command defaults, fixture rules, and framework update preview behavior with tests that prevent secret leakage and unreviewed vault writes.

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-repo-tooling-scaffold` - Provides TypeScript, Vite, Vitest, Biome, plugin lifecycle tests, package scripts, and local validation workflow.
- [x] `phase00-session02-vault-data-model` - Provides vault artifact contracts, fixture vault layout, generated note path rules, and no-secret validation expectations.
- [x] `phase00-session03-provider-privacy-boundaries` - Provides provider trust, capability preflight, secret reference, and redacted diagnostic boundaries.
- [x] `phase00-session04-indexing-retrieval-foundation` - Provides retrieval traceability, index freshness, fixture indexing, and citation-ready evidence contracts.

### Required Tools/Knowledge
- Markdown agent surfaces for Codex, Claude Code, Gemini CLI, and similar tools.
- Existing local-first privacy policy, staged-write requirement, and synthetic fixture boundaries.
- TypeScript strict mode, Vitest, Bun scripts, and simple CLI validation patterns.
- Existing repository docs under `docs/` and `.spec_system/CONVENTIONS.md`.

### Environment Requirements
- Dependencies installed through the existing Bun workflow.
- No live provider calls, real vault content, real provider secrets, or destructive filesystem changes.
- All examples use synthetic fixture paths and provider-free command payloads.

---

## 4. Scope

### In Scope (MVP)
- Agent-tool user can read repository-level instructions for safe Voidbrain workflows - synchronize root and tool-specific markdown surfaces.
- Agent-tool user can discover command intent, prerequisites, privacy level, staged-write policy, expected inputs, and recovery behavior - define a typed command catalog and command table.
- Developer can validate agent surfaces locally - add scripts that compare markdown surfaces to the canonical catalog and fail on stale command IDs.
- Developer can validate safe fixtures and examples - add checks for secret-like fields, real credential patterns, and user-content placeholders.
- Developer can preview framework updates safely - scaffold a dry-run update script that reports planned framework file changes without touching user vault content.

### Out of Scope (Deferred)
- Publishing packages for multiple agent ecosystems - *Reason: distribution belongs to a later phase after core behavior is implemented.*
- Autonomous multi-agent batch ingestion - *Reason: this session defines command surfaces, not concurrent agent orchestration.*
- Slack, Notion, Confluence, issue tracker, or team-surface integrations - *Reason: MVP focuses on local markdown and Obsidian-compatible workflows.*
- Full chat, ingestion, staged-change, or health-check implementation - *Reason: this session documents planned commands and validates surfaces; feature services are built in later sessions.*
- Destructive framework update or vault mutation behavior - *Reason: all mutation paths must remain staged or dry-run until Session 06 and later workflows implement review primitives.*

---

## 5. Technical Approach

### Architecture

Use a single typed command catalog as the source of truth for agent-facing workflows. Markdown surfaces should render or mirror the same command IDs, names, safety defaults, prerequisites, and status labels so Codex, Claude Code, Gemini CLI, and skill-style readers see consistent guidance. The catalog should live in `src/agent/` and stay independent from Obsidian runtime APIs.

Local validation scripts should be deterministic and fixture-safe. They should read markdown surfaces, extract command IDs and required safety phrases, compare them to the catalog, and return explicit failures instead of mutating files. Fixture checks should scan only known synthetic directories and examples. Framework update scaffolding should default to preview mode and document that user vault content is never overwritten directly.

### Design Patterns
- Catalog-first documentation: Define commands once and validate every surface against the same IDs.
- Fail-closed agent policy: Missing privacy, staging, citation, or recovery language fails validation.
- Dry-run-first scripting: Update scripts report planned actions before any later workflow can apply them.
- Synthetic fixture boundary: Tests and examples use fixture vault paths only and reject secret-like content.
- Thin runtime boundary: Agent docs and validation helpers stay separate from Obsidian lifecycle code.

### Technology Stack
- TypeScript 5.9 for command catalog contracts and validation helpers.
- Vitest 4 for catalog, markdown sync, fixture safety, and script behavior tests.
- Bun scripts for local validation commands in `package.json`.
- Markdown for `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, skill-style instructions, and docs.
- Existing vault, provider, and retrieval contracts for command safety language.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/agent-surfaces-commands.md` | Human-readable agent command catalog, safety policy, validation workflow, and deferred behavior | ~180 |
| `CLAUDE.md` | Claude Code compatible repository instructions synchronized with root agent guidance | ~120 |
| `GEMINI.md` | Gemini CLI compatible repository instructions synchronized with root agent guidance | ~120 |
| `skills/voidbrain/SKILL.md` | Skill-style command surface for tools that load repository skills | ~150 |
| `src/types/agent-commands.ts` | Public agent command, surface, safety policy, and validation result contracts | ~170 |
| `src/agent/command-catalog.ts` | Canonical MVP command catalog and helper queries | ~190 |
| `src/agent/surface-validation.ts` | Markdown surface validation helpers for command IDs, required safety phrases, and stale references | ~220 |
| `src/agent/fixture-safety.ts` | Fixture and example safety scanner for secret-like fields and unsafe content patterns | ~150 |
| `src/agent/framework-update-preview.ts` | Dry-run framework update planning helper with user-content exclusion rules | ~140 |
| `src/agent/index.ts` | Agent domain exports | ~30 |
| `scripts/validate-agent-surfaces.ts` | Local script entry point for synchronized agent surface checks | ~90 |
| `scripts/check-fixture-safety.ts` | Local script entry point for fixture and example safety checks | ~80 |
| `scripts/preview-framework-update.ts` | Local script entry point for dry-run framework update previews | ~80 |
| `test/agent-surfaces-commands.test.ts` | Unit tests for command catalog, surface sync, fixture safety, and dry-run update planning | ~320 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `AGENTS.md` | Replace placeholder with root agent instructions and safe command table | ~120 |
| `package.json` | Add local validation scripts for agent surfaces, fixture safety, and full agent-doc validation | ~12 |
| `README.md` | Link agent surfaces and local command validation workflow | ~25 |
| `src/README.md` | Document `agent/` domain ownership and boundaries | ~25 |

---

## 7. Success Criteria

### Functional Requirements
- [x] Root and tool-specific agent surfaces list the same MVP command IDs and safety defaults.
- [x] Agent command catalog captures command intent, prerequisites, privacy level, staged-write policy, inputs, outputs, and implementation status.
- [x] Local validation fails on missing command IDs, stale command references, missing safety phrases, or unsafe examples.
- [x] Framework update preview reports planned changes without touching user vault content or generated knowledge notes.
- [x] Package scripts expose repeatable checks for agent surfaces and fixture safety.

### Testing Requirements
- [x] Unit tests written and passing for command catalog completeness and helper queries.
- [x] Unit tests written and passing for markdown surface validation and stale reference detection.
- [x] Unit tests written and passing for fixture safety scanning against secret-like keys and credential-like values.
- [x] Unit tests written and passing for framework update preview exclusion of user vault content.
- [x] Manual review confirms all markdown examples are synthetic and contain no provider secrets or personal data.

### Non-Functional Requirements
- [x] Agent-facing docs preserve local-first privacy and staged-write defaults.
- [x] Validation scripts are deterministic, bounded to repository files, and safe to run repeatedly.
- [x] No command surface claims full implementation for workflows that are still planned.
- [x] Examples are portable markdown or JSON and remain readable without running the plugin.

### Quality Gates
- [x] All files ASCII-encoded.
- [x] Unix LF line endings.
- [x] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations
- Agent surfaces must stay concise enough for coding tools to follow while still exposing privacy, staging, citation, and recovery rules.
- Command status labels should distinguish implemented, scaffolded, and planned workflows to avoid overclaiming behavior.
- Validation should fail on stale or contradictory safety instructions before a release or framework update.
- Scripts must not scan arbitrary user home directories or external vaults by default.
- Framework update previews should separate framework files from user vault content and require later explicit review before apply behavior exists.

### Potential Challenges
- Agent docs can drift quickly: keep a single command catalog and validate all surfaces against it.
- Command examples can imply unsafe behavior: include privacy and staged-write notes directly in the command rows.
- Script scope can become too broad: limit checks to repository docs, synthetic fixtures, and explicit paths.
- Tool-specific files may duplicate content: use shared command IDs and brief references rather than divergent long instructions.

### Relevant Considerations
- No active concerns or lessons in `CONSIDERATIONS.md` apply yet.
- `SECURITY-COMPLIANCE.md` reports no open findings; preserve this by using synthetic examples and no-secret validation.

### Behavioral Quality Focus
Checklist active: Yes

Top behavioral risks for this session:
- Agent surfaces could describe a command as implemented when it is only planned.
- Validation scripts could miss stale command IDs and let tool-specific instructions drift.
- Examples or fixtures could accidentally include secret-like fields, private note content, or provider payloads.
- Framework update scaffolding could imply direct user vault writes instead of preview-first behavior.

---

## 9. Testing Strategy

### Unit Tests
- Test command catalog IDs, unique command names, supported surface mappings, privacy levels, and implementation status labels.
- Test markdown surface validation for missing command IDs, stale command IDs, and missing required safety phrases.
- Test fixture safety scanning for secret-like keys, credential-like values, private path hints, and allowed synthetic examples.
- Test framework update preview planning for dry-run default behavior and exclusion of generated user knowledge folders.

### Integration Tests
- Run `bun run build`, `bun run check`, `bun run lint`, and `bun run test`.
- Run the new local validation scripts through package script entries.
- Keep live provider API calls, real Obsidian vaults, network discovery, and destructive writes out of scope.

### Manual Testing
- Review `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `skills/voidbrain/SKILL.md`, and `docs/agent-surfaces-commands.md` side by side for command consistency.
- Confirm every command row states local-first privacy, staged-write or dry-run behavior, and citation requirements where applicable.
- Confirm examples reference only synthetic fixture paths and contain no API keys, tokens, passwords, personal notes, or private URLs.

### Edge Cases
- Markdown surface exists but omits one command ID.
- Markdown surface includes a deprecated or unknown command ID.
- A planned command is accidentally marked implemented.
- Secret-like key appears in nested JSON fixture text.
- Credential-like value appears in an example code block.
- Framework update preview receives a path under generated knowledge folders.
- Validation script runs from repository root with missing optional tool-specific surface files.

---

## 10. Dependencies

### External Libraries
- No new external libraries planned.

### Other Sessions
- **Depends on**: `phase00-session01-repo-tooling-scaffold`, `phase00-session02-vault-data-model`, `phase00-session03-provider-privacy-boundaries`, `phase00-session04-indexing-retrieval-foundation`.
- **Depended by**: `phase00-session06-staged-changes-health-foundation`, Phase 01 vault chat, source ingestion, agent command, and framework update workflows.

---

## Next Steps

Session complete. See `validation.md` and `IMPLEMENTATION_SUMMARY.md` for the closeout record.
