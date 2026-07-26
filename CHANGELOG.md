# Changelog — ABRA

All notable changes to ABRA are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated.

---

## [3.7.1] — 2026-07-26

### The open-sheet corpus objection, measured instead of argued

Raised against 3.7.0: *open team sheet teams have different incentives than closed team sheet teams.*
Correct, and sharper than the caveat 3.7.0 recorded — that one said open-sheet players *hedge less*,
which is about play. The real point is that the **teams themselves** are built differently, because a
surprise set or a bluff item is worth nothing against someone who read your sheet before game one.
The corpus even ships with a warning saying so: *"Different information AND incentive regime … Do
not pool."* It was there and the fit used the corpus anyway.

**`engine/corpus_shift.js` (new)** measures it, applying the same code to both corpora so a
difference is the population and not the measurement. The objection is right, and large:

| | open-sheet | closed ladder |
|---|---|---|
| Garchomp on a team | 81.6% | 47.7% |
| Basculegion | 61.3% | 33.2% |
| Staraptor | 44.0% | 25.1% |
| Tyranitar | 7.4% | 21.2% |
| Sitrus Berry (share of items) | 8.4% | 17.5% |

**551.9 points of total absolute species difference across 109 species.** Not the same metagame.

But behaviour *given a board* — the only thing the policy learns — is nearly identical: super
effective 35.59% against 37.08%, resisted 15.06% against 15.04%, immune 1.00% against 0.97%, dead
moves 1.30% against 1.53%, status 33.89% against 34.09%, Protect 13.87% against 13.79%.

That split is what licenses the corpus. The model is **conditional** on the board and never learns
what to bring — MEW samples teams from the clean ladder store regardless — so the composition gap
changes which situations were sampled, not what was learned from them.

**Corrected rather than argued away.** `fit_policy.js` now re-estimates on a sample
importance-weighted to the closed-sheet species mix on **every run**, and reports whether the weights
move. They do not: largest change `deadStatus` by **0.222** on a weight of −1.374, with 47% of the
sample surviving reweighting (Kish effective sample size, reported so a correction that ate the
sample would be visible). If that ever stops holding, the run says so in words and the conclusion is
void.

### "Most games are bot games" — checked on this corpus specifically, and it is the cleaner one

`quality.js`'s bot detection was tuned on our own scrape, so running it over a corpus somebody else
assembled proves little by itself. `corpus_shift.js` applies the project's own **team-invariance**
signal to both, before and after filtering:

| corpus | accounts flagged | games touched | after filtering |
|---|---|---|---|
| open-sheet | 1 | 50 of 4,167 (1.2%) | 0 remain |
| closed ladder store | 7 | 1,980 of 14,878 (13.3%) | 0 remain |

The scraped open-sheet corpus is **less** bot-contaminated than our own ladder store, not more. But
the rule needs ≥50 games from one account to fire and only 6 of 2,149 open-sheet accounts play that
many, so this is a **floor on detection, not a clean bill of health** — the right phrase stays "no
bot detected", never "human".

### Move quality barely varies with rating, which is a finding about the metrics

Raised alongside: low-rated players make rule-ignorant plays — Prankster Taunt into Farigiraf, Fake
Out into Tsareena. Measured against the protocol on the clean closed store:

| rating | failed | immune | super effective | blocked action |
|---|---|---|---|---|
| under 1100 | 2.59% | 1.94% | 22.59% | 4.66% |
| 1100–1250 | 2.38% | 2.13% | 21.57% | 4.25% |
| 1250–1400 | 2.34% | 2.40% | 20.50% | 4.25% |
| 1400+ | 2.30% | 1.61% | 21.21% | 3.43% |

Blocked actions do fall with rating. Failed and immune moves are **flat**, and low-rated players hit
super effectively *slightly more often*. So the open-sheet corpus being ~185 rating points weaker is
less dangerous than it looks — but the sharper consequence is that **these realism metrics are not
skill metrics**. Matching a human failure rate makes the bot human-*like*, not good, and ALAKAZAM
eventually needs the second thing.

### A gap the feature set cannot represent, now named

The specific plays raised are real and present: **Armor Tail 52, Queenly Majesty 9** in the clean
closed store. **No feature in `board.js` can represent any of them** — `immune` is computed from
**types only**, so ability-based immunity (Levitate, Flash Fire, Storm Drain, Sap Sipper) and
priority-blocking abilities are invisible to the model. Recorded in `data/policy-weights.json` and
DEFENSE §6 as a known hole rather than fixed here; at ~0.2% of moves it is a small slice of the
remaining 3.87-point failed-move gap, and switching is the larger prize.

---

## [3.7.0] — 2026-07-26

### The scoring bot — a player that looks at the other side of the field

Backlog item 3, and the one everything else was waiting on. The behaviour clone answers a single
question — *what does this species usually click?* — and is blind to the board. That showed up as two
numbers no amount of prior-tuning could fix, and it made every `build_lab` result a measurement of
what beats **bad** play.

- **`engine/board.js` (new)** reconstructs the state a decision was made against, and turns
  (move, target) pairs into features. Every "this move cannot work right now" test reads a dex **data
  field** — `move.status`, `move.sideCondition`, `move.pseudoWeather`, `move.weather`,
  `move.stallingMove` — and compares it against tracked state. **No move is named anywhere in the
  file**, so a move added by a future regulation is handled without an edit (S13).
- **`engine/fit_policy.js` (new)** fits those features to what people actually clicked, by
  conditional logit over **2,240 clean open-sheet games and 48,538 decisions**.
- **`engine/score_policy.js` (new)** is the player. `engine/mew.js` gains `--policy score`.

**Why open team sheets.** A choice model needs the *choice set* — the moves that could have been
clicked. A normal replay only reveals moves that were **used**, so alternatives reconstructed from
revelation are biased by revelation itself. Open sheets publish all four moves of all six up front.
The caveat is recorded in the weight file: open-sheet play involves less hedging against unknown
sets, so the weights are learned on a slightly different game than the one they are played in.

**Held out by game** (decisions inside a game are correlated, so splitting by decision leaks):

| model | logL/decision | top-1 |
|---|---|---|
| uniform over candidates | −1.7627 | 24.1% |
| behaviour clone alone (the current bot) | −1.9302 | 27.1% |
| board-aware fit | **−1.6006** | **33.6%** |

In-sample −1.5997 against held-out −1.6006, so it is not memorising games; weights identical at 200,
300 and 500 iterations.

**Two findings worth stating on their own.** The behaviour clone alone scores **worse than picking
uniformly at random** (−1.93 against −1.76), and the fit puts only **+0.25** on it — it is saying the
clone is far too confident about the popular move. And the largest learned effects are not about
damage at all: they are the "this move is already dead" features, at −2.3 each. Reading the board
turns out to be mostly about **not clicking moves that cannot work**.

### Measured out of sample — 600 seed-matched battles per policy

The fit never consults the realism report; it is held back as the out-of-sample check, because it
stops being evidence the moment it becomes the objective.

| metric | prior (was) | score (now) | real |
|---|---|---|---|
| moves that were super effective | 9.71% | **14.91%** | 21.37% |
| moves that outright failed | 9.68% | **6.34%** | 2.47% |
| moves that hit an immune target | 4.30% | **2.92%** | 1.91% |
| moves that were Protect-type | 21.62% | **16.71%** | 13.87% |
| moves resisted | 14.78% | **9.92%** | 11.20% |
| turns per game | 11.57 | 10.70 | 8.35 |
| games containing a mega | 81.15% | 84.78% | 98.52% |
| usable games of 591 | 382 | **427** | — |

Both target gaps roughly halved. Immune moves and Protect spam fell without being targeted, and more
games survive the quality filter, so the games are less degenerate.

**Aiming is most of it.** `RandomPlayerAI` picks which foe to hit with `prng.random(2)` *before*
`chooseMove` is called, so the target was a coin flip no matter how good the move choice was — and in
doubles, aiming is most of what "super effective" means. 13,474 decisions in this batch chose a target.

**It samples, it does not take the best move.** A greedy bot sails past 23.4% super-effective and is
*less* human, not more. Same argument as DEFENSE §2: a corpus is closest to reality in distribution
when it is drawn from the distribution.

### Reported plainly: one metric moved the wrong way, and it is measurement

Distinct sets per species goes from 0.53 above real to **4.21 above**. This change does not touch set
generation at all, so the underlying diversity cannot have moved. The scoring bot uses more of its
moveset, so it **reveals** more: 2.00 moves per set against the prior policy's 1.90 and a real 1.70,
and distinct counts over partial views grow with revelation depth. This is exactly the confound
BACKLOG item 1 documents.

Switches per game barely moved (8.31 → 8.38 against a real 10.67) because the switch decision is
inherited untouched. Said because it is the next thing, not because this release quietly does it.

### Four silent failures found and fixed

- **Pokemon were being buried alive.** HP was tracked as cumulative damage and the store records no
  healing, so mons drifted to zero and left the field without ever fainting. **1,219 unmatched clicks
  were aimed at a foe the tracker had already retired.** Faints now come only from faint events.
- **Spread moves were scored as status moves.** Rock Slide, Heat Wave and Dazzling Gleam were treated
  as target-less, so their type effectiveness read as zero — a large share of all damage in doubles.
  Once corrected, `tgtHurt` flipped from −0.19 to **+0.31**: humans do finish weakened targets.
- **A locked two-turn move killed the battle.** The request omits `target` for a charging move, and
  defaulting the missing field to `normal` made the engine reject the choice outright.
- **MEW reported the new policy through the wrong counter**, printing "0.0% sampled" and "the policy
  sampled NOTHING — do not use this batch" over a run in which 100% of decisions were scored. A false
  alarm on that line is worse than none: it is the line that catches a genuinely dead policy. Team
  preview accounting also moved out of the prior-only branch, where it would have silently stopped
  being reported.

### `engine/selftest.js` grows a board-reading section

Six checks, all of failures that would otherwise look fine: the weight vector matching the feature
list it was fitted against (insert a feature without refitting and every later weight silently
applies to a different quantity), a refit that comes out worse than the policy it replaces, a damaged
Pokemon staying on the field, per-foe scoring, spread scoring, and a dead move expiring on its own
from the dex duration.

One of those checks was itself wrong on the first run: it asserted Rock Slide scores above zero
against Garchomp and Incineroar, whose effectiveness is −1 and +1 — an average of exactly zero. It
failed while the code was correct. Fixed by choosing two Rock-weak foes, and recorded here because it
is the same error class the file exists to catch: an expected value arrived at by assumption.

The clean-data check now recognises `quality.reasons()` as a genuine filter alongside `loadGames()` —
it is the entry point for a record judged on its own structure rather than by store id, and rejecting
it would have pushed a correctly-filtered file into declaring `RAW-STORE-OK`. Still RED on the same
**18** undeclared raw readers; that is the tracker, not a regression.

---

## [3.6.0] — 2026-07-26

### The build space is now derived from Smogon instead of typed by hand

`build_lab` split moves at a hand-written `LOCK_AT = 85`. That violated S12/S13 and was wrong in both
directions: it called Garchomp's Earthquake a free choice at 76.9% usage, and said nothing at all
about how much room was left once the four most common moves were fixed.

- **`engine/set_space.js` (new)** replaces the threshold with an identity. Smogon's move percentages
  are shares of sets and every set has four moves, so the listed percentages plus "Other" sum to 400.
  Therefore `freedom = (400 - sum of the top four) / 100` reads directly as *slots a real player
  changes*: Garchomp 0.71, Farigiraf 1.47, Kingambit 0.59. Across 259 species with 2,000+ teams the
  four most common moves account for **68% of every move slot played**.
- **Where a cutoff is genuinely needed there is an exact one.** Always-including a move that sits on
  a fraction `p` of sets matches reality on `p`; sampling it matches on `p² + (1-p)²`. The difference
  is `(2p-1)(1-p)`, so always-include wins **exactly when p > 1/2**. No tuning, no judgement.
- **The blind spot is now quantified and printed.** Smogon buckets rare moves as "Other" at 15–20%
  per species, so `1 - (1 - other/400)^4` ≈ **17% of real sets contain a move no prior of ours can
  propose** (median 17%, worst 19%; Kingambit 3%). This is a floor on set realism and had never been
  written down. Spreads are worse — Garchomp's spread "Other" is 38.4% against 19.8% for moves.

### `build_lab` runs a full factorial

One-factor-at-a-time cannot detect interactions, and factorial designs need fewer runs for the same
power. The design now crosses move-combinations × items × spreads.

**Confirmed on the first 240-battle smoke run:** Adamant beats Jolly by ~10 points **under Life Orb**
and does nothing **under Choice Scarf**. Neither sweep alone could have produced that sentence.

### Three bugs found by that run

- **`fillSet` ignored a caller-supplied spread** and re-sampled from the prior, so any experiment
  holding the spread fixed was not holding it fixed.
- **`build_lab` forwarded only moves/item/ability into `packTeam`**, dropping the spread entirely, so
  all three spread arms were the same team. The tell was win rates identical *to the decimal* across
  supposedly different arms — a genuinely varied factor cannot tie that exactly.
- **The results table never printed the spread**, which is how the above survived a full run looking
  like a tie rather than a defect.

