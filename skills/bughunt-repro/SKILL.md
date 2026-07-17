---
name: bughunt-repro
description: >
  Phase 1 of 4 in the bughunt chain — the human-in-the-loop bug-fixing pipeline
  (repro → diagnose → fix → verify). Captures a reliable reproduction of a bug: the
  exact failing command or test, expected vs. actual behavior, error output, and
  environment. This phase starts the durable chain run (state tracked by the chain
  tool). Trigger whenever the user reports a bug, pastes an error/stack trace, or
  wants to start the bughunt chain: "bughunt-repro", "start a bughunt", "reproduce
  this bug", "capture a repro", "begin the bughunt chain", or standalone "bughunt".
---

# Bughunt: Repro

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 4: **bughunt-repro** → bughunt-diagnose → bughunt-fix → bughunt-verify

## Overview

Entry point of the `bughunt` chain. Turns a bug report into a reliable, reproducible
failure: the exact command or test that fails, what should happen, what actually
happens, the raw error output, and the environment it fails in. A fix built on a repro
that isn't actually reliable is worthless, so this phase does not proceed until the
failure has been reproduced and observed directly — not just described secondhand.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/bughunt/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "bughunt"`:

- If an **active** run exists, a bughunt run is already mid-flight (the status shows
  its current phase — a legacy `.bughunt-state.md` from an older version is imported
  automatically). Show the user the status and ask whether to **resume** from the
  current phase (run that phase's skill) or **discard** it (`action: "abandon"`) and
  start over. Do not silently overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned, start fresh:
  `action: "start", chain: "bughunt", task: "<short description of the bug>"`. Note
  the `runId` in the response — it keys this run's quest dedupe keys.

### Step 2 — Capture the bug report

Gather from the user (or the conversation that triggered this phase): what's broken,
where it was observed, and any command, test name, stack trace, or screenshot already
provided. Do not invent details that weren't given.

### Step 3 — Reproduce it directly

- Identify the exact failing command or test (e.g. `npm test -- path/to.spec.ts`,
  `pytest tests/test_x.py::test_y`, a specific curl/CLI invocation).
- Run it. Capture the raw error output (stack trace, assertion diff, exit code).
- Run it again to confirm it fails consistently (flaky failures need to be noted as
  such rather than treated as a clean repro — record the failure rate observed).
- Record expected behavior (what should happen — from docs, tests, or the user's
  description) versus actual behavior (what happens now).
- Capture environment: OS, language/runtime version, current git branch and commit
  (`git rev-parse HEAD`), and any dependency versions relevant to the failure.

If the failure cannot be reproduced with the information available, do NOT fabricate
a repro — report exactly what's missing (e.g. "need the input file that triggers
this", "need a way to hit this endpoint locally") and stop before completing the
phase.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "bughunt", phase: "repro",
summary: "reliable reproduction captured for \"<short description>\"; reproduced <N>/<N> runs; environment <os/runtime summary>",
data: {
  "reproCommand": "<exact failing command/test>",
  "expectedBehavior": "<what should happen>",
  "actualBehavior": "<what happens instead>",
  "errorOutput": "<raw stack trace / assertion diff / error text>",
  "environment": "<OS>, <runtime + version>, branch `<branch>` @ `<commit sha>`, <relevant dependency versions>"
}
```

The tool validates this is the current phase, advances the run to `diagnose`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/bughunt/state.json`).
> Run `/bughunt-diagnose` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
