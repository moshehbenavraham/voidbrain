# Vault Health Repair Staging

`voidbrain.health-check` is a local-first Obsidian runtime workflow for
inspecting vault health without sending vault content to providers. It scans
markdown notes through Obsidian APIs, combines those notes with current index
freshness, and presents grouped findings for review.

## Findings

Health reports include:

- Severity, kind, affected paths, report ID, generated time, and scanned path
  count.
- Bounded evidence for orphan notes, broken wikilinks, stale indexes, missing
  citations, and content gaps.
- Remediation text that explains whether the finding is report-only, requires
  index rebuild, or can stage a safe repair.

## Markdown Export

Report export writes a support record under `.voidbrain/reports/`. The export
is deterministic and redacted. It includes paths, finding evidence summaries,
remediation, command IDs, and recovery details, but excludes raw note bodies,
provider secrets, authorization headers, raw hidden provider state, and private
diagnostics.

## Repair Staging

Safe repairs are staged changes, never direct writes. The current safe repair
is a deterministic missing-citation frontmatter update derived from existing
source-path evidence. Staged records preserve the target path, before/after
diff, staged-change ID, validation output, and command ID for recovery.

Broken wikilinks, broad orphans, stale indexes, and content gaps remain
report-only. Those findings need user review because the correct target,
relationship, rebuild decision, or missing content cannot be inferred safely.

## Maintenance Recommendations

The maintenance recommendation planner converts health reports, index
freshness, retrieval evidence, and staged-change state into a ranked local
queue. Recommendation records include severity, confidence, affected paths,
bounded evidence, source records, stageability, and recovery fields. Retrieval
evidence keeps result IDs, headings, scores, and source paths, but does not
copy raw snippets or note bodies into durable recommendation output.

Missing-citation findings are the only current recommendation category that
can become a staged repair. The planner requires a target path, health finding
ID, source-path citation evidence, current note content, and no active staged
change for the same target before delegating to the health repair service.
Report-only, missing-evidence, unsupported-path, active-staged-change, and
in-flight duplicate requests fail closed with validation output.

Runtime status can include a maintenance summary when a recommendation plan is
supplied. The summary reports total, error, warning, info, stageable,
report-only, blocked, confidence counts, and sample affected paths without
exposing note bodies, provider secrets, hidden provider state, or private
diagnostics.

## Recovery

Failures preserve the command ID, report ID, export path, target path,
staged-change ID when available, and validation output. Users can retry the
health command, inspect exported reports, review recommendation records, or
open `voidbrain.stage-change` to review any staged repair before apply.

## Limitations

The workflow does not call providers, auto-apply repairs, infer missing links,
or rebuild indexes automatically. It reports stale indexes and leaves rebuild
actions to explicit user-controlled indexing flows.
