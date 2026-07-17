---
name: bughunt-verify
description: >
  Phase 4 of 4 (final) in the bughunt chain (repro → diagnose → fix → verify).
  Re-runs the original repro to confirm it's resolved, runs the broader test suite,
  checks for regressions, and reports faithfully — naming any check that fails.
  Trigger when the previous phase says "run bughunt-verify next", or standalone via
  "bughunt-verify", "phase 4 of bughunt", "verify the fix", "confirm the bug is
  fixed".
---

# Bughunt: Verify

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 4 of 4: bughunt-repro → bughunt-diagnose → bughunt-fix → **bughunt-verify**

## Overview

Final phase. Proves the fix actually resolved the bug — the exact repro from Phase 1
no longer reproduces the failure — and that the broader test suite still passes, then
closes the chain. Reports faithfully: if a check fails, it says so and points at the
Phase 3 checkpoints for rollback, rather than declaring success.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/bughunt/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "bughunt"` (a legacy
`.bughunt-state.md` from an older version is imported automatically):

- If there is no run → abort: "No bughunt run found. Run `bughunt-repro` first."
- If the run is not `active` with `currentPhase: "verify"` → abort: "Expected the run
  to be at phase `verify` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If the fix data (`data.checkpointBefore` or the fix phase summary) is missing →
  abort: "Phase pointer looks right but the Phase 3 output is missing. Treat as
  corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Re-run the original repro

Run the exact `data.reproCommand` from Phase 1 (unchanged — do not substitute a
different command). Compare the result against the **expected behavior** recorded in
`data.expectedBehavior`:
- Matches expected → repro check ✓.
- Still matches the old `data.actualBehavior` (or errors differently but still fails)
  → repro check ✗. Do not soften this into a partial pass.

### Step 2 — Run the broader test suite

Run the project's full test command (not just the post-edit hook's scoped run from
Phase 3) — e.g. `.pi/test-command` in full-suite form if it supports one, or the
project's standard `npm test` / `pytest` / equivalent. This is what catches
regressions the narrow post-edit hook run in Phase 3 wouldn't have exercised.

### Step 3 — Check for regressions

Compare the broader suite's result to a known-good baseline if one is available (e.g.
CI status on the pre-fix commit, or simply "did anything fail that wasn't failing
before"). Name any newly-failing test explicitly — do not lump it in as "some tests
failed."

### Step 4 — Report

Produce a short verification report: the bug, the fix location, and the result of
each check (✓ / ✗) — repro re-run, broader suite, regressions. If anything failed,
say so plainly and point at `data.checkpointBefore` from Phase 3 as the rollback
target (`/rollback`), and recommend re-running `bughunt-fix` (or `bughunt-diagnose` if
the root cause looks wrong) rather than patching further in this phase.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "bughunt", phase: "verify",
summary: "verification report: repro re-run <✓/✗>; broader suite <✓/✗>; regressions <none found / listed>",
data: { "verificationReport": "<the verification report from Step 4>" }
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 4 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/bughunt/state.json`).
> Run `bughunt-repro` again to start a new session.

Do not continue. Stop here.
