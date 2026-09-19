# ANNOUNCEMENT-ONLY — a roster verdict the gate accepts only on a receipt

**2026-09-19. MEASURE. Light mode, no games played.** Files changed: `engine/quarantine.js` (rule +
selftest), `CHANGELOG.md` (6.71.1), `docs/RUNNING-NOTES.md`, `docs/MEASURE.md`, this report. No
artifact was regenerated and no `status.js --write` was run.

---

## 1. The problem this closes

Will, 2026-09-19: **Illusion is the ONE acknowledged exclusion; everything else gets modelled and
gated.** An ENGINE worktree lifted six of nine roster deferrals. Three cannot be graded by the
instrument that grades every other roster row — Anticipation, Forewarn and Frisk — and the reason is
a fact the tag dex DERIVES rather than an opinion somebody holds:

```
data/tags.json  ->  abilities.<id>.params.announcesOnEntry.visibleOnABoard === false
```

Nothing they do reaches a board leaf. A board comparator handed one of them can only ever return
*the boards agreed*, which is a green that asked nothing — the same shape as a wrapper returning exit
0 for a failing script, one level up.

So removing their deferral makes `tests/roster.js` report **COULD-NOT-STAGE**, and `rosterStage` has
failed on an in-scope COULD-NOT-STAGE row since 2026-09-19 (Will, 2026-09-11: *"stop trying to close
medicham out with all these untested mechanics"*). **The gate would close for a reason that is true
of the instrument and false of the engine.** That is a gate firing for the wrong reason, which is the
one kind people learn to ignore.

**The shelf comes down and the bar MOVES. It does not disappear.**

---

## 2. The verdict contract — exactly what the roster side must emit

A row whose whole effect is a line gets this verdict and this receipt. Everything else about the row
is unchanged: it is still staged, still played, still printed.

```jsonc
{
  "kind": "ability",                      // as today
  "id": "forewarn",                       // as today
  "verdict": "ANNOUNCEMENT-ONLY",         // EXACT STRING. Not "NARRATION-ONLY", not lower case.
  "underlying_verdict": "COULD-NOT-STAGE",// what it would have read without this path. Optional,
                                          //   read by nothing in the gate, kept so the verdict can
                                          //   never be mistaken for a pass.
  "announcement": {
    "tag":          "announcesOnEntry",                    // REQUIRED. a tag this entity carries in
                                                           //   data/tags.json, and that tag's param
                                                           //   must say visibleOnABoard: false
    "census_label": "Forewarn names the foes' top-scoring move as it walks in — …",
                                                           // REQUIRED. the EXACT `label` of a row in
                                                           //   data/mechanics-census.json
    "knob":         "MEDI_FOREWARN_SILENT",                // REQUIRED. /^MEDI_[A-Z0-9_]+$/
    "knob_stamp":   "forewarnSilentRestored",              // REQUIRED. the MEDFAILS key, and it must
                                                           //   be in DELIBERATE_BREAK
    "probe":        "tests/probe_narration_c.js",          // REQUIRED. repo-relative path
    "authority":    "data/abilities.ts:1494-1517"          // optional, carried, not checked here
  }
}
```

and the stage's `counts` gains the bucket:

```jsonc
"counts": { …, "ANNOUNCEMENT-ONLY": 1 }
```

**Three shape rules the producer must keep:**

- `counts["ANNOUNCEMENT-ONLY"]` and the number of rows carrying the verdict **must agree**. The gate
  compares them and fails on a disagreement — a derived set is not a fact until something compares it
  to its source.
- An ANNOUNCEMENT-ONLY row must **not** also be counted in `COULD-NOT-STAGE`, and must **not** be
  counted in `scope.could_not_stage_in_scope`. It is measured; it is measured by a different
  instrument.
- A leftover `deferred` stamp on the row is **inert**. The gate's announcement path never reads it.
  Leave it or remove it; it buys nothing either way.

### The six checks the gate runs on the receipt

All six are read out of an artifact or a source file. None is a list typed inside `quarantine.js`.

| # | check | source | what a failure says |
|---|---|---|---|
| 1 | the receipt is COMPLETE | the row | `NO RECEIPT` / `INCOMPLETE RECEIPT — announcement.<field> missing` |
| 2 | the mechanic is BOARD-BLIND | `data/tags.json` → `<stage>.<id>.params.<tag>.visibleOnABoard === false` | `visibleOnABoard is <v>, not false — a mechanic a board can see is graded by the board` |
| 3 | a LIVE census row exists | `data/mechanics-census.json` → `kind`+`tag`+exact `label`, and `live:true`, `hollow:false`, `armed:true` | `NO CENSUS ROW` / `THE CENSUS ROW IS NOT LIVE and UNARMED` |
| 4 | that row ASSERTS THE AUTHORITY'S EXACT LINE | the row's `detail` quotes a literal `\|-<event>\|…` and names the mechanic | `QUOTES NO PROTOCOL LINE` / `quotes a protocol line that never names <id>` |
| 5 | a DECLARED deliberate break | `knob_stamp` ∈ `DELIBERATE_BREAK` (`tests/test-mechanics.js`), **and** `'<knob>'` and `MEDFAILS.<stamp>` both appear in `engine/medicham2-browser.js` | `NO KNOB CAN MAKE THIS ROW RED` / `appears in no quoted literal` / `is never set in` |
| 6 | a PROBE exercises it ON THIS MECHANIC | the file at `announcement.probe` exists and names both the knob and the mechanic | `does not exist` / `never names <knob>` / `so it is a probe of some other mechanic` |

**Why check 4 is the load-bearing one.** A census row reading `[0,0]` then `[1,1]` proves something
fired. When the whole effect IS what was said, a count of how often it was said is not a measurement
of it. The rule therefore refuses a row that counts announcements and quotes none — and that is
exactly what refuses Anticipation today.

**Why check 2 exists.** Without it, `ANNOUNCEMENT-ONLY` is a relabelling: any inconvenient
board-material row could be moved out of the graded column by typing a different verdict. Check 2
makes the claim *"a board cannot see this"* something the tag dex asserts, not something the roster
asserts about itself.

**Why check 5 reads the knob list rather than copying it.** `DELIBERATE_BREAK` grows several times a
night. A second copy in the gate would drift exactly as two copies of Choice Scarf's multiplier
would, and the drift would be invisible because both copies would keep working. It is parsed from the
one declaration, comments stripped first (a stamp discussed in a comment is a citation, not a
declaration). A parse that finds nothing fails every receipt rather than passing them.

---

## 3. What the clause reads TODAY

Run against the live artifacts through the shipping rule (`Q.annRowReasons`), with the census label
looked up rather than typed:

| mechanic | verdict | what is missing |
|---|---|---|
| **Forewarn** | **ACCEPTED** | nothing. `MEDI_FOREWARN_SILENT` (`engine/medicham2-browser.js:6322`) → `MEDFAILS.forewarnSilentRestored` (`:6347`), declared in the `2026-09-19 — narration batch C` group of `DELIBERATE_BREAK`, probed by `tests/probe_narration_c.js`; census row quotes `\|-activate\|p1a:musharna\|ability:forewarn\|fissure\|[of]p2a:camerupt`. |
| **Anticipation** | REFUSED, 4 reasons | census row quotes **no protocol line** (its `detail` is `[0,0]` / `[1,1]` counts); `anticipationSilentRestored` is **not in DELIBERATE_BREAK** — so a red demonstration under `MEDI_ANTICIPATION_SILENT` would WRITE the census; no probe names the knob or the mechanic. |
| **Frisk** | REFUSED, 5 reasons | **no knob at all.** `engine/medicham2-browser.js:24451` fires the `-item`-on-foe branch unconditionally — there is nothing to switch off, no `MEDFAILS` stamp, nothing in `DELIBERATE_BREAK`, no probe. Its census row **does** quote the exact line including the `[of]` tag, so check 4 passes. |

So the acceptance path is satisfiable — one mechanic satisfies it today — and it is not a rubber
stamp: two of three are refused, each with the work named.

**Nothing in the gate moved.** All three roster stages carry zero rows with the new verdict, so each
prints `ANNOUNCEMENT-ONLY — none claimed` and its `ok` is unchanged:

```
deliberate roster / items      ok: true   clean: 148 of 148 tested. ANNOUNCEMENT-ONLY — none claimed
deliberate roster / abilities  ok: true   clean: 194 of 200 tested. ANNOUNCEMENT-ONLY — none claimed
deliberate roster / moves      ok: true   clean: 495 of 497 tested. ANNOUNCEMENT-ONLY — none claimed
```

*(Those three verdict strings are printed by the clause I changed; they are not a gate figure and are
not quoted as one. The working tree was being written by another division while this ran, and
`CLAUDE.md`'s rule about reading an artifact somebody else is writing applies — no gate number is
published in this report.)*

---

## 4. The selftest arms

`node engine/quarantine.js --selftest` — **353 → 380 passed, 0 failed.** 27 new arms.

### End to end, through the shipping `rosterStage`

Every arm hands it a fully stamped artifact clean in every other column, so the only thing that can
move the verdict is the receipt. The fixture is the REAL Forewarn receipt; its census LABEL is looked
up from `data/mechanics-census.json` at run time, so re-wording the label does not break the arm and
deleting the row does — which it should.

| arm | result |
|---|---|
| the live census still carries the row every arm is built on | **ok** |
| **ACCEPTED WITH A RECEIPT** — a complete receipt passes a stage that would otherwise read COULD-NOT-STAGE | **ok** |
| the acceptance is PRINTED with knob, stamp and probe | **ok** |
| **REFUSED WITHOUT A RECEIPT** — the verdict alone excuses nothing (`NO RECEIPT`) | **ok** |
| a PARTIAL receipt is refused and names the missing field | **ok** |
| **REFUSED WHEN THE CENSUS ROW IS MISSING** (`NO CENSUS ROW`) | **ok** |
| **REFUSED WHEN NO KNOB CAN MAKE IT RED** — stamp not in `DELIBERATE_BREAK` | **ok** |
| and a knob the ENGINE never reads is refused too, even with a declared stamp | **ok** |
| **A LIFTED ROW CANNOT BE EXCUSED** — a leftover `deferred` stamp buys nothing | **ok** |
| `counts` and rows disagreeing fails | **ok** |
| `counts` declaring the bucket with no `results` is CANNOT-ANSWER, not accepted | **ok** |
| the ZERO is printed (`ANNOUNCEMENT-ONLY — none claimed`) and passes | **ok** |

### Synthetic, through the shipping `annRowReasons`

The rule takes its context as a parameter (`{ tags, census, breaks, engine, probe }`), so every
refusal is proven without waiting for a census row of that shape to appear on disk. Each context is
clean except for the one thing under test.

control (clean context accepts) · no protocol line quoted · a quoted line naming another mechanic ·
census row not live · unarmed · hollow · `visibleOnABoard` not false · a tag the entity does not carry
· `DELIBERATE_BREAK` unreadable · a stamp the engine never raises · a probe that does not exist · a
probe that never names the knob · a probe of some other mechanic · the `DELIBERATE_BREAK` parser
against its own declaration (finds the stamp, does not swallow the file) — **14 arms, all ok.**

### Shown RED before being trusted

`annRowReasons` was broken to return `[]` for every row — **on a copy at
`engine/_measure_redcheck_tmp.js`, so the live gate file was never in a broken state** — and the
selftest run on that copy reported **362 passed, 18 failed**, naming every refusal arm. The copy was
deleted after the run (created by this session, so deleting it is this session's to do).

The first red demonstration **threw** instead of failing, at the accepted-row builder reading
`r.announcement.tag` on a row with no receipt. That is fixed with `|| {}` and the comment says why: a
gate that dies is a gate whose verdict nobody reads.

---

## 5. Illusion is NOT the only other excusal today — and that is a finding, not a fix

The brief asked me to confirm it. **I cannot.** `rosterStage` excuses exactly one verdict,
`DEFERRED-BY-OWNER`, and `tests/roster.js` reaches that verdict by **three** producers:

| route | where | live rows in today's artifacts |
|---|---|---|
| the named `DEFERRED` map — Will's word, quoted, per entity | `tests/roster.js:1981` | abilities `anticipation`, `forewarn`, `frisk`, `pickup`, `stall`; moves `copycat`. (`battlebond` is in the map and out of scope.) |
| the **Illusion closet** — `CLOSET_ABILITY = 'illusion'` | `engine/game_differential.js:6916`, applied at `tests/roster.js:2747` | abilities `illusion` |
| the **usage shelf** — a THRESHOLD, no per-row ruling | `USAGE_SHELF_BELOW = 25`, `tests/roster.js:2660` | moves `electrify` (18 clicks in 64,846 stored games) |

`electrify` is not an owner judgement about Electrify. It is an arithmetic comparison against a
click count, and it produces a `deferred: { by: 'Will' }` stamp that looks exactly like one. That is
the third route, it is live, and it is invisible in the artifact's `deferred.by` field.

**I did not gate it.** Failing the roster clause on every non-Illusion `DEFERRED-BY-OWNER` row was
not in the brief, ENGINE's lift is in flight in a worktree I cannot read, and an over-firing gate is
the failure this file exists to prevent. It is reported and left. The coordinator has the routing
decision.

**What I did enforce** is the half that was asked for and is safe: **a lifted row can no longer be
excused.** The announcement path never reads `r.deferred`, so once a row leaves the `DEFERRED` map it
must earn its pass on a receipt or fail. That is arm (v) above.

---

## OWED, NOT RUN

- **The probe is not re-run by the gate.** Check 5 and check 6 prove a knob is *declared* a
  deliberate break, *read* by the engine, and *named by a probe against this mechanic*. They do not
  prove the probe was red on this release. No artifact in this repository records a probe's red
  demonstration, and inventing one inside `quarantine.js` would be a second implementation of
  something ENGINE owns. **If that gap is to be closed, the right shape is a probe artifact ENGINE
  writes, and the gate reads it** — not a re-derivation here.
- **ENGINE owes two knobs and one census `detail`**, and until they land the clause refuses those two
  rows by name: a `MEDI_*` knob + `MEDFAILS` stamp + `DELIBERATE_BREAK` entry + probe for **Frisk**
  (which has none at all), and for **Anticipation** a `DELIBERATE_BREAK` entry for the knob that
  already exists (`anticipationSilentRestored`), a probe, and a census `detail` that **quotes the
  line** instead of counting it.
- **The roster side is not wired.** `tests/roster.js` does not emit `ANNOUNCEMENT-ONLY`, the
  `announcement` block or the `counts` bucket yet. The gate accepts them the moment it does; nothing
  further is needed on the MEASURE side.
- **No gate figure is published here.** The working tree held modified artifacts written by another
  division while this ran (`data/roster.*.json`, `data/engine-diff.json`,
  `data/game-differential*.json`, `data/mechanics-census.json`). The roster verdict STRINGS above are
  from the clause I changed and are reported as such; the gate's own summary was deliberately not
  quoted. It should be re-read on a settled tree.
- **`node engine/status.js --write` was not run**, per the brief. The generated blocks in
  `docs/MEASURE.md` are whatever the last writer stamped.
- **Not committed, not pushed**, per the brief.
- **`tests/test-docs-current.js` is 35 passed, 2 failed, and neither red is mine.** Both name only
  `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`, `docs/MODELS.md` and
  `docs/SUMMARY.md` — the four living documents the next-major draft pass has modified in the working
  tree and which this brief put out of bounds. No entry in either NEW list cites `CHANGELOG.md`,
  `docs/RUNNING-NOTES.md`, `docs/MEASURE.md` or `engine/quarantine.js`. Clause 5 passes on the new row
  (`top 6.71.1 is a patch bump`). Stated red and routed, not filed.
- **One artifact was written that I did not intend to write:** `node engine/open_work.js` rewrites
  `data/open-work.json` on every run, and I ran it to check nothing downstream of my change broke. It
  is derived from the register and was regenerated, not edited.
- **Debris reported, not deleted:** the untracked `data/_1877_dump_g*.json` files and
  `data/verification/game-differential.*.json` in the working tree are not mine and were left alone.
