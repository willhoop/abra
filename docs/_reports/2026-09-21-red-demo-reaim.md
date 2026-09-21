# `tests/probe_red_demo.js` — the four stranded reversals re-aimed (2026-09-21, ENGINE)

Run with `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`, single process, no engine
byte changed. Only `tests/probe_red_demo.js` was edited.

## Counts

| | before | after |
|---|---|---|
| demonstrations | 197 | 197 |
| HOLLOW | **1** | **0** |
| COULD NOT BE APPLIED | **4** | **0** |
| not in this format | 5 | 5 |
| exit | `ABRA-EXIT 1 VERDICT-RED` | `ABRA-EXIT 0 VERDICT-GREEN` |

A line-by-line diff of the 197 verdict rows between the two runs changes **exactly five lines**, all
from `STALE`/`FAIL` to `OK`. The other 192 rows are byte-identical, so nothing else was disturbed.

## FIVE, not four — the fifth was already red and is the same failure one level deeper

The brief named four `COULD NOT BE APPLIED`. The file was also carrying **1 HOLLOW**:
`ROADMAP #81 WIRE 7  a mega stone cannot be knocked off the body it belongs to`, reverted-arm=true.
It is the nastier half of the same event and it is the shape the Knock Off header warns about in its
own words — *a reversal that leaves the defect unreachable proves nothing.* Its patch **applied** and
reverted **nothing**; see §5.

---

## 1. `Knock Off cannot take the Sash that just saved the target`

**Why it died.** The 2026-09-20 steal-eat split lifted the step's whole body out into a shared
`_itemStripStep(R)` with two wrappers (`_stepStealEatAtHit` for Bug Bite / Pluck at `onHit`,
`_stepAfterHit` for Thief / Covet / Knock Off at `onAfterHit`). The anchor quoted the door **and the
body's first line** — `const _stepAfterHit=(R)=>{const tg=R.tg;` — and `const tg=R.tg;` left with the
body. Fourth staling of this one demonstration.

**New anchor.** The door ALONE, up to its opening brace:

```
      const _stepAfterHit=(R)=>{        ->   const _stepAfterHit=(R)=>{if(1){void R;return;}
```

It quotes no statement of the block, so neither a line added inside it nor the body being extracted
again can stale it. Unique in the engine source (`grep -c` = 1). The second edit — the identical
strip put back ABOVE the Focus Sash, at `if(R._berryApply){…` — was untouched and still applies.

**Flip.** `shipped-arm=true  reverted-arm=false`. Control cleared on both arms: the same click with
**no** item faints the Gengar on both engines (`|-damage|p2a: gengar|0 fnt`), so "survived" is not
measuring a weak attack.

## 2. `Follow Me announces nothing when it draws, Lightning Rod announces an -activate`

**Why it died.** `if(TR)TR.retarget(drawer);}` grew a second condition on 2026-09-19
(`!_dr.aimAlready` — the authority only re-writes the move line when the aim actually moved). The
anchor was the announcement's **neighbour**, so it died on a change about something else. Third
staling of this pair.

**New anchor.** The one statement that must exist for the volatile draw to happen at all, with the
old announcement APPENDED after it (above the retarget, where it used to sit):

```
            targets=[drawer]; _aimRedirected=true;
        ->  targets=[drawer]; _aimRedirected=true;
            if(TR)TR.act(drawer,'move: '+drawer._redirect);
```

Nothing about the retarget line is quoted, so it can grow further conditions.

**AND THE ASSERTION WAS STALE TOO — this one's shipped arm read `false` once the patch applied.**
`rod.length === 1` counted the whole `-activate|-ability` family, and the ABSORB now writes its own
line. That line is the authority's, not a defect:

```
lightningrod.onTryHit -> this.boost({spa: 1})                data/abilities.ts:2336 (no Champions row)
Battle#boost, ability effect -> this.add('-ability', target, effect.name, 'boost')   sim/battle.ts:2066
```

Observed on the shipped engine:

```
|move|p1a: raichu|thunderbolt|p2b: milotic
|-activate|p2b: milotic|ability: lightningrod
|-ability|p2b: milotic|lightningrod|boost
|-boost|p2b: milotic|spa|1|[from] ability: lightningrod
```

So a count of one could only ever be red. The claim is unchanged and is now stated line by line
instead of by a total — **stricter, not weaker**: the redirect line is an `|-activate|`, it is the
FIRST of the family (above the absorb), and the only `|-ability|` present is the absorb's own, the
one carrying `boost`.

