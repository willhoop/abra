# 2026-09-09 — MEASURE: gate honesty (void boards), staged release, authority pin, ingest guard, self-play ids

Historical findings record. Not maintained; superseded by the register rows it feeds. Every figure
below names the command or artifact it was read from. Written by the MEASURE agent that took over
after the previous one was killed mid-edit by an API limit.

Clock at start: `2026-09-09T20:42:34Z`. ABRA HEAD at start of this session: `49793320` (the
coordinator's snapshot said `bf4ff432`; three commits landed before this session began —
`d6789951`, `a150fe7d`, `49793320` — so every `git diff` below is against `49793320`).

---

## 0. Audit of the killed agent's partial work — KEPT / REVERTED

| file | diff | verdict | how verified |
|---|---|---|---|
| `engine/quarantine.js` | +142 | **KEPT** | `node --check` OK; `tools\lownode.cmd engine\quarantine.js --selftest` → **239 passed, 0 failed** (HEAD had 215 `ok(` calls, tree has 219; the 4 new arms all print `VOID`). Every hunk read (below). |
| `engine/engine_release.js` | +70 | **KEPT** | `node --check` OK; `tests/test-engine-release.js` → **80 passed, 0 failed**; red/allow/green shown in §3 without a real cut. |
| `engine/game_differential.js` | +11 / −1 | **KEPT** | 6 code lines + 3 comment lines + the 2-line `cut()` call. Runs before any game; touches no measurement path (refuses or falls through). Live authority matches the pin today (§3), so the other agent's next run is not refused. |
| `engine/champions_sim.js` | none | nothing to audit | `git diff` empty. `PINNED_COMMIT` / `actualCommit()` / `verify().commit_matches` already existed at :85, :231, :259 — the consumer was the missing half. |
| `.github/workflows/ingest.yml` | +17 | **KEPT** (this IS item 4, already landed) | js-yaml parses it; see §4. |
| `build/compress-stores.js` | +16 / −1 | **NOT MINE — left, reported** | The HEAD~1 superset guard the coordinator verified is ALREADY IN HEAD (`49793320`, `:456-465`, `:523`). The working-tree diff is something else: `NEXT_REG_RAW`, sharding `data/games.gen9champions*.raw-logs.jsonl` for the next-regulation collector. `data/next-regulation.json` is also modified and `.github/workflows/next-regulation.yml` is on my do-not-touch list, so this belongs to whoever owns next-regulation. Not reverted: reverting another agent's live edit is the 2026-08-04 failure in the other direction. |
| `data/engine-release.json` | pointer moved to `b0f5c159c46e` | **NOT status noise — left** | `why` is `game_differential.js`'s literal cut string, cut `18:49:11Z`. Another agent ran the differential without `--release` and cut the live tree. `node engine/engine_release.js drift b730e44f3314` says the one moved source is `engine/medicham2-browser.js` (45,345 → 45,442 lines; first difference at normalised line 1774) — ENGINE's live work. Reverting the pointer would misstate the newest release. |
| `data/provenance-stamp.json` | `verified` 10 → 7, regenerated `18:50:05Z` | **regenerated noise — left** | `engine/provenance.js:1691/1694` rewrites this on every run, and `status.js` spawns provenance.js. The read-only `status.js` run in §1 rewrites it again. Nothing to keep or revert by hand; it is whatever the last provenance run said. |
| `data/conformance.json`, `data/next-regulation.json`, `data/nmf-roles.json`, `data/nmf.js`, `data/replay-differential-freezes.json`, `data/store-validation.json`, `data/whole-game-baseline.json` | modified | **NOT MINE — untouched** | Other divisions' artifacts. The shared scratchpad holds `edit_rest.py` (14:48 local) naming `whole-game-baseline.json` and `replay-differential-freezes.json`, `edit_engine.js` naming `medicham2-browser.js`, `blast.js` naming `docs_scan.js` — none executed, none mine. Reported so the coordinator knows which agent's scripts they are. |

**Nothing was reverted.** Every engine-side hunk the killed agent left was complete, syntactically
whole, and passes the instrument that exists to check it.

---

## 1. BOARD-MATERIAL counts the void games whose boards parted

**Artifact read:** `data/game-differential.json` — mtime `2026-09-09 15:44:41Z`, byte-identical to
HEAD (`git diff --stat` empty), `generated 2026-09-09T11:48:00.710Z`, `engine_release b730e44f3314`.
No re-run. Fields, read with one `node -e`:

