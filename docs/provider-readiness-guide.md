# Provider Readiness Guide

Voidbrain provider readiness starts with the local path and only moves to
remote or cloud paths after the user has reviewed the provider boundary. The
guidance below uses synthetic providers and fake vault paths only.

## Path Classes

| Path class | Locality | Before use |
|------------|----------|------------|
| Local runtime | Stays on this machine | Runtime reachable, model metadata valid, role capabilities ready |
| OpenAI-compatible local | Stays on this machine | Local endpoint classified, auth tested if needed, role capabilities ready |
| Custom remote | Leaves this machine | Provider review, trust, auth, capability, and disclosure gates pass |
| Trusted cloud | Leaves this machine | Cloud workflows enabled, provider trusted, auth and capability gates pass |
| Untrusted cloud | Blocked for private vault content | Choose a local path or explicitly review a trusted provider instead |

## First-Run Order

1. Keep `Cloud provider workflows` disabled.
2. Add a local runtime profile or an OpenAI-compatible local profile.
3. Test the profile from `Settings -> Voidbrain -> Providers`.
4. Select chat and embedding roles only after the profile is ready.
5. Keep lexical indexing enabled before turning on semantic indexing.
6. Use remote or cloud providers only after the disclosure gates pass.

## Gate Order

Every provider path is evaluated in deterministic gate order:

1. Provider review.
2. Locality.
3. Trust.
4. Auth.
5. Capability.
6. Disclosure.
7. Semantic fallback.

Local runtime and OpenAI-compatible local paths do not require cloud trust or
remote disclosure. Custom remote and trusted cloud paths require all remote
gates to pass before private vault content can leave the machine. Untrusted
cloud paths are blocked for private vault content even when auth succeeds.

## Path Details

### Local Runtime

Use a local runtime when Obsidian can reach the model service on the same
machine. Readiness checks should confirm runtime reachability, model metadata,
chat capability, embedding capability, selected role models, and lexical
fallback availability.

### OpenAI-Compatible Local

Use an OpenAI-compatible local profile when the endpoint uses an OpenAI-style
API shape but resolves locally. The API shape does not make it a cloud path.
Auth and capability readiness still need to pass, and semantic indexing should
stay disabled until the embedding provider is ready.

### Custom Remote

Use a custom remote profile only when the user intends to send content to a
non-local endpoint. Provider review, trust, auth, capability, and disclosure
must pass before any private vault content leaves the machine.

### Trusted Cloud

Use a trusted cloud profile only after explicit review. The user must enable
cloud provider workflows, trust the provider, test auth readiness, select a
compatible model, and understand the disclosure boundary.

### Untrusted Cloud

Untrusted cloud paths are blocked for private vault content. Choose a local
path or review a trusted provider instead.

## Troubleshooting Actions

- `Retest` reruns provider auth or local runtime readiness from current
  settings.
- `Retry setup` recomputes provider setup and role capability state.
- `Reset provider state` clears stale auth and selected model IDs while
  preserving opaque secret references.
- `Review disclosure` keeps cloud disclosure explicit and does not enable a
  cloud workflow by itself.
- `Refresh index` recomputes index readiness and semantic compatibility after
  provider changes.
- `Inspect recovery` shows bounded command, provider, model, cache, report,
  source count, fallback, and validation fields.

Duplicate provider setup or troubleshooting actions should be rejected while an
action is already in flight.

## Fallback Behavior

Lexical fallback is local retrieval fallback. It is not a provider switch and
does not send private vault content to a cloud provider. If semantic search is
blocked by auth, local outage, capability mismatch, family mismatch, stale
source fingerprints, or missing vectors, the UI should keep lexical fallback
visible when lexical indexing is ready.

## Synthetic Example

Use fake fixture paths in docs and tests:

```text
Provider ID: synthetic-local-provider
Endpoint URL: http://127.0.0.1:11434/v1
Vault path: fixtures/demo-vault/sources/source-note.md
Cache path: .voidbrain/cache/provider-readiness.json
```

For a remote example, use fake domains only:

```text
Provider ID: synthetic-remote-provider
Endpoint URL: https://provider.example.invalid/v1
Vault path: fixtures/demo-vault/sources/remote-source.md
Report ID: provider-readiness-fixture-report
```

Do not place API keys, bearer tokens, passwords, authorization headers, raw
prompt bodies, hidden provider state, private note content, or private absolute
paths in docs, fixtures, logs, screenshots, or examples.

## Recovery Fields

Provider readiness and troubleshooting records should stay bounded to command
ID, provider ID, model ID, readiness code, cache path, report ID, source path
count, fallback mode, and validation output. Lexical fallback remains visible
when semantic readiness is blocked and the lexical index is available.

Safe recovery records can include values like:

```json
{
	"commandId": "voidbrain.provider-readiness-guidance",
	"providerId": "synthetic-local-provider",
	"modelId": "synthetic-local-embedding",
	"readinessCode": "provider-offline",
	"cachePath": ".voidbrain/cache/provider-readiness.json",
	"reportId": "provider-readiness-fixture-report",
	"sourcePathCount": 3,
	"fallbackMode": "lexical",
	"validationOutput": ["provider-readiness:synthetic-fixture"]
}
```

Do not include raw diagnostics, provider responses, note bodies, prompt bodies,
hidden provider state, request headers, credentials, or private absolute paths
in recovery records.
