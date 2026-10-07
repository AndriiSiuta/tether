---
description: Fill a run report's ledger from local telemetry, then print the per-agent totals
argument-hint: <report.md> [--dry-run]
allowed-tools: Bash(node:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger-from-otel.mjs" $ARGUMENTS`.

If it exits 0, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger-stats.mjs" <report.md>` with the report path from the arguments, without `--dry-run`.

If it exits non-zero, show its stderr and stop; the report is unchanged. Show the user both outputs as they are.
