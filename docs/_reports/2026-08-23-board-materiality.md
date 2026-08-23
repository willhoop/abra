# Board-materiality of the whole-game divergences — measured, 2026-08-23

Historical record, per `docs/_reports/` convention. Not current state; superseded by the register rows
it feeds. Every number below is read out of `data/game-differential.json` (generated
`2026-08-23T10:20:34Z`) or out of `data/verification/divergence-turns-bm.json`, and the command that
produced both is in §1.

**MEASURE AND REPORT ONLY.** No file under `engine/medicham2-browser.js`, no tag, no data file was
changed. The one change to `engine/game_differential.js` is additive and post-hoc (§2) — it computes a
table out of two fields the rows already carried and cannot change which games play or how a die falls.
It was made BEFORE the release was cut and before any measured game ran.

---

## 1. The run, and its three pins

```
node engine/engine_release.js cut "board-materiality end-state run 2026-08-23"    -> 3d9df7ce4996
SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js \
    --games 1200 --end-state --release 3d9df7ce4996 \
    --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json \
    --dump-games 200 --dump-out data/verification/divergence-turns-bm.json --write
```

| pin | value, read back out of the artifact |
|---|---|
| engine release | `3d9df7ce4996`, 26 files frozen, cut from the tree this run measured |
| team store | `steering.team_store_pinned_to = data/team-pool-frozen`, pool digest `0d103fb9fa87`, 8,778 teams, 1,968 picked |
| census | `input_read_from = data/verification/census-pin-9446a684709d.json`, digest `9446a684709d`, **`pinned: true`**, 643 rows, `matches_live: true` |
| showdown | commit `20ad99ffc9a5` |
| games | **961**, not 1,200 — the frozen pool yields 961 pairs and the run says so; the same 961 the previous run played |

**`--end-state`, not `--state`.** The brief named `--state`; `--end-state` implies it
(`game_differential.js:96-97`) and additionally does not stop at the first divergent board, which is
what makes a per-game board verdict available for every parted game rather than only for the ones that
part late. Both measurements are in the artifact.

**THIS IS A RE-BASELINE, NOT A BEFORE/AFTER.** Three things moved since the 82: the engine (the damage
harness pass landed), the census (634 → 643 rows, and the census SELECTS the sample), and the stop rule
(`--end-state` plays games past their first divergence, so coverage credit accrues differently and later
clicks differ). The middle arm reads **78 parted of 961**; do not subtract it from 82.

**Every number below is the `middle` arm unless the row says otherwise, and the quantity is raw
`diverged`/parted, never `undeclared = diverged − declared`.** The corners are reported separately in
§6 and are never pooled with it.

**A free determinism control.** The run was executed **twice** on identical pins (10:13:07Z and
10:20:34Z). Games 961/961, parted 78/78, board-material 36/36, narration 42/42, and the two per-cause
tables are **string-identical**. The pins hold.

---

## 2. What was added to the instrument, and why the artifact could not answer this before

`end_state.by_shape` is a cross-tab of the end verdict against **five** shapes. The question is asked of
a MECHANISM and there are ~30 of them, which is why the prior grouping had to mark 20 of 31 UNKNOWN:
nothing in the artifact put a CAUSE and a BOARD VERDICT on the same row.

`endStateSummary()` now also emits `by_cause` — one row per cause string, carrying:

| column | what earns it | what it means |
|---|---|---|
| `board_parted` | `r.stateDiv !== null` — a leaf `board_state.js` compares differed at some turn boundary | **BOARD-MATERIAL**, measured |
| `narration_games` | no board boundary ever differed **AND** the last boards are identical | **NARRATION-ONLY**, measured |
| `unknown_games` | ENDED-APART / NO-COMPARABLE-BOARD / THREW | **UNKNOWN** — no comparison was made, and it stays out of both halves |
| `board_parted_same_turn / later / earlier` | `stateDiv.turn` against `divTurn` | how tight the attribution is (§4) |

Both inputs already existed on the row (`stateDiv` from the state differential, the verdict from
`endStateVerdict`). This is a join, not a new measurement. `by_cause_reconciles` asserts the three game
columns sum to the parted population exactly, and reads `true`.

---

## 3. THE ANSWER THE GATE NEEDS

**Of 961 games, 78 parted on protocol in the `middle` arm.**

```
  36 games  BOARD-MATERIAL   a compared board leaf differed at some turn boundary
  42 games  NARRATION-ONLY   every compared boundary agreed AND the two last boards agree
   0 games  UNKNOWN          nothing ended apart, nothing threw, every parted game got a verdict
```

