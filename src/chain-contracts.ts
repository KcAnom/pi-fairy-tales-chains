/**
 * Chain state contract (v2): types and the chain registry.
 *
 * The authoritative state for a chain run is JSON at
 *   .pi/fairy-tales/chains/<chain>/state.json
 * with a human-readable markdown projection (state.md) beside it. The legacy
 * v1 convention — a `.{chain}-state.md` file at the project root with a
 * `status: <phase>-done` line — is imported on first read and left in place.
 * See docs/STATE-CONTRACT.md for the full contract.
 */

export const CONTRACT_VERSION = 2;

export type ChainRunStatus = "active" | "complete" | "abandoned";
export type PhaseStatus = "pending" | "active" | "done" | "skipped";

export interface ChainPhaseState {
  name: string;
  status: PhaseStatus;
  /** ISO 8601; set when the phase completes. */
  completedAt?: string;
  /** What the phase produced / decided — the hand-off the next phase reads. */
  summary?: string;
  /** Durable references: artifact URLs, quest ids, file paths, PR numbers. */
  artifacts?: Record<string, string>;
}

export interface ChainState {
  contractVersion: number;
  chain: string;
  /** Unique per run; used as the quest dedupe-key prefix (`<chain>/<runId>/<phase>`). */
  runId: string;
  task: string;
  status: ChainRunStatus;
  /** Name of the phase currently in progress (undefined once complete/abandoned). */
  currentPhase?: string;
  phases: ChainPhaseState[];
  /** Chain-specific payload (acceptance criteria, file inventories, findings…). */
  data: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
  /** Imported-from-legacy marker: raw v1 markdown is kept in data.legacyMarkdown. */
  migratedFromLegacy?: boolean;
}

export interface ChainLock {
  owner: string;
  pid: number;
  acquiredAt: string;
  expiresAt: string;
}

export interface ChainDefinition {
  phases: string[];
  /** Root-relative legacy v1 state file. */
  legacyFile: string;
}

/** The six shipped chains, in phase order. */
export const CHAINS: Record<string, ChainDefinition> = {
  "feature-ship": { phases: ["spec", "build", "review", "ship"], legacyFile: ".feature-ship-state.md" },
  bughunt: { phases: ["repro", "diagnose", "fix", "verify"], legacyFile: ".bughunt-state.md" },
  migrate: { phases: ["inventory", "transform", "verify"], legacyFile: ".migrate-state.md" },
  research: { phases: ["gather", "synthesize", "artifact"], legacyFile: ".research-state.md" },
  release: { phases: ["changelog", "bump", "tag", "publish", "verify"], legacyFile: ".release-state.md" },
  onboard: { phases: ["map", "deepen", "digest"], legacyFile: ".onboard-state.md" },
};

export function chainNames(): string[] {
  return Object.keys(CHAINS);
}

/** Map a legacy `status:` value ("spec-done", "complete") to the phase that
 *  should run next. Returns undefined for unrecognized statuses. */
export function legacyStatusToCurrentPhase(chain: string, status: string): { currentPhase?: string; runStatus: ChainRunStatus } | undefined {
  const def = CHAINS[chain];
  if (!def) return undefined;
  if (status === "complete") return { runStatus: "complete" };
  const m = /^(.+)-done$/.exec(status);
  if (!m) return undefined;
  const idx = def.phases.indexOf(m[1]);
  if (idx < 0) return undefined;
  const next = def.phases[idx + 1];
  return next ? { currentPhase: next, runStatus: "active" } : { runStatus: "complete" };
}

/** Quest dedupe key for a phase's durable work: stable within a run, so a
 *  crashed phase re-enqueues into the same quest instead of duplicating it. */
export function questDedupeKey(chain: string, runId: string, phase: string, workId = "main"): string {
  return `${chain}/${runId}/${phase}/${workId}`;
}
