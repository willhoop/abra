# The four non-hp, non-status held-out board partings — 2026-09-20

ENGINE, light mode, worktree `agent-a2d7933866df1d982`. Engine bytes after the pass:
worktree release **`231480e57418`** (digest of `engine/medicham2-browser.js` `7072f1c32e15`).

## What was worked

`data/verification/game-differential.g12000.json`, generated 2026-09-20T18:54:29Z on release
`51b80f9fcf08`. **The artifact was read, not re-run** — a re-run costs ~25 minutes and the coordinator's
copy was already on disk.

Pins and flags, which are part of the sample definition:

    --steering empirical --release 51b80f9fcf08 --arm middle --end-state
    --census data/verification/census-pin-8514757f99d5.json --games 12000
    --team-store data/team-pool-frozen --dump-games 12000

7,182 games, **9 board-material**, 88 protocol (`state.protocol_diverged_games` 274 over the whole run;
the dump holds 88). The four worked here are the ones whose parting leaf is neither `hp` nor `status`.

| row | config | seed | turn | leaf | medi / sd |
|---|---|---|---|---|---|
| 3 | omit-weather | `…2659164097 vs …2659163326` | 1 | `p2.party.bellibolt.types` | water / electric |
| 5 | omit-intimidate | `…2657170022 vs …2657402800` | 9 | `p1.party.archaludon.boosts.spa` | 2 / 0 |
| 6 | pair-redirect-priority | `…2655714014 vs …2655713530` | 4 | `p1.pp[0].shedtail` | 1 / 2 |
| 9 | pair-speedctrl | `…2663796709 vs …2663795844` | 10 | `field.trickroom_turns` | 3 / 0 |

**All four are the ENGINE. None is the instrument.** Each was reproduced against the authority on a
staged board before a byte moved.

---

## Row 3 — the shield answers before the bounce (`typechange` road)

**The first divergent line, from `data/divergence-turns.json`:**

    showdown  |-activate|p1a: Hatterene|move: Protect
    medicham  |move|p1a: Hatterene|soak|p2a: Bellibolt|[from] ability: Magic Bounce
              |-start|p2a: Bellibolt|typechange|Water

**Authority.** Both handlers are gathered into one `TryHit` event; `Battle#runEvent` sorts by
`compareLeftToRightOrder` (`sim/battle.ts:421-426`), priority first. `protect.condition
.onTryHitPriority: 3` against `magicbounce.onTryHitPriority: 1`, and Protect's `NOT_FAIL` ends the
event. Neither key is overridden in `data/mods/champions/`. `soak` carries
`{protect, reflectable, mirror, allyanim, metronome}` and no Champions row.

**Engine.** `tests/probe_shield_before_bounce.js` had closed this at `statusMoveTargets` earlier the
same day. The `typechange` dispatch kind (line ~37061 pre-change) still read

    const _tc0 = BOUNCE_UNDONE_BY_REAIM ? a.target : bounceOff(m, a.target, a.mv, true);
    ...
    if (t && shieldRefuses(t, a.mv)) { shieldRefusalAnnounce(t); continue; }

— the shield was asked of `t`, which the bounce had already rewritten to the CLICKER.

**Fix.** The refusal moved INSIDE `bounceOff`, above the Mold Breaker pierce. Six dispatch kinds
called it bare (`typechange`, `status`, `pivot`, `curse`, `sharehp`, `trapmove`) and each asked the
shield afterwards of the wrong body; `statusMoveTargets`'s own pre-check collapses into the shared
one. Hazards are unaffected — they carry no `protect` flag and `shieldRefuses` exempts them itself, so
`bounceSideAtTryHit` is untouched.

**Not claimed:** five more protocol partings in the same draw carry the identical shape on the
`status` and `pivot` roads (`|-activate|…|protect` vs `|move|…|sleeppowder` x3, `…|toxic`,
`…|partingshot`). None is board-material and none has been re-measured here.

Knob `MEDI_BOUNCE_BEFORE_SHIELD` (name unchanged; same fact, wider reach). Census row
`move / changesTargetType`. Probe `tests/probe_typechange_shield_before_bounce.js`.

