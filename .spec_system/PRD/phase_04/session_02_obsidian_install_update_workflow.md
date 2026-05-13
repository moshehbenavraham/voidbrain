# Session 02: Obsidian Install and Update Workflow

**Session ID**: `phase04-session02-obsidian-install-update-workflow`
**Status**: Not Started
**Estimated Tasks**: ~12-25
**Estimated Duration**: 2-4 hours

---

## Objective

Make local install, update, rollback, compatibility, and troubleshooting
workflows inspectable and vault-safe for Obsidian users.

---

## Scope

### In Scope (MVP)

- Harden local deploy or install scripts for plugin artifacts, target vault
  plugin directories, compatibility checks, and rollback guidance.
- Ensure install and update flows do not move, rewrite, or delete user vault
  notes.
- Add diagnostics for command ID, target path, artifact path, backup or
  rollback intent, validation output, and recovery guidance.
- Update installation, update, troubleshooting, and compatibility docs.

### Out of Scope

- Automatic marketplace installation.
- Syncing or migrating user vault content.
- Auto-applying AI-proposed note changes during install or update.

---

## Prerequisites

- [ ] Session 01 release artifacts are available.
- [ ] Existing `deploy:obsidian` or equivalent local deployment script is
      available for inspection.
- [ ] Fixture-safe install examples can use fake vault paths only.

---

## Deliverables

1. Vault-safe local install and update checks.
2. Rollback and compatibility diagnostics.
3. Updated user-facing installation and troubleshooting docs.

---

## Success Criteria

- [ ] Install and update flows validate artifacts and target plugin paths
      before copying release files.
- [ ] Existing user notes and vault data are not modified by distribution
      tooling.
- [ ] Recovery details include target path, artifact path, command ID,
      validation output, and rollback intent where applicable.
- [ ] Docs use synthetic paths and avoid secrets or private vault examples.
