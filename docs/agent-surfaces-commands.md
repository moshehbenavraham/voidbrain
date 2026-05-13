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
- Recovery: command failures must leave enough path, command, cache,
  staged-change, report, and validation context for the user to inspect or
  retry.

## Command Table

| Command ID | Intent | Status | Privacy | Write Policy | Required Evidence |
|------------|--------|--------|---------|--------------|-------------------|
| `voidbrain.ingest-source` | Preview and stage approved single or batch source content as vault-ready artifacts. | implemented | local-first | staged changes | queue ID, item IDs, source path, source record, citation IDs, generated note paths, provider decision, validation output, staged-change IDs |
| `voidbrain.chat-with-vault` | Answer from indexed vault evidence with citations. | implemented | explicit provider review | no direct writes | cited retrieval paths and headings |
| `voidbrain.health-check` | Scan local vault notes and index freshness, export redacted reports, and stage safe repairs. | implemented | local-first | staged changes | report ID, affected paths, finding evidence, validation output, staged-change IDs |
| `voidbrain.stage-change` | Review and confirmed apply workflow for staged note mutations. | implemented | local-first | staged changes | staged-change ID, before/after diff, target path, backup path intent, validation output |
| `voidbrain.recover-session` | Reconstruct recoverable command context from hot cache, staged changes, health reports, operation logs, and validation output. | implemented | local-first | read-only | command ID, cache path, target paths, report IDs, staged-change IDs, backup path intent, validation output |
| `voidbrain.validate-agent-surfaces` | Fail closed on command IDs, status drift, safety phrases, unsafe examples, and unsupported scan paths. | implemented | local-first | read-only | validation result list |
| `voidbrain.preview-framework-update` | Preview framework file changes while excluding user vault content. | implemented | local-first | dry-run | command ID, target path, planned actions, excluded paths, conflict issue codes, content hashes, validation context |

Status labels are intentionally conservative:

- `implemented` means runtime behavior exists and is covered by local tests.
- `scaffolded` means a later session still needs to implement and test the
  documented behavior.
- `planned` means the surface documents the contract for later sessions and
  must not be presented as working execution.

## Inputs and Outputs

| Command ID | Required Inputs | Outputs |
|------------|-----------------|---------|
| `voidbrain.ingest-source` | approved markdown path, text path, pasted content, approved URL source record, or bounded batch queue | staged-change IDs, generated target paths, source links, citation IDs, per-item queue status, provider decisions, validation output, and recovery details |
| `voidbrain.chat-with-vault` | user question and fresh retrieval evidence | cited answer with retrieval paths, headings, and source records |
| `voidbrain.health-check` | local markdown notes and index freshness from the active Obsidian vault | grouped health report, redacted markdown export, report-only findings, optional staged repair IDs, and recovery details |
| `voidbrain.stage-change` | staged-change ID and confirmation text when required | per-record apply, reject, retry, dismiss, conflict, or failed outcome with audit and recovery details |
| `voidbrain.recover-session` | recoverable session, cache, report, or staged-change ID | recovery summary with retry or discard options |
| `voidbrain.validate-agent-surfaces` | known surface paths from the repository root | deterministic validation issues or pass status |
| `voidbrain.preview-framework-update` | optional repository-relative framework paths or candidate records with proposed content | deterministic dry-run create, update, skip, conflict, and excluded actions with hashes, issues, and recovery details |

## Source Ingestion Staging

`voidbrain.ingest-source` now opens a local-first staging workflow for approved
markdown files, text files, pasted content, and user-approved URL source
records. It can also process a bounded batch queue of those approved source
records. The workflow previews source metadata, privacy boundary, duplicate
status, provider requirement, target paths, and citation expectations before
staging any generated artifacts.

Generated source, entity, concept, and summary notes are created only as staged
changes. They include source paths, citation IDs, wikilinks, stable
frontmatter, and recovery metadata. Provider-assisted summaries are optional
and must pass explicit provider review and preflight first. Batch provider
denial fails closed for that item, remains retryable, and does not stage
generated notes until the provider boundary is reviewed.

Batch ingestion preserves deterministic item IDs, bounded concurrency,
cancellation, retry, and per-item queued, running, staged, failed, canceled,
skipped, provider-blocked, and citation-blocked states. Queue hot cache
summaries store queue IDs, item IDs, bounded paths, staged-change IDs, provider
decisions, validation output, and retry guidance, but not raw source bodies,
provider secrets, authorization headers, or hidden provider state.

