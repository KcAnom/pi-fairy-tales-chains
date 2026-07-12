---
name: migrate-verify
description: >
  Phase 3 of 3 (final) in the migrate chain (inventory → transform → verify).
  Runs the test suite and a fairy-tales review-role subagent over the full diff,
  confirms every inventoried call site was handled, and closes the chain.
  Trigger when the previous phase says "run migrate-verify next", or standalone
  via "migrate-verify", "phase 3 of migrate", "verify the migration".
---

# Migrate: Verify

Chain version: 1

Phase 3 of 3: migrate-inventory → migrate-transform → **migrate-verify**

## Overview

Final phase. Proves the migration is actually complete — the test suite passes,
a fairy-tales review subagent has looked at the full diff, and every site
recorded in Phase 1's inventory is checked off — then marks the chain complete.
Reports faithfully: if a check fails or a site was skipped, it says so rather
than declaring success.

## Load State

Read `.migrate-state.md`:

- If missing → abort: "No state file found. Run `migrate-inventory` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort:
  malformed/incompatible.
- If `status` is not one of `inventory-done | transform-done | complete` →
  abort: "Unrecognized status — this state file may belong to a different or
  since-edited chain."
- If `status` ≠ `transform-done` → abort: "Expected status `transform-done` but
  found `<actual>`. Run the previous phase first."
- If the `## Phase 2 — Transform` section or the `## Inventory` checklist is
  missing → abort as corrupted.
- Check `.migrate-state.lock`; abort if present, else create it.

## Workflow

### Step 1 — Confirm every site was handled

Re-read the `## Inventory` checklist. Every entry must be `[x]`. If any entry is
still `[ ]`, or is annotated `FAILED`, STOP here — do not proceed to a passing
report. Report exactly which `file:line` entries are unresolved and hand
control back to `migrate-transform` rather than marking the chain complete.

### Step 2 — Run the test suite

Run the project's real test command (check `.claude/test-command`, `package.json`
scripts, or the project's documented test runner). Capture pass/fail and any
failing test names — do not paper over a failure.

### Step 3 — Review the full diff

Use the fairy-tales `agent` tool with `role: "review"` over the full diff
produced by the migration (`git diff` against the commit before Phase 2 started,
or the `/ultraplan` branches/patches if worktrees were used). Ask it to flag any
remaining reference to `target`, any half-finished transform, or any regression
introduced by the change. Include its findings verbatim in the report.

### Step 4 — Report

Produce a short migration report: `target` → `replacement`, total sites
migrated, test suite result, review subagent findings, and the result of each
check (✓ / ✗). Name any check that failed and what to do about it.

## Update State

Atomically rewrite `.migrate-state.md` (temp + rename), appending:

```markdown
## Phase 3 — Verify
**Output**: verification report (all N/N sites confirmed handled; tests ✓/✗; review ✓/✗)
**Key decisions**: migration confirmed complete / <listed remaining issues>
```

and updating `status: complete`. Delete `.migrate-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. State written to `.migrate-state.md`.
> Run `migrate-inventory` again to start a new session.

Do not continue. Stop here.
