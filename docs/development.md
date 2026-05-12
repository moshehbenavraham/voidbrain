# Development Guide

## Common Commands

```bash
bun install
bun run dev
bun run build
bun run check
bun run lint
bun run test
bun run validate
```

## Validation Commands

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
```

## Source Layout

- `src/main.ts` owns plugin lifecycle wiring.
- `src/agent/` owns command catalog and safety helpers.
- `src/providers/` owns provider capability and privacy logic.
- `src/vectorstore/` owns parsing, indexing, and retrieval services.
- `src/types/` and `src/utils/` hold shared contracts and helpers.

## Development Rules

- Prefer local-first behavior.
- Keep secret-bearing values out of markdown, fixtures, and logs.
- Preserve staged-change workflows for note mutations.
- Keep tests fixture-safe and deterministic.

## Working With Docs

Update the docs whenever runtime behavior changes. The root README should stay
short and point to the detailed docs instead of duplicating them.
