/**
 * Root-level Pages Function wrapper.
 *
 * CF Pages only injects env bindings for handlers *defined* inside
 * `/functions`.  A bare `export { onRequest } from "…"` re-export
 * can lose the binding context at deploy time.  We therefore wrap
 * the call explicitly so the runtime sees an entry-point in this
 * file and wires up `context.env` correctly.
 */
import { onRequest as handler } from "../../apps/web/functions/api/generate-livery";

export const onRequest: PagesFunction = (context) => handler(context);
