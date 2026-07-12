---
name: feature-ship-ship
description: >
  Phase 4 of 4 (final) in the feature-ship chain (spec → build → review → ship).
  Addresses blocking findings from Phase 3, commits using the /commit conventions, and
  opens a PR (or produces a patch if there's no remote), then closes the chain. Trigger
  when the previous phase says run feature-ship-ship next, or standalone via
  "feature-ship-ship", "phase 4 of feature-ship", "ship the feature", "ship it".
---

# Feature Ship: Ship

Chain version: 1

Phase 4 of 4: feature-ship-spec → feature-ship-build → feature-ship-review → **feature-ship-ship**

## Overview

Final phase. Fixes every blocking finding from Phase 3, commits the result using the
fairy-tales `/commit` conventions, and opens a PR — or, if the project has no remote,
produces a patch file instead so the work is still handed off cleanly. Reports
faithfully: if a blocking finding can't be resolved, it says so rather than shipping
past it.

## Load State

Read `.feature-ship-state.md`:

- If missing → abort: "No state file found. Run `feature-ship-spec` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed or
  incompatible-edition state file.
- If `status` is not one of `spec-done | build-done | review-done | complete` → abort:
  "Unrecognized status — this state file may belong to a different or since-edited
  chain."
- If `status` ≠ `review-done` → abort: "Expected `review-done` but found `<actual>`.
  Run the previous phase first."
- If the `## Phase 3 — Review` section or its Blocking/Non-blocking lists are missing →
  abort as corrupted.
- Check `.feature-ship-state.lock`; abort if present, else create it.

## Workflow

### Step 1 — Address blocking findings

Fix every item under Phase 3's **Blocking** list. Re-run the project's test command
after each fix. Do not proceed to commit while any blocking finding is still open — if
one genuinely can't be resolved in this phase, stop and report it instead of shipping
around it. Non-blocking findings may be left as-is; note them in the ship report for
the user's awareness.

### Step 2 — Commit using /commit conventions

Stage the changed files and commit following the fairy-tales `/commit` conventions
(conventional-commit type derived from the spec's nature — feat/fix/refactor —
imperative subject, body explaining why, referencing the Phase 1 spec).

### Step 3 — Open a PR, or produce a patch

- If the project has a configured remote: push the branch and open a PR with `gh pr
  create`, using the Phase 1 spec's Goals/Approach as the PR description and noting any
  non-blocking findings left for reviewers.
- If there is no remote: produce a patch file instead (`git format-patch` or `git diff`
  against the base branch) and tell the user where it was written — this is not a
  failure, just the no-remote path.

### Step 4 — Update State

Atomically rewrite `.feature-ship-state.md` (temp file + rename), appending:

```markdown
## Phase 4 — Ship
**Output**: committed via /commit conventions; <PR URL | patch file path>
**Key decisions**: blocking findings resolved: <list>; non-blocking findings left open:
<list>
```

and updating `status: complete`. Delete `.feature-ship-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 4 phases finished. State written to `.feature-ship-state.md`.
> Run `feature-ship-spec` again to start a new session.

Do not continue. Stop here.
