# Reg M-C engine pass 3: the pinned board-material games on the re-staged census, largest cause first

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.41.0 onward. **Status.** Findings record, historical by
construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-ae7263475f1c693b3`, branch `worktree-agent-ae7263475f1c693b3`, base `3eb3b71d` (abra/regmc 0.40.0 + ENGINE 0.33.0–0.36.0 merged) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher (`data/_scratch-eng-ae72/run.js`, git-ignored) |

**The pinned Reg M-C differential**, every reading below:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch> --dump-games 2000 --dump-out <scratch dump>
```

- **`--games 1200`**, arm `middle`, steering `empirical`, `--end-state`.
- **Census pin `census-pin-regmc-f3b70bc0c47c`.** This IS the current Reg M-C census: HEAD's
  `data/mechanics-census-regmc.json` hashes to `f3b70bc0c47c…` once its CRLF checkout is stripped (and `git show
  HEAD:` gives the same digest), so no new pin was cut. It is MEASURE's 0.40.0 re-staged census (1006 rows).
- **Pool**: the MAIN checkout's `data/team-pool-frozen-regmc` (absolute path).
- **State bar** = `state.games - state.games_board_never_diverged`. Every board-material game in this pass is under the
  40-row cap of `state.first_board_divergences`, so the list IS the population; causes were confirmed against the full
  `--dump-games` dump.

**The Reg M-B regression check**, every commit: `git diff --quiet HEAD` on `data/tags.json`, `data/protocol-events.json`,
`data/move-effects.js`; the lattice `--steering empirical --arm middle --end-state --census <HEAD's
data/mechanics-census.json, a copy> --team-store <main>/data/team-pool-frozen --games 1200` on a Reg M-B release cut from
the commit's tree with `SHOWDOWN_PATH` set to the M-B checkout.

---

## 0. The baseline, and why it is not 9

Release **`5c6df1a5e969`** — the same id as the previous pass's last release: MEASURE's 0.40.0 moved the driver
(`engine/game_differential.js`) and the census, neither of which is a frozen engine file, so HEAD's engine bytes are
the 0.36.0 bytes.

| | release | census pin | driver | state bar | void |
|---|---|---|---|---|---|
| previous pass, last reading | `5c6df1a5e969` | `98c69a4fee7f` (old) | pre-0.40.0 | 9 / 954 | 1 |
| **this pass, baseline** | `5c6df1a5e969` | `f3b70bc0c47c` | 0.40.0 | **13 / 953** | 2 |

