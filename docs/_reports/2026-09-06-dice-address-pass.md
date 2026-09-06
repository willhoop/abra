# THE DICE-ADDRESS PASS — A DIE THE AUTHORITY NEVER READS WAS DECIDING SEVEN BOARDS

2026-09-06, ENGINE. Historical record. Not maintained, not current state, superseded by whatever
`node engine/status.js` prints.

---

## THE HEADLINE

| | pre-change | KNOB CONTROL | after |
|---|---|---|---|
| **board-material** (`state.games` − `state.games_board_never_diverged`) | 34 of 961 | **34** | **27 of 961** |
| protocol first-divergence | 100 | **100** | **93** |
| narration-only (the second gate) | 70 | **70** | **70** |
| turn boundaries identical | 10429 / 10539 | **10429 / 10539** | 10452 / 10541 |
| void / threw | 5 / 1 | **5 / 1** | 5 / 1 |
| `any` addresses the authority named and we never did | 717 | **717** | **18** |
| `any`-bucket verdict `identical` | 669 | **669** | 702 |
| BOARD-parted causes naming poisontouch / flamebody / cursedbody | 9 games | **9** | **2** |
| mechanics census | 829 live / 829 probed / 0 missing | — | **829 / 829 / 0** |
| `node engine/status.js` | 7 of 9 | — | **7 of 9** — the same two whole-game clauses |

`data/game-differential.json` is republished at **27 / 93 on release `d9e551ed0d5a`** — the SAME
release as the baseline, because **no engine source moved**. `engine/engine_release.js drift
d9e551ed0d5a` reads NO-DRIFT: every one of the 26 frozen files is byte-identical in the live tree.

**THE CHANGE IS ONE FILE AND IT IS THE INSTRUMENT, NOT THE ENGINE.** `engine/game_differential.js`
only. `engine/medicham2-browser.js` is untouched.

---

## 1. THE DIAGNOSIS, MEASURED BEFORE ANYTHING MOVED

The brief said the target was a family of 12 board divergences — *"a status landing in ONE ENGINE
ONLY — Poison Touch ×6, Flame Body, Cursed Body, sleep, freeze"* — and named the fix as *"give the
post-hit ability proc its own dice ADDRESS category"*. **The diagnosis was right about the shape and
the named fix was aimed one step too far downstream.** Both halves were measured, not argued.

### 1a. What the authority actually does

```
sim/battle-actions.ts:1316-1334   BattleActions#selfDrops
  if (!isSecondary && moveData.self.boosts) {
    const secondaryRoll = this.battle.random(100);                       <-- ALWAYS DRAWN
    if (typeof moveData.self.chance === 'undefined' || secondaryRoll < moveData.self.chance) {
```

`selfDrops` runs at `spreadMoveHit` step 4; `runEvent('DamagingHit')` — where Poison Touch, Flame
Body, Cursed Body, Static, Poison Point and Effect Spore all live — runs at step 6 of the same
method. Champions overrides `spreadMoveHit` and **keeps that order**, and does **not** override
`selfDrops` at all (both re-read out of `/data/mods/champions/scripts.ts` on every probe run).

Neither method is one of the four the middle arm wraps, so both draws are addressed
`<seed>|<turn>|any|<move>|<target>|<nth>` and land in ONE bucket, in `nth` order.

**And the value is never read.** All TEN legal moves carrying `self.boosts` — armorcannon,
closecombat, dracometeor, hammerarm, headlongrush, icehammer, leafstorm, makeitrain, overheat,
superpower — leave `self.chance` undefined, so the `typeof … === 'undefined'` short-circuit fires
first and `secondaryRoll` is discarded every single time. Derived on every probe run, plus the
runtime road: `curse.onTryHit` **assigns** `move.self = { boosts: … }` for a non-Ghost user, and the
pool caught it (`selfdrop_seen` reads `curse|random(100)` 19 times) before this sentence existed.

