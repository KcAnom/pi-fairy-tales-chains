---
name: feature-ship-build
description: >
  Phase 2 of 4 in the feature-ship chain (spec → build → review → ship). Implements the
  spec from Phase 1, preferring /ultraplan (isolated git worktree) or fairy-tales
  build-role subagents, with the post-edit .pi/test-command hook self-repairing test
  failures as it goes. Trigger when the previous phase says run feature-ship-build
  next, or standalone via "feature-ship-build", "phase 2 of feature-ship", "implement
  the spec", "build the feature".
---

# Feature Ship: Build

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 4: feature-ship-spec → **feature-ship-build** → feature-ship-review → feature-ship-ship

## Overview

Implements the spec produced in Phase 1. Prefers `/ultraplan` when the change is large
enough to warrant an isolated git worktree, or fairy-tales **build-role** work
otherwise, so implementation happens against a dedicated execution context rather than
inline improvisation. The post-edit `.pi/test-command` hook fires after every edit and
self-repairs test failures as they happen, so this phase doesn't need a separate manual
test-fix loop.

## Load State

Call the **chain tool** with `action: "status", chain: "feature-ship"` (a legacy
`.feature-ship-state.md` from an older version is imported automatically):

- If there is no run → abort: "No feature-ship run found. Run `feature-ship-spec` first."
- If the run is not `active` with `currentPhase: "build"` → abort: "Expected the run to
  be at phase `build` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If the spec content (`data.spec` / `data.acceptanceCriteria` or the spec phase
  summary) is missing → abort: "Phase pointer looks right but the Phase 1 output is
  missing. Treat as corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe keys.

## Workflow

### Step 1 — Choose the execution path

- If the spec's "Files to Touch" spans multiple modules, is a multi-step change, or the
  user wants an isolated, inspectable working copy, run `/ultraplan` against the spec —
  it opens an isolated git worktree so the implementation can be built, tested, and
  discarded without touching the working tree the user is looking at.
- Otherwise, dispatch the implementation as fairy-tales **build-role** work — one unit
  per independent piece of the spec, each briefed with the relevant slice of the spec
  (goal, approach, files to touch, acceptance criteria) rather than the whole spec dump.
  For each unit, use the **quest tool** so the work survives a session restart:
  `enqueue` with `role: "build"`, `dedupeKey: "feature-ship/<runId>/build/<unit>"`,
  `chain: { chain: "feature-ship", runId: "<runId>", phase: "build" }`, and
  `retainUntilConsumed: true`; if the returned quest is already `done` (crash-resume),
  reuse its result, else `run` it by `id`; `consume` each quest after recording its
  output. Idempotent dedupe keys are what prevent a re-run of this phase from
  duplicating implementation work.

### Step 2 — Implement against the acceptance criteria

Implement every file change called out in the spec. After each edit, the project's
post-edit `.pi/test-command` hook (if configured) runs automatically and attempts to
self-repair any test failure it introduces — do not manually re-run the same fix twice
if the hook already retried; read its output and address the root cause if it still
fails after the hook's attempt.

### Step 3 — Record what was built

Capture, precisely:

- Branch name and/or worktree path (if `/ultraplan` was used).
- The actual files changed (from `git status` / `git diff --stat`), not just the files
  the spec predicted.
- Whether a patch file was produced instead of a live branch (e.g., worktree discarded
  after `/ultraplan` exports a diff) — if so, its path.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "feature-ship", phase: "build",
summary: "implemented via <ultraplan worktree | build-role quest(s)> at <branch/worktree/patch path>; deviations from the spec (if any) and why",
data: { "filesChanged": ["<path>", "..."] },
artifacts: { "branch": "<branch or worktree path>", "buildQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `review`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/feature-ship/state.json`).
> Run `/feature-ship-review` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
