# The bench is compared now — and the known defect it was supposed to catch was never on the bench

**ENGINE, 2026-08-25.** Historical record, per `docs/_reports/` convention. Not current state;
superseded by the register rows it feeds. Every figure is read out of a run whose command is printed
beside it, or cited to a line in the pinned Showdown checkout.

---

## 0. VERDICT

**The end-state comparison now reads a benched body's volatiles.** Twenty leaves, on every party
member that is NOT standing, on both sides, at every turn boundary. Before this pass a body that
walked off the field carrying something it should have dropped was read by nothing in this
repository.

**It catches nothing today, and that was measured before it was wired, not discovered after.**
`tests/probe_bench_leaves.js` over 64 games / 803 boundaries / **3,211 benched bodies**: every one of
the twenty leaves compared 3,211 times, **0 differ and 0 ever non-empty on either side.** The
whole-game run confirms it — 961 games, cause for cause identical to HEAD, **no new divergence class
of any kind.**

**THE BRIEF'S ACCEPTANCE TEST COULD NOT BE MET, AND THE BRIEF'S PREMISE IS WHAT WAS WRONG.** The
`magicbounce` defect is not a bench defect. Its witness is `p2a feraligatr vol.trapped` — an **ACTIVE**
body, in a slot the comparison has read since ROADMAP #308. A bench comparison cannot see it and does
not. Said plainly rather than fudged: the new comparison was proved by **two planted failures**
instead, each shown NOT CAUGHT before the wiring and CAUGHT after.

**The known defect is fixed anyway, and it is a different bug from the one the brief describes.** On a
Magic Bounce reflection this engine recorded the trap's owner as the **clicker**, which after a bounce
is the victim itself — so the victim was trapped by itself, permanently, and no body on the field could
release it. Census **696 → 697**; the `magicbounce` lab row goes `STATE` → `NO-DIVERGENCE` and is the
**only** row in the entire lab that moved.

| quantity | HEAD (`382e998`) | after |
|---|---|---|
| census probed / live / missing | 696 / 696 / 0 | **697 / 697 / 0** |
| damage differential, all 16 corners | 0 of 6000 | **0 of 6000** |
| whole-game, arm `middle` | 961 games, 28 parted | **961 games, 28 parted** |
| board-material | 10 causes / 10 games | **10 causes / 10 games** |
| narration-only | 17 causes / 18 games | **17 causes / 18 games** |
| DIFFERENT-END-STATE | 8 | **8** |
| `all_mechanics_fire` STATE rows | 9 (`magicbounce` among them) | **8** |
| roster items / abilities / moves DIFFER | 0 / 0 / 0 | **0 / 0 / 0** |

---

## 1. WHAT THE COMPARISON NOW READS, AND WHERE THE FIELD LIST CAME FROM

The authority's `clearVolatile` (`sim/pokemon.ts:1519-1566`) is unambiguous:

```
  for (const i in this.volatiles) {
    if (this.volatiles[i].linkedStatus) {
      this.removeLinkedVolatiles(this.volatiles[i].linkedStatus, this.volatiles[i].linkedPokemon);
    }
  }
  ...
  this.volatiles = {};
```

**Everything goes**, and `removeLinkedVolatiles` (`:2053`) runs first so a linked effect is unhooked
from the OTHER body too. So the authority's half of a bench comparison is empty **by construction**,
not by luck.

The compared list is therefore **not a list I typed**: it is the `vol` projection `engine/board_state.js`
already uses on the active slots, where both engines' shapes were measured against each other leaf by
leaf on earlier passes. Twenty leaves —

```
substitute  taunt  encore  disable  leechseed  confusion  perish  trapped_by_move
aquaring  ingrain  magnetrise  focusenergy  torment  imprison  saltcure  syrupbomb
charging  trapped  uproar  charge
```

**Standing bodies are excluded, and that is the one thing this needed care about.** `sf.team` and
`side.pokemon` are the WHOLE party — the actives are in them — so comparing `vol` there would report
every active-slot volatile difference a **second** time under a party path. One finding read as two. A
party row therefore answers `vol: null` while its body is standing, `walkBody` skips a null leaf, and
the skip is COUNTED (`party_vol_on_field_skipped`) so "not asked" can never read as "agreed". The
asymmetric case — one engine says standing, the other says benched — is counted separately
(`null_leaf_asymmetric`) and left to the active slots' own `species` walk rather than expanded into a
louder copy of the same finding.

