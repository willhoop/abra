# INNARDS OUT — card D1, one card, one pass

**Verdict.** Innards Out had **no implementation at all**, and the reason is that its tag was
mis-derived onto the wrong family by a regex that could not read a nested call. Both halves are
fixed. **One legal carrier: Victreebel-Mega.** Census **788 -> 790 live / 790 probed / 0 missing**.

The card's stated cause was a location, not a diagnosis — as it has been on every card tonight.

---

## 1. THE CARRIER COUNT, BEFORE ANYTHING ELSE

An ability with no legal carrier cannot occur and must not be implemented.

```
SHOWDOWN_PATH=... node -e "... Dex.forFormat('gen9championsvgc2026regmb') ...
   filtered exists && !isNonstandard && tier !== 'Illegal'"

LEGAL CARRIERS of innardsout: 1
  Victreebel-Mega  (requiredItem Victreebelite, baseSpecies Victreebel, tier UU, isNonstandard null)
```

**One, and it is a MEGA.** So the ability is reachable only through a stone, and any fixture that
brings the base forme stages nothing and reports agreement about nothing. Every arm of the probe
therefore asks Showdown's own `canMegaEvo` and asserts `megaRefused === 0`.

`data/tags.json` records `uses: 0` for this ability. That is a fact about the ladder, not about
correctness — see §7 on which scoreboard was expected to move.

## 2. THE AUTHORITY, READ WHOLE

Champions does **not** override this ability. `data/mods/champions/abilities.ts` has no `innardsout`
key at all (grepped, not assumed), so mainline governs — `data/abilities.ts:2130-2137`, the entire
block including the two lines below the `if`:

```js
innardsout: {
  onDamagingHitOrder: 1,
  onDamagingHit(damage, target, source, move) {
    if (!target.hp) {
      if (!move.smartTarget) damage += Number(move.totalDamage);
      this.damage(target.getUndynamaxedHP(damage), source, target);
    }
  },
  flags: {}, name: "Innards Out", rating: 4, num: 215,
},
```

Three things read off it, each of which decided a line of the fix:

- **The gate is `!target.hp`** — the holder's HP *after* the packet landed. That is the same shape as
  Aftermath, which the `punishesAttacker` tag already carries as `onFaintOnly`.
- **The recipient is `source`** — the attacker. Not the holder.
- **`move.totalDamage` is ZERO at this moment.** `move.totalDamage = 0` at `battle-actions.ts:862`,
  and `move.totalDamage += damage[i]` at `:965` — which runs *after* `spreadMoveHit` returns, and
  `runEvent('DamagingHit')` is raised *inside* `spreadMoveHit` at `:1121`. So on a single-hit move
  the sum is exactly this hit's damage; on a volley it accumulates the earlier arrivals only.
- **`getUndynamaxedHP` is the identity here.** It rescales only for a body holding the `dynamax`
  volatile (`sim/pokemon.ts`), which Gen 9 cannot apply. Representing it as a multiplier would
  invent a case this format cannot reach.

## 3. WHERE IT LANDS IN THE FAINT SEQUENCE — MEASURED, NOT REASONED

The brief was right that this is where it would be wrong, so it was staged on the authority rather
than derived from the source. Victreebel-Mega on 53/155 eating an Aerial Ace:

```
|-damage|p2a: Victreebel|0 fnt
|-damage|p1a: Corviknight|120/173|[from] ability: Innards Out|[of] p2a: Victreebel
|faint|p2a: Victreebel
```

**The toll lands BETWEEN the holder's own damage line and its `|faint|`.** `faint()` at
`sim/pokemon.ts:1587` only QUEUES; `faintMessages()` does not drain until `battle-actions.ts:976`,
which is below the whole hit loop. That is the identical placement `medicham2`'s `punishesAttacker`
block already documents for Rough Skin, so **no new step was needed** — the existing site was already
in the right place and simply had nothing to spend.

**And yes, it can kill the attacker in turn.** `Battle#damage` faints the source like any other
packet, so the killer's death is queued *behind* the holder's and both drain from the same
`faintMessages()`. Staged and asserted (§6, arm 5 and census probe 2).

