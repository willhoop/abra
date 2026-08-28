# The narration list, worked one at a time — 2026-08-28

Dated findings record. Not a living document, not current state, superseded by the register rows and
the CHANGELOG entries it feeds. Every number below was read out of an artifact on a named release.

## ONE LINE PER ITEM, WITH THE BOARD-MATERIAL NUMBER AFTER EACH

**Board-material was 0 of 961 before this session and is 0 of 961 after every single patch. It never
left zero, so nothing was dropped.**

| # | item | verdict | census | diverging mechanics | board-material |
|---|---|---|---|---|---|
| 1 | **Berserk's boost order** | **LANDED** — announced above `-hitcount`, now below | 773 → **774** | 9 → **8** (abilities 2 → 1) | **0 of 961** |
| 2 | **Switcheroo names itself** | **LANDED** — `-activate` now derives `Trick` | 774 → **776** | 8 → **7** (moves 6 → 5) | **0 of 961** |
| 3 | **The missing `[silent]` `-enditem`** | **LANDED in the same patch** — closed for *both* moves; `trick` also reads `NO-DIVERGENCE` | (same) | (same) | **0 of 961** |
| 4 | **Leppa Berry's activation field** | **LANDED** — it was two fields short, not one field wrong | 776 → **777** | 7 → **6** (items 1 → **0**, stage clean) | **0 of 961** |
| 5a | **Recycle → actually Ripen** | **LANDED** — new derived tag `announcesBerryEat` | 777 → **778** | moves 5 → 4 | **0 of 961** |
| 5b | **Heal Bell** | **NOT DONE — it is a BUILD, and it is board-material** | — | — | — |
| 5c | **Forewarn** | **NOT DONE — it needs a DIE, not a line** | — | — | — |
| 6 | **Gastro Acid** | **NOT DONE — and its leaf is uncomparable, so no verdict on it is trustworthy** | — | — | — |
| 7 | **Reflect Type** | **NOT DONE — unimplemented, a build, possibly board-material** | — | — | — |
| 8 | **Instruct never asks the shield** | **NOT DONE — not started** | — | — | — |
| — | `5324/4096` (#516), Healer / Shed Skin | **NOT DONE — not started** | — | — | — |

**Damage stayed 0/6000 at all sixteen corners after every patch**, re-run in full each time.
**Roster stayed 139 / 129 / 475 with zero in both failure columns and reds 18/18, 29/29, 35/35.**

Releases, one per landed patch, each cut over a settled tree (`0 of 26 files have moved since`) and
passed explicitly to every instrument: `b035aa665740` (Berserk), `8a168b0d750d` then
**`f440e4759f4e`** (Switcheroo, re-cut — see the CRLF section), `25971e1db478` (Leppa),
`559142efed16` (Ripen).

---

## WHAT WAS ACTUALLY WRONG, ITEM BY ITEM

### 1. BERSERK — A CALL SITE, NOT A RULE

`_hpThresholdBoost` was called from the close of `_damagingHit`, which `_stepDamagingHit` runs as
**step 12 of 19**; `_stepHitCount` is **step 19**. The authority's `-hitcount` is
`data/mods/champions/scripts.ts:550` and `afterMoveSecondaryEvent` — where the boost lives — is
`:577`, four statements below. Champions overrides Berserk (`abilities.ts:8-13`) but only its
`onDamage` bookkeeping; the boost is inherited from `data/abilities.ts:420-428`. Mainline agrees, so
it is not a Champions quirk.

The closure is now handed to the row as `R._hpt` and run by a new `_stepHpThresholdBoost` below
`_stepHitCount` — the same shape `_stepHitCount` itself uses, where `_stepApply` keeps COUNTING and
only the announcement moved.

**The old justification for the position was stale and was rewritten rather than deleted.** It
claimed the position was required to sit above Scale Shot's self-drop; that stopped binding on
2026-08-24 when `selfBoost` moved below the whole step list.

### 2 + 3. THE ITEM SWAP — TWO DEFECTS IN ONE BLOCK, AND THEY WERE NOT ONE FIX

`data/moves.ts:18666` (switcheroo) and `:19887` (trick) are the same statement and **both** write
`'move: Trick'`. Champions overrides neither move. The `_ti.swaps` arm wrote `TR.act(m,'move: '+a.mv)`
— right for Trick by coincidence — and its two `if(itemOn(...))` guards had no `else`, so the
`[silent]` `-enditem` was never written for **either** move.

- **The name is derived, not typed.** `announcesAs` is read off the handler's own `this.add`. Of the
  9 legal `takesTargetItem` members, exactly `switcheroo` and `trick` derive a value; `covet` and
  `thief` carry `swaps` but write no `-activate` and correctly derive none.
- **`TR.enditem` took a fifth field** because `[silent]` and `[from]` must be SEPARATE fields —
  `display-flags` drops a field matching `^\[silent\]`, so folding them into one string would drop
  the attribution along with the flag.
- **`TR.act` took an `of` MON** rather than a string, because `ident` is scoped to the trace closure.
  The `[of]` **moves no counter** (the differ strips it) and is there to match byte for byte.
- **Not closed, not claimed:** both slots empty. The authority returns false and fails the move; our
  guards are on the item values so neither `-enditem` fires, which is unchanged behaviour.

**The `-enditem` half was the bigger one and it was the point of staging both moves.** Switcheroo is
19 sheets; Trick is 522. A probe testing only the move whose name is on the other defect would have
credited the fix on the 19-sheet member and left the 522-sheet one untested. Both now read
`NO-DIVERGENCE`.

### 4. LEPPA BERRY — TWO FIELDS MISSING, NOT ONE FIELD WRONG

The brief said the activation "carries the wrong field". It does not: `onEat` closes with **four
arguments**, so five fields on the wire, and this engine wrote the first three.

```
showdown    |-activate|p1a: Corviknight|item: Leppa Berry|Rain Dance|[consumed]
medicham2   |-activate|p1a: Corviknight|item: leppaberry
```

**The divergence is the ABSENCE, not the spelling.** `traceCanon` folds case and spacing on every
field from 2 up, so `Leppa Berry`/`leppaberry` and `Rain Dance`/`raindance` already fold to the same
string. The slot name is derived from `pick`, the slot the PP restore already chose by the handler's
own rule.

### 5a. "RECYCLE" IS RIPEN, AND THE ROW IS NAMED FOR THE WRONG THING

The `move:recycle` row's divergence is `|-activate|p1a|ripen <> |-enditem|p1a|sitrusberry|[eat]` —
**the missing line is Ripen's**, not Recycle's. A row is named for the move that staged the board,
not for the entity that owns the line, and that is a trap worth writing down.

The authority is `ripen.onTryEatItem`, whose entire body is
`this.add('-activate', pokemon, 'ability: Ripen')` — **unconditional**, and on a different hook from
the doubling, so it fires for a berry whose effect Ripen does NOT double and it lands **before** the
`-enditem`.

**It got its own tag rather than a param on `doublesBerryEffect`.** Hanging it there would have
worked today, because Ripen is the only member of both, and would have silently missed the first
ability that announces on eat without doubling anything. Membership printed before wiring: three
legal abilities carry `onTryEatItem` — `angershell`, `berserk`, `ripen` — and **exactly one** writes
an `-activate` in it. The two near-misses are the evidence it does not over-match.

`consumeBerry` is the one consumption site and every caller already runs it *before* writing
`TR.enditem`, so the line order falls out of the existing call shape rather than needing a new hook.

---

## THE FOUR I DID NOT DO, AND WHY — EACH DIAGNOSED RATHER THAN GUESSED

### FOREWARN IS NOT A FREE NARRATION FIX. IT NEEDS A DIE.

`forewarn.onStart` ends `const [warnMoveName, warnTarget] = this.sample(warnMoves);` and only then
adds the line. `PRNG#sample` (`sim/prng.ts`) calls `this.random(items.length)` **unconditionally,
even for a one-element array**.

So emitting `|-activate|BODY|ability: Forewarn|MOVE|[of] TARGET` is not "add a line" — it is "add a
line and match a draw", and getting the draw wrong desynchronises everything downstream of it. This
is the same shape as the random-target work already in the ledger and belongs with it, not in a
narration batch. **Diagnosed, not attempted.**

### HEAL BELL IS UNIMPLEMENTED, AND IT IS BOARD-MATERIAL

Its row's board verdict is **`STATE`** — 5 boundaries, 4 agreed. It carries **no cure tag at all**:
`pp`, `targetClass`, `sound`, `neverMisses`, `noProtectFlag`, `statusCategory`,
`formatSecondaryCount`, none of which cures anything. The authority's `onHit` announces
`move: Heal Bell`, then walks `[...target.side.pokemon, ...target.side.allySide?.pokemon || []]`
curing each, with `-immune` announcements for Soundproof and Good as Gold.

So it is a **BUILD** — a new derived tag plus two immunity announcements — not a missing line. It is
also one of only two remaining rows that are board-material, and `uses: 0` in the store puts it
squarely in the obscure tail that Will's 2026-08-23 ruling deprioritises. **Not started, on purpose.**

### GASTRO ACID'S VERDICT MAY NOT BE TRUSTED — CHECKED, AS INSTRUCTED, AND IT DID NOT SURVIVE

The brief said to check before trusting any verdict on it. Its row carries:

```
uncomparable_leaves: ["volatile:gastroacid"]
core_leaf_unchecked: true
```

So the `ANNOUNCEMENT-ONLY` reading on it **is not earned**. The leaf is neither compared by
`board_state.js` nor listed in `NOT_COMPARED` — the same unlisted-omission shape already filed for
`volatile:smackdown`. **Any fix judged against this row would be judged by an instrument that cannot
see the thing it changes.** The leaf must be wired or explicitly declared first, and that is not
ENGINE's call to take quietly.

### REFLECT TYPE IS A BUILD, AND IT IS THE OTHER POSSIBLY BOARD-MATERIAL ONE

Board verdict **`STATE`** (2 boundaries, 1 agreed). The authority writes
`|-start|p1a: Gengar|typechange|[from] move: Reflect Type|[of] p2a: Feraligatr` and this engine
writes nothing at all — confirmed unimplemented rather than divergent, exactly as the brief said.
**More than a night's work alongside the rest of this list, so it was left rather than half-built.**

---

## WHAT WENT WRONG IN MY OWN WORK, RECORDED BECAUSE THE PATTERN IS THE LESSON

### MY PROBE WAS WRONG FIVE TIMES BEFORE THE ENGINE WAS WRONG ONCE

Every one of the five failed *toward a comfortable answer* — a red against an engine that was
already correct, which reads exactly like a defect.

1. **A typed literal.** Asserted `'move: trick'` where the derived value is the authority's own
   casing, `Trick`. Fixed by reading the expected name out of `data/tags.json` rather than typing it.
2. **A trace slice one field short**, so the `-enditem` shape never matched.
3. **A built regex.** `new RegExp('\[from\] move: ' + mv)` — in a JS string `\[` collapses to a bare
   `[`, so the pattern was the CHARACTER CLASS `[from]` followed by ` move: switcheroo` and could
   never match. Replaced with plain string containment.
4. **The leading empty field.** A trace line opens with `|`, so `split('|')` yields an empty first
   element and the wire fields land at 1..N. Asserted `length === 5` against a 6-element array.
5. **The body prefix, again.** The Ripen probe's slice kept the body field, so every anchored regex
   failed — including the control clause, which would have made the red uninformative even though
   the headline verdict happened to be right.

**Four of the five are the same mistake: mis-counting fields on a `|`-delimited line.** The fix that
stuck was to destructure and NAME the fields instead of indexing them.

### AND ONE INSTRUMENT FAILURE THAT WAS MINE, WHICH COST A RELEASE AND A FULL RE-RUN

`tests/roster.js` plants two of its red demonstrations against anchors that **hard-code `\r\n`**
(`roster.js:6812` and `:7726`). A Python edit that read with universal newlines and wrote with
`newline=''` silently converted `engine/medicham2-browser.js` to LF, so those two anchors matched
**zero** times and the moves stage went **35/35 → 33/35**.

The roster reported it exactly right — *"an unapplied plant reads exactly like a comparator that
found nothing"* — which is the check working as designed, and it is the only reason this was caught
rather than shipped as a silently weaker instrument.

`core.autocrlf` is `true` here, so the **committed blob was never affected**; the content was
verified identical modulo line endings before and after the restore. **The release was re-cut
(`8a168b0d750d` → `f440e4759f4e`) and every instrument re-run**, because a release that has drifted
cannot carry an attribution. Every subsequent edit went through a CRLF-preserving helper.

### AND ONE GIT MISTAKE, REPORTED PLAINLY

My first commit (`d31e736d`) **swept in another agent's already-staged index entries** —
`engine/quarantine.js`, `docs/MEASURE.md`, `docs/ROADMAP.md` and
`docs/_reports/2026-08-28-closet-illusion.md`. I added only my own files by name, but a bare
`git commit` takes the **whole index**, and another agent had staged its work into it concurrently.

**Nothing was lost and I did not rewrite it.** Their work is intact and committed. Every subsequent
commit used an explicit **pathspec** (`git commit -- <paths>`), which cannot pick up another agent's
staged files.

---

## THINGS FOUND ALONG THE WAY THAT ARE NOT MINE AND ARE NOT FIXED

- **`tag_dex.js`'s `takesTargetItem` MIS-DERIVES BUG BITE AND PLUCK.** It tests `eats` with
  `/eatItem|singleEvent\('Eat'/` — **single quotes only** — against `String(m.onHit)`, which is the
  **compiled dist body** and uses double quotes. So both read
  `consumesAndGainsEffect: false, removes: true` when the authority eats the berry and gains its
  effect. `stuffcheeks` reads `true` only because it happens to match `eatItem` instead. Bug Bite is
  105 uses. **Deliberately not folded into a patch about an announcement name.**
- **`engine/board_state.js` neither compares `volatile:gastroacid` nor declares it uncomparable** —
  a second unlisted omission beside the already-filed `volatile:smackdown`.
- **`item:metronome` is the only item row left and it is shelved by the owner, not clean.** With
  `leppaberry` closed, items read `diverged 0 / diverged_including_shelved 1`, and that one row's
  board verdict is **STATE**. The zero is real and it is not the whole story.
- **Every counter added this session has only ever been read on a staged board.**
  `swapActivateNameUnderived`, `swapLinesBlindRestored`, `leppaLineBareRestored`,
  `berryEatAnnounceBlindRestored`, `hpThresholdBoostEarlyRestored` and `MEDSEEN.berryEatAnnounced`.
  `game_differential.js` surfaces no `MEDFAILS` or `MEDSEEN`, so their pool-scale reach is unknown.
- **Left in the tree, not deleted, not mine:** the `.scratch_*` files and directories at the repo
  root, `data/_scratch-scovillain-dump.json`, and the untracked probe files
  `tests/probe_berserk_switcheroo.js`, `tests/probe_instruct_shield.js`,
  `tests/probe_volley_collapse.js`.

---

## OWED, NOT RUN

- **Item 8, Instruct's shield check — NOT STARTED.** `tests/probe_instruct_shield.js` and
  `docs/_reports/2026-08-27-instruct-shield.md` exist and were not run by me.
- **Item 7, Reflect Type — NOT STARTED.** A build, `STATE` board verdict, possibly board-material.
- **Item 6, Gastro Acid — NOT STARTED, and it is blocked on an instrument**, not on the engine: its
  leaf is uncomparable and undeclared.
- **Heal Bell — NOT STARTED.** A build with a new derived tag; `STATE` board verdict.
- **Forewarn — NOT STARTED.** Needs die alignment, not a line.
- **`corrosivegas` — NOT LOOKED AT.** Still diverging:
  `ordering :: -enditem before -activate|protect`.
- **`#516`'s `5324/4096` vs `5325/4096`, and Healer / Shed Skin drawing before the status check —
  NOT STARTED.** Neither shared a root with anything above, so by the brief's own rule they were not
  taken.
- **No pool-scale reading of any counter added tonight**, per the note above.
- **The whole-game baseline is still stamped under a two-generation-old pin**, so
  `engine/quarantine.js` withholds direction of travel and is right to.
- **The unreproducible faint row (`|upkeep <> |faint|p2b`) was not touched**, as instructed. It is
  still 1 of the 6 raw divergences, and the other 5 are the declared `fallenundefined` rows.
