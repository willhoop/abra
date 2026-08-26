# The 67 DID-NOT-FIRE rows — why, and what is actually unmeasured

Read-only diagnosis, 2026-08-26. Every artifact read with `git show HEAD:<file>` while an ENGINE
agent held the play layer. **No file in `engine/`, `tests/` or `data/` was touched, and nothing that
plays a game was run.** The Dex reads below use `SHOWDOWN_PATH` and are derivations, not battles.

Artifacts read (all at HEAD):

| file | generated | what it is |
|---|---|---|
| `data/all-mechanics-fire.json` | 2026-08-26T07:30:28Z, release `419e9636ec6a`, arm `bottom-tie-first` | the 964 rows, 168 FIRED / 67 DID-NOT-FIRE / 8 SHOWDOWN-ONLY |
| `data/roster.abilities.json` | 2026-08-26T07:18:44Z | 316 abilities, one deliberate scenario each |
| `data/roster.items.json` | 2026-08-26T07:09:26Z | 148 items |
| `data/mechanics-census.json` | 2026-08-26T07:39:25Z | 715 probed, 715 live, 0 hollow |
| `data/sheet-usage.json` | 2026-08-11T00:58:26Z | 26,232 teams; `teams` = teams carrying it at least once |
| `data/game-differential.json` | 2026-08-26T06:47:32Z | coverage block |
| `data/team-pool-frozen/games.bo3.jsonl` | frozen 2026-08-12 | 13,214 games, presence proxy only |

---

## VERDICT

**The premise that the excluded 67 are unmeasured does not survive contact with the other two
instruments. 64 of the 67 are covered somewhere else; 3 are not.**

| | rows | team-appearances |
|---|---|---|
| the excluded set | 67 | 41,235 |
| — carry a LIVE census probe on their own tag (0 hollow) | **67** | 41,235 |
| — census probe NAMES the entity in its own label | 51 | — |
| — roster staged it, the authority moved, and **both engines' boards MATCHED** | **32** | **34,192 (82.9%)** |
| — covered by NEITHER a roster board delta NOR an entity-named probe | **3** | **910** |

The three that nothing covers by name: **Overgrow (697 teams), Magma Armor (159), Healer (54).**
Overgrow's tag `damageBoost` has 7 live probes and none names it — but one of them is *"Blaze fires
ONLY under a third of maximum HP, and the line is exact"*, which is the same `onModifyAtk` HP-fraction
shape. So the honest floor is closer to two.

**Harness gap vs fact about the format:** 54 of 67 are stageable with harness work; **13 can never
fire on this instrument and should be DECLARED** (7 pinned-die, 4 announce-only / not-an-ability,
1 gender, 1 speed-order).

**Cheapest fix, and it is not in this harness at all.** The two biggest genuinely-uncovered rows —
**Unburden (3,026 teams) and Overgrow (697)** — are `DID-NOT-FIRE` here *and* `COULD-NOT-STAGE:
THREW` in the roster, on one shared cause: the driver answered `pass` for a slot that had to act
(`p2 choice rejected p2 "pass, move 1": Can't pass: Your Milotic must make a move (or switch`). Two
rows, 3,723 team-appearances, one choice-construction bug. Everything else on the mechanics clause
is second.

**And a thing the clause is not chasing that is worse than the 67:** the artifact also holds
**8 `SHOWDOWN-ONLY` rows — the authority's A/B moved and ours did not.** They include **Unnerve
(2,343 teams), Rock Head (1,885), Mold Breaker (338), Pressure (223), Natural Cure (147), Supreme
Overlord (112)**. Seven of the eight carry `counts_against_the_gate: undefined`. A DID-NOT-FIRE is a
claim about the fixture; a SHOWDOWN-ONLY is an accusation against the engine, and it is sitting in
the same excluded neighbourhood.

---

## 1. WHAT `DID-NOT-FIRE` ACTUALLY MEANS — read the code, not the name

`engine/all_mechanics_fire.js:2841`:

```js
const sdMoved = !same(GD.sdStream(on.sdLog), GD.sdStream(off.sdLog));
const meMoved = !same(on.mediTrace, off.mediTrace);
...
else verdict = 'DID-NOT-FIRE';
```

