# ABRA — the plan, in plain English

**2026-07-26**

What each model is for, how they fit together, and how they add up to ALAKAZAM. Written to be read
straight through by someone who has never seen the project.

---

## The one-sentence version

**Keep every real game → work out what the game looks like → play it out → judge the result → choose
a move you can't be punished for.**

Everything below is one of those five jobs.

---

## Job 1 — Keep the games, and know which ones are real

**STORE** — every public game, saved forever. Never re-downloaded, never thrown away.

**QUALITY** — the gatekeeper. It decides which games count. **About 87% of what we collect is bots,
rage-quits and stubs**, so this is not a detail — it is the difference between measuring people and
measuring scripts.

> Everything downstream goes through QUALITY. When it has been skipped, the result has always been
> wrong: a "rock-paper-scissors metagame" that vanished on clean data, and a value model trained on
> 61,274 games when only ~2,000 were real.

---

## Job 2 — Work out what the world looks like

These answer *"what am I likely to be facing?"*

**SMOGON PRIORS** — official statistics over a million-plus games: what Pokémon people bring, what
moves and items they run, what natures. Far bigger than anything we could collect ourselves.

**XATU** — *what is the opponent probably running?* You can't see their sets on the normal ladder, so
this turns "Incineroar" into "probably Intimidate, probably Fake Out, probably Sitrus Berry."

**GURU / ROLES** — what kinds of team exist, and which beat which.

> **Honest status:** SMOGON PRIORS is solid. XATU works but its published numbers need regenerating.
> GURU currently finds no clear matchups on clean data — it describes, it does not predict.

---

## Job 3 — Play the game out

**CHAMPIONS_SIM** — the real Pokémon rules. Not our imitation of them: the actual Showdown engine,
pinned to one version, checked move-for-move against an independent damage calculator. **This is the
most trustworthy thing in the project.**

**MEW** — the arena. Runs thousands of games on real teams and writes down what happened.

**MAGNEMITE (MAG)** — the player. Looks at the board and picks a move.

> **Honest status:** the engine is bulletproof. MEW is solid. **MAG is a starting position, not a good
> player** — a bot built purely to counter it beats it 63% of the time.

---

## Job 4 — Judge how good a position is

**PORY** — you're mid-battle. Are you winning? You can't search to the end of a game, so something has
to look at a board and say "you're 70% here."

> **Honest status:** currently loses to simply counting how many Pokémon are alive and how healthy
> they are. It needs retraining on clean games. Until then, *the counting is the honest evaluator* —
> and that is not a joke, it genuinely scores better.

---

## Job 5 — Choose, without being readable

**CHOMP** — which four to bring, which two to lead.

**SLOWKING** — the part people skip. In this game there is often no single best answer, and a player
who always picks their favourite becomes **predictable, and therefore beatable**. SLOWKING works out
what *mixture* to play so nobody can read you.

> **This is not theory.** A bot built only to counter MAG beats it 63%, precisely because MAG always
> picks its top-scoring move. Predictability is the vulnerability.

> **Honest status:** the mathematics is sound. It currently has nothing useful to chew on, because
> the clean matchup data shows no clear structure yet.

---

## How they add up to ALAKAZAM

ALAKAZAM is not a new model. **It is the five jobs wired together into one decision.**

Faced with a turn:

| step | who does it | question answered |
|---|---|---|
| 1 | **MAG** | which handful of moves are even worth considering? |
| 2 | **XATU** | what might they be about to do? |
| 3 | **CHAMPIONS_SIM** | play each combination out — what board results? |
| 4 | **PORY** | how good is each resulting board? |
| 5 | **SLOWKING** | given those scores, what mix do I play so I can't be read? |

Then it rolls the dice on that mix and clicks.

**Every piece exists today.** None of them is good enough yet, and two of them (PORY, SLOWKING) have
no usable input. That is the whole gap.

---

## Why MAG doesn't need to be good

This is the part that reframes everything.

A turn in doubles has hundreds of possible combinations, and it compounds every turn. You cannot
score them all. Something has to say *"these six are worth looking at."*

**That is MAG's real job** — and for narrowing a list, a mediocre player is fine. It only has to avoid
missing good moves, not pick the best one.

So MAG being flawed is not the problem it appears to be. Building it *as a player* was the mistake.

---

## How this becomes "solved"

**"Solved" does not mean "makes good moves."** In a game like this — two players choosing at the same
time, neither seeing the other's hand — it means **you cannot be exploited**. Someone who knows your
entire strategy still can't beat you by much.

The measurement is **exploitability**: build a bot whose only purpose is to beat ours, and see how
badly it wins.

- We ran it. A counter beat MAG **63%**. So today: *plays okay, easily read.*
- When a counter can't beat it any more, we are approaching *solved*.

### The loop that gets us there

1. Play a lot of games against **our own current best** — not a fixed weak bot, or you just learn to
   beat one thing
2. Learn from **which games were won**, not from copying people
3. Every so often, **try to break it** and measure how easy that is
4. Repeat until breaking it gets hard

Step 2 is the one that matters most, and the reason is measured: **copying people caps you at people.**
When we optimised the same model for *winning* instead of for *imitating*, it immediately became
stronger — the winner barely cares about type effectiveness and cares enormously about not wasting a
turn and finishing things off.

### And the honest bar

Our own bots grading each other can never prove competence. Two outside scoreboards can:

- **the Bo3 open-team-sheet ladder** — real opponents, and the guessing problem doesn't exist there
  because you can see their team. We already collect these games hourly.
- **VGC-Bench** — published results from other people's agents on that same format.

---

## What has to happen next, in order

1. **Regenerate the 28 stale artifacts** — nothing built on them can be trusted
2. **Teach MAG damage and KOs** — it currently cannot tell whether a move kills, which is most of what
   a turn is about
3. **Let it consider both Pokémon together** — it currently decides them separately, so it double-hits
   one target about half the time where people do it under a quarter
4. **Let it decide switches** — currently a coin flip
5. **Wire the five jobs into one decision, with a mixture rather than a favourite**
6. **Retrain PORY on clean games** — step 5 needs a position judge
7. **Measure exploitability again.** That number is the scoreboard
8. **Play the open-sheet ladder** — the first honest outside test

---

## The shortest honest summary

**What is genuinely strong:** the game data is trustworthy and we can prove which parts are not; the
engine is exact; and the project can now audit its own claims.

**What is not:** every model that plays. None of them has been shown to play well against anything
other than a worse version of itself.

**The plan is to close that gap by playing, not by copying** — and to keep measuring how easily we can
be beaten, because that is the only number that cannot be faked.
