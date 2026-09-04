# The 43 open rows that assert breakage with nothing to decide them — read against the code, 24 are already false — 2026-09-04 (MEASURE)

Scope: READ-ONLY. Nothing was run that plays a game, nothing heavy, no edit to `docs/ROADMAP.md`, no
commit, no `VERIFIED BY` written anywhere. `engine/register_reality.js` was NOT run in any mode. The
row set was derived once by a scratch script that imports `roadmapRowIsClosed` / `roadmapRowSaysBroken`
from `engine/quarantine.js` (never re-implemented) and lifts the `MARKER` and `OWED` regex literals out
of the shipping bytes of `engine/register_reality.js` by line, throwing if either literal has moved.
It reproduces the hygiene report exactly: **506 register rows, 261 open, 74 open asserting breakage,
43 of those carrying neither an admitted marker nor a declared `INSTRUMENT OWED`.**

**Reading discipline, because an ENGINE agent is live in `engine/medicham2-browser.js` (mtime 15:49)
and `engine/game_differential.js` (15:39).** Every claim below about the simulator is read from
`git show HEAD:engine/medicham2-browser.js`, not from the worktree, and is therefore a statement about
**HEAD (`3072a919`)**, not about whatever ENGINE has uncommitted. Same for
`data/mechanics-census.json`, `data/game-differential.json`, `data/roster.moves.json` and
`data/roster.items.json`. `data/tags.json` (09:37) and `docs/ROADMAP.md` (16:08) were read from the
worktree; both are settled and neither is owned by the live agent.

---

## THE FOUR COUNTS

| | count | of 43 |
|---|---|---|
| **ALREADY FIXED** — the row's claim is FALSE at HEAD, in whole | **24** | 56% |
| **ALREADY COVERED** — another register row owns the claim or a named part of it | **6** | (overlaps the above) |
| **AN EXISTING INSTRUMENT ALREADY EXERCISES IT** — needs a `VERIFIED BY` line and nothing else | **28** | 65% |
| **NEEDS A NEW PROBE** | **15** | 35% |

The last two partition the 43. `ALREADY FIXED` is a subset of `AN EXISTING INSTRUMENT`. Two rows —
**#421 and #441** — are `CANNOT TELL FROM THE ROW` on the truth question and are counted under
"existing instrument" and "needs a new probe" respectively, on which one would settle them.

**None of the 43 holds the MEDICHAM gate shut.** `openDefectClause` puts a marker-less row in `debt`
and `ok` is `withRed.length === 0`. Everything here is register hygiene, not gate movement — which is
why 24 stale rows survived: nothing went red when they went false.

### The cheapest five, by name

1. **#531 — CLOSED IN ITS OWN STATUS CELL AND PARSED AS OPEN.** Not a triage judgement; a parse bug.
2. **#360 — an exact duplicate of #456, which is CLOSED.** Same defect, same sentence, same fix.
3. **#312 — all three named bullets plus the Hustle rider are landed.** One is #518, CLOSED.
4. **#327 — all three "genuinely absent" mechanics are present and census-probed.**
5. **#341 — Suction Cups on the damaging phaze branch is wired, with counters and a control.**

Each is a row edit backed by an instrument that already runs. Five rows, no new code.

---

## 1. #531 IS THE ONE THAT IS NOT A JUDGEMENT CALL — IT IS CLOSED AND THE PARSER CANNOT SEE IT

`roadmapRowStatusCell(l)` is `l.match(/\|\s*([^|]*)\|\s*$/)` — the text after the **last** pipe.
#531's closure narrative quotes a protocol line with **unescaped pipes**:

```
… the authority writes `|-unboost|TARGET|atk|0` where this engine writes `|-fail|…|ability: Clear Body`
— board-identical, narration-only, its own landing. Account: …
```

