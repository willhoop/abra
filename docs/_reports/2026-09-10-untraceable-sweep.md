# The 42 untraceable figures in the living documents — resolved one at a time

**2026-09-10, MEASURE.** Phase 3 work that depends on no re-run. Documents only: nothing under
`engine/`, `data/` or `tests/` was edited by hand, and an ENGINE agent was measuring in the same tree
throughout. `data/docs-currency-baseline.json` moved once, downward, written by the gate itself.

---

## The number

| | before | after |
|---|---|---|
| UNTRACEABLE, five living documents | **42** | **8** |
| UNTRACEABLE, whole corpus | **56** | **22** |
| `docs/MODELS.md` | 29 | 3 |
| `docs/ABRA-whitepaper.md` | 11 | 5 |
| `docs/ABRA-technical-docs.md` | 1 | 0 |
| `docs/SUMMARY.md` | 1 | 0 |
| figure-level edits owed to the major | 65 | 31 |
| citation mismatches | 23 | **23** (unchanged) |
| retraction violations | 0 | **0** (unchanged) |
| `node tests/test-docs-current.js` | 35 passed / 0 failed | **35 passed / 0 failed** |

**25 re-derived, 9 struck, 8 handed back.** The 23 STALE CITATIONS were not touched: most are answered
by the re-run of the 40 LIFT artifacts, and re-citing them now is work done twice against numbers that
are about to move.

**No re-run was needed for any of the 42.** Every re-derivation is a `git show` away from being checked.

---

## 1. RE-DERIVED — 25 figures, each read back out of the blob the run wrote

A match is not a citation. Every one of these was confirmed by **parsing the historical blob and
reading the named key**, never by finding the digits inside it. That distinction is the whole of
`docs/_reports/2026-09-10-models-orphan.md`, and it is why each row below names a FIELD.

| figure | where it stands | the receipt | what the artifact claims |
|---|---|---|---|
| **7,184** (×4) | white paper, technical docs, `SUMMARY.md`, `MODELS.md` — one folded WIRE 138-140 paragraph | `git show a39a33ce:data/tags.json` | `moves.partingshot.uses` = 7184 |
| **−5.054**, **−3.989** | white paper ×2, `MODELS.md` | `git show c1566ee1:data/policy-weights-joint.json` | `jointFeatures` weights `spreadFreeBesideAlly` −5.054471, `terrainSetupHelpsPartner` −3.989105, 48-feature fit generated 2026-07-28, `lambda` 0 |
| **−4.986**, **−4.125** | `MODELS.md` withdrawal block | `git show b030ca03:data/policy-weights-joint.json` | the same two keys at −4.986332 and −4.125228, 56-feature fit of 2026-07-31 |
| **63,305** | `MODELS.md` | `git show fc7e76ce:data/policy-weights-joint.json` | `corpus.pairs` = 63305, the fit whose three weights read +0.863392 / +2.004697 / +0.110014 |
| **66,520**, **14,995** | `MODELS.md` | `git show 52645850:data/policy-weights-joint.json` | `corpus` = games 7454 / pairs 81515 / heldOut 14995; 66,520 is the train remainder |
| **1.544** (×2) | `MODELS.md` PORY block | `git show 44e0fb03:data/pory-eval.json` | `n_games` 7381; `weights` over `feat_std` reduce to alive_diff 1.25607, hp_diff **1.54359** |
| **1.0259**, **1.4347** | `MODELS.md` | `git show 7f74236e:data/pory-eval.json` | `n_games` 1421, reducing to 1.02589 / 1.43471 |
| **−0.28071**, **0.629799**, **0.629778**, **−0.000013** | `MODELS.md` | `git show 8e2dc0a7:data/pory-eval.json` | `n_games` 4623; `weights[4]` = −0.28071, exactly antisymmetric to `weights[3]`; the paired-tie block |
| **52,966**, **13,263**, **10,480**, **10,440** | `MODELS.md` META-USAGE | `git show ba117b14:data/meta-usage.json` | `views.ladder.sampledTeams` = 52966; `provenance.funnel` = 39792 → 13263 → 10480 → 10440 → 9759 → 7123 |

### Three findings that fell out of the verification

**(a) `7,184` was a different quantity, and 3.87.0 guessed it might simply be wrong.** It is right. It
is Parting Shot's use count ALONE (`moves.charm.uses` is 1252 in the same blob), while the sentence
now carries the Charm + Parting Shot sum of 10,535. The change record of 3.87.0 flagged it as possibly
wrong and left it — *"Not ENGINE's figure to author or delete."* It was neither.

