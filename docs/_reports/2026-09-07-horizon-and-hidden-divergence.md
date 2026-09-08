# The turn cap was the horizon, and the horizon was hiding a board divergence

**2026-09-07, ENGINE.** Full account. The verdict is in the last section.

---

## 1. What was asked, and the four answers

1. Establish the right default turn cap **by measurement**.
2. Diagnose and close the one board divergence visible at cap 50 and not at cap 20.
3. Re-measure at the new cap and report the bar.
4. Reconcile the bar reading `1` while the by-cause table read `4`.

All four are answered. Every figure below is read off a run whose log and artifact are in
`data/verification/horizon/`.

---

## 2. The pins, in full, for every run

```
node engine/game_differential.js --steering empirical --release <id> --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns <N> --team-store data/team-pool-frozen \
  --dump-games 60 --dump-out <path> --out <path> --write
```

- **release** `f30bf025ae28` for every published figure in this report (the diagnostic run that
  found the game was on `a9b05e61146a` and is discussed in §3).
- **census** `data/verification/census-pin-9446a684709d.json`, digest `fce8f2e1899e`, 830 rows.
- **team store** `data/team-pool-frozen`.
- **`--games 1200`** — part of the SAMPLE, not a budget. 961 played, 958 readable.
- **`--turns N`** — likewise part of the sample. Stated on every line below.
- `--out` is used throughout so that `data/game-differential.json` is **not** rewritten: the
  NARRATION agent owns that artifact this evening.

Every run in §4 onward reports `the INSTRUMENT held still: driver code … unchanged across the whole
run`, so none of them is void.

---

## 3. The diagnostic run, and why its numbers are used for diagnosis only

The first cap-50 run (`run-cap50.log`, release `a9b05e61146a`) was **VOIDED by `driverCodeGuard`** —
the NARRATION agent rewrote `engine/game_differential.js` while it was playing. That risk was named
in `data/verification/_prediction-2026-09-07-horizon.json` before the run started. Its console
figures are used to LOCATE the game and for nothing else; **no figure from it is published**, and
every number in §4 onward comes from a run that held still.

What it located:

```
1 games  board parted at turn 22 [same 1 later 0 earlier 0]
         medicham2 stopped emitting while showdown continued :: |-end|p1a|syrupbomb
WHICH PART OF THE BOARD PARTED:   1 games  1 leaves  active[].vol.syrupbomb
```

`pair-protect-bust  gen9championsvgc2026regmbbo3-2655745450 vs …bo3-2655794301`.

---

## 4. The cap: measured, not chosen

### 4.1 The sweep, on identical pins, release `f30bf025ae28`

| `--turns` | games ended AT THE CAP | board-material bar | log |
|---|---|---|---|
| 20 | **35 of 958** | 0 of 958 | `run-cap20.log` |
| 50 | **0 of 958** | 0 of 958 | `run-cap50-after.log`, `run-default.log` |
| 100 | **0 of 958** | 0 of 958 | `run-cap100.log` |

At cap 50 the whole end-reason population is

```
958 both engines ended the battle;
  1 the boards parted — medicham2's placement cannot be expressed to showdown
    (p2: slot 1 holds typhlosion, which showdown has FAINTED);
  1 the boards parted — … (p2: slot 1 holds mudsdale, which showdown has FAINTED);
  1 THREW
```

with **no `the turn cap (50)` row at all**.

### 4.2 A higher cap changes nothing, and that is measured rather than argued

`gd-cap50-after.json` against `gd-cap100.json`, key by key:

```
IDENTICAL  classes        first_divergences   diverged   threw   mid_void   games
IDENTICAL  end_state.by_cause_totals  .end_reasons  .by_cause  .by_shape
IDENTICAL  end_state.end_state_families  .severity
DIFFERS    state.agreement_by_turn      array 50 vs 100
```

and that one difference is the table's LENGTH: the first 50 rows are byte-identical and rows 51–100
all read `reached: 0`. **The longest game in this pool reaches turn 36.** So every cap at or above 37
plays a byte-identical set of games on this pool, and the cost of the cap above 37 is exactly zero.

### 4.3 So the default is 50

`engine/game_differential.js`, `const TURNS_DEFAULT = 50;`. 50 rather than 40 for a **14-turn margin
against a pool that grows hourly** — OPS appends to the store continuously, and a future pool may hold
a longer game than today's 36. The choice is free by §4.2 and the margin is the only thing being
bought.

