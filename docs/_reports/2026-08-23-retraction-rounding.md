# ROADMAP #370 — the retraction registry matched on a rounded value

MEASURE, 2026-08-23. Instrument fix in `engine/docs_scan.js` and `tests/test-docs-current.js`.
Nothing was run that plays a game; nothing under `data/` was written.

---

## 1. The defect, reproduced RED before anything changed

Three synthetic documents were built in an isolated tree (a copy of `docs_scan.js` whose `ROOT`
is a scratch directory), so the demonstration goes through the real registry and the real
violation scan without writing a file into this repository.

    docs/RETRACTOR.md    The prior 63.2% exploitability figure is retracted.
                         The prior 9.7% divergence figure is retracted.
                         The prior 47.5% mirror figure is retracted.

    docs/RESTATER.md     A bot built only to counter MAG beats it 63% of the time.
                         Flare Blitz carries a 10% burn chance on contact.
                         Sucker Punch fails 48% of the time against a faster board.

Against the code as it stood:

| case | required | old rule | |
|---|---|---|---|
| 1. retracted `63.2%` vs a document writing `63%` | MUST match | matched | PASS |
| 2. retracted `9.7%` vs a bare `10%` | MUST NOT match | matched | **FAIL** |
| 3. retracted `47.5%` vs a Sucker Punch `48%` | MUST NOT match | matched | **FAIL** |

`2 of 3 cases RED`, passing exactly the one the clause exists for. The cause is one expression:

```js
const match = figs.find(f => f.pct === e.pct &&
  (f.value === e.value || Number(e.value.toFixed(f.dp)) === f.value));
```

`(9.7).toFixed(0)` is `"10"` and `(47.5).toFixed(0)` is `"48"`. The rounding had no bound.

## 2. The first fix was wrong, and the corpus said so

The obvious repair is a DIGIT PREFIX: the written figure must be the retracted one **truncated**
at the precision the document used. It satisfies all three specification cases — and it made the
instrument worse. `trunc(47.5, 0)` is `47`, so it swapped one collision family for another:

| | before | digit-prefix only |
|---|---|---|
| raw violations | 17 | **19** |
| new accusations | — | `docs/ENGINE.md:2489` (`\| ORDERING \| 12 \| 7 — 58% \| \| 15 \| 7 — 47% \|`), `docs/PUBLICATION.md:86` (*"Tailwind wins"? 47%*), `docs/ABRA-whitepaper.md:861`, `docs/SESSION-REVIEW-2026-07-28.md:279` |

It was discarded. A rule that satisfies the specification and still fires on a table cell has not
understood the defect. The attempt is recorded in the code comment so it is not tried again.

## 3. THE RULE NOW

Two independent guards, matching the two independent halves of the defect.

### (a) The match: shortening must not be a judgement call

A written figure is the retracted figure restated only when it is written **exactly**, or when
TRUNCATING and ROUNDING the retracted value at the document's precision give the **same digits**:

```
63.2 -> 63    truncate 63, round 63   AGREE      the same claim, written shorter
47.5 -> 48    truncate 47, round 48   DISAGREE   a decision was taken; refuse 47 AND 48
 9.7 -> 10    truncate  9, round 10   DISAGREE   refuse
```

Equivalently, the retracted value must sit in the lower half of the bucket the document's digits
name: `w <= v < w + 0.5 x 10^-dp`.

**Proximity is not the criterion and neither is "correct rounding".** `9.7`/`10` are closer than
`47.5`/`48`, and `63.2 -> 63` and `47.5 -> 48` are *both* correctly rounded — so any rule phrased
as "the document rounded it" has to accept case 3 and is dead on arrival. What separates them is
whether every reader shortening that figure would have written the same digits. The boundary is a
property of the decimal system, not a threshold tuned against this corpus: there is no knob.

### (b) The registry: a precision floor on percents

`isDistinctive` was `f => f.pct || f.value >= 1000` — any percent qualified. It is now

```js
const isDistinctive = f => (f.pct ? sigFigs(f.raw) >= 3 : f.value >= 1000);
```

The registry's own header already made this argument for a bare `17` ("a registry that fires on
every occurrence of a small integer is worse than no registry") and then exempted every percent
from it. A percent at two significant figures is that small integer wearing a unit: `10%`, `25%`,
`90%` are everywhere in this prose. The floor is **precision, not magnitude**, because precision is
what makes a collision unlikely — ~90 reachable values at two figures against ~900 at three.

