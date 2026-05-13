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
- Include recovery details in failures: command ID, path, cache path,
  staged-change ID, report ID, validation issue, or retry context.

## Command Catalog

| Command ID | Status | Claude Code Guidance |
|------------|--------|----------------------|
| `voidbrain.ingest-source` | implemented | Use approved markdown, text, pasted content, or URL source records; keep generated outputs as staged changes with citations and recovery details. |
| `voidbrain.chat-with-vault` | implemented | Require citations and explicit provider review before any cloud provider handling of vault content. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted reports, and stage only deterministic safe repairs as staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with diffs, backups, audit records, and recovery details. |
| `voidbrain.recover-session` | implemented | Recover from hot cache support records, staged recovery state, health reports, operation logs, and validation output, redacting provider secrets and private diagnostics without applying note edits. |
| `voidbrain.validate-agent-surfaces` | implemented | Fail closed on command IDs, stale status labels, safety phrases, unsafe examples, and unsupported bounded paths. |
| `voidbrain.preview-framework-update` | implemented | Produce deterministic dry-run framework update plans with actions, excluded paths, conflicts, hashes, and recovery details while excluding user vault content; apply behavior remains deferred. |

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
