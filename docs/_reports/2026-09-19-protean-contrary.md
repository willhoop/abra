# 2026-09-19 — Protean / Clear Smog / Contrary / Cud Chew (+ Copycat): five leads, ENGINE

Worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a2e20901f99b1efb7`, based on `07e01c85` (6.52.0).
LIGHT MODE: staged boards and single probes only. No game differential, no full roster stage, no quarantine, no AMF.

| release | what it is |
|---|---|
| `a1c7dcd5696b` | the tree as handed over (identical to the coordinator's 6.52.0 verification release) — the "before" |
| `7d2f95b9c721` | intermediate: four fixes, before Copycat |
| `348acbb747c3` | **final** — every engine byte in this worktree; live `engine/medicham2-browser.js` and `data/abra-tags.js` verified byte-identical to it |

`data/engine-release.json` restored to its pre-session bytes. `data/provenance-stamp.json` untouched. `data/tags.json` untouched.

## Verdicts

| # | lead | verdict | fixed | knob |
|---|---|---|---|---|
| 1 | Protean converts on a status click whose `Try` fails | **TRUE** (a class, 3 native members) | yes | `MEDI_PROTEAN_IGNORES_TRY` |
| 2 | Clear Smog never clears target boosts | **TRUE** | yes | `MEDI_CLEAR_SMOG_KEEPS_BOOSTS` |
| 3 | stat-raising items ignore Contrary | **FALSE for Reg M-B** — no legal item raises a stat | n/a | none |
| 4 | Mold Breaker does not suppress Contrary on the boost road | **TRUE** on every road staged | yes | `MEDI_CONTRARY_UNBROKEN` |
| 5 | Cud Chew's pending berry survives a switch | **TRUE** | yes | `MEDI_CUD_SURVIVES_SWITCH` |
| 6 | (found staging 1) Copycat copies a `failcopycat` move | **TRUE** | yes | `MEDI_COPYCAT_IGNORES_FAILCOPYCAT` |

Probe: `tests/probe_protean_contrary.js` — **42 arms clear on `348acbb747c3`**. On `a1c7dcd5696b` every red arm
reads `DEFECT — the engines part on the board` (leads 1, 2, 4, 5, 6 each run there). Each red arm is parted by its
knob on `348acbb747c3`; no control moved under any knob; every control is separated from its red arm by the
authority (no FIXTURE BLIND). Fixtures are checked legal by `CS.canLearn` (the TeamValidator) and by the
`buildPair` fixture check: 23 sets, 0 illegal.

Census: **915 → 920 live, 0 missing, 0 threw, 0 hollow** (`data/mechanics-census.json`, regenerated in the
worktree). Each of the five new rows reads MISSING under its own knob, one row at a time.

Roster: `tests/roster.js --stage items --only greninjite` — **FIRED-AND-BOARDS-DIFFER 1 on `a1c7dcd5696b`,
FIRED-AND-BOARDS-MATCH 1 on `348acbb747c3`**. (No `--write`; no roster artifact touched.)

Regression checks run on the final engine: `tests/test-tag-wire.js` 104 passed; `tests/probe_move_effect_leads.js
--release 348acbb747c3` 28 arms clear (the Decorate / boost-road arms included); `tests/probe_simple_beam.js`
all checks passed; `tests/test-mechanics.js` 920 of 920.

## 1. Protean and `Try`

Authority (all read this run, no Champions override of protean / libero / sleeptalk / rest / copycat):
- `sim/battle-actions.ts:590-592` (trySpreadMoveHit) and `:826-828` (tryMoveHit):
  `singleEvent('Try') && singleEvent('PrepareHit') && runEvent('PrepareHit')`.
- `data/abilities.ts:3487-3502` protean.onPrepareHit:
  `if (move.hasBounced || move.flags['futuremove'] || move.sourceEffect === 'snatch' || move.callsMove) return;`
- Legal Protean/Libero bodies: Greninja, Greninja-Mega, Meowscarada. No legal Libero body.

Class, derived: legal Status moves with an `onTry` (or `callsMove`) — clangoroussoul, stuffcheeks, auroraveil,
copycat*, followme, magnetrise, noretreat, quickguard, ragepowder, rest, sleeptalk*, stockpile, swallow, wideguard
(* = callsMove). A native Protean body learns **copycat, rest, sleeptalk**. Anyone can acquire Protean through Role
Play (45 learners), Skill Swap (63), Entrainment (22) or Trace (4 holders), so the whole class is reachable in
principle.

Measured before (`a1c7dcd5696b`): Greninja Sleep Talk awake → `normal` here, `dark/water` authority; Greninja
Rest at full HP → `psychic` / `dark/water`; Meowscarada Copycat → `normal` / `dark/grass`. Controls (Protect;
Rest after a Bullet Punch) convert on both. Attack-road checks (Sucker Punch into a Protect, Counter with nothing
taken) already agreed and still do.

Fix (`engine/medicham2-browser.js`):
- `proteanConvert` asks `callsAnotherMove` (membership = the format's `callsMove` set: copycat, sleeptalk) and
  `delayedHit` (= `futuremove`: futuresight). Both memberships were printed against the dex. `hasBounced` and
  `snatch` stay unasked and still counted by `MEDFAILS.proteanGuardsUnmodelled`.
- `tryStepRefuses(m, mvId, field)`, asked only at the status-path call: `sleepMoveRefusesAwake`,
  `healDescriptor.setsStatus` (already that status / full HP — Rest's `onTry`; Recover's full-HP refusal is
  `onHit` and correctly still converts), `berryRequiredAbsent`, `veilWeatherRefuses`. The sleep gate, the Stuff
  Cheeks refusal and the Aurora Veil refusal now call those same helpers, so the predicate and the refusal cannot
  disagree.
- Counters: `MEDSEEN.proteanSkippedCallsMove`, `MEDSEEN.proteanSkippedTryRefused`.

Declared remainder (acquired Protean only): Clangorous Soul's HP floor — its refusal is `onTry` but Substitute's
identical-looking `costsUserHP` floor is `onTryHit` (after PrepareHit, converting is right) and the tag does not
say which stage; Quick/Wide Guard with nobody left to act; Magnet Rise under Gravity; Destiny Bond / Ally Switch's
move-level `onPrepareHit`.

## 2. Clear Smog

`clearsmog.onHit(target) { target.clearBoosts(); this.add('-clearboost', target); }`, no Champions override;
`onHit` is `runMoveEffects` at `data/mods/champions/scripts.ts:375`, above secondaries (`:388`) and `DamagingHit`
(`:410`). Class: legal `clearBoosts()` movers are clearsmog (Special) and haze (Status, already handled).

The only reader of `clearsBoosts` was the status router (`{kind:'haze'}`); a damaging move never reaches it.
Before: Snorlax Curse (+1/+1/-1) then Clear Smog — here unchanged, authority 0/0/0. Control Sludge Bomb keeps them
on both. Fix at the head of `_stepEffects`; a doll-absorbed row returns before it (`R.out`, no `R.hit`) — the
`check-sub` arm agrees on both engines. Counter `MEDSEEN.clearsBoostsOnHit`. `-clearboost` is not a compared
protocol event (the probe reads the authority's RAW log for its outcome).

## 3. Items × Contrary — FALSE

148 legal items; walked every own function on each for `boost(` and the `boosts` field. The only hit is White
Herb (`setBoost`, a restore — no ChangeBoost). Weakness Policy, Electric Seed, Liechi Berry, Throat Spray,
Adrenaline Orb and Room Service all print `isNonstandard: 'Past'`. There is nothing in Reg M-B that could hand a
Contrary holder an item boost, so no fixture can be built and nothing was changed. Printed on every probe run as
lead `itemboost`.

## 4. Mold Breaker × Contrary

`contrary` is `flags: {breakable: 1}`; Mold Breaker is `onModifyMove(move) { move.ignoreAbility = true; }`;
`sim/battle.ts` runEvent skips a breakable handler under `suppressingAbility`. No Champions override.

Before: Excadrill (Mold Breaker) Bulldoze → Contrary Malamar spe +1 here, -1 authority; Tinkaton Fake Tears spd
+2 / -2; Pangoro Parting Shot atk/spa +1/+1 / -1/-1. Controls (same species on Sand Rush / Own Tempo / Iron Fist)
+1/+2/+1 on both. (Rock Tomb was the first secondary fixture and missed at the top accuracy corner on BOTH engines
— a blind arm, replaced by Bulldoze.)

Fix: `invSign(x, src, cat)` — when a move of `src` lands the change on a different body, the ability is read
through `suppressedAbility(src, x, cat)` (the one reader with the Ability Shield / category clauses). Callers
passing the source: `boostTableOnto` (affect, boostally, the composed rider), the attack secondary's target drop,
the pivot drop, `statOp` (Acupressure). The last is edited but not staged. A body's own change is never
suppressed. Counter `MEDSEEN.contraryBrokenBySource`. Simple goes through the same clause (no legal carrier
except via Simple Beam).

## 5. Cud Chew

`cudchew.onEatItem` writes `this.effectState.berry/counter` — the ABILITY's state, rebuilt at `switchIn`
(`sim/battle-actions.ts:142`). Before: Farigiraf eats a Sitrus on turn 1, benched turn 2, back turn 3 — here
141 HP (re-ate), authority 93. Control (stays in) re-eats on both. Fix: `switchOut` clears `_cud` beside
`_proteanUsed`. Counter `MEDSEEN.cudChewDroppedAtSwitch`.

## 6. Copycat (new)

Found because the Protean Copycat arm still parted after the Protean fix: the engine's Copycat CALLED Protect.
`copycat.onHit`: `if (move.flags['failcopycat'] || move.isZ || move.isMax) return false;`. The engine's
`lastMove` source asked `TAGS.has('move', _src, 'noCopycat')` — 0 members in `data/tags.json`, the exact dead
lookup the Sleep Talk pool filter beside it had already been rescued from. 27 moves carry `failcopycat` in the
artifact (Protect, Detect, Endure, Follow Me, Rage Powder, Helping Hand, Trick, Roar, Counter, Feint …). Before:
Meowscarada (Overgrow) Copycats after a Protect and takes 0 from a slower Body Slam (the copied Protect blocked
it); authority: hit. Fix: `callRefusedFlag(refuses, mvId)` shared by both sources.

## Scoreboards

Said before the runs: the LAB should move (census +5, the Greninjite roster row), and did. The pinned pool is
expected to move little or not at all — Protean bodies clicking Rest / Sleep Talk / Copycat, Clear Smog (45
sheet uses), a Mold Breaker attacker into a Contrary body (the pool held zero Malamar on 2026-08-23) and a
Cud Chew holder benched with a helping pending are all rare. **Not measured** — no pool or lattice run here.

## Files changed

- `engine/medicham2-browser.js` — the five fixes, five knobs, their MEDFAILS stamps and MEDSEEN counters;
  helpers `tryStepRefuses`, `sleepMoveRefusesAwake`, `berryRequiredAbsent`, `veilWeatherRefuses`,
  `moveCategoryName`, `callRefusedFlag`.
- `tests/probe_protean_contrary.js` — new, six leads, 42 arms.
- `tests/test-mechanics.js` — five census rows; the five knobs added to the census write-refusal list (the Protean
  knob WROTE the census on its first red run before it was listed; regenerated clean afterwards).
- `data/mechanics-census.json` — regenerated, 920 live.
- `docs/ENGINE.md` — new section and hand list (outside the GENERATED block), probe added to the Owns list.

## PROPOSED NOTES ROW

```
| 2026-09-19 | <<VER>> | **ENGINE: Protean respects the move's `Try`, Clear Smog clears, Mold Breaker breaks Contrary on the boost road, Cud Chew's pending helping dies at a switch, Copycat refuses a `failcopycat` move.** Five real defects, each red on release `a1c7dcd5696b` and fixed on `348acbb747c3` (`tests/probe_protean_contrary.js`, 42 arms; knobs `MEDI_PROTEAN_IGNORES_TRY`, `MEDI_CLEAR_SMOG_KEEPS_BOOSTS`, `MEDI_CONTRARY_UNBROKEN`, `MEDI_CUD_SURVIVES_SWITCH`, `MEDI_COPYCAT_IGNORES_FAILCOPYCAT`). The Greninjite roster row reads MATCH (was the one items FIRED-AND-BOARDS-DIFFER). Item boosts onto Contrary: FALSE — no legal item raises a stat. Census 915 → 920 live, 0 missing (`data/mechanics-census.json`). **Supersedes.** The items-stage count "147 MATCH / 1 DIFFER" on `74be319d02fa` once the stage is re-run. **Basis.** unchanged. **Owed.** The three lattices, the items stage, AMF and the damage diff on the new release; fold into `docs/ABRA-technical-docs.md` at the next major. | `docs/_reports/2026-09-19-protean-contrary.md` |
```

## OWED, NOT RUN

1. **The three lattices (`--games` 1200 / 1350 / 1950), the full items stage, AMF and the damage diff on
   `348acbb747c3` (or the merged release).** Light mode forbade them. Expected: items DIFFER 1 → 0; lattices
   probably unmoved. Not measured.
2. **Whether any pinned-pool game carries one of these five** (a Protean body clicking Rest / Sleep Talk /
   Copycat, a Clear Smog into a boosted body, a Mold Breaker drop onto Contrary, a Cud Chew holder benched with a
   helping pending, a Copycat after a `failcopycat` move). Unmeasured.
3. **Protean declared remainder** (acquired Protean only): Clangorous Soul's `onTry` floor, Quick/Wide Guard
   last, Magnet Rise under Gravity, Destiny Bond / Ally Switch `onPrepareHit`, `hasBounced` / `snatch`.
4. **Cud Chew, not checked:** the `if (!this.queue.peek()) counter--` case (berry eaten during residuals) and the
   `effectState` rebuild on a mid-battle ability change (`sim/pokemon.ts:1930`) for `_cud` and `_proteanUsed`.
5. **Mold Breaker, not staged:** the `statOp` road (Acupressure onto a Contrary ally) is edited and unstaged;
   `applyStatDrop` roads are unchanged (no Mold Breaker move reaches them onto another body).
6. **`data/tags.json` / `data/abra-tags.js` untouched** — no tag shape changed. A Clangorous Soul fix would need a
   stage field on `costsUserHP`, which is a `tag_dex.js` change and a regeneration.
7. CHANGELOG, `docs/RUNNING-NOTES.md` and `node engine/status.js --write` left to the coordinator per the brief.