Probe output, the SHIELDED arm, before and after:

    before   the CLICKER (Bellibolt)  me water     sd electric    STREAMS PART
    after    the CLICKER (Bellibolt)  me electric  sd electric    streams agree

---

## Row 5 — the charge turn's self-boost never asked `invSign`

**The first divergent line:**

    showdown  |-unboost|p1b: Archaludon|spa|1   -> |-damage|p2a: Metagross|77/155
    medicham  |-boost|p1b: Archaludon|spa|1     -> |-damage|p2a: Metagross|1/155

The game's turn 7 carries `|-activate|p2b: Malamar|Skill Swap|stamina|contrary|[of] p1b: Archaludon`,
so Archaludon holds **Contrary** by turn 9.

**Authority.** `electroshot.onTryMove` calls `this.boost({spa: 1}, attacker, attacker, move)` — an
ordinary `Battle#boost`, which raises `ChangeBoost` before it writes. `contrary.onChangeBoost` is
`boost[i] *= -1`; `simple.onChangeBoost` is `*= 2`. No Champions override on either ability or either
charge move (`electroshot`, `meteorbeam`).

**Engine.** The charge branch did the arithmetic raw:

    m.boosts[_kk] = Math.max(-6, Math.min(6, m.boosts[_kk] + _b[_k]));

Twelve other boost sites multiply by `invSign(body)`; this was the thirteenth and did not.

**Fix.** `const _csign = CHARGE_BOOST_RAW ? 1 : invSign(m);` applied to the delta. `invSign` is called
with the body alone — the change is the body's own and the authority never suppresses a breakable
ability on a self-change (`activePokemon !== target`).

Knob `MEDI_CHARGE_BOOST_RAW`. Census row `move / chargeTurn`. Probe
`tests/probe_charge_boost_contrary.js`.

    CONTROL (no swap)   me +1  sd +1   (both arms, before and after — the fixture can see the boost)
    SWAPPED  before     me +1  sd -1   STREAMS PART
    SWAPPED  after      me -1  sd -1   streams agree

No legal carrier of an `invertsBoosts` ability learns either charge move; the probe derives that and
prints `NONE — so the ability is acquired`, which is why the fixture uses Skill Swap.

---

## Row 6 — a row the Substitute absorbed is `null`, not `false`

**The first divergent line:**

    showdown  |move|p1a: Orthworm|Shed Tail|p1a: Orthworm  -> |-fail|
    medicham  |cant|p1a: Orthworm|flinch

The two turns above it are two Rock Slides into an Orthworm standing beside a Krookodile behind a
Substitute. `p1.pp[0].shedtail` is the ONLY leaf that parts in the whole game.

**Authority.** `spreadMoveHit` step 0:

    if (damage[i] === this.battle.HIT_SUBSTITUTE) { damage[i] = true; targets[i] = null; }
    ...
    if (!damage[i]) targets[i] = false;                     sim/battle-actions.ts:1059-1069

and then the two steps below treat the two marks differently:

    getSpreadDamage: for (const [i, target] of targets.entries()) { if (!target) continue;
                       this.battle.activeTarget = target; ... }              :1152-1154
    secondaries:     for (const target of targets) { if (target === false) continue;
                       ... const secondaryRoll = this.battle.random(100); ... }   :1338-1345

So a doll row **never becomes `activeTarget`** and **is still rolled for** (`moveHit(null, …)` then
lands nothing, and does not move `activeTarget` either, because its own `getSpreadDamage` skips null).

**Engine, both halves wrong.** `_stepSubAbsorb` set `R.out` and the step driver skipped the row for
the rest of the move (no `sec` draw); `_stepDamage` had already written `_secAddrSlot` from that row
(the address). Every later row therefore read the authority's PREVIOUS value at the shared address.

