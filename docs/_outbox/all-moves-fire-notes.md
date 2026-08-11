# ROADMAP #143 — build the games from the mechanic list, then compare against Showdown

Run 2026-08-10. Instrument: `engine/all_mechanics_fire.js` (new). Release **7bf3a1e19ce5**, arm
`bottom-tie-first`. Artifact: `data/all-mechanics-fire.json`. 1,415 games, 0 threw.

```
SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --release 7bf3a1e19ce5 --kind all --write
```

---

## VERDICT

**484 of the 500 moves this format admits now RESOLVE inside a real Showdown game** — clicked,
executed, and producing a consequence in the authority's own log, not merely clicked. The deliberate
roster stages 427 on a single built turn. The two together leave **10 moves that nothing in this
project has ever made fire**.

**125 of those 500 games diverge from Showdown, collapsing to 105 distinct causes.** The differential
that guards the MEDICHAM gate is clean at 20,000 comparisons and stayed clean through this work; it
plays teams a bot would bring, and every one of these 105 sits in the coverage hole that leaves.

Abilities and items are reached far less well and the honest summary is that **the roster beats this
instrument on both**: 59 abilities fire here against the roster's 94, and 12 items against 139.
Thirteen abilities are `SHOWDOWN-ONLY` — the authority's game changed and ours did not — and each is a
candidate engine gap, though eight of the thirteen have an attribution problem stated below.

---

## 1. THE INSTRUMENT

`engine/game_differential.js` builds both teams, so nothing about them is unknown and it has no
resolution ceiling. Its one real limit is COVERAGE: it plays realistic teams, so it only ever
exercises moves a bot clicks. This inverts that — **the team is derived from the mechanic** — and
plays the result through the same driver, the same pin and the same divergence vocabulary.

Three rules govern it:

- **Showdown's own `TeamValidator` accepts every team.** Not our legality check. This immediately
  produced three facts nothing else in the repo knew: the validator refuses a four-body team outright
  (*"You must bring at least 6 Pokémon"*), it objects to a 0-SP body under the nature `Serious`
  specifically, and it refuses sets the existing directed scenarios use — **`Incineroar can't learn
  Knock Off` in this format**, which is what the `knock-off order` scenario has been staging for
  weeks. Battles do not validate, so nothing caught it. The sheet the authority judges is six bodies;
  the game brings the first four (`team 1234`), because medicham2 would otherwise carry a four-body
  bench against Showdown's two and Beat Up and Revival Blessing read the party size.
- **A CLICK IS NOT A TEST.** A row is credited only when Showdown's own stream shows the move
  executing AND producing a consequence. `-fail` and `|cant|` name the user and refuse outright;
  `-miss`, `-immune`, `-notarget` and a guard `-activate` name ONE BODY and refuse only when the
  segment produced nothing at all — a spread move whose partner-side target is behind a Protect
  plainly resolved against the other one.
- **The verdict is read off SHOWDOWN, never off medicham2.** A resolution judged from our own
  narration is the engine grading its own homework.

### It was shown RED first, five ways

```
CAUGHT  a move clicked into a TYPE IMMUNITY must not be credited (thunderbolt into Swampert) [-immune]
CAUGHT  CONTROL — the same move into a legal target MUST be credited
CAUGHT  a mechanic swapped for ITSELF must read DID-NOT-FIRE — a FIRED here is noise
CAUGHT  a corrupted medicham2 damage line must be caught as a divergence   [-damage field 3]
CAUGHT  THE SAME A/B ASKED TWICE MUST GIVE THE SAME VERDICT — the instrument failed this once
```

The fifth plant exists because **the instrument was non-deterministic and shipped a wrong number
before it was caught.** Showdown's log carries `|t:|<unix seconds>`; the ability A/B arm compared raw
logs, so two identical invocations minutes apart returned `showdown_only: 23` and then `16`. It is
now compared through the driver's own `sdStream` reducer and three consecutive runs agree exactly.
Nothing in the other four plants could have caught this — they each run once.

### Four fixture defects were found by measurement, not by reading

Each of these made a CORRECT engine look broken, and each was found by chasing a reason line rather
than accepting a zero:

| what the fixture did | what it cost |
|---|---|
| allies clicked **Endure** | `-singleturn` vs `-start` parted **every game at line 6**; the comparison could see nothing else |
| the receiver hit with **Waterfall** | 20% flinch, and the bottom arm fires every secondary — the harness stunned its own actor, and 6 moves read "never issued" |
| the receiver hit with **Facade** (Normal) | `-immune` against a Ghost actor, so Counter correctly failed for want of a hit to counter |
| the carrier's own ability | Abomasnow's **Snow Warning** already had snow up, so Snowscape read `-fail`; Zoroark-Hisui's **Illusion** renamed the body the verdict looks for |

The last one is now derived from the ability's own tags (`weatherSetter`, `terrainSetter`,
`switchInForme`, …). Illusion is the one hand-named exception and is marked as such.

---

## 2. MOVES — 484 / 500

| | count |
|---|---|
| exist in the format | 500 |
| attempted | 500 |
| **RESOLVED** | **484** |
| diverged from Showdown | 125 (105 distinct causes) |
| medicham2 and Showdown disagree about whether the move resolved | 28 |

Rung that caught each resolution — the ladder is generic, no rung names a move or a species:

```
bare 468   items 7   warm-up 4   everyone-hurt 2   asleep 2   hurt+items 1
```

### The 16 that did not resolve, with the authority's reason

| move | reason |
|---|---|
| powershift, softboiled, spore, struggle | **NO LEGAL CARRIER** — a fact about the regulation, not a gap |
| attract | `-immune`. Both sides are gender `N`, which is a DECLARED CONTROL of `game_differential`'s `buildPair` (Showdown writes gender into the `switch` details field and medicham2 has none). Attract, Rivalry and Cute Charm are unreachable by this whole family of instruments until that control is lifted. |
| focuspunch | `cant: Focus Punch` — the user was hit before it resolved, which is Focus Punch working. Needs a turn where the actor is not hit, which the `needsTargetToAttack` setup deliberately arranges the opposite of. |
| counter-family leftovers: upperhand | needs the target to be using a PRIORITY damaging move; the fixture's receiver has none |
| soak | the receiver fixture is pure Water, so Soak fails. Needs an alternate-typed receiver — a rung that was designed and not built. |
| steelroller | `failsWithoutTerrain`, and the carrier cannot learn a terrain setter. The fix is to let the ALLY set it; designed, not built. |
| lastresort | needs every other slot used first |
| belch, recycle | need a berry that has actually been EATEN; the `hurt+items` rung damages but not below the Sitrus threshold |
| healbell | needs a statused ally |
| magneticflux | needs a Plus/Minus ally |
| lifedew, quash | `-fail` on a board the ladder does not reach |

Ten of these are instrument gaps with named fixes; four are facts about the format; two (attract,
focuspunch) are structural.

### The divergences — top causes, 105 distinct across 125 rows

Full list in `data/all-mechanics-fire.json`. The largest, verbatim:

```
  8  [extra event emitted by medicham2]   FIXED-DAMAGE AND OHKO MOVES CRIT
     SD |-damage|p2a: Feraligatr|814/960
     ME |-crit|p2a: Feraligatr
     comeuppance, counter, endeavor, finalgambit, mirrorcoat, nightshade, seismictoss, superfang
     — and separately fissure, guillotine, horndrill (3 more)
     Seismic Toss cannot crit. medicham2 rolls one anyway (every crit lands under this arm).

  5  [unrelated event mismatch]           ENDURE ANNOUNCES ITSELF WITH THE WRONG EVENT
     SD |-singleturn|p1a: Abomasnow|move: Endure
     ME |-start|p1a: Abomasnow|move: endure
     Showdown's Endure condition is onStart -> add('-singleturn', ...).

  4  [extra event emitted by medicham2]   THE SELF-KO MOVES FAINT IN THE WRONG ORDER
     SD |faint|p1a: Forretress
     ME |-damage|p1a: Forretress|0 fnt
     explosion, memento, mistyexplosion, selfdestruct

  3  [ordering]                           STOCKPILE BOOSTS BEFORE IT ANNOUNCES
     SD |-start|p1a: Araquanid|stockpile1
     ME |-boost|p1a: Araquanid|def|1
     spitup, stockpile, swallow

  2  [ordering]                           THE SANDSTORM RESIDUAL IS SPEED-SORTED
     SD |-damage|p2b: Charizard|861/918|[from] Sandstorm
     ME |-damage|p1b: Venusaur|872/930|[from] Sandstorm
     sandspit, sandstream   (the same cause the directed roster already carries)

  2  [event missing from medicham2]       QUICK DRAW DOES NOT ACTIVATE
     SD |-activate|p1a: Slowbro|ability: Quick Draw
     shellsidearm, quickdraw

  1  [-damage field 3]   beatup    SD 949/960   ME 919/960   (both sides carry four bodies)
  1  [-damage field 4]   bind      SD |[from] move: Bind|[partiallytrapped]  ME |[from] partiallytrapped
  1  [switch: a different body]  bittermalice — Illusion does not disguise the lead in medicham2
  1  aurawheel — medicham2 emits a `detailschange` Showdown does not
  1  bellydrum — medicham2 boosts where Showdown does nothing
  1  beakblast — `-singleturn|move: Beak Blast` missing
  1  block / attract — trapping and Attract use `-start|move: x` where Showdown uses `-activate`/`-immune`
```

