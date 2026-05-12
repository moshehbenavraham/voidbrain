# GEMINI.md

Gemini CLI should treat Voidbrain as a local-first Obsidian plugin workspace.
The repository contains framework code and synthetic fixtures; real user vault
content is out of scope unless a later reviewed workflow supplies it.

## Safe Defaults

- Local-first behavior is the default for every command.
- Staged changes are required for AI-proposed note mutations.
- Provider secrets must never appear in markdown, fixtures, logs, screenshots,
  generated examples, or diagnostics.
- Synthetic fixtures live under `test/fixtures/vault/`; avoid private paths and
  real personal notes.
- Citations are required for retrieval-grounded answers.
- Dry-run previews are the only supported framework update behavior in this
  session.
- Recovery output should name the command ID, target path, staged-change ID, or
  validation issue without exposing secrets.

## Command Catalog

| Command ID | Status | Gemini CLI Guidance |
|------------|--------|---------------------|
| `voidbrain.ingest-source` | planned | Use fixture-safe input only; generated notes must remain staged changes. |
| `voidbrain.chat-with-vault` | planned | Cite retrieval paths and require explicit provider review before cloud use. |
| `voidbrain.health-check` | planned | Produce read-only status with clear failures and no vault mutation. |
| `voidbrain.stage-change` | planned | Record before/after context and staged-change IDs for review. |
| `voidbrain.recover-session` | planned | Read recovery state, redact provider secrets, and report retry or discard options. |
| `voidbrain.validate-agent-surfaces` | scaffolded | Check known surfaces for command drift, missing safety phrases, and unsafe examples. |
| `voidbrain.preview-framework-update` | scaffolded | Return a dry-run plan and exclude user vault content or generated knowledge notes. |

## Validation Commands

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
bun run validate
```

Failures in the agent validation commands are release blockers for command
documentation. Fix stale command IDs, missing local-first or staged changes
language, provider secrets examples, synthetic fixtures violations, missing
citations requirements, dry-run drift, and recovery gaps before continuing.