`on` and `off` are the **same scenario played twice, differing only in the ability/item slot**.
`DID-NOT-FIRE` means **the OFFICIAL SIMULATOR produced identical reduced streams with the mechanic
and without it.** It is a statement about Showdown, i.e. about the fixture. It is never evidence for
or against `medicham2-browser.js`. That is the COULD-NOT-STAGE rule one level up, and it means the
gate clause is right to exclude these rows — it is only wrong to leave them looking like a hole.

**One instrument artefact to know before reading any row:** `abLadder` (`:1856`) does
`best = best || row;` and only replaces `best` when a later rung fires. So **every DID-NOT-FIRE row
reports `rung: "safe-pool"` regardless of how many rungs actually ran.** All 67 do. The field is
uninformative for these rows; do not read it as "only the safe rung was tried".

---

## 2. THE 67, SORTED, WITH COUNTS

Each row appears in exactly one bucket (verified: 67 assigned, 0 missing, 0 extra).
`ROSTER-OK` = `data/roster.*.json` says `FIRED-AND-BOARDS-MATCH` **and** its `sd_delta` contains at
least one leaf that is not the ability/item name field.

### DECLARE — cannot fire on this instrument, and that is a fact, not a gap (13 rows, 2,997 teams)

**D1. The die is pinned to a constant by the arm (7 rows, 2,363 teams).**
`compoundeyes(764)` `widelens(1005, ROSTER-OK)` `scopelens(246)` `brightpowder(263, ROSTER-OK)`
`zoomlens(51, ROSTER-OK)` `tangledfeet(14)` `merciless(20)`.
The run is `bottom-tie-first`, which forces every accuracy check to hit and every crit to land. An
ability whose only effect is the accuracy or crit-ratio NUMBER cannot change a line of either log,
however correct both engines are. The artifact says this itself (`arm-constant-roll`). These are
RATE questions and belong to `engine/million_targets.js`, not to a one-board A/B.

**D2. The engine has no gender (1 row, 122 teams).** `cutecharm`.
`buildPair` writes `gender: 'N'` on every body **because medicham2 has no gender at all**, and Cute
Charm reads `.gender`. Not fixable inside this harness. (The roster independently refuses it: a 30%
chance the pin makes fail.)

**D3. Announces only, or the effect is not in the ability (4 rows, 170 teams).**
`frisk(134)` `earlybird(29)` `anticipation(7)` `stall(0)`.
Frisk and Anticipation emit a MESSAGE and move no state (`engine/faces.js` `announcesOnEntry`,
`unobservable: true`). Early Bird owns no handler — its effect is `data/conditions.ts:68`
(`onBeforeMove`). Stall exposes no handler and nothing in the authority's sources reads it by name.

**D4. The speed order cannot change (1 row, 342 teams).** `swiftswim (ROSTER-OK)`.
Basculegion 78 is TIED with Feraligatr 78, and this arm gives the tie to the earlier body, which is
the subject. Doubling a Speed that already wins changes nothing.

### HARNESS GAPS (54 rows, 38,238 teams) — 28 of them already covered by the roster

**H1. There is no live partner (8 rows, 5,590 teams; 5 ROSTER-OK, 5,300 teams).**
`flowerveil(4109, ROSTER-OK)` `friendguard(1056, ROSTER-OK)` `telepathy(238)` `aromaveil(90, ROSTER-OK)`
`symbiosis(49)` `sweetveil(42, ROSTER-OK)` `receiver(3)` `curiousmedicine(3, ROSTER-OK)`.
`gauntletScript:1716` — `const A = { m: clickOf(ally, ['Protect','Endure']) }` — the ally Protects
every turn, and every receiver click carries `t: 0`, the actor. **No ally-facing handler can ever
fire.** `boardState.allyIsLive` is declared `false` at `:2032`.

