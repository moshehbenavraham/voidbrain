#!/usr/bin/env bash
# Local apex-spec entry point. Keep the implementation in scripts/ so the
# validate fallback path works even when .spec_system/scripts is absent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec bash "$REPO_ROOT/scripts/analyze-project.sh" "$@"
