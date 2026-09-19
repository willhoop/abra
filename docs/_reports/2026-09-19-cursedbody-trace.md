# 2026-09-19 — Cursed Body against Triple Axel, and Trace on Alakazam

ENGINE division. LIGHT MODE: staged boards, single probes and single-game replays. No lattice run, no
roster stage, no `quarantine.js`, no `all_mechanics_fire`.

## VERDICT

- **Cursed Body against Triple Axel: FIXED, both halves, for the whole derived class.** The rule half and
  the address half are both engine changes. **`engine/game_differential.js` was NOT changed and `PIN_DIGEST`
  (`de38d17e15a2`) does not move. Nothing is invalidated.**
- **Two more defects in the same class were found by the sweep and fixed:** the hit loop's mid-volley sleep
  break, and Effect Spore's powder gate.
- **Trace on Alakazam: a FALSE LEAD, now reproduced and explained.** It was a cascade of Arbok's Shed Skin
  die, which the engine threw ungated at the turn-2 residual. 6.52.0 (`a1c7dcd5696b`) already fixed that
  die. There is no Trace defect.
- Census **915 → 920 live, 0 missing** (`data/mechanics-census.json`). Each of the 5 new rows goes MISSING
  under its own knob and no other row moves.
- Verified on worktree release **`44c6e7407738`** (`engine_release.js list`: 0 of 27 files moved since).
  The baseline is **`a1c7dcd5696b`**, which is byte-identical to HEAD `07e01c85` and was cut in this worktree.

## 1. THE AUTHORITY, READ

- `data/mods/champions/scripts.ts` overrides `hitStepMoveHitLoop` and `spreadMoveHit`, so
  `sim/battle-actions.ts` is not the citation. The loop calls `spreadMoveHit` once per hit, and
  `spreadMoveHit` raises `runEvent('DamagingHit', ...)` at its step 7. So every `onDamagingHit` and
  `onSourceDamagingHit` runs once per ARRIVAL.
- The top of each arrival, in order: `damage.includes(false)`,
  `hit > 1 && pokemon.status === 'slp' && !isSleepUsable` → break, `targets.every(!hp)` → break, and then,
  for a `multiaccuracy` move with `hit > 1`, `randomChance(accuracy, 100)` → break.
- Cursed Body (`data/abilities.ts`, no Champions override):
  `if (source.volatiles['disable']) return; ... if (this.randomChance(3, 10)) source.addVolatile('disable')`.
  So it rolls up to once per arrival and stops at the first success.
- Poison Touch rolls `randomChance(3, 10)` per contact arrival. It has no guard for a target that is
  already poisoned.
- Effect Spore: `if (checkMoveMakesContact(...) && source.runStatusImmunity("powder")) { const r = this.random(100); ... }`.
  A Grass or Overcoat attacker gets NO die at all.
- On the middle arm, the multiaccuracy die and every DamagingHit die are all `any|<move>|<activeTarget>`.
  `activeTarget` at the top of arrival k is the last body `getSpreadDamage` reached. Only the ORDER of the
  draws at that address decides which event gets which value.

## 2. THE CLASS, DERIVED (not named)

This is every legal ability with a legal carrier whose `onDamagingHit` or `onSourceDamagingHit` throws a
die, crossed with every legal damaging `multihit` move. A contact-gated handler is only crossed with
contact moves.

- **Reactors:** cursedbody (any hit), cutecharm, effectspore (powder-gated), flamebody, poisonpoint, static
  (contact, target side), poisontouch (contact, source side).
- **Moves (14):** bonerush, bulletseed, doublehit, dragondarts, dualwingbeat, iciclespear, pinmissile,
  populationbomb (multiaccuracy), rockblast, scaleshot, tailslap, tripleaxel (multiaccuracy), twinbeam,
  watershuriken.
- 38 pairings have a legal cast, plus one Grass-attacker arm for the powder gate. 7 pairings have none
  (every Cursed Body carrier is a Ghost, so it is immune to the Normal moves; and no Poison Touch carrier
  learns 4 of the contact moves).

