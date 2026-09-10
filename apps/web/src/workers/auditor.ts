import type { Checkpoint } from "@acars/core";
import {
  computeActionChainHash,
  computeCheckpointStateHash,
  decompressSnapshotString,
} from "@acars/core";
import { loadActionLog, loadAllSnapshots, type ActionLogEntry } from "@acars/nostr";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ACTIONS = 1500;
/** Dedicated per-peer pagination: audit one peer per cycle, up to 5 pages. */
const PEER_MAX_PAGES = 5;

type AuditTrigger = "start" | "interval" | "manual";

type WorkerCommand =
  | "start"
  | "stop"
  | "run-now"
  | { type: "start"; intervalMs?: number; maxActions?: number }
  | { type: "stop" }
  | { type: "run-now" };

// ---------------------------------------------------------------------------
// Worker → main-thread message contract.
//
// One peer is audited per cycle (rotation); each cycle posts exactly one
// AuditCycleMessage. The main-thread consumer (arriving in a later wave)
// switches on `type` and can surface failures via `status` + `reason`.
// ---------------------------------------------------------------------------

export type AuditCycleStatus = "ok" | "failed" | "inconclusive";

export interface AuditCycleMessage {
  type: "audit-cycle";
  /** Monotonic cycle counter (increments per audit run). */
  cycle: number;
  trigger: AuditTrigger;
  /** Pubkey of the peer audited in this cycle. */
  pubkey: string;
  status: AuditCycleStatus;
  /** Number of failed checks (state hash mismatch and/or chain hash mismatch). */
  failedCount: number;
  /** Semicolon-joined human-readable reason(s); present when status !== "ok". */
  reason?: string;
  startedAt: number;
  finishedAt: number;
}

export interface AuditErrorMessage {
  type: "audit-error";
  cycle: number;
  trigger: AuditTrigger;
  error: string;
  startedAt: number;
  finishedAt: number;
}

export type AuditorToMainMessage = AuditCycleMessage | AuditErrorMessage;

// ---------------------------------------------------------------------------
// Chain-hash policy.
//
// TICK_UPDATE carries a unique d-tag (`…:action:tick_update`), so NIP-33
// replacement means relays only keep the LATEST one — older tick events are
// gone and can never be re-hashed. Only persistent actions (AIRLINE_CREATE,
// purchases, routes, listings, …) form a verifiable chain.
// ---------------------------------------------------------------------------

import { REPLACEABLE_ACTION_TYPES } from "@acars/core";

function isPersistentAction(entry: ActionLogEntry): boolean {
  return !REPLACEABLE_ACTION_TYPES.has(entry.action.action);
}

/**
 * Canonical action ordering — mirrors the store's replay order
 * (compareActionRecords in packages/store/src/actionReducer.ts): payload tick
 * first, then event created_at, then eventId.
 */
function compareActions(a: ActionLogEntry, b: ActionLogEntry): number {
  const tickOf = (entry: ActionLogEntry): number => {
    const tick = (entry.action.payload as Record<string, unknown> | undefined)?.tick;
    return typeof tick === "number" && Number.isFinite(tick) ? tick : 0;
  };
  const aTick = tickOf(a);
  const bTick = tickOf(b);
  if (aTick !== bTick) return aTick - bTick;
  const aTime = a.event.created_at ?? 0;
  const bTime = b.event.created_at ?? 0;
  if (aTime !== bTime) return aTime - bTime;
  return a.event.id.localeCompare(b.event.id);
}

let interval: number | null = null;
let cycle = 0;
let cycleInFlight = false;
let maxActions = DEFAULT_MAX_ACTIONS;
let intervalMs = DEFAULT_INTERVAL_MS;
/** Round-robin cursor over the snapshot peer list. */
let peerCursor = 0;

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const command = e.data;

  if (command === "start" || (typeof command === "object" && command?.type === "start")) {
    if (interval !== null) return;

    const requestedInterval =
      typeof command === "object" && typeof command.intervalMs === "number"
        ? Math.floor(command.intervalMs)
        : DEFAULT_INTERVAL_MS;
    intervalMs =
      Number.isFinite(requestedInterval) && requestedInterval > 0
        ? requestedInterval
        : DEFAULT_INTERVAL_MS;

    const requestedMaxActions =
      typeof command === "object" && typeof command.maxActions === "number"
        ? Math.floor(command.maxActions)
        : DEFAULT_MAX_ACTIONS;
    maxActions =
      Number.isFinite(requestedMaxActions) && requestedMaxActions > 0
        ? requestedMaxActions
        : DEFAULT_MAX_ACTIONS;

    interval = self.setInterval(() => {
      void runAuditCycle("interval");
    }, intervalMs);
    void runAuditCycle("start");
    return;
  }

  if (command === "run-now" || (typeof command === "object" && command?.type === "run-now")) {
    void runAuditCycle("manual");
    return;
  }

  if (command === "stop" || (typeof command === "object" && command?.type === "stop")) {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }
};

function isCheckpointLike(value: unknown): value is Checkpoint {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.actionChainHash === "string" &&
    typeof record.stateHash === "string" &&
    typeof record.tick === "number" &&
    Array.isArray(record.fleet) &&
    Array.isArray(record.routes) &&
    Array.isArray(record.timeline) &&
    typeof record.airline === "object" &&
    record.airline !== null
  );
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown audit error";
}

