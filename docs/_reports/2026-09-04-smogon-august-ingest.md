# Smogon August 2026 ingest — findings

Date: 2026-09-04. Historical findings record, not current state. Superseded by whatever register
row it feeds. Do not cite as state; `node engine/status.js` is the state.

---

## 0. The headline

The August dump is archived, content-verified as our format, and stamped as its own artifact. It is
**clean** — zero species in it are illegal in Reg M-B. **Our own store is the dirty one**: 85 species
keys in it are `isNonstandard: 'Past'` and cannot legally appear in this regulation.

Smogon sees **310** species over **1,269,250** battles. Our store has seen **all 310**. Nothing in the
dump is new to us.

---

## 1. An ingest already existed. I did not write a second one.

The brief's first instruction was to check. `node engine/where.js smogon` and a directory listing
found a complete, working pipeline:

| File | What it does | State |
|---|---|---|
| `engine/fetch_smogon_stats.js` | Archives `usage/` **and** `moveset/`, both formats, all four cutoffs — 16 files/month | Worked first try |
| `engine/smogon_priors.js` | Parses moveset blocks → abilities, items, spreads, moves, teammates, checks-and-counters | Worked first try |
| `data/smogon-stats/<month>/` | The raw archive. Held `2026-06`, `2026-07` | August was simply not yet fetched |
| `data/smogon-priors.json`, `-bo3.json` | Derived priors, built from July at cutoff 1630 | Untouched by me |
| `.github/workflows/smogon-stats.yml` | Cron `0 7 4 * *` and `0 7 11 * *` | **Was due to fire today** |

**August was not a missing capability. It was not yet due.** The cron fires on the 4th at 07:00 UTC;
Smogon's `Last-Modified` for the August files is `2026-09-01 23:16:45 GMT`, and the endpoint's clock
read `2026-09-04 07:00:23 GMT` when I fetched. I pre-empted the scheduled job by minutes. The fetch is
idempotent, so the workflow will find the files already present and commit the same bytes.

So the only thing written here is the one instrument that genuinely did not exist — see §3.

**Minor cosmetic defect, not fixed (not my files this session):** the workflow's commit messages read
`stats: archive Smogon monthly usage/moveset files ()` — the `MONTHS` sed in the commit step yields
empty. Two such commits exist (`89d86b93`, `c1e2ec2f`). Harmless; the archive itself is correct.

---

## 2. Which variant, and why

`usage/`, `moveset/` and `chaos/` all exist for August. I took **usage + moveset** and deliberately
left `chaos/` alone.

- **`moveset/`** already carries everything the brief wanted richness for: abilities, items, spreads,
  moves, teammates, and checks-and-counters with 95% intervals. It is what `smogon_priors.js` already
  parses. Taking chaos instead would mean a **second parser for the same fields** — the exact failure
  `engine/mc_key.js` documents (four hand-rolled species lookups, two of them wrong).
- **`chaos/`** is a JSON superset: I probed `chaos/gen9championsvgc2026regmb-1630.json` at
  **HTTP 200, 13,837,134 bytes**. Eight of those is ~110 MB into a git repo. Its genuine extra over
  moveset is exact integer counts and the unrounded tail, rather than rounded percentages.
- **Verdict:** chaos buys precision we have no question for. If a future question needs exact counts
  or the sub-0.001% tail, it is one fetch away and the URL pattern is recorded in the artifact.

`usage/` was taken because **nothing in ABRA had ever read it.** `smogon_priors.js` reads
`<month>/moveset/` and nothing else. The usage table is the only place the `Total battles` line lives
— the sample size behind every figure Smogon publishes — and it was being downloaded and ignored.

---

## 3. What I wrote

**`engine/smogon_coverage.js`** — one new script. It `require`s the existing fetcher's config door and
the existing parser; it reimplements neither. Three things it does that nothing did:

1. Parses the **usage table** (ranked rows, raw/real counts, `Total battles`).
2. **Checks the dump for legality** through `Dex.forFormat`, filtered
   `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`. Failures are reported, never dropped.
3. **Compares Smogon's species to our store's**, streaming, read-only.

**`data/smogon-coverage-2026-08.json`** — the artifact. 27,672 bytes. New file; merges into nothing.
`data/meta-usage.json`, `data/smogon-priors.json` and `data/smogon-priors-bo3.json` are untouched.

**`data/smogon-stats/2026-08/`** — 16 new raw files (8 usage, 8 moveset). All untracked/new.

Nothing was committed. `git status` confirms all three paths are `??`.

---

## 4. Verification — the file is our format, proven by content not by filename

The brief expected the header to carry month and format name. **It does not.** A Smogon usage header
is only two lines:

```
Total battles: 1269250
Avg. weight/team: 0.003
```

No month, no format string. The filename is the only label — which is exactly the situation the
"corpus contaminated" lesson warns about. So identity was established from content instead:

- **The SP fingerprint.** Champions runs a **66-point budget capped at 32 per stat**; mainline Gen 9
  runs 508 EVs capped at 252. Measured across **1,631 spreads** in the 1760 moveset file:
  `maxSpreadTotal = 66`, `maxSingleStat = 32`, **zero budget violations**. A mainline file dropped at
  this path would blow the budget on essentially every row. This is a Champions file.
- **Cutoffs are weightings, not subsets** — confirmed arithmetically. All four bo1 files report the
  identical `Total battles: 1269250`, identical `Raw` and identical `Real` columns; only
  `Avg. weight/team` (1.000 / 0.504 / 0.071 / 0.003) and `Usage %` move. The documented claim holds.
- **The tables are complete, not truncated.** Both formats end at rank 310 followed by a proper rule
  line.

| Format | Total battles | Species | Illegal | Not in dex |
|---|---:|---:|---:|---:|
| `gen9championsvgc2026regmb` (all 4 cutoffs) | 1,269,250 | 310 | **0** | 0 |
| `gen9championsvgc2026regmbbo3` (all 4 cutoffs) | 179,434 | 310 | **0** | 0 |

Both formats list the **identical 310-species set** (`comm` diff: 0 either-only, 310 shared). That
surprised me and I checked it rather than assuming a bug — it is real.

**The legality check was control-tested before its zero was believed.** A green check that cannot go
red is a check asking nothing. Fed known-illegal entities it fires correctly:

| Probe | `isNonstandard` | tier | verdict |
|---|---|---|---|
| Amoonguss | `Past` | Illegal | **ILLEGAL** |
| Baxcalibur | `Past` | Illegal | **ILLEGAL** |
| Kingambit | `null` | OU | LEGAL |
| Charizard-Mega-Y | `null` | UUBL | LEGAL |

Filtered legal species in the format: **347**. Unfiltered `.all()`: **1,517** — the National Dex
wearing the format's name, as CLAUDE.md says.

---

## 5. The join nearly fabricated a finding, and this is the part worth reading

`durable-ingest.js` **collapses every mega and primal forme to its base species** in `six`/`brought`/
`lead`, because team preview only shows the base (its `baseForme()`). Smogon lists `Charizard-Mega-Y`
as its own row.

A naive join of Smogon's species against our store's `six` therefore reports:

> **71 species Smogon sees that our store has never seen** — including **Charizard-Mega-Y at rank 6
> with 26.52% usage**.

That number is measured, and it is **entirely an artifact of the join**. All 71 are mega formes
(`charizardmegay`, `blastoisemega`, `gengarmega`, `metagrossmega`, …). Reported as-is it would have
been a fabricated claim about roughly a quarter of this format's usage.

The store's `sets` map *does* keep the battle forme. The correct seen-set is the **union of `six` and
the keys of `sets`**, and the artifact records both halves separately so the next reader can see which
one carried a species.

**Against the union, the answer is 0 at every cutoff in both formats.** The join was control-tested in
both directions: a fabricated key (`zzznotamon`) correctly returns unseen, and the `six`-only join
correctly returns 71 — so a zero here means zero, not a join that matches everything.

---

## 6. What it says at a glance — top species, 1760 cutoff

Bo1 `gen9championsvgc2026regmb-1760` (1,269,250 battles):

| # | Species | Usage % | Raw |
|---:|---|---:|---:|
| 1 | Kingambit | 47.24 | 687,654 |
| 2 | Incineroar | 33.56 | 625,939 |
| 3 | Garchomp | 32.18 | 601,412 |
| 4 | Basculegion | 31.49 | 519,208 |
| 5 | Sneasler | 31.37 | 534,497 |
| 6 | Charizard-Mega-Y | 26.52 | 336,895 |
| 7 | Sinistcha | 26.05 | 663,058 |
| 8 | Whimsicott | 23.51 | 565,067 |
| 9 | Farigiraf | 18.48 | 515,907 |
| 10 | Sylveon | 18.36 | 316,224 |

Bo3 (open-team-sheet) `-1760` (179,434 battles) top 5: Kingambit 55.70, **Charizard-Mega-Y 50.46**,
Garchomp 45.00, Incineroar 42.30, Basculegion 40.39.

**The two populations are not the same metagame.** Charizard-Mega-Y goes 26.52 → 50.46 between the
closed-sheet bo1 ladder and the open-sheet bo3 ladder. That is the same shift `engine/corpus_shift.js`
already measured on our own corpora, now confirmed on 1.4M battles rather than a couple of thousand
games. Anything fitted on one population and deployed on the other inherits that gap.

---

## 7. Our store against the ladder

Scanned read-only: `data/games.ladder.jsonl` (**76,833** games) and `data/games.bo3.jsonl`
(**25,522** games) = **102,355** games. **Zero unparseable lines**, and **neither file's mtime moved
during the scan**, so this is not a torn read.

- **Distinct `six` keys: 361. Distinct `sets` keys: 438. Union: 443.**
- **Species Smogon saw that we never have: 0.** Our sample covers the whole ladder's species pool.
- **Species we hold that Smogon's table does not list: 133.**

