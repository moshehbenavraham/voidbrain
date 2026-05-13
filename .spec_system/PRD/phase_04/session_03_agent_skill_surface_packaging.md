# Session 03: Agent Skill and Surface Packaging

**Session ID**: `phase04-session03-agent-skill-surface-packaging`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Package AGENTS, CLAUDE, GEMINI, skills, and command catalogs for agent
ecosystem reuse with synchronized, fixture-safe validation.

---

## Scope

### In Scope (MVP)

- Audit agent-facing markdown surfaces, command catalogs, skill docs, and human
  docs for distribution readiness and command status drift.
- Add or harden packaging checks that ensure implemented command IDs, safety
  language, provider review rules, fixture paths, and dry-run wording stay
  synchronized.
- Define packageable agent-surface outputs that exclude user vault content and
  provider secrets.
- Update docs for installing or reusing Voidbrain agent surfaces across
  compatible tools.

### Out of Scope

- Publishing to hosted agent marketplaces.
- Adding new agent command behavior.
- Embedding real vault content, credentials, private paths, or provider state in
  examples.

---

## Prerequisites

- [ ] Sessions 01-02 distribution metadata and install workflow decisions are
      available.
- [ ] Existing `voidbrain.validate-agent-surfaces`,
      `validate:fixture-safety`, and `validate:agent-docs` checks are
      available.
- [ ] Agent surface files are synchronized with implemented command behavior.

---

## Deliverables

1. Agent-surface packaging and validation rules.
2. Updated packageable markdown surfaces and command docs.
3. Distribution docs for compatible agent ecosystems.

---

## Success Criteria

- [ ] Agent surfaces, command catalogs, skills, and docs reference only
      implemented command IDs and current safety behavior.
- [ ] Packageable outputs exclude user vault content, private paths, provider
      secrets, authorization headers, prompt bodies, and hidden provider state.
- [ ] Fixture-safety and agent-doc validation pass.
- [ ] Installation or reuse docs are clear and use synthetic examples only.
