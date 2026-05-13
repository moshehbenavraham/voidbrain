# Provider Troubleshooting and Recovery

Voidbrain provider troubleshooting summarizes local runtime readiness,
OpenAI-compatible auth status, role capability selection, cloud disclosure
gates, and semantic index compatibility. The report is derived from existing
runtime state; it is not a second provider setup source of truth.

## What The Report Shows

The settings tab and status view can show:

- Provider setup severity.
- Auth readiness codes such as `missing-secret`, `auth-failed`, `auth-timeout`,
  `offline`, or `ready`.
- Role capability problems such as missing provider, stale model, or capability
  mismatch.
- Cloud disclosure blockers such as `cloud-disabled` or
  `provider-not-trusted`.
- Semantic compatibility fallback state, including lexical fallback when
  semantic search is blocked.
- Recovery fields with command ID, provider ID, model ID, readiness code,
  cache path, report ID, source path count, and validation output.

The report must not include raw provider diagnostics, raw note bodies, prompt
bodies, API keys, bearer tokens, authorization headers, private absolute paths,
or hidden provider state.

## Recovery Actions

Troubleshooting actions reuse existing setup and indexing paths:

- `Retest` runs provider setup tests for saved provider profiles and replaces
  stale auth readiness records.
- `Retry` recomputes provider setup, role capability, and runtime readiness
  state from current settings.
- `Reset` clears auth status records and selected model IDs while preserving
  provider profiles and opaque secret references.
- `Review` reminds the user that cloud workflows require explicit disclosure,
  trust, auth, and capability gates. It does not enable cloud workflows.
- `Refresh` refreshes runtime index readiness after provider compatibility
  changes.

Only one provider troubleshooting action can run at a time. Duplicate triggers
are rejected with a visible notice and no vault mutation.

Phase 03 closeout validates retry, reset, disclosure review, semantic fallback,
timeout, cancellation, and redacted recovery behavior with synthetic fixtures.
The recovery record remains bounded to command ID, provider ID, model ID,
readiness code, cache path, report ID, source path count, fallback mode when
applicable, and validation output.

## Local Runtime Recovery

For local runtimes such as `http://127.0.0.1:11434/v1`:

1. Confirm the runtime is running.
2. Confirm Obsidian can reach the endpoint from the same machine.
3. Confirm the selected model IDs exactly match the runtime model list.
4. Click `Retest` in the provider troubleshooting section.
5. Click `Refresh` if semantic index readiness was blocked by provider state.

When a local runtime is offline, Voidbrain can continue using lexical retrieval
if the lexical index is ready. It does not silently fall back to a cloud
provider.

## OpenAI-Compatible Recovery

For remote or cloud OpenAI-compatible endpoints:

1. Confirm the profile uses a non-local endpoint such as
   `https://provider.example.invalid/v1`.
2. Store the runtime credential through the settings password field.
3. Enable `Cloud provider workflows` only after reviewing the disclosure.
4. Trust only providers that are intended for private vault workflows.
5. Click `Retest`.

If auth fails or times out, troubleshooting reports only the provider ID,
readiness code, status code when available, and bounded recovery fields. It
does not store or render request headers, credentials, prompt text, or provider
response bodies.

## Semantic Fallback

Semantic search can be blocked by provider auth, local outage, model capability,
embedding family mismatch, stale source fingerprints, or missing vectors.
Troubleshooting reports the compatibility code and whether lexical fallback is
available.

Use `Refresh` after retesting a provider. Rebuild semantic indexes only after
the embedding provider and model are ready.

If semantic search is blocked but lexical readiness is available, the user
should see lexical fallback instead of a blank retrieval path. If both semantic
and lexical retrieval are unavailable, the report should provide retry or
reindex guidance with recovery fields.

## Secret Boundaries

Never place these values in docs, fixtures, screenshots, support records, or
examples:

- API keys, bearer tokens, passwords, or authorization headers.
- Raw prompt bodies or model responses.
- Raw private note bodies.
- Private absolute filesystem paths.
- Hidden provider or SDK state.

Use synthetic IDs such as `synthetic-provider` and fake paths such as
`fixtures/demo-vault/source.md` in tests and examples.
