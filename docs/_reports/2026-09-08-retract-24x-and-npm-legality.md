# The dead speed ratio comes out of the living documents, and the npm oracle is the same oracle

**MEASURE, 2026-09-08.** Two jobs, neither touching the engine. No engine byte moved in this pass;
`git diff --stat engine/` is empty for everything this report owns. Release 5.267.0, a MINOR under an
unchanged basis.

---

## JOB 1 — WHICH DOCUMENTS CARRIED `24.9x`, AND WHAT THEY SAY NOW

### The count was three and it is six. The set was derived.

The brief said three living documents and said not to trust that count. `engine/docs_scan.js`
`livingDocs()` returns **25** documents — the version-headered set the documentation gate scans.
Grepping those 25 for `24.9` finds four; **six carried a superseded speed figure as the current one**,
and the two a `24.9` search cannot find are the ones that mattered most, because one of them is the
plain-English deck.

| living document | what it said | what it says now |
|---|---|---|
| `docs/ABRA-whitepaper.md` §3.0 | a table reading `ratio 24.9x`, and *"the honest statement of the gap is 24.9x"* | the 2026-09-08 table, **3.94x** raw and **16.1x** streamed, with pins, sample and noise floor |
| `docs/ABRA-whitepaper.md` open question 8 | *"no ratchet, test or artifact compares any of them"* | corrected — two scripts now measure it; what survives, and got worse, is that **nothing ratchets speed** so the readings cannot form a series |
| `docs/ABRA-technical-docs.md` §3.62.2 correction | *"The ratio is 24.9x"* | **3.94x**, with the interface distinction stated in Simplified Technical English |
| `docs/ABRA-technical-docs.md` *"do not quote an engine-speed figure"* | *"There is no script in this repository that measures the speed of the two engines"* | corrected — `engine/bench_speed.js` and `data/verification/speed-2026-09-08/bench_two_engines.js` |
| `docs/SUMMARY.md` *"the correction that came with it"* | *"117x was 24.9x"* | *"117x was 24.9x, and 24.9x is now 3.94x"* |
| `docs/MODELS.md` CHAMPIONS_SIM | *"a ratio of 24.9x, not 117x"* | superseded in place, current figure **3.94x**, plus the npm legality result |
| `docs/ADR-002-showdown-is-the-authority.md` | the 2026-08-06 correction block, asserting 24.9x and arguing from it | the block is KEPT, marked superseded, and a **2026-09-08 block** sits beside it |
| **`docs/ABRA-deck-plain-english.md` slide 9f** | ***"We measured it again. It's about 25 times slower, not 117."*** | rewritten end to end: 4x, both interfaces, and — since the withdrawal below — the fact that the readings cannot be compared at all as the finding |
| **`docs/MEW-whitepaper.md` §4.1** | ***"generate games with `medicham2-browser.js`, which is 117× faster"*** | **3.94x / 16.1x**, with the decision explicitly not resting on the size of the gap |
| **`docs/GAME-DIFFERENTIAL-DESIGN.md` §7** | ***"MEDICHAM measures ~1,600–2,000 battles/sec"*** | 134 whole games/sec against Showdown's 33.7, marked as PLAY time only |

**Deliberately untouched, and why.** `docs/ADR-001-use-the-champions-mod.md` and `docs/ROADMAP.md`
§5.3 both state `24.9x`. Neither is in the derived living set, both are dated records of what was
believed when they were written, and a decision record's evidence is not rewritten in place. ROADMAP
is also outside this pass's write scope. They are named here rather than edited.

**One judgement was overridden, and it should be visible.** The RUNNING-NOTES row written earlier
today said both ADRs would be *"deliberately left alone"*. ADR-002 is in the derived living set, and
its correction block did not merely record a number — it built the load-bearing sentence *"the gap is
large enough to sit under a per-turn rollout search, and 24.9x is"* on top of it. That argument does
not survive 3.94x. Leaving it standing would have been a caption in the shape of a document. The old
block is kept verbatim; the new block retires the argument.

### What the rewrites had to carry

