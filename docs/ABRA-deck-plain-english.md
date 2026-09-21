# ABRA — the plain-English deck

**Version 7.0.0 · 2026-09-20 · Will Hooper**

**This edition publishes one result, and it is the one this project has been withholding for six
weeks: our copy of the game now plays the same game as the real one, on every test we own.**

---

## Slide 1 — What ABRA is, in four sentences

ABRA watches public Pokémon matches, works out what people in this format actually bring and
actually click, and tries to find good decisions.

To do that it needs its own copy of the game — a simulator it can play thousands of imagined
futures inside, far faster than the real server could ever run them.

Every answer ABRA gives is a search through that copy.

So the copy has to be right, and that is the only thing this edition is about.

---

## Slide 2 — Why the copy being right is the whole project

A search is worth exactly what its model is worth.

If our simulator plays a slightly different game from the real one, then every number built on top
of it is a confident answer about a game nobody is playing. It will not look wrong. It will look
like a result.

That is why almost everything else here has been deliberately blank for weeks. Not hedged, not
printed with a warning label beside it — blank. A warning label next to a number is still a number,
and people quote it anyway.

---

## Slide 3 — How we test it

The official site people actually play on is Pokémon Showdown, and its code is the rulebook. We
treat it as the authority and our own simulator as the thing on trial.

The test:

- take real teams from real recorded matches, frozen in place so the ground cannot move under the
  measurement;
- play the same game twice — once through the official engine, once through ours;
- force both to draw from the same dice, so any disagreement has to be a rule and cannot be luck;
- stop at the end of every turn and compare the two boards, piece by piece: who is out, how hurt,
  what is poisoned, what is boosted, what the weather is, what is stuck where.

If the two boards ever differ, our simulator is wrong. Not "arguably different" — wrong.

---

## Slide 4 — The headline

**On 7,182 games, the two engines end every single turn with the same board.** The run drew a far
wider sample than the routine check uses; 7,182 of the games it drew were playable, and not one was
thrown away to flatter the score. The release it was measured on, and the steps that got there, are
recorded in CHANGELOG 6.83.0.

The readout, straight out of the file it was written to:

```
data/verification/game-differential.g12000.json
  games requested ............................... 12,000
  games played through both engines .............. 7,182
  games where the boards ever differed ................ 0
  turn boundaries compared ...................... 79,715
  turn boundaries where the boards matched ...... 79,715
  games where only the running text differed ......... 75
```

This is a fresh and much larger draw than the batches the repairs were aimed at — the games in it
were not the games anybody was fixing. That matters, because a perfect score on the sample you
worked from is not evidence of much.

The honest caveat from the same run: in about one per cent of those games the two engines describe
something differently in their running text while the board stays identical. Commentary is a
separate bar here, and on the batches the project gates on, it reads zero as well.

---

## Slide 5 — It took one day, and it went in steps

Over 2026-09-20 the count of games whose boards ever parted went **34 to 15 to 9 to 1 to 0** on that
same wide draw, as each repair landed. The steps are recorded in CHANGELOG 6.83.0.

Each one was a real rule our simulator had slightly wrong, found by asking what the official engine
does that we did not. None of them was a tuning knob.

---

## Slide 6 — Damage agrees too, at every corner

Damage in this game is a range, not a number. The same attack rolls a little high or a little low.
It is not enough for the middle of our range to match: the top, the bottom and every step between
have to match, or a Pokémon survives on our side and faints on theirs.

We compare thousands of attacks head to head against the official calculation at every point of
that roll. The count of disagreements is **0 of 6000** (`data/engine-diff.json`).

---

## Slide 7 — And every mechanic anybody actually plays

The games above tell you whether the simulator is right about what people brought. They say nothing
about a mechanic nobody happened to use that week.

So there is a second, separate lab: one deliberately built situation per mechanic, staged on purpose
and compared with the official engine one at a time. It reads **1004 probed, 1004 live, 0 missing**
(`data/mechanics-census.json`). Nothing in scope is going untested because nobody thought to look
at it.

---

## Slide 8 — The gate now says OPEN

ABRA has a gate: a program that decides for itself whether the simulator may be trusted. It is ten
separate checks, and it is a gate rather than a report. All of them have to pass, and it names the
one that is failing when one is.

It has been shut since early August. It now reads **OPEN**.

That is what makes this a major release rather than a better number. Everything downstream of the
simulator stops being blocked at once.

---

## Slide 9 — What zero does NOT mean

**A zero is a statement about what was measured.** It is not a statement about what was not.

- **One ability is deliberately not modelled.** There is an ability that disguises the Pokémon
  carrying it as a different one, so the board you can see is a lie until the disguise breaks. We do
  not simulate the lie. In the frozen sample of real matches, about three teams in every hundred had
  a Pokémon that could do it, and roughly half of those actually brought it. It is a declared
  exclusion, written down in advance, not an oversight.
- **Closed team sheets are out of scope.** Our measurements are taken where both teams are published
  up front. Guessing at a hidden team is a different problem and we have not claimed it.
- **Best-of-one ladder play is out of scope** for the same reason.
- **Seven readings of "what move did that Pokémon last use" still disagree.** The official engine
  and ours answer that question differently in a small number of live cases. It is real, it is
  written down, and it is not fixed.

**And zero is not the same as finished:** it means that nothing we currently know how to ask has
found a difference, which is a statement about our questions as much as about the simulator.

---

## Slide 10 — What we still will not tell you

The number this project is ultimately judged on is not on this page. It is whether the model is
honest about its own confidence: when it says it is winning nine times out of ten, does it win nine
times out of ten.

That measurement runs through the simulator, so it has been withheld for weeks. The gate opening
does not make it true. It makes it **runnable**. We have not run it, so we are not printing it, and
a placeholder with a caveat beside it is exactly what we refuse to do.

Every model result that reads a simulated game is in the same position: unblocked, not re-run, not
quoted here.

---

## Slide 11 — Why the numbers from the last edition are gone

The previous edition of this deck led with a much smaller sample and a gate that was shut. Those
figures are not reprinted here with a note attached. They have been **deleted**.

They were not wrong when they were written. They answered a question we no longer ask: a single
batch of games rather than a wide held-out draw, and an engine that has changed underneath them
since. Old and new cannot be honestly lined up, which is what makes this a major release rather
than an update.

The rule this project runs on: a superseded number is removed, never captioned. Captions get
skimmed. We have paid for that twice.

---

## Slide 12 — Where the detail lives

- The technical account, with the method, the maths and the confidence intervals:
  [the ABRA white paper](ABRA-whitepaper.md).
- The running log of every individual change between major releases:
  [the running notes](RUNNING-NOTES.md).
- The current state of the project is never typed. It is printed: `node engine/status.js`.
