# ARMOR TAIL AND THE MOVER'S OWN ALLY — THE REFUSAL WAS INNOCENT (2026-08-29, ENGINE)

**Verdict in four lines.**

- **What the refusal reads: the ACTION'S TARGET, and whether that body is in the mover's foe array.
  That is already what it should read** — in a double it is exactly the authority's
  `source.isAlly(armorTailHolder)`. **The defect is that the target field was a lie.** The Helping
  Hand in the carded game arrived through Encore's execution-time override, which draws a body out of
  `live(foes)` whatever the substituted move's target class says.
- **Why the Safeguard derivation missed it:** that derivation enumerated *decision handlers that
  receive a source*. This site is not a handler and has no source — it is a TARGET SELECTOR
  (`Battle#getRandomTarget`), a plain method with no `on…` name to enumerate. §3.
- **What would catch a fifth:** an engine-side census rather than an authority-side one. There are
  **22 live sites in `medicham2-browser.js` that hard-code `it.side==='A'?actB:actA`**, and nothing
  in this repository asks, per site, whether it is answering a SIDE question (correct) or a TARGET
  question (a candidate defect). §3.2 lists the four this pass classified and what the other 18 are.
- **Board-parted: 94 before, 94 after, of 961. PREDICTED, and stated before the run.** Two causes
  were removed and none appeared, and **both were NARRATION-ONLY with `board_parted: 0`** — so the
  board number could not have moved. Protocol diverged **213 → 211**.

Release `03e049dc7299` → **`6e7fff81fcec`**. Census **796 → 797 live / 797 probed / 0 missing**.
Probe: `tests/probe_default_target_side.js`, **12 arms, 6 red and 6 controls, all clear**.

---

## 1. C6 WAS RIGHT AND THIS IS A DIFFERENT CONDITION OF THE SAME ABILITY

The brief asked this to be settled before anything else. **Card C6's measurement stands.** Armor Tail
refuses a priority move on the foe axis, it does so today, and this pass measured it three ways:

| arm | what it stages | before | after |
|---|---|---|---|
| `foe-axis-bulletpunch` | a +1 Bullet Punch CLICKED straight into the Armor Tail side, two turns running | refused on both engines | refused on both engines |
| `encore-bulletpunch` | the same +1 arriving through the Encore override | refused on both engines | refused on both engines |
| `no-encore-helpinghand` | an ordinary CLICKED Helping Hand at one's own partner, twice | **agrees on both engines** | agrees |

**The third row is the whole finding.** A plain ally-aimed Helping Hand has never been refused by this
engine, on the shipping bytes, before any edit — so "Armor Tail refuses a priority move aimed at the
mover's own ally" is not true as a statement about the refusal. It is true only when something else
has already put a foe in the action's `target` field.

## 2. WHAT ACTUALLY PUT A FOE THERE