**It is opt-in.** Trailing zeros count, so an author retracting a two-figure percent writes `44.0%`
and the entry registers. A retraction that will not state its own precision cannot accuse a table
cell.

This is what protects the Bright Powder accuracy row in `docs/ENGINE.md`
(`| into a Bright Powder holder (100 x 0.9 = 90) | 10.3% | 9.7% |`), which states `9.7%` EXACTLY.
No match rule can separate an accuracy from a divergence rate at the same value; only refusing to
register the entry can.

## 4. The three cases now

| case | required | new rule |
|---|---|---|
| 1. `63.2%` vs `63%` | MUST match | matches — **PASS** |
| 2. `9.7%` vs `10%` | MUST NOT | refused — **PASS** |
| 3. `47.5%` vs `48%` | MUST NOT | refused — **PASS** |

`all 3 cases green`, on the same scratch fixture that was red in §1.

## 5. The demonstration is now permanent, and both halves were shown red

`RETRACTION_CASES` / `retractionProof()` in `engine/docs_scan.js` — seven cases, each with a
`why`, run through the real derivation on in-memory documents (`read` is injected; nothing touches
disk). `tests/test-docs-current.js` clause 3b(a) asserts all seven before it reads a real document,
so a rule that quietly stops refusing a case FAILS BY NAME rather than appearing as a ratchet that
went quiet. Same discipline as the `equal`/`distinct` pairs on `game_differential`'s normaliser.

Shown red by deliberate break, one per guard, because a guard that nothing can break is unproven:

| break | result |
|---|---|
| restore `Number(e.value.toFixed(f.dp)) === f.value` | **FAIL** `spec-3-carry-up-is-not-a-restatement`, `floor-is-opt-in-and-the-match-still-refuses` |
| restore `isDistinctive = f => f.pct \|\| f.value >= 1000` | **FAIL** `two-significant-figures-do-not-register-at-all` |

The second break initially produced **nothing red** — the improved match rule already refuses
`9.7 -> 10`, so the precision floor had no case of its own. `two-significant-figures-do-not-register-at-all`
(the Bright Powder cell, stated exactly) was added for that reason. Without it the floor would
have been a guard nobody had ever seen fail.

## 6. Violation count, before and after

| | before | after |
|---|---|---|
| registry entries | 10 | **8** |
| strong entries (the ones that can fail a build) | 3 — `7971`, `63.2%`, `47.5%` | **3 — unchanged** |
| raw violations | 17 | **15** |
| distinct ratchet keys | 10 | **8** |
| new against the baseline | 0 | **0** |
| retired | 0 | **2** |

Matched exactly (5) is unchanged; matched by rounding falls 12 -> 10.

**A correction to the register row, which conflated two things.** #370 reads *"12 of the 17
surviving violations are rounding collisions"*. Twelve of seventeen matched by ROUNDING rather
than exactly — that is right — but only **three of those twelve are false**, and the other nine
are genuine restatements of the retracted `63.2%` as `63%`, which is case 1 and is precisely what
the clause is for (`docs/THE-PLAN.md:61,84,136`, `docs/SESSION-REVIEW-2026-07-28.md:118,132,133,279,370`,
`docs/POKER-TO-POKEMON.md:104`). The three false ones are the two `48%` hits killed here and
`docs/DEFENSE.md:24`, which is a subject collision and survives (§8). So the baseline
false-positive rate was **3 of 17, not 12 of 17**, and it is now **1 of 15**. The over-fire on the
`9.7%` entry — 52 of 56 — was real and is measured on a live entry; that number stands.

`data/docs-currency-baseline.json` was NOT touched and no entry was added to it. The ratchet is
monotone and reports `ratchet tightened: 2 entries retired`; the next `--update` locks in 8.

## 7. WHAT STOPPED BEING CAUGHT

**On this corpus, two hits, and both were false accusations:**

| | |
|---|---|
| `docs/BACKLOG.md:215` | *"we produce the single most common set **48%** of the time"* — accused of restating the retracted mirror control `47.5%` |
| `docs/archive/SESSION-2026-08-02.md:113` | *"Sucker Punch's 48% failure prices the missing opponent model."* — same |

Neither is about the mirror control. **No correctly-flagged figure was lost.**

Two registry entries also stopped being derived: a weak `63%` and a weak `10%`, both extracted
from `docs/ROADMAP.md:1180` — the register row that *describes this defect*. Both were weak, so
neither could fail a build; they polluted the printed registry.

**The classes of real violation this rule can no longer catch, stated rather than hidden:**

