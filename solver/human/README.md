# solver/human — the Reg M-C open-sheet human decision dataset

The behaviour-cloning seed, the store-derived action-pruning prior and the HYPNO habit model all
read this dataset (see `docs/_reports/2026-09-23-solver-research-learning.md` §9 step 1 and
`-turn-search.md` §3.4). It is built from the **raw replay logs** of the Reg M-C bo3 stream (the
open-sheet ladder), never from the parsed store.

```
cmd.exe /c tools\lownode.cmd solver\human\build_dataset.js          # full build -> solver/out/human/
cmd.exe /c tools\lownode.cmd solver\tests\test-human-parse.js       # GREEN / RED, exit 0 / 1
```

Options: `--limit N` (first N rows, for a quick trial), `--out <dir>`.

## Files (in `solver/out/human/`, untracked)

| file | what |
|---|---|
| `games.jsonl` | one kept game per line: `{ game, turns }` |
| `exclusions.jsonl` | one excluded game per line: `{ id, reason, reasons, detail }` — `reason` is the first of `manifest.filters.order` that applies, `reasons` is all of them |
| `manifest.json` | every input shard (path, bytes, sha256), the Showdown checkout and HEAD commit, the filter rules, every count, sample parse errors, output digests |

**Reproducibility.** The collector appends a new shard every hour. The manifest names every shard
read and its sha256, taken from the same bytes that were parsed. A shard written after the run
started is not in it. To reproduce: read exactly those shards.

## `game`

| field | meaning |
|---|---|
| `id`, `uploadtime`, `date` | replay id; upload time (epoch s, ISO) |
| `format`, `rated`, `rules` | the `|tier|` string; ladder-rated or not (challenge games are unrated); the `|rule|` lines |
| `series` | `{ id, game }` — the best-of-3 series id and this game's number (1–3), from the `bestof` banner |
| `players.p1/p2` | `{ name, rating }` — rating at game start, from `|player|` |
| `sheets.p1/p2` | the six open team sheets: `{ i, nick, species, species_id, item, ability, moves[4], nature, gender, level }`. **Spreads are not published**; open sheets carry no nicknames, so `nick` is the species |
| `teamsize` | how many each side brought (4) |
| `leads.p1/p2` | sheet indices of the two leads |
| `brought_seen`, `bring_complete` | sheet indices that ever took the field; whether all four were seen |
| `winner`, `tie`, `end` | `'p1'`/`'p2'`; `end` is `normal`, `forfeit` or `inactivity` |
| `turns_played` | number of `turns` entries |

## `turns[k]`

| field | meaning |
|---|---|
| `n` | turn number |
| `t_open`, `t_resolve` | the last `|t:|` stamp before the turn and the first after it (epoch s). `t_resolve − t_open` bounds the slower player's thinking time plus the previous turn's animation |
| `state` | the PUBLIC state before the turn — see below |
| `actions.p1/p2.a/b` | each side's JOINT action, one entry per slot occupied at turn start (null = empty slot) |
| `midturn_switches[]` | switch choices made DURING the turn: `{ side, pos, to, to_species, reason, chooser }`. `reason` is the move (`U-turn`, `Parting Shot`, `Flip Turn`, `Volt Switch`, `Baton Pass`, `Shed Tail`, `Chilly Reception`), `eject` (Eject Button / Eject Pack / Emergency Exit), `Revival Blessing`, or `drag` (not a choice: `chooser` is the opponent) |
| `replacements[]` | end-of-turn faint replacements: `{ side, pos, to, to_species }` — a human choice |
| `revivals[]` | Revival Blessing targets `{ side, mon, species }` — also a human choice |
| `aux_moves[]` | moves that are NOT a decision: called or copied (`[from]` Dancer, Magic Bounce, Sleep Talk…) and Instruct repeats |
| `terminal` | true on the last turn (the game ended inside it) |

### An action

```
{ kind:'move',   move, target, target_loc, target_certain, executed, [still], [cant], [mega], mon }
{ kind:'switch', to, to_species, mon }
{ kind:'locked', reason:'lockedmove'|'recharge', [move], [mega], mon }
{ kind:'hidden', reason, [mega], mon }
```

