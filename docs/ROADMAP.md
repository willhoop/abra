# ABRA — roadmap

**2026-07-26**

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

### 2.3 Twenty-eight artifacts are unsafe to quote

Listed by `node engine/provenance.js`. Until regenerated, nothing downstream of them means anything.
**This is the blocker on everything in section 3.**

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

## 3. NEXT — in order, with the reason each is next

**1. Regenerate the 28 unsafe artifacts.** Nothing built on them can be trusted, so this precedes
everything. Mechanical, not clever.

**2. Finish the conformance burn-down.** 13 artifacts that do not say they are generated, 13 files
missing the header convention, one undeclared constant, one dead-code decision.

**3. Give MAG a damage calculation, and a KO check both ways.** The strongest evidence for this is
already in hand: the winning counter-policy raised "finish something hurt" from +0.34 to +2.75 — it
was straining toward a KO signal through the only crude proxy available. *Will this kill it* and
*will I be killed* are facts, and facts are free.

**4. Score both Pokémon together.** Measured prize: humans aim both attacks at the same foe 23.4% of
the time where independent choice gives ~50%, and MAG is at the 50% end. Follow Me is followed by a
partner attack 97% of the time and MAG cannot represent that at all.

**5. Switching.** Still a coin flip; 8.4 per game against a human 10.7.

**6. Branch scoring with a mixed strategy.** Enumerate the plausible turns, play each out in the real
engine, evaluate, and solve for a *mixture* rather than always taking the best. A deterministic
policy is exploitable by construction — that is measured, not theoretical. SLOWKING's regret
matching already does this mathematics at team preview; nobody has pointed it at a turn.

**7. Retrain PORY on clean data.** Branch scoring needs a position evaluator, and that is the job.
Until then the honest evaluator is counting what is alive and how healthy.

**8. Measure exploitability again, against the mixed-strategy version.** This is the test that says
whether the project has moved from *plays okay* onto the branch that can approach *solved*.

**9. External validation.** Our bots grading each other cannot establish competence. The two real
scoreboards are the Bo3 open-sheet ladder — where the hidden-information problem does not exist and
we already collect the games — and VGC-Bench's published agent results on that same format.

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
