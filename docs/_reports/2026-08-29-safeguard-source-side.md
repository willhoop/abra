# SAFEGUARD'S SOURCE-SIDE TEST — THE THIRD SITE, AND THE CLASS DERIVED RATHER THAN READ (2026-08-29, ENGINE)

**Verdict.** Safeguard was missing the near half of BOTH its handlers. `sideBuffRefuses` opened with
`if(src._sf&&src._sf===sf)return null;   // an ally is not the other side`, and the paragraph above it
read *"IT ONLY REFUSES SOMETHING WRITTEN BY THE OTHER SIDE"*. **No handler says that** — the
authority's exclusion is `target !== source`, identity, and the only `isAlly` in either handler is
inside the Infiltrator clause, where it exists so that an ALLY's infiltrating move is still refused.
One line removed, one reader, both roads.

**How many OTHER instances the derivation found: ZERO, in both frames, and the frames were widened
before they were searched.** The previous pass's two enumerations were the wrong frame for Safeguard
and are corrected below. Nothing I leave behind would catch a fourth automatically; §5 says exactly
what it would and would not do.

| | before | after |
|---|---|---|
| census live / probed / missing | 792 / 792 / 0 | **794 / 794 / 0** |
| empirical **board-parted** games (961) | 97 | **97 — UNMOVED, PREDICTED** |
| protocol diverged | 216 | **216** |
| end-state SAME / DIFFERENT / ENDED-APART / THREW | 892 / 65 / 2 / 2 | **892 / 65 / 2 / 2** |
| boards never diverged | 864 | **864** |
| `MEDSEEN.allySideBuffRefused` on the probe | (did not exist) | **3**, against 3 staged refusals |
| `MEDFAILS.sideBuffFoeSideOnlyRestored` under the knob | (did not exist) | **3** |

Pins, both arms: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen` (pool `0d103fb9fa87`), census pin `9446a684709d`. Release
`2c884278412b` → **`552e2a4510e8`**. `arms_comparable.js` reads **COMPARABLE**, and the two artifacts
are **byte-identical apart from timestamps, the release id and the source digests** — a subtree diff
was taken rather than the 60-game overlap check, and every block including `by_cause`, the class
table and the end-state cross-tab is identical string-for-string. After-artifact:
`data/verification/game-differential.safeguard.json`. `data/game-differential.json` was NOT written
(verified by mtime: still 2026-08-28 23:14, size 332138).

---

## 1. WHAT SAFEGUARD WAS MISSING

`data/moves.ts` `safeguard.condition`, read whole. `data/mods/champions/moves.ts` was grepped for the
id and contains **no match** — and `moves.ts` is one of the eight files the mod DOES override, so the
absence is a reading and not an assumption.

```js
onSetStatus(status, target, source, effect) {
  if (!effect || !source) return;                                    // source-less status walks
  if (effect.id === 'yawn') return;                                  // yawn's SLEEP walks
  if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
  if (target !== source) { ... this.add('-activate', target, 'move: Safeguard'); return null; }
},
onTryAddVolatile(status, target, source, effect) {
  if (!effect || !source) return;
  if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
  if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) { ... return null; }
},
```

**The `isAlly` is the point, not an exception to it.** `!target.isAlly(source)` sits inside the
Infiltrator early-return, so Infiltrator bypasses Safeguard **only from the far side**; an ally's
infiltrating move is still refused. The authority does not merely fail to mention the near side — it
names it and keeps it.

**STAGED IN THE OFFICIAL SIMULATOR BEFORE ANY EDIT**, p1a raising the condition on turn 1 and its
PARTNER casting at it on turn 2, the turn-1 click the only knob:

```
ally Glare,  Safeguard up    |move|p1b: Pikachu|Glare|p1a: Clefable
                             |-activate|p1a: Clefable|move: Safeguard        (and NO -status)
ally Glare,  Safeguard down  |move|p1b: Pikachu|Glare|p1a: Clefable
                             |-status|p1a: Clefable|par
ally Confuse Ray, up         |-activate|p1a: Clefable|move: Safeguard        (the VOLATILE road)
ally Teeter Dance, up        |move|p1b: Tsareena|Teeter Dance|p2b: Garchomp|[spread] p1a,p2b
                             |-activate|p1a: Clefable|move: Safeguard
                             |-start|p2b: Garchomp|confusion                 (the foe still gets it)