**This format has no Endless Battle Clause** — its ruleset is Flat Rules, VGC Timer, Open Team Sheets
— so nothing in the RULES forces an end. That every game ends anyway is an EMPIRICAL fact about this
pool and this driver, not a guarantee. That is why the truncation count is now printed (§4.5) rather
than left for a reader to notice.

### 4.4 A CAP IS PART OF THE SAMPLE DEFINITION

**A figure measured at `--turns 20` and a figure measured at `--turns 50` are not one series** unless
something has shown the games are the same games.

- **50 against 100 IS one series** — shown in §4.2, key by key.
- **50 against 20 IS NOT** — 35 games were cut short at 20, and one of them parted a board at turn 22.
  The cap-20 bar of `0 of 958` was a claim about the first twenty turns of those 35 games, and it was
  wrong about at least one of them.

Every board-material figure published before today was measured at cap 12 or cap 20. They are not
retracted — they were correct answers to the question they asked — but they may not be lined up
against a cap-50 figure as though they were the same measurement.

### 4.5 The horizon is LOUD now, and it was shown red

At cap 20 the run printed `BOARD-MATERIAL GAMES 0 of 958` and **nothing said 35 games had been cut
off**. That is the silent-default failure this repository is built against: a green bar that had not
looked. The state summary now carries `games_cut_off_by_the_turn_cap`, published in the artifact and
printed directly under the bar:

```
    BOARD-MATERIAL GAMES                         1/129   (the bar: …)
    games CUT SHORT by the turn cap of 12           48/129   <-- THE BAR ABOVE IS A CLAIM ABOUT THE
    FIRST 12 TURNS OF THOSE GAMES, NOT ABOUT HOW THEY ENDED. …
```

— `run-caplow.log`, a deliberate `--turns 12 --games 150` run whose only purpose was to show the line
firing. At the new default it reads
`games CUT SHORT by the turn cap of 50   0/958   (must read 0 — every game reached its own ending
inside the horizon)`.

---

## 5. The hidden divergence: a per-turn-boost volatile outliving its source's corpse

### 5.1 The rule, read rather than recalled

`syrupbomb.condition` (`data/moves.ts:18764-18781`; the Champions mod at
`data/mods/champions/moves.ts:1010-1013` is `{ inherit: true, accuracy: 90 }` and carries no
condition of its own):

```js
onUpdate(pokemon) {
  if (this.effectState.source && !this.effectState.source.isActive) {
    pokemon.removeVolatile('syrupbomb');
  }
},
```

And `isActive` has exactly three clearing sites in the whole simulator:

```
grep -rn "isActive = false" sim/   ->  sim/battle-actions.ts:120   switchIn, the outgoing body
                                       sim/battle.ts:2563          faintMessages
                                       sim/pokemon.ts:473          the constructor
```

`sim/battle.ts:2563` sits **inside `faintMessages`'s drain loop**, four statements after
`this.add('faint', pokemon)` and long before a replacement is asked for. A body that has fainted and
is still standing in its slot is **not active**.

The authority reaches it inside the hit loop:
`battle-actions.ts:976  this.battle.faintMessages(false, false, !pokemon.hp)` marks the corpse, and
`:1003  this.battle.eachEvent('Update')` then ends the volatile on the target — which is why the
`|-end|` lands in the same turn, before the residual phase.

### 5.2 What this engine did

`_updateEvent`'s per-turn-boost sweep tested SLOT MEMBERSHIP alone:

```js
if(!_src||actA.indexOf(_src)>=0||actB.indexOf(_src)>=0)continue;
```

under a comment asserting, in as many words, *"a body that has FAINTED but not yet been replaced is
still active in the authority and is still in these arrays here, so a KO'd source does not end the
volatile early in either engine."* That sentence is false at `sim/battle.ts:2563`. A Syrup Bomb whose
Hydrapple had been killed went on taking a Speed stage every residual from a corpse until the
replacement walked in.

### 5.3 One fact had two implementations and they disagreed

The **partial-trap** sweep in the residual walk already had the right predicate —
`_by.fainted||_by.curHP<=0||(actA.indexOf(_by)<0&&actB.indexOf(_by)<0)`. Two readings of one fact,
"has the source left the field", is exactly the shape CLAUDE.md's FACTS-ARE-GLOBAL rule names: both
kept working and only one was right. Both sites now call one reader:

```js
function sourceOffField(src,actA,actB){
  if(!src)return false;                      // an unknown source keeps the old behaviour, deliberately
  if(src.fainted||src.curHP<=0)return true;  // sim/battle.ts:2563 -- isActive is cleared AT the faint
  return actA.indexOf(src)<0&&actB.indexOf(src)<0;   // sim/battle-actions.ts:120 -- it walked out
}
```

The trap's third clause `!source.activeTurns` is deliberately **not** folded in: it has no counterpart
in `syrupbomb.condition`, and moving it into the shared reader would silently hand it to a family the
authority never gives it to. It stays declared as an owed remainder at its own site.

### 5.4 The exact lines edited in `engine/medicham2-browser.js`

The NARRATION agent owns this file for narration causes this evening. My edits are five, all outside
its working areas, and every one is listed here:

| what | where |
|---|---|
| `MEDFAILS.volSrcSlotOnlyRestored` added | beside `lastResortBattleUsedRestored` |
| `MEDSEEN.perTurnVolatileSourceFaintedInSlot` added | beside `perTurnVolatileSourceLeft` |
| `const VOLSRC_SLOT_ONLY` knob | beside `LASTRESORT_BATTLE_USED` |
| `function sourceOffField` | immediately above `oneTurnSurvivalVolatiles` |
| the per-turn-boost sweep's predicate | inside `_updateEvent`, the `perTurnBoostVolatiles()` loop |
| the partial-trap predicate | inside the residual walk's `_G.has('trap')` branch, one line |

`node --check` clean; the other agent's blocks in both files are intact and were verified by grep
after every edit.

### 5.5 The probe: `tests/probe_syrupbomb_source_faint.js`

Three arms on `bottom-tie-first` (chosen because Syrup Bomb is **90%** accurate in Champions —
DERIVED — and a real die would make the probe a coin flip):

| arm | what happens | must |
|---|---|---|
| **RED-1** | Syrup Bomb lands, then the SOURCE IS KILLED | the volatile ENDS — one Speed stage, no more |
| **CTRL-A** | Syrup Bomb lands, then the SOURCE PIVOTS OUT | also ends — **the arm that says the knob is narrow** |
| **CTRL-B** | Syrup Bomb lands, the SOURCE STAYS ALIVE | keeps ticking — refuses a fix that ends it always |

Shown RED first, on the live tree, before a byte of the engine moved:

```
RED-1   showdown  Speed stages lost by the TARGET (p2a): 1
        medicham  Speed stages lost by the TARGET (p2a): 2
        parts at t2: p2.active[0].boosts.spe   medi -2 / sd -1
                     p2.active[0].vol.syrupbomb medi 1 / sd 0
```

— the same leaf as the pool game. After the fix: GREEN in both arms
(`--red`, `MEDI_VOLSRC_SLOT_ONLY=1`, RED-1 PARTS and both controls HOLD).

**The knob reaches the rule, and it is printed.** `MEDSEEN.perTurnVolatileSourceFaintedInSlot` counts
the one board the two predicates disagree about — a fainted source still standing in its slot — and
the probe asserts it: `> 0` in RED-1, exactly `0` in both controls. Clean it reads **1** (the volatile
goes on the first Update that sees the corpse); under the restore knob it reads **5**, because the
volatile survives and the same disagreeing board is met on every Update until the replacement walks
in. My first version of that claim asserted `=== 1`, went red under the knob, and was wrong: it is the
BOARD that is counted, not the removal.

### 5.6 Two probe faults caught before they became findings

1. **`|switch|` is not only a pivot.** The first version of RED-1 asserted the source did NOT switch,
   read `|switch|p1a…milotic: 2`, and called the arm mislabelled. The harness sends the bench in after
   the kill. The arms are told apart by the FAINT, never by the switch.
2. **`=== 1` on the disagreement counter**, above.

Neither was the engine. Both were mine, and both went the comfortable way first.

---

## 6. The bar after the fix, knob-controlled on ONE release

Because the NARRATION agent is editing `engine/medicham2-browser.js` concurrently, the release
`f30bf025ae28` contains its work as well as mine. **A diff between two releases would not be
attributable**, so the delta is measured with the restore knob on a single release:

| arm | `--turns` | board-material bar | `by_cause_totals.games_board_material` | the turn-22 row |
|---|---|---|---|---|
| `MEDI_VOLSRC_SLOT_ONLY=1` (before) | 50 | **1 of 958** | 4 | present, BOARD-MATERIAL |
| clean (after) | 50 | **0 of 958** | 3 | gone |
| clean, default flag omitted | 50 | **0 of 958** | 3 | gone |
| clean | 100 | **0 of 958** | 3 | gone |
| clean | 20 | 0 of 958 (**35 games cut short**) | 3 | not reachable |

