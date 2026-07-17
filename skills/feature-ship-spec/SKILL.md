---
name: feature-ship-spec
description: >
  Phase 1 of 4 in the feature-ship chain — the human-in-the-loop feature delivery
  pipeline (spec → build → review → ship). Turns a raw feature request into a written
  spec using a fairy-tales plan-role subagent and renders it as an artifact doc (goals,
  approach, files to touch, risks, acceptance criteria). This phase starts the durable
  chain run (state tracked by the chain tool). Trigger whenever the user wants to ship
  a new feature, start the feature-ship chain, or turn a request into a spec:
  "feature-ship-spec", "phase 1 of feature-ship", "start feature-ship", "spec this
  feature", "begin the feature-ship chain", or when the previous phase says run
  feature-ship-spec next (the final phase says to run it again to start a new session).
---

# Feature Ship: Spec

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 4: **feature-ship-spec** → feature-ship-build → feature-ship-review → feature-ship-ship

## Overview

Entry point of the `feature-ship` chain. Takes a raw feature request and turns it into
a written spec — goals, approach, files to touch, risks, and acceptance criteria — that
the rest of the chain builds, reviews, and ships against.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/feature-ship/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

Delegates the actual design work to a fairy-tales **plan-role** pass so the spec is
produced by a dedicated planning pass rather than improvised inline, then renders the
result with the **artifact tool** so it's a durable, shareable doc rather than only
chat text.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "feature-ship"`:

- If an **active** run exists, a feature-ship run is already mid-flight (the status
  shows its current phase — a legacy `.feature-ship-state.md` from an older version is
  imported automatically). Show the user the status and ask whether to **resume** from
  the current phase (run that phase's skill) or **discard** it (`action: "abandon"`)
  and start over. Do not silently overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned, start fresh:
  `action: "start", chain: "feature-ship", task: "<the feature request>"`. Note the
  `runId` in the response — it keys this run's quest dedupe keys.

### Step 2 — Design the spec via a durable quest

Delegate the design to a fairy-tales **plan-role** pass. Because spec design can be
long-running and must survive a session restart, use the **quest tool** rather than a
bare agent call:

1. `quest` action `enqueue` with `role: "plan"`, the feature request + repo context as
   a self-contained task, and crucially:
   - `dedupeKey: "feature-ship/<runId>/spec/main"` — if this phase crashed and is being
     re-run, the same quest (or its retained result) is returned instead of starting a
     duplicate design pass;
   - `chain: { chain: "feature-ship", runId: "<runId>", phase: "spec" }`;
   - `retainUntilConsumed: true` — the result survives history pruning until this
     phase reads it.
2. If the returned quest is already `done` (crash-resume case), use its stored result
   directly. Otherwise `quest` action `run` with its `id` and collect the result.
3. After extracting what you need into chain state (Step 4), `quest` action `consume`
   with the quest `id`.

Ask the planner to produce, concretely:

- **Goals** — what the feature must accomplish, in the user's terms.
- **Approach** — the technical strategy, at the level of "which modules/layers change
  and how", not a line-by-line diff.
- **Files to touch** — concrete paths, not just areas.
- **Risks** — what could break, what's ambiguous, what needs a follow-up decision.
- **Acceptance criteria** — a checklist that phase 3 (review) and phase 4 (ship) can
  verify against mechanically; these must be specific and falsifiable, not "it works".

Do not write this spec inline yourself — the plan-role pass is the one designing it;
your job in this phase is to brief it, collect its output, and render it.

### Step 3 — Render the spec doc via the artifact tool

Take the planner's output and render it with the **artifact tool** as a spec document
(sections: Goals, Approach, Files to Touch, Risks, Acceptance Criteria). Share the
resulting artifact link with the user. The chain state stores the same content so later
phases don't depend on the artifact staying reachable.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "feature-ship", phase: "spec",
summary: "<goals/approach in 2-4 sentences; anything phase 2 must know>",
data: {
  "spec": "<full spec markdown: Goals / Approach / Files to Touch / Risks / Acceptance Criteria>",
  "acceptanceCriteria": ["<criterion 1>", "<criterion 2>", "..."]
},
artifacts: { "specUrl": "<artifact tool URL>", "specQuest": "<quest id>" }
```

The tool validates this is the current phase, advances the run to `build`, and rewrites
the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/feature-ship/state.json`).
> Run `/feature-ship-build` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
