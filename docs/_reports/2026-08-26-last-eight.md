# THE LAST EIGHT — 2026-08-26

Read-only diagnosis. Nothing was run that plays a game; no artifact was regenerated. Every figure
below is read with `git show HEAD:<file>` off commit `3050904d`.

**WHAT THIS DESCRIBES.** `data/game-differential.json` at HEAD — generated `2026-08-26T22:56:40Z`,
release `2c343e3ffaaa`, census pin `9446a684709d`, `--team-store data/team-pool-frozen`, arm
`middle`, **961 games, `turns_cap: 12`.**

**EVERY COUNT HERE IS A CLAIM ABOUT THE FIRST TWELVE TURNS.** The same mechanics exercised longer
diverge more — the parted count went 28 → 80 between cap 12 and cap 30. "8 of 961" is
"8 of 961 twelve-turn games", not "8 defects in this engine".

---

## THE SET, AND HOW MEMBERSHIP WAS RE-DERIVED

`diverged: 13` at HEAD. Five are the declared Supreme Overlord `fallenundefined` family
(AUTHORITY-WRONG, left alone as instructed). **Eight remain.**

The rendered dump `data/divergence-turns.json` is stamped `2026-08-26T05:36Z` / release
`4174fe78d1ee` — **twelve releases and one working day stale.** Matching its 21 cards against HEAD's
`first_divergences` by `config|seed`:

| dump card | still live at HEAD? |
|---|---|
| 1, 4, 5, 6, 11, 12, 15, 17, 18 | **gone** — fixed since 05:36 (includes Telepathy, Psych Up, Spicy Spray, Gravity) |
| 2 | live seed, **different cause** — Endeavor's `onTryImmunity` was fixed; the game now parts 41 lines later |
| 3, 7, 8, 9, 10, 13, 14, 16, 19, 20, 21 | live |
| — | one live divergence (Outrage) is **not in the dump at all** |

So the eight are dump cards **3, 13, 14, 16, 19, 21**, plus **the new `-fail` cause on card 2's
game**, plus **the Outrage game the dump never sampled**.

**THE DUMP'S CARD NUMBERS ARE NOT STABLE AND SHOULD NOT BE CITED.** The brief's "card 9" is card
**13** in this dump. It is named below by mechanism.

---

## BOARD-MATERIAL: THE INSTRUMENT SAYS **1 OF THE EIGHT**, NOT 2 — AND THAT ONE IS A VOIDED GAME

Read from `state`, which is the instrument that reports whether a board leaf moved:

```
games_board_never_diverged        959
protocol_diverged_games            13
protocol_diverged_board_never_did  12     <- 12 of the 13 wrote no differing board leaf
board_parted_before_the_protocol_did 1
```

There are exactly **two** board-divergent games in the run, and only one of them is in the eight:

1. **`p2.party.garchomp` reading two different bodies** (baseline, seed `…2636042531`, turn 3 —
   hp *and* maxhp *and* item *and* atk stage all differ at once). `protocol_diverged_at_turn: null`
   — **this game is not one of the 13 at all.** `state.reader_failures` says
   `duplicate_species_in_party: 20, duplicate_species_first: "garchomp"`. This is the party-key
   collision held pending the re-baseline decision. Not in the eight.
2. **The Outrage target** (baseline, seed `…2635122796`, turn 2) — in the eight, and see below.

**Everything else in the eight is narration-only, and the instrument said so** —
`protocol_diverged_board_never_did: 12`, not a judgement that a line "looks cosmetic".

---

## 1. OUTRAGE PICKS A DIFFERENT FOE — **NOT A DEFECT. THE DIE IS UNSHARED, AND THE ARM ALREADY VOIDED THE GAME.**

**Plain words.** Outrage does not aim where the player pointed; the game re-rolls a random adjacent
foe at execution. Both engines roll. Showdown hit Staraptor, we hit Incineroar.

**The instrument says it out loud, in its own artifact:**

```
mid_void.by_reason              { ..., "low-identity": 1 }
mid_void.by_reason_detail       "low-identity": { games: 1, diverged: 1 }
mid_void.unshared_address_shapes  "acc outrage [sd only]": 2, "dmg outrage [sd only]": 2,
                                  "crit outrage [sd only]": 2, "... [me only]": 1 each
mid_void.unshared_address_field   "target differs  (acc|outrage)": 1   (+ crit, + dmg)
```

There is exactly **one** low-identity void game in the run, it **diverged**, and its unshared
addresses name `outrage` with **`target differs`**. The only Outrage-target divergence in
`first_divergences` is this game.

