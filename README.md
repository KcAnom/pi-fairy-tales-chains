<div align="center">

![Fairy Tales — once upon a terminal](https://raw.githubusercontent.com/KcAnom/pi-fairy-tales-chains/main/assets/masthead.webp)

</div>

# pi-fairy-tales-chains

Six **durable skill chains** for the [pi coding agent](https://github.com/earendil-works/pi-mono) — multi-phase workflows where each phase is its own skill and state flows between them through a file on disk, so a long job **survives across sessions and context windows** and resumes exactly where it stopped.

Each chain is built to leverage [**pi-fairy-tales**](https://github.com/KcAnom/pi-fairy-tales) capabilities — subagents, `/ultraplan`, the artifact tool, guard-rail hooks, memory, and the status line. Authored with [**pi-skill-system-creator**](https://github.com/KcAnom/pi-skill-system-creator) and validated with its chain validator.

> **Why chains?** pi-fairy-tales is powerful but mostly *in-session* — a `/ultraplan` run or a subagent fan-out is gone when the session ends. A chain writes state between phases, turning that horsepower into a **multi-day, resumable pipeline** with human review between steps.

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

Each is a **pipeline** (human-in-the-loop): every phase reads the shared `.<chain>-state.md`, does its work, updates state, and hands off with `Run /<chain>-<next>`. You review between phases; the state file means you can stop and resume days later.

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

Interrupted? Just run the next phase whenever you come back — the state file remembers where you were. Each phase refuses to run if the previous one didn't complete, so you can't skip a step or act on a half-written state file.

## How a chain is built

Every phase skill follows the [pi-skill-system-creator](https://github.com/KcAnom/pi-skill-system-creator) contract:

- **Clean YAML front matter** so pi can discover the skill
- **State validation** on entry — parses the frontmatter, checks `chain_version`, and refuses to proceed on a malformed or wrong-phase state file
- **Atomic state writes** — full rewrite to a temp file then `mv`, so an interrupted write never corrupts the state
- **An advisory lock** (`.<chain>-state.lock`) to catch two sessions running the same chain
- **An explicit handoff** to the next phase (the last phase terminates with "Chain complete")

Validate any chain yourself:

```bash
python3 ~/.pi/agent/skills/skill-system-creator/validate-chain.py <chain-name>
```

## License

[MIT](LICENSE) © KcAnom. Built for the [pi coding agent](https://github.com/earendil-works/pi-mono); pairs with [pi-fairy-tales](https://github.com/KcAnom/pi-fairy-tales) and [pi-skill-system-creator](https://github.com/KcAnom/pi-skill-system-creator).