### 1b. The collision, printed side by side

One staged turn, a Poison Touch Sneasler clicking Close Combat into a Swampert:

```
authority   20260813|1|any|closecombat|p20|0     the self-drop roll, VALUE NEVER READ
            20260813|1|any|closecombat|p20|1     Poison Touch's 30%
this engine 20260813|1|any|closecombat|p20|0     Poison Touch's 30%, a DIFFERENT number
```

The identical board with **Shadow Claw** — contact, no `self` — shares its one address exactly.

### 1c. Why no instrument had ever said so

`midGameVoid`'s identity rate is `shared / min(|sd|,|me|)`, and every address medicham2 named here
IS one the authority named. So the arm read **`identical`** on all of these games. That is the
reading `game_differential.js`'s own `rate_over_larger` comment warns about in as many words —
*"a game can read `identical` while the authority is flipping a coin at an address this engine never
named — which is EXACTLY the Poison Touch shape"*. The probe therefore checks **symmetric set
equality**, which is the only form that can see it at all.

### 1d. The board consequence, staged in BOTH directions

Two independent coins agree about two thirds of the time, so the address is the claim and the board
is the consequence. With three and four padding turns in front of the same board, the two engines
part on exactly the shape the artifact carried seven times:

```
pad 3   p2.party.swampert.status   medicham ""     showdown "psn"
pad 4   p2.party.swampert.status   medicham "psn"  showdown ""
```

Both directions on purpose: a fix that only ever removed OUR status would look identical to one that
simply stopped the ability firing.

---

## 2. THE FIVE SUB-FAMILIES — THREE CONFIRMED, TWO REFUTED

The brief asked for one member of each sub-family before anything changed. Each was staged.

| sub-family | staged as | verdict |
|---|---|---|
| **Poison Touch** | Sneasler + Close Combat into Swampert | **CONFIRMED** — sd `nth 0` + `nth 1`, me `nth 0` |
| **Flame Body** | Toxicroak's Close Combat into Talonflame | **CONFIRMED** — same, victim-slot address |
| **Cursed Body** | Goodra's Draco Meteor into Gengar | **CONFIRMED** — same, and NO contact gate, so the claim is about the address and not about contact |
| **sleep** | Vileplume's Sleep Powder into Swampert, four turns | **NOT REPRODUCED.** `any\|sleeppowder\|p20\|0` is SHARED and both engines slept the target for the same three turns. Champions' `slp.onStart` is `this.sample([2,3,3])`, a one-argument draw, and medicham2's `sleepDurationDraw()` sits at the same address. The pool's two `no-counterpart … (any\|sleeppowder)` addresses are a **different question** |
| **freeze** | not staged | **PREDICTED NOT TO MOVE, AND DID NOT.** Champions' `frz.onBeforeMove` is `randomChance(1,4)` and runs BELOW `setActiveMove` and ABOVE the hit, so no `selfDrops` draw can precede it at that address |

Both refusals were written into `data/verification/_prediction-selfdrop-address.json` **before** the
measuring run, under `not_claimed`, and both held: the two sleep causes and the one freeze cause are
still board-parted in the new artifact.

**So the family was NOT twelve mechanic bugs and it was NOT one thing either.** Nine of the twelve
were one instrument defect; the remaining three (two sleep, one freeze) are separate and are still
open. The `|-start|p2b|disable|hypervoice|[from]cursedbody` row is also still open — Hyper Voice has
no `self`, so nothing in this pass could have touched it, and that was stated in the prediction.

---

## 3. THE FIX

`BattleActions#selfDrops` is wrapped as address category **`sdrop`**, a bucket medicham2 never draws
in. It is **not pinned** — it keeps a real address-keyed value — so the authority's own behaviour is
byte-identical; what changes is only that it stops shifting the `nth` of everything after it.

