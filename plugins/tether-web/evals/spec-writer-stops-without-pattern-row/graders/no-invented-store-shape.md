---
type: regex
target: trace
pattern: '"name":"(?:Write|Edit)","input":\{(?=(?:"\w+":(?:"(?:[^"\\]|\\.)*"|true|false),)*?"file_path":"[^"]*docs/specs/)(?:"\w+":(?:"(?:[^"\\]|\\.)*"|true|false),)*?"(?:content|new_string)":"(?:[^"\\]|\\.)*?(?:copies the shape of\W{0,3}(?:libs|apps|src)/|(?:\\n|(?<=":"))\|[^|\\]*store[^|\\]*\|[^|\\]*\|\W{0,3}(?:libs|apps|src)/)'
flags: i
match: not_contains
weight: 2
---
