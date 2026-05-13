#!/usr/bin/env bash
# Analyze Apex Spec project state for validate/updateprd workflows.

set -euo pipefail

OUTPUT_MODE="human"
PACKAGE_FILTER=""

log_error() {
    printf '[ERROR] %s\n' "$*" >&2
}

show_usage() {
    cat <<'EOF'
Usage: analyze-project.sh [OPTIONS]

Analyze Apex Spec project state.

OPTIONS:
  --json              Output structured JSON for workflow validation
  --package PATH      Resolve or filter by package path/name in monorepo mode
  --help, -h          Show this help message

The JSON output is deterministic for a fixed repository state and includes the
fields used by the apex-spec validate flow: current_session,
current_session_dir_exists, current_session_files, monorepo, packages, and
active_package.
EOF
}

require_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq is required to analyze project state"
        exit 1
    fi
}

find_repo_root() {
    local dir="$PWD"

    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.spec_system/state.json" ]]; then
            printf '%s\n' "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    dir="$script_dir"

    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.spec_system/state.json" ]]; then
            printf '%s\n' "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done

    log_error "Could not find .spec_system/state.json"
    return 1
}

to_absolute_path() {
    local path="$1"
    local base="$2"

    if [[ "$path" = /* ]]; then
        printf '%s\n' "$path"
    else
        printf '%s/%s\n' "$base" "$path"
    fi
}

json_get() {
    local filter="$1"
    jq -r "$filter" "$STATE_FILE"
}

get_monorepo_flag() {
    jq -r 'if .monorepo == true then "true" elif .monorepo == false then "false" else "null" end' "$STATE_FILE"
}

get_packages_json() {
    jq -c '.packages // []' "$STATE_FILE"
}

get_completed_sessions_json() {
    jq -c '(.completed_sessions // []) | map(if type == "object" then .id else . end)' "$STATE_FILE"
}

is_session_number_completed() {
    local phase="$1"
    local session_number="$2"
    local pattern
    pattern="$(printf 'phase%02d-session%02d' "$phase" "$session_number")"

    jq -e --arg pattern "$pattern" '
        (.completed_sessions // [])
        | map(if type == "object" then .id else . end)
        | any(startswith($pattern))
    ' "$STATE_FILE" >/dev/null
}

resolve_active_package_json() {
    local monorepo_flag="$1"
    local packages_json="$2"

    if [[ "$monorepo_flag" != "true" ]]; then
        printf 'null\n'
        return 0
    fi

    if [[ -n "$PACKAGE_FILTER" ]]; then
        jq -c --arg pkg "$PACKAGE_FILTER" --argjson packages "$packages_json" '
            ($packages | map(select(.path == $pkg or .name == $pkg)) | .[0])
            // {
                name: ($pkg | split("/") | last),
                path: $pkg,
                stack_hint: "unknown"
            }
        ' <<<"{}"
        return 0
    fi

    local rel_cwd
    if [[ "$PWD" == "$REPO_ROOT" ]]; then
        printf 'null\n'
        return 0
    fi

    rel_cwd="${PWD#"$REPO_ROOT"/}"
    jq -c --arg cwd "$rel_cwd" --argjson packages "$packages_json" '
        $packages
        | map(select($cwd == .path or ($cwd | startswith(.path + "/"))))
        | sort_by(.path | length)
        | reverse
        | .[0] // null
    ' <<<"{}"
}

detect_monorepo_json() {
    if [[ -f "$REPO_ROOT/pnpm-workspace.yaml" ]]; then
        jq -n '{detected: true, indicator: "pnpm-workspace.yaml", packages: []}'
    elif [[ -f "$REPO_ROOT/package.json" ]] && jq -e '.workspaces' "$REPO_ROOT/package.json" >/dev/null 2>&1; then
        jq -n '{detected: true, indicator: "package.json workspaces", packages: []}'
    elif [[ -f "$REPO_ROOT/turbo.json" ]]; then
        jq -n '{detected: true, indicator: "turbo.json", packages: []}'
    elif [[ -f "$REPO_ROOT/nx.json" ]]; then
        jq -n '{detected: true, indicator: "nx.json", packages: []}'
    elif [[ -f "$REPO_ROOT/Cargo.toml" ]] && grep -q '^\[workspace\]' "$REPO_ROOT/Cargo.toml"; then
        jq -n '{detected: true, indicator: "Cargo.toml workspace", packages: []}'
    elif [[ -f "$REPO_ROOT/go.work" ]]; then
        jq -n '{detected: true, indicator: "go.work", packages: []}'
    elif [[ -f "$REPO_ROOT/lerna.json" ]]; then
        jq -n '{detected: true, indicator: "lerna.json", packages: []}'
    else
        jq -n '{detected: false, indicator: null, packages: []}'
    fi
}

build_phases_json() {
    jq -c '
        (.phases // {})
        | to_entries
        | sort_by(.key | tonumber)
        | map({
            number: (.key | tonumber),
            name: (.value.name // ""),
            status: (.value.status // ""),
            session_count: (.value.session_count // 0)
        })
    ' "$STATE_FILE"
}

read_package_annotation() {
    local file="$1"
    local value
    value="$(
        sed -n '1,10{s/^\*\{0,2\}Package\*\{0,2\}:[[:space:]]*//p;}' "$file" \
            | head -n 1
    )"
    printf '%s\n' "$value"
}

