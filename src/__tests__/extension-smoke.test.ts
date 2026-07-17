/**
 * In-process smoke test: load the real chains extension against a stub
 * ExtensionAPI (typebox/pi-ai aliased in vitest.config.ts) and drive the
 * chain tool through a full run lifecycle exactly as pi would.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import chainsExtension from "../../extensions/fairy-tales-chains.ts";

interface RegisteredTool {
  name: string;
  execute(id: string, params: Record<string, unknown>, signal?: unknown, onUpdate?: unknown, ctx?: unknown): Promise<{ content: Array<{ type: string; text: string }>; details?: unknown }>;
}

function stubPi() {
  const tools = new Map<string, RegisteredTool>();
  const commands = new Map<string, unknown>();
  return {
    tools,
    commands,
    api: {
      registerTool(tool: RegisteredTool) { tools.set(tool.name, tool); },
      registerCommand(name: string, def: unknown) { commands.set(name, def); },
      on() { /* unused */ },
      events: { on() { /* unused */ }, emit() { /* unused */ } },
    },
  };
}

const text = (r: { content: Array<{ type: string; text: string }> }) => r.content.map((c) => c.text).join("\n");

test("chains extension registers and the chain tool runs a full lifecycle", async () => {
  const pi = stubPi();
  chainsExtension(pi.api as never);
  assert.ok(pi.tools.has("chain"));
  assert.ok(pi.commands.has("chains"));

  const cwd = mkdtempSync(join(tmpdir(), "fairy-chain-smoke-"));
  try {
    const chain = pi.tools.get("chain")!;
    const ctx = { cwd, hasUI: false };

    const fresh = await chain.execute("t1", { action: "status", chain: "release" }, undefined, undefined, ctx);
    assert.match(text(fresh), /No release run/);
    assert.match(text(fresh), /changelog → bump → tag → publish → verify/);

    const start = await chain.execute("t2", { action: "start", chain: "release", task: "ship 1.0" }, undefined, undefined, ctx);
    assert.match(text(start), /Started release re-/);
    assert.match(text(start), /current: changelog/);

    const again = await chain.execute("t3", { action: "start", chain: "release", task: "conflict" }, undefined, undefined, ctx);
    assert.match(text(again), /already active/);

    const wrongPhase = await chain.execute("t4", { action: "complete-phase", chain: "release", phase: "tag", summary: "nope" }, undefined, undefined, ctx);
    assert.match(text(wrongPhase), /out-of-order/);

    const p1 = await chain.execute("t5", {
      action: "complete-phase", chain: "release", phase: "changelog",
      summary: "changelog drafted", data: { entries: 3 }, artifacts: { commit: "abc1234" },
    }, undefined, undefined, ctx);
    assert.match(text(p1), /Next phase: bump/);

    for (const [phase, summary] of [["bump", "0.15.0"], ["tag", "v0.15.0"], ["publish", "pushed"], ["verify", "verified"]] as const) {
      const r = await chain.execute(`t-${phase}`, { action: "complete-phase", chain: "release", phase, summary }, undefined, undefined, ctx);
      assert.doesNotMatch(text(r), /Cannot/);
    }
    const done = await chain.execute("t6", { action: "status", chain: "release" }, undefined, undefined, ctx);
    assert.match(text(done), /complete/);

    // A finished run allows a fresh start.
    const restart = await chain.execute("t7", { action: "start", chain: "release", task: "ship 1.1" }, undefined, undefined, ctx);
    assert.match(text(restart), /Started release/);
    const abandon = await chain.execute("t8", { action: "abandon", chain: "release", reason: "test over" }, undefined, undefined, ctx);
    assert.match(text(abandon), /Abandoned/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
