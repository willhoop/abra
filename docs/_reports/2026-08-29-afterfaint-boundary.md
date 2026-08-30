# THE AFTER-FAINT BOUNDARY — card D3, and it is NOT ROADMAP #362

2026-08-29, ENGINE. Batch of one.

---

## 0. THE VERDICT, IN FIVE LINES

- **D3 and #362 are NOT one cause, and #362 IS ALREADY CLOSED IN THE ENGINE** — WIRE 160 landed the
  last-faint win rule in `battleResult` on 2026-08-23. The ROADMAP row's premise ("`battleResult`
  returns 0.5") is stale. Read the code, not the row.
- **Nine legal bodies across two abilities** can reach this boundary, derived from the format.
- **Census 804 -> 806 live / 806 probed / 0 missing.**
- **Empirical board-parted 88 -> 84 of 961; protocol 204 -> 199; threw 1 -> 1.** The prediction was
  *unmoved at 88* and it **MISSED, by 4, in the improving direction.** Attributed below.
- **DIFFERENT-WINNER reads 0, before and after.**

---

## 1. IS D3 THE SAME SITE AS ROADMAP #362?

**No, and the more useful finding is that #362 is already fixed.**

The brief carried #362 as *"an open winner-deciding defect: on a simultaneous double wipe the
authority awards the last-fainting side and `battleResult` returns 0.5."* That is what the ROADMAP
row says. It is not what `engine/medicham2-browser.js` says:

```js
  /* WIRE 160 -- BOTH SIDES EMPTY IS NOT A TIE. sim/battle.ts:2603 awards it to the side of the body
     that fainted LAST, which is why every faint site stamps a sequence ... */
  if(aA===0&&bA===0){
    const la=lastFaintSeq([...S.actA,...S.benchA]),lb=lastFaintSeq([...S.actB,...S.benchB]);
    if(la!==lb){MEDSEEN.doubleWipeDecidedByLastFaint++;return la>lb?1:0;}
    MEDFAILS.doubleWipeNoFaintOrder++;return 0.5;
  }
```

`tests/probe_selfdestruct_winner.js`'s own header records the closure — *"CLOSED 2026-08-23 — WIRE
160 ... `w3-simultaneous` KEEPS ITS ID and is an ordinary arm"* — with `w4`/`w5` (the Perish Song
pair) added as the fixture that separates "read the right body" from "guessed the right side".
**The row in `docs/ROADMAP.md` was not updated and is the stale artifact here.** Filed as OWED
below; it is MEASURE's row and this batch does not edit it.

**They are adjacent lines and different questions.** Both live at the end of `faintMessages()`:

| | #362 | D3 |
|---|---|---|
| the statement | `checkWin`'s `this.win(faintData.target.side)` — WHO wins a mutual wipe | `checkWin` RETURNS above `runEvent('AfterFaint')` — whether the on-KO event runs at all |
| the symbol in this engine | `battleResult` / `lastFaintSeq` | the `boostsOnKO` payment in the move step list |
| who reads it | the sealed rollout and the Tower end screen | the board and the protocol |
| status | closed at WIRE 160 | **fixed here** |

A D3 board is not a #362 board either: on the two empirical cards the winning side still has bodies,
so `checkWin` exits through `!side.foePokemonLeft()` and never reaches the double-wipe branch.

---

## 2. THE AUTHORITY, READ WHOLE

`sim/battle.ts:2532`. **`data/mods/champions/scripts.ts` was read FIRST** and it overrides neither
`faintMessages` nor `checkWin`; `data/mods/champions/abilities.ts` touches `eelevate` only with
`{ inherit: true, isNonstandard: null }`. So mainline is the authority here, checked rather than
assumed.

```
  faintMessages(lastFirst = false, forceCheck = false, checkWin = true) {
    if (this.ended) return;
    const length = this.faintQueue.length;                                       :2534
    ...
    while (this.faintQueue.length) {              <- EVERY |faint| LINE IS WRITTEN IN HERE
      ...
      this.add('faint', pokemon);                                                :2549
      if (pokemon.side.pokemonLeft) pokemon.side.pokemonLeft--;
      this.runEvent('Faint', pokemon, faintData.source, faintData.effect);       :2551
    }
    ...
    if (checkWin && this.checkWin(faintData)) return true;                        :2592
    if (faintData && length) {
      this.runEvent('AfterFaint', faintData.target, faintData.source,
                    faintData.effect, length);                                    :2596
    }
```

