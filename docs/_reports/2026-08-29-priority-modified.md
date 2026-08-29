# THE PRIORITY GATES COMPARED THE PRINTED NUMBER — GALE WINGS WAS ABSENT FROM ALL FIVE (2026-08-29, ENGINE)

**Verdict in five lines.**

- **THREE legal abilities modify a move's priority and one of them cannot occur.** `onModifyPriority`
  over the format's 316 legal abilities: **galewings** (Talonflame, one carrier), **prankster**
  (seven carriers), **triage** (ZERO legal carriers — not implemented, not approximated, not staged).
  **FIVE legal entities gate on the modified priority**, from a grep of every reader of
  `move.priority` in the mod and in mainline: armortail, queenlymajesty, quickguard, upperhand,
  psychicterrain — plus `dazzling`, which has zero legal carriers. **All five read the value the
  ability changed; this engine handed all five the printed constant.**
- **`move.target === 'all'` IS A SECOND THING AND IT IS NOT A DEFECT — THE CARD RECORDED THE CLAUSE
  BACKWARDS.** The authority **EXEMPTS** `all` and `foeSide` outright and refuses only three named
  moves; of those three only `perishsong` is legal here and **no legal Prankster carrier learns it**,
  so the refusing branch **cannot occur in this regulation**. Nothing was wired for it. §3.
- **Board-parted 94 → 93 of 961. PREDICTED, and the point estimate was stated before the run.**
  Protocol 211 → 208, DIFFERENT-END-STATE 63 → 62, distinct causes 190 → 187.
- **THE PRIORITY HALF WAS ISOLATED ON IDENTICAL BYTES.** A third arm, same release and one env var
  (`MEDI_PRIORITY_GATE_STATIC=1`), moves **exactly one cause and adds none**: the carded
  `|cant|p2b|armortail|bravebird <> |-damage|p2a|H/H`. §6.
- Release `6e7fff81fcec` → **`eb6a797411cd`**. Census **797 → 798 live / 798 probed / 0 missing**.
  Probe: `tests/probe_priority_modified.js`, **14 arms, 7 red and 7 controls, all clear**; shown RED
  FIRST on the shipping bytes at **15 failures across 14 arms**.

---

## 1. THE AUTHORITY, READ WHOLE

`Battle#getActionSpeed` (`sim/battle.ts:2639-2645`). Champions overrides eight files — `abilities`,
`moves`, `items`, `conditions`, `learnsets`, `rulesets`, `formats-data`, `scripts` — and **none of
them touches this function or any of the five gates. Grepped, not recalled.**

```js
let priority = this.dex.moves.get(move.id).priority;
priority = this.singleEvent('ModifyPriority', move, null, action.pokemon, target, null, priority);
priority = this.runEvent('ModifyPriority', action.pokemon, target, move, priority);
action.priority = priority + action.fractionalPriority;
if (this.gen > 5) action.move.priority = priority;          // <-- the last line is the whole defect
```

The MODIFIED number is written onto the move object. The FRACTIONAL term is not. **That is exactly
why every gate compares against `0.1` and not `0`** — an ability boost counts and Quick Claw and
Custap Berry, which are fractional, must not. `comparePriority` (`sim/battle.ts:404`) then sorts
order ASC, priority DESC, speed DESC on that same modified number.

**THE MODIFIERS, DERIVED OVER THE FORMAT AND PRINTED BEFORE A BYTE MOVED** (docs/LESSONS §4). Legal
abilities carrying `onModifyPriority`, filtered `exists && !isNonstandard && tier !== 'Illegal'`:

```
galewings   Talonflame                                                                 1 carrier
prankster   Sableye, Banette-Mega, Liepard, Whimsicott, Meowstic, Klefki, Grimmsnarl    7
triage      NONE — zero legal carriers, cannot occur, not implemented, not staged       0
```

