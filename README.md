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
bun run validate:agent-docs
```

Agent documentation checks:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run preview:framework-update
```

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
- [Provider Setup](docs/provider-setup.md)
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

## Repository Policy

`EXAMPLES/` is local research input and is intentionally ignored.

## Documentation Status

Phase 01 MVP implementation is complete through hot cache integration
validation. Phase 02 agentic maintenance is complete, and the standard
documentation set lives at the repository root and in `docs/`, with
repository-specific workflow and architecture details kept alongside the phase
and domain docs.

Phase 03 offline and provider hardening is the next unfinished phase in the
PRD.
