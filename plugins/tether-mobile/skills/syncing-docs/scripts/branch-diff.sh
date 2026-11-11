#!/usr/bin/env bash
# Prints the paths the current branch touched since it left <base>, sorted, one per line.
set -u

usage() {
  cat <<'USAGE'
Usage: branch-diff.sh <base>

  base   the default branch or any ref the branch started from, e.g. origin/main

Prints, sorted and one per line, the paths changed between the merge base of <base> and HEAD
(git diff --name-only <merge-base>..HEAD); run it from inside the repository.

Exit codes:
  0  paths printed (none when the branch has no changes)
  2  usage error, not a git repository, or no merge base with <base>
USAGE
}

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  '') usage >&2; exit 2 ;;
esac

if [ "$#" -ne 1 ]; then
  usage >&2
  exit 2
fi

merge_base="$(git merge-base "$1" HEAD 2>/dev/null)" || {
  echo "branch-diff: no merge base between $1 and HEAD" >&2
  exit 2
}

git diff --name-only "$merge_base..HEAD" | LC_ALL=C sort