**The receipt is live**, measured on the lab run: 4,152 + 3,164 + 1,308 = **8,624** standing-body skips
across the three populations. A zero there would mean the leaf is unwired.

---

## 2. PRINTED BEFORE IT WAS WIRED — 3,211 BENCHED BODIES, NOTHING TO CATCH

```
SHOWDOWN_PATH=… node tests/probe_bench_leaves.js --games 600
  64 games, 803 turn boundaries, 3211 benched bodies compared

  leaf                compared  non-empty  DIFFER
  vol.substitute          3211          0       0
  vol.trapped             3211          0       0
  vol.leechseed           3211          0       0
  … (all 20, identical)   3211          0       0
  volatiles (raw keys)    3211          0       0     <- each engine's own field names, untranslated
```

The probe was extended this pass to read the **same projection the comparison would use**
(`board_state._internals.mediBody` / `sdBody`) rather than a second copy of it, and it keeps the older
untranslated key-set row beside it as the unfiltered view.

**So this was wired knowing it catches nothing.** The `NOT_COMPARED` row it replaces argued the
opposite — *"a leaf whose two shapes have never been seen carrying anything is wired for free and
catches nothing"* — and that argument was right about the measurement and wrong about what to do with
it. An uncompared leaf is one whose regression reads as agreement, and **medicham2 clears its bench
field by field in `switchOut` rather than with one wipe**, so the next volatile added to the engine is
clean only if somebody remembers to add a line. This is what notices when nobody does.

---

## 3. THE RED DEMONSTRATION

### 3a. On the known defect: IT DOES NOT CATCH IT, AND HERE IS WHY

The brief's model was *"a body switches out carrying something it should have dropped and sits on the
bench unread."* The authority's own log for the `magicbounce` scenario says otherwise:

```
turn 1  |move|p2a: Feraligatr|Block|p1a: Espeon
        |move|p1a: Espeon|Block|p2a: Feraligatr|[from] ability: Magic Bounce
        |-activate|p2a: Feraligatr|trapped
turn 4  |switch|p1a: Charizard|Charizard, L50|918/918        <- the ESPEON leaves
```

The body left holding something is **Feraligatr, which is standing in p2a** — and `vol.trapped` on an
active slot has been compared since ROADMAP #308, which is exactly how the defect was visible in the
first place. The body that walked to the bench is the **Espeon**, and what it should be carrying is
Showdown's `trapper` mark, which medicham2 does not model at all and which is a standing
`NOT_COMPARED` row for that reason.

**A bench comparison therefore cannot be red on this defect. It was tried and it is not.**

### 3b. Two planted failures instead — NOT CAUGHT before, CAUGHT after

`engine/all_mechanics_fire.js --red`, two new plants written into the LIVE medicham board at a boundary
the clean arm agreed at, on a body that is NOT standing, neither writing a protocol line:

| plant | with the wiring removed | with it |
|---|---|---|
| a BENCHED body is still TRAPPED by a move | **NOT CAUGHT** `[NO-DIVERGENCE]` | **CAUGHT** `[STATE]` |
| a BENCHED body is still behind a SUBSTITUTE with 40 HP | **NOT CAUGHT** `[NO-DIVERGENCE]` | **CAUGHT** `[STATE]` |

Two different mechanisms on purpose: the trap is a **linked** volatile whose owner is another body, the
doll is a **per-body HP pool**. A comparator that saw one and missed the other would read as healthy.
Both are asserted CAUGHT **on the leaf they were aimed at** and **with no protocol line**, and the
whole block is gated behind its own control arm, which must be protocol-clean and board-clean first.

The removal arm was a real `git stash` of `engine/board_state.js`, run through the same code path.

---

## 4. THE KNOWN DEFECT, FIXED — AND IT WAS THE OWNER, NOT THE RELEASE

### The authority's chain, read at the lines