## 4. THE DEFECT WAS A DERIVATION BUG, AND IT WAS TWO BUGS

`data/tags.json` before:

```json
"innardsout": { "tags": ["buffsHolderOnHit"], "uses": 0,
  "params": { "buffsHolderOnHit": { "compounds": true, "boosts": null,
                                    "gainsVolatile": null, "when": null } } }
```

`buffsHolderOnHit` is the tag for *"the thing you hit gets STRONGER, and it compounds"* — Stamina,
Justified, Anger Point, Weak Armor, Electromorphosis. It is the **opposite decision** from the one
Innards Out implies. And every param is null, because there is no `this.boost` to read.

**Root cause, in `engine/tag_dex.js`'s `effectRecipients`:**

```js
for (const m of src.matchAll(/this\.(?:damage|heal)\([^,)]*(?:,\s*([A-Za-z_$][\w$]*))?/g)) mark(m[1]);
```

`[^,)]*` stops at the first `)` **or** `,`. Innards Out's first argument is itself a call, so:

```
this.damage(target.getUndynamaxedHP(damage), source, target);
            ^------ [^,)]* ends HERE, at the inner ')', three arguments early
```

The optional recipient group never binds, `m[1]` is `undefined`, and `mark(undefined)` falls into the
`!who` clause meaning *"no second argument, so the holder"*. Demonstrated in isolation against the
control:

```
this.damage(target.getUndynamaxedHP(damage), source, target)   -> recipient group = undefined
this.damage(source.baseMaxhp / 8, source, target)              -> recipient group = "source"
```

So the row derived onto `buffsHolderOnHit`, `punishesAttacker`'s `of()` returned null because
`effectRecipients(a).attacker` was false, and the ability was **mis-derived AND unread**.

### 4a. The taxonomy did not need a new tag — it needed a second amount

`punishesAttacker` already carries `onFaintOnly` (derived from `/!target\.hp\b/`), which was written
for exactly this handler shape. What it could not carry is the AMOUNT: `fraction` reads
`source.baseMaxhp / N`, and Innards Out's toll is not a share of anything. A correctly-recipient'd
Innards Out would therefore have arrived at the consumer with an `onFaintOnly` trigger and **no
number**, and `if (_pun.fraction ...)` would have skipped it in silence — a tag that derives, reads
as wired, and does nothing. So `dealsDamageTaken` was added beside `fraction`.

## 5. WHAT THE DERIVATION CHANGE MATCHED — PRINTED BEFORE IT WAS WIRED

Both halves were measured over the whole format before any consumer was touched.

**The recipient fix** (`argsOf`, a top-level argument split, so nesting cannot end an argument early):

```
abilities in-format with an onDamagingHit/onHit handler: 34
RECIPIENT READING CHANGED ON: 1
  HAS-CARRIER  Innards Out    holder -> attacker
```

**Exactly one row moves, and it is the one under test.** Every other handler — including the eleven
whose recipient is implicit — is byte-identical to what the character class returned. It is a
strictly wider reader, not a different rule.

**The new `dealsDamageTaken` param:**

```
handlers examined: 34
MATCHED: 1
  HAS-CARRIER  Innards Out   relayVar="damage"   amount expression: target.getUndynamaxedHP(damage)

CONTRAST - the `fraction` members:
  HAS-CARRIER  Aftermath 1/4    no-carrier Gulp Missile 1/4
  no-carrier   Iron Barbs 1/8   HAS-CARRIER Rough Skin 1/8

OVERLAP CHECK - may a row carry BOTH an amount and a fraction?
  (nothing printed = the two amounts are disjoint)
```

**And the regenerated artifact, diffed row by row:**

```
EVERY ABILITY WHOSE TAG LIST CHANGED
  innardsout  ["buffsHolderOnHit"] -> ["punishesAttacker"]
  total tag-list changes: 1

EVERY ABILITY WHOSE PARAMS CHANGED: 13
  the other 12 are all `added[dealsDamageTaken=null]  removed[]  changed[]` — purely additive

buffsHolderOnHit members AFTER: angerpoint, electromorphosis, justified, stamina, weakarmor
punishesAttacker members AFTER: spicyspray, aftermath, cursedbody, cutecharm, effectspore,
  flamebody, gooey, innardsout, poisonpoint, roughskin, sandspit, static, toxicdebris
```

