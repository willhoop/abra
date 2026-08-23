# ROADMAP #241 — the 33 `event missing from medicham2`, grouped, ranked, and the largest one landed

ENGINE, 2026-08-23. Historical record. Not maintained, not current state, superseded by the register
rows it feeds.

---

## VERDICT IN ONE PARAGRAPH

The class is **seventeen mechanisms, not 33 findings**. The largest is **Hunger Switch's rename
surviving the switch-out** — nine of the 34 causes, one per game, every one of them a `|switch|` line
this engine simply never emitted because a benched body named `morpeko-hangry` is a body nothing can
ask for by its species. It is landed as WIRE 142. Paired, one-file-different measurement on the frozen
pool and the pinned census: **`event missing from medicham2` 42 games -> 33, whole-game diverged
95 of 961 -> 86, usable rate 9.7% -> 8.76%, and the cause-level diff is nine gone / zero new /
zero changed.** The pool CAN see the next five mechanisms too — checked before investing, because the
previous pass moved the rate not at all.

---

## 1. THE GROUPING, DONE BEFORE ANYTHING WAS TOUCHED

`data/game-differential.json`, release `c66976713feb`, class `event missing from medicham2`:
**42 games, 34 distinct causes.** The class name describes the COMPARATOR — "showdown's head line does
not reappear on our side within the lookahead, ours does on theirs" — so it says nothing at all about
why. Grouped by mechanism:

| # | mechanism | causes | games | corpus behind it |
|---|---|---|---|---|
| 1 | **Hunger Switch's rename survives the switch-out** | **9** | **9** | Morpeko 0.48% of teams (176 / 36,696) |
| 2 | Supreme Overlord's `-end \|fallenN\|[silent]` as the body leaves | 5 | 5 | Kingambit **23.4%** of teams |
| 3 | a drain `-heal` we do not write | 2 | 5 | first seen on Sinistcha 17.3% (Matcha Gotcha, a SPREAD drain) |
| 4 | the `-weather ... [upkeep]` line stops before the authority's does | 2 | 5 | Rain Dance 1,321 clicks; Pelipper 11.4% |
| 5 | a zero-stage `-boost\|atk\|0` / `-unboost\|atk\|0` announcement | 4 | 4 | mixed (Roar 666, Snowscape 21, Rain Dance 1,321) |
| 6 | `-fail\|psn` after Hurricane | 1 | 1 | Hurricane 5,603 |
| 7 | `-fail` before Night Slash | 1 | 1 | 249 |
| 8 | `-fail` before Role Play | 1 | 1 | 40 |
| 9 | `-fail` before Curse | 1 | 1 | 203 |
| 10 | Toxic Debris `-activate` before its `-sidestart` | 1 | 2 | ability 1,918 |
| 11 | Symbiosis `-activate` | 1 | 1 | 69 carriers / Life Orb 21,257 |
| 12 | Sand Spit `-weather ... [from]sandspit` | 1 | 1 | — |
| 13 | Forecast `-formechange\|castformrainy` | 1 | 2 | Castform 0.08% |
| 14 | Syrup Bomb `-end` | 1 | 1 | 3 |
| 15 | Regenerator `-heal` **on the AUTHORITY's side** | 1 | 1 | 1,855 |
| 16 | Protean `-start\|typechange` before a Protect | 1 | 1 | Protect 134,710 |
| 17 | `-immune` against our `cant\|flinch` | 1 | 1 | — |

34 causes and 42 games, both reconciled. **Fourteen** if the four `-fail` rows are read as one family;
they are four different mechanisms and are counted apart.

### The two ranking traps, and one of them bit

`docs/_reports/2026-08-22-wire-queue.md` warns that `max_uses` is the max over BOTH lines of a pair
and that a species carrying `uses: null` prints as 0. Both apply here and neither was used to rank:

- Every Morpeko cause carries `max_uses: null`, so a usage-ordered head puts the **largest mechanism in
  the class at the BOTTOM of the list.** The 2026-08-22 wire queue says exactly this happened to it
  ("all ten Morpeko rows and all six `fallen` rows rank at the BOTTOM").
- Rows 11 and 16 carry `max_uses` 21,257 and 134,710 — Life Orb and Protect — which are the OTHER line
  of the pair, i.e. **the line WE emitted.** Ranking on them would have sent this pass at Protect.

So the ranking below is on **(a) how many of the 34 the mechanism explains** and **(b) the corpus usage
of the entity the mechanism is ABOUT, read out of `data/meta-usage.json` by hand**.