## 3. WHAT THE ENGINE DID, AND THE FIX

| # | defect | kind | fix | knob |
|---|---|---|---|---|
| 1 | Cursed Body and Poison Touch were each ONE closure (`_dhAbil` / `_dhSrc`), armed in `_stepEffects` and paid once below the whole volley. The punish family (Static, Flame Body, ...) was already paid per arrival. | RULE | `_lateReactorsOf(R)` builds both payers (the closures moved verbatim). The packet loop pays each interior arrival beside `_damagingHit(1)`. `_stepDamagingHitLate` pays `R._dhLateN` more arrivals: 1 normally, 0 when the loop paid them all, and the full count on a road with no packet loop. | `MEDI_REACT_LATE_ONCE=1` |
| 2 | `rollHitsOf` drew every per-arrival accuracy die before hit 1: `[MA2, MA3, CB]` where the authority draws `[CB1, MA2, CB2, MA3, CB3]`. | ADDRESS (order) | `rollHitsOf(..., lazyOut)` hands back the full count and the probability. `_maArrive()` draws each die at the top of its own arrival, in the doll walk and in the packet loop, at `_reactAddr`. A stop is a truncation (`_pkAdj`, `_hitsThisUse = landed`, `R.crit` re-read). | `MEDI_MULTIACC_UPFRONT=1` |
| 3 | There was no mid-volley sleep break, so an Effect Spore sleep on arrival k let the volley continue. | RULE | The same arrival-top block now breaks when `m.status === 'slp'`, unless the move or its caller (`_calledBy`, the new field on a called move's queue entry) carries `sleepMove.usableWhileAsleep`. | `MEDI_VOLLEY_IGNORES_SLEEP=1` |
| 4 | Effect Spore rolled its die at a Grass attacker and let `applyStatus` refuse afterwards. The board was right, but the extra die shifted `nth`. | ADDRESS (extra die) | A new derived param `punishesAttacker.attackerStatusImmunity` (regex on `source.runStatusImmunity("…")`; one legal member, Effect Spore, `"powder"`). `statusImmunityRefuses` → `powderImmuneBody`, which is the body half lifted out of `powderBlocked`, so both callers read one fact. | `MEDI_SPORE_DIE_UNGATED=1` |

**Why the address half needed no instrument change.** The earlier report offered two options: a new middle-arm
category for the hit loop's dice (`game_differential.js`, with a new stream key, which moves `PIN_DIGEST`), or a
lazy per-arrival draw inside the engine. The second option is the authority's own order. With it, the two
engines draw the same addresses in the same sequence, so they share the values without any help. The
first option would have separated the two dice into independent streams. It would have hidden the order
defect rather than fixed it, and it would have made every artifact measured under `de38d17e15a2` (the three
lattices g1200 / g1350 / g1950, and everything `arms_comparable.js` links to them) incomparable with every
later run. **This is not a basis question, because the digest did not move.**

**Declared remainders (loud, not silent):**
- A collapsed volley (the total was rewritten, so there are no packets) or a doll that takes the one-subtraction
  road draws its accuracy dice in one run. That is the old order. It is counted in
  `MEDFAILS.multiAccLazyOnCollapse`, and the landed total is capped at the packets that landed. With no packets
  at all, the case is counted in `MEDFAILS.multiAccLazyNoPackets` and the damage is not cut. A lazy volley that
  no road opened is counted in `MEDFAILS.multiAccLazyUnspent`.
- A truncated multiaccuracy volley was priced for every arrival. So the engine draws `dmg` and `crit` dice for
  arrivals the authority never opens. Those addresses are one-sided. They shift nothing unless the same move
  hits the same slot again in the same turn. **Not measured on the pool.**

## 4. PROBES — red before, green after, red under each knob

**`tests/probe_multihit_reaction_per_arrival.js`** (new). It is a two-engine, middle-arm sweep of the whole
derived class, with K = 8 staged copies per pairing (k idle turns before the attack, because `turn` is in
every address). It asserts that every game's protocol stream agrees, that every turn-boundary board agrees,
three non-vacuity witnesses, and the two wire counters. It then re-runs itself under each knob in a child.
- On baseline `a1c7dcd5696b`: **101 of 304 games parted** (71 on the board). These were Cursed Body on all 11
  pairings, every multiaccuracy × reactor pairing, Effect Spore on the non-multiaccuracy contact moves (sleep),
  Poison Touch × Double Hit, and the Grass arm.
- On `44c6e7407738`: **0 of 304 parted**. Witnesses: the authority landed Cursed Body between two arrivals 33
  times and Poison Touch once, and 63 multiaccuracy games interleaved accuracy and reaction dice on one
  address. Counters: `lateReactPerArrival 155`, `multiAccLazyDrawn 224`, `multiAccLazyStopped 27`,
  `volleyStoppedUserAsleep 7`, `sporeDieRefusedPowder 14`.
- Knob children, each RED on its own arms only: `MEDI_REACT_LATE_ONCE` 51 parted in scope, `MEDI_MULTIACC_UPFRONT` 48,
  `MEDI_VOLLEY_IGNORES_SLEEP` 7, `MEDI_SPORE_DIE_UNGATED` 2. **0 outside scope for every knob.**
- The probe refuses to run with no `--release` and no `-r tests/_live_release.js`.

**Census rows** (`tests/test-mechanics.js`, the helper `diceOf(` was added to `REALTURN` with its reason). Each is
a real `battleTurn`:
- `ability/disablesAttacker`: Cursed Body dice [no proc, proc]. Crunch [1,1], Dual Wingbeat [2,1].
- `ability/poisonsOnMyContact`: Poison Touch dice. Fake Out 1, Double Hit 2.
- `move/multiAccuracy`: [dice drawn after the target first lost HP, `-hitcount`]. No Guard [0,3], none [2,3].
- `ability/punishesAttacker`: [`-hitcount`, user status]. Paralysed [2,par], slept [1,slp].
- `ability/punishesAttacker`: Effect Spore dice. Weavile 1, Grass Scovillain 0.
- Under each knob, exactly its own rows go MISSING (918/2, 919/1, 919/1, 919/1) and the census is NOT written.
  All 12 knob stamps (these 4 plus the 8 from 6.52.0, which were missing from the list) were added to
  `DELIBERATE_BREAK`. Before this, a red demonstration of a 6.52.0 row would have written the census.

**Whole-game check, single game, on the lattice's own card:** `…2635092694 vs …2634845820` (omit-weather,
g1950). On `a1c7dcd5696b` it parts at index 91,
`|-start|p2b: Tsareena|Disable|Triple Axel|[from] ability: Cursed Body` against `|-hitcount|p1a: Gengar|3`.
That is byte-identical to the g1950 lattice record. On `44c6e7407738` **the two streams never parted**:
138 = 138 lines, and both engines ended the battle.

