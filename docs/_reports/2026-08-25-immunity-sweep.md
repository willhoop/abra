# The immunity sweep — 1,800 cells, 21 wrong, all 21 fixed

2026-08-25. ENGINE. Full account; the verdict is in the session report.

Will asked for this directly: *"make sure all the immunities, like fire types cant be burned are in
there"*, *"grass types are immune to powder moves"*, *"no poison into steel"*, *"unless corrosive"*,
and then *"does stun spore work on a ground type?"*.

---

## 1. What the sweep is, and why it is not a list

`engine/immunity_sweep.js`. Every axis is read out of `Dex.forFormat('gen9championsvgc2026regmb')`
on the run. A checker written as a list of pairs somebody typed cannot catch a pair nobody thought
of, and this repository has paid for that shape three times over (the ban list of four, the fourteen
stale handoffs, and the hand-maintained `STATUS_IMMUNE_TYPE` table this file is aimed at).

| axis | derived from |
|---|---|
| the immunity CLASSES themselves | `TypeInfo.damageTaken[k] === 3` — that one line IS `Dex#getImmunity`, so the set of things a type can be immune to is the set of keys some type scores 3 on. 18 classes today: the 18 types plus `brn frz hail par powder prankster psn sandstorm tox trapped` |
| status-inflicting moves | `move.status`, plus 100%-chance secondaries for population K |
| powder moves | `move.flags.powder` |
| trapping moves | a scan of the RAW handler source for `addVolatile('trapped')` — the rule lives in code, not in a field |
| weather moves | `move.weather` |
| the one Status move the type chart judges | the RAW data's `ignoreImmunity: false`. The Move object's `ignoreImmunity` is a GETTER defaulting to `category === 'Status'`, so asking it answers `true` for every status move that never declared anything |
| abilities | the AUTHORITY's own handler set (`onSetStatus`, `onAllySetStatus`, `onImmunity`, `onTryHit`), never a name and **never `data/tags.json`** — see §5 |
| bodies | a filtered walk of the format, one per type, mono-type preferred and PRINTED with which |

Both engines play the SAME staged turn with the SAME species and the SAME ability, and Showdown is
the expectation. Nothing types an answer. The observable is a state digest of the target
(`status`, `types`, `boosts`, `tookDamage`, `stillActive`), never a protocol line.

**HP is compared as a BOOLEAN.** The two engines do not share a damage roll here, so a magnitude
difference would read as an immunity defect. `tests/test-engine-diff.js` owns magnitude.

**The accuracy die is removed from both engines identically** — Showdown's `hitStepAccuracy` is
replaced with "true for every target" (it removes only the roll and leaves invulnerability, the type
chart and `TryImmunity` where they are); medicham2 runs on `rng = () => 0.5`, which lands every
printed accuracy at or above 50, i.e. every status move this format has. The one population that
WANTS the die (Toxic from a Poison type) turns the override off and says so.

### The eleven populations

| | what it sweeps | cells |
|---|---|---|
| A | every primary-status move × every type | 198 |
| B | every targeted powder move × every type | 108 |
| C | every ability with a status-family handler × every status and powder move | 442 |
| D | the bypass ability (Corrosion) on the ATTACKER × every status move × every type | 198 |
| E | Toxic from a Poison type — the never-miss branch and the semi-invulnerable branch | 4 |
| F | Rage Powder's redirect and who may ignore it | 4 |
| G | the trap family — laid, then the victim asks to leave | 54 |
| H | sandstorm chip × every type | 18 |
| I | a Prankster status move × every type | 198 |
| J | the attacking type chart — one plain attack of each type × every type | 324 |
| K | **Will's board, derived** — every deliverer of one status at one body (see §4) | 252 |
| | **total** | **1,800** |

### Reasons-per-cell, which is the whole point

A fixture immune for the WRONG reason proves nothing. Two census probes were GREEN on the live
Thunder Wave defect because both aimed it at a body immune for an unrelated reason. So every row
carries `reasons` — the list of independent authority-side refusals that apply, computed from the
derivation:

- **reasons 0** the move must land. A refusal is a FALSE immunity.
- **reasons 1** a SINGLE-REASON cell. The only kind a census probe may be built on.
- **reasons 2+** over-determined; agreement is evidence about neither.

Measured: **0 cells anywhere in the sweep have 2+ reasons.** Every one of the 21 defects landed in a
reasons-1 or reasons-0 cell, so each is attributable to exactly one mechanism.

### The separation check

Five control groups declare a `sep` and the AUTHORITY must answer them differently, or the fixture is
broken and an AGREE in that group is worth nothing. All five separate today. **Two of them did not,
on the first run, and that is what caught a broken fixture of mine** — see §6.

