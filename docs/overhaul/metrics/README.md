# Funnel metrics

Activation and retention measured from **public game events only**: the signed actions and checkpoints every client already publishes to Nostr relays. There is no tracking script, no cookies and no per-user data. Reports contain counts only, never pubkeys.

## Run it

```bash
pnpm funnel                         # last 7 days, all game relays, printed
pnpm funnel --days 30 --report      # also writes docs/overhaul/metrics/<today>.md
pnpm funnel --relay wss://nostr.acars.pub --days 14
```

Options: `--days <n>`, `--relay <url>` (repeatable), `--world <id>` (defaults to the game's current world), `--max-pages <n>`, `--report`.

The script needs outbound WebSocket access to the relays. The overhaul's cloud agents are blocked from relay hosts by their network policy, so run it from a machine with normal internet access (or allow the relay hosts in the environment).

## What is measured

| Metric                    | Definition                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Created                   | Airlines whose `AIRLINE_CREATE` falls in the window                                           |
| Opened a route            | …that later signed `ROUTE_OPEN`                                                               |
| Assigned an aircraft      | …that later signed `ROUTE_ASSIGN_AIRCRAFT`                                                    |
| First landing (estimated) | First assignment + route distance ÷ 500 km/h (2 h if unknown), if that time has passed        |
| Dn retention              | Signed any action or checkpoint on or after day n; a cohort counts only once it is n days old |
| Time to first assignment  | Median and p75, creation → first assignment                                                   |
| Weekly cohorts            | The same, grouped by creation week (UTC Monday)                                               |
| Daily events              | Events per type and distinct active airlines per UTC day                                      |

Caveats:

- Regular actions expire from relays after 14 days. Only `AIRLINE_CREATE` and `AIRLINE_DISSOLVE` persist, and checkpoints are replaced in place. Windows longer than 14 days still find every airline's genesis, but D30 relies on each airline's latest checkpoint.
- Relays can drop events. Read several relays; the report lists any that could not be read.

Code: `packages/nostr/src/funnel.ts` (pure, tested) and `scripts/funnel.ts` (relay I/O).
