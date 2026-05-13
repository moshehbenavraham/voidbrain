# Ecosystem Export And Handoff Boundaries

Voidbrain handoff is a selected-output workflow. It helps a user copy,
version, or share chosen markdown reports and framework evidence without
turning the MVP into a hosted publishing, sync, or direct external-service
pipeline.

## Implementation Audit Notes

| Source | Existing boundary | Session action |
|--------|-------------------|----------------|
| `docs/source-ingestion-staging.md` | Source previews and staged outputs preserve source paths, target paths, citation IDs, provider decisions, staged-change IDs, and validation output. | Link source-record summaries to this guide and keep citation IDs in handoff evidence. |
| `docs/staged-change-review-apply.md` | Apply remains review-first through staged changes with target paths, staged-change IDs, backup intent, validation output, and audit entries. | Link staged-change summaries to this guide without adding auto-apply, sync, or publish behavior. |
| `docs/vault-health-repair-staging.md` | Redacted health report export writes bounded support records and keeps report IDs, target paths, staged-change IDs, and validation output. | Link report handoff to selected markdown export and recovery fields. |
| `docs/release-artifacts.md` | Release diagnostics use repository-relative artifact paths, SHA-256 checksums, byte sizes, and validation issue codes. | Link release evidence handoff to checksum and validation-output requirements. |
| `docs/agent-surface-packaging.md` | Agent surfaces are local framework instruction files, not hosted marketplace publishing. | Clarify selected file reuse as handoff of framework surfaces only. |
| `docs/provider-readiness-guide.md` | Custom remote and trusted cloud paths require provider review, trust, auth, capability, and disclosure gates; untrusted cloud is blocked. | Route any remote or cloud handoff through the same disclosure gate language. |
| `README.md` | Distribution docs link release artifacts, install/update, agent packaging, and provider readiness. | Add this guide to the distribution and safety references. |

Unsafe examples remain out of scope: full-vault export defaults, direct
publishing to external services, hosted sync, prompt bodies, hidden provider
state, provider secrets, private absolute paths, raw note bodies, and copied
`.voidbrain` support payloads.

## Selected Outputs

Every handoff starts with explicit user selection. A selected output can be:

- A redacted markdown report.
- A staged-change summary.
- A source record or source-derived summary.
- Release evidence with artifact paths, checksums, and validation output.
- A local agent surface package manifest or selected framework instruction
  file.

Never use a folder root, wildcard, or implicit full-vault selection as the
default. The user chooses the exact markdown report, summary, manifest, source
record, or release evidence that can be handed off.

The handoff record keeps only bounded evidence: vault-relative or
repository-relative paths, headings, source record IDs, citation IDs,
staged-change IDs, report IDs, artifact paths, checksums, command IDs,
validation output, and retry guidance. It does not include raw note bodies,
provider secrets, authorization headers, prompt bodies, hidden provider state,
private absolute paths, or raw `.voidbrain` support records.

## Evidence Requirements

| Output kind | Required evidence |
|-------------|-------------------|
| Retrieval summary | Selected path, heading, citation ID, source record ID, validation output, and recovery details. |
| Source record | Source path, source record ID, citation ID, generated target path when available, provider decision when available, validation output, and retry guidance. |
| Staged-change summary | Staged-change ID, target path, backup intent when available, validation output, and review status. |
| Health report | Report ID, affected paths, redacted finding evidence, staged-change IDs when available, validation output, and retry guidance. |
| Release evidence | Repository-relative artifact path, SHA-256 checksum, byte size when available, validation issue code when present, and validation output. |
| Agent surface package | Selected framework surface path, target ecosystem, checksum, command catalog status, validation issue code when present, and package diagnostic path. |
| Markdown bundle | Bundle manifest path, selected member paths, citations, source record IDs, staged-change IDs, report IDs, checksums, and validation output. |