### A previously reported cause was tested and disproven

BACKLOG item 1 claimed the set-diversity gap came from too thin a candidate pool. Measured: the
correlation between our pool size and the gap is **0.04** across 28 species — none. Every species has
~7.8 candidates, Rotom-Wash and Garchomp alike, and Rotom-Wash has no gap.

The measurable cause is **mode collapse**: we produce the single most common set **48%** of the time
against a real **44%**, concentrated exactly where the gap is — Toxapex +18 points, Whimsicott +15,
Garchomp +11, Kingambit **−2** (we are slightly *more* varied than reality).

### Documentation

- **`docs/METHODOLOGY.md` (new)** — every design choice with the literature behind it: common random
  numbers for paired comparison (Goldsman; Nelson & Matejcik 1995; Yang & Nelson 1991) including the
  negative-covariance failure mode; factorial versus OFAT (Czitrom; Box/Hunter/Hunter); self-play
  overfitting and league training (AlphaStar; Minimax Exploiter; NeurIPS 2023); Benjamini–Hochberg.

---

### Mega rate 74% -> 80%, and three ruled-out causes

The preview draw now knows about mega stones. `bring_priors.js` measures two numbers from real
protocol logs — **77.5%** of real sides mega at all, **57.7%** of megas are one of the two leads —
and `chooseTeamPreview` aims at both. On 300 seed-matched games with identical teams, only the
preview policy changed: **71.6% -> 80.1%** of games contain a mega, 0.96 -> 1.07 megas per game.

The species priors could not express this, because "Charizard" and "Charizard holding Charizardite Y"
are the same key and different decisions.

**The previously stated cause was wrong.** BACKLOG said "real players bring their mega". Smogon's raw
counts against real counts say a mega forme is brought **0.90x** as often as a non-mega. Ruled out by
measurement, not argument:

- **team generation** — 1.54 stones per packed team against the 1.58 Smogon implies; stones match
  their holder 99.6% of the time
- **the form-change probability** — 0.85 to 1.0 moved the rate 0.7 points. Now a `--mega` flag so the
  claim can be re-checked
- **Terastallization stealing the roll** — `RandomPlayerAI` checks tera before mega, but Champions has
  no tera at all: measured 0.00 per game

The cause was the **lead**, not the bring.

**Residual, unfixed:** 80% against 93%, 1.07 against 1.58 megas per game. Form-change 1.0 on top of
the fix gives 80.5%, so that is saturated. Most likely a back-slot holder still reaches the field less
often than a human's, consistent with 4.3 switches per game against 5.7 — downstream of the scoring bot.

---

### Adversarial review, and an engine selftest

`docs/REVIEW-2026-07-26.md` — two passes at v3.6.0, statistical and engineering, every finding
grounded in a measurement or a line of code. **Three of the defects it found were in the measurement
apparatus rather than the model**, and one of those reverses the project's top backlog item.

- **Set diversity is CLOSED — the gap never existed.** `realism_report` capped the generated corpus
  with `--limit` but read the real one in full, and distinct-counts grow with n mechanically. Compared
  at matched n across 76 shared species: **13.2 distinct sets per species for us against 11.3 real.**
  We are slightly *more* varied than the ladder. It had been reported as a defect three times.
- **`build_lab` compared each arm to a field mean containing that arm**, shrinking every effect by
  exactly `(m-1)/m` — 17% at m=6, 1.2% at m=84, so it hid in the small runs people iterate on.
- **The factorial took a nested prefix when subsampled**, freezing the move axis and confounding
  factors with loop position. Now stride-walked, coprime to the cell count.
- **`--conc` does nothing** — 14.9 / 14.4 / 14.3 games/sec at conc 1 / 4 / 12. The simulator is
  CPU-bound and single-threaded; the 46 games/sec figure is a 12-**process** number and no tool here
  fans out. `set_space` now prints both, so the top-14 factorial is honestly ~39 hours as shipped.

**`engine/selftest.js` (new)** — 17 assertions on the parts that fail silently, no Showdown checkout
needed. It found a bug on its first run: an unlisted forme resolved to nothing and produced an
**empty moveset**, so the Pokémon plays Struggle all game and nothing is raised. `forSpecies` and
`resolveSpecies` now strip trailing hyphenated qualifiers progressively — a rule that covers formes
nobody has thought of yet, replacing a hand-kept list that was itself an S13 violation and had
already failed three times.

**Known and NOT fixed:** every `build_lab` win rate is still conditioned on a pilot that does not read
the board (super-effective 10.8% against 23.3%, failed moves 8.6% against 2.7%, games 10.1 turns
against 6.3). That makes every current build result provisional, and it is why the scoring bot is
the top of the backlog. `build_lab` also tests one host team against 40 opponents without saying so.

---

## [3.5.0] — 2026-07-26

### The self-play corpus was not modelling this format

Four independent defects, none of which errored, combined to leave 199,524 self-play games with
essentially **no mega evolutions** — in a format where **93% of real ladder games contain one**.

- **The player was never told it could mega.** `RandomPlayerAI` defaults `mega` to 0 and
  `engine/mew.js` never passed the option. Now passed as a per-decision probability.
- **The teams had no stones.** `fillSet` consulted Smogon's *base-forme* item list first, which
  contains no stones at all. Our own parse of real Champions replays does. Our measurement now wins.
- **Every Tyranitar held a stone.** `gearPriors` kept only the mode, turning a choice into a species
  trait. The full distribution is kept and sampled.
- **Megas used base-forme moves.** Mega Dragonite is special, ordinary Dragonite is physical, and 26
  mega formes had their own priors sitting unused. Unrevealed slots now re-drawn from the mega forme.

Result: **54.7% of self-play games contain a mega**, from ~0%.

### Smogon's statistics adopted, after verifying the methodology

We had been deriving from ~1,700 clean replays what Smogon publishes from **1,163,315 battles**.
Before relying on it, the key claim was checked: does Smogon know a Pokémon held a mega stone even
when it died without revealing it? **Yes — verified three ways.**

- **Raw counts sum to exactly 12.00 per battle** (13,959,780 ÷ 1,163,315). A VGC battle has 12
  Pokémon across the two teams, so every team slot is counted, brought or not. The `Real` column is
  5.49 per battle — that one is appearances.
- **They publish EV spreads**, which are never revealed in battle and can only come from team data.
- **Base-forme Charizard's item list contains zero mega stones.** Reveal-derived data would show
  stone-holders that died in the base entry. None appear.

Now parsed and available: **mega formes as separate species** (`megaInfo()`), **Checks and
Counters** with 95% intervals, **full teammates** (was truncated to 10), **viability ceiling**.

Stone-holding rates, weighted usage, 2026-06 cutoff 1630: Charizard 99.3% (Y 96.1% / X 3.2%),
Swampert 98.0%, Metagross 96.0%, Raichu 88.3%, Staraptor 81.7%, Tyranitar 66.0%, Aerodactyl 58.3%,
Venusaur 55.5%.

**Retracted from earlier the same session:** the claim that Smogon's non-mega share was inflated by
Pokémon that carried a stone and died before using it. It is not — those are counted under the mega
forme. The base entries are genuinely stone-less builds.

### The bots do not know the type chart

Measured, bots vs humans: hit something **immune** 4.3% vs 2.2%; **super effective** 9.9% vs
**23.4%**; **outright failed** 10.3% vs 2.7%. Super-effective-to-immune ratio 2.3:1 against humans'
10.7:1 — one bot move in twenty-three does literally nothing.

### Also

- **Redundant protection moves.** Sets held both Protect and Detect (1.1% of protection users across
  40,000 games). Redundant families now capped at one member per set, in both draw paths; 0 of 4,800
  after.
- **Mega timing confirmed.** Of 16,631 mega events in real games, **zero** occurred on the mon's
  switch-in turn — switching is that turn's action. 1.88% of switch-ins faint before acting.
- **Seed base wrapped every 2.78 hours** (`Date.now() % 1e7`), regenerating identical battles under
  fresh ids. Fixed, plus a guard against the engine's 28-bit seed ceiling. Adjacent seeds were
  checked and are *not* correlated.
- **Site numbers generated, not typed** (S13): dataset counts, team count, matchups and turns-per-game
  now derive from `data/live.js`, each tile showing its own arithmetic. Turns-per-game had been
  computed over all 12,872 collected games beside a tile using clean games only — corrected to 8.3.
- **MEW's replay viewer replaced** with Pokémon Showdown's own player. MEW stores the exact Showdown
  protocol, so it reads our games with no conversion; the hand-written viewer is deleted.

### Superseded

The 199,524-game corpus is **obsolete** — every game was played with no megas, wrong items, and mega
Pokémon using base-forme moves. Mechanically valid, but not this format. Regenerate before analysis.

Full write-up: `docs/FINDINGS-2026-07-26.md`.

## [3.4.0] — 2026-07-25

### Fixed — six defects in MEW, every one found by testing the chain before the first large run

The self-play engine had been built, validated and benchmarked, and was about to generate a corpus.
Testing it end to end first — from team construction through to the file PORY actually reads — found
six faults. Four of them produce data that looks completely normal and is quietly wrong, which is the
only kind of bug that matters for a training corpus. Recorded in the order they would have done
damage.

**1. Four in five self-play teams were illegal.** `BattleStream` does not run the team validator; it
plays whatever it is handed. Showdown's own `TeamValidator` rejected **80.5% of the pool (161/200
teams)**. The dominant cause was Item Clause — VGC permits one of each item per team, the set sampler
drew items independently per species, and **66 teams carried two Focus Sashes**. Every such game was
played with a team no human could bring, and nothing anywhere reported a problem.

`packTeam` now enforces Item Clause during packing (resampling from the species' own measured item
distribution rather than blanking the item, which would have biased the corpus toward itemless
Pokemon), then validates and repairs, and MEW discards anything still invalid instead of recording
it. **100% valid**, at a measured 9.6% throughput cost — 4.30 ms/team with the validator cached, and
constructing it per call rather than once accounted for 6.5 ms of the original 7.7.

The hand-rolled learnset check written first was itself wrong — 40 false positives on cosmetic formes
(Sinistcha-Masterpiece does learn Matcha Gotcha). Asking the official validator is both correct and
less code. S12 applies to legality rules as much as to constants.

**2. Illegal abilities, 0.4% of packed sets.** Meowstic with Intimidate, Snorlax with No Guard,
Gardevoir with Good as Gold. Abilities were sampled from observed sets keyed by species name and
never checked against the species. Intimidate alone shifts every physical damage roll against that
side, so these silently corrupted the battles they appeared in. Now clamped to the species' legal set
and **reported in `filled`** — a silent correction would hide the ingest fault that produced it.

**3. Matchup coverage was 0.15%.** Both teams were drawn as linear functions of the same seed:

    const a = teams[(seed * 2654435761) % teams.length];
    const b = teams[(seed * 40503 + 17) % teams.length];

Two linear maps of one counter do not explore a 2-D space, they walk a 1-D lattice through it.
Measured over 1,000,000 sequential seeds on a 1,326-team pool: **1,325 distinct matchups of 879,801
possible, each replayed ~755 times**, and zero mirror matches despite a comment asserting they
occurred. Independent random draws would have reached 68%.

Matchups are now **enumerated** over the triangular index of unordered pairs, verified bijective at
T=5, 50 and 1,326 (879,801 pairs, every one exactly once, zero malformed). The walk order is
scrambled by a stride coprime to the total, so coverage stays exactly-once while any **prefix** of an
interrupted run remains spread across the whole pool rather than being one team's matchups.

**4. Team preview was a constant.** `RandomPlayerAI.chooseTeamPreview` returns the literal `'default'`
— bring slots 1-4, lead 1-2 — and `PriorPlayerAI` did not override it. Every game with a given team
therefore made the identical preview decision: **1 of C(6,4) x C(4,2) = 90 choices per side**,
forever. Team selection is a large share of VGC skill and it was a fixed constant.

It is now sampled from measured ladder behaviour (`engine/bring_priors.js`: P(brought | on team) and
P(lead | brought), shrunk by 10 pseudo-observations). Uniform sampling over all 90 was rejected
deliberately — most brings are ones no player would make, and the corpus would fill with positions
that never occur. The lead rankings have face validity: Grimmsnarl 84%, Talonflame 82%, Whimsicott
77%, which are the format's actual screens and Tailwind leads. `p_lead` is measured from turn-1 leads
and is unbiased; `p_bring` comes from REVEALED species and is biased down, so it is a ranking rather
than a calibrated rate.

A consequence worth stating plainly: the 40–92% spread in per-species bring rates reported earlier in
this session was **positional artifact of the constant `default` bring**, not preference. It is
retracted.

**5. Battles were not replayable.** `>start {seed}` seeds the battle's dice; it does nothing for the
players, whose PRNG defaulted to a fresh random seed, and two draws in the policy used
`Math.random()`. A recorded seed therefore reproduced the damage rolls but not the decisions, and the
game diverged at the first choice. Any claim of the form "this switch is what won the game" was
unfalsifiable. Both players are now seeded from the battle seed via `PRNG.get`, and every sampling
draw uses the player's own PRNG. **Verified: 25/25 games byte-identical across separate runs** once
the `|t:|` wall-clock line is excluded.

