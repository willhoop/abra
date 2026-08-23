# Nine unregistered defects filed, one briefed premise refuted — 2026-08-23

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

REGISTER WORK ONLY. `docs/ROADMAP.md` gained **9 lines and lost none** (`git diff --numstat` reads
`9 0`). Nothing under `engine/`, nothing under `tests/`, `tests/run-all.js` untouched.
`data/docs-currency-baseline.json` **was not written by this pass** — see §12. **Nothing that plays a
game was run.** Nothing was committed and nothing was pushed.

One artifact was written and restored in the same minute — see §9, which is now register row **#369**.

---

## VERDICT

**9 rows filed: #362–#370. 4 carry NO VERDICT by design. 0 are reopens.** All 9 carry an
`INSTRUMENT OWED:` marker, so they are declared debt in a form `engine/register_reality.js` can read
rather than prose.

| row | subject | verdict filed? |
|---|---|---|
| #362 | a simultaneous double wipe is a WIN on the authority, a draw here | **DEFECT — measured** |
| #363 | `-boost field 3`, 9 of 96; 2 attributed, 7 unattributable | **none** |
| #364 | the 22 damaging `self` moves | **none** (unmeasured, no DEFECT token) |
| #365 | the differential's species-name-keyed forced-switch mirror | **DEFECT — measured, instrument** |
| #366 | `test-precharge-order.js` published a figure measured on an unnamed arm | **DEFECT — measured** |
| #367 | the 5.74.0 team-store retraction | **the briefed premise is REFUTED**; the residual defect is real; no verdict on the remainder |
| #368 | `test-state-differential.js` red then green on one tree | **none** (cause unknown, no mechanism claimed) |
| #369 | `register_reality.js --list` overwrites the verdict artifact | **DEFECT — tripped by me, self-reported** |
| #370 | the retraction registry matches on a ROUNDED value: 52 false accusations from one entry | **DEFECT — measured, over-fire** |

**Two corrections owed to the brief, both of which change what got filed:**

1. **#363 is not unregistered. #351 already covers the Moody-attributed part of that class** and was
   filed earlier tonight. The new row is scoped to the **remainder** and says so, so the two cannot
   both be worked as if they were the whole class.
2. **#367's premise is false.** `data/game-differential.json` *does* record a team-store field, and
   has since 2026-08-07. Worse for the published account: **both** the retracted artifact and the
   corrected one declare the *same* frozen pool. Detail in §7.

**Refreshing `data/register-reality.json` costs a settled tree, `SHOWDOWN_PATH`, and three
game-playing gates it has never run — roughly 25 s of what it already ran plus those three. It is 42
rows behind, and it would still assign no verdict to anything filed tonight.** §8.

---

## 1. #362 — THE WIN RULE. A double wipe is a WIN, not a draw.

**The authority, read in the checkout tonight**, `sim/battle.ts`:

```
:2546   faintData = this.faintQueue.shift()!;          // inside faintMessages()'s drain loop
:2605   this.win(faintData && this.gen > 4 ? faintData.target.side : null);   // inside checkWin()
```

guarded by `if (this.sides.every(side => !side.pokemonLeft))`. `faintData` is the **last** entry the
loop shifted, so in Gen 5+ both sides emptying is not a draw — **the side whose body fainted LAST
wins**. The citation carried into the brief was `:2603`; that is where the `checkWin(` signature sits
in this checkout and the `win()` call is two lines below. Recorded so it is not re-derived.

**Ours has no such rule.** `battleResult(S)` in `engine/medicham2-browser.js` compares live-body
counts, falls through to total HP fraction, and returns `0.5` for 0-against-0. Its own header calls
that *"dead-even HP tie at the 20-turn horizon"*, which a mutual wipe is not.

**Measured, not argued.** `tests/probe_selfdestruct_winner.js` board `w3-simultaneous` reads showdown
`winner="B"` with `pokemonLeft p1=0 p2=0` against medicham2's draw. That file already declares it
KNOWN-OPEN and proves it is not the self-KO faint position: the disagreement is identical clean and
under its surgical revert.

