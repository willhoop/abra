# 6.52.0 re-measured on `a1c7dcd5696b` — 2026-09-19, ENGINE (measure only)

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

---

## PREDICTION — written before any run

Written at the start of the pass, before any lattice was launched. The 17 remaining board-material games on
`74be319d02fa` (from `state.first_board_divergences` of the three artifacts at HEAD `07e01c85`, 5 and 12
entries, under the cap of 40, so the whole population), each mapped to its mechanism from
`docs/_reports/2026-09-18-merged-remeasure.md` §2 and the three 6.52.0 fix reports:

| lattice | game (first seed) | config | mechanism | fix in 6.52.0 | predicted |
|---|---|---|---|---|---|
| 1350 | `…2654508003` | baseline | Grav Apple 39 vs 16 on Torkoal | Grav Apple under Gravity | LEAVE |
| 1350 | `…2662560687` | baseline | Life Orb chip on Slowking-Galar at game end | Future Sight payout tolls Life Orb | LEAVE |
| 1350 | `…2636045527` | baseline | Helping Hand at an ally that already moved | Helping Hand fails at a moved ally | LEAVE |
| 1350 | `…2634121958` | omit-weather | Round not promoted (Staraptor) | Round promotion | LEAVE |
| 1350 | `…2656731493` | pair-speedctrl | Trevenant's sleep on one engine only | Healer/Shed Skin die gated | LEAVE |
| 1950 | `…2658892411` | baseline | Darkest Lariat misses a Minimized Sandaconda | Darkest Lariat ignores evasion | LEAVE |
| 1950 | `…2661323469` | baseline | Lum eaten on the winning turn | lock-end confusion waits for Update | LEAVE |
| 1950 | `…2635665638` | baseline | Alluring Voice confuses without the stat-raised condition | boost snapshot cleared on arrival | LEAVE |
| 1950 | `…2655370356` | omit-weather | Poison Touch on the Spicy Spray Scovillain | no die when chances sum to 1 | LEAVE |
| 1950 | `…2657220134` | omit-weather | Sinistcha full paralysis (Life Dew address) | Life Dew addresses a drawn foe | LEAVE |
| 1950 | `…2635092694` | omit-weather | Cursed Body Disable against Triple Axel | **NOT FIXED** | **STAY** |
| 1950 | `…2656668990` | omit-intimidate | Magic Bounce does not reflect Yawn | Magic Bounce's 11 moves | LEAVE |
| 1950 | `…2656419834` | pair-protect-bust | Decorate's boosts skip Contrary | target boosts through the boost road | LEAVE |
| 1950 | `…2657391947` | pair-protect-bust | Trace picks a different foe on Alakazam | **NOT REPRODUCED, not fixed** | **STAY** |
| 1950 | `…2663649758` | pair-protect-bust | PP `thunderbolt 2|1` (Pressure after a redirect) | Pressure off the redirected body | LEAVE |
| 1950 | `…2656570989` | pair-redirect-priority | Heal Pulse ignores Mega Launcher | Heal Pulse from a Mega Launcher user | LEAVE |
| 1950 | `…2634182062` | pair-speedctrl | game-end burn chip on Sinistcha | residual stops at the deciding handler | LEAVE |

**Predicted board-material: 0 / 0 / 2** at `--games` 1200 / 1350 / 1950. **Predicted joins: none.** A join
is the single most important thing this run can show, because 6.52.0 changed die addresses (Healer, Shed
Skin, Spicy Spray, Life Dew) and the residual's stop point, which move every later draw in any game that
touches them.

---

## 0. VERDICT

- **Lattices on `a1c7dcd5696b`: board-material 0 of 961 / 1 of 1069 / 2 of 1497**, from 0 / 5 / 12.
  **No game joined**, board or protocol, on any lattice.