Same engine, different instrument. The increase is the driver: 0.40.0 **answers** a revival request (`mirrorRevival`,
12 requests, all 12 by the authority's default because this engine revived nothing) where the old driver could not, so
six games that used to stop or throw at a Revival Blessing now play on and part on the revive, which is exactly where
the state bar sees it. The census re-stage and the per-game mega slot change which games are dealt too (953 against
954; 2 void against 1).

**The 13, bucketed** (first board divergence, cause confirmed on the full dump):

| cause | games | seeds |
|---|---|---|
| **Revival Blessing revives nothing** (this engine pivots a live bench body in, or nothing) | **6** | `…2678516446`, `…2679699611`, `…2680818179`, `…2681338047`, `…2681985200`, `…2684539964` |
| a Double Shock game: `-fail` label narration at turn 3, the board parts on a later revive (turn 6) | 1 | `…2680957904` |
| Ice Spinner's terrain removal (`-fieldend|grassyterrain` missing here) | 1 | `…2678759068` |
| Berserk fires at a different moment (`spa +2` against `+1`) | 1 | `…2680183974` |
| a damage roll on Dire Claw (Expanding Force's PP then parts) | 1 | `…2680535928` |
| Seed Sower does not start Grassy Terrain | 1 | `…2679664835` |
| Trace picks a different foe's ability (Drought against Chlorophyll) | 1 | `…2681842922` |
| Liquid Ooze on a draining move | 1 | `…2681957395` |

---

## 1. Revival Blessing revives (abra/regmc 0.41.0)

### The authority, read whole (M-C checkout)

- `data/moves.ts` revivalblessing :15110-15136: `onTryHit` fails with no fainted ally; `slotCondition: 'revivalblessing'`;
  `selfSwitch: true` only to raise the switch request. The Champions mod names it only in learnsets.
- `sim/side.ts` chooseSwitch :930-975: on a reviving slot a bare answer is the first fainted body in party order; a live
  body is refused; the answer is a `revivalblessing` action.
- `sim/battle-queue.ts` :180: `revivalblessing` has order 6; `commitChoices` sorts the answers ahead of the rest of the
  turn (`sim/battle.ts` :2998-3027).
- `sim/battle.ts` :2781-2798: `pokemonLeft++`; if `target.position < side.active.length`, `queue.addChoice({choice:
  'instaswitch', …})`; `fainted = false`, `status = ''`, `hp = 1; sethp(maxhp / 2)` (`sim/pokemon.ts` :1655-1667
  truncates); `add('-heal', target, getHealth, '[from] move: Revival Blessing')`.
- `addChoice` APPENDS (`sim/battle-queue.ts` :307-313), behind the residual. `runAction`'s tail re-sorts only when the
  queue's head is a move (`sim/battle.ts` :2916-2923). So the instaswitch is at once if a move is still queued, and after
  the residual otherwise. Gen 9 cancels no queued action on a faint (`sim/battle.ts` :2581-2596 is gen ≤ 3 only).
- `sim/battle-actions.ts` switchIn :62-160 with the body as its own `oldActive`: its `hp` is now non-zero, so it runs the
  body's own BeforeSwitchOut/SwitchOut, `cancelAction(oldActive)` (its queued move dies) and `clearVolatile()`.
- `fieldEvent` (:484-515) walks `side.active`, so a body revived in its slot with nothing left to move stands through the
  residual before it walks in.
- `side.totalFainted` is incremented at a faint and never decremented.

### The defect

`engine/medicham2-browser.js` (0.28.0) played the revive road as the status pivot and counted it
(`MEDFAILS.reviveUnmodelled`): a live bench body walked in (`|switch|…|[from] revivalblessing`), or, with no live bench,
nothing happened. The move and its only learner are `Past` in Reg M-B, so that counter could never be raised on the
closed line — a rotation trap, recorded in `docs/REGULATION-ROTATION.md`.

### Fix

`reviveFainted` / `reviveInstaswitch` / `reviveClear`, beside `faintHousekeeping`:

- pick the first fainted body in `sf.team` (kept in the authority's `side.pokemon` order by `bringIn`, ROADMAP #544);
- clear what the faint's `clearVolatile(false)` clears (boosts, `_vol` and the fields `switchOut` clears), the status and
  its counters, the faint bookkeeping; `curHP = max(1, trunc(maxHP × hpFraction))`, the fraction read off the existing
  `revivesFainted` tag;
- write `-heal|pN: <name>|…|[from] move: <id>` (new `TR.healSide`: the authority names an inactive body by side alone);
- not in a slot: onto the bench in party order. In a slot (`instaswitchIfActiveSlot`): its own queued action is marked
  cancelled; if any action is still queued, `bringIn` it at once (a plain `|switch|`, entry effects); otherwise
  `S._reviveInsta`, drained after the residual's closing update;
- `fallenCount` adds `sf._revived`, so Last Respects and Supreme Overlord still count the death.

Not modelled, and counted: the revived body's own SwitchOut handlers on its instaswitch
(`MEDFAILS.reviveSwitchOutUnmodelled`, raised when it carries `switchOutTrigger` or `healsOnSwitchOut`).
Knob `MEDI_REVIVE_UNMODELLED` restores the counted pivot road.

No tag moved: `revivesFainted` already carried `hpFraction` and `instaswitchIfActiveSlot`. `data/tags.json` and
`data/tags-regmc.json` untouched.

### Probe — `tests/probe_regmc_revive.js --regulation regmc`

Cast derived on the run: the `revivesFainted` move and its learner (Pawmot), a targeted status move with `selfdestruct`
(Memento) on a body with a status-priority ability read off the dex (Whimsicott, Prankster), so the faint lands before
the revive; foes non-Dark (Prankster), their speed read off base stats, and the one foe that must outrun the reviver in
LAST carries the legal item whose `onModifySpe` is `chainModify(1.5)` (Choice Scarf). Each foe clicks its idle move once
(a second Focus Energy writes `-fail` on the authority only — the first cut hit exactly that) and Protect otherwise.

| arm | staged | authority |
|---|---|---|
| BENCH | T1 Memento faints the partner, Baxcalibur refills; T2 Revival Blessing | `-heal|p1: Whimsicott|67/135|[from] move: Revival Blessing`, no switch |
| NOW | one turn: Memento, then Revival Blessing, slower foes still to move | `-heal`, `|switch|p1b: Whimsicott`, then the foes' moves |
| LAST | one turn: every foe moves first (Scarf / Protect) | `-heal`, `|upkeep`, `|switch|p1b: Whimsicott` |

| run | exit | red |
|---|---|---|
| release `5c6df1a5e969` + the 0.40.0 engine bytes (`git show HEAD:`) | **1** | all three arms, lines and boards |
| clean, release `2d5d6ec26e28` | **0** | none; counters: one revive per arm, two instaswitches, none unmodelled |
| `MEDI_REVIVE_UNMODELLED=1` | **1** | 6 (all three arms, lines and boards) |

9 staged sets, 0 illegal under the Reg M-C `TeamValidator`. The 0.28.0 probe `tests/probe_regmc_revival_blessing.js`
(the FAIL arm) stays green.

### Pinned Reg M-C differential

| engine | release | state bar | void | revival requests |
|---|---|---|---|---|
| 0.40.0 | `5c6df1a5e969` | 13 / 953 | 2 | 12, all authority default |
| 0.41.0 | `2d5d6ec26e28` | **7 / 954** | 1 | 12, **all 12 mirrored** from a revive this engine made |

Left (seed sets compared): all six revive games. Joined: none. The Double Shock game `…2680957904` stays
board-material, now on a Kingambit HP at turn 7 (§ later). One revive-adjacent narration line remains in the dump:
`-enditem|…|leppaberry|[eat]` against the authority's revive `-heal` (Revival Blessing's single PP triggers a Leppa
Berry, and the two engines order the berry and the heal differently). No board leaf parted on it.

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Lattice on release `7335f5460a29`: **0 of 961**, 0 void, 0 protocol
divergences.

### Filed for MEASURE (not fixed; the driver is MEASURE's)

`mirrorRevival` drops the head of the entry queue of the USER's slot. With the revive now modelled, a body revived in
an active slot instaswitches into ITS OWN slot, which can be the other one; its entry is left in that slot's queue.
Harmless unless the same slot raises a forced-switch request later in the same turn, when the leftover entry would
answer it. Not seen in this sample.
