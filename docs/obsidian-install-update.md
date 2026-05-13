# Obsidian Install And Update Workflow

Voidbrain installs into a local Obsidian vault as a framework-only plugin
bundle. The deploy workflow copies release artifacts into
`.obsidian/plugins/voidbrain` and does not read, rewrite, delete, stage, or
index user notes.

The command ID for install/update diagnostics is
`voidbrain.deploy-obsidian-plugin`.

## Preview With Dry Run

Use dry run before every local install or update:

```bash
bun run deploy:obsidian -- --dry-run --vault fixtures/demo-vault
```

Dry run is preview-only. It validates the repository, release artifacts, target
plugin path, installed plugin manifest when present, compatibility state, and
rollback intent. It does not build, copy, clean, back up, or mutate vault
files.

Dry-run diagnostics include:

- Command ID.
- Operation kind.
- Target plugin path.
- Repository-relative artifact paths.
- Installed version when an installed plugin manifest exists.
- Incoming version from release metadata.
- Release validation status and issue codes.
- Rollback intent for plugin artifacts only.

## Install

For a real development vault, pass `--vault` explicitly or set
`VOIDBRAIN_DEV_VAULT` in a local `.env` file that is not committed:

```bash
bun run deploy:obsidian -- --vault fixtures/demo-vault
```

The workflow runs `bun run build`, validates release artifacts, builds an
install/update plan, then copies only the release artifact contract:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

If the vault root exists but `.obsidian/` does not, rerun with
`--create-obsidian-folder` only after confirming the path is a synthetic test
vault or an intended development vault.

## Update

When `.obsidian/plugins/voidbrain/manifest.json` already exists, the planner
reads that plugin manifest and classifies the operation as:

- `upgrade` when the incoming version is newer.
- `reinstall` when the versions match.
- `downgrade` when the incoming version is older.
- `invalid-existing-install` when the installed manifest is missing required
  fields, malformed, or belongs to another plugin ID.

Downgrades fail closed by default:

```bash
bun run deploy:obsidian -- --dry-run --vault fixtures/demo-vault
```

After reviewing rollback intent, a downgrade can be allowed explicitly:

```bash
bun run deploy:obsidian -- --allow-downgrade --vault fixtures/demo-vault
```

## Clean Deploy

`--clean` removes only known plugin artifact targets before copying the
incoming release artifacts:

```bash
bun run deploy:obsidian -- --clean --vault fixtures/demo-vault
```

The clean list is bounded to `.obsidian/plugins/voidbrain/main.js`,
`.obsidian/plugins/voidbrain/manifest.json`,
`.obsidian/plugins/voidbrain/styles.css`, and
`.obsidian/plugins/voidbrain/versions.json`.

## Rollback Intent

Rollback details are limited to plugin artifacts. They preserve:

- Command ID.
- Operation kind.
- Target plugin path.
- Artifact paths.
- Installed version.
- Incoming version.
- Release validation output.
- Rollback or backup intent.
- Remediation.

Rollback intent never describes user note backups, vault migrations, staged
note changes, provider credentials, prompt bodies, or private vault content.

## Troubleshooting

Common blocked plan states:

| Issue | Meaning | Retry |
|-------|---------|-------|
| `install.missing-vault-root` | The configured vault root does not exist. | Pass the intended vault root with `--vault`. |
| `install.missing-obsidian-folder` | The vault root has no `.obsidian/`. | Open the vault in Obsidian or use `--create-obsidian-folder` for a test vault. |
| `install.invalid-target-path` | The input path is a plugin folder, traversal path, URL, or unsupported target. | Pass the vault root, not `.obsidian/plugins/voidbrain`. |
| `install.release-validation-failed` | Release artifacts are missing or metadata does not align. | Run `bun run build` and `bun run validate:release-artifacts`. |
| `install.invalid-installed-manifest` | Existing plugin manifest is malformed or belongs to another plugin. | Inspect the plugin folder and remove the invalid framework artifact. |
| `install.downgrade-blocked` | Incoming version is older than installed version. | Review dry-run output, then use `--allow-downgrade` only if intended. |

Keep support records bounded to synthetic paths and plugin artifacts. Do not
paste provider secrets, authorization headers, prompt bodies, hidden provider
state, private vault content, or private machine paths into issue reports.
