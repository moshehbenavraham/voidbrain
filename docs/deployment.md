# Deployment Guide

## Current Deployment Model

Voidbrain does not have a hosted deployment target in the current phase. The
plugin is developed, tested, and packaged locally for use inside Obsidian.

## Build And Package

```bash
bun run build
```

That build step is the main local release gate for plugin artifacts.

## Release Expectations

- Keep framework files separate from user vault content.
- Review staged changes before applying them to notes.
- Do not publish examples that contain real provider secrets or private vault
  content.
- Update documentation when distribution or packaging behavior changes.

## Operational Notes

- If a future phase adds a hosted or automated distribution path, document the
  workflow here before relying on it.
- Until then, local build output is the only deployment step that exists.
