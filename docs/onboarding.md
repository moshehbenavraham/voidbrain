# Onboarding

## Start Here

1. Install Node 20+ and Bun.
2. Install dependencies from the repository root.
3. Run the local validation gate.
4. Review the spec system files in `.spec_system/` for current product scope.

```bash
bun install
bun run validate
```

## What To Read First

- `README.md` for the quick project overview
- `.spec_system/PRD/PRD.md` for product scope and phase status
- `.spec_system/CONVENTIONS.md` for engineering and safety rules
- `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` for agent-facing workflow rules

## Working Model

- Treat the vault as user-owned data.
- Use synthetic fixtures for examples and tests.
- Keep AI-proposed note edits staged before application.
- Avoid writing provider secrets or private vault content into tracked docs.

## First Verification

After setup, run the full local gate:

```bash
bun run validate
```

If that passes, the repository is ready for feature work, docs edits, or spec
workflow steps.
