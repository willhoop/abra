# The thirteen silent catches, fixed — 2026-08-23, ENGINE

Historical findings record. Not maintained, not current state, superseded by ROADMAP #258.

Brief: fix the thirteen DANGEROUS manufacturing catch blocks named in
[`docs/_reports/2026-08-23-no-silent-failure.md`](2026-08-23-no-silent-failure.md). No new gates, no
new tests, nothing red, no behaviour change on the success path. Instrument:
`node tests/test-no-silent-failure.js` — already exists, its count falls on its own.

## The headline

| | before | after |
|---|---|---|
| NEW since the baseline | 94 | **80** |
| of those, MANUFACTURE a value | 41 | **28** |
| baselined floor | 201 | 201 (**not re-stamped**) |

**41 − 28 = 13, exactly the thirteen.** Nothing else moved into or out of the manufacturing column,
which is the check that no fix was a rename and no block was laundered.

*(The pre-fix figures differ from the source report's 95/42 because the tree moved between the two
sessions — 393 files / 887 blocks here against 386 / 878 there. The 41 dangerous-plus-other
manufacturing blocks are the same set; the thirteen are the same thirteen.)*

**The gate is still RED (80 NEW), and that is correct.** The remaining 28 are the 16 loud-caller and
11 cannot-fail blocks the source report judged, plus three probe paths written since. Fixing a block
that was already right is bloat, so they were read and left.

## The two numbers that must not move — both held

```
tests/test-engine-diff.js --n 6000 --seed 20260804
  midpoint 0/6000 · top 0/6000 · bottom 0/6000 · idx01..idx14 all 0/6000
  134 not comparable (multihit 134, non-finite 0, threw 0)     <- identical to the stamped run

tests/test-mechanics.js
  651 probed / 651 live / 0 missing, run_ok true               <- identical
```

`data/mechanics-census.json` was reverted after the run: the only diff was `generated` and one
unseeded sampling detail (Iron Head 20.7% → 20.1%). A timestamp is not a finding.

## Did the lab unshrink? No — and the reason is the finding

The brief expected `tests/roster.js:1990` to be currently shrinking the candidate pools. **It was
not, and that was measured rather than assumed.** All three stages, before and after, byte-identical
in every verdict column:

| stage | FIRED-AND-BOARDS-DIFFER | DID-NOT-FIRE | tested / in scope |
|---|---|---|---|
| items | 0 | 0 | 139 / 148 |
| abilities | 0 | 0 | 130 / 202 |
| moves | 0 | 0 | 475 / 500 |

Probed directly: over all **347** legal species of the format, `mcKey(id)` **threw zero times** —
every one resolves, because the cosmetic-forme fallback catches the Vivillon patterns and the
hyphenated formes. So the catch was never firing, no body was ever dropped, and no roster verdict
was ever affected.

**The block was dangerous by construction, not in effect.** `mcKey` returns a truthy key or throws;
it never returns falsy. So `!!mcKey(id)` inside a `catch → false` meant the value `false` was
*only ever manufactured*. The case that matters is `MC.mons` failing to load at all: every species
would then read UNBUILDABLE, all 22 candidate filters would empty, and every stage would report the
handful it could still stage as clean. That is the project's signature failure and it now throws.

### My first fix was wrong, and the measurement caught it

The obvious replacement was `mcKey.has(id)` — purpose-built for membership, never throws. **Measured
before wiring: it disagrees with `mcKey` on 29 of 347 species**, every Vivillon pattern among them,
because `has` consults the direct index only and skips the cosmetic-forme fallback. It would have
removed 29 buildable bodies from every pool — the exact defect the brief was worried about, arriving
through the fix. The landed version is `mcKey(id, {mayMiss: '<why>'})`: identical answer for a
legitimate miss, counted in `engine/lookup.js`'s misses, and no catch at all.

## Was any block only reachable because of the old silent lookup? No

`engine/mc_key.js` has thrown on an **undeclared** miss since `ebe91bf`, **2026-08-02**. The
`buildableSpecies` catch was written on **2026-08-08** (`af69da4`), six days later — it was written
against an already-throwing `mcKey`, so it is not a survivor of the pre-seal `undefined` era and the
seal did not create it. No other one of the thirteen touches `MC.mons`.

