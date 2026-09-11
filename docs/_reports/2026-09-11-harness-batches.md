# Harness coverage batches: mega stones, mega-only abilities, the board-only arm, Ditto, Struggle (2026-09-11)

ENGINE. Harness work only. `engine/medicham2-browser.js` was not edited. Every edit is in
`engine/all_mechanics_fire.js`.

## Verdict

- **Boards compared: 739 → 832 of 964.** Moves 496 → 497, abilities 170 → 187, items 73 → 148.
- **No newly compared board parted.** The run has 0 new STATE rows. The three STATE rows (`axekick`,
  `clearsmog`, `healbell`) were already there at HEAD.
- **One new protocol divergence, board-clean:** `abilities:parentalbond`, class `ordering`. It is an
  engine defect found, not fixed. The mechanics clause carries it below the reach shelf.
- **Gate OPEN, 9 of 9.** `engine/coverage.js` reads 740 of 845 fired-and-compared.
- **Census 856 live / 856 probed, unchanged.** Expected: no mechanic landed in the engine.
- **Release `2b5a6585d8cf`.** It was cut once on the current tree; the tree was identical, so the cut
  was appended to `cuts.jsonl`.
- **The six never-fired batches were NOT started.** Their three code-read hypotheses were confirmed
  off the authority's own log (§6).

## Pins and artifacts

| what | value |
|---|---|
| release | `2b5a6585d8cf` (`--release`), cut re-appended 2026-09-11T07:24:07Z |
| census pin | `--census data/mechanics-census.json` |
| artifact | `data/all-mechanics-fire.json`, generated 2026-09-11T07:55:10.750Z, 1,762,597 bytes, 1,522 games, 0 threw, `red_ok: true` |
| baseline | `git show HEAD:data/all-mechanics-fire.json`, generated 2026-09-11T06:19:39.627Z, 1,313 games |
| census | `data/mechanics-census.json`, generated 2026-09-11T07:56:29.544Z, live 856, missing 0 |
| arm | `bottom-tie-first` (unchanged) |

Per-batch smoke artifacts are in the session scratchpad and are not evidence of the final numbers. The
final numbers come from the one `--write` run above.

## Per batch: prediction against outcome

Predictions were written before each batch's first run, to
`data/verification/_prediction-2026-09-11-harness-{hb4-stones,hb1-board-only,hb2-mega-abilities,hb3-ditto,hb5-struggle}.json`.

| batch | boards compared | fired / proven | predicted | parted |
|---|---|---|---|---|
| HB-4 mega stones (75) | items 73 → 148 | items fired 64 → 139; 75/75 `\|-mega\|` in both engines; 0 refused; stat line read at 254 boundaries, 0 unreadable, 0 parted | 148 / 139 / 0 refused / 0 parts — **exact** | none |
| HB-1 single-ability carriers (14) | +9 | 9 proven `FIRED-UNCONTROLLED` | +5..+8. **Beat the range** because the tag-keyed trigger (Levitate, Good as Gold) was added after the prediction was written | none |
| HB-2 mega-only abilities (14) | +6 | 6 proven: eelevate, electricsurge, fairyaura, innardsout, parentalbond, spicyspray | +3..+8, within range | none on the board; **parentalbond parted on protocol (not predicted)** |
| HB-3 Ditto (2) | +2 | imposter FIRED (+1); limber DID-NOT-FIRE on Hawlucha | +2 / +1, fallback set `ditto` only, pick moved `limber` only — **exact** | none |
| HB-5 Struggle, Battle Bond | moves 496 → 497 | resolved 495 → 496; the authority logged `\|move\|p1a: Abomasnow\|Struggle\|p2a: Feraligatr` after Mega Kick ×8 (max PP read off the authority); PP compared on 44 of 44 slots | resolved, NO-DIVERGENCE — **exact** | none |

HB-1 proven: disguise, forecast, goodasgold, hungerswitch, levitate, mummy, stancechange, wanderingspirit,
zerotohero. Unproven, so they carry `board_unproven` and add nothing to the count: furcoat, illusion
(closeted), megalauncher, mimicry, surgesurfer. HB-2 unproven: aerilate, dragonize, filter, firemane,
megasol, piercingdrill, shadowtag, unseenfist. Every one of these boards is NO-DIVERGENCE.

## 1. Engine defect found (not fixed, per the brief)

**Parental Bond: the ordering of a secondary against the second hit.** It surfaced on Kangaskhan
holding Kangaskhanite, which mega-evolves on turn 1 and clicks Body Slam into Feraligatr under
`bottom-tie-first`, where every secondary fires.

