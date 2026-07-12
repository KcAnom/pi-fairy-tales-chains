---
name: release-bump
description: >
  Phase 2 of 5 in the release chain (changelog → bump → tag → publish → verify). Applies
  the agreed version to package.json and writes the drafted entry into CHANGELOG.md.
  Trigger when the previous phase says "run release-bump next", or standalone via
  "release-bump", "phase 2 of release", "apply the version bump".
---

# Release: Bump

Chain version: 1

Phase 2 of 5: release-changelog → **release-bump** → release-tag → release-publish → release-verify

## Overview

Applies the version decided in Phase 1 to `package.json` and prepends the drafted
CHANGELOG entry to `CHANGELOG.md`. Makes no git tag and does not publish — those are
later phases — so this stays a reviewable, reversible edit.

## Load State

Read `.release-state.md` from the project root:

- If missing → abort: "No state file found. Run `release-changelog` first."
- If the frontmatter does not parse, or `chain_version` ≠ `1` → abort: state file is
  malformed or written by an incompatible edition of the chain.
- If `status` is not one of `changelog-done | bump-done | tag-done | publish-done |
  complete` → abort: "Unrecognized status — this state file may belong to a different
  or since-edited chain."
- If `status` ≠ `changelog-done` → abort: "Expected status `changelog-done` but found
  `<actual>`. Run the previous phase first."
- If the `## Phase 1 — Changelog` section or the `version` field is missing → abort:
  "Status looks right but the Phase 1 output is missing. Treat as corrupted."
- Check `.release-state.lock`; abort if present, else create it before writing.

## Workflow

### Step 1 — Apply the version

Set `package.json` `version` to the state file's `version` field (exact value — never a
different number than Phase 1 agreed).

### Step 2 — Write the changelog

Prepend the drafted CHANGELOG entry (stored in the state file) to `CHANGELOG.md`,
creating the file with a `# Changelog` header if it does not exist. Keep existing entries
below the new one.

### Step 3 — Sanity check

- `node -e "require('./package.json')"` (or `python3 -c "import json;json.load(open('package.json'))"`)
  to confirm `package.json` is still valid.
- Confirm the new version does not already exist on the registry if this is an npm
  package: `npm view <package>@<version> version` should 404.

## Update State

Atomically rewrite `.release-state.md` (temp file + rename), appending:

```markdown
## Phase 2 — Bump
**Output**: package.json set to <version>; CHANGELOG.md updated
**Key decisions**: files staged but NOT committed (release-tag handles the commit)
```

and updating `status: bump-done`. Delete `.release-state.lock` after the write.

## Handoff

After completing this phase, output exactly:

> Phase 2 complete. State written to `.release-state.md`.
> Run `/release-tag` to begin Phase 3.

Do not start the next phase. Do not offer to continue. Output only the handoff line and stop.