**Why the die cannot be shared.** `game_differential.js:919` — `const OUT = new Set(['acc','crit',
'sec','dmg','stall'])` — and the comment two lines above says it in as many words:

> *"the `any` bucket is every draw with no move in scope — **target selection**, sleep timers,
> multihit counts. It was measured at 95.2% on one sample and 37.0% on another FROM THE SAME ENGINE
> and was explicitly refused a floor for that reason."*

Only `hitStepAccuracy`, `secondaries` and `getDamage` are wrapped (`:1023-1025`), so Showdown's
`getRandomTarget` → `sample()` draws outside every category the arm aligns. medicham2's own draw
(WIRE 144, `medicham2-browser.js:19978`) is a separate stream by construction.

**So this is the textbook `INCOMPARABLE` declaration** — `quarantine.js`'s own wording: *"the
authority makes a RANDOM DRAW at an address this harness does not share, so the two engines
disagree by construction and always will."*

**TWO INSTRUMENT DEFECTS FALL OUT OF THIS, AND BOTH ARE MEASURE'S:**

- **The whole-game clause counts a game the arm voided.** `mid_void.usable_games: 960`,
  `diverged_among_usable: 12`, `void_games: 1` — and top-level `diverged: 13`. 12 + 1 = 13. The
  clause reads the top-level number, so **the denominator excludes the void game and the numerator
  includes it.**
- **The state comparator does not honour the void.** `state.first_board_divergences` lists this game,
  which is why board-material reads 2 rather than 1.

**RECOMMENDATION: file `INCOMPARABLE`, do not fix.** Board-material then reads **1** (the party-key
collision), and the whole-game clause reads **7**.

---

## 2. THROAT CHOP CHOPPED TWICE RESETS OUR CLOCK; THE AUTHORITY REFUSES THE SECOND ONE — **THE ONE REAL BUG IN THE EIGHT, AND IT IS ONE LINE**

*(dump card 3, `|-end|p1a|throatchop <> |upkeep`, turn 6)*

**Plain words.** Throat Chop silences a body for two turns. Chop the *same* body again on turn 2 and
the authority ignores it — the original two-turn clock keeps running and expires on schedule. We
restart the clock, so the body stays silenced for a third turn and its `-end` line never lands on
the turn the authority lands it.

**Derived, not recalled.** `data/moves.ts` `throatchop.condition` carries `duration: 2` and **no
`onRestart`**. `Pokemon#addVolatile` (`sim/pokemon.ts`): *"if (this.volatiles[status.id]) { if
(!status.onRestart) return false; }"*. Champions overrides neither (`grep throatchop
data/mods/champions/moves.ts` → nothing).

The game reads exactly like that: Incineroar chops Mawile on turn 5 and again on turn 6; the
authority's clock reaches zero at turn 6's residual and prints `-end`, ours has just been reset to 2
and prints nothing.

**THE FACT IS ALREADY IN `tags.json`, DERIVED, AND THIS CARRIER WALKS PAST IT.**

```json
"volatileRestart": { "byVolatile": { "throatchop": {
    "restart": false, "duration": 2,
    "from": "DERIVED:dex.conditions.get(throatchop).onRestart" } } }