`onFractionalPriority` (myceliummight — zero carriers; quickdraw — Slowbro-Galar; stall — Sableye) is
**deliberately excluded from this function**, because the authority adds it to `action.priority` and
never to `action.move.priority`. A gate that counted it would refuse a Quick Draw body's ordinary
attack.

**THE GATES, from a grep of every reader of `move.priority`:**

| gate | source | what it reads | legal carriers |
|---|---|---|---|
| `armortail` | `data/abilities.ts:223` | `move.priority > 0.1` | Farigiraf |
| `queenlymajesty` | `data/abilities.ts:3714` | byte-identical but for the `cant` name | Tsareena |
| `dazzling` | `data/abilities.ts:862` | the same again | **NONE — cannot occur** |
| `quickguard` | `data/moves.ts:14509` | `move.priority <= 0.1` → return | the move |
| `upperhand` | `data/moves.ts:20193` | **the TARGET's queued move**, not the user's | the move |
| `psychicterrain` | `data/moves.ts:14119` | `effect.priority <= 0.1` → return | the move (psychicsurge has **zero** carriers) |

## 2. WHAT WAS WRONG HERE — TWO IMPLEMENTATIONS OF ONE FACT

CLAUDE.md's **FACTS ARE GLOBAL** broken, in the exact shape the file names. `actionPriority` read the
modification off the `priorityMod` tag. The gates read `movePriority` — the printed constant — plus
an ad-hoc term:

```js
const _pk = (a.kind === 'attack' ? 0 : (isPrankster(m) ? 1 : 0));
```

Two consequences, and only one of them was on the card:

- **GALE WINGS WAS ABSENT FROM EVERY GATE, ON BOTH ROADS.** On the attack road the term is
  hard-coded 0; on the status road it asks for Prankster by name. A full-HP Talonflame's Brave Bird
  is +1 upstream and was 0 here.
- **THE TERM IS KEYED ON THE ACTION KIND, NOT THE MOVE'S CATEGORY** — the same two-move confusion
  `actionPriority`'s own 2026-08-29 note describes one field over.

And one comment asserted a thing the code did not do. Beside Upper Hand's read of its target's move:

> *"the target's own priority comes from `movePriority`, the same reader the turn sort uses — so a
> Prankster or Gale Wings boost that Showdown counts is counted here too, which is exactly why the
> authority's constant is 0.1 rather than 0."*

It was not counted. `movePriority` is the printed constant, `actionPriority` is the reader the sort
uses, and they were different functions.

## 3. `move.target === 'all'` — THE BRIEF'S SECOND QUESTION, ANSWERED

**It is not the same fix, and it is not a second fix either: it is not a defect in this regulation.**
The card in `docs/_reports/2026-08-29-armor-tail-ally.md` filed it as *"the authority refuses an `all`
move outright above priority 0.1, excepting only perishsong, flowershield and rototiller"*. **The
handler says the opposite**, and the clause ORDER is the rule:

```js
const targetAllExceptions = ['perishsong', 'flowershield', 'rototiller'];
if (move.target === 'foeSide' || (move.target === 'all' && !targetAllExceptions.includes(move.id))) {
  return;                       // EXEMPT — no refusal, whatever the priority
}
```

`all` and `foeSide` are **EXEMPT**. Only the three named moves fall through, and there the second
condition's `|| move.target === 'all'` makes the ally test moot. Derived over the format:

| | |
|---|---|
| legal moves with `target: 'all'` | **17**, every one of them Status, so Prankster reaches all 17 |
| of the three exceptions, legal here | **perishsong** only (flowershield and rototiller are `isNonstandard: 'Past'`) |
| legal Prankster carriers that learn perishsong | **NONE** |
| legal Flying-type `all` moves (Gale Wings) | **NONE** |

**So the refusing branch of the `all` clause cannot be reached in this regulation, and nothing was
wired for it** — a mechanic is not open work until a probe fails on it, and no probe can be made to
fail here.

