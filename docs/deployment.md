# Deployment Guide

## Current Deployment Model

Voidbrain does not have a hosted deployment target in the current phase. The
plugin is developed, tested, and packaged locally for use inside Obsidian.

## Build And Package

```bash
bun run build
```

That build step is the main local release gate for plugin artifacts.

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

## Operational Notes

- If a future phase adds a hosted or automated distribution path, document the
  workflow here before relying on it.
- Until then, local build output and the dev-vault deploy helper are the only
  deployment steps that exist.
