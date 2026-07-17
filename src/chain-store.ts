/**
 * ChainStore: durable, crash-safe state for skill chains.
 *
 * Authoritative JSON at .pi/fairy-tales/chains/<chain>/state.json, written
 * atomically (temp file + rename) together with a human-readable markdown
 * projection (state.md). A TTL'd lock file serializes writers across
 * sessions; the owner renews it on every write and stale locks are broken
 * automatically. Legacy root-level `.{chain}-state.md` files are imported on
 * first read (raw markdown preserved in data.legacyMarkdown).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  CHAINS,
  CONTRACT_VERSION,
  legacyStatusToCurrentPhase,
  type ChainLock,
  type ChainPhaseState,
  type ChainState,
} from "./chain-contracts.ts";

const LOCK_TTL_MS = 30 * 60 * 1000;

export interface ChainStoreOptions {
  project: string;
  /** Session identity for the lock. */
  owner: string;
  lockTtlMs?: number;
  /** Injected for tests. */
  now?: () => number;
}

export type ChainResult<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): ChainResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): ChainResult<T> {
  return { ok: false, error };
}

export class ChainStore {
  readonly project: string;
  readonly owner: string;
  private readonly lockTtlMs: number;
  private readonly now: () => number;

  constructor(options: ChainStoreOptions) {
    this.project = resolve(options.project);
    this.owner = options.owner;
    this.lockTtlMs = Math.max(1000, options.lockTtlMs ?? LOCK_TTL_MS);
    this.now = options.now ?? Date.now;
  }

  dir(chain: string): string {
    return join(this.project, ".pi", "fairy-tales", "chains", chain);
  }

  statePath(chain: string): string {
    return join(this.dir(chain), "state.json");
  }

  private lockPath(chain: string): string {
    return join(this.dir(chain), "state.lock.json");
  }

