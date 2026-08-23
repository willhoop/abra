# SIX MECHANICS BY REACH — 29 PLAYED-AND-UNCLEARED DIVERGENCES DOWN TO 23

**ENGINE, 2026-08-23.** Six batches of one, each shown RED with its control cleared before anything
was fixed, each followed by a fresh release and a full re-run of `engine/all_mechanics_fire.js
--kind all --write`. The mechanics clause was the target; nothing else was.

```
  mechanics clause   29 -> 28 -> 27 -> 26 -> 25 -> 24 -> 23   (played, uncleared)
  census             646 -> 651 live, 0 missing, 651 probed
  whole-game         68 of 961 -> 67 of 961     A RE-BASELINE, NOT A DELTA (the release moved six times)
  damage differential  0 of 6000, unchanged, all seventeen arms
  gate               5 of 8 clauses PASS, unchanged (the three roster stages were re-run so they
                     did not go stale under the six releases)
```

## THE PINS

| | |
|---|---|
| final release | `dd3b8bdd482f` (cut "mental herb: the item is spent before the volatile it frees") |
| mechanics artifact | `data/all-mechanics-fire.json`, release `dd3b8bdd482f`, generated 2026-08-23T12:54:37Z, 1281 games, 0 threw |
| whole-game | release `dd3b8bdd482f`, `--team-store data/team-pool-frozen`, census pin `data/verification/census-pin-9446a684709d.json`, `--games 1200 --end-state --write`, **961 games** |
| census | `data/mechanics-census.json`, 651/651 live, 0 missing |
| roster | all three stages re-run on `dd3b8bdd482f`: items 139/148, abilities 130/202, moves 475/500, **0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three** |

Six releases were cut, one per batch, so that a bad result would stay attributable:
`bf5a74339a71`, `790c857663c2`, `ea065ec09cdf`, `51eabacfe3ce`, `a82b0adf60e4`, `dd3b8bdd482f`.

## WHAT LANDED

Every one of the six was **narration or emission**. Not one moved a board leaf, and every probe
below asserts the board as a CONTROL that must NOT move — because the HP, the volatile, the layer
count and the item disposition were already right in all six cases. That is why the board-material
whole-game count did not fall.

### 1. CURSED BODY — the carrier writes nothing and the CONDITION writes everything (2,177 teams)

`data/abilities.ts:774-786` is the whole of Cursed Body and contains **no `this.add` of any kind**.
It calls `source.addVolatile('disable', this.effectState.target)` and stops. The line on the wire is
`disable`'s own `onStart` (`data/moves.ts:3686-3690`), which takes its ability branch because
`Pokemon#addVolatile` defaults `sourceEffect` to `this.battle.effect`. Neither is overridden in
`/data/mods/champions/` — checked, not assumed.

```
showdown   |-start|p2a: Feraligatr|Disable|Aqua Tail|[from] ability: Cursed Body|[of] p1a: Banette
medicham   |-activate|p1a: Banette|ability: cursedbody
           |-start|p2a: Feraligatr|Disable|aquatail
```

Two symptoms, one sentence in the authority, one fix, one knob. `TR.vstart` gained the `from`/`of`
pair in `TR.sta`'s existing idiom.

**THE CLASS, PRINTED BEFORE WIRING:** of the 57 volatiles a legal move can apply in this regulation,
exactly FOUR branch their `onStart` on the source effect and attribute it — `attract` (Cute Charm),
`charge` (Electromorphosis / Wind Power), `confusion`, `disable` (Cursed Body). This stages ONE. The
other three are named in the probe header so a later pass adds an ARM rather than a second emitter.
`gender` is `N` on both sides of `game_differential.js` by construction, so the Cute Charm member
cannot be staged there at all.

Probe: `tests/probe_ability_volatile_line.js` — RED 3, GREEN 0, knob `MEDI_ABILITY_VOL_LINE_BLIND=1`.
Census: `ability/disablesAttacker — the seal is announced by DISABLE with the ability attributed, and
the carrier writes nothing`.