There is a second, sharper half of this: `engine/faces.js` declares `allyIsTargeted: true` on
`breakable` (`:147`) and on `redirects` (`:200`), and **`facesFor` (`:161`) does not copy that key**
— its whitelist is `['recvProtects','setsWeather','countsPP','statusFirst','actor','alliesFaint',
'koTheHolder','koTheFoe','movesLast']`. The declaration reaches no board and nothing counts it.
The same is true of `recvAbility`, declared on `removesOwnMoveFlag` (Long Reach), `copiesFoeAbility`
(Trace) and MOVE_FACES `contact`/`sound`.

**H2. The subject never switches IN (2 rows, 6,848 teams; 1 ROSTER-OK, 6,740).**
`hospitality(6740, ROSTER-OK)` `screencleaner(108)`.
The subject starts on the field at full HP beside a full-HP ally, and the gauntlet's **only** switch
is the last turn, switching OUT (`:1770`). An `onStart` ability that needs a board state on entry
therefore has one entry, at turn 0, onto an empty board. Hospitality heals a damaged ally — nothing
is damaged at turn 0. Screen Cleaner deletes screens on entry — no screen has been raised and there
is no second entry.

**H3. No status ever lands on the board (12 rows, 728 teams; 5 ROSTER-OK, 203).**
`synchronize(176)` `magmaarmor(159)` `magicguard(122)` `insomnia(95, ROSTER-OK)` `healer(54)`
`marvelscale(54, ROSTER-OK)` `guts(33, ROSTER-OK)` `vitalspirit(16, ROSTER-OK)` `poisonheal(7)`
`immunity(5, ROSTER-OK)` `quickfeet(4)` `hydration(3)`.
**Derived, not assumed:** `Dex.forFormat('gen9championsvgc2026regmb').species.getMovePool('feraligatr')`
returns 82 moves and **contains no status-inflicting move at all** — no Toxic, no Thunder Wave, no
Will-O-Wisp, no Spore, no Hypnosis, no Confuse Ray. The harness's own header says so and counts it:
`summary.preflight.faces_status_noop = 12`. `faces.statusFirst` is *never added to `recvWants`*
(`:1895` concatenates `faces.recv` only), so even where a body could learn the move, `bodyOf` never
builds it and `clickOf` silently falls back.

Magma Armor is a special case worth naming: Feraligatr **does** hold Ice Beam under the `breakable`
union — but see H6, the receiver never clicks it. (I checked and discarded a tempting wrong answer:
Fire types are **not** freeze-immune. `data/typechart.ts:151` gives Fire `brn: 3` and no `frz` entry.
Camerupt is the only legal Magma Armor carrier in this format — 1 of 1 — but it can be frozen, so
this is a harness gap and not a format fact.)