## The thirteen, one line each

| block | was | now |
|---|---|---|
| `tests/roster.js` `buildableSpecies` | `catch → false` | declared `{mayMiss}`, no catch; and `monsReady()` **throws** if `MC.mons` is absent, plus a `console.error` if the release copy would not load and the LIVE table is in play |
| `tests/roster.js` precondition clause | `catch → ok=false` → `COULD-NOT-STAGE` | conservative verdict kept; the `why` now says THE CLAUSE ITSELF THREW with the message, and a `!! PRECONDITION CLAUSE THREW` line names the entity and boundary |
| `tests/roster.js` heal-staging selftest | `catch → st=null` → `"not staged by the rule"` | its own row: `THE RULE'S match() THREW — <msg> (a fault in the rule, not a move it declined)` |
| `engine/million_run.js` `speciesGender` | `catch → 'N'` (every body genderless) | **no catch.** `FMT.D` is built at load and `species.get` does not throw; if it ever does the run stops rather than sampling a format nobody plays |
| `engine/game_differential.js` `battleResult` | `catch → mediResult=null` (= "neither side won", a real verdict) | `STATE_FAILS.battle_result_threw` + `_why`, the same shelf as `battle_over_threw` twenty lines up |
| `engine/orient.js` `rd` | `catch → null`, consumed as `rd(x) \|\| ''` | `console.error` naming the path and that anything derived from it reads EMPTY rather than absent |
| `engine/orient.js` inbox count | `catch → pending=0`, printed as "0 draft(s)" | `fail('WHO MAY WRITE', …)` — the file's own house recorder — and the count line is suppressed rather than printed as zero |
| `engine/where.js` `rd`, `rj`, `ls` (3) | `catch → null/null/[]` | `console.error(unread(...))` at each site |
| `engine/where.js` `sources()` | `catch → []` = "the frozen set is empty" | `console.error` — THE FROZEN SET IS UNKNOWN |
| `tests/test-unmodelled-clicks.js` baseline read | `catch → prev=null`, which skips the did-not-GROW comparison and passes | ENOENT is the honest first run; **any other error is `ok(false, …)`** and `moved=false`, so the unreadable baseline is not overwritten either |
| `tests/test-web-quarantine-loaders.js` bundle eval | `catch → ABRA_STATUS=null` → `models=[]` → three clauses pass vacuously | `fail('data/status.js is on disk but would not evaluate … checked ZERO rows')` |

`engine/where.js`'s helper was written as `unread(what, f, e)` **returning the string**, with
`console.error` at each of the three call sites, rather than as a helper that prints. The first
version printed inside the helper and the ratchet still counted all three blocks as silent — it
recognises `fail(` and `console.` but not an arbitrary reporter name. Renaming the helper to match
the regex would be gaming the gate; moving the `console.error` to the call site is honest and the
ratchet sees it.

## Blocks the brief listed that were left alone, and why

Read, judged already-correct, untouched. Each was re-verified by reading the lines below it.

**Loud caller — the sentinel is tested and reported on the next lines** (the gate cannot see this,
which is a stated limit in its own header, not a defect):

- `tests/roster.js:231` — `n = NaN`, and the very next line `throw`s a paragraph about the control
  click's crit ratio.
- `engine/game_differential.js:2342` — `rt = null`, next line `console.error` + `process.exit(2)`.
- `engine/orient.js:99` (`ageOf` → `'NO SUCH FILE'`) and `:152` (`files=[]` → `fail('THE DIVISIONS')`).
- `engine/medicham2-browser.js` **both** blocks — line numbers have moved to `:5157` and `:5239`.
  `residual-order.json` missing sets `MEDFAILS.residualUnplaced` with every step named;
  `switchin-order.json` missing sets `MEDFAILS.switchInPriorityTableMissing` **and** a worded `…Why`
  carrying the regeneration command. Nothing in the play layer needed touching.
- `engine/policy.js:81` — the caller prints *"data/tags.json unreadable, so the stalling family could
  not be DERIVED; not guessed"*.

**Cannot fail, or the silence is correct:**

- `engine/tag_dex.js:749` and `engine/game_differential.js:457` wrap `dex.*.get()`, which does not
  realistically throw.
