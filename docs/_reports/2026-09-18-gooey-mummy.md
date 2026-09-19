# 2026-09-18 — Gooey's drop and the Mummy ability overwrite (ENGINE, light mode)

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ae5d18eded983cfc5`.
Only staged boards and single probes were run. There was no differential, roster, quarantine or all_mechanics_fire run.

## Census

- **Before:** 894 live, 0 missing, 894 probed (`data/mechanics-census.json` at HEAD).
- **After:** 896 live, 0 missing, 896 probed, 0 threw, 0 hollow.
- Both new rows were run under their knob, and each one read MISSING. The census was restored from a backup after each knob run, and the final clean run wrote the file.

## Lead 1 — Gooey skips Contrary and Defiant

**The premise is TRUE, and the defect is wider than the card said.**

- **The authority.** `data/abilities.ts:1632-1638`: `this.boost({ spe: -1 }, source, target, null, true)`. Champions does not override it.
  - `sim/battle.ts:2017-2086` shows that `Battle#boost` runs `ChangeBoost` (Contrary), `TryBoost` (the Clear Body class and Mirror Armor) and `AfterEachBoost` per stat (Defiant and Competitive).
  - Tangling Hair has the same handler byte for byte, but it has **no legal carrier**. The probe derives this at run time.
- **The engine.** The `punishesAttacker.boosts` block (`medicham2-browser.js`, the `_pun.boosts` loop) wrote the value straight into `m.boosts`. It asked no reaction at all.
- **The fix.** A negative entry on a secondary call now goes through `applyStatDrop(m, stat, n, tg.ability, tg)`. This is the one stat-drop road, and it is the same shape as the 2026-09-06 shield-punish fix.
  - Raises and non-secondary calls stay on the raw write, and they are counted in `MEDFAILS.punishBoostNotASecondaryDrop`. No such case exists today, because Gooey is the only carrier.
  - `applyStatDrop` gained an optional `zeroSays` argument, so that `MEDI_NO_ABILITY_ZERO_BOOST` still silences Gooey's clamped zero. The punisher's `abilityZeroBoostAnnounced` count is kept at the call site.
- **The knob.** `MEDI_PUNISH_RAW_BOOST=1` restores the defect and stamps `MEDFAILS.punishRawBoostRestored`.
- **The probe.** `tests/probe_gooey_boost_road.js` stages Goodra (Gooey, clicking Endure) against an attacker that uses Aerial Ace. It has five red and control pairs × 2 pins, with the attacker's ability as the only difference:

| arm | Showdown net | medicham before | medicham after |
|---|---|---|---|
| Contrary Malamar | spe +1 | spe −1 | spe +1 |
| Defiant Kingambit | spe −1, atk +2 | spe −1 | spe −1, atk +2 |
| Competitive Empoleon | spe −1, spa +2 | spe −1 | spe −1, spa +2 |
| Clear Body Metagross | none | spe −1 | none |
| Mirror Armor Corviknight | Goodra spe −1 | attacker spe −1 | Goodra spe −1 |

- **The red run.** Release `482e8f5ca701` gave 11 failures: 10 parted boards and the knob was absent. Every control agreed.
- **The green run.** Releases `d5d7a27015b3` and `e08c740b89b2` both read all 20 arms clear. The knob parts every red arm and no control. The authority separates every red arm from its control, so the fixture can see each ability.
- **The narration lines** now match the authority up to the id/name spelling, including Defiant's `-ability|…|boost` and Clear Body's `-fail`.
- **The census row.** `punishesAttacker`: "Gooey's Speed drop runs the attacker's own reactions — Contrary inverts it, Defiant answers it, Clear Body refuses it, Mirror Armor bounces it".
- **Regression checks** on the fixed release all passed: `probe_ability_zero_boost_line.js` (clean, and under its own knob), `probe_punish_announce.js`, `probe_volley_reactor_count.js`, `probe_selfdrop_address.js` and `probe_punish_side_and_sky.js`.
  - The zero-boost probe went red once, on its site counter, before the `zeroSays` change. It is green now.

