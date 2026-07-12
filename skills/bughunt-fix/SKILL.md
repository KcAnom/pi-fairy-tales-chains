---
name: bughunt-fix
description: >
  Phase 3 of 4 in the bughunt chain (repro → diagnose → fix → verify). Implements the
  fix with a fairy-tales build-role subagent at the diagnosed file:line; the post-edit
  `.pi/test-command` hook self-repairs failing tests automatically; checkpoints are
  taken before and after the edit so a bad fix can be rolled back. Trigger when the
  previous phase says "run bughunt-fix next", or standalone via "bughunt-fix",
  "phase 3 of bughunt", "implement the fix", "fix the bug".
---

# Bughunt: Fix

Chain version: 1

Phase 3 of 4: bughunt-repro → bughunt-diagnose → **bughunt-fix** → bughunt-verify

## Overview

Implements the fix at the location `bughunt-diagnose` found, using a fairy-tales
`build` role subagent (`agent` tool, `role: "build"`) so the edit happens with a
tight, self-contained brief instead of the accumulated diagnosis conversation.
fairy-tales' post-edit hook (`.pi/test-command`, if the project has one) runs
automatically after the build-role agent's edits land and steers any failures back to
it to self-repair — this phase does not need to invoke tests manually, but must
report honestly if no `.pi/test-command` exists (the self-repair loop silently
doesn't run in that case). A checkpoint is captured before the edit and confirmed
after, so `bughunt-verify` (or the user) can roll back cleanly if the fix turns out
to be wrong.

## Load State

Read `.bughunt-state.md`:

- If missing → abort: "No state file found. Run `bughunt-repro` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `repro-done | diagnose-done | fix-done | complete` →
  abort: "Unrecognized status — this state file may belong to a different or
  since-edited chain."
- If `status` ≠ `diagnose-done` → abort: "Expected status `diagnose-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 2 — Diagnose` section or the `Location` field is missing → abort:
  "Status looks right but the Phase 2 output is missing. Treat as corrupted."
- Check `.bughunt-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Checkpoint before

Before any edit, record the current baseline so a bad fix is trivially reversible:
run `git status --short` (working tree should be clean or the pre-existing dirt
noted) and `git rev-parse HEAD`. Record this commit SHA as the **before** checkpoint.
If the fairy-tales checkpoint extension has an existing checkpoint list, note the
most recent one via `/checkpoints` as the fallback rollback point too.

### Step 2 — Delegate the fix

Launch a fairy-tales `build` role subagent (`agent` tool, `role: "build"`) with a
self-contained brief built from the state file: the root-cause hypothesis and exact
`file:line` from `## Phase 2 — Diagnose`, the repro command, and expected vs. actual
behavior from `## Phase 1 — Repro`. Instruct it to make the minimal change that fixes
the root cause — not a broader refactor — and to avoid touching unrelated code.

### Step 3 — Let the post-edit hook self-repair

Once the build-role agent's edits land, fairy-tales' post-edit hook automatically
runs the project's `.pi/test-command` (if present) and steers any failures back to
the agent loop to fix, retrying until tests pass or it gives up. Let this run to
completion rather than re-running tests manually. If `.pi/test-command` does not
exist in the project, say so explicitly in the state update — the fix was not
auto-verified by tests and `bughunt-verify` will need to lean more heavily on the
broader test suite it runs directly.

### Step 4 — Checkpoint after

After the build-role agent's edit turn completes (and any self-repair loop
settles), fairy-tales' checkpoint extension automatically snapshots the working tree
(`git stash create`) at turn end. Confirm the new checkpoint exists via
`/checkpoints` and record its SHA/label as the **after** checkpoint. If verification
in the next phase fails, `/rollback` can restore to the **before** checkpoint.

## Update State

Atomically rewrite `.bughunt-state.md` (temp file + rename — see Rule 5, atomic
writes):

```bash
cat > .bughunt-state.md.tmp <<'EOF'
<full existing frontmatter and Phase 1/2 sections, unchanged, plus:>

## Phase 3 — Fix
**Output**: fix implemented at <file:line> via build-role subagent
**Key decisions**: checkpoint before <sha>; checkpoint after <sha/label>; test hook
<ran and passed / ran and self-repaired N times then passed / not configured — no
.pi/test-command>

**Fix summary**: <what changed and why it addresses the root cause>

**Files changed**: <list>

**Checkpoint before**: `<sha>`

**Checkpoint after**: `<sha or checkpoint label from /checkpoints>`

**Test hook result**: <pass / self-repaired (N iterations) / not configured>
EOF
mv .bughunt-state.md.tmp .bughunt-state.md
```

and set `status: fix-done` in the frontmatter. Delete `.bughunt-state.lock` after the
write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. State written to `.bughunt-state.md`.
> Run `/bughunt-verify` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