**Of the 36, nine are the INSTRUMENT and are excluded by name:**

| excluded | games | why it is not the engine |
|---|---|---|
| **Moody's stat pick** | 8 | `data/abilities.ts:2704` `this.sample(stats)`. The middle arm shares dice over five categories and a residual `sample()` is not one, so the pick has no shared address. **Corroborated by the arms**: 8 in `middle`, **0 in each corner** — a rule defect appears in all three, an unshared die appears only where the dice are real. All 8 are CARDED and every medicham line reads `[from] ability: moody` on a Scovillain; nothing is inferred from shape. |
| **a body named `??:farigiraf` moving off the field** | 1 | the run's own declared gap, `trace_body_off_field = 10` |

### **BOARD-MATERIAL, ENGINE: 27 games in 25 causes, 20 mechanisms. That is the gate number.**

The same figure per arm, computed the same way: **middle 27, top-tie-first 23, bottom-tie-first 23.**

A twelfth game is worth naming separately: **one board divergence has no protocol divergence at all**
(`p2.party.garchomp.hp/maxhp/item/boosts`) and it is **the reader, not the engine** — the run reports
`reader_failures = { duplicate_species_in_party: 40, first: "garchomp" }`, the party projection is keyed
by species, and this game has two Garchomp. It is excluded above and named here because a silent board
divergence is exactly the thing the protocol instrument cannot see, and this one turned out to be ours.

---

## 4. The board-material worklist, ranked by attribution strength

**`same` = the board parted on the same turn the narration did** (tight). **`later`** is weaker: once two
battles part they take different actions, so a board moving four turns on is not proven to be this
cause's doing. **`earlier`** means the board was already wrong before the narration said anything, so the
named cause is a symptom rather than the first evidence.

Middle arm: **28 same, 3 later, 5 earlier** across the 36 (instrument included).

| # | mechanism | games | attribution | evidence |
|---|---|---|---|---|
| 1 | **SUCKER PUNCH LANDS ON A TARGET THAT HAS ALREADY MOVED.** Showdown `-fail`s it; we connect. **Two of the four KO the target** (`-damage \|0 fnt` where the authority failed outright). | **4** | all 4 same-turn | 4 cards, and it reproduces in **all three arms** — the opposite signature to Moody |
| 2 | **Forecast never fires.** `-formechange Castform-Rainy [from] ability: Forecast` in rain; the forme carries a different TYPE. Board parts on `active[].species` + `active[].types` at turn 1. | 2 | both same-turn | 2 cards |
| 3 | **Future Sight's delayed damage is off by 1-2 HP.** Hippowdon 35 vs 34, Sylveon 95 vs 97, both immediately after `-end … move: Future Sight`. | 2 | both same-turn | 2 cards |
| 4 | **RAGE FIST DEALS A THIRD OF THE AUTHORITY'S DAMAGE.** Annihilape into Avalugg-Hisui: `1/170` there, `57/170` here — 84 vs 28. **NEW; it is not in the 31 of the prior grouping.** | 1 | same-turn | carded |
| 5 | **Symbiosis never fires** — `-activate … Symbiosis\|Life Orb\|[of] Torkoal` and the item does not move. Board parts on two `party.item` leaves. | 1 | same-turn | carded |
| 6 | **Disable applies where the authority fails it** (`-fail\|p2b: Gengar` vs our `-start\|p1a: Gardevoir\|Disable`). | 1 | same-turn | carded |
| 7 | **A sleeping body wakes here and stays asleep there** (`cant\|slp` vs our `-curestatus\|slp\|[msg]`). | 1 | same-turn | carded |
| 8 | **A flinch fires here and not there** — Metagross moves in the authority, flinches in ours. | 1 | same-turn | carded |
| 9 | **A screen ends through a type immunity** — Psychic Fangs into a Dark Grimmsnarl: `-immune` there, `-sideend reflect` here. | 1 | same-turn | carded |
| 10 | **A second, spurious `-activate item: sitrusberry`** after the berry was already eaten. | 1 | same-turn | carded |
| 11 | **The wrong body takes the damage** (`-damage\|p2a` vs `-damage\|p2b`). | 1 | same-turn | no card |
| 12 | **Spread damage order** (`-damage\|p1b` vs `-supereffective\|p1a`). | 1 | same-turn | no card |
| 13 | **Mega `detailschange` order** when two megas land the same turn. | 1 | same-turn | no card |
| 14 | **Role Play applies where the authority fails it.** | 2 | both **earlier** | 2 cards |
| 15 | **Simultaneous switch order** (Whimsicott/Alakazam; Talonflame/Falinks-Mega). | 2 | both **earlier** | 1 card |
| 16 | **A switch against a recharge refusal** (`switch\|p2a: Crabominable` vs `cant\|p1b\|recharge`). | 1 | same-turn | carded |
| 17 | **Gravity's turn position.** | 1 | **earlier** | carded |
| 18 | **Telepathy's announcement form** (`-activate … ability: Telepathy` vs `-immune … [from] telepathy`). | 1 | **later** — weak; the outcome agrees and the board parted five turns on | carded |
| 19 | **Cursed Body announces and does not Disable** (`-start … Disable\|Phantom Force\|[from] Cursed Body` vs our bare `-activate`). | 1 | **later** | carded |
| 20 | **Matcha Gotcha's drain is batched, not interleaved.** | 1 | **later** | carded |

