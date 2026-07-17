---
name: onboard-digest
description: >
  Phase 3 of 3 (final) in the onboard chain (map → deepen → digest). Uses the artifact
  tool to produce a polished, theme-aware, self-contained HTML architecture overview
  (module map, data-flow diagram, "start here" reading guide) and opens it, then writes
  the top facts to fairy-tales memory and closes the chain. Trigger when the previous
  phase says "run onboard-digest next", or standalone via "onboard-digest", "phase 3 of
  onboard", "digest the repo map", "produce the architecture overview".
---

# Onboard: Digest

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 3: onboard-map → onboard-deepen → **onboard-digest**

## Overview

Final phase. Turns the map from Phase 1 (`data.map`/`data.hotspots`) and the deepened
understanding from Phase 2 (`data.deepened`) into a single polished deliverable: a
self-contained HTML architecture overview, published with the **artifact tool** and
opened for the user. Also writes the top durable facts to fairy-tales memory so a
future session (even one that never runs this chain again) starts with context.
Reports faithfully — if a hotspot from Phase 1 was never deep-read in Phase 2, the
overview says so rather than glossing over the gap.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/onboard/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "onboard"` (a legacy
`.onboard-state.md` from an older version is imported automatically):

- If there is no run → abort: "No onboard run found. Run `onboard-map` first."
- If the run is not `active` with `currentPhase: "digest"` → abort: "Expected the run
  to be at phase `digest` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.deepened` (or the deepen phase summary) is missing → abort: "Phase pointer
  looks right but the Phase 2 output is missing. Treat as corrupted — restart the
  chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Build the architecture overview content

From `data.map`, `data.hotspots`, and `data.deepened`, assemble:

- **Module map** — the repo's major modules/packages and how they relate.
- **Data-flow diagram** — the key flow(s) traced in Phase 2, shown visually.
- **"Start here" reading guide** — an ordered list of the 3-6 hotspot files a newcomer
  should read first, with a one-line reason for each (why it's the right starting
  point). If a flagged hotspot from Phase 1 has no matching entry in `data.deepened`,
  say so explicitly rather than silently dropping it.

### Step 2 — Publish with the artifact tool

Write the content to an HTML file and publish it with the fairy-tales **artifact tool**
so it renders as a polished, theme-aware, self-contained page (inline CSS/JS only, no
external requests, honors light/dark). Open the resulting artifact for the user.

### Step 3 — Write top facts to memory

Call the fairy-tales memory `remember` tool with the highest-value durable facts from
the whole session (architecture summary, key conventions, gotchas) — a small, curated
set, not everything already stored in Phase 2.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "onboard", phase: "digest",
summary: "architecture overview artifact published and opened; top facts written to fairy-tales memory: <list>",
data: {},
artifacts: { "overviewUrl": "<artifact tool URL>" }
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/onboard/state.json`).
> Run `onboard-map` again to start a new session.

Do not continue. Stop here.