### 2. TOXIC DEBRIS — a punish handler that announces itself (1,840 teams)

`data/abilities.ts:5096-5108`. The cap is tested ABOVE the announcement:

```js
if (move.category === 'Physical' && (!toxicSpikes || toxicSpikes.layers < 2)) {
  this.add('-activate', target, 'ability: Toxic Debris');
  side.addSideCondition('toxicspikes', target);
}
```

so a THIRD physical hit with two layers down writes nothing at all. The layer, the side and the cap
were already right; only the line was missing.

**THE CLASS, PRINTED BEFORE WIRING:** five abilities in the whole dex open `onDamagingHit` with a
literal `this.add`; three have NO LEGAL CARRIER here (Cotton Down, Perish Body, Tangling Hair). Of
the twelve `punishesAttacker` rows `data/tags.json` carries for this format, exactly **two** announce
and ten are silent. Both are wired, from `punishesAttacker.announce` derived by `announceIn` — the
same reader `survivesFromFull` and `fractionalPriority` already use.

**AND A SECOND DEFECT ON THE SAME HANDLER, FOUND BY STAGING THE SECOND MEMBER.** Gooey's `-ability`
line was absent AND its Speed drop carried an inline `[from] ability: gooey` the authority writes on
**no ability boost anywhere**: `sim/battle.ts:2058-2072` puts the attribution on a separate
`-ability|TARGET|NAME|boost` line, emitted once per vector and suppressed when the handler passes
`isSecondary` — which Gooey does. `_hpThresholdBoost` four hundred lines down already stated that
rule and the two sites disagreed. `boostsSecondary` is now derived from the handler's own 5th
argument; Gooey is the only legal `punishesAttacker` carrier with a boost, so the non-secondary
branch has no member today and is written from `Battle#boost` rather than from a staged case, and
counted (`MEDSEEN.punishBoostAbilityLine`, expected to stay at zero).

Probe: `tests/probe_punish_announce.js` — RED 17, GREEN 0, knob `MEDI_PUNISH_ANNOUNCE_BLIND=1`.

### 3. DISABLE — the `-start` names the move it sealed (1,799 clicks)

```
showdown   |-start|p2a: Feraligatr|Disable|Aqua Tail
medicham   |-start|p2a: Feraligatr|move: disable
```

`volatileAnnounce` claims a condition only when its whole `onStart` is ONE unconditional
`this.add(...)`, which is deliberately narrow and right for the 23 volatiles that keep the generic
line (Taunt among them). It had no way to express a line whose FIELD 4 is computed.

