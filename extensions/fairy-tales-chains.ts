/**
 * fairy-tales-chains: durable state contract for the six skill chains.
 *
 * Registers a `chain` tool the chain skills drive instead of hand-editing
 * root-level markdown state files. Authoritative state is JSON under
 * .pi/fairy-tales/chains/<chain>/state.json with a markdown projection beside
 * it; legacy `.{chain}-state.md` files are imported on first read. See
 * docs/STATE-CONTRACT.md.
 */
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { CHAINS, chainNames, questDedupeKey, type ChainState } from "../src/chain-contracts.ts";
import { ChainStore } from "../src/chain-store.ts";

function isNested(): boolean {
  return ((globalThis as Record<string, unknown>).__fairyTalesDepth as number | undefined ?? 0) > 0;
}

function summarize(state: ChainState): string {
  const phases = state.phases.map((p) => `${p.status === "done" ? "✓" : p.status === "active" ? "▸" : "·"}${p.name}`).join(" ");
  return `${state.chain} ${state.runId} · ${state.status}${state.currentPhase ? ` · current: ${state.currentPhase}` : ""}\n${phases}\ntask: ${state.task}`;
}

export default function (pi: ExtensionAPI) {
  if (isNested()) return;

  let owner = randomUUID();
  let stores = new Map<string, ChainStore>();

  const storeFor = (cwd: string): ChainStore => {
    let store = stores.get(cwd);
    if (!store) {
      store = new ChainStore({ project: cwd, owner });
      stores.set(cwd, store);
    }
    return store;
  };

  pi.on("session_start", async () => {
    owner = randomUUID();
    stores = new Map();
  });

  pi.registerTool({
    name: "chain",
    label: "Skill Chains",
    description:
      `Durable state for multi-phase skill chains (${chainNames().join(", ")}). ` +
      "Actions: 'status' reads the current run (importing legacy state files automatically); 'start' begins a run; " +
      "'complete-phase' marks the current phase done with a summary the next phase reads; 'update' merges extra data; " +
      "'abandon' ends a run early; 'unlock' breaks a dead session's lock. State lives in .pi/fairy-tales/chains/<chain>/state.json " +
      "(authoritative JSON) with a human-readable state.md projection.",
    promptSnippet: "Track durable multi-phase chain state (start/status/complete-phase)",
    promptGuidelines: [
      "Chain skills must use the chain tool for ALL state reads and writes — never create or edit .{chain}-state.md files by hand.",
      "When a chain phase delegates heavy work, enqueue it with the quest tool using dedupeKey `<chain>/<runId>/<phase>/<workId>` and retainUntilConsumed:true so a crashed phase resumes the same quest instead of duplicating work.",
      "Record durable references (artifact URLs, quest ids, PR numbers) in complete-phase artifacts so later phases and resumed sessions can find them.",
    ],
    parameters: Type.Object({
      action: StringEnum(["status", "start", "complete-phase", "update", "abandon", "unlock"] as const),
      chain: StringEnum(chainNames() as [string, ...string[]]),
      task: Type.Optional(Type.String({ description: "For start: the run's task in the user's terms" })),
      phase: Type.Optional(Type.String({ description: "For complete-phase: the phase being completed (must be the current phase)" })),
      summary: Type.Optional(Type.String({ description: "For complete-phase: what was produced/decided — the hand-off the next phase reads" })),
      data: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "For complete-phase/update: chain-specific data to merge" })),
      artifacts: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "For complete-phase: durable references (artifact URLs, quest ids, PRs)" })),
      reason: Type.Optional(Type.String({ description: "For abandon: why the run is being ended" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const store = storeFor(ctx.cwd);
      const chain = params.chain;

      if (params.action === "status") {
        const state = store.read(chain);
        if (!state) {
          const def = CHAINS[chain];
          return {
            content: [{ type: "text", text: `No ${chain} run (fresh or legacy). Phases: ${def.phases.join(" → ")}. Start one with action 'start'.` }],
            details: { chain, phases: def.phases },
          };
        }
        const lock = store.lockInfo(chain);
        const lockLine = lock && lock.owner !== store.owner ? `\nlock: held by ${lock.owner.slice(0, 8)}… until ${lock.expiresAt}` : "";
        return {
          content: [{ type: "text", text: summarize(state) + lockLine + (state.migratedFromLegacy ? "\n(imported from legacy markdown state — the JSON is now authoritative)" : "") }],
          details: { state },
        };
      }

      if (params.action === "start") {
        if (!params.task) throw new Error("chain start requires task");
        const result = store.start(chain, params.task);
        if (!result.ok) return { content: [{ type: "text", text: `Cannot start: ${result.error}` }], details: { error: result.error } };
        return {
          content: [{ type: "text", text: `Started ${summarize(result.value)}\nQuest dedupe keys for this run: ${questDedupeKey(chain, result.value.runId, "<phase>", "<workId>")}` }],
          details: { state: result.value },
        };
      }

      if (params.action === "complete-phase") {
        if (!params.phase || !params.summary) throw new Error("chain complete-phase requires phase and summary");
        const result = store.completePhase(chain, params.phase, params.summary, { data: params.data, artifacts: params.artifacts });
        if (!result.ok) return { content: [{ type: "text", text: `Cannot complete phase: ${result.error}` }], details: { error: result.error } };
        const s = result.value;
        const nextLine = s.status === "complete"
          ? "Chain complete — the run is finished and the lock is released."
          : `Next phase: ${s.currentPhase}.`;
        return { content: [{ type: "text", text: `Phase ${params.phase} done. ${nextLine}\n${summarize(s)}` }], details: { state: s } };
      }

      if (params.action === "update") {
        if (!params.data) throw new Error("chain update requires data");
        const result = store.update(chain, params.data);
        if (!result.ok) return { content: [{ type: "text", text: `Cannot update: ${result.error}` }], details: { error: result.error } };
        return { content: [{ type: "text", text: `Updated ${chain} run data (${Object.keys(params.data).join(", ")}).` }], details: { state: result.value } };
      }

      if (params.action === "abandon") {
        const result = store.abandon(chain, params.reason);
        if (!result.ok) return { content: [{ type: "text", text: `Cannot abandon: ${result.error}` }], details: { error: result.error } };
        return { content: [{ type: "text", text: `Abandoned ${chain} run ${result.value.runId}. A new run can be started.` }], details: { state: result.value } };
      }

      // unlock
      store.unlock(chain);
      return { content: [{ type: "text", text: `Lock for ${chain} cleared.` }], details: {} };
    },
  });

  pi.registerCommand("chains", {
    description: "Show durable chain runs for this project",
    handler: async (_args, ctx) => {
      const store = storeFor(ctx.cwd);
      const lines: string[] = [];
      for (const name of chainNames()) {
        const state = store.read(name);
        if (state) lines.push(`${state.status === "active" ? "▸" : state.status === "complete" ? "✓" : "⊘"} ${name} · ${state.status}${state.currentPhase ? ` · ${state.currentPhase}` : ""} · ${state.task.slice(0, 60)}`);
      }
      if (ctx.hasUI) ctx.ui.notify(lines.length ? lines.join("\n") : "No chain runs in this project.", "info");
      else console.log(lines.length ? lines.join("\n") : "No chain runs in this project.");
    },
  });
}
