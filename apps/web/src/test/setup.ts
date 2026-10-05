import "@testing-library/jest-dom/vitest";
// Initialize i18n for tests: English-only init, synchronous-fast (the lazy
// backend serves the statically bundled English JSON without network).
import { initI18n } from "../i18n";

await initI18n();

// Unit tests never talk to real Nostr relays. Importing the real store can
// start NDK's relay connections; under jsdom a socket that actually connects
// crashes undici ("The event argument must be an instance of Event") and fails
// the run as an unhandled error, depending on network timing. A socket that
// never opens keeps every test hermetic.
class OfflineWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly url: string) {
    super();
  }
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
}
globalThis.WebSocket = OfflineWebSocket as unknown as typeof WebSocket;