**(b) `MODELS.md` carries two different "before" values for one feature and does not contradict
itself.** `spreadFreeBesideAlly` is −5.054 in one paragraph and −4.986 in the withdrawal block below
it. They are two different fits — 48 features on 2026-07-28 (`c1566ee1`) and 56 features on 2026-07-31
(`b030ca03`). This looked like a documentation defect and is not one; both commits are now named on the
page so the next reader does not re-open it.

**(c) 5.279.0 re-derived 1.256 / 1.544 and the figure stayed untraceable, for a reason worth keeping.**
That pass recorded the pair in the CHANGELOG as **1.2561 / 1.5436**. The document writes **1.256 /
1.544**. `changelogHas` compares `Number(value).toFixed(6)` exactly, so the trace missed by one digit.
**A trace has to carry the digits the document wrote**, because the census compares at the document's
own precision.

---

## 2. STRUCK — 9 figures, none of them shown to be wrong, none of them recoverable

Struck in place, with the reason on the line. A caption is not a quarantine.

| figure | where | why it cannot be sourced |
|---|---|---|
| ~~**24,997 of 82,483**~~ joint turns (×5 sites: white paper, `MODELS.md` ×2) | DODUO / joint fit | Counters `engine/fit_joint.js` PRINTED. **All 18 revisions of `data/policy-weights-joint.json` were parsed; none holds either value**, and the file carried no `matching` block at all before 2026-08-02. |
| ~~**37,460 (15.95%)**~~ and ~~**16,177 (50.47%)**~~ | white paper | The paragraph itself said on 2026-08-15 that no artifact backs either. It printed them in order to say they were withheld; they are now struck, which is what the rule asks for. Both cells struck WHOLE — half a struck cell still reads as a figure. |
| ~~**10,125 games / 15,544 test states**~~ | `MODELS.md` value net | `data/value-net.json` has carried exactly `w`, `mu`, `sd`, `test_logloss`, `test_brier` at every one of its three revisions (`3373299e`, `7215fff2`, `d6f1d709`). It records **no sample size, no accuracy and no baseline**. The 0.6536 and 0.2306 beside them ARE in it, at `d6f1d709`, and stand. |
| ~~**1.824 / 1.863**~~ | `MODELS.md` XATU | The line has said since 2026-08-05 that not one of those figures is in `data/xatu-belief.json`. |

**Nothing was struck because it was inconvenient to source.** The substance of the DODUO withdrawal is
*better* evidenced after this pass than before it: the three weights flipping sign between `b030ca03`
and `fc7e76ce` on 63,305 pairs is now cited, and that is the claim the withdrawal actually rests on.

### The strikes deliberately avoid four words, and it cost one red run to learn why

`engine/docs_scan.js#retractionRegistry` promotes a strikethrough to a **STRONG registry entry** only
when `retract` / `withdraw` / `superseded` / `void` shares its LINE. A registry entry then accuses every
unqualified restatement in the corpus.

- Registering `82,483` would have failed `docs/ROADMAP.md:317` and two lines of
  `docs/archive/HANDOFF-2026-08-02.md`; registering `37,460` would have failed `docs/MEASURE.md:6126`.
  Four correct historical records, turned into build failures by a markup choice.
- The first draft of the notes row named those four words *in a sentence explaining that it avoided
  them*, on the same line as the strikethroughs. The gate went from 11 restatement violations to **45**
  — including every bare `50%` in the repository, because a retracted `50.47%` truncates and rounds to
  `50` alike. Reverted and rephrased.

`sentencesOf` blanks a strikethrough before any figure is extracted, so the count falls either way.

---

## 3. HANDED BACK — 8 figures, three groups, each needing a decision MEASURE does not own

Named, with two options each, and **left standing rather than quietly deleted**.

### (a) DODUO's held-out log-likelihood table — `−3.3425 / −3.3318 / −3.2447`, `docs/MODELS.md`
`data/policy-weights-joint.json` has **never carried a held-out evaluation block at any of its 18
revisions**, so the table is `fit_joint.js` console output. The top-1 column beside it (10.1% / 9.4% /
12.2%) is in the same position and escapes the census only by collision.
**Options:** (1) withhold the table, on the 2026-08-15 precedent in the white paper; (2) have the next
joint fit persist a `heldOut` block and re-cite. **MAG-family judgement, and MAG is paused.**

### (b) The paired refit table — `−0.000076 / −0.000172 / −0.117`, white paper + `docs/MEASURE.md` §13
**No artifact and no generator exists.** Nothing under `engine/` or `build/` contains these figures, and
the three arms were scored by a script that was not kept. The 46,162 held-out decisions ARE real
(`data/policy-weights-pre-censoring.json`, `corpus.test` = 46162); the paired differences are not.
**Five of that table's eight figures escape the census only by a ×100 scaling collision** with
unrelated artifacts — `indexFor` indexes every artifact number at `a`, `a*100` and `a/100` — so
`+0.000348` "traces" to some unrelated `0.0348`, and `0.192` / `0.216` / `−0.074` to `move-priors.json`
and `pokemon-roles.json`. **The honest unit is the whole table, not the three cells the gate names.**
**Options:** (1) withhold the table; (2) re-run the paired comparison and persist it. This is MEASURE's
own headline for "the refit bought nothing", so withholding it is a publication decision, not a tidy-up.