```

**THE FIRST STAGING WAS WRONG AND IS RECORDED BECAUSE IT WAS.** It used Thunder Wave, whose accuracy
is 90, and the control arm drew `[miss]` — a control that proves nothing, landing the comfortable
way. The fixture was rebuilt on 100-accuracy casts, and the set was **derived**: Toxic Thread,
Confuse Ray, Flatter, Glare, Spore, Teeter Dance and Yawn are the format's ENTIRE population of
`Status`-category moves at accuracy ≥ 100 whose target class can reach an adjacent body and which
write a status or a confusion/yawn volatile.

**medicham2 paralysed, confused and confused on both arms of the knob** — the unwired-knob signature.

## 2. THE FIX, AND THE ONE DOOR IT LANDED ON

`engine/medicham2-browser.js`, `sideBuffRefuses`. The ally exclusion is gone; the SIDE still decides
whose condition is asked, because `sf` is the TARGET's side object and always was. What changed is
only that the SOURCE's side is no longer a reason to skip it.

**THREE CALL SITES, ONE FUNCTION, so both roads landed at once**: `applyStatus`
(`blocksStatus` → `onSetStatus`), `applyConfusion` (`blocksVolatile` → `onTryAddVolatile`), and the
status branch's narration guard, which asks a second time to decide whether to suppress its `-fail`.
That third one is why the probe's `-activate` arm reads exactly one line and no `-fail` beside it —
the near half reached the announcement without a fourth edit.

**THE COUNTER WAS WRONG FIRST AND THE FIX IS IN THE FILE.** Counting inside the function made one
near-side Glare read **2**, because the narration guard re-asks about a refusal that already
happened — the number described the fixture rather than the defect, which is the exact failure the
knob-count discipline exists to prevent. `sideBuffRefuses` now takes a `quiet` argument and the
narration guard passes it. Measured after: `allySideBuffRefused = 3` against 3 staged refusals, and
`sideBuffFoeSideOnlyRestored = 3` under the knob. Symmetric.

`MEDI_SIDEBUFF_FOE_SIDE_ONLY=1` puts the exclusion back. The knob count is taken **where the refusal
would have happened** — inside the loop, after the condition has matched — not at the top of the
function, because an early return would bump it once per near-side status call on a bare side.

## 3. THE ENUMERATION — AND THE PREVIOUS PASS'S FRAME WAS WRONG FOR THIS ONE

```
Dex.forFormat('gen9championsvgc2026regmb'), filtered exists && !isNonstandard && tier !== 'Illegal'
```

### 3a. The side-condition frame, widened twice

The ally-side report enumerated *"the eleven legal moves with a side condition, two of which carry an
`onTryHit`"*. **Both halves of that sentence are too narrow for Safeguard, and re-deriving is what
showed it:**

- it counted `sideCondition` only. Adding `slotCondition` gives **13**, not 11 — Healing Wish and Wish
  were outside the frame;
- it asked for `onTryHit`. Safeguard's decision handlers are `onSetStatus` and `onTryAddVolatile`.
  **The right question is not which handler NAME it is, it is which handlers RECEIVE A SOURCE**, since
  a handler that is never handed a source cannot be asked a near/far question at all.

Re-derived on that frame — every legal move laying a side or slot condition, and which of its
condition handlers take a `source`:

```
auroraveil   allySide  onAnyModifyDamage,onSideStart,onSideEnd     || source: onAnyModifyDamage
healingwish  self      onSwitchIn,onSwap                           || source: -
lightscreen  allySide  onAnyModifyDamage,onSideStart,onSideEnd     || source: onAnyModifyDamage
quickguard   allySide  onSideStart,onTryHit                        || source: onSideStart,onTryHit
reflect      allySide  onAnyModifyDamage,onSideStart,onSideEnd     || source: onAnyModifyDamage
safeguard    allySide  onSetStatus,onTryAddVolatile,onSideStart,onSideEnd || source: the first three
spikes       foeSide   onSideStart,onSideRestart,onSwitchIn        || source: -
stealthrock  foeSide   onSideStart,onSwitchIn                      || source: -
stickyweb    foeSide   onSideStart,onSwitchIn                      || source: -
tailwind     allySide  onSideStart,onModifySpe,onSideEnd           || source: onSideStart
toxicspikes  foeSide   onSideStart,onSideRestart,onSwitchIn        || source: -
wideguard    allySide  onSideStart,onTryHit                        || source: onSideStart,onTryHit
wish         self      onStart,onResidual,onEnd                    || source: onStart
```

**Five entities carry a source-taking DECISION handler** (the `onSideStart` ones take a source only
to check `hasAbility('persistent')` for the announcement, which decides nothing about who is
affected):

| entity | handler | verdict |
|---|---|---|
| Quick Guard, Wide Guard | `onTryHit` | fixed as card C3, 2026-08-29 |
| **Safeguard** | **`onSetStatus`, `onTryAddVolatile`** | **this pass** |
| Reflect, Light Screen, Aurora Veil | `onAnyModifyDamage` | **already correct, checked rather than assumed** |

**The screens were checked, not waved through, and the check had a real chance of failing.** Their
handler is `if (target !== source && this.effectState.target.hasAlly(target) && …)` — the side test is
on the **TARGET**, so a partner's own spread move IS reduced by its own side's Reflect. medicham2's
screen read is `const _sf = def && def._sf; if (_sf && !_critHere && …)` — keyed off the defender's
side and **blind to the attacker's**, which is the authority's rule. The identity half is honoured
too: their `target !== source` excludes self-inflicted confusion damage, and
`confusionSelfDamage`'s own comment reads *"NO STAB, NO TYPE CHART, NO CRIT, NO SCREEN, NO BURN"*.

**The frame is now closed: every legal side condition whose handler can be asked a near/far question
has been asked it.**

### 3b. The field-wide frame, widened to items

The ally-side report enumerated the 7 legal abilities with an `onAny*` handler. Re-derived, that set
is confirmed exactly — and the walk was **widened to items and to move conditions**, which the
previous pass did not do:

```
ABILITIES with onAny*, legal carriers > 0:
  damp 3, fairyaura 1, friendguard 22, lightningrod 5, noguard 6, opportunist 1, unaware 2
  (15 more exist in the dex with ZERO legal carriers and cannot occur: aurabreak, beadsofruin,
   commander, darkaura, deltastream, desolateland, pastelveil, poisonpuppeteer, primordialsea,
   soulheart, stormdrain, swordofruin, tabletsofruin, vesselofruin, victorystar)