`buffsHolderOnHit` keeps all five of its real members, so nothing was taken out from under an
existing probe.

## 6. THE PROBE — `tests/probe_innards_out.js`, SHOWN RED FIRST

`MEDI_NO_DAMAGE_TAKEN_TOLL=1` puts the consumer back to spending only `fraction`, which is the engine
that shipped. The knob deliberately does **not** revert `tags.json`: the derivation is regenerated
data, not code, so the red arm is the honest one — the tag is right and nothing spends it.

Four arms, three of which must produce NO toll, because a fixture that only proves "it now fires"
ships an over-fire:

| arm | what it is | red (`--broken`) | green |
|---|---|---|---|
| `ko-by-a-move` | the defect; turn 1 is its own over-fire control (a real, connecting, super-effective hit that the holder SURVIVES) | **2 diffs** — `corviknight hp` showdown **120** / ours **173** | identical, 3 boundaries |
| `killed-by-residual` | trigger control: a Ghost Curse kills the holder, no move involved | identical | identical, 6 boundaries |
| `status-move-only` | category control: nothing damaging is ever aimed at the holder | identical | identical, 3 boundaries |
| `toll-kills-the-killer` | the chain: Brave Bird kills from full, so the toll exceeds what the killer can pay | **12 diffs** — `corviknight party.fainted` showdown **true** / ours **false**, `party.status` **fnt** / ours empty | identical, 2 boundaries |

The two controls are **unmoved by the knob in both arms** — asserted, not assumed, because a control
that moves when the knob moves was never a control.

