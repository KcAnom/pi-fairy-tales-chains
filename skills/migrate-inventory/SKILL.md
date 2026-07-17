---
name: migrate-inventory
description: >
  Phase 1 of 3 in the migrate chain (inventory → transform → verify) — the
  durable, human-in-the-loop code migration pipeline. Fans out fairy-tales
  explore-role subagents to find EVERY call site of the thing being migrated and
  records them as a per-site checklist in the chain's durable state. This phase
  starts the durable chain run (state tracked by the chain tool). Trigger whenever
  the user wants to migrate, replace, swap out, or upgrade something across a
  codebase: "migrate-inventory", "start a migration", "migrate <thing>", "begin the
  migrate chain", or standalone "migrate".
---

# Migrate: Inventory

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 3: **migrate-inventory** → migrate-transform → migrate-verify

## Overview

Entry point of the `migrate` chain. Fans out fairy-tales `explore` role subagents to
locate every call site of the thing being migrated — an API, a function, a
dependency, a pattern — and records the full list as a `file:line` checklist in chain
state. This inventory is the backbone of the whole chain: a large migration can span
many sessions, and the checklist is what lets `migrate-transform` resume exactly where
it left off, and what lets `migrate-verify` confirm nothing was missed.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/migrate/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "migrate"`:

- If an **active** run exists, a migration is already mid-flight (the status shows its
  current phase and, once inventoried, the checklist progress — a legacy
  `.migrate-state.md` from an older version is imported automatically). Show the user
  the status and ask whether to **resume** from the current phase (run that phase's
  skill) or **discard** it (`action: "abandon"`) and start over. Do not silently
  overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned, start fresh:
  `action: "start", chain: "migrate", task: "migrate <description>"`. Note the `runId`
  in the response — it keys this run's quest dedupe keys.

### Step 2 — Define the migration target

Confirm with the user (or infer from the task) exactly what is being migrated —
the old symbol, API, dependency, or pattern — and what it's being replaced with.
This becomes the `target`/`replacement` values recorded in chain state and the brief
every explore quest will receive.

### Step 3 — Fan out explore-role subagents via durable quests

Because a large codebase search can be long-running and must survive a session
restart, use the **quest tool** rather than bare agent calls. Split the search by
directory, module, or file-type boundary and, for each split, `enqueue` a quest with:

- `role: "explore"`, a self-contained task (the exact symbol/pattern to search for,
  and instruction to return every match as `file:line` plus a one-line snippet of
  context);
- `dedupeKey: "migrate/<runId>/inventory/<split>"` (a descriptive id for the
  directory/module/file-type this quest covers) — re-running a crashed phase returns
  the same quest instead of duplicating a search;
- `chain: { chain: "migrate", runId: "<runId>", phase: "inventory" }`;
- `retainUntilConsumed: true`.

Issue all the split quests' `enqueue` calls in **one message** so they run in
parallel. If a returned quest is already `done` (crash-resume case), reuse its stored
result; otherwise `quest` action `run` with its `id` and collect the result.

Merge the results from all explore quests into a single deduplicated list. This list
is authoritative — do not spot-check by hand afterward and silently add sites; if more
turn up later, add them to the checklist explicitly instead. After extracting what's
needed into chain state (Step 5), `quest` action `consume` each quest by `id`.

### Step 4 — Build the checklist

Format the merged results as a list of per-site entries, one `{ "site": "file:line",
"snippet": "<context>", "done": false }` object per call site, sorted by file then
line.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "migrate", phase: "inventory",
summary: "N call sites found across M files by K explore quests; search split used (directories/modules assigned per quest)",
data: {
  "target": "<old symbol/API/dependency/pattern being migrated>",
  "replacement": "<what it's being migrated to>",
  "inventory": [
    { "site": "path/to/file.ts:42", "snippet": "<context>", "done": false },
    { "site": "path/to/file2.ts:108", "snippet": "<context>", "done": false }
  ]
},
artifacts: { "inventoryQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `transform`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/migrate/state.json`).
> Run `/migrate-transform` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
