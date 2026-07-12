---
name: bughunt-verify
description: >
  Phase 4 of 4 (final) in the bughunt chain (repro → diagnose → fix → verify).
  Re-runs the original repro to confirm it's resolved, runs the broader test suite,
  checks for regressions, and reports faithfully — naming any check that fails.
  Trigger when the previous phase says "run bughunt-verify next", or standalone via
  "bughunt-verify", "phase 4 of bughunt", "verify the fix", "confirm the bug is
  fixed".
---

# Bughunt: Verify

Chain version: 1

Phase 4 of 4: bughunt-repro → bughunt-diagnose → bughunt-fix → **bughunt-verify**

## Overview

Final phase. Proves the fix actually resolved the bug — the exact repro from Phase 1
no longer reproduces the failure — and that the broader test suite still passes, then
closes the chain. Reports faithfully: if a check fails, it says so and points at the
Phase 3 checkpoints for rollback, rather than declaring success.

## Load State

Read `.bughunt-state.md`:

- If missing → abort: "No state file found. Run `bughunt-repro` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `repro-done | diagnose-done | fix-done | complete` →
  abort: "Unrecognized status — this state file may belong to a different or
  since-edited chain."
- If `status` ≠ `fix-done` → abort: "Expected status `fix-done` but found `<actual>`.
  Run the previous phase first."
- If the `## Phase 3 — Fix` section or the `repro_command` field is missing → abort:
  "Status looks right but the Phase 3 output is missing. Treat as corrupted."
- Check `.bughunt-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Re-run the original repro

Run the exact `repro_command` from the frontmatter (unchanged from Phase 1 — do not
substitute a different command). Compare the result against the **Expected
behavior** recorded in `## Phase 1 — Repro`:
- Matches expected → repro check ✓.
- Still matches the old **Actual behavior** (or errors differently but still fails)
  → repro check ✗. Do not soften this into a partial pass.

### Step 2 — Run the broader test suite

Run the project's full test command (not just the post-edit hook's scoped run from
Phase 3) — e.g. `.pi/test-command` in full-suite form if it supports one, or the
project's standard `npm test` / `pytest` / equivalent. This is what catches
regressions the narrow post-edit hook run in Phase 3 wouldn't have exercised.

### Step 3 — Check for regressions

Compare the broader suite's result to a known-good baseline if one is available (e.g.
CI status on the pre-fix commit, or simply "did anything fail that wasn't failing
before"). Name any newly-failing test explicitly — do not lump it in as "some tests
failed."

### Step 4 — Report

Produce a short verification report: the bug, the fix location, and the result of
each check (✓ / ✗) — repro re-run, broader suite, regressions. If anything failed,
say so plainly and point at the **Checkpoint before** SHA recorded in
`## Phase 3 — Fix` as the rollback target (`/rollback`), and recommend re-running
`bughunt-fix` (or `bughunt-diagnose` if the root cause looks wrong) rather than
patching further in this phase.

## Update State

Atomically rewrite `.bughunt-state.md` (temp file + rename — see Rule 5, atomic
writes):

```bash
cat > .bughunt-state.md.tmp <<'EOF'
<full existing frontmatter and Phase 1/2/3 sections, unchanged, plus:>

## Phase 4 — Verify
**Output**: verification report (all checks ✓ / listed failures)
**Key decisions**: repro re-run <✓/✗>; broader suite <✓/✗>; regressions
<none found / listed>

<the verification report from Step 4>
EOF
mv .bughunt-state.md.tmp .bughunt-state.md
```

and set `status: complete` in the frontmatter. Delete `.bughunt-state.lock` after the
write succeeds.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 4 phases finished. State written to `.bughunt-state.md`.
> Run `bughunt-repro` again to start a new session.

Do not continue. Stop here.
