---
name: bughunt-fix
description: >
  Phase 3 of 4 in the bughunt chain (repro → diagnose → fix → verify). Implements the
  fix with a fairy-tales build-role subagent at the diagnosed file:line; the post-edit
  `.pi/test-command` hook self-repairs failing tests automatically; checkpoints are
  taken before and after the edit so a bad fix can be rolled back. Trigger when the
  previous phase says "run bughunt-fix next", or standalone via "bughunt-fix",
  "phase 3 of bughunt", "implement the fix", "fix the bug".
---

# Bughunt: Fix

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 4: bughunt-repro → bughunt-diagnose → **bughunt-fix** → bughunt-verify

## Overview

Implements the fix at the location `bughunt-diagnose` found, using a fairy-tales
`build` role subagent so the edit happens with a tight, self-contained brief instead
of the accumulated diagnosis conversation. fairy-tales' post-edit hook
(`.pi/test-command`, if the project has one) runs automatically after the build-role
agent's edits land and steers any failures back to it to self-repair — this phase does
not need to invoke tests manually, but must report honestly if no `.pi/test-command`
exists (the self-repair loop silently doesn't run in that case). A checkpoint is
captured before the edit and confirmed after, so `bughunt-verify` (or the user) can
roll back cleanly if the fix turns out to be wrong.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/bughunt/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "bughunt"` (a legacy
`.bughunt-state.md` from an older version is imported automatically):

- If there is no run → abort: "No bughunt run found. Run `bughunt-repro` first."
- If the run is not `active` with `currentPhase: "fix"` → abort: "Expected the run to
  be at phase `fix` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If the diagnosis data (`data.rootCause` / `data.location` or the diagnose phase
  summary) is missing → abort: "Phase pointer looks right but the Phase 2 output is
  missing. Treat as corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe key.

## Workflow

### Step 1 — Checkpoint before

Before any edit, record the current baseline so a bad fix is trivially reversible:
run `git status --short` (working tree should be clean or the pre-existing dirt
noted) and `git rev-parse HEAD`. Record this commit SHA as the **before** checkpoint.
If the fairy-tales checkpoint extension has an existing checkpoint list, note the
most recent one via `/checkpoints` as the fallback rollback point too.

### Step 2 — Delegate the fix via a durable quest

Because the fix must survive a session restart, use the **quest tool** rather than a
bare agent call: `enqueue` with `role: "build"`, a self-contained brief built from
chain state (the root-cause hypothesis and exact `file:line` from `data.rootCause` /
`data.location`, the repro command, and expected vs. actual behavior from Phase 1's
`data`), and:

- `dedupeKey: "bughunt/<runId>/fix/main"` — if this phase crashed and is being re-run,
  the same quest (or its retained result) is returned instead of starting a duplicate
  fix attempt;
- `chain: { chain: "bughunt", runId: "<runId>", phase: "fix" }`;
- `retainUntilConsumed: true`.

If the returned quest is already `done` (crash-resume case), use its stored result
directly. Otherwise `quest` action `run` with its `id` and collect the result.
Instruct it to make the minimal change that fixes the root cause — not a broader
refactor — and to avoid touching unrelated code. After extracting what's needed
(Step 5), `quest` action `consume` with the quest `id`.

### Step 3 — Let the post-edit hook self-repair

Once the build-role quest's edits land, fairy-tales' post-edit hook automatically
runs the project's `.pi/test-command` (if present) and steers any failures back to
the agent loop to fix, retrying until tests pass or it gives up. Let this run to
completion rather than re-running tests manually. If `.pi/test-command` does not
exist in the project, say so explicitly in the phase summary — the fix was not
auto-verified by tests and `bughunt-verify` will need to lean more heavily on the
broader test suite it runs directly.

### Step 4 — Checkpoint after

After the build-role quest's edit turn completes (and any self-repair loop
settles), fairy-tales' checkpoint extension automatically snapshots the working tree
(`git stash create`) at turn end. Confirm the new checkpoint exists via
`/checkpoints` and record its SHA/label as the **after** checkpoint. If verification
in the next phase fails, `/rollback` can restore to the **before** checkpoint.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "bughunt", phase: "fix",
summary: "fix implemented at <file:line> via build-role quest; checkpoint before <sha>; checkpoint after <sha/label>; test hook <ran and passed / ran and self-repaired N times then passed / not configured — no .pi/test-command>",
data: {
  "fixSummary": "<what changed and why it addresses the root cause>",
  "filesChanged": ["<path>", "..."],
  "checkpointBefore": "<sha>",
  "checkpointAfter": "<sha or checkpoint label from /checkpoints>",
  "testHookResult": "<pass / self-repaired (N iterations) / not configured>"
},
artifacts: { "fixQuest": "<quest id>" }
```

The tool validates this is the current phase, advances the run to `verify`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. Chain state updated (`.pi/fairy-tales/chains/bughunt/state.json`).
> Run `/bughunt-verify` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