ITEMS with onAny*:            whiteherb  (onAnySwitchIn, onAnyAfterMega, onAnyAfterMove)
MOVE CONDITIONS with onAny*:  auroraveil, lightscreen, reflect  (the screens, above)
                              uproar     (onAnySetStatus)
```

Every one with a legal carrier was checked against this engine's gathering:

| entity | our gathering | verdict |
|---|---|---|
| Damp | `[...actA,...actB].some(...)` | field-wide — correct, and its own comment says so |
| Fairy Aura / Aura Break | `auraStateOf(bodies)` over all four actives | field-wide — correct |
| Friend Guard | the partner is found on **the TARGET's own side**, `actA.indexOf(tg)>=0?actA:actB` | correct, and its comment names the Earthquake-clips-own-ally case that would break an `it.side` read |
| Lightning Rod | fixed as card C2, 2026-08-29 | — |
| No Guard | `_neverMissAb(att) || _neverMissAb(def)` | pairwise, side-blind — correct |
| Opportunist | its copy trigger is `onFoeAfterBoost` | side-scoped by the authority itself |
| Unaware | pairwise through `ignoresBoosts` | correct |
| Uproar | `refreshSleepBlock` writes the identical boolean onto BOTH side objects | field-wide, and its comment argues the point |
| White Herb | self-scoped (its own spend plus the Symbiosis pass) | not a near/far question |

**Zero further instances.**

### 3c. The engine-side enumeration, which is frame-free

The two frames above ask *where COULD the belief live*. This one asks *where DOES this engine
restrict something to the far side*, and it is finite and complete. Every same-side comparison in
`medicham2-browser.js` that leads to a skip, after this pass:

```
4626   Pressure           an ally charges nothing        -- authority: `if (target.isAlly(source)) return`
15488  notFromAlly        a tag PARAM, derived from the handler's own `if (!source || target.isAlly(source)) return`
16551  Destiny Bond       refuses an ally's kill         -- authority: `target.isAlly(source)` returns early
20454  excludesAlly       a tag PARAM
30323  foesOnly           a tag PARAM
17209  _foes = m._sf===sfA ? actB : actA   -- an ARRAY SELECTION for a foe-directed effect, not a gate
```

Five gates, **three of them derived from a tag param rather than written**, and the two that are
written each cite the authority line they came from. `sideBuffRefuses` was the sixth and is gone.

The other spelling — card C2's, where the CANDIDATE ARRAY is `it.side==='A'?actB:actA` — occurs about
forty times and is correct at every one of them, because an array-of-foes is only wrong when the
authority's handler is field-wide or adjacency-scoped. That is exactly the population of §3b plus the
redirect family, and both are enumerated and clean.

## 4. THE PROBE, RED FIRST

`tests/probe_ally_safeguard.js`. Shown red on the shipping engine before anything was edited, with
the unwired-knob signature — **identical readings across a varied knob**:

```
glare       ally casts, no Safeguard   [status par, confused false]
glare       ally casts, Safeguard up   [status par, confused false]      <- identical
confuseray  ally casts, no Safeguard   [status -,   confused true ]
confuseray  ally casts, Safeguard up   [status -,   confused true ]      <- identical
                                                                            5 FAILED
