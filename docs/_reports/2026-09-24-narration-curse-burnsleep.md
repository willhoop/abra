# 2026-09-24 — Reg M-C narration: Curse message order (group J) and burn against sleep (group N)

ENGINE, isolated worktree, branch of `cf59f23a`. Two commits, one per mechanic: **0.87.0** (Curse) and **0.88.0**
(Beak Blast). Both are narration-only (the boards never parted in any arm or run). Versions are the next free
`abra/regmc` numbers; the coordinator renumbers at merge.

## 1. Curse (group J) — two defects in one line, as the triage said

**Confirmed with a constructed probe before any fix** (`tests/probe_curse_ghost_order.js`, cast derived: a quiet Ghost
Curse learner — Skeledirge — into a quiet foe; the AGAIN arm hits an already-cursed target; the PLAIN arm is a non-Ghost
user).

| | authority | engine (0.86.1 bytes) |
|---|---|---|
| Reg M-C GHOST | `-damage p1a` then `-start p2a Curse [of] p1a: Skeledirge` | `-start … [of] skeledirge` then `-damage` |
| Reg M-B GHOST | `-start … [of] p1a: Skeledirge` then `-damage` | same order, `[of] skeledirge` |

**The source, read whole-block:**
- Reg M-B: `pokemon-showdown/data/moves.ts:3266-3310`, no Champions `curse` entry. `volatileStatus: 'curse'` — added by
  `runMoveEffects` above the move's `onHit` (`directDamage(source.maxhp / 2)`).
- Reg M-C: `pokemon-showdown-mc/data/mods/champions/moves.ts:165-194` overrides it with `volatileStatus: undefined`;
  `onHit` runs `this.directDamage(source.maxhp / 2, source, source)` and THEN `target.addVolatile('curse')`. It is the
  only mod entry in either checkout that sets `volatileStatus: undefined` (grepped).
- Both: `condition.onStart(pokemon, source) { this.add('-start', pokemon, 'Curse', `[of] ${source}`); }` — the
  identifier, not the species.

**Fix.** `engine/tag_dex.js` derives `typeSplitMove.costBeforeVolatile` off the handler (no declared volatile, and
`directDamage(` written above `addVolatile(` in `onHit`), written only when true. Full regeneration of both tag files
printed exactly one new leaf (`moves.curse.params.typeSplitMove.costBeforeVolatile`, Reg M-C) and nothing for Reg M-B —
but the regeneration also re-read the store's usage counts in thousands of rows (the worktree has no Reg M-B store), so
it was discarded and the one leaf was applied to `data/tags-regmc.json` by hand; a structural leaf diff against HEAD
reads 1 added, 0 removed, 0 changed. The engine's `typesplit` branch pays the cost first when the param is set; a user
the cost kills now announces its `|faint|` after the `-start` (the add is the next statement in the handler). `[of]` is
now `TR.vstart(..., m)` → the identifier. Knobs `MEDI_CURSE_ORDER_FIXED`, `MEDI_CURSE_OF_SPECIES`; counter
`MEDSEEN.curseCostFirst`.

**Probe, red → green:**

| run | Reg M-C | Reg M-B |
|---|---|---|
| 0.86.1 engine bytes (`--medi`) | RED (order + name, counter shut) | RED (name) |
| fix | green, `curseCostFirst` 1 | green, `curseCostFirst` 0 |
| `MEDI_CURSE_ORDER_FIXED=1` | RED | green (the param is absent in Reg M-B, so the knob is inert there by design) |
| `MEDI_CURSE_OF_SPECIES=1` | RED | RED |

Note: the game differential's normaliser folds the `[of]` spelling (the Reg M-B arm showed "first protocol divergence:
none" while the probe's field comparison was red), so the name half was never going to show on a lattice; only the
order half did.

## 2. Burn against sleep (group N) — it is Beak Blast, a shared rule

The triage called N "unexplained: the source of the burn is not in the window". The window (g1900, `…2683663169`,
turn 2) opens with `|-singleturn|p1a: Toucannon|move: Beak Blast`; the burn is Beak Blast's, and the sleep is Sneasler's
Dire Claw secondary.

**Source:** `beakblast` (`data/moves.ts:1119-1146`, byte-identical in both checkouts; the mod, `moves.ts:47-51` in both,
changes only basePower and pp): `condition.onHit` → `source.trySetStatus('brn', target)` on contact. A volatile's
`onHit` is raised by `runEvent('Hit')` inside `runMoveEffects` (`sim/battle-actions.ts:1283`), step 3 of
`spreadMoveHit`, above `selfDrops` (:1096) and `secondaries` (:1099). The engine paid it inside the DamagingHit reactor
(`_damagingHitAs`), below the secondaries. Within one `runEvent('Hit')`, a Condition (subOrder 2) runs before an
Ability (7) (`sim/battle.ts:957-972`), so the new step sits above `_stepHitEvent` (Anger Point).