- `engine/switchin_order.js:77` — the file exits earlier without `SHOWDOWN_PATH`, and the artifact
  records `null` honestly rather than `false`.
- `tests/staged_board.js:1007` — an unreadable learnset baseline makes the check STRICTER (known
  pairs stop being forgiven), so it fails in the safe direction.
- `tests/test-forme-assert.js:113` — **checked, as the brief asked, because it was edited hours
  earlier.** `hasRow` cannot see a throw at all: `buildMon` → `monKey` → `mcKey(name, {mayMiss: …})`,
  a DECLARED miss, so it returns `null` and never throws. `false` is then reported loudly as
  `UNCOVERABLE … a gap in a generated artifact ENGINE may not edit`. Correct as it stands.
- `tests/test-unmodelled-clicks.js:56` — `catch { /* a throw is a different defect */ }` around the
  500-move sweep. Deliberate and documented; not one of the thirteen and not touched.

## Two things found and deliberately NOT fixed

1. **`engine/million_run.js` `speciesGender` returns `'N'` for a species the dex does not contain**,
   on a plain `if (!sp || !sp.exists)` — not a catch, so outside this brief and outside the gate.
   Same manufactured genderless body as the catch that was removed, reached a different way.
2. **`tests/test-unmodelled-clicks.js` treats a baseline that parses but has no `moves` array** as
   "no baseline on disk — this run writes the first one". A third case beside ENOENT and unreadable.
   One line to fix; not a catch block, so left rather than widened past the brief.

## Pre-existing red, not mine

`tests/test-web-quarantine-loaders.js` exits 1 with **2 FAILURE(S)** — the committed
`web/quarantine-data.js` and the block stamped inside `web/stadium.html` withhold a different set
from what the builder decides now (`node web/build-quarantine.js`). **Confirmed identical at HEAD**
by stashing my change and re-running: 2 failures before, 2 failures after, and neither is the clause
I added (the bundle evaluates fine). It is WEB's rebuild, reported and not filed.

## Everything that was run

```
node tests/test-no-silent-failure.js                                RUN — 94/41 -> 80/28
tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804 RUN — 0/6000, all 16 corners
tools\lownode.cmd tests\test-mechanics.js                            RUN — 651/651 live, 0 missing
tools\lownode.cmd tests\roster.js --stage items                      RUN — 0 / 0, 139 of 148
tools\lownode.cmd tests\roster.js --stage abilities                  RUN — 0 / 0, 130 of 202
tools\lownode.cmd tests\roster.js --stage moves                      RUN — 0 / 0, 475 of 500
tools\lownode.cmd engine\million_run.js --trials 5                   RUN — smoke only, artifact reverted
tools\lownode.cmd engine\game_differential.js --games 20 --end-state RUN — smoke only, no --write
node tests/test-orient.js                                            RUN — GREEN
node tests/test-roster-arm-pin.js                                    RUN — all clauses pass
node tests/test-mc-key.js                                            RUN — 21/0
node tests/test-mc-seal.js                                           RUN — 33/0
node tests/test-unmodelled-clicks.js                                 RUN — all checks passed
node engine/where.js protect / --gates / --artifacts                 RUN — exit 0, zero new stderr
node engine/orient.js                                                RUN — exit 0, zero new stderr
node --check on all seven edited files                               RUN
```

**OWED, NOT RUN**

| owed | why not |
|---|---|
| `node tests/run-all.js` | not run — several gates in it are red for reasons that predate this pass (`em_validation.js`, `sanity_check.py`, the WEB quarantine rebuild) and it is a long run whose verdict this change cannot move |
| `tools\lownode.cmd engine\quarantine.js` | not run — the three roster stages and the damage differential, which are its clauses, were each run directly and are unchanged |
| `node tests/test-no-silent-failure.js --update` | **deliberately not run.** It would lower the floor 201 → 197 on the strength of the previous session's detector change. Will's call, unchanged from the source report |
| `--accept` granularity (a FILE, where judgement is per BLOCK) | design decision for Will; `orient.js` is 5 loud-caller + 2 real and they cannot be separated |
| a full `engine/million_run.js` run | the 5-trial smoke proves the edited function; a real rate run is a measurement nobody asked for |
| `node engine/status.js --write` | run at the end of this pass |