**Sucker Punch is the finding of this run.** The authority's `onTry` is
`data/moves.ts:18399-18404`, and its first line is `const action = this.queue.willMove(target)` —
`sim/battle-queue.ts:319-327` walks `this.queue.list`, the REMAINING queue, so a target that has
**already moved this turn** returns `null` and the move fails. `engine/medicham2-browser.js:20289`
answers the same question with `acts.find(x => x.mon === _tgt)` over the whole turn's action list, which
still contains actions that have already executed. Champions does not override `suckerpunch` (no hit in
`data/mods/champions/moves.ts`). ROADMAP #60 and #180 closed the other two clauses of this same `if`;
this is the clause in the line above them. All four cards show the target having acted earlier in the
turn (one of them takes Life Orb recoil from its own move on the line before).

---

## 5. NARRATION-ONLY: 42 games in 38 causes — and what that verdict does and does not say

| mechanism | games |
|---|---|
| the weather-upkeep line is missing (`-weather X [upkeep]`) | 5 (4 rain, 1 sand) |
| Supreme Overlord's `[silent]` `-end … fallenundefined` on switch-out | 5 |
| a `-boost`/`-unboost` of magnitude ZERO at the ±6 cap | 5 |
| the faint queue drains eagerly (hazard, Fling's `-enditem`, sandstorm chip, a Perish death) | 4 |
| a berry resolving against the attacker's own recoil / Life Orb | 3 |
| exact speed ties, Protect vs Protect and Protect vs Detect — already filed NOT A DEFECT | 3 |
| Substitute: the authority breaks it, we `-activate … [damage]` | 2 |
| Throat Chop's `[silent]` `-end` on expiry | 2 |
| two Tailwinds expiring the same turn, in the other order | 2 |
| simultaneous switch order | 2 |
| Intimidate against a shared entry (Drizzle, another Intimidate) | 2 |
| Syrup Bomb's `[silent]` `-end` | 1 |
| Regenerator's `[silent]` heal on switch-out | 1 |
| mega `detailschange` order | 1 |
| Matcha Gotcha drain interleave | 1 |
| `-immune` vs a poison tick; `-immune` vs a flinch refusal | 2 |

**THE LABEL IS ABOUT THE GAMES THAT WERE PLAYED, NOT ABOUT THE MECHANIC.** The Regenerator row is the
proof and it nearly went in as a result: the card reads
`|-heal|p1a: Slowbro|170/170|[from] ability: Regenerator|[silent]` — **the body was already at full
HP**, so the missing heal healed nothing. Regenerator on a damaged body would part the board. Read every
row of this table as *"in the games this sample played"*.

**Three named bounds on NARRATION-ONLY, all published with the artifact:**

1. **`end_state_not_compared` (8 entries)** — item DISPOSITION, Substitute HP, a benched body's
   volatiles / Leech Seed, ability trapping, the trapper mark, destiny bond, yawn/attract/curse/heal
   block, the stall counter, and the durations on magnet rise and syrup bomb. A divergence whose only
   consequence lands there reads as narration by construction. **This directly touches the two
   Substitute rows and the Syrup Bomb row above.**
2. **The turn cap is 12** and 946 of 961 games ended on it. A board that would part at turn 13 reads as
   narration here.
3. **The run's own planted-state proof did not pass** — §7.

---

## 6. Coverage, stated as a number

| claim | value |
|---|---|
| parted games with a cause row in `by_cause` | **78 of 78 (100%)** — `by_cause_reconciles: true` |
| parted games backed by a CARD (six lines of context either side) | **68 of 78 (87.2%)** |
| **board-material** causes backed by a card | **30 of 34 (88.2%)**; the 4 without are 1 game each |
| board-material games whose board parted on the same turn as the narration | 28 of 36 |
| games where the board parted and the protocol never did | 1 — and it is the reader (§3) |

Per arm, never pooled:

| arm | games | parted | board-material | of which instrument | **ENGINE board-material** | narration | unknown |
|---|---|---|---|---|---|---|---|
| `middle` (real dice, the default) | 961 | 78 | 36 | 9 | **27** | 42 | 0 |
| `top-tie-first` | 961 | 65 | 24 | 1 | **23** | 41 | 0 |
| `bottom-tie-first` | 961 | 79 | 25 | 2 | **23** | 54 | 0 |

The end-state view of the same games, for continuity with the 2026-08-19 measurement: of the 78 parted,
**51 SAME-END-STATE, 27 DIFFERENT-END-STATE, 0 ENDED-APART, 0 THREW**. Note that 36 > 27: **nine games
part on a board and reconverge by the last boundary.** Measuring at the boundary is the stricter test
and is the one used above, which is the right direction for a gate that requires zero.

---

## 7. What would still mislead a reader of this file

**7a. The planted-state proof failed, and the failure direction is the reason this is still publishable.**
The run's own proof plants 42 differences into the live medicham board at a boundary the clean arm agreed
at. **Thirteen did not pass**: 6 bench plants reported NOT APPLIED (no living benched body at that
boundary — a fixture failure) and **7 were applied and not caught** — taunt, encore, perish, magnet rise,
focus energy, salt cure, syrup bomb, every one of them on side B. The driver prints
*"THE STATE COMPARATOR FAILED ITS OWN PROOF"* and exits 1.

Three things make the numbers above survive it, and each is measured rather than argued:

- **It is pre-existing and fixture-shaped, not a regression.** Three earlier end-state artifacts fail the
  same proof with *different* sets: `gd-endstate-982.json` and `gd-endstate-982-t30.json` (6 fixture
  failures), `gd-endstate-309.json` and `gd-endstate-AFTER.json` (6 fixture + 6 applied-not-caught, and
  the six are the complement of this run's — stat stage, substitute, confusion, aqua ring, torment, move
  trap, all side A). Same bytes, different failures.
- **The direction is one-way.** An uncaught plant means the comparator is UNDER-sensitive. That can turn
  a real board difference into "no board difference" — i.e. it can only over-call NARRATION and
  under-count BOARD-MATERIAL. **27 is a lower bound**, which is the safe direction for a gate whose bar
  is zero.
- **No verdict here rests on an unproven leaf.** The leaves that actually decided the 37 board
  divergences are hp, maxhp, item, boosts, status, status_counter, species, types, ability, screens, pp,
  `vol.charging`, `vol.trapped`, `vol.disable` and the party mirrors of those — and **every one of those
  plants was CAUGHT+LOCALISED in this run.** None of the seven unproven volatiles appears in any first
  divergent board.

**7b. The instrument's own mirroring limits, printed by the run.** `forced_switch_slots_mirrored 1065`,
`forced_switch_slots_passed 55`, `forced_switch_unmirrorable 12`, `switch lookups that MISSED: medicham
16, showdown 0` (must read 0). These arise **after** two boards have parted, which is after the first
board divergence that decides materiality — but they do shape the END-state column, and the 16 misses are
a real instrument defect that is not fixed here.

**7c. `undeclared_event_drops = 0`** and `align_had_to_move_a_stat = 0`, both of which must read 0 and do.

**7d. Struggle is not in this table.** The known residual damage defect (Struggle typed Normal here,
`???` in the authority) produced no whole-game divergence in this sample; `tags.moves.struggle.uses` is 0.

---

## 8. OWED, NOT RUN

```
node tests/test-mechanics.js                    # NOT run — the census was PINNED for this measurement
                                                #   and regenerating it mid-run is the exact hazard the pin exists for
node tests/run-all.js                           # NOT run
tools\lownode.cmd engine\quarantine.js          # NOT run — the gate still needs the roster and the differential
node engine/status.js --write                   # run at the end of this pass
```

- **The narration gate has no instrument yet.** Will's call is board-material now, narration as its own
  gate afterwards. This run produces the narration count (42 games, 38 causes, middle arm) but nothing
  ratchets it, so it can grow silently. That is a gate to build, not a backlog line.
- **The seven unproven volatile plants** should be re-run on a second fixture pair before anyone quotes a
  NARRATION verdict that rests on a volatile leaf. `plantedStateProof` uses `proofPairs[0]` and takes no
  argument for it.
- **The four uncarded board-material causes** (rows 11-13 and one switch-order game) need
  `--dump-games` raised or a directed probe.
- **`--turns 30`** would test whether the 42 narration verdicts survive a longer horizon. Not run.
