# Agent Surfaces and Commands

Voidbrain agent surfaces are repository-local instructions for AI coding tools.
They describe safe MVP workflows without granting permission to mutate user
vault content directly. The command catalog in `src/agent/command-catalog.ts`
is the source of truth; this document is the human-readable companion.

## Safety Policy

- Local-first: treat the user's vault as the durable source of truth.
- Staged changes: proposed note edits must be reviewable before apply.
- Provider secrets: never place API keys, tokens, passwords, or authorization
  headers in docs, fixtures, logs, screenshots, or examples.
- Synthetic fixtures: examples must use `test/fixtures/vault/` or clearly fake
  paths such as `fixtures/demo-vault/`.
- Citations: user-facing synthesis that uses retrieval output must cite vault
  paths, headings, and source records.
- Dry-run: framework update workflows preview planned changes before any later
  apply behavior exists.
- Recovery: command failures must leave enough path, command, and staged-change
  context for the user to inspect or retry.

## Command Table

| Command ID | Intent | Status | Privacy | Write Policy | Required Evidence |
|------------|--------|--------|---------|--------------|-------------------|
| `voidbrain.ingest-source` | Preview and stage approved source content as vault-ready artifacts. | implemented | local-first | staged changes | source path, source record, citation IDs, generated note paths, staged-change IDs |
| `voidbrain.chat-with-vault` | Answer from indexed vault evidence with citations. | implemented | explicit provider review | no direct writes | cited retrieval paths and headings |
| `voidbrain.health-check` | Report plugin, provider, index, and fixture safety state. | planned | local-first | read-only | status summary and failing checks |
| `voidbrain.stage-change` | Review and confirmed apply workflow for staged note mutations. | implemented | local-first | staged changes | staged-change ID, before/after diff, target path, backup path intent, validation output |
| `voidbrain.recover-session` | Reconstruct recoverable command context from logs and staged files. | planned | local-first | read-only by default | recovery log path and staged-change IDs |
| `voidbrain.validate-agent-surfaces` | Validate command IDs, safety phrases, and fixture-safe examples. | scaffolded | local-first | read-only | validation result list |
| `voidbrain.preview-framework-update` | Preview framework file changes while excluding user vault content. | scaffolded | local-first | dry-run | planned framework file actions |

Status labels are intentionally conservative:

- `implemented` means runtime behavior exists and is covered by local tests.
- `scaffolded` means this session provides local validation or preview helpers,
  but no destructive or autonomous behavior.
- `planned` means the surface documents the contract for later sessions and
  must not be presented as working execution.

## Inputs and Outputs

| Command ID | Required Inputs | Outputs |
|------------|-----------------|---------|
| `voidbrain.ingest-source` | approved markdown path, text path, pasted content, or approved URL source record | staged-change IDs, generated target paths, source links, citation IDs, and recovery details |
| `voidbrain.chat-with-vault` | user question and fresh retrieval evidence | cited answer with retrieval paths, headings, and source records |
| `voidbrain.health-check` | optional bounded scope | pass/fail status with failing checks |
| `voidbrain.stage-change` | staged-change ID and confirmation text when required | per-record apply, reject, retry, dismiss, conflict, or failed outcome with audit and recovery details |
| `voidbrain.recover-session` | recoverable session or staged-change ID | recovery summary with retry or discard options |
| `voidbrain.validate-agent-surfaces` | known surface paths from the repository root | deterministic validation issues or pass status |
| `voidbrain.preview-framework-update` | optional repository-relative framework paths | dry-run action list and excluded user-content paths |

## Source Ingestion Staging

`voidbrain.ingest-source` now opens a local-first staging workflow for approved
markdown files, text files, pasted content, and user-approved URL source
records. The workflow previews source metadata, privacy boundary, duplicate
status, provider requirement, target paths, and citation expectations before
staging any generated artifacts.

Generated source, entity, concept, and summary notes are created only as staged
changes. They include source paths, citation IDs, wikilinks, stable
frontmatter, and recovery metadata. Provider-assisted summaries are optional
and must pass explicit provider review and preflight first; denied or
unavailable providers fall back to deterministic local extraction.

Apply behavior is not part of ingestion staging. Review and apply controls stay
in the staged-change workflow and require explicit confirmation before vault
mutation.

## Staged Change And Health Primitives

`voidbrain.stage-change` now opens a staged-change review workflow for proposed
note creates, updates, deletes, moves, and frontmatter edits. The workflow
groups records by command, operation, status, destructive flag, and target
path; shows bounded before/after previews, conflicts, validation output, backup
intent, and recovery details; and allows approve, reject, retry, dismiss, or
confirmed apply.

Apply behavior uses Obsidian vault APIs only after preflight revalidation.
Create, update, and frontmatter edits require explicit review. Delete, move,
overwrite, and batch apply require stronger typed confirmation. Destructive
apply writes a `.voidbrain/staged-changes/` backup support record before
mutation. Per-record audit and recovery output preserves command ID, target
path, staged-change ID, backup path intent, validation output, and failed apply
messages. Index refresh is triggered after successful apply; refresh failures
are visible and retryable without hiding completed vault mutations.

`voidbrain.health-check` now has fixture-safe report primitives for parsed
notes and index freshness snapshots. Reports can identify orphan notes, broken
wikilinks, stale indexes, and missing citations with deterministic evidence.
The command runtime remains planned, and health findings are report-only unless
a later workflow stages a repair for review.

## Validation Workflow

Run the local checks from the repository root:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
```

The checks are bounded to repository files, markdown surfaces, scripts, source
contracts, and synthetic fixtures. They must fail closed when a surface omits a
known command ID, adds an unknown command ID, drops required safety language, or
contains secret-like example content.

## Framework Update Preview

`voidbrain.preview-framework-update` is a read-only planning surface. It accepts
repository-relative framework paths, normalizes them, rejects absolute paths or
parent traversal, and excludes user vault content such as generated knowledge
notes, staged files, fixture vault notes, and local research inputs.

The preview returns only planned framework file actions plus excluded paths. It
does not apply changes, rewrite notes, update fixture vault content, or create a
future apply plan automatically.

## Deferred Behavior

These surfaces do not implement autonomous web research, destructive framework
updates, auto-apply of AI-proposed note edits, or remote sync conflict
resolution. Note mutation remains bounded to the explicit staged-change
review/apply workflow.
