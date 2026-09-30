# PORYGON2 v2 — design and training dataset (2026-09-30)

SOLVER. Store-only work: no simulator was read, no game was played, no net was trained, no gate was run.
abra/regmc 1.34.0, branch `worktree-agent-a9e323f35bad91d08`.

## Verdict

- **Design written and pre-registered, not run.** `solver/porygon2/v2/DESIGN.md` and
  `solver/porygon2/v2/preregistration.json`. v2 is a value over the PUBLIC state. It uses per-field UNK tokens, both
  pre-game ratings as Maia-2-style inputs, MEDICHAM pair facts computed on known fields only, and KataGo-style auxiliary
  heads. It is pretrained on bo1 and fine-tuned on bo3 with bo1 replay, at K = 1 position per game per epoch.
- **The datasets are built.** bo1: **27,116 games / 218,815 positions**. bo3: **24,940 games / 197,905 positions**.
  Both are in `solver/out/porygon2-v2/<fmt>/games.jsonl.gz` (gitignored, about 30 MB each). The manifests are tracked.
- **No position leaks.** `solver/tests/test-porygon2-v2-extract.js` is GREEN 222,895/222,895 on 590 real games and 3,977
  positions. It goes RED under both deliberate breaks.
- **The high-rating problem is confirmed on the built data, not solved by it.** bo3 has **0** kept games with both
  players at 1500 or above, and 89 at 1400 or above. bo1 has 364 at 1500 or above and 33 at 1600 or above. On bo3,
  gate (a) can resolve only the bands below 1200 (§5).

## 1. What was built

| file | what |
|---|---|
| `solver/porygon2/v2/reveal.js` | One raw log in, the public state at every `\|turn\|n` line out, with a per-field reveal state and the labels beside it |
| `solver/porygon2/v2/extract.js` | The builder: reads the parsed `.gz` store explicitly, applies quality `reasons()` and the extra exclusions, joins the raw logs on id, splits, writes the output and the manifest |
| `solver/tests/test-porygon2-v2-extract.js` | The leak test (clauses PREFIX, EVIDENCE, SHEETS, MONOTONE, UNKNOWN, LABELS, FIRSTPERSON, RED) |
| `solver/porygon2/v2/DESIGN.md`, `preregistration.json` | The cited design and the pre-registered gates |
| `solver/porygon2/v2/manifest-bo1.json`, `manifest-bo3.json` | Every input by sha256 (the parsed store also by git blob id), the output by sha256, the code digests, every count |

**Why raw logs and not the parsed store.** The parsed store keeps per-turn moves, switches, HP, boosts and a few field
events. It keeps no `-item`, `-ability` or `[from] item:`/`[from] ability:` events, so it cannot say *when* an item or an
ability was revealed. Its `sets` field is an end-of-game summary. The store decides WHICH games are used, through
quality. The raw log decides WHAT each position shows.

**Priority.** The harness refused `cmd.exe /c tools\lownode.cmd` (the worktree isolation cannot verify a cmd shell).
So the builds ran with plain `node`, and `extract.js` lowers its own priority to BELOW_NORMAL
(`os.setPriority(0, PRIORITY_BELOW_NORMAL)`). That is the same class the wrapper sets. Each build took about 4–5
minutes.

## 2. The reveal rules (bo1)

A member's moves, original item, current item, base ability and current ability start UNK. They become known only when a
log line attributes them to that member. Nothing is filled from a prior.

- Moves come from the member's own `|move|` line (no `[from]`, or a locked continuation, a Round call, or a Sleep Talk
  call of its own move). A `|cant|` line that names the move also counts. So does Forewarn. When a `|cant|` carries
  `[of] USER`, the move is credited to the USER: that is Armor Tail and its kind refusing someone else's move. Moves
  used while transformed are not credited.
- Items are revealed by an item effect (`[from] item:`; the holder is `[of]` on `-damage` lines, such as a
  Rocky-Helmet-style retaliation, and the named member otherwise), by `-enditem` (it held it and now holds nothing), by
  Frisk, and by a mega stone at `-mega`. Trick, Switcheroo, Thief, Covet, Bestow, Pickpocket and Magician change what is
  held now. They never reveal the original.
- Abilities are attributed only to a member whose species can hold the ability in the Reg M-C dex. When both members on
  a line could hold it, a fixed per-command rule decides. When neither can, the ability is refused and counted: bo1 had
  8 refused and 49 unattributed. Trace, Entrainment, Role Play, Worry Seed and Simple Beam change the current ability.
  They reveal the previous one where the line prints it. A mega forme's current ability is read from the dex; every
  Reg M-C mega has one ability.
