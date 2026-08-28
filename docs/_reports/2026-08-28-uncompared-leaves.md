# The leaves in neither list — 2026-08-28, MEASURE

**43 of the 80 leaves a legal mechanic can write are in NEITHER the compared set nor `NOT_COMPARED`.**
Compared 33, declared 4, hole 43. Population: 500 legal moves, 201 abilities carried by a legal
species, 148 legal items — 964 entities walked, none sampled.

Print it, never quote this file:

```
node tests/probe_uncompared_leaves.js          # the split and the hole
node tests/probe_uncompared_leaves.js --json   # the same as data
```

---

## 1. HOW THE NUMBER IS DERIVED

`all_mechanics_fire.js` has computed "which leaves does this row write that the board does not read"
since 2026-08-19 — **per staged row**, and reported loudly only when the row came back
ANNOUNCEMENT-ONLY. So the class had never been asked as a class. This asks it over the whole
regulation.

The walk itself is unchanged and is now shared rather than duplicated: `writtenLeaves` and
`uncomparableLeavesOf` moved from `engine/all_mechanics_fire.js` into `engine/board_state.js`, which
is where the question belongs (it owns `SD_VOLATILE_KEYS`, the compared set, and `NOT_COMPARED`, the
declared set). **The move was proved behaviour-identical before it landed: 964 entities, 81 non-empty
answers, 0 disagreements against the pre-move implementation lifted from `git show HEAD:`.** Only the
dex lookup stayed in the caller.

`tests/probe_uncompared_leaves.js` was **shown RED on a deliberate break**: with `taunt` spliced out
of the comparator's key set the probe reports `COMPARED 32 … NEITHER 44` and prints
`volatile:taunt   1   3   yes   move:taunt`. It is a PROBE and not a gate on purpose — a gate
registered at 43 would be red on the day it was written, and "KNOWN FAILURE" is a banned phrase here.

**The declared half is now machine-readable, and that fixed two false clearances.** `NOT_COMPARED` is
prose; the first version of this enumeration string-matched the paragraphs and credited
`volatile:counter` to a row about the STATUS counter and `volatile:unburden` to a row that merely
names Unburden as a READER of item disposition. Two of seven "declared" leaves were not declared at
all. Every `NOT_COMPARED` row now carries a `leaves: [...]` array — `[]` where it declares none, which
is itself an answer — and the probe matches on that.

**A CROSS-CHECK FROM THE OTHER DIRECTION FOUND NOTHING NEW, WHICH IS THE POINT OF RUNNING IT.**
Derived independently off medicham2: 15 `_vol` keys the engine touches against the 14 `mediBody`
reads. The three unread ones — `lockon`, `minimize`, `noretreat` — are already in the 43, and the
other four (`yawn`, `attract`, `curse`, `healblock`) are the four declared rows. `substitute` is read
through `_sub`. The two derivations agree.

---

## 2. THE HOLE, SPLIT BY WHETHER IT IS ON THE BOARD WHEN THE BOARD IS READ

The comparator's boundary is **after the entire residual phase**. A condition the authority declares
`duration: 1` is decremented and ENDED there — `sim/battle.ts:1097-1115`, whose handler carries
`end: pokemon.removeVolatile` — so it cannot be standing when the board is taken.

| | count |
|---|---|
| hole, **no declared clock or a clock of 2+** — on the board at the boundary | **25** |
| hole, `duration: 1` — ended in the residual | 18 |

**THIS COLUMN IS EVIDENCE, NOT PROOF, AND THAT IS THE WHOLE DIFFERENCE.** A declared duration is what
the entry says. A condition with no declared clock may still be removed inside the turn by its own
move — `sparklingaria` is one, and its condition does not even resolve in the dex — and one with a
clock may have it rewritten in `onStart`. **What would make this split wrong: a staged boundary read
showing either engine holding a `duration: 1` volatile after the residual.** That read has not been
done and is owed.

### 2a. The 25 that are on the board

```
LEAF                          W   dur  ours   writers
pseudoWeather:gravity         1   5    field  move:gravity
pseudoWeather:magicroom       1   5    field  move:magicroom
pseudoWeather:wonderroom      1   5    field  move:wonderroom
slotCondition:futuremove      1   -    ?      move:futuresight
slotCondition:healingwish     1   -    ?      move:healingwish
slotCondition:wish            1   -    ?      move:wish
volatile:mustrecharge         6   2    named  move:blastburn frenzyplant gigaimpact hydrocannon +2
volatile:lockedmove           4   2    named  move:outrage petaldance ragingfury thrash
volatile:allyswitch           1   2    named  move:allyswitch
volatile:throatchop           1   2    named  move:throatchop
volatile:lockon               1   2    _vol   move:lockon
volatile:minimize             1   -    _vol   move:minimize
volatile:noretreat            1   -    _vol   move:noretreat
volatile:choicelock           1   -    ?      item:choicescarf
volatile:flashfire            1   -    ?      ability:flashfire
volatile:gastroacid           1   -    ?      move:gastroacid
volatile:smackdown            1   -    ?      move:smackdown
volatile:stockpile            1   -    ?      move:stockpile
volatile:powertrick           1   -    ?      move:powertrick
volatile:powershift           1   -    ?      move:powershift
volatile:dragoncheer          1   -    ?      move:dragoncheer
volatile:unburden             1   -    ?      ability:unburden
volatile:metronome            1   -    ?      item:metronome
volatile:fling                1   -    ?      move:fling
volatile:sparklingaria        1   -    ?      move:sparklingaria   (condition does not resolve)
```

