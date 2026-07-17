---
name: release-changelog
description: >
  Phase 1 of 5 in the release chain — the durable npm/git release pipeline
  (changelog → bump → tag → publish → verify). Gathers commits since the last tag and
  drafts the CHANGELOG entry for the next version. This phase starts the durable chain
  run (state tracked by the chain tool). Trigger whenever the user wants to cut a
  release, ship a new version, or start the release chain: "release-changelog", "start
  a release", "draft the changelog", "cut a new version", "begin the release chain", or
  standalone "release".
---

# Release: Changelog

Chain version: 2 (durable state contract — see docs/STATE-CONTRACT.md)

Phase 1 of 5: **release-changelog** → release-bump → release-tag → release-publish → release-verify

## Overview

Entry point of the `release` chain. Determines what changed since the last release and
drafts a CHANGELOG entry the rest of the chain will bump, tag, publish, and verify.

All chain state is managed by the **chain tool**: authoritative JSON at
`.pi/fairy-tales/chains/release/state.json` with a human-readable `state.md`
projection beside it (a legacy `.release-state.md` from an older version is imported
automatically). Never create or edit state files by hand, and never create lock files
— the tool locks for you.

Uses the same conventional-commit grouping as the fairy-tales `/commit` prompt so the
changelog reads consistently with the project's history.

## Workflow

### Step 1 — Start the run (entry phase)

Call the **chain tool** with `action: "status", chain: "release"`:

- If an **active** run exists, a release is already mid-flight (the status shows its
  current phase). Show the user the status and ask whether to **resume** from the
  current phase (run that phase's skill) or **discard** it (`action: "abandon"`) and
  start over. Do not silently overwrite.
- If the tool reports the chain is locked by another session, abort and tell the user;
  a dead session's lock can be cleared with `action: "unlock"`.
- If there is no run, or the last run is complete/abandoned, start fresh:
  `action: "start", chain: "release", task: "release <package>"`. Note the `runId` in
  the response — it keys this run's quest dedupe keys.

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

### Step 4 — Complete the phase

Call the **chain tool**:

```
action: "complete-phase", chain: "release", phase: "changelog",
summary: "version bump chosen: <prevVersion> -> <version> (<why>); N commits since <last-tag>",
data: {
  "package": "<npm package name>",
  "version": "<agreed new version>",
  "prevVersion": "<current version>",
  "changelogEntry": "<the drafted CHANGELOG markdown, in full>"
},
artifacts: {}
```

The tool validates this is the current phase, advances the run to `bump`, and rewrites
the JSON + markdown projection atomically.

## Handoff

After completing this phase, output exactly:

> Phase 1 complete. Chain state updated (`.pi/fairy-tales/chains/release/state.json`).
> Run `/release-bump` to begin Phase 2.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
