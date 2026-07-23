# KADABRA — Coach Product Spec

### Key Analysis of Decisions, Advice & Better Replay Annotation

**Version 0.1 (spec) · 2026-07-22 · Will Hooper**

> The interactive coaching front-end of the ABRA platform. ABRA collects and models the ladder;
> **KADABRA is the psychic that shows it back to you** — it walks you through your own game turn by
> turn, recreates each scene, tells you the better play, and answers your questions before you move
> on. Abra → Kadabra: the data platform's teaching evolution.

---

## 1. What it is

A **chatbot coach** for a single Champions replay. You paste a replay link; KADABRA reviews the game
*with* you, one decision at a time. It is not a wall-of-text report (that is the `coach.js` summary).
It is a conversation that stops at each meaningful turn, **reconstructs the scene**, evaluates your
play against the models, and waits for your questions before advancing.

It replaces "send Claude a link and have it watch the game" with a purpose-built, instant, repeatable
tool — and every game you review is silently added to ABRA's database and folded into the model
(the flywheel, from the coaching seat).

## 2. The core loop (per turn)

1. **Reconstruct the scene.** From the parsed log, KADABRA rebuilds the board at this turn: the two
   active Pokémon per side, HP bars, status, stat stages, weather/terrain/screens, and what is known
   of each team. It *shows* this, not just describes it — a rendered board state, so you see the
   scenario the way it looked in-game.
2. **State what happened.** "You led Pelipper + Swampert into Gengar + Hydrapple; rain is up; Gengar
   mega'd and put Swampert to sleep."
3. **Evaluate the decision.** KADABRA compares the move you made against the model's recommended play
   (see §4), with the reason: the damage math (CHOMP), the threat read (ABRA usage), and — when
   available — the deeper line (SLOWKING).
4. **Answer your questions.** You can ask anything — "why not Protect?", "would Ice Beam have KO'd?",
   "what if they didn't switch?" — and KADABRA answers from the same models, running the damage calc
   or a rollout on demand.
5. **Advance on your say-so.** Only when you're ready does it move to the next decision point. You
   control the pace; it never dumps the whole game at once.

## 3. Scene reconstruction

The parser (`engine/durable-ingest.js` / `engine/coach.js`) already reconstructs the full state
progression from the protocol log — switches, moves, damage, faints, field changes. KADABRA renders
that state at any turn as a simple board: two active slots per side with sprite, HP %, status chip,
and a field banner (weather/terrain/Trick Room/Tailwind). Because the whole trajectory is
reconstructable, the player can also scrub — "show me turn 5" — and KADABRA redraws that scene.

## 4. The advice — where the models plug in

"The correct play might have been…" is answered at the fidelity available:

- **Now (v1).** CHOMP's exact damage engine gives the KO math for every option (pKO across 16 rolls,
  speed order), and ABRA's usage model gives the opponent read (their likely set/lead). Together these
  already justify most coaching calls — "Wave Crash OHKOs their Garchomp in rain; you clicked Protect
  and gave them a free turn."
- **Later (roadmap).** **SLOWKING** (the learned belief-search solver, simulator white paper §5)
  supplies the deep line — the equilibrium-aware best move accounting for what the opponent might do —
  and **MEDICHAM** rollouts answer "what if" branches. KADABRA's advice quality rises as those models
  come online, with no change to the interface.

KADABRA is a **consumer** of the models (MEDICHAM, JOLTEON, SLOWKING) and of CHOMP, not a model itself.

## 5. The background job — the flywheel from the coaching seat

Every replay KADABRA reviews is passed through the ABRA extractor and appended to
`data/games.ladder.jsonl` (dedup by id). So a coaching session is also a data-collection event: the
opponent's team, sets revealed, and result enter the store and improve the models — exactly the
feed-back stage of the flywheel, triggered by the act of reviewing your own game.

## 6. Interface

A single conversational panel: the reconstructed scene on top, the coach's message below, a text box
for your questions, and a "next decision →" control. Optionally a side rail with the turn timeline so
you can jump around. Web-based, so it can live alongside the ABRA dashboard.

## 7. Honest status and scope

- **Buildable now:** the parser, scene reconstruction, CHOMP-based advice, the Q&A loop over damage
  math, and the background ingest. This is a real v1.
- **Roadmap:** the *depth* of "the correct play" scales with SLOWKING and JOLTEON; until then advice is
  grounded in exact damage + usage, which is honest and already strong, but single-ply.
- **Own project?** KADABRA is a distinct product (its own app and, when built, its own repository and
  full doc set), connected to ABRA (data/models) and CHOMP (damage). It is specced here inside ABRA
  because it is the platform's front-end; it graduates to its own project folder when we build it.

## 8. The named cast (so the pipeline is legible)

| Name | Pokémon | Role |
|---|---|---|
| **ABRA** | Abra | collects live ladder games, stores + models them |
| **JOLTEON** | Jolteon (fastest) | instant team-vs-team win probability |
| **MEDICHAM** | Medicham (medium) | quick physics rollouts |
| **SLOWKING** | Slowking (slow, wise) | deep learned belief-search game solver |
| **DITTO** | Ditto | team optimiser vs the meta |
| **CHOMP** | Garchomp | the bring-4 / lead-2 engine (exact damage) |
| **KADABRA** | Kadabra | the coach — reviews your games and teaches |

---

**Related.** [ABRA white paper](ABRA-whitepaper.md) · [Simulator white paper](ABRA-simulator-whitepaper.md) ·
[Executive summary](EXECUTIVE-SUMMARY.md)
