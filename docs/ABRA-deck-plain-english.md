# ABRA — the plain-English deck

**Version 1.0.0 · 2026-09-24 · Will Hooper**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.

**This edition says one thing: our copy of the game is now right for Reg M-C, so we can start building
the player that uses it. The copy was the foundation. The search is the point.**

---

## Slide 1 — What ABRA is, in four sentences

ABRA is a project to build a program that plays Pokémon Champions doubles well enough to climb the
Showdown ladder.

It plays the current format, Reg M-C, with open team sheets: both players can see each other's six
Pokémon, moves, items and abilities before the battle.

To choose a move, it imagines thousands of possible futures inside its own copy of the game and picks
the choice that holds up best.

So it needs two things: a copy of the game that is exactly right, and a search that uses it well.

---

## Slide 2 — The goal

Get high on the Reg M-C best-of-three ladder, playing on the account `medicham32`.

Showdown staff have approved the account for this.

We will judge it by where its rating settles over many series, never by its best moment. A rating
bounces around a lot on its own, so a peak mostly measures luck.

---

## Slide 3 — Step one is done: the copy of the game is right

Our copy of the game is called MEDICHAM.

For Reg M-C it now passes every test we own against the official Showdown simulator. It computes the
same damage. It plays the same whole games with the same dice and reaches the same board every turn.
Every item, ability and move we can set up on its own behaves the same way.

When all of those tests read clean at once, a gate opens. For Reg M-C that gate opened on 2026-09-24,
and that is what this release (abra/regmc 1.0.0) records.

The one exception we chose on purpose: the Illusion ability, which we do not model yet.

---

## Slide 4 — Why the copy had to come first

If the copy plays a slightly different game, every answer the search gives is a confident answer about
a game nobody is playing. It will not look wrong. It will look like a result.

So nothing built on top of the copy was allowed to publish a number until the copy passed its gate.
That rule held for weeks. It is why this deck has so few numbers about the player: the player's real
tests start now.

---

## Slide 5 — Why Reg M-B is gone from this deck

Until this release, this deck was about the previous format, Reg M-B.

Reg M-B is retired. Its final results stay on record exactly as published, in the 7.0.0 edition.

The new format added new Pokémon, moves and items, and changed a few old ones. So the new results
answer a different question from the old ones. You cannot read "the old number became the new number".
The white paper puts the old and new results side by side and says which ones can be compared. Only
one can: the damage test, which reads perfect in both.

---

## Slide 6 — The idea behind the player

Every turn, both players choose at the same time, without seeing the other's choice.

That is like rock-paper-scissors with a lot more options. In a game like that, always making the same
"best" choice is a mistake, because a good opponent learns it and punishes it. The right answer is a
well-chosen MIX of choices.

So each turn our player builds a table: its own sensible options down the side, the opponent's
sensible options across the top, and in each box, how well that pairing turns out. Then it works out
the mix that is safest against anything the opponent does. That part is called SLOWKING.

---

## Slide 7 — Filling in the table

To fill in a box, the player plays that turn out inside MEDICHAM, and then keeps playing a few turns
further, many times, and sees how it goes. That part is called MILTANK.

Two tricks make this affordable:

- **The same luck for every box.** Each imagined future uses the same dice rolls across every box, so
  the difference between two boxes comes from the choices, not from luck.
- **Spend time where it matters.** Options that are clearly bad stop getting attention early.

It always has an answer ready. If the clock runs short, it solves the table it has, and it writes down
that it had to.

---

## Slide 8 — Keeping the table small

In doubles, each side picks two actions at once, so there are far too many pairings to try them all.

Two models trained on real human games say which options are worth considering. MAG scores each
Pokémon's options. DODUO scores the two together, so it understands teamwork: both attacking the same
target, or one drawing attacks while the other hits.

A few kinds of options always get a seat, such as switching out and mega evolving, because a quick
screen tends to underrate them.

---

## Slide 9 — Guessing what we cannot see

Open team sheets show almost everything. Two things stay hidden: which four of the six the opponent
brought, and how each Pokémon's stats were trained.

XATU keeps a running guess at both. It starts from what real players usually bring and updates every
time something new is seen: a Pokémon switching in, who moved first, how much damage a hit did.

It trusts what it has seen over what the sheet says. If an item has been knocked away, it knows the
item is gone.

---

## Slide 10 — Getting better by playing itself

Playing out imagined futures is slow. Later, a learned judge called PORYGON2 will look at a position
and estimate who is winning, which lets the search consider more options in the same time.

PORYGON2 learns from the player's games against itself. MEW runs those games on a frozen copy of
MEDICHAM. MACHAMP trains each new version and keeps it tied to how humans actually play, so it does
not drift into a game nobody plays.

A new version only replaces the old one if it beats it in a fair, controlled test.

---

## Slide 11 — Taking points from habits, safely

The safe mix does not lose much to anyone, but it also does not take advantage of predictable
opponents.

GARY learns what humans usually do in a given kind of situation. HYPNO then leans toward punishing
those habits — but only a little, and never so far that a clever opponent could exploit the lean. The
starting limit is half a percentage point of win chance per decision.

WOBBUFFET is our own attacker: it studies each version of the player and tries to find a way to beat
it. If it gets better at that from one version to the next, the new version has a hole.

---

## Slide 12 — Before the battle, and during it

**Team preview.** Before each game both players pick four of their six and choose two to lead. CHOMP
treats that as its own table of choices and picks a good mix. CHOMP is being rebuilt inside ABRA; the
old version was built on out-of-date data.

**The live client.** ROTOM connects to Showdown, reads each turn, runs the search and sends the move.
It plays one series at a time, never while one of Will's own accounts could be on the same ladder, and
it keeps careful records of every series.

**The clock.** Each player has seven minutes for the whole game, and a little under one minute for any
single turn. ROTOM budgets the search against both limits, keeps a reserve, and warms up
before the first turn so it is fast from the start.

---

## Slide 13 — Where things stand today

| Piece | Job | Status |
|---|---|---|
| MEDICHAM | the copy of the game | **Certified for Reg M-C** |
| MAG, DODUO | which options are worth trying | first versions built; tested on real games only |
| XATU | guessing what is hidden | first version built; tested on real games only |
| SLOWKING | finding the safe mix | built and tested |
| MILTANK | filling in the table | built; its strength has not been measured on the certified copy |
| PORYGON2, MEW, MACHAMP | the learned judge and the self-play loop | not built |
| GARY, HYPNO, WOBBUFFET | habits, the safe lean, our own attacker | not built |
| CHOMP | team preview | not built |
| ROTOM | the live client | not built |

**Honest status of results.** The models trained on human games have been tested on human games they
never saw, and they predict human choices better than the simpler models they replaced. The search has
played practice matches, but those were played before the copy of the game was certified, so their
results are not reported. They will be re-run on the certified copy first.

---

## Slide 14 — What happens next

1. Re-run the practice matches on the certified copy, with a fair statistical test.
2. Build the part that lets the search decide mid-turn choices, such as which Pokémon to send in after
   a knock-out.
3. Build ROTOM and play practice series on a private server with the real clock.
4. Build CHOMP, then start the first real ladder series.
5. Build the learned judge and the self-play loop, then the safe lean toward human habits.

---

## Slide 15 — Where to read more

The full argument, the maths, every figure with its source, and the side-by-side comparison of Reg
M-B and Reg M-C are in **[the white paper](ABRA-whitepaper.md)**.

The commands to run and check everything are in [the technical documentation](ABRA-technical-docs.md).
