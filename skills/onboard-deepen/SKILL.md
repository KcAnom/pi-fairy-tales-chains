---
name: onboard-deepen
description: >
  Phase 2 of 3 in the onboard chain (map → deepen → digest). Runs targeted deep reads,
  via durable explore-role quests, of the hotspot files the map phase surfaced — how
  core modules work, key data flows, and non-obvious conventions — and optionally
  records durable facts via the fairy-tales memory `remember` tool. Trigger when the
  previous phase says "run onboard-deepen next", or standalone via "onboard-deepen",
  "phase 2 of onboard", "deepen the repo map", "read the hotspots".
---

# Onboard: Deepen

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 3: onboard-map → **onboard-deepen** → onboard-digest

## Overview

Takes the hotspot list produced by `onboard-map` (`data.hotspots`) and reads those
files deeply — not just structurally — to understand how the core modules actually
work, trace the key data flows through them, and catch conventions that aren't obvious
from file names alone. Where a fact is durable enough to matter beyond this session, it
is recorded with the fairy-tales memory `remember` tool so future sessions on this repo
start ahead.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/onboard/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "onboard"` (a legacy
`.onboard-state.md` from an older version is imported automatically):

- If there is no run → abort: "No onboard run found. Run `onboard-map` first."
- If the run is not `active` with `currentPhase: "deepen"` → abort: "Expected the run
  to be at phase `deepen` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.hotspots` (or the map phase summary) is missing → abort: "Phase pointer
  looks right but the Phase 1 output is missing. Treat as corrupted — restart the
  chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe keys.

## Workflow

### Step 1 — Select deep-read targets

Take `data.hotspots` (top 3-6 flagged files). Add any files those hotspots most
heavily import from, if not already covered.

### Step 2 — Deep read each hotspot via durable quests

Because deep-reading several files can be long-running and must survive a session
restart, use the **quest tool** rather than bare agent calls. For each target,
`enqueue` a quest with `role: "explore"`, a self-contained task (read the full file —
not an excerpt — and report back: what it's responsible for and why it's a hotspot,
the key data flow(s) through it, and non-obvious conventions it embodies), and:

- `dedupeKey: "onboard/<runId>/deepen/<hotspot-id>"` (`<hotspot-id>` a sanitized form
  of the file path) — re-running a crashed phase returns the same quest instead of
  duplicating the read;
- `chain: { chain: "onboard", runId: "<runId>", phase: "deepen" }`;
- `retainUntilConsumed: true`.

Issue all targets' `enqueue` calls in **one message** so they run in parallel. If a
returned quest is already `done` (crash-resume case), reuse its stored result;
otherwise `quest` action `run` with its `id` and collect the result. After extracting
what's needed into chain state (Step 4), `quest` action `consume` each quest by `id`.

### Step 3 — Record durable facts in memory

For facts likely to matter in future sessions on this repo (architectural decisions,
gotchas, "always/never do X here" rules), call the fairy-tales memory `remember` tool
to persist them. Keep entries short and specific — one fact per call, not a dump of the
whole map.

### Step 4 — Assemble the deepened understanding

Merge the per-hotspot quest results into a single deepened-understanding section: core
module summaries, the key data flows traced end-to-end, and the non-obvious
conventions found. This is what Phase 3 (`onboard-digest`) will turn into the
architecture overview.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "onboard", phase: "deepen",
summary: "deep-read findings assembled for N hotspot files (module summaries, data flows, conventions); facts written to fairy-tales memory: <list, or 'none'>",
data: {
  "deepened": [
    { "file": "<path>", "summary": "<what it's responsible for / why hotspot>", "dataFlow": "<traced flow>", "conventions": "<non-obvious conventions>" }
  ]
},
artifacts: { "deepenQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `digest`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/onboard/state.json`).
> Run `/onboard-digest` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
