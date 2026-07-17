---
name: release-publish
description: >
  Phase 4 of 5 in the release chain (changelog → bump → tag → publish → verify). Pushes
  the commit and tag, publishes to npm, and creates the GitHub release. This is the phase
  that touches the outside world. Trigger when the previous phase says "run
  release-publish next", or standalone via "release-publish", "phase 4 of release",
  "publish the release".
---

# Release: Publish

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 4 of 5: release-changelog → release-bump → release-tag → **release-publish** → release-verify

## Overview

The outward-facing phase: push branch + tag, `npm publish`, and cut the GitHub release
from the changelog. Everything before this was local and reversible; publishing is
permanent, so this phase confirms the manifest before it ships.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/release/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "release"` (a legacy
`.release-state.md` from an older version is imported automatically):

- If there is no run → abort: "No release run found. Run `release-changelog` first."
- If the run is not `active` with `currentPhase: "publish"` → abort: "Expected the run
  to be at phase `publish` but it is at `<currentPhase/status>`. Run that phase's
  skill instead."
- If `data.package` / `data.version` / `data.changelogEntry`, or the tag phase's
  `artifacts.tag` (or its summary), is missing → abort: "Phase pointer looks right but
  the Phase 3 output is missing. Treat as corrupted — restart the chain or repair via
  chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Confirm what ships

If this is an npm package, run `npm publish --dry-run` and show the file manifest. Confirm
no secrets or stray files are in the tarball (a `files` allowlist should already be set).
Publishing is irreversible — do not proceed past a manifest that looks wrong.

### Step 2 — Push

`git push origin <branch>` and `git push origin v<version>` (push the tag explicitly).

### Step 3 — Publish to npm

`npm publish`. If the account requires an OTP, the user provides it (`npm publish
--otp=<code>`) or has an automation token configured. Treat an `E403 "cannot publish over
previously published versions"` as **already published** — verify and move on, don't retry.

### Step 4 — GitHub release

`gh release create v<version> --title "<package> v<version>" --notes "<changelog entry>"`
using `data.changelogEntry`.

### Step 5 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "release", phase: "publish",
summary: "pushed branch+tag; npm publish done; GitHub release created",
data: {},
artifacts: {
  "npmUrl": "<npm package page URL>",
  "releaseUrl": "<GitHub release URL>",
  "tag": "v<version>"
}
```

The tool validates this is the current phase, advances the run to `verify`, and
rewrites the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 4 complete. Chain state updated (`.pi/fairy-tales/chains/release/state.json`).
> Run `/release-verify` to begin Phase 5.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