So the extracted "status cell" is `ability: Clear Body` — board-identical, narration-only, its own
landing. Account…`, which begins with neither `open` nor `closed`. Measured through the shipping
detectors:

```
cellClosedRegex   false          (the cell as authored begins "**closed 2026-08-29 — LANDED.")
isClosed          false
saysBroken        true           (prose fallback: "IS NOT IMPLEMENTED" in the row's own title)
```

The row is closed, landed and **committed** — its cell records release `eb6a797411cd` → `124f5aa8c8bd`,
census 798 → 801, empirical board-parted 93 → 92 of 961 — and `tests/probe_partingshot_conditional.js`
**exists on disk** (19 arms, 5 red, 14 controls). `data/tags.json` confirms the derivation half landed:
`moves.partingshot.params.pivotStatus` is
`{selfSwitch:true, conditional:true, cancelsWhen:"noStatChangeLanded", exceptAbilities:["mirrorarmor"]}`.

**This is the only one of the 43 whose status cell misparses.** All 42 others extract cleanly to a cell
starting `open`. So it is a single row's escaping and not a class — but it is worth saying that the
detector reads a row's LAST pipe segment and any row quoting a protocol line at the end of its status
cell will do the same thing silently.

**Existing instrument:** `node tests/probe_partingshot_conditional.js`. **Cost: one row edit.**

---

## 2. ALREADY FIXED — 24 rows, each with the evidence that says so

Evidence classes used, strongest first: a **live census row** (`data/mechanics-census.json` at HEAD,
829 results, the row's own claim as a probe label); a **roster verdict** (`data/roster.{moves,items}.json`,
generated 2026-09-04 07:06–07:11, both stages **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE**); a
**knob + counter** in the simulator (`MEDI_*` restoring the old behaviour, which is this repo's proof
that the new behaviour is wired and fallible); a **cause absent from the HEAD differential**.

| row | its claim | why it is FALSE at HEAD |
|---|---|---|
| **#312** | Shell Side Arm / Sand Force / Metronome item / Hustle, three root-caused and unfixed | Shell Side Arm is **#518, CLOSED** (`categoryPicked`, knob `MEDI_NO_CATEGORY_PICK`); `data/tags.json` `abilities.sandforce.params.damageBoost.onType` is now **`["Rock","Ground","Steel"]`** — all three alternatives — and the engine folds it into the base-power chain; Metronome is consumed at two sites (WIRE 158) with two census rows; Hustle is LIVE at `med:9425` (`{side:'att',mult:0.8,when:'physical'}`) |
| **#317** | Fur Coat carries no defence multiplier, so we deal double physical | `tags.json` `abilities.furcoat` now carries `condStatMult {stat:"def", mult:2, when:"always"}`; the engine's consumer names ROADMAP #317 in its own comment; census: *"Fur Coat halves physical damage with no condition at all, and Mold Breaker takes it back"* |
| **#327** | three mechanics genuinely absent: Sticky Hold/Trick, `punishesMinimize`, Metronome | all three present. Census: *"Trick into Sticky Hold announces `-immune` on the TARGET"*, *"Switcheroo into Sticky Hold announces it too"*, *"Body Slam cannot miss a minimized body and hits it for double"*, *"the Metronome item makes damage CLIMB…"* + *"…RESETS when the holder changes move"*. The row's premise that `stickyhold` and `minimize` "appear NOWHERE" in the simulator is false (1 and 17 occurrences) |
| **#329** | `onDamagingHit` fires once per move and resolves before secondaries | census: *"a two-hit volley raises DamagingHit between its arrivals, not once below both"*; knobs `MEDI_REACT_BATCHED` (where each firing lands) and `MEDI_VOLLEY_REACT_DRAWN` (how many times it fires), landed 2026-08-29/30, deliberately knobbed apart |
| **#331** | we announce a faint at lethal damage; the authority batches to action end | `_FAINTQ` / `queueFaint` / `faintLineQueued` with `MEDI_FAINT_INLINE=1` restoring the old inline write; census: *"Final Gambit writes the USER's faint before the TARGET it just killed"* — the row's own `lastFirst` case |
| **#332** | a berry is eaten before `upkeep` and before faint processing, and it flips KOs | census: *"a body the residual chain kills is DEAD before its Sitrus is reachable"* — the row's exact staged assertion — plus *"a Sitrus eats in the group that dropped it"* and *"the Sitrus is eaten BETWEEN the two attackers"* |
| **#333** | the multi-hit damage path never got the sixteen-index roll | WIRE 147 `perHitDamageLoop` / `perHitBasePower`; `damageRollIndex` is drawn **per packet** (`_pkArr.push(_pks[i].band[damageRollIndex(_au)])`); census: *"each hit of a multi-hit move arrives as its own damage packet"* |
| **#335** | a per-target secondary lands on the wrong body | `secAddrFromLastTarget` / `secAddrMovedByFire` counters and the knob **`MEDI_SEC_ADDR_PER_TARGET`**, dated 2026-08-26, describing the authority's `activeTarget` at `BattleActions#secondaries` |
| **#337** | `onTryImmunity` is not derived, six legal moves carry no immunity gate | `tags.json` `moves.endeavor.params.immunityGate` carries `hook:"onTryImmunity"`, the parsed condition, `readable:true` and the handler text; the engine reads `immunityGate` at 30 sites; census: *"Endeavor at equal HP is IMMUNE — no damage AND no damage LINE"* — the row's 135/135 case |
| **#338** | Life Orb recoil did not fire for a whole turn | census: *"the Life Orb toll is refused by a move that MISSED"* and *"the Life Orb toll is owed by a move that CONNECTED, not by the range it was built with"*; engine counters under ROADMAP #338 with `MEDI_ORB_STALE_RANGE`; roster `lifeorb` MATCH |
| **#339** | a spread drain heals once over the summed damage | census: *"a SPREAD drain rounds once per body, not once over the summed damage"* + *"…heals at each target's own damage line, naming that target"*; knob `MEDI_DRAIN_LUMP_ROUND`; **roster `matchagotcha` is FIRED-AND-BOARDS-MATCH**, where the row recorded it FIRED-AND-BOARDS-DIFFER |
| **#340** | our bench is in a different order from the authority's; both instruments blind | census: *"a drag indexes into the bench in the AUTHORITY's order — a body that switches out takes the incoming body's party slot"*, which is `battle-actions.ts:125-132` verbatim |
| **#341** | Dragon Tail / Circle Throw ignore Suction Cups | the DAMAGING branch now reads it: `const _rfsd=TAGS.param('ability',suppressedAbility(m,tg),'refusesForcedSwitch')` with `forcedSwitchRefusedDamaging` and a `DRAG_ABILITY_FIRST` control; census: *"Suction Cups cannot be dragged out by Roar OR by Dragon Tail, and Mold Breaker ignores it"* |
| **#343** | a failed Roost leaves the user flying there and grounded here | census: *"a Roost that heals NOTHING grounds nothing — the self-rider is skipped when the primary failed"*; engine counters at ROADMAP #343 for the un-applied self-rider |
| **#345** | a volatile counter's expiry is unannounced and nothing proves the same turn | census: Throat Chop — *"the silence lasts the turn it lands and ONE more, and its end is a line"*; Infestation — *"…chips at the end of each turn"*, *"the trap chip names the MOVE that bound the body"*; Perish — seven `perishClock` rows including *"the perish counter reads 3 / 2 / 1 at the ends of turns 1, 2 and 3"* and *"every affected body faints at the end of turn 4"* |
| **#347** | the roster credits Spiky Shield on a scenario with `setup: []` | `data/roster.moves.json` at HEAD: `spikyshield` is **FIRED-AND-BOARDS-MATCH** with a real staged setup — *"Avalugg-Hisui shields a lethal Flash Cannon; Salazzle beside it carries the same move, does NOT click it, and must die"* — i.e. a scenario that can fail, plus a knob-cleared control |
| **#356** | Protean does not fire on a mega forme | `data/roster.items.json`: `greninjite` **FIRED-AND-BOARDS-MATCH** (was FIRED-AND-BOARDS-DIFFER on two releases); `typechange` returns **0 causes** in the HEAD differential; engine carries `ROADMAP #356 (RESCOPED)` counters and census: *"Protean converts on a STATUS move… and still only once per switch-in"* — the latch Will named |
| **#360** | Telepathy: right board, wrong line type | **duplicate of #456, CLOSED.** Knob `MEDI_ALLY_REFUSAL_IMMUNE` restores the `-immune`; census: *"Telepathy announces `\|-activate\|ally\|ability: Telepathy`, not `\|-immune\|`"*; `telepathy` returns **0 causes** in the HEAD differential |
| **#371 (a) and (b)** | Endure never reaches the stall gate; a repeat trap is not refused | (a) census: *"ENDURE faces the same willAct gate as a shield — it never did"* and *"a SECOND consecutive Endure loses the 1/3 roll"*. (b) census: *"a SECOND Mean Look into an already-trapped body FAILS, and feeds Stomping Tantrum"*. (c) is unattributable by construction and is **#375's**, which is open |
| **#384** | `vol.focusenergy` parts on four moves, both directions | census: *"Focus Energy and Dragon Cheer REFUSE each other - the second one to arrive does not land"*; the engine derives membership off `exclusiveWith` rather than the family, with `MEDI_CRIT_VOLATILE_BLIND` restoring the unwired state |
| **#385** | Big Root's multiplier rounds differently and compounds | `tags.json` `items.bigroot.params.healMultBySource.mult` is **1.2998046875** (5324/4096) over all five sources; census: *"Big Root multiplies the ALREADY-ROUNDED drain, in Showdown fixed point, not the raw fraction"*; roster `bigroot` MATCH |
| **#418** | a screen-breaking move clears screens through immunity, Protect and a miss | **both arms are census rows**: *"Psychic Fangs leaves the screen up when the target is immune to it"* and *"Brick Break and Psychic Fangs leave the screens standing when the hit never lands"* |
| **#422** (remainder) | the residual sort still uses `Array.prototype.sort` | `residualOrder()` at HEAD is the authority's **selection sort** (`while (sorted+1 < list.length)` with the swap that moves untied bodies past the tied pair), with `RESIDUAL_STABLE_SORT` restoring the plain sort; census: *"two Tailwinds ending on one turn come out in the order the authority's selection sort leaves them"* |
| **#531** | see §1 | closed, landed, committed, probe on disk |

**Two rows are HALF false and stay open on the other half** (counted under STILL TRUE below):

- **#529** — the ENGINE half is done: census *"Bug Bite and Pluck make the ATTACKER eat the stolen berry
  - the line, the effect, and NOT lastItem"*. The **derivation** half is untouched and I confirmed it
  by value: `tags.json` `moves.bugbite.params.takesTargetItem` is still
  `{consumesAndGainsEffect:false, swaps:false, removes:true}`, and `pluck` identically. Still blocked on
  pinning the store for a `tag_dex.js` regeneration, exactly as the row says.
- **#467** — (a) the `randomTarget` address repair appears to have ridden in under **#543** (open),
  whose counter is dated 2026-09-04 and names *"the `randomTarget` re-roll"* as one of two producers of
  a moved middle-arm address. (b) is untouched: `engine/game_differential.js` writes `void_games` and
  `usable_games` at the top level and **no `void_n` beside `n` on a cause**, which is the field the row
  asked for.

---

## 3. STILL TRUE — 15 rows, checked against the thing they name

| row | checked | verdict |
|---|---|---|
| **#220** | Protect `-fail` vs `-singleturn` | **TRUE but much smaller.** HEAD differential still holds the family at **4 causes / 6 games**, against the 32 the row cites. Its two remaining candidates are both settled elsewhere: the `willAct()` membership is `['move','switch','instaswitch','shift']` at HEAD and **#232 is CLOSED**; the Encore/stall road is **#543, open**. The row is a stale COUNT more than a stale claim |
| **#289** | zero-magnitude stat lines | **TRUE.** HEAD differential still shows `event missing from medicham2 :: \|-boost\|p2b\|atk\|0` and `\|-unboost\|p1b\|spe\|0`. `boostZeroSuppressed` is still an opt-in-per-call-site counter. The row's diagnosis (a fourth and fifth site) is the expected shape |
| **#310** | `traceChoiceNoDie` | **TRUE.** Still incremented at HEAD (`else MEDSEEN.traceChoiceNoDie++`). Deferred by cost, correctly |
| **#314** | `tests/probe_bench_plants.js` exit code | **TRUE, verbatim.** It prints `N plant(s) applied and not caught` and sets **no** `process.exitCode`; the only `process.exit` in it is the `2` for a missing `SHOWDOWN_PATH`. The owed work — exit 1 while any plant is applied-and-not-caught — has not been done |
| **#315** | a fainted mega's forme | **TRUE, and its sibling is closed.** `#503` (CLOSED) restored **types** on the faint path (`typesRestoredOnFaint`); nothing at HEAD restores **species / maxhp**, there is no census row for it, and the mega census rows are all about evolution rather than regression |
| **#323** | class A of `data/mutation-coverage.json` | **TRUE.** The artifact is dated **2026-08-22** and `tests/mutation_harness.js` still emits `defectClass` / `defectWhy` / `defectEvidence` with no sibling-tag column |
| **#325** | provenance params in the mutation battery | **TRUE.** `nestedParamsSkipped` and `nullParamsSkipped` exist; there is no provenance-field skip |
| **#334** | confusion self-hit index | **TRUE, and re-diagnosed.** HEAD differential still carries `\|-damage\|p1a:raichu\|5/135tox\|[from]confusion` vs `6/135tox`. The engine's own block now says the addresses MATCH (`any`, not `dmg`) and re-attributes the remainder to **an instrument gap** (`game_differential.js` inverts `random(16)` only for `MID_CAT==='dmg'`) plus a **missing draw of ours** (the authority spends `this.random(2,6)` in `confusion.onStart`; we take the duration from the tag). ENGINE has an untracked `tests/probe_confusion_selfhit_address.js` in the tree right now |
| **#348** | `tools/lownode.cmd` argument quoting | **TRUE.** `tests/test-lownode.js` has no arm passing an argument with a space or a drive-letter path |
| **#349** | the rollup's ranking key | **TRUE.** `max_uses` and `entityStanding` are unchanged in `engine/game_differential.js`, and no ranking key is printed beside a cause |
| **#350** | the debt bucket's sentence | **TRUE, verbatim.** `quarantine.js:2832` is still `if (!v || !v.cmd) { debt.push(r); continue; }` and the line still reads *"open row(s) assert breakage with NO instrument that decides them"*. A row with a marker and no verdict in a stale artifact is still bucketed as naming nothing. (`rejected` and `unrunnable` now exist as separate keys — that is the part of #350 that landed) |
| **#380** | two owners of "what does exit 2 mean" | **TRUE.** `classifyExit()` lives in `register_reality.js`; `run-all.js` still has its own `r.status === 2` rule. The clause's `cannot_answer` is still not wired |
| **#442** | a census its own tree cannot reproduce | **TRUE.** No check anywhere regenerates the census from the committed tree and compares it to the committed artifact |
| **#446** | `tests/test-resolution-order.js` | **HALF TRUE, and the red is gone.** The file now declares `ABRA-HEAP: 6144` in its header, so the runner half is closed as the row says. The **leak** — ~26 release snapshots resident at once — is untouched |
| **#467 (b)** | void attribution | **TRUE.** No `void_n` per cause; `wholeGameClause` still reads `j.diverged / j.games` |
| **#529** (derivation half) | `takesTargetItem` on Bug Bite / Pluck | **TRUE.** Values confirmed unchanged in `data/tags.json` |
| **#530** | a release does not freeze `rollout-switch-census.json` | **TRUE.** The filename does not appear in `engine/engine_release.js` at all, so it is not in `SOURCES` and the pinned read still resolves inside the release directory |

## 4. CANNOT TELL FROM THE ROW — 2 rows

- **#421** — `tests/roster.js --stage all` against the three per-stage runs. Per stage at HEAD,
  `axekick` and `electrify` are both **DEFERRED-BY-OWNER**, which is one half of the row's pair; the
  `--stage all` half cannot be known without running that invocation, which plays games. The row's
  question is a **diff between two invocations**, and no artifact records the `all` run.
- **#441** — a single-game replay is not reproducible in isolation. `_RES_TIE_GEN` is bumped inside the
  turn loop at HEAD, but the row's claim is about state surviving **across games in one process**, and
  a grep cannot answer it. It needs the two-position replay it describes.

---

## 5. ALREADY COVERED BY ANOTHER ROW — 6

Duplicates are the mechanism the hygiene report named for the undeclared half growing, so they are
listed separately from "fixed", even where they overlap.

| row | covered by | which is |
|---|---|---|
| **#360** Telepathy | **#456** | CLOSED — same defect, same two lines, verbatim |
| **#312** Shell Side Arm bullet | **#518** | CLOSED |
| **#315** the types half | **#503** | CLOSED (the species/maxhp half is #315's own and survives) |
| **#371 (c)** four unattributable refusals | **#375** | OPEN — the dump cap, and the row already says so |
| **#467 (a)** randomTarget address | **#543** | OPEN — its counter names the `randomTarget` re-roll as a producer |
| **#422** mega half | ENGINE's landed commits `0a78640` / `970a1c4` / `87d3a17` | the row's own cell records it; only the residual half was left, and that is now the selection sort |

---

## 6. WHAT EACH ROW WOULD NEED — the ranked list

**Rank 1 — a row edit only, an instrument already exercises the claim (26 rows).**
#531, #360, #312, #327, #341, #317, #329, #331, #332, #333, #335, #337, #338, #339, #340, #343, #345,
#347, #356, #371, #384, #385, #418, #422, plus **#529** (engine half) and **#446** (runner half). The
candidate command for the census-backed majority is `node tests/test-mechanics.js` — **named, not
written**, and carrying the caveat the hygiene report measured: 29 rows already share that exit code, so
it says *the census has no red row*, not *this row's claim holds*. For #347 and #356 the artifact is a
roster stage; for #531 it is `tests/probe_partingshot_conditional.js`, which is the only one of the
group whose exit code is about that row alone.

**Rank 2 — one existing command settles it, no new code (2 rows).**
#421 (run both roster invocations on one frozen release and diff the per-row verdicts — plays games, so
it waits for the ENGINE pass) and #446's remaining leak (re-run at the default heap after the snapshots
are shared; the arms already share an id).

