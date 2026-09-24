# The last two Reg M-C narration causes: 2026-09-24 (abra/regmc 0.113.0 – 0.115.0 on the branch; landed in main as 0.117.0 – 0.119.0)

ENGINE. Brief: the two causes `docs/_reports/2026-09-24-gate-reread-merged.md` names for Reg M-C's narration clause
(3/955, 5/1266, 6/1497 undeclared narration-only games). Fix each, prove it red -> green, re-run the three lattices.
Reg M-C only. Reg M-B was run once, only where the fix touches a shared path and the probe run was cheap.

## Verdict

| lattice | before (release `78fb4a85b1a0`) | after (release `aed9780fc4e3`) | board-material |
|---|---|---|---|
| `--games 1200` | 3 / 955 | **0 / 955** | 0 |
| `--games 1600` | 5 / 1266 | **2 / 1266** | 0 |
| `--games 1900` | 6 / 1497 | **1 / 1497** | 0 |

Both named causes are gone from all three lattices (9 of the 14 games). The 3 games left are **three other causes**.
They were already in the pre-fix artifacts, but the merged-pass report did not name them because it dumped only the 1200
lattice. They are bucketed below from the full dumps. The target of 0/0/0 is **not met**.

## Confirmation on the pinned lattice

`data/verification/gd-regmc-merged-dump.json` is the `--dump-games 2000` output of the 1200 lattice on release
`78fb4a85b1a0`. That release's `engine/medicham2-browser.js` is byte-identical (CR stripped, sha256 `189243cf…`) to this
branch's base (`3c9085d7`), so it is a dump of these games on these bytes. It holds the 3 narration games, 3 of 3:

| config | seed | cause |
|---|---|---|
| baseline | `…2680802524 vs …2680902499` | `ordering :: |-enditem|p2a|leppaberry|[eat] <> |-heal|p2:|H/H|[from]revivalblessing` |
| omit-weather | `…2680753653 vs …2680781897` | `event missing from medicham2 :: |-end|p1b|fallenundefined <> |switch|p1b|swampertmega…` |
| omit-intimidate | `…2679731104 vs …2679711048` | `event missing from medicham2 :: |-end|p2b|fallenundefined <> |move|p1a|highhorsepower` |

The HEAD artifacts' by-cause lists give the other two lattices. At 1600, 2 of 5 were these causes (`fallenundefined` ×3).
At 1900, 5 of 6 were (`fallenundefined` ×5, one under "stopped emitting").

## Cause 2: `-end … fallenundefined`. It is an authority bug, and the engine now reproduces it

**Yes, it is an `undefined` interpolation in the authority.** `data/abilities.ts:4730-4750` in `pokemon-showdown-mc`
(the Champions mod does not override `supremeoverlord`; the Reg M-B checkout has the same block):

```ts
onStart(pokemon) {
  if (pokemon.side.totalFainted) {
    this.add('-activate', pokemon, 'ability: Supreme Overlord');
    const fallen = Math.min(pokemon.side.totalFainted, 5);
    this.add('-start', pokemon, `fallen${fallen}`, '[silent]');
    this.effectState.fallen = fallen;
  }
},
onEnd(pokemon) {
  this.add('-end', pokemon, `fallen${this.effectState.fallen}`, '[silent]');
},
```

`onStart` is guarded and `onEnd` is not. So a body that entered with nothing fallen never assigns
`effectState.fallen`, and on exit it writes `|-end|<body>|fallenundefined|[silent]`. The ability End event runs at two
moments: the switch-out (`sim/battle-actions.ts:103`, above the incoming `|switch|`) and the faint
(`sim/battle.ts:2556`, directly below `|faint|`). The End event also skips the ability-suppression check
(`sim/battle.ts:612`). That does not matter here, because no legal Reg M-C species carries Neutralizing Gas (derived from
the M-C dex this run).

**The fix.** The engine had deliberately refused this line ("reproducing a typo is not correctness"). The bar is now
the authority, bugs included. A new function, `fallenCloseField(mon)`, feeds both close sites (the TRACE faint funnel
and `switchOut`). It returns `fallen<n>` when the frozen count is positive, and `fallenundefined` for a
`boostsFromFallen` carrier at zero. The entry line stays on `fallenShown`, which is correct because `onStart` writes
nothing at zero. Counter `MEDSEEN.fallenUndefinedClosed`. Knob `MEDI_FALLEN_UNDEFINED_SILENT=1` (stamps
`MEDFAILS.fallenUndefinedSilentRestored`, now in the census `DELIBERATE_BREAK`).

**The probe.** `tests/probe_fallen_undefined.js` runs in both regulations (anyRegulation). The carrier comes from the
`boostsFromFallen` tag (`kingambit`):
- OUT: the carrier leads and switches out, with nothing fallen.
- FAINT: the carrier is knocked out, with nothing fallen.
- CONTROL: the same body carries Defiant. The authority writes no `-end` for it, which shows the comparison can tell the
  ability from its absence.

