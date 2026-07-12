---
name: release-verify
description: >
  Phase 5 of 5 (final) in the release chain (changelog → bump → tag → publish → verify).
  Confirms the published version is actually live and the release is intact, then closes
  the chain. Trigger when the previous phase says "run release-verify next", or standalone
  via "release-verify", "phase 5 of release", "verify the release went live".
---

# Release: Verify

Chain version: 1

Phase 5 of 5: release-changelog → release-bump → release-tag → release-publish → **release-verify**

## Overview

Final phase. Proves the release actually landed — the npm version resolves, the tag and
GitHub release exist, and the published metadata matches what was intended — then marks
the chain complete. Reports faithfully: if a check fails, it says so rather than
declaring success.

## Load State

Read `.release-state.md`:

- If missing → abort: "No state file found. Run `release-changelog` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed/incompatible.
- If `status` is unrecognized → abort: may belong to a different chain.
- If `status` ≠ `publish-done` → abort: "Expected `publish-done` but found `<actual>`.
  Run the previous phase first."
- If the `## Phase 4 — Publish`, `package`, or `version` section/field is missing → abort
  as corrupted.
- Check `.release-state.lock`; abort if present, else create it.

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

## Update State

Atomically rewrite `.release-state.md` (temp + rename), appending:

```markdown
## Phase 5 — Verify
**Output**: verification report (all checks ✓ / listed failures)
**Key decisions**: release confirmed live at <npm URL> / <release URL>
```

and updating `status: complete`. Delete `.release-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Chain complete! All 5 phases finished. State written to `.release-state.md`.
> Run `release-changelog` again to start a new release.

Do not continue. Stop here.