- **Prediction: 14 of the 15 targeted games left. One stayed, and one of the two untargeted games stayed
  for a different reason than expected.**
  - **1350, Helping Hand (`…2636045527`) STAYED. It was never a Helping Hand game.** Its board had always
    parted at turn 15 with the same diff (Scolipede 85 vs 135). The Helping Hand split was its first
    PROTOCOL divergence, at turn 2. The fix removed that line (the protocol split moved 2 → 15), and the
    board split underneath was untouched. §2 of `2026-09-18-merged-remeasure.md` attributed it by the
    first protocol line, which is the capped-list trap CLAUDE.md names. The real turn-15 mechanism:
    Encore turns Scolipede's click into Swords Dance before Kingambit's Sucker Punch. The authority prints
    `|-fail|p2a: Kingambit`. Ours hits for 50.
  - **1950, Trace (`…2657391947`) STAYED, as predicted, but the Trace split is gone.** The board used to
    part at turn 2 (Alakazam's copied ability). It now parts at turn 6: a Future Sight payout lands on a
    Focus Sash Kleavor. The authority prints `|-enditem|p1a: Kleavor|Focus Sash` and leaves it at 1/145.
    Ours faints it. Why the turn-2 Trace split went away is **not measured**. 6.52.0 moved several shared
    die addresses (Healer, Shed Skin, Spicy Spray, Life Dew), and that is one possible reason.
  - **1950, Cursed Body vs Triple Axel (`…2635092694`) STAYED**, as predicted. The first board diff is
    byte-identical (`p2.active[1].vol.disable` 0 vs 3, turn 6).
- **Narration (undeclared): 0 / 11 / 24**, from 0 / 12 / 24. Raw is 0 / 12 / 26, less the declared
  Supreme Overlord `fallenundefined` row (1 and 2 games). One narration game left at 1350: `…2634477578`,
  Helping Hand `|-fail|`. None joined.
- **Roster: items 147 MATCH + 1 DIFFER (Greninjite, the known Protean row), abilities 194 of 200 MATCH,
  moves 494 of 497 MATCH.** 0 DID-NOT-FIRE and 0 COULD-NOT-STAGE in every stage. **New: three red plants
  hit DEAD ANCHORS**, because 6.52.0 rewrote the engine lines they patch. Abilities read 61 of 63 anchors
  live and moves 36 of 37. Items is 22 of 22, all CAUGHT.
- **Gate `CLOSED — 4 of 8`**, up from 2 of 8. It fails on board-material (0 / 1 / 2), roster/items
  (Greninjite), roster/abilities (2 dead anchors) and roster/moves (1 dead anchor). The two new FAILs
  come from the instrument, not from engine divergences. Damage, coverage, mechanics and no-open-defect
  all PASS.

## 1. PINS

| pin | value |
|---|---|
| release | `a1c7dcd5696b`, cut 2026-09-19T05:50:15Z on HEAD `07e01c85`. The 27 `SOURCES` files were byte-compared against the frozen copy before the runs, and 0 had moved |
| census | `data/mechanics-census.json` as committed at HEAD, 915 live / 915 probed / 0 missing, generated 2026-09-19T05:50:05Z, `steering.input_digest` **`1b735ff555ad`** in all three artifacts. **The last run used `322a5b4ba6b0` (900 live), so this is not a strict before/after.** The census is CREDITED ONLY under empirical steering |
| team store | `--team-store data/team-pool-frozen`. Pools `0d103fb9fa87` / `7e7a37ded7fc` / `a5ce76242f8d`, the same as the last run |
| flags | `--steering empirical --arm middle --end-state` cap 50, `--games` 1200 / 1350 / 1950, `--write --out` to the three canonical paths, plus `--dump-games 400 --dump-out data/_a1c7_dump_g<N>.json` (1350 and 1950 wrote 13 and 28 cards and were moved to the session scratchpad; 1200 diverged nowhere and wrote none) |
| mode | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`, `driver_code_stable` true |

## 2. THE THREE LATTICES

| `--games` | games | board-material | narration undeclared (raw) | protocol-diverged | boundaries identical | generated | wall |
|---|---|---|---|---|---|---|---|
| 1200 | 961 | **0** (was 0) | **0** (0) | 0 (was 0) | 10705/10705 | 06:31:32Z | 1284 s |
| 1350 | 1069 | **1** (was 5) | **11** (12) | 13 (was 18) | 11840/11842 | 06:34:11Z | 1439 s |
| 1950 | 1497 | **2** (was 12) | **24** (26) | 28 (was 37) | 16706/16714 | 06:40:11Z | 1797 s |

Board-material is `state.games − state.games_board_never_diverged`. Narration is quarantine's NARRATION
clause (raw is `end_state[0].summary.by_cause_totals.games_narration_only`). The left/joined lists come
from `state.first_board_divergences` (1 and 2 entries, under the cap of 40) and `first_divergences` (13
and 28 entries, under the cap of 60), so both are the whole population. The comparison is against
`git show HEAD:` of the three artifacts (release `74be319d02fa`).

**Predicted against actual:**

| lattice | predicted to leave | left | stayed |
|---|---|---|---|
| 1350 | 5 (Grav Apple, Life Orb payout, Helping Hand, Round, Trevenant sleep) | **4**: Grav Apple `…2654508003`, Life Orb `…2662560687`, Round `…2634121958`, Trevenant `…2656731493` | `…2636045527`. The board split is at turn 15, not the Helping Hand line (§0) |
| 1950 | 10 | **all 10**: Darkest Lariat `…2658892411`, Lum `…2661323469`, Alluring Voice `…2635665638`, Poison Touch/Spicy Spray `…2655370356`, Life Dew paralysis `…2657220134`, Magic Bounce Yawn `…2656668990`, Decorate/Contrary `…2656419834`, Pressure PP `…2663649758`, Heal Pulse `…2656570989`, burn at game end `…2634182062` | Cursed Body `…2635092694` (predicted). Trace game `…2657391947` (predicted), now on Future Sight into Focus Sash at turn 6 |

**Joined: none.** No game is new to either list, board or protocol, on any lattice. Two surviving games
moved their split: `…2636045527` (protocol 2 → 15, board unchanged) and `…2657391947` (protocol 4 → 6,
board 2 → 6). 6.52.0 changed die addresses and the residual's stop point, so joins were the main risk,
and none happened.

## 3. NARRATION BY MECHANISM (undeclared 11 at 1350, 24 at 1950)

Every narration-only card was bucketed by hand from the full `--dump-games` output (13 and 28 cards,
which is the whole population). The board-material seeds were removed and so were the declared
`fallenundefined` cards (1 at 1350, 2 at 1950).

| family | mechanism | 1350 | 1950 | games |
|---|---|---|---|---|
| **refusal lines** | a spread move with every foe fainted (`[notarget]`): ours prints an extra `-fail` for the user | 2 | 1 | `…2656658836` Discharge, `…2657573463` Earthquake, `…2634671092` Earthquake |
| | Synchronize passing a status to an immune body: the authority prints `-immune`, ours prints nothing | 2 | 1 | `…2654088012`, `…2654041758`, `…2634370112` |
| | Coaching with no living ally: the authority prints `-fail` for the user, ours prints nothing | – | 2 | `…2636014030`, `…2635841176` |
| | Chilly Reception: the authority prints `-fail`, and ours marks the Yawn end differently (`[silent]`) | – | 1 | `…2662362231` |
| | Sleep Powder into an already-asleep body under Misty Terrain: the authority's `-fail slp` against ours `-activate Misty Terrain` | – | 1 | `…2661874022` |
| **announcements** | Roost's `-singleturn … move: Roost` is missing on ours | 1 | 3 | `…2658575001`, `…2656606681`, `…2634369113`, `…2662455751` |
| | Forewarn's `-activate` is missing on ours (Forewarn is DEFERRED-BY-OWNER in the roster) | 2 | 1 | `…2659123487`, `…2657893729`, `…2634615536` |
| | Mortal Spin's Toxic Spikes removal is missing `[from] move: Mortal Spin` | – | 1 | `…2659871951` |
| | Magician stealing a Focus Sash: ours prints an extra `-enditem … [silent]` | – | 1 | `…2662767282` |
| **line order** | Perish Song's `perish3` starts in a different slot order | – | 2 | `…2634548064`, `…2635249755` |
| | Life Dew: the heal against the ally's `-immune` / `-fail heal` | – | 2 | `…2634231341`, `…2635082691` |
| | end-of-turn replacement or faint order (double replacement; a perish faint against `upkeep`) | – | 2 | `…2663429418`, `…2634665687` |
| | reactions inside one hit (Recoil against a stat boost; White Herb against Hospitality; lock-end confusion against Leftovers) | – | 3 | `…2656439218`, `…2654135529`, `…2659688578` |
| | residual order (Sandstorm chip order; Salt Cure against Infestation for the last KO) | 1 | 1 | `…2660691219` (baseline), `…2654068794` |
| | two same-species holders eating Sitrus in a different order | 1 | – | `…2635337217` |
| | mega evolution after a priority Helping Hand, where it should come before | 1 | – | `…2660691219` (pair-redirect-priority) |
| | Poison Point on a multi-hit: ours fires after hit 1, the authority fires after the last hit | – | 1 | `…2635518198` |
| **per-hit** | Cursed Body rolls per hit on Triple Axel (the known unfixed rule; board-material in another game) | 1 | – | `…2654469023` |
| | Dragon Darts: ours prints an extra `-miss` at the ally | – | 1 | `…2662428145` |
| | **total** | **11** | **24** | |

Shape: **14 of 35 are line ORDER**, 10 are refusal lines, 9 are missing or extra announcements, and 2 are
per-hit. No bucket is bigger than 4 games (Roost). The order family is the largest, and it covers
several different mechanisms. The two `-fail` families (the `[notarget]` spread move and Coaching) are
mirror images: one extra line on ours, one missing line on ours.

## 4. ROSTER, DAMAGE DIFF, MECHANICS, GATE

All on `a1c7dcd5696b`. Every `generated` stamp moved:

| artifact | before | after | reading |
|---|---|---|---|
| `data/roster.items.json` | 04:42:57Z | 06:15:33Z | 147 MATCH, **1 DIFFER** (Greninjite, known, counted and not diagnosed), 0 DNF, 0 CNS. Anchors 22 of 22 live, reds 22 CAUGHT. Exit 1 (the DIFFER) |
| `data/roster.abilities.json` | 04:46:28Z | 06:21:51Z | 194 MATCH, 6 DEFERRED-BY-OWNER, 0 DIFFER, 0 CNS. **Anchors 61 of 63 live**, 61 CAUGHT. Exit 1 |
| `data/roster.moves.json` | 04:47:46Z | 06:28:15Z | 494 MATCH, 3 DEFERRED-BY-OWNER, 0 DIFFER, 0 CNS. **Anchors 36 of 37 live**, 36 CAUGHT. Exit 1 |
| `data/engine-diff.json` | 04:58:41Z | 06:40:07Z | 0 of 6000 at the midpoint, top, bottom and idx01–idx14 (seed 20260804) |
| `data/all-mechanics-fire.json` | 05:01:43Z | 06:32:50Z | 4702 games, 0 threw. Moves STATE 2 (axekick, clearsmog), unchanged |

**The three dead anchors.** Each one's patch text no longer appears in the release, because 6.52.0
rewrote the line:

| stage | rule | anchor that matched 0 times | the 6.52.0 change that moved it |
|---|---|---|---|
| abilities | `ability/contact-statuses-the-attacker-by-chance` (4 rows) | `const _r=rng();let _cum=0;` | Spicy Spray: no die when the chances sum to 1 |
| abilities | `ability/cures-a-status-at-the-residual-by-chance` (2 rows) | the Healer / Shed Skin die line (`if(_wOK&&(+_cr.chance>=1…`) | Healer / Shed Skin roll only with a statused target |
| moves | `move/boosts-target` (20 rows) | `_t.boosts[_s2]=clamp(_t.boosts[_s2]+_d,-6,6);` | Decorate, Coaching, Aromatic Mist and Howl through the boost road |

The rows those rules produced still read MATCH. The roster calls them **UNPROVEN until re-aimed**, and it
is right to: a MATCH whose red plant cannot be staged is the vacuous-green shape. This is the same
failure as 6.49.1 (a merge moved the code and a plant was left behind), and it gets the same fix: tie
the anchor to a signature, not to a line inside a body. `tests/roster.js` is not in `SOURCES`, so
re-aiming needs no new cut.

`node engine/quarantine.js` (through `tools\lownode.cmd`, exit 0, 124 s): **`GATE: CLOSED — 4 of 8 GATING
clauses fail`**.

| clause | reading |
|---|---|
| game differential (damage) | PASS, 0 of 6000 at every index |
| roster / items | FAIL, 1 DIFFER (Greninjite) |
| roster / abilities | FAIL, 2 red demonstrations did not behave (dead anchors) |
| roster / moves | FAIL, 1 red demonstration did not behave (dead anchor) |
| coverage | PASS, 412 of 412 |
| whole-game BOARD-MATERIAL | FAIL, 0 / 1 / 2 |
| NARRATION (RPRT, does not gate) | 0 / 11 / 24 |
| mechanics | PASS, 2 diverge, 1 declared, 1 below the shelf, 0 left |
| no open defect | PASS |

## 5. FILES CHANGED

- Data, written by the runs: `data/game-differential{,.g1350,.g1950}.json`,
  `data/roster.{items,abilities,moves}{,.prev}.json`, `data/roster.json`, `data/engine-diff.json`,
  `data/all-mechanics-fire.json`, plus whatever `status.js --write` restamps.
- Docs: `CHANGELOG.md` (6.53.0), `docs/RUNNING-NOTES.md` (one row), `docs/ENGINE.md` (one section),
  `docs/ABRA-whitepaper.md` (the roster sentence's release reference moves to `a1c7dcd5696b`; no figure
  changes), and this report.
- Not touched: engine code, `tests/`, the held 7.0.0 documents, and `docs/_reports/2026-09-11-*`. No git
  command. The two dump files I created were moved to the session scratchpad. Every process I started
  ended on its own, and none was killed.

## OWED, NOT RUN

1. **Re-aim the three dead red anchors (ENGINE, `tests/roster.js` only, no cut).** Use a function
   signature on the tag read, as 6.50.1 did. Show each one NOT CAUGHT, then CAUGHT, on a single-rule
   `--reds` run (`--rule ability/contact-statuses-the-attacker-by-chance --stage abilities --reds` and so
   on). This alone clears two of the four gate FAILs.
2. **Sucker Punch into an Encored status click** (`…2636045527`, g1350, turn 15). The authority prints
   `-fail` and ours hits. Probe first. Is the queued action read before or after Encore rewrites it?
3. **Focus Sash against a Future Sight payout** (`…2657391947`, g1950, turn 6). The authority activates
   the Sash and ours faints the holder. Probe first. Also check whether the 6.48.0 `trySpreadMoveHit`
   payout route or the 6.52.0 `payOrbToll` lift skips the item's damage hook. **Not measured.**
4. **Cursed Body per hit and Triple Axel's per-hit accuracy draw**, still unfixed (a `PIN_DIGEST` move).
   It is 1 board-material game at 1950 and 1 narration game at 1350.
5. **Protean on a failed `Try`** (the roster/items DIFFER). It is being fixed elsewhere.
6. **Why the Trace split at turn 2 went away.** Not measured. A warmed `engine/replay_one.js` of
   `…2657391947` on `74be319d02fa` against `a1c7dcd5696b` would answer it.
7. **Narration.** The largest buckets are Roost's `-singleturn` (4), the two `-fail` refusal families (3
   and 2), Synchronize's `-immune` (3), Forewarn (3, owner-deferred) and 14 order cases across several
   mechanisms.
8. **Not claimed:** a census-pinned before/after. It would need `74be319d02fa` re-run under census
   `1b735ff555ad`.
