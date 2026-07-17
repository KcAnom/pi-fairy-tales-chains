---
name: feature-ship-ship
description: >
  Phase 4 of 4 (final) in the feature-ship chain (spec → build → review → ship).
  Addresses blocking findings from Phase 3, commits using the /commit conventions, and
  opens a PR (or produces a patch if there's no remote), then closes the chain. Trigger
  when the previous phase says run feature-ship-ship next, or standalone via
  "feature-ship-ship", "phase 4 of feature-ship", "ship the feature", "ship it".
---

# Feature Ship: Ship

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 4 of 4: feature-ship-spec → feature-ship-build → feature-ship-review → **feature-ship-ship**

## Overview

Final phase. Fixes every blocking finding from Phase 3, commits the result using the
fairy-tales `/commit` conventions, and opens a PR — or, if the project has no remote,
produces a patch file instead so the work is still handed off cleanly. Reports
faithfully: if a blocking finding can't be resolved, it says so rather than shipping
past it.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/feature-ship/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "feature-ship"` (a legacy
`.feature-ship-state.md` from an older version is imported automatically):

- If there is no run → abort: "No feature-ship run found. Run `feature-ship-spec` first."
- If the run is not `active` with `currentPhase: "ship"` → abort: "Expected the run to
  be at phase `ship` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If the Phase 3 findings (`data.blockingFindings` / `data.nonBlockingFindings` or the
  review phase summary) are missing → abort: "Phase pointer looks right but the Phase 3
  output is missing. Treat as corrupted — restart the chain or repair via chain action
  'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Address blocking findings

Fix every item under Phase 3's `data.blockingFindings`. Re-run the project's test
command after each fix. Do not proceed to commit while any blocking finding is still
open — if one genuinely can't be resolved in this phase, stop and report it instead of
shipping around it. Non-blocking findings may be left as-is; note them in the ship
report for the user's awareness.

### Step 2 — Commit using /commit conventions

Stage the changed files and commit following the fairy-tales `/commit` conventions
(conventional-commit type derived from the spec's nature — feat/fix/refactor —
imperative subject, body explaining why, referencing the Phase 1 spec).

### Step 3 — Open a PR, or produce a patch

- If the project has a configured remote: push the branch and open a PR with `gh pr
  create`, using the Phase 1 spec's Goals/Approach as the PR description and noting any
  non-blocking findings left for reviewers.
- If there is no remote: produce a patch file instead (`git format-patch` or `git diff`
  against the base branch) and tell the user where it was written — this is not a
  failure, just the no-remote path.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "feature-ship", phase: "ship",
summary: "committed via /commit conventions; <PR URL | patch file path>; blocking findings resolved: <list>; non-blocking findings left open: <list>",
data: {},
artifacts: { "pr": "<PR URL>", "patch": "<patch file path if no remote>" }
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 4 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/feature-ship/state.json`).
> Run `feature-ship-spec` again to start a new session.

Do not continue. Stop here.
