# Narration triage for both regulations: 2026-09-23 (MEASURE, read-only)

This was a read-only pass. No games, differential, roster, census, `quarantine.js` or `status.js` were run, and no
`data/` artifact was written. Every figure below comes from the six committed differential artifacts, read with
`git show HEAD:<file>` at HEAD `7fa84fe6`. The only other reads were the two Showdown checkouts and one
`Dex.forFormat` call per regulation, used to check legality and base Speed.

| regulation | release | artifacts (`--games`) | authority commit |
|---|---|---|---|
| Reg M-B | `89ac57f1f81b` | `data/game-differential.json` (1200), `.g1350.json`, `.g1950.json` | `pokemon-showdown` `20ad99f` |
| Reg M-C | `485d0a6840ad` | `data/game-differential-regmc.json` (1200), `.g1600-regmc.json`, `.g1900-regmc.json` | `pokemon-showdown-mc` `f10d679` |

Every lattice ran with the pins `--steering empirical --arm middle --end-state`, the pinned census and the frozen pool.
Every artifact's `mode` is `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`.

## 1. What the committed artifacts can and cannot tell us

- **No full `--dump-games` output is committed for either release.** The newest committed dumps are
  `data/verification/_8347_dump_*` on release `834713ccb303` (2026-09-20), which is three engine releases stale. See
  OWED.
- **`classes[].causes[]` is the full population, not a capped list.** In each of the six artifacts the causes'
  `n` values add up exactly to the class's `games`, and the classes add up exactly to `diverged` (64 / 82 / 92 and 0 /
  1 / 2). Each cause row also carries `sdAfter` / `meAfter` / `showdown_before` context. So I grouped from this block
  and did not predict anything from the capped `first_divergences` (60) or `first_board_divergences` (40).
- **It records only the first divergence in each game.** `game_differential.js` records the first protocol
  divergence per game and drops the rest, as `quarantine.js`'s own `lowerBoundLine` says. The counts below therefore
  count games by their earliest mismatch. They do not count defects. Once group A is fixed, the later divergences
  inside those same games will show up. **Expect the Reg M-C count to fall by less than group A's size on the first
  re-run.**
- **Every protocol-diverged game is narration.** `end_state[0].summary.by_cause_totals` reads `BOARD_MATERIAL 0`,
  `games_narration_only = diverged` and `by_cause_reconciles: true` in all six artifacts. Narration here means "no
  board effect among compared leaves, within the 50-turn cap" (`bounded_by`). It does not mean "cosmetic".

## 2. Totals

| | lattice A | lattice B | lattice C |
|---|---|---|---|
| **Reg M-B** raw narration (games) | 0 / 961 | 1 / 1069 | 2 / 1497 |
| Reg M-B declared (Supreme Overlord `fallenundefined`) | 0 | 1 | 2 |
| **Reg M-B undeclared (the clause)** | **0** | **0** | **0** |
| **Reg M-C** raw narration (games) | 64 / 954 usable (955, 1 void) | 82 / 1266 | 92 / 1497 |
| Reg M-C that the existing declared row would subtract | 2 | 3 | 5 |
| **Reg M-C undeclared, once a baseline exists** | **62** | **79** | **87** |

The gates report quoted 64 / 82 / 92 as "undeclared". Those are the raw counts. The narration clause returns at its
no-baseline branch (`engine/quarantine.js:3686-3692`) before it subtracts anything, so the declared split has never
been computed for Reg M-C. The 62 / 79 / 87 above is my subtraction, made by applying the one declared row's matcher
(`/fallenundefined/`, `quarantine.js:2694`) to the full cause list. There is no Reg M-C `decision-impact` artifact, so
nothing further clears.

## 3. The groups, by mechanism

The counts are games whose first divergence is this mechanism. Reg M-C lattices are 1200 / 1600 / 1900; Reg M-B
lattices are 1200 / 1350 / 1950. Protocol quotes are Showdown first (SD) and MEDICHAM second (ME).