**6. Writes were not durable, and the claim that they were is retracted.** The record and log streams
were `createWriteStream(..., {flags:'a'})`, described in a comment as keeping everything already
flushed if a run were killed. That was false. Observed directly: during a 12-worker run **every shard
sat at exactly 0 bytes for fifteen minutes** while each worker held ~500 MB resident. Records are
~5 KB, workers out-produce the disk, and Node answers backpressure by queueing in memory — nothing
reaches disk until the stream closes at process exit.

Three consequences: a killed worker lost **all** of its games rather than the last few; memory grew
in proportion to games generated (~170 MB queued per worker at 16,667 games); and progress was
invisible, which is how a **healthy 200,000-game run was mistaken for a hung one and killed at 15
minutes**, when each worker needed ~1.7 hours. Batched `appendFileSync` (50 records) bounds memory
and lands data continuously — verified at 7 MB / 21 MB / 31 MB on disk at t=20/40/60s of a live run.

### Fixed — the JS/Python parity test was verifying nothing

`tests/test-quality.js` probed `python3`, `python`, `py -3` and skipped with exit 2 when none worked.
On Windows all three resolve to the **Microsoft Store alias stub**, which prints "Python was not
found" and exits 9009 — while a working Python 3.12.10 sits in `%LOCALAPPDATA%\Programs\Python`. The
test that guarantees the two quality filters select identical games had therefore been skipping on
the development machine, reporting success while checking nothing.

`engine/python.js` (new) resolves a real interpreter by **executing** each candidate and requiring it
to echo a token — a name resolving on PATH proves nothing — and additionally searches the standard
install roots. The probe had been duplicated in `server.js` and the test and had drifted; it is now
one reader (S12). The parity check now runs: **27 passed**.

### Added

- `engine/bring_priors.js` — measured bring/lead propensities from clean ladder games.
- `engine/state_encoder.py` — a rich per-turn state encoding (121 features): HP per slot, active vs
  benched, status, boosts, weather/terrain/Trick Room/Tailwind/screens, hazards, active types. Both
  perspectives are emitted with sides swapped, because antisymmetry in the two players is a property
  of the game and a model trained on p1's view alone will not respect it.
- `engine/pory_nn.py` — the network-versus-baselines comparison, eight arms on one split.
- `engine/python.js`, `build/serve.js`.

### Changed

- `engine/mew_farm.js` — **`--conc` now defaults to 1, not 4.** The prior default cost 4x. Measured on
  8 physical / 16 logical cores: 8 procs at conc 4 gave 11 games/sec, the same 8 procs at conc 1 gave
  38. The simulator is synchronous and CPU-bound, so in-process concurrency never overlaps real work —
  it holds N battles live at once and multiplies GC pressure. 12 procs / conc 1 reproduced at 44–46.
  Two earlier throughput figures in this file are retracted: a projection of 131 games/sec
  (extrapolated from one process, never measured) and a claim that scaling collapses past 4 processes
  (measured, but every row carried the bad `--conc`, so a config artifact was written up as a hardware
  limit). Run-to-run variance is large — 8/conc-1 measured 37.8 and 15.1 on identical config — so
  single microbenchmarks here are worth ±2x.
- `engine/mew_farm.js` — merges the raw-log shards. It previously deleted the entire shard directory
  at merge, **destroying every protocol log a distributed run produced** at the moment it succeeded.
  Single-process runs kept them; the farm silently did not.
- `engine/mew.js` — writes a `.raw-logs.jsonl` sidecar in the ladder's own `{id, uploadtime, log}`
  schema. MEW captured the full omniscient log, passed it to `extract()`, and discarded it; but
  `extract()` produces game-level summaries and every value model reconstructs board states from the
  **protocol log**. A million games in the old format would have been unreadable by the model they
  exist to train.

---

## [3.3.0] — 2026-07-25

### Added — Smogon's official statistics, archived monthly, and what they immediately corrected

ABRA's ladder collection began 2026-07-22. Reg M-B started mid-June, so five weeks of the regulation
are missing and are **not recoverable**: Showdown's replay search exposes only a recent window, and
although an old replay still resolves by id, the ids are not discoverable — an archived sample of 324
Reg M-B games spans 1.9M sequential ids, because Showdown numbers across every format at once. Data
not captured at the time is gone.

Smogon has been computing statistics over the **whole ladder** throughout and publishes them monthly.
`engine/fetch_smogon_stats.js` archives them and `.github/workflows/smogon-stats.yml` runs it on the
4th and 11th of each month — in CI rather than on a machine, because a cron in the cloud cannot be
forgotten and the files stop being retrievable if nobody takes them. June 2026 backfilled: 16 files,
5.4 MB, both Reg M-B formats at cutoffs 0/1500/1630/1760.

**Cutoffs are weightings, not subsets.** All four files report the same 1,163,315 battles; the cutoff
changes how heavily strong play is weighted. "1760" never means "only 1760+ players".

#### Every Pokémon had a flat SP spread. That was wrong in every damage figure.

`champions_sim.js` gave every Pokémon `11/11/11/11/11/11` and nature Hardy, justified as "spread
evenly when unknown rather than maximising, because maximising would systematically overstate every
unknown Pokemon". The caution was right and the result was still badly wrong.

Real Garchomp runs **Jolly 2/32/0/0/0/32 on 42% of sets**. Since `stat = base + SP + 20`, that is
Attack **182** against the flat assumption's **161** — the format's most-used attacker understated by
**13%**, in every damage number the project has produced and in every MEW battle generated.

Flat spreads also erase the format's shape: **92% of real spreads touch the 32-per-stat cap**, so a
flat one invents a jack-of-all-trades that exists nowhere on the ladder.

`engine/smogon_priors.js` parses the moveset files into per-species spreads, items, abilities, moves
and teammates — 283 species. `set_priors.js` now samples a real spread proportional to how often it
is run, and prefers Smogon's **P(move is ON the set)** over our `move-priors.json` **P(move | action)**,
which is a different quantity: a move clicked rarely can still sit on most sets. Smogon's percentages
sum to ~400% precisely because every Pokémon carries four.

**Two mechanics confirmed against an independent source.** The SP budget is 66 and 97% of real
spreads spend all of it. And SP is capped at **32 per stat** — an early version asserted "sums to 66"
and flagged 100 spreads including `Jolly:32/0/0/0/0/32`, which sums to 64. Those were not malformed;
a two-stat spread cannot spend more, however much budget remains. Both invariants are now asserted.

### Fixed — open team sheets were parsed and then discarded

CHANGELOG 3.0.0 claimed "open team sheets are now parsed … the entire hidden-information problem
removed". The parsing landed; the **use** of it never did. `extract()` built its output only from what
play revealed and never merged the `sheets` it had just captured, so an open-sheet game came out
exactly as blind as a closed-sheet one. ARCHITECTURE fault 1.4 again — a fix applied to the wrong
artifact and reported as done.

Caught by importing an archived OTS corpus and noticing impossible numbers:

| | moves/4 | no item | no ability |
|---|---|---|---|
| closed-sheet ladder | 1.38 | 69.7% | 75.5% |
| OTS **before** fix | 1.50 | 69.7% | 73.8% |
| OTS **after** fix | **4.30** | **0.4%** | **10.1%** |

52,964 sets, 86% declared complete. The 1,624 Bo3 games already in the store have been blind this
whole time and will come back complete on the next reparse.

### Added — two metagames, published separately

`meta-usage.json` used to publish one distribution and call it "the metagame". There are two.

- **competitive** (filtered): what humans choose when trying. Correct for tournament preparation, for
  any claim *about the game*, and for anything an agent should imitate.
- **ladder** (everything): what you actually face. **6,297 of 8,356 stored games involve a bot —
  three in four opponents.** Filtering them out optimises for a metagame the user meets one game in
  four.

The top six differ, and informatively:

```
competitive   garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder        garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

Charizard is 25.7% on the ladder view and outside the competitive top six — it is a bot-team member,
correctly surfacing as something you will meet.

The ladder view is not merely "unfiltered". Bots are the **most predictable opponent in the format**:
one account played 459 games with a single team, four ran the same six in 1,446. "23% of your
opponents will bring precisely these six" is more actionable than any distribution, because it is
certain rather than probabilistic.

And there is a genuine grey area, which is why both ship rather than one being chosen: **humans copy
strong bot teams to practise against**, so a bot team can re-enter the competitive metagame as a
legitimate archetype. Neither view alone is the truth. Consumers must state which they used.

### Notes — what the archives could and could not settle

- **Uploaded replays are broadly representative.** Comparing our uploaded Bo3 games against Smogon's
  whole-ladder Bo3 file for the same month and format: mean absolute difference **1.84 points** over
  the top 20 non-mega species, Spearman **0.733** across 202. Only 3.2% of battles are uploaded, but
  what is uploaded looks like the ladder. Mega formes appear to differ wildly only because Smogon
  counts the mega as its own species while our extractor collapses megas to base forme.
- **Our bot filter is far more aggressive than anyone else's.** Smogon does not filter bots at all
  (it weights by rating); VGC-Bench filters for open sheets only. Ours removes ~75% of the store.
  Consequence: **our filtered numbers are not directly comparable to theirs.**
- **The store is 8,757 unique games, 0 duplicates**, after a night of pushes, rebases and CI commits.
  The `merge=union` removal is holding.

---

## [3.2.0] — 2026-07-25

### Changed — five engines now read through the quality filter, and one headline result did not survive

`war.py`, `roles.py`, `nmf_roles.py`, `vocab.py` and `counterplay.py` each carried an identical
`load_games()` that opened the store directly. They now read through `engine/quality.py`, which reads
the single definition in `data/quality-filter.json`. No threshold is duplicated in any of them.
`ABRA_UNFILTERED=1` restores the old behaviour, for demonstrating the difference only — the same
switch `analyze.js` already had.

Each engine was run **both ways on the same store**, so the difference below is the filter alone and
not the reparse.

#### WAR no longer beats a coin. The prior conclusion is withdrawn.

| | held-out log-loss | vs coin 0.6931 | accuracy |
|---|---|---|---|
| unfiltered (as previously published) | **0.6860** | beats it | 0.539 |
| clean, 1,061 games | **0.7048** | **worse than a coin** | 0.502 |

This is the finding of the release and it is a negative one. WAR was described in the white paper,
`MODELS.md`, `ROLE-FAMILY.md`, `SUMMARY.md` and `PUBLICATION.md` as the model that *did* clear the
bar — "which specific species you bring at preview carries a small real signal that roles and raw
sheets do not". **On games with no bot detected, it does not.**

The mechanism is visible in the coefficients. Basculegion's WAR falls from **281.87 to 23.64**, and
Basculegion is one of the six Pokemon that four undetected bot accounts played in 1,446 identical
games. A ridge RAPM fitted on that data is not learning which species win; it is learning which
species belong to the account that played the most games. Charizard, also on that team, is the
largest negative in both runs — the same artifact with the sign reversed.

Accuracy of **0.502** is the plainest statement of it: on clean data the species model is a coin.

This does not touch PORY (0.567 vs 0.693), which is measured mid-game rather than at preview and is
unaffected by this change.

#### COUNTERPLAY got stronger, and that is also informative

| | tech-vs-standard coverage gap | 95% CI | species positive |
|---|---|---|---|
| unfiltered | +0.0321 | (0.0078, 0.0561) | 72/124 (58%) |
| clean | **+0.0707** | **(0.0252, 0.1179)** | 36/55 (65%) |

More than double, with the interval further from zero. This is the expected direction once the
mechanism is stated: the claim is about **human** choices — that players spend spare move slots
answering the metagame — and a bot never re-teches. Bot games were not noise here, they were
counter-evidence, and removing them sharpened the effect rather than shrinking it.

The top-threat list also corrects to the post-filter metagame:
`garchomp, incineroar, kingambit, sinistcha, basculegion, whimsicott`.

#### ROLES is unchanged in conclusion, corrected in magnitude

Preview roles still tie a coin — held-out log-loss **0.6915** vs 0.6931, CI (0.6783, 0.7049), which
contains the coin. That conclusion has never moved and does not move now.

The **role-pair median cell is 20**, across 1,051 cells. For the record of a number that has been
wrong in three documents for two versions:

| figure | where it came from | status |
|---|---|---|
| n = 7,971 | v2.6.0, over-tagged (19.6 of 26 roles per team) | retracted in 2.7.0, **still printed in the white paper, ROLE-FAMILY.md and PUBLICATION.md** |
| n ≈ 95 | 2.7.0, credible tags, 27 roles | superseded |
| n ≈ 50 | 2.8.0, 39 roles | superseded |
| **n = 20** | **this release: 52 roles, 1,061 clean games** | current |

The direction is the honest story: every step that made the taxonomy more precise, and now the games
cleaner, has cost cell size. n=20 is still above the single-label archetype cells (11–18) that
motivated the role model, but the pooling argument is far weaker than 7,971 ever suggested.

#### VOCAB and NMF

VOCAB: 1,061 games, 26,677 move events, 380 distinct moves; curated roles cover **97.3%** of real
in-battle move usage. NMF still factorises cleanly. Neither makes a claim that turns on the filter.

### Notes — why this was the right thing to do before any model work

The project's own build order (`docs/ALAKAZAM-v2-spec.md`) is inputs first, capstone last. The store
and the rules engine were secured earlier today; the filter was the third input and the only one
still broken. Wiring it first meant WAR's result was retracted **before** anything was built on top
of it, rather than after.

**28 engines still read the store raw.** These five were done first because they share an identical
`load_games()`, so one patch reached all five.

---

## [3.1.2] — 2026-07-24

### Fixed — the store duplication was `merge=union`, not `merge -X ours`

The diagnosis carried in `docs/HANDOFF-2026-07-24.md` and `docs/PROJECT-HANDOFF.md` named
`git merge -X ours` as the confirmed cause of the store duplicating three times. That is wrong, and
acting on it would not have stopped a fourth occurrence.

`.gitattributes` carried `data/games.ladder.jsonl merge=union` (and a catch-all `*.jsonl
merge=union`), added to stop the ingest Action's merge conflicts, with the note "readers dedupe by
id, so duplicate lines are harmless".

`merge=union` resolves a conflicting hunk by concatenating **both** sides in full. On an append-only
log every divergent reconciliation replays the entire appended block, doubling it. The decisive
point the old diagnosis missed: **the union driver applies to `git rebase` as well as `git merge`.**
Rewriting `push-all.bat` to use `--rebase` (shipped in 3.1.1) therefore did not remove the mechanism;
it only changed which command triggered it.

The merge driver has been removed. Divergent appends now produce a real conflict and the
reconciliation stops, which is what `push-all.bat` already expects. Resolution procedure is recorded
in `.gitattributes` itself.

The second half of the old note was also wrong: duplicates are not harmless. They break the S7
store-shape assertions and they corrupt every game count published by the site and the white paper.

### Repaired — store deduplicated, rebase completed

The repository was not in the state the handoff described. It was not a plain detached HEAD: an
interactive rebase was stopped 43 commits into 45. The documented repair (`git checkout main`) would
have abandoned those 43 replayed commits, and because `main` had diverged from `origin/main` by two
`ingest:` commits, the subsequent push would have been rejected as non-fast-forward — the exact point
at which a reconciliation strategy gets reached for. The rebase was completed instead; it finished
clean, with no conflicts.

`engine/dedupe_store.py --write` then took `data/games.ladder.jsonl` from 16,139 lines to **8,000
unique**, 0 duplicates, 0 unparseable, and a second run is a no-op. The store is 8,000 rather than
the 7,547 the handoff predicted because the two `ingest:` commits already on `origin/main` added
games after that document was written.

### Known issue — `sanity_check.py` reports 96 assertions, 94 passed, 2 failed

Reported plainly rather than worked around. Both failures are S7 store-shape:

    FAIL  store shape: every `brought` is a subset of `six`  (1,006 bad of 8,000 games)
    FAIL  store shape: nobody brings more than four
          ({0: 180, 2: 1001, 3: 1929, 4: 12022, 5: 845, 6: 23} over 16,000 player-sides)

These are **not** introduced by the deduplication, and not introduced by keeping the first of each
duplicated id. Evidence: the deduplicated store is byte-identical to the one already on
`origin/main`, and the same check run against the pre-incident merge base `4a5b455` is far worse —
11,239 bad player-sides, with 9,364 sides showing five brought and 3 showing seven. The current
figures are an improvement on the pre-incident store, not a regression from it.

**Cause established — battle forme changes are appended to `brought`.** Of the 1,033 offending
entries, **1,003 contain `mega`**; the remaining 30 are `palafinhero` (18), `aegislashblade` (7),
`mimikyubusted` (4) and `morpekohangry` (1). Zoroark accounts for **zero**. Every case is the same
mechanism: a forme change during battle is recorded as an additional species in `brought`, while
`six` carries the base forme, so the side shows five or six brought and the forme name is not a
member of `six`.

This is `docs/ARCHITECTURE.md` fault 1.5 recurring. That fault was recorded when the mega double
count collapsed CHOMP-EV's eval set from ~1,200 games to 43, and §5 of the same document still lists
"`brought` is still 5 in ~115 games and 0 in 176; not yet explained" as an open gap. It is now
explained, and it has grown from ~115 sides to 845 at five and 23 at six.

The fix belongs in `engine/durable-ingest.js` — a forme change must update the identity of an
existing `brought` entry rather than append a new one — followed by a `MODE=reparse`, which the raw
archive makes free. Not done in this pass.

An earlier version of this entry named Zoroark's Illusion as the likely cause. That was a guess and
it is wrong; the measurement above replaces it.

---

## [3.1.1] — 2026-07-24

### Fixed — the metagame model was literally the bot's team
`engine/analyze.js`, which writes `data/meta-usage.json` (the file CHOMP reads to make
recommendations), read the store directly and filtered only on the per-player `bot` NAME flag. It now
goes through the shared quality filter.

The old top six by team usage was:

    garchomp, whimsicott, basculegion, kingambit, charizard, sylveon

That is, exactly and in full, the six Pokemon on the team four undetected bot accounts played in
1,446 identical games. The recommender's picture of the metagame WAS one bot's team.

Corrected top six: `garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion`.

| species | was | now | change |
|---|---|---|---|
| whimsicott | 31.5% | 17.9% | -13.6 |
| basculegion | 30.5% | 17.8% | -12.6 |
| charizard | 29.1% | 16.5% | -12.6 |
| sylveon | 22.8% | 10.5% | -12.3 |
| garchomp | 34.2% | 24.4% | -9.7 |
| kingambit | 30.0% | 20.4% | -9.5 |
| incineroar | 21.0% | 23.5% | +2.5 |

Sampled team-slots drop from 9,594 to 1,854. Incineroar and Sinistcha - genuine top-tier picks that
the bot did not use - were being pushed down the list by it.

### Added
- `data/meta-usage.json` now carries its own **provenance block**: source, filter, the full funnel,
  and the caveat that bot detection is a floor rather than a proof. A consumer can now tell what a
  number is a statistic about.
- `ABRA_UNFILTERED=1` recomputes over everything, for demonstrating the difference only.

### Notes
36 other engines still read the store directly. This one was done first because it is the only one
whose output is consumed by another product.

---

## [3.1.0] — 2026-07-24

### Added — the official Champions engine
Showdown's `champions` mod exists in the master branch and implements this format exactly.
`engine/champions_sim.js` runs it on `gen9championsvgc2026regmb` — the format id on every replay in
the store — at pinned commit `20ad99ff`. `engine/prior_player.js` ports our behaviour-clone policy
into it so the two engines can be compared like for like.

- `data/quality-filter.json` v1.1 — behavioural bot detection by **team invariance**. Five accounts
  the name filter missed (459 / 426 / 294 / 267 / 147 games, **one team each**) were in 52.2% of the
  previously-clean set. Clean games: 1,941 -> **927 of 7,547 (12.3%)**.
- `engine/quality.js` and `engine/quality.py` — one shared definition, cross-checked by a test that
  asserts both readers select an identical set of game ids.
- `engine/dedupe_store.py`, `build/build_browser_data.js`, `tests/test-rollout-effects.js` (39),
  `tests/test-quality.js` (24), `docs/ADR-001-use-the-champions-mod.md`.

### Fixed — the rollout engine was wrong in eight ways, all silent
Random status instead of the move's status; only Fake Out could flinch; no type or ability
immunities; priority a hand-typed table of 18 moves (all 14 negative-priority moves resolved at 0, so
Trick Room went at normal speed); flinch leaked into the next turn; **Intimidate applied
unconditionally with the sign reversed on Defiant and Competitive**; no powder immunity; Prankster hit
Dark types. Measured effect on 120 real matchups: mean **4.35** points of P(win), max 24.2, favourite
flipped in 9.2%.

Also: the nature table held 23 of 25 (Naughty and Lax fell through to neutral), and the store's
duplicate check read only the first 5,000 lines while all 401 duplicates sat past line 7,144.

### Notes — what the validation actually showed
With identical teams, an identical policy, and both engines verified symmetric on mirror matchups,
our engine and the official simulator disagree by **31.1 percentage points on average**, flipping the
favourite in 3 of 8 matchups. Everything we fixed today was worth 4.35 points. The remaining gap is
seven times larger. This is why ADR-001 replaces the engine rather than continuing to repair it.

Three earlier versions of that comparison were wrong (32.2, 23.7, and a 32.2 where the policy port
silently fell through to random on 100% of decisions). All three are recorded in the ADR rather than
quietly re-run.

### Notes — measured, not asserted
Three Champions status constants had lived as unsourced inline comments. Checked against the mod's
`conditions.ts`: paralysis `randomChance(1, 8)` = 12.5%, sleep `sample([2, 3, 3])`, freeze
`randomChance(1, 4)` with `startTime = 3`. All three correct, and all three now cited. Independently
measured from 7,948 raw logs: 13.8% [11.9, 16.0], 35.3% [31.5, 39.2], 31.6% [23.3, 41.4].

The stat formula is confirmed from `scripts.ts`: `base + SP + 20`, and HP `base + SP + 75`.

### Notes — the meta model was reporting a bot's team
Four of the five undetected bot accounts played the **same six Pokémon** in 1,446 games. Those six are
exactly the species whose usage collapses once they are removed: Basculegion 34.1% -> 17.9%,
Whimsicott 31.9% -> 17.9%, Garchomp 35.5% -> 24.4%, Charizard 26.1% -> 16.5%, Sylveon 19.4% -> 10.5%,
Kingambit 29.1% -> 20.4%. `meta-usage.json`, which CHOMP reads, carries the inflated figures.
**37 engines still read the store directly and bypass the quality filter.** Not yet fixed.

---

## [3.0.2] — 2026-07-24

### Fixed — a store check that was aimed away from the fault
`sanity_check.py` reported "no duplicate ids" while the store held **401 duplicates**. It read only
the first 5,000 lines; the duplicates all sat past line 7,144. Duplicates enter an append-only log at
the **end**, which is exactly the region a head-sample cannot see, so the check passed 95/95 on a
store that was 5% duplicated. The duplicate scan now shares the existing full-file pass.

- Store deduplicated: **7,948 -> 7,547 unique games.**
- `engine/dedupe_store.py` is new: idempotent, order-preserving, atomic rewrite.

### Notes — where the duplicates come from
Not from the ingest. `durable-ingest.js` reads every stored id before appending and refuses repeats.
They come from **git**: an append-only file reconciled by a non-fast-forward merge replays the
appended block. This happened once before (7,040 duplicates from `merge -X ours`). Because the cause
is outside the ingest, a one-off cleanup cannot hold, which is why the fix is a re-runnable script
plus a check that actually looks at the whole file.

Counts computed before this pass were inflated by ~5%, and duplicated rows narrow confidence
intervals without adding information. Models have not yet been re-run on the deduplicated store.

### Notes — the rollout engine is NOT to standard (found, not yet fixed)
Two defects in `engine/medicham2-browser.js`, recorded here rather than silently carried:
- **Status moves apply a uniformly random status.** Line 205 picks from `['brn','par','slp']` at
  random, so Thunder Wave burns a third of the time and Will-O-Wisp can paralyse.
- **Only Fake Out can flinch.** Rock Slide's 30% flinch does nothing in simulation.
The shared rulebook (`data/move-effects.json`, 954 moves, 211 with a secondary, 33 flinch) exists and
is tested, but the rollout does not read it — a second, worse rulebook that fault 1.1 predicted.

---

## [3.0.1] — 2026-07-24

### Fixed — two of the twenty-five natures were missing
`CHOMP/engine/champ-model.js` held 23 natures. **Naughty** (+Atk / -SpD) and **Lax** (+Def / -SpD)
were absent from the table, and an absent nature falls through to the neutral multiplier. Those sets
therefore computed with 1.0 where the game applies 1.1 and 0.9 — a Naughty Kingambit read 187 Attack
instead of 205. Both are now present and verified against the Champions calculator.

### Added
- **S10 — enumerate the domain, do not spot-check it.** Where a rule has a closed, known domain the
  test walks every member and asserts the expected behaviour, plus a count assertion that the
  reference list is complete.
- `tests/test-mega-and-boosts.js` now iterates **all 25 natures** and asserts the *direction* of
  change for all five stats against a neutral baseline, and pins the Champions stat formula
  (`stat = (base + 20 + SP) x nature`, `HP = base + 75 + SP`). 24 -> 28 assertions.

### Notes
- The earlier nature check reported "unexpected multipliers: none" and was **wrong to be reassuring**.
  It asked whether any nature produced a multiplier outside {0.9, 1.0, 1.1}; a missing nature produces
  1.0, which is inside that set. A missing row and a legitimately neutral row are indistinguishable by
  count, which is exactly why S10 asserts direction instead.
- `docs/ARCHITECTURE.md` -> v1.1: fault 1.9 and standard S10 recorded.

---

## [3.0.0] — 2026-07-24

### Architecture — the plumbing, reviewed and standardised
`docs/ARCHITECTURE.md` is new: a blunt review of the whole system, ten engineering standards drawn
from it, and the check that enforces each. Every fault named there is one this project actually
shipped. The pattern behind all of them was singular: **knowledge with more than one home, and no
mechanism that noticed when the homes disagreed.**

### Fixed — faults found by the review
- **Three implementations of the same rules** (canonical engine, browser rollout, embedded site
  copy). When the canonical engine learned real mega base stats the rollout was left behind and the
  two disagreed by **30%** on Charizard-Mega-Y's Special Attack, silently. Fowler's Rule of Three
  says the third duplication is the moment to act; we were past it.
- **`data/engine-data.js` stored only DERIVED values** (level-50 stat lines, no base stats). Data
  that cannot be recomputed can only be copied — which is exactly why the browser engine could not
  follow the forme fix. It is now generated by `build/build_engine_data.js` and carries base stats.
- **A mega dex merged into the wrong artifact.** 67 formes were added to `engine-data.js` and
  reported as "in the engine dex"; the damage engine reads a different file entirely, so the fix
  reached nothing. The claim was made in good faith and was false.
- **Two hand-maintained mega-ability tables** from different sources (Showdown and Serebii). They
  agreed by luck. Now one generated file, `data/mega-formes.json`, read by both.
- **Identifiers were not normalised across boundaries** (`"sand stream"` vs `"sandstream"`).

### Added
- **`CHOMP/tests/test-engine-contract.js`** — a consumer-driven contract test (the Pact pattern):
  an executable statement of what every implementation must agree on. It caught the mega drift on
  its first run. 20 assertions.
- **`CHOMP/data/move-effects.json`** — one secondary-effect rulebook generated from Showdown's
  `moves.json`: 954 moves, 211 with a secondary effect, 33 that can flinch, with accuracy, status
  chances and stat drops. Two rules that are easy to get wrong are stated once and tested:
  **a flinch only lands if the user moves first** and expires at end of turn; **a status cannot
  apply to a Pokémon that already has one**, and type immunities hold (Scald cannot burn a Fire
  type — verified at 0%).
- **Store-shape invariants** in `sanity_check.py` (S7): `brought ⊆ six`, `lead ⊆ brought`, winner is
  a player, every field present, nobody brings more than four. A parser change that breaks the store
  now fails immediately — the mega double-count silently collapsed CHOMP-EV's eval set from ~1,200
  games to **43** before anything noticed.
- **Open team sheets are now parsed.** `|showteam|` declares every Pokémon's item, ability, all four
  moves and nature — the entire hidden-information problem removed. We were detecting these lines
  only to set a flag and discarding the sets. 1,624 Bo3 games are affected; that data now accumulates.
- **Forfeit flag** captured at parse time (1,911 of 7,948 games, 24%), so quality filters no longer
  need the raw archive.

### Changed
- Mega formes: all **95 stones** now carry real base stats, typing and ability. Pre-mega state is
  explicit and overridable (`premega: true`) — holding the stone is not the same as having used it.
- Stat stages (±6) are supported for attacker and defender, with the full crit rule pinned: a crit
  **ignores** the attacker's drops and the defender's boosts, and **keeps** the attacker's boosts and
  the defender's drops. Only the first of those four was previously asserted.

### Notes
- The Champions stat formula simplifies exactly: **normal stat = (base + 20 + SP) × nature**, and
  **HP = base + 75 + SP**, for every base value 1–255. SP budget is 66.
- Largest remaining gap, stated plainly: the canonical engine's dex is still scraped from an HTML
  file and parsed with `eval()`. That is the reason the wrong-artifact fault was possible, and it is
  the top of the remaining list in `ARCHITECTURE.md` §5.

## [2.10.1] — 2026-07-24

### Changed — every model re-run on the deduplicated store
All reports were still computed on the 14,361-line store that turned out to be ~half duplicates.
Re-run on the 7,315 unique games. What survived, and what did not:

| Model | On clean data | Verdict |
|---|---|---|
| PORY (mid-game value) | log-loss **0.5648** vs coin 0.6931, ECE 1.8%, CI [0.550, 0.584] | **holds** |
| WAR (species RAPM) | **0.6856** vs coin 0.6931, accuracy 54.1% | **holds** |
| MEDICHAM damage | 100% within 5% of the Smogon calculator | **holds** |
| SLOWKING (species) | greedy 0.078 vs Nash 0.0002, gap CI **[0.0031, 0.0977]** | **holds** |
| SLOWKING (playstyle) | gap CI **[-0.0001, 0.2105]** | **no longer clears zero** |
| COUNTERPLAY tech-lift | +0.0274, CI **[0.0006, 0.0533]** (was +0.0386 [0.0155, 0.0617]) | **barely holds** |
| GURU predictive test | log-loss 0.7007 vs coin 0.6931 | still a coin, as always documented |
| CHOMP-EV | winners lean more aligned, CI includes 0.5 | still the honest null |
| XATU policy clone | top-1 32%, phase-conditioning again did not help | unchanged |

- The pattern is consistent and worth stating plainly: **the strong results were unaffected and the
  marginal ones got weaker.** Duplicated rows inflate apparent independent evidence, so they narrow
  intervals without adding information. Nothing that was solid became shaky; two things that were
  already borderline (the playstyle equilibrium gap, the tech-lift) lost the significance they had
  been credited with.
- Site data regenerated from the clean store (7,315 games, 48,326 turns, 11 archetypes).

## [2.10.0] — 2026-07-24

### Fixed — the store was half duplicates, and every sample size was overstated
- **`data/games.ladder.jsonl` held 14,361 lines but only 7,315 unique games** — 7,040 duplicate rows,
  left over from the `merge -X ours` reconciliations during the earlier git incident. Every "14,355
  games" figure quoted today was inflated roughly 2x, and duplicated rows also narrow confidence
  intervals artificially. The store is now deduplicated; **no unique game was lost** (verified by id
  set comparison against the pre-merge backup).
- **Store reparsed from the raw log archive**, so the mega/weather/terrain parsing now applies to
  history rather than only to new games. Effect: **12,146 mega events** and **8,752 weather/terrain
  events** where there were none, and setter abilities appear at last — Pelipper **Drizzle 0 -> 1,490**,
  Torkoal **Drought 0 -> 613**, Incineroar Intimidate 1,934.
- **Illegal ability readings rejected.** Log attribution is imperfect (Trace copies opponents; a
  mis-attributed slot handed Basculegion an "Intimidate" it can never have). Observed abilities are
  now validated against the species' legal set from the dex, and impossible readings are dropped
  instead of creating phantom roles.

### Changed — a result got weaker on clean data, and that is reported
- **COUNTERPLAY's tech-lift, recomputed on the deduplicated store: +0.0274, 95% CI [0.0006, 0.0533].**
  It was +0.0386, CI [0.0155, 0.0617] on the duplicated store. The interval still excludes zero, but
  only barely — the earlier version overstated the evidence because duplicate games were counted as
  independent observations. The direction stands; the confidence does not. **WAR is unaffected in
  direction and still beats a coin: 0.6856 vs 0.6931, accuracy 54.1%.**

### Notes — what "known" actually means under closed sheets
- A correction to how the new `species-abilities.json` was described. **Nothing about an opponent's
  Pokemon is known until it is proven in play — ability, item, and moves alike.** The dex narrows the
  *possibilities*; it does not reveal the set:
  - **94 species have exactly one legal ability**, so for those the species genuinely does determine
    it at preview. That is the only truly certain case.
  - **213 species have two or three**, so the ability stays a belief until the log proves it —
    Basculegion is Swift Swim *or* Adaptability *or* Mold Breaker.
  - **A mega's ability is certain only once it megas.** Before that you cannot see the stone, so you
    do not even know a mega is coming, let alone which form.
  - **Items and moves are never given by the dex at all** — only revealed by use.
  - **EVs are the hardest of all, and are never stated anywhere.** They are only *bounded*, and only
    by inference: a damage roll narrows an attacking stat to a range rather than a value (16 possible
    rolls, all consistent with a band of EVs), and moving first only proves a Speed *inequality*
    against whatever it outsped — sharpest at a known benchmark, useless in Trick Room or under a
    Choice Scarf. So an EV spread never collapses to a point the way an ability or an item does; it
    narrows to an interval that tightens with every turn. The engine's level-50 numbers assume a
    standard competitive spread and are labelled an approximation for exactly this reason.
- The consequence is a design one: this is a belief-state problem, not a lookup. The right structure
  is a per-slot information state that starts as the legal possibility set and collapses on each
  reveal. That is XATU's job, and it is the next thing to build properly.

## [2.9.0] — 2026-07-24

### Fixed — the extractor never knew mega evolution existed
- **`engine/durable-ingest.js` did not parse `|detailschange|` or `|-mega|`.** Every mega therefore
  kept its BASE form's identity, and its new ability was never attributed to anything: **904 of 906**
  Charizard-Mega-Y sets had a blank ability, and Raichu-Mega-X (Electric Surge) was indistinguishable
  from Raichu-Mega-Y (No Guard) even though they play nothing alike. Now parsed, with the mega, its
  base form and the stone recorded.
- **Weather and terrain setters were half-invisible.** A setter ability is usually stated *only* in
  `|-weather|...[from] ability: Drizzle|[of] p1b: Pelipper`, which we did not read. Verified on a live
  replay: the fix recovers `pelipper -> Drizzle` and `glimmoramega` + `Glimmoranite`.
- **`engine/roles.py` had stopped finishing** (>120 s at 14k games). Two hot spots, both replaced with
  the identical calculation vectorised: the logistic fit, and a bootstrap that was re-running the model
  600 x |test| x |roles| times when per-row losses do not change between resamples. **5.2 s** now.

### Added
- **Mega dex from the authoritative source** (`engine/build_mega_dex.js` -> `data/mega-dex-official.json`,
  merged by `engine/merge_mega_into_engine.js`). Source is Showdown's own `pokedex.json` — the data the
  server runs this format on. **67 mega formes** added to the engine dex with real types, abilities,
  base stats and required stone. Damage validation re-run and unchanged (100% within 5%).
- **Zoroark-Hisui illusion detector** (`engine/illusion.js` -> `data/illusion.json`). Illusion copies the
  NAME, not the moveset, so a legality contradiction proves the disguise: the apparent species cannot
  learn the move and Zoroark can. On 395 Zoroark team-sides it proves **156 disguises** (0.39 each).
  Most common disguise Whimsicott; the giveaway moves are Hyper Voice (32) and **Bitter Malice (30)**,
  a Zoroark-Hisui signature. Conservative by construction, so the count is a floor.
- **Weather and terrain roles split by type** — rain/sun/sand/snow and psychic/grassy/electric/misty, on
  BOTH the setter and abuser side, so "Swift Swim with no Drizzle" is a detectable defect rather than
  two generic tags that never meet. Taxonomy is **52 roles**, covering **98.0%** of real move usage.

### Notes — measured, including what it cannot yet measure
- **Mega abilities cannot be harvested from logs, at all.** Mega evolution emits only `detailschange`
  and `-mega`; no ability line follows. An earlier harvest appeared to find 9 conflicts with the
  official dex — three were **Trace** correctly copying an opponent's ability, and the rest were
  attribution noise on 1–6 observations. The official dex is the source; the harvester is kept only
  to discover which formes exist.
- **First dead-ability measurement:** 72% of teams carrying an Expanding Force user have **no Psychic
  Terrain setter**, and 99.6% of Electric Terrain abusers have no setter. The weather equivalents
  return nothing yet — those roles are ability-based, abilities only announce sometimes, and the
  Wilson credibility gate correctly drops them as under-observed. Fix is to source abilities from the
  dex (certain where a species has only one) rather than from observation; not done yet.
- The store still needs a **reparse** before any of the new mega/weather events exist historically.

## [2.8.1] — 2026-07-24

### Notes — a wrong diagnosis, corrected
- The `auto: <date>` commits were diagnosed as a rogue timer running `push-all.bat` every ~2 minutes.
  **That was wrong.** Reading the commits properly showed they are authored by the workspace's own
  auto-commit, which fires ~2 minutes *after files change*, then commits and pushes. The apparent
  fixed cadence was simply a long stretch of continuous editing. Verified: a test edit was committed
  and pushed to origin unattended, with nothing outstanding afterwards.
- Consequence: the publish automation the project needed **already existed**. The idle-publisher
  scripts added earlier today (`build/auto-push.ps1`, `AUTO-PUSH-START.bat`, `AUTO-PUSH-INSTALL.bat`,
  `find-autocommit-task.bat`) were removed — a second publisher racing the first is what wedged the
  repo mid-rebase in the first place. One publisher is correct; two is a bug.

### Kept
- `push-all.bat` stays disarmed (requires the `GO` argument) and now refuses to act on a repo that is
  mid-rebase. That guard is the durable fix and is unrelated to the misdiagnosis.

## [2.8.0] — 2026-07-24

### Fixed
- **`engine/guru.py` aborted on a truncated store line**, so the site's headline numbers were frozen
  at **5,199 games** while the store had grown past **7,400**. The ingest job appends on a schedule
  and an interrupted run can leave a partial line (6 of 7,449 lines). GURU now skips unparseable
  lines like the other engines. Map metrics are live again.
- **`engine/vocab.py` ignored the multi-role override table**, so tagged moves (Psychic Fangs, Brick
  Break, Stockpile) were reported as untagged. Coverage of real in-battle move usage is **97.1%**.
- **The MAP's hover text** was long and carried leftover nickname glosses ("(MEDIcham)"). Every node
  blurb rewritten to one plain sentence.

### Changed
- **MAP edges are curved rather than straight.** A crossing-free drawing is not possible for this
  dependency graph — ALAKAZAM has six parents spread across a row and MEDI feeds both the far left
  and the far right — so instead of claiming otherwise, each edge now bows in proportion to how far
  it travels, which separates lines that previously overlapped. Hover still isolates one path.
- **Taxonomy expanded 27 → 39 roles**, all from real gameplay distinctions:
  status split by type (**burn** = a debuff that halves Attack, **paralysis** = speed control,
  **sleep** = action denial, **poison** = a clock) — each 1,000+ uses and 20–59 species, so none is
  sparse; **spread attacker** split from **field-wide (hits your own partner)**, because Earthquake /
  Surf / Discharge constrain team building (they need an immune partner); plus **multi-hit** (breaks
  Sash, Sturdy, Multiscale, Substitute), **fixed/fractional damage** (Super Fang, Seismic Toss —
  ignores stats and the type chart), **residual chip**, **hazards** (incl. Toxic Debris),
  **substitute**, **weather/effect denial** (Cloud Nine, Air Lock, screen-breakers),
  **weather/field abuser** (distinct from setter), and **positioning** (now including Roar-family
  forced switches). Freeze is documented as functionally sleep but *not* tagged: no move in Reg M-B
  sets it, so crediting every Ice attack would be dishonest.
- Ability mapping corrected throughout: Lightning Rod / Storm Drain → redirection; Hospitality and
  Regenerator → healing; trigger-boosters (Defiant, Competitive, Moxie) → setup. Fairy Aura and Dark
  Aura are deliberately **left untagged** — they are passive, permanent, type-wide multipliers, not
  the same job as Helping Hand's active one-turn boost.

### Added
- `engine/build_roles_js.py` → `data/roles.js`; the Roles booth gains a **species explorer** showing
  any Pokémon's role *distribution* with confidence intervals, and archetypes now show their most
  distinctive Pokémon by lift.

### Notes — the fragmentation trade-off, stated plainly
- A finer taxonomy costs cell size. The median role-pair cell has moved **7,971** (over-tagged, v2.6)
  → **95** (credible tags, 27 roles) → **~50** (39 roles). It is still far above the old single-label
  archetype cells (n=11–18), but the direction is the price of resolution. The test and sanity bars
  were lowered 100 → 50 → 35 **with the reason recorded in-line**, and they now act as the tripwire
  against adding roles without a justification.
- Winner-prediction from preview roles is unchanged at the coin (0.6935 vs 0.6931); WAR still beats
  it (0.6867, accuracy 54.4%). Neither headline conclusion moved.

## [2.7.0] — 2026-07-24

### Changed
- **A species now has a role DISTRIBUTION, not a role list.** The same species is support on one set
  and offensive on another, so `dex[species][role]` is now `p(role | that species appears)` measured
  across its revealed sets, and a team's role vector is a **noisy-OR** over its six
  (`1 − Π(1 − p_i)` = probability at least one of them plays the role). Under closed sheets this is
  also the correct object: before the set is revealed, the distribution *is* our belief.
- **Credibility is judged by a Wilson lower bound on the rate, not a flat count.** The old
  `count ≥ 2` rule could not tell a real minor set from noise — it tagged Basculegion as *debuff* on
  **2 of 3,566** appearances (0.06%). A role now counts only when the Wilson lower bound of its
  per-set rate clears 5%, which automatically demands more evidence from a common species and stays
  honest for a rare one.

### Fixed
- **Ability→role gaps found by audit:** *Lightning Rod* and *Storm Drain* now map to **redirection**
  (they redirect, and were untagged). Added a new role **weather/field abuser** (Chlorophyll, Swift
  Swim, Sand Rush, Solar Power, Protosynthesis, Quark Drive…) — a distinct job from *setting* the
  weather. Trigger-boosters (Defiant, Competitive, Moxie, Justified, Berserk…) now map to **setup**.
  Taxonomy is 27 roles; curated roles cover **90.8%** of real in-battle move usage.

### Added
- **`docs/ROLE-ATLAS.md` (+ PDF)** — the master list: every move (478) and ability (99) with the role
  it is tagged as, generated directly from `engine/roles.py` so it cannot drift, plus a ranked list of
  untagged-but-used moves as tagging candidates. Generator: `engine/role_atlas.py`.
- **`docs/ROLE-FAMILY.md` (+ PDF)** — one read-through of the role model, WAR, and the emergent NMF
  archetypes, with every result stated against its baseline.
- Site: the MAP tab now renders a real **map icon** in the nav, town and room hero (the Porygon2
  sprite is gone), and **MAP is first** in the nav order.

### Notes — a prior number changed, and why (not silently rewritten)
- The v2.6.0 claim "median role-pair cell **n = 7,971**" was **inflated by over-tagging**: under the
  old binary rule a team carried **19.6 of 26** roles on average, so nearly every game landed in
  nearly every cell. With credible tags a team carries **4.3 of 27**, and the honest median cell is
  **n ≈ 95**. That is still far above the old single-label archetype cells (n = 11–18) — the pooling
  argument stands — but the earlier figure overstated it. Test and sanity bars moved 100 → 50 with
  the reason recorded in-line.
- Winner-prediction from preview roles remains at the coin (0.694 vs 0.693); WAR still beats it
  (0.6875). Neither conclusion changed.
- The hourly **ingest** workflow no longer fails the run when Showdown rate-limits or serves a bad
  log (`continue-on-error` on the fetch/rebuild steps) — it was emailing a failure notice every hour.

## [2.6.0] — 2026-07-24

### Added
- **Emergent roles via NMF** (`engine/nmf_roles.py` → `data/nmf-roles.json`, `data/nmf.js`). Instead of
  hand-declaring roles, this factorizes the data (Lee & Seung 1999; topic-model / Label Distribution
  Learning framing, Geng 2016) into roles that are *discovered*. Two cuts: (1) team×MOVE usage →
  offensive cores (recon-err 0.79; attacking moves dominate — shown honestly); (2) team×ROLE →
  **emergent archetypes** (recon-err **0.53**, the clean view): Intimidate+Fake-Out control, physical
  offense, special offense+sustain, **bulky wall + screens + redirection**, Tailwind+Encore, priority.
  A team is a *blend* of these, never one hard label — the structural fix for the single-label grid.
- **Vocabulary census** (`engine/vocab.py` → `data/vocab-usage.json`): tags every move/ability/item and
  counts **actual in-battle usage** (from the turn log), not just sheet reveals. Curated roles cover
  90.4% of non-neutral battle usage; surfaces high-usage uncovered moves as tagging candidates.
- **Roles booth on the site** (`web/index.html` → `app/`): the "Role Foundry" (Smeargle) renders the
  emergent archetypes and offensive cores live from `data/nmf.js`, with the reconstruction errors shown.
- Role taxonomy grown to **26** roles (added ally-support/positioning and item-disruption); factual
  multi-role membership for multi-effect moves (Matcha Gotcha = attack+heal+status; Body Press =
  wall+attack; Knock Off = attack+item-strip; Fake Out = tempo only, not an attacker).

### Changed
- **Removed hand-set role weights.** An earlier draft assigned fractional primary/secondary weights
  (0.6, 0.4…) by hand — asserted, not measured. These were stripped: role *presence* is binary and
  data-justified, and graded *strength* is now the learned output of the NMF, not a typed input. This
  is the project's "measured, not asserted" rule applied to itself.
- Sanity extended to 77 checks (role model + WAR + NMF); `tests/test-roles.py` at 19 checks.

### Notes
- Honest read on the NMF: at the team level the dominant axis of variation is offensive core + speed
  control, so the move-level cut is coarse; the role-level cut is the useful one. Rank and the human
  names are the only non-data choices. Rigorous rank/weighting selection by topic coherence (Mimno
  2011) is noted as the next refinement — reconstruction error alone is not comparable across weightings.
- Still local + (about to) push. Site booth added; white paper / deck / technical docs for the role
  family remain to be written in a dedicated docs pass.

## [2.5.0] — 2026-07-24

### Added
- **ROLE model — multi-label team composition** (`engine/roles.py` → `data/pokemon-roles.json`,
  `data/role-matchups.json`, `data/roles-eval.json`). Replaces the single-label playstyle view.
  A team is tagged with every role it reveals (24 roles across speed control, weather, terrain,
  disruption, status/debuff, priority, prankster, setup, healing, screens, walls, pivot, trapping,
  perish, and physical/special attacker), where each **species earns a role from data** — it is
  credited once observed doing it (≥2 times). Team role vectors are built from the **team-preview six**
  (leak-free). Why: the old model forced one label per team and shattered the data into
  archetype×archetype cells of n=11–18; role-pair pooling gives a **median cell of n=7,750** (576 cells).
- **Role-pair matchup matrix** with Wilson CIs — the descriptive "which role beats which," now dense
  enough to reach significance, ready to feed GURU/KING and the site grid.
- **Win-credit attribution:** per-role logistic coefficients (each role's marginal contribution to
  winning) plus **KO-credit per species** from the turn log (who actually scored the knockouts in
  games their side won).
- **WAR for Pokémon — Wins Above Replacement** (`engine/war.py` → `data/war.json`). Ridge-regularized
  Adjusted Plus-Minus (basketball RAPM) on team-preview species indicators, with an explicit
  20th-percentile replacement baseline and the logistic wins conversion (0.25·Δβ·games).
- **Tests + sanity:** `tests/test-roles.py` (19 checks; hand-derived tags, reads shipped reports so it
  can't drift). `engine/sanity_check.py` extended to cover the role model + WAR (now 70 checks).

### Notes
- **Two honest results, stated plainly.** (1) Predicting the winner from **preview roles** ties a coin
  (held-out log-loss 0.6938 vs 0.6931) — consistent with the sheet-level null; the role model's value
  is descriptive + attribution, not prediction. (2) But the **species-level WAR model does beat a coin**
  (0.6875 < 0.6931) and beats the rating baseline (0.6905): *which* species you bring at preview carries
  a small real signal that raw roles and raw sheets do not. Effect sizes are small; WAR magnitudes are
  ridge-shrunk and flagged exploratory.
- White paper / deck / technical docs and the site grid are **not yet** updated for this model — code and
  reports are written and tested locally; the doc + site pass is the next step (flagged, not silently skipped).

## [2.4.0] — 2026-07-23

### Added
- **v2 models on the site (`web/index.html` → `app/`):** new booths for **GURU** (meta matchup matrix), **XATU** (opponent belief), **PORY** (mid-game win% — with a live interactive "your win %" demo driven by `data/pory.js`), and **ALAKAZAM** (the in-battle capstone, honestly flagged in-development). SLOWKING's booth rewritten to show its real equilibrium mixture + a **rock-paper-scissors triangle diagram**. Model names rendered in **ALL CAPS** across the nav and town.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run → `data/slowking-playstyle-eval.json`): classifies each real team by playstyle and builds a playstyle×playstyle matrix; surfaces the strongest non-transitive cycle (TrickRoom → HyperOffense → Sand → TrickRoom).
- **ALAKAZAM plain-English one-pager** (`docs/ALAKAZAM-one-pager.md` + `.pdf`): context, what it will be, how it works, compute needs, timeline — for a non-Pokémon audience.

### Changed
- **Honest framing of the playstyle cycle:** the cycle legs are 62% / 71% / 67% but on only n=13–18 games each, with 95% CIs that cross 50%. Site copy now calls it a **suggestive pattern, not a settled fact** — it sharpens as the store grows. No overclaiming.
- **Docs folder cleaned:** 13 superseded/duplicate files (old simulator whitepaper, special-cut, v2-plan PDF, old summaries/reviews/handoffs) moved to `docs/archive/`; one canonical version of each kept.
- **Site chrome:** removed the static side-advisor mascot (kept the roaming Abra sprites).

### Documentation (full v2 rewrite — brought to standard)
- **White paper, deck, and technical docs rewritten for v2** (they had drifted to pre-pivot v1). The white paper now covers the empirical ceiling, every model with its validated result (incl. the two honest negatives), the mathematics (Wilson interval, value-net logistic, regret-matching/exploitability, clustered + Beta-resampled CIs, HodgeRank for future core analysis), limits, and cited sources. The deck is plain-English; the technical docs are ASD-STE100 Simplified Technical English organised by Diátaxis. Each ships a matching **PDF**.
- **New `docs/SUMMARY.md` (+ PDF):** one-page whole-project + per-component summary table.
- **Corrected an error** in the ALAKAZAM one-pager: poker is *sequential*, not simultaneous — reframed as "hidden information like poker **plus** same-time choices like rock-paper-scissors."
- **CLAUDE.md** now lists the docs that MUST update in the same pass as any change (living-docs enforcement), so the white paper/deck/technical docs cannot silently drift again.

### Removed
- Nothing deleted — superseded docs are archived (reversible), not destroyed.

---

## [2.3.0] — 2026-07-23

### Added
- **SLOWKING preview-Nash** (`engine/slowking_preview.py` → `data/slowking-eval.json`, `data/slowking.js`): solves GURU's real 13-archetype matchup matrix (5,199 games) to an equilibrium mixed strategy and grades it by **exploitability** (the spec's acceptance bar for the strategic layer) against greedy-single-deck and uniform baselines, with a bootstrap CI that propagates matchup-count uncertainty (Beta resampling). Also reports the strongest **non-transitive 3-cycle** in the meta.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run with `MATRIX_FILE=…/playstyle TAG=playstyle` → `data/slowking-playstyle-eval.json`): a rule-based classifier tags each real team by playstyle (TrickRoom / Rain / Sun / Sand / Snow / Setup / PerishTrap / TailwindOffense / FakeOutBalance / Stall / HyperOffense) and builds a playstyle×playstyle matrix from 2,866 games. **This is where the non-transitivity is real:** greedy single-playstyle exploitability 0.115 vs Nash 0.0002, gap CI [0.001, 0.280] (clears 0), with a clean cycle **TrickRoom → HyperOffense → Sand → TrickRoom** (~0.115 edge/leg). Equilibrium: Rain 0.51 / Sand 0.26 / HyperOffense 0.10 / Setup / PerishTrap / Snow.
- **Test + CI:** `tests/test-slowking.py` — a hand-derived Rock-Paper-Scissors unit test of the Nash solver (answer is uniform, value 0) plus shipped-artifact invariants; gated in the `tests` workflow (regenerates the artifact then checks it).
- **Portfolio:** ABRA added to `willhoop.github.io` as a one-object entry in the `PROJECTS` array (its own convention), leading with a measured number (PORY 0.567 vs coin 0.693). A `PUSH-TO-GITHUB.bat` was added to the portfolio repo for one-click publishing.

### Findings (honest)
- **Equilibrium mixture:** Kingambit-Basculegion 0.84 / Garchomp-Incineroar 0.16. Exploitability **Nash ≈ 0 vs uniform 0.109** — mixing over the right decks is far less exploitable than spreading evenly.
- **Greedy ≈ Nash at the archetype level:** this meta is currently near-transitive (a dominant deck), so "pick the single best deck" is about as unexploitable as the equilibrium *right now* — stated plainly rather than spun as a win for mixing. **However** a real rock-paper-scissors cycle exists (Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar → back, ~0.10 edge/leg), and the greedy-vs-Nash gap CI reaches 0.27, so under plausible resamples the meta is non-transitive. Finer, playstyle-level archetypes (stall / Trick Room / perish-trap / setup) would expose more cycles — the documented next refinement.

### Notes
- Archetype-level, not set-level: SLOWKING solves over 13 discovered archetypes, not exact teams/sets; a belief over the opponent's real six (XATU) is the next refinement. Exploitability grades the preview *decision*, never who wins a match (GURU's own predictive test ties a coin).

---

## [2.2.0] — 2026-07-23

The v2 decision-stack release: stop predicting winners, support decisions. Models built + graded
this session, each with a proper score + clustered-by-game CI + honest baseline, persisted to JSON.

### Added
- **GURU** — meta/matchup matrix from REAL game outcomes with Wilson CIs (`engine/guru.py` → `data/guru.js`). Replaces the biased *simulated* payoff matrix at the source.
- **XATU** — opponent belief (item/ability/moves) inferred from replays (`engine/xatu.py` → `data/xatu.js`).
- **PORY** — mid-game win-prob value net from real replays (`engine/pory.py` → `data/pory.js`). **The win:** held-out log-loss **0.567 vs coin 0.693**, beats a material-sign heuristic, calibrated (ECE 1.6%), clustered-by-game CI [0.548, 0.583]. Proves the v2 pivot — mid-game state is predictable even though pre-game sheets are not.
- **PORY wired into KADABRA:** the coach now shows a per-turn **"you're at X%"** chip at each key moment, computed in-browser from `data/pory.js` (site includes it now). `web/index.html` `kadBuild`/`renderKad`; mirrored to `app/`.
- **CHOMP-EV proof** (`engine/chomp_ev.js` → `data/chomp-ev.json`): the winnable team-preview test — do CHOMP's recommended brings beat humans' actual brings on held-out games? Ranks each side's actual bring among all 15 candidate brings by CHOMP exact-damage coverage; headline sign test + held-out logistic log-loss (Brier too), clustered bootstrap CI, baselines = coin / Elo / usage-prior, plus a forfeit-robustness pass and a measured selection audit.
- **Test + CI:** `tests/test-chomp-ev.js` validates the committed `data/chomp-ev.json` invariants (split bookkeeping, score ranges, CI brackets, verdict-vs-numbers consistency, honesty block); gated in the `tests` workflow.

### Findings (honest)
- **CHOMP-EV is a NULL at the format ceiling.** On 1,205 held-out human games, CHOMP's bring ranking does **not** beat a coin (log-loss 0.6918 vs 0.6931, CIs overlap), ties an Elo and a usage-prior baseline, and winners are only marginally more CHOMP-aligned than losers (0.512, CI [0.493, 0.535] — includes 0.5). CHOMP's top pick matches the human bring ~9.5% of the time (chance 6.7%). **Robust:** dropping all forfeits leaves it unchanged (0.505; log-loss 0.690 vs 0.693). **Selection audit:** eval games average 6.5 turns / 1280 rating vs 6.08 / 1267 excluded — a mild bias that, if anything, *favors* CHOMP, making the null conservative.
- **What this does NOT impugn:** CHOMP's damage math stays VALIDATED vs `@smogon/calc`; the null is about the *bring-selection signal*, which sits at the same near-coin ceiling as pre-game win prediction. It guards against optimizing a bring metric with no held-out winning signal (the DITTO/measure-gaming trap). Path to a real edge: score brings with belief-aware value (XATU) + the lead stage-game (SLOWKING) + PORY leaf value, then re-run this exact test.

### Notes
- White paper and plain-English deck updates for GURU/XATU/PORY/CHOMP-EV are still pending (this pass shipped code + CHANGELOG + MODELS/HANDOFF; the long-form docs are the next documentation pass).

---

## [2.1.0] — 2026-07-23

### Validated
- **MEDICHAM damage engine validated against `@smogon/calc`** (`engine/validate_damage.js`): with stats aligned, matches the ground-truth calc within 5% on 100% of 31 meta scenarios (median 0% error). Fixed the level-50 harness bug, then closed the ability gaps it surfaced.

### Added
- **Ability/item layer, each validated vs Smogon:** Ruin quartet, Solar Power, Guts, Orichalcum Pulse, Hadron Engine, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, Heatproof, Purifying Salt, type-immunity abilities, Expert Belt, Muscle Band, Wise Glasses.
- **DITTO policy hardening:** accuracy-weighted move value, recoil cost, self-stat-drop moves (Close Combat/Superpower/Overheat) with **Contrary** flip, **Mega ability tracking** (base vs Mega stone — Staraptor→Contrary, Swampert→Swift Swim + canonical Megas), weather-speed abilities (Swift Swim/Chlorophyll/Sand Rush/Slush Rush). Reduces the speed/frailty over-crediting (the Staraptor problem).
- **Site now grows:** `data/live.js` (counts + data-derived archetypes) and `data/kad-replays.js` (offline replay bundle) regenerate via `engine/refresh-site-data.py`, run by the daily replay pull. Town stats + DITTO archetypes read live.
- **Archetypes discovered from data** (`engine/archetypes.py`, k-means over 9,998+ real teams), not hand-listed — refreshes as the meta shifts.
- **ORB (CHOMP dock) upgraded to a validated Smogon-grade substitute:** reads live stats/items/boosts/weather/terrain/Helping Hand/spread/screens, shows applied conditions. One-click install; auto-updates.

### Fixed
- KADABRA works offline (`file://`) — coaches from the local bundle, clean move-by-move viewer with arrows and a bold "what you should've done" (dropped the Showdown iframe clutter).
- Abilities corrected from a curated meta map (no more bogus "Pressure"); real move names + spacing; Laplace smoothing so win rates never read 0%/100%.
- Non-transitivity view rebuilt as big whimsical rock-paper-scissors loops (no tiny text). Town card honesty (daily, real counts). Footer/sprite overlap.