**Twenty-eight rows where the two engines disagree about whether the move resolved at all** are in
the artifact under `medicham_resolved`. Most are medicham2 producing no consequence line where
Showdown produces one: `copycat`, `entrainment`, `roleplay`, `simplebeam`, `guardsplit`, `powersplit`,
`guardswap`, `powerswap`, `speedswap`, `psychup`, `lockon`, `fairylock`, `spite`, `teatime`,
`corrosivegas`. Four go the other way — `attract`, `belch`, `lastresort`, `soak` — where medicham2
resolves a move the authority refuses.

---

## 3. ABILITIES — 59 fired of 316

```
{"exist":316,"tried":316,"fired":59,"showdown_only":13,"medicham_only":0,
 "did_not_fire":98,"unreachable":129,"control_not_quiet":58,"diverged":20}
```

An ability usually announces nothing, so "did it fire" cannot be read from a stream. The verdict is
DIFFERENTIAL: play the same game twice under identical pinned dice, once with the ability and once
with another of that species' own legal abilities, and ask whether the two games differ. That is the
same question the deliberate roster asks on a staged turn, asked inside a real game.

**Thirteen `SHOWDOWN-ONLY` rows — the authority's game moved and ours did not:**

```
  cloudnine        altaria         vs Natural Cure    [control not quiet]
  forewarn         musharna        vs Synchronize
  justified        absol           vs Pressure        [control not quiet]
  mirrorarmor      corviknight     vs Pressure        [control not quiet]
  moldbreaker      basculegion     vs Swift Swim
  naturalcure      altaria         vs Cloud Nine      [control not quiet]
  pressure         absol           vs Super Luck      [control not quiet]
  quickdraw        slowbrogalar    vs Own Tempo
  rockhead         aerodactyl      vs Pressure        [control not quiet]
  superluck        absol           vs Pressure        [control not quiet]
  supremeoverlord  kingambit       vs Defiant
  trace            gardevoir       vs Synchronize
  unnerve          aerodactyl      vs Rock Head       [control not quiet]
```

**Read these as candidates, not as thirteen bugs.** The control arm is itself an ability, and when it
is a live one the pair cannot say which of the two moved Showdown's game. The deliberate roster hit
the identical hazard and named it `CONTROL-NOT-QUIET` on 15 of its own rows. Here 58 rows carry the
flag, 8 of the 13 above among them. Settling it needs a THIRD arm against a control proven inert.
**This pass did not run one.** `forewarn`, `moldbreaker`, `quickdraw`, `supremeoverlord` and `trace`
have quiet controls and are the five to look at first — and `quickdraw` is independently confirmed by
the protocol divergence above.

`medicham_only` is 0: there is no ability that moves our game and not the authority's.

129 abilities have **no legal carrier** in this format. The roster says 114. The difference is that
this instrument's species list excludes mega and battle-only formes; the roster's does not. Worth
reconciling — it is a disagreement about what "reachable" means, not about an engine.

---

## 4. ITEMS — 12 fired of 148 (73 in scope)

```
{"exist":148,"tried":148,"fired":12,"showdown_only":0,"medicham_only":0,
 "did_not_fire":61,"out_of_scope":75,"diverged":3}
```

