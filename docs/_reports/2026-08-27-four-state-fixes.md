# Four state fixes, landed one at a time, measured between each

2026-08-27/28, ENGINE. Dated findings record. Not a living document; not current state. Superseded by
the register rows and the census it feeds.

---

## THE FOUR DELTAS, ONE LINE EACH, WITH BOARD-MATERIAL AFTER EVERY ONE

| # | patch | census | the clause that moved | board-material |
|---|---|---|---|---|
| 1 | **the `status` road asks `shieldRefuses`, not a bare `t.protect`** (`#519`) | 766 → **767** | none — the gate was already 5 of 8 | **0 of 961** |
| 2 | **Belch is gated on the berry latch** (`#514`, closed) | 767 → **768** | roster **moves FAIL → PASS**; gate 5 of 8 → **6 of 8** | **0 of 961** |
| 3 | **Smack Down's airborne gate, its consume, its cancel, its `-start` label** (`#517`) | 768 → **771** | mechanics **4 of 11 → 3 of 10** | **0 of 961** |
| 4 | **Shell Side Arm picks its category** (`#518`) | 771 → **773** | mechanics **3 of 10 → 2 of 9** | **0 of 961** |

**BOARD-MATERIAL HELD AT ZERO AFTER ALL FOUR.** Whole-game held at **1 of 961** (6 raw, less 5
declared) throughout. Damage **0/6000 at all sixteen corners** after every patch. Roster
**139 / 129 / 475** with **0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE** in every stage; red
demonstrations **18/18, 29/29, 34/35 → 35/35 CAUGHT**. `PIN_DIGEST ccb365985023`, `DICE_MODEL v5`,
unmoved — none of the four adds a stream or an address category.

Releases, one per landed patch, each passed explicitly to every instrument:
`ccd5c7f5a5d7` → `cff226e4eef5` → `ee6db42728f7` → `d29f6677bc76`.

**PREDICTED BEFORE EACH RUN AND STATED AS SUCH:** all four are LAB mechanics under Will's 2026-08-23
ranking. In `data/team-pool-frozen` (13,214 bo3 + 4,167 ots = 17,381 games): Smack Down **0**, Belch
**3**, Shell Side Arm **24**, King's Shield 354 sheet slots on the one species that learns it. So the
census and the roster were predicted to move and the pinned pool to sit still, and that is what
happened in every one of the four.

---

## 1 — THE STATUS PATH WAS BLIND TO WHETHER A SHIELD BLOCKS STATUS

**The authority.** `checkMoveBypassesProtect` (`sim/battle.ts:1300-1302`) is
`(move.category !== 'Status' || blockStatus) && move.flags['protect'] && …`, and each shield's own
`condition.onTryHit` decides `blockStatus` for itself. `tag_dex` already reads that into
`shieldsUser.blocksStatus`; derived and printed on every probe run over the legal shield family:

```
banefulbunker  blocksStatus=true    uses=1667
kingsshield    blocksStatus=false   uses=354     <- the one
protect        blocksStatus=true    uses=145559
spikyshield    blocksStatus=true    uses=2058
detect         blocksStatus=true    uses=5374
endure         NO shieldsUser param — not a shield here
```

**What we did.** `shieldRefuses` has consulted `blocksStatus` since ROADMAP #238 and the `status`
action branch never called it — it asked `if(t.protect)`, the one such read left in the file.

**One reason, derived rather than argued.** Swapping `t.protect` for `shieldRefuses` also exempts
`noProtectFlag` moves, so the probe first enumerates the `kind:'status'` family through the engine's
own `playerAction`: **11 legal members, ZERO with `noProtectFlag`.** On this family `blocksStatus` is
the only thing the swap changes.

**Red, then green.** `tests/probe_status_blocksstatus.js`, exit 1 unpiped:

```
cell            blocksStatus   authority        ours
kingsshield     false          STATUS par       no status     <- RED, board-material: the status leaf
protect         true           no status        no status     <- control, knob turned the other way
noshield        (no shield)    STATUS par       STATUS par    <- control, the cast is live
```

`MEDI_STATUS_SHIELD_BLIND=1` reproduces the SAME red, exit 1. Census row added:
`move / shieldsUser` — *"King's Shield does not block a plain STATUS move and Protect does."*

