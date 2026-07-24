# ABRA — Technical Documentation

**Version 2.4.0 · Last updated 2026-07-23**

*Written in ASD-STE100 Simplified Technical English. Sentences are short. The voice is active. One
word has one meaning. The document follows the Diátaxis structure: Tutorial, How-to, Reference,
Explanation.*

---

## 1. Tutorial — run ABRA for the first time

Do these steps in order.

1. Get the code. Clone the repository `github.com/willhoop/abra`.
2. Get the sibling engine. Clone `github.com/willhoop/chomp` next to it. ABRA reads it at `../CHOMP`.
3. Open the site. Open `web/index.html` in a web browser. The site needs no build step and no server.
4. Visit a model. Click a house in the town. Open **PORY** and move the sliders. The win % updates.
5. Run one check. In a terminal, run `node engine/validate_damage.js`. It confirms the damage engine.

You now have the site and one validated model.

## 2. How-to — common tasks

**Pull new replays.**
`PAGES=6 CONC=20 node engine/durable-ingest.js data/games.ladder.jsonl`
The command adds only new games. It never duplicates a game and never re-fetches a stored game.

**Rebuild the meta model.**
`node engine/analyze.js data/games.ladder.jsonl` writes `data/meta-usage.json`.

**Refresh the site data.**
`python3 engine/refresh-site-data.py` writes `data/live.js`, `data/archetypes.json`, and
`data/kad-replays.js`.

**Run a model or an evaluation.**
- GURU matchup matrix: `python3 engine/guru.py`
- XATU belief / policy eval: `python3 engine/eval_policy.py`
- PORY value net: `python3 engine/pory.py`
- CHOMP-EV proof: `node engine/chomp_ev.js`
- SLOWKING preview-Nash (species): `python3 engine/slowking_preview.py`
- SLOWKING preview-Nash (playstyle): first `node engine/playstyle.js`, then
  `MATRIX_FILE=data/playstyle-matchups.json TAG=playstyle python3 engine/slowking_preview.py`

**Validate the damage engine.**
`node engine/validate_damage.js`. It fails if any scenario is more than 5% from `@smogon/calc`.

**Run the tests.**
`node tests/test-parse.js`, `node tests/test-dynamics.js`, `node tests/test-medicham.js`,
`node tests/test-chomp-ev.js`, `python3 tests/test-jolteon.py`, `python3 tests/test-slowking.py`.

**Edit the site, then mirror it.** After you change `web/index.html`, copy it: `cp web/index.html app/index.html`.

## 3. Reference

### 3.1 Stored game record (`data/games.ladder.jsonl`, one JSON object per line)

| Field | Meaning |
|---|---|
| `id`, `date` | replay id and upload time |
| `p1`, `p2` | `{name, rating, bot}` per player |
| `six.p1/p2` | the six revealed at preview |
| `brought.p1/p2` | the four actually brought |
| `lead.p1/p2` | the two led |
| `sets` | per species, the revealed moves / item / ability |
| `turns` | per-turn events (move, damage, faint, status, field) |
| `winner` | the winning name |

### 3.2 Model outputs

| File | Written by | Contents |
|---|---|---|
| `data/damage-validation.json` | `validate_damage.js` | damage error vs `@smogon/calc` |
| `data/guru-matchups.json`, `guru.js` | `guru.py` | archetype matchup matrix, Wilson CIs |
| `data/xatu.json`, `xatu.js` | `xatu.py` | opponent set/move belief |
| `data/pory.js`, `pory-eval.json` | `pory.py` | mid-game value net + its score |
| `data/chomp-ev.json` | `chomp_ev.js` | the bring proof (null result) |
| `data/playstyle-matchups.json` | `playstyle.js` | playstyle matchup matrix |
| `data/slowking-eval.json`, `slowking-playstyle-eval.json`, `slowking*.js` | `slowking_preview.py` | preview equilibrium + exploitability |
| `data/meta-usage.json`, `live.js` | `analyze.js`, `refresh-site-data.py` | usage model + live site counts |

### 3.3 Continuous collection

A GitHub Action (`.github/workflows/ingest.yml`) runs the pull hourly and commits the store. A
separate tests workflow runs the test suite and the damage validation on every push and pull request.

## 4. Explanation

**Store raw, analyse on top.** ABRA saves every game with every fact it may ever need. Every filter —
rating tier, humans-only, archetype, playstyle — runs over the store at read time. A change to how the
games are segmented is a re-computation, not a re-download. This makes the fetch a one-time cost and
keeps the analysis free to change.

**Support decisions, do not predict outcomes.** In this format, the winner of a game is near-impossible
to predict from the two team sheets; even a player-rating model ties a coin. ABRA therefore judges each
model on a decision, not on the match result. Each probability ships a proper score (log-loss or
Brier), a confidence interval, and an honest baseline.

**Why the confidence interval is clustered.** States within one game are correlated. A confidence
interval that resamples states would be too narrow. ABRA resamples whole games instead. For a matchup
matrix, it also resamples each cell from its Beta distribution before it solves, so the interval
carries the small-sample uncertainty.

**Honest negatives are kept.** Two results are negative and are reported plainly: the team-picker's
brings do not beat a coin (CHOMP-EV), and the playstyle rock-paper-scissors cycle rests on small
samples and is suggestive, not settled. A negative that is measured is more useful than a positive that
is asserted.

---

**Companion documents.** [White paper](ABRA-whitepaper.md) · [Deck](ABRA-deck-plain-english.md) ·
[Project summary](SUMMARY.md) · [Model ledger](MODELS.md) · [Changelog](../CHANGELOG.md)
