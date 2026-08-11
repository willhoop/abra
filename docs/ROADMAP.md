# ABRA — roadmap

**2026-08-01**

The bar for the completed list is one thing: **would I defend this sentence for twenty hours against
someone trying to break it.** Anything that fails that test is in section 2 or section 3, however
much work went into it.

A result is only here if it is (a) measured rather than argued, (b) measured on data that passes
`engine/quality.js`, and (c) still true when re-run today. Several things that were on this list a
week ago have been removed for failing (c).

---

## 1. DONE — and defensible

### 1.1 The data is trustworthy, and we can prove which parts are not

**87% of the ladder store is unusable and we know exactly why.** 15,973 stored games, ~2,057 clean.
Bots, forfeits, partial brings and stubs, each counted separately in a funnel that anyone can re-run.
27 assertions in `tests/test-quality.js`.

**Behavioural bot detection works on accounts that do not announce themselves.** Team invariance:
an account playing 50+ games without ever changing a slot is a script. It caught six accounts that
appeared in **52.2%** of the games a name-only filter called clean. Carchdraw84172 played 459 games
with one team, 367 of them in a single day.

*Defensible because:* the rule is stated, the evidence is per-account, and the false-positive check
is published — no account with ≥50 games in the store has more than one distinct team, so the rule
separates cleanly.

*Known limit, stated:* a bot playing under 50 games or varying its team is invisible. The right
phrase is always "no bot detected", never "human".

### 1.2 The damage engine is correct

**31 of 31 scenarios within 2% of `@smogon/calc`**, through the official Showdown engine pinned at
commit `20ad99f`. Golden-master, re-run before every engine change.

*Defensible because:* it is validated against an independent implementation, not against itself, and
the harness caught two of its own wiring bugs on first run.

### 1.3 MAGNEMITE reads the board, and the improvement is measured out of sample

600 seed-matched battles per policy — same teams, same seeds, same engine — against 1,905 clean
ladder games:

| | before | after | real humans |
|---|---|---|---|
| super effective | 9.71% | **14.91%** | 21.37% |
| moves that outright failed | 9.68% | **6.34%** | 2.47% |
| moves that hit an immune target | 4.30% | **2.92%** | 1.91% |

*Defensible because:* the fit never saw the realism report — it was held back as the out-of-sample
check — and the comparison is paired on seeds so team difficulty cancels.

*What this does NOT claim:* that MAG is good. See 2.1.

### 1.4 Imitation is a ceiling, and we have the number

A challenger optimised for **winning** rather than for resembling humans, drawn from MAG's own 17
features, beats MAG **63.2%** — and beats MAG's predecessor **68.2%** where MAG itself manages
**60.2%**.

*Defensible because:* the 68.2% is an independent evaluation the search never optimised against, on
an opponent it was not tuned for. It is transitively better, not a counter.

> **RETRACTED 2026-08-04 — all three figures describe a 17-feature vector we no longer ship.** They
> were computed on an engine 25 wire-fixes old and **before the quality filter existed**;
> `provenance.js` carried `data/exploitability.json` as its only `UNSAFE` artifact on exactly that
> ground. The re-run on the shipped 58 features is **void** — `data/policy-weights.json` was refitted
> at 22:15:24 UTC while the search was running and `engine/medicham2-browser.js` moved twice more
> afterwards — and its hill-climb accepted **1 of 24** steps, so it was uninformative regardless. See
> `docs/SEARCH.md` §R8. **The claim of this section may still be true; the evidence for it no longer
> exists.** The general point that imitation and winning are different objectives stands on its own
> separate evidence (see MAGNEMITE in `docs/MODELS.md`), not on these three numbers.

*And it is interpretable:* the winning weights barely care about type effectiveness and care
enormously about not wasting a turn and finishing what is already hurt.

### 1.5 The open-sheet corpus is safe to learn from, and we checked rather than assumed

Teams differ enormously between open- and closed-sheet play — **551.9 points** of total absolute
species difference, Garchomp on 81.6% of open-sheet teams against 47.7% of closed. Behaviour given a
board differs by **at most 1.49 points** on every measure.

*Defensible because:* both sides were measured with the same code, and the policy is conditional on
the board — it never learns what to bring, and MEW draws teams from the ladder store regardless.
`engine/fit_policy.js` re-checks it on every refit by re-estimating on a reweighted sample.

### 1.6 Collection is complete and automatic

The Bo3 **open-team-sheet** ladder is now pulled hourly into its own store. That format carries
`Force Open Team Sheets`, so every game publishes all six sets — the only continuously-collected
corpus where the choice set of a decision is known rather than guessed.

*Defensible because:* the format's ruleset was read from the simulator, the pull was tested live, and
the store is separate — Bo3 is a different information regime and pooling it would corrupt every
behavioural statistic.

### 1.7 Facts the model can see are derived, never typed

Ability blocking (Levitate/Ground, Flash Fire/Fire, Good as Gold/status, Armor Tail/priority) is
**read out of 14,933 recorded battles**, not written down — including inferring *which rule* each
ability follows by testing candidate hypotheses and preferring the narrower on ties.

*Defensible because:* it was verified against clean-only data and every rule is identical; and
because probing Showdown's handlers directly was tried first and **failed silently**, which is why
the measured route was taken.

### 1.8 The project can audit itself

- `engine/provenance.js` — every artifact checked for staleness against the filter, its inputs, and
  the clean-game count. Found **28 unsafe to quote**.
- `engine/conformance.js` — S1–S13 as executable checks over 132 files. **S12 is now clean.**
- `engine/selftest.js` — 24 assertions on failures that are silent by nature.
- `build/build_pdfs.js` — every document has a current PDF, list derived.

*Defensible because:* each found real defects on its first run, including in the tool that found them.

---

## 2. NOT DONE — and specifically why

### 2.1 MAG is not good

It is **exploitable** (1.4), it still repeats Protect at roughly double the human rate, it wastes
6.34% of moves against a human 2.47%, and its one head-to-head win was against a baseline with a
flaw it was purpose-built to punish. **It is a starting position, not a player.**

### 2.2 The self-play ladder has produced no evidence

One confirmed promotion. The round robin that would establish whether the ladder climbs or goes in
circles has never had enough games to resolve anything. Reported as a null.

### 2.3 ~~Twenty-eight artifacts are unsafe to quote~~ — CLOSED 2026-07-31

**0 UNSAFE, 45 ok.** Twenty-five were regenerated by re-running their own generators; the last was
fixed by addressing what the gate was actually complaining about. `provenance.js --strict` is wired
into the suite and green. This was named "the blocker on everything in section 3" and it is no
longer blocking anything.

**Two real bugs were underneath the staleness**, neither of which waiving by name would have found:
`illusion.json` carried a sound raw-store justification in its generator that never travelled to the
artifact; `archetypes.json` reported **team sides** (2 per game) under the name `n_games`, so every
share and silhouette in it had the wrong sample size on its label.

**What this does NOT establish.** `provenance.js` says so itself: it checks what artifacts DECLARE.
0 UNSAFE means nothing is misdeclared, not that every number is right. **14 are still flagged
"possibly stale"**, and only re-running a generator can settle whether its output is correct.

### 2.4 Models that are retracted, null, or without usable input

Recorded so they are not quoted again:

| model | state |
|---|---|
| **PORY** | its comparison artifact was trained without the filter; standing **unknown**, not weak |
| **SLOWKING** | mathematics sound, but the clean matrix has **0 decisive matchups** — no usable input |
| **GURU** | 0 decisive matchups on clean data; descriptive only |
| **JOLTEON** | ties a coin; recommended for retirement |
| **WAR** | withdrawn — the signal was four bots playing one team 1,446 times |
| **CHOMP-EV** | honest null; brings do not separate from a coin |
| **the 199,524-game self-play corpus** | unusable — generated before megas worked, with duplicate Protects on one set |
| **"the meta is rock-paper-scissors"** | withdrawn; computed pre-filter, deleted |

### 2.5 Nothing here handles hidden information

Self-play has none — we run both sides. Nothing in the current work teaches the bot to play against
an unknown team, which is the defining difficulty of the closed-sheet ladder.

---

## 2.6 Closed since this list was written (2026-07-29 → 30)

Items 3, 4 and 5 below have shipped. Recorded rather than deleted, because a roadmap that quietly
drops its own entries cannot be audited.

- **"Give MAG a damage calculation, and a KO check both ways"** — DONE. `board.js` calls the real
  damage engine throughout; `koTarget`, `killIsRoll`, `diesBeforeMoving` and the switch-survival
  features all read it.
- **"Score both Pokémon together"** — BUILT AND MEASURED, and it **lost**: 42.0% [39.9, 44.3] over
  1,934 paired games, 28.4% of decisive pairs, against its own zeroed control. The imitation fit is
  refuted; the idea is not. Now item 1 below.
- **"Switching"** — no longer a coin flip. Voluntary switches score through `switchFeatures`, the
  post-KO replacement is scored rather than rolled, and `entryHits = forced ? 0 : 1` separates the
  two cases.

**A process failure that caused real damage, recorded so it is not repeated.** On 2026-07-30 the
model family was repeatedly mischaracterised in conversation — DODUO described as unbuilt when it had
been built, wired, controlled and measured; MEDICHAM audited in its graveyard version; top-K pruning
"proposed" when `fit_joint.js` already had it. Cause: two full days and ~40 commits of work existed
in NO document. `MODELS.md` was last written 2026-07-28; every other living doc 2026-07-26. The only
reason DODUO's verdict was findable at all is that its experiment happened on the one day `MODELS.md`
was touched. **CLAUDE.md requires the docs to move in the same pass as the code. They did not.**

---

## 2.7 Closed 2026-07-31

- **"Choice lock in the candidate set"** (was item 2) — DONE. The logit denominator no longer
  contains moves the human could not click. After the refit, six of eight switch features clear
  zero, and **switches now win the argmax** where `--switching` previously changed nothing.
- **The tag artifact reaches the feature vector** — `speedSwing` +0.983, `screenValue` +1.128,
  `healValue` +2.220, all clearing zero by wide margins. 53 → 56 features. This is the first
  feature addition since 3.28.0's four nulls to measure as real, and the difference is that these
  are CONDITIONS on mechanics with no prior representation rather than restatements.
- **ALAKAZAM job 2 (guess what they will do)** — built, off by default, needs a refit. The max in
  `incomingThreat` is now an expectation over P(their action).
- **A gate against wasted runs** — `engine/preflight.js`, 24 games, refuses a training run whose
  feature blocks receive no gradient. Two 1.5-hour runs were lost to exactly that before it existed.

---

## 2.8 Closed 2026-07-31 (evening)

- **DODUO is trainable for winning** (was item 1, the top of section 3). Wiring only, as the item
  predicted. `--joint` trains the 74-length vector on the game result; `--joint-only` freezes the 56
  singles so the whole trust-region step reaches the 18 pair terms. Four separate faults would each
  have produced a plausible, wrong learning curve, and every one was caught by a check rather than by
  reading. **The head-to-head is running; no win rate is claimed.**
- **The trust region starved the pair block, structurally.** The first run moved it 4.7% while the
  singles moved 21.7% — single features appear in nearly every choice set, pair features are sparse,
  so they lose a shared budget by construction and more iterations scale both equally. `--joint-only`
  took it to **40.0%**, with three sign flips: `overkill` −0.951 → **+0.980**, `focusFireKills`
  −0.107 → **+1.094**, `partnerCoversMe` −0.004 → **+0.639**, and `bothSameTarget` 0.031 → **2.249**.
  The imitation fit penalised focus fire; training to win reverses it.
- **`mew_farm` exited 0 with every worker dead.** A farm that wrote zero games was indistinguishable,
  to anything checking the exit code, from a clean run. Found because the DODUO gate refused to start.
- **The speed-multiplier divergence is cross-checked** (systems audit R2, which the audit could not
  finish because `board.js` was off-limits mid-run). `tests/test-speed-multipliers.js`, 15 passed,
  compares behaviour as ratios and compares the SETS, so a new weather-speed ability in the dex cannot
  hide behind four passing constants.
- **A test that asserted a count.** `sanity_check.py` required Sun > 1000 teams; Sun is the third
  largest of eight styles. Now relative and mutation-tested. **96 passed, 0 failed.**
- **All twelve recommendations from the three 2026-07-31 reviews are closed.** Including the two that
  had been built but never reached a reader: the multiplicity correction (on disk since 14:04, in no
  reader-facing document) and the retired NMF justification, still live in `PUBLICATION.md` — the
  document that exists to be published — while the honest version sat in `SUMMARY.md`.
- **There is a rollback point.** `v3.31.0`, tagged and pushed, with the one known failure named in the
  tag message. Both reviews had recorded that nothing existed to roll back to.

---

## 2.9 Closed 2026-08-01 (live play against a human)

Will played MAG in the real Showdown client for the first time — six games. **Eleven defects in about
two hours**, more than the 47 test files had surfaced. Full evidence:
`docs/FINDINGS-2026-08-01-live-play.md`. Handoff: `docs/HANDOFF-2026-08-01.md`.

- **The bot was not delivering the model to the board.** `makeScoringPlayer(opts)` accepted an options
  object and never used it — the class reads its own second constructor argument — so
  `{greedy: true, switching: true}` configured nothing. MAG played its first real games *sampling* its
  moves instead of taking its best one. Fixed by merging factory options into constructor options.
- **`joint: true` silently disabled mega evolution.** `_withMega` had exactly one call site and the
  joint path returned around it. Both joint paths now go through it, and `test-wiring.js` re-asserts
  mega, aiming and open sheets **under `--joint`** — the broken cell was the intersection of two
  capabilities each tested alone. Fourth mega defect in this project.
- **Voluntary switching was reverted to off.** The bot had requested it since its first version,
  against `mew.js:135`'s measured verdict of a **10-point loss** — **RETRACTED 2026-08-06 as
  unattributable and confounded: it ran through medicham2 playouts predating WIRES 123-128, its
  artifact carries no `engine_release` stamp, and `bringIn()` selects `live(bench)[0]` so the
  experiment measured switching to an ARBITRARY body, which the engine itself calls "evaluating
  LEAVE" rather than evaluating a switch. See #63.** It only took effect once the options
  bug was fixed — an unmeasured change against a measured result.
- **Item Clause repair could never succeed.** It resampled while telling the sampler the answer had to
  be the colliding item, so the "rare" no-item fallback fired every time.
- Open team sheets are now accepted; failed team draws redraw instead of rejecting the challenge.

**Nothing about MAG's playing strength was established.** MAG went 1–2 in the three games where the
policy was actually driving. Six games is not evidence in either direction.

---

## 3. NEXT — in order, with the reason each is next

**0. REFIT — and it may rewrite item 1 below.** `board.js` changed a feature's *meaning* under an
unchanged *name*, so every shipped weight was fitted against the old definition. `board.js` is
required by 40 files; the vector is read by 24. Nothing in the project detects this:
`magnemite.js:297` compares feature names and `:299` compares vector length, and both pass when
semantics drift. A guard — a stored hash of each feature's values over a fixed fixture board — is the
cheapest high-leverage item on this list, and the only one that prevents a repeat rather than fixing
an instance.

**Why this comes before item 1, and may dissolve it.** Item 1 rests on `spreadFreeBesideAlly` being
priced at −5.054, read as *"humans rarely click this, not this is bad."* That feature fires only when
`allyHit === 0`, and `allyHit` used `getEffectiveness >= 0`, which **returns 0 for an immunity**. So
the feature's coverage was inverted at its most important case:

| ally beside a spread move | did `spreadFreeBesideAlly` fire? | is it actually free? |
| --- | --- | --- |
| Flying partner + Earthquake | **no** | **yes — fully immune** |
| Levitate partner + Earthquake | yes (ability path) | yes |
| merely *resisting* partner | yes | no — it still takes damage |

The clearest free-spread case in VGC never fired once, while a case that costs real HP did. A weight
fitted on that is a weight fitted on the wrong question, and **−5.054 may be an artifact rather than
a preference.** Stated as a hypothesis; the refit is the test. If it survives the refit, item 1 stands
exactly as written.