This is ROADMAP #478's `tgtla` rule through a different door, and that precedent was followed
deliberately rather than reinvented: *"the lookahead sites go to `tgtla`, a bucket medicham2 never
draws in, so the one draw that decides the board is nth 0 on both sides."*

**WHY NOT THE FIX THE BRIEF NAMED.** Giving the post-hit ability proc its own category would work,
and it is strictly larger: it needs a new stream in `engine/medicham2-browser.js`, a new entry in
`MID_ADDR_CAT`, and a wrap of `Battle#runEvent` keyed on the event id — one fact with two copies
across two files, which is the shape CLAUDE.md says drifts. The measurement named a narrower cause
that the one-sided change closes completely: `selfDrops` accounts for **690 of the 717** `any`
addresses the authority named and medicham2 never did.

**IT IS NOT SURGICAL AND WAS NOT REPORTED AS ONE.** Removing a draw from the shared bucket re-rolls
the VALUE of every later `any` draw at the same turn/move/target address. That risk was written into
the prediction file before the run.

### The receipts, published in the artifact

`selfdrop_enters` 2235, `selfdrop_draws` 1925, `selfdrop_knob` false, and `selfdrop_seen` keyed
`move|random(args)`:

```
closecombat 1220   makeitrain 305   dracometeor 149   overheat 90   superpower 45
leafstorm 41       curse 19         headlongrush 18   armorcannon 17   icehammer 15
hammerarm 2        outrage|random(2,4) 3
```

**`outrage|random(2,4)` IS A PREDICTION MISS AND IS RECORDED AS ONE.** The probe's first cut asserted
that every shape in the bucket is `random(100)`; it passed on six staged boards and would have gone
red on the pool. It is Outrage's `self: { volatileStatus: 'lockedmove' }` taking the ELSE branch of
`selfDrops` into `moveHit`, and the duration draw inside it. It is harmless for the arm's own stated
reason — a two-argument `random` outside `getDamage` is PINNED to `m` and consumes no shared address
in `sdrop` exactly as in `any`. The assertion is now two-clause and the clause that matters is that
no ONE-ARGUMENT draw other than the `random(100)` is being pulled out of the shared bucket.

---

## 4. THE PIN DIGEST MOVED, AND THAT IS WHY THERE IS A THIRD ARM

`DICE_MODEL` carries the addressing contract and is hashed into `PIN_DIGEST`, so the digest moved
**`bcb38e47d94f` → `de38d17e15a2`**. `engine/arms_comparable.js` was asked about the pre-change
artifact against the new one and **refused it**, naming both causes:

```
NOT COMPARABLE — shown to differ:
  - the INSTRUMENT differs: driver code 91a4068bb9cd vs 3119d079dfa5. 1 file(s) moved
    between the arms — engine/game_differential.js.
  - `mode` differs: …pins:bcb38e47d94f… vs …pins:de38d17e15a2… — Mode A and Mode B are
    different instruments
DO NOT PUBLISH THIS AS A BEFORE/AFTER.
```

**So 34 → 27 could not have been published as a delta off that pair, and it is not.** The delta is
measured against a **third arm**: the same run with `MEDI_MID_SELFDROP_SHARED=1`, which changes no
byte of code and no pin, written to
`data/verification/game-differential.selfdrop-shared.json`. `arms_comparable` says **COMPARABLE** for
that pair.

And the control reproduces the pre-change artifact **to every digit** — 34 / 100 / 70, 5 void, 1
threw, 10429 of 10539 boundaries identical, 717 authority-only addresses, 669 `identical` verdicts,
9 post-hit-ability board-parted games. The knob is therefore demonstrated to restore the old
instrument exactly, and 34 → 27 is attributable to one thing.

**WHAT `arms_comparable` CANNOT SEE, SAID OUT LOUD:** the knob is an ENVIRONMENT VARIABLE, so it
declares the pair COMPARABLE while the arms differ by exactly the change under test. That is why
`selfdrop_knob` and `selfdrop_draws` are published in the artifact: the two files declare the
difference themselves (`true`/0 against `false`/1925). A reader who trusts `arms_comparable` alone on
this pair would be trusting a check that is blind to the only variable.

