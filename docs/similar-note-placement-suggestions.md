# Similar Note and Placement Suggestions

Similar-note suggestions are local maintenance records. They inspect parsed notes,
retrieval result metadata, wikilinks, tags, headings, aliases, folders, source
paths, and active staged changes to explain why two notes may belong together.

The planner is provider-free and read-only. It does not send vault content to a
cloud provider, does not copy note bodies into durable records, and does not
mutate vault files. Accepted edits are routed through `voidbrain.stage-change`
so the user can review before and after diffs before apply.

## Evidence

Each suggestion records bounded evidence:

- Source note path and related note path.
- Heading text when retrieval supplied a heading.
- Signal kind such as lexical, semantic, wikilink, tag, heading, alias, folder,
  source-path, or frontmatter.
- Retrieval result ID, method, and score when retrieval evidence is available.
- Rank reasons, confidence, stageability, and recovery details.

Retrieval snippets and raw note bodies are intentionally excluded from
suggestion records and runtime status summaries.

## Suggestion Kinds

- `wikilink` stages an `update-note` that appends a reviewable wikilink.
- `tag` stages an `update-frontmatter` patch for a missing tag.
- `alias` stages an `update-frontmatter` patch for a missing alias.
- `related-note` stages an `update-frontmatter` patch for `related-notes`.
- `frontmatter-placement` stages an `update-frontmatter` patch for missing
  local source-path placement evidence.
- `folder-placement` stages a `move-note` only when the destination path is
  valid and no active staged change or existing note blocks it.

Low-confidence suggestions remain visible as report-only records. They are not
stageable until stronger local evidence exists.

## Duplicate Prevention

The planner and staging service check for existing relationships before
creating staged changes:

- Existing wikilinks, including extensionless and alias-style targets.
- Existing tags, aliases, related-notes, and source-path values.
- Existing destination paths for folder placement.
- Active staged changes that target the same source or destination path.
- In-flight staging attempts for the same suggestion ID.

## Recovery

Recovery details include the command ID, suggestion ID, source path, related
path, target path, destination path when present, staged-change ID when present,
and validation output. These fields are enough to retry, discard, or inspect a
failed staging attempt without reading raw note bodies from logs.