**H4. One fixed adversary cannot supply the trigger (8 rows, 6,113 teams; 7 ROSTER-OK, 6,054).**
`lightningrod(3326, ROSTER-OK)` `innerfocus(1351, ROSTER-OK)` `scrappy(733, ROSTER-OK)`
`overcoat(507, ROSTER-OK)` `voltabsorb(110, ROSTER-OK)` `steadfast(59)` `heatproof(27, ROSTER-OK)`
`suctioncups(0, ROSTER-OK)`.
Feraligatr's format pool has no Electric move (Lightning Rod, Volt Absorb), no Fire move (Heatproof),
no powder move (Overcoat), no stat-dropping move (Scrappy: `charm/growl/stringshot`, none learnable),
no flinch move (Steadfast), no phazing move (Suction Cups) and no Intimidate (Inner Focus —
`trigger_cues_undetermined` says so in the row: *"the boost is gated on effect Intimidate, not on a
move — the ADVERSARY has to carry it"*).

**H5. The state the handler reads is never built (11 rows, 4,731 teams; 3 ROSTER-OK, 890).**
`unburden(3026)` `oblivious(749, ROSTER-OK)` `overgrow(697)` `owntempo(71, ROSTER-OK)`
`swarm(70, ROSTER-OK)` `gluttony(52)` `harvest(32)` `cudchew(21)` `cheekpouch(10)` `pickup(3)`
`ripen(0)`.
Three sub-shapes, all stated on the rows: an HP fraction that the safe rung's ×6 pool cannot cross
(Overgrow, Swarm); a berry that must be HELD, EATEN and re-read at real HP (Gluttony, Harvest, Cud
Chew, Cheek Pouch, Ripen, Pickup — their `then_what_needs` says *"the HP pool is the REAL one — ×1,
not the safe ×6 — or no fraction can be crossed"*); and a volatile already on the body (Oblivious
needs `attract`/`taunt`, Own Tempo needs `confusion`).

**H6. The subject never clicks the move the mechanic reads (8 rows, 11,023 teams; 2 ROSTER-OK, 10,139).**
`prankster(9313, ROSTER-OK)` `technician(826, ROSTER-OK)` `magician(388)` `unaware(385)`
`noguard(75)` `slushrush(28)` `lightmetal(6)` `longreach(2)`.

- **Prankster.** The actor's built moves are `GAUNTLET_ACTOR_MOVES = ['Facade','Endure','Rest',
  'Substitute']` and its click is `hit = clickOf(actor, ['Facade','Body Slam','Round','Protect'])` —
  **always Facade, a physical attack.** Prankster only shifts the priority of a STATUS move, and the
  subject never clicks one on a beat turn. Grimmsnarl (60) is slower than Feraligatr (78), so the
  shift would flip the order if it were ever clicked.
- **Technician.** Same click. Facade is 70 BP; Technician's band is ≤60.
- **Unaware, Magma Armor, Light Metal — one shared mechanism, `pickHit`.**
  `pickHit` (`:1712`) walks its preference list and returns the **first** move the receiver holds:

  ```js
  const phys = pickHit([].concat(want, ['Facade', 'Aqua Tail']));
  const spec = pickHit([].concat(want, ['Hydro Pump', 'Round']));
  ```

  `want` is the faces union, and `facesFor` puts `breakable`'s four moves first for **20 of the 67**.
  Feraligatr holds `lowkick` and `icebeam` of those four; Low Kick is at index 1. **So `phys` and
  `spec` both return Low Kick, the "one physical and one special" design collapses to one move, and
  every later move in the union is built onto the body and never clicked.** Verified by rebuilding
  `bodyOf`'s selection against `getMovePool`: Unaware's receiver is
  `[lowkick, icebeam, swordsdance, agility]` and Swords Dance is never thrown, so there is no stat
  stage for Unaware to ignore. Magma Armor's Ice Beam is likewise built and never thrown.
  Light Metal is a third variant: Low Kick IS the weight-reading move, but Metagross is 550 kg
  (5,500 hg) and `data/moves.ts:10452` gives 120 BP at `>= 2000`. Halved is 2,750 hg — **still 120
  BP**, so the mechanic cannot move a number on this carrier.
- **Magician.** `data/abilities.ts:2469` — `if (... || source.item || ...) return;`. **Magician cannot
  fire while the thief holds an item.** The `stealsItem` consequence stages `itemsOnBoth: 'Sitrus
  Berry'`, and `all_mechanics_fire.js:1896` and `:2093` give that item to the **receiver AND the
  actor**. On the safe rung (×6 HP) nothing crosses half, so the berry is never eaten and
  `source.item` is always set. *(Hypothesis, consistent with the artifact but not measured here —
  Pickpocket carries the same `thenWhat` and FIRED, most likely because its holder's berry was eaten
  on the real-pool rung. Command to settle it is in OWED.)*
- **Long Reach.** `engine/faces.js:130` declares `recvAbility: 'Rough Skin'` and, as under H1,
  **`facesFor` does not copy `recvAbility`.** Long Reach deletes `contact` from its own moves, and
  `contact` is only observable through a reactor. There is no reactor.
- **No Guard.** Writes accuracy; this arm forces every check to hit. Arguably belongs in D1 and did
  not get the clause.
- **Slush Rush — NOT SETTLED, and it is the one row I could not explain from the artifact.**
  The row carries `fixture_weather: "snowscape"`, `fixture_weather_repaired: true`, so snow was put
  up by the repair path. Beartic base 50 doubles to an in-battle 140 against Feraligatr's 98 at 0 SP
  / neutral / L50, so the order should flip and the authority's stream should part. It did not. Either
  my reading of the repair is wrong or something else is. Do not treat this as explained.

