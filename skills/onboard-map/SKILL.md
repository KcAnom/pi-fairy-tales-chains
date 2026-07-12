---
name: onboard-map
description: >
  Phase 1 of 3 in the onboard chain (map → deepen → digest) — the durable repo-onboarding
  pipeline. Entry point: fans out fairy-tales explore-role subagents in parallel to map an
  unfamiliar repo's entry points, largest/most-connected files, config, test layout,
  dependency graph, and conventions. Creates the shared state file. Trigger whenever the
  user wants to onboard onto an unfamiliar codebase, learn a new repo, or start the onboard
  chain: "onboard-map", "onboard this repo", "map the codebase", "start the onboard chain",
  "learn this project", or standalone "onboard".
---

# Onboard: Map

Chain version: 1

Phase 1 of 3: **onboard-map** → onboard-deepen → onboard-digest

## Overview

Entry point of the `onboard` chain. Fans out fairy-tales explore-role subagents in
parallel to build a first structural map of an unfamiliar repo — before anyone reads a
single file line by line. This is the phase that creates `.onboard-state.md`; the later
phases only read and update it.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.onboard-state.md` exists and its `status` is **not** `complete`, an onboarding
  session is already mid-flight. Show the current `status` and ask the user whether to
  resume from the matching phase or discard and start over. Do not silently overwrite.
- If `.onboard-state.md` exists with `status: complete`, this is a fresh session over
  the same repo — note the previous digest exists, then continue with a new map.
- Check for `.onboard-state.lock`. If present, abort: "Another session appears to be
  running this chain (lock file present). Remove `.onboard-state.lock` if that's stale."
  Otherwise create it before writing state.

### Step 2 — Fan out explore-role subagents in parallel

Launch fairy-tales **explore-role subagents**, one per concern, **in a single message
with multiple tool calls so they run in parallel**:

- **Entry points** — how the project is launched/served (`main`, `bin`, `index`,
  framework entrypoints, CLI commands, `package.json`/`pyproject.toml` scripts).
- **Largest / most-connected files** — the files with the most imports-in and
  imports-out (a cheap proxy for "core" modules), plus raw largest-by-line-count files.
- **Config surface** — env files, config loaders, feature flags, build tooling
  (`*.config.*`, `.env*`, CI workflow files).
- **Test layout** — test framework(s) in use, directory conventions, how to run the
  suite, coverage of the hotspot files found above.
- **Dependency graph** — top-level module/package boundaries and how they depend on
  each other (a coarse graph, not a full call graph).
- **Conventions** — naming, formatting, commit style, any `CLAUDE.md`/`CONTRIBUTING.md`
  already in the repo.

Each subagent reports back its findings as structured notes; do not let any single
subagent block the others — they must run concurrently.

### Step 3 — Assemble the map

Merge the parallel subagent reports into one consolidated map: entry points, hotspot
files (ranked), config surface, test layout, dependency graph, conventions. This is the
raw material Phase 2 (`onboard-deepen`) will target for deep reads — flag the top 3-6
hotspots explicitly so the next phase knows exactly what to read deeply.

### Step 4 — Update State

Write the full new `.onboard-state.md` atomically (temp file + rename — never edit in
place):

```bash
cat > .onboard-state.md.tmp <<'EOF'
---
task: "onboard <repo/path>"
started: <ISO 8601 timestamp>
status: map-done
chain_version: 1
repo: "<repo name or path>"
---

## Phase 1 — Map
**Output**: consolidated repo map (entry points, hotspots, config, tests, dep graph, conventions)
**Key decisions**: top hotspot files flagged for Phase 2 deep reads: <list>

<the consolidated map, in full, as markdown>
EOF
mv .onboard-state.md.tmp .onboard-state.md
```

Delete `.onboard-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.onboard-state.md`.
> Run `/onboard-deepen` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