  /** Read current state; imports the legacy v1 root markdown file when no
   *  JSON state exists yet. Returns undefined when there is no run at all. */
  read(chain: string): ChainState | undefined {
    const path = this.statePath(chain);
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf8")) as ChainState;
      } catch {
        return undefined; // corrupt state surfaces as "no run"; start() will refuse via lock anyway
      }
    }
    return this.migrateLegacy(chain);
  }

  /** Begin a new run. Refuses while an unfinished run exists. */
  start(chain: string, task: string): ChainResult<ChainState> {
    const def = CHAINS[chain];
    if (!def) return fail(`unknown chain "${chain}" — one of: ${Object.keys(CHAINS).join(", ")}`);
    const existing = this.read(chain);
    if (existing && existing.status === "active") {
      return fail(
        `a ${chain} run is already active (runId ${existing.runId}, phase ${existing.currentPhase ?? "?"}). ` +
          `Resume it, or abandon it first with action "abandon".`,
      );
    }
    const lock = this.acquireLock(chain);
    if (!lock.ok) return fail(lock.error);
    const nowIso = new Date(this.now()).toISOString();
    const state: ChainState = {
      contractVersion: CONTRACT_VERSION,
      chain,
      runId: `${chain.slice(0, 2)}-${randomUUID().slice(0, 8)}`,
      task,
      status: "active",
      currentPhase: def.phases[0],
      phases: def.phases.map((name, i): ChainPhaseState => ({ name, status: i === 0 ? "active" : "pending" })),
      data: {},
      startedAt: nowIso,
      updatedAt: nowIso,
    };
    this.write(chain, state);
    return ok(state);
  }

  /** Mark the current phase done and advance. Rejects out-of-order completions. */
  completePhase(
    chain: string,
    phase: string,
    summary: string,
    extras?: { data?: Record<string, unknown>; artifacts?: Record<string, string> },
  ): ChainResult<ChainState> {
    const state = this.read(chain);
    if (!state) return fail(`no ${chain} run to complete a phase in — start one first`);
    if (state.status !== "active") return fail(`the ${chain} run ${state.runId} is ${state.status}, not active`);
    if (state.currentPhase !== phase) {
      return fail(`out-of-order completion: current phase is "${state.currentPhase}", not "${phase}"`);
    }
    const lock = this.acquireLock(chain);
    if (!lock.ok) return fail(lock.error);
    const idx = state.phases.findIndex((p) => p.name === phase);
    const nowIso = new Date(this.now()).toISOString();
    state.phases[idx] = {
      ...state.phases[idx],
      status: "done",
      completedAt: nowIso,
      summary,
      artifacts: { ...state.phases[idx].artifacts, ...extras?.artifacts },
    };
    if (extras?.data) state.data = { ...state.data, ...extras.data };
    const next = state.phases[idx + 1];
    if (next) {
      next.status = "active";
      state.currentPhase = next.name;
    } else {
      state.status = "complete";
      state.currentPhase = undefined;
      this.releaseLock(chain);
    }
    state.updatedAt = nowIso;
    this.write(chain, state);
    return ok(state);
  }

  /** Merge chain-specific data without touching phase progression. */
  update(chain: string, data: Record<string, unknown>): ChainResult<ChainState> {
    const state = this.read(chain);
    if (!state) return fail(`no ${chain} run to update`);
    const lock = this.acquireLock(chain);
    if (!lock.ok) return fail(lock.error);
    state.data = { ...state.data, ...data };
    state.updatedAt = new Date(this.now()).toISOString();
    this.write(chain, state);
    return ok(state);
  }

  abandon(chain: string, reason?: string): ChainResult<ChainState> {
    const state = this.read(chain);
    if (!state) return fail(`no ${chain} run to abandon`);
    if (state.status !== "active") return fail(`the ${chain} run is already ${state.status}`);
    const lock = this.acquireLock(chain);
    if (!lock.ok) return fail(lock.error);
    state.status = "abandoned";
    state.currentPhase = undefined;
    if (reason) state.data.abandonReason = reason;
    state.updatedAt = new Date(this.now()).toISOString();
    this.write(chain, state);
    this.releaseLock(chain);
    return ok(state);
  }

  /** Break the lock regardless of owner (recovery from a dead session). */
  unlock(chain: string): void {
    rmSync(this.lockPath(chain), { force: true });
  }

  lockInfo(chain: string): ChainLock | undefined {
    try {
      return JSON.parse(readFileSync(this.lockPath(chain), "utf8")) as ChainLock;
    } catch {
      return undefined;
    }
  }

  private acquireLock(chain: string): ChainResult<ChainLock> {
    mkdirSync(this.dir(chain), { recursive: true });
    const now = this.now();
    const current = this.lockInfo(chain);
    if (current && current.owner !== this.owner && Date.parse(current.expiresAt) > now) {
      return fail(
        `chain "${chain}" is locked by another session (owner ${current.owner.slice(0, 8)}…, expires ${current.expiresAt}). ` +
          `Use action "unlock" if that session is dead.`,
      );
    }
    const lock: ChainLock = {
      owner: this.owner,
      pid: process.pid,
      acquiredAt: current?.owner === this.owner ? current.acquiredAt : new Date(now).toISOString(),
      expiresAt: new Date(now + this.lockTtlMs).toISOString(),
    };
    this.atomicWrite(this.lockPath(chain), JSON.stringify(lock, null, 2));
    return ok(lock);
  }

  private releaseLock(chain: string): void {
    const current = this.lockInfo(chain);
    if (!current || current.owner === this.owner) rmSync(this.lockPath(chain), { force: true });
  }

  private migrateLegacy(chain: string): ChainState | undefined {
    const def = CHAINS[chain];
    if (!def) return undefined;
    const legacyPath = join(this.project, def.legacyFile);
    if (!existsSync(legacyPath)) return undefined;
    let raw: string;
    try {
      raw = readFileSync(legacyPath, "utf8");
    } catch {
      return undefined;
    }
    const status = /^status:\s*(\S+)/m.exec(raw)?.[1] ?? "";
    const task = /^task:\s*"?([^"\n]*)"?/m.exec(raw)?.[1]?.trim() ?? "(imported from legacy state)";
    const mapped = legacyStatusToCurrentPhase(chain, status);
    if (!mapped) return undefined; // unrecognized legacy file — leave it alone
    const nowIso = new Date(this.now()).toISOString();
    const started = /^started:\s*(\S+)/m.exec(raw)?.[1] ?? nowIso;
    const currentIdx = mapped.currentPhase ? def.phases.indexOf(mapped.currentPhase) : def.phases.length;
    const state: ChainState = {
      contractVersion: CONTRACT_VERSION,
      chain,
      runId: `${chain.slice(0, 2)}-${randomUUID().slice(0, 8)}`,
      task,
      status: mapped.runStatus,
      currentPhase: mapped.currentPhase,
      phases: def.phases.map((name, i): ChainPhaseState => ({
        name,
        status: i < currentIdx ? "done" : i === currentIdx && mapped.runStatus === "active" ? "active" : mapped.runStatus === "active" ? "pending" : "done",
      })),
      data: { legacyMarkdown: raw },
      startedAt: started,
      updatedAt: nowIso,
      migratedFromLegacy: true,
    };
    // Persist the import so the JSON is authoritative from here on. The legacy
    // root file is left untouched for the user to delete.
    mkdirSync(this.dir(chain), { recursive: true });
    this.write(chain, state);
    return state;
  }

  private write(chain: string, state: ChainState): void {
    mkdirSync(this.dir(chain), { recursive: true });
    this.atomicWrite(this.statePath(chain), JSON.stringify(state, null, 2));
    this.atomicWrite(join(this.dir(chain), "state.md"), projectMarkdown(state));
  }

  private atomicWrite(path: string, content: string): void {
    const tmp = `${path}.tmp-${process.pid}-${Math.floor(this.now() % 100000)}`;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  }
}

/** Human-readable projection of the authoritative JSON. Never parsed back. */
export function projectMarkdown(state: ChainState): string {
  const mark: Record<string, string> = { done: "✓", active: "▸", pending: "·", skipped: "⊘" };
  const lines: string[] = [];
  lines.push(`# ${state.chain} — ${state.status}`);
  lines.push("");
  lines.push(`> Generated projection of \`state.json\` (contract v${state.contractVersion}) — do not edit; the JSON is authoritative.`);
  lines.push("");
  lines.push(`- **task**: ${state.task}`);
  lines.push(`- **run**: ${state.runId} · started ${state.startedAt} · updated ${state.updatedAt}`);
  if (state.migratedFromLegacy) lines.push(`- imported from the legacy v1 markdown state file`);
  lines.push("");
  lines.push("## Phases");
  lines.push("");
  for (const p of state.phases) {
    lines.push(`- ${mark[p.status] ?? "·"} **${p.name}** — ${p.status}${p.completedAt ? ` (${p.completedAt})` : ""}`);
    if (p.summary) for (const s of p.summary.split("\n")) lines.push(`  ${s}`);
    for (const [k, v] of Object.entries(p.artifacts ?? {})) lines.push(`  - ${k}: ${v}`);
  }
  const dataKeys = Object.keys(state.data).filter((k) => k !== "legacyMarkdown");
  if (dataKeys.length) {
    lines.push("");
    lines.push("## Data");
    lines.push("");
    for (const k of dataKeys) {
      const v = state.data[k];
      const rendered = typeof v === "string" ? v : JSON.stringify(v);
      lines.push(`- **${k}**: ${rendered.length > 400 ? `${rendered.slice(0, 400)}…` : rendered}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
