# An entity no legal body can carry is not a count — the roster and the staged harness stop bucketing it

2026-09-11, ENGINE. Release `534442d71183`, pins `--release 534442d71183 --census data/mechanics-census.json
--team-store data/team-pool-frozen` (the roster is not census-steered and takes the release and the store).

Will, for the fifth time: *"all the banned abilities remove them from all counts ive asked this like 5 times
now"*.

---

## 1. What was wrong, exactly

`engine/legal_scope.js` is the one implementation of "which mechanics exist in Reg M-B" and it was already
right:

```
moves      497 in scope of 500 legal   (NO-LEGAL-CARRIER 3: powershift, softboiled, spore)
abilities  200 in scope of 316 legal   (NO-LEGAL-CARRIER 114, VALIDATOR-REFUSED 1 battlebond,
                                        NO-LEGAL-READER 1 gluttony)
items      148 in scope of 148 legal
```

Two producers walked the superset anyway.

**`tests/roster.js`.** The out-of-scope ROWS had been dropped from the written `results` since 2026-09-09,
and the BUCKETS were still built over every row. So `data/roster.abilities.json` published:

```
counts  {FIRED-AND-BOARDS-MATCH 139, COULD-NOT-STAGE 159, CONTROL-NOT-QUIET 13,
         DEFERRED-BY-OWNER 5, FIRED-AND-BOARDS-DIFFER 0, DID-NOT-FIRE 0}      sum = 316
results 200 rows
```

116 abilities this regulation does not contain were counted as **COULD-NOT-STAGE**, turning a true staging
gap of 43 into 159. The artifact's own `scope` block said `in_scope: 200` on the same page — the right
answer computed from the right base, sitting beside the wrong one. `could_not_stage_in_scope` was
`nOf('COULD-NOT-STAGE') - oos.length`: a correction applied to a bucket that should never have held those
rows.

**`engine/all_mechanics_fire.js`.** `rows.abilities` held 316 rows of which 176 read not-fired — 116 of
those 176 being abilities with no legal carrier. `summary.abilities.exist` and `.tried` both read 316, and
`summary.abilities.unreachable` read 116, which is the out-of-scope count wearing another name. The verdict
buckets themselves were clean (an out-of-scope row carries no `verdict`), which is exactly why nothing
caught it: **the wrong number appeared only in the denominator and in a row count, and both look
authoritative.**

## 2. The fix

**One predicate, three uses.** `tests/roster.js` now defines `OUT_OF_SCOPE` once and uses it for the
buckets, for the `scope` block's own count, and for the written rows — they can no longer disagree. It was
three spellings before: the buckets used none, `scope.out_of_scope` used `r.out_of_scope` (any tag), and the
written filter used `scope_verdict || out_of_scope === 'no-legal-carrier'`, so a rule-level tag with any
other value counted as out of scope while its row stayed in the artifact.

**Rows excluded, count kept.** `engine/all_mechanics_fire.js` gains `publishRows(kind, rows)`, which splits
on `engine/legal_scope.js`'s verdict, publishes only the in-scope rows, and writes `report.scope[kind]`
carrying the legal list, the in-scope denominator, the excluded count, the codes and the excluded ids. The
rows go; the count does not — a future reader seeing abilities fall from 316 rows to 200 can tell noise
removal from lost coverage. It prints a `SCOPE —` line on every run.

**The base travels with the counts.** Each roster artifact now carries `counts_in_scope` and `counts_basis`
beside `counts`; each fire summary carries `in_scope` and `out_of_scope` beside `exist`.

**`engine/status.js`** printed a bare "N mechanics have never fired in the staged harness". A count with no
denominator is read against the only other number in sight — the legal dex list. It now reads "N of M
in-scope", from the artifact's own scope block, and says `DENOMINATOR NOT CARRIED` for an artifact that
predates the block rather than falling back to the legal total.

## 3. Before and after

| artifact | before | after |
|---|---|---|
| `data/roster.abilities.json` | COULD-NOT-STAGE **159**, counts sum **316**, results 200 | COULD-NOT-STAGE **43**, counts sum **200**, `counts_in_scope 200` |
| `data/roster.moves.json` | COULD-NOT-STAGE **11**, counts sum **500**, results 497 | COULD-NOT-STAGE **8**, counts sum **497**, `counts_in_scope 497` |
| `data/roster.items.json` | COULD-NOT-STAGE 6, counts sum 148, results 148 | **unchanged** — 148 of 148 legal items are in scope |
| `data/all-mechanics-fire.json` | `rows.abilities` **316** (176 not-fired), `exist 316`, `tried 316`, `unreachable 116` | `rows.abilities` **200** (60 not-fired), `exist 316` + `in_scope 200` + `out_of_scope 116`, `unreachable 0` |
| | `rows.moves` **500**, `tried 500` | `rows.moves` **497**, `in_scope 497` |
| `data/mechanics-census.json` | 883 probed, 883 live, 0 missing | **unchanged** — 883 / 883 / 0 |
| `node engine/coverage.js` | staged mechanics fired **785 of 845** | **unchanged — 785 of 845** |

**The items stage and the census are the control.** Where no entity is out of scope, the fix moves nothing.
Identical output across a varied knob would mean the knob is unwired — here the knob moved abilities by 116
and moves by 3, which is exactly the out-of-scope count `legal_scope.js` reports, and moved items and the
census by zero because their out-of-scope count is zero.

**Coverage did not move, and that is the point.** `engine/coverage.js` already derived its denominator from
`engine/legal_scope.js` rather than from the harness, so it was reading 785 of 845 correctly the whole time.
What changed is that the harness now agrees with it: its "the harness marks N of these in-scope rows
unreachable" warning has nothing left to report.

