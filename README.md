# Voidbrain

Voidbrain is a local-first AI second-brain scaffold for Obsidian-style markdown
vaults. It is currently in the foundation phase: product requirements, UX
direction, an Obsidian plugin shell, and a local validation toolchain.

## What It Is

- Obsidian-compatible plugin scaffold built with TypeScript, Svelte, Vite, and
  Vitest.
- Spec-driven product plan under `.spec_system/`.
- Local-first design: vault markdown remains the durable source of truth.
- Safety baseline for provider privacy, staged writes, citations, indexing, and
  agent-readable command surfaces.

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

- [Product Requirements](.spec_system/PRD/PRD.md)
- [UX Requirements](.spec_system/PRD/PRD_UX.md)
- [Phase 00 Plan](.spec_system/PRD/phase_00/PRD_phase_00.md)
- [Engineering Conventions](.spec_system/CONVENTIONS.md)
- [Agent Surfaces and Commands](docs/agent-surfaces-commands.md)
- [Provider Privacy Boundaries](docs/provider-privacy-boundaries.md)
- [Indexing and Retrieval Foundation](docs/indexing-retrieval-foundation.md)

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
dry-run framework update behavior, and recovery expectations.

## Repository Policy

`EXAMPLES/` is local research input and is intentionally ignored. 
