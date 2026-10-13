#!/usr/bin/env bash
# Greps TypeScript files for the constructs the typescript-style recipe forbids; comment lines are skipped.
set -u

usage() {
  cat <<'USAGE'
Usage: check-style.sh <file.ts>...

Prints file:line: <rule>: <text> for each hit of:
  loose-nullish     == null, != null (the typed nullish helper instead)
  non-null          a ! non-null or definite-assignment assertion (x!.y, x![0], f()!, x!: T)
  in-place-sort     .sort( (toSorted; a table component's custom-sort callback is the one exception)
  param-default     x = x || …, x = x ?? … (a parameter default with ?? instead of reassignment)
  ngclass-method    [ngClass]="…(…)" (a [class.name] binding on a computed instead)

Exit codes:
  0  no hit
  1  hits printed; each is fixed, or is the documented exception
  2  usage error or a file that cannot be read
USAGE
}

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  '') usage >&2; exit 2 ;;
esac

for file in "$@"; do
  [ -r "$file" ] || { echo "check-style: cannot read $file" >&2; exit 2; }
done

rules=(
  'loose-nullish|(^|[^=!])[!=]=[[:space:]]*null\b|\bnull[[:space:]]*[!=]=([^=]|$)'
  'non-null|[]_)[:alnum:]]![.;,):[]'
  'in-place-sort|\.sort\('
  'param-default|\b([[:alpha:]_][[:alnum:]_]*)[[:space:]]*=[[:space:]]*\1[[:space:]]*(\|\||\?\?)'
  'ngclass-method|\[ngClass\]="[^"]*\('
)

hits=0
for entry in "${rules[@]}"; do
  name="${entry%%|*}"
  pattern="${entry#*|}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    location="${line%%:*}"
    rest="${line#*:}"
    number="${rest%%:*}"
    text="${rest#*:}"
    case "$text" in
      [[:space:]]*//* | //* | [[:space:]]\** | \** | [[:space:]]/\** | /\**) continue ;;
    esac
    echo "$location:$number: $name: $text"
    hits=1
  done < <(grep -nHE -- "$pattern" "$@")
done

exit "$hits"
