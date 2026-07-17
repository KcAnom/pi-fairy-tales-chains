---
name: research-gather
description: >
  Phase 1 of 3 in the research chain (gather → synthesize → artifact). Collects raw
  material from user-provided sources — URLs, local docs, or topics — using the fetch
  tool (SSRF-safe) for remote content and explore-role subagents for local docs and
  broad exploration. This phase starts the durable chain run (state tracked by the
  chain tool). Trigger whenever the user wants to start a research run:
  "research-gather", "start a research chain", "phase 1 of research", "research this
  topic", "gather sources on X", or standalone "research".
---

# Research: Gather

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 3: **research-gather** → research-synthesize → research-artifact

## Overview

Entry point of the `research` chain. Takes the user's research question plus any
provided sources (URLs, local file/doc paths, or topics to explore) and collects raw
material: per-source notes, key quotes, and links.

Fetches remote content with the **fetch tool (SSRF-safe)** and dispatches
**explore-role subagents** to read local docs and codebase material, so the gather
pass covers both "on the web" and "already on disk" sources in parallel.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/research/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "research"`:

- If an **active** run exists, a research run is already mid-flight (the status shows
  its current phase — a legacy `.research-state.md` from an older version is imported
  automatically). Show the user the status and ask whether to **resume** from the
  current phase (run that phase's skill) or **discard** it (`action: "abandon"`) and
  start over. Do not silently overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned, start fresh:
  `action: "start", chain: "research", task: "<research question / topic>"`. Note the
  `runId` in the response — it keys this run's quest dedupe keys.

### Step 2 — Identify sources

Clarify the research question and enumerate the sources to cover: explicit URLs the
user gave, local doc/codebase paths, and any topics that need open-ended discovery.

### Step 3 — Fetch remote sources

For each URL, use the **fetch tool (SSRF-safe)** to retrieve the content — it blocks
requests to private/internal/link-local IP ranges and unsafe redirect targets, so it
is the correct way to pull content from user-supplied or untrusted URLs. Never fetch
external URLs any other way in this phase.

### Step 4 — Explore local material via durable quests

For local docs, codebases, or open-ended topics that need discovery rather than a
direct URL, dispatch **explore-role subagents** — one per source cluster or research
sub-question. Because this exploration can be long-running and must survive a session
restart, use the **quest tool** rather than a bare agent call:

- `quest` action `enqueue` with `role: "explore"`, a self-contained task (the source
  cluster or sub-question, and what to report back), and:
  - `dedupeKey: "research/<runId>/gather/<cluster>"` (a descriptive id for the source
    cluster/sub-question) — re-running a crashed phase returns the same quest instead
    of duplicating exploration;
  - `chain: { chain: "research", runId: "<runId>", phase: "gather" }`;
  - `retainUntilConsumed: true`.
- Issue independent clusters' `enqueue` calls in one message so they run in parallel.
- If a returned quest is already `done` (crash-resume case), reuse its stored result;
  otherwise `quest` action `run` with its `id` and collect the result. After
  extracting what's needed into chain state (Step 6), `quest` action `consume` each
  quest by `id`.

### Step 5 — Capture per-source notes

For every source (remote or local), record:

- Source name/URL/path
- A short summary of what it says
- Key quotes, captured verbatim with attribution
- Any links or citations found within it worth following up

### Step 6 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "research", phase: "gather",
summary: "raw material gathered from N sources (M remote via fetch tool, K local via explore quests); scope chosen, sources skipped and why",
data: {
  "sources": [
    { "source": "<name/URL/path>", "summary": "<short summary>", "quotes": ["<quote>", "..."], "links": ["<link>", "..."] }
  ]
},
artifacts: { "exploreQuests": "<quest ids>" }
```

The tool validates this is the current phase, advances the run to `synthesize`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/research/state.json`).
> Run `/research-synthesize` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
