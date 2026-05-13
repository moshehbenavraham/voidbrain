# Recover Session Command

`voidbrain.recover-session` is an implemented read-only local recovery workflow.
It reconstructs bounded command context from Voidbrain support records so a user
can inspect what happened after a failed, interrupted, or reloaded workflow.

## Scope

Recovery reads local support state only:

- `.voidbrain/cache/hot-cache.json` when available.
- Active staged-change recovery metadata.
- Latest health report runtime state.
- Staged-review operation log entries.
- Validation output and support-record read failures.

Recovery does not apply note changes, rewrite support records, replay provider
calls, or send vault content to cloud providers. Retry guidance points back to
the original command or to staged-change review; discard guidance means ignore
or remove malformed support records through a later explicit maintenance path.

## Evidence Model

The recovery summary includes bounded evidence items with:

- Command ID.
- Cache path.
- Target paths.
- Report IDs.
- Staged-change IDs.
- Backup path intent.
- Operation log IDs.
- Validation output.
- Retry, review, inspect, refresh, or discard actions.

The summary omits raw note bodies, raw staged-change before/after content,
provider attempts, authorization headers, hidden provider state, and unbounded
diagnostics. Secret-like support fields become redacted diagnostics instead of
being emitted.

## Runtime Behavior

Running the command starts a read-only support-record scan. Duplicate command
execution while a scan is in flight returns a warning and starts no duplicate
read. Missing, malformed, stale, unsupported, and adapter read-failed records
return diagnostics without throwing during plugin startup or command execution.

The first runtime pass reports a notice with summary status, item count,
diagnostic count, action count, and a no-write statement. The structured
summary remains available to tests and future UI surfaces through the recovery
service.

## Fixture-Safe Example

```json
{
  "command": "voidbrain.recover-session",
  "cachePath": ".voidbrain/cache/hot-cache.json",
  "targetPath": "summaries/demo-article-summary.md",
  "stagedChangeId": "stage-create-note-summaries-demo-summary-md-000000",
  "reportId": "health-demo-report",
  "writePolicy": "read-only",
  "actions": ["retry command", "review staged change", "inspect report", "discard record"]
}
```

All examples and tests use synthetic fixture paths under `test/fixtures/vault/`
or clearly fake support paths.

