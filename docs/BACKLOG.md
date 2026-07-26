# ABRA — backlog

## TERMS

**Set** — everything about one Pokémon other than which Pokémon it is: its four **moves**, its
**item**, its **ability**, its **nature**, and its **EV spread**. Standard VGC usage, and the reason
this document says "set" rather than listing those five things every time. "Incineroar's set" is a
complete answer to *what is that Incineroar running*.

**Locked vs flex slots.** Measured from Smogon, most Pokémon have very little genuinely open. Only
the flex slots are worth varying in an experiment:

| species | locked (>=85% of sets) | genuinely open |
| --- | --- | --- |
| Incineroar | Fake Out 100%, Parting Shot 95%, Flare Blitz 91% | **1 slot** — Throat Chop 51% / Darkest Lariat 31% / Protect 12% / Will-O-Wisp 5% |
| Whimsicott | Tailwind 99%, Moonblast 92% | **2 slots** |
| Garchomp | Dragon Claw 92% | **3 slots** |

So "test every set" is smaller than it sounds. For Incineroar it is four candidates for one slot,
not a free choice of four moves from a learnset.

**Gauntlet** — the fixed list of opponent teams every build is tested against. Same teams, same
order, same seeds for every build, so the comparison is paired and the matchup difficulty cancels.

**Points** — percentage points of win rate. A build at 53% against one at 50% differs by 3 points.
Halving the difference you want to detect roughly quadruples the games required.

---

What is known-available and not yet used, and what the project is ultimately for. Kept short and
concrete: anything here should be actionable without re-deriving why.

---

## THE END GOAL

**ALAKAZAM climbs the real ladder, high. That is the proof.**

A person should also be able to sit down and play it — but the ladder is the *test*, and it is the
right one for a reason worth stating: **it is the only measure in this project that self-play cannot
fake.** Every internal number can be gamed by a bot that gets good at beating itself. Ladder rating
is external, adversarial, and measured by people trying to win.

It is also, precisely, the transfer test at full scale. A model that has overfit to its own play
will climb to a plateau and stop; one that has learned Pokemon will keep going.

Honest about the bar: VGC-Bench beat a professional **on a single fixed team** and degraded as team
variety rose. The PokeAgent Challenge (NeurIPS 2025, 100+ teams) concludes the general problem is
**unsolved**, with large gaps between LLM agents, RL agents, and strong humans. So "stupidly high"
is a research-grade target, not an engineering one — and the fixed-team scoping in
`docs/THEORY.md` §5 is the version that is actually reachable first.

What it requires that we do not have:
  - a policy that decides in **real time**, at human pace
  - a Showdown connection — a bot account or custom client. `web/replay.html` already proves we
    speak the protocol in one direction
  - **ladder discipline**: a rating is only meaningful over hundreds of games, and every one is
    public and permanent

Everything below is scaffolding for that. When a decision is ambiguous, the question is which option
moves a real rating.

---

## SMOGON DATA — parsed and available, not yet used

All of this is already downloaded monthly by `.github/workflows/smogon-stats.yml` and parsed by
`engine/smogon_priors.js`. Nothing here needs new collection; it needs wiring.

| data | what it gives | what it would replace |
| --- | --- | --- |
| **Checks and Counters** | per species, what beats it, with a win rate, a **95% interval**, and how the matchup ends (KOed% / switched%) | GURU's own archetype matrix, which finds **zero** decisive matchups on ~1,700 clean games. Smogon computes the same thing over 1.16M battles and ships the interval with it. |
| **Teammates** (full list) | partner frequency as points above/below chance — e.g. Garchomp + Whimsicott **+42.0** | the k-means archetype clustering, which is capped at K≈6 by sample size and scores silhouette 0.114 (essentially no structure) |
| **Viability Ceiling** | highest GXE any team using that species reached | nothing — this is new information, a skill-ceiling signal per species |
| **Raw vs Real counts** | Raw = teams containing it, Real = battles it actually appeared in. Ratio ≈ how often it is BROUGHT | our own bring rates, which are conditioned on what a replay revealed |
| **Spreads** | nature + EV distribution per species | already used for spreads; **not** yet used to model what a spread implies about role |
| **Mega formes as separate species** | the stone rate, and the X/Y split | **now wired** (`megaInfo`), listed here as the precedent for the rest |