## 5. TRACE — REPRODUCED, AND IT IS NOT TRACE

- **A warm-up is not needed under the lattice's steering.** The lattices run `--steering empirical`. The
  driver draws each click from move priors on a per-game seed (`DRIVER_GAME_SEED`, `DRV_NTH.clear()` per game),
  and the census is CREDITED ONLY. So `replay_one --no-warmup --steering empirical --end-state --turns 50`
  replays the lattice game exactly. The 2026-09-19 ordering pass replayed without `--steering empirical`, and
  that is why it got "a different game". **Checked three times against the stored records:** the Trace card on
  74be (index 52), the Trace card on a1c7 (index 83), and the Cursed Body card on a1c7 (index 91). All three
  reproduce exactly.
- **74be319d02fa** (opened read-only from the main tree's release store, and `cut()` was refused by a scratch
  preload). At the end of turn 2, Beedrill faints and Alakazam-Mega comes back in as the replacement.
  Showdown writes `|-ability|p2a: Alakazam|Competitive|Trace|[of] p1b: Milotic`. medicham2 writes
  `|-ability|p2a: Alakazam|toughclaws|[from] ability: trace`. The streams part at index 52
  (`|-boost|p2a: Alakazam|spa|2` against `|-unboost|p2b: Arbok|spe|1`).
