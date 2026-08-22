# A scheduled job is redefining the engine — `data/move-priors.json` inside `SOURCES`

MEASURE, 2026-08-22. Settling the structural finding recorded in CHANGELOG 5.67.0 Notes
("THE HOURLY INGEST REWRITES A FROZEN ENGINE SOURCE").

Nothing was changed. `engine/engine_release.js` was not edited. Nothing was committed. The roster
chain running against `13ba05093aa3` was not read or disturbed; every roster artifact figure below
came from `git show HEAD:<file>`.

---

## Verdict in one paragraph

The observation is confirmed and the premise attached to it is wrong in the direction that matters.
`data/move-priors.json` **does** change what the simulator does — three separate read paths, two of
them unconditional, one of which decides *which moves a Pokemon is carrying*. Today's two ingest
writes were not cosmetic: they moved 259 of 345 species, added or removed **36 species/move pool
entries**, and flipped the modal move of four species. So the `MEASURED AGAINST A DIFFERENT ENGINE`
clause has **never once fired without cause** — not today, and not in the 331-release history. The
defect is not that the gate over-fires. It is that **a GitHub Action running unattended every six
hours is entitled to redefine the engine**, so the gate is satisfiable only inside a six-hour window
that is shorter than the measurement chain it gates. That is a supply-chain problem, not a
measurement problem, and the fix belongs in the ingest, not in `SOURCES` and not in `quarantine.js`.

---

## 1. Does `data/move-priors.json` change what the simulator does?

**Yes. Derived from the readers, not assumed.**

Grepping every one of the 26 frozen `SOURCES` for a live read of the file (comments excluded) gives
exactly three, plus one path that is a comment only:

| reader | line | what it decides | conditional? |
|---|---|---|---|
| `engine/set_priors.js` | `movePriors()` @115, used by `sampleMoves()` @388-389 and the mega re-draw @675 | **which moves an unrevealed set is filled with** | no |
| `engine/board.js` | `movePriorOdds()` @2470, `protectOdds()` @2487 | feature values `protectThreatened`, `stallIntoEncore`, and the protect-drag on kill probability (@3855, @3891, @4002) | no |
| `engine/rollout_leaf.js` | `movePriorFor()` @608, `pickByPrior()` @706 | **which move a body clicks in a playout** | only under `foePolicy:'prior'`; the default is `'uniform'` (`rollout_leaf.js:1218,1355`, `miltank.js:484`) |
| `engine/medicham2-browser.js` | @24889 | comment only — `MC.priors` is read out of `data/engine-data.js`, a *different* frozen source | n/a |

All three resolve the path relative to their own `__dirname/..`
(`set_priors.js:54`, `rollout_leaf.js:22`, `board.js:1612`), so from inside a snapshot they read the
**snapshot's** copy. Freezing it is load-bearing and it works.

The strongest of the three is `set_priors.fillSet`, because `engine/champions_sim.js:203-206` calls
it from `packTeam()` to fill every slot the store did not reveal. That is the team the **Showdown
reference engine** plays with. A different pool is a different team is a different battle.

### And the change today was not inert

Frozen `e12ef20e7910` (`32f9ef1687d7`) against the live tree (`e667fe8ab457`):

```
speciesChanged            259 of 345
moveCellsChanged         1477 of 2712
cellsPresentInOnlyOne      36        <- the fillSet candidate POOL changed
meanAbsDelta (changed)   0.00397
maxAbsDelta              0.066       (lycanrocmidnight stoneedge 0.195 -> 0.261)
TOP-MOVE FLIP            jolteon electroweb -> thunderbolt
TOP-MOVE FLIP            lycanrocmidnight rockslide -> stoneedge
TOP-MOVE FLIP            gourgeistsuper poltergeist -> trickroom
```

Pool membership changes include `garchomp -scaleshot +ironhead`, `gengar -taunt +willowisp`,
`mimikyu -phantomforce +curse`, `chimechomega -boomburst +protect`. A partially-revealed Garchomp
packed by `champions_sim.packTeam` can no longer draw Scale Shot and can now draw Iron Head. That is
a board.