### Known gaps (not guessed — need confirmation)
- **Champions rule changes vs Gen 9** (sleep, paralysis, specific move changes) are NOT yet modelled — pending the exact format rules.
- Enemy EVs are assumed (unknowable). Mega **stats/types** not yet swapped (abilities are).

---

## [2.0.0] — 2026-07-23

The "honest instrument" release: a real doubles engine, an evaluation layer that grades every
probability, the SLOWKING belief-search stack, and the first learned value function (the flywheel's
core). Also a strict self-review that reshaped the roadmap.

### Added
- **MEDICHAM v3 — real Gen-9 doubles engine** (`engine/medicham2-browser.js`, embedded in the site):
  replaces the 1v1 OHKO-chain that collapsed to 0%/100%. Damage formula with boosts/spread/crit/rolls,
  weather, Trick Room, Tailwind, priority, Protect, items, abilities, Fake Out; behaviour-cloned policy
  (samples real move rates), need-based Protect. Verified: mirror 0.50, healthy distribution, 400
  rollouts/29ms. Win rates now carry a 95% CI on the site.
- **Evaluation harness** (`engine/eval_harness.py`): temporal held-out log-loss / Brier / calibration
  vs coin, player-Elo, and usage baselines with bootstrap CIs. **Verdict: JOLTEON ties a coin in
  log-loss** — demoted from headline predictor to fast prior + baseline; site copy made honest.
