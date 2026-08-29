# run-all triage — the three red arms of 2026-08-28

MEASURE, 2026-08-28. Written after re-running each arm individually, not from the suite tail.

## HEADLINE

**None of the three is today's work. WIRE 158 is clear.** All three are DATA reds, not code reds:
two stores carrying bad rows and one measurement whose recorded verdict is a resolution failure.
Not one of the three loads `engine/medicham2-browser.js`, and that was established structurally
rather than assumed.

| arm | named failing assertion | today's? | fixed? |
|---|---|---|---|
| `engine/validate_selfplay.js` | `FAIL no duplicate ids (89)` | **no** — since 2026-08-19 23:51 | recurrence fixed in `engine/mew.js`; the 89 existing rows need a store write — **owed, see below** |
| `engine/sanity_check.py` | `FAIL store shape: the winner is always one of the two players (2 bad)` | **no** — since 2026-08-10 | root cause fixed in `engine/durable-ingest.js`; the 2 existing rows need a store write — **owed** |
| `engine/em_validation.js --check` | `the amplified regime's censoring bias did not exceed its own noise floor` | **no** — since the 2026-08-26 re-run | **not fixed, deliberately** — see the precise reason |

Reproduction was exact, three for three: `16 passed, 1 failed, 1 inconclusive`,
`SANITY: 95 passed, 1 failed`, and the same one-line EM message.

---

## 1. Does any of them load the engine?

Asked, not assumed.

- **`em_validation.js --check`** returns at line 90, before `require('./champions_sim.js')` and
  `require('./board.js')`. In `--check` it reads one JSON artifact and re-hashes five files:
  `fit_policy.js`, `click_class.js`, `click_match.js`, `board.js`, `em_validation.js`. No engine.
- **`sanity_check.py`** is pure store + JSON/JS-artifact analysis. It names
  `medicham2-browser.js` exactly once, at line 171, in a list of files whose PRESENCE it checks.
  It never loads or executes it. Python 3.12.10, invoked correctly by `run-all`'s interpreter
  probe; the failure is a real `ok(...)` assertion at line 164, not an environment problem.
- **`validate_selfplay.js`** requires only `champions_sim.js` and `durable-ingest.js`. A
  `require`-hook trace over that graph reports zero medicham modules loaded and zero in the
  require cache. The store it reads, `data/games.selfplay.jsonl`, has mtime **2026-08-19 19:51**
  and was not touched today.

Neither `durable-ingest.js` nor `mew.js` is one of the 26 frozen release `SOURCES`, so the two
edits below strand no release.

---

## 2. `validate_selfplay.js` — 89 colliding ids, and they are NOT duplicate games

`data/games.selfplay.jsonl` holds 3,090 lines and 3,001 unique ids. 89 ids appear exactly twice.
Every duplicated id has the form `selfplay-1-N`.

**The two occurrences of each id are different games.** Measured on all 89 pairs: 0 byte-identical,
89 different. First occurrences sit at lines 2902–2993 dated `2026-08-07 23:24`; second occurrences
at lines 2994–3090 dated `2026-08-19 23:51`. They differ in turn count and often in winner
(`selfplay-1-1`: 13 turns / MEW-B against 9 turns / MEW-A).

Cause, at `engine/mew.js:817`:

```js
const rec = extract(`selfplay-${SEED0}-${i}`, startedAt, log);
```

with `const SEED0 = parseInt(arg('seed', '1'), 10);` — **`--seed` defaults to 1.** So every
default-flag run rewrites the same id space into an append-only store. `seed` only seeds the
battle (`SEED0 + gi`), so the same `(seed, index)` does not reproduce the same game across engine
versions twelve days apart; the id was asserting an identity the content does not have.

**Do not run a deduplicator at this.** It would delete 89 real games and leave the check green,
which is the worst available outcome.

