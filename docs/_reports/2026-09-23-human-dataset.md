# Reg M-C open-sheet human decision dataset — first build

2026-09-23. Solver stack, piece 1 (research: `2026-09-23-solver-research-learning.md` §9 step 1,
`-turn-search.md` §3.4). Historical findings record, not maintained.

## Verdict

**Built and tested.** 26,888 of 28,283 Reg M-C bo3 games kept (95.1%), 185,480 turns, 370,960
side-turn decisions, of which 275,610 (74.3%) are fully observed joint actions. The parser's
decisions reproduce an independent scan of the log exactly on 894 games / 5,803 turns, and the
repo's own `extract()` agrees on leads and brings in 26,888 of 26,888 kept games. Nothing written
under `engine/`, `tests/`, `web/`, `data/`; no git run.

## What was read

- Source: the tracked raw-log shards `data/raw/games.gen9championsvgc2026regmcbo3/*.jsonl.gz`,
  **203 shards, 28,283 rows, 0 duplicate ids**, uploads 2026-09-09 08:08 → 2026-09-23 06:38 UTC.
  Each shard's path, bytes and sha256 are in `solver/out/human/manifest.json`, hashed from the same
  bytes that were parsed (the collector appends hourly; a later shard is simply not in the manifest).
- Why raw shards and not `data/games.gen9championsvgc2026regmcbo3.jsonl`: the plain parsed file is a
  2026-09-21 snapshot, and the task needs per-turn state the parsed schema does not carry. Why not the
  frozen pool: it stops at 2026-09-21 and carries parsed rows, not logs. This dataset applies the
  pool's eject conjunction itself, so the two populations are cut by the same rule.
- Dex: `Dex.forFormat('gen9championsvgc2026regmcbo3')` on `../pokemon-showdown-mc`, HEAD
  `f10d6798f2ba` = the pin in `data/regulations.json`. Every move-target type, mega ability and
  legality verdict is read from it.

## Counts

| | |
|---|---|
| games in (unique) | 28,283 |
| **games kept** | **26,888** (6,328 distinct accounts, 12,683 bo3 series) |
| turns | 185,480 |
| side-turn decisions (≥ 1 occupied slot) | 370,960 |
| … fully observed joint action (every slot a move or switch) | 275,610 (74.3%) |
| … containing a hidden slot | 94,282 |
| slot actions | 709,499 — move 526,263 · hidden 109,369 · switch 72,682 · locked 1,185 |
| mega actions | 45,952 |
| mid-turn switch choices (U-turn, Parting Shot, eject…) | 12,815 (+115 drags, not a choice) |
| end-of-turn faint replacements | 80,688 |
| targeted moves with target not certain | 32,123 of 321,372 (10.0%) |
| rated / unrated | 24,403 / 2,485 |
| end: normal / forfeit / inactivity | 16,043 / 10,485 / 360 |

**Exclusions (1,395), by first reason in `manifest.filters.order`:**

| reason | games | note |
|---|---|---|
| pre_ejectbutton_fix | 335 | the frozen pool's conjunction, reproduced exactly (pool: 335) |
| behavioural_bot | 321 | 5 accounts, ≥ 50 games with one team (`quality-filter.json` rule) |
| no_action | 308 | 226 with zero turns, 82 with one turn and no observed action |
| illusion_on_sheet | 225 | Illusion is the declared exclusion; see failure modes |
| named_bot | 168 | the ingest regex; 159 of them are one account (`naibot2814`) |
| no_result | 36 | no `|win|` / `|tie|` |
| custom_rules | 2 | `natdex mod, !obtainable moves` — the same two games also fail legality |
| own_account | 0 | `willhoop`, `medicham32`, `MAG`, `MAG2` never appear in this stream |
| parse_error | 0 as first reason | 140 as any reason — all 140 are in Illusion games |

## Top failure modes (what the parser had to learn, in order of cost)

1. **Open sheets carry no nicknames** — the log prints `p2a: Neutron Star`, the sheet says
   `Floette-Eternal`. First trial lost 1,959 of 3,000 games to `unmatched_mon`. Fixed: a nickname is
   bound to the sheet entry by the base species on its first switch line, and an un-nicknamed forme
   (`Indeedee-F`) is matched by its base name.
2. **Illusion** — 140 games whose sheet has Zoroark trip `move_not_on_sheet` (97: "Araquanid used
   Snarl" is a disguised Zoroark), `illusion_replace` (33) or `switch_in_active` (10). The log shows
   the disguise, so every switch decision and state row in those games would be wrong. Excluded by
   sheet (225 games), not patched. **There are zero sheet-vs-log contradictions outside Illusion games.**
3. **`|cant|` that is not the named mon failing to act** — `|cant|p2a: Farigiraf|ability: Armor
   Tail|Grassy Glide|[of] p1b: Rillaboom` is Rillaboom's move being blocked. Read naively it gave
   Farigiraf a phantom decision and a `second_decision` error. Now skipped, and it supplies the
   blocked move's target.
4. **Moves printed without `[from]` that are not a decision** — Instruct's repeat (fixed: announced
   by `-singleturn … Instruct`); and the reverse, `[from] move: Round` IS the partner's own choice.
5. **Slots whose choice is simply not in the log** — flinch, sleep, confusion self-hit, fainted
   first, forced out by Emergency Exit or a bounced Parting Shot, game over. 109,369 slot actions are
   `hidden` with the reason; **zero remain unexplained** (`not_seen` = 0).
6. **Target hit ≠ target chosen** — 10.0% of targeted moves are marked `target_certain:false`
   (Follow Me / Rage Powder / Spotlight, Lightning Rod / Storm Drain, retarget after a faint). 6,593
   charge-move targets are recovered from `-anim` / `-prepare` because the `|move|` line prints none.
7. **Revival Blessing / Emergency Exit** — a revived mon re-entering its own slot, and an end-of-turn
   Emergency Exit, both looked like "replacement over a live mon". Both classified now.

## Verification

- `solver/tests/test-human-parse.js` (via `tools\lownode.cmd`): **GREEN, 24,605/24,605 checks.**
  (1) pinned turns on 7 real games read by hand (Parting Shot, Round, charge target from `-anim`,
  flinch, faint replacement, Revival Blessing, Armor Tail, nicknames, two megas, Emergency Exit,
  Instruct); (2) round trip on every turn of two whole shards against a naive independent log scan;
  (3) invariants (legal target locs, switch to a live benched mon, ≤ 1 mega per side).
- **Shown RED on a deliberate break**: hiding one switch decision per game → 756 failures, exit 1.
- Independent cross-check vs `engine/durable-ingest.js extract()`: leads and brings agree on 26,888
  of 26,888 kept games.

## Outputs

`solver/out/human/games.jsonl` (497.7 MB, sha256 `9d07c522200d…`), `exclusions.jsonl`,
`manifest.json`. Schema: `solver/human/README.md`. `solver/.gitignore` excludes `solver/out/` —
**`games.jsonl` is ~5× GitHub's 100 MB per-file wall; it must never be tracked.**

## Owed / not done

- Learnsets are not validated (Dex-level legality only); the 2 illegal games were custom-rules games.
- The bo1 stream's open-sheet subset (the pool's `ots` half, ~1.4k games) is not included — the brief
  named the bo3 store. Adding it is one more source directory and a `|showteam|` filter.
- No state tensors / MEDICHAM relational facts yet — this is the clean decision record they are
  built from (research build-order step 1, first half).
- Nothing is committed; the other session owns git.
