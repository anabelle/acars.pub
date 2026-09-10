let sharedQueue: Promise<void> = Promise.resolve();

/**
 * Backpressure guard: once more than QUEUE_CAP updates are waiting, warn
 * (throttled) instead of growing the chain without limit. Entries are NOT
 * dropped — every queued update mutates game state and losing one would
 * desync the deterministic replay; correctness wins over memory neatness.
 */
const QUEUE_CAP = 10000;
let pendingCount = 0;
let lastWarnAt = 0;
const WARN_THROTTLE_MS = 10_000;

export async function enqueueSerialUpdate(update: () => Promise<void>): Promise<void> {
  pendingCount += 1;
  if (pendingCount > QUEUE_CAP && Date.now() - lastWarnAt > WARN_THROTTLE_MS) {
    lastWarnAt = Date.now();
    console.warn(
      `[AsyncQueue] ${pendingCount} updates pending (cap ${QUEUE_CAP}) — producer is outpacing the serialized consumer`,
    );
  }
  const run = sharedQueue.then(update, update);
  sharedQueue = run
    .then(() => {
      pendingCount -= 1;
    })
    .catch(() => {
      pendingCount -= 1;
    });
  return run;
}
