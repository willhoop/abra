# solver/gary — GARY v1, the population habit model (and HYPNO's inputs)

GARY predicts the opponent's joint action at a rating band: DODUO v1's distribution tilted per (situation bucket ×
rating band) toward what that population clicks. Store-only: built from the human dataset, no simulator, no game.
HYPNO (`solver/hypno/`) best-responds to it where its held-out gate passed and plays equilibrium where it failed.
Design, results and the safety argument: `docs/_reports/2026-10-01-gary-hypno.md`. Pre-registration:
`preregistration.json` (committed before the first fit).

```
SHOWDOWN_PATH=<pokemon-showdown-mc> node solver/human/build_dataset.js --out solver/out/human-<date>         # the dataset
node solver/gary/extract.js --human solver/out/human-<date>/games.jsonl --doduo-train <DODUO v1's games.jsonl> \
     --out solver/out/gary/<tag> --workers 3                                                                 # rows
node solver/gary/fit.js --data solver/out/gary/<tag> --out solver/gary/model/gary-v1                        # fit + DODUO clause
node solver/gary/gate.js --model solver/gary/model/gary-v1.json --human solver/out/human-<date>/games.jsonl  # tau* clause, verdicts, w0
node solver/gary/eval_series.js --data solver/out/gary/<tag> --model solver/gary/model/gary-v1.json         # in-series update test
node solver/hypno/eval_offline.js --model solver/gary/model/gary-v1.json --human solver/out/human-<date>/games.jsonl
node solver/tests/test-gary.js        node solver/tests/test-hypno.js                                       # GREEN / RED / BLIND
```

| file | what |
|---|---|
| `situation.js` | the buckets, the bands and the 14 joint-action classes (public state and DODUO's candidates only) |
| `extract.js` | one row per fully observed decision: DODUO v1's log-probabilities over the valid cells, class masks, label, role |
| `fit.js` | the four-level L2-penalised tilt by Newton; lambda by player-fold CV on FIT; the DODUO clause on EVAL |
| `gate.js` | the tau* clause on the recorded roots; the per-cell verdict p = 1 / 0; the mixture weight w0 |
| `eval_series.js` | does a per-opponent update from earlier games of a bo3 predict games 2-3 better? |
| `roots.js` | reads the search's recorded roots (`solver/results/2026-10-01-gary-hypno/roots-human-s1/`) and joins them to the dataset |
| `infer.js` | GARY in Node; a drop-in `prior` for `solver/miltank/prior_adapter.js` |
| `model/gary-v1.json` | parameters, the gate verdicts, `mixture_w0`, `in_series`, every stamp |