| run | result |
|---|---|
| Reg M-C, pre-fix release `11a681c6a683` | **RED**, 3 assertions (OUT and FAINT diverge at the `-end`, counter 0) |
| Reg M-C, fix `098d7fdf95bc` | **GREEN** |
| Reg M-C, fix + `MEDI_FALLEN_UNDEFINED_SILENT=1` | RED, 2 assertions |
| Reg M-B, fix `4e3411cbe0b9` | GREEN (shared path, one cheap run) |
| Reg M-B, fix + knob | RED, 2 assertions |

**Owed to MEASURE:** the Reg M-B declaration in `engine/quarantine.js` (`AUTHORITY-WRONG`, "Supreme Overlord
`fallenundefined`", matcher `/fallenundefined/`) now covers nothing, and its reasoning is overruled. It was left in
place: it belongs to the gate, and its selftests were not re-run from here. The gate prints a row that matches nothing
rather than failing on it.

Commits `0639653a` (0.113.0) and `1dadf7e9` (0.114.1, the census rows).

## Cause 1: the Revival Blessing / Leppa Berry order

**The rule, read whole-block** (M-C checkout). `revivalblessing` (`data/moves.ts:15110-15136`) has `pp: 1`,
`noPPBoosts`, `slotCondition` and `selfSwitch: true`. **The move revives nobody. It raises a switch request.**
`runAction`'s tail (`sim/battle.ts:2860-2911`) runs `eachEvent('Update')` (gen ≥ 5) and then
`makeRequest('switch'); return true`. The revive is the answer's `revivalblessing` action (order 6, `:2781-2798`),
which writes the `-heal`. The move's one PP is spent as it runs, so a held Leppa Berry (`onUpdate`: a slot at 0 PP) is
eaten in that Update pass, above the heal:

```
|-enditem|p2a: Pawmot|Leppa Berry|[eat]
|-activate|p2a: Pawmot|item: Leppa Berry|Revival Blessing|[consumed]
|-heal|p2: Rillaboom|87/175|[from] move: Revival Blessing
```

The engine revived inside the move, so the heal (and in the NOW case the instaswitch) came first and the berry after.

**The fix.** At the move, `reviveReady` makes the same refusals `reviveFainted` makes and queues the revive on
`S._revivePendingApply`. `reviveApplyPending(S)` runs it directly below the next `_updateAll()`. That is either the
loop top before the next action, or the call after the last action (before the residual). In both cases it is above
the re-sort and the mega phase, which is where the authority's order-6 action sits. An Update pass faints nobody, so
the body picked is the one the move would have picked. A queued revive that later fails is counted loudly
(`MEDFAILS.reviveDeferredLost`). Counter `MEDSEEN.reviveAppliedAfterUpdate`. Knob `MEDI_REVIVE_HEAL_INLINE=1` (stamps
`MEDFAILS.reviveHealInlineRestored`, in `DELIBERATE_BREAK`). Revival Blessing is `Past` in Reg M-B, so no Reg M-B run
was made.

**The probe.** `tests/probe_regmc_revive_leppa_order.js`. The move is found by its `revivesFainted` tag and the berry
by its `restoresPP.eatsWhenASlotEmpties` tag, then played three ways:
- BENCH: revived to the bench.
- NOW: instaswitch with a slower foe still to move.
- LAST: instaswitch after the residual.

| run | result |
|---|---|
| pre-fix `098d7fdf95bc` | **RED**, 4 assertions (all three arms diverge `-enditem` vs `-heal`; counter 0) |
| fix `aed9780fc4e3` | **GREEN** (`deferred` 1 in each arm) |
| fix + `MEDI_REVIVE_HEAL_INLINE=1` | RED, 3 assertions |

Regression checks, all green on `aed9780fc4e3`: `probe_regmc_revive`, `probe_regmc_revive_residual_inactive`,
`probe_regmc_revival_blessing`, `test-revive-mirror`, `test-precharge-order`.

Commit `d4dc33fb` (0.114.0).

## The re-run

Release `aed9780fc4e3`, cut on the tree at `d4dc33fb`. Each lattice ran serially through `cmd.exe /c
tools\lownode.cmd` from a spawnSync driver, and each log ends `##EXIT 0` (543 s, 510 s and 674 s). Flags:

```
engine\game_differential.js --regulation regmc --steering empirical --arm middle --end-state
  --release aed9780fc4e3 --census data/verification/census-pin-regmc-ccd979c30997.json
  --team-store data/team-pool-frozen-regmc --games {1200,1600,1900} --write --out <gate path>
  --dump-games 2000 --dump-out data/verification/gd-regmc-narration-last-g<N>.json
```

The pool is `data/team-pool-frozen-regmc`, the untracked `.jsonl` files hard-linked from the main checkout (pool
digest `792daded918f`). The samples match the pre-fix artifacts: 955 / 1266 / 1497 games, the same one void game at
1200 (`pair-speedctrl …2680752139 vs …2680782271`, low-identity), 0 threw. The operands of each clause are
`state.games − state.games_board_never_diverged` (board) and `end_state[0].summary.by_cause_totals.games_narration_only`
(narration):

| lattice | state.games | board-material | narration-only | reconciles |
|---|---|---|---|---|
| 1200 | 954 | 0 | **0** | true |
| 1600 | 1266 | 0 | **2** | true |
| 1900 | 1497 | 0 | **1** | true |

No dump was written at 1200 because nothing diverged. The 1600 and 1900 dumps hold every diverging game (2 of 2 and
1 of 1), so the lists below are the full population, not the capped list.

## What is left: 3 games, 3 causes, all present before this pass

**A. White Herb order after two Intimidates (1600, 1 game).** baseline `…2681884715 vs …2681855448`, turn 0. Two
Incineroars lead, each with Intimidate and White Herb. The authority spends p2b's herb first and p1b's second; the
engine does the reverse.
- The p1b Incineroar is Brave (−Spe) and the p2b one is Adamant, from the pool sheets. p2b's Intimidate resolves first
  on both engines, so both know p2b is faster.
- The authority's herb is `onAnySwitchIn` (priority −2, `data/items.ts:7692`), collected once per active holder in
  `fieldEvent` and speed-sorted. So the faster holder goes first.
- The engine's `restoreStatsAll` walks the holders in SIDE order (`[...a, ...b]`) at all six of its call sites.
- **An engine ordering defect, not a tie.** The likely fix is to walk `restoreStatsAll` through
  `sdEachEventOrder(actA, actB, field)`. Not done here: it is outside the brief, and it would change the engine under
  the measurement just taken.

**B. Grassy Terrain residual heal order (1600, 1 game).** omit-weather `…2684772479 vs …2684878616`, turn 1. The
authority heals p1a Rillaboom and then p2a Rillaboom; the engine heals p2a first.
- Both Rillaboom are Adamant with no spread on the sheet (`evs: null`), so both get the same filled spread. **Inferred
  to be a speed tie; not measured.**
- The harness pins Showdown's shuffle to identity and neutralises the engine's tie key, so the tied pair follows the
  engine's residual list construction. That construction does not reproduce the authority's selection-sort swaps for
  this list.
- Needs an `--only-game` replay with speeds before anyone calls it a defect or an instrument artifact.

**C. Emergency Exit, "medicham2 stopped emitting while showdown continued" (1900, 1 game).** omit-spread
`…2679451964 vs …2679546173`. The authority writes `|-activate|p1a: Golisopod|ability: Emergency Exit` and the engine
writes nothing more. The end reason is "medicham2's placement cannot be expressed to showdown (p1: slot 1 holds
golisopod, which showdown already has ACTIVE on the field)". The final boards agree, 4v4 with identical HP. This is the
"unparsed" class the merged-pass report already names (no comparator grammar), and the same cause stood in the HEAD
1900 artifact. The harness mirror is MEASURE's; whether the engine's Emergency Exit placement is right is ENGINE's
first question.