```

110 moves carry the tag; `medicham2-browser.js:3634` builds `volRestartTable()` from it and the
generic `_vol` write honours it. **Throat Chop's state does not live in `_vol`** — it lives in its
own field `tg._noSound` — and the write at `:27642` is unguarded:

```js
const _n0=tg._noSound; tg._noSound=+_bs.turns;
if(TR&&!(_n0>0))TR.vstart(tg,'Throat Chop','[silent]');
```

`_n0` is read *only* to suppress the duplicate `-start`. **The same test is the fix**:
`if(!(_n0>0)) tg._noSound = +_bs.turns;`. The engine's own comment predicted this class —
*"most never reach the generic write at all — they are owned by their own handler further up this
function, **or by a field outside `_vol` entirely**"*.

**IT IS BOARD-MATERIAL BY STRUCTURE**, even though this game's board did not move: a sound move is
refused on a turn the authority allows it. It is the same defect ROADMAP **#415** was closed on
(2026-08-24, *"the clock was fixed, not just the line"*) **arriving through the re-application door**
— a closed row sitting over a live divergence, the #400 shape.

**AND THE FIX CLOSES A SECOND FAMILY.** `_trap` at `:27934` is written the same unguarded way, and
`partiallytrapped` also carries `restart: false` (duration 5) — so re-Binding an already-bound body
refreshes our clock too. `_perish` at `:23172` **is** guarded (`x._perish==null`), which is the
control that shows the guard is the right shape. **Highest-value single item in the eight.**

---

## 3. PROTECT ANSWERS ABOVE THE STEP LIST INSTEAD OF INSIDE IT — **THIS IS THE CARD THAT RESISTED TWO PASSES**

*(dump card 13, `ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect`, turn 10 — the brief's "card 9")*

**Plain words.** Garchomp's Earthquake hits three bodies: a Protecting Milotic, a Houndstone that is
underground in Phantom Force, and its own Rotom which is immune by Levitate. The authority announces
the *miss* first, then the Protect, then the immunity. We announce the Protect first.

**It is NOT target ordering** — both engines take the targets in the same order — and that is why two
passes bounced off it.

**The authority's rule, read at the source.** `trySpreadMoveHit` (`sim/battle-actions.ts:553-577`)
is a pipeline of **stages, each run across every target before the next stage begins**:

```
0 hitStepInvulnerabilityEvent   -> |-miss|                (Houndstone)
1 hitStepTryHitEvent            -> |-activate|…Protect    (Milotic)
2 hitStepTypeImmunity           -> |-immune|              (Rotom)
```

Showdown's three lines are exactly 0, 1, 2. Ours are Milotic, Houndstone, Rotom — target order.

**And medicham2's step driver is already correct.** `medicham2-browser.js:28602`:

```js
const _STEPS=[_stepInvuln,_stepTryHit,_stepTypeImm,_stepTryImm,_stepAccuracy, …];
for(const _step of _STEPS) for(const R of _rows){ if(R.out)continue; … _step(R); }
```

Step outside, target inside, in the authority's order. **The defect is that Protect is not in that
list.** `_stepTryHit`'s own header says so:

> *"THE PROTECT BLOCK USED TO SIT HERE and moved above the accuracy roll (ROADMAP #81 WIRE 1). **A
> shielded body never reaches this loop now.**"*

The pre-pass at `:25348` emits `TR.act(tg,'move: Protect')` and then rebuilds `targets=_through`, so
a shielded body is dropped **before the driver starts** and its line beats step 0's `-miss`.

**Narration-only** (board never diverged, `protocol_diverged_board_never_did`) — because on a single
target the two orders are the same permutation, and on a spread the boards agree anyway. **The fix is
to move the shield answer into `_stepTryHit`**, which is where WIRE 1 took it *out* of. Note WIRE 1's
reason was correct and still holds — the shield must precede the accuracy roll (step 4) — and putting
it at step 1 satisfies that *and* the invulnerability step at once. Supporting detail:
`runEvent` sorts `TryHit` handlers with `compareLeftToRightOrder`, not by speed (`sim/battle.ts:790`).

---

## 4. ZAP CANNON INTO A SEMI-INVULNERABLE GOLURK — **UNEXPLAINED BY READING, AND THE AUTHORITY IS THE ODD ONE**

*(dump card 16, `unrelated event mismatch :: |-immune|p1a <> |-miss|p2b|p1a`, turn 10)*

**Plain words.** Golurk is underground in Phantom Force. Sneasler's Dire Claw misses it — both
engines agree. One line later Raichu's Zap Cannon hits the same body, and the authority prints
`-immune` (Electric into a Ground type) where we print `-miss`.

**What was derived rather than assumed:**

- `direclaw` accuracy is **100** (`Dex.forFormat(...).moves.get('direclaw').accuracy`), so its miss
  **cannot** be an accuracy roll — Golurk really was semi-invulnerable, in both engines.
- `phantomforce.condition.onInvulnerability === false` — a literal `false`, and `runEvent`'s
  non-function branch (`sim/battle.ts:908-910`) returns it verbatim.
- Invulnerability is step **0**; type immunity is step **2**; `trySpreadMoveHit` filters targets
  between steps and `break`s when the list empties.
- Champions overrides only `hitStepMoveHitLoop` (`data/mods/champions/scripts.ts:428`), so the step
  order is mainline.

**On that reading the authority should have printed `-miss` for Zap Cannon too, and it did not.**
This is the one card in the eight where the plain reading of the source contradicts the observed
authority output. **Do not fix anything here on the strength of a hypothesis** — this is exactly the
shape that produced fourteen wrong probes in a day. It needs one staged turn against the real
simulator, named in OWED below.

Narration-only by the board instrument either way.

---

## 5. TWO TAILWINDS END IN THE OPPOSITE ORDER — **ALREADY RULED ON BY WILL. LEAVE IT.**

*(dump cards 19 and 21, `ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind` — **2 of the 8**)*

**Plain words.** Both sides have Tailwind up and both expire on the same turn. The authority ends p2's
first; we end p1's first. Nothing happens between the two lines.

**This is ROADMAP #355, closed as a decision, not a defect.** Will, 2026-08-24: *"tailwind coming out
in the wrong order doesnt matter, put it into the closet with that note and move on."*

Confirmed against the source rather than taken on the row's word: `tailwind.condition` carries
`onSideResidualOrder: 26 / onSideResidualSubOrder: 5` with no Champions override, a `Side` holder has
no `getStat` so `resolvePriority` never assigns it a speed (`sim/battle.ts:1001`), and `effectOrder`
— `comparePriority`'s fifth key — is filled **only** for `SwitchIn` and `RedirectTarget`
(`:993-999`). All five keys tie.

**It is NOT a coin, and #355 already carries that correction** (MEASURE, 2026-08-24): with
`prng.shuffle` at the identity the reversal is deterministic; the residual cause is the authority's
selection sort **swapping** rather than shifting, so sorting the front of the handler list displaces
the tail. Deliberately **undeclared and red** so a chosen deferral cannot become a quiet pass.

**Do not spend time on these two.** One cosmetic detail worth noting for whoever eventually does:
our line is `|-sideend|p1: |move: Tailwind` with an **empty player name** against the authority's
`|-sideend|p1: A|…` — a second, separate narration difference that the ordering one is currently
hiding.

---

## 6. A MOVE WITH NOTHING LEFT TO AIM AT DOES NOT SAY SO

*(the new cause on dump card 2's game — `|-fail|p1a <> |-weather|raindance|[upkeep]`, turn 7)*

**Plain words.** Aerodactyl's Dual Wingbeat was aimed at a Whimsicott that had already fainted, and
every other foe was dead too. The authority prints `|-fail|` on the attacker; we print nothing and go
straight to the weather upkeep.

**The authority's site** (`sim/battle-actions.ts:509-512`, and again at `:461-464`):

```js
if (!targets.length) {
  this.battle.attrLastMove('[notarget]');
  this.battle.add(this.battle.gen >= 5 ? '-fail' : '-notarget', pokemon);
  return false;
}
```

**We already model the state and only the line is missing.** `medicham2-browser.js:24912-24916`:

```js
const _hadTargets=targets.length>0;
if(!_hadTargets)m._mvRes=false;
```

`_hadTargets` has twelve readers and **none of them writes a line.** `grep -c notarget` on the engine
is 0 outside a comment. Board-identical, so **narration-only**, and it is a one-line emit beside the
`m._mvRes=false` that is already there.

**One hazard to report while touching this, not to fix blind.** The line immediately above is
`if(!targets.length)targets=live(foes).slice(0,1);` — a **silent retarget to the first living foe**.
The authority retargets too (`Battle#getTarget` → `getRandomTarget` when the named target fainted),
but it **samples uniformly**; we take slot A deterministically. That is the same unshared-die
territory as item 1 and it is not currently counted anywhere.

