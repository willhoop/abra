# Narration batch C: Forewarn, Chilly Reception with no bench, Sleep Powder under Misty Terrain, and the Harvest coin under them

2026-09-19. ENGINE division, isolated worktree
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a609774416c9d7f5f`, LIGHT MODE. Only staged boards,
single probes and single-game replays were run. There were no lattice runs, no roster stage, no `quarantine.js` and no
`all_mechanics_fire`.

## VERDICT

- **All three briefed mechanisms are fixed.** A fourth defect was found under the second Forewarn game: Harvest
  threw its residual coin only when a berry was waiting. That is fixed too.
- **All five lattice games replay to the end of the battle with no split** on `207acaf6a46e`. On the baseline
  `1a6550ea5ec6`, each one reproduced the §4 split index.
- **Probe.** `tests/probe_narration_c.js` stages 45 games in both engines.
  - On the baseline `1a6550ea5ec6` it parted **35**. Every board agreed.
  - On `207acaf6a46e` it parts **0**. All 46 checks pass.
  - Each knob parts only its own class. The three narration knobs move no board.
- **Census:** **947 → 951 live**, 0 missing, 0 threw, 0 hollow. `status.js` reads
  `951/951 probed mechanics live, 0 missing`.
- **The roster is untouched.** Forewarn's roster row stays DEFERRED-BY-OWNER.

## RELEASES (all cut in this worktree; `data/engine-release.json` restored to HEAD afterwards)

| id | tree |
|---|---|
| `1a6550ea5ec6` | Unmodified HEAD `d81807e4`. The re-cut returned the same id. Its appended cut record was restored to HEAD, so the tracked `data/releases/1a6550ea5ec6/` is unchanged. |
| `26a5c37af83c` | Forewarn, Chilly Reception and the held status. Four of the five games were clean. `…2657893729` still split at 38. |
| `207acaf6a46e` | **Final.** Adds the Harvest coin. The probe, the census and all five replays were run on these bytes. |

**Replay pins:**

- team store `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen`, read in place (pool `a5ce76242f8d`);
- `--arm middle --steering empirical --end-state --turns 50 --no-warmup`;
- `--games` and `--config` as each lattice card records them;
- census not pinned: under empirical steering it is credited only.

## 1. FOREWARN (3 games)

- **Authority.** `data/abilities.ts:1494-1517`. `data/mods/champions/abilities.ts` has no `forewarn` entry. The handler
  walks `pokemon.foes()`, which is the live foes in slot order, and each foe's `moveSlots` in order. It scores
  `basePower` with four rewrites, in this order:
  - `ohko` → 150;
  - `counter` / `metalburst` / `mirrorcoat` → 120;
  - `bp === 1` → 80;
  - `!bp && category !== 'Status'` → 80.

  It then keeps the strict maximum and appends equals. `if (!warnMoves.length) return;` sits above the sample, so an
  empty list draws nothing. The pick is `this.sample(warnMoves)`, which is `items[random(len)]` and always draws, even
  for a list of one. The line is `-activate|HOLDER|ability: Forewarn|MOVE|[of] FOE`.
- **Cause.** The engine counted Forewarn as unmodelled (`MEDFAILS.entryAnnounceUnmodelled`). It wrote nothing and drew
  no die.
- **Fix.**
  - `engine/tag_dex.js` reads the pick rule off the handler into `announcesOnEntry.picks`:
    - the floor, from `let warnBp = 1`;
    - the four rewrites, in source order, each matched by shape. `picks` is refused unless every `bp = <n>;` in the
      handler is claimed by one of them;
    - a per-move `score` for all 325 legal non-Status moves.

    It printed what it matched: 25 moves rewritten. These are the four OHKO moves at 150, the three counter moves at 120,
    and 18 variable or fixed-damage moves at 80.
  - The engine's `forewarnAnnounce` does the walk in the authority's order and draws on `medRng()`, the shared generic
    die. It is called from `applyEntryEffects`, which both entry roads run in the authority's `runSwitch` order.
  - Loud counters: `forewarnNoDie`, `forewarnMoveUnknown` and `forewarnNoState`. All three read 0.
- **`data/tags.json` WAS SPLICED, NOT REGENERATED.** This worktree has no store, so a regeneration writes every usage
  count as 0. `tag_dex` was run here, and the output was compared with HEAD by a deep diff. Usage-derived fields
  (`uses`, `sheet_entries`, `examples`, `linkage`, the `tags` summary) differed in 3,042 places. **Exactly one other
  path differed: `abilities.forewarn.params.announcesOnEntry.picks`.** That param alone was grafted onto HEAD's
  file: 358 insertions, 0 deletions. A regeneration in the main tree reproduces it.
- **Knob** `MEDI_FOREWARN_SILENT=1` restores the old silent road exactly: no line and no die. In the probe it parts 22
  games: the 10 Forewarn arms and the 12 Harvest arms, which use a Forewarn line as their witness. No board moves.
- **Probe class.**
  - Lead arms for three of the four rewrites, each in both slot orders:
    - OHKO: Fissure on Camerupt against Last Resort (140) on Blaziken;
    - counter family: Counter on Blaziken against Blizzard (110);
    - the `!bp` rule: Beat Up on Barbaracle against Air Slash (75).

    The `bp === 1` rule has no legal member (0 moves), and the probe says so.
  - A status-only negative: nothing is said and nothing is drawn.
  - A three-way tie at 150: Absol with Giga Impact and Hyper Beam, and Blaziken with Blast Burn. The carrier switches
    in on turns 1 to 4. The authority's die named two different moves across those turns, so the arm is not vacuous.
- **Replays on `207acaf6a46e`:**

  | game | baseline split | final |
  |---|---|---|
  | g1350 `pair-redirect-priority …2659123487` | index 6 | no split, 162/162 lines |
  | g1350 `pair-speedctrl …2657893729` | index 38 | no split, 131/131 lines (needed §4) |
  | g1950 `omit-weather …2634615536` | index 4 | no split, 103/103 lines |

  On `26a5c37af83c`, `…2657893729` still split at 38. Our Forewarn named Sacred Sword and the authority named Muddy
  Water. See §4.

## 2. CHILLY RECEPTION'S MISSING `-fail` (1 game)

- **Authority.** `data/moves.ts:2396-2420`: `weather: 'snowscape'`, `selfSwitch: true`, target `all`. In
  `runMoveEffects`:
  - `setWeather` is false under its own sky (`sim/field.ts:45-52`), so `:1248` combines a false;
  - `:1289`: `canSwitch` is 0, so `selfSwitch` combines a false;
  - `:1303`: with `didAnything` false, it writes `-fail|USER` and `attrLastMove('[still]')`.
- **Cause.** The weather rider returned false and nothing kept it. The pivot then found an empty bench and switched
  nobody, silently.
- **Fix.** The rider stores `it._riderSkyFailed`. The pivot tail fails the move when `_riderSkyFailed` is set and
  `canDragIn(bench)` is false: `mvFail` plus `attrStill`, which also sets `_mvRes = false`, as the authority's
  `moveThisTurnResult` does. With a bench, the move still pivots.
  - The class is derived: `weather && selfSwitch` has exactly one legal member, `chillyreception`.
  - `commanded` is not modelled. The regulation has 0 legal Commander carriers (derived).
- **Knob** `MEDI_CHILLY_NOBENCH_SILENT=1`. It parts 4 games, all in its own class, and moves no board.
- **Probe class.** A two-body side, so there is no bench, over K = 4 offsets: the first click sets the snow and does
  not fail, and the second click fails. Two controls, neither of which fails in the authority: a bench (it pivots), and
  a different sky (Rain Dance first, then the snow lands).
- **Replay.** g1950 `omit-intimidate …2662362231`. On the baseline it split at index 105 on `-fail|p1b: Slowking`. On
  `207acaf6a46e` there is no split: 128/128 lines, 9 turns, and both engines end the battle.
- **Not a divergence.** The §4 table notes that "our Yawn `-end` lacks `[silent]`". The comparator's `display-flags`
  rule drops `[silent]` (`engine/game_differential.js` EQUIV), and the replay confirms that line does not part.

## 3. SLEEP POWDER INTO A SLEEPING BODY UNDER MISTY TERRAIN (1 game)

- **Authority.**
  - `sim/pokemon.ts:1675`: `trySetStatus` calls `setStatus(this.status || status)`.
  - `:1704-1712`: a held status is answered with `-fail|TARGET|st` (same status) or `-fail|SOURCE` + `[still]`
    (different). This comes **before** `runEvent('SetStatus')` at `:1729`.
  - Misty Terrain, Electric Terrain, Safeguard, the veils and Uproar are all SetStatus handlers.
- **Cause.** `applyStatus` asked those five refusals first and asked the held status inside `canTakeStatus` last. So
  Misty Terrain wrote `-activate|X|move: Misty Terrain` where the authority writes `-fail|X|slp`.
- **Fix.**
  - `applyStatus` now answers `hasstatus` first. Every caller is a `trySetStatus` road, and Rest clears the status
    before it calls.
  - The status-move caller's Safeguard guard no longer swallows a `hasstatus` line.
  - This also closes batch A's open note, "Synchronize onto a statused source protected by Safeguard".
  - `statusHeldAnsweredFirst` counts the calls where Uproar or a terrain would have answered instead.
- **Knob** `MEDI_STATUS_HELD_AFTER_FIELD=1`. It parts 9 games, all in its own class, and moves no board.
- **Probe class.**
  - Refusals:
    - Misty Terrain: par, slp and tox;
    - Electric Terrain: slp;
    - Safeguard on the target's side: par, slp and tox.
  - Each refusal has a same-status arm and, where the user learns one, a different-status arm. Each also has a
    fresh-target control, where the refusal still speaks.
  - The target is Absol (grounded, Dark). The users are Dedenne, Roserade and Goodra. The setters are Azumarill and
    Ampharos. All are derived as legal learners, and the fixture check reads 0 illegal.
- **Replay.** g1950 `pair-protect-bust …2661874022`. On the baseline it split at index 52 on
  `-fail|p1a: Meowstic|slp`. On `207acaf6a46e` there is no split: 212/212 lines, 17 turns, and both engines end the
  battle.

## 4. HARVEST'S COIN (FOUND, UNDER FOREWARN GAME `…2657893729`)

- **How it was found.** The authority's die addresses were printed beside a stack trace of every authority draw
  (scratch `dice3.js`). At the end of turn 2 the authority drew twice at `20260813|2|any|-|-`:
  - `|0` was `randomChance(1,2)` at `data/abilities.js:1782`, Harvest's `onResidual`, for a Trevenant with no berry;
  - `|1` was the entering Musharna's `sample(len2)`.

  This engine drew once, so its Forewarn read the die the authority had spent on Harvest.
- **Authority.** `data/abilities.ts:1793-1801`, no Champions override:
  `if (isWeather(['sunnyday','desolateland']) || this.randomChance(1, 2)) { if (hp && !item && lastItem isBerry) … }`.
  The coin comes first.
- **Fix.** The coin is thrown for every Harvest body at the residual. It is not thrown in the sun, where the condition
  short-circuits exactly as the authority's does. The restore then uses that coin. Counter `harvestCoinThrown`.
- **Knob** `MEDI_HARVEST_COIN_GATED=1`. **This is a die, not a line, so it can move a board**: a coin one address early
  decides a real restore. In the probe it parts 5 of the 6 berry-less arms, all in its own class, and 0 of them on a
  board leaf. The probe reports board movement for this knob but does not forbid it.
- **Probe class.**
  - The Harvest arms: a berry-less Trevenant beside a Gallade that uses Memento, on a three-body side. Musharna then
    enters at the end of turn 1 to 6.
  - The foes carry a four-way 150 tie: Absol with Giga Impact and Hyper Beam, and Ampharos with Focus Punch and Giga
    Impact.
  - The same arms without the Harvest body are the control.
  - A two-way tie was tried first. The gated coin parted nothing over four turns: one chance in two per turn cannot be
    told apart from an unwired knob. It was widened to four ways, and the report says so.

## THE CENSUS

- Four rows in `tests/test-mechanics.js`, at the end of narration batch A's block:
  - ability `announcesOnEntry`: Forewarn scoring, both slot orders, and a status-only negative;
  - move `pivotStatus`: Chilly Reception with no bench;
  - move `inflictsParalysis`: the held status before Misty Terrain;
  - ability `restoresBerryAtResidual`: the Harvest coin, and none in the sun.
- The four knob stamps are in `DELIBERATE_BREAK`.
- The census was run under each knob. Each row reads MISSING under its own knob and LIVE under the other three. The
  census refused to write in all four runs, and its mtime was unchanged.
- Regenerated: 947 → 951 live, 0 missing, 0 threw, 0 hollow, `run_ok: true`.

## OTHER GATES RUN

- `tests/probe_narration_a.js --release 207acaf6a46e`: all pass. Its Synchronize arms share `applyStatus`.
- `tests/probe_harvest_nonberry.js`: pass.
- `tests/test-no-silent-failure.js`: pass.
- **`tests/test-protocol-trace.js`: RED, 1 failure, and it is RED ON HEAD TOO.** PART 5, "the two streams never part
  in the Intimidate arm". It was run with the worktree's engine and `tags.json` temporarily replaced by the
  `1a6550ea5ec6` copies, then restored and byte-checked against `207acaf6a46e`. The same single failure appeared. Both
  engines now print `112/170`, and the assertion expects the damage die to differ. It is stale, it is not caused by this
  pass, and it is not fixed here. See OWED.

## FILES CHANGED (worktree; nothing committed)

- `engine/medicham2-browser.js`:
  - four knobs, stamped at load: `MEDI_FOREWARN_SILENT`, `MEDI_CHILLY_NOBENCH_SILENT`, `MEDI_STATUS_HELD_AFTER_FIELD`,
    `MEDI_HARVEST_COIN_GATED`;
  - `forewarnAnnounce`;
  - the rider's `_riderSkyFailed` and the pivot-tail `-fail`;
  - the held-status hoist in `applyStatus` and the caller's Safeguard guard;
  - the Harvest coin order;
  - counters. MEDSEEN: `forewarnAnnounced`, `forewarnDie`, `forewarnNoDie`, `forewarnNothing`,
    `pivotNothingDoneFailed`, `statusHeldAnsweredFirst`, `harvestCoinThrown`. MEDFAILS: `forewarnMoveUnknown`,
    `forewarnMoveUnknownFirst`, `forewarnNoState`.
- `engine/tag_dex.js`: the `picks` derivation on `announcesOnEntry`.
- `data/tags.json`: the Forewarn `picks` param, spliced (see §1).
- `tests/probe_narration_c.js` (new).
- `tests/test-mechanics.js`: four rows and four `DELIBERATE_BREAK` stamps.
- `data/mechanics-census.json`: regenerated, 947 → 951.
- `docs/ENGINE.md`:
  - a new section above the 6.57.0 section, with its hand list;
  - the probe added to the Owns list.

  53 lines inserted. The GENERATED block is untouched and `status.js --write` was not run.
- Restored to HEAD after side effects: `data/engine-release.json`, `data/provenance-stamp.json` (`status.js` read),
  and `data/releases/1a6550ea5ec6/{cuts.jsonl,release.json}` (the identical-tree re-cut's appended record).
- Left in place, ignored by git: `data/releases/26a5c37af83c/` and `data/releases/207acaf6a46e/`, and the pool cache
  that `replay_one` rebuilt.
- Nothing was deleted, and no process was killed. Every child process ended on its own.
- Scratch files (this session only) are in the scratchpad subfolder `narration-c/`: replay logs, the dice tracers,
  the tags diff and graft scripts, and the probe and census logs.

## PROPOSED NOTES ROW

```
| 2026-09-19 | **Narration batch C — Forewarn, Chilly Reception with no bench, the held status before Misty
Terrain, and (found) Harvest's coin; no board moved by the three narration fixes.** Forewarn now names the move the
authority names: live foes in slot order x move slots, four `bp` rewrites read OFF THE HANDLER by tag_dex into
`announcesOnEntry.picks` (325 scored moves), strict max with ties appended, and the pick drawn off the shared generic
die even for a list of one (data/abilities.ts:1494-1517). Chilly Reception into its own snow with nobody to switch to
writes `-fail` + `[still]` (sim/battle-actions.ts:1248/1289/1303). A status into a body that already holds one is
answered by the held status before any SetStatus handler — Misty/Electric Terrain, Safeguard, the veils, Uproar
(sim/pokemon.ts:1675, 1704-1712 above 1729). Found under Forewarn game …2657893729: Harvest threw its residual coin
only when a berry was waiting (data/abilities.ts:1793-1801 throws it first), one `nth` short at the residual address —
a DIE, able to move a board. Knobs `MEDI_FOREWARN_SILENT`, `MEDI_CHILLY_NOBENCH_SILENT`,
`MEDI_STATUS_HELD_AFTER_FIELD`, `MEDI_HARVEST_COIN_GATED`. Two-engine probe `tests/probe_narration_c.js`: 35 of 45
staged games parted on `1a6550ea5ec6`, 0 on `207acaf6a46e`; each knob parts only its own class. All five lattice games
(g1350 …2659123487, …2657893729; g1950 …2634615536, …2662362231, …2661874022) replay on `207acaf6a46e` to battle end
with no split. Census 947 → 951 live / 0 missing (`data/mechanics-census.json`). Forewarn's roster row stays
DEFERRED-BY-OWNER. `data/tags.json` spliced (worktree has no store): one param. **Supersedes.** Nothing published —
narration 0 / 2 / 6 on `1a6550ea5ec6` stands until the lattices are re-run. **Basis.** unchanged. Owes:
docs/ENGINE.md (done), the white paper's narration paragraph at the next major. |
```

## OWED, NOT RUN

1. **The three lattices on `207acaf6a46e`.** Use `--games` 1200 / 1350 / 1950 with a census pin,
   `--team-store data/team-pool-frozen`, and `--steering empirical --arm middle --end-state`.
   - **This is a prediction, not a measurement.** If no game parts on its next divergence, narration undeclared goes
     from 0 / 2 / 6 to **0 / 0 / 3**:
     - g1350 loses both Forewarn games;
     - g1950 loses Forewarn, Chilly Reception and Misty Terrain, and keeps Mortal Spin, Magician and Hyper Cutter
       order.
   - Board-material is expected to stay 0 / 0 / 0. That is expected, not measured.
   - **The Harvest fix moves a die.** It changes the residual `any` address in every game with a Harvest body. A
     lattice game can therefore part, or join, somewhere new.
2. **Artifacts invalidated by the engine change, to re-run on the new release:** the roster stages, `all_mechanics_fire`
   and `test-engine-diff`.
3. **`data/tags.json` should be regenerated in the main tree** (which has the store) with `engine/tag_dex.js`, to
   confirm that the splice equals a real regeneration. Expected: the `picks` param plus usage counts that have moved
   with the store since 07:44.
4. **For the coordinator to publish:**
   - the CHANGELOG entry and version (`<<VER>>` in `docs/ENGINE.md`);
   - the notes row above;
   - `node engine/status.js --write`;
   - the commit, adding by name: `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/tags.json`,
     `data/mechanics-census.json`, `tests/probe_narration_c.js`, `tests/test-mechanics.js`, `docs/ENGINE.md` and this
     report.
5. **Red on HEAD, not from this pass:** `tests/test-protocol-trace.js` PART 5. Both engines now agree on the Intimidate
   × crit damage, so "the streams must part at the damage die" is stale. It needs its owner to change the assertion to
   "they agree", or to restage something that still differs. It was not changed here, because it is outside the brief.
6. **Not checked.** Each of these was found while reading the code, and none is claimed.
   - Forewarn after a mid-battle ability change (Trace, Skill Swap or Role Play onto a Forewarn body). The authority's
     `onStart` fires there, and this engine announces only on entry.
   - Forewarn against a Transformed or Imposter foe.
   - Harvest in the sun under Cloud Nine. The sky test uses `effWeatherOf` as before, and it was not staged.
   - The Safeguard branch of `applyStatus` writes its `-activate` with no test on the effect. The authority announces
     only for a move without secondaries (`data/moves.ts:15595`). Whether a secondary ever reaches that branch was
     not traced. This is pre-existing, was not touched, and is not claimed as a defect.