- **Calibration** (`engine/calibrate.py`): temperature scaling; the Python JOLTEON was 6× overconfident.
- **Learned in-battle value function** (`engine/train_value.py` → `data/value-net.json`): reconstructs
  per-turn HP state and regresses the outcome. Beats a coin (log-loss 0.682) and is calibrated — the
  first genuinely learned, calibrated component, and the leaf evaluator + flywheel core.
- **SLOWKING infrastructure** (`engine/slowking/`): `nash.py` (equilibrium, verified on RPS/2×2),
  `belief.py` (public-belief-state + Bayesian filter), `ismcts.py` (simultaneous-move regret matching,
  recovers exact Nash), `game.py` (engine interface), `solver.py` (team-preview Nash + continual
  re-solve; returns bring *mixes* + win%), `value.py` (loads the learned leaf). All unit-tested.
- **Self-play data pipeline** (`sim/generate-dataset.js`) writing engine games into the store schema —
  the unlimited, unbiased "more games" path. Scraper default raised 2→25 pages (~10× per run).
- **Non-transitivity finding** (`data/nontransitivity.json`, DITTO tab): the meta is rock-paper-scissors
  (3 robust cycles after noise control) — empirical proof an additive rating can't capture it. Shown
  with an explicit "preliminary, thin data" caveat.
