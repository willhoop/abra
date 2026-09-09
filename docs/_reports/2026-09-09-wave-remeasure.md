# 2026-09-09 — wave re-measurement: release restore, instrument edit, full gate chain on `b0f5c159c46e`

MEASURE. Historical record, never maintained; superseded by the register rows it feeds. No commits were
made; nothing in `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md` or a living document was edited
(proposed rows are at the end).

## 1. Release `b730e44f3314` — restored, proved, re-staged; the rule that stops it recurring

**The brief's diagnosis was half right.** It said the release was cut with LF bytes and something wrote CRLF.
Measured against the manifest (raw-byte sha256, `engine_release.js` `sha12`):

| file | manifest | on disk before | matches |
|---|---|---|---|
| `engine/board.js` | `c85a3b756c98` | `2e9c917b8e82` (CRLF form) | the **LF** form |
| `engine/champions_sim.js`, `engine/lookup.js`, `engine/quality.js`, `engine/showdown_path.js`, `data/residual-order.json`, `data/switchin-order.json` + 11 more | LF digests | CRLF on disk | the **LF** form (18 files) |
| `engine/medicham2-browser.js` | `ff11f67fff65` | `ff11f67fff65` | the **CRLF** form — correct as found |
| `rollout_leaf.js`, `position_features.js`, `tags.js`, `mc_key.js`, `set_priors.js`, `smogon_priors.js`, `data/quality-filter.json`, `data/engine-data.js` | CRLF digests | CRLF | correct as found (9 files) |

So the manifest holds a MIX — the 18 sources pinned `text eol=lf` in `.gitattributes` were LF at cut, the 9
deliberately unpinned ones were CRLF at cut (they are CRLF in this working tree; `.gitattributes:72-77`).
A blanket `sed 's/\r$//'` would have broken the nine. **Cause:** `git check-attr` shows the release paths
carried NO attribute, so `git add -f` normalised all 29 to LF in the index under `core.autocrlf=true`, and
the next checkout of those paths (an event at ~20:46Z that also rewrote ~50 tracked files in this tree, not
mine) wrote CRLF back over every multi-line file.

**Restore was manifest-driven, per file, never guessed:** for each file, keep raw if its digest matches;
else write whichever of {LF form, CRLF form} matches the manifest; else report UNRECOVERABLE. Script in the
session scratchpad (`eol_restore.js`). Result for `b730e44f3314`: 18 files → LF, 9 untouched, 0 unrecoverable.

Proof:
```
node -e "const R=require('./engine/engine_release.js');const r=R.open('b730e44f3314');console.log(JSON.stringify(r.stamp()))"
OPEN OK  {"engine_release":"b730e44f3314","engine_release_cut":"2026-09-09T11:45:50.749Z","engine_release_cuts":64, ...27 source_digests...}
verify ok true 0
```
Re-staged: `git add -f data/releases/b730e44f3314` → 29 files `A`, index now holds the exact bytes.

**The 26 older tracked releases: 24 of 26 open.** The two that do not — `55c7a0f19c86`, `5fc1f711a0e3` — were
**PRUNED on 2026-08-05** (bodies removed, `release.json`/`cuts.jsonl` only) and fail for that reason, not a
line ending. Whole store: 637 releases, 631 verify clean, 1 was fixable (b730), 5 have missing bodies.

**`.gitattributes` rule added (after the SOURCES pin block):**
```
data/releases/**                 -text
```
`-text`, not `text eol=lf`: `eol=lf` would normalise the nine CRLF-at-cut files to LF on every checkout and
clone, so their digests would never again match the manifest and every release holding them would be
unopenable on every machine. `-text` switches conversion OFF both ways — index stores the bytes on disk,
checkout writes the index — and it moves NO release id because `release.json` is not rewritten. It is not
`binary` (`-text -diff`), so diffs still render. With the rule in place `git status` reports the 24 older
releases unmodified, i.e. their index blobs already equal their raw bytes.

## 2. Instrument edit — `engine/game_differential.js:1623` (ROADMAP #551)

Mechanism confirmed from source, not from the card: `Battle#clearActiveMove` (`sim/battle.ts:376-384`)
nulls `activeTarget` only under `if (this.activeMove)`; `sim/battle-actions.ts:693` and `:1154` write
`this.battle.activeTarget = target` during Future Sight's residual hit with NO active move. So the t5 target
survived into t6's `runEvent('FractionalPriority')` (`sim/battle-queue.ts:249`), and `midDraw` folded it into
Quick Claw's address on the authority side only.

