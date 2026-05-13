---
name: voidbrain
description: >
  Local-first Voidbrain command surface for Obsidian-style vault workflows,
  agent documentation validation, fixture safety checks, and dry-run framework
  update previews.
---

# Voidbrain Skill

Use this skill only for repository-local Voidbrain workflows. The vault is
user-owned data. Commands must preserve local-first privacy, staged changes,
provider secrets boundaries, synthetic fixtures, citations, dry-run preview
behavior, and recovery context.

## Prerequisites

- Read `.spec_system/CONVENTIONS.md` before code changes.
- Use synthetic fixtures under `test/fixtures/vault/` for examples.
- Do not call live providers or include private vault content in fixtures.
- Do not write API keys, tokens, passwords, authorization headers, or provider
  secrets into tracked files.
- Keep any note mutation as a staged change until explicit review, confirmation,
  backup, audit, and recovery checks pass.

## Commands

| Command ID | Status | Use |
|------------|--------|-----|
| `voidbrain.ingest-source` | implemented | Preview approved fixture-safe sources and stage generated source, entity, concept, and summary notes with citations and recovery details. |
| `voidbrain.chat-with-vault` | implemented | Run cited vault chat with explicit provider review before cloud use. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted markdown reports, and stage only deterministic safe repairs as staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with diffs, backups, audit records, and recovery details. |
| `voidbrain.recover-session` | planned | Plan recovery from logs and staged files with redacted diagnostics. |
| `voidbrain.validate-agent-surfaces` | scaffolded | Run bounded command surface validation for stale IDs and safety phrases. |
| `voidbrain.preview-framework-update` | scaffolded | Run dry-run framework update previews while excluding user vault content. |

## Safe Examples

Fixture-safe staged review:

```json
{
  "command": "voidbrain.stage-change",
  "stagedChangeId": "stage-create-note-summaries-demo-summary-md-voidbrain-stage-change-000000",
  "writePolicy": "staged changes",
  "requiredEvidence": ["target path", "before/after diff", "backup path intent", "validation output"]
}
```

Framework update preview:

```json
{
  "command": "voidbrain.preview-framework-update",
  "candidatePaths": ["AGENTS.md", "docs/agent-surfaces-commands.md"],
  "mode": "dry-run"
}
```

Validation:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
```

Vault health report export:

```json
{
  "command": "voidbrain.health-check",
  "reportPath": ".voidbrain/reports/vault-health-demo.md",
  "writePolicy": "staged changes",
  "requiredEvidence": ["report ID", "affected paths", "validation output", "staged-change IDs"]
}
```

## Recovery

When a command fails, report the command ID, bounded path, validation issue, and
retry or discard option. Do not expose stack traces, provider secrets, private
vault text, or hidden provider diagnostics.