- **Docs:** `docs/POKER-TO-POKEMON.md` (the founding white paper), `docs/THESIS-REVIEW.md` +
  `docs/THESIS-REVIEW-v2.md` (strict self-critique with fixes), `docs/COMPETITORS.md` (VGC-Bench et al.
  and how we refine them), `docs/OVERNIGHT-HANDOFF.md`.
- **Site:** in-browser DITTO (item tuning + PokéPaste export) and KADABRA (client-side replay coach);
  MEDICHAM/DITTO use the sprite picker; saved-teams in the matchup; ORB opens from Chomp's room;
  per-room personality mascots; threats table with sample-adjusted Win%, real speed, Games column.

### Changed / Honest corrections
- JOLTEON reframed as a fast prior, not an oracle (backtest: ~coin in log-loss).
- White paper corrected: the current SLOWKING search is IS-MCTS/PIMC (strategy fusion), a rung below
  the ReBeL target — no longer overclaimed.
- Non-transitivity presented as preliminary (approximate engine, small sample), not a settled claim.

### Fixed
- MEDICHAM special-move bug (special attackers dealt 0 damage); booth slot regression that broke
  "Surprise me"; DITTO/KADABRA no longer require a server.

---

## [1.0.0] — 2026-07-22

### Added
- **ABRA is born**, split out from CHOMP as its own project: the Automated Battle Replay Analyzer.
  CHOMP stays the bring-4/lead-2 engine; ABRA is the meta-analysis brain that feeds it.
- **Durable, incremental, no-redo ingest** (`engine/durable-ingest.js`): pulls public Champions
  Reg M-B replays from the Showdown API (paginated, ~200 logs/sec, concurrent), stores every game
  raw and tagged — both teams' six, brings, leads, observed moves/items/abilities, result, both
  ratings, and a bot flag. Appends only new games (dedup by id). Tested on 1,501 real ladder games.
- **Analysis over the store** (`engine/analyze.js`): usage model at any rating cutoff / humans-only,
  plus a personal split by Showdown username. Writes `data/meta-usage.json` for CHOMP.
- **`ME` alias list** so a Showdown rename is a one-word edit, never a re-pull.
- `tests/test-parse.js` — 12 hand-derived checks on the replay extractor (teams, leads, brings,
  observed set fields, bot flag, rating, date).
- Governance: LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, .gitignore, CI workflow.

