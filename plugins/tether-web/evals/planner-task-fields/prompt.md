---
plugins: ["../..", "../../../tether-nx"]
description: The planner gives every task the touches, conflicts_with, spec and checks field block and writes the Waves and Shared files sections.
expected_outcome: 'The file docs/plans/order-status-filter.md exists; every ### Task heading is followed by a fenced block carrying touches:, conflicts_with:, spec: and checks:; the plan has a ## Waves section and a ## Shared files section.'
tags: [planner]
max_turns: 20
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Write]
---

Dispatch the `tether-web:planner` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with its report.

BEGIN BRIEF
The approved spec is `docs/specs/2026-10-02-order-status-filter.md` in the current working directory, and that directory is the codebase to plan against (`libs/`, `apps/`, `tsconfig.base.json`). Its `## Decisions` list holds D1, D2 and D3. There is no `.claude/tether-web.md` and no `.claude/tether-nx.md`, so the defaults apply. Write the plan to `docs/plans/order-status-filter.md`, under exactly that name.
END BRIEF
