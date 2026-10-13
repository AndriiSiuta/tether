---
type: regex
target: last_message
pattern: '^(?![\s\S]*Verdict:\W*pass\b)[\s\S]*(?:^|\n)\W*Verdict:\W*fail\b[^\n]*\s*$'
flags: i
---