| # | mechanism | Reg M-C | Reg M-B | share of Reg M-C lattice C |
|---|---|---|---|---|
| A | Refused-stat-drop label: `Attack` against `atk` | 38 / 44 / 53 | 0 / 0 / 0 | 58% |
| C | `-fail` without the move name (Double Shock, Burn Up) | 7 / 8 / 12 | 0 | 13% |
| F | Steel Roller's terrain end emitted late | 3 / 8 / 9 | 0 | 10% |
| D | `\|faint\|` line never emitted | 5 / 5 / 5 | 0 | 5% |
| B | Supreme Overlord `fallenundefined` (**DECLARED**, AUTHORITY-WRONG) | 2 / 3 / 5 | 0 / 1 / 2 | 5% |
| G | Residual order at a speed tie: Grassy Terrain heal against Leftovers | 2 / 6 / 3 | 0 | 3% |
| H | On-damage ability against the recoil faint (Emergency Exit, Berserk) | 1 / 3 / 2 | 0 | 2% |
| E | Bare `-fail` missing after a failed self-targeting status move | 3 / 0 / 1 | 0 | 1% |
| I | White Herb timing | 0 / 3 / 0 | 0 | 0 |
| J | Ghost-type Curse: line order and the `[of]` field | 0 / 1 / 1 | 0 | 1% |
| K | Lightning Rod's `-activate` missing | 1 / 1 / 0 | 0 | 0 |
| L | Revival Blessing heal against Leppa Berry order | 1 / 0 / 0 | 0 | 0 |
| M | A Magic-Bounced move's `-fail` names the wrong body | 1 / 0 / 0 | 0 | 0 |
| N | Status order: burn against sleep | 0 / 0 / 1 | 0 | 1% |
| | **total** | **64 / 82 / 92** | **0 / 1 / 2** | |

Nothing was left ungrouped. The classifier is in the scratchpad and is not committed. It is a regex over each cause
string, and I checked every non-A row against its `sdAfter` / `meAfter` by eye.

### A. Refused-stat-drop label, `Attack` against `atk`: 38 / 44 / 53 (Reg M-C only)

- Carriers: Inner Focus, Scrappy, Oblivious, Hyper Cutter and Own Tempo. All are legal in Reg M-C (derived).
- Example: `gen9championsvgc2026regmcbo3-2678436190 vs …2678542121`, turn 0, `baseline`
  - SD `|-fail|p1a: Slowbro|unboost|atk|[from] ability: Oblivious|[of] p1a: Slowbro`
  - ME `|-fail|p1a: Slowbro|unboost|Attack|[from] ability: oblivious|[of] p1a: Slowbro`
- **This mechanism is READ from the source, not hypothesised.** The authority changed its wording between the two
  checkouts:
  - Reg M-B (`pokemon-showdown/data/abilities.ts:2150, 3023, 3152, 4081, 1936`) writes `'Attack'`. Big Pecks writes
    `'Defense'` (`:441`).
  - Reg M-C (`pokemon-showdown-mc/data/abilities.ts:2160, 3033, 3162, 4091, 1946`) writes `'atk'`. Big Pecks writes
    `'def'` (`:451`).

  MEDICHAM types one table for both regulations: `const STAT_LABEL={at:'Attack',df:'Defense',…}` at
  `engine/medicham2-browser.js:23332`, used at `:23413` and `:23500`. It is correct for Reg M-B, which is why Reg M-B
  reads 0, and wrong for Reg M-C.
- Fix direction (ENGINE): derive the label from the regulation's authority rather than from a typed table. The one
  change should clear the whole group. The Illuminate / Keen Eye `accuracy` label is spelled the same in both
  checkouts.
- This group is also the protocol face of the Reg M-C Intimidate-reaction family that the gates report lists as a
  mechanics-clause red. It does not explain the Guard Dog and Rattled STATE divergence in `all-mechanics-fire-regmc`,
  which is a separate claim.

### C. `-fail` without the move name: 7 / 8 / 12 (Reg M-C only)

- Example: `gen9championsvgc2026regmcbo3-2679123559 vs …2679107981`, turn 2, `baseline`
  - SD `|-fail|p2b: Pawmot|move: Double Shock`
  - ME `|-fail|p2b: Pawmot`
- Lattice C holds 11 Double Shock rows and 1 Burn Up row (`…2679928621 vs …2679913942`, turn 3).
- The source reads `this.add('-fail', pokemon, 'move: Double Shock')` at `pokemon-showdown-mc/data/moves.ts:3956` and
  `'move: Burn Up'` at `:2104`. The Reg M-B checkout reads the same.
- Hypothesis: MEDICHAM's "user lacks the type" refusal calls `fail(m)` without passing `what`. Reg M-B reads 0 because
  Double Shock is `isNonstandard: 'Past'` in Reg M-B (derived). The Burn Up row shows the same path is live in Reg M-B
  code; Burn Up is legal there.

