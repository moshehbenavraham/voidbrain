# voidbrain - Product Requirements Document

## Overview

voidbrain is a local-first, open-source AI second-brain product for Obsidian-style markdown vaults. It combines self-organizing wiki ingestion and vault maintenance, markdown and Git based agent workflows, and in-app RAG chat plus provider abstraction.

The product helps users capture sources, conversations, and research into durable markdown; query their vault with citations; and keep the knowledge graph healthy without manual filing. The vault remains the source of truth. AI behavior must be inspectable through markdown files, staged edits, logs, and recoverable local state.

The initial product focus is an Obsidian-compatible plugin plus agent-readable markdown instructions and scripts. It is not a hosted service. Cloud model support may exist, but privacy-preserving local operation is a first-class requirement.

## Goals

1. Turn a local markdown vault into a queryable, AI-maintained knowledge base.
2. Make ingestion, linking, retrieval, and synthesis cite actual vault notes or source records.
3. Preserve privacy and portability through local files, optional local models, and no required external database.
4. Provide an agent-friendly command and skill surface that works across markdown-reading AI tools.
5. Keep AI-created note changes reviewable, reversible, and compatible with Git workflows.
6. Provide enough vault hygiene checks to prevent orphaned notes, broken links, stale indexes, and uncited claims.

## Goal Evidence from EXAMPLES

| Goal | Quality references | Evidence captured |
|------|--------------------|-------------------|
| 1 | [claude-obsidian README](../../EXAMPLES/claude-obsidian/README.md), [Smart2Brain README](../../EXAMPLES/obsidian-smart2brain/README.md), [Smart2Brain architecture](../../EXAMPLES/obsidian-smart2brain/docs/architecture-overview.md) | Supports a local markdown vault that becomes queryable and AI-maintained through wiki ingestion, RAG, Obsidian APIs, and retrieval indexes. |
| 2 | [claude-obsidian README](../../EXAMPLES/claude-obsidian/README.md), [claude-obsidian AGENTS](../../EXAMPLES/claude-obsidian/AGENTS.md), [Smart2Brain README](../../EXAMPLES/obsidian-smart2brain/README.md) | Supports source ingestion, entity and concept extraction, cross-references, note citations, immutable raw sources, and generated wiki pages linked back to source records. |
| 3 | [COG README](../../EXAMPLES/COG-second-brain/README.md), [Smart2Brain README](../../EXAMPLES/obsidian-smart2brain/README.md), [Smart2Brain architecture](../../EXAMPLES/obsidian-smart2brain/docs/architecture-overview.md) | Supports local markdown files, no required external database, optional local models, provider-agnostic design, and explicit privacy boundaries for cloud calls. |
| 4 | [COG README](../../EXAMPLES/COG-second-brain/README.md), [COG agent support docs](../../EXAMPLES/COG-second-brain/docs/AGENT-SUPPORT.md), [claude-obsidian AGENTS](../../EXAMPLES/claude-obsidian/AGENTS.md) | Supports cross-agent markdown surfaces through `AGENTS.md`, native skill directories, command tables, and compatibility with Codex, Claude Code, Cursor, Gemini CLI, Kiro, and similar tools. |
| 5 | [COG README](../../EXAMPLES/COG-second-brain/README.md), [COG setup guide](../../EXAMPLES/COG-second-brain/SETUP.md), [Smart2Brain architecture](../../EXAMPLES/obsidian-smart2brain/docs/architecture-overview.md) | Supports Git and filesystem versioning, separation of framework files from user content, checkpointed conversations, staged writes, and review-centric mutation workflows. |
| 6 | [claude-obsidian README](../../EXAMPLES/claude-obsidian/README.md), [claude-obsidian AGENTS](../../EXAMPLES/claude-obsidian/AGENTS.md), [claude-obsidian WIKI](../../EXAMPLES/claude-obsidian/WIKI.md), [Smart2Brain architecture](../../EXAMPLES/obsidian-smart2brain/docs/architecture-overview.md) | Supports linting for orphans, dead links, stale claims, missing cross-references, source manifests, hot cache updates, and index freshness. |

## Non-Goals

- Replace Obsidian as the primary note editor.
- Provide a hosted SaaS sync, account, billing, or team permission system in the MVP.
- Store user knowledge in a proprietary database that becomes the only readable source of truth.
- Guarantee factual correctness of LLM output without user review.
- Support every note-taking application in the MVP.
- Build enterprise knowledge-base publishing workflows in the MVP.
- Automate destructive vault rewrites without explicit user review.

## Users and Use Cases

### Primary Users

- **PKM power user**: Maintains a markdown vault and wants AI help organizing, linking, and querying notes.
- **Researcher or student**: Ingests articles, papers, transcripts, and web sources into a structured personal wiki.
- **Product or engineering lead**: Uses a vault for meeting notes, project context, decisions, release notes, and team intelligence.
- **Privacy-sensitive user**: Wants local files and local models as the default path, with cloud models as an opt-in.
- **Agent-tool user**: Works with Codex, Claude Code, Gemini CLI, Cursor, or similar tools that can follow markdown instructions.

