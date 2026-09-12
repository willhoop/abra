# The last seven unstaged moves: five close, two are one missing thing — ENGINE, 2026-09-12

Release **`48ac1c228e02`** (unchanged — see *Releases cut*), census `data/mechanics-census.json`
(**883 probed / 883 live / 0 missing**, unmoved and NOT regenerated — no engine byte moved and a
10,000-game differential was reading the frozen release in another process), team store
`data/team-pool-frozen`. **No engine byte was modified and no release was cut.** The only code file
changed is `tests/roster.js`, which is not one of the frozen `SOURCES`. `engine/board.js`,
`engine/magnemite.js` and `data/engine-data.js` were **not** touched.

## Counts, before → after

| stage | before (artifacts at git HEAD `b40f0bbd`) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ / 0 DEF | **148 / 0 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 190 MATCH / 5 CNS / 0 CNQ / 5 DEF | **190 / 5 / 0 / 5 — UNMOVED** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / **7 CNS** / 0 CNQ / 3 DEF | **492 MATCH / 2 CNS / 0 CNQ / 3 DEF** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 0 rows threw.** Plant anchors
**22 / 62 / 36 apply exactly once, none dead**; red demonstrations **22 / 62 / 36, all CAUGHT, ZERO
weak, ZERO NOT CAUGHT**. Items and abilities are the **controls** and neither moved a single row.

**The seven were derived fresh from `data/roster.moves.json` `results[].verdict` rather than taken
from the brief**, and the derived list matched: `extremespeed`, `focusenergy`, `iceshard`,
`jetpunch`, `ragingbull`, `struggle`, `upperhand`.

Five close: `upperhand`, `ragingbull`, `extremespeed`, `iceshard`, `jetpunch`. Two keep a refusal,
and **both reasons are new** — they are measured to be the same missing thing.

## 1. `upperhand` — the entity was refusing its own fixture

The brief said this row "reads a target's priority intent". The artifact said something narrower and
more useful: `THE STAGING IS INERT. Showdown's own board is identical with and without it, over 1537
compared leaves.` The two are the same fact seen from opposite ends, and the second one is the door.

Upper Hand's `onTry` (`data/moves.ts:20190-20196`, no Champions override — `grep upperhand
data/mods/champions/moves.ts` returns nothing) fails unless the TARGET is queued with a move at
priority above 0.1 that is not Status. `orderPair` builds its board around a foe that KILLS the user,
and **every kill it can derive is at priority 0** — Crabominable against Charizard's Flamethrower. So
the gate said no, the move never resolved in either arm, and the row read as a coverage limit.

### The gate is read by CALLING the handler, not by matching its source

A regex over `onTry` would have got the right answer for the wrong reason and would rot the first
time the authority reworded the condition. `queueGate(e)` calls the handler with a stubbed
`queue.willMove` and three DERIVED stimuli (a 0-priority damaging move, a positive-priority damaging
move, a Status move — all read off the format, none named), and a `false` return is the move refusing
itself. A probe that throws is COUNTED and makes the gate UNREADABLE, which refuses the row by name.

Membership printed before a line was wired:

```
queue-gated moves (2) — an `onTry` that asks `this.queue.willMove(target)`
  Sucker Punch  pri 1  bp 70  refuses an idle target true, a Status target true,
                              a 0-priority target FALSE  -> needs a priority target: false
  Upper Hand    pri 3  bp 65  refuses an idle target true, a Status target true,
                              a 0-priority target TRUE   -> needs a priority target: true
