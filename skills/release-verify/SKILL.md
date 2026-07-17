---
name: release-verify
description: >
  Phase 5 of 5 (final) in the release chain (changelog → bump → tag → publish → verify).
  Confirms the published version is actually live and the release is intact, then closes
  the chain. Trigger when the previous phase says "run release-verify next", or standalone
  via "release-verify", "phase 5 of release", "verify the release went live".
---

# Release: Verify

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 5 of 5: release-changelog → release-bump → release-tag → release-publish → **release-verify**

## Overview

Final phase. Proves the release actually landed — the npm version resolves, the tag and
GitHub release exist, and the published metadata matches what was intended — then marks
the chain complete. Reports faithfully: if a check fails, it says so rather than
declaring success.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/release/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "release"` (a legacy
`.release-state.md` from an older version is imported automatically):

- If there is no run → abort: "No release run found. Run `release-changelog` first."
- If the run is not `active` with `currentPhase: "verify"` → abort: "Expected the run
  to be at phase `verify` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.package` / `data.version`, or the publish phase's `artifacts.npmUrl` /
  `artifacts.releaseUrl` (or its summary), is missing → abort: "Phase pointer looks
  right but the Phase 4 output is missing. Treat as corrupted — restart the chain or
  repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Verify the publish

- npm: `npm view <package>@<version> version` returns the version; optionally confirm
  `dist.tarball` resolves (HTTP 200) and `pi.image`/keywords are intact for pi packages.
- git: `git ls-remote --tags origin | grep v<version>` shows the pushed tag.
- GitHub: `gh release view v<version>` shows the release.

### Step 2 — Report

Produce a short release report: package, version, npm URL, tag, release URL, and the
result of each check (✓ / ✗). Name any check that failed and what to do about it — do not
paper over a failure.

### Step 3 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "release", phase: "verify",
summary: "verification report: all checks ✓ / <listed failures>; release confirmed live at <npm URL> / <release URL>",
data: { "verificationReport": "<the report from Step 2>" },
artifacts: {
  "npmUrl": "<npm package page URL>",
  "releaseUrl": "<GitHub release URL>",
  "tag": "v<version>"
}
```

The tool validates this is the current phase, marks the run `complete`, and rewrites
the JSON + markdown projection atomically — this is the final phase, so the run's
`status` becomes `complete` and its lock is released.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 5 phases finished. Chain state updated
> (`.pi/fairy-tales/chains/release/state.json`).
> Run `release-changelog` again to start a new release.

Do not continue. Stop here.