That 133 splits cleanly and the split is the finding:

**48 are legal Reg M-B cosmetic or battle-only formes** that Smogon collapses — the entire Vivillon
pattern set, the Alcremie creams, Florges colours, Furfrou trims, plus `aegislashblade`,
`palafinhero`, `mimikyubusted`, `morpekohangry`, `sinistchamasterpiece`, `mausholdfour`, the Castform
weather formes. Expected. Not a defect.

**85 are `isNonstandard: 'Past'` and cannot legally appear in Reg M-B** — including `amoonguss`,
`baxcalibur`, `fluttermane`, `chienpao`, `greattusk`, `ironvaliant`, `landorustherian`, `melmetal`,
`diancie`, `genesect`, and both Ogerpon masks. One is `'Future'` (`baxcaliburmega`).

**This is the already-settled "corpus contaminated by custom-rule games" finding, re-measured — not a
new defect.** It is on record in memory as SETTLED. What is new is a clean count (85) and the
direction of the surprise: **the external dump is clean and our own store is not.** The usual
suspicion runs the other way.

I did **not** chase it. It touches OPS/the store, which I was told not to modify, and the two live
agents own `data/`.

---

## 8. Honest limits

- **This is a PRIOR.** CLAUDE.md ranks usage sources below the Showdown damage calculator and
  HoopaDex learnsets. It is AGGREGATE — it describes a population, never a game, and cannot be joined
  to a replay.
- **The store figures are a snapshot.** OPS appends hourly; `games.ladder.jsonl` was last written
  `2026-09-04T05:30:37Z`. The same query an hour later is a different sample, per the store-moves rule.
- **Nothing here ran a game**, and no artifact another process owns was written or read mid-write.
- **The 0-unseen result is about species identity only.** It says our sample covers the ladder's
  species pool. It says nothing about whether our *usage rates*, item spreads or set distributions
  match — that comparison is not made here and should not be inferred from it.

---

## 9. Should it feed anything downstream?

**No. It sits as a comparison set.** That is the recommendation.

The derived-priors path already exists and is already wired: `smogon_priors.js` →
`data/smogon-priors.json` / `-bo3.json`, rebuilt by the cron. That path is enough, and it is the one
thing that should consume August — automatically, when the workflow runs. `smogon-coverage-2026-08.json`
is an audit artifact: it answers *is the dump what it claims, and is our sample representative*, and
those are one-off questions, not model inputs.

**If it were ever to feed something, three things would have to be true first:**

1. **The population would have to be named at the consumer.** bo1 and bo3 are different metagames —
   Charizard-Mega-Y at 26.52% vs 50.46% — and a consumer that does not declare which it read is wrong
   half the time with nothing to notice. `smogon_priors.js` already enforces this by writing to
   separate files; anything new must too.
2. **The cutoff would have to be a declared choice, not a default.** A cutoff is a *weighting*, not a
   filter. "1760" means "weighted toward strong play", never "only strong players", and quoting a
   1760 figure as a high-ladder subset is a category error.
3. **MEDICHAM's quarantine would have to be respected.** Anything downstream of the simulator cannot
   consume a new prior and then be compared against a pre-change baseline. Feeding a fresh prior into
   a quarantined model produces a number that is neither old nor new.

---

## OWED

- **Nothing is committed.** `engine/smogon_coverage.js`, `data/smogon-coverage-2026-08.json` and
  `data/smogon-stats/2026-08/` (16 files) are on disk and untracked, per the brief. A publisher must
  land them.
- **Living-docs obligation is unmet and is owed by whoever commits.** A new `engine/` script plus a
  new artifact requires, in the same pass: a CHANGELOG entry with a version bump, the matching
  division ledger (this is **OPS** — ingest and the store), and `node engine/status.js --write`. I did
  not touch `docs/` beyond this report because the brief forbade it.
- **The scheduled `smogon-stats` workflow will fire and commit the same 16 raw files.** Bytes are
  identical (the fetch is idempotent), so this should be a no-op — but if a human commits the raw
  archive by hand first, expect the bot's commit to be empty rather than conflicting. Worth one look
  at the next workflow run rather than assuming.
- **The workflow's commit message loses its month list** — `files ()` instead of `files (2026-08)`.
  One-line sed fix in `.github/workflows/smogon-stats.yml`. Not mine to touch this session.
- **No register row exists for any of this.** Per the UNREGISTERED rule, a defect an instrument
  measures with no roadmap row is itself a gap: the 85 illegal species in our store are now *measured*
  by `smogon_coverage.js` and are registered nowhere.
- **Not investigated, deliberately:** whether the 85 illegal store species are custom-rule games, a
  format-tag error in ingest, or legitimately-labelled non-Reg-M-B rows. That is OPS's call and the
  store was off-limits this session.
- **`chaos/` was not fetched.** Confirmed available (HTTP 200, 13.8 MB for one cutoff). If exact
  integer counts or the sub-0.001% tail are ever needed, that is the source.