## 4. The corrected gap lists, by name

**Abilities — 43 in-scope COULD-NOT-STAGE** (was reported as 159):

aerilate, analytic, berserk, cheekpouch, cloudnine, compoundeyes, cudchew, cutecharm, dragonize, earlybird,
filter, frisk, furcoat, galewings, heavymetal, hydration, illuminate, klutz, leafguard, lightmetal,
longreach, magician, megalauncher, merciless, minus, naturalcure, noguard, pickpocket, plus, quickfeet,
receiver, ripen, screencleaner, simple, skilllink, sniper, steadfast, supremeoverlord, symbiosis,
synchronize, tangledfeet, unaware, zerotohero

**Abilities — 13 CONTROL-NOT-QUIET:** aftermath, angerpoint, damp, justified, keeneye, magmaarmor, moxie,
opportunist, rivalry, slushrush, stalwart, stickyhold, superluck

**Abilities — 5 DEFERRED-BY-OWNER:** anticipation, forewarn, illusion, pickup, stall

**Moves — 8 in-scope COULD-NOT-STAGE:** aurawheel, extremespeed, focusenergy, iceshard, jetpunch,
ragingbull, struggle, upperhand

**Moves — 3 DEFERRED-BY-OWNER:** axekick, copycat, electrify

**Items — 6 COULD-NOT-STAGE:** aspearberry, focusband, kingsrock, quickclaw, rawstberry, scopelens

**Items — 0 deferred, 0 not-quiet.**

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE.**

## 5. `engine/quarantine.js` — the lines that quote these counts (NOT EDITED)

Another agent holds that file. Read at mtime `2026-09-11T21:53:27Z`; match on the code, not the line
number, since it is moving.

| line | code | what it needs |
|---|---|---|
| 535 | `const c = j.counts \|\| {};` | nothing — `counts` is now the in-scope set |
| 536-537 | `c['FIRED-AND-BOARDS-DIFFER']`, `c['DID-NOT-FIRE']` | nothing — both were already 0 and are scope-independent |
| 615 | `` `${sc.tested} of ${sc.in_scope} tested` `` | nothing — already reads the scope block |
| 627-628 | `matched: c['FIRED-AND-BOARDS-MATCH']`, `couldNotStage: c['COULD-NOT-STAGE']` | **`couldNotStage` now means 43 rather than 159 for abilities.** Nothing reads it for a verdict today, but any future clause built on it inherits the new meaning |
| 4766-4767 | the selftest's own `j.counts` reader | nothing |
| 4795, 4899 | `scope: { tested: 139, in_scope: 148, unattributable: 0 }` | **synthetic selftest fixtures with hard-coded scope numbers.** They do not read the real artifact, so they are not wrong — but they are the one place a hand-typed denominator survives in that file |

The gate's own clause is `differ === 0 && silent === 0 && badReds === 0 && staleShelf === 0`, none of which
moved. **The gate verdict is unaffected by this change.**

## 6. Artifacts still carrying the old shape, reported and NOT touched

- **`data/roster.all.json`** — 2026-09-10, a different release. `counts` sums to 964 against 847 results.
  Regenerating it is a `--stage all` run, which is a separate measurement and was not in this brief.
- **`data/all-mechanics-fire.boardstate.json`** — 2026-08-19, `rows.moves 500 / abilities 316 / items 148`.
  A variant run's artifact from three weeks ago.
- **`web/quarantine-data.js` and `web/stadium.html`** — carry roster sentences from an older run
  (`"clean: 130 of 202 tested"`, `"clean: 139 of 148 tested"`). WEB is paused; these are generated and will
  restate themselves when it is regenerated.

## 7. Where else scope is decided, checked

A derived sweep over every `data/*.json` under 12 MB for values equal to a known superset total (316, 500,
964, 847, 202) found the two artifacts named above and nothing else that is a scope denominator; the other
hits are unrelated quantities (`bring-priors.species.machamp.n_team`, mega SP values, `meta-usage` threat
counts).

Already deriving scope from `engine/legal_scope.js` and needing no change: `engine/coverage.js` (its `POP`
list puts `in_scope` first, so it now prefers the fire summary's new key automatically),
`engine/stage_planner.js` (`inScope 845`, `scopeBasis` stamped), `engine/tag_dex.js` (`LEGAL_CARRIED`).
`engine/open_work.js` quotes none of these counts.

`engine/stage_planner.js`'s `summary.byKind[kind].total` is still the legal list (500/316/148), but it sits
beside `fixture` and `refused` and under a top-level `inScope`, so the base is stated. Left alone.

## 8. Receipts

- Release `534442d71183`, opened and verified on disk.
- `engine/legal_scope.js`: 845 of 964 legal mechanics in scope; 347 legal species (76 mega formes).
- Roster runs: `--stage {abilities,items,moves} --reds --write --release 534442d71183 --team-store
  data/team-pool-frozen`, all exit 0.
- Fire run: `--kind all --write --release 534442d71183 --census data/mechanics-census.json --team-store
  data/team-pool-frozen`, exit 0, arm `bottom-tie-first`.
- Census: `tests/test-mechanics.js --release 534442d71183`, exit 0, 883 probed / 883 live / 0 missing / 0
  threw / 0 hollow.
- `--limit 1` safety: the first entity of each sorted legal list (`accelerock`, `adaptability`, `abomasite`)
  is in scope, so a limited run still publishes a row for every population and
  `tests/probe_amf_default_populations.js` cannot read red for this reason.
