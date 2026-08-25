# The Moody exemption is removed — it was already dead, and the reason it was written was wrong

**MEASURE, 2026-08-25.** Historical record, per the `docs/_reports/` convention. Not current state;
superseded by the register row it feeds. Every figure below is read out of a committed artifact or a
cited source line, and the command that produced it is printed beside it.

---

## 0. VERDICT

**The Moody matcher was still shipping, but it had nothing left to match.** Removing it changes no
number. The clause reads **23 of 961 = 2.4%** before and after.

| | before this pass | after this pass |
|---|---|---|
| games | 961 | 961 |
| protocol parted, raw | 28 | 28 |
| declared, `INCOMPARABLE` (Moody) | **0 rows matched** | row deleted |
| declared, `AUTHORITY-WRONG` (Supreme Overlord) | 5 | 5 |
| **undeclared** | **23 = 2.4%** | **23 = 2.4%** |
| clause verdict | FAIL | FAIL |

So this was **removing a dead exemption, not a live one** — which is the cheaper of the two jobs the
brief anticipated, and worth saying plainly rather than dressing up as a saved measurement.

---

## 1. WHAT WAS VERIFIED BEFORE ANYTHING WAS TOUCHED

The brief asked for the ENGINE report to be checked rather than taken. Three separate checks, none of
which read that report for its answer.

### (a) The authority really does null the address, and it does it before Moody draws

Read at the line in the pinned checkout, `C:/Users/willj/Projects/Pokemon/pokemon-showdown`:

```
sim/battle.ts:376    clearActiveMove(failed?) { ... this.activeMove = null;
                                                    this.activePokemon = null;
                                                    this.activeTarget = null; }
sim/battle.ts:2828   this.clearActiveMove();                    <- after EVERY action
sim/battle.ts:2810   case 'residual': this.clearActiveMove(true);
                     this.updateSpeed();
                     ...
                     this.fieldEvent('Residual');               <- Moody draws HERE
```

The clear at `:2810` runs **before** `fieldEvent('Residual')`. So at the instant Moody takes its two
`sample()` draws, the authority's `activeMove` and `activeTarget` are already null and its address is
`…|any|-|-|nth`. This is the load-bearing fact and it is three lines apart in one file.

### (b) The engine's half of the address was the thing that was wrong, and it is now fixed

`engine/medicham2-browser.js` now carries `midClearActiveMove()`, which sets `MID_MOVE`, `MID_TGT`
and `MID_ATT` back to `-`, with `MEDI_ACTIVE_MOVE_STICKY=1` restoring the old leak and stamping
`MEDFAILS.activeMoveStickyRestored`. Read only; that file belongs to ENGINE and was not touched.

### (c) The artifacts agree, and they were read from git rather than re-run

`wholeGameClause` — the shipping function the gate calls — run over three committed artifacts. Same
961 games, same frozen pool. Only the release stamp was normalised, which affects the staleness guard
and nothing about matching:

```
0447cd1  (pre-fix,  release ffdec64bed0c)   35 raw   declared 13 = INCOMPARABLE 8 + AUTH-WRONG 5   undeclared 22
382e998  (post-fix, release cbf345e56bc0)   28 raw   declared  5 = INCOMPARABLE 0 + AUTH-WRONG 5   undeclared 23
65a9c5c  (HEAD,     release 359b51b61d83)   28 raw   declared  5 = INCOMPARABLE 0 + AUTH-WRONG 5   undeclared 23
```

The eight games were seven causes — six `-boost field 3` and two `-unboost field 3`:

```
2  -boost   field 3 :: |-boost|p2a|spa|2 <> |-boost|p2a|def|2
1  -boost   field 3 :: |-boost|p2a|spd|2 <> |-boost|p2a|spa|2
1  -boost   field 3 :: |-boost|p1a|def|2 <> |-boost|p1a|spe|2
1  -boost   field 3 :: |-boost|p2a|atk|2 <> |-boost|p2a|spd|2
1  -boost   field 3 :: |-boost|p1a|spa|2 <> |-boost|p1a|spd|2
1  -unboost field 3 :: |-unboost|p1a|spa|1 <> |-unboost|p1a|spe|1
1  -unboost field 3 :: |-unboost|p2a|def|1 <> |-unboost|p2a|spd|1
```

After the address fix, **zero games carry either shape.** Six stopped diverging outright and two now
part on a different cause. Both of those are the point of §3.