Protocol diverging games: **67 of 961 in both arms** — unmoved. `elapsed` 272.1s / 258.4s / 183.1s /
177.5s / 224.0s respectively; the spread is machine load from concurrent agents, not the cap.

### 6.1 The game did not leave, it changed bucket — and that is a NARRATION row for someone else

```
before   medicham2 stopped emitting while showdown continued :: |-end|p1a|syrupbomb   BOARD-MATERIAL
after    ordering :: |faint|p2b <> |-end|p1a|syrupbomb                                NARRATION-ONLY
```

Standalone replay (`replay-syrupbomb.txt`, release `f30bf025ae28`, `--turns 50`) — the board is now
identical and two lines are transposed:

```
0268  both  P2b Hydrapple drops to 0 fnt
0269  SD    P2b Hydrapple faints                     US  P1a Ceruledge loses syrupbomb <silent>
0270  SD    P1a Ceruledge loses Syrup Bomb <silent>  US  P2b Hydrapple faints
```

The authority announces the faint at `battle-actions.ts:976` and ends the volatile at the `Update` at
`:1003`, so `|faint|` comes first. medicham2's update pass sits above its faint announcement.
**That is a narration-position defect, it belongs to the NARRATION clause, and it is handed over
named rather than fixed here.**

### 6.2 What the gate says, and it is not green

`engine/status.js` reads `data/game-differential.json`, which was written by the NARRATION agent on
release `bc99dcc268ce`. Since the tree is now `f30bf025ae28`, the board-material clause reads
**`MEASURED AGAINST A DIFFERENT ENGINE`** — stale, not broken. **The published clause is not green and
I have not published over it**: the measured figure is `0 of 958 at cap 50 on f30bf025ae28` and it
lives in `data/verification/horizon/gd-cap50-after.json` and `gd-default.json`. Six of nine clauses
fail; four of them are stale artifacts owed a re-run on the settled tree.

### 6.3 The census did not move, and it was checked

`node tests/test-mechanics.js` on the fixed bytes: **830 live / 830 probed / 0 missing, 0 hollow,
0 threw, 0 unarmed** — identical to the 830/830 before. Nothing went down.

---

## 7. The 1-versus-4 reconciliation: the BAR is right, and the gap is the void exclusion

### 7.1 They are two populations, and the code says which

- **The bar** is `state.games` less `state.games_board_never_diverged`, computed at
  `engine/game_differential.js:7867-7868` over `results`, which at `:7861` is
  `allResults.filter(r => !r._mid_void)` — **void games removed**.
- **`by_cause_totals.games_board_material`** is a sum over `byCause`, built at `:7293` from `parted`,
  which is `rowsWith.filter(x => x.r.divTurn != null)` — the games whose **PROTOCOL** parted — and
  `endStateSummary` is called at `:7509` as `endStateSummary(a.results, …)`, on the arm's **UNFILTERED**
  results. **Void games are still in it.**

So the two differ by exactly the void-excluded games that parted a board.

### 7.2 Proven by control, not by reading

`--state-count-void` removes the filter and nothing else. Same release, same pins, `--turns 50`,
clean engine (`run-cap50-void.log`):

```
GAMES whose board NEVER diverged             958/961   99.7%
BOARD-MATERIAL GAMES                           3/961
of 961 played, 0 were EXCLUDED as the instrument OWN void games
  <-- --state-count-void: NOT excluded, this is the pre-2026-09-07 ruler
BOARD-MATERIAL    3 causes, 3 games
```

**With the filter removed the two quantities coincide exactly, at 3.** So:

| | bar | by_cause | difference |
|---|---|---|---|
| before the fix, cap 50 | 1 of 958 | 4 | the 3 void games |
| after the fix, cap 50 | 0 of 958 | 3 | the 3 void games |
| after the fix, cap 50, `--state-count-void` | 3 of 961 | 3 | none — the filter is what it was |

### 7.3 Which is right

**The BAR.** A void game is one the middle arm declared `low-identity`: the two engines were not
drawing the same dice, so its board split is the RULER and not the engine, and charging it to the
engine is charging the engine for the instrument. `by_cause_totals.games_board_material` is a
different, larger population and is **not the quarantine bar** — CLAUDE.md already says so, and this
is the third time in two nights that the two have been near-confused.

### 7.4 A SECOND source of gap exists, in the other direction, and it is zero today

