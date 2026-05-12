# Session 05: Agent Surfaces and Commands

**Session ID**: `phase00-session05-agent-surfaces-commands`
**Status**: Complete
**Completed**: 2026-05-13
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Create synchronized markdown agent surfaces and local command scripts that let
Codex, Claude Code, Gemini CLI, and similar tools operate on the vault safely.

---

## Scope

### In Scope (MVP)

- Repository-level agent instructions for supported workflows
- Markdown command tables for ingest, chat, health check, staging, and recovery
- Skill or command directory scaffold where appropriate
- Local scripts for validation, fixture checks, and safe framework updates
- Documentation sync checks to keep agent surfaces aligned with implemented
  behavior

### Out of Scope

- Publishing packages for multiple agent ecosystems
- Autonomous multi-agent batch ingestion
- Integrations with Slack, Notion, Confluence, or issue trackers

---

## Prerequisites

- [x] Repository scaffold and vault data contracts exist
- [x] Privacy and staged write rules are documented enough for agents to follow

---

## Deliverables

1. Agent-readable instructions for core MVP workflows
2. Command and script scaffolds with safe defaults
3. Validation check for stale or contradictory agent documentation
4. Examples that avoid real user content and provider secrets

---

## Success Criteria

- [x] Agent surfaces describe only implemented or explicitly planned behavior
- [x] Commands preserve local-first and staged-write defaults
- [x] Documentation checks catch missing or stale workflow references
- [x] Examples are safe to commit and contain no real secrets or personal data
