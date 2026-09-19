# Frisk and Axe Kick, the two leftovers the gate did not count — 2026-09-19, ENGINE (worktree, light mode)

This is a findings record, not a living document. It is not cited as current state. `node engine/status.js` and
the register rows it feeds hold the current state.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a5e83566ff203c81c` (HEAD `165b338c`, 6.69.0).

---

## 0. VERDICT

- **Frisk: FIRED.** It fired on the planner against Insomnia, on both engines, by line. The control watch measured
  Insomnia quiet (4 games, 60 handler calls, nothing loud). The subject's own authority receipt is
  `|-item|p2a: Feraligatr|Damp Rock|[from] ability: Frisk|[of] p1a: Banette`. Both boards and the control arm read
  NO-DIVERGENCE. Before this pass it read DID-NOT-FIRE, refined as CANNOT-FIRE-IN-THIS-FIXTURE `announces-only`.
- **Frisk's line was NOT identical, and now it is.** Our `-item` line had no `[of] <holder>`. The authority writes
  one (`data/abilities.ts:1539`). The differential's `source-tag` equivalence strips `[of]`
  (`engine/game_differential.js:2699-2704`), so the battery could not see the gap. Only the census could. After the
  fix, ours reads `|-item|p2a: Feraligatr|damprock|[from] ability: frisk|[of] p1a: Banette`. The one remaining
  difference is id against display name, which this engine uses on every line and the comparator normalises.
- **Axe Kick: the cause is the confusion clock's floor, not a die address.** `data/conditions.ts:173-174` (the
  Champions mod has no `confusion` row) reads:
  `const min = sourceEffect?.id === 'axekick' ? 3 : 2; this.effectState.time = this.random(min, 6);`.
  The differential pins the range form of `random` to its minimum. Our engine used a flat `CONFUSION_TURNS_MIN = 2`
  for every move. So the authority started Axe Kick's clock at 3 and ours at 2, and after one decrement the board
  read sd 2 / us 1. **Fixed.** The staged row goes from board **STATE** to **NO-DIVERGENCE**, and the knob brings
  back the exact old diff.
- **Census 969 → 970 live, 0 missing, `run_ok: true`.** `node engine/status.js` prints `970/970 probed mechanics
  live, 0 missing`.
- **Release `7285347f274f`**, cut in this worktree. The pointer `data/engine-release.json` is restored to HEAD's
  `6180c4712761`.

## 1. FRISK

### Why it could not fire

`frisk.onStart` loops `pokemon.foes()` and announces only `if (target.item)` (`data/abilities.ts:1536-1542`; the
mod does not override it). The planner staged Banette [Frisk] against Feraligatr and Aegislash, and neither held an
item. So the handler ran and said nothing.

### The trigger shape, derived and not named

In `engine/stage_planner.js` `derivedAbilityTriggers`: an unprefixed `onStart` whose source contains `.foes()` and
`if (<x>.item)` emits a `foes-hold-item` trigger.

**Membership, printed before wiring.** Every legal ability and item handler matching `.foes()` and `.item`
(`Dex.forFormat` filtered by `exists && !isNonstandard && tier !== 'Illegal'`):
`abilities frisk onStart` — **Frisk only.**

**Staging.** The receiver R gets the quietest removable item (`quietItem(rc, 'p2', { removable: true })`, which
picked Damp Rock). Its partner RA stays empty-handed, so one game shows both arms of the per-foe gate: one line,
not two. `foes-hold-item` joins the consumed-kinds list, so an unstaged trigger cannot slip past silently.

Plan (`node engine/stage_planner.js --only ability:frisk --show`):
```
triggers: foes-hold-item, entry
C  Banette @- [Frisk] : Facade        R  Feraligatr @Damp Rock [Torrent] : Dragon Claw
CA Absol @- [Justified] : Protect     RA Aegislash @- [Stance Change] : Protect
control: C.ability — the same body carries Insomnia instead
```

### The battery row

Command: `all_mechanics_fire.js --release <id> --kind abilities --only frisk --team-store <main>/data/team-pool-frozen`.

| release | verdict | fired | control watch | receipt | board / control arm |
|---|---|---|---|---|---|
| `6180c4712761`, old planner | DID-NOT-FIRE → CANNOT-FIRE-IN-THIS-FIXTURE (`announces-only`) | 0 | Insomnia quiet | none | NO-DIVERGENCE |
| `6180c4712761`, new planner | FIRED (moved_by line, both engines) | 1 | Insomnia quiet, 4 games / 60 calls | yes | NO-DIVERGENCE / NO-DIVERGENCE |
| `7285347f274f`, new planner | **FIRED**, `diverged: false` | 1 | Insomnia quiet, 4 games / 60 calls, loud 0 | `…Damp Rock\|[from] ability: Frisk\|[of] p1a: Banette` | **NO-DIVERGENCE / NO-DIVERGENCE** |

`red_ok: true`, 53 games, 0 threw. `FIRED on the planner 1, legacy FALLBACK 0`.

The row still carries `deferred: {by: Will, 2026-09-18}` and `counts_against_the_gate: false`. That deferral lives on
the ROSTER (`tests/roster.js:2171`) and is Will's to lift. I did not touch it.

### The line, and the census probe that now sees `[of]`

- `--dumplog` on `6180c4712761`: SD `|-item|p2a: Feraligatr|Damp Rock|[from] ability: Frisk|[of] p1a: Banette`,
  ME `|-item|p2a: Feraligatr|damprock|[from] ability: frisk`. The `[of]` was missing.
- Probe: `tests/test-mechanics.js` `announcesOnEntry` "Frisk names each foe's item…". It now also requires every line
  to carry `[of] p1[ab]: noivern` (the Frisk body). **Red first, on the unchanged engine**: `MISSING … every line
  names the Frisk body as [of]: false [|-item|p2a: garchomp|leftovers|[from] ability: frisk ; …]`, census 968 of 969.
- Fix: `engine/medicham2-browser.js`, the `announcesOnEntry` `-item`-on-foe branch passes the holder as `of`
  (`TR.item(_f, _f.item, '[from] ability: ' + m.ability, m)`). No knob was added: it restores one narration field and
  moves no board leaf, and the red above was shown on the pre-fix bytes.

## 2. AXE KICK

### The authority, read whole

- `data/moves.ts:931-950` `axekick`: `secondary: { chance: 30, volatileStatus: 'confusion' }`, `hasCrashDamage`,
  `onMoveFail` → `this.damage(source.baseMaxhp / 2, …)`. No Champions override (`data/mods/champions/*.ts` names
  `axekick` only in `learnsets.ts`). The crash is not involved in the parting: the staged move hit.
- `data/conditions.ts:162-197` `confusion`: `onStart` sets `min = sourceEffect?.id === 'axekick' ? 3 : 2` and
  `time = this.random(min, 6)`. `onBeforeMove` decrements it first and removes it at 0. No row in
  `data/mods/champions/conditions.ts`.
- Our engine: `CONFUSION_TURNS_MIN = 2` (`engine/medicham2-browser.js`), the declared floor of that draw, applied to
  every source. Its own header had quoted "3 to 5 after an Axe Kick" and still used 2.

**Cause: the duration range's per-move floor.** It is not a die address, and the counter starts at the same moment
on both engines. The differential's range form returns `m`, so the authority's clock is exactly `min`.

### The fix

- `engine/tag_dex.js`: `confusionMinTurns(moveId)` parses `confusion.onStart` for
  `const X = sourceEffect?.id === "<id>" ? A : B` and `this.random(X, N)`. It adds `minTurns`, `maxExclusive` and
  `minFrom: 'DERIVED:dex.conditions.get(confusion).onStart'` to `inflictsConfusion`. If the line stops parsing, the
  fields go absent and the script says so on stderr.
- `data/tags.json`: exactly 9 param leaves changed, the class below. **Grafted, not regenerated.** This worktree has
  no store, so a full `tag_dex.js` run zeroes every usage count (892 differing leaves, `sheet_entries 316656 → 0`).
  I ran it (through `tools/lownode.cmd`), diffed entity SHAPES only (tags + params over moves, items and abilities),
  found 9 differences, all `inflictsConfusion` on the 9 legal confusers, and wrote those 9 leaves plus `generated`
  into HEAD's file (scratch `tagdiff2.js --graft`, which refuses any non-param difference).
- `engine/medicham2-browser.js` `applyConfusion`: for a move-caused, non-fatigue confusion, the floor is
  `TAGS.param('move', mvId, 'inflictsConfusion').minTurns`. A move with no `minTurns` takes the generic floor and
  counts `MEDFAILS.confusionMinUnsized` (with the first id). `MEDSEEN.confusionMinFromMove` counts a floor above the
  generic one. The secondary site (`s.volatile === 'confusion'`) now passes `a.move.id`. It had passed none, which
  is why no per-move fact could reach it.
- Knob `MEDI_CONFUSION_MIN_FLAT=1` puts the flat 2 back. It is stamped at LOAD in
  `MEDFAILS.confusionMinFlatRestored` and added to `tests/test-mechanics.js` `DELIBERATE_BREAK`.

### The probe, red under the knob

`tests/test-mechanics.js`, `move` / `inflictsConfusion`: "an Axe Kick confusion starts one attempt longer than any
other move's". The attacker is a Medicham, the only legal Axe Kick learner, which also learns Dynamic Punch. It
targets a Clefable, which resists Fighting. The die is 0.05: it lands the to-hit and the 30% without a crit (at
0.01 a crit KO'd a Snorlax, and there was no clock to read). The target passes, so the clock is read before any
tick. **The control is the same user, road and target** with Dynamic Punch (a 100% confusion secondary).

| run | Dynamic Punch | Axe Kick | census |
|---|---|---|---|
| clean | 2 | **3** | LIVE; 970 / 970, `run_ok: true` |
| `MEDI_CONFUSION_MIN_FLAT=1` | 2 | **2** | MISSING; **REFUSED to write** `data/mechanics-census.json` (mtime unchanged, shown) |

Other confusers under the same staging: Confuse Ray 2 and Water Pulse 2 on both runs.

### The staged battery row

`--kind moves --only axekick`, 50 games, 0 threw:

| release | board |
|---|---|
| `6180c4712761` | **STATE**: `p2.active[0].vol.confusion` us 1 / sd 2, off-by-one |
| `7285347f274f` | **NO-DIVERGENCE** |
| `7285347f274f` + `MEDI_CONFUSION_MIN_FLAT=1` | **STATE**: `p2.active[0].vol.confusion` us 1 / sd 2, identical to the old reading |

### The roster moves row, `--reds`

`tests/roster.js --stage moves --only axekick --reds --release 7285347f274f` (via `tools/lownode.cmd`, no `--write`):
FIRED-AND-BOARDS-MATCH 1 of 1 in scope. Red `move/plain-attack` via axekick is CAUGHT (FIRED-AND-BOARDS-DIFFER on
party.hp, hp). The roster stages Axe Kick under the plain-attack rule. **I did not check whether its staging lands
the 30% confusion**, so this row is not evidence for the clock either way. The battery row and the census are.

## 3. THE CLASS: EVERY LEGAL MOVE THAT CONFUSES

Derived (scratch `confclass.js`, legal filter applied). `confusion.onStart` special-cases one id: `axekick` → 3,
else 2.

| move | how it confuses | floor (derived) | battery on `7285347f274f` |
|---|---|---|---|
| Axe Kick | secondary 30% | **3** | NO-DIVERGENCE |
| Dynamic Punch | secondary 100% | 2 | NO-DIVERGENCE |
| Hurricane | secondary 30% | 2 | NO-DIVERGENCE |
| Water Pulse | secondary 20% | 2 | NO-DIVERGENCE |
| Confuse Ray, Flatter, Swagger, Sweet Kiss, Teeter Dance | primary | 2 | NO-DIVERGENCE (each) |
| Alluring Voice | punish arm (`punishesBoostedTarget`) | 2 (no mvId passed; unchanged) | NO-DIVERGENCE |
| Outrage, Petal Dance, Thrash, Raging Fury | fatigue (`lockedmove`) | 2 (`viaFatigue`, unchanged) | NO-DIVERGENCE |

- 14 rows, 135 games, 0 threw, `red_ok: true`.
- The one legal ability that confuses is Poison Puppeteer. It takes the generic floor on both engines and it has no
  move id. No legal item's handler adds confusion.
- **Axe Kick is the only member whose floor differs.** The fix changes no other move's clock.

## 4. TESTS RUN

| test | result |
|---|---|
| `tests/test-mechanics.js` | 970 / 970 live, 0 missing, `run_ok: true` (a knob run refuses to write, shown) |
| `tests/test-stage-planner.js` | GREEN (every clause red-demonstrated) |
| `tests/test-tag-consumed.js` | 7 passed, 0 failed. It REWROTE `data/tag-consumption.json` with worktree numbers. I restored that file to HEAD (see OWED) |
| `engine/status.js` (no `--write`) | `970/970 probed mechanics live, 0 missing` |
| battery `red_ok` | true on every run above |

## 5. FILES CHANGED (worktree)

- `engine/stage_planner.js`: the `foes-hold-item` trigger, its staging, and the consumed-kinds entry.
- `engine/medicham2-browser.js`: Frisk `[of]`; the per-move confusion floor; knob `MEDI_CONFUSION_MIN_FLAT`; counters
  `confusionMinFromMove` (MEDSEEN) and `confusionMinUnsized`/`…First` (MEDFAILS); the secondary site passes the
  move id.
- `engine/tag_dex.js`: `confusionMinTurns` and `inflictsConfusion` `minTurns` / `maxExclusive` / `minFrom`.
- `data/tags.json`: 9 param leaves plus `generated` (grafted, see §2).
- `tests/test-mechanics.js`: the Frisk probe requires `[of]`; the new Axe Kick probe; `confusionMinFlatRestored`
  added to `DELIBERATE_BREAK`.
- `data/mechanics-census.json`: regenerated, 970 / 970.
- `docs/ENGINE.md`: one section and its hand list.
- This report.
- Not changed: `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`, `board.js`, `magnemite.js`,
  `engine-data.js`. `status.js --write` was not run. No git write other than restoring two environment-churned data
  files to HEAD (`git checkout -- data/tag-consumption.json data/provenance-stamp.json`).
- Scratch, all written this session: `…/scratchpad/frisk-axekick/` (logs, artifacts, `lown.js`, `membership.js`,
  `confclass.js`, `probe1.js`, `tagdiff*.js`, `rowshow.js`, and backups of HEAD's `tags.json` and the release
  pointer).
- Processes: every one exited on its own. None was killed.

## PROPOSED NOTES ROW

```
## [<version>] — 2026-09-19 — Frisk earns its FIRED against a quiet control and names its holder; Axe Kick's confusion starts at 3

**What changed.** `engine/stage_planner.js` derives a `foes-hold-item` trigger off the handler text: an `onStart` that
walks `.foes()` and gates each foe on `if (<foe>.item)` (data/abilities.ts:1538; membership printed over every legal
ability and item before wiring: Frisk only). The receiver holds the quietest removable item and its partner holds none.
Engine: Frisk's `-item` line now carries `[of] <holder>` (data/abilities.ts:1539); the differential's `source-tag`
equivalence strips `[of]`, so only the census could see it. Engine: the confusion clock's floor is per move —
data/conditions.ts:173 `const min = sourceEffect?.id === 'axekick' ? 3 : 2` (no Champions override). `engine/tag_dex.js`
derives `inflictsConfusion.minTurns` from that line (3 for Axe Kick, 2 for the other eight legal confusers; data/tags.json
changes in exactly those 9 params); `applyConfusion` reads it and the secondary site now passes the move id (knob
MEDI_CONFUSION_MIN_FLAT=1, stamped at load, in DELIBERATE_BREAK).
**Figures.** Worktree release 7285347f274f, light mode, named rows only, 0 games threw, red_ok true. Frisk: DID-NOT-FIRE
(CANNOT-FIRE-IN-THIS-FIXTURE, announces-only) on 6180c4712761 → FIRED on the planner against Insomnia (watch-quiet, 4 games
/ 60 calls), subject receipt read, board and control arm NO-DIVERGENCE. Axe Kick staged row: board STATE
(`p2.active[0].vol.confusion` us 1 / sd 2) on 6180c4712761 → NO-DIVERGENCE; the knob reproduces the STATE exactly. Class on
the battery (Axe Kick, Dynamic Punch, Hurricane, Water Pulse, Confuse Ray, Flatter, Swagger, Sweet Kiss, Teeter Dance,
Alluring Voice, Outrage, Petal Dance, Thrash, Raging Fury): 14 of 14 NO-DIVERGENCE. Roster moves `--only axekick --reds`:
MATCH, red CAUGHT. Census 969 → 970 live / 0 missing (new row: inflictsConfusion "an Axe Kick confusion starts one attempt
longer than any other move's"; the Frisk announcesOnEntry row now also requires `[of]` and was shown MISSING on the old
engine); a knob run is MISSING and refuses to write the census. tests/test-stage-planner.js GREEN.
**Supersedes.** 6.69.0's "Frisk: DID-NOT-FIRE" and "Axe Kick: board STATE on the subject arm" (staged-battery readings on
6180c4712761, not published figures; the full battery and the lattices have not been re-run).
**Basis.** unchanged
**Owes.** docs/ABRA-technical-docs.md (the foes-hold-item trigger shape and the per-move confusion floor) at the next major.
```

## OWED, NOT RUN

1. **The full battery, the three lattices and `engine/quarantine.js`** (light mode). The Axe Kick fix changes every Axe
   Kick confusion clock. The pool reach is 2 clicks in 64,846 stored games (from the 6180 report), so the lattices
   should not move. That is a prediction, not a measurement.
2. **Re-cut the release in the main tree after merge.** `7285347f274f` lives only under this worktree's ignored
   `data/releases/`.
3. **`data/tags.json` should be regenerated in the main tree**, which has the store. Then confirm with a shape diff
   that the only difference from the grafted file is usage counts. The graft is exactly what a regeneration writes
   for the 9 shapes, but the usage counts are HEAD's.
4. **`data/tag-consumption.json` owes a main-tree run of `tests/test-tag-consumed.js`.** The worktree run moved
   `inflictsConfusion` out of `dead`, because the engine now asks for the tag. The same run also churned figures
   that only reflect this worktree (`total_tags 292 → 302`), so I restored the file to HEAD rather than ship a mixed
   artifact. The worktree copy is in scratch (`tag-consumption.worktree.json`).
5. **Frisk's roster row is still DEFERRED-BY-OWNER** (`tests/roster.js:2171`). Will's call to lift it. Its stated
   reason ("a board comparison cannot see it") is still true of the roster. The battery now sees it by line.
6. **The roster's Axe Kick staging** (plain-attack rule) was not checked for whether it lands the 30% confusion, so it
   neither proves nor disproves the clock.
7. **The roster fixture check** printed `236 distinct set(s) checked, 1 illegal — 1 NOT baselined` on the
   `--only axekick` run. Not examined. The 6180 report already lists the moves stage's illegal-and-unbaselined
   sets as owed.
8. **`tests/test-docs-current.js` was not run.** The notes row is the coordinator's, and the pre-commit hook will
   ask for it.
9. **The version.** The `docs/ENGINE.md` section heading says "version assigned at merge". Replace that at merge
   rather than leave a placeholder.
