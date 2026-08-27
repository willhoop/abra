# The party key landed, and the scoreboard re-baselined — 2026-08-26 (ENGINE)

**THE NUMBERS BELOW ARE THE FIRST MEASUREMENT UNDER THE CORRECTED COMPARATOR. Nothing published
before 2026-08-26 03:28 compares to them.** `engine/board_state.js` keyed the party on the DISPLAYED
species until this pass; it now keys on the body. That changes which rows exist, which changes the
census-coverage credit, which changes which clicks the driver makes — **109 of 961 trajectories
differ across the two keyings, against a control of 0 of 961 between two identical runs.** A delta
across that boundary is two instruments subtracted from each other.

---

## THE NEW FIGURES

Pins, every one of them: release `6272fa445b73`, `--arm middle --turns 12 --games 1200`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`
(digest `9446a684709d`, 643 rows), team pool `0d103fb9fa87`.

```
  whole-game clause          13 of 961   1.4%     (18 raw, less 5 declared, 0 cleared on decision impact)
  raw diverged               18 of 961
  board-material              4 of 961            (957 of 961 boards never parted — 99.6%)
  narration-only             13 causes, 14 games
  reader failures            {}                   <- was {"duplicate_species_in_party":20}
  roster identities read from DISPLAY state   0 / 0 / 0
  census                    754 live / 754 probed / 0 missing   (unmoved — not regenerated here)
  cards                      17 cards, 5 classes
```

`data/whole-game-baseline.json` is stamped at **18 of 961 = 1.9%** under
`A/middle/pins:2efbc9ed1946/credit:observed-effect/v1/nature:real`. No `--force` was needed and none
was used: the standing bar was 30.8% under a different pin, and the clause itself refuses to subtract
one pin from another.

### THE BOARD-MATERIAL WORKLIST — four causes, four games

```
  turn 8   -damage field 3          recoil values differ  |-damage|p2a:incineroar|20/170par|[from]recoil
  turn 4   ordering                 |-enditem|p2a|whiteherb  <>  |turn|5
  turn 6   event missing            |-fail|p1b  <>  |upkeep
  turn 2   -damage: a different body   |-damage|p2a|H/H  <>  |-damage|p2b|H/H
```

The last of those is the spread-target divergence #465's card already named as NOT the party key. It
survived the re-key untouched, exactly as predicted. The other three are on games this sample plays
and the display-keyed sample did not.

**And two leaves appear in the end-state worklist that the display key could not write at all:**
`party.species` (1 game) and `party.types` (1 game) — a transform one engine is holding and the
authority is not. Under the old keying that row had no stable name to be reported under.

---

## WHAT LANDED

### 1. The re-key is the default

`engine/board_state.js`: `PARTY_KEY_IDENTITY` is now on unless `MEDI_PARTY_KEY_DISPLAY=1`. The knob
inverted — it is the POSITIVE CONTROL that restores the old, wrong keying so a probe can measure the
collision rather than assert it. The retired `MEDI_PARTY_KEY_IDENTITY` is a no-op **and says so out
loud** on module load; a retired knob that silently does nothing is how a run gets attributed to an
arm it never took.

`tests/probe_party_key_collision.js` swapped arms with it. The parent now runs the shipped default and
carries the assertions (4 of 4 party rows in both engines, the same four, the rename as a compared
`species` leaf); the child runs `MEDI_PARTY_KEY_DISPLAY=1` and MEASURES — it still reports **3 of 4
rows, 1 BODY LOST TO A COLLISION**, so the control is a real control.

### 2. Every plant, comparator and serialiser that touches party identity — enumerated

The charge-clock lesson: a re-key touches identity everywhere, and flipping only the reader would have
been undetectable in two of these.

| site | what it does | changed? |
|---|---|---|
| `board_state.js partyMap` | keys the party | **yes — identity by default** |
| `board_state.js benchRow` | carries `key` beside the displayed species | no (already carried it) |
| `board_state.js` reader sides | **new `active_keys`** on both engines | **yes — see below** |
| `board_state.js family()` / `locate()` | key-agnostic by construction | no |
| `game_differential.js rosterKey` | delegates to `BS.stableKey` | no |
| `game_differential.js` **the six BENCH PLANTS** | build the expected path `party.<key>.<leaf>` | **yes — this broke, see below** |
| `game_differential.js isDuplicateOfActive` | de-duplicates a party row that is a standing body | **yes — see below** |
| `game_differential.js rosterSnapshot` | the end-of-game dump both engines are compared by eye in | **yes — routed** |
| `end_state_severity.js` | reads the party map it is handed | no |
| `all_mechanics_fire.js` `want: 'party.hp'` etc. | FAMILY paths, key-agnostic | no |
| `data/game-differential.json` | stores `p2.party.<key>.<leaf>` path strings | **this is the re-baseline** |

**THE SIX BENCH PLANTS BROKE AND A TEST CAUGHT IT.** They built their expected path with
`id(m.name)` — the displayed species — and `tests/test-state-differential.js` went **12 FAILS**: every
bench plant `caught=true` at the right boundary and `localised=false`, because the row now reads
`p2.party.lopunny.item` and the plant wanted `lopunnymega`. Confirmed as MINE rather than pre-existing
by running the same test under `MEDI_PARTY_KEY_DISPLAY=1`, which was green. They build the path with
`rosterKey(m)` now, and the test is green again. This is the one instrument whose whole job is proving
the comparator can see a bench leaf at all.

**`isDuplicateOfActive` WOULD HAVE DOUBLE-COUNTED EVERY RENAMED BODY, SILENTLY.** It matched the party
diff's `body` — now the identity key — against `active_species`, the DISPLAYED name. The two agree for
an ordinary body and stop agreeing for exactly the megas and transforms, so a mega's party row would
have been listed in the wire queue beside its own active row. Fixed by asking the question in one
currency: `board_state.js`'s readers now publish `active_keys` through the same `stableKey`, and the
dedupe reads those. `compare()` walks a named list, so `active_keys` cannot become a compared leaf.

**`rosterSnapshot` was the one production site still answering the identity question for itself** —
`key: m._switchKey || null`, and the `|| null` was the silent half: an unstamped body reported `null`
in the one dump whose entire job is saying which body each engine holds when the game stops, and
nothing counted it. Both halves now go through `rosterKey`, so a missing stamp lands in
`ROSTER_KEY_FALLBACK`, which every run prints and which must read 0/0/0. It does: **0 / 0 / 0.**

### 3. Identity is one door, and the check DERIVES its membership

`engine/identity_audit.js` — new, registered in `tests/run-all.js` GATES.

This is the fifth instance of the species-key class. The previous four fixes were each **a list of
known-bad spellings**, and the next instance used a spelling that was not on the list. So this file
contains no list of identity fields: it reads `stableKey`'s own source at run time, extracts every
property chain the door consults on its argument, and scans for those. A field the door starts
consulting tomorrow joins the audit with no edit.

The HARD/SOFT split is derived too — from whether the door's own branch announces itself with
`say(...)`:

```
  HARD (enforced) : .set.species  .set.name  ._switchKey
  SOFT (counted)  : .baseSpecies.id  .species.id  .name
