# The register, brought up to tonight's four batches

**MEASURE, 2026-08-24, overnight.** A dated findings record. It is never maintained and it is not
current state — the register itself (`docs/ROADMAP.md`) is what this pass updated, and that is what
to read.

**No game was played. No engine was loaded. No fit was run. No test was written.** One read-only
gate was run (`engine/gate_offfield_target.js`, which loads no simulator and writes no file) and it
decided a close. The only file changed is `docs/ROADMAP.md`. No CHANGELOG entry was written and
nothing was committed.

---

## 0. THE COUNT

Measured with `roadmapRowIsClosed` and `roadmapRowSaysBroken` imported from `engine/quarantine.js`,
so this pass and the gate cannot disagree about whether a row is closed.

| | before | after |
|---|---|---|
| register rows | 389 | **407** |
| open | 233 | **234** |
| closed | 156 | **173** |
| open rows that assert something is broken | 64 | **65** |

- **4 rows closed that were open this morning** — the switch-in priority key, Throat Chop's clock,
  Perish Song's phantom damage line, and the off-field placeholder.
- **13 new rows filed already closed**, because the work landed and was probed today.
- **5 new rows filed open.**
- **8 rows re-scoped or corrected**, two of them to record a ruling from Will.

**Nothing was closed to make a clause pass, and the one clause that moved moved on its own
instrument.** The off-field row closed because its own gate exits 0; the other three closed on a
census probe or on committed source. The open-defect clause still fails.

---

## 1. WHAT CLOSED, AND ON WHAT

Every close names an instrument, and in every case the instrument was READ in the tree rather than
taken from the batch report that proposed it.

| mechanic | what closed it |
|---|---|
| **the switch-in priority key** (Hospitality, Forecast, Unnerve, Klutz, Mimicry) | It was never missing. `data/switchin-order.json`, derived from the format on 2026-08-22, plus both entry comparators reading it in the COMMITTED engine bytes — 16 abilities declare it, 5 have a legal carrier here — and the counter that says it decided 60 real orderings in 120 games |
| **Throat Chop's silence** — three turns where the game gives two, on 5,071 uses | The census probe *"the silence lasts the turn it lands and ONE more, and its end is a line"*, live in `data/mechanics-census.json` (683 probed / 683 live / 0 missing) |
| **Perish Song's damage line** the real game never writes | The census probe *"the four perish deaths are announced BELOW all four perish0 lines, with no -damage"*, live, with a burn death as the control |
| **the `??:` placeholder** — an effect naming a body that is not on the field | Its own gate, run: `node engine/gate_offfield_target.js` **exit 0** against a CURRENT artifact at the tree's own release, `??:` occurrences 0 and the engine's own counter 0 |

**The switch-in one is the one worth remembering.** The register carried a row saying we do not model
switch-in priority *at all*. It had been implemented two days before that row was filed. It was
holding the engine gate shut for nothing, and it is now closed with the derivation written into it so
nobody re-opens it from the same stale note.

**The off-field one had closed and re-opened twice before**, so the row now says plainly what closes
it: not that somebody found the mechanism, but that the instrument reads zero on a current artifact.
It re-opens the moment either arm is non-zero.

### Filed already closed — the work landed and was probed today

Role Play resolving to a spent turn · a dragged-out body still taking its turn from the bench · a
status move walking past Follow Me · the wrong redirector when two are up · Clangorous Soul paying
before it boosts · the `-setboost` line for Belly Drum and Anger Point · an absorber announcing
"immune" beside its gift instead of instead of it · a bounced move writing no move line · a silent
re-banked Charge · a lumped spread drain · Mirror Armor announcing nothing · the entry-order tie
(which is what "Intimidate before Drizzle" was) · and a deliberate-break plant that went red because
a correct fix deleted the line it was anchored to.

**Each of those thirteen was checked against `data/mechanics-census.json` — probe present, `live:
true`, `hollow: false`, `armed: true` — rather than against the report that proposed it.** Two were
checked against other artifacts as well: the `-setboost` event is in `data/protocol-events.json`, and
Role Play has vanished from the committed whole-game artifact.

---

## 2. WHAT I REFUSED TO CLOSE, AND WHY

- **The two remaining wrong speed sorts.** The mega half landed tonight and is committed; the
  residual half did not. The row is narrowed to the residual sort rather than closed, and the mega
  half's close belongs to ENGINE, who measured it.
- **The three tied Protect orderings.** Will's ruling settles how the sample is built, not whether
  the three causes are a defect. They stay open and stay counted.
- **The two Tailwinds ending on the same turn.** The card's derivation was verified — the real game
  genuinely flips a coin there, and it genuinely is narration. **Nobody here may declare it.** A
  declaration subtracts a row from the gate, and this project has already had a live turn-order
  defect sitting under a heading reading "nothing to fix". It waits on one word from Will.
- **The represented-clicks number.** See §4 — the run is fine, the stamp is stale.
- **The perish faint's position.** It is blocked on something that does not exist yet (the residual
  handler list), so it is filed as blocked rather than as work anybody can pick up.

---

## 3. THE TWO RULINGS, RECORDED

- **The harness spread ladder stays as it is.** The proposal to jitter it — so that bodies whose base
  Speed differs by exactly one rung stop landing dead level, and the ordering class shrinks to what a
  real ladder produces — is **refused**. The manufactured ties stay in the sample and that class keeps
  its weight.