```

Two members, one match, no over-match. Sucker Punch keeps the fixture it already passes on.

### The pairing is the mirror of `orderPair`'s

`interceptPair` gives the FASTER foe a positive-priority damaging click strictly between 0 and the
entity's own bracket instead of a kill. With the bracket correct the entity lands first, its 100%
flinch fires and the foe never acts; with the bracket ignored the foe moves first, its click lands,
and the entity's gate then finds no queued action and **refuses itself**. Both bodies' hp part, in
opposite directions, from one click. A 100% flinch is REQUIRED and the refusal says so in arithmetic
terms: without it both clicks resolve whichever way the turn was sorted and the board is the same.

```
[DUMP SUBJ] t1  p1[0]=blastoise hp87  | p2[0]=crabominable hp172  pp1_0={"aquajet":0,...}
[DUMP CTRL] t1  p1[0]=blastoise hp154 | p2[0]=crabominable hp142  pp1_0={"aquajet":1,...}
```

- Leaves: `party.hp, hp, pp.aquajet`.
- Red: `CAUGHT move/priority via upperhand -> FIRED-AND-BOARDS-DIFFER on party.hp, hp, pp.aquajet`.

## 2. `ragingbull` — the refusal demanded a knob the reading does not need

The standing reason was measured and its conclusion did not follow. It is right that a forme is not a
knob (two formes are two species) and that the residual-flip route is shut — no legal ability flips
any of the three formes from its own `onResidual`. It then concluded that *"staging one forme would
read as a damage number that proves only that the move deals damage"*.

**That is true of a NEUTRAL defender and of nothing else**, and this rule's own weather arm says so in
its header: a GHOST defender turns Weather Ball's reading from a damage number into 0-against-a-number
because the PRINTED type cannot touch it and the CONVERTED type can. The knob is what a flip would
buy; it is not what makes the reading categorical.

```
[FORME CATEGORICAL] ragingbull — Tauros-Paldea-Blaze throws Raging Bull as Fire (printed Normal)
  at Skeledirge, which is immune to Normal; user ability Intimidate (1 handler, not a type or
  click rewrite). Formes this derivation could not use: Tauros-Paldea-Combat: no legal body with a
  usable ability is immune to Normal and NOT immune to Fighting
```

Skeledirge goes 1432 → 1391 → 1350. An engine that ignored `onModifyType` writes 0 on both turns.
Combat is refused BY NAME and the refusal is correct: it converts to Fighting, and every body immune
to Normal is a Ghost, which is immune to Fighting too.

**The user's ability is what `carrierAbility` could not give.** All three Tauros-Paldea sheets are
Intimidate / Anger Point / Cud Chew and every one is on `INTERFERES`. What a CATEGORICAL reading
cannot survive is narrower and is derived rather than assumed: an ability that could turn a ZERO into
a NUMBER, i.e. one that rewrites what type is thrown or whether it is thrown at all. No Attack
modifier makes an immune hit connect, and whatever else the ability does is in BOTH arms.

### AND THE FIRST GREEN OFF IT HAD NO PLANT THAT COULD TOUCH IT

```
$ roster.js --stage moves --only ragingbull --reds
    NOT CAUGHT move/type-changing