Edit: `const mv = b && b.activeMove, tg = mv ? (b && b.activeTarget) : null;` (with a comment block).

**Proof.** There is no per-seed flag; the smallest sample containing the game is its config. A void game can
never reach `--dump-games` (`DUMP_POOL` filters `_mid_void`), so the proof is the void list + the dump:
```
tools\lownode.cmd engine\game_differential.js --config omit-spread --steering empirical --release b0f5c159c46e
  --arm middle --end-state --state --games 1200 --team-store data/team-pool-frozen --turns 50
  --census data/verification/census-pin-098de5770623.json --dump-games 6
  --dump-out data/verification/instrument-551-dump.json      (no --write; nothing published)
```
128 played (the same stride as the 961-game run), **VOID 0 of 128** (this config held 2 of the 3 void games
before), BOARD-MATERIAL 0/128, NARRATION-ONLY 3. The dump (`data/verification/instrument-551-dump.json`,
`generated 2026-09-09T21:37:22Z`) holds `2657358877 vs 2657413811`:

> cls `event missing from medicham2` :: `|-end|p2a: Morpeko|move: Future Sight` <> `|-sideend|p1: |move: reflect`,
> 74 agreed lines, both engines ended, SAME END STATE.

**The game now reads NARRATION.** Its first divergence is the engine narration miss ENGINE already recorded
(Future Sight into an immune target: `-end`/`-immune` unwritten); boards agree at every boundary. The other
omit-spread ex-void game (`2658645239 vs 2658775286`) now **AGREES** (no divergence row).

Note: gd's `--out` is only honoured together with `--write` (line 298), so
`data/verification/instrument-551-omit-spread.json` was NOT written; the dump and the scratch log are the record.

## 3. The full gate chain on ONE release

