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
- `docs/provider-readiness-guide.md` for the first-run provider path order and
  disclosure gates
- `docs/provider-setup.md` for local Ollama, provider role, embedding, and
  troubleshooting setup
- `.spec_system/PRD/PRD.md` for product scope and phase status
- `.spec_system/CONVENTIONS.md` for engineering and safety rules
- `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` for agent-facing workflow rules

## Working Model

- Treat the vault as user-owned data.
- Use synthetic fixtures for examples and tests.
- Keep AI-proposed note edits staged before application.
- Avoid writing provider secrets or private vault content into tracked docs.
- Start provider setup with local runtime or OpenAI-compatible local paths.
- Use remote or cloud providers only after provider review, trust, auth,
  capability, and disclosure gates pass.

## First-Run Provider Readiness

Use this order before choosing a model workflow:

1. Keep `Cloud provider workflows` disabled.
2. Configure a local runtime provider such as Ollama, or an
   OpenAI-compatible local endpoint that resolves to the same machine.
3. Click `Test` for the saved provider profile.
4. Select chat and embedding roles only after readiness passes or reports a
   specific blocker.
5. Keep lexical indexing enabled. Turn on semantic indexing only after the
   embedding provider and model are ready.
6. Review custom remote or trusted cloud providers only when you intend for
   private vault content to leave the machine.

Untrusted cloud providers are blocked for private vault content. Voidbrain does
not silently fall back from local providers to cloud providers when local
runtime readiness fails.

Use fake paths such as `fixtures/demo-vault/sources/source-note.md` in examples
and tests. Do not use live provider calls or real vault notes in onboarding
examples.

## First Verification

After setup, run the full local gate:

```bash
bun run validate
```

If that passes, the repository is ready for feature work, docs edits, or spec
workflow steps.