```
games 961   state.games 958   state.games_board_never_diverged 958   state.games_void_excluded 3
state.protocol_diverged_games 13   state.protocol_diverged_board_never_did 13
mid_void.void_games 3   mid_void.usable_games 958
mid_void.void_game_tags[]:
  omit-protect  gen9championsvgc2026regmbbo3-2662758209 vs gen9championsvgc2026regmbbo3-2662995339  low-identity  turns 7   protocol turn 4  board_parted_at_turn 4
  omit-spread   gen9championsvgc2026regmbbo3-2657358877 vs gen9championsvgc2026regmbbo3-2657413811  low-identity  turns 10  protocol turn 5  board_parted_at_turn 6
  omit-spread   gen9championsvgc2026regmbbo3-2658645239 vs gen9championsvgc2026regmbbo3-2658775286  low-identity  turns 3   protocol turn 3  board_parted_at_turn 3
```

**BEFORE (HEAD arithmetic, `material = state.games − state.games_board_never_diverged`):**
`958 − 958 = 0` → `BOARD-MATERIAL: 0 of 958 games` → clause PASS → narration clause promoted to
gating. This matches the killed agent's captured before-receipt ("HEAD: PASS ... 0 of 958,
narration 'reads zero, so narration now gates'") and commit `49793320`'s FILED-NOT-FIXED entry.

**AFTER (tree arithmetic):** `stateMaterial = 0`, `voidParted = 3` (all three tags carry a numeric
`board_parted_at_turn`), `played = 958 + 3 = 961`, `material = 3`; `voidUncaused = 0` because all
three tags carry a numeric `protocol_diverged_at_turn`, so `uncaused = (0 − (13−13)) + 0 = 0`.

**Clause lines from `tools\lownode.cmd engine\status.js` (read-only, no `--write`, exit 0, 8 min):**

```
FAIL  whole-game differential / BOARD-MATERIAL — games whose boards part MEASURED AGAINST A DIFFERENT ENGINE —
      data/game-differential.json ran on release b730e44f3314 and the tree is b0f5c159c46e. That is not a weaker
      answer, it is an answer about other bytes. EVERY COUNT IN IT IS WITHHELD and none is repeated here. WHY THE
      DIGEST MOVED: 1 of 1 moved source(s) really changed — engine/medicham2-browser.js. A re-measurement IS owed.
FAIL  whole-game differential / NARRATION — protocol divergence with no board effect MEASURED AGAINST A DIFFERENT
      ENGINE — data/game-differential.json ran on release b730e44f3314 and the tree is b0f5c159c46e. [same text]
MEDICHAM is not correct — 6 of 8 gate clauses fail (game differential; deliberate roster / items; deliberate
roster / abilities; deliberate roster / moves; whole-game differential / BOARD-MATERIAL — games whose boards part;
mechanics / each one staged and compared against showdown); 1 reporting clause(s) also red (whole-game
differential / NARRATION — protocol divergence with no board effect)
```

**So the live tree cannot print `3 of 961` today, and it is right not to:** ENGINE edited
`engine/medicham2-browser.js` live at ~18:46Z (45,345 → 45,442 lines), the tree digest moved to
`b0f5c159c46e`, and every count in an artifact stamped `b730e44f3314` is withheld by the pin guard. The
summary line is the new `gate_failing` wording — "6 of 8 gate clauses fail ... 1 reporting clause(s) also
red" — where the old wording would have said 7 of 9 and counted narration as gating.

**What the clause READS against the artifact's own engine** — a scratch copy of HEAD `49793320`
(`git archive`, nothing registered in `.git`, live digest confirmed `b730e44f3314` by
`engine_release.liveStamp()`), first with HEAD's `quarantine.js` (BEFORE), then with the tree's
`quarantine.js` overlaid (AFTER); same artifact bytes, `node engine/quarantine.js --whole-game` and
`--narration`:

```
BEFORE  exit 0  PASS  whole-game differential / BOARD-MATERIAL — games whose boards part
                BOARD-MATERIAL: 0 of 958 games. Every compared turn boundary in every game holds the SAME BOARD on both engines.
        exit 1  RED   whole-game differential / NARRATION — 12 of 961 = 1.2% ... across 13 cause(s)
                THIS CLAUSE NOW HOLDS THE QUARANTINE GATE SHUT — the BOARD-MATERIAL clause reads zero, so narration now gates

AFTER   exit 1  FAIL  whole-game differential / BOARD-MATERIAL — games whose boards part
                BOARD-MATERIAL: 3 of 961 games (958 usable + 3 void) = 0.3% of games reach a turn boundary whose BOARD differs
                between the two engines (958 usable games less 958 whose board never diverged, both read straight off `state`,
                plus 3 void game(s) whose `mid_void` tag carries a `board_parted_at_turn`). ... This clause fails until it is zero.
                +3 void game(s) that parted a board before going low-identity — ... by seed:
                    board parted turn 4 (protocol turn 4)  omit-protect  gen9championsvgc2026regmbbo3-2662758209 vs gen9championsvgc2026regmbbo3-2662995339  low-identity
                    board parted turn 6 (protocol turn 5)  omit-spread   gen9championsvgc2026regmbbo3-2657358877 vs gen9championsvgc2026regmbbo3-2657413811  low-identity
                    board parted turn 3 (protocol turn 3)  omit-spread   gen9championsvgc2026regmbbo3-2658645239 vs gen9championsvgc2026regmbbo3-2658775286  low-identity
        exit 1  RED   whole-game differential / NARRATION — 12 of 961 = 1.2% ... THIS CLAUSE REPORTS, IT DOES NOT HOLD THE GATE SHUT
                this clause does NOT hold the quarantine gate shut — the BOARD-MATERIAL clause is still failing, so narration
                reports only (Will, 2026-08-22). This flips by itself when that clause reads zero.
```

**This re-closes the board clause. That is the truth:** the three games the void rule dropped are
the three games whose boards parted, and `0 of 958` was the count after the counterexamples left the
denominator. The NARRATION clause reads `boardClause.ok === true` (`quarantine.js:2964`) and stands
back down to reporting-only; its `gates` arithmetic is unchanged in kind and now honest in input.

**Selftest arms added (all green, `239 passed, 0 failed`):**
- `VOID / RED` — fixture with `state 958/958`, three void tags of which two carry
  `board_parted_at_turn` → reads `2 of 961 games (958 usable + 3 void)`, prints the two seeds and
  not the third.
- `VOID` — the void game whose tag says the protocol never diverged lands in UNCAUSED (1).
- `VOID` — narration clause reads the red board verdict and `gates === false`.
- `VOID / CONTROL` — same fixture, tags removed → `0 of 961`, PASS. The knob is wired.

Also kept: `withholder()`'s clause summary now counts `gate_failing` (the gating subset) rather than
`failing` (which includes reporting clauses), so "N of M gate clauses fail" names only gating clauses
and lists reporting reds separately.

---

## 2. The staged release

```
git diff --cached --name-only | grep -c releases/b730e44f3314   → 29
du -sh data/releases/b730e44f3314                               → 6.8M
du -sb data/releases/b730e44f3314                               → 7,128,203 bytes
git diff --cached --numstat (sum)                               → 146,041 lines
git diff --stat -- data/releases/b730e44f3314/                  → empty (index == worktree; cuts.jsonl 64 events both)
```

`data/releases/` is gitignored (`.gitignore:174`); the 29 files were force-added by the killed agent
and are still staged. Kept staged.

**Release ids the current gate artifacts stamp** (read from each file's `engine_release` /
`release` field): `data/engine-diff.json`, `data/all-mechanics-fire.json`,
`data/game-differential.json`, `data/roster.json`, `data/roster.items.json`,
`data/roster.moves.json`, `data/roster.abilities.json`, `data/roster.spine.json` → **all
`b730e44f3314`**. No second id to stage. (`*.prev.json`, `roster.all.json`,
`roster.moves.staging-trial.json`, `roster.abilities.pre-shape-rules.json` stamp older ids and are
not gate inputs; `data/whole-game-baseline.json` stamps `6272fa445b73` from 2026-08-27 and is not a
gate input either.) The live tree's own digest is `b0f5c159c46e` (see §0) — nothing gating stamps
it yet.

---

## 3. Authority pin consumer — `engine_release.js cut` refuses on drift

Consumer lives in `cut()` before a byte is hashed (`engine/engine_release.js:~542-563`), with
`authorityDrift(inject)` exported and three new `CUT_COUNTERS` (`authority_checks`,
`authority_refusals`, `authority_drift_allowed`). `game_differential.js` asks the same question on its
`--release <id>` path (which never cuts) and exits 2 on drift unless `--allow-authority-drift`.

**Live state:** `pinned 20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4 == actual` → `drifted:false`.