`ours` is **structural, never a name grep** — a name grep for a renamed identifier was one of tonight's
instrument failures. `named` = medicham2 keys a reader under the authority's own name in
`RESIDUAL_SHADOW_VOL`; `_vol` = the generic `_vol[id] > 0` slot; `field` = `RESIDUAL_FOLLOWER_FIELD`;
`?` = **not visible to this derivation, which is not evidence of absence** — this engine keeps
`partiallytrapped` in `_trap`, the hard trap in `_trapHard` and the rampage lock in `_mtLock`, none of
which a `_vol` scan can see.

### 2b. The 18 with `duration: 1`

`flinch` (20 writers), `protect`, `detect`'s share of it, `banefulbunker`, `spikyshield`,
`kingsshield`, `endure`, `followme`, `ragepowder`, `helpinghand`, `beakblast`, `focuspunch`,
`counter`, `mirrorcoat`, `roost`, `electrify`, `chillyreception`, and the two side conditions
`quickguard` / `wideguard`.

---

## 3. THE TWO THAT PROMPTED THIS, CONFIRMED

- **`volatile:smackdown`** — in the hole. No declared clock, so it is on the board at the boundary.
  Any ANNOUNCEMENT-ONLY verdict resting on it was unearned, exactly as the agent that found it said.
- **`volatile:gastroacid`** — in the hole, no declared clock, and **medicham2 has no `_vol.gastroacid`
  and no named reader**. That row is blocked on the instrument AND possibly on the engine, and those
  are two different findings that must not be merged: wiring the leaf while our side holds nothing
  would part every board carrying a Gastro Acid and present an engine defect as a comparison leaf —
  which is precisely what the Destiny Bond row in `NOT_COMPARED` records paying for once already.

---

## 4. PROPOSALS

Nothing below was landed. The comparator was not widened in this pass, deliberately: board-material
is 0 of 961 and that zero is the achievement of the night.

### 4a. DECLARE — the `duration: 1` family (18 leaves)

**Reason:** the authority declares `duration: 1`; `residualEvent` ends it before the boundary
(`sim/battle.ts:1097-1115`). medicham2 makes the same statement for the two side conditions in its own
words at `medicham2-browser.js:20430` — *"duration:1 on both conditions — they never survive a turn"*.

**What would make it wrong:** an engine that FAILS to clear one. That is a real defect class, and this
declaration trades it away for zero manufactured divergence. **The counter-argument is Will's own
bench-volatile ruling** — *"the pokemon in the back need to be clean"* — where a leaf that catches
nothing today was wired anyway, because the authority supplies the zero BY CONSTRUCTION and our side
clears field by field only while somebody remembers the line. The same argument applies here almost
exactly: both sides read absent at the boundary, so the expected cost is zero and the leaf catches the
day one engine leaves a shield up.

**Recommendation: wire them, do not declare them** — but only after a measured before/after, because
"expected zero" is a prediction and this file's own history is that the small sample gives the
comfortable answer (the bench probe agreed on `item` over 156 bodies and disagreed twice over 2,029).

### 4b. COMPARE — the four the reader can already almost reach

`mustrecharge`, `lockedmove`, `allyswitch`, `throatchop`: 2+ turn clocks, on the board at the boundary,
and **medicham2 already keys a reader for each under the authority's own name** in
`RESIDUAL_SHADOW_VOL`, reached by `residualShadowVolPresent(id, m)` (`medicham2-browser.js:7621`).

`lockedmove` is the cheapest thing in this document: `mediBody` **already reads `_mtLock`**, gated to
`vol === 'uproar'`. Outrage, Petal Dance, Thrash and Raging Fury sit in the same field, uncompared and
undeclared, because the gate was written for Uproar.

**Cost:** a lock or a recharge that one engine drops early parts that board. That is a REAL defect if
it happens and a manufactured one if the two engines hold different quantities — so each needs its two
shapes PRINTED side by side first (`tests/probe_volatile_leaves.js` is the instrument), which is this
file's own standing rule and is why nothing here was wired tonight.

**Do it through the engine's own door, never a new map here.** `residualShadowVolPresent` is exported
by nothing today; exporting it and calling it is the same decision `board_state.js` already made for
`weatherId`, `terrainId`, `ppSpentMap` and `stallBoardCounter`. **What would make that wrong:** that
table was written for the residual-shadow question, so if it is ever narrowed to that walk's needs the
board leaf changes silently. The guard is that medicham2 already publishes
`MEDFAILS.residualShadowUnread` — the rows it cannot see — so the reader can refuse rather than answer
0.

