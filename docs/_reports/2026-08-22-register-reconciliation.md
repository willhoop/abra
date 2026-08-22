# REGISTER RECONCILIATION — 2026-08-22 (MEASURE)

Two jobs. (1) settle the `status.js` / `where.js` disagreement about ROADMAP #318 and #319. (2)
reconcile every finding in `docs/CARD-REVIEW-2026-08-22.md` against `docs/ROADMAP.md`.

This file is a dated findings record. It is historical by construction, like `docs/HANDOFF-*.md`:
never maintained, never cited as current state, superseded by the register rows it feeds.

---

## 1. #318 AND #319 — WHERE.JS IS RIGHT, STATUS.JS IS RIGHT, AND THE WORD `DEBT` IS WRONG

**They are asking two different questions, both correctly, and only one of the two tools says so.**

| tool | reads | question |
|---|---|---|
| `engine/where.js --gates` | `docs/ROADMAP.md`, live | does the row **NAME** an instrument (`VERIFIED BY:`)? |
| `engine/quarantine.js` `openDefectClause` (what `status.js` prints) | `data/register-reality.json`, an artifact | is there a **VERDICT** for this row, and what was its exit code? |

Measured, not argued:

- `docs/ROADMAP.md` rows #318 and #319 both carry
  `VERIFIED BY: `SHOWDOWN_PATH=... node tests/roster.js --stage moves``, in their status cells.
  `where.js --gates` reads them and lists both. **That is correct.**
- `data/register-reality.json` was generated **2026-08-22T01:55:12Z** and holds **31** result rows.
  #318 and #319 are not among them. **That is also correct**, because the rows did not exist when it
  ran: `git log -S` puts the #318 row into `docs/ROADMAP.md` at commit `76e4a67`, **2026-08-21
  22:33:56 -0400 = 2026-08-22 02:33Z**, thirty-eight minutes AFTER the artifact was written.
- So the clause has no verdict for either row and drops both into its `debt` bucket, which prints:

  > `13 open row(s) assert breakage with NO instrument that decides them — DEBT`

  **The classification is right and the sentence is false.** Both rows name an instrument. What is
  absent is a VERDICT, and the reason it is absent is that the verdict artifact is older than the
  register rows. The line states a fact about the REGISTER while computing a fact about the
  ARTIFACT.

**And there is a second, independent reason those two rows can never leave `debt` as things stand.**
`engine/register_reality.js`'s `SAFE` guard is
`/^node\s+((?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js)((?:\s+--[A-Za-z0-9_\-=]+)*)\s*$/`.
The marker on #318/#319 begins `SHOWDOWN_PATH=... node …`, which is not a plain `node <repo script>`
command, so `runUncached` refuses it and returns `green: null`. Re-running `register_reality.js`
today would therefore move those two rows from `debt` to **`unrunnable`** — the clause's third
bucket, whose line already reads correctly (*"name an instrument that WOULD NOT RUN — that is not
agreement and it is not evidence either"*). It would NOT move them to `withRed`.

### Which one should the gate use

**The gate should keep using the verdict artifact, and it should stop calling the result `debt`.**
The clause's design argument is explicit and right: *"a row is evidence only when an instrument
agrees with it"* — a row that merely NAMES a gate has not been measured, so it cannot hold the gate
shut. `where.js`'s list is the register's coverage; the clause's list is the register's evidence.
Neither is a substitute for the other.

**What is defective is that the clause cannot tell "no instrument named" from "named, no verdict
recorded" and does not notice that its input is older than the register.** Both are one-line reads
it does not do: it already parses the row, so it can see the `VERIFIED BY` marker itself, and
`register-reality.json` carries `generated`, which can be compared to the mtime of `docs/ROADMAP.md`.

### Verdict on the gate clause `no open, known engine defect`

Computed directly (not from a status run): **16 open rows assert breakage; 3 are `withRed` — #218,
#241, #258; 13 are `debt`; 0 `stale`; 0 `unrunnable`; 31 verdicts read.** The clause's `ok` is
`withRed.length === 0`, so it fails on **three** rows and the debt bucket does not hold it shut.
**The "three blocking rows vs five" framing does not survive contact with the code**: #318 and #319
cannot block this clause under either reading, because neither has an exit code. They are two of the
thirteen unmeasured.

### Is this ROADMAP #108

**No. It is the same SHAPE and a different pair.** #108 is `status.js` printing figures out of
artifacts that `provenance.js` calls UNSAFE — a status reader against a staleness gate. This is the
open-defect clause against `where.js` over the register's own coverage. Filed as its own row (see
§3), cross-referencing #108.

### What I did NOT do, and why