- `mon` is the sheet index of the mon in that slot at turn start; `to` is a sheet index.
- `target_loc` uses Showdown's choice numbering: `1`/`2` = the opponent's slot a/b, `-1`/`-2` = your
  own slot a/b. It is `null` for a move with no target choice (spread, self, side, field — read from
  the move's `target` type in `Dex.forFormat`).
- **`target_certain:false` means the log shows the target that was HIT, which may not be the one
  CHOSEN**: a Follow Me / Rage Powder / Spotlight user was hit, a Lightning Rod / Storm Drain holder
  absorbed a matching-type move, or a mon on the target side had already fainted that turn (retarget).
  Also false when no target is printed at all.
- `executed:false` with `cant` = the move was chosen but blocked (Taunt, Disable, Throat Chop…).
- `mega:true` = this slot mega evolved this turn. It may sit on a `hidden` action (mega, then flinched).
- `hidden` reasons: `cant:<why>` (flinch, slp, par, frz, Attract…), `confusion_self_hit`,
  `fainted_before_acting`, `forced_out_before_acting` (Emergency Exit, a bounced Parting Shot),
  `game_ended`. The chosen action for these is **not in the log** and is not guessed.
- `locked` is not a choice (Outrage-type continuation, a charge move's second turn, a recharge turn).

**Fully observed joint action** = both occupied slots are `move` or `switch`. That is the BC label;
keep the partially observed ones for per-slot and pruning statistics.

### `state` (before the turn)

```
{ weather:{name,since}|null, terrain:{name,since}|null, pseudo:{ 'Trick Room': sinceTurn, ... },
  sides: { p1: { mega_used, conditions:{ Tailwind:{since,layers}, Reflect:..., Spikes:... },
                 active:[idx_a|null, idx_b|null],
                 mons:[ { i, seen:false }
                      | { i, seen:true, species, hp, max, status, fnt, item, ability, boosts, vol, used, mega, pos } ] } } }
```

- Per-mon entries are indexed by sheet position. `species` is the current forme (mega, form change).
- `hp/max` is the replay's percentage for both sides. `item` starts as the sheet item and is cleared
  by `-enditem` (consumed, knocked off) or replaced by `-item` (Trick). `ability` starts as the sheet
  ability, becomes the mega forme's (read from the dex) on mega evolution, and follows `-ability`.
- `boosts` are stat stages; `vol` holds volatiles from `-start`/`-end` (Substitute, confusion,
  Taunt, Encore, `perish` count, `typechange`, `transform`…) with the turn they started or their value.
- `used` is the moves this mon has been seen to use (not the sheet — the sheet is already public).
- `since` is the turn the effect started; turns remaining is the consumer's arithmetic.

## What is excluded, and why (order = `manifest.filters.order`)

`duplicate_id`, `wrong_format`, `no_open_sheet`, `custom_rules` (Showdown's own infobox),
`own_account` (`willhoop`, `medicham32`, and the bot names `MAG`/`MAG2` from `engine/mag_bot.js`),
`named_bot` (the ingest's name regex, via `extract()`), `behavioural_bot` (`data/quality-filter.json`:
≥ 50 games with one team, computed over this stream), `illegal_entity` (a sheet species / item /
ability / move outside `Dex.forFormat` — learnsets are NOT checked), `pre_ejectbutton_fix` (the frozen
pool's conjunction rule), `illusion_on_sheet` (the log shows the disguise, so switches and state
would be wrong — Illusion is the project's declared exclusion), `no_result`, `no_action`,
`parse_error` (a contradiction the parser refuses to paper over; code + detail in the row).

## Known limits

- Spreads (Stat Points) are not in the log and not in the sheet.
- HP is a percentage for both sides, including the player's own.
- Short or forfeited games are **kept** (a forfeit after an action is a decided game —
  `data/quality-filter.json` rule 1.2.0); filter on `turns_played` or `end` if you need to.
- Unrated (challenge) bo3 games with no custom rules are kept and flagged by `rated:false`.
