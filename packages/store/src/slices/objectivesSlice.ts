import type { StateCreator } from "zustand";
import { publishActionWithChain } from "../actionChain";
import { useEngineStore } from "../engine";
import type { AirlineState } from "../types";

export interface ObjectivesSlice {
  /**
   * S32: claim a completed daily objective. Not applied optimistically: the
   * replay of the published event verifies it (D6) and credits the reward,
   * exactly as every other client will.
   */
  claimObjective: (objectiveId: string) => Promise<void>;
}

export const createObjectivesSlice: StateCreator<AirlineState, [], [], ObjectivesSlice> = (
  set,
  get,
) => ({
  claimObjective: async (objectiveId: string) => {
    if (!get().airline) throw new Error("No airline to claim for.");
    await publishActionWithChain({
      action: {
        schemaVersion: 2,
        action: "CLAIM_OBJECTIVE",
        payload: { objectiveId, tick: useEngineStore.getState().tick },
      },
      get,
      set,
    });
  },
});
