---
name: migrate-transform
description: >
  Phase 2 of 3 in the migrate chain (inventory → transform → verify). Works
  through the per-site inventory checklist, transforming each call site and
  checking it off in the chain's durable state as it goes so an interrupted
  migration resumes at the first pending entry. Trigger when the previous phase
  says "run migrate-transform next", or standalone via "migrate-transform",
  "phase 2 of migrate", "continue the migration", "resume the migration".
---

# Migrate: Transform

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 3: migrate-inventory → **migrate-transform** → migrate-verify

## Overview

Works through the inventory checklist produced by Phase 1 (`data.inventory` in chain
state), transforming each call site from `data.target` to `data.replacement`. This is
the phase that can span many sessions on a large migration — each site's `done` flag
is what lets it resume at exactly the first pending entry instead of re-scanning the
codebase or re-doing finished work.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/migrate/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "migrate"` (a legacy
`.migrate-state.md` from an older version is imported automatically):

- If there is no run → abort: "No migrate run found. Run `migrate-inventory` first."
- If the run is not `active` with `currentPhase: "transform"` → abort: "Expected the
  run to be at phase `transform` but it is at `<currentPhase/status>`. Run that
  phase's skill instead."
- If the inventory (`data.inventory` / `data.target` / `data.replacement`, or the
  inventory phase summary) is missing → abort: "Phase pointer looks right but the
  Phase 1 output is missing. Treat as corrupted — restart the chain or repair via
  chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe keys.

## Workflow

### Step 1 — Find the first pending entry

Read `data.inventory`. If every entry has `"done": true`, skip straight to Step 4
(Complete the phase) — nothing left to transform. Otherwise, start from the first
entry with `"done": false` (the resume point).

### Step 2 — Transform each site

For each pending entry, in order:

- Prefer **`/ultraplan`** for a batch of related sites — it plans the change,
  gets your approval, and executes it inside an **isolated git worktree** so the
  working tree stays clean until the batch is proven. Good for sites that share
  a shape (e.g. the same call signature change repeated across files). This path
  already has its own resumability (the worktree/branch) so it is run directly, not
  wrapped in a quest.
- For sites (or small batches of sites) that are independent and don't need the full
  plan/approval gate, delegate via the **quest tool** instead of a bare agent call so
  the work survives a session restart: `enqueue` with `role: "build"`,
  `dedupeKey: "migrate/<runId>/transform/<site>"` (the site's `file:line`, sanitized,
  or a batch id covering several independent sites), `chain: { chain: "migrate",
  runId: "<runId>", phase: "transform" }`, and `retainUntilConsumed: true`. Issue
  several `enqueue` calls in one message to transform unrelated sites/batches in
  parallel. If a returned quest is already `done` (crash-resume), reuse its result;
  otherwise `run` it by `id`, then `consume` it once its edit is recorded in Step 3.
- Either way, give the subagent/worktree run a self-contained task: the exact
  `file:line`, the `data.target` → `data.replacement` mapping, and instruction to
  make the minimal surgical edit at that site only.

### Step 3 — Check off completed sites

After each site (or batch) succeeds, immediately set that entry's `"done": true` in
`data.inventory` and persist it with the **chain tool**: `action: "update", chain:
"migrate", data: { "inventory": [...] }` (the full updated array) — do not batch all
checkbox updates until the very end. This is what makes the migration resumable: if
the session is interrupted mid-batch, the next `migrate-transform` invocation reads
`data.inventory` and continues from the first remaining `"done": false` entry. If a
site fails to transform cleanly, leave it `"done": false`, add a `"note": "FAILED:
<reason>"` field to its entry, and continue with the remaining sites rather than
stopping the whole phase.

### Step 4 — Complete the phase

Once every entry in `data.inventory` is `"done": true` (or permanently annotated as
failed and the user has confirmed to proceed anyway), call the **chain tool**:

```
action: "complete-phase", chain: "migrate", phase: "transform",
summary: "N/N sites transformed (list any FAILED sites and why); /ultraplan used for <batches>; build-role quests used for <sites>",
data: { "inventory": [ /* the final per-site array, each done: true or annotated FAILED */ ] },
artifacts: { "transformQuests": "<quest ids>", "ultraplanBranches": "<branch/worktree names, if used>" }
```

The tool validates this is the current phase, advances the run to `verify`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/migrate/state.json`).
> Run `/migrate-verify` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