**Both ratios, with the interface named.** Against Showdown's raw `Battle` class — no `BattleStream`,
no protocol strings parsed, the fastest interface it has — the gap is **3.94x**. Against
`BattleStream` plus the official `RandomPlayerAI`, which is what Showdown's documentation tells a user
to write, it is **16.1x** at 92 turns/sec. Both are true and they answer different questions: the
first bounds Showdown's engine, the second bounds Showdown as anybody uses it. **Publishing one
without the interface is exactly the mechanism by which `117x` survived a year**, so every rewritten
passage states both.

**THE DIRECTION OF TRAVEL — AND THIS IS THE PART THAT CHANGED WHILE THE PASS WAS RUNNING.** The brief
asked for *"13,041 → ~1,800 → 1,482 turns/sec in 33 days ... roughly 8.8x"* to be written as measured,
with the cause left open. It was written that way, and then **withdrawn before hand-back**, because
the bisection Will commissioned opened by killing its own premise
(`docs/_reports/2026-09-08-speed-regression-bisect.md`, §0). **The endpoints do not measure the same
amount of work.** Divide each reading by its own battles/sec:

| reading | turns/sec | battles/sec | **turns per battle** |
|---|---|---|---|
| 2026-08-06 (`2fb0928a`) | 13,041 | 217 | **60.1** — every battle ran to the 60-turn cap |
| 2026-08-06, same-day sibling (`e29a26d9`) | 3,212 | 1,606 | **2.0** |
| 2026-09-08 (this run) | 1,482 | 134 | **11.06**, 100% of games reach a result |

60.1 means that engine did not finish games and the rate is over turns of an unfinished battle; 2.0
is the opposite failure; 11.06 is a played-out game. **Three populations of "a turn", so the ratio is
not a slowdown measurement**, and the arithmetic is checkable from figures already published — nothing
here rests on trusting the other report. Two of the three readings also have no artifact on disk, and
`engine/game_differential.js` refuses every release before 2026-08-12, so **the window both disputed
figures came from cannot be re-measured by the instrument that produced today's number.**

**So no living document states a slowdown figure.** Each states why one cannot be computed from these
readings, and points at the bisection for the curve. The intermediate 2026-08-28 reading is withheld
separately, for the quarantine reason below.

**AND A SECOND FIGURE WAS WITHDRAWN THE SAME WAY.** The rewrite first carried the speed report's
arithmetic — *"MILTANK's 20,000 ms budget buys about 15 leaf calls per decision on MEDICHAM against 4
on Showdown"* — into the white paper, `SUMMARY.md`, ADR-002, the deck and `docs/MEASURE.md`. **It
counted leaf CALLS as though they were playouts.** A call at `n=200` is 200 playouts, so thousands of
rollouts already happen inside one decision, and a profile of one real in-game decision landed at
02:06 locating the binding constraint elsewhere entirely. The claim is DELETED from all five. **None
of the replacements quotes the profile that refuted it**, because `data/search-decision-profile.json`
is in the withheld set — a refutation from a quarantined artifact is enough to make a claim come out,
and not enough to put its own numbers in.

**What survives as a measured reason for the engine** is narrower than either withdrawn figure: **no
public engine can load `gen9championsvgc2026regmb` faster**, because the only code that loads it at
all is Showdown's simulator and its repackagings. Whether re-solving per turn pays is still
ROADMAP #62 and nothing here answers it.

### Source of the figures

Every number above is read from `docs/_reports/2026-09-08-engine-speed-comparison.md` and the
artifacts it names under `data/verification/speed-2026-09-08/`. **This pass did not re-run the
benchmark**; it published what that run measured. Pins carried into every rewrite: engine release
`fb0058fb5702`, `--team-store data/team-pool-frozen`, Showdown commit `20ad99ff`, census digest
`b599f8d581b5`, flags `--pairs 40 --per-pair 10 --reps 6|9 --caps 60,14`, 12,000 games per engine, 8
contention-free reps, noise floor 0.3% and 2.7%.

---

## JOB 2 — THE EIGHTH FILE, AND WHETHER THE npm ORACLE IS THE SAME ORACLE

### The question

`pokemon-showdown@0.11.11` (published **2026-07-28**) ships the Champions mod. **7 of its 8 mod files
are SHA-256 identical** to our pinned build; `formats-data.js` is the one that differs, and that file
carries per-species format metadata — tiers and legality flags. The only question that matters is
whether anything in that diff changes what is **legal** in `gen9championsvgc2026regmb`, or any
`isNonstandard` value this project reads.

### What is in the diff