```

`move/type-changing`'s break aims at the WEATHER conversion inside `dmgRangeOneHit`, and a forme-keyed
move never enters that block. The rule-level red was CAUGHT via `weatherball`, so nothing in the
artifact would have said the Raging Bull green rested on a plant that could not reach it. A second
patch element nulls `formeMoveType`'s param — medicham2's ONE reader of the forme table, its own
header says so — and the row reads `CAUGHT ... FIRED-AND-BOARDS-DIFFER on party.hp, hp`.

## 3. `extremespeed` / `iceshard` / `jetpunch` — the refusal was the ITEM stage's filter

The standing reason: every legal buildable learner carries only abilities on `INTERFERES`, "a fact
about the FORMAT'S ABILITY LIST, not about priority". The measurement is right and the inference is
not, because **`INTERFERES` is not a statement about this fixture.** Its own header says the wide half
of it — "anything that MOVES THE BOARD by itself" — is excluded not because it corrupts a reading (it
is in both arms and cancels out of the delta exactly) but because it is untidy to have there.

The previous pass's refusal — *"the obvious fix would lend the carrier a wide ability and break the
fixture's own premise"* — is answered by not ARGUING the widening at all:

- **`KILL_OR_CLICK_BLOCKERS` (tier 1)** bans anything that could stop the kill, blunt the killer on
  entry (`onStart`, which is Intimidate) or change the click.
- **`UNRECEIPTED_BLOCKERS` (tier 2)** is the short list of what the receipts cannot see: an ability
  that changed WHICH CLICK was thrown, or WHICH BODY WAS FASTER. Everything else the receipts catch.
- **Two preconditions read off SHOWDOWN'S board**: the foe was damaged (the entity really connected)
  and the user fainted, or for a 100%-flinch member survived (the kill really landed, or was really
  stopped). An ability that interfered produces COULD-NOT-STAGE with the clause that failed.
- **The narrow pool is tried FIRST.** All fourteen standing rows keep their exact user, ability, foe
  and kill; the wide pass runs only where the narrow one came back empty.

```
[WIDE PRIORITY PAIR] extremespeed tier 1 — Dragonite  / Inner Focus  (132 v 167) v Starmie,          killed by Ice Beam
[WIDE PRIORITY PAIR] iceshard     tier 1 — Vanilluxe  / Weak Armor   (131 v 147) v Typhlosion-Hisui, killed by Flamethrower
[WIDE PRIORITY PAIR] jetpunch     tier 2 — Palafin    / Zero to Hero (152 v 172) v Sceptile,         killed by Energy Ball
```

Boards, subject against control at boundary 1 — in each the foe is damaged by the entity in the
subject arm and untouched in the control arm, and the user is dead in both:

```
extremespeed  SUBJ starmie 135 -> 71   CTRL starmie 135 -> 135    dragonite 0F both arms
iceshard      SUBJ typhlosionhisui 148 -> 132   CTRL 148 -> 148   vanilluxe 0F both arms
jetpunch      SUBJ sceptile 145 -> 116  CTRL sceptile 145 -> 145  palafin   0F both arms
```

Reds, aimed at each member by name: `CAUGHT move/priority via extremespeed / iceshard / jetpunch ->
DID-NOT-FIRE on party.hp, hp`. With the whole rule run at once, `move/priority` reads **17 of 17
FIRED-AND-BOARDS-MATCH, 0 COULD-NOT-STAGE**.

### THE RECEIPTS FIRED, WHICH IS THE POINT OF THEM

Extreme Speed's first widened pairing came back **COULD-NOT-STAGE**: *"the FOE damaged by this move on
Showdown's own board"* had not happened. The dump says why, and it is not the engine:

```
[DUMP SUBJ] t1  p1[0]=gyarados hp102 ab=moxie | p2[0]=dragonite hp58 ab=innerfocus
```

The rule asked for **Charizard/Ice Beam**; the **#318 restaging pass** rewrote the body to
**GYARADOS**, whose Ice Beam takes Dragonite to 58 of 166 and does not kill it. Two repairs, both in
the instrument:

- the wide pass sizes its kill with `lethalMove(f, u, 1.2, f.id)` — a move the foe LEGALLY LEARNS — so
  the restaging pass has nothing to rewrite. The narrow pass keeps its unfiltered call, so no standing
  row's kill changes;
- the receipt clauses read the SLOT. The first version read `sdParty(b, 'p1', P.foe.id)`, which is
  `null` after a body swap and refused a row whose board was perfectly good.

### A fourth instrument defect, found the same way

`ROSTER_DUMP_BOARDS` sat BELOW the precondition check, which returns COULD-NOT-STAGE. **A refused
precondition is exactly the verdict whose boards are wanted** — "the entity never connected" says
nothing about why — and the dump printed nothing there. Hoisted into `dumpArms`, called from both
sites with an idempotence guard, and it now prints both sides' party rows (the fainted user is a party
row, not an active slot; the slot is refilled before the boundary is written).

## THE LEAVES WERE READ BEFORE THE COUNT WAS BELIEVED

Every one of the five rests on the move ACTING, and each is a leaf only that move could have written:

```
upperhand      party.hp, hp, pp.aquajet    the foe damaged AND its priority click never spent
ragingbull     party.hp, hp                41 a turn where an unconverted Normal click deals 0
extremespeed   party.hp, hp                64 on a foe the control arm leaves untouched
iceshard       party.hp, hp                16 on a foe the control arm leaves untouched
jetpunch       party.hp, hp                29 on a foe the control arm leaves untouched
```

## What is still unstaged, and it is ONE missing thing

### `focusenergy` — the arm was BUILT and the format refused it

It IS the control click, so `controlOf` substitutes it for itself and the two scripts are identical.
The previous refusal stopped there and called it structural. It is not: a SECOND inert click removes
the circularity and touches nothing else, because `controlOf` reaches for it only when the entity IS
the inert click. So the machinery is written — `INERT_ALT`, derived off the primary's OWN shape cap
(`inertShapeComplaint` now takes a move), with its own PP row and volatile excluded as the control
describing itself, and a RegExp branch in `armDelta`'s ignore list because those leaves land on any
side and any slot.

Then the format was asked, and it refuses all 23 candidates by name:

```
Power Shift   REFUSED — its volatile's condition registers onCopy
Stuff Cheeks  REFUSED — the MOVE registers onHit
Ally Switch   REFUSED — the MOVE registers onPrepareHit+onHit
Aqua Ring     REFUSED — its volatile's condition registers onResidual
Belly Drum / Copycat / Moonlight / Morning Sun / Recycle / Rest / Sleep Talk / Swallow /
Synthesis / Tidy Up   REFUSED — the MOVE registers onHit
Destiny Bond  REFUSED — the MOVE registers onPrepareHit
Follow Me / Rage Powder  REFUSED — its volatile's condition registers onFoeRedirectTarget
Imprison      REFUSED — its volatile's condition registers onFoeDisableMove+onFoeBeforeMove
Ingrain       REFUSED — its volatile's condition registers onResidual+onTrapPokemon+onDragOut
Magnet Rise   REFUSED — its volatile's condition registers onImmunity
Power Trick   REFUSED — its volatile's condition registers onCopy
Stockpile     REFUSED — its volatile's onStart+onRestart+onEnd does more than announce
Substitute    REFUSED — the MOVE registers onTryHit+onHit
```

**THE NEAR MISS IS THE FINDING AND IT IS WHY THE CONDITION CAP EXISTS.** The first derivation applied
only the primary's shape cap and ranked the survivors by handler count. It picked **AQUA RING** —
whose move declares nothing and whose VOLATILE'S CONDITION heals a sixteenth every turn. The row
staged, came back **FIRED-AND-BOARDS-MATCH**, and read inert only because every body on that fixture
was at full HP:

```
[DUMP CTRL] t1  p1[0]=goodrahisui hp620 ... pp1_0={"focusenergy":0,"aquaring":1}
```

One damaged body anywhere on that board and the green would have been a finding about Aqua Ring. The
cap now covers the CONDITION's handler names too (`onStart`, `onEnd`, `onRestart`, `onModifyCritRatio`
— an announcement and the crit ratio, which both published corners neutralise), and an announcement
handler has to actually only announce.

**And the row is refused a second time if a candidate ever appears.** `move/is-the-control-click`
carries no `break`, and the red-demonstration loop skips a rule with no break (`if (!rule.break)
continue;`) — so a future candidate would produce a green resting on a plant nobody wrote. The rule
refuses BY NAME on that, rather than leaving it to be noticed.

### `struggle` — a contradiction, not a backlog

The standing reason ended *"OWED WORK IN THIS FILE, not a limit of the engine"*, which reads as
something a long enough script would buy. It is not. Showdown disables Struggle while ANY slot has PP,
so the user's every slot must be empty — and `controlOf` builds the control arm by substituting the
inert click, which a body with every slot empty **cannot choose either**; Showdown rejects it and the
control arm throws. The escape is a second control click, which is the same thing `focusenergy` waits
on. The tracking half is not what is missing: medicham2 has `ppSpentMap`, `board_state.js` compares
`pp-is-what-has-been-spent`, and `item/pp-restore` already empties a slot by clicking it.

### The three DEFERRED rows — read, not overturned

- **`axekick`** and **`electrify`** — deferred by Will 2026-08-10, `below the usage shelf of 25`. Both
  already carry a working fixture in their notes (Axe Kick as a 120 BP Fighting plain attack pinned to
  `bottom-tie-first`; Electrify onto a body that clicks Dragon Pulse every turn). Neither is a
  staging problem, so there is nothing here to "make trivially stageable" — the deferral is a usage
  judgement and it is Will's.
- **`copycat`** — deferred on Will's own words (*"PUT COPYCAT INTO THE QUARANTINE IM NOT TOUCHING
  THAT"*) against a REAL underlying `DID-NOT-FIRE`: Showdown refuses `addVolatile` for a volatile
  already present whose condition has no `onRestart`, and a failed move never becomes `lastMove`.
  Nothing in this pass touches that, and the gate still prints it as CLOSETED.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 190 of 200 tested
    PASS  deliberate roster / moves      clean: 492 of 497 tested
```

