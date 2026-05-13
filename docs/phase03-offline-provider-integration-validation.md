# Phase 03 Offline Provider Integration Validation

Phase 03 closes the offline and provider hardening work by validating the
provider workflow as one integrated, local-first system. The validation uses
synthetic provider profiles, fixture vault paths, and bounded recovery records.
It does not call live providers, read private vault files, or persist raw prompt
or note content.

## Scope

This closeout validates these paths together:

- Local runtime provider readiness for chat and embeddings.
- OpenAI-compatible local, custom remote, trusted cloud, untrusted cloud,
  missing-secret, auth-failed, and capability-mismatch profiles.
- Provider invocation preflight for cloud disclosure, trust, auth, capability,
  timeout, cancellation, retry, and duplicate action protection.
- Offline embedding and semantic index compatibility with lexical fallback.
- Provider troubleshooting, retry, reset, disclosure review, and recovery
  reports.
- Agent surface synchronization, fixture safety, and dry-run framework update
  language.

## Privacy Boundary

Voidbrain remains local-first during this validation. Local provider workflows
stay on the selected local runtime. Cloud or custom remote workflows remain
blocked until provider review, trust, auth, capability, and disclosure settings
allow the request.

The closeout artifacts must not include provider secrets, auth headers, prompt
bodies, raw private note bodies, hidden provider state, private path hints, or
live provider output. Recovery records are limited to command ID, provider ID,
model ID, target path, cache path, staged-change ID, report ID, source counts,
readiness codes, fallback mode, and validation output.

## Synthetic Inputs

The integration tests use fixture records under `test/fixtures/providers/` and
`test/fixtures/vault/`. Vault paths use clearly fake locations such as
`fixtures/demo-vault/semantic-source-a.md`.

Provider fixtures cover:

- Ready local runtime chat and embedding models.
- OpenAI-compatible local endpoint classification.
- Trusted cloud provider with explicit disclosure settings.
- Untrusted cloud provider denial.
- Missing-secret and auth-failed readiness.
- Capability mismatch for selected models.
- Timeout, cancellation, retry, and duplicate in-flight invocation behavior.
- Semantic compatibility states and lexical fallback.

## Expected Evidence

Validation evidence should include:

- Phase 03 integration test output.
- Agent surface validation output.
- Fixture safety validation output.
- Agent docs validation output.
- Full repository validation output.
- Residual failures, when present, with retry context.

The validation report for this session records command output in
`.spec_system/specs/phase03-session06-offline-provider-integration-validation/validation.md`.

## Recovery Evidence

Provider and indexing failures should preserve enough bounded context for
inspection or retry:

- `voidbrain.chat-with-vault` for chat invocation recovery.
- `voidbrain.semantic-index-readiness` for embedding readiness recovery.
- `voidbrain.semantic-index-compatibility` for semantic fallback and reindex
  guidance.
- `voidbrain.provider-troubleshooting` for setup, auth, disclosure, and reset
  diagnostics.
- Staged-change IDs only when generated note output is reviewable before apply.

## Closeout Criteria

Phase 03 closeout is ready when:

- Synthetic integration tests pass.
- Cloud disclosure remains denied unless explicitly enabled and trusted.
- Lexical fallback remains available when semantic retrieval is blocked, stale,
  missing, canceled, or offline.
- Agent surfaces and command docs match implemented command statuses.
- Fixture safety checks reject secret-like examples, credential-like values, and
  private path hints.
- Validation output and residual risks are recorded with recovery context.