```

After the fix, `all checks passed`. Under the knob, `MEDI_SIDEBUFF_FOE_SIDE_ONLY=1` gives
`4 FAILED` — **exactly the four near-side arms** (the Glare, its `-activate` line, the Confuse Ray,
the Teeter Dance) and nothing else, with `sideBuffFoeSideOnlyRestored = 3` and
`allySideBuffRefused = 0`.

**THE PROBE WAS WRONG BEFORE THE ENGINE WAS, AND IT IS RECORDED.** Its first draft read
`me.confused`, which is not a field this engine has — `applyConfusion` writes `t._vol.confusion`. It
returned `undefined` on every arm, so the CONTROL arm ("with nothing up, our partner's Confuse Ray
confuses us") went red while measuring nothing at all. Caught by asserting the control explicitly.
The volatile's name is now read off the engine and the reason is written at the line.

**THE ELEVEN ARMS, ALL MEASURED.** Seven of them are negative, because an over-firing fix refuses
statuses that should land, and that is worse than the gap:

| arm | knob | result |
|---|---|---|
| our own Safeguard vs our partner's **Glare** | the turn-1 click | par → clean |
| the **`-activate` line**, naming the shielded body | — | one line, names the partner, no `-fail` beside it |
| our own Safeguard vs our partner's **Confuse Ray** (the VOLATILE road, a different handler) | the turn-1 click | confused → clean |
| the knob **moves** the outcome on both roads | — | it does; identical readings would mean unwired |
| **a FOE's Glare** — the WIRE 133 regression | side | refused on both arms, `par` with no Safeguard |
| **the FOES' Safeguard** and ours bare | which side raised it | our body still takes `par` — a side condition still belongs to a side |
| **a SELF-inflicted Rest** under our own Safeguard | who casts | still `slp` — the exclusion is IDENTITY |
| **Teeter Dance**, `allAdjacent`, one click across the field | the turn-1 click | our partner clean, **a foe still confused on both arms** |
| an ally's **Icy Wind** — a stat DROP, not a status | the road | unrefused; Safeguard carries `blocksStatus`, not `blocksStatDrop` |
| an ally's **Earthquake** — damage | the turn-1 click | **72 on both arms**, bit-identical |
| the condition still **expires** on schedule | — | 4 after the click, gone four turns later |

**Two census rows added**, both under `move`/`sideBuff`, beside the far-side row that has been green
since WIRE 133: *"Safeguard refuses the status its OWN PARTNER wrote, and not the body's own"*
(three arms: no Safeguard, our Safeguard, and the same Safeguard against the body's own Rest) and
*"Safeguard refuses the CONFUSION its own side's spread move wrote"* (a Teeter Dance, with the FOE
half asserted true on both arms). Census **792 → 794**, 0 missing, 0 threw, 0 hollow, 0 unarmed,
directCall floor unmoved at 1.

## 5. WOULD A FOURTH INSTANCE, SPELLED DIFFERENTLY, BE CAUGHT?

**By something that runs on its own: NO. Say so plainly.** The three census rows ratchet the three
known sites and are silent about a fourth; the knob reds only the arms it was written for; nothing in
this repository scans for the belief.

What is actually left behind, and what each of it is worth:

1. **One door for the `sideBuff` family, and that IS a class property rather than an instance fix.**
   `sideBuffRefuses` is the only reader of the tag and all three call sites go through it, so a second
   move that lays a status-blocking or volatile-blocking side condition arrives with the near half
   already wired and no name spelled anywhere. The probe prints the tag's membership on every run, so
   a second carrier appearing is visible rather than assumed. **This covers ONE family, not the class.**
2. **Two derivations that cannot go stale, because they derive.** §3a and §3b are each one command
   against `Dex.forFormat`, and the exact commands are below. They are the honest answer to "derive
   the set rather than reading around" — but they are commands a person has to run, not a gate.
3. **The engine-side enumeration in §3c**, which is the only frame-free one: five same-side gates,
   three of them from tag params. A sixth arriving is a one-line grep away, and that grep is written
   down. It is still a grep, and this repository's own rule is that a grep is a claim about a name.

**The species-key comparison in the brief is apt and the honest position is that this pass has not
answered it.** A gate that would catch a fourth would have to assert that every effect whose
authority handler is side-blind is gathered side-blind here, and no artifact currently records
"which handler does this consumer implement". Building that mapping is its own batch and is filed in
`## OWED, NOT RUN`.