**RED via the CLI, env override** (`SHOWDOWN_PATH=.` makes `actualCommit()` read ABRA's own HEAD):

```
$ SHOWDOWN_PATH=. node engine/engine_release.js cut "authority pin red demo — must refuse"
Error: cannot cut a release — THE SHOWDOWN CHECKOUT IS NOT THE PINNED AUTHORITY.
  pinned   20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4  (champions_sim.js PINNED_COMMIT)
  checkout 497933205a6dc49a3a5603b54363f9821d024956  (HEAD of the Showdown checkout that would load)
exit=1
releases before=637 after=637   data/engine-release.json md5 before=baf4c2af9f7a after=baf4c2af9f7a
```

**RED / ALLOW / GREEN via the API in scratch stores** (`{ store: <scratch> }` — prints "the real
store ... is untouched"; verified: 637 releases and the same pointer digest before and after):

```
RED   cut('..', {store, authority:{pinned:'PIN000', actual:'DRIFT1'}})        → THROWS, names both; releases dir NOT created
      counters {authority_checks:1, authority_refusals:1, authority_drift_allowed:0}
ALLOW cut('..', {store, authority:{...}, allowAuthorityDrift:true})            → id b0f5c159c46e; last cut event carries
      authority_drift_allowed: {"pinned":"PIN000","checkout":"DRIFT1"}; counters {2,1,1}
GREEN cut('..', {store: <second scratch>})  (live authority)                   → id b0f5c159c46e; no drift key in event; counters {3,1,1}
```

No release was cut for real. `tests/test-engine-release.js` → 80 passed, 0 failed.

---

## 4. `compress-stores.js --check` wired into ingest.yml

Already in the tree when I arrived (the killed agent's hunk); verified, kept:

- `actions/checkout@v4` gains `fetch-depth: 2` with a comment saying why (`--check` reads HEAD~1;
  a depth-1 checkout would fail every run for the wrong reason).
- Main path: `node build/compress-stores.js --check` after `--raw` and before `add_artifacts`, under
  the step's existing `bash -e`, so red = no commit.
- Retry path (after `git reset --hard origin/main` and the re-shard): the same `--check` before
  `add_artifacts`.
- Style mirrors the file's block-capital comment convention.

```
js-yaml load → YAML PARSES; jobs [ 'ingest' ]; 14 steps; steps[0].with['fetch-depth'] = 2
compress-stores lines in run: blocks: --restore-parsed, --restore-raw, (bare), --raw, --check, then in retry: --restore-parsed, (bare), --raw, --check
```

`--check` itself: `trackedIds('HEAD~1', ...)` THROWS when HEAD~1 is unreadable (`:294`), which is
the correct behaviour for a guard — a shallow checkout fails loudly rather than passing by absence.

---

## 5. Self-play store — 89 duplicate ids (ROADMAP #536)

**The store as I found it** (`data/games.selfplay.jsonl`, gitignored at `.gitignore:47`, so there
is no git "before"; mtime `2026-09-09 18:40:10Z`, i.e. two hours before this session):

```
bytes 31,915,988   lines 3,090   CRLF 0   ends with LF   unique ids 3,090   duplicate ids 0
tools\lownode.cmd engine\validate_selfplay.js → exit 0;  "ok  no duplicate ids (0)";  17 passed, 0 failed, 1 inconclusive
```

**What happened, reconstructed from the ids:** the register row says none of the 89 pairs was
byte-identical — two distinct batches sharing one `selfplay-1-N` sequence — so the brief's re-id
branch applies, not the drop-duplicates branch, and **3,090 → 3,001 lines is the wrong target: no
line should be dropped.** Someone (almost certainly the killed agent, at 18:40Z) already re-id'd the
colliding rows of the 2026-08-19 batch by run stamp:

```
2026-08-07 23:24 batch: 92 lines, ids selfplay-1-N                        (lines 2902-2993)
2026-08-19 23:51 batch: 97 lines                                          (lines 2994-3090)
   89 now read selfplay-1-1787183460-N   (1787183460 = 2026-08-19T23:51:00Z — the batch's own date as epoch)
    8 still read selfplay-1-N            (lines 2999, 3010, 3023, 3036, 3043, 3045, 3070, 3081 — N = 5,18,29,44,52,54,80,89)
stripping the stamp from the 89 re-id'd ids collides with the 08-07 batch in exactly 89 cases (= the register's 89)
the remaining 2,901 lines are the selfplay-8888000 / 8888750 / 8889500 / 8890250 series, untouched
```

So the duplicate clause is green and the line count is unchanged at **3,090 → 3,090**. What I
could NOT prove: "non-re-id'd lines byte-identical to before" — there is no before-copy (untracked
file, none in `data/`, none in the shared scratchpad). What I did not do: re-id the 8 non-colliding
08-19 rows to the stamped scheme for consistency. Uniqueness — the invariant #536 names — holds
without it, another agent is live, and rewriting a 32 MB store nobody is known not to be reading
is the photograph rule. Owed below.

---

## Proposed RUNNING-NOTES rows (NOT written — `docs/RUNNING-NOTES.md` is not mine this pass)

- **BOARD-MATERIAL re-closes at 3 of 961.** `engine/quarantine.js` adds every
  `mid_void.void_game_tags[]` row with a numeric `board_parted_at_turn` to the board count and the
  void set to the denominator; read off `data/game-differential.json` (release `b730e44f3314`,
  `generated 2026-09-09T11:48:00Z`), no re-run. **Supersedes** `BOARD-MATERIAL: 0 of 958` (the count
  after the three counterexamples left the denominator). Narration stands back down to reporting.
  **Basis.** unchanged — same question, the denominator now includes the games that answered it.
  Owed to: `docs/MEASURE.md`, `docs/ENGINE.md`.
- **The authority pin has a consumer.** `engine_release.js cut` refuses (exit 1, both commits named)
  when the Showdown checkout HEAD ≠ `champions_sim.js PINNED_COMMIT`; `--allow-authority-drift`
  records the drift in the cut event. `game_differential.js` asks the same on its `--release` path.
  Shown red via `SHOWDOWN_PATH=.` and green live. **Supersedes.** Nothing. **Basis.** unchanged.
- **ingest.yml runs `compress-stores.js --check` before every commit** (both paths), with
  `fetch-depth: 2` so HEAD~1 exists. **Supersedes.** Nothing. **Basis.** unchanged.
- **Self-play store: 89 colliding ids re-id'd by run stamp**, 3,090 lines / 3,090 unique,
  `validate_selfplay.js` duplicate clause green. 8 rows of the 08-19 batch keep plain ids.
  **Supersedes** ROADMAP #536's "3,001 unique". **Basis.** unchanged.

## Proposed CHANGELOG bullets (NOT written)

### Fixed
- The BOARD-MATERIAL quarantine clause counts void games whose boards parted before going
  low-identity; it reads `3 of 961` on `data/game-differential.json` where it read `0 of 958`, and
  the gate re-closes.
- `engine_release.js cut` refuses a cut when the Showdown checkout is not `PINNED_COMMIT`
  (`--allow-authority-drift` to override, recorded in the cut event); `game_differential.js`
  refuses likewise on `--release`.
- `data/games.selfplay.jsonl`: 89 colliding `selfplay-1-N` ids from the 2026-08-19 batch re-id'd
  as `selfplay-1-1787183460-N`; no game dropped.
### Added
- `ingest.yml` runs `build/compress-stores.js --check` after sharding and before commit, on both
  the first attempt and the push-race retry; checkout depth 2.
- Release `b730e44f3314` (29 files, 7.1 MB) tracked — the release every current gate artifact stamps.

---

## OWED, NOT RUN

- `node engine/status.js --write` — forbidden this pass; the ledgers still carry the pre-fix lines.
- `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md` #536 (close with the receipt above)
  and #551 (the void-board finding; the clause now counts them, per-game engine-vs-instrument
  attribution still owed) — not mine this pass.
- The 8 remaining plain-id rows of the 2026-08-19 self-play batch (lines listed in §5): re-id to
  the stamped scheme, or declare the mixed scheme acceptable. Cheap; wants a moment when nothing is
  reading the store.
- A cheap id-uniqueness check over the self-play store that plays no game and needs no heap
  (#536's "INSTRUMENT OWED") — `validate_selfplay.js` still reaches its duplicate clause only
  under `ABRA-HEAP`.
- The `build/compress-stores.js` `NEXT_REG_RAW` diff and the seven other modified `data/*` files
  belong to other divisions; nobody has confirmed them.
- Per-game attribution of the three void boards (seeds in §1): engine or instrument. The count is
  honest now; the cause is not known.
- `tests/run-all.js` — not run (forbidden). Only `quarantine --selftest`, `test-engine-release.js`
  and `validate_selfplay.js` were run singly.
