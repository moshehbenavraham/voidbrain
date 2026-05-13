# CLAUDE.md

Use this repository as a local-first Voidbrain development workspace. The vault
is user-owned data, and command behavior must be inspectable before it can
mutate notes.

## Claude Code Operating Rules

- Read `.spec_system/CONVENTIONS.md`, the current session spec, and nearby code
  before editing.
- Keep Obsidian runtime wiring separate from testable domain logic.
- Do not make provider calls from examples or tests.
- Do not write provider secrets, private vault text, credentials, tokens,
  passwords, authorization headers, or private local paths into tracked files.
- Use synthetic fixtures under `test/fixtures/vault/` for examples and tests.
- Preserve citations when retrieval evidence is used in user-facing synthesis.
- Keep generated note writes as staged changes with reviewable before/after
  context.
- Keep framework update work as dry-run preview behavior unless a later session
  implements explicit apply controls.
- Include recovery details in failures: command ID, path, staged-change ID,
  validation issue, or retry context.

## Command Catalog

| Command ID | Status | Claude Code Guidance |
|------------|--------|----------------------|
| `voidbrain.ingest-source` | implemented | Use approved markdown, text, pasted content, or URL source records; keep generated outputs as staged changes with citations and recovery details. |
| `voidbrain.chat-with-vault` | implemented | Require citations and explicit provider review before any cloud provider handling of vault content. |
| `voidbrain.health-check` | planned | Read local status only and report actionable failures without changing vault files. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with diffs, backups, audit records, and recovery details. |
| `voidbrain.recover-session` | planned | Recover from logs and staged files, redacting provider secrets and private diagnostics. |
| `voidbrain.validate-agent-surfaces` | scaffolded | Validate command IDs, stale references, safety phrases, and unsafe examples from bounded paths. |
| `voidbrain.preview-framework-update` | scaffolded | Produce dry-run framework update plans and exclude user vault content. |

## Local Validation

Run these checks after editing agent surfaces or command-domain code:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
```

Use `bun run validate` for the full local gate. Any missing local-first,
staged changes, provider secrets, synthetic fixtures, citations, dry-run, or
recovery language should be treated as documentation drift.