```bash
# §3a — every legal side/slot condition and which handlers take a source
SHOWDOWN_PATH=... node -e "…D.moves.all().filter(legal).filter(m=>m.sideCondition||m.slotCondition)…"
# §3b — every legal ability, item and move condition with an onAny* handler, with legal carrier counts
SHOWDOWN_PATH=... node -e "…/^onAny/.test(k)…"
# §3c — every same-side gate left in the engine
grep -nE "_sf===|===sf\b" engine/medicham2-browser.js | grep -Ei "return|continue|null|false"
```

## 6. WHICH SCOREBOARD, SAID BEFORE THE RUN

Stated before the differential was launched: **the LAB should move and the POOL should not.**
Safeguard is **22 corpus uses** in `data/tags.json` — three orders of magnitude below Tailwind
(23,412) and Light Screen (5,873) — and the near-side road needs a Safeguard up AND an ally-aimed
status or confusion-writing spread move into it, in the same game, inside 12 turns. Measured in the
frozen pool before the run: **17 of 13,214 games mention `safeguard` at all (0.13%)**, against 50 for
`glare`, 13 for `confuseray` and 6 for `teeterdance`, and the co-occurrence is far below either.

**That is exactly what happened.** Board-parted **97 → 97**, protocol **216 → 216**, every block of
the artifact identical string-for-string. This is Will's 2026-08-23 ranking call working as intended:
a rare mechanic moves the lab and not the pool, and that is the expected result rather than a failed
fix.

## 7. FILED, NOT FIXED — TWO THINGS THIS PASS FOUND AND DID NOT LAND

- **A FOE'S YAWN IS NOT REFUSED BY SAFEGUARD HERE AND IS IN THE AUTHORITY — AND THE ENGINE'S OWN
  COMMENT ASSERTS THE OPPOSITE.** `safeguard.condition.onTryAddVolatile` names `yawn` beside
  `confusion`, so a Yawn aimed into a Safeguard is refused with `-activate`. Staged:

  ```
  |move|p2a: Slowbro|Yawn|p1a: Clefable      |-activate|p1a: Clefable|move: Safeguard
  ```

  medicham2 writes `|-start|p1a: clefable|move: Yawn` and drowses the body, and the comment above
  `canTakeStatus`'s yawn branch says *"SAFEGUARD is an `onSetStatus`, so a Safeguarded body takes the
  drowse in the authority and only fails the SLEEP two turns later"* — which is false; Safeguard is
  BOTH handlers. **This is the FAR side, not the near one**, so it is a different defect from the one
  landed here and it is one batch of its own. Not staged against a census row, not claimed fixed.
