---
description: The reviewer refuses a dispatch whose first line names no mode, with its one fixed reply.
expected_outcome: The reviewer returns its fixed blocked reply asking for the mode and no review table.
tags: [smoke, reviewer]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Agent]
---

Dispatch the `tether-nx:reviewer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with exactly what it returns.

BEGIN BRIEF
Please review the latest commit on this branch for anything that looks off.
END BRIEF
