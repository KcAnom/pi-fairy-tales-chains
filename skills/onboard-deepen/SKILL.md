---
name: onboard-deepen
description: >
  Phase 2 of 3 in the onboard chain (map → deepen → digest). Runs targeted deep reads of
  the hotspot files the map phase surfaced — how core modules work, key data flows, and
  non-obvious conventions — and optionally records durable facts via the fairy-tales
  memory `remember` tool. Trigger when the previous phase says "run onboard-deepen next",
  or standalone via "onboard-deepen", "phase 2 of onboard", "deepen the repo map",
  "read the hotspots".
---

# Onboard: Deepen

Chain version: 1

Phase 2 of 3: onboard-map → **onboard-deepen** → onboard-digest

## Overview

Takes the hotspot list produced by `onboard-map` and reads those files deeply — not just
structurally — to understand how the core modules actually work, trace the key data
flows through them, and catch conventions that aren't obvious from file names alone.
Where a fact is durable enough to matter beyond this session, it is recorded with the
fairy-tales memory `remember` tool so future sessions on this repo start ahead.

## Load State

Read `.onboard-state.md`:

- If missing → abort: "No state file found. Run `onboard-map` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `map-done | deepen-done | complete` → abort: "Unrecognized
  status — this state file may belong to a different or since-edited chain."
- If `status` ≠ `map-done` → abort: "Expected status `map-done` but found `<actual>`.
  Run the previous phase first."
- If the `## Phase 1 — Map` section is missing → abort: "Status looks right but the
  Phase 1 output is missing. Treat as corrupted."
- Check `.onboard-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Select deep-read targets

From the `## Phase 1 — Map` section, take the flagged hotspot files (top 3-6). Add any
files those hotspots most heavily import from, if not already covered.

### Step 2 — Deep read each hotspot

For each target, read the full file (not an excerpt) and work out:

- What it's responsible for and why it's a hotspot (fan-in/fan-out, size, or centrality).
- The key data flow(s) through it — what comes in, what transforms happen, what goes out.
- Non-obvious conventions it embodies (naming patterns, error handling style, state
  management approach, anything a newcomer would get wrong by guessing).

### Step 3 — Record durable facts in memory

For facts likely to matter in future sessions on this repo (architectural decisions,
gotchas, "always/never do X here" rules), call the fairy-tales memory `remember` tool
to persist them. Keep entries short and specific — one fact per call, not a dump of the
whole map.

### Step 4 — Assemble the deepened understanding

Merge the per-hotspot findings into a single deepened-understanding section: core module
summaries, the key data flows traced end-to-end, and the non-obvious conventions found.
This is what Phase 3 (`onboard-digest`) will turn into the architecture overview.

## Update State

Atomically rewrite `.onboard-state.md` (temp file + rename), appending:

```markdown
## Phase 2 — Deepen
**Output**: deep-read findings for <N> hotspot files (module summaries, data flows, conventions)
**Key decisions**: facts written to fairy-tales memory: <list, or "none">
```

and updating `status: deepen-done`. Delete `.onboard-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.onboard-state.md`.
> Run `/onboard-digest` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
