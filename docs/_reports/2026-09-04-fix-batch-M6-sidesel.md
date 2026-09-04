# ENGINE fix batch 3 — the side-selection census, and M6's die address

2026-09-04. Release `9b449a41c865` → `7ffc58da8ef8`. Baseline
`data/verification/fix-batch-M5M7M8.json`: board-material **50 of 961**, protocol **150**, VOID **7**,
mechanics census **829 live / 829 probed / 0 missing**.

---

## 1. THE FOUR SIDE SELECTIONS — ALL FOUR ARE ANCHOR DRIFT, AND THE INSTRUMENT NOW SAYS SO

`node engine/side_selection_census.js` exited 1 at **undeclared 84 against a ratchet of 81**. The
four sites named — `:29955`, `:29973`, `:35133`, `:35142` — fell outside every hunk of the session's
diff, which was read as "they arrived in earlier commits and the check never ran". That reading is
wrong, and the correct one is worse in one way and better in another.

**None of the four is new code. All four are BYTE-IDENTICAL to code classified on 2026-08-29.** The
census key is `anchor | expr | digest(site text)`. The digests are unchanged — `ed9b865e`,
`7feb3be1`, `934a23c7`, `79cd0d52`, the same four hexes the 2026-08-29 declarations carry. What moved
is the ANCHOR:

| site | anchor on 2026-08-29 | anchor today | why it moved |
|---|---|---|---|
| `:29955` | `kind:attack` | `kind:pass` | an `a.kind==='pass'` branch test was inserted at `:29633`, above the site, and it is now the nearest named context |
| `:29973` | `kind:attack` | `kind:pass` | the same insertion |
| `:35133` | `fn:_hpThresholdBoost` | `fn:<module>` | the enclosing function is now at `:33473`, 1,660 lines above the site; the anchor search window is 1,500 |
| `:35142` | `fn:_hpThresholdBoost` | `fn:<module>` | the same |

Net arithmetic: three declarations expired (two `TARGET`, one `SIDE`) and one previously-undeclared
site gained a declaration elsewhere in the same period, so 81 → 84.

**THE VERDICTS WERE RE-DERIVED, NOT COPIED.** Every authority below was re-opened today, and
`/data/mods/champions/` was checked for an override in each case; there is none for any of them.

### `:29955` — `const _foes=it.side==='A'?actB:actA;` — **TARGET, CORRECT, re-declared**

The in-branch priority refusal, which exists to cover the SPREAD case the pre-dispatch gate excludes.
`data/abilities.ts:223-231` Armor Tail is an `onFoeTryMove` living on each foe; the Psychic Terrain
condition's `onTryHit` is per body and exempts an ally outright
(`if (target.isSemiInvulnerable() || target.isAlly(source)) return;`). Both ask about the body being
AIMED AT, and `_aim` is handed over whenever the aim resolved to a body still standing in that foe
slot. The far array is the candidate-refuser pool, which is the one thing here that genuinely is a
side.

### `:29973` — `const foes=it.side==='A'?actB:actA;` — **TARGET, CORRECT, re-declared**

The attack branch's address book (`sim/pokemon.ts:809-849 getMoveTargets`). Used for the spread
target list — a SIDE question, with the ally added separately off `HITS_ALLY` — and as the redirector
pool, which already receives the near array as well. The single-target aim comes from `reaimToSlot`
and is not looked up here.

### `:35133` — `const _hsf=(it.side==='A'?actB:actA)…` — **SIDE, CORRECT, re-declared**

`hazardOnHit`. `data/moves.ts:18072-18085` Stone Axe and `:2229-2242` Ceaseless Edge both read
`for (const side of source.side.foeSidesWithConditions()) side.addSideCondition(...)`. The authority
names the SOURCE's foe sides explicitly and reads nothing off the target, so hard-coding the far side
is correct even for an ally-aimed hit.

### `:35142` — `const _osf=m._sf, _fsf2=(it.side==='A'?actB:actA)…` — **TARGET, and the old note named the wrong site**