**LANDED:** `engine/mew.js` now writes `selfplay-${SEED0}-${startedAt}-${i}`. `startedAt` is the
run's unix second and is already the record's uploadtime. Nothing anywhere parses the structure of
this string — grep across `engine/`, `tests/`, `build/`, `web/` finds one producer and no consumer
— so widening it is safe. This stops recurrence; it does not clear the red.

### The inconclusive is a second thing, and it is not a defect

```
----  side balance, mirror: only 2 game(s) — too few to judge (would read 100.0%, CI [34.2, 100.0]).
```

`MIN_BALANCE_N = 100` in `validate_selfplay.js`. The store contains **2** true mirror games, so the
clause refuses to assert. That refusal is deliberate and its comment gives the reason: an earlier
version failed on 8 games with a CI of [52.9, 97.8] while the dedicated 300-battle check in section 1
passed on the same question, and *"a check that contradicts a better-powered check on the same
question, in the same run, is worse than no check."*

Section 1 ran tonight and passed: **mirror is 50/50, p1 won 156/300 = 52.0%, 95% CI [46.4, 57.6]**.

**What would resolve it: nothing, and nothing should.** MEW draws the two teams independently, so
true mirrors are vanishingly rare by construction. Reaching n=100 mirrors would require a dedicated
symmetric arm that the store is not, and the question is already answered better in section 1. This
line will read `----` on every future run of a normal self-play corpus. It is correctly not counted
as a pass.

---

## 3. `sanity_check.py` — a UTF-8 chunk-boundary bug in the ingest's HTTP reader

Two rows of `data/games.ladder.jsonl` carry a `winner` that is not either player's name:

| line | id | date | p1 | winner |
|---|---|---|---|---|
| 51739 | `...-2662690089` | 2026-08-10 12:55 | `blackred123永雛塔菲侠` | `blackred123永雛<3×U+FFFD>菲侠` |
| 70857 | `...-2672145722` | 2026-08-28 23:32 (UTC) | `It’sJustKen VGC` | `It<2×U+FFFD>sJustKen VGC` |

**Pre-existing.** The committed store snapshot at `HEAD:data/games.ladder.jsonl.gz` already carries
row 51739 and reports **1 bad winner** over 74,792 lines. Today's ingest added the second.

Cause, `engine/durable-ingest.js:28`:

```js
const get=u=>new Promise(r=>{const q=https.get(u,x=>{let d='';x.on('data',c=>d+=c); ...
```

`c` is a Buffer and `d` is a string, so `+=` calls `Buffer#toString('utf8')` on **each chunk
separately**. A multi-byte character straddling a chunk boundary is decoded as two partial
sequences and comes back as U+FFFD. Reproduced byte-for-byte:

```
Buffer.from([0xE2,0x80]) + Buffer.from([0x99])   -> '��'
'塔' split 1/2                                   -> '���'
```

A pull-based `Readable` cut at byte 9 of `|win|It’sJustKen VGC` produces
`|win|It��sJustKen VGC` on the old path and the correct string with `setEncoding('utf8')`
— i.e. the old path reproduces the stored row exactly, and the fix removes it. Shown red before
being trusted.

### Blast radius, measured

- `data/games.ladder.jsonl`: **2 lines, 5 replacement characters, all in `.winner`.**
- `data/games.bo3.jsonl`, `data/games.ots.jsonl`: **0.**
- Archived raw logs (`games.ladder.raw-logs.jsonl`, `games.bo3.raw-logs.jsonl`): **194 games,
  204 protocol lines, 496 replacement characters.**

Every single one lands inside a **nickname** or a chat/join/leave username — never a species, move,
item or numeric field, because those are ASCII. Distribution over protocol tags: `c` 65, `move` 35,
`l` 29, `-damage` 18, `switch` 11, `faint` 4, `j` 4, `-ability` 3, and a long tail of 1–2.

It is not harmless. `extract()` keys `nick[side + nickname] -> species` for damage attribution
(`durable-ingest.js:88`), and the corruption hits one occurrence of a nickname and not the others —
`|move|p2b: 我让你爆炸|Protect|p2b: 我让你爆��` has both spellings on the same line — so
the lookup misses for that event.