### 4c. COMPARE — the three pseudo-weathers

`gravity`, `magicroom`, `wonderroom`, all `duration: 5`. `readMedi` already reads two of the five
pseudo-weathers off `S.field` (`trickroom_turns`, `fairylock_turns`) and medicham2's
`RESIDUAL_FOLLOWER_FIELD` names all five — `{trickroom:'tr', gravity:'gravity',
wonderroom:'wonderRoom', magicroom:'magicRoom', fairylock:'fairylock'}`. Three more lines.

**This is the one I would do first.** Magic Room is the subject of ROADMAP #462 — medicham2 implements
item suppression as a SWAP into `_roomItem`, and that fix was the last turn-1 board-material game in
the pinned pool. **The clock that decides when those four items come back is compared by nothing.**

**Cost:** any board where the two engines disagree on a room's remaining turns now parts. Unknown
until measured; the pinned pool is the place to measure it.

### 4d. COMPARE, but it is a new class — the three slot conditions

`wish`, `healingwish`, `futuremove`. `board_state.js` reads **no slot condition at all** — that is
stated inside `uncomparableLeavesOf` and appears in no declaration. A Wish that lands a turn late, on
the wrong body, or not at all is invisible to every board comparison in this repository. medicham2 appears to hold all three — `healDescriptorSet`, and its own note that
*"`slotConditions` still holds `healingwish`"* — but that is a NAME GREP and is not evidence;
the structural derivation cannot see them.

**Cost: the highest in this document, and it is a keying decision rather than a reader.** Showdown
keys `side.slotConditions[position]` by SLOT INDEX, and a position is not a promise — the same trap
`walkParty` records paying 123-of-179 games for. It needs the `stableKey` treatment before it is
wired.

### 4e. CANDIDATE — item disposition (`lastItem` / `ateBerry`)

**The declaration in `NOT_COMPARED` was justified by a false statement and is corrected in this pass.**
It read *"medicham2 has no `lastItem` and no `ateBerry`"*. It has both:
`medicham2-browser.js:8786-8787` writes them in `consumeBerry` and `:20425` says they deliberately
survive the turn reset. A declaration is only as good as its mechanism, and that mechanism did not
exist.

**And the two engines' write sites line up**, which was not knowable from the old text:
`sim/pokemon.ts:1805-1809` (`eatItem`) and `:1846` (`useItem`) write them, and **`takeItem`
(`:1856-1870`) — the Knock Off / Thief / Trick path — writes neither**, which is the same narrowing
medicham2 makes on purpose.

**Cost, and it is NOT zero:** it would part exactly the boards where the two engines disagree about
eaten-vs-taken, which is a PUBLISHED finding rather than a hypothesis
(`data/game-differential.json` `knock_off_roadmap_80`: Showdown records Colbur as EATEN BY ITSELF,
medicham2 as KNOCKED OFF). Measure before landing.

**What would make the new reason wrong:** a path in either engine writing the field on a REMOVAL
rather than a consumption. Falsified by a staged Knock Off with both fields printed side by side.

---

## 5. WHAT LANDED

- `engine/board_state.js` — the false `lastItem`/`ateBerry` reason corrected in place with the record
  of what it said; every `NOT_COMPARED` row given a machine-readable `leaves` array; `writtenLeaves`,
  `uncomparableLeavesOf` and `DECLARED_LEAVES` added and exported.
- `engine/all_mechanics_fire.js` — its copy of the walk deleted and replaced by a call. Behaviour
  proved identical over 964 entities. **CRLF preserved** (3613 CRLF / 3613 LF after; the file is
  wholly CRLF and `board_state.js` is wholly LF).
- `tests/probe_uncompared_leaves.js` — new, shown red on a deliberate break.

**The comparator was NOT widened. No board leaf changed, so no divergence count can have moved.**

---

## OWED, NOT RUN

- **`node engine/status.js --write`** — this pass was forbidden the game slot and the status tool.
  The generated blocks are unrestamped.
- **The boundary read that would turn the `duration: 1` column from evidence into proof.** 18 leaves
  rest on a declared duration, not on an observation.
- **Every proposal in §4.** None was wired and no before/after divergence count exists for any of
  them. `game_differential.js`, `all_mechanics_fire.js`, the roster stages and `quarantine.js` were
  all off limits to this agent.
- **`volatile:sparklingaria`** — its condition does not resolve through `dex.conditions.getByID`, so
  it carries no lifetime evidence at all. It is in the hole on the strength of the write alone.
- **The 18 `?` rows in §2a** — whether medicham2 holds anything for them is unknown to this
  derivation. `MEDFAILS.residualShadowUnread` is the number that would answer it and was not read on
  a live run.
- **`volatile:trapper`** is declared in `NOT_COMPARED` and is written by no legal mechanic's entry
  (Showdown adds it internally), so it does not appear in the 80. That is correct and is noted so the
  count of declared rows and the count of declared leaves are not confused for each other.
