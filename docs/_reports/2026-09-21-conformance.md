# Conformance: 19 regressions -> 11, and a ratchet clause that was laundering three of them

*2026-09-21. MEASURE. Worktree `agent-aab49a7f61782d538`, HEAD `89341c1a`.*

`node engine/conformance.js` at HEAD in this worktree opened at **19 regressions + 3 discoveries**
and closes at **11 regressions + 0 discoveries**. Every one of the 11 remaining is S13 and every one
is about an ARTIFACT'S PROVENANCE, not about code.

---

## 0. Read this first: the brief's numbers and mine are different runs

The dispatch quoted **31 regressions** with a shape of `15 x "no generator writes it"`,
`2 x "generated but does not say so"`, `4 x S12 names`, `2 x S12 hardcodes`. This worktree at
`89341c1a` reports `7 / 8 / 4 / 0`. The two runs are not comparable and I did not try to reconcile
them: the last commit (`89341c1a`, "Eight of the seventeen reds close") moved conformance subjects,
and the `data/` directories differ by three files (`diff-team-pool.json` plus two `_scratch-*` dumps,
all present only in the main checkout). **I worked the run in front of me.** The main checkout should
be re-run after this lands; nothing here depends on which of the two numbers was right.

**I did not run anything in the main tree.** Its `data/conformance.json` is already modified there.

---

## 1. The instrument was wrong in three places. Each is a fact, not a convenience.

### 1a. `new_at_seed` was being overridden by a rule-digest change — a live laundering hole

`classify()` asked *"did this standard's rule move?"* BEFORE it asked *"was this finding already
outstanding at the split seed?"*. A seeded finding is on an unchanged subject **by definition** — it
was already violating when the seed was taken — so the DISCOVERY branch claimed every one of them the
instant anybody edited that standard's rule. DISCOVERY is **not fatal** and is **adopted into the
baseline**, so a green run would have buried them permanently.

It was not hypothetical. The opening run of this session printed:

```
  DISCOVERY (3) — the checker got BETTER; these subjects did not move.
    + S13 | data/battle-formes.json | no generator writes it
    + S13 | data/conditional-audit.json | no generator writes it
    + S13 | data/policy-weights-nopop.json | no generator writes it
```

All three are listed in `data/conformance-baseline.json`'s `new_at_seed`, seeded
**2026-08-11T11:08:11.939Z**, and the file's own comment beside that array says they *"still fail —
the split was never a way to make them go away."* The ordering contradicted the comment.

**Fixed** by moving the `new_at_seed` test above the rule-digest test. `new_at_seed` is a recorded
fact about those exact keys; a rule digest is evidence about everything else. The fact wins. The
three are now REGRESSION, with the reason *"it was ALREADY new when --seed-split installed the split
... Triage it on its merits."*

### 1b. "generated but does not say so" was measuring KEY ORDER

```js
const body = read(D('data', file)).slice(0, 400);
const saysGenerated = /GENERATED|generated|do not hand-edit|provenance/i.test(body);
```

Seven of the eight files this flagged **do** declare their origin, at top level, in the exact shape
`engine/provenance.js`'s `declaredWriter` arm reads:

| file | what it declares | why the peek missed it |
|---|---|---|
| `replay-differential.json` | `by: engine/replay_differential.js` | a `source_digests` block sits above it, past byte 400 |
| `replay-differential-bo3.json` | same | same |
| `replay-differential-sheets.json` | same | same |
| `replay-differential-bo3-freezes.json` | same | a long `note` above it |
| `replay-differential-sheets-freezes.json` | same | same |
| `pp-board-probe.json` | `generated: <iso>` | it is the LAST key |
| `artifact-rerunnable-baseline.json` | `by: tests/test-artifact-rerunnable.js --stamp` | inside 400 bytes, but the word "generated" is not |

Reorder the keys and the same file passes. That is not a property a standard should depend on.

**Fixed** by asking the artifact's declaration KEYS — the same key set `provenance.js` already uses,
not a second list — with the textual header still honoured first for `data/*.js` bundles.