interface PeerAuditOutcome {
  status: AuditCycleStatus;
  failedCount: number;
  reasons: string[];
}

/**
 * Verifies one peer's snapshot against its own action log window.
 *
 * - State hash: recomputed from the decompressed checkpoint and compared to
 *   both the snapshot envelope and the checkpoint body.
 * - Chain hash: computed over PERSISTENT actions only (replaceable
 *   TICK_UPDATEs cannot be re-hashed — relays dropped the older ones).
 *   A missing AIRLINE_CREATE makes the chain INCONCLUSIVE, not failed:
 *   the genesis event is required for a full-chain hash and its absence is
 *   an evidence gap, not proof of tampering.
 */
async function verifyPeer(
  pubkey: string,
  compressedData: string,
  expectedStateHash: string,
  actions: ActionLogEntry[],
): Promise<PeerAuditOutcome> {
  const issues: string[] = [];
  let failedCount = 0;

  const decompressed = await decompressSnapshotString(compressedData);
  const parsed = JSON.parse(decompressed);
  if (!isCheckpointLike(parsed)) {
    throw new Error("Malformed snapshot checkpoint payload");
  }
  const checkpoint = parsed;

  const computedStateHash = await computeCheckpointStateHash({
    airline: checkpoint.airline,
    fleet: checkpoint.fleet,
    routes: checkpoint.routes,
    timeline: checkpoint.timeline,
  });
  const stateHashValid =
    computedStateHash === expectedStateHash && computedStateHash === checkpoint.stateHash;
  if (!stateHashValid) {
    failedCount += 1;
    issues.push("state-hash-mismatch");
  }

  const persistentActions = actions.filter(isPersistentAction).sort(compareActions);

  if (!persistentActions.some((entry) => entry.action.action === "AIRLINE_CREATE")) {
    // Genesis is required for a complete chain hash; without it we simply
    // cannot reconstruct the chain (relay pruning, pre-genesis world…).
    return { status: "inconclusive", failedCount, reasons: [...issues, "missing-airline-create"] };
  }

  if (persistentActions.length === 0) {
    return { status: "inconclusive", failedCount, reasons: [...issues, "no-persistent-actions"] };
  }

  let chainHash = "";
  for (const entry of persistentActions) {
    chainHash = await computeActionChainHash(chainHash, {
      id: entry.event.id,
      createdAt: entry.event.created_at ?? null,
      authorPubkey: pubkey,
      action: entry.action,
    });
  }

  if (chainHash !== checkpoint.actionChainHash) {
    failedCount += 1;
    issues.push("action-chain-mismatch");
  }

  return {
    status: failedCount > 0 ? "failed" : "ok",
    failedCount,
    reasons: issues,
  };
}

async function runAuditCycle(trigger: AuditTrigger): Promise<void> {
  if (cycleInFlight) return;
  cycleInFlight = true;
  cycle += 1;
  const startedAt = Date.now();
  const currentCycle = cycle;

  try {
    const snapshots = await loadAllSnapshots();
    const peers = [...snapshots.keys()];

    if (peers.length === 0) {
      const payload: AuditErrorMessage = {
        type: "audit-error",
        cycle: currentCycle,
        trigger,
        error: "No snapshot peers available to audit",
        startedAt,
        finishedAt: Date.now(),
      };
      self.postMessage(payload);
      return;
    }

    // Rotation: audit ONE peer per cycle with a dedicated paginated window,
    // instead of one shallow global window shared across all peers.
    const pubkey = peers[peerCursor % peers.length];
    peerCursor += 1;
    const snapshot = snapshots.get(pubkey);
    if (!snapshot) {
      const payload: AuditErrorMessage = {
        type: "audit-error",
        cycle: currentCycle,
        trigger,
        error: `Snapshot disappeared for peer ${pubkey.slice(0, 8)}…`,
        startedAt,
        finishedAt: Date.now(),
      };
      self.postMessage(payload);
      return;
    }

    const actions = await loadActionLog({
      authors: [pubkey],
      limit: maxActions,
      maxPages: PEER_MAX_PAGES,
    });

    let outcome: PeerAuditOutcome;
    try {
      outcome = await verifyPeer(pubkey, snapshot.compressedData, snapshot.stateHash, actions);
    } catch (error) {
      // Decompression/validation throws mean the snapshot payload is invalid
      // (including rejected decompression bombs) → audit failure.
      outcome = { status: "failed", failedCount: 1, reasons: [normalizeError(error)] };
    }

    const message: AuditCycleMessage = {
      type: "audit-cycle",
      cycle: currentCycle,
      trigger,
      pubkey,
      status: outcome.status,
      failedCount: outcome.failedCount,
      ...(outcome.reasons.length > 0 ? { reason: outcome.reasons.join("; ") } : {}),
      startedAt,
      finishedAt: Date.now(),
    };
    self.postMessage(message);
  } catch (error) {
    const payload: AuditErrorMessage = {
      type: "audit-error",
      cycle: currentCycle,
      trigger,
      error: normalizeError(error),
      startedAt,
      finishedAt: Date.now(),
    };
    self.postMessage(payload);
  } finally {
    cycleInFlight = false;
  }
}
