# The regulation is a RUN-TIME choice — what landed, and the proof that Reg M-B did not move

**Date.** 2026-09-21. **Division.** ENGINE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

**THIS IS A REFACTOR, SO THE BAR IS THAT NOTHING MOVES.** Every figure below is a before/after pair on
one machine, one pinned Showdown checkout and one pinned team pool, with the regulation flag ABSENT on
both arms. **No Reg M-C figure is published here and none was measured.** The 41 new M-C mechanics are
untouched by design, and a fresh regulation with unmodelled mechanics parts boards — that is expected
and it is not this pass's business.

Inputs, stated so the run can be reproduced:

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a51e0194551c27ef3`, branch `worktree-agent-a51e0194551c27ef3` |
| M-B authority, PINNED | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba5af92e55892c8c7063ca7b53c18a` |
| team store, BOTH arms | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen`, digest `0d103fb9fa87`, 1968 teams of 8778 |
| flags, BOTH arms | `--games 1200 --team-store <above>`, and `tests/test-engine-diff.js --n 6000 --seed 20260804`. **No `--regulation` on either arm.** |

Neither checkout was pulled, built or modified. No git command was run against either, and none
against the main ABRA tree.

---

## 0. The verdict in one table

| | |
|---|---|
| **the mechanism** | `engine/regulation.js` — one resolver, read by `champions_sim.FORMAT`. All **490** readings across **357** files follow it with no edit. |
| **how a caller selects** | `--regulation <id>` on ANY script, or `ABRA_REGULATION=<id>`, or nothing at all (the config's `active` — unchanged). |
| **how the checkout follows** | `data/regulations.json` → `runtime.<id>.checkout` → prepended to `showdown_path.js`'s candidates. Explicit `SHOWDOWN_PATH` still wins. |
| **damage differential** | `--n 6000 --seed 20260804`: **byte-for-byte identical**, before and after. `diff` returns nothing. |
| **1200-game lattice** | 35,980 bytes of output, **two lines differ**: the release id and the wall clock. All 10 divergences, every counter, the pool digest and the census digest are identical. |
| **hardcoded sites** | **26 → 19**. Nine closed, all nine the same defect; two created and both declared (§7). |
| **new test** | `tests/test-regulation-runtime.js`, 35 clauses, **shown RED at 17/35 on a deliberate break** before being trusted. |

---

## 1. The problem was not 490 readings. It was one constant with 490 readers.

`CS.FORMAT` is a module constant resolved at load from `data/regulations.json`, read **490 times
across 357 files** under `engine/ tests/ build/ web/`, with no flag and no environment override. The
first M-C smoke run therefore had to flip `active` in its worktree and restore it
(`docs/_reports/2026-09-20-regmc-first-run.md` §1a, §7). **A run that rewrites shared config is a run
that can corrupt another one beside it** — two agents, two regulations, one `active` key, and the
later write wins with neither measurement knowing.

The 490 readings were never the work. Point the constant at a resolver and every reader follows with
no edit, **including a reader written tomorrow**. That is the same argument `showdown_path.js` makes
about twenty copies of `if (!process.env.SHOWDOWN_PATH)`, and the same argument `dexFor` makes about
its 228 through-seam call sites. It is also why the roster, the census, the staged battery and the
differential all honour the flag without one line changing in any of them: they resolve through
`CS.FORMAT` (`tests/roster.js` alone reads it 9 times, `engine/all_mechanics_fire.js` 3).

**Precedence**, highest first, and an explicit choice always wins:

```
1.  --regulation <id>  /  --regulation=<id>      on the command line of ANY script
2.  ABRA_REGULATION=<id>                         in the environment, and inherited by children
3.  data/regulations.json `active`               THE DEFAULT — unchanged
```

`<id>` may be a key (`regmb`) or a full format id (`gen9championsvgc2026regmc`), resolved by lookup
and never by string concatenation. `argv` is **scanned, not parsed**, because the scripts here use a
dozen ad-hoc parsers and several refuse unknown flags; depending on any of them would have meant
editing each entry point, which is the 490-readings mistake in a new costume.

```
$ node engine/champions_sim.js
CHAMPIONS SIMULATOR
  regulation    regmb  (by data/regulations.json active)
  format        gen9championsvgc2026regmb  FOUND
  checkout      C:/Users/willj/Projects/Pokemon/pokemon-showdown
  pinned        20ad99ffc9a5 (2026-07-22)

