# Narration, line order and per-hit (batch B) — 2026-09-19, ENGINE (light mode)

A findings record, not a living document. It is superseded by the register rows it feeds. Do not cite it as
current state. `node engine/status.js` holds the current state.

---

## 0. VERDICT

- **The 14 "different order" games have 11 mechanisms.** 7 are fixed here (8 games). 1 was already fixed by
  6.54.0 (1 game). 3 are **exact speed ties** (5 games). They are recorded below and not changed, because a tie
  is Will's call.
- **The 2 per-hit games.** Cursed Body on Triple Axel was already fixed by 6.54.0. Dragon Darts into a
  semi-invulnerable body is **fixed here**.
- **8 mechanisms fixed. Each has a knob and a two-engine red/control arm.** The probe is
  `tests/probe_narration_b_line_order.js`, 16 arms:
  - It reads **PASS** on the fix release `e17925e5e8c9`.
  - It reads **FAIL on all 8 red arms** on the pre-fix release `8a4140de3eaa`.
  - No knob moves a control.
- **Every fixed pool game replays clean.** 8 of the 9 targeted games now have **no protocol divergence**. Their
  boards held at every boundary. The ninth (the Life Dew game `…2635082691`) moved from line 133 to 225, where
  it hits a new mechanism: a `-boost|spa|0` at the +6 cap. It is listed under open items.
- **No joins in the sample I ran.** 527 games were replayed on the pre-fix release and on a fix release: pairs
  0–67 of each configuration at --games 1950. The only changes were the two targeted games that happen to sit
  inside that sample, and both went to no divergence. No board parted on any release. The 41 lattice
  first-divergence games: every one I did not target is byte-identical in its first divergence.
- **Census 925 → 933 live, 0 missing, 0 hollow.** With all eight knobs set, the run reads 925 live / 8 missing.
  The 8 missing rows are exactly the new ones. Under the knobs the census refuses to write.
- **One fix changes a board, and that is a correctness gain.** The pivot White Herb fix changes the board in the
  Intimidate shape. Under the old order, the herb also cleared the entrant's Intimidate drop. The authority
  leaves −1. The probe's red arm shows `board PARTED t1` under the knob and a held board with the fix.

## 1. PINS

