#!/usr/bin/env bash
# PostToolUse, matcher Edit|Write: formats a file inside the project root with the project's own Prettier when harness.json has formatSkip and it does not cover the file.
# Never fetches from npm (npx --no-install); always exits 0, and without formatSkip or a local Prettier nothing is formatted.
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
if [ -x "$root/node_modules/.bin/prettier" ]; then
  "$root/node_modules/.bin/prettier" --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
else
  npx --no-install prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
fi
exit 0
