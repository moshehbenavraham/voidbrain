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
| `voidbrain.ingest-source` | Convert a synthetic source record into vault-ready artifacts. | planned | local-first | staged changes | source path, generated note paths |
| `voidbrain.chat-with-vault` | Answer from indexed vault evidence with citations. | planned | explicit provider review | no direct writes | cited retrieval paths and headings |
| `voidbrain.health-check` | Report plugin, provider, index, and fixture safety state. | planned | local-first | read-only | status summary and failing checks |
| `voidbrain.stage-change` | Create an inspectable proposed note mutation. | planned | local-first | staged changes | before/after diff and target path |
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
| `voidbrain.ingest-source` | `sourcePath` under a synthetic fixture or validated vault path | staged artifact paths and source links |
| `voidbrain.chat-with-vault` | user question and fresh retrieval evidence | cited answer with retrieval paths, headings, and source records |
| `voidbrain.health-check` | optional bounded scope | pass/fail status with failing checks |
| `voidbrain.stage-change` | `targetPath` and proposed markdown content | staged-change ID and before/after diff context |
| `voidbrain.recover-session` | recoverable session or staged-change ID | recovery summary with retry or discard options |
| `voidbrain.validate-agent-surfaces` | known surface paths from the repository root | deterministic validation issues or pass status |
| `voidbrain.preview-framework-update` | optional repository-relative framework paths | dry-run action list and excluded user-content paths |

## Staged Change And Health Primitives

`voidbrain.stage-change` now has pure service primitives for proposed note
creates, updates, deletes, moves, and frontmatter edits. The primitives produce
reviewable staged-change records with before/after diff context, conflict
metadata, destructive-review flags, and recovery metadata. They do not apply
changes to user vault files.

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

These surfaces do not implement live ingestion, autonomous chat, destructive
framework updates, provider calls, or direct writes to user notes. Those
workflows remain planned until later sessions add review primitives, provider
preflight enforcement, and staged-write application paths.