| pin | value |
|---|---|
| pre-fix release | `8a4140de3eaa` (HEAD `86ccc49e`, 6.54.0). I re-cut it in this worktree before any edit |
| fix release | `e17925e5e8c9`. I cut it in this worktree. An identical-tree re-cut returns the same id |
| intermediate | `7d9565cdaf8d` (the first seven fixes, before Berserk). I used it only for interim replays |
| team store | `--team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (the main tree's absolute path). Pool `a5ce76242f8d` at --games 1950, which matches the 1950 artifact |
| flags | `--games 1350` or `1950` (each game at its own lattice's size), `--arm middle --steering empirical --end-state --turns 50`, and no warm-up |
| census | not pinned. Under empirical steering the census is CREDITED ONLY and does not select |
| reproduction | on `8a4140de3eaa`, 36 of the 41 first-divergence games reproduced the artifact's `agreed_lines` exactly. The other 5 all differ because of known changes (see below) |

The five games whose replay differs from the `a1c7dcd5696b` artifact on `8a4140de3eaa` (6.54.0) are:

- Three show **no protocol divergence** because 6.54.0 fixed them: `…2654469023` (Cursed Body at g1350), the
  board-material `…2635092694` (Cursed Body at g1950), and `…2635518198` (Poison Point on a multi-hit).
- `…2656799052` moved 23 → 25. It is the declared `fallenundefined` row.
- `…2662455751` moved 93 → 88. It is a Roost row, in the other agent's bucket.

Tools used (in the session scratchpad, written this session):

- `inspect.js` plays one lattice game with no warm-up. It dumps the authority's sorted residual, switch-in and
  `eachEvent` lists, with speeds, fainted flags and volatiles.
- `batch.js` replays the 41 first-divergence games, one process per game.
- `joincheck.js` is the join sentinel.

## 2. THE FOURTEEN LINE-ORDER GAMES, BY MECHANISM

| mechanism | games (lattice, config, seed, turn) | authority's rule, read | verdict |
|---|---|---|---|
| **Life Dew: refusals before heals** | 1950 omit-weather `…2634231341` t3; 1950 pair-redirect-priority `…2635082691` t10 | `trySpreadMoveHit` is step-major: `hitStepTryHitEvent` (Good as Gold, Water Absorb `-immune`) runs for every target before `hitStepMoveHitLoop` heals any | **FIXED** |
| **mega above a +6 Helping Hand** | 1350 pair-redirect-priority `…2660691219` t7 | megaEvo is queue order 104 and every move is 200. `comparePriority` reads order before priority. Prankster Helping Hand is +6 | **FIXED** |
| **Speed-Swapped corpse refill order** | 1950 pair-speedctrl `…2663429418` t4 | the corpse's `clearVolatile` → `setSpecies(baseSpecies)` (champions scripts.ts:176) recomputes `storedStats`, so the swap is undone. Measured: after a Speed Swap by Alakazam, Heracross-Mega refills after Overqwil | **FIXED** |
| **broken shield deletes `stall`** | 1950 pair-protect-bust `…2634665687` t6 | `hitStepBreakProtect`: `if (gen >= 6) delete target.volatiles['stall']` (battle-actions.ts:775). The authority's turn-6 residual list had no Falinks `stall` (printed). With no follower, the perish faint lands below `|upkeep|` | **FIXED** |
| **lock end at AfterMove when shielded** | 1950 omit-weather `…2659688578` t11 | `useMove` raises AfterMove whatever `useMoveInner` returned. `lockedmove.onAfterMove` (dur 1) → `onEnd` → fatigue under the Protect line | **FIXED** |
| **pivot White Herb (Champions)** | 1950 pair-protect-bust `…2654135529` t8 | champions items.ts:1023. `onAnyAfterMove` queues `{choice:'event', event:'WhiteHerb', order: 99}`. A pivot's entrant is `|switch|` now plus `runSwitch` at 101, so the herb lands between them | **FIXED** (board-material in the Intimidate shape) |
| **Berserk below the recoil** | 1950 omit-intimidate `…2656439218` t3 | `boostsAtHPThreshold` is `onAfterMoveSecondary` (scripts.ts:577), below `applyRecoilDamage` and the second in-move Update | **FIXED** |
| **Poison Point on a multi-hit** | 1950 pair-protect-bust `…2635518198` t5 | per-arrival reactions | already fixed by **6.54.0** (div null on `8a4140de3eaa`) |
| **volatile INSERTION order in a tied residual group** | 1950 baseline `…2634548064` t3 (Metagross-Mega 178 = Sneasler 178); 1950 baseline `…2635249755` t8 (Raichu 200 = Mr. Rime 200); 1950 pair-redirect-priority `…2654068794` t18 (Salt Cure and Infestation, both order 13, one body) | `speedSort`'s swaps with identity shuffle, over handlers collected in `pokemon.volatiles` insertion order. Our shadow list emits volatiles in the artifact's row order, which is its declared approximation (1) | **EXACT TIE — recorded, not touched** |
| **a fainted body in the weather sort** | 1350 baseline `…2660691219` t1 (Incineroar 112 = Sinistcha 112) | `eachEvent('Weather')` sorts `getAllActive()`, which excludes the fainted Simipour (157, printed). `residualOrder` builds `[...actA,...actB]` with the corpse still in the slot (from reading the code), so its swap carries Sinistcha past Incineroar | **EXACT TIE — recorded** |
| **Update order of two same-speed Sitrus holders** | 1350 omit-intimidate `…2635337217` t4 (both Basculegion cached 109) | `eachEvent('Update')` sorts on the cached `pokemon.speed`. It includes Kingambit at 0 HP (not yet `fainted`), and Rotom's swap puts p2a first (printed) | **EXACT TIE — recorded** |

**About the ties.** The differential pins Showdown's shuffle to the identity. So each of these five games has a
deterministic answer on the authority, set by the selection sort's swap history. Our engine models that history
for bodies and handlers. It gets these wrong on the inputs to the sort: the collection order, and which bodies
are in the list. The memory note `speed-ties-are-unfixable` was RETRACTED on 2026-08-24, and it says such rows
are real turn-order defects. This brief says a tie is Will's decision, so I recorded them and did not change
them. The fixes, if he wants them, are these:

- **Insertion order.** Stamp an insertion order on each body's volatiles and emit the shadow list in that order.
  This covers ~28 named volatile fields and is not a one-line change.
- **Fainted body in the weather sort.** Drop fainted bodies from the weather group's sort. This is one line, but
  it needs care, because the perish zombies are included on purpose.
- **Update order.** Order `_updateEvent` on the cached speed, over the not-yet-drained corpses.

## 3. THE TWO PER-HIT GAMES

| mechanism | game | verdict |
|---|---|---|
| Cursed Body rolls per hit on Triple Axel | 1350 pair-speedctrl `…2654469023` t6 | already fixed by **6.54.0**. It is div null on `8a4140de3eaa`, as is the board-material Cursed Body game `…2635092694` |
| **Dragon Darts writes `-miss` at a semi-invulnerable body** | 1950 pair-protect-bust `…2662428145` t4 | **FIXED**. `hitStepInvulnerabilityEvent` does `if (move.smartTarget) move.smartTarget = false; else add('-miss')`. The one-shot is `_smartSpent`, the same flag the shield loop spends |

## 4. THE FIXES — `engine/medicham2-browser.js`

| # | site | knob (stamp) | census row |
|---|---|---|---|
| 1 | heal branch, `_hp.allies`. Refusals are collected first, then `amt()` over the survivors | `MEDI_ALLIES_HEAL_INTERLEAVED` (`alliesHealInterleavedRestored`) | move `healsAlly` |
| 2 | `_phasesDue` changes from `_pri < 6` to `sdChoiceOf(...) !== 'switch'` | `MEDI_MEGA_GATE_ON_PRIORITY` | ability `priorityMod` |
| 3 | `_corpseSpe` reads `_stRewireBase.sp` | `MEDI_CORPSE_SPEED_KEEPS_REWIRE` | move `rewritesStoredStats` |
| 4 | break-protect step: `_stallFresh = false` beside the counter reset | `MEDI_BREAK_KEEPS_STALL_FRESH` | move `breaksProtect` |
| 5 | AfterMove lock debt: `_lockAfterMove` is marked at the onTry site, settled by the resolved road or by `flushAfterMoveSpends` → `lockEndAtAfterMove`, and cleared at the turn foot | `MEDI_LOCK_END_NEEDS_HIT` | move `locksIntoMove` |
| 6 | `PIVOT_DEPTH` in `pivotFrom` (independent of the trace), and `pivotHerbSweep` right after the entrant's `|switch|` in `bringIn` | `MEDI_PIVOT_HERB_AFTER_ENTRY` | item `restoresStats` |
| 7 | invulnerability step: `_smartSplit && !_smartSpent` → silent | `MEDI_SMART_INVULN_MISS_LINE` | move `smartTarget` |
| 8 | `_stepHpThresholdBoost` collects into `_hptAtEvent`, which is paid at the Pickpocket (`AfterMoveSecondary`) site | `MEDI_HP_THRESHOLD_BOOST_ABOVE_RECOIL` | ability `boostsAtHPThreshold` |

**Why fix 8 moves no board.** Berserk reads the target's HP and the move's damage. The recoil is the attacker's.
The second in-move Update can only settle what `_stepUpdate` already settled for the target. So the crossing
test sees the same numbers at both sites. `defersHealingBerry` is still not branched on, and it was not before
either (see open items).

**Knob hygiene.** All eight knobs are stamped at load and listed in `tests/test-mechanics.js`
`DELIBERATE_BREAK`.

## 5. EVIDENCE

**Probe, fix release `e17925e5e8c9`: PASS, 16 arms.** The knob column is the first divergence under that
mechanism's knob:

| arm | red: knob parts at | control under knob |
|---|---|---|
| lifedew (Blastoise + Gholdengo) | 12 `-immune\|p1b: Gholdengo` <> `-fail\|p1a: Blastoise\|heal` | none |
| megahh (Meowstic Prankster + Abomasnow) | 6 `detailschange\|p1b: Abomasnow` <> `move\|p1a: Meowstic\|helpinghand` | none |
| corpse (Alakazam swaps Clefable; Clefable HW + Gallade Memento) | 16 `switch\|p2b` <> `switch\|p2a` | none |
| perish (Azumarill; Blaziken Feints Aggron's Protect) | 65 `upkeep` <> `faint\|p1a` | none |
| lock (Sceptile Outrage; Snorlax/Rhyperior Protect) | 22 `confusion\|[fatigue]` <> `move\|p1b` | none |
| herb (Incineroar Parting Shot; Arbok/Arcanine Intimidate; Aggron White Herb) | 11 `-enditem\|White Herb` <> `-unboost`, **board PARTED t1** | none |
| darts (Dragapult; Snorlax Dig; Rhyperior) | 18 `-damage\|p2b` <> `-miss\|p1a…p2a` | none |
| berserk (Drampa; Aggron Double-Edge / control Mega Kick) | 35 `Recoil` <> `-boost\|spa` | none |

Every clean arm has no protocol divergence and a held board. The fixture species are derived from the format and
printed. `buildPair`'s fixture check reports 0 illegal.

**Probe, pre-fix `8a4140de3eaa`: FAIL, 8 of 16.** It is exactly the 8 red arms, with "the protocol parts with
the fix in". All 8 controls are OK.

**Pool games on `e17925e5e8c9`** (41-game replay, diffed against `8a4140de3eaa`):

- Protocol divergence is now none for `…2660691219` (pair-redirect-priority), `…2659688578`, `…2634231341`,
  `…2656439218`, `…2654135529`, `…2662428145`, `…2634665687` and `…2663429418`.
- `…2635082691` moved 133 → 225.
- Every other game's first divergence is unchanged.
- Board-material games: `…2636045527` (Sucker Punch, t15) and `…2657391947` (Future Sight / Sash, t6) are
  unchanged and are not mine.

**Join sentinel.** All at --games 1950.

- Pairs 0–7 of all nine configurations (67 games), on `8a4140de3eaa` and on `7d9565cdaf8d`: identical, and none
  diverged.
- Pairs 8–67 (460 games), on `8a4140de3eaa`, `7d9565cdaf8d` and `e17925e5e8c9`: 5 diverged on the pre-fix
  release and 3 on `e17925e5e8c9`. The only changes are `…2654135529` (herb, on both fix releases) and
  `…2656439218` (Berserk, on `e17925e5e8c9`). Both go to div null.
- 0 boards parted on any release.

**Census.**

- Before: 925/925 live (`2026-09-19T07:46:20Z`).
- After: 933/933 live, 0 missing, 0 threw, 0 hollow, run_ok true.
- All eight knobs set: 925 live / 8 missing (exactly the 8 new rows), census write REFUSED.
- `node engine/status.js` prints `933/933 probed mechanics live, 0 missing`.

## 6. FILES CHANGED (worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-aa1449e4c4f9faa8e`)

