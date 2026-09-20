# ANNOUNCEMENT-ONLY — the three receipts, built and accepted; and the usage shelf stops signing Will's name

**2026-09-19. ENGINE. Isolated worktree, LIGHT MODE.** Worktree
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a44e49008b932acbd`.
Release cut in this worktree: **`f7b619fc75ef`** (27 files frozen).
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.
`data/engine-release.json` was restored to `18773c22878f` afterwards; `git status` on it is clean.

No lattice, no `quarantine.js` run, no full battery, no `status.js --write`, no commit, no push.
`engine/quarantine.js` was **not edited** — it was fetched from `main` (`git checkout main -- engine/quarantine.js`)
so this worktree could be tested against 6.71.1's rule, and it is byte-identical to `main`'s.

---

## THE VERDICT

| row | roster verdict | gate | receipt |
|---|---|---|---|
| **Forewarn** | `ANNOUNCEMENT-ONLY` | **ACCEPTED** | `announcesOnEntry` / `MEDI_FOREWARN_SILENT` -> `forewarnSilentRestored` / `tests/probe_narration_c.js` / `data/abilities.ts:1494-1517` |
| **Anticipation** | `ANNOUNCEMENT-ONLY` | **ACCEPTED** | `announcesOnEntry` / `MEDI_ANTICIPATION_SILENT` -> `anticipationSilentRestored` / `tests/probe_entry_announce.js` / `data/abilities.ts:174-190` |
| **Frisk** | `ANNOUNCEMENT-ONLY` | **ACCEPTED** | `announcesOnEntry` / `MEDI_FRISK_SILENT` -> `friskSilentRestored` / `tests/probe_entry_announce.js` / `data/abilities.ts:1539` |

`engine/quarantine.js`'s own clause, read on the written artifacts:

```
deliberate roster / abilities   ok: true
  clean: 194 of 200 tested. ANNOUNCEMENT-ONLY — 3 row(s) accepted on a receipt:
  ability:anticipation (announcesOnEntry; MEDI_ANTICIPATION_SILENT -> anticipationSilentRestored; tests/probe_entry_announce.js),
  ability:forewarn     (announcesOnEntry; MEDI_FOREWARN_SILENT -> forewarnSilentRestored;         tests/probe_narration_c.js),
  ability:frisk        (announcesOnEntry; MEDI_FRISK_SILENT -> friskSilentRestored;               tests/probe_entry_announce.js)

deliberate roster / moves       ok: true
  clean: 495 of 497 tested. ANNOUNCEMENT-ONLY — none claimed
