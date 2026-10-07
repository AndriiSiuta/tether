#!/usr/bin/env bash
# PostToolUse, matcher Edit|Write: formats the written file inside the project root unless harness.json formatSkip covers it.
# Always exits 0: a formatter failure never blocks the edit, and without harness.json nothing is formatted.
set -u
file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
[ -n "$file" ] && [ -f "$file" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
skips=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" --get formatSkip --dir "$(pwd -P)") || exit 0
root=$(pwd -P)
resolved=$(realpath "$file")
case $resolved in "$root"/*) ;; *) exit 0 ;; esac
rel=${resolved#"$root"/}
while IFS= read -r skip; do
  [ -n "$skip" ] || continue
  case $skip in
    */) case $rel in "$skip"*) exit 0 ;; esac ;;
    *) [ "$rel" = "$skip" ] && exit 0 ;;
  esac
done <<< "$skips"
npx prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
exit 0