$ node engine/champions_sim.js --regulation regmc
ABRA REGULATION: regmc  (gen9championsvgc2026regmc)  by --regulation flag  | checkout pokemon-showdown-mc
CHAMPIONS SIMULATOR
  regulation    regmc  (by --regulation flag)
  format        gen9championsvgc2026regmc  FOUND
  checkout      C:\Users\willj\Projects\Pokemon\pokemon-showdown-mc
  pinned        f10d6798f2ba (2026-09-20)
```

Both runs above had `SHOWDOWN_PATH` unset. **The checkout was selected by the regulation**, from a
worktree, where the old candidate list could not find either checkout at all (§4).

## 2. The choice is printed, and the default is silent — deliberately

Every deviation announces itself on stderr, once, at load: an explicit selection, or a fallback. The
DEFAULT prints nothing, and that is not an exception to the rule. Printing on all several hundred
existing callers would change the bytes of every run's output for no information, and **a line
printed on every run is a line nobody reads** — the `PRE-CHANGE` caption lesson. What must be loud is
the deviation. `verify()` additionally carries `regulation`, `regulation_source` and
`regulation_explicit` into every artifact that stamps it, so a figure can say whether a caller NAMED
a regulation or whether the config decided that day.

**An explicit selection that cannot be resolved REFUSES.** The hardcoded literal survives for the
DEFAULT path only — "guessing beats crashing a collection job" — and it does not extend to a
regulation somebody named. Answering a request for `regmc` with M-B's format id is exactly the
wrong-regulation figure this seam exists to prevent, and it would arrive wearing exit 0.

## 3. TWO MAPS IN `regulations.json`, AND MERGING THEM WOULD HAVE BROKEN THE COLLECTOR

The first design put `regmc` into the existing `regulations` map. **That is wrong in a way that would
have been invisible.** `engine/next_regulation.js knownFormats()` walks exactly that map
(`for (const reg of Object.values(r.regulations || {}))`, line 269) and classifies anything in it as
`known` rather than `candidate` — so adding M-C there tells the hourly `next-regulation` workflow
that M-C is already known, and it quietly stops collecting the regulation this whole exercise is for.

So there are two maps and they mean different things:

- **`regulations`** — the set whose STORE this project owns. Untouched. M-B only.
- **`runtime`** — the set a RUN may be pointed at. M-B (checkout + pin) and M-C (formats + checkout +
  pin). A `runtime` entry whose key also exists in `regulations` **inherits** its format ids and never
  restates them, because two files that both decide a format id will disagree eventually and the
  disagreement will be invisible because both keep working.

**Being selectable is not being active.** `active` is still `regmb`.

Every value written into `runtime` was READ, never typed, and the provenance is in the file:

```
Dex.formats.all() on …/pokemon-showdown-mc, filtered /champions/ + doubles:
  gen9championsvgc2026regmc      [Gen 9 Champions] VGC 2026 Reg M-C        mod champions
  gen9championsvgc2026regmcbo3   [Gen 9 Champions] VGC 2026 Reg M-C (Bo3)  mod champions, Best of = 3