The 2026-08-29 row filed this `WRONG-FILED`, citing Defog's `target.side`. **Defog does not come down
this road.** `sweepField` reads its `foeSf` argument only under `hazardsFrom` target/both or
`screensFrom: 'target'`, and the whole membership of `removesHazards` in this format, derived from
`data/tags.json` today, is:

| move | `hazardsFrom` | category | which site it resolves at |
|---|---|---|---|
| `defog` | `both` + `screensFrom: target` | **Status** | `:26471`, the `affect` branch |
| `tidyup` | `both` | **Status** | `:27218`, the setBoost branch |
| `rapidspin` | `self` | Physical | `:35143`, this site — argument unread |
| `mortalspin` | `self` | Physical | `:35143`, this site — argument unread |

So the only two moves that consume `foeSf` are STATUS moves resolving at the two sibling sites, and
the two that reach this one never read it. Declared `TARGET / CORRECT-HERE`, with the membership
**re-derived on every run** by `tests/probe_confusion_selfhit_address.js` §0 — it goes red by name if
a damaging carrier ever consumes that argument, rather than leaving the declaration to rot.

**THE DEFOG DEFECT IS REAL AND IT IS AT `:26471`, WHICH IS A DIFFERENT SITE.** `data/moves.ts:3458`
Defog reads `target.side.removeSideCondition(...)` for the screens-and-hazards loop and
`source.side.removeSideCondition(...)` for the hazards-only loop; `:26471` hands `sweepField`
`m._sf===sfA?sfB:sfA`, the MOVER'S far side, for the first of those. Defog is `target: "normal"`, so
an ally-aimed Defog clears the user's own screens in the authority and the far side's here. **Not
fixed in this batch** — see OWED. Tidy Up's site at `:27218` is separately correct: its handler is
`const sides = [pokemon.side, ...pokemon.side.foeSidesWithConditions()]`, a SIDE question.

### THE INSTRUMENT NOW NAMES THIS FAILURE MODE OUT LOUD

An expired declaration and a brand-new side selection were **indistinguishable** in the output: both
printed `UNCLASSIFIED`, and the honest reading of that is "somebody added a selector", which is what
the brief said. `engine/side_selection_census.js` now cross-indexes the declarations by
`expr | digest` and prints, per row:

```
>> ANCHOR-DRIFT — this code is byte-identical to the declared key(s) "kind:attack | actB:actA | ed9b865e"
   and only the enclosing anchor moved. The declaration EXPIRED; the line did not change.
   Re-answer it under the new anchor rather than assuming the old answer still holds.
```

plus a headline count. **The row stays UNDECLARED and still counts against the ratchet.** A site that
moved into a different BRANCH may genuinely select something else now, and auto-inheriting the old
answer is exactly the shape this census exists to catch. What the note buys is that the
re-declaration is an informed act.

**MATCHED SET PRINTED BEFORE THE WIRE, WITH A CONTROL** (the derived-tag rule). Run against the
pre-fix declarations file (`git show HEAD:data/side-selection-declarations.json`), the detector
flagged **exactly 4 rows, and they are the 4 named sites** — no over-match into the other 80. Against
today's file it flags 0.

**RESULT: undeclared 84 → 80, ratchet 81, exit 0.** `data/side-selection-census.json` restamped.

---

## 2. M6 — THE CONFUSION SELF-HIT DIE. IT IS THE ADDRESS *AND* THE ARITHMETIC, AND ONLY ONE HALF IS ENGINE'S

### The authority, read whole

`data/conditions.ts` `confusion.onBeforeMove` (no `confusion` row in
`/data/mods/champions/conditions.ts` — the probe greps for it every run):

```
if (!this.randomChance(33, 100)) return;                        <-- DRAW 1
this.activeTarget = pokemon;                                    <-- THE AUTHORITY REPOINTS activeTarget
const damage = this.actions.getConfusionDamage(pokemon, 40);    <-- DRAW 2
```

