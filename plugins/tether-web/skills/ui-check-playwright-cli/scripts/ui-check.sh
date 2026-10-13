#!/usr/bin/env bash
# One UI check with playwright-cli: open the preview, go to a route, assert a text, screenshot the page, close.
#
# Commands are those quoted from the playwright-cli README (open, goto, snapshot, find, screenshot --filename=, close);
# none was run on the machine this script was written on, because playwright-cli was not installed there.
# Unconfirmed, check against `playwright-cli --help` on first use:
#   - the exit status of `find` when nothing matches (the script also requires the text in its output);
#   - the exit status of `goto` on a refused connection (the script treats any non-zero status as "preview down");
#   - whether `screenshot --filename=` honours a path with folders or writes under a configured outputDir.
set -u

usage() {
  cat <<'USAGE'
Usage: ui-check.sh <base-url> <route> "<text to find>" <out.png>

  base-url   the preview, e.g. http://localhost:4300 (no trailing slash)
  route      starts with /, may carry a query: /orders?status=open
  text       the exact text the page must show
  out.png    screenshot path; its folder is created

Takes one fresh snapshot and one retry when the text is missing, screenshots pass or fail.

Exit codes:
  0  pass
  1  fail: the text is not on the page after one retry
  2  usage error
  3  blocked: playwright-cli is missing, or the preview did not load
USAGE
}

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
esac

if [ "$#" -ne 4 ]; then
  usage >&2
  exit 2
fi

base_url="${1%/}"
route="$2"
text="$3"
out="$4"

case "$route" in
  /*) ;;
  *) echo "ui-check: route must start with /: $route" >&2; exit 2 ;;
esac

if ! command -v playwright-cli >/dev/null 2>&1; then
  cat >&2 <<'MISSING'
ui-check: blocked - playwright-cli is not on PATH.
Installing it is the user's call (npm install -g @playwright/cli@latest, then playwright-cli install --skills).
Once installed, run `playwright-cli --help` and confirm the commands this script uses: open, goto, snapshot, find, screenshot --filename=, close.
MISSING
  exit 3
fi

mkdir -p "$(dirname "$out")"

found() {
  local result
  playwright-cli snapshot >/dev/null 2>&1 || return 1
  result="$(playwright-cli find "$text" 2>&1)" || return 1
  printf '%s' "$result" | grep -qF -- "$text"
}

playwright-cli open "$base_url" >/dev/null 2>&1 || { echo "ui-check: blocked - could not open $base_url" >&2; exit 3; }

if ! playwright-cli goto "$base_url$route" >/dev/null 2>&1; then
  playwright-cli close >/dev/null 2>&1
  echo "ui-check: blocked - $base_url$route did not load; the preview is down" >&2
  exit 3
fi

status=0
if ! found && ! found; then
  status=1
fi

playwright-cli screenshot --filename="$out" >/dev/null 2>&1 || echo "ui-check: screenshot failed for $out" >&2
playwright-cli close >/dev/null 2>&1

if [ ! -f "$out" ]; then
  echo "ui-check: no file at $out; find it under the configured outputDir and mv it there" >&2
fi

if [ "$status" -eq 0 ]; then
  echo "pass - $route shows \"$text\" - $out"
else
  echo "fail - $route does not show \"$text\" after one retry - $out"
fi
exit "$status"
