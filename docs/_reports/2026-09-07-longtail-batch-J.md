# LONG-TAIL BATCH J — the spread/hazard named target is a DIE (resumed after a process exit)

*Written as the work happened. Rows are appended; nothing above a row is rewritten.*

## 0. WHAT WAS ON DISK WHEN THIS SESSION STARTED

HEAD `507ddeab`, working tree carrying an uncommitted 120-line addition to
`engine/medicham2-browser.js`, `tests/probe_spread_target_die.js` (463 lines, untracked),
`data/verification/_prediction-2026-09-07-spread-target.json`, and `data/verification/batchJ/`
holding three artifacts.

**All four JSON artifacts parse and all three differential/diff artifacts are COMPLETE runs**
(checked by parsing and by reading the terminal fields, not by file size):

| file | verdict |
|---|---|
| `data/verification/batchJ/before-0c8b0dc63766.json` | complete. release `0c8b0dc63766`, medicham digest `b74f0abb929f`, 961 games, 87 protocol, `state.games` 961 less `games_board_never_diverged` 945 = **board-material 16** |
| `data/verification/batchJ/thirdarm-791c9fd873f3-knob.json` | complete. release `791c9fd873f3`, medicham digest `950975bb4969`, 961 games, 87 protocol, **board-material 16** |
| `data/verification/batchJ/engine-diff-before.json` | complete seeded engine-diff |
| `data/verification/_prediction-2026-09-07-spread-target.json` | complete, `written_before_measuring: true`, seven predictions P1..P7 |

**The two whole-game artifacts are 339,864 characters each and agree on every counter I read.**
That is the third-arm control behaving: NEW bytes + `MEDI_NAMED_TGT_CLICKED=1` reproduces the OLD
engine exactly.

**AND IT IS NOT SELF-EVIDENT, BECAUSE THE ARTIFACT CARRIES NO KNOB STAMP.**
`game_differential.js` does not record `MEDFAILS.namedTgtClickedRestored`, so "identical" is equally
consistent with *the knob was never set and the fix changes nothing*. That is settled below by the
AFTER run, not by these two files.

**One correction to the brief's stated baseline.** The brief says protocol 88 / narration 70. The
artifact on disk reads `protocol_diverged_games` **87** and `protocol_diverged_board_never_did`
**71**; the prediction file records "70 (71 raw less 1 declared)". Baseline used throughout this
report: **board-material 16 of 961, protocol 87, narration 71 raw / 70 net.**

## 1. THE PROBE — READ, RUN, AND SHOWN RED UNDER ITS OWN RESTORE ARM

`tests/probe_spread_target_die.js` passes `node --check`. It is not the previous batch's
never-run syntax error; it plays real boards on both engines.

What it derives rather than types: the class list comes from `dex.moves.all()`; chooseability is
`BattleActions#targetTypeChoices` **called** (`BAP.targetTypeChoices.call({}, cls)`), not copied;
the near-side clause and `useMoveInner`'s `self || allies` override are matched against the compiled
`dist/sim/battle.js` and `dist/sim/battle-actions.js` and the file exits 2 if either stops reading
that way; the carriers come from learnsets filtered by
`s.exists && !s.isNonstandard && s.tier !== 'Illegal'`.

Run on the live (fixed) bytes, `SHOWDOWN_PATH` set, via `tools\lownode.cmd`:

```
  classes whose named target is a DIE  : allAdjacent, allAdjacentFoes, foeSide, randomNormal, scripted
  classes the authority answers with the USER: all, allies, allySide, allyTeam, self

=== THE SWEEP — 44 scored DIE cells, 20 scored NEAR-SIDE cells, 50 control cells ===
CLAUSE B — the authority answered p2a/p2b across 44 die cells.
CLAUSE C — 44 of 44 die cells AGREE.
CLAUSE D — 50 named-target control cell(s).   every named-target click is honoured by both engines.
CLAUSE E — 20 near-side cell(s) across all/allies/allySide/self.   every near-side click names the user.
=== THE RESTORE ARM — MEDI_NAMED_TGT_CLICKED=1, in a child ===
  child CLAUSE C — 30 of 44 die cells AGREE.
  child die-cell disagreements: 14
  the knob moves 14 die cell(s) — the fixture reaches the rule.
PROBE GREEN — all clauses passed.
```