The move is **Glare**, chosen because its accuracy is 100: a 90-accuracy cast staged against a
live-seeded authority is a coin, and a coin landing the comfortable way is how a probe lies. The
probe derives the cast, the target (the only King's Shield carrier) and every other reason the status
could be refused, and refuses any cell carrying more than the one it is about.

---

## 2 — BELCH WAS NOT GATED ON HAVING EATEN A BERRY (`#514`, CLOSED)

**The handed diagnosis's correction was load-bearing and it held.** Champions DELETES mainline's
`onDisableMove` (`data/mods/champions/moves.ts:54  onDisableMove: undefined`), verified on the live
format object. The authority therefore OFFERS the click — `"disabled":false` on the request — and
fails the USE. **A fix in the move-selection filter would have been a new divergence**; the probe
asserts the menu stays open on both engines, so no future fix can pass by greying the button out.

**Measured with the knob turned by a REAL berry eat, never a plant:**

```
arm                   ateBerry(sd/us)   damage(sd/us)   -fail(sd/us)
never ate a berry     false/false       0/103 -> 0/0    true/false -> true/true
ate a Sitrus turn 1   true/true         70/103          false/false
```

Identical damage across a varied knob (103/103) was the unwired-knob signature. 103 HP is
board-material.

**The tag is shape-matched and the population is ONE.** `onTry(source){return source.<latch>;}`
selects **1 legal move and 1 move in the WHOLE dex** — printed before wiring, so the legality filter
is not hiding anything behind it. `gatesSelection` carries the format's own answer to *"is the button
gone too"*, so a regulation that restores `onDisableMove` re-arms the menu with no engine edit.

**A silent default was refused explicitly.** A bare `!m[_fld]` on a latch this engine does not keep
would refuse that move for ever and look exactly like a working gate. `LATCH_FIELDS_WRITTEN` is
derived from medicham2's OWN SOURCE at load (the trick `board_state.js`'s `_srcKeys` uses), and a
field not in it counts `MEDFAILS.userLatchUnwritten` and leaves the move alone.

**This is what took the roster's moves stage from FAIL to PASS**: `move/needs-a-berry-already-eaten`
was the single NOT CAUGHT red demonstration, and it is now CAUGHT — 34/35 → 35/35.

---

## 3 — SMACK DOWN APPLIED ITS VOLATILE TO A GROUNDED BODY (`#517`)

**"Airborne" is FIVE ORDERED CLAUSES and it is not `isGrounded()`.** The handed warning was right and
understated: the clauses are ORDERED, and the last two put `applies` back to `true` after a negator
cleared it. A body holding an Iron Ball and up on Magnet Rise reads `isGrounded() === true` and the
authority applies Smack Down to it anyway. A gate written as `!isGrounded` would have been a new
defect wearing the fixed one's name.

**The derivation splits the handler per `if`-clause, and that is not fastidiousness.**
`pokemon.volatiles["ingrain"]` sits in a clause whose body is `applies = false`;
`pokemon.volatiles["magnetrise"]` sits in a clause whose body is `applies = true; delete …`. Identical
syntax, opposite meanings. `ifClauses()` in `tag_dex.js` matches parens and braces and classifies each
clause by what its BODY does — a regex over the whole source cannot tell them apart, and a lazy
`/if\s*\(([\s\S]*?)\)/` cannot even find the condition, because
`hasType("Flying") || hasAbility(["levitate","eelevate"])` closes three parens first.

**Over-match printed before wiring: 12 moves dex-wide have an `onStart` that can `return false`; the
shape selects exactly ONE legal move and one dex-wide.** Five of the other eleven already have named
owners in `applyMoveVolatile`.

**Eight cells, then three board arms:**

```
cell                lift reasons   authority   ours (before -> after)
plain-grounded      (none)         refuses     APPLIES -> refuses
flying              Flying-type    APPLIES     APPLIES -> APPLIES   <- control
levitate            Levitate       APPLIES     APPLIES -> APPLIES   <- control
flying+ironball     Flying-type    refuses     APPLIES -> refuses
levit+ironball      Levitate       refuses     APPLIES -> refuses
flying+gravity      Flying-type    refuses     APPLIES -> refuses
magnetrise          magnetrise     APPLIES     APPLIES -> APPLIES
ironball+magrise    magnetrise     APPLIES     APPLIES -> APPLIES

§5 a later Magnet Rise   authority true  / ours false -> true
§6 the consume           authority false / ours true  -> false
§7 the cancel            authority false / ours true  -> false
```

`MEDI_VOL_START_GATE_BLIND=1` reproduces all five section-A assertions red, identically.

**The cancel reuses `_gravCancel`, RENAMED `_queueCancel` and now carrying its cause.** Gravity and
Smack Down both make the authority's own `this.queue.cancelMove(pokemon)` call, so "this action was
deleted from the queue" is ONE fact with two producers. A second flag would have been a second copy of
it. One consumer, above the kind dispatch, cleared per body at the top of every turn.

**The `-start` label is closed too, and the fallback is derived.** `volatileAnnounce` is built from
`dex.conditions.get(vol)` and cannot read a guarded multi-statement `onStart`, so `smackdown` is not
among its 49 members and the engine fell to `'move: ' + vol`. `volatileStartGate` already parses that
handler for the gate, so it carries `this.add("-start", pokemon, "Smack Down")` verbatim at no cost.
Measured after: authority `|-start|p2a: Corviknight|Smack Down`, ours `|-start|p2a: corviknight|Smack Down`.
Widening `volatileAnnounce` to read guarded handlers is still owed.