Grounded summaries must preserve citation traceability. A copied paragraph is
not enough unless it carries the vault path, heading, citation ID, and source
record that produced the claim. If a source was provider-assisted, include the
bounded provider decision such as `not-requested`, `local-fallback`, or
`provider-blocked`; do not include prompts, request bodies, response bodies, or
secret material.

## Local Modes

### Git

Use Git for selected framework or report evidence that already belongs in the
repository:

```bash
git add docs/ecosystem-export-handoff-boundaries.md
git diff --cached -- docs/ecosystem-export-handoff-boundaries.md
```

Do not add user vault notes, `.voidbrain` support records, provider
configuration, or generated examples from private paths.

### Filesystem

Use filesystem handoff for a chosen markdown report or bundle under a fake
destination:

```bash
mkdir -p fixtures/demo-handoff/reports
cp fixtures/demo-vault/reports/health-summary.md fixtures/demo-handoff/reports/health-summary.md
```

The source must be selected by the user and the destination must stay local
unless a later provider review approves a remote path.

### Copy

Use copy handoff for a short cited summary. Keep citations and recovery fields
with the copied text:

```text
Summary: Demo finding from fixtures/demo-vault/reports/health-summary.md
Citation: fixtures/demo-vault/notes/demo-note.md#Setup
Report ID: health-report-fixture-001
Validation: fixture-safe
```

### Markdown Bundle

Use a markdown bundle when several selected outputs travel together:

```text
fixtures/demo-handoff/bundle/
|-- README.md
|-- reports/health-summary.md
|-- staged-changes/staged-change-summary.md
`-- release/release-evidence.md
```

Bundle manifests must list selected paths, citations, source records,
staged-change IDs, report IDs, artifact checksums, and validation output.

## Recovery Records

Every handoff plan should leave enough context for inspection or retry:

- Command ID.
- Selected path or target path.
- Cache path when the originating workflow produced one.
- Staged-change ID when staged output is involved.
- Report ID when the output is a report or report-derived summary.
- Artifact path and checksum for release or package evidence.
- Validation output and issue code when validation blocked handoff.
- Retry guidance that points back to the original local workflow.

Recovery records stay bounded. They do not contain raw note bodies,
before/after staged-change payloads, provider responses, authorization
headers, prompt bodies, hidden provider state, private absolute paths, or
credential-like values.

## Remote Or Cloud Handoff

Remote and cloud handoff remains review-required or blocked. Private vault
content can leave the machine only after provider review, trust, auth,
capability, and disclosure gates pass. Untrusted cloud targets, direct
publishing to external services, hosted sync, team knowledge-base pushes, and
full-vault export defaults are blocked for the MVP.

## Contributor Validation

The typed planner in `src/agent/ecosystem-handoff-boundaries.ts` validates the
same boundary in tests:

- Explicit selected outputs are required.
- Grounded outputs require citations and source records.
- Staged-change, report, release, and package evidence must keep their IDs,
  paths, checksums, and validation output.
- Local modes can be allowed without provider calls.
- Remote and cloud modes are review-required only after provider review,
  trust, auth, capability, and disclosure are explicit.
- Unsupported publishing, hosted sync, external-service, and team
  knowledge-base targets are blocked.
- Diagnostics fail closed on provider secrets, authorization headers, prompt
  bodies, hidden provider state, private path hints, raw note bodies, and
  full-vault defaults.

Docs and tests must use `test/fixtures/vault/` or clearly fake paths such as
`fixtures/demo-vault/`. Do not copy user vault notes, `.voidbrain` support
records, provider configuration, raw hidden provider state, prompt bodies,
private note content, or local research input into examples or handoff
packages.

## Phase 04 Closeout

Phase 04 distribution integration validation checks selected-output handoff as
part of the complete distribution path. The closeout validates citation IDs,
source records, staged-change IDs, report IDs, artifact paths, checksums,
validation output, provider review gates, full-vault default rejection, direct
publishing rejection, and unsafe diagnostic redaction. See
[Phase 04 Distribution Integration Validation](phase04-distribution-integration-validation.md).