**Three statements below the loop, and this engine had all three wrong.**

1. **POSITION.** `AfterFaint` is raised BELOW the whole `while`, so every `|faint|` of the drain is
   already on the wire. This engine paid inside `_stepFaint`, which the driver runs per ROW, so a
   spread that killed two wrote `faint,BOOST,faint,BOOST` where the authority writes
   `faint,faint,BOOST`.
2. **SIZE.** It is raised ONCE with `length` — the queue DEPTH at entry, not the number of bodies
   this move killed. Both consumers read it as a stage count:

   ```
   moxie      onSourceAfterFaint(length, ...) { ... this.boost({ atk: length }, source); }
   eelevate   onSourceAfterFaint(length, ...) { ... this.boost({ [source.getBestStat(true,true)]: length }, source); }
   ```

   read off `Dex.forFormat('gen9championsvgc2026regmb')`. A double KO is one `+2`, not two `+1`s —
   and the drain includes an ALLY the same spread took, which empirical card 216 shows on the
   authority (`+2` off a Discharge that killed one foe and one ally).
3. **EXISTENCE.** `checkWin` RETURNS above it. A drain that empties a side ends the battle and the
   event never runs. This engine's own win test is `if(sideWiped(S)) break _TURN` at the TOP OF THE
   NEXT ACTION — hundreds of lines below the faint step — so the boost was landing on a board that
   no longer existed. That is card D3's sentence, confirmed.

There is a FOURTH statement and it is narration: `boost()` resolves an Ability effect to
`this.add('-ability', target, effect.name, 'boost')` above a **bare** `-boost`
(`sim/battle.ts:2058-2064`). This engine wrote no announcement and tagged the boost
`[from] ability: moxie` instead.

**NOT WIRED, and said rather than left to be found.** `boost()`'s own second guard —
`if (this.gen > 5 && !target.side.foePokemonLeft()) return false;` (`sim/battle.ts:2028`) — refuses
the same payment independently. On every board reachable here `checkWin` gets there first, so a
clause for it would have no arm that could distinguish it. Filed.

---

## 3. WHO THIS REACHES — ENUMERATED FROM THE FORMAT, NOT FROM THE CARD

Twelve legal abilities carry a faint hook. They split on WHICH EVENT, and only one half is at this
boundary:

| event | raised where | members (legal abilities) | at this boundary? |
|---|---|---|---|
| `AfterFaint` | `:2596`, **below** `checkWin` | Eelevate, Moxie, Battle Bond, Beast Boost, Chilling Neigh, Grim Neigh, As One (Glastrier), As One (Spectrier) | **YES** |
| `Faint` | `:2551`, **inside** the loop, above `checkWin` | Soul-Heart (`onAnyFaint`), Receiver and Power of Alchemy (`onAllyFaint`), Illusion (`onFaint`) | no |

Legal CARRIERS of the eight, filtered `exists && !isNonstandard && tier !== 'Illegal'`:

| ability | carriers |
|---|---|
| Moxie | **7** — Pinsir, Gyarados, Heracross, Krookodile, Scrafty, Pyroar, Quaquaval |
| Eelevate | **1** — Eelektross-Mega |
| Battle Bond | 1 — Greninja, and its handler requires `source.species.id === 'greninjabond'`, which no legal Greninja is, so it **can never fire** |
| Beast Boost, Chilling Neigh, Grim Neigh, As One x2 | **0** |

**So the reachable population is nine bodies across two abilities**, and the card named one of them.
Both are already tagged `boostsOnKO` (`{stat:'atk',stages:1}` and `{stat:'highest',stages:1}`), so
one edit covers both and a member added later arrives with no edit here.

---

## 4. THE PROBE — SHOWN RED FIRST

`tests/probe_afterfaint_boundary.js`, two engines on one board, release `12dae69813f6` (RED) then
`26787be1b8b4` (GREEN). 24 assertions.

```
  wipe                                                          BEFORE
    turn |  SHOWDOWN                     |  MEDICHAM
    1    | faint,faint,ABIL,BOOST:atk+2  | faint,BOOST:atk+1,faint,BOOST:atk+1
    2    | faint,faint,WIN               | faint,BOOST:atk+1,faint,BOOST:atk+1
                                                                 AFTER
    1    | faint,faint,ABIL,BOOST:atk+2  | faint,faint,ABIL,BOOST:atk+2
    2    | faint,faint,WIN               | faint,faint
```

