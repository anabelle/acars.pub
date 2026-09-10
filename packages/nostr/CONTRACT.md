# @acars/nostr — Public API Contract

## Version: 1.0.0

## Status: STABLE

Last verified: 2026-09

### Exported Types

```typescript
import type { NDKEvent, NDKFilter } from "@nostr-dev-kit/ndk";
import type {
  GameActionEnvelope,
  Checkpoint,
  FixedPoint,
  AircraftInstance,
} from "@acars/core";

// Re-exported from @acars/core
export type { GameActionEnvelope, Checkpoint, FixedPoint, AircraftInstance };

// Action Log
export interface ActionLogEntry {
  event: NDKEvent;
  action: GameActionEnvelope;
}

// Marketplace
export interface MarketplaceListing {
  id: string; // Nostr event ID
  instanceId: string; // Original aircraft instance ID
  sellerPubkey: string; // Seller's Nostr pubkey
  createdAt: number; // Event creation timestamp
  modelId: string; // Aircraft model ID
  name: string; // Aircraft display name
  ownerPubkey: string; // Owner pubkey (from content)
  marketplacePrice: FixedPoint; // Asking price
  listedAt: number; // When listing was created
  condition: number; // Aircraft condition 0.0-1.0
  flightHoursTotal: number; // Total flight hours
  flightHoursSinceCheck: number; // Flight hours since last check
  birthTick: number; // Tick when aircraft was manufactured
  purchasedAtTick: number; // Tick when current owner purchased
  purchasePrice: FixedPoint; // Original purchase price
  baseAirportIata: string; // Base airport
  purchaseType: "buy" | "lease";
  configuration: {
    economy: number;
    business: number;
    first: number;
    cargoKg: number;
  };
}

// Index for ownership verification
export type SellerFleetIndex = Map<string, Set<string>>; // pubkey -> Set<instanceId>
```

### Exported Constants

```typescript
const ACTION_KIND = 30078; // game action log
const MARKETPLACE_KIND: NDKKind = 30079; // used aircraft listings
const CATALOG_IMAGE_KIND: NDKKind = 30080; // catalog/livery images
const CATALOG_IMAGE_D_PREFIX: string;
```

### Exported Functions

```typescript
// NDK Connection Management
function getNDK(): NDK;
function ensureConnected(): Promise<void>;
function connectedRelayCount(): number;
function reconnectIfNeeded(): Promise<boolean>;

// Identity
function hasNip07(): boolean;
function waitForNip07(timeoutMs?: number): Promise<boolean>;
function getPubkey(timeoutMs?: number): Promise<string | null>;
function loginWithNsec(nsec: string): Promise<string>; // Returns hex pubkey
function attachSigner(): void; // Synchronous, attaches NIP-07 signer to NDK

// Action Log (kind 30078)
// Note: Events with future schemaVersion values are accepted with clamping to
// the max supported version. Older schemaVersion values are accepted for
// backward compatibility.
function loadActionLog(options?: {
  authors?: string[];
  limit?: number;
  maxPages?: number;
  since?: number;
}): Promise<ActionLogEntry[]>;
function publishAction(
  action: GameActionEnvelope,
  seq?: number,
): Promise<NDKEvent>;
function subscribeActions(options: {
  onEvent: (entry: ActionLogEntry) => void;
  authors?: string[];
  since?: number;
  onEose?: () => void;
  onClose?: () => void;
}): Promise<() => void>;

// D-Tags (for event addressing) — exported from schema.ts, not re-exported
// at the package root; import from "@acars/nostr/schema" if needed.
// function buildActionDTag(action: GameActionEnvelope, seq?: number): string;

// Checkpoints
function loadCheckpoint(pubkey: string): Promise<Checkpoint | null>;
function loadCheckpoints(pubkeys: string[]): Promise<Map<string, Checkpoint>>;
function publishCheckpoint(checkpoint: Checkpoint): Promise<NDKEvent>;
function parseCheckpoint(raw: string): Checkpoint | null;

// Snapshots (NIP-33 rollups, see docs/SCALABILITY.md)
function publishSnapshot(payload: SnapshotPayload): Promise<NDKEvent>;
function loadSnapshot(pubkey: string): Promise<SnapshotPayload | null>;
function loadAllSnapshots(): Promise<Map<string, SnapshotPayload>>;

// Marketplace (kind 30079)
function loadMarketplace(
  sellerFleets?: SellerFleetIndex,
): Promise<MarketplaceListing[]>;
function publishUsedAircraft(
  aircraft: AircraftInstance,
  price: FixedPoint,
): Promise<NDKEvent>;
function deleteMarketplaceListing(instanceId: string): Promise<NDKEvent>;

// Catalog images (kind 30080)
function publishCatalogImage(record: CatalogImageRecord): Promise<NDKEvent>;
function loadCatalogImages(): Promise<CatalogImageRecord[]>;

// Identity extras (ephemeral/guest keys)
function generateNewKeypair(): { pubkey: string; secret: string };
function saveEphemeralKey(secret: string): void;
function loadEphemeralKey(): string | null;
function hasStoredEphemeralKey(): boolean;
function clearEphemeralKey(): void;
function resetSigner(): void;

// Blossom file storage
function uploadToBlossom(file: Blob): Promise<string>;
```

### Re-exports

```typescript
// NDK types for downstream consumers
export { NDKEvent } from "@nostr-dev-kit/ndk";
export type { NDKFilter } from "@nostr-dev-kit/ndk";
```

### Contract Rules

1. All exports listed above are FROZEN until a major version bump.
2. Event kinds (30078, 30079, 30080) are part of the contract.
3. Action envelope schema version must be incremented on breaking changes.
4. Relay URLs are NOT part of the contract (configurable).

### Dependencies

- `@nostr-dev-kit/ndk` — Nostr Development Kit
- `@acars/core` — Uses FixedPoint, Checkpoint, GameActionEnvelope, AircraftInstance types
