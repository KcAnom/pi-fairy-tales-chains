---
name: onboard-digest
description: >
  Phase 3 of 3 (final) in the onboard chain (map → deepen → digest). Uses the artifact
  tool to produce a polished, theme-aware, self-contained HTML architecture overview
  (module map, data-flow diagram, "start here" reading guide) and opens it, then writes
  the top facts to fairy-tales memory and closes the chain. Trigger when the previous
  phase says "run onboard-digest next", or standalone via "onboard-digest", "phase 3 of
  onboard", "digest the repo map", "produce the architecture overview".
---

# Onboard: Digest

Chain version: 1

Phase 3 of 3: onboard-map → onboard-deepen → **onboard-digest**

## Overview

Final phase. Turns the map from Phase 1 and the deepened understanding from Phase 2 into
a single polished deliverable: a self-contained HTML architecture overview, published
with the **artifact tool** and opened for the user. Also writes the top durable facts to
fairy-tales memory so a future session (even one that never runs this chain again) starts
with context. Reports faithfully — if a hotspot from Phase 1 was never deep-read in
Phase 2, the overview says so rather than glossing over the gap.

## Load State

Read `.onboard-state.md`:

- If missing → abort: "No state file found. Run `onboard-map` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed or
  incompatible-edition state file.
- If `status` is not one of `map-done | deepen-done | complete` → abort: "Unrecognized
  status — this state file may belong to a different or since-edited chain."
- If `status` ≠ `deepen-done` → abort: "Expected status `deepen-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 2 — Deepen` section is missing → abort: "Status looks right but the
  Phase 2 output is missing. Treat as corrupted."
- Check `.onboard-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Build the architecture overview content

From `## Phase 1 — Map` and `## Phase 2 — Deepen`, assemble:

- **Module map** — the repo's major modules/packages and how they relate.
- **Data-flow diagram** — the key flow(s) traced in Phase 2, shown visually.
- **"Start here" reading guide** — an ordered list of the 3-6 hotspot files a newcomer
  should read first, with a one-line reason for each (why it's the right starting point).

### Step 2 — Publish with the artifact tool

Write the content to an HTML file and publish it with the fairy-tales **artifact tool**
so it renders as a polished, theme-aware, self-contained page (inline CSS/JS only, no
external requests, honors light/dark). Open the resulting artifact for the user.

### Step 3 — Write top facts to memory

Call the fairy-tales memory `remember` tool with the highest-value durable facts from
the whole session (architecture summary, key conventions, gotchas) — a small, curated
set, not everything already stored in Phase 2.

## Update State

Atomically rewrite `.onboard-state.md` (temp file + rename), appending:

```markdown
## Phase 3 — Digest
**Output**: architecture overview artifact published and opened at <artifact URL/path>
**Key decisions**: top facts written to fairy-tales memory: <list>
```

and updating `status: complete`. Delete `.onboard-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. State written to `.onboard-state.md`.
> Run `onboard-map` again to start a new session.

Do not continue. Stop here.
