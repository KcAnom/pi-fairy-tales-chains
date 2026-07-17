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

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 3: migrate-inventory → migrate-transform → **migrate-verify**

## Overview

Final phase. Proves the migration is actually complete — the test suite passes, a
fairy-tales review subagent has looked at the full diff, and every site recorded in
Phase 1's inventory is checked off — then marks the chain complete. Reports
faithfully: if a check fails or a site was skipped, it says so rather than declaring
success.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/migrate/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "migrate"` (a legacy
`.migrate-state.md` from an older version is imported automatically):

- If there is no run → abort: "No migrate run found. Run `migrate-inventory` first."
- If the run is not `active` with `currentPhase: "verify"` → abort: "Expected the run
  to be at phase `verify` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.inventory` (or the transform phase summary) is missing → abort: "Phase
  pointer looks right but the Phase 2 output is missing. Treat as corrupted — restart
  the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

Note the run's `runId` — it keys this phase's quest dedupe key.

## Workflow

### Step 1 — Confirm every site was handled

Re-read `data.inventory`. Every entry must be `"done": true`. If any entry is still
`"done": false`, or carries a `"note": "FAILED..."`, STOP here — do not proceed to a
passing report. Report exactly which `file:line` entries are unresolved and hand
control back to `migrate-transform` rather than marking the chain complete.

### Step 2 — Run the test suite

Run the project's real test command (check `.claude/test-command`, `package.json`
scripts, or the project's documented test runner). Capture pass/fail and any
failing test names — do not paper over a failure.

### Step 3 — Review the full diff via a durable quest

Because a full-diff review can be long-running and must survive a session restart,
use the **quest tool**: `enqueue` with `role: "review"`, the full diff produced by
the migration (`git diff` against the commit before Phase 2 started, or the
`/ultraplan` branches/patches if worktrees were used) as the brief, and:

- `dedupeKey: "migrate/<runId>/verify/main"`;
- `chain: { chain: "migrate", runId: "<runId>", phase: "verify" }`;
- `retainUntilConsumed: true`.

If the returned quest is already `done` (crash-resume case), reuse its stored result;
otherwise `run` it by `id`. Ask it to flag any remaining reference to `data.target`,
any half-finished transform, or any regression introduced by the change. Include its
findings verbatim in the report, then `consume` the quest.

### Step 4 — Report

Produce a short migration report: `data.target` → `data.replacement`, total sites
migrated, test suite result, review quest findings, and the result of each check (✓ /
✗). Name any check that failed and what to do about it.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "migrate", phase: "verify",
summary: "verification report: all N/N sites confirmed handled; tests ✓/✗; review ✓/✗ — migration confirmed complete / <listed remaining issues>",
data: { "verificationReport": "<the report from Step 4>" },
artifacts: { "verifyQuest": "<quest id>" }
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 3 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/migrate/state.json`).
> Run `migrate-inventory` again to start a new session.

Do not continue. Stop here.