Krookodile's Earthquake takes both foes on turn 1 (two still in the back — the battle goes on) and
the last two on turn 2 (the battle ENDS). **One board, both wrong clauses, and the two turns differ
in NOTHING except whether p2 had a body left.**

**THE OVER-FIRE CONTROL, and it is the point of the file.** Arm `single` puts a **Rotom-Heat**
(Levitate) in p2 slot b for the whole game, so Earthquake drains exactly ONE body a turn and p2 is
never emptied. Every turn must still pay `+1`. **An engine that learned "stop after a faint" instead
of "stop after the WIN" passes `wipe` and fails here** — it read `faint,BOOST:atk+1` on all three
turns before the fix and reads the same after it.

**THE CLEARED CONTROL.** Arm `cleared` is the same `wipe` board with Krookodile's OTHER legal
ability, Intimidate. Zero boosts on the killer on both engines, and the foes still die (4 faints
each) — so the arm above is on a live board.

**THE KNOB.** `MEDI_AFTERFAINT_PER_TARGET=1` restores WIRE 104's block inside `_stepFaint` byte for
byte and puts exactly the three failures back. It stamps `MEDFAILS.afterFaintPerTargetRestored` at
DECLARATION and is registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`, beside
`residualCollapsed` and `volleyReactDrawnRestored`, so a knob run cannot overwrite the census.

**The partner is Flying on purpose.** Earthquake is `allAdjacent`; a grounded partner would join the
drain and the arm would be measuring a three-body faint while calling it a two-body one.

---

## 5. THE FIX

`engine/medicham2-browser.js`. WIRE 104's payment moved out of `_stepFaint` (per row) into a new
once-per-move step `_stepAfterFaint`, inserted between `_stepDrainFaints` and `_stepHitCount` —
which is where the authority puts it (`faintMessages()` is `battle-actions.ts:976`, `-hitcount` is
`:978`).

- `_afterFaintN` accumulates the drain depth at the two places this engine announces: `_stepFaint`
  (per row, plus the pending self-KO) and `_stepDrainFaints` (which returns what it emptied). This
  engine has no single queue to measure at entry, so the count is taken where the corpses are.
- `sideWiped(S)` is the gate. **It is the engine's own `checkWin` and not a second copy of the
  rule** — the same predicate the three `break _TURN` sites read, split out of `battleOver` by
  ROADMAP #231 for exactly this reason.
- `_koBoost(n, attr, announce)` is one function with two callers; the stat pick was never the defect
  and a second copy of it would drift.
- The cap needs no guard: `TR.bst` already suppresses a zero-delta line and counts it as
  `MEDFAILS.boostZeroSuppressed`, which is the same rule `boost()`'s `if (boostBy)` states.
- Counters: `MEDSEEN.afterFaintPaid`, `afterFaintSkippedBattleEnded`, `afterFaintMultiDrain`.

**NO BACKSTOP CALL below the driver**, and that is deliberate rather than forgotten: `_afterFaintN`
is only ever incremented by the two steps above it, so a move whose rows were all `out` reaches this
with a zero and there is nothing to flush. Said in the code beside `_stepAfterHitField()` /
`_stepUpdate()`, which DO have one.

---

## 6. TWO INSTRUMENTS WERE KEYED TO A SPELLING, AND BOTH WENT RED ON A CORRECT FIX

This is the finding worth carrying forward. Two existing probes proved the on-KO boost had fired by
grepping for **this engine's own attribution**, `-boost ... [from] ability: eelevate` — a form the
authority has never written. The moment the authority's pair went on the wire, both reported the
mechanic MISSING with nothing about them changed:

| instrument | what it read | verdict on a correct engine |
|---|---|---|
| `tests/test-mechanics.js` `move/spreadFoes` — *"a spread move prices every target before any of them faints"* | `/^\|-boost\|.*eelevate/` | **MISSING** (census briefly 805 live / 1 missing) |
| `tests/probe_red_demo.js` `ROADMAP #81 WIRE 10` | the same regex | **FAIL**, `shipped-arm=false` |

