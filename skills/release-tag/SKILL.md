---
name: release-tag
description: >
  Phase 3 of 5 in the release chain (changelog → bump → tag → publish → verify). Commits
  the bump + changelog and creates the annotated git tag for the version. Trigger when
  the previous phase says "run release-tag next", or standalone via "release-tag",
  "phase 3 of release", "commit and tag the release".
---

# Release: Tag

Chain version: 1

Phase 3 of 5: release-changelog → release-bump → **release-tag** → release-publish → release-verify

## Overview

Commits the version bump and changelog produced by earlier phases, then creates the
annotated git tag. Keeps the tag local by default — pushing and publishing happen in the
next phase — so a mistake here is still easy to undo (`git tag -d`, `git reset`).

## Load State

Read `.release-state.md`:

- If missing → abort: "No state file found. Run `release-changelog` first."
- If frontmatter does not parse or `chain_version` ≠ `1` → abort: malformed or
  incompatible-edition state file.
- If `status` is unrecognized → abort: state file may belong to a different chain.
- If `status` ≠ `bump-done` → abort: "Expected `bump-done` but found `<actual>`. Run the
  previous phase first."
- If the `## Phase 2 — Bump` section or `version` field is missing → abort as corrupted.
- Check `.release-state.lock`; abort if present, else create it.

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

## Update State

Atomically rewrite `.release-state.md` (temp + rename), appending:

```markdown
## Phase 3 — Tag
**Output**: committed release; created local tag v<version>
**Key decisions**: tag/commit are local only — release-publish will push and publish
```

and updating `status: tag-done`. Delete `.release-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 3 complete. State written to `.release-state.md`.
> Run `/release-publish` to begin Phase 4.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
