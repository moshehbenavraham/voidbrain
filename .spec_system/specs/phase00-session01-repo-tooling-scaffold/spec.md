# Session Specification

**Session ID**: `phase00-session01-repo-tooling-scaffold`
**Phase**: 00 - Foundation
**Status**: Completed
**Created**: 2026-05-12

---

## 1. Session Overview

This session creates the initial Obsidian plugin repository scaffold and local validation toolchain for the AI second-brain product. It turns the existing PRD, UX PRD, and Phase 00 plan into a runnable TypeScript/Svelte plugin shell that future sessions can extend without first solving repository setup.

The work is deliberately foundational: package scripts, compiler and bundler configuration, linting, testing, a minimal Obsidian manifest, a lifecycle entrypoint, and source/test boundaries that match `CONVENTIONS.md`. No provider, retrieval, ingestion, or staged-write product behavior is implemented here beyond typed seams and safe defaults.

This is the first Phase 00 implementation session. It enables later vault data model, provider privacy, indexing, agent surface, and staged-change sessions by making build, type check, lint, and unit test commands available from the start.

---

## 2. Objectives

1. Create a Bun-first Obsidian plugin scaffold with `package.json`, lockfile, and local validation scripts.
2. Configure strict TypeScript, Svelte, Vite, Vitest, and Biome for a local-first plugin runtime.
3. Add a minimal Obsidian manifest and lifecycle entrypoint that loads and unloads cleanly.
4. Establish domain-first source and test structure aligned with project conventions.

---

## 3. Prerequisites

### Required Sessions
- None - this is the first implementation session in Phase 00.

### Required Tools/Knowledge
- Bun or compatible Node package tooling for dependency install and script execution.
- Obsidian plugin development basics: `manifest.json`, `Plugin.onload`, `Plugin.onunload`, and bundled `main.js`.
- TypeScript, Svelte, Vite, Vitest, and Biome configuration.

### Environment Requirements
- Local shell with package install access.
- No provider secrets, personal vault content, or real user data required.
- Upstream reference repositories linked from the PRD, with any local `EXAMPLES/`
  copies treated as ignored research input.

---

## 4. Scope

### In Scope (MVP)
- Developer can run build, type check, lint, and test commands locally - implement package scripts and configuration files.
- Developer can compile a minimal Obsidian plugin shell - add manifest, Vite output, and lifecycle entrypoint.
- Developer can add future domain code in predictable locations - create source layout documentation and typed boundaries.
- Developer can verify the toolchain without Obsidian running - add Vitest setup, Obsidian mock, and lifecycle test.
- Automated workflows write zero provider secrets or user vault content into tracked files - keep fixtures and examples empty or synthetic.

### Out of Scope (Deferred)
- Full provider implementations - deferred to `phase00-session03-provider-privacy-boundaries`.
- Vault data contracts and fixture vault content - deferred to `phase00-session02-vault-data-model`.
- Retrieval, indexing, semantic search, or graph behavior - deferred to `phase00-session04-indexing-retrieval-foundation`.
- Complete plugin UI workflows - deferred to later MVP sessions after services and contracts exist.
- Agent markdown command surfaces beyond this planning artifact - deferred to `phase00-session05-agent-surfaces-commands`.

---

## 5. Technical Approach

### Architecture

Use a thin Obsidian composition root in `src/main.ts` and keep durable logic outside the plugin lifecycle. The initial scaffold should register only minimal commands or notices needed to prove lifecycle wiring, then clean up through Obsidian registration APIs on unload. Domain folders remain explicit so future sessions can add services without moving code.

The build should emit an Obsidian-compatible CommonJS `main.js` and `styles.css`, while treating Obsidian, Electron, CodeMirror, and Node built-ins as externals. Tests should run outside Obsidian with explicit mocks so service logic remains testable in Vitest.

### Design Patterns
- Composition root: Keep Obsidian runtime wiring in `src/main.ts`.
- Domain-first layout: Reserve `agent/`, `providers/`, `vectorstore/`, `stores/`, `views/`, `components/`, and `utils/`.
- Explicit contracts: Use typed settings and plugin metadata rather than untyped placeholders.
- Local-first safety: Keep secrets and user vault content out of tracked files and fixtures.

