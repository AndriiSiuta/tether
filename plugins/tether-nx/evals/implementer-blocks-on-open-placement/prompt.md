---
description: The implementer stops with a Blocked line when the brief leaves placement open, instead of guessing a folder.
expected_outcome: No file written; the implementer's report ends with a Blocked line that asks where the new code goes, which file it copies or what provider scope it gets.
tags: [smoke, implementer]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `tether-nx:implementer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with its report, unchanged.

BEGIN BRIEF
# Task 3: Export the order list as CSV

The codebase is the read-only `workspace` directory added to this session. Base commit: none (no git history). There is no `.claude/tether-nx.md`, so the defaults apply.

Add an "Export CSV" button to the order list that downloads the visible orders as a CSV file. Add a service that builds the CSV text from the orders.
END BRIEF
