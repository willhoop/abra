# `punishesAttacker` carries two effect kinds that are not a toll — and neither card was a payload gap

ENGINE, 2026-09-01. Cards **E1** (Toxic Debris lays its hazard on the wrong side) and **E2** (Sand
Spit never sets its weather) from `docs/_reports/2026-08-29-empirical-divergence-cards.md`.

Prediction written to disk before any probe was written and before any engine byte moved:
`data/verification/2026-09-01-punishes-attacker-kinds-prediction.json`.

---

## THE VERDICT

**TWO fixes, not one.** The hypothesis in the brief — that `punishesAttacker`'s payload does not carry
enough effect KINDS — is **REFUTED**, and it was refuted by reading rather than by running.

| | | |
|---|---|---|
| `engine/tag_dex.js` | derives `hazard`, `maxLayers` **and** `setsWeather` | both present since the tag existed |
| `engine/medicham2-browser.js` | consumes `setsWeather` at one statement and `hazard` at the next | both wired |

The two defects are a **SIDE SELECTOR** and a **GUARD**, in two adjacent statements of the same block,
and a 2x2 over two revert knobs moves each arm under its own knob and neither arm under the other.

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 819 / 819 / 0 | **821 / 821 / 0**, 0 hollow, 0 threw, `run_ok:true` |
| empirical board-parted | 82 of 961 | **80** |
| empirical protocol-diverged | 172 of 961 | **171** |
| distinct divergence causes | 150 | **149** (2 removed, 1 added) |
| end-state verdicts | 905 / 53 / 2 / 0 / 1 | **907 / 52 / 1 / 0 / 1** |
| turn-1 boards identical | 956 | **957** |
| side-selection census | 102 sites, 83 undeclared | **103 sites, 82 undeclared** |
| engine release | `52e0e7effbd6` | **`cde6cb10daa7`** |

---

## THE MEMBERSHIP, DERIVED AND CARRIER-CHECKED BEFORE ANYTHING WAS WIRED

Thirteen `punishesAttacker` rows in `data/tags.json`, and **every single one has at least one legal
carrier** in `gen9championsvgc2026regmb` — not one member was ruled out for having none, which is not
what the last several passes found and is the reason the list is printed rather than summarised.

| row | corpus uses | legal carriers | `hazard` | `setsWeather` |
|---|---|---|---|---|
| `roughskin` | 12,029 | 2 (Sharpedo, Garchomp) | — | — |
| `cursedbody` | 3,291 | 6 | — | — |
| `toxicdebris` | **2,115** | **1 (Glimmora)** | **`toxicspikes`, cap 2** | — |
| `static` | 866 | 7 | — | — |
| `flamebody` | 432 | 3 | — | — |
| `cutecharm` | 130 | 4 | — | — |
| `poisonpoint` | 117 | 5 | — | — |
| `effectspore` | 37 | 1 (Vileplume) | — | — |
| `sandspit` | **34** | **1 (Sandaconda)** | — | **`sandstorm`** |
| `gooey` | 29 | 2 | — | — |
| `aftermath` | 0 | 1 (Garbodor) | — | — |
| `innardsout` | 0 | 1 (Victreebel-Mega) | — | — |
| `spicyspray` | 0 | 1 (Scovillain-Mega) | — | — |

**Exactly one member carries a hazard and exactly one carries a sky**, so neither probe can be
satisfied by a sibling and neither fix can be laundered as a family-wide change.

Neither `toxicdebris` nor `sandspit` is overridden in `data/mods/champions/` — the file has no such
key, checked rather than assumed, because the last batch's whole result turned on Champions replacing
a handler mainline leaves alone.

---

## E1 — THE SIDE, AND IT IS ONLY REACHABLE THROUGH AN ALLY

```
data/abilities.ts:5096
  const side = source.isAlly(target) ? source.side.foe : source.side;
```

In a two-side game **both branches name the same side: the one OPPOSITE THE HOLDER.** A foe's own side
IS the far side of the holder; an ally's foe side is too. This engine passed `m._sf` — the ATTACKER's
side field — which is the same answer for a foe and the wrong one for an ally.

So the defect could only ever be seen when a **partner** landed the physical hit, and every fixture in
this repository hit Glimmora from across the field. `tests/probe_punish_announce.js` (2026-08-23) says
in its own header *"The layer was laid, on the right side"* — true of the arm it staged, and the arm it
could not stage is where the bug lived.

The empirical cause, verbatim out of the class table and gone in the after-arm:

```
extra event emitted by medicham2 :: |-sidestart|p1:|toxicspikes <> |-sidestart|p2:|toxicspikes
```

**A previous pass saw this `isAlly` and correctly declined to derive from it.** `docs/ENGINE.md`'s
ally-only over-match section records `polarity` clearing Queenly Majesty, Dazzling, Armor Tail, Mummy
and Toxic Debris *"whose `isAlly` sits in a nested call the guard splitter does not bracket"*. That
judgement was about the TAG. Nothing was ever said about the CONSUMER, which is where the side is
actually chosen.

## E2 — THE SKY, AND THE GUARD WAS NOT THE AUTHORITY'S RULE

```
data/abilities.ts:3978   sandspit.onDamagingHit() { this.field.setWeather('sandstorm'); }   // no gate at all
sim/field.ts:45-52       if (this.weather === status.id) {
                           if (sourceEffect && sourceEffect.effectType === 'Ability') {
                             if (this.battle.gen > 5 || this.weatherState.duration === 0) return false;
```

gen 9 is > 5 and the source is an Ability, so **its own sky refuses and every other sky is
OVERWRITTEN.** This engine guarded on `!field.weather` and carried on in the old weather — and a
Sandaconda is brought INTO weather, so the broken branch is the common one.

It is also a **facts-are-global break and not merely a wrong guard**: `applyMoveWeather` (the move
road) and the `weatherSetter` entry block (the switch-in road) both ask `field.weather !== w`. This
third road asked something else, and no test that only ever set a sky from an empty field could tell
the three apart.

The empirical cause, verbatim, and gone in the after-arm — the card said *"we carry on in sun"* and
this is that sentence as a machine wrote it:

```
-weather: a different body :: |-weather|sandstorm|[from]sandspit <> |-weather|sunnyday|[upkeep]
```

**The primal skies are not represented, and that is derived rather than overlooked.** `SetWeather` is
refused by Desolate Land, Primordial Sea and Delta Stream, and none of the three has a legal carrier
in this regulation.

---

## THE 2x2 — TWO CAUSES, MEASURED APART