- A species with exactly one ability in Reg M-C has that ability DEDUCED, marked `ability_src: 'dex'`. That is a
  deduction from the format, not a prior: 26,563 member-instances in bo1.
- **Public sheets in bo1.** 526 kept bo1 rooms print both `|showteam|` sheets before the battle. Those sets were public
  from turn 1, so they are carried as known and the row is flagged `sheets_public`. This was found by the store
  cross-check (§4), not assumed.

## 3. Exclusions and counts

Inputs, read explicitly from the main checkout. The files were rewritten at 01:45Z on 2026-09-30, so they hold more
games than MEASURE's 21:18Z count:

| | bo1 `games.gen9championsvgc2026regmc.jsonl.gz` | bo3 `games.gen9championsvgc2026regmcbo3.jsonl.gz` |
|---|---:|---:|
| sha256 (first 12) / git blob | `341e5953c4c7` / `76ef2de7` | `3e5affee9991` / `d2b5041a` |
| store games | 59,752 | 37,526 |
| quality `reasons()` clean (incl. bot + behavioural-bot) | 29,749 | 25,460 |
| behavioural-bot accounts found | 15 | 8 |
| own account | −6 | −77 |
| illusion possible (preview) | −684 | −188 |
| custom rules (raw infobox) | −1,689 | −8 |
| pre-Eject-Button-fix | −248 | −243 |
| parse error | 0 | −2 (`no_open_sheet`) |
| no result | −6 | −2 |
| no raw log | 0 | 0 |
| **kept** | **27,116** | **24,940** |
| **positions** | **218,815** | **197,905** |

**Cross-check against MEASURE.** On the earlier snapshot of the bo1 file (59,196 games), the same quality rules gave
**29,537** clean games in a trial run of this builder. That is exactly MEASURE's quality figure. The bo3 file has moved
since MEASURE counted it, so its 25,238 cannot be compared.

