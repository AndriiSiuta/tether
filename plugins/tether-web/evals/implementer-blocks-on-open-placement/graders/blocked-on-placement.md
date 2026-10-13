---
type: llm
focus: trace
---

Look at the report the implementer agent returned.

PASS if it ends with a `Blocked:` line whose question is about placement: which library, slice or folder the new service or button goes in, which existing file it should copy, or what provider scope the service gets.

FAIL if it reports the task as done (with `Files:` and `Checks:` naming files it wrote), if it invents a folder and writes code there, or if its only reason for stopping is that the workspace is read-only or a tool is missing.