**Rank 3 — a small new probe with an obvious shape (6 rows).**
- **#314** — add `process.exitCode = holes ? 1 : 0` to the probe it already has. One line, and the row
  becomes markable. It plays games, so the run is not free.
- **#315** — a staged mega that faints, asserting `species` and `maxhp` on the corpse against the
  authority; the `#503` type restore is the template and the site is the same `clearVolatile` call.
- **#348** — one arm in `tests/test-lownode.js` passing an argument containing a space and one
  containing a drive-letter path, asserting the child received both byte-identically.
- **#442** — regenerate the census from the committed tree and fail on any difference from the committed
  artifact. Cheap (seconds) and it is the only thing that can see a probe landing without its engine edit.
- **#530** — the two-line probe the row already specifies: open a release, `REL.require('engine/rollout_leaf.js').census()`, fail on `ok:false`. The **decision** it feeds (487 stranded releases) is the expensive half and is not a probe.
- **#289** — the row's own staged pair: a body at −6, then Parting Shot and Charm, asserting
  `\|-unboost\|X\|atk\|0` on both engines with `boostZeroSuppressed` asserted at 0 rather than printed.

**Rank 4 — needs a real instrument that does not exist (9 rows).**
#220 (re-count the family and retire the 32), #310 (hand every caller a stream — moves every seeded run,
and everything downstream owes a re-run), #323, #325 (both are `mutation_harness.js` changes plus a
regeneration of a 2.2 MB artifact), #334 (the `random(16)` category inversion in the differential, plus
our missing confusion-duration draw), #349, #350, #380, #441, #467(b). These are the honest remainder and
most of them are MEASURE's own files.