**Split** (MAG/DODUO's player salt, lifted to the game):

| | bo1 games / positions | bo3 games / positions |
|---|---:|---:|
| train | 16,970 / 137,281 | 16,155 / 128,521 |
| val | 4,603 / 36,954 | 4,142 / 32,669 |
| test | 5,543 / 44,580 | 4,643 / 36,715 |

**By the lower of the two ratings** (games / positions; test games):

| min rating | bo1 | bo3 |
|---|---:|---:|
| unrated | 2,322 / 19,299; 451 | 4,394 / 35,504; 732 |
| < 1100 | 9,815 / 79,350; 1,888 | 10,858 / 85,385; 2,136 |
| 1100–1199 | 6,723 / 53,676; 1,392 | 6,877 / 54,395; 1,275 |
| 1200–1299 | 3,971 / 32,042; 856 | 2,094 / 16,989; 371 |
| 1300–1399 | 2,838 / 22,707; 645 | 628 / 4,949; 114 |
| 1400–1499 | 1,083 / 8,781; 234 | 89 / 683; 15 |
| 1500–1599 | 331 / 2,696; 72 | **0** |
| ≥ 1600 | 33 / 264; 5 | **0** |

Cumulative, both players at or above: bo1 1300: 4,285, 1400: 1,447, 1500: **364**, 1600: **33**. bo3 1300: 717,
1400: **89**, 1500: **0**. The higher of the two ratings at or above 1500: bo1 854, bo3 48.

**Gate (a) eligibility (bo3).** Some bo3 test games were never seen by v1: they come from raw shards that are not in the
human dataset's manifest. There are **1,023 such games (8,222 positions)**. By min rating: < 1100: 386; 1100–1199: 283;
unrated: 200; 1200–1299: 105; 1300–1399: 40; 1400–1499: 9.

**Outcome balance.** z = 1 for 13,648 and z = 0 for 13,468 of bo1 games; 12,462 and 12,478 in bo3. Forfeits are kept
(quality rule): 8,340 in bo1 and 6,985 in bo3.

**Reveal at game end, bo1** (members that took the field, n = 216,928): 1.887 known moves of 4, the original item known
in 55.7% of members, the base ability in 50.4%. These are per brought member. They are not MEASURE's per-`sets`-entry
rates (1.69 moves, 25.9% items over non-mega entries, 36.4% abilities), which use a different rule. The mega stone counts
as an item here. The bo1 rate at turn 1 is close to zero for moves (8,413 known move slots over 108,464 members, all from
public-sheet rooms), so the pretraining data covers the full range from nothing known to a lot known.

## 4. Verification

- **Leak test.** `node solver/tests/test-porygon2-v2-extract.js` is **GREEN 222,895/222,895** on 590 games (400 bo1,
  190 bo3, the first write-once raw shards; 10 skipped because they threw) and 3,977 positions. For every position, a
  re-extraction on the log cut at `|turn|n` gives a byte-identical position. EVIDENCE checked 36,696 revealed fields
  against the log before `|turn|n`. **RED under `PORY2V2_BREAK=leak`** (a look-ahead pass seeds end-of-game reveals):
  PREFIX and EVIDENCE fail. **RED under `PORY2V2_BREAK=late`** (the snapshot is taken at the end of the turn): PREFIX and
  EVIDENCE fail. Before the public-sheet fix, the test went RED on EVIDENCE (8,355 checks). That was the test finding a
  real issue, and it is why SHEETS exists.
- **An independent parser agrees.** The parsed store's `sets` come from a different parser (`engine/durable-ingest.js`).
  On bo1 rooms without public sheets, 182,872 comparable members:
  - moves: identical for **98.49%**. The store names a move we do not in only **0.17%** (store ⊆ ours 99.83%). We name
    a move the store lacks in 1.34%.
  - original item: **97.55%** of 34,753. Base ability: **97.31%** of 64,047.
  - Every disagreement read by hand was the store's error, not ours:
    - the store credits a Traced ability to the tracer (Gardevoir recorded with Inner Focus and Pixilate, which were
      copied);
    - it credits Farigiraf's Colbur Berry to Annihilape;
    - it misses a Drain Punch named in `|cant|…|move: Heal Block|Drain Punch`;
    - it keys forme-changed members (Floette-Eternal, Palafin) apart.

    I read about 15 cases, not a random sample. The residual is not proven to be all the store's.
- **An earlier bug, found by the builder's own counters:** 5 bo1 games threw `moves_overflow`, meaning a member with more
  than four moves. All 5 were Zoroark-Hisui rooms in which a disguised member's moves were credited to the member it
  copied. The Illusion check now runs on the preview before the parse. After the fix: `moves_overflow` 0 and bo3
  `move_not_on_sheet` 98 → 0. Both populations were excluded before and after, so no kept game changed.

## 5. What the counts mean for the gates

- **Gate (a) on bo3 can speak only for the bands below 1200.** Only < 1100 (386) and 1100–1199 (283) reach the
  pre-registered 200 eligible test games. 1200–1299 has 105 and ≥ 1300 has 49. The pooled test is 1,023 games. v1-r1's
  human-set differences were about 0.004 log-loss with CIs of about ±0.004 on a larger set, so a v2 edge of that size
  would not clear the pooled bound. Every new raw shard is v1-unseen, so the eligible set grows with the store. Re-count
  it at launch.
- **The high-rating conditioning rests on bo1:** 364 games with both players at 1500 or above (77 in test) and 33 at
  1600 or above (5 in test). The bo1 ≥ 1500 band is a diagnostic, not a gate, because it has too few test games.
- **Upload bias** (MEASURE: most top players never upload) means none of these counts describes the top of the ladder.
  They describe the uploaders.

## 6. Design in brief

This section only summarises `solver/porygon2/v2/DESIGN.md`, which carries the citations.

- **Input.** The public state (spectator view) in training and in play. There is a learned UNK embedding per field kind,
  distinct from NONE. The value is over the public state, as in DeepStack, ReBeL and SoG, but with no explicit belief
  vector: the belief is implicit, which is Metamon's black-box choice. v2 departs from Metamon on purpose: it back-fills
  nothing, where Metamon imputes from usage.
- **Facts.** MEDICHAM's pair facts, the same as CHOMP v1's, on a frozen release, computed over known moves only. An
  unknown item means no item. An unknown ability means No Ability, which exists in the Reg M-C dex. There are per-token
  unknown counts. **`solver/arena/teams.js` `buildBody` must not be used**: it fills an unknown ability with the species'
  first ability, which is a silent prior-fill for bo1.
- **Ratings.** Maia-2's form: one net, embeddings of both ratings in the attention queries. Maia used nine separate
  per-bin models. Queried at 1600 for me and at the displayed rating for the opponent.
- **Targets.**
  - z for human positions. 0.5 z + 0.5 v_deep for bo3 positions with deep labels.
  - Correction to the brief: AlphaZero's search-improved target is the policy, and its value target is z. The precedent
    for blending search values into the value target is KataGo's short-term value targets (methods notes).
  - Auxiliary heads, the KataGo ownership/score analogue: member survival and final HP (per token), final material
    difference, next KO side and delay, turns remaining. They are masked for forfeits where the board is a resignation.
- **Positions.** Every position is stored. Training uses K = 1 per game per epoch, following AlphaGo (whole games:
  0.37 test vs 0.19 train MSE; one position per game: 0.234 vs 0.226) and ExIt §4.2.
- **Schedule.**
  - A: bo1 pretrain, unequal ratings sampled 2×.
  - B: bo3 fine-tune, 25% bo1 replay, LR × 0.3.
  - C (owed, optional): search targets, self-play only from the strong search.
- **Gates.**
  - (a) Paired v2 − v1 log-loss on v1-unseen bo3 test games. The upper bound must be < 0, with no band point estimate
    > 0 in bands of 200 games or more.
  - Cost: leaf cost at most 1.5× v1's.
  - (c) SPRT against v1 at 1,000 ms per decision, honest, elo1 +20, α = β = 0.05, at most 2,000 games, seed 9301, read
    once.

## 7. Filed, not fixed

- `engine/quality.js` `storePath()` prefers a stale plain file over the `.gz`. Another agent owns this; this build did
  not call it.
- `solver/arena/teams.js` `buildBody` fills an unknown ability with `legal[0]`. It is correct for open sheets and must
  not be used on bo1 data. This is recorded in DESIGN §2.2. No change was made: the arena depends on it.
- The parsed store's `sets` errors listed in §4 (Traced abilities, cross-member items, `|cant|` moves, forme keys). They
  are OPS's parser (`engine/durable-ingest.js`), reported here for OPS.

## OWED, NOT RUN

Nothing below has been run. Commands assume the main checkout after this branch merges. `SHOWDOWN_PATH` falls back to
`../pokemon-showdown-mc`. Run each through `cmd.exe /c tools\lownode.cmd` where the shell allows it.

```
REM 0. rebuild the datasets on the day of training (the stores move hourly; the fit stamps the sha256 it read)
cmd.exe /c tools\lownode.cmd solver\porygon2\v2\extract.js --fmt bo1
cmd.exe /c tools\lownode.cmd solver\porygon2\v2\extract.js --fmt bo3
node solver\tests\test-porygon2-v2-extract.js

REM 1. the encode step (NOT WRITTEN): public state + MEDICHAM pair facts on the frozen release, no buildBody
REM    solver\porygon2\v2\encode.js --release eaa5becc54eb --fmt bo1|bo3  ->  solver\out\porygon2-v2\<fmt>\tensors\

REM 2. training (NOT WRITTEN): stage A then B, flags as solver\porygon2\v2\preregistration.json "schedule"
REM    python solver\porygon2\v2\train.py --stage A --data solver\out\porygon2-v2\bo1 --seed 1 --threads 3
REM    python solver\porygon2\v2\train.py --stage B --init <A.pt> --data solver\out\porygon2-v2\bo3 --replay solver\out\porygon2-v2\bo1 --replay-share 0.25 --lr 3e-4

REM 3. gate (a): paired log-loss vs v1 on bo3 TEST games with v1_unseen = true, by min-rating band
REM    node solver\porygon2\v2\gate_a.js --v2 <model> --v1 <champion net, by sha256> --boot 2000 --seed 1

REM 4. cost bar, then gate (c) only if (a) passes (league file for v2 owed)
node solver\porygon2\v1\bench.js --release eaa5becc54eb --selfplay solver\out\selfplay\eaa5becc54eb\loop-sp9 --models <v1 net>,<v2 net> --positions 300 --reps 3
REM    (bench.js reads v0/v1 files today; a v2 dispatch in solver\porygon2\leaf.js is owed with the Node forward pass)
node solver\machamp\sprt.js --release eaa5becc54eb --x solver\porygon2\v2\gen5-p2v2.json --y <v1 league file> --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9301 --workers 3 --team-store C:\Users\willj\Projects\Pokemon\ABRA\data\team-pool-frozen-regmc --info honest
```

After the merge: `node engine/status.js --write` from the main checkout (not run here: this is a worktree).