> ### RESOLVED 2026-08-01 — it WAS an artifact, and of something else entirely
>
> **The immunity hypothesis above is refuted, and the conclusion it was reaching for is confirmed by
> a different cause.** Both fits were re-run.
>
> **The refit alone changed almost nothing.** `allyHit` moved from −0.0187 to −0.0126 (unweighted
> −0.0937 → −0.0875) — about **0.2 standard errors**, i.e. noise. Measured rather than argued: the
> immunity fix changes **0.198% of candidates**, and `allyHit` fires on only 0.63% of them to begin
> with. So the honest reading of `allyHit` is the plain one — **humans do not avoid hitting their own
> partner much** — and it should be reported that way rather than re-explained.
>
> **What produced −4.986 was the FITTER, not the feature.** `fit_joint.js` matched a human's click by
> requiring the candidate's target to match, and `board.js` builds a spread candidate with
> `targetMon: null` because Earthquake is not aimed. **No spread click could ever match.** Measured
> over 400 corpus games: spread moves are **14.94% of all human move clicks**, 99.71% carry a recorded
> target, and **1,393 of 1,397 failed to match**. Because a joint turn needs both slots, the loss
> compounded — the fit discarded **57,486 of 82,483 joint turns** and estimated 74 weights from 30% of
> the data. The discarded 70% was not random: it was exactly the turns containing a spread move.
>
> `spreadFreeBesideAlly` therefore fired on 8.0% of the enumerated alternatives and **0 of 1,461 pairs
> a human actually chose**, and a conditional logit reads "always available, never chosen" as a large
> negative. `fit_policy.js:432` had this right all along, so the **56-feature vector was never
> affected**.
>
> Corrected, on 63,305 usable turns, **nine of eighteen pair weights flip sign**:
>
> | pair term | old | refit + matcher fix |
> |---|---|---|
> | `spreadFreeBesideAlly` | −4.986 | **+0.863** |
> | `terrainSetupHelpsPartner` | −4.125 | **+2.005** |
> | `screenWhileThreatened` | −2.982 | **+0.110** |
> | `speedSetupHelpsPartner` | −1.595 | **+0.540** |
> | `weatherSetupHelpsPartner` | −0.549 | **+1.292** |
>
> Every "one slot sets up, the partner benefits" term was negative and is now positive. Held out, the
> joint layer takes top-1 from 9.7% to 11.5%.
>
> **And it wins.** Refit+fix against the shipped vector, seed-paired, greedy and joint on both arms,
> on three disjoint seed blocks:
>
> | run | games | decisive pairs to the refit | SPRT decided at |
> |---|---|---|---|
> | first | 17,350 | 66.7% | 78 decisive pairs |
> | replication | 1,934 | 65.9% | 69 |
> | challenger in arm 1, as convention | 1,932 | **70.9%** [66.0, 75.4] | 71 |
>
> The third is the one to quote: `sprt.js` and `paired_h2h.js` were run over it independently and
> agree to the decimal. All three are far past the 55% ship threshold, and every one was decided
> inside ~420 games — the fixed 200,000-game run this started as was 99.8% waste.
>
> **Item 1's stated premise is void.** It reads −5.054 as evidence that the imitation objective prices
> good play badly. That number was a fitter defect. Item 1 may still be worth doing — the objective
> argument has independent support from greedy — but **this is no longer evidence for it**, and
> DODUO's 42.0% was measured with the contaminated vector and no longer describes the current one.
>
> **A correction about the analysers, recorded because it was nearly shipped as a fix.** The first
> reading of this H2H looked inverted, and `sprt.js` was changed to treat arm 2 as the challenger on
> the strength of `mew.js:215` calling `--weights2` "the challenger". That comment is about the
> EXPLOITABILITY search, not the standard A/B. **Arm 1 is the challenger** — `paired_h2h.js:183` builds
> its NEW label from arm 1, and the run that measured greedy at 79.7% put `--greedy` on arm 1. The
> change was reverted; making it would have put the two analysers at odds and inverted every run
> already analysed. What WAS wrong is narrower: sprt's name-based fallback hardcoded `'score'` as the
> new arm, so on `--policy prior --policy2 score` it disagreed with its own arm-based path. Fixed, and
> `tests/test-sprt-arm-sign.js` now asserts the two analysers use the same rule so they cannot drift.

**1. DODUO trained for WINNING, not for resemblance.** *The most precise open question in the
project.* DODUO is fully built: `fit_joint.js` fits the pair block, `magnemite.js` plays it
(`--joint`), `--joint-zero` is a true control running the whole pair path with only the coordination
weights zeroed, top-K is capped, and fallbacks are counted in `stats.jointFellBack`. It lost at
42.0%, and the fit itself says why — it prices `spreadFreeBesideAlly` at **−5.054**, which means
*humans rarely click this*, not *this is bad*. A bot told to avoid a free spread move beside its own
ally by −5 will decline its best plays.

2026-07-30 established the pattern that makes this item one: **four knowledge additions produced four
nulls; two changes to the OBJECTIVE produced two large wins** (greedy +12 points / 79.7% of decisive
pairs; self-play 55.9%). The objective is the binding constraint, and DODUO has only ever been fitted
to the losing one.