### Key Use Cases

1. Initialize a new vault or connect an existing Obsidian vault without moving user content.
2. Ingest a source file or URL and create linked source, entity, concept, and summary notes.
3. Ask a question and receive an answer grounded in vault notes with Obsidian links as citations.
4. Save a conversation, braindump, or research session as structured markdown with tags and frontmatter.
5. Run a vault health check for broken links, orphans, stale indexes, missing citations, and content gaps.
6. Configure local and cloud LLM providers, then switch between models for chat, embeddings, and research.
7. Review staged AI-created note changes before applying them to the vault.
8. Use Git or filesystem sync to version and recover the vault without vendor lock-in.

## Requirements

### MVP Requirements

- User can initialize an Obsidian-compatible markdown vault with recommended folders, templates, metadata, and agent instructions.
- User can connect an existing vault without moving notes or changing source files without approval.
- User can configure at least one local model provider and one OpenAI-compatible cloud provider.
- User can store provider settings without writing secrets into markdown notes, logs, or exported knowledge files.
- User can index markdown notes for hybrid lexical and semantic retrieval.
- User can chat with the vault and receive answers that link to the underlying notes or source records.
- User can ingest a source file or URL into structured markdown pages for sources, entities, concepts, and summaries.
- User can save a conversation, braindump, or research result into a dated vault note with tags and frontmatter.
- User can run a vault health check that reports orphan notes, broken wikilinks, stale indexes, and missing source citations.
- User can review staged AI-created note changes before they are applied to the vault.
- User can resume recent context through a hot cache or saved chat state between sessions.
- User can run agent commands from markdown-accessible surfaces such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or compatible skill files.
- User can export, copy, or version the vault with standard filesystem and Git workflows.
- Developer can run build, type check, lint, and test commands locally.

### Deferred Requirements

- User can create visual canvas boards and smart graph layouts from vault notes.
- User can run multi-agent batch ingestion across many sources in parallel.
- User can process meeting transcripts, team briefs, issue tracker activity, and release notes into vault summaries.
- User can publish selected markdown outputs to Confluence, Notion, Slack, or other team surfaces.
- User can receive similar-note recommendations and predictive note placement suggestions.
- User can ingest images, PDFs, audio, or video beyond the MVP source formats.
- User can share a selective read-only vault view without exposing the whole vault.
- Developer can publish installable packages for multiple agent ecosystems from the same source.

## Non-Functional Requirements

- **Performance**: For a 5,000-note markdown vault on a current laptop, the plugin UI remains interactive within 3 seconds of startup and warm retrieval returns results within 2 seconds at p95.
- **Indexing**: Initial indexing for a 5,000-note markdown vault completes within 15 minutes and runs in the background with visible progress.
- **Security**: Automated workflows write zero provider secrets or API keys into markdown notes, logs, Git-tracked examples, or generated exports.
- **Privacy**: 100% of vault content remains local unless the user explicitly enables a cloud provider for a specific workflow.
- **Reliability**: 100% of automated note mutations are staged, diffable, or backed by a recoverable previous state before they are applied.
- **Accessibility**: Plugin UI controls meet WCAG 2.1 AA contrast and keyboard navigation requirements before MVP release.
- **Data Portability**: 100% of user-authored and AI-generated durable knowledge is readable as local markdown, JSON, or Obsidian canvas files without running the app.
- **Quality**: Build, type check, lint, unit tests, and integration tests pass before release artifacts are published.

## Constraints and Dependencies

- The vault must remain compatible with Obsidian markdown, wikilinks, frontmatter, attachments, and `.canvas` files where used.
- The MVP must not require an external database or hosted backend for core note access.
- Local-first operation depends on users installing and configuring a local model runtime when they do not want cloud inference.
- Existing vault content must be treated as user-owned and must not be overwritten by framework updates.
- Agent surfaces must be markdown-readable because Codex, Claude Code, Gemini CLI, Cursor, and other tools expose different native plugin systems.
- Retrieval quality depends on note structure, source coverage, embedding model quality, and index freshness.
- Source examples are treated as product evidence, not as a mandate to clone every feature in the first release.

## Phases

This system delivers the product via phases. Each phase is implemented via multiple 2-4 hour sessions (12-25 tasks each).

| Phase | Name | Sessions | Status |
|-------|------|----------|--------|
| 00 | Foundation | 6 | Complete |
| 01 | Vault Intelligence MVP | TBD | Not Started |
| 02 | Agentic Maintenance | TBD | Not Started |
| 03 | Offline and Provider Hardening | TBD | Not Started |
| 04 | Distribution and Ecosystem | TBD | Not Started |

## Phase 00: Foundation

