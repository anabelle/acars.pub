import type { AircraftInstance, AircraftModel } from "@acars/core";

/** A milestone the player may choose to post about (S51.2). */
export type PostableMilestone =
  | { kind: "tierUp"; tier: number }
  | { kind: "firstJet"; model: string };

const isJet = (model: Pick<AircraftModel, "type"> | undefined) =>
  Boolean(model && model.type !== "turboprop");

/**
 * The model name of the airline's first jet, when `next` adds it to a fleet
 * that had none in `previous`; null otherwise. Pure.
 */
export function firstJetAdded(
  previous: readonly Pick<AircraftInstance, "modelId">[],
  next: readonly Pick<AircraftInstance, "modelId">[],
  modelOf: (modelId: string) => Pick<AircraftModel, "type" | "name"> | undefined,
): string | null {
  if (previous.some((ac) => isJet(modelOf(ac.modelId)))) return null;
  const jet = next.find((ac) => isJet(modelOf(ac.modelId)));
  return jet ? (modelOf(jet.modelId)?.name ?? null) : null;
}