Three census rows added — the gate, the consume and the cancel — because they are three separate
authority statements inside one handler, each with its own board leaf, and an engine can pass the
first while failing both others. All three shown MISSING under the knob before being trusted.

### THE OMISSION I DID NOT SILENTLY RESOLVE

`engine/board_state.js` neither compares `volatile:smackdown` nor declares it uncomparable — an
UNLISTED omission, which its own header says "reads exactly like agreement". **I did not add it to
either list.** It is not ENGINE's call to make quietly and the probe already lands its board claim
somewhere the comparator can see (`magnetrise`, which IS compared, and which parted three ways).
Reported here and in the register row; the wiring decision belongs to whoever owns that file, and it
is now safe to take, because the gate has landed and wiring it today no longer parts every board on a
defect.

---

## 4 — SHELL SIDE ARM NEVER CHOSE ITS CATEGORY (`#518`)

**The rule, read rather than recalled.** `onModifyMove` compares the DAMAGE each category would do —
the TARGET's defences are half of it and the base power is the handler's literal `90`, not
`move.basePower` — and `getStat(x, false, true)` means stat STAGES count and Modify events do not. The
`||` short-circuits, so **a non-tie takes ZERO draws**: the authority's own `randomChance` sequence
reads `100/100 1/24` on a non-tie and `1/2 100/100 1/24` on a tie, the coin first.

**One legal member by the regulation.** Five moves dex-wide reassign `move.category` inside
`onModifyMove`; four are `isNonstandard: 'Past'` here. `stats.length !== 4` returns null rather than
guessing, so a move reassigning its category by a different rule shows up as unwired instead of being
handed this arithmetic.

**A derivation bug caught by printing, and the handed report had it the other way round.** The report
said the dist spells handlers with double quotes (`move.flags["contact"]`). It does not — it writes
`move.flags.contact = 1` in DOT notation. My first regex was bracket-only, returned `alsoSetsFlag:
null`, and the whole contact half went missing SILENTLY. Fixed to accept both, printed again.

**The fix is a PER-USE VIEW, never a mutation.** `a.move.mv` is the shared `MC.moves[id]` row and
`mv.c` is read at 21 sites; writing `c` onto it would make every later Shell Side Arm by anybody
Physical. A shallow clone hung on the ACTION reaches all 21 through the single `const mv=a.move.mv`
the attack branch already takes. The contact flag needed a third input to `mvMakesContact` — its
`_contactCache` is keyed on the move id and cannot express a per-use flag — threaded through the six
attack-path callers, `dmgRange`'s own flag read, and `stealFlagOK`'s two.

### THE PROBE WAS MEASURING THE FORMULA AND COULD NEVER HAVE SEEN THIS FIX

`tests/probe_shell_side_arm.js`'s medicham arm called `MEDI.dmgRange(a, d, MC.moves[MOVE], …)`
directly with the shared row. The authority's choice happens inside `useMoveInner`; ours happens at
the matching commit site in the battle loop. **A probe that never takes an action can observe
neither** — it ran unchanged after the fix landed and printed the identical red.

It also compared ONE medicham answer against BOTH forced authority arms, which on a tie is
unsatisfiable by a correct engine as well as a broken one — `tie-trivial-CONTROL` read DIVERGES for
that reason and not for a defect.

Rewritten to play a real turn with the coin forced on both sides and compared heads-to-heads, plus a
new assertion that the decision HAPPENED at all (`decided === 1`) and that our coin count matches the
authority's. After:

```
ARM                        | authority                | medicham2                 | verdict
physical-by-defence        | cat P/P dmg 61/61 coins 0| cat P/P dmg 61/61 coins 0 | agree
special-by-defence         | cat S/S dmg 61/61 coins 0| cat S/S dmg 61/61 coins 0 | agree
against-the-defence-alone  | cat S/S dmg 79/79 coins 0| cat S/S dmg 79/79 coins 0 | agree
tie-by-floor               | cat P/S dmg 61/61 coins 1| cat P/S dmg 61/61 coins 1 | agree
tie-by-floor+burn          | cat P/S dmg 30/61 coins 1| cat P/S dmg 30/61 coins 1 | agree
tie-trivial-CONTROL        | cat P/S dmg 61/61 coins 1| cat P/S dmg 61/61 coins 1 | agree
GREEN.
```

`MEDI_NO_CATEGORY_PICK=1` returns the same four DIVERGES rows plus the new decided-count reds, exit 1.

