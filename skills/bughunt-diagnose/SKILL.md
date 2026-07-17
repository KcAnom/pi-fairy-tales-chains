---
name: bughunt-diagnose
description: >
  Phase 2 of 4 in the bughunt chain (repro → diagnose → fix → verify). Uses
  fairy-tales explore-role subagents to trace the root cause from the captured
  repro, then a review-role subagent to validate the hypothesis, producing a precise
  file:line root-cause finding. Trigger when the previous phase says "run
  bughunt-diagnose next", or standalone via "bughunt-diagnose", "phase 2 of
  bughunt", "diagnose the bug", "find the root cause".
---

# Bughunt: Diagnose

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 4: bughunt-repro → **bughunt-diagnose** → bughunt-fix → bughunt-verify

## Overview

Traces the reproduced failure back to its root cause. Delegates the search to
fairy-tales `explore` role subagents so the codebase search happens in isolated
context instead of bloating this session, then delegates a skeptical second pass to a
fairy-tales `review` role subagent to pressure-test the hypothesis before it's
trusted. Output is a root-cause hypothesis plus a precise `file:line` location — not a
fix.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/bughunt/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "bughunt"` (a legacy
`.bughunt-state.md` from an older version is imported automatically):

- If there is no run → abort: "No bughunt run found. Run `bughunt-repro` first."
- If the run is not `active` with `currentPhase: "diagnose"` → abort: "Expected the
  run to be at phase `diagnose` but it is at `<currentPhase/status>`. Run that phase's
  skill instead."
- If the repro data (`data.reproCommand` / the repro phase summary) is missing →
  abort: "Phase pointer looks right but the Phase 1 output is missing. Treat as
  corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe keys.

## Workflow

### Step 1 — Fan out exploration via durable quests

Using the repro command, expected/actual behavior, error output, and environment
recorded in `data` from Phase 1, launch one or more fairy-tales `explore` role
subagents to trace the failure through the codebase. Because exploration can be
long-running and must survive a session restart, use the **quest tool** rather than a
bare agent call — one quest per exploration thread:

- `quest` action `enqueue` with `role: "explore"`, a self-contained task (the stack
  trace or symptom to trace, and what to report back — call path, the function/module
  where behavior diverges from expected, related code that could be involved), and:
  - `dedupeKey: "bughunt/<runId>/diagnose/<lead>"` (a descriptive id for the lead
    being traced, e.g. `primary` or a symptom name) — re-running a crashed phase
    returns the same quest instead of duplicating a search;
  - `chain: { chain: "bughunt", runId: "<runId>", phase: "diagnose" }`;
  - `retainUntilConsumed: true`.
- If a returned quest is already `done` (crash-resume case), reuse its stored result;
  otherwise `quest` action `run` with its `id` and collect the result.

If the failure has multiple plausible starting points (e.g. a symptom visible in two
different call paths), enqueue several explore quests in parallel in a single batch
rather than serially.

### Step 2 — Validate with a review quest

Take the explore quests' findings and hand them to a fairy-tales `review` role
subagent via the **quest tool**: `enqueue` with `role: "review"`, the repro details
and the candidate root cause, `dedupeKey: "bughunt/<runId>/diagnose/review"`,
`chain: { chain: "bughunt", runId: "<runId>", phase: "diagnose" }`, and
`retainUntilConsumed: true`. Ask it to specifically check: does this location actually
explain the observed error output; are there alternate/competing explanations that fit
the symptoms just as well; is the proposed `file:line` the actual point of divergence
or just where the error surfaced (a stack trace's throw site is often downstream of
the real bug). Do not accept the first explore finding uncritically — the review pass
exists to catch tunnel vision. `run` the quest by `id` (or reuse its result if already
`done`).

### Step 3 — Settle on the finding

Reconcile the explore and review output into one root-cause hypothesis with an exact
`file:line`. If the review quest rejects the hypothesis or surfaces a stronger
competing explanation, run another explore/review round on the new lead rather than
forcing a weak conclusion — diagnose does not hand off until the hypothesis holds up.
After extracting what's needed into chain state (Step 4), `quest` action `consume`
each explore and review quest by `id`.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "bughunt", phase: "diagnose",
summary: "root-cause hypothesis with precise location; <N> explore quests run; review quest confirmed / redirected the finding",
data: {
  "rootCause": "<prose explanation of why the bug happens>",
  "location": "<path/to/file>:<line>",
  "exploreFindings": "<summary of what the explore quest(s) traced>",
  "reviewConfirmation": "<summary of what the review quest checked and confirmed>"
},
artifacts: { "exploreQuests": "<quest ids>", "reviewQuest": "<quest id>" }
```

The tool validates this is the current phase, advances the run to `fix`, and rewrites
the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/bughunt/state.json`).
> Run `/bughunt-fix` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
