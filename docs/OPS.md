# OPS — the live bot and the store

**Owns:** `engine/mag_bot.js`, `engine/showdown_bot.js`, the Showdown connection, OTS ingest,
replay publication, the team pool, `data/live-games/`.

**Its one number:** usable share of the store, and battles recorded.

**May not:** block any other division. This is the one place where an interruption costs a real
game rather than a re-run.

<!-- GENERATED: engine/status.js -->

```
OPS — the live bot and the store
  store: 63490 games, 16973 usable (26.7%), 15740 teams   (live.js 2026-08-21)
  live-games/: 34 battles recorded
  data/games.ladder.jsonl      last written 2026-08-21 18:01
  data/games.bo3.jsonl         last written 2026-08-21 18:02  <- the Force-OTS format, collected hourly
  data/games.ots.jsonl         last written 2026-07-24 23:46  <- FROZEN external import, complete; date is an import, not a heartbeat
```

_stamped 2026-08-21 22:28_

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
- `data/games.ots.jsonl` has not been written since July. Confirm whether OTS ingest is still
  landing in it or has moved to the ladder store.