Both now read `/^\|-ability\|.*eelevate/i` — the authority's own marker for the same event, and one
that cannot be confused with Make It Rain's self-drop (which is why the original read the stream at
all: Eelevate raises Gholdengo's HIGHEST stat, which is the stat Make It Rain lowers).

**This is `docs/LESSONS.md`'s grep-is-a-claim-about-a-name, arriving through a probe instead of a
test.** It is also the reason the `|-ability|` line was landed rather than filed: `EQUIV`'s
`ability-announcement` rule deletes it from both streams before the differential compares anything,
so **no gate in this repo can go red on it** — `tests/probe_afterfaint_boundary.js` asserting the
two engines agree on the announcement/attribution counts is now its only watcher.

### A PRE-EXISTING RED, MEASURED APART AND HANDED BACK

`tests/probe_red_demo.js` also fails `WIRE 120 Parting Shot does not jump the queue (a pivot MOVE is
a MOVE)` — `shipped-arm=true (must be true) reverted-arm=true (must be false)`, i.e. the
demonstration's revert no longer flips the outcome. **It is not this batch's.** Proven twice rather
than argued: it fails identically under `MEDI_AFTERFAINT_PER_TARGET=1`, and it fails on HEAD's own
`engine/medicham2-browser.js` swapped in for the run. It is reported here and NOT filed as fixed;
it needs its own pass (the revert wants re-aiming at the Parting Shot lines as they stand after the
2026-08-29 `selfSwitch` and redirect-gate batches).

---

## 7. THE CENSUS

**804 -> 806 live / 806 probed / 0 missing.** Two new rows under `ability` / `boostsOnKO`:

- *"a double KO is ONE payment sized by the drain, not one per body"* — reads the WIRE via
  `battleInit`'s own `trace` sink, because **the STATE cannot see this**: two `+1`s and one `+2`
  leave the identical Attack stage, at the cap as well as below it. Arms differ only in how many
  bodies the same Earthquake took. Red under the knob (`nBoost` 1 -> 2, `belowAllFaints` true ->
  false) with the stage unchanged, which is the difference between a probe and a coincidence.
- *"a KO that ENDS the battle pays nothing — checkWin returns above AfterFaint"* — the same double
  KO twice, and **the one varied knob is a body on the foe bench**: with it, `+2`; without it, the
  side is emptied and `+0`. Both arms assert two bodies really died, so a zero cannot be a KO that
  never happened. Red under the knob (2 vs 0).

---

## 8. WHICH SCOREBOARD, SAID BEFORE THE RUN — AND IT MISSED

**Stated before the differential ran:** lab moves (two new rows); pool **UNMOVED at 88**, because
card 216's battle continued and `+1 +1` leaves the same Attack stage as one `+2`; protocol
**204 -> 202** (the two cards); DIFFERENT-WINNER **0 -> 0**.

| | baseline | after | predicted |
|---|---|---|---|
| board-parted | **88** of 961 | **84** of 961 | 88 — **MISSED by 4, improving** |
| `games_board_never_diverged` | 873 | **877** | — |
| protocol diverged | 204 | **199** | 202 — **MISSED by 3, improving** |
| threw | 1 | 1 | 1 — held |
| DIFFERENT-END-STATE | 59 | **55** | — |
| **band 1 DIFFERENT-WINNER** | **0** | **0** | 0 — **held** |
| census | 804 / 804 / 0 | **806 / 806 / 0** | up — held |

**WHY THE PREDICTION MISSED, ATTRIBUTED RATHER THAN EXPLAINED AWAY.** The reasoning assumed the two
payment shapes always leave the same stage. They do — *while the battle continues*. The clause the
prediction forgot is its own clause 3: **in a game the drain ENDS, this engine kept a boost the
authority never gave**, and that difference survives to the final board. Read off the artifacts:

```
  CAUSES THAT MOVED (baseline -> after), computed over the full class table:  5 removed, 0 added
    1 -> 0   extra event emitted by medicham2 :: |-damage|p2b|H/H|[from]lifeorb <> |-boost|p2b|atk|1
    1 -> 0   extra event emitted by medicham2 :: |faint|p1b <> |-boost|p2a|atk|1          <- card 215
    1 -> 0   extra event emitted by medicham2 :: |faint|p2a <> |-boost|p1b|atk|1          <- card 216
    1 -> 0   showdown stopped emitting while medicham2 continued :: |-boost|p1b|atk|1
    1 -> 0   showdown stopped emitting while medicham2 continued :: |-boost|p2b|atk|1

  BOARD-LEAF FAMILIES THAT MOVED — and they are the only two:
    9 -> 5 games   party.boosts.atk
    9 -> 5 games   active[].boosts.atk
```