Apply behavior is not part of ingestion staging. Review and apply controls stay
in the staged-change workflow and require explicit confirmation before vault
mutation.

## Vault Health Runtime

`voidbrain.health-check` opens an implemented local-first health workflow. It
reads markdown notes through Obsidian vault APIs, combines them with current
index freshness, and reports orphan notes, broken wikilinks, stale indexes,
missing citations, and content gaps. Findings are grouped by severity, kind,
and affected path with bounded evidence, remediation text, report ID, generated
time, and scanned path count.

Markdown export writes a redacted support report under `.voidbrain/reports/`.
The export includes paths, evidence summaries, remediation, command IDs, and
recovery details, but not raw note bodies, provider secrets, authorization
headers, raw hidden provider state, or private diagnostics.

Safe repair staging is intentionally narrow. Deterministic missing-citation
repairs can create staged changes with before/after diffs, target paths,
staged-change IDs, and validation output. Broken links, broad orphans, stale
indexes, and content gaps remain report-only because the correct repair can be
ambiguous. No health workflow applies note mutations directly; review and apply
remain under `voidbrain.stage-change`.

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

Vault health findings use the same staged-change safety boundary as source
ingestion. Report export is a support artifact, while note repairs are staged
for review and preserve recovery metadata before any user vault mutation.

## Hot Cache And Recent Context Recovery

Voidbrain persists recent context to `.voidbrain/cache/hot-cache.json` as a
local support record. The cache stores bounded summaries for chat draft/thread
metadata, selected context chips, index readiness, active staged changes, and
the latest health report. It preserves cache path, target paths, report IDs,
staged-change IDs, and validation output needed for inspection or retry.

Hot cache records must not contain raw private note bodies, provider secrets,
authorization headers, raw hidden provider state, raw provider diagnostics, or
unbounded retrieval payloads. Runtime status exposes cache readiness, stale and
failed states, entry counts, redaction status, and recovery paths.

Readable session summaries from chat are generated only as staged conversation
note proposals. They include source paths and cited turns, but they do not write
directly to user-visible markdown until the staged-change workflow confirms an
apply.

## Recover Session Runtime

`voidbrain.recover-session` runs an implemented read-only local support-record
scan. It summarizes hot cache records, active staged-change recovery metadata,
latest health report state, staged-review operation logs, validation output,
and adapter read failures. Duplicate command execution while recovery is in
flight returns a warning and starts no duplicate read.

Recovery summaries include command IDs, cache paths, target paths, report IDs,
staged-change IDs, backup path intent, validation output, and retry, review,
inspect, refresh, or discard actions. They omit raw note bodies, raw
before/after staged-change content, provider attempts, authorization headers,
hidden provider state, and unbounded private diagnostics. Missing, malformed,
stale, unsupported, and read-failed support records return diagnostics instead
of throwing.

## Validation Workflow

`voidbrain.validate-agent-surfaces` is an implemented read-only local
validation workflow. It uses the command catalog as the source of truth for
command IDs and statuses, then checks AGENTS, CLAUDE, GEMINI, the Voidbrain
skill, and human docs for missing IDs, unknown IDs, stale status labels, and
required safety language.