**THE MEMBERSHIP RULE IS UNCONDITIONALITY, NOT A NAME.** Two conditions write a runtime field 4:
`disable` writes `pokemon.lastMove.name` in BOTH branches, and `charge` writes `this.activeMove.name`
in the ABILITY branch only (the Charge MOVE's own branch is bare). So the new deriver admits Disable
and **refuses Charge by construction**; Charge's ability line stays with the `buffsHolderOnHit` site
that already owns it. Exactly one row of `data/tags.json` gained an `arg`.

Probe: `tests/probe_volatile_start_field.js` — RED 2, GREEN 0, knob `MEDI_VOL_START_ARG_BLIND=1`.
Its control arm clicks TAUNT, which must NOT gain a fourth field.

### 4. REGENERATOR — a CITATION ERROR, not a missing mechanic (1,596 teams)

The most expensive shape a wrong fact can have here: the line was removed **on purpose, with a
paragraph of justification**. `engine/medicham2-browser.js` has carried this since ROADMAP #223:

> "AND IT HEALS SILENTLY. THE AUTHORITY EMITS NO LINE FOR THIS. … `Pokemon#heal`, sim/pokemon.ts:1646
> … adds nothing to the log. `Battle#heal` is the one that emits `-heal`, and the ability does not
> call it."

Every sentence is true of MAINLINE. **`data/mods/champions/abilities.ts:77-84` replaces the handler:**

```js
regenerator: { inherit: true,
  onSwitchOut(pokemon) {
    if (pokemon.heal(pokemon.baseMaxhp / 3)) {
      this.add('-heal', pokemon, pokemon.getHealth, '[from] ability: Regenerator', '[silent]');
    } } }
```

Champions overrides eight files and `abilities` is one of them. The HP was and stays right — the
mechanics artifact reported the row `ANNOUNCEMENT-ONLY` on the board, and the probe asserts HP
agreement at every boundary as a control. The `announces` record is derived off the FORMAT'S OWN
merged handler, so the day the mod drops the override the param goes null and the engine goes silent
again with nothing to edit.

**THIS CLOSES THE REGENERATOR MEMBER OF ROADMAP #397**, and it narrows the group's wording: #397
files six effects that "do not fire at all"; for this member the effect fires and only the
announcement was absent. The other five members of #397 are untouched.

Probe: `tests/probe_regenerator_line.js` — RED 2, GREEN 0, knob `MEDI_REGEN_SILENT=1`. Three arms:
damaged (the defect), UNDAMAGED (the `if (pokemon.heal(...))` guard — `Pokemon#heal` returns 0 at
full HP and writes nothing) and the control ability.

### 5. POLTERGEIST — names the item it found (1,383 clicks) — **CLOSES ROADMAP #359**

`data/moves.ts:13607-13612`, not overridden by Champions. Two clauses; the refusal
(`readsTargetItem {failsIfNone: true}`) was already wired and only `onTryHit`'s announcement was
missing. Because it is the FIRST thing the move writes, its absence truncated the comparison of
every game holding a Poltergeist.

**THE MEMBERSHIP IS NOT THE TAG, AND THAT IS THE POINT.** `readsTargetItem` has two carriers and
Knock Off announces nothing at try time, so a rule keyed on the tag would have put a line on 3,834
corpus clicks. `announcesItem` is derived from the move's own `onTryHit`; scanned over the whole
legal move table, **exactly one** move announces an item name out of a handler.

Probe: `tests/probe_poltergeist_item_line.js` — RED 2, GREEN 0, knob `MEDI_ITEM_READ_SILENT=1`. The
census probe carries KNOCK OFF as a second control for exactly the over-match above.

### 6. MENTAL HERB — the item is spent BEFORE the volatile it frees (967 teams)

`data/items.ts:3906-3917`, not overridden. `Pokemon#useItem` writes the `-enditem`; `removeVolatile`
runs the condition's `onEnd`, which writes the `-end`. This engine had `TR.vend(...)` then
`TR.enditem(...)`. The board is identical either way round, which is why only a protocol reading
could see it.

Two members staged (ENCORE and TAUNT), whose `-end` lines come from two different conditions with two
different labels, so an ordering fix that happened to work for one shape is not enough.

**NOT CLAIMED, AND SAID SO:** the authority's loop removes ALL SIX of the herb's conditions when it
fires and this engine removes the one that just landed. On a legal board they agree — the herb is
consumed by the first of the six to arrive — but that is an argument, not a measurement, and no arm
tests it.

Probe: `tests/probe_mental_herb_order.js` — RED 4, GREEN 0, knob `MEDI_HERB_END_FIRST=1`.

## THE INSTRUMENT WAS WRONG TWICE, AND BOTH TIMES IT WAS MY PROBE

Neither was the engine, and both were caught by reading the instrument the probes feed rather than by
arguing about the game.

1. **The `-end` label is not a defect.** My first normaliser compared `move: encore` against `Encore`
   and reported ten volatile end lines as divergent. Measured over all 57 volatiles: **ten** differ
   from this engine's generic label, and every one of them differs in the NAMESPACE and in nothing
   else — which is exactly `game_differential.js`'s own `effect-namespace` equivalence. A probe
   stricter than the instrument it feeds reports defects nothing else in the repository agrees are
   defects. The rule is now mirrored in every probe here, with the citation.
2. **A failed self-heal's `[still]`.** The authority writes `|move|p2b: Milotic|Recover||[still]` and
   this engine writes `|move|p2b: Milotic|recover|p2b: Milotic`. That is a REAL difference and the
   differ does not count it (`move-target-field`: a `|move|` line is truncated at four fields, because
   who was actually hit lives in the lines that follow). The probes mirror that too, and the
   difference is **NAMED HERE, UNFIXED**, rather than silently normalised away.

## THE WHOLE-GAME RUN — A RE-BASELINE, SAID FIRST

Release `dd3b8bdd482f`, `--team-store data/team-pool-frozen`, census pinned to
`census-pin-9446a684709d`, `--games 1200 --end-state --write`, **961 games**. Six releases moved
under this, so it is **not a delta** against the previous 21 / 18 / 18.

```
                     middle   top-tie-first   bottom-tie-first
  parted                72          60              74
  BOARD-MATERIAL        30          19              21
  NARRATION-ONLY        42          41              53
  minus INSTRUMENT      -9          -1              -2     (Moody 8/0/0, off-field body 1/1/2)
  ------------------------------------------------------
  ENGINE BOARD-MATERIAL 21          18              19     (prior run: 21 / 18 / 18)
```

Moody is the instrument and the arms still say so — 8 in `middle`, **zero in either corner**, which
is an unshared `sample()` and not a rule defect.

**THE BOARD-MATERIAL CAUSE LISTS WERE DIFFED AGAINST THE COMMITTED RUN rather than compared as
totals**, and the diff is four rows in `middle` and nothing in either corner:

| | |
|---|---|
| GONE | `\|-start\|p2a\|disable\|phantomforce\|[from]cursedbody <> \|-activate\|p1a\|cursedbody` — batch 1 |
| GONE | `\|-fail\|p2b <> \|-start\|p1a\|disable` |
| NEW | `\|-fail\|p2b <> \|-start\|p1a\|disable\|protect` — **the SAME defect wearing batch 3's better line**, not a new one |
| NEW | `\|-miss\|p1a\|p2a <> \|upkeep` — a game that used to part on the Cursed Body line now parts later, which is what fixing an EARLIER divergence does |

So: **one board-material cause removed, one revealed behind it, and nothing introduced.**

The surviving `\|-fail\|p2b <> \|-start\|p1a\|disable\|protect` row is a REAL rule gap and is now
readable: `disable.onStart` returns false when the target's `lastMove` slot has **no PP left**, and
this engine applies the seal regardless. It is NOT claimed fixed and no probe covers it.

## OWED, NOT RUN

```
node tests/run-all.js                        RUN — see below
node engine/quarantine.js                    RUN — 5 of 8 clauses PASS
node tests/roster.js --stage {items,abilities,moves} --write   RUN — 0/0 on all three
node engine/all_mechanics_fire.js --kind all --release dd3b8bdd482f --write   RUN
node engine/game_differential.js … --games 1200 --end-state --write           RUN
node tests/test-mechanics.js                 RUN — 651/651 live, 0 missing
node engine/wire_ladder.js                   NOT run — release ladder stays WITHHELD
node tests/interaction_matrix.js             NOT run
node engine/argmax_paired.js                 NOT run — data/decision-impact.json is still absent, so
                                             nothing is excused on decision impact
```

**ONE RED TEST FOUND AND NOT FIXED, WITH ITS RECEIPT.** `tests/test-encore-fail-silent.js` fails on
one counter — `mvFailSilentNoLine want exactly 1, got 0`. **It is red on release `0faabe2a3f1b` too**
— the release cut before any change in this pass — so it is PRE-EXISTING and not caused here. The
only call site of `mvFailSilent` in the simulator today is inside the `MEDI_DRAG_REFUSAL_FAILS` knob
branch, which is off, so the counter cannot reach 1 on a clean run; either the test's expectation or
the Suction Cups refusal path moved and nothing noticed. All ten of its staged arms AGREE; only the
counter clause fails. **Not filed as fixed, not waived — reported.**

Also red and not this pass's, each checked rather than waved through:
`engine/gate_fail_and_silent.js` (2 live causes, both in the prior run's list too — the Role Play and
Curse `-fail`s), `engine/gate_offfield_target.js` (7 `??:` occurrences, ROADMAP #224),
`engine/em_validation.js` (a stamp against `fit_policy.js` and `board.js`, which ENGINE may not
touch), `engine/sanity_check.py` and the self-play validation (neither is ENGINE's).

## REGISTER ROWS PROPOSED — TEXT ONLY, `docs/ROADMAP.md` NOT EDITED

**CLOSE #359** — Poltergeist names the item it is about to throw. Landed 2026-08-23 by ENGINE.
`readsTargetItem.announcesItem` derived from the move's own `onTryHit`; membership printed over the
whole legal move table first (exactly one member; Knock Off, the tag's other carrier, is the control
and must stay silent). VERIFIED BY `tests/probe_poltergeist_item_line.js` (red-then-green, knob
`MEDI_ITEM_READ_SILENT`) and by the census row `move/readsTargetItem — Poltergeist names the item it
found, and the other item-reading move names nothing`. The refusal half the row explicitly did not
claim was already wired and is asserted as this probe's negative arm.

**NARROW AND PART-CLOSE #397** — the Regenerator member is landed. The group's wording, "six
switch-in / on-hit effects do not fire at all, every one board-material by structure", is **wrong for
this member and should be corrected rather than deleted**: the heal fires and has since WIRE 27, the
board comparison agrees at every boundary, and what was absent is the Champions-only `-heal` line.
The cause was ROADMAP #223 reading `/data/abilities.ts` where `/data/mods/champions/abilities.ts:77`
overrides it. VERIFIED BY `tests/probe_regenerator_line.js` and the census row
`ability/healsOnSwitchOut — Champions announces the Regenerator heal, and says nothing when there was
nothing to heal`. Forecast, Symbiosis, Psychic Terrain, Sand Spit and Protean are untouched.

**AMEND #223** — its conclusion ("the authority emits no line for this") is TRUE OF MAINLINE and
false of Champions. The row should record the retraction rather than be quietly overwritten: the
suppression was correct reasoning from the wrong file, and it is the citation rule in CLAUDE.md
costing a real line for eleven days.

**NEW ROW — a `|move|` line's `[still]` on a refused self-heal.** The authority writes
`|move|p2b: X|Recover||[still]` (blanking the target field) and this engine writes
`|move|p2b: X|recover|p2b: X`. Observed on every arm of `tests/probe_mental_herb_order.js`, including
its controls. **NOT counted by `game_differential.js`** — its `move-target-field` equivalence
truncates a `|move|` line at four fields with a stated argument — so this is a narration row with no
instrument today, and it is filed rather than fixed.

**NEW ROW — Disable is applied against a target whose last move has NO PP.** `disable.onStart`
(`data/moves.ts:3676-3683`) returns false when the moveSlot matching `pokemon.lastMove` has `pp === 0`;
this engine applies the seal regardless. Board-material, 1 game in the `middle` arm of the 961-game
run, cause `\|-fail\|p2b <> \|-start\|p1a\|disable\|protect`. Pre-existing — the same game parted on
the same cause in the previous run, under a less informative line.

**NEW ROW — Cursed Body's three exclusion guards are unmodelled.**
`data/abilities.ts:776` — `if (!move.isMax && !move.flags['futuremove'] && move.id !== 'struggle')`.
This engine's `disablesAttacker` site checks only that the attacker is not already disabled. Struggle
is the only reachable member in this format and needs a body out of PP, so it is not staged by
anything today.