**Every one of the five removed causes names an on-KO `atk` boost, and the only board leaves that
moved are the Attack stage.** The two `showdown stopped emitting` rows are clause 3 caught in the
population by name. The four board games equal the board-parted delta exactly, and the four
end-state games came out of band 5 (`OTHER-STATE-DIFFERENCE` 19 -> 15) with bands 1, 2, 3, 4 and 6
all unmoved.

**The card named two instances; the population held five, all one cause.**

Run parameters, both sides: `--arm middle --end-state --steering empirical --census
data/verification/census-pin-9446a684709d.json --team-store data/team-pool-frozen --games 1200`
(yields 961), `--turns 12`, pool `0d103fb9fa87`, policy `empirical-click/v1`, VOID 9 of 961 on both.
**One run parameter differs and it is the release** (`12dae69813f6` -> `26787be1b8b4`).
After: `data/verification/game-differential.afterfaint.json`, dump
`data/verification/divergence-turns.afterfaint.json`.

**THE SAMPLE WAS PROVEN IDENTICAL RATHER THAN ASSUMED.** The run was executed TWICE — once without
`--write` and once with it — and both read `199 diverged / 877 board-never-diverged / 9 VOID / 1
threw`. The pool cache missed and rebuilt from a moved store on the first run and still resolved to
the pinned digest `0d103fb9fa87`.

---

## 9. WHAT DIFFERENT-WINNER READS

**0, before and after.** Band 1 is empty in both artifacts and this batch could not have moved it:
the only state this fix changes is a boost that lands after the drain has ENDED the battle, so there
is no later turn for it to reach. Read it against the horizon before calling it agreement — this run
stopped 472 games at *"both engines ended the battle"* and 469 at the turn cap, and a battle that
never resolves cannot have a different winner.

The gate's own winner clause is a different instrument (`tests/probe_selfdestruct_winner.js`) and it
was not re-run this batch; it is named in OWED.

---

## OWED, NOT RUN

- **`tests/roster.js` — all three stages.** The artifacts are on release `e129bca605e3` and the tree
  is `26787be1b8b4`, so three gate clauses are WITHHELD on a release mismatch (they were already, at
  the start of this batch — the gate read 5 of 8 failing before and after, and **not one of the five
  is a divergence**). `SHOWDOWN_PATH=... node tests/roster.js --stage {items,abilities,moves} --write`.
- **`engine/all_mechanics_fire.js`** — same release mismatch, same clause. It also steers off the
  census, which moved 804 -> 806 this batch, so a run either side of it is not a before/after.
- **The damage differential** — not re-run. The diff touches no pricing path, but that is an argument
  and not a measurement.
- **`tests/probe_selfdestruct_winner.js`** — the winner instrument. Not re-run; §9's DIFFERENT-WINNER
  figure comes from the game differential, which is a different question about a different sample.
- **`tests/test-resolution-order.js`** — not re-run. Its KNOWN-OPEN `onDamagingHit` arm is untouched
  by this diff.
- **ROADMAP #362's ROW IS STALE AND THIS BATCH DID NOT EDIT IT.** The engine defect it describes was
  closed by WIRE 160 on 2026-08-23 and `tests/probe_selfdestruct_winner.js` records the closure in
  its own header. The row is MEASURE's (it was filed by MEASURE) and wants closing there, with its
  `INSTRUMENT OWED` clause checked against `w3`/`w4`/`w5` as they now stand.
- **`tests/probe_red_demo.js` `WIRE 120 Parting Shot`** — RED, pre-existing, proven not to be this
  batch's by two independent controls (§6). Handed back, not filed as fixed.
- **`boost()`'s `!target.side.foePokemonLeft()` guard** (`sim/battle.ts:2028`) — a second, independent
  refusal of the same payment. Unreachable behind `checkWin` on every board staged here, so it is
  filed rather than wired.
- **The `-ability` announcement for every OTHER ability that announces itself.** This batch put it on
  the wire for `boostsOnKO` only, because that is where the authority was read. Whether the rest of
  the announcing families write it is not measured here, and `EQUIV` deletes the line, so no
  instrument in the repo would say.