## 2. THE RANK, AND THE POOL CHECK THAT PRECEDED THE INVESTMENT

The brief's warning is the live one: the four fixes before this moved the whole-game rate not at all,
because `data/team-pool-frozen` holds zero Malamar and the self-destruct family is 0.45% of its games.
**Every mechanism in the table above is a cause the frozen pool ALREADY PRODUCED**, which is a
structurally different situation: these are not mechanisms the pool might contain, they are mechanisms
the pool has already been observed to reach. The pool-blindness risk does not apply to any row here.

Top three by cost:

1. **Hunger Switch (9 causes).** Small in the corpus (0.48% of teams) and largest in the class, because
   the census STEERS the sample toward rows nothing has exercised. It is also the only one of the three
   that is a **state** defect rather than a narration defect — the body is genuinely unreachable, not
   merely un-announced.
2. **Supreme Overlord (5 causes, Kingambit at 23.4% — the most-used species in the format).** Narration
   only, on present evidence.
3. **drain `-heal` (5 games) and the `-weather [upkeep]` line (5 games), tied.** The weather one is a
   DURATION question rather than a missing emission — we emit `-weather ... [upkeep]` elsewhere, so the
   authority is still raining when we have stopped.

## 3. WHAT WAS LANDED — WIRE 142

### The probe, shown RED first, with its ids kept

