---
name: feature-ship-review
description: >
  Phase 3 of 4 in the feature-ship chain (spec → build → review → ship). Runs the
  deep-review skill and fairy-tales review-role subagents against the Phase 2 diff,
  collecting blocking and non-blocking findings for Phase 4 to act on. Trigger when the
  previous phase says run feature-ship-review next, or standalone via
  "feature-ship-review", "phase 3 of feature-ship", "review the build", "review this
  feature".
---

# Feature Ship: Review

Chain version: 1

Phase 3 of 4: feature-ship-spec → feature-ship-build → **feature-ship-review** → feature-ship-ship

## Overview

Reviews the diff produced in Phase 2 against the spec's acceptance criteria from Phase
1. Runs the **deep-review skill** for a structured multi-angle pass over the diff, and
dispatches fairy-tales **review-role subagents** for targeted checks (correctness,
security, spec conformance), then merges everything into one findings list split into
blocking and non-blocking so Phase 4 knows exactly what must be fixed before shipping.

## Load State

Read `.feature-ship-state.md`:

- If missing → abort: "No state file found. Run `feature-ship-spec` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed or
  incompatible-edition state file.
- If `status` is not one of `spec-done | build-done | review-done | complete` → abort:
  "Unrecognized status — this state file may belong to a different or since-edited
  chain."
- If `status` ≠ `build-done` → abort: "Expected `build-done` but found `<actual>`. Run
  the previous phase first."
- If the `## Phase 2 — Build` section or the branch/worktree/patch location is missing
  → abort as corrupted.
- Check `.feature-ship-state.lock`; abort if present, else create it.

## Workflow

### Step 1 — Assemble the diff

Get the exact diff to review from the location Phase 2 recorded (branch, worktree, or
patch file). Do not re-derive it from the spec — review what was actually built.

### Step 2 — Run the deep-review skill

Invoke the **deep-review skill** against the diff. Let it run its full multi-angle
pass (correctness, edge cases, consistency) rather than summarizing it yourself.

### Step 3 — Dispatch review-role subagents

Dispatch fairy-tales **review-role subagents** in parallel, each with a narrow brief:

- One checks the diff against the Phase 1 acceptance criteria specifically — does every
  criterion have code behind it?
- One checks for correctness/security issues the deep-review skill's pass might not
  specialize in (e.g., auth, injection, data handling) if the diff touches that surface.
- Additional subagents as the diff's risk areas (from the Phase 1 spec's "Risks"
  section) warrant.

### Step 4 — Merge findings

Combine the deep-review skill's output and every review-role subagent's output into one
list. Classify each finding as:

- **Blocking** — violates an acceptance criterion, introduces a correctness/security
  bug, or breaks something that worked before.
- **Non-blocking** — style, minor cleanup, "nice to have" — safe to ship without.

### Step 5 — Update State

Atomically rewrite `.feature-ship-state.md` (temp file + rename), appending:

```markdown
## Phase 3 — Review
**Output**: deep-review skill + review-role subagent findings merged
**Key decisions**: <N> blocking, <M> non-blocking findings

### Blocking
- <finding 1>
- <finding 2>

### Non-blocking
- <finding 1>
```

and updating `status: review-done`. Delete `.feature-ship-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. State written to `.feature-ship-state.md`.
> Run `/feature-ship-ship` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
