---
name: research-artifact
description: >
  Phase 3 of 3 (final) in the research chain (gather → synthesize → artifact). Uses
  the artifact tool to turn the Phase 2 synthesis into a polished, theme-aware,
  self-contained HTML research report, opens it, and closes the chain. Trigger when
  the previous phase says "run research-artifact next", or standalone via
  "research-artifact", "phase 3 of research", "build the research report".
---

# Research: Artifact

Chain version: 1

Phase 3 of 3: research-gather → research-synthesize → **research-artifact**

## Overview

Final phase. Turns the themes, findings, contradictions, and gaps from Phase 2 into a
polished, human-readable deliverable: a self-contained HTML research report produced
with the **artifact tool** and opened for the user. Notes any gaps worth a follow-up
research round, then marks the chain complete.

## Load State

Read `.research-state.md`:

- If missing → abort: "No state file found. Run `research-gather` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed or
  incompatible-edition state file.
- If `status` is unrecognized → abort: may belong to a different or since-edited chain.
- If `status` ≠ `synthesize-done` → abort: "Expected status `synthesize-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 2 — Synthesize` section is missing despite the right status → abort:
  "Status looks right but the Phase 2 output is missing. Treat as corrupted."
- Check `.research-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Build the report content

Turn the Phase 2 synthesis into report sections: an overview of the research question,
the themes with findings and source citations, a contradictions section, and an open
gaps / follow-up section. Write this content to a file the artifact tool can publish.

### Step 2 — Produce the artifact

Use the **artifact tool** to render the report as a polished, self-contained,
theme-aware HTML page (works in both light and dark viewer themes) and open it for the
user. Give it a concise title and a one-sentence description summarizing the research
question.

### Step 3 — Note follow-up gaps

Call out, in the chat response (not just inside the artifact), any open gaps from
Phase 2 that are substantial enough to justify a follow-up `research-gather` round.

## Update State

Atomically rewrite `.research-state.md` (temp file + rename), appending:

```markdown
## Phase 3 — Artifact
**Output**: HTML research report produced via the artifact tool and opened
**Key decisions**: <report URL/path>; gaps flagged for follow-up (if any)
```

and updating `status: complete` in the frontmatter. Delete `.research-state.lock`
after the write.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. State written to `.research-state.md`.
> Run `research-gather` again to start a new session.

Do not continue. Stop here.
