# 2026-09-25: Why sides do not mega (Reg M-C bo3 human dataset)

SOLVER. Read-only, store-only (no simulator, so the MEDICHAM gate does not apply). Source:
`solver/out/human/games.jsonl` (main checkout, written 2026-09-23 04:03, 26,888 games, 53,776 sides).
Stone to species comes from `Dex.forFormat('gen9championsvgc2026regmcbo3')` through `solver/human/dex.js`
(SHOWDOWN_PATH = `pokemon-showdown-mc`). A stone holder is a sheet row whose item's `megaStone` maps the
row's species to a forme that is legal in the regulation. The definitions are the ones in
`2026-09-25-mega-rate.md`: a side is **capable** when a live stone holder is active at the start of a
turn before the side has megaed, and the mega is `actions[P][slot].mega`.
Scripts: `run2.js` in the session scratchpad (`.../scratchpad/meganon/`), one pass over the file, run
through `tools\lownode.cmd`.

**Cross-check against the mega-rate report:** capable = 48,430 and megaed = 45,952. Both match exactly.

## The exclusive buckets (sum = 53,776)

| # | bucket | sides | % of sides |
|---|---|---|---|
| 1 | no stone holder on the sheet | 96 | 0.18% |
| 2 | holder on the sheet, NOT brought (all four brought mons seen, holder not among them) | 2,334 | 4.34% |
| 2/3 | holder not seen, and fewer than four brought mons were seen: either not brought, or brought and never on the field (2 seen: 824, 3 seen: 1,558) | 2,382 | 4.43% |
| 4 | brought, came in mid-turn, fainted before any turn start | 388 | 0.72% |
| 4x | brought, came in on the last turn, and the game ended before another turn started (not seen fainting) | 146 | 0.27% |
| 6 | capable, never megaed | 2,478 | 4.61% |
| 7 | **megaed** | **45,952** | **85.45%** |

Megas with no capable turn: 0. Stone held by the wrong species: 0 sides.

### Bucket 3 cannot be separated from bucket 2
Showdown does not publish the bring. An unseen holder on a side that showed all four brought mons was
certainly left at preview (bucket 2). When only two or three brought mons appeared (usually a forfeit),
an unseen holder may have been left at preview OR brought and never sent in. **So 2,382 is an upper bound
on bucket 3, not a count of it.** The log holds no information that would split it.

### Bucket 4: how the holder came in
| entry | fainted before a turn start (4) | last turn, game ended (4x) |
|---|---|---|
| chosen switch action (in at the start of the turn, KO'd that turn) | 365 | 130 |
| pivot move (U-turn, Parting Shot, etc.) | 22 | 14 |
| Eject Button / Eject Pack / Emergency Exit | 1 | 1 |
| dragged in | 0 | 1 |
| faint replacement | 0 | 0 |

A faint replacement is always active at the next turn start, so it can be in 4 or 4x only when the game
ended first. It was 0 in both. By outcome, 4x splits into: forfeit 117, inactivity 3, side won 17, side
lost normally 0. Fourteen of the 4x sides came in before the final turn and were still not active at a
later turn start and not seen fainting (in and out in the same turn, then the game ended). They are left
in 4x rather than guessed.

### Bucket 6: capable, never megaed (2,478)
| how the game ended | sides | % of all sides | % of capable (48,430) |
|---|---|---|---|
| forfeit, 3+ turns | 1,328 | 2.47% | 2.74% |
| forfeit, under 3 turns | 275 | 0.51% | 0.57% |
| inactivity, 3+ turns | 77 | 0.14% | 0.16% |
| inactivity, under 3 turns | 20 | 0.04% | 0.04% |
| normal end (all 3+ turns; no normal game is under 3 turns) | 778 | 1.45% | 1.61% |
| total | 2,478 | 4.61% | 5.12% |

The splits are exclusive. The end reason comes first and turn count second. The under-3-turn total is 295.

## Two or more stone holders (overlay, not exclusive)
Only one mega is allowed per battle.

| | sides | of which megaed | rate |
|---|---|---|---|
| two or more holders on the SHEET | 41,125 (76.5% of sides) | 36,570 | 0.889 |
| two or more holders BROUGHT (seen on the field) | 3,980 (7.4%) | 3,830 | 0.962 |
|   of which 2 / 3 / 4 holders seen | 3,959 / 18 / 3 | | |
|   of which two or more holders were active at a turn start before the mega | 2,149 | | |

Per side the mega is counted once (at most one per battle), so "megaed" here means the side megaed one of
them. 76.5% of sheets carry two or more stones, yet only 7.4% of sides show two holders on the field. The
common pattern is two stones on the sheet with one brought.

## Reading it
- Of the 7,824 sides that never megaed, 4,716 (60%) never had a holder on the field: 2,334 certainly left
  it at preview, and 2,382 more are either that or a benched holder in a short game.
- Of the capable sides that did not mega, 1,700 of 2,478 (69%) are forfeits or inactivity. The rest, 778
  sides (1.45% of all sides), are a normal full-length game with a capable holder and no mega. That is the
  only bucket that is plausibly a choice not to mega.
- Switched in and KO'd before it could act: 388 sides (0.72%). Almost all of them were chosen switch-ins.