Checked separately, the earlier transition of the same day (`4ae4509da65f -> 32f9ef1687d7`, the
07:05Z ingest) is live too: 187 species, 853 cells, **17 pool changes**, 1 modal flip
(`alcremierubyswirl decorate -> dazzlinggleam`), including `palafin -shadowball +throatchop` and
`clefablemega -drainingkiss +flamethrower`.

`protectOdds` — which multiplies MAG's kill probability — moved for **196 of 345 species**, e.g.
`pidgeot 0.308 -> 0.333`, `simisear 0.050 -> 0.000`, `chimechomega 0.000 -> 0.060`.

**Conclusion for Q1: it belongs in `SOURCES`. Removing it would mean two runs "against the same
release" pack different teams and score different features, which is exactly the 2026-08-04 failure
this file exists to prevent. Do not remove it.**

### One thing this report does NOT settle

Per-instrument sensitivity is not the same as global liveness, and I could not settle it without
running the roster (forbidden while the chain is live). Read statically:

- `engine/game_differential.js` **is** corpus-sensitive — it draws its pool from the store and packs
  through `packTeam` -> `fillSet` -> `movePriors()`.
- `tests/staged_board.js` uses `champions_sim` only for `Dex.forFormat` and `TeamValidator`
  (@203-204, @979) and never calls `packTeam`, so the three roster stages are *probably* corpus-
  insensitive. **Probably is not measured.** The cheap probe is sitting on disk: three releases with
  **identical code and three different corpora** (`603d9a69d5a3`, `e12ef20e7910`, `13ba05093aa3`)
  exist right now. Run one roster stage against two of them and see whether any verdict-bearing count
  moves. That is a natural experiment that will not exist again once the fix below lands.

---

## 2. What is the right pin?

### The mechanism, stated exactly

`engine/quarantine.js` withholds at four sites — `rosterStage()` @488 (serving three stages),
`mechanicsClause` @767, `wholeGameClause` @1188, `orderProbeClause` @1666 — and every one of them
asks the same question:

```js
const ranOn = j.engine_release || j.release || null;
if (ranOn && curId && ranOn !== curId) { /* WITHHELD */ }
```

`curId` is `data/engine-release.json.current` — **the newest release anybody cut**, which is not the
same claim as "the code moved". The release id is the digest of the 26 file digests, so any byte in
any of the 26 mints a new id, and the pointer follows on the next `cut()`. `cut()` is called
automatically at startup by `engine/game_differential.js:196` and `engine/argmax_paired.js:184`.

So the loop is: **ingest rewrites move-priors -> next measurement auto-cuts -> new id -> pointer
moves -> every artifact from before the ingest is withheld.**

### Why it is effectively unsatisfiable

`.github/workflows/ingest.yml` runs `cron: '17 */6 * * *'` and step
"Re-derive the behaviour priors from the current clean store" runs
`node engine/policy.js data/games.ladder.jsonl data/move-priors.json`, then commits it (@129, @154).
That is **six-hourly**, not hourly — the CHANGELOG note says "hourly" three times and should be
corrected.

The MEDICHAM gate needs five artifacts (three roster stages, the whole-game differential, the
mechanics census) all carrying the current id at the same moment. `data/roster.moves.json` alone was
generated at 19:02Z from a run pinned to a release cut at 06:22Z. **The chain is longer than the
window.** Structurally, the gate closes only if every measurement finishes inside one six-hour ingest
gap.

### Why this only started today

`data/move-priors.json` has 24 commits; **21 of them are `ingest:` commits**, and it is the **only
one of the 26 `SOURCES` that any scheduled job has ever written** (every other source: 0 of N).