Run the local checks from the repository root:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-surface-package
bun run validate:agent-docs
```

The checks are bounded to repository files, markdown surfaces, scripts, source
contracts, and synthetic fixtures. They must fail closed when a surface omits a
known command ID, adds an unknown command ID, drops required safety language, or
contains secret-like example content.

Issue output is deterministic and includes the repository path, heading when
available, line when available, command ID when relevant, issue code, redacted
excerpt when useful, and remediation hint. Fixture safety checks also reject
private path hints, credential-like values, unsupported candidate paths, and
unreadable scan candidates.

## Agent Surface Packaging

Agent surface packaging validates reusable framework instructions for
Codex-style AGENTS files, Claude Code, Gemini CLI, the Voidbrain skill, and the
human command docs. It does not publish to hosted marketplaces, create runtime
agent commands, mutate user vault notes, or apply framework updates.

Run the local package readiness planner:

```bash
bun run validate:agent-surface-package
bun run validate:agent-surface-package -- --json
bun run validate:agent-surface-package -- --output build/agent-surfaces/manifest.json
```

The package manifest records surface ID, target ecosystem, repository-relative
path, SHA-256 checksum, command catalog status, command IDs found in the
surface, validation output, issue code, and recovery details. JSON diagnostics
are bounded to metadata and do not include raw surface bodies.

Package readiness fails closed when declared surfaces are missing, unreadable,
outside allowed framework paths, stale against the command catalog, missing
required safety language, or contain unsafe examples. It also rejects output
paths outside framework-owned build, dist, or docs roots.

Local reuse examples must stay synthetic:

```bash
mkdir -p fixtures/demo-repo/skills
cp AGENTS.md fixtures/demo-repo/AGENTS.md
cp CLAUDE.md fixtures/demo-repo/CLAUDE.md
cp GEMINI.md fixtures/demo-repo/GEMINI.md
cp -R skills/voidbrain fixtures/demo-repo/skills/voidbrain
```

Packageable surfaces must not include user vault content, `.voidbrain` support
records, `EXAMPLES` research input, provider secrets, authorization headers,
raw hidden provider state, prompt bodies, credential-like values, or private
path hints. See [Agent Surface Packaging](agent-surface-packaging.md) for the
local reuse guide.

## Framework Update Preview

`voidbrain.preview-framework-update` is an implemented read-only planning
surface. It accepts repository-relative framework paths or candidate records
with proposed content, normalizes them, rejects absolute paths or parent
traversal, and excludes user vault content such as generated knowledge notes,
`.voidbrain` support records, provider secret files, private diagnostics,
fixture vault notes, and local research inputs.

The preview returns deterministic create, update, skip, conflict, and excluded
actions. Create and update actions include proposed content hashes; update and
skip actions include current file hashes when a current file exists. Conflicts
cover unsupported file types, unsafe proposed content, duplicate candidates,
path collisions, unreadable current files, and missing comparison input. Each
action includes recovery details with command ID, target path, action, issue
code when applicable, and validation context.

Run the local dry-run planner from the repository root:

```bash
bun run preview:framework-update
bun run preview:framework-update AGENTS.md test/fixtures/vault/sources/demo-article.md ../outside.md
```

The CLI exits nonzero when typed issues or conflict actions require attention.
It does not apply changes, rewrite notes, update fixture vault content, stage
note mutations, call providers, or create a future apply plan automatically.

## Phase 02 Integration Closeout

Phase 02 closeout treats the implemented maintenance commands as one local
system. Synthetic integration coverage exercises recovery, agent surface
validation, dry-run framework previews, health-based recommendations,
similar-note suggestions, staged-change handoff, and batch source ingestion
without reading user vault content or calling providers.

The closeout evidence is recorded in
`docs/phase02-agentic-maintenance-integration-validation.md` and
`.spec_system/specs/phase02-session07-agentic-maintenance-integration-validation/`.
It verifies that implemented statuses in the command catalog match AGENTS,
CLAUDE, GEMINI, the Voidbrain skill, and this human command reference.

The shared policy remains unchanged: framework updates are dry-run previews,
AI-generated note mutations are staged changes, provider review is required
before any cloud disclosure, and recovery records preserve command IDs, target
paths, cache paths, staged-change IDs, report IDs, validation output, and retry
or discard guidance without exposing provider secrets or raw private note
bodies.

## Phase 03 Provider Closeout

Phase 03 closeout treats local runtime profiles, OpenAI-compatible profiles,
provider invocation boundaries, offline embedding compatibility, lexical
fallback, provider troubleshooting, agent surface validation, and fixture
safety as one integrated provider-hardening workflow. Synthetic coverage is
recorded in `docs/phase03-offline-provider-integration-validation.md` and
`.spec_system/specs/phase03-session06-offline-provider-integration-validation/`.

Provider disclosure remains explicit. Local runtime paths stay local, and
cloud or custom remote providers must pass provider review, trust, auth,
capability, and disclosure gates before private vault content can leave the
machine. Voidbrain does not silently fall back from local providers to cloud
providers when local readiness fails.

Provider recovery records are bounded to command ID, provider ID, model ID,
target path, cache path, staged-change ID, report ID, source counts, readiness
codes, fallback mode, and validation output. They must omit provider secrets,
authorization headers, prompt bodies, raw private note bodies, hidden provider
state, private path hints, and live provider payloads.

## Deferred Behavior

These surfaces do not implement autonomous web research, destructive framework
updates, auto-apply of AI-proposed note edits, or remote sync conflict
resolution. Note mutation remains bounded to the explicit staged-change
review/apply workflow.
