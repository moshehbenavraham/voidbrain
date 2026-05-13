# Release Artifact Validation

Voidbrain release artifacts are validated locally before they are treated as
release-ready. The validation path checks metadata alignment, declared package
files, generated build output, checksums, and bounded diagnostics without
reading or recording user vault notes.

## Artifact Contract

The local Obsidian plugin bundle is:

| Artifact | Source |
|----------|--------|
| `main.js` | `build/voidbrain/main.js` |
| `styles.css` | `build/voidbrain/styles.css` |
| `manifest.json` | `manifest.json` |
| `versions.json` | `versions.json` |

`package.json` must declare exactly these release files in deterministic order:

```json
["main.js", "manifest.json", "styles.css", "versions.json"]
```

## Local Build

Run the production build from the repository root:

```bash
bun run build
```

The production build writes the generated JavaScript and CSS artifacts to
`build/voidbrain/`. The manifest and version map stay in the repository root
and are copied by the local deploy helper.

## Release Validation

Run the release artifact validator after a production build:

```bash
bun run validate:release-artifacts
```

The validator checks:

- `package.json` version and package `files`.
- `manifest.json` version and `minAppVersion`.
- `versions.json` entry for the current manifest version.
- Expected artifact presence for `main.js`, `styles.css`, `manifest.json`, and
  `versions.json`.
- SHA-256 checksums and byte sizes for each artifact.
- Diagnostic output safety for secret-like values, private path hints, raw
  provider state, and raw file payloads.

## Diagnostic Boundary

Release diagnostics may contain:

- Command ID.
- Repository-relative artifact paths.
- Artifact byte sizes.
- SHA-256 checksums.
- Package, manifest, and version-map values.
- Validation issue codes and remediation text.

Release diagnostics must not contain:

- Provider secrets, tokens, passwords, authorization headers, or raw hidden
  provider state.
- Private vault note content, prompt bodies, or source payloads.
- Absolute private machine paths.
- Raw artifact file content.

## Dev-Vault Dry Run

Preview a dev-vault deploy without building or copying:

```bash
bun run deploy:obsidian -- --dry-run
```

The dry run reuses release artifact validation as the handoff into the
install/update planner. The planner blocks before copy or clean operations if
release metadata, checksums, or expected artifacts fail validation.

The dry run reports the planned artifact labels, repository-relative source
paths, target plugin path, operation kind, installed version when present,
incoming version, release validation status, and rollback intent. It does not
build, copy, clean, back up, mutate vault files, or record user vault note
content.

See [Obsidian Install And Update Workflow](obsidian-install-update.md) for the
local install, update, downgrade, rollback intent, and troubleshooting flow.

## Recovery Details

When validation fails, keep these details for inspection or retry:

- Command ID: `voidbrain.validate-release-artifacts`.
- Artifact path from the validation issue.
- Version values from the diagnostic output.
- Validation issue code and remediation.
- SHA-256 checksum for artifacts that were readable.
- Install/update command ID `voidbrain.deploy-obsidian-plugin` when validation
  output is carried into a deploy plan.
- Target plugin path `.obsidian/plugins/voidbrain` and rollback intent when a
  deploy plan is blocked.

Common retries:

- Missing build output: run `bun run build`, then rerun
  `bun run validate:release-artifacts`.
- Version drift: align `package.json`, `manifest.json`, and `versions.json`.
- Package file drift: restore the release file list to the artifact contract.
- Unsafe diagnostic output: replace the unsafe value with a fake placeholder or
  a repository-relative path.