- **a1c7dcd5696b**: both engines trace Competitive. The game holds until the turn-6 Focus Sash split.
- **a1c7dcd5696b with `MEDI_CURE_ROLL_UNGATED=1`**: medicham2 traces **Tough Claws** again and the streams part
  at **index 52** with the same two lines as 74be.
- **Cause.** p2's Arbok carries Shed Skin and was active and unstatused through turn 2. The pre-6.52.0 engine
  threw its cure die at the turn-2 residual at `any|-|-`. The replacement's Trace `sample` is at that same
  address, one `nth` later on our side only. So each engine read a different value, and the pick went to a
  different foe. The 6.52.0 Healer/Shed Skin gate removed the die. **No Trace defect. The lead is closed.**
- **What the game still does on 44c6:** it parts at turn 6, index 83. Showdown writes
  `|-end|p1a: Kleavor|move: Future Sight`, `|-enditem|p1a: Kleavor|Focus Sash`, `|-damage|1/145`, and ours
  faints Kleavor. The booker Alakazam fainted earlier that turn. This is a different mechanism and it is carried
  forward.

## 6. REGRESSION CHECKS (all on the final tree, pinned to `44c6e7407738` through a PRIVATE release store)

`tests/_live_release.js` shares one temp store across worktrees. So every probe that requires it was run under a
scratch preload that pre-empts it and redirects `cut`/`open` to a store private to this session. That store
holds exactly `44c6e7407738`.

- Green: `test-no-silent-failure`, `test-tag-consumed`, `test-tag-params-derived`, `test-tag-signature`,
  `test-engine-consistency`, `test-resolution-order`, `test-tag-wire` (104), `test-future-sight`,
  `test-multihit-roll`, `test-multihit-damage-game`, `test-sleep-duration`, and the probes
  `damaginghit_order`, `unshared_reaction_dice`, `multihit_update`, `reaction_address`,
  `ability_volatile_line`, `drain_per_arrival`, `arrival_reprice`, `bond_reactor_ko`, `arrival_drift_zero`,
  `bond_arrival_reprice`, `bond_one_arrival_hitcount`, `bond_secondary_order`, `doll_blind_family`,
  `kingsrock_volley`, `multiaccuracy_address`, `multihit_corners`, `multihit_through_doll`, `sub_clamp`,
  `substitute_roll_address`, `volley_collapse`, `volley_collapse_clamp`, `volley_reactor_count`,
  `spread_secondary_address`, `future_sight_doll`, `gameend_residuals`, `ignore_evasion_move`.
- `test-engine-diff`: **150 of 150 agree**. It exits 3 only because a 150-row run may not republish over the
  6,000-row artifact (the file was not touched). The multi-hit moves are skipped there by design.
- The earlier report's `test-tag-wire` Gooey red is **green** here (104 passed).
- The FIXTURE ILLEGAL lines in `probe_volley_collapse` and `test-multihit-damage-game` come from those probes'
  own fixtures and are not from this pass.

## 7. FILES CHANGED

- `engine/medicham2-browser.js`: 4 knobs and their MEDFAILS/MEDSEEN registry keys; `rollHitsOf(..., lazyOut)`;
  `_maLazy` / `_maArrive` / `_maResolveRest`; the doll walk; the arrival-top block (sleep + accuracy); the
  collapse road; `multiAccLazyUnspent`; `_calledBy` on a called move's queue entry; `_effAbOf` /
  `_lateReactorsOf` (Cursed Body and Poison Touch moved out of `_stepEffects`); `_stepDamagingHitLate` per
  arrival; the interior late payment; `powderImmuneBody` / `statusImmunityRefuses`; the Effect Spore gate.
- `engine/tag_dex.js`: `punishesAttacker.attackerStatusImmunity`.
- `data/tags.json`: **SPLICED, not regenerated** (the worktree has no store). The one new key was added on the
  13 `punishesAttacker` rows, derived from the format by the same regex. A no-op round trip was checked
  byte for byte before writing. `data/abra-tags.js` was rebuilt, and `--check` passes.
