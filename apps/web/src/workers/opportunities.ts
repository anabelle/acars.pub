/**
 * Opportunity-map worker (S43): projects profit per day for a hub's best
 * unserved destinations off the main thread. Results are cached per hub,
 * game hour and network (see opportunityRequests.ts).
 */
import { whenDataCatalogReady } from "@acars/data";
import {
  createOpportunityHandler,
  type OpportunityRequest,
} from "@/features/network/utils/opportunityRequests";

const handle = createOpportunityHandler(whenDataCatalogReady);

self.onmessage = async (event: MessageEvent<OpportunityRequest>) => {
  self.postMessage(await handle(event.data));
};
