---
name: research-synthesize
description: >
  Phase 2 of 3 in the research chain (gather → synthesize → artifact). Compresses and
  dedupes the raw material gathered in Phase 1 into a structured synthesis — themes,
  findings, contradictions between sources, and open gaps. Trigger when the previous
  phase says "run research-synthesize next", or standalone via "research-synthesize",
  "phase 2 of research", "synthesize the research".
---

# Research: Synthesize

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 3: research-gather → **research-synthesize** → research-artifact

## Overview

Takes the per-source notes, quotes, and links gathered in Phase 1 and compresses them
into a structured synthesis: cross-source themes, the actual findings, where sources
contradict each other, and what's still an open gap. Makes no report yet — that's
Phase 3 — so this stays a focused analytical pass over already-gathered material.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/research/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "research"` (a legacy
`.research-state.md` from an older version is imported automatically):

- If there is no run → abort: "No research run found. Run `research-gather` first."
- If the run is not `active` with `currentPhase: "synthesize"` → abort: "Expected the
  run to be at phase `synthesize` but it is at `<currentPhase/status>`. Run that
  phase's skill instead."
- If `data.sources` (or the gather phase summary) is missing → abort: "Phase pointer
  looks right but the Phase 1 output is missing. Treat as corrupted — restart the
  chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Compress and dedupe

Read every per-source note from `data.sources`. Merge overlapping points across
sources, dedupe repeated quotes/claims, and drop material that turned out irrelevant
to the research question.

### Step 2 — Extract themes and findings

Group the deduped material into cross-source themes. Under each theme, state the
concrete findings, citing which source(s) support each one.

### Step 3 — Surface contradictions

Explicitly call out anywhere two or more sources disagree — what each says, and (if
determinable) which is more credible or current. Do not silently resolve a
contradiction by picking a side without saying so.

### Step 4 — Identify gaps

List open questions the gathered material doesn't answer — these become the
"worth a follow-up round" notes that Phase 3 surfaces in the final report.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "research", phase: "synthesize",
summary: "N themes, M findings, K contradictions, J open gaps; judgment calls made while deduping or resolving overlaps",
data: {
  "themes": [ { "theme": "<name>", "findings": ["<finding + citation>", "..."] } ],
  "contradictions": ["<what each source says, and which is more credible/current>"],
  "gaps": ["<open question>", "..."]
}
```

The tool validates this is the current phase, advances the run to `artifact`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/research/state.json`).
> Run `/research-artifact` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