---

## 5. THE PREDICTION RECORD

Written to `data/verification/_prediction-selfdrop-address.json` **before** the measuring run.

| quantity | predicted | band | measured | |
|---|---|---|---|---|
| board-material | 30 | 26–34 | **27** | miss by 3, inside band |
| protocol first-divergence | 96 | 92–100 | **93** | miss by 3, inside band |
| narration-only | 70 | 65–75 | **70** | hit |
| games whose board never diverged | 931 | — | **934** | miss by 3 |
| post-hit-ability BOARD-parted causes | 5 | 3–8 | **2** | **MISS — below the band** |
| census | 829 / 829 / 0 | — | **829 / 829 / 0** | hit |
| PIN_DIGEST after | `de38d17e15a2` | — | `de38d17e15a2` | hit |
| `selfdrop_draws > 0` | yes | — | 1925 | hit |
| every `selfdrop_seen` key is `random(100)` | yes | — | **no — `outrage\|random(2,4)`** | **MISS** |
| `arms_comparable` refuses the pre-change pair | yes | — | refused | hit |
| sleep sub-family unmoved | yes | — | unmoved | hit |
| freeze sub-family unmoved | yes | — | unmoved | hit |

**Ten of twelve, two named misses.** Both misses are in the favourable direction on the count and in
the unfavourable direction on the claim: the fix closed more than predicted, and the bucket swallowed
one shape more than predicted.

---

## 6. THE PROBE

`tests/probe_selfdrop_address.js`. Eight arms on three carriers, each with its own control on the
same bodies:

| arm | before / under the knob |
|---|---|
| `poisontouch-behind-a-selfdrop` | RED on the address |
| `poisontouch-no-selfdrop` (CONTROL) | green |
| `flamebody-behind-a-selfdrop` | RED on the address |
| `flamebody-no-selfdrop` (CONTROL) | green |
| `cursedbody-behind-a-selfdrop` | RED on the address |
| `cursedbody-no-selfdrop` (CONTROL) | green |
| `poisontouch-that-parts-the-board-toward-showdown` | RED on the address AND the board |
| `poisontouch-that-parts-the-board-toward-medicham` | RED on the address AND the board |

Shown RED before any byte moved (11 failing checks), green after (all pass), and RED again under
`MEDI_MID_SELFDROP_SHARED=1` (7 failing checks — the counters stay honest, so the three that were
about the missing receipts turn green while the seven that are about the game turn red).

It also re-derives the whole membership on every run: the ten static `self.boosts` moves, the
runtime-assigning ones (curse), the three abilities' `randomChance(3, 10)`, and the Champions
override's step order.

Wired into `PENDING_WIRE` in `tests/run-all.js` with its blocker named — it loads
`tests/staged_board.js`, so it opens a release and plays games. The unaccounted count is unchanged at
99. **OWED: a `VERIFIED BY:` marker in `docs/ROADMAP.md` so `engine/register_reality.js` runs it.**

---

## 7. WHAT IS STILL ON THE BOARD — 27 GAMES

### The five that part a board with no protocol divergence at all

They are all in `state.first_board_divergences` with their paths, unchanged by this pass:

```
t6   …-2661571698   p1.pp[1].expandingforce      medi 1              sd 2
t7   …-2660414382   p1.active[1].stall           medi 0              sd 3
t9   …-2635949496   p1.active[0].stall           medi 0              sd 3
t16  …-2655675221   p2.active[1].stall           medi 0              sd 3
t7   …-2661455548   p2.party.castform.species    medi castformrainy  sd castform
                    p2.party.castform.types      medi water          sd normal
```

