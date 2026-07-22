<div align="center">

![Fairy Tales — once upon a terminal](https://raw.githubusercontent.com/KcAnom/pi-fairy-tales-chains/main/assets/masthead.webp)

</div>

# pi-fairy-tales-chains

Six **durable skill chains** for the [pi coding agent](https://github.com/earendil-works/pi-mono) — multi-phase workflows where each phase is its own skill and state flows between them through a file on disk, so a long job **survives across sessions and context windows** and resumes exactly where it stopped.

Each chain is built to leverage [**pi-fairy-tales**](https://github.com/KcAnom/pi-fairy-tales) capabilities — subagents, `/ultraplan`, the artifact tool, guard-rail hooks, memory, and the status line. Authored with [**pi-skill-system-creator**](https://github.com/KcAnom/pi-skill-system-creator) and validated with its chain validator.

> **Why chains?** pi-fairy-tales is powerful but mostly *in-session* — a `/ultraplan` run or a subagent fan-out is gone when the session ends. A chain writes state between phases, turning that horsepower into a **multi-day, resumable pipeline** with human review between steps.

How the two packages fit together — repos, runtime footprint, config precedence: [Ecosystem Map](https://github.com/KcAnom/pi-fairy-tales/blob/main/docs/ECOSYSTEM.md).

## Install

**Requires [`pi-fairy-tales`](https://github.com/KcAnom/pi-fairy-tales)** — the chains call its tools (`agent`, `artifact`, `/ultraplan`, `fetch`, hooks). Install both as top-level packages:

```bash
npm i -g @earendil-works/pi-coding-agent    # pi itself
pi install pi-fairy-tales                     # the capabilities the chains call (declared as a peer dependency)
pi install pi-fairy-tales-chains              # the chains
```

Both load independently in the same pi and compose at runtime. They are deliberately **not** bundled into one install: pi loads each package's tools once, and bundling a second copy of `pi-fairy-tales` would conflict with a standalone install of it. Two installs, zero conflicts.

Or from git:

```bash
pi install git:github.com/KcAnom/pi-fairy-tales
pi install git:github.com/KcAnom/pi-fairy-tales-chains
```

## The chains

Each is a **pipeline** (human-in-the-loop): every phase reads the shared chain state, does its work, updates state, and hands off with `Run /<chain>-<next>`. You review between phases; the durable state means you can stop and resume days later.

Since 0.2.0, all six chains track state through the bundled **`chain` tool**: authoritative JSON at `.pi/fairy-tales/chains/<chain>/state.json` with a human-readable `state.md` projection, TTL'd cross-session locking, and automatic import of legacy `.<chain>-state.md` files (see `docs/STATE-CONTRACT.md`). Heavy phase work runs as **quests** (pi-fairy-tales ≥ 0.15) with idempotent dedupe keys, so a crashed phase resumes the same work instead of duplicating it.

| Chain | Phases | What it does | Fairy-tales muscle |
|---|---|---|---|
| **release** | changelog → bump → tag → publish → verify | Cut an npm/git release end to end | `/commit` conventions, ship skill, status line |
| **feature-ship** | spec → build → review → ship | Take a feature request from spec to merged PR | plan agent + artifact, `/ultraplan` worktree, deep-review |
| **onboard** | map → deepen → digest | Understand an unfamiliar repo over multiple sessions | parallel explore subagents, artifact HTML, memory |
| **bughunt** | repro → diagnose → fix → verify | Reproduce, root-cause, fix, and confirm a bug | explore/review subagents, post-edit self-fix hook, checkpoints |
| **migrate** | inventory → transform → verify | Large codebase migration that spans sessions | explore subagents, `/ultraplan`, per-site durable checkoff |
| **research** | gather → synthesize → artifact | Research a topic and produce a polished report | SSRF-safe `fetch`, artifact HTML |

## Using a chain

Start the first phase, then follow each handoff:

```
/release-changelog            # phase 1 — creates .release-state.md
# … review, then it tells you:
/release-bump                 # phase 2
/release-tag                  # phase 3
/release-publish              # phase 4
/release-verify               # phase 5 — "Chain complete!"
```

Interrupted? Just run the next phase whenever you come back — the durable state remembers where you were (`/chains` shows every run in the project). Each phase refuses to run if the previous one didn't complete, so you can't skip a step or act on a half-written state.

## How a chain is built

Every phase skill follows the [pi-skill-system-creator](https://github.com/KcAnom/pi-skill-system-creator) contract:

- **Clean YAML front matter** so pi can discover the skill
- **State validation** on entry — the `chain` tool verifies the run is active at exactly this phase and refuses out-of-order or missing-state runs (legacy chains parse frontmatter + `chain_version` instead)
- **Atomic state writes** — the tool writes JSON + projection via temp file + rename, so an interrupted write never corrupts the state
- **Cross-session locking** — a TTL'd lock (renewed on every write, auto-broken when stale, force-clearable with the tool's `unlock` action) catches two sessions running the same chain
- **An explicit handoff** to the next phase (the last phase terminates with "Chain complete")

Validate any chain yourself:

```bash
python3 ~/.pi/agent/skills/skill-system-creator/validate-chain.py <chain-name>
```

## License

[MIT](LICENSE) © KcAnom. Built for the [pi coding agent](https://github.com/earendil-works/pi-mono); pairs with [pi-fairy-tales](https://github.com/KcAnom/pi-fairy-tales) and [pi-skill-system-creator](https://github.com/KcAnom/pi-skill-system-creator).