It then sat frozen from **2026-07-31 to 2026-08-22** — 321 consecutive releases on one digest —
because the ingest workflow was broken. Commit `0535305` (2026-08-21, *"The collector fetched every
hour for 24 days and threw it all away"*) repaired it. **This finding is a side effect of that
repair, not a latent hole that was quietly costing measurements for weeks.**

### Options weighed

| option | verdict |
|---|---|
| Remove `data/move-priors.json` from `SOURCES` | **Rejected.** §1 shows it changes a board. Removing it means a release no longer freezes what an unknown set is filled with, and two runs "on the same release" play different teams. Strictly worse than today, and it retroactively changes what 331 releases claim. |
| Pin it separately, the way the census and the team pool are pinned | **Rejected.** It is the census/team-pool pattern applied to something that is already frozen correctly — it converts a working automatic guarantee into a manual step that has to be remembered, which this repository has learned is a preference and not a rule. It also does not stop the pointer moving. |
| Split the manifest into `code_id` and a corpus digest; gate on `code_id` | **Rejected, and it was the tempting one.** Retroactively computable from every existing manifest's `files` map (a pure recomputation, no re-cutting), so the migration is cheap. But it asserts *at the schema level* that a corpus change cannot change a number, and §1 measures that it can — 36 pool changes in one day. It would have `game_differential` answering across a corpus shift that changed its teams. It fixes the symptom by encoding a claim that is false. |
| **Stop the scheduler from writing a frozen source.** | **RECOMMENDED.** |

### THE RECOMMENDATION

**Make the corpus table a promoted artifact, not a scheduled one. The ingest writes the fresh
derivation to a NEW path; `data/move-priors.json` changes only when a person or an agent promotes it,
with the delta printed.**

Concretely:

1. `.github/workflows/ingest.yml` step "Re-derive the behaviour priors from the current clean store"
   writes `node engine/policy.js data/games.ladder.jsonl data/move-priors.observed.json`, and the
   `git add` list at @154 and @212 swaps `data/move-priors.json` for `data/move-priors.observed.json`.
   The scheduler keeps collecting; it stops deciding.
2. `engine/policy.js` gains `--promote`, which copies `data/move-priors.observed.json` over
   `data/move-priors.json` **and prints the delta in the units of §1** — species changed, cells
   changed, pool-membership adds/removes by name, modal-move flips. A promotion is then a recorded
   decision that says what it did to the engine.
3. `SOURCES` is untouched. No release changes meaning. No snapshot loses a file. `id` stays the
   digest of the digests and identical-tree-identical-id still holds.

**Why this one.** It is the pattern the repo already uses for the other two derived tables inside
`SOURCES`: `data/residual-order.json` and `data/switchin-order.json` are both DERIVED, and both are
regenerated by an explicit `--write` that a person runs — never by a cron. `move-priors` is the same
kind of object and is the only one wired to a scheduler. Aligning it removes the anomaly rather than
adding machinery to tolerate it.

It also makes the gate satisfiable for the right reason. A re-cut over an unchanged tree returns the
same id, so once the corpus stops moving unattended the pointer moves **only when code moves** —
which is precisely when `MEASURED AGAINST A DIFFERENT ENGINE` should fire. The clause keeps its
current wording and its current strictness, and it becomes true.

And it costs nothing downstream. `data/meta-usage.json`, `data/live.js`, `data/bring-priors.json` and
`data/chomp-ev.json` are not frozen sources and keep updating six-hourly, so the site and CHOMP still
track the meta on the current cadence. The only consumers pinned to the promoted copy are the ones
that must be pinned: the engine, and `engine/fit_policy.js:106`, whose input should be a decision
anyway.

**One thing to say out loud, because it is a real cost.** Under this design the engine's behaviour
priors are as old as the last promotion. That is the correct trade — a table that is stale by a known
decision is a fact, and a table that moves under a running measurement is not — but it means promotion
has to actually happen, so `engine/provenance.js` should carry `data/move-priors.json` as stale
against `data/move-priors.observed.json`, which makes the debt printable rather than remembered.

---

## 3. How many past measurements did this invalidate without cause?

**None. Two release-id transitions have ever been caused by this file, both today, and both carried
real behavioural content.** The gate has not over-fired.

Derived across every release directory on disk (331 with manifests, 2026-08-04 -> 2026-08-22; all 331
include `data/move-priors.json` in their frozen set):

```
distinct move-priors digests across 331 releases:  4
  a64314db056b   n=321   2026-08-04T22:54Z .. 2026-08-22T02:20Z    <- 18 days, never moved
  4ae4509da65f   n=8     2026-08-22T02:37Z .. 2026-08-22T06:22Z
  32f9ef1687d7   n=1     2026-08-22T08:28Z
  e667fe8ab457   n=1     2026-08-22T19:07Z
```

Grouping releases by their other 25 digests: **exactly one group is split by `move-priors` alone**,
and it contains three ids —

```
603d9a69d5a3  2026-08-22T06:22Z  move-priors 4ae4509da65f
e12ef20e7910  2026-08-22T08:28Z  move-priors 32f9ef1687d7
13ba05093aa3  2026-08-22T19:07Z  move-priors e667fe8ab457
```

— i.e. **two transitions**, both on 2026-08-22, and §1 shows both moved boards. Every other
`MEASURED AGAINST A DIFFERENT ENGINE` verdict in this project's history was caused by code.

### What it is withholding right now

`603d9a69d5a3` against `13ba05093aa3`, manifest against manifest: **1 of 26 files differs, and it is
`data/move-priors.json`** (`4ae4509da65f -> e667fe8ab457`). Every other byte of the engine is
identical.

Artifacts stamped `603d9a69d5a3` while the pointer reads `13ba05093aa3` (roster figures read from
`git show HEAD:`):

| artifact | generated | what is withheld |
|---|---|---|
| `data/roster.moves.json` | 19:02Z | **5 DIFFER / 469 MATCH / 0 DID-NOT-FIRE / 23 COULD-NOT-STAGE** — the 157 -> 5 correction |
| `data/roster.items.json` | 06:38Z | 3 DIFFER / 136 MATCH / 0 DID-NOT-FIRE |
| `data/roster.abilities.json` | 06:39Z | 8 DIFFER / 1 DID-NOT-FIRE / 116 MATCH |
| `data/game-differential.json` | 06:47Z | rate, diverged, games, class composition |
| `data/all-mechanics-fire.json` | 06:47Z | the mechanics clause |

Those five artifacts feed **six of the eight gate clauses** (three roster stages, mechanics,
whole-game differential, and the order probe, which reads `data/game-differential.json`). So the
current gate reading is dominated by one data file, and the correct action is a re-run against
`13ba05093aa3` — not a relaxation.

**The honest framing of the cost is not "the gate cried wolf". It is that a six-hourly job can force
a re-run of a twelve-hour measurement chain, and will keep doing so until it stops writing a frozen
source.**

---

## Corrections to the record

- The ingest is **six-hourly** (`cron: '17 */6 * * *'`), not hourly. CHANGELOG 5.67.0 Notes says
  "hourly" and "within the hour"; both should read six hours.
- CHANGELOG 5.67.0 Notes lists as open *"whether `move-priors` changes what the simulator DOES or is
  only set inference"*. Settled: it does, and set inference (`fillSet`) is itself one of the paths
  that changes a board — the two were not alternatives.
- CHANGELOG 5.67.0 Notes says the clause *"fires on a difference that may carry no behavioural
  meaning"*. Measured: both differences it has ever fired on carried behavioural meaning.

## Commands used

```
git log --format='%h %ad %s' --date=iso -- data/move-priors.json
grep -n "move-priors" <each of the 26 SOURCES>
node -e "<manifest grouping over data/releases/*/release.json>"
node -e "<numeric diff of two frozen move-priors copies>"
git show HEAD:data/roster.moves.json      # stable read; the live file is being written
sed -n '1,30p;120,160p' .github/workflows/ingest.yml
```
