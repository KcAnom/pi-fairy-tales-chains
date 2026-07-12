---
name: bughunt-repro
description: >
  Phase 1 of 4 in the bughunt chain — the human-in-the-loop bug-fixing pipeline
  (repro → diagnose → fix → verify). Captures a reliable reproduction of a bug: the
  exact failing command or test, expected vs. actual behavior, error output, and
  environment. This phase creates the shared state file. Trigger whenever the user
  reports a bug, pastes an error/stack trace, or wants to start the bughunt chain:
  "bughunt-repro", "start a bughunt", "reproduce this bug", "capture a repro",
  "begin the bughunt chain", or standalone "bughunt".
---

# Bughunt: Repro

Chain version: 1

Phase 1 of 4: **bughunt-repro** → bughunt-diagnose → bughunt-fix → bughunt-verify

## Overview

Entry point of the `bughunt` chain. Turns a bug report into a reliable, reproducible
failure: the exact command or test that fails, what should happen, what actually
happens, the raw error output, and the environment it fails in. This is the phase
that creates `.bughunt-state.md`; the later phases only read and update it. A fix
built on a repro that isn't actually reliable is worthless, so this phase does not
proceed until the failure has been reproduced and observed directly — not just
described secondhand.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.bughunt-state.md` exists and its `status` is **not** `complete`, a bughunt is
  already mid-flight. Show the current `status` and ask the user whether to resume
  from the matching phase or discard and start over. Do not silently overwrite.
- If `.bughunt-state.md` exists with `status: complete`, this is a fresh bughunt —
  archive/overwrite is fine once the user confirms they want a new session.
- Check for `.bughunt-state.lock`. If present, abort: "Another session appears to be
  running this chain (lock file present). Remove `.bughunt-state.lock` if that's
  stale." Otherwise create it before writing state.

### Step 2 — Capture the bug report

Gather from the user (or the conversation that triggered this phase): what's broken,
where it was observed, and any command, test name, stack trace, or screenshot already
provided. Do not invent details that weren't given.

### Step 3 — Reproduce it directly

- Identify the exact failing command or test (e.g. `npm test -- path/to.spec.ts`,
  `pytest tests/test_x.py::test_y`, a specific curl/CLI invocation).
- Run it. Capture the raw error output (stack trace, assertion diff, exit code).
- Run it again to confirm it fails consistently (flaky failures need to be noted as
  such rather than treated as a clean repro — record the failure rate observed).
- Record expected behavior (what should happen — from docs, tests, or the user's
  description) versus actual behavior (what happens now).
- Capture environment: OS, language/runtime version, current git branch and commit
  (`git rev-parse HEAD`), and any dependency versions relevant to the failure.

If the failure cannot be reproduced with the information available, do NOT fabricate
a repro — report exactly what's missing (e.g. "need the input file that triggers
this", "need a way to hit this endpoint locally") and stop before writing state.

### Step 4 — Update State

Write the full new `.bughunt-state.md` atomically (temp file + rename — never edit in
place):

```bash
cat > .bughunt-state.md.tmp <<'EOF'
---
task: "<short description of the bug>"
started: <ISO 8601 timestamp>
status: repro-done
chain_version: 1
repro_command: "<exact failing command/test>"
---

## Phase 1 — Repro
**Output**: reliable reproduction captured for "<short description>"
**Key decisions**: reproduced <N>/<N> runs; environment <os/runtime summary>

**Repro command**: `<exact failing command/test>`

**Expected behavior**: <what should happen>

**Actual behavior**: <what happens instead>

**Error output**:
```
<raw stack trace / assertion diff / error text>
```

**Environment**: <OS>, <runtime + version>, branch `<branch>` @ `<commit sha>`,
<relevant dependency versions>
EOF
mv .bughunt-state.md.tmp .bughunt-state.md
```

Delete `.bughunt-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.bughunt-state.md`.
> Run `/bughunt-diagnose` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