Phase 00 is complete and archived in `.spec_system/archive/phases/phase_00/`.

### Objectives

1. Define the product structure, repository shape, security model, and privacy boundaries.
2. Scaffold the Obsidian plugin shell, agent markdown surface, and local scripts needed for MVP development.
3. Establish the vault data model for sources, concepts, entities, conversations, hot cache, logs, and staged changes.
4. Set up build, type-checking, linting, test fixtures, and release validation.

### Sessions

| Session | Name | Objective |
|---------|------|-----------|
| 01 | Repository and Tooling Scaffold | Create the initial Obsidian plugin repository scaffold and local validation toolchain. |
| 02 | Vault Data Model | Define durable markdown and JSON contracts for vault intelligence objects. |
| 03 | Provider Privacy Boundaries | Implement provider, model capability, trust, and secret-handling boundaries. |
| 04 | Indexing and Retrieval Foundation | Create indexing and retrieval service foundations for grounded vault workflows. |
| 05 | Agent Surfaces and Commands | Create synchronized markdown agent surfaces and local command scripts. |
| 06 | Staged Changes and Health Foundation | Implement staged-change and vault-health primitives for reviewable AI note mutations. |

## Technical Stack

- TypeScript - primary implementation language for Obsidian plugin and shared runtime logic.
- Svelte - plugin UI components and reactive views, matching the Smart2Brain example stack.
- Obsidian API - vault I/O, metadata cache, commands, settings, and plugin lifecycle.
- Vite - plugin bundling and development builds.
- Vitest - unit and integration testing for provider, retrieval, store, and vault behavior.
- Svelte Check - Svelte and TypeScript validation.
- Biome - formatting and linting for TypeScript source.
- LangChain and LangGraph - provider abstraction, agent orchestration, and tool execution where justified.
- Local lexical and vector indexes - hybrid retrieval over markdown notes without a required external database.
- Markdown, JSON, and Git - durable vault data, agent instructions, manifests, logs, and version history.
- Shell scripts - setup, validation, and update workflows for local developer and user automation.

## Success Criteria

- [ ] New user can initialize or connect a vault in under 10 minutes using documented steps.
- [ ] User can ask a vault question and receive an answer with at least two vault citations.
- [ ] User can ingest one source and get structured source, entity, concept, and summary notes.
- [ ] User can review all AI-proposed note mutations before applying them.
- [ ] User can complete a local-model chat workflow without sending vault content to a cloud provider.
- [ ] Vault health check catches broken links and orphan notes in a fixture vault.
- [ ] Build, type check, lint, unit tests, and integration tests pass locally and in CI.
- [ ] Documentation explains privacy behavior, provider setup, recovery, and framework updates.

## Risks

- **Obsidian runtime edge cases**: File watching, workspace views, and metadata cache behavior may differ by vault size or platform. Mitigate with fixture vaults and integration tests.
- **Retrieval quality is inconsistent**: Semantic search may miss exact facts and lexical search may miss concepts. Mitigate with hybrid retrieval, citations, and query diagnostics.
- **Privacy mistakes are high impact**: Provider calls or logs may leak vault content. Mitigate with explicit provider boundaries, secret storage rules, and tests around outbound calls.
- **AI writes can damage user trust**: Automated edits may be wrong or unwanted. Mitigate with staged diffs, backups, and no destructive default behavior.
- **Scope can sprawl across plugin, skills, research, and team workflows**: Mitigate by keeping Phase 00 and Phase 01 focused on the local vault MVP.
- **Local model performance varies widely**: Mitigate with capability detection, model recommendations, and cloud opt-in fallback.
- **Framework updates can conflict with personal vault content**: Mitigate with update scripts that separate framework files from user notes and require review for conflicts.

## Assumptions

- Users are comfortable using an Obsidian-style markdown vault.
- MVP can be delivered in a single repository as an Obsidian plugin plus markdown agent instructions and local scripts.
- A local provider such as Ollama or an OpenAI-compatible local endpoint is acceptable for offline model support.
- The vault, not the vector index or chat runtime, remains the durable source of truth.
- Users can opt into cloud providers when they want stronger models or hosted embeddings.
- Test fixture vaults can cover the most important indexing, retrieval, and mutation workflows.

## Open Questions

1. Should MVP ship as an Obsidian plugin first, an agent skill kit first, or both together?
2. Which providers are mandatory for first release: Ollama, OpenAI, Anthropic, OpenRouter, Gemini, or custom OpenAI-compatible endpoints?
3. Should URL-based web ingestion and autonomous research be MVP requirements or Phase 02 features?
4. What vault size should define the official performance target beyond the initial 5,000-note assumption?
5. Which source formats must be supported in MVP: markdown, PDF, web pages, images, audio, or video?
6. Should Git sync be built into the product or documented as an external workflow?
7. Which Obsidian community plugins, if any, can the product assume users have installed?
8. What final product name, license, and distribution channels should be used for release?