**WHAT CAN OCCUR IS THE OTHER DIRECTION, AND IT IS MEASURED RATHER THAN ARGUED.** A gate that starts
reading a bigger number could begin refusing an exempt class. Asked of this engine's own action
builder for all 21 legal `all` / `foeSide` moves:

```
weather 4   terrain 4   room 2   hazard 4   trickroom 1   haze 1   fieldpseudo 1
gravity 1   perish 1    teatime 1                          -> carry NO target at all
chillyreception                                            -> {kind:'switch'} and it DOES carry a foe
```

Twenty of twenty-one carry no target, so the gate's `a.target && foes.indexOf(a.target) >= 0` scope
never fires and this engine is **accidentally right**. `chillyreception` is the one structural
exposure and it has **no legal Prankster carrier and is not Flying**, so it cannot be reached either.
Arm `prankster-sunnyday` is the control that says the exempt class did not start being refused.

## 4. THE FIX — ONE READER, ONE GATE HELPER, SEVEN CALL SITES

`engine/medicham2-browser.js`.

- **`abilityPriorityShift(mon, moveId, isAtk)`** — the body of `actionPriority`'s `_pmOf` closure,
  lifted to module scope verbatim. `actionPriority` now calls it, so the SORT and the GATES cannot
  answer differently. `isAtk` is optional and is derived from the move's own `statusCategory` tag
  when a caller does not supply it; `actionPriority`'s branches still pass their own, which keeps the
  sort **bit-identical**.
- **`gatePriority(mon, moveId, field, legacyShift)`** — the number every gate compares, and the one
  place the knob lives. `legacyShift` is the term the SITE used to add (0 for the five that added
  nothing, the ad-hoc Prankster term for the two that did), so the knob restores **each site
  exactly** rather than some common ancestor no site ever had.
- **`mon` IS THE BODY WHOSE ABILITY OWNS THE MOVE, WHICH IS NOT ALWAYS THE MOVER.** Upper Hand reads
  its TARGET's queued move, so that site passes the target.

The seven sites: the WIRE 85 pre-dispatch bar, its Quick Guard door, the attack branch's bar, Upper
Hand's read of its target, the ally-side guard (both arms of `GUARD_FOE_SIDE_ONLY`), the foe-side
spread guard, `foeThreatensGuardClass` in the chooser, and `clickFragility`.

**`clickFragility` IS DECLARED, NOT AVOIDED.** It is one of the six exports board.js reaches this
engine through and it feeds `benchRisk`, so **the fitted vector is owed a refit at the next release
cut** — the normal ENGINE→MAG edge that the WIRE 3 note beside it already declares for itself. The
membership is one species: Gale Wings has one legal carrier and Prankster cannot reach that line at
all, because `clickFragility` is only ever asked about a damaging click.

### 4.1 AND ONE NARRATION GAP THE FIX MADE THE PROBE TRIP OVER

`psychicterrain`'s refusal **emitted nothing at all**. The `|cant|` narration looked for a live foe
carrying a priority-refusing ABILITY and the terrain has no holder, so the branch fell off the end.
That was **pre-existing and already reachable** (any printed-priority move under the terrain), and it
is fixed here rather than filed because the probe's terrain arm is red without it and a red test is
not a status.

- `priorityRefusedAbove` gained an **optional fourth out-param** `why`, filled
  `{by:'ability'|'terrain', holder, bodies}`. The three-argument shape is unchanged, which is what
  keeps board.js's feature read out of it. The terrain claims the bar **strictly below** the ability,
  which is the authority's own order: `onFoeTryMove` runs inside `runEvent('TryMove')`, one step of
  `useMoveInner` above the per-target `onTryHit` the terrain hangs on.
- `TR.terrainAct(body, terrain)` emits `|-activate|BODY|move: Psychic Terrain` through `sdTerrain`,
  the same map `terrainStart` spells the `-fieldstart` with, so the label cannot drift.
- **A refusal that narrates nothing is now LOUD**: `MEDFAILS.priorityRefusedSilently` + `…First`,
  asserted at exact zero by the probe on every arm.