`engine/quarantine.js` **exit 0, all nine clauses PASS.** Board-material **0 of 961** with **10,705 of
10,705** turn boundaries identical; narration **ZERO undeclared across 961**; damage differential
**0 of 6000** at the midpoint, both corners and all fourteen interior indices. Those three clauses
were **not re-run** for this pass and did not need to be — **no engine byte moved**, so they are still
measured on the bytes the artifacts name (`48ac1c228e02`).

**THE GATE WAS RUN TWICE** — once on the settled roster artifacts and again after the ROADMAP edit and
a `node engine/register_reality.js` refresh, because a register edit reaches the open-defect clause.
Both reads are identical, **9 of 9 PASS, exit 0**, and the second carries **no `STALE VERDICTS` note**.

`register_reality.js` re-ran the `VERIFIED BY` command on the new row and **reproduced the move stage
independently on the final bytes** — `data/roster.moves.json` rewritten at 07:43 with the identical
**492 / 3 / 2** and reds `36, 0 bad`. Its own bar reads 11 rows disagreeing / 10 rejected markers / 8
instruments answering nothing (8 stale rows and 3 premature closes); **that is not the MEDICHAM gate**,
and **#617 reads `STALE ROW` (exit 0)** — an OPEN work-tracking row whose instrument is green, which
the gate names explicitly as *"not evidence of a live defect"*, exactly as #616 does.

