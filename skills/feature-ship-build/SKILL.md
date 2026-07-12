---
name: feature-ship-build
description: >
  Phase 2 of 4 in the feature-ship chain (spec → build → review → ship). Implements the
  spec from Phase 1, preferring /ultraplan (isolated git worktree) or fairy-tales
  build-role subagents, with the post-edit .pi/test-command hook self-repairing test
  failures as it goes. Trigger when the previous phase says run feature-ship-build
  next, or standalone via "feature-ship-build", "phase 2 of feature-ship", "implement
  the spec", "build the feature".
---

# Feature Ship: Build

Chain version: 1

Phase 2 of 4: feature-ship-spec → **feature-ship-build** → feature-ship-review → feature-ship-ship

## Overview

Implements the spec produced in Phase 1. Prefers `/ultraplan` when the change is large
enough to warrant an isolated git worktree, or fairy-tales **build-role subagents**
otherwise, so implementation happens against a dedicated execution context rather than
inline improvisation. The post-edit `.pi/test-command` hook fires after every edit and
self-repairs test failures as they happen, so this phase doesn't need a separate manual
test-fix loop.

## Load State

Read `.feature-ship-state.md` from the project root:

- If missing → abort: "No state file found. Run `feature-ship-spec` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `spec-done | build-done | review-done | complete` → abort:
  "Unrecognized status — this state file may belong to a different or since-edited
  chain."
- If `status` ≠ `spec-done` → abort: "Expected status `spec-done` but found `<actual>`.
  Run the previous phase first."
- If the `## Phase 1 — Spec` section or the `acceptance_criteria` field is missing →
  abort: "Status looks right but the Phase 1 output is missing. Treat as corrupted."
- Check `.feature-ship-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Choose the execution path

- If the spec's "Files to Touch" spans multiple modules, is a multi-step change, or the
  user wants an isolated, inspectable working copy, run `/ultraplan` against the spec —
  it opens an isolated git worktree so the implementation can be built, tested, and
  discarded without touching the working tree the user is looking at.
- Otherwise, dispatch one or more fairy-tales **build-role subagents**, one per
  independent piece of the spec, each briefed with the relevant slice of the spec (goal,
  approach, files to touch, acceptance criteria) rather than the whole spec dump.

### Step 2 — Implement against the acceptance criteria

Implement every file change called out in the spec. After each edit, the project's
post-edit `.pi/test-command` hook (if configured) runs automatically and attempts to
self-repair any test failure it introduces — do not manually re-run the same fix twice
if the hook already retried; read its output and address the root cause if it still
fails after the hook's attempt.

### Step 3 — Record what was built

Capture, precisely:

- Branch name and/or worktree path (if `/ultraplan` was used).
- The actual files changed (from `git status` / `git diff --stat`), not just the files
  the spec predicted.
- Whether a patch file was produced instead of a live branch (e.g., worktree discarded
  after `/ultraplan` exports a diff) — if so, its path.

### Step 4 — Update State

Atomically rewrite `.feature-ship-state.md` (temp file + rename), appending:

```markdown
## Phase 2 — Build
**Output**: implemented via <ultraplan worktree | build-role subagent(s)> at
<branch/worktree/patch path>
**Key decisions**: files changed: <list>; deviations from the spec (if any) and why
```

and updating `status: build-done`. Delete `.feature-ship-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.feature-ship-state.md`.
> Run `/feature-ship-review` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