1. **A retracted percent written to fewer than three significant figures registers nothing.** A
   retraction of `44%` is now unenforceable. The author writes `44.0%` to opt in.
2. **An upward shortening.** A retracted `63.7%` restated as `64%` is not caught. Case 3 forbids
   catching it — `47.5 -> 48` is the same act.
3. **A tie shortening in either direction.** `47.5%` restated as `47%` is not caught either, and
   this is a real loss: it is indistinguishable from the `ORDERING` table cell in §2.
4. **Any shortening where truncating and rounding disagree** — `1234.567` restated as `1234.56`.

Losses 2-4 are forced by the specification. Loss 1 is a policy choice with an escape hatch.

## 8. THE RESIDUAL IS THE SUBJECT, AND YES, THE REGISTRY WOULD NEED TO CARRY IT

One false positive survives, and the fix above cannot reach it:

    docs/DEFENSE.md:24   "Measuring our bots against a corpus that is 63% other people's bots
                          and calling the difference..."

That `63%` is a corpus composition. It is accused of restating the retracted `63.2%`
exploitability figure because the two numbers agree and nothing in the registry knows what either
is ABOUT. Fourteen of the fifteen surviving hits are genuine restatements of the withdrawn
exploitability claim; this one is a coincidence at the same value. **A number-only registry cannot
tell them apart, and no arithmetic rule will.**

**The honest answer is that the registry would have to carry the retraction's SUBJECT.** Here is
what it costs, measured rather than asserted. The retracting lines do carry subject words
(`docs/ABRA-whitepaper.md:1560` *"ABRA publishes no exploitability figure. The prior 63.2%...is
retracted"*; `docs/MODELS.md:742` *"mirror control 47.5%"*), so extraction is feasible. Requiring a
subject token from the retracting line to appear within the accused paragraph:

| | |
|---|---|
| removes | 1 false accusation — `docs/DEFENSE.md:24` |
| **also removes** | **2 TRUE catches** — `docs/SESSION-REVIEW-2026-07-28.md:132` and `:133`, table rows reading `\| **alive-count + HP — two numbers** \| **63%** \|`, which restate the retracted figure with no subject word anywhere near them |

A markdown table row is a claim whose subject is three rows above it, and this is where a
subject rule breaks. Worse, the token list is HAND-WRITTEN — which reintroduces the hand-typed
registry this derivation was built to replace, and it would be a hand-typed list that can silence
the clause rather than one that can only extend it.

**Recommendation: do not build it now.** Trading two true catches for one false one, at the price
of a hand-maintained vocabulary, is a worse instrument. `docs/DEFENSE.md:24` is already in the
baseline, it is one line, and the right resolution is to fix the document (state the corpus figure
with its source) rather than to teach the gate to guess at meaning. Filed as the open remainder of
#370.

## 9. What was NOT run, and why

A pinned gate chain against release `c66976713feb` was live and writing `data/roster.*.json`,
`data/game-differential.json` and `data/all-mechanics-fire.json` throughout this pass.

- **`node engine/docs_scan.js` (full CLI) and `node tests/test-docs-current.js` (full) were not
  run.** Both reach `untraceableCensus` -> `allArtifactNumbers()`, which walks *every* `data/*.json`
  — including all three files under active write. A torn read there is not an error, it is a
  plausible census number. Clause 3b(a) and the proof were exercised in isolation instead; that is
  every clause this change can affect, and `retractionRegistry` / `retractionViolations` read no
  artifact at all.
- **`node engine/status.js --write` was not run.** `status.js` -> `quarantine.js` reads
  `data/roster.moves.json` and the roster stage artifacts, which `git status` shows modified right
  now. Stamping a torn read into the ledgers is exactly the failure this project has already paid
  for. **This is OWED** once the chain lands.
- **No heavy run, no game, no artifact written.** `data/docs-currency-baseline.json` and
  `docs/ROADMAP.md` were not touched.

## 10. Owed before this commits

- The living-docs pass: `CHANGELOG.md` entry, version bump, `docs/MEASURE.md`. Deliberately not
  done here — a version bump while another division's chain is mid-run collides with whatever
  else is in flight, and the coordinator owns that ordering.
- `node engine/status.js --write` after the chain lands.
- `node tests/test-docs-current.js` in full after the chain lands, to confirm the census clause is
  unaffected (it cannot be — nothing shared was changed — but "cannot be" is not a measurement).
- `docs/ROADMAP.md` #370: the arithmetic half is closed with a red demonstration per guard; the
  SUBJECT half (§8) remains open and is a document fix, not an instrument fix.
