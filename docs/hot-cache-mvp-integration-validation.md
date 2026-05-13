# Hot Cache MVP Integration Validation

Session 08 adds local hot cache support records for recent runtime recovery and
validates the Phase 01 MVP workflow against synthetic fixtures.

## Runtime Behavior

Voidbrain writes `.voidbrain/cache/hot-cache.json` as a readable support record.
The cache is derived from current runtime state and can be rebuilt from local
plugin state, staged changes, health reports, and indexes. It is not a user note
and is not the durable source of truth for knowledge.

Hot cache entries are bounded records for:

- Chat thread draft metadata and selected context chips.
- Index readiness summaries and failed path counts.
- Active staged-change summaries with target paths and recovery metadata.
- Latest vault health report summary and affected paths.

Entries keep command context, target paths, staged-change IDs, report IDs,
cache path, and validation output where applicable. They omit raw private note
bodies, provider secrets, authorization headers, hidden provider state, and raw
private diagnostics.

## Reload Recovery

On plugin load, Voidbrain tries to read `.voidbrain/cache/hot-cache.json`
through the Obsidian adapter. A valid record restores recent chat draft and
context chip metadata into the chat store. A malformed or missing record fails
closed: the plugin continues with safe defaults, status shows the cache issue,
and no vault notes are changed.

Runtime status now includes a Hot cache item. It reports ready, missing, stale,
updating, or failed states with bounded entry counts and recovery paths.

## Session Summaries

The chat view can stage a readable session summary. Summary markdown includes
source paths, cited turns, target path, thread ID, and recovery details. The
summary is staged as a conversation note proposal and must be reviewed through
the staged-change workflow before it can touch a user-visible markdown note.

## Synthetic Validation Path

The integration test covers a fixture-only Phase 01 path:

- Provider readiness with a local fixture provider selection.
- Lexical index startup and readiness.
- Retrieval-backed chat failure without a live provider transport.
- Source ingestion preview and staged generated notes.
- Vault health reporting from synthetic health notes.
- Staged review apply through Obsidian vault APIs.
- Hot cache persistence to `.voidbrain/cache/hot-cache.json`.
- Plugin reload recovery of recent chat draft context.

## Recovery Handoff

`voidbrain.recover-session` now reads hot cache support records as one recovery
source alongside staged-change metadata, health reports, operation logs, and
validation output. Hot cache entries provide cache path, command ID, target
paths, report IDs, staged-change IDs, and validation details for retry or
discard guidance without applying note edits.

## Residual Risks

- Restored chat turns are intentionally bounded. Raw provider attempts and raw
  retrieval snippets are not restored from cache.
- Cache writes are best-effort support writes. User notes remain safe if cache
  persistence fails, and the failure is surfaced in runtime status.