**THREE OF THE FIVE ARE ONE FAMILY AND IT IS THE LARGEST NAMED THING LEFT: the consecutive-shield
counter.** `medi 0 / sd 3` means the authority's body still holds a `stall` volatile at counter 3
(one successful shield, never restarted) while `tookProtectTurns` reads 0 here. No protocol line
reports it, because the counter is internal — which is exactly why it was invisible.

**AND THE OBVIOUS STAGING DOES NOT REPRODUCE IT, WHICH IS THE FINDING TO CARRY FORWARD.** Protect on
turn 1 then attack on turns 2–4, and Protect-Protect then attack, both agree at every boundary: the
`duration: 2` grace is modelled. The condition is something else, and guessing at it is how this
pass would have gone wrong. It wants its own staged sweep across the six legal `stall` movers
(banefulbunker, detect, endure, kingsshield, protect, spikyshield — derived, 2026-09-06) and across a
faint, a drag and a turn that never reaches the residual.

### The one Poison Touch game that survived

`|-status|p2a|psn|[from]poisontouch <> |upkeep`, and it reports **`sd_only 0, me_only 0`** — every
`any` address in that game is shared, so the two engines drew the SAME value and still disagreed.
That is not an address defect. It is a GATE difference (an immunity, Shield Dust, a Covert Cloak, a
Substitute) and it is a genuine engine question, filed rather than folded into this pass.

### Not touched, deliberately

The two sleep causes, the one freeze cause, and the Cursed Body / Hyper Voice game. All were named
as `not_claimed` in the prediction and all are still there.

---

## 8. WHAT WAS RUN

```
node tests/probe_selfdrop_address.js                              # RED before, green after
MEDI_MID_SELFDROP_SHARED=1 node tests/probe_selfdrop_address.js   # RED, controls green
node tests/test-pin-arms.js                                       # 0
node tests/test-middle-identity.js                                # 0
node tests/test-middle-draw-scope.js                              # 0
node tests/test-middle-damage-roll.js                             # 0
node tests/test-middle-stall-address.js                           # 0
node tests/test-damage-roll-support.js                            # 0
node tests/test-roster-arm-pin.js                                 # 0
node tests/test-mechanics.js                                      # 829 / 829 / 0, run_ok
node tests/run-all.js --coverage                                  # 99 unaccounted, unchanged
node engine/arms_comparable.js <pre> <after>                      # NOT COMPARABLE (correct)
node engine/arms_comparable.js <knob-control> <after>             # COMPARABLE
node engine/status.js                                             # 7 of 9
```

The two whole-game runs, both on identical pins:

```
node engine/game_differential.js --release d9e551ed0d5a --arm middle --games 1200 --turns 20 \
     --team-store data/team-pool-frozen \
     --census data/verification/census-pin-9446a684709d.json \
     --state --end-state --steering empirical --write
```

and the same command with `MEDI_MID_SELFDROP_SHARED=1` and
`--out data/verification/game-differential.selfdrop-shared.json`. All 42 pin claims pass, including
the new one; `driver_code_stable` true throughout both runs.

## 9. FILES

| file | what |
|---|---|
| `engine/game_differential.js` | the `sdrop` bucket, the knob, the pin claim, the counters, `DICE_MODEL` |
| `tests/probe_selfdrop_address.js` | new — the eight-arm probe |
| `tests/run-all.js` | one `PENDING_WIRE` entry |
| `data/verification/_prediction-selfdrop-address.json` | new — written before the run |
| `data/verification/game-differential.selfdrop-shared.json` | new — the knob-armed control arm |
| `data/game-differential.json` | republished, 27 / 93 |
| `data/mechanics-census.json` | regenerated, unmoved at 829 / 829 / 0 |
| `docs/ENGINE.md` | the account |

Nothing in `engine/medicham2-browser.js`, `engine/board.js`, `engine/magnemite.js`,
`data/engine-data.js`, `engine/steering.js` or `data/policy-weights.json`.