Counters: `MEDSEEN.priorityGateAbilityShift` (a gate read a non-zero shift — asserted at an exact
per-arm value), `MEDSEEN.priorityRefusedByTerrain`, `MEDFAILS.priorityShiftCategoryUnknown` + `…First`
(a status-class shift asked with neither a move id nor a category — must read 0),
`MEDFAILS.priorityRefusedSilently` + `…First`, `MEDFAILS.priorityGateStaticRestored` (the knob stamp).

## 5. THE PROBE — `tests/probe_priority_modified.js`, SHOWN RED FIRST

Fourteen arms on both engines under the differential's own `middle` pin with the identical script.
**No expectation is typed**: Showdown's stream is the answer and the file asserts only that the two
agree on **seven** counted facts (`cant`, `-damage`/`-heal` **with the HP fraction**, `-activate`,
`-boost`/`-unboost`, `-fail`, `-status`, and the `|move|` line's aimed SIDE), that the knob parts the
reds, and that the controls do not move under it. The damage fact is there deliberately: this defect
is board-material and a probe comparing only narration could not say so.

**RED FIRST, ON THE SHIPPING BYTES (the engine change stashed), WITH THE READINGS — 15 failures
across 14 arms:**

```
galewings-at-refuser   sd cant[p1/armortail]                          aim[… bravebird->none …]
                       me dmg[p1/84/195  p2/116/153]                  aim[… bravebird->p1 …]
galewings-upperhand    sd cant[p2/flinch] dmg[p2/123/153]             aim[… upperhand->p2]
                       me dmg[p1/34/145 p2/116/153] fail[p1]          aim[… upperhand->none bravebird->p1]
galewings-quickguard   sd act[p1/quickguard]
                       me dmg[p1/34/145 p2/116/153]
>> NO ARM EVER READ A NON-ZERO ABILITY SHIFT — the branch under test never executed.
```

**THE FOURTEEN ARMS, AFTER THE FIX:**

| arm | kind | what it clears | clean | knob |
|---|---|---|---|---|
| `galewings-at-refuser` | red | the carded row, a +1 Brave Bird into the Farigiraf | agree | PART |
| `galewings-at-partner` | red | the same click at the holder's PARTNER — `source.isAlly` | agree | PART |
| `galewings-queenly` | red | the format's other live refuser; the fix names neither | agree | PART |
| `galewings-featherdance` | red | Gale Wings on a Flying **STATUS** move | agree | PART |
| `galewings-quickguard` | red | the second gate — a side condition, not an ability | agree | PART |
| `galewings-upperhand` | red | the third gate, and the only one reading somebody ELSE's move | agree | PART |
| `galewings-psychicterrain` | red | the fourth gate, plus its silent refusal | agree | PART |
| `nogalewings-bravebird` | control | **the knob cleared explicitly — the ABILITY ABSENT, so modified and static coincide** | agree | agree |
| `galewings-damaged` | control | the CONDITION: the same body one HP below full | agree | agree |
| `prankster-thunderwave` | control | the half that was already right, and must not be lost | agree | agree |
| `prankster-sunnyday` | control | the `target:'all'` class the authority exempts | agree | agree |
| `galewings-tailwind` | control | a +1 Gale Wings move aimed at the NEAR side | agree | agree |
| `upperhand-vs-status` | control | Upper Hand's **other** clause — `category === 'Status'` still fails it | agree | agree |
| `quickguard-priority0` | control | the guard's own floor at priority 0 | agree | agree |

Per arm the file also asserts `moveNotOnRequest === 0`, the turn count against the script length, the
knob stamp absent-clean / present-on-knob, `priorityShiftCategoryUnknown === 0`,
`priorityModUnknownCond === 0` and `priorityRefusedSilently === 0`; and it fails the whole run if **no
arm ever read a non-zero shift**, so "the engines agree" cannot be read off a branch that never
executed. Every species, item, ability and move is checked against
`Dex.forFormat('gen9championsvgc2026regmb')` **and the learnset** before a game is played, the
membership above is PRINTED on every run, and all five gate handlers are **read out of the format at
run time** — the file refuses to report a pass if one of them stops comparing a priority.

**ONE FIXTURE WAS WRONG BEFORE THE ENGINE WAS AND THE INSTRUMENT CAUGHT IT.** The first `at-partner`,
`queenly` and `psychicterrain` arms had the victim standing behind a Protect, so the divergence read
`cant` vs `-activate|protect` and was NARRATION-ONLY while claiming to be board-material. All three
now click a real move and the arm carries an HP number. Also checked and not assumed: Klefki does
**not** learn Charm, so the Prankster control is Thunder Wave.

**THE CENSUS ROW**, `ability / priorityMod — a priority-refusing gate compares the ABILITY-MODIFIED
priority, not the printed one`, three arms off one board through `battleInit` + a real `battleTurn`.
`priorityGateRun(` is declared in the REALTURN list, so the direct-call ratchet still reads 1. **Shown
red under the knob without rewriting the artifact:**

```
knob on    full-HP Gale Wings  refused false / landed true
           Flame Body          refused false / landed true      -> 797 live, 1 missing
           one HP below full   refused false / landed true         IDENTICAL ACROSS A VARIED KNOB
knob off   full-HP Gale Wings  refused TRUE  / landed false
           Flame Body          refused false / landed true      -> 798 live, 0 missing
           one HP below full   refused false / landed true
```

The two knobs are the two halves of the authority's own condition
(`move?.type === "Flying" && pokemon.hp === pokemon.maxhp`): the ability is traded for Talonflame's
OWN other ability (Flame Body, inert here — nothing on the board makes contact with it), and the
condition arm takes **exactly one point** off, so nothing separates it from the arm above but
`hp === maxhp`.

## 6. WHICH SCOREBOARD, SAID BEFORE THE RUN

**Stated before the differential was launched:** *the lab must move — +1 census row and 7 red probe
arms. The pool SHOULD move, and by a small amount: board-parted **93 or 94**, point estimate **93**,
because the artifact carries exactly one first-board-divergence with this cause and Gale Wings has one
legal carrier. Protocol 211 → 208–211.*

**Board-parted 93. Protocol 208. The prediction held at its point estimate.**

| | before `6e7fff81fcec` | after **`eb6a797411cd`** |
|---|---|---|
| games / threw | 961 / 2 | 961 / 2 |
| **board-parted** | **94** | **93** |
| games the board never parted | 867 | **868** |
| protocol diverged | 211 | **208** |
| end-state SAME / DIFFERENT / ENDED-APART / THREW | 894 / 63 / 2 / 2 | **895 / 62** / 2 / 2 |
| distinct causes | 190 | **187** |
| class `event missing from medicham2` | 54 | **51** |
| class `unrelated event mismatch` | 35 | **34** |
| class `-damage field 3` | 17 | **18** |
| `order_probe` rows | 2 | 2 |
| `mid_void.void_games` / `errors` | 9 / 2 | 9 / 2 |

Pins, both arms: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`.
`arms_comparable.js` reads **COMPARABLE**. Same Showdown commit
(`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`). After-artifact
`data/verification/game-differential.prioritymod.json`. **`data/game-differential.json` was NOT
written — verified by mtime twice: still 2026-08-28 23:14:37.**

**FOUR CAUSES REMOVED, ONE ADDED, AND ALL FIVE ARE ATTRIBUTED TO A HALF OF THE CHANGE BY A THIRD ARM
ON IDENTICAL BYTES.** `MEDI_PRIORITY_GATE_STATIC=1`, same release, same pins, one env var —
`data/verification/game-differential.prioritymod-knob.json`:

```
THE PRIORITY HALF ALONE (knob-on -> knob-off, identical bytes)
  board-parted 94 -> 93   protocol 209 -> 208   end-state 894/63 -> 895/62   causes 188 -> 187
  -1  unrelated event mismatch :: |cant|p2b|armortail|bravebird <> |-damage|p2a|H/H
  NOTHING ELSE MOVED. No cause rose, no cause appeared.

THE NARRATION HALF ALONE (previous release -> knob-on arm)
  board-parted 94 -> 94   protocol 211 -> 209   end-state 894/63 -> 894/63   causes 190 -> 188
  -1  event missing from medicham2 :: |-activate|p1a|psychicterrain <> |move|p2b|rockslide
  -1  event missing from medicham2 :: |-activate|p1a|psychicterrain <> |move|p2b|raindance
  -1  event missing from medicham2 :: |-activate|p2a|psychicterrain <> |move|p2a|expandingforce
  +1  -damage field 3 :: |-damage|p1a:archaludon|84/165 vs |-damage|p1a:archaludon|57/165
```

**THE ONE ADDED CAUSE BELONGS TO THE NARRATION HALF, AND IT COST NO BOARD.** Across that half
board-parted is **unmoved at 94** and the end-state verdicts are **byte-identical** (894 / 63 / 2 / 2),
so no board that agreed was parted by it. Its shape is the one this repository has recorded before
(ROADMAP #81 WIRE 9's rung): a stream that was MISSING a line could not be compared past it, and
emitting the line lets the comparison continue into a divergence that was already there. It is **one
game, n=1, in a class that already had 17** — and it is named here rather than smoothed over, because
"no cause rose and none appeared" is the standard this division holds and this run does not quite meet
it.

**ONE ROTATION THROUGH THE CAPPED `first_divergences` DUMP** (60 before, 60 after). Two left — both of
the fixed psychicterrain games. Two entered, and neither is new breakage: their causes
(`medicham2 stopped emitting … |-enditem|p2b|sitrusberry|[eat]` and
`unrelated event mismatch :: |-fail|p1a <> |-fieldactivate|perishsong`) are **unchanged in count**
between the arms. The list is a capped sample; the class table is the measurement.

## 7. FILED, NOT FIXED

- **`move.target === 'all'` AND `foeSide` ARE NOT WIRED, AND THE REASON IS THAT THEY CANNOT BE SHOWN
  RED.** §3. The engine is accidentally right because twenty of the twenty-one legal moves in those
  classes build an action with no target at all. **`chillyreception` is the one that does carry a
  foe** and it has no legal Prankster or Gale Wings carrier. If a future regulation gives a Prankster
  body Perish Song, Chilly Reception or a hazard, this gate needs the authority's target-class
  exemption and does not have it. Filed with its derivation so it is not re-derived.
- **THE `benchRisk` REFIT.** `clickFragility` now reads the modified priority. One species is
  affected. Declared in §4; it is the normal ENGINE→MAG edge and belongs to MEASURE.
- **`helpinghand.onTryHit`'s `willMove(target)` CLAUSE IS STILL NOT IMPLEMENTED HERE** — carried
  forward from the previous pass, untouched, and deliberately routed out of these arms.
- **EIGHTEEN OF THE TWENTY-TWO FAR-SIDE SITES REMAIN UNCLASSIFIED** — carried forward, untouched.

---

## OWED, NOT RUN

- **`tools\lownode.cmd` IS REACHABLE FROM THIS SHELL AND THE PREVIOUS PASS'S NOTE CAN BE CLOSED —
  BUT ONLY WITH THE ARGUMENTS OUTSIDE THE QUOTES.** Reproduced here: `cmd.exe /c "tools\lownode.cmd
  -e ..."` drops everything and opens an interactive prompt, exactly as reported; and
  `cmd.exe /c tools/lownode.cmd …` fails with *"'tools' is not recognized"*. What works is
  **`MSYS2_ARG_CONV_EXCL='*' cmd.exe /c "tools\\lownode.cmd" <args…>`** — the .cmd path as its own
  quoted argument, the rest bare. `tests/test-lownode.js` was run through it first (4 passed,
  including the exit-code clause), and **all three 961-game differential arms ran through it at
  BelowNormal.** This is the tenth recorded variant of a command that succeeds having done nothing;
  the discriminator is that the wrapper's own test passes through the same invocation.
- **THE THREE ROSTER STAGES AND `all_mechanics_fire.js` ARE STALE**, now against `eb6a797411cd`.
  Carried forward from four previous passes, not created here; `status.js` withholds them by name.

  ```bash
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage items      --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage abilities  --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage moves      --write
  SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --write
  ```

- **`data/game-differential.json` — THE COVERAGE ARM — WAS NOT RE-RUN.** Expected unchanged:
  **961 games / 6 raw / 6 declared / 0 that count**.

  ```bash
  SHOWDOWN_PATH=... node engine/game_differential.js --end-state --arm middle --games 1200 \
    --turns 12 --release eb6a797411cd --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json --write
  ```

- **`tests/test-engine-diff.js` WAS NOT RUN, deliberately**: it has no `--out` and would republish
  `data/engine-diff.json`, the artifact the published `0 of 6,000` is read from. Nothing in this pass
  touches a damage path — the change decides WHETHER a move is refused, above every damage step, and
  `clickFragility`'s edit is a FEATURE read that instrument never calls. Expected to reproduce its
  pre-existing **rc=3 with `disagreed 0`**.
- **`data/team-pool-frozen`'s CACHE WAS REBUILT BY `probe_random_target_address.js`** during the
  regression sweep, as it was in the previous pass. Its own designed behaviour, named so the churn is
  not read as this pass's edit.

### THE FIVE PRE-EXISTING REDS — RE-RUN, NONE INHERITED, NONE WORSE

| | brief's reading | this pass |
|---|---|---|
| `probe_shield_refusal_line` | 13 arms / 1 failing | **13 arms staged, 1 failing** — identical |
| `probe_random_target_address` | `sd=61 sites=62` | **`LENGTH MISMATCH sd=61 sites=62`** — identical |
| `test-resolution-order` | heap limit rc 134 | **`FATAL ERROR: Reached heap limit`, rc 134** — identical |
| `test-engine-diff` | rc 3 with `disagreed 0` | not run, see above; unchanged by construction |
| `probe_instruct_shield` | 5 arms / 3 failing | **5 arms staged, 3 failing** against release `eb6a797411cd` — identical. (It refuses to cut a release itself, so it must be handed the id: `node tests/probe_instruct_shield.js --release eb6a797411cd`.) |

**`test-resolution-order` IS ENGINE'S AND THIS WORK DOES NOT MAKE IT RUNNABLE.** Its failure is a V8
heap exhaustion inside the harness, not a question about priority; it dies before it compares
anything. It was not made worse and it was not made better.

### THE REGRESSION SWEEP, GREEN

`probe_priority_modified` (14/14), `test-mechanics` (798/798/0, both ratchets held),
`probe_default_target_side` (12/12), `probe_encore_bracket` (11/11), `probe_ally_wide_guard`,
`probe_ally_lightning_rod`, `probe_turn_order` (12 staged, 0 not matching), `probe_mega_priority`,
`probe_bracket_counters`, `probe_fractional_priority_draw`, `test-bracket-regain`,
`test-encore-fail-silent` (10 staged, 0 parted), `test-precharge-order` (83/83),
`test-engine-consistency`, `probe_protect_stall`, `probe_protect_stage_order`,
`probe_sound_lock_restart`, `test-middle-stall-address`, `test-choice-lock`, `test-volatile-duration`,
`test-rollout-effects` (38/0), `test-protocol-trace`, `test-wiring`, `test-immunity-gate`,
`test-middle-identity`.

### THE TURN CAP IS 12

Unchanged from every previous arm, and stated so the 93 is read as what it is: a divergence that would
first appear after turn 12 reads as narration here.