> **RECONCILED 2026-07-31.** That 55.9% was measured on the **53-feature vector with switching OFF**. Repeating the experiment on the **56-feature vector with switching ON** gives **48.1%** [46.5, 49.8] over 9,728 paired games — a interval entirely below 50, i.e. self-play training made the policy *worse*. Both numbers stand as measurements of different configurations; neither generalises to 'self-play helps'. The difference is not explained, and three candidate causes are untested: switching exploration being harmful (which used to be supported by the older 10-point switching loss — **that figure is RETRACTED 2026-08-06 as unattributable and confounded**: medicham2 playouts predating WIRES 123-128, no `engine_release` stamp, and `bringIn()` selects `live(bench)[0]`, so it measured switching to an ARBITRARY body rather than to a chosen one. The candidate cause stands; its supporting evidence does not. See #63), 36.5% drift over 18 iterations, or self-play eroding imitation-fitted features that were already good.

> **THE WIRING IS DONE, 2026-07-31 (commit `ce5367c`).** It was wiring, as this item predicted, and
> the arithmetic in the sentence below was wrong in its parts while right in its total: the vector is
> **56 singles + 18 pair terms = 74**, not 53 + 21.
>
> The pair softmax is `P(q) = exp(s_q)/Σ exp(s_k)` with `s_q = wS·xa + wS·xb + wJ·jf`, so the feature
> vector attached to pair *q* is the concatenation `[xa + xb, jf]` — the two single vectors **summed**,
> because both are scored by the same single block. `accumulateLogitGrad` was already generic over
> length, so no new mathematics was needed.
>
> **Four separate faults would each have produced a plausible and wrong learning curve**, and every
> one was caught by a check rather than by reading the code:
>
> | fault | what it would have looked like |
> |---|---|
> | `mew.js` sized the run gradient from the **single** weight file and summed with `k < GRAD.length` | 74 truncated to 56 — every pair weight silently dropped, curve printed as normal |
> | `magnemite.js` allocated `learnGrad` ~50 lines **before** `this.wj` loaded, so `this.joint` was still false | every joint player returns 56 entries; caught by the above on the first 6-game probe |
> | `magnemite.js` read the joint vector from a **hardcoded** path | every iteration replays the frozen shipped fit; pair terms never move; flat curve reads as convergence |
> | `preflight.js` indexed only `B.FEATURES` | the gate certifies a joint run **without checking the block that run exists to train** |
>
> `--joint` on one arm is the A/B experiment, not a training configuration. `mew.js` now refuses
> `--learn` with the layer on one side (the run gradient sums both sides, and index *k* is a different
> feature in each); `train_policy.js` adds the mirror flag rather than leaving it to be remembered.
>
> **Measured:** preflight at 24 games with `--joint --joint2 --switching --switching2` — every block
> live, pair block 15 of 18 live, |gradient| 9.12. Two real iterations at 40 games each move the pair
> terms on their own merit: `bothSameTarget` **+0.164** (third-largest change in the whole 74-vector),
> `overkill` **+0.120**, `focusFireKills` **+0.094**. Suite 40 passed / 2 failed, the same two known
> failures.
>
> **TRAINED 2026-07-31 (evening).** 12 iterations x 5,000 games with `--joint-only`, which freezes
> the 56 singles so the whole step reaches the pair block (the first run, unfrozen, moved it 4.7% --
> see 2.8). Pair block moved **40.0%** of its own length; singles moved **0.000**, verified, so the
> head-to-head differs in the 18 coordination weights and nothing else.
>
> | pair term | resemble | win | |
> |---|---|---|---|
> | `bothSameTarget` | 0.031 | **2.249** | |
> | `overkill` | −0.951 | **+0.980** | SIGN FLIP |
> | `focusFireKills` | −0.107 | **+1.094** | SIGN FLIP |
> | `partnerCoversMe` | −0.004 | **+0.639** | SIGN FLIP |
> | `spreadFreeBesideAlly` | −4.986 | −4.815 | *barely moved* |
>
> Three of the four largest changes are sign flips and they tell one story: **the imitation fit
> penalised focus fire, and training to win reverses it.** Humans spread damage; winning concentrates
> it.
>
> **`spreadFreeBesideAlly` is the exception and it is this item own headline weight.** The argument
> above is that a bot told to avoid a free spread move beside its ally by −5 will decline its best
> plays. After training it is −4.8. Whatever moved the other three did not move this one, and that is
> unexplained.
>
> **WHY IT DID NOT MOVE — ANSWERED 2026-07-31 (Will).** Not cancellation and not a dead feature: the
> gradient was **positive in all 12 iterations, never once negative**, so the evidence is unanimous
> that −4.99 is too negative. It is ~13x smaller per round than `bothSameTarget` because the feature
> UNDER-FIRES, and the reason is a detector that is too narrow:
>
> ```js
> const freeSpread = (c, x) => c && c.move && c.spread && c.spread.length > 1 && F(x, 'allyHit') === 0;
> ```
>
> `allyHit` is a SINGLE-SLOT feature computed from the partner's TYPE and ABILITY — Levitate, Flash
> Fire, Volt Absorb, Earth Eater, or resisting the type. **A partner who clicks PROTECT is spared
> exactly as completely as a Flying partner, and the feature cannot see it**, because Protect is not a
> property of the partner; it is a choice the partner makes that turn.
>
> That is structural, and it is the whole argument for the pair layer: `spreadFreeBesideAlly` RECEIVES
> both candidates and reads the `allyHit` of its own slot only. The partner's Protect is already in
> hand and is never consulted.
>
> **Measured cost:** Earthquake is on **69 of 308 species (22.4%)**, by far the commonest spread move,
> and it is `allAdjacent` — so today it qualifies only when the partner is immune. 40 species (13.0%)
> carry an `allAdjacentFoes` move that spares the ally automatically; 83 (26.9%) carry an
> `allAdjacent` move that does not. The commonest real line in VGC — Earthquake plus partner Protect —
> is in the second group and is invisible.
>
> **FIX, QUEUED (board.js was in use by the head-to-head, per the no-edit-during-a-run rule):** extend
> `freeSpread` to treat the partner candidate as sparing the ally when it is a protect-family move.
> `PROTECTMOVES` and `tgtMayProtect` already exist, so nothing is typed in.
>
> **WIDE GUARD: RESOLVED, and it is BOTH cases depending on whose side it is on.** On MY side it
> spares my partner from my own spread move exactly as Protect does. On the FOE side it blocks my
> spread move outright, which is an anti-synergy and belongs in the dead-move tests, not here.
>
> **THE FULL SET IS DERIVED, NOT TYPED** — probe each candidate move's volatile/side condition by
> calling its real `onTryHit` against the actual spread move, the same technique `entryEffects` and
> `speedStub` already use. Measured 2026-07-31:
>
> | spares the ally (10) | excluded, and why |
> |---|---|
> | Protect, Detect, Spiky Shield, Baneful Bunker, Burning Bulwark, Silk Trap, King's Shield, Obstruct, Wide Guard, Mat Block | **Quick Guard** — priority only; **Crafty Shield** — status only; **Endure** — no `onTryHit` at all, it prevents FAINTING, not damage |
>
> Three flag-based shortcuts were tried and are all WRONG, recorded so they are not retried:
> `stallingMove` admits **Endure**; the presence of `onTryHit` admits **Quick Guard and Crafty
> Shield**; `target === 'allySide'` admits both of those and misses every self-targeting Protect.
> Only running the handler against the move separates them.
>
> **This weakens the interpretation of the head-to-head now running.** Both arms share the same
> detector, so the comparison is still fair, but neither arm can express the coordination pattern the
> feature is named for.
>
> **MEASURED 2026-07-31. IT LOST.** 194,514 paired games, 97,257 complete pairs.
>
> | | |
> |---|---|
> | decisive pairs | **26,405** (27.1% of all pairs) |
> | NEW (trained to win) takes | **45.7%**, 95% CI **[45.1, 46.3]** |
> | verdict | **worse, and the interval clears 50** |
>
> Training the 18 coordination weights on the game result made the policy WORSE than the same
> weights fitted to imitate a human click. The three sign flips that looked like a coherent story
> about focus fire do not pay.
>
> **The likely reason is in the same table: 72.9% of pairs were 1-1 splits**, i.e. the TEAM decided
> the game and not the policy. That contamination is in the TRAINING gradient too, so REINFORCE on
> win/loss was mostly fitting a team lottery. The objective was right; the ESTIMATOR of it was not.
> Three fixes follow, and none of them is "go back to imitation":
>   1. **Pair the TRAINING runs** as the tests already are, so team luck cancels out of the gradient.
>   2. **Score decisions against a win-probability baseline** (PORY) rather than the final result, so
>      a move is credited with what it changed instead of what happened six turns later.
>   3. **Train against a pool, not only against self** — a self-play policy beats its training
>      partner, and this one had never faced the imitation policy until the head-to-head it lost.
>      That is VGC-Bench's own finding, already recorded in docs/COMPETITORS.md.
>
> **CAVEAT, AND IT IS LARGE.** The whole-repo review found `engine/fit_policy.js:170` computes the
> reweighting factors from ONE store and applies them across all three, so the shipped weight vector
> was fitted against the wrong population. Both arms here share those singles, so this comparison is
> internally fair — but every ABSOLUTE number in this project is provisional until that refit.
>
> **`engine/sprt.js` reached this verdict after 3,516 games instead of 194,514 — 98.2% of the run
> saved.** `--verify` confirms it agrees with `paired_h2h.js` exactly (12,073 and 14,332 on both
> readers). A 136-minute run becomes about two and a half minutes.
>
> What remains:
>
> ```
> node engine/train_policy.js --joint --switching --switching2 --procs 6 --iters <N> --games <G>
> ```
>
> then the head-to-head the trainer now prints, in which **both arms run the pair path with identical
> singles and only the 18 pair weights differ** — so it measures *trained to win* against *fitted to
> resemble*, and nothing else. The previous printout passed a 74-length file to `--weights`, which
> would have been rejected outright or, worse, run an experiment whose arms differed in the wrong block.

*A trap already paid for once:* `fit_joint` fits its single block and its pair block TOGETHER, and 23
of 48 features carry opposite signs between that fit and the shipped one. Mixing the two vectors lost
31.2% on decisive pairs and would have been reported as "coordination does not help."

**2. Re-run WOBBUFFET against the current vector.** *(Will, 2026-07-30: put this back on the list.)*
**ATTEMPTED 2026-08-04 AND VOID — still open, and now there is no number at all rather than a stale
one.** ~~Its result is still the most important number in the repo and it is three
feature-generations stale: a counter found in forty minutes beat MAG **63.2%** [56.6, 69.3] on the
17-feature vector, mirror control 47.5%.~~ The re-run's defender was refitted mid-run and the
simulator moved twice more; separately its hill-climb accepted 1 of 24 steps, so `exploit.js` needs a
stamp and a dimension-aware step rule before the next attempt. `docs/SEARCH.md` §R8 has the prepared
command and its three preconditions. That challenger was not rock-paper-scissors — it was a better player drawn from the
same features and optimised for wins rather than resemblance, which is item 1's lesson in another
form. `engine/exploit.js --target <weights.json>` can now be pointed at DODUO, so the EXPLOITABILITY
argument for coordination — the one the 42.0% result explicitly does not settle — can finally be
tested instead of argued.

**3. MACHAMP, re-run on the current vector.** *(Will, 2026-07-30: keep it.)* Half-run and stale: the
2026-07-26 run completed 2 of 6 generations on a **17-feature** vector and recorded no verdict; the
vector is now 53. Its METHOD is alive — champion/challenger promotion behind a Wilson interval is the
same win-objective idea `train_policy.js` now implements by policy gradient. Keep the guard that made
it honest: every promoted champion plays EVERY previous generation, so that "gen 5 beats gen 4" is
not read as progress by itself. Kept as insurance rather than as evidence — the "this metagame is
cyclic" justification is withdrawn (2026-08-02); see `docs/MODELS.md` under MACHAMP.

**4. Branch scoring with a mixed strategy** — the research is done, so this is no longer vague.
Measured on a real mid-game board: **9 × 8 = 72 joint actions per side, 72 × 72 = 5,184 matrix
cells.** The 10¹² figure from VGC-Bench is the game TREE, not one turn.

- Only **28 of 72** pairs have a non-zero joint vector. The other **44 are free** — their score is
  exactly the sum of two singles already computed.
- With two Pokémon the coordination graph is a SINGLE EDGE, so Variable Elimination reduces to
  enumerating the 72 pairs and Max-Plus is unnecessary. The MARL factorisation literature (QMIX,
  QPLEX, Weighted QMIX) exists to avoid enumeration at many agents, which is not our problem.
- What that literature DOES tell us: QMIX's monotonicity constraint cannot represent non-monotonic
  coordination — exactly "Protect while my partner removes the threat." Independent per-slot scoring
  cannot express it either. Not "scores it badly": cannot express it.
- Pruning order matters. Structural prunes (choice lock, spread moves with no target, immunities) are
  exact and happen BEFORE scoring. Score-based top-K is circular for the 72 and only pays for the
  5,184.
- Pokémon is SIMULTANEOUS-move, so the answer at a node is a mixed strategy, not an argmax. Minimax
  is the wrong algorithm; this is poker-shaped. SLOWKING's regret matching already does this
  mathematics at team preview and nobody has pointed it at a turn.

**5. A leaf evaluator, so depth > 1 is affordable.** `position_features.js` (16 features) plus PORY
retrained on clean data. Without it every node rolls to the end; with it, depth 2 is 625 cheap
evaluations.

**6. Retire the second scorer in `app/index.html`.** *(Now the only failing test in the suite, and
the only one at the `v3.31.0` tag.)* It assigns **21 of 56 features** — 35 are never written and
silently read 0, and 8 of the 21 disagree with the engine outright. This is the "facts are
global" rule broken inside the UI. `app/scoreboard.html` already does it correctly by rendering
engine-computed values. The real fix is to ship the actual engine to the browser —
`medicham2-browser.js` already runs in both, and `board.js` has no top-level requires; the only
blocker is one `process.env` read at module scope.

**7. Bring the five living docs current, and keep them current.** Whitepaper, deck, technical docs,
SUMMARY and MODELS drifted to 3.21.0 against a CHANGELOG at 3.28.0 once already — see the process
failure recorded in 2.6. SUMMARY, MODELS, the white paper, PUBLICATION and this file were brought to
3.31.0 on 2026-07-31; the deck and technical docs have NOT been checked since.

**8. Measure exploitability again, against the mixed-strategy version.** The test that says whether
the project has moved from *plays okay* onto the branch that can approach *solved*.

**9. External validation.** Our bots grading each other cannot establish competence. The two real
scoreboards are the Bo3 open-sheet ladder — where the hidden-information problem does not exist and
we already collect the games — and VGC-Bench's published agent results on that same format.

---

## 4. THE SEARCH REDESIGN — established 2026-08-06

This section exists because a conversation about *why the bot picks badly* turned up four things that
were true, written down, and unacted on. Every figure below was read out of a file or measured in
this session; two of them correct claims I made earlier in the same session from memory.

### 4.1 The structural fact everything else follows from — and it was already written down

**Real games are six turns.** Measured over 53,059 stored games:

| median | mean | p90 | p99 | over 30 turns | over 60 turns |
|---|---|---|---|---|---|
| **6** | 6.5 | 10 | 16 | 0.05% | 0.01% |

The rollout horizon is capped at **60**. That is ~10× the real game, and reasoning from the cap
rather than the distribution is how the cost model came to be 10× too big: a leaf evaluation is
about **5,600** move-decisions, not 48,000.

**`docs/POKER-TO-POKEMON.md` §4b had this number and its consequence before tonight:**

> *"the horizon is short: the median game is 6 turns... the binding constraint is **breadth, not
> depth** — action abstraction (pruning dominated moves, bucketing targets) is where the real work
> is, **more so than the value net**."*

Two things follow, and the second is the uncomfortable one:

- **A leaf matters less here than in poker or Go.** A leaf evaluator exists because you cannot reach
  the end of the game. At six turns the rollout *does* reach the end — it returns a real win or loss.
  There is nothing to approximate. **The problem is not the judge at the bottom of the tree; it is
  that the six turns leading to it are played by a coin.**
- Which means the PORYGON2 separation gate (#23), dispatched earlier the same evening, is answering
  a question of smaller consequence than the dispatch brief claimed. It is still worth having. It is
  not the thing that unblocks anything.

### 4.2 GARY — the opponent inside the search, now named, and built-and-switched-off

**A capability that cannot prove it ran is assumed broken.** GARY could not, because it had no name.

```
engine/mag_bot.js:173      const MILTANK_FOE = arg('miltank-foe', 'uniform');
engine/miltank.js:455      DEFAULTS = { ... foePolicy: 'uniform', ... }
engine/rollout_leaf.js:289 const mv = (foePolicy === 'prior' && pickByPrior(mon, rng)) || mvs[random];
```

`'prior'` samples `data/move-priors.json` — **128,548 recorded clicks over 295 species** — so the
imagined opponent clicks Protect and Fake Out at the rate real players do instead of 25% each. It is
wired end to end and **the default is the coin, in the library and in the live bot.**

Four separate defects, each recorded as its own item:

1. **`foePolicy` steers both sides.** `rollout_leaf.js:302-303` applies the same `pick` to `S.actA`
   and `S.actB`. One flag governs the whole imagined game, so you cannot give the opponent a brain
   without also changing how the search models itself. (#34)
2. **Targeting is random in both settings.** `rollout_leaf.js:290` draws the target uniformly
   whether or not `prior` is on. `prior` fixes *which move* and never *who it hits* — and in doubles
   the target is half the decision. `board.js:377` already records humans double-targeting 23.4% of
   the time against ~50% for independent choice. (#35)
3. **GARY has two seats and they disagree.** From `rolloutAfterActions`'s own comment: *"The opponent
   is NOT modelled. It plays chooseAction during the stepped turn."* Deterministic greedy on the turn
   being ranked; a coin for every turn after. (#36)
4. **No artifact records which GARY ran.** `data/rollout-r1.json` and
   `data/rollout-r1-explore-sweep.json` carry no `foePolicy` key, so R1 and R4 cannot say whether
   their opponent was a person or a coin. (#33)

**Correction to something asserted earlier this session:** MAG is *not* deterministic and the
"sampling would collapse the variance" objection was wrong. `greedy=false` already draws from a
softmax, and `magnemite.js:217` calls it *"the single biggest measured lever in the project."*

### 4.3 The pruning is done by the coin

`miltank.js:1204` screens every candidate pair by running a **cheap rollout** on it and keeps the top
`FINAL_K`. The rollout is the 51%-accurate leaf. **So the coin is not merely misjudging the
finalists — it is selecting them.**

MAG is not used for this, and the file says why:

> *"The first version pruned to the best K per slot — except `_candsFor` returns no scores, so it was
> taking the first three in array order and calling that the best three. That is worse than not
> pruning at all: an arbitrary shortlist that LOOKS principled."*

**The candidate list arrives with no scores attached.** Fixing that is §4b's "action abstraction",
and it costs *one* MAG pass per turn rather than one per imagined turn — the difference between
affordable and impossible. Measured branching, from 7,976 real brought-teams: ~76 action combos per
side per turn, ~5,738 joint. MILTANK samples 200 rollouts against that. (#37)

### 4.4 The equilibrium solver is unplugged, and the reason is the language boundary

**How the comparable projects handle the opponent: they do not pick one.** CFR → DeepStack →
Libratus → ReBeL never assume an opponent policy; they run regret matching for both players jointly
and output a *mixed strategy*, whose guarantee is that it cannot be exploited whatever the opponent
does. AlphaZero uses self-play with a policy prior and deletes rollouts entirely. AlphaStar — the
closest structural analogue, being simultaneous, hidden-information and wide — uses a *league*
including deliberate exploiters, which is what WOBBUFFET is here.

**The poker answer is already implemented in this repository, verified, and unreachable.**
`engine/slowking/nash.py` and `ismcts.py` do simultaneous-move regret matching and recover exact Nash
on RPS and an asymmetric 2×2. `rollout_leaf.js` states the gap plainly: *"a best response to a fixed
opponent rather than an equilibrium: weaker than the design's matrix game."*

```
127 JavaScript files    everything that must PLAY a battle — Showdown is TypeScript
 40 Python files        everything that does MATH — numpy/scipy live there
  7 in slowking/        the solver
```

Neither language choice was wrong. **The consequence is that the thinking cannot play.** Three routes
out, and the third is the one to scope first:

| route | cost |
|---|---|
| port the solver to JS | a second implementation of verified math — the failure this repo keeps repeating |
| call Python per turn | a subprocess inside a Showdown turn timer |
| **precompute in Python, ship a lookup table** | **what chess does with Syzygy — and it is DUSK** |

### 4.5 DUSK is a tablebase, and open sheets are what make it exact

**Will, 2026-08-06:** *"at the end game, we can have a repository of scenarios in dusk that can show
which mons beat which in a straight up battle and solve for those endings."*

That is an endgame tablebase, and it is the right shape for this game specifically. At 1v1 under
**open team sheets there is nothing hidden left** — species, set, item, ability and nature are all
declared. The only unknown is which of four moves they pick this turn: a small matrix game with
known payoffs, which is exactly what `nash.py` already solves exactly. **Closed sheets would make the
table a guess; open sheets make it a fact**, which is the payoff of the open-sheet-only directive.

The store supports reconstructing these positions — turn records carry `tgthp`, boosts and megas, and
`sets` carries `declared:true`.

**And DUSK is simultaneously the bridge in 4.4**: solve offline in Python, emit a table, let the
JavaScript bot read it. No port, no subprocess.

**The open question is size**, and it decides everything: enumerate all of
(mon + set + HP + status + boosts)² × field and it is astronomical; restrict to positions that
actually occur on the ladder and it may ship as a JSON file. Not yet measured. (#40)

### 4.6 A coverage number that overstates itself ~3×

`data/mechanics-census.json`: **probed 219, live 216, missing 3 — armed 74, unarmed 145.** An unarmed
probe runs, reports a result, and would report the same result if the mechanic were deleted. So
"216/219 mechanics live" counts probes that executed, not mechanics that work.

The instrument that does *not* depend on anyone thinking of the right probe — random games diffed
against real Showdown — finds **1 disagreement in 150**, and that is the honest signal. It is good.
The remedy is arming the 145, not writing more. (#42)

### 4.6b Speed is revealed for free by resolution order, and nothing reads it

**Will, 2026-08-06:** *"if two incins come out, which intim goes first indicates speed."*

Entry abilities resolve in **speed order**, so two Intimidates on the same switch reveal a strict
speed inequality **before anybody clicks a move**. It costs no turn and no risk. The same channel has
several sources: any two entry abilities (Drizzle against Drought), end-of-turn residuals
(Leftovers, burn, Rough Skin), and same-bracket move order (two Fake Outs, two Protects).

**This matters more than it sounds, because of what open sheets leave hidden.** `web/models.html`'s
own mode note: *"Hidden information is exactly two things: what's in the back and the exact EV
spread."* Species, item, ability, nature and moves are all declared. **So Speed is essentially the
hidden variable in this format**, and every resolution-order observation is a hard constraint on it.
Accumulated across a battle it narrows to an interval, which is exactly the *"do I outspeed this"*
question that decided three of the five replays reviewed the same evening.

**What exists is not this.** `engine/dynamics.js` → `data/dynamics.json` already derives speed from
*who moved first* — but it reads **move order only**, aggregates **per species over the whole
corpus** into an empirical rank rather than per-battle per-opponent, and is read by `ditto.js` and
`kadabra.js` and by **nothing** in `board.js`, `miltank.js`, `mag_bot.js`, `magnemite.js` or
`medicham2-browser.js`. It is a population prior, not a live belief.

**And entry-ability order is modelled nowhere at all** — `entryOrder|switchInOrder|abilityOrder|
speedOrder` returns no match across all 127 JavaScript files. `medicham2-browser.js:2444` applies
entry drops and carries no notion of which resolved first.

Three pieces, and **the first is an ENGINE correctness question rather than a feature**: does
MEDICHAM resolve entry abilities in speed order at all? The official engine does, so if MEDICHAM does
not, that is a differential-test miss to fix before anything is built on top of it. Then the
extraction (protocol order → a qualified inequality), then the belief (inequalities → a Speed
interval a decision can read). **XATU is currently drawn as *"mostly idle — little left to guess"*
under open sheets. This is the thing it should be doing instead.** (#43)

### 4.7 The order, and why each is where it is

| # | item | why here | cost |
|---|---|---|---|
| #33 | record which GARY ran | nothing below is interpretable without it | trivial |
| #32 | flip `uniform` → `prior`, measured | free, and it gates whether a better GARY is worth building | a flag |
| #38 | set the horizon from the measured 6 | every cost estimate downstream depends on it | trivial |
| #37 | prune with MAG's scores, not the coin | §4b's "the real work"; one MAG pass per turn | small |
| #34 #35 #36 | split the policy, model targeting, unify the seats | make GARY one declared thing | medium |
| #39 | measure the board↔MEDICHAM translation | decides whether MAG-as-GARY is possible at all | measurement |
| #40 | DUSK size gate | decides whether the tablebase is a weekend or a year | measurement |
| #41 | reach the solver from JS, via #40 | the equilibrium answer exists and cannot play | scoping |
| #42 | arm the census | stops an inflated number being quoted again | ongoing |
| #43 | speed from resolution order — **and Foul Play goes further, running the damage calc BACKWARDS**: it simulates rolls against the damage actually observed to infer the opponent's real stats, and reads items from behaviour (outspeeds you repeatedly with the same move → Choice Scarf). We infer nothing from either channel (#74) | free information on the one variable open sheets still hide | ENGINE check, then small |

**The through-line:** four of the six findings in this section are capabilities that were *built,
correct, and switched off* — `prior`, MAG's scores at the candidate list, MAG's softmax, and the Nash
solver. That is the same failure mode as 2026-07-28, arriving through a door the rules had not
covered, and the countermeasure is the same one: **a capability that cannot prove it ran is assumed
broken.** GARY is named in this pass for exactly that reason.

---

## 5. THE REGISTER — everything we intend to build, and why it is not built yet

**Will, 2026-08-06:** *"I WANT THE ROADMAP TO BE COMPREHENSIVE AND UNABLE TO LOSE TRACK OF THE THINGS
WE WANT TO BUILD LATER."*

**The rules, because a list that is not checked is a wish-list.**

1. An item leaves this register in exactly two ways: **it is done**, or **Will kills it by name**.
   Nothing leaves by being forgotten, superseded in conversation, or quietly reprioritised.
2. Every item names **what unblocks it**. "Later" is not a status; "blocked by #45" is.
3. Every item carries a **task number**, and the task holds the detail. The register is the index —
   it exists so that nothing is only in someone's head, or only in a conversation, or only in a
   division ledger nobody opens.
4. **A deferred item stays here with its reason.** HYPNO is deferred by decision, not dropped, and it
   says so.

### 5.0 THE FOUR PHASES — the ordering this register is arranged in (3.59.0, ADR-003)

**This section is new and it re-orders everything under it.** It exists because ADR-003 changed what
the project is trying to prove. The headline metric is **exploitability, not win rate**; VGC-Bench
(AAMAS 2026) beat a professional with a compiled policy and measured all of its agents at
approximately **100% exploitable**; and the thesis under test is that a **re-solving** agent is
harder to exploit than a compiled one. That thesis makes MEDICHAM's existence conditional, and the
condition is a gate that was already in this register.

```
1  finish MEDICHAM        search needs an engine that is fast AND correct
2  GATE #62               does compute buy anything: untimed vs on-the-clock
3  if yes -> search, and measure EXPLOITABILITY against their ~100%
4  if no  -> adopt their recipe: BC + PPO self-play/FP/DO, open source, reproducible
```

| phase | what it is | where it lives in this register |
|---|---|---|
| **1** | MEDICHAM is fast **and** correct | §5.1, and #68 as the whole-engine gate |
| **2** | **#62 — the project gate**, below | this section |
| **3** | the search, then the exploitability measurement | §5.2, §5.3, §5.4, and #6 in §5.3 |
| **4** | BC + PPO with self-play / fictitious play / double oracle | §5.8, as the paper's fallback result |

**#62 IS PROMOTED TO THE FRONT OF THIS REGISTER. It is no longer a MILTANK tuning question; it is the
project's gate**, and it was moved here from §5.3 in this pass.

| # | item | blocked by |
|---|---|---|
| #62 | **GATE, AND IT COMES FIRST: play MILTANK untimed against MILTANK on the clock.** R6 measured **31.6% of move decisions deferred** — handed back to MAG unsearched, consuming 30.5% of the spend. `defer` fires both when the clock runs out *and* when the search cannot separate its options, and **only the first is fixable with compute**. This decides whether #25/#37/#61 are worth doing at all — and, since 3.59.0, whether the whole engine programme was worth doing. VGC-Bench used real Showdown through poke-env and carried **no engine-correctness debt**, because behaviour cloning and PPO do not need a fast simulator. **We wrote one so per-turn re-solving is affordable, so the engine work is justified if and only if search pays** | #45 |

**Why this is the right gate rather than a proxy for one.** Every project in `docs/PRIOR-ART.md` that
searches hits the engine-speed wall, and the pattern is clean: VGC-Bench does not search and used real
Showdown; Future Sight AI searches, modified Showdown, and reaches about 3 turns of lookahead in 15
seconds on 16 cores; Foul Play searches, **built** poke-engine, and reaches about 10+ turns. Building
an engine is what searching costs. #62 asks whether the thing it buys exists.

**On compute, because it is the obvious response to #62 failing.** Cores help the search — it is
CPU-bound and root-parallelisable. GPUs help behaviour cloning and PPO. MILTANK needs **26 s against a
20 s budget on one core of sixteen**, so sixteen cores fixes the clock today. But root parallelisation
scales **sublinearly**, so cores convert a *failed budget into a met one*, not a *shallow search into a
deep one*. If #62 says compute buys nothing at depth, more cores does not answer it.

**Phase 4 is approved in advance and is a result, not a defeat.** Will, 2026-08-06: *"IM OKAY TRYING
THINGS OUT LIKE SEARCH TO SEE IF OUR ATTEMPT WORKS BUT IF THAT FAILS IM OKAY ALSO TRYING THEIR OTHER
METHODS."* Their recipe is published, open-source and reproducible, so the fallback is cheap precisely
because they made it so.

### 5.1 MEDICHAM completeness — PHASE 1, and everything below waits on it

**Will's bar, 2026-08-06:** *"i still want medicham to be fully wired and tested on every move and
ability and item in the regulation (with any usage at all) before we start taking its output and
using them."* Target agreed the same day: **99% of usage — 484 of the 819 things that carry real
usage** — plus a carve-out for anything that turns a certainty into a failure regardless of usage.

| # | item | status |
|---|---|---|
| #45 | the gate itself: 99%-of-usage coverage, enforced not remembered | **being built** |
| #42 | ratchet on DIRECT-CALL probes, not on `unarmed` — 37 left of 47 | in progress |
| #51 | 23 tags with real usage and **no probe at all**; accuracy modification is the top | queued behind 42 |
| — | 3 declared-missing mechanics: Avalanche, No Guard, Sand Veil | queued behind 42 |
| — | 1 live differential: `chesnaught woodhammer -> mimikyu` (Disguise, unimplemented) | queued behind 42 |
| — | 6 interaction-matrix disagreements: stone axe ×4, giga impact, supercell slam | queued behind 42 |
| #27 | **the represented-clicks number** — what % of real clicks the engine can even perform. Last measured 15.3% failing when it handled 4 action kinds; it now handles 12 | needs a settled engine + fresh release |
| #49 | delete the 77 hand-typed mega abilities; the derived path exists and is proven equal | queued behind 42 |
| #9 | harden `pranksterBlocked` to check the move's target | latent, not live |
| #71 | seven moves share one tag signature — Pain Split, Recycle, Copycat resolve identically | — |
| #72 | hazard SETTING by an attacking move, and ALL hazard removal | **setting DONE 3.99.0** — `hazardOnHit` derived from `onAfterHit`/`onAfterSubDamage` calling `addSideCondition`, matching exactly Ceaseless Edge and Stone Axe. REMOVAL (Defog, Rapid Spin, Mortal Spin, Tidy Up, Court Change) is still untagged and unbuilt |
| #98 | **THE INERT BUCKET — DONE, 3.80.0.** 124 abilities covering 72,609 uses fell through `ability/generic`, which stages a plain attack, so the condition each one needs was never created: Showdown's own board came out identical with and without them and the roster reported INERT. That reads as "nothing to test" when the truth is "never tested" — a coverage hole wearing a completed run's clothes. Fifteen new shape rules took it to **59 abilities / 4,261 uses**, nothing left above 500 uses. Its first real finding is the pinch family, #112 | done — kept here because `docs/ENGINE.md` cites it |
| #107 | **PER-STAGE ROSTER ARTIFACTS — DONE, 3.80.0.** `--write` wrote `data/roster.json` whatever stage ran, so one file could not carry three stages and a moves run silently destroyed the abilities results — twice in one day. It now writes `data/roster.<stage>.json`, `--stage all` writes `data/roster.all.json`, and an overwrite is ANNOUNCED with the outgoing artifact's stage, release and counts, its bytes kept at `.prev.json`. This is what let the quarantine gate (#99) read measurement instead of absence on two of its four clauses | done — kept here because `docs/ENGINE.md` cites it |
| #109 | **THE PHOTOGRAPH FREEZES THE SUBJECT BUT NOT THE CAMERA — GUARDED, 3.84.0, BUT THE BACKLOG IS NOT RECOVERED.** `engine/game_differential.js` is not in `engine_release.js`'s `SOURCES`, so the ENGINE is frozen and the DRIVER that reads it is live. Re-measured over 65 release directories against the 13 symbols the driver actually reads: **56 SYMBOL-ABSENT** (no `natureL50`), **1 FILE-ABSENT** (the oldest predates `mc_key.js` joining SOURCES and dies inside `engine_release.js` before the symbol check is reached), 4 pruned, **5 usable**. Fix (c) chosen: `REL.require(file, {need, want})` refuses a missing export BY NAME with the cut date and a `compat` command, instead of a `TypeError` 1,280 lines deep. (a) was rejected on the driver's own argument that freezing the instrument would mean "each rung was scored by its own contemporaneous reader, which is the one thing a ladder must not do"; (b) rejected because the exported surface IS the version and is derivable. **THE 56 DO NOT COME BACK** — those bytes never held the function. Said plainly here because the +6 and +5 SOURCES growths did not repair anything cut before them either **and neither of them said so**. Consequences: `engine/wire_ladder.js` cannot run at all (all 14 rungs lack the symbol, so the published ladder stands but is no longer replayable); #57 is unaffected (it re-runs against the LIVE engine and never re-opens a release); #99's lift condition runs through the differential, which now has 5 usable releases of 65 | guarded; backlog unrecoverable; `wire_ladder` needs a decision |
| #103 | **THE MULTI-HIT COUNT WAS THE MEAN — DONE, 3.90.0.** Eleven roster rows on one rule, ~1,743 uses, and the differences went BOTH WAYS by small margins, which is what said it was a COUNT and not a missing mechanic. `sim/battle-actions.ts:869` samples a **twenty-element** table and `PRNG.sample` is `items[random(items.length)]`, so the pin selects element 19 or element 0 and **never a middle**: Icicle Spear lands **5** at one corner and **2** at the other. This engine answered **3.1 — the mean — to every question**, including the one a real turn asks. Too few against a 5, too many against a 2, on the same move. `rollHitsOf()` now draws the count once per move use, beside `expectedHitsOf()` which stays the PRICE for the search. Per-hit flooring was ruled out with arithmetic rather than preference: `roll()` already returns an integer, so `Math.floor(v*n)` equals `n*v` for every value — that line did not change. **Newly REACHABLE and filed:** Skill Link rewrites the hit count (forces 5), and until now there was no count to rewrite — 46 uses, legal only on Heracross-Mega and Toucannon. *(This first also named Loaded Dice; Will caught it — Loaded Dice is `isNonstandard: 'Past'` and does not exist in this format. Read the ban from the format, not from memory.)* | done — 8 of 11 rows closed |
| #101 | **`buffsHolderOnHit` NOW READS ITS CONDITION — DONE, 3.89.0.** The consumer applied `_buff.boosts` on EVERY connecting hit, so Anger Point maxed Attack off any hit rather than a critical one, Justified fired on non-Dark and Weak Armor on special hits. Stamina — 2,773 uses, the only member with real usage — is unconditional and therefore correct, which is exactly why nothing noticed. `condHolds(w, self)` widened to `condHolds(w, self, hit)`, the cost WIRE 2 predicted; four shapes readable (`crit`, `moveType`, `moveCategory`, `moveFlag`) and `buffOnHitUnknownCond` reads **0**, which is how we know every condition in the artifact is readable. **`+6`, not `+12`:** Showdown's handler is `setBoost({atk:12})` = "max it from wherever you are"; this engine clamps stages to ±6 twice over, so the effective Attack is identical and a literal 12 would be a number nothing here can read. **HALF-FIXED AND SAID SO:** volatile-payload members (`electromorphosis` 98 uses, `windpower`, `perishbody`) are still not granted — no consumer multiplies an Electric move by a banked Charge — but the debt is now COUNTED at `MEDFAILS.buffOnHitVolatileUnwired` = 2 rather than silently dropped | done; volatile payloads still owed |
| #102 | **THE PROCEDURAL HEAL FAMILY — DONE, 3.89.0.** Synthesis, Moonlight and Morning Sun resolved to `{kind:'pass'}` — a wasted turn, and in sand the click was **strictly worse than passing** because the residual chipped the body that had just healed 0. On a 155 HP body: clear **0 → 77**, sun **0 → 103**, rain **0 → 39**. `healParam` returns a RECIPE rather than an amount, because `playerAction` sorts the turn before the sky is final; fractions go through `md4096` because the handler is `this.heal(this.modify(maxhp, factor))` and `maxhp * 2/3` is a different number. **MY DIAGNOSIS WAS WRONG ON STRENGTH SAP** (693 of the 1,024 uses): it resolved to `affect`, not `pass` — WIRE 79's Attack drop had already landed and only the HEAL was missing, so it was deliberately NOT reclassified as a heal, which would have traded one half for the other | done |
| #111 | **THE VOLATILE DURATION FAMILY — DONE, 3.82.0.** 9,092 uses and the top of the moves queue: Encore 5,599, Taunt 1,714, Infestation 971, Disable 808, all on one rule and one mechanism. Showdown decrements inside the Residual event (`battle.js:342`, ordered by `onResidualOrder`), so a volatile applied on turn N has already spent a turn by the end of it — **the Perish Song bug a second time**, documented at `medicham2-browser.js:6588`, fixed for that one volatile and left standing for every other. Three sub-rules were missing entirely: re-application FAILS (a second Taunt was refreshing the counter), the counter is adjusted by whether the target already moved, and Encore/Disable need the target's last move — which Disable never had. Taunt and Disable now MATCH; whole-game agreement 76.9% → 78.9% paired; roster moves 52 → 50 DIFFER. **Encore remains DIFFER on HP only** — `onOverrideAction` replaces the chosen move and medicham2 honours the lock only inside `_chooseAction`, so a scripted action walks past it. Its own row. `infestation` also still parts, one LOWER and with no plain duration | done — Encore's HP row and infestation remain |
| #112 | **THE PINCH FAMILY HAS NEVER FIRED — 8,524 uses.** Blaze 5,903, Torrent 1,924, Overgrow 651 and Swarm 46 carry `onlyWhen: "only below 1/3 HP"` as PROSE, and the `damageBoost` consumer at `medicham2-browser.js:2761` requires `!_db.onlyWhen`. The refusal is correct under #92 — a guessed condition is worse than none — and the defect is that `onlyWhen` was never made machine-readable. The consumer's own comment names its live members and says *"All five are 0 corpus uses"*: armed for what nobody runs, failing closed on what everybody runs. Same class as #101.<br><br>**DONE, 3.83.0.** `engine/tag_dex.js` derives the gate by SHAPE out of Showdown's own `attacker.hp <= attacker.maxhp / 3` into `{cond:'hpFraction', of:'self', cmp:'<=', num:1, den:3}`, and `condHolds` in medicham2 evaluates it in INTEGER arithmetic — `maxhp * (1/3)` is not `maxhp / 3` and would refuse a body at exactly one third. The fail-closed rule is untouched: an unreadable `onlyWhen` still returns null, still refuses, and is now counted. Roster abilities **1 DID-NOT-FIRE → 0**, with exactly four verdicts changed (Overgrow out of DID-NOT-FIRE; Blaze/Swarm/Torrent out of CONTROL-NOT-QUIET) and nothing else moved. Census **324 → 325**. Gate: `tests/test-pinch-family.js`, RED at 31/61 before the fix, plus two halves of the reversal in `tests/probe_red_demo.js` and the five 0-use members as an explicit positive control | done |
| #81 | **THE WIRE QUEUE.** The whole-game differential's divergences, ranked and verified against Showdown's source. **ONE at a time, re-run between each** (Will, 2026-08-06). WIRE 1 (Protect is not an immunity, and a shielded High Jump Kick still crashes) landed in 3.61.1 | in progress |
| #84 | "my move didn't happen" is TWO states in Showdown — `false` counts as a failure for Stomping Tantrum, `null` does not, and flinch returns `false`. Get Faked Out, and your Stomping Tantrum doubles | WIRE 2 |
| #87 | **CACHE THE TEAM POOL — DONE, 3.69.0 (`b168490`).** 41s of every invocation was spent reading a 311MB store to pick 87 teams, and the pool was read LIVE from a file OPS appends to, so a divergence seed stored in an artifact NO LONGER RESOLVED — its pair was not in the next day's pool. Startup 45.1s → 0.8s, and the pool is now digested, so a seed plus a pool digest reproduces the exact game for the first time. That is what made `turn1_queue_at_the_top_rung` replayable | done — kept here because `docs/ENGINE.md` cites it |
| #88 | **ONE PIN IS ONE CORNER.** Every die is pinned one way, so a game runs once and is deterministic — no noise, but the tie always resolves to input order, every sub-100 move misses on BOTH sides, and damage is always the max roll. Agreement is therefore BY CONSTRUCTION on the ~91% of matchups that are speed ties (compounds with #86). **The crit's wrong position, found by the stage audit, is the first confirmed defect this hid: 46.5% wrong at the bottom roll, invisible at the top one we always use.** Fix is four pinned arms, not repetition-and-average, which would throw away the tolerance-zero this instrument exists for | #92 |
| #89 | the engine justified its Disguise model against `battle.update()`, a Showdown method **that does not exist**. The model is CORRECT (both engines end at 114/130) — a right answer resting on a false reason, which is worse than a wrong one, because the next reader re-derives from the reason | — |
| #90 | **prove the Perish Song KO actually fires** (Will, 2026-08-07). The counter half landed in 3.71.0 — it was KO'ing a turn early. This is the separate claim: the counter being right is not evidence the faint happens, and 1,141 corpus uses rest on it. Whole sequence, both sides simultaneously, and a body that switches out must NOT faint | — |
| #91 | **A CLICK IS NOT A TEST.** `creditClick` credits the CLICK, so Haze into a board with no boosts on it marks Haze covered and the steering stops selecting it. The census's own PROBES are behavioural and sound (0 hollow, 0 direct-call); this is the differential's coverage steering only. Credit must move to the observed EFFECT, with the precondition derived from the tag's params — not a hand-written scenario per mechanic | after #92 |
| #92 | **THE DAMAGE-STAGE CLASS — DONE, 3.72.0.** We applied multipliers at the wrong STAGE and often unchained; Black Glasses on final damage where Showdown does base power was 108 against 109. LANDED into ONE `onBasePower` relay: the 18 type items, Muscle Band, Wise Glasses, Technician, Tough Claws, Sharpness, Iron Fist, Mega Launcher, Strong Jaw, Punk Rock, Sheer Force, Supreme Overlord, Expanding Force / Rising Voltage, Dry Skin and the -ate x1.2. Into the STAT relay: Thick Fat (73%), Heatproof, Purifying Salt, Water Bubble (77%). Off the hit site and into the chains they belong to: Helping Hand (5/5 rows) and Friend Guard (21.4%). Sniper out of the crit's plain multiply and into `onModifyDamage`. The crit's POSITION into `dmgRange`, before the randomizer. The four field terrains, which were absent entirely (161 uses — Will corrected my "most games"; the reason to land them is the magnitude, a Grassy Earthquake was priced at DOUBLE). `damageBoost` is wired only for the narrowed self-describing shape and the reason the other 39 members are NOT is recorded in `docs/ENGINE.md`. New gate `tests/test-damage-stages.js` — 1,728/1,728 exact against the authority across all 16 rolls and both crit states, shown RED on two deliberate reversions before being trusted. Census 293/294 → 298/299. Full audit in `docs/DAMAGE-STAGES.md` | done — kept here because `docs/ENGINE.md` cites it |
| #96 | **TWO TYPE AUTHORITIES, TWO DIFFERENT SKIES — DONE, 3.87.0.** `effMoveType` — the battle loop's authority for the stage-5 immunity gate, the absorb check, the Lightning Rod draw, Protean's retype and the Fire thaw — resolved the weather branch off `field.weather` RAW, while `dmgRange` resolved it off `effWeatherOf`, which applies the PRIVATE sky (the `privateWeather` tag; Mega Sol). Under a private sun with a clear field the damage calc priced Weather Ball as **Fire, 128-151** and the loop refused it as **Normal**, so a Meganium-Mega's headline click dealt LITERALLY ZERO to a Ghost. This is WIRE 126's own hazard inside WIRE 126's own function: the thing built to be the single answer to "what type is this move" then disagreed about a different input. Fixed by a CALL to `effWeatherOf`, never a copy. WIRE 126's declared hold in `clickFragility` is lifted with its reason kept — that function's own `base` already saw the private sun, so it contradicted itself; **`benchRisk` moves and a refit is owed at the next release cut (MEASURE).** New probe `ability/privateWeatherMoveType` is the CROSS neither half's probe could reach — a private sky AND a move the sky retypes AND a Ghost — and asserts private sun **===** public sun, not merely `> 0`. Three rows in `probe_red_demo.js`, one of them the public-weather positive control. Census **325 → 326 live**; roster and the 1/150 differential unmoved | done — kept here because `docs/ENGINE.md` cites it |
| #83 | the mirror-symmetry gate false-alarms ~1 run in 20 by construction — n=300 gives a ±5.6 point half-width | — |
| #82 | the differential's BRING is a run parameter, not the accident of sheet order | — |
| #80 | Knock Off records the wrong DISPOSITION for a self-eaten berry — `[eat]` vs move-attribution, which Harvest/Recycle/Belch/Cud Chew/Unburden read. **The damage claim originally filed here was measured FALSE and is retracted; Colbur fires correctly for us** | found by the differential |
| #20 | **RETRACTED AS WRITTEN, 2026-08-10 — A TYPE *IS* A REACTOR AND THE HARNESS WAS THE LIMITATION.** The item said Grass-blocks-powder was untestable because a TYPE cannot be a reactor. Will: *"ALL TYPES HAVE A SORTA ABILITY, DARK IMMUNE TO PRANKSTER, GRASS TO POWDER MOVES, GHOSTS CANNOT BE TRAPPED, ETC."* He is right, and it is measurable: asked of a live battle in this format, **Fire refuses burn, Steel refuses poison, Electric refuses paralysis, Ice refuses freeze**; the type chart carries **seven** more (Dark/Psychic, Fairy/Dragon, Flying/Ground, Ghost/Fighting+Normal, Ground/Electric, Normal/Ghost, Steel/Poison); Prankster names Dark in its own text; the `trapped` volatile refuses Ghost; and powder is gated in the battle rules. **The reason this looked impossible is that type reactions live in FIVE different places** — the type chart, `runStatusImmunity`, an ability text, a volatile condition, and the battle rules — and only one of them resembles a reactor if you are searching for an ability slot. **The fix is that the harness reactor may be a TYPE**, which is CHEAPER than an ability reactor, not harder: there is no ability to swap, you pick a body of that type and the negative control is a body that is not. This unblocks the ~400 pairs the interaction matrix drops | open — `docs/ENGINE.md` |
| #21 | AXIS 4 — DENIAL: a move that costs a turn also denies a field effect | — |
| #28 | resist berries: the one staged pair is physically impossible | — |
| #7 | Coverage Layer 2 — the mutation harness | — |
| #59 | **the protection counter has three behaviours and our tags carry two.** Protect *checks* the shared 1/X counter; Wide Guard *feeds it and never checks*; Ally Switch has its own private one and carries neither tag. **The engine implements none of it** — `grep allyswitch` and `grep stalling` both come back empty | — |
| #60 | **Upper Hand and Sucker Punch share a tag and have different conditions** — Sucker Punch needs the target attacking, Upper Hand needs it attacking *with priority*. Modelled the broad way, the bot thinks Upper Hand beats an ordinary Earthquake | — |

**Both came from Will reading the rules, not from any instrument**, and both are the same shape: a
tag derived from Showdown's flags is only as complete as the flag. Ally Switch's stalling lives in
`onPrepareHit` with no flag on it, so the deriver never saw it. **Showdown does not have tags — it
has code**, and every mechanic here is a re-implementation of a handler, which is the entire reason
`engine/tag_dex.js`, the differential test and the arming work all exist.

### 5.2 GARY — the opponent inside the search, named 2026-08-06

Four defects in one place, all found by reading the source. See §4.2.

| # | item | blocked by |
|---|---|---|
| #33 | every artifact records which GARY ran — **`rollout_r1.js` done, 3 callers left** | — |
| #32 | flip `uniform` → `prior` and measure it | 33, and a fresh release |
| #34 | the flag steers **my** side too — split it | — |
| #35 | targeting is drawn uniformly in **both** modes. **Foul Play weights its chance nodes by likelihood** — a 90/10 accuracy move becomes two children selected by probability. It does correctly what #32/#35 have open as a defect (#74) | — |
| #36 | GARY has two seats and they disagree | — |
| #55 | **GARY does not coordinate either** — the imagined opponent picks its two Pokémon independently, so it never focus-fires, never Protects while its partner kills, never redirects. **DODUO *is* GARY**, pointed at the other side | #39, #45 |

**The fifth defect is the largest and it collapses two workstreams into one.** MAG choosing
independently costs us our own quality — a symmetric loss. **GARY choosing independently makes the
imagined opponent structurally incapable of the plays that actually beat us**, which is bias with a
direction. And the objection that imitation is a ceiling *does not apply to the opponent model*: we
**want** the imagined foe to behave like a human, because humans are who we play.

### 5.3 The search redesign — PHASE 3, and none of it starts until #62 answers

**Reordered 3.59.0.** This whole table used to be the front of the project. It is now downstream of
the gate in §5.0: if compute buys nothing, none of these items is worth building, and the project
takes phase 4 instead. **#61 keeps its place here and gains a second reading** — the 3,401
battles/sec it is measured against is itself corrected in 3.59.0 to 13,041 turns/sec against
`champions_sim`'s 523, a ratio of 24.9x rather than the recorded 117x. Three readings of one quantity,
no ratchet on any of them; see ADR-001's correction note.

| # | item | note |
|---|---|---|
| #37 | prune with MAG's scores, not with the coin | Will approved with a condition: *"make sure it doesnt toss moves a VGC pro would make"* |
| #25 | prune by **PAIR** score, not single-move | the truncation curve says single-move ranking **cannot** meet that condition at any affordable K |
| #53 | **DODUO** — the pair model is fitted, better, and **the search never reads it** | the fix is wiring, not building |
| #56 | **extract what MAG actually prunes that DODUO wants** — the truncation misses *are* the catalogue, and reading them out beats reasoning from examples | needs a frozen release |
| #24 | replace MILTANK's leaf with PORYGON2 + a MAG-sampled opponent, **and add Foul Play's damage-roll grouping as a third arm** — group outcomes by whether they cause a FAINT, average the damage inside each group, sum the likelihoods. Keeps the only distinction the decision turns on and collapses the rest; cheaper AND lower-variance without being dumber, which is the exact pair of properties this task is short of (#74) | gate passed (#23) |
| #38 | the rollout cap is 60 turns; real games end at **6** | trivial |
| #39 | measure the `board.js` ↔ MEDICHAM translation cost | decides whether MAG-as-GARY is possible at all |
| #61 | **MEDICHAM measures 1,606 battles/sec against the 3,401 on record — 47%.** On the measured figure the 200-rollout x 64-pair search needs **26 s** against a 20 s budget and does not fit. Nothing ratchets speed, which is why a 2x regression went unseen | — |
| #62 | **MOVED TO §5.0 IN 3.59.0 — it is the project gate, not a search-redesign item.** Everything in this table is phase 3 and does not start until #62 answers | see §5.0 |
| #63 | **the rollout never switches.** The engine *can*, and the search can offer a switch as a root candidate — but the playout has no switch branch at all, so **every imagined future is a game where nobody ever leaves**. Misprices preserving a Pokémon, punishing a switch, and the *switch out of a predicted attack* pattern the engine models priority order for | #45, #61 |

**Four different states get quoted for each other here and only one is broken.** The engine can
switch; the search can offer it; **the rollout never does**; and the live bot has it **off** against
a measured **10-point loss**. That loss is real — but `bringIn()` picks `live(bench)[0]`, the first
healthy body, and its own comment calls that *"a real limitation, not a detail"*. **A switch to an
arbitrary Pokémon is not a switch, it is a *leave*** — and a 10-point loss is precisely what
evaluating "leave" would produce. Test that before concluding switching is bad.
| #64 | **DECISION: `ability|auraBoost` (5,663 uses) needs a roster `dmgRange` does not have.** Not a missing branch — a *representational* limit: the multiplier is field-wide over every body, and `dmgRange` is handed two bodies and a field with no occupants. ENGINE measured it before proposing anything (79 damage with Fairy Aura on attacker, ally, foe and nobody — identical, as expected) and **routed rather than patched**, because widening the signature is a `board.js`-facing input change. The call: does `dmgRange` take a roster, or does the caller pre-compute a scalar? The second is cheaper; the first is the honest shape and pays off for every other field-wide ability | — |
| #65 | **`data/tags.json` is FROZEN — regenerating it silently deletes five entities, and the cause is my own corpus change.** Found by *diffing* a regeneration instead of accepting it: tag membership and every param come out identical (0 diffs across 500/262/146), but `sheet_entries` falls **110,760 → 78,480** and **Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit and Leppa Berry drop out of the engine's knowledge**. `fit_policy.js:304` was narrowed to `['games.bo3.jsonl']` on the open-sheet directive — right for the FIT, and `tag_dex.js` reads the same `loadCorpus()`. **A corpus decision is not local to the model it was made for.** Fix (a): give `tag_dex.js` its own reader over the full store. Fix (b): give `loadCorpus` an explicit scope argument so every caller states what it wants instead of inheriting someone else's decision — (b) is the shape that stops this recurring | — |
| #68 | **THE GATE THAT DECIDES MEDICHAM — replay real stored games through both engines, 1,000+ distinct teams.** Will: *"we would want to play n games with like a thousand different teams to really test every single mechanic in the game."* **Every part is proven and nothing proves the whole.** The census (235 armed, 0 unarmed) says each mechanic FIRES. The damage differential says 149/150 — but on **staged pairs** with a **12% midpoint tolerance**, and since both engines produce a pinned 16-roll range, **roll variance explains none of it**; a correct engine scores 0.000, the slack is free, and the artifact publishes only `worst` so nobody knows if the 149 sat at 0.000 or 0.119. `game-diff.json` is **five hand-written scenarios** whose `not_compared` list excludes hp amounts, misses, secondaries, crits and any pair where one engine KOs and the other does not. Teams come from the STORE (46,612 real games), first divergence only, **tolerance zero**, and the run **measures its own mechanic coverage** — a run that never triggers Illusion has not tested Illusion and must say so | #45 (met) |
| #74 | **PRIOR ART: Foul Play (pmariglia) — a singles MCTS bot at top-100, and it has four things we have as open defects.** It moved FROM expectiminimax (every possibility, ~5 turns, ran out of clock) TO **MCTS** (promising branches ~10+ turns, unpromising ones minimally) — which is the question #62 exists to answer, already answered by someone who shipped. Its four techniques land on #24 (roll grouping), #32/#35 (likelihood-weighted chance nodes), XATU/SLOWKING (**hidden info as a FILTERED POSSIBILITY SET, not a point estimate** — it keeps candidate sets per opposing Pokémon and narrows them as the battle reveals things; we pick one most-likely set) and #43 (reverse damage-calc inference). **Positioning stays clean** — singles, Species Clause, and the source says outright *"specifically in singles, it's not VGC"* — same inputs as our store, different game. **And its fairness critique lands on us**: a ladder bot is argued UNFAIR rather than merely strong, because a human cannot process branches at that rate under a timer. The paper should meet that deliberately; note the premise is not yet true of us, since MILTANK needs 26s against a 20s budget (#61). **Everything here is a video narrator's paraphrase and must be verified against the source before it is cited** | verify first |
| — | **parallelise the search** — 16 cores available, nothing uses more than one | unlocks K=8, which is where the miss rate reaches 1.4% |
| #31 | the mega must be a strategic decision, not "the lead keeps it" | dual-mega teams are the case that proves it |
| #6 | AXIS-4 reparameterisation, then WOBBUFFET in it | |

### 5.4 Solving — DUSK, and the retrograde idea

| # | item | note |
|---|---|---|
| #47 | **solve exactly whenever switching is off the table** — 1v1 is 16 cells, 2v1 is 96, 2v2 is ~1,296 | 2v1 alone reaches **45.9%** of games |
| #47 | **retrograde analysis** (Will): with 2v2 solved, a 3v2 reduces to *which solved 2v2 do I steer into* | this is how chess tablebases are built |
| #29 | **THE SACK** — a planned sacrifice is invisible to a material-weighted leaf | it is the same idea: the sacrifice is the move that reaches a won position |
| #41 | reach the Python equilibrium solver from the JavaScript bot | a small-case port is verifiable against `nash.py`; a full port is not |
| #30 | DUSK as a **goal** — nothing in the project represents a goal, only positions and actions | |

### 5.5 Built, measured, and never used in a live decision

The recurring failure of this project, kept together so the pattern stays visible.

| model | state |
|---|---|
| **DODUO** | fitted, refitted, +2.1 top-1 over independent choice, **never read by the search** (#53) |
| **PORYGON2** | built, separation gate passed, **never called by a live decision** (#24) |
| **GARY `prior`** | wired end to end, **default is a coin** (#32) |
| **MAG's scores at the candidate list** | not attached, so the screen prunes with the rollout instead (#37) |
| **MACHAMP** | *"half-run and stale — the single largest untested lever in the project"*; artifact deleted 2026-08-02 |
| **the Nash solver** | verified on RPS and a 2×2, in Python, unreachable from the bot (#41) |

### 5.6 Measurement integrity

| # | item |
|---|---|
| #26 | refit MAG on bo3 only — the corpus change is in code and unrun |
| #50 | WIRE 124 moved a position feature; models fitted on it predate the correct number |
| #48 | 27 of 28 Python generators could write a file JavaScript cannot read — **closed, gated** |
| #27 | three instruments built that had never written an artifact — **truncation curve now run**, two left |
| #44 | a move that provably does nothing is a weighted preference, not a rule — needs a refit |
| #57 | **every rollout-derived number predates a correct engine** — the leaf's 51.0%, R1's 69.84%, R4's 55.5%. Enumerate the re-run list from the release stamps; prioritise by whether the verdict could flip, not by age |
| #108 | **TWO REGISTERED GATES ASK DIFFERENT QUESTIONS AND NEITHER CONSULTS THE OTHER.** `engine/status.js` prints figures out of artifacts `engine/provenance.js` calls UNSAFE — the release-ladder block at `status.js:353` reads `data/wire-ladder.json`, which provenance flags UNSAFE for computing from a `games.bo3.jsonl` that has since moved. Both are gates in `tests/run-all.js` and both are green about their own question. #105 removed the excuse: every artifact `status.js` reads now HAS a row, so the two can be asked the same question about the same file. Needs a decision on the SHAPE first — withhold like the quarantine, or caption — and CLAUDE.md is explicit that a caption is not a quarantine | open — `docs/MEASURE.md` §00a |
| #105 | **~50 ARTIFACTS HAD NO ROW IN THE DEPENDENCY GRAPH — DONE, 3.85.0.** `engine/provenance.js` found a writer only by literal name in `engine/` and `build/`, so everything written by `tests/` (the census, the differential, the interaction matrix, the deliberate roster) or through a computed path had no row at all, and nothing could compare it to its source. It scans `tests/` now, turns a concatenated or template path into a pattern, and accepts an artifact's own `by` where no source can say — each labelled in a new `via` field, ranked, and a template match revoked unless its key shape agrees with something the generator writes by name. **115 → 160 artifacts, 61 → 16 unknown, quarantine 34 of 114 → 40 of 160.** `data/rollout-r1-explore1.json` — the arm `engine/miltank.js` runs — classifies on its own and is HELD, so the both-files workaround at `status.js:665` is retired-able. Four false attributions closed on the way, three of them introduced by the change itself and caught before it landed. The UNKNOWN list is printed every run, including at zero | done — `docs/MEASURE.md` §00a |
| #58 | **two `moveAccuracy` implementations disagreed for 78 moves** and nothing compared them. `board.js` read the dex and was right; `medicham2` read a hand-typed list and was wrong. Make it one function and assert it |
| #110 | **THE MOVES QUEUE — the roster's moves stage, measured for the first time at 3.79.0 and worked down since.** 52 → 40 → 32 → 25 → **23 FIRED-AND-BOARDS-DIFFER**, plus 24 DID-NOT-FIRE and 91 COULD-NOT-STAGE, against 362 matching. **3.94.0 closed Clanging Scales and Scale Shot: Showdown keeps the user's own stat change in TWO fields (`self.boosts` AND `selfBoost.boosts`) and the builder read one — the six moves using `self` all read MATCH, which is exactly why it looked closed.** **3.93.0 closed the partial-trap family — seven rows on one fact.** Bind, Fire Spin, Infestation, Sand Tomb, Snap Trap, Whirlpool and Wrap each read `showdown 4 / ours 3` then `3 / 2`; identical deltas across seven independent rows is one fact, not seven bugs. `partialTrap: {turns:'4-5'}` was **typed by hand** and is the FELT duration, while the compared quantity is Showdown's `partiallytrapped` counter, which starts at 5 and is decremented in the Residual **of the turn the trap lands**. **The volatile-duration defect a third time** (Perish Song, then #111's family) — it survived both because this counter lives in `_trap` and not `_vol`. Now derived from the condition itself (duration, the `random(5,7)` range, the Grip Claw branch, `onStart`'s `boundDivisor`) and **failing closed**. Red shown on the frozen pre-fix release. Whole-game differential unmoved at 65/107. **Remaining clusters BY CORPUS WEIGHT, which is not the order they look biggest in — `encore` alone is 6,102 uses, 55% of what is left, while the whole lock-in family is 101:** 13 `move/plain-attack` (of which outrage/petaldance/ragingfury/thrash/uproar are one lock-in family), 4 remaining `move/volatile`, 9 `move/generic-status`, 6 `move/boosts-target`, 3 `move/multihit` (Triple Axel, Scale Shot, Dragon Darts — three DIFFERENT mechanics), 3 `move/fixed-damage` | open — `docs/ENGINE.md` |
| #70 | **TWO USAGE COUNTS EXIST AND NEITHER KNOWS ABOUT THE OTHER — but the engine queue is NOT where it bites.** `data/meta-usage.json` (what CHOMP reads) filters hard: collected 39,792 → **after_bot_filter 13,263** → behavioural bots 10,480 → forfeits → min turns → full bring → **7,123 clean**. `data/tags.json` (which every "N uses" in this project is quoted from) reads `loadCorpus({scope:'all'})` across `games.bo3` + `games.ots` + `games.ladder` — 11,429 games, 137,148 sheet entries, **no bot filter and no quality filter**. **CORRECTED 2026-08-10 BY WILL, and the correction is the important half:** *"it doesnt really matter because its not like bots can break the rules, the moves, mons, and items they use we still need to have in medicham right"*. Exactly right. A bot cannot click an illegal move, so every entity it uses is one MEDICHAM must handle anyway — and the MEDICHAM gate demands **zero** DIFFER and **zero** DID-NOT-FIRE, so the count changes the ORDER of work and never the destination. The unfiltered count is arguably the CORRECT one for an engine queue: it measures exposure. **Where it does still bite is the OPPONENT MODEL** — what a human will bring and click — which is what the bot filter exists for and what CHOMP consumes. So this is a MEASURE item about `meta-usage.json`, not an ENGINE item about the queue. *(An earlier draft of this row claimed three sources disagreeing 13x, citing a scan of `games.ladder.jsonl` alone that found 15 Iron Ball rows against tags.json's 139. That scan was WRONG — ladder alone carries sheets on 1.7% of sides because the sheets live in the bo3 and ots files. The 139 is sound. Retracted.)* | open — MEASURE, not ENGINE |
| #100 | **THE ROSTER'S CONTROL ARM MEASURED THE CONTROL — DONE, 3.78.0.** `ability/generic` picked its control by taking another live ability off the same species, so Sand Rush's control was Fluffy and Fluffy's control was Sand Rush, and the two deltas were the same numbers swapped. Four false findings across 2,049 uses, every one of them reported as an engine bug. A control is now a NAMED quiet ability, chosen once and recorded in one place, and `tests/probe_pair.js` refuses a control that is not quiet. This is why #116's pairing class is declarable rather than fatal: forcing a per-species-legal control would reintroduce exactly this | done — `docs/ENGINE.md` |
| #116 | **`new Battle()` VALIDATES NOTHING — a probe could measure a mechanic this format does not contain.** Will: *"why dont we use showdowns teams validator that is universal truth"*. Now it does. `engine/champions_sim.checkLegal` asks the `TeamValidator` — the authority ADR-002 names, through the instance `packTeam` already builds — and splits its complaints into **BANNED** (the format does not contain this; always fatal) and **PAIRING** (this species cannot hold this; a legitimate isolation, declarable in writing). It catches strictly more than an `isNonstandard` check: *"Meganium can't learn Flamethrower"* is a legal move on a species that cannot have it, and that set was hand-staged on 2026-08-08. Caught two defects in its own harness on the first run — `Tackle` is `Past` and every inert slot carried it, and the padding species were named from memory and included one not in the format. **The sweep that followed (3.92.0) settled the blast radius:** the `.item`/`.ability` assignment surface across **238 files is clean** (one hit, `noability`, the blank sentinel), so the hazard this item was written about never actually fired — but **move literals** hit five sites, two of them defects. `test-priority-block.js` silenced three slots with Splash, which has **no `MC.moves` row at all**, so the silencing worked through ABSENCE rather than through the move doing nothing; and `test-dead-volatile.js` guarded on `.exists`, **which is true for a banned move**, so the guard could never fire and the case always ran on Thousand Arrows. Tightening that guard would have moved the hole rather than closing it, so the subject is derived from the format (Smack Down). **Still open:** `staged_board.js` and `game_differential.js` (`buildPair`) | open — `docs/ENGINE.md` |
| #117 | **THIRTEEN MOVES EXECUTE AND NEVER RECORD `_lastMove`, SO ENCORE CANNOT REACH MOST OF WHAT IT EXISTS TO PUNISH.** Measured across the whole 500-move table at 3.98.0, not grepped: every `heal` kind (Recover, Roost, Life Dew, Moonlight, Morning Sun...), both `switch` kinds, `tail`, `trickroom`, `wideguard`. The other 27 kinds record it on all 500. `volNeedsLastMove` then CORRECTLY refuses a sealer against a body with no recorded move — so a live Encore can never lock anyone into **Trick Room, Tailwind, Wide Guard or a recovery move**, which is the list Encore is clicked for. 3.98.0 made a locked status move execute and PROVED the payoff (Encored into Trick Room the victim re-clicks it and the room comes DOWN, tr 3 -> tr 0) — but only from a lock set directly, which is what both of the engine's own writers do. **The capability is built and unreachable.** Five one-line writes, except Instruct reads the same field, so it needs its own probe rather than a sweep | open — `docs/ENGINE.md` |
| #118 | **THE CHOICE LOCK DOES NOT ARM ON A STATUS MOVE.** Choice Scarf is legal here on 7,844 uses and Scarf+Trick is a real set. Measured on the frozen release: `knockoff` -> `_lock=knockoff, _lockT=Infinity`; `taunt`, `tailwind`, `trickroom`, `swordsdance` -> `_lock=undefined`. The arming line sits below `if(a.kind!=='attack')continue`, the same guard that hid #119. So a Scarf holder that clicks a status move is free to click anything next turn. 3.98.0 fixed HONOURING a lock and deliberately did not fix CREATING one — the close needs a single shared "the move was committed" site across ~30 status kinds, which is a refactor and not a patch | open — `docs/ENGINE.md` |
| #119 | **STRUGGLE IS NOT IMPLEMENTED — it is a silent no-op, and three call sites return it.** Handed `{kind:'struggle'}` with both foes passing: **0 damage to the foe, 0 to the user, and no `|move|` line** — the whole turn is `|turn|1` `|upkeep|`. There is no `a.kind==='struggle'` branch and `if(a.kind!=='attack')continue` eats it. **A retraction is recorded here rather than quietly dropped:** the 3.98.0 diagnosis claimed a locked body Struggled *for 62 damage a turn* and called Encore inverted. That was wrong — 62 was the ALLY acting, because the probe let the engine choose for both bodies, and the identical 62 across three unrelated status locks was evidence the locked mon did NOTHING. The real defect was a silently voided turn. Closing it is a family, not a line: a new action kind, a typeless damage path, recoil as a fraction of MAX HP, and a selection rule this engine has no PP to express | open — `docs/ENGINE.md` |
| #120 | **A GATE CLAUSE REPORTS `PASS` WITHOUT REPORTING ITS DENOMINATOR.** Will, 2026-08-10: *"check the abilities clause for the same hole"*. The abilities clause reads **84 fired and matched** and passes. It is 84 of **316** rows — 26.6%. 217 are COULD-NOT-STAGE and 15 are CONTROL-NOT-QUIET. On the fair denominator (excluding the **115** abilities with NO LEGAL CARRIER in this format, which are correctly out of scope rather than untested) it is **84 of 201 = 42%**. The clause is not lying about what it tested; the GATE is silent about what it did not, and that is the same shape as "a caption is not a quarantine". A clause that says PASS must say *of how many*. Arena Trap and Magnet Pull are in the 115 and are genuinely not applicable; **Shadow Tag is the one real gap** — its carrier is mega-tier, the forme change WRITES the ability, so the only available control is suppression<br><br>**ITEMS IS THE CONTRAST, AND IT MATTERS — this is NOT a systemic reporting failure.** The items clause is **139 of 148 = 93.9%** actually tested (8 COULD-NOT-STAGE, 1 deferred by the owner). So a stage CAN reach near-total coverage, and the abilities figure is a property of that stage rather than of the instrument. Printing the denominator will show items looking strong and abilities looking thin, which is the true picture and the reason to print it | DONE 2026-08-10 — the clause states tested / in scope / total and names every unattributable row; the artifact carries a `scope` block written at the refusal. `docs/MEASURE.md` §000 |
| #121 | **FIFTEEN ABILITY ROWS ARE INVALID AND ARE CARRIED INSIDE A GREEN CLAUSE.** `CONTROL-NOT-QUIET` means the control arm was ANOTHER LIVE ABILITY — Damp controlled against Electromorphosis, Imposter against Limber, Ice Body against Sturdy, Fluffy against Sand Rush — because those species have no quiet alternative. Two live abilities on one board measures neither. This is #100 surviving in the cases #100 could not fix: #100 stopped the control being *another live ability of the same species chosen automatically*, and these 15 are where no quiet alternative exists at all. They are not passing and they are not failing; they are unmeasured, and the clause counts them in neither column. Either stage a quiet carrier from another species or declare the row untestable with its reason — the one thing that must stop is a green clause with 15 invalid rows inside it | DONE 2026-08-10 — a SECOND CONTROL varies the live control arm on 98 rows; 9 of the 15 resolved (5 DID-NOT-FIRE, 2 DIFFER, 1 MATCH, 1 unattributable-but-measured), 6 DECLARED UNTESTABLE with the pool printed, and 8 VACUOUS GREENS were caught. `docs/MEASURE.md` §000 |
| #122 | **THE ROSTER SCRIPT LANGUAGE HAS NO SWITCH ACTION, AND `board_state.js` DOES NOT COMPARE TRAPPING AT ALL.** Will, 2026-08-10: *"we need to test the switch blocking like shadow tag, block, and the trapping moves, so we need to be able to switch in the test"*. The roster says it in its own source at `tests/roster.js:1814`. Two layers, and they must not be confused: **the ENGINE switches fine** — measured, `{kind:'switch', to: body}` through `battleTurn`, and a partial trap correctly REFUSED it while the untrapped control left freely — but the roster drives through the differential's script language, which cannot express the action, and even if it could the comparator has no field for trapping. That is why `Block` reads INERT: nobody ever tried to leave. Covers the hard-trap moves (Block, Mean Look, Spider Web, Anchor Shot, Thousand Waves), the partial-trap family's switch-prevention half (chip damage was closed at 3.93.0; the trapping half has never been compared), and the trapping abilities | PART DONE 2026-08-10 — the ABILITY stage can ask for a switch and the ask is proven in both engines (`abilitySwitchWorks()`); it closes ZERO trapping rows because Arena Trap and Magnet Pull have no legal carrier and Shadow Tag is mega-tier with suppression measured dead. The MOVE half is the moves stage`s. `docs/MEASURE.md` §000 |
| #123 | **THE SEMI-INVULNERABILITY EXCEPTION LIST IS ABSENT — Earthquake MISSES a digging target instead of hitting it for double.** Will, 2026-08-10: *'dig gets double hit by earthquake? and maybe some others? same with dive and surf?'* Right on both counts. **THIS ITEM CARRIES A RETRACTION OF ITS OWN FIRST VERSION.** It originally read *'`_invuln` is set and never read, a charge move gives ZERO protection'*, measured with Knock Off dealing 50 to an underground body. **That was the probe, not the engine** — both bodies were Incineroar, a SPEED TIE, so the attacker could resolve BEFORE Dig went underground, which hits legitimately. Re-run with Dragapult (142) charging against Torterra (56), so the charge always resolves first: **Knock Off deals 0. Invulnerability works, and `_invuln` is consumed at line ~8912.** The seventh broken probe of this sprint and the first one that was mine. **The real defect is the EXCEPTION:** `earthquake` into `dig` deals **0** where the authority hits for **2x** (47 grounded, so 94 owed); `surf` into `dive` deals **0** against 13 grounded. The engine models the invulnerability and not the moves that beat it, so those pairings are wrong in the opposite direction to the original claim — the counter-play is impossible rather than free. Authority table, from each move's own `condition` (`onInvulnerability` then `onSourceModifyDamage`, both derivable by shape): Dig DOUBLE from earthquake/magnitude; Dive DOUBLE from surf/whirlpool; Fly DOUBLE from gust/twister/skyuppercut/thunder/hurricane/smackdown/thousandarrows; **Bounce is HIT BY that list but NOT doubled** — two handlers, not one, and a name-matched fix would flatten them; Minimize DOUBLE from the stomp family | open — `docs/ENGINE.md` |
| #124 | **THE WEATHER-CONDITIONAL MOVE FAMILY, SWEPT.** Nine moves in this format change behaviour with the sky. **Verified CORRECT and now on record rather than assumed:** Thunder and Hurricane are never-miss in rain and 50 in sun; Blizzard is never-miss in snow and untouched by sun; Solar Beam and Solar Blade closed under the precondition layer. **Broken:** `growth` does not double in sun (sd +2/+2, ours +1/+1) — it read MATCH for months and went red the moment its precondition was real, which is the sharpest argument for the precondition work there is. **Open: only Growth.** A later sweep at release `f727f7fdee4f` closed the rest and this line is corrected rather than left standing: `weatherScaled` has ELEVEN members and five payload shapes, **Growth is the sole member carrying a `boosts` payload**, Weather Ball now reads MATCH (#96's fix took), and the other nine — including **Electro Shot, which this item wrongly called untested** — are all green under `move/needs-the-sky-it-names`. The remaining untested weather surface is on the ABILITY side: `solarpower`, `raindish` and `icebody` all read CONTROL-NOT-QUIET. `dig` appears in a naive weather scan and is a FALSE POSITIVE — its weather mention is `onImmunity` (underground bodies take no sandstorm or hail chip), a different mechanic, recorded here so the next sweep does not re-find it as a bug | open — `docs/ENGINE.md` |
| #125 | **THIRTY-TWO MOVES RESOLVE TO `{kind:'pass'}` — A WHOLE NO-OP TURN — AND THE LINE THAT RETURNS IT HAS NO COUNTER.** `medicham2-browser.js:11280` is the terminal fall-through of the classifier cascade: every move no branch claimed becomes a wasted turn. **1,702 corpus uses** land there. Nine of the thirteen rows the precondition layer newly exposed on 2026-08-10 arrived through this one line, and only ONE of the thirteen was named by any counter (`MEDFAILS.healProcedural`, `first: 'swallow'`). This is CLAUDE.md's founding failure — *a capability was absent and everything reported success* — sitting in the exact place built to catch it, which is why those moves were invisible until a probe was pointed at each one individually. **A counter here is cheap and would have surfaced all nine at once**, plus the 19 nobody has looked at yet. It must record the move id, not just a tally: `healProceduralFirst` naming `swallow` is what made that one row findable. Do this BEFORE the individual fixes, so the fixes have a number to move | open — `docs/ENGINE.md` |
| #126 | **QUICK GUARD IS THE ONLY SOURCE OF PRIORITY REFUSAL THAT DOES NOT WORK — 927 uses, and the machinery it needs is already built.** Will, 2026-08-10: *'have quick guard block all prio moves and test it against some prio moves not that hard'*, then *'its like armor tail'* — and that comparison is the whole diagnosis. Measured, a +1 Quick Attack into a Farigiraf: **Armor Tail 0, Dazzling 0, Queenly Majesty 0, Psychic Terrain 0 — all REFUSE. Quick Guard lets it through for 25**, identical to the no-guard control. The ability and field sources of this mechanic are correct; only the MOVE source is unwired. **The tell is that `quickguard` and `wideguard` carry BYTE-IDENTICAL tags** — `[priority, neverMisses, oneTurnGuard, statusCategory]` — and Wide Guard resolves to `kind:'wideguard'` while Quick Guard falls through the classifier to `{kind:'pass'}` (#125). So the engine is telling them apart by NAME, which this repo forbids, and `oneTurnGuard` carries no param saying WHAT is guarded against. The fix is a tag param (priority vs spread, derived from each move's own condition) plus a consumer that calls the EXISTING `priorityRefusedAbove` fact — not a new mechanic. Wide Guard at 3,997 uses rides the same tag and must not regress; its own gap (it does not stop spread STATUS moves) is filed separately | open — `docs/ENGINE.md` |
| #127 | **FIVE TAG SIGNATURES ARE CARRIED BY MOVES THE ENGINE TREATS DIFFERENTLY — so something other than the tag is deciding, and 105,709 uses sit on those signatures.** Generalised from #126 rather than left as one anecdote: every move in `data/tags.json` was resolved through `playerAction` on the frozen release and grouped by its sorted tag list. Five groups split on the resolved kind, and a split can only mean a NAME match (forbidden here) or a tag missing the param that should separate them (#71). Ranked: **96,406** `protect`+`detect` -> `protect` but `endure` -> `affect`, the highest-usage signature in the format carrying THREE behaviours — and `PROTECTMOVES` is an exported NAME LIST, which is the mechanism; **4,924** `wideguard` -> a branch, `quickguard` -> nothing (#126); **3,721** `roost`/`recover`/`slackoff`/`softboiled` -> `heal` while **`wish` and `rest` -> nothing**, because the tag says *heals self* and cannot express DELAYED or ALSO-SLEEPS; **524** `beatup`/`hex`/`storedpower` -> `attack`, `spitup` -> nothing; **134** `bellydrum`/`tidyup` -> `statcode`, `acupressure` -> nothing. The last three overlap #125's dead list and groups A/B of the 13-row diagnosis, so the fix is shared. **The check itself is the deliverable** — it is cheap, it is derived, and it should be a gate: a signature whose members resolve to different kinds is either a name match or an under-specified tag, and both are defects by this repo's own rules | open — `docs/ENGINE.md` |
| #128 | **THE BERRY-ABILITY FAMILY IS UNIMPLEMENTED — six of seven, and two are blocked on a field the simulator does not have.** Will, 2026-08-10: *'do you have the berry abilties impelmented, like cud chew, harvest, etc'*. Measured: **Cud Chew, Harvest, Gluttony, Cheek Pouch and Pickup are `untagged`** and all COULD-NOT-STAGE; **Ripen is tagged `damageReduce`**, which catches its resist-berry doubling and NOT that it doubles every berry effect — a Sitrus under Ripen heals 50%, so it is modelled in a way that reads as covered; **Unnerve alone works** (`blocksBerries`, FIRED-AND-BOARDS-MATCH). **The structural blocker for Harvest and Cud Chew is the same one that blocks Recycle (#71): `lastItem` and `ateBerry` appear ZERO times in `medicham2-browser.js`.** A consumed item leaves `item: ''` and nothing records WHICH berry it was, so an ability that gives one back has nothing to give. One new field unblocks three mechanics across two divisions. Gluttony and Cheek Pouch do NOT need that field — Gluttony moves the pinch threshold from 1/4 to 1/2 and Cheek Pouch heals 1/3 on any berry consumption, both derivable from the ability's own handler. Note the interaction hazard for whoever wires this: a berry firing at half HP heals 25%, which is numerically identical to Life Dew, Hospitality and Aqua Ring — two probes were contaminated by exactly that tonight, so any berry-ability probe must strip or control items on every body | open — `docs/ENGINE.md` |
| #129 | **'GOOD ENOUGH' IS A USAGE-WEIGHTED THRESHOLD, NOT A ROW COUNT — and by that measure the engine is already at 99.24%.** Will, 2026-08-10: *'we do have to ask ourelves at what point is the engine good enough and has enough used features that it can perform its end goal'*. Measured against the corpus rather than argued: **553,910 total move clicks; 781 (0.14%) land on a move that resolves to a whole no-op turn; 3,888 (0.70%) land on a move the roster says disagrees with the authority; the union is 4,208 = 0.76%.** So **99.24% of real clicks land on a move with no known defect**, and the game differential is 150/150 clean on real replayed games. **THE GATE IS A COVERAGE STANDARD AND HAS BEEN READ AS A SUFFICIENCY STANDARD.** Its 45 open move rows are deliberately-staged edge cases, which is precisely why they survived — they barely occur. The honest test of sufficiency is ROADMAP #68: scale the differential from 150 games to 1,000+ real stored games. If it stays clean there, the remaining rows are polish and can run BESIDE search work rather than blocking it, and the #99 quarantine can lift on a measured condition instead of a feeling. Note the standing counter-evidence, which cuts the same way: `docs/MEASURE.md` §0 carries a TIGHT NULL at n=8,883 on the hypothesis that correctness fixes move the leaf at all | open — `docs/MEASURE.md` |
| #130 | **THE OPTIMIZATION PASS — hand MEDICHAM to Fable 5 and say make it faster, but only behind a correctness gate a stopwatch cannot fake.** Will, 2026-08-10: *'once we think medicham is good enough i plan to run some optimization programs to speed it up'* / *'handing it over to feeble 5 and saying make this go faster'*. Dispatchable directly — the model is selectable per agent. **THE HAZARD IS THAT 'FASTER' AND 'DIFFERENT' ARE INDISTINGUISHABLE TO A BENCHMARK.** An optimizer that shaves 30% by skipping a branch produces a beautiful number and a broken engine, and every existing test can still pass because those tests cover mechanics the branch never touches. So the pass runs THREE instruments, not one: **`tests/bench-medicham.js` for the score** (built 2026-08-10, pinned fixture, best-of-5, refuses to record a baseline under load — first reading **0.4341 ms/turn**); **the 500-move x 4-turn whole-board digest sweep for the verdict** (2,000 cells; WIRE 147 used it to show only 11 moved, and that is the shape every optimization must reproduce at ZERO); and **`tests/test-damage-stages.js`** at 1728/1728 exact so arithmetic shortcuts cannot drift. **SEQUENCING, which decides how much work this is:** the classifier cascade is BOTH the most likely optimization target AND the thing the remaining ~20 wires append to. Restructure it first and the queued fixes land in the restructured version; do the wires first and the optimizer rewrites code that was just written | open — `docs/ENGINE.md` |
| #131 | **THE COST OF A FEATURE DEPENDS ENTIRELY ON WHICH PATH IT SITS IN, and the first measurement of that was taken 2026-08-10.** Will: *'how many of these features will slow down the engine? cause if it costs nothing to have harvest in there, then sure we can, but if there is a time cost to it then maybe we otta reconsider'* — the right question, and the answer splits cleanly. **HOT PATH** — runs on every click of every rollout: the damage chain and the ~40-branch classifier cascade. Tonight's five wires cost **+6.2%** (0.776 -> 0.825 ms/turn, interleaved A/B across frozen releases under load), and the per-hit damage loop is almost certainly all of it, being the only wire that touched damage. **COLD PATH** — fires once per turn on a trigger, and is effectively free: Harvest, Cud Chew, Cheek Pouch, Quick Guard, the heal family. **So Harvest specifically: yes, free.** The thing to actually guard is COMPOUNDING — 6% per five wires, twenty more wires, and the engine is ~25% slower to serve 0.76% of clicks. That trade stops being worth it well before the queue empties, which is the argument for #76's ratchet firing on every wire rather than at the end | open — `docs/ENGINE.md` |
| #132 | **THE SECONDARY-EFFECT CHANCES, CHECKED AGAINST THE AUTHORITY IN TWO SECONDS AND NO GAMES.** Will proposed running a few million self-play games to see whether our accuracy and secondary rates are right. **Self-play cannot answer that** — it samples OUR declared number, so a tag saying 30% where Showdown says 10% would produce a beautiful, confident, wrong 30%. The authority STATES the chance, so it is a derivation check rather than a statistical one. Measured 2026-08-10 over the 128 moves in this format carrying a secondary: **93 match exactly, 1 MISMATCHES, 34 carry no chance at all.** The mismatch is **Triple Arrows — the authority has TWO secondaries, a 50% defence drop and a 30% flinch, and we carry only the first.** The 34 without a recorded chance are mostly 100% secondaries which may be modelled as certainties elsewhere; that needs checking, not assuming, because 'modelled as a certainty' is how the Focus Sash drag became a hard 1.0 (CLAUDE.md). Do this BEFORE #133 | open — `docs/ENGINE.md` |
| #133 | **A FEW MILLION SELF-PLAY GAMES TO PROVE THE SAMPLER FIRES AT THE RATE WE DECLARED — Will's idea, and the right tool for the question it actually answers.** *'once we feel our engine is good we can have it play a few million games and then determine if our rate for accuracy and secondary effects is right'*, then, on the distinction: *'correct run the million games after we determine'*. So: **#132 first** (is the declared number right — free, exact), **then this** (does the code fire at it — statistical). This catches the failure a probe structurally cannot: a probe FORCES the outcome to test the mechanic, so a secondary declared at 30% that a bug makes fire at 0% or 100% passes every probe and every roster row. That is CLAUDE.md's founding failure — a capability absent while everything reports success — in the one place the existing instruments are blind. **Cost is not a constraint:** at the measured 0.4341 ms/turn and a mean 3.6-turn rollout, a million games is roughly half an hour. Compare observed firing rates against the declared chances with a confidence interval per move, and expect the answer to be boring — the value is the one that is not | open — `docs/MEASURE.md` |
| #134 | **THE STORE REACHES FOUR FACTS AND THROWS THEM AWAY — and #68 needs every one of them.** Will, reading the replay design: *'i think multi hit moves say how many times they hit in the chat'*, *'life orb in the chat too'*, *'same with focus sash'*. All correct. `engine/durable-ingest.js` parses 30 protocol lines and drops these four: **`|-hitcount|`** (never read — so the differential SKIPS 630 multi-hit rows as incomparable when the real hit count was on the wire); **`|cant|`** (never read — a flinched, paralysed, asleep, frozen or recharging body is simply an ABSENT `m` event, indistinguishable from each other, 0 games in 52,089 carry a flinch marker); **the `[from]` clause on chip damage** — the parser TESTS for it to decide the damage is residual and then discards the text, so burn, sandstorm, Life Orb and Rocky Helmet all land as a bare `{t:'hp'}` with no source, and its own comment names them; **`|-enditem|`**, read only to infer what item a body held, never emitted as a turn event, so 'the Focus Sash triggered this turn' is gone. The store's event vocabulary is `b f fs hp m mega s w x`. **This contradicts the project's founding principle** — *store raw, analyze on top, every fact we might ever want* — at the parser. Four regex arms; the raw replays can be re-pulled so no history is lost. OPS work, touches no engine, and it makes #68 able to attribute a divergence instead of reporting an unexplained HP drop | open — `docs/OPS.md` |

**What is safe and what is not, because the distinction decides what has to be re-run.** Anything
that ranks or predicts through `board.js` never touched the broken simulator — the truncation curve,
DODUO's top-1 figures, MAG's realism table. Anything that runs a **rollout** went through
`medicham2`, where until 2026-08-06 the weather resolved backwards from turn one, 78 moves could not
miss, Last Respects reverted, and a type-converted move dealt zero. **That is not a claim the numbers
were wrong** — WIRE 123's error was symmetric across both arms of a paired comparison, so a contrast
may survive it while an absolute rate does not. Establishing which is the work.
| #141 | **MOLD BREAKER SUPPRESSES 82 ABILITIES IN THIS FORMAT, AND WE DO NOT KNOW WHETHER OUR ENGINE READS IT AT ALL.** Will, 2026-08-10: *"DOES TINKATON MOLD BREAKER FAKE OUT FLINCH A MON WITH INNER FOCUS? IDK WHAT THE ANSWER SHOULD BE"*. Measured against the format: **yes it does.** Inner Focus carries `flags: {breakable: 1}`, Mold Breaker sets `move.ignoreAbility = true`, and Tinkaton carries Mold Breaker legally. **The surface is 82 abilities** — Disguise, Sturdy, Levitate, Filter, Shell Armor, Shield Dust, Solid Rock, Multiscale, Thick Fat, Wonder Guard, Suction Cups, Volt Absorb, Water Absorb and the whole immunity family. **Steadfast is NOT breakable** (`flags: {}`), so a Mold Breaker Fake Out into Steadfast flinches AND grants the +1 Speed, while the same click into Inner Focus flinches and grants nothing. Two abilities that look like siblings behave oppositely, which is exactly the kind of pair a name-matched implementation gets wrong. **AND THE OBVIOUS LOOKUP IS A TRAP:** `ability.isBreakable` reads `undefined` on every ability in this format, so a naive check concludes Mold Breaker suppresses NOTHING and passes its own test. The live flag is `flags.breakable`. Nothing in `data/tags.json` or the engine is known to read `ignoreAbility`; that is the first thing to measure, before any wiring | open — `docs/ENGINE.md` |
| #95 | **A TRANSFORM MUST REVERT ON SWITCH-OUT — and the copy half turned out to work.** Measured 2026-08-10: Imposter DOES copy on entry, including the target's stat stages; my probe reported otherwise because it passed `seeded: true`, which skips entry effects. The real gap was the REVERT, and it is closed. What remains is the general rule this revealed — a body that changes forme or identity mid-battle must restore its own species, stats, typing, moves and ability on switch-out, and Ditto is only the loudest carrier | closed 2026-08-10 — `docs/ENGINE.md` |
| #139 | **THE ELEVEN MOVE ROWS THAT HELD THE GATE, AND THE PATTERN UNDER THEM.** toxic, clangoroussoul, saltcure, noretreat, steelbeam, terrainpulse, growth, painsplit, copycat, metalburst, endure. Ten closed on their own mechanics; Copycat is shelved by the owner. **Most were ONE shape — the tagger had already derived the fact and the engine read only the default**: saltcure's `perIfType`, growth's `weatherScaled.boosts`, steelbeam's `recoil.of`, metalburst's `fixedDamage.source`. Two were arithmetic the derivation got wrong rather than missing (toxic's ramp order, clangoroussoul's 33/100 cost). Four needed new tags. **The generalisation worth keeping: when the tagger is ahead of the engine, the cheapest remaining wins are READERS, not derivations — but a row with no tag at all is a different and larger job, and the two must not be triaged together** | closed 2026-08-10 — `docs/ENGINE.md` |
| #143 | **THE SCENARIO CATALOGUE — one test SHAPE per mechanic, covering every move, ability, item and species.** 920 entities carry 217 distinct tags, so 217 shapes cover all of them and an entity added tomorrow inherits its shape without an edit; plus 357 legal species as one `structural` shape that needs no battle, only a comparison against the format. Ten archetypes, and the archetype decides which instrument can ask the question — `chance` tags are marked so nobody builds a one-board test for a coin. **Two fields make it work and both are Will's:** `faces`, the ADVERSARY'S action as distinct from the subject's precondition (*"WIDE GUARD NEEDS A SPREAD MOVE AGAINST IT, ITS POINTLESS TO TEST IF IT DOESNT FACE THAT"*), without which a shape passes by doing nothing — and it explains the COULD-NOT-STAGE pile; and a PROPERTY tested through its REACTOR (*"HAVE CONTACT HIT ROUGH SKIN TO CHECK"*), which resolves the `contact` flag's 166 moves in one shape. Built by `engine/scenario_catalogue.js`, written to `data/scenario-catalogue.json` | open — `docs/ENGINE.md` |
| #145 | **PP DID NOT EXIST IN A BOARD POSITION, SO EVERY ROLLOUT STARTED AT FULL PP — CLOSED 2026-08-10.** ROADMAP #144 gave the SIMULATOR real PP; the gap it named in its own header was that `engine/board.js` tracked none, so a stall priced eight turns deep inside a playout was eight turns from NOW rather than eight from the start of the game. Measured RED first: a position that had already seen **8 Protects** rolled out **8 more** — sixteen out of a move that has eight (`data/pp-board-probe.json`, written by `engine/pp_board_probe.js`). It matters despite median-6-turn games precisely BECAUSE the rollout cap is 60 (#38): a 60-turn playout with infinite PP discovers unlimited Protect, unlimited recovery and unlimited redirection, which is a systematically WRONG valuation of exactly the positions the search believes it is being clever in. Fixed by a per-side, per-SPECIES ledger on the Board — PP belongs to the Pokemon and not to the slot, and `switchIn` rebuilds the slot object, so a slot-held table would have refilled every move on a pivot — spent in `noteMove` ABOVE the `worked` gate because Showdown deducts for a move that fails, and carried onto the built body by `dmgMon` AFTER the sheet overwrites `b.moves`. **No feature was added and `candidates()` still offers a drained move**, deliberately: both would change what MAG clicks and each deserves its own arm. A second defect fell out — at the shipped `explore=1.0` the playout's uniform draw bypasses the chooser, so a drained body wasted turns on `\|cant\|nopp` (52 of them) instead of Struggling; the draw now filters on selectability | closed 2026-08-11 — `docs/SEARCH.md` |
| #146 | **THE PP FACT HAS TWO READERS UNTIL ENGINE ADOPTS THE SHARED ONE.** `medicham2-browser.js`'s `ppMax` / `ppLeft` / `ppDeduct` / `ppAllOut` / `ppPressureExtra` are FILE-LOCAL — on neither `module.exports` nor `root` — so `board.js` cannot call them, and #145 had to put the fact in `engine/pp.js` rather than copy it. That is CLAUDE.md's *"two files that both decide Choice Scarf is x1.5"* hazard, live. It is GUARDED rather than declared: `tests/test-pp-fact.js` plays real turns and asserts that the number MEDICHAM writes into its own `_pp` equals the number `pp.js` gives, across every maxpp tier in the format. **The ask is one edit in ENGINE's file** — have those five delegate to `engine/pp.js`, or export them and let `pp.js` become a thin adapter — so that one implementation remains. Two further items found while wiring. `board.js` writes `b._pp` BY NAME, which ought to be an engine-supplied setter rather than a string literal in a consumer. And `docs/_outbox/pp-and-moldbreaker-notes.md` states that `floor(base*0.8)+4` fits **500 of 500** rows: it fits **499**, because Struggle carries `noPPBoosts` and stays at 1/1 where the formula gives 4. Nothing downstream is wrong — the number is READ, never computed — but the claim would have to break before the artifact did | open — `docs/ENGINE.md` |
| #147 | **THE GROUNDED AXIS — ONE PREDICATE, SEVEN READERS, AND FIVE INPUTS STILL MISSING.** `isGrounded()` consults Iron Ball, Air Balloon, the Flying type **and Levitate** (`engine/medicham2-browser.js:1714` — an earlier note claiming Levitate was absent is RETRACTED, measured). **Gravity, Ingrain, Smack Down, Magnet Rise and Roost ARE ABSENT from it.** Seven mechanics read this predicate — Spikes, Toxic Spikes, Sticky Web and all four terrains — so one wrong answer is wrong seven ways. **Roost's temporary type removal IS NOT IMPLEMENTED** — nothing removes a type for a turn — so a Roosting Corviknight eats a full Earthquake here and takes zero in the real game. 2,808 clicks. Will: *"ROOST MAKES A MON GROUNDED, SAME WITH SMACK DOWN… ROOST ALSO CAUSES THE MON TO LOSE FLYING TYPE FOR THE TURN."* **This row is the register entry the 4.1.0 commit cited as "#145" and never created** — see #149 | open — `docs/ENGINE.md` |
| #148 | **A SIXTH GATE CLAUSE: NO OPEN, KNOWN, UNFIXED ENGINE DEFECT — SHIPPED 2026-08-10.** Will: *"THE GATE SHOULDNT BE OPEN, SO MANY OF THESE ITEMS ARE DISQUALIFYING FOR THE ENGINE TO WORK."* The first five clauses ask whether our two engines agree, whether Showdown disagreed about what bots happened to click, and whether something measured it; none asked whether we already KNOW a mechanic is broken, in a register the gate never read. That is "KNOWN FAILURE IS A BANNED PHRASE" one level up. The first version OVER-FIRED — it counted any row filed to `docs/ENGINE.md`, reported sixteen, of which four were not defects (including *"hand MEDICHAM to Fable 5"*) and three were finished the same night; it now tests the row's own CLAIM and errs SHUT on ambiguous wording. **This row is the register entry the 4.2.0 commit cited as "#146" and never created** — see #149. **AND THE DETECTOR MISSED #147 ON ITS FIRST WRITING, WHICH IS RECORDED RATHER THAN QUIETLY PATCHED.** #147 originally read *"Roost has no mechanism at all"* and *"still missing: Gravity, Ingrain…"* — both plainly a live defect, neither matching the clause's phrase list, so the gate counted 7 where the register held 8. It was reworded to the register's own vocabulary (`IS ABSENT`, `IS NOT IMPLEMENTED`) rather than the regex widened, because widening prose-matching only moves the boundary. **The clause errs SHUT on ambiguity and OPEN on unfamiliar phrasing, which is the wrong direction**, and a defect register whose enforcement depends on word choice is a structural weakness: the durable fix is a machine-readable severity field per row, not a better pattern. Filed here rather than as its own row because it is a property of this clause | closed 2026-08-10 |
| #149 | **TWO SHIPPED COMMITS CITE ROADMAP NUMBERS THAT WERE NEVER REGISTERED, AND A LATER AGENT REUSED THEM.** Commits `0a28580` (4.1.0) and `e7d672a` (4.2.0) name "ROADMAP #145" and "ROADMAP #146" in their messages and in `docs/MEDICHAM-SPRINT-NOTES.md`. **Neither number existed in §5** — HEAD's register stopped at #143. The SEARCH agent then correctly took #145 and #146 as the next free numbers for the PP work, so those two numbers now mean **two different things** depending on whether you read a commit message or the register. The findings are re-registered here as **#147** (grounded axis) and **#148** (sixth gate clause); the commit messages cannot be rewritten and are left alone, which is why this row exists. **`tests/test-roadmap-register.js` did not catch it and is not wrong to have missed it** — it checks that every item a DIVISION LEDGER schedules is named in §5, and these citations were in a commit message and the sprint notes, neither of which it reads. Widening it to those two sources is the fix; until then a number in a commit message is not a registered number | open — `docs/OPS.md` |
| #150 | **`status.js` STAMPS UTC WHILE EVERY DATED ARTIFACT USES LOCAL, SO ANY RUN AFTER 20:00 EDT IS DATED TOMORROW.** Measured 2026-08-10 20:43 EDT: `engine/medicham2-browser.js` has mtime `2026-08-10 20:41:29 -0400` and `docs/SEARCH.md`'s generated block renders it as `2026-08-11 00:40`. A CHANGELOG entry written in the same session was stamped `[4.4.0] — 2026-08-11` against a real date of the 10th and had to be corrected by hand. This is small and it is exactly the class this repository keeps paying for: **an artifact that looks newer than it is**, feeding a staleness comparison that then reads backwards. `engine/provenance.js` already had to stop comparing mtimes for this family of reason. Fix: one date function, local, called by everything that stamps — the FACTS ARE GLOBAL rule applied to the clock | open — `docs/OPS.md` |

### 5.6b Are there too many variables? — audited, and the answer is not the count

> **RETRACTED 2026-08-06 — EVERY MAGNITUDE BELOW IS FROM A FIT THAT PREDATES THE ENGINE.**
> `data/policy-weights.json` is stamped `2026-08-05T04:00:43Z`; commit `3be3f3b` at **16:47 the same
> day** rewrote `movesFirst` in `engine/board.js` (*"MAG stops re-deriving turn order"*) because the
> old path carried **no dynamic speed at all**. Nine further engine commits followed, including
> WIRES 123–132. `data/collinearity-joint.json` shares that provenance. **The SHAPE of the finding
> stands — a correlated block's individual weights are not readable — but no coefficient, correlation,
> firing rate or observation count here may be quoted until the refit.** Registered as **#78** (the
> feature-hash guard reports all 76 hashes unchanged across the commit that rewrote `movesFirst`, so
> it is blind and may not clear or block the refit) and **#79** (the 58 features were hand-written in
> four batches with no admission rule and no duplication check — reconsider the set WITH the
> post-differential refit, on Will's invitation).

76 weights on 81,515 joint turns is ~1,000 observations per parameter, and the fit is stable: handed
15,279 further turns it flipped **none** of them. The problem is not size.

`data/collinearity-joint.json` found the real shape: **8 of the 18 coordination features fire on
under 1% of decisions** — `boostsPartnerDamage`, `boostMayConvertKill`, `weatherSetupHelpsPartner`,
`healsPartner`, `redirectThenSetup`, `doubleKO`, `terrainSetupHelpsPartner`, `screenWhileThreatened`
— and three of the live ones are correlated enough that their individual weights are not
interpretable (`bothSameTarget`↔`overkill` r=0.53, `bothSameTarget`↔`focusFireKills` r=0.47).

Its own honest caveat, which must travel with the finding: *"Collinear coefficients can be
individually meaningless while the MODEL is well calibrated, because the correlated block still
carries the right total."* So this is not evidence the pair model predicts badly. It is evidence
about which single weights can be read, and about a third of the block that rarely does anything.

### 5.6c Self-play cannot find a shared blind spot

Kept in the register because it is the standing reason not to trust a head-to-head on its own.
CLAUDE.md: *"a head-to-head, an exploitability search and a prediction score all compare two bots
that **share the blind spot**, so a missing capability **cancels out exactly**."*

**Every bug found on 2026-08-06 would be invisible in self-play** — both sides had the weather
backwards, both believed the same 78 moves could not miss. And it is not theoretical: self-play
training measured **48.1% [46.5, 49.8]** over 9,728 paired games, an interval entirely below 50.
The guard that exists is MACHAMP's — every promoted champion plays **every** previous generation, not
only the one it displaced, which is the only thing that would detect a cycle.

### 5.7 Deferred by decision — not dropped

| # | item | why it is here |
|---|---|---|
| #52 | **HYPNO** — rates the opponent, sets how hard to exploit | Will, 2026-08-06: *"NAH LETS HOLD OFF ON HYPNO BUT I DONT WANT TO FORGET ABOUT IT."* Worth remembering that it is the **only model on the board whose inputs do not include MEDICHAM**, so it is never blocked by §5.1 and never needs re-running when the engine changes. |

### 5.8 The paper

| # | item |
|---|---|
| #54 | position against **THREE** comparables, because the field is not empty and none of them is playing our game. **VGC-Bench** (AAMAS 2026) — whose archive we already consume, and dropped from the fit for staleness (four days, mid-June, seven weeks old); `engine/corpus_shift.js` exists to measure the metagame distance and has never written an artifact. **Future Sight AI** — closed-source Showdown bot, reportedly top 5% of the most popular format, matches revealed attributes to the most common set, ships a win-probability browser extension; also settles a naming question, since "Future Sight" is TAKEN and this project names everything after Pokémon. **The PokeAgent Challenge** (arXiv 2603.15563, NeurIPS 2025, 100+ teams, two tracks) — by far the strongest reference of the three and **not yet read**. Add **Sarantinos** (arXiv 2212.13338, Cambridge) as the closest published method: Gen 7 Random Battles singles, peaked **33rd in the world**, regret-minimisation opponent prediction, fills unknown properties from usage statistics, and **explicitly rejects Monte Carlo sampling as too sample-inefficient** — which is what MILTANK's leaf does. It also names our #29 independently: its first "biggest challenge" is keeping the team balanced, with a worked example that is THE SACK, and it asserts *"an AI agent cannot achieve this just by looking ahead with MinMax or Monte Carlo Tree Search."* Finally, its ELO caveat is load-bearing for Will's stated goal: comparing human and AI ratings is invalid **unless they played each other** — laddering with ALAKAZAM is exactly that, so the plan is sound and should say why |
| — | the candidate contributions are the **truncation curve**, the **represented-clicks curve**, the **armed-coverage critique**, and the negative results — a separation gate that uniform noise passes, a tablebase killed by reach rate, and per-turn metrics that cannot separate a 1043 player from a 1600 |
| — | **PHASE 4, and it is a paper either way (3.59.0).** If §5.0's gate says compute buys nothing, the project adopts VGC-Bench's recipe — behaviour cloning plus PPO under self-play, fictitious play and double oracle — and reports that as the result. Will approved this branch in advance. Either way **the instrumentation is the honest contribution**: no project in `docs/PRIOR-ART.md` publishes a mechanics census that must be shown RED before it counts, a step-level protocol differential against the official engine, ratchets on silent failure, or a record of what it retracted. If search loses, this is still the only account of what a hand-written VGC simulator gets wrong and how you would know |

---

## The honest summary

**What is genuinely strong:** the data discipline, the validated engine, the measurement culture, and
the tooling that now enforces all three. The project's most valuable output to date is not a model —
it is the ability to tell which of its own results are real, which was demonstrated by dissolving
four of them in a single day.

**What is not:** every in-battle model. MAG is a competent starting position and a measurably
exploitable one. No model in this project has yet been shown to play VGC well against anything other
than a worse version of itself.

**The gap between those two paragraphs is the whole roadmap.**