## Census: 1024 before, 1022 after the first re-run, 1024 now

**It went down first, and I caught it after the lattices.** I ran `tests/test-mechanics.js --regulation regmc`
through `lownode` on the fixed tree, and it read **1022 live, 2 missing**. The two MISSING rows were the Supreme
Overlord close rows ("closes its fallen marker on the way OUT, and refuses the authority fallenundefined" and "A
Supreme Overlord that DIES closes its marker too"). Their zero arms asserted the refusal that 0.113.0 withdrew. I did
not run the census before committing 0.113.0; the working order says to, and this is what skipping it cost.

**The fix is 0.114.1 (`tests/test-mechanics.js`).** The zero arms now require the authority's line: above the incoming
`|switch|` on the way out, and directly below `|faint|` on a death. **The re-run reads 1024 live, 0 missing, 1024
probed.** It belongs to cause 2, but it is a separate commit: rewriting 0.113.0 in place was refused as a destructive
reset, so the history was left as it stands. **0.113.0 and 0.114.0 on their own leave those two rows red.**

The census artifact was **not republished**. `data/mechanics-census-regmc.json` stays at the lattice pin
(`ccd979c30997`) that the gate reads, as the merged pass left it. The 1024 reading is parked at
`data/verification/mechanics-census-regmc-narration-last.json`.

`node engine/status.js --write` was **not** run: from a worktree it writes missing untracked files as fact. It is owed
after merge.

## Not mine, left alone

`data/engine-release.json` was modified by my Reg M-B cut and is not committed. `data/engine-release-regmc.json` is
untracked, as in the main checkout.
