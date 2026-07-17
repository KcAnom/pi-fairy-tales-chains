import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { legacyStatusToCurrentPhase, questDedupeKey } from "../chain-contracts.ts";
import { ChainStore, projectMarkdown } from "../chain-store.ts";

function fixture(owner = "session-1") {
  const project = mkdtempSync(join(tmpdir(), "fairy-chains-"));
  const store = new ChainStore({ project, owner });
  return { project, store, close: () => rmSync(project, { recursive: true, force: true }) };
}

test("start → complete phases → complete run, with atomic JSON + projection", () => {
  const f = fixture();
  try {
    const started = f.store.start("migrate", "move to ESM");
    assert.ok(started.ok);
    const s0 = started.ok ? started.value : undefined!;
    assert.equal(s0.currentPhase, "inventory");
    assert.equal(s0.phases[0].status, "active");
    assert.ok(existsSync(f.store.statePath("migrate")));

    const p1 = f.store.completePhase("migrate", "inventory", "47 files to convert", {
      data: { files: 47 },
      artifacts: { quest: "q-11112222" },
    });
    assert.ok(p1.ok);
    assert.equal(p1.ok && p1.value.currentPhase, "transform");

    // Out-of-order completion is rejected.
    const wrong = f.store.completePhase("migrate", "verify", "nope");
    assert.equal(wrong.ok, false);
    assert.match(!wrong.ok ? wrong.error : "", /out-of-order/);

    f.store.completePhase("migrate", "transform", "converted");
    const done = f.store.completePhase("migrate", "verify", "all tests green");
    assert.ok(done.ok);
    assert.equal(done.ok && done.value.status, "complete");
    assert.equal(done.ok && done.value.currentPhase, undefined);
    // Lock released on completion.
    assert.equal(f.store.lockInfo("migrate"), undefined);

    const md = readFileSync(join(f.store.dir("migrate"), "state.md"), "utf8");
    assert.match(md, /migrate — complete/);
    assert.match(md, /✓ \*\*inventory\*\*/);
    assert.match(md, /quest: q-11112222/);
    assert.match(md, /\*\*files\*\*: 47/);
    assert.match(md, /do not edit; the JSON is authoritative/);
  } finally { f.close(); }
});

test("refuses a second active run and allows one after abandon", () => {
  const f = fixture();
  try {
    assert.ok(f.store.start("bughunt", "fix crash").ok);
    const second = f.store.start("bughunt", "another");
    assert.equal(second.ok, false);
    assert.match(!second.ok ? second.error : "", /already active/);
    const ab = f.store.abandon("bughunt", "superseded");
    assert.ok(ab.ok);
    assert.ok(f.store.start("bughunt", "another").ok);
  } finally { f.close(); }
});

test("live foreign lock blocks writes; expired lock is broken; unlock forces", () => {
  const f = fixture("session-A");
  try {
    assert.ok(f.store.start("research", "topic").ok);
    // A second session cannot write while A's lock is live.
    const storeB = new ChainStore({ project: f.project, owner: "session-B" });
    const blocked = storeB.completePhase("research", "gather", "sources");
    assert.equal(blocked.ok, false);
    assert.match(!blocked.ok ? blocked.error : "", /locked by another session/);
    // Expired lock: B takes over transparently.
    const storeBLate = new ChainStore({ project: f.project, owner: "session-B", now: () => Date.now() + 31 * 60 * 1000 });
    const taken = storeBLate.completePhase("research", "gather", "sources gathered");
    assert.ok(taken.ok);
    // Force unlock clears whatever remains.
    storeB.unlock("research");
    assert.equal(storeB.lockInfo("research"), undefined);
  } finally { f.close(); }
});

test("imports a legacy v1 markdown state file and makes JSON authoritative", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.project, ".feature-ship-state.md"), [
      "---",
      'task: "add dark mode"',
      "started: 2026-07-01T00:00:00Z",
      "status: build-done",
      "chain_version: 1",
      "---",
      "",
      "## Phase 2 — Build",
      "**Output**: implemented",
    ].join("\n"));
    const state = f.store.read("feature-ship");
    assert.ok(state);
    assert.equal(state?.migratedFromLegacy, true);
    assert.equal(state?.task, "add dark mode");
    assert.equal(state?.currentPhase, "review");
    assert.equal(state?.phases.find((p) => p.name === "build")?.status, "done");
    assert.equal(state?.phases.find((p) => p.name === "review")?.status, "active");
    assert.match(String(state?.data.legacyMarkdown), /Phase 2 — Build/);
    // The import persisted: JSON now exists and is used on subsequent reads.
    assert.ok(existsSync(f.store.statePath("feature-ship")));
    const complete = f.store.completePhase("feature-ship", "review", "review clean");
    assert.ok(complete.ok);
    // Legacy root file left alone.
    assert.ok(existsSync(join(f.project, ".feature-ship-state.md")));
  } finally { f.close(); }
});

test("legacy complete and unknown statuses map correctly", () => {
  assert.deepEqual(legacyStatusToCurrentPhase("migrate", "complete"), { runStatus: "complete" });
  assert.deepEqual(legacyStatusToCurrentPhase("migrate", "inventory-done"), { currentPhase: "transform", runStatus: "active" });
  assert.deepEqual(legacyStatusToCurrentPhase("release", "publish-done"), { currentPhase: "verify", runStatus: "active" });
  assert.deepEqual(legacyStatusToCurrentPhase("release", "verify-done"), { runStatus: "complete" });
  assert.equal(legacyStatusToCurrentPhase("migrate", "banana"), undefined);
  assert.equal(legacyStatusToCurrentPhase("nope", "complete"), undefined);
});

test("questDedupeKey is stable and phase-scoped", () => {
  assert.equal(questDedupeKey("bughunt", "bu-123", "fix"), "bughunt/bu-123/fix/main");
  assert.equal(questDedupeKey("bughunt", "bu-123", "fix", "tests"), "bughunt/bu-123/fix/tests");
});

test("update merges data without advancing phases", () => {
  const f = fixture();
  try {
    f.store.start("onboard", "learn repo");
    const up = f.store.update("onboard", { modules: ["a", "b"] });
    assert.ok(up.ok);
    assert.equal(up.ok && up.value.currentPhase, "map");
    assert.deepEqual(up.ok && up.value.data.modules, ["a", "b"]);
  } finally { f.close(); }
});

test("projection renders without state on disk", () => {
  const md = projectMarkdown({
    contractVersion: 2, chain: "research", runId: "re-1", task: "t", status: "active",
    currentPhase: "gather",
    phases: [{ name: "gather", status: "active" }, { name: "synthesize", status: "pending" }, { name: "artifact", status: "pending" }],
    data: {}, startedAt: "s", updatedAt: "u",
  });
  assert.match(md, /research — active/);
  assert.match(md, /▸ \*\*gather\*\*/);
});