**It is a tightening as well as a loosening, and it caught one.** `data/pory-nn.json` passed the old
peek only because the string `engine/provenance.js` appears inside its `population_ceiling_note`
footnote. It declares no origin at all. That is a true finding and it is now raised.

### 1c. The subject digest did not go through the normalising door, so the split is not reproducible across checkouts

`conformance.js` opens with *"EVERY READ IN THIS FILE GOES THROUGH THE NORMALISING DOOR"*. `sha()`
did not — it called `run_stamp.js`'s `sha12`, which digests raw bytes. Measured today:

```
                                base(=main)     worktree raw    worktree LF-normalised
data/replay-differential.json   4d0c9b22579c    1094c0895700    4d0c9b22579c
data/meta-nash.json             7de445796b0d    faf96d55c53f    7de445796b0d
data/raw-log-census.json        f5c1deaaa0ec    a231907c4070    f5c1deaaa0ec
```

`core.autocrlf` is `true`. The main checkout holds `data/*.json` with **LF** — they are written there
by their generators and never re-checked-out. A `git worktree add` checkout holds the same blobs with
**CRLF**. So **every data subject read as CHANGED** when the scan ran from a worktree, and four
findings were printed with the reason *"the subject file changed since the baseline"* about files
that had not moved a byte since 2026-08-11.

The verdicts were right — a mismatched digest reads as REGRESSION, never DISCOVERY, so nothing was
blessed — but the reasons were fiction. **Fixed** at the digest. Cost, stated plainly: during the
transition, files that happen to be CRLF in the main checkout now read as changed instead, which is
what turned `pory-nn.json` from a non-fatal DISCOVERY into a fatal REGRESSION. The scope map is
rewritten with normalised digests on the first clean run, and the two checkouts agree from then on.

---

## 2. The subjects that were fixed

### S12 — all four closed, two of them because the checker was wrong

