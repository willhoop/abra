# 6.0.0 — THE MEDICHAM DOCUMENT PASS, DRAFTED SO THAT ON THE DAY IT IS A PASTE AND NOT A REWRITE

MEASURE, drafted 2026-09-10 02:30–03:10 UTC. **A DRAFT. No living document was edited. Nothing was
committed.** `docs/_reports/` is historical by construction; every figure below was read out of the
artifact named beside it at drafting time and **must be re-read on the day** — the ones a batch can
move are marked `<RE-READ>`.

**THE BRIEF'S NUMBERS ARE ALREADY STALE, AND THAT IS THE FIRST FINDING.** The brief named release
`7d66b526659e` and `mid_void.diverged_among_usable` 10. Between the brief and this draft, narration
batch Z ran the whole chain on release **`489bea0577bc`** (`data/engine-release.json:current`, cut
`2026-09-10T02:07:36.611Z`) and rewrote every gate artifact between 02:07Z and 02:18Z. They are
**uncommitted** in the working tree (`git status`: `data/game-differential.json`, `data/engine-diff.json`,
`data/mechanics-census.json`, `data/all-mechanics-fire.json`, `data/roster.*.json`,
`data/engine-release.json` all `M`), and the release directory `data/releases/489bea0577bc/` is
**not tracked** (`git ls-files data/releases | grep -c 489bea0577bc` → 0; 29 releases are tracked).
The mtimes (02:07–02:18Z) were 9+ minutes settled at read time (clock 02:27Z), so these are not torn
reads. Every number in this draft is from those bytes. Account of the batch:
`docs/_reports/2026-09-10-narration-batch-Z-substitute.md`.

**THE GATE IS NOT OPEN AS OF THIS DRAFT.** `node engine/status.js` (read-only, via `tools/lownode.cmd`)
reads **1 of 9 clauses FAIL** — `whole-game differential / NARRATION`, **6 of 961** (7 raw less 1
declared, 7 causes). `node engine/major_readiness.js` reads **NOT READY**. So the NEW text below is
written for the day the narration clause reads **0**; wherever a sentence depends on that, it says so.

Legend: `path:field` is the artifact and key a figure was read from. `<RE-READ>` = a batch may move it
before the day. `<DAY>` = the fold-in date. "withheld; lifts on the re-run" and "withheld; STAYS" follow
`node engine/major_readiness.js`'s LIFT/STAY split (40 / 24 at drafting, `<RE-READ>`).

---

## 1. THE FIGURES, READ TONIGHT — ONE TABLE, EVERY OPERAND NAMED