```

`counts` on `data/roster.abilities.json`:
`{"FIRED-AND-BOARDS-DIFFER":0,"DID-NOT-FIRE":0,"DEFERRED-BY-OWNER":3,"BELOW-USAGE-SHELF":0,"ANNOUNCEMENT-ONLY":3,"FIRED-AND-BOARDS-MATCH":194,"CONTROL-NOT-QUIET":0,"COULD-NOT-STAGE":0}`
and `scope.could_not_stage_in_scope: 0` — so the three rows are counted **once**, in their own bucket, and in
neither `COULD-NOT-STAGE` nor the in-scope refusal count, as the contract requires.

**Census: 970 live / 0 missing before, 970 live / 0 missing after.** No row lost, no row gained
(set-differenced by `kind|tag|label` against `git show HEAD:data/mechanics-census.json`). The Anticipation row is
the same row with a better `detail`.

---

## 1. Forewarn — emitted, nothing else owed

6.71.1 measured Forewarn's receipt as complete and it is. All that was missing was a producer. `tests/roster.js`
now emits the verdict and the block; the gate accepts it unchanged.

## 2. Anticipation — three things were owed, three landed

- **The census row quoted no protocol line.** Its `detail` was `[0,0]` / `[1,1]` — a count of announcements,
  which for a mechanic whose whole effect IS the announcement measures nothing. The probe
  (`tests/test-mechanics.js`, the `announcesOnEntry` Anticipation row) now returns the matched LINES instead of
  their length, asserts the two test arms produced exactly one distinct line, and quotes it:

  ```
  [Anticipation lines] no ability / neutral + Dragon-into-Fairy (immune) [0,0];
  Shadow Claw (SE) / Sheer Cold (OHKO) [1,1] [|-ability|p1a:hatterene|anticipation]
  — data/abilities.ts:174-190, no die
  ```

- **`anticipationSilentRestored` was not in `DELIBERATE_BREAK`**, so a red demonstration under
  `MEDI_ANTICIPATION_SILENT=1` would have WRITTEN the census. It is listed now.
- **No probe named the knob.** `tests/probe_entry_announce.js` does.

## 3. Frisk — it had no knob at all, so one was written

`engine/medicham2-browser.js` fired the `-item`-on-foe arrival branch **unconditionally**. Nothing in the
repository could make the Frisk census row red, which makes its green unfalsifiable by construction — the fifth
check exists for exactly that state and refused the row by name.

```js
const FRISK_SILENT=_MK('MEDI_FRISK_SILENT');
if(FRISK_SILENT)MEDFAILS.friskSilentRestored=1;
...
if(_em&&_em.event==='-item'&&_em.on==='foe'&&!FRISK_SILENT){
```

Under the knob the branch is skipped and the ability falls through to the pre-existing
`MEDFAILS.entryAnnounceUnmodelled` road — the engine exactly as it stood before that branch was written.
`friskSilentRestored` is in `DELIBERATE_BREAK`. Frisk's census row already quoted its literal line including the
`[of]` tag (landed at 6.70.0) and was not touched.

## 4. `tests/probe_entry_announce.js` — and the comparator blind spot it found

Two arms, each RED + CONTROL, both engines, `middle`, release `f7b619fc75ef`. Every species, move, item and
ability derived from the format and printed. **PASS — 4 arms.**

```
anticipation  carrier Hatterene [Psychic/Fairy]
              SE foe Absol with Hex (Ghost, x2);  dull foes Aggron / Alcremie
  [red]      lines  clean  authority 1  ours 1   knob  authority 1  ours 0   (expected 1)   OK
  [control]  lines  clean  authority 0  ours 0   knob  authority 0  ours 0   (expected 0)   OK
frisk         carrier Banette [Ghost];  foes Absol, Aggron @ Leftovers
  [red]      lines  clean  authority 2  ours 2   knob  authority 2  ours 0   (expected 2)   OK
  [control]  lines  clean  authority 0  ours 0   knob  authority 0  ours 0   (expected 0)   OK
```

Every board held at every boundary in every arm, including under both knobs — which is the measured half of
`visibleOnABoard: false`, not an assumption.

**THE FINDING, AND IT IS WORTH READING.** The probe's first version took its verdict from `playGame`'s
whole-stream comparison and reported *"THE KNOB DOES NOT REACH THE MECHANISM"* for Anticipation. The knob was
fine. `engine/game_differential.js`'s `EQUIV` rule `ability-announcement` **drops every `|-ability|` line from
both streams before comparing**, on the argument — written out there and sound for every other ability — that
the announcement is cosmetic and its consequence is a separate line that is kept.

Anticipation has no consequence. The `-ability` line IS the mechanic, so the normaliser deletes the only
evidence that exists and the two engines agree by construction. Measured: `MEDI_ANTICIPATION_SILENT=1` read
`first divergence none`.

**So the differential is structurally blind to Anticipation, and the census plus this probe are the only
instruments that can see it.** The probe now counts the raw line on each side (`playGame`'s `mediTrace` against
`lastSdLog()`, folded to one spelling) and compares the counts; the whole-game comparison is still run and still
reported, as the check that no board moved.

**I did not touch the EQUIV rule.** It is MEASURE's file, it carries its own red demonstration, and carving an
exception into it for one ability is the name-match this repository forbids. Reported, left. **This also means
the narration gate cannot ever count an Anticipation parting** — a fact worth knowing before that gate's
number is read as complete.

## 5. The usage shelf — it now signs its own name

`USAGE_SHELF_BELOW = 25` is the third producer of `DEFERRED-BY-OWNER`, and it stamped
`deferred: { by: 'Will', why: 'below the usage shelf of 25' }`. An arithmetic comparison against a click count
was indistinguishable in the artifact from a ruling the owner made. Will never deferred Electrify.

The shelf now emits its own verdict and its own receipt:

```
BELOW-USAGE-SHELF | electrify | clicks 18 / threshold 25 | deferred.by undefined
                  | shelf.by tests/roster.js USAGE_SHELF_BELOW | underlying FIRED-AND-BOARDS-DIFFER
DEFERRED-BY-OWNER | copycat   | clicks null / threshold null | deferred.by Will
                  | shelf.by undefined | underlying null
```

**EXACTLY WHICH ROWS THE SHELF NOW COVERS — one, measured on `f7b619fc75ef`:**

| row | clicks in store | threshold | underlying verdict |
|---|---|---|---|
| `electrify` | **18** of 64,846 stored games | 25 | `FIRED-AND-BOARDS-DIFFER` |

`axekick` (2 clicks) **left the shelf by being correct**, not by being exempted: the 6.70.0 confusion-minimum fix
makes its row `FIRED-AND-BOARDS-MATCH`, and a passing row is never shelved. Moves matched 494 -> 495.

**THE GATE'S BEHAVIOUR IS UNCHANGED BY THIS EDIT AND THAT IS DELIBERATE.** `rosterStage` counts
`FIRED-AND-BOARDS-DIFFER`, `DID-NOT-FIRE`, in-scope `COULD-NOT-STAGE`, a stale `DEFERRED-BY-OWNER`, bad reds and
the announcement receipts. A `BELOW-USAGE-SHELF` row is in none of them — it was excused before as
`DEFERRED-BY-OWNER` and it is excused now as itself. **Whether the gate SHOULD count it is MEASURE's call**, and
it is one nobody could take while the row wore somebody else's name. The row is one row, at 18 clicks, with a
real `FIRED-AND-BOARDS-DIFFER` underneath it.

## 6. The shelf comes down in `DEFERRED`, and `closet.ids` shrinks with it

`anticipation`, `forewarn` and `frisk` are **out of the `DEFERRED` map** (left as a struck-through comment, like
`minus` and the Metronome item — a closet that silently loses rows teaches nobody). They left it by being
MEASURED, not by being exempted.

**That has a consequence outside this file and it is not run here.** `engine/all_mechanics_fire.js` publishes
`closet: { ids: Object.keys(require('../tests/roster.js').DEFERRED) }`, and `engine/quarantine.js`'s
`ownerExcusal` excuses a mechanics-proof row on it. Those three ids are no longer in that list. See OWED below.

## 7. Files changed

| file | what |
|---|---|
| `engine/medicham2-browser.js` | `MEDI_FRISK_SILENT` + `MEDFAILS.friskSilentRestored`; the `-item`-on-foe branch is gated on it |
| `tests/test-mechanics.js` | Anticipation's census probe returns and QUOTES its lines; four stamps added to `DELIBERATE_BREAK` |
| `tests/probe_entry_announce.js` | **new** — Anticipation and Frisk, RED + CONTROL, both engines, raw-line verdict |
| `tests/roster.js` | `ANNOUNCEMENT` map + `announcementShelf` + derived census label; `BELOW-USAGE-SHELF`; two new `VERDICT_ORDER` buckets; the artifact serialiser carries `announcement`, `underlying_verdict` and the shelf fields; two membership prints |
| `tests/test-closet-scope.js` | the carrier-less clause admits an `ANNOUNCEMENT-ONLY` row whose UNDERLYING verdict is `COULD-NOT-STAGE` |
| `docs/ENGINE.md` | the hand list |
| `data/mechanics-census.json`, `data/roster.{abilities,moves}.json` (+ `.prev.json`) | regenerated |

**Two stamps added to `DELIBERATE_BREAK` that were not in the brief**, and the reason is the hole the brief's
own item 2 is an instance of: `ripenNoResistWeakenRestored` and `screenCleanActivateLastRestored` are declared in
the engine (the same FORCE-FIRE block as `anticipationSilentRestored`) and were in no list, so a red
demonstration under either would have WRITTEN the census. Ripen's is a BOARD knob. One line each, strictly
safe — the entry only does anything when the knob is set.

## 8. What was shown red before it was trusted

- `tests/probe_entry_announce.js`, first run: **FAIL — 1 problem over 4 arms**, naming Anticipation's knob as
  unreachable. That was the real comparator blind spot in §4, found by the probe failing rather than by reading.
- `tests/roster.js --stage abilities --reds --write`, first run: three correct `ANNOUNCEMENT-ONLY` rows and
  **`rosterStage ok=false`, all three `NO RECEIPT`** — the artifact serialiser is a field whitelist and
  `announcement` was not on it. Computed, then dropped on the way out; the identical shape as `usage_shelf`,
  which had been dropped there for as long as it had existed. The gate caught it, which is the gate working.
- `tests/test-closet-scope.js` went RED on `abilities:frisk [ANNOUNCEMENT-ONLY]` — a carrier-less row that was
  no longer `COULD-NOT-STAGE`. The clause is right and its exemption is keyed on `underlying_verdict`, so an
  `ANNOUNCEMENT-ONLY` row that DID stage a body must still name its carrier.

---

## PROPOSED NOTES ROW

```
### 2026-09-19 — Anticipation, Forewarn and Frisk leave the closet and are graded on what they say

**What changed.** The three `announcesOnEntry` abilities a board cannot see (`data/tags.json` derives
`visibleOnABoard: false`) are out of `tests/roster.js DEFERRED` and emit the `ANNOUNCEMENT-ONLY` verdict that
6.71.1 taught the gate to accept. All three receipts are complete and all three are ACCEPTED by
`engine/quarantine.js` (`data/roster.abilities.json`, release `f7b619fc75ef`): `deliberate roster / abilities
ok: true — clean: 194 of 200 tested, ANNOUNCEMENT-ONLY 3 row(s) accepted on a receipt`. Frisk had no knob at
all — `MEDI_FRISK_SILENT` + `MEDFAILS.friskSilentRestored` were written for it; Anticipation's census row now
quotes the authority's literal `|-ability|p1a:hatterene|anticipation` instead of counting announcements, and
`anticipationSilentRestored` is in `DELIBERATE_BREAK`. New probe `tests/probe_entry_announce.js`: PASS, 4 arms,
each knob taking its own class from 1 -> 0 and 2 -> 0 raw lines while every board holds.
Census **970 live / 0 missing**, unchanged either side (`data/mechanics-census.json`).

**Also.** The usage shelf stamped `by: 'Will'` on an arithmetic comparison and excused Electrify at 18 clicks
as if it were an owner ruling. It now emits its own verdict `BELOW-USAGE-SHELF` carrying the click count and
the threshold. It covers exactly one row today — `electrify`, 18 clicks of 64,846 stored games, underlying
`FIRED-AND-BOARDS-DIFFER` (`data/roster.moves.json`); `axekick` left it by passing, moves 494 -> 495 matched.
The gate counts a `BELOW-USAGE-SHELF` row in no clause, exactly as it counted the `DEFERRED-BY-OWNER` it
replaces; whether it should is MEASURE's to decide, and it is now a decision somebody can take.

**Found, not fixed.** `engine/game_differential.js`'s `ability-announcement` equivalence drops every
`|-ability|` line before comparing, so the differential — and therefore the narration gate — is structurally
blind to Anticipation. Measured: under `MEDI_ANTICIPATION_SILENT=1` the whole-game comparison read
`first divergence none`. The census and `tests/probe_entry_announce.js` are the only instruments that see it.

**Supersedes.** `docs/ENGINE.md`'s "Frisk is DEFERRED-BY-OWNER (Will, 2026-09-18)" and the
"`axekick` and `electrify` remain DEFERRED-BY-OWNER on usage" rows: Frisk is graded, and `axekick` is not on
the shelf at all.

**Basis.** unchanged.

**Owed.** `docs/ENGINE.md` (folded in this pass).
```

---

## OWED, NOT RUN

- **`engine/all_mechanics_fire.js` HAS NOT BEEN RE-RUN, AND ITS `closet.ids` NO LONGER HOLDS THESE THREE.**
  That file publishes `closet.ids` from `Object.keys(require('../tests/roster.js').DEFERRED)`, and
  `engine/quarantine.js`'s `ownerExcusal` excuses a mechanics-proof row on it. **On `6180c4712761`,
  `abilities:frisk` read `DID-NOT-FIRE` there and was excused by that list; it will not be excused now.** The
  expectation is that it reads FIRED on current bytes — 6.70.0 added the `foes-hold-item` planner trigger so the
  receiver holds an item, which is the exact reason the old row could not fire — but **that is a prediction and
  not a measurement**, and the run is a 4,600-game battery, outside light mode.
  `SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write` before the gate is read.
  Anticipation and Forewarn already read FIRED there and are the low-risk half.
- **The gate was not run.** `engine/quarantine.js`'s roster clause was read directly on the two artifacts
  (`rosterStage('abilities')`, `rosterStage('moves')`), both `ok: true`. No lattice, no whole-game differential,
  no `GATE: OPEN` figure is claimed here.
- **THE PIN GUARD WITHHOLDS THOSE TWO CLAUSES ON THE TREE AS LEFT, AND IT IS RIGHT TO.** The brief required
  `data/engine-release.json` to be restored to `18773c22878f` afterwards, and both artifacts are stamped
  `f7b619fc75ef` — the bytes they were actually measured on. Re-reading `rosterStage` now returns
  *"MEASURED AGAINST A DIFFERENT ENGINE … EVERY COUNT IN IT IS WITHHELD"*. The `ok: true` above was read while
  the pointer named the release the artifacts ran on; **to reproduce it, cut a release over the merged tree and
  re-run both stages**, or open `f7b619fc75ef` explicitly. Nothing here should be re-read off the restored
  pointer.
- **`data/roster.items.json` was not re-run**, so it was written by an older serialiser and carries no
  `announcement` / `usage_shelf` fields. It claims no announcement row, so the gate reads
  `ANNOUNCEMENT-ONLY — none claimed` for it and nothing is wrong; it will pick the fields up on its next run.
- **The narration gate's blind spot in §4 is reported and not fixed.** Whether
  `engine/game_differential.js`'s `ability-announcement` equivalence should exempt a tag the dex marks
  `visibleOnABoard: false` is MEASURE's call on MEASURE's file. It cannot be a name list.
- **The probe is not re-run by the gate**, unchanged from 6.71.1's own OWED note: checks 5 and 6 prove a knob
  is declared, wired and named by a probe. They do not prove the probe was red on this release. The red
  demonstration is in §4 of this report and in nothing a gate reads.
- **`node engine/status.js --write` was not run**, per the brief. `docs/ENGINE.md`'s `<!-- GENERATED -->` block
  is whatever the last writer stamped and was not hand-edited.
- **`CHANGELOG.md` and `docs/RUNNING-NOTES.md` were not touched**, per the brief. The notes row is above.
- **Not committed, not pushed.**
- **`engine/quarantine.js` in this worktree was checked out from `main`** so the 6.71.1 rule could be tested
  against. It is byte-identical to `main`'s and must not be committed from here.
- **Debris reported, not deleted:** `data/roster.abilities.prev.json` and `data/roster.moves.prev.json` are
  written by `--write` itself (it keeps the bytes it replaces). `data/releases/f7b619fc75ef/` is this session's
  release and is left in place.
