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
- Treat `.voidbrain/cache/hot-cache.json` as a readable local support record
  for recent context recovery, not as durable user-authored knowledge.
- Keep Phase 03 provider closeout behavior explicit: local runtime paths stay
  local, cloud provider workflows require provider review, trust, auth,
  capability, and disclosure gates, and offline semantic failures should expose
  lexical fallback when available.

## Commands

| Command ID | Status | Use |
|------------|--------|-----|
| `voidbrain.ingest-source` | implemented | Preview approved fixture-safe single or batch sources and stage generated source, entity, concept, and summary notes with citations, provider review, cancellation, retry, and recovery details. |
| `voidbrain.chat-with-vault` | implemented | Run cited vault chat with explicit provider review before cloud use. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted markdown reports, and stage only deterministic safe repairs as staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with diffs, backups, audit records, and recovery details. |
| `voidbrain.recover-session` | implemented | Read hot cache support records, staged recovery state, health reports, operation logs, and validation output with redacted retry or discard diagnostics. |
| `voidbrain.validate-agent-surfaces` | implemented | Run bounded fail-closed validation for stale IDs, status drift, safety phrases, unsafe examples, and unsupported paths. |
| `voidbrain.preview-framework-update` | implemented | Run deterministic dry-run framework update previews with actions, exclusions, conflicts, hashes, and recovery details while excluding user vault content; apply behavior remains deferred. |

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
bun run validate:agent-surface-package
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

Hot cache recovery support:

```json
{
  "command": "voidbrain.recover-session",
  "cachePath": ".voidbrain/cache/hot-cache.json",
  "writePolicy": "read-only",
  "requiredEvidence": ["cache path", "target paths", "report IDs", "validation output", "staged-change IDs"],
  "actions": ["retry command", "review staged change", "inspect report", "discard record"]
}
```

Phase 03 provider closeout:

```json
{
  "evidence": "docs/phase03-offline-provider-integration-validation.md",
  "providerPolicy": "explicit provider review before cloud disclosure",
  "fallback": "lexical retrieval when semantic readiness is blocked and lexical index is ready",
  "recoveryFields": ["command ID", "provider ID", "model ID", "cache path", "report ID", "validation output"]
}
```

Phase 04 distribution closeout:

```json
{
  "evidence": "docs/phase04-distribution-integration-validation.md",
  "distributionPolicy": "local release, dry-run install, fixture-safe package reuse, and selected-output handoff",
  "providerPolicy": "provider review, trust, auth, capability, and disclosure before cloud or custom remote private-vault handling",
  "recoveryFields": ["command ID", "target path", "artifact path", "cache path", "report ID", "staged-change ID", "validation output"]
}
```

Agent surface package reuse:

```json
{
  "script": "validate-agent-surface-package",
  "surfaces": ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "skills/voidbrain/SKILL.md"],
  "exampleTarget": "fixtures/demo-repo/",
  "recoveryFields": ["surface ID", "target ecosystem", "path", "checksum", "issue code"]
}
```

Package reuse is local framework validation only. Do not publish to hosted
marketplaces from this skill, and do not package user vault notes, `.voidbrain`
support records, provider secrets, authorization headers, prompt bodies, raw
hidden provider state, private paths, or `EXAMPLES` research input.

## Recovery

When a command fails, report the command ID, bounded path, cache path,
validation issue, and retry or discard option. Do not expose stack traces,
provider secrets, private vault text, or hidden provider diagnostics.