`tests/test-switch-back-renamed.js` already existed (built 2026-08-22 by the ROADMAP #204/#328 pass) and
already carried this as a DECLARED KNOWN-OPEN arm. Before:

```
KNOWN-OPEN hungerswitch              ask: {sw:morpeko}
   after the ask — ours [espathra,dragonite]  authority [morpekohangry,dragonite]  control returned: true
   while away    — bench ours [morpeko-hangry,dragonite]  authority [morpeko,dragonite]
   RED  medicham2 did not bring the subject back
   RED  the bench body kept its flipped name: ours morpeko-hangry, the authority morpeko
KNOWN-OPEN hungerswitch-restamped    ask: {sw:morpeko}
   RED  the bench body kept its flipped name: ours morpeko-hangry, the authority morpeko
KNOWN-OPEN mega-base-key             ask: {sw:abomasnow}     (NOT mine — the instrument)
AGREES     mega-forme-key            ask: {sw:abomasnowmega} (the over-fire control)
   1 of 4 arms agree; 3 DECLARED KNOWN-OPEN
```

After:

```
AGREES     hungerswitch              while away — bench ours [morpeko,dragonite]  authority [morpeko,dragonite]
AGREES     hungerswitch-restamped    while away — bench ours [morpeko,dragonite]  authority [morpeko,dragonite]
KNOWN-OPEN mega-base-key             unchanged
AGREES     mega-forme-key            unchanged
   3 of 4 arms agree; 1 DECLARED KNOWN-OPEN
```

The declarations are matched pairwise and exhaustively against the measured text, so an arm that fixes
one of its two red lines goes HARD RED rather than quietly staying declared. Both arms went green
outright — **no arm was relabelled to make it pass.**

### The derivation

```
data/abilities.ts:1888   onResidual(pokemon) { ... pokemon.formeChange(targetForme); }   // no isPermanent
sim/pokemon.ts:1435      formeChange(speciesId, source, isPermanent?, ...) { ... if (isPermanent) this.baseSpecies = rawSpecies; ... }
sim/pokemon.ts:1564      clearVolatile(...) { ... this.setSpecies(this.baseSpecies); }
```

`hungerswitch` is **not** overridden in `data/mods/champions/` (the eight files there are abilities,
conditions, formats-data, items, learnsets, moves, rulesets, scripts; the ability is absent from the
abilities override), so mainline governs it. Hunger Switch passes no `isPermanent`, `baseSpecies` never
moves, and the body reverts on the way out. **A mega, Disguise's busted forme and Zero to Hero all pass
`isPermanent: true` and are therefore NOT reverted by the authority either.**

### The wire

`engine/medicham2-browser.js`, two edits and a counter pair.

- At the `formeCycleResidual` flip: stamp `_formeTempBase` / `_formeTempBaseName` / `_formeTempHow`
  **once**, with the name as it stands before the FIRST flip. Stamping on every flip would record
  `morpeko-hangry` as the base on the return leg and revert to the wrong half of the pair from turn 2
  onward — the same mistake WIRE 141's own header warns about for the flip itself.
- In `switchOut`, **immediately above the type restore**: if the body carries a temporary stamp and its
  name has moved, put it back (rename, or `formeSwap` for a member that needed a row).

Three decisions and why each is not taste:

- **The order is load-bearing.** `setSpecies` IS `this.setType(species.types, true)`, so the authority
  reverts the species and reads the chart off the reverted row in ONE call; the existing type-restore
  block reads `monRow(out.name)`. Below it, a member whose two formes differ in TYPE would get the old
  forme's chart. Inert for Morpeko (Electric/Dark on both halves) and the general case has to be right.
- **It emits nothing.** `clearVolatile` calls `setSpecies` directly; only `formeChange` reaches
  `battle.add('-formechange', ...)`. A `TR.formechange` here would have traded nine `event missing`
  causes for some number of `extra event emitted by medicham2` ones. Measured: `extra event` reads 5
  before and 5 after.
- **Permanent formes are excluded by WHO STAMPS, not by a name list here.** Only the
  `formeCycleResidual` block writes `_formeTempBase`. Zero to Hero's permanent swap runs a few blocks
  ABOVE this one in the same function, so an over-matching revert would have undone it in the function
  that performed it.

### The counters, and the instrument trap that hid them

`MEDSEEN.formeTempStamped` and `MEDSEEN.formeTempReverted`, counted APART: a stamp with no revert says
the flip happened and the body never left, which is a different reading from "the flip never happened".
On the staged board they read **1 and 1** (`formeCycled 1` beside them).

**Reading them from outside the driver returns 0 and looks exactly like a dead wire.** `SB.harness()`
deletes medicham2 from the require cache and `game_differential` loads it through `REL.require`, so
`require('./engine/medicham2-browser.js')` afterwards is a DIFFERENT object whose counters never move —
this is the same trap `docs/_reports/2026-08-22-formes.md` §5 records, met again. The values above were
read by walking `require.cache` for the key ending `5e0853311131\engine\medicham2-browser.js`.

## 4. THE MEASUREMENT — PAIRED, ONE FILE DIFFERENT

Release cut before measuring. `data/releases/c66976713feb/release.json` against
`data/releases/5e0853311131/release.json`, all 26 frozen files compared:

```
DIFFERS engine/medicham2-browser.js  c1a3ee451268 -> 156be771a4f8
files 26 26        (no other file moved, none added, none removed)
```

Both arms:

```
tools\lownode.cmd engine\game_differential.js --games 1200 --write
    --release <id> --census data\gate-census.pin.json --team-store data\team-pool-frozen
```

| | BEFORE `c66976713feb` | AFTER `5e0853311131` |
|---|---|---|
| games | 961 | 961 |
| census pin digest | `80e648f34d56` | `80e648f34d56` |
| team pool digest / picked | `0d103fb9fa87` / 1,968 | `0d103fb9fa87` / 1,968 |
| turns cap / mode | 12 / `A/middle/pins:1fd77b835ee2/credit:observed-effect/v1/nature:real` | identical |
| **diverged (raw)** | **95** | **86** |
| usable games / diverged among usable | 959 / 93 | 959 / 84 |
| **rate over usable** | **9.7%** | **8.76%** |
| threw / void | 0 / 2 | 0 / 2 |

Class table:

```
42 -> 33   event missing from medicham2      <- the target
 5 ->  5   extra event emitted by medicham2
23 -> 23   ordering
13 -> 13   unrelated event mismatch
 6 ->  6   -boost field 3
 3 ->  3   -damage field 3
 1 ->  1   -damage: a different body
 1 ->  1   -status: a different body
 1 ->  1   -unboost field 3
```

Cause-level diff over the WHOLE artifact, not just the target class:

```
GONE:  9 causes, all of the shape  |switch|pXY|morpeko,l50|H/H <> <something else>
NEW:   none
CHANGED n:  none
morpeko causes remaining anywhere in the artifact: 0
```

That is the attribution. Nine causes removed, nothing anywhere else moved by one game.

**The sample is provably identical** — same release except the one file, same census bytes, same pool
digest, same picked count, same requested game count, same arm, same mode string. This is what the
brief asked for before movement may be reported, and it is why 95 -> 86 is a result rather than a
sample difference.

## 5. WHAT ELSE MOVED, AND WHAT DID NOT

| | before | after |
|---|---|---|
| `tests/test-mechanics.js` census | 630 live / 0 missing / 0 threw / 0 hollow | **identical, and 0 rows flipped state** |
| `tests/test-switch-back-renamed.js` | 1 of 4 AGREE, 3 KNOWN-OPEN | **3 of 4 AGREE, 1 KNOWN-OPEN** |
| `tests/test-forme-assert.js` | 5 of 6 AGREE, `forecast` KNOWN-OPEN | identical (it reads the body ON the field) |
| `tests/staged_board.js` | 22 of 25 board-identical *(not re-measured by me — this is `tests/run-all.js`'s standing note)* | **22 of 25** — `hungerswitch-flips-every-turn` still SHORT |
| `tests/test-docs-current.js` | not measured before | 22 passed / 0 failed |

**`staged_board.js`'s hungerswitch scenario is NOT closed by this, and that is the right answer.**
`tests/run-all.js` attributes it, `imposter-copies-the-body-opposite` and
`roar-drags-whoever-is-standing-there` to "a species-NAME-keyed Showdown mirror in
`engine/game_differential.js`" — the C2/C3 shape, in the instrument. This wire is the ENGINE half; the
scenario needs the instrument half.

**Cutting the release is what returned the roster and whole-game clauses in `engine/status.js` to
WITHHELD.** `data/engine-release.json` is now `5e0853311131` while `data/roster.*.json` and
`data/game-differential.json` describe `c66976713feb`. That is the photograph rule working, not a new
defect, and it is stated rather than left to be discovered.

## 6. WHAT WAS DELIBERATELY NOT DONE

- **`data/game-differential.json` was NOT overwritten.** The after-run went to a scratch path
  (`--out`), because two other agents were live and CLAUDE.md's torn-read rule is explicit that reading
  a half-written artifact yields a plausible, well-formed, fictitious answer. The published artifact
  still describes `c66976713feb` and `status.js` correctly says so. Republishing is one command and
  belongs to whoever owns the settled tree.
- **`engine/game_differential.js` was NOT edited**, though it holds C2 and C3. It is not in the
  release's `SOURCES`, so it is read LIVE by every run — moving it between the two arms would have
  destroyed the pairing that makes "nine gone, zero new" attributable at all. Both remain open and are
  named in `docs/ENGINE.md`'s hand list as not-mine.
- **No fit, no self-play, no `board.js` / `magnemite.js` / `engine-data.js` edit.** No
  `docs/ROADMAP.md`, `engine/docs_scan.js`, `tests/test-docs-current.js` or
  `engine/register_reality.js` touched. No commit, no push.

## 7. THE NEXT FIVE, WITH WHAT IS ALREADY KNOWN ABOUT EACH

Ranked as they now stand in the 25 remaining causes / 33 remaining games:

1. **Supreme Overlord — 5 causes.** `|-end|pXb: Kingambit|fallenundefined|[silent]` as the body leaves.
   **`undefined` is the AUTHORITY'S OWN TEXT** — the condition's `onEnd` interpolates
   `effectState.fallen`, which is gone by then — not a normaliser artefact. Anyone "fixing" it to a
   number will produce a new divergence. `[silent]` is in the protocol log; only the CLIENT hides it.
2. **drain `-heal` — 2 causes, 5 games.** First divergence is Sinistcha's Matcha Gotcha, a SPREAD drain
   move, and both causes name a spread board. Check the spread path before concluding drain is absent.
3. **`-weather ... [upkeep]` — 2 causes, 5 games (4 rain, 1 sand).** We DO emit this event elsewhere, so
   it is a duration question: the authority is still raining when we have stopped. Damp Rock / Smooth
   Rock and the weather-setter leaving the field are the two obvious places to look.
4. **zero-stage `-boost|atk|0` / `-unboost|atk|0` — 4 causes.** The authority announces a boost of zero
   stages and we say nothing. Probably not one mechanism: one sits before a Roar, two before a weather
   upkeep, one against our own `-boost|spe|1`.
5. **four unrelated `-fail` lines — 4 causes.** After `psn` (Hurricane), before Night Slash, before Role
   Play, before Curse. Four mechanisms, one shape, ranked last on purpose.

**One suspicious row worth a second pair of eyes.** Cause 15 is
`|-heal|p1a|H/H|[from]regenerator <> |switch|p1a|aurorus,l50|H/H` — the AUTHORITY emitting a Regenerator
`-heal`. ROADMAP #223 closed the mirror image of this on the derivation that `Pokemon#heal` adds nothing
to the log and the ability never calls `Battle#heal`. Both cannot be right as stated. It is one cause
and one game; it is flagged, not chased, and it is not evidence that #223 was wrong.