```
data/abilities.ts:2436   Magic Bounce:  this.actions.useMove(newMove, target, { target: source })
                                        -> the reflected move's USER is the BOUNCE HOLDER
data/moves.ts:1520       Block:         onHit(target, source, move) {
                                          return target.addVolatile('trapped', source, move, 'trapper') }
sim/pokemon.ts:2020-2029 addVolatile:   puts `trapper` on the SOURCE and cross-links the pair
sim/pokemon.ts:1532-1536 clearVolatile: walks its OWN volatiles, calls removeLinkedVolatiles
sim/pokemon.ts:2053      removeLinked:  linkedPoke.removeVolatile('trapped')
```

Not overridden by Champions (`data/mods/champions/abilities.ts` has no `magicbounce`;
`data/mods/champions/conditions.ts` has no `trapped`).

### What this engine did

`medicham2-browser.js`, the `trapmove` branch, wrote `t._trapHard = { by: m, mv: a.mv }` with `m` the
ORIGINAL CLICKER — unconditionally. After a bounce `t === m`, so the record read **"Feraligatr is
trapped by Feraligatr"**. `releaseTrapsBy` skips `b === src`, so no body on the field could ever free
it: the victim was trapped by itself, for ever.

`switchOut`'s trapper-release, landed 2026-08-24, was correct and simply had nothing to match.

### The fix, and the knob

```js
const _by = (_bounced && !BOUNCED_TRAP_KEEPS_CLICKER) ? _t0 : m;
```

`_t0` is the resolved original target — the body carrying Magic Bounce. `MEDI_BOUNCED_TRAP_KEEPS_CLICKER=1`
restores the defect and stamps `MEDFAILS.bouncedTrapOwnerRestored = 1`; the success path counts
`MEDSEEN.bouncedTrapOwnedByBouncer`.

### The probe, written first and watched fail

`move/trapsTarget` — *"a BOUNCED trap belongs to the BOUNCER: the trap dies when the Magic Bounce body
leaves"*. Three turns: the foe clicks Block into an Espeon and is trapped by the reflection; the
**bouncer** either walks off or stands still; the victim then asks to leave. It tests the OUTCOME —
who holds the foe's slot — not the classification.

```
BEFORE   MISSING   bouncer leaves (slot A holds kangaskhan) -> victim slot still "feraligatr"
AFTER    LIVE      bouncer leaves -> victim slot "kangaskhan";  CONTROL, bouncer stays -> "feraligatr"
KNOB ON  MISSING   MEDI_BOUNCED_TRAP_KEEPS_CLICKER=1 reproduces the red exactly
```

The control arm is the same board with the bouncer standing still, and it holds the trap in **both**
arms — an over-release costs a game exactly as an under-release does.

---

## 5. WHAT NEW DIVERGENCES APPEARED — NONE

The brief said to expect the whole-game number to RISE and to say so before running it. It was said
before the run. **It did not rise, and it did not fall.**

```
engine/game_differential.js --arm middle --games 1200 --release 359b51b61d83
  --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json
  --end-state --write
```

961 games. HEAD and after are identical on **every** figure and on the **cause list itself** —
computed by set difference, not by eye:

```
BOARD-MATERIAL causes only in HEAD:  []
BOARD-MATERIAL causes only in NOW :  []
ALL causes only in HEAD:             []
ALL causes only in NOW :             []
```

No `party.vol.*` family appears anywhere in the leaf table. This is the predicted outcome of §2 and
also the outcome that mattered most: **the wiring did not MANUFACTURE anything either**, which was the
real risk in a comparison whose two sides could have held one fact in two shapes.

`all_mechanics_fire --kind all` moved by exactly one row in the whole lab:

```
abilities HEAD:  klutz [party.item,item] | magicbounce [vol.trapped] | sandforce [party.hp,hp]
abilities NOW :  klutz [party.item,item] |                            sandforce [party.hp,hp]
moves / items:   byte-identical
```

**The pool did not move and the lab did — which is what a rare mechanic looks like.** Magic Bounce plus
Block is not something the frozen pool contains; the pool row this family was named for cleared on an
earlier pass, and the lab row is the one that was still open. Said in advance of the run, per
CLAUDE.md's ranking rule.

---

## 6. A STANDING RED THAT IS NOT MINE, AND A SHARP NEW DIAGNOSIS OF IT

