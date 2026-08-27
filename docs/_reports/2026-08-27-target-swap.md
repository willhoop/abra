# The Outrage that landed on the other body — it is the random-target row, and it is the same game

**2026-08-27, ENGINE. DIAGNOSIS ONLY — nothing was fixed, no engine byte moved, no heavy run was
started.** Instrument: `tests/probe_target_swap.js` (new, 19 clauses, all green, exit 0, read
unpiped). Artifacts read with `git show` because four agents are live.

---

## VERDICT

**IT IS THE SAME BUG *AND THE SAME GAME*. The brief's premise — that this is a second, separate
board-material row alongside the random-target one — is refuted.** `seed
gen9championsvgc2026regmbbo3-2635122796 vs -2634861011` IS ROADMAP **#478**. There is exactly **one**
`-damage: a different body` first divergence in the HEAD artifact, and it is this one. The pending
decision does not become two games; it stays one.

**AND THE PENDING DECISION IS STALE, WHICH IS THE FINDING THAT MATTERS.** #478 offered Will three
options, one of which was *"fix `midHash` first"*. **That option was executed today by a different
batch (ROADMAP #489, the fmix32 finaliser) and nobody re-measured #478 against it.** The 99.3% that
the whole decision rests on was a property of the *unmixed* hash. Under the hash that now ships, the
proposed remedy is **a coin — 64.2% projected against a 65.0% floor.** The decision as written can no
longer be taken.

---

## 1. THE MOVE, ITS TARGET TYPE, AND HOW THE AUTHORITY CHOSE

`|move|p1b: Garchomp|Outrage|…` — read out of `first_divergences[].showdown_before`, not typed.

| fact | where it was read |
|---|---|
| `outrage.target = "randomNormal"` | `pokemon-showdown/data/moves.ts:13085-13099`, target on **13097** |
| **Champions does not override it** | `data/mods/champions/moves.ts` has no `outrage` key (grepped); `scripts.ts` overrides no targeting method at all |
| the chosen target is IGNORED | `sim/battle.ts:2461` — `getTarget` gates the named-target branch with `if (move.target !== 'randomNormal' && …)`; it falls through to `return this.getRandomTarget(pokemon, move)` on **2484** |
| the draw | `sim/battle.ts:2487` `getRandomTarget` -> **2518** `Side#randomFoe` (`sim/side.ts:367-371`) -> `this.battle.sample(actives)` |
| the candidate list | `Side#foes` -> `Side#allies` (`sim/side.ts:388-400`): `activeTeam().filter(a => a).filter(a => !!a.hp)` — **slot order, alive only** |

medicham2's list is `_live = arr.filter(m => m && !m.fainted && m.curHP > 0)`
(`engine/medicham2-browser.js:16498`), applied to the foe active array. **Same predicate, same order,
both sides.** The comparison is symmetric; this is not the array-versus-flag shape that produced a
false row tonight.

**WHY THE AUTHORITY'S DRAW LANDS IN THE BLANK ADDRESS BUCKET.** `runMove` calls
`getTarget` on `sim/battle-actions.ts:223` and `setActiveMove` only on **245**. So at draw time
`battle.activeMove` and `battle.activeTarget` are still null, and `game_differential.js`'s `midDraw`
(line 1133-1140) writes `-` into both fields: `20260813|2|any|-|-|<nth>`.

**WHY OURS DOES NOT.** medicham2 writes `MID_MOVE` / `MID_TGT` at the **top of the action**
(`medicham2-browser.js:21029-21031`) and the WIRE 144 re-roll draw sits ~165 lines below at **21197**.
Our address therefore reads `20260813|2|any|outrage|<slot>|0`.

**Two different strings. After fmix32, two independent values. That is the whole defect.**

---

## 2. YES, A DRAW DECIDES IT — AND THE ARITHMETIC REPRODUCES BOTH ARTIFACTS EXACTLY

Predicted from the address strings alone, using `MEDI.midEventValue` required out of the engine (never
re-implemented) and the pre-2026-08-27 bare FNV-1a for the older artifact. The authority's `nth = 3`
is **one prior number**, measured by `tests/probe_random_target_address.js` and published in #478 —
used for four predictions, not fitted.

| | address | value | pick | predicted | **artifact recorded** |
|---|---|---|---|---|---|
| authority, **mixed** hash | `20260813\|2\|any\|-\|-\|3` | 0.606690 | 1 | p2b | **p2b** (HEAD, `f6a3b35ed665`) |
| authority, **bare** hash | same | 0.408812 | 0 | p2a | **p2a** (`e3587c62`, `01be9daf14ee`) |
| medicham2, **mixed** | `…\|any\|outrage\|{p20,p21,-}\|0` | .3056 / .0713 / .4992 | 0,0,0 | p2a | **p2a** (HEAD) |
| medicham2, **bare** | same three | .5909 / .9701 / .8997 | 1,1,1 | p2b | **p2b** (`e3587c62`) |

**Four for four.** All three possible spellings of our target-slot field agree, so no slot was chosen
to make it come out.

**THE DECISIVE ARGUMENT IS NOT THE FOUR HITS — IT IS WHAT CANNOT MOVE.** Between the two artifacts the
only targeting-relevant change is `midHash` gaining a finaliser. **Showdown's chosen body moved
p2a -> p2b across a pure hash change.** A redirect, a slot-index confusion and a spread mis-split all
resolve *without consuming a die* and are therefore hash-invariant. All three are refuted by that one
observation. medicham2's body moved too (p2b -> p2a), so **both** sides drew.

**Newly visible or newly broken? NEITHER.** The row was board-material before the die fix (it was the
single board-material game at 1 of 961, artifact `e3587c62` 13:26:24Z) and it is board-material after
it. The die fix flipped both picks and the divergence survived, because independence is preserved
under a hash change. **What the die fix broke is the proposed remedy, not the game.**

---

## 3. NO REDIRECT, AND NO SLOT CONFUSION

Sheets read from `data/team-pool-frozen/games.ots.jsonl`, game `2634861011` p1 (which is the
differential's **p2**): Staraptor / **Intimidate** / Choice Scarf, Incineroar / **Intimidate** /
Sitrus Berry, Farigiraf / Armor Tail, Mawile / Hyper Cutter, Kingambit / Defiant. **No Lightning Rod,
no Storm Drain, no Follow Me, no Rage Powder in any moveset.** The two Intimidate pairs are the two
`-unboost` blocks in `showdown_before`, which is what a switch-in plus a lead ability looks like.

In the authority, redirection runs at `sim/pokemon.ts:835` inside `getMoveTargets` — **after** the
random draw, not instead of it — so even a redirect present would not have relocated this draw.

**THE FIXTURE QUALIFIES FOR EXACTLY ONE REASON, AND THE PROBE ENFORCES IT.** Living foes on p2 at the
divergence, counted from the board leaves with the same predicate on both sides: **2 of 2 slots**
(Staraptor 160/160 having just switched in, Incineroar at 170 falling to 107). A cell with fewer than
two living targets is refused by clause 1 rather than scored — with one legal target there is no
choice to get wrong.

---

## 4. THE THING NOBODY RE-MEASURED

#478's remedy: blank our move and target fields so our address matches the authority's base. It can
never match the authority's `nth` — that bucket is **eleven call sites**, its target draw sits at
`nth` 1..11 and **never 0**, and the three biggest contributors (`getActionSpeed` 380,
`addChoice` 203, `insertChoice` 164) are draws **medicham2 does not make at all**.

It scored 99.3% anyway *because the bare hash translated `nth` instead of mixing it*. #478 said so in
as many words: *"a hash that mixed `nth` properly would turn the 99.3% into a coin."* **That hash
landed the same day, from ROADMAP #489.**

```
published, bare hash, 137 REAL draws        99.3%   (136 of 137)
this file, bare hash, projected             97.1%      <- the model reproduces it
this file, MIXED hash, projected            64.2%
a coin over the same candidates (floor)      65.0%
```

Projection assumption, stated: `nth` independent of the candidate count — the published table gives
the two marginals (nth histogram; 41 one-candidate / 96 two-candidate draws) and not the joint.

**Confirmation the knob is real, both directions:** sweeping `nth` 0..11 at the authority's base gives
picks `100111000101` under the mixed hash and `000000000011` under the bare one — ten consecutive
indices collapsing to one pick is the translation defect, shown rather than asserted.

---

## THE PATCH, NOT APPLIED

**Give the target draw its own address category on both sides, and stop the authority's lookahead
call sites from consuming a shared address.** Blanking cannot work post-#489; matching the base is
worthless without matching `nth`, and the only way to match `nth` is for the bucket to hold one draw.

**A. `engine/game_differential.js`**

1. **New wrapper, beside `midWrapShowdown` (defined at line 1051, installed at line 290-294).** Add
   `midWrapBattle(Battle)` — `Battle` is already in scope at line 298 — wrapping
   `Battle.prototype.getRandomTarget(pokemon, move)`. Inside it set
   `MIDW.cat = 'tgt'`, `MIDW.tgtMove = move.id`, `MIDW.tgtAtt = pokemon.side.id + pokemon.position`,
   restored in a `finally` exactly as `around()` does. **The move and the attacker are arguments** —
   they do not come from `battle.activeMove`, so the blank-bucket problem disappears by construction.
   Throw if the method is missing, matching the existing wrapper's stated policy.
2. **In `midDraw` (line 1131-1141)**, when `cat === 'tgt'` build the address from
   `[MID_SEED, turn, 'tgt', MIDW.tgtMove, MIDW.tgtAtt]` — **the attacker's slot, never the target's;
   the target is what is being drawn and cannot be in its own address.**
3. **The lookahead sites must not consume the address.** Wrap
   `BattleActions.prototype.runMove` with `MIDW.inRunMove = true` (save/restore). In the
   `getRandomTarget` wrapper, take the shared `tgt` address only when `MIDW.inRunMove`; otherwise draw
   without consuming one, using the existing `MID_RANGE_PINNED` precedent (line 1151: *"it consumes NO
   shared address"*) and **counting** it. This is what removes `getActionSpeed` (380),
   `addChoice` (203) and `insertChoice` (164) from the shared stream so `runMove`'s draw is `nth = 0`.
4. `sim/pokemon.ts:825`'s retarget-on-faint `getRandomTarget` also sits inside `runMove`. It cannot
   fire for a `randomNormal` move whose target was already resolved live, but that is an argument, not
   a measurement — **count it and print a non-zero loudly** rather than assuming it stays at zero.

**B. `engine/medicham2-browser.js`**

5. **Line 19341** — `RNG_STREAMS` gains `'tgt'`, so `midEventDice` builds the stream and
   `MID_ADDR_CAT` needs no entry (the stream name is the category).
6. **Line 21197, the WIRE 144 block** (guard at 21194). Save `MID_MOVE`/`MID_TGT`, set them to
   `it.a.move.id` and `midEventSlot(m)` (**the attacker**), take the draw from `_R.tgt()` instead of
   the generic `rng()`, restore in a `finally`. This is the identical save/restore shape already used
   at 27080-27081 for the secondary address and at 31535-31537.
7. The Encore-override draw one block up (line 21150) models the same
   `getRandomTarget` and must move to `_R.tgt()` with it, or the two blocks will disagree about which
   stream a re-roll comes from.

**BOTH ENGINES THEN BUILD `20260813|2|tgt|outrage|p11|0` AND SHARE THE DIE.**

**WHAT IT COSTS, DECLARED UP FRONT:** removing ~747 draws from the `any` bucket **re-shifts every
remaining `any` `nth`**, so `PIN_DIGEST` moves and every published middle-arm rate re-baselines —
exactly as #489 did four hours ago. `engine/arms_comparable.js` will refuse to table before against
after, which is correct behaviour and already built. **This is a second re-baseline in one day and
that is a scheduling decision, not ENGINE's to take unilaterally.**

**NOT PROPOSED, deliberately:** declaring the row incomparable. #478 records that Will chose "fix the
address" explicitly over that option, and this diagnosis does not reopen a ruling he already made — it
reports that the *mechanism he was offered* has been invalidated by a change made since.

## SAME BUG AS THE RANDOM-TARGET ROW? **YES — AND THE SAME GAME**

Evidence, each item read rather than reasoned:

- **Identity of the seed.** #478's register row names `seed …2635122796 vs …2634861011 t2` with
  `p2.party.staraptor.hp` and `p2.party.incineroar.hp`. The HEAD artifact's only
  `-damage: a different body` first divergence carries that same seed and those same two leaves.
- **The HEAD artifact carries exactly ONE row of that class** — probe clause 1, asserted, not counted
  by eye. There is no second game for the brief's "separate row" to be.
- **The report #478 rests on names it too.** `docs/_reports/2026-08-27-random-target-address.md` §4:
  *"The one board-material game of the pinned 961 is `baseline / …2635122796 vs -2634861011`, turn 2"*,
  and its `--focus 2635122796` prints `20260813|2|any|-|-|3` — the exact address this probe uses to
  predict the authority's body under both hashes.
- **The numbers in that report look different only because it wrote the leaves in medicham/showdown
  order and the die had not been fixed yet.** `160/87` and `106/170` are the `e3587c62` artifact,
  which this probe reproduces from the bare hash.

**So the pending decision covers one game, not two — and the reason to act on it is not the count, it
is that its measurement is dead.**

## OWED, NOT RUN

Nothing here was measured by a run; every figure is arithmetic over two committed artifacts. What a
landing would owe:

```bash
# 1. the probe, which must stay green and must be re-read after any address change
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_target_swap.js

# 2. #478's own instrument, re-run against the MIXED hash — the number it published is stale
node tests/probe_random_target_address.js --games 1200 --team-store data/team-pool-frozen \
     --census data/verification/census-pin-<pin>.json --focus 2635122796

# 3. the identity floor, because a new category is a new place for the two engines to disagree
node tests/test-middle-identity.js

# 4. the differential, ONLY in a slot where nothing else is writing, and with the pin declared
tools\lownode.cmd engine\game_differential.js --games 1200 --team-store data/team-pool-frozen
# expect PIN_DIGEST to MOVE and arms_comparable.js to refuse a before/after table. That is correct.

# 5. the census, which cannot have moved here (nothing was fixed) and must be re-read after a landing
node tests/test-mechanics.js && node engine/status.js
```

**Not run by me and deliberately so:** `game_differential.js`, any roster stage,
`all_mechanics_fire.js`, `quarantine.js`, `status.js` — four other agents are live and the brief
forbids them. **No engine file was opened for writing.** The census is untouched at whatever the
concurrent batches leave it; this diagnosis cannot have moved it.

**Which scoreboard this should move, stated before the run rather than after:** Outrage is 118 uses in
the tag artifact and this is a pinned-pool row, so **the pool is the right scoreboard and the lab will
not see it** — the roster stages one mechanic against one body, and a random target needs two.