git -C …/pokemon-showdown-mc rev-parse HEAD       f10d6798f2ba5af92e55892c8c7063ca7b53c18a
git -C …/pokemon-showdown-mc log -1 --format=%cd  2026-09-20
CONTROL: …/pokemon-showdown (M-B, pinned) carries gen9championsvgc2026regmc? -> false
```

That last line is the one that makes the checkout pairing load-bearing rather than decorative, and it
is asserted in the test.

**`PINNED_COMMIT` and `PINNED_DATE` moved out of `champions_sim.js` into the same block**, because
one constant cannot pin two authorities. They are `null` for a regulation that declares no pin, and
null is reported as UNKNOWN by `verify().commit_matches` rather than as a mismatch — accusing a
checkout of drifting from a pin that does not exist would be worse than having none. Two call sites
that sliced the constant unguarded (`champions_sim.js` CLI, `engine/play.js:365`) now print
`UNPINNED` / `unpinned` instead of throwing.

## 4. A worktree could not find either checkout, and now it can

`showdown_path.js`'s candidates were anchored at `__dirname/../..`, which from
`<repo>/.claude/worktrees/<x>/engine` lands in `.claude/worktrees` and finds nothing. That is why
every differential in this pass had to be given an explicit `SHOWDOWN_PATH` — and why the first M-C
run's housekeeping note said the lownode wrapper and worktree isolation are incompatible.
`checkoutCandidates()` publishes the sibling anchor AND the worktree anchor, both validated by the one
`looksLikeShowdown` this project has.

**This is the one behaviour that changed on the default path, and it is declared rather than sneaked
in:** in the MAIN checkout the first candidate resolves to the same directory it always did, so
nothing moves; in a WORKTREE a run that used to fail with `Cannot find module '\tmp\ps\dist\sim\index'`
now finds the real checkout. An explicit `SHOWDOWN_PATH` still beats all of it.

## 5. The proof that Reg M-B did not move

**(a) Damage differential — byte-for-byte identical.**

```
SHOWDOWN_PATH=…/pokemon-showdown node tests/test-engine-diff.js --n 6000 --seed 20260804
before: exit 0     after: exit 0
diff before after  ->  (no output)     IDENTICAL
```

**(b) The 1200-game lattice — two lines of 35,980 bytes differ, and both are permitted.**

```
$ diff lattice-before-1200.txt lattice-after-1200.txt
30,31c30,31
< WHOLE-GAME DIFFERENTIAL — MODE A (pinned, tolerance zero)   adb08f5360f1   driver: coverage
<   961 games in the primary arm, 3 arm(s), 2211.8s, showdown 20ad99ffc9a5
---
> WHOLE-GAME DIFFERENTIAL — MODE A (pinned, tolerance zero)   d8f3dc38a947   driver: coverage
>   961 games in the primary arm, 3 arm(s), 1517.6s, showdown 20ad99ffc9a5
```

The release id `adb08f5360f1` → `d8f3dc38a947` is **required** to move: `SOURCES` gained
`engine/regulation.js` and `champions_sim.js`'s bytes changed. `engine_release.js` states the rule in
its own SOURCES comment — *"Existing releases are untouched; every FUTURE release id changes, which is
correct — the definition of the engine changed."* The seconds are a wall clock on a shared machine.

Everything else is identical: **`DIVERGED (primary arm middle): 10 of 961`** on both arms, the same 10
rows in the same order, the same team-pool digest `0d103fb9fa87`, the same census digest, every
counter in the coverage block, every must-read-zero line.

**THE 10 IS NOT A GATE READING AND MUST NOT BE QUOTED AS ONE.** These runs omit
`--steering empirical --arm middle --end-state`, which `engine/quarantine.js` passes. A different
flag set is a different question — `--games` alone has already cost this project a pool-pin audit
(CLAUDE.md, *the flags are the sample*). The 10 is a FINGERPRINT for a before/after comparison and
nothing else; the gate's own zeros are in `docs/ENGINE.md` and were not re-measured here.

**(c) A 120-game lattice was also run on both arms** (4 of 103 games diverged, both times, pool digest
`9e337f7376c3` both times) but only the AFTER arm's full text was kept, so it is reported as
corroboration rather than as a diff.

## 5b. What else was run, and what was NOT

Run and green on the changed tree: `tests/test-regulation-runtime.js` 35/35,
`tests/test-engine-release.js` 80/0, `tests/test-docs-current.js` 39/0, `tests/test-next-regulation.js`
GREEN, `tests/test-engine-consistency.js` all checks, `tests/test-parse.js` 42/0,
`tests/test-artifact-rerunnable.js` all green (`no artifact became unre-runnable since the baseline`),
`tests/test-roadmap-register.js` 3/0, `tests/probe_unknown_format_refusal.js` PASS, and
`tests/roster.js --items` with **0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE**.

Two reds, and neither is this change:

- **`tests/test-wiring.js` is RED and is WAIVED BY NAME** in `data/test-waivers.json`, group `MAG`,
  reason *"Every configuration runs mew.js --policy score, whose makeScoringPlayer…"*. Every failing
  line in it is a joint-layer/MAG capability, which is the waiver's own subject.
- **`engine/artifact_audit.js` reports 1 GAP, and it is worktree isolation**: `build_engine_data.js`
  resolves CHOMP at `<repo>/../../CHOMP`, which from `.claude/worktrees/<x>` is
  `.claude/worktrees/CHOMP`. `Cannot find module`. It exits 0 and it is unrelated to anything here.

**`engine/quarantine.js` WAS NOT RUN IN FULL and no gate clause is claimed.** It is a 20,000-comparison
differential plus three roster stages, and a 184-check suite was running against the main tree for
this whole pass. What is claimed is narrower and is what the bar asked for: the differential it
contains is byte-identical on the damage arm and identical bar two permitted lines on the 1200-game
arm, and the roster item stage is clean. **`engine/status.js --write` and `engine/provenance.js
--strict` were deliberately NOT run** — both write the absence of untracked files as fact and have
corrupted a ledger and a ratchet from a worktree.

**The census was NOT regenerated**, deliberately. `data/mechanics-census.json` steers which games the
differential plays, so regenerating it mid-pass would have made the before and after two different
questions. Both arms report the same census digest.

## 6. THE INSTRUMENT WAS WRONG BEFORE THE ENGINE WAS, AND THE CONTROL CAUGHT IT

The first comparison planned here was a structural diff of `data/game-differential.json` before and
after. It reported **`IDENTICAL — 21008 normalised lines, 0 differences`**, which was a completely
fictitious pass: `game_differential.js` writes that artifact only under `if (WRITE)` (line 9783), the
runs in this pass did not pass the flag, and **all three "artifacts" were copies of one stale file
from 04:55**, before any run in this session.

It was caught by running the comparator against two arms that MUST differ — a 120-game run against a
1200-game run — and getting `IDENTICAL` back. **A zero that nothing could have made non-zero is not a
measurement.** The comparison moved to the text output, which is what §5 reports.

## 7. Nine hardcoded sites closed, and they were all one defect

`node engine/regulation_touchpoints.js --class hardcoded`: **26 → 19**. Nine closed and **two
created**, and the two are stated rather than netted off:

- `engine/regulation.js` carries the one surviving fallback literal, which answers the DEFAULT path
  only;
- `tests/test-regulation-runtime.js` carries the old inlined expression, written out longhand, because
  clause 1 compares the resolver's default answer against an INDEPENDENT re-reading of the config and
  not against itself. A test that imported the resolver to check the resolver would be green by
  construction.

**THE SCAN READS ONLY TRACKED FILES, AND BOTH NEW FILES WERE INVISIBLE TO IT UNTIL THEY WERE STAGED.**
The intermediate reading of 17 was a true count of the tree git could see and a false statement about
the work; it was written into four documents and corrected before the commit, from the scan run after
`git add`.

Every one of the nine was the identical pattern — an inlined
`JSON.parse(readFileSync('data/regulations.json'))` inside a `try`, with its own copy of the literal
in the `catch`, silent:

```
engine/analyze.js           engine/chomp_ev.js        engine/durable-ingest.js
engine/fetch_smogon_stats.js engine/meta-ingest.js    engine/smogon_priors.js
engine/validate_damage_sim.js  sim/champions-battle.js   engine/champions_sim.js
```

`docs/REGULATION-ROTATION.md` step 11 calls this kind *"the avoidable cost"* and says a fallback in
engine code *"should read the config, and should say so out loud when it cannot."* Eight of the nine
said nothing at all; `champions_sim.js` was the only one that announced. Now there is one literal in
one file and it answers the default path only.

**The 17 that remain are the two kinds the rotation doc says to LEAVE**, and none of them is a silent
default: 2 GitHub workflows, 2 UI pages (`app/index.html`, `web/index.html`), `engine/cut_regmc_pool.js`
(deliberately M-C), 11 probe/test fixtures pinned to the format they were measured on — including
`tests/probe_usage_regulation_pool.js`, a deliberate **Reg M-A** control. Rewriting any of those edits
the record.

`engine/durable-ingest.js` gained one thing beyond the swap: an empty `FORMATS` list now **refuses
with exit 2** instead of running clean over zero formats. The literal used to make that impossible by
guessing; the resolver makes it impossible by always answering — but a collector that exits 0 having
collected nothing is this repository's signature failure and it should not be reachable at all.

## 8. The test, and the deliberate break

`tests/test-regulation-runtime.js`, auto-discovered by `tests/run-all.js`'s `^test-.*\.js$` glob.
**35 clauses, 35 passed.** Every clause that varies the regulation is paired with a control arm that
asks for the default and asserts a DIFFERENT outcome, so an unwired flag fails rather than passing
quietly:

```
ok   CONTROL CLEARED: the two arms return DIFFERENT format ids
ok   CONTROL CLEARED: they name DIFFERENT checkouts
ok   CONTROL CLEARED: the ACTIVE checkout does NOT carry the OTHER format
```

**Shown RED first.** `function fromArgv(argv) { if (1) return null; }` — a one-line unwiring —
takes it to **17 passed, 18 failed**, and the control clause says exactly what happened:

```
FAIL CONTROL CLEARED: the two arms return DIFFERENT format ids
     — both answered gen9championsvgc2026regmb — the flag is unwired
