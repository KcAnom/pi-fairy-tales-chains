# Chain State Contract (v2)

How the six durable skill chains (`feature-ship`, `bughunt`, `migrate`, `research`,
`release`, `onboard`) persist state across sessions.

## Authoritative state: JSON

Each chain run's authoritative state lives at:

```
<project>/.pi/fairy-tales/chains/<chain>/state.json
```

Written **atomically** (temp file + rename) on every change, only through the
`chain` tool (backed by `ChainStore`). Skills must never create or edit state
files by hand.

### Shape (`ChainState`)

```jsonc
{
  "contractVersion": 2,
  "chain": "feature-ship",
  "runId": "fe-1a2b3c4d",          // unique per run; quest dedupe-key prefix
  "task": "add dark mode",          // the run's task in the user's terms
  "status": "active",               // active | complete | abandoned
  "currentPhase": "build",          // omitted once complete/abandoned
  "phases": [
    {
      "name": "spec",
      "status": "done",             // pending | active | done | skipped
      "completedAt": "2026-07-17T12:00:00.000Z",
      "summary": "hand-off text the next phase reads",
      "artifacts": {                // durable references
        "specUrl": "https://…",
        "quest": "q-ab12cd34"
      }
    },
    { "name": "build", "status": "active" }
  ],
  "data": {},                       // chain-specific payload (criteria, inventories…)
  "startedAt": "…", "updatedAt": "…",
  "migratedFromLegacy": true        // present only on imported v1 runs
}
```

## Markdown projection

`state.md` next to `state.json` is a **generated, human-readable projection**.
It is rewritten on every state change and never parsed back — the JSON is the
single source of truth.

## Locking

`state.lock.json` beside the state serializes writers across sessions:

```jsonc
{ "owner": "<session uuid>", "pid": 123, "acquiredAt": "…", "expiresAt": "…" }
```

- The lock has a TTL (default 30 min) and is renewed on every write by its owner.
- An expired lock is broken automatically by the next writer.
- A live lock held by another session makes writes fail with a clear error;
  `chain` action `unlock` force-clears a dead session's lock.
- The lock is released when a run completes or is abandoned.

## Legacy v1 import

v1 chains kept state in `<project>/.{chain}-state.md` with a `status:` line
(`<phase>-done` or `complete`). On the first `chain` read where no JSON state
exists, a recognizable legacy file is imported automatically:

- `status: <phase>-done` → the run resumes at the following phase.
- `status: complete` → the run imports as complete.
- The raw markdown is preserved at `data.legacyMarkdown`; the legacy file is
  left in place for the user to delete.
- Unrecognizable legacy files are ignored (no destructive guessing).

## Durable phase work: quests

When a phase delegates heavy work (subagents that must survive a session
restart), it should enqueue a **quest** (pi-fairy-tales ≥ 0.15) with:

- `dedupeKey`: `<chain>/<runId>/<phase>/<workId>` (`questDedupeKey()` helper) —
  re-running a crashed phase returns the *same* quest instead of duplicating
  work or opening duplicate PRs;
- `retainUntilConsumed: true` — the result outlives history pruning until the
  phase reads it and calls `quest consume`;
- `chain` metadata (`{ chain, runId, phase, workId }`) so the dashboard links
  the quest back to the run.

## Compatibility

- `release` and `onboard` skills still write legacy v1 markdown themselves;
  the tool reads (imports) them but their skills have not been migrated yet.
- `feature-ship`, `bughunt`, `migrate`, `research` skills drive the `chain`
  tool exclusively as of chains 0.2.0.
