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
```

## Project Docs

- [Product Requirements](.spec_system/PRD/PRD.md)
- [UX Requirements](.spec_system/PRD/PRD_UX.md)
- [Phase 00 Plan](.spec_system/PRD/phase_00/PRD_phase_00.md)
- [Engineering Conventions](.spec_system/CONVENTIONS.md)

## Repository Policy

`EXAMPLES/` is local research input and is intentionally ignored. Public
references to upstream examples live in the PRD instead of this repository.
