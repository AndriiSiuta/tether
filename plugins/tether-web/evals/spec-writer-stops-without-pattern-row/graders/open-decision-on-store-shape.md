---
type: regex
target: last_message
pattern: 'open (?:decisions?|questions?)\b(?:[^\n]*\n){0,12}?(?=[^\n]*store)(?=[^\n]*\b(?:pattern|shape|cop(?:y|ies|ied)|template|candidates?|approach)\b)'
flags: i
weight: 2
---
