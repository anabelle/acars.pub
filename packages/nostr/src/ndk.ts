import { createLogger } from "@airtr/core";
import NDK from "@nostr-dev-kit/ndk";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://offchain.pub",
  "wss://relay.nostr.net",
  "wss://relay.nos.social",
  "wss://nostr.land",
];

let ndkInstance: NDK | null = null;
let connectionPromise: Promise<void> | null = null;
const logger = createLogger("Nostr");

/**
 * Get (or create) the NDK singleton.
 */
export function getNDK(): NDK {
  if (!ndkInstance) {
    ndkInstance = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      initialValidationRatio: 1.0,
      lowestValidationRatio: 1.0,
    });
  }
  return ndkInstance;
}

/**
 * Ensures we are connected to at least one relay.
 * Returns a promise that resolves once the connection process is initiated
 * and at least one relay has acknowledged.
 */
export async function ensureConnected(): Promise<void> {
  const ndk = getNDK();

  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    logger.info("Connecting to relays:", DEFAULT_RELAYS.length);
    // ndk.connect() attempts to connect to all explicit relays.
    // It returns a promise that resolves when the first relay connects.
    try {
      await ndk.connect(3000);
      logger.info("Initial connection attempt complete.");
    } catch {
      logger.warn(
        "Connection attempt timed out or failed, but NDK will keep trying in background.",
      );
    }
  })();

  return connectionPromise;
}
