# Source Ingestion Staging

`voidbrain.ingest-source` is a local-first staging workflow for approved
markdown files, text files, pasted content, and explicitly approved URL source
records. It previews the privacy boundary and generated targets before any
provider-assisted path can run.

## Supported Inputs

- Markdown and text files are read through the Obsidian vault API from
  vault-relative paths.
- Pasted content must include a user-supplied title.
- URL records must include a title, content supplied by the user, and explicit
  approval. The workflow does not fetch live URLs.

## Preview

Preview reports the source title, source path, source type, duplicate status,
provider requirement, citation expectations, and target paths for generated
source, entity, concept, and summary notes. Duplicate content hashes, source
manifest matches, existing target notes, and active staged changes are blocking
conditions.

## Provider Boundary

Provider-assisted summaries are optional. They must pass provider setup,
trust, auth readiness, content sensitivity, and provider review preflight before
use. If the provider is denied, unavailable, or times out, ingestion falls back
to deterministic local extraction.

## Staged Outputs

Generated notes are staged through `StagedChangeService` and are never applied
directly to vault files. Each staged record keeps target path, source paths,
citation IDs, diff context, validation output, and recovery metadata. Apply and
review controls belong to the staged-change workflow.

## Ecosystem Handoff

Source records and source-derived summaries can be handed off only when the
user explicitly selects them. Follow
[Ecosystem Export And Handoff Boundaries](ecosystem-export-handoff-boundaries.md)
and preserve source paths, target paths, citation IDs, source record IDs,
provider decisions, staged-change IDs when available, validation output, and
retry guidance. Handoff summaries must not include raw source bodies, prompt
bodies, hidden provider state, authorization headers, provider secrets, or
private absolute paths.

## Recovery

Failures preserve command ID, source path, generated target paths,
staged-change IDs when available, provider decision, validation output, and
retry guidance. Recovery output does not include provider secrets, hidden
provider state, authorization headers, raw private source bodies, or private
local paths.
