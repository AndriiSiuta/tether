---
type: regex
target:
  source: file
  path: docs/plans/order-status-filter.md
pattern: '### Task 1:[^\n]*\n(?:[ \t]*\n)*[ \t]*(`{3,}|~{3,})[^\n]*\n(?=(?:(?![ \t]*\1)[^\n]*\n)*?[^\n]*\btouches:)(?=(?:(?![ \t]*\1)[^\n]*\n)*?[^\n]*\bconflicts_with:)(?=(?:(?![ \t]*\1)[^\n]*\n)*?[^\n]*\bspec:)(?=(?:(?![ \t]*\1)[^\n]*\n)*?[^\n]*\bchecks:)'
weight: 2
---
