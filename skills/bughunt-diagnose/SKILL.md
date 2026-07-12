---
name: bughunt-diagnose
description: >
  Phase 2 of 4 in the bughunt chain (repro → diagnose → fix → verify). Uses
  fairy-tales explore-role subagents to trace the root cause from the captured
  repro, then a review-role subagent to validate the hypothesis, producing a precise
  file:line root-cause finding. Trigger when the previous phase says "run
  bughunt-diagnose next", or standalone via "bughunt-diagnose", "phase 2 of
  bughunt", "diagnose the bug", "find the root cause".
---

# Bughunt: Diagnose

Chain version: 1

Phase 2 of 4: bughunt-repro → **bughunt-diagnose** → bughunt-fix → bughunt-verify

## Overview

Traces the reproduced failure back to its root cause. Delegates the search to
fairy-tales `explore` role subagents (the `agent` tool with `role: "explore"`) so the
codebase search happens in isolated context instead of bloating this session, then
delegates a skeptical second pass to a fairy-tales `review` role subagent
(`agent` tool, `role: "review"`) to pressure-test the hypothesis before it's trusted.
Output is a root-cause hypothesis plus a precise `file:line` location — not a fix.

## Load State

Read `.bughunt-state.md`:

- If missing → abort: "No state file found. Run `bughunt-repro` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `repro-done | diagnose-done | fix-done | complete` →
  abort: "Unrecognized status — this state file may belong to a different or
  since-edited chain."
- If `status` ≠ `repro-done` → abort: "Expected status `repro-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 1 — Repro` section or the `repro_command` field is missing →
  abort: "Status looks right but the Phase 1 output is missing. Treat as corrupted."
- Check `.bughunt-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Fan out exploration

Using the repro command, expected/actual behavior, error output, and environment
recorded in `## Phase 1 — Repro`, launch one or more fairy-tales `explore` role
subagents (`agent` tool, `role: "explore"`) to trace the failure through the
codebase. Give each a self-contained task — the stack trace or symptom to trace, and
what to report back (call path, the function/module where behavior diverges from
expected, related code that could be involved). If the failure has multiple plausible
starting points (e.g. a symptom visible in two different call paths), fan out several
explore agents in parallel in a single batch rather than serially.

### Step 2 — Validate with a review pass

Take the explore agents' findings and hand them to a fairy-tales `review` role
subagent (`agent` tool, `role: "review"`) with the repro details and the candidate
root cause. Ask it to specifically check: does this location actually explain the
observed error output; are there alternate/competing explanations that fit the
symptoms just as well; is the proposed `file:line` the actual point of divergence or
just where the error surfaced (a stack trace's throw site is often downstream of the
real bug). Do not accept the first explore finding uncritically — the review pass
exists to catch tunnel vision.

### Step 3 — Settle on the finding

Reconcile the explore and review output into one root-cause hypothesis with an exact
`file:line`. If the review subagent rejects the hypothesis or surfaces a stronger
competing explanation, run another explore/review round on the new lead rather than
forcing a weak conclusion — diagnose does not hand off until the hypothesis holds up.

## Update State

Atomically rewrite `.bughunt-state.md` (temp file + rename — see Rule 5, atomic
writes):

```bash
cat > .bughunt-state.md.tmp <<'EOF'
<full existing frontmatter and Phase 1 section, unchanged, plus:>

## Phase 2 — Diagnose
**Output**: root-cause hypothesis with precise location
**Key decisions**: <N> explore agents run; review-role confirmed / redirected the finding

**Root cause hypothesis**: <prose explanation of why the bug happens>

**Location**: `<path/to/file>:<line>`

**Explore findings**: <summary of what the explore-role agent(s) traced>

**Review confirmation**: <summary of what the review-role agent checked and confirmed>
EOF
mv .bughunt-state.md.tmp .bughunt-state.md
```

and set `status: diagnose-done` in the frontmatter. Delete `.bughunt-state.lock`
after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.bughunt-state.md`.
> Run `/bughunt-fix` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
