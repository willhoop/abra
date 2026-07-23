# ABRA — the deck

### The Pokémon that reads the whole ladder

**Version 1.0 · Last updated 2026-07-22**
**Will Hooper**

> Plain words only. The math and sources live in the [white paper](ABRA-whitepaper.md).

---

## Slide 1 — What ABRA is

**A program that watches thousands of real Pokémon games and learns what everyone is playing.**

It reads public battle replays from Pokémon Showdown — the Champions Reg M-B ladder — and turns them
into a live picture of the metagame. Then it hands that picture to CHOMP.

---

## Slide 2 — CHOMP and ABRA are a team

- **CHOMP** picks your four and your lead in the 30 seconds before a battle.
- **ABRA** tells CHOMP what the ladder actually brings, so those picks are based on reality.

Two separate programs, one loop. CHOMP is the hands; ABRA is the eyes.

---

## Slide 3 — Why this matters

To choose your four well, you need to know what your opponent will bring. A static usage list from a
website is weeks old and averaged over everyone. ABRA reads the *current* ladder and updates itself.

---

## Slide 4 — It reads thousands of games, fast

The replay site lets anyone download public games. ABRA grabs them in parallel — about **200 games a
second** — so the last few thousand games ingest in under a minute.

There are roughly **5,000** recent public games available at any moment, and new ones upload
constantly.

---

## Slide 5 — The one rule that saves us from ever redoing it

**Store everything, decide later.**

For every game, ABRA saves *all* the facts — both teams, what each side actually brought, what they
led, the moves and items we saw, who won, both players' ratings, and whether a player was a bot.

Because everything is stored, any question — "show me only strong players," "hide the bots," "just my
games" — is answered instantly from the saved data. **We never have to download the games again.**

---

## Slide 6 — Bots and rating

The ladder has automated **bot** accounts mixed in with real people. ABRA flags them. It also saves
each player's rating. So you can look at the *whole* ladder, or *only humans above 1300*, or anything
in between — your choice, no re-downloading.

That filter matters: at high ladder the picture sharpens — the top threats show up on half of all
teams, and some win far more than others.

---

## Slide 7 — Keeping your games separate

Your own games are just a filter: any game with your Showdown name. So ABRA can show you the whole
ladder **and** your personal record from the same pile of data.

Changed your Showdown name? Add the new name to a short list once. Nothing is lost, nothing re-pulled.
No accounts, ever.

---

## Slide 8 — It works for anyone

The ladder picture belongs to everyone. Your personal view is just your name. So a friend points ABRA
at their own name and gets their own analysis from the same shared data. One tool, many users, no
sign-ups.

---

## Slide 9 — It runs itself

A scheduled job in the cloud wakes up every hour, grabs the newest games, updates the model, and saves
it. You don't run anything. The picture stays current on its own — and because CHOMP updates itself
too, your live plugin quietly gets smarter while you play.

---

## Slide 10 — Honest limits

- A Pokémon that never attacked in a replay tells us nothing about its moves — so what we know about
  each set is partial.
- These are **descriptions** of what people play, not a prediction of who wins.
- Low-ladder and bot games look different from strong play — which is exactly why we tag them and let
  you choose.

---

## Slide 11 — Read more

**The white paper** — the data model, the ingest, the math, the sources:
**[ABRA-whitepaper.md](ABRA-whitepaper.md)**

**The technical documentation** — how to run and extend it:
**[ABRA-technical-docs.md](ABRA-technical-docs.md)**

**The changelog** — what changed and why:
**[CHANGELOG.md](../CHANGELOG.md)**