`MEDI_HAZARD_ON_ATTACKER_SIDE=1` restores the attacker's side field.
`MEDI_PUNISH_WEATHER_IF_CLEAR=1` restores the `!field.weather` guard.
Both are registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`, so a census cannot be written
under either.

**On the staged board** (`data/verification/2026-09-01-punishes-attacker-kinds-2x2.txt`), four corners
in four separate child processes so the module-level knob reads are genuinely re-evaluated:

| arm | hazard knob moves it | weather knob moves it |
|---|---|---|
| Toxic Debris, **ALLY** landed the hit | **yes / yes** | no / no |
| Toxic Debris, FOE landed the hit (over-fire control) | no / no | no / no |
| Toxic Debris cleared to Corrosion | no / no | no / no |
| Sand Spit from a CLEAR sky (over-fire control) | no / no | no / no |
| Sand Spit under **SUN** | no / no | **yes / yes** |
| Sand Spit under **RAIN** | no / no | **yes / yes** |
| Sand Spit under its OWN sandstorm, clock at 3 (over-fire control) | no / no | no / no |
| Sand Spit cleared to Shed Skin | no / no | no / no |
| **Rough Skin** — a `punishesAttacker` member that is already correct | no / no | no / no |
| Rough Skin cleared to Sand Veil | no / no | no / no |

`x / y` is "moves it with the other knob off / with the other knob on". **NO INTERACTION.**

**Against the official simulator**, `tests/probe_punish_side_and_sky.js`:

| corner | failing clauses |
|---|---|
| both knobs off (the fix) | **0 — ALL CLAUSES HELD** |
| `MEDI_HAZARD_ON_ATTACKER_SIDE=1` | 6, every one on the E1 ally arm |
| `MEDI_PUNISH_WEATHER_IF_CLEAR=1` | 6, every one on the E2 sun arm |
| both | 12 — exactly the union, no interaction term |

Each engine's own state is read at the same instant (`p1`/`p2` Toxic Spikes layers, the sky) and each
turn's protocol is compared as a sequence with nothing typed. The **authority** is asserted to move
across every ability knob first, so an unwired fixture fails before the engine can be judged.

---

## AN INSTRUMENT DEFECT FOUND ON THE WAY, AND IT IS NOT FIXED WHERE IT ALSO LIVES

The first run of the new probe reported an extra `|-damage|p1a|h/hy` line in the AUTHORITY's stream on
two arms. It is not an event. Showdown's `|split|` pairs write the secret half as `196/948` and the
shared half as a **percentage carrying a bar colour** — `20/100y` at or below half, `…r` at or below a
fifth. The normaliser this probe inherited from `tests/probe_punish_announce.js` has no place for that
letter, so the shared half did not normalise to the same string as the secret half, the `seen` dedupe
did not collapse the twin, and a duplicate line appeared in one stream and not the other.

Diagnosed by **dumping the raw protocol**, not by reasoning. The ancestor probe never drives a body
below half HP, so its fixtures cannot reach the letter.

`\|\d+\/\d+(\/\d+)?[yr]?( [a-z]+)?` is the corrected pattern here. **The same latent hole is still in
`tests/probe_punish_announce.js` and was deliberately not edited** — it can only ever produce a false
FAILURE, never a false pass, and changing a passing probe's comparator in a batch about something else
is how a green test starts asking nothing.

---

## WHICH SCOREBOARD, SAID BEFORE THE RUN

Written in the prediction file: Toxic Debris is 2,115 corpus uses but the ally-hit road needs a partner
clicking a physical spread move into its own Glimmora, so its pool reach is thin; Sand Spit is 34 uses
on one carrier. **The LAB had to move for both; the pool was predicted to move by at most the two games
the cards name.** It moved by exactly two board-parted games and one protocol game.

---

## THE SAMPLE, PROVEN IDENTICAL RATHER THAN ASSUMED

The delta is **knob-controlled on the same release**, not diffed against a published figure. The
before-arm is this tree with both `MEDI_*` knobs armed:

| | published (`accstage`) | BEFORE (knobs armed) | AFTER |
|---|---|---|---|
| games / cap / arm / mode | 961 / 12 / middle / `pins:ccb365985023` | identical | identical |
| protocol-diverged | 172 | **172** | **171** |
| board-parted | 82 | **82** | **80** |
| distinct causes | 150 | **150** | **149** |
| end-state | 905 / 53 / 2 / 0 / 1 | **905 / 53 / 2 / 0 / 1** | **907 / 52 / 1 / 0 / 1** |
| turn-1 boards identical | 956 | **956** | **957** |
| `closet.teams_dropped` | 43 | 43 | 43 |
| `order_probe` rows | 2 | 2 | 2 |
| team pool | `0d103fb9fa87` | `0d103fb9fa87` | `0d103fb9fa87` |

`first_divergences` (60 entries), the whole `classes` block and the whole `end_state` block are
**byte-identical strings** between the published artifact and the before-arm. The only fields that
differ at all are the **census pin** (published pinned 643 rows at `9446a684709d`; mine reads the live
821-row census at `30ae6887a535`) and the `coverage` block that reads it — which is the artifact's own
`the census CREDITED ONLY — it measures coverage and does not select` line **demonstrated** rather than
believed, and `state.turn1.cases[].engine_release` inside one worked example.

**A run with `--end-state` is not the same sample as one without.** The first pair of runs in this pass
omitted it, read 174 → 173, and are **withheld** rather than reported as a delta: the flag changes when
a game stops, so coverage credit accumulates differently and later clicks differ. The instrument says
so in its own comment and it is right. Both published arms use `--end-state`.

---

## THE PREDICTIONS

| | predicted | measured | |
|---|---|---|---|
| P1 | one cause or two -> **TWO**, and the payload hypothesis is refuted | two, independent under a 2x2 | **hit** |
| P2 | each knob moves only its own arms under both settings of the other | no interaction, staged board and authority | **hit** |
| P3 | census 819 -> **821**, band 820-821, 0 hollow, 0 threw | 821 / 821 / 0, 0 hollow, 0 threw | **hit, point estimate** |
| P4 | board-parted 82 -> **80**, band 80-82 | 80 | **hit, point estimate** |
| P5 | protocol 172 -> **170**, band 170-172 | 171 | **miss by 1, in band** |
| P6 | causes 150 -> **148**, band 146-150 | 149 | **miss by 1, in band** |
| P7 | end-state **unchanged** at 905/53/2/0/1 | 907/52/1/0/1 | **miss, in the improving direction** |
| P8 | both census probes RED first, GREEN after; each knob reddens only its own | exactly that | **hit** |
| P9 | Rough Skin and the FOE-hit arm identical at all four corners | identical | **hit** |
| P10 | the site IS one of the 102 and IS undeclared; `undeclared` must not rise above 83 | it was; 83 -> 82 | **hit** |
| P11 | lab moves for both; pool moves by at most the two games the cards name | 2 board games, 1 protocol game | **hit** |

**Eight hits, three misses, and all three misses are one step apart from the estimate and none in the
wrong direction.** P5 and P6 miss for the same single reason, stated below.

### WHY P5 AND P6 MISSED, AND IT IS THE SHAPE THIS REPOSITORY KEEPS SEEING

Two causes were removed and **one was added**:

```
REMOVED  extra event emitted by medicham2 :: |-sidestart|p1:|toxicspikes <> |-sidestart|p2:|toxicspikes
REMOVED  -weather: a different body      :: |-weather|sandstorm|[from]sandspit <> |-weather|sunnyday|[upkeep]
ADDED    extra event emitted by medicham2 :: |-status|p1a|tox <> |-damage|p1a|H/H|[from]stealthrock
```

The added row is **the same game running further**. Its board no longer parts — board-parted fell by
the full 2 — but its protocol still parts, later, on a different line. So protocol fell by 1 where I
predicted 2, and causes fell by 1 where I predicted 2. Every removed cause names one of the two
mechanisms this pass fixed, and nothing else in the class table moved by a single game.

---

## THE SIDE-SELECTION CENSUS

**The site WAS one of the 102 and it was UNDECLARED** — `engine/side_selection_census.js` matched
`m._sf.side==='A'?'p1':'p2'` at the hazard call as a `p1:p2` label pair, and no row in
`data/side-selection-declarations.json` said what it answered. That is the honest answer to the brief's
question: the census could see the site, and nobody had classified it, so nothing was ever going to
call it wrong.

After the fix the site is two expressions (the far-side pick and the protocol label). Both are declared:

| key | question | verdict |
|---|---|---|
| `fn:_damagingHit \| sfB:sfA \| dba899f4` | SIDE | CORRECT — the authority's own ternary, both branches |
| `fn:_damagingHit \| p1:p2 \| a034cd87` | READER | CORRECT — the LABEL for the side the line above chose |

103 sites, **undeclared 83 -> 82**.

### RED AT HEAD, AND NOT CAUSED BY THIS PASS

`side_selection_census.js` reads `ROSE` and did so **before this work started**: undeclared 83 against
a floor of 81 stamped on 2026-08-29. It still reads `ROSE` at 82 against 81. I lowered the quantity by
one and left the verdict where I found it.

**I raised that floor by accident and put it back.** Running `--write` mid-pass stamped the artifact at
84 and so moved the ratchet from 81 to 84 — the floor is simply the previous artifact's value, not a
running minimum. `git checkout -- data/side-selection-census.json` restored it. The artifact is
unmodified in the working tree and the floor is 81. Recorded because a silently weakened ratchet is
worse than the thing it guards.

---

## OWED, NOT RUN

- **`data/side-selection-census.json` is not restamped.** Doing so would raise the ratchet floor from
  81 to 82 and weaken a gate that is already red for somebody else's reason. Whoever closes the
  remaining 82 should restamp it then; it is not this pass's to move.
- **`tests/probe_punish_announce.js` still carries the HP-bar-colour hole** in its normaliser. Latent —
  its fixtures never drive a body below half — and false-failure-only. Not edited here.
- **The `-status`/`stealthrock` cause the E1 game now parts on is NOT diagnosed.** It is the same game
  running further and it is a different mechanism; it is in `data/verification/divergence-turns.punishkinds.json`.
- **`tests/test-engine-diff.js`, the interaction matrix and the deliberate roster were NOT re-run.**
  No tag was added or changed — `hazard`, `maxLayers` and `setsWeather` were already derived — so
  `data/tags.json` is untouched and neither instrument reads anything this pass moved. Declared rather
  than assumed.
- **The two non-`--end-state` differential runs (174 -> 173) are withheld**, not published, for the
  reason in the sample section.

---

## ARTIFACTS

| | |
|---|---|
| prediction, written first | `data/verification/2026-09-01-punishes-attacker-kinds-prediction.json` |
| 2x2 on the staged board | `data/verification/2026-09-01-punishes-attacker-kinds-2x2.txt` |
| differential, AFTER | `data/verification/game-differential.punishkinds.json` |
| differential, BEFORE (knobs armed) | `data/verification/game-differential.punishkinds-before.json` |
| readable dumps | `data/verification/divergence-turns.punishkinds{,-before}.json` |
| new probe | `tests/probe_punish_side_and_sky.js` |
| census rows | `tests/test-mechanics.js`, two `probe('ability','punishesAttacker',…)` |

`data/game-differential.json` and `data/divergence-turns.json` were **not touched** — mtimes still
2026-08-28 23:14 and 2026-08-31 23:22.
