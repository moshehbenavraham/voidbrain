# Contributing

## Branch Conventions

- `main` - Production-ready code
- `develop` - Integration branch for ongoing work
- `feature/*` - New features or sessions
- `fix/*` - Bug fixes and regressions

## Commit Style

Use conventional commits when possible:

- `feat:` for new behavior
- `fix:` for bug fixes
- `docs:` for documentation updates
- `refactor:` for structure changes without behavior change
- `test:` for test-only changes

Keep commits focused on one logical change. Avoid bundling unrelated docs,
code, and fixture edits into one commit unless they are inseparable.

## Pull Request Process

1. Create a feature branch from the current integration branch.
2. Make changes with reviewable diffs.
3. Update tests and documentation for user-visible behavior changes.
4. Run the local validation gate before requesting review.
5. Open a PR with a clear description of what changed and why.

## Local Validation

Use the repository validation commands before submitting changes:

```bash
bun run validate:agent-surfaces
bun run validate:fixture-safety
bun run validate:agent-docs
bun run validate
```

## Documentation and Fixture Rules

- Keep docs current with implemented behavior.
- Keep examples synthetic and fixture-safe.
- Do not commit provider secrets, private vault content, or hidden auth state.
- Stage AI-proposed note changes before applying them to user-owned vault data.
