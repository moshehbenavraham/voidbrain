# Voidbrain

Voidbrain is a local-first AI second-brain scaffold for Obsidian-style markdown
vaults. It is currently an MVP scaffold with provider privacy gates, local
indexing, cited chat, source ingestion staging, staged review/apply, vault
health reporting, hot cache recovery, and a local validation toolchain.

## What It Is

- Obsidian-compatible plugin scaffold built with TypeScript, Svelte, Vite, and
  Vitest.
- Spec-driven product plan under `.spec_system/`.
- Local-first design: vault markdown remains the durable source of truth.
- Safety baseline for provider privacy, staged writes, citations, indexing,
  hot cache recovery, and agent-readable command surfaces.

## Development

```bash
bun install
bun run validate
```

Individual checks:

```bash
bun run build
bun run check
bun run lint
bun run test
bun run validate:release-artifacts
bun run validate:agent-docs
bun run validate:agent-surface-package
```

Agent documentation checks:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-surface-package
bun run preview:framework-update
```

Local Obsidian install/update preview:

```bash
bun run deploy:obsidian -- --dry-run --vault fixtures/demo-vault
```

The deploy workflow builds and validates the plugin bundle, then copies only
`main.js`, `manifest.json`, `styles.css`, and `versions.json` into
`.obsidian/plugins/voidbrain`. Dry run prints the install/update plan without
building, copying, cleaning, backing up, or mutating vault files. See
[Obsidian Install And Update Workflow](docs/obsidian-install-update.md).

Provider setup starts local-first. Review
[Provider Readiness Guide](docs/provider-readiness-guide.md), configure a
local runtime or OpenAI-compatible local endpoint first, and move to custom
remote or trusted cloud providers only after provider review, trust, auth,
capability, and disclosure gates pass. Untrusted cloud providers remain
blocked for private vault content.

## Project Docs

- [Contributing](CONTRIBUTING.md)
- [Product Requirements](.spec_system/PRD/PRD.md)
- [UX Requirements](.spec_system/PRD/PRD_UX.md)
- [Phase 00 Archive](.spec_system/archive/phases/phase_00/PRD_phase_00.md)
- [Phase 01 Archive](.spec_system/archive/phases/phase_01/PRD_phase_01.md)
- [Engineering Conventions](.spec_system/CONVENTIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Onboarding](docs/onboarding.md)
- [Development Guide](docs/development.md)
- [Environment Guide](docs/environments.md)
- [Deployment Guide](docs/deployment.md)
- [Release Artifact Validation](docs/release-artifacts.md)
- [Obsidian Install And Update Workflow](docs/obsidian-install-update.md)
- [Agent Surface Packaging](docs/agent-surface-packaging.md)
- [Provider Readiness Guide](docs/provider-readiness-guide.md)
- [Provider Setup](docs/provider-setup.md)
- [Provider Troubleshooting and Recovery](docs/provider-troubleshooting-recovery.md)
- [Phase 03 Offline Provider Integration Validation](docs/phase03-offline-provider-integration-validation.md)
- [Agent Surfaces and Commands](docs/agent-surfaces-commands.md)
- [Provider Privacy Boundaries](docs/provider-privacy-boundaries.md)
- [Indexing and Retrieval Foundation](docs/indexing-retrieval-foundation.md)
- [Hot Cache MVP Integration Validation](docs/hot-cache-mvp-integration-validation.md)

## Agent Surfaces

Voidbrain keeps agent-readable command guidance synchronized across:

- [AGENTS.md](AGENTS.md)
- [CLAUDE.md](CLAUDE.md)
- [GEMINI.md](GEMINI.md)
- [skills/voidbrain/SKILL.md](skills/voidbrain/SKILL.md)
- [docs/agent-surfaces-commands.md](docs/agent-surfaces-commands.md)

The canonical command contracts live under `src/agent/` and
`src/types/agent-commands.ts`. Agent surfaces must preserve local-first privacy,
staged changes, provider secrets boundaries, synthetic fixtures, citations,
hot cache support records, implemented dry-run framework update previews, and
recovery expectations.

Package readiness is checked with `bun run validate:agent-surface-package`.
The package manifest stays local and records surface ID, ecosystem, path,
checksum, command catalog status, validation issues, and recovery details
without copying user vault content, `.voidbrain` support records, provider
secrets, authorization headers, prompt bodies, hidden provider state, private
paths, or `EXAMPLES` research input.

## Repository Policy

`EXAMPLES/` is local research input and is intentionally ignored.

## Documentation Status

Phase 01 MVP implementation is complete through hot cache integration
validation. Phase 02 agentic maintenance is complete, and the standard
documentation set lives at the repository root and in `docs/`, with
repository-specific workflow and architecture details kept alongside the phase
and domain docs.

Phase 03 offline and provider hardening is complete, with closeout validation
evidence recorded for local runtime profiles, OpenAI-compatible profiles,
provider invocation boundaries, offline embedding compatibility, lexical
fallback, provider troubleshooting recovery, and synchronized agent-surface
safety checks.

Phase 04 distribution work has started with local release artifact validation
for package metadata, Obsidian manifest metadata, version maps, checksums,
bounded diagnostics, reproducible build output, and vault-safe Obsidian
install/update planning. Agent surface packaging now validates local reusable
instruction surfaces before they are copied into compatible tool setups.