**H7. The clock outlives the fixture (5 rows, 3,205 teams; 5 ROSTER-OK, 3,205).**
`lightclay(2798)` `damprock(245)` `heatrock(99)` `icyrock(24)` `smoothrock(39)`.
Each owns no handler; its whole effect is a duration extended from 5 to 8 turns, and **the fixture
plays 7 turns**. The two arms cannot part before the shorter clock runs out. All five are already
green in the roster with a real `weather_turns` / `lightscreen` delta.

---

## 3. HOW BIG IS THE REAL JOB

- **Stageable with work: 54 rows / 38,238 team-appearances.**
- **Should be DECLARED rather than counted as a gap: 13 rows / 2,997 team-appearances.**
- **Already exercised elsewhere with a real board delta and engine agreement: 32 rows / 34,192.**
- **Neither covered nor declared: 26 rows / 5,707** — and of those 26, **23 have a census probe that
  names the entity in its own label**. The residue is **3 rows / 910 teams**.

The 26 not covered by the roster, largest first:

```
3026 unburden        roster=COULD-NOT-STAGE (THREW)      census probe names Unburden x4
 697 overgrow        roster=COULD-NOT-STAGE (THREW)      census tag damageBoost, entity NOT named
 388 magician        roster=FIRED [NAME-LEAF-ONLY]       census names Magician
 385 unaware         roster=FIRED [NAME-LEAF-ONLY]       census names Unaware
 238 telepathy       roster=CONTROL-NOT-QUIET            census names Telepathy
 176 synchronize     roster=FIRED [NAME-LEAF-ONLY]       census names Synchronize
 159 magmaarmor      roster=CONTROL-NOT-QUIET            census tag breakable, entity NOT named
 122 magicguard      roster=CONTROL-NOT-QUIET            census names Magic Guard
 108 screencleaner   roster=CONTROL-NOT-QUIET            census names Screen Cleaner
  75 noguard         roster=CONTROL-NOT-QUIET            census names No Guard
  59 steadfast       roster=CONTROL-NOT-QUIET            census names Steadfast
  54 healer          roster=COULD-NOT-STAGE (50% chance) census tag curesStatusResidual, NOT named
  52 gluttony        roster=CONTROL-NOT-QUIET            census names Gluttony
  49 symbiosis       roster=FIRED [NAME-LEAF-ONLY]       census names Symbiosis x2
  32 harvest         roster=COULD-NOT-STAGE (50% chance) census names Harvest x2
  28 slushrush       roster=CONTROL-NOT-QUIET            census tag speedCond
  21 cudchew         roster=CONTROL-NOT-QUIET            census names Cud Chew
  10 cheekpouch      roster=CONTROL-NOT-QUIET            census names Cheek Pouch
   7 poisonheal      roster=CONTROL-NOT-QUIET            census names Poison Heal
   6 lightmetal      roster=FIRED [NAME-LEAF-ONLY]       census names Light Metal
   4 quickfeet       roster=FIRED [NAME-LEAF-ONLY]       census tag speedCond
   3 hydration       roster=CONTROL-NOT-QUIET            census names Hydration
   3 pickup          roster=CONTROL-NOT-QUIET            census names Pickup
   3 receiver        roster=FIRED [NAME-LEAF-ONLY]       census names Receiver
   2 longreach       roster=FIRED [NAME-LEAF-ONLY]       census names Long Reach
   0 ripen           roster=COULD-NOT-STAGE              census names Ripen
```

**`[NAME-LEAF-ONLY]` is a caveat I had to build and it matters.** A roster `FIRED-AND-BOARDS-MATCH`
is not automatically coverage: `p2.party.<mon>.ability` is itself a compared board leaf, so an
ability staged under `rule: ability/generic` ("nothing matched above — this is the residue") produces
a delta consisting **entirely of the ability field having a different name in the two arms.** Eight
of the 67 are like that — magician, unaware, synchronize, symbiosis, lightmetal, quickfeet, receiver,
longreach. I counted them as NOT covered. Without that filter the coverage figure would read 40/67
instead of 32/67, and eight of those would be the ruler measuring itself.

