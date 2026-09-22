# Reg M-C engine pass 2: the pinned board-material games, largest cause first

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.33.0 onward (0.40.0 onward is MEASURE's). **Status.**
Findings record, historical by construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a99fae50f915b34e9`, base `6cb275fb` (abra/regmc 0.32.0), main merged before each commit |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher (`data/_scratch-eng-a99f/run.js`, git-ignored) |

**The pinned Reg M-C differential**, every reading below (the command of `docs/_reports/2026-09-22-regmc-engine.md`):

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-98c69a4fee7f.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch> --dump-games 2000 --dump-out data/_scratch-eng-a99f-dump-<tag>.json
```

State bar = `state.games - state.games_board_never_diverged`. Materiality is decided by that instrument: a game is
board-material when a compared board leaf parts (`state.first_board_divergences`, all listed below the cap of 40); a
protocol line with no board leaf behind it is narration.

**The Reg M-B regression check**, every commit: `git diff --quiet HEAD` on `data/tags.json`, `data/protocol-events.json`,
`data/move-effects.js` (sha256 `c34d6465c3b6`, `4e2f810b338a`, `f35ecd91ba86`); `tests/test-engine-diff.js --n 6000 --seed
20260804` against the base engine bytes (`6cb275fb`, which is release `fa68d953e73f`'s simulator), with the control seed
`20260805` on the base bytes shown to differ (154 diff lines); the lattice `--steering empirical --arm middle --end-state
--census <HEAD's data/mechanics-census.json, a copy> --team-store <main>/data/team-pool-frozen --games 1200` on a Reg M-B
release cut from the commit's tree.

**Baseline**, release `fa68d953e73f` (0.32.0, this checkout's CRLF bytes; the earlier report's `7a7240f738d1` is the
same code): **18 of 954 board-material**, 1 void.

---

## 1. The species key and the U+2019 apostrophe (abra/regmc 0.33.0)

### The defect

`build/build_engine_data_regmc.js` keyed every row by the display name with each non-alphanumeric run collapsed to a
hyphen. The engine reads a key's segment before its first hyphen as the BASE species (`engine/medicham2-browser.js`,
`statMult.onlySpecies`: `String(body.name).split('-')[0]`, mirroring the authority's `baseSpecies.baseSpecies`). A scan
of every legal Reg M-C species (the builder now prints it on every run) found five base names with punctuation, all
keyed as if they had a forme:

| species (M-C dex name) | old key | new key |
|---|---|---|
| `Farfetch’d` (U+2019) | `farfetch-d` | `farfetchd` |
| `Sirfetch’d` (U+2019) | `sirfetch-d` | `sirfetchd` |
| `Mr. Mime` | `mr-mime` | `mrmime` |
| `Mr. Rime` | `mr-rime` | `mrrime` |
| `Kommo-o` | `kommo-o` | `kommoo` |

Reg M-B's table keys `mrrime` and `kommoo` unbroken. The artifact-audit question — does THIS artifact hold two keys that
normalise alike — answers 0 before and after (the builder's `TWO KEYS, ONE BODY` check). The regenerated table differs
from the old one by exactly those five renames: 0 content changes in `mons`, `moves`, `C` or `priors`.

Separately, the pinned games parted on their first `|switch|`: the authority writes `Sirfetch’d` with U+2019 (M-C
checkout `data/pokedex.ts` :16710, `name: "Sirfetch\u2019d"`; :2023 for `Farfetch\u2019d`), and `traceCanon` folded
only the ASCII `'`. So the protocol stream parted at line 3 of every game that brought one, and the game's first cause
was hidden behind a spelling. That is narration, and it is why these five read as a single family.

### Probe — `tests/probe_regmc_species_key.js --regulation regmc`

| clause | 0.32.0 (release `fa68d953e73f`, its engine bytes) | 0.33.0 (release `941e36906e6c`) | knob `MEDI_CANON_KEEPS_TYPO_APOSTROPHE=1` |
|---|---|---|---|
| every table key's base segment is its species' base id | RED (the five) | green | green (the knob is the engine half) |
| Farfetch'd + Mr. Mime lead: reduced `|switch|` lines agree, no protocol divergence | RED | green | RED |
| Kommo-o + Sirfetch'd lead: the same | RED | green | RED |
| Mr. Rime lead | green (the old key's hyphen folded) | green | green |
| boards identical at every boundary | green | green | green |
| exit | **1** | **0** | **1** |

11 staged sets, 0 illegal under the Reg M-C `TeamValidator`. The builder's own knob `ABRA_REGMC_KEY_WHOLE_NAME=1`
restores the old key rule.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.32.0 | `fa68d953e73f` | 18 / 954 | 1 |
| 0.33.0 | `941e36906e6c` | **18 / 954** | 1 |

The count did not move, and that was expected once the name was out of the way: the five games' board divergences were
real, only their causes were hidden. Unmasked, **four are a critical hit the authority rolls and this engine does not**
(a Farfetch'd Sky Attack, a Sirfetch'd First Impression, Close Combat and Meteor Assault; every one holds a Leek), and
one (`regmc-2680622216`) is a Scrappy `-fail` stat label, `atk` against `Attack`, which writes no board leaf: narration,
with the game's board part later (a Sitrus Berry on Pelipper, turn 1). That is §2.

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Damage differential seed `20260804`: identical to the base but for the
`wrote …` output-path line. Lattice: see the commit table in the last section.

---

## 2. The Leek (abra/regmc 0.34.0)

### The authority, read whole

M-C checkout `data/items.ts` leek :3322-3337; the Champions mod (`data/mods/champions/items.ts` :522-525) only sets
`isNonstandard: null`:

```
onModifyCritRatio(critRatio, user) {
  if (["farfetchd", "sirfetchd"].includes(this.toID(user.baseSpecies.baseSpecies))) return critRatio + 2;
}
```

The ratio indexes `critMult = [0, 24, 8, 2, 1]` (`sim/battle-actions.ts` :1623-1641), so a high-crit move (its own
`critRatio` 2) held with the Leek by a Sirfetch'd reaches 4: a certain crit. Scope Lens (:5554-5563) is `critRatio + 1`
for anyone.

### The defect

`engine/tag_dex.js`'s item `critRatioUp` row was `it.onModifyCritRatio ? { critRatio: 2 } : null`: one stage for every
member. Right for Scope Lens, the only legal member in Reg M-B; wrong twice for the Leek (one stage short for the two
species it names, one stage long for everyone else). In the four unmasked games a Sirfetch'd or Farfetch'd rolled 1/2
at 1/2 where the authority was certain (Sky Attack: ratio 2 + 2 = 4), or at 1/8 where the authority rolled 1/2 (Close
Combat, Meteor Assault, First Impression: ratio 1 + 2 = 3).

### Tag, membership printed before wiring

The row now reads the increment (`return critRatio + N`) and the lock (a base-species id list, or a single
`=== 'x'`, or `baseSpecies.name === 'X'`); a condition it cannot name is `lockUnparsed: true` and the engine refuses
it (counted, `MEDFAILS.critItemLockUnparsed`). Whole item dex, both checkouts:

```
pokemon-showdown-mc regmc  leek[legal] {critRatio:3, onlySpecies:[farfetchd, sirfetchd]}  scopelens[legal] {critRatio:2}
                           razorclaw[Past] {critRatio:2}  luckypunch[Past] {critRatio:3, onlySpecies:[chansey]}  stick[Past] {critRatio:3, onlySpecies:[farfetchd]}
pokemon-showdown    regmb  scopelens[legal] {critRatio:2}   (every other member Past; the same rows)
```

Scope Lens's row is byte-identical to the one `data/tags.json` carries, so Reg M-B's tag file does not move and was not
regenerated. `data/tags-regmc.json` was regenerated to scratch (`node engine/tag_dex.js --regulation regmc`); a
structural diff on (tags, params) per entity showed one rule change, the Leek row, and usage churn in the descriptor
block only; the Leek row alone was spliced onto the committed file (CRLF kept).

### Engine

`critChance`: the item stage is added only when the lock names the attacker's base id (`monFlat(key.split('-')[0])`,
which is right for these two species only since 0.33.0), refused when `lockUnparsed`, and counted
(`MEDSEEN.critItemLockedOut`) when the lock excludes the holder. Knob `MEDI_CRIT_ITEM_ONE_STAGE` restores one stage for
every carrier.

### Probe — `tests/probe_regmc_leek.js --regulation regmc`

Played on the `middle` arm (real dice, seeded and shared by category): under the kit's default bottom arm every crit
lands, which the first run showed (all three arms, 4 of 4 crits) and which cannot see a rate. `tests/regmc_probe_kit.js`
`play` gained an optional arm id.

| arm | staged (five turns) | authority | 0.33.0 engine (release `941e36906e6c`) | after |
|---|---|---|---|---|
| LEEK | Farfetch'd @ Leek, Night Slash into Sylveon | 5 crits of 5 hits | parts (lines and boards) | match, boards 0 |
| LOCKED | Ariados @ Leek, the same | 1 crit of 5 | parts (lines and boards) | match, boards 0 |
| CONTROL | Farfetch'd, no item | 1 crit of 5 | match | match |

| run | exit | red |
|---|---|---|
| 0.33.0 release and bytes | 1 | LEEK and LOCKED (lines and boards) |
| clean, release `afb18817eabc` | 0 | none |
| `MEDI_CRIT_ITEM_ONE_STAGE=1` | 1 | LEEK and LOCKED (lines and boards) |

8 staged sets, 0 illegal under the Reg M-C `TeamValidator`.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.33.0 | `941e36906e6c` | 18 / 954 | 1 |
| 0.34.0 | `afb18817eabc` | **13 / 954** | 1 |

Five games left the board-material list (seed sets compared, 0.33.0 against 0.34.0): three of the four Leek-crit
games (`…2679721304`, `…2683276871`, `…2681633603`), the Scrappy-narration game (`regmc-2680622216`, Pelipper) and
the Psychic Terrain `-activate` game (`…2681453314`, Slowbro). The last two were not replayed, so which roll their
board leaf rode on is not established; both field a Sirfetch'd or Farfetch'd (the dump's final roster; the dump does not record items). The fourth crit game
(`regmc-2680535928`) is still board-material, on a later cause (§3). The Psychic Terrain `-activate` line itself is
narration and still parts that game's protocol stream.

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Damage differential seed `20260804`: identical to the base but for the
output-path line. Lattice on release `1c19d8d9bcd7`: **0 of 961**, 0 void.

---

## 3. Steely Spirit (abra/regmc 0.35.0)

### The authority, read whole

M-C checkout `data/abilities.ts` steelyspirit :4589-4601 (the Champions mod does not name it):

```
onAllyBasePowerPriority: 22,
onAllyBasePower(basePower, attacker, defender, move) { if (move.type === 'Steel') return this.chainModify(1.5); }
```

`onAlly<Event>` handlers are collected over the event target's `alliesAndSelf()` (`sim/battle.ts` :1056-1057), and the
BasePower event's target is the attacker (`sim/battle-actions.ts` :1650), so the holder boosts its own Steel move and its
partner's. Battery (:342-354) and Power Spot (:3412-3424) exclude the holder (`attacker !== this.effectState.target`).

### The defect, twice

The two remaining Perrserker games (`…2680024905`, `regmc-2681007636`) parted on an Iron Head's damage: 120 against 129 on
a Golisopod and 102 against 131 on a Basculegion, the authority's hit the larger. The Reg M-C table's Perrserker carries
Steely Spirit (`data/engine-data-regmc.js`, observed set). `allyBasePowerBoost` was:

1. **mis-derived** — `engine/tag_dex.js` read the multiplier with `(\d+)`, which stops at the decimal point, so the row
   said `mult: 1`, and `includesSelf` was `null` unless a handler wrote `source ===`;
2. **consumed by nothing** — no line of `engine/medicham2-browser.js` read the tag. Its three members had no legal carrier
   in Reg M-B, and the tag sat in the deriver's expected-empty list, so nothing ever asked.

### Tag, membership printed before wiring

```
pokemon-showdown-mc regmc  battery {mult:[5325,4096], includesSelf:false, onlyCategory:Special}
                           powerspot {mult:[5325,4096], includesSelf:false}   steelyspirit {onlyType:Steel, mult:1.5, includesSelf:true}
pokemon-showdown    regmb  the same three rows
```

Only Steely Spirit has a legal carrier in Reg M-C, so it is the only row in `data/tags-regmc.json`; it was spliced after a
structural diff of the regenerated file showed that row as the only rule change. Reg M-B has no row and its file does
not move.

### Engine

The base-power chain (`dmgRangeOneHit`, beside Helping Hand) adds each booster once: the attacker's own ability (every
caller), and its active partner's through `hit.attPartner`, which the battle loop's hit context now sets from the
attacker's side (a pure price, with no hit context, sees only the attacker's own). A row whose multiplier is 1 or absent
is refused and counted (`MEDFAILS.allyBasePowerUnusable`). Knob `MEDI_ALLY_BP_BOOST_INERT`.

### Probe — `tests/probe_regmc_steely_spirit.js --regulation regmc`

| arm | staged | authority (target HP left) | 0.34.0 engine (release `afb18817eabc`) | after |
|---|---|---|---|---|
| SELF | Perrserker (Steely Spirit) Iron Head into Corviknight | 107/173 | parts (lines and boards) | match |
| ALLY | Snorlax Iron Head, partner Perrserker (Steely Spirit) | 129/173 | parts (lines and boards) | match |
| CONTROL | Perrserker (Battle Armor), SELF's hit | 129/173 | match | match |
| ALLYCTL | Snorlax, partner Perrserker (Battle Armor) | 144/173 | match | match |

| run | exit | red |
|---|---|---|
| 0.34.0 release and bytes | 1 | SELF and ALLY (lines and boards) |
| clean, release `f09b7fd33be5` | 0 | none |
| `MEDI_ALLY_BP_BOOST_INERT=1` | 1 | SELF and ALLY (lines and boards) |

A secondary is allowed on the staged move (Perrserker's Steel moves all carry one); it fires identically on both engines
under the kit's arm. All staged sets legal under the Reg M-C `TeamValidator`.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.34.0 | `afb18817eabc` | 13 / 954 | 1 |
| 0.35.0 | `f09b7fd33be5` | **11 / 954** | 1 |

The two Perrserker games left (seed sets compared); nothing joined.

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Damage differential seed `20260804`: identical to the base but for the
output-path line. Lattice on release `37e6245b775c`: **0 of 961**, 0 void.

---

## 4. White Herb on the move that ends the battle (abra/regmc 0.36.0)

### The authority, read whole — and the two checkouts differ

whiteherb, read from each checkout's dist dex (`data/_scratch-eng-a99f/herbcmp.js`, git-ignored):

| handler | Reg M-B checkout (`gen9championsvgc2026regmb`) | Reg M-C checkout (`gen9championsvgc2026regmc`) |
|---|---|---|
| `onAnyAfterMove` | `this.queue.insertChoice({ choice: "event", event: "WhiteHerb", order: 99 })` | `this.effect.onStart.call(this, this.effectState.target)` |
| `onWhiteHerb` | present (runs the restore when the queued event is reached) | absent |
| `onStart`, `onAnySwitchIn`, `onAnyAfterMega`, `onResidual`, `onUse` | identical | identical |

So under Reg M-C the restore runs inside `useMove`, before `runAction`'s `faintMessages()` (default `checkWin = true`,
`sim/battle.ts` :2832-2833) ends the battle; under Reg M-B it is a queued action that never runs once the battle is
over.

### The defect, and the first cut that was wrong

The two pinned games (`…2679539978`, `…2681406255`) end on a Sneasler's Close Combat: the authority's last lines are
`-enditem|Sneasler|White Herb` and `-clearnegativeboost`; this engine wrote nothing (its herb is spent in `_updateAll`,
which both `sideWiped` break sites skip), and the board parted on the item and two stages.

The first cut ran the herb's reader at both breaks for every holder. The Reg M-C probe went green and the pinned M-C
count fell 11 → 9, **and the Reg M-B lattice went 0 → 4**: four Sneasler games (`regmbbo3-2662378739`,
`regmb-2635870534`, `regmb-2635826073`, `regmbbo3-2635223573`) where the Reg M-B authority kept the herb at -1/-1 and
this engine now spent it. That is how the handler difference above was found. It is exactly what the per-commit Reg M-B
lattice exists to catch.

### The fix

`engine/tag_dex.js`: `restoresStats` gains `afterMoveImmediate: true` when `onAnyAfterMove` does not `insertChoice`
(membership printed: `whiteherb {restores, afterMoveImmediate}` under the M-C checkout, `whiteherb {restores}` under the
M-B checkout, so Reg M-B's row derives byte-identically). Only the M-C row was spliced (structural diff: one rule
change). `engine/medicham2-browser.js`: `herbAtWin` at the two breaks runs `restoreStatsUpdate` for a holder whose tag
says the restore is immediate. Knob `MEDI_HERB_SKIPPED_AT_WIN`.

### Probe — `tests/probe_regmc_white_herb_at_win.js --regulation regmc`

A whole side has to be wiped by the herb holder's move, which the four-body harness can do over three turns: turns 1-2,
the faster partner knocks out the foe in slot a twice (a lead, then its replacement) while the holder stands behind
Protect; turn 3, the partner knocks out slot b and the holder's Close Combat knocks out the last body. The cast is
searched until the AUTHORITY ends the battle; foes idle on a repeatable click (a second Focus Energy writes `-fail` on the
authority only, so it is excluded).

| arm | staged | authority | 0.35.0 engine (release `f09b7fd33be5`) | after |
|---|---|---|---|---|
| WIN | Kleavor @ White Herb + Cinderace vs Liepard, Heliolisk, Persian, Thievul | four faints, then `-enditem` + `-clearnegativeboost` | no herb lines; board `item whiteherb/`, `def -1/0`, `spd -1/0` | match, boards 0 |
| CONTROL | the same, no item | four faints | match | match |

| run | exit | red |
|---|---|---|
| 0.35.0 release and bytes | 1 | WIN (lines and boards) |
| clean, release `5c6df1a5e969` | 0 | none |
| `MEDI_HERB_SKIPPED_AT_WIN=1` | 1 | WIN (lines and boards) |

The probe also asserts the tag agrees with the handler in the selected checkout.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.35.0 | `f09b7fd33be5` | 11 / 954 | 1 |
| 0.36.0, first cut (ungated) | `daab408edd77` | 9 / 954 | 1 |
| 0.36.0, tag-gated | `5c6df1a5e969` | **9 / 954** | 1 |

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Lattice: first cut, release `d6619c946f31`, **4 of 961** (withdrawn, above);
tag-gated, release `d35b7664c7d5`, **0 of 961**, 0 void. Damage differential seed `20260804`: see the commit table.