---

## 2. The result

Identical 1,800-cell population, the only difference being three `MEDI_*` knobs:

| | DIFFER | NOT-STAGED (declared) |
|---|---|---|
| all three knobs ARMED (the engine as it stood this morning) | **21** | 3 |
| knobs off (today) | **0** | 3 |

The 3 NOT-STAGED are Spirit Shackle into Pikachu, Alakazam and Banette: a damaging trap move that
KILLS those three, and a body that died did not "fail to leave". Declared and counted, never passed.
The Ghost trap immunity is still measured — by Block and Mean Look, in the same population.

---

## 3. The three defects, each red-then-green with a knob and a control

### (1) Magic Bounce was computed and thrown away on THREE of its four roads — 12 cells

`MEDI_BOUNCE_UNDONE_BY_REAIM=1`.

`bounceOff` ran BEFORE `reaimToSlot` in the `kind === 'status'` branch. `reaimToSlot` then looks the
bounced body up **by the action's own foe SLOT** and hands back the original target, so the
reflection was discarded. The `trapmove` branch was fixed for exactly this on 2026-08-24 and its own
comment describes the inversion in full; **the other roads were never swept.** So Magic Bounce
reflected a Block and reflected nothing else.

Eleven moves resolve through `kind === 'status'`: Thunder Wave, Toxic, Will-O-Wisp, Spore, Sleep
Powder, Stun Spore, Poison Powder, Glare, Hypnosis, Sing, plus Leech Seed's drain. A twelfth,
Magic Powder, resolves through `kind === 'typechange'`, which **never asked `bounceOff` at all** —
so a Magic Bounce body had its own type rewritten where the authority rewrites the clicker's.

**And a bounced Leech Seed belongs to the BOUNCER.** Making the bounce work exposed a second bug
underneath it, the same shape as 2026-08-24's bounced trap: the seed's beneficiary was written as the
body that CLICKED, which after a reflection is the victim — so it drained itself and healed itself
and the move netted to nothing. `useMove(newMove, target, {target: source})` (`data/abilities.ts:2436`)
makes the reflected move's USER the reflector. Measured on the staged board over three turns:

```
AUTHORITY  p1a 114/180   p2a 140/140      (the clicker is drained, the Espeon is full)
BEFORE     p1a 180/180   p2a 142/142      (nobody moves at all)
AFTER      p1a 114/180   p2a 142/142
```

Counters `MEDSEEN.statusBouncedBackAtUser`, `MEDSEEN.bouncedSeedOwnedByBouncer`.

**Probes.** `ability/reflectsStatusMoves` — *"Magic Bounce sends a STATUS MOVE back, and the paralysis
lands on the clicker"*, and *"a bounced Leech Seed drains to the BOUNCER, not to the body that clicked
it"*.

**The single-reason control, and the fixture this caught of mine.** The first draft used a **Raichu**
as the clicker. Raichu is Electric and cannot be paralysed at all, so the bounce arm read "nobody is
paralysed" — which is also what a broken bounce reads. It is now a **Kangaskhan** (Normal, no
immunity of any kind), and the control arm is the identical board with the ability blanked, where the
Espeon must take the paralysis. Both arms must show SOMEBODY affected.

### (2) An absorbing ability never refused a STATUS move — 7 cells

`MEDI_STATUS_ABSORB_BLIND=1`.

`absorbedBy` had exactly two callers, `dmgRange` and the ATTACK branch, so the whole `typeImmunity`
family only ever answered a move that dealt damage. The authority's handlers do not care —
`onTryHit(target, source, move) { if (target !== source && move.type === 'Grass') ... }` runs at
`hitStepTryHitEvent` for every move in the step list, status included.

| ability | move | authority |
|---|---|---|
| Sap Sipper | Spore, Sleep Powder, Stun Spore, Cotton Spore | refuses, **+1 Atk** |
| Volt Absorb | Thunder Wave | refuses |
| Motor Drive | Thunder Wave | refuses, **+1 Spe** |
| Lightning Rod | Thunder Wave | refuses, **+1 SpA** |
| Flash Fire | Will-O-Wisp | refuses |

medicham2 slept, paralysed and burned every one of them.

**Fixed at ONE reader, not seven.** `absorbRefusal()` sits beside the other `onTryHit` gate and is
called from `tryHitRefusal` — so the twenty-one branches that already call that pair inherit it
rather than growing a twenty-second copy of the rule. The `status` and `affect` branches keep their
own inline gate chains, so they ask the shared reader directly. The GIFT (heal / boosts) was hoisted
out of the attack branch into `absorbGift()` so the two roads cannot come to disagree about what Volt
Absorb is worth; the attack branch now calls it.