### (c) The partial-label EM validation table — `1.0208 / 1.0021`, white paper
`data/partial-label-em.json` was **regenerated 2026-08-26** and holds none of the six figures in the
table — different numbers for the same question — **and it is one of the 64 artifacts
`engine/quarantine.js` withholds**, so the current values may not be quoted either. Its current
contents are deliberately not reproduced in this report or in the CHANGELOG.
**Options:** (1) withhold the table until the artifact is quotable; (2) restate it from the 2026-08-26
blob once quarantine lifts. Either way the whole table moves.

---

## 4. Bibliography check — asked for, and the answer is no

**None of the 42 is a bibliography entry.** `figuresIn` already strips `arXiv:` and `DOI:` identifiers
(`engine/docs_scan.js`, the strip added after 10 of 33 untraceable figures on 2026-09-09 turned out to
be reference entries, seven of them in `docs/SLOWKING-whitepaper.md`). It also strips `lines N-M`
citations, ISO dates, version strings, wall-clock times, `#224` roadmap references and inline code. The
scanner is not the problem here; every one of the 42 was a stated measurement.

---

## 5. Out of scope, reported not touched

The remaining 22 corpus-wide untraceable figures sit in two documents that are **not** in the living
set, and 21 of them are the same shape as `7,184` — dated tag use-counts superseded by corpus growth:

- `docs/TAG-COVERAGE.md` — 13, at lines 5, 179 and 193 (`7,965`, `7,958`, `10,064`, `6,829`, `30,107`,
  `13,508`, `29,790`, `12,085`, `10,415`, `3,564`). Both blocks declare themselves dated snapshots.
  The same `git show <sha>:data/tags.json` technique used for `7,184` should clear all 13.
- `docs/ARCHITECTURE.md` — 1 (`200,004`, line 167).

Also observed and left alone, because they are the ENGINE agent's live work: `engine/game_differential.js`,
`data/engine-release.json`, `data/open-work.json`, `data/verification/game-differential-{top,bottom}-tie-first.json`
modified, and eight untracked files under `data/verification/`. **Reported, not touched, not deleted.**

`data/docs-currency-baseline.json` was rewritten by `tests/test-docs-current.js` itself as the counts
fell — `untraceable_by_doc` 42 → 8 across the living set and the `untraceable_figures` list shortened by
34 entries. **It was not hand-edited.**

---

## OWED, NOT RUN

Nothing here was committed or pushed — another agent is live in the tree.

```bash
# 1. What this pass changed, and that the gate is still green.
node tests/test-docs-current.js
node engine/major_readiness.js
git --no-pager diff --stat CHANGELOG.md docs/ABRA-whitepaper.md docs/ABRA-technical-docs.md docs/MODELS.md docs/SUMMARY.md docs/RUNNING-NOTES.md
```

```bash
# 2. Verify any of the 25 re-derivations independently. Each is one command.
git show a39a33ce:data/tags.json                  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.moves.partingshot.uses, j.moves.charm.uses)})"
git show c1566ee1:data/policy-weights-joint.json  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const i=j.jointFeatures.indexOf('spreadFreeBesideAlly');console.log(j.weights[j.features.length+i])})"
git show fc7e76ce:data/policy-weights-joint.json  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).corpus)})"
git show 52645850:data/policy-weights-joint.json  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).corpus)})"
git show 8e2dc0a7:data/pory-eval.json             | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.n_games,j.weights)})"
git show ba117b14:data/meta-usage.json            | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.provenance.funnel, j.views.ladder.sampledTeams)})"
```

```bash
# 3. The same sweep on the two documents left out of scope, using the same technique.
node engine/docs_scan.js --quarantine --json > /tmp/q.json
node -e "const j=require('/tmp/q.json');console.log(j.untraceable.where['docs/TAG-COVERAGE.md'])"
git log --oneline -S'7965' -- data/tags.json
```

```bash
# 4. Publish. NOT run here — another agent is live in the tree.
node engine/status.js --write
git add CHANGELOG.md docs/RUNNING-NOTES.md docs/ABRA-whitepaper.md docs/ABRA-technical-docs.md docs/MODELS.md docs/SUMMARY.md data/docs-currency-baseline.json
git commit
git push
```
