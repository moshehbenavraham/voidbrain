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
- Recovery output should name the command ID, target path, cache path,
  staged-change ID, report ID, or validation issue without exposing secrets.
- Provider closeout keeps local runtime paths local; cloud provider workflows
  require provider review, trust, auth, capability, and disclosure gates before
  private vault content can leave the machine. Offline semantic failures should
  expose lexical fallback when available.

## Command Catalog

| Command ID | Status | Gemini CLI Guidance |
|------------|--------|---------------------|
| `voidbrain.ingest-source` | implemented | Use approved fixture-safe single or batch source input; generated notes remain staged changes with citations, provider review, target paths, cancellation, retry, and recovery details. |
| `voidbrain.chat-with-vault` | implemented | Cite retrieval paths and require explicit provider review before cloud use. |
| `voidbrain.health-check` | implemented | Scan local vault notes and index freshness, export redacted reports, and stage only deterministic safe repairs as staged changes with recovery details. |
| `voidbrain.stage-change` | implemented | Review, confirm, apply, reject, retry, or dismiss staged changes with diffs, backups, audit records, and recovery details. |
| `voidbrain.recover-session` | implemented | Read hot cache support records, staged recovery state, health reports, operation logs, and validation output; redact provider secrets and report retry or discard options without applying note edits. |
| `voidbrain.validate-agent-surfaces` | implemented | Check known surfaces for command drift, status drift, missing safety phrases, unsafe examples, and unsupported paths. |
| `voidbrain.preview-framework-update` | implemented | Return deterministic dry-run framework update actions, excluded paths, conflicts, hashes, and recovery details while excluding user vault content or generated knowledge notes; apply behavior remains deferred. |

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

Phase 03 provider integration evidence lives in
`docs/phase03-offline-provider-integration-validation.md` and should stay in
sync with provider setup, invocation boundaries, semantic fallback,
troubleshooting, staged changes, dry-run language, citations, synthetic
fixtures, provider secrets redaction, and recovery records.