**Measured as ADDRESSES, with `G.midAddresses()`, nine staged boards** (three 100-accuracy spread
moves carrying a secondary x doll-absent / doll-on-slot-0 / doll-on-slot-1):

    BEFORE
    bulldoze/nosub        sd: p11|0 p21|0 p10|0     me: p11|0 p21|0 p10|0     agree
    bulldoze/sub-on-p1a   sd: p11|0 p21|0 p21|1     me: p11|0 p21|0           one draw short
    bulldoze/sub-on-p1b   sd: p10|0 p21|0 p10|1     me: p11|0 p21|0           wrong body AND short
    lavaplume/sub-on-p1b  sd: p10|0 p10|1 p10|2     me: p11|0 p11|1           wrong body AND short
    strugglebug/sub-on-p1b sd: p10|0 p10|1          me: p11|0                 wrong body AND short

    AFTER — all nine agree address-for-address, e.g.
    lavaplume/sub-on-p1b  sd: p10|0 p10|1 p10|2     me: p10|0 p10|1 p10|2

and every medicham address is shared with the authority in every category (`acc`, `crit`, `dmg`,
`sec`, `tgt`); `tgtla` stays authority-only by design.

**Fix.** `R._dollSecOwed` is set where the doll eats the whole click; `_stepEffects` carries
`runsWhenOut` and, for that one row class only, draws and discards one `sec` roll per secondary row
the authority's `moveData.secondaries` would hold — Sheer Force empties the list, the format strip
refuses a row the format removed, and Shield Dust is NOT asked because `ModifySecondaries` is raised
on a `null` target. `_secFired` is not called: `moveHit(null, …)` moves nothing. `_stepDamage`'s
`_secAddrSlot` / `_dmgLastSlot` write is guarded by `subBlocks`, a pure read.

**Declared remainder:** a click every one of whose rows is a doll row keeps the old address write and
is counted (`MEDSEEN.secAddrDollWithNoLiveRowYet`). The authority's `activeTarget` there is whatever
the ACCURACY step left, which is `_accLastSlot`'s fact and not this line's.

Knob `MEDI_SUB_SKIPS_SECONDARY_DIE`. Census row `move / substitute` — it reads the address list, not
an outcome, because a flinch that happens to agree at the wrong repeat index looks exactly like a
fixed engine. Probe `tests/probe_sub_secondary_die.js`.

---

## Row 9 — the Encore override was gated on a living foe

**The first divergent line:**

    showdown  |move|p2a: Meowstic|Trick Room|p2a: Meowstic   -> |-fieldend|move: Trick Room
    medicham  |move|p2a: Meowstic|psychic|p2a: Meowstic|[notarget]  -> |-fail|