**Confirmed with a constructed probe before the fix** (`tests/probe_beak_blast_burn_order.js`; cast derived: Toucannon
is the only quiet legal learner in both regulations; the attacking move is the first derived contact move with a single
non-burn status secondary that the foe learns — Body Slam here). Both regulations, pre-fix: authority
`-status p2a brn` then `-status p1a par`, engine the reverse; boards identical. PLAIN arm (no secondary) agreed before
and after.

**Fix.** `_stepPreTurnHit`, in `_STEPS` between `_stepMoveOnHitTerrain` and `_stepHitEvent`: gated on the DamagingHit
pass's own conditions (`R._dh` built, `R.react > 0` — a doll leaves the Hit event unraised), the `preTurnShield`
trigger, `punishAttacker` mode, attacker alive and unstatused. It sets `R._preTurnPunishPaid`, which the old site
honours. An interior volley arrival still pays in its own DamagingHit call first (unchanged). Knob
`MEDI_BEAK_BLAST_BURN_AT_DAMAGING_HIT`; counter `MEDSEEN.beakBurnAtHitEvent`.

**Probe:** red on the 0.87.0 bytes in both regulations (before the patch); green in both after, counter 1; red under the
knob in both. Neighbours green in both regulations on the fix release: `probe_curse_ghost_order`,
`probe_hit_event_buff_order`, `probe_stealeat_before_reactors`, `probe_steel_roller_onhit`.

## 3. Board-material check — pinned differential, base vs each commit

Flags (the sample definition): `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`,
`--census data/verification/census-pin-regmc-0d03e83f0e65.json` / `census-pin-833a997d7e42.json`,
`--team-store data/team-pool-frozen-regmc` / `data/team-pool-frozen`, each through `tools\lownode.cmd`. Mode
`A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`.

| regulation | release | what | games | diverged | board-material |
|---|---|---|---|---|---|
| Reg M-C | `ec377f6f8159` | base `cf59f23a` | 259 | 0 | 0 |
| Reg M-C | `8051cc3c92a7` | 0.87.0 | 259 | 0 | 0 |
| Reg M-C | `9715a04eb0fe` | 0.88.0 | 259 | 0 | 0 |
| Reg M-B | `7822a83cc49b` | base | 260 | 2 | 1 |
| Reg M-B | `19c1f3a33ed3` | 0.87.0 | 260 | 2 | 1 |
| Reg M-B | `8910b1cd2bbd` | 0.88.0 | 260 | 2 | 1 |

The Reg M-B divergence lists are identical across all three (same two games, same first lines); neither is Curse or
Beak Blast. **Nothing moved.** The releases were cut in the worktree and are not committed (as in pass 10); the ids
are receipts for this report only.

**What this check cannot say:** the 300-game lattice holds neither field game, and at base it parted zero Reg M-C
games, so it shows no regression and nothing more. The fixes are proven by the probes. Re-reading the field games
(`…2679027089` on the 1600 lattice, `…2683663169` on the 1900 lattice) is the gate re-read's job.

## 4. Found, not fixed (not mine, reported)

- **Reg M-B, `--games 300` lattice, a board-material parting present at base:** `omit-spread`,
  `gen9championsvgc2026regmbbo3-2659015200 vs …2659155127`, turn 3. The engine writes
  `|-enditem|p1a: Alakazam|Alakazite|[from] knockoff` where the authority writes nothing, and the board parts on
  `p1.party.alakazam.item` (engine `""`, authority `alakazite`). A Knock Off removing a mega stone from its own species.
  Not in the gate's lattices (1200/1350/1950), so the gate cannot see it. Routed back to the coordinator.
- The second Reg M-B row on that lattice is the declared Supreme Overlord `fallenundefined`.

## 5. Owed / not done here

- `node engine/status.js --write` was NOT run: from a worktree it writes missing untracked files as fact (standing
  memory). The coordinator runs it at merge.
- The census (`tests/test-mechanics.js`) was not regenerated: these are narration fixes on already-live mechanics.
- `data/engine-release.json` is modified by the release cuts and deliberately left out of both commits.
- Scratch left in the worktree, created this session: `.gd-scratch/` (the six differential outputs) and hard links
  to the two frozen team pools under `data/team-pool-frozen*/games.*.jsonl` (ignored files; the links point at main's
  copies).