- `tests/probe_multihit_reaction_per_arrival.js` (new); `tests/test-mechanics.js` (5 rows, `diceOf`,
  `REALTURN`, `DELIBERATE_BREAK`); `data/mechanics-census.json` (regenerated, 920/0).
- `docs/ENGINE.md`: a new section and its hand list.
- Regenerated by the test runs, and left for the coordinator to keep or drop: `data/tag-consumption.json` and
  `data/verification/engine-diff.n150.json`. `data/provenance-stamp.json` was restored to HEAD, because its
  change came from the worktree (a scratch bench file that is not present here), not from this pass.
- `data/engine-release.json` was restored to its pre-pass content. The worktree's `data/releases/` holds
  `44c6e7407738` and a re-cut event of `a1c7dcd5696b`. Both are gitignored.

## PROPOSED NOTES ROW

| 2026-09-19 | ENGINE: a volley is resolved one arrival at a time, for the whole derived class of 7 legal on-hit chance reactors × 14 legal multi-hit moves. (1) Cursed Body and Poison Touch roll once per ARRIVAL (knob `MEDI_REACT_LATE_ONCE`). (2) A multiaccuracy move's per-arrival accuracy die is drawn at the top of its own arrival, below the previous arrival's reaction dice, which is the authority's order on the shared `any|<move>|<slot>` address (`MEDI_MULTIACC_UPFRONT`). **No `game_differential.js` change; `PIN_DIGEST` `de38d17e15a2` unmoved.** (3) A user put to sleep mid-volley stops (`MEDI_VOLLEY_IGNORES_SLEEP`). (4) Effect Spore throws no die at a powder-immune attacker (derived `punishesAttacker.attackerStatusImmunity`; `MEDI_SPORE_DIE_UNGATED`). `tests/probe_multihit_reaction_per_arrival.js`: 101 of 304 staged games parted on `a1c7dcd5696b`, 0 of 304 on worktree release `44c6e7407738`. The g1950 Cursed Body card replays with no split. Trace on Alakazam (`…2657391947`) was a cascade of Shed Skin's ungated die, already fixed in 6.52.0, and not a Trace defect (shown by a single-game replay under `MEDI_CURE_ROLL_UNGATED`). Census 915 → 920 live / 0 missing (`data/mechanics-census.json`). The three lattices were not re-run. Report `docs/_reports/2026-09-19-cursedbody-trace.md`. **Supersedes.** Nothing published. **Basis.** unchanged — no pin, arm or address definition moved; this changes engine behaviour only. | ENGINE.md (done); white paper engine-status paragraph at the next major |

## OWED, NOT RUN

- **The three lattices** (`--games 1200 / 1350 / 1950`, `--steering empirical --arm middle --end-state --turns 50
  --team-store data/team-pool-frozen`) on a release that holds these bytes. The prediction is that the Cursed
  Body card (`…2635092694`) leaves g1950 and its narration twin leaves g1350, and that nothing joins. The
  one-sided `dmg`/`crit` dice of a truncated volley are the only new exposure. That run belongs to MEASURE or the
  coordinator, and the roster stages and `quarantine.js` go with it.
- **The Trace card's remaining split:** a Future Sight payout into a Focus Sash Kleavor whose booker fainted
  earlier the same turn (g1950 `…2657391947`, turn 6, index 83). Probe first. To reproduce, from the main tree:
  `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release 44c6e7407738 --team-store data/team-pool-frozen --games 1950 --arm middle --config pair-protect-bust --steering empirical --end-state --turns 50 --no-warmup --seed "gen9championsvgc2026regmbbo3-2657391947 vs gen9championsvgc2026regmbbo3-2657358877"`
  (the release has to be cut there first; any tree that is byte-identical gives the same id).
- `engine/tag_dex.js` run on the main tree (with the store), to confirm the splice matches a real run.
- `test-engine-diff --republish-smaller` was not run (deliberately). The 6,000-row artifact was not re-run.
- The accuracy-stage arithmetic difference that `rollHitsOf` already declares (`multiAccStageArith`) is unchanged.
