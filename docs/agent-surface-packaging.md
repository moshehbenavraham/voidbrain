# Agent Surface Packaging

Voidbrain agent surfaces can be reused as local framework instructions for
compatible coding tools. Packaging is a repository-local validation workflow,
not hosted marketplace publishing and not permission to mutate user vault
notes directly.

## Packageable Surfaces

The packageable surface set is declared in `src/agent/command-catalog.ts`:

| Surface | Target Ecosystem | Repository Path |
|---------|------------------|-----------------|
| Codex repository instructions | Codex-style agents | `AGENTS.md` |
| Claude Code instructions | Claude Code | `CLAUDE.md` |
| Gemini CLI instructions | Gemini CLI | `GEMINI.md` |
| Voidbrain skill | Codex skill runtime | `skills/voidbrain/SKILL.md` |
| Human command docs | Contributors | `docs/agent-surfaces-commands.md` |

Each surface must stay synchronized with the implemented command catalog and
must preserve local-first behavior, staged changes, provider secrets
boundaries, synthetic fixtures, citations, dry-run framework update language,
and recovery details.

## Readiness Validation

Run package readiness checks from the repository root:

```bash
bun run validate:agent-surface-package
bun run validate:agent-surface-package -- --json
```

The planner validates repository-relative paths, loads declared surfaces,
checks command IDs and statuses, scans examples for unsafe fixture content,
computes SHA-256 checksums, and returns deterministic diagnostics. A ready
manifest includes surface ID, target ecosystem, path, checksum, command catalog
status, validation issues, and recovery details.

Readiness fails closed when a surface is missing, unreadable, outside the
allowed framework paths, stale against the command catalog, missing safety
language, or contains private path hints, credential-like values, prompt
bodies, hidden provider state, authorization headers, `.voidbrain` records,
`EXAMPLES`, or user vault content.

## Local Reuse

Use synthetic or framework-owned destinations when testing reuse:

```bash
mkdir -p fixtures/demo-repo/skills
cp AGENTS.md fixtures/demo-repo/AGENTS.md
cp CLAUDE.md fixtures/demo-repo/CLAUDE.md
cp GEMINI.md fixtures/demo-repo/GEMINI.md
cp -R skills/voidbrain fixtures/demo-repo/skills/voidbrain
```

For a real downstream repository, copy only the framework instruction files
after reviewing the manifest. Do not copy `.voidbrain` support records,
fixture vault notes, provider configuration, raw prompt bodies, private note
content, or local research inputs. Keep any downstream examples under
`test/fixtures/vault/` or clearly fake paths such as `fixtures/demo-vault/`.

## Ecosystem Handoff

Agent surface package reuse is a selected framework-surface handoff. Follow
[Ecosystem Export And Handoff Boundaries](ecosystem-export-handoff-boundaries.md)
and preserve selected surface paths, target ecosystems, command catalog status,
checksums, validation output, package diagnostic path when present, and
recovery details. This is local file reuse only; it is not hosted publishing,
marketplace distribution, external sync, or permission to copy user vault
notes.

## Recovery Details

If validation fails, keep the package diagnostic output with:

- Surface ID and target ecosystem.
- Repository-relative surface path.
- SHA-256 checksum when the surface was readable.
- Validation issue code and remediation.
- Command catalog status.
- Package path or candidate path that triggered the issue.

These details are enough to inspect, retry, or discard the package plan without
recording provider secrets, raw hidden provider state, private vault content,
authorization headers, or prompt bodies.

## Phase 04 Closeout

Phase 04 distribution integration validation checks agent surface packaging as
part of the full release path. The closeout covers AGENTS, CLAUDE, GEMINI, the
Voidbrain skill, human command docs, supported package output paths, command
status synchronization, fixture-safe examples, checksums, validation output,
and recovery records. See
[Phase 04 Distribution Integration Validation](phase04-distribution-integration-validation.md).
