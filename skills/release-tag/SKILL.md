---
name: release-tag
description: >
  Phase 3 of 5 in the release chain (changelog → bump → tag → publish → verify). Commits
  the bump + changelog and creates the annotated git tag for the version. Trigger when
  the previous phase says "run release-tag next", or standalone via "release-tag",
  "phase 3 of release", "commit and tag the release".
---

# Release: Tag

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 3 of 5: release-changelog → release-bump → **release-tag** → release-publish → release-verify

## Overview

Commits the version bump and changelog produced by earlier phases, then creates the
annotated git tag. Keeps the tag local by default — pushing and publishing happen in the
next phase — so a mistake here is still easy to undo (`git tag -d`, `git reset`).

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/release/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "release"` (a legacy
`.release-state.md` from an older version is imported automatically):

- If there is no run → abort: "No release run found. Run `release-changelog` first."
- If the run is not `active` with `currentPhase: "tag"` → abort: "Expected the run to
  be at phase `tag` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.package` / `data.version` (or the bump phase summary) is missing → abort:
  "Phase pointer looks right but the Phase 2 output is missing. Treat as corrupted —
  restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Commit

Stage `package.json`, `CHANGELOG.md`, and any other release-related files, then commit
with a conventional message:

```
chore(release): <package> v<version>
```

End the commit body with the project's standard `Co-Authored-By` trailer if it uses one.
If on the default branch and the project's convention is to branch, create a release
branch first.

### Step 2 — Tag

Create the annotated tag: `git tag -a v<version> -m "<package> v<version>"`. Confirm with
`git tag --list v<version>` and `git describe --tags`.

### Step 3 — Do NOT push yet

Leave the commit and tag local. `release-publish` handles push + publish so the network
step is a single, explicit phase.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "release", phase: "tag",
summary: "committed release; created local tag v<version>; tag/commit are local only — release-publish will push and publish",
data: {},
artifacts: { "commit": "<commit sha>", "tag": "v<version>" }
```

The tool validates this is the current phase, advances the run to `publish`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. Chain state updated (`.pi/fairy-tales/chains/release/state.json`).
> Run `/release-publish` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