Structural comparison of `data/mods/champions/formats-data.js` in both builds: **same 1,361 keys, no
key on either side only, three field differences and nothing else.**

```
medichammega.tier   "UU" -> "UUBL"
froslassmega.tier   "UU" -> "UUBL"
polteageist.tier    "UU" -> "UUBL"
```

Those three data rows reach **four** dex entries, because Polteageist-Antique inherits its base
forme's row. Every one of the four is legal in this regulation and stays legal:
`isNonstandard: null` on both builds, `tier` never `Illegal` on either. `UUBL` is a Smogon **singles**
tier label; this project's filter is `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`, and
`'UU' !== 'Illegal'` and `'UUBL' !== 'Illegal'` are both true. **No `isNonstandard` value moved on any
entity in either build.**

### The answer, derived on five independent axes

`data/verification/npm-oracle-2026-09-08/compare_oracle_legality.js` loads both builds, walks the
format **filtered**, and compares the SETS element by element. It aborts on any empty walk rather than
letting a zero-row table agree with itself; all eight walks returned rows, and the counters read
`{"walks":8,"empty_walks":0,"validator_threw":0,"store_lines_unparsed":0}`.

| axis | checkout (commit `20ad99ff`) | npm `0.11.11` | verdict |
|---|---|---|---|
| legal species | 347 | 347 | **set identical**, 0 only-in-either |
| legal moves | 500 | 500 | **set identical** |
| legal items | 148 | 148 | **set identical** |
| legal abilities | 316 | 316 | **set identical** |
| `isNonstandard` on any legal entity | — | — | **0 differences** |
| the three Champions format definitions | — | — | **identical**, including `ruleset`, `banlist`, `gameType: doubles`, `mod: champions` |
| resolved rule table for this format | 29 rules | 29 rules | **identical**, including complex bans, restricted species and every value rule |
| learnsets over the 347 legal species | 14,192 cells | 14,192 cells | **0 diffs** |
| `TeamValidator` on every open-sheet team in `data/team-pool-frozen` | 6,450 valid / 1,884 rejected | 6,450 / 1,884 | **0 accept/reject differences** |

`LEGAL_SETS_IDENTICAL: true` — `data/verification/npm-oracle-2026-09-08/npm-oracle-legality.json`.

**The validator run is the decisive instrument and it produced 539 text differences that are not a
legality change.** Stripping every nickname-length clause from both sides leaves **0** differences,
and no team's accept/reject class moves. The cause is upstream and cosmetic:
`sim/team-validator.js` reworded the Nickname Clause length message between the two builds. Our
reconstructed sheets carry species ids as nicknames, so one 20-character forme name trips it in both
builds — a fact about our sheet reconstruction, not about the format.

### Everything else that differs between the two builds

`data/verification/npm-oracle-2026-09-08/digest-manifest.txt`: **6 of 323 files** differ under
`dist/data` and `dist/sim`. All six are accounted for.

| file | what changed | reaches this format? |
|---|---|---|
| `data/mods/champions/formats-data.js` | 3 `tier` labels, `UU` → `UUBL` | yes, on 4 legal entries — **no legality effect** |
| `data/formats-data.js` (base gen 9) | 3 `tier` labels, 0 non-tier fields | **no** — all three species are `isNonstandard: 'Past'` here and outside this regulation |
| `data/rulesets.js` | a `desc` string on `godlygiftmod`; a `battleOnly` array fix inside `hackmonsformelegality` | **no** — neither rule id appears in this format's 29-rule table |
| `data/mods/gen8/rulesets.js` | gen 8 | **no** — this format's mod is `champions`, parent `base`, gen 9 |
| `sim/team-validator.js` | Nickname Clause length MESSAGE reworded | wording only; 539 verdict strings, **0 verdicts** |
| `sim/side.js` | `this.active.length > 1` → `this.battle.activePerHalf > 1` in the choice-details string | **equal in a `doubles` gametype**; the two differ only in multi battles |

### Verdict and recommendation

**The legal sets are identical. The switch is safe, and MEASURE recommends it.** It replaces a git
checkout pinned only by convention with an immutable published version, and a TypeScript build with
one `npm install`. The npm build is also six days NEWER than our pin (2026-07-28 against 2026-07-22),
and the whole of what those six days changed is the table above.

