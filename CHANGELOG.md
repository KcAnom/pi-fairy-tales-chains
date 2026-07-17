# Changelog

## 0.2.0 — 2026-07-17

**Durable state contract (v2)**

- New `chain` tool (extensions/fairy-tales-chains.ts): `start`, `status`, `complete-phase`, `update`, `abandon`, `unlock`. Authoritative JSON state at `.pi/fairy-tales/chains/<chain>/state.json`, atomic writes, generated `state.md` projection, TTL'd cross-session locking, and automatic import of legacy `.<chain>-state.md` files. `/chains` lists every run in the project.
- All six chains (`feature-ship`, `bughunt`, `migrate`, `research`, `release`, `onboard`) rewritten to drive the `chain` tool exclusively; heavy phase work runs as pi-fairy-tales quests with idempotent dedupe keys (`<chain>/<runId>/<phase>/<workId>`), chain metadata, and retained-until-consumed results — a crashed phase resumes the same work instead of duplicating it (no duplicate PRs). Legacy 0.1.x state files import automatically.
- New `docs/STATE-CONTRACT.md` documents the schema, locking, projection, and legacy import rules. Test suite added (vitest): chain store + an in-process smoke test that loads the real extension and drives a full chain lifecycle.
- Requires pi-fairy-tales ≥ 0.15.0 for the quest primitives (dedupeKey, chain metadata, retainUntilConsumed, targeted run, consume).

## 0.1.1

- Gallery masthead image; peer-dependency declaration.

## 0.1.0

- Six durable skill chains (release, feature-ship, onboard, bughunt, migrate, research) with markdown state files.