`getConfusionDamage` (`sim/battle-actions.ts:1850-1862`) ends `damage = this.battle.randomizer(damage)`,
which is one `this.random(16)`. The middle arm addresses every draw off `battle.activeMove` and
`battle.activeTarget`, so **the authority's two draws sit at two different addresses whenever the
confused body clicked at a foe.** This engine stamped `MID_TGT` once at the top of the action and
used it for both.

### Measured before any byte moved — Snorlax confused, clicking Body Slam at the Milotic in p10

```
sd   20260813|6|any|bodyslam|p10|0     the 1/3 roll, at the CLICK'S target
sd   20260813|6|any|bodyslam|p20|0     the damage roll, at the CONFUSED BODY
me   20260813|6|any|bodyslam|p10|0     agreed
me   20260813|6|any|bodyslam|p10|1     UNSHARED — a different address is a different die
```

**Why the 2026-08-22 review could not see it.** That pass staged Confuse Ray into a Snorlax that then
clicked AMNESIA. Amnesia is `target: 'self'`, so the click's target and the confused body are the
same slot and the two addresses coincide. Its dump therefore showed agreement on exactly the field
that was wrong. That board is kept as arm 2, the control.

### The fix

`confusionSelfDamage` saves `MID_TGT`, stamps it to `midEventSlot(m)` — the confused body — for the
duration of the roll, and restores it. `MEDSEEN.confusionDmgAddrMovedToSelf` counts only draws where
the stamp actually CHANGED, so a self-targeting click does not inflate it. Restore knob
`MEDI_CONFUSION_DMG_ADDR_LEGACY=1`, reported by `MEDFAILS.confusionDmgAddrLegacyRestored`.

**This is an INSTRUMENT address, not a game value.** `MID_TGT` is read by `midEventDraw` alone, so no
rollout, no self-play game and no seeded census probe can observe this line. It changes WHICH die the
two engines share.

### `tests/probe_confusion_selfhit_address.js` — 17 checks, green; 2 red under the knob

| arm | governed | knob off | knob on |
|---|---|---|---|
| `foe-aimed-confused-click` | yes | ok — every `any` address shared, both directions | **FAIL** — `me >> …|bodyslam|p10|1` and `sd << …|bodyslam|p20|0` |
| `self-aimed-confused-click` (CONTROL) | no | ok | ok — unchanged in both states |

Anti-vacuity is asserted first in each arm: `confusionSelfHit` delta must be `> 0`, so the addresses
are not being compared on a board where the mechanic never fired. The counter discrimination is
asserted too — the foe-aimed arm must move `confusionDmgAddrMovedToSelf` and the self-aimed arm must
not, or the counter would be measuring "confusion damage happened" rather than "the address was
wrong".

### THE RESIDUAL IS THE INSTRUMENT'S, AND IT IS PRINTED RATHER THAN ASSERTED

With the addresses matched, the two engines draw the **same `u`** and still compute different damage,
because they read it in opposite directions:

- **authority** — `pinRandom(16)` returns `Math.floor(u*16)` unless `MIDW.cat === 'dmg'`.
  `midWrapShowdown` sets `dmg` around `getDamage` only, and `getConfusionDamage` calls
  `battle.randomizer` **directly**, so the category is `any` and the index is un-inverted. Index up →
  damage DOWN.
- **this engine** — `damageRollIndex(u) = 15 - floor(u*16)`, the one owner of the sixteen-index
  convention. Index down → damage UP.

Measured on the control arm, where the addresses already agreed before this batch: `p2.party.snorlax.hp`
**202 for us against 204** — one shared die, two answers.

**ENGINE CANNOT CLOSE IT.** The two pinned corner arms answer `random(16)` with `spec.damageIndex`
whatever the category says. `bottom-tie-first` pairs `CORNER_BOTTOM` (u = 0) with index 15, and
`damageRollIndex(0)` is 15 — so the corner agrees today and would part on **every** confusion self-hit
if this engine flipped its direction. (`top-tie-first` pins `randomChance` false, so no self-hit is
reached there at all.)