```

Clause 1 is the refactor bar itself: the resolver's default answer is compared against an
INDEPENDENT re-reading of `data/regulations.json` written out longhand in the test, not against
itself.

`tests/test-engine-release.js` also caught a real defect in the same pass — `engine/regulation.js`
was LF on disk and unpinned in `.gitattributes`, which means a fresh checkout rewrites it to CRLF and
**moves the release id with no code change.** Pinned; 79/1 → 80/0.

## 9. What is NOT done

1. **No M-C differential, no M-C census, no M-C roster.** Out of scope by the brief, and a fresh
   regulation with unmodelled mechanics parts boards.
2. **`data/engine-data.js` still has no row for any of the 35 added M-C species and none of the 15
   added moves** (`2026-09-20-regmc-first-run.md` §3). ENGINE may not write that file. **MEDICHAM
   cannot build an M-C team**, so selecting M-C today gets you the AUTHORITY at the right format and
   a runtime that cannot field it. The flag is necessary and it is not sufficient.
3. **`engine/legal_scope.js` still drops the `Future`-flagged ability** (§2 of that report).
4. **`engine/tag_dex.js` still reads `move.shortDesc`** in two places, and M-C ships with the
   Champions descriptions removed — the one thing in that report measurably changing a board.
5. **Three scripts refuse unknown flags** and will reject `--regulation` on the command line:
   `engine/mew_farm.js`, `engine/replay_differential.js`, `engine/register_reality.js`. All three
   honour `ABRA_REGULATION` instead, because that path does not touch argv. Left alone rather than
   edited: `mew_farm.js` is a fit and out of ENGINE's remit.
6. **`engine/status.js --write` and `engine/provenance.js --strict` were NOT run** — both write the
   absence of untracked files as fact and have corrupted a ledger and a ratchet from a worktree.

## 10. Reproduction

```bash
SD=C:/Users/willj/Projects/Pokemon/pokemon-showdown
POOL=C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen

SHOWDOWN_PATH=$SD node tests/test-engine-diff.js --n 6000 --seed 20260804
SHOWDOWN_PATH=$SD node engine/game_differential.js --games 1200 --team-store $POOL
SHOWDOWN_PATH=$SD node tests/test-regulation-runtime.js
SHOWDOWN_PATH=$SD node tests/test-engine-release.js
node engine/regulation_touchpoints.js --class hardcoded

node engine/champions_sim.js                      # regmb, silent, checkout pokemon-showdown
node engine/champions_sim.js --regulation regmc   # regmc, ANNOUNCED, checkout pokemon-showdown-mc
ABRA_REGULATION=regmc node engine/champions_sim.js
node engine/champions_sim.js --regulation regzz   # REFUSES, names what it knows
```

Before/after outputs are kept at `…/scratchpad/regsel/` (`engine-diff-{before,after}.txt`,
`lattice-{before,after}-1200.txt`, `lattice-after-120.txt`). The three `gd-*.json` files in that
directory are the stale-artifact dead end of §6 and are **not evidence of anything**.