**Related but not the same row:** ROADMAP **#383** is the *opposite* sign — ~70 of our `mvFail` sites
writing a bare `-fail` the authority never writes. This is a *missing* one.

---

## 7. TWO REPLACEMENTS AFTER A DOUBLE FAINT WALK IN IN THE OPPOSITE ORDER — **BOTH NAIVE READINGS ARE NOW REFUTED**

*(dump card 14, `ordering :: |switch|p1a|staraptor <> |switch|p2a|incineroar`, turn 7)*

**Plain words.** Gengar and Dragapult both faint in the same turn. Both sides send a replacement. The
authority announces p1's Staraptor first; we announce p2's Incineroar first. The Intimidate lines
that follow are **identical in both engines**, so the switch-in *effect* order is already right — only
the two `|switch|` lines are swapped.

**This is ROADMAP #353, open, filed with no verdict.** What this pass adds is that **both available
hypotheses are dead**, derived from the format rather than recalled:

| key | order it predicts | matches the authority? |
|---|---|---|
| incoming body's speed (Staraptor 100 > Incineroar 60) | p1 first | yes here — **but #353 already refuted it** on a second sample where the authority moved the slower incoming side first |
| outgoing body's speed (Dragapult 142 > Gengar 110) | p2 first | **no** — this is what *we* do |

Trick Room is ruled out on this board: Dragapult (142) moved before Ceruledge (85) and Gengar (110)
Protected before Hydrapple (44) on the same turn.