Turn 10: Whimsicott Encores Meowstic; Primarina (Meowstic's own ally) then KOs both p1 bodies with
Hyper Voice before Meowstic moves.

**Authority.** `BattleActions#runMove`, `sim/battle-actions.ts:227-234`:

    if (baseMove.id !== 'struggle' && !zMove && !maxMove && !externalMove) {
      const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
      if (changedMove && changedMove !== true) {
        baseMove = this.dex.getActiveMove(changedMove);
        baseMove.priority = priority;
        if (pranksterBoosted) baseMove.pranksterBoosted = pranksterBoosted;
        target = this.battle.getRandomTarget(pokemon, baseMove);
      }
    }

**No foe clause.** The foe question belongs to the target alone, and `getRandomTarget`
(`sim/battle.ts:2487-2517`) returns the USER outright for `self`, `all`, `allySide`, `allyTeam` and
`adjacentAllyOrSelf`, and falls back to `pokemon.side.foe.active[0]` on the far-side road rather than
declining. Champions overrides `encore`'s condition (`data/mods/champions/moves.ts:286`) and neither
of those two functions.

**Engine.** The whole execution-time override sat inside `if(_elive.length){`, written for the
random-target draw underneath it.

**Fix.** The gate is lifted; `pick()` returns `null` without drawing when the field is empty. **No die
moves** — `pick()` is only reached for a far-side encored move, and before the fix the whole block was
skipped, so no draw was taken there either.

Knob `MEDI_ENCORE_OVERRIDE_NEEDS_A_LIVE_FOE`. Census row `move / locksTarget`. Probe
`tests/probe_encore_override_no_live_foe.js`.

    CONTROL (a foe standing)  amnesia 2 / irondefense 0  on both engines, before and after
    EMPTY   before            me amnesia 1 irondefense 1   sd amnesia 2 irondefense 0   PART
    EMPTY   after             me amnesia 2 irondefense 0   sd amnesia 2 irondefense 0   agree

**The fixture bit twice and the staging checks caught both.** A self-hold that boosted Speed let the
Final Gambit user outspeed the encorer and kill it before Encore landed; and with no bench the side
wiped and the victim never acted. Both arms now read the AUTHORITY's own stream for *Encore landed*
and *two p1 bodies fainted above the victim's move* before asserting anything.

---

## Receipts

Every probe, clean and under its own knob:

| probe | clean | knob | knob env |
|---|---|---|---|
| `tests/probe_typechange_shield_before_bounce.js` | **0** | **1** | `MEDI_BOUNCE_BEFORE_SHIELD=1` |
| `tests/probe_charge_boost_contrary.js` | **0** | **1** | `MEDI_CHARGE_BOOST_RAW=1` |
| `tests/probe_sub_secondary_die.js` | **0** | **1** | `MEDI_SUB_SKIPS_SECONDARY_DIE=1` |
| `tests/probe_encore_override_no_live_foe.js` | **0** | **1** | `MEDI_ENCORE_OVERRIDE_NEEDS_A_LIVE_FOE=1` |

`tests/test-mechanics.js` REFUSES to write the census under each of the four stamps
(`bounceBeforeShieldRestored`, `chargeBoostRawRestored`, `subSkipsSecondaryDieRestored`,
`encoreOverrideNeedsLiveFoeRestored`), shown once each.

**The census.** 993 → **997 rows**, all four new rows LIVE. The headline figure is the DISTINCT-TAG
count and it is **984 live / 0 missing, before and after** — all four tags (`changesTargetType`,
`chargeTurn`, `substitute`, `locksTarget`) already carried a live row, so these are corrections to
covered ground rather than new coverage. **It did not go down.**

**Regression batch, all exit 0 on the new bytes:** `probe_sub_clamp`, `probe_substitute_family`,
`probe_substitute_roll_address`, `probe_substitute_status_step`, `probe_multihit_through_doll`,
`probe_spread_secondary_address`, `probe_multihit_reaction_per_arrival`, `probe_encore_bracket`,
`probe_encore_pp_end`, `probe_encore_stall_address`, `probe_bounce_accuracy_address`,
`probe_bounce_reflectable_class`, `probe_bounced_move_redirect`, `probe_shield_before_ability`,
`probe_shield_before_bounce`, `probe_shield_refusal_line`, `probe_charge_abort`,
`probe_charge_release`, `probe_charge_release_chosen_slot`, `probe_protean_contrary`,
`probe_simple_beam`, `probe_pivot_magic_bounce`.

**A FLAKE WORTH RECORDING, NOT A FINDING.** On the first batch run four of those
(`probe_encore_pp_end`, `probe_encore_stall_address`, `probe_shield_before_ability`,
`probe_charge_release_chosen_slot`) exited 1 with **byte-identical printed output to the green run**,
including `green — every arm agrees` and `process.exit(bad ? 1 : 0)` with `bad === 0`. Re-run
individually and re-run as a batch, all four are 0. The shared release store
(`%TEMP%\abra-live-release-store`, which `tests/_live_release.js` redirects to and which is shared
across sessions) is the suspect. **Not diagnosed. If a gate run reports one of those four red, check
this before believing it.**

## What is owed

- **Six gate artifacts are now about other bytes.** `engine/status.js` reads the damage differential,
  the three roster stages and the staged-mechanics battery as `MEASURED AGAINST A DIFFERENT ENGINE`
  (cut on `51b80f9fcf08`; the tree is `231480e57418`). A fresh held-out `--games 12000` draw is owed
  too — nothing in this pass re-ran it, so **no claim is made about the nine becoming five.**
- **The CHANGELOG entry and the `docs/RUNNING-NOTES.md` row are owed at merge**, with the version the
  merge assigns. `docs/ENGINE.md` carries the section already.
- **Untouched and still open: rows 1, 2, 4, 7 and 8** — all `hp` or `status` leaves, which is what
  makes them one shared shape rather than five.
