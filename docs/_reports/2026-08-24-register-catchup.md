# The register, brought up to a very large day

**MEASURE, 2026-08-24.** Historical findings record. Not maintained, not current state, never cite it
as one. The register itself (`docs/ROADMAP.md`) is what this pass updated; read that, not this.

**No game was played. No engine was loaded. No fit was run. No test was added.** The only file
changed is `docs/ROADMAP.md`. No CHANGELOG entry was written and nothing was committed.

---

## 0. THE COUNT

| | before | after |
|---|---|---|
| register rows | 321 | **344** |
| open | 186 | **191** |
| closed | 135 | **153** |

- **9 rows closed that were open this morning** — #176, #223, #352, #357, #358, #359, #391, #398, #401
- **9 new rows filed already closed**, because the work landed and was probed today — #403 … #411
- **14 new rows filed open** — #412 … #425
- **11 rows re-scoped** — #183, #273, #351, #355, #376, #389, #396, #397, #400, #402, and the
  withdrawn step-list claim recorded inside #408

**The gate did not move and nothing here was capable of moving it.** The open-defect clause still
reads `ok = false` with the same four RED rows (#218, #224, #241, #273). No row was closed to make a
clause pass.

---

## 1. THE THING THAT WAS FLAT WRONG: THE SPEED TIES WERE RECORDED AS "NOT A DEFECT" IN TWO PLACES

**#376** carried the status cell *"DECISION NEEDED FROM WILL, **NOT A DEFECT**: an exact tie has no
correct answer, so this cannot be scored as breakage"*. That string is not decoration — it is a
mechanism. `roadmapRowSaysBroken` in `engine/quarantine.js` treats the literal phrase `NOT A DEFECT`
in a status cell as an **override**, and the row was being subtracted from the open-defect clause and
printed in its excused receipt. **A live turn-order defect was sitting under a heading that says
there is nothing to fix.**

The reasoning that put it there is true of the game and false of this harness:

- Showdown's tie shuffle is replaced by a **no-op in every shipped arm**.
- medicham2's tied-group key has had **its own named stream since 2026-08-20**, and the middle arm
  pins it to zero.
- 3.74.0 fixed the tie at the root, and the two `tie-second` arms were retired for *"breaking a
  correct one"*.

So both coins are already pinned, a tie **must** resolve identically under this pin, and three of them
do not. The cell now says `open — engine DEFECT (turn order)` with the earlier ruling explicitly
withdrawn, and it carries `VERIFIED BY: node engine/quarantine.js --order-probe`.

**The second place was worse to find.** #396 is a dated index of every whole-game mechanism, and one
of its inline entries read `exact speed ties 2 (**NOT A DEFECT**, order_probe measured speed_gap: 0,
same_priority: true — #376)`. Anyone reading the index rather than the row would have inherited the
same wrong conclusion. That entry is corrected in place and #396 now carries a SUPERSEDED-IN-PART
note naming the seven mechanisms in its table that have since closed.

**Nothing else in the register records a tie as declared or unfixable.** Every row mentioning a speed
tie, a tied group or `prng.shuffle` was read: #88 and #290 are closed correctly, #226 is a *correct*
record that the harness's synthetic spread ladder manufactures ties, #123 and #263 are about other
things. And `engine/quarantine.js` carries exactly two live declared rows — Moody (INCOMPARABLE) and
Supreme Overlord (AUTHORITY-WRONG). There is no speed-tie declaration anywhere.

---

## 2. WHAT CLOSED, AND ON WHAT

Every close below names an instrument. None rests on a report's say-so alone; the tag, the probe or
the counter was read in the tree first.

| row | mechanic | what closed it |
|---|---|---|
| #357 | **Rage Fist counts the hits its user has taken** | `move/variablePower`; 51/51/51 → 51/150/51 on three arms, and the PIVOT arm is the Champions-only reset |
| #352 | **Cloud Nine — the upkeep line, and the flag read live** | two probes, both clauses; the five carded weather games leave `by_cause` and nothing arrives |
| #359 | **Poltergeist names the item it is about to throw** | `probe_poltergeist_item_line.js`, RED 2 / GREEN 0, with Knock Off as an over-match control |
| #223 | **Regenerator's heal line** — the 2026-08-12 close had read mainline | `probe_regenerator_line.js`, three arms, HP asserted separately as a control |
| #358 | **A breaking Substitute writes `-end`** | landed in the narration batch — **and see §3, this row's own board-material claim was wrong** |
| #398 | **A clamped-to-zero stat change is still announced** | landed; 5 narration games, board-material did not rise |
| #401 | **Future Sight's delayed damage** | landed — **and the mechanism this row proposed was wrong; see §3** |
| #176 / #391 | **the effective-identity ratchet** | the ruler was **retired and replaced**, on Will's instruction, so the decision #391 asked for cannot be taken |

**Filed already closed** (the work landed today and had no row): Sucker Punch's queue clause (#403),
Struggle typed correctly in the damage path (#404), Unnerve reaching all five berry sites (#405), the
missing in-move `Update` step (#406), four more narration mechanics by reach (#407), two faint classes
converted (#408), the silent-catch ratchet (#409), the sealed species table (#410) and the identity
gate as a runtime tripwire (#411).

---

## 3. THREE THINGS THE REGISTER HAD RECORDED WRONGLY

These matter more than the count, because each one would have sent somebody at the wrong thing.

1. **#358 said the Substitute divergence was board-material.** It is not. Staged, this engine printed
   **both** lines on a break — the doll's HP was right all along and only the narration was wrong. The
   reclassification that created this row was itself a misread, in the other direction. The close says
   so. *(A real state defect was found behind it and is filed separately as #416.)*

2. **#401 said Future Sight's gap was a click-time snapshot.** It was the span-versus-index damage
   draw — ROADMAP #304 surviving in the one path #304's fix had not reached. The row is closed with its
   own proposed mechanism marked WITHDRAWN, because a wrong mechanism in a closed row is exactly what
   #398 and #400 exist to complain about.

3. **A claim in yesterday's faint work was withdrawn as false the same night, and it wanted a
   step-list restructure that is not owed.** The claim was that `_stepSelfPay` holds recoil and the
   Life Orb toll *above* the faint step. Measured on a staged board, this engine already emits damage
   → faint → recoil → Life Orb, which is the authority's order on all three arms. The withdrawal is
   recorded inside #408 so the restructure is not filed as work.

Also corrected: **#397 said six switch-in effects "do not fire at all".** Three are now closed
(Regenerator, Forecast, Symbiosis) and for Regenerator *"does not fire"* was never true — the heal
fired and only the announcement was missing. The row is narrowed to Psychic Terrain, Sand Spit and
Protean.

---

## 4. WHAT I REFUSED TO CLOSE, AND WHY

- **#389 (a red run must not publish its own finding).** The gate is built, committed and
  auto-registered, and four instruments were fixed behind it. But **MEASURE has not run it**, and
  `tests/test-mechanics.js` still sits inside that gate's own floor tagged `LAUNDERS` — the floor may
  only shrink by somebody removing it. Closing on another agent's report is the move this project has
  paid for repeatedly. It closes on the floor shrinking plus one verified run.
- **#397** — three of the six are unfixed and no probe covers any of them.
- **#400** — the status-move half is fixed and probed; the second-turn Phantom Force lock is untouched
  and unstaged.
- **#402 (the two withheld seed-prevalence figures).** Its `VERIFIED BY` runs green, and the register
  had therefore been calling it a STALE ROW. That marker decides the **lookup fix**, which is landed;
  it is structurally incapable of deciding the **withheld figures**, which need the pinned re-run. The
  row is narrowed to say that rather than closed on a green that answers a different question.
- **#183** — the count it was denominated in no longer exists, so the debt was restated in the new
  gate's own terms rather than left to go quiet.
- **#351 (Moody)** — the declaration landed and the engine may not be edited for it, but the address
  print the row asked for is still owed as confirmation, and the row deletes rather than persists the
  day the residual draw gets a shared stream.

---

## 5. THE FOUR JUDGEMENT CARDS ARE MARKED, NOT ANSWERED

`docs/_reports/2026-08-24-ordering-cards.md` holds four questions for Will. I answered none of them.
Each is now attached to the row it decides:

| card | row marked DECISION NEEDED |
|---|---|
| Two Tailwinds ending on the same turn | **#355** — derived to a genuine authority coin flip (its fifth sort key is never filled for a side clock) and measured as narration |
| The `ordering` class is mostly harness-invented ties | **#376** — the decision there is **priority only**, not whether it is a defect |
| Two more speed sorts still use the wrong algorithm | **#422** — new row; the mega site is board-material |
| A rollout has no coin to flip on an entry tie | **#423** — new row; not a correctness defect, a search-quality choice |

---

## 6. DEBT WAS LABELLED, NOT HIDDEN

Every new open row that asserts breakage with nothing that decides it carries `INSTRUMENT OWED` and a
`WHAT WOULD DECIDE IT` line — #413 through #421, plus #425. Rows where a gate does decide them carry
`VERIFIED BY` — #412 and #424. The clause's debt column went 53 → 58 and that is honest growth: the
rows now say what would have to be built.

---

## 7. OWED, NOT RUN

```
node engine/register_reality.js               NOT RUN — and this is the biggest gap.
                                              data/register-reality.json is stamped 2026-08-23T11:48Z
                                              (07:48 local). It names #391, which is now closed, and its
                                              verdicts predate ~14 hours of engine work. The four RED rows
                                              the open-defect clause reports today rest on that artifact.
                                              It cannot be run from this pass: it launches instruments on
                                              the do-not-run list, and `--list` is hard-banned (#369).
node engine/status.js --write                 NOT RUN (banned this pass). No division ledger's GENERATED
                                              block reflects today; docs/MEASURE.md still stamps 00:08.
node tests/test-red-run-writes.js             NOT RUN by MEASURE. #389 stays open on it.
the pinned seed-prevalence re-run             NOT RUN. The two figures stay WITHHELD (#402).
node engine/wire_ladder.js                    NOT RUN. Filed as #424 — all fifteen arms pin stranded
                                              releases, so it cannot produce a figure at all.
node engine/backtest_winrate.js               NOT RUN — it plays games. Leaf calibration therefore stays
                                              QUARANTINED and data/winrate-backtest.json stays stale.
game_differential / roster / all_mechanics_fire / test-mechanics / test-engine-diff / quarantine
                                              NOT RUN — all on the do-not-run list for this pass.
```

**Two untracked files were left alone as instructed** — `data/_pair-pilot.json` and
`data/medicham-represented-clicks.json`. Nothing was deleted.

**One thing read while another agent held the tree, and it is labelled rather than trusted:**
`tests/test-mechanics.js` is modified in the working copy by the live ENGINE agent, so the finding
that it still sits in `tests/test-red-run-writes.js`'s `ACCEPTED` floor tagged `LAUNDERS` is a read of
a moving file. It is written into #389 as the condition for closing, not as a verdict.

---

## 8. WHAT THIS PASS DOES NOT CLAIM

- **Not that the engine is correct.** The gate is unchanged and still fails.
- **Not that any closed row's number is current.** Several closes quote a whole-game figure measured on
  a release that has since moved; each one says which release and says it is a re-baseline rather than
  a delta, because six releases were cut under this day's work.
- **Not that the open list is complete.** It is complete against the ~20 reports of 2026-08-23 and
  2026-08-24 that I read. A defect nobody wrote a report about is still invisible to it.
