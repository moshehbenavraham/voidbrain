# Environments

## Local Development

- Runs inside the user's Obsidian desktop environment.
- Uses local vault files as the source of truth.
- Builds and tests run with Bun, Vite, Vitest, Svelte Check, and Biome.

## Test Environment

- Uses synthetic fixture vaults under `test/fixtures/vault/`.
- Should never require provider secrets or private user content.
- Must stay deterministic enough for repeatable validation.

## Production Model

- There is no hosted backend or separate production service for the MVP.
- Distribution is centered on the Obsidian plugin and local vault workflows.
- Cloud provider usage is opt-in and should be explicit per workflow.

## Data Classification

- Durable knowledge: markdown, JSON, and canvas files in the vault
- Derived state: indexes, caches, logs, and staged-change artifacts
- Sensitive state: provider secrets and hidden auth data, which must stay out of
  tracked docs and fixtures
