---
name: research-gather
description: >
  Phase 1 of 3 in the research chain (gather → synthesize → artifact). Collects raw
  material from user-provided sources — URLs, local docs, or topics — using the fetch
  tool (SSRF-safe) for remote content and explore-role subagents for local docs and
  broad exploration. This phase creates the shared state file. Trigger whenever the
  user wants to start a research run: "research-gather", "start a research chain",
  "phase 1 of research", "research this topic", "gather sources on X", or standalone
  "research".
---

# Research: Gather

Chain version: 1

Phase 1 of 3: **research-gather** → research-synthesize → research-artifact

## Overview

Entry point of the `research` chain. Takes the user's research question plus any
provided sources (URLs, local file/doc paths, or topics to explore) and collects raw
material: per-source notes, key quotes, and links. This is the phase that creates
`.research-state.md`; the later phases only read and update it.

Fetches remote content with the **fetch tool (SSRF-safe)** and dispatches
**explore-role subagents** to read local docs and codebase material, so the gather
pass covers both "on the web" and "already on disk" sources in parallel.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.research-state.md` exists and its `status` is **not** `complete`, a research
  run is already mid-flight. Show the current `status` and ask the user whether to
  resume from the matching phase or discard and start over. Do not silently overwrite.
- If `.research-state.md` exists with `status: complete`, this is a fresh run — note
  the prior `task` for context, then continue.
- Check for `.research-state.lock`. If present, abort: "Another session appears to be
  running this chain (lock file present). Remove `.research-state.lock` if that's
  stale." Otherwise create it before writing state.

### Step 2 — Identify sources

Clarify the research question and enumerate the sources to cover: explicit URLs the
user gave, local doc/codebase paths, and any topics that need open-ended discovery.

### Step 3 — Fetch remote sources

For each URL, use the **fetch tool (SSRF-safe)** to retrieve the content — it blocks
requests to private/internal/link-local IP ranges and unsafe redirect targets, so it
is the correct way to pull content from user-supplied or untrusted URLs. Never fetch
external URLs any other way in this phase.

### Step 4 — Explore local material

For local docs, codebases, or open-ended topics that need discovery rather than a
direct URL, dispatch **explore-role subagents** — one per source cluster or research
sub-question — to read the relevant files and report back a summary. Run independent
explore subagents in parallel where the sources don't depend on each other.

### Step 5 — Capture per-source notes

For every source (remote or local), record:

- Source name/URL/path
- A short summary of what it says
- Key quotes, captured verbatim with attribution
- Any links or citations found within it worth following up

### Step 6 — Update State

Write the full new `.research-state.md` atomically (temp file + rename — never edit
in place):

```bash
cat > .research-state.md.tmp <<'EOF'
---
task: "<research question / topic>"
started: <ISO 8601 timestamp>
status: gather-done
chain_version: 1
---

## Phase 1 — Gather
**Output**: raw material gathered from N sources (M remote via fetch tool, K local via
explore-role subagents)
**Key decisions**: <scope chosen, sources skipped and why>

<per-source notes: source, summary, key quotes, links>
EOF
mv .research-state.md.tmp .research-state.md
```

Delete `.research-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.research-state.md`.
> Run `/research-synthesize` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