### F. Steel Roller's terrain end emitted late: 3 / 8 / 9 (Reg M-C only)

- Example: `gen9championsvgc2026regmc-2678386444 vs …2678608021`, turn 3, `baseline`
  - SD `|-fieldend|move: Grassy Terrain` `|faint|p2a: Baxcalibur`
  - ME `|faint|p2a: Baxcalibur` `|-fieldend|move: grassyterrain`
- Variants: Psychic Terrain ends in the same way. A no-faint variant (`…2678656173`, turn 3) puts SD `-fieldend` before
  the Rocky Helmet and Stamina lines, while ME puts it after both. Every F row read shows `Steel Roller` as the move.
- Source: `steelroller.onHit() { this.field.clearTerrain(); }` (`pokemon-showdown-mc/data/moves.ts:17905`). The
  terrain ends inside the hit, before the faint message and before on-damage items and abilities.
- Hypothesis: MEDICHAM clears the terrain at the end of the move instead of in `onHit`. The Reg M-B block is
  byte-identical (diffed), so Reg M-B's 0 is probably a pool-frequency effect. The Reg M-B engine is the same code
  path, and it should be checked there too.

### D. `|faint|` line never emitted: 5 / 5 / 5 (Reg M-C only)

- Example: `gen9championsvgc2026regmcbo3-2678516446 vs …2678608972`, turn 8, `omit-protect`. This game is in all
  three lattices.
  - before `|-damage|p1a: Farigiraf|0 fnt`
  - SD `|faint|p1a: Farigiraf` `|upkeep` `|turn|9`
  - ME `|upkeep`
- The board agrees because the replacement arrives in both engines. Only the announcement is missing, and it is still
  missing at the end of the captured window. The 1200 and 1600 lattices each contain one end-of-log variant,
  `medicham2 stopped emitting … :: |faint|p2a` (`…2680818179`).
- Observations, not a cause: all 9 distinct fainting bodies sat in slot **a**. Most were the last action before
  residuals, but the Stealth Rock faint on switch-in (`…2678895738`, turn 9) is not. Faints in slot a that were
  emitted also appear in the same windows, so slot a is not sufficient.
- Hypothesis: a faint-emission path that is live only under Reg M-C, where the three Reg M-B lattices (3,527 games)
  show zero. **Suspect the instrument first**: the comparator's handling of a faint at a turn boundary could produce
  this shape. `--only-game` on this seed decides it (OWED).

### B. Supreme Overlord `fallenundefined`: DECLARED. Reg M-C 2 / 3 / 5, Reg M-B 0 / 1 / 2

- Example (Reg M-B): `gen9championsvgc2026regmbbo3-2661010853 vs …2661103454`, turn 4, `pair-speedctrl`
  - SD `|-end|p1b: Kingambit|fallenundefined|[silent]`
  - ME (no line)
- Declared `AUTHORITY-WRONG` at `engine/quarantine.js:2691-2699`. The source is
  `pokemon-showdown/data/abilities.ts:4732`: `onEnd` is not guarded the way `onStart` is. This is Reg M-B's entire
  narration count, and it is why Reg M-B reads 0 undeclared. The row is regulation-agnostic and will subtract under
  Reg M-C too. **To reach a literal zero, MEDICHAM would have to reproduce the typo. That is a decision, not a fix.**

### G. Residual order at a speed tie: 2 / 6 / 3 (Reg M-C only)

- Example: `gen9championsvgc2026regmcbo3-2684169278 vs …2684216556`, turn 6, `omit-intimidate`
  - SD `|-heal|p2b: Milotic|…[from] Grassy Terrain` `|-heal|p1b: Milotic|…[from] item: Leftovers`
  - ME the Leftovers line first
- Every example is a pair with the same base Speed, derived from the Reg M-C dex: Milotic mirror, Rillaboom mirror, and
  Rillaboom / Archaludon / Indeedee-F all at 85.
- Hypothesis: the residual tie among bodies of equal Speed is resolved differently. That makes this a real
  turn-order defect, not noise, given the standing "the tie die is shared" finding. It needs a probe that reads both
  actual Speed stats.

### H. On-damage ability against the recoil faint: 1 / 3 / 2

- Example: `gen9championsvgc2026regmcbo3-2682655109 vs …2682620646`, turn 5, `omit-spread`
  - SD `|-activate|p1a: Golisopod|ability: Emergency Exit` `|faint|p2b: Rillaboom`
  - ME `|faint|…` then `-activate`
