import Dexie, { type EntityTable } from "dexie";
import type { AirlineEntity, AircraftInstance, Route } from "@acars/core";
import type { GameActionEnvelope } from "@acars/core";
import { WORLD_ID } from "@acars/nostr/src/schema";

const DB_NAME = `AirTRDatabase-${WORLD_ID}`;

export interface OutboxRecord {
  id?: number;
  createdAt: number;
  /** Pubkey of the author whose action chain this entry belongs to. */
  pubkey: string;
  /** Monotonic per-author sequence number used when (re)publishing. */
  seq: number;
  action: GameActionEnvelope;
}

export interface MetaRecord {
  key: string;
  value: number;
}

export const db = new Dexie(DB_NAME) as Dexie & {
  airline: EntityTable<AirlineEntity, "id">;
  fleet: EntityTable<AircraftInstance, "id">;
  routes: EntityTable<Route, "id">;
  outbox: EntityTable<OutboxRecord, "id">;
  meta: EntityTable<MetaRecord, "key">;
};

db.version(2).stores({
  airline: "id, ceoPubkey",
  fleet: "id, ownerPubkey, assignedRouteId",
  routes: "id, airlinePubkey, originIata, destinationIata",
});

db.version(3)
  .stores({
    airline: "id, ceoPubkey",
    fleet: "id, ownerPubkey, assignedRouteId",
    routes: "id, airlinePubkey, originIata, destinationIata",
    outbox: "++id, createdAt",
    meta: "&key",
  })
  .upgrade((tx) => {
    // Additive tables only — no data migration required.
    void tx;
  });