**Flip.** `shipped-arm=true  reverted-arm=false`. Both reverted arms still bite: the Follow Me revert
puts an `|-activate|` into `drawn` (which must be empty), and the rod revert turns the redirect line
into a second, boost-less `|-ability|`.

*(Not fixed here, stated: this engine's `-boost` line carries `|[from] ability: lightningrod` where
`sim/battle.ts:2067` writes the bare `this.add(msg, target, boostName, boostBy)`. That is a narration
question with no failing probe and no row; it is left for whoever opens one.)*

## 3 and 4. The two WIRE 8 charge certificates (`W8_CHARGE`, shared)

**Why they died.** The 2026-09-20 pass routed the charge-turn self-boost through `invSign` (Contrary /
Simple), inserting a `_csign` declaration and a counter line into the middle of the quoted block and
multiplying inside the clamp. The reversal quoted the block WHOLE, so it died on a change about
whose SIGN the boost takes rather than about where it sits. Edits 1 (`|-prepare|`) and 3 (the copy put
back inside the charging branch) still applied; only edit 2 was stale.

**New anchor.** The loop head alone — the one statement that must exist for the boost to be paid at
the UNCONDITIONAL position:

```
          if(_b)for(const _k of Object.keys(_b)){   ->   if(0&&_b)for(const _k of Object.keys(_b)){
```

The body can now be rewritten line by line without staling it. Unique in the engine source.

**Flip.** Both `shipped-arm=true  reverted-arm=false`.
- *Electro Shot keeps its +1*: on the reverted engine the rain click skips the charge and never pays
  the boost, so `rain.sa` reads 0 and the `flat` control (the same click from −1) does not net to 0.
- *A skipped charge still writes `|-prepare|`*: on the reverted engine the sun Solar Beam writes one
  line instead of two, and the spent Electro Shot writes `boost` before `prepare`.

## 5. `a mega stone cannot be knocked off the body it belongs to` — the patch applied and reverted nothing

Two separate faults, both invisible:

**(a) The reversal was landing in the wrong arm.** The 2026-09-19 Sticky Hold announcement split the
strip into two arms, and only the first still ends the conjunct with `&&`:

```
47745   else if(_ri&&itemOn(tg)&&!itemRefusesTake(tg)&&abilityRefusesItemLoss(tg,m)){   <- announce & refuse
47749   else if(_ri&&itemOn(tg)&&!itemRefusesTake(tg)){                                 <- TAKE
```

`'!itemRefusesTake(tg)&&' -> ''` therefore matched **once**, in the Sticky Hold arm, leaving the stone
rule standing on the road the stone actually takes. Measured: `occurrences: 1`, and the reverted
engine refused the stone exactly as the shipped one did. **A reversal that applies and reverts nothing
is worse than one that throws** — it prints a row.

The anchor is now the TERM alone, turned into `true` rather than deleted, so it neutralises the rule
in BOTH arms and cannot land in the wrong one however the branch is split again:

```
!itemRefusesTake(tg)   ->   true          (2 matches, deliberate)
```

The sibling refusal (`abilityRefusesItemLoss`, ROADMAP #175) is untouched, so the known-bad engine is
still "Knock Off ignores the stone rule" and not "Knock Off refuses nothing".

**(b) The fixture had made the defect unreachable.** Even with (a) fixed, the case would not flip: a
full-HP Gengar **dies** to this Knock Off on the shipped engine —

```
gengar gengarite => hp 0 dead true item "gengarite"
    |-damage|p2a: gengar|0 fnt | |faint|p2a: gengar
```

— so the strip step never runs and `owner.item` reads `gengarite` on both arms for a reason that has
nothing to do with the mega-stone rule. `W7.knock` grew an opt-in `survive` flag (`W7.big`, already
used elsewhere in this file) and the case asserts `!owner.dead && !other.dead` so the fixture can
never silently go back to being unreachable. On the shipped engine with the body alive:

```
owner big   {"hp":892,"dead":false,"item":"gengarite"}     <- refused
other big   {"hp":1367,"dead":false,"item":""}             <- control, still taken
```

**Flip.** `shipped-arm=true  reverted-arm=false`.

## Nothing judged obsolete

All five were live claims with live mechanics. Nothing was deleted, nothing was weakened, no
demonstration lost an assertion — §2 and §5 both gained one. The five `N/A` rows are unchanged (two
Follow Me/`kind:'pass'` sweeps, `transistor`, `aurabreak`, the unmodelled-click sweep); none of them
is mine to move.

## What was NOT run, and why

No engine byte changed, so `data/mechanics-census.json` cannot have moved and
`tests/test-mechanics.js` was not re-run (it rewrites an artifact other agents may be reading).
`engine/status.js --write` was not run — this is a worktree.