`by_cause` only walks games whose **protocol** parted. A game whose BOARD parted while its narration
stayed silent would be in the bar and **absent** from the by-cause table entirely. Both runs report
`0 games where the BOARD parted first (the protocol was late or silent)`, so the gap is zero today —
but it is a real second term and the two quantities must not be reconciled by the void count alone in
future.

---

## 8. Predictions, and the one miss

Written to `data/verification/_prediction-2026-09-07-horizon.json` and
`…-horizon-fix.json` **before** the runs.

| id | claim | outcome |
|---|---|---|
| P1 | no `the turn cap (50)` row at cap 50 | **HIT** |
| P2 | bar 1 of 958 at cap 50 | **HIT** |
| P3 | by_cause 4 games at cap 50 | **HIT** |
| P4 | the gap is exactly the void exclusion; `--state-count-void` makes the bar 4 | **HIT in substance, off by the fix**: the control was run AFTER the fix, so it read 3 = 3 rather than 4 = 4. Same claim, one game later. |
| P5 | the hidden divergence first parts at a turn > 20 | **HIT** — turn 22 |
| P6 | cap 100 identical to cap 50 | **HIT**, with the named exception of `state.agreement_by_turn`'s length |
| P7 | cap 20 → 50 costs under 25% | **HIT** — 224.0s → 258.4s, +15%, though the spread is machine load |
| P8 | restore arm: bar 1, by_cause 4, turn-22 row present | **HIT** on all three |
| P9 | clean arm: bar 0, by_cause 3, syrupbomb row gone from the worklist | **HIT** |
| P10 | `perTurnVolatileSourceFaintedInSlot` > 0 on the pool | **NOT MEASURED AS STATED.** The differential does not print MEDSEEN and I did not add a print, to avoid voiding the other agent's in-flight run. It is measured in the lab (1 clean, 5 under the knob) and the pool evidence is the knob-controlled bar move on identical pins. |
| P11 | protocol diverging games 70 → 69 | **MISS.** 67 in both arms, unmoved. The baseline was 67 on this release, not 70 (that was the older one), and the game did not leave the protocol population — it changed CAUSE, from `medicham2 stopped emitting` to `ordering`. |
| P12 | cap 100 blocks identical to cap 50 | **HIT** |
| P13 | narration moves by at most 1 | **HIT in direction, not measured as a clause figure** — one game moved into the narration bucket (`games_narration_only` 63 → 64). |

---

## 9. Owed, and named, not fixed here

- **A NARRATION-POSITION ROW, handed to the NARRATION clause**: medicham2 emits
  `|-end|…|Syrup Bomb|[silent]` **above** the `|faint|` of the body that caused it; the authority
  emits the faint first (`battle-actions.ts:976` then `:1003`). Board identical. §6.1 has the replay.
- **`!source.activeTurns`** — the third clause of the authority's partial-trap predicate, still with
  no counterpart in this engine and still declared at its own site. It is NOT in `sourceOffField` and
  §5.3 says why.
- **`data/game-differential.json` is owed a republish** on a settled tree at the new default cap.
  Not done here: the NARRATION agent owns that artifact tonight, and four gate clauses plus the three
  roster stages are owed the same re-run.
- **Every board-material figure in the ledgers below today was measured at cap 12 or cap 20** and is
  not comparable with a cap-50 figure without a sample-identity check like §4.2.

---

## 10. Files

```
data/verification/_prediction-2026-09-07-horizon.json          predictions, written first
data/verification/_prediction-2026-09-07-horizon-fix.json      predictions for the fix runs
data/verification/horizon/run-cap50.log                        the VOIDED diagnostic run
data/verification/horizon/run-cap20.log      gd-cap20.json     cap 20, f30bf025ae28
data/verification/horizon/run-cap50-before.log  gd-cap50-before.json   MEDI_VOLSRC_SLOT_ONLY=1
data/verification/horizon/run-cap50-after.log   gd-cap50-after.json    clean
data/verification/horizon/run-cap50-void.log    gd-cap50-void.json     --state-count-void control
data/verification/horizon/run-cap100.log     gd-cap100.json    cap 100
data/verification/horizon/run-default.log    gd-default.json   no --turns flag, proves the default
data/verification/horizon/run-caplow.log     gd-caplow.json    --turns 12, the warning shown RED
data/verification/horizon/replay-syrupbomb.txt                 the pool game, both engines, every line
data/verification/horizon/status.txt                           the gate as it stands
tests/probe_syrupbomb_source_faint.js                          the probe
```