---

## 7. WHAT THIS PASS DID NOT DO, AND WHY

- **No row was edited, closed, reopened or given a marker.** Every `VERIFIED BY` above is a candidate
  named in prose. `register_reality.js` `execFileSync`s what it accepts, and this pass did not earn the
  right to start 24 instruments beside a live ENGINE agent.
- **No row is declared `NOT A DEFECT`.** The 24 in §2 are FALSE claims about a fixed engine, which is a
  different statement, and the string would override the derived verdict in `quarantine.js:1040`.
- **Nothing was run that plays a game**, so every "FIXED" above rests on a **census row, a roster
  verdict, a tag value, a knob-plus-counter, or a cause's absence from an artifact** — never on a run I
  made. The census and roster artifacts are HEAD's, generated 2026-09-04 06:41–07:11 by ENGINE.
- **The HEAD differential is a different run configuration from the ones the rows cite** (961 games /
  168 diverged at release `8ad06030e129`, against the rows' 961/95 and 961/37). Presence or absence of a
  cause in it is evidence, not proof, and it is quoted that way above.
- **`data/register-reality.json` was not regenerated**, `status.js --write` was not run, and no artifact
  was written by this pass.

---

## OWED

1. **24 rows are false and the register still says they are live.** They cost what #362 and #312 cost:
   an agent reads a fixed defect as work. Closing them is 24 row edits plus, for most, one `VERIFIED BY`
   line — but the marker must not be written until somebody is willing to let `register_reality.js` run
   the instrument, which is blocked on the decision already filed in
   `docs/_reports/2026-09-04-safe-marker-rejection.md` (OWED 2).
2. **#531 is closed and unreadable, and the cause is unescaped pipes in a status cell.** The row needs
   its closure text escaped (or the detector needs to read the cell some other way). Until then it sits
   in `debt` as an open engine defect that landed six days ago.
3. **#360 is a duplicate of the closed #456 and #312's first bullet is the closed #518.** Duplicates are
   the named mechanism for the undeclared half growing; these two are the measured instances.
4. **Nothing here moves the MEDICHAM gate, and that is the finding.** All 43 sit in `debt`, which never
   holds the clause shut, so 24 rows went false with no gate ever going green to say so. A register
   whose stale half is invisible to the gate will keep growing a stale half.
5. **#421 and #441 cannot be decided by reading.** Both want a run that plays games and both should wait
   for the ENGINE pass to land rather than be answered by argument.
6. **The 15 STILL TRUE rows in §3 are unchanged claims with no instrument**, and six of them
   (#323, #325, #349, #350, #380, #467b) are MEASURE's own files. They are the honest remainder of the
   43 and they do not shrink by reading.