Tree state: `git status` was NOT clean of engine bytes — `engine/medicham2-browser.js`, `engine/engine_release.js`,
`engine/quarantine.js` and ~50 other tracked files carry uncommitted edits stamped 20:46Z (ENGINE's Misty Terrain
/ charge-release fixes and other divisions' work; "commits will follow"). The release was cut over that tree as
briefed. `node engine/engine_release.js cut "void games: Misty Terrain onSetStatus and charge-release chosen slot;
instrument: stale activeTarget"` → **`b0f5c159c46e`** (17th cut event; identical tree → identical id, as the
void-games report predicted). `data/engine-release.json` moved with it (21:34:22Z).

**Prediction, written before (d) ran** — `data/verification/_prediction-2026-09-09-wave-remeasure.json`,
21:40:41Z: 961 played, **void 0**, **BOARD-MATERIAL 0 of 961** (range 0-1), **NARRATION-ONLY 14 raw**
(range 13-15), causes 14 (13-16).

Every run via `MSYS_NO_PATHCONV=1 cmd /c "tools\lownode.cmd ..."` (from Git Bash `cmd /c` is path-converted to
`C:/` and cmd then reads `verification/c` as its switch — the first attempt died that way; recorded so nobody
repeats it). Success judged by log size and the artifact's `generated` stamp.

| step | command | before (b730) | after (b0f5c159c46e) | stamp moved |
|---|---|---|---|---|
| (a) | `tests\test-engine-diff.js --n 6000 --seed 20260804` (publishes via the guard; stamps `liveStamp()`) | 11:57:17Z | **6000 / 6000 / 0**, 21:41:25Z | yes |
| (b) items | `tests\roster.js --stage items --reds --write --release b0f5c159c46e` | 11:54:46Z | **142 of 148 MATCH, 0 DIFFER, 0 DID-NOT-FIRE**, 6 COULD-NOT-STAGE, reds 18/18 aimed, 21:42:02Z | yes |
| (b) abilities | `--stage abilities --reds --write --release b0f5c159c46e` | 11:55:09Z | **139 of 202, 0 / 0**, 44 CNS, 14 CONTROL-NOT-QUIET, 5 DEFERRED, reds 44/44, 21:42:27Z | yes |
| (b) moves | `--stage moves --reds --write --release b0f5c159c46e` | 11:55:33Z | **487 of 500, 0 / 0**, 10 CNS, 3 DEFERRED, reds 36/36, 21:42:53Z | yes |
| (c) | `engine\all_mechanics_fire.js --kind all --write --release b0f5c159c46e --census data/verification/census-pin-098de5770623.json` | 11:57:33Z | moves 500 exist / 495 resolved / 4 diverged / 11 resolution disagreements; abilities 316 / 104 fired / 1 diverged; items 148 / 64 / 0 — **field for field the 2026-09-08 figures**; census PINNED, "identical to the live census"; 21:43:49Z | yes |
| (d) | `engine\game_differential.js --steering empirical --release b0f5c159c46e --arm middle --end-state --state --games 1200 --team-store data/team-pool-frozen --turns 50 --census data/verification/census-pin-098de5770623.json --write` | 961 / 958 readable / **3 void**; BM 0 of 958; 13 diverged among usable | **961 played / 961 readable / 0 void**; **BOARD-MATERIAL 0 of 961**; **NARRATION-ONLY 14 raw, 14 causes**, all 14 SAME END STATE; protocol agreed 947/961; THREW 1; 21:46:58Z | yes |

Census pin: `data/verification/census-pin-098de5770623.json` = `git show HEAD:data/mechanics-census.json`
(digest `098de5770623` raw and LF, equal to the live file). Under `--steering empirical` the census is CREDITED
ONLY and does not select the sample, so the pin cannot have moved which games played. Pool pin
`data/team-pool-frozen`, pool digest `f807cbc40299`, 8778 teams. `--games 1200` and `--turns 50` are part of
the sample definition and are recorded for that reason.

**Prediction vs result:** hit at the point estimate on every clause — void 3 → **0**, BOARD-MATERIAL **0 of 961**
with **no void exclusion hiding anything** (`by_reason: {shared-addresses-agree: 961}`), NARRATION 13 → **14 raw**
(+1 = the Future Sight game leaving the void set as narration). The omit-protect ex-void game
(`2662758209 vs 2662995339`) now **AGREES** — that one rests on ENGINE's two fixes. THREW 1 is the pre-existing
harness case `p1 "move 4, move 1": Can't move: Floette's Protect is disabled` (present at 1 in the previous
row too), counted, not dropped.

**`node engine/status.js` (read-only) clause lines, after:**
```
PASS  game differential              clean at BOTH corners of the damage roll: midpoint 0 of 6000, top 0/6000,
PASS  deliberate roster / items      clean: 142 of 148 tested
PASS  deliberate roster / abilities  clean: 139 of 202 tested. 14 row(s) count in NEITHER column — the control arm
PASS  deliberate roster / moves      clean: 487 of 500 tested
PASS  coverage / every used mechanic is measured by something clean: all 412 moves above 25 clicks are measured by
PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 961 games. Every
      compared turn boundary in every game holds the SAME BOARD on both engines. [...] RAW, AND NOT BY OVERSIGHT
FAIL  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: 13 of 961 =
      1.4% of games diverge in NARRATION and never part a board, across 14 cause(s) (14 narration-only raw, less 1
      declared and 0 cleared on decision impact). [...] THIS CLAUSE NOW HOLDS THE GATE SHUT.
PASS  mechanics / each one staged and compared against showdown every mechanic anybody plays agrees with the
PASS  no open, known engine defect   clean: no open row names an instrument that is RED
MEDICHAM is not correct — 1 of 9 gate clauses fail (whole-game differential / NARRATION)
```
Before this pass the same output read **6 of 8 clauses FAIL**, every one `MEASURED AGAINST A DIFFERENT ENGINE`
(b730e44f3314 vs tree b0f5c159c46e). Gate: **8 of 9 PASS**, board-material bar met at zero on 961, narration
holds the gate at 13 (clause) / 14 (raw).

Side-effects of the chain, expected and recorded: `data/published-samples.json` (engine-diff publish guard,
21:41:25Z), `data/roster.json` + the three `roster.*.prev.json`, `data/provenance-stamp.json` (the ratchet,
written by `status.js` at 21:48Z — status is not strictly read-only).

## 4. `tests/test-engine-release.js`

`tools\lownode.cmd tests\test-engine-release.js` (ABRA-HEAP 6144 honoured): **80 passed, 0 failed**
(21:48-21:49Z). The header's own figure "71 passed" is stale by nine; the count is read from the run.

## What I did not touch, and what is in the tree that is not mine

- `engine/game_differential.js` carries a SECOND uncommitted hunk (authority-drift refusal before `ER.cut`,
  mtime 20:46Z) that is not mine. My diff is the 1623 hunk only.
- ~50 tracked files modified at 20:46-21:06Z by other divisions (`engine/medicham2-browser.js`,
  `engine/engine_release.js`, `engine/quarantine.js`, `data/nmf*`, `data/next-regulation.json`, ingest workflow,
  docs) and untracked reg-MC stores. Reported, left alone. None were deleted.
- Untracked files I created: `data/verification/census-pin-098de5770623.json` (the pin the three new artifacts
  cite — must be committed with them), `data/verification/instrument-551-dump.json`,
  `data/verification/_prediction-2026-09-09-wave-remeasure.json`, this report.

## Proposed rows (not applied)

**RUNNING-NOTES row 1 (MEASURE).** What changed: `.gitattributes` gains `data/releases/** -text`; release
`b730e44f3314` restored per-file from its manifest (18 → LF, 9 CRLF kept) and re-staged. Measured: b730 opens,
`verify` 0 bad; 24 of 26 older tracked releases open, the 2 that do not are PRUNED (2026-08-05), not EOL;
637 releases in the store, 631 verify clean. Supersedes: nothing. **Basis.** unchanged. Owes: nothing.

**RUNNING-NOTES row 2 (MEASURE).** What changed: `engine/game_differential.js:1623` — the middle arm's address
folds `activeTarget` in only while a move is active (ROADMAP #551). Measured: omit-spread config on
`b0f5c159c46e`, 128 played, void 2 → 0; game `2657358877 vs 2657413811` reads NARRATION-ONLY (Future Sight
`-end` unwritten), SAME END STATE. Supersedes: the "3 void" count of the 11:48Z artifact. **Basis.** unchanged.

**RUNNING-NOTES row 3 (MEASURE).** What changed: NO CODE. Full gate chain re-run on `b0f5c159c46e`, pins
`--steering empirical --arm middle --end-state --state --census data/verification/census-pin-098de5770623.json
--games 1200 --turns 50 --team-store data/team-pool-frozen`. Measured: `data/engine-diff.json` 6000/6000/0;
roster items 142/148, abilities 139/202, moves 487/500, each 0 DIFFER / 0 DID-NOT-FIRE; `data/all-mechanics-fire.json`
field-for-field the 2026-09-08 figures; `data/game-differential.json` **961 played / 0 void / BOARD-MATERIAL 0 of
961 / NARRATION-ONLY 14 raw (clause 13 of 961) across 14 causes / 947 of 961 protocol-identical / THREW 1**.
`status.js`: 8 of 9 PASS, gate held shut by NARRATION alone. Prediction (written 21:40:41Z) hit at the point on
every clause. Supersedes: `961 / 958 / 3 void, BOARD-MATERIAL 0 of 958` (b730). **Basis.** unchanged.

**CHANGELOG (MINOR) bullets.** Fixed: `game_differential.js` addressed a between-action die to a stale
`activeTarget` left by a residual hit (Future Sight), voiding a game as low-identity; the target is folded in
only while a move is active. Fixed: release `b730e44f3314` restored byte-exact from its manifest after a
checkout rewrote its line endings; `data/releases/** -text` keeps every tracked snapshot byte-stable on every
machine without moving a release id. Changed: gate artifacts re-measured on `b0f5c159c46e` — BOARD-MATERIAL
0 of 961 with 0 void, NARRATION-ONLY 14 raw / 13 clause; 8 of 9 clauses PASS.

## OWED, NOT RUN

- Commit: `.gitattributes`, `engine/game_differential.js` (1623 hunk), the staged `data/releases/b730e44f3314`,
  the five re-measured artifacts + `data/roster.json` + `.prev.json` files, `data/published-samples.json`,
  `data/provenance-stamp.json`, `data/engine-release.json`, and `data/verification/census-pin-098de5770623.json`
  (without it the three new artifacts cite a pin file that is not in git). Sole publisher's job, not mine.
- The three RUNNING-NOTES rows and CHANGELOG bullets above.
- ENGINE, unchanged from the void-games report: Future Sight into an immune target (`-end`/`-immune` unwritten —
  now the visible narration row for game 2657358877); Rest under Misty Terrain.
- `tests/test-engine-release.js` header says "71 passed"; it reports 80. Prose, one number, to fix.
- Nothing in the chain was cut short; no step exceeded 3 minutes wall clock.
