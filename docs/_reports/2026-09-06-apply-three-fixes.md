# Three held fixes applied, measured one at a time: board-material **56 -> 50** of 961, protocol **158 -> 151**, and `data/game-differential.json` republished off a settled tree

ENGINE, 2026-09-06. Nothing committed. Census level **829 live / 829 probed / 0 missing** before and
after — it never moved, and it never fell.

Pins held IDENTICAL across all four whole-game measurements, so every delta below is attributable:
census `data/verification/census-pin-9446a684709d.json` (the frozen pin file, not the live census),
pool `--team-store data/team-pool-frozen`, arm `middle`, `--end-state`, steering `empirical`,
`--games 1200` (961 played), cap 20. Each step ran on its OWN frozen release.

| step | what landed | release | board-material | protocol | end state |
|---|---|---|---|---|---|
| baseline | (batch A, unchanged) | `576bcbadb681` | **56** | **158** | 925/32/3/0/1 |
| 1 | staged pins bound by NAME (#545) | `576bcbadb681` | **56** | **158** | 925/32/3/0/1 |
| 2 | Fairy Aura (#542 a) | `421d8880c61e` | **51** | **153** | 927/30/3/0/1 |
| 3 | Beat Up ally order (#544) | `db248fe67a5e` | **50** | **151** | 927/30/3/0/1 |
| 4 | settled tree, republished | `db248fe67a5e` | **50** | **151** | 927/30/3/0/1 |

Step 4 reproduces step 3 to the byte: `classes`, `first_divergences`, `state.first_board_divergences`
and `end_state[0].summary.by_cause` all compare identical between
`data/verification/step3-beatup.json` and the published `data/game-differential.json`.

---

## STEP 1 — the instrument, alone. ROADMAP #545

### Applied

`engine/game_differential.js`. `PRIMARY_ARM = ARMS[0]` **was left exactly as it was** — it is the arm
the run plays and #545 says so. What moved is the three module-scope staged pins, which are now bound
by name with a throw beside them:

```js
const STAGED_ARM = ARM_BY_ID.get('top-tie-first');
if (!STAGED_ARM) throw new Error('game_differential: the staged measurements are calibrated against '
  + 'the max-damage scalar corner and no arm named "top-tie-first" exists. ...');
const pinRandom = STAGED_ARM.random;
const PIN_CHANCE = STAGED_ARM.chance;
const mediRng = STAGED_ARM.mediRng();
```

Both stale prose assertions were corrected in the same pass, because both read as receipts:

- `engine/game_differential.js:~793` no longer says the two pins are *"ONE FUNCTION BY CONSTRUCTION"*
  full stop; it says so **in the scalar arms only** and states the middle arm's opposite claim.
- `tests/test-game-differential.js`'s PART 3b failure message no longer cites
  `tests/test-engine-diff.js` *"at 149/150"* — that citation had rotted onto the pool comment /
  `logDroppedRow` region. It cites `:888` and tells the next reader to suspect the harness's crit die
  first and to call `damageInterior` twice.
- PART 1's clause was split: every SCALAR arm is asserted to satisfy `prng.ts:115`, and the middle arm
  is asserted to be the OPPOSITE — two independent nth-indexed draws, 140..260 agreements out of 400.
  A middle arm whose two dice agreed everywhere would be the pre-finaliser hash back again.

### Proof

`tests/test-game-differential.js`: **4 FAILURE(S) -> ALL PASSED**.

```
PART 1   ok  every scalar arm's randomChance IS its random (prng.ts:115), and the middle arm's two dice are independent
PART 3b  ok  "knock-off order ...": endpoints agree (108..127) AND the interior is the authority's — 14 distinct values, every multiplicity equal
         ok  "contact punish ...":  endpoints agree (66..78)   AND the interior is the authority's — 13 distinct values, every multiplicity equal
```

The damage interior is the only thing in the artifact that moved:

| | before | after |
|---|---|---|
| knock-off, showdown span | `108..177` | **`108..127`** |
| knock-off, medicham span | `108..127` | `108..127` |
| contact punish, showdown | `66..104` | **`66..78`** |
| contact punish, medicham | `66..78` | `66..78` |

**Showdown's span came DOWN onto medicham's.** The engine's numbers never moved, which is the shape
#545 predicted: the harness was critting on one side only.

### The comparability question, answered rather than assumed

Step 1 changes `driver_code` — `e87506b2d737` -> **`0c1fc935a5fb`** over 11 files — so it breaks
comparability with the 56 by construction. It was re-measured immediately, paired, on the SAME release
`576bcbadb681` and the SAME census pin and pool.

**PREDICTION (`data/verification/_prediction-step1-staged-pins.json`, written before the run): board-material
56, protocol 158, boards-never-diverged 905, threw 1, everything else identical. IT HELD, exactly.**

```
first_board_divergences identical  true
first_divergences        identical  true
end_state                identical  true
classes                  identical  true
board-material 56 -> 56    protocol 158 -> 158    never-diverged 905 -> 905
```

The reasoning behind the prediction was checked rather than trusted: the module-scope `pinRandom` /
`PIN_CHANCE` have exactly TWO consumers (`:6120-6121`, inside `oneHitDamage`), the module-scope
`mediRng` has NONE outside its own definition (grepped across `engine/` and `tests/` — every other
caller uses `ARM.mediRng()`), and the one leak channel worth checking, `MID_NTH`, is cleared at the top
of every middle-arm game (`:3542`), so draws the staged measurements consume cannot shift a game's
dice.

---

## STEP 2 — Fairy Aura. ROADMAP #542 (a)

### Red first

`tests/probe_fairy_aura.js` on the live engine: **3 failure(s) across 4 arm(s)**, exit 1, plus
`KNOB ABSENT — MEDI_AURA_STALE set no MEDFAILS.auraStaleRestored on any arm`.

### Applied — `engine/medicham2-browser.js`, six edits, exactly as derived

1. `const AURA_STALE=(... MEDI_AURA_STALE==='1')`, beside `WSUP_STALE`.
2. `refreshAura(field, bodies)` — **one writer**, returning whether the ANSWER moved.
3. `runEntryPass` calls it (arrival / departure), stamping `MEDSEEN.auraResyncedOnEntry`.
4. `_updateAll` calls it (the site that catches a mid-turn FAINT), stamping
   `MEDSEEN.auraResyncedInAction`.
5, 6. The two pre-existing writers — top of turn (`~23542`) and `megaEvolveNow` (`~19668`) — become
   `refreshAura(...)` calls, so "one writer" is true rather than aspirational. Same expression, same
   write, byte-identical behaviour.

Both new counters are DECLARED in `MEDSEEN` with the reason beside them (verified present in the frozen
snapshot `db248fe67a5e`).

### Green, with the knob doing its job

`tests/probe_fairy_aura.js`: **all 4 arms clear**, exit 0.

| door | Showdown | medicham AFTER | medicham under `MEDI_AURA_STALE=1` |
|---|---|---|---|
| turn 1, aura arrived at the mega | 51 | 51 | 51 |
| turn 2, the holder LEFT | 38 | **38** | **50** |
| turn 3, the holder RETURNED | 52 | **52** | **39** |
| (faints arm) turn 2, the holder was KILLED | 38 | **38** | **50** |

The knob reproduces **every** red reading — exit 50, entry 39, faint 50 — and parts the boards again
(`knob b2:PART b3:PART`). Both controls read `39 / 38 / 39` on Showdown, on medicham, and under the
knob: **the knob moves no byte of either control.**

### Measured

**PREDICTION (`data/verification/_prediction-step2-fairyaura.json`): board-material 54, protocol 156.
ACTUAL 51 and 153. MISSED BY 3 ON BOTH, IN THE GOOD DIRECTION.**

Five BOARD-MATERIAL causes closed and **nothing new appeared**:

```
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p1a:gengar|101/135     vs 90/135
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p1a:floette|82/149brn  vs 97/149brn
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p1a:floette|74/149     vs 92/149
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p2a:archaludon|77/165  vs ...
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p2a:kingambit|112/175  vs ...
NEW   (none)
```

**Why the prediction missed, stated plainly.** I derived it from the FULL by-cause worklist rather
than the capped `first_board_divergences` — which was the right instrument, and it was still wrong. I
credited only the two causes that NAME a Floette-Mega as the damage target, because those are the two
pairs ROADMAP #542 derived by hand (SD 82 / us 97, ratio 1.349; SD 74 / us 92, ratio 1.316). The aura
does not only price Fairy moves aimed at its own carrier: `onAnyBasePower` fires for any Fairy move by
any user with `target !== source`, so a Gengar, an Archaludon and a Kingambit eating a boosted Fairy
move are the same defect. **The error was reading the cause STRING as if it named the mechanic, when it
names the victim.**

---

## STEP 3 — Beat Up ally order. ROADMAP #544

### Red first

`tests/probe_beatup_ally_order.js` on the live engine: **3 failure(s) across 4 arm(s)**, exit 1, plus
`KNOB ABSENT — MEDI_BEATUP_BUILD_ORDER set no MEDFAILS.beatUpBuildOrderRestored on any arm`, and its
own diagnosis line:

```
DIAGNOSIS — medicham on the switch arm [25,16,21,22]  against the authority WITHOUT a switch [25,16,21,22]
  -> IDENTICAL: this engine walked BUILD ORDER through the switch — the #544 defect, exactly
```

### Applied — `engine/medicham2-browser.js`, two edits, exactly as derived

1. `const BEATUP_BUILD_ORDER=(... MEDI_BEATUP_BUILD_ORDER==='1')`, beside `NO_ENTRY_FIELD_SYNC`.
2. In `bringIn`, **immediately above** `nx._turnsOut=0; ... act[i]=nx;` (it must be above that line
   because it reads `act[i]`, which is still the OUTGOING body there), the authority's swap:
   `sf.team[_b]=nx; sf.team[_a]=_out;` stamping `MEDSEEN.partyOrderPermuted`.

`partyOrderPermuted` is DECLARED in `MEDSEEN` with the reason beside it.

### Green, with the knob doing its job

`tests/probe_beatup_ally_order.js`: **all 4 arms clear**, exit 0.

| arm | Showdown | medicham AFTER | under `MEDI_BEATUP_BUILD_ORDER=1` |
|---|---|---|---|
| after-a-switch, pin `top-tie-first` | `[25,22,21,16]` | **`[25,22,21,16]`** | `[25,16,21,22]` |
| after-a-switch, pin `middle` | `[24,21,19,21]` | **`[24,21,19,21]`** | `[24,15,19,30]`, board `b2:PART` |
| no-switch (control) | `[25,16,21,22]` | `[25,16,21,22]` | `[25,16,21,22]` |
| no-switch-middle (control) | `[24,15,19,30]` | `[24,15,19,30]` | `[24,15,19,30]` |

Neither control moves under the knob. The probe's own diagnosis now reads
`-> DIFFERENT: this engine is no longer walking build order through the switch`.

### THE ASSUMPTION THE PREVIOUS AGENT COULD NOT TEST IS NOW MEASURED

`engine/game_differential.js` `STATE_PLANTS` at `:5598/:5601` picks a "benched" party member as
`t[t.length-1]`, which can hold a STANDING body once `sf.team` permutes. The report expected no red and
said so as an assumption. **`tests/test-end-state.js` was run BEFORE the measurement and is ALL GREEN**:

```
PART 3 — a planted board difference must survive to the end, and the control must not have it
        control  SAME-END-STATE        planted  DIFFERENT-END-STATE
        planted body still on the field at the last boundary: false
  ok    the plant is caught AT THE END: DIFFERENT-END-STATE
  ok    localised to the planted field (p1.party.basculegion.item)
  ok    the control game does not differ on any item leaf, so the catch is the plant
ALL GREEN — the end-state measurement measures what it says it does
```

The plant selector still landed on a body that is OFF the field at the last boundary, and the plant
was still caught and still localised. The assumption holds, and it holds because something asked.

The other two `sf.team` readers were cleared by reading rather than by assuming: `fallenCount` filters
(order-insensitive) and the board leaves are species-keyed — every leaf in the step1/step2/step3 diffs
reads `p1.party.<species>.hp`, never an index.

### Measured

**PREDICTION (`data/verification/_prediction-step3-beatup.json`): board-material 50, protocol 152.
ACTUAL 50 and 151. BOARD-MATERIAL EXACT; PROTOCOL MISSED BY 1.**

Two causes closed, nothing new:

```
GONE  1 BOARD-MATERIAL  -damage field 3 :: |-damage|p1a:milotic|161/170   vs 164/170
GONE  1 NARRATION-ONLY  -damage field 3 :: |-damage|p1a:sinistcha|122/146 vs ...
NEW   (none)
```

I predicted the protocol count would fall by exactly the one board-material game; a second, narration-
only game closed with it. **Which scoreboard was called before the run:** per CLAUDE.md's 2026-08-23
rule this is the obscure tail, so the LAB was expected to move and the pool was expected to sit still
or move by one. It moved by one. The probe going red -> green is the result.

---

## STEP 4 — the settled-tree pass

**a.** Release `db248fe67a5e` (26 files frozen). Re-measured with the same three pins:
**board-material 50 of 961, protocol 151 of 961**, boards-never-diverged 911, threw 1, end state
927/30/3/0/1. Byte-identical to step 3 on `classes`, `first_divergences`,
`state.first_board_divergences` and `by_cause`.

**b. `data/game-differential.json` IS REPUBLISHED.** It had held a stale 46 measured on release
`0dec37ff5ad9` for 1.3 days, and both whole-game gate clauses were failing on *staleness* — "MEASURED
AGAINST A DIFFERENT ENGINE ... EVERY COUNT IN IT IS WITHHELD". They now fail on the measured counts
themselves, which is the honest state and makes the numbers quotable again.

**c. The clauses these changes staled, re-run, none moved:**

| clause | reading | release |
|---|---|---|
| damage differential | **0 / 6000 disagree** at the midpoint AND at all sixteen corners (seed 20260804) | `db248fe67a5e` |
| roster / items | `FIRED-AND-BOARDS-DIFFER 0`, `DID-NOT-FIRE 0`, 140 tested of 148 | `db248fe67a5e` |
| roster / abilities | `FIRED-AND-BOARDS-DIFFER 0`, `DID-NOT-FIRE 0`, 129 tested (1 deferred, 45 control-not-quiet) | `db248fe67a5e` |
| roster / moves | `FIRED-AND-BOARDS-DIFFER 0`, `DID-NOT-FIRE 0`, 475 tested of 500 (3 deferred) | `db248fe67a5e` |
| `all_mechanics_fire --kind all` | 1313 games played, 0 threw, 0 sheets unassembled; written | `db248fe67a5e` |
| census (`tests/test-mechanics.js`) | **829 live / 0 missing / 829 probed** after step 2 AND after step 3 | live tree |

`--kind all` was used deliberately: the default `--kind moves` is the trap that takes the gate to 3 of 9.

**d. `node engine/status.js` reads 7 of 9 clauses PASSING.** `--write` was NOT run.

```
PASS  game differential                     0/6000 at every corner
PASS  deliberate roster / items             140 of 148
PASS  deliberate roster / abilities         129 of 202
PASS  deliberate roster / moves             475 of 500
PASS  coverage / every used mechanic is measured by something
PASS  mechanics / each one staged and compared against showdown
PASS  no open, known engine defect
FAIL  whole-game differential / BOARD-MATERIAL   50 of 961 = 5.2%
FAIL  whole-game differential / NARRATION        151 of 961 = 15.7%
```

Both failures are now real counts on a fresh artifact rather than a withheld stale one. BOARD-MATERIAL
is the gating clause; NARRATION reports and does not hold the gate shut (Will, 2026-08-22).

---

## WHAT IS OWED

1. **`node engine/status.js --write` was NOT run.** Deliberately — it belongs to the publish pass.
2. **Nothing is committed.** All work is on disk.
3. **`data/mechanics-census.json` was regenerated twice** (after step 2 and after step 3), level
   unchanged at 829/829/0. The whole-game runs all used the FROZEN pin file, so the sample never moved.
4. **`data/engine-release.json` gained cut events** for `421d8880c61e` and `db248fe67a5e`, and appended
   cuts to `576bcbadb681`. No pointer was rewritten; cuts append.
5. **Two NARRATION gaps measured beside the aura work and NOT claimed fixed**, both on every arm
   including both controls so neither can flatter a red arm: this engine prints neither
   `|-ability|<x>|Fairy Aura` on the carrier's entry or mega, nor `|-ability|<x>|Unnerve` on a
   switch-in. They belong to the narration gate.
6. **`MEDSEEN.partyOrderPermuted`, `auraResyncedOnEntry` and `auraResyncedInAction` are DECLARED and
   their firing is proven BEHAVIOURALLY** by the two probes' knob arms rather than by a printed count —
   no run in this pass prints MEDSEEN wholesale. A counter print would be a stronger receipt and is
   worth adding the next time either probe is touched.
7. **50 board-material games remain**, and the worklist is `end_state[0].summary.by_cause` in the
   freshly published `data/game-differential.json` — 47 attributed by cause, 3 that part on the board
   with the protocol identical all game.

## FILES TOUCHED

```
engine/game_differential.js          step 1 — staged pin binding + one prose block
tests/test-game-differential.js      step 1 — PART 1 per-arm clause, PART 3b failure message, one comment
engine/medicham2-browser.js          steps 2 and 3 — six aura edits, two Beat Up edits, three MEDSEEN declarations
data/game-differential.json          REPUBLISHED (step 4b)
data/mechanics-census.json           regenerated x2, level unchanged
data/engine-diff.json                re-run 0/6000
data/roster.{items,abilities,moves,all}.json + .prev.json     re-run, all zero
data/all-mechanics-fire.json         re-run --kind all
data/engine-release.json + data/releases/{421d8880c61e,db248fe67a5e}/
data/verification/_prediction-step{1,2,3}-*.json             predictions, written before each run
data/verification/step{1,2,3}-*.json                         the paired artifacts
docs/ENGINE.md                       new section + hand list
docs/ROADMAP.md                      #542(a), #544, #545 closed
```

---

## TWO GATES WENT RED AS A CONSEQUENCE AND BOTH WERE FIXED IN THIS PASS, NOT FILED

**`tests/test-docs-current.js` — 3b(b), 1 new entry.** Republishing `data/game-differential.json`
staled a CITATION, not a claim: `docs/ABRA-deck-plain-english.md:81` is the dated **5.252.0** changelog
entry recording that on 2026-09-04 the published file was rewritten to read 46 of 961 (4.8%). That file
now reads 50 of 961. A dated changelog entry is a record of what was true then and is **not rewritten
in place** (CLAUDE.md), so the entry was hand-added to `data/docs-currency-baseline.json` **with a
written reason** — the documented procedure for this file, and the same shape as the existing
`docs/MEDICHAM-SPRINT-NOTES.md|117|data/tags.json` entry, where the document did not move and the
artifact did. **The gate is back to 24 passed / 0 failed.**

**This leaves a real living-docs debt and it is named rather than absorbed:** the white paper, the
deck, `docs/SUMMARY.md` and `docs/MODELS.md` still carry the 46 / 141 pair and owe a **50 / 151**
restatement with a version bump and a CHANGELOG entry in the publish pass. That restatement is exactly
what retires the baseline entry added above.

**`tests/test-no-silent-failure.js` — 1 NEW block, and it was NOT mine.**
`tests/probe_leechseed_silent.js:165` (written by the batch-A pass, untracked in my working tree)
caught a `readFileSync` failure and returned `''`. That made `HAS_CASE` false, and the message
underneath then accused **the authority** of having dropped its `case 'leechseed'`. A broken
`SHOWDOWN_PATH` and a changed rulebook are two different findings and the file printed the second for
both. It now names the path and the errno and exits 2 with the right reason. `NEW since the baseline
0`, and the probe is still `all 4 arms clear`.

## OTHER GATES RUN AS REGRESSION, ALL GREEN

`tests/test-roadmap-register.js` (3/3), `tests/test-register-cell-parse.js`,
`tests/test-resolution-order.js`, `tests/test-pin-arms.js`, `tests/test-middle-identity.js`,
`tests/test-engine-consistency.js`, `tests/test-game-diff.js`, `tests/test-speed-tie.js`,
`tests/test-volatile-duration.js`, `tests/probe_bigroot_family.js` (8 arms),
`tests/probe_moldbreaker_ally_guard.js` (5 arms), `tests/probe_leechseed_silent.js` (4 arms).

## REGISTER

- **#545 CLOSED** — status cell now begins `closed 2026-09-06`.
- **#544 CLOSED** — status cell now begins `closed 2026-09-06`.
- **#542 STAYS OPEN for (d) alone**, the one roll-index game. (a) is recorded as applied, measured and
  closed inside the cell. `node engine/open_work.js` confirms: #544 and #545 no longer appear, #542
  still does.