**Why this matters more than it looks.** Their sample is 1,163,315 battles, computed server-side over
every team played. Ours is ~1,700 clean replays, uploaded voluntarily, and only shows what a battle
revealed. For anything about *what teams look like*, Smogon is strictly better and we should stop
deriving it ourselves. For *per-turn behaviour*, they publish nothing and our store is the only
source. The two answer different questions; neither replaces the other.

**Caveat to carry forward:** the cutoff files are weightings, not filters. All four report the same
1,163,315 battles; the average weight falls from 1.000 (cutoff 0) to 0.078 (1630) to 0.004 (1760).
So the *effective* sample at 1760 is ~4,650 battles — barely larger than our own store, and noisy.
Default to 1630 (~91,000 effective) and never quote 1760 as authoritative.

---

## REMAINING WORK ON THE GENERATOR

Ordered by what blocks what.

1. **Set diversity, RE-SCOPED — smaller and more specific than first reported.**

   The realism report showed 23 distinct sets per species against 51 real, and that was called the
   largest remaining gap. It was mostly a measurement artifact. Two confounds, both inflating the
   real side: real games reveal FEWER moves per set (1.40 of 4 against our 1.83), so more partial
   views of the SAME set count as distinct; and real supplies 4.6x more sets (114,670 against
   24,822), and distinct-counts grow with sample size mechanically.

   Compared fairly — fully-revealed sets only, equal sample size per species — it is **9.8 against
   13.0**, a 25% gap rather than 55%.

   And it is concentrated exactly where the locked/flex structure predicts. Pokemon whose sets are
   locked already match: Rotom-Wash 12 v 12, Corviknight 14 v 15, Politoed 10 v 8 (ours is MORE
   varied). The gap lives in species with several genuinely open slots: Garchomp 14 v 35 (three open
   slots), Toxapex 4 v 11.

   So the fix is not "make everything more varied" — most Pokemon do not run varied movesets and
   ours are right.

   **The stated cause was then tested and is WRONG.** The claim was that our candidate pool is too
   thin. Measured: the correlation between our pool size and the diversity gap is **0.04** over 28
   species — none. Every species has ~7.8 candidates, Rotom-Wash and Garchomp alike, and Rotom-Wash
   has no gap. Pool size is not the mechanism.

   What IS measurable, on the same 28 species: we produce the single most common set **48%** of the
   time against a real **44%**, and the excess is concentrated exactly where the gap is —
   Toxapex +18 points, Whimsicott +15, Garchomp +11, Kingambit **-2** (we are slightly more varied
   than reality). It is mode collapse in the sampler, not a missing pool.

   There is also a **floor** on how well this can ever be fixed, now quantified. Smogon lists moves
   individually to about 1% and buckets the rest as "Other", which runs 15-20% for nearly every
   species. Since a set is four moves, `1 - (1 - other/400)^4` says **~17% of real sets contain a
   move no prior of ours can propose**. Kingambit is the exception at 3%. Reported by
   `engine/set_space.js`; do not chase the last few points of diversity without accounting for it.
2. **Megas at 74% against a real 93%.** The remaining gap is the bring policy: the stone-holder is
   often not among the four brought. Real players bring their mega.
3. **The scoring bot.** Two gaps are not fixable by tuning priors — super-effective moves at 10.8%
   against 23.4%, failed moves at 8.7% against 2.7%. Those are what "does not read the board" looks
   like as numbers. It is also what makes `build_lab` trustworthy, since today it measures what beats
   *bad* play.
4. **Head-to-head gate.** New bot versus old, a few thousand games. If an iteration does not beat the
   previous one above chance, stop and find out why rather than looping on a broken crank.
5. **The transfer test** — train on self-play, evaluate on real games. Never completed. The only
   check in the project that is not self-referential.

---

## VERIFICATION OWED

- **July's Smogon data flowing in end to end.** The month auto-detects (`latestMonth()` scans the
  directory) and no month is hardcoded, but this has not been run against a genuinely new month.
- **The forme audit is done for the families we have seen** (mega naming, Sinistcha, Maushold,
  Vivillon, Floette-Eternal). It should be re-run whenever a new regulation adds formes, because the
  failure is silent: a name that matches nothing produces an empty moveset, not an error.
