# Provider Setup

Voidbrain provider setup is configured inside Obsidian at
`Settings -> Voidbrain -> Providers`. The repository `.env` can hold useful
local development defaults, but the plugin does not currently auto-import
provider profiles from `.env`; enter the values in the settings UI.

## Quick Start: Ollama

Use this path when Ollama is running on the same machine as Obsidian or is
reachable from the Obsidian runtime at `127.0.0.1:11434`.

Check the available models:

```bash
curl -fsS http://127.0.0.1:11434/api/tags
```

For the current development machine, these values are appropriate:

| Setting | Value |
|---------|-------|
| Profile kind | `Local` |
| Provider ID | `ollama` |
| Display name | `Ollama` |
| Endpoint URL | `http://127.0.0.1:11434/v1` |
| Chat model ID | `qwen2.5:7b` |
| Embedding model ID | `nomic-embed-text:latest` |
| Runtime credential | leave blank |

Use the exact model names reported by the Ollama API. Other installed chat
models such as `deepseek-r1:8b` can be used as the chat model. Embedding
models should be models intended for embeddings, such as
`nomic-embed-text:latest`.

After entering the profile:

1. Click `Save`.
2. In the saved provider row, click `Test`.
3. Select `Ollama` for the `chat` provider role.
4. Select the Ollama chat model for the `chat` model.
5. Select `Ollama` for the `embedding` provider role.
6. Select the Ollama embedding model for the `embedding` model.
7. Leave `utility` provider as `Not selected` unless you have a model with the
   `attachments` capability.

If the saved profile still reports a warning or error, open the provider
troubleshooting section in the same settings tab. The troubleshooting report
summarizes auth readiness, local runtime checks, role capability state, cloud
disclosure blockers, semantic fallback, and safe recovery fields.

## Indexing Setup

In `Settings -> Voidbrain -> Indexing`:

- Keep `Lexical index` enabled.
- Use `Semantic index` only after the embedding provider test passes.
- Click `Reindex` after adding or changing markdown notes.

If the status view says `0/0 indexed`, the active vault has no markdown notes
visible to Obsidian. Add at least one `.md` note, then reindex.

Phase 03 provider closeout validates semantic compatibility and lexical
fallback together. Semantic search is eligible only when the selected embedding
provider, model family, vector dimensions, indexed sources, and current vault
source fingerprints match. If semantic readiness is stale, missing,
incompatible, canceled, provider-blocked, or offline, Voidbrain should expose
reindex guidance and keep lexical retrieval available when the lexical index is
ready.

## Local vs OpenAI-Compatible

Use `Local` for local runtime endpoints such as:

- `http://127.0.0.1:11434/v1`
- `http://localhost:11434/v1`

Use `OpenAI-compatible` for remote or cloud-compatible endpoints that use an
OpenAI-style API and require an explicit credential, provider review, and cloud
trust settings. Do not use `OpenAI-compatible` for the local Ollama endpoint in
the current UI.

## Cloud And Remote Providers

For a remote OpenAI-compatible provider:

1. Set `Profile kind` to `OpenAI-compatible`.
2. Use a non-local endpoint URL.
3. Enter a runtime credential in the password field.
4. Save the provider profile.
5. Enable `Cloud provider workflows`.
6. Trust the provider under `Cloud trust`.
7. Click `Test`.
8. Select the provider and model for the desired roles.

Never put raw API keys, bearer tokens, passwords, or authorization headers into
tracked docs, fixtures, screenshots, or example files. Runtime credentials
should only be entered through the settings UI.

Cloud and custom remote provider use remains blocked until provider review,
trust, auth, capability, and disclosure settings all pass. Voidbrain does not
automatically switch from a local provider to a cloud provider when local
runtime readiness fails.

For closeout evidence, see
[Phase 03 Offline Provider Integration Validation](phase03-offline-provider-integration-validation.md).

## Troubleshooting

For the full recovery workflow, see
[Provider Troubleshooting and Recovery](provider-troubleshooting-recovery.md).

`Provider setup has auth or capability issues.`

- Confirm each selected role has a provider and model.
- Leave `utility` unselected unless the selected provider has an attachments
  capable model.
- For local providers, click `Test` after saving the profile.

`Selected local runtime readiness is not ready.`

- Confirm the local runtime is running.
- Confirm the endpoint is reachable from the same environment as Obsidian.
- Confirm the model IDs exactly match the runtime model list.

`Semantic indexing: blocked; Selected provider auth is not ready.`

- Test the embedding provider.
- Select an embedding model with the `embeddings` capability.
- Turn off `Semantic index` until embedding readiness is green.

`Provider troubleshooting found recoverable provider warnings.`

- Use `Retest` to rerun saved provider profile checks.
- Use `Reset` to clear stale auth and selected model state without deleting
  opaque secret references.
- Use `Refresh` after provider readiness changes so index compatibility is
  recomputed.

`Cloud provider workflows are disabled until explicit disclosure review is complete.`

- Review the provider endpoint, trust level, credential boundary, and content
  sensitivity before enabling cloud workflows.
- Voidbrain does not silently fall back from local providers to cloud
  providers.

`Provider chat invocation is not configured.`

- Provider setup and readiness passed, but the current build still lacks a live
  chat transport adapter for that provider path. The readiness setup is still
  useful for validating roles, privacy gates, and model selection.

## Environment Variables

The deploy script reads `VOIDBRAIN_DEV_VAULT` from `.env`:

```bash
bun run deploy:obsidian
```

Optional provider variables in `.env` are documentation and local-development
defaults. They are not imported automatically by the plugin settings UI.
