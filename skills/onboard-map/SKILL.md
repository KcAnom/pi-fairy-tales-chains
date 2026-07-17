---
name: onboard-map
description: >
  Phase 1 of 3 in the onboard chain (map → deepen → digest) — the durable
  repo-onboarding pipeline. Entry point: fans out fairy-tales explore-role subagents in
  parallel, via durable quests, to map an unfamiliar repo's entry points, largest/most-
  connected files, config, test layout, dependency graph, and conventions. This phase
  starts the durable chain run (state tracked by the chain tool). Trigger whenever the
  user wants to onboard onto an unfamiliar codebase, learn a new repo, or start the
  onboard chain: "onboard-map", "onboard this repo", "map the codebase", "start the
  onboard chain", "learn this project", or standalone "onboard".
---

# Onboard: Map

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 3: **onboard-map** → onboard-deepen → onboard-digest

## Overview

Entry point of the `onboard` chain. Fans out fairy-tales explore-role subagents in
parallel, via durable quests, to build a first structural map of an unfamiliar repo —
before anyone reads a single file line by line.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/onboard/state.json` with a human-readable `state.md`
projection beside it (a legacy `.onboard-state.md` from an older version is imported
automatically). Never create or edit state files by hand, and never create lock files
— the tool locks for you.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "onboard"`:

- If an **active** run exists, an onboarding session is already mid-flight (the status
  shows its current phase). Show the user the status and ask whether to **resume** from
  the current phase (run that phase's skill) or **discard** it (`action: "abandon"`)
  and start over. Do not silently overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned (a completed prior run over
  the same repo just means its digest already exists — note that, then continue with a
  fresh map), start fresh: `action: "start", chain: "onboard", task: "onboard
  <repo/path>"`. Note the `runId` in the response — it keys this run's quest dedupe
  keys.

### Step 2 — Fan out explore-role subagents via durable quests

Because mapping a repo can be long-running and must survive a session restart, use the
**quest tool** rather than bare agent calls. For each concern below, `enqueue` a quest
with `role: "explore"`, a self-contained task, and:

- `dedupeKey: "onboard/<runId>/map/<area>"` (`<area>` is the concern id below) —
  re-running a crashed phase returns the same quest instead of duplicating work;
- `chain: { chain: "onboard", runId: "<runId>", phase: "map" }`;
- `retainUntilConsumed: true`.

Issue all six `enqueue` calls in **one message** so they run in parallel:

- **`entry-points`** — how the project is launched/served (`main`, `bin`, `index`,
  framework entrypoints, CLI commands, `package.json`/`pyproject.toml` scripts).
- **`hotspots`** — the files with the most imports-in and imports-out (a cheap proxy
  for "core" modules), plus raw largest-by-line-count files.
- **`config`** — env files, config loaders, feature flags, build tooling
  (`*.config.*`, `.env*`, CI workflow files).
- **`tests`** — test framework(s) in use, directory conventions, how to run the
  suite, coverage of the hotspot files found above.
- **`dep-graph`** — top-level module/package boundaries and how they depend on each
  other (a coarse graph, not a full call graph).
- **`conventions`** — naming, formatting, commit style, any `CLAUDE.md`/
  `CONTRIBUTING.md` already in the repo.

If a returned quest is already `done` (crash-resume case), reuse its stored result;
otherwise `quest` action `run` with its `id` and collect the result. After extracting
what's needed into chain state (Step 4), `quest` action `consume` each quest by `id`.

### Step 3 — Assemble the map

Merge the six quest results into one consolidated map: entry points, hotspot files
(ranked), config surface, test layout, dependency graph, conventions. This is the raw
material Phase 2 (`onboard-deepen`) will target for deep reads — flag the top 3-6
hotspots explicitly so the next phase knows exactly what to read deeply.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "onboard", phase: "map",
summary: "consolidated repo map assembled (entry points, hotspots, config, tests, dep graph, conventions); top hotspots flagged for Phase 2: <list>",
data: {
  "map": "<the consolidated map, in full, as markdown>",
  "hotspots": [
    { "file": "<path>", "reason": "<why it's a hotspot>" }
  ]
},
artifacts: { "mapQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `deepen`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/onboard/state.json`).
> Run `/onboard-deepen` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
