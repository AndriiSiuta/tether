---
disable-model-invocation: true
description: Write this month's read-only ADO and ledger metrics, or print the reviewer-policy plan
argument-hint: "[--month YYYY-MM] [--policy-plan]"
allowed-tools: ["Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/ado-metrics.mjs:*)"]
---

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/ado-metrics.mjs $ARGUMENTS`, unquoted, so it matches the pre-approved rule.

Every call it makes is a read. Show the user its output as it is. With `--policy-plan` it prints the branch policies on main and a proposed `az repos policy approver-count create` command: never run that command; creating a policy is the user's decision. If it exits non-zero, show its stderr and stop.