`sim/battle-actions.ts:233` — `target = this.battle.getRandomTarget(pokemon, baseMove)` — and
`Battle#getRandomTarget` (`sim/battle.ts:2487), read whole. **Champions overrides eight files and none
of them touches it; grepped, not recalled.** THE CLAUSE ORDER IS THE RULE:

```js
move = this.dex.moves.get(move);
if (['self', 'all', 'allySide', 'allyTeam', 'adjacentAllyOrSelf'].includes(move.target)) return pokemon;
else if (move.target === 'adjacentAlly') {
  if (this.gameType === 'singles') return null;
  const adjacentAllies = pokemon.adjacentAllies();
  return adjacentAllies.length ? this.sample(adjacentAllies) : null;
}
if (this.gameType === 'singles') return pokemon.side.foe.active[0];
...
return pokemon.side.randomFoe() || pokemon.side.foe.active[0];
```

The near-side classes are answered **before** it ever looks at a foe. Three sites in
`medicham2-browser.js` stand where this function stands and **all three began at the last line**:

| site | what it is | named `getRandomTarget` in its own comment? |
|---|---|---|
| `chooseAction`'s Encore branch | `_t = live[rng()*live.length]` — `live` is the FOES | no |
| WIRE 143, the execution-time override | `_etgt` drawn from `_elive = live(_efoes)` | **yes**, ROADMAP #478 |
| the called-move branch (Copycat / Metronome / Sleep Talk / Mirror Move) | `_caim` drawn from `_clive` | **yes**, ROADMAP #308 / #478 |

`Instruct`'s own fallback is deliberately **not** in this set: the authority reaches it through
`runMove(move.id, target, target.getLocOf(...))`, not through `getRandomTarget`, so it is a different
rule and is left alone.

**HOW BIG THE MIS-DRAW WAS, DERIVED OVER THE FORMAT AND PRINTED BEFORE ANYTHING WAS WIRED
(docs/LESSONS §4).** `targetClass.target` IS Showdown's own `move.target`, derived by `tag_dex` for all
500 legal moves:

```
adjacentAlly        4      adjacentAllyOrSelf  1      all      17
allySide            8      allyTeam            1      self     60      = 91 of 500
```

**Ninety-one of five hundred were drawn wrong, and only four can be SEEN from outside**, because
`playerAction` throws the aim away for the rest — Protect, Tailwind, Rain Dance and Wide Guard all
return a kind carrying no `target` at all. The four whose aim actually travels on the action are the
`adjacentAlly` chooseables: **helpinghand (7,842 uses, +5), coaching (1,510), dragoncheer (34),
aromaticmist (3)**. Helping Hand is the only one with priority of its own, which is exactly why a
priority refuser is the instrument that noticed.

**THE REFUSER FAMILY, DERIVED, NOT RECALLED.** `blocksMove {what:'priority'}` over the format's 316
legal abilities selects three, filtered `exists && !isNonstandard && tier !== 'Illegal'`:

```
armortail        Farigiraf      queenlymajesty   Tsareena      dazzling   NONE — zero legal carriers
```

Both live carriers are staged. **Dazzling cannot occur in this regulation and is not implemented, not
approximated and not staged.** Psychic Terrain is the fourth member of the family by effect and it is
already correct on this axis: its own `onTryHit` carries `if (target.isSemiInvulnerable() ||
target.isAlly(source)) return;` and `priorityRefusedAbove` reads it per TARGET, which is what WIRE 117
put there.

## 3. WHY THE SAFEGUARD DERIVATION MISSED THIS — THE BRIEF'S REAL QUESTION

The Safeguard pass (`docs/_reports/2026-08-29-safeguard-source-side.md` §2) widened its frame twice and
then asked, in its own words, *"which handlers RECEIVE A SOURCE"* — because a handler that is never
handed a source cannot be asked a near/far question. It found five, fixed one, and said plainly that a
fourth spelled differently would not be caught.

**It was spelled differently in a way that frame could not reach, and the reason is structural rather
than an oversight:**

| | C2 / C3 / Safeguard | this one |
|---|---|---|
| the authority's object | an `on…` handler on an ability or a side condition | a plain method on `Battle` |
| what it is asked | *may this effect land on this body?* | *which body should this move hit?* |
| does it receive a source | **yes** — that is the frame's own selector | **no** — it receives a POKEMON and a MOVE |
| what it reads to decide | the target's side against the holder's | the MOVE'S OWN TARGET CLASS |
| enumerable from the dex | yes: walk abilities/moves for handler names | **no**: it has no name to walk for |

**The three earlier sites are PREDICATES. This one is a SELECTOR.** A predicate that hard-codes the far
side refuses something it should allow. A selector that hard-codes the far side hands a correct
predicate a wrong body — and the predicate then does exactly the right thing with it, which is why the
symptom arrived wearing the predicate's name on a `|cant|` line.

**And that is the same failure this project has had before, in the other direction:** the enumeration
was over the AUTHORITY's shape. There is no authority-side artifact that would have listed
`getRandomTarget`, because the defect is not that Champions does something surprising — the defect is
that this engine never implemented a function the authority has.

### 3.2 WHAT WOULD CATCH A FIFTH — AN ENGINE-SIDE CENSUS, AND HERE IS ITS DENOMINATOR

The frame has to move from *the authority's handlers* to *this engine's sites*, because the invariant
being broken is this engine's, not the authority's: **a line that writes down the far side.**

Measured on the post-fix tree: **`it.side==='A'?actB:actA` appears at 22 live code sites** in
`engine/medicham2-browser.js` (24 matches, two of them inside comments). Nothing in this repository
asks, per site, which of two questions it is answering:

- **a SIDE question** — *"who are this body's opponents?"* — where hard-coding the far side is simply
  correct. The switch-trap verdict, the spread-target list and the screens read are all of this kind.
- **a TARGET question** — *"which body does this action address?"* — where the far side is an
  assumption and the answer belongs to the move's own target class.

This pass classified four of the twenty-two and moved three of them (the fourth, Instruct, was
classified as a different authority rule and left). **The remaining eighteen are unclassified, and
that is the honest state.** A gate would be an artifact mapping each site to the authority function it
implements; it does not exist, it is not built here, and building it inside a batch of one would be
exactly the bloat this division has been told not to add. It is FILED with its denominator so the next
pass starts from 22 and not from zero.

**What DOES exist after this pass, and is cheap:** one reader, `defaultTargetOf`, so a fourth caller
arrives with the near-side half already wired; a `MEDFAILS.defaultTargetClassUnknown` that names any
move whose class this engine cannot read rather than guessing "foe"; and a census row keyed on
`move / targetClass` rather than on any ability name, so the two live refusers and the four
`adjacentAlly` moves are all covered without one of them being spelled into the engine.

## 4. THE FIX

`engine/medicham2-browser.js`, one new reader and four call sites.

- **`defaultTargetOf(mon, mvId, allies, pick)`** — `getRandomTarget`'s clause order, with the class
  read off `targetClass.target`. `pick` is **the caller's own far-side draw and is only called on the
  far-side road**, so the addressed `midTargetDraw` stream is bit-identical for every move that was
  already resolved correctly. That is asserted, not assumed: the `encore-aurasphere` and
  `copycat-aurasphere` arms fail if a die moves. An `adjacentAlly` move takes **no die at all** —
  `sample()` over a doubles side is a draw of one.
- **The three draw sites** now route through it.
- **Two slot writes are now SIGNED.** `it.tgtSlot = _eact.target ? _efoes.indexOf(...) : -1` stamped
  `-1` for an ally-directed encored move, and `reaimToSlot` then re-aimed the `|move|` line at
  nothing — which is what the empty target field in the carded stream actually was. Both the Encore
  override and the spliced copied-move entry now write `tgtSlot` / `allySlot` as the C2 pass's
  redirection site already did.

Counters: `MEDSEEN.defaultTargetNearSide` (the branch fired), `MEDSEEN.defaultTargetNoAlly` (the
authority's own `return null`), `MEDFAILS.defaultTargetClassUnknown` + `…First` (must read 0),
`MEDFAILS.defaultTargetFoeOnlyRestored` (the knob stamp).

## 5. THE PROBE — `tests/probe_default_target_side.js`, SHOWN RED FIRST

Twelve arms, played on BOTH engines under the differential's own `middle` pin with the identical
script. **No expectation is typed:** Showdown's stream is the answer, and the file asserts only that
the two agree on four counted facts, that the knob parts the red arms, and that the controls do not
move under the knob. The four facts are deliberately COARSE — `cant` as *holder-side/ability*, a
single-turn mark as *side/label*, a boost as *side/stat/stage*, and the `|move|` line as
*move→side* — so an arm cannot fail on a spelling difference between the two narrators and cannot pass
while a body on the wrong half of the field takes the effect.

**RED FIRST, WITH THE READINGS.** The first run reported **12 failures across 12 arms**, and the
diagnostic lines are the whole diagnosis:

```
encore-helpinghand   sd  mark[p2/helpinghand p1/protect p2/helpinghand]  aim[… helpinghand->p2 …]
                     me  mark[p2/helpinghand p1/protect]                 aim[… helpinghand->none …]  cant[p1/armortail]
encore-hh-noguard    sd  aim[… helpinghand->p2 …]        (Sap Sipper in Armor Tail's place)
                     me  aim[… helpinghand->p1 …]        no refusal anywhere — only the SIDE is wrong
copycat-coaching     sd  boost[p2/atk1 p2/def1 p2/atk1 p2/def1]
                     me  boost[p2/atk1 p2/def1 p1/atk1 p1/def1]   — the +1/+1 landed on a FOE
```

**TWO FIXTURES WERE WRONG BEFORE THE ENGINE WAS, and the instrument caught both**, which is the
fifteen-times warning arriving on schedule:

- **The first Copycat arm used Helping Hand and agreed while testing nothing.** Helping Hand carries
  `failcopycat`; the copy never happened. Read off the format afterwards to confirm, but it was the
  arm's own mark count that showed it. Replaced with Coaching, which carries `metronome` and no
  `failcopycat`.
- **The first fixture had the victim's PARTNER clicking Protect, and every Helping Hand arm staged a
  FAILED Helping Hand.** `helpinghand.onTryHit` is
  `if (!target.newlySwitched && !this.queue.willMove(target)) return false;` — the ally must still be
  queued, and a +4 Protect takes it out of the queue before the victim's +5 resolves. The partner now
  clicks Swords Dance. **The authority's own mark count is what said so**, before any conclusion was
  drawn.
- **`encore-coaching` staged nothing on its first pass either** — the victim's turn-2 click was Protect
  at +4, so it left the queue before the +1 Encore landed, `willMove` returned null, and the authority
  bumped the duration instead of relocating. Changed to a priority-0 click.

**A `self`-WITH-PRIORITY ARM COULD NOT BE STAGED WITH PROTECT, AND IT IS SAID RATHER THAN GLOSSED.**
Encore forces the LAST move, so an Encored Protect requires two consecutive Protects, and the second
draws the stall die — which is card F2's open family and `probe_shield_refusal_line`'s remaining red.
Staging it there would have put someone else's defect inside this batch's evidence. The arm uses
**Follow Me** (+2, `self`, no stall counter) instead.

**THE TWELVE ARMS, AFTER THE FIX:**

| arm | kind | what it clears | clean | knob |
|---|---|---|---|---|
| `encore-helpinghand` | red | the carded shape, game 2653843264 t4 | agree | PART |
| `encore-helpinghand-mirror` | red | the sides exchanged whole | agree | PART |
| `encore-helpinghand-queenly` | red | the format's OTHER live refuser — the fix names neither | agree | PART |
| `encore-helpinghand-noguard` | red | the refusal removed; only the wrong SIDE is left | agree | PART |
| `encore-coaching` | red | the same draw with no priority anywhere near it — +1/+1 on a foe | agree | PART |
| `copycat-coaching` | red | the SECOND draw site, which is not Encore at all | agree | PART |
| `no-encore-helpinghand` | control | **the knob cleared explicitly — a plain click, never broken** | agree | agree |
| `foe-axis-bulletpunch` | control | card C6's own measurement | agree | agree |
| `encore-bulletpunch` | control | the foe axis through the same override | agree | agree |
| `encore-aurasphere` | control | the far-side draw at priority 0 — a moved die fails here | agree | agree |
| `copycat-aurasphere` | control | the called-move door on its far-side road | agree | agree |
| `encore-followme` | control | a `self` move: the near-side branch FIRES and nothing moves | agree | agree |

Per arm the file also asserts `moveNotOnRequest === 0`, the turn count against the script length, the
knob stamp absent-clean / present-on-knob, `defaultTargetClassUnknown === 0`, and
`defaultTargetNearSide` at an **exact** per-arm value (1 on the six near-side arms, 0 on the five
far-side ones) — so "the engines agree" cannot be read off a branch that never executed. Every species,
item, ability and move is checked against `Dex.forFormat('gen9championsvgc2026regmb')` **and the
learnset** before a game is played, and Armor Tail's own handler is READ at run time: the file refuses
to run if it stops testing `isAlly` and `priority`.

**THE CENSUS ROW**, `move / targetClass — a move SUBSTITUTED into an action takes its target from its
own target class`, three arms off one knob (the committed move's target class), staged through
`battleInit` + two real `battleTurn`s. `encoreAim(` is declared in the REALTURN list with its reason,
so the direct-call ratchet still reads 1. **Shown red under the knob without rewriting the artifact:**

```
knob off   ally {aimSide p2, marked true,  refused false}   foe0 {p1}   foeP {refused true}   -> LIVE
knob on    ally {aimSide NONE, marked false, refused true}  foe0 {p1}   foeP {refused true}   -> NOT LIVE
```

Note which clause reds it: the two aim SIDES differ on both loads (`NONE` vs `p1`), so that clause
alone would not have caught it. `marked` and `refused` are what carry the row.

## 6. WHICH SCOREBOARD, SAID BEFORE THE RUN

**Stated before the differential was launched:** *the lab must move — +1 census row and 6 red probe
arms. The pool should move by AT MOST 1 and may well not move at all: the defect needs a near-side move
SUBSTITUTED into an action, which is a narrow conjunction, and the artifact carries exactly one
first-divergence with this cause.*

**That is what happened.**

| | before (`03e049dc7299`) | after (`6e7fff81fcec`) |
|---|---|---|
| games / threw | 961 / 2 | 961 / 2 |
| **board-parted** | **94** | **94** |
| games the board never parted | 867 | 867 |
| protocol diverged | 213 | **211** |
| end-state SAME / DIFFERENT / ENDED-APART / THREW | 894 / 63 / 2 / 2 | 894 / 63 / 2 / 2 |
| distinct causes | 192 | **190** |
| class `unrelated event mismatch` | 36 | **35** |
| class `-fail: a different body` | 1 | **0** |
| `order_probe` rows | 2 | 2 |
| first-BOARD-divergence games | 40 | **the same 40, 0 in, 0 out** |

Pins, both arms: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`.
`arms_comparable.js` reads **COMPARABLE**. Same Showdown commit. After-artifact
`data/verification/game-differential.allytarget.json`. **`data/game-differential.json` was NOT written
— verified by mtime: still 2026-08-28 23:14:37.**

**TWO CAUSES REMOVED, NONE ADDED, and both are named:**

```
-1  unrelated event mismatch :: |-singleturn|p2b|helpinghand <> |cant|p1b|armortail|helpinghand
-1  -fail: a different body  :: |-fail|p1a|heal        <> |-fail|p2b|heal
```

The second was not on the card and is the same mechanism: a heal whose target class is near-side was
substituted into an action and this engine aimed it across the field, so the `-fail` named a body on
the wrong side.

**WHY THE BOARD COULD NOT HAVE MOVED, AND IT IS A FACT RATHER THAN A CONSOLATION.** Both removed
causes carry `materiality: NARRATION-ONLY` and `board_parted: 0` in the end-state table. A cause that
parted no board cannot lower a count of parted boards. This is the ranking Will called on 2026-08-23
behaving exactly as described: the lab moved, the pool did not, and it was said in advance.

**ONE GAME ROTATED THROUGH THE CAPPED `first_divergences` DUMP** (60 before, 60 after; the carded game
left, `…2659317806` entered). **It is not new breakage:** its cause
(`event missing from medicham2 :: |-unboost|p1a|def|1 <> |-heal|p1b|H/H|[from]leftovers`) is unchanged
in count between the two arms, and the cause-count diff above shows **no cause rose and no cause
appeared**. The list is a capped sample; the class table is the measurement.

## 7. FILED, NOT FIXED

- **ARMOR TAIL'S OTHER ROW IS STILL BOARD-MATERIAL AND IT IS A DIFFERENT DEFECT — THE OPPOSITE SIGN.**
  `|cant|p2b|armortail|bravebird <> |-damage|p2a|H/H`, 1 game, `BOARD-MATERIAL`, first board
  divergence turn 9, **unchanged by this pass**. Here the AUTHORITY refuses and we do not. Cause,
  measured rather than argued: **the priority-refusal gates read the STATIC move priority through
  `movePriority`, while `actionPriority` reads the ability-MODIFIED one.** The authority's
  `getActionSpeed` writes `action.move.priority = priority` for gen > 5, so `move.priority > 0.1`
  inside `armortail.onFoeTryMove` INCLUDES Gale Wings and Prankster. Staged on this engine before
  filing, both aims, on a board holding an Armor Tail Farigiraf:

  ```
  full-HP Gale Wings Talonflame, Brave Bird at the FARIGIRAF ITSELF   |-damage| 195 -> 105, LANDS
  the same click at the INCINEROAR standing beside it                 |-damage| 170 ->  68, LANDS
  ```

  Neither is refused, and the authority refuses both. Two implementations of one fact —
  `movePriority` and `actionPriority` — which is CLAUDE.md's "FACTS ARE GLOBAL" broken. **Its own
  batch.**
- **THE SAME GATE CANNOT SEE `move.target === 'all'` EITHER, AND THAT CLAUSE IS REACHABLE HERE.** The
  authority refuses an `all` move outright when its priority exceeds 0.1, excepting only
  `perishsong`, `flowershield` and `rototiller`. No legal move in this regulation is `all` at
  priority > 0.1 by itself — but **Prankster makes seventeen of them so**, including Rain Dance
  (1,429 uses), Sunny Day (1,145) and Haze (866). Not staged, not measured, named so it is not
  re-derived. Same batch as the row above; both are "what number does the gate compare".
- **`helpinghand.onTryHit`'s `willMove(target)` CLAUSE IS NOT IMPLEMENTED HERE.** Measured, not
  guessed: the first fixture staged a partner that had already acted, the authority failed the move
  and this engine marked it anyway. Routed out of the probe's arms deliberately so that somebody
  else's defect is not sitting inside this one's evidence. Its own batch.
- **EIGHTEEN OF THE TWENTY-TWO FAR-SIDE SITES ARE UNCLASSIFIED.** §3.2. Filed with its denominator.

---

## OWED, NOT RUN

- **`tools\lownode.cmd` COULD NOT BE INVOKED FROM THIS SHELL AND THE HEAVY RUN WAS PRIORITISED ANOTHER
  WAY. SAID PLAINLY BECAUSE IT IS A DEVIATION FROM A STANDING RULE.** `cmd.exe /c "…"` in this
  session's Bash tool drops its arguments entirely and opens an interactive prompt — reproduced three
  ways, including with `MSYS_NO_PATHCONV=1` and `//C`. The 961-game differential was therefore run as
  `Start-Process node … -PassThru -NoNewWindow` with `PriorityClass = 'BelowNormal'`, which is exactly
  what the .cmd sets, and its exit was waited on. **The lighter runs (the probe, the census, the
  regression sweep) were plain `node`.** Someone should check whether the wrapper is reachable from
  other sessions; if it is not, that is an OPS item and not this one.
- **THE THREE ROSTER STAGES AND `all_mechanics_fire.js` ARE STALE**, now against `6e7fff81fcec`.
  Carried forward from three previous passes, not created here — they last ran on `e129bca605e3` and
  `status.js` withholds them by name. Nothing in this pass is staged by either instrument except
  through the new census row.

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
    --turns 12 --release 6e7fff81fcec --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json --write
  ```

- **`tests/test-engine-diff.js` WAS NOT RUN, deliberately**: it has no `--out` and would republish
  `data/engine-diff.json`, the artifact the published `0 of 6,000` is read from. Nothing in this pass
  touches a damage path — the change decides WHICH body a substituted move names, above every damage
  step, and the probe asserts the far-side arms are line-identical. Expected to reproduce its
  pre-existing **rc=3 with `disagreed 0`** (the pool advisory for 9 undrawable species).
- **`data/team-pool-frozen`'s CACHE WAS REBUILT BY `probe_random_target_address.js`** during the
  regression sweep — it printed `pool cache MISS — rebuilding from the store` and
  `pool cache written: 8778 teams, pool digest f807cbc40299`. That is the probe's own designed
  behaviour and not this pass's edit, but the file moved and it is named so the churn in `git status`
  is not read as mine.

### THE FIVE PRE-EXISTING REDS — RE-RUN, ALL FIVE IDENTICAL, NONE INHERITED

| | brief's reading | this pass |
|---|---|---|
| `probe_shield_refusal_line` | 13 arms / 1 failing | **13 arms staged, 1 failing** — identical |
| `probe_random_target_address` | `sd=61 sites=62` | **`LENGTH MISMATCH sd=61 sites=62`** — identical |
| `test-resolution-order` | heap limit, rc 134 | **`FATAL ERROR: Reached heap limit`, rc 134** — identical |
| `test-engine-diff` | rc 3 with `disagreed 0` | not run, see above; unchanged by construction |
| `probe_instruct_shield` | 5 arms / 3 failing | **5 arms staged, 3 failing** — identical |

### THE REGRESSION SWEEP, GREEN

`probe_default_target_side` (12/12), `test-mechanics` (797/797/0, both ratchets held),
`probe_encore_bracket` (11/11), `probe_ally_wide_guard`, `probe_ally_lightning_rod`,
`probe_turn_order` (12 staged, 0 not matching), `probe_mega_priority`, `test-bracket-regain`,
`test-encore-fail-silent`, `test-precharge-order` (83/83), `test-engine-consistency`,
`probe_protect_stall`, `probe_protect_stage_order`, `probe_sound_lock_restart`,
`test-middle-stall-address`, `test-choice-lock`, `test-volatile-duration`, `test-rollout-effects`
(38/0), `test-protocol-trace`, `test-wiring`, `test-immunity-gate`, `test-middle-identity`.

### THE TURN CAP IS 12

Unchanged from every previous arm, and stated so the 94 is read as what it is: a divergence that would
first appear after turn 12 reads as narration here.
