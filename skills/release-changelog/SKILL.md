---
name: release-changelog
description: >
  Phase 1 of 5 in the release chain — the durable npm/git release pipeline
  (changelog → bump → tag → publish → verify). Gathers commits since the last tag and
  drafts the CHANGELOG entry for the next version. This phase creates the shared state
  file. Trigger whenever the user wants to cut a release, ship a new version, or start
  the release chain: "release-changelog", "start a release", "draft the changelog",
  "cut a new version", "begin the release chain", or standalone "release".
---

# Release: Changelog

Chain version: 1

Phase 1 of 5: **release-changelog** → release-bump → release-tag → release-publish → release-verify

## Overview

Entry point of the `release` chain. Determines what changed since the last release and
drafts a CHANGELOG entry the rest of the chain will bump, tag, publish, and verify. This
is the phase that creates `.release-state.md`; the later phases only read and update it.

Uses the same conventional-commit grouping as the fairy-tales `/commit` prompt so the
changelog reads consistently with the project's history.

## Workflow

### Step 1 — Init State (entry phase, no previous check)

This is the first phase, so there is no previous phase to validate. Instead:

- If `.release-state.md` exists and its `status` is **not** `complete`, a release is
  already mid-flight. Show the current `status` and ask the user whether to resume from
  the matching phase or discard and start over. Do not silently overwrite.
- If `.release-state.md` exists with `status: complete`, this is a fresh release — read
  its `version` as the previous version, then continue.
- Check for `.release-state.lock`. If present, abort: "Another session appears to be
  running this chain (lock file present). Remove `.release-state.lock` if that's stale."
  Otherwise create it before writing state.

### Step 2 — Gather changes

- Read `package.json` for the package `name` and current `version`.
- Find the last release tag: `git describe --tags --abbrev=0` (if none, use the repo's
  first commit).
- Collect commits since it: `git log <last-tag>..HEAD --oneline`.
- Group them by conventional-commit type (feat, fix, docs, chore, refactor…) into a
  draft CHANGELOG section headed by the proposed new version.

### Step 3 — Propose the version

Suggest the next semantic version from the change mix (feat → minor, fix/docs/chore →
patch, breaking → major) but let the user confirm or override. Record the agreed
`version` for the `bump` phase to apply — do not edit `package.json` here.

### Step 4 — Update State

Write the full new `.release-state.md` atomically (temp file + rename — never edit in
place):

```bash
cat > .release-state.md.tmp <<'EOF'
---
task: "release <package> <version>"
started: <ISO 8601 timestamp>
status: changelog-done
chain_version: 1
package: "<npm package name>"
version: "<agreed new version>"
prev_version: "<current version>"
---

## Phase 1 — Changelog
**Output**: drafted CHANGELOG entry for <version> (kept in this file below)
**Key decisions**: version bump chosen (<why>); N commits since <last-tag>

<the drafted CHANGELOG markdown>
EOF
mv .release-state.md.tmp .release-state.md
```

Delete `.release-state.lock` after the write succeeds.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. State written to `.release-state.md`.
> Run `/release-bump` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