**Three fixture faults were mine, not the engine's**, and each is recorded at its own call site:
Toxic against a Grass/**POISON** body would have staged an immunity rather than a residual;
Will-O-Wisp is 85 accuracy, so one roll could erase the arm's whole premise; and two scripts outlived
the bodies they addressed, so a click landed on a replacement that could not learn it and Showdown
rejected the `pass`.

## 7. WHICH SCOREBOARD, SAID BEFORE THE RUN

**Predicted: the lab moves, and the pool is expected to move but need not.** 6 games of 961 is the
card's own figure; one legal carrier with `uses: 0` in `data/tags.json` means the pinned pool may
hold few or no Victreebel. Stated before running rather than explained afterwards.

- **Census 788 -> 790 live / 790 probed / 0 missing**, `run_ok` true, 0 threw, 0 hollow.
  `status.js` reads `790/790 probed mechanics live, 0 missing`.
- **`direct-call probes 1 -> 3` fired on the first census run and is the guard working.**
  `innardsHit(` and `innardsChain(` are now declared in `REALTURN` with their reason, exactly as that
  paragraph requires; the count is back to its ratcheted floor of 1.
- **`data/abra-tags.js` was regenerated**, because `tag_dex` moved `tags.json` and
  `artifact_audit.js` caught the pair. Audit gaps 2 -> 1; the survivor is the pre-existing
  `engine-data.js` regeneration, which is queued separately and which this pass never touched.

## 8. THE EMPIRICAL ARM — 106 -> 100 OF 961, AND THE 6 ARE ATTRIBUTED BY NAME

Same pins as the baseline, verified field by field rather than assumed: census pin
`9446a684709d`, `--team-store data/team-pool-frozen`, pool `0d103fb9fa87`, 961 games, cap 12, arm
`middle`, policy `empirical-click/v1`, `--end-state`. Written to
`data/verification/game-differential.innardsout.json`; nothing published was touched.

```
                          BASELINE (redirect)   AFTER (innardsout)
  engine release             4b67526d29d8          0a2282c9231b
  games                              961                   961
  boards never diverged              855                   861
  BOARD-PARTED                       106                   100
  by_cause board-material             96                    90
  protocol diverged                  225                   222
  turn-1 boards identical            954                   955
  game agreement                  0.8897                0.8959

  node engine/arms_comparable.js <before> <after>   ->   COMPARABLE, exit 0
```

**THE ATTRIBUTION IS EXACT AND IT IS 6, WHICH IS THE CARD'S OWN NUMBER.** Hunting the cause tables
for the mechanic by name:

```
BEFORE — 4 distinct causes, all in class `event missing from medicham2`:
   n=1   |-damage|p2b|H/H|[from]innardsout  <>  |faint|p1a
   n=1   |-damage|p1a|0fnt|[from]innardsout <>  |faint|p2a
   n=3   |-damage|p1b|H/H|[from]innardsout  <>  |faint|p2a
   n=1   |-damage|p2a|H/H|[from]innardsout  <>  |faint|p1a
                                          total  6 games

AFTER — 0.
```

Every one has the same shape: the authority writes the toll where this engine wrote the faint,
which is §3's ordering seen from the other side. `event missing from medicham2` falls 62 -> 57.

**One of those 6 is `0fnt` — the toll killing the killer** — so the chain case is not only a staged
fixture, it occurs in real recorded play.

**NO BOARD REGRESSED**, and that is read rather than argued: `games_board_never_diverged` moved
strictly upward, 855 -> 861. Three causes appear that were not there before, covering 3 games, and
all three are **pre-existing defects UNMASKED** — a game whose first divergence was Innards Out now
plays further and meets something else. One is `|-activate|p1a|wideguard` (card **C3**, queued
separately), one is a perish/Tailwind `ordering` pair, one is a confusion `-damage` value. None is
new behaviour introduced by this change.

---

## OWED, NOT RUN

- **`node engine/status.js --write` was NOT run.** `docs/_reports/2026-08-29-overnight-log.md` is
  modified in the tree by **another agent** — 29 appended lines on the `coverage.js` ranged-mechanics
  row and an undeclared filter in the move priors — and this pass never opened it. Stamping the
  generated blocks would record a half-modified tree as state. Reported, left alone.
  (`data/engine-release.json` and `data/provenance-stamp.json` also moved; those ARE this pass's,
  written by the release cuts the probe and the differential took.)
- **`data/tag-walk.json` moved and NOTHING IN IT REGRESSED**, checked rather than assumed: agree 6,
  diverge 9, notCovered 5, skipped 20, checked 40 — identical to HEAD. The 53-line churn is row
  reordering plus `uses` counts rising (145,559 -> 149,172) because OPS appends to the store hourly,
  which is the unfrozen-store hazard CLAUDE.md names and not a change from this work.
- **Nothing was committed and nothing was pushed**, per the brief.
- **The roster stages were not re-run.** All three read `MEASURED AGAINST A DIFFERENT ENGINE` in
  `status.js` (artifact release `e129bca605e3`, tree moved), and they were already stale before this
  pass. Owed: `SHOWDOWN_PATH=... node tests/roster.js --stage {items,abilities,moves} --write`.
- **`data/all-mechanics-fire.json` was not re-run** and reads `MEASURED AGAINST A DIFFERENT ENGINE`
  for the same reason.
- **`tests/test-engine-diff.js` was NOT run.** It has no `--out` flag, so it would rewrite the
  published damage artifact. The damage differential is not expected to move — this fix adds a
  packet at a faint and changes no damage formula — but that is a PREDICTION and not a measurement,
  and it is recorded as one.
- **The multi-hit interior is untouched and is its own card.** `_rowDealt` is the cumulative clamped
  damage under `medicham2`'s declared one-packet divergence (WIRE 20), so the number is right for
  both single and multi hit *today*; when the volley is split into real arrivals, the
  `move.totalDamage` accumulation in the authority's handler has to be re-read against it.
- **A stray scratchpad directory exists and was NOT deleted**, per the standing rule:
  `C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\3373376e-24aa-470c-a411-22c738d9b102\`
  — created by a path typo of mine (`c738` for `c728`) and containing only a `placeholder.txt`.
  Reported, left in place.
- **`engine/tag_dex.js` OOMs at the default heap and this is PRE-EXISTING** — confirmed by stashing
  every edit and re-running the unmodified file, which died identically. It needs
  `--max-old-space-size=6144`. Not fixed here; it is not this card.
