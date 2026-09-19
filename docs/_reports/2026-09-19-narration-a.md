# Narration batch A: Roost, spread with no foe, the Synchronize refusal, and an ally-aimed move with no partner

2026-09-19. ENGINE division, isolated worktree
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a2b92093dc9d7209a`, in LIGHT MODE. Only staged
boards, single probes and single-game replays were run. There were no lattice runs, no roster stage, no
`quarantine.js` and no `all_mechanics_fire`.

## VERDICT

- **All four buckets are fixed.** A fifth line from the same class was found and fixed too: Corrosive Gas with
  nobody left to aim at.
- **No board leaf moved.** The two-engine probe asserts it for every game. Each knob, run in a child process,
  asserts that the old emission moved no board.
- **Probe.** `tests/probe_narration_a.js` stages 78 games across the four classes.
  - On baseline `8a4140de3eaa` it parted **38**.
  - On final `f557bf93ba48` it parted **0**.
- **Replays.** One lattice game was replayed per bucket.
  - On the baseline, each game reproduced the artifact's split index.
  - On `f557bf93ba48`, each game plays to the end of the battle with no divergence.
- **Census.** 925 → 930 live, 0 missing, 0 threw, 0 hollow. Status reads `930/930 probed mechanics live, 0 missing`.

## RELEASES (all cut in this worktree; `data/engine-release.json` restored to HEAD afterwards)

| id | tree |
|---|---|
| `8a4140de3eaa` | unmodified HEAD `86ccc49e`. This is the baseline. It has the same id as the main tree's pointer. |
| `a992d56effa7` | the four bucket fixes |
| `f746e8fe4e3a` | + the Corrosive Gas no-target fail |
| `fa57e5334993` | + the knobs stamped at load, and the comment citations corrected |
| `f557bf93ba48` | **final**: + one more comment citation corrected (Misty Terrain). The probe, the census and all four replays were re-run on these bytes. |

The team store was pinned to the main tree's `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen`
(pool `7e7a37ded7fc`, 2,206 teams from 8,778). Replay flags: `--arm middle --steering empirical --no-warmup`,
with `--games` and `--config` set to the values each lattice artifact recorded.

## THE FIVE MECHANISMS

### 1. Roost's `-singleturn` was missing (4 games)

- **Authority.** `data/moves.ts:15439-15447`: the `roost` condition's `onStart` runs
  `this.add('-singleturn', target, 'move: Roost')` for every body. Its only check is Terastallization. Deleting
  Flying is a separate `onType` handler. Champions overrides neither: a grep of `data/mods/champions/{moves,conditions,scripts}.ts` finds no `roost`.
- **Cause.** `TR.st1` sat inside the branch that drops the type (`_left.length !== m.types.length`). A Grass/Fighting
  Decidueye-Hisui, a Bug/Steel Scizor or a Dragon/Fairy Altaria-Mega therefore healed with no announcement.
- **Fix.**
  - The type drop is unchanged and is still gated on `!m._typeWas`.
  - The line is now written whenever the heal landed and the volatile is new.
  - `m._roostTurn` holds that memory for a body that has no Flying type. It gates the LINE only, so a stale stamp
    can cost a narration line but never a type.
  - Counter: `MEDSEEN.roostAnnouncedNoFlying`.
- **Knob.** `MEDI_ROOST_ANNOUNCE_FLYING_ONLY=1`. In the child it parts 3 games, all of them Roost. No board moves.
- **Class.** Non-Flying, dual Flying, and the full-HP negative. No legal pure-Flying Roost user exists; the probe
  derived this and printed it.
- **Replay.** `…2658575001` (g1350, `baseline`):
  - on baseline, the split was at index 59, `|-singleturn|p2a: Decidueye|move: Roost`;
  - on `f557bf93ba48`, 141/141 reduced lines, and the battle ends.

### 2. An extra `-fail` on a spread move with no foe left (3 games)

- **Authority.**
  - `sim/pokemon.ts:808-817`: an `allAdjacent` list is `adjacentAllies()` followed by `adjacentFoes()`, and the move
    line is retargeted to the last entry.
  - `sim/battle-actions.ts:509-513`: `[notarget]` + `-fail` are written only for an EMPTY list.
- **Cause.** `targets` holds only the FOES at the `_hadTargets` read. The partner is prepended about 400 lines
  later as `_allyHit`. So Earthquake or Discharge thrown after both foes fell printed `|-fail|USER` and then hit the
  partner anyway.
- **Fix.** `_hadTargets` now includes a live partner for an `allAdjacent` move, using the same predicate as
  `_allyHit`. The move line is retargeted to the partner (fidelity only: the differ truncates `|move|`). Protean,
  `_mvRes` and the crash now follow the authority too, because they all read `_hadTargets`.
- **Class.**
  - All **16** legal `allAdjacent` moves, derived. Their user is a legal learner that is slower than the two
    Memento users.
  - The negatives:
    - three `allAdjacentFoes` moves in the same spot;
    - the same `allAdjacent` move with the partner Healing-Wished away.
- **Knob.** `MEDI_SPREAD_NOFOE_FAILS=1`. It parts 14 spread games. No board moves.
- **Replay.** `…2656658836` (g1350, `baseline`):
  - on baseline, the split was at index 58, `-resisted|p1b: Heliolisk` against `-fail|p1a: Rotom`;
  - on `f557bf93ba48`, 110/110 reduced lines, and the battle ends. The line reads
    `P1a Rotom uses Discharge -> P1b Heliolisk`.

### 2b. Corrosive Gas with nobody left (found while staging the class of #2)

- **Cause.** The `trickitem` branch ran its gauntlet over an empty `statusMoveTargets` list and printed nothing. The
  authority writes `[notarget]` + `-fail`. The `affect` branch already failed an empty list through `mvFail`.
- **Fix.** The check asks the FIELD rather than `_tl`: no live foe, and for a `spreadAll` member no live partner.
  It does this because `statusMoveTargets` also drops a body that Magic Bounce sent the move back from, and a
  bounced click is not a targetless one.
- **Knob.** `MEDI_ITEMMOVE_NOTARGET_SILENT=1`. It parts 1 game, `spread-corrosivegas-partnergone`. No board moves.
- **Not in the lattice buckets.** No replay was owed for it.

### 3. Synchronize's `-immune` was missing (3 games)

- **Authority.**
  - `data/abilities.ts:4849-4858` calls `source.trySetStatus(status, target, { status: status.id, id: 'synchronize' })`.
    The comment in that file reads "Hack to make status-prevention abilities think Synchronize is a status move".
  - `sim/pokemon.ts:1704-1723` gates every refusal line on `(sourceEffect as Move)?.status`:
    - same status: `-fail|SOURCE|st`;
    - a different held status: `-fail|<the Synchronize holder>` + `[still]`;
    - type immunity: bare `-immune`.
  - Each legal status-refusing ability writes its own `-immune … [from] ability: X` under `effect?.status`: Immunity,
    Limber, Water Bubble, Purifying Salt and Leaf Guard. The handlers were read from the Dex.
  - Misty Terrain's `onSetStatus` tests `effect.status` (`data/moves.ts:12173-12178`).
  - Safeguard tests `effect.id === 'synchronize'`.
  - Flower Veil tests `effect.name === 'Synchronize'`, and the effect object has no name.
- **Cause.** The reflect call was `applyStatus(src, st, t)`. It passed no effect and announced nothing.
- **Fix.**
  - The call passes `SYNC_EFF = {kind:'sync', id:'synchronize'}`.
  - `ATTR.status` gives it the bare `-status` line on a landing, unchanged.
  - The refusal is routed on `_why.reason` in the same way as the status-move branch:
    - `type`, `ability` and `weather` give `TR.imm` (with `statusImmune.announcesWith`);
    - `hasstatus` gives the two `-fail` shapes.
  - Misty Terrain now announces for it.
  - A reason that neither branch routes is counted in `MEDFAILS.syncRefusalUnrouted`, which reads 0.
- **Class, staged with K=3 idle offsets.**
  - Poison, Fire and Electric sources.
  - Limber (Liepard).
  - Leaf Guard in sun (Meganium, with Poison Powder).
  - Safeguard on the source's side.
  - Source already tox, source already brn, and a control that lands.
  - No legal source could be staged for four arms, and the probe printed each one:
    - Steel, because no quiet legal Steel type learns a tox move;
    - Immunity, because Snorlax learns no tox/psn move;
    - Water Bubble and Purifying Salt, because their carriers learn no matching move.
- **Knob.** `MEDI_SYNC_IMMUNE_SILENT=1`. It parts 18 Synchronize games. No board moves.
- **Replay.** `…2654088012` (g1350, `omit-weather`):
  - on baseline, the split was at index 110, `|-immune|p1b: Sneasler`;
  - on `f557bf93ba48`, 231/231 reduced lines, and the battle ends.

### 4. Coaching's `-fail` was missing (2 games)

- **Authority.** Coaching is `adjacentAlly` (`data/moves.ts:2590-2604`). With the partner fainted,
  `getMoveTargets` returns an empty list (`sim/pokemon.ts:844-846`), and `useMoveInner` writes `[notarget]` + `-fail`.
- **Cause.** The `boostally` branch reached `_lift = []` and printed nothing.
- **Fix.** When no partner is standing, a `targetClass: adjacentAlly` move writes `[notarget]` + `mvFail(m)`.
- **Class.** All 4 legal `adjacentAlly` moves, derived. Aromatic Mist and Coaching were silent. Helping Hand and
  Dragon Cheer were already correct.
- **Knob.** `MEDI_COACHING_NOALLY_SILENT=1`. It parts 2 games. No board moves.
- **Replay.** `…2635841176` (g1950, `pair-speedctrl`):
  - on baseline, the split was at index 74, `|-fail|p1b: Sneasler`;
  - on `f557bf93ba48`, 105/105 reduced lines, and the battle ends.

## THE PROBE AND THE CENSUS

- **The two-engine probe is `tests/probe_narration_a.js`.**
  - Every class is derived from `Dex.forFormat`.
  - Every fixture is learnset-legal: only a `9…` source counts, because Reuniclus reached Explosion through
    Duosion's 5M-7M. The harness's fixture check reads `0 illegal`.
  - Non-vacuity is asserted off the AUTHORITY's stream for every class.
  - Each knob runs in a child and must do three things:
    - part its own class on protocol;
    - part nothing else;
    - move no board.
  - On `f557bf93ba48`: 48 checks, all passed.
- **Census rows.** Five rows were added to `tests/test-mechanics.js`, under the helper `narRun(`, which is declared
  in REALTURN with its reason:
  - move `typeRemovedForTurn`;
  - move `spreadAll`;
  - move `takesTargetItem`;
  - ability `reflectsStatusToSource`;
  - move `boostsTarget`.
- **Each row was run under its own knob.** Each row reads MISSING under its knob and LIVE under the others. The
  census REFUSED to write in all five runs, because the five knobs are stamped on `MEDFAILS` at LOAD and are listed
  in `DELIBERATE_BREAK`.
- **Gate results.** `tests/test-no-silent-failure.js`: no new silent failures. `tests/test-protocol-trace.js`:
  ALL PASSED.

## FILES CHANGED (worktree; nothing committed)

- `engine/medicham2-browser.js`: the five fixes, five knobs with load stamps, and counters.
  - `MEDSEEN`: `roostAnnouncedNoFlying`, `spreadAllyOnlyTarget`, `syncRefusalAnnounced`, `allyBoostNoTargetFail`,
    `itemMoveNoTargetFail`.
  - `MEDFAILS`: `syncRefusalUnrouted`.
- `tests/probe_narration_a.js` (new).
- `tests/test-mechanics.js`: five rows, `narRun` in REALTURN, and five `DELIBERATE_BREAK` stamps.
- `data/mechanics-census.json`: regenerated, 925 → 930.
- `docs/ENGINE.md`:
  - a new section above the 6.52.0 section, with its hand list;
  - the probe added to the Owns list.

  The file is now LF on disk. The HEAD blob is LF, and git reports only the 45 changed lines.
- `data/engine-release.json` and `data/provenance-stamp.json` were rewritten as side effects (a release cut, and a
  `status.js` read). Both were restored to HEAD.
- `data/releases/{8a4140de3eaa,a992d56effa7,f746e8fe4e3a,fa57e5334993,f557bf93ba48}/` were created and are ignored by git. They
  were left in place.

## PROPOSED NOTES ROW

```
| 2026-09-19 | **Narration batch A — four buckets closed, no board moved.** Roost's `-singleturn` now
announces on every body (the line sat inside the Flying deletion; data/moves.ts:15439-15447); an
`allAdjacent` move with no foe left hits the partner without `[notarget]`/`-fail` (sim/pokemon.ts:808-817,
sim/battle-actions.ts:509-513); a Synchronize reflection the source refuses writes the authority's
`-immune`/`-fail` line (sourceEffect carries `.status`, data/abilities.ts:4857, sim/pokemon.ts:1704-1723);
Coaching and Aromatic Mist with no partner write `[notarget]` + `-fail`; and, found while staging the class,
Corrosive Gas with nobody left does the same. Five knobs (`MEDI_ROOST_ANNOUNCE_FLYING_ONLY`,
`MEDI_SPREAD_NOFOE_FAILS`, `MEDI_SYNC_IMMUNE_SILENT`, `MEDI_COACHING_NOALLY_SILENT`,
`MEDI_ITEMMOVE_NOTARGET_SILENT`), each red on its own class and on no board. Two-engine probe
`tests/probe_narration_a.js`: 38 of 78 staged games parted on `8a4140de3eaa`, 0 on `f557bf93ba48`. One
lattice game per bucket replayed on `f557bf93ba48` plays to battle end with no divergence. Census 925 → 930
live / 0 missing (`data/mechanics-census.json`). **Supersedes.** Nothing published — the narration clause
(0 / 11 / 24 on `a1c7dcd5696b`) is not re-measured here; the lattice re-run is owed. **Basis.** unchanged.
Owes: docs/ENGINE.md (done), the white paper's narration paragraph at the next major. |
```

## OWED, NOT RUN

1. **The three lattices on `f557bf93ba48`** (`--games` 1200 / 1350 / 1950, census pin, `--team-store data/team-pool-frozen`, `--steering empirical --arm middle --end-state`).
   - This is not a measurement. It is a prediction from §3's bucket table, if no game parts on its next divergence:
     - at 1350, narration falls by 5 games, from 11 to 6: Roost 1, spread 2, Synchronize 2;
     - at 1950, it falls by 7, from 24 to 17: Roost 3, spread 1, Synchronize 1, Coaching 2.
   - Only one game per bucket was replayed. A game can still part on its NEXT divergence, and that game then stays
     in the count.
   - Board-material should not move, because no knob moved a board. That is expected, not measured.
2. **The artifacts invalidated by the engine change, to re-run on the new release:**
   - the roster stages (items, abilities, moves);
   - `all_mechanics_fire`;
   - `test-engine-diff`.
3. **Items the coordinator must publish:**
   - the CHANGELOG entry and the version (`<<VER>>` in `docs/ENGINE.md`);
   - the `docs/RUNNING-NOTES.md` row above;
   - `node engine/status.js --write`;
   - the commit and push.
4. **Not checked.** Each of these was found while reading the code, and none is claimed.
   - Synchronize onto an already-statused source that Safeguard protects. The engine asks Safeguard before the held
     status (`applyStatus` order), and `setStatus` asks it after.
   - A Decorate aimed at a fainted ally falls back to the live partner.
   - `reaimToSlot` for a single-target item move whose foe fainted. Does the authority retarget where this returns
     empty?
   - Misty Terrain announcing a refused reflection. It was wired from the handler's `effect.status` test and was
     never staged: every legal Synchronize carrier is grounded, so the terrain refuses the holder first.
   - A second Roost in one turn, by Instruct, on a non-Flying body. The `_roostTurn` guard is written but was not
     staged.
   - The Leaf Guard arm ran, but its announcement is not asserted on its own. Non-vacuity is asserted for ability
     refusals as a group, and Limber satisfies it.
5. **Out of scope and carried forward.** Forewarn (deferred by Will), and the other §3 narration buckets:
   - line order;
   - Chilly Reception;
   - Sleep Powder under Misty Terrain;
   - Mortal Spin;
   - Magician;
   - Dragon Darts.
6. **Nothing was deleted.** Every process started here ended on its own, and none was killed.
   - Scratch files were written only to the session scratchpad: runners, section drafts, and the probe and replay
     logs.