build_candidate_sessions_json() {
    local current_phase="$1"
    local prd_dir="$SPEC_SYSTEM_DIR/PRD/phase_$(printf '%02d' "$current_phase")"
    local candidates_json="[]"

    if [[ ! -d "$prd_dir" ]]; then
        printf '%s\n' "$candidates_json"
        return 0
    fi

    while IFS= read -r file; do
        local filename basename session_number_raw session_number session_name completed package_annotation
        filename="$(basename "$file" .md)"

        if [[ ! "$filename" =~ ^session_([0-9]+)_(.+)$ ]]; then
            continue
        fi

        session_number_raw="${BASH_REMATCH[1]}"
        session_number="$((10#$session_number_raw))"
        session_name="${BASH_REMATCH[2]}"
        completed="false"
        if is_session_number_completed "$current_phase" "$session_number"; then
            completed="true"
        fi

        package_annotation="$(read_package_annotation "$file")"
        basename="$(basename "$file")"

        candidates_json="$(
            jq -c \
                --arg file "$filename" \
                --arg path "${file#"$REPO_ROOT"/}" \
                --arg basename "$basename" \
                --argjson session_number "$session_number" \
                --arg name "$session_name" \
                --argjson completed "$completed" \
                --arg package_annotation "$package_annotation" \
                '. + [{
                    file: $file,
                    basename: $basename,
                    path: $path,
                    session_number: $session_number,
                    name: $name,
                    completed: $completed,
                    package: (if $package_annotation == "" then null else $package_annotation end)
                }]' <<<"$candidates_json"
        )"
    done < <(find "$prd_dir" -maxdepth 1 -type f -name 'session_*.md' | sort)

    if [[ -n "$PACKAGE_FILTER" ]]; then
        jq -c --arg pkg "$PACKAGE_FILTER" \
            '[.[] | select(.package == null or .package == $pkg)]' <<<"$candidates_json"
    else
        printf '%s\n' "$candidates_json"
    fi
}

build_current_session_files_json() {
    local current_session="$1"
    local session_files_json="[]"

    if [[ "$current_session" == "null" || -z "$current_session" ]]; then
        printf '%s\n' "$session_files_json"
        return 0
    fi

    local session_dir="$SPECS_DIR/$current_session"
    if [[ ! -d "$session_dir" ]]; then
        printf '%s\n' "$session_files_json"
        return 0
    fi

    while IFS= read -r file; do
        session_files_json="$(jq -c --arg file "$(basename "$file")" '. + [$file]' <<<"$session_files_json")"
    done < <(find "$session_dir" -maxdepth 1 -type f -name '*.md' | sort)

    printf '%s\n' "$session_files_json"
}