**Why no instrument we own can see it.** Every whole-game comparison here compares protocol lines or
boards. Two engines can emit identical lines to the character and still disagree about the result, so
`engine/game_differential.js` has no class for this and cannot acquire one until a *winner* is
compared. The blast radius is the leaf, not the narration: `battleResult` is what the sealed rollout
and the Tower end screen read.

**Will's perish case is carried as his hypothesis and NOT as a fact**, in those words in the row.
#115 landed the speed-ordered residual walk and already notes that a double KO goes to the last
faint; ENGINE is deriving the perish half now.

> **Line numbers in this section and §4/§5/§7 were read at 2026-08-23T01:40Z. An ENGINE agent landed
> edits to `engine/medicham2-browser.js` and `engine/game_differential.js` while this pass was
> running, and six of the eight numbers had already moved by 02:00** (`battleResult` 24478 → 24529,
> `mirrorForcedSwitch` 3743 → 3754, `classify` 3902 → 3913, the swarm stamp 4849 → 4860). **The
> register rows were rewritten to cite the SYMBOL** with the line given as a timestamped reading. A
> line number in a row about a file under active edit is a stale figure with a two-hour half-life.

## 2. #363 — `-boost field 3` is 9 causes and the artifact can name a mechanism for 2

Read, not re-run, off `data/game-differential.json`: release `59bb68aa89a9`, generated
2026-08-22T22:50:24Z, **777 games / 96 diverged / 0 threw**, census pin `80e648f34d56`, team pool
`b2b61ec40281`. Artifact mtime was 2 h 45 m old at read time — a settled read, not a torn one.

All nine causes are `n=1` and all nine are a **magnitude-2 raise on the same slot with a different
stat**. There is **no `-unboost` class in this artifact at all**, so the drop half of #351's
observation does not appear on this sample.

**How many mechanisms: one is named, seven are unnamed, and the instrument cannot name them.**

- `first_divergences` samples 60 of the 96 games and holds 2 of these 9. In both, our line is
  `|-boost|p2a: Scovillain|spe|2|[from] ability: moody`. **Those two are #351 and are not re-filed.**
- A whole-file scan finds the string `moody` **exactly twice** — those two sampled lines. The other
  seven carry no mechanism anywhere in the artifact.