**The current artifact was stable throughout.** `data/game-differential.json` held one mtime
(2026-08-25 00:46:53 local, `generated 04:46:53Z`, release `359b51b61d83`) across every read in this
pass, and its bytes are identical to `git show HEAD:data/game-differential.json`. No torn read.

---

## 2. WHY THE DECLARATION WAS WRONG, IN ONE SENTENCE

It said the residual `sample()` sits on a generic stream at an occurrence index **each engine fills
with its own unrelated draws**, so there is no shared address and no defect. The stream was shared.
**Our half of the address was stale**, because this engine wrote the active move at the top of an
action and never cleared it:

```
authority     20260813|1|any|-|-|0
this engine   20260813|1|any|curse|p20|0
```

A private coin, because the address was ours and it was wrong — not because the authority's draw is
unaddressable. The declaration's own text named the exit condition (*"give the residual pick a named
stream on both sides … and this row must be deleted rather than kept"*) and the stream turned out to
have been shared all along.

**Nothing about Moody's rule was ever in dispute**, and that is worth repeating so it is not
re-opened: the authority takes two `sample()` draws over the five main stats only
(`data/abilities.ts:2691-2716`, both loops `continue` on accuracy and evasion) and this engine
implements that.

---

## 3. THE COST OF THE DECLARATION WAS NOT ZERO — IT WAS HIDING TWO REAL DIVERGENCES

Six of the eight games stopped diverging. The other two did not: they now part on a **different**
cause, which was invisible for as long as the Moody line came first.

```
-boost   field 3 (Moody)  ->  |-immune|p1a <> |-miss|p2b|p1a
-unboost field 3 (Moody)  ->  |switch|p1a|krookodile <> |detailschange|p1b|charizardmegay
```

An immunity the authority sees and we miss, and a mega-versus-switch ordering. Both are undeclared,
both hold the gate shut, and both are ENGINE's. This is the concrete answer to *"what does a wrong
declaration actually cost"*: it does not merely inflate a subtraction, it **buries whatever is
underneath it**.

---

## 4. WHAT CHANGED IN CODE

`engine/quarantine.js` only.

- The `INCOMPARABLE` row **"Moody's stat pick"** is deleted from `DECLARED_DIVERGENCE` and replaced by
  a withdrawal note where it stood — the same treatment the speed-tie and drag rows got, because a
  closet that silently loses rows teaches nobody. The note carries the refutation, the source lines,
  the three artifact readings and the two divergences it was hiding.
- `parseBoostEvent` and `MOODY_POOL` are removed with it. They had exactly one caller, the matcher,
  and a helper left alive after its premise is refuted is an invitation to rebuild the declaration.
  The pool derivation they carried is preserved in the note, where it is still true and no longer
  load-bearing.
- The selftest's positive Moody control and its nine negative mutations are replaced by a **red
  ratchet**: a Moody-shaped stat-pick divergence is now asserted UNDECLARED, holding the gate shut,
  with no `IMPOSSIBLE TO COMPARE` heading printed. Re-adding the exemption goes red. The nine
  mutations no longer need asserting individually — with no matcher, UNDECLARED is the default for all
  of them.
- The property that **the two kinds print apart and are never summed** is kept, but is now proven on a
  **synthetic pushed row** (push/pop, exactly like the `DEFERRED` guard) rather than on a shipping
  one. Otherwise a printer property would have silently lost its test the moment the last row of a
  kind was withdrawn. The `INCOMPARABLE` kind itself survives with no live row.

```
node engine/quarantine.js --selftest      QUARANTINE SELFTEST: 100 passed, 0 failed
```

The register row for Moody's stat pick is updated in `docs/ROADMAP.md`: the earlier verdicts are left
standing as dated history and a `DECLARATION WITHDRAWN 2026-08-25` block is appended. **The row is left
OPEN.** Its subject is resolved and its status cell says so and calls it a closure candidate, but
closing it belongs to whoever owns the engine fix, and MEASURE does not close a row it is reporting on.

The row's earlier cell also spent the `NOT A DEFECT` escape hatch — the one the file prints by number
on every run precisely so it can be audited. That use rested on the refuted premise, so it is
**surrendered rather than re-spent**: the new cell asserts no live breakage and claims no hatch. The
detectors were checked directly rather than assumed: `roadmapRowIsClosed` reads `false`, the cell
carries neither the hatch phrase nor the uppercase breakage token, and the head-prose scan does not
fire.

---

## 5. DOES ANY MOODY GAME REMAIN GENUINELY INCOMPARABLE?

