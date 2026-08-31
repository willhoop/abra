# THE ANNOTATOR RESOLVED THE FIRST DEX HIT, AND THAT PUT `cannot_occur_in_format: true` ON THREE LIVE CAUSES — TWO OF THEM BOARD-PARTING

**2026-08-31. INSTRUMENT FIX. No game was played, no engine byte moved, and the frozen release id is
unchanged at `862624c9826e` before and after.**

Filed by `docs/_reports/2026-08-30-missing-event-mechanisms.md` §E15, which found the Heal Block row.
It is a class and the class is larger than the one row.

The prediction was written to
[`2026-08-31-annotator-entity-kind.PREDICTION.md`](2026-08-31-annotator-entity-kind.PREDICTION.md)
before the probe was run. **Six predicted figures, six hits at the point estimate**, plus P6's
judgement call (the declared-gaps item is not trivial), which also held.

---

## THE VERDICT

| | |
|---|---|
| names in the regulation that a first-hit resolver gets wrong | **5** |
| of those, already covered before today | **2** (`confusion`, `hail` — both in the standalone condition table) |
| **live holes** | **3** — `healblock`, `metronome`, `floette` |
| rows in `data/verification/game-differential.enginedata.json` wearing `cannot_occur_in_format: true` | **3** |
| of those, **mislabelled** | **3 — all of them** |
| of the mislabelled, **board-material** | **2** (both `board_parted: 1`, `DIFFERENT-END-STATE`) |
| after the fix, rows wearing the flag | **0** |
| board-parted / protocol / causes / census | **unmoved — 82 / 172 / 150 / 815-815-0** |

---

## THE THREE GUISES, ALL ONE FAULT

`engine/game_differential.js` annotated a cause by tokenising it and asking the dex, moves first,
first hit wins. `cannot_occur_in_format` is `mentions.every(m => m.reachable === false)` — a TRIAGE
flag, so a row wearing it is closed without being read. **Nothing ever went red for any of these,
because a wrong "impossible" removes work from the queue instead of adding a failure to it.**

### 1. A volatile whose name collides with a `Past` move — `healblock`

The rule already in place (2026-08-27, `engine/effect_kind.js`) asked the **35-entry standalone
condition table** `Dex.data.Conditions`. The Heal Block volatile is not in it — it lives inside the
move it is named after, and it is applied by **Psychic Noise**, which is legal
(`isNonstandard: null`, `secondary: { chance: 100, volatileStatus: 'healblock' }`). The MOVE Heal
Block is `Past`. So the move table answered and a live mechanic was binned.

