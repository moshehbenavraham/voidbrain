# Session 01: Repository and Tooling Scaffold

**Session ID**: `phase00-session01-repo-tooling-scaffold`
**Status**: Complete
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Create the initial Obsidian plugin repository scaffold and local validation
toolchain so future sessions can add typed, testable product code.

---

## Scope

### In Scope (MVP)

- Package manifest and script commands for build, lint, type check, and test
- TypeScript, Svelte, Vite, Vitest, and Biome configuration
- Obsidian plugin manifest, entrypoint, and lifecycle skeleton
- Domain-first source directory layout
- Minimal fixture and test setup proving the toolchain runs

### Out of Scope

- Full provider implementations
- Retrieval behavior beyond placeholder service boundaries
- Complete plugin UI workflows

---

## Prerequisites

- [x] Phase 00 PRD and session stubs exist
- [x] Target package manager decision is confirmed or inferred from examples

---

## Deliverables

1. Runnable local developer scripts for build, lint, type check, and test
2. Obsidian plugin shell with clean load and unload lifecycle boundaries
3. Initial source tree matching repository conventions
4. Minimal passing test proving the toolchain is wired correctly

---

## Success Criteria

- [x] Developer can install dependencies and run validation commands
- [x] Plugin entrypoint compiles without using untyped placeholders
- [x] Source folders match the domain structure in `CONVENTIONS.md`
- [x] No provider secrets or user vault content appear in tracked fixtures