**The red-first evidence is the restore arm and it is not decorative.** 14 of 44 die cells name a
different body under `MEDI_NAMED_TGT_CLICKED=1`, and the probe FAILS ITSELF if that number is zero
("THE KNOB CHANGED NOTHING ... a green run above is therefore evidence of nothing"). Clause B proves
the authority itself varied (p2a AND p2b), so agreement is not free. Controls D (50 cells) and E
(20 cells) are clean in BOTH arms, so the change did not widen into aimed clicks or into the classes
the authority answers with the user.

**32 cells were REFUSED and named**, all for the same declared reason: `attrLastMove('[still]')`
blanks the authority's target field on a move that failed, so there is no answer to compare
(stealthrock, stickyweb, counter, metalburst, lifedew, healbell, the screens...). Four more were
NOT PLAYED — `chillyreception` and `allyswitch` reject the paired `pass` choice. All printed.

**The bytes are the release.** `data/releases/791c9fd873f3` carries
`engine/medicham2-browser.js` at digest `950975bb4969`, and `sha256` of the live working-tree file
is `950975bb4969`. The release IS the uncommitted edit, so nothing had to be re-cut.

## 2. THE EDIT ITSELF, JUDGED ON ITS MERITS

120 added lines, three sites, one rule.

**Site 1 — the knob and the doctrine block** at `NAMED_TGT_CLICKED`
(`engine/medicham2-browser.js`, just below `DEFAULT_TARGET_FOE_ONLY`). Cites
`sim/side.ts:657`, `sim/battle-actions.ts:3`, `sim/battle.ts:2396/2461/2484`, `sim/pokemon.ts:770`,
`sim/battle-actions.ts:418/428/457`. `MEDI_NAMED_TGT_CLICKED=1` stamps
`MEDFAILS.namedTgtClickedRestored` at load.

**Site 2 — the resolution**, in `battleTurn`'s dispatch, immediately BELOW the slot re-aim and ABOVE
the address write. Guarded `if(!NAMED_TGT_CLICKED && !_ovr && it.a && it._nameTgt===undefined)` and
gated on `targetClass.chooseable === false` **and** `!TAGS.has('move',id,'randomTarget')`, so the
Encore override and the `randomNormal` re-roll — both of which already draw at this address — are
not drawn for twice.

**Site 3 — one reader.** `_actionNamedTgt(it,m)` returns `it._nameTgt` when the resolution wrote one
and `reaimToSlot(...)` otherwise, and it replaces the target expression at all three places that ask
the question: `_midWriteActionAddr` (the dice address), the `|move|` line's target field, and the
`midAddrMovedAtAnnounce` cross-check.

**Four things I checked rather than took on trust:**

1. **The near-side split is not re-expressed.** It calls `defaultTargetOf`, which is this engine's
   existing single implementation of `getRandomTarget`, and whose `DEFAULT_TARGET_SELF` is
   `self, all, allySide, allyTeam, adjacentAllyOrSelf` — byte-identical to the clause the probe reads
   out of `dist/sim/battle.js` this run.
2. **`allies` spends a die and then names the user anyway.** `allies` is NOT in the near-side clause,
   so the authority reaches `randomFoe()` and draws, and only then does `useMoveInner:418` override.
   The engine models it in that order (`_nt=defaultTargetOf(...)` first, `if(target==='self'||
   target==='allies')_nt=m` after) instead of short-circuiting, which would leave the shared `tgt`
   address one `nth` behind for the rest of the game. This is the subtle half and it is right.
3. **The address is the same one the `randomNormal` re-roll uses** —
   `midTargetDraw(_R,rng,moveId,midEventSlot(attacker),liveCount)`, keyed on the MOVE and the
   ATTACKER, because the authority draws before `setActiveMove` and has no `activeTarget` in scope.
4. **The hit set is untouched.** `_nameTgt` is read by the address write and the `|move|` line and by
   nothing mechanical, which is correct: `getMoveTargets` rebuilds the list from adjacency for every
   class that reaches here.

