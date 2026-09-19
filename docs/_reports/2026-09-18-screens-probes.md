# 2026-09-18: the screens half of `ignoresScreensAndSubs`, and what was really uncovered

ENGINE division. LIGHT MODE: census rows and staged boards only. Worktree
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a8553b3b39ca1bedb`. Showdown checkout used by
absolute path: `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`. The worktree needed no
relative path.

## 1. The premise was stale

The claim was "nine live rows on the SUBSTITUTE half and none on SCREENS, Safeguard or Mist". It stopped
being true on 2026-09-09 (CHANGELOG 5.277.0, ROADMAP #560 closed). Before this pass the census held
these rows on `ability | ignoresScreensAndSubs`, all LIVE (`data/mechanics-census.json`, generated
2026-09-18T23:41:18Z on the unmodified tree, 886 live / 0 missing):

- Infiltrator hits the body behind a substitute
- Reflect / Light Screen / Aurora Veil (under snow): the screen costs the hit and Infiltrator lands the
  unscreened number
- Safeguard refuses a Will-O-Wisp, and Infiltrator burns through it

`tests/probe_screens_infiltrator.js` compares all four with the authority and was green. On both
engines, screened equals `battle.modify(control, [2732, 4096])` and Infiltrator equals the control.

**Mist:** `Dex.forFormat('gen9championsvgc2026regmb').moves.get('mist').isNonstandard === 'Past'`, so
Mist is not in this format and has no half to cover.

**Carriers (derived with the legality filter on the species):** Spiritomb, Whimsicott, Chandelure,
Chandelure-Mega, Meowstic, Meowstic-F, Malamar, Noivern and Dragapult. No legal move has `infiltrates`
set statically. Pollen Puff and Present set it at run time, and neither can write a status, confusion
or drowse.

## 2. What was actually uncovered

A grep of the authority for `infiltrat` (mod first: only `data/mods/champions/abilities.ts:26`, Disguise,
is relevant; then mainline) found these handlers that read the flag and apply in this format:

| site | handler | census before |
|---|---|---|
| data/moves.ts:857 / :10338 / :14857 | aurora veil / light screen / reflect damage | covered |
| data/moves.ts:15592 | safeguard `onSetStatus` | covered |
| data/moves.ts:15603 | safeguard `onTryAddVolatile` (confusion, yawn) | **no row** (the yawn road had an authority probe, `probe_yawn_safeguard_refusal.js`, but no census row) |
| data/moves.ts:18336 | substitute `onTryPrimaryHit` | covered on the direct road; **the Future Sight payout road never staged** |
| data/conditions.ts:407 | futuremove payout sets `infiltrates` from the booker | **no row** |
| data/moves.ts:3459 | defog through a doll | not staged (Noivern learns Defog; see OWED) |
| data/moves.ts:12087 | mist | Mist is Past |
| aromatherapy / sparklyswirl | | Past / LGPE |

Champions overrides none of safeguard, confuseray, hurricane, yawn, futuresight, substitute, reflect,
lightscreen, auroraveil, infiltrator, or the futuremove and confusion conditions. The probes check this
against the mod files on every run. (The mod's `confusion:` key is the MOVE Confusion, marked Past.)

## 3. Rows added and their verdicts

Census **886 → 890 live / 890 probed / 0 missing**, `run_ok: true`, direct-call ratchet 1 (unchanged).
The final run's census was generated at 2026-09-19T00:01:41Z.

| row | verdict | shown red by |
|---|---|---|
| `ignoresScreensAndSubs`: Safeguard refuses a Confuse Ray, Infiltrator confuses a foe through it, and its own side's Safeguard still refuses it | LIVE, `[true,0] / [false,3] / [true,3] / ally [false,3]` | `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1` → MISSING |
| `ignoresScreensAndSubs`: Safeguard refuses a Hurricane's secondary confusion, and Infiltrator confuses through it | LIVE (roll 0.01) | same knob → MISSING |
| `ignoresScreensAndSubs`: Safeguard refuses a Yawn, and Infiltrator drowses through it | LIVE, slept `slp / - / slp` | same knob → MISSING |
| `delayedHit`: a Substitute absorbs a Future Sight payout, and an Infiltrator booker's payout reaches the body | LIVE, `[108, 0→0] / [0, 366→258] / [108, 366→366]` | `MEDI_DELAYED_HIT_THROUGH_DOLL=1` → MISSING, `[108, 366→366]` behind the doll |

Under the Safeguard knob the existing Will-O-Wisp row also went MISSING, as it should. Each fixture has
one reason: Clefable (Fairy, ability blanked, burnable and confusable), with Endure as the neutral click.
The ally arm is the check that the rule is "a foe's infiltrating move passes" and not "Infiltrator
ignores Safeguard".

`sgVolArms(` was added to `REALTURN` with its reason, following the file's own rule. The first clean
run exited 1 because the three rows counted as direct calls (1 → 4). Declaring the helper put the
ratchet back to 1.

**Authority comparisons (both engines, pinned dice):**
- `tests/probe_safeguard_volatile_infiltrator.js` (new): Confuse Ray (control / Safeguard / Infiltrator
  / Infiltrator at its own partner) and Hurricane secondary. **BOARDS MATCH in every arm.** It exits 1
  under `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1`.
- `tests/probe_yawn_safeguard_refusal.js` (existing): INFIL-FOE and INFIL-ALLY green.
- `tests/probe_future_sight_doll.js` (new): see §4.

## 4. Defect found and fixed: Future Sight hits the body behind a Substitute

**Authority, read:** `futuremove.onEnd` → `trySpreadMoveHit([target], data.source, hitMove, true)`
(data/conditions.ts:415). The hit loop runs the mod's substitute check, and `substitute.onTryPrimaryHit`
steps aside only for `target === source || move.flags['bypasssub'] || move.infiltrates`
(data/moves.ts:18336). The booked flags are `{allyanim, metronome, futuremove}` with no `bypasssub`
(data/moves.ts:6413). `infiltrates` is written only when `data.source.hasAbility('infiltrator')`
(data/conditions.ts:407-409), and a benched booker answers false because `ignoringAbility()` opens with
`if (this.battle.gen >= 5 && !this.isActive) return true;` (sim/pokemon.ts:865).

**Measured before the fix** (Meowstic-F books; Garchomp puts a doll up the turn after):

| arm | authority | medicham2 before | medicham2 after |
|---|---|---|---|
| no doll | body −73 | body −145 | body −108 |
| doll, Keen Eye booker | body 0, doll 66 → 0 | **body −145, doll untouched** | body 0, doll 366 → 258 |
| doll, Infiltrator booker (active) | body −73, doll untouched | body −145, doll untouched | body −108, doll untouched |
| doll, Infiltrator booker BENCHED | body 0, doll 66 → 0 | (not staged before) | body 0, doll 366 → 258 |

The "before" column comes from a scratch staging with Alakazam as the booker (hence 145). The "after"
column comes from the probe's FIRST fixture with Meowstic-F (hence 108). **These absolute numbers are
superseded by §7**: that fixture built different bodies on the two engines. With identical bodies,
both engines read 73 / 45→0 / 73 with the doll untouched / 45→0.

**Fix** (`engine/medicham2-browser.js`, the futureHit payout, the branch that applies the damage): if
`m._sub > 0` and `subBlocks(bookerIfActive, m, mv)` is true, clamp the payout into the doll. It writes
the same lines as the main path: eff, then crit, then `-activate|[damage]` or `-end|Substitute`. The
body is not touched. A benched booker is handed to `subBlocks` as null, which means "no ability". The
die and crit draws are unchanged: they are spent above, as the authority's `getDamage` spends them. The
new counter is `MEDSEEN.delayedHitIntoDoll`. The knob is `MEDI_DELAYED_HIT_THROUGH_DOLL=1`, which stamps
`MEDFAILS.delayedHitThroughDollRestored`.

**Regression checks, all green after the fix:** `tests/probe_delayed_crit.js`,
`tests/probe_delayed_hit_immune.js`, `tests/test-future-sight.js` (15/15), and every other `delayedHit`
census row.

**Reach:** the doll half applies to every Future Sight user in the regulation, not only Infiltrator
carriers. It is board-material: the whole payout was landing on the wrong HP pool.

## 5. A fixture defect in the 2026-09-09 rows

The three Clefable screen rows (Reflect, Light Screen, Safeguard) used **Work Up** as the neutral click.
`data/mods/champions/moves.ts:1143` has `workup: { inherit: true, isNonstandard: "Past" }`, so Work Up
is not in this format. The Champions learnset still lists it, so the probe's `learns()` check passed it
and the ledger's "every click legal (28 derived facts)" claim was false. `probe_screens_infiltrator.js`
now also checks `legal(dex.moves.get(id))` for every click. It went **red on Work Up** (3 failures),
the click was swapped to **Endure** (legal, learned by Clefable, blocks nothing), and it is green again.
The census verdicts did not move: medicham2 still reads 43→29→43, 87→58→87 and brn/-/brn.

## 6. Files changed (worktree)

- `engine/medicham2-browser.js`: the payout doll branch, 2 counters and 1 knob
- `tests/test-mechanics.js`: 4 new rows, `sgVolArms` plus its REALTURN declaration, Work Up → Endure in 3 rows, and a corrected comment
- `tests/probe_screens_infiltrator.js`: the move-legality check, and Work Up → Endure
- `tests/probe_safeguard_volatile_infiltrator.js` (new)
- `tests/probe_future_sight_doll.js` (new)
- `docs/ENGINE.md`: new section plus the two probes added to the Owns list
- `data/mechanics-census.json`: regenerated, 890/890
- `data/engine-release.json`: **side effect, do not merge**. `probe_yawn_safeguard_refusal.js` re-cut
  the pointer to `ffc11ac41a26`, which is the pre-fix bytes.

`data/tags.json` was not touched, so `abra-tags.js` did not need a rebuild.

## 7. Coordinator's question: why was the doll 66 on one engine and 366 on the other? The fixture, not the engine

**Verdict: two probe-fixture errors and one die-orientation mismatch in the probe's stub. There is no
engine defect, and Substitute's HP is correct on both engines.**

1. **The authority side had an illegal spread.** `body()` passed `evs: 84` for every stat. In Champions
   without level clause, `statModify` computes `hp = base + evs + 75` and other stats as
   `base + evs + 20` (data/mods/champions/scripts.ts:24-27). So the authority Garchomp got 84 SP in every
   stat: 108+84+75 = **267 HP**, and the doll was floor(267/4) = **66**. Against the 32 cap that spread
   is illegal.
2. **The medicham2 side multiplied max HP by 8.** This was the `unfaintable` idiom: 183 → 1464, and
   the doll was 1464/4 = **366**. 183 is correct for 0 HP SP (108 + 0 + 75).
3. **The damage die was mirrored.** The authority takes `100 - this.random(16)` (sim/battle.ts:2390),
   and my stub returned `floor(16f)`. This engine maps die u to roll `15 - floor(16u)`
   (engine/medicham2-browser.js `damageRollIndex`, :15321-15324). With identical bodies the payout read
   72 against 73. A **direct Psychic** off the same bodies read 54 against 55, and a sweep showed
   medicham2(u) = authority(1−u) exactly (0.3↔0.7: 57/57 direct and 75/75 payout). So the offset comes
   from the stub, and the payout itself is not involved.

**Fix (probe only; no engine byte changed by this):** both engines now build the same bodies. The
authority gets `evs: 0` and Serious; medicham2 gets `buildMonFromSet` with Serious, 0 SP, and the same
abilities and moves. The `×8` is dropped, and only the authority stub's `random(16)` is mirrored to the
engine's orientation. A new check requires the payout, doll-before and doll-after to be **the same
numbers on both engines, arm by arm**.

| arm | authority | medicham2 |
|---|---|---|
| no doll | body −73 | body −73 |
| doll, Keen Eye | body 0, doll 45 → 0 | body 0, doll 45 → 0 |
| doll, Infiltrator active | body −73, doll 45 → 45 | body −73, doll 45 → 45 |
| doll, Infiltrator benched | body 0, doll 45 → 0 | body 0, doll 45 → 0 |

The probe is **all checks passed (exit 0)**. Under `MEDI_DELAYED_HIT_THROUGH_DOLL=1` it is **2 checks
failed (exit 1)**: the doll and benched arms read body −73 with the doll untouched.

**The same `evs: 84` body helper is in `tests/probe_screens_infiltrator.js` and
`tests/probe_safeguard_volatile_infiltrator.js`.** Their verdicts stand, because they compare each
engine's own ratio (screen = `modify(x,[2732,4096])`) or a status/volatile, never absolute numbers
across engines. They still carried an illegal authority spread; §8 fixes both.

The census row (`delayedHit | a Substitute absorbs...`) still uses `unfaintable` (×8), so its detail reads
doll 366 → 258. That row checks one engine against itself and asks only which pool the payout lands
in, so the ×8 changes no verdict.

## 8. The two other probes now use identical legal bodies, and a scan of `tests/` for over-cap spreads

### 8a. `tests/probe_screens_infiltrator.js` and `tests/probe_safeguard_volatile_infiltrator.js`

I made the same fix as in §7. The authority body is `evs: 0` and Serious. This engine builds its body
with `buildMonFromSet` (Serious, 0 SP, the same ability and moves); before, it used a usage spread with
the ability blanked and `×8` HP. The authority stub's `random(16)` is mirrored to this engine's
orientation. Each probe gains an **IDENTICAL BODIES** check that requires the same absolute numbers on
both engines. The Future Sight probe (§7) was not touched again.

| probe / row | authority | medicham2 |
|---|---|---|
| Reflect: control / screened / Infiltrator | 44 / 29 / 44 | 44 / 29 / 44 |
| Light Screen | 60 / 40 / 60 | 60 / 40 / 60 |
| Aurora Veil (snow) | 57 / 38 / 57 | 57 / 38 / 57 |
| Safeguard vs Will-O-Wisp | brn / - / brn | brn / - / brn |
| Compound Eyes: bare / ability, die 0.95 | 0 / 31 | 0 / 31 |
| Safeguard vs Confuse Ray, HP lost (ctrl / sg / inf / ally) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Safeguard vs Hurricane, HP lost (ctrl / sg / inf) | 100 / 100 / 100 | 100 / 100 / 100 |

Both probes pass every check (exit 0). The red arms:

| probe | switch | result |
|---|---|---|
| screens | `PROBE_STRIP=infiltrator` (new probe-level switch: strips `ignoresScreensAndSubs` from the tag DB in-process on this engine only, the `tests/probe_red_demo.js` method) | **7 checks failed, exit 1**: all three damage screens (BOARDS MATCH and IDENTICAL BODIES) plus Safeguard |
| screens | `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1` | **1 failed, exit 1** (Safeguard) |
| safeguard-volatile | `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1` | **2 failed, exit 1** (Confuse Ray, Hurricane) |

**The Compound Eyes arms have no red lever, and I measured that rather than assumed it.** Stripping
`accuracyMod` from `compoundeyes` left the run **green**. The engine reads Compound Eyes from the
name-keyed `ACCMOD` table (`engine/medicham2-browser.js:11496`, row `'ability:compoundeyes'`), not from
the tag. `accModRow` only consults the tag to COUNT an untabled entity (`MEDFAILS.accModUntabled`). So I
did not offer that switch. Those arms rest on their internal control: the same 0.95 die misses the bare
body and lands with the ability, on both engines. Name-keyed rather than shape-keyed is a CLAUDE.md
"match on tag shape, never on a name" departure. It is reported, not fixed (engine bytes, outside this
brief).

### 8b. Scan of `tests/` for authority bodies over the stat-point cap (>32 per stat or >66 total)

I searched every `evs:` / `evs =` in `tests/` (45 occurrences, 39 files), plus paste-format `EVs:`
lines, packed EV strings, and any `hp|atk|spa|spe: ≥33` literal (22 hits; all of those are
stats/HP/maxhp on stub bodies, not spreads). `CS.LEGAL_SPREAD` (`engine/champions_sim.js:584`) is
`{hp:32, atk:32, def:2}`, which is legal at 66. The paste at `tests/test-mechanics.js:16769` is
`EVs: 32 SpA`, which is legal.

**Remaining over-cap authority bodies (84 SP in every stat, 504 total). All are in files I did not
touch, so they are listed and not fixed:**

| file:line | what it asserts | exposure |
|---|---|---|
| `tests/probe_multihit_corners.js:74` | hit COUNTS of multi-hit moves at pinned corner dice | inflated stats do not move a hit count; a damage/KO clamp arm would. Not verified |
| `tests/test-residual-order-observed.js:69` | the ORDER of residual (sand) lines across bodies | chip is a fraction of max HP, so an inflated HP changes numbers, not order. Not verified |
| `tests/test-residual-order-population.js:128` | the same, over a population | same as above. Not verified |

Fixed in this pass (files I had already touched): `probe_screens_infiltrator.js` (was :162),
`probe_safeguard_volatile_infiltrator.js` (was :127), and `probe_future_sight_doll.js` (§7).

## 9. `ACCMOD` moves onto tag shape

**Before.** `accModRow(kind, id)` looked up `ACCMOD[kind+':'+key]`, a hand table keyed by name
(`engine/medicham2-browser.js`, `const ACCMOD`). It asked the `accuracyMod` / `writesAccuracy` tags only
to COUNT an entity the table lacked (`MEDFAILS.accModUntabled`). §8a measured the consequence: stripping
`accuracyMod` from Compound Eyes left the run green.

**Derivation** (`engine/tag_dex.js`, new `accuracyChainOf`, used by the item and ability `accuracyMod`
rules). It reads each handler's hook and text:

| field | read from |
|---|---|
| `side` | the hook: `onSourceModifyAccuracy` → att, `onModifyAccuracy` → def, `onAnyAccuracy` → both, `onAnyModifyAccuracy` → allySide |
| `mod` | the literal `chainModify([n, d])`, or `chainModify(x)` → `[trunc(x·4096), 4096]` (Showdown's own conversion) |
| `setTo` | a bare `return <n>;` |
| `never` | `onAnyAccuracy` returning `true` |
| `when` | the gate, named from its text: physical / status / sand / snow / targetAlreadyMoved / holderConfused. Anything else becomes `unparsed:<text>`, and the engine counts it and does not fire it |

**Membership printed before wiring.** It was 3 items (Bright Powder, Wide Lens, Zoom Lens) and 5
abilities (Compound Eyes, Hustle, Sand Veil, Snow Cloak, Tangled Feet). After, **No Guard** joins
(`onAnyAccuracy`). Victory Star and Wonder Skin derive rows but have **no legal carrier**, so no row is
written. Skill Link correctly derives nothing: it has no accuracy hook, which is the `off:` reason the
table carried. **All nine legal rows matched `ACCMOD` exactly** on side, mod, when, setTo and never. The
2-dp `mult` the table carried is recomputed from the pair and matches all nine (1.3 / 0.8 / 0.8 / 0.8 /
0.5 / 0.9 / 1.1 / 1.2). Gravity's row now comes from `groundsField.accuracyMult` alone
(1.669921875 = 6840/4096 exactly), with no literal fallback on the tag path.

**Engine.** `accModRow` reads `TAGS.param(kind, key, 'accuracyMod')` and builds the row from it (cached per
param object). It is loud on two new counters: a tag row with no shape (`accModTagNoShape`) and a side
the engine does not apply (`accModUnknownSide`). **`MEDI_ACCMOD_BY_NAME=1`** restores the name-keyed read
exactly (Gravity included) and stamps `MEDFAILS.accModByNameRestored`. `ACCMOD` stays as that restore and
as the table `probe_accuracy_modifier_chain.js` audits.

**`tags.json`: a real regeneration, with only the relevant deltas carried.** A regeneration in this
worktree first failed its corpus read (the store files are untracked here), which set every `uses` to 0.
I restored the file at once. After copying the main tree's `data/games.{ladder,bo3}.jsonl` in read-only,
a regeneration read an **older** local store (sheet_entries 282,072 vs the committed 316,656). Its diff
against the committed file was then:
- (a) the nine `accuracyMod` params, No Guard's membership and the summary row's `n` 5→6 — this change;
- (b) ~690 `uses` counts plus linkage use-sums (same members, different sums), and one summary row
  (`move:curesPartyStatus consumedBy null→curesPartyStatus`) — all corpus/staleness, not this change.

I carried only (a) into the committed file by script (`tags.json` diff: 86+/12−). Every carried value
was checked equal to the regen. The summary `uses` was re-summed from the committed counts (4113 → 4295).
`data/abra-tags.js` was rebuilt with `node build/build_tags_js.js`. **A full regeneration on the main
tree with the complete store is still owed** so the file is not part-merged.

**Proof that nothing moved:**

| check | tag path | `MEDI_ACCMOD_BY_NAME=1` |
|---|---|---|
| census | 890 / 890 / 0, `run_ok` | 890 / 890 / 0 |
| census rows differing from the pre-change census | 1 of 890 | 1 of 890 (vs the tag path) |
| `probe_accuracy_modifier_chain.js` (with the pinned pool) | exit 0, counters +32 / +32 / +18 | exit 0, +32 / +32 / +18 |
| `probe_screens_infiltrator.js` | exit 0 | exit 0 |
| `probe_future_sight_doll.js`, `probe_safeguard_volatile_infiltrator.js` | exit 0 | — |
| **`PROBE_STRIP=compoundeyes`** | **2 checks failed, exit 1** (ability arm: damage 31 → 0) | exit 0 — the name path ignores the tag |

The one census row that differs, `formatSecondaryChance | Iron Head flinches at this FORMAT's 20%`, is an
unseeded 6,000-turn rate. It moved between two runs before this change too (Rock Slide 26.6% → 26.3%,
23:41 vs 00:01), so it is sampling noise and not this change.

`probe_accuracy_modifier_chain.js` first failed `FIXTURE — the pair is in the PINNED pool` on both paths,
because the worktree's `data/team-pool-frozen/` holds only `FROZEN.md`. I copied the pool files in
read-only from the main tree, and then it passed.

## 10. The three remaining over-cap bodies

| file:line | as-is | fixed to 0 SP | output change |
|---|---|---|---|
| `tests/probe_multihit_corners.js:74` | exit 0, all checks passed | exit 0, all checks passed | **byte-identical** |
| `tests/test-residual-order-observed.js:69` | exit 0, ALL GREEN, 3 checks | exit 0, ALL GREEN, 3 checks | only the illustrative sample lines' HP (e.g. `223/237` → `144/153`; 153 = base 78 + 75) |
| `tests/test-residual-order-population.js:128` | exit 0, ALL GREEN, 14 checks | exit 0, ALL GREEN, 14 checks | **byte-identical** |

**No verdict moved.** A `grep` for `hp: 84` in `tests/` now returns nothing.

## 11. ROADMAP #127 — the five split signatures, re-measured

**The row is largely stale.** `tests/test-tag-signature.js` (the gate #127 asked for, already built)
now reports **one** split signature, not five: `acupressure` (affect) vs `bellydrum`/`tidyup` (statcode).
It is separated by params and is not a failure. I re-resolved the row's five groups through `playerAction`
on the live engine (scratch `sig127.js`):

| group (row's uses) | members → kind | what separates them now | what the engine branches on |
|---|---|---|---|
| **A** protect/detect/... vs endure (96,406) | shields → `protect`; endure → `affect` | `shieldsUser` vs `survivesAnyHit` | dispatch: the tag first. **But `PROTECTMOVES`, a NAME list, still decided three places:** the dispatch fallback (counted), `buildMonFromSet`'s usable-move filter, and `_chooseAction`'s `canProtect` |
| **B** wideguard vs quickguard (4,924) | both → `wideguard`, `mv` names the guard | `oneTurnGuard` | the tag (#126) |
| **C** roost/recover/... vs wish/rest (3,721) | heal vs `healdesc` | `healDescriptor` (delayed / also-sleeps) | the tag + `healParam` |
| **D** beatup/hex/storedpower vs spitup (524) | all → `attack` | `variablePower.kind` (+ `spendsVolatile` on Spit Up) | `v.kind` (a param) |
| **E** bellydrum/tidyup vs acupressure (134) | statcode vs affect | `statChangeInCode.boosts`+`on:'user'` vs `.op` (randomOne) | the param shape |

**No split is a real authority difference the tag under-describes.** Each is carried by an existing tag
or param, so **no `tag_dex` derivation was needed and `tags.json` does not change in this step.**

**Group A moved onto the tag.** In `engine/medicham2-browser.js`:
- New `isShieldMove(id)` reads `shieldsUser`.
- `canProtect` and the usable-move filter call it.
- The `PROTECTMOVES` dispatch fallback now runs only under **`MEDI_SHIELD_BY_NAME=1`**, which restores
  the name reads at all three sites and stamps `MEDFAILS.shieldByNameRestored`.

Membership was printed first: the five legal `PROTECTMOVES` members are exactly the five `shieldsUser`
carriers. The other three (burningbulwark, silktrap, maxguard) are not in this format.

**Proof — `tests/probe_signature_tags.js` (new), one strip per group:**

| run | result |
|---|---|
| normal | all checks passed, exit 0 |
| `PROBE_STRIP=protect:shieldsUser` | **A1 + A3 red**, exit 1 (A3: 117 → 21 shielded turns of 200) |
| … `+ MEDI_SHIELD_BY_NAME=1` | green, exit 0 |
| `PROBE_STRIP=quickguard:oneTurnGuard` | **B red** (quickguard → `pass`) |
| `PROBE_STRIP=wish:healDescriptor` / `rest:healDescriptor` | **C red** (→ `pass`) |
| `PROBE_STRIP=beatup:variablePower` | **D1 red** (→ `pass`) |
| `PROBE_STRIP=hex:variablePower` | **D2 red** (burned target 41 → 21, no doubling) |
| `PROBE_STRIP=bellydrum:statChangeInCode` | **E red** (→ `pass`) |

**The pasted-set filter has no arm, and that was measured.** The same filter admits anything `moveFx`
knows, and `moveFx` is truthy for all five shields. So Protect survives with or without the tag. The arm
was written, stayed green under the strip, and was removed as a test that asked nothing. The filter's
shield read is redundant.

**No board number moved:**
- The census is 890/890 on both paths.
- The only differing row, versus the previous census and between paths, is the unseeded Iron Head rate (§9).
- The chooser's shielded-turn count is 117/200 on both paths.
- `test-tag-signature.js`, the screens probe, the Future Sight doll probe and the Safeguard probe all pass.

### FINDING, NOT FIXED — the engine's own chooser raises a generic Protect whatever shield the body holds

`_chooseAction` returns a bare `{kind:'protect'}` with no `mv`, at the `canProtect` branch and at the
priors branch (`if(pick.kind==='protect'&&...)return{kind:'protect'}`, which drops `pick.mv`).
`actionMoveId` then falls back to `KIND_MOVE.protect = 'protect'`.

Measured with a Garchomp holding **only Spiky Shield**, threatened, on 200 staged turns:
**117 of 117 shielded turns read `_protectMove=null`, `_lastMove=protect`**. It raised plain Protect
(scratch `shieldpick.js`). In the authority that body can only click Spiky Shield, and a contact attack
into it costs the attacker. So in every chooser-driven game (rollouts, `battle()`, self-play), Spiky
Shield / King's Shield / Baneful Bunker holders lose their punish and announce a move they do not have.

The fix is to carry `mv` (the tag-found shield) on both returns. That moves rollout boards, so per the
brief it is reported, not fixed. It is in the in-engine chooser, which drives quarantined rollout
consumers rather than the census or differential (those use explicit clicks), which is presumably why
no instrument has seen it.

## PROPOSED NOTES ROW

| 2026-09-18 | ENGINE | **Future Sight's payout now meets a Substitute.** `futuremove.onEnd` pays out through `trySpreadMoveHit` (data/conditions.ts:415), so a doll absorbs it unless the booker is ON THE FIELD with Infiltrator (data/conditions.ts:407; sim/pokemon.ts:865). MEDICHAM landed the whole payout on the body and never touched the doll. Fixed; knob `MEDI_DELAYED_HIT_THROUGH_DOLL=1`; `tests/probe_future_sight_doll.js` builds identical bodies on both engines and reads the same absolute numbers (payout 73, doll 45) in 4 of 4 arms. Also: Safeguard's volatile handler (confusion by status move and by secondary, and yawn) now has census rows against Infiltrator, each red under `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1`, with authority comparisons in `tests/probe_safeguard_volatile_infiltrator.js`; and the 2026-09-09 screen rows' neutral click Work Up (Past in Champions) became Endure, with no verdict moved; ROADMAP #127 re-measured: four of its five split signatures are already decided by a tag and the fifth (Acupressure vs Belly Drum) by a param, and the one name list left, `PROTECTMOVES`, now decides nothing by default (`isShieldMove` reads `shieldsUser`; `MEDI_SHIELD_BY_NAME=1` restores it), every group proved red with its tag stripped by `tests/probe_signature_tags.js`; FINDING, not fixed: the engine's own chooser raises a generic Protect for a body whose only shield is Spiky Shield (117 of 117 shielded turns); and the three Showdown-comparison probes (`probe_future_sight_doll.js`, `probe_screens_infiltrator.js`, `probe_safeguard_volatile_infiltrator.js`) now build identical legal 0-SP bodies on both engines and assert identical absolute numbers, where the authority side had passed an over-cap `evs: 84` spread; and `ACCMOD`, the accuracy-modifier table keyed by name, is now read off the `accuracyMod` tag (derived from each handler by `engine/tag_dex.js` `accuracyChainOf`; No Guard joins the tag), with `MEDI_ACCMOD_BY_NAME=1` restoring the name path — stripping the tag now turns the Compound Eyes arm red, and the census, `probe_accuracy_modifier_chain.js` and the screens probe are unchanged on both paths. Census **886 → 890 live / 0 missing** (`data/mechanics-census.json`). **Supersedes.** The ENGINE.md 2026-09-09 claim that every screen-probe click was legal (Work Up was not). **Basis.** unchanged. **Owes.** ENGINE ledger (done in this pass); a release cut on the merged tree; the technical docs at the next major. |

## OWED, NOT RUN

- **No release cut** for the post-fix engine bytes. Every artifact that reads a Future Sight payout
  behind a doll (differential lattices, roster moves stage, all-mechanics-fire, test-engine-diff) needs
  re-running on the merged tree. None of these was run here, per LIGHT MODE.
- **Pool impact unmeasured.** This should move the pinned-pool differential only where a Future Sight
  payout lands behind a doll. That is rare, so expect the lab to move and the pool to barely move.
- **Benched Infiltrator booker plus a SCREEN:** the authority applies the screen (`infiltrates` is not
  set), but `dmgRange(_src, …)` reads the booker's ability whether or not it is active. This was not
  staged or fixed. It is a narrow case (Meowstic-F or Malamar, Future Sight, then switch out, into a
  screen).
- **Fainted booker:** whether `isActive` is still true for a booker that fainted before the payout was
  not checked. The engine treats a fainted body still in the active array as on the field.
- **Defog through a doll with Infiltrator** (data/moves.ts:3459, Noivern learns Defog): not staged.
- **Payout narration behind the doll** (eff / crit / `-activate|[damage]` / `-end|Substitute` order) was
  compared on boards only, not on the protocol stream.
- The 41-tag "parameter half with no census row" sweep (ROADMAP #557) was not re-run.
- ~~The `evs: 84` authority body in `probe_screens_infiltrator.js` and
  `probe_safeguard_volatile_infiltrator.js`~~: done in §8a.
- ~~Three more `evs: 84` authority bodies~~: fixed and re-run in §10, with no verdict moved.
- ~~Compound Eyes is read from a name-keyed table~~: moved onto the tag in §9.
- **`data/tags.json` is part-merged** (§9): the committed usage counts plus this change's `accuracyMod`
  deltas. It needs a full `engine/tag_dex.js` regeneration on the main tree with the complete store. That
  regeneration will also pick up the `curesPartyStatus` summary row that is stale in the committed file.
- **Copies left in the worktree, all gitignored and all created by me:** `data/games.ladder.jsonl`,
  `data/games.bo3.jsonl`, `data/team-pool-frozen/games.{bo3,ots}.jsonl` (about 920 MB, copied read-only
  from the main tree so `tag_dex` and the chain probe could run). `data/diff-team-pool.json` was written by
  `probe_accuracy_modifier_chain.js`. All are safe to delete with the worktree.
- **`data/engine-release.json` now points at `9131d3fa9a61`**, cut by `probe_accuracy_modifier_chain.js`
  at 00:46. Do not merge it; cut on the merged tree.
- **The chooser's generic-Protect defect (§11 FINDING)**: open, not fixed, and it has no register row.
  It needs one.
- **ROADMAP #127 register text** is stale: four of its five groups are closed, and the fifth is
  param-separated. I did not edit the row; proposed closing text is in §11.
- `tests/test-engine-diff.js` (which audits `ACCMOD.mult` against the format) was not run. `ACCMOD` is
  unchanged, so it should be unaffected.