The set is now **derived**: a name is a condition in play when something legal in this format can
set it — a declared `volatileStatus` / `sideCondition` / `slotCondition` / `pseudoWeather` /
`weather` / `terrain` / `status` on a legal move, ability or item (including inside `self`,
`secondary`, `secondaries` and the entity's own `condition` block), **plus** `addVolatile('x')`-style
literals inside those entities' handler functions, **plus** the standalone table.

Measured on `gen9championsvgc2026regmb`, over 964 legal moves/abilities/items:

```
96 condition names in play (35 from the standalone table)
 3 of them also name a move NOT in this format:
   confusion   Past   already in the standalone table: true    set by 10 legal things
   hail        Past   already in the standalone table: true    set by  1 legal thing
   healblock   Past   already in the standalone table: FALSE   set by  1 legal thing (psychicnoise)
```

**It is deliberately "settable by something legal" and not "is a condition at all".** A volatile
whose only setter is a `Past` move — `octolock`, `telekinesis`, `iceball` — genuinely cannot occur
here and the move table's answer for it is RIGHT. Widening to every condition name in the dex would
silence those correctly-labelled rows, which is the same fault pointed the other way. Those three are
the probe's negative control.

### 2. A legal ITEM under a `Past` move's name — `metronome`

`STANDING_KINDS` is `[moves, abilities, items]` and the loop returned the first hit. `metronome` is a
legal item here and a `Past` move. Derived across the format: **1 item collides, 0 abilities.**

The resolver now collects a candidate per kind and **prefers a reachable one**, which is just the
honest reading of "nothing this token can denote is reachable". When nothing is reachable the first
hit is still returned, so a correctly-impossible token is unchanged.

**This one appears on 0 rows of the current artifact** — derived, not observed, exactly as predicted.

### 3. A legal FORME under an out-of-format base spelling — `floette`

**This is the expensive one and it was not in the filing.** Two rows read

```
-damage field 3 :: |-damage|p1a|H/H <> |-damage|p1a|H/H
  [values differ: |-damage|p1a:floette|74/149 vs |-damage|p1a:floette|92/149]
```

The rosters on those games hold **`floettemega`** and **`floetteeternal`**, both in this format.
`dex.species.get('floette')` is `isNonstandard: 'Past'` AND `tier: 'Illegal'`, so the token answered
`reachable: false` and the whole cause was binned. Both rows are `board_parted: 1`,
`DIFFERENT-END-STATE`. **Two board-parting damage divergences on a legal body have been excluded from
every work queue that reads that flag.**

Derived across the whole regulation: **exactly ONE illegal base species carries a legal forme, and it
is Floette.** `legal` still reports the base spelling honestly; only `reachable` is corrected, and the
formes that did it ride along as `via: ['floetteeternal', 'floettemega']`.

---

## SHOWN RED, WITH A KNOB

The shape admits a knob, so it got one rather than a temporal before/after.
`EK.makeStanding({ resolution: 'first-hit' })` reproduces the old resolver exactly, and
`PROBE_ENTITY_KIND_ARM=first-hit node tests/probe_entity_kind.js` puts it under test:

```
PROBE_ENTITY_KIND_ARM=first-hit  ->  6 FAILURE(S), exit 1
   FAIL  |-end|p1a|healblock is NOT binned impossible
   FAIL  p1a:floette is reachable
   FAIL    legal reports the base spelling honestly ... via: []
   FAIL  item: metronome is reachable
   FAIL    and it is resolved as an ITEM, not as a move (got moves)
   FAIL  the rows the artifact binned are re-examined ... (0 of 3)
node tests/probe_entity_kind.js  ->  PASS, exit 0
```

Every claim is asserted against BOTH arms. Where a claim is expected NOT to move across the knob
(`confusion` and `hail`, already covered by the standalone table) the probe says so as a stated
control rather than reporting a pass it did not earn.

**And the artifact's own labels are the second receipt.** PART 5 re-annotates every cause in
`data/verification/game-differential.enginedata.json` and reports before/after:

```
112 annotated causes; 3 wore cannot_occur_in_format: true
3 relabelled REACHABLE, 0 still impossible, 0 newly impossible
   RESCUED  -damage field 3 :: ... |-damage|p1a:floette|82/149brn ...
   RESCUED  -damage field 3 :: ... |-damage|p1a:floette|74/149 ...
   RESCUED  event missing from medicham2 :: |-end|p1a|healblock <> |upkeep
```

Confirmed **end to end through the shipped annotator**, not only through the probe's copy:
requiring `engine/game_differential.js` and calling its exported `annotateCause` over the same 112
causes gives **was 3 -> now 0**, with `species_forme_rescues: 2` and
`rescued_from_an_illegal_move: 11` (`confusion` x10 + `healblock` x1 — printed and explained, no
over-match).

---

## WHAT MOVED AND WHAT DID NOT

**This changes labels and no game.** Neither `engine/effect_kind.js` nor
`engine/game_differential.js` is in the 26-file frozen `SOURCES` set, and `engine_release.js` reports
the tree as `862624c9826e` after the edits — the same id the brief's baselines were taken on. So:

- board-parted **82**, protocol **172**, distinct causes **150** — unchanged, by construction. No
  differential was re-run and none was needed; the artifact's causes were re-annotated in place.
- census **815 / 815 / 0** — unchanged and **deliberately NOT regenerated**. `tests/test-mechanics.js`
  does not require the annotator (only comments mention it), so re-running it would churn a pinned
  artifact for no information.
- `data/engine-release.json` `cuts: 1 -> 3` and `data/provenance-stamp.json` moved. Those are
  generated churn from loading the differential module and from `status.js`; the release **id** is
  unchanged, which is the field that matters.

---

## WOULD IT CATCH A COLLISION SPELLED DIFFERENTLY — YES, AND HERE IS THE HONEST LIMIT

**Yes for all three guises.** Nothing in the fix names an entity:

- the condition set is computed from what legal entities actually set, on every run;
- the kind preference is "prefer a reachable kind", which mentions no kind and no name;
- the species rule is "a base forme with a legal forme is reachable".

`tests/probe_entity_kind.js` asks `effect_kind.js` for the collision set **at run time** and iterates
it, so a new `Past` move colliding with a live volatile fails the probe with no edit to the probe. The
membership counts are printed by the probe AND stamped into the artifact
(`entity_annotation.collisions_with_an_out_of_format_move`,
`illegal_base_species_with_a_legal_forme`), so a derivation that silently matched nothing cannot pass
for one that had nothing to match.

**The limit, stated rather than discovered later.** The condition derivation reads declared fields and
`addVolatile('…')`-shaped literals in handler source. A volatile applied through a **computed** name
(`addVolatile(someVar)`) is invisible to it. None exists in this format's legal set today — the 96
names reconcile with a hand scan of the mod and mainline sources — but the guard does not close that
arm and does not pretend to.

---

## OWED, NOT RUN

- **The differential was NOT re-run.** The labels were corrected on the stored artifact by
  re-annotation. The next `game_differential.js` run will publish the corrected labels itself; until
  then `data/verification/game-differential.enginedata.json` on disk still carries the OLD three
  `true`s and must not be triaged from.
- **The three rescued mechanics are now open work and were not fixed here.** Heal Block never expires
  (narration-only, `materiality: NARRATION-ONLY`); the two Floette rows are board-parting `-damage
  field 3` magnitude divergences and nothing here says why the damage differs.
- **`node tests/test-mechanics.js` was not run** (see above) and no census was regenerated.
- **`tests/test-no-silent-failure.js` reports "7 baselined block(s) now speak. Re-run with --update to
  lock the gain in."** Not done — it rewrites `data/silent-catch-baseline.json`, a shared artifact,
  and the gate is GREEN without it.
- **The full suite was not run.** `tests/run-all.js --coverage` is RED at 54 unaccounted checks; it
  was RED at the same 54 before this pass (HEAD's runner reports 55 on this tree, the extra being the
  new probe it does not yet know about), so the count is unchanged and the probe is accounted for.
- **Inherited reds, untouched:** `probe_red_demo` (5+1 of 200), `probe_upkeep_lines` (4 of 49),
  `test-pinch-family` (1 of 61).

---

## THE `declared_gaps` ITEM — FILED, NOT LANDED

The 2026-08-30 report's E8 row 147 (`|-end|p1a: Kingambit|fallenundefined|[silent]`, ROADMAP #321,
closed as NOT A DEFECT and still costing a divergence) **is not trivial and not independent.**

`declared_gaps` in the artifact is a block of COUNTERS, not a list of excused causes. The thing that
would actually stop that line costing a divergence is `DECLARED_NOT_EMITTED`
(`game_differential.js:1888`), built from `PROTO.notEmitted` — and that list is keyed by **EVENT
NAME**. Declaring row 147 there declares `-end` wholesale, which would silence every `-end`
divergence in the run. A correct fix needs a cause-level declaration mechanism that does not exist
yet, and it changes `diverged` — a published number. **That is its own batch.**