`data/game-differential.json` carries `state.planted_state_proof_ok: **false**`, and the run prints
**"THE STATE COMPARATOR FAILED ITS OWN PROOF — every state number below is worthless."**

**It is pre-existing.** Traced through the artifact's own history: false on all twelve committed
versions back to 2026-08-24T02:03, with the **identical** thirteen failing rows. It is already on the
`docs/ENGINE.md` hand list. It is repeated here because it qualifies the board-material figure in §5 —
mine and the previous three passes' alike.

**What is new is the shape of it, and it is one fact, not thirteen.** Cross-referencing every failing
plant against the slot it aims at:

| plants aimed at | outcome |
|---|---|
| `S.actA[0]` / `S.actA[1]` — substitute, disable, leechseed, confusion, aquaring, ingrain, torment, imprison | **8 of 8 CAUGHT+LOCALISED** |
| `S.actB[0]` / `S.actB[1]` — taunt, encore, perish, magnetrise, focusenergy, saltcure, syrupbomb | **7 of 7 applied and NOT CAUGHT** |
| the six BENCH plants (either side) | **6 of 6 NOT APPLIED** |

A perfect side split is not a comparator that half works. The leading hypothesis — **not confirmed, and
it needs the boundary-6 board printed before anybody acts on it** — is that side B's actives and both
benches are CORPSES at the plant boundary, so `board_state.js` correctly holds their `vol` under the
POST_FAINT rule and the plant is correctly ignored. That is the same fixture failure the file's own
header already records paying for once, on the bench, in 2026-08-18's note: *"a COULD-NOT-STAGE verdict
is a claim about the fixture, never about the mechanic."*

**AND IT IS WHY `engine/game_differential.js` EXITS 1.** Both of this pass's whole-game runs returned
exit code 1, as the previous pass's must have. Nothing else in either run is red — the two logs are
byte-identical apart from a pool-cache rebuild line and the wall clock.

**Not fixed here**, per the brief's instruction to name what the pass finds and leave it. It is the
single highest-value item on the hand list: while it stands, every state number this project publishes
carries a caveat, and a caveat is not a quarantine.

---

## 7. ARTIFACTS RESTORED

All four, at release `359b51b61d83`:

```
tests/roster.js --stage items      DIFFER 0  DID-NOT-FIRE 0  MATCH 139  DEFERRED 1  COULD-NOT-STAGE 8
tests/roster.js --stage abilities  DIFFER 0  DID-NOT-FIRE 0  MATCH 130  CONTROL-NOT-QUIET 45  COULD-NOT-STAGE 141
tests/roster.js --stage moves      DIFFER 0  DID-NOT-FIRE 0  MATCH 475  DEFERRED 3  COULD-NOT-STAGE 22
engine/all_mechanics_fire.js --kind all --write   one row moved in the whole lab (magicbounce), nothing else
```

Every figure identical to the previous pass's.

Also re-run green: `tests/test-mechanics.js` (697/697), `tests/test-engine-diff.js --n 6000 --seed 20260804`
(0 of 6000, all 16 corners), `tests/test-end-state.js`, `tests/test-game-diff.js`,
`tests/test-no-silent-failure.js` on the three changed engine files.

---

## 8. OWED, NOT RUN

- **`planted_state_proof_ok` is still false** — diagnosed in §6, not fixed. The board-material figure in
  §5 inherits that caveat.
- `tests/run-all.js` in full. Run individually only: the seven named in §7.
- `tests/interaction_matrix.js` (last run 2026-08-11), `tests/mutation_harness.js`,
  `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check`.
- **The `trapper` mark itself.** medicham2 still has no field on the SOURCE of a trap; it keeps the
  trapper inside the victim's own `_trapHard`. That is a standing `NOT_COMPARED` row and it is what
  makes the Espeon's bench genuinely unreadable — the one bench leaf this pass could not add.
- **A POOL-SCALE reading of `MEDSEEN.bouncedTrapOwnedByBouncer`.** The counter is proved by the census
  probe and by the lab row; it has not been read over 961 pool games, where Magic Bounce plus a trap
  move is expected to be zero.
- The eight items still on the `docs/ENGINE.md` hand list.