75 are out of scope (mega stones — measured by the mega counters — and non-battle items).
**This is the instrument's weakest population and the roster is much better at it.** The gauntlet
puts one fixed holder (Corviknight) opposite one fixed Water attacker; 18 resist berries need a
matching super-effective hit and 18 type-boost items need the holder to click the matching type, and
neither is staged. The fix is derivable and was designed but not built: `resistBerry` and
`damageMultType` both NAME THEIR TYPE in `data/tags.json`, so the incoming hit and the holder's click
can be chosen from the tag. That is the single highest-value follow-up here.

---

## 5. THE OVERLAP — and the set NEITHER instrument reaches

| population | roster fires | here | BOTH | only here | only roster | **NEITHER** |
|---|---|---|---|---|---|---|
| moves | 427 | **484** | 421 | **63** | 6 | **10** |
| abilities | 94 | 59 | 35 | 24 | 59 | **198** |
| items | 139 | 12 | 9 | 3 | 130 | **6** |

**The two instruments are complementary and the shape is clear**: a real game is much better at
moves, a staged board is much better at items and abilities.

**Moves nothing has ever made fire:**
`attract  healbell  lastresort  magneticflux  powershift  quash  recycle  soak  struggle  upperhand`

**Items nothing has ever made fire:**
`aspearberry  kingsrock  leppaberry  rawstberry  scopelens  shedshell`

**Abilities nothing has ever made fire: 198.** That is the largest untested surface in the project and
this pass did not shrink it much — 24 of the roster's `COULD-NOT-STAGE` rows now fire in a real game
(`aftermath`, `berserk`, `cursedbody`, `damp`, `effectspore`, `galewings`, `moxie`, `pickpocket`,
`plus`/`minus`, `poisontouch`, `protean`, `shedskin`, `sniper`, `static`, `stickyhold`, …), which is
real but small against 198.

---

## 6. WHAT I DID NOT MANAGE

- **Items and abilities are undermeasured and I know how to fix them.** Deriving the incoming hit and
  the holder's click from `resistBerry`/`damageMultType` params was designed and not built.
- **No third control arm for the ability A/B**, so 8 of the 13 `SHOWDOWN-ONLY` rows are ambiguous.
- **Attract, Rivalry and Cute Charm are structurally unreachable** because gender is a declared
  control of the shared `buildPair`. Lifting it is a `game_differential` change with a blast radius
  across every run that file has done, and I did not take it.
- **Six named move gaps have named fixes I did not build**: an alternate-typed receiver (soak), the
  ally setting terrain (steelroller), a use-every-other-slot rung (lastresort), a berry-actually-eaten
  rung (belch, recycle), a statused ally (healbell).
- **I did not run `tests/test-mechanics.js`.** It regenerates `data/mechanics-census.json`, and
  another agent was editing `engine/medicham2-browser.js` throughout this session (mtime 23:34). The
  census would have been stamped over a moving engine. Nothing here changes the census — no mechanic
  was added — so the count cannot have gone down.
- **I did not run `engine/status.js --write`** for the same reason.

## 7. ROUTING — two things that are not mine

1. **`data/all-mechanics-fire.json` was auto-classified by `engine/quarantine.js` as DOWNSTREAM of
   MEDICHAM and is therefore withheld.** It is not downstream — like `game_differential`, it MEASURES
   medicham2 against the authority. Same argument CLAUDE.md already makes for the census, the
   interaction matrix and the game differential. That classification belongs to MEASURE.
2. **`Incineroar can't learn Knock Off` in this format**, and the `knock-off order` directed scenario
   in `engine/game_differential.js` stages exactly that. The battle runs because battles do not
   validate. The scenario's conclusions are about a set the authority would refuse.

## 8. GATE STATE — unchanged by this work

`node tests/test-engine-diff.js --n 20000` → **agreed 20000, disagreed 0**, before and after.
`node tests/test-game-differential.js` → ALL PASSED.
`node engine/quarantine.js` → the four clauses my brief named all PASS. The gate reads CLOSED on a
clause added by another agent this session (`no open, known engine defect`, 16 open roadmap rows) and
on nothing I touched. The `coverage` clause that was failing when I started now passes.

Files changed: `engine/all_mechanics_fire.js` (new). `engine/game_differential.js` — three additive
changes only: `lastSdLog()` exported, `buildPair(sheet, {max})` (default 4, unchanged), and the
matching `picked.length < cap` guard.