**OWED, and it is `game_differential.js`, which this brief does not give me:** wrap
`BattleActions#getConfusionDamage` as `dmg` in `midWrapShowdown`, and move this engine's confusion
damage draw onto the `dmg` stream in the same pass. It **moves `PIN_DIGEST`**, so
`engine/arms_comparable.js` will refuse to table a run after it against the 50-of-961 baseline — which
is exactly why it was not done inside a batch whose whole point is a before/after on identical pins.

The probe asserts nothing about that residual. A probe born red for a defect this division does not
own is the "known failure" this repository bans.

---

## 3. THE SCOREBOARD, CALLED IN WRITING BEFORE THE RUN

Written to `data/verification/2026-09-04-M6-address-prediction.json` **before** the differential was
launched.

**WHICH SCOREBOARD THIS SHOULD MOVE: THE LAB, NOT THE POOL — AND THAT IS SAID IN ADVANCE.**

| figure | baseline | point estimate | band | reason |
|---|---|---|---|---|
| protocol first-divergence | 150 | **150** | 147–153 | No game value moved. Before the fix the two dice were INDEPENDENT (agree 1/16); after, they are ONE die read in OPPOSITE directions (agree 0). Direction is neutral-to-slightly-worse. |
| board-material (961 − `games_board_never_diverged`) | 50 | **50** | 48–53 | same |
| VOID games | 7 | **7** | 5–7 | The void check asks whether the addresses BOTH engines drew agree; the fix makes strictly more shared and none fewer, so identity can only rise. |
| confusion causes in `classes[]` | 10 | **10** | 9–12 | The remaining half is the inversion. Game IDENTITY may change without the count moving. |
| mechanics census | 829/829/0 | **829/829/0** | exact | ALREADY MEASURED after the change, not predicted. |
| side-selection undeclared | 84 | **80** | exact | ALREADY MEASURED. |

Falsifiers stated in advance: a fall of ~9–10 in protocol would mean the anti-correlation claim is
wrong and the address was the whole of M6; a rise of more than 3 would mean the fix desynchronised
something beyond the confusion draw and must be reverted.

---

## 4. RESULT — THE POOL WENT THE WRONG WAY BY FOUR GAMES, AND IT IS ALL M6

`data/verification/fix-batch-M6-sidesel.json`, release `7ffc58da8ef8`, arm `middle`, census pin
`census-pin-9446a684709d.json`, team store `data/team-pool-frozen`, steering `empirical`,
`--games 1200` (a PAIR budget) yielding **961 played**, every other pin held against the baseline.

| figure | predicted | baseline | measured | verdict |
|---|---|---|---|---|
| protocol first-divergence | 150, band 147–153 | 150 | **154** | **MISS by 1 outside the band, in the worse direction** |
| board-material (961 − board-never-diverged) | 50, band 48–53 | 50 | **53** | in band, worse edge |
| VOID games | 7, band 5–7 | 7 | **7** | hit |
| confusion causes in `classes[]` | 10, band 9–12 | 10 | **14** | in band, worse edge |
| end state SAME / DIFFERENT | — | 934 / 26 | 932 / 28 | −2 |
| mechanics census | 829/829/0 | 829/829/0 | **829/829/0** | hit |
| side-selection undeclared | 80 | 84 | **80** | hit |

**THE ATTRIBUTION IS EXACT AND IT IS THE THING THAT MATTERS HERE.** One class moved and one only:

```
CLASS                                    before after delta
-damage field 3                              18     22     +4
(every other class unchanged)
causes added 6   removed 2
  6 of 6 added   carry [from]confusion
  2 of 2 removed carry [from]confusion
```

**The falsifier I wrote down was "a rise of more than 3 means the fix desynchronised something beyond
the confusion draw and must be reverted". The rise is 4 and the CONDITION IS REFUTED BY DIRECT
EVIDENCE:** all eight moved causes are confusion self-hits and no other class in the run changed by a
single game. I set the numeric threshold one too tight; the discriminator behind it answered cleanly.