**LANDED:** `x.setEncoding('utf8')` before the data handler, which routes the stream through
`StringDecoder` and holds an incomplete sequence back until the next chunk completes it.
`tests/test-parse.js` re-run after the edit: **42 passed, 0 failed.**

This stops recurrence; it does not clear the red, because the two rows are already stored.

---

## 4. `em_validation.js --check` — a resolution failure, and the estimator is not the thing failing

`--check` reads `data/partial-label-em.json` (generated `2026-08-26T13:07:19Z`) and re-checks four
clauses. Only one fails:

| clause | value | verdict |
|---|---|---|
| `bias_exceeds_noise_floor` | `false` | **FAIL** |
| `em_beats_naive` | `true` | pass |
| `em_recovered_fraction > 0.5` | `0.9310` | pass |
| all five `source_digests` match the tree | yes | pass |

Amplified regime: `censoring_bias` **0.7643**, `noise_floor_oracle_spread` **0.8655**.

**It has been red since 2026-08-26 and it passed before that.** History of the artifact:

| commit | run | bias | floor | exceeds |
|---|---|---|---|---|
| `054300a9` | 2026-08-05 | 0.9567 | 0.3259 | true |
| `541e75f7` | 2026-08-06 | 0.9567 | 0.3259 | true |
| `0d418730` | 2026-08-07 | 0.9577 | 0.3284 | true |
| `47189c1c` | 2026-08-26 | **0.7643** | **0.8655** | **false** |
| `61f523a7` | (same artifact) | 0.7643 | 0.8655 | false |

**The floor moved, not the effect.** The bias fell 20%; the floor rose **2.6x**. The floor is
`spread(per.oracle)` — the max-minus-min of the ORACLE arm's `||w − w*||₂` across three seeds. It
went from (1.172, 0.955, 0.844) to (1.605, 0.739, 1.431): the oracle arm's mean distance from the
planted vector rose 0.990 → 1.258 and its seed spread rose 0.328 → 0.865.

### What changed, and what did not

- `engine/fit_policy.js` `37df17935c16` → `a963537c91e8` — **changed**
- `engine/board.js` `5bdaa3923958` → `c85a3b756c98` — **changed**
- `click_class.js`, `click_match.js`, `em_validation.js` — unchanged
- corpus — effectively unchanged. `const games = all.slice(0, GAMES)` takes the first 1,200 of an
  append-only corpus, so store growth (6,675 → 13,326) does not move the sample; rows went
  31,940 → 31,938.
- **the plant vector — unchanged. This was my first suspicion and it is WRONG.**
  `data/policy-weights.json` has mtime 2026-08-28 15:46, but its CONTENT is byte-identical to the
  version committed on 2026-08-05 (`sha1 de1e021eb218` then and now). Checked by content, not by
  mtime, because that is the rule.

So the degradation is attributable to `fit_policy.js` and/or `board.js`, both of which are correctly
in `SOURCES` and both of which the 08-26 run was measured under.

### A provenance hole worth closing when this is re-run

`SOURCES` is `['engine/fit_policy.js','engine/click_class.js','engine/click_match.js',
'engine/board.js','engine/em_validation.js']`. **`data/policy-weights.json` is the planted truth
`w*` and is not digested** — only recorded as a path in `planted_from`. A refit of the shipped
vector would silently change what this measurement plants without turning the gate red for that
reason. It did not happen this time (content unchanged), but nothing here would have said so.

### The methodological note, recorded and NOT acted on

The floor is the **unpaired** spread of the oracle arm across seeds. The effect is a **paired**
contrast: `naive` and `oracle` are fitted on the same seed, the same rows and the same planted
vector, so the seed-to-seed variation in absolute level is common to both arms and cancels.