**MEASURE did not perform the switch.** It is ENGINE/OPS work and belongs in its own attributable
change — a change to the oracle is a change to every differential measurement downstream, and it
should be one commit somebody can point at. What is owed with it: `engine/champions_sim.js`'s
*"requires a built master checkout"* header, and the same claim in both ADRs, have been false since
2026-07-28.

**One caveat on reproducing this.** The npm tarball is unpacked in a temp directory
(`%LOCALAPPDATA%/Temp/psnpm/package`) left by the run that produced
`docs/_reports/2026-09-08-engine-speed-comparison.md`. It is not vendored into the repo. Re-fetch with
`npm pack pokemon-showdown@0.11.11` and point `--b` at the unpacked `dist/sim`; the harness prints
each build's `package.json` version so a wrong path cannot pass silently.

---

## How to re-run

```bash
node data/verification/npm-oracle-2026-09-08/compare_oracle_legality.js \
  --a C:/Users/willj/Projects/Pokemon/pokemon-showdown/dist/sim \
  --b <unpacked pokemon-showdown@0.11.11>/dist/sim
bash data/verification/npm-oracle-2026-09-08/digest_manifest.sh \
  C:/Users/willj/Projects/Pokemon/pokemon-showdown <unpacked pokemon-showdown@0.11.11>
```

The team pool defaults to `data/team-pool-frozen/games.ots.jsonl` and is part of the sample
definition, not a budget: pointing it at the live store would compare two different questions.

---

## Gates

| gate | at hand-back |
|---|---|
| `tests/test-docs-current.js` | **33 passed, 0 failed** |
| `tests/test-roadmap-register.js` | **3 passed, 0 failed** |
| `tests/test-register-cell-parse.js` | **PASSED** |
| `tests/test-register-reality-readonly.js` | **10 passed, 0 failed** |
| `tests/test-docs-quarantine.js` | **RED — and not this pass's.** See below. |

**Two reds were found and one was fixed here.**

**FIXED.** `tests/test-docs-quarantine.js` was RED at HEAD on `docs/MEASURE.md`, and the red was
INHERITED rather than introduced: the 2026-09-08 speed section written earlier today quoted a
leaf-cost range and a MILTANK budget out of `engine/bench_speed.js`'s consolidated artifact, which is
one of the **63 artifacts `engine/quarantine.js` withholds**. The figures came OUT of that paragraph.
The same treatment was then applied to the intermediate 2026-08-28 throughput reading everywhere this
pass had written it — whitepaper, technical docs, deck, `SUMMARY.md`, `MODELS.md`, ADR-002 and
`docs/MEASURE.md` — so **the 8.8x now rests on its two endpoints, 13,041 (2026-08-06) and 1,482
(2026-09-08), neither of which is withheld**, and the midpoint is named as withheld and not stated.
The earlier RUNNING-NOTES row still carries it; that is a log entry and is not edited to agree with
today.

Also fixed in this pass: `tests/test-docs-current.js` clause 3b(c) caught a team count added to
`docs/MODELS.md` with no artifact citation. The sentence was rephrased to state the claim without the
bare figure; the number lives here and in the notes row, both of which cite the artifact.

**STILL RED AND OWNED ELSEWHERE.** As of 02:08 on 2026-09-08, `tests/test-docs-quarantine.js` fails on
**`docs/RUNNING-NOTES.md:73` only** — a row added by a concurrent profile pass at 02:01, citing
`data/search-decision-profile.json`, which the quarantine withholds. **This pass contributes zero
entries to that failure**; the gate's own listing names one file and one line. It is not edited here,
because that row belongs to an agent that is still writing it and was observed correcting the same row
twice inside ten minutes — editing another live writer's file is the clobber this repository has
already paid for once. Reported, not touched.

## Left alone, reported rather than touched

- An untracked file named `C` sits at the repository root. **It was not created by this pass and has
  not been touched.** Reported, not deleted.
- `docs/ROADMAP.md` §5.3 and `docs/ADR-001-use-the-champions-mod.md` still narrate `24.9x`. Outside
  this pass's write scope; named above.
- `docs/ABRA-technical-docs.md`'s MEW farm note (`8 procs at --conc 4 gave 11 games/sec`, `--conc 1`
  gave 38, 12 procs reproduced at 44–46) is a different measurement about process concurrency, was
  not re-run, and was not edited.