---

## 4. WHAT IS ALREADY EXERCISED ELSEWHERE — the strength of each claim differs

Three instruments, three different strengths, and they are not interchangeable:

1. **`tests/test-mechanics.js` / the census.** All 67 have at least one LIVE probe on their own tag;
   0 hollow; 51 of 67 have a probe that names the entity in its own label, e.g. *"Unburden doubles
   Speed once the item is gone"*, *"the Unburden doubling does NOT survive a switch out and back"*,
   *"Pickpocket takes from the attacker, Magician from the target"*, *"Magic Guard pays nothing for
   sand, a burn, a seed or an Orb"*. **Weaker in kind than the other two: a census probe asserts what
   OUR engine does. It is not a differential and it does not consult the authority.**
2. **`tests/roster.js`.** 32 of 67 with a real staged board delta AND both engines matching. This is
   a differential claim, and it is the strong one. Its scenarios are deliberate — Prankster is staged
   as a slower Whimsicott clicking Noble Roar that only lands if the shift moved it first, and the
   delta is `dragapult.boosts.atk/spa`.
3. **The pinned pool.** Presence proxy only (substring over 13,214 frozen bo3 games, upper bound):
   prankster 7,550 games, hospitality 5,856, flowerveil 3,772, lightningrod 3,243, unburden 2,930,
   lightclay 2,621 — and **suctioncups 0**, which is the standing "the pool holds zero Malamar" fact.
   `data/game-differential.json`'s coverage block is per-TAG, not per-entity, so it cannot answer
   this question directly; it records `distinct_abilities: 175`, `distinct_items: 137`.

The interaction matrix was **not** used: `data/interaction-matrix.json` is dated 2026-08-11, and a
15-day-old artifact is not current state.

---

## 5. THE CHEAPEST FIXES, RANKED

Ranked twice, because the two scoreboards disagree and saying which one you mean is the rule.

**By usage that NOTHING currently measures — this is the one that matters:**

| # | fix | rows | teams |
|---|---|---|---|
| 1 | **The driver's `pass` for a slot that must act.** `p2 choice rejected p2 "pass, move 1": Can't pass: Your Milotic must make a move (or switch)`. 4 roster rows throw; 2 of them (`unburden`, `overgrow`) are also DID-NOT-FIRE here, so those two mechanics are measured by **no differential instrument at all**. `engine/game_differential.js` already documents this exact shape twice (`:2558` FORCED_FIRST_SLOT, `:3441` scripted-slot pass) and neither fallback covers the roster's `"pass, move 1"`. | 2 | **3,723** |
| 2 | `facesFor`'s whitelist at `engine/faces.js:161` — copy `allyIsTargeted` and `recvAbility`, and COUNT the no-op like `faces_status_noop` already does. Unblocks Long Reach outright and is a precondition for the ally family. | 3+ | ~250 |
| 3 | `pickHit` must not return the same move for `phys` and `spec`, and must not let `breakable`'s four moves shadow the tag that actually matters. | 3 | 550 |

**By usage on the mechanics-fire clause's own scoreboard (most of it already green elsewhere):**

| # | fix | rows | teams |
|---|---|---|---|
| 1 | **The subject clicks a STATUS move on one beat turn.** One appended turn. Prankster is 9,313 teams — **35.5% of every team in the corpus**, the largest single row in the excluded set — and Grimmsnarl is already slower than the receiver, so the bracket shift decides the order with no extra body. | 2 | 10,139 |
| 2 | **A live, targetable partner** — the ally stops clicking Protect and becomes a legal target on one turn. Unblocks the whole ally family and is a precondition for Hospitality. | 10 | 12,430 |
| 3 | **Three trailing turns after the clock is set** (plus an actual screen/weather click for the holder — `GAUNTLET_ACTOR_MOVES` contains no screen move). The 5 duration items. | 5 | 3,205 |

**Before starting any of them, say which scoreboard it should move.** Prankster, Hospitality, Flower
Veil, Lightning Rod, Light Clay and Technician are all already green in the roster with a real board
delta, so closing them here moves the mechanics clause and **should not be expected to move the
pinned pool or to change any correctness claim.** Unburden and Overgrow are the opposite: nothing
measures them today.

---

## 6. TWO THINGS FOUND ON THE WAY THAT ARE NOT ABOUT THE 67

**a) `MOVE_FACES` and `movesFacesFor` have no consumer.** `engine/faces.js:458` exports them;
`engine/all_mechanics_fire.js:1631` imports `{ FACES, facesFor, thenWhatFor }` only, and no other
file in the repository references either symbol (`git grep` finds them in CHANGELOG, ENGINE.md,
ROADMAP.md and two comments — never in code). CHANGELOG describes them as "13 entries covering 29 of
54" inert moves. The move arm derives its scenario from a tag-derived `su` object instead. **This may
be a deliberate supersession and it may be a dead table; the owner should say which, because right
now the file reads as if it is wired.**

**b) The 8 SHOWDOWN-ONLY rows.** `unnerve(2343)` `rockhead(1885)` `moldbreaker(338)` `pressure(223)`
`naturalcure(147)` `supremeoverlord(112)` `forewarn(4, deferred by Will 2026-08-10)` `superluck(19)`.
The authority's two arms parted and ours did not. Six of the eight carry `diverged: false`, so the ON
game's boards agreed and several are plausibly narration (Unnerve prints, Pressure is PP, Mold
Breaker prints nothing) — but **Rock Head at 1,885 teams with `mediTrace` identical across the A/B is
worth an engine look**, and seven of the eight carry `counts_against_the_gate: undefined`.

---

## OWED, NOT RUN

Nothing below was executed. Every one plays games or writes an artifact; both are forbidden to this
pass and the ENGINE agent holds the play layer.

```bash
# 0. Prerequisite for everything below.
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown

