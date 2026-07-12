---
name: research-synthesize
description: >
  Phase 2 of 3 in the research chain (gather → synthesize → artifact). Compresses and
  dedupes the raw material gathered in Phase 1 into a structured synthesis — themes,
  findings, contradictions between sources, and open gaps. Trigger when the previous
  phase says "run research-synthesize next", or standalone via "research-synthesize",
  "phase 2 of research", "synthesize the research".
---

# Research: Synthesize

Chain version: 1

Phase 2 of 3: research-gather → **research-synthesize** → research-artifact

## Overview

Takes the per-source notes, quotes, and links gathered in Phase 1 and compresses them
into a structured synthesis: cross-source themes, the actual findings, where sources
contradict each other, and what's still an open gap. Makes no report yet — that's
Phase 3 — so this stays a focused analytical pass over already-gathered material.

## Load State

Read `.research-state.md` from the project root:

- If missing → abort: "No state file found. Run `research-gather` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `gather-done | synthesize-done | complete` → abort:
  "Unrecognized status — this state file may belong to a different or since-edited
  chain."
- If `status` ≠ `gather-done` → abort: "Expected status `gather-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 1 — Gather` section is missing despite the right status → abort:
  "Status looks right but the Phase 1 output is missing. Treat as corrupted."
- Check `.research-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Compress and dedupe

Read every per-source note from `## Phase 1 — Gather`. Merge overlapping points across
sources, dedupe repeated quotes/claims, and drop material that turned out irrelevant
to the research question.

### Step 2 — Extract themes and findings

Group the deduped material into cross-source themes. Under each theme, state the
concrete findings, citing which source(s) support each one.

### Step 3 — Surface contradictions

Explicitly call out anywhere two or more sources disagree — what each says, and (if
determinable) which is more credible or current. Do not silently resolve a
contradiction by picking a side without saying so.

### Step 4 — Identify gaps

List open questions the gathered material doesn't answer — these become the
"worth a follow-up round" notes that Phase 3 surfaces in the final report.

## Update State

Atomically rewrite `.research-state.md` (temp file + rename), appending:

```markdown
## Phase 2 — Synthesize
**Output**: N themes, M findings, K contradictions, J open gaps
**Key decisions**: <any judgment calls made while deduping or resolving overlaps>

<themes with findings and source citations>
<contradictions between sources>
<open gaps>
```

and updating `status: synthesize-done` in the frontmatter. Delete
`.research-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.research-state.md`.
> Run `/research-artifact` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
