---
name: research-artifact
description: >
  Phase 3 of 3 (final) in the research chain (gather → synthesize → artifact). Uses
  the artifact tool to turn the Phase 2 synthesis into a polished, theme-aware,
  self-contained HTML research report, opens it, and closes the chain. Trigger when
  the previous phase says "run research-artifact next", or standalone via
  "research-artifact", "phase 3 of research", "build the research report".
---

# Research: Artifact

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 3: research-gather → research-synthesize → **research-artifact**

## Overview

Final phase. Turns the themes, findings, contradictions, and gaps from Phase 2 into a
polished, human-readable deliverable: a self-contained HTML research report produced
with the **artifact tool** and opened for the user. Notes any gaps worth a follow-up
research round, then marks the chain complete.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/research/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "research"` (a legacy
`.research-state.md` from an older version is imported automatically):

- If there is no run → abort: "No research run found. Run `research-gather` first."
- If the run is not `active` with `currentPhase: "artifact"` → abort: "Expected the
  run to be at phase `artifact` but it is at `<currentPhase/status>`. Run that phase's
  skill instead."
- If `data.themes` (or the synthesize phase summary) is missing → abort: "Phase
  pointer looks right but the Phase 2 output is missing. Treat as corrupted — restart
  the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Build the report content

Turn `data.themes`, `data.contradictions`, and `data.gaps` into report sections: an
overview of the research question, the themes with findings and source citations, a
contradictions section, and an open gaps / follow-up section. Write this content to a
file the artifact tool can publish.

### Step 2 — Produce the artifact

Use the **artifact tool** to render the report as a polished, self-contained,
theme-aware HTML page (works in both light and dark viewer themes) and open it for the
user. Give it a concise title and a one-sentence description summarizing the research
question.

### Step 3 — Note follow-up gaps

Call out, in the chat response (not just inside the artifact), any open gaps from
`data.gaps` that are substantial enough to justify a follow-up `research-gather`
round.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "research", phase: "artifact",
summary: "HTML research report produced via the artifact tool and opened; gaps flagged for follow-up (if any)",
data: {},
artifacts: { "reportUrl": "<artifact tool URL>" }
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/research/state.json`).
> Run `research-gather` again to start a new session.

Do not continue. Stop here.
