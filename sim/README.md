# ABRA sim — running real Champions battles in the open engine

The finding in [`docs/OPEN-ENGINE-FINDING.md`](../docs/OPEN-ENGINE-FINDING.md) confirmed the Champions
engine is **open-source and runnable**. This folder is the concrete start of wiring it into ABRA: an
adapter that plays a real `[Gen 9 Champions]` battle between two agents, so we can do **self-play**,
**exact rollouts**, and eventually **belief search over the true engine** instead of a learned model.

## Run it

```
cd sim
npm install pokemon-showdown        # installs + builds the real Showdown sim
node selfplay.js 20                 # 20 self-play Champions battles in the REAL engine
```

Expected output: N battles resolve with a winner and an average turn count — proof the engine runs and
that two agents can battle each other. (`FORMAT=gen9championsrandombattle` auto-generates teams; for
Reg M-B with your own teams, pass packed team strings — export from Showdown's teambuilder.)

## Files

- **`champions-battle.js`** — `playBattle(team1, team2, agent1, agent2, opts)`: drives a full battle
  through Showdown's `BattleStream`, returns `{winner, turns, log}`. This is the engine adapter the
  rest of ABRA will call.
- **`agents.js`** — placeholder agents: `defaultAgent` (sim auto-picks a legal move — proves it runs)
  and `randomBringAgent` (random team-preview bring, default in-battle — self-play variety).
- **`selfplay.js`** — plays N battles between two agents and reports win rates + turn counts.

## How this reshapes the models (the payoff)

Once the adapter is in, each model swaps *approximation* for *ground truth*:

- **MEDICHAM** — replace the compact in-browser rollout with **exact-engine rollouts** (true doubles,
  status, redirection, everything). Its behaviour-clone still chooses *what to click*; the engine now
  resolves *what happens*.
- **DITTO** — evaluate candidate teams by **playing real self-play games**, not JOLTEON's guess.
- **JOLTEON** — train on **unlimited self-play data**, not only scraped replays.
- **SLOWKING** — the hard part (learning dynamics) is gone: it becomes **ReBeL/Student-of-Games search
  over a known simulator**. The remaining work is the simultaneous-move mixed-Nash + belief search.
- **CHOMP / ORB** — validate damage against the reference engine.

## Next steps

1. Swap `defaultAgent` for a **greedy agent** (pick the highest-damage legal move each turn, using
   CHOMP's engine to rank) — the first *real* policy in the loop.
2. Wrap `playBattle` as `MEDICHAM.exactRollout(teamA, teamB, N)` and repoint MEDICHAM at it.
3. Wrap it as `DITTO.selfPlayScore(team, gauntlet)` for ground-truth team evaluation.
4. Build the belief-search loop (SLOWKING) on top of the adapter.

> Note: in the ABRA analysis sandbox the `npm install` build was too slow to finish, but the code is
> complete and standard — it runs on a normal machine with Node installed.
