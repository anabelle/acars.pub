import { connectedRelayCount, reconnectIfNeeded } from "@acars/nostr";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 5000;
// Wait this many consecutive offline polls before attempting reconnect
const OFFLINE_THRESHOLD = 3;
// With no relay yet, report "connecting" for this many polls (~10 s) before "offline".
const CONNECTING_GRACE_POLLS = 2;

export type RelayStatus = "connecting" | "ready" | "offline";

export function useRelayHealth(): {
  isConnected: boolean;
  relayCount: number;
  /** Real relay state: still connecting at startup, ready, or offline. */
  status: RelayStatus;
  /** Try to reconnect now (e.g. from an "offline" badge). */
  retry: () => Promise<void>;
  retrying: boolean;
} {
  const [relayCount, setRelayCount] = useState(() => connectedRelayCount());
  const [polls, setPolls] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const offlineCountRef = useRef(0);
  const reconnectingRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const count = connectedRelayCount();
      setRelayCount(count);
      setPolls((value) => value + 1);

      if (count === 0) {
        offlineCountRef.current += 1;
        // After ~15s offline, proactively try to reconnect
        if (offlineCountRef.current >= OFFLINE_THRESHOLD && !reconnectingRef.current) {
          reconnectingRef.current = true;
          reconnectIfNeeded().finally(() => {
            reconnectingRef.current = false;
            setRelayCount(connectedRelayCount());
          });
        }
      } else {
        offlineCountRef.current = 0;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await reconnectIfNeeded();
    } finally {
      setRelayCount(connectedRelayCount());
      setRetrying(false);
    }
  }, []);

  const status: RelayStatus =
    relayCount > 0 ? "ready" : polls < CONNECTING_GRACE_POLLS ? "connecting" : "offline";

  return { relayCount, isConnected: relayCount > 0, status, retry, retrying };
}
