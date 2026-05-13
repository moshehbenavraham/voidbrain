# Validation

**Session ID**: `phase03-session03-provider-transport-invocation-boundaries`
**Validated**: 2026-05-13 13:07
**Status**: Passed

---

## Commands

| Command | Result | Notes |
|---------|--------|-------|
| `bun run validate:agent-surfaces` | Passed | Agent surface validation passed. Surfaces checked: 5. Commands checked: 7. |
| `bun run validate:fixture-safety` | Passed | Fixture safety validation passed. Files checked: 59. |
| `bun run validate:agent-docs` | Passed | Agent surfaces and fixture safety both passed. |
| `bun run validate` | Passed | Build passed, svelte-check found 0 errors and 0 warnings, Biome checked 151 files, Vitest passed 32 files and 207 tests, agent docs passed. |

## Focused Regression Run

| Command | Result | Notes |
|---------|--------|-------|
| `bun run test test/source-ingestion-staging.test.ts` | Passed | The duplicate-source regression was made deterministic by waiting for the provider extractor to start before asserting the in-flight denial. |
| `bun run test test/provider-transport-invocation-boundaries.test.ts test/grounded-vault-chat.test.ts test/indexing-runtime-retrieval-readiness.test.ts test/source-ingestion-staging.test.ts` | Passed | 4 test files and 25 tests passed after fixture-safety and type-check fixes. |

## Encoding Checks

| Check | Result | Notes |
|-------|--------|-------|
| ASCII sweep | Passed | `rg --pcre2 -n "[^\x00-\x7F]"` found no matches across tracked changes and new files. |
| LF sweep | Passed | `rg -n "\r"` found no CRLF characters across tracked changes and new files. |

## Residual Failures

None.

## Recovery Fields

| Field | Value |
|-------|-------|
| Command ID | `voidbrain.provider-transport-invocation-boundaries` |
| Target Path | `test/source-ingestion-staging.test.ts` |
| Cache Path | N/A |
| Staged Change ID | N/A |
| Report ID | `phase03-session03-provider-transport-invocation-boundaries-validation` |
| Validation Output | Full validation passed on 2026-05-13 13:07 with 207 tests. |

---
