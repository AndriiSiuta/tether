#!/usr/bin/env bash
# Prints every template line carrying a fixed width or height or a hex colour; the agent then keeps only thumbnails and icons.
set -u

PATTERN='w-\[|h-\[|min-w-\[|max-w-\[|\b[wh]-[0-9]+\b|#[0-9a-fA-F]{3,6}'

usage() {
  cat <<'USAGE'
Usage: check-sizes.sh <file>...

Greps the given templates for w-[…], h-[…], min-w-[…], max-w-[…], w-<n>, h-<n> and #hex colours,
printing file:line:text for each hit.

Exit codes:
  0  no hit
  1  hits printed; each must be a thumbnail or an icon, or be fixed
  2  usage error or a file that cannot be read
USAGE
}

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  '') usage >&2; exit 2 ;;
esac

grep -nHE -- "$PATTERN" "$@"
case $? in
  0) exit 1 ;;
  1) exit 0 ;;
  *) exit 2 ;;
esac
