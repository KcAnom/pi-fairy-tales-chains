---
name: feature-ship-spec
description: >
  Phase 1 of 4 in the feature-ship chain — the human-in-the-loop feature delivery
  pipeline (spec → build → review → ship). Turns a raw feature request into a written
  spec using a fairy-tales plan-role subagent and renders it as an artifact doc (goals,
  approach, files to touch, risks, acceptance criteria). This phase creates the shared
  state file. Trigger whenever the user wants to ship a new feature, start the
  feature-ship chain, or turn a request into a spec: "feature-ship-spec", "phase 1 of
  feature-ship", "start feature-ship", "spec this feature", "begin the feature-ship
  chain", or when the previous phase says run feature-ship-spec next (the final phase
  says to run it again to start a new session).
---

# Feature Ship: Spec

Chain version: 1

Phase 1 of 4: **feature-ship-spec** → feature-ship-build → feature-ship-review → feature-ship-ship

## Overview

Entry point of the `feature-ship` chain. Takes a raw feature request and turns it into
a written spec — goals, approach, files to touch, risks, and acceptance criteria — that
the rest of the chain builds, reviews, and ships against. This is the phase that creates
`.feature-ship-state.md`; the later phases only read and update it.

Delegates the actual design work to a fairy-tales **plan-role subagent** so the spec is
produced by a dedicated planning pass rather than improvised inline, then renders the
result with the **artifact tool** so it's a durable, shareable doc rather than only
chat text.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.feature-ship-state.md` exists and its `status` is **not** `complete`, a
  feature-ship run is already mid-flight. Show the current `status` and ask the user
  whether to resume from the matching phase or discard and start over. Do not silently
  overwrite.
- If `.feature-ship-state.md` exists with `status: complete`, this is a fresh run —
  proceed; the prior run's file will be replaced once the new one is written.
- If no state file exists, this is a fresh run — proceed.
- Check for `.feature-ship-state.lock`. If present, abort: "Another session appears to
  be running this chain (lock file present). Remove `.feature-ship-state.lock` if
  that's stale." Otherwise create it before writing state.

### Step 2 — Design the spec via the plan-role subagent

Invoke a fairy-tales **plan-role subagent** with the feature request and the current
repo context. Ask it to produce, concretely:

- **Goals** — what the feature must accomplish, in the user's terms.
- **Approach** — the technical strategy, at the level of "which modules/layers change
  and how", not a line-by-line diff.
- **Files to touch** — concrete paths, not just areas.
- **Risks** — what could break, what's ambiguous, what needs a follow-up decision.
- **Acceptance criteria** — a checklist that phase 3 (review) and phase 4 (ship) can
  verify against mechanically; these must be specific and falsifiable, not "it works".

Do not write this spec inline yourself — the plan-role subagent is the one designing
it; your job in this phase is to brief it, collect its output, and render it.

### Step 3 — Render the spec doc via the artifact tool

Take the plan-role subagent's output and render it with the **artifact tool** as a spec
document (sections: Goals, Approach, Files to Touch, Risks, Acceptance Criteria). Share
the resulting artifact link with the user. This artifact is the durable record of the
spec — the state file stores a copy of the same content so later phases don't depend on
the artifact staying reachable.

### Step 4 — Update State

Write the full new `.feature-ship-state.md` atomically (temp file + rename — never edit
in place):

```bash
cat > .feature-ship-state.md.tmp <<'EOF'
---
task: "<original feature request>"
started: <ISO 8601 timestamp>
status: spec-done
chain_version: 1
spec_artifact_url: "<artifact tool URL>"
acceptance_criteria: |
  - <criterion 1>
  - <criterion 2>
---

## Phase 1 — Spec
**Output**: spec doc rendered via artifact tool at <spec_artifact_url>
**Key decisions**: <goals/approach summary; anything phase 2 must know>

<full spec markdown: Goals / Approach / Files to Touch / Risks / Acceptance Criteria>
EOF
mv .feature-ship-state.md.tmp .feature-ship-state.md
```

Delete `.feature-ship-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.feature-ship-state.md`.
> Run `/feature-ship-build` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
