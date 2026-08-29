# CARD F1 — A MID-TURN ENCORE RELOCATES THE ENCORED BODY'S ACTION, AND THE DIRECTION IS THE ENCORED MOVE'S BRACKET

**2026-08-29. Batch of one. ENGINE.**

Release `552e2a4510e8` -> **`cc7dca43e395`**. Census **794 -> 795 live / 795 probed / 0 missing**.
Empirical arm: protocol diverged **216 -> 214**, board-parted **97 -> 97 of 961**, `order_probe`
**11 rows -> 2**.

---

## 1. THE VERDICT IN FOUR LINES

- **What reorders the action:** Champions' OWN `encore.condition.onStart`, which calls
  `this.queue.changeAction(target, {...moveid...})` and then rewrites the entry's priority. **Mainline
  does not do this at all.** The card's symptom was right and its cause ("we move it to the back")
  was the wrong way round: *the authority moves it FORWARD*, into the encored move's bracket, and this
  engine correctly left it where the player's own click had put it — correct for mainline, wrong here.
- **The 11-game `stall` attribution: REFUTED, by measurement.** `active[].stall` is **13 games** at
  the current baseline, not 11, and after the fix it is **still 13 games / 13 leaves — not one leaf
  moved.** The stall family is not downstream of F1.
- **Exact ties: NONE.** All nine `order_probe` rows this closed carry `same_priority: false` and a
  non-zero `speed_gap` (30, 62, 50, 38, 31, 6, 31, 73, 172). Nothing here is a decision for Will.
- **Board-parted did not move, and that was NOT predicted.** Said before the run: both scoreboards
  should move. The lab moved (795) and the protocol moved (216 -> 214); the board did not, because
  the three games part on causes the ordering line was MASKING. §5 names them.

---

## 2. WHAT ACTUALLY REORDERS THE ACTION

`data/mods/champions/moves.ts:286-320` **replaces** encore's `condition.onStart`. The tail is the
clause mainline has no counterpart for:

```js
const action = this.queue.willMove(target);
if (!action) {
  this.effectState.duration!++;                      // the target has already acted
} else if (action.moveid !== move.id && !target.hasItem('mentalherb')) {
  const priority = action.priority
                 - this.dex.moves.get(action.moveid).priority
                 + this.dex.moves.get(move.id).priority;
  this.queue.changeAction(target, { choice: 'move', moveid: move.id, order: action.order });
  this.queue.willMove(target)!.priority = priority;
}
```

Mainline's `encore` (`data/moves.ts`) stops at the `duration++` and leaves the swap to
`onOverrideAction` — which `sim/battle-queue.ts:290` documents, in as many words, as the door that
*"doesn't change priority order"*. **Champions took the other door.** Reading `/data/moves.ts` here
reads a different game; this is the eight-file rule and it is the file it costs the most on.

**THE BRACKET THAT ACTUALLY LANDS IS NOT THE DELTA PRINTED ABOVE.** The Encore resolves inside another
body's move action, and `Battle#runAction` ends (gen >= 8, `sim/battle.ts:2915-2922`) with
`getActionSpeed` over every queued action followed by `queue.sort()`. `getActionSpeed` recomputes
`priority` as `dex.moves.get(action.move.id).priority` passed through `ModifyPriority`, so the delta is
**overwritten by a full re-derivation off the encored move** before anything else runs. The re-sort
cannot be skipped: it is gated on `queue.peek()?.choice === 'move'` and the relocated entry is itself a
queued move.

The two readings differ whenever an ability modifies priority by CATEGORY. **Measured, not argued:**
`prankster-status` stages a Prankster body that clicked a damaging move and is Encored into Calm Mind.
The printed arithmetic gives `0 - 0 + 0 = 0`; Showdown puts the body **second**, i.e. +1. An
implementation of the formula alone stays red on that arm.

