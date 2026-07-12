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

Chain version: 1

Phase 4 of 5: release-changelog → release-bump → release-tag → **release-publish** → release-verify

## Overview

The outward-facing phase: push branch + tag, `npm publish`, and cut the GitHub release
from the changelog. Everything before this was local and reversible; publishing is
permanent, so this phase confirms the manifest before it ships.

## Load State

Read `.release-state.md`:

- If missing → abort: "No state file found. Run `release-changelog` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed/incompatible.
- If `status` is unrecognized → abort: may belong to a different chain.
- If `status` ≠ `tag-done` → abort: "Expected `tag-done` but found `<actual>`. Run the
  previous phase first."
- If the `## Phase 3 — Tag` section, `package`, or `version` field is missing → abort as
  corrupted.
- Check `.release-state.lock`; abort if present, else create it.

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
using the entry stored in the state file.

## Update State

Atomically rewrite `.release-state.md` (temp + rename), appending:

```markdown
## Phase 4 — Publish
**Output**: pushed branch+tag; npm publish done; GitHub release created
**Key decisions**: <npm page URL>, <release URL>
```

and updating `status: publish-done`. Delete `.release-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 4 complete. State written to `.release-state.md`.
> Run `/release-verify` to begin Phase 5.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