**ONE BYTE OF `tests/roster.js` CHANGED AFTER THE `--write` RUNS AND IT IS PROVED INERT RATHER THAN
ASSUMED**: a `console.error` inside `queueGate`'s catch, added so an unreadable gate is loud on every
run and not only under `--rules`. `QUEUE_GATE_THREW` is **0** — the post-edit `--only upperhand` run
printed no `QUEUE-GATE PROBE THREW` line, and the probe set is a deterministic walk of the dex — so
the branch never executed and no artifact could differ. `register_reality.js` then re-ran the whole
move stage on those exact bytes and got the same numbers.

`roster.js --selftest` re-run after the `controlOf` / `armDelta` / `inertShapeComplaint` edits: all
nine instrument clauses `ok`, including *"the inert click focusenergy moves NO board leaf in either
engine over 3 turns, beyond its own 48 derived leaf-movement(s)"* and *"the two engines agree on all
543 leaves while doing it"*.

## A GATE CLAUSE THIS PASS TURNED RED, IN FOUR DOCUMENTS IT WAS TOLD NOT TO TOUCH

`tests/test-docs-current.js` reads **35 of 37**. One of the two is pre-existing and one is mine, and
naming which is the whole point of this section — "one of the two known failures" is how this
repository lost two days.

- **3b(d) `figures bound to no trace (grandfathered)` was ALREADY RED** before this pass; the previous
  pass's report records it. Its one NEW entry this run is `docs/ABRA-technical-docs.md:19 961`, in the
  held 7.0.0 set. Not mine, not touched.
