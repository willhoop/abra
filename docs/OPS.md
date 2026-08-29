# OPS — the live bot and the store

**Owns:** `engine/mag_bot.js`, `engine/showdown_bot.js`, the Showdown connection, OTS ingest,
replay publication, the team pool, `data/live-games/`.

**Its one number:** usable share of the store, and battles recorded.

**May not:** block any other division. This is the one place where an interruption costs a real
game rather than a re-run.

<!-- GENERATED: engine/status.js -->

```
OPS — the live bot and the store
  store: 71587 games, 20862 usable (29.1%), 19016 teams   (live.js 2026-08-29)
  live-games/: 34 battles recorded
  data/games.ladder.jsonl      last written 2026-08-29 09:01
  data/games.bo3.jsonl         last written 2026-08-29 09:02  <- the Force-OTS format, collected hourly
  data/games.ots.jsonl         last written 2026-08-21 22:35  <- FROZEN external import, complete; date is an import, not a heartbeat
```

_stamped 2026-08-29 09:55_

<!-- /GENERATED -->

## Standing state

MAGABRA is **locked** on Showdown (`!magabra`): it can battle and save replays, it **cannot chat**.
`--trash` is wired and silently dropped by the server — that is the lock, not a code bug.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` is required for anything that
touches the simulator.

The password is in `data/.showdown-pass` (gitignored). **Never type it into a command.**

## The rules that are not negotiable

- **NEVER restart the live bot mid-battle.** It forfeits Will's game. There is no urgency that
  outranks this.
- **OTS only.** Non-OTS games are thrown out; OTS games are recorded and the replay auto-published.
- **Never `git add -A` or `git add -u`.** The ingest churns `archetypes.json`, `kad-replays.js`,
  `live.js` and `conformance.json` on every run, so a broad add sweeps generated noise into the
  commit. Add files by name.
- **6 processes maximum**, and ask before running wide while Will is at the keyboard. RAM is the
  real cap, not cores.

## Store contamination — measured 2026-08-27, NOT acted on

Full account: `docs/_reports/2026-08-27-contamination-refresh.md`.

`data/store-validation.json` was refreshed against the current ladder store (**67,384 games**,
591,457 revealed sets); the previous reading was 2026-08-07 over 47,210. **The headline is an UPPER
BOUND and must not be used as a filter key** — it splits into two unlike things:

| class | games | rate | what it is |
|---|---|---|---|
| headline (any illegal set) | 1,252 | 1.858% | upper bound, do not filter on this |
| **species** | **76** | **0.113%** | contamination — a team from another regulation |
| move-only | 1,175 | 1.744% | mostly the **Illusion signature**; 1,020 of them have a Zoroark line on the same side |

A second, independent walk — every key in `sets`/`six`/`brought`/`lead` against
`Dex.forFormat(...)` — returns **the same 76 games**. Two rulers, one number.

**No filter has been added and no artifact was changed.** The filter is Will's decision; this is the
costing for it.

## Reading the record

The head-to-head against Will sits around 15-4. **Do not read that as strength.** He plays
unfamiliar teams deliberately. It is a measurement of his experiment, not of the bot.

## Done looks like

- Usable share of the store trending up, not just total games.
- Every OTS game recorded with its replay published.
- Zero mid-battle restarts.

## Backlog

- The team pool's base filter is completeness, not quality — that item is owned by
  [SEARCH.md](SEARCH.md) because it changes what gets measured, not how the bot runs.
- ~~`data/games.ots.jsonl` has not been written since July. Confirm whether OTS ingest is still
  landing in it or has moved to the ladder store.~~ **ANSWERED AND STRUCK 2026-08-27.** The code
  answers it, and the generated block above already said so — this line contradicted its own page.
  `engine/ingest_ots.js` is a **manual importer**: it takes `logs_*.json` files as arguments and
  prints a usage line with none. It appears **nowhere in `.github/workflows/`** (`grep -rn
  ingest_ots .github/` returns nothing), so no scheduled run has ever written it and none was
  missed. It also **refuses** `--out data/games.ladder.jsonl` by name, so the ingest cannot have
  "moved to the ladder store" — the two corpora are different information AND incentive regimes and
  the importer will not pool them. The premise was stale as well: the file was last written
  **2026-08-21 22:35**, not July.