**One cosmetic over-count, declared:** `namedTargetDrewFoe` increments inside the `pick()` closure
before the empty-list guard, so a click with zero living foes is counted as a draw that did not
happen. No die is consumed. It is a counter, not a rule.

**VERDICT ON THE LEFT-BEHIND EDIT: SOUND, COMPLETE, AND ITS PROBE IS REAL.** It is not the previous
batch's half-applied fix; it is a whole change with a bound knob, a green probe and a red restore arm.

## 3. THE BOARD-MATERIAL SET BEFORE, BY CONFIG — 16 ROWS

`omit-spread` 3, `pair-redirect-priority` 5, `pair-speedctrl` 3, `pair-protect-bust` 2,
`omit-protect` 1, `omit-weather` 1, `omit-intimidate` 1.

P1's named row is the last one:
`pair-speedctrl | gen9championsvgc2026regmbbo3-2662992072`, turn 6, single diff
`p1.pp[0].hypervoice` medicham **3** vs showdown **2**.

## 4. THE MEASUREMENT — THREE ARMS, ONE SAMPLE LINE

**The sample line, in full, identical for all three arms** (only `--release` differs):

```
node engine/game_differential.js --steering empirical --release <ID> --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

Pins: release as named; census `data/verification/census-pin-9446a684709d.json`, digest
`9446a684709d` verified by sha256 this session; `--team-store data/team-pool-frozen`, pool digest
`0d103fb9fa87`; `--games 1200` (961 played); `--turns 20`; arm `middle`; steering
`empirical-click/v1`. Run through `cmd.exe //c "tools\lownode.cmd ..."`.

| arm | release | medicham digest | games | protocol | **board-material** | narration raw |
|---|---|---|---|---|---|---|
| BEFORE | `0c8b0dc63766` | `b74f0abb929f` | 961 | 87 | **16** | 71 |
| THIRD ARM, `MEDI_NAMED_TGT_CLICKED=1` | `791c9fd873f3` | `950975bb4969` | 961 | 87 | **16** | 71 |
| AFTER (fix live) | `791c9fd873f3` | `950975bb4969` | 961 | 83 | **13** | 70 |

The bar is `state.games` (961) less `state.games_board_never_diverged` (948 after, 945 before). It
is NOT `by_cause_totals.games_board_material`; that field independently reads 13 causes / 13 games
in the after run, which agrees, and it is quoted here as corroboration and not as the bar.

**THE THIRD ARM IS WHAT PROVES THE KNOB WAS ACTUALLY SET.** The differential artifact carries no
`MEDFAILS` stamp, so knob-run == before-run is on its own equally consistent with *the knob was
never bound and the fix does nothing*. It is settled by the AFTER arm: same bytes, same pins, knob
absent, **13 / 83 / 70**. Identical bytes cannot give two answers unless the environment variable
was doing the work.

## 5. TRANSFERS — THERE ARE NONE, WHICH IS BETTER THAN PREDICTED

The board-material set is diffed on `config | seed`, not on the count.

**CLOSED — 3, and all three are the ones the mechanism predicts:**

| config \| seed | turn | the board diff that closed |
|---|---|---|
| `pair-speedctrl \| ...bo3-2662992072` | 6 | `p1.pp[0].hypervoice` 3 vs 2 — **P1's named row** |
| `pair-speedctrl \| ...bo3-2661118824` | 5 | sneasler/sinistcha hp + `p2.pp[0].matchagotcha` |
| `pair-redirect-priority \| ...bo3-2634523782` | 3 | raichu fainted vs `raichumegay` alive — a whole mega that did not happen |

**OPENED — 0. TRANSFERRED — 0.** The 13 held rows are BYTE-IDENTICAL between the two artifacts,
same turn and same diff list. P2 warned that this change moves every `any` address on every
non-chooseable click and that games could enter the set; none did.

## 6. `arms_comparable` — VERBATIM, BOTH PAIRS

Pair 1, the third-arm pair (same release, knob vs no knob):