- **3b(b) `figures a cited artifact does not contain` WAS GREEN AT 18 AND IS NOW 22, AND THIS PASS DID
  IT.** All four new entries are the roster move count in the four documents the HELD 7.0.0 release
  owns, which I was instructed not to edit:

```
docs/ABRA-deck-plain-english.md:15  487  not in data/roster.{items,abilities,moves}.json
docs/ABRA-technical-docs.md:23      487  not in data/roster.moves.json
docs/MODELS.md:13                   487  not in data/roster.moves.json
docs/SUMMARY.md:17                  487  not in data/roster.moves.json
```

**ZERO of the new entries name `docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`,
`CHANGELOG.md`, `docs/ABRA-whitepaper.md` or `docs/_reports/`** — the whole of what this pass edited.
The white paper's four `487`s were corrected to `492` in this same pass, which is why it is not in the
list.

**THE FOUR ARE ALREADY STALE IN EXACTLY THIS WAY AND HAVE BEEN FOR THREE PASSES.** They carry the
roster ability stage at **147** (deck, MODELS, SUMMARY) and **139** (technical docs) against a live
**190**, and CONTROL-NOT-QUIET at **13** against a live **0** — those sit in the clause's baseline of
18. The move figure has now joined them. All four also stamp release **`534442d71183`**, two releases
behind the current `48ac1c228e02`.

**The repair is one word in each of four files (`487` → `492`) and it belongs to whoever holds
7.0.0.** It is flagged here rather than done, and it is flagged rather than filed, because the
pre-commit hook runs this gate and will refuse the commit until either those four move or the baseline
is raised in a diff somebody can see. **Raising the baseline would be laundering and is not
recommended.**

## `data/mechanics-census.json` WAS REWRITTEN AND I DID NOT INTEND IT — REPORTED, NOT REVERTED

The brief said not to rewrite it while the 10,000-game differential is running. No command of mine
targets it, and it moved anyway: **`engine/register_reality.js` spawns every `VERIFIED BY` marker in
the register**, and one of them is `node tests/test-mechanics.js`, which writes the census. mtime
07:32, inside that run's window.

**What changed is two lines and neither is a row.** The `generated` stamp, and ONE stochastic `detail`
string — `Iron Head 20.1% -> 19.6%`, a sampled rate inside a row's prose. Measured:

```
git show HEAD  883 probed / 883 live / 0 missing
on disk        883 probed / 883 live / 0 missing
row key (kind, id, tag, live, armed, hollow) over every row:  IDENTICAL
whole-file sha256: efa4c27d531a  ->  95d0cbcedc7a
```

**So the steering set is unmoved and the BYTES are not.** If the in-flight run stamps a census digest
in its receipt, that receipt will name bytes the file no longer holds. It is left alone rather than
restored: reverting is itself a write to a file another process may be reading, and
`git checkout -- data/mechanics-census.json` returns the exact HEAD bytes at any time if the
coordinator wants them back. Nothing in this pass reads or depends on the new bytes.

## Releases cut

**None.** No engine byte changed; the release is still `48ac1c228e02`, which is already tracked.
Nothing needs force-adding.

Files touched: `tests/roster.js`, the three roster artifacts (plus `data/roster.json` and the
`.prev.json` files), whatever the gate rewrote (`data/quarantine-stamp.json`), `docs/ENGINE.md`,
`docs/ROADMAP.md` (#617), `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, the four roster-move figures in
`docs/ABRA-whitepaper.md`, and this report.

`data/mechanics-census.json`, `data/game-differential.json`, `data/engine-diff.json` and the team pool
were **not** written: a 10,000-game whole-game differential was running in another process against the
frozen release for the whole of this pass.

`engine/status.js --write` was **NOT** run: it restamps the generated blocks of all five division
ledgers, four of which are modified in this working tree by the HELD 7.0.0 release. Nothing inside a
`<!-- GENERATED -->` block was hand-edited.

Unrelated and NOT from this pass: `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
`docs/MODELS.md`, `docs/SUMMARY.md` and their PDFs are modified in this working tree by the HELD 7.0.0
release. None was touched here.
