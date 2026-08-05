# ABRA HANDOFF — 2026-08-04, the session R4 decided

> **ARCHIVED 2026-08-05 — PROVENANCE RECORD, NOT CURRENT STATE.**
> Kept because the trail is the evidence: what was believed, when, and what broke it.
> Do not take a number out of this file. `node engine/status.js` is the state.
>
> - **Claimed:** that R4 decided — MILTANK takes 55.5% of 535 decisive pairs against MAG, log-likelihood 3.00 against a 2.94 bound, accept H1.
> - **Written:** 2026-08-04, CHANGELOG at 3.3x.
> - **Replaced by:** `data/rollout-r4.json`, written by `engine/rollout_r4.js`, which is the artifact this document was remembering. `engine/status.js` prints its verdict from that file.
> - **Retracted inside:** One count, and it is a factor of two. This document calls the run **5,248 games**. That is the LINE count of `data/games.r4-decided.jsonl`, and the store writes a log-only companion record under the same id, so it double-counts every game: the run is **2,624 games = 1,312 seed pairs**, of which **535 pairs were decisive**. The 55.5% itself reproduces and is the SPRT verdict — but it is **stopped at a boundary**, so the point estimate is biased high and any fixed-n confidence interval printed beside it is context, not inference. The run is also classed PRE-CHANGE: `engine/medicham2-browser.js` moved at 04:47 and the games were played at 04:41, so it measures a build that no longer exists.

---

Paste this into a new session. Written to be read by someone with no memory of the night.
Supersedes nothing: `docs/archive/HANDOFF-2026-08-04.md` is the handoff this session *received*.

---

## 0. THE ONE THING THAT CHANGED

**R4 DECIDED. MILTANK is measurably stronger than MAG.**

```
535 decisive pairs · MILTANK takes 55.5% · log-likelihood 3.00 vs a 2.94 bound
==> Accept H1 at alpha=0.05.       data/games.r4-decided.jsonl  (5,248 games)
```

The pre-fix baseline on the **broken** engine was **−0.28** — drifting toward *no better*. Same
search, same flags, same everything. The only change was the model.

**That is the result to build on: a search is worth exactly what its model is worth.** Closing
MEDICHAM's gaps now has a measured return rather than a hoped-for one.

Do NOT quote R4 as "the bot is good". It says the SEARCH beats the fitted policy, at
`--miltank-n 30`, with uniform-random playout opponents, and with the preview search disabled
(sheets arrive after preview inside `mew`). It is a floor, not a description.

---

## 1. HARD RULES — from Will, not negotiable

- **Never `git add -A` or `git add -u`.** The ingest churns `archetypes.json`, `kad-replays.js`,
  `live.js`, `conformance.json`. Add by name. Violated once this session and backed out.
- `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` is required for almost everything.
- `fit_policy.js` / `fit_joint.js` need `node --max-old-space-size=4096`.
- **6 processes max.** Ask before running wide while he is at the keyboard.
- **Never edit `board.js`, `magnemite.js` or `engine-data.js` while a fit or self-play run is in
  flight.** And **never restart the live bot mid-battle** — it forfeits his game. I did it once.
- **A REFIT INVALIDATES SEVEN ARTIFACTS**: counterplay, winrate-backtest, opponent-calibration,
  weight-multiplicity, then the mag/mew/scoreboard bundles. `provenance.js` now DERIVES this — it
  tracks engine code as an artifact input, so those seven flag themselves.
- A restamp is only valid when the feature FUNCTION is unchanged. If `board.js` or the damage table
  changed, **REFIT**.
- **MEASURE THE NOISE FLOOR** before believing any effect. **CHECK THE CORPUS STAMPS** before
  attributing an effect to a lever.
- **SPRT-gate every H2H and read it AS IT GOES.** Levers are PER ARM. Arm 1 is the challenger.
- **No hardcodes** — derive from handlers and artifacts. A boolean is not a parameter.
- OTS only: games without open team sheets are thrown out; OTS games are recorded and the replay
  auto-published to `data/live-games/replays.txt`.
- Password lives in `data/.showdown-pass` (gitignored). **Never type it into a command.**

---

## 2. RUNNING RIGHT NOW

| | |
|---|---|
| **MAGABRA** | `wss://sim3.psim.us`, `--miltank --rollout-n 120 --meta-teams 0.08 --trash --trace --port 8111` |
| **A/B in flight** | 6 shards, `--miltank-foe prior` vs uniform → `data/.mew-shards/foe-s*.jsonl` |
| Head-to-head vs Will | ~15–4 to Will. He is deliberately playing unfamiliar teams — **do not read it as strength.** |

Read a run: `node engine/sprt.js <file>`. Combine shards by `cat`-ing them first.

**MAGABRA is LOCKED on Showdown** (`!magabra` in PMs). It can battle and save replays but **cannot
chat**, so `--trash` is wired and silently dropped. Not a code bug — a flagged-IP account lock.

---

## 3. THE CAST

| Name | What it is |
|---|---|
| **MEDICHAM** | `medicham2-browser.js` — fast approximate battle engine, ~1.7 ms a full game. Everything MILTANK believes comes from here. |
| **MAG** | `magnemite.js` — fitted linear policy over 58 `board.js` features, trained to predict what a HUMAN clicks. Imitates. |
| **MILTANK** | `miltank.js` — the SEARCH player. Plays positions out, takes the line that wins most. Named by Will after the classic Rollout user. See `docs/MILTANK.md`. |
| **board.js** | a position → 58 numbers. MAG's eyes. Computes damage THROUGH MEDICHAM, so damage bugs reach MAG and force a refit. |
| **MEW** | `mew.js` — self-play factory and the **only** harness that can run a controlled A/B. |
| **abra-tags** | Will's rulebook: 172 tags over every move/ability/item. **The knowledge is complete; the implementation is not.** |