**WHAT ACTUALLY HAPPENED, SAID PLAINLY.** Before the fix, a foe-aimed confused click drew its damage
index from a die the authority never rolled — two INDEPENDENT values, which land on the same index
about 1 time in 16. After the fix they are ONE shared value read in OPPOSITE directions, which lands
on the same index 0 times in 16. **M6's true size is 14 games, not 10; four of them were being hidden
by a coin flip.** The engine did not get worse — the measurement stopped flattering it.

**KEPT, NOT REVERTED, AND THE REVERT IS ONE ENVIRONMENT VARIABLE.** The engine now matches the
authority (`this.activeTarget = pokemon`) and the probe proves it red-first. Reverting would mean
shipping a knowingly wrong address to protect a headline. If the 50 is wanted back before the
instrument half lands, `MEDI_CONFUSION_DMG_ADDR_LEGACY=1` restores it exactly and prints
`MEDFAILS.confusionDmgAddrLegacyRestored = 1` on every run that carries it — **that is the owner's
call, not mine, and it is named rather than taken.**

Landing the instrument half (§2) closes all 14 at once. Neither half alone can.

---

## 5. OWED

- **The instrument half of M6.** `game_differential.js` reads `getConfusionDamage`'s `random(16)`
  un-inverted because it cannot see it is a damage roll. Fix is `around('getConfusionDamage', 'dmg', 0)`
  in `midWrapShowdown` plus moving this engine's draw to the `dmg` stream in the same pass. **Moves
  `PIN_DIGEST`**, so it needs its own before/after and a MEASURE hand on the comparability guard.
  Worth roughly the 10 `confusion` causes in the baseline `classes[]` block.
- **Defog's target side, at `:26471`.** `data/moves.ts:3458` reads `target.side`; this engine reads
  the mover's far side. Only reachable through an ALLY-aimed Defog, which neither driver produces, so
  it is a lab-only fix with no probe today — it needs a directed script that can aim a `normal` move
  at a partner, which is why it is filed rather than done.
- **The three sibling `sweepField` sites are three copies of one selection.** `:26471`, `:27218` and
  `:35143` each spell the far side themselves; the first is wrong, the second is right, the third is
  unread. That is a FACTS-ARE-GLOBAL violation waiting to bite and it should become one reader.
- **80 side selections are still UNDECLARED.** The ratchet holds them at 80 and nothing says what
  they answer.
- **`data/game-differential.json` is still not republished**, so the gate clause still prints 77 of
  961. MEASURE's, not ENGINE's.
- **A stray release cut labelled `x`** was appended to `data/releases/7ffc58da8ef8/cuts.jsonl` while
  reading back the id. Cuts are append-only events and the first cut and its reason are intact; the
  noise line is reported rather than edited out.
- **`CHANGELOG.md` AND THE VERSION BUMP ARE NOT DONE.** The living-docs rule wants them in the same
  pass; the file was already modified in the working tree by another agent when this batch started
  and this brief says do not commit, so touching it would be the later-write-silently-wins collision
  CLAUDE.md warns about. It is owed to whoever publishes.
- `node engine/status.js --write` was run; the generated blocks are current as of this batch. It also
  restamps `docs/MEASURE.md`, `docs/SEARCH.md` and `docs/OPS.md`, which is what `--write` does — worth
  saying out loud because a MEASURE agent was live in the same tree. `docs/ROADMAP.md` and
  `engine/quarantine.js` were NOT touched by this batch; they show as modified because that agent is
  working on them.
- Cutting release `7ffc58da8ef8` **stranded the pinned artifacts** `engine-diff`, the three roster
  stages and the whole-game clauses: they name `8ad06030e129` and the tree has moved past it, so
  `engine/status.js` reads four gate clauses as `MEASURED AGAINST A DIFFERENT ENGINE`. That is the pin
  guard working, and a stranded artifact is a figure to WITHHOLD and re-measure, never to resurrect.