## Lead 2 — Mummy overwrites Zero to Hero

**The premise is TRUE. It is a CLASS of two contact rewriters. The move family was already correct.**

### The class, derived rather than recalled

- **Legal abilities that carry a copy or suppress flag.** Battle Bond, Disguise, Stance Change and Zero to Hero carry `cantsuppress` plus `failskillswap` and the rest. Hunger Switch and Illusion carry `failskillswap`, `failroleplay` and others, but not `cantsuppress`. Forecast, Imposter, Receiver and Trace carry `failroleplay`, `noentrain`, `noreceiver` and `notrace`.
  - **Battle Bond has no legal set:** it validates as `Greninja-Bond`, which is `isNonstandard: 'Past'`. The harness's fixture check refused it on the first run, so it is not staged.
- **Every reader of these flags in the authority** (a grep of `sim/` and `data/`, with the Champions mod checked):
  - Skill Swap, Role Play, Entrainment, Worry Seed, Simple Beam and Gastro Acid are **already asked** through `abilityFlagRefusal`. `tests/probe_ability_flag_refusal.js` is green.
  - Trace (`notrace`) and Receiver (`noreceiver`) are **already asked**.
  - Doodle and Core Enforcer are `Past`. Lingering Aroma and Neutralizing Gas have no legal carrier.
  - **Mummy** (`data/abilities.ts:2772`, `cantsuppress` on the attacker) and **Wandering Spirit** (`this.skillSwap` → `sim/battle.ts:1316`, `failskillswap` on either body) were **not asked**.
  - The WIRE 80 comment said "no carrier in this format", and that was false.
  - `Pokemon#setAbility`'s own guard (`sim/pokemon.ts:1922`) makes the same `cantsuppress` refusal for Mummy.

### The fix, at one shared check

- **`engine/tag_dex.js`.** The flag reader is factored out as `abilityFlagReadsOf`. `refusedByAbilityFlag` now calls it, and its output is byte-identical for all six moves. `rewritesAbilityOnContact` now also carries `refusedBy {target, source}`.
  - Membership was printed before wiring. Exactly two rows changed: mummy `{source:[cantsuppress]}` and wanderingspirit `{source:[failskillswap], target:[failskillswap]}`.
- **`engine/medicham2-browser.js`.** `abilityFlagRefusal` is split, and its core `abilityFlagRefusalOf(p, user, target, label)` is shared. The contact site asks it with `_rw.refusedBy`, where `m` is the source and `tg` is the target.
  - A refusal is silent, as it is in the authority.
  - A row without `refusedBy` goes through LOUDLY: `MEDFAILS.contactRewriteNoRefusalShape`.
  - `MEDSEEN.contactRewriteRefused` counts refusals.
- **The knob.** `MEDI_CONTACT_REWRITE_FLAGS_UNREAD=1` restores the defect and stamps `MEDFAILS.contactRewriteFlagsUnreadRestored`.
- **`data/tags.json` was SPLICED, NOT REGENERATED.** This worktree has no store, and `tag_dex` wrote `sheet_entries 0` and zero usage on 804 rows. I kept HEAD's file and carried in only the params that the new derivation changed; the splice script refuses if tags move.
  - The diff is 16 lines in the two rows.
  - `data/abra-tags.js` was rebuilt, and `build/build_tags_js.js --check` passes.

### Proof

- **The probe.** `tests/probe_contact_rewrite_flags.js` uses Cofagrigus (Mummy) or Runerigus (Wandering Spirit), clicking Endure, against five attackers × 2 pins. Each attacker's flags are printed from the dex.
  - The authority's own log decides refused or allowed.
  - The plain Kingambit/Pressure control must be rewritten on the authority, or the file stops.
