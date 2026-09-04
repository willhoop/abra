# Twenty-four stale rows closed with their evidence in the cell, and the parse defect that hid a closed row for six days — 2026-09-04 (MEASURE)

Scope: `docs/ROADMAP.md` only, plus this file. **No engine byte moved, nothing was run that plays a
game, nothing heavy ran, `engine/register_reality.js` was not run in any mode, no `VERIFIED BY` marker
was written, and `data/register-reality.json` was not touched.** `engine/medicham2-browser.js`,
`engine/quarantine.js`, `engine/game_differential.js` and `tests/test-counter-init.js` are owned by a
live ENGINE agent and were read only through `git show HEAD:`, never from the worktree.

**HEAD is `73cca9f8`, not the `3072a919` the triage read.** A commit landed between the two passes, so
every artifact used here was re-staged from `73cca9f8` and every figure below is that commit's.

---

## THE NUMBER

| | before | after |
|---|---|---|
| register rows | 506 | 506 |
| marked closed | 245 | 269 |
| **OPEN** | **261** | **237** |
| **open AND asserting breakage** (what the gate counts) | **74** | **50** |

Both readings are `node engine/open_work.js`, which shares its closed-detector with the gate. Twenty-four
rows closed, three rows amended and left open, nothing else touched.

---

## 1. THE PARSE DEFECT — #531, AND THE REPAIR THE BRIEF NAMED DOES NOT WORK

`roadmapRowStatusCell(l)` captures the text between the last two pipes on the row. #531's closure
narrative lives in its status cell and quoted two protocol lines with literal pipes, so the extracted
cell began `ability: Clear Body\` — board-identical…`, which begins with neither `open` nor `closed`.
The row read **open + asserting breakage** — a live engine defect — while its own cell said it landed
on 2026-08-29.

**Escaping the pipes as `\|` would NOT have fixed it, and this was measured before the edit rather than
assumed.** The detector captures with a negated-pipe character class; that class stops at a
backslash-escaped pipe exactly as it stops at a bare one. Measured on a synthetic row through the
shipping detectors:

| row form | extracted cell |
|---|---|
| as authored | `ability: Clear Body\` — done.` |
| every pipe inside a code span escaped as `\|` | `ability: Clear Body\` — done.` (**unchanged**) |
| pipes removed from the cell | `**closed 2026-08-29 — LANDED.** …` |

So the pipes were **removed** from the cell, not escaped: the two protocol quotes are now written as
*an `-unboost` on the TARGET reading `atk` then `0`* and *a `-fail` naming `ability: Clear Body`*. The
leading `**` was also dropped, because the cell clause is `\|\s*(closed|done|page closed)\b` and `\s*`
does not skip emphasis markers. **Not one claim in the closure narrative was changed** — the diff over
that row is 3,168 characters of common prefix, the two quote rewrites, the emphasis markers, and an
appended note recording all of it.

`roadmapRowStatusCell` and `roadmapRowIsClosed` were **not touched**. The detector is one
implementation on purpose and mutation testing has already shown it can be `return true` with all 159
of its assertions passing; it is not something to edit for one row.

### THE SWEEP — it is a class, and the count is 98 / 22 / 1

Measured over all **506** register rows with the shipping row-matcher and the shipping cell regex,
both lifted out of the shipping bytes by line rather than re-typed (the script throws if either
literal has moved):

| | count |
|---|---|
| rows carrying at least one **unescaped pipe inside an inline code span** | **98** |
| such pipes, in total | **669** (662 after this pass) |
| rows whose **status cell is cut inside a code span** by one of them | **22** (21 after) |
| of those 22, rows that therefore read OPEN | 10 |
| of those 22, rows that also assert breakage — i.e. reach the gate's debt bucket | **1 (#531)** |

**The other 21 are reported and left alone.** Nine of them read OPEN with an authored `closed …` or
`PART DONE …` cell the parser cannot see — **#167, #172, #282, #293, #294, #465, #122, #511, #514** —
and #196's cell parses to the empty string against an authored `closed — measure`. None of them
asserts breakage, so none reaches the gate. Closing them is somebody's evidence to restate, not mine
to infer from a parse artifact, and a wrongly closed row costs what #403 cost. Filed here rather than
swept.

---

## 2. THE TWENTY-FOUR CLOSURES — each restated from the tree before the row was touched