MILTANK makes three decisions: **bring/lead** (90 brings played out against the opponent's sheet),
**both clicks each turn** (successive halving), **post-KO replacement**. It defers to MAG only when
the finalists sit inside one standard error — a wider band near the ceiling.

---

## 4. INSTRUMENTS BUILT THIS SESSION

| File | Question |
|---|---|
| `tests/test-mechanics.js` | does the engine actually DO this? 54 probed, **42 live, 12 missing** |
| `tests/walk_tags.js` | every tag vs Showdown — the tag says WHAT, Showdown says what SHOULD happen |
| `tests/test-engine-diff.js` | MEDICHAM vs Showdown on real matchups; finds bugs nobody imagined |
| `tests/mechanics_rank.js` | which unread tag costs the most, by corpus usage |
| `tests/mechanics_surface.js` | upper bound on what is unwired — **weak, over-reports, and says so** |

`data/mechanics-census.json` holds the count. **`live` must never go down.**

---

## 5. STILL OPEN

**Confirmed missing (census):** Lightning Rod · Tri Attack · White Herb · Cursed Body · Facade ·
Feint through Protect · Giga Impact recharge · Avalanche · Gyro Ball · Belly Drum · Ice Scales ·
Unnerve

**Found by the differential tester, not yet in the census:** Freeze-Dry (deals *less* than Ice Beam
into Water — the move's whole identity) · Haze · Friend Guard · Poison Touch · Gigaton Hammer ·
Expanding Force · Marvel Scale · Disguise

**Structural:**
- **Leaf calibration** — reads 100% and loses, reads 1% and wins. Every MILTANK decision is an
  argmax over these numbers. `backtest_winrate.js` asks exactly this and has never been pointed at
  the current leaf. **Biggest remaining bug.**
- **Opponent model** — playouts use uniform-random moves. Real Charizard clicks Protect 60.6%, not
  25%. `--miltank-foe prior` exists; the A/B is running.
- **Which mega to take** — currently "the lead keeps it", an arbitrary tiebreak. Should be a search
  decision; only two-stone brings would branch. "Biggest stat gain" was measured and DISCARDED
  (every Champions mega is +101 to +104).
- **Team quality** — `--meta-teams` gives 169 teams, but the base filter is COMPLETENESS not quality.
- **118 of 172 tags unprobed.**

---

## 6. LESSONS THAT COST HOURS

1. **A silent default looks exactly like a working feature.** The lead search never ran in a real
   game across FOUR layers of bug, each found only because the fallback announced itself. The
   post-KO search logged every turn and never once decided. **Make every fallback loud.**
2. **Search amplifies model error.** A maximiser seeks the lines its model is most optimistic about
   — which are the ones it is most wrong about. This is why R4 was negative on the broken engine.
3. **Usage counts are SHEET counts.** Blaze reads 4,585 and is nearly worthless — 30 of 54 entries
   are a Charizard that megas into Drought turn one. Ice Scales, Filter, Aerilate, Prism Armor,
   Punk Rock and Ripen all have **0 uses**; a stretch of work went into them before Will said so.
4. **Every derivation over-matches on the first try.** `refusesStatusMoves` caught Telepathy and
   Wonder Guard; `speedOnItemLoss` caught Sticky Hold; `failsIfTargetNotAttacking` caught Quick
   Guard, Wide Guard and Round. **Print what a new tag matched before wiring it.**
5. **My own probes were wrong ~15 times, always toward a comfortable answer.** A Corviknight ally
   immune to the Earthquake being blocked; a Garchomp that died before it could freeze; a probe that
   applied the status itself then asserted it; a "plain" Basculegion already holding a Choice Scarf.
   **Clear the control explicitly. Test the outcome, not the classification. Identical results
   across a varied knob mean the knob is unwired.**
6. **Will's domain knowledge beat the data repeatedly** — Blaze/mega, Gardevoir-is-Trace,
   Contrary-Staraptor, "Meganium needs the mega", "reality is not a 1/4 split for all moves". When
   he says a number looks wrong, **check it before defending it.**
7. **Never read an interim SPRT.** 66.7% became 44%; 57.7% became 50%. The bound exists for this.
8. **Reuse the one canonical path.** Hand-rolling a second body builder produced
   `buildMon("Scizor") → null`; `dmgMon` already existed and does it right.

---

## 7. WHAT I WOULD DO NEXT

1. **Read the opponent-model A/B** (running). If `prior` wins it changes every evaluation.
2. **Calibrate the leaf** — take positions it calls 90–100% and measure how many are actually won.
3. **Keep walking the tag list.** Now justified by R4 rather than hoped.
4. **Make the mega choice a search decision.**
5. **Ship an opponent-aware playout** if the A/B says so — the road to an equilibrium player.
   `docs/MILTANK.md` §3.1 explains why the current best-response is exploitable by construction.

---

## 8. GLOSSARY

**Mickey Mouse team** — Will's term for a corpus team that is real, open-sheet and still terrible
(the naming case led Pikachu AND Raichu). `--meta-teams` filters by average member usage; the pool
is announced on every start, on or off.

**MILTANK / MAG** — search vs imitation. See §3.

**R1–R4** — the rollout gates. R1 leaf accuracy (pass), R2 cost (pass), R3 divergence (pass, 72.9%),
**R4 does it actually win (PASS, 55.5%)**.