### Validated
- High-ladder filter (humans, 1300+) reveals real signal distinct from the raw ladder — e.g.
  Kingambit 62% win, Incineroar 65% — confirming the tag-and-filter design earns its keep.

## [1.1.0] — 2026-07-22

### Changed
- **Reframed to its true scope.** ABRA is documented as the live-data platform whose purpose is to
  feed a simulator that models games and teams — a self-improving flywheel (collect → simulate →
  optimise teams → play with CHOMP → auto-ingest enemy teams → improve). CHOMP is one small early
  consumer, not the point. White paper §8 states the flywheel and the honest built-vs-roadmap status.

## [1.2.0] — 2026-07-22

### Added
- **Simulator research white paper** (`docs/ABRA-simulator-whitepaper.md`): an MIT-level treatment of
  learning a VGC battle simulator from logged replays. Formalises the game (POSG, imperfect info,
  simultaneous moves), derives three modelling tiers with their estimators and failure modes, frames
  team optimisation and the self-improving flywheel, and grounds every claim in the 2025 literature
  (PokéChamp, Metamon, VGC-Bench, ReBeL/Player-of-Games, Sampled/Gumbel MuZero, offline RL). Names the
  model family in the CHOMP/ABRA tradition — **JOLTEON** (fastest, win-prob),
  **MEDICHAM** (Rapidash, rollouts), **SLOWKING** (slow deep learned dynamics), **DITTO** (team
  optimiser) — speed of the Pokémon matches the cost of the model. Folds in CHOMP's pKO threat scoring
  as JOLTEON's features and MEDICHAM's dynamics (grey-box modelling).

## [1.6.0] — 2026-07-23

### Major finding
- **The Champions engine is OPEN, not closed** (`docs/OPEN-ENGINE-FINDING.md`). Verified by cloning
  `smogon/pokemon-showdown`: the exact format `[Gen 9 Champions] VGC 2026 Reg M-B` (and its Bo3
  variant) is in `config/formats.ts`, backed by a full `champions` mod (SP system in
  `data/mods/champions/scripts.ts`). This overturns the project's founding assumption. SLOWKING no
  longer needs to *learn* the dynamics — it can query the real engine (ReBeL over a known simulator),
  and MEDICHAM/DITTO/JOLTEON can use exact rollouts + self-play. SLOWKING white paper §3 corrected;
  roadmap task added to wire the engine as ABRA's simulator.

### Added
- **MEDICHAM runs in the browser** — the damage engine, type chart, sets, and behaviour-clone priors
  (96KB) are embedded in `web/index.html`; the rollout runs client-side (~40ms / 200 rollouts). The
  "MEDICHAM check" button and Medicham's run panel now work with **no server**. Validated: mirror
  0.53, rain-vs-sun 0.19 (matches the Node engine).
- **Combined team+rating predictor** (`engine/predictability.py` §2.5): the real pre-game ceiling is
  ~57% — combining team sheets AND player ratings does no better than team alone, confirming the game
  is variance-dominated (and that the two ~55%s are different axes that corroborate, not the same
  claim). Predictability study updated with the honest framing.
- **ABRA MCP server** (`mcp/`): exposes the models as tools Claude can call — `abra_win_probability`
  (JOLTEON), `abra_rollout` (MEDICHAM), `abra_threats`, `abra_species_stats`, `abra_optimize_team`
  (DITTO), `abra_coach_replay` (KADABRA). Local stdio server; `claude mcp add abra -- node mcp/server.js`.
- **Regulation registry + archive** (`data/regulations.json`, `build/archive-regulation.js`): the
  active regulation is a one-line config edit; ingest/analysis read it. When a reg ends,
  `archive-regulation.js` snapshots the store + all models into `data/archive/<id>/` (date-stamped,
  with a manifest) so previous-regulation data is preserved forever. `--rotate` starts a fresh store.
- **Mega Evolution** added to the game's action model (SLOWKING white paper §2) as a per-turn step.
- **Ditto page rebuilt**: team-builder on top + a live, sortable/searchable **threat rankings table**
  (usage / bring / lead / win% / speed) from the real stats; static chips removed.
- **Team carries between models** (localStorage), hover-× to remove a Pokémon / clear team, usage-
  ranked picker, in-browser MEDICHAM, lightning flash on JOLTEON, confetti idle-loop stopped.
- **Omnibus is now robust** (`build/omnibus.py`): always emits a self-contained HTML (SVG embedded
  directly, no LibreOffice), attempts the PDF only if `OMNIBUS_PDF=1` — reproduces the Special Cut
  reliably as the docs grow.
- New docs sewn into the Special Cut: predictability study, SLOWKING white paper + roadmap,
  architecture notes.

## [1.5.0] — 2026-07-23

### Added
- **Recency weighting (concept-drift decay)** in JOLTEON: every training game is weighted
  `w = 0.5 ** (age_days / τ)` with a half-life τ (default 30d), so the models track the *live*
  metagame instead of averaging over stale history. Normalised to mean 1 (L2 scale unchanged);
  `τ → ∞` recovers equal weighting. No-op on the current 2-day store (reported honestly);
  unit-verified on synthetic 90-day data (oldest 0.33, newest 2.14). Same rule applies to the usage
  model and behaviour-clone. Fully documented in `docs/ARCHITECTURE-NOTES.md`.
- **SLOWKING white paper** (`docs/SLOWKING-whitepaper.md`): the definitive Tier-3 design — offline
  belief-state search over a *learned grey-box model* of the *closed* Champions engine (residual over
  CHOMP), simultaneous-move mixed-Nash subgames, warm-started by the behaviour-clone. Grounded in
  ReBeL, Student of Games, PokéChamp (ICML 2025), Gumbel MuZero, Metamon. Plus a
  **research roadmap** (`docs/SLOWKING-research-roadmap.md`) turning it into five buildable papers.
- **SLOWKING Paper-1 built** (`engine/game-spec.js`): encodes stored replays into
  `(state, observation, action, reward)` trajectories — 30,608 real state-transitions with actions and
  terminal rewards. The offline dataset a Tier-3 solver trains on; a re-parse, never a re-pull.
- **Behaviour-clone + status/field MEDICHAM v2** (`engine/policy.js`, `engine/moves-meta.js`,
  `engine/medicham.js`): the rollout now samples *what real players click* (Tailwind 34% for
  Whimsicott, Fake Out 30% for Incineroar, …) and applies the effects — sleep, burn, paralysis,
  Tailwind (2× speed), Trick Room (inverted order), setup boosts, Protect. Speed control and setup are
  now *valued emergently*. Fixed a faint-and-replace symmetry bug (mirror back to ~0.50) and gated
  support on survival (don't set up into a KO). `tests/test-medicham.js`, `tests/test-dynamics.js`.
- **DITTO ported to Node** (`engine/ditto.js`): the whole live app now runs with **no Python**.
  JOLTEON scoring reimplemented in JS from the trained weights; **MEDICHAM wired in natively as the
  finalist re-ranker** (coarse-to-fine: JOLTEON proposes thousands, MEDICHAM decides the finalists).
  In a real run MEDICHAM overruled JOLTEON — chose the rain team (75.7%) over JOLTEON's tyranitar pick
  (68% grounded vs 79.8% JOLTEON). `server.js` `/api/ditto` now calls Node.
- **Local app + server** (`server.js`, `start.bat`, `app/`): the site is served from `app/` and runs
  the real engines on the user's machine (MEDICHAM/KADABRA/DITTO via Node, JOLTEON in-page). Lazy,
  robust Python probe (skips the Windows Store stub) kept only for optional JOLTEON *retraining*.
  Booth is searchable and usage-ranked; team-builder enlarged; live "MEDICHAM check" button.
- **Multi-format + open-sheet tags**, **dedup-by-replay-id everywhere** (never double-count a game
  reviewed or self-uploaded), **per-turn extractor + raw-log archive** (any new field is a re-parse).
- **ABRA WORLD website** with per-model "How X thinks" panels, teleporting-Abra background,
  usage-ranked sprite picker, PokéPaste input (accepts any species; off-roster treated as neutral).
- `docs/ARCHITECTURE-NOTES.md`: the Python/JS split rationale and the recency-weighting design, in
  detail.

### Changed
- Model labels describe the role (win probability, battle rollouts, team optimiser, replay coach,
  belief search, bring-4 engine), not the Pokémon name twice.

### Queued
- **ORB** — CHOMP's auto-fill mid-game calculator (the Life Orb of the CHOMP family): pulls your six
  (moves/items/EVs) and the opponent's revealed team from the live battle so there's nothing to type
  mid-game; opens in its own tab.

## [1.4.0] — 2026-07-22

### Added — the model family (the simulator, stages 2–3, now has working v1s)
- **Per-turn extraction** (`engine/durable-ingest.js` v2): the extractor now captures a per-turn
  event stream — move order (→ speed), exact damage % per move, faints, status, and reveals — on
  every game. Backfilled onto all 4,999 games: **30,611 turns, 55,336 damaging move events.**
- **Raw-log archive + `MODE=reparse`**: each raw `.log` is archived (`data/*.raw-logs.jsonl`), so any
  NEW field is a re-parse, never a re-pull. Proven by backfilling `format`/`openSheet` onto 4,999
  games with **zero network calls.** (Archive is gitignored; the extracted store carries the turns.)
- **Dynamics model** (`engine/dynamics.js` → `data/dynamics.json`): observed speed (who-moves-first,
  incl. Choice-Scarf hints) for 186 species, and observed damage distributions for 1,170
  (attacker, move) pairs. E.g. Garchomp Earthquake mean 57%, Basculegion Wave Crash 62.5%.
- **JOLTEON v2** (`engine/jolteon.py`): win-probability model gains **rarity-aware L2 shrinkage**
  (a species seen 25× is pulled toward neutral; seen 1000× is trusted — a measure-gaming guard at the
  model level) plus speed-edge and firepower-edge features from the dynamics model. Honest result:
  ~55% humans-only held-out vs ~49% coin flip; the dynamics features tie species-only (firepower
  earns weight +0.30, speed-edge is noise at this scale). Reported straight.
- **MEDICHAM built** (`engine/medicham.js`): Tier-2 Monte-Carlo rollout over CHOMP's exact damage
  engine. Rain core beats sun core 0.60; mirror 0.51; ~1s / 300 playouts. Sequential-singles v1
  (honest scope). `tests/test-medicham.js`.
- **DITTO built** (`engine/ditto.py`): team optimiser using JOLTEON as evaluator against a gauntlet
  of REAL ladder teams, double-oracle rounds, **usage-weighted threat coverage** (guarantees an
  answer to high-bring threats like Basculegion, ignores rare ones like Camerupt), and a **bias
  report** showing where rarity shrinkage suppresses a pick. Surfaces the measure-gaming failure honestly:
  JOLTEON-optimised "90%" team → MEDICHAM rollouts reveal ~12% → this is *why* Tier-2 vets Tier-1.
- **KADABRA v1 built** (`engine/kadabra.js`): turn-by-turn coach over a replay — reconstructs each
  scene, gives the speed read + damage read (cross-checked vs the ladder average, flags high/low
  rolls), draws the lesson, and background-appends the game (the flywheel from the coaching seat).
- **SLOWKING scaffold** (`engine/slowking.py`): Tier-3 interface fixed + data-readiness report;
  honestly flagged as a research effort, not a trained model.
- **Multi-format + open-sheet tags**: `FORMATS=` env supports collecting other ladders (e.g. the
  Reg-G best-of-3); every record now carries `format` and `openSheet` (bo3 / agreed open team sheet
  is a distinct information regime). 42 open-sheet games found in the current store.
- **ABRA WORLD website** (`web/index.html`): a Club-Penguin-styled interactive town — one room per
  model — with the JOLTEON win-probability model running live client-side (real embedded weights),
  sprite team pickers, animated odds meter, and links to the rest of the portfolio.
- Tests: `tests/test-medicham.js`, `tests/test-dynamics.js` (all green alongside parse + jolteon).

### Changed
- The flywheel's honest status advances: stages 2 (simulate) and 3 (optimise) now have working v1
  models (MEDICHAM, DITTO), with the tiered vetting (Tier-1 proposes, Tier-2 checks) demonstrated
  end-to-end. Tier-3 depth (SLOWKING) remains roadmap.

## [1.3.0] — 2026-07-22

### Added
- **JOLTEON v1 built** (`engine/jolteon.py`) — the Tier-1 win-probability model, a Bradley–Terry
  logistic over per-species strengths with a min-sample floor (anti-overfit). Trained on 5,000 real
  ladder games (temporal split, humans only). **Measured: 56.6% held-out accuracy vs 49.6% baseline**,
  Brier 0.251 (calibrated) — a real, honest, modest edge from team composition alone, as the domain's
  variance predicts. Ships a `predict` CLI and `tests/test-jolteon.py` (antisymmetry, mirror=50%,
  coverage, range). Model saved to `data/jolteon-weights.json`.
- **Full ladder pulled** — the durable store grew from 1,501 to **5,000 games** (incremental, dedup).

### Notes
- The first training on 1,501 games did **not** beat the baseline; more data (5,000) and a min-sample
  floor were what cleared it. Recorded honestly: this is why the flywheel (more games over time) and
  damage-grounded features (§4.3.1) matter, not species identity alone.