- The authority's first diverging line is `|-status|p2a: Feraligatr|par`, after hit 1.
- medicham2 writes `|-crit|p2a: Feraligatr` there, meaning hit 2 before the status.
- Boards agree at every boundary (ANNOUNCEMENT-ONLY).

This is the per-hit step-list wrap that `tests/test-resolution-order.js` already carries as a
KNOWN-OPEN arm (ROADMAP #500), reached here through a mega carrier. The quarantine mechanics clause puts
it below the reach shelf, so it does not close the gate.

## 2. Instrument defects found and fixed in this pass (each measured, none assumed)

1. **The ×6 HP pool cannot stage a permanent forme change.** The first stone smoke read 5 of 5 STATE at
   turn 1, with medicham2 at exactly six times the authority's max HP (Abomasnow 990 vs 165). The driver
   writes `HP_BOOST` into both engines at build time. The authority's forme change recomputes the line
   from the set (`setSpecies`, sim/pokemon.ts:1393-1404) and drops the boost. Disguise and Zero to Hero
   did the same (780/130, 1050/175). Forecast, a non-permanent change, did not. Stone rows, mega carriers
   and every forme-tagged ability (`^forme…|switchInForme`; printed before wiring, 7 abilities) now play
   the ×1 pool. All three went board-clean.
2. **Ability receipts missed the `[of]` slot.** Electric Surge writes `[of] p1a: Raichu`. Fixed.
3. **Wandering Spirit names itself as a bare field on an `-activate` line.** Now matched as a whole
   field on `-activate` only.
4. **Fairy Aura was blocked by the preflight** (`ability-on-species`) because the fixture described the
   carrier as its base forme. A mega carrier is now described as the mega forme.
5. **Struggle: the pads ran Protect dry** over ten turns ("Venusaur's Protect is disabled"). Pads now
   cycle their three moves. Declaring the move to the preflight also tripped `move-on-species` (nothing
   learns Struggle), so it is no longer declared.
6. **`--dumplog` never reached the A/B ladder.** The never-fired plan's three confirmation commands
   printed nothing. It now dumps both arms per rung.
7. **The first stone full run ended 44 of 75 ON games as `THREW` at turn 3, after a turn-2 KO, with no
   error on the row.** Stone rows and board-only rows now carry `game_error`. The cause is a harness gap,
   **not fixed**. A KO on the ×1 pool refills the slot with a pad, the pad cannot answer the receiver's
   scripted click, the driver passes, and the authority rejects the pass. Every board before the KO was
   compared, and the mega happened and was compared alive at boundary 1 in all 44. There are 16 more
   such games among the board-only rows (OWED §2).

## 3. Red demonstrations, all CAUGHT on the final run (`red_ok: true`)

- **7a, stone control.** Absolite on Absol evolves in both engines, and the board and stat line are
  clean: NO-DIVERGENCE.
- **7b, species plant.** medicham2's evolved body is renamed to its base forme at boundary 1: STATE on
  `species`.
- **7c, stat-line plant.** medicham2's evolved Attack +1 at boundary 1: STATE on `stats.atk`. Only the
  new leaf can see this; `board_state.js` does not compare Attack.
- **7d, foreign stone.** Abomasite on Absol: the authority refuses the ask (counted by
  `scriptMegaRefused`, no `|-mega|`), and the row reads DID-NOT-FIRE.
- **8, board-only game.** Surge Surfer on Raichu-Alola: the control is board-clean, and a silent Destiny
  Bond at boundary 1 gives STATE on `vol.destinybond`.
- **9, Struggle.** The control struggles board-clean, and 7 silent HP off the struggler after its first
  Struggle gives STATE on `hp`.

Switch-driven reds, each run on a scratch output:

- **`--break-mega` over five stones:** 0 FIRED, 0 `|-mega|` in either engine, every row lost its board,
  exit 1.
- **`--break-mega` over the 14 HB-2 rows:** 0 proven, every row "never evolved", exit 1.
- **`--break-triggers` over the 14 HB-1 rows:** the same 9 stayed proven. The plan's claim that all would
  drop does not hold, because they fire off the bare gauntlet. On Levitate and Good as Gold (after the
  tag-keyed trigger was gated on the switch): 0 of 2 proven. So the trigger is load-bearing for exactly
  those two.

## 4. What was derived, printed before wiring

- Stones: 75 legal, 0 dropped. One two-base stone, `meowsticite`: `meowstic` is staged,
  `meowsticf → meowsticfmega` is not. Mega formes with more than one ability: 0.
- Mega-only abilities: exactly the 14 in the plan.
- Build-aware carrier pick: moved `limber: ditto -> hawlucha` and nothing else.
- Own-pool fallback: `ditto` alone.
- Tag-keyed triggers (board-only rows only):
  - `typeImmunity=Ground`: levitate and eelevate, via `bulldoze`;
  - `refusesStatusMoves`: goodasgold, via `block`.
- `hitsTwice` membership: `parentalbond` alone.
- Battle Bond was relabelled unreachable with the validator's words: "Greninja (Greninja-Bond) does not
  exist in Gen 9."

## 5. Accounting, and who owns it

- `engine/coverage.js` (MEASURE, AC-1, already landed) reads **740 of 845** fired-and-compared.
  - moves 496/497, abilities 105/200, items 139/148;
  - it counts the 15 `FIRED-UNCONTROLLED` rows as "a board on a mechanic that did not fire". That is
    MEASURE's call, and the artifact carries them as `summary.abilities.board_only_proven`.
- `summary.abilities.unreachable` 129 → 116: minus the 14 mega-only abilities, plus Battle Bond.
- `summary.items.out_of_scope` 75 → 0.

## 6. The never-fired plan: hypotheses confirmed, batches not started

Read off the authority's log with the new A/B `--dumplog`:
- **Finding 7 (Slush Rush).** The receiver clicks Agility on turns 1 and 2 (`-boost|spe|2` twice), so a
  doubling cannot cross. CONFIRMED.
- **Finding 6 (Magma Armor).** The receiver clicks Low Kick on both beat turns, so the Ice Beam is never
  thrown. CONFIRMED.
- **Finding 5 (Light Clay).** The holder clicks Facade throughout and no screen is ever raised.
  CONFIRMED.

## Register row text (for the router — ENGINE does not touch docs/ROADMAP.md)

1. **Parental Bond: secondary against the second hit, ordering, board-clean.**
   - Found by `engine/all_mechanics_fire.js` board-only arm, `abilities:parentalbond`, release
     `2b5a6585d8cf`.
   - Showdown `|-status|p2a: Feraligatr|par` against medicham2 `|-crit|p2a: Feraligatr`, Kangaskhanite,
     Body Slam, `bottom-tie-first`.
   - Same family as ROADMAP #500 (per-hit step-list wrap). Narration gate, not board.
2. **Harness: a KO on the ×1 pool ends the game `THREW`.**
   - The refilled pad cannot answer the receiver's scripted click, and the pass is rejected.
   - 44 of 75 stone ON games and 16 board-only games. Boards before the KO are compared.
   - Blocks any rung that needs turns after a KO (Innards Out needed the 3-beat rung).
3. **Harness: 13 board-only rows unproven** (listed above).
   - Five need a fixture adversary: surgesurfer and mimicry need terrain; piercingdrill and unseenfist
     need a receiver Protect.
   - Seven are silent in the authority's log: aerilate, dragonize, filter, firemane, megasol, shadowtag,
     megalauncher.
   - furcoat needs a physical hit it can be shown to reduce.

## OWED, NOT RUN

1. The six never-fired batches, in the plan's usage order: 6 live ally, 5 own click, 2 adversary,
   1 ability board-state rung, 4 setter, 3 top-corner arm. See
   `docs/_reports/2026-09-11-plan-never-fired.md` for the fixtures. Each begins by re-enumerating from
   the artifact written today:

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
node -e "const j=require('./data/all-mechanics-fire.json');for(const r of [...j.rows.abilities,...j.rows.items].filter(r=>r.verdict==='DID-NOT-FIRE'))console.log(r.kind,r.id,r.carrier,r.cannot_fire_clause||'-')"
```

2. The KO-refill `THREW` gap, measured per row. Count the rows first:

```bash
node -e "const j=require('./data/all-mechanics-fire.json');const s=j.summary;console.log((s.items.stones.game_errors||[]).length,(s.abilities.board_only.game_errors||[]).length)"
```

3. Meowstic-F (`meowsticite`'s second base) is not staged. It needs a second row or sub-arm in `runStone`.

4. Re-run the plan's group-(d) check against the landed tree:

```bash
node tests/probe_uncompared_leaves.js | head -12
```

5. Reproduce the final artifact (identical tree → identical release):

```bash
cmd.exe /c "tools\lownode.cmd engine\all_mechanics_fire.js --kind all --release 2b5a6585d8cf --census data/mechanics-census.json --write"
cmd.exe /c "tools\lownode.cmd engine\quarantine.js"
node engine/coverage.js
```