| subject | what it was | what closed it |
|---|---|---|
| `engine/human_protect_ruler.js` | FALSE POSITIVE, 4 of 4 hits | `\b` treats `-` as a boundary. All four hits were its own output path `data/human-protect-ruler.json` and the phrases `protect-family` / `protect-amplification` inside report strings. The file never names a move to the engine. A dex id here is `[a-z0-9]+` (`screen_tags.js`'s `norm`), so a name beside a `-` is prose, never a reference. |
| `engine/screen_tags.js` | 1 hit, in dead-by-default code | The only occurrence is `/reflect\|screen\|veil/i` inside the `PROSE()` branch — the RETIRED shortDesc derivation, preserved verbatim so `ABRA_TAGDEX_SCREENS_FROM_PROSE=1` reproduces the pre-fix reads. Hoisted into a declared `GAME_RULES` block. Deriving it would defeat the knob: a before/after must restore what the old code actually did. |
| `engine/pp_board_probe.js` | 3 real names | A probe's fixture is CONSTRUCTED, not found. `GAME_RULES = { MOVE, AIMED, PRESSURE, CONTROL_ABILITY }`, each with its reason; `MOVE`'s maxpp is still READ from `data/tags.json` and still THROWS if the row is missing. Probe re-run: **GREEN**, identical table. |
| `engine/stage_planner.js` | 17 sites | `GAME_RULES = { GUARD, INERT, HAIL_SCREEN, PRIORITY_STATUS_ABILITY }` and every site rewired to reference it. `tests/test-stage-planner.js`: **GREEN**, 109.2 s, every red demonstration still fails its clause. |

### S13 — eight "generated but does not say so" closed by 1b, one by a new void clause

`data/medicham-bench.json` is the one file 1b does not reach, and it is the one file no action could
ever reach. It carries `void: true` and a `void_reason` recorded 2026-08-27: its roster named a
species that is not in this regulation, `buildMon` returned null silently, 120 games ran against a
hole, and *"the benchmark cannot run at all until it is re-recorded."* Its writer
`tests/bench-medicham.js` has stamped `generated_by` since that same day — the defect is already
fixed at the only place a fix can live, and **no future run will ever restamp this copy.**

A finding no action can close is the shape this project has twice normalised into "known failure".
So: a **self-declared `void: true` artifact is skipped by the header clause only**. `void` is already
a first-class declaration here — `provenance.js` honours it and reports VOID separately from UNSAFE —
and it is a *stronger* statement than "do not hand-edit": it says the contents must not be quoted at
all. Checked, not trusted (the file must actually carry `void === true`), printed on every run beside
the scratch list, and it does **not** excuse "no generator writes it": *nobody wrote this* and *this
was withdrawn* are different claims.

### Writers that take their output path from a flag — attribution made discoverable, not exempted

Four writes could not be attributed because no literal path reaches them. Each now stamps `by` into
its own payload, which is the arm `provenance.js` already resolves:

- `engine/game_differential.js` — the `--dump-out` write (`data/divergence-middle.json`)
- `engine/all_mechanics_fire.js` — the `--out` write (`data/all-mechanics-fire.boardstate.json`)
- `engine/conditional_audit.js` — the `--json` write (`data/conditional-audit.json`); `--json` is the
  only way this file is ever written, so no literal existed at all
- `engine/pory_nn.py` — adds `by` + `generated` (`data/pory-nn.json`)

**The copies on disk still lack it.** They predate the line and clear on their next run. I did not
hand-stamp them: editing a generated artifact to make a gate green is the move the brief warns about,
and none of the four can be regenerated here (two are heavy MEDICHAM instruments whose re-run would
overwrite another division's evidence with a different sample, one needs a self-play store, and
PORYGON2 is quarantined).

---

## 3. What remains: 11, all S13, all artifact provenance

| # | artifact | status | what closes it | age |
|---|---|---|---|---|
| 1 | `all-mechanics-fire.boardstate.json` | writer fixed | next `--out` run | new since seed |
| 2 | `conditional-audit.json` | writer fixed | next `--json` run | pre-seed |
| 3 | `divergence-middle.json` | writer fixed | next `--dump-out` run | new since seed |
| 4 | `pory-nn.json` | writer fixed | next PORYGON2 fit — **quarantined**, so not soon | pre-seed |
| 5 | `battle-formes.json` | **no generator has ever existed** | a generator. See below. | pre-seed |
| 6 | `meta-nash.json` | no generator; says so | a generator, or stop the site reading it | pre-seed |
| 7 | `exploitability-holdout.json` | generator never committed | the ad-hoc script, or a declaration | pre-seed |
| 8 | `policy-weights-nopop.json` | frozen fit variant | joins its five baselined siblings, or a generator | pre-seed |
| 9 | `policy-weights-pre-censoring.json` | frozen incumbent copy, cited BY DIGEST in `censoring_value.js` | as above | pre-seed |
| 10 | `raw-log-census.json` | one-shot census; declares `by: "ROADMAP #134 …"`, which is not a script | nothing in code reads it | pre-seed |
| 11 | `smogon-priors.observed.json` | written by a `cp` in `.github/workflows/smogon-stats.yml` | **OPS** — outside the dirs the graph scans | new since seed |

**Eight of the eleven predate this week**, seven of them listed in `new_at_seed` from 2026-08-11. The
brief's "nearly all from artifacts and code that landed in the last day" does not hold for this run:
three artifacts are new since the seed, and the four S12 items (all closed) were the new code.

### I exempted nothing on this list, and here is why each was refused

The parent named a legitimate category — a one-shot finding, not standing state. Only **#10** fits it
cleanly (nothing in `engine/`, `build/`, `tests/`, `web/` or `app/` reads `raw-log-census.json`; only
`provenance.js`, which enumerates every data file). I still did not exempt it, because the existing
mechanism for that category is the `_`-prefix scratch skip, which turns on a DECLARED INTENT in the
filename, and widening it to "any file no code reads" would also skip `policy-weights-all.json` and
its four siblings and `miltank-timing-r6.json` — retiring five baselined findings on a rule about
readership rather than about generation. Renaming the file is not available to me: it is not mine,
and this division does not move files it did not create.

The other ten are **true** S13 findings and several are live:

- `battle-formes.json` is the sharpest. It maps battle-only formes to base species and it is read by
  `engine/durable-ingest.js` — the store parser. It was derived once, on 2026-07-24, from
  `https://play.pokemonshowdown.com/data/pokedex.json`. If Showdown adds a forme, this file goes
  stale silently and the store mis-keys a species. That is S13's exact failure mode, and it is the
  highest-value item on this list. A generator is buildable from the local checkout (`battleOnly`),
  but it is ENGINE work with a store-keying blast radius, not a drive-by in a conformance pass.
- `meta-nash.json` is read by `web/index.html`, `app/index.html` and `engine/sanity_check.py`. It has
  no generator and honestly says so. Live state with no generator is the thing S13 is about.
- `exploitability-holdout.json` is quarantined and is read by `tests/test-web-figures.js`.

---

## 4. Baseline

**Not rewritten.** The ratchet refuses while anything is a regression, which is correct, and is why
the 28 genuine fixes in the FIXED list have not yet left it. `data/conformance.json` (the scan's own
report) and `data/pp-board-probe.json` (rewritten by the GREEN probe re-run) are the only artifacts
this pass touched.

## 5. Checks run

| check | result |
|---|---|
| `tests/test-stage-planner.js` | GREEN, 109.2 s (needs `SHOWDOWN_PATH`) |
| `engine/pp_board_probe.js` | GREEN, identical table and counters |
| `tests/probe_tag_derivation_without_prose.js` | all checks passed; membership unchanged |
| `tests/test-no-silent-failure.js` | 0 new (the two catches I introduced were rewritten to speak) |
| `node --check` on all six edited JS files, `ast.parse` on the Python | clean |

**This worktree has no reachable Showdown checkout** — `engine/showdown_path.js` resolves `null`, so
anything needing the dex must be run with
`SHOWDOWN_PATH=/c/Users/willj/Projects/Pokemon/pokemon-showdown`. That is a property of the worktree,
not of these changes.

---
---

# PASS 2 — 2026-09-21, after the merge into main

## 6. The "38" and the "11" are different lines of the same report

The coordinator's re-run in main was read as *"the number is bigger, not smaller"*. It is not. The
quoted reason-split is

```
   4  the subject file changed since the baseline
   4  it was ALREADY new when --seed-split installed the split (2026-08-11T11:08:11.939Z)
   3  the subject was not in the previous scan — new code must conform
```

which sums to **11**, and 11 is the `RATCHET BROKEN` count — the number that decides the exit code.
The worktree run at the same moment produced the same **4 / 4 / 3** on the same eleven subjects. The
`38` is a count of some other block of the report (the standing findings), not of the failures.

**Verified rather than assumed**, because "main has more files" was my own prediction last pass and it
had to be checked before it was used again: main's `data/` holds **311** `.json`/`.js` files against
the worktree's **308**, and the three extras are `_scratch-bench-smoke.json` and
`_scratch-scovillain-dump.json` (both `_`-prefixed, so S13 skips them and prints that it did) and
`diff-team-pool.json`, which is named by a literal at `engine/diff_swarm.js:304`
(`const POOL_CACHE = D('data', 'diff-team-pool.json')`) **and** carries
`by: "engine/diff_swarm.js loadTeams"`. It is not a finding under either arm. So main's judged-subject
set yields the same eleven, and nothing in the increase is main having files the worktree did not.

## 7. The ordering fix was SHOWN, not argued

The coordinator asked me to confirm rather than assume that the four *"ALREADY new when --seed-split"*
rows would have been non-fatal DISCOVERIES under the old `classify()` order. I put the old order back,
ran the scan, and put it back again:

```
OLD ORDER:  RATCHET — 96 baselined, 11 new (7 regression, 4 discovery), 28 fixed
            DISCOVERY (4) — the checker got BETTER; these subjects did not move.
              + S13 | data/exploitability-holdout.json | no generator writes it
              + S13 | data/meta-nash.json               | no generator writes it
              + S13 | data/policy-weights-pre-censoring.json | no generator writes it
              + S13 | data/raw-log-census.json          | no generator writes it

NEW ORDER:  RATCHET — 96 baselined, 11 new (11 regression, 0 discovery), 28 fixed
```

**Confirmed, with one correction to the strength of the claim.** A DISCOVERY is adopted into the
baseline only on a run with no regressions, so those four would not have been buried on *that* run —
seven regressions stood beside them. The hole is one step later and it is still a hole: the moment the
other seven were fixed, the first clean run would have adopted all four permanently, and they could
never have been raised again. The count going up is the gate declining to forgive itself, and that is
the right direction.

## 8. `fit_policy.js` DOES write those paths — from an environment variable, not a flag

Read as instructed, and the answer is in two lines:

```js
engine/fit_policy.js:60    const OUT = process.env.OUT_WEIGHTS ? require('path').resolve(process.env.OUT_WEIGHTS) : D('data', 'policy-weights.json');
engine/fit_policy.js:1384  if (process.env.OUT_WEIGHTS) fs.writeFileSync(OUT, payload);
```

So *"no generator writes it"* is **false** for these artifacts, and the scan is right that it cannot
tell that apart from "no script exists".

**But the suggestion is still not an attribution, and the evidence splits the seven into two groups.**
I compared every `policy-weights-*.json` against the shipped `data/policy-weights.json` key for key:

| artifact | keys vs. shipped (16) | `corpus` train/test | reading |
|---|---|---|---|
| `-all` | 15, missing `fitEnvironment` | 185,644 / 22,675 | a distinct FIT |
| `-julyonly` | 15, missing `fitEnvironment` | 108,156 / 22,675 | a distinct FIT |
| `-multiturn` | 15, missing `fitEnvironment` | 165,836 / 41,550 | a distinct FIT |
| `-nomt` | 15, missing `fitEnvironment` | 165,836 / 41,550 | a distinct FIT |
| `-nopop` | 15, missing `fitEnvironment` | 159,634 / 39,838 | a distinct FIT |
| `-presheet` | 15, missing `fitEnvironment` | 183,679 / 45,660 | a distinct FIT |
| `-pre-censoring` | **16, complete** | 185,560 / 46,162 | **a preserved COPY**, per `engine/censoring_value.js:121` — *"It is preserved as data/policy-weights-pre-censoring.json"*, cited there by `sha12 01bc43936324` |

Six carry `fit_policy.js`'s exact key set minus one key added later, each with its own `generated`
stamp and its own train/test split — six separate runs of one ablation, not six copies. The seventh is
key-complete and is documented as a copy taken by a person. **Those are two different origins and
lumping them under one attribution would have been the error the scan's `SUGGESTIVE ONLY` label exists
to prevent.**

- `-joint` and `-joint-presheet` are `fit_joint.js`, not `fit_policy.js` — they carry `ranker`,
  `jointFeatures`, `topK`, and `fit_joint.js` already stamps `source: 'engine/fit_joint.js'`, which
  `provenance.js` reads. No change needed there.

**Made discoverable**: `fit_policy.js` now stamps `by: 'engine/fit_policy.js (OUT_WEIGHTS=<path>)'`
into the payload **on the flagged path only** — the default path keeps the key set the shipped model's
readers expect, and is attributed by its own literal. The seven on disk predate the line. Each would
clear only by re-fitting that arm to that path, which is a refit of an August ablation and nobody
should run one to satisfy a scan. **None was hand-stamped, and the suggestion was not promoted.**

## 9. `data/battle-formes.json` — CLOSED, and it was derivable exactly

The decision: **a script that re-derives it.** It is not a one-shot and it does not belong outside
`data/` — it is a live input to `engine/durable-ingest.js`, the store parser.

The measurement that made the decision easy, taken before anything was written:
`species.battleOnly` on the pinned checkout reproduces the hand-built map **131 of 131 — zero rows
missing, zero extra, zero disagreements.** So `engine/build_battle_formes.js` is a RESTAMP, not a
refit: the feature function is unchanged and no figure moves. Confirmed after writing it, `--check`
first and then for real — the `base_of` block is byte-identical (`sha12 baa1e686d491` before and
after) and the artifact now declares `by: engine/build_battle_formes.js`.

**The walk is deliberately unfiltered and the generator says so in capitals**, because the next person
to read `CLAUDE.md`'s filter rule will want to "fix" it. Measured: `x.exists && !x.isNonstandard &&
x.tier !== 'Illegal'` keeps 83 of the 131 and **drops 48** — every Mega and Primal of a species outside
this regulation, and `cherrimsunshine`. This artifact answers *"a replay log just said this forme name,
what species is that"* for an append-only store that spans regulations, so those 48 are not tightening,
they are 48 silent mis-keys falling through to a regex (`/^(.*?)(mega[xy]?|primal)$/`) that knows about
megas and primals and nothing else. The filter rule is right for what it was written about — what may
be BUILT, what may be RECOMMENDED — and this is a different question.

`--check` exists so the drift is detectable without a write, and the builder refuses to write a map of
zero.

## 10. Where it stands: 11 → 10, and what closes each

| artifact | state | what closes it | whose |
|---|---|---|---|
| ~~`battle-formes.json`~~ | **CLOSED** — generator written, map byte-identical | — | done |
| `all-mechanics-fire.boardstate.json` | writer stamps `by` | one `--out` run | ENGINE |
| `divergence-middle.json` | writer stamps `by` | one `--dump-out` run | ENGINE |
| `conditional-audit.json` | writer stamps `by` | one `--json` run; needs a self-play store | MEASURE |
| `pory-nn.json` | writer stamps `by`+`generated` | the next PORYGON2 fit | MEASURE — a refit, so **ask Will** |
| `policy-weights-nopop.json` | `fit_policy.js` now stamps on the `OUT_WEIGHTS` path | re-fit that ablation arm to that path | a refit; not worth one |
| `policy-weights-pre-censoring.json` | a preserved COPY, not a fit — see §8 | a declaration recording that it is a copy of a named digest, or nothing | **needs a decision** |
| `exploitability-holdout.json` | generator never committed; quarantine-era | commit the script, or record it as unreproducible | SEARCH |
| `meta-nash.json` | no generator; read by `web/index.html`, `app/index.html`, `engine/sanity_check.py` | a generator — but re-deriving an equilibrium MOVES a published figure, so it is a refit | **needs a decision** |
| `raw-log-census.json` | one-shot census; nothing in code reads it | a census generator — re-running supersedes the frequencies it was written to make checkable | **needs a decision** |
| `smogon-priors.observed.json` | written by `cp -f` in `.github/workflows/smogon-stats.yml:65` | one line: give `engine/smogon_priors.js` an `--observed` write and drop the `cp` | **OPS** — I did not edit the ingest workflow |

Still exempted: nothing beyond the `void: true` clause in §2. The five rows marked *needs a decision*
are each a **measurement**, not a cleanup — every one of them either moves a published figure or
re-runs a fit — and MEASURE's own rule is to ask before starting one.

## 11. Checks run in pass 2

| check | result |
|---|---|
| ordering fix, old order restored and re-run | 7 regression + 4 discovery, then restored to 11 + 0 |
| `engine/build_battle_formes.js --check`, then the real write | 131/131, no row moved; `base_of` sha12 `baa1e686d491` unchanged |
| `node --check` on `fit_policy.js`, `build_battle_formes.js` | clean |
| `tests/test-docs-current.js` | 39 passed, 0 failed |
| `tests/test-no-silent-failure.js` | 0 new |

## 12. Three artifacts were reverted, because a worktree must not write an absence as a fact

`engine/provenance.js --strict` rewrote `data/provenance-stamp.json` during the gate sweep and moved
its ratchet **`mtime_only` 179 → 178 and `verified` 4 → 3**, dropping `_scratch-bench-smoke.json`,
`_scratch-scovillain-dump.json` and `diff-team-pool.json` from its lists. Those three exist only in
the main checkout. Nothing about the tree got better or worse — a smaller `data/` was recorded as a
lower floor, and `verified` going DOWN would have published a worse ratchet derived from an incomplete
tree. That is the same failure the brief names for `status.js --write`, arriving through a different
tool, so it is reverted rather than shipped.

Reverted for the same reason, being incidental to verification runs and rewritten by any run in main:
`data/conformance.json` and `data/pp-board-probe.json`. The only `data/` file this pass ships is
`data/battle-formes.json`, whose map was proved byte-identical.

**A ratchet artifact written from a worktree is not comparable to one written from main.** Worth
noting beside §1c: that is the same class of defect as the raw-bytes subject digest, one level up.
