# Deployment Guide

## Current Deployment Model

Voidbrain does not have a hosted deployment target in the current phase. The
plugin is developed, tested, and packaged locally for use inside Obsidian.

## Build And Package

```bash
bun run build
bun run validate:release-artifacts
```

The build step is the main local release gate for plugin artifacts, and release
artifact validation is the metadata and checksum gate that follows it. The
validator checks `package.json`, `manifest.json`, `versions.json`, declared
package files, generated bundle files, SHA-256 checksums, and bounded
diagnostics before artifacts are treated as release-ready.

See [Release Artifact Validation](release-artifacts.md) for the full artifact
contract and recovery guide.

## Deploy To A Dev Vault

Set `VOIDBRAIN_DEV_VAULT` in `.env` to the Obsidian vault root, then run:

```bash
bun run deploy:obsidian
```

The deploy helper builds the production plugin bundle and copies only
`main.js`, `styles.css`, `manifest.json`, and `versions.json` into
`$VOIDBRAIN_DEV_VAULT/.obsidian/plugins/voidbrain`. Use
`bun run deploy:obsidian -- --dry-run` to preview the target without building
or copying.

## Repository Health

```bash
bun run health
```

The health probe checks the current spec-system state, core package scripts,
local-only deployment documentation, and the presence of the repository health
workflow.

## Release Expectations

- Keep framework files separate from user vault content.
- Review staged changes before applying them to notes.
- Do not publish examples that contain real provider secrets or private vault
  content.
- Update documentation when distribution or packaging behavior changes.
- Keep release diagnostics free of provider secrets, raw prompt bodies,
  authorization headers, hidden provider state, private vault content, and
  private machine paths.
- Preserve release recovery details with command ID
  `voidbrain.validate-release-artifacts`, artifact path, checksum, version
  values, validation issue code, and remediation text.

## Recovery

- Missing generated output: run `bun run build`, then rerun
  `bun run validate:release-artifacts`.
- Version drift: align `package.json`, `manifest.json`, and `versions.json`.
- Package file drift: restore `main.js`, `manifest.json`, `styles.css`, and
  `versions.json` as the declared package files.
- Unsafe diagnostic output: replace unsafe examples with fake placeholders or
  repository-relative paths.

## Operational Notes

- If a future phase adds a hosted or automated distribution path, document the
  workflow here before relying on it.
- Until then, local build output and the dev-vault deploy helper are the only
  deployment steps that exist.
