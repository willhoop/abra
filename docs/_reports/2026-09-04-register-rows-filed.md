# Six owed register rows filed, one of them not the defect it was filed against

2026-09-04, ENGINE. Owned file: `docs/ROADMAP.md` and this report. Nothing committed. No game
played, no artifact regenerated, no engine code edited. `data/open-work.json` is rewritten as a
side effect of running `engine/open_work.js`, which is generated output and is left uncommitted.

## What moved

| | before | after |
|---|---|---|
| register rows | 497 | **503** |
| open | 251 | **257** |
| open AND asserting breakage (what the gate counts) | 68 | **70** |
| marked closed | 246 | 246 |

Read from `node engine/open_work.js` before and after. `node tests/test-roadmap-register.js` is
**3 passed, 0 failed** after the edit.

Every new row was driven through the shipping detectors rather than eyeballed —
`Q.roadmapRowIsClosed` and `Q.roadmapRowSaysBroken` from `engine/quarantine.js`, plus
`register_reality.js`'s own `MARKER` and `OWED` regexes:

| row | closed | saysBroken | marker | INSTRUMENT OWED | columns |
|---|---|---|---|---|---|
| #535 Unburden | false | **true** | — | yes | 3 |
| #536 self-play duplicate ids | false | **true** | — | yes | 3 |
| #537 phantom roadmap ids | false | false | — | yes | 3 |
| #538 pruning argument | false | false | — | yes | 3 |
| #539 dead counter tables | false | false | **`node tests/test-artifact-keys.js`** | — | 3 |
| #540 raw-log census | false | false | — | yes | 3 |
| #218 (edited) | false | true | unchanged | — | 3 |

`#535` and `#536` assert breakage and carry no runnable marker, so `openDefectClause` puts them in
`debt`, which by its own text *"does not hold this clause shut"*. The four hygiene rows carry no
`DEFECT` token and no breakage prose in their first 600 characters, so they are OPEN and visible to
`open_work.js` without touching the gate. **The phrase `NOT A DEFECT` is used nowhere** — the
briefing warned it is executable at `engine/quarantine.js:1296`, and none of these rows needed an
override to land on the right side of the detector.

---

## 1. THE UNBURDEN ROW IS NOT THE ROW I WAS ASKED TO FILE, AND THE ORIGINAL CLAIM IS REFUTED

**Asked for:** *"the doubling applies to every body that loses an item — a Knock Off, a consumed
berry or a used Focus Sash doubles the speed of a Pokémon that has never had the ability."*

**That is not what the code does.** `engine/medicham2-browser.js:14770` opens the block on
`m._hadItem&&!m.item`, and the very next line is the gate:

```js
const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)_mods.push(+_ub.speedMult);
```

Nothing enters the ModifySpe chain unless the CURRENT ability carries the tag, and `data/tags.json`
carries exactly one carrier of `speedOnItemLoss` — Unburden, 5,036 uses, `speedMult 2`. Derived over
the artifact, not recalled.

**And an instrument already decides it, green.** The census probe *"Unburden doubles Speed once the
item is gone"* (`tests/test-mechanics.js:5670`) runs the same body losing the same Focus Sash with
the ability off as its control. `data/mechanics-census.json` at HEAD, generated 2026-09-04T03:12:47Z,
records it `live` and `armed`:

```
ability none 187,187 (must not move); Unburden 187,374
```

A body without the ability does not move. The census was read via `git show HEAD` rather than
re-run, because another agent held the game-playing slot.

**Where the wrong reading came from, which is worth more than the correction.** With no named state
to compare, `tests/probe_leaf_widening.js:277` compares its OWN stand-in against the authority's
volatile:

```js
const stand = m => (m && m._hadItem && !m.item) ? 1 : 0;      // the PROBE's predicate
const vol   = p => (p && (p.volatiles || {}).unburden) ? 1 : 0;
```