**WHY WIRE 118 WAS RIGHT AND STILL WRONG.** `actionPriority` read `_selMv` — the move the player
selected — because `sim/battle-actions.ts` captures `baseMove.priority` one line before
`OverrideAction` may swap the move. That is exactly correct for mainline, and for the case Champions
leaves alone: an Encore already standing at the top of a turn, where the request offers only the
encored move and `action.moveid` IS it. It is exactly wrong for the case Champions rewrote.

---

## 3. THE THREE CARDS, AND THE FOURTH THE CARD DID NOT COUNT

At the CURRENT baseline (`552e2a4510e8`, not the card's `e129bca605e3`) the first divergences whose
window carries an Encore are **four**, and three are this mechanic:

| game | authority | us | encored into |
|---|---|---|---|
| `…2653843264` t4 | `\|move\|p2a: Maushold\|Helping Hand` | `\|move\|p2b: Whimsicott\|moonblast` | Helping Hand **+5** |
| `…2656709541` t4 | `\|move\|p2a: Venusaur\|Protect` | `\|move\|p2b: Kingambit\|suckerpunch` | Protect **+4** |
| `…2656286137` t8 | `\|move\|p2b: Sinistcha\|Rage Powder` | `\|move\|p1a: Basculegion\|lastrespects` | Rage Powder **+2** |
| `…2658854183` t2 | `\|-activate\|p1a\|move: Struggle` | `\|move\|p1a\|struggle` | — (card F7, not this) |

The third was filed as *"event missing from medicham2"*, not as F1 — so the card's count of three was
right by accident on a different membership. Every one of the three is a relocation UPWARD, and in
every one the encored move's base priority is above the chosen move's.

**THE `order_probe` IS THE SHARPEST NUMBER IN THIS PASS: 11 rows -> 2.** Nine of the eleven turn-order
disagreements the instrument reports across 961 games were this one mechanic. The two survivors are
`…2635381525` (card H1, the Ditto — `speed_gap 0, same_priority true`, which is one body clicking two
moves and not a tie) and `…2655813620` (Sneasler Close Combat vs Aerodactyl Tailwind, `speed_gap 286`,
unrelated and still open).

**AND CARD RETRACTED-3 IS CONFIRMED.** The review nearly filed *"Protect's +4 priority is not
applied"* off four `protect(+4) vs …(+0)` probe rows. All four are in the nine that closed here, and
none of them was a priority-table defect.

---

## 4. THE FIX — THREE EDITS, ONE OF WHICH IS A CORRECTION IN ITS OWN RIGHT

`engine/medicham2-browser.js`.

1. **`encoreRelocateQueued(who, mvId)`** — new. Walks the live turn queue from the cursor+1, finds the
   target's own pending entry, and writes `_selMv = <the encored move>` on it. **It writes nothing
   else.** The MOVE the body executes is still swapped at execution where WIRE 143 put it, so no die
   moves and no action is rebuilt. Called from `applyMoveVolatile`'s encore branch **below**
   `mentalHerbCures` and only while `_vol.encore` still stands — which gets the authority's
   `!target.hasItem('mentalherb')` clause out of the item's own implementation rather than from a
   second copy of the rule. `willMove`'s two other conditions come free: `sdChoiceOf(it.a) !== 'move'`
   (already acted, or a bare switch) and `actionMoveId(it.a) === mvId` (`action.moveid !== move.id`).

2. **`ENCORE_Q`** — the live turn's `acts` array and its cursor, assigned at the top of every action
   (above the mega phase and above `_resortTail`, because those two are what CHANGE the order) and
   dropped on the outer exit of the turn beside the flinch clear, so every `break _TURN` clears it.
   A call that finds no queue is counted at `MEDFAILS.encoreRelocateNoQueue`, not skipped quietly.

3. **`actionPriority` now resolves BOTH halves of the bracket from one move.** This is the edit that
   is not merely plumbing. The function read the PRIORITY off `_selMv` and the CATEGORY off the
   action's KIND — two different moves whenever anything overrode the choice — so a body whose action
   is `kind:'attack'` and whose bracket move is Calm Mind was priced as an attack and Prankster
   returned 0 for it. The authority reads `baseMove.priority` and `baseMove.pranksterBoosted` off the
   same record on consecutive lines. It also means every KIND routes through the `_selMv` line now,
   not just `attack`: a body that chose Protect (+4) and is Encored into Charm used to keep +4,
   because the `k === 'protect'` branch never looked at `_selMv` at all.
   **Equivalence was checked before the line was written, not asserted:** `movePriority` returns
   exactly each branch's own constant — protect 4, wideguard 3, tailwind 0, trickroom -7 — so an
   action whose `_selMv` IS its own move is bit-identical. A bare switch carries no `_selMv` and still
   falls through to the constant 6.

Counters: `MEDSEEN.encoreRelocatedQueuedAction` (the branch fired),
`MEDFAILS.encoreRelocateNoQueue` (must be 0), `MEDFAILS.encoreKeepsSelectedBracketRestored` (the knob
stamp).

---

## 5. WHICH SCOREBOARD, SAID BEFORE THE RUN — AND THE HALF THAT WAS WRONG

**Said before the run:** Encore is not a rare mechanic and three of the sixty first divergences carry
it, so **both** scoreboards should move — protocol down by ~3-4 and board-parted down by ~2-3.

**What happened:**

| | before (`552e2a4510e8`) | after (`cc7dca43e395`) |
|---|---|---|
| games / threw | 961 / 2 | 961 / 2 |
| protocol diverged | 216 | **214** |
| board-parted | 97 | **97** |
| `order_probe` rows | 11 | **2** |
| class `ordering` | 60 | **53** |
| class `unrelated event mismatch` | 32 | **38** |
| `active[].stall` family | 13 leaves / 13 games | **13 / 13 — unmoved** |
| first-board-divergence set | 40 games | **the same 40 games, 0 in, 0 out** |

**The board did not move because the ordering line was MASKING the causes underneath it.** Seven
ordering causes disappeared and none appeared; six of the seven moved into `unrelated event mismatch`
one or more lines later in the same games. Read out:

- **`…2653843264` — a NEW defect this unmasked, filed not fixed.** The relocation now works and
  Maushold's encored Helping Hand runs at +5 exactly as the authority does. The game then parts on
  `\|-singleturn\|p2b: Whimsicott\|Helping Hand\|[of] p2a: Maushold` against our
  `\|cant\|p1b: Farigiraf\|ability: armortail\|helpinghand`. **Armor Tail is blocking a priority move
  that its holder is not the target of** — Helping Hand names the mover's OWN ALLY. That is Armor Tail
  over-firing, and it is the opposite sign to card C6, which says Armor Tail does not block priority
  at all. Both can be true and it is its own batch.
- **`…2656709541`** now parts on `\|-singleturn\|p2a: Venusaur\|Protect` against our `\|-fail\|p2a`.
  The relocation put the Protect where the authority puts it; what remains is the shield itself,
  whose board leaf on this game reads `p2.active[0].stall  m=0  s=9`. That is the `stall` family, and
  it was standing behind the ordering line rather than caused by it.
- **`…2658854183`** is unchanged and was never this card (Struggle's `-activate`, card F7).

**So: the prediction was half wrong and it is recorded as wrong.** A mechanic can be common in the
pool, close nine of eleven rows on the turn-order instrument, and move the board scoreboard by zero,
because the board scoreboard counts GAMES and these games were going to part anyway. What the pool
run actually bought was the *unmasking*: two named defects that no instrument could see before.

---

## 6. THE PROBE — `tests/probe_encore_bracket.js`, SHOWN RED FIRST

Eleven arms, five red and six controls, every arm played on both engines under the differential's own
`middle` pin with the identical script. **No expectation is typed anywhere**: Showdown's own `|move|`
order is the answer, and the file asserts only that the two agree, that the knob moves them apart, and
that the counters say the branch ran.

**RED FIRST, WITH THE READINGS:** the first run reported **11 failures across 11 arms** with the five
red arms parting and the knob unwired. Two of those failures were the FIXTURE and not the engine, and
the counters caught both before any conclusion was drawn — `prankster-status` staged an Encore that
never landed (`-start` count 0), because a **Prankster-boosted status move cannot touch a Dark type**
and the only two slow Prankster carriers this regulation has (Sableye, Grimmsnarl) are both Dark; and
`already-moved` staged a bounced Encore rather than a bumped duration, because **Encore carries the
`protect` flag** and the victim's Protect refused it outright. Both were repaired by changing the
fixture, not the assertion.

| arm | what it clears | clean | knob |
|---|---|---|---|
| `up-quickattack` | red — 0 -> +1, victim last -> second | agree | PART |
| `down-quickattack` | red — +1 -> 0, the direction a "move it to the front" fix fails | agree | PART |
| `up-protect` | red — the empirical arm's own shape (`…2656709541` t4) | agree | PART |
| `prankster-status` | red — separates a RE-DERIVATION from the delta formula | agree | PART |
| `mirror-side` | red — the sides exchanged whole | agree | PART |
| `no-encore` | the knob cleared explicitly, Charm in the Encore's place | agree | agree |
| `same-bracket` | `changeAction` fires and the bracket does not change | agree | agree |
| `already-moved` | `willMove` returns null; the duration is bumped instead | agree | agree |
| `encore-fails` | the volatile is never written | agree | agree |
| `mental-herb` | the authority's own exclusion, by name | agree | agree |
| `same-move` | `action.moveid !== move.id` is false | agree | agree |

**THE INSTRUMENT'S OWN CONTROL IS ASSERTED, NOT ASSUMED:** `no-encore` must order the turn
DIFFERENTLY from `up-quickattack` **on the authority**, or every "the engines agree" above could be a
turn the Encore could not have moved. It does, and the file fails if it stops doing so.

Also asserted per arm: `scriptCounters().moveNotOnRequest === 0` (a click the request did not offer
becomes a silent `pass` on both engines and the arm agrees while testing nothing); the turn count
against the script length; the `-start ... Encore` count on BOTH streams; the relocation counter at an
exact per-arm value (1 on the reds, 0 on four of the six controls); and the knob stamp absent-clean /
present-on-knob. Every species, ability, item and move is checked against
`Dex.forFormat('gen9championsvgc2026regmb')` **and the learnset** before a game is played, and the
Champions clause itself is READ at run time — the file refuses to run if
`encore.condition.onStart` stops containing `changeAction` or the `mentalherb` name.

The census row is `move / sealsMoves — an Encore landing MID-TURN moves its victim into the bracket of
the ENCORED move`, in `tests/test-mechanics.js`, staged through `battleInit` + two real
`battleTurn`s; `encoreBracket(` is declared in the REALTURN list with its reason, so the direct-call
ratchet still reads 1 (the pre-existing `alwaysCrit`).

---

## 7. REGRESSION SWEEP

Green, run after the change: `probe_encore_bracket` (11/11), `test-mechanics` (795/795/0, both
ratchets held), `probe_mega_priority` (all arms clear — the other consumer of the mid-turn re-sort),
`probe_turn_order` (12 staged, 0 not matching), `test-bracket-regain`, `test-encore-fail-silent`,
`test-precharge-order`, `test-engine-consistency`, `probe_protect_stall`, `probe_protect_stage_order`,
`probe_sound_lock_restart`, `test-middle-stall-address`, `test-choice-lock`, `test-volatile-duration`,
`test-rollout-effects` (38/0), `test-protocol-trace`, `test-wiring`, `test-immunity-gate`,
`test-middle-identity`.

**PRE-EXISTING REDS, UNCHANGED, AND ONE MORE THAN THE BRIEF NAMED:**

- `tests/probe_shield_refusal_line.js` — `13 arms staged, 1 failing`. Identical.
- `tests/probe_random_target_address.js` — `LENGTH MISMATCH sd=61 sites=62`. Identical.
- `tests/test-resolution-order.js` — `FATAL ERROR: Reached heap limit`, rc **134**. Identical.
  **The brief said this one is in my territory: it is not runnable, my work did not make it runnable,
  and it did not get worse.** It is the same failure and the same exit code.
- `tests/test-engine-diff.js` — exits **rc=3** with `disagreed 0`. **A/B verified rather than assumed:
  `git show HEAD:engine/medicham2-browser.js` swapped into the tree produces rc=3 identically**, and
  the file was restored with the digest checked either side (`d381ba91a2b4aa05033ff664502d6034` both
  ways). The non-zero is the pool advisory (9 species the damage differential can never draw), not a
  disagreement. **This is a FOURTH pre-existing non-zero and is reported rather than filed.**

---

## OWED, NOT RUN

```bash
# the empirical arm, exactly as run here
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd engine\game_differential.js --games 1200 --turns 12 \
  --release cc7dca43e395 --census data/verification/census-pin-9446a684709d.json \
  --team-store data/team-pool-frozen --steering empirical --arm middle --state --end-state \
  --write --out data/verification/game-differential.encore.json

# the three roster stages and the fire sweep, stale against cc7dca43e395
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd tests\roster.js --items --abilities --moves --write
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --write
node engine/quarantine.js
node engine/coverage.js
```

- **ARMOR TAIL BLOCKS A PRIORITY MOVE AIMED AT THE MOVER'S OWN ALLY, AND THE AUTHORITY DOES NOT.**
  Unmasked by this fix in `…2653843264`; a Helping Hand at one's own partner is refused here with
  `|cant|…|ability: armortail`. **Opposite sign to card C6**, which says Armor Tail does not block
  priority at all — both can be true, since one is the ally axis and one is the foe axis. Not staged,
  not probed, its own batch.
- **THE `stall` FAMILY IS 13 GAMES AND IS NOT F1.** Proved by this pass rather than argued: the
  ordering is corrected and not one stall leaf moved. `…2656709541` now parts directly on
  `-singleturn Protect` vs `-fail`, with `p2.active[0].stall m=0 s=9`. That is card F2's family
  (`randomChance(1, counter)` and the `willAct` gate) and it is the next thing this game is waiting on.
- **THE DELTA FORMULA IS NOT IMPLEMENTED, AND THAT IS DELIBERATE.** This engine re-derives the bracket
  off the encored move, which is what the authority's own post-action re-sort leaves standing. There
  is one case the two readings could differ in and it is unreachable here: an Encore whose relocation
  is followed by NO re-sort, which cannot happen because the relocated entry is itself a queued move
  and the re-sort is gated on exactly that. Stated rather than tested.
- **`ENCORE_Q` IS A SECOND HANDLE ON THE TURN QUEUE.** `_resortTail`, `_megaPhase` and
  `_anyActionAfter` are closures over `acts`; this is the first module-level view of it. Nothing
  enforces that the two stay in step beyond the cursor being assigned at the loop top. A caller
  reaching it outside a turn is counted, never served — but the counter is the whole guard.
- **`actionPriority`'s widened `_selMv` line reaches the CHOICE lock as well**, where `_selMv` is the
  caller's move and the action is the locked one. On the authority that pair cannot occur (the request
  offers only the locked move) and the differential's `scripted()` resolves against that request, so
  it is unreachable there. Named because it is a behaviour change outside the mechanic that motivated
  it, not because anything measured it.

- **TWO OPS ARTIFACTS MOVED UNDER THIS SESSION AND I DID NOT WRITE THEM. REPORTED, LEFT ALONE.**
  `data/kad-replays.js` and `data/live.js` are both stamped `06:05` — inside this session's window,
  and nothing in this pass writes either. They are replay/store artifacts and are OPS's. Nothing here
  read them; they are named so that the churn in `git status` is not read as this batch's, and so a
  concurrent ingest is not mistaken for a defect. Not reverted, not committed.
- **`data/game-differential.json` WAS NOT WRITTEN** (mtime still 2026-08-28 23:14). Every write from
  this pass went to `data/verification/game-differential.encore.json`, and the damage differential
  wrote to `data/verification/engine-diff.n150.json` — `data/engine-diff.json` is untouched at 02:49,
  which is the artifact the published `0 of 6,000` figure is read from.
