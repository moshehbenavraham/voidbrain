# Source Layout

The plugin keeps Obsidian lifecycle wiring in `src/main.ts` and groups durable logic by domain. Future sessions should add code in the folders below instead of mixing runtime glue, UI, and services in one module.

## Domain Folders

| Folder | Owner | Notes |
|--------|-------|-------|
| `agent/` | Agent orchestration, prompts, tool calls, and thread state | Keep provider calls behind explicit privacy checks. |
| `providers/` | Provider definitions, model capabilities, auth state, and invocation adapters | Do not store secrets in markdown, fixtures, or logs. |
| `vectorstore/` | Embedding indexes, local vector persistence, and semantic retrieval helpers | Key indexes by embedding model compatibility. |
| `stores/` | Cross-view Svelte stores and typed state facades | Keep long-running work in services, not components. |
| `views/` | Obsidian item views, settings tabs, and modal composition roots | Keep view classes thin and delegate domain behavior. |
| `components/` | Reusable Svelte UI components | Use Obsidian CSS variables and keyboard-accessible controls. |
| `utils/` | Small shared helpers with no Obsidian lifecycle ownership | Prefer pure functions that are easy to test. |
| `types/` | Public contracts shared across services, views, and tests | Avoid secret-bearing fields in durable types. |

## Vault Data Model Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `types/vault.ts` | Durable vault artifact contracts | Defines generated note frontmatter, support JSON records, branded vault paths, wikilinks, timestamps, and validation result shapes. |
| `utils/vault-paths.ts` | Vault-relative path rules | Normalizes untrusted path input and rejects unsafe or unsupported artifact locations before runtime I/O. |
| `utils/vault-validation.ts` | Durable record validation | Validates generated note frontmatter and JSON support records without importing Obsidian runtime APIs. |

The vault data model is contract-first. Later ingestion, indexing, provider, and
staged-write services should import these contracts rather than redefining
artifact kinds or support record shapes.

## Provider Privacy Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `types/providers.ts` | Provider, model, disclosure, secret reference, and redacted diagnostic contracts | Avoid raw secret-bearing fields in durable provider types. |
| `providers/provider-registry.ts` | Synthetic provider metadata and deterministic lookup helpers | Keep metadata free of real endpoints, credentials, and personal vault content. |
| `providers/capability-selection.ts` | Capability preflight before provider invocation | Check chat, embeddings, streaming, tools, and attachments before adapters run. |
| `providers/privacy-guard.ts` | Local-first disclosure and invocation policy | Run before retrieval synthesis, embedding creation, chat, and agent tool execution. |
| `providers/secret-store.ts` | Secret references and runtime-only secret storage interfaces | Persist opaque references only; never write raw secrets to markdown or logs. |
| `providers/redaction.ts` | Recursive diagnostic redaction | Redact diagnostics before logging, test snapshots, or user-facing agent surfaces. |

Provider services must stay testable outside the Obsidian runtime. Runtime
commands, views, retrieval jobs, and future agent workflows should call the
privacy guard and capability selector before constructing a provider request.

## Boundaries

- Use Obsidian vault and adapter APIs for runtime file access.
- Treat persisted settings and vault content as untrusted input until validated.
- Stage generated note mutations before applying them to user vault files.
- Keep fixtures synthetic and separate from real user vault content.
- Keep provider secrets behind opaque references and redacted diagnostics.
- Add tests next to the behavior they protect under `test/`.