- The reason is structural and it is a *correct* rule being asked the wrong question. `classify()`
  builds the cause from the **normalised** line, and the `stat-attribution` entry of `EQUIV` strips
  `[from]`/`[of]` from every `-boost` and `-unboost` — **9,631 lines collapsed on this run**. That
  rule is right for the comparison (a stat line's meaning is body, stat, direction, amount) and it
  ships with a red demonstration in both directions. It is lossy for **triage**.

**At least two legal mechanisms produce this exact shape — derived from the format, not recalled:**

| mechanism | derivation | corpus |
|---|---|---|
| `moody` | legal carriers filtered to the regulation are exactly **Glalie and Scovillain** | 367 (abilities column, `data/regulation-usage.json`, clean: 17,563 games / 424,933 clicks) |
| **Acupressure** | `isNonstandard: null`; *"Raises a random stat of the user or an ally by 2"* — and it can raise an **ally**, a shape Moody cannot produce | 42 clicks |

A third class needs no random draw at all: a deterministic +2 move whose stat we map wrongly. **So
the class is not one defect and must not be worked as one.** #351's caveat rides all of it — the
shared-die address covers only `hitStepAccuracy`, `secondaries` and `getDamage`, and neither a
residual ability draw nor a move's own random-stat draw executes in any of the three.

## 3. #364 — the 22 damaging `self` moves

The declaration existed only in CHANGELOG 5.74.0 and in no register row. **Membership derived from
the format tonight, filtered to the regulation:**

- **25 legal moves carry a `self` effect.** 3 are Status (Baton Pass, Roost, Shed Tail); exactly one
  of those is heal-primary (Roost, `self.heal` true) and that one is #343. **22 are damaging.**
- 10 carry `self.boosts`, 11 `self.volatileStatus`, 1 `self.onHit`.
- **32,135 clicks of 424,933 — 7.6%.** Close Combat 18,600, Draco Meteor 3,291, Make It Rain 2,811,
  Overheat 1,879, Hyper Beam 1,708.

**Nothing here claims they are wrong.** The failure path was not measured on any of the 22, on either
engine. No `DEFECT` token is filed — an unprobed member is not a defect, and calling it one corrupts
the open-defect clause exactly as much as missing a real one.

**A discrepancy found while filing and NOT acted on:** #343's status cell reads *"open — engine
DEFECT … fix deliberately deferred"* while CHANGELOG 5.74.0's file list carries
`engine/medicham2-browser.js  … #343 self-rider gate` as a landed change. One of the two is stale. I
did not change the row, because asserting a verdict on a fix I did not measure is the thing this
division exists to stop. Reported, left.

## 4. #365 — one instrument defect wearing three faces

`mirrorForcedSwitch` (exported from `engine/game_differential.js`) resolves medicham2's replacement
into a Showdown choice by **species name**, requiring `!q.isActive && !q.fainted`. Two ways to miss,
and the failure message already distinguishes them: *"does not have under that name"* (RENAMED —
transform, forme change) and *"has but cannot switch in (fainted/active)"* (ALREADY ON THE FIELD).

**Measured on the current artifact** (release `59bb68aa89a9`, 777 games):

```
declared_gaps.forced_switch_slots_mirrored   959
declared_gaps.forced_switch_slots_passed       7
declared_gaps.forced_switch_unmirrorable      11
..._unmirrorable_first  "p1: slot 1 holds froslass, which showdown has but cannot switch in"
end_reasons  middle 2 of 777 · top-tie-first 2 · bottom-tie-first 5
```

and one of those end reasons names **`froslassmega`** — the renamed face, sitting in the published
record. Every game that ends this way had its remaining turns never compared.

**Three staged scenarios are this one mechanism, and that was proved rather than assumed.**
`imposter-copies-the-body-opposite`, `hungerswitch-flips-every-turn` and
`roar-drags-whoever-is-standing-there` return the identical SHORT verdict at the identical turn with
the identical `endReason` under all four arms, `err=null`, `stateDiv=null`, engines agreeing on every
board, byte-identical on releases `18b227eee69f` and `39631097fcc7`. Not the arm, not the dice, not
the engine.

**The gate count in the brief was four; the derived count is more.** `tests/staged_board.js` is not
`test-*.js`, so `run-all.js` does not discover it — and **seven** `test-*.js` files require it as a
library: `test-assert-mode`, `test-forme-assert`, `test-middle-stall-address`, `test-perish-song`,
`test-roster-arm-pin`, `test-switch-back-renamed`, `test-volatile-duration`. `tests/test-forced-switch-mirror.js`
drives the exported helper directly. One fix, nine instruments.

**#346 is CLOSED and is not this row.** It fixed the fallback's lack of memory of the other slot's
pick on a double KO. This is the key itself. The row says so, so #346 cannot be read as covering it.

## 5. #366 — the wrong-arm callers

`PRIMARY_ARM` on the live driver is `middle`, read off it. `test-precharge-order.js` is the **only**
caller measured to move: under `bottom-tie-first` four of its arms produce more protocol (11→12,
14→16, 12→13, 10→11 lines). Its verdict does not flip — both engines share the arm — but *"the two
protocol streams do not part"* is a weaker claim on a board where fewer things happened, and
`docs/ENGINE.md:1596`/`:1650` publish "five arms, 83 checks" measured there.

The population is **22, not 27** (three pass the arm as an ES6 shorthand and were accused wrongly;
two match on `replayGame` as a substring), plus **4 indirect** through `staged_board.js`'s `runOne`,
which takes no arm parameter, plus **7 inside the driver's own self-proofs** — and
`planted_divergence_proof`, `directed` and `knock_off_roadmap_80` are published blocks riding them.

**8 screened, 7 byte-identical across three arms — INERT WITH EVIDENCE.** That is the noise floor the
one positive rests on, and it is why seven figures were **cleared** rather than withdrawn on
suspicion. **The 83 is NOT withdrawn by this row**; it has not been re-measured on a named arm, so
what is established is that the instrument is arm-dependent, not what the number becomes. A
correction of the 27 is owed to `docs/ENGINE.md`, which ENGINE owns.

## 6. #368 — a gate that answered twice

Red on all three arms in one pass (`injected 86, 3/3, exit 1/1/1`), green (`exit 0`) in another the
same evening on the same tree. Both are in `docs/_reports/`.

**No mechanism is claimed and none was invented.** One candidate is on the record and is explicitly
not the verdict: a neighbouring gate's message *"varies between runs because the team pool is drawn
live from the store"*, and two of the three red clauses are fixture-reachability complaints a moved
pool could plausibly flip. The third — *"the clean game's very first board already differs"* — is not
a fixture complaint at all, so a single explanation is not even available.

Filed rather than fixed because an ENGINE agent is live in `engine/medicham2-browser.js` and
`tests/run-all.js` is being edited now. A gate that answers twice is worse than one that answers red,
because both answers are quotable.

## 7. #367 — THE BRIEFED PREMISE IS REFUTED, AND THE REAL DEFECT IS NARROWER AND WORSE

CHANGELOG 5.74.0 corrected 9.7% to 11.69% and gave two reasons. **Both fail on the record.**

**"`data/game-differential.json` RECORDS NO TEAM-STORE FIELD AT ALL" is false.**
`STEER_STAMP.team_store_pinned_to = TEAM_STORE || null` is written unconditionally in the swarm
block, under its own comment *"SAID OUT LOUD EITHER WAY … an unpinned run that looks like a pinned
one is the whole problem"*. `git log -S` puts it in `b168490`, **2026-08-07 16:34** — fifteen days
before the entry saying it does not exist.

**"The flag did not take" is contradicted by both artifacts.** Read out of git, not re-run:

| | `b26c2d4` (the retracted 9.7%) | `HEAD` (the corrected 11.69%) |
|---|---|---|
| generated | 2026-08-22T21:17:11Z | 2026-08-22T22:50:24Z |
| games / diverged | 961 / 95 | 777 / 96 |
| `steering.team_store_pinned_to` | `"data\\team-pool-frozen"` | `"data/team-pool-frozen"` |
| `steering.team_pool_teams` | **8778** | **8778** |
| `steering.team_pool_picked` | 1,968 | 1,597 |
| `steering.team_pool_digest` | `0d103fb9fa87` | `b2b61ec40281` |

`TEAM_STORE` is the sole input to `SWARM.buildSwarm(..., { storeDir })`. `data/team-pool-frozen/` is
a 2026-08-12 snapshot whose `games.bo3.jsonl` is **109,006,606 bytes against the live store's
167,972,026** — a live pool cannot yield the frozen pool's team count. **Both runs read the frozen
pool.** What differs is the number of teams picked, and `buildSwarm` is asked for
`max(games * 2, 18)` — the two runs simply **requested different sample sizes**.

**Neither figure is withdrawn by this work.** 11.69% is a rate on 777 games and 9.7% is a rate on
961, both on the frozen pool — two samples, not a pinned one and an unpinned one. What is disputed is
the CAUSE published beside them.

### 7b. What set the different requested counts — ANSWERABLE, with one interval and one UNKNOWN

Asked for after the row was filed, and answered **from the record only**: no re-run, no heavy job.

**Neither artifact stores the requested count.** There is no `games_requested`, no argv, no flag
block in either — which is this row's own defect one level up.

**But it is recoverable, because `per` is observable.** `buildSwarm` computes
`per = max(1, floor(max(GAMES * 2, 18) / CFG.length))`; both runs carry **9 configs**; and both
publish `picked` per config, with **seven of the nine sitting exactly on the cap**:

```
b26c2d4   picked per config  266, 99, 7, 266, 266, 266, 266, 266, 266   -> per = 266
HEAD      picked per config  213, 99, 7, 213, 213, 213, 213, 213, 213   -> per = 213
```

Inverting `floor(GAMES * 2 / 9)`:

| run | `per` | `--games` must be in | only round number in it |
|---|---|---|---|
| `b26c2d4` (the 9.7%) | 266 | **[1197, 1201]** | **1200** |
| `HEAD` (the 11.69%) | 213 | **[959, 962]** | **960** |

So **the two runs asked for materially different sizes — roughly 1200 against roughly 960.** They
were not the same request producing different samples.

`coverage_stop` is `null` in both, and the source says that field is *"`null` on a fixed-count run"*,
so both took an explicit `--games` and **neither was `--until-covered`.**

**Yes, the driver clamps — per config, not to the whole pool.** The picker is
`for (i = 0; i < matching.length && picked.length < per; i += step)`, and both artifacts record
`omit-protect` at **99/99** and `omit-priority` at **7/7**. **Identical starvation in both runs is a
third independent sign they read the same pool**, alongside the identical `team_pool_teams = 8778`
and the frozen directory's byte size.

Neither run got what it asked for, and by almost the same fraction:

| run | requested | played | conversion |
|---|---|---|---|
| `b26c2d4` | ~1200 | 961 | **80.1%** |
| `HEAD` | ~960 | 777 | **80.9%** |

**The shortfall is per-config starvation inside the frozen pool — not a live store.** A run that had
read the larger live pool would have starved less and converted differently.

**UNKNOWN, and not guessed:** which exact integer was passed, and why the second run asked for the
smaller one. Nothing in the record carries a command line, and nothing was re-run to find out.

**The real defect: nothing reads the field.** The only reader of `team_store_pinned_to` anywhere
under `engine/` or `tests/` is `engine/replay_one.js:240`, and it reads the **dump** artifact, not
this one. No gate, no provenance clause and no `status.js` line compares a published claim's asserted
pool against the artifact's declared pool or its `team_pool_digest`. **A receipt nobody presents is
not a receipt** — which is the true form of what 5.74.0 was reaching for, and it is why a wrong pin
would still be invisible today. #288 stays open as the general row; this is the specific case where
the id already exists and is unread.

## 8. WHAT IT WOULD TAKE TO BRING `data/register-reality.json` CURRENT

The artifact on disk is `generated 2026-08-22T01:55:12.569Z` and holds:

```
register_rows 236   id_rows 281   marked 31   distinct_commands_run 22
stale_rows 0   premature_closes 2   unrunnable 1   instrument_owed 3
```

Against the register **now**: 323 distinct ids, 36 rows carrying `VERIFIED BY`, 17 carrying
`INSTRUMENT OWED`, 25 distinct commands. **It is 42 id-rows behind** — 34 of that before tonight, 8
of it mine.

**The cost, in the order the obstacles bite:**

1. **A settled tree, and this is the binding constraint, not the compute.** `git status` right now
   shows an ENGINE agent live in `engine/game_differential.js`, `engine/medicham2-browser.js`,
   `tests/probe_red_demo.js`, `tests/probe_selfdestruct_winner.js`, `tests/test-perish-song.js`,
   `tests/test-resolution-order.js`, and another in `tests/run-all.js`. **Four of those six are
   instruments the register names.** A refresh taken now stamps verdicts on bytes that will not exist
   in an hour — which is #368 in miniature.
2. **`SHOWDOWN_PATH` must be set.** 4 of the 25 marked commands require it.
3. **Compute is cheap for what it has already run** — the last full pass was 22 distinct commands in
   **24.9 s wall total**, longest 6.3 s, because most of those gates *read artifacts* rather than
   play games (`quarantine.js --whole-game` is 72 ms).
4. **Three genuinely new commands, and they are the expensive ones.** Since that artifact the
   register gained `tests/roster.js --stage moves` (#318, #319), `tests/test-imposter-transform-line.js`
   (#320) and `tests/test-precharge-order.js` (#322). All three play games; `roster.js --stage moves`
   also **rewrites `data/roster.moves.json`**, so it cannot run beside another agent at all. Those
   four rows are exactly the four `where.js --gates` reports as having no verdict in the artifact and
   which `openDefectClause` therefore counts as `debt`.
5. **One row is structurally unrunnable and needs a decision, not a run.** Its marker is
   `SHOWDOWN_PATH=... node tests/roster.js --stage items --release <id>` — a literal `<id>`
   placeholder. The last pass recorded it `INSTRUMENT UNRUNNABLE`. It needs a real release id that
   `engine_release.js compat` says can still serve the caller (#109 stranded 56 of 65), or the marker
   has to change.
6. **`tests/test-precharge-order.js` is #366's own subject.** Running it to refresh the register
   assigns a verdict measured on an unnamed arm. Sequence #366 before or beside the refresh, or the
   refresh launders the thing #366 filed.
7. **It would still assign no verdict to anything filed tonight, and that is correct.** Verdicts go
   only to rows carrying `VERIFIED BY`, and none of #362–#369 does. Giving #362 one today would be
   actively wrong: `probe_selfdestruct_winner.js` reports `w3-simultaneous` as KNOWN-OPEN and exits
   0, so an open row plus a green instrument would score **STALE ROW** — the loudest false verdict
   the tool has. All eight instead carry `INSTRUMENT OWED:`, which the tool reads as **declared debt
   and never as a failure**, and which is what makes them printable instead of prose.

**Estimate: on a settled tree with `SHOWDOWN_PATH` set, ~25 s for the 21 gates it already runs, plus
one roster moves stage and two game-playing gates. The work is the scheduling, not the seconds.**

## 9. AN ARTIFACT I WROTE AND RESTORED — NOW ROW #369

`node engine/register_reality.js --list` is documented as *"coverage only; runs nothing"*. That is
true of the instruments — every row printed `--list: not run`. **It is not true of the artifact.** The
run ended `wrote data/register-reality.json` and replaced the 01:55Z verdicts with a file carrying
none: `271 insertions, 142 deletions` against HEAD.

`git checkout -- data/register-reality.json` restored it byte for byte; `generated` reads
`2026-08-22T01:55:12.569Z` again and the working tree is clean of it. **No verdicts were lost.** Had
the file been untracked it would have been unrecoverable.

It is filed as #369 by the agent that caused it, and the reason it matters beyond the file is that
`openDefectClause` reads this artifact: an all-`NOT RUN` version moves every open row into `debt`, so
the clause reports *"no open row names an instrument that is RED"* for exactly the reason that should
make it loudest.

## 9b. #370 — MY ROW BROKE A GATE, AND THE GATE HAS A REAL DEFECT UNDERNEATH IT

Row #367 pushed `test-docs-current.js`'s *"retracted figures restated as fact"* clause from **10 keys
to 29**, blocking commits. Both halves are real and they were separated before either was touched.

**The registry read #367 as retracting a figure that #367 says is NOT retracted.** The derivation
(`retractionRegistry`, rule 2) registers `<determiner> <number>` on any line containing `retract`.
My row said *"corrected a published 9.7% to 11.69%"*, so `9.7%` entered the registry as **STRONG** —
sourced, measured, to `docs/ROADMAP.md:1177` and nothing else. That is the opposite of the row's
finding. **Rewording the row so it can only be read one way is making it say what it means, not
laundering**, and it is what was done: `published 9.7% to 11.69%` became `revised its
divergence-rate-over-usable from 9.7% to 11.69%`, plus an explicit clause that neither figure is
withdrawn.

**The registry defect is separate, larger, and pre-existing — filed as #370, not defused.**
`retractionViolations` accepts a hit when `Number(e.value.toFixed(f.dp)) === f.value`, and
`(9.7).toFixed(0)` is `"10"`:

| | |
|---|---|
| violations from the single `9.7%` entry | **56** |
| of which matched a bare `10%` | **52** (93%) |
| of which matched a real `9.7%` / `9.70%` | 3 / 1 |

and it is firing **at baseline right now, with nothing of mine in it**: of the 17 surviving raw
violations, **12 are rounding collisions rather than exact matches**, including
`docs/BACKLOG.md:215` (*"we produce the single most common set **48%** of the time"*) and
`docs/archive/SESSION-2026-08-02.md:113` (*"Sucker Punch's 48% failure"*), both accused of restating
the retracted mirror figure **47.5%**. Neither is about it.

Second half: `isDistinctive = f => f.pct || f.value >= 1000` admits **any** percent, so a
two-significant-figure rate qualifies — and `docs/ENGINE.md:5390` carries the literal cell
`| into a Bright Powder holder (100 x 0.9 = 90) | 10.3% | 9.7% |`, an accuracy. The registry's own
header already argues this case for a bare `17` (*"a registry that fires on every occurrence of a
small integer is worse than no registry"*) and then exempts percents from the argument.

**Measured after, by driving `engine/docs_scan.js` read-only rather than running the gate** (the gate
writes `data/docs-currency-baseline.json` on a green run, and another agent has that file modified):

```
STRONG registry entries   7971, 63.2%, 47.5%        (the 9.7% entry is gone)
deduped violation keys    10      baseline  10      ADDED  0
```

**Exactly at baseline. No entry was added to `data/docs-currency-baseline.json` and no retraction was
deleted.** The three discriminating cases #370 owes a fix are stated in the row: `63.2%` must still
match `63%`; `9.7%` must not match `10%`; `47.5%` must not match a Sucker Punch `48%`. The current
rule satisfies only the first.

## 10. OBSERVED, NOT CAUSED, NOT TOUCHED

- **#224 is already REOPENED** (2026-08-22, by MEASURE). `docs/_reports/2026-08-22-drag-and-fail.md`
  calls it *"CLOSED — a regression with no open row"*; that observation was itself stale. I
  re-confirmed the reopen on the **current** release: `declared_gaps.trace_body_off_field = 4`,
  `trace_body_off_field_first = "farigiraf"`, and one literal `??:` in the artifact text
  (`extra event emitted by medicham2 :: |upkeep <> |move|??:farigiraf|roar`). No row owed.
- **#343 and CHANGELOG 5.74.0 disagree about whether #343 is fixed** (§3). Reported, not changed.
- `data/docs-currency-baseline.json` and `tests/run-all.js` were already modified when this pass
  started, and six more files were modified by another agent during it. None of them are mine.
- `data/register-reality.json` is restored and clean. `docs/ROADMAP.md` is the only repository file
  this pass changed: `9 0`.
- **The tree moved under this pass, repeatedly.** `node tests/test-roadmap-register.js` returned
  `2 passed, 1 failed` once and `3 passed, 0 failed` on the three runs either side of it, while
  another agent was mid-write on `docs/ENGINE.md` (now staged). That is #368's shape arriving a
  second time in one evening, on a different gate, and it is why nothing here was verified on a
  single run.

## 12. WHAT THIS PASS DID NOT WRITE, STATED BECAUSE IT IS THE OBVIOUS SUSPICION

- **`data/docs-currency-baseline.json` was never written by me.** The clause in §9b was brought back
  to baseline by rewording a register row, not by adding a baseline entry. The file was already
  modified when this pass began and its index state changed under me (` M` → `MM`) — another agent.
- `tests/run-all.js`, `engine/*`, `tests/*` — untouched. `docs/ENGINE.md` carries two corrections
  owed by #366 and they were **not** applied: ENGINE owns that ledger and an ENGINE agent is live in
  it.

## 11. WHAT WAS RUN

`node tests/test-roadmap-register.js` (3/3 pass, register 332 items), `node engine/where.js --gates`,
`node engine/register_reality.js --list` (§9), read-only calls into `engine/docs_scan.js`
(`retractionRegistry`, `retractionViolations`), `git show`/`git log` reads, JSON reads of
`data/game-differential.json`, `data/register-reality.json`, `data/regulation-usage.json`,
`data/docs-currency-baseline.json`, and `Dex.forFormat('gen9championsvgc2026regmb')` derivations
filtered with `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`.

**`tests/test-docs-current.js` was deliberately NOT run**, because it writes
`data/docs-currency-baseline.json` on a green run and another agent has that file modified. Its
clause was measured by calling the same functions it calls.

**No game was played. No fit, no rollout, no differential, no roster, no `status.js --write`.**
