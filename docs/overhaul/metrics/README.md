# Funnel metrics

Activation and retention measured from **public game events only**: the signed actions and saved states every client already publishes to Nostr relays. There is no tracking script, no cookies and no per-user data. Reports contain counts only, never pubkeys.

## Run it

```bash
pnpm funnel                         # last 7 days, all game relays, printed
pnpm funnel --days 30 --report      # also writes docs/overhaul/metrics/<today>.md
pnpm funnel --relay wss://nostr.acars.pub --days 14
```

Options: `--days <n>`, `--relay <url>` (repeatable), `--world <id>` (defaults to the game's current world), `--max-pages <n>`, `--report`.

The script needs outbound WebSocket access to the relays. The overhaul's cloud agents are blocked from relay hosts by their network policy, so run it from a machine with normal internet access (or allow the relay hosts in the environment).

## What is measured

| Metric                    | Definition                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Created                   | Airlines whose `AIRLINE_CREATE` falls in the window                                            |
| Opened a route            | …that later signed `ROUTE_OPEN`                                                                |
| Assigned an aircraft      | …that later signed `ROUTE_ASSIGN_AIRCRAFT`                                                     |
| First landing (estimated) | First assignment + route distance ÷ 500 km/h (2 h if unknown), if that time has passed         |
| Dn retention              | Signed any action or saved state on or after day n; a cohort counts only once it is n days old |
| Time to first assignment  | Median and p75, creation → first assignment                                                    |
| Weekly cohorts            | The same, grouped by creation week (UTC Monday)                                                |
| Daily events              | Events per type and distinct active airlines per UTC day                                       |

Caveats:

- Most actions expire from relays after 14 days. `AIRLINE_CREATE`, `AIRLINE_DISSOLVE`, `ROUTE_OPEN` and `ROUTE_ASSIGN_AIRCRAFT` persist (creates since 2026-09-10, route stages since 2026-10-06), and saved states (snapshots) are replaced in place. Later retention relies on each airline's latest saved state.
- Reads use indexed filters only: `#d` for creates and saved states, then `authors` for those airlines' actions. Public relays carry kind 30078 for many apps and don't index the `world` tag, so an unfiltered scan finds nothing.
- Relays can drop events. Read several relays; the report lists any that could not be read.

Code: `packages/nostr/src/funnel.ts` (pure, tested) and `scripts/funnel.ts` (relay I/O).