Every row below was verified by a script that reads **HEAD's** `data/mechanics-census.json` (829
results, 829 live, 0 missing), `data/roster.moves.json` and `data/roster.items.json` (both on release
`8ad06030e129`, moves 0 FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE, items the same),
`data/game-differential.json` (961 games, 168 diverged, release `8ad06030e129`), `data/tags.json`, and
`git show HEAD:engine/medicham2-browser.js`. **Twenty-two of the twenty-four passed every check on the
first run.** The two that did not were both my transcription, not the claim:

- **#371** — I asserted #375 was CLOSED; the triage says it is OPEN and owns sub-cause (c). The row's
  own two sub-causes verified; the check was wrong, not the row.
- **#422** — the census label spells its apostrophe with a **backtick** (*"the authority\`s selection
  sort"*), so a literal search on `authority's` missed a row that exists. Found and confirmed.

| row | what makes the closure true |
|---|---|
| #312 | #518 CLOSED; `sandforce…onType` = `["Rock","Ground","Steel"]`; two `item/damageMultOnRepeat` census rows; Hustle live as `{side:'att',mult:0.8,when:'physical'}` |
| #317 | `abilities.furcoat.params.condStatMult` = `{stat:"def",mult:2,when:"always"}`; census row; the row number appears twice in the engine's own comments |
| #327 | all three "absent" mechanics census-probed; `stickyhold` present (1 site), `minimize` present (20) |
| #329 | census row asserting both halves; knobs `MEDI_REACT_BATCHED` and `MEDI_VOLLEY_REACT_DRAWN` |
| #331 | `queueFaint` (29 sites), knob `MEDI_FAINT_INLINE`, census row on the row's own lastFirst case |
| #332 | the row's own staged assertion is a census row verbatim, plus two more |
| #333 | `perHitDamageLoop`, `damageRollIndex` drawn per packet, census row |
| #335 | `secAddrFromLastTarget` / `secAddrMovedByFire` with knob `MEDI_SEC_ADDR_PER_TARGET` |
| #337 | `moves.endeavor.params.immunityGate.hook` = `onTryImmunity`; 40 read sites; census row |
| #338 | census row; knob `MEDI_ORB_STALE_RANGE`; roster `lifeorb` MATCH |
| #339 | census row; knob `MEDI_DRAIN_LUMP_ROUND`; roster `matchagotcha` MATCH where the row logged DIFFER |
| #340 | census row carrying the authority's rule verbatim |
| #341 | `refusesForcedSwitch` read on the damaging branch, counter `forcedSwitchRefusedDamaging`, `DRAG_ABILITY_FIRST` control, census row |
| #343 | census row; counters filed under the row number (6 sites) |
| #345 | three census rows, one per counter (Throat Chop, Infestation, Perish) |
| #347 | roster `spikyshield` FIRED-AND-BOARDS-MATCH on a scenario that can fail, with a control and a state delta |
| #356 | roster `greninjite` MATCH; `typechange` returns **0** causes at HEAD; census row on the latch |
| #360 | duplicate of the CLOSED #456; knob `MEDI_ALLY_REFUSAL_IMMUNE`; census row; `telepathy` returns **0** causes |
| #371 | (a) and (b) are census rows; (c) is redirected to the OPEN #375 and not carried here |
| #384 | census row; membership derived off `exclusiveWith`; knob `MEDI_CRIT_VOLATILE_BLIND` |
| #385 | `items.bigroot.params.healMultBySource.mult` = `1.2998046875`; census row; roster `bigroot` MATCH |
| #418 | both arms of the row are census rows |
| #422 | `residualOrder()` is the authority's selection sort with `RESIDUAL_STABLE_SORT` restoring the plain sort; census row |
| #531 | landed, committed, probe on disk, `moves.partingshot.params.pivotStatus` derived — see §1 |

**Every closure carries its evidence in the cell, dated, and carries the row's earlier status forward
verbatim** under the `THE CELL BELOW IS THE ROW'S EARLIER STATUS, UNCHANGED:` convention that #422's own
cell already used. A prior conclusion is not silently rewritten.

**No cell contains a pipe character.** That is enforced in the edit script — a new cell containing a
pipe is refused rather than written — because a closure that reintroduces §1's defect would be a row
that lies about itself again.

**The string `NOT A DEFECT` appears nowhere in this pass** (`engine/quarantine.js:1040` treats it in a
status cell as a ruling that overrides the derived verdict; these are FALSE CLAIMS about a fixed
engine, which is a different statement). **No `VERIFIED BY` marker was invented** — the count of that
marker in `docs/ROADMAP.md` is **138 before and 138 after**.

