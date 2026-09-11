# 2026-09-10 — the engine defects the speed-tie corner arms exposed

ENGINE division. Historical record (see CLAUDE.md on `docs/_reports/`): not maintained, not current state.

## Verdict

| cluster | verdict | what moved |
|---|---|---|
| Mimikyu crits (bottom corner, 4 games) | **FIXED** — plus a second defect the probe found (Disguise absorbed a hit on its own Substitute) | bottom **15 → 11 of 961** |
| Parting Shot accuracy (top, 1 game) | **FIXED** | top −1 |
| Future Sight payout accuracy (top, 1 game) | **FIXED** | top −1 |
| Heat Wave pair (top, 2 games) | **FIXED** — the dumped input named the rule: Flash Fire's `onTryHit` writes `move.accuracy = true` on the shared move | top −2 |
| Encore (top, 5 games) | **PROBED, NOT FIXED** — mechanic confirmed, formatting reading refuted; registered as ROADMAP #580 | nothing |

Corner arms, board-material (`state.games` less `state.games_board_never_diverged`), every run with
`--census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state`, 961 games:

| engine | top-tie-first | bottom-tie-first | source |
|---|---|---|---|
| `8ac9c4d888f1` (HEAD artifact) | 16 | 15 | `git show HEAD:data/verification/game-differential-{top,bottom}-tie-first.json` |
| `3c2b2f9ac845` (today's pre-fix engine) | 16 | 15 | run logs only — the artifact write failed, see §7 |
| `ca2be14649f0` (batch 1) | 16 | **11** | overwritten by batch 2; figures from the run and the seed diff below |
| `cee38e7e9891` (batch 2) | **12** | **11** | `data/verification/game-differential-{top,bottom}-tie-first.json` |

Seed diff against HEAD, capped `first_board_divergences` lists (both arms carry every board-material game, 16 and 15 ≤ 40):
- batch 1, bottom — left: `…2658446009`, `…2656940771`, `…2659986881`, `…2655157363` (the four busted-Mimikyu games); **new: none**. Top: identical seed set, identical `classes`, identical `coverage`.
- batch 2, top — left: `…2634132571` (Parting Shot), `…2657333637` (Future Sight), `…2659430913`, `…2655570367` (Heat Wave); **new: none**. Protocol-diverged games: top 25 → 22, bottom 33 → 28.

Gate on `cee38e7e9891`: **OPEN — 9 of 9 gating clauses pass** (`engine/quarantine.js`, 2026-09-11T01:19Z). Census: **835 → 839 live, 0 missing, 0 hollow, 0 threw** (`data/mechanics-census.json`, 2026-09-11T01:32:04Z).

Releases cut, in order: **`9c7e1f2710eb`** (batch 1, first cut — superseded before it was measured, because its own probe found the doll defect), **`ca2be14649f0`** (batch 1, measured), **`cee38e7e9891`** (batch 2, measured; equals the live tree on the three frozen engine/tag files, checked line-ending-blind before engine-diff ran). None is tracked in git.

## 1. Mimikyu — the crit refusal was the ability's, and the authority's is the handler's

**Authority.** The crit die is drawn in `getDamage` (`sim/battle-actions.ts:1637-1643`) and offered to `runEvent('CriticalHit')` (`:1645-1647`). `disguise.onCriticalHit` (mainline `data/abilities.ts:969-979`; the Champions override at `data/mods/champions/abilities.ts:14-33` replaces `onEffectiveness` only) returns `false` only for species `mimikyu`/`mimikyutotem`, and returns undefined when the hit is on a Substitute. The pre-diagnosis held on every line re-read.

**Pool.** `engine/replay_one.js` on all four bottom games: every one is a `|detailschange|…|Mimikyu-Busted` followed by the authority's `|-crit|` on that body. None is the doll or the volley case. A fifth, protocol-only card (`…2635223573`) is the same shape.

**Probe.** `tests/probe_disguise_crit.js`, under `bottom-tie-first`, four arms: INTACT (control), BUSTED, DOLL, VOLLEY (Dual Wingbeat). RED on `3c2b2f9ac845`: BUSTED `-crit` 1/0 and `mimikyu.hp` 103/98, DOLL `-crit` 1/0, VOLLEY `-crit` 1/0 and `hp` 81/63; INTACT agreed.

**Fix.** `engine/tag_dex.js`'s `preventsCrit` now derives `conditional`, `onlySpecies` and `notThroughSub` from the handler source (Battle Armor and Shell Armor are the literal `false` → `conditional: false`). `critRefusedBy` reads them; `critChance` takes an `opts.formeBrokeEarlier`, and the arrival loop asks it for arrivals 2+ of a volley into an intact `formeOnHit` body. The repricing gate moved from `_cc>0&&_cc<1` to `_cc<1`, identical for every non-Disguise click. Every blind fallback is counted (`MEDFAILS.preventsCritShapeUnknown / NoBody / NoSpecies`). `data/tags.json` regenerated: **only the three `preventsCrit` rows changed.**

**The second defect.** On `9c7e1f2710eb` the probe went green on every arm except DOLL's board: `vol.substitute` 32 here, 16 in the authority, on the pre-fix engine as well. `formeOnHitAbsorbs` never asked the doll, so `dmgRange` priced a hit on Mimikyu's Substitute at zero. Disguise's absorb is `onDamage`, which a hit on the doll never raises (`data/mods/champions/scripts.ts:342`). Fixed in the same batch — `formeOnHitAbsorbs(tg, att, mvId)` asks `subBlocks`, all six callers pass the attacker and move — and the release was re-cut as `ca2be14649f0`. No pool game stages it, so it cannot touch the corner count.

**Knobs.** `MEDI_PREVENTSCRIT_ABILITY_ONLY=1`, `MEDI_FORMEONHIT_THROUGH_DOLL=1`. The probe runs each in its own child; each child reproduces exactly its defect. Green on `ca2be14649f0` and again on `cee38e7e9891`.

**Receipts.** BUSTED `critRefusalLiftedBySpecies` +3, DOLL `critRefusalLiftedBySub` +3 and `formeOnHitDollTookIt` +3 (0 on every other arm), VOLLEY `critRefusalLiftedAfterBreak` +1, `preventsCritShapeUnknown` and `NoBody` 0 on every arm.

**Prediction.** bottom 11, interval [11, 12]; top unchanged (`data/verification/_prediction-2026-09-10-corner-fixes.json`). **Measured: 11 and 16.**

## 2. The accuracy roads

**Parting Shot.** Replay of `…2634132571`: the Whimsicott holds Bright Powder; the authority writes `[miss]` and `-miss`, medicham2 dropped and pivoted. The semi-invulnerable half of the pre-diagnosis is **refuted from source**: `actionMoveId` returns the pivot's move, so the generic non-attack step 0 already refuses a charging target. Only step 4 was missing. Fixed in the pivot branch, below the shield / try-hit / move-class refusals and above the drop, through `hitChance` and `accMustRoll`; `_bsrc` is the user, so a bounced Parting Shot rolls as the bouncer's move.

**Future Sight.** Replay of `…2657333637`: the Talonflame holds Bright Powder and Reuniclus has left the field; the authority writes `-end` and then `|-miss|p2: Reuniclus|p1a: Talonflame`. Fixed inside the payout's address window, above the crit and damage draws (a miss spends neither). New trace method `missFrom` names an off-field booker side-only from the party, the `hitcount` corpse rule's shape.

**Heat Wave — the input named the rule.** `hitStepAccuracy` and `trySpreadMoveHit` were wrapped in the authority via a `node -r` preload on `engine/replay_one.js`. In both games one of Heat Wave's two targets was Ceruledge with Flash Fire, and the authority reached step 4 with **`accuracy true`** and drew nothing (`randomChance calls: []`); every other Heat Wave in the same runs reached step 4 at 90. Flash Fire's `onTryHit` writes `move.accuracy = true` before `return null`, on the click's one `ActiveMove`. Membership over the legal format, printed before wiring: **Flash Fire only** (9 legal holders). New tag `absorbMakesClickSure {onType: 'Fire'}`; `data/tags.json` regenerated, **only `flashfire` changed**. medicham2: a click-level flag set in `_stepTryHit`'s absorb block and read by `_stepAccuracy`; `_walk` is step-major (`for (_step of steps) for (R of _rows)`), the authority's order.

**Probe.** `tests/probe_accuracy_roads.js`, under `top-tie-first`, nine arms (PS-CONTROL/POWDER/EVASION, FS-CONTROL/POWDER/EVASION/BENCHED, HW-CONTROL/FLASHFIRE), every red on the same body as its control. RED on `ca2be14649f0` on all six red arms, controls agreeing. GREEN on `cee38e7e9891` with the counters exact: one pivot die per Parting Shot arm, missed on the two reds; one payout die per Future Sight arm, missed on the three reds; `accTrueByTryHit` +1 on HW-FLASHFIRE and 0 on its control; `traceBodyOffField` 0. Knobs `MEDI_PIVOT_NO_ACCURACY=1`, `MEDI_DELAYED_HIT_NO_ACCURACY=1`, `MEDI_ABSORB_ACC_LOCAL=1`, together in one child that reproduces every red.

**Prediction.** top 14, interval [14, 15] for Parting Shot and Future Sight, written before the Heat Wave dump named its rule. **Measured: 12** — the extra two are exactly the Heat Wave seeds.

## 3. Encore — probed, registered, not fixed

`tests/probe_encore_pp_end.js` (read-only; `--assert` exits 1 while the engines part). **The first two runs of the probe were wrong, not the engine**: the slot carries `maxpp = pp × 8/5` (8 for a 5-PP move), so four Protects left 4 PP, not 1; and a Protect run cannot carry the case because the seventh alternating Protect succeeds and blocks the Encore. The run-out move is now a derived 5-PP weather move (Rain Dance), which fails harmlessly on a repeat and still spends PP.

On `cee38e7e9891`: RUN-OUT — the authority writes `|-end|p2a: Jolteon|Encore` at turn 8, when the encored slot reaches 0; medicham2 writes nothing and the board parts on `vol.encore` 2/0, card `|-end|…|Encore <> |upkeep` — the four pool games' shape. FULL-PP control: both keep Encore. NATURAL expiry: both end at turn 10, and the comparator already equates `move: encore` with `Encore`, so **the formatting reading is refuted.** ROADMAP #580. The fifth game grouped with Encore (`…2661290217`, an Encored Incineroar the authority makes repeat Flare Blitz while medicham2 clicks Parting Shot) was **not staged** and is not claimed to be this mechanism.

## 4. The gate chain on `cee38e7e9891`

| instrument | result | artifact |
|---|---|---|
| damage differential | **0 of 6,000** disagree, every roll index | `data/engine-diff.json` 2026-09-11T01:03:15Z |
| roster items | 142 of 148 tested, 0 DIFFER, 0 DID-NOT-FIRE | `data/roster.items.json` |
| roster abilities | 139 of 201 tested, 0 DIFFER, 0 DID-NOT-FIRE, reds behave | `data/roster.abilities.json` (re-run after §5) |
| roster moves | 487 of 498 tested, 0 DIFFER, 0 DID-NOT-FIRE | `data/roster.moves.json` |
| all mechanics fire | moves 4 diverged (6 incl. shelved), abilities 1 (2), items 0 — **unchanged from HEAD** | `data/all-mechanics-fire.json` |
| middle arm | **0 of 961** board-material, 1 protocol divergence, 0 void, 0 undeclared drops | `data/game-differential.json` |
| quarantine | **OPEN, 9 of 9** | `engine/quarantine.js` |

Batch 1's release-pinned stages on `ca2be14649f0` read the same: roster 0/0 on all three, middle 0 of 961, all-mechanics identical to HEAD. Engine-diff and quarantine could not be read for batch 1: `tests/test-engine-diff.js` loads the LIVE `medicham2-browser.js` and `engine/quarantine.js` judges artifacts against the live tree, and the live tree already held batch 2. Neither batch changes a 1v1 no-crit damage comparison.

## 5. Two instruments planted on text this batch rewrote — re-aimed

- **`tests/roster.js`, rule `ability/refuses-a-crit`.** Its break patched `if(defAbility&&TAGS.param('ability',defAbility,'preventsCrit'))return 0;`, a line the fix replaced. The plant matched 0 times (`anchor_dead: true`), the red could not show, and **the abilities clause shut the gate (8 of 9)**. Re-aimed at `if(_pc&&critRefusedBy(…))return 0;` with the same `false&&`; gate back to 9 of 9.
- **`tests/probe_red_demo.js`, WIRE 129.** Anchored on `const _mvAcc=hitChance(…)`; the site declares `let` now. Re-aimed; the file exits 0.

## 6. Census

Four new rows in `tests/test-mechanics.js`, each a real turn with a same-body control: `ability/preventsCrit` (a busted Mimikyu is crit, a Shell Armor one is not — the die handed per category so only the crit draw varies), `ability/absorbMakesClickSure`, `move/pivotStatus` (through Bright Powder), `move/delayedHit` (through Bright Powder). **Shown RED first** on a copy of the file whose census path pointed at the scratchpad, under all four knobs: all four MISSING, census 835 live. The real census was not written by a red run, because a red run lowers the ratchet floors. Clean: **839 / 839 live.**

## 7. Things found on the way, not fixed here

- **`tests/test-engine-diff.js --write` runs n = 150 by default and refuses to republish over the 6,000-row artifact (exit 3, ROADMAP #257).** The launch command needs `--n 6000`. The refused run overwrote the tracked `data/verification/engine-diff.n150.json` with a 0-of-150 reading on `cee38e7e9891`; left in place.
- **Calling `tools/lownode.cmd` through `cmd.exe` from Git Bash rewrites an absolute `--out C:/…` path** (`ENOENT … 'C;C:\Program'`): the pre-fix baseline played all 961 games and lost its artifact at the write. `MSYS_NO_PATHCONV=1` fixes it.
- **`tests/probe_partingshot_conditional.js`'s `FILL` moves are refused by the validator** — `canLearn` says no to Iron Defense and Amnesia for Incineroar, Milotic and Garchomp. Evidence for ROADMAP #565; not touched.
- `data/releases/8ac9c4d888f1/release.json` is untracked, and `f83fb5670a11` (cut 23:10 by another agent, same simulator bytes as `3c2b2f9ac845`) is untracked too.
- `engine/status.js` prints `FEATURE SEMANTICS CHECK FAILED` for `data/policy-weights.json` (damage table 318 → 322 species). MEASURE's; untouched.
- No message from MEASURE about `engine/selftest.js` arrived, so nothing was applied for it.
- `node engine/status.js --write` printed `RATCHET TRIPPED — the unstamped list grew` for six `data/_diag*.json`
  files dated 2026-09-04. None is this batch's; MEASURE's in-progress `engine/provenance.js` is the likely
  mover. Left for MEASURE.
- Another agent committed CHANGELOG **6.4.1** while this batch ran; the 6.5.0 entry was moved above it so the
  newest release is on top. `tests/test-docs-current.js`: 35 passed, 0 failed.
- NOT MODELLED, named in the code: a volley that breaks the doll on arrival 1 and meets the disguise on arrival 2; a semi-invulnerable Future Sight collector (step 0 on the payout road).

## OWED, NOT RUN

The register refresh. It will read #580's instrument RED, and the gate's open-defect clause will then fail — that is the true state of a registered open engine defect, not a regression:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/register_reality.js
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/quarantine.js
```

Track the three releases this batch cut (the router tracks releases):

```bash
git add data/releases/9c7e1f2710eb data/releases/ca2be14649f0 data/releases/cee38e7e9891
```

Encore's 0-PP end, the next ENGINE batch (red today, green when fixed):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_encore_pp_end.js --assert --release cee38e7e9891
```

The fifth Encore-grouped game, never staged:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release cee38e7e9891 --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm top-tie-first --config omit-weather --seed "gen9championsvgc2026regmbbo3-2661290217 vs gen9championsvgc2026regmbbo3-2661324628"
```

The corner games still parting (top 12, bottom 11), card by card:

```bash
node -e "for(const a of ['top','bottom']){const j=require('./data/verification/game-differential-'+a+'-tie-first.json');for(const d of j.state.first_board_divergences)console.log(a,d.config,d.seed,'t'+d.turn,d.diffs.slice(0,2).map(x=>x.path+' '+x.medicham+'/'+x.showdown).join(', '))}"
```
