---
name: migrate-transform
description: >
  Phase 2 of 3 in the migrate chain (inventory → transform → verify). Works
  through the per-site inventory checklist, transforming each call site and
  checking it off in the shared state file as it goes so an interrupted
  migration resumes at the first pending entry. Trigger when the previous phase
  says "run migrate-transform next", or standalone via "migrate-transform",
  "phase 2 of migrate", "continue the migration", "resume the migration".
---

# Migrate: Transform

Chain version: 1

Phase 2 of 3: migrate-inventory → **migrate-transform** → migrate-verify

## Overview

Works through the `.migrate-state.md` inventory checklist produced by Phase 1,
transforming each call site from `target` to `replacement`. This is the phase
that can span many sessions on a large migration — the checklist's per-site
`[ ]`/`[x]` status is what lets it resume at exactly the first pending entry
instead of re-scanning the codebase or re-doing finished work.

## Load State

Read `.migrate-state.md` from the project root:

- If missing → abort: "No state file found. Run `migrate-inventory` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file
  is malformed or written by an incompatible edition of the chain.
- If `status` is not one of `inventory-done | transform-done | complete` →
  abort: "Unrecognized status — this state file may belong to a different or
  since-edited chain."
- If `status` ≠ `inventory-done` → abort: "Expected status `inventory-done` but
  found `<actual>`. Run the previous phase first."
- If the `## Phase 1 — Inventory` section or the `## Inventory` checklist is
  missing → abort: "Status looks right but the Phase 1 output is missing. Treat
  as corrupted."
- Check `.migrate-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Find the first pending entry

Parse the `## Inventory` checklist. If every entry is already `[x]`, skip to
Step 4 (Update State) with `status: transform-done` — nothing left to
transform. Otherwise, start from the first `[ ]` entry (the resume point).

### Step 2 — Transform each site

For each pending entry, in order:

- Prefer **`/ultraplan`** for a batch of related sites — it plans the change,
  gets your approval, and executes it inside an **isolated git worktree** so the
  working tree stays clean until the batch is proven. Good for sites that share
  a shape (e.g. the same call signature change repeated across files).
- Prefer the fairy-tales `agent` tool with `role: "build"` for sites (or small
  batches of sites) that are independent and don't need the full plan/approval
  gate — issue several `agent` calls with `role: "build"` in one message to
  transform unrelated sites in parallel.
- Either way, give the subagent/worktree run a self-contained task: the exact
  `file:line`, the `target` → `replacement` mapping, and instruction to make the
  minimal surgical edit at that site only.

### Step 3 — Check off completed sites

After each site (or batch) succeeds, immediately mark it `[x]` in the
`## Inventory` checklist and rewrite `.migrate-state.md` atomically (Step 4
below) — do not batch all checkbox updates until the very end. This is what
makes the migration resumable: if the session is interrupted mid-batch, the next
`migrate-transform` invocation finds the first remaining `[ ]` and continues
from there. If a site fails to transform cleanly, leave it `[ ]`, append a
one-line note next to it (e.g. `- [ ] path/file.ts:42 — <snippet> (FAILED:
<reason>)`), and continue with the remaining sites rather than stopping the
whole phase.

### Step 4 — Update State

Once every entry in the checklist is `[x]` (or permanently annotated as failed
and the user has confirmed to proceed anyway), atomically rewrite
`.migrate-state.md` (temp file + rename), appending:

```markdown
## Phase 2 — Transform
**Output**: N/N sites transformed (list any FAILED sites and why)
**Key decisions**: /ultraplan used for <batches>; build-role subagents used for <sites>
```

and updating `status: transform-done`. Delete `.migrate-state.lock` after the
write. (Every intermediate per-site checkbox update in Step 3 is also an atomic
temp-file + `mv` rewrite of the same file — never edit `.migrate-state.md` in
place.)

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.migrate-state.md`.
> Run `/migrate-verify` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