**No.** Zero games in the current artifact carry a `-boost field 3` or `-unboost field 3` cause, so
there is nothing left to narrow the declaration down to. The exemption is removed outright rather than
scoped.

---

## 6. THREE OTHER "NOTHING TO FIX HERE" CLAIMS — NAMED AND LEFT ALONE, AS INSTRUCTED

No new declaration was made in this pass and none of these was changed.

**(a) Supreme Overlord `fallenundefined` — CHECKED, AND IT HOLDS.** This is the only remaining declared
row and it accounts for all 5 declared games. Its mechanism was re-derived rather than trusted:
`data/abilities.ts:4722-4745` guards `onStart` on `pokemon.side.totalFainted` and leaves `onEnd`
unguarded, so with nothing fainted `effectState.fallen` is never set and the template interpolates
`fallen${undefined}` onto a `[silent]` line. **Champions does not override this ability** — there is no
`supremeoverlord` entry in `data/mods/champions/abilities.ts` — so mainline is the right file to read
here, which is the exception rather than the rule. Unlike the Moody claim, this one is a source-level
fact, not a construction argument, and it survives being re-read.

**(b) The one VOID game, and it is the same shape as the claim that just fell.** The run excludes 1 of
961 games from the rate on the ground that the two engines cannot share an address for Outrage's
`getRandomTarget` draw. Read off the current artifact rather than off ENGINE's report:

```
mid_void.void_games 1        usable_games 960     low_identity_by_category {acc:1, crit:1, dmg:1}
mid_void.unshared_address_shapes    "acc|crit|dmg outrage [sd only]" x2 each, "[me only]" x1 each
mid_void.unshared_address_field     "target differs" x3,  "turn differs" x3
```

That is *"a random draw at an address this harness does not share"*, which is word for word the Moody
argument. It may well be right — and note the artifact says the **turn** differs as well as the target,
which the Moody address also did until it was cleared. The difference is that nobody has printed the
two addresses side by side for this one the way the Moody addresses were finally printed. **Named, not
touched.** ENGINE's report already scopes the fix and says it moves the arm's pin.

**(c) The roster's `DEFERRED-BY-OWNER` shelf.** Four entities are shelved by name across the three
roster stages: `metronome` (items), and `axekick`, `copycat`, `electrify` (moves); abilities has none.
That is a whitelist that subtracts nothing from the divergence count and it is behaving as designed; it
is listed here only so the set of live "no defect here" claims in this repo is written down in one
place. **Named, not touched.**

---

## 7. THE PATTERN, WHICH IS THE PART WORTH KEEPING

This is the fourth time in three days that a *"nothing to fix here"* ruling has turned out to be a real
divergence — speed ties, Tailwind twice, now Moody's stat pick. The reasoning was plausible every time
and cited a line every time. What none of them had was an **independent check of the mechanism itself**.

The Moody row is the sharpest case, because it wrote its own confirmation down as owed — *"print the
address each side uses on one staged residual"* — and was declared anyway on a construction argument
plus a signature. When the print was finally taken it refuted the verdict.

**A declaration is only as good as its mechanism, and a mechanism nobody re-derived is a guess wearing
a citation.** The ratchet in the selftest is the durable half of that sentence; this paragraph is the
part that does not enforce itself.

---

## 8. OWED, NOT RUN

MEASURE ran no game in this pass, by instruction, and touched only `engine/quarantine.js` and
`docs/ROADMAP.md`.

- **`node engine/quarantine.js` in full** — only `--selftest` was run. The gate's roster, mechanics and
  differential stages were not, because ENGINE is live on the same tree.
- **`node engine/status.js`** — not run, and `--write` is forbidden this pass, so **the generated blocks
  in the division ledgers do not yet reflect this change.** The clause figures quoted above come from
  `wholeGameClause` driven directly on `data/game-differential.json`, which is the same function
  `status.js` prints, not from a second implementation.
- **`docs/MEASURE.md` has no ledger entry for this** and `CHANGELOG.md` has no version bump. Both are
  owed by the living-docs rule and both were deliberately left to the coordinator: MEASURE.md already
  carried another agent's uncommitted changes, and the brief reserved the changelog.
- **Nothing is committed.**
- **`data/game-differential.json` was not re-run**, and does not need to be for this claim: the Moody
  causes are absent from the artifact ENGINE already produced, and absence is what was being checked.
- **The address print for the Outrage / `getRandomTarget` void game** — §6(b). Owed by the same standard
  this pass just applied to Moody.
- **`engine/provenance.js` was not re-stamped** (ENGINE's report already owes this).
