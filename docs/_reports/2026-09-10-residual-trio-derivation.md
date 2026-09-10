# 2026-09-10 — The residual trio: one mechanism, derived, and two red probes

**Historical findings record. Never maintained, never cited as current state; superseded by the register
rows it feeds.** ENGINE, read-only on the simulator (another ENGINE agent was restructuring the step loop).
Repo writes: `tests/probe_residual_trio_lower_order_handler.js`, `tests/probe_residual_trio_handlerless_body.js`,
this file. No engine file, no artifact, no release, no census, no `status.js`.

## Verdict

**All three rows are ONE mechanism, and it is an ENGINE defect under the differential's pin.** The record's
"70/70, 60/60, 65/75 — two ties and one that is NOT" read **base** Speeds. `buildPair` assigns the SP spread by
**slot index** (slot 0 → +32 Speed, slot 1 → +22, slot 2 → +11, slot 3 → 0), so Umbreon (65, slot 0) and
Scovillain (75, slot 1) are both built at **117**. Every one of the three is an exact tie in built Speed —
**90/90, 117/117, 80/80** — read off the authority's own `storedStats.spe` and off medicham's `freshBodies`.

Under the pin **no die is drawn for a tie on either side** (`engine/game_differential.js:1859` `o.tie = () => 0`;
Showdown's `shuffle` is the identity, asserted by the pin claims), so a tied pair's order is whatever each engine's
**selection sort** leaves. The authority sorts one flat list of **handlers** (`sim/battle.ts:492-507`, `speedSort`
`:429-458`); `residualOrder` (`engine/medicham2-browser.js`, ~`:9518` on tonight's tree) sorts **bodies** — every
active body, handler or not, fainted or not — group by group. The two lists have different **swap histories**,
and the swap `[list[sorted+i], list[index]] = [list[index], list[sorted+i]]` is what decides a tied pair's order:

| game | what swaps the pair | authority | medicham |
|---|---|---|---|
| 1 brn<>brn | placing the order-5 **Leftovers** group moves p1b's brn handler from index 1 to index 4, past p2b's | brn p2b, p1b | brn p1b, p2b |
| 2 psn<>psn | **Overqwil (127, Life Orb — no residual handler)** is not in the authority's list at all; in medicham's body list it is selected first and its swap carries Scovillain ahead of Umbreon | psn Umbreon, Scovillain | psn Scovillain, Umbreon |
| 3 leftovers<>leftovers | **Vivillon (144) and Medicham (134/156), no handlers** — same as game 2 | heal Primarina, Clefable | heal Clefable, Primarina |

The engine's own header above `residualOrder` states the limitation in as many words ("a tied pair's final order
depends on the swaps made while the OTHER handlers were placed ... this engine ... does not know which handlers a
body actually has"); the `residualShadow*` rebuild that would fix it is only built when **both sides carry the same
side/field clock** (`residualShadowNeeded`), never for body handlers.

**Two probes, both RED on release `7d66b526659e`, each with control cells that are GREEN**, one per swap variant.

## 1. The three games

Identification: `data/game-differential.json` (generated 2026-09-09T23:50:36Z, release `7d66b526659e`,
`--arm middle`, 961 games, `first_divergences` rows 1/2/3 of the `ordering` class). Sheets from the pinned pool
cache `data/diff-team-pool.json` (built from `data/team-pool-frozen`). Built Speeds from
`G.freshBodies(G.buildPair(sheet))` (medicham) and from the authority's `storedStats.spe` as recorded by a
`speedSort` hook over 8,186 / 654 / 663 residual sorts in three hooked config runs (same species, same slot, same
item/ability rows: `sinistcha raw90 leftovers hospitality`, `umbreon raw117 leftovers innerfocus`,
`scovillain raw117 scovillainite moody`, `primarina raw80 leftovers liquidvoice`, `clefable raw80 leftovers unaware`).

### Game 1 — `omit-protect`, `2660452545 vs 2660715942`, turn 7 — `|-damage|p2b|brn <> |-damage|p1b|brn`

| slot | body | slot idx / SP | built Speed (medicham) | authority `storedStats.spe` | status | item (residual handler?) |
|---|---|---|---|---|---|---|
| p1a | Palafin (fainted this turn) | 2 / +11 | 131 | 131 | — | Life Orb (no) |
| p1b | Sinistcha | 3 / 0 | **90** | **90** | brn | Leftovers (order 5, sub 4) |
| p2a | Gholdengo | 2 / +11 | 115 | 115 | brn | Life Orb (no) |
| p2b | Sinistcha | 3 / 0 | **90** | **90** | brn | Leftovers |

No boosts, no paralysis, no Scarf, no Tailwind, no Trick Room in the card; both Sinistcha Serious, same sheet set.

Authority list in collection order (`fieldEvent`: side p1 then p2; per body status → volatiles → ability → item):
`[p1b:brn(10), p1b:leftovers(5), p2a:brn(10), p2b:brn(10), p2b:leftovers(5)]`.
`speedSort`: group order 5 = {idx1, idx4} → swap 0↔1, swap 1↔4 →
`[p1b:lefto, p2b:lefto, p2a:brn, p2b:brn, p1b:brn]`; order 10: Gholdengo (115) alone, then {p2b, p1b} tied, identity.
**Predicted: Leftovers p1b, p2b; brn Gholdengo, p2b, p1b — the authority's stream line for line.**

Medicham body list `[Palafin 131, Sinistcha 90, Gholdengo 115, Sinistcha 90]` → `[Palafin, Gholdengo, p1b, p2b]`
(the fainted body is sorted, then skipped in the walk). Group-major: Leftovers p1b, p2b; brn Gholdengo, **p1b, p2b**.
**Predicted = medicham's stream.**

Die: none drawn on either side (see Verdict). Hypothesis H1: *lower-order handler placement swap*.
Refuting line would have been: the authority emitting brn p1b first with Leftovers on both — it does not.
**Probe `probe_residual_trio_lower_order_handler.js` — RED 2 of 4** (Absol×2 at 127/127, Torkoal partners at 62,
list verified clean): `none` and `lefto-on-p1a` agree (p1a first, both); `lefto-on-p2a` and `lefto-on-both` disagree
(authority p2a first, medicham p1a first). The authority's answer moves with the knob, so the knob is wired.
**Verdict: ENGINE.**

### Game 2 — `omit-spread`, `2636020596 vs 2636020596`, turn 4 — `|-damage|p1a|psn <> |-damage|p1b|psn`

| slot | body | slot idx / SP | built Speed | authority | status | residual handlers |
|---|---|---|---|---|---|---|
| p1a | Umbreon (base 65, Bold) | 0 / +32 | **117** | **117** | psn | psn(9), Taunt clock (15, started this turn), Leftovers(5) |
| p1b | Scovillain (base 75, Bold; Moody; mega-stone) | 1 / +22 | **117** | **117** | psn | psn(9), Taunt clock (15, ends this residual — `|-end|p1b|Taunt` follows) |
| p2a | Dragalge (base 44) | 3 / 0 | 64 | 64 | — | none |
| p2b | Overqwil (base 85, Life Orb) | 1 / +22 | **127** | 127 | — | **none** |

`scovillainmega` has base Speed 75 (derived: `Dex.forFormat(...).species.get('scovillainmega').baseStats.spe`), so
the mega does not move it. Struggle is explained by the sheet: all four of Scovillain's moves are status moves and it
was Taunted. Moody: the protocol agreed for 61 lines through this residual, so no Moody stage differed between the
engines before it.

Authority list: `[p1a:psn, p1a:taunt, p1a:leftovers, p1b:psn, p1b:taunt]` → order 5: swap 0↔2 →
`[lefto, p1a:taunt, p1a:psn, p1b:psn, p1b:taunt]`; order 9: {idx2, idx3} tied at 117 → swap 1↔2, swap 2↔3 →
`[lefto, p1a:psn, p1b:psn, p1a:taunt, p1b:taunt]`. **Predicted: psn Umbreon, Scovillain, then Scovillain's Taunt ends —
the authority's stream.**

Medicham body list `[Umbreon 117, Scovillain 117, Dragalge 64, Overqwil 127]`: sorted 0 → {0,1} tied, then idx 3 is
faster → next=[3] → **swap 0↔3** → `[Overqwil, Scovillain, Dragalge, Umbreon]`; sorted 1: Scovillain, then Umbreon ties
it → identity → **Scovillain, Umbreon**. **Predicted = medicham's stream.**

Hypothesis H2: *a faster handler-less body's swap*. Refuting line would have been Umbreon ≠ Scovillain in built Speed
(then medicham's order would follow Speed and the authority's the same Speed) — refuted by the 117/117 receipt.
**Probe `probe_residual_trio_handlerless_body.js` — RED 2 of 4** (Bastiodon×2 at 82/82 hitting each other with Facade
under the top arm; partners Torkoal 62 / Dragapult 184; list verified `[leftovers, leftovers]` in every cell):
`slow/slow` and `fast/slow` agree; `slow/fast` and `fast/fast` disagree (medicham p2a first). Medicham's answer moves
with a knob that is invisible to the authority's list. **Verdict: ENGINE.**

### Game 3 — `pair-protect-bust`, `2659228530 vs 2659321485`, turn 7 — `|-heal|p1b|leftovers <> |-heal|p2a|leftovers`

| slot | body | slot idx / SP | built Speed | authority | residual handlers |
|---|---|---|---|---|---|
| p1a | Vivillon-Ocean (Timid, Focus Sash) | 1 / +22 | 144 | 144 | none |
| p1b | Primarina (Modest) | 3 / 0 | **80** | **80** | Leftovers |
| p2a | Clefable (Calm) | 3 / 0 | **80** | **80** | Leftovers |
| p2b | Medicham (Jolly, mega-stone) | 1 / +22 | 134 (156 mega) | 134/156 | none |

Authority list `[p1b:leftovers, p2a:leftovers]`, tied, identity → **Primarina first.** Medicham body list
`[Vivillon 144, Primarina 80, Clefable 80, Medicham ≥134]` → the fastest is selected first and its swap, then the
next, leave `[.., .., Clefable, Primarina]` → **Clefable first** (derived both for Medicham > Vivillon and the
reverse). Same mechanism as game 2; same probe (`slow/fast`, `fast/fast` cells). **Verdict: ENGINE.**

## 2. What was ruled out, with the line that rules it out

- **A die drawn at different addresses.** No tie die exists in this instrument: `game_differential.js:1859`
  (`o.tie = () => 0` for the middle arm; `tie: scalar` for the corner arms) and the pin claim "Showdown's speed-tie
  shuffle is the IDENTITY". `speed_ties.shuffle_calls 35892 = tied_groups_resolved` counts identity shuffles.
- **A wrong Speed read** (Scarf, paralysis, Tailwind, Unburden, Slow Start, weather ability, stage, item loss): none
  present in any of the three cards; `battle.ts:2811` refreshes `pokemon.speed` immediately before
  `fieldEvent('Residual')`, and the hooked records show `speedCached === getStat('spe')` outside Trick Room.
- **Trick Room:** no TR user was on the field in any of the three (game 2's Slowking-Galar and game 3's Farigiraf were
  benched/not brought). Aside, read not guessed: Champions negates `pokemon.speed` under TR
  (`data/mods/champions/scripts.ts:46-51`, `speed = -speed`; mainline uses `10000 - speed`) — 92 of 32,462 recorded
  bodies tonight, all with `trickRoom: true`. Not the trio's cause.
- **Moody** (game 2): stat picks would have parted the protocol at the boost lines before turn 4; they did not.
- **Sub-order** (`brn`/`psn` sub 2, Leftovers sub 4): both members of each tied pair carry the same effect, so
  subOrder never separates them; the instrument compares whole lines, not a key that ignores sub-order.
- **`residualOrder` re-asked per group:** irrelevant here — speeds did not move during any of the three residuals.

## 3. Instrument observations (not the cause; each costs a session if unrecorded)

1. **`--dump-out` with an absolute path writes nothing and exits 1.** `engine/game_differential.js:49`
   `D = (...p) => path.join(__dirname, '..', ...p)` is applied to `DUMP_OUT` at the `writeFileSync`, so an absolute
   Windows path becomes `ABRA\C:\Users\...` (ENOENT, exit 1). A `dump-omit-protect.json` from the previous agent's
   21:05 run sat in the shared scratchpad and read as my output for two steps. Edit (not applied): use
   `path.isAbsolute(DUMP_OUT) ? DUMP_OUT : D(DUMP_OUT)`. A relative path that climbs out of the repo works today.
2. **`--dump-games` cards carry no Speeds**, so a speed-order divergence cannot be read from the dump alone; a
   `speedSort` hook (`tests/probe_residual_trio_*.js`, scratch `rt_preload.js`) is what produced the tables above.
3. **Pool pairing moved under identical flags.** `--config X --games N --team-store data/team-pool-frozen --release
   7d66b526659e` gave three different pairings tonight (21:05 previous agent, 21:50, 22:05). `diff_swarm.buildSwarm`
   picks every `step`-th team of those each config's predicate accepts, predicates read live `data/tags.json`
   (regenerated 20:53:59), and `data/diff-team-pool.json` was rewritten 21:04:29. Not diagnosed; the artifact's exact
   games could not be replayed from the live tree, and the derivation above did not need them (Speeds are
   slot-determined, handler lists are sheet-determined).
4. **`|split|` lines:** `lastSdLog()` is the raw log with private+public copies; a probe that counts `-damage` lines
   must drop one (the instrument does at `game_differential.js:2440-2445`).

## 4. Corrections owed to prose (not applied — engine file)

- Header above `residualOrder` (`medicham2-browser.js`): *"a fresh key per call would let one tied pair come out one way
  at order 5 and the other way at order 9 — an order the authority cannot produce."* **False.** Game 1 IS that order
  under the pin (Leftovers p1b→p2b, brn p2b→p1b), and under real dice `speedSort` calls `prng.shuffle` **per tied
  group**, so it produces it there too. The per-phase key is a fine design; the justification is wrong.
- Batch S §7 / session-close §4: "65 vs 75 ... not one mechanism" — retracted by the 117/117 receipt.

## 5. Proposed ROADMAP row

> **Residual tie order follows the body list, not the handler list.** `residualOrder` sorts every active body
> (fainted included); the authority sorts residual HANDLERS only. Under the pinned identity tie the two selection sorts
> have different swap histories whenever (a) a tied body also carries a lower-order handler (Leftovers before brn), or
> (b) a faster body with no residual handler shares the field. Three pool rows (`brn<>brn`, `psn<>psn`,
> `leftovers<>leftovers`, release `7d66b526659e`) are all this; narration on every measured game, board-material only in
> a mutual residual KO. Probes: `tests/probe_residual_trio_lower_order_handler.js` (RED 2/4),
> `tests/probe_residual_trio_handlerless_body.js` (RED 2/4), both `--release <id>`. Fix shape: extend the residual
> shadow (`residualShadowBuild/Sort`) to body handlers so the walk is over the authority's list, or sort the bodies that
> hold a handler in the group being walked; `residualShadowNeeded` today only fires for matching side/field clocks.
> Lab moves; the pool will show three rows close and nothing else (0 board-material either way).

## OWED, NOT RUN

- The fix, and `MEDSEEN`/probe green with the mechanism restored by a knob — engine edit, not mine tonight.
- `docs/ENGINE.md` hand list, `docs/RUNNING-NOTES.md` row, `CHANGELOG.md`, `node engine/status.js --write` — forbidden
  by the brief; the two probes are on disk and uncommitted.
- Register the two probes in whatever runs `tests/probe_*.js`, or in `tests/test-mechanics.js` as census rows.
- The mutual-residual-KO corner (the only place this parts a board) — unmeasured, as before.
- Instrument items 1 and 3 above as ROADMAP rows (`--dump-out` absolute path; pool pairing drift).
- A re-run of the differential after the fix to show the three rows close (expect 9 → 6 narration on 961; pool
  board-material unchanged).