All on release `489bea0577bc` `<RE-READ>`, authority commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`
(`*.json:showdown_commit`, identical in all six gate artifacts).

| figure | value | `path:field` |
|---|---:|---|
| games played (primary arm `middle`) | **961** | `data/game-differential.json:state.games` |
| games whose board never parted | **961** | `:state.games_board_never_diverged` |
| **BOARD-MATERIAL** = games − never-parted | **0 of 961** | subtraction of the two fields above — the gate's clause |
| games excluded as void | **0** | `:state.games_void_excluded`; `:mid_void.void_games` 0; `:state.games_before_void_exclusion` 961 |
| games cut off by the turn cap | **0** | `:state.games_cut_off_by_the_turn_cap`; cap `:turns_cap` 50; longest game `:mid_void.by_reason_detail.shared-addresses-agree.max_turns` 36 |
| turn boundaries compared / identical | **10,705 / 10,705** | `:state.turn_boundaries_compared`, `:state.turn_boundaries_identical` |
| protocol diverged games | **7** `<RE-READ>` | `:state.protocol_diverged_games`; `:mid_void.diverged_among_usable` 7 |
| of which board never parted | **7** `<RE-READ>` | `:state.protocol_diverged_board_never_did` |
| board parted BEFORE protocol / held longer | **0 / 0** | `:state.board_parted_before_the_protocol_did`, `:state.protocol_diverged_board_held_longer` |
| first-board-divergence rows | **[] (none)** | `:state.first_board_divergences` |
| end state, all 961 | **SAME-END-STATE 960, DIFFERENT 0, ENDED-APART 0, THREW 1** | `:end_state[0].summary.verdicts` |
| by-cause reconciliation | **causes 7, NARRATION_ONLY 7, BOARD_MATERIAL 0, reconciles true** `<RE-READ>` | `:end_state[0].summary.by_cause_totals` |
| **NARRATION clause** (status.js) | **6 of 961 = 0.6%**, 7 raw less 1 declared, 7 causes, all in exactly one game `<RE-READ>` | `node engine/status.js` NARRATION clause; `:classes[]` |
| the one declared (closeted) row | perish drain above `\|upkeep\|`, Will 2026-08-28, ROADMAP #440 — does not vote | `engine/quarantine.js` CLOSETED row; `:classes[] "event missing from medicham2 :: \|upkeep <> \|faint\|p1a"` |
| games that THREW | **1** — harness choice rejection (`"Can't move: … Protect is disabled"`), pre-existing | `:threw`, `:errors[0].err` |
| board leaves compared / ceiling / total | **54 / 54 / 80**, 0 standing uncompared at a boundary | `tests/probe_uncompared_leaves.js derive()` → `compared`, `ceiling`, `total`, `standing_at_the_boundary`; hole 20 = 18 duration-1 leaves ended in the residual + 2 self-removed within the action |
| board fields declared uncompared | **9** | `:state.not_compared` (= `:end_state_not_compared`) — ability trapping; item disposition (`lastItem`/`ateBerry`); yawn/attract/curse/heal block; Unburden; Power Shift; rampage count + Ally Switch ladder; Future Sight/Wish countdowns; the trapper mark; magnet-rise/syrup-bomb durations + charge commitment |
| driver | `empirical-click/v1` — real recorded clicks | `:steering.policy`; `:steering.driver_inputs[0]` `data/move-priors.json` 345 rows, digest `e667fe8ab457`; `[1]` `data/rollout-switch-census.json` 9.98% voluntary-switch rate, digest `b599f8d581b5`; census `CREDITED ONLY` (`:steering.census_role`) |
| pinned pool | `data/team-pool-frozen` — **8,778 teams, 1,968 picked, digest `0d103fb9fa87`** | `:steering.team_store_pinned_to`, `:steering.team_pool_teams`, `:steering.team_pool_picked`, `:steering.team_pool_digest`; `data/team-pool-frozen/FROZEN.md`: `games.bo3.jsonl` 13,214 lines + `games.ots.jsonl` 4,167 lines, frozen 2026-08-12 — REAL open-sheet human games |
| pins | mode `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real` | `:mode`; `:pins.digest`; census pin `:steering.input_digest` `1da84d77888e` `<RE-READ>`; alignment input `data/protocol-events.json` `7c9de3868d6f` (`:steering.alignment_inputs[0]`) |
| `--games` (sample definition, not a budget) | **1200** requested → 961 played | run flags in `docs/_reports/2026-09-10-narration-batch-Z-substitute.md` §1; `:swarm[]` 9 configurations |
| teams dropped from the pool (Illusion) | **43** | `:closet.teams_dropped`, `:closet.ability` |
| spreads | synthetic (sheets carry none), natures REAL — 17,440 declared, 96 fell back to Serious | `:declared_gaps.spreads_absent`, `:declared_gaps.nature_mode`, `:declared_gaps.nature_declared`, `:declared_gaps.nature_fallback_to_serious` |
| mega stones kept / tested | **2,626 kept, 0 stripped** | `:declared_gaps.mega_stones_kept`, `:declared_gaps.mega_stones_stripped` |
| damage differential | **6,000 requested / 6,000 compared / 6,000 agreed / 0 disagreed** at **17 indices** (midpoint + 16 arms: top, bottom, idx01–idx14), seed 20260804, `band_missing` 0 | `data/engine-diff.json:requested/compared/agreed/disagreed`, `:arms[]` (16 × `compared` 6000 / `disagreed` 0), `:seed`, `:band_missing` |
| what the damage differential skips | **134** multi-hit comparisons across 11 legal multi-hit moves; **17** Parental Bond clicks across 6 moves; **9** prior rows undrawable (no damage-table row); 0 non-finite; 0 dropped by exception | `:skipped_multihit`, `:skipped_multihit_moves`, `:skipped_ability_multihit`, `:skipped_ability_multihit_abilities`, `:skipped_ability_multihit_moves`, `:pool.dropped`, `:skipped_non_finite`, `:dropped_by_exception`; scope sentence `:scope` |
| accuracy / modifier / substitute-bypass conformance | **500/0**, **13 handlers, 14 rows, 0 disagreed**, **500 compared, 51 in set, 0 missing, 0 extra** | `:accuracy_conformance`, `:accuracy_modifier_conformance`, `:substitute_bypass_conformance` |
| roster / items | total **148**, out of scope 0, in scope **148**: tested **142**, DIFFER **0**, DID-NOT-FIRE **0**, fixture gaps **6** | `data/roster.items.json:scope.{total,out_of_scope,in_scope,tested,differ,silent,could_not_stage_in_scope}`, `:counts` |
| roster / abilities | total **316**, out of scope **115** (no legal carrier), in scope **201**: tested **139**, DIFFER **0**, DID-NOT-FIRE **0**, fixture gaps **43**, CONTROL-NOT-QUIET **14**, DEFERRED-BY-OWNER **5** | `data/roster.abilities.json:scope.{total,out_of_scope,out_of_scope_by,in_scope,tested,differ,could_not_stage_in_scope,unattributable,unattributable_ids,deferred}`, `:counts` |
| roster / moves | total **500**, out of scope **2** (no legal carrier), in scope **498**: tested **487**, DIFFER **0**, DID-NOT-FIRE **0**, fixture gaps **8**, deferred **3** | `data/roster.moves.json:scope.*`, `:counts` |
| carrier derivation | **347** legal species (`exists && !isNonstandard && tier !== "Illegal"`), 72 mega + 83 battle-only formes | `data/roster.items.json:scope.carrier_derivation` (same block in moves) |
| red demonstrations (plants) | items **18/18**, abilities **44/44**, moves **36/36** CAUGHT; dead anchors **0**; `reds_ran` true on all three | `data/roster.*.json:plant_anchors.{checked,dead,reds_ran}`, `:reds[]` (`ok:false` count 0) |
| census | **835 probed / 835 live / 835 armed / 0 missing / 0 unarmed / 0 hollow / 0 threw**, `run_ok` true `<RE-READ, must not go down>` | `data/mechanics-census.json:probed/live/armed/missing/unarmed/hollow/threw/run_ok` |
| the screens, in the census | 5 rows: Reflect, Light Screen, Aurora Veil (under snow), Safeguard — each paired with Infiltrator — and Compound Eyes' to-hit roll; the regulation has FOUR screens (Mist reads `isNonstandard: 'Past'`); screened number = the authority's own `battle.modify(control, [2732, 4096])` | `docs/RUNNING-NOTES.md` row 5.277.0 "the screens half…", `docs/_reports/2026-09-09-screen-probes.md`, `tests/probe_screens_infiltrator.js` 15 of 15 |
| staged mechanics (whole games) | **1,313 games, 0 threw, 0 sheets unassembled**; moves 500 tried / 495 resolved / 4 diverged / 4 announcement-only; abilities 316 tried / 104 fired / 1 diverged; items 148 / 64 fired / 0 diverged | `data/all-mechanics-fire.json:games_played/games_threw/sheets_unassembled`, `:summary.moves`, `:summary.abilities`, `:summary.items` |
| tag coverage | 285 of 301 tags carry a probe, 16 none; 278 have an engine consumer | `node engine/status.js` ENGINE block (from `engine/coverage.js`) |
| artifacts withheld | **64** `<RE-READ>` | `node engine/status.js` QUARANTINE header |
| provenance | 176 unsafe / 2 void (declared) / 44 possibly stale / 33 ok / 0 missing `<RE-READ>` | `node engine/status.js` MEASURE block (`engine/provenance.js`) |
| notes rows owed to the major | **72 of 100** `<RE-READ>` | `node engine/docs_scan.js --owed`; documents last folded 5.266.0; CHANGELOG top 5.277.0; last major 5.0.0 (2026-08-10) |
| living-document rewrite size | **79** figure-level edits: 13 on a withheld artifact, 23 stale citations, 43 untraceable `<RE-READ>` | `node engine/major_readiness.js` |
| re-run split | **LIFT 40 / STAY 24** `<RE-READ>` | `node engine/major_readiness.js` (derived from `engine/quarantine.js` + generator source) |

**The 2-of-19 within-turn erasure rate**, which the board headline must carry beside it: over the 19
NARRATION-ONLY causes standing at batch V (release `f6ecf4222048`), comparing the multiset of
state-bearing lines inside each divergence window, **2 of 19 were board differences that were erased
before a turn boundary was sampled** (the bounced Sleep Powder and the multi-hit volley stopping at a
doll — both since fixed, batches W and V). First published as 3 of 19 and **retracted to 2 of 19**
(`CHANGELOG.md` 5.273.0 "RETRACTION — the hiding class is 2 of 19, not 3"; `docs/RUNNING-NOTES.md`
batch W row). Bound: the window is the 10 lines `--dump-games` keeps (`engine/game_differential.js:4391`,
per the batch V row). It is a rate about THAT population, not about the causes standing today.

---

## 2. WHAT "CORRECT" MEANS AT 6.0.0, AND WHAT IT DOES NOT — THE PARAGRAPH EVERY DOCUMENT GETS A REGISTER OF

**Means.** On 961 real open-sheet ladder games (`data/team-pool-frozen`, bo3 + ots stores frozen
2026-08-12, 8,778 teams, 1,968 picked, digest `0d103fb9fa87`), driven by real recorded human clicks
(`empirical-click/v1`: P(move | species) from `data/move-priors.json`, a 9.98% voluntary-switch rate
from `data/rollout-switch-census.json`), with every die pinned identically on both engines (mode A,
pins `de38d17e15a2`), MEDICHAM and the official Showdown simulator at commit `20ad99ff…` arrive at
the **same board on every one of 10,705 compared turn boundaries**, and every one of the 961 games
ends in the same end state on every leaf `engine/board_state.js` compares (`SAME-END-STATE` 960 +
1 harness THREW; `DIFFERENT-END-STATE` 0). No game was excluded (`games_void_excluded` 0) and none
was cut short (cap 50; the longest game reaches turn 36). The damage differential agrees on 6,000 of
6,000 comparisons at all 17 roll indices. The deliberate roster stages every legal item, ability and
move with a legal carrier and finds **0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE** across
142 + 139 + 487 tested. The census reads 835 of 835 mechanics live. And — on the day — the narration
clause reads **0 of 961** with exactly one declared row that does not vote.

**Does not mean.** (i) The board comparator reads **54 of the 80 leaves** a legal mechanic can write;
54 is the CEILING at a turn boundary (18 duration-1 leaves are ended in the residual and 2 are
self-removed within the action before a boundary exists), and **9 further fields are declared
uncompared** (`state.not_compared`). A board difference that exists only inside a turn and is gone by
the boundary is invisible here — measured at 2 of 19 narration causes on the batch V population, so
"board-material zero" is a claim about compared boundaries and not about every intermediate state.
(ii) The damage differential skips **134** multi-hit comparisons and **17** Parental Bond clicks by
construction, so the volley loop has never been damage-compared there (it is compared in whole games
and staged in the roster). (iii) The spreads are synthetic — an open sheet reveals none — so this is a
test of RULES, not of metagame damage; natures are real. (iv) It is a claim about **one driver**:
`empirical-click/v1`. A coverage-seeking driver reaches a result in 1.8% of games and its "zero" is a
statement about games that do not end (white paper 5.211.0); `engine/arms_comparable.js` refuses to
pair the two. (v) The narration count is a **lower bound**: a game records only its FIRST divergence.
(vi) The pinned pool is usage-weighted by construction and is silent on any mechanic nobody brought;
the roster (500 / 316 / 148 entities) and the census (835 rows) carry that tail, and both are lab
instruments — one scenario per entity — not games. (vii) **43 abilities, 8 moves and 6 items with a
legal carrier are fixture gaps** (in scope, no fixture reaches them), **14 abilities are
CONTROL-NOT-QUIET** (the control arm is itself a live ability, so the delta cannot be charged to the
entity: aftermath, angerpoint, battlebond, damp, justified, keeneye, magmaarmor, moxie, opportunist,
rivalry, slushrush, stalwart, stickyhold, superluck), and **5 + 3 rows are DEFERRED-BY-OWNER**. Those
are the deprioritised lab tail (Will, 2026-08-23), carried, not removed, and never "unaccounted".
(viii) **Nothing downstream is true because the gate opened.** A quarantined figure becomes
RE-RUNNABLE, and 24 artifacts stay withheld through 6.0.0 by decision (§7).

**The evidence chain.** Every gate artifact stamps the same `engine_release` `<RE-READ>` and the same
`showdown_commit` `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`; `engine/engine_release.js cut` refuses
when the Showdown checkout's HEAD is not `engine/champions_sim.js`'s `PINNED_COMMIT` (5.276.0), and
`engine/game_differential.js --release` asks the same before any game is played. The release is a
COPY of the engine's 27 frozen sources (`engine/engine_release.js` `SOURCES` — read the count from the
file), not a checksum, so a measurement on it cannot be moved by a live edit. **The release the six
artifacts stamp must be tracked in the repository on the day** (`git add -f data/releases/<id>`; the
5.276.0 row did this for `b730e44f3314` and batch Y for `7d66b526659e`; `489bea0577bc` is not yet).

---

## 3. THE BACK-CAST — OLD SERIES BESIDE NEW, SO THE TWO CAN BE LINKED (ESS 2013 Item 3.4)

**Why 6.0.0 is a MAJOR and not a MINOR.** Three things a reader can no longer be told, each declared
in its own notes row and absorbed here:

1. **The gate is OPEN**, so every figure downstream of MEDICHAM stops being withheld at once — 40
   artifacts lift and nothing published survives unrewritten. "MEDICHAM is not correct" was the
   sentence under every model number since 3.79.0.
2. **A board-material figure covers whole games only from cap 50 onward.** Every figure published
   before 2026-09-07 was measured at cap 12 or cap 20; at cap 20, **35 of 961 games were still running
   when the instrument stopped watching** and one parted a board at turn 22. Cap 50 and cap 100 play a
   byte-identical set (longest game turn 36). Declared `Basis. CHANGED` in the 2026-09-07 row "the turn
   cap was the horizon"; the cap-20 series and the cap-50 series may not be lined up without the
   sample-identity check.
3. **The dice addressing moved** on 2026-09-07 (the spread move's named target is a die drawn by
   `battle.sample()`), so a level measured before that fix is not in the same series as one after it
   (row "the spread move's named target is a DIE", `Basis. CHANGED`).

**The linked series, board-material (`state.games` less `state.games_board_never_diverged`):**

| release | date | cap | denominator | board-material | source |
|---|---|---|---|---:|---|
| `57679ef9a4a3` | 09-06 | 20 | 961 | **27** (5.266.0 published) | `docs/ABRA-whitepaper.md:5` (dated block) |
| `ab22bc503717` | 09-06 | 20 | 961 | 22 | notes 5.267.0 |
| `1fc8ed7adfd7` | 09-06 | 20 | 961 | 18 | notes 09-06 "a weather forme comes off a corpse" |
| `0c8b0dc63766` | 09-06 | 20 | 961 | 16 | notes 09-06 "two dice addresses" |
| `791c9fd873f3` | 09-07 | 20 | 961 | 13 — **basis break (dice addressing)** | notes 09-07 "spread move's named target" |
| `aa7b80f9a038` | 09-07 | 20 | 961 | 11 | notes 09-07 "a thaw ordered…" |
| `3f9830acc467` | 09-07 | 20 | 961 | 8 | notes 09-07 "a cure berry…" |
| `c28ad0815782` | 09-07 | 20 | **958** (3 void published) | 3 — ruler: back-cast reproduces 8 of 961 under `--state-count-void` | notes 09-07 "the board bar was quoted over a denominator…" |
| `1be57a100d59` | 09-07 | 20 | 958 | 0 | notes 09-07 "the last three games…" |
| `f30bf025ae28` | 09-07 | **50** | 958 | 1 → 0 (knob-controlled on one release) — **basis break (horizon)** | notes 09-07 "the turn cap was the horizon" |
| `b0f5c159c46e` | 09-09 | 50 | **961** (void re-included: 2 engine fixes + 1 instrument fix) | 0 | notes 5.276.0 "the gate re-measured…" |
| `7d66b526659e` | 09-09 | 50 | 961 | 0 | notes 5.277.0 batch Y |
| `489bea0577bc` `<RE-READ>` | 09-10 | 50 | 961 | **0** | `data/game-differential.json` |

**The linked series, NARRATION clause (raw less declared), all cap 50 from `fb0058fb5702` on:**
70 (5.266.0, cap 20) → 62 (`bc99dcc268ce`, cap 20) → 63 → 55 (`fb0058fb5702`) → 53 → 52 → 49 →
33 (`2c4e125866cc`) → 21 (`5381b07ea2fa`) → 20 → 18 → 17 → 15 → 12 (`2026-09-09` batch X) →
13 (`b0f5c159c46e`, denominator re-included) → 9 (`7d66b526659e`) → **6** (`489bea0577bc`) `<RE-READ>` →
**0 on the day**. Every step is a notes row citing `data/game-differential.json` on its release.

**The other four instruments, 5.266.0 → 6.0.0:** census 830 → **835**; roster items 140 of 148 →
**142 of 148**; abilities 129 of 202 → **139 of 201** (12 vacuous greens removed 09-08; scope by legal
carrier 09-09); moves 475 of 500 → **487 of 498**; damage differential 6,000/0 → **6,000/0**;
staged mechanics 1,313 / 0 threw → **1,313 / 0 threw**; gate 2 of 9 fail → **0 of 9** (day).

**The seven narration mechanisms standing at drafting** `<RE-READ — this list is what a batch moves>`,
named by mechanism (`data/game-differential.json:classes[]`, one game each):
1. **The residual trio** — two burned bodies' burn chip, two poisoned bodies' poison chip, and two
   Leftovers heals written in the other order (`ordering :: brn<>brn`, `psn<>psn`, `leftovers<>leftovers`).
   Six batches, two deliberate fixtures, a Speed read of 70/70, 60/60, 65/75 — two ties and one that is
   not, so it is not one mechanism. Unexplained, deliberately given no clean bill.
2. **A redirect announcement against a charge line** — Lightning Rod's `-activate` and Electro Shot's
   `-prepare` in the other order.
3. **Shed Tail's refusal names the move and the reason** — the authority writes
   `-fail|…|move: Shed Tail|[weak]` on a body at or below half HP (`data/moves.ts:16176`); this engine
   writes the bare `-fail`. Surfaced by batch Z when the substitute line above it closed.
4. **A priority move's refusal against a terrain activation** — `-fail` (Sucker Punch) and Psychic
   Terrain's `-activate` in the other order.
5. **The perish drain above `|upkeep|`** — CLOSETED by Will 2026-08-28 (ROADMAP #440); a real defect,
   declared, non-voting; one game, turn 11.

---

## 4. PER DOCUMENT — OLD (quoted, line) → NEW (paste)

Convention already in force in all five documents: **a version-stamped block is a dated waypoint and
is not edited in place**. So the 5.266.0 top blocks stay as written; the fold-in ADDS the 6.0.0 block
above them and REWRITES the living (unstamped) sections that state current fact. Line numbers are as
of `git show HEAD` on 2026-09-10 and will shift once the top block is inserted — paste top-down.

### 4A. `docs/ABRA-whitepaper.md`

**A1. Version header**

| OLD | NEW |
|---|---|
| L3 `**Version 5.266.0 · Last updated 2026-09-06**` | `**Version 6.0.0 · Last updated <DAY>**` |

**A2. New top block — insert above L5 (`**5.266.0 — THE WHOLE-GAME FIGURES ARE RESTORED…`)**

> **6.0.0 — MEDICHAM IS CORRECT AGAINST THE OFFICIAL SIMULATOR ON THE PINNED POOL, AND NOTHING ELSE GATES THIS MAJOR. BOARD-MATERIAL 0 OF 961, NONE EXCLUDED; NARRATION 0 OF 961 WITH ONE DECLARED ROW; RELEASE `<RE-READ id>`.** `data/game-differential.json`, generated `<RE-READ>`, release `<RE-READ>`, authority commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`: `state.games` **961** less `state.games_board_never_diverged` **961** is **0** — no board parted at any of the **10,705** compared turn boundaries (`state.turn_boundaries_compared` = `state.turn_boundaries_identical`) in any game. `state.games_void_excluded` **0**, `state.games_cut_off_by_the_turn_cap` **0** at cap 50 (the longest game reaches turn 36). Every game ends in the same end state on every compared leaf: `end_state[0].summary.verdicts` SAME-END-STATE **960**, DIFFERENT-END-STATE **0**, ENDED-APART **0**, THREW **1** (a harness choice rejection, `errors[0]`). Pins: arm `middle`, mode A (every die pinned on both sides, `pins.digest` `de38d17e15a2`), steering `empirical-click/v1`, `--games 1200 --turns 50`, `--team-store data/team-pool-frozen` (8,778 teams, 1,968 picked, digest `0d103fb9fa87`), census pin `<RE-READ>`. **This is the quantity Will named on 2026-08-22 — commentary may differ, boards may not — and it is met.**
>
> **THE NARRATION CLAUSE IS THE SECOND GATE WILL NAMED THAT DAY, IT BECAME A GATE THE MOMENT THE BOARDS STOPPED PARTING, AND IT READS ZERO.** It counts games that diverge in narration and never part a board — `state.protocol_diverged_board_never_did` raw, less the declared rows — and it read **70 of 961 at 5.266.0**. The one declared row is a real defect the owner ruled does not matter on a measured claim that no board moves: the perish drain written above `|upkeep|` where the authority puts it below (CLOSETED, Will 2026-08-28, ROADMAP #440); it is printed by `engine/status.js` on every run and does not vote. **It is a lower bound**: a game records only its first divergence. Between 5.266.0 and this version the mechanisms closed are in `docs/RUNNING-NOTES.md` rows 5.267.0 through `<RE-READ last row>`, each on its own frozen release with a probe shown red on the pre-fix bytes first.
>
> **THE BOUND ON THE HEADLINE, STATED WITH IT.** "Board-material zero" is a claim about **54 of the 80 leaves** a legal mechanic can write (`tests/probe_uncompared_leaves.js derive()`: `compared` 54, `ceiling` 54, `total` 80, `standing_at_the_boundary` 0 — 18 duration-1 leaves are ended in the residual and 2 are self-removed within the action, so they can never be standing when the comparator looks), and **9 fields are declared uncompared** (`state.not_compared`: ability trapping, item disposition, yawn/attract/curse/heal block, Unburden, Power Shift, the rampage count, the two slot-condition countdowns, the trapper mark, two durations). A board difference erased before a boundary is invisible to it: measured on the 19 narration causes standing at batch V, **2 of 19** were such differences (`CHANGELOG.md` 5.273.0, retracted from 3 of 19; window bound: the 10 lines `--dump-games` keeps). Both were fixed. And it is a claim about **one driver** — real recorded human clicks — on **real teams**: the pool is usage-weighted by construction and silent on what nobody brought.
>
> **THE DAMAGE DIFFERENTIAL, AND WHAT IT SKIPS.** `data/engine-diff.json`: **6,000 requested, 6,000 compared, 6,000 agreed, 0 disagreed** at the midpoint and at every one of 16 further roll indices (top, bottom, idx01–idx14), seed 20260804, `band_missing` 0. By construction it skips `skipped_multihit` **134** comparisons across 11 legal multi-hit moves and `skipped_ability_multihit` **17** Parental Bond clicks across 6 moves, because `dmgRange` prices a whole click and one `moveHit` call is one packet; and `pool.dropped` **9** prior rows have no damage-table row and can never be drawn. Its own `scope` field says the rest: damage only; turn order, status duration and switching are the whole-game differential's and the roster's.
>
> **THE ROSTER, SCOPE DECIDED BY LEGAL CARRIER.** `tests/roster.js` derives every stage's scope over the **347** legal species (`exists && !isNonstandard && tier !== 'Illegal'`; 72 mega and 83 battle-only formes among them) before any shape rule runs. Items (`data/roster.items.json:scope`): 148 in scope, **142 tested, 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE**, 6 fixture gaps. Abilities (`data/roster.abilities.json:scope`): 316 total, **115 with no legal carrier in this regulation** and therefore not rows, 201 in scope: **139 tested, 0 / 0**, 43 fixture gaps, **14 CONTROL-NOT-QUIET** (the control arm is itself a live ability, so the delta cannot be charged to the entity), 5 DEFERRED-BY-OWNER. Moves (`data/roster.moves.json:scope`): 500 total, 2 with no legal carrier, 498 in scope: **487 tested, 0 / 0**, 8 fixture gaps, 3 deferred. Red demonstrations 18 / 44 / 36 CAUGHT with 0 dead anchors (`plant_anchors`). The fixture gaps and the fourteen are the deprioritised lab tail (Will, 2026-08-23), carried, not removed.
>
> **THE CENSUS READS 835 OF 835 AND THE SCREENS ARE IN IT.** `data/mechanics-census.json`: `probed` 835, `live` 835, `armed` 835, `missing` 0, `hollow` 0, `threw` 0, `run_ok` true. Five rows are new since 5.266.0: Reflect, Light Screen, Aurora Veil (under snow) and Safeguard each paired with Infiltrator, and Compound Eyes' to-hit roll — the regulation has four screens (Mist reads `isNonstandard: 'Past'`, derived not typed), and on both engines the screened number equals the authority's own `battle.modify(control, [2732, 4096])`. `data/all-mechanics-fire.json`: 1,313 staged games, 0 threw.
>
> **THE EVIDENCE CHAIN.** All six gate artifacts stamp one release and one authority commit. `engine/engine_release.js cut` refuses when the Showdown checkout's HEAD is not `PINNED_COMMIT`; a release is a copy of the frozen sources, not a checksum. The release is tracked in this repository (`data/releases/<RE-READ id>/`).
>
> **WHAT LIFTS AND WHAT STAYS WITHHELD — THIS IS A PARTIAL LIFT AND IS WRITTEN AS ONE.** Will sequenced the MAG refit after 6.0.0, so `data/policy-weights.json` is not re-run before this major and every artifact whose generator writes it, reads it, or is MILTANK stays withheld: **24 artifacts** `<RE-READ>` including the exploitability search, the opponent model, the ladder and the scoreboard (`node engine/major_readiness.js` names each with its generator). **40 artifacts lift** on re-run, leaf calibration among them (§1). Each figure that returns is stated from its re-run artifact in the section that owns it; each that stays is stated as absent with its generator, never captioned.
>
> **WHAT THIS VERSION DOES NOT ESTABLISH.** That MEDICHAM is correct on a mechanic nobody brought to the frozen pool — the roster and the census carry that claim entity by entity and their gaps are listed above. That any model downstream is good: a quarantined figure became re-runnable, not true. That search pays (ROADMAP #62) — phase 1 of §0.3 is reached and phase 2 is not started.

**A3. §0.3 plan block, L1477–L1480 (the four-phase code block)**

| OLD | NEW |
|---|---|
| L1477 `1  finish MEDICHAM        search needs an engine that is fast AND correct` | `1  finish MEDICHAM        REACHED at 6.0.0 — correct against Showdown on the pinned pool (§3); fast at 3.94x (§3.0)` |
| L1478–L1480 unchanged | unchanged; add after the block: `**Phase 1 is reached under the definition in §3 and phase 2 has not begun: no untimed-versus-clock measurement exists, and MILTANK is paused beside the MAG refit.**` |

**A4. §1, L1514–L1522 (the quarantined leaf-calibration paragraph)**

| OLD (L1514) | NEW |
|---|---|
| `**WHAT THE LARGER RE-MEASUREMENT SAID IS QUARANTINED — the figures are withheld, not annotated.** \`data/winrate-backtest.json\` is downstream of MEDICHAM: … It becomes quotable again when the gate opens AND this is re-run: \`node engine/backtest_winrate.js\`.` | **Case A — re-run completed before the commit:** `**RE-MEASURED AT 6.0.0 ON RELEASE <id>.** \`data/winrate-backtest.json\`, generated <stamp>: <read from the artifact — replication verdict, Brier vs coin with CI, n decisive pairs, bucket table; NOTHING from the 2026-08-04 numbers above is carried>. The 2026-08-04 reading above is a dated record of an engine that no longer exists and is not compared with this one — \`engine/arms_comparable.js\` decides comparability, not this sentence.` **Case B — re-run not yet landed:** `**WITHHELD; LIFTS ON THE RE-RUN.** \`data/winrate-backtest.json\` lifts at 6.0.0 (its generator \`engine/backtest_winrate.js\` reaches no paused weight vector) and had not been re-run when this version was cut. No replication verdict, bucket share, calibration gap or sample size is carried here, and the reader may not infer a direction from the absence.` |

**A5. §3 header, L1553–L1567**

| OLD (L1555–L1559) | NEW |
|---|---|
| `The one component that is *not* a coin flip is the damage engine. MEDICHAM's Gen-9 doubles damage pipeline (\`engine/medicham2-browser.js\`) is validated against the Smogon damage calculator (the community ground-truth). This is gated in CI (\`engine/validate_damage.js\` → \`data/damage-validation.json\`). Every model that reasons about damage builds on this, and "will this move KO?" is a *winnable* prediction, unlike "who wins the game."` | `The one component that is *not* a coin flip is the simulator. MEDICHAM (\`engine/medicham2-browser.js\`) is validated against the **official Pokémon Showdown simulator at commit \`20ad99ff…\`**, which is the authority (ADR-002), on three instruments that each stamp the same frozen release: the whole-game differential (\`data/game-differential.json\` — 961 real games, board-material **0 of 961**, narration **0 of 961** less one declared row, 10,705 of 10,705 turn boundaries identical, cap 50, none excluded), the damage differential (\`data/engine-diff.json\` — 6,000 of 6,000 at 17 roll indices), and the deliberate roster (\`data/roster.{items,abilities,moves}.json\` — 142 / 139 / 487 tested, 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, scope decided by legal carrier). The Smogon-calculator agreement below is retained as the older, narrower check. Every model that reasons about damage builds on this, and "will this move KO?" is a *winnable* prediction, unlike "who wins the game." **The bound on the word "correct" is in the 6.0.0 block at the head of this paper**: 54 of 80 leaves compared, 9 fields declared uncompared, one driver, real teams, synthetic spreads.` |
| L1561–L1567 (the `data/damage-validation.json` 36-scenario paragraph and its 2026-08-22 note) | unchanged — dated and still true of its artifact |

**A6. §6 item 6, L1887–L1891**

| OLD (L1887) | NEW |
|---|---|
| `**THE RATES AND INTERVALS THIS ITEM USED TO QUOTE ARE WITHHELD, 2026-08-22.** R1, R2 and R3 read artifacts downstream of MEDICHAM, and \`node engine/status.js\` names each one QUARANTINED. …` | `**THE RATES AND INTERVALS THIS ITEM USED TO QUOTE: R3 STAYS WITHHELD AT 6.0.0 (\`data/rollout-r3.json\` ← \`engine/rollout_r3.js\` is on \`major_readiness.js\`'s STAY list); R1 and R2 lift on the re-run and are stated here from their re-run artifacts or not at all.** <if re-run: figures from \`data/rollout-r1-explore1.json\` / \`data/rollout-cost.json\` with stamps; if not: "withheld; lifts on the re-run">. The limitation being described is about the CONFIGURATION RECORD and survives either way.` |

**A7. §6 item 7, L1911–L1919 (exploitability)**

| OLD (L1911) | NEW |
|---|---|
| `**The headline metric has no current value, and that is the largest limitation in this paper** (added 3.62.2). §0 makes exploitability the number this project is judged on, and \`data/exploitability.json\` is declared void: …` | Keep the paragraph; append: `**Still true at 6.0.0, and by decision rather than by accident:** \`data/exploitability.json\`, \`-mag.json\` and \`-machamp.json\` are generated by \`engine/exploit.js\`, which reads \`data/policy-weights.json\`, and Will sequenced the MAG refit after this major. They **stay withheld** through 6.0.0 with the two exploit-step probes; the gate opening released nothing here.` |

**A8. Item 8 (L1921–L1930), speed** — unchanged; still true (3.94x, `data/verification/speed-2026-09-08/`). `engine/bench_speed.js`'s artifact lifts on the re-run; if `data/medicham-speed.json` is re-run, state its figure; otherwise leave the sentence "into an artifact the quarantine withholds" and change "withholds" → "withheld until the 6.0.0 re-run; lifts on the re-run".

### 4B. `docs/ABRA-deck-plain-english.md`

**B1. Header** — L3 `**Version 5.266.0 · 2026-09-06 · Will Hooper**` → `**Version 6.0.0 · <DAY> · Will Hooper**`.

**B2. New top block — insert above L5 (`**5.266.0 - LAST VERSION WE PUBLISHED A BLANK…`)**

> **6.0.0 - THE SIMULATOR PASSES. WE PLAY 961 REAL GAMES THROUGH OUR SIMULATOR AND THROUGH THE OFFICIAL ONE, AND THE BOARD NEVER DIFFERS — NOT ONCE, IN ANY GAME, AT ANY TURN WE CHECK.**
>
> **WHAT THE NUMBER IS.** We take 961 real ladder games from a frozen copy of real teams, play every move the way real players clicked, force both simulators to roll the same dice, and compare the board at the end of every turn — 10,705 turn boundaries in all. **In 0 of 961 games do the two boards ever differ.** No game was thrown out to get there, and no game was cut short: we watch for 50 turns and the longest game lasts 36. Last version this number was 27 of 961; the version before the gate work began, it was 77.
>
> **THE COMMENTARY IS A SEPARATE TEST, AND IT PASSES TOO.** The two simulators also write a running commentary. Once the boards stopped differing, we made "does the commentary match?" a second bar — Will asked for that on 2026-08-22 — and it also reads zero, with exactly one exception we decided on purpose: one message about Perish Song that we print one line early, ruled harmless on a measured claim, written down with who ruled it and when. That is a defect we chose not to fix, not one we missed.
>
> **WHAT THE NUMBER IS NOT.** It is about the parts of the board we check — 54 of the 80 things a move or ability can change; the other 26 are gone before the end of the turn or are declared unchecked, and we say which. A difference that appears and vanishes inside one turn cannot be seen this way; we measured how often that happened among the commentary differences we still had at one point — 2 in 19 — and fixed both. It is about real teams people actually brought, so it says nothing about a mechanic nobody used; a separate lab test stages every legal item, ability and move one at a time (142, 139 and 487 of them pass, none fail, and the ones we could not stage are listed by name). And it does **not** make anything built on top of the simulator true — it makes those results **re-runnable**.
>
> **WHAT COMES BACK AND WHAT STAYS BLANK.** About forty older results that were held back become quotable once re-run — including our headline score, whether the engine's own confidence is honest. **Twenty-four stay blank on purpose**: everything that depends on the bot's weights, because Will chose to rebuild those weights after this release rather than before it, and everything about the search player, which is paused beside them. Each blank says why. A note beside a number is not the same as leaving it out, and we leave them out.

**B3. Slide 4, L1207–L1209**

| OLD | NEW |
|---|---|
| `- **MEDICHAM** — the damage engine. Matches the community standard, but disagrees with the game's OFFICIAL engine by a wide margin, so it is being replaced by that engine and kept only as a lookup.` | `- **MEDICHAM** — our own battle simulator. It agrees with the game's OFFICIAL engine on the board at every checked turn of 961 real games (6.0.0), on 6,000 of 6,000 damage rolls, and on every legal item, ability and move we can stage. It is about four times faster than the official engine, which is why it exists — and whether that speed buys anything is the next question, not a settled one.` |

**B4. Slide 6, L1115–L1120 (the leaf/engine contrast blank)**

| OLD (L1115) | NEW |
|---|---|
| `**We are not allowed to tell you what came out, and that is deliberate.** The simulator those scores were produced on has not passed its own correctness gate, so every number from this comparison is WITHHELD … The moment the gate opens the comparison is re-run and the answer goes back in.` | **Case A (re-run landed):** `**The simulator has passed its gate (6.0.0) and this comparison was re-run.** <plain-English reading of \`data/leaf-engine-contrast.json\`, with the noise floor beside the effect>.` **Case B:** `**Withheld; lifts on the re-run.** The simulator passed its gate at 6.0.0, so this comparison may now be re-run; it had not been when this version was cut, and no score, error bar or sample size is printed until it has.` |

**B5. Slide 9, L1473–L1477 (the click-censoring counts)**

| OLD | NEW |
|---|---|
| `The counts are WITHHELD — they come out of the fitted model's own corpus file, which was built on a simulator that has not passed its correctness gate — …` | `The counts lift on the re-run (\`node engine/click_census.js\`, 6.0.0) — <Case A: state them from \`data/click-censoring-census.json\`; Case B: "withheld; lifts on the re-run">. The mechanism does not depend on the count: it is not a rounding error being fed to the model, it is outright fiction.` |

**B6. Slide 8, L1414–L1418 ("we currently have no answer to how beatable is our bot")** — unchanged and still true; append one sentence: `**Still true at 6.0.0, by decision:** the beatability search reads the bot's weights, and those are being rebuilt after this release, so it stays blank until then.`

**B7. Slide 9f, L1690–L1694** — the parenthetical about a reading "in a file our own quarantine rules say we may not quote from yet": Case A replace with the re-run figure from `data/medicham-speed.json`; Case B `(… lifts on the re-run and had not been re-run when this version was cut.)`.

### 4C. `docs/ABRA-technical-docs.md` (ASD-STE100: short sentences, one fact each)

**C1. Header** — L3 → `**Version 6.0.0 · Last updated <DAY>**`.

**C2. New top block — insert above L5 (`**5.266.0 - THE WHOLE-GAME FIGURES ARE MEASURED AGAIN…`)**

> **6.0.0 - MEDICHAM IS CORRECT AGAINST THE AUTHORITY ON THE PINNED POOL. THE GATE IS OPEN. THIS IS A MAJOR RELEASE.**
>
> **PUBLICATION.** The tree is release `<RE-READ>`. The authority commit is `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`. All six gate artifacts stamp both. `data/game-differential.json` was generated at `<RE-READ>`.
>
> **BOARD-MATERIAL.** Read `state.games`. It is 961. Read `state.games_board_never_diverged`. It is 961. Subtract. The result is **0**. Read `state.games_void_excluded`. It is 0. Read `state.games_cut_off_by_the_turn_cap`. It is 0. Read `state.turn_boundaries_compared` and `state.turn_boundaries_identical`. Both are 10,705. Read `end_state[0].summary.verdicts`. SAME-END-STATE is 960. DIFFERENT-END-STATE is 0. ENDED-APART is 0. THREW is 1. The THREW game is a harness choice rejection. It is in `errors[0]`.
>
> **NARRATION.** Read `state.protocol_diverged_board_never_did`. Subtract the declared rows. The result is **0**. There is one declared row. It is the perish drain written above `|upkeep|`. Will closeted it on 2026-08-28. It is ROADMAP #440. It does not vote. `engine/status.js` prints it on every run. **RULE.** The narration count is a lower bound. A game records its first divergence only.
>
> **PINS.** 961 games from `--games 1200`. Turn cap 50. Arm `middle`. Mode A. Pin digest `de38d17e15a2`. Steering `empirical-click/v1`. Driver inputs `data/move-priors.json` (345 rows) and `data/rollout-switch-census.json` (voluntary switch rate 9.98%). Census pin `<RE-READ>`. Alignment input `data/protocol-events.json` digest `7c9de3868d6f`. Team store `data/team-pool-frozen`. Teams 8,778. Picked 1,968. Pool digest `0d103fb9fa87`. The store holds `games.bo3.jsonl` (13,214 lines) and `games.ots.jsonl` (4,167 lines). These are real open-sheet games. It was frozen on 2026-08-12. **RULE.** `--games` is part of the sample definition. Record the whole command.
>
> **SCOPE OF THE BOARD COMPARISON.** `tests/probe_uncompared_leaves.js derive()` reads `compared` 54, `ceiling` 54, `total` 80, `standing_at_the_boundary` 0. 18 leaves have duration 1 and end in the residual. 2 leaves are removed within the action. `state.not_compared` lists 9 declared fields. A board difference that ends before a turn boundary is not visible. Measured rate on the batch V population: 2 of 19 narration causes. Window: 10 lines. Both were fixed.
>
> **DAMAGE DIFFERENTIAL.** `data/engine-diff.json`. `requested` 6000. `compared` 6000. `agreed` 6000. `disagreed` 0. 17 roll indices. Seed 20260804. `band_missing` 0. `skipped_multihit` 134. `skipped_ability_multihit` 17. `pool.dropped` 9. `accuracy_conformance.disagreed` 0 of 500. `accuracy_modifier_conformance.disagreed` 0 of 14. `substitute_bypass_conformance.missing` and `.extra` are empty.
>
> **ROSTER.** Scope is decided by legal carrier. There are 347 legal species. `data/roster.items.json:scope`: in scope 148, tested 142, differ 0, DID-NOT-FIRE 0, fixture gaps 6. `data/roster.abilities.json:scope`: total 316, out of scope 115 (no legal carrier), in scope 201, tested 139, differ 0, DID-NOT-FIRE 0, fixture gaps 43, CONTROL-NOT-QUIET 14, deferred 5. `data/roster.moves.json:scope`: total 500, out of scope 2, in scope 498, tested 487, differ 0, DID-NOT-FIRE 0, fixture gaps 8, deferred 3. Red demonstrations: 18, 44 and 36 CAUGHT. Dead anchors: 0. Do not write "unaccounted". Write the category.
>
> **CENSUS.** `data/mechanics-census.json`. `probed` 835. `live` 835. `armed` 835. `missing` 0. `hollow` 0. `threw` 0. `run_ok` true. Five screen rows are new: Reflect, Light Screen, Aurora Veil, Safeguard, each with Infiltrator, and Compound Eyes. The regulation has four screens. Mist is `Past`. `data/all-mechanics-fire.json`: 1,313 games, 0 threw.
>
> **EVIDENCE CHAIN.** `engine/engine_release.js cut` refuses if the Showdown HEAD is not `PINNED_COMMIT`. A release is a copy of the frozen sources. Read the source count from `SOURCES` in that file. The release directory is tracked: `data/releases/<RE-READ>/`.
>
> **PARTIAL LIFT.** 40 artifacts lift on re-run. 24 stay withheld. The 24 are the artifacts whose generator writes or reads `data/policy-weights.json`, or is MILTANK. Will sequenced the MAG refit after 6.0.0. Run `node engine/major_readiness.js` for the list. Do not caption a withheld figure. Omit it and state the generator.
>
> **STILL OWED.** The MAG refit. It is a refit, not a restamp. `data/policy-weights.json` records 318 species. The table holds 322. The fixture and table gates fire (`engine/feature_fixture.js --check`). Phase 2 (ROADMAP #62) is not started.

**C3. L791 and L812 (frozen-source count inside the dated 2026-08-26/28 CRLF narrative)** — do not edit in place. Append after L815 (`Record the 9 as owed work.`):

> **UPDATE, 6.0.0.** The count above was 26 when written. `data/rollout-switch-census.json` became a frozen source on 2026-09-08. The count is now **`<RE-READ: node -e "console.log(require('./engine/engine_release.js').SOURCES.length)">`**. Read it from `SOURCES`. Do not read it from this block.

**C4. §3.2a table, L1843**

| OLD | NEW |
|---|---|
| `\| \`M.TRACE_EVENTS\` \| the 36 event names this engine claims it can emit \|` | `\| \`M.TRACE_EVENTS\` \| the event names this engine claims it can emit — \`data/protocol-events.json:emitted\` (44 on 2026-09-08). Read the artifact, not this cell \|` |

### 4D. `docs/SUMMARY.md`

**D1. Header** — L3 → `**Version 6.0.0 · <DAY> · Will Hooper**`.

**D2. New top block — insert above L5**

> **6.0.0 - MEDICHAM IS CORRECT AGAINST SHOWDOWN ON THE PINNED POOL AND NOTHING ELSE GATES THIS MAJOR. BOARD-MATERIAL 0 OF 961, NONE EXCLUDED; NARRATION 0 OF 961 LESS ONE DECLARED ROW; 40 ARTIFACTS LIFT, 24 STAY WITHHELD BY DECISION.**
>
> | question | artifact | answer |
> |---|---|---|
> | whole-game / **BOARD-MATERIAL**, the gating clause | `data/game-differential.json` | **0 of 961.** `state.games` **961** less `state.games_board_never_diverged` **961**. `state.games_void_excluded` **0**; `state.games_cut_off_by_the_turn_cap` **0** at cap 50; 10,705 of 10,705 boundaries identical |
> | whole-game / end state | same | `end_state[0].summary.verdicts`: SAME-END-STATE **960**, DIFFERENT-END-STATE **0**, ENDED-APART **0**, THREW **1** (harness) |
> | whole-game / **NARRATION**, the second gate (Will, 2026-08-22) | same | **0 of 961** after the **1** declared row (perish drain above `\|upkeep\|`, closeted 2026-08-28, ROADMAP #440). A lower bound: first divergence per game |
> | the bound on "board" | `tests/probe_uncompared_leaves.js`, `state.not_compared` | **54 of 80** leaves compared (ceiling 54; 18 duration-1 + 2 self-removed can never stand at a boundary); **9** fields declared uncompared; within-turn erasure measured **2 of 19** on the batch V population (`CHANGELOG.md` 5.273.0) |
> | the sample | same artifact, `steering.*` | 961 real open-sheet games, `empirical-click/v1` (real recorded clicks), pool `data/team-pool-frozen` 8,778 teams / 1,968 picked / digest `0d103fb9fa87`, `--games 1200`, mode A pins `de38d17e15a2`, census pin `<RE-READ>` |
> | the damage differential | `data/engine-diff.json` | **6,000 compared, 0 disagreed** at 17 indices, seed 20260804; skips 134 multi-hit + 17 Parental Bond by construction; 9 prior rows undrawable |
> | the deliberate roster, by legal carrier | `data/roster.{items,abilities,moves}.json:scope` | items **142 of 148** tested, abilities **139 of 201** (115 have no legal carrier), moves **487 of 498** (2 have none); **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE** on all three; fixture gaps 6 / 43 / 8; CONTROL-NOT-QUIET 14; deferred 0 / 5 / 3; red demos 18 / 44 / 36 caught, 0 dead anchors |
> | staged mechanics | `data/all-mechanics-fire.json` | 1,313 games, **0 threw** |
> | mechanics live in the census | `data/mechanics-census.json` | **835 live of 835 probed**, 0 missing, 0 hollow, `run_ok` true — the four screens × Infiltrator and Compound Eyes are in it |
> | the gate | `node engine/status.js` | **9 of 9 clauses PASS, OPEN** `<RE-READ on the day>`; release `<RE-READ>`, authority `20ad99ff…` |
> | what lifts | `node engine/major_readiness.js` | **40** artifacts re-run and become quotable — leaf calibration (`data/winrate-backtest.json`) among them |
> | what stays withheld, by decision | same | **24** — every generator that writes or reads `data/policy-weights.json`, or is MILTANK: the exploitability triple, both exploit-step probes, the opponent model, `recall-at-k`, the ladder, the scoreboard, `partial-label-em`, `brood`, `censoring-value`, `collinearity-audit`, `seed-source-audit`, `rollout-r3`, the search decision profile, and the three weights files |
> | leaf calibration | `data/winrate-backtest.json` | Case A: `<figure, n, against coin and Elo, from the re-run artifact>`. Case B: **withheld; lifts on the re-run** |
>
> **WHY THIS IS A MAJOR.** Three things a reader can no longer be told: that MEDICHAM is not correct (the sentence under every model number since 3.79.0); that a board-material figure measured at cap 20 covers whole games (35 of 961 were cut short at 20 — the cap-50 series is a different series); that a level measured before the 2026-09-07 dice-addressing fix is in the same series as one after it. The old series is back-cast beside the new in `docs/RUNNING-NOTES.md`'s 6.0.0 row.

**D3. Components table, L1295 (MEDICHAM row)**

| OLD (L1295, three cells) | NEW |
|---|---|
| `\| **MEDICHAM** \| Hand-written doubles battle simulator. **Its justification is now falsifiable (ADR-003, 3.62.2)…** \| **Correctness sprint PAUSED 2026-08-28 by the owner. The MEDICHAM gate reads CLOSED — 1 of 8 clauses fail (2026-09-03)…** \| **EVERY COUNT IN THIS CELL WAS SUPERSEDED AND IS NOW CUT (2026-08-22).** … \|` | `\| **MEDICHAM** \| Hand-written doubles battle simulator, validated against the official Showdown simulator (the authority, ADR-002). Its justification is falsifiable (ADR-003): it exists so per-turn re-solving is affordable, and the engine work is justified iff search pays (ROADMAP #62). Measured 3.94x faster than Showdown's raw \`Battle\` (§ above) \| **The MEDICHAM gate reads OPEN at 6.0.0 — 9 of 9 clauses PASS on release \`<RE-READ>\`.** Board-material 0 of 961 with none excluded; narration 0 of 961 less one declared row; 54 of 80 leaves compared, 9 declared uncompared; one driver, real teams \| **State is printed, not typed: \`node engine/status.js\`.** As of 6.0.0: \`data/game-differential.json\` 0 / 961; \`data/engine-diff.json\` 6,000 / 0; \`data/roster.*.json\` 142 / 139 / 487 tested, 0 / 0; \`data/mechanics-census.json\` 835 / 835. The win-probability gap against the official engine is a rollout figure: Case A from its re-run artifact, Case B withheld; lifts on the re-run \|` |

**D4. Plan block, L1187** — `1  finish MEDICHAM        search needs an engine that is fast AND correct` → `1  finish MEDICHAM        REACHED at 6.0.0 (correct on the pinned pool; 3.94x)`; add below the block: `Phase 2 has not begun.`

**D5. Measurement-validity table, L1442 (click censoring row)** — `**FIGURES WITHHELD — QUARANTINED, 2026-08-22.** …` → Case A: the figures from `data/click-censoring-census.json` with its stamp; Case B: `**withheld; lifts on the re-run** (\`node engine/click_census.js\`).`

**D6. "Honest ceilings" (L1389+)** — any sentence stating "MEDICHAM is not correct" as current: replace with `MEDICHAM passed its gate at 6.0.0; the ceilings below are properties of the game, not of the simulator.` `<RE-READ the section on the day; grep "not correct">`.

### 4E. `docs/MODELS.md`

**E1. Header** — L3 → `**Version 6.0.0 · Last updated <DAY>.**`

**E2. New top block — insert above L5**

> **6.0.0 - THE DISTANCE TO THE GATE IS ZERO, THE GATE IS OPEN, AND FOR THE FIRST TIME THIS LEDGER CAN CARRY A MODEL FIGURE AGAIN — FOR THE MODELS WHOSE GENERATORS DO NOT REACH THE PAUSED WEIGHTS.** Every model here sits downstream of MEDICHAM. `data/game-differential.json` on release `<RE-READ>`: board-material **0 of 961** (`state.games` 961 less `state.games_board_never_diverged` 961), none excluded, none cut off at cap 50; narration **0 of 961** less the one declared row; `data/engine-diff.json` 6,000 / 0; `data/roster.*.json` 142 / 139 / 487 tested with 0 DIFFER and 0 DID-NOT-FIRE; `data/mechanics-census.json` 835 / 835. `node engine/status.js` reads **9 of 9 clauses PASS**.
>
> **A QUARANTINED FIGURE IS RE-RUNNABLE, NOT TRUE, AND THE LIFT IS PARTIAL.** `node engine/major_readiness.js`: **40 artifacts lift**, **24 stay withheld** — every generator that writes or reads `data/policy-weights.json`, or is MILTANK, because Will sequenced the MAG refit after 6.0.0. So in this ledger: **MEDICHAM's own state is stated below; MEW, the leaf backtest (MEASURE's one number), the leaf/engine and leaf/position contrasts, the click-censoring census, the feature audit and feature shift, the immunity sweep, the redirect audit, the replay differential and the rollout explore/switch probes are stated from their re-run artifacts or written "withheld; lifts on the re-run"; MAG, the joint weights, MILTANK's decision profile, GARY / the opponent model (`opponent-calibration`, `opponent-recall`, `recall-at-k`), the exploitability triple, R3, the ladder, the scoreboard, `partial-label-em`, `brood`, `censoring-value`, `collinearity-audit`, `seed-source-audit` and `weight-multiplicity` stay withheld through this major with their generator named.** R1, R2 and R4 are re-derived on the day (`major_readiness.js`); R4 reaches MILTANK and MAG and is expected to stay.
>
> **LEAF CALIBRATION — MEASURE'S ONE NUMBER.** Case A: `data/winrate-backtest.json`, generated `<stamp>`, release `<id>`: `<replication verdict; Brier vs coin with CI; n decisive pairs; reliability curve by bucket>`. Case B: withheld; lifts on the re-run (`node engine/backtest_winrate.js`).
>
> **THE MAG REFIT STAYS OWED AND IT IS A REFIT.** `data/policy-weights.json` was not touched. `engine/feature_fixture.js --check` fires the fixture and the damage-table gates (318 species stamped, 322 in the table). A restamp answers the fixture gate and silences the table gate.

**E3. MEDICHAM section, after the heading at L1281** — insert a state block:

> **MECHANICS STATE, 6.0.0, read from the artifacts rather than typed.** `data/mechanics-census.json` **835 live / 835 probed / 0 missing / 0 hollow / 0 threw**, `run_ok` true. `data/engine-diff.json` **6,000 / 6,000 / 0** at 17 indices (skips: 134 multi-hit, 17 Parental Bond, 9 undrawable prior rows). `data/roster.items.json` 142 of 148 in scope tested, `data/roster.abilities.json` 139 of 201 (115 abilities have no legal carrier in this regulation and are not rows), `data/roster.moves.json` 487 of 498 — **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE**; fixture gaps 6 / 43 / 8, CONTROL-NOT-QUIET 14, deferred 0 / 5 / 3. `data/all-mechanics-fire.json` 1,313 games, 0 threw. `data/game-differential.json` board-material **0 of 961**, narration **0 of 961** less one declared row, 10,705 of 10,705 boundaries identical, on release `<RE-READ>` against authority `20ad99ff…`. Bound: 54 of 80 leaves compared, 9 declared uncompared, one driver, real teams, synthetic spreads. The 2026-08-06 block below is dated history.

**E4. MAG section (L1852) and MILTANK section (L2012)** — add one sentence at the head of each:
MAG: `**6.0.0 — withheld; STAYS through this major.** \`data/policy-weights.json\` is reserved for a refit sequenced after 6.0.0 (Will, 2026-09-09); every figure below that reads it is absent, not captioned.`
MILTANK: `**6.0.0 — withheld; STAYS through this major.** MILTANK is paused beside the MAG refit; \`data/search-decision-profile.json\` (\`engine/miltank.js\`) is not re-run.`

---

## 5. THE 6.0.0 RUNNING-NOTES ROW (paste at the top of `docs/RUNNING-NOTES.md`; rename every `[Unreleased]` heading below it to the version it landed as, per the page's own rule)

```
## [6.0.0] — <DAY> — MEDICHAM is correct against Showdown on the pinned pool; the gate is open; the living documents are folded in from 72 rows
- **What changed.** No engine byte in this row. `node engine/status.js` reads 9 of 9 clauses PASS on release `<RE-READ>` (authority `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`); the release directory is tracked (`git add -f data/releases/<id>`). The five living documents — `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`, `docs/SUMMARY.md`, `docs/MODELS.md` — carry a 6.0.0 block and their MEDICHAM sections are rewritten from the artifacts (draft: `docs/_reports/2026-09-10-600-medicham-doc-pass-draft.md`). The re-run of the LIFT set was run through `tools/lownode.cmd` with `--release <id>`: <list the commands actually run, from the day's `node engine/quarantine.js` print>. Not run, by decision: `engine/fit_policy.js`, `engine/fit_joint.js`, `engine/miltank.js`, and every generator that reads `data/policy-weights.json`.
- **Measured.** `data/game-differential.json`: `state.games` 961, `state.games_board_never_diverged` 961, `state.games_void_excluded` 0, `state.games_cut_off_by_the_turn_cap` 0, `state.turn_boundaries_compared` 10,705 = identical → BOARD-MATERIAL **0 of 961**; NARRATION **0 of 961** after the one closeted row (perish `|upkeep|`, ROADMAP #440); `end_state[0].summary.verdicts` SAME-END-STATE 960 / DIFFERENT 0 / ENDED-APART 0 / THREW 1; pins `--steering empirical --arm middle --end-state --state --games 1200 --turns 50 --team-store data/team-pool-frozen --census <pin>`, pool `0d103fb9fa87`. `data/engine-diff.json` 6000 / 6000 / 0 at 17 indices. `data/roster.{items,abilities,moves}.json:scope` 142 of 148 / 139 of 201 (115 out of scope: no legal carrier) / 487 of 498 (2 out of scope) tested, 0 DIFFER, 0 DID-NOT-FIRE, fixture gaps 6 / 43 / 8, CONTROL-NOT-QUIET 14, deferred 0 / 5 / 3. `data/mechanics-census.json` 835 / 835 / 0 missing. `data/all-mechanics-fire.json` 1313 / 0 threw. Board bound: `tests/probe_uncompared_leaves.js` compared 54 of 80, ceiling 54; `state.not_compared` 9. `node engine/major_readiness.js`: LIFT 40 / STAY 24 <RE-READ>. Re-run figures that lift: <one per artifact re-run, `path:field`, or "not re-run before the cut">. `node engine/docs_scan.js --owed` 0 of 100 after the fold-in.
- **Basis.** CHANGED — a reader can no longer be told (1) that MEDICHAM is not correct, the sentence under every model figure since 3.79.0: the gate is open and 40 withheld artifacts become re-runnable at once, so nothing published survives unrewritten; (2) that a board-material figure measured at cap 20 covers whole games — 35 of 961 games were cut short at that cap, and the cap-50 series (from 2026-09-07) is not the cap-20 series without a sample-identity check (the 2026-09-07 "turn cap was the horizon" row, released here); (3) that a level measured before the 2026-09-07 dice-addressing fix is in the same series as one after it (the "spread move's named target is a DIE" row, released here). This row absorbs both earlier `Basis. CHANGED` declarations that clause 5d could not judge while they were `[Unreleased]`.
- **Supersedes.** ~~BOARD-MATERIAL 27 of 961, PROTOCOL 93, NARRATION 70 of 961 on release `57679ef9a4a3`, cap 20~~ retracted as current — superseded by 0 / <protocol> / 0 on `<id>`, cap 50, and back-cast in the draft's §3 so the two series link; ~~census 830 / 830~~ → 835 / 835; ~~roster 140 of 148 / 129 of 202 / 475 of 500~~ → 142 of 148 / 139 of 201 / 487 of 498; ~~gate 2 of 9 fail~~ → 0 of 9; ~~"MEDICHAM is not correct"~~ retracted everywhere it stood as current in the five living documents. ~~63 / 64 artifacts withheld~~ → 24 withheld by decision (`major_readiness.js`).
- **Owed to the next major.** none — this row IS the fold-in. **Owed now, and named:** the MAG refit (a REFIT, `engine/fit_policy.js` then `engine/fit_joint.js` at `--max-old-space-size=4096`, only when Will says so); MILTANK's re-run after it; the 24 STAY artifacts, which lift only then; the deprioritised lab tail (43 / 8 / 6 fixture gaps, 14 CONTROL-NOT-QUIET); the residual trio if it re-enters the pool; phase 2 (ROADMAP #62).
```

---

## 6. THE CHANGELOG `## [6.0.0]` SKELETON (top of `CHANGELOG.md`, above `## [5.277.0]`)

```
## [6.0.0] — <DAY>

### Changed
- **THE MEDICHAM GATE IS OPEN — 9 of 9 clauses, on release `<id>` against Showdown commit
  `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`, and this is a MAJOR because the basis moved.**
  `data/game-differential.json`: BOARD-MATERIAL **0 of 961** (`state.games` 961 less
  `state.games_board_never_diverged` 961), `state.games_void_excluded` 0, cap 50 with 0 games cut off,
  10,705 of 10,705 turn boundaries identical; NARRATION **0 of 961** less the one closeted row
  (ROADMAP #440). `data/engine-diff.json` 6,000 / 0 at 17 indices. `data/roster.*.json` 142 / 139 / 487
  tested by legal carrier, 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE. `data/mechanics-census.json`
  835 / 835. `data/all-mechanics-fire.json` 1,313 / 0 threw. **This is not 5.0.0 again**: that
  opening (2026-08-10) was measured on a coverage-seeking driver whose games did not end and was
  retracted at 5.243.0; this one is on real teams, real clicks, whole games, one tracked release.
- **The living-document set is folded in from 72 notes rows (5.267.0 → 5.277.0 and every
  `[Unreleased]` row)**: white paper, deck, technical docs, SUMMARY, MODELS, and their PDFs
  (`build/build_pdfs.js`, 12 rebuilt). `docs/RUNNING-NOTES.md` `[Unreleased]` headings renamed to the
  versions they landed as. `node engine/docs_scan.js --owed` reads 0 of 100.
- **A PARTIAL lift, stated as one.** `node engine/major_readiness.js`: 40 artifacts re-run and quotable
  <list what was actually re-run with one figure each>; **24 stay withheld** — every generator that
  writes or reads `data/policy-weights.json`, or is MILTANK — because the MAG refit is sequenced after
  this release (Will, 2026-09-09). Each is absent from the documents with its generator named.
- The two `Basis. CHANGED` rows of 2026-09-07 (cap 20 → 50 horizon; dice addressing) are released
  here and back-cast in `docs/_reports/2026-09-10-600-medicham-doc-pass-draft.md` §3.

### Fixed
- <the last narration mechanism(s) closed between 5.277.0 and the day, one bullet each, with the
  probe shown red first and the release it was measured on>

### Notes
- **WHAT "CORRECT" DOES NOT MEAN.** 54 of 80 board leaves compared (ceiling 54; 18 duration-1, 2
  self-removed within the action), 9 fields declared uncompared; a within-turn board difference erased
  before a boundary is invisible (2 of 19 measured on the batch V population, both fixed); the damage
  differential skips 134 multi-hit and 17 Parental Bond comparisons by construction; spreads are
  synthetic; one driver; real teams — silent on any mechanic nobody brought. The lab tail (43 / 8 / 6
  fixture gaps, 14 CONTROL-NOT-QUIET, 5 + 3 deferred) is carried, not removed.
- **THE MAG REFIT STAYS OWED AS A REFIT, NOT A RESTAMP.** `data/policy-weights.json` untouched; the
  damage table moved 318 → 322 species under it.
- Phase 1 of the four-phase plan (§0.3) is reached; phase 2 (ROADMAP #62) is not started.
- WEB is paused; the site is NOT updated by this release (`tests/test-site-sync.js` waived by Will,
  2026-09-09). Local and GitHub are updated; the live site is not.
```

---

## 7. THE PARTIAL LIFT, IN WORDS `<RE-READ: node engine/major_readiness.js on the day>`

**Return (LIFT, 40 at drafting)** — re-run with `--release <id>` through `tools/lownode.cmd`, then
stated from the artifact: the whole-game differential itself, the three roster stages,
`all_mechanics_fire`, **leaf calibration** (`data/winrate-backtest.json` ← `engine/backtest_winrate.js`
— MEASURE's one number; report the reliability curve and the decisive-pair count, never a verdict
string), the leaf/engine contrast, the leaf/position contrast, the click-censoring census, the
feature audit, feature shift, the feature/engine contrast, the collinearity fix and joint checks, the
immunity sweep, the redirect audit, the replay differential, the rollout explore sweep and switch
probe, the PP board probe, the lookahead cost, `bench_speed`, `speed_vs_pokeenv`, MEW and its bundle.
(The 2026-09-09 plan's RUN list, 25 commands, is the dated form of this; re-derive.)

**Stay withheld by decision (STAY, 24 at drafting)** — generator writes or reads `data/policy-weights.json`,
or is MILTANK: `data/policy-weights.json`, `data/policy-weights-joint.json`,
`data/policy-weights-joint-presheet.json` (the refit, `fit_policy.js` / `fit_joint.js` — a RULE, not a
judgement); `data/exploitability.json`, `-mag.json`, `-machamp.json` (`exploit.js`);
`data/exploit-step-probe.json`, `-reparam.json`; `data/opponent-calibration.json`,
`data/opponent-recall.json`, `data/recall-at-k.json`; `data/ladder.json`; `data/scoreboard.json` /
`.js`; `data/mag.js`; `data/partial-label-em.json`; `data/brood.json`; `data/censoring-value.json`;
`data/collinearity-audit.json`; `data/seed-source-audit.json`; `data/sheet-channel-value.json`;
`data/weight-multiplicity.json`; `data/rollout-r3.json`; `data/search-decision-profile.json`
(`miltank.js`). **The largest single loss is the decision profile — 20 of the figures the scope
report counted rest on it.** R1, R2 and R4 appear on neither printed list in the 2026-09-09 plan;
read the day's derivation, and expect R4 to stay (it is MILTANK against MAG).

---

## 8. WHAT THE DAY REQUIRES — COMMANDS, IN ORDER

Preconditions, all read rather than remembered:
```
git status                                   # clean, no rebase in progress; no other agent live (a fold-in is a photograph)
node engine/status.js                        # must read: gate OPEN, 9 of 9 PASS — if 1 of 9, stop; there is no third state
node engine/engine_release.js drift <id>     # NO-DRIFT for the release every gate artifact stamps
git ls-files data/releases | grep -c <id>    # 0 → git add -f data/releases/<id>   (the 5.276.0 finding)
node engine/major_readiness.js               # READY; derives LIFT / STAY and the 79-edit scope
node engine/docs_scan.js --owed              # the rows to fold (72 of 100 at drafting)
```
The re-run (LIFT set only; six processes maximum; RAM is the cap; NEVER `fit_policy.js`, `fit_joint.js`,
`miltank.js` — and ask Will before any refit, which is excluded anyway):
```
node engine/quarantine.js                    # prints the re-run command beside each withheld artifact — copy from here, not from the plan
cmd /c tools\lownode.cmd engine\<generator>.js --release <id> ...   # one per LIFT artifact; record the whole command
cmd /c tools\lownode.cmd engine\backtest_winrate.js                 # leaf calibration — MEASURE's number; report curve + n, not a verdict
```
The fold-in:
```
# paste §4 A–E into the five documents (headers → 6.0.0; Case A/B per re-run state); §5 row at the top of docs/RUNNING-NOTES.md;
# rename [Unreleased] headings to the version they landed as; §6 into CHANGELOG.md
node engine/docs_scan.js --owed              # 0 of 100 — the floor rose with the 6.0.0 headers
node engine/docs_scan.js --quarantine        # only STAY artifacts may be named, and only as absent
node engine/status.js --write                # restamps the <!-- GENERATED --> blocks in the five ledgers; never hand-edit inside one
node build/build_pdfs.js                     # 73 sources, 7 excluded (derived from .claude/agents/ + declared residuals); 12 stale at drafting
```
The tests (heavy ones through `tools/lownode.cmd`; the runner prints waivers by name):
```
node tests/test-docs-current.js              # clause 5d: Basis CHANGED ⇒ X.0.0; citation clause on every new figure; ratchet file may tighten — commit it in the same commit
node tests/test-docs-quarantine.js           # no STAY figure stated anywhere
node engine/artifact_audit.js                # data/abra-tags.js is what build_tags_js.js would write
cmd /c tools\lownode.cmd tests\run-all.js    # 177 checks at drafting; SHOWDOWN_PATH set; waived checks print WAIVED — they do not vote
```
Then commit and push (the sole publisher; the pre-commit hook re-runs the docs gates; no `--no-verify`).
State the three places: **local — yes; GitHub — yes; live site — NOT updated, WEB is paused by Will
(2026-09-09) and `tests/test-site-sync.js` is waived by name.**

**How long the last pass took, from the record.** The record holds **no duration for a full living-document
fold-in.** The last major, 5.0.0 (`1a8ff720`, 2026-08-10 23:20 -0400), touched the four ledgers and the
sprint notes and **no living document** — the living-docs rule was under owner deferral for the MEDICHAM
sprint (white paper 5.205.0 block). The nearest thing is the 5.266.0 publish pass: one version block into
all five living documents plus eleven PDFs (38 files) landed in **~55 minutes** between the 5.265.0
commit (`d7764530`, 13:19:58 -0400) and the 5.266.0 commit (`d7ed4b75`, 14:15:14 -0400), with the report
`docs/_reports/2026-09-06-publish-5266.md`. The 2026-09-09 scope report estimated "about a day of
writing" for 85–90 edits; `major_readiness.js` now derives **79 figure-level edits** plus **72 rows**.
Budget a day for the writing and the re-run separately; the re-run is bounded by RAM, not by the clock.

---

## 9. WHAT THIS DRAFT COULD NOT DO, AND WHY

- **It cannot write the narration sentence as fact.** The clause reads 6 of 961 across 7 causes tonight
  (§3 lists them by mechanism). The NEW text assumes 0; if the day arrives with a non-zero clause the
  gate is shut, `major_readiness.js` says NOT READY, and none of §4 may be pasted — there is no third state.
- **It cannot state a single lifted figure.** Every LIFT artifact is stated Case A / Case B; the number
  is read from the re-run artifact on the day or the sentence says "withheld; lifts on the re-run".
  Leaf calibration in particular: report the curve, the bucket table and the decisive-pair n, and if
  the model loses to a coin, write that.
- **It cannot fix the 43 untraceable figures** `major_readiness.js` counts in the living set; ~20 are
  MAG-family and are handled by the STAY sentence, `docs/ARCHITECTURE.md:163` is outside the living set,
  and the 7 inside their own WITHDRAWN notices need nothing. The remainder are read line by line on
  the day (`node engine/docs_scan.js --json`).
- **Line numbers shift** once the top blocks are inserted; paste top-down within each file.
- **The release id, the census pin digest, the `generated` stamps, the LIFT/STAY counts, the owed-row
  count, the withheld count and the provenance counts are all `<RE-READ>`** — a batch between now and
  the day moves every one of them, and this file is dated evidence, not state.