output_json() {
    local project current_phase current_session completed_count monorepo_flag monorepo_json
    local packages_json active_package_json monorepo_detection_json phases_json completed_sessions_json
    local candidate_sessions_json current_session_files_json session_dir_exists

    project="$(json_get '.project_name // "unknown"')"
    current_phase="$(json_get '.current_phase // 0')"
    current_session="$(json_get 'if .current_session == null then "null" else .current_session end')"
    completed_count="$(json_get '(.completed_sessions // []) | length')"
    monorepo_flag="$(get_monorepo_flag)"
    packages_json="$(get_packages_json)"
    active_package_json="$(resolve_active_package_json "$monorepo_flag" "$packages_json")"
    phases_json="$(build_phases_json)"
    completed_sessions_json="$(get_completed_sessions_json)"
    candidate_sessions_json="$(build_candidate_sessions_json "$current_phase")"
    current_session_files_json="$(build_current_session_files_json "$current_session")"

    if [[ "$current_session" != "null" && -d "$SPECS_DIR/$current_session" ]]; then
        session_dir_exists="true"
    else
        session_dir_exists="false"
    fi

    case "$monorepo_flag" in
        true) monorepo_json="true" ;;
        false) monorepo_json="false" ;;
        *) monorepo_json="null" ;;
    esac

    if [[ "$monorepo_flag" == "null" ]]; then
        monorepo_detection_json="$(detect_monorepo_json)"
    else
        monorepo_detection_json="null"
    fi

    jq -n \
        --arg project "$project" \
        --arg state_file "${STATE_FILE#"$REPO_ROOT"/}" \
        --arg specs_dir "${SPECS_DIR#"$REPO_ROOT"/}" \
        --argjson current_phase "$current_phase" \
        --arg current_session "$current_session" \
        --argjson current_session_dir_exists "$session_dir_exists" \
        --argjson current_session_files "$current_session_files_json" \
        --argjson completed_sessions_count "$completed_count" \
        --argjson monorepo "$monorepo_json" \
        --argjson packages "$packages_json" \
        --argjson active_package "$active_package_json" \
        --argjson monorepo_detection "$monorepo_detection_json" \
        --argjson phases "$phases_json" \
        --argjson completed_sessions "$completed_sessions_json" \
        --argjson candidate_sessions "$candidate_sessions_json" \
        '{
            project: $project,
            state_file: $state_file,
            specs_dir: $specs_dir,
            current_phase: $current_phase,
            current_session: (if $current_session == "null" then null else $current_session end),
            current_session_dir_exists: $current_session_dir_exists,
            current_session_files: $current_session_files,
            completed_sessions_count: $completed_sessions_count,
            monorepo: $monorepo,
            packages: $packages,
            active_package: $active_package,
            monorepo_detection: $monorepo_detection,
            phases: $phases,
            completed_sessions: $completed_sessions,
            candidate_sessions: $candidate_sessions
        }'
}

output_human() {
    local json
    json="$(output_json)"

    printf '\n'
    printf '==============================================\n'
    printf 'PROJECT ANALYSIS SUMMARY\n'
    printf '==============================================\n'
    printf 'Project: %s\n' "$(jq -r '.project' <<<"$json")"
    printf 'State File: %s\n' "$(jq -r '.state_file' <<<"$json")"
    printf 'Current Phase: %s\n' "$(jq -r '.current_phase' <<<"$json")"
    printf 'Current Session: %s\n' "$(jq -r '.current_session // "(none)"' <<<"$json")"
    printf 'Current Session Directory Exists: %s\n' "$(jq -r '.current_session_dir_exists' <<<"$json")"
    printf 'Completed Sessions: %s\n' "$(jq -r '.completed_sessions_count' <<<"$json")"
    printf '\nPhases:\n'
    jq -r '.phases[] | "  - Phase \(.number): \(.name) [\(.status)] (\(.session_count) sessions)"' <<<"$json"
    printf '\nCandidate Sessions:\n'
    jq -r '.candidate_sessions[] | "  - \(.file) [" + (if .completed then "completed" else "not completed" end) + "]"' <<<"$json"
    printf '==============================================\n'
}

main() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                OUTPUT_MODE="json"
                shift
                ;;
            --package)
                if [[ -z "${2:-}" ]]; then
                    log_error "--package requires a PATH argument"
                    exit 1
                fi
                PACKAGE_FILTER="$2"
                shift 2
                ;;
            --help | -h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    require_jq

    REPO_ROOT="$(find_repo_root)"
    SPEC_SYSTEM_DIR="$(to_absolute_path "${SPEC_SYSTEM_DIR:-.spec_system}" "$REPO_ROOT")"
    STATE_FILE="$(to_absolute_path "${STATE_FILE:-$SPEC_SYSTEM_DIR/state.json}" "$REPO_ROOT")"
    SPECS_DIR="$(to_absolute_path "${SPECS_DIR:-$SPEC_SYSTEM_DIR/specs}" "$REPO_ROOT")"

    if [[ ! -f "$STATE_FILE" ]]; then
        log_error "State file not found: $STATE_FILE"
        exit 1
    fi

    if [[ "$OUTPUT_MODE" == "json" ]]; then
        output_json
    else
        output_human
    fi
}

main "$@"