I did not edit `engine/quarantine.js`. ENGINE is live in the tree tonight on `tests/roster.js` and
the damage path, and `quarantine.js` is the file that runs the roster stages. Editing the gate while
another division is running it is the writing-agent-beside-a-measuring-agent shape this repository
has already paid 7,100 games for. The repair is one row and belongs to whoever holds the file next.

---

## 2. THE CARD REVIEW AGAINST THE REGISTER

Every finding was searched against the register by row number and by distinctive phrase (mechanism
name, hook name, Showdown source path). "NONE" below means no register row matched on any spelling
tried, and the spellings tried are named.

Method: every finding was searched against `docs/ROADMAP.md` by row number and by distinctive
phrase (mechanism name, hook name, Showdown source path). "NO ROW" below means no register row
matched on any spelling tried, and the tried spellings are named.

### Section A — ordering

| # | finding | register row before | verdict | action |
|---|---|---|---|---|
| A1 | `onDamagingHit` order AND frequency | **NONE** (`onDamagingHit` matched only #261, incidentally, about `frz.onDamagingHit`) | missing | **filed #329** |
| A2 | `onSwitchInPriority` not modelled | **NONE** (`onSwitchInPriority`, `switch-in priority`, `comparePriority` — no register row) | missing; this is the one the coordinator spot-checked and was right about | **filed #330** |
| A3 | faint announced inline, authority batches in `faintMessages` | **NONE.** `faintMessages` matches #243 and #247, both about `side.totalFainted` and the fallen counters, both CLOSED, neither about the ANNOUNCEMENT. #315 is the other half of the same `sim/battle.ts:2554-2571` region (a fainted mega's forme) and is open, but is a different fact | missing | **filed #331** |
| A4 | a berry is eaten before `upkeep` and before faints | **NONE.** #221 and #242 restructured the residual walk and are CLOSED; the card explicitly clears the residual ORDER as correct, so those rows are not this finding | missing | **filed #332** |

A4's own text is a good example of why the rollup could not find these: the residual half is
**sound**, and the card says so in writing. A class rollup that had flagged "residual" would have
pointed at the correct code.

### Section B — dice

| # | finding | register row before | verdict | action |
|---|---|---|---|---|
| B1 | multi-hit does not use the sixteen-index roll | **#304, and it is CLOSED.** Its status cell already names this: *"8 games survive, candidate is the declared per-hit multi-hit randomizer"*. A closed row naming a candidate is not an open row | drifted — the residue outlived the row | **filed #333**, cross-referencing #304 |
| B2 | confusion self-hit draws a different index | **NONE** (`confusion` matches #217, #253, #259, #260; none is the draw) | missing | **filed #334** |
| B3 | a per-target secondary lands on the wrong body | **#294 is the same shape one hook over, and #294 is CLOSED** (it fixed the ACCURACY roll) | missing for secondaries | **filed #335** |
| B4 | sleep — distribution right, draw address unverified | **NONE** | missing, and it is **not a defect claim** | **filed #336** with no defect token and an explicit `NOT A DEFECT` in the status cell, so it cannot inflate the gate |

### Section C — derivation gaps

| # | finding | register row before | verdict | action |
|---|---|---|---|---|
| C1 | `onTryImmunity` not derived, 6 legal moves | **PARTIAL.** #327 covers `immunityGate` on `move:trick` vs Sticky Hold (0 corpus uses); #323 records `move:leechseed / immunityGate` as a classifier FALSE POSITIVE. **Neither covers the hook**, and `endeavor` appears nowhere in the register | missing | **filed #337** |
| C2 | Life Orb recoil stored as prose, and absent for a turn | **PARTIAL.** #324 lists `item:lifeorb / damageMultAll.costsPerAttack` at 10.69% of corpus sheet entries among 119 unread tag values — the derivation half. #324 states *"none of these is a behavioural defect on its own — the mutation moved nothing"*, which is exactly what card 24 contradicts | the behavioural half was missing | **filed #338** as the counterexample to that sentence |
| C3 | spread-drain heals merged, per-target rounding | **PARTIAL.** #324 lists `move:matchagotcha / drain.{num,den}` at 4.36%. The arithmetic claim (1 HP less on 25.0% of two-target drains) is asserted nowhere | missing | **filed #339** |
| C4 | Guard Dog | **RETRACTED IN THE CARD FILE ITSELF.** `tests/test-tag-params-derived.js` already proves the predicate covers it; the row is absent because Guard Dog has **zero legal carriers**, and filing it by hand would have REVERSED #175 (match on tag SHAPE, never on a name) | **NOT FILED, DELIBERATELY** | none — and the derived facts it carries (exactly two abilities and one move carry `onDragOut` in the whole authority: Suction Cups, Guard Dog, Ingrain) are preserved in E2/E3 below |

### Section D — announcement shape

**RETRACTED IN THE CARD FILE ITSELF AND NOT FILED.** `game_differential.js`'s reducer strips
`[silent]`, `[still]`, `[miss]`, `[spread]` and `[anim]` as rendering hints, does `f.slice(0, 4)` on
any `|move|` line, and declares the `-sidestart` spellings equal. So the missing `[spread]`, the
different nominal target and the missing side name are real in the raw stream and **none of them can
cause a divergence**. Two of the twenty findings were raw-stream noise. Filing either would have
been a fabricated bug.

### Section E — state and bookkeeping

| # | finding | register row before | verdict | action |
|---|---|---|---|---|
| E1 | bench ORDER diverges; die REFUTED | **NONE.** The diagnosis landed in commit `11bab14`, and that commit added exactly one register row — #322, the charge-line fix. `bench order`, `party slot`, `partyMap` match no row | missing: a measured diagnosis with zero fixed points out of 3,118 index positions had no row at all | **filed #340** |
| E2 | Dragon Tail / Circle Throw ignore Suction Cups, probed red | **NONE.** `suction cups` matches only #141 (Mold Breaker's breakable set); `dragon tail` matches nothing | missing, and it is CONFIRMED rather than observed | **filed #341** |
| E3 | our phaze refusal emits an EXTRA `-fail`; `null` against `false` | **NONE, and it is FIXED.** #241 is the MIRROR direction (*"the authority announces a failure and this engine says nothing"*) and is still open on its part (3); this is the opposite symptom of the same root | fixed in `11bab14` with no row | **filed #342 CLOSED**, with the red-first arms and the over-fire proof recorded so it is not re-done |
| E4 | a corpse sits in one of our active slots | **NONE** | missing, and the card itself says it is *"flagged rather than claimed"* — zero divergent lines in the repaired game | **filed #344 with NO defect claim**; the status cell says `NOT A DEFECT until then`, so the gate excuses it and prints it by name |
| E5 | Morpeko — switch order, and a forme with nowhere to land | **YES — #328**, filed by ENGINE 2026-08-22, plus #204 for the forme half, whose five rows landed and are CLOSED | **has a row, and the row has moved PAST the card in the right direction**: the card calls card 21 a switch ORDER divergence that speed does not explain; #328 REFUTES that with a control (*"it is not a switch ORDER divergence at all: medicham2 emits no line for that slot"*) and names three defects on one shape | none — do not re-file, and do not quote the card's ordering framing |
| E6 | volatile counters — do they tick and expire on the same turn | **PARTIAL, and both parts are CLOSED.** #242 settled the residual expiry ORDER and which of 90 walk participants announce; #234 fixed the `[from]` attribution. **Neither asserts that a counter expires on the same TURN**, which is the card's question. #314 is the open row about the instrument that half-proves it | missing | **filed #345** |

Also landed in `11bab14` with no row, and recovered here: **a failed Roost emits two lines the
authority emits neither of, leaving the user still Flying there and grounded here.** That is
board-material — a Ground move that should be refused connects — and it was left undone on purpose
(one family per pass). **Filed #343.**

### Section F — the instrument

| # | finding | register row before | verdict | action |
|---|---|---|---|---|
| F1 | the harness manufactures divergences | **NONE — and it IS fixed. CONFIRMED, not assumed**: commit `ff7a2bc`, 2026-08-22 00:50, `engine/game_differential.js` +239 lines and a new `tests/test-forced-switch-mirror.js` (275 lines). Its ROADMAP diff is **empty** — `git show ff7a2bc -- docs/ROADMAP.md` returns nothing at all | fixed, no row | **filed #346 CLOSED**, carrying the second cause (`forced_switch_unmirrorable`), the `choices_refused` sabotage assertion, and the warning that class counts either side of it compare only as distributions |
| F2 | the roster credits Spiky Shield on a scenario that cannot fail | **NONE.** #232 and #238 are Protect / King's Shield ENGINE rows, both closed; neither is about the roster row | missing, and it is an INSTRUMENT weakness rather than a claim the mechanic is broken | **filed #347**, which also records that the authority's own `move: Protect` naming is CORRECT, so it is never filed as a defect later |
| F3 | `tools/lownode.cmd` argument quoting | **NONE.** #258 mentions `test-lownode` in a file list; #300 is the differential's unreachable catch on a bad `SHOWDOWN_PATH` | missing — and it has already truncated a `--why` string on a release cut | **filed #348** |
| F4 | `explain_divergence.js` advertised a `--explain` flag that never existed | **NONE, and it is FIXED. CONFIRMED**: `engine/explain_divergence.js:226` carries the comment *"THIS USED TO SAY re-run the differential with --explain. THERE IS NO `--explain` FLAG IN…"* and the run now names `replay_one.js` and `divergence_cards.js`. Landed in `11bab14` | fixed | **no row filed, deliberately** — a one-line help string, fixed, with no regression surface. Filing it would be register noise, and a row costs a reader |

### The preamble findings, which are not in the A-F list

The card review's opening section carries two measured claims about the rollup's ranking plus one
recommendation, and they are the reason the whole exercise happened — so they are filed rather than
left in prose: **#349**. One half is confirmed against the current file (`max_uses` is a max over
the entities named by BOTH lines of a pair, so the head can name the line WE emitted — the report's
own head read *"126,170 clicks, Protect"* for a `-start|typechange|[from] protean`). **The other
half is explicitly NOT confirmed**: a `SPECIES_USES` block reading `data/meta-usage.json` exists and
may already supply the species usage the card says prints as 0. The row says so rather than
asserting it. The recommendation — raise `--dump-games` from 40 to the low hundreds — is in the row
as the cheapest of the three actions.

---

## 3. WHAT WAS FILED

**22 rows, #329 to #350.** Every one verified through the canonical detectors
(`Q.roadmapRowIsClosed`, `Q.roadmapRowSaysBroken`) rather than by eye:

| rows | how the detectors read them | intended |
|---|---|---|
| #329-#335, #337-#341, #343, #345, #347-#350 (18) | open, asserts breakage | yes — real defects, every one DEBT until an instrument decides it |
| #342, #346 (2) | CLOSED | yes — fixed in `11bab14` and `ff7a2bc`, filed so they are not re-discovered |
| #336, #344 (2) | open, asserts NOTHING | yes — `NOT A DEFECT` in the status cell, because neither was probed to a verdict |

**The gate verdict did not move, and that is the point.** `no open, known engine defect` before:
16 open, `withRed` = 3 (#218, #241, #258). After: 34 open, `withRed` = **the same 3**. Debt went
13 to 31, and debt has never held the clause shut. Filing eighteen findings made the register more
honest without manufacturing a gate failure — which is the behaviour the clause was narrowed to
produce, working as designed.

`node engine/status.js`, run once on 2026-08-22, prints it:

    FAIL  no open, known engine defect   3 OPEN roadmap row(s) name an instrument that is RED: #218
          (94,313 uses), #241, #258. ... 3 open row(s) declare NOT A DEFECT in their status cell and
          are excused: #252 ...; #336 ...; #344 ... 31 open row(s) assert breakage with NO
          instrument that decides them - DEBT ... #318, #319 ...

**That is the same false sentence #350 is about, now over 31 rows instead of 13.** Nothing else from
that status run is quoted here: ENGINE was live in the tree (`tests/roster.js` is modified) and
reading an artifact another process may be writing produces a plausible, well-formed, fictitious
answer.

---

## 4. TWO THINGS THAT ARE OWED, AND ONE INCIDENT

**OWED 1 — `node engine/register_reality.js` has not been run since 02:33Z.** The artifact is now
**33 register rows behind** the file it audits: `where.js` prints `281 id rows then vs 314 now`.
Every one of the 22 rows filed today is invisible to the gate's evidence side until it runs. It is
cheap, it runs no games, and it is the single action that most improves what `status.js` can say.

**OWED 2 — the `SAFE` guard against the roster marker.** #318 and #319 name
`SHOWDOWN_PATH=... node tests/roster.js --stage moves`, which `register_reality.js` refuses to
execute by design (its guard accepts only a plain `node <repo script>.js [--flags]`). Either the
marker loses the environment prefix and the runner supplies it, or those two rows read
`INSTRUMENT UNRUNNABLE` permanently. That is a decision, not a bug, and it belongs with whoever owns
`tests/roster.js`.

**INCIDENT — THE SESSION SCRATCHPAD HAS A CONCURRENT WRITER, AND I EXECUTED A FILE I BELIEVED I HAD
WRITTEN MYSELF.** The scratchpad for this session holds files from at least two other agents, some
written DURING it: `probe2.js` 14:26, `qd-before.js` 14:25, `qd2.js` 14:26, `splice2.js` 14:29,
`entry-5640.md` 14:29 — none of them mine. A file I created earlier this session as `probe1.js` was,
by the time I re-ran it, a **different script** (mtime 04:29) that stages a board through
`tests/staged_board.js` on release `603d9a69d5a3` and plays four turns. **I ran it, expecting my own
seven-line probe.**

Checked immediately: **no repo damage.** `data/engine-release.json` carries mtime 04:28, before the
run, so the release pointer was not repointed; `git status` shows only `docs/ROADMAP.md` and this
report (mine), plus `tests/roster.js` and two generated data files (not mine).

This is CLAUDE.md's recorded hazard — *"execute nothing in the scratchpad you did not write this
session, and treat a filename you recognise as evidence that a previous session was here, not that
the file is yours"* — with one addition that made it worse: **recognising the name is not protection
when the name is one I chose.** Everything after that used a unique filename. **I deleted nothing.**
Every foreign file is reported here and left exactly where it is.