- **The red run.** Release `d5d7a27015b3` parted every arm that the authority refused. Mummy parted on Zero to Hero, Stance Change and Disguise. Wandering Spirit parted on those three and on Hunger Switch.
- **The green run.** Release `e08c740b89b2` reads all 20 arms clear, with 14 refused by the authority. The knob parts all 14 and none of the 6 allowed arms. Hunger Switch is the arm that tells the two rules apart: Mummy takes it and Wandering Spirit does not.
- **The census row.** `rewritesAbilityOnContact`: "Mummy refuses a cantsuppress attacker and Wandering Spirit a failskillswap one — Hunger Switch is taken by one and not the other".
- **The move half.** `tests/probe_ability_flag_refusal.js` is green after the refactor, including its own knob child.

## Files changed

- `engine/medicham2-browser.js`: the two fixes, two knobs, counters, and the `applyStatDrop` `zeroSays` argument.
- `engine/tag_dex.js`: `abilityFlagReadsOf`, and `rewritesAbilityOnContact.refusedBy`.
- `data/tags.json`: the two params, spliced as described above.
- `data/abra-tags.js`: rebuilt.
- `tests/test-mechanics.js`: two census rows.
- `data/mechanics-census.json`: 896 rows.
- `tests/probe_gooey_boost_road.js` (new) and `tests/probe_contact_rewrite_flags.js` (new).
- `docs/ENGINE.md`: a new section and the hand list.
- `data/engine-release.json` was rewritten by the probes' release cuts. It is **not merge-worthy**.

## PROPOSED NOTES ROW

**Gooey's Speed drop now runs the attacker's own stat reactions, and Mummy and Wandering Spirit now refuse a flagged ability. Census 894 → 896 live, 0 missing.**
- **Gooey.** `this.boost` on the attacker (data/abilities.ts:1636) now goes through `applyStatDrop`. Contrary, Defiant, Competitive, Clear Body and Mirror Armor all apply. Knob `MEDI_PUNISH_RAW_BOOST=1`. Probe `tests/probe_gooey_boost_road.js`: 20 arms, red on `482e8f5ca701`, clear on `e08c740b89b2`.
- **Mummy and Wandering Spirit.** They now refuse `cantsuppress` (data/abilities.ts:2772) and `failskillswap` (sim/battle.ts:1316). The tag is `rewritesAbilityOnContact.refusedBy`, derived by the move family's reader and asked by its asker. Knob `MEDI_CONTACT_REWRITE_FLAGS_UNREAD=1`. Probe `tests/probe_contact_rewrite_flags.js`: 20 arms, 14 refused, red on `d5d7a27015b3`, clear on `e08c740b89b2`.
- **Pool.** The two leads were 2 games and 1 game on the 2026-09-18 lattices. Neither was re-measured here.
- **Supersedes.** Nothing published. The WIRE 80 comment "no cantsuppress carrier in this format" is struck in the source.
- **Owes.** `docs/ENGINE.md` is done in this pass. The living documents owe nothing until the next major.
- **Basis.** unchanged.

## OWED, NOT RUN

- **The whole-game differential** on the three lattices (`--games` 1200 / 1350 / 1950) on a release cut after merge. The expected result is that the 2 Gooey games and the 1 Mummy game stop parting. This is light mode, so it was not run.
- **A `tag_dex` regeneration on the MAIN tree**, which has the store. It should confirm that the only param change is the two `refusedBy` rows and that usage counts are unaffected by this pass.
- **The roster ability stage and `all_mechanics_fire`** are not run. Both touch Gooey, Mummy and Wandering Spirit.
- **Narration leads, seen and not fixed, with no board effect.** After a Wandering Spirit swap, the authority writes `|-ability|p2a: Runerigus|Pressure` (the acquired Pressure's `onStart` announcement), and medicham's trace does not carry it. The authority's lead-in `|-ability|p1a: Kingambit|Pressure` was also absent from the medicham lines filtered here. It is unverified whether that is only where the trace window starts.
- **Wandering Spirit into a Wandering Spirit attacker.** The authority swaps: gen > 5 has no same-id refusal in `Battle#skillSwap`. The engine skips on `m.ability === tg.ability`. It is not staged, and it is probably narration-only because the abilities are identical.
- **A release id to add to the ledger:** `e08c740b89b2` (both fixes).
