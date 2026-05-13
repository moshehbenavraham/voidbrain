# Architecture

## System Overview

Voidbrain is a local-first Obsidian-style AI second-brain scaffold. The vault is
the durable source of truth, while the plugin and supporting services provide
retrieval, provider abstraction, staged writes, and agent-readable workflows.

## Dependency Graph

```text
Obsidian vault -> src/main.ts -> domain services -> local indexes / staged records
                                      |               |
                                      v               v
                                 provider guards   fixture-safe tests
```

## Components

### Obsidian Composition Root

- **Purpose**: Owns plugin lifecycle wiring, commands, views, and runtime setup.
- **Location**: `src/main.ts`
- **Notes**: Keep Obsidian-specific integration here and delegate domain logic to
  testable services.

### Staged Change Review and Apply

- **Purpose**: Review proposed note mutations, handle conflicts, and apply
  confirmed changes through an explicit local workflow.
- **Location**: `src/agent/staged-change-review-service.ts`,
  `src/stores/staged-change-review-store.ts`, `src/views/`
- **Notes**: This layer keeps destructive note edits reviewable, reversible, and
  separate from raw vault writes.

### Hot Cache and Recent Context Recovery

- **Purpose**: Persist bounded recent runtime context for reload recovery and
  staged session summaries.
- **Location**: `src/agent/hot-cache-service.ts`,
  `src/stores/hot-cache-store.ts`
- **Notes**: Hot cache records are support artifacts, not durable knowledge, and
  must stay redacted and rebuildable.

### Recover Session Command

- **Purpose**: Build read-only recovery summaries from hot cache, staged-change
  metadata, health reports, operation logs, validation output, and adapter read
  failures.
- **Location**: `src/agent/recover-session-service.ts`, `src/main.ts`
- **Notes**: Recovery emits bounded IDs, paths, diagnostics, and retry or
  discard actions. It never mutates vault notes, rewrites support records, or
  replays provider calls.

### Agent Commands

- **Purpose**: Define the canonical command catalog, surface validation, staged
  change previews, and fixture safety checks.
- **Location**: `src/agent/`
- **Notes**: These modules back the markdown command surfaces in `AGENTS.md`,
  `CLAUDE.md`, `GEMINI.md`, and `skills/voidbrain/SKILL.md`.

### Provider Layer

- **Purpose**: Model provider capabilities, privacy gates, redaction, and
  runtime-only secret handling.
- **Location**: `src/providers/`
- **Notes**: Provider calls must stay explicit, inspectable, and privacy-aware.

### Retrieval and Indexing

- **Purpose**: Parse markdown, build lexical and semantic indexes, and produce
  citation-ready retrieval results.
- **Location**: `src/vectorstore/`
- **Notes**: Retrieval output must preserve vault paths, headings, snippets, and
  source traceability.

### Shared Types and Utilities

- **Purpose**: Define durable contracts and small helpers used across services
  and tests.
- **Location**: `src/types/`, `src/utils/`
- **Notes**: Keep vault path normalization and validation separate from Obsidian
  runtime APIs.

## Tech Stack Rationale

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| TypeScript | Primary application language | Strong contracts for provider, vault, and retrieval code. |
| Svelte | UI components and views | Lightweight UI layer for Obsidian plugin surfaces. |
| Obsidian API | Vault and plugin runtime | Native integration with markdown vaults and metadata cache. |
| Vite | Build pipeline | Fast local builds and plugin bundling. |
| Vitest | Tests | Covers service, provider, retrieval, and fixture behavior. |
| Biome | Format and lint | Fast, consistent code hygiene. |

## Data Layer

- **Source of truth**: Markdown vault files and reviewable staged changes
- **Derived state**: Local indexes, caches, logs, and validation artifacts
- **External storage**: None required for MVP-local behavior

## Data Flow

1. The plugin reads vault content through Obsidian APIs.
2. Domain services validate paths, capabilities, privacy rules, and staged-write
   safety.
3. Retrieval services build citation-ready evidence from local indexes.
4. Staged-change and hot-cache services write bounded support artifacts that can
   be inspected or rebuilt locally.
5. Recover-session service summarizes support artifacts for read-only retry or
   discard decisions.
6. Agent surfaces and docs describe the command and validation workflow.

## Key Decisions

- Preserve the vault as user-owned data.
- Keep provider behavior explicit and reviewable.
- Stage AI-proposed note mutations before applying them.
- Favor local-first, testable services over hidden runtime side effects.

See `.spec_system/CONVENTIONS.md` and `.spec_system/PRD/PRD.md` for the
project-level contract and roadmap.
