# Dispatch prompts

Fill the `<…>` slots. One prompt per sweep, all dispatched in the same message, Explore type, cheapest model.

## Layer sweep (one per layer, max 3)

```
Read-only. Investigate one layer of a change; do not propose code.

Ask: <one line>
Layer root: <path>   Anchors: <2–4 grep terms>

Answer these five, citing file paths you opened:
1. Entry point in this layer for the ask (function or route).
2. Files to edit vs files that are context only.
3. The type that crosses INTO this layer and the type that crosses OUT (DTO, read model, shared type) — file and name.
4. Invariants stated in validators, comments, or guards that the change must keep.
5. Existing helpers this change should reuse.

Output: table rows `| layer | file | role | edit/read |` then bullets. ≤150 words.
Forbidden: proposing field names or code; reading outside the layer root; opening more than ~12 files.
```

## Docs and history sweep (when a spec, ADR, or backlog exists)

```
Read-only. Find what the docs already say about: <ask in one line>.

Look in: <docs dir>, README, any follow-ups or backlog file.
Return: spec section headers that govern the ask with a one-line quote each; backlog items that overlap or forbid it; ADRs that constrain it.
Then run `git log -S"<anchor>" --oneline | head` and list commits that last touched the area.
≤120 words. No proposals.
```

## Layout sweep (only when there is no CLAUDE.md / ARCHITECTURE.md)

```
Read-only. Map this repository so an investigation can locate a feature.

Return: package manager and build tool; apps/libs with their roots; folder convention per app (what lives where); how the front end calls the back end; where shared types live; where docs and specs live.
Paths and one-line facts only. ≤150 words.
```