- **Rollouts get no coin, but they must know a tie when they see one.** Recorded as two halves with
  two owners: making the tie VISIBLE where it resolves is ENGINE's and is live; planning both branches
  is the search's and is **paused — filed, not queued**. No seeded baseline shifts, which was the cost
  the row had named.

Both are written into the rows they decide, with the option that was refused written down beside the
one that was chosen, so the question cannot be re-asked from scratch.

---

## 4. THE COVERAGE ARTIFACT — FULL RUN, STALE STAMP, NOT COMMITTED

`data/medicham-represented-clicks.json` is a **full run, not a scoped one.** Its generator takes the
standard clean open-sheet corpus through the shared loader with no thinning flag, no sample cap and
no games limit: **12,806 clean games and 298,910 real human clicks, of which 298,888 can be
represented — 99.9926%.** The table holds 42 kinds of action, where the register row about it still
says 12.

**It is nevertheless not publishable, and the reason is the stamp rather than the method.** It pins
itself to one build of the simulator and says in its own notes that a coverage figure transfers to no
other build. The simulator has moved through six releases since it was written, and one of them fixed
Role Play — which is 19 of the 22 clicks it still counts as unrepresentable. Its denominator moves as
well, because the store grows hourly.

**Left untracked and uncommitted, as instructed.** The row it belongs to now carries the measurement
and the reason it is not a headline. Re-running it on a settled engine is short work.

---

## 5. AN INCIDENT IN THIS PASS, REPORTED RATHER THAN TIDIED AWAY

I ran a small analysis script from the session scratchpad. **The write that was supposed to create it
had been blocked, so the filename I used already belonged to an earlier session's script — and that
script ran instead and inserted 12 duplicated rows into `docs/ROADMAP.md`.** It printed *"inserted 12
rows after line 1197"*, which is how it was caught.

It was undone immediately and verified undone by `git diff` reading empty against the committed file,
before any of this pass's work was written. Nothing else was touched.

This is the hazard CLAUDE.md already records about the shared scratchpad, arriving a second time
through the same door: a filename you recognise is evidence that a previous session was here, not
that the file is yours. Every later script in this pass used a unique name. **The leftover script was
NOT deleted** — it is not mine, and the rule is report it and leave it. It is
`rows.js` in this session's scratchpad directory.

---

## 6. OWED, NOT RUN

```
node engine/register_reality.js          NOT RUN — and it is still the biggest gap in the register.
                                         data/register-reality.json is stamped 2026-08-23T11:48Z. It
                                         names six red rows, and TWO of them (the silent-catch ratchet
                                         and the identity gate) have since been closed, so the artifact
                                         overstates. It cannot be run from this pass: it launches
                                         instruments on the do-not-run list, and `--list` is hard-banned
                                         because that "read-only" listing overwrites the verdict file.
node engine/status.js --write            NOT RUN (banned this pass). No division ledger's generated block
                                         reflects tonight.
node engine/backtest_winrate.js          NOT RUN — it plays games. Leaf calibration stays QUARANTINED and
                                         data/winrate-backtest.json stays stale. This is MEASURE's own
                                         standing number and it did not move tonight.
node engine/wire_ladder.js               NOT RUN. Every arm pins a stranded release, so it cannot produce
                                         a figure at all.
the pinned seed-prevalence re-run        NOT RUN. Those two figures stay withheld.
node tests/test-red-run-writes.js        NOT RUN by MEASURE, so the row that waits on it stays open.
engine/feature_fixture.js --check        NOT RUN. It failed before and after tonight's batches on the
                                         policy weights — the fixture moved and the damage table was
                                         regenerated. THAT IS THE REFIT QUESTION AND IT IS MEASURE'S.
                                         Nobody should restamp before it is settled: a restamp silences
                                         the table gate and writes over the evidence.
tests/interaction_matrix.js              NOT RUN — last run 2026-08-11, many engine releases ago.
tests/mutation_harness.js                NOT RUN — it writes; it needs --gate-only --no-write first.
engine/conformance.js                    NOT RUN — reported RED at HEAD by ENGINE, and nearly all of it
                                         is MEASURE/SEARCH artifacts with no attributable generator.
engine/selftest.js                       NOT RUN — reported RED at HEAD by ENGINE, on ladder-store
                                         declarations that are not this division's files.
game_differential / roster / all_mechanics_fire / test-mechanics / test-engine-diff / quarantine
                                         NOT RUN — all on the do-not-run list for this pass. Their
                                         COMMITTED artifacts were read, after ENGINE committed and the
                                         tree settled, and every reading says which artifact and when.
```

---

## 7. WHAT THIS PASS DOES NOT CLAIM

- **Not that the engine is correct.** The gate is unchanged and still fails.
- **Not that any closed row's number is current.** Several closes quote figures measured on releases
  that have since moved; each says which release, and says it is a re-baseline rather than a delta.
- **Not that the open list is complete.** It is complete against the four batch reports of 2026-08-24
  and the rows they touch. A defect nobody wrote a report about is still invisible to it.
- **Not that MEASURE's own number moved.** Leaf calibration is still quarantined and the winrate
  backtest is still stale. Nothing tonight was capable of moving it.