**THE CATEGORY GUARD WAS WRONG FIRST, IN THE DIRECTION THAT DOES NOTHING.** The first version read
`MC.moves[id].c === 'S'` to mean "special attack — the attack branch owns it". `MC.moves` carries
`c: 'S'` for **every non-physical move**: Spore reads `c:'S'`, Night Shade reads `c:'S'`. That guard
excluded every move the reader exists for and the counters read 0. It now reads the artifact's
`statusCategory` tag, whose membership was asserted EQUAL both ways against the format before it was
trusted: **175 legal Status moves, 175 tagged, none on either side.**

Counter `MEDSEEN.statusAbsorbRefused`.

### (3) Corrosion reached Toxic and not Toxic Thread — 2 cells

`MEDI_RIDER_STATUS_NO_SOURCE=1`.

`playerAction` classifies a move by what it carries. Toxic is `kind:'status'`; Toxic Thread carries a
STAT DROP as well, so it is `kind:'affect'` and its status arrives on a **composed rider**. That road
called `applyStatus(who, status)` with no third argument, while the sibling rider loop twelve hundred
lines up has always called `applyStatus(who, status, m)`. So everything `applyStatus` asks of the
ATTACKER was answered against nobody: Corrosion's bypass (`sim/pokemon.ts:1715`), Safeguard's
own-side exemption, and Synchronize.

**Probe.** `ability/nameImplementedBySim` — *"Corrosion reaches a status carried on a composed rider
(Toxic Thread), not only a status move"*.

**The single-reason control.** Corviknight is Flying/Steel; **Toxic Thread is a Poison STATUS move and
does NOT declare `ignoreImmunity: false`**, so the type chart never runs on it and `psn`-into-Steel is
the ONE refusal in the cell. The control that must not move is the **Speed drop**, identical in both
arms — otherwise "Corrosion bypassed the immunity" is indistinguishable from "the whole move started
working".

Counter `MEDSEEN.riderStatusSourced`.

---

## 4. Will's board, derived rather than accepted

He asked whether Stun Spore works on a Ground type. It does; Thunder Wave does not; they inflict the
same status. Rather than take the four moves he listed, the sweep derives every such split in the
format — for each status, every legal targeted move that writes it (primary or 100% secondary),
grouped by whether the type chart judges the move:

```
psn   chart-judged: (none)                            chart-free: toxicthread, poisonpowder
par   chart-judged: nuzzle, thunderwave, zapcannon    chart-free: glare, stunspore
slp   chart-judged: (none)                            chart-free: hypnosis, sing, sleeppowder, spore
brn   chart-judged: inferno                           chart-free: willowisp
tox   chart-judged: (none)                            chart-free: toxic
```

and then searches all eighteen types for a body at which the two groups MUST answer differently.

**It finds exactly ONE anchor board in the whole regulation: `par` into GROUND.** Thunder Wave,
Nuzzle and Zap Cannon must FAIL; Glare and Stun Spore must LAND. `brn` has a split but no separating
body, because nothing in this format is immune to Fire; the other three statuses have no
chart-judged deliverer at all. That is a derived statement with one solution, not a fixture somebody
chose.

**Nuzzle is a fourth shape and not decoration**: a DAMAGING Electric move whose paralysis is a 100%
secondary, so it reaches `par` down a different road from Thunder Wave and must be refused for the
same reason.

Landed as census probe `move/statusCategory` — *"the paralysis family split at ONE Ground body"* —
against a **mono-Ground Hippowdon** (`getImmunity` says Ground refuses Electric and refuses nothing
else here: not paralysis, not powder, not Grass, not Normal), with the same five clicks at a Normal
Snorlax as the control, where all five must land.

**This probe was GREEN on arrival and is stated as such.** It pins the Thunder Wave fix from the
earlier pass at a board where an engine cannot be green by accident in either direction, which is
what the two broken probes could not do.

---

## 5. Two findings that are NOT defects, recorded so they are not rediscovered

**`data/tags.json` under-derives `statusImmune`, and every gap is unreachable.** The format has 14
legal abilities carrying an `onSetStatus`/`onAllySetStatus` handler; the artifact tags 7 as
`statusImmune` and 3 as `protectsAllyFromStatus`. The five it misses are **comatose, pastelveil,
shieldsdown, thermalexchange, waterveil** — and a filtered species walk says **none of the five has a
legal carrier in Reg M-B**. The engine's hand table happens to name `waterveil` and `thermalexchange`
anyway. So the artifact gap is real and costs nothing today; it is printed on every run of the sweep
rather than patched, because the day a carrier becomes legal the print is the warning.