Its observe arm reading `medi=[1,1] sd=[1,0]` is that predicate over two bodies that both lost an
item — not this engine's Speed. `docs/ENGINE.md:207`, `:285-291` and `:325` read it as the engine's
Speed and state the broad claim in as many words (*"true for every body that lost an item whatever
its ability"*, *"every body in this engine that loses an item gets Unburden's speed doubling"*).
**ENGINE owns that file and I did not edit it. That correction is owed.**

**What I filed instead, which is real and narrower.** The authority
(`pokemon-showdown/data/abilities.ts:5227-5249`, Champions overriding Unburden nowhere) adds a
VOLATILE from Unburden's own `onAfterUseItem` / `onTakeItem`, removes it in `onEnd`, and applies
`chainModify(2)` only while `!pokemon.item && !pokemon.ignoringAbility()`. The volatile records *who
held the ability when the item went*. This engine re-derives the answer from the current ability on
every `effSpeed` call, so a body that loses its item and only AFTERWARDS acquires Unburden is doubled
here and is not doubled there. Skill Swap is implemented (`a.kind==='abilityswap'`, WIRE 110,
`:27556`), so the path is reachable.

Two things stated in the row rather than counted: `ignoringAbility()` has no counterpart here at all
(no `ignoringAbility`, `abilitySuppressed` or `neutralizinggas` symbol exists in medicham2), and the
switch-out half is already correct — `_hadItem` is re-stamped on every switch-in at `:19973`, census
detail `Unburden 165,330,165,true`.

Five legal carriers, derived from the format: Sceptile, Liepard, Slurpuff, Hawlucha, Sneasler.

**Adjacent, not filed, because it is not my file and I was not asked:** `engine/board.js` contains no
`unburden`, no `speedOnItemLoss` and no `_hadItem` — the expected-speed path does not model the
ability at all. Reported, not touched.

## 2. 89 duplicate ids in `data/games.selfplay.jsonl` — filed as #536

Derived read-only tonight: **3,090 lines, 3,001 unique ids, 89 ids appearing exactly twice, and not
one of the 89 pairs is byte-identical.** Both rows of every pair are distinct games, so this is an id
collision, not a duplicated write: a de-duplicating reader loses a real game and a counting reader
over-counts.

Two contiguous blocks, which names the cause: first occurrences are lines 2,902-2,993 all stamped
`2026-08-07 23:24`; second occurrences are lines 2,994-3,090 all stamped `2026-08-19 23:51`; ids run
`selfplay-1-0` … `selfplay-1-99`, so the later batch restarted the sequence at zero. Store 31.9 MB,
mtime 2026-08-19 19:51.

**No `VERIFIED BY` marker, deliberately.** `engine/validate_selfplay.js:184` decides it and is red,
but `engine/register_reality.js` execFileSyncs every marker it finds and does **not** honour
`ABRA-HEAP` (only `tests/run-all.js:609` and `tools/lownode.cmd:60` do), so the marker would exit 134
on every audit and be recorded as EXIT CODE UNDECLARED — and the file plays mirror-symmetry battles,
which the register may not spawn on every run. `INSTRUMENT OWED` names the cheap check that would fix
that.

## 3. Nine phantom roadmap ids, 30 citations — filed as #537

`#73, #76, #86, #104, #138, #144, #305, #306, #307`. The comment census
(`docs/_reports/2026-09-04-ineffective-comments.md`) verified them three ways; I confirmed
independently by listing every `| #N |` id in the register — the sequence runs 6 to 534 and skips
exactly those nine among the numbers in range.

The row states both resolutions and takes neither, as instructed: allocating rows back-fills the
register with claims nobody wrote; striking the citations removes the only pointer to why the code is
shaped as it is, and `#86` cannot simply be struck because four living documents cite it for the
published figure *"91.4% of legal species share a base Speed"*. `tests/test-roadmap-register.js`
enforces this rule for the five division ledgers and reads no `.js` file, which is why nothing caught
it.

## 4. `engine/engine_release.js` pruning argument — filed as #538

The heading is at **`:730`**, not `:653` as briefed. Counted on disk 2026-09-04: `ls data/releases`
is **523** entries, `du -sh data/releases` is **2.5 GB**, against the section's *"Nine releases hold
23 MB"* — ~58x on the count, ~111x on the bytes.

The row is careful about what it does not claim: `citedReleaseIds()` is derived, unchanged, and
already fails closed on an unreadable `data/`. What is stale is the magnitude, and the *"5 of 9 are
cited"* ratio, which is the load-bearing half of the safety argument and has not been re-measured at
523. How many of the 523 are cited today, and whether `prune` has ever run, are both cheap and both
untaken — `engine_release.js` is MEASURE's file and this was a filing task.

## 5. Two dead counter tables — filed as #539, with a real marker

`node tests/test-artifact-keys.js` measured tonight: **5 passed, 1 failed, exit 1**, naming exactly
`million-run-150k.json:engine_counters` and `million-run.json:engine_counters`. Written at
`engine/million_run.js:1463`, read back by nothing. Both are already recorded in
`data/artifact-accessors.json` under `deliberately_undeclared`, which the test does not read, so the
gate stays red on purpose.

This is the one row that carries `VERIFIED BY`, because the gate genuinely exists, exits 1 while the
condition holds, and exits 0 the moment a reader is named or the tables stop being published.
`register_reality` will read open + red as CONFIRMED. The row records the decision the red is
holding: **name a reader, or stop publishing them** — declaring an accessor would be a false receipt.

## 6. `data/raw-log-census.json` — filed as #540

Carries `raw_archive_games: 46587` against `store.games: 52377`, `store.games_with_no_raw_log: 6191`
and a note that those games *"can never be re-parsed"* — all of which read the archive as a SUBSET of
the store. Committed 2026-08-10 16:07 and never moved; the raw archive is 413.9 MB as of
2026-09-04T01:30 and is now the superset by design (commit `e01ac3b1`).

**A recursive grep for the filename across every `.js` in the tree returns one hit** —
`engine/provenance.js:470`, which classifies its `by:` string as an unresolved declaration. So
provenance notices the file and declines to judge it, no builder regenerates it, and no gate fails on
it. The resolution (a generator, or deletion) belongs to whoever owns the store; ENGINE does not
delete a file it did not write.

---

## The two "check, do not assume" items

**A. The composition-test "separate undiagnosed defect" — NOTHING TO CORRECT, AND NOTHING FILED.**
It was never a register row. `grep -n "pin_guard\|unpinned" docs/ROADMAP.md` returns one unrelated
hit (#222, about Protect's pin coupling) and no row asserts it. The retirement is recorded in
`docs/_reports/2026-09-04-composition-test-repoint.md` and needs no register action — filing a row to
retire a row that never existed would be the duplicate this brief forbids. **Its OWED item 1 is a
separate matter and is still live in that report: `engine/pin_guard.js` was untracked when it was
written. It is tracked now** (`git ls-files engine/pin_guard.js` returns it), so that half has landed
since.

**B. #218's protocol figures against `--whole-game` — CORRECTED IN PLACE BY APPENDED ADDENDUM.**
`node engine/quarantine.js --whole-game` is the only `--whole-game` marker in the register, and it is
on #218. Tonight's commit `9dca646b` repointed it: `wholeGameClause` is now
*"BOARD-MATERIAL — games whose boards part"* (`state.games` less
`state.games_board_never_diverged`), and the protocol first-divergence quantity that every figure in
#218 reports moved to `narrationClause` with its own command `--narration`, which does not gate.
So the row's marker still runs and no longer answers the row's question.

The addendum is APPENDED, not a rewrite — the cell's dated claims are left standing per the
project's rule. It carries ENGINE's figures **attributed rather than re-measured** (board-material 77
of 961, narration 167 of 961, release `8ad06030e129`, from
`docs/_reports/2026-09-04-board-material-clause.md`) and names the coincidence a reader would
otherwise trip over:

> this cell already contains `77 of 961 = 8.0%` as a PROTOCOL undeclared figure from 2026-08-23 on
> release `c36782953dee`, and the new BOARD-MATERIAL figure is also 77 of 961 = 8.0% on release
> `8ad06030e129`. Different releases, different samples, different quantities, same digits.

**The clause was not run.** Another agent may be rewriting `data/game-differential.json` and a torn
read of that file has produced a fictitious class table here before.

**`data/register-reality.json` was NOT hand-edited.** It is generated, dated 2026-08-27, and its
`#218` entry quotes the row title with `EXIT CODE UNDECLARED` (exit 2, 58 ms) — it carries no
protocol figure of its own. It restates itself on the next `engine/register_reality.js` run, and
hand-editing a derived artifact is the failure this repo files rows about.

# OWED

1. **`docs/ENGINE.md:207`, `:285-291`, `:325` still state the refuted broad Unburden claim**, and
   `:216` records *"a register row for the Unburden speed doubling"* as owed — the row now exists
   (#535) but says something narrower than the sentence above it. ENGINE owns that file; I was
   scoped to `docs/ROADMAP.md` and did not touch it.
2. **Nothing is committed.** `docs/ROADMAP.md` and this report are modified on disk only, plus
   `data/open-work.json`, which `engine/open_work.js` rewrote as generated output.
3. **`node engine/status.js --write` was NOT run** — it stamps division ledgers this task does not
   own while another agent is working, and filing register rows changes no published figure.
4. **#538's two cheap follow-ups are untaken by design:** how many of the 523 releases are cited
   today, and whether `prune` has ever run. Both belong to MEASURE with the file.
5. **#537 needs a decision from Will**, not from a division: allocate the nine rows, or strike the
   thirty citations. `#86` is the one that cannot simply be struck.
