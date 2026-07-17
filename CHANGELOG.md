# Changelog

## 0.2.0 — 2026-07-17

**Durable state contract (v2)**

- New `chain` tool (extensions/fairy-tales-chains.ts): `start`, `status`, `complete-phase`, `update`, `abandon`, `unlock`. Authoritative JSON state at `.pi/fairy-tales/chains/<chain>/state.json`, atomic writes, generated `state.md` projection, TTL'd cross-session locking, and automatic import of legacy `.<chain>-state.md` files. `/chains` lists every run in the project.
- `feature-ship`, `bughunt`, `migrate`, and `research` skills rewritten to drive the `chain` tool exclusively; their heavy phase work runs as pi-fairy-tales quests with idempotent dedupe keys (`<chain>/<runId>/<phase>/<workId>`), chain metadata, and retained-until-consumed results — a crashed phase resumes the same work instead of duplicating it (no duplicate PRs).
- `release` and `onboard` intentionally unchanged (legacy v1 state; the tool imports their files read-only).
- New `docs/STATE-CONTRACT.md` documents the schema, locking, projection, and legacy import rules. Test suite added (vitest) for the chain store.
- Requires pi-fairy-tales ≥ 0.15.0 for the quest primitives (dedupeKey, chain metadata, retainUntilConsumed, targeted run, consume).

## 0.1.1

- Gallery masthead image; peer-dependency declaration.

## 0.1.0

- Six durable skill chains (release, feature-ship, onboard, bughunt, migrate, research) with markdown state files.