- **INFILTRATOR DOES NOT BYPASS SAFEGUARD AT ALL.** `if (effect.effectType === 'Move' &&
  effect.infiltrates && !target.isAlly(source)) return;` has no implementation —
  `infiltrator` appears twice in `medicham2-browser.js` and neither is this. Also the far side, also
  its own batch. Named here so the next pass does not re-derive it.

---

## OWED, NOT RUN

- **A GATE FOR THE CLASS, WHICH IS THE HALF OF THIS BRIEF THAT IS NOT DONE.** §5 states it: nothing
  left behind catches a fourth instance spelled differently. What it would take is an artifact
  mapping each engine consumer to the authority handler it implements, so "is this gathered
  side-blind where the handler is side-blind" becomes a comparison rather than a reading. That is its
  own batch and it belongs with whoever owns `engine/tag_dex.js`'s derivation.

- **`tests/test-resolution-order.js` DIES ON A HEAP LIMIT, AND IT IS NOT MINE — A/B VERIFIED RATHER
  THAN ASSUMED.** `FATAL ERROR: Reached heap limit Allocation failed`, rc=134. Re-run against
  `git show HEAD:engine/medicham2-browser.js` swapped into the tree and back (digest checked either
  side of the swap: `ff3174c89bec5b137ca7c12f4c7b2c51` on HEAD, `38332fd8d2ee33ec81f19d0b41edaf34`
  restored), and it produced the identical FATAL and the identical exit code on HEAD. **It is a third
  pre-existing red beyond the two the brief named**, it is reported rather than filed, and it is not
  fixed here — that is one batch of its own and this was a batch of one. It reads the LIVE store
  (12,163 games) and the live census, so it is also the one instrument in this pass that the census
  regeneration changes the input of.

- **THE TWO PRE-EXISTING REDS THE BRIEF NAMED ARE STILL RED AND NEITHER GOT WORSE.**
  - `tests/probe_shield_refusal_line.js` — `13 arms staged, 1 failing`, the same `twave-shield`
    CONTROL arm whose own message is *"the knob did not reach the driver's module"*. Identical count
    before and after.
  - `tests/probe_random_target_address.js` — `LENGTH MISMATCH sd=61 sites=62`, identical. It rebuilt
    its pool cache on this run (`pool digest f807cbc40299`, 8,778 teams) and cut a release of the live
    tree as a side effect, which is why `data/releases/db25a6564011/cuts.jsonl` carries a cut reading
    *"game differential mode A"* one minute before mine. Stated so it is not read as another agent.

- **The three roster stages and `all_mechanics_fire.js` are stale against release `552e2a4510e8`.**
  Carried forward from the three previous passes, not created here — they last ran on `e129bca605e3`.
  Nothing this pass touched is staged by either instrument except through the two new census rows, so
  a re-run is expected to reproduce **items 140 / abilities 129 / moves 475 with zero in both failure
  columns** and `all-mechanics-fire` **moves 4, abilities 1, items 0**.

  ```
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage items      --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage abilities  --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage moves      --write
  SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --write
  ```

- **`data/game-differential.json` — the COVERAGE arm — was not re-run.** The coverage driver parted 6
  times in 961 games and 0 of those were board-material; nothing here can move it. Expected
  **961 games / 6 raw / 6 declared / 0 that count**.

  ```
  SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js --end-state --arm middle \
    --games 1200 --turns 12 --release 552e2a4510e8 --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json --write
  ```

- **`tests/test-engine-diff.js` was NOT run**, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. Nothing in this pass touches a damage path — the change is inside a status
  refusal, and the probe asserts an ally's Earthquake deals **72 on both arms** — so a re-run is
  expected to reproduce **0/6000 at all sixteen corners, seed 20260804**.

- **The turn cap is 12** and ~48% of these games reach an ending, so a divergence that would first
  appear after turn 12 reads as narration here. Unchanged from every previous arm; stated so the 97
  is read as what it is.

- **`node engine/status.js --write` restamped the generated blocks.** The feature-semantics banner
  that prints above it (`policy-weights.json`, damage table regenerated) is pre-existing and belongs
  to MEASURE, not to this pass.