---

## 3. THE DUPLICATES — pointed at their owner, not restated

| row | now points at | which is |
|---|---|---|
| #360 | #456 | CLOSED — same defect, same two lines; #360 closed as a duplicate |
| #312's Shell Side Arm bullet | #518 | CLOSED — named in #312's closure |
| #371 (c) | #375 | OPEN — named in #371's closure and deliberately not carried |
| #422's mega half | the row's own recorded landing (`0a78640`) | already in the cell; only the residual half was closed here |
| **#315's types half** | **#503** | CLOSED — **#315 STAYS OPEN** on the species / maxhp half |
| **#467 (a)** | **#543** | OPEN — **#467 STAYS OPEN** on (b), per-cause void attribution |

#315 and #467 were amended with a pointer only. Both still read `open` and both still assert breakage.

---

## 4. WHAT I REFUSED TO CLOSE

**Nothing on the closure list was refused** — all 24 were restated from the tree.

Left open exactly as instructed, and not re-argued here: **#220, #289, #310, #314, #315, #323, #325,
#334, #348, #349, #350, #380, #442, #446 (leak half), #467 (b), #529 (derivation half), #530.**

**#220's figure was corrected, in the cell, and the row stays open.** The row cites 32 games for the
`-fail` / `-singleturn` family. At HEAD that family is **4 causes over 6 games**, counted directly out
of `data/game-differential.json` (961 games, 168 diverged, release `8ad06030e129`):

```
2  unrelated event mismatch :: -singleturn p2a protect  <>  -fail p2a
2  unrelated event mismatch :: -singleturn p1a protect  <>  -fail p1a
1  unrelated event mismatch :: -fail p1a  <>  -singleturn p1a protect
1  unrelated event mismatch :: -fail p1b  <>  -singleturn p1a helpinghand
```

The claim stands; the count does not. It is a stale COUNT in a live row, which is the same failure
shape as a stale row, arriving smaller.

**#421 and #441 are CANNOT-TELL-BY-READING and were left alone.** #421 is a diff between two roster
invocations and no artifact records the `--stage all` run; #441 is about state surviving across games
in one process and needs the two-position replay it describes. Both want a run that plays games.

---

## 5. WHAT MOVED ON DISK

- `docs/ROADMAP.md` — 27 rows rewritten (24 closures, 3 amendments), +17,587 bytes.
- `data/open-work.json` — rewritten as a side effect of running `node engine/open_work.js`, which is
  the tool doing its job; it now reflects 237 open.
- This file.

Nothing committed. `node tests/test-roadmap-register.js` is **GREEN** after the edit (3 passed, 0
failed, 509 items named).

---

## OWED

1. **`node engine/status.js --write` was NOT run, deliberately.** It computes through
   `engine/quarantine.js`, which a live ENGINE agent has uncommitted in the worktree; running it would
   read a file mid-edit and then WRITE the result into the division ledgers' generated blocks. That is
   the torn-read hazard, pointed at the one artifact set nobody would think to distrust. It should be
   run once ENGINE's tree settles, by whoever holds it.
2. **Nine rows are closed in their own cell and read OPEN because of §1's parse defect** — #167, #172,
   #282, #293, #294, #465, #122, #511, #514, plus #196 whose cell parses empty. None asserts breakage,
   so none reaches the gate, and none was touched. Each needs its owner to restate the closure, not a
   parse-artifact inference from me.
3. **98 rows still carry 662 unescaped pipes inside inline code.** Only the 21 that cut a status cell
   matter to the detectors today, but any row that ends its cell with a quoted protocol line will do
   this silently, and escaping is not the fix (§1).
4. **The 24 closures rest on committed artifacts, not on a run I made.** Every one is a census row, a
   roster verdict, a tag value, a knob-plus-counter, or a cause's absence — the strongest of those is
   a knob with a counter, and the weakest is an absence in a differential whose run configuration is
   not the one the rows were filed against. If ENGINE's uncommitted work moves any of these, the
   closures are re-checkable by re-running the verification script, which reads only artifacts.
5. **Nothing here moved the MEDICHAM gate, and that is still the finding.** All 24 sat in `debt`, which
   never holds the clause shut, so 24 rows went false with no gate ever going green to say so. The
   register's stale half remains invisible to the gate; 50 open rows still assert breakage.