```
  NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.
  COMPARABLE. Both arms selected their sample the same way, so a difference between
  their numbers is the change under test.
```
exit 0.

Pair 2, the cross-release before/after:

```
  COMPARABLE. Both arms selected their sample the same way, so a difference between
  their numbers is the change under test.
```
exit 0.

Both printed the same three refusals-to-see: the driver is checked but only its static `require`
closure; `data/protocol-events.json` (the declared skip list) is not stamped; and an uncommitted
edit inside `SHOWDOWN_PATH` is invisible beyond `showdown_commit`.

**P7 called this in advance and it is a limit of the checker, not a licence.** `arms_comparable`
answers COMPARABLE for the cross-release pair because it checks steering and run parameters and not
dice addressing — the pin genuinely moved. The third-arm pair is what the delta rests on; the
cross-release pair is quoted because the checker was asked and its answer is recorded verbatim.

## 7. THE BUCKETING, RE-DERIVED AGAINST `state.first_board_divergences`

**THERE IS NO LARGEST BUCKET LEFT. 13 board-material games, 13 DISTINCT causes, one game each.**
That is the by-cause table's own reading (`BOARD-MATERIAL 13 causes, 13 games`) and it is what the
13 rows of `state.first_board_divergences` show when they are joined on turn.

Bucketed instead by the SHAPE of the board leaf that parted — which is the bar's own list, and the
only grouping available now that every cause is a singleton:

| n | shape of the diverged board leaf | rows |
|---|---|---|
| 4 | hp only | omit-spread t11, pair-protect-bust t7, pair-protect-bust t6, pair-redirect-priority t8 |
| 3 | hp + status | omit-protect t4, omit-intimidate t3, pair-redirect-priority t4 |
| 2 | hp + status + fainted | omit-spread t6, pair-redirect-priority t6 |
| 1 | item | omit-weather t7 |
| 1 | hp + fainted + status | omit-spread t3 |
| 1 | hp + fainted + status + pp | pair-redirect-priority t5 |
| 1 | hp + pp | pair-speedctrl t5 |

By config: `omit-spread` 3, `pair-redirect-priority` 4, `pair-protect-bust` 2, `pair-speedctrl` 1,
`omit-protect` 1, `omit-weather` 1, `omit-intimidate` 1.

`state.board_parted_before_the_protocol_did` is **0** — every remaining board divergence has a
protocol divergence at or before it, so the by-cause list is not blind to any of them.

The 13 causes in full, from the after run's own worklist:

```
 t4  extra event emitted by medicham2 :: |move|p2b|moonblast <> |-status|p1a|brn
 t7  event missing from medicham2     :: |-enditem|p1b|roseliberry|[eat] <> |-damage|p1b|H/H
 t3  event missing from medicham2     :: |-status|p2a|psn|[from]poisontouch <> |upkeep
 t6  event missing from medicham2     :: |-end|p2a|futuresight <> |-sideend|p1:|reflect
 t3  unrelated event mismatch         :: |-damage|p2a|0fnt <> |-resisted|p2b|1
 t11 unrelated event mismatch         :: |-fail|p1a <> |-resisted|p2a|1
 t7  -damage field 3                  :: mudsdale 14/175 vs 7/175
 t6  extra event emitted by medicham2 :: |move|p2b|rockslide <> |-hitcount|p1:|1
 t8  event missing from medicham2     :: |-fail|p1a <> |move|p1b|rockslide
 t5  unrelated event mismatch         :: |move|p1a|moonblast <> |-damage|p1a|H/H|[from]confusion
 t6  extra event emitted by medicham2 :: |faint|p2b <> |-start|p1b|perish0
 t4  event missing from medicham2     :: |-damage|p2b|H/Hfrz <> |-curestatus|p2b|frz|[msg]
 t5  ordering                         :: |-end|p1b|substitute <> |-resisted|p1a|1
```

**So "work the largest bucket first" has no answer at this level any more, and saying so is the
finding.** The next batch is thirteen separate root causes, not one family. The two nearest things
to a pair are the two `rockslide` rows (t6 and t8, both about whether a Rock Slide's click is
emitted at all) and the two `|-fail|p1a` rows (t8, t11).