Our key is declared in the engine — `MEDFAILS.replaceOrderTie`: *"two bodies replacing a faint on the
same request whose **DEPARTING** speeds are equal … this engine keeps side order"*. The authority's is
`action.speed = action.pokemon.getActionSpeed()` with `action.pokemon` = the outgoing body
(`sim/battle-queue.ts:270`, `side.ts` `chooseSwitch`), which is the reading the observation refutes.

**So the authority behaves as if the two `instaswitch` actions TIE** — which, under the identity
shuffle, keeps `commitChoices`' collection order p1-then-p2. **That is a hypothesis, not a finding**,
and it is one staged turn from being settled. Narration-only here (board never diverged); #353 notes
the class also covers same-side double switches, where it may not be.

---

## RANKING — WHAT ONE FIX BUYS THE MOST

| # | mechanism | class | verdict | closes |
|---|---|---|---|---|
| 2 | Throat Chop re-application refreshes our clock | **board-material by structure** | **FIX. One line.** | 1 divergence + the whole `_trap` partial-trap family, unmeasured |
| 3 | Protect answered above the step driver, not at step 1 | narration | **FIX.** Structural, one block moves back | 1 divergence; every future spread-into-a-shield ordering |
| 6 | no-legal-target `-fail` never emitted | narration | **FIX. One line.** | 1 divergence |
| 1 | Outrage's random target | board leaf moved, but **the arm voided the game** | **DECLARE `INCOMPARABLE`** | 1 divergence + drops board-material 2 → 1 |
| 5 | two Tailwinds end in the opposite order | narration | **LEAVE — Will ruled on it (#355)** | 2 divergences, deliberately not counted as closed |
| 4 | Zap Cannon `-immune` vs `-miss` on a semi-invulnerable body | narration | **UNEXPLAINED. Probe before touching anything** | 1 |
| 7 | replacement `\|switch\|` line order | narration | **UNRESOLVED (#353). Both readings refuted** | 1 |

**Is any of them an unwinnable tie?** Item 5 is the only exact tie — tied on all five of
`comparePriority`'s keys — and it is **not** unwinnable and **not** a coin: MEASURE showed the
authority's reversal is deterministic under the identity shuffle. It is deferred by Will's ruling,
which is a different thing from incomparable, and #355 is explicit that it must stay undeclared and
red. Item 1 is the genuinely incomparable one.

**Nothing here is ranked by count.** Every cause in the eight is n=1 except the Tailwind pair, and
the Tailwind pair is the one that must not be worked.

---

## OWED, NOT RUN

Exact commands. None of these were executed in this pass.

**A. Prove the Outrage game is the void game before declaring it INCOMPARABLE** *(MEASURE)*

```
tools\lownode.cmd engine\game_differential.js --release 2c343e3ffaaa ^
  --census data/verification/census-pin-9446a684709d.json ^
  --team-store data/team-pool-frozen --arm middle --games 961 --turns 12 ^
  --void-debug --dump-games 200 --dump-out data/divergence-turns.json ^
  --out data/game-differential.json
```

Assert: the seed printed under `low-identity` is
`gen9championsvgc2026regmbbo3-2635122796 vs gen9championsvgc2026regmbbo3-2634861011`.

**B. The Throat Chop refresh, red first** *(ENGINE)* — stage a chopper faster than a sound-move user,
chop on turn 1 and again on turn 2, click the sound move on turns 1, 2 and 3.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-mechanics.js
node engine/status.js
```

The probe must read **refused, refused, FREE**. Control: the identical board with the second chop
replaced by any other move — the counter must not move.

**C. Zap Cannon into a semi-invulnerable Ground type, against the real simulator** *(ENGINE)* —
this decides item 4 and nothing should be edited before it answers.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node -e "..."
```
Stage: Golurk clicks Phantom Force; an Electric attacker with a sub-100 move clicks into it the same
turn from a faster slot. Print the authority's raw log lines. The question is literally *"does it say
`-miss` or `-immune`"*.

**D. The replacement-switch key** *(ENGINE, settles #353)* — one staged double faint with a known
speed spread in **both** orientations, plus a same-side double switch, asserting the `|switch|` line
order. Third arm: both outgoing bodies at equal speed, to test the tie hypothesis directly.

**E. After B, C and the two narration fixes, re-run the same pinned differential as in A** and
confirm the clause. **Pin all three** (release, census, team store) or the before/after is not a
before/after.

**F. Not run and not owed by ENGINE:** the two Tailwind cards (#355, Will-deferred) and the
party-key collision (pending the re-baseline decision).
