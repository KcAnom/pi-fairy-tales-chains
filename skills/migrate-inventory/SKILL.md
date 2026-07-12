---
name: migrate-inventory
description: >
  Phase 1 of 3 in the migrate chain (inventory → transform → verify) — the
  durable, human-in-the-loop code migration pipeline. Fans out fairy-tales
  explore-role subagents to find EVERY call site of the thing being migrated and
  records them as a per-site checklist in the shared state file. This phase
  creates the state file. Trigger whenever the user wants to migrate, replace,
  swap out, or upgrade something across a codebase: "migrate-inventory",
  "start a migration", "migrate <thing>", "begin the migrate chain", or
  standalone "migrate".
---

# Migrate: Inventory

Chain version: 1

Phase 1 of 3: **migrate-inventory** → migrate-transform → migrate-verify

## Overview

Entry point of the `migrate` chain. Fans out fairy-tales `agent` (role:
`explore`) subagents to locate every call site of the thing being migrated — an
API, a function, a dependency, a pattern — and records the full list as a
`file:line` checklist in `.migrate-state.md`. This inventory is the backbone of
the whole chain: a large migration can span many sessions, and the checklist is
what lets `migrate-transform` resume exactly where it left off, and what lets
`migrate-verify` confirm nothing was missed.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.migrate-state.md` exists and its `status` is **not** `complete`, a
  migration is already mid-flight. Show the current `status` and the inventory
  checklist progress (N done / M pending) and ask the user whether to resume
  from the matching phase or discard and start over. Do not silently overwrite.
- If `.migrate-state.md` exists with `status: complete`, this is a fresh
  migration — proceed to overwrite it with a new run.
- Check for `.migrate-state.lock`. If present, abort: "Another session appears
  to be running this chain (lock file present). Remove `.migrate-state.lock` if
  that's stale." Otherwise create it before writing state.

### Step 2 — Define the migration target

Confirm with the user (or infer from the task) exactly what is being migrated —
the old symbol, API, dependency, or pattern — and what it's being replaced with.
This becomes the `target`/`replacement` fields in the state file and the brief
every explore subagent will receive.

### Step 3 — Fan out explore-role subagents

Use the fairy-tales `agent` tool with `role: "explore"` to search the codebase
for every occurrence of the migration target. Split the search by directory,
module, or file-type boundary and issue several `agent` calls with `role:
"explore"` in **one message** so they run in parallel. Each subagent task must
be self-contained: give it the exact symbol/pattern to search for and tell it to
return every match as `file:line` plus a one-line snippet of context.

Merge the results from all explore subagents into a single deduplicated list.
This list is authoritative — do not spot-check by hand afterward and silently
add sites; if more turn up later, add them to the checklist explicitly instead.

### Step 4 — Build the checklist

Format the merged results as a Markdown checklist, one `- [ ] file:line —
<snippet>` entry per call site, sorted by file then line.

### Step 5 — Update State

Write the full new `.migrate-state.md` atomically (temp file + rename — never
edit in place):

```bash
cat > .migrate-state.md.tmp <<'EOF'
---
task: "migrate <description>"
started: <ISO 8601 timestamp>
status: inventory-done
chain_version: 1
target: "<old symbol/API/dependency/pattern being migrated>"
replacement: "<what it's being migrated to>"
---

## Phase 1 — Inventory
**Output**: N call sites found across M files by K explore subagents
**Key decisions**: search split used (directories/modules assigned per subagent)

## Inventory
- [ ] path/to/file.ts:42 — <snippet>
- [ ] path/to/file2.ts:108 — <snippet>
EOF
mv .migrate-state.md.tmp .migrate-state.md
```

Delete `.migrate-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.migrate-state.md`.
> Run `/migrate-transform` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