# 1. SETTLE SLUSH RUSH — the one row in the 67 this pass could not explain.
#    Expect the verbose stream to show whether the snow turn was actually played and whether the
#    subject moved first from turn 2. If it did move first and the streams still matched, that is a
#    finding about the instrument, not about the ability.
tools\lownode.cmd engine\all_mechanics_fire.js --only-ability slushrush --verbose

# 2. SETTLE THE MAGICIAN HYPOTHESIS — `source.item` blocks the steal, and the fixture fills that hand.
#    Control: Pickpocket carries the same `itemsOnBoth` staging and FIRED. Run both, compare.
tools\lownode.cmd engine\all_mechanics_fire.js --only-ability magician,pickpocket --verbose

# 3. THE CHEAPEST FIX, MEASURED. Two rows that no differential instrument covers today.
#    Reproduce the roster throw first, then re-run after the choice-construction fix.
tools\lownode.cmd tests\roster.js --stage abilities --only unburden,overgrow --verbose
node engine\game_differential.js --help   # confirm which flag reaches the scripted-slot pass path

# 4. RE-COUNT AFTER ANY FIXTURE CHANGE — the census steers this run, so a run taken either side of a
#    census regeneration is NOT a before/after. Pin all three.
tools\lownode.cmd engine\all_mechanics_fire.js --release <id> --team-store data/team-pool-frozen --write

# 5. THE 8 SHOWDOWN-ONLY ROWS — this is the set that is an accusation rather than a fixture limit.
tools\lownode.cmd engine\all_mechanics_fire.js --only-ability rockhead,unnerve,moldbreaker,pressure --verbose

# 6. ASK THE OWNER, DO NOT DELETE: is `MOVE_FACES` / `movesFacesFor` superseded by the `su` derivation,
#    or is it a table that was meant to be wired? It has zero code consumers today.
git log --oneline -- engine/faces.js | head -20
```

Also owed, and cheap: `noguard` should carry the `arm-constant-roll` clause it plainly qualifies for,
and `friendguard` / `telepathy` should carry the same `board-state` "needs a PARTNER that is actually
played" clause that `flowerveil`, `aromaveil`, `sweetveil` and `symbiosis` already carry. Both are
label bugs, not engine bugs, and both move rows out of `did_not_fire_unexplained` — which is the
bucket that reads as an engine gap.