Eleven of the 45 status-handler abilities are unreachable for the same reason: `comatose, commander,
iceface, pastelveil, shieldsdown, stormdrain, thermalexchange, waterveil, wellbakedbody, windrider,
wonderguard`.

**Toxic from a Poison type is correct on BOTH branches**, which the brief asked to be checked
separately. `sim/battle-actions.ts:731` sets `accuracy = true` — the Aerial Ace mechanism, not 100 —
and `:627` separately bypasses the invulnerability check. Both staged with the die LEFT IN and the
target at +6 evasion, and against a target that had used Fly, each against a non-Poison user as the
control. The authority separates every arm and medicham2 matches all four.

**Safety Goggles is banned in this format** and no item path was wired. Confirmed off the format, not
off memory.

---

## 6. The instrument was wrong before the engine was — four times

Per LESSONS §5, ruled out first each time, and each cost a false accusation:

1. **52 cells read `THREW-AUTHORITY`** — Showdown REJECTS `move 1 1` for a spread move
   (`allAdjacentFoes`, `all`) and REJECTS a bare `move 1` for an `any`-target move in doubles. Cotton
   Spore and Sandstorm were in that set, i.e. two immunities the sweep exists to check. The choice
   string is now DERIVED from the move's own `target`.
2. **Four cells read "the trap failed"** — a KO opens a forced-switch request and the turn does not
   advance until it is answered, so the harness threw on exactly the cells where the attack WORKED.
3. **Three cells accused the trap of not holding** — the fixture re-clicked a DAMAGING trap move on
   turn 2 and killed the victim, and `stillActive: false` cannot tell "switched out" from "died". The
   trapper now does nothing on turn 2 and a dead victim is `NOT-STAGED-TARGET-FAINTED`.
4. **The Rage Powder population did not separate, and the separation check is what said so** — four
   arms, one authority answer. The powder immunity that matters there belongs to the **ATTACKER**
   (`if (source.runStatusImmunity('powder'))`), not to the drawer. My arms varied the drawer, so both
   engines agreed for the right reason and the population proved nothing.

---

## 7. Numbers, with the arm and the pins

| quantity | before | after |
|---|---|---|
| census probed / live / missing | 697 / 697 / 0 | **701 / 701 / 0** |
| immunity sweep, 1,800 cells | **21 DIFFER** (knobs armed) | **0 DIFFER**, 3 declared NOT-STAGED |
| damage differential, all 16 corners | 0 of 6000 | **0 of 6000** |
| roster items / abilities / moves DIFFER | 0 / 0 / 0 | **0 / 0 / 0** |
| roster items / abilities / moves MATCH | 139 / 130 / 475 | **139 / 130 / 475** |

Damage differential: `--n 6000 --seed 20260804`, 0 disagreements at midpoint, top, bottom and idx01
through idx14. Roster: release `c6d45355668e`, all three stages `--write`.

Whole-game: arm `middle`, `--games 1200` (a PAIR budget), release **`c6d45355668e`**,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--end-state --write`. **A re-baseline, not a delta** — the standing figure was taken on release
`359b51b61d83`, and one pin is one corner. See the session report for the count.

**The pool was expected to move very little and it was said before the run.** Magic Bounce has one
legal carrier family, Sap Sipper / Motor Drive / Lightning Rod / Volt Absorb are rare, and Toxic
Thread reads 6 uses in the corpus. This is a LAB result: the census and the sweep are where it shows.

---

## 8. Owed, not run

- `tests/run-all.js` in full.
- `tests/interaction_matrix.js` (last run 2026-08-11), `tests/mutation_harness.js`,
  `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check`.
- A POOL-SCALE reading of `MEDSEEN.statusAbsorbRefused`, `MEDSEEN.statusBouncedBackAtUser`,
  `MEDSEEN.bouncedSeedOwnedByBouncer` and `MEDSEEN.riderStatusSourced`. Proved by probe and by sweep,
  never read over 961 pool games.
- The `sharehp` road carries the SAME bounce/re-aim inversion and was deliberately **not** changed:
  Pain Split is the only `sharehp` move in this format and its flags are `{protect, mirror}` with no
  `reflectable`, so no probe can show it red. A change no probe can show red is not a fix. It is on
  the ENGINE hand list as a latent inversion.
- `engine/immunity_sweep.js` is not registered as a gate, per the brief. It is a measuring
  instrument that must be run by hand.