Two census rows: the directional one (only the TARGET's Def/SpD split moves, so a rule written on the
attacker's own atk-vs-spa gives the same answer on both arms and fails neither) and the tie, made
board-material by a burn — invisible to the choice, halving the Physical branch only, **13 HP against
27 decided by a coin**.

---

## AN INSTRUMENT FAULT I INTRODUCED AND THE INSTRUMENT CAUGHT

Two Python rewrites of `engine/medicham2-browser.js` read the file with universal newlines and wrote
it back with `newline=''`, converting the working tree from CRLF to LF. `tests/roster.js`'s red
demonstrations embed `\r\n` inside their anchor strings, so **two plants stopped matching** and the
moves stage reported `move/boosts-self` and `move/needs-a-stat-stage-to-act-on` as NOT CAUGHT.

It was not the patch: restoring CRLF and re-cutting returned 35/35 CAUGHT with the patch in place.
Recorded because the shape is worth keeping — a whitespace-only rewrite silently disarmed two live
break tests, and only the `--reds` column said so.

---

## OWED, NOT RUN

```bash
# NOT MINE, FILED, EACH WITH A MEASUREMENT ABOVE:
#   engine/board_state.js: `volatile:smackdown` is an UNLISTED omission — neither compared nor
#     declared uncomparable. NOT added to either list by this pass, deliberately. Now safe to wire.
#   CHARGE'S `-start` PAYLOAD DIVERGES: authority `Charge`, ours `move: charge`. Found while
#     re-aiming probe_two_gates.js's §4, which was grabbing the first `-start` of the turn rather
#     than Smack Down's. `charge` is DELIBERATELY refused by the `volatileAnnounce` deriver (only
#     one of its two branches carries the argument), so this is a pre-existing declared gap and
#     belongs to the narration batch, not here.
#   `volatileAnnounce` still cannot read a guarded multi-statement `onStart`. 49 members; the
#     `volatileStartGate.startLine` fallback covers the one member that has a gate and nothing else.

# NOT MEASURED, AND NOT CLAIMED:
#   `MEDSEEN.categoryPicked`, `categoryPickTieDrawn`, `contactFlagPerUse`, `volStartGateRefused`,
#     `volStartGateApplied`, `userLatchRefused` — game_differential.js surfaces no MEDSEEN, so every
#     one of these has only ever been read on a staged board. Pool-scale reach unknown.
#   The per-use contact flag reaching the 17 contact abilities and the four punishing shields is
#     WIRED and COUNTED and has no fixture. The probe's defender (Ditto) punishes nothing.
#   `tests/probe_two_gates.js` and `tests/probe_shell_side_arm.js` are probes, not gates. Neither is
#     registered in run-all.js; whoever wants them gated should decide that.

# CARRIED OVER UNTOUCHED FROM THE PREVIOUS BATCH:
#   #516 Analytic at 5324/4096; #511 the collapsing volley's hitcount; #507; the partial trap's
#   `!source.activeTurns` clause. Nothing here touched any of them.

# PRESENT AT HEAD, NOT INTRODUCED HERE:
#   probe_red_demo exit 2; test-set-realism out of heap; test-workflow-paths stale store;
#   validate_selfplay duplicate ids; test-no-silent-failure firing on an untracked probe;
#   the feature-semantics stamp gate at the top of status.js; test-resolution-order needing
#   --max-old-space-size=6144. tests/roster.js --stage moves ALSO needs it now — it ran out of
#   heap once at the default and completed cleanly at 6144.

# DEBRIS REPORTED, NOT DELETED (untracked, not created by this session):
#   data/_pair-pilot.json  data/medicham-represented-clicks.json  data/_scratch-scovillain-dump.json
#   .scratch_eng_diffrun.cmd (pins a DIFFERENT simulator — nothing here executed it)
#   .scratch_clk_*.out  .scratch_id_*.out  .scratch_eng/  .scratch_pk/
#   docs/_reports/2026-08-27-berserk-switcheroo.md and tests/probe_berserk_switcheroo.js
```

**RUN, with the results above:**

```bash
SHOWDOWN_PATH=... node tests/probe_status_blocksstatus.js                 # 0 red, exit 0
SHOWDOWN_PATH=... node tests/probe_two_gates.js                           # GREEN, exit 0
SHOWDOWN_PATH=... node tests/probe_shell_side_arm.js                      # GREEN, exit 0
node tests/test-mechanics.js                                              # 773 live / 773 probed / 0 missing
node engine/game_differential.js --games 1200 --turns 12 --arm middle \
  --release d29f6677bc76 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --state --end-state --write
node tests/roster.js --stage {items,abilities,moves} --release d29f6677bc76 --reds --write
node engine/all_mechanics_fire.js --kind all --release d29f6677bc76 --write
node tests/test-engine-diff.js --n 6000 --seed 20260804                   # 0/6000 x 16 corners
node engine/status.js
```
