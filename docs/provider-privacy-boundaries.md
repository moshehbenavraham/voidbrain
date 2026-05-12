# Provider Privacy Boundaries

Voidbrain treats provider access as a trust boundary. Provider metadata,
capability checks, disclosure policy, secret references, and diagnostic
redaction must be validated before any workflow can send vault content to a
local or cloud model.

## Trust Model

Provider trust is explicit and fail-closed.

Provider kind:

- `local`: runs on the user's machine or local network boundary selected by the
  user. Local providers do not require cloud workflow enablement.
- `cloud`: sends request data outside the local vault boundary. Cloud providers
  require global cloud enablement and a trusted provider ID in settings.

Provider trust level:

- `local-runtime`: local runtime metadata. This is valid only for local
  providers.
- `trusted-cloud`: cloud provider metadata that may be used when settings also
  trust the provider.
- `untrusted-cloud`: cloud provider metadata that must deny disclosure even if
  a malformed or stale setting references the provider ID.

Settings contain two separate policy fields:

- `areCloudProvidersEnabled`: the global opt-in for cloud workflows. The default
  is `false`.
- `trustedProviderIds`: the explicit list of cloud provider IDs trusted by the
  user. The default is an empty list.

A cloud disclosure is allowed only when all of these are true:

1. The provider exists in the registry.
2. `areCloudProvidersEnabled` is `true`.
3. The provider ID appears in `trustedProviderIds`.
4. The provider metadata trust level is `trusted-cloud`.

Unknown providers, disabled cloud workflows, missing trusted provider IDs, and
untrusted cloud metadata all deny before invocation.

## Capability Checks

Workflows must request a concrete model capability before invocation. The
provider boundary supports chat, embeddings, streaming, tool calls, and
attachment handling as separate capabilities. Unsupported capabilities fail
before a provider adapter can run.

Supported capability values:

- `chat`
- `embeddings`
- `streaming`
- `tools`
- `attachments`

The capability selector validates requests from `unknown` input. It checks that
the provider exists, that any preferred model exists for that provider, and that
the selected model supports the requested capability and optional role. It
returns explicit denial codes instead of throwing for expected policy failures:

- `invalid-request`
- `provider-not-found`
- `model-not-found`
- `capability-unsupported`

Invocation preflight composes disclosure policy and capability selection. A
future provider adapter should receive a selected provider and model only after
preflight returns `allowed: true`.

## Disclosure Requests

Disclosure requests describe the minimum metadata needed to make a privacy
decision:

- provider ID
- required capability
- content sensitivity
- optional preferred model ID
- optional required role
- optional source path list
- optional workflow ID and user-facing purpose

Content sensitivity is explicit:

- `public`: content already safe for public disclosure.
- `vault-metadata`: vault paths, headings, tags, or other metadata.
- `private-vault`: user-authored note content or generated factual notes tied to
  the vault.

Diagnostics record provider IDs, provider kind, trust level, requested
capability, content sensitivity, workflow ID, and source path count. They do not
record raw note bodies, prompt payloads, provider credentials, authorization
headers, or transport state.

## Secret References

Provider credentials are represented by opaque secret references. Durable
markdown, logs, fixtures, staged changes, and exported artifacts must never
contain raw API keys, authorization headers, passwords, tokens, or provider
transport state.

Secret references include:

- `kind`
- opaque `id`
- provider ID
- human-readable label
- creation and update timestamps

They do not include the raw runtime credential. The in-memory test store accepts
runtime credential values only at the storage boundary and returns an opaque
reference. Reads return the runtime value only to the caller that already holds
the reference. Concurrent writes for the same provider and label are rejected
with `write-in-flight` so duplicate triggers do not create ambiguous credential
state.

The MVP does not implement operating system keychain storage or provider auth
flows. Later adapters should implement the same `ProviderSecretStore` interface
without changing durable markdown or fixture contracts.

## Redaction

Diagnostics are redacted recursively before they are logged, surfaced in tests,
or passed to later user-facing workflows. Secret-like field names and common
secret-like string values are replaced with stable redaction markers.

Redaction handles:

- nested objects
- arrays
- `Error` instances
- secret-like keys such as `apiKey`, `authorization`, `password`, `secret`, and
  `token`
- common string patterns such as bearer headers, provider-style key prefixes,
  and query-style secret assignments

Unsupported diagnostic values such as functions, symbols, and bigint values
return an explicit `invalid-diagnostic-input` failure with a field path. Circular
references are replaced with `[CIRCULAR]`.

## Required Call Order

Provider clients, indexing, retrieval synthesis, chat commands, and future
agent tools should use this order:

1. Validate persisted settings through `loadPluginSettings` or
   `parsePluginSettings`.
2. Create a disclosure request with provider ID, capability, and content
   sensitivity.
3. Run `preflightProviderInvocation`.
4. If denied, surface the user-facing message and keep diagnostics redacted.
5. If allowed, construct the provider adapter request using the selected model.

This keeps vault content local unless cloud use is explicitly enabled and the
provider is explicitly trusted for the workflow.