Per-seed `naive − oracle` on the current artifact: **+0.8593, +0.9367, +0.4968** — positive in all
three seeds, mean 0.7643, spread 0.4399. Under a paired floor the clause would pass.

**I have not changed the comparator.** Redefining a noise floor in the session that finds it red is
indistinguishable from normalising a red, and `docs/LESSONS.md` §9 as written says the spread of one
arm. This is a decision about what the gate asserts and it belongs to Will or to a deliberate pass
of its own, not to a triage.

---

## OWED, NOT RUN

Everything below is a WRITE to a data artifact. I did not do any of it, and each carries its reason.

1. **Re-run `engine/em_validation.js` — DO NOT DO IT YET.**
   ```
   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/em_validation.js --games=3000 --seeds=5
   ```
   Precise reason for holding: `node engine/status.js` currently reports **REFIT OWED** with
   `feature_fixture --check FAILED` on the fixture-identity and damage-table gates, and
   `engine/medicham2-browser.js` moved at 19:17 after the 15:46 fit. This measurement plants
   `data/policy-weights.json` and fits through `board.js` and `fit_policy.js`. Spending ~30 minutes
   of conditional-logit fits against a weight vector that is itself unsettled produces a number that
   the refit invalidates on arrival. **Re-run it after the refit settles**, and add
   `data/policy-weights.json` to `SOURCES` in the same pass. Raising `--games` is the script's own
   prescription for this failure (`em_validation.js:290`), and the reason it should work is that the
   floor is the spread of three finite-sample fits: more rows per seed shrinks each fit's variance
   and therefore the spread. That is a prediction, not a measurement.

2. **Repair the 2 `winner` fields in `data/games.ladder.jsonl`.** Recoverable with certainty — the
   mangled string matches exactly one of `p1.name` / `p2.name` once U+FFFD runs are treated as
   wildcards, and it is `p1` in both cases.
   Precise reason for holding: **that store is gitignored and has diverged from its own tracked
   snapshot.** `HEAD:data/games.ladder.jsonl.gz` (built today at 14:53) holds 74,792 games; the
   working plaintext (21:09) holds 70,981. Comparing by id, **5,075 games are in the .gz and not in
   the plaintext, and 1,264 are in the plaintext and not the .gz** — neither is a superset of the
   other. I do not understand that divergence, it is OPS's store, and I am not writing 346 MB over a
   file whose relationship to its own backup is unexplained. **Reported, not touched.** This is
   probably the more important half of this report.

3. **Re-stamp the 89 colliding ids in `data/games.selfplay.jsonl`.** The games are real and correct;
   only the label collides. The second-occurrence run stamp is recoverable from
   `data/games.selfplay.raw-logs.jsonl`, which carries `uploadtime` per record.
   Precise reason for holding: the file is **gitignored, 32 MB, with no `.gz` and no snapshot
   anywhere in the repository**. A botched write is unrecoverable, which is the one category of
   action I may not take unilaterally. It needs one word from Will and then it is ten minutes:
   write to a new file, assert line count unchanged and that the only differing bytes are inside 89
   `"id"` values, then swap, keeping the original.

4. **`node engine/status.js --write` was NOT run.** It rewrites the `<!-- GENERATED -->` blocks of
   six division ledgers, all of which are STAGED for the push being held. Restamping them mid-push
   changes what gets committed without being asked for.

5. **CHANGELOG / living-docs entries for the two source edits** are not written, because this
   session may not commit and the version bump belongs with the commit.

## What this session changed in the tree

Two files, both unstaged, neither in the frozen `SOURCES`:

- `engine/durable-ingest.js` — `x.setEncoding('utf8')` in `get()`, with the account above in a
  comment block. Verified: old path reproduces the stored corruption byte-for-byte, new path does
  not; `tests/test-parse.js` 42 passed, 0 failed.
- `engine/mew.js` — the self-play id carries the run stamp, with the account above in a comment
  block. `node --check` clean.

No store was written. No artifact was regenerated. No git operation was run.
