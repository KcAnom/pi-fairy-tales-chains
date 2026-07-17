---
name: release-bump
description: >
  Phase 2 of 5 in the release chain (changelog → bump → tag → publish → verify). Applies
  the agreed version to package.json and writes the drafted entry into CHANGELOG.md.
  Trigger when the previous phase says "run release-bump next", or standalone via
  "release-bump", "phase 2 of release", "apply the version bump".
---

# Release: Bump

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 2 of 5: release-changelog → **release-bump** → release-tag → release-publish → release-verify

## Overview

Applies the version decided in Phase 1 to `package.json` and prepends the drafted
CHANGELOG entry to `CHANGELOG.md`. Makes no git tag and does not publish — those are
later phases — so this stays a reviewable, reversible edit.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/release/state.json` with a human-readable `state.md`
projection beside it. Never create or edit state files by hand, and never create lock
files — the tool locks for you.

## Load State

Call the **chain tool** with `action: "status", chain: "release"` (a legacy
`.release-state.md` from an older version is imported automatically):

- If there is no run → abort: "No release run found. Run `release-changelog` first."
- If the run is not `active` with `currentPhase: "bump"` → abort: "Expected the run to
  be at phase `bump` but it is at `<currentPhase/status>`. Run that phase's skill
  instead."
- If `data.package` / `data.version` / `data.changelogEntry` (or the changelog phase
  summary) is missing → abort: "Phase pointer looks right but the Phase 1 output is
  missing. Treat as corrupted — restart the chain or repair via chain action 'update'."
- If the tool reports the chain is locked by another session, abort; a dead session's
  lock can be cleared with `action: "unlock"`. Never create lock files yourself.

## Workflow

### Step 1 — Apply the version

Set `package.json` `version` to `data.version` (exact value — never a different number
than Phase 1 agreed).

### Step 2 — Write the changelog

Prepend `data.changelogEntry` to `CHANGELOG.md`, creating the file with a `# Changelog`
header if it does not exist. Keep existing entries below the new one.

### Step 3 — Sanity check

- `node -e "require('./package.json')"` (or `python3 -c "import json;json.load(open('package.json'))"`)
  to confirm `package.json` is still valid.
- Confirm the new version does not already exist on the registry if this is an npm
  package: `npm view <package>@<version> version` should 404.

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "release", phase: "bump",
summary: "package.json set to <version>; CHANGELOG.md updated; files staged but NOT committed (release-tag handles the commit)",
data: {},
artifacts: {}
```

The tool validates this is the current phase, advances the run to `tag`, and rewrites
the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. Chain state updated (`.pi/fairy-tales/chains/release/state.json`).
> Run `/release-tag` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
