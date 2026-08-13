# MEDICHAM SPRINT — running notes

**Version 3.98.0 · 2026-08-10**

**WHAT THIS FILE IS AND WHEN IT DIES.** Will, 2026-08-10: *"yes faster, lets just keep a running notes
list doc that we can then use to update the living docs upon completion of medicham."*

The living-docs rule normally moves the white paper, the deck, the technical docs, SUMMARY, MODELS, the
division ledger and CHANGELOG **in the same pass as the code**, with a version bump. For the duration
of the MEDICHAM gate sprint that pass is **deferred, deliberately and on the record** — each fix writes
one row here instead, and the whole batch is written up when the gate closes.

**THE DEFERRAL IS NOT A BYPASS.** `--no-verify` is still banned. The pre-commit gate still runs. What
changed is the target: a sprint commit must touch **this file**, so a fix that records nothing still
fails. The debt is visible and countable rather than silent, which is the whole difference between
this and the four-day drift that made the rule exist.

**WHEN THE GATE CLOSES:** every row below becomes CHANGELOG entries, ledger sections and headline
paragraphs, and this file is deleted. If the sprint is abandoned, the rows still have to be written up
— the debt does not expire because the sprint did.

---

## ROADMAP #221 — THE RESIDUAL WALK IS EFFECT-MAJOR. 2026-08-12 (ENGINE).

Full account in `docs/ENGINE.md`. **Census 537 → 541 live / 0 missing**, four probes, 0 hollow,
0 unarmed, 0 direct-call, 0 threw. `#221` closed in the register, which was the last open row
asserting a live engine defect (`open_work.js`: 1 → 0).

**WHAT MOVED.** The end-of-turn loop was one pass per BODY over the effects; it is now one pass per
ORDER GROUP over the bodies, which is `Battle#fieldEvent('Residual')`'s own shape. Groups come from
`data/residual-order.json` (derived from the format by `engine/residual_order.js`) — **no order number
is written in the engine.** `residualOrder()` is re-asked per group because Speed Boost is itself a
step at order 28 and speeds change mid-walk.

**THE KEY IN THE #221 ROW AND IN THE #218 LEDGER ENTRY IS WRONG, AND IS CORRECTED RATHER THAN EDITED.**
`comparePriority` is `order ASC → priority DESC → SPEED DESC → subOrder ASC`. Speed sits BETWEEN order
and subOrder; a restructure written from `(residualOrder, residualSubOrder, speed)` would have sorted
Leftovers against Shed Skin by category when the authority sorts them by who is faster.

**MEASURED, controlled, same command both ways** (200 games, frozen team pool, `planted_divergence_proof_ok`
true in both):

| | top-tie-first | bottom-tie-first |
|---|---|---|
| collapsed to one group — the body-major walk | 92 / 179  51.4% | 77 / 179  43.0% |
| effect-major | **88 / 179  49.2%** | **73 / 179  40.8%** |

The attributable number is the cause family: the **`ordering` class fell 24 games / 20 causes → 18 / 15**,
and the `sandstorm-chip <> leftovers-heal` pair that #218 named as unfixed is gone from it. Two other
classes each gained one game — games that used to stop early now survive and part elsewhere.

**FOUR CHUNKS HAD NO STEP IN THE FILED PLAN**, and an unwrapped chunk runs once per GROUP (Cud Chew
would decrement sixteen times a turn): Future Sight `futuremove` order 3, Wish 4, Salt Cure 13 — filed
as sharing Aqua Ring's order 6, eleven orders away — and Cud Chew / Harvest / Pickup at 28. Future
Sight was **absent from the derived table entirely** because it carries no `move.condition`;
`residual_order.js` now derives slot conditions from `slotCondition` and `addSlotCondition(...)`,
printing exactly `{futuremove, healingwish, wish}`.

**THE `onUpdate` BERRIES ARE NOT A RESIDUAL STEP** and that half is a behaviour change, not a
reordering: they close every group instead of sitting at one fixed point, so a body dropped under half
by Leech Seed eats the same turn instead of waiting one. Counted by
`MEDSEEN.residualBerryAteOffOldSlot`, whose "old slot" is DERIVED (the group holding `leftovers`).

**THE DELIBERATE BREAK IS KEPT AND MADE LOUD.** `MEDI_RESIDUAL_COLLAPSE=1` collapses the table to one
group — which IS the body-major walk — stamps `MEDFAILS.residualCollapsed`, and `test-mechanics.js`
REFUSES to write the census under it, so a demonstration cannot overwrite the ratchet's artifact.

## THE END-STATE COUNT IS A SEVERITY LADDER NOW, AND ONE DIVERGED GAME IN ELEVEN ENDS WITH A DIFFERENT SET OF POKEMON ALIVE. 2026-08-12 (MEASURE).

Full account in `docs/MEASURE.md` §000000. Nothing in `medicham2-browser.js` or `tests/test-mechanics.js`
was touched; measured against the frozen release **`6155acc0fb26`**, frozen team pool, 2,300 games per
arm, turn cap 12, 0 threw, planted proof green.

**THE PROBLEM.** Five defects were verified against Showdown's source, staged, shown red and fixed on
2026-08-12, and the whole-game divergence count moved **+1 and +3**. All five were narration. Will then
read twenty-five battles by hand and found three wrong OUTCOMES. `DIFFERENT-END-STATE` weighed those two
kinds of finding identically because it was a COUNT.

**THE LADDER** (`engine/end_state_severity.js`), over the `DIFFERENT-END-STATE` games — which is the
parted ones PLUS the 31 (top) and 18 (bottom) whose narration never parted and that still ended apart:

| band | top-tie-first | bottom-tie-first |
|---|---|---|
| 1 different WINNER | 0 | 0 |
| 2 different BODIES ALIVE | **25 (9.0%)** | **27 (9.1%)** |
| 3 HP beyond a typical hit | 47 | 59 |
| 4 identity on a LIVE body | 86 | 95 |
| 5 other state | 51 | 47 |
| 6 small HP or boost | 69 | 69 |
| banded | 278 | 297 |

**FILED TO ENGINE, ranked by corpus usage, not diagnosed here.** `sinistcha` is the largest single body
in band 2 — **6 and 7 games, 2,668 corpus teams** — and always the same shape: **`0/146` for us against
`146/146` for the authority**, a body at full health in Showdown and dead here. `pair-redirect-priority`
supplies 14 of 25 and 13 of 27 band-2 games; `pair-protect-bust` 8 and 7.

**THE SHAPE PRIOR HOLDS AS A RATE AND FAILS AS A HEADLINE.** Share reaching band 2: RULE 14.9% / 16.2%,
EMISSION 11.7% / 11.9%, ORDERING 7.1% / 4.8%, UNPARSED 0 / 0. So rule-shaped is the most dangerous per
game — **but EMISSION supplies 16 of 25 and 15 of 27 band-2 games** because it is the biggest bucket.
**And ORDERING is not zero**: one game per arm has an ordering-shaped first divergence and a different
set of bodies alive at the end.

**TWO HARNESS DEFECTS FOUND AND FIXED, BOTH IN THE INSTRUMENT AND NEITHER IN THE ENGINE.**
- The driver never set `S.maxTurns`, and `battleOver` is `S.turn >= (S.maxTurns || 20)`. At `--turns 40`,
  **943 of 983 games came back ENDED-APART, 937 "ONLY medicham2 ended the battle"** — 96% of a run
  produced by one default, reading exactly like a catastrophic disagreement. Now
  `max(turn cap + 1, 20)`, so every 12-turn run is byte-identical to before.
- The band-3 ruler discarded **every killing blow** (`0 fnt` carries no denominator) and counted residual
  chip as a hit (median 12.7%, quartiles 6.2/34.2 — the middle of a bimodal mixture). Fixed: median
  **25.9%** of a health bar over 2,092 direct hits (top) and **28.8%** over 1,808 (bottom).

**BAND 1 IS ZERO AND IT IS UNMEASURABLE RATHER THAN CLEAN.** 2,275 of 2,300 games stop at the cap; at a
19-turn cap it is still 938 of 983 and band 1 is still 0; and a 30-turn run **refuses to publish**
because the state comparator's *PP on a slot nothing has touched* plant cannot be staged in a long game.

**`tests/test-end-state.js` PART 3 IS GREEN AGAIN AND `docs/ENGINE.md`'s ATTRIBUTION WAS WRONG.** Same
frozen release, one flag apart: live team pool → 2 failures, `--team-store data/team-pool-frozen` → all
green. The pool is read live from a file OPS appends to, so the fixture drifted until the item plant
landed in a battle that legitimately undid it. Pinned by default now.

---

## THE MACHINE FROZE AND THE FIRST ANSWER WAS THE WRONG ONE. 2026-08-11.

Will: **"U KEEP FREEZING UP AND I HAVE TO FORCE CLOSE YOU"**. Then, when the answer offered was to
run one agent instead of several: **"NO WE CAN HAVE SEVERAL AGENTS, DO NUMBER 3"**.

Measured rather than guessed: 16 cores, **13 GB of RAM**, ~12 Claude processes already resident.
`engine/quarantine.js` runs a 20,000-comparison differential plus three roster stages; the interaction
matrix stages 2,250 pairs; each node run loads the 30 MB store plus the dex plus the tags. Two
division agents doing that concurrently, with test batches on top, starved the UI thread and pushed
RAM toward swap. **A swapping desktop does not look slow, it looks frozen** — which is why the symptom
reported was a force-quit and not a complaint about speed.

**Serialising the divisions was proposed first and it was the wrong answer.** It throws away exactly
the parallelism they were cut apart to make safe — the same argument `docs/DIVISIONS.md` already makes
about treating the invalidation ORDER as a scheduling constraint. `tools/lownode.cmd` runs node at
BELOWNORMAL instead: the work still takes every idle core, and a foreground window can always take one
back. BELOWNORMAL, not `/LOW` — `/LOW` is the IDLE class and can starve outright under sustained load,
turning a four-minute gate run into an unbounded one, which would look like the hang it fixes.

**The load-bearing claim is the EXIT CODE, not the speed.** Every gate here is read as
`node tests/x.js && GREEN || RED`, so a wrapper returning 0 for a failing script would turn every red
test green at once, silently — strictly worse than the freezing it was written to fix.
`tests/test-lownode.js` asserts it and was **shown RED on a deliberate break**: with
`exit /b %ERRORLEVEL%` deleted it reports *"A FAILING SCRIPT WAS REPORTED AS SUCCESS"*, 3 passed
1 failed, then 4 passed once restored.

---


## THE OTHER SIX: THREE MORE FIXTURES, THREE REAL WIRES, AND A NAME THAT HAD BEEN CARRYING A RULE ON ITS OWN. 2026-08-11 (ENGINE).

**#171, #168, #169 — ALL THREE ARE THE FIXTURE, AND ALL THREE ARE THE SAME FIXTURE BUG.** ROADMAP #144
made PP a resource. Three `test-tag-wire` fixtures pit a body against something it cannot hurt and let
the battle run to the 20-turn cap, so the moves empty, `mustStruggle` fires **correctly**, and Struggle's
1/4-max recoil contaminates the very number the assertion reads:

| row | registered as | measured |
|---|---|---|
| #171 | *"Leech Seed lands on a Grass type"* — 25,000 lost | `_seededBy` is **false**. 25,000 is 99,999/4 — the victim's own Struggle recoil once Earthquake emptied. |
| #168 | *"Aftermath charges a survivor nothing"* — 109/173 | with PP restored the attacker ends **173/173**. `punishesAttacker` never fires on a body that lives. |
| #169 | *"a base-forme Gulp Missile body punishes nobody"* | same shared `one()` helper, same Struggle chip. The forme gate was never over-firing. |

Each fixture now gives both bodies unlimited PP, which is the claim those fixtures already made in
prose — *"every HP point and boost stage the attacker loses is the punishment and nothing else"* — made
true by construction. **Shown RED against a deliberately broken engine before being trusted**: deleting
the `immuneType` clause gives *"99999 lost, seeded true"*; deleting `onFaintOnly` and `requiresForme`
turns the survivor arm to *"HP 0/173"* and Gulp Missile back on.

**#173 FAKE OUT — A REAL WIRE, AND THE COMMENT ABOVE THE BUG SAID WHY IT EXISTED.** `firstTurnOnlyRefused`
was `id==='fakeout'`, justified in place by *"the authority expresses it as `onTry` on the move ... so
there is no upstream flag and no tag to derive from"*. **That was read off mainline.**
`data/mods/champions/moves.ts:331` inherits Fake Out and adds `onDisableMove(pokemon) { if
(pokemon.activeMoveActions) pokemon.disableMove('fakeout'); }`, desc *"This move cannot be selected
unless it is the user's first turn on the field."* In Champions it is a **menu disable**, which is
exactly what the assertion demanded and exactly what is derivable. New tag `firstTurnOnly`, membership
**printed before wiring: 2 — `fakeout` (16,871 uses) and `firstimpression`**, and First Impression is
legal here and the name check never covered it at all. Answered in `moveDisabledBy`, beside Taunt /
Disable / empty PP, so every caller of `illegalMoveNow` inherits it. Name kept as a **counted** fallback;
`firstTurnOnlyByNameOnly` reads **0**, so the tag is carrying it. The assertion also had to move from
`kind` to `move`: ROADMAP #119 turned Struggle from a turn-voiding sentinel into a real `attack` action,
so `kind==='struggle'` could only have passed while the engine was broken.

**#180 SUCKER PUNCH — THE THIRD CLAUSE OF ONE `if`.** `data/moves.ts:18400` also fails on
`target.volatiles['mustrecharge']`. A recharging body is queued with a move action and is *attacking* by
every test the existing block makes, so Sucker Punch landed anyway — a free 70 BP priority hit the turn
after any Hyper Beam. `refusesRechargingTarget` is derived from the handler text and **discriminates**:
`suckerpunch` carries it, `upperhand` does not, which is correct.

**#179 RECYCLE — `{kind:'pass'}`, THE TERMINAL DO-NOTHING BRANCH.** New tag `restoresOwnLastItem`,
**membership 1, printed**, carrying all three of the handler's clauses (`onUser`, `refusesIfHolding`,
`spendsLastItem`). New action kind `itemback`. It needed no new state: `_lastItem` has existed since
Harvest, and one fact with three consumers is the point.

**#175 — RE-MEASURED FIRST, AS THE ROW ASKS. THE COUNT DID NOT MOVE AND NEITHER DID THE MEMBERSHIP:
still exactly the 23 the row names.** One is now closed. `ignoresRedirection` (Stalwart / Propeller
Tail): `sim/pokemon.ts:829` gates the whole `RedirectTarget` event on `move.tracksTarget`, so a Stalwart
body is not drawn by Follow Me, Rage Powder, Lightning Rod or Storm Drain. **Legal carriers derived from
the format, not recalled: Archaludon and Skarmory-Mega** — Archaludon is a real member of this metagame.
**AND THE FIX FOUND A SILENT NAME FALLBACK CARRYING A LIVE RULE**: `tracksTargetOf` looks for an
ability-side `tracksTarget` tag **that does not exist in the artifact**, so `ab==='stalwart'||
ab==='propellertail'` had been the entire mechanism, uncounted — ROADMAP #181's shape, one function
over. It now reads the param, honours the handler's own `exceptScripted` clause, and counts the name
path (`tracksTargetByNameOnly` reads **0**). The redirection site never asked at all and now asks the
same predicate the slot re-aim uses. **22 tags remain unconsumed; 21 of them were not touched and each
is still a separate decision.**

**NUMBERS. Census 448 live / 0 missing → 451 live / 0 missing — 3 arrived, 0 broke, net +3**
(`failsIfTargetNotAttacking`'s recharge clause, `restoresOwnLastItem`, `ignoresRedirection`), still 0
hollow, 0 unarmed, 0 direct-call, 0 threw. `test-tag-wire` **10 FAIL → 0 FAIL, 104 checks passed**.
`test-tag-consumed` **23 → 22**. Differential re-run at `--n 20000`: **20000 agreed, 0 disagreed**.
`test-wiring` green, every capability proved it ran. Gate unchanged at CLOSED 1 of 6 — the failing clause
is the register clause, which lifts when the rows are struck, not when the engine is fixed.

**EVERY ONE OF THE FIVE NEW OR CHANGED PROBES WAS SHOWN RED ON A DELIBERATE ENGINE BREAK BEFORE BEING
TRUSTED**, and in each case both arms collapsed to the SAME number — #178's signature that a knob is
unwired, rather than a count that merely failed to rise.

---

## FOUR OF THE ELEVEN DEFECTS WERE ONE DEFECT, AND IT WAS THE CHOOSER CLICKING STRUGGLE PAST A LEGAL BUTTON. 2026-08-11 (ENGINE).

**ROADMAP #166, #167, #170, #172 — CLOSED BY ONE ENGINE CHANGE.** Every one of them was registered off a
`test-tag-wire` assertion, each assertion was quoted verbatim, and **every one of the four diagnoses in the
register is wrong.** Focus Sash does save. Sitrus reads its threshold. Storm Drain banks the boost. Heat
Wave does not touch your partner — `spreadFoes` and `spreadAll` were never collapsed.

**WHAT WAS ACTUALLY HAPPENING.** `_chooseAction`'s last fallback (ROADMAP #152) reached `struggleAction`
whenever the damage scanner found no option and the priors sampler produced nothing usable. Its own comment
said the quiet part out loud — *"A real Struggle is not what Showdown would click here — a body with legal
status moves left is not on Struggle — and that mismatch is stated rather than hidden"* — and filed the
wrong click as the lesser evil against the void it was replacing. It is not the lesser evil. **Struggle is
a 50 BP typeless attack with 1/4-max recoil**, so every fixture body holding a single Protect or Roost spent
its turn hitting the thing under test and paying a quarter of its own HP for it:

| row | what the register said | what the trace said |
|---|---|---|
| #172 | *"Heat Wave hits your own partner"* | `\|move\|p2b: whimsicott\|struggle\|p1b: kingambit` — **both foes struggled into the partner.** Heat Wave reached p2a and p2b only. Ally damage 7 + 14 = 21, and Heat Wave into that body prices at 46–56. |
| #166 | *"Focus Sash does not save"* (HP 0) | the Sash **did** save at 1, and then Struggle's own 1/4 recoil killed the survivor. |
| #167 | *"fires on the WRONG SIDE of its own threshold, BOTH directions"* | struggle chip pushed the body under the threshold in the 80% arm and past the expected total in the 40% arm. The berry was eating correctly in both. |
| #170 | *"absorbs and does not bank the boost"* | the absorber was the struggling body; the boost was never the question. |

**THE FIX IS THE MENU, WHICH THIS FILE ALREADY COMPUTES.** `getMoveRequestData` puts Struggle on screen only
when `getMoves` comes back empty, and that predicate is `mustStruggle` at the top of `chooseAction`. Below it
a legal button always exists, so the fallback was reaching past one. It now takes a uniform pick over
`selectableMoves(me)` and builds it through `playerAction`. **Exactly one `rng()` draw**, deliberately —
`struggleAction` drew one for its uniform target, so every seeded probe downstream sees an identical stream.
Counted as `MEDSEEN.menuFallbackClick`, with `MEDFAILS.menuFallbackUnbuilt` naming its first offender if
`playerAction` ever cannot build the click; the Struggle sentinel stays underneath, still counted.

**FIVE PREVIOUSLY-GREEN ASSERTIONS WENT RED ON THE FIX, AND THAT IS THE EVIDENCE.** Icy Wind's drop, Snarl's
drop, the Scald thaw and the Choice lock's second turn were all passing **because the punching bag was
struggling instead of Protecting**. The moment it clicked its legal button the punching bag started blocking
the punch and the Choice-lock foe started Roosting back more than the Iron Head took. No assertion was
changed. What changed is that those fixtures now **say** what the opponent does — `IDLE(...)`, a forced
`{kind:'pass'}` handed in as side B's action — instead of inferring it from a chooser heuristic.

**NUMBERS. `test-tag-wire` 10 FAIL → 4 FAIL** (remaining: #168 Aftermath, #169 Gulp Missile, #171 Leech Seed,
#173 Fake Out). Census **448 live / 0 missing before, 448 live / 0 missing after — 0 arrived, 0 broke, net 0**,
which is the correct reading: the census never probed the chooser. Differential re-run at `--n 20000`:
**20000 compared, 20000 agreed, 0 disagreed.** Gate unchanged at CLOSED 1 of 6, with all five passing clauses
still passing.

---

## THE GATE OPENING RELEASED 33 STALE FIGURES ONTO THE SITE. THE WITHHOLDER HAD TWO STATES AND NEEDED THREE. 2026-08-11 (WEB).

`tests/test-web-quarantine.js` was RED and the recorded reason — *"the board payload was built while the
gate was closed — WEB rebuilds it"* — was **wrong, and rebuilding was the bug**.

`engine/quarantine.js`'s `withholder(gate, rows)` is **binary**: gate closed, withhold; gate open, return
`null`. When the gate opened at ~03:00 every consumer flipped 48 artifacts from WITHHELD straight to
PUBLISHED. Nothing had been re-run. The six this board reads were **147–191 hours old**, measured through
a simulator ENGINE was rewriting that same hour. quarantine.js's own report says the right thing in that
state — *"NOT withheld and NOT current … each must be re-run before it is quoted (ROADMAP #57)"* — and it
**prints that sentence without enforcing it**. `engine/status.js` shows the cost directly: with the gate
open it prints R4's `ACCEPT H1 — … 55.5% of 535 decisive pairs` followed by `[engine moved since;
transfer assumed, not measured]`. A caption. The failure CLAUDE.md names, arriving through the door
nobody guarded — not the gate closing, the gate **opening**.

**IT HAD ALREADY FIRED.** `web/quarantine-data.js`, generated **2026-08-11T03:38:41Z**, carries
`open:true`, `held:{}`, `withheld_keys:0` and **all 33 harvested figures RELEASED** — MILTANK's
*55.5% of 535 decisive pairs, CI [51.3, 59.7]*, MEDICHAM's leaf *51.0% CI [48.3, 53.7]*, MAG's *58
features / 220,613 decisions*, R3's *80.2%* — live on `index.html`, `models.html`, `stadium.html`,
`replay.html` and `scoreboard.html` with no plate. **NOT rebuilt here** (engine moving; see below).

**FIXED AS LOGIC, NOT AS AN ARTIFACT. Nothing was rebuilt and no number was authored.**

| file | what changed |
|---|---|
| `web/publish-rule.js` **(new)** | the third state, `rerunnable`, composed from quarantine.js's two facts (gate + downstream set) and quoting its own printed sentence. No flag, no `--force-publish`; gate and rows are arguments. |
| `web/build-status.js` | uses it; `withheld()` renders both states; **`status_raw` is no longer embedded unconditionally** — its old comment predicted this leak and was right, so the verbatim status.js text is dropped when it quotes a withheld verdict. |
| `web/status.html` | a `rerunnable` branch, its own plate, banner and legend entry. Without it those slots fell to the value branch and rendered `undefined` at 30px. |
| `web/build-quarantine.js` | uses it; carries `state` into `held`; **`heldFor()` and `gateFor()` no longer short-circuit on `Q.open !== false`** — that line made the front-door runtime *fail open* the instant the gate lifted, answering `clear` for every artifact including the 19 `engine/quarantine.js` explicitly refuses to classify. |
| `tests/test-web-quarantine.js` | rewritten to drive **three** synthetic states (closed / open-but-owed / re-run) instead of assuming today's gate. The old file could only be green while the gate was shut. |

**THE TEST IS GREEN BECAUSE THE LOGIC WAS FIXED, NOT BECAUSE ANYTHING WAS REBUILT**, and it was shown
RED four ways first (all in memory, nothing on disk edited): restore the binary withholder → 4 failures
including *"a board built against the REAL gate publishes 5 verdict string(s)"*; make the quarantine
unliftable → section C red; strip the page's `rerunnable` branch → section E red. It then passed with the
live gate **OPEN** at 07:09 and again with it **CLOSED** at 07:23 — the oscillation the old file could
not survive.

**OWED IN THE MORNING, IN THIS ORDER.** (1) `node web/build-quarantine.js` — this one is *over*-publishing
and is the urgent one; verified in memory that a fresh build from the corrected builder withholds all 48
with a route back, answers for the root and the play layer, and returns `unclassified` for an unknown.
**Do not `cp web/stadium.html app/stadium.html` first** — the only difference between them is the
generated block, and `app/` currently holds the *safer* (pre-03:38) one. (2) `node web/build-status.js`
after the #57 re-runs land. (3) `engine/quarantine.js` has **no exit from RE-RUNNABLE** — `classify()`'s
flag is graph topology and never clears — so until MEASURE gives a row a `current` bit the site withholds
those 48 permanently. Safe direction, not a resting state.

## ROADMAP #162 — THE COLLAPSED TAGS ARE SPLIT. CENSUS 444 → 448, MATRIX 1,640 → 1,641. 2026-08-11 (ENGINE).

Will, 2026-08-11: *"we need to split the tags, they require very different things"*, and again:
*"yes split them i already made that decision"*. Four families were queued; **two needed splitting and
two turned out to be already split by earlier work**, which is stated here rather than counted as
work done. Each landed alone with the gate re-run between them (ROADMAP #81).

| # | family | what was wrong | the probe that proves it |
|---|---|---|---|
| 1 | **the protection counter** (#59, #127's 96,406-use signature) | one tag, `stalling`, for THREE behaviours. Wide Guard **cleared** the shared counter where Showdown **triples** it, so a Wide Guard was a free way to refresh a decaying Protect; the Guards had no `willAct()` refusal; and the shield ACTION was dispatched off `PROTECTMOVES`, an exported name list | `move/stallCounterFeeds` — turn-1 Wide Guard then Protect at roll 0.99: **182** damage taken, against **0** after an ordinary click. `move/failsIfMovesLast` — the same turn-1 guard at Speed 200 vs Speed 1: **182** vs **0** |
| 2 | **Upper Hand vs Sucker Punch** (#60) | `failsIfTargetNotAttacking` carried `needsPriority`/`minPriority` correctly **and the engine never read them**, so a 65 BP +3 Fighting move beat an ordinary Earthquake with no drawback | `move/failsIfTargetMoveNotPriority` — target on Extreme Speed (+2) **44** damage, target on Earthquake (+0) **0**. It was red at **44 / 44** — identical arms across a varied knob |
| 3 | **Ally Switch's private counter** (#59's third behaviour) | implemented since WIRE 140 and **never probed**, and its four numbers (3, ×3, 729, duration 2) were literals beside the identical four in the shield branch | `move/privateStallCounter` — two Ally Switches at roll 0.99 leave slot 0 unchanged; a PROTECT the turn before does **not** arm it, so the second one swaps |
| 4 | **heal (`wish`/`rest`) and `statChangeInCode` (`spitup`/`acupressure`)** | **already closed.** `healDescriptor` resolves Wish and Rest to `healdesc`; Acupressure resolves to `affect` and moves a real stage (+2 SpD measured). #127's snapshot is stale on both | the new signature gate, below, reports neither as a split |

**FIVE NEW DERIVED TAGS, EVERY MEMBERSHIP PRINTED OVER ALL 500 LEGAL MOVES BEFORE ANYTHING READ IT:**
`stallCounterChecks` 6, `shieldsUser` 5, `stallCounterFeeds` 2, `failsIfMovesLast` 8,
`privateStallCounter` 1, `failsIfTargetMoveNotPriority` 1. No over-match: the string `stall` appears
in five further moves (burnup, magicpowder, reflecttype, roost, soak) and none matches these shapes.

### THE OVER-MATCH HAPPENED ANYWAY, AND THE HEADLINE COUNT DID NOT SHOW IT

The first dispatch used `stallCounterChecks`, which looked like the right tag and is not: **ENDURE is
a `stallingMove`, rolls the same die off the same counter, and blocks nothing** — the hit lands and
only the HP floors at 1. It became a shield and took both Endure probes down.

**`live` read 444 before and 444 after.** Two probes broke and two arrived in the same run. `missing`
is what caught it, going 0 → 2. The one number this division is judged on is invariant to a swap, and
that is worth knowing about it. The fix is a sixth tag, `shieldsUser`, read off the condition the
move's volatile actually installs (`checkMoveBypassesProtect`) — 5 members, Endure correctly absent.

### `PROTECTMOVES` IS NO LONGER THE DISPATCH, AND IT IS NOT DELETED EITHER

Three of its eight ids (burningbulwark, silktrap, maxguard) are `isNonstandard` here and carry no
artifact record, so a tag-only test would silently downgrade them to `{kind:'pass'}` in any other
format. The name set is kept as a **counted** fallback (`MEDFAILS.shieldByNameOnly`, 0 today) rather
than as a silent one, and the export stays so `mag_bot.js` and `medicham_coverage.js` are untouched.

### FOUR LITERAL SETS BECAME TAG READS (FACTS ARE GLOBAL)

`3 / ×3 / 729 / duration 2` appeared **twice** — once for `stall`, once for `allyswitch` — as eight
hardcoded numbers for one shape. Both now read their own tag's params, each with a counted fallback
(`stallCounterUntagged`, `privateCounterUntagged`, both 0). The shield's odds also stop compounding
`Math.pow(1/3, n)`, which is 1 ulp low from n = 3; the authority draws `randomChance(1, counter)` on
an integer. The window that changes is ~1e-17 wide — a correctness point, stated, not claimed as a fix.

### THE #127 CHECK IS NOW A GATE — `tests/test-tag-signature.js`

#127 says outright that the check is the deliverable. It resolves all 500 moves through `playerAction`
on one fixed board, groups by sorted tag list, and **fails when two members with an IDENTICAL param
record resolve to different kinds** — because nothing in the artifact could have told them apart, so a
name did. Param-separated splits are printed and ranked, not failed: Crunch and Meteor Mash sharing a
signature and resolving differently is *correct*, and failing it would fail correct behaviour.

Reading now: **295 signatures, 0 name-decided, 1 param-separated split** (`statChangeInCode`, 131
uses, acupressure vs bellydrum/tidyup — measured working in both branches). Of #127's five ranked
splits, **four no longer exist** and the fifth is the correct one.

**SHOWN RED BEFORE IT WAS TRUSTED:** a deliberate `if (id === 'detect') return {kind:'pass'}` inserted
above the tag test makes it print `protect / pass` for two moves with byte-identical records and exit 1.

**AND ITS FIRST VERSION WAS WRONG BEFORE THE ENGINE WAS.** It ran with `buildMon('Medicham')`, which
returns null — the species id is lowercase — so every damaging move fell out of the attack branch and
it reported SIX splits, five of them artefacts of its own fixture. The bodies are asserted now.

### MEASURED, EVERY NUMBER RE-RUN AGAINST THIS ENGINE RATHER THAN QUOTED

| | before | after |
|---|---|---|
| census | 444 live / 444 probed / 0 missing | **448 live / 448 probed / 0 missing** |
| `tests/test-engine-diff.js --n 20000` | 0 disagreements | **0 disagreements** |
| interaction matrix `--full` | 1,640 / 1,640 (100.0%), parting 0 | **1,641 / 1,641 (100.0%), parting 0** |
| matrix off-gate disagreements | 30 | **24** (`upperhand -> roughskin` among them — #60 was visible there) |
| `engine/quarantine.js` | OPEN 6/6 | **OPEN 6/6**, all three roster stages re-run at 0 differ / 0 did-not-fire |
| `tests/test-tag-consumed.js` | 23 dead tags | **23** — all six new tags are consumed |

`ran` fell 2,253 → 2,250 and `theoretical` 9,405 → 9,376 because `carrierMoves` is usage-gated and the
corpus moved (below), not because the instrument covered less.

### THE CORPUS MOVED UNDER THIS, AND IT IS NOT #65

`data/tags.json` was regenerated four times. **ROADMAP #65's fix (b) is already in the tree** —
`fit_policy.loadCorpus` takes an explicit `scope` and `tag_dex.js` asks for `'all'` — so the five
entities #65 names (Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit, Leppa Berry) are all
**present**, and the regeneration diffed **0 removed, 0 added, 0 params moved, 10 tag lists changed**,
every one of them expected.

`sheet_entries` did fall, **142,884 → 139,644**, and the cause was isolated rather than assumed: the
committed `tag_dex.js` over the current store produces 139,644 too, and `ILLUSION_IN=1` produces
exactly 142,884. It is the **Zoroark exclusion** (Will's own 2026-08-11 decision) landing in
`loadCorpus` after the committed artifact was generated. Nothing to do with the fit's scope.

### A DEBT THIS PASS CREATED AND WAS NOT ALLOWED TO PAY, RECORDED SO IT IS NOT LOST

Moving the matrix to **1,641 of 2,250** staled four figures in **`docs/ABRA-technical-docs.md:530`**,
which still reads *"1,640 of the 2,253 tests can occur"* (and 1,638 / 32 in the same sentence).
`tests/test-docs-current.js` attributes them exactly: with the committed matrix artifact the "figures
a cited artifact does not contain" ratchet reads **68**, with this one it reads **72**, so **four of
the five new entries are this pass's** and all four are one sentence.

**IT IS NOT FIXED HERE, BY INSTRUCTION** — the living-docs pass is deferred and the technical docs are
explicitly out of scope for the sprint. It is a NUMBER RESTATEMENT of a quoted artifact, not a claim,
and it should go in the batch that closes the sprint.

**IT DOES NOT CHANGE WHETHER THE TREE COMMITS.** `tests/test-docs-current.js` was already red on both
clauses before this pass (ratchet 68 against a baseline of 67, and 44 untraceable figures), so the
pre-commit hook was already blocking and still is. The untraceable count went **44 → 43**. Stated
because "my change broke the hook" and "the hook was already broken and my change made one ratchet
worse" are different reports, and only the second one is true.

## TWENTY ARTIFACTS WERE NEITHER CLEARED NOR WITHHELD, AND THE SENTENCE EXPLAINING WHY HAD BEEN FALSE FOR TWO DAYS. 2026-08-11 (MEASURE).

`engine/quarantine.js` printed, of twenty files in `data/`: *"provenance.js finds a writer only in
engine/ and build/, so anything written by tests/ or through an unfollowed path variable is invisible
to this test."* **`GEN_DIRS` has read `tests/` since 2026-08-09 (ROADMAP #105), and not one of the
twenty was unknown for the reason given.** The sentence was typed once, was correct once, and outlived
what it described — the fourteen handoffs and the ban list of four, in the tool built to stop that.

It survived because the set was produced by **SUBTRACTION**: `quarantine.js` listed `data/`, removed
everything `provenance.js` had a row for, and attached its own explanation to the remainder. A
subtraction returns the same list whatever the cause, so nothing could contradict the caption.

**THE FIX IS THAT AN UNKNOWN IS A ROW.** `provenance.js` now emits a first-class row for every file in
`data/` — `unknown: true`, `by: null`, and a **derived** reason per file. `--graph --json` carries
them, and `quarantine.js` reads that set instead of computing its own. An artifact missing from the
report was the bug; an artifact present and marked unknown is the fix. The five reasons the source can
actually support, in descending order of what they tell you: the artifact **declared** an origin that
resolves to no script; a template matched and was **revoked** on key shape; **nothing** in
engine/build/tests names the file at all; only a **comment** names it; **code** names it but never
beside a write. The last is the honest answer for CONFIG — `regulations.json` and `quality-filter.json`
are read by 16 and 9 files and written by none, which is a fact this scan can state rather than a
category somebody has to remember to except.

**ONE OF THE TWENTY WAS A REAL MISS, AND IT WAS THE RELEASE POINTER.** `data/engine-release.json` — the
file every frozen measurement resolves through — is written by `engine/engine_release.js` and had no
row, because the write goes through a helper defined in the same file and then through an object
property:

    const POINTER = D('data', 'engine-release.json');
    function paths(s) { if (!s) return { releases: RELEASES, pointer: POINTER }; ... }
    function writeJsonAtomic(file, obj) { fs.writeFileSync(tmp, ...); fs.renameSync(tmp, file); }
    writeJsonAtomic(S.pointer, { current: id, ... });

Two arms close it, both derived and both bounded. A **same-file function whose FIRST parameter reaches
a verb that lands bytes at a path** counts as a write verb for that source — note the parameter never
reaches `writeFileSync` here, only `renameSync`, so an atomic writer reads as a non-writer unless the
rename counts. And **exactly one** hop of property indirection: a literal `pointer: POINTER` links the
binding to `S.pointer`. One hop, because this file's four recorded false attributions all came from an
arm reaching one step further than it could justify.

**SHOWN RED THREE TIMES BEFORE BEING BELIEVED.**

| planted | what it produced |
|---|---|
| `tests/test-provenance-discovery.js` run against the old code | 3 of 5 FAIL — 20 artifacts with no row, the two tools naming different sets, the pointer unattributed |
| `rootedIn` forced to `true` (the scratch-tree guard removed) | `engine-release.json` is attributed to **`tests/test-miltank-release.js`**, which writes that basename into a temp dir as a fixture |
| `provenance.js` blinded to `quality-filter.json` | `quarantine.js` **still names it**, with `NO REASON RECORDED — provenance.js did not examine this file at all`, instead of the file vanishing |

The second is the one worth keeping: the new helper arm is only safe because the `rootedIn` guard
holds, and a guard that has never been watched to fail is not a guard.

**AND THE SAME FAILURE WAS LIVE IN A THIRD PLACE — it would have been introduced BY this fix.**
`quarantine.js` classifies every row it gets from the graph. Feeding the new unknown rows straight into
that loop clears them: `by` is `null`, so no clause fires, so `quarantined` comes out **false**, and
`web/build-quarantine.js` asks only whether a row exists. Twenty artifacts would have moved from
`unclassified` to `clear` on the site, in the permissive direction, through a change to the thing that
refuses to default. They are split out and reported as unknowns.

**Two more stale-prose bugs found on the way, one fixed and one filed.** Fixed: `provenance.js`'s
ratchet recorded every future coverage growth under the typed reason *"the writer scan learned to see
tests/…"* — the cause of the 2026-08-09 event, filed in as the cause of all of them, permanently, in
the record that exists so growth cannot be laundered. It now states which files became visible and how
each writer was found. Filed, already on MEASURE's list: `engine/conformance.js`'s S13 still decides
"no generator writes it" with `allSrc.includes(file)` over source text. The derived answer now exists
with a reason attached and S13 should ask for it.

**NO PROVENANCE VERDICT IS PUBLISHED WITH THIS.** An ENGINE agent was rewriting `tag_dex.js`,
`tags.json` and `medicham2-browser.js` while it ran, and a release was cut at 05:51. The classification
of the twenty is a statement about the SOURCE TREE and stands; the staleness verdicts computed beside
it are against a moving tree and must be re-run once ENGINE lands. `data/quarantine-stamp.json` is
UNSAFE by construction — it content-digests both files edited here — and `node engine/quarantine.js
--check` was **deliberately not run**: it rewrites `citation_sites` from the currently-open gate, so a
gate that closes again would flag every existing citation as new.

Registered as ROADMAP #163.

---

## THE STAGING VOCABULARY IS TWO WORDS, AND WE ONLY HAD ONE. 2026-08-11.

ROADMAP #155–#160. Recorded here because it settles a question this file asked and left open on
2026-08-10: *"the remaining 25 need a CONSEQUENCE, not an adversary … it is built as its own concept
next."* It is built.

    faces        what the subject must be UP AGAINST     25 abilities + 29 moves   (was already built)
    thenWhat     what must happen AFTERWARDS             23 keys + 7 volatiles + 1 berry fixture
    tags         entities the artifact stated NOTHING about   30 abilities + 5 moves -> 0

**THE ORDER WAS FORCED AND IT IS THE LESSON.** `faces` and `thenWhat` are both keyed on the TAG, which
is what makes them cheap to extend — and it is exactly why they could not be extended to the thirty
abilities and five moves whose record read `untagged` with `params: {}`. **A scenario cannot be
derived from nothing.** So the tags came first, the tables second, and the engine defects third.

### THE TWO PREDICATES THAT OVER-MATCHED, PRINTED BEFORE THEY WERE WIRED

`announcesOnEntry` caught **20** on its first draft — Mold Breaker, Pressure, Unnerve, Supreme
Overlord and the four Ruin abilities all announce on entry and then do their work through a second
handler. Narrowed to "`onStart` is the ability's ONLY handler": **3**, and all three are already
owner-deferred for precisely that reason.

The draft `boostsOnFoeFaint` caught Eelevate and Beast Boost, **which already carry `boostsOnKO`**.
Two tags for one mechanic is the FACTS-ARE-GLOBAL rule broken inside the artifact itself. The existing
rule was widened instead — and that widening WAS the Moxie bug: it required `getBestStat`, which is
Beast Boost's implementation rather than the mechanic. **103 sheet fields went live with no engine
change at all.**

### THE FORME-CHANGE ASSERT MODE IS STILL OWED, AND SO IS THE ROSTER WIRING

Two things this pass did NOT do, stated so nobody reads the census movement as coverage movement:

1. **The absolute-assertion mode for the 37 abilities with no control body is not built.** The
   membership is now derivable — `refusesCopy` carries Showdown's own `notrace`/`noentrain`/
   `noreceiver`/`failroleplay`/`failskillswap`/`cantsuppress` flags off each ability, printed at 34 —
   so the class no longer has to be invented, but the three-part assertion (the forme changed, the
   stats are the new forme's, **the body's own SP spread survived**) has no harness yet.
2. **`tests/roster.js` does not read `faces` or `thenWhat`.** `all_mechanics_fire.js` does. The roster
   is the instrument behind the gate's `94 TESTED of 202 IN SCOPE`, so **that ratio has not moved and
   must not be quoted as though it had.**

### ONE BASELINE I MOVED, SAID OUT LOUD BECAUSE MOVING A BASELINE IS A JUDGEMENT

`tests/test-docs-current.js` went RED at clause 3b(b) while this entry was being written, and I ran
`--update`. **It adopted exactly ONE entry and I did not write the prose it points at:**

    known.citation_mismatches  ADDED  docs/MEDICHAM-SPRINT-NOTES.md|317|data/policy-weights.json

That is the figure **317** in this file’s existing paragraph about `engine/status.js`’s feature-semantics
failure (*“318 species -> 317”*) — a SPECIES COUNT quoted from a status message, sitting near a mention
of `data/policy-weights.json`, which of course does not contain it. It is a false citation match on
prose rather than a figure anybody sourced from that artifact. **Nothing else in the baseline moved**
(diffed field by field; only `generated` and that one string). Recorded here rather than left in a
JSON diff, because “the gate went green after somebody re-stamped it” is the shape this project has
already been bitten by.

### WHAT THE NEW FIXTURES EXPOSED

Five engine defects, every one of them pre-existing and invisible until something could stage it:
`piercesProtect` read by nothing (a name match plus a category test, wrong in both directions);
Entrainment/Simple Beam/Worry Seed and Guard Split/Power Split/Speed Swap resolving to whole no-op
turns; Trace SHOWDOWN-ONLY on 274 sheet fields. Census **437 → 444 live, 0 missing**; differential
**0 of 20,000**; gate **OPEN, six of six**, against release `abe83bf4fd3b` cut from this tree.

---

## THE GATE, at sprint start (release `13bda114d649` + the flat-heal cut)

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / abilities  0 differ, 0 did-not-fire, 84 match
FAIL  deliberate roster / items      0 differ, 3 did-not-fire, 137 match
FAIL  deliberate roster / moves     23 differ, 24 did-not-fire, 362 match
```

Census **330 live / 330 probed / 0 missing**. Damage stages **1728/1728 exact**.

**Not counted by the gate and not passing either:** `COULD-NOT-STAGE` is **316 rows** — 217 abilities,
91 moves, 8 items. Each carries a written reason. They are *unmeasured*, not clean.

---

## 2026-08-11 — THE GATE OPENED. ALL EIGHT REMAINING ROWS CLOSED.

`node engine/quarantine.js` reads **GATE: OPEN — all six clauses pass** for the first time.

| clause | reading |
|---|---|
| game differential | **0 of 20,000** disagree (seed 20260804), artifact re-written at n=20000 LAST |
| roster / items | 0 DIFFER, 0 DID-NOT-FIRE, 139 tested — release `82250b3c3139` |
| roster / abilities | 0 DIFFER, 0 DID-NOT-FIRE, 94 tested — same release |
| roster / moves | 0 DIFFER, 0 DID-NOT-FIRE, 427 tested — same release |
| coverage | all 412 moves above 25 clicks measured by the roster or the census |
| no open engine defect | **0** open rows |

Census **423 → 437 live / 437 probed / 0 missing / 0 hollow / 0 unarmed / 0 direct-call.** Fourteen new
probes. Release `82250b3c3139` was cut from this tree and reads **0 of 24 files moved**, so the three
roster runs are a photograph and not a moving tree.

| row | what it was | what closed it |
|---|---|---|
| #117 | thirteen action kinds never recorded `_lastMove` | already landed; **re-measured over all 500 moves and all 37 kinds — 0 fail**. Probe is the payoff: Encored into Trick Room, the room comes DOWN (4 → 0) |
| #118 | the Choice lock did not arm on a status move | already landed; re-measured — 9 status kinds arm it, `choiceLockArmedOnStatus` = 9 |
| #119 | Struggle was a silent no-op | already landed; re-measured — 50 damage, 64 max-HP recoil, real `\|move\|` line; and a Scarf lock onto a Disabled move at FULL PP Struggles |
| #123 | the semi-invulnerability exception list was absent | **two lists**, both derived. EQ into Dig 23 → 46, Iron Head into Dig 51 → 0, Surf into Dive 29 → 57, Hurricane into Fly 94 → 94. `invulnPierced` 6 vs `invulnDoubled` 4 |
| #125 | the terminal `{kind:'pass'}` had no counter | counter in FIRST, with a per-move histogram. The queue is **15 moves / 307 clicks**, not 32 / 1,702. Ratcheted |
| #126 | Quick Guard was the only broken priority refusal | already landed; re-measured — QG blocks Quick Attack and Fake Out and not Earthquake; Wide Guard is the mirror |
| #128 | six of seven berry abilities unimplemented | one `consumeBerry` site + `_lastItem`/`_ateBerry`; six new derived tags. Sitrus 118 / Cheek Pouch 170 / Ripen 160 / Cud Chew 118→160; Harvest and Pickup measured |
| #147 | the grounded axis, five missing inputs | five inputs **and** the real defect: the Ground immunity read the type chart instead of `isGrounded()`. EQ into Corviknight 0 → 148 under Gravity, 0 → 139 Smack Down, 0 → 138 Ingrain; 167 → 0 Magnet Rise; Roost through a type deletion |

**Two things were fixed that no row named**, and both are recorded because they would otherwise look
like the gate being talked into opening:

- **The clause itself.** With all eight closed it still counted five, scanning PROSE case-sensitively —
  four rows headed `— CLOSED 2026-08-11` in capitals went on counting, and **#148 counted ITSELF** for
  quoting the breakage vocabulary. It reads the row's **status cell** now; printed before wiring, it
  newly clears 16 rows and every one is stamped closed/DONE in that cell; `PART DONE` is refused; shown
  RED on a planted row carrying a number no register holds, first.
- **The report contradicted itself the moment the gate opened** — `GATE: OPEN — nothing is withheld`
  above `47 … are WITHHELD`. Open, those 47 are **re-runnable and stale**, and it says so (ROADMAP #57).

**Reds that are not this batch's**, each reproduced in a throwaway worktree at `f8f2c67`:
`test-stadium-roster` (another division's `engine/million_targets.js`), `test-quality` (the store grew
20,688 → 52,840 under it), `test-web-quarantine` (the board payload was built while the gate was closed —
WEB rebuilds it), `test-tag-consumed` (`piercesProtect`, staged only by another division's
`engine/faces.js`). Full list in `docs/ENGINE.md`.

---

## ROWS CLOSED THIS SPRINT

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 1 | **Iron Ball** | 139 | `speedMult` matched `name === 'choicescarf'`. The CONSUMER worked and was starved. Derived from `onModifySpe` | DID-NOT-FIRE → MATCH |
| 2 | **Light Ball** | 41 | `statMult` matched four names, **all four banned here**, and nothing read the tag; `dmgRange` carried three matching permanently-false conditions. Derived, with the Pikachu lock carried | DID-NOT-FIRE → MATCH |
| 3 | **Oran Berry** | 1 | heals a **flat 10**, not a fraction; the regex read only `maxhp/N`. `restoresFlat` derived beside `restores`, deliberately NOT scaled by max HP | DID-NOT-FIRE → MATCH |
| 4 | **Big Root** | 53 | no tag at all. `healMultBySource` derived from `onTryHeal` — the SOURCE LIST is part of the fact and is carried, so it boosts drain and Leech Seed and nothing else | DID-NOT-FIRE → MATCH |
| 5 | **Shell Bell** | 44 | no tag at all. `healFromDamageDealt` derived; sits beside recoil because both are a fraction of damage ACTUALLY dealt. **Took two passes:** `Math.round` was one high every turn — the authority clamps <=1 to 1 and then TRUNCATES | DID-NOT-FIRE → DIFFER → MATCH |
| 6 | **Metronome** | 19 | **SHELVED BY WILL, not fixed.** Tag derived and correct; the consumer needs a per-body consecutive-use counter threaded through the turn loop and read in `dmgRange` — every move's damage path, for the smallest row in the queue | DID-NOT-FIRE → DEFERRED-BY-OWNER |

| 7 | **Counter, Mirror Coat, Metal Burst, Comeuppance** | 16 | **ENGINE FIXED AND VERIFIED — ROSTER ROW HAS NOT MOVED, CAUSE UNKNOWN.** See the open item below. | DID-NOT-FIRE → *unchanged* |
| 8 | **Cotton Spore, String Shot, Sweet Scent** (+ Teeter Dance, which was not a roster row) | — | the `affect` branch resolved ONE `_t`, so every spread STATUS move moved slot 0 and left slot 1 alone. Target list derived from `spreadFoes` / `spreadAll`, gauntlet run per body. **Roster not re-run by me** — `tests/roster.js` is Will's to run against a frozen tree | DID-NOT-FIRE → *awaiting the roster re-run* |
| 10 | **Stockpile, Spit Up, Swallow** (WIRE 152) | 66 | the string `stockpile` appeared **zero times** in `medicham2-browser.js`. `statusInflict` said "apply the volatile" and the generic path wrote a **duration of 1** — so the counter never climbed, the +1/+1 never landed, Spit Up dealt 0 with two layers up and reported `result true`, and Swallow moved a body 40 → 40. Fixed at the DERIVATION first: two new tags, `layeredVolatile` (the cap, the per-layer boost, and that the refund is only what it GRANTED) and `spendsVolatile` (the entry fee and when it is paid), plus `variablePower{volatileLayers}` and `healsSelf.byVolatileLayers`. `data/tags.json` + `data/abra-tags.js` regenerated: **0 entities removed, 0 added, 3 changed**. **Roster not re-run by me** | DID-NOT-FIRE → *awaiting the roster re-run* |
| 9 | **Guard Swap, Power Swap, Psych Up, Topsy-Turvy, Acupressure** (WIRE 151) | 99 | all five resolved to `{kind:'pass'}` — a whole no-op turn — because both doors out of `statChangeInCode` demand a LITERAL boost table and all five carry `{procedural:true}`. Belly Drum and Strength Sap, the only two members WITH `boosts`+`on`, were the only two that worked. Fixed at the DERIVATION: `statChangeInCode` gained an **`op` descriptor beside `boosts`, never inside it** (`exchange` / `copy` / `invert` / `randomOne`, each with its stat subset), read out of each handler's own shape; one engine primitive `applyStatOp` consumes all four. `data/tags.json` + `data/abra-tags.js` regenerated: **0 entities removed, 0 added, 5 changed**. **Roster not re-run by me** | DID-NOT-FIRE → *awaiting the roster re-run* |

| 11 | **Substitute, Imprison, Destiny Bond, Stockpile, Focus Energy, Endure, Magnet Rise, Power Shift, Power Trick** (WIRE 153) | see below | a `target: 'self'` status move clicked with **no target** built an empty `_tl` and fell to `mvFail` — a whole wasted turn. Eight of the nine applied **no volatile at all**; Substitute is the exception and is stated loudly below. Target now **derived from the move's own `target` field**, not defaulted. Engine-only: no tag change, `data/tags.json` untouched. **Roster not re-run by me** | DID-NOT-FIRE → *awaiting the roster re-run* |

Row 11's per-move `uses` are quoted in its own section at the foot of this file, each beside the move
it belongs to, so every figure sits next to the `data/tags.json` entry it was read out of.

Census at the close of WIRE 151 was **364 live, 364 probed**; that reading is superseded by row 10
below and the artifact has moved on from it. The current figure is quoted with row 10. The
before-state, the damage-stage gate and every other figure for this row are in `docs/ENGINE.md`'s
WIRE 151 section, each beside the measurement it came from.

**WIRE 151, the parts a one-line row cannot carry** (full section in `docs/ENGINE.md`):
- the first `randomOne` shape rule **over-matched** — a bare `this.sample(` claimed Sleep Talk,
  Metronome, Assist and Conversion 2, which pick a MOVE. Tightened to require a `.boosts[…] < N`
  ceiling AND a `this.boost(` call; final membership over 954 moves is six, the fifth being Heart Swap
  (`isNonstandard: 'Past'`, unplayable here). Printed before wiring, per docs/LESSONS.md 4;
- **two stale comments retracted in place with measurements**, both claiming evasion is *"a stat this
  engine has no slot for"*: a real Defog click moves the target's `eva` 0 → −1, and a Supersweet Syrup
  switch-in puts BOTH foes at `eva` −1. All seven slots exist. It matters — Psych Up copies accuracy
  and evasion, Topsy-Turvy inverts them, Acupressure can draw them;
- **one pre-existing defect fixed because this wire would have extended it**: the `affect` branch's
  Protect gate was a bare `if(_t.protect)` with no `ignoresProtect` clause, so it also blocked
  **Tearful Look**, which goes straight through a Protect in the authority. Measured before/after with
  Charm as the control (still blocked, correctly);
- blast radius: every move in `data/tags.json` × 6 scenarios × 2 real turns, whole-board digest —
  **879,848 cells, 126 differ, 5 moves, 0 THREW on both arms**. The throw count is printed beside the
  diff count because WIRE 150's first sweep read "0 differ" over 3,000 cells that had all thrown;
- **a release was cut that I did not intend**: `tests/test-nature-differential.js` requires
  `engine/game_differential.js`, whose line 126 auto-cuts when `REL_ID` is unpinned. Release
  `ea58415e1cd8` was cut over the mid-work tree and `data/engine-release.json`'s `current` moved from
  `cb831e50eafb`. **Left exactly as written, nothing reverted or deleted** — see ENGINE.md.

Census at the close of WIRE 152 was **369 live, 369 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed**
— up five on the five probes this row added, `directCall` unchanged. That reading is superseded by row
11 below; the current figure out of `data/mechanics-census.json` is quoted with row 11. The
damage-stage gate is exact and unmoved.

**WIRE 152, the parts a one-line row cannot carry** (full section in `docs/ENGINE.md`, where every
figure below sits beside the measurement it came from):
- five new probes, each watched RED on its own before the engine changed. **No release was cut by
  me**; `tests/roster.js` and `tests/test-engine-diff.js` were not run;
- **the fifth probe was red against a wire that was already written, and that is the best thing in
  this row.** `spendsVolatile` was the one new tag no probe carried — the census said so, `unprobed`
  went up by one — and writing that probe found a real defect: a **Spit Up into a Protect kept its
  layers**. `onAfterMove` is run by `useMove`, one level ABOVE `useMoveInner`, outside every hit,
  miss and shield refusal, and the first version paid it at the bottom of the attack branch, which a
  fully-shielded move never reaches. The debt is now marked at the onTry gate and settled beside
  `_updateAll`, which is the pattern this file already uses for the same ~30-`continue` problem;
- **a duration is not a count, and this is the third time that difference has cost a mechanic here.**
  `_vol[name]` held a clock everywhere else in the file, so the no-restart rule ROADMAP #111 added for
  Taunt was the correct rule applied to the wrong kind of number. `layeredVolatile` is what makes the
  artifact say which one `_vol` is holding;
- **the trap probe is the one that earns its place.** Stockpile books the stages it ACTUALLY granted,
  so a body at +6 Def is owed nothing back. Demonstrated by mutation rather than argued: booking the
  INTENDED delta instead of the granted one turns that probe RED at `6/2 -> 4/0` and leaves the other
  three GREEN, which is what says the four probes are not one probe written four ways;
- **Swallow uses `md4096`, not WIRE 150's `Math.round` arm**, because its handler is
  `this.heal(this.modify(maxhp, healAmount[layers-1]))` — a `modify` call, like the weather family, not
  a plain round over an exact integer pair. It shows: 125 / 2 through `modify` is **62**, not 63;
- **membership printed before every rule was wired**, per docs/LESSONS.md 4. Six moves call
  `removeVolatile` in an onHit/onAfterMove and four of them are clearing somebody ELSE'S condition, so
  `spendsVolatile` demands the onTry require the SAME volatile the handler removes — membership then is
  exactly {spitup, swallow}. Two moves count `effectState.layers`; G-Max Chi Strike declares no
  `volatileStatus` and is `isNonstandard: 'Past'`, so `layeredVolatile` is a membership of one;
- blast radius: every move in `data/tags.json` × 6 scenarios × 2 real turns, whole-board digest
  (the move RESULT is in the digest on purpose — a failed click and a modelled no-op leave identical
  HP) — **3,000 cells, 15 differ, 3 moves, 0 THREW on both arms**. BEFORE is frozen release
  `ea58415e1cd8`, whose engine bytes are this wire's tree minus its own hunks, verified by diff. A
  second sweep family of the same size, with two Stockpile turns played FIRST, moves almost every cell
  in it — that is the mechanic working rather than blast radius, and it is counted apart in ENGINE.md
  for exactly that reason;
- **NOT CLOSED, MEASURED, AND NAMED SO IT IS NOT MISTAKEN FOR DONE:** a self-targeting `affect` move
  clicked with **no target supplied** still fails. `_tl` is empty and the branch calls `mvFail`, so
  Stockpile does nothing on 3 of its 6 no-prelude sweep cells. It is PRE-EXISTING and general, not this
  wire's: the membership is **nine moves** — `destinybond`, `endure`, `focusenergy`, `imprison`,
  `magnetrise`, `powershift`, `powertrick`, `stockpile`, `substitute` — with their usage counted in
  ENGINE.md. It is left alone deliberately because fixing it changes Substitute's targeting and cannot
  be checked without the roster
  or the differential to check that. Stockpile IS reachable through the live consumers —
  `rollout_leaf.js` passes a live foe for every click, and the `to:'user'` effect then lands on the
  user — so this is a gap in one entry path, not a dead mechanic. It wants its own wire.

**ITEMS CLAUSE CLOSED: 6 open → 0. The gate is now 3 of 4 PASS.**

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / items      139 matched (1 deferred, still staged and printed)
PASS  deliberate roster / abilities  84 matched
FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
```

---

## ENCORE, DIAGNOSED — the lock is applied at SELECTION; Showdown applies it at EXECUTION

Diagnosed by `@measure` against frozen release `a59b885861cd`. **Not yet fixed** — `@engine` owned the
file. Will: *"fix encore when the other agent is done."*

**THE MECHANISM.** The Encore in this scenario lands **mid-turn**: p1a is faster and Encores p2a AFTER
both sides' actions were collected. Our `mk()` runs for all four bodies before the queue is sorted, and
at that instant `mon._lock` is still null — Encore is written later, at move resolution. So the WIRE 24
rewrite evaluates **once per turn, at the wrong instant**, and never fires.

```
SHOWDOWN turn 2                              MEDICHAM turn 2 (frozen)
  |-start|p2a|Encore                           |-start|p2a|move: encore      <- volatile IS set
  |move|p2a|Dragon Pulse|p1b Corviknight       |move|p2a|dragonclaw|p1a      <- SELECTED move, unchanged
  |-damage|p1b  (-36)                          |-damage|p1a  (-55)
  |move|p2b|Dragon Claw|p1a  (-39)             |move|p2b|dragonclaw|p1a  (-39)
```

**THE CONTROL IS THE SHARPEST STATEMENT OF IT.** The roster's control arm replaces the Encore click
with the inert click, and its turn-2 board is **bit-identical to our subject arm**. Landing the Encore
changed nothing whatsoever in our engine.

**AUTHORITY** — `sim/battle-actions.ts:223-234`, inside `runMove`, i.e. PER ACTION AT EXECUTION:

```ts
const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
if (changedMove && changedMove !== true) {
    baseMove = this.dex.getActiveMove(changedMove);
    baseMove.priority = priority;                          // the bracket we already fixed
    target = this.battle.getRandomTarget(pokemon, baseMove);   // <- and the target is RE-ROLLED
}
```

Only reachable when the Encore lands after the victim's choice was locked in — on any later turn
`onDisableMove` removes the other moves from the request, so the chosen move already equals the encored
one. **A fast Encore into a slower foe is the whole of the reachable set, and it is common.**

**THE PRECEDENT IS IN THIS FILE.** `WIRE 119 — "TAUNT AT EXECUTION TIME"` gave Taunt BOTH halves: a
menu filter in `chooseAction` and a second check in the dispatch loop for the mid-turn case. **Encore
only ever got the first half.**

**TWO HALVES ARE NEEDED** and the row stays red after either alone:
  1. Re-evaluate the lock in the per-action dispatch loop, ABOVE the confusion / paralysis / recharge /
     Throat Chop / Taunt gates — those are `BeforeMove` handlers and `OverrideAction` fires first.
     `_selMv` STAYS at collection time; the priority-bracket fix depends on it.
  2. `targetForMove` picks the **highest-damage** live foe; Showdown's `getRandomTarget` picks a
     **uniformly random** adjacent one. Different functions.

**RULED OUT, measured:** not damage (Torterra's identical unencored Dragon Claw deals 39 in BOTH
engines), not the volatile or its counter, not `targetForMove` mis-aiming (that code never executed),
not the fixture (control agrees leaf-for-leaf), not the harness (it reproduced the published verdict
and HP values exactly).

**INCIDENTAL, reported not acted on:** we emit no `|-fail|` for the turn-1 Encore that correctly
refuses. Boards agree so the state comparator is silent, but the PROTOCOL arm of
`game_differential.js` would see it.

### FIXED — WIRE 143, both halves, 2026-08-10

| # | row | uses | what it was | verdict move |
|---|---|---|---|---|
| 9 | **Encore** | 6,102 | the `onOverrideAction` half had never been wired. `mk()` reads `_lock` before the queue is sorted, and a mid-turn Encore is written after that — so on the ONE turn the override is reachable, `_lock` is still null. Half 2: the target is re-rolled UNIFORMLY (`getRandomTarget` → `side.randomFoe()` → `sample(foes())`), and `targetForMove` picks the hardest hit | FIRED-AND-BOARDS-DIFFER → **awaiting Will's roster re-run** |

Census **333 → 335 live, 335 probed, 0 missing, 0 threw**, on two new probes:
`an Encore landing MID-TURN overrides the action its victim already chose` and
`the encored move's target is RE-ROLLED, not aimed at the best foe`. Both shown RED first.

**THE ROW STAYS RED AFTER EITHER HALF ALONE, AND IT WAS SHOWN.** With half 1 landed and the target
taken from `targetForMove`, the census reads **334 live / 1 missing** — the re-roll probe goes red on
its own while the override probe stays green.

**THE BRACKET DID NOT MOVE, AND IT IS SAFE BY CONSTRUCTION.** `_pri` is frozen above the loop and
`turnOrderKey` reads it without recomputing, so `_selMv` stays a collection-time field and finding #2
above is untouched. Measured on the reachable case (Prankster Whimsicott 116 Encores a Garchomp 102
that clicked Quick Attack, Dragapult 142 behind them): Garchomp executes the ENCORED X-Scissor and
still moves before the 142, which is `baseMove.priority = priority` exactly.

**THE RE-ROLL TAKES THE ENGINE'S OWN SEEDED `rng`, NEVER `Math.random()`,** and draws only when an
override actually fires — so the differential and the roster draw the sequence they drew before.

**NOT CLAIMED: the roster verdict.** `tests/roster.js` was not run — it is Will's to run against a
frozen tree. The row's state is unknown, not closed.

**FOUND AND NOT FIXED:** an Encore into a **status** move still cannot be honoured through the WIRE 24
selection path, because `targetForMove` opens `if(!mv||!hasPower(mv))return null`. The new
execution-time path goes through `playerAction` and does not have that limitation, so the two paths
now disagree about status moves. It is a change to the Choice-lock rewrite that every Choice holder
rides, and it needs a probe of its own.

---

## THE LOCK-IN FIVE — WIRE 144, 2026-08-10. TWO CAUSES ON ONE ROW, AND ONE OF THEM IS NOT IN THIS DIVISION.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 10 | **Outrage, Petal Dance, Raging Fury, Thrash, Uproar** | 101 | TWO independent causes stacked on one `move/plain-attack` row, either of which alone produces the same silent nothing. (a) all five are `target: "randomNormal"`, the request names no target, and `playerAction`'s attack branch is gated on `&& target` — so the click degraded to `{kind:'pass'}`, a NO-OP TURN, both turns. (b) there was no lock at all: turn 2 was a free choice and the user never fatigued | DID-NOT-FIRE → **awaiting Will's roster re-run, AND SEE THE DRIVER CAVEAT BELOW** |

Census **335 → 342 live, 342 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.**
Seven new probes, **all seven shown RED first** by cutting the six new branches to `if(false&&…)`:
under the cut the census reads **335 live / 7 missing**, and each red for its own reason — the
targetless Outrage dealt **0** and aimed at `p1a` (itself), the die returned `p2a` at both rng values,
turn 2 played Dragon Claw, confusion read `[0,0]`, Outrage ran **1** turn and Uproar ran **1**, the
locked body switched out, and the Spore landed on a body an Uproar should have shielded.

### THE ROW MAY NOT MOVE, AND THAT IS NOT EVIDENCE ABOUT THE ENGINE

`engine/game_differential.js` — the driver `tests/roster.js` runs through — resolves a medicham target
from Showdown's target type and handles five kinds (`normal`, `any`, `adjacentFoe`, `adjacentAlly`,
`adjacentAllyOrSelf`). `randomNormal` matches none, so `foeSlot` stays null and
`M.playerAction(mon, 'outrage', null, field)` is called with no target. Diagnosed in parallel by
`@measure`; **deliberately not fixed here** — it is the shared instrument, it is outside ENGINE, and a
competing repair would collide. The same root cause covers Counter / Comeuppance / Metal Burst
(`target: "scripted"`), i.e. **8 of the 20 DID-NOT-FIRE rows**.

**The engine half is nonetheless real and is now correct:** a targetless `randomNormal` click lands,
which it did not before, so the driver repair and this wire are both required and neither is
sufficient.

### THE FELT NUMBER IS NOT THE INTERNAL COUNTER — HERE THEY ARE THREE DIFFERENT NUMBERS

`lockedmove` (`data/conditions.ts:253`) declares `duration: 2` and that is **not** how long it lasts:

| handler | line | what it does |
|---|---|---|
| `onStart` | `trueDuration = this.random(2, 4)` | 2 or 3 — **the real length** |
| `onRestart` | `if (trueDuration >= 2) duration = 2` | the 2 is a re-armable window, not a length |
| `onResidual` | `trueDuration--` | ticks with the turn, whatever the body did |
| `onAfterMove` | `if (duration === 1) removeVolatile(…)` | |
| `onEnd` | `if (trueDuration > 1) return; addVolatile('confusion')` | fatigue **only on a full run** |

So the forced-turn count equals `trueDuration`, and the declared `duration: 2` is a coincidence at the
low end of the range. `uproar` has no `trueDuration` at all: `duration: 3`, decremented in the residual
**of the turn it lands**, so it is three turns and there the declared number *is* the answer.

**THE CONVENTION USED, AND WHY: the MINIMUM of the range, 2.** Every arm in
`engine/game_differential.js` pins Showdown's RANGE form of `random` to the **bottom** (`return m;`),
so the authority draws 2 under measurement; medicham2's `rng` is a single scalar and a
`min + floor(rng()*span)` would read 3 under the top-corner arm and part from it. This is the identical
decision `CONFUSION_TURNS_MIN` already states. **It is corroborated rather than assumed:**
`data/roster.moves.json` recorded Showdown's own board on this exact staging *before a line was
written* — `p1.active[0].vol.confusion = 2` at **turn 2** — which is a 2-turn Outrage followed by a
fatigue counter of 2. The probe asserts that number.

### THE TAG OVER-MATCHED, AND IT WAS PRINTED BEFORE IT WAS WIRED

`m.self.volatileStatus && condition.onLockMove` catches **eleven** moves in this format, not five —
the six `mustrecharge` moves answer `onLockMove` too, because a recharge turn is also a locked menu.
The discriminator is mechanical, not a name: `mustrecharge` additionally carries an `onBeforeMove` that
announces `cant` and returns null — it **refuses** the action — where the lock-in family carries none
and lets the forced move run. Final membership, printed: `locksIntoMove` = the five exactly;
`randomTarget` = those five **plus Struggle**, which is right and is why it is a separate tag.

`data/tags.json` was regenerated and **diffed against its predecessor: 0 entities removed, 0 added, 6
changed** (the five plus Struggle). ROADMAP #65's hazard is gone — `tag_dex` reads `scope:'all'` — and
this run confirms it: Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit and Leppa Berry are
all still present.

### WHAT THE FIVE NOW DO, AND EACH LINE IS THE AUTHORITY'S

- **A `randomNormal` click with no named target lands.** `playerAction` prices it against the
  hardest-hit foe (a valuation, not a decision — the same rule ROADMAP #81 WIRE 9 uses for spreads).
- **The target is re-rolled UNIFORMLY at execution, whatever the player named.** `sim/battle.ts:2461`
  gates the chosen-target branch off for randomNormal, so it always falls to `getRandomTarget` →
  `side.randomFoe()` → `sample(this.foes())`. Drawn from the engine's **own seeded `rng`** — the stream
  already threaded through the turn for accuracy, crit and damage — never `Math.random()`, and only
  when one of the six is actually executing. It does not double-draw over an Encore override, which has
  already applied the same rule.
- **Turn 2 repeats the move, binding a caller-supplied action** (the WIRE 24 rule).
- **A locked body is TRAPPED.** `Pokemon#getMoveRequestData` sets `this.trapped = true` the moment
  `getLockedMove()` answers. This is a **harder** lock than the Choice one, which deliberately leaves
  the switch legal — reading one off the other would have made switching out of an Outrage free.
- **The clock ticks in the residual, in the authority's own order:** decrement, then expiry, then the
  sleep clause. So a body flinched on its last locked turn still fatigues, and a body put to sleep with
  a turn still to run is *calmed* — `delete volatiles[…]`, not `removeVolatile`, so `onEnd` never runs
  and there is no confusion.
- **The lock leaves with the body**, with no fatigue (`clearVolatile`).
- **Uproar wakes every sleeper on the field, both sides**, including its own partner, and **refuses
  sleep while it runs**. Both read off handlers (`wakesSleepers`, `blocksSleep`), never off the name.

### FOUND AND DELIBERATELY NOT FIXED

- **Uproar's Throat Chop clause.** `uproar.onResidual` removes the volatile if the holder carries
  `throatchop`, and it also declines to lock after a Struggle. Neither is modelled. Uproar is 3 corpus
  uses and both need their own shape rule; stated rather than smuggled in.
- **Encore over a lock-in.** The WIRE 143 execution override would rewrite a locked action. In the
  authority a locked body's request offers one move and Encore's `OverrideAction` still runs, so the
  interaction is genuinely ambiguous. Not staged, not guessed at.
- **`tests/test-no-silent-failure.js` is RED, and it was red before this pass.** 20 NEW silent catch
  blocks against the 2026-08-06 baseline, in `champions_sim`, `diff_swarm`, `explain_divergence`,
  `leaf_engine_contrast`, `provenance`, `quarantine`, `tag_dex:332` (`partialTrapShape`), `roster` and
  `test-web-quarantine` — **none of them mine.** The one I did add was caught by it and made to speak
  before this was written, taking the count 21 → 20. Reported, not filed: it needs an owner.
- **`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is also pre-existing.** Measured
  rather than assumed: with all six WIRE 144 branches cut to `if(false&&…)` the eight changed digests
  are **bit-identical**, so this wire moves no fixture-board feature. It is a REFIT OWED and belongs to
  MEASURE.

### THE ARTIFACT REGENERATION HAD THREE SIDE-EFFECTS, EACH CHECKED

Regenerating `data/tags.json` re-reads the game store, which OPS appends to continuously
(`sheet_entries` 137,148 → 138,084 during this pass). That moves every usage count, and three prose
figures citing the artifact went stale — `tests/test-docs-current.js` **went red on it and was fixed
in this session, not filed**. Confirmed it was the cause rather than a coincidence by swapping the old
`tags.json` back in: 21/21 passed, and 20/1 with the new one.

- `docs/TAG-COVERAGE.md` — four usage figures re-read to today's artifact: `resistBerry` **13,232**,
  `passiveHeal` **8,495**, `blocksBerries` **2,326**, `punishesAttacker` **11,819**. Values only; the
  entity counts and the 3.40.0 snapshot table are untouched. **The superseded readings are deliberately
  NOT restated here** — quoting them beside the citation made the same check red a second time, which
  is the check doing exactly its job. They are in the file's own history.
- `docs/GAME-DIFFERENTIAL-DESIGN.md` — the *99%-of-usage coverage bar* sentence was split into its own
  paragraph. It states a THRESHOLD from `tests/test-medicham-coverage.js`, and standing in a block that
  cited `data/tags.json` made the check read it as a figure attributed to that artifact. The check was
  right about the attribution; the number was never wrong.
- `data/abra-tags.js` — the browser copy, rebuilt from `tags.json` by `build/build_tags_js.js`. It was
  **already one regeneration behind before this pass** (17:09 against 20:56) and now matches. Stated
  because it is a WEB-consumed artifact that this pass moved.

---

## WIRE 145 — A LOCK INTO A STATUS MOVE STRUGGLED. ONE GUARD, TWO CALL SITES, FAILING IN OPPOSITE
## DIRECTIONS. 2026-08-10.

Census **342 → 346 live, 346 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, all four shown RED on the unmodified tree first. Defect measured by the router before dispatch;
the fix and the probes are this pass. **No engine release cut and `tests/roster.js` not run** — a
read-only agent was mid-diagnosis and `engine_release.open()` with no id reads a POINTER, so a cut would
have swapped the release under a live measurement.

### THE ROW

`_lock` is honoured in three places. Locked into an ATTACK all three agreed. Locked into a STATUS move:

| where | locked into an attack | locked into a **status move** |
|---|---|---|
| `chooseAction` | correct | returned `{kind:'struggle'}` |
| `mk()` WIRE 24 forced action | correct | lock silently ignored, kept the caller's own click |
| WIRE 143 execution override | correct | correct |

**ONE CAUSE.** Both broken sites resolved the lock through `targetForMove`, which opens
`if(!mv||!hasPower(mv))return null` because its job is to **rank foes by damage**. All **175 legal
status moves in this format have base power 0**, so "this move cannot be used" and "this move has no
damage to rank" arrived at the two callers as the same null. A guard doing a job it was never scoped
for — the fourth instance of that shape this sprint.

**AND IT WAS WORSE THAN A NO-OP DAMAGE NUMBER.** `{kind:'struggle'}` matches **no branch** in the
dispatch loop (`if(a.kind!=='attack')continue`), so a status-locked body emitted no `|move|` line at
all and the whole turn vanished. Measured on the live tree before a line changed, both foes passing:

```
lock=knockoff   -> |move|p1a|knockoff|p2b    foe -22   <- normal
lock=taunt      -> (no line at all)          foe   0
lock=tailwind   -> (no line at all)          foe   0   twA still 0
lock=trickroom  -> (no line at all)          foe   0   tr  still 0
handed dragonclaw while locked into taunt -> |move|p1a|dragonclaw|p2a  foe -46   <- lock ignored
```

**WHY IT IS WORTH MORE THAN A GATE ROW** (Will's framing, and it is the correct one): Encore exists to
lock a body into a move that is **useless when repeated** — Protect, Trick Room, Tailwind, a Taunt
already landed. The victim is supposed to burn turns. This engine handed it a fresh attack instead, so
Encore was not mis-simulated, it was **INVERTED**: clicking it *helped* the victim, and anything fitted
against that learns Encore is bad.

### THE FIX IS A RE-ROUTE AND IT IS KEPT THAT SIZE

`lockedAction(me,id,live,field,rng)` — one function, called by both broken sites.

- **The attack path is byte-for-byte unchanged.** `hasPower` is asked *here*, as a classification, and a
  damaging lock still goes to `targetForMove` (best foe by damage) and draws no rng. The Choice holders
  that ride that line every turn are the control this fix must not move, and they do not move.
- **The status path builds through `playerAction`** — the same builder a normal click uses, which
  already returns `{kind:'affect', mv:'taunt'}` correctly and always did. The lock simply never called it.
- **The repeat semantics were already correct and were not rebuilt.** Trick Room's second click ends the
  room; Tailwind's counter ticks rather than refreshing. The only broken thing was that the locked move
  never reached them.

**WHAT DOES A LOCKED STATUS MOVE TARGET? A uniform draw over the LIVING foes, from the engine's own
seeded `rng`.** Stated explicitly because it is a decision: (1) it is the rule this file already
implements twice — `chooseAction`'s Encore branch and WIRE 143's `getRandomTarget` re-roll — so this is
a **third caller of one rule, not a third rule**; (2) the ranker cannot answer, a status move having no
damage to rank; (3) `Math.random()` is never reached and the draw happens **only when a status lock
resolves**, which before this wire never happened — so every existing seeded probe, the differential and
the roster draw the identical sequence they drew before.

**ONE MORE CHANGE, AND IT IS DELIBERATE.** The WIRE 24 skip test was
`!(_a.kind==='attack'&&_a.move.id===mon._lock)` and is now `actionMoveId(_a)!==mon._lock`. A status
action carries its id in `mv`, not `move.id`, so the old shape could not see that a handed action was
*already* the locked move and would rebuild it and draw a die for nothing. Side effect, checked rather
than discovered later: a body Choice-locked into **Pollen Puff** and handed an ally-aimed `allyheal` now
keeps the ally aim instead of being re-pointed at a foe, which is what the authority allows.

### THE FOUR PROBES, ALL SHOWN RED FIRST

| tag | what it proves | its control |
|---|---|---|
| `sealsMoves` | a lock into a status move PLAYS it, not Struggle (`chooseAction`, nothing handed in) | a lock into **Knock Off** on the same board — and a third arm, the identical Taunt hand-clicked with **no lock**, so a red can never mean "this engine cannot Taunt" |
| `choiceLock` | the lock binds a **caller-supplied** action into a status move (`mk()`) | Dragon Claw handed in on every arm; a Knock Off lock rewrites it, and with no lock at all it stays Dragon Claw |
| `locksTarget` | **the payoff** — locked into Trick Room the victim re-clicks it and the room it just set comes **DOWN** | the identical two clicks (Trick Room, then Dragon Claw) with the lock absent: the room stands, tr 4 → 3, and the Dragon Claw lands |
| `sealsMoves` | the target is a uniform die | the same lock, only the seeded rng varied — 0.1 → p2a, 0.9 → p2b. Guard: an ordinary hand-clicked Taunt named at p2a hits p2a at **both** values, so nothing else was re-aimed |

Red readings before the fix: `NONE` / `dragonclaw` / `dragonclaw`+tr 3 / `NONE` at both die values.

### COUNTERS

`MEDSEEN.lockedIntoStatusMove` (fires; reads exactly 2 after two staged status locks, 0 after an attack
lock and 0 with no lock) and `MEDFAILS.lockStatusUnbuilt`, which exists because a lock into a status
move this engine has no branch for still SPENDS the turn — a body cannot escape a lock by holding an
unmodelled move — and "the mechanic ran" must not arrive at the same counter as "the mechanic ran into
something we do not model".

### FOUND AND DELIBERATELY NOT FIXED — reported, not absorbed

- **STRUGGLE IS NOT IMPLEMENTED AT ALL, and the earlier reading of "Struggle does no recoil" is a
  correction rather than a confirmation.** Measured with `{kind:'struggle'}` handed straight to the
  acting body, both foes passing: **0 to the foe, 0 to the user, and no `|move|` line** — the whole turn
  is `|turn|1` `|upkeep`. There is no `a.kind==='struggle'` branch anywhere; all three sites that return
  it (no living foes, the lock fallback, the chooser's final fallback) produce a silent no-op turn.
  Showdown's Struggle is typeless 50 BP physical, never misses, ignores type immunity, hits a random
  adjacent foe and costs the USER 1/4 of max HP (270 on the probe body). That is a family — a new action
  kind, a typeless damage path and a recoil that is a fraction of MAX HP rather than of damage dealt —
  plus the selection rule (every move out of PP) which this engine has no PP to express. Not fixed
  inside a re-route.
- **THE CHOICE LOCK STILL DOES NOT ARM ON A STATUS MOVE, and this re-route does not close it.** Measured
  on a Choice Scarf holder: `knockoff` → `_lock=knockoff, _lockT=Infinity`; `taunt`, `tailwind`,
  `trickroom`, `swordsdance` → `_lock=undefined`. The arming line sits **below**
  `if(a.kind!=='attack')continue`, so only attacks reach it. This wire honours a lock that exists; it
  does not arm one. Closing it needs a single "the move was committed" site shared by the ~30 status
  kinds — otherwise it is 30 copies of one fact, which is the shape CLAUDE.md forbids. **Its own wire,
  with its own probe.** Choice Scarf is legal here and Scarf+Trick is a real set, so the holder is
  currently free to switch moves after a status click. **A usage figure is deliberately not quoted
  here** — the brief that dispatched this row carried one the store had already moved past, which is the
  standing caveat at the foot of this file; read the live figure out of the tag artifact instead.
- **THIRTEEN MOVES EXECUTE AND NEVER RECORD `_lastMove` — measured over the whole 500-move table, not
  grepped.** Every kind was clicked through a real turn and checked for the record:

  ```
  heal       8/8   lifedew, moonlight, morningsun, recover, roost (+3)
  switch     2/2   chillyreception, partingshot
  tail       1/1   tailwind
  trickroom  1/1   trickroom
  wideguard  1/1   wideguard
  ...and 27 other kinds record it on all 500 (attack 324, affect 39, setup 22, status 14, ...)
  ```

  **CONSEQUENCE, AND IT IS THE REASON THIS IS FILED LOUDLY:** `volNeedsLastMove` correctly refuses
  Encore and Disable against a target that has never moved, so **Encore can never lock a body into Trick
  Room, Tailwind, Wide Guard or a recovery move** — which is most of the list Encore exists to punish.
  The Trick Room payoff proved above is therefore reachable today only through a lock that is set
  directly (which is what both of the engine's own writers do), not through a live Encore. Five one-line
  writes would close it, but they are read by Instruct as well as by Encore and Disable, so it gets its
  own wire and its own probe rather than riding in on this one.
- **`tests/test-no-silent-failure.js` is RED and was red before this pass** — the same **20** new silent
  catch blocks against the 2026-08-06 baseline that WIRE 144 recorded, **none of them mine**; the one
  `catch` this wire adds increments `MEDFAILS.lockStatusUnbuilt` and the count did not move. Reported,
  not filed.
- **`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is pre-existing and is not this
  wire.** Proved rather than assumed, the same way WIRE 143 proved it: both new counters read **0** after
  `engine/feature_fixture.js` builds and hashes every fixture feature, so neither branch executes on that
  board. REFIT OWED, and it belongs to MEASURE.

---

## DECISIONS TAKEN BY WILL DURING THE SPRINT — record, not recollection

**THE SITE IS A VISUALISATION, NOT A CONSTRAINT.** *"the website really was just for fun and for me to
visualize all the progress on the project, now that we have an outline im more concerned about speed
and functionality."* This REVERSES a standing assumption — that ABRA WORLD needing to run the real
engine live is a design constraint on `medicham2-browser.js`. It is not. Speed and functionality win.

**THE BROWSER WRAPPER STAYS, FOR NOW.** *"so can we get medicham up to full functionality without
changing the browser"* — yes, and measured: every row closed tonight was fixed INSIDE the wrapper.
The 22 remaining move rows are tag derivations, consumers and branch logic; none needs
`module.exports`. Full gate green does not require touching it.

*What the wrapper actually costs, so the decision is revisited on evidence rather than feel:*
  - **ROADMAP #114 is caused by it** — `root.MEDI_SPREAD` instead of `module.exports`, a symbol that
    never existed on any build, so every spread move was priced as single-target. That is a ONE-LINE
    export fix, not a conversion.
  - `MC` is a global rather than an import, which is why a frozen release is **23 files** instead of a
    module graph.
  - Every artifact read is dual-pathed with a **silent-degradation branch** for the browser, and
    silent degradation is this project's signature failure mode.
  - Measured: exactly ONE page actually loads the engine — `web/tower.html`. `index`, `models` and
    `app/index` mention it in prose with no script tag. The cost is paid for one page.

*Revisit in September alongside the regulation change, when releases are being re-cut anyway. Doing it
mid-sprint would invalidate every frozen release and every probe's setup, and destroy the one thing
that has made this sprint work: being able to attribute a regression to a single change.*

**AND REMOVING IT WOULD NOT MAKE ANYTHING FASTER.** The UMD closure costs nothing at runtime. If speed
is the goal the two right items are already filed and neither has been started: **#61** (*"MEDICHAM is
half the speed the project thinks it is, and nothing watches"*) and **#76** (*"SPEED IS A BUDGET, NOT A
VIBE"*). There is no benchmark, so every speed claim in this repo is currently a vibe.

---

## THE boosts-target SIX — ONE CLOSED, THREE DIAGNOSED, TWO WERE NEVER BROKEN

I expected one shared cause across six rows. **There were two causes and they split the group
differently than the verdicts did** — measuring first is what stopped a wrong fix.

### CLOSED — Toxic Thread (6 uses): a status move that ALSO changes a stat

`playerAction` routed anything with `fx.status` to `kind:'status'`, which applies the status and
nothing else. Toxic Thread poisons AND drops Speed by two, and measured in a real turn **it did
neither** — because `affect`, six lines further down, is the branch that carries `sc` and `si`
together, and the status line got there first. The guard is now narrow: a status move with no stat
change still takes the shorter path.

Verified both halves land and no pure-status move regressed:

```
  toxicthread  status psn   spe -2      <- was: neither
  thunderwave  status par   spe  0
  willowisp    status brn   spe  0
  toxic        status tox   spe  0
  spore        status slp   spe  0
```

**Roster moves 23 -> 22 differ / 362 -> 363 match. Exactly one verdict changed.**

### CLOSED — spread STATUS moves reached only ONE foe (3 rows). Diagnosed 2026-08-10, fixed the same day.

Cotton Spore, String Shot and Sweet Scent are `allAdjacentFoes`. Measured before anything changed:

```
  cottonspore  foe0 sp=-2   foe1 sp= 0      <- both should move
  stringshot   foe0 sp=-2   foe1 sp= 0
  sweetscent   foe0 eva=-2  foe1 eva= 0
```

That is exactly why all three read DID-NOT-FIRE: the roster's SECOND body never moves, so the delta
against the control arm is empty and a HALF-wired move produces the same receipt as an unwired one.

**THE FIX IS A LOOP, AND THE GATES INSIDE IT ARE UNTOUCHED.** The `affect` branch resolved one `_t`;
it now builds a target LIST off the tag — `spreadFoes` (both foes, ally safe) and `spreadAll` (the
partner too, and FIRST, which is Showdown's own `adjacentAllies()`-before-`adjacentFoes()` order) —
and runs the existing ~100-line gauntlet per body. Not one gate was removed or reordered; their
`continue`s now end that BODY's pass instead of the whole move, which for a single-target click is no
change at all because the loop runs exactly once. What stays once per move: `m._lastMove`, the
`mvFail` for a move that found nobody, a user-directed `si` effect (Showdown's own `move.selfDropped`
exists for that), and `userFaints` — Memento's user dies once, now gated on a `_landed` count instead
of on straight-line flow.

**THE SINGLE-TARGET CONTROL IS THE WHOLE RISK AND IT WAS MEASURED AS A DIFF, NOT ASSERTED.** 22
single-target status moves were run through a real turn against the pre-change engine and the
post-change engine, printing every stat stage, status and volatile of all three non-acting bodies.
The two runs differ on **exactly the four spread moves and nothing else**:

```
  thunderwave willowisp toxic spore charm faketears growl leer screech tickle scaryface
  confuseray taunt encore strengthsap memento partingshot nuzzle glare sleeppowder
  stunspore poisonpowder                                    <- byte-identical, before vs after

  cottonspore  ally UNCHANGED   foe0 sp -2    foe1 sp -2     <- was foe1 UNCHANGED
  stringshot   ally UNCHANGED   foe0 sp -2    foe1 sp -2     <- was foe1 UNCHANGED
  sweetscent   ally UNCHANGED   foe0 eva -2   foe1 eva -2    <- was foe1 UNCHANGED
  teeterdance  ally confusion   foe0 confusion foe1 confusion <- was ally + foe1 UNCHANGED
```

**A FOURTH MOVE CAME WITH IT AND IT IS NOT ONE OF THE THREE ROWS.** Teeter Dance is `allAdjacent` and
so is the `spreadAll` member of this branch; it confused slot 0 only. Membership was printed over the
whole move table before the loop was written: `spreadFoes` reaches `affect` as cottonspore, stringshot
and sweetscent; `spreadAll` as teeterdance alone. Corrosive Gas is `allAdjacent` too and `playerAction`
classifies it `trickitem`, so it never arrives here — named rather than left to be rediscovered.

**A SECOND CONSEQUENCE, NOT LOOKED FOR.** A driver reading Showdown's request is handed **no target**
for `allAdjacentFoes`, so `tgtSlot` was -1, `reaimToSlot` returned null and the branch took `mvFail` —
the whole turn spent doing nothing:

```
  BEFORE: targetless cottonspore -> foe0 0   foe1 0
  AFTER:  targetless cottonspore -> foe0 -2  foe1 -2
```

Same shape as ROADMAP #81 WIRE 9, which closed this for the DAMAGING half of the family and never
touched the status half.

Census **330 → 333 live, 0 missing, 0 threw**, on three new probes.

### NEVER BROKEN — Flatter and Swagger

Both apply the foe's boost correctly in a real turn (+1 SpA, +2 Atk). An early probe of mine reported
them boosting the ALLY; that probe had not set the side stamp, so `_isFoe` was false. Probe artifact,
not a defect — the fifth of the day.

---

## ENCORE — THREE FINDINGS, ALL FROM WILL, TWO OF THEM ENGINE FIXES

*(Will, 2026-08-10: "we need to fix encore", then "there are some crazy encore shenanigans".)*

**Encore itself was never broken.** The row is FIRED-AND-BOARDS-DIFFER, not DID-NOT-FIRE, and there is
**no `vol.encore` disagreement at all** — only HP. Verified directly: handed Dragon Claw on turns 3 and
4, the encored body used **Dragon Pulse** both times; it FAILS on turn 1 against a body with no last
move (Will's switch-in case); duration is 3, matching Showdown.

*My first probe said the lock was broken and the probe was wrong* — I clicked Encore once, on the turn
it cannot land. Fourth broken probe of the day.

### 1. ENCORE INTO GIGATON HAMMER LEAVES YOU WITH STRUGGLE — measured, not inferred

`medicham2` carried this as an explicit **unmeasured inference**: *"The code implies every move ends up
disabled and the Pokemon Struggles. That is an inference from reading two handlers, NOT something
measured, and it is flagged here as needing a live test rather than stated as fact."*

Now measured against the authority:

```
turn 1  Tinkaton uses Gigaton Hammer.  Oranguru Encores it.
        Tinkaton may select: Struggle          <- every move gone
turn 3  Tinkaton STRUGGLES.  Encore expires.
```

The inference was **correct**. Will's counter-hypothesis — that `cantusetwice` only blocks SELECTION so
an Encore would let it hammer twice — does not hold: the authority has **both** guards, `battle.js`
disables it for selection and `battle-actions.js` catches it again at execution. 249 uses.

*(The first attempt at this was contaminated: Gengar has CURSED BODY, which disabled the Hammer on
contact. The finding would have been the fixture's. Same shape as the Thick Fat lesson.)*

### 2. THE PRIORITY BRACKET BELONGS TO THE MOVE YOU SELECTED — **ENGINE FIX**

Will: *"if you use a prio move but get encored into something you still get prio on it ... its obscure
look it up."* He is right, and `sim/battle-actions.js` is explicit:

```js
let baseMove = this.dex.getActiveMove(moveOrMoveName);
const priority = baseMove.priority;             // <-- read from the SELECTED move
const pranksterBoosted = baseMove.pranksterBoosted;
if (baseMove.id !== "struggle" && ...) {
  const changedMove = this.battle.runEvent("OverrideAction", ...);   // <-- Encore swaps HERE
  if (changedMove && changedMove !== true) baseMove = ...changedMove;
}
```

Priority is captured **one line before** the override may run. So an Encored body moves in the bracket
of what its player picked and executes what Encore forces — and `pranksterBoosted` is captured on the
same line, so a Prankster boost carries too.

**This engine had it backwards.** `_pri` was computed from `acts` AFTER the WIRE 24 lock rewrite, so the
LOCK decided the bracket. WIRE 118's comment claimed the bracket is frozen *"exactly as Showdown
resolves an action's priority when it is queued"* — true for every action except a locked one, and
false precisely there. `_selMv` now carries the pre-override choice and `actionPriority` reads it.

**Shown red on the frozen pre-fix release:**

```
  PRE-FIX  9c04f767ba8c   gengarLost = 0    <- died before acting: took the LOCKED bracket
  POST-FIX live tree      gengarLost = 70   <- kept Quick Attack's +1, got the forced move off
```

### 3. THE `failencore` SET — 6,221 uses Encore cannot lock

Encore, Copycat, Sleep Talk, Transform, +1. Not yet checked against our engine.

### AND THE ROW STILL DOES NOT MOVE

Roster moves unchanged at 23 differ / 24 did-not-fire. Both fixes above are real and independently
verified; **neither closes the Encore row**, because the roster's scenario has both sides clicking the
same neutral 0-priority move — there is no bracket mismatch in it to exercise. The residual is still
the 106/36 versus 161/0 damage split, still undiagnosed, and still not guessed at.

---

## OPEN — WORK DONE, ROW NOT CLOSED

**THE RETALIATION FAMILY (Counter, Mirror Coat, Metal Burst, Comeuppance — 16 uses).** The engine
change is real, complete and MEASURED CORRECT; the roster verdict did not move and I do not yet know
why. Recorded as-is rather than reported as a fix.

*What landed, in four layers:*
- `tag_dex`: the `fixedDamage` tag now carries `retaliates`, `mult` and `category`, derived from the
  condition — x2 physical for Counter, x2 special for Mirror Coat, x1.5 any for Metal Burst and
  Comeuppance. It carried none of those before, which is why `dmgRange`'s own comment could say the
  moves were "one branch away" and still not build the branch: there was nothing to multiply by.
- `medicham2`: `_took` records the LAST qualifying hit per category on the body, beside `_hitBy`.
  Last, not sum — Showdown OVERWRITES `effectState.damage` on each hit and `getLastDamagedBy` is
  singular, so two Rock Slides leave Counter reading the second one.
- `dmgRange`: the branch, plus an explicit `return 0` when nothing qualifies. That return matters —
  falling through runs the ordinary formula at base power 0, which floors at **1**, and Mirror Coat
  after a physical hit read 1 instead of 0.
- `hasPower`: **an exclusion that had EXPIRED.** It deliberately rejected these four, with a comment
  that was correct when written — *"Counter and Mirror Coat need turn state and would otherwise be
  admitted here only to return zero one branch later."* True while the turn state did not exist. It
  does now, and leaving the gate alone made the new branch UNREACHABLE. Same shape this project keeps
  hitting: a guard written against a real limitation, kept past the limitation.

*Verified by direct measurement:*

```
  counter     took {phys:95}  -> 190   (2 x 95)          ok
  mirrorcoat  took {phys:95}  ->   0   (no special hit)  ok
  mirrorcoat  took {spec:80}  -> 160   (2 x 80)          ok
  metalburst  took {phys:95}  -> 142   (1.5 x 95)        ok
  comeuppance took {spec:80}  -> 120   (1.5 x 80)        ok
  counter     took nothing    ->   0                     ok

  and in a real turn: Kangaskhan Body Slams for 86, Counter answers for 172.
```

*What is NOT resolved:* the roster still reads DID-NOT-FIRE for all three of its rows. Showdown deals
70 in that scenario and we deal 0. The engine demonstrably does the right thing when hand-staged, so
the gap is in how the roster's script and ours line up on that particular turn — **not diagnosed, not
guessed at.** Next step is to dump the roster's own script for the row rather than reconstruct it.

*A harness of mine was wrong on the way, and it wasted time:* a two-turn probe reported 0 damage and
sent me hunting the engine, when a clean single-turn probe of the same mechanic reported the correct
172. The probe was broken, not the engine — `docs/LESSONS.md` §5, for the third time today.

---

## WIRE 147 — THE DAMAGE WAS ONE ROLL MULTIPLIED BY N. FOUR ROWS, ONE ROOT CAUSE, TWO OF THEM 2x. 2026-08-10.

Census **350 → 354 live, 354 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, each watched RED on its own before a line of the engine changed. Damage stages **1728/1728
exact**, unchanged. **No release was cut and neither `tests/roster.js` nor `engine/game_differential.js`
was run** — `game_differential.js:126` AUTO-CUTS when no release is pinned, which would swap the
pointer under another agent's measurement; the pointer is still `f727f7fdee4f`, mtime unmoved.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 29 | **Triple Axel** | 753 | `basePowerCallback` is `20 * move.hit` — 20/40/60. We applied a flat 20 three times, so the move dealt **exactly half**: 8+8+8 = 24 against the authority's 8+16+23 = 47. The tag said `variablePower {computed:true, note:"idiom not yet derivable"}` and, because `MEDFAILS.variablePowerUnknown` is gated on a truthy `kind`, it was **not even counted** | *engine fixed; roster NOT re-run by me* |
| 30 | **Dragon Darts** | 126 | `smartTarget: true`. One packet cannot be aimed at two bodies, so both darts hit the aimed foe and the partner took **zero**: goodra −72 / torterra 0 against −36 / −34. `smartTarget` appeared in this engine only in two comments and in no tag at all | *engine fixed; roster NOT re-run by me* |
| 31 | **Beat Up** | 320 | `mvBP = _hits ? _sum : …` summed every ally's base power into ONE packet. The formula's `+2` is paid per packet, so four hits lost three of them: 24 against 28 | *engine fixed; roster NOT re-run by me* |
| 32 | **Fickle Beam** | 38 | `mvBP = floor(mvBP * (1 + p*(mult-1)))` — 80 × 1.3 = **104 base power, a number the move never has**. It is 80 or 160. Measured sd 42 / ours 54, and 42 × 1.3 = 54.6 | *engine fixed; roster NOT re-run by me* |

**IT IS THE 3.90.0 BUG IN A SECOND PLACE.** *"The multi-hit count was the MEAN, and the pin never lands
on a middle."* Fickle Beam is that sentence word for word in the conditional-power path, and the comment
above the line stated the averaging as a deliberate choice. The fix is the shape ROADMAP #103 already
chose for the hit count and not a second shape: `hit.condPower` arrives from the battle loop, drawn off
the same rng that draws the count, the damage index and the crit; a PURE call keeps the expectation,
because that is the right object for a price, and the two halves are counted separately
(`conditionalPowerRolled` / `conditionalPowerPriced`) so a run with games in it that never rolls one is
readable as the lost draw it would be.

### THE PRECONDITION IS A PER-HIT LOOP, AND IT IS ENTERED ONLY WHERE THE BASE POWER IS A FUNCTION OF THE HIT INDEX

`dmgRange` is now a wrapper over `dmgRangeOneHit`. `hitPlanOf` decides, **from the artifact**, whether a
move's base power depends on the hit number — today `variablePower {kind:'perHitEscalates'}` (Triple
Axel) and `variablePower {kind:'alliesBaseAtk', perAlly:true}` (Beat Up), and nothing else. Every other
move, **multi-hit included**, takes exactly one trip through `dmgRangeOneHit` with the identical `_hits`
scalar the old line multiplied by, so its arithmetic is byte-for-byte what it was. That is what "single-
hit damage is unchanged by construction" means here, and it is the reason the wire is safe to land in the
damage path at all.

**THE PINNED CORNER, STATED.** `min` is every hit at the 85% randomizer and `max` every hit at 100% —
exactly what a pin produces in the authority, which draws a randomizer per hit and gives every one of
them the same corner. **What this does NOT reproduce is the interior:** the battle loop still draws one
index across the summed range, so N independent mid-rolls are modelled as one. That is unchanged from
before this wire and it is a range-versus-sample question the loop owns, not the calculator.

**THE COUNT IS NOT RE-DERIVED AS A MEAN.** `hitPlanOf` takes `hit.hits` whenever a caller has drawn one,
and only falls back to `expectedHitsOf` for a price. The weight vector it builds for that price —
`P(at least hit h)`, so `[1, 0.9, 0.81]` for Triple Axel — **sums to exactly `expectedHitsOf`**, and the
sum is CHECKED rather than asserted in prose: `MEDFAILS.hitWeightsDisagree` fires if it ever does not
(0 over 1,500 real turns across the whole 500-move corpus). It can: `expectedHitsOf` discards the 2-5
mean for a move that also carries `multiAccuracy`, and no move in this format carries both.

### THE FOUR PROBES, ALL SHOWN RED INDIVIDUALLY FIRST

Each compares the move against **separate arms of itself at fixed base powers**, so the assertion is an
exact integer identity and nothing else in the turn has to be held equal.

| tag | what it proves | what it read RED |
|---|---|---|
| `variablePower` | Triple Axel equals `d(20) + d(40) + d(60)` and not `3 × d(20)` | flat 360 where escalating is 688 |
| `smartTarget` | one dart each — the aimed body takes exactly what a SINGLE dart does, the partner takes a second one, **and with the partner already fainted both go back into the aimed body** | `[132, 0]` where one dart is `[132, 0]` and the move must be `[132, 66]` |
| `variablePower` | four identical eligible allies deal **exactly 4×** what one does | 96 where four packets are 100 |
| `conditionalPower` | equals a flat 160 BP copy at the corner where `random(10)` draws 0 and a flat 80 BP copy where it draws 9 | `[320, 252]` — an averaged 1.3x lands between the two arms at BOTH corners |

The Triple Axel probe uses ONE corner and says why: at the top pin the move **misses outright**
(`|move|p1a: Weavile|Triple Axel|p2a: Garchomp|[miss]`, read out of the authority), so a two-corner probe
would be reading a miss and calling it a hit count.

### THE AUTHORITY WAS READ DIRECTLY, NOT INFERRED

A pinned `new Battle('gen9doublescustomgame')` for all four idioms at both corners. It confirms every
line of this wire: Triple Axel escalating, Dragon Darts writing `|-anim|` at the second dart with damage
on **both** bodies, Beat Up emitting **four separate `|-damage|` steps** and `|-hitcount| 4`, and Fickle
Beam printing `[anim] Fickle Beam All Out` + `|-activate|` at one corner and nothing at the other.

**AND THE FIRST VERSION OF THAT HARNESS WAS WRONG IN THE FLATTERING DIRECTION.** It overrode
`battle.random`, and `Battle#randomChance` calls `this.prng.randomChance(...)` **directly**
(sim/battle.ts:352) — so every chance event stayed unpinned and Fickle Beam appeared never to double at
either corner, which would have read as "the tag's `p` is wrong". The pin belongs on the PRNG.

### UNCHANGED BY CONSTRUCTION *AND* MEASURED

Every move in `data/tags.json` (500), four turns each — mid roll, both pin corners, and one with no
target — digested as the **whole board** (both sides' HP, status, boosts, item, ability, faint, sub,
volatiles, types, plus the full field). The "before" arm is the **frozen release `f727f7fdee4f`**, loaded
through `engine_release.open(id)` so it serves the pre-wire bytes; opening does not touch the pointer.

**2,000 cells. 11 differ. Four moves: `tripleaxel`, `dragondarts`, `beatup`, `ficklebeam`.** Nothing else
in the corpus moved by a single HP.

### COUNTERS, WITH A CONTROL

`perHitDamageLoop`, `perHitBasePower`, `smartTargetSplit`, `conditionalPowerRolled`,
`conditionalPowerPriced` — all **0** after a control turn of Dragon Claw and Rock Blast, all non-zero
after the four. `MEDFAILS.hitWeightsDisagree` 0 and `MEDFAILS.beatUpAllyNoBaseAtk` 0 over the whole
corpus. `MEDFAILS.variablePowerUnknown` reads 7, first `lashout:userStatsLoweredThisTurn` — pre-existing
and unrelated.

### TWO CORRECTIONS MADE BESIDE THE FOUR, BOTH STATED RATHER THAN ABSORBED

- **BEAT UP'S ELIGIBILITY FILTER WAS WRONG AND IS THE AUTHORITY'S NOW.** Showdown filters
  `ally === pokemon || !ally.fainted && !ally.status` — the `ally === pokemon` short-circuits, so **the
  user is always in the list**; a burned Weavile still throws its own punch. This engine applied the
  fainted and status tests to every member including the user. There were **three** copies of that
  filter (base power, hit count, reaction count) and they are now one function, `beatUpAllies`. No probe
  covers the statused-user case; it is reported here rather than claimed.
- **`tests/test-mechanics.js`'s `reactorPerHit` PROBE WAS GREEN ON A FALSEHOOD.** It asserted Weak Armor
  `-2 / +4` off Dragon Darts against a Milotic standing beside a **healthy partner**, and Showdown lands
  one dart there. The reaction count read the move's total while the damage step had already split. Both
  are fixed; the arm now stages **both** ways and reads the PARTNER's stages too, because "each body
  once" and "nobody at all" are otherwise the same number on the aimed body.
- **`multiAccuracy`'s probe needed a new denominator, not a new claim.** Its ratio compared Triple Axel's
  price against `3 × its first hit`; with the hits at 20/40/60 that reads ~4.98 and looks like a 66%
  OVERPRICE on a probe whose whole subject is a discount. It now compares against
  `d(20) + d(40) + d(60)`, where the 1 + p + p² discount shows as ×0.87.

### `data/tags.json` WAS REGENERATED, AND HERE IS THE DIFF

Two derivations were added to `engine/tag_dex.js` and the artifact regenerated. **A CONTROL
REGENERATION WAS RUN FIRST** with no changes at all: 0 entities removed, 0 added, **0 changed** — so
ROADMAP #65's blocker (the corpus had shrunk 29% and five entities dropped out) is **gone**, and this is
the measurement that says so rather than a decision that it felt safe.

Against the pre-session artifact: **0 entities removed, 0 added, three hundred and seven changed — and
all but two of those are the `uses` COUNT ONLY.** `data/tags.json`'s own `sheet_entries` field moved by about six hundred between the
control run and the real one: the ingest is live and appended sides while I worked, and the current
value is the one in the artifact rather than any number typed here. Nothing consumes `uses`. The
**two semantic changes are the two intended ones**, and the tag CATALOGUE gained exactly `move|smartTarget`:

```
moves dragondarts  tags ["multiHit"] -> ["multiHit","smartTarget"]
                   + smartTarget {splitsAcrossPartner:true, spreadReduced:false, hits:2}
moves tripleaxel   variablePower {computed:true, note:"idiom not yet derivable"}
                -> variablePower {kind:"perHitEscalates", per:20}
```

Membership for both was **measured over the format before the pattern was typed**: exactly three moves
in `data/moves.ts` read `move.hit` in a `basePowerCallback` and two (Fury Cutter, Triple Kick) are
`isNonstandard: 'Past'`; `smartTarget` is declared exactly once. Fury Cutter would not match the pattern
in any case — its escalation is a volatile multiplier and `move.hit` appears only in its RESET test.
`data/abra-tags.js` was rebuilt from the same artifact.

### WHAT IS NOT CLOSED, SAID PLAINLY

- **A PURE PRICE FOR DRAGON DARTS STILL SAYS TWO HITS INTO THE AIMED BODY.** `dmgRange` is handed two
  bodies and cannot know a partner is standing there, so `playerAction`'s pre-computed `d`, `bestMoveVs`
  and every rollout leaf still price the move as 2 × 50 BP on the target and 0 on the partner. The TURN
  is right; the PRICE overstates the aimed body and understates the board. It is the same shape as the
  `auraBoost` finding (a fact that needs the field, not the pair) and it is filed, not hidden.
- **`|-hitcount|` IS STILL NOT EMITTED**, and its declaration in `engine/derive_protocol_events.js` was
  rewritten rather than left stale: the HP still moves once for the summed part of the family, so a count
  beside a single `-damage` would be an invented number. Dragon Darts would emit nothing there in any
  case — `if (move.multihit && typeof move.smartTarget !== 'boolean')` skips every smartTarget move.
- **NO ROSTER ROW IS CLAIMED CLOSED.** I did not run `tests/roster.js` and I did not run the differential.
  The four rows above say *engine fixed* and nothing more.

### TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S

`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is **unaffected by this wire, and this
time that is a measurement rather than a counter read**: the per-hit loop DOES execute during
`engine/feature_fixture.js`'s build (`perHitDamageLoop` 2, `perHitBasePower` 6), so the counter argument
WIRE 146 used would have been wrong here. A full sandbox of the frozen release's 23 files was built and
its fixture hashed against the live tree: **0 of 58 fixture features moved.** REFIT OWED, and it is
MEASURE's. `tests/test-no-silent-failure.js` is red at **21** new silent catches — the same 21 WIRE 146
reported, none in `engine/medicham2-browser.js`; this wire added no `catch` at all.

## WIRE 156 — THE FLINCH DICE WERE FINE. THE HARDCODE BESIDE THEM WAS NOT. 2026-08-10.

Census **380 live / 1 missing → 381 live / 0 missing / 381 probed / 0 threw / 0 hollow / 0 unarmed /
0 direct-call**, where the before-arm is the pre-change engine bytes compiled under the real filename
against the NEW probe file, so the single MISSING row is exactly the new probe. Damage stages
**1728/1728 exact**. `tests/test-engine-diff.js --n 20000 --seed 20260804` **agreed 20,000, disagreed
0**. **No release was cut**; `engine/game_differential.js` was run once **pinned to `b26893debcb0`**,
whose engine bytes are byte-identical to the live tree, and was not edited.

| # | row | uses | what it was | verdict move |
|---|---|---|---|---|
| 33 | **Fake Out** | the most-clicked priority move | **THE INCOMING REPORT WAS WRONG AND THE ADJACENT DEFECT WAS REAL.** ENGINE was asked to fix *"a secondary flinch never fires unless its probability is 1"*, Rock Slide and Iron Head by name, at 0 of 600 each. **Both were already correct** — the reported staging had the attacker MOVING SECOND, `MEDSEEN.flinchTooLate` read 571 and 185 of 1,000, and Fake Out passed only because +3 priority made it the one move in the sample that moved first. With the attacker's speed set explicitly, **17 of the 19 `flinches` carriers land within sampling error** of `pFlinch × accuracy` (Rock Slide 26.4 against 27.0, Iron Head 20.4 against 20.0), and the two that do not are the probe's own staging, named separately. What WAS broken: `if(a.move.id==='fakeout'){…tg._flinch=true}` sat **outside** the secondary loop and outside `dustBlocked`, so **Shield Dust and Sheer Force both failed to delete a flinch the authority says is a secondary** (`secondaries:[{chance:100, volatileStatus:'flinch'}]`). Confirmed in the official engine at the Champions format on all three arms before a line changed. The fix is a **deletion**: `move-effects.js` already carried the 100% entry and the shared loop was firing anyway — `MEDSEEN.flinch` read **200% of turns** for a single-target certain flinch | *engine fixed; roster NOT re-run by me* |

**WHY IT SURVIVED:** p = 1 is the only probability at which `rng() < p` cannot tell a working die from
a dead one, and Fake Out was the only member of the family anybody had probed — by a road no other
member used.

**THE TWO PROBES.** `move flinches` — *"a secondary flinch fires at ITS OWN probability, not only at
p=1"* replaces the old Fake Out one-armer: a **rate** over 4,000 turns off a **seeded** generator, with
Knock Off at 0 and Fake Out at 100 bracketing Rock Slide 27 and Iron Head 20, plus a fourth arm that is
the whole reason the report was wrong — Rock Slide with the attacker moving SECOND must read 0. And
`move flinches` — *"Fake Out's flinch is a SECONDARY — Shield Dust and Sheer Force delete it"*, the new
one, **watched RED first**.

**BLAST RADIUS.** Every move in `data/tags.json` (500) × 3 ability configurations (quiet / defender
Shield Dust / attacker Sheer Force) × 2 real turns, whole-board digest: **1,500 cells, 2 differ, 0
THREW on both arms** — `fakeout|dust` and `fakeout|sheer`, and nothing else. **`fakeout|quiet` did NOT
move**, which is the claim rather than a disappointment: the mechanic is preserved exactly and only the
two suppressions arrive. all but a handful of the 1,500 digests are distinct, so the instrument is sensitive.

**ONE GATE IS RED AND IT IS NOT THIS CHANGE'S — SAID, NOT FILED.** `tests/staged_board.js --only
fakeout-flinch --reds` reports `FAIL the planted proof case does not part`: the arm played with the
flinch consumer disabled is board-identical to the clean arm, where its own note records a 69 HP parting
on 2026-08-07. **Measured red on the clean tree before any edit**, and it reads the FROZEN RELEASE's
bytes rather than the live tree. Owned by whoever holds `staged_board.js` / `game_differential.js`.

**REPORTED, NOT TOUCHED.** `tag_dex.js:3141`'s King's Rock `{pFlinch:0.1}` is **correct** — measured at
the item's own 10%, already probed by `item addsFlinch` — but another agent is in that file. And moves
carry a `flinches {pFlinch}` param that **nothing reads**: the engine takes the chance from
`statusInflict.effects[].chance` and `move-effects.js`. Two artifacts stating one fact; harmless today
because only one is consumed, and collapsing them is a derivation change.

## WIRE 155 — WIRE 147 PINNED BOTH CORNERS AND NOT THE MIDDLE, SO THE 1.3x SURVIVED ITS OWN FIX. 2026-08-10.

Census **376 → 377 live, 377 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** One new
probe, watched RED before a line of the engine changed. Damage stages **1728/1728 exact**, unchanged.
**No release was cut, `tests/roster.js` was not run, and `engine/game_differential.js` was neither run
nor edited** — another agent is live in it and `:126` auto-cuts when no release is pinned.

| # | row | uses | what it was | verdict move |
|---|---|---|---|---|
| 32 | **Fickle Beam** (again) | 38 | WIRE 147 split the DRAWN path off and **left the else branch** reading `mvBP * (1 + p*(mult-1))` = 80 × 1.3 = **104**. Its probe asserted the two pinned rng corners of a real turn — both of which now go through `hit.condPower` — so both were green and the **priced middle between them was never asked about** | 19 of 19 differential disagreements → **0 of 20,000** |

**THE MEASUREMENT, BEFORE AND AFTER.** `tests/test-engine-diff.js --n 20000 --seed 20260804`:

```
before   agreed 19,981   disagreed 19    <- every one Fickle Beam, all ~1.30x high
after    agreed 20,000   disagreed  0
```

```
hydrapple ficklebeam -> orthworm    showdown 39-46   ours 51-60   (before)
                                    showdown 39-46   ours 39-46   (after, rel 0.0%)
```

### THE JUDGEMENT, BECAUSE THERE WAS A REAL CHOICE AND THIS FILE HAD ALREADY MADE IT ONCE

`dmgRange` is a **PRICE** — "what will this move do", asked before anything is clicked. For a move that
is 80 BP with p=0.7 and 160 BP with p=0.3 the candidates were the **expectation** (104), the **span**
(the 80 case's min to the 160 case's max), or something carrying both. **It is none of the three.**

The rule was already written, thirty lines above `critChance` (`medicham2-browser.js:2675`): **a RATE
must not go into a min/max.** `critRatioUp` is refused there on exactly that ground — folding an
expectation in stops `max` being a roll the move can deal, and puts the move permanently out of step
with a differential whose authority draws a die and never returns a mean. **Fickle Beam's 30% double is
the same object as a crit rate**: a per-use die the TURN LOOP owns. So it rides the loop's draw, and the
price is the branch that happens when the die says no — an achievable number, the exact one 70% of the
time, and the only one comparable to a pinned authority. That paragraph now carries a back-reference
saying it was broken one function away for three wires.

**THE TWO PATHS RETURN DIFFERENT NUMBERS ON PURPOSE.** The comparison path is TOLD which branch
(`dmgRange(..., {condPower:true|false})`, the same call `battleTurn`'s `_hitCtx` already makes); the
pricing path is the un-procced one. Neither is a mean. The expectation is not lost and is not a dead
field nobody reads — a caller that wants the other branch asks for it by name.

**WHAT IT COSTS, STATED RATHER THAN HIDDEN.** A Fickle Beam that only KOs on the proc is priced as not
KOing. That is the same understatement `critRatioUp` already accepts, and the same one multi-hit's
expectation accepts in the other direction. The rollout is where the double is worth something, and the
rollout draws it. Counted as `conditionalPowerPriced`.

### THE PROBE THAT WOULD HAVE CAUGHT IT — IT ASSERTS THE MIDDLE, NOT THE CORNERS

`move conditionalPower` — *"Fickle Beam PRICED is a real branch, not the 1.3x middle between them"*, on
a new `pricedTurn(` helper declared at the top of `tests/test-mechanics.js` with its reason. The helper
**spends a real turn** and hands back the pure price off the same staged bodies, because the claim is a
RELATION between the two and neither half is assertable without both. The direct-call ratchet stays at
**0 of 377**.

| | flat 80 BP arm | flat 160 BP arm | Fickle Beam PRICED | between? |
|---|---|---|---|---|
| RED | `[164, 194]` | `[326, 386]` | `[212, 252]` | **true** |
| GREEN | `[164, 194]` | `[326, 386]` | `[164, 194]` | false |

The two arms **do not overlap** — 160 at the 85% randomizer is above 80 at 100% — so there is a real GAP
and a 1.3x price lands squarely inside it. The same helper's REAL TURN is re-read alongside (492 at the
corner where `random(10)` gives 0, 194 where it gives 9), so "the price stopped moving because the whole
mechanic stopped moving" is not available.

### CONTROL FIX 12 — THE HARNESS WAS READING THE COIN, AND WOULD HAVE AGREED BY LUCK

`Battle#randomChance` goes **straight to `this.prng`** (`sim/battle.js:213`) and does not pass through
this file's `battle.random` override, so Fickle Beam's double was drawn off the battle seed while every
other input in the row was pinned. At seed `[1,2,3,4]` it drew **false on every row, in both the top and
the bottom call**. So after the engine fix these rows read rel 0.0% — **and they would have read 0.0% by
luck.** That is CONTROL FIX 6's gender coin again, and a false agreement is the expensive one because
nothing prints.

Pinned now, and pinned **both ways rather than off**: a carrier is compared TWICE, once with the die
false and once true, MEDICHAM is asked for the matching branch, and **the row keeps the WORSE residual**
so being right on the 70% branch cannot pay for being wrong on the 30% one. Pinning it merely off would
have left the whole mechanic untested by the differential, which is worse than the bug it replaces.

The carrier set is **DERIVED** from `conditionalPower.when === 'chance'` and PRINTED before it is used —
`ficklebeam(p=0.3 x2)`, one member. The override is installed **only for a carrier**, so every other row
draws the identical stream and every pre-existing agreement is undisturbed.

**THE PIN IS PROVEN LIVE RATHER THAN ASSUMED.** MEDICHAM's proc branch on `hydrapple ficklebeam ->
orthworm` is `78-92` against the no-proc `39-46` — exactly 2x — and the row still reads rel 0.0% on the
worse of the two faces. Showdown's pinned proc therefore returned `78-92` too. A pin that had silently
failed would read ~100% on that row, not 0.0%.

### IS ANY OTHER MEMBER WRONG THE SAME WAY? NO — AND THE NEIGHBOURS ARE NAMED

All eleven `conditionalPower` members were read out of `data/tags.json`. **`ficklebeam` is the only
`when: 'chance'`.** `facade` (`userStatused`) and `barbbarrage` / `venoshock` (`targetStatusIn`) are
deterministic conditions with no probability in them; `lashout` (`userStatsLoweredThisTurn`) has no state
here and is **counted** through `MEDFAILS.variablePowerUnknown` rather than defaulted; the other six carry
`conditional: true` with their real condition in `weatherScaled` / `terrainScaled` / `variablePower` and
are correctly skipped by this branch.

**FOUND WHILE LOOKING, NOT FIXED, PER THE ROUTING RULE.** `dmgRangeOneHit`'s Parental Bond line
(`base = floor(base * 1.25)`, `hitsTwice`) collapses two packets into one exactly as WIRE 147's four rows
did — the formula's `+2` is paid once and the second hit gets no randomizer of its own. It is **not** this
defect (nothing probabilistic is folded; both hits always happen) and the differential cannot see it,
because it stages the species' slot-0 ability and Parental Bond is a mega ability. 217 corpus uses.
Reported, not touched.

### GATES

`tests/test-mechanics.js` **377 live / 377 probed / 0 missing / 0 threw**. `tests/test-damage-stages.js`
**1728/1728 exact**. `tests/test-engine-diff.js --n 20000 --seed 20260804` **0 disagreements**.
`tests/test-engine-consistency.js`, `tests/test-fragility.js`, `tests/test-charge.js` green.

**TWO PRE-EXISTING REDS, SAID AND NOT FILED.**

`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is **REFIT OWED and MEASURE's** — and it
is not this wire's: the feature fixture's four staged sets contain no Fickle Beam
(`grep -i ficklebeam engine/feature_fixture.js` is empty), so nothing this wire touched can reach those
digests.

`tests/test-effective-identity.js` is red on `no NEW raw read of a transforming field`. Its per-file
delta names `champions_sim.js`, `replay_differential.js`, `probe_pair.js`, `roster.js`,
`staged_board.js`, `test-nature-differential.js`, `test-pinch-family.js` and
`test-side-guard-chooser.js` — **neither `test-engine-diff.js` nor `test-mechanics.js` is among them**,
and both files' declared counts are unchanged by this wire. Red on the tree as it stands and owned by
whoever holds those files.

## WIRE 146 — `playerAction` IS A FIRST-MATCH CASCADE, SO A MOVE WITH TWO EFFECTS LOST ONE. 2026-08-10.

Census **346 → 350 live, 350 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call**, on four
new probes, each watched RED on its own before a line of the engine changed.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 25 | **Chilly Reception** | 38 | `pivotStatus` claimed the click ~140 lines above the weather branch, so the sky was never set. Was `""/0`, is `snow/4` at the same boundary the authority reads `snow/4` | *engine fixed; roster NOT re-run by me* |
| 26 | **Swagger, Flatter** | 71, 0 | `boostsTarget` claimed the click and `boostally` applies a boost table and nothing else — the confusion never happened. **Routed** to `affect`, which applies both halves *and* throws Swagger's 85 accuracy die, asks Own Tempo, Safeguard, Substitute and Protect, and runs the boost through Contrary | *engine fixed; the roster's `vol.confusion` COUNTER may still differ — see below* |
| 27 | **Howl** | 50 | dex target is `allies` = `Pokemon#alliesAndSelf`, i.e. user AND partner. The branch resolved ONE body, so the click landed on `active[1]` and the user got nothing. Derived from the move's own target, not its name | *engine fixed; roster NOT re-run by me* |
| 28 | **No Retreat** | 90 | the `noretreat` volatile was never written. **HALF-FIXED, and the half that is missing is the one the roster row measures** — see below | *NOT CLOSED* |

**THE FIX IS THE SHAPE, NOT THE FIVE PAIRS.** `playerAction` now runs the cascade unchanged and then
COMPOSES: `KIND_APPLIES` states, in the vocabulary of EFFECTS, what each action kind actually applies,
and anything the move carries that its kind does not apply becomes a rider on the action, executed at
ONE site above the kind dispatch. Two effect classes have appliers (`weather`, `statusInflict`); a
third class arriving is **counted and named** (`MEDFAILS.composedEffectUnexpressed`, 0 over the whole
500-move corpus) rather than dropped.

**THE TABLE IS DELIBERATE AND THE DERIVED VERSION IS THE TRAP.** "The residual is every effect-bearing
tag the claiming branch did not read" over-matches *silently*: **Yawn** carries `delayedSleep` AND a
`statusInflict` volatile describing the same sleep, so a tag-subtraction rule writes a second
`_vol.yawn` on every Yawn in the format. Two tags, one effect. Membership was printed over all 500
moves before a rider ever executed — **five riders exist**: chillyreception (weather), noretreat,
minimize, charge (user volatile) and **shedtail**, whose substitute rider is refused inside
`applyMoveVolatile` because `grantSubstitute` owns that volatile. Its board digest is identical.

**TWO FACTS WERE EXTRACTED RATHER THAN COPIED**, because the rider needed a second caller and CLAUDE.md
forbids two implementations of one fact: `applyMoveVolatile` (the ~100 lines of Mental Herb, the
no-restart rule, Encore's lock and Disable's `_sealed`, lifted verbatim out of the `affect` branch —
the block was the last statement in that loop, so every `continue` is exactly a `return`) and
`applyMoveWeather` (the sky, the turns and the rocks, lifted out of the `weather` branch).

**UNCHANGED-BY-CONSTRUCTION, AND THEN MEASURED ANYWAY.** The attack path returns from the composer on
its first line. A single-effect move gets no `also` field, and the executor is gated on that field. The
proof is empirical as well: **all 500 moves in `data/tags.json`, three digests each** — the action
object, the whole board after a real turn with a target, and the same with NO target. After the
extraction alone: **byte-identical on all 1,500**. After the whole wire: **seven moves differ and they
are the seven named above** (plus shedtail's action object, board unchanged).

**WHAT IS NOT CLOSED, AND IT IS THE ROW WITH THE LOUDEST NUMBER.** No Retreat's roster row reads
`sd +1 / ours +2` on the SECOND click. That is a *second application*: Showdown's `onTry` returns false
against the mark and the whole move fails, boosts included. This wire writes the mark; it does **not**
add the veto, because **no artifact this engine reads carries it** — `data/tags.json` has
`boostsUser {readFrom:"m.self.boosts"}` and `statusInflict {volatile:"noretreat", to:"user"}`, and
neither says "fails if the user already has it". A blanket "a user-directed volatile refuses a repeat"
rule was **printed and rejected**: it catches `minimize` and `charge`, both of which Showdown lets you
re-click. The fix is a `tag_dex` derivation off `onTry`, and I did not regenerate `data/tags.json`
because another agent is running `tests/roster.js` and `engine/game_differential.js`, which read it —
that is the photograph rule, not a preference.

**AND THE CONFUSION COUNTER IS A PRE-EXISTING APPROXIMATION, NOT THIS WIRE'S.** `board_state.js`
compares `vol.confusion` as a NUMBER: ours is `CONFUSION_TURNS_MIN = 2` always, Showdown's is
`this.random(2,6)` decremented. So a Swagger/Flatter row can still read FIRED-AND-BOARDS-DIFFER on the
counter while the mechanic is live. That is `MEDSEEN.confusionMinDuration`, declared long before this
wire, and it is the same for Confuse Ray and Teeter Dance.

**`minimize` and `charge` are invisible to the roster either way** — `board_state.js` compares a fixed
list of eight volatiles and neither is on it. The census probes are the only evidence for them.

**TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S.**
`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected: after
`engine/feature_fixture.js` builds and hashes every fixture feature, all four of this wire's counters
read **0**, so no branch it added executes on that board. REFIT OWED, and it is MEASURE's.
`tests/test-no-silent-failure.js` is red at **21** new silent catches against its baseline; **none is
in `engine/medicham2-browser.js` or `tests/test-mechanics.js`** — this wire added no `catch` at all,
and the 21st against WIRE 145's 20 is in `tests/roster.js`, which another agent is holding.

---

## ROADMAP #126 — QUICK GUARD BLOCKED NOTHING, AND THE TWO GUARDS CARRY BYTE-IDENTICAL TAGS. 2026-08-10.

Will: *"have quick guard block all prio moves and test it against some prio moves not that hard"*,
then *"its like armor tail"*. The second sentence is the diagnosis, and it turned a mechanic into a
wiring job.

### THE BOARD, MEASURED BEFORE ANYTHING WAS TOUCHED

A +1 priority attack into a defender, one source of refusal varied and nothing else, on the frozen
release. **Five of the six sources were already correct**, and all five already resolve through one
function (`priorityRefusedAbove`):

```
CONTROL  no guard          25   landed
Armor Tail                  0   REFUSED
Dazzling                    0   REFUSED
Queenly Majesty             0   REFUSED
Psychic Terrain             0   REFUSED
Wide Guard                 25   landed     <- CORRECT: it stops SPREAD, not priority
Quick Guard                25   LANDED     <- the only broken source
```

### THE CAUSE IS A NAME MATCH, WHICH IS THE THING THIS REPO FORBIDS

`quickguard` and `wideguard` carry **byte-identical tag lists** — `priority, neverMisses,
oneTurnGuard, statusCategory`. Three sites told them apart by spelling instead:

| site | what it said | what it cost |
|---|---|---|
| `playerActionPrimary` | `if(id==='wideguard')` | Quick Guard fell through the whole cascade to `{kind:'pass'}` — **927 corpus clicks bought a wasted turn** |
| `buildMon`'s usable filter | `id==='wideguard'` | a sheet's Quick Guard was **deleted from the body** before the turn loop saw it |
| the field | `wgA:false, wgB:false` | a boolean pair whose **NAME was the only record of what it guarded against** |

**`engine/tag_dex.js` DID NOT CHANGE AND DID NOT NEED TO.** `data/tags.json` has carried
`oneTurnGuard.blocks` — `"priority moves"` / `"spread moves"` — derived from each move's own
`condition.onTryHit` since the tag was written. Nothing read it. **`data/tags.json` and
`data/abra-tags.js` were NOT regenerated by this wire**, so there is no diff to report.

**MEMBERSHIP PRINTED BEFORE WIRING (LESSONS §4).** Exactly **two** of 500 moves carry `oneTurnGuard`
and they are these two; Crafty Shield and Mat Block are `isNonstandard: 'Past'` and absent from the
artifact entirely. `ignoresProtect` — the bypass rule — carries **14**: `afteryou block curse
decorate feint futuresight meanlook phantomforce psychup roleplay roar tearfullook transform
whirlwind`. All 14 genuinely lack `flags.protect` upstream, so all 14 genuinely bypass.

### THE AUTHORITY, CLAUSE BY CLAUSE (`data/moves.ts`, `quickguard.condition.onTryHit`)

- `if (move.priority <= 0.1) return;` — the **final** priority, so a Prankster-boosted status move
  (0 → +1) is refused and Quick Claw is not priority at all. The caller therefore adds the same
  `+_pk` Prankster term the ability bar already adds.
- `if (this.checkMoveBypassesProtect(...)) return;` — the move must carry `flags.protect`. Our
  `ignoresProtect` tag is derived from exactly that flag's absence, so it is the same test.
- `return this.NOT_FAIL;` — a blocked move is **not** a failed move, so `_mvRes` is left alone and
  Stomping Tantrum is not fed by a Quick Guard.

### WHERE IT LANDED, AND WHY THERE

Beside the ability bar at **WIRE 85's gate, above the kind dispatch** — because *"its like armor
tail"* is literally true: same question, same Prankster term, same side, same "only a move aimed at
the other side" scope. Putting it inside the attack branch would have missed every
Prankster-boosted status move, which is more than half of what Quick Guard is for.

It does **not** fold into `priorityRefusedAbove`'s return value, deliberately. That function answers
"above what priority is a move refused" as a single number over abilities and terrain; a side guard
has its own announcement and its own bypass rule, and folding it in would lose both. **Two sources,
one gate.**

Spread is **excluded at that gate on purpose** and handled per body downstream, because ROADMAP #81
WIRE 9 is the fix that made Wide Guard emit one `-activate` line per shielded body — answering the
spread case at a whole-action gate would collapse those two lines back into one.

### THE THREE PROBES, EACH SHOWN RED FIRST, EACH WITH A THIRD ARM

A two-arm probe here passes on an engine that makes **every** guard block **everything**, which is
the obvious wrong fix. So each carries a cross-control:

| probe | red → green | the third arm that stops the wrong fix |
|---|---|---|
| Quick Guard blocks a +1 priority move | Bullet Punch at the PARTNER: 28 → **0** | **Wide Guard on the same board still reads 28** |
| Quick Guard refuses a Prankster-boosted status move | Prankster Thunder Wave: `par` → **`none`** | the **same** Thunder Wave with **no Prankster** through the **same** Quick Guard still reads `par` |
| Feint goes through Quick Guard (`ignoresProtect`) | — | Bullet Punch behind the same guard reads **0** while Feint reads **29**, equal to its unguarded 29 |

**MY FIRST PROBE OF THIS WAS BROKEN AND IT IS THE INSTRUCTIVE PART.** It used **Sucker Punch**,
which fails unless the target is attacking — the defender was passing, so every arm **including the
control** read 0 and the board looked like universal refusal. The probes use an *unconditional*
priority move and **always print the control landing**.

**WIDE GUARD DID NOT REGRESS.** Both of its existing probes are green on the new code —
`ally took 92 without → 0 behind Wide Guard`, and `2 -activate lines, one per body, 0 damage`.

### COUNTERS

`MEDSEEN.sideGuardBlocked` — one counter for the whole family, because the guard that refused is
re-derived from the artifact and a per-name counter would put the forbidden name straight back.
Forced staging reads **2** (one Wide Guard block, one Quick Guard block).
`MEDFAILS.guardClassUnknown` — the artifact named a `blocks` class this engine has no predicate for.
**0**, and it is what stops a Crafty Shield arriving one day and quietly guarding nothing.

### FOUND AND DELIBERATELY NOT FIXED — reported, not absorbed

- **`chooseAction` STILL NAME-MATCHES `wideguard`, SO A ROLLOUT WILL NEVER CLICK QUICK GUARD.**
  Measured: 40 self-play games, 326 turns, bodies handed both guards — `sideGuardBlocked` **0**. The
  mechanic is live through `playerAction`, which is what the live bot, the differential and every
  probe use; the internal heuristic chooser cannot select it. Wiring it is a **play** change with no
  correctness probe available, so it is filed rather than smuggled in.
- **A SIDE GUARD DOES NOT FAIL WHEN ITS USER HOLDS THE LAST ACTION.** Both conditions carry
  `onTry() { return !!this.queue.willAct(); }`. WIRE 119 implements exactly this for `kind:'protect'`
  and has **never** implemented it for `kind:'wideguard'` — a pre-existing Wide Guard gap, not this
  wire's, and it needs its own failing probe.
- **THE STALL COUNTER, AND WHICH BEHAVIOUR WAS ASSUMED.** ROADMAP #59 says our tags collapse three
  protection-counter behaviours into two. The authority: a side guard **never** rolls a consecutive-use
  die (neither condition calls `runEvent('StallMove')`) but **does** `addVolatile('stall')`, which makes
  a *later Protect* fail. **Assumed here: the first half only** — consecutive Quick Guards do not roll,
  which matches the authority. The engine's pre-pass **resets** `tookProtectTurns` to 0 where the
  authority advances it; that line is left byte-identical, so this wire changes nothing about Protect.
- **WIDE GUARD DOES NOT STOP SPREAD *STATUS* MOVES.** The authority's condition has no category test
  — `if (move.target !== 'allAdjacent' && move.target !== 'allAdjacentFoes') return;` — so Cotton
  Spore and String Shot are blocked upstream and are not here, because the spread block sits inside
  the attack branch. The same derivation would close it. **Not taken on without its own failing probe.**
- **THE `ABRA_TAGS_OFF=1` CONTROL ARM NOW LOSES WIDE GUARD TOO.** The classifier asks the tag, and the
  OFF stub answers null for everything, so under that switch neither guard is built. That is the
  stated purpose of the switch — revert to pre-artifact behaviour — but it is a *change* to that arm
  and is named here rather than discovered later.

### ONE TEST WAS RE-AIMED, AND THE REASON IS THE FINDING

`tests/probe_red_demo.js` used **Quick Guard as its example of a `{kind:'pass'}` click** ("a move the
engine models NOTHING for"). Quick Guard is no longer one, so the reverted arm kept announcing it and
the demonstration stopped flipping. Re-aimed onto `psychup`, which that case already asserted beside
it. The Wide Guard reversal was re-anchored onto the rewritten lines; the CLAIM is unchanged.

**PRE-EXISTING REDS IN THAT FILE, MEASURED NOT ASSUMED: 5, and this wire added 0.** Two are STALE
reversals whose anchor (`let d=dmgRange(m,tg,mv,field,_spreadHit,isCrit);`) is **absent from release
snapshot `bfefdb697454` as well as from HEAD** — so they pre-date today. The other three
(`multiAccuracy` Triple Axel, `sealsMoves` Disable, `setsWeather` Sandstorm) contain no reference to
any guard. `tests/test-no-silent-failure.js` is red at 22 new silent catches; **none is in
`engine/medicham2-browser.js` or `tests/test-mechanics.js`** — this wire added no `catch` at all.

---

## FINDINGS THAT ARE NOT FIXES

- **THE CLOSET IS NEW MACHINERY AND NEEDS WRITING UP.** `DECLARED` quietens a *difference*; it cannot
  shelve an *absence*, which is what DID-NOT-FIRE is. `DEFERRED` in `tests/roster.js` shelves an ENTITY
  by name, with the owner's quote and the date. A deferred row is **still staged, still played against
  the authority, and still printed every run** — it just stops holding the gate. Deleting the entity
  instead would have made the shelf invisible. **And the shelf is checked:** if the row would now pass
  on its own, `would_pass_now` fires and `engine/quarantine.js` FAILS the stage with *"take the shelf
  down"*. Same discipline as the DECLARED staleness check that once retracted its own author's
  declaration.
- **THREE MORE NAME-HARDCODES OF THE SAME SHAPE, filed and not fixed.** `passiveHeal` matches
  `name === 'leftovers'`; `blocksSecondary` and `blocksPowder` match Covert Cloak and Safety Goggles,
  **both banned in this format**. Same defect as `speedMult` and `statMult` — a producer that can only
  name one member.
- **Three Fling facts checked at Will's prompt and all three were already correct**, so none is queue
  work: Light Ball flings for **paralysis**, Iron Ball for 130 BP and **no flinch**, King's Rock for
  **flinch** (96 uses, the only legal item here whose Fling carries a volatile).

---

## STANDING CAVEAT ON EVERY "USES" FIGURE BELOW

ROADMAP #70. Measured 2026-08-10 on Iron Ball: `tags.json` says 139, `g.sheets` (populated on 1.7% of
sides) says 15, `g.sets` says 0. **The queue is ORDERED by these numbers.** Every usage figure in this
file inherits that uncertainty and is quoted from `tags.json` unless stated otherwise.

---

## WIRE 149 — THE CHOOSER CAN CLICK QUICK GUARD. 2026-08-10.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| — | **Quick Guard, in `chooseAction`** | 927 tag / **601 store** | WIRE 148 made the mechanic WORK through `playerAction` — the live bot, the differential and every probe. `chooseAction`, the heuristic chooser that drives every **rollout** and every self-play game, still matched `me.moves.includes('wideguard')` **by name**, so MILTANK could never imagine clicking it | not a roster row — **a PLAY change**, measured as a rate, not a correctness claim |

Will, 2026-08-10: *"its gotta be able to click it man"*.

**THIS IS NOT A CORRECTNESS CLAIM AND THE PROBE SAYS SO.** Nothing here compares the engine to
Showdown. The authority has no policy, so no probe can show that its player would have clicked Quick
Guard on a given turn. What is asserted is behaviour at a **rate**.

### RED, REPRODUCED BEFORE ANYTHING WAS TOUCHED

200 self-play games / 1,176 turns, every side-A body handed **both** guards, foes usage-weighted with
their own movesets: **Quick Guard 0 clicks, Wide Guard 270.** `tests/test-side-guard-chooser.js` run
against a temporarily restored HEAD chooser is **5 FAILED, Quick Guard 0 of 1,500 games**; the file
was restored and its SHA-256 verified identical afterwards.

### WHAT IS DERIVED, AND FROM WHAT — NO SECOND NAME IN A NAME LIST

| question | source |
|---|---|
| which moves are guards | `TAGS.has('move', id, 'oneTurnGuard')` — **exactly 2 of 500**, printed by the probe |
| what each one refuses | `oneTurnGuard.blocks` through **`GUARD_PRED`, the same table the turn loop refuses with**, so the chooser cannot come to believe a guard stops something execution lets through |
| how often it clicks | the guard's own `uses` off the tag record, scaled against the most-used member. Wide Guard is the max, so it keeps **0.35 exactly**; Quick Guard gets 0.35 × 927/3997 = **0.0812** |
| is it worth a turn | per class, in the same table (`worth`) — see below |

The threat scan is Wide Guard's own, generalised: `live.some(fo => fo.moves.some(…))` became "does a
**live** foe hold a move of the class I refuse". Reading `live` is what answers CLAUDE.md's Focus-Sash
caution — a foe whose only priority user has **fainted** is not on `live` and stops being a threat,
with no bookkeeping to go stale. **The move list of the body on the field IS the open sheet** where one
was set; no species prior and no `meta-usage.json` read.

### THE THREE FILTERS THAT STOP IT FIRING ON THREE BOARDS IN FOUR

Without them "a foe holds a priority move" is true of **99.3%** of usage-weighted foe pairs, because
**Protect is +4**. Each filter is taken from the execution path rather than invented:

- **aimed at the other side.** The execution gate is `a.target && _pf.indexOf(a.target)>=0`; at
  selection time there is no action, so the move's own `target` is asked instead. Of the **29** moves
  above +0.1 in this format, only **17** are foe-facing — the other 12 are Protect, Detect, Endure,
  King's Shield, Spiky Shield, Baneful Bunker, Ally Switch, Follow Me, Rage Powder, Helping Hand and
  the two guards. Base rate **99.3% → 50.5%**. Two target sets cover all 14 strings across 500 moves;
  a fifteenth is counted (`MEDFAILS.guardTargetClassUnknown`, **0**).
- **it cannot be used this turn.** Fake Out is the most-used priority move in the corpus (
  re-read from `data/tags.json` on 2026-08-10; it said 16,761 when this row was written, and the
  corpus grew under it, which is the standing caveat above doing its job) and
  is legal only on its user's entry turn. Routed through **one** predicate — the rule had three copies
  by name and this wire needed a fourth reader, so all four now call `firstTurnOnlyRefused`.
- **it would fail anyway.** `needsTargetToAttack` — Sucker Punch (9,178) and Upper Hand (89) fail
  unless the target attacks, and a body raising a guard is not attacking. Read off the **tag**.

### THE SITUATIONAL HALF, AND WHY IT IS PER CLASS

Knowing the foe HAS priority is necessary and nowhere near sufficient. `worth` lives in the same class
row as `test`, so a class cannot have one and not the other:

- **spread → `true`**, which is a statement of Wide Guard's CURRENT behaviour, not a claim that no test
  would improve it. Its click count is a baseline other measurements rest on; moving it here was
  refused deliberately.
- **priority → the threat must cost something**: it FINISHES a body on my side (`max roll >= curHP`,
  through `dmgRange`), or it carries **`flinches`**, which takes the turn away at any HP — Fake Out,
  and the entry-turn gate has already refused it if it cannot be used.

`live.length>1` is kept and applied to **both**, so the branch has no name in it and the Wide Guard arm
is untouched.

### WIDE GUARD DID NOT REGRESS, AND IT IS A SET COMPARISON RATHER THAN A PROMISE

Its trigger set through the new derivation against the old bare `SPREAD.has(id)`, over all 500 moves:
**0 lost, 0 gained.** Its rate is 0.35 to the bit. Its own two census probes are green, and
`tests/test-priority-block.js`, `test-engine-consistency`, `test-medicham`, `test-rollout-effects`,
`test-speed-multipliers` and `test-tag-wire` all pass.

### THE RATE — THE NUMBER THIS WIRE IS ACTUALLY JUDGED ON

Measured on `data/games.ladder.jsonl` -- every side of every stored game (the count grows with each ingest, so it is deliberately not pinned here -- read it from the store):

```
HUMANS      Quick Guard   601 clicks     Wide Guard  6,460      ratio 0.093
TRIGGER     of the 482 sides that clicked Quick Guard, the OPPOSING side used one of the 17
            foe-facing priority moves in 63.3% of those games, against 37.5% over all sides -- 1.69x
```

One self-play run, 1,500 games, each body holding ONE guard assigned 50/50 and keeping three real
attacks (the turn count is printed by the probe and is not quoted here):

```
QUICK GUARD  48 clicks     WIDE GUARD  988 clicks     ratio 0.049
counters     sideGuardChosenVsPriority 50   sideGuardChosenVsSpread 998   sideGuardBlocked 308
```

**0.049 against a human 0.093 — roughly 2x CONSERVATIVE, and that is stated rather than tuned away.**
Nothing here was fitted to the target: the rate came out of the artifact and the situational half out
of the execution path. Moving it onto 0.093 would mean picking a constant to hit a number. The
direction is the safe one — CLAUDE.md's mega lesson is that a healthy counter at the wrong rate is
still a defect, and the failure it warns about is spamming.

**TWO ARTIFACTS DISAGREE ABOUT THESE MOVES BY 2.5x AND THE ENGINE CAN ONLY READ ONE.** `tags.json`
`uses` says 927:3,997 = 0.232; the store says 601:6,460 = 0.093. ROADMAP #70's standing caveat covers
exactly this. The store is the harder fact and is not readable at runtime, so the derived rate carries
the tag figure's 2.5x overstatement — which happens to offset part of the conservative situational
half. Both numbers are printed by the probe on every run so the gap cannot go quiet.

### FOUND WHILE THERE

- **`tests/test-tag-consumed.js` IS RED AT HEAD AND GREEN WITH THIS WIRE.** Measured three runs each
  way: HEAD exits 1 with *"1 tag(s) newly have NO consumer: `flinches`"*; this tree exits 0. The
  consumer it gained is `worth`'s flinch clause. Reported rather than claimed — a chooser heuristic is
  a thin consumer for a mechanic tag, and the real question is why the flinch path stopped asking.
- **`data/engine-data.js` CARRIES NO QUICK GUARD SET AT ALL** — 0 of 318 species; Wide Guard is on 8,
  and `MC.priors` has 14 Wide Guard rows and 0 Quick Guard rows. **Even a correct chooser cannot click
  a move no modelled body holds**, so self-play has to hand it out. That artifact is not this
  division's to edit; filed here with the count.
- **THE OTHER TWO WIRE 148 GAPS ARE NOT FIXED BY THIS DERIVATION, checked rather than assumed.** The
  `onTry()`/last-action failure is execution-time and untouched. Wide Guard's spread-**status** hole is
  in the attack branch and untouched — and note the chooser now *selects* Wide Guard against Cotton
  Spore, String Shot, Sweet Scent and Teeter Dance (they carry `spreadFoes`, so `GUARD_PRED` says it
  refuses them) while the turn loop does **not** block them. That disagreement was equally true of the
  old `SPREAD.has(id)` trigger, so it is pre-existing and unchanged; it is named here because this wire
  is the reason someone will read that line next.
- **`MEDSEEN.sideGuardBlocked` COULD HAVE BEEN CORRUPTED BY ITS OWN FIX.** The chooser asks the refusal
  question thousands of times a game HYPOTHETICALLY. `guardRefusalOf` was split out carrying **no
  counter** for exactly that reason, and the probe asserts the counter is still 0 after a full
  membership sweep.

### NEW SURFACE

`tests/test-side-guard-chooser.js` — three sections: membership, a deterministic 10-arm board where
**every control prints a real alternative click**, and the 1,500-game rate.
Counters: `MEDSEEN.sideGuardChosenVsPriority`, `MEDSEEN.sideGuardChosenVsSpread`;
`MEDFAILS.guardTargetClassUnknown`, `MEDFAILS.sideGuardRateNoUses`. Exported for the probe:
`foeThreatensGuardClass`, `sideGuardClickRate`, `guardMoveAimedAtFoes`.

Census **357 live / 357 probed / 0 missing / 0 threw — unchanged**, which is correct: this wire adds
no mechanic, it makes an existing one reachable by the search.

---

## WIRE 150 — THE HEAL TRUNCATED WHERE THE AUTHORITY ROUNDS. 2026-08-10.

Census **357 → 359 live, 359 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Two new
probes, each watched RED on its own before a line of the engine changed. Damage stages **1728/1728
exact**, unchanged. **No release was cut**, and neither `tests/roster.js` nor anything reaching
`engine/game_differential.js` was run.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| — | **Roost, Recover, Slack Off, Soft-Boiled, Life Dew** — the whole fraction-heal family | **6,398** (2,800 lifedew · 2,672 roost · 803 recover · 123 slackoff · 0 softboiled) | `Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1])` where `battle-actions.js:1015` is `(gen < 5 ? Math.floor : Math.round)(baseMaxhp * heal[0] / heal[1])`. Gen 9 **rounds**. Torkoal 145 healed 72 against 73; Torterra 170 Life Dew healed 42 against 43, **paid twice** because it heals the partner too | *engine fixed; roster NOT re-run by me* |

```
- return Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1]);
+ return Math.round(x.st.hp*_hp.fr[0]/_hp.fr[1]);
```

**IT IS `Math.round`, NOT THE `md4096` ONE LINE ABOVE IT.** The two arms of `_size` mirror two
different authority paths. The weather family is `this.heal(this.modify(pokemon.maxhp, factor))` on a
float factor, and `modify` **is** the 4096ths chain — `md4096` is right there. The fraction arm has no
`modify` in it: a plain round over an **exact integer pair** off the move. Spending `md4096` here
would push `[1,2]` through a float and a 4096ths truncation the authority never applies, which is the
lossy-float trap WIRE 4's note is about (5448/4096, not 1.33). They happen to agree at `[1,2]` and
`[1,4]` — that is a coincidence of powers of two, not the same function.

### WHY IT SURVIVED EVERY EXISTING HEAL PROBE

The old fixture inflated max HP **fourfold**, so every fraction divided **exactly** and floor and round
could not disagree; and it chipped with the smallest neutral hit, so the heal **overshot and clamped to
full**. Two blindfolds at once — the right answer and the wrong answer were the same number. The
surviving `healsSelf` probe asserts `test[0] > 0`, and a truncation is still > 0. So both new probes
require **maxhp × heal[0] / heal[1] NOT whole** and a **chip deeper than the heal**.

### THE TWO PROBES — THE CONTROL IS THE POINT, AND THE NUMBERS ARE THE AUTHORITY'S

Staged in a real `gen9championsvgc2026regmb` `Battle`, chipped to a tenth and clicked:
Torkoal 145 Recover **14 → 87** (gained 73); Torterra 170 Life Dew **17 → 60** (gained 43).

| tag | control arm | test arm |
|---|---|---|
| `move\|healsSelf` | Torterra **170,85** — 170/2 is whole, floor and round agree, this arm **cannot move** | Torkoal **145,73**; a truncating engine reads 72 |
| `move\|healsAlly` | Torkoal **145,36,36** — 145/4 = 36.25 rounds **DOWN**, so a **ceiling** is caught here | Torterra **170,43,43**; a truncating engine reads 42 on **both** bodies |

The only varied knob is the **parity of max HP**. Max HP is returned beside the gain so the probe fails
loudly if `buildMon` ever hands back a different body.

### THE DIGEST SWEEP — 981,756 CELLS, 30 DIFFER, 5 MOVES

Every move in `data/tags.json` (500), six scenarios each (mid roll, both pin corners, aimed and with no
target), two turns apiece so residuals and clocks land, digested as the whole board — every primitive
on all four active bodies and all four benched ones, plus the field and both side conditions. BEFORE is
the current file with **this one character reverted**, compiled under the real medicham path so its
relative requires resolve identically.

**Five moves moved: `recover`, `roost`, `slackoff`, `softboiled`, `lifedew`. Nothing else in the corpus
moved by a single HP.** Life Dew contributes one cell per scenario rather than two, because Torkoal's
145/4 rounds down — the control, visible in the sweep itself.

**THE FIRST RUN OF THAT SWEEP PRINTED `0 cells differ` OVER 3,000 CELLS, EVERY ONE OF WHICH HAD THROWN.**
A circular reference in the digest turned every scenario into a one-cell `THREW` row, and the two arms
agreed perfectly about nothing. It was caught only because the throw count is printed beside the diff
count. That is this project's signature failure appearing inside the instrument built to prevent it.

### NO SECOND ROUNDING — THE CALLERS, NAMED

`_size`'s only caller is `amt`: `curHP = Math.min(st.hp, curHP + _size(x))`, a **clamp**, not a
rounding. `_hp.fr` is read at exactly one site; `healParam`'s other caller, `playerAction`, uses it only
to decide `kind:'heal'`. `board.js`'s `healValue` reads the same `[num,den]` but as a fractional feature
in 0..1, never an integer HP count.

### EVERY OTHER `Math.floor` HEAL WAS CHECKED AND MUST STAY A FLOOR

`Battle#heal` does `damage = this.trunc(damage)`, so `pokemon.heal(baseMaxhp / N)` truncates: healing
berries, Hospitality, `healsOnSwitchOut`, the absorb-ability gains, Grassy Terrain, `passiveHeal`.
**Pollen Puff is the sharpest case** — its handler is literally
`this.heal(Math.floor(target.baseMaxhp * 0.5))`, so the `allyheal` branch flooring **is** the authority
and a blanket floor → round would have broken it. Drain already rounds and Shell Bell already
clamps-then-truncates, each with its own note.

### A RED THAT IS NOT MINE, MEASURED RATHER THAN ASSUMED

`node engine/status.js` prints **FEATURE SEMANTICS CHECK FAILED** against `data/policy-weights.json`
for eight features. `engine/feature_fixture.js`'s `hashes()` was computed over the AFTER bytes and the
BEFORE bytes: **all 58 identical, 0 moved by this wire.** REFIT OWED against the damage-path wires;
it belongs to MEASURE. Reported, not filed.

---

## WIRE 153 — A SELF-TARGETING STATUS MOVE CLICKED WITH NO TARGET FAILED OUTRIGHT. 2026-08-10.

Nine moves, **1,322 corpus uses**, every one of them `target: 'self'` in the dex:

```
substitute 807   imprison 328   destinybond 104   stockpile 66   focusenergy 12
endure 4         magnetrise 1   powershift 0      powertrick 0
```

A `self` move names nobody on the request — there is nothing to aim — so a driver that asks the
authority what is legal hands this engine a **null**. `tgtSlot` is then `-1`, `reaimToSlot` returns
that same null by design, `_tl` came out **empty**, and `if(!_tl.length){mvFail(m);continue;}` spent
the turn on a `|-fail|`. This is ROADMAP #81 WIRE 9's defect (a spread click with no target was a
no-op turn) in the self-targeting case, and WIRE 146's side effect fixed the spread half of it in this
same branch.

### SUBSTITUTE IS 807 OF THE 1,322 AND ITS DEFECT WAS **NOT** THE FAMILY'S. SAY IT LOUDLY.

The brief for this wire said the family loses a whole turn. That is true of eight of the nine and
**false of Substitute**, and the probe was written before the engine was touched precisely so this
would surface rather than be assumed. The HP cost and the doll are charged in the `costsUserHP` block
**above** the kind dispatch, which never looks at a target. Measured on a real turn, before a line
changed, a 125 HP Toxapex clicking Substitute with no target:

```
|move|p1a: toxapex|substitute|p1a: toxapex
|-start|p1a: toxapex|Substitute      <- the doll WAS built
|-damage|p1a: toxapex|94/125         <- and paid for
|-fail|p1a: toxapex                  <- and then the move reported FAILURE
```

So the state was already right and the **result flag** was wrong: `_mvRes === false`. That is not
cosmetic. `_mvResLast === false` **doubles Stomping Tantrum's base power** (medicham2:3448), so an
untargeted Substitute was arming the user's next Stomping Tantrum. Everything downstream that reads
`SUBPASS` is untouched by this wire — `subBlocks` never saw a different `_sub` on any arm.

**Nothing else about Substitute changed.** Both failure cases were re-measured and both still hold:
below a quarter HP it fails and costs nothing (`hp 30 -> 30, sub 0`), and a second click fails free
(`hp 94, sub 31, result false`) exactly as the self-aimed click does.

### THE TARGET IS **DERIVED**, NOT DEFAULTED — AND THAT IS THE WHOLE GUARD

`if (no target) use the user` would silently re-aim a **foe**-directed move whose target went missing
for a real reason. Showdown refuses that click itself (*"Can't move: You can't choose a target for
Charm"*) and WIRE 9 already treats it as an error. So the rule reads the move's own `target` field and
**only `target === 'self'` is self-resolving**, because that is the one value meaning the move has no
target to lose. `normal`, `any`, `adjacentAlly`, `adjacentAllyOrSelf`, `allySide` and the rest all name
a body the caller has to choose; a null there is still a genuine failure and still falls to `mvFail`.

**Membership printed over the whole move table before it was wired**, per docs/LESSONS.md 4. Of the
500 moves in `data/tags.json`, **135** reach the `affect` branch with no target supplied. Exactly the
nine above carry `target: 'self'`; **not one other move does**. The other 126 are damaging clicks that
could not be aimed (already counted loudly by `MEDFAILS.damagingClickWithoutTarget`), the three
`allAdjacentFoes` and one `allAdjacent` members the spread arm already serves, and foe-directed status
moves — Scary Face, Charm, Taunt, Encore — every one of which must keep failing.

### A SECOND BEHAVIOUR CHANGE, DECLARED RATHER THAN LEFT IN A DIFF

A `self` move now resolves to its user **whatever the caller aimed at**, not only when the aim was
null. A caller aiming one of these nine at a **foe** used to run the user's own volatile through the
**foe's** gauntlet. Measured before and after, a Toxapex clicking Stockpile across the field:

| aimed at a foe that… | before | after |
|---|---|---|
| Protects | user gets **no layers** | `stockpile`, +1/+1 |
| is Gholdengo (Good as Gold) | user gets **no layers** | `stockpile`, +1/+1 |

Showdown cannot express that click at all — `getMoveTargets` returns `[pokemon]` for a `self` move and
never consults the request — so one resolution for all three aims is both the rule and the reason the
untargeted click is provably the **same move** rather than a second code path that happens to agree.

### THE PROBES — RED INDIVIDUALLY BEFORE THE FIX, GREEN AFTER

Three added to `tests/test-mechanics.js`, all three armed, none direct-call, on a new `selfAim(`
helper declared at the REALTURN ratchet. Each carries the same control: **a foe-directed status move
clicked with no target must still fail**, on the same body and the same board, so the only varied knob
is the move's own `target` field.

| tag | test arm (untargeted) | control arm |
|---|---|---|
| `move\|substitute` | two clicks `hp 94 sub 31 res true` then `res false`; at 24% HP `hp 30 sub 0 res false` — every row **identical** to the self-aimed run | Scary Face (`target: normal`) with nobody named: `res false`, foe spe **0** |
| `move\|layeredVolatile` | four clicks `stockpile:1/1/true 2:2/2/true 3:3/3/true 3:3/3/false` — identical to the self-aimed run | four Scary Faces: `-:0/0/false` x4, foe spe **0** |
| `move\|statusInflict` | Imprison (Hatterene), Destiny Bond (Gengar), Endure (Toxapex) each land their volatile with `res true`, each identical to the self-aimed click | Hatterene's Charm with nobody named: volatile `-`, `res false`, foe atk **0** |

Every body legally learns what it clicks, checked against the format's own learnsets rather than
remembered. Flutter Mane was the first choice and **has no `MC` row in this format** — caught by the
probe throwing, not by memory.

### THE DIGEST SWEEP — 1,500 CELLS, 9 DIFFER, 0 THREW

Every move in `data/tags.json` (500), three aims each (**no target**, at the user, at the foe), two
real turns apiece so clocks and residuals land, digested as the whole board: every primitive on all
four active bodies and both benches, the field, both side conditions and the full emitted trace.

```
cells 1500   DIFF cells 9   THREW before 0  after 0
```

**Nine moves moved and they are exactly the nine, and only in the `none` cell.** Nothing outside the
list. The `foe` cell is unchanged in the sweep because the sweep's foe passes — the foe-aim change
above needs a foe that actually *refuses*, which is why it was measured separately and is stated
separately.

The throw count is printed beside the diff count for WIRE 150's reason: its first sweep reported a
perfect zero over cells that had all thrown.

### CENSUS AND GATES

**369 live / 369 probed** -> **372 live / 372 probed / 0 missing / 0 threw / 0 hollow / 0 unarmed /
0 directCall.** Damage stages **1728/1728 exact**. `test-medicham`, `test-engine-consistency`,
`test-dead-volatile` and `test-wiring` all pass unchanged.

**The counter proves it ran:** `MEDSEEN.selfTargetToUser` reads **3** for three aims of one Stockpile.
It counts every `self`-target resolution, not only the untargeted ones, because the point of the wire
is that the three aims are now one resolution — a counter that fired only on the broken shape could
not tell "the fix is on the path" from "nothing clicks these any more".

### A FINDING THAT IS NOT A FIX — PRANKSTER REFUSES YOUR OWN SELF-TARGETING MOVE

`pranksterBlocked(m, _t, id)` is asked with `_t === m` on this path and tests only whether the target
has the Dark type. So a **Prankster Dark-type clicking Substitute on itself is refused**. Showdown's
`hitStepTryImmunity` guards that check with `!targetsAlly`, so a `self` or ally move is exempt. This is
**pre-existing** — the self-aimed click has hit it since the branch was written, and this wire neither
creates nor widens it: both arms behave identically, which is what the equivalence probe asserts.
Reported, not filed, and not fixed in this pass — one mechanic at a time.

### NOT CLAIMED

No roster row is closed here. `tests/roster.js` is Will's to run against a frozen tree, and no engine
release was cut by this wire.

---

## WIRE 154 — FOUR HEAL MOVES, NOT ONE OF THEM A SELF-HEAL, ALL FOUR A WASTED TURN. 2026-08-10.

Census **372 → 376 live, 376 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, each watched RED on its own before a line of the engine changed. Damage stages **1728/1728
exact**, unchanged. **No release was cut**, and neither `tests/roster.js` nor anything reaching
`engine/game_differential.js` was run.

**ONE PRIMITIVE, NOT FOUR FIXES.** Four moves carry `healsSelf` or `healsAlly` and every one of them
needs a fact that tag cannot express — WHO is healed, WHEN, HOW MUCH, whether status clears, whether
the user dies. Writing that four times is four places to disagree, so one tag shape carries all five.

| # | row | uses | what it was | verdict move |
|---|---|---|---|---|
| — | **Heal Pulse** | 148 | `{kind:'pass'}` — a wasted turn. Its ability twin **Hospitality works** and Life Dew works, so "this engine cannot heal another body" was never the reading | *engine fixed; roster NOT re-run by me* |
| — | **Wish** | 63 | `{kind:'pass'}`. The slot condition did not exist at all | *engine fixed; roster NOT re-run by me* |
| — | **Rest** | 61 | `{kind:'pass'}` — unwired on all three of HP, status-cure and sleep. A probe reading only HP passes on a broken Rest | *engine fixed; roster NOT re-run by me* |
| — | **Healing Wish** | 16 | `{kind:'pass'}`, and **the user did not even faint** — so the engine offered a search a free full restore for the next body in with its whole cost missing. Strictly better than the real move | *engine fixed; roster NOT re-run by me* |

### THE TAG — `healDescriptor`, DERIVED, MEMBERSHIP PRINTED FIRST

```
healpulse    {amount:{fraction:0.5, of:'recipient', round:'ceil'}, who:'target', when:'now'}
wish         {slotCondition:'wish', who:'slot', when:'endOfNextTurn',
              amount:{fraction:0.5, of:'user', round:'trunc'}}
rest         {amount:{full:true, of:'recipient'}, who:'target', when:'now',
              setsStatus:{status:'slp', turns:3}, curesStatus:true}
healingwish  {slotCondition:'healingwish', who:'slot', when:'onEntry',
              amount:{full:true, of:'recipient'}, curesStatus:true, userFaints:'ifHit'}
```

**MEMBERSHIP PRINTED OVER THE WHOLE MOVE TABLE BEFORE THE CONSUMER WAS WRITTEN.** 22 moves in this
format carry `flags.heal`; the descriptor matches **four**, and every refusal is a move some other
param already sizes — a double claim would double-heal:

| declined | why | who sizes it instead |
|---|---|---|
| bitterblade drainingkiss drainpunch gigadrain hornleech leechlife matchagotcha paraboliccharge | `m.drain` | `drain` |
| lifedew recover roost slackoff softboiled | `m.heal` is a PAIR | `healsSelf` / `healsAlly`, WIRE 150's arm |
| moonlight morningsun synthesis swallow | a `this.modify` factor, a 4096ths chain | `weatherScaled.baseHealFraction`, `healsSelf.byVolatileLayers` |
| strengthsap | `this.heal(atk, ...)`, a bare variable | `healsSelf.fromTargetStat` |

**THE ROUNDING IS CARRIED BECAUSE IT GENUINELY DIFFERS ACROSS THE FAMILY** — this is WIRE 150's
distinction arriving a third and a fourth time. Heal Pulse is `Math.ceil(target.baseMaxhp * 0.5)`; Wish
books `source.maxhp / 2` as a raw float that `Battle#heal` **truncates**. Picking one rule for the
family is wrong by one HP on the other member, every time, in the direction that decides a faint.

**`of` IS THE HALF A ONE-BODY PROBE CANNOT SEE.** Heal Pulse reads the RECIPIENT's max, Wish reads the
USER's. On a board where both bodies have the same max HP those are the same number, so every arm below
uses Clefable 170 against Garchomp 183 and asserts the exact integer.

### THE NUMBERS ARE THE AUTHORITY'S, STAGED IN A REAL `gen9championsvgc2026regmb` BATTLE

```
|-heal|p1b: Garchomp|93/183                                        Heal Pulse   +92 = ceil(183/2)
|-heal|p1a: Garchomp|86/183|[from] move: Wish|[wisher] Clefable    Wish         +85 = trunc(170/2)
|-status|p1a: Toxapex|slp|[from] move: Rest                        Rest         brn -> slp
|-heal|p1a: Toxapex|125/125 slp|[silent]                                        31 -> 125
|faint|p1a: Clefable                                               Healing Wish user dies
|switch|p1a: Garchomp|Garchomp, L50, F|1/183 par
|-heal|p1a: Garchomp|183/183|[from] move: Healing Wish                          full, par cleared
```

medicham2 after the wire reads **+92**, **86 at the end of turn 2**, **125/125 slp**, and **user down,
Garchomp 183/183, status cleared** — the same four numbers.

### FIVE THINGS THE AUTHORITY DECIDED THAT WOULD OTHERWISE HAVE BEEN GUESSED

Each read off a staged game rather than remembered, and each is a refusal the engine now honours. All
five agree with medicham2 on the board:

| staged | authority | medicham2 |
|---|---|---|
| Rest at FULL HP | fails as a heal — **no sleep**, because `onTry` refuses before `onHit` | identical |
| Rest while ALREADY asleep | `cant ... slp`, no heal | identical |
| Heal Pulse at full HP | fails as a heal on the target | identical |
| Wish clicked twice | second click fails; the pending one is NOT refreshed | identical |
| Healing Wish with a dead bench | fails, and **the user survives** (`onTryHit` reads `canSwitch`) | identical |

Two more, taken the same way and written into the code:

- **Healing Wish collects BEFORE the hazards.** The stream reads the full restore and then the Stealth
  Rock chip, in that order. It is consumed in `bringIn` — WIRE 41's one-entry-path rule — above the
  hazard block.
- **Healing Wish's slot condition SURVIVES a replacement that needs nothing.** The guard is
  `if (!target.fainted && (target.hp < target.maxhp || target.status))`, and a full-HP statusless
  replacement leaves `slotConditions` still holding `healingwish`.

### WHERE THE SLOT CONDITION LIVES, AND THE TWO ORDERING FACTS

`sf.slot`, keyed by **slot index**, on the side object — never on the body. That is the whole mechanic:
the wisher is expected to leave and the Healing Wish user is dead before its own HP arrives, so a
record on the body would model a different move.

- **The clock ticks in its own pass, outside the residual body loop.** The loop walks LIVING bodies and
  skips an empty or dead slot, so a clock inside it would *freeze* rather than expire — the same shape
  as the Perish Song bug that froze on the bench. A Wish that comes due on an empty or dead slot is
  **spent and discarded**, never banked for the replacement, because the authority's `onEnd` declines
  and removal happens regardless.
- **Wish pays out between the sandstorm chip and the terrain/Leftovers heal.** `onResidualOrder` is 4:
  after weather (1), before terrain and Leftovers (5), the seed (8) and the status chips (10). Above
  the sand it would rescue a body the real game lets the sand kill.

### THREE PROTOCOL LINES DELIBERATELY NOT EMITTED

Each because the authority does not emit it, and a spurious line is the worse error:

- laying a slot condition announces **nothing** — the Wish move line is followed straight by `upkeep`;
- `clearStatus()` on the Healing Wish recipient is **silent** — no `-curestatus` in the real stream;
- Healing Wish's faint has **no `-damage` before it**, unlike the `affect` branch's Memento site.

### THE DIGEST SWEEP — 1,500 CELLS, 12 DIFFER, 0 THREW

Every move in `data/tags.json` (500), three aims each (**no target**, at the user, at the foe), two real
turns apiece so clocks and residuals land, digested as the whole board: every primitive on all four
active bodies and both benches, the field, both side conditions and the full emitted trace.

```
cells 1500   DIFF cells 12   THREW before 0  after 0
MOVES THAT MOVED (4):  healingwish  healpulse  rest  wish     (all three aims each)
```

**THE FIRST SWEEP READ 84 CELLS AND 55 MOVES, AND IT CAUGHT A REAL DEFECT.** `bringIn` read the slot
map through `slotCondOf`, which *installs* an empty map — and every entry in the game goes through
`bringIn`, so 51 unrelated moves showed `slot: undefined -> {}` on a side where nothing had happened. A
reader must not write; it now reads `sf.slot` directly. The throw count is printed beside the diff
count for WIRE 150's reason: its first sweep reported a perfect zero over cells that had all thrown.

### `data/tags.json` AND `data/abra-tags.js` WERE REGENERATED — 0 REMOVED / 0 ADDED / 4 CHANGED

One new tag (`move|healDescriptor`, 205 → 206 rows in the tag index) and four moves gained it. No
entity gained or lost anything else. Tag coverage **188/199 → 189/200 probed**, 11 unprobed unchanged.

### THE COUNTERS PROVE IT RAN

`MEDSEEN.healDescriptorNow 2`, `healDescriptorSet 2`, `healDescriptorSlot 2`, `healDescriptorStatus 1`,
`healDescriptorFaint 1` over one click of each of the four. Both failure counters are **0** —
`MEDFAILS.healDescriptorRounding` (a rounding name this engine does not implement, which falls to
`trunc` and says so) and `healDescriptorMissing` (the branch reached with no descriptor to read).

### GATES

`test-damage-stages` **1728/1728 exact**. `test-medicham`, `test-engine-consistency`,
`test-dead-volatile`, `test-wiring`, `test-protocol-trace`, `test-battle-api`, `test-charge`,
`test-choice-lock`, `test-entry-effects`, `test-forced-switch`, `test-future-sight`,
`test-medicham-coverage`, `test-drop-guard`, `test-encore-gate` and `test-artifact-keys` all pass
unchanged.

**TWO GATES ARE RED AND NEITHER IS THIS WIRE'S — SAID, NOT FILED.**
`tests/test-no-silent-failure.js` reports 24 NEW silent catch blocks against a baseline stamped
**2026-08-06**; not one of them is in a file this wire touched, and this wire adds **zero** catch
blocks. `tests/test-mc-key.js` fails naming `tests/test-pinch-family.js` and
`tests/test-side-guard-chooser.js`, neither of which this wire created or opened. Both are red on the
tree as it stands and belong to whoever owns them; they are reported here so the redness is on the
record rather than absorbed.

### A GAP DECLARED RATHER THAN DISCOVERED

**Ally Switch does not move a slot condition with the bodies it swaps.** Composing Wish with Ally Switch
on one side inside two turns would put the HP in the wrong slot. Stated in the code at `slotCondOf` and
here; there is no failing probe on it and no measurable corpus exposure, and a mechanic is not open work
until a probe fails on it.

### NOT CLAIMED

No roster row is closed here. `tests/roster.js` is Will's to run against a frozen tree, and no engine
release was cut by this wire.

---

## THE DRIVER COULD NOT NAME AN ALLY — 2026-08-10, MEASURE. THE INSTRUMENT, NOT THE SIMULATOR.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 31 | **Heal Pulse** | 148 | `engine/game_differential.js scripted()` derived the medicham target as `foeSlot = target > 0 ? target - 1 : null`. Showdown's numbering makes a **NEGATIVE** target a body on your OWN side, so every ally-aimed click reached `M.playerAction(mon, id, null, field)` **with no target at all**. The choice string was correct and the authority played the turn correctly; only our half was blind | DID-NOT-FIRE → **FIRED-AND-BOARDS-MATCH** |

**THE ENGINE WAS NEVER AT FAULT AND THE CONTROL IS WHAT SAYS SO.** `lifedew` sits in the SAME rule
(`move/heals-a-body-that-was-damaged-first`), the same fixture, the same turn, and read
FIRED-AND-BOARDS-MATCH throughout — because `target: 'allies'` hits the whole side and needs no aim.
Heal Pulse is `target: 'any'`, the roster aims it at the partner with `t = -2` → `move n -1`, and that
is the only difference between the two rows. Handed the ally BODY directly, WIRE 154's `healdesc`
branch heals 38 → **123 of 170**, which is the authority's own number.

**IT IS THE THIRD INSTANCE OF ONE ROOT CAUSE AND IT IS NOT FIXED AS A SPECIAL CASE.** The same
translation could not aim `scripted` (Counter, Comeuppance, Metal Burst, Mirror Coat) or `randomNormal`
(the lock-in five) either — both diagnosed against this file earlier in this sprint. A click now
carries an **AIM** — `{rel:'foe'|'ally'|'self', slot}` — read off the number the AUTHORITY receives, so
it cannot disagree with the choice string by construction, and each engine resolves it against its own
arrays. There is no second table of target types to keep in step; `foeSlot` is gone from the file.

| target in the choice string | resolves to | which target types reach it |
|---|---|---|
| `> 0` | the foe in slot `target-1` | `normal`, `any`, `adjacentFoe` aimed across the field |
| `< 0`, a slot that is NOT the clicker's | **the ALLY in that slot** | `adjacentAlly` (Dragon Cheer, Aromatic Mist, Coaching, Helping Hand), and `normal` / `any` aimed at the partner (Heal Pulse, Pollen Puff) |
| `< 0`, the clicker's OWN slot | the clicker | `adjacentAllyOrSelf` (Acupressure) |
| `null` | **NOBODY, and it stays nobody** | `self`, every spread target, `randomNormal`, `scripted` |

**THE LAST ROW IS THE LOAD-BEARING ONE.** `MEDFAILS.damagingClickWithoutTarget` is the signal that a
damaging click could not be aimed, and 126 moves legitimately reach it; turning "no target" into "aim
at something" would delete it. Measured on release `ec4dc5fd4a0d` after the change: a damaging click
with no target still falls through (`kind: 'affect'`) and the counter still moves **0 → 1**, and naming
a foe leaves it still. `self` keeps resolving inside the engine (WIRE 153) and `randomNormal` inside
the engine (WIRE 144) — the driver does not second-guess either.

**WHAT MOVED, MEASURED RATHER THAN PREDICTED.** Full `--stage moves`, release `ec4dc5fd4a0d` on both
sides, written to a trial artifact and **not** to `data/roster.moves.json`:

```
before  17 DIFFER   13 DID-NOT-FIRE   406 MATCH   64 COULD-NOT-STAGE   (data/roster.moves.json, 08:31)
after   17 DIFFER   12 DID-NOT-FIRE   407 MATCH   64 COULD-NOT-STAGE
exactly ONE row of 500 changed verdict: healpulse.  reds identical, COULD-NOT-STAGE set identical.
```

`acupressure`, `aromaticmist` and `coaching` — the other three rows whose click carries a negative
target — were re-run individually and all three stay FIRED-AND-BOARDS-MATCH. `dragoncheer`,
`helpinghand` and `mirrorcoat` are COULD-NOT-STAGE and cannot move. **No roster row is claimed closed
here: the artifact is Will's to write.**

**NOT FIXED, AND NOT SILENTLY EITHER.** `counter` / `comeuppance` / `metalburst` (`scripted`) and the
lock-in five (`randomNormal`) are **untouched by this change** — Showdown names no target for either
family, so the driver has no slot to translate and inventing one would be the instrument asserting a
fact the authority declined to give. Their aim stays `null` and belongs to the engine, exactly where
WIRE 144 put the `randomNormal` half. The lock-in five already read MATCH on the 08:31 artifact; the
four `scripted` rows read DID-NOT-FIRE and this does not move them.

**THE COUNTER PROVES IT RAN**, because a capability that cannot is assumed broken. Every run prints
`clicks by AIM: N at a foe, N at an ally, N at self, N naming nobody, N named a slot with NO BODY in
it`, and the last must read 0; the same five land in the artifact as `aim_foe` / `aim_ally` /
`aim_self` / `aim_none` / `aim_slot_empty`. Driven end to end on one staged turn, an ally click reads
`ally 1` and the turn is described as *"Clefable clicks Heal Pulse at its ally Snorlax"* — that
sentence was `clicks Heal Pulse` with no target named at all before, which is the same blindness one
level up. Mode A, 12 games: `189 foe, 0 ally, 0 miss`; random play rarely offers an ally-aimed move, so
the 0 is a fact about the sample and not about the path.

**A SECOND CONSEQUENCE, STATED BECAUSE IT MOVES MODE A.** Coverage credit reads a SCOPE of slots, and
an ally-aimed move used to put only the user's slot in it — so the one thing such a move does sat
outside the window its credit is read from. The aimed slot is now in scope whichever side of the field
it is on. That changes which entities get credited in random play, and this driver steers on credit, so
**mode A runs before and after this change are not directly comparable**, for the same reason ROADMAP
#91 gives.

### FOUND AND NOT FIXED — REPORTED, PER THE ROUTING RULE

- **`scripted()` falls back to the DEX row when the request omits `target`.** `chooseAction` already
  treats an absent `target` on the request entry as "do not name one", and its comment records four
  thrown games from getting that wrong (`Can't choose a target for Solar Beam`). `scripted()` still
  reads `'target' in act.moves[k] ? act.moves[k].target : dm.target`, so a LOCKED body — the release
  turn of a two-turn move — is handed a target the authority refuses. One fact, two implementations,
  one of them wrong. **Left alone deliberately:** fixing it turns a thrown scripted turn into a played
  one for the two-turn family, which changes what the roster can stage.
- **`tests/roster.js:2079` now describes the old behaviour.** Its `allySlot` comment argues the aim is
  safe because "the medicham side receives `foeSlot: null` — precisely what it already receives for
  Life Dew". That reasoning is exactly what hid this defect: Life Dew needs no aim and Heal Pulse does.
  Not edited from here — the file is mid-sprint and its bytes decide what Will re-runs.
- **`oneHitDamage()`, the damage-interior helper, still does `foes[w.t]`.** A negative `t` would index
  off the end. No `DIRECTED` scenario aims one at an ally today, so it is a latent hazard rather than a
  defect — but it is a third copy of the same arithmetic and should call `aimOf`.

### GATES

`tests/test-game-differential.js` ALL PASSED; `tests/test-state-differential.js` all parts pass;
`tests/test-effect-credit.js`, `tests/test-pin-arms.js`, `tests/test-arm-steering.js`,
`tests/test-nature-differential.js`, `tests/test-speed-tie.js` and `tests/staged_status_counters.js`
(live tree IDENTICAL on every scenario) are green.

**ONE GATE IS RED AND IT IS NOT THIS CHANGE'S — SAID, NOT FILED.**
`tests/test-effective-identity.js` fails `no NEW raw read of a transforming field` (1048 against a
baseline of 234). Its per-file delta names `champions_sim.js`, `probe_pair.js`, `roster.js` (0 → 232),
`staged_board.js`, `test-nature-differential.js`, `test-pinch-family.js` and
`test-side-guard-chooser.js`. `game_differential.js` is not among them, and this change is net zero on
that regex — it replaced one `.species` read with one `.species` read. Red on the tree as it stands and
owned by whoever holds those files.

## ROADMAP #68 — THE GAME REPLAYER EXISTS, AND ABOUT ONE TURN IN TWENTY DIVERGES

Built, red-proofed, run. **Roughly one turn in twenty diverges from what actually happened**, and
turn 1 alone — the only arm with no invisible state in it — diverges at about the same rate. Skip
rate under 2%, all "no turns recorded". **Zero exceptions.**

**The counts are deliberately not restated here.** They live in `data/replay-differential.json`,
which is rewritten on every run, with forty readable frozen boards in
`data/replay-differential-freezes.json`. A figure typed into prose beside an artifact that moves is
the staleness this file exists to prevent — and it went stale within the hour, which is the proof.

**This is the first number in the project that asks whether we reproduce a real game.** The damage
differential compares one calculation per row, has never run a turn loop, and reads 0 disagreements
at 20,000 comparisons — it is silent about every mechanic this sprint fixed.

**THE ROLL-IDENTIFICATION IDEA IS UNAVAILABLE HERE, MEASURED NOT ASSUMED.** Will proposed computing
all 16 damage rolls and identifying which one was played; I endorsed it as better than pinning. It
is better, and this corpus cannot support it: Champions sheets do not declare SP — 884 of 52,089
games carry an open sheet and **every one has `evs: null`**. The record states damage as an integer
percent of an unknown maximum. Median attainable interval **60.13 points of max HP against a
3.76-point roll step**, so the legal-spread envelope is several times wider than the entire 16-roll
band. `matched` fires twice in the entire run. The test is inverted into the one the record supports,
and the interval WIDTH prints beside every verdict so "in span" cannot be read as "exact".

**Divergences by mechanic:** 145 turn-order/SPEED, 72 damage x0.5-ish, 59/57/31/18/15 status
slp/brn/psn/par/frz, 56 x0.25-ish, 32 x2-ish, 25 a KO our maximum roll cannot reach, 17 x4-plus,
14 turn-order/PRIORITY.

**Bot games are valid material and the data says so, not the argument:** bot-v-human and
human-v-human diverge within one point of each other. Two populations, same answer.

**Four instrument bugs were found by reading its own freeze dump**, each at or near the top of the
mechanic table — a mega not applied before its own turn, a Weather Ball priced in clear skies
because the sun was set three events earlier in the SAME turn, a KO clamp read off a reconstructed
HP rather than the record's own figure (56 of 158), and weather with no expiry doubling Swift Swim
for the rest of the game. Turn-order divergences fell 26 → 6 per 100 games as these closed. The
instrument had to be debugged before its output meant anything, which is what a freeze dump is for.

It **refuses to write its artifact** if its own three planted corruptions go unnoticed — checked
every run rather than behind a flag somebody has to remember.

**Filed to OPS:** no `cant` events at all; spread damage is conflated, and it is the largest
single refusal bucket; everything before `|turn|1` is dropped, including a lead entry weather.

---

## THE HAZARD CLUSTER — A SINGLE-LAYER HAZARD STACKED TO THREE, AND TWO MOVES LAID NOTHING. 2026-08-10.

Four roster rows, two defects, one area. Both are **layer arithmetic and tag derivation**; neither is
in the hazard branch itself, which was correct throughout.

### A. THE LAYER COUNT WAS UNBOUNDED — FIVE MOVES, NOT THE FOUR THE ROSTER NAMED

`medicham2-browser.js` WIRE 41 incremented `_fsf.hz[hazard]` unconditionally. Measured on three real
clicks, before a byte moved:

| hazard | ours | Showdown | why |
|---|---|---|---|
| `spikes` | 3 | 3 | the CONTROL — already right |
| `toxicspikes` | 3 | **2** | **a fifth defect the roster had not named** |
| `stealthrock` | 3 | **1** | measured 2-vs-1 on a two-click re-lay |
| `stickyweb` | 3 | **1** | measured 2-vs-1 on a two-click re-lay |

**THE COMMENT OVER THAT LINE WAS A GUARD KEPT PAST ITS LIMITATION — the ninth instance this sprint.**
It read: *"Layers accumulate because Spikes stacks to three; Stealth Rock does not and re-laying it is
a wasted turn either way."* The first clause is right. The second is an argument about the **click**,
and the click is not what the differential compares — the **board** is, which is the entire reason for
having a differential. It is corrected in place at the line rather than deleted; the table above is now
written where the excuse was.

**THE CAP IS DERIVED, NOT LISTED.** `tag_dex.js` reads the authority's own condition: a side condition
with **no `onSideRestart` cannot be re-laid at all**, which is a cap of exactly one; one that has the
handler states its ceiling as a literal (`if (this.effectState.layers >= 3) return false`). Printed
over every move in the format before anything was wired — **spikes 3, toxicspikes 2, stealthrock 1,
stickyweb 1, four moves and no others.**

**THE FALLBACK IS LOUD, AND IT WAS SHOWN FIRING.** A `maxLayers` of null keeps the OLD uncapped
behaviour and counts it in `MEDFAILS.hazardCapUnknown`, because a guessed cap of 1 would silently
delete real Spikes layers — a worse bug than the one being fixed. Deleting `maxLayers` from
`stealthrock` in memory reproduces `{stealthrock:3}` **and** sets the counter to 3 with a first-cause
string. On the shipped tags it is **0**, so the zero is a claim and not a dead branch.

### B. AN ATTACKING MOVE THAT LAYS A HAZARD LAID NOTHING (ROADMAP #72)

`ceaselessedge` and `stoneaxe` read **Showdown 1 / ours 0**. Both declare `secondaries: [{}]` — an
**empty secondary object**, which exists only so Sheer Force can see one — and lay the layer from
`onAfterHit` **and** `onAfterSubDamage`. Neither declares a `sideCondition` anywhere, so every rule in
`tag_dex.js` keyed on `target === 'foeSide'` missed them and their tag rows held `contact` and
`moveClass` and nothing else.

**THIS WAS A TAG-DERIVATION GAP, NOT A HAZARD-CODE GAP.** The hazard branch works; nothing routed
these two moves to it. The engine side is four lines that consume a new tag.

**IT IS A SEPARATE TAG (`hazardOnHit`) FROM `hazard`, DELIBERATELY.** `playerAction`'s classifier
returns `kind:'hazard'` — a status turn with no damage — for anything carrying `hazard`. Stone Axe is a
65 BP physical Rock attack that *also* lays. Two shapes, two tags; a consumer that wants "does this lay
rocks" reads both. **The cap comes from the hazard that is LAID, not from the move that lays it** —
Ceaseless Edge stacks to 3 because Spikes does, Stone Axe stops at 1 because Stealth Rock does, through
the same `hazardCap()` the declared family uses, so the two can never disagree.

**WHICH FAILURES STOP IT IS READ, NOT REMEMBERED.** `onAfterSubDamage` exists precisely so the layer
still goes down when a **Substitute** ate the hit; a **miss** and a **Protect** stop it because neither
handler runs. The gate is `connected`, which this engine sets *above* the substitute's early return —
already the right predicate — plus `!m.fainted`, which is Showdown's own `source.hp` test. `_subAte` is
recorded beside it so the first member that declares only `onAfterHit` is not silently given the wrong
rule.

### THE PROBES — THREE, EACH WATCHED RED INDIVIDUALLY

| probe | red reading | green reading |
|---|---|---|
| `move / hazard` *a single-layer hazard stops at ONE layer while Spikes still stacks to three* | spikes 3, toxicspikes **3**, stealthrock **3**, stickyweb **3** | 3 / 2 / 1 / 1 |
| `move / hazardOnHit` *Stone Axe lays Stealth Rock, so the next body in is chipped* | control Stone Edge connected, switch-in lost 0; **Stone Axe connected, switch-in lost 0, 0 layers** | Stone Axe: switch-in lost **40**, 1 layer; control still 0 |
| `move / hazardOnHit` *Ceaseless Edge lays Spikes only when it connects — through a Sub, not through a Protect* | Protected 0, missed 0, **three hits 0**, **through a Sub 0** | Protected 0, missed 0, three hits **3**, through a Sub **1** |

The **stacking control** (Spikes to 3, Toxic Spikes to 2) and the **refusal control** (Protect and miss
lay nothing) sit inside the same probe calls as the claims, so a cap that flattens everything to one
layer, or a fix that lays at click time, fails the file rather than passing it.

### THE DIGEST SWEEP — 3,147,001 CELLS, 54 DIFFER, 0 THREW

Every move in `data/tags.json` (500), three rng seeds x two aims x **three click counts**, a trailing
turn so residuals land, digested as the whole board: every primitive on all four actives and both
benches, the field and both sides' conditions. BEFORE is the live file with exactly this pass's seven
edits reversed by anchor (each asserted to match once, and verified to reproduce the pre-fix
measurements); AFTER is the shipped bytes. Both compiled at the real medicham path.

**CLICK COUNT HAD TO BE AN AXIS.** At one click every hazard reads 1 layer in both arms, so a one-turn
sweep would have reported the cap fix as having no blast radius at all.

```
cells 3147001   DIFF cells 54   THREW before 0  after 0
MOVES THAT MOVED (5):
  ceaselessedge  (60 uses)   at x1,x2,x3   sfB.hz undefined -> {spikes:1|2|3}
  stoneaxe       (94 uses)   at x1,x2,x3   sfB.hz undefined -> {stealthrock:1}
  stealthrock   (160 uses)   at x2,x3      {stealthrock:2|3} -> {stealthrock:1}
  stickyweb      (38 uses)   at x2,x3      {stickyweb:2|3}   -> {stickyweb:1}
  toxicspikes    (36 uses)   at x3 only    {toxicspikes:3}   -> {toxicspikes:2}
```

**FIVE MOVED, NOT THE FOUR EXPECTED, AND THE FIFTH IS SAID RATHER THAN BURIED.** Toxic Spikes has the
identical defect and only shows at three clicks, which is why the roster never named it. **`spikes` did
not move at any click count** — the control held.

### `data/tags.json` AND `data/abra-tags.js` WERE REGENERATED — 0 REMOVED / 0 ADDED / 6 CHANGED

One new tag (`move|hazardOnHit`), and the six changed entities are exactly: `ceaselessedge` and
`stoneaxe` gaining it, and `spikes` / `toxicspikes` / `stealthrock` / `stickyweb` gaining `maxLayers` on
their existing `hazard` param. No entity gained or lost anything else. Tag coverage **189/200 -> 190/201
probed**, 11 unprobed unchanged.

**AND THE REGENERATION FOLDED IN A CORPUS UPDATE THAT IS NOT THIS CHANGE'S — SAID, NOT BURIED.**
`sheet_entries` rose because the store grew since the last `tag_dex` run, and that
moved the `uses` count on **265 moves, 98 items and 110 abilities**. Those are usage-only diffs with no
structural component and no consumer in the engine, but they are in the artifact and they arrived with
this commit rather than being caused by it.

**IT ALSO RETRO-INVALIDATED TWO FIGURES ALREADY QUOTED IN THIS FILE, AND THAT IS THE INTERESTING PART.**
`tests/test-docs-current.js` went red on `docs/MEDICHAM-SPRINT-NOTES.md`, a document that had **zero**
untraceable figures before this pass: Fake Out was quoted twice with a usage figure no artifact says
that any more. Both were restamped to the artifact value of the day, and have since been de-pinned entirely — a tagger-owned count does not belong in prose. Nobody mistyped anything
and no conclusion changed — the CORPUS moved under a number written down as prose, which is the same
shape as the fourteen stale handoffs. The prior `sheet_entries` value is deliberately not written here
for exactly that reason: it would be a third one.

**ROADMAP #65's "`data/tags.json` cannot be safely regenerated — five entities would silently drop out"
DID NOT REPRODUCE.** The diff was taken both ways over moves, items and abilities: zero removed, zero
added.

### THE COUNTER PROVES IT RAN

`MEDFAILS.hazardCapUnknown` is **0** over four clicks of each of the six moves, and **3** with
`maxLayers` deleted from one tag in memory — so the zero is evidence and not an unreached branch.

### DELIBERATELY NOT FIXED, AND STATED

- **A hazard laid AT ITS CAP does not emit a fail line.** Showdown's `Side#addSideCondition` returns
  false at the cap, which fails the whole move and writes `|-fail|`. This engine now correctly declines
  the layer and emits no `-sidestart`, but the click still resolves as a spent turn with no failure
  line. That is a PROTOCOL row, it touches `mvFail` and `_lastMove`, and it would move every hazard's
  third click rather than only the four rows in scope. Left for a protocol pass.
- **`hzBy` is now recorded by WIRE 68 (Toxic Debris) as well**, because `layHazard` takes a setter. It
  is read only for Sticky Web's `-1 Speed` source and no ability lays Sticky Web in this format, so
  nothing consumes it today. The sweep cannot see it — every body in the sweep has `ability: 'none'` —
  so it was checked separately: Toxic Debris caps at 2 and records its holder.

### GATES

`test-mechanics` **381 live / 381 probed / 0 missing / 0 threw / 0 hollow / 0 unarmed / 0 directCall**
(381, not 380, because a fourth probe landed from a concurrent agent while this ran; the three above
are green in the artifact). `test-damage-stages` **1728/1728 exact**. `test-medicham`,
`test-engine-consistency`, `test-dead-volatile`, `test-protocol-trace`, `test-battle-api`,
`test-charge`, `test-choice-lock`, `test-entry-effects`, `test-forced-switch`, `test-future-sight`,
`test-drop-guard`, `test-encore-gate`, `test-artifact-keys`, `test-volatile-duration`,
`test-medicham-coverage`, `test-wiring`, `test-effect-credit`, `test-game-diff`,
`test-mutation-coverage`, `test-engine-diff`, `test-feature-semantics` and `test-docs-current` all pass.

**NOT RUN, AND NAMED:** `tests/test-game-differential.js` requires `engine/game_differential.js`, which
**cuts a release at module load** unless `--release` is pinned — and a pinned release plays the
SNAPSHOT's bytes, so it cannot say anything about this change. Cutting was forbidden for this pass, so
the differential over these bytes is **owed**, not passed.

**ONE STATUS LINE IS RED AND IT IS NOT THIS CHANGE'S — SAID, NOT FILED.** `engine/status.js` prints
FEATURE SEMANTICS CHECK FAILED against `data/policy-weights.json` (koTarget, dmgFrac, killIsRoll,
killsThreat, switchSurvives1, switchKOSlow, switchDiesFirst, screenValue). That is the standing REFIT
OWED edge and it is MEASURE's. `tests/test-feature-semantics.js` itself is **16 passed, 0 failed**, and
the fixture board contains no hazard and neither hazard-laying move, so this pass cannot have moved a
damage or KO feature.

## ROADMAP #134 — THE INGEST NOW KEEPS SIX FACTS IT USED TO REACH AND DISCARD

Parser only. **`data/games.ladder.jsonl` was never opened for writing** and nothing is re-ingested, so
no existing number moves yet. Will named three of these from memory and was right on all three.

**Additive, and proved so rather than asserted:** 20,000 real stored games re-parsed from the raw
archive are **byte-identical to the store once the new fields are stripped — 20,000 of 20,000.**
`tests/test-parse.js` extended in place: **18 pass / 22 FAIL** against the shipped parser, **42 / 0**
against the new one. Six of the 18 that pass on both are new `LEGACY UNCHANGED` assertions pinning
`dmg = max(delta)`, `tgt`, `tgthp`, `ko` and `turns[0].n === 1` to exactly what 52,377 stored games
mean today — so a later pass that "improves" `dmg` goes red and says so.

Frequencies for all six — plus the two classes still unparsed — are measured over the whole raw
archive and written to **`data/raw-log-census.json`**, reproduced by a second independent pass
rather than restated here. The shape of it: `|cant|` is dominated by flinch and then sleep; chip
damage names its cause on most residual lines, Life Orb first; `-enditem` is dominated by Sitrus
and Focus Sash; and spread moves are common enough that conflating their targets is the single
largest refusal bucket in the replayer.

Pre-`|turn|1` is kept as a **top-level `preTurn: []`, deliberately not `turns[0]`** — a turn 0 would
change the array every consumer iterates. Verified on a 20,000-game round trip: all but a
handful gain a `preTurn` and **not one gains a turn 0**.

**Two shapes that would have bitten a naive parser**, both caught by the fixture: after a target
faints Showdown drops the slot letter (`|-hitcount|p1: Venusaur|2`, 4 of the first 8 in the archive);
and a resist berry emits **both `[eat]` and `[weaken]` for one consumption**, so anything counting
`-enditem` without reading `why` double-counts.

**MY GARCHOMP DIAGNOSIS WAS WRONG AND THE AGENT CORRECTED IT.** I traced a Garchomp falling asleep
with nothing on the turn that sleeps to a Yawn, and attributed the gap to the `[from]` clause. It is
**`|-start|`/`|-end|` volatiles, which are entirely unparsed** — **50,213 lines in 14,680 games** across the whole archive (I first quoted a
sampled figure off a subset; the census is the number). Yawn's `-start` lands a turn earlier and the `-status|slp` that
follows carries no `[from]` at all. That is the biggest remaining hole, bigger than three of the six
above, and it needs its own item and its own red-first test.

**Backfill is priced and NOT taken:** the store, the archive id count and the shortfall are all
in `data/raw-log-census.json` — **6,191 stored games have NO raw log**. `MODE=reparse` refuses
today, correctly, rather than deleting them — the sequence is `MODE=backfill` (network) then
that has aged out of the public pool**. Records grow by roughly a third. The immediate consumer is
`engine/replay_differential.js`, whose largest refusal bucket is its largest single refusal bucket caused
by the spread conflation alone.

**Consequence:** `data/click-censoring-census.json` stamps `durable-ingest.js` by content and is now
UNSAFE; re-run is `node engine/click_census.js`. It was already quarantined behind MEDICHAM.

## ROADMAP #135 — THE CORPUS HIDES THE FORMAT'S OWN INFORMATION, AND THAT IS WHY THE REPLAYER IS BLUNT

Will, 2026-08-10, in four questions: *"is the divergence from sps right?"*, *"is it megas?"*, *"we are
doing open team sheets so poison touch shouldnt be a surprise"*, *"no bo3 forces open team sheets
right?"*, *"we get nature too from open team sheets"*. Three of those closed a hypothesis and the
fourth opened the one that mattered.

**IT IS NOT SP.** The damage comparator already grants the engine every legal Champions spread before
it accuses anything — the median attainable interval is wider than the whole 16-roll band. SP is why
most rows read `ambiguous`; it is not why any row reads `no_match`. And the error runs the forgiving
way: each event is priced at its own corner, so one body can be max-offence attacking and max-bulk
defending on the same 66 points. Tying a body to one spread would raise divergence, not lower it.

**IT IS NOT MEGAS.** Measured against the right denominator, which the first attempt got wrong: a mega
is already on the field for 62.9% of turn-1 damage events, and megas appear in 48.9% of divergence
witnesses. Under-represented, factor 0.78. (The first comparison put a game-level rate beside an
event-level one and would have shown the opposite.)

**THE FORMAT DECLARES ALL OF IT AND OUR CORPUS DOES NOT CARRY IT.** No raw log in the archive announces
an Open Team Sheets rule — every one announces Species Clause and Item Clause and nothing else. The
sheet rides on `rated|Tournament battle`, and tournament battles are about one percent of the store.
Where a sheet exists it declares **species, item, ability, all four moves, nature, gender and level**;
only `evs` is null. So Will's Sneasler is not a surprise anywhere it matters — Poison Touch is written
down, and we substitute the modal observed ability instead.

**THE ARM, AND THE RESULT THAT REVERSED MY FRAMING.** `--sheets-only` replays only games that declare
BOTH sides, at the same frozen release as the published turn-1 run, so the population is the only
thing that changes — see `data/replay-differential-sheets.json`. I predicted divergence would FALL
because wrong guesses were being charged to the engine. It rose. That is the right way round and I had
it backwards: an unknown item or ability makes the attainable interval WIDER, so the uncertainty was
EXCUSING the engine rather than accusing it.

**AND THE CONTROL IS THE REAL FINDING.** `--blind-sheets` replays the identical games with the sheet
withheld, so information is the only variable. It **refuses to publish**: the plant that cuts a damage
figure to a QUARTER is caught with the sheet visible and goes UNNOTICED with it withheld. Without the
declared item and ability the legal interval swallows a fourfold error. The all-games run does catch
that plant, so blinding does not always destroy detection — it destroyed it on this host, which is
evidence of reduced power and not proof of none.

**Read the headline accordingly.** The all-games rate is a LOWER BOUND measured through a comparator
that, on the overwhelming majority of the corpus, cannot see a 4x damage error.

**Two instrument defects found on the way, both fixed here:**
- the species-swap plant cleared `g.sets` for the swapped body and not `g.sheets`, so on a sheet game
  the old body's nature was still declared for that slot while the plant's disjointness test assumed a
  neutral one;
- the host filter admitted boards whose turn-1 order was never SCORED. The order comparator refuses
  far more turns than it scores — spread moves, ability-modified priority, ties — and every refusal
  reads `order_differ === 0`, identical to agreement. The plant was being placed where the arm does not
  look and then reported as the instrument being blind. It was not blind; it was never asked.
- the refusal now NAMES the boards it was blind on. A refusal that reports only a count made two
  sessions re-derive the diagnosis from scratch, and I guessed wrong twice before looking.

---

## THE REACTION CLUSTER — AN ABILITY THAT READS AN EVENT AND DOES NOT ACT ON IT. WIRE 157, 2026-08-10.

Eight abilities, one family. WIRE 156 routed Fake Out's flinch through the shared secondary loop and
**Inner Focus started working for free** — because Inner Focus is a REFUSAL and the loop already asked
about refusals. Steadfast did not, because it is a REACTION: it takes the flinch and is paid for it.
Seven roster rows turned out to be the same shape one field over — an event this engine could see and
did not answer.

Census **381 → 390 live / 390 probed / 0 missing / 0 threw**. Every row below had its probe watched
RED first, individually, and the RED reading is printed beside the green one.

| ability | probe | red reading | green reading |
|---|---|---|---|
| `boostsOnFlinch` **Steadfast** | Iron Head at a Machamp, 2,000 seeded turns, `MEDSEEN.flinchTooLate` read as the receipt | flinched **404**, Speed raised **0** | flinched 404, Speed raised **404** — equal, so the boost is bound to the EVENT and not the click |
| `buffsHolderOnHit` **Electromorphosis** | Bellibolt's Thunderbolt on the two turns after it is struck | 72 then 72 | **142** then 72 — banked, then SPENT |
| `weatherResidualHP` **Ice Body** (+ Dry Skin, Rain Dish, Solar Power) | three turns of snow, then every sky | +0 | **+30** (3 x 1/16); Dry Skin **+19 in rain and −19 in sun** off one handler |
| `clearsAllyBoostsOnEntry` **Curious Medicine** | carrier walks in beside a partner on atk/def/spe stages | 2/−1/3 | **0/0/0**, foes and the carrier's own stages untouched |
| `damageBoost` **Reckless** | Brave Bird vs Drill Peck off the same Staraptor | 123 vs 123 | **147** vs 83 — x1.195 against the handler's 4915/4096 |
| `protectsAllyFromStatus` **Sweet Veil** (+ Pastel Veil, Flower Veil) | Hypnosis at the body BESIDE the carrier | `slp` | `-`; Toxic still `tox`, the foe still `slp` |
| `preventsStatDrop.reflects` **Mirror Armor** | Intimidate, Parting Shot and a secondary, read at the SOURCE | target 0, **source 0** | target 0, **source −1 / −1,−1 / −1** |
| `onSwitchInDrop.oncePerBattle` **Supersweet Syrup** | lead, leave, come back | −1 → −1 → **−2** | −1 → −1 → **−1**, while Intimidate on the same path still goes to −2 |

**THE ODD ONE OUT IS SUPERSWEET SYRUP AND IT IS A DIFFERENT DEFECT CLASS.** The other seven did
NOTHING; this one did its thing TWICE. `syrupTriggered` is set on the Pokemon (sim/pokemon.ts:263,
:482) and **is not reset by `clearVolatile()`** — checked line by line, because "it survives a switch"
is the entire claim. Only a staging that walks a body out and back can see it; every single-entry arm
reads correct in both engines. Intimidate is the control and it must still fire again, so the flag is
read per carrier off the artifact rather than applied to the tag.

**TWO FIXES WERE DELIBERATELY WIDER THAN THE ROSTER ROW, TO AVOID BUYING A NEW ONE-DIRECTIONAL ERROR.**
`onWeather` matches four abilities and **two of them LOSE HP**; a wire that read only Ice Body's heal
would have made Dry Skin strictly better than the real ability on every sun board. And Sweet Veil was
a typed name in the engine's self-immunity `slp` list, where it protected the holder *by accident* and
the partner not at all — the name is **removed**, and both halves now rest on the derived tag.

**THE TAG ARTIFACT MOVED AND THE DIFF IS PRINTED:** `data/tags.json` regenerated, **0 entities removed
/ 0 added / 68 changed**, of which only **9 changed their TAG SET** — `curiousmedicine`, `dryskin`,
`flowerveil`, `icebody`, `pastelveil`, `raindish`, `solarpower`, `steadfast`, `sweetveil`. The other 59
are param FIELDS added to entities whose behaviour is unchanged (`stage`, `reflects*`, `oncePerBattle`).
Every new derivation had its membership printed against the format dex before it was wired: `onFlinch`
**1**, `adjacentAllies()+clearBoosts()` **1**, `move.recoil||hasCrashDamage` **1**, `onTryBoost`
re-aiming at `source` **1**, `onWeather` **4**, `onAllySetStatus` **3**.

**DIGEST SWEEP, before bytes against after bytes** (baseline = the frozen pre-session release
`30b21c5a335a`, whose `tags.json` is byte-identical to the pre-change artifact — so no git and no new
cut): **46 differ and 0 THREW in either engine**, over six arms — **500** move arms, **2,660**
ability-x-click arms on the defender and **2,660** on the attacker, **1,064** weather arms, **266**
entry arms, and **2,660** more with the ability on the PARTNER. **0 of 500 moves** changed under
quiet abilities. Every difference is attributable by name: `electromorphosis` (a new volatile, so every
arm that carries it), `steadfast [fakeout]`, `reckless [bravebird]` only, `mirrorarmor [icywind,
partingshot]`, `sweetveil [spore,yawn]`, `pastelveil [toxic]`, `supersweetsyrup [partingshot, entry]`,
`curiousmedicine [entry]`, and the four `weatherResidualHP` carriers under their own skies.

**THE SWEEP WAS WRONG BEFORE THE ENGINE WAS, TWICE, AND BOTH ARE THE TRAPS THIS FAMILY LIVES IN.** Its
first board had Incineroar (80 Speed) attacking Corviknight (112), so **every flinch arrived at a body
that had already moved** — Steadfast swept clean while working, the identical staging that produced
the false Rock Slide report WIRE 156 had to retract. And `ironhead` is a 20% die that drew **zero**
flinches in three seeded turns, so `fakeout` (p=1, +3 priority) is in the click set. A third arm was
added because the veil family protects the body BESIDE it and a sweep that puts the ability on its own
target only ever tests the self half — which already worked.

**COUNTERS EXPORTED.** `MEDSEEN` and `MEDFAILS` reached neither `root` nor `module.exports`, so the
100+ receipts this engine keeps were unreadable from any test — which is how a Rock Slide report of
"0 of 600" was filed with `flinchTooLate` sitting at 571 and invisible. The Steadfast probe now
subtracts `MEDSEEN.flinchTooLate` across its own turns and asserts zero.

**TWO PROTOCOL LINES ARE NOT EMITTED AND ARE COUNTED, NOT PAPERED OVER:** `|-clearboost|` (Curious
Medicine) and `|-block|` (the veil family). Neither event is in `TRACE_EVENTS`, and
`tests/test-protocol-trace.js` PART 1 asserts every event this engine CLAIMS actually fires in a real
game — a three-use ability on a body with no MC row never would. `MEDFAILS.clearBoostUnannounced` and
`MEDFAILS.blockLineUnannounced` carry the shortfall.

**WHAT THE SURVEY FOUND AND THIS WIRE DID NOT CLOSE.** Asked over the whole format dex: `onFlinch`
matches exactly one ability, so the flinch family is now complete, and there is no "react to any
volatile" hook in this format at all — the `onTryAddVolatile` family is entirely REFUSALS and is
covered. Four reaction abilities with real usage remain **untagged and unwired**, each the same shape
as Steadfast and none with a failing probe yet: **Synchronize** (135 uses, `onAfterSetStatus` — it
sends the status back at its source), **Pickpocket** (95, `onAfterMoveSecondary`), **Aroma Veil** (60,
the ally-side Taunt/Encore/Disable refusal — the one member of the veil family this wire does not
serve), **Berserk** (44, `onAfterMoveSecondary`).

**Verified:** census 390/390/0 missing/0 threw; `test-damage-stages` **1728/1728 exact**;
`test-engine-diff --n 20000` **20000 compared, 0 disagreed**; `test-engine-consistency`,
`test-volatile-duration`, `test-protocol-trace`, `test-game-diff`, `test-wiring`,
`test-medicham-coverage` (ratchet held), `test-mutation-coverage`, `test-docs-current`, `test-parse`
and `artifact_audit` all green.

**RED AND NOT MINE, REPORTED RATHER THAN FILED:** `engine/conformance.js` (10 findings, every one
naming `engine/replay_differential.js` or its artifacts) and `engine/selftest.js` (5 raw-store readers
undeclared). Both are pre-existing — `medicham2-browser.js`'s single `games.ladder.jsonl` mention is a
COMMENT at line 1651 and is byte-identical in the pre-session release — and `replay_differential.js`
is another agent's live file, which this division was instructed not to touch.

## ROADMAP #136 — THE USAGE SHELF, AND THE NUMBER IT NEARLY GOT WRONG

Will, 2026-08-10: *"if no one clicks them we can just put them on the to do list at some point but not
holding back medicham from functioning"*, then on Block — *"block is almost never clicked so we can
quarantine it right"*. Correct on both counts, and the implementation nearly went wrong twice.

**IT MUST BE A RULE.** The named `DEFERRED` map suits a judgement about one entity. A shelf of a dozen
rare moves has to be a threshold, or it becomes the hand-kept exception list this project has already
paid for once with the ban list of four.

**AND IT MUST READ THE RIGHT NUMBER, WHICH IS NOT THE ONE THAT WAS TO HAND.** `tags.json.uses`
undercounts the store badly on exactly these rows — Toxic 1,132 there against 3,640 real clicks,
Terrain Pulse 9 against 77, Copycat 10 against 78. Thresholding on it would have shelved eleven moves
clicked between 16 and 78 times. That is ROADMAP #70 arriving at a live decision rather than a
document, and it is why `engine/click_counts.js` now exists: one authoritative click count, taken from
the store, which is the only thing that actually knows.

**THE SHELF SITS AT THE CHOKE POINT, AND THE FIRST VERSION DID NOT.** Placed inside the
board-comparison path it never saw the trapping rows, which are decided by their own function and
return early — so Block, the row Will named, went on holding the gate at 3 clicks while twelve quieter
moves were shelved. It now runs on every verdict as it leaves `runEntry`, so no path can bypass it and
no path added later can either.

A shelved row keeps its scenario, is staged, is played against the authority every run, and prints its
click count and its underlying verdict. It stops holding the gate and stops nothing else. A row that
would PASS is never shelved. A missing artifact means CANNOT DEFER, never zero clicks.

**Moves only.** The store records that a move was clicked; it does not record which ability a body
carried unless the game had an open sheet. There is no honest store-derived usage for an ability, so
none is invented and no ability row is shelved this way — and none needed to be, because the abilities
clause went clean on its own.

**Where the gate stands:** three clauses of four now PASS. The moves clause is down from 29 blocking
rows to 11, and every one of the 11 is genuinely used — the largest is Toxic, whose second application
must fail and does not.

## ROADMAP #137 — THE STORE NEVER RECORDED A MEGA AS A BODY, SO NO RANKING COULD EVER SEE ONE

Will, 2026-08-10: *"megas need to be the number one priority wtf"*, then *"how tf did we get this far
without this coming up"*. The second question has a measured answer, and it is the more useful one.

```
stored games                 52,377
mega EVENTS recorded         83,810   (93.3% of games)
mega forme named in brought[]     0   of 387,491 bodies
mega forme named in lead[]        0
```

The store records THAT a mega happened and never records the mega as a body. `brought` and `lead`
name only the base species. Every usage figure in this project is derived from those fields, and every
ranking is derived from those figures — the coverage bar, what gets wired next, what the roster stages
first, which tags are worth a probe. **A mega forme therefore counts as zero and cannot rank above
anything, however broken it is.** Mega Floette was caught (#64, #66) because somebody looked at it, not
because anything surfaced it. This is the project's signature failure once more: a whole layer absent,
every instrument green.

`engine/mega_census.js` derives it from the store — the events already carry forme, base and slot, so
there is no re-pull, no re-parse, and the 6,191 games whose raw log has aged out are covered like the
rest. It does NOT write into `brought`/`lead`: those mean "what came to preview", which is the base
species and is correct; a mega is a mid-battle forme change, not a team slot. Rewriting them would make
the store lie about preview to fix a problem in analysis.

**Two findings fall straight out of the first run, in `data/mega-usage.json`:**
- **A mega is not a turn-1 default.** Turn-1 megas and later megas are the same order of magnitude,
  which is the mega-must-be-a-strategic-decision item on the roadmap, with evidence under it
  at last.
  count is printed rather than rounded away. Illusion mis-attribution (#67) is a hypothesis and is not
  asserted.

**MY OWN AUDIT WAS WRONG TWICE FIRST, AND WILL CAUGHT BOTH.** I reported 18 mega formes absent from
`engine-data.js` and 5 with empty movesets. Filtered for legality — which is a field on the species and
which I did not read — the true figures are **76 legal mega formes, 0 absent, 1 empty moveset**
(Floette-Mega, already #66). Every other name on both lists is `Past`, `Future` or `CAP`. This is the
rule at the top of the umbrella CLAUDE.md, broken in the ordinary way: the ban is a MECHANISM to be
asked, and I eyeballed a dex listing instead. A third error preceded them — `/mega/i` matched
**Meganium** and **Yanmega** — and a fourth, a typo'd species key that Showdown fuzzy-resolved to
another body, produced a false "Mega Gengar has no ability".

**What survives, verified:** 14 abilities are reachable only on a LEGAL mega forme and the roster can
stage none of them, because staging an ability means writing it onto a body and mega-evolving
overwrites what was just written. Among them **Shadow Tag** (Gengar-Mega, in 4.2% of games),
**Parental Bond** (Kangaskhan-Mega), **Fairy Aura** (Floette-Mega), **Aerilate** (Pinsir-Mega),
**Electric Surge** (Raichu-Mega-X) and **Filter** (Aggron-Mega).

### #137 CORRECTED, WITHIN THE HOUR — `t:"mega"` IS EVERY FORME CHANGE, NOT MEGA EVOLUTION

The row above reported an anomaly it could not explain: sides showing two distinct mega formes, when
the regulation allows one per side per battle. Will, 2026-08-10: *"sometimes u do bring two mons with
mega stones, but obviously only one can evolve per game per side"* — which removes the innocent reading
and makes it either a real violation or our own defect. It is ours.

**The store labels EVERY forme change `t:"mega"`.** The witnesses name themselves:
`mimikyu -> mimikyubusted` (Disguise), `aegislash -> aegislashblade` (Stance Change),
`palafin -> palafinhero` (Zero to Hero), `castform -> castformsnowy` (Forecast),
`morpeko -> morpekohangry`, and `aegislashblade -> aegislash` — a forme change in the opposite
direction. **2,899 of 83,810 events, 3.5%.**

`engine/mega_census.js` now asks the FORMAT which formes are megas instead of trusting the label, and
keeps the non-mega changes in their own bucket rather than dropping them — Stance Change, Zero to Hero
and Disguise are real mechanics and nothing else in this repository counts them.

| | first run | corrected |
|---|---|---|
| games containing a mega | 93.3% | **93.04%** |
| distinct mega formes | 88 | **78** |
| mega on turn 1 / later | each about a thousand higher | **38,842 / 42,069** |
| sides showing two formes | 1,649 | **0** |

The forme table's leaders are unchanged — those were genuine megas — and the conclusion the row was
written for survives: the store still records no mega in `brought[]` or `lead[]`, so every ranking in
this project still counted every mega forme as zero until today, and a mega is still not a turn-1
default.

**This is the third artifact-level error of the day and the first one nothing external caught.** The
sequence that found it was the right one and is worth keeping: an anomaly was PRINTED rather than
rounded away, the hypotheses were separated by a script rather than picked by intuition, and the
witnesses named the cause in one run. Two of my earlier diagnoses today were guesses and both were
wrong. Filed as the ingest-side item: the extractor should not call a Disguise break a mega, and
`t:"mega"` wants splitting into mega-evolution and forme-change at the parser.

## ROADMAP #140 — A FIFTH GATE CLAUSE: A USED MECHANIC THAT NOTHING MEASURES

Will, 2026-08-10, on the defects the gate was ignoring: *"those things need to block the gate man
(except for the under 25 clicks)"*. Correct, and for the reason the file already gives one level up: a
gate that passes while something is known to be unmeasured is a preference, not a bar.

**THE OBVIOUS CLAUSE WAS WRONG, AND IT WAS PRICED BEFORE IT WAS WIRED.** "COULD-NOT-STAGE stops being
a free pass" fails 42 moves above the shelf — including **Rage Powder at 9,626 clicks, Wide Guard and Follow Me**. Every one of those IS measured, by the mechanics census, which probes
the TAG. COULD-NOT-STAGE describes one harness's fixture, not the mechanic. That clause would have
cried wolf on the three busiest moves in the format on its first run, and a gate nobody believes is
the "one of the two known failures" failure arriving by a new road.

**So the clause asks the only question that matters: does ANY instrument measure this?** The roster
staged it, or the census probes every tag it carries. EVERY tag, not some — a move carrying
`priority, noExtraHit` whose `priority` is probed is not covered, and "some tag probed" would mark
every priority move green and be a formality.

Untagged counts as covered by nothing. An entity the tagger never described cannot be tested by
anything downstream of it, and saying so is the honest verdict rather than a pass.

The usage shelf applies at Will's explicit exception, from the same artifact as the roster's own shelf
so the two cannot drift.

**Measured the day it was wired:**

| | |
|---|---|
| moves above the shelf | 410 |
| covered by some instrument | 402 |
| **covered by nothing** | **8** |
| tags at fault | `noExtraHit`, `sharesHP`, `callsAnotherMove`, `survivesAnyHit` |

`noExtraHit` alone accounts for four of the eight — Phantom Force, Fly, Dig, Future Sight. So the whole
clause is four probes, not eight fixtures.

**The gate is now five clauses and the selftest is 20/20.** It also fails harder than before, which is
the direction asked for: three of the eight uncovered moves are already among the blocking eleven, so
the two clauses agree rather than double-counting.

## ROADMAP #142 — THE REPLAYER STOPS SCORING TURNS DOWNSTREAM OF A PHAZE

Will, 2026-08-10: *"I MEAN ROAR IS RANDOM IT DOESNT REALLY MATTER WHAT IT DRAGS IN"*. Correct, and the
roster's forced-switch arm is right to ask only whether the body LEFT — which replacement arrives is a
coin the two engines flip independently, and aligning it would be aligning a die rather than testing a
mechanic. The turn-order comparator already refuses a genuine speed tie for the same reason.

**But the judgement does not survive being carried into an ALL-TURNS replay.** If the record's Roar
drew Corviknight and ours draws Venusaur, every later turn of that game compares two different boards,
and this instrument would charge each one to the engine.

**Measured before the code was written**, so the cost is stated rather than assumed: **about one game in a hundred carries a phaze, and just under one percent of all stored turns
fall after one**. Small against the
corpus and NOT small against the finding — the all-turns arm reports on the order of eight thousand
later-turn divergences, so this was potentially a large minority of them.

The game is refused from the phaze onward rather than dropped whole: everything up to and including
that turn was compared against a board both engines agreed on, and discarding it would lose real
evidence to guard against a later coin. `--phaze-through` restores the old behaviour so the cost of the
refusal can be measured rather than argued about. `--turn1-only` is immune by construction.

The phaze set is read from the FORMAT and never from a hand list. A format that fails to load
classifies nothing and the refusal never fires, rather than firing blind.

**The generalisation worth keeping:** an owner judgement about one instrument does not automatically
hold in another. "The draw does not matter" is true of the roster's one-turn question and false of a
multi-turn replay, and writing the narrow version down is what stops the broad version being quoted
out of its scope later. This repository has a specific history of exactly that.

## THE GATE IS OPEN — ALL FIVE CLAUSES PASS

```
PASS  game differential      0 of 20,000 comparisons disagree with Showdown
PASS  roster / items         139 tested, clean
PASS  roster / abilities      94 tested, clean
PASS  roster / moves         427 tested, clean
PASS  coverage               every used move is measured by some instrument
```

Zero FIRED-AND-BOARDS-DIFFER anywhere in the roster. The census reached 408 live / 408 probed / 0
missing. The quarantine is lifted and the withheld artifacts may be quoted again — after they are
re-run, which is not optional: a quarantined number does not become true when the engine becomes
correct, it becomes re-runnable.

**Three rows are shelved by the owner, and the shelf is visible rather than silent.** Copycat is the
last of them — Will: *"PUT COPYCAT INTO THE QUARANTINE IM NOT TOUCHING THAT"*. Its mechanism is wired
and green; the row fails on a SEPARATE rule it merely reveals (Showdown refuses `addVolatile` for a
volatile already present with no `onRestart`, and a failed move never becomes `lastMove`). Fixing that
is its own batch, because a blanket rule breaks Protect, Follow Me, Rage Powder and Helping Hand, all
of which must be re-settable.

## AND THE THING THE GATE DOES NOT SAY

**REPLAY TESTING IS CAPPED BY CONSTRUCTION, AND THE BO3 RUN PROVED IT IN ONE NUMBER.** Will:
*"BUT WE DONT KNOW SPS IN BO3 SO ITS STILL IMPOSSIBLE"*, then *"WE HAVE TO CREATE THE GAMES OURSELVES
AND TEST IT ON SHOWDOWN"*.

The bo3 store is the open-sheet ladder — a separate Showdown format running in parallel over the same
window, where nearly every game declares both teams. Replayed at turn 1 with item, ability, moves and
nature all known on both sides:

| | |
|---|---|
| exact-roll `matched` | **0 of 22,313** |
| `ambiguous` | 10,228 |

**Not one damage comparison resolves to a roll.** Champions sheets do not declare SP, and the legal-SP
envelope alone is wider than the whole 16-roll band. No quantity of sheet data closes that; the
instrument's resolution is bounded by what the record can never say.

So the replay differential answers "does the engine contradict reality" and can never answer "is the
engine exact". The instrument that can is the one that BUILDS the game — we choose the spreads, so
nothing is unknown — and it is already the gate's first clause, clean at 20,000 comparisons.

Its own limit is COVERAGE, not resolution: it plays teams a bot would bring, so it exercises only the
moves a bot clicks. Building teams from the MECHANIC LIST rather than from realistic sets would cover
the rare rows the strong way — against real Showdown games instead of staged single turns — and is the
natural next instrument.

**A store was missed for most of this sprint and it is worth recording.** Every usage figure taken
before this row read `games.ladder.jsonl` alone, while `games.bo3.jsonl` had been ingesting in parallel
since 2026-07-23 at roughly 640 games a day. `engine/click_counts.js` now reads both. The blast radius
on the gate was one row (Mean Look, 20 clicks becoming 25), and that row had already been fixed on its
merits — luck, not design. The mega census and the raw-log census still read one store and are owed a
re-run.

## ROADMAP #143 — THE SCENARIO CATALOGUE, AND THE TWO THINGS WILL ADDED THAT MAKE IT WORK

Will: *"START DEVISING TESTS AND SCENARIOS FOR EACH MECHANIC (ITEM, ABILITY, MOVE, MON) IN THE GAME
THAT WE CAN RUN"*.

**ONE SHAPE PER TAG, NOT PER ENTITY.** 500 moves, 272 abilities and 148 items — 920 entities — carry
217 distinct tags between them. Entities sharing a tag share a test, so 217 shapes cover all 920 and an
entity added tomorrow inherits its shape without anyone editing anything. Plus 357 legal species as one
`structural` shape that needs no battle at all — just a comparison against the format, which is the
cheapest coverage in the catalogue and is exactly where a mainline-versus-Champions error would hide.

`engine/scenario_catalogue.js` derives it from `data/tags.json` and the format. Ten archetypes, and the
archetype decides which INSTRUMENT can ask the question — `chance` tags are marked precisely so nobody
builds a one-board test for a coin.

### Will's first addition: what the subject must be FACING

> *"IE WIDE GUARD NEEDS A SPREAD MOVE AGAINST IT, ITS POINTLESS TO TEST IF IT DOESNT FACE THAT"*

This is a different field from the precondition and the catalogue was missing it. A PRECONDITION is
about the subject's own state — Blaze needs the holder under a third. **`faces` is about the
ADVERSARY'S ACTION**, and omitting it produces a green that proves nothing:

| shape | vacuous without | 
|---|---|
| Wide Guard | a SPREAD move aimed at the side |
| Rage Powder | a single-target move aimed at the ALLY |
| Counter | a physical hit taken before it moves |
| a trap | somebody actually trying to leave |
| Filter | a super-effective hit |

Every one of those passes by doing nothing. It is "A CLICK IS NOT A TEST" one level up — the click
happened, the CONDITION did not — and on inspection it is why so much of the roster reports
COULD-NOT-STAGE: the harness did not know what the subject had to be facing.

**And the rule chain bit me immediately.** `piercesProtect` matched the generic `/protect/` rule before
its own, so the shape that BYPASSES a guard was told to face a move it could block. Specific before
general; fixed on the first run.

### Will's second addition: a PROPERTY is tested through its REACTOR

> *"HAVE CONTACT HIT ROUGH SKIN TO CHECK"*

`contact` is a flag, not a behaviour. Nothing observable happens because a move made contact unless
something READS the flag. So the shape is: click the flagged move into a body carrying the reactor, and
control with a body without it. Derived from the format, every property flag has one:

| flag | moves | reactor |
|---|---|---|
| contact | 166 | Rough Skin, Effect Spore, Aftermath, Cute Charm |
| sound | 24 | Soundproof |
| bullet | 17 | Bulletproof |
| slicing | 21 | Sharpness |
| punch | 15 | Iron Fist |
| powder | 7 | Overcoat |

Two honest gaps found the same way: **`wind` has three reactors and ZERO legal carriers** in this
regulation — a fact about the format, not a hole — and **`reflectable` has no ability reactor at all**,
because it is tested by the move BOUNCING rather than by anything reacting to it.

### And the retraction Will forced

> *"DYM A TYPE CANNOT BE A REACTOR? ALL TYPES HAVE A SORTA ABILITY, DARK IMMUNE TO PRANKSTER, GRASS TO
> POWDER MOVES, GHOSTS CANNOT BE TRAPPED, ETC."*

ROADMAP #20 said a type cannot be a reactor and therefore Grass-blocks-powder was untestable. That is a
statement about our harness, not about the game. Asked of a live battle: **Fire refuses burn, Steel
refuses poison, Electric refuses paralysis, Ice refuses freeze**, the type chart carries seven more,
Prankster names Dark in its own text, the `trapped` volatile refuses Ghost, and powder is gated in the
battle rules.

**It looked impossible because type reactions live in FIVE different places** and only one of them
resembles a reactor if you are searching for an ability slot. The fix is that the harness's reactor may
be a TYPE — which is CHEAPER than an ability reactor, not harder: there is nothing to swap, you pick a
body of that type and the control is a body that is not. It unblocks the ~400 pairs the interaction
matrix drops.

## ROADMAP #145 — THE GROUNDED AXIS: ONE PREDICATE, SEVEN READERS, SIX MISSING INPUTS

Will, walking the type-reaction surface: *"FLYING IMMUNE TO GROUND HAZARDS, GROUND BASED THINGS LIEK
TERRAIN"*, then *"ROOST MAKES A MON GROUNDED, SAME WITH SMACK DOWN"*, then *"ROOST ALSO CAUSES THE MON
TO LOSE FLYING TYPE FOR THE TURN"*.

**Grounded-ness is not a property of a type. It is a mutable per-turn state**, and our engine treats it
as almost static.

```
isGrounded() consults        does NOT consult
  Iron Ball                    Levitate      <- an ordinary ability, needs no setup at all
  Air Balloon                  Roost            2,808 clicks
  Flying type                  Gravity            585
                               Smack Down          59
                               Magnet Rise          8
                               Ingrain              5
```

**Seven mechanics read that one predicate** — Spikes, Toxic Spikes, Sticky Web and all four terrains.
Stealth Rock is the deliberate exception and hits everything. So one wrong predicate is wrong seven
ways simultaneously, and **Levitate is wrong on turn 1 of every game containing a Levitate body**, with
no move needing to have been clicked.

**And Roost has no mechanism at all.** The format says *"Flying-type removed 'til turn ends"*; our
simulator has no temporary-type concept — no `removeType`, no override. A Roosting Corviknight eats a
full Earthquake here and takes zero in the real game, and for that turn its whole type chart is
different, so Rock, Ice and Electric all misprice too. Smack Down is the mirror and is equally absent.

**Toxic Spikes carries a SECOND type reaction on top:** Poison types do not merely ignore it, they
absorb it off the field.

## AND WILL'S STUN SPORE QUESTION, WHICH IS THE BEST TEST CASE OF THE NIGHT

> *"SO ELECTRIC TYPES CANNOT BE STUN SPORED?"*

Correct, and it is TWO INDEPENDENT IMMUNITIES STACKED. Stun Spore carries `status: par` AND
`flags.powder`. A Grass type refuses it as POWDER, before the move resolves. An Electric type refuses
it as PARALYSIS, at status application. Measured on a live battle: Heliolisk (Electric/Normal, not
Grass) returns `runStatusImmunity('par') === false` — immune, with powder playing no part.

That makes it the sharpest single fixture available: **a Grass/Electric body refuses it twice over, so
an engine missing exactly one gate still passes.** Any test that only checks one of them is measuring
the wrong thing and will report green on a half-broken engine.

## THE PART WORTH RECORDING ABOUT THE GATE

None of this is visible to the MEDICHAM gate. The roster stages a move and compares OUR TWO ENGINES;
both compute grounded-ness the same wrong way, agree perfectly, and the row passes.

That is the THIRD defect class tonight the gate structurally cannot see, after the mainline constants
in `move-effects.js` and the mega movesets. All three share one shape: **a shared wrong input produces
perfect agreement.** Only a comparison against the AUTHORITY can see them, which is the argument for
the constructed-game differential and against reading OPEN as "the engine is right".

## ROADMAP #146 — A SIXTH GATE CLAUSE: NO OPEN, KNOWN, UNFIXED ENGINE DEFECT

Will, on seeing the gate report OPEN beside the register: *"THE GATE SHOULDNT BE OPEN, SO MANY OF THESE
ITEMS ARE DISQUALIFYING FOR THE ENGINE TO WORK."* Right, and the GATE was wrong rather than the items.

**WHAT THE FIRST FIVE CLAUSES ACTUALLY ASK.** The differential asks whether Showdown disagreed about
what the bots HAPPENED TO CLICK. The three roster clauses ask whether OUR TWO ENGINES agree. The
coverage clause asks whether SOMETHING measured it. **Not one asks whether we already KNOW a mechanic
is broken** — and we did know, in writing, in the register the gate never read.

Struggle unimplemented. PP absent. Thirty-two moves resolving to a whole no-op turn. The Choice lock not arming on a status move. Quick Guard the only priority refusal that does not work.
Any one is disqualifying, and the gate said OPEN over all of them.

**This is "KNOWN FAILURE IS A BANNED PHRASE" one level up.** That rule stops a RED TEST being filed as
a status. This stops a KNOWN DEFECT being filed as a roadmap row while the gate calls the engine
correct. Same failure, different register, same fix: the gate is READ, not remembered.

**AND THE FIRST VERSION OF THE CLAUSE OVER-FIRED, WHICH IS WORTH RECORDING BECAUSE IT IS THE SAME
DISEASE.** It counted any row filed to `docs/ENGINE.md` and reported SIXTEEN. Four were not defects at
all — including *"hand MEDICHAM to Fable 5 and make it faster"* — and three had been finished that same
night. **A bar that cries wolf is precisely how "one of the two known failures" begins.** The test is
now the row's own CLAIM: it counts when it says a mechanic does not work, is absent, is unimplemented,
never fires, or resolves to nothing. A task, an investigation or a measurement is not a defect however
it is filed. It still errs SHUT on ambiguous wording, which is the correct direction for a bar.

**The honest count is SEVEN registered defects** — #117 `_lastMove`/Encore, #118 the Choice lock,
#119 Struggle, #123 semi-invulnerability, #125 the thirty-two no-op moves, #126 Quick Guard, #128 the
berry-ability family — **plus four found tonight and not yet registered**: PP absent, `isGrounded`
missing six inputs, Roost's temporary type removal absent, and the mainline constants in
`data/move-effects.js`.

Eleven concrete defects. Not the fifty-one-row roadmap: most of that register is design, measurement
and search work, none of which blocks the engine being right.

---

## THE CONSTRUCTED-GAME DIVERGENCE LIST — 148 ROWS, AND THEY COLLAPSE INTO A HANDFUL. 2026-08-10.

Will: *"OKAY MAKE A LIST OF EVERYTHING THAT DIFFERED OR WHAT WE NEED TO ADD AND LETS GET ON IT."*

`engine/all_mechanics_fire.js` built teams so every mechanic fires inside a REAL Showdown game and
compared turn by turn. **484 of 500 moves resolved; 148 rows diverged across 100 stated causes.** The
causes are the SYMPTOM the comparator saw, not the defect, and grouping by symptom was my first error.

**THE DIE IS PINNED IDENTICALLY ON BOTH SIDES**, so none of this is RNG noise and all of it is
evidence. `all_mechanics_fire.js` has no RNG of its own; it delegates to `game_differential.js`, which
installs `pinRandom`/`pinShuffle` over both engines (`:451`, `:467`), with `random(m, n)` pinned to `m`.
Will asked the right question — *"ARE THE NUMBER OF HITS STANDARDIZED"* — and the answer decides
whether half these rows mean anything. They do.

### THE ERROR WORTH RECORDING: I GROUPED BY SYMPTOM AND NAMED THE CLASS WRONG

I reported the eleven rows as "the multi-hit family", with a click total I had summed myself, over a
class whose comparator label was `-damage field 3` — meaning only *a damage number differs*. (The
total is deliberately not restated here: it was an invented aggregate over a wrongly-drawn class, and
repeating it would give a discarded figure a second life. `data/all-mechanics-fire.json` carries the
rows.) Will: **"IRON HEAD IS NOT MULTI HIT"**, then
**"MOST OF THOSE ARE NOT MULTI HIT"**. Correct. Read the CARRIER column instead and the class is:

    doublehit  flashcannon  gyroball  headsmash                   -- all on AEGISLASH
    ironhead   reversal     sacredsword  steelbeam                -- all on AEGISLASH
    beatup (annihilape)   populationbomb (maushold)   tripleaxel (empoleon)

**EIGHT OF ELEVEN ARE ONE POKEMON.** `stancechange` appears **zero** times in
`engine/medicham2-browser.js` and has **no row** in `data/tags.json`, while
`Dex.forFormat('gen9championsvgc2026regmb').abilities.get('stancechange')` returns `exists: true,
isNonstandard: null` — legal in this format, and absent from our engine.

Aegislash-Shield is 50 Atk / 140 Def / 50 SpA / 140 SpD; Blade is 150 / 50 / 150 / 50. An attacking
move flips Shield to Blade BEFORE damage, King's Shield flips it back. We never flip, so **every
Aegislash attack computes at one third of the correct attack stat.** The observed ratios confirm it —
Showdown dealt 45 where we dealt 21 (Iron Head), 114 vs 51 (Head Smash), 53 vs 23 (Flash Cannon): all
about 2.2-2.4x, which is what a 3x attack stat gives once the damage formula's `+2` is included.

**The lesson is the same one this file records three times already**: a comparator's label names what
it SAW, and a class named from it will be named after the wrong thing. Group by carrier, or by the
shared input, never by the diff string.

### THE SECOND ERROR: I HAD BELCH / LAST RESORT / UPPER HAND BACKWARDS

I briefed an agent that "we `-fail` where Showdown crits". The artifact says the reverse:

    showdown: |-fail|p1a: Arbok          medicham: |-crit|p2a: Feraligatr

**SHOWDOWN REFUSES THE MOVE AND WE EXECUTE IT.** All three carry an `onTry` in the format's dex — Belch
needs a berry EATEN, Last Resort needs every other move used, Upper Hand needs the target about to use
a damaging priority move. We enforce none of them, which hands the search three moves that cannot
legally be clicked. 2,002 clicks. Ties to ROADMAP #60.

### THE MULTI-HIT ROWS ARE AN EVENT-SHAPE BUG, NOT A HIT-COUNT BUG

`bonerush bulletseed dualwingbeat iciclespear pinmissile rockblast scaleshot tailslap twinbeam
watershuriken`, filed as "event missing from medicham2". In every one, our total is **exactly 2x
Showdown's first `-damage`**. Under a pin of `m` both engines hit TWICE; the count agrees. **Showdown
emits one `-damage` PER HIT and we emit a single aggregated line.**

Not cosmetic: Focus Sash, Sturdy, Substitute break, Rough Skin and Loaded Dice all resolve per hit, and
an aggregate hit gets every one of them wrong. **This is NOT a regression of ROADMAP #103** (the count
was once the MEAN) and must not be reported as one. Whether FREE, unpinned play samples 2/3/4/5 at
35/35/15/15 is a separate question worth its own measurement, because rollouts run unpinned.

**POPULATION BOMB IS A DIFFERENT BUG IN THE SAME FAMILY.** Showdown dealt 15, we dealt 150 — exactly
10x. It is 10 hits at 90% accuracy **rechecked on every hit**; Showdown landed one and stopped, we
landed all ten. **We do not re-roll accuracy per hit.**

### BEAT UP — WILL CAUGHT THE PARTY SIZE, AND I HAD BRIEFED IT AMBIGUOUSLY

Will: **"I THINK BEAT UP ONLY TAKES THE 3 OTHER MONS YOU BRING TO BATTLE NOT THE 5 ON YOUR TEAM TOTAL
IN VGC."** Right, and decisive in the source — `sim/battle.ts:2747`:

    case 'team':
      if (action.index === 0) { action.pokemon.side.pokemon = []; }   // wipes the six
      action.pokemon.side.pokemon.push(action.pokemon);

The `team` action EMPTIES `side.pokemon` and rebuilds it from the picked positions
(`side.ts:1068`, `positions = result.slice(0, pickedTeamSize)`). Beat Up filters that array, so after
team preview it holds exactly the four brought. **Beat Up is 1-4 hits in VGC, never 5 or 6.**

Three more, each read from the format rather than a wiki:

- `onModifyMove`: `move.allies = side.pokemon.filter(a => a === pokemon || (!a.fainted && !a.status))`.
  **The user ALWAYS participates even when statused** — `a === pokemon ||` short-circuits the status
  test — while a statused TEAMMATE is skipped. A uniform rule is wrong.
- **Base power uses the ALLY's BASE Attack; the attack STAT in the formula is the USER's.**
  `data/moves.ts:1154` returns `5 + floor(setSpecies.baseStats.atk/10)` per hit, but the move is
  executed by the user, so the user's current Attack, boosts, STAB and items apply and teammates' items
  do not. **A weak teammate adds a HIT, not weak damage.**
- **Beat Up has no `contact` flag** — `{protect:1, mirror:1, allyanim:1, metronome:1}`. No contact
  reactor fires.

And **do not take PP from a fan wiki**: pokemondb lists Beat Up at 10 (max 16), which is mainline.
Champions is `floor(10 * 0.8) + 4 = 12`.

### THE REMAINING CLASSES, EXPLAINED RATHER THAN LISTED

| Rows | Clicks | What is actually wrong |
|---|---|---|
| 11 | 4,875 | **Fixed-damage and OHKO moves emit `-crit` and cannot.** `seismictoss nightshade counter mirrorcoat comeuppance endeavor finalgambit fissure guillotine horndrill`. One predicate — ask whether damage is COMPUTED before rolling a crit — keyed off the tag, not a name list. |
| 4 | 339 | **Self-KO faint order.** `sim/battle-actions.ts:499` calls `this.battle.faint(pokemon, pokemon, move)` ABOVE `trySpreadMoveHit`, and `faint()` zeroes HP directly — so Showdown emits a bare faint line with **no `-damage` line at all**, and the user is already gone when the targets take damage. We emit a `-damage 0 fnt` instead, later. `explosion selfdestruct mistyexplosion memento`. |
| 5 | 33 | **Endure emits `-start`, Showdown `-singleturn`.** `-singleturn` clears at end of turn; `-start` is a persistent volatile. If ours is genuinely persistent, **Endure never expires** — the volatile-duration bug a fourth time. Also `damp electromorphosis heatproof hospitality`. |
| 3 | 1,180 | **Stockpile boosts before it announces.** Showdown announces the layer, then boosts Def and SpD. Cosmetic UNLESS something reads the counter between the two. |
| 2 | 573 | **Illusion puts the wrong body on the field** — `bittermalice nightdaze`. ROADMAP #67, caught live for the first time. |
| 2 | 101 | **Quick Draw never activates.** No tag row, no code. It is Quick Claw for attacks: 30% to move first within the priority bracket, damaging moves only (Quick Claw is 20% and any move). |
| 1 | 437 | **Belly Drum boosts where Showdown does nothing.** |
| 1 | 198 | **Burn Up's typechange is never emitted.** |

### AND ONE OF THE ROWS IS A HARNESS BUG, NOT AN ENGINE BUG

`afteryou`, `sleeptalk` and `snore` (442 clicks) are all filed as the subject emitting a spurious
`-fail`. The `-fail` is on **`p1b: Venusaur`** — the PARTNER — while the subject is `p1a`. **The harness
blamed the subject for the partner slot's divergence.** Three rows are one shared bug, and none of them
is about After You. Will's own read was the giveaway: *"7 YOU GOTTA BE ASLEEP FOR SLEEP TALK AND
SNORE"* — which is true, and which is why the subject failing made no sense.

### ABILITY USAGE IS MEASURABLE NOW, AND WE HAVE BEEN SAYING IT IS NOT

`engine/click_counts.js`'s header states that no honest store-derived ability usage exists, so the
roster does not defer ability rows on usage. **That was written against the bo1 ladder alone.** Adding
the bo3 store makes it measurable, and `engine/sheet_usage.js` → `data/sheet-usage.json` now does it:
**13,116 games with real sheets (895 bo1 + 12,221 bo3), 26,232 teams, 157,392 slots, every one
declaring an ability.**

    friendguard   1,056 teams   4.03%     tagged, and its own tag row says nothing applies it
    stancechange    235          0.90%     absent from the engine entirely
    ripen             0          0.00%     SHELVED by Will — "SHELVE 2 UNLESS IT HAS REAL USAGE"

**MY FIRST VERSION OF THIS TABLE WAS WRONG TWICE OVER, and both errors are the same error.** I
reported Friend Guard at "0.69%" and Stance Change at "0.16%" — those were shares of SLOTS, which
divides by six and is not the number anyone reasons in. Will caught it on the species: *"I FEEL LIKE
AEGISLASH GETS MORE USAGE THAN THAT AM I CRAZY."* He was right. **Friend Guard is on one team in
twenty-five**, not one in a hundred and fifty, and it changes every damage number aimed at a partner.
The artifact reports `per_team` first for this reason.

**A `sheets` KEY IS NOT A SHEET**, and this artifact's own first run proved it: counting every game
whose `sheets` field was merely truthy gave **64,846 sheet games against 26,232 teams** — six slots
per team, so the team count was right and the game count was nonsense. The bo1 store carries an empty
`sheets` object on games that declared nothing. Fixed before the artifact shipped.

**AND FOURTEEN ABILITIES CANNOT BE COUNTED HERE AT ALL.** A sheet declares the PRE-MEGA ability, so
`parentalbond` reads 0 and that does **not** mean nobody brings Mega Kangaskhan. The artifact derives
the mega-only set from the format and lists it under `not_countable` — `aerilate dragonize eelevate
electricsurge fairyaura filter firemane innardsout megasol parentalbond piercingdrill shadowtag
spicyspray unseenfist` — rather than letting those read as unused. **A zero meaning "invisible to this
instrument" and a zero meaning "nobody brings it" are different facts**, and merging them is how
ROADMAP #112 came to declare the pinch family dead. Count those through `engine/mega_census.js`.

### FRIEND GUARD IS TAGGED AND NOT APPLIED, AND ITS OWN TAG SAYS SO

Will: *"HAVE WE MODELED FRIEND GUARD."* `data/tags.json` carries
`{tag: 'reducesAllyDamage', param: 'my PARTNER takes x0.75', why: 'Friend Guard. Changes every damage
number aimed at the partner and nothing applies it'}`. The identifier appears zero times in the engine.
**A tag that documents its own non-implementation is the artifact-audit lesson again**: a derived fact
is not a fact until something compares it to its source.

### STRUGGLE IS NOT CLOSED. THE CONDITION IS PP-ONLY AND SHOWDOWN'S IS NOT

The PP batch reported #119 done. It is half done. Our predicate is `ppAllOut(m)` at
`engine/medicham2-browser.js:1450` — *every move's PP is zero*. Showdown's is `!moves.length` where
`moves` is the list of **ENABLED** moves (`sim/side.ts:697`, `sim/pokemon.ts:1022-1044`); a slot leaves
that menu when it is **disabled OR at 0 PP**. Will named the cases exactly: *"U ONLY STRUGGLE WHEN
COMPLETELY OUT OF PP OR ARE LOCKED INTO A MOVE U CANT USE LIKE CHOICE SCARF DISABLED OR ENCORED
DISABLED."*

- Choice lock + Disable — the item disables the other three, Disable takes the fourth. Choice Scarf is
  legal here, so this is live.
- Encore into a move that then hits 0 PP or is Disabled.
- Taunt on an all-status set, Imprison, Torment, Throat Chop, Heal Block, Gravity.

(`canCauseStruggle` at `pokemon.ts:1025` is inside `if (this.volatiles['dynamax'])` and is irrelevant
here.) **This is the same missing concept as ROADMAP #118** — we have no notion of a move being
*present but disabled*, only "PP is gone". The two must be fixed together, and #118 carries the
largest usage figure in the whole open register; read it from the row rather than from here.

### PP DOES NOT EXIST IN `board.js`, SO EVERY IMAGINED FUTURE HAS INFINITE PP

Will: **"FIX 1"**. The simulator tracks PP as of tonight; the rollout board tracks none. With a 60-turn
cap (ROADMAP #38) and real games ending near turn 6, the surface reading is "harmless". It is not: an
infinite-PP 60-turn rollout lets the search discover **stall lines that cannot exist** — unlimited
Protect, recovery and redirection. That is a systematically wrong valuation in exactly the positions
where the search believes it is being clever.

### PROCESS, RECORDED BECAUSE IT NEARLY COST SOMETHING

- **Two agents were put on `engine/medicham2-browser.js` at once** and caught before damage. Will's
  rule, given on the spot: **"MULTIPLE AGENTS BUT ONLY ONE PER DIVISION."** CLAUDE.md's "never run both
  agents against this repo at the same time" was written about Cowork and reads as a blanket ban; it is
  not one. The division split already gives one writer per file.
- **Release `9779c50340fb` was cut over a mid-batch tree unintentionally.** Nothing was measured against
  it. It must not be quoted.
- **CHANGELOG.md was missing five versions** — 3.99.1 through 4.2.0 shipped with a version in the commit
  subject and no entry. Backfilled at 4.3.0. **The pre-commit hook was armed and did not fire**: it
  checks that version-headed DOCUMENTS do not trail the changelog, and never the converse — that a
  version named in a COMMIT MESSAGE has a matching heading. The one direction that actually happened was
  the unguarded one.
- **I told Will this running list did not exist.** It does — this file, enforced by the hook's sprint
  clause. I searched for `pend|owed|debt|running|defer|todo`, the filename matches none of them, and I
  reported the absence as fact and started a duplicate. **A failed search is not evidence of absence**,
  and a second running list is the "two files that both decide one fact" failure this document warns
  about in three other places. The duplicate was deleted; this file is the only one.

---

## THE DIVERGENCE LIST CLOSED — 32 OF 34, AND THE ROOT CAUSES WERE THREE, NOT TWO. 2026-08-10.

Will: *"OKAY WORK THROUGH THE WHOLE LIST DONT STOP AND WAIT FOR ME."*

**125 → 93 diverging move rows. Census 416 → 421 live / 421 probed / 0 missing / 0 unarmed.**
`test-engine-diff --n 20000` = 0 disagreements before, between and after. Release `debbbe33ce6d`.

### THE CRIT CLASS WAS BIGGER THAN CRITS

`getDamage`'s four early returns — `move.ohko`, `damageCallback`, `damage === 'level'`, `damage` —
sit **above both** the crit die and the type chart. Thirteen moves emitted a `-crit` AND a `-resisted`
or `-supereffective` they cannot have. **Not cosmetic:** the crit set `R.crit`, which Anger Point,
Sniper and Shell Armor read.

One predicate, `damageIsComputed(moveId)`, inside `critChance` so every caller shares it — the FACTS
ARE GLOBAL rule. **Membership was checked against the format rather than listed**: `ohko ||
damageCallback || damage` is exactly the `fixedDamage` tag's 13 entries. It also closed `sheercold`
and `metalburst`, which diverged on `-resisted` instead of `-crit` — same predicate seen from the
other side, and neither was on the original list.

### THE MULTI-HIT ROWS WERE AN EVENT SHAPE. THE HIT COUNT WAS NEVER WRONG.

Confirmed, and this is the correction that mattered most: `game_differential.js` pins the die over
both engines, **both rolled 2**, and the exact-2× ratio was our aggregate against Showdown's FIRST
PACKET. **This is NOT a regression of ROADMAP #103** and must not be reported as one.

The volley now applies per packet — effectiveness, crit and damage per arrival, stopping at a KO on
the authority's own loop guard, closing with `|-hitcount|`. **Two real mechanics fell out, and both
were already declared open in the source rather than newly discovered:**
- a **Focus Sash now answers the first packet** for the 2–5 family (WIRE 12's stated divergence);
- a volley stopped early by per-hit accuracy **was being priced at the 3.1-hit expectation**, because
  `if (_hitsThisUse > 1)` left the count unset and sent `hitPlanOf` to `expectedHitsOf`.

### STANCE CHANGE DID NOT EXIST, AND ADDING IT EXPOSED A FOURTH DEFECT

Eight rows, one absent ability, derived as `formeOnMoveCategory` by handler shape with carriers
printed before wiring. Then: **`formeSwap` threw the body's SP spread away** and adopted the new
species' aggregated row. Five Aegislash moves landed **1.31× too hard** and Gyro Ball went the other
way — **the signature of a stat, not a formula**, which is how it was found. Showdown provably
preserves the spread across a forme change (Palafin 90→180 and 122→212, delta 90 both).

One existing probe's expected number moved 233 → 244, and **the engine is what moved** — the
two-spread measurement is written into the probe so the number cannot drift back silently.

### BEAT UP NEEDED NO CHANGE, AND THAT WAS MEASURED RATHER THAN READ

`-hitcount` **4/4/3/3** on both engines across (clean, burned user, burned teammate, both) on a
brought four. Will's catch on the party size was right — it is the four brought, not the six — and the
implementation already matched it. The user always participates, per-hit power is the ally's **base**
Attack while the attack stat is the **user's**, and there is no contact flag.

### THREE ROWS ARE FILED AND NAMED, NOT FIXED

- **`finalgambit`** — the crit is gone and it moved onto `|faint|` vs our `-damage 0 fnt`: the self-KO
  faint-order family, shared with explosion, selfdestruct, memento, mistyexplosion.
- **`steelbeam`** — damage now agrees to the point (405/810 both); only `[from] Recoil` vs
  `[from] steelbeam` differs. Same family as the seven `-damage field 4` trapping rows.
- **`belch` / `lastresort` / `upperhand`** — the unenforced `onTry` use-conditions, untouched.

### THE REGISTER GATE NOW READS COMMIT MESSAGES, AND CAUGHT A REAL ORPHAN IMMEDIATELY

`tests/test-roadmap-register.js` checked DIVISION LEDGERS only, which is why two commits could cite
`#145` and `#146` against a register that stopped at #143. Widened to the last 40 commit messages, it
failed on its first run — **`#114`, cited by `247d26b` and registered nowhere**: `MEDI_SPREAD`
assigned to `root` and never to `module.exports`, so `M.MEDI_SPREAD ? … : false` always took the false
branch and **the 0.75× spread multiplier was never applied to a staged span**. Already fixed in code
(38 moves, Earthquake present); now registered as closed.

Scope is the last 40 commits **deliberately** — a gate that fails on retired numbering schemes gets
ignored, which is this repository's named disease. Absent git is SKIPPED and said out loud, never
counted as a pass, because a check that evaporates silently is a capability that cannot prove it ran.

### `status.js` STAMPED UTC WHILE EVERY DATED ARTIFACT USES LOCAL

`day()` used `toISOString()`. Measured 20:43 EDT: `medicham2-browser.js` mtime `2026-08-10 20:41:29
-0400`, rendered `2026-08-11 00:40`. **Any run after 20:00 EDT stamped tomorrow**, and a CHANGELOG
entry written that session was stamped a day ahead and corrected by hand. The same class as the reason
`provenance.js` stopped comparing mtimes: an artifact that looks newer than it is, feeding a staleness
comparison that then reads backwards.

### TWO TESTS ARE RED. SAID, NOT FILED.

`tests/test-effective-identity.js` (1,147 raw reads against a 234 baseline) and
`tests/test-no-silent-failure.js` (52 new silent catches against 220).

**Attribution was measured rather than assumed, and the two agents disagreed about it.** SEARCH
reported every named offender as ENGINE's uncommitted work. ENGINE then measured file by file:
**13 of 14 and 11 of 12 named files are byte-identical to HEAD.** So this is not tonight's engine
edits — it is instrument files created across the sprint and never baselined, with `tests/roster.js`
alone carrying **247 of the 912** raw-read delta.

**NEITHER WAS RE-BASELINED.** Re-baselining a red gate is precisely how a real defect gets laundered,
and the whole reason `--update` exists is for exceptions that are argued in the code first. The two
silent catches in `engine/sheet_usage.js` were mine and are fixed: both now speak to stderr and record
the failure where a later reader can see it, rather than returning a quiet null.

**These remain RED at the end of this batch.** That is a statement, not a status — they are owed a
dedicated pass, and no number resting on them should be quoted until they are green.

---

## THE REPLAYER'S SILENT CATCHES, AND A FINDING I RETRACTED IN THE SAME HOUR. 2026-08-10.

`tests/test-no-silent-failure.js` was RED at 52 new catches. `engine/replay_differential.js` carried
**15** of them, the largest single file, and no agent held it. Twelve now speak; the count is **38**.

**THE ONE THAT MATTERED MOST WAS AT THE TOP OF THE FILE.** `PHAZE_MOVES` was built in a `try` that
returned `null`, and `turnHasPhaze()` opens `if (!PHAZE_MOVES) return false`. **A null list means no
turn is ever a phaze turn**, so the replayer resumes scoring every turn downstream of a Roar,
Whirlwind, Dragon Tail or Circle Throw — which draw the replacement at random, so each later turn
compares two different boards and charges the difference to the engine. That is CHANGELOG 3.99.1
undoing itself, with the run completing and the numbers looking fine. It is now FATAL: this file
replays stored games THROUGH SHOWDOWN, and a dex it cannot load is not a degraded mode.

The others, with the consequence rather than the pattern:
- `movePriority` throwing left priority at **0** — a Sucker Punch reorders the turn and the
  comparator reports a disagreement that is the instrument's, not the engine's.
- `effSpeed` throwing fell back to the **raw stat**, discarding Scarf, paralysis and Tailwind.
- `playerAction` throwing became a **passed turn** — ROADMAP #125's shape, with nothing recording it.
- `bodyFor` throwing removed exactly the species it could not build, so the surviving agreement read
  better than it was.
- `speedSpan` skipping a weather field **narrows** the interval, and `orderVerdict` scores on
  disjointness — so that silence **manufactures** disagreements rather than hiding them. The wrong
  direction to be quiet in.

### AND THE PART WORTH KEEPING: I FOUND A DEFECT THAT WAS NOT THERE

I ran a tiny smoke run to check the file still loaded, saw `data/replay-differential.json` overwritten, and
concluded a smoke run had destroyed a real measurement. I wrote a floor guard, wrote it against a
field the artifact does not have (`corpus.games_scored` — it is `counts.games_replayed`), fixed that,
watched it still not fire, and only then printed the values: **the run had scored a full run's worth of games rather than the handful I asked for** — the flag I passed was not the flag the script reads.

*(The exact count is deliberately not quoted here. It was a reading of `data/replay-differential.json` taken during a past incident; that artifact has been regenerated many times since, and the docs-currency gate correctly flagged the stale figure as a claim the artifact no longer supports. The INCIDENT is the point, not its arithmetic.)*

**`--n` is `test-engine-diff.js`'s flag. This file's is `--games`.** The unknown flag was silently
ignored and every "smoke run" was a full 100-game run. Nothing was destroyed; the artifact was
legitimately regenerated at the same size, and it has been restored from HEAD regardless.

**The guard was REMOVED rather than kept on a better justification.** The file already refuses to
publish when its red proof cannot be staged — *"An instrument that cannot be shown red is not
evidence"* — which is strictly stronger, and a second overlapping protection is the
two-things-deciding-one-fact hazard. What shipped instead is the defect that actually existed:
**an unrecognised flag now refuses to run**, with the known set derived from the parse sites.

**The lesson is not the wasted commands.** I asked for eight games, got a hundred, and every signal
said success — this project's founding failure reached through the cheapest possible door, checking
that code runs. Here it cost four commands and a false finding. In a measurement that mattered it
would produce a number computed over the wrong sample with nothing anywhere saying so.

---

## FOUR AGENTS LANDED WORK AND NONE OF THEM REPORTED — THE SESSION DIED FIRST. 2026-08-10.

I ran four division agents at once (ENGINE, WEB, MEASURE, SEARCH). The session froze and Will had to
hard-restart it, so **not one of the four returned a verdict.** Their edits survived on disk; their
claims did not. **Everything below was verified by RUNNING it, not by reading a report**, which is the
only honest option when the reporter is gone — and is arguably how it should have been done anyway.

**THE PROCESS LESSON IS MINE, NOT THEIRS.** Will's rule was "MULTIPLE AGENTS BUT ONLY ONE PER
DIVISION", and I satisfied it literally while missing what it was protecting: four concurrent agents,
each spawning Showdown battles, is a load problem regardless of file separation. One-per-division is a
COLLISION rule. It is not a capacity rule, and I treated it as both.

### WHAT SURVIVED, VERIFIED BY RUNNING IT

| Division | Evidence |
|---|---|
| SEARCH | `tests/test-rollout-switch.js` — 16 passed |
| WEB | `tests/test-web-quarantine-loaders.js` — ALL PASS |
| MEASURE | `tests/test-engine-release.js` — 66 passed |
| ENGINE | gate unchanged at 8 open defects — **#118/#119 did NOT land** |

### THE ROLLOUT CAP WAS A ROUND NUMBER, AND THE ARTIFACT SAYS SO IN ITS OWN WORDS

`data/rollout-switch-census.json`, pooled over **58,639 stored games**:

    71.22%  of games contain a voluntary switch
     9.98%  of decisions WITH A LIVE BENCH are a voluntary switch
       14   turns — the derived cap (ladder 14, bo3 13), at 99% of occurrence-weighted positions
       60   turns — what it was, `was_derived_from: "nothing — a round number"`

So the rollout was imagining games **four times longer than they are**, in which **nobody ever left**,
while seven games in ten really do contain a switch. Those two errors compound rather than cancel: a
long rollout with no switching is exactly where stall lines that cannot exist get discovered, and the
PP work landed earlier the same night makes those lines end in Struggle.

### THE 56 UNOPENABLE RELEASES RESOLVE INTO CAUSES, AND MOSTLY ARE NOT BROKEN

`data/release-census.json`: **54 serviceable, 55 predate an export, 4 pruned, 5 genuinely unloadable.**
The dominant cause is the one the release header warns about — `SOURCES` grew 12 → 17 → 23, so an
older release lacks a file today's loader requires. That is a LOADER-COMPATIBILITY fact, not
corruption, and it is a much smaller problem than "56 of 62 cannot be opened" implied.

### THE GURU HOLE — TEN GENERATORS, NONE DECLARED, ALL RED AT ONCE

`tests/test-stadium-roster.js` went red on ten artifact generators built across this sprint that were
in neither `docs/MODELS.md` nor the Stadium and had no declared reason: `all_mechanics_fire`,
`click_counts`, `format_audit`, `mega_census`, `pp_board_probe`, `replay_differential`,
`rollout_switch_census`, `rollout_switch_probe`, `scenario_catalogue`, `sheet_usage`. **Three were
mine.**

They divide three ways and the division is the point: an **INSTRUMENT** measures our engine against
the authority, a **CENSUS** states a fact about the stored corpus, a **PROBE** is a receipt that a
capability fires. None predicts anything about a game, which is what a model does. Each is now
declared with its own reason and its own TRIGGER — the condition that would make the declaration false
— because that table's own rule is that a reused reason is the pattern it forbids, and a stale
declaration stops the gate asking permanently.

`click_counts` and `sheet_usage` were the borderline pair and are declared as censuses on a stated
argument: the MEDICHAM gate's usage shelf reads them, but **the shelf is the thing that decides** and
it lives in `engine/quarantine.js` with its own bar. The trigger is written down: false the day a
fitted model takes those counts as a feature rather than as a threshold.

### AND THE DIFFERENTIAL CLAUSE HAD QUIETLY WEAKENED

The gate read `0 of 150 comparisons` where it had been `0 of 20,000` — an agent ran it small and the
artifact it left behind is what the clause reads. **A gate passing on a 133x smaller sample is a
weaker claim wearing the same word.** Re-run at 20,000: still 0.

---

## THE FORME-CHANGE STAGING TABLE — WILL'S DESIGN, 2026-08-10.

Will, on the seven abilities the A/B roster cannot stage: *"THE FORM CHANGE ONES SHOULD BE EASY, DID
THE FORM CHANGE? (AND DID THE UNDERLYING STATS CHANGE WITH IT)"*, then *"MAKE SURE TO SET UP THE
CONDITION FOR THE FORM CHANGE, SO KINGS SHIELD AND THEN ATTACK FOR AEGISLASH, SWITCHING IN AND OUT FOR
PALAFIN, ETC"*.

**THIS REPLACES THE A/B METHOD FOR THIS FAMILY, AND IT HAD TO.** The roster proves an ability by
staging it, staging a control WITHOUT it, and comparing. Every body here has the forme-changer as its
ONLY ability, so the control cannot be built — Showdown says so itself with
`flags: {failroleplay, noreceiver, noentrain, notrace, failskillswap, cantsuppress}`. **We do not need
to invent a "SUPPRESS-tier" category; the format already labels it.** The assertion becomes ABSOLUTE
instead of differential.

**AND THE SECOND HALF OF WILL'S TEST IS THE ONE THAT WAS ALREADY BROKEN.** `formeSwap` threw the
body's SP spread away and adopted the new species' aggregated row — five Aegislash moves landed 1.31x
too hard, Gyro Ball went the other way. "Did the stats change WITH it" is exactly that defect, and it
was found by damage ratios rather than by a forme test, which is the long way round.

### THE ASSERTION, THREE PARTS, THE THIRD BEING THE ONE THAT FAILS

1. the forme changed — species id is the new one;
2. the stats are the NEW forme's base stats;
3. **the body's own SP spread survived the change** — Showdown provably preserves it
   (Palafin 90 → 180 and 122 → 212, delta 90 both).

### THE TRIGGERS, ONE PER ABILITY, ALL NINE LEGAL IN THIS FORMAT

| ability | carrier | the condition that must be staged |
|---|---|---|
| Stance Change | Aegislash | click an ATTACKING move → Blade. Then **King's Shield → back to Shield.** Both directions, Will's own script |
| Zero to Hero | Palafin | **switch OUT and back IN** → Hero. Nothing else does it; the entry is the trigger |
| Disguise | Mimikyu | take a DAMAGING hit → Busted, and the holder loses 1/8 max HP |
| Hunger Switch | Morpeko | end of turn, unprompted — it alternates Full Belly ↔ Hangry every turn |
| Forecast | Castform | set WEATHER → Sunny / Rainy / Snowy, one arm per weather |
| Mimicry | Stunfisk-Galar | set TERRAIN → its type follows the terrain |
| Ice Face | Eiscue | take a PHYSICAL hit → Noice; snow restores it |
| Shields Down | Minior | drop to **≤ 50% HP** at end of turn → Core |
| Illusion | Zoroark | switch in behind a teammate, then take a DAMAGING hit to break it (ROADMAP #67) |

**NONE OF THESE IS REACHED BY THE GENERIC GAUNTLET**, which hits the body twice and switches out. Only
Zero to Hero and Illusion get near their trigger by accident, and Illusion's whole defect is that the
wrong body is on the field to begin with.

**READ THE MEMBERSHIP FROM THE FORMAT, NOT FROM THIS TABLE.** Schooling, Power Construct, Protosynthesis
and Quark Drive have NO legal carrier in Reg M-B and are correctly absent; that is a fact about the
regulation and it changes when the regulation does.

---

## THE MILLION-GAME TARGET LIST — 237 ROWS, AND THE LINE IT DRAWS. 2026-08-10.

Will: *"START A LIST OF ALL THE THINGS WE WANT TO TEST IN THE MILLION GAMES RUN."* Built as
`engine/million_targets.js` → `data/million-targets.json`, DERIVED from the format and our tags so it
cannot go stale.

### THE LINE, AND TWO OF WILL'S OWN THREE EXAMPLES FALL ON THE OTHER SIDE OF IT

    Upper Hand blocks priority         a RULE.  one board settles it.   n = 1
    Terrain Pulse doubles on Electric  a RULE.  one board, two asserts. n = 1
    Rock Slide flinches 30%            a DIE.   no board settles it.    n = large

**A DETERMINISTIC MECHANIC THAT ONLY SHOWS UP WRONG AT A MILLION GAMES MEANS THE SCENARIO CATALOGUE
HAS A HOLE.** Both rule examples prove it: Terrain Pulse WAS broken and one fixture fixed it at 4.0.0;
Upper Hand is broken RIGHT NOW — Showdown refuses it, we execute it — and one fixture would catch it.

### AND THE ORDER MATTERS, WHICH WILL CALLED BEFORE I DID

*"BEFORE THE MILLION GAMES LETS TEST ALL OUR STAGING SCENARIOS AND COMPARE THEM TO SHOWDOWN RIGHT?"*
Yes, and the reason is diagnostic rather than economic: **a rate test can only measure a mechanic that
already works.** If flinch reads 0%, a rate run cannot say whether the CHANCE is wrong or the flinch
is unwired. Scenarios answer "does it work"; the million games answers "at what rate". Reversed, every
rule bug arrives disguised as a rate bug.

### THE 237

    112  accuracy       every sub-100 move. THE PIN MAKES ALL OF THEM MISS ON BOTH SIDES, so accuracy
                        has never been observed once — the two engines agree perfectly and prove nothing
     76  secondary      flinch / burn / stat-drop chances, read from the FORMAT not mainline
     17  crit rate      Focus Energy, Dragon Cheer, Scope Lens, Super Luck, Merciless + 12 moves
     12  proc           Flame Body, Effect Spore, Poison Point, Quick Claw, King's Rock, Focus Band…
      8  multihit       the 2-5 distribution, never seen free-running (both engines pinned to 2)
      4  chance         paralysis 25%, confusion self-hit 33%, Attract 50%
      4  ohko           30% at equal level, by formula rather than constant
      3  duration       sleep 1-3, freeze thaw 20%, confusion length
      1  random-choice  Trace's uniform pick among eligible foes

**The single busiest row is Protect at 147,242 clicks** — the ⅓ / ⅑ / ¹⁄₂₇ chain-failure rate. The
most-clicked mechanic in the format and its failure rate has never been measured.

### THE DENOMINATOR IS THE HARD PART AND EVERY ROW CARRIES ITS OWN

Rock Slide's 30% is over turns it CONNECTED with a target that could flinch — not turns it was
clicked. A miss, a Protect, a Substitute, an immunity, Shield Dust and Covert Cloak are all outside
it. **A rate over the wrong denominator is worse than no rate, because it looks like an answer.**

### WHAT IS DELIBERATELY *NOT* IN THE LIST, AND WILL'S QUESTION IS WHY

*"WHAT HAPPENS IF FLOWER TRICK HITS A BATTLE ARMOR MON?"* Measured at
`sim/battle-actions.ts:1637-1646`: `moveHit.crit = move.willCrit || false`, the roll is SKIPPED because
`willCrit` is defined, and then `if (moveHit.crit) moveHit.crit = runEvent('CriticalHit', ...)` — which
Battle Armor answers `false`. **The move hits for normal damage and emits no `-crit`.**

That question designed a three-arm deterministic fixture off one move:

    Flower Trick -> ordinary body                  crits
    Flower Trick -> Battle Armor                   NO crit, normal damage
    Flower Trick from a MOLD BREAKER -> Battle Armor  crits again (flags: {breakable: 1})

No die anywhere. It settles `preventsCrit` (Battle Armor, Shell Armor, Disguise, Ice Face),
`alwaysCrit` (Storm Throw, Flower Trick, Frost Breath) and **`moldbreaker`**, which is itself sitting
in the inert list. So `preventsCrit` is EXCLUDED from the million games on purpose — keeping it there
would be the exact mistake this file's header warns about.

### A COVERAGE WARNING THAT N CANNOT FIX

A self-play corpus in which nobody switches yields **zero** samples for Intimidate-on-entry, hazard
chip and Regenerator however many games it runs. **Coverage is a property of the ACTION SET, not of
N** — which is why ROADMAP #63 had to land before this run rather than after.

---

## THE ADVERSARY TABLE — WHY 63 ABILITIES READ AS FINE. ROADMAP #98, 2026-08-10.

**ONE SCRIPT RAN AT EVERY ABILITY**: get hit physically, get hit specially, switch out. Against that,
**63 legal abilities produce a board byte-identical to not having them**, and the roster files each
`COULD-NOT-STAGE — THE STAGING IS INERT`. That verdict reads as a limitation of the game. It is a
limitation of the FIXTURE: Analytic only acts if the holder moves LAST, Levitate only against a GROUND
move, Shield Dust only against a move carrying a SECONDARY. **A test that cannot fail is not evidence,
and 63 of them were being counted as coverage.**

`engine/faces.js` is Will's `faces` applied where the boards are built — *"IE WIDE GUARD NEEDS A
SPREAD MOVE AGAINST IT, ITS POINTLESS TO TEST IF IT DOESNT FACE THAT."* 27 entries, keyed on the TAG so
an ability added tomorrow inherits its adversary for free.

    35 of 63   now have a stated adversary
     2         merciless, superluck — a crit RATE, excluded on purpose -> million games
    26         carry no usable tag, so no adversary can be derived until the rule is written

### WILL'S QUESTION, AND IT IS THE RIGHT ONE

*"DO WE WANT JUST A FIXED TARGET LIKE FERALIGATR OR MORE VARIED? WILL IT PROC EVERYTHING?"*

**It will not**, and the three reasons are three different blindnesses:
- **its MOVES** — Flower Trick is Meowscarada's alone; Storm Throw, Frost Breath, Spore, Fake Out and
  Earthquake are not one body's set;
- **its TYPE** — pure Water was chosen because it has NO immunity and blocks nothing by accident, which
  is the right DEFAULT and the wrong universal: a Ground immunity needs Ground thrown at it;
- **its ABILITY** — Torrent, so Trace, Receiver, Mummy and Wandering Spirit would be measured against
  Torrent every single time and pass while exercising one value.

**But varying it BLINDLY would be worse than fixing it.** A random adversary makes a green mean
something different every run — which is how the roster's control arm came to measure the CONTROL
instead of the subject (ROADMAP #100). So the target varies by TAG and Feraligatr stays the default.

### AND A MISTAKE WORTH RECORDING: A TABLE MUST BE IMPORTABLE WITHOUT STARTING AN INSTRUMENT

I first wrote the table INSIDE `all_mechanics_fire.js` and added a `module.exports`. That file RUNS on
require — so the probe I wrote to count coverage **began playing games**, printing the harness banner
before it printed an answer. Moved to `engine/faces.js`, data only, no side effects. Small, and the
same shape as everything else here: the thing that looked like a read was a write.

---

## THE ADVERSARY IS WIRED, AND IT REVEALED A BIGGER WALL: 37 ABILITIES HAVE NO CONTROL. 2026-08-10.

`engine/faces.js` is now READ by `gauntletScript`, which takes the stated adversary's moves first in
its preference list and falls back to the bare gauntlet when a carrier cannot learn them. Setup turns
were added for the preconditions that are not attacks — weather up before Cloud Nine, a status on the
holder before Quick Feet and Natural Cure, and a priority click from the ADVERSARY so Analytic's
holder genuinely moves last (Will's constructed-pair rule: build the condition, do not wait for a
board where it happens to hold).

### AND THEN LEVITATE DID NOT REACH ANY OF IT

    NO CONTROL — every legal carrier has this as its only ability, so the A/B arm has
    nothing to swap it for. The row is not measurable by this instrument.

Chimecho's only ability is Levitate. **The adversary table cannot help a row that never gets staged**,
and this failure happens one step earlier than the one it fixes.

### MEASURED: IT IS 37, NOT 7

I had told Will that SEVEN abilities needed an absolute-assertion mode — the form-changers he named.
Counted against the format: **210 legal abilities have a legal carrier, 173 have some carrier with a
second ability to swap in, and 37 do not.**

    aerilate disguise dragonize eelevate electricsurge embodyaspect(4) fairyaura filter firemane
    forecast furcoat goodasgold gulpmissile hungerswitch iceface illusion innardsout levitate
    megalauncher megasol mimicry mummy parentalbond piercingdrill serenegrace shadowtag shieldsdown
    spicyspray stancechange surgesurfer terashell unseenfist wanderingspirit zerotohero

**Six of those Will raised himself tonight** — Levitate, Mummy, Innards Out, Piercing Drill, Mega Sol,
Parental Bond — which is why the seven-item framing survived as long as it did: every example that
came up looked like a special case rather than a class.

### SO THE STAGING PROBLEM IS THREE, NOT TWO

| blocked by | count | fix |
|---|---|---|
| the FIXTURE — wrong adversary | ~26 | `engine/faces.js`, done |
| the METHOD — no control body can exist | **37** | absolute assertion, to build |
| the DIE — a rate, not a rule | 2 | the million-game run |

**Will's form-change answer generalises to all 37 and that is the point.** It is not "did the form
change" specifically; it is **assert the outcome directly instead of comparing two bodies.** Levitate:
did the Ground move deal zero? Mummy: is the attacker's ability now Mummy? Innards Out: did the KOer
lose HP equal to what the holder had? Piercing Drill: did it go through the Protect? None needs a
control, and none is harder than the A/B it replaces.

---

## THE MOVE ADVERSARIES — 29 OF 54, AND THE OTHER 25 NEED A DIFFERENT WORD. 2026-08-10.

`MOVE_FACES` in `engine/faces.js`, 13 entries. The move stage hands the subject a click and lets the
receiver attack back — which reaches any move whose effect is DAMAGE and misses every move whose
effect is ABOUT the adversary. **Will named two of these before the measurement existed**: *"WIDE
GUARD NEEDS A SPREAD MOVE AGAINST IT"* and *"HAVE CONTACT HIT ROUGH SKIN TO CHECK"*.

The four biggest tag buckets among the inert moves — `pp`, `statusCategory`, `neverMisses`,
`moveClass` — get NO entry, deliberately. They are PROPERTIES, not triggers: nothing follows from
"this is a status move" about what must happen for it to be observable. **A property is tested through
its REACTOR**, which is what the `contact` / `sound` / `powder` entries are.

### AND THE REMAINING 25 NEED A CONSEQUENCE, NOT AN ADVERSARY

    attract burnup destinybond entrainment fairylock gastroacid guardsplit haze helpinghand lockon
    magicroom magneticflux magnetrise poltergeist powershift powersplit powertrick safeguard simple …

None of these is failing for want of something to face. **They set a STATE, and the board is identical
because nothing downstream ever reads it.** Haze resets stat stages — something has to have BOOSTED
first. Magnet Rise grants a Ground immunity — a Ground move has to come AFTER. Safeguard blocks
status — a status move has to follow. Poltergeist needs the target to be HOLDING something. Helping
Hand needs the ally to attack afterwards. Lock-On needs a sub-100 move next.

So the staging vocabulary is TWO things and we only had one:

    faces        what the subject must be UP AGAINST   — Will's addition, now built for both stages
    thenWhat     what must happen AFTERWARDS to read the state the subject just set

Forcing the second into the first would have produced entries that look like adversaries and are not,
which is the kind of thing that passes review and then quietly means nothing. It is built as its own
concept next.

---

## THE SHELF IS FINE. THE SILENCE IS NOT. 2026-08-10.

Will: *"yes if it has almost no usage we can quarantine it, AS LONG AS WE KNOW ITS PURPOSELY NOT BEING
BUILT."* That condition is the entire rule, and it is the same one CLAUDE.md already applies to
`RAW-STORE-OK`: **a gap that is a JUDGEMENT gets declared with its reason; a gap that is merely absent
is the failure.**

### AND WILL KILLED A FLAT USAGE THRESHOLD BEFORE I COULD SHIP IT

I proposed *"under 25 teams, shelve it"*. He said *"oh maybe it does then"*, and measuring showed why
that rule was wrong:

    Farigiraf   18.3% of teams — 8th most common in the format — 21 run Cud Chew
    Toxapex      5.0%                                          — 20 run Merciless
    Maushold     3.0%                                          — 10 run Cheek Pouch
    Absol        0.19%                                         — 19 run Super Luck (37% of Absols)
    Diggersby    0.16%                                         —  3 run Pickup

**These are COMMON bodies running a MINORITY ability.** A flat threshold reads "20 teams" and cuts
Merciless — but Toxapex is on one team in twenty, and what matters for a simulator is how often you
FACE a mechanic, not how often you bring it. The threshold would have quietly removed four things that
occur in real games.

### SO THE RULE IS USAGE **times** FIXTURE COST, AND ONLY ONE ROW FAILS BOTH

| | usage | fixture | call |
|---|---|---|---|
| Cheek Pouch, Cud Chew, Gluttony | 10 / 21 / 52 teams | **ONE shared fixture** — hold a berry, cross the threshold, look | BUILD |
| Merciless, Super Luck | 20 / 19 | a crit RATE — no single board settles it | million games |
| **Pickup** | **3 of 26,232 — 0.011%** | needs a SECOND body to consume an item on an earlier turn | **SHELVED** |

Pickup is the only one where the fixture costs more than the mechanic is worth, and it is also the
rarest by threefold. It is declared in `tests/roster.js`'s `DEFERRED` table with its number, its
reason, and the explicit note that this is NOT a general usage rule. It keeps its scenario, stays
staged, and is printed every run — it simply stops holding the gate.

---

## THE CLOSET, AND WILL'S "ARE WE SURE THOSE ARENT JUST FUTURE MEGAS". 2026-08-10.

Three abilities shelved on a measured ZERO across 26,232 declared sheets: `battlebond`, `minus`,
`stall`. Ripen was already shelved. **Will asked whether they were just mega bodies, and checking made
the shelf STRONGER while proving my stated reason wrong.**

    Sableye     758 teams (2.9%)   Keen Eye / STALL / Prankster        mega: Magic Bounce
    Greninja    189 teams          Torrent / Protean / BATTLE BOND     mega: Protean
    Manectric    70 teams          Static / Lightning Rod / MINUS      mega: Intimidate

**These bodies are played constantly — Sableye is on one team in thirty-four.** The zero is not "nobody
brings the carrier", which is what my first wording implied. It is **nobody CHOOSES that ability when a
better one sits on the same body**: Prankster over Stall, Protean over Battle Bond, Lightning Rod over
Minus, and in every case a mega forme that overwrites the slot anyway.

That is a much stronger justification. A shelf resting on "the carrier is rare" breaks the moment the
carrier gets popular. A shelf resting on "there are three abilities and this is the one nobody takes"
holds until the metagame moves, and the entry says to delete it the day a sheet declares one.

**AND IT IS THE SAME MISTAKE I MADE WITH CUD CHEW, IN REVERSE.** There I read a low ability count and
nearly shelved a mechanic that sits on Farigiraf at 18.3%; here I read a low count and explained it
with a rare carrier that is not rare at all. **The ability count alone answers neither question — the
BODY has to be looked at too**, and Will asked the right question both times.

---

## "WHERE ELSE MIGHT MAINLINE HAVE SNUCK IN" — THREE MORE, AND THE ANSWER IS SIX UNAUDITED FILES.

Will asked it immediately after catching me reading mainline `abilities.ts` for Unseen Fist. **The
answer was `data/mods/champions/conditions.ts`, which nothing in this project had ever opened.** It
overrides exactly three conditions, and my million-game target list had all three wrong:

    par   randomChance(1, 8)   = 12.5%   I wrote 25%  — HALF
    slp   sample([2, 3, 3])    = 2 or 3 turns, 1/3 chance of 2 — it can NEVER last one turn
    frz   startTime = 3        = a FIXED three-turn timer, NOT a 20% per-turn thaw roll

Freeze is not a die at all, and I had listed it as one. Every one of these would have failed a correct
engine — or, far worse, passed a wrong one that happened to match mainline. **It is the Moonblast error
again**: 30% written where the format says 10%.

Confusion, Attract and flinch are NOT overridden and inherit mainline, so 33% / 50% stand. Checked
rather than assumed, because "this file overrides some conditions" is not "it overrides this one".

### THE REAL ANSWER IS STRUCTURAL: EIGHT FILES, TWO AUDITED, BOTH AFTER THEY BIT US

    abilities.ts     AUDITED — after Unseen Fist
    moves.ts         AUDITED — after Moonblast and the 21 constants
    conditions.ts    audited now, and it was wrong in three places
    items.ts         NEVER READ
    learnsets.ts     NEVER READ — 328 KB
    rulesets.ts      NEVER READ
    formats-data.ts  NEVER READ
    scripts.ts       NEVER READ — and it is the dangerous one

**`scripts.ts` is 22 KB of overridden BATTLE MECHANICS**, not constants:

    statModify()            the SP stat formula
    calculatePP()           the PP rule
    getActionSpeed()        speed
    formeChange()           <- the SP-spread bug found tonight
    canMegaEvo()            mega rules
    modifyDamage()          THE DAMAGE FORMULA
    spreadMoveHit()         spread resolution
    hitStepMoveHitLoop()    <- the multi-hit loop an agent rewrote tonight, from mainline

**Every mechanic this project has spent the night debugging has an overridden implementation sitting in
a file we have never opened.** `engine/format_audit.js` swept 7,653 constants and found 21 — but it
compares `Dex.forGen(9)` to the format for MOVES. **A constant sweep cannot see a rewritten function.**

### AND TWO BUILDERS STILL FETCH MAINLINE OVER THE NETWORK

`engine/build_mega_dex.js:50` and `engine/build_species_abilities.js:29` both fetch
`play.pokemonshowdown.com/data/pokedex.json`, and the first calls it *"the data the Showdown server runs
this format on."* **It is not — it is mainline.** Measured harmless for now: all 76 legal Champions megas
exist in mainline's pokedex with identical base stats, because Champions does not override `pokedex.ts`.
But the COMMENT is the same wrong belief that put 21 mainline constants into `data/move-effects.js`, one
file away from data that IS overridden.

*(I nearly reported a catastrophe here twice in three minutes — first by reading a key that did not
exist, then by testing `isNonstandard` when every gen-9 mega is `Past` by definition. Both were my
probe, not the data. Measure, then measure the measurement.)*

---

## THE MOD AUDIT — "READ EVERYTHING NO SKIPPING". 2026-08-10.

Will said it after catching me three times running on values I had typed from memory. `engine/mod_audit.js`
now answers "did Champions change this?" for every legal move, ability, item, species and overridden
condition, across every field, by comparing the format dex to `Dex.forGen(9)`.

    71  moves differ        42 pp, 12 basePower, 6 flags, 4 accuracy, 4 secondary, 2 TYPE, 1 self
     7  abilities differ    Anger Shell, Berserk, Disguise, Healer, Natural Cure, Regenerator, Unseen Fist
     1  item differs        White Herb
     3  conditions differ   par, slp, frz
     0  species differ      (357 tier labels excluded; ZERO baseStats or type changes, checked first)
    11  scripts.ts methods  NAMED, NOT VERIFIED

**Snap Trap is STEEL in this format and Grass in mainline.** Growth is Grass, not Normal. Make It Rain
is 95% accurate and drops SpA by TWO. Freeze-Dry has no freeze chance at all here. **Regenerator has an
overridden `onSwitchOut`** and switching went into the rollout the same evening. **Berserk** is one of
the 22 untagged abilities whose rule was about to be derived from mainline.

### WHAT IT CANNOT DO, AND THIS IS THE HALF THAT MATTERS

`scripts.ts` overrides ELEVEN methods: `modifyDamage`, `statModify`, `calculatePP`, `getActionSpeed`,
`formeChange`, `clearVolatile`, `canMegaEvo`, `canTerastallize`, `spreadMoveHit`, `hitStepMoveHitLoop`,
`init`. **A value diff cannot say what a rewritten function does.** They are named and marked
UNVERIFIED rather than counted as covered. Every mechanic debugged tonight has an implementation in
that file — including the multi-hit loop an agent rewrote, from mainline, hours ago.

### AND THE PATTERN, STATED ONCE

**Everything DERIVED from `Dex.forFormat` was right. Everything TYPED FROM MEMORY was wrong.** `par`,
`slp` and `frz` were the three rows I hand-wrote into the million-game list, and all three were wrong —
two of them twice, because my first correction was also from memory. The generator that reads the
format already had Dire Claw at 30%.

---

## WILL IS REWORKING MAG'S WEIGHTS. DO NOT REFIT ON THE WAY PAST.

**Will, 2026-08-11: *"IM PLANNING ON RE WORKING MAGS WEIGHTS SO JUST MAKE NOTE OF THAT WHEN THE TIME
COMES."*** Recorded as an OWNER DECISION, not a pending task.

`engine/status.js` opens with a FEATURE SEMANTICS CHECK FAILURE on `data/policy-weights.json`: the
damage table the weights were fitted against was regenerated underneath them (**318 species -> 317,
digest `405c836793d1` -> `1b66b563c229`**). The check's own advice is "measure what it touches, then
refit (`fit_policy.js`, then `fit_joint.js`), or restamp".

**Take neither branch.** A refit run now would be thrown away, and a restamp would silently assert the
old fit is still valid — which is the worse of the two, because it makes the warning disappear without
making it untrue.

Three things that must be true BEFORE the rework, so it is done once:

1. **The engine must have stopped.** Every weight is fitted through `board.js`, which sits directly
   downstream of MEDICHAM. Refitting against a simulator still under repair buys a vector that expires
   with the next wire. This is the same reason the 47 artifacts are re-RUNNABLE rather than current.
2. **The corpus question is still open** — ROADMAP #26 (bo3 only; the change is in code and unrun) and
   #79 (the 58 features were never designed, reconsidered on Will's invitation). Both land inside the
   rework rather than beside it.
3. **The fitting environment must match the playing environment.** CLAUDE.md's own entry: MAG was
   fitted with the sheet visible and played without it. Whatever is true at fit time has to be true at
   play time, and that is a decision to make deliberately this round.

Until then the failing check STAYS FAILING and stays reported. It is not a known failure and it is not
filed — it is a red gate with a named owner and a stated reason, which is the only third state
CLAUDE.md allows.

---

## THE PERISH SONG KO IS PROVEN, AND THE OLD GUARD PASSED AN ENGINE THAT KILLED NOTHING

ROADMAP #90. Will, 2026-08-07: *"the counter being right is not evidence the faint happens."* Tonight
that stopped being an argument and became a measurement.

**Delete the perish KO, leave the clock ticking, and `tests/test-volatile-duration.js` is still GREEN.**
It runs three turns and watches the number fall; the count never reaches zero, so `onEnd`'s
`target.faint()` — the thing **1,141 corpus uses** actually rest on — had never once been executed by
anything in this repository.

`tests/test-perish-song.js` asserts all three of Will's clauses:

| clause | how it is staged |
|---|---|
| the faint fires | four turns, not three. Turns 1-3 are the negative — nobody may die early, which is the 3.71.0 bug this guards against regressing |
| **both sides at once** | `perishsong.target` is `all`, so the singer's OWN PARTNER must die too. A one-sided test cannot see an engine that applies it to the foes only |
| a body that switches out survives | Scizor U-turns out on turn 2 and is alive on turn 4 while the three that stayed are dead |

**The switch clause was staged with a PIVOT rather than declared impossible.** `staged_board.js`
exclusion D says the script language has no voluntary switch (#122) — and its own text says *"every
switch in this file is driven by a PIVOT MOVE"*. The volatile is cleared by LEAVING the field, not by
the manner of leaving. What a pivot does NOT answer is written into the file: a pivot is not a
voluntary switch, so "does a TRAPPED body escape the count" stays with #122.

### TWO OF MY OWN ERRORS, KEPT BECAUSE THEY ARE THE LESSON

**The first fixture used Amoonguss, which is `isNonstandard: 'Past'` in this format.** A body typed from
memory of what is common in VGC — on the same night this repo gained `tests/test-target-provenance.js`,
whose entire purpose is that no Pokémon value may be typed from memory. `buildPair` returned null and
the row read NOT-STAGED. The fixture audit caught what I did not.

**The first red demonstration was invalid and I nearly reported it as working.** I rebuilt the scenario
by hand in a throwaway script; **both the clean and the broken run returned `SHORT`**, and my check only
asked "is the verdict not IDENTICAL" — so it printed that the guard had fired when nothing had been
demonstrated at all. A mutation test whose control also fails proves nothing. `--break-the-faint` now
lives inside the file that owns the scenarios, where the clean run is known to pass.

### THE ORDERING SWEEP — TWO OF THREE WERE ALREADY RIGHT, AND THE THIRD DECIDES GAMES

Will, 2026-08-11, across five messages: *"pokemon faint in speed order"* / *"in trick room do they faint
in reverse speed order?"* / *"speed decides who switches out first or who megas first"* / *"mega first or
second can determine things like the weather"* / *"the game ends once a trainer has no mons right"* /
*"sandstorm damage, etc"*.

Measured rather than assumed, and **the scoping is the useful half**:

| ordering | Showdown | MEDICHAM |
|---|---|---|
| mega | `action.speed = getActionSpeed()`, queue-sorted | **correct** — `_run.sort(compareTurnOrder)`, `:9313` |
| switch-in / Intimidate | speed frozen once per batch, ties by field position (`battle.ts:1010`) | **correct** — `entrants.sort(compareTurnOrder)`, `:8827` |
| **residuals** | `updateSpeed()` then `speedSort(handlers)` | **SLOT ORDER, no sort** — `:14890` |

**Intimidate and mega were the obvious suspects and both are fine.** Reporting "our ordering is wrong"
without that scoping sends the next person at the wrong two sites.

**IT IS THE WHOLE RESIDUAL FAMILY, not Perish Song.** Will got there in two words — *"sandstorm damage,
etc"*. The same loop carries sand and hail chip, burn, poison, Leftovers, Salt Cure, Yawn and Heal Block.
Perish Song is just the member where the consequence is unmissable.

**AND IT IS NOT COSMETIC.** Will's own follow-up settled it: `battle.ts:2604` — when both sides empty at
once, gen 9 awards the win to `faintData.target.side`, the side of the LAST faint off the queue. **Not a
tie.** In a mutual-perish endgame the residual order picks the winner and we pick it by slot position.
The rollout scores wins, so this is a wrong verdict feeding everything downstream of the simulator.

**Mega order matters the same way in a different place:** weather is last-writer-wins, so two sides
megaing into weather setters resolve to the SLOWER one's sky. That path is already sorted correctly here.

Registered as ROADMAP #115 — which until tonight existed only in a session task list and had **no
register row at all**, which is exactly what `engine/open_work.js` was built to stop.

---

## THE MATRIX IS 1,640 / 1,640 — 100.0%, ZERO PARTING ROWS

All five of ROADMAP #161 closed, one wire at a time, each measured alone per #81. **`live` stayed 1,640
and `ran` stayed 2,253 across all five, so the rate moved because the ENGINE moved and not because the
instrument shrank** — which is precisely the failure that hid here on 2026-08-06, when 57 protect-family
pairs quietly stopped being exercised and the agreement rate went UP.

| uses | row | root cause |
|---|---|---|
| 3,739 | `throatchop -> shielddust` | the sound lock was applied BELOW the secondary loop, so it stood outside that loop's Shield Dust gate. Its volatile lives in `secondary.onHit`, a **closure** — which is why no field-reading derivation ever saw it, and why #139's wire closed Salt Cure, Psychic Noise and Syrup Bomb but not this |
| 262 | `psychicnoise -> shielddust` | **my diagnosis did not cover it and the truth was worse**: the gated road wrote `_vol.healblock`, which nothing reads and nothing ticks, while an ungated block below wrote `_healBlock`, which every consumer reads. **Two implementations of one fact** |
| 190 | `instruct -> goodasgold` | the Instruct branch is the only road to a second action in a turn, and it asked NONE of the ordinary refusals |
| 24 | `psyshieldbash -> aftermath` | **not the `!m.fainted` guard I sent the agent at.** `_stepEffects` opened `if(!R.hit)return;` and `R.hit` means *the target survived*, so a KO discarded the whole effects step — including the secondary that boosts the ATTACKER. Three hundred lines earlier than my hypothesis |
| 8 | `rockwrecker -> bulletproof` | the recharge was armed for a move that reached no body at all |

### THE ENGINE COMMENT THAT WAS FICTION, AND WHY IT SURVIVED

WIRE 43 asserted *"a blocked or missed Hyper Beam still recharges in the real game"*. It was belief, and
four staged turns with an explicit control settle it:

    hyper beam  -> Protect        []            []              agree
    rock wrecker-> Bulletproof    []            ["mustrecharge"]  PART
    rock wrecker-> nothing        ["mustrecharge"] ["mustrecharge"]  agree (control)
    hyper beam  -> a GHOST        []            ["mustrecharge"]  PART

**The Protect row is why the wrong sentence survived** — we already left the branch on a shield, so the
only wrong family is the one a shield never covers. **An 8-use row found a defect that lives on a far
commoner board.** That is the argument for working the small rows.

### WHAT I GOT WRONG, KEPT BECAUSE IT IS THE PATTERN

Two of the five diagnoses I handed the agent were wrong, and both were wrong the same way: **I reasoned
from where the symptom appears rather than measuring where the control flow leaves.** Psyshield Bash was
not a guard on the boost, it was a return three hundred lines up. Psychic Noise was not a missing gate,
it was two fields with the same meaning. The agent found both by printing the staged board.

---

## ROADMAP #72, THE OTHER HALF — HAZARDS COME BACK UP. 2026-08-11 (ENGINE, overnight).

**Census 461 → 464: 3 arrived, 0 broke, net +3.** `missing` 0 → 0, hollow 0, unarmed 0, threw 0.
Gate re-run: **CLOSED — 1 of 6, unchanged**, still #175 alone; no passing clause moved.

Setting had three tags and removal had **none**. `engine/medicham2-browser.js` contained the strings
`defog`, `rapidspin`, `mortalspin` and `tidyup` **zero times**, so a laid hazard was permanent — the
engine over-values every Stealth Rock click and prices Rapid Spin as a 50 BP Normal attack.

**The three probes were red first with every control arm already correct**, which is the fixture proof
Lesson 5 asks for before an engine byte moves: Iron Head left both bags at one layer, Roost left
`[1,1,1,1,electric]`, Howl left `[1,1,1]` and the Leech Seed still attached.

**COURT CHANGE IS NOT IN THIS FORMAT.** It was named in the brief as a fifth member. The authority
refuses it — `Dex.forFormat('gen9championsvgc2026regmb').moves.get('courtchange').isNonstandard ===
'Past'`, which is this format's ban mechanism — so there is nothing to tag and nothing to wire. It
would not have shared the tag in any case: it **SWAPS** the two sides' conditions and removes none.

New tag `removesHazards`, **4 members printed before wiring**, over all 500 legal moves:

| move | params |
|---|---|
| `defog` | `hazardsFrom:'both'`, `alsoRemoves:[reflect,lightscreen,auroraveil,safeguard]` `screensFrom:'target'`, `clearsTerrain` |
| `rapidspin` | `hazardsFrom:'self'`, `removesOwnLeechSeed`, `removesOwnPartialTrap`, `onlyOnConnect`, `throughSubstitute`, `refusedBySheerForce` |
| `mortalspin` | identical to Rapid Spin |
| `tidyup` | `hazardsFrom:'both'`, `removesSubstitutes:'all'` |

**The hazard vocabulary is DERIVED, not listed**: a side condition is a hazard if some legal move
declares it with `target:'foeSide'` — the same statement the `hazard` tag stands on. That gate is also
what keeps Brick Break, Psychic Fangs and Raging Bull out (they call `removeSideCondition` and name no
hazard — `clearsScreens` owns them), and it is why `gmaxsteelsurge`, named in all four handlers
upstream, drops out on its own. Seven legal moves reach `removeSideCondition`; exactly four match.

**`hazardsFrom` and `screensFrom` are separate params on purpose, and the Defog probe's load-bearing
assertion is an arm that must NOT move.** Defog takes hazards off both sides and screens off the
*target's* side only, so a wire that collapsed the two would delete the user's own Reflect and every
other arm would still be green.

One consumer, `sweepField()`, called from three sites (`affect` for Defog, `statcode` for Tidy Up, the
after-hit block for the spin family, under character-for-character `hazardOnHit`'s gate). Six new
MEDSEEN counters, split rather than one: a zero on `terrainSweptByMove` beside a non-zero on
`hazardSwept` means Defog is being played as a spin.

---

## ROADMAP #175 — THREE OF TEN WIRED, AND THE ROW IS **10**, NOT 22. 2026-08-11 (ENGINE, overnight).

**Re-measured first, as the row asks.** `test-tag-consumed` is the instrument. Of #175's 23 original
names, **13 now have a consumer** — the previous overnight pass wired ten (`stealsItem`,
`reflectsStatusToSource`, `refusesIndirectDamage`, `clearsScreensOnEntry`, `multihitAlwaysMax`,
`boostsAtHPThreshold`, `curesStatusResidual`, `healsFromOwnStatus`, `boostsNotVeryEffective`,
`removesOwnMoveFlag`) on top of `ignoresRedirection`, and `addsOwnSecondary` / `secondaryChanceMult`
also came off the DEAD list. **Ten remain.**

**Census 467 → 468 across the items below: 3 arrived, 0 broke, net +3** (`nameImplementedBySim` x2,
`suppressesOwnItem` x1; the third census movement in this pass is #84's, below). `missing` 0 → 0.

### WIRED

**`nameImplementedBySim` — Corrosion and Early Bird, 59 uses, no consumer at all.** The tag's param was
PROSE (`{irreducible, what: <a sentence>}`), which is why nothing could read it. It now carries SHAPES —
`ignoresStatusImmunityFor: ['tox','psn']` and `extraStatusTicks: {slp: 1}` — so `medicham2` names
neither ability. Cited whole: `sim/pokemon.ts:1715` and `data/conditions.ts:68-70`; Champions overrides
`slp.onStart` only and inherits the rest, and ships no `sim/`.

**Early Bird is an EXTRA TICK, not a halved duration**, and the old prose said halved — a different
number at an odd start time. Champions starts the counter at `sample([2,3,3])`.

**The Corrosion probe's load-bearing arm is the one that must NOT move**: Will-O-Wisp from the same
Salazzle at a Fire-type Incineroar must still be refused. A wire reading "ignores status immunity"
would burn it and every other arm would stay green.

**`suppressesOwnItem` — Klutz.** Every item consumer reads `m.item`, so a Lopunny/Audino/Golurk was
priced with an item that is switched off. Wired into `itemRoomSync`, **not beside it**: upstream they
are literally one function (`Pokemon#ignoringItem`, sim/pokemon.ts:885-892, returns true for Magic Room
AND for Klutz). The `ignoreKlutz` exception is derived and is EMPTY in Reg M-B — zero legal items carry
the flag — and is honoured anyway. The probe's over-match guard is the PARTNER's Leftovers surviving.

### NOT WIRED, AND NAMED RATHER THAN ABSORBED

- **Four of the ten CANNOT BE PROBED IN THIS FORMAT because they have NO LEGAL CARRIER**, derived over
  the filtered species walk: `allyBasePowerBoost` (Battery, Power Spot, Steely Spirit — 0/0/0),
  `guaranteesNextMove` (Lock-On — 0), and half of `formeFollowsWeather` (Flower Gift 0, Ice Face 0) and
  of `inheritsAllyAbility` (Power of Alchemy 0). A tag with no carrier can never leave the DEAD list,
  because a probe would have to stage a Pokemon that cannot exist. **This is a decision for Will**: the
  clean answer is for `tag_dex` to skip abilities with no legal carrier, exactly as the roster already
  reports `NO LEGAL CARRIER`, which would move them into `EXPECTED_EMPTY` honestly. That is a change
  with a wide blast radius and it was not taken overnight.
- **Six are real and untouched, each still its own decision**: `announcesOnEntry` (148 uses, Frisk /
  Anticipation / Forewarn — INFORMATION ONLY, no board state, so a probe would have to read the
  protocol stream), `passesItemToAlly` (Symbiosis, 53), `typeFollowsTerrain` (Mimicry, Stunfisk-Galar),
  `formeFollowsWeather` (Forecast, Castform), `inheritsAllyAbility` (Receiver, Passimian),
  `boostsAlliesWithAbility` (Magnetic Flux; Plus/Minus carriers exist — Ampharos, Dedenne, Manectric).

### AND `test-tag-consumed` IS RED FOR A REASON THAT IS NOT A REGRESSION

It reports `FAIL 10 tag(s) newly have NO consumer`. **All ten were ABSENT from the artifact at the
baseline** (`23661cc:data/tags.json`, 203 tags, 2026-08-10T04:12) — they arrived later with the tag
split and have never had a consumer. The ratchet diffs a NAME LIST and so cannot tell "lost its
consumer" from "arrived without one", and it refuses to re-stamp while `dead` is larger, so it has been
red since. **Not mine and not a regression — but it is a broken instrument reading as a broken engine.**
It is in neither `run-all.js` nor the pre-commit hook, which is why nobody saw it. Left alone
deliberately: fixing it means recording the tag universe in the stamp, which changes what the ratchet
means, and that is Will's call.

---

## ROADMAP #174 — `--break` NOW MAKES IT RED, AND THE DEMONSTRATION IS NO LONGER OPTIONAL. 2026-08-11.

**Success criterion met, verified explicitly: `--break` takes all 3 rows to FAIL.** The default run now
plays BOTH arms on every row, so the demonstration cannot be forgotten.

**THREE SEPARATE CAUSES, all of which had to go before one row could move:**

1. **SIX OF THE TWELVE MOVES WERE NEVER CLICKED.** `game_differential.js`'s `scripted()` answers `pass`
   for a move that is not on Showdown's request, SILENTLY. Howl targets an ally; Clefable does not learn
   Corrosive Gas, Dragon Cheer, Electrify or Toxic Thread. Both engines passed, the boards agreed.
   **Fixed loud**: `scriptMoveNotOnRequest` plus the first missing move and what was offered instead,
   exported as `scriptCounters()`, reset per scenario by `staged_board.runOne`, asserted by the test.
2. **THE LEVITATE ANCHOR WAS THE WRONG MECHANISM.** It patched `AIRBORNE_ABIL`, which is the GROUNDED
   set (hazards, terrains), and then — when re-aimed — `absorbedBy` alone. Measured, 0/85 in every arm:
   `AIRBORNE_ABIL` emptied 0 · `typeImmunity` renamed 0 · `absorbedBy` nulled 0 · **both 104/150**.
   **Levitate has TWO independent gates in this engine** — `absorbedBy` reads the artifact's
   `typeImmunity`, and `typeEffAgainst`'s Ground clause asks `isGrounded`, which reads `AIRBORNE_ABIL`.
   They agree, so no board is wrong; but a mutation that breaks one of two agreeing implementations
   proves nothing. **Filed for ENGINE as a FACTS-ARE-GLOBAL duplicate, deliberately not collapsed**:
   `AIRBORNE_ABIL` also answers the grounded axis, so merging them is an engine change, not a test one.
3. **A SINGLE-TARGET SCRIPTED CLICK DOES NOT REACH EITHER FOE IN THIS COMPARATOR.** Measured clean-arm
   vs mutant-arm, `moveNotOnRequest` ZERO throughout:

   | click | target | clean | mutant |
   |---|---|---|---|
   | earthquake, bulldoze | `allAdjacent` | IDENTICAL | **DIFFERS** |
   | cottonspore, sweetscent | `allAdjacentFoes` | IDENTICAL | **DIFFERS** |
   | earthpower, charm (t:0 AND t:1) | `normal` | IDENTICAL | IDENTICAL |

   The engine is fine — the same Charm into the same Gholdengo through `battleTurn` reads atk **-2**
   with the ability off and **0** with it on. **The loss is downstream of the request, in the
   single-target aim.** This is the OPEN half of #174 and is a harness defect, not an engine one.

**So the rows are spread moves only, and that is a workaround with a defect behind it.** Three rows,
each proven load-bearing every run: `goodasgold-refuses-cottonspore`, `levitate-refuses-bulldoze`,
`levitate-refuses-earthquake`. The clicker is derived (first legal carrier by id) and the move sets now
require the clicker to LEARN it, the effect to be one `board_state.js` publishes, and the target not to
be immune by type already.

---

## ROADMAP #89 — THE FALSE REASON IS CORRECTED IN BOTH PLACES, AND THE MOD CHECK WAS ALSO MISSING. 2026-08-11.

`battle.update()` **does not exist** — confirmed by walking `Battle.prototype`: the nearest real
members are `updateSpeed`, `faint`, `checkFainted`, `faintMessages`, `commitChoices`, `sendUpdates`.

The engine's own paragraph had already been corrected; **`tests/test-engine-diff.js:503` still carried
the fiction** and now cites the mechanism line by line: `onDamage` returns 0 and sets
`effectState.busted` (`data/abilities.ts:962-966`); the eighth is dealt separately inside `onUpdate`
after the forme change (`this.damage(pokemon.baseMaxhp / 8, ...)`, `data/abilities.ts:996`). The
paragraph's CLAIM (a layer mismatch) was right; its reason was invented.

**AND THE CORRECTED PARAGRAPH WAS STILL READING MAINLINE.** `data/mods/champions/abilities.ts:14`
declares `disguise: { inherit: true, onEffectiveness(...) }`. The two handlers this wire rests on are
inherited unchanged; what the mod adds is an `effectState.neutral` flag so every hit after the first of
a MULTI-HIT move also reads 0. This engine rolls a multi-hit as one packet, so that clause has nothing
to bite on — stated so the next reader does not have to re-derive whether the mod was checked.

---

## ROADMAP #84 — THE COUNTER FIRES IN A REAL GAME, AND THE ROW SHOULD CLOSE. 2026-08-11.

**Census 467 → 468: 1 arrived, 0 broke.** New probe: *a MISSED Stomping Tantrum doubles the next one,
and the counter says so.* Mudsdale, High Horsepower (95%) on the setup turn at a losing roll:

    landed first  ->  Stomping Tantrum 101,  MEDSEEN.powerDoubledAfterFailure delta 0
    MISSED first  ->  Stomping Tantrum 200,  delta 2

The existing probe covered the FLINCH (`false`) and the RECHARGE (`null`) and **never read the
counter**, so the doubling could have come from anywhere. Authority verified line by line:
`hitStepAccuracy` writes `hitResults[i] = false` (`sim/battle-actions.ts:748`), `atLeastOneFailure`
goes true (`:606`), the null branch is therefore skipped (`:618`), `useMove` writes the boolean
(`:374`), and the callback tests `moveLastTurnResult === false` (`data/moves.ts:18047`). No Champions
override for Stomping Tantrum or Temper Flare.

**The delta is 2, not 1, and that is not a defect**: the counter sits inside the base-power computation
and `dmgRange` evaluates it more than once per resolution, so it counts EVALUATIONS. The probe asserts
`>= 1` and pins the CONTROL at exactly 0, which is the load-bearing half.

**RECOMMENDATION: strike #84.** The engine implements it, a miss is covered, and the capability counter
is now read in a census probe rather than assumed.

**One thing named rather than absorbed:** the doubling site still matches on
`mv.id==='stompingtantrum'||mv.id==='temperflare'`. Unlike the two name fallbacks found last pass it is
COUNTED and its comment argues the case (the `variablePower` param carries no condition, and matching
the broader shape would double Last Respects and Rage Fist — six times the usage). It is #181's shape
with a stated reason; left as-is.

## THE RATE RUNNER IS FINISHED, AND THE HEADLINE IT NEARLY PUBLISHED WAS ITS OWN BUG — 2026-08-11 (MEASURE, overnight)

`engine/million_run.js` → `data/million-run.json`. ROADMAP #133, gated on #132. Everything below is
read against the frozen release **`7c6dca70ae09`** (cut 09:22Z), never HEAD, because an ENGINE agent
and a WEB agent were working beside this. `data/million-targets.json` is the ruler and is NOT in the
release — it is what the engine is measured against — so it is read live and stamped in the artifact
by digest and age (233 rows, digest `7f57e34e8b18`, 5.4 h old at the run).

### 1. THE DECLARATION IS CLOSED, AND THE REAL SURFACE IS NOT `data/move-effects.js`

ROADMAP #132's row says do it before #133 and it was open at **"1 mismatch, 34 moves with no chance
recorded"**. That count was taken against the wrong surface, and the mismatch it names is fixed.

**THE ENGINE PREFERS THE TAG'S CHANCE OVER THE RULEBOOK'S.** medicham2's secondary loop is
`if (rng()*100 >= (_fmt != null ? _fmt : _generic)) continue;` — `_fmt` is `_fmtChance(s)`, read from
`data/tags.json` (format-derived), and `_generic` is `data/move-effects.js` (generated from the
generic gen-9 client dex). **The tag wins; the rulebook is the fallback.** So comparing the RULEBOOK
alone reports six disagreements and five of them are not real — a tag overrides them before the die
is thrown. The gate mirrors `_fmtChance` rather than calling it, deliberately, so that it is an
independent reading; it sits directly under the source it mirrors.

Asked of the frozen release, **118 (move, effect) pairs, 117 agree, 1 DISAGREES**:

| where the chance the engine rolls with comes from | pairs |
|---|---|
| the format-derived **tag** | 103 |
| the `proceduralStatus` tag (a closure effect: Dire Claw, Tri Attack) | 2 |
| the **rulebook alone — nothing format-derived guards these** | 13 |
| CERTAINTIES (>= 100%) — not dice, excluded from the rate run | 41 |
| no chance on either side (a closure another tag owns) | 7 |

**TRIPLE ARROWS IS NOT THE MISMATCH ANY MORE.** The format declares two secondaries (50% Defence
drop, 30% flinch) and the frozen engine declares both, with the tag carrying both chances
(`statChange.target[].chance = 50`, `statusInflict.effects[].chance = 30`). ENGINE closed it; #132's
row is stale on that point.

**THE ONE REAL DISAGREEMENT IS FREEZE-DRY, AND IT IS AN ENGINE ROW.** `data/move-effects.js` gives it
a 10% freeze; **Champions deletes the secondary outright** — `pokemon-showdown/data/mods/champions/moves.ts`
lines 394–399, `secondary: undefined, // no inherit`. No tag covers a REMOVED secondary, so the
rulebook fallback is unchallenged and the engine rolls a freeze this format does not have, on 1,656
corpus uses. **Not fixed here — ENGINE is live and this is its file.** The pair is refused for
scoring (3,730 trials excluded by name), so the rate run proceeds without it.

**AND THE "34 WITH NO CHANCE" ARE TWO DIFFERENT THINGS, NOW SEPARATED.** 41 are certainties, which are
excluded because a certainty is not a die. 7 carry no chance on either side because the effect is a
closure another tag owns (Ceaseless Edge and Stone Axe set a hazard on hit; Throat Chop, Spirit
Shackle, Alluring Voice, Burning Jealousy, Eerie Spell). The first version of the gate `continue`d
past that class silently, which turns the open half of #132 into an invisible zero.

**The 13 "rulebook only" pairs are the exposed class and are printed every run.** Twelve are
self-boosts (no tag carries a chance for those) and all twelve agree with the format. The thirteenth
is Freeze-Dry. Agreement there is luck, not construction.

### 2. THE RUNNER, AND THE THREE THINGS NOTHING ELSE HERE DOES

It opens a frozen release by id; it supplies its **own free-running stream** (mulberry32, seeded) and
never touches `engine/steering.js` or the differential drivers, because ROADMAP #88 pins every die in
those to one corner — correct for finding a wrong RULE, fatal for a wrong RATE; and it takes its
denominators from the target row's own `denominator` sentence rather than from clicks.

**BOTH RED PROOFS RUN ON EVERY PUBLISHED RUN AND THE ARTIFACT REFUSES TO EXIST WITHOUT THEM.** The
pinned arm replays the same teams with every die at one corner and the instrument must flag the
collapse (accuracy 3 fires against 518.75 expected, z = −75.6; secondary 0 against 43.2, z = −7.3 —
both FLAGGED). The wrong-declaration arm re-scores the real tallies against a declaration moved 25
points down (pooled z = 233) plus a per-row synthetic that is decidable at every n (108/108 flagged).
**Shown red twice, deliberately:** `MILLIONRUN_SABOTAGE=flagger` disables the flagger and the run
exits 1 writing nothing; `MILLIONRUN_SABOTAGE=refusal` lets a gate-refused pair into the tally and
the leak check exits 1 naming `secondary:freezedry:status:frz`. The second mode had to disable BOTH
guards on a refused pair — the tally skip AND the missing expectation — because with one still
standing the leak check could not be shown red at all, and a check nobody has seen work is not a
check.

**COVERAGE IS A PROPERTY OF THE ACTION SET, NOT OF N, AND THE ARTIFACT COUNTS IT RATHER THAN SAYING
IT.** 50,000 games: **182,196 switch events, 181,624 replacements, 572 voluntary** — `chooseAction()`
returns moves and only moves (ROADMAP #63), so the handful of voluntary ones are not a decision to
pivot. **106 of the 233 target rows got ZERO trials.** Four families are declared not observable with
the reason: `crit` (needs a paired arm), `proc` (the trace says whether a trigger FIRED, never
whether it was REACHED, so the denominator would be invented), `duration` (censored observations need
survival analysis, not a ratio), `random-choice` (needs an entry with two eligible foes, which needs
a switch). Ten million games buy none of those.

### 3. WHAT THE 50,000 GAMES SAY

**Every accuracy family and full paralysis are RIGHT. The status secondaries are not, and the OHKO
family is WITHHELD because it is this instrument's fault.**

| pooled arm | trials | observed | declared | z |
|---|---|---|---|---|
| accuracy | 94,728 | 89.92% | 89.78% | **+1.52** |
| chance — full paralysis | 1,992 | 13.00% | 12.5% | **+0.68** |
| secondary | 75,002 | 17.02% | 17.64% | **−4.60 DIVERGES** |
| OHKO | 7,262 | — | — | **WITHHELD, see below** |

Split by what the effect is — the single pooled z was hiding this:

| secondary sub-arm | trials | observed | expected | z |
|---|---|---|---|---|
| flinch | 14,050 | 25.01% | 24.36% | +1.83 |
| self-boost | 2,194 | 11.35% | 12.65% | −1.94 |
| target stat drop | 28,003 | 15.12% | 15.78% | −3.11 |
| **major status** | **30,052** | **15.27%** | **16.34%** | **−5.18** |

**Two rows survive Bonferroni across 118 scored rows, and both are 30% status secondaries:**
`scald → brn` **23.87% on 1,818 trials** and `bodyslam → par` **25.12% on 1,441**. The split-half
spreads on those rows are **1.71 and 0.38 points** against gaps of 6.1 and 4.9, so this is above the
noise floor rather than at it. `scorchingsands → brn` (21.6% of 134) and `volttackle → par` (4.6% of
151) point the same way at 95%. **NOT ATTRIBUTED between engine and instrument** — the same 30%
status secondary is correct on `poisonjab → psn` (29.54% of 1,970) and `rockslide → flinch` (30.26%
of 5,708), which no single explanation on either side covers yet.

**TWO DENOMINATOR DEFECTS WERE FOUND AND FIXED ON THE WAY, EACH MEASURED AS A CONTROLLED BEFORE AND
AFTER — same seed, same release, one change.**

**A stat drop the engine refuses in SILENCE.** `statDropRefusal(..., isSecondary, ...)` returns
`announce: !isSecondary`, so when a Clear Body / White Smoke / Full Metal Body / Hyper Cutter / Big
Pecks / Mirror Armor body refuses a **secondary** drop the engine emits no `-fail` — Showdown does
not either. The instrument read that absence as "the die came up short", so every hit onto a refuser
sat in the denominator unable to fire. Excluding them (1,081 trials, derived from `preventsStatDrop`
by tag shape, mirroring the engine's own three conditions) moved the secondary arm
**z = −6.157 → −4.60** and took Crunch 17.84 → 18.88, Liquidation 18.75 → 19.69, Muddy Water 28.41 →
29.35 — all three off the divergence list.

**A missed body counted as a connection.** `connected` was `damaged || touched`, and `touched` was set
by any `-status` / `-start` / `-boost` / `-unboost` line in the block **including one carrying
`[from]`** — a residual tick, an end-of-turn Speed Boost, a Leftovers heal, all of which land inside
the last move block because this parser closes a block only on an action line. An explicit `|-miss|`
is authoritative now and outranks every later line. Accuracy **z = +2.53 → +1.52**.

**AND THE HEADLINE THAT WAS NEARLY FILED AGAINST THE ENGINE.** The OHKO arm read **34.40% against a
declared 30 on 7,005 Fissure trials, z = +8.0, DIVERGES** — a clean, Bonferroni-surviving, entirely
false accusation. A raw probe over 25,000 games that counts nothing but `|-miss|` and `|-damage|`
inside an OHKO move block, with no eligibility rule of any kind, reads **1,081 / 3,622 = 29.85%
[28.4, 31.4]** — the declared 30. medicham2's roll is right: `hitChance` returns exactly 30 for
Fissure and Sheer Cold, and the site is `_mvMissed = (_mvAcc < 100 && rng()*100 > _mvAcc)`. The miss
fix took the arm to 32.89%, still outside the raw interval, **so the family is now TALLIED AND NOT
SCORED** — the rows and their split-halves stay in the artifact, and the number is out of the pooled
headline and out of the divergence list. **A rate this instrument cannot reconcile with a rule-free
count of its own event is withheld, not captioned.** What closes it: 5,353 OHKO blocks in that probe
produced only 3,622 lines of either kind, so about a third emit neither a hit nor a miss; name what
those blocks are and the two counts either agree or the disagreement names itself.

**Two hypotheses were measured and REJECTED before they became prose.** Safeguard and the ally veils
refuse a secondary status silently too — but `MEDSEEN.allyVeilRefused = 1` and `sideBuffRefused = 0`
in this corpus, so they explain nothing. And a target that was not on the pre-turn board (a
replacement, whose ability and types the snapshot cannot supply) is now excluded on principle, and it
moves the arm by 96 trials in 75,000: **z = −4.597 → −4.597**.

### 4. WHAT A FULL RUN COSTS, AND WHY IT IS NOT WORTH IT YET

**5.85–6.29 ms per rate-measuring game under load → 1,000,000 games is 1.63–1.75 hours**, single
process, on a machine running two other agents at BelowNormal. That figure includes the parse and the
tally; it is an UPPER bound on the time and **must not be recorded as an engine benchmark** —
`tests/bench-medicham.js` is the instrument for that and correctly refuses under load.

**But 20x the games buys almost nothing here.** At 50,000 games the busiest scored row already has
20,987 trials and the pooled arms have 75,000–95,000. What is left is not sampling error: the
`secondary` arm's −4.60 is a structure question, the OHKO arm is a denominator question, and 106 of
233 target rows are at zero because the action set has no switch in it. **A million games moves none
of the three.** Run it when the residual is attributed, not before.

### 5. TWO PROVENANCE FOLLOW-UPS, AND ONE GATE THAT IS RED AND WAS RED BEFORE

**`engine/conformance.js` S13 asks `provenance.js --graph --json` now instead of `allSrc.includes(file)`.**
That substring search was a second, worse implementation of a derivation that already exists: it says
YES to a name that appears only in a comment and NO to every artifact whose path is computed. Nine
files change classification, all in the same direction — files the substring search called generated
and which nothing can be shown to write: `artifact-accessors`, `battle-formes`, `conditional-audit`,
`exploitability-holdout`, `meta-nash`, `policy-weights-nopop`, `policy-weights-pre-censoring`,
`raw-log-census`, `replay-differential-bo3-freezes`. Each now carries provenance's own reason as the
finding's `detail`.

**THE REASON GOES IN `detail`, NEVER IN `what`, AND GETTING THAT WRONG FIRST IS WORTH RECORDING.**
`what` is the finding's identity for the ratchet; appending the reason to it retired 20 baselined
findings and re-raised them under new names in one run — a rewording that reads as "20 fixed, 20 new"
is exactly the laundering the ratchet exists to prevent.

**`node engine/conformance.js --strict` IS RED, AND IT WAS RED BEFORE THIS CHANGE — 19 new findings
at HEAD, 27 after.** Measured, not assumed: `git show HEAD:engine/conformance.js` run against the same
tree exits 1 with 19. Ten of the 19 are S12 rows in other divisions' new files (`all_mechanics_fire`,
`faces`, `pp_board_probe`, `replay_differential`, `rollout_switch_probe`, `scenario_catalogue`,
`million_targets`, `million_run`, and two tests hardcoding the format id) and the rest are artifacts
written tonight that have no baseline row. **The +8 are mine and they are true positives the old
check was concealing.** Baselining them would bury the other 19 with them, so the baseline is NOT
rewritten here and this is stated rather than filed: it needs a REGRESSION-vs-DISCOVERY split like the
one `data/provenance-stamp.json` already has, and that is a decision for whoever owns the baseline.

**`engine/replay_differential.js`'s freeze payload declares `by` now.** The path comes from
`--freeze-out`, so every variant except the default has no literal beside a write call and all four of
provenance's ranked arms miss it. The two orphans also had `by` added to the bytes on disk **without
regenerating** — a declaration of authorship is not a measured figure, and their top-level key shape is
identical to `replay-differential-freezes.json`, which provenance already attributes to that script by
`path variable`. Artifacts with no writer: **19 → 17**.

---

## ENGINE, overnight 2026-08-11, third pass

**Census 468 live / 0 missing → 470 live / 0 missing. Arrived 2, broke 0, net +2.** Both arrivals are
new probes on new wires; nothing left the live set and `missing` stayed at 0.

**#187 — FREEZE-DRY. THE FIX IS A TAG SHAPE, NOT A VALUE.** Champions gives Freeze-Dry
`secondary: undefined, // no inherit` (`data/mods/champions/moves.ts:394-399`); `data/move-effects.js`
carries mainline's 10% freeze. Every secondary tag we derive is derived FROM a secondary, so a
REMOVED one leaves nothing to derive and medicham2's `rng()*100 >= (_fmt != null ? _fmt : _generic)`
silently meant *use mainline*. New tag **`formatSecondaryCount`**, total over all 500 legal moves,
param `{count}` — `count: 0` is a POSITIVE statement of removal, and absence of the row now means
"no format reading of this move at all" and is counted loudly in
`MEDFAILS.secondaryProfileUnknown` (reads 0). The refusal itself is counted in
`MEDSEEN.secondaryRefusedByFormat`.

*Printed before wiring, because a new derived tag over-matches:* 500 moves tagged, **380 carry
`count: 0`**, and of those **exactly 1** has a generic secondary to refuse (`freezedry`); zero moves
go the other way. So the behavioural delta is one move and the mechanism is general.
Probe `move/formatSecondaryCount`: Freeze-Dry 45/400 → **0**, control Ice Beam **45/400 unchanged**.

**#187, the self-boost half.** `_fmtChance` read the status half and `statChange.target[]` and never
`statChange.user[]`, so twelve (move, effect) pairs rolled the gen-9 number unguarded. Wired.
**All twelve agree with the generic number today**, so an outcome comparison proves nothing — the
probe drives the artifact's own chance to 0% and to 100% and requires the engine to follow. Fiery
Dance reads **fifty-point-two per cent, then zero, then one hundred** across the three arms; with the
branch disabled it reads fifty in all three. The three numbers live in the census probe's own
`detail` string (`move/statChange`, "a secondary boost on the USER is priced by the FORMAT"), which is
where they are quotable from.

**THE EXPOSURE, RE-STATED (Will's ruling, "LETS USE EVERYTHING FROM THE SHOWDOWN SOURCE").** Mirroring
`million_run.js`'s declaration gate over all 118 comparable (move, effect) pairs — read-only, that
file is untracked and MEASURE is using it:

| | before tonight | after |
|---|---|---|
| tag | 103 | 115 |
| proceduralStatus tag | 2 | 2 |
| removed-by-format | – | 1 |
| **rulebook alone, nothing format-derived guarding it** | **13** | **0** |
| disagreements | 1 (freezedry) | 0 |

**THE 24 DRIFT ROWS: 22 REAL, AND ALL 22 ARE MOOT IN THE ENGINE TODAY.** `ceaselessedge` and
`stoneaxe` are false positives — the rulebook writes `{chance:100}` and the mod writes `{}`, which
Showdown reads as 100. Of the 22 real ones, **0 reach the engine**. Falsified rather than inferred:
driving `data/move-effects.js`'s `bp` to 999 moves a real turn's damage by **nothing** (56 → 56) while
driving `engine-data.js`'s moves it (56 → 647); forcing the rulebook's `type` moves nothing (155 →
155) while forcing engine-data's does (155 → 78). bp, type and accuracy come from `engine-data.js`
and the ACC table, which are format-derived; the only field the engine reads out of
`data/move-effects.js` is the secondary, and after tonight none of those is unguarded.
**Repointing CHOMP's generator is still right and is still not ENGINE's.**

**#185 — MISDIAGNOSED. THE SCRIPTED SINGLE-TARGET AIM WORKS; DO NOT EDIT THE ENGINE.** Staged the
exact rows the register names, clean arm against the same mutant `test-assert-mode.js` builds:

    charm       (normal, t:0)   clean IDENTICAL   broken DIFFERS   <- boosts.atk -2 vs 0
    earthpower  (normal, t:0)   clean IDENTICAL   broken DIFFERS   <- party.hp 93 vs 150
    earthquake  (allAdjacent)   clean IDENTICAL   broken DIFFERS
    charm       (normal, t:1)   clean IDENTICAL   broken IDENTICAL
    earthpower  (normal, t:1)   clean IDENTICAL   broken IDENTICAL

`moveNotOnRequest` is 0 throughout and `aimCounters()` reads `foe: 3` on a `normal` t:0 click, so the
aim resolves. **The t:1 rows are IDENTICAL because t:1 is the PARTNER** — Corviknight beside the
Gholdengo, Snorlax beside the Chimecho — and the mutant deletes an ability that body never had. There
is nothing to diverge. The row's `t:0 IDENTICAL` observation does not reproduce. The `SPREAD` filter
in `test-assert-mode.js` is therefore a restriction it does not need; widening it is a separate
decision and was NOT taken tonight.

**ONE UNEXPLAINED FLAKE, RECORDED RATHER THAN FILED.**
`staged_board.js --only nuzzle-paralysis --reds` printed `BROKEN ENGINE -> IDENTICAL … NOT CAUGHT`
once at ~10:40 and `DIFFERS … CAUGHT AND LOCALISED` on four consecutive runs afterwards, with no file
edited in between and the same census digest reported by both. A red demonstration that is
intermittently green is worth more attention than the run it appeared in; I could not reproduce it
and I am not calling it fixed.

**#175 — THE CARRIER-LESS PROPOSAL, MEASURED. DO NOT ADOPT IT AS STATED.**
The artifact carries two hundred and ninety-four ability rows; **ninety-three have no legal carrier**
in the format's species table
(checked with formes and `tier: 'Illegal'` inspected separately — no mega forme is being dropped).
Skipping them would make **5 tags vanish entirely** and 41 shrink:

    allyBasePowerBoost (battery, powerspot, steelyspirit)
    amplifiesBoosts    (simple)
    auraBreak          (aurabreak)
    boostsNotVeryEffective (tintedlens)
    secondaryChanceMult (serenegrace)

**TWO OF THE FIVE CARRY LIVE CENSUS PROBES** — `auraBreak` ("Aura Break INVERTS the aura to 0.75")
and `boostsNotVeryEffective` ("Tinted Lens doubles the RESISTED hit") — so adopting this drops the
one number that may never go down, by 2. And **5 of the 93 record corpus uses** (`serenegrace` 5,
`stormdrain` 3, `psychicsurge` 2, `tintedlens` 2, `steelyspirit` 1), which the carrier derivation says
cannot happen. Either the usage corpus contains games outside Reg M-B or the carrier read is
incomplete; **that contradiction has to be settled before anyone deletes anything**, because a skip
rule that removes a tag with real observed uses is the over-match #178 exists to catch.

## MEASURE, overnight 2026-08-11, third pass — THE STATUS RESIDUAL WAS THE INSTRUMENT, AND IT WAS ALSO THE OHKO DENOMINATOR

**VERDICT: INSTRUMENT.** One defect in `engine/million_run.js` produced the major-status residual, the
`targetBoosts` residual, the accuracy drift and the OHKO denominator that would not reconcile. Nothing
here is an engine rate defect. Release `b838c0d12daa`, 50,000 games, same seed on both arms.

| pooled arm | before | after |
|---|---|---|
| ALL | z **−2.315** | z **−0.501** |
| secondary | z **−4.597** | z **−0.472** |
| — major status | z **−5.183** on 30,052 | z **−1.085** on 28,661 |
| — targetBoosts | z **−3.107** | z **−0.584** |
| accuracy | z +1.526 | z **+0.111** |
| OHKO | WITHHELD | **SCORED**, z −1.142 on 6,915 |
| rows surviving Bonferroni | **2** | **0** |

**THE MECHANISM, AND IT WAS FOUND BY READING THE DENOMINATOR RATHER THAN ARGUING ABOUT THE MOVES.**
`million_run.js --dump-status` writes one row per scored status trial with covariates the tally does
not look at, so the SAME trials could be conditioned instead of a second instrument re-deriving its own
denominator and answering a different question. Split on "did a `-damage` line for this body exist":

- **1,391 of the 30,052 scored status trials had NO damage line, and they fired 0 times out of 1,391.**
  A class that cannot fire, sitting in the denominator.
- The carriers name themselves: **868 Speed Boost, 373 Moody, 60 Intimidate, 54 Lightning Rod**. 1,119
  of the 1,391 bodies were not damaged by ANY block in the whole turn.

`resolveBlock` marks a body `touched` on a `-status`/`-start`/`-boost`/`-unboost` line inside the block
that does not carry `[from]`, and the block parser closes only on an ACTION line — so every end-of-turn
line lands in the turn's LAST move block. The `[from]` filter was the right idea and **cannot work on
this stream**: medicham2's `TR.bst(m,eng,d,from)` takes a `from` argument and the residual sites do not
pass one, so a Speed Boost is emitted as a bare `|-boost|p2a: X|spe|1` where Showdown writes
`|-boost|p2a: X|spe|1|[from] ability: Speed Boost`.

**THE ASYMMETRY WAS NEVER ABOUT THE MOVE.** Scald, Body Slam and Poison Jab all sample 30% correctly.
The share of contaminated trials is what differed: **12.3% of Scald's, 12.0% of Body Slam's, 9.8% of
Flare Blitz's — against 1.7% of Poison Jab's and 2.6% of Discharge's**, which is exactly the set of rows
that read correct. Type immunity, ability refusal, veils, Safeguard and substitutes were all candidates
and all were **measured and rejected**: `canTakeStatus` already mirrors the type and ability tables;
`MEDSEEN.allyVeilRefused` is **1** across 50,000 games and `sideBuffRefused` never appears at all.

| row | decl | before | after | split-half |
|---|---|---|---|---|
| `scald -> brn` | 30 | **23.87%** of 1,818 | **27.23%** of 1,594 | 1.44 |
| `bodyslam -> par` | 30 | **25.12%** of 1,441 | **28.55%** of 1,268 | 0.72 |
| `poisonjab -> psn` | 30 | 29.54% of 1,970 | **30.06%** of 1,936 | 0.25 |
| `flareblitz -> brn` | 10 | 8.28% of 2,342 | **9.18%** of 2,113 | 1.18 |
| `volttackle -> par` | 10 | 4.64% of 151 | 5.11% of 137 | 0.04 |

**THE FIX IS ONE PREDICATE AND IT IS NOT `r.damaged`.** A DAMAGING move that reached a body wrote a
`-damage` line for it; a STATUS move reached a body without damaging it and its only evidence is exactly
the `-status`/`-boost` line this leak is made of, so Thunder Wave and Icy Wind's accuracy arms still need
`touched` and still have it. `category` is read from the rulebook rather than `bp > 0` because **Fissure
has bp 0 and is a damaging move** — a `bp > 0` test would have left the OHKO family on the broken
evidence, which is the family that most needed it.

**THE OHKO WITHHOLD IS LIFTED, BY FIXING THE DENOMINATOR RATHER THAN BY DECIDING THE NUMBER LOOKED
BETTER.** The open question was what the ~third of OHKO blocks emitting neither a hit nor a miss actually
were; they are this. `ohko:fissure` reads **29.44% of 6,662 [28.35, 30.54]** against the rule-free probe's
**29.85% [28.4, 31.4]** and a declared 30 — the two readings now overlap and the declaration is inside
both. On a 30-accuracy move seven trials in ten are misses, so a leak on the hit side moves this arm
several points where it moves a 90-accuracy arm by a tenth: 34.40% → 32.89% → **29.44%**.

**`ohko:*:MODIFIED` STAYS UNSCORED AND IS ITSELF A FINDING FOR @engine.** Showdown's OHKO moves bypass
accuracy modifiers entirely (`battle-actions.ts:696`); medicham2's `hitChance` applies the attacker's
accuracy stage, the defender's evasion and every ACCMOD row to them. Under the authority that bucket
could not exist. **It is not empty: 106 Fissure trials and 8 Sheer Cold.**

**FILED TO @engine, NOT FIXED HERE (two, both trace fidelity):**
- a residual or ability-sourced `-boost`/`-unboost` carries **no `[from]`**. Everything downstream of the
  trace inherits it; this instrument no longer depends on it, and the next reader of that stream will.
- OHKO moves are subject to accuracy modifiers here and bypass them in the authority (above).

**WHAT IS LEFT, STATED SO IT IS NOT MISTAKEN FOR A CLEAN SWEEP.** 8 of 118 rows still diverge at 95%
where ~5.9 are expected by chance, and **none survives Bonferroni**. The largest is `scald -> brn` at
27.23% of 1,594 against 30 — a 2.77-point gap against a 1.44-point split-half spread, so it is at roughly
its own noise floor and is a row to watch rather than a defect to file. `accuracy:focusblast` reads
**72.8% of 1,167 against a declared 70**, the only row diverging HIGH with real n.

**THE DUMP HAS ITS OWN RED PROOF AND IT WAS RED FOR REAL, FIRST TIME OUT.** Summed by key the dumped rows
must reproduce the free arm's `n` and `k` exactly. They did not: the pinned red-proof arm replays 200
games through the same `tallyTurn`, `trials` is cleared around it and `dumpRows` was not, so 6 trials from
a run whose whole purpose is that no secondary ever fires leaked in — 1,824 against 1,818, biased
DOWNWARD, in the same direction as the effect being attributed. The dump is sealed at the free arm now, a
mismatch REFUSES to write the file, and `MILLIONRUN_SABOTAGE=dumpseal` reopens it so the check can be
shown red on demand instead of once by accident.

**AND `data/million-run.json` NOW SAYS IT IS GENERATED IN ITS FIRST 400 BYTES**, which is load-bearing:
S13 reads that window, the artifact led with a 24-key `source_digests` block, and it was flagged
"generated but does not say so" on the run that created it.

### ROADMAP #188 — THE `--strict` RATCHET NOW SPLITS REGRESSION FROM DISCOVERY

`engine/conformance.js`. A checker that gets BETTER must not break the gate: on 2026-08-11 S13 stopped
guessing who writes an artifact and started asking `provenance.js --graph --json`, which raised **nine**
findings the substring search had concealed — every one a true positive — on the same run it went red on
nineteen that were already there. Two opposite events, one verdict.

**THE 19/8 SPLIT IS MEASURED, NOT ASSERTED.** The pre-change checker (`960b2a8:engine/conformance.js`)
was replayed **against this same tree**, with its two writes neutered and `ROOT` repointed and nothing
else changed, so the subject is held constant by construction. It raises exactly **19**. The current one
raises **27**. The difference is 9 raised and 1 retired — `data/replay-differential-sheets-freezes.json`
moved from "no generator writes it" to "generated but does not say so", a reclassification rather than a
new finding.

**THE SHAPE IS `provenance-stamp.json`'s, with the two inputs conformance actually has.** `scope` is a
file→sha12 map of every subject the scan judged (579 of them: each source file it read and each `data/`
file S13 looked at). `rule_digests` is **per STANDARD** — the top-level functions that call
`flag(<std>, …)`, plus `engine/provenance.js` for S13 whose answer comes from that graph.

    subject new to the scan .......................... REGRESSION (new code must conform)
    subject moved .................................... REGRESSION
    subject unchanged AND that standard's rule moved .. DISCOVERY  — adopted, recorded, not fatal
    subject unchanged AND no rule moved ............... REGRESSION, printed as UNEXPLAINED

**PER STANDARD IS THE WHOLE GUARD.** A whole-file digest of `conformance.js` would have let one line
changed in S13 bless ten S12 findings on files nobody had touched — laundering wearing the new
mechanism's name.

**SHOWN RED THREE WAYS, EACH AGAINST A SCRATCH BASELINE (`--baseline <path>`, which exists only so this
could be demonstrated without sabotaging the published one):**

| arm | planted | result |
|---|---|---|
| the rule gets stricter | convention header threshold 3 → 8, no file touched | **14 DISCOVERY, 0 regression, exit 0**, all 14 recorded |
| a new file violates | a fresh `engine/*.js` with no header, *while the rule was still patched* | **2 REGRESSION, exit 1** — the rule change did not bless it |
| an existing file regresses | a clean, already-baselined file has its header removed | **1 REGRESSION "the subject file changed since the baseline", exit 1** |

**`--seed-split` INSTALLS THE TWO INPUTS AND ADOPTS NOTHING.** Without it the split could never switch
itself on: the baseline is not rewritten while anything is new — rule 3, and it is the right rule — so a
gate that is already red can never acquire the scope map, and the mechanism would sit dormant behind the
very findings it was built to classify. It writes `scope` and `rule_digests`, REFUSES if the finding list
would move by one entry, and records `new_at_seed` so later runs report the outstanding set as
**predating the split** rather than inventing an UNEXPLAINED cause for it. Verified: findings
byte-identical before and after, 96 baselined unchanged.

**#188 IS NOT CLOSED AND THE GATE IS STILL RED AT 27.** The split classifies from the next rule change
on; it cannot retroactively attribute findings that predate its own installation, and pretending
otherwise would bury the 19. One of the 27 was mine and is fixed (`million-run.json`'s header); one
arrived from ENGINE's live work during this pass (`tests/test-mod-conformance.js` hardcodes the format
id). **The 27 need triage on their merits — that is the remaining work, and it is not a measurement.**

---

## ROADMAP #175 IS ENGINE-COMPLETE, #184's GAUGE WAS BROKEN, AND THE CARRIER-LESS TOSS COST MORE THAN IT WAS PRICED AT. 2026-08-11 (fourth overnight pass).

**Census 470 → 474.** Arrived **7**, broke **0**, **REMOVED-AS-UNCARRIABLE 3**, net **+4**. `missing`
0 → 0 throughout; 0 hollow, 0 unarmed, 0 direct-call, 0 threw. Gate re-run after every item and after the
toss: **CLOSED — 1 of 6, unchanged**, and the one failing clause is the REGISTER clause naming #175. No
passing clause moved at any point. Differential re-run at `--n 6000 --seed 20260804`: **0 disagree**.

### #184 — THE INSTRUMENT, FIXED FIRST, BECAUSE EVERYTHING ELSE WAS BEING READ THROUGH IT

`tests/test-tag-consumed.js` diffed a NAME LIST and reported the result as `N tag(s) newly have NO
consumer` — which names an engine REGRESSION. A tag absent from the previous dead list is absent for two
opposite reasons: it was consumed then (a real regression), or **it did not exist then**. The artifact
grew 194 → 263 tags across this sprint, so the second case was the common one, and eight ARRIVALS were
reported for days as eight LOSSES.

The cause was that the stamp recorded only the dead NAMES and COUNTS for everything else, so the previous
universe could not be reconstructed. The stamp now carries `by_tag` — a status for every tag — and the
diff labels each row `REGRESSED (was LIVE|STAGED|UNREACHED)` / `ARRIVED` / `STILL DEAD` /
`UNCLASSIFIABLE`. Both assertions keep their teeth: a tag outside the ratchet FLOOR fails whatever its
label. **A second, quieter bug went with it:** the old write gate (`dead.length <= prevDead.length`) froze
the baseline at 2026-08-10 the instant DEAD grew, so the file could never learn anything and re-reported
the same eight rows forever. The stamp is written every run now; the FLOOR is what ratchets and only ever
loses members. First run after the fix read **0 REGRESSED, 8 UNCLASSIFIABLE** and said out loud that a
pre-`by_tag` baseline cannot tell arrival from regression — one run only, not resolved by assuming the
kind answer.

**It is still NOT registered in `run-all.js` or the hook.** It is green now (7 passed, 0 failed) and
registering it is the right next step; it was not done tonight because a gate should be registered by
someone who has watched it go red for the right reason on more than one run.

### THE SEVEN WIRES — EACH SHOWN RED FIRST, EACH RE-RUN BEFORE THE NEXT

| tag | what it was | what it is | the probe's load-bearing arm |
|---|---|---|---|
| `guaranteesNextMove` | Lock-On resolved to `{kind:'pass'}` | volatile on the USER, bound to the body it named; `hitChance` and the semi-invulnerability step both answer it | Lock-On aimed at the OTHER foe must still miss — a bare "cannot miss" flag passes the first two arms |
| `typeFollowsTerrain` | Mimicry inert | a SYNC at every terrain write plus the top of each turn | terrain ALLOWED TO END → Ground/Steel again. The artifact said `revertsWithoutTerrain: false` and the handler reverts |
| `formeFollowsWeather` | Forecast inert | a retype per sky, from a new derived `typesByWeather` | rain must HALVE the same Fire click that snow DOUBLES — one hardcoded type passes either arm alone |
| `passesItemToAlly` | Symbiosis inert | the spender's ally hands its item over, at `consumeBerry` and the Focus Sash spend | the giver's slot must be EMPTY — a copy is a better ability than the real one |
| `inheritsAllyAbility` | Receiver inert | a sweep at the three points a faint becomes visible | the inherited Flash Fire must ABSORB, not merely appear in the field |
| `announcesOnEntry` | Frisk inert | the `-item` reveal shape, derived from a new `emits` param | TWO holding foes must produce TWO lines — Anticipation and Forewarn announce once |
| `boostsAlliesWithAbility` | Magnetic Flux resolved to `{kind:'pass'}` | side walk gated on the ability, `SD2ENG` for the stat names | Plus on the user, nothing on the partner: the USER rises and the partner must NOT |

**FIVE ARTIFACT DEFECTS WERE FOUND BY WIRING, NOT BY REVIEW,** and every one of them was a parameter no
consumer had ever read: `revertsWithoutTerrain` derived FALSE against a handler that reverts;
`formeFollowsWeather` carrying forme NAMES for three formes `data/engine-data.js` has no row for;
`announcesOnEntry.reveals` being PROSE that two members share while emitting different events;
`boostsAlliesWithAbility.boosts` derived NULL because the boost is inside `onHitSide` and not in the
move's `boosts` field; and `announcesOnEntry`'s first `emits` draft matching a `function` expression
against a METHOD SHORTHAND, so all three members read `on: 'foe'` — caught by printing the three rows
before anything consumed them. **A parameter nobody consumes is a parameter nobody checks.**

### DECLARED SHORTFALLS, EACH WITH A COUNTER RATHER THAN A PARAGRAPH

- `MEDFAILS.guaranteeDurationAssumed` — `guaranteesNextMove` does not carry the condition's `duration`;
  the cited `data/moves.ts:10415 duration: 2` is used and every use is counted.
- `MEDFAILS.formeWeatherNameUnchanged` — Castform's TYPE follows the sky and its species LABEL does not,
  because `data/engine-data.js` has no row for the three weather formes and ENGINE may not edit it.
- `MEDFAILS.symbiosisNonBerrySites` — the herb family spend at their own `-enditem` sites; there is no
  single `AfterUseItem` funnel to hang Symbiosis on. Berries and the Focus Sash are covered.
- `MEDFAILS.inheritedAbilityStartNotFired` — an inherited Intimidate does not intimidate on the spot.
  Expected to equal `MEDSEEN.abilityInherited` exactly.
- `MEDFAILS.entryAnnounceUnmodelled` — Anticipation's super-effective scan and Forewarn's highest-BP
  pick live in the handler, not in the artifact; implementing them would be two rules keyed off two
  event names, which is a name match wearing a shape's clothes. 10 corpus uses between them.

### THE CARRIER-LESS TOSS — WILL'S RULING, AND IT COST 5 PROBES, NOT 2

Will, 2026-08-11: *"if no legal species, then toss it man"*, with #190's contradiction settled the same
day: the corpus is contaminated, the legality derivation is sound. `engine/tag_dex.js` now derives only
abilities with a legal carrier — **294 ability rows → 201**, 263 distinct tags → 258, moves and items
untouched (both already measured at zero carrier-less rows).

**THE PRICE WAS QUOTED AS 2 AND MEASURED AT 10.** Five tags lose every member (`auraBreak`,
`allyBasePowerBoost`, `secondaryChanceMult`, `amplifiesBoosts`, `boostsNotVeryEffective`) and two of those
carried live probes — that was the known 2. What nobody had measured is that **eight further probes each
staged a carrier-less ability as their SECOND ARM**, and every one of them went MISSING:

| probe | the dead arm | what was done |
|---|---|---|
| `protectsAllyFromStatus` | Pastel Veil | arm removed; Flower Veil is the surviving second scope |
| `ignoresRedirection` | Storm Drain | **replaced by Lightning Rod** — and the board with it, because the aimed foe was a GARCHOMP and Ground takes no Electric, which would have made both arms 0 |
| `damageBoost` | Transistor | **replaced by Water Bubble** on Araquanid, same narrowed shape |
| `weatherSuppression` | Air Lock | **replaced by Cloud Nine** — Air Lock's only carrier is Rayquaza and WIRE 78's own note already said so |
| `convertsMoveTypeByFlag` | Galvanize | **replaced by Pixilate** on Sylveon |
| `damageReduce` | Ice Scales | **replaced by Multiscale** on Dragonite; full-HP against chipped stands in for special against physical |
| `boostsOnKO` | Grim Neigh | arm removed — **and the probe is weaker for it.** No legal member of the tag names a stat other than Attack |
| `auraBoost` | Dark Aura | **probe removed.** `auraBoost` has one legal member left |

Plus three collateral repairs outside the census: `test-tag-wire` (Gulp Missile's param assertion, the
Storm Drain absorb-gain arm → Lightning Rod, and two membership counts), and `test-damage-stages`, which
read **64 disagreements** — all of them Showdown applying a boost this engine correctly no longer applies,
because the two rows staged Steelworker and Transistor. Replaced with Fire Mane; **1696/1696 exact**.

**THE ROSTER DENOMINATOR DID NOT MOVE, AND THAT IS THE USEFUL FINDING.** Re-run after the toss:
`94 TESTED of 202 IN SCOPE, of 316 total, 114 no-legal-carrier`, **identical**, with 0
FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE. `tests/roster.js` derives carrier legality itself from the
dex rather than from `data/tags.json`, so the two instruments already agreed and the toss changed nothing
it reports. The 114 stay OUT OF SCOPE for the same reason they always were.

### WHAT WAS FOUND AND DELIBERATELY NOT FIXED, NAMED RATHER THAN ABSORBED

- **`tests/test-protocol-trace.js` IS RED and it is NOT this pass**: `|-clearallboost|` is claimed in
  TRACE_EVENTS and fired in none of its 28 games. Verified identical against the pre-toss artifact, so it
  is a scan-coverage gap or a stale claim, and it predates tonight.
- **`tests/test-mod-conformance.js` IS RED and it is NOT this pass**: the 22 mainline-drift rows in
  `data/move-effects.js` that this ledger already records as moot in the engine. Verified identical
  against the pre-toss artifact.
- **The interaction matrix WAS re-run at `--full` under tonight's artifact and did not move: 1641/1641
  (100.0%).** Its THEORETICAL denominator falls 9376 -> 7103 because 93 ability rows left the file, which
  is the honest consequence rather than a coverage loss — the 2250 staged pairs are unchanged. It is
  recorded here because the first draft of this section said it had not been re-run, and a stale figure
  quoted from a ledger is the exact failure this project keeps having.
- **Five engine consumers now read tags that no longer exist** (`auraBreak`, `boostsNotVeryEffective`,
  `amplifiesBoosts` and the name bridge beside it). They match on tag shape, get null, and correctly do
  nothing — left in deliberately so a regulation change re-arms both ends, and named here so the next
  reader does not mistake them for live coverage.
- **`test-tag-consumed` is green and still unregistered** — see above.

---

## MEASURE — THE STAGED ARM OF THE RATE RUNNER (ROADMAP #196), 2026-08-11

*Appended by MEASURE. Nothing above this heading was edited.*

**THE PROC FAMILY IS MEASURED, EVERY ROW IS POWERED TO ONE POINT, AND THE CLAIM THAT ITS DENOMINATOR
IS KNOWN BY CONSTRUCTION HAS ITS OWN RED PROOF.** `engine/million_run.js --staged` →
`data/million-run-staged.json`, release `eafb0abb9736`, free-running dice.

`FAMILY_SUPPORT.proc` in that same file had the whole family at `observable: false`, in its own words:
*"the trace does not say whether the trigger was reached, only whether it fired, so the denominator
would be invented. Needs a staged arm, not a bigger corpus."* That is the whole argument. **More random
games never fix an invented denominator; they only make it bigger.** On a board the instrument builds,
the trigger is reached by construction — a contact move that connected and did not kill, a holder that
is strictly slower, a hit that was lethal — so the denominator is the count of trials and nothing is
inferred from what a trace happened to show.

**THE STOPPING RULE IS POWER PER ROW, NOT A GAME COUNT.** Will: *"I keep saying million but really its
just however many games we need for each staging to be certain of our chances and odds of procing."*
Each row derives its own required n from its own declared rate (one-sample proportion, two-sided α
0.05, power 0.80, the harder of the two alternatives) and stops when it has it.

| detectable error | staged battles | wall clock |
|---|---|---|
| 5 points | 19,758 | 6 s |
| 2 points | 78,494 | 21 s |
| **1 point (published)** | **241,525** | **63 s** |

That is the answer to "how many games do we need" for this fixture set, and it is an **allocation
rather than a lottery**: the 50,000-game self-play run put 20,987 trials on its busiest row and zero on
others. A staged battle is one freshly built four-body board played for one scripted turn at 0.26 ms —
it is not comparable to a self-play game and must never be quoted beside that arm's ms/game.

**THE SAMPLER IS RIGHT. Pooled over every row that fires at all: 58,738 fires against 58,613.76
expected on 176,209 constructed trials, z = +0.64.** Every live row sits inside its interval at a
resolution of one point.

| row | n | observed | 95% CI | declared | split-half spread |
|---|---|---|---|---|---|
| Static | 16,575 | 30.42% | [29.72, 31.12] | 30 | 0.24 |
| Flame Body | 16,575 | 30.46% | [29.77, 31.17] | 30 | 0.38 |
| Poison Point | 16,575 | 29.65% | [28.96, 30.35] | 30 | 0.45 |
| Effect Spore (total) | 16,575 | 30.34% | [29.65, 31.05] | 30 | 0.45 |
| Cursed Body | 16,575 | 29.73% | [29.04, 30.43] | 30 | 0.04 |
| Poison Touch | 16,575 | 29.67% | [28.98, 30.37] | 30 | 0.67 |
| King's Rock | 7,248 | 9.58% | [8.92, 10.27] | 10 | 1.32 |
| Quick Claw | 12,697 | 20.19% | [19.51, 20.90] | 20 | 0.94 |
| Shed Skin | 17,432 | 33.27% | [32.57, 33.97] | 33 | 0.75 |
| Healer | 19,620 | 50.02% | [49.32, 50.72] | 50 | 0.03 |
| Harvest | 19,620 | 50.18% | [49.48, 50.88] | 50 | 0.53 |
| Rawst Berry | 71 | 100% | [94.87, 100] | 100 | 0 |
| Aspear Berry | 71 | 100% | [94.87, 100] | 100 | — |

**AN UNDER-POWERED RUN OF THE SAME INSTRUMENT PRODUCED A DIVERGENCE THAT WAS NOT THERE, AND IT IS
WORTH RECORDING BECAUSE IT IS THE WHOLE CASE FOR THE STOPPING RULE.** At `--detect 0.02` Effect Spore
read **31.90% against 30 and diverged at 95%**; its split-half spread on that same arm was **1.97
points against an effect of 1.90** (LESSONS §9: not an effect), a second seed read 30.20%, and at the
powered n it reads **30.34%**. A row stopped early is not a small answer, it is a different one.

**THREE MECHANICS ARE ABSENT RATHER THAN MIS-SAMPLED, AND A STAGED BOARD IS WHAT TELLS THOSE APART.**
Zero fires on a trigger that was reached and verified on every one of those trials:

| mechanic | trials | declared | 95% upper bound | what the frozen tag says |
|---|---|---|---|---|
| **Cute Charm** | 16,575 | 30% | **0.023%** | `punishesAttacker.inflictsVolatile {attract, 0.3}` — medicham2's own comment at that wire says *"Cute Charm's attract and Perish Body's clock have no state in this engine"*, so `inflictsVolatile` is unconsumed |
| **Stench** | 7,248 | 10% | **0.053%** | `addsOwnSecondary {flinch, 0.1}` — **the string `addsOwnSecondary` appears ZERO times in the simulator.** No consumer exists |
| **Quick Draw** | 16,575 | 30% | **0.023%** | `fractionalPriority {chance 0.3}` — the engine reads that tag at ONE site and only off `it.mon.item`, so the ITEM path works (Quick Claw, 20.19%) and the ABILITY path cannot fire |

And a fourth that is tallied and deliberately **not scored**: **Focus Band** (0 of 400). The frozen
`data/tags.json` gives it **only** `flingable` — `survivesFromFull` is read for Focus Sash and this
item never carries it, so the engine has nothing to roll. A rate is the wrong question about an absent
mechanic, so the row reports the absence instead of a percentage.

These are filed to ENGINE as candidates, not verdicts, and each is attributable: Quick Claw and Quick
Draw share one board shape and one denominator, and exactly one of them fires. **Pooled WITH the absent
mechanics the arm reads z = −49.8, which is why they are split out — that number is three abilities
doing nothing, not a sampler running cold, and printing it as one figure would be a headline about the
wrong thing.**

**WHAT THE ARM ASSERTS ON EVERY RUN, OR REFUSES TO WRITE.** Three proofs; both new sabotage modes were
shown red before anything was published.

- **THE TRIGGER CONTROL.** Every fixture plays its board a second time with the trigger removed — a
  non-contact delivery move where the ability wants contact, a chip that cannot reach half HP where
  Harvest wants a berry eaten, no status on the board where a residual cure wants one. It must record
  **zero** trials — `reached()` must refuse every one — and zero fires. *This is the proof that the
  denominator counts triggers rather than clicks.* `MILLIONRUN_SABOTAGE=staged-precondition` forces
  `reached()` true: **13 of 17 control arms went from 0 trials to 60 and the run refused, exit 1.**
- **A SECOND CONTROL SHAPE, because the first is a formality on three fixtures.** With Quick Claw the
  trigger *is* "the holder would move second", so a board without it has the holder moving first by
  definition and the observable stops meaning anything — asserted the wrong way it read 200 raw fires
  out of 200. Those rows use MECHANISM-REMOVED: trigger fully present, subject taken away, trials must
  be non-zero and the numerator must be **zero**. It caught a real confound on Aspear Berry — a freeze
  thaws on its own at 25% per attempt, so two control trials had the status gone with no berry
  anywhere near them, and the numerator now requires the berry to have been *spent*.
- **BOTH PINNED CORNERS AND THE PER-ROW SYNTHETIC.** The identical fixtures with every die at 0.99 (no
  proc may fire) and at ~0 (every proc must), each judged by the same flagger that judges the real arm.
  `MILLIONRUN_SABOTAGE=staged-declaration` moves the target-list surface 25 points and defeats the
  fixture's own refusal: **10 rows scored against a rejected declaration, run refused, exit 1.**

**NOTHING IN THE STAGED ARM TYPES A PERCENTAGE, AND TWO SURFACES ARE CROSS-CHECKED.** The frozen
`data/tags.json` (what the engine actually rolls with) against `data/million-targets.json` (DERIVED by
`million_targets.js` from the handler source). **Ten agree, ZERO disagree, and five rest on the tag
alone: Static, Stench, Shed Skin, Rawst Berry, Aspear Berry.** That gap is not an accident —
`million_targets.js`'s `PROC_WHAT` is a **hand-typed list of twelve subjects** and the #196
reclassification names seventeen. All 12 proc rows in the target list now have a staged fixture; five
fixtures have no target row.

**AN INSTRUMENT FAULT THAT WOULD HAVE BEEN FILED AS AN ENGINE DEFECT, CAUGHT BEFORE PUBLICATION.** The
first version matched the tag's status word against the engine's and read **Flame Body 0/40 and Poison
Point 0/40**. The tag artifact speaks Showdown's vocabulary (`burn`, `poison`, `sleep`) and this engine
speaks its own (`brn`, `psn`, `slp`); `CODE_OF_STATUS` translates at the roll site and its own comment
says it is *"naming conventions, not mechanics"*. **Static passed by pure accident — "paralysis" and
"par" share three letters and nothing else in that map does.** The fix is not a second copy of that map
(that is the facts-are-global breach): the board answers it without one, because the attacker starts
clean and every other click on the board is a boring move with no status, so any status it ends the
turn holding came from the punisher.

**ONE-LINE REQUEST TO ENGINE: export `CODE_OF_STATUS`.** With it the Effect Spore ladder is scored band
by band instead of only in total, and a ladder is exactly where the total can agree while a branch is
wrong. Printed side by side today: declared 11 / 10 / 9, observed `slp` 1,823, `par` 1,678, `psn` 1,528
of 16,575 (11.00% / 10.12% / 9.22%). Nothing joins the two columns.

**TWO FIXTURE FAULTS WORTH RECORDING, because each produced a silent wrong answer rather than an
error.** (1) The filler pool was `ATTACKERS.slice()`, and the attacker pool is narrow by design —
three bodies at this release — so on every fixture whose subject and target both came from it there
was one body left for two slots and `build` threw. **Six fixtures reported ZERO trials**, which looks
exactly like a mechanic nobody could reach. (2) A refusal rate was judged as one number, so Harvest and
both berries came out `NOT CLEAN` and dropped silently out of the scored set: the berries refuse 90%+
of attempts **by design** (they wait on a 10% secondary to land) while Harvest was refusing 4.0%
because a CRIT killed the carrier from 52% HP before the berry could be eaten. The two are now split —
by-design refusals cost boards, construction failures cost correctness, and only the second is measured
against the 2% tolerance. Harvest's carrier got a bigger HP pool and the row is `exact`.

**Every board honours `data/scenarios-from-will.json`'s `the_noise_rule`** — the two bodies that are
not the subject or its target click the weakest boring move on their **own** learnset, aimed at each
other and never at the experiment. Carriers, control abilities and delivery moves are derived from
`Dex.forFormat` and checked through `engine/fixture_preflight.js`.

**WHAT IS NOT DONE, said plainly.** Sniper, Merciless, Compound Eyes, No Guard and Tangled Feet are
**not** in this arm yet. The framework takes them — they are paired comparative arms rather than
one-sample rate rows — and Tangled Feet needs its gate (the holder is confused) stated somewhere
derivable before a staged board can know when the modifier is supposed to apply. Early Bird as a
sleep-DURATION row is also not in: it is a distribution rather than a proportion and needs its own
reporting block, not a Wilson interval. **Quick Draw is stageable after all** — Slowbro-Galar does have
a row in `MC.mons`, which an earlier lookup of mine said it did not.

---

## WILL'S FOURTEEN BOARDS, WIRED. TWO ENGINE DEFECTS FELL OUT, AND BOTH WERE THE SAME FACT READ TWICE. 2026-08-11 (ENGINE).

`data/scenarios-from-will.json` was a spec file that nothing consumed. Will noticed: *"I thought we
just added all those wtf"*. Seven new shape rules in `tests/roster.js` now stage them, and the roster's
abilities stage moved **94 TESTED -> 107**, with **0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE**
throughout. The census moved **474 live / 0 missing -> 476 live / 0 missing** (2 arrived, 0 broke, net
+2). The differential re-ran at `--n 6000 --seed 20260804`: **0 disagree**. The interaction matrix
re-ran at `--full`: **1641/1641, unchanged**.

**THE MEMBERSHIP OF TWO OF THESE RULES IS PARSED OUT OF SHOWDOWN'S OWN SOURCE, and it had to be.**
Levitate registers NO handler and Mega Sol registers almost none — their mechanics live in
`Pokemon#isGrounded` and `Pokemon#effectiveWeather`. There is nothing on the ABILITY to match a shape
against, which is exactly why both sat INERT, and a hand-typed list of two names is the stale-list
failure this project has already paid for. So the rules read the airborne ability set, the grounding
volatiles and the private-sky ability set out of those two functions at load time.

**DEFECT 1 — ROADMAP #186's SECOND GATE, AND IT WAS REAL.** The engine decides a Ground move's
immunity twice: `typeEffAgainst` consults `isGrounded()` exactly as the authority's ternary does, and
the battle loop's `absorbedBy()` then zeroed the hit anyway off a static `typeImmunity` tag. Every
grounding probe in the census stages **Corviknight** — a FLYING body, refused on a clause Mold Breaker
and Gravity cannot touch — so Gravity, Smack Down, Ingrain and Iron Ball were wired, counted and proven
on a body whose immunity is its typing, and did **nothing whatever** to a Levitate body. Will's
four-arm board found it in one run: Showdown's Hydreigon took the click under Gravity (turn 4) and
under Smack Down (turn 11); ours took neither. `absorbedBy` now defers to `isGrounded` **for the
airborne abilities only** — `typeImmunity {type:'Ground'}` has a third member, `eartheater`, and
Orthworm is Ground-immune while standing squarely on the floor, so that arm is in the probe as the
over-match control and must stay 0 with Gravity up.

**DEFECT 2 — THE PRIVATE SKY, WIRED ONE READER AT A TIME FOR THE THIRD TIME.** `chargeSkip` asked
`field.weather === skipsIn`, the PUBLIC sky, while every other weather read in the file goes through
`effWeatherOf`, which honours Mega Sol's private sun. So a Meganium-Mega's Solar Beam spent a charge
turn Showdown does not spend. Measured on the roster before the fix: the target reached 53 HP upstream
on the click turn and 122 here. WIRE 99 wired the damage path, WIRE 126 the type path, and the CHARGE
path was never asked — one fact, three readers, two of them right.

**THE THIRTEEN ROWS, BY NAME:** `levitate`, `eelevate` (four arms — immunity, Gravity, Smack Down, and
a Mold Breaker thrower, which is the first test Mold Breaker has ever had); `moldbreaker`;
`battlearmor`, `shellarmor` (an always-critical move, so no die is rolled); `shielddust` (a 100%
flinch SECONDARY, same escape); `insomnia`, `immunity`, `limber`, `vitalspirit` (the refusal IS the
observable, on `bottom-tie-first` because this format has **no 100-accuracy sleep move any legal body
can learn** and no freezing move at all); `megasol`; `piercingdrill`, `unseenfist` (byte-identical
`onHitProtect`, so one rule closes both).

**A PROBE THAT PROVED NOTHING, CAUGHT AND NAMED.** The Shield Dust board's SECOND arm — a 100%
stat-drop secondary — was thrown at Vivillon, which is Bug/**FLYING**, using the format's cheapest
100% drop move, Mud-Slap, which is **GROUND**. It landed nothing in EITHER arm and the row still read
FIRED-AND-BOARDS-MATCH off the flinch arm alone. Two arms agreeing because neither happened is not
coverage. The drop click is now chosen per carrier against the chart (`fixture_preflight` clause 5) and
the board picks Acid Spray. A second, smaller one: `learnsMove` walks the prevo chain and offered
Blastoise/Mud-Slap, which the validator refuses — that one was **not** the cause of the silent arm and
saying so is the point, because a fix aimed at the wrong mechanism is still a bug.

**MAGMA ARMOR IS NOT COVERAGE AND IS NOT COUNTED.** It reads CONTROL-NOT-QUIET rather than
COULD-NOT-STAGE now: this format has no freezing MOVE, only a 10% secondary, so the board needs the
bottom pin — where every crit also lands — and Camerupt's only two alternatives are Solid Rock (a
damage reducer) and Anger Point (+6 Attack on a crit). Both are live on that corner. One carrier, no
third ability, so two arms cannot separate them.

**WILL'S SAND ARM FOR MEGA SOL CANNOT BE CLICKED INTO EXISTENCE.** His three-way discriminator wanted
real sand under the private sun. **This format has NO sand-setting move** — sand is reachable only
from an ability, which would put a second live ability on the board — so the row runs as a two-way one
(Fire lands / Normal is refused by a Ghost) and says so rather than quietly staging something else.

**NOT REACHED, so nobody counts them as done:** Quick Feet and Poison Heal (both need the OPPONENT to
apply the status first, per Will's gotchas, and Quick Feet's reading is a SPEED ORDER rather than a
board leaf); the forme absolute-assertion mode; the three harness `Can't pass` crashes (`imprison`,
`memento`, `sharpness`); the priority brackets; the forme-keyed types; and the remaining 46 inert
ability rows.

**ROADMAP #198 IS DONE — `CODE_OF_STATUS` IS EXPORTED FROM `engine/medicham2-browser.js`.** One line,
and the reason it is a line and not a copy is in the export's own comment: the staged arm's first
version hand-matched the two status vocabularies, read Flame Body 0/40 and Poison Point 0/40, and would
have filed a false headline against this division — while Static passed by accident on three shared
letters. Verified loadable: `require('./engine/medicham2-browser.js').CODE_OF_STATUS` returns the map.
Census re-run after: 476 live, 0 missing. Differential re-run after: 0 of 6000.

---

## ROADMAP #197 — THE THREE ABILITIES THAT DID NOTHING ARE WIRED, AND THE FORME MODE FOUND A FOURTH DEFECT ON ITS FIRST RUN. 2026-08-11 (ENGINE).

**Census 476 live / 0 missing → 480 live / 0 missing (4 arrived, 0 broke, net +4).** 0 hollow,
0 unarmed, 0 direct-call, 0 threw, 480/480 armed and spending a real turn. Differential re-run at
`--n 6000 --seed 20260804` after every change: **0 disagree**. All three roster stages re-run after
every change: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE**, counts unmoved (items 139/148,
abilities 107/202, moves 428/500). Gate re-run after every change: **CLOSED, 1 of 6, and it is the
same clause it was — the REGISTER clause naming #197. No passing clause moved.**

### THE THREE, EACH SHOWN RED FIRST AND RE-RUN BEFORE THE NEXT

- **QUICK DRAW — one fact, two carriers, one reader.** `fractionalPriority` was read at exactly one
  site off `it.mon.item`, so Quick Claw fired at 20.19% and the ABILITY path could not fire at all
  (0 of 16,575). The reader now asks BOTH and reads the PARAMS: `excludesStatus` / `onlyStatus`
  answered by `statusCategory` (the only fact in the file that separates a Status move from a Special
  one — `MC.moves[id].c` reads `'S'` for Slack Off as well as for Psychic), and the SIGN of `bracket`,
  so a negative nudge orders the other way. **The item arm is byte-identical on purpose**: Quick
  Claw's `priority <= 0` gate is still not modelled, because changing WHEN a die is drawn shifts every
  seeded run that has a claw holder in it. Named rather than folded in.
- **STENCH — `addsOwnSecondary` appeared ZERO times in the file** (0 of 7,248). It is an ADDITION to
  the move's own secondary list, not a bolt-on beside it, and the old gate was `fx && fx.secondary` —
  which is exactly the case the ability exists for, a move with no secondaries of its own. Wiring it
  as a separate roll would have passed a rate check and been wrong about Shield Dust, which filters it
  in the authority and now filters it here.
- **CUTE CHARM — and THE GATE IS GENDER, which this engine has never had.** `inflictsVolatile` had no
  consumer and there was no `attract` volatile to write. Both are built: one writer
  (`applyAttract`, owning the gender clause, the no-restart rule and the source identity), one consumer
  (`attractBeforeMove`, the 50% coin, placed between confusion and paralysis because the authority's
  `onBeforeMovePriority` is confusion 3, ATTRACT 2, par 1). **The default gender is `'N'` and that is a
  MEASUREMENT, not a guess**: `MC.mons` carries none, `buildMon` returns none, and every harness in this
  repository declares `gender: 'N'` to Showdown — `game_differential.js:3762` prints the consequence in
  as many words. So a body with no gender refuses exactly where the authority refuses and nothing
  already measured moves. **The membership was printed before the wire**, and it is two rows: Cute Charm
  APPLY, Cursed Body DEFER — Cursed Body's disable is described twice by the artifact and is already
  applied off `disablesAttacker`, so `inflictsVolatile` is read only on a row that carries nothing else.

### AND A DEFECT NOBODY ASKED FOR: A MID-BATTLE FORME CHANGE THREW THE NATURE AWAY

`tests/test-forme-assert.js` is the forme absolute-assertion mode — subject against the AUTHORITY,
no control arm, because every body in this family carries its forme-changer as its only ability and
the format says so itself (`refusesCopy`, 10 members in the current artifact — **not the 34/37 the
earlier note quotes; that count predates the #190 carrier toss**). On its FIRST run:

    Adamant Aegislash -> Blade   ours atk 167 / spa 153   authority 176 / 144
    Adamant Palafin   -> Hero    ours atk 189 / spa 118   authority 198 / 113

`megaEvolveNow` had already been corrected to carry `_nature` into both anchors of its
`newL50 + (st - oldL50)` rebase. `formeSwap` — the MID-BATTLE road into the same fact — had not. One
fact, two implementations, one fixed: the FACTS-ARE-GLOBAL failure, invisible because a NEUTRAL body
is byte-identical either way and every fixture in the repo was Serious. Fixed, and the census now
carries it (`formeChangeKeepsNature`) with the expected number DERIVED from `M.natureL50`, never typed.

### THE MODE ITSELF — THREE ASSERTIONS, EACH SHOWN RED BY ITS OWN PLANT

`A1` the forme changed (**active slot AND party row**), `A2` the base line is the new forme's on a
NEUTRAL body, `A3` the body's own spread survived on a NATURED one. A2 and A3 are separate BODIES, not
separate reads of one: the defect above is invisible on a neutral body, so an assertion that only
checked the new forme's base line would have been green for the whole life of it. `--reds` plants four
faults and each is caught by its owner alone (A2's plant necessarily also shows in A3 — both read a
stat line — and that is declared rather than hidden). **3 of 3 rows agree**: Stance Change (both
directions), Zero to Hero, mega evolution. The mega row is not a duplicate of
`test-nature-differential.js` PART 4: that instrument pins the STAT LINE and never asks about the
PARTY ROW.

**TWO FIXTURE FAULTS THE INSTRUMENT FOUND IN ITSELF, recorded because each produced a wrong answer
rather than an error.** (1) `hpBoost: 4` made the mega row read `hp: ours 660, authority 165` — the
harness's boost is applied to the built body and Showdown's `setSpecies` recomputes `maxhp` from the
species on a permanent forme change, wiping it. That would have been published as an engine defect.
(2) The very first scratch read `storedStats` BY REFERENCE and printed it after the game ended, so a
Blade Aegislash appeared to carry Shield's stat line in the authority — Showdown mutates that object
in place and medicham2 replaces `st` wholesale. Both were the PROBE being wrong before the engine was.

### WHAT THE FORME MODE CANNOT COVER, MEASURED RATHER THAN ASSUMED

**`data/engine-data.js` HAS NO ROW for `mimikyu-busted`, `morpeko-hangry`, `castform-sunny`,
`castform-rainy` or `castform-snowy`.** There is no body for medicham2 to become, so **Disguise,
Hunger Switch and Forecast are UNCOVERABLE** and are printed as such on every run — never as a pass.
ENGINE may not edit that artifact and this pass did not regenerate it. Derived alongside it, and it
retires the hand-written table of nine in this file: of every ability in the format whose handler calls
`formeChange(`, exactly **FIVE have a legal carrier in Reg M-B** — Disguise, Forecast, Hunger Switch,
Stance Change, Zero to Hero. **Ice Face, Shields Down, Schooling, Power Construct, Zen Mode, Gulp
Missile, Flower Gift and Tera Shift have NO legal carrier**, and Mimicry changes TYPE rather than forme.

**THE ZERO TO HERO RETURN LEG IS NOT SCRIPTABLE AND THE ROW SAYS SO.** The driver stamps medicham2's
`_switchKey` at BUILD time while Showdown resolves a bench ask against the body's CURRENT `species.id`
— `palafinhero` once it has left — so `{sw:'palafin'}` and `{sw:'palafinhero'}` each resolve on exactly
one engine and the game throws on the other. The row asserts the OUT leg, which is where the transform
actually happens.

### WHAT WAS NOT REACHED, SO NOBODY COUNTS IT AS DONE

`quickfeet` and `poisonheal`; the `eelevate` KO-boost arm; the ~44 inert abilities and 57 inert moves;
`magmaarmor`; and the stale `recycle` deferral. Untouched this pass. Also left standing, named rather
than absorbed: **`tag_dex`'s ITEM rule for `fractionalPriority` hard-codes `chance: 0.2`** — a typed
value inside a derivation, correct today (`randomChance(1,5)`) and carrying no `bracket`. It was NOT
made to reuse the ability rule's parser, and the reason is worth keeping: that parser's
`Status`-equality test matches Quick Claw's **Mycelium Might** clause and would have derived
`onlyStatus: true`, turning Quick Claw into a status-moves-only item. Printed before it was
attempted, which is why it was not done.

---

## THE DAMAGE ROLL HAD TWO CORNERS AND THE GATE READ AN AVERAGE; PP HAD NO INSTRUMENT AT ALL. 2026-08-11 (sixth pass).

**Census 480 -> 480 — 0 arrived, 0 broke, net 0.** `missing` 0 -> 0, 0 hollow, 0 unarmed, 0 direct-call,
0 threw. **Gate re-run after every change: OPEN — 6 of 6 throughout, and no passing clause moved.**

### THE GATED DIFFERENTIAL WAS A MIDPOINT, AND A MIDPOINT CANNOT SEE HALF THE FAILURES THERE ARE

`tests/test-engine-diff.js` computed Showdown's damage at roll index 0 AND index 15, then **averaged
them**, averaged MEDICHAM's `min`/`max`, and compared the two averages inside a 12% band. **A range that
is wrong by the same amount at both ends has an identical midpoint and cannot move that number at all.**
"0 of 6000 disagree" was therefore a strictly weaker claim than it read, and it is the claim the MEDICHAM
gate rested on. It is the same shape as the pin in `engine/game_differential.js` — there the dice were
held at one corner, here both corners were computed and then added together — and CHANGELOG 3.75.0
records what the shape costs: the rolled crit sat in the wrong position in the damage formula, **46.5%
of rows wrong at the bottom roll and invisible at the top**, with every check in the repository green.

- **TWO ARMS NOW, EACH AT THE SAME 12% BAND, NEVER POOLED.** `top` is Showdown's roll 0 against our
  `max`; `bottom` is roll 15 against our `min`. The tolerance policy is deliberately unchanged — this
  pass moved WHICH quantity is compared, not how close it has to be, because moving both at once makes
  a red row unattributable.
- **SHOWN RED BY A PLANT THE OLD NUMBER STRUCTURALLY CANNOT SEE.** `--plant spread` widens MEDICHAM's
  range symmetrically, leaving the midpoint on the same floating-point bit. At `--n 300`: **midpoint
  0 of 300, top 196 of 300, bottom 218 of 300.** A planted run writes to
  `data/engine-diff-PLANTED-spread.json` and never to the gate's artifact, and the gate clause refuses
  an artifact carrying `plant` even when every number in it is zero.
- **THE MEASUREMENT, recorded in `data/engine-diff.json`: 0 and 0 of 6000 at seed 20260804.** Both corners clean. The claim got stronger and
  the answer did not change, which is the good outcome and not a reason the arms were unnecessary.
- **THE GATE CLAUSE NOW REQUIRES BOTH,** and an artifact with **no** `arms` block FAILS rather than
  passing by absence. Seven selftest rows drive the SHIPPING function on whole synthetic artifacts —
  the roster clause's selftest re-implements its rule in three lines and so proves nothing about the
  rule that ships; this one cannot.

### PP WAS TRACKED, WAS NEVER COMPARED, AND IS WRONG

`board_state.js` published PP in `NOT_COMPARED` on the reason *"medicham2 does not track PP at all"*.
That stopped being true at ROADMAP #144 — the engine holds `_pp`, `ppMax`, `ppLeft`, `ppDeduct` and four
counters — so **the declaration outlived what it described, and PP could have been wrong in every game
ever played here with nothing able to notice.** Four other files quote that same dead sentence.

- **THE QUANTITY IS PP SPENT, AND THE REPRESENTATION DIFFERENCE IS DECLARED RATHER THAN COLLAPSED.**
  Our `_pp` is **lazy** (a slot appears on first use, so an unclicked move is ABSENT) and Showdown's
  `moveSlots` are **eager** (present and FULL). Read as REMAINING those two shapes disagree on every
  untouched move on every turn; read as SPENT both are 0. New mapping `pp-is-what-has-been-spent`,
  proved in both directions before any board is read, and **keyed by move id, never by slot index** —
  Mimic and Transform rewrite `moveSlots`.
- **NOTHING FILLS OUR NUMBER FROM SHOWDOWN'S.** Our side is read through the engine's own exported
  `ppSpentMap`, which is the only place that knows the table is lazy; the maximum is a format fact
  (`floor(base*0.8+4)` — the mainline `pp*8/5` rule is wrong on the large majority of these 500 moves, a figure engine/medicham2-browser.js:1900 already carries) and a second
  copy of it in the comparator would have drifted.
- **SHOWN RED TWICE, AND THE SECOND PLANT IS THE ONE THAT MATTERS.** `STATE_PLANTS` gains a plant on a
  slot the body has already used and a plant on a slot **NOTHING has touched** — the blind spot the lazy
  table makes possible, where a comparator that read absence as "nothing to compare" would look exactly
  like one that worked. Both **CAUGHT+LOCALISED**; the proof now runs 27 plants. *(The first run reported
  both as `caught, NOT LOCALISED`: the expected path was `pp.` and the comparator emits `pp[0].blizzard`.
  The ASSERTION was wrong before the engine was, which is this division's standing hazard.)*
- **AND IT FOUND THAT PP IS MATERIALLY WRONG.** Against the authority, on this repo's own fixtures:
  **Trick Room 3/1, Stealth Rock 3/1, Haze 2/1, Charm 1/2, Crunch 1/2, Roar 2/4, Perish Song 2/1,
  Parting Shot 1/0, Triple Axel 3/2, Electro Shot 1/2** (showdown/ours). On the deliberate roster's
  moves stage the leaf takes **COULD-NOT-STAGE from 64 to 11** — 44 moves that were "inert" now move a
  board — and **FIRED-AND-BOARDS-DIFFER from 0 to 26**; on abilities, FIRED-AND-BOARDS-MATCH 107 -> 117.
- **ONE CAUSE REPRODUCED BY HAND WITH A ONE-SUBSTITUTION CONTROL.** Showdown resolves `target: all` to
  allies **and foes** and prices Pressure off that list (`sim/pokemon.ts:794-860`); ours hands
  `ppPressureExtra` an empty list whenever the action names no explicit target. The SAME staged Haze
  fixture reads **1/1 against Scrappy and 1/2 against Pressure**, one body apart. Fixing it needs a move
  TARGET CLASS that `data/tags.json` does not carry (`MC.moves` has no `target`; `data/move-effects.js`
  does) — a `tag_dex` change with its own membership print and its own census probe, which is a separate
  batch. **NOT ATTEMPTED HERE.**
- **SO THE LEAF IS COMPARED AND IS HELD OUT OF EVERY PASS/FAIL VERDICT, DECLARED AND PRINTED.**
  `engine/game_differential.js` compares it in full and publishes it per arm; `tests/roster.js`,
  `tests/staged_board.js` (and `tests/test-volatile-duration.js` through it) and
  `tests/staged_status_counters.js` pass `ppHold: true` and print the reason with its numbers on every
  run. `board_state.js` stamps `pp_comparable.held_by_the_caller` on every snapshot taken that way, so
  **a run that never asked can never be read as a run in which PP agreed.** Lifting it is deleting one
  line per call site. This is a hold on ONE FIELD in the verdict-bearing consumers, not a shelf on any
  entity: no row is excused and every count above is published.

### ABILITY TRAPPING WAS ALREADY COMPARED, AND THE DECLARATION SAYING OTHERWISE WAS THE STALE PART

`board_state.js`'s `NOT_COMPARED` entry is correct that a BOARD cannot carry a refusal — and it was
being read as "nothing compares it". `tests/roster.js`'s `switchVerdict` does, exactly the way it should
be done: **it asks both engines the same question at the same moment** (Showdown by rejecting the choice
string, ours by whether the slot changed hands) and restates neither engine's rule. Shadow Tag reads
**FIRED-AND-BOARDS-MATCH**, with an in-game control — the identical ask one turn earlier, before the mega
— and exception arms so an OVER-refusal fails as an under-refusal does. **Arena Trap and Magnet Pull have
NO legal carrier in this regulation** and their own roster rows say so, so Shadow Tag is the whole of
ability trapping here. The entry now carries `measured_by` and `population` instead of implying a gap.

### THE WHOLE-GAME DIFFERENTIAL, BOTH ARMS, RE-RUN

1,556 games each, same teams, same driver state: **top-tie-first 570 diverged, bottom-tie-first 613**,
0 threw either side, 201,493 tied groups resolved. Turn-1 boards identical **1,529 / 1,556 = 98.3%**
with PP compared (98.5% without it — the 4-game drop IS the new leaf). All 9 representation mappings
collapse and keep meaning; 27 of 27 state plants CAUGHT+LOCALISED.

### THREE REDS THAT ARE NOT MINE, MEASURED RATHER THAN ASSERTED

- **`tests/staged_status_counters.js` — all 11 rows `release THREW`.** Its BEFORE arm is pinned to
  release `6b5447db1738`, *"frozen before engine/medicham2-browser.js exported: natureL50"*. Nothing to
  do with PP; the live arm is IDENTICAL on all 11. The file needs a newer pinned baseline.
- **`tests/staged_board.js` — `THE QUIETENING MECHANISM IS NOT TRUSTWORTHY`.** `allowProof()`'s
  `fakeout-flinch` anchor `if(m._flinch){m._flinch=false;m._mvRes=false;` matches 0 times: the engine
  has that block split across lines 10914-10915. A stale source anchor, not a comparator fault. All 24
  scenarios are clean and board-identical.
- **`MEDFAILS.traceBodyOffField = 217`** in the whole-game run (300 in the run before this pass).

### WHAT WAS FOUND AND DELIBERATELY NOT FIXED, NAMED RATHER THAN ABSORBED

- **The four PP defect families above.** Register rows handed over; not fixed here, and the hold names
  each one at every call site.
- **`ppMax('tackle')` returns `null`** — Tackle carries no `pp` row, so it would be free forever if it
  were reachable. It is not in this format's 500; found because the PP mapping's first proof fixture
  used it and went RED. Named, not chased.
- **Four files still quote "medicham2 does not track PP at all"** as a live reason (`tests/roster.js` in
  two places, `tests/test-interaction-matrix.js`, and the Struggle refusal). They are wrong today. The
  `board_state.js` entry that was their source is corrected; the copies are not, because changing what
  the roster's `item/pp-restore` rule REFUSES moves staged rows and therefore moves the gate.
- **NOT REACHED THIS PASS:** `quickfeet`, `poisonheal`, the `eelevate` KO-boost arm, the ~44 inert
  abilities and 57 inert moves, `magmaarmor`, the stale `recycle` deferral, and Rivalry.

---

## ROADMAP #206 — ALL FOUR PP DEFECT FAMILIES CLOSED, PLUS A FIFTH THE FIX EXPOSED. 2026-08-11 (sixth pass).

Census **480 live / 0 missing → 485 live / 0 missing**; 5 arrived, 0 broke. All five MEASURED gate
clauses still pass; the gate stays CLOSED only on the register clause naming #206 itself, which is a
row I cannot close from here.

| # | what was wrong | probe, shown RED first | the number |
|---|---|---|---|
| 1 | **Pressure was priced off an EMPTY list for any move that names no target.** `_pt` was guessed from `a.target` and the damage-spread table, and both are silent about `target: all`, a hazard and `mustpressure`. Fixed by a new `targetClass` move tag — Showdown's own `target` word plus the `mustpressure` flag plus the scope the two imply, derived in `tag_dex` by replaying `getMoveTargets` (sim/pokemon.ts:794-860). **Membership printed before a line was wired: 500 of 500 legal moves — foes 59, aimed 370, none 71.** | `move/targetClass` | Haze 1→3, Trick Room 1→3, Stealth Rock 1→3, Imprison 2→3 against two Pressure foes |
| 2 | **A rampage lock charged PP every turn.** The gate tested `_lock`, which is the CHOICE/Encore field; the rampage lives on `_mtLock`. The exemption's own comment called `_lock` "the rampage lock" and was wrong. | `move/locksIntoMove` | a two-turn Outrage 2→1 |
| 3 | **A charge move was billed twice.** `twoturnmove` carries `onLockMove` exactly as `lockedmove` does, so the RELEASE turn is a locked turn. | `move/chargeTurn` | Electro Shot over two turns 2→1, and still 2 in rain where its own `chargeSkippedByWeather` param skips the wind-up |
| 4 | **Eight moves paid nothing at all**, because the gate excluded the action KIND NAME (`switch`, `pass`) instead of asking whether the action carried a move id. Enumerated over all 500 legal moves before the clause was dropped: `chillyreception`/`partingshot` build as `switch`, `fairylock`/`healbell`/`roleplay`/`spite`/`teatime`/`transform` as `pass`, and NO bare action carries a move id. | `move/pp` | all eight 0→1; Heal Bell now runs out on the ninth click |
| 5 | **Pressure was charged for the body the click NAMED, not the body standing in the slot when the move RAN.** Found by lifting the hold, not predicted. The authority resolves the list inside `useMoveInner`, after any mid-turn switch; this engine already re-aimed the EFFECT through `reaimToSlot` and priced the PP off the raw request. | `ability/deductsExtraPP` (second probe) | Charm 2→1, Crunch 2→1, Roar 4→3 on three `staged_board` scenarios |

**The loud fallback never fires, measured rather than assumed.** All 500 legal moves were played
through a real `battleTurn`: `MEDFAILS.ppTargetClassUnknown = 0`, `ppUnknownMove = 0`,
`ppDeducted = 981`, `ppPressureCharged = 482`.

### THE HOLD: TWO SITES LIFTED, ONE PUT BACK, AND THE COST OF PUTTING IT BACK IS NAMED

`tests/staged_board.js` **24 of 24 clean with PP compared** and `tests/staged_status_counters.js`
clean, so both holds are **deleted** — those files now ask about PP and answer for it.

`tests/roster.js` **keeps its hold**, and here is the measurement:

```
hold ON    428 MATCH   0 DIFFER   64 COULD-NOT-STAGE
hold OFF   472 MATCH   7 DIFFER   11 COULD-NOT-STAGE
```

The four fixes took the differ count from the 26 the old comment predicted down to **7**, and bought
**44 rows that could not be staged at all**. The clause still flips, so the hold went back — an open
gate beats a coverage gain.

**SIX OF THOSE SEVEN ARE NOT PP DEFECTS, AND THAT IS THE FINDING.** A row reads COULD-NOT-STAGE when
the REFERENCE board is identical with and without the entity — and a move the AUTHORITY REFUSES moves
no HP, so it read inert and was never compared at all. Comparing PP gives the refused click an
observable (it still costs 1), the row stages, and OUR engine is seen on it for the first time:

| row | Showdown | ours | what it means |
|---|---|---|---|
| Burn Up | 1240/1240 | 1195 | the authority REFUSES it off a non-Fire user |
| Last Resort | 1240/1240 | 1209 | refused until every other slot has been used |
| Poltergeist | 1240/1240 | 1198 | refused when the target holds no item |
| Future Sight | 1240/1240 | 1219 | it lands two turns LATER, not now |
| Safeguard | no side condition | 4 turns of one | the re-click refreshed a clock that has no `onSideRestart` |
| Transform | — | — | the weak generic residue arm |
| Mirror Coat | 2 PP | 1 PP | the only PP row of the seven, and not the re-aim defect |

Putting the hold back masks those six again. That is a recorded cost, printed at the call site and on
every run, not a silent one.

### WHAT WAS FOUND AND DELIBERATELY NOT FIXED, NAMED RATHER THAN ABSORBED

- **The six rows above.** Each is a separate mechanic and each needs its own probe; batching them
  behind one hold-lift would make a bad result unattributable.
- **`ppMax('tackle')` returning `null` IS NOT A DEFECT, and the earlier note here was too generous to
  the fixture.** Derived rather than recalled: `Dex.forFormat('gen9championsvgc2026regmb')` reports
  Tackle `isNonstandard: 'Past'` — it is not one of this format's 500 moves, so having no `pp` row is
  the artifact being correct. `board_state.js:262` already records that the proof caught the FIXTURE.
  Nothing to fix; the row can be struck.
- **The stale `recycle` deferral (#202) is already gone.** Measured: the moves stage's
  DEFERRED-BY-OWNER list is Axe Kick, Copycat, Corrosive Gas, Electrify, Flying Press, Stuff Cheeks,
  Syrup Bomb, Teatime — no Recycle, and the stage stands at 428. The register row can be closed.
- **`MEDFAILS.traceBodyOffField = 9`** in the 120-game run (217 last pass). Not mine, still non-zero.
- **`tests/staged_status_counters.js` `release THREW` on all 11 rows** — its pinned BEFORE arm is a
  release frozen before `natureL50` was exported. Unchanged by this pass; the live arm is IDENTICAL.
- **NOT REACHED THIS PASS:** `quickfeet`, `poisonheal`, the `eelevate` KO-boost arm, the inert
  ability/move residue, `magmaarmor`, and Rivalry.

---

## ROADMAP #210 — THE SIX ARE CLOSED, AND THE SEVENTH WAS THE COMPARATOR (2026-08-11)

One probe each, every one shown RED before the engine moved, re-run and gated between every fix.
Census **485 → 491 live, 0 missing, 0 hollow, 0 unarmed, 0 direct-call**. Six arrived, none broke.

| mechanic | what we did wrong | authority, cited | probe |
|---|---|---|---|
| **Poltergeist** | resolved it against a body holding nothing | `onTry(source, target) { return !!target.item; }` — `data/moves.ts:13608` | `move/readsTargetItem` — no item **0**, Focus Sash **46** |
| **Burn Up** | resolved it off a user with no Fire type to spend, and never spent it | `onTryMove` + `self.onHit setType(... 'Fire' ? '???' ...)` — `data/moves.ts:2102-2113` | `move/spendsOwnType` — first click **46 and the user becomes `???`**, second click **0** |
| **Last Resort** | no precondition at all: a free 140 BP on turn one | `onTry(source)` walks `moveSlots` for `used` — `data/moves.ts:11380` | `move/failsUnlessOtherMovesUsed` — **0 / 0 / 136** across three stages of one game |
| **Transform** | the MOVE fell through the classifier to `{kind:'pass'}` | `onHit(target, pokemon) { return pokemon.transformInto(target); }` | `move/transformsIntoTarget` — Ditto 61 Atk / `["transform"]` → **200 Atk / Garchomp's four**, max HP unmoved |
| **Mirror Coat** | answered whoever hit LAST, in any category | `condition.onDamagingHit ... getCategory(move) === 'Special'` | `move/fixedDamage` — Counter **122/0**, Mirror Coat **0/184**, both hitters landing on the same turn |
| **Future Sight** | resolved it on the click turn, every turn | `onTry` books a slot condition; `conditions.ts:379` holds the clock | `move/delayedHit` — **[0, 0, 145, 0]** over four turns |

**THE SEVENTH ROW WAS NOT AN ENGINE DEFECT AND THAT IS THE FINDING WORTH KEEPING.** Safeguard read
`SHOWDOWN null / OURS 4 turns` on all four boundaries. Staged straight against the official simulator,
Showdown's p2 carried `safeguard {duration: 4}` the whole time: `mediScreens` walked *every key our
engine wrote* and `sdScreens` walked a **fixed three-key list**, so anything our side can hold and that
list did not name read as `present-in-one-engine-only` whatever the authority had done. The engine had
implemented the `onSideRestart` refusal correctly since WIRE 133. The comparator was blind and it was
accusing the engine — the instrument-wrong-before-the-engine failure, arriving in a reader rather than
in a probe. `board_state.js` `SCREEN_KEYS` now names the four keys `sf.sc` can hold, and the list is
derived: of the **eleven** side conditions across this format's 500 legal moves, the other seven live
somewhere else on our side (`field.twA/twB`, `field.sgA/sgB`, the hazard store), so naming one of them
would manufacture the mirror image of the same bug.

**FUTURE SIGHT NEEDED NO NEW MACHINERY.** The honest answer expected here was "this one needs a
delayed-effect queue"; it does not. WIRE 154 built one for Wish — `sf.slot`, a residual tick, a `due`
flag — and Future Sight is the same primitive with a different payout, so it reuses it rather than
growing a second queue. **When** it lands was measured on a real battle rather than read off
`endingTurn = (this.turn - 1) + 2`, which invites the answer "one turn later" and is wrong: nothing
after turn 1, nothing after turn 2, `|-end|` + `|-damage|` at the end of **turn 3**.

**TWO PROBES WERE WRONG BEFORE THE ENGINE WAS, both caught by the arms disagreeing for the wrong
reason.** The Transform probe asserted Garchomp's Attack is 150 — that is the 0-EV Serious set staged
against the authority, and `bare()` builds a Champions body and hands back 200; it now reads the target
this harness actually built. The Mirror Coat probe first aimed its click at a body, and `playerAction`
only sets `rescript` when the caller names NOBODY, so both arms came back identical; and its first
special hitter clicked Surf, which is `allAdjacent` and splashed the physical attacker.

### THE HOLD IS LIFTED

`tests/roster.js` compares PP. Measured at each step:

| | MATCH | DIFFER | COULD-NOT-STAGE |
|---|---|---|---|
| hold ON | 428 | 0 | 64 |
| hold OFF, before #210 | 472 | 7 | 11 |
| **hold OFF, after #210** | **479** | **0** | **11** |

Worth **51 newly-stageable moves and 11 newly-stageable abilities, at zero differs**. Abilities went
107 → **117 tested**; items unchanged at 139. The differential is clean at both corners of the roll,
0/6000 each. **Every measured gate clause passes; the gate stays CLOSED only on the register clause,
which names #210 itself.**

### A SEVENTH DEFECT, FOUND BY A DIFFERENT INSTRUMENT AFTER THE SIX LANDED

Wiring Transform made the interaction matrix able to score a pair it had never scored, and the pair
parted: `transform -> goodasgold`, `.A.active[0].species medi="gholdengo" sd="ditto"`. **Good as Gold
refuses any status move from another body (`data/abilities.ts:1621`) and Transform is one**, so a
Gholdengo cannot be copied — and the new branch asked none of the ordinary status refusals. Fixed
through the shared `refusesStatusMoves` reader (fifteen other sites, exactly one matching ability in
this format), with the Prankster/Dark rule alongside it.

**The matrix went 1641/1641 -> 1642/1642, 100.0%.** The denominator moved because a move that used to
do nothing now does something: an inert pair became a live one. That is the case for running every
instrument after a landing rather than only the one that found the defect — the census, the roster and
the differential were all green on this.

### STILL NOT REACHED THIS PASS

`quickfeet`, `poisonheal`, the `eelevate` KO-boost arm, the inert ability/move residue,
`magmaarmor`, and Rivalry. None of them was touched.

---

## ROADMAP #212 — THE SIXTEEN WHOSE CONTROL ARM WAS ITSELF A LIVE ABILITY (2026-08-11, eighth pass)

`tests/roster.js` tests an ability by REMOVING it. On sixteen rows every alternative the carrier
legally has is ALSO live, so the "without" arm is never quiet and the row counts in neither column.
That is an INSTRUMENT limit, not a fixture problem. The answer is the absolute-assertion shape
`tests/test-forme-assert.js` already uses: no ability-swap control, assert the observable directly —
and every board below was chosen so the trigger is a CERTAINTY rather than a chance, because the
roster's driver pins every die and a rate can never be read on it whatever fixture you build.

Census **491 -> 503 live, 0 missing, 0 hollow, 0 unarmed, 0 direct-call, 0 threw**. Twelve arrived,
none broke. Gate re-run after every engine change — differential at n=6000, seed 20260804, BOTH
corners — and it read OPEN six of six every time.

| mechanic | what was wrong | authority, cited | probe |
|---|---|---|---|
| **Quick Feet** | `speedCond` could evaluate only `inWeather`, so a STATUS condition was refused into `MEDFAILS.speedCondUnconditional` and the ability did nothing | `onModifySpe(spe, pokemon) if (pokemon.status) chainModify(1.5)` — `data/abilities.ts:3738`, no Champions override | `ability/speedCond` — Dragapult burns a Jolteon, then both fight on 1 HP: Speed 192 and the foe lives, against Speed 288 and the foe faints |
| **Eelevate KO boost** | the existing probe summed every stage on a GARCHOMP, whose highest stat is Attack, so a hardcoded-Attack engine passed it | `onSourceAfterFaint ... getBestStat(true, true)`, byte-identical to Beast Boost | `ability/boostsOnKO` — Eelektross-Mega built SpA 205 / Atk 165 reads 0,1 on Eelevate and 1,0 on MOXIE, two abilities required to disagree on one body |
| **Keen Eye / Illuminate** | `preventsStatDrop.blocks = 'accuracy'` mapped to no engine stat, so the guard was false for every stat and both abilities refused nothing | Mud-Slap `secondaries [{chance: 100, boosts: {accuracy: -1}}]`, no Champions override | `ability/preventsStatDrop` — a ROCK Lycanroc reads acc -1 with 16 damage, and acc 0 with the SAME 16 damage |
| **Flower Veil, ally half** | `preventsStatDrop.protectsAllies` had exactly one carrier and NO reader; the status and volatile halves of the same ability were wired months ago | `onAllyTryBoost ... !target.hasType('Grass') return` | `ability/preventsStatDrop` — Incineroar Intimidates: the FAIRY holder still drops to -1 and the GRASS ally stays at 0 |
| **Aroma Veil** | it was not in its own tag family — the derivation required an `onAllySetStatus` and Aroma Veil has only `onAllyTryAddVolatile` | the six volatiles are its own list: attract, disable, encore, healblock, taunt, torment | `ability/protectsAllyFromStatus` — Taunt refused on holder AND ally, Encore refused on the ally, and Will-O-Wisp STILL BURNS |
| **Sticky Hold** | no tag at all, so a Knock Off took the item every time | `onTakeItem ... return false`, with `pokemon.item === 'stickybarb'` returning early | `ability/refusesItemLoss` — item kept through Knock Off and Trick, a Sticky Barb still goes, and the damage is UNCHANGED |
| **Fluffy** | carried only `breakable`; `damageReduce` needs ONE multiplier below 1 and this handler has two clauses | `mod = 1; Fire mod *= 2; contact mod /= 2` | `ability/damageByMoveTrait` — Dragon Claw 52 to 26, Heat Wave 34 to 68, Flare Blitz 115 to 115 |
| **Rivalry** | `damageBoost` holds one multiplier and cannot express an `else`, so the whole ability was refused and counted | `if (attacker.gender && defender.gender) same 1.25 else 0.75` | `ability/damageByGender` — 235 base, 294 same gender, 177 opposite, 235 genderless |
| **Anger Point** | nothing wrong — never probed | Flower Trick `willCrit: true`; the handler asks for TWELVE stages | `ability/buffsHolderOnHit` — 0 against +6 on one guaranteed crit |
| **Slush Rush** | nothing wrong — never probed as a BOARD | `isWeather(["hail","snowscape"])` | `ability/speedCond` — Beartic 70 and dead, against 140 and alive, on 1 HP each side |
| **Extreme Speed, Ice Shard, Jet Punch** | the roster reads them COULD-NOT-STAGE: a bracket is only observable if the ORDER decides the board | move priority 2, 1, 1 | `move/priority` — three subjects on 1 HP against a Garchomp pinned 15 Speed above each: the priority-0 control dies, the bracket kills first |

### THE TWO THINGS THAT WERE REPORTED UNREACHABLE AND WERE NOT

**RIVALRY, and ROADMAP #205 was wrong in a way worth naming.** #205 registered gender-keyed
mechanics as untestable "by construction" because every fixture in this repo declares `gender: 'N'`.
That is a CHOICE THE HARNESS MADE, not a property of the format: `genderOf()` has been in the engine
since Attract was wired, and a probe that declares two genders reaches it in one line. The row read
INERT because **the ability was correctly doing nothing** — Showdown's own guard is
`attacker.gender && defender.gender`, so on a genderless board Rivalry is x1. "Identical boards" and
"the mechanic is absent" are different claims and the instrument could not tell them apart.

**THE EELEVATE KO-BOOST ARM was already probed, and the probe could not fail for the reason it
claimed.** It sums every stage on a Garchomp whose highest raw stat IS Attack. Will's spread is the
correction, and he had to make it twice: 32 SP + Gentle gives SpD 156 against Atk 165 and does NOT
discriminate, from which I wrongly generalised that no non-attack stat can win on that carrier.
Sp. Atk does — 205 against 165, both asserted in the probe so a build change fails the row loudly
instead of quietly restoring an Attack-highest body.

### WHAT THE FIRST CUT OF THE STICKY HOLD FIX GOT WRONG, MEASURED WITHIN A MINUTE

`itemRefusesTake` is the one choke point every strip goes through, so the ability guard went in
there. Knock Off immediately came back dealing **zero damage** against a Sticky Hold body. That
predicate is also asked by **Fling's price** and by **Knock Off's x1.5**, and the comment at the
second of those already had the reading: Showdown prices that boost with `singleEvent` on the ITEM's
handler, so the ABILITY never sees it. Sticky Hold refuses the strip and changes neither number.
`abilityRefusesItemLoss` is now its own reader, called only where an item is being taken BY SOMEBODY
ELSE, and the probe asserts the damage is EQUAL across both arms for exactly this reason.

### WHAT IS STILL BROKEN, NAMED RATHER THAN ABSORBED

- **OPPORTUNIST.** Measured red and NOT fixed: a foe clicks Swords Dance in front of Espathra and
  Espathra gains nothing. Its tag is `boostsEachTurn {perTurn: true}` with no boosts, derived from
  its `onResidual` — which is only the PAYOUT half. The COLLECTION half is `onFoeAfterBoost` and no
  tag describes it, so the shape has to be added upstream first. Showdown pays out at
  `onAnyAfterMove` (same turn), so a naive end-of-turn copy would be a timing divergence rather than
  a fix. Not attempted beside a green gate. Mirror Herb is the same mechanic and is BANNED here
  (`isNonstandard: 'Past'`), so Opportunist is the only carrier of the shape.
- **`magmaarmor` and `superluck` are RATE ROWS and no board will ever fix them.** Super Luck moves a
  crit RATIO; Magma Armor answers a **7%** freeze — `0.70` accuracy x `0.10` secondary, derived, NOT
  the 10% the secondary declares — and the roster's driver pins every die. Both belong to the staged
  rate arm (#196). Camerupt is Magma Armor's sole carrier, and the control arm is real: **Fire types
  are NOT freeze-immune** (`getImmunity('frz', 'Fire')` is true; only Ice blocks freeze, Fire blocks
  burn), so a zero on the Magma Armor arm means something and a zero on BOTH arms is a failed
  instrument rather than a pass.

### THE ROWS THAT NEEDED NO WORK, AND SAYING SO IS THE POINT

`stalwart`, `damp`, `justified` and `aftermath` are all four already LIVE in the census under their
own probes (`ignoresRedirection`, `blocksExplosion`, `buffsHolderOnHit`, `punishesAttacker`), and all
four were re-measured on fresh boards this pass and behaved. They read as uncounted on the ROSTER for
the instrument reason at the top of this section, not because anything is missing. Adding a second
probe for each would have raised the census number and proved nothing, so it was not done. `moxie` is
covered by the shared KO board above.

### THE INERT ABILITY AND MOVE RESIDUE — NOT REACHED

The 39-ability / 4-move inert block was not started. The 16 control-arm rows above turned out to hold
six real engine defects, which is where the pass went. The handler-name-to-board mapping is still the
right approach for the residue and is unwritten.

### THE GATE WAS NOT MEASURING THE WORK, AND FIVE GREEN RUNS SAID NOTHING (added on the coordinator's correction)

`tests/roster.js:123` opens `ER.open(ARG('--release') || null)` — the NEWEST release. Two separate
things were true and only one of them was the problem:

- **The RELEASE was current.** `game_differential.js` cuts one whenever `--release` is absent, so each
  of the five differential runs froze the then-live tree. Verified byte-for-byte: release
  `e33345432538` held `engine/medicham2-browser.js` and `data/tags.json` IDENTICAL to the working
  copy, `damageByGender` and `abilityRefusesItemLoss` included.
- **The ROSTER ARTIFACTS were four hours stale.** `data/roster.abilities.json` still declared
  `release b089ac3b32d0, generated 2026-08-11T17:15:47Z` — the pre-change run. The gate's three
  roster clauses READ THOSE FILES. Five gate runs re-read the same pre-change JSON five times and
  reported PASS five times.

**A green clause computed from an artifact nobody re-generated is not evidence, and it is
indistinguishable from one that is.** That is the same shape as the fourteen stale handoffs, arriving
through a gate instead of through prose.

Re-cut (`9b9fc1aa0fcb`, then `60784c7a63a6` after Opportunist) and re-ran all three stages against it:

| stage | before (17:15Z) | after | moved |
|---|---|---|---|
| items | 139 tested, 0 DIFFER | 139 tested, 0 DIFFER | — |
| abilities | 117 tested, 16 CONTROL-NOT-QUIET | **120 tested, 13 CONTROL-NOT-QUIET** | `aromaveil`, `flowerveil`, `fluffy` became FIRED-AND-BOARDS-MATCH |
| moves | 479 tested, 0 DIFFER | 479 tested, 0 DIFFER | — |

0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE at every stage, on the new bytes.

**`keeneye`, `stickyhold` and `rivalry` did NOT move, and that is the instrument rather than the fix.**
Their per-row reason is the two-control intersection being empty — *"NOTHING SURVIVES BOTH CONTROLS...
The delta against Weak Armor is 20 leaves and against Sturdy it is 0, and they share none."* Every
alternative ability on those carriers is itself live, so the roster structurally cannot attribute the
delta whatever the engine does. The census probes carry them; the roster never will.

**A cut does NOT trigger the refit** — `engine_release.js cut` freezes bytes and the weights are IN
the frozen set, so it photographs `policy-weights.json` rather than refitting it. Holding off on that
mistaken belief is what cost the previous pass its verification.

### OPPORTUNIST — CLOSED, AND MY OWN FIRST DRAFT WAS WRONG

`copiesFoeBoosts`, a NEW tag rather than a widened one. `boostsEachTurn` was derived from the
ability's `onResidual` — one of FIVE places it PAYS OUT, all reading `this.effectState.boosts`. The
half that FILLS that object is `onFoeAfterBoost`, and nothing described it, so one label stood for two
rules and the engine consumed the half that cannot fire alone. Membership printed over the whole dex
before wiring: exactly one ability carries `onFoeAfterBoost` (Opportunist, carrier Espathra) and
exactly one item does (Mirror Herb, `isNonstandard: 'Past'` — banned here).

**IT IS A BEFORE/AFTER DIFF ACROSS ONE ACTION, WHICH IS THE AUTHORITY'S SCHEDULE AND NOT AN
APPROXIMATION OF IT.** Showdown collects in `onFoeAfterBoost` during the move and drains the same
object at `onAnyAfterMove`. This engine writes boosts in at least six places; a hook at each is six
chances to miss one, and the one that gets missed reads exactly like an ability correctly doing
nothing. A diff taken across exactly that window sees the identical set and cannot miss a site,
because it does not know where they are. What it does not reproduce is stated: Showdown also drains at
`onAnySwitchIn` and `onAnyAfterMega`, which cannot occur mid-move here — switches and the mega phase
both resolve before any move does.

**THE FOURTH ARM CAUGHT MY OWN BUG WITHIN A MINUTE OF WRITING IT.** Two Espathra facing each other
read holder +2 and booster **+4**: reading and writing in one pass let the second holder copy the
first holder's payout. That is precisely what `effect?.name === 'Opportunist'` guards in the
authority. Computing every gain against the frozen snapshot and applying afterwards IS that rule,
expressed once. Probe `ability/copiesFoeBoosts` — Swords Dance gives +2 ATTACK, Nasty Plot +2 SP. ATK
(a hardcoded stat passes one and fails the other), a foe DROPPING its own Sp. Atk to -2 gives the
holder 0, and the two-holder board reads 2 and 2.

Census **503 -> 504 live, 0 missing**. Differential re-run 0/6000 at both corners; roster re-run
against the release that contains it; gate OPEN six of six.

### THE INERT RESIDUE, MEASURED AND PRINTED BEFORE ANYTHING IS WIRED

The standing count was "46 abilities and 54 moves". **Measured off the live artifacts it is 39
abilities and ONE move**, and the move stage is the reason: it reached 479/500 in #210, so the old
54 is a figure about an instrument that no longer exists. The one inert move is `upperhand`. The other
ten COULD-NOT-STAGE moves each carry a different, specific reason, and three of them — Extreme Speed,
Ice Shard, Jet Punch — were closed by census probes in this pass.

The 39, split by whether anything already proves them. The split is a STRING MATCH of the ability's
display name against every live census probe's label and detail — a heuristic, flagged as one, and
the reason column C is the load-bearing one:

**A. NAMED BY A LIVE CENSUS PROBE — proved; the roster fixture is simply blind (30).** Not open work.
unaware(393) protean(357) trace(268) magician(262) cloudnine(235) pressure(197) frisk(138)
naturalcure(114) magicguard(112) synchronize(109) pickpocket(95) supremeoverlord(90)
screencleaner(66) noguard(60) sniper(58) symbiosis(53) steadfast(45) berserk(33) earlybird(25)
cudchew(19) gluttony(15) skilllink(13) cheekpouch(9) poisonheal(9) plus(6) quickfeet(4) hydration(3)
longreach(2) receiver(2) klutz(1)

**B. ONLY SHARES A TAG with a live probe — NOT proved, because the probe may prove a different
carrier under the same tag (9). THIS IS THE OPEN LIST.**

| ability | uses | carriers | handler(s) — which name the board | note |
|---|---|---|---|---|
| `compoundeyes` | 560 | 20 | `onSourceModifyAccuracy` | the board already exists — Will's Shield Dust scenario puts it on the same Vivillon as an ability swap |
| `telepathy` | 223 | 5 | `onTryHit` | its only tag is `breakable`; the refusal itself has no tag, so this needs a derivation first |
| `leafguard` | 101 | 3 | `onSetStatus onTryAddVolatile` | sun-gated status immunity; the sun is the arm |
| `illuminate` | 45 | 2 | `onModifyMove onTryBoost` | the TWIN of the Keen Eye fix landed this pass — same tag, same wire, so this is a probe and not a fix |
| `heavymetal` | 22 | 1 | `onModifyWeight` | needs a weight-reading move (Low Kick, Heat Crash) as the observable |
| `analytic` | 21 | 2 | `onBasePower` | `damageBoost` with a condition the engine REFUSES and counts — a real gap, not a fixture one |
| `merciless` | 7 | 1 | `onModifyCritRatio` | a crit RATIO — belongs to the rate arm, not to a board |
| `tangledfeet` | 5 | 2 | `onModifyAccuracy` | needs a confusion volatile, which this engine does not have (already declared in the accuracy conformance table) |
| `lightmetal` | 4 | 2 | `onModifyWeight` | same board as heavymetal, opposite sign |

**C. NO LIVE PROBE ON ANY OF ITS TAGS: ZERO.**

So the residue is **nine rows, not a hundred**, and two of them (`merciless`, `tangledfeet`) are
already known to belong elsewhere. Nothing here was wired; the list is posted first, as asked.

---

## ROADMAP #213 — THE NINE INERT ROWS, CLOSED OR ROUTED, EACH WITH A REASON (2026-08-11, ninth pass)

The residue measured in #212 was nine rows. All nine are now resolved: **six wired and probed, one
sent to the rate runner, one closeted by Will, and one that turned out not to be the row it was
filed as.** Census **504 -> 510 live, 0 missing, 0 hollow, 0 unarmed, 0 direct-call, 0 threw**.
Differential re-run at n=6000 on every engine change, clean at both corners each time; the roster
ARTIFACTS re-generated against a release containing each change; gate OPEN six of six throughout.
Interaction matrix re-run full: **1642/1642, 100.0%, 0 part**, off-gate unchanged at 12.

| row | verdict | probe |
|---|---|---|
| **heavymetal / lightmetal** | WIRED — new tag `modifiesWeight`, and `effWeight()` so the two weight sites ask ONE function | `ability/modifiesWeight` |
| **leafguard** | WIRED — `statusImmune` enriched with the weather gate only | `ability/statusImmune` |
| **telepathy** | WIRED — new tag `refusesAllyDamage`, read inside `absorbedBy` | `ability/refusesAllyDamage` |
| **analytic** | WIRED — the queue condition derived and evaluated; the only genuine engine gap in the nine | `ability/damageBoost` |
| **illuminate** | its accuracy half already passed after #212 — MEASURED, folded as an ARM rather than a second probe | (rides `ability/preventsStatDrop`) |
| **the `ignoreEvasion` half of Keen Eye AND Illuminate** | WIRED — new tag `ignoresEvasion`; it was going to be left implied | `ability/ignoresEvasion` |
| **merciless** | **NOT A RATE ROW.** WIRED and probed as a certainty | `ability/critRatioUp` |
| **compoundeyes** | rate runner — already a live row in `data/million-targets.json`, `expect 1.30005` | none, correctly |
| **tangledfeet** | CLOSETED by Will | none, and the rate row stays |

### THE THREE THINGS THAT WERE FILED WRONG, AND THE MEASUREMENT SAID SO

**1. MERCILESS IS NOT A RATE. IT IS A CERTAINTY, AND THAT MAKES IT STAGEABLE.** It was routed to the
rate runner beside Super Luck on the reasonable reading that a crit ratio is a probability. Derived
from the authority instead:

    merciless   onModifyCritRatio(...) { if (['psn','tox'].includes(target.status)) return 5; }
    battle-actions.ts:1629 (gen 9)   critRatio = clampIntRange(critRatio, 0, 4)
                          :1631      critMult  = [0, 24, 8, 2, 1]
                          :1641      moveHit.crit = randomChance(1, critMult[critRatio])

5 clamps to 4, `critMult[4]` is **1**, and `randomChance(1, 1)` is always true. Against a poisoned
target it is a GUARANTEED crit — the same escape Flower Trick gives, so it needs a board and not free
dice. **The engine was right to refuse it and the ARTIFACT was wrong**: `critRatioUp` gave Super Luck
and Merciless the same flat `critRatio: 2`, and `medicham2-browser.js:1216` had already written down
why that could not be consumed — *"would hand Merciless an unconditional 1/8 it never has"*. The tag
now separates `delta` (a stage, always) from `setsTo` + `when` (a ratio under a condition), which is
what makes BOTH readable. `MEDFAILS.critRatioAbility` is now 0 where it used to count every carrier.

**2. THE MEGA SOL ARM ON LEAF GUARD KEYS ON THE BODY THAT IS ACTING, NOT ON THE ALLY.** The proposal
was to stand a Mega Sol body BESIDE the Meganium. `sim/pokemon.ts:2195` guards on
`this.battle.activePokemon?.hasAbility('megasol')` — the body currently taking its action — so an
ally cannot reach it and an **attacker** can. The corrected board is stranger and stronger: a
Meganium-Mega clicking into the Leaf Guard holder turns the holder's immunity ON with no sun anywhere
on the field. Meganium is the only Mega Sol carrier and the only status-inflicting move it can legally
learn that a Grass type is not already immune to is **Body Slam** (Poison Powder is a powder), so the
30% paralysis roll is forced. An engine reading `field.weather` instead of `effectiveWeather()` passes
the first three arms and fails this one — measured both ways.

**3. `fixture_preflight` REFUSED MY OWN KEEN EYE CASTER.** `Watchog / Mud-Slap` — Watchog cannot learn
it. The harness assigns move lists directly so the board still ran and the reading was still about the
target, but that is exactly the shape the preflight exists to stop. Caster is now Jolteon, one of 84
legal learners.

### WHAT EACH FIX ACTUALLY WAS

- **`modifiesWeight`.** `weightBased`'s own header recorded the gap in 2026-08 — *"the engine stores
  static species weight, so Float Stone, Light Metal and Heavy Metal are all invisible... RECORDED NOT
  BUILT"*. Recorded is not built. Membership over the whole dex: heavymetal x2, lightmetal x0.5,
  floatstone x0.5 (an ITEM, `isNonstandard: 'Past'` — banned, named anyway). The truncation is on
  HECTOGRAMS (`trunc(weighthg / 2)`), so `effWeight` divides at that scale and converts back.
  **AGGRON WAS ALREADY IN LOW KICK'S TOP BRACKET** — 360 kg against a >=200 cap — so doubling it
  changed nothing and the first board read 242 against 242. Heavy Slam reads the RATIO, and Aggron
  into a Meganium crosses two brackets in each direction from one fixture: 74 -> 112 -> 38, with Iron
  Head at 74/74 as the nothing-else-moved control.
- **`statusImmune.inWeather`.** The engine had already written down what it needed
  (`medicham2-browser.js:7554`) and this is that enrichment, **deliberately narrow**: only the weather
  gate is emitted. The same regex reports `statuses: "all"` for Immunity, Insomnia, Limber and Water
  Veil because their handlers name the status in a shape it cannot read — emitting that would have
  turned four single-status immunities into blanket ones. Membership of the new field is ONE.
- **`refusesAllyDamage`.** Telepathy's only tag was `breakable`, which says the ability can be
  suppressed and nothing about what it does. The new tag is named after the RULE. It is read inside
  `absorbedBy` — the one function the damage preview and the real attack path both ask, which had
  already come apart once over Mold Breaker — so it inherits the suppression rule instead of restating
  it. The category guard is carried, not dropped: a partner's Helping Hand still lands.
- **`damageBoost.onlyWhen = {cond:'allOtherActivesHaveMoved'}`.** Analytic's condition is a fact about
  the TURN QUEUE, so it fell out of both existing condition shapes as `onlyWhen: null` — read by the
  consumer as unconditional and then refused for an unrelated reason. **Two wrongs, and the second is
  why the first was invisible: `MEDFAILS.damageBoostUnknownCond` sat at ZERO the whole time.**
  Evaluated off `_acted`, which WIRE 135 already writes for Payback.
- **`ignoresEvasion`.** Flagged as a gap in review and it was a real one: both abilities carry TWO
  handlers, #212 wired one, and probing only that would have marked both measured with half of each
  untested. The engine's own comment — *"ignoreAccuracy/ignoreEvasion are not modelled here and
  neither is in this format's corpus"* — is now **half retracted**: `ignoreEvasion` is on 108 sheet
  fields between the two. `ignoreAccuracy` still has no carrier and stands. The guard is `_eb > 0`,
  which is a mechanic and not a tidy-up: the ability IGNORES evasion, it does not HELP, and against
  a target at MINUS two evasion a naive "set it to zero" would have read the base accuracy where the
  truth is the base times **5/3** — Showdown's evasion table at stage −2 — so the tidy-up version
  silently PENALISES the attacker on exactly the boards the ability is supposed to help.
  (Written as the fraction rather than the percentage it was first drafted with: the decimal was a
  figure no artifact carried, which `tests/test-docs-current.js` caught on the commit. The ratio is
  the thing that was actually derived, and it is checkable against the table without an artifact.)

### THE CLOSET GAINS A ROW — WILL, 2026-08-11: "closet the tangled feet"

Recorded in `engine/quarantine.js` beside Illusion and Stall, with the reason, the cost and the way
back. Its handler's only path is `if (target?.volatiles['confusion']) chainModify(0.5)` and this
engine has no confusion volatile, so **moving it to the rate runner does not rescue it either** — a
rate run cannot enter a condition that does not exist. **Its rate row stays live in
`data/million-targets.json` at 0.5 on purpose**: a closeted mechanic with a live target row makes the
run report UNREACHABLE rather than silently omitting it, and deleting the row would make the target
list agree with the engine's blind spot, which is the shape of every failure this repository has had.

### WHAT IS LEFT OF THE INERT RESIDUE

Nothing that is open work. The roster still reports 39 rows INERT and that number will not move,
because it is a statement about the ROSTER'S fixture rather than about the engine — 30 of the 39 are
named in a live census probe, and the nine that were not are the rows above. The roster's
CONTROL-NOT-QUIET list is likewise 13 and stays 13: `keeneye`, `stickyhold` and `rivalry` are in it
because every alternative ability on their carriers is itself live, which no engine change can alter.

---

## ROADMAP #216 — FOCUS BAND COULD NOT SAVE ANYTHING, AND #166 WAS STALE (2026-08-11, tenth pass)

Will: *"focus band is 10 percent i think"*. Correct — `randomChance(1, 10)`, no Champions override —
and the question exposed the mechanic. `data/tags.json` gave Focus Band `tags: ["flingable"]` and
nothing else, so a body holding it died exactly as if it held nothing, on **15 sheet teams**.

**AN "UNREACHABLE" VERDICT IS A CLAIM ABOUT THE INSTRUMENT, AND THIS ONE WAS POINTING AT THE ENGINE.**
The rate runner reported `proc:focusband` UNREACHABLE because *"the FROZEN tag artifact carries no such
param"* — which reads like a missing declaration and was a missing mechanic. Worth keeping as a shape:
a reachability failure and an absence are indistinguishable from the instrument's side.

### WHICH OF THE TWO WORLDS — MEASURED FIRST, NOT ASSUMED

#166 says *"FOCUS SASH DOES NOT SAVE, AND STURDY DOES NOT EITHER"*. **It is stale.** Measured on the
live engine before a line moved, a lethal Close Combat into a 60 HP body:

| body | at FULL HP | at HALF HP |
|---|---|---|
| holding nothing | died | died |
| **Focus Sash** | **hp 1, item spent** | died (correct) |
| **Sturdy** | **hp 1, ability intact** | died (correct) |
| **Focus Band** | **died** | **died** |

So: **the path WORKS and the tag was missing.** One row, one fix, Focus Band alone — and it is the
tidier of the two stories, which is exactly why it was measured rather than assumed. That is the
eighth register row this sprint to be found describing an engine that has since been repaired.

### THE GATE WAS THE FULL-HP TEST ITSELF

```
        if(_arrive>=tg.curHP&&tg.curHP===tg.st.hp){          <- the outer gate
          const _sv=TAGS.param(...,'survivesFromFull');
          if(_sv&&(!_sv.onlyFromFullHP||tg.curHP===tg.st.hp)){   <- dead code, one line later
```

`tg.curHP === tg.st.hp` sat ABOVE the tag read, so the artifact's own `onlyFromFullHP` was checked
against a condition already guaranteed. **A param written as a gate silently DEFINES the membership
instead of describing it** — and the one member without a full-HP clause could never match. The same
shape was in the derivation, where `if (!/hp === maxhp/) return null` excluded Focus Band before any
param was read.

### THE PARAMETERISATION IS THE DELIVERABLE, NOT THE BRANCH

`chance` added and `onlyFromFullHP` allowed to be false, both DERIVED from the handler. **No name
appears anywhere in the engine**, so a fourth member is picked up with no engine edit.

**WILL SPLIT IT MORE SHARPLY THAN THE FIRST READING DID AND THE ARTIFACT AGREES WITH HIM** — *"sturdy
is more like focus sash than focus band"*:

| | when | certainty | the item |
|---|---|---|---|
| Focus Sash | full HP only | always | consumed |
| Sturdy | full HP only | always | n/a, an ability |
| **Focus Band** | **ANY HP** | **10%** | **KEPT** |

Sash and Sturdy genuinely share `survivesFromFull` and that grouping is correct and untouched. Focus
Band differs on three axes — but in its param VALUES, not in their meaning, which is what a param is
for. Splitting a tag whose params already distinguish its members is the #162 collapsed-label trap
facing the other way.

**MEMBERSHIP PRINTED OVER THE WHOLE DEX BEFORE A LINE WAS WIRED**, items and abilities together, with
the relaxed rule (an `onDamage` testing `damage >= hp` and returning `hp - 1`):

```
  focussash   fullHP=true    chance=none   useItem=true
  sturdy      fullHP=true    chance=none   useItem=false   (9 legal carriers)
  focusband   fullHP=FALSE   chance=1/10   useItem=false
```

Three. The relaxation adds exactly Focus Band and over-matches nothing.

**THE ROLL IS TAKEN ONLY WHEN THE SAVE WOULD OTHERWISE BE GRANTED, and that is a stated divergence.**
Showdown evaluates `randomChance(1,10)` FIRST in its `&&` chain, so it draws on every damage event to
a Focus Band holder including non-lethal ones. This engine takes an injected `rng()` and does not
reproduce Showdown's stream, so aligning the draw would buy nothing and would perturb every unrelated
board sharing the callback.

Probe `item/survivesFromFull`, five arms: nothing held dies; Sash saves from full and is spent; Sturdy
saves from full; Sash does NOT save from half; **Focus Band at HALF HP inside its 10% survives at 1 AND
KEEPS THE ITEM** — the handler has no `useItem`, and an engine that copied the Sash's consumption
would pass the survival and silently disarm the next hit — and outside the roll the same board dies.

### THE PROOF, ON THE ROW THAT HAD NEVER PRODUCED A NUMBER

`engine/million_run.js --staged --trials 2000` against a freshly cut release (`5a557b07821c`, verified
byte-identical to the tree):

```
    proc:focusband          2000/—      fired    195    9.75%
```

**UNREACHABLE -> 9.75% against an authority of 10%.** Every other row unchanged and MET (16 MET, 0
SHORT), and all three red-proof arms still CAUGHT.

**THE CAPTION BESIDE IT IS NOW STALE AND THE FIX IS NOT MINE.** `million_run.js:2237` calls
`stagedDeclaration(subject, 'item', null)` — a null `tagPath`, which was correct when there was no
param to point at. `stagedDeclaration` requires one (`if (row && row.params && tagPath)`), so it still
reports "carries no such param" and leaves the row `scored: false`. One argument closes it:

```js
const decl = stagedDeclaration(subject, 'item',
  { param: 'survivesFromFull', name: 'chance', pick: p => p.chance });
```

That would read `tag_pct` 10 from the frozen artifact against `list_pct` 10 already in
`data/million-targets.json` (`DERIVED:randomChance(1,10) in the handler`), corroborate on two
surfaces, and score the row. **`million_run.js` belongs to the coordinator and was not touched.**

### CUTE CHARM — THE ENGINE IS RIGHT, THE FIXTURE IS GENDERLESS

91 uses, 122 sheet teams, and the run read 0 fires in 4,166 trials. Staged with genders declared on
both bodies, the engine is correct on every arm:

| board | result |
|---|---|
| opposite genders, roll inside the 30% | **attract lands on the ATTACKER** |
| same board, no ability | nothing |
| **same gender** | **nothing** — the authority's own rule |
| **genderless (the rate runner's fixture)** | **nothing** |
| opposite genders, roll outside the 30% | nothing |

So the row was the FIXTURE. Every body the rate runner builds declares `gender: 'N'`, and Showdown
refuses attract between genderless bodies, so the roll is never reached — the identical limitation
that made Rivalry read inert in #212. The repair belongs to the runner's fixture (declare a gender on
the four carriers: Clefable 25M/75F, Milotic 50/50, Lopunny 50/50, Sylveon 87.5M/12.5F), not to the
engine.

**NO SECOND PROBE WAS ADDED.** `ability/punishesAttacker` already carries this board and is LIVE, with
all five arms — *"Cute Charm attracts the contact attacker on its 30%, and only across opposite
genders"*. Adding another would raise the census count and prove nothing.

---

## ROADMAP #217 — FOUR STALE REASONS, AND EVERY ONE READ LIKE A MEASUREMENT (2026-08-11, eleventh pass)

Will caught three of these in ten minutes and a fourth an hour later. **The numbers in this repo keep
holding up under checking; the PROSE attached to them does not.** Every item below was a sentence that
was true when written, was quoted afterwards as if it were a measurement, and was wrong by the time it
mattered. Census **511 -> 514 live, 0 missing**.

### 1. TANGLED FEET WAS SWITCHED OFF WITH AN EXCUSE THAT HAD EXPIRED

```js
'ability:tangledfeet': {side:'def', mult:0.5, off:'no confusion volatile exists in this engine'},
```

**False.** Confusion is fully implemented eight hundred lines below that table: `applyConfusion`
writes `_vol.confusion`, with the self-hit roll, the expiry, Safeguard's refusal, the ability
refusals, `confusionAlreadyOn` and Persim's cure — and the rate runner already carries targets for the
33% self-hit and the 1-4 turn duration. **I repeated that string to Will as fact and he closeted the
ability on the strength of it.** No new machinery was needed: read the volatile that was already
there.

Probe `ability/accuracyMod`, a **2x2 where three of the four cells must be EQUAL** — the ability alone
does nothing, the confusion alone does nothing, only the pair halves the accuracy. The confusion comes
from a real Confuse Ray click, and the roll is pinned at 0.6, between the halved 40 and Stone Edge's
printed 80. Out of the closet in `quarantine.js`, with the entry kept as a comment saying why: **it
was never a decision, it was a stale sentence.**

### 2. EVERY `off:` AND `when:` ROW RE-DERIVED, NOT RE-READ

One expired reason means the class is suspect. The full table is now a comment above `ACCMOD`; the
verdicts:

| row | verdict |
|---|---|
| widelens, brightpowder, compoundeyes, noguard | LIVE, unconditional |
| zoomlens | LIVE — `targetAlreadyMoved` is wired at all four call sites off `unresolved` |
| hustle, sandveil, snowcloak | LIVE, gates hold |
| **tangledfeet** | **FIXED — reason had expired** |
| **skilllink** | **OFF, AND THE REASON HOLDS.** Re-measured: it has NO accuracy handler at all — its only handler is `onModifyMove` touching `multihit`/`multiaccuracy`. The tag is a genuine false positive; the ability itself is live under `multihitAlwaysMax` |
| **victorystar** | **OFF, REASON CORRECTED.** The old string blamed "hitChance has no side" — which stopped being true when #213 used `_sf` to answer ally-ness for Telepathy. The REAL blocker was never stated: **Victini is not in this format, zero legal carriers** |
| **laxincense** | DEAD ROW, harmless — `isNonstandard: 'Past'`, banned here |
| **wonderskin** | DEAD ROW, harmless — **zero legal carriers** |

Two rows are dead-but-on and that is not a defect: an entity that cannot appear cannot be applied.
They are named so the next reader does not re-derive them.

### 3. PLUS WAS MISCLASSIFIED, MINUS WAS SHELVED, AND UNDERNEATH BOTH THE MECHANIC WAS DEAD

Will: *"why isnt plus in the closet lmao"*, then *"u somehow staged plus but couldnt do minus, now im
very suspect of your work"*. Direction reversed, substance exactly right — **neither was measured, and
the two halves of ONE mechanic were filed two different ways**: `minus` DEFERRED-BY-OWNER on rarity,
`plus` COULD-NOT-STAGE with a reason calling its own blindness *"the honest coverage limit, not a
pass"*.

**IT WAS NOT A COVERAGE LIMIT.** The roster filed Plus under `unconditional-stat-multiplier` —
*"onModifySpA with NO type and NO HP gate"* — and Plus satisfies both of those while being thoroughly
gated **on the ALLY**. The fixture never places a qualifying partner, so the ability correctly did
nothing and the instrument read its own blindness as a fact about the world.

**AND THE MECHANIC WAS DEAD ANYWAY.** Measured before anything moved, all five cells read 121:
`damageBoost` carried `onlyWhen: null`, and the consumer then refused it for a third reason entirely
(no `onType`), uncounted — the same two-wrongs shape as Analytic in #213.

Fixed at the RULE, not the row: `unconditional-stat-multiplier` now excludes ally-gated handlers, and
`onlyWhen: {cond:'allyHasAbility', is:[...]}` is derived from the handler. **Membership over the whole
dex: exactly THREE abilities gate a stat or damage handler on an ally** — Friend Guard (already live
under `reducesAllyDamage`), Plus, Minus. So the exclusion moves two rows and invents nothing.

**`hasAbility(['minus','plus'])` IS SYMMETRIC** — Plus beside Plus satisfies it, and Ampharos next to
Dedenne is a board that exists today. The shelf reason had that wrong too ("Minus only does anything
beside an ally holding Plus"). **Minus is off the closet, and it was never a rarity call.**

**THE PHYSICAL ARM IS NOT DECORATION.** Both handlers are `onModifySpA` ONLY, and the first cut
multiplied the attacking stat whatever the category — an Ampharos got a 1.5x IRON TAIL, 18 to 27,
caught on this board. `onStat` is now derived from the handler name.

Probe `ability/damageBoost`, seven cells: no ability 121, PLUS with no partner 121, the three pairings
183, and Iron Tail equal in both arms.

### 4. FLYING PRESS CAME OFF THE USAGE SHELF, AND IT LEFT BY BEING CORRECT

Will: *"we need flying press in the game hawlucha gets some play what does it do"*. It sat at **21
clicks against a floor of 25** — a threshold call, not a measurement, and 21-against-25 is inside the
noise of wherever the line was drawn.

**ITS ONE SIBLING WAS CHECKED FIRST AND THE MECHANISM ALREADY EXISTED.** Only two legal moves in this
format carry `onEffectiveness`. Freeze-Dry's `overridesEffectiveness.perType` was built this session,
so this is a second PARAM on that tag (`addsType`), not a new tag and not a name branch — **the fifth
time this sprint the answer was a param.** The two rules genuinely differ and both are derived:
Freeze-Dry OVERRIDES the chart for one defending type; Flying Press ADDS an attacking type across the
whole chart.

**THREE TARGETS, DERIVED FROM THE CHART RATHER THAN CHOSEN:**

| target | Fighting | Flying | product | Flying Press vs Brick Break | chart predicts |
|---|---|---|---|---|---|
| Machamp (Fighting) | x1 | x2 | **x2** | 222 vs 83 = x2.67 | x2.67 |
| Beedrill (Bug/Poison) | x0.25 | x2 | **x0.5** | 92 vs 34 = x2.71 | x2.67 |
| **Aggron (Steel/Rock)** | x4 | **x0.25** | **x1** | **46 vs 136 = x0.34** | x0.33 |

**On Aggron the 100 BP move does LESS than the 75 BP one.** An engine ignoring the added type reads
the flat base-power ratio on all three; an engine hardcoding "Flying means x2" passes the first two
and fails Aggron. Brick Break is the control that says the typing itself did not move.

**IT LEFT THE SHELF BY BEING CORRECT, NOT BY BEING EXEMPTED** — its roster verdict is now
FIRED-AND-BOARDS-MATCH, so the shelf no longer applies to it at all. Moves went **479 -> 480 tested**,
DEFERRED-BY-OWNER 10 -> 9. The floor was NOT lowered: fitting a threshold to one example is worse than
keeping it. What is recorded beside `USAGE_SHELF_BELOW` is that **a shelf entry is a prompt to ask
somebody, not a verdict** — two overrules tonight, both domain calls the store could not make, both
right.

### THE STATE

Census **511 -> 514 live, 0 missing, 0 hollow, 0 unarmed, 0 direct-call, 0 threw**. Differential
**0/6000 at all three points**. Roster re-run against release `154356e55c80`: **moves 480 of 500**
(was 479), abilities 120, items 139, **0 DIFFER and 0 DID-NOT-FIRE everywhere**. The closet lost two
rows — tangledfeet and minus — and both left because they were wrong to be there, not because they
were waived.

---

## ROADMAP #218 — THE GAME DIFFERENTIAL: RESIDUAL ORDER CLOSED, PROTECT IS A PIN ARTEFACT (2026-08-11, twelfth pass)

A different instrument from the one this sprint has lived in. `engine/game_differential.js` plays one
team pair through both engines with real sheets and real natures, pins every die identically, and
records the FIRST divergence. **It is not the damage differential**: `engine-diff.json` reads 0/6000
and always has, because it compares a NUMBER and this compares a SEQUENCE. Both are true.

### TARGET ONE — RESIDUAL WEATHER ORDER. CLOSED, 80 GAMES -> 4.

**THE AUTHORITY, READ RATHER THAN INFERRED FROM THE TRACES.** The sand chip is not part of the clock
pass at all:

```
sandstorm.onFieldResidualOrder: 1
sandstorm.onFieldResidual() { this.add('-weather','Sandstorm','[upkeep]');
                              if (this.field.isWeather('sandstorm')) this.eachEvent('Weather'); }
battle.ts:465  eachEvent()  { const actives = this.getAllActive();
                              this.speedSort(actives, (a, b) => b.speed - a.speed); ... }
```

Descending `pokemon.speed`, which is `getActionSpeed()` — and that returns `10000 - speed` under Trick
Room, so **the inversion is already inside the number both passes sort on** and neither needs a second
branch.

**THIS ENGINE HAD IT RIGHT IN ONE PASS AND NOT THE OTHER, WHICH IS WHY NOBODY SAW IT.** ROADMAP #115
speed-sorted the CLOCK loop — perish, yawn, status chip, Leftovers — when Will asked whether bodies
faint in speed order. The WEATHER loop one screen above it kept iterating `[...actA, ...actB]`, slot
order. Every body takes the same 1/16, so every total agreed and the damage differential could not
see it; only the SEQUENCE differed, and that is 17% of all divergences.

**ONE FUNCTION, BOTH CALLERS.** `residualOrder(actA, actB, field)` is new and the three lines #115
wrote inline are gone. Re-sorting the weather loop in place would have left the same fact written
twice with the same chance of drifting again — which is exactly how this arose.

Probe `move/weatherSetter`, two arms: four bodies at Speed 205 / 101 / 80 chip fastest-first, and
**Trick Room reverses the list exactly**. An engine sorting by raw speed and ignoring the field passes
the first arm and fails the second; one in slot order fails both. Garchomp is on the board and takes
no chip in either arm — Ground is immune — which is the control that says this is the sand.

**MEASURED: the sandstorm-versus-sandstorm family went from 80 games across 6 causes to 4 games across
3.** The run rate moved 480/1213 (39.6%) to 408/982 (41.5%), and **the rate is not the measurement
here** — the swarm re-selects between runs, so the attributable number is the cause family, which fell
by 95%.

**A SECOND FAMILY SURFACED UNDERNEATH IT AND IS NOT FIXED: sand versus Leftovers, 11 games.**

```
|-damage|p1b|H/H|[from]sandstorm  <>  |-heal|p1a|H/H|[from]leftovers
```

Showdown runs residuals as ONE sorted list of HANDLERS keyed `(residualOrder, residualSubOrder,
speed)` — sandstorm is `onFieldResidualOrder: 1`, Leftovers is `onResidualOrder: 5,
onResidualSubOrder: 4` — so it chips EVERY body, then heals EVERY body. This engine runs one loop PER
BODY doing all of that body's effects, which interleaves them: chip(fast), heal(fast), chip(slow).
Same events, same amounts, wrong interleaving. **The repair is a real restructure** — collect handlers
with their order keys, sort once, then run — and it was NOT attempted, because it touches every
end-of-turn effect at once and could not be gated inside this pass. Named rather than started.

### TARGET TWO — PROTECT IS A PIN ARTEFACT, NOT AN ENGINE DEFECT

32 games and 94,313 corpus clicks, scattered across four classes. **The instrument documents the cause
in its own `PINS` block, written before anyone read the causes:**

> `medicham2_has_one_scalar_die`: "accuracy, the crit, every secondary, **the stall counter** and the
> damage roll all read the same `rng()`, so there are TWO corners and not four independent knobs."

Mode A `top-tie-first` pins that die to the corner where every sub-100 move MISSES — a high value —
and the stall check is `rng() < 1/counter`. **A high pin therefore forces every consecutive-Protect
roll to FAIL.** Showdown draws its stall check from a separate PRNG call the pin does not force the
same way, so it succeeds. That is precisely the observed shape: `|-singleturn|p2a|protect <>
|-fail|p2a`, Showdown succeeded and we failed.

**MEASURED, BOTH CORNERS, THREE CONSECUTIVE TURNS:**

| pin | turn 1 | turn 2 | turn 3 |
|---|---|---|---|
| HIGH (0.99, the mode-A top corner) | protect **true** | **false** | true |
| LOW (0.01, the other corner) | protect **true** | **true** | true |

**The FIRST Protect succeeds under both**, which is the arm that would have exposed a real bug: the
counter short-circuits at `_ctr <= 1` and draws no die. Only the consecutive roll moves with the pin.

**SO THE REPAIR IS AT THE INSTRUMENT AND NOT AT PROTECT.** Changing the stall probability to make this
family go green would be reaching for a rate explanation for a rule-mode divergence — the one thing
the brief warns against — and would break the mechanic on every unpinned run. Two honest options,
both belonging to whoever owns the differential: give the stall counter its own die so the damage
corner does not drag it, or record the Protect family as a known pin coupling and exclude it from
mode A. **`engine/game_differential.js` was not edited.**

The `|cant|p2b|nopp|protect` line is consistent with the same root and is NOT independently
established: once our Protect fails where Showdown's holds, the two games take different actions and
consume different PP, so a later `nopp` is a cascade rather than a second defect. Saying which would
need a run with the stall die decoupled.

### THE STATE

Census **514 -> 515 live, 0 missing**. Damage differential **0/6000 at all three points**. Roster
re-run against release `96361d523e20`: abilities 120, moves 480, items 139, **0 DIFFER and 0
DID-NOT-FIRE everywhere**. Game differential 408 of 982 (41.5%), 0 threw, planted proof caught.

---

## ROADMAP #222 — FIVE DICE, NOT ONE. THE COUPLING WAS REAL AND IT WAS NOT THE EXPLANATION (2026-08-11)

**THE HYPOTHESIS WAS THAT SPLITTING THE DIE WOULD DROP THE DIVERGENCE COUNT. IT ROSE.** Measured:
408 of 982 (41.5%) with the streams welded, **460 of 982 (46.8%)** with the stall counter freed. The
brief asked to be told if that happened, so: **the coupling was not behind the Protect divergences.**

### THE ENGINE-SIDE SPLIT IS REAL, CORRECT, AND KEPT

`medicham2` genuinely welded five mechanics onto one scalar — the differential's own PINS block said
so and nobody had read it. `rngStreams()` now derives five named streams — `acc`, `crit`, `sec`,
`dmg`, `stall` — from one seed, each an LCG seeded by the master mixed with the stream's own NAME so
adding a sixth cannot shift the five that exist.

**A PLAIN FUNCTION KEEPS EXACTLY TODAY'S BEHAVIOUR.** Every stream aliases the one function, so all
516 census probes, the rate runner and every scripted harness are bit-for-bit unchanged. That is the
whole back-compatibility guarantee and it is asserted in the probe rather than described.

Probe `move/stallCounterChecks`: at the mode-A top corner one welded die reads `[true, false]` and
five split dice read `[true, true]` — the exact demonstration the brief specified. Plus determinism
(same seed replays), seed-sensitivity, stream independence, and the aliasing arm.

**Turn 3 is deliberately not asserted.** The counter really does grow 1, 3, 9, so a third consecutive
Protect is a 1/9 its own stream is entitled to lose; asserting it would be asserting a die.

### WHY FREEING IT MADE THE INSTRUMENT WORSE, FROM THE PIN ARITHMETIC IN THAT SAME FILE

```
chance(num, den) = random(den) < num        random(den) = top ? den - 1 : 0
```

Under the TOP corner Showdown's own `randomChance(1, counter)` is `counter - 1 < 1`, **FALSE for any
counter above 1 — so the authority's consecutive Protect fails under this pin too.** The two engines
were already agreeing BECAUSE both were pinned the same way. Replacing our pinned refusal with a free
coin desynchronised it from a pinned one, and two independent streams disagree on a 1/3 roll about
two thirds of the time. That is the 52 extra games, and it is arithmetic rather than a guess.

**SO THE DIFFERENTIAL ARM PINS ALL FIVE TO THE CORNER, exactly as before.** Reverted, and the count
returns to **408 of 982 (41.5%)** — bit-identical, which is the evidence the revert is exact. The
freed stream is still built and deliberately unused so the next reader can see what was tried.

### WHAT THIS MEANS FOR THE PROTECT FAMILY, RETRACTED PROPERLY

#218 called Protect a pin artefact. **That is now only half right.** The coupling exists and the
first Protect is clean, but the divergences cannot be explained by our stall die reading the accuracy
pin, because Showdown's is pinned to refuse as well. The 32 games are unexplained again and the
register should say so rather than carry the tidier story.

### THE RATE RUNNER HELD, AND IT WAS CHECKED RATHER THAN ASSUMED

Staged arm before and after, 2,000 trials: **16 of 17 rows identical to the digit** — static 30.75,
flamebody 30.75, poisonpoint 30.34, effectspore 31.90, cutecharm 30.92, cursedbody 30.22, poisontouch
29.12, stench 10.56, kingsrock 9.32, quickclaw 19.98, quickdraw 30.58, shedskin 33.29, healer 50.84,
harvest 50.27, rawstberry 100, aspearberry 100. Only `proc:focusband` moved, 9.75% to 9.70%, both
inside noise of its declared 10%. **17 MET, 0 SHORT, 0 UNREACHABLE.**

### THE PIN DIGEST MOVED, AND WHY, SO NOBODY RE-BASELINES BY ACCIDENT

`adb146050fff` -> `ef342837b791`. **The behaviour did not change** — 408/982 before and after — and
the digest moved only because a CLAIM was added: this arm now asserts that all five streams are on the
corner, which is the assertion whose absence let the Protect story stand. `arms_comparable.js` will
refuse a pre-#222 run against a post-#222 one. **That is conservative rather than correct** and it is
the coordinator's call whether to re-baseline; the two runs are demonstrably identical in behaviour.

### A LOUD GUARD, NOT A SILENT FALLBACK

A release frozen before #222 has no `rngStreams`. The differential THROWS naming the release rather
than falling back to the scalar, because a silent fallback would reproduce the exact coupling this
change exists to remove while the run looked clean.

### THE WHOLE-GAME DIVERGENCES ARE TWO QUESTIONS ADDED TOGETHER

`engine/divergence_report.js` clusters the differential's causes by what the two protocol lines
actually disagree ABOUT, rather than by the differential's own bucket names. Those names had two
proofs of being the wrong grouping: the weather residual was six causes reading as separate rows and
one rule, and Protect is fifteen causes spread across four classes at once.

The clustering answers the question the pass existed for. **EMISSION is the largest shape and RULE is
second**, and they are not the same question: one is the engine narrating the game differently, the
other is the engine playing it differently. A single blended percentage had been reported for both —
the identical merged-number failure as quoting the damage differential for whole games.

**The largest family is Regenerator, and every cause in it names that ability.** Showdown emits only
the switch line: the departing body is healed on the bench, where there is no active slot to announce
it for, so the authority emits nothing and this engine emits a `-heal` line it never produces. **The
roster's `FIRED-AND-BOARDS-MATCH` was correct** — the HP is right and the board is right. A board
comparison is structurally blind to an emission difference, which is the same blindness that hid the
weather residual, where every total agreed and only the sequence differed. Regenerator had been
checked an hour earlier and pronounced fine on exactly that verdict.

The UNPARSED bucket is not different bodies, which is how it was first read. It is this engine's own
emitter failing to resolve a slot and leaking a `??:` placeholder into the stream — `|-start|p1a|yawn`
against `|-start|??:incineroar|yawn`. A `??:` in a protocol stream is an absent capability announcing
itself.

Causes naming a mechanic that reads a pinned die are marked **suspect and never excluded**. The
Protect case proves a coupling suspect can still be a real disagreement, and a cause dropped for
smelling like an artefact is a defect nobody looks at again.

**The stall counter is eliminated as Protect's cause.** The authority's reset triggers are the
volatile lapsing, a failed roll deleting it, and switching out, plus the `willAct()` guard, which is a
failure condition rather than a reset. This engine matches on all of them — including the two that
could only be settled by measurement, the gap turn and the turn after a failed roll. Nothing was fixed
on an unconfirmed direction.

### REGENERATOR: EIGHTY GAMES FROM ONE EMISSION FIX

Decided from the source rather than by taste, and the deciding detail is one word. The ability calls
`pokemon.heal()`. `Pokemon#heal` trims, mutates the HP and returns the delta — **it adds nothing to the
log**. `Battle#heal` is what emits `-heal`. So the authority is silent by construction, and this engine
was producing a line it never makes. Fixed at that one call site: the HP still moves, the switch line
is intact, and a counter records the silent heal so the capability still proves it ran.

**Not solved by declaring the event type not-emitted.** That list is about event *types*, and this
engine emits `-heal` correctly for Leftovers, drain and Wish — suppressing the type would have hidden
three right lines to remove one wrong one.

**The category movement needs its caveat, and it was nearly reported as progress on rules.** The
differential records only the FIRST divergence per game, so fixing an early one lets a game run further
and hit a later one. EMISSION and RULE both fell as expected — but UNPARSED went UP, because games that
used to stop at the Regenerator line now reach a slot-placeholder or different-body disagreement
instead. **The drop in diverging games is real; the redistribution across shapes is partly
re-attribution, and the shapes are not independent counts.**

The `??:` placeholder is now the largest single family. Its call site already counts itself, so the
capability had been announcing its own absence and nothing was reading the counter. It was not
reproduced on a straightforward board, so no line moved.

### THE WHOLE-GAME COMPARISON IS A GATE CLAUSE NOW

Will, 2026-08-12: *"add the whole game comparison to the medicham its part of it and we need to focus
on getting that lining up."*

It was measuring and gating nothing, which is how a whole-game divergence rate sat beside a clean
damage differential for months without anybody noticing they were different questions. The damage
clause is damage only and says so in its own scope line — *"no items or abilities. Turn order, status
duration and switching need a different harness and are not attempted here rather than attempted
badly."* The game differential is that other harness: one team pair, real sheets, real natures, both
engines, every die pinned identically, first divergence recorded. The gate goes from six clauses to
seven.

**The bar is a ratchet and not zero, and that is a choice against the obvious one.** Zero is correct
in principle — mode A makes the two engines deterministic functions of one input, so any difference is
a bug. But a clause that reads red for weeks is one people learn to skip, and this repo has the
receipt: a docs gate sat red for two days reported as "one of the two known failures" until the rule
it guarded broke. So the clause fails on a **rise**, the rate may only go down, and it prints the
absolute figure on every run with the words **NOT ZERO, AND THE RATCHET IS NOT A PASS**.

**The tolerance is derived rather than picked.** The swarm re-selects teams between runs, so two raw
counts are not comparable — the same instrument reports different denominators. The rate is a binomial
proportion, so the band is two standard errors computed from the run's own sample size.

It prints emission and rule separately, because a blended percentage is the same merged-number failure
as the midpoint residual that hid a range wrong at both ends.

**Shown red three ways before being trusted.** No baseline fails by design, rather than seeding itself
from whatever the last run produced — a ratchet that stamps itself is not a bar somebody chose. A
planted better baseline fails on the rise. And the stamp refuses a worse number without an explicit
force, because a baseline may only ratchet down, and raising one quietly is how a gate becomes
decoration. A run whose planted-divergence proof did not fire is refused outright.

### THE SPREADS WENT IN, AND THE PREDICTION WAS WRONG

Will: *"we can yoink moves, we just need to give them our stat spreads."* The differential built every
body at zero investment — not a guessed spread, no spread — because an open team sheet does not reveal
one. Both engines got the same zeros, so it never caused a divergence; it hid them, and it manufactured
speed ties across most of the format.

**The prediction was recorded before the run and it was wrong.** The file expected the number to get
worse; it got better on both arms, on the same frozen pool and the same game count. `ordering` did grow,
which was the other half of the prediction, so the improvement came from somewhere else entirely — the
slot-placeholder family fell, meaning fewer games now reach the wrong-body defect first.

**The tie assertion in the brief was unachievable and that was my error.** Ties fell by more than a
third but cannot reach zero: three of the four `speedSort` call sites sort HANDLERS rather than
Pokémon, and no stat spread separates two item handlers that share a priority. The instruction was
written without accounting for what had already been established about those call sites.

**What did verify cleanly.** With real spreads on both sides, `align_had_to_move_a_stat` stays 0 — the
two engines still agree on every stat. That was measured first across every nature and a set of
deliberately awkward spreads, and it caught a bug before it shipped: **HP takes no investment here.**
Champions adds it and this engine's level-50 line has no HP term, so a body given HP points reads
correctly on the authority and short here. The budget goes to Sp. Def instead, and the formula lives in
the engine with the differential asking for it rather than keeping a second copy.

**The useful conclusion is the negative one:** speed ties were not what was hiding the divergences.

### THE BOARD COMPARISON CANNOT SEE TYPING OR ABILITY

Will: *"our board state analysis needs to be comprehensive"*, arriving in the middle of a plan to
settle "how much of this is just wording" by playing both battles to the end and comparing boards.

Read what `board_state.js` actually walks, per body: species, hp, maxhp, fainted, status, a status
counter, item, boosts, and eight volatiles — substitute, taunt, encore, disable, leech seed, confusion,
perish, trapped-by-move — plus screens, tailwind, hazards, party and PP.

**No typing. No ability.**

So the end-of-battle comparison as briefed **could not have seen the wrong-body defect at all**: a Soak
that changes the wrong Pokémon's type leaves every compared leaf identical. Nor Skill Swap, Trace,
Mummy, Simple Beam, or an ability overwritten by a mega evolution. A board comparison is only as good
as what is in the board, and this one would have reported the most serious defect of the sprint as
cosmetic. It is the same blindness that let Regenerator, the weather residual and Focus Band pass
every check in the project.

**And a stale release now fails by name.** Wiring the spread made this file require an engine release
newer than the export; against an older one it died with a bare `TypeError` four frames deep, which
sends the reader into the engine to look for a missing function when the answer is that they named an
old release. Shown red before being trusted. Not a silent fallback — falling back would run every body
blank while the artifact claimed a spread.

**The run length is being made a stopping rule rather than a number somebody chose.** Will: *"run
until each mechanic has been exercised."* The rate runner derives its trials from power; this
instrument had no rule at all, and the count in every published figure was picked arbitrarily. The
swarm already steers by coverage and already counts what it reached, so the rule is loop-until-dry —
keep playing while new rows are credited, stop after several barren batches, and name the rows still
unexercised rather than reporting a count that reads as complete.

### THE TWO NEW LEAVES, PROVEN RATHER THAN READ

`types` and `ability` now sit in both walkers. Three things had to hold and only the first was about
the code compiling: both walkers emit them; the two engines agree on an untouched board, or every game
would part on line one; and a real change gets **reported**, because a leaf that is present and never
differs is decoration.

All three pass. Forcing a Soak-style type change and an ability swap on one side produces exactly the
two rows it should. **So the board comparison can now see the wrong-body defect** — an hour ago it
could not, and the end-of-battle measurement would have called the most serious defect in the register
cosmetic.

The Showdown side reads typing through `getTypes()`, the method rather than the species default, so it
reports what the body is *now* after a mega, a Protean or a Soak. Both sides are normalised and sorted,
because a pure ordering difference on a dual-typed body is not a rule disagreement.

**Both failures on the way there were the probe, not the code.** The first run never took the Showdown
battle through team preview, so it read an empty board and every leaf came back null — which looks
exactly like the leaves being broken. The second gave the two sides different abilities and read a
`.diffs` property off an array that does not have one, which reads as "nothing differed". That is the
fifth time in this sprint the probe was wrong before the engine was, and each one would have been filed
as a real defect by anyone who stopped at the first red.

### THE PREFLIGHT NEVER ASKED WHETHER THE TRIGGER COULD FIRE

Will: *"so fix the instrument."*

Six times in one day the probe was wrong before the engine was, and three of those were a board that
was entirely **legal** and structurally incapable of firing its own trigger. Natural Cure printed
"the mechanic is dead" because the team had no bench, so the switch silently did nothing and every arm
read identical — which is exactly what a dead mechanic looks like. Cute Charm read zero fires against
a declared thirty percent because every fixture was genderless and the authority gates the mechanic on
two real genders. Rivalry, the same cause.

**A legal board that cannot fire its trigger is indistinguishable from a dead mechanic.** That is the
inverse the preflight's own header says has no name.

Four clauses added, each derived from the handler rather than from a list: a switch trigger checked
against the team size, a gender-gated mechanic against two declared genders, a status-reading mechanic
against a declared status, a weather-gated one against a declared sky.

**Shown red on the three boards that actually fooled somebody**, plus the fixed version of each, plus
two regressions — eight cases, all behaving.

**And running it red caught two errors of mine that would otherwise have shipped.** The gender clause
first tested whether the ability's own handler mentions gender; Rivalry does, so it passed its worked
example, while Cute Charm does not read gender at all — it applies a volatile, and *that* condition is
the gate. The clause now follows the volatile one hop down. Then the chase matched single quotes only,
and the compiled source uses double — **the identical bug that made an entire family come out empty in
the rate-run targets earlier the same day**, repeated within the hour.

A guard that had only ever been green would have passed Rivalry, missed Cute Charm, and looked
finished.

### EFFECTS BIND A SLOT NOW, NOT A BODY

Will, three times and finally flatly: *"moves target slots not mons"*, *"well bro its gotta target a
slot"*, *"non negotiable"*.

The re-aim function had the rule and had thirteen callers. **Every other branch of the kind dispatch
read the target raw.** The fix is one choke point above the dispatch — the target re-resolved once per
executing action, at the position the authority uses — plus three slot bindings the engine was never
recording. A per-branch fix would have been thirty places for the thirty-first to be forgotten, which
is how this survived the wire that introduced the re-aim in the first place.

**Verified with the hunter that found it, not with a report: 1,400 games, zero placeholder lines,
down from fifty-six.** Census 516 → 525 live, 0 missing.

**The emitter was deliberately left alone.** Resolving a slot label for whatever body it is handed
would have deleted fifty-six visible markers and left fifty-six silent wrong-target effects. The
placeholder disappeared because nothing is ever handed an off-field body.

Nine probes, all shown red on a deliberate break first. The load-bearing arm is **where the effect
went, read on both bodies** — not that the placeholder stopped appearing.

**The ally axis did not exist.** The recorded slot was a foe-array index and minus one for own-side
aims, so an ally that pivoted was followed by object. The authority has one rule: a single signed
target location resolved through one function, which picks the side off the sign. The user itself is
deliberately not recorded, because this side's slots can be exchanged mid-turn and a self-aim through
a slot index would land on the partner.

**And the brief was slightly wrong, said plainly by the division.** The healing orphans are not the
same bug: everything else is an execution-time aim, while Leech Seed is a volatile carrying a slot
across turns. Two fixes, not one. Instruct alone accounted for about fifty — a benched Pokémon getting
a free attack.

The protocol test's counter assertion was real and **vacuous**: its scripted scenarios contain three
switches between them, and the defect needs deliberate switching to appear. It now plays real games,
asserts the run was **shown** to have switched, and only then asserts the counter is zero.

### THREE PASSES OFF WILL'S READ OF THE RENDERED BATTLES

Every figure in this section lives in `docs/ENGINE.md`, read off `data/game-differential.json` and
`data/mechanics-census.json`. Nothing is retyped here: a number copied into narrative is a number that
goes stale where nothing checks it.

**"Its mostly ordering of events" was right, and it was not where the divergence lives.** Three passes
of ordering and emission fixes — the faint queue, two replacement orders, an item strip against a
damage reaction, a borrowed Protect line, a missing refusal, a mis-typed heal — every one verified
against the authority on a staged turn, every one probed, and the whole-game rate barely moved. Will
then read on and found three wrong OUTCOMES in three cards. Those moved it.

**The one that mattered took a real game to find.** A type immunity was being skipped: a full-health
Pokemon killed by a move that cannot touch it. Nine hand-built stagings all behaved correctly, and the
honest verdict at that point was that the failure to reproduce was a claim about the fixture and not
about the mechanic. The reproduction — seed, teams, the three switch lines before the click —
reproduced it on the first try. A body whose type had been rewritten kept the rewrite across a switch,
because leaving the field is supposed to rebuild the body and here it did not. One of the engine's own
comments already asserted that it did.

**A fix was retracted the same day it landed.** An announcement the authority makes and we did not was
added, was correct on the case it was built from, and cost games on both arms of the differential —
games that had agreed for the whole run and now part, so the gate fires where the authority is silent.
The membership was checked and is right; the sub-case was not found. A change known to manufacture
divergences does not ship because its motivating example is right. The plumbing that lets the refusal
name itself was kept, so the next attempt starts from a measurement instead of from scratch.

**Twice in one pass a fix did nothing and looked exactly like a fix.** One read a field name that does
not exist on any row, so a restore silently restored nothing. The other moved the gates and left the
damage priced off a second, separate resolution of the same fact — the counter beside it read nine hits
while the damage number never changed. Both were caught by a counter or a control, not by the change
looking wrong.

**Accuracy modifiers were keyed by ability and by item, and Gravity is neither.** A large multiplier on
every move in the format that can miss sat outside the only two namespaces the table had. The value was
already in the artifact and had never been read. Will worked out that something in that family was
missing purely from the rendered cards, without reading any source: under the pin every move that can
miss does miss, so a missing accuracy modifier shows up as a clean binary rather than a subtle
multiplier. The whole table was then swept against every accuracy handler in the format rather than
patched for the one card, and two more legal members are still absent and named.

**Membership was printed before anything was wired**, and it closed a question rather than opening one:
every legal move that keys its type on a handler was listed, most already covered, so the new family is
closed and cannot quietly grow without announcing itself.

**The instrument condemned itself and was right to.** The planted-divergence proof failed on a branch
that had never run, with a plant the semantic normaliser could erase and another aimed at a line with
no field to bend. All three reproduced on the frozen pre-change engine before anything was touched. The
reporting hole was the expensive part: "the plant was never placed" and "the comparator cannot see a
divergence" were the same row, and only the second condemns a run.

### THE REGISTER SAID FOUR THINGS WERE BROKEN AND THREE OF THEM WERE FIXED, ONE BY LETTER CASE

oadmapRowIsClosed matched closed 20\\d\\d with no /i, on a register whose house style is to SHOUT its
titles. #220 opens with CLOSED 2026-08-11 and read as OPEN; because it also asserts breakage it was inflating
the MEDICHAM gate with a defect fixed the day before. #148 again, letter case standing in for word choice.

**The obvious fix is wrong, and measuring is what showed it.** /i on the whole alternation reveals four
hidden rows but only two are closed — it also swallows #33 (*rollout_r1.js done, three callers left*) and #80,
whose prose says *retracted* about a DISPOSITION rather than about the row. A blanket widen would have silently
closed two live rows. Only the dated token ignores case.

Closed #218 and #224 on measured evidence. #224 verified in the ARTIFACTS rather than the source:
data/game-differential.json and data/divergence-turns.json hold zero ??: occurrences, and the three
literals left in the simulator are the fallback itself, which that row says must stay visible.

The token goes in the TITLE, where #170 and #220 put it: the detector reads only the first 600 characters on
purpose, so prose deep inside one row describing another row being closed cannot close the row it sits in. The
first attempt appended it to the end of a 2,980-character row and nothing happened — the window doing its job.

Rows asserting breakage 4 to 1. Open rows 110 to 106. The gate still reads CLOSED at 2 of 7 and now names the
single row it fails on: #221, the residual handler-list restructure, genuinely open and deliberately not started.

### HEAD REQUIRED A FILE HEAD DID NOT CONTAIN, FOR ONE COMMIT

`engine/game_differential.js` in `6585cf9` `require`s `./end_state_severity.js`, and that module was
untracked. **A fresh clone of HEAD could not run the differential at all.** My commit staged by
explicit path — chosen deliberately, so that a subagent's in-flight files would not be swept into a
commit describing something else — and a path list cannot see a new file it was never told about.
The narrower rule caught the writes and missed the dependency.

Landed with both gates green: `tests/test-end-state-severity.js` ALL GREEN, `tests/test-end-state.js`
ALL GREEN. Neither had ever been in a commit.

**`data/game-differential-endstate-turn30.json` is committed and must not be quoted**: it self-declares
`planted_state_proof_ok: false`, which is the artifact refusing to certify itself rather than a reader
having to know. `-turn40.json` is the pre-fix ENDED-APART receipt and is a record, not a measurement.

### THE DAMAGE DIFFERENTIAL HAD BEEN OVERWRITTEN BY A WEAKER RUN, AND A DOC GATE IS WHAT NOTICED

The damage differential's artifact held `compared: 150` where the documented claim rests on 6,000. Nothing failed:
(The path is deliberately not cited on this line: attributing a SUPERSEDED reading to a live artifact is
exactly what rule 3b(b) exists to catch, and it caught this sentence.)
0 of 150 disagree reads exactly like 0 of 6,000 unless something asks the denominator. The docs-currency
gate did — the doc's 6,000 stopped matching any artifact — so the fix was to RE-RUN at 6,000 rather than
edit the claim down. **Re-run: agreed 6000, disagreed 0.** An artifact silently downgraded is a ratchet
running backwards, and it is invisible to every gate that reads only the rate.

### THE ACCURACY CONFORMANCE CHECK HAD NO THIRD NAMESPACE, SO A CORRECT ROW READ AS INVENTED

The walk was `['abilities','items']` and its own charter says *"every ability and item"*. Gravity's
handler lives on `move.condition` (`dex.conditions.all` does not exist), so the engine's correct ACCMOD
row was reported as a row that fires with no handler behind it. Derived over every legal move's
condition rather than named, because **one row comes back** and a family of one does not look truncated.

**The DIRECTION rule does not cross the namespace.** "`onModifyAccuracy` means the handler sits on the
TARGET" is true because an ability or item has a HOLDER. A field condition has none: Gravity's handler
takes `(accuracy)` alone and fires for every move either side clicks. `field`, not `def`.

### A CLAIM I PUBLISHED TONIGHT, RETRACTED

I wrote that the sweep named Lock-On and Minimize as still missing. **Wrong twice.** Neither is a
multiplier — Lock-On carries `onSourceAccuracy`, Minimize `onAccuracy`, a second hook family returning a
replacement accuracy or a never-miss — and neither is missing: 9 and 13 sites in the simulator, both
tagged, Lock-On at 0 corpus uses. The real gap is that the conformance check knows only
`*ModifyAccuracy`, so those two are invisible to it. Corrected in CHANGELOG 5.8.0 in place.

### THE OHKO CLASS TOOK EVERY ACCURACY MODIFIER, AND HALF OF THAT WAS MINE FROM THE SAME DAY

Will: *"i dont think the ohko moves can ever be boosted by accuracy, only no guard"*. He is right, and
`hitStepAccuracy` says so STRUCTURALLY rather than as an exception — `if (move.ohko)` sets the accuracy
outright, and the ModifyAccuracy event AND both stage adjustments live in the `else`. Nothing in the
modifier pipeline is reachable for the class. The `Accuracy` event sits BELOW the branch and does still
fire, which is exactly why No Guard and Lock-On work on Fissure and nothing else does.

`hitChance` had no `ohko` branch at all. Every `ohko` mention in the simulator was in the DAMAGE path;
none in the accuracy path. The evasion-stage half has been wrong for the life of the function, and
adding Gravity to `ACCMOD` hours earlier gave a standing hole a SECOND way to be wrong on the same
141 corpus uses. **Fixing only the half I introduced would have left the older one behind.**

`tag_dex`'s `ohko` param was `{ohko: true}`, which flattened a value the authority reads twice: it
stores `ohko: 'Ice'` for Sheer Cold and uses that string for the accuracy (20 rather than 30 when a
non-Ice body clicks it) AND for an outright immunity. Both rules were underivable and the engine had
neither. The level term is omitted because Champions is Level 50 throughout — a format fact.

**The whole-game differential cannot see any of this and never will**: both arms pin accuracy to a
corner, so a computed accuracy never decides an outcome. That is the definition of something needing
its own probe rather than a bigger sample. `tests/test-ohko-accuracy.js` derives every expected number
from the format on each run, and was shown RED first — with the branch disabled it fails 8 of 11.

Damage differential re-run after the change: agreed 6000, disagreed 0, all conformance clauses 0.

### THE COMPARATOR WAS BLIND TO ITS OWN LARGEST CLASS, AND IT SAID SO WHILE I QUOTED IT

The aligner walked `Math.min(a.length, b.length)` and stopped, so a medicham2 stream that is a strict
PREFIX of Showdown's agreed all the way to its own end. **Our engine going quiet was indistinguishable
from our engine being right.** The MISSING-event plant recorded `applied: 1, caught: false` — placed
and genuinely undetected — and `planted_divergence_proof_ok: false` sat in the artifact beside the
divergence counts I read out all evening. The file's own code prints *THE COMPARATOR FAILED ITS OWN
PROOF — everything below is worthless*. That is the caption-is-not-a-quarantine rule broken by the
session that had just re-read it.

**The first fix was wrong and measuring caught it.** A bare length test fired on 9 of 9 games, and the
unmatched line was `|turn|13` — the authority announcing a turn the HARNESS stopped before playing.
Shipping that would have reported our own stop rule as an engine bug. The streams are now trimmed to
the last turn BOTH engines started, EXCEPT when one engine ended the battle and the other did not,
where the extra turns ARE the disagreement.

Two new classes, deliberately not folded into `event missing from medicham2`: *stopped emitting* means
we halted, *missing* means we skipped a line and carried on. Same index, different bug, and the first
is worse because everything after it is unmeasured rather than merely different.

**THE HONEST NUMBER, on a run whose own proof passes:** top-tie-first 230/815 = 28.2%, bottom-tie-first
263/815 = 32.3%, 0 threw, all three plants CAUGHT at exactly the line planted. The newly visible class
is 16 games top and 13 bottom. **This is not attributable to the truncation fix alone** — the OHKO
branch landed between this run and the last proof-passing one, so two changes moved together.

### THE RESIDUAL ORDER TABLE, DERIVED — THE FOUNDATION #221 NEEDED

`engine/residual_order.js` reads every residual handler in the format with the authority's own
`onResidualOrder` and subOrder: **33 effects, 14 distinct order values, 5 groups where SPEED decides
between effects, 6 that expire inside the walk.**

It proves the shape of #221 rather than asserting it. **Leftovers is order 5 and poison is order 9** —
different orders, so every Leftovers heal on the field resolves before any poison chip on either side,
regardless of speed. A body-major loop cannot produce that sequence: ours heals and poisons body A
before touching body B. It is not a tie-break subtlety, it is a different GROUPING of the same events.

It also corrects #221's own title. The key is `order, priority, SPEED, subOrder, effectOrder` — speed
sorts BEFORE subOrder, not after. A restructure written from the title would have sorted Leftovers
against Shed Skin by category when the authority sorts them by who is faster.

Published on its own, ahead of the loop change, so a wrong result can be attributed to the loop or to
the table but never to both at once.

### THE ORDER TABLE WAS INCOMPLETE, AND USING IT IS WHAT FOUND THAT — WITHIN MINUTES

The first cut walked abilities, items and `move.condition`. **Weather and terrain are reached through
`move.weather` / `move.terrain`, not `move.condition`**, so a standalone condition of that name was
never seen. Five of our residual chunks looked themselves up and came back NOT FOUND, including the
sandstorm chip — **the largest single end-of-turn damage source in the format, absent from a table
published as the authority on end-of-turn order.** The ids are now collected FROM THE MOVES (and from
any ability that calls `setWeather`), so a regulation that adds a weather arrives without an edit.

33 effects to **41**. And the correction is not cosmetic: **the weathers are order 1** — the first
thing in the entire residual. This engine runs the sandstorm chip SIXTH, after White Herb, Speed Boost,
Moody and the forme cycles.

### HOW FAR OUT THE RESIDUAL SEQUENCE ACTUALLY IS

Thirteen of our chunks map to an effect in the table. Against the authority's order, **43 of the 78
ordered pairs are inverted — 55%.** The sequence is not slightly out, it is close to scrambled.

Three that decide games rather than wording:

- **Leftovers is order 5 and the burn chip is order 10.** We heal AFTER the chip. Whether a body at low
  HP survives the turn depends on which way round those two go.
- **White Herb is order 29, the last thing in the walk.** We run it SECOND.
- **Speed Boost and Moody are order 28.** We run them third and fourth, so a Speed Boost is applied
  before the chips that might faint the body it is boosting.

**THE CORRECT SEQUENCE, derived:** weather(1) -> Shed Skin/Hydration, Grassy Terrain, Leftovers(5) ->
Aqua Ring(6) -> Ingrain(7) -> Leech Seed(8) -> psn/tox(9) -> brn(10) -> Curse(12) -> trap and Salt
Cure(13) -> Encore(16) -> Perish Song(24) -> Speed Boost/Moody(28) -> White Herb and the forme
cycles(29).

And it is a GROUPING as much as a sequence: each order runs across BOTH sides, speed-sorted, before the
next begins. A body-major loop cannot express that whatever order its chunks are in.

Five chunks still map to nothing — the pinch berries, Poison Heal, and the weather-fed ability heals
(Ice Body, Rain Dish, Dry Skin). Those are driven by `eachEvent('Weather')` INSIDE the weather's own
residual rather than by an `onResidual` of their own, so they belong at order 1 with the weather. Named
here rather than left as a silent gap in the mapping.

### THE GATE SAID PASS WHILE PRINTING "NOT A PASS" IN THE SAME LINE

Will, 2026-08-12: *"so if its not correct then it shouldnt pass man"*. He is right. The whole-game
clause was a RATCHET — it passed whenever the rate had not risen — and its own text read *NOT ZERO,
AND THE RATCHET IS NOT A PASS* beside a green verdict. A caption arguing with its own light, which is
the exact shape this repo already has a receipt for: `PRE-CHANGE` was printed next to the quarantined
figures and they were quoted anyway, by me among others.

**The ratchet was chosen for a real reason and it was the wrong lever.** The argument was that a clause
reading red for weeks is one people learn to skip — true, and with its own receipt in the docs gate
that sat red for two days as *one of the two known failures*. But that is a fact about how people read
reports, and it cannot be fixed by a gate that says something untrue.

Mode A pins every die on both sides, so the two engines are deterministic functions of one input.
Tolerance is zero, no statistics, and each of the 215 is a rule they disagree about. Zero is not an
aspiration here, it is the definition — the clause said exactly that in the sentence beside PASS.

Correctness now decides the verdict; the ratchet is reported as PROGRESS and can no longer open
anything. A run that gets WORSE is named separately rather than folded into the same red.

**The gate is CLOSED again: 1 of 7, the whole-game differential at 215 of 815.** The other six pass on
their merits — damage 0 of 6000 at both corners, the three deliberate rosters clean, coverage clean, no
open engine defect. Everything downstream of MEDICHAM stays withheld, which is the honest state and was
the honest state an hour ago too.

### THE PREFLIGHT'S WEATHER CLAUSE WAS DEAD, AND IT IS THE SAME QUOTE BUG FOR THE THIRD TIME TODAY

`fixture_preflight.js` matched `/'(sunnyday|raindance|…)'/` — SINGLE quotes — against handler source
taken off the compiled `dist/sim`, where TypeScript has rewritten every literal as `"sunnyday"`.
**It matched ZERO of 187 abilities.** The gender clause thirty lines above it documents this exact trap
for `addVolatile`. A dead clause is worse than a missing one: it reports *nothing here is
weather-gated*, which reads like an answer.

**Six abilities were being reported as not firing while the engine was correct** — Chlorophyll, Dry
Skin, Ice Body, Sand Rush, Snow Cloak, Solar Power. The fixture never set the sky. That is the Cute
Charm shape again (0 of 4,166 "absent" until the fixtures had genders) and it is the reason the 98
DID-NOT-FIRE abilities could never be read as an engine number.

Three more silent no-ops surfaced while repairing it:

- **`faces.setsWeather` has NEVER put weather up.** `GAUNTLET_ACTOR_MOVES` is Facade/Endure/Rest/
  Substitute and `clickOf` falls back to the body's first move when it does not hold the ask, so every
  `setsWeather` entry was inert.
- **`faces.statusFirst` is inert too and CANNOT be repaired** — Feraligatr's legal pool holds no
  status-only move, and every status it can inflict is unsafe under `bottom-tie-first`. Counted and
  printed rather than faked.
- **`data/tags.json` cases weather inconsistently** — `sandstorm -> "Sandstorm"`, `raindance ->
  "RainDance"`, but `snowscape -> "snowscape"`. Sun and snow matched; sand and rain silently missed, so
  Sand Rush and Swift Swim read "carrier can learn no setter" while Excadrill and Basculegion learn
  theirs perfectly well.

**The repair over-matched first, exactly as predicted, and the carve-out is derived.** Drizzle, Drought,
Snow Warning, Sand Stream and Sand Spit name a weather because they SET it; pre-setting their sky makes
`setWeather` return false and a working ability read DID-NOT-FIRE. The exclusion comes from the handler
calling `setWeather`, never from those five names.

**DID-NOT-FIRE now splits in two**: `cannot_fire_in_this_fixture` with the failing clause named, against
`did_not_fire_unexplained`. One is a harness defect and the other is an engine defect, and they were one
bucket. Labels are additive — every existing field keeps its meaning. Proof for the three existing
callers: 864 scenarios against the committed version, **`ok` differs 0, `why` differs 0**.

**GENDER IS A STOP-AND-REPORT.** `game_differential.js` hard-codes `gender: 'N'` on every body of both
sides, and its comment says why: *medicham2 has no gender at all, so a declared gender would part the
streams on line one of every game.* Cute Charm and Rivalry cannot be repaired from the harness; they
need gender in the simulator. Correctly labelled CANNOT-FIRE with the clause named, which is the honest
state until that work is done.

### THE GATE NOW ASKS THE QUESTION WILL ACTUALLY ASKS

Will, 2026-08-12: *"we dont care about the games ending, we just care about the mechanics lining up
with showdowns"*, and *"as long as the mechanics work, miltanks rollout will be accurate"*.

The whole-game clause counts GAMES, and a game is whatever the coverage-seeking chooser happened to
click — so it weights a mechanic by how often a sampler reached it. `all_mechanics_fire.js` already
answers the per-mechanic question and **nothing gated on it**: it builds the teams FROM THE MECHANIC
LIST, so its coverage is a property of the format rather than of a bot's taste. It reaches 500 of 500
moves where the swarm reaches whatever it reaches.

It is clause 8 now, and it **FAILS WHEN STALE BY DESIGN**. The artifact stamps the release it measured;
one cut against different bytes is not a weaker answer, it is an answer to a different question. The
receipt is this evening: a 2026-08-11 run was quoted as current while every fix of 2026-08-12
postdated it. Today it reads *MEASURED AGAINST A DIFFERENT ENGINE — release debbbe33ce6d, tree
a68efb1c483d*.

**DID-NOT-FIRE is reported and fails nothing**, deliberately. A mechanic the fixture could not make
happen is a HARNESS defect and a mechanic that happened and disagreed is an ENGINE defect; those were
one bucket until this evening's preflight split them, and counting them together here would undo that
in the gate.

**GATE: CLOSED — 3 of 8.** Whole-game 215 of 815; mechanics stale (93 moves, 20 abilities, 3 items
diverged, 159 never fired); one open engine defect, #232 Protect at 100,806 named uses. The defect
clause ranks by corpus usage, so the worst row surfaces without anybody choosing it.

### 93 MOVE DIVERGENCES ARE NOT 93 JOBS — 28% OF THEM ARE ONE

Grouping the mechanics runner’s 116 diverging rows by the SHAPE of what differs rather than by move
name collapses them to a handful of families. The largest is a single kind of ield 4 mismatch: the
authority NAMES THE CAUSE of a line and we emit the bare line. **25 rows, 9,205 corpus uses, 28% of all
diverging usage** — Sleep Powder 1,931, Poison Touch 1,665, Infestation 1,105, Disable 914, Ice Fang
912, Strength Sap 741, Hypnosis 692, Static 592.

It spans -status, -curestatus, -start, -heal and -damage and crosses moves AND abilities,
which is exactly why it never looked like one job: it presents as nine unrelated single-row
divergences in nine different mechanics. Registered as ROADMAP #234.

One sub-case is a WRONG tag rather than a missing one: Infestation reads [from]infestation in the
authority and [from]partiallytrapped here — we name the CONDITION where Showdown names the MOVE, so
the fix carries the source move on the volatile rather than adding a literal.

It was already on the parked list as “residual damage attribution” and was parked as cosmetic. It is
cosmetic per line and it is the biggest family in the mechanics numbers, which is the argument for
ranking by usage rather than by how often the swarm happened to stage something.

### THE HAND-WRITTEN LIST OF WHAT A SWITCH CLEARS WAS THE BUG

Will: *"does toxic and sleep turns carry over when a mon is switched out and are we tracking relevant
things like that"*. Toxic was his EXAMPLE; the class is the answer.

`Pokemon#clearVolatile()` is `this.volatiles = {}` — wholesale, no membership — so the authority has ONE
rule for every volatile. Ours emptied `_vol` three members at a time, and its own comment already filed
taunt/encore/disable as known-wrong. **Eleven more were surviving**: aqua ring, destiny bond, electrify,
focus energy, gastro acid, magnet rise, minimize, power trick, smack down, stockpile, torment. Six have
live consumers — a Taunted body came back still Taunted AND its clock had ticked down on the bench.

**Toxic, staged in both engines rather than reasoned about:** at the return, medicham2 75 hp stage 4
against showdown 105 hp stage 1; two turns later ours had FAINTED and the authority sat at 81. `tox` is
the ONLY status in the format carrying a switch handler (`onSwitchIn` sets stage 0); slp, frz, par, brn
and psn all carry, and ours already carried them correctly.

**A third defect nobody went looking for: a switching body was taking every `onBeforeMove` gate.** That
event is raised inside `runMove` and a switch never enters it, so a sleeping body woke two turns early
by pivoting. The file had already filed this as *a pre-existing turn-resolution bug WITH NO FAILING
PROBE ON IT*; there is a probe now.

Three red proofs, each restored byte-identical. One exposed a limit worth keeping: with the clear
disabled, `volatilesClearedOnSwitch` still read +1, because the counting block sits above the
assignment — it counts INTENT, not effect. The outcome assertion caught what the counter could not.

`tests/test-switch-carry.js`, 27 assertions, every expectation derived from the format on each run.
Census 541 live / 0 missing, unchanged — this added an instrument, not a row.

**Flag, unrelated to switching and not fixed:** Toxic does not bypass accuracy for a Poison-type user.
`battle-actions.ts:627` and `:731` set accuracy `true` for `gen>=8 && toxic && hasType('Poison')`. We
have no such branch, so a Venusaur's Toxic emitted `|-miss|` where the authority's landed. Deterministic,
and its own row rather than folded into this pass.

### A BASELINE THAT AGED OUT LOOKED EXACTLY LIKE AN ENGINE FAILURE

`tests/staged_status_counters.js` exited 1 with **all 11 scenarios reading `release THREW`**. Nothing was
wrong with the engine: the pinned BEFORE arm had aged out of the loader that has to open it.

**The requirements are layered and each refusal names only the next one.** The original pin predates
ROADMAP #222's split RNG streams; clearing that revealed a second guard on `spreadL50`. Both are
correct and neither may be worked around — a baseline with welded dice or blank spreads measures
something other than what this file compares, and does it silently.

**30 of 196 snapshots export `rngStreams`, 28 export `spreadL50`, 28 export both. So 168 frozen engines
verify, hold their bytes, and cannot be run.** That is the same distinction `engine_release.js` learned
three times over — a valid DIGEST SET is not a loadable ENGINE — arriving from the opposite direction:
not a snapshot missing a file, but a loader that grew past the snapshot.

Re-pinned to the OLDEST release satisfying both, never the newest that loads. This file has twice
re-pointed its BEFORE arm at a fresh cut and turned the comparison into a copy of the AFTER arm; taking
"newest that loads" would be committing that on purpose.

**10 of 11 scenarios went from unmeasurable to `release IDENTICAL / live IDENTICAL`.** The lost coverage
is stated: the new baseline postdates today's earlier engine work, so anything this file would have
caught in that window is gone. One scenario, `guts-is-not-halved-by-its-own-burn`, throws on BOTH arms
— a fixture defect that was invisible while all eleven were throwing. Registered as #235, not filed.

**MY FIRST RE-PIN WAS WRONG AND THE INSTRUMENT CAUGHT IT.** I read the old release's own `why` string,
took its label for the requirement, and re-pinned on it. A release's description is not the predicate
for opening it. Read the refusal, not the changelog beside it.

### A POISON-TYPE’S TOXIC CANNOT MISS, AND OURS ROLLS FOR IT

Found while auditing what survives a switch, unrelated to switching, and kept out of that batch on
purpose. sim/battle-actions.ts sets accuracy 	rue outright for 	oxic && gen>=8 &&
pokemon.hasType(Poison) — in the SAME condition as move.alwaysHit, above the Accuracy event, so
nothing downstream can put a roll back. We have no such branch: a staged Poison-type’s Toxic emitted
|-miss| where the authority’s landed.

Sized rather than asserted: Toxic is printed at 90 accuracy with **1,209 corpus uses**, and **20 of the
27 legal Poison-type species learn it**, so the exempt population is real.

It is worth more than its usage suggests because it is DETERMINISTIC — not a rate needing a swarm, but
a move that hits every time in the authority and rolls a die here, so one staged fixture decides it.
And the whole-game differential cannot see it: both arms pin accuracy to a corner, so a computed
accuracy never decides an outcome. Same structural blindness that hid the OHKO branch until Will asked.

Registered as #236. It belongs with the never-miss family already answered above the stage arithmetic
in hitChance, beside No Guard and Lock-On, rather than as a special case inside the pipeline.

### A LAYERED REFUSAL TURNS RECOVERING A BASELINE INTO A SEQUENCE OF FULL RUNS

`rngStreams` and `spreadL50` were each checked correctly and DEEP inside the run — one at the
stall-counter setup, one at body construction — and neither may be softened; both are the
silent-default failure this repo is built around. But they fired ONE AT A TIME. Re-pinning
`staged_status_counters.js` went: pin, run, throw on `rngStreams`; scan 196 snapshots, re-pin, run,
throw on `spreadL50`; scan again. Each refusal names only the NEXT missing symbol.

They are in `need` now, so the loader answers in one message before any work is done:

    release 6b5447db1738 was frozen before engine/medicham2-browser.js exported:
      natureL50, rngStreams, spreadL50

The deep checks STAY — they explain why each symbol matters, which a name in a list cannot.

**THE TOOL FOR THIS ALREADY EXISTED AND I DID NOT KNOW.** `engine/engine_release.js compat <file>
<symbols...>` reports every release as PROVIDES / LACKS / PRUNED / UNLOADABLE, and the new refusal now
prints that command. I wrote a scan script to rediscover what it already answers — the same shape as
the mechanics runner existing while nothing gated on it. Its verdict matches the hand count exactly:
**27 of 200 releases can serve this caller, 4 pruned, 168 predate an export, 1 broken.**

The broken one is worth naming: `5e8c391b3f04` is UNLOADABLE with `Unexpected token ')'` — a release
cut from a working tree mid-edit, frozen mid-keystroke. It verifies and it will never run.

### A RELEASE FREEZES THE ENGINE AND NOT THE READER

Will: *"should i be concerned we suddenly cant run old things"*, then *"make sure this never happens
again"*. **168 of 200 releases could no longer be opened**, and essentially no artifact naming one could
be re-run — including `all-mechanics-fire.json`, which carries the 93 move divergences.

Nothing broke. The snapshots verify and hold their bytes; the HARNESS moved. Every symbol added to a
caller's `need` list retroactively strands every release cut before it. **The cause was correct work**:
ROADMAP #222 split the RNG streams so the Protect counter stopped being welded to the accuracy pin, and
`spreadL50` stranded two more. Neither should be undone. The defect is that paying the cost was
invisible — it surfaced as eleven scenarios reading `release THREW`, which reads as eleven broken
mechanics and was one aged-out baseline.

**The rule: do not reproduce a stranded artifact, stop it being citeable.** CLAUDE.md already settles
it — a quarantined number becomes RE-RUNNABLE, meaning re-measured on the current engine. Freezing the
reader alongside the engine was considered and rejected: it doubles every snapshot to answer a question
nobody asks.

Prevention, in three parts: a release now records what it PROVIDES at cut time; a ratcheted check fails
a NEW stranding by name; and the pre-commit hook will run it, because a check somebody has to remember
is the thing LESSONS.md exists to stop. Written up as LESSONS.md §12.

**When a whole population of checks fails at once, suspect the thing they SHARE before the thing they
each test.**

### THE SPREAD WORK I LANDED TONIGHT BUILT AN ILLEGAL BODY ON EVERY FOURTH SLOT

`spreadFor` put `rest` into Special Defence UNCAPPED. At `index % 4 === 3` the ladder gives 0 Speed,
so the whole 66-point budget is free, the attacking stat takes 32, and **the remaining 34 landed in
Special Defence against a 32 cap**. Showdown's TeamValidator refuses it by name — *"Weavile has more
than 32 Stat Points in Special Defense"* — and it was one body in four, on BOTH sides, in every staged
fixture and every game of the whole-game differential.

**It is exactly the failure the spread work existed to end.** The blank-spread version was legal and
unrealistic; this one was realistic and ILLEGAL, which is worse: a validator would reject the team
outright while the differential happily compared two engines playing it.

Fixed by spilling to Defence, which leaves slots 0-2 byte-identical so only the broken one moves, plus
an assertion that refuses any spread over the cap, off-budget, or with points it could not place. Shown
against the authority: slot 3 before carries the extra rejection, slot 3 after carries none.

**I did not find it.** It came back as the third item in a report from an agent sent to repair one
fixture, alongside seven illegal body/move pairs in that same file and the reason they all got in.

### `fixtureAudit` PROVES THE CLICK IS CARRIED AND NEVER THAT THE BODY COULD LEARN IT

Eight illegal pairs are sitting in `tests/staged_status_counters.js` — `Milotic|Will-O-Wisp`,
`Milotic|Calm Mind`, `Milotic|Spore` (x2), `Milotic|Nuzzle`, `Snorlax|Swords Dance` (**nine places**),
`Mudsdale|Swords Dance`, `Incineroar|Iron Defense`, `Tinkaton|Iron Defense`. Showdown's TeamValidator
rejects each one; our fixture audit passes them, because it checks the click is on the body's DECLARED
move list and `buildPair` only checks the move EXISTS. Neither asks the learnset.

One scenario's pair was repaired because it was the one being fixed. The rest are named and left,
deliberately — they sit in currently-green scenarios, and folding eight fixture rewrites into a repair
of one makes any moved result unattributable.

### THE SHIELD IS DECIDED AT ITS OWN ACTION, AND A MEGA MID-TURN RE-SORTS THE QUEUE UNDER IT

My hypothesis was wrong and the real cause is better. I guessed an action existed in Showdown's queue
and not in our `acts`. **Both engines hold the same actions in the same order — the order just moves
after we have already answered the question.**

`sim/battle.ts:2915` re-sorts the whole REMAINING queue after EVERY action in gen >= 8, and
`willAct()` reads that live list when each shield executes. A mega evolution changes Speed mid-turn and
moves a body's place in it. `medicham2` decided every shield in ONE PRE-PASS above the action loop, on
the PRE-MEGA sort.

A real diverging game — three shields and a mega in one turn:

| body | showdown | medicham2 |
|---|---|---|
| p1b (megas; Swift Swim in rain) | `-singleturn` | **`-fail`** |
| p2b | `-singleturn` | `-singleturn` |
| p1a | **`-fail`** | `-singleturn` |

**The authority refuses the LAST shield; we refused the FIRST.** Exactly inverted. Confirmed against the
authority before any edit: four Protects with a Beedrill-Mega going 75 to 145 base Speed — the megaer's
shield HOLDS and the second-slowest body is refused.

The scan, the stall roll behind it, and the raise now happen at the shield's own action, for both
halves of the family, because `onPrepareHit` and the Guards' `onTry` are the same `willAct()` call.

**AND THE 100,806 WAS THE WRONG WAY TO SIZE IT.** The pair moved 115/267 to 114/267 top and 84/267 to
83/267 bottom — ONE GAME PER ARM, and it is the right game: the seed is gone from the diverged list.
100,806 is corpus usage of the ENTITIES named by those causes, not games this fixes. The swarm staged
this shape once in 267. I ranked the queue by usage to stop counting games as the measure of severity,
and then read a usage figure as if it were a count of games. Both readings are wrong in opposite
directions and the honest answer is that the ladder needs BOTH numbers side by side.

Census 541 live / 0 missing to **542 live / 0 missing**. Damage differential agreed 6000, disagreed 0.

**Three things handed back rather than folded in**: King's Shield blocks status moves here and must not
(`onTryHit` returns early on `move.category === 'Status'`, so an Encore that lands in Showdown is
refused here); a Quick Guard announced by a different body; and a flinched or sleeping body still
raising its shield, which has no failing probe on it yet.

### "168 OF 200 UNOPENABLE" WAS MY OWN BROKEN CHECK, AND I TOLD WILL TO BE CONCERNED ON IT

Will asked *"should i be concerned we suddenly cant run old things"*. I answered yes and said one
artifact in twenty-six could be reproduced. **Both figures came out of a check I had written badly
minutes earlier.** The finished check says: **41 artifacts across 21 releases — 29 RE-RUNNABLE, 1
STRANDED, 11 UNKNOWN-PRODUCER, 0 retired.**

**BUG 1, THE UNION.** I unioned every `need` list in `engine/` into one 24-symbol set and held every
artifact to it. But `hitChance`, `ACCMOD`, `MEDSEEN` and `MEDFAILS` are demanded by `million_run.js`
ALONE, and `fails`, `rngStreams`, `spreadL50`, `traceCanon` and `TRACE_EVENTS` by
`game_differential.js` ALONE. So a release that serves the differential perfectly was reported as
stranding the differential's own artifact, for a symbol the differential has never read. An artifact
must be judged against the caller that PRODUCED it.

**AND "168 OF 200" IS ONE CALLER'S NUMBER WEARING THE STORE'S NAME.** Per caller, over 201 releases:

| caller | can serve it |
|---|---|
| `game_differential.js` | **28** |
| `million_run.js` | 97 |
| `replay_differential.js` | 140 |
| `speed_vs_pokeenv.js` | **196** |

The union is dominated entirely by the strictest caller, so `data/release-census.json`'s `runnable` is
a lower bound for every caller but one.

**BUG 2, THE PARSER WAS READING PROSE.** `medicham2-browser.js` interleaves block comments INSIDE its
`module.exports={...}` literal, so splitting on commas glues each comment to the key after it: **11 of
78 exports lost**, `hitChance` and `fails` among them, and the `root.` arm **invented four out of prose
— one of them the word `deliberately`**. The same hole `provenance.js`'s `writesNear` had.

**The `provides` field I added to the manifest had it too**: the one release carrying it recorded 71
against a true 78, including `Earthquake`, `Snarl` and `deliberately`. Kept — it is the only record of
a PRUNED release's surface — but now audited against the loader on every run and never rewritten to
make a check green.

**THE PARSE IS GONE.** `engine_release.js` already answers this by LOADING the frozen module
(`surface()`), at 18ms across 23 releases, so there was never a cost argument for a second
implementation. I hand-rolled one anyway. That is the same shape as the mechanics runner existing while
nothing gated on it, and as `compat` existing while I wrote a scan script.

**The red proof reproduces the actual event**: adding `rngStreams` to `replay_differential.js`'s `need`
list — exactly what #222 did to the differential — strands its five artifacts BY NAME and moves nothing
else, which is also the proof that the per-caller scoping works.

`all-mechanics-fire.json`, which carries the 93 move divergences, is **not stranded** — its release
opens. It is UNKNOWN-PRODUCER because it records no `by`. Stamping one is the whole cost of moving it
into a judged band.

### THE MECHANICS RUNNER, RE-RUN ON THE SETTLED ENGINE

Release e7e64db837b1, 1,401 games, 0 threw, red proof green. Against the 2026-08-11 run:

| | 08-11 | today |
|---|---|---|
| moves diverged | 93 | **76** |
| resolution disagreements | 28 | **17** |
| abilities FIRED | 59 | **70** |
| abilities diverged | 20 | 33 |
| items diverged | 3 | 3 |

**Seventeen move divergences gone.** Abilities DIVERGING rose because abilities FIRING rose — a mechanic
that never happens cannot disagree, so more coverage finds more defects. That is the preflight weather
repair paying out and it is the right direction, not a regression.

The split that did not exist before: **13 abilities and 6 items read cannot_fire_in_this_fixture** with
the failing clause named, against 76 and 55 did_not_fire_unexplained. One is a harness defect and the
other an engine defect; they were one bucket this morning.

The gate clause now states something TRUE rather than refusing on staleness: **112 mechanics disagree
with the authority when staged so they actually resolve.** That is the number to drive to zero, and it
is weighted by the format rather than by what a sampler happened to click.

### THE FIXTURE AUDIT PROVED A CLICK WAS CARRIED AND NEVER THAT THE BODY COULD LEARN IT

Three clauses: the slot count, the move EXISTS, the move is on the body DECLARED list. None asked the
learnset. So a fixture could declare any moveset it liked and pass, and **seven illegal pairs were
sitting in green scenarios** — Snorlax|Swords Dance in NINE places, Milotic|Will-O-Wisp,
Milotic|Spore, Milotic|Nuzzle, Mudsdale|Swords Dance, Incineroar|Iron Defense, Tinkaton|Iron Defense.

It matters because the whole point of a staged fixture is that the game could produce it. A board
Showdown refuses at team validation is not a weaker test, it is a test of a position that cannot
occur — the same class as the blank-spread rig testing turn order in the one configuration where turn
order cannot be got wrong.

TeamValidator#checkCanLearn is the authority and is asked directly: it handles prevo chains,
event-only moves and every mod override for free, and it returns the game own words on refusal. A
hand-rolled learnset walk gets the common case right and the interesting cases wrong, which is the
worst split for a check whose whole job is the interesting cases.

**RATCHETED, because the clause is new and the violations are not.** Repairing seven fixtures changes
what seven scenarios measure; folding that into the pass that ADDS the check makes both
unattributable. Known pairs are REPORTED and do not fail; a new one fails by name. Keyed
(species|move) rather than (scenario|slot|turn), so the same illegal pair moved to a tenth scenario
reads as new rather than as pre-existing.

**Red proof by breaking the RATCHET rather than a fixture**: remove mudsdale|swordsdance from the
baseline and it fails by name with 0 marked KNOWN; restore it and the file is green with that line
marked KNOWN. Both restored byte-identical.

### THE RE-RUNNABILITY GUARANTEE IS ARMED, AND IT WAS NOT UNTIL NOW

Will: *“make sure this never happens again”*. I said the pre-commit hook was the guarantee and then
did not arm it — a check that has to be REMEMBERED is precisely what LESSONS.md exists to stop, so the
promise was worth nothing while it sat unwired.

	ests/test-artifact-rerunnable.js now runs in the hook beside the docs-currency and roadmap gates,
under the same scope guard, so a pure artifact regeneration still commits freely.

**Proved by breaking the RATCHET rather than a caller**, which keeps the blast radius to one JSON file:

    BLOCKED by tests/test-artifact-rerunnable.js
      FAIL  no artifact became unre-runnable since the baseline
            (NEW: nature-arms.json — lacks rngStreams, spreadL50)
    exit 1

    ratchet intact -> pre-commit: green, exit 0

**Two false starts, both mine and both worth recording.** The first mutated iles AND stranded
together, so the count clause passed and masked the set clause — a proof that changes two variables
establishes nothing about either. The second staged only .githooks/pre-commit, which the scope guard
correctly ignores, so the hook exited 0 without ever reaching its loop and I nearly read that as the
hook failing to block. **A guard that skips is not a guard that passes**, and telling those apart
needed reading the output rather than the exit code.

### THE [from] FAMILY: 112 MECHANIC DIVERGENCES DOWN TO 89

Re-derived from tonight's fresh artifact rather than my stale figure: **25 rows, 9,332 uses, 30.2% of
diverging usage** — still the largest single family, and the two classes above it by usage are
grab-bags rather than families. Census 542 to **552 live, 0 missing**.

| | before | after |
|---|---:|---:|
| moves | 76 | **57** |
| abilities | 33 | **29** |
| items | 3 | 3 |
| total | 112 | **89** |

**`fullname` IS PER-NAMESPACE AND THAT IS THE TRAP.** `move: X` / `item: X` / `ability: X`, and
everything else is the BARE name — which is why Steel Beam prints `[from] steelbeam` and not
`[from] move: steelbeam`. Five shaped readers, each read off its own emit site.

**TWO FIXES REMOVE AN ATTRIBUTION RATHER THAN ADD ONE**, which I had not seen. Strength Sap emitted
`[from] move: strengthsap` where the authority emits the heal BARE, and every status-curing item plus
Healer wrote an attribution onto a `-curestatus` the authority reaches through a bare `cureStatus()`.
Three more of that shape had no register row. So the family was never only "missing tags" — it is "the
attribution does not match", in both directions.

Infestation was the wrong-tag case that WAS predicted: fixed by carrying the move on `_trap`, so the
seven trapping moves now print seven different strings instead of all saying `partiallytrapped`.

**WILL CHALLENGED THE STRENGTH SAP CHANGE AND IT SURVIVED, BY PLAYING IT.** He pointed out the user has
to be hurt for the heal to show at all, and that the target's Attack drop is visible too — both true.
Staged in the real simulator:

    |move|p1a: Vileplume|Strength Sap|p2a: Venusaur
    |-unboost|p2a: Venusaur|atk|1
    |-heal|p1a: Vileplume|150/150          <- BARE, no [from]

The causation is carried by the SEQUENCE — the `|move|` line, then the unboost, then the heal — not by
a tag. At full HP the heal is 0 and prints nothing, exactly as he said, which is why the user had to be
set to 75/150 first. **My fixture failed twice before it produced that**: first the target was on
Protect so the move was blocked, then I reached for Tackle, which no legal body in this format learns.
Both were the fixture, never the mechanic.

**The red proof is the shape that matters**: three deliberate OVER-attribution breaks, and all four
probes failed on the CONTROL arm. A derivation that simply tagged everything would pass the positive
arm and fail exactly there. `attrNamed` 33 / `attrBare` 30 over 537 traced turns — a zero on the bare
half would mean it had become "tag everything".

The two rows left are not attribution: `disable` (field 4 there is the DISABLED MOVE, not a cause) and
`afteryou`, whose first divergence moved to a pre-existing defect this exposed.

**A DESIGN SMELL FOUND WHILE EXPLAINING 38 RAPID RELEASE CUTS**: `all_mechanics_fire.js` requires
`game_differential.js`, which cuts a release at MODULE LOAD — so merely IMPORTING the runner mints a
release. Benign and explained, but requiring a module should not mutate the release store.

### CORROSION HAS NO HANDLERS, AND THAT IS A CLASS RATHER THAN A CURIOSITY

Will asked whether the ability that poisons Steel types is even in the regulation. It is — **Corrosion,
legal, Salazzle and Glimmora, 36 corpus uses** — and it has **ZERO `on*` handlers**. It is a name
written into the immunity check itself (`pokemon.js:1257`), not an ability hook.

Ten abilities are named directly in `dist/sim/*.js` rather than reached through a handler, and three
carry no handlers at all. **Levitate is the expensive one: 3,186 corpus uses, 0 handlers.**

**Every derivation built today reads HANDLERS** — the per-ability trigger derivation, the preflight
trigger clauses, the ACCMOD sweep, the residual-order table. All are structurally blind to this shape,
and a sweep reporting "no handler, nothing to check" is reporting its own blind spot as a clean bill.
`data/tags.json` does carry rows for both, so `tag_dex` reached them another way — but that is a second
derivation happening to cover the gap rather than coverage by design, and nothing checks the two agree.

**The concrete cost, from a diverging game the same night**: Toxic into a Steel Scizor — the authority
emits `-immune`, we emit `-miss`, because our poison immunity check runs AFTER the accuracy roll. And
fixing it as an ABSOLUTE immunity would have been wrong the other way, because a Salazzle Toxic into a
Steel body lands. Will caught that before it shipped. Registered as #237.

### SIXTY DIVERGING GAMES, RENDERED FOR READING

`--dump-games` takes a COUNT and only writes alongside `--write` — I passed it bare twice and read the
stale 25-card file as the result. Corrected: 60 of 202, with context, published as a page so the split
line is readable rather than a wall of pipes. Protocol lines are broken into fields, the `[from]` clause
is kept and emphasised (dropping it made two cards render identically earlier tonight), and the two
sides are coloured so agreement is the quiet part.

Class spread of the 60: 14 `showdown stopped emitting while medicham2 continued`, 14 `event missing`,
9 `ordering`, 8 `extra event emitted`, 6 `switch: a different body`, 4 `unrelated event mismatch`,
5 field mismatches. **The top class only exists because of tonight's truncation fix** — before it, those
14 games counted as agreement.

### KING'S SHIELD, THE TOXIC BYPASS, AND THE -immune EMISSION — THREE ROWS CLOSED

Census **552 → 556 live, 0 missing**. Damage differential agreed 6000, disagreed 0.

**#238 KING'S SHIELD.** `Battle#checkMoveBypassesProtect(move, attacker, defender, blockStatus = true)`
— and **the argument count is the entire split**. Protect, Detect, Spiky Shield and Baneful Bunker pass
three arguments and take the default `true`; King's Shield passes `false`. Fourteen call sites here held
the identical `t.protect && !TAGS.has(...,'ignoresProtect')` pair, modelling `flags.protect` and nothing
else. All fourteen now read one `shieldRefuses()` off a derived `shieldsUser.blocksStatus` — membership
printed before wiring: **5 members, exactly one `false`**.

**#236 TOXIC.** Landed above the stage arithmetic AND above the OHKO branch, because the authority
writes `accuracy = true` BELOW `if (move.ohko)` and overwrites it, while our #230 OHKO branch RETURNS —
so a clause underneath could never run and the precedence would silently invert. No move is both today;
it is the authority's order rather than a coincidence.

**#239, AND IT IS THE ONE I HAD DIAGNOSED WRONG.** `Pokemon#setStatus` reserves `-fail` for a body that
ALREADY CARRIES the status and answers an immunity with `-immune`. Our emitter wrote `-fail` for both,
and its own comment asserted the opposite. The attribution is read off the refusing ability's own
handler — **Magma Armor is why**: it refuses through `onImmunity`, carries no tag row, and is announced
bare, so composing `"[from] ability: " + id` produces a line the authority never writes.

**FOUR THINGS I TOLD WILL THAT WERE WRONG:**

| I said | measured |
|---|---|
| Toxic has 1,209 corpus uses | **1,216** |
| 20 of 27 legal Poison types learn Toxic | **all 27** — the 20 was the non-mega count |
| the poison immunity check must PRECEDE the accuracy roll | **it does not, and should not.** `hitStepAccuracy` is step 4, `setStatus` is step 7. A NON-Poison Toxic user into Scizor misses 13/100 and prints `-immune` the other 87 |
| the Toxic→Scizor card was an ordering defect | it was #236 — the card's user was Toxapex, a Poison type, so it never rolled |

**Corrosion needed no work** — already derived and probed under #175 as
`nameImplementedBySim.ignoresStatusImmunityFor = ['tox','psn']`. Salazzle and Glimmora each land Toxic
on Scizor 100/100 in both engines, so the never-miss branch and the immunity do not fight.

**RED ON ARRIVAL, NOT FIXED, NOT FILED**: `tests/test-no-silent-failure.js` exits 1 — **79 new silent
catch blocks since the 2026-08-06 baseline**, across ~25 files, spread thinly (3 in `mega_census.js`, 3
in `medicham2-browser.js`, 3 in `game_differential.js`, 3 in `million_run.js`, 2 each in four more).
The agent that found it correctly refused to re-baseline, which would launder a week of other divisions'
work into its own pass. It is named here with its count rather than carried as a status.

### THE DIVERGENCE VIEWER IS A TOOL NOW, NOT A SCRATCH SCRIPT

Will: *"keep this a template so we can easily use it in the future if need be"*. It is
`engine/divergence_cards.js`, with `--in` / `--out`.

Every part of it came from a specific complaint rather than from taste. Slot codes become species names
coloured by side, because *"p1a is hard to read"*. Health becomes a bar plus a fraction plus a percent,
because *"can you make clear the health an stuff"* — and a status suffix is KEPT, since `49/170 brn` and
`49/170` are different boards. Events become verbs. Megas get their own highlight, because the first
render showed raw protocol and the question was *"why arent the mons mega evolving"*. The lead-in went
from four lines to sixteen, because four crops off the `|move|` that caused the split. And the `[from]`
tag is emphasised rather than stripped, because stripping it once made two cards render identically and
Will correctly said there was no difference to see.

**It computes NOTHING.** Every number on the page came out of `game_differential.js`. A figure whose
only home is a rendering is a figure no gate can check.

Two flags cost a wasted run each and are now written at the top of the file: `--dump-games` takes a
COUNT rather than being a bare flag, and the dump only writes ALONGSIDE `--write`. Both times the stale
file on disk was read as the fresh result — the same shape as every other stale-artifact failure here.

**AND CARD 1 IS WHY THE WIDER CONTEXT MATTERED.** With four lines of lead-in it read as an unexplained
extra `|switch|`. With sixteen it reads: both of p2's active bodies faint, the authority ends the
battle, and **we send in a replacement**. That is either a bench that should not exist or a lost count
of who has fainted, and it sits in the class that only became visible tonight — before the truncation
fix it counted as agreement.

### THE DUMP WAS ONE CORNER, AND THE VIEWER'S OWN HEADER WAS TYPED. 2026-08-13

Two things Will asked for, and the first is a hole in the instrument rather than a preference about the
page.

**The dump had only ever shown `top-tie-first`.** `if (DUMP_GAMES && diverged.length)` reads
`diverged = results.filter(r => r.div)`, and `results` is the PRIMARY arm — the corner where every
sub-100-accuracy move MISSES and no secondary fires. Will: *"can we also include ones from the bottom
where everything hits and it doesnt line up? that would provide more interactions for possible failure
that i can see."*

He is right about the reason, and it is stronger than "more variety". That corner makes a whole class of
mechanic **untestable by construction**. Magic Bounce cannot be wrong about a Hypnosis that missed. No
secondary can be mistimed if none fired. No berry can race a recoil that never landed. Every one of
those is reachable only in `bottom-tie-first`, which the dump had never once sampled. The arms are
interleaved now, so a reader who stops halfway has seen both, and each card carries its arm because a
defect in one corner is a narrower claim than a defect in both.

| arm | diverged | of 1,539 |
|---|---|---|
| top-tie-first | 309 | 20.1% |
| bottom-tie-first | 346 | 22.5% |

**A switch now names what it replaced.** Will: *"and include the clear switch ins"*, and earlier,
reading a card, *"when we switch in a mon like it did with greninja it should say what it swapped for"*.
A bare `sends in Greninja` hides the half that decides what the switch MEANT — a pivot, a forced
replacement after a faint, and a lead arriving are the same line in the protocol. Slot occupancy is
tracked through each card's own lead-in; 207 switches across the 80 published cards now say who left.

**AND THE VIEWER WAS CARRYING THREE FALSE NUMBERS, IN THE TOOL BUILT TO CATCH THAT.** The section above
says it computes nothing, which is true and is exactly why nobody audited it. It *rendered* three:

| the page said | true | why |
|---|---|---|
| "Sixty diverging games out of 209" | 80 of 655 | typed into the template |
| "209 / 815 diverged" | 309 and 346 of 1,539 | typed into the template |
| "80 of 160" — after the first fix | 80 of 655 | `of_diverged` tallied the POOL, capped at 2× the dump |

The third survived a fix, and that is the one worth keeping. Deriving a number is not enough when the
field you derive it from is a cap wearing a population's name. Same error as the coverage credit before
ROADMAP #91: a figure SMALLER than the truth still misleads, because it is read as the truth.

**A page that renders a measurement is part of the measurement**, and gets an artifact's treatment —
every number derived, every narrowing declared, the sample never allowed to wear the population's name.

Also fixed: a card from a non-primary arm reached the renderer with no `_cls`, because the loop that
stamps it walks the primary arm only. It would have rendered as `unclassified` — the classifier
appearing to have no opinion when it had never been asked.

*(One flag note in the section above is now stale and is corrected here rather than rewritten: the dump
no longer requires `--write`. ENGINE removed that gate on the same night, for the right reason — it
forced publishing a measurement in order to debug one.)*

### A VIEWER THAT INVENTS A DEFECT IS WORSE THAN ONE THAT MISSES IT. 2026-08-13

Will read card 3 and asked *"but look at how busted our switches are, they are replacing themselves?"*
The page showed `Sinistcha sends in replacing Sinistcha`. **The engine was fine and the renderer was
lying.** Slot occupancy was module state; Showdown's panel rendered first and wrote its own outcome
into it, and ours then read that back as the previous occupant.

The two panels are not sequential — they are **the same instant, two futures**. Occupancy is
snapshotted after the shared lead-in and restored before each side.

Two things this leaves behind, both bigger than the bug:

**A rendering can manufacture evidence.** Every other instrument here is guarded against reporting a
clean result it did not earn. This one reported a DIRTY result that never happened, and the only reason
it was caught is that a human found it implausible. Same category as the fourteen stale handoffs: an
artifact stating something nobody derived.

**"Both engines identical" was never true.** The grey block renders our stream and the engines agree
there only after the seven equivalences are applied — which is why `|-resisted|p2b: Sinistcha|1` sat
inside a block claiming both sides emitted it. Showdown's only `-resisted` site emits no third field;
ours appends a resistance depth (`Math.min(Math.round(-log2(mult)), 2)`). The label says "agree" now,
with the normalisation stated on the page rather than known only by whoever wrote the comparator.

**And the same reading session produced three engine rows — #240, #241, #242.** The ratio is worth
noticing: one night of a human reading rendered games found more than the automated classifier had
surfaced in a week of runs, because the classifier says what SHAPE a disagreement is and never which
engine is right.

### THE RE-SORT TRIGGER IS ONE RULE, AND WE HAD IT WRONG IN BOTH DIRECTIONS. 2026-08-13

ROADMAP #240, closed. Will, reading a published card: *"i bet the ttar sandstorm activates excas sand
rush so its suddenly faster?"* — right about the mechanism, inverted about who does it.

`battle.js` re-sorts the action queue after **every** action, but the guard passes only when the NEXT
queued action is a `move`:

```js
if (this.gen >= 8 && (this.queue.peek()?.choice === "move" || this.queue.peek()?.choice === "runDynamax")) {
  this.updateSpeed();
  for (const a of this.queue.list) if (a.pokemon) this.getActionSpeed(a);
  this.queue.sort();
}
```

So on a turn where all four slots switch, nothing is ever recomputed and every switch keeps the speed
stamped at turn start — before Tyranitar arrived, before the sand. Excadrill's Sand Rush is live and
simply never read. We recomputed.

**THE FIX IS THE TRIGGER, AND THE TWO OBVIOUS PATCHES ARE BOTH WRONG.** "Switches don't see the
weather" and "weather doesn't change speed mid-turn" each reproduce this card exactly and each fail the
moment somebody clicks a move, because then the re-sort DOES fire and Sand Rush DOES apply to
everything still queued. The same board gives opposite answers depending on what else was clicked, so
only the real condition reproduces it.

**AND IT IS THE SAME RULE AS #232, SEEN FROM THE OTHER SIDE.** That row closed by moving the Protect
`willAct()` scan to the shield's own action *because* the authority re-sorts mid-turn. This one is the
half where it does not. `willAct()` and the re-sort now read one action-kind mapping, and the probe
makes the coupling visible rather than assumed: breaking this fix to "never re-sort" drops the census
to **552 live / 6 missing**, and the six include #232's own mega probe.

| | |
|---|---|
| census | 557 → **558 live / 0 missing** |
| damage differential | agreed 6000, disagreed 0 — unchanged, and that is the expected reading: a single-hit instrument cannot see a turn order |
| whole-game, 300-game pinned pair, two releases differing in one token | top **98/260 → 97/260**, bottom **93/260 → 91/260** |
| attributable | exactly one class moved on the primary arm — `ordering`, 16 → 15 games. Every other class unchanged to the instance |

**Small, and said as small.** The register row's corpus figures are usage of the entities named, not
games fixed — the same distinction #232 had to correct after reading 100,806 clicks as a count of
games.

**Two adjacent defects declared and NOT folded in**, because a batch that fixes three things cannot
attribute a result to any of them: `getActionSpeed` re-derives PRIORITY as well as speed on every
re-sort — a comment in this repo asserted the opposite, and the comment is corrected — and
`eachEvent('Update')` sorts on the authority's CACHED speed, refreshed only by `updateSpeed()`, where
ours recomputes every time.

**WHERE THIS CAME FROM IS THE PART WORTH KEEPING.** Three engine rows came out of one evening of Will
reading rendered games, and the classifier had surfaced none of them. It can say a disagreement is
`ordering`; it cannot say which engine is right. That is not a gap a better classifier closes.

### A SMALL VERIFICATION RUN OVERWROTE THE PUBLISHED DIFFERENTIAL, AND THE DOCS GATE CAUGHT IT. 2026-08-13

`tests/test-docs-current.js` went red on **one new row**: `docs/MEDICHAM-SPRINT-NOTES.md:5426  6000
not in data/engine-diff.json`.

The line it flagged is WEEKS OLD and was never wrong. What moved was underneath it: an agent ran
`test-engine-diff.js` at **n=150 with `--write`** as a quick check, and that overwrote the published
artifact — `requested: 150, compared: 150, agreed: 150` — orphaning every document that cites the
6,000-comparison run. The claim did not become false; **its evidence was deleted.**

**THE FIX WAS TO RE-RUN AT THE PUBLISHED SIZE, NOT TO EDIT THE SENTENCE.** `--n 6000 --write`, and the
gate went green. Editing the docs down to 150 would have quietly reduced a published result to
whatever the last person happened to type on a command line.

Two things worth keeping:

**A GATE FIRED ON A LINE NOBODY TOUCHED, WHICH IS THE POINT OF IT.** Every other check here compares a
document to itself. This one compares a document to an ARTIFACT, so it notices when the ground moves
under prose that is still sitting still — the same failure as the fourteen stale handoffs, caught this
time in seconds instead of in days.

**`--write` ON A VERIFICATION RUN IS A HAZARD AND THE HABIT SHOULD CHANGE.** The whole-game
differential already learned this — its dump is deliberately writable without `--write` precisely so a
debugging run cannot clobber a measurement. `test-engine-diff.js` has no such separation: any `--n`
plus `--write` republishes. A verification run should either omit `--write` or use `--out`.

Also declared in the same pass, because the roster gate names them and a red gate is not a status:
**six generators that appear in neither the ledger nor the Stadium** — `divergence_report`,
`million_run`, `mod_audit`, `open_work`, `residual_order`, `speed_vs_pokeenv`. Every one is an
instrument or a report rather than a model: they read the format, the store or the register and print
what they found. Two of them were written on 2026-08-12/13 and went undeclared on the night they were
built, which is exactly the hole that check exists to find. `residual_order`'s declaration carries its
own known defect (ROADMAP #242) rather than presenting it as complete.

### THE ROW SAID "ONLY THE LINE IS WRONG" AND A SWEEP SAID TWELVE ROUTES AND TWO DEAD MECHANICS. 2026-08-13

ROADMAP #241 parts (1) and (2), landed. Census **558 → 561 live / 0 missing**, three probes, all three
shown RED before a byte moved.

**THE SIZING WAS RIGHT AND THE SCOPE WAS NOT, AND THAT DISTINCTION IS THE LESSON.** The row was written
off a measurement — 21 of 241 distinct causes name `-fail`, Good as Gold the largest at 4 — and that
part held. What it also said, from reading the code, was that *"the refusal itself is already correct
and already implemented; only the LINE is wrong."* A sweep over **all 78 legal foe-aimed Status moves ×
8 bodies, 624 cases**, found:

- **twelve action kinds** route a foe-aimed status move, and they gave **four different wrong answers**
  — `|-fail|` on the mover, nothing at all, an unattributed `|-immune|`, and a `-fail` on the target
  *plus* one on the mover;
- **Lock-On and Heal Pulse had no refusal whatsoever.** A Lock-On at a Gholdengo applied its guarantee.
  A Heal Pulse healed it. Those are not narration defects at all.

A code read said "one line". An exhaustive stage said "twelve routes and two mechanics that do not
refuse". **The sweep cost one pass and would have cost a shipped half-fix**, which is the argument for
enumerating the space rather than grepping the site.

**THE FIX SHARES #239'S READER RATHER THAN COPYING IT.** `announcesWith` comes off `onTryHit` through
the same `immuneAttrIn()` that #239 built for `onSetStatus`, extracted to the top of
`engine/tag_dex.js`. Two readers for "which ability announces this refusal, and how" would have
disagreed eventually and invisibly — FACTS ARE GLOBAL. Membership printed before wiring:
`refusesStatusMoves` has **exactly one member**, 0 of 7 `statusImmune` rows moved, 1 row in the whole
artifact changed.

**THE DIFFERENTIAL MOVED BY THREE GAMES AND ONE ARM WENT THE WRONG WAY, AND THAT IS THE HONEST
HEADLINE.**

| | before | after |
|---|---|---|
| top-tie-first | 221 / 1216 | **218** |
| bottom-tie-first | 237 / 1216 | **244** |
| `unrelated event mismatch` | 33 games / 30 causes | **27 / 25** |
| `drag: a different body` | 21 / 21 | 25 / 25 |

All seven target causes vanished BY NAME. Four of the seven were then replaced by a *later* divergence
in the same game, and three of the four new `drag` causes name Gholdengo — **which is what removing an
early stop looks like**: the game no longer parts at the refusal, so it runs on and parts somewhere
else. The class that was supposed to shrink shrank; the total barely moved. 3,043 corpus uses counts
ENTITIES ON SHEETS, not games, and a narration fix cannot move a board that was already agreeing. No
strength claim was made and none is available.

**FOUR THINGS LEFT WRITTEN DOWN INSTEAD OF HALF-FIXED** — registered as #255 and #256. The largest:
**Good as Gold refuses ALLY-aimed status moves in the authority** (`target !== source`, measured on
Decorate, Coaching, Skill Swap and Heal Pulse) and every branch here is `_isFoe`-gated, so a Gholdengo
accepts support from its own side that Showdown refuses. That is a REFUSAL defect inside an EMISSION
pass, and folding it in would have made the three-game move above unattributable. It gets its own
before/after.

### THE FALLEN COUNT WAS WRONG AT BOTH ENDS OF THE TURN, AND FIXING IT MOVES NOTHING. 2026-08-13

ROADMAP #243 and #246, closed together because they are one fact at two moments. Census **561 → 564
live / 0 missing**. Both came out of Will asking whether we had ever tested Supreme Overlord and Last
Respects — the probes said yes and were right, and the question found three defects underneath them.

**THE AUTHORITY MEASURED FIRST**, on the real simulator, one board, one varied knob:

| lead | ally alive | ally KO'd earlier in the SAME turn | ratio |
|---|---|---|---|
| Houndstone, Last Respects | 36 | **69** | **×1.917** |
| Kingambit already out, Supreme Overlord | 70 | **70** | **×1.000** |

That is the entire design in two rows, and it is why these two mechanics must not share an
implementation: **Last Respects re-reads at every use; Supreme Overlord freezes its count at entry and
never re-reads.** `side.totalFainted++` lives in `faintMessages()`, which runs after every move.

**OURS:**

| fixture | before | after |
|---|---|---|
| Last Respects, same-turn kill (#243) | 51 → 51, ×1.000 | 51 → **101**, ×1.980 |
| Last Respects, first action, 0/1/2/3 fallen (#246) | **51 / 51 / 51 / 51** | **51 / 101 / 151 / 201** |
| Supreme Overlord control, ally dies while it stands there | ×1.000 | ×1.000 |

Four identical numbers across a four-way knob is what an unwired knob looks like — `battleInit`'s
literal `sfA:{fainted:0}`.

**THE NEGATIVE PROBE HAD TO BE BROKEN ON PURPOSE TO MEAN ANYTHING.** The Supreme Overlord control
asserts that something did NOT happen, so it passes on the unfixed engine and proves nothing there.
Shown red under a deliberate break instead — `_fallenStuck` swapped for `_sf.fainted` at the boost
site gives **563 live / 1 missing naming exactly that row**, while the pre-existing `boostsFromFallen`
probe stayed green, which is the pair of facts that says the break was specific. Reverted, and the
engine verified byte-identical to the frozen AFTER release.

**IT MOVES NOTHING IN THE DIFFERENTIAL AND THAT IS THE RESULT.** Two frozen releases verified to differ
in exactly one file, same pool, 1,219 games, both arms: **220 top and 239 bottom, before and after,
identical, every class row unchanged to the instance.** Mode A's pins rarely produce a same-turn kill
followed by a Last Respects from the survivor. **The reason to land it anyway is that the ROLLOUT is
where it bites** — measured the same night at **8.75% of open-sheet decision points**, mean 1.67 fallen,
Last Respects owed 133.5 BP and priced at 50 — and the differential is structurally unable to see that.
An instrument that cannot see a defect is not evidence the defect is small.

**THE CAP, DERIVED RATHER THAN ASSUMED.** `Math.min(att._sf.fainted, 5)` is not the authority's, which
has no cap at all. Ours first binds at six fallen allies and a bring-4 game tops out at three, so **it
can never bind.** Left in place — removing a dead guard inside a timing fix breaks attribution — and now
named in a comment so it stops reading as Supreme Overlord's cap of five, which is real and is a
different rule.

**AND TWO PIECES OF TIDYING THAT ARE THE SAME LESSON TWICE.** `tests/test-rollout-fallen.js` carried
the note *"battleInit stamps fainted:0; the recount is at turn end"* — true when SEARCH wrote it, false
an hour later. Its NUMBERS were right; only the explanation had outlived the engine. And the block that
REPORTED the t=0 defect is now an ASSERTION. Reporting was correct while nobody in that division could
turn it green — that is the alternative to the banned phrase — but **a report that survives its own fix
leaves the regression unguarded and goes on printing as though the defect were live.**

### "PRE-EXISTING" IS DOING THE WORK "KNOWN FAILURE" USED TO DO. 2026-08-13

`tests/test-no-silent-failure.js` has been red all week. Three separate agent reports named it and
moved on, and **each of them was individually correct** — none had caused it, and each said so
plainly rather than filing it. The sum of three correct observations is a check nobody acts on, which
this repository has already written down as not being a check at all.

The banned phrase has a synonym now and it is *"pre-existing"*.

**THE INSTRUMENT WAS AUDITED BEFORE THE DEBT**, because the alternative is fixing 78 things to satisfy
a broken detector. It is sound: the baseline is keyed by a **hash of the catch body**, not by a line
number, so it survives edits elsewhere in a file. This is real debt, not drift.

| | |
|---|---|
| catch blocks | 744 |
| silent (say nothing) | **296 (40%)** |
| of those, MANUFACTURE a value | **101** |
| merely skip / continue | 195 |
| baselined 2026-08-06 | 220 |
| fixed since | 2 |
| **NEW since** | **78** |

**The MANUFACTURE class is the project's named failure mode in its purest form** — a capability
absent, a made-up value handed downstream, and everything reporting success. It is the same shape as
the player that had never read a team sheet and the joint layer that fell back on 100% of eligible
turns.

**READING THREE BLOCKS FOUND TWO FALSE POSITIVES AND THE INFERENCE FROM THAT WAS WRONG.**
`engine/game_differential.js:2656` counts its failure through `STATE_FAILS.x = (STATE_FAILS.x || 0) + 1`
and `:1783` sets a null that the very next line reports — both doing exactly what the gate's own
advice asks. The detector recognised `++` and `+=` and missed the `(x || 0) + 1` idiom, which is the
form used wherever the counter lives on an object that may not have the key yet. Fixed, and it is the
**fourth** correction of this kind in that file, each with the same justification: *a ratchet that
flags code for doing what it asked is how a ratchet gets ignored.*

**AND THEN THE MEASUREMENT CONTRADICTED THE SAMPLE.** Two false positives in three blocks suggested a
badly over-firing gate. The fix cleared **2 of 80**. A rate inferred from three cases was wrong in
exactly the direction that would have excused the debt — and if the detector fix had been shipped
without re-counting, "the gate was over-firing" would have gone into the record as the finding.

**NOT RE-BASELINED.** `--update` exists and would turn a week of debt into the floor in one command.
Registered as ROADMAP #258 with the numbers attached instead; the unit of work is the MANUFACTURE
subset, per file, owned by whichever division owns the file.