### Technology Stack
- TypeScript 5.x for strict typed plugin code.
- Svelte 5.x with Svelte Check 4.x for future plugin views.
- Obsidian API 1.x for plugin lifecycle and runtime types.
- Vite 7.x with `@sveltejs/vite-plugin-svelte` 5.x for bundling.
- Vitest 4.x with jsdom for unit tests.
- Biome 1.x for formatting and linting.
- Bun 1.x package workflow inferred from the Smart2Brain example lockfile.

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `package.json` | Package metadata, dependencies, and validation scripts | ~70 |
| `bun.lock` | Committed dependency lockfile | generated |
| `tsconfig.json` | Strict TypeScript compiler settings | ~35 |
| `svelte.config.ts` | Svelte preprocessing configuration | ~15 |
| `vite.config.ts` | Obsidian plugin bundling configuration | ~70 |
| `vitest.config.ts` | Unit test configuration | ~25 |
| `biome.json` | Format and lint rules | ~30 |
| `manifest.json` | Obsidian plugin manifest | ~10 |
| `versions.json` | Obsidian compatibility version map | ~5 |
| `src/main.ts` | Minimal plugin lifecycle entrypoint | ~80 |
| `src/types/plugin.ts` | Plugin settings and metadata contracts | ~45 |
| `src/utils/settings.ts` | Settings validation and default merge helper | ~70 |
| `src/README.md` | Domain folder ownership guide | ~40 |
| `src/styles.css` | Minimal Obsidian-theme-compatible style entry | ~20 |
| `test/setup.ts` | Vitest globals and deterministic test setup | ~35 |
| `test/__mocks__/obsidian.ts` | Explicit Obsidian runtime mock | ~90 |
| `test/plugin-lifecycle.test.ts` | Minimal lifecycle and settings tests | ~80 |
| `.spec_system/specs/phase00-session01-repo-tooling-scaffold/implementation-notes.md` | Implementation evidence and validation results | ~80 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `.gitignore` | Ignore dependency, build, coverage, and local Obsidian outputs while preserving examples ignore rule | ~15 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Developer can install dependencies and run `build`, `check`, `lint`, and `test` scripts.
- [ ] Obsidian plugin entrypoint compiles without `any` placeholders or unresolved imports.
- [ ] Source folders match domain-first naming from `CONVENTIONS.md`.
- [ ] The scaffold contains no provider secrets, real user vault content, or personal fixture data.

### Testing Requirements
- [ ] Unit tests written and passing for lifecycle/settings behavior.
- [ ] Build, type check, lint, and test commands run successfully or documented blockers are recorded.
- [ ] Manual review confirms generated files are appropriate for an Obsidian plugin scaffold.

### Non-Functional Requirements
- [ ] Build, type check, lint, unit tests, and local validation are available before feature work.
- [ ] Automated workflows write zero provider secrets or API keys into markdown, logs, fixtures, or examples.
- [ ] Plugin lifecycle owns registered runtime resources and releases them on unload.

### Quality Gates
- [ ] All files ASCII-encoded.
- [ ] Unix LF line endings.
- [ ] Code follows project conventions.

---

## 8. Implementation Notes

### Key Considerations
- Keep the first scaffold intentionally small so later sessions add data, provider, retrieval, and mutation behavior in their own specs.
- Do not copy large Smart2Brain implementation code; use the example only to infer stack, script shape, and Obsidian bundling patterns.
- Commit a lockfile once dependencies are installed, matching the package manager decision.
- `.gitignore` should preserve the existing `EXAMPLES/` ignore behavior while adding normal generated outputs.

### Potential Challenges
- Dependency versions may drift from examples: use current compatible versions only when installation succeeds and record any adjustments.
- Obsidian runtime types are hard to execute directly: use explicit Vitest mocks and keep lifecycle assertions narrow.
- Vite output must remain compatible with Obsidian: externalize Obsidian, Electron, CodeMirror, and Node built-ins.
- Empty domain folders are not tracked by Git: use a source layout README and concrete entry files where useful instead of empty directories.

### Behavioral Quality Focus
Checklist active: Yes

Top behavioral risks for this session:
- Plugin lifecycle leaks registered commands, views, or intervals after unload.
- Settings loaders accept malformed persisted data and create unsafe defaults.
- Tooling examples accidentally include provider secrets or personal vault content.
- Future sessions lose time because scripts exist but do not actually run together.

---

## 9. Testing Strategy

### Unit Tests
- Test default settings merging and invalid persisted settings fallback.
- Test plugin lifecycle load/unload with an explicit Obsidian mock.

### Integration Tests
- Use local script execution as the integration gate: build, type check, lint, and unit tests.
- Do not add Obsidian desktop integration tests in this session.

### Manual Testing
- Review generated `manifest.json`, Vite output settings, and package scripts against Obsidian plugin expectations.
- Confirm no tracked file contains secrets or real vault content.

### Edge Cases
- Missing persisted settings should fall back to local-first defaults.
- Malformed settings should not crash plugin load.
- Plugin unload should be safe even if load only partially completed.
- Generated build, coverage, and local plugin outputs should not be tracked.

---

## 10. Dependencies

### External Libraries
- `obsidian`: Runtime API and plugin typings.
- `typescript`: Strict compilation.
- `svelte` and `@sveltejs/vite-plugin-svelte`: Future UI component support.
- `vite`: Obsidian plugin bundle generation.
- `vitest` and `jsdom`: Unit testing outside Obsidian.
- `@biomejs/biome`: Formatting and linting.
- `builtin-modules`: Vite external list support.

### Other Sessions
- **Depends on**: None.
- **Depended by**: `phase00-session02-vault-data-model`, `phase00-session03-provider-privacy-boundaries`, `phase00-session04-indexing-retrieval-foundation`, `phase00-session05-agent-surfaces-commands`, `phase00-session06-staged-changes-health-foundation`.

---

## Next Steps

Run the implement workflow step to begin AI-led implementation.