- Berserk has the same shape (`gen9championsvgc2026regmc-2678470552`, turn 3). One end-of-log variant exists in
  lattice C.
- Hypothesis: MEDICHAM writes the recoil victim's `|faint|` immediately. Showdown defers faint messages to the end of
  the action, so on-damage abilities print first.

### E. Bare `-fail` missing after a failed self-targeting status move: 3 / 0 / 1

- Moves involved: Destiny Bond, Imprison (twice) and Focus Energy.
- Example: `gen9championsvgc2026regmcbo3-2682171123 vs …2682271572`, turn 3
  - before `|move|p1a: Banette|Destiny Bond||[still]`
  - SD `|-fail|p1a: Banette`
  - ME (next move)
- Hypothesis: MEDICHAM writes the `[still]` move line on a failed `onTry` but drops the bare `-fail` that Showdown
  adds.

### I to N: singletons and pairs

- **I. White Herb.** Two rows: SD consumes the herb before the Parting Shot switch, and ME after
  (`…2682994376`, turn 2). One further row is a mirror-Incineroar tie on turn 0 (`…2681884715`), which is probably
  group G's tie mechanism.
- **J. Ghost-type Curse.** `…2679027089`, turn 2. SD `|-damage|p2a: Golurk|2/164` then
  `|-start|p1a: Charizard|Curse|[of] p2a: Golurk`. ME writes `-start` first, and its `[of]` field is
  `golurk-mega`, a species id rather than an identifier. Two defects in one line.
- **K. Lightning Rod.** `…2679514203`, turn 8. SD writes `|-activate|p1b: Raichu|ability: Lightning Rod` before
  `-prepare` Electro Shot. ME has no line.
- **L. Revival Blessing.** `…2680802524`, turn 2. SD eats the Leppa Berry (PP restore) before the heal. ME heals
  first.
- **M. Magic Bounce.** `…2684711995`, turn 6. A bounced Encore fails. SD writes `-fail|p1a: Hatterene` (the
  bouncer); ME writes `-fail|p2a: Whimsicott`.
- **N. Burn against sleep.** `…2683663169`, turn 2. The two lines come in the opposite order. The source of the burn
  is not in the window. Unexplained.

## 4. The narration clause and its baseline

**How the verdict is computed** (`engine/quarantine.js`, `narrationVerdict`, lines 3605-3960):

1. The clause refuses on a missing receipt, zero games, a planted-divergence proof that did not fire, or a missing
   `end_state[0].summary.by_cause_totals`.
2. **If `data/whole-game-baseline.json` is absent, it returns `ok:false` at lines 3686-3692, before anything is
   subtracted.** Under `ABRA_REGULATION=regmc` that path is redirected to `data/whole-game-baseline-regmc.json`
   (`engine/regulation.js:520`, `artifactFor`). That file has never been written, which is the CANNOT-ANSWER in the
   gates report.
3. With a baseline present, the clause walks the NARRATION-ONLY causes and subtracts those matched by
   `DECLARED_DIVERGENCE` (one row today, Supreme Overlord) and those cleared by a `decision-impact` row (none under
   Reg M-C).
4. **The verdict is `ok = undeclared === 0`** (line ~3870). The baseline does not enter it. The baseline is used
   only for the trend (`rose`, `comparable`), and only when `base.mode === j.mode`.

**How Reg M-B's baseline was set.** The command was `node engine/quarantine.js --stamp-whole-game` (lines 5637-5667).
It reads the primary `data/game-differential.json` and refuses if the planted proof did not fire. It stores
`rate = diverged / games` using **raw** `diverged` (declared rows included), plus `mode` and `engine_release`. It
refuses a worse rate than the one already standing unless `--force` is passed with a register row. The committed file
holds **18 / 961 = 1.87%**, release `6272fa445b73`, mode `…pins:2efbc9ed1946…`, stamped 2026-08-27. **The current
Reg M-B mode is `…pins:de38d17e15a2…`, so the trend is WITHHELD** as not comparable. Today that baseline is only a
presence token for Reg M-B. Its number constrains nothing.

**What the Reg M-C clause needs in order to answer.** It needs `data/whole-game-baseline-regmc.json`, stamped
deliberately under `ABRA_REGULATION=regmc`. That stamp would record **64 / 955 = 6.70%** from
`data/game-differential-regmc.json`. **Stamping it does not turn the clause green.** It moves the clause from
CANNOT-ANSWER to FAIL, reading 62 / 79 / 87 undeclared. That is the honest reading, and it is why the stamp is only
bookkeeping. Two points for the decision:

- The first stamp has no ratchet to fight, because there is no `prev`, so any number is accepted. Stamp it on the
  current 1200 lattice, not after a partial fix, so that the trend has a true starting point.
- The stamp stores raw `diverged`, not undeclared. That matches Reg M-B, so the two baselines mean the same thing.

## 5. Burn-down order (proposed)

1. **A.** One table becomes derived, which clears about 58% of the Reg M-C first divergences. It is the only group
   whose cause is already read from the source. Predict before running: Reg M-C falls by less than 38 / 44 / 53,
   because hidden second divergences surface. Reg M-B stays at 0.
2. **C and E.** Two small `-fail` emission gaps.
3. **F and H.** Timing inside a move: the terrain clear in `onHit`, and faint messages deferred to the end of the
   action. Both touch the order in which faint messages come out. Batch them only if the attribution stays clean.
4. **D.** Run `--only-game` first, to rule out the instrument.
5. **G and I (tie).** A turn-order probe on real Speed stats.
6. **J, K, L, M, N.** The singletons.
7. **B** is Will's call: reproduce the typo, or keep the declaration.

Which scoreboard should move: all of these are pinned-pool (whole-game) findings, so **the pool is the scoreboard.**
The roster already reads 0 DIFFER on groups A to N because it compares boards.

## OWED, NOT RUN

Nothing here was run in this pass. Each command writes to a scratch path, not to a published artifact. Run them
through `tools\lownode.cmd`, one at a time, and only when no other agent is editing the engine.

**Full per-game dumps on the exact published samples.** These are debugging views and do not touch
`data/game-differential*.json`, because of `--out`.

```
# Reg M-C, each lattice (1200 / 1600 / 1900)
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc \
  tools\lownode.cmd engine/game_differential.js --steering empirical --release 485d0a6840ad --arm middle --end-state \
  --census data/verification/census-pin-regmc-0d03e83f0e65.json --team-store data/team-pool-frozen-regmc \
  --games 1200 --dump-games 100 --dump-out data/verification/narr-regmc/dump-g1200.json \
  --out data/verification/narr-regmc/gd-g1200.json
#   repeat with --games 1600 / 1900 and matching file names

# Reg M-B, each lattice (1200 / 1350 / 1950)
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools\lownode.cmd engine/game_differential.js --steering empirical --release 89ac57f1f81b --arm middle --end-state \
  --census data/verification/census-pin-833a997d7e42.json --team-store data/team-pool-frozen \
  --games 1200 --dump-games 10 --dump-out data/verification/narr-mb/dump-g1200.json \
  --out data/verification/narr-mb/gd-g1200.json
```

Receipt: each `--out` artifact must reproduce the published `diverged` (64 / 82 / 92 and 0 / 1 / 2), and the same
`classes` table, before the dump is trusted.

**Single-game probes** (`--only-game` never writes the published artifact):

```
# D: faint never emitted -- instrument or engine?
ABRA_REGULATION=regmc SHOWDOWN_PATH=.../pokemon-showdown-mc tools\lownode.cmd engine/game_differential.js \
  --steering empirical --release 485d0a6840ad --arm middle --end-state \
  --census data/verification/census-pin-regmc-0d03e83f0e65.json --team-store data/team-pool-frozen-regmc \
  --games 1200 --only-game "omit-protect gen9championsvgc2026regmcbo3-2678516446" \
  --only-game-out data/verification/narr-regmc/only-D.json
# same shape for G ("omit-intimidate …2684169278"), F ("baseline gen9championsvgc2026regmc-2678386444"),
# E ("baseline …2682171123"), J (--games 1600 "pair-redirect-priority …2679027089")
```

**The baseline decision** (Will's call, not a default; the result is FAIL at 62 / 79 / 87, not a pass):

```
ABRA_REGULATION=regmc node engine/quarantine.js --stamp-whole-game
ABRA_REGULATION=regmc node engine/quarantine.js --narration     # confirms 62/79/87 undeclared and the per-lattice read
```

**ENGINE follow-ups** (routed, not MEASURE's to fix): A, the derived `STAT_LABEL` in `medicham2-browser.js:23332`;
C and E, the `-fail` emitters; F, Steel Roller's terrain clear moved into `onHit`; H, faint-message deferral; J, the
Curse `[of]` identifier. After each batch, re-run the three Reg M-C lattices plus the three Reg M-B lattices, and
record `--games` in the report.