- `engine/medicham2-browser.js`: the eight fixes, the knob block beside `REPLACE_ORDER_STABLE`, and the MEDSEEN
  and MEDFAILS keys.
- `tests/test-mechanics.js`: eight census rows (after the Copycat row), plus eight `DELIBERATE_BREAK` names.
- `tests/probe_narration_b_line_order.js`: new, 8 mechanisms × red/control.
- `data/mechanics-census.json`: regenerated.
- `docs/ENGINE.md`: one section, plus the probe added to the Owns list.
- This report.

These were not touched: CHANGELOG.md, docs/RUNNING-NOTES.md, and `status.js --write`. There was no git command
that writes: no add, commit or stash. `data/engine-release.json` was restored to its HEAD bytes. A plain
`status.js` run rewrote `data/provenance-stamp.json` as a ratchet side effect. I restored that file to HEAD.
The releases `8a4140de3eaa`, `7d9565cdaf8d` and `e17925e5e8c9` sit in this worktree's ignored `data/releases/`.

## PROPOSED NOTES ROW

```
## [<<VER>>] — 2026-09-19 — narration line order: seven mechanisms fixed (eight pool games) and Dragon Darts' invented -miss; five tie games recorded
- **What changed.** `engine/medicham2-browser.js`, eight fixes, each behind its own knob. (1) Life Dew announces every partner's TryHit refusal before any heal (`MEDI_ALLIES_HEAL_INTERLEAVED`). (2) The mega phase waits for the switches, not for a bracket below 6, so a Prankster Helping Hand no longer runs above the megaEvo action (`MEDI_MEGA_GATE_ON_PRIORITY`). (3) A Speed-Swapped corpse queues its replacement on its own stored Speed (`MEDI_CORPSE_SPEED_KEEPS_REWIRE`). (4) A broken shield takes `stall` with it, so a perish drain can land below `|upkeep|` (`MEDI_BREAK_KEEPS_STALL_FRESH`). (5) A shielded or missed last locked turn ends the lock and fatigues at AfterMove (`MEDI_LOCK_END_NEEDS_HIT`). (6) Champions' queued White Herb is spent between a pivot's `|switch|` and its entrant's SwitchIn. This changes the board when the entrant has Intimidate (`MEDI_PIVOT_HERB_AFTER_ENTRY`). (7) A split Dragon Darts spends smartTarget silently at a semi-invulnerable body (`MEDI_SMART_INVULN_MISS_LINE`). (8) Berserk is paid at AfterMoveSecondary, below the recoil (`MEDI_HP_THRESHOLD_BOOST_ABOVE_RECOIL`). New probe: `tests/probe_narration_b_line_order.js` (16 arms). It passes on `e17925e5e8c9`, and all eight red arms are red on `8a4140de3eaa`. Five lattice games are exact speed ties (volatile insertion order ×3, a fainted body in the weather sort, same-speed Sitrus holders). They are recorded, not touched.
- **Measured.** Census **925 -> 933 live, 0 missing**. Single-game replays (no warm-up, empirical steering, pinned team store) on `e17925e5e8c9`: 8 of the 9 targeted pool games have no protocol divergence and every board held. `…2635082691` moves 133 -> 225. A 527-game sentinel at --games 1950 changes only the two targeted games inside it. Lattices NOT re-run (light mode).
- **Basis.** unchanged.
- **Supersedes.** ~~925 live~~ (6.54.0 row), now 933.
- **Owed to the next major.** Technical docs mechanics list. OWED, NOT RUN: the three lattices and roster stages on `e17925e5e8c9`. Report: `docs/_reports/2026-09-19-narration-b.md`.
```

