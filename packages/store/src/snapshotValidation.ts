import type { Checkpoint } from "@acars/core";
import {
  computeCheckpointStateHash,
  createLogger,
  decompressSnapshotString,
  fp,
} from "@acars/core";
import type { SnapshotPayload } from "@acars/nostr";

const logger = createLogger("SnapshotValidation");

/** Defensive cap: a peer snapshot claiming more aircraft than this is rejected. */
export const MAX_SNAPSHOT_FLEET = 5000;
/** Defensive cap: peer balances outside [-$10B, $10B] are rejected. */
const MIN_SNAPSHOT_BALANCE = fp(-10_000_000_000);
const MAX_SNAPSHOT_BALANCE = fp(10_000_000_000);

/**
 * Decompress, parse, and cryptographically verify a peer snapshot payload.
 *
 * Verification steps:
 *  1. `parseCheckpoint` (from @acars/nostr) validates the envelope shape —
 *     schema version, tick, createdAt, non-empty actionChainHash/stateHash,
 *     and that airline/fleet/routes/timeline have the right JSON types.
 *  2. The state hash is recomputed from the decompressed state via
 *     `computeCheckpointStateHash` and must match BOTH the hash declared
 *     inside the checkpoint AND the hash carried by the relay payload —
 *     so a tampered or corrupted body cannot be ingested.
 *  3. Defensive clamps: fleet size <= MAX_SNAPSHOT_FLEET and corporate
 *     balance within [-$10B, $10B]. Out-of-range snapshots are rejected.
 *
 * Returns the verified Checkpoint, or null when the snapshot must be
 * discarded (the caller is expected to warn and keep prior state).
 */
export async function verifySnapshotPayload(payload: SnapshotPayload): Promise<Checkpoint | null> {
  try {
    const decompressedStr = await decompressSnapshotString(payload.compressedData);
    const { parseCheckpoint } = await import("@acars/nostr");
    const parsed = parseCheckpoint(JSON.parse(decompressedStr));
    if (!parsed) {
      logger.warn("Discarding snapshot: envelope failed parseCheckpoint validation");
      return null;
    }

    if (parsed.fleet.length > MAX_SNAPSHOT_FLEET) {
      logger.warn(
        `Discarding snapshot: fleet size ${parsed.fleet.length} exceeds cap ${MAX_SNAPSHOT_FLEET}`,
      );
      return null;
    }

    const balance = parsed.airline.corporateBalance;
    if (
      typeof balance !== "number" ||
      !Number.isFinite(balance) ||
      balance < (MIN_SNAPSHOT_BALANCE as number) ||
      balance > (MAX_SNAPSHOT_BALANCE as number)
    ) {
      logger.warn(`Discarding snapshot: corporate balance out of range`);
      return null;
    }

    const computedStateHash = await computeCheckpointStateHash({
      airline: parsed.airline,
      fleet: parsed.fleet,
      routes: parsed.routes,
      timeline: parsed.timeline,
    });
    if (computedStateHash !== parsed.stateHash || computedStateHash !== payload.stateHash) {
      logger.warn("Discarding snapshot: state hash mismatch (tampered or corrupted payload)");
      return null;
    }

    return parsed;
  } catch (e) {
    logger.warn("Discarding snapshot: decompress/parse threw", e);
    return null;
  }
}