```

**IT OVER-MATCHED ON ITS FIRST RUN AND THE FIRST RUN IS WHY IT DOES NOT NOW.** The soft test combined
branch verdicts with AND instead of OR; `return id(x.name);` is its own occurrence, contains `return`
on the matched line, breaks the scan before it can see the `say(` one line above, and reported HARD.
The audit accused **1,282 sites**, nearly all ordinary `.name` display reads. Printed before wiring,
per the standing rule. With OR the population is 32: 2 DOOR, 4 STAMP, 13 DECLARED, 0 UNROUTED — and it
was **14 UNROUTED before the fixes above**, which is how `rosterSnapshot` was found.

**What walks past it**, stated in its own header rather than discovered later: every SOFT-chain site
(1,301 lines in 164 files — `.name` is a display read far more often than an identity read and no
static rule separates them); an identity answered with no chain read at all, e.g. by index into
`sf.team`; any file outside `engine/ tests/ build/`; and a wrong `IDENTITY-OK:` declaration, which is
why all thirteen are printed in full on every run.

`node engine/identity_audit.js --break` plants an unrouted read of a derived HARD chain under the
scanned roots, re-runs the scan in a child, and fails unless the child went red and named the planted
file. It refuses to overwrite a file it did not create and removes only the one it wrote. **Green.**

---

## WHAT WAS RUN, AND WHAT IT SAID

| | |
|---|---|
| `tests/probe_party_key_collision.js` | green, both arms — parent asserts the fix, child measures 1 body still lost under the control |
| `tests/test-roster-identity.js` | green, every arm including `no-display-fallback` |
| `tests/test-state-differential.js` | 12 FAILS → **green** after the plant fix |
| `tests/test-game-diff.js` | green |
| `tests/test-end-state.js` | green |
| `tests/test-switch-back-renamed.js` | green, 4 of 4 arms, 0 declared known-open |
| `engine/identity_audit.js` | green, 0 UNROUTED; `--break` goes red on demand |
| `engine/quarantine.js --whole-game` | FAIL at 13 of 961, which is the clause doing its job |

## OWED, NOT RUN

- **No release was cut, and none is owed.** `node engine/engine_release.js list` reads
  **`6272fa445b73 — 0 of 26 files have moved since`** after every edit in this batch:
  `board_state.js`, `game_differential.js` and `identity_audit.js` are the reader, the instrument and
  an audit, and not one of them is in `engine_release.js`'s `SOURCES`.
- **The three roster stages and `all_mechanics_fire.js --kind all` were NOT re-run**, for that reason.
  The simulator is byte-identical; nothing that plays a game moved.
- **`tests/test-engine-diff.js` was NOT re-run.** No damage code was touched, and the stronger
  statement is the one above: no `SOURCES` file moved at all.
- **The census was NOT regenerated.** It stands at 754 live / 754 probed / 0 missing, generated
  2026-08-27T02:40 by another agent. Nothing in this batch is a mechanic.
- **`data/divergence-turns.json` was already modified in the working tree when this session started**
  and has been overwritten by the dump. That was the brief's instruction; it is recorded here because
  the prior contents were not this session's.
- `tests/test-middle-identity.js`, `tests/test-fixture-legality.js`, `tests/test-web-status.js` and
  `tests/test-resolution-order.js` are red at HEAD, pre-existing, untouched.
