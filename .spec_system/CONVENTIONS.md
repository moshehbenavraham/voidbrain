# CONVENTIONS.md

## Guiding Principles

- Treat the vault as user-owned data and the durable source of truth.
- Prefer local-first behavior; any cloud provider call must be explicit and explainable.
- Keep AI-generated changes inspectable through staged diffs, logs, or recoverable files.
- Optimize for boring, typed, testable code over clever abstractions.
- Match product language consistently: vault, source, note, entity, concept, hot cache, staged change, provider, index.

## Naming

- TypeScript variables and functions use camelCase.
- Svelte components and exported classes use PascalCase.
- Markdown files, commands, and skill directories use kebab-case unless Obsidian compatibility requires a title.
- Booleans read as questions: `isIndexing`, `hasProviderKey`, `shouldStageWrite`.
- Provider names, vault paths, and command IDs stay explicit; avoid abbreviations outside `id`, `url`, `api`, `llm`, and `ui`.

## Files and Structure

- Group code by domain first: `agent/`, `providers/`, `vectorstore/`, `stores/`, `views/`, `components/`, `utils/`.
- Keep Obsidian lifecycle wiring in the composition root; keep domain logic in services that can be tested without Obsidian running.
- Keep markdown agent surfaces (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, skills) small and synchronized with implemented behavior.
- Do not mix user vault templates, test fixtures, and runtime source in the same directory.
- Avoid deep nesting beyond four levels unless mirroring Obsidian or test fixture structure.

## TypeScript

- Use strict TypeScript and keep public service contracts typed.
- Prefer `unknown` plus validation over `any`.
- Use `interface` for public object shapes and `type` for unions, mapped types, and aliases.
- Model provider capabilities explicitly instead of branching on provider display names.
- Keep async flows cancellable or idempotent when they touch vault files, indexes, or provider calls.

## Svelte and UI

- Keep Svelte components focused on rendering and local interactions.
- Move cross-view state into typed stores and service facades.
- Do not put provider secrets, raw vault content, or long-running indexing logic in components.
- Use explicit loading, empty, error, and permission states for chat, indexing, staged changes, and provider setup.
- Plugin UI must be keyboard navigable and work in Obsidian light and dark themes.

## Obsidian Runtime

- Use Obsidian vault and adapter APIs for plugin runtime I/O.
- Do not write directly to arbitrary filesystem paths from the plugin runtime.
- Register commands, views, events, and intervals in one owner and clean them up on unload.
- Treat metadata cache results as stale until refreshed by Obsidian events or explicit reloads.
- Preserve existing notes, frontmatter, wikilinks, attachments, and `.canvas` files unless the user approves a staged change.

## Markdown Data

- Keep durable knowledge readable as markdown, JSON, or Obsidian canvas files.
- Frontmatter keys use kebab-case or Obsidian-established names; do not mix casing in the same note type.
- Generated notes must link back to source notes or source records when making factual claims.
- Use wikilinks for vault-local references and plain markdown links for external URLs.
- Append-only logs need timestamps and operation summaries that are useful during recovery.

## Providers and AI

- Isolate provider authentication, endpoint setup, model metadata, and invocation code.
- Never write provider secrets to markdown, logs, fixtures, screenshots, or Git-tracked examples.
- Resolve model capabilities before using vision, PDF handling, tool calls, embeddings, or streaming.
- Show the user when a workflow will send vault content to a cloud provider.
- Keep prompts and tool instructions versioned near the workflow that uses them.

## Retrieval and Indexing

- Keep lexical and semantic retrieval separate enough to test independently.
- Key vector indexes by embedding model or compatible embedding family.
- Run indexing in the background with progress, cancellation, and recoverable state.
- Keep retrieval results traceable to vault paths, headings, and source records.
- Do not use retrieval output without citations in user-facing synthesis unless the workflow is explicitly non-grounded.

## Staged Writes and Safety

- All AI-proposed note mutations start as staged changes unless the user has explicitly enabled an auto-apply workflow.
- Show before and after content for edits that touch existing user notes.
- Prefer additive writes for generated knowledge; destructive rewrites require stronger confirmation.
- Keep backups, diffs, or Git state available for every automated write path.
- Update indexes after writes through a single synchronization path.

## Error Handling

- Errors should include vault path, provider name, command, or index name when that context helps debugging.
- Fail closed for privacy and data mutation decisions.
- Surface actionable user notices for setup, provider, permission, and indexing failures.
- Do not swallow provider or vault I/O errors silently.

## Testing

- Use Vitest for service, provider, retrieval, store, and utility tests.
- Use fixture vaults for indexing, chat persistence, staged writes, and health checks.
- Test behavior and user-visible contracts, not private implementation details.
- Add regression tests for data loss, secret leakage, stale index, and citation failures.
- Integration tests should cover plugin lifecycle paths that unit tests cannot model.

## Dependencies

- Prefer focused, maintained packages already present in the target stack.
- Add dependencies only when they reduce real implementation risk or replace fragile local code.
- Keep lockfiles committed and update dependencies intentionally.
- Avoid dependencies that require hosted services for MVP-local behavior.

## Local Dev Tools

| Category | Tool | Config |
|----------|------|--------|
| Build | Vite | `vite.config.ts` |
| Formatter | Biome | `biome.json` |
| Linter | Biome | `biome.json` |
| Type Safety | TypeScript, Svelte Check | `tsconfig.json`, `svelte.config.ts` |
| Testing | Vitest | `vitest.config.ts`, integration config as needed |
| Observability | pino | `src/utils/logger.ts`, `logs/.gitignore` |
| Health | Bun + GitHub Actions | `bun run health` validates repository health, deployment posture, and CI workflow presence |
| UI Framework | Svelte | `src/components`, `src/views` |
| Runtime Host | Obsidian API | `manifest.json`, plugin entrypoint |
| Retrieval | MiniSearch, local vector index | service-specific config |
| Agent Runtime | LangChain, LangGraph | provider and agent modules |

## Infrastructure

| Component | Provider | Details |
|-----------|----------|---------|
| CDN/DNS | Not configured | Local-first plugin; no public web tier. |
| Hosting | Obsidian desktop | Runs inside the Obsidian app. |
| Database | None | Vault markdown is the source of truth; no external database. |
| Backup | Git / filesystem | User-managed backups; no automated infra bundle yet. |
| Deploy | Not configured | No production deploy target in the current phase. |
| Local Dev | Bun + Vite | `bun run validate` builds, type-checks, lints, tests, and checks agent docs. |

## Git and Releases

- Keep framework files separate from user vault content.
- Release notes must call out privacy, migration, and data-format changes.
- Do not publish fixtures or examples containing real provider keys or personal vault content.
- Commit messages use imperative mood and describe one logical change.
- Validate agent-surface docs before publishing plugin or skill updates.

## When In Doubt

- Preserve user data.
- Make provider behavior explicit.
- Stage the change.
- Add the test that would catch the failure next time.