## OWED, NOT RUN

1. **The three lattices (1200 / 1350 / 1950) and the three roster stages on `e17925e5e8c9`.** Predicted
   undeclared narration, before any join:
   - **1350: 11 → 9.** The mega/Helping Hand game goes, and 6.54.0's Cursed Body game goes.
   - **1950: 24 → 16.** Seven of mine go, and 6.54.0's Poison Point game goes. The Life Dew game `…2635082691`
     stays on the Electro Shot line.

   Predicted board-material: **0 / 1 / 1**. The 1950 Cursed Body game goes, fixed by 6.54.0. The Sucker Punch
   (1350) and Future Sight/Sash (1950) games stay.

   Joins are possible, because fixes 5 and 6 change what a game can reach. The pivot-herb fix is board-material
   in the Intimidate shape. It was not seen in the 527-game sentinel, but a lattice may contain it.
2. **The five tie games.** They are Will's call. If he says fix them, the three changes are in §2. Insertion order
   is the only one that is not a small change.
3. **Electro Shot (a move's own `boost()` at +6 writes `-boost|spa|0`).** It is the next split of
   `…2635082691`, at t16. Not investigated beyond the line. It may belong to the refusal/announcement bucket.
4. **`defersHealingBerry`.** Berserk's `onTryEatItem` holds a pinch berry until the boost. It is still not
   branched on. It is a likely board defect on a Berserk holder with Sitrus. Unstaged.
5. **Edges of fix 6, declared in the code.** Two herb holders owed a clear on one pivot are spent in slot order,
   where the authority sorts by Speed. Eject Button and Emergency Exit take the old road.
6. **Edge of fix 3.** A body that is Speed-Swapped and then mega-evolves keeps a pre-mega `_stRewireBase`.
   Unstaged.
7. **The CHANGELOG entry, the notes row above, and `status.js --write`.** These belong to the coordinator.
