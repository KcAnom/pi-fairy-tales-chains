---
name: feature-ship-review
description: >
  Phase 3 of 4 in the feature-ship chain (spec → build → review → ship). Runs the
  deep-review skill and fairy-tales review-role subagents against the Phase 2 diff,
  collecting blocking and non-blocking findings for Phase 4 to act on. Trigger when the
  previous phase says run feature-ship-review next, or standalone via
  "feature-ship-review", "phase 3 of feature-ship", "review the build", "review this
  feature".
---

# Feature Ship: Review

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 4: feature-ship-spec → feature-ship-build → **feature-ship-review** → feature-ship-ship

## Overview

Reviews the diff produced in Phase 2 against the spec's acceptance criteria from Phase
1. Runs the **deep-review skill** for a structured multi-angle pass over the diff, and
dispatches fairy-tales **review-role subagents** for targeted checks (correctness,
security, spec conformance), then merges everything into one findings list split into
blocking and non-blocking so Phase 4 knows exactly what must be fixed before shipping.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/feature-ship/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "feature-ship"` (a legacy
`.feature-ship-state.md` from an older version is imported automatically):

- If there is no run → abort: "No feature-ship run found. Run `feature-ship-spec` first."
- If the run is not `active` with `currentPhase: "review"` → abort: "Expected the run to
  be at phase `review` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If the build output (`data.filesChanged` / the build phase's `artifacts.branch` or
  summary) is missing → abort: "Phase pointer looks right but the Phase 2 output is
  missing. Treat as corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe keys.

## Workflow

### Step 1 — Assemble the diff

Get the exact diff to review from the location Phase 2 recorded (branch, worktree, or
patch file — `artifacts.branch` / the build phase summary). Do not re-derive it from the
spec — review what was actually built.

### Step 2 — Run the deep-review skill

Invoke the **deep-review skill** against the diff. Let it run its full multi-angle
pass (correctness, edge cases, consistency) rather than summarizing it yourself.

### Step 3 — Dispatch review-role subagents via durable quests

Dispatch fairy-tales **review-role subagents** in parallel, each with a narrow brief.
Because review passes can be long-running and must survive a session restart, use the
**quest tool** rather than a bare agent call — one quest per subagent:

- `quest` action `enqueue` with `role: "review"`, the brief below, and:
  - `dedupeKey: "feature-ship/<runId>/review/<unit>"` (e.g. `acceptance`, `security`,
    or a risk area name from the Phase 1 spec) — re-running a crashed phase returns
    the same quest instead of duplicating a review pass;
  - `chain: { chain: "feature-ship", runId: "<runId>", phase: "review" }`;
  - `retainUntilConsumed: true`.
- If a returned quest is already `done` (crash-resume case), reuse its stored result;
  otherwise `quest` action `run` with its `id` and collect the result.
- After extracting findings into chain state (Step 5), `quest` action `consume` each
  quest by `id`.

Briefs to fan out:

- One checks the diff against the Phase 1 acceptance criteria specifically — does every
  criterion have code behind it?
- One checks for correctness/security issues the deep-review skill's pass might not
  specialize in (e.g., auth, injection, data handling) if the diff touches that surface.
- Additional quests as the diff's risk areas (from the Phase 1 spec's "Risks"
  section) warrant.

### Step 4 — Merge findings

Combine the deep-review skill's output and every review-role quest's output into one
list. Classify each finding as:

- **Blocking** — violates an acceptance criterion, introduces a correctness/security
  bug, or breaks something that worked before.
- **Non-blocking** — style, minor cleanup, "nice to have" — safe to ship without.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "feature-ship", phase: "review",
summary: "deep-review skill + review-role quest findings merged: <N> blocking, <M> non-blocking",
data: {
  "blockingFindings": ["<finding 1>", "<finding 2>", "..."],
  "nonBlockingFindings": ["<finding 1>", "..."]
},
artifacts: { "reviewQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `ship`, and rewrites
the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. Chain state updated (`.pi/fairy-tales/chains/feature-ship/state.json`).
> Run `/feature-ship-ship` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
