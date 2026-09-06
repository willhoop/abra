# Long-tail batch C — the three named defects, plus the biggest bucket nobody had named

**Board-material 50 → 50 of 961. Protocol 151 → 114. Census level unchanged at 829 / 829 / 0.**

Four mechanics landed, each with its own knob, its own probe shown RED first, its own frozen release
and its own paired measurement. Nothing is committed.

---

## 0. THE LEDGER

Pins IDENTICAL on every whole-game run: census `data/verification/census-pin-9446a684709d.json`,
pool `data/team-pool-frozen`, arm `middle`, `--end-state`, steering `empirical`, cap 20, 1200 games
requested / 961 played, `driver_code_stable: true` throughout.

| step | what landed | release | board-material | protocol | artifact |
|---|---|---|---|---|---|
| baseline | as published | `db248fe67a5e` | 50 | 151 | `data/game-differential.json` at HEAD |
| 1 | Struggle's `-activate` | `778fbc72c360` | **50** | **137** | `longtail-C-struggle.json` |
| 2 | the item announcement moves to `onTryHit` | `3c082897e777` | **50** | **130** | `longtail-C-poltergeist.json` |
| 3 | `mustrecharge` at priority 11 | `25dc68013c82` | **50** | **130** | `longtail-C-recharge.json` |
| 4 | a move with no legal target announces its failure | `d7d83e49fa6c` | **50** | **114** | `longtail-C-notarget.json` |
| settled | line endings restored, artifact republished | `a985300cb8ed` | **50** | **114** | `data/game-differential.json` |

**Every board-material call was 50 and every one landed.** The four protocol calls were 136 / 131 /
130 / 116 against 137 / 130 / 130 / 114 — three misses of one, one, and two, all written to
`data/verification/_prediction-longtail-C-*.json` before their runs.

`node engine/status.js` reads **7 of 9 clauses passing**; the two failures are the whole-game
BOARD-MATERIAL and NARRATION clauses, on the measured counts.

---

## 1. STRUGGLE — `setsOwnTypeAlways` IS DERIVED FROM A TWO-STATEMENT HANDLER AND THIS ENGINE READ ONE

### The authority, read

```
data/moves.ts:18218-18221, and /data/mods/champions/moves.ts carries NO `struggle` key
  onModifyMove(move, pokemon, target) {
    move.type = '???';
    this.add('-activate', pokemon, 'move: Struggle');
  }
```

`singleEvent('ModifyMove', ...)` is `sim/battle-actions.ts:431` and `addMove('move', ...)` is `:457`
— the same method, twenty-six lines apart — so the line sits IMMEDIATELY ABOVE the move line.
`move.type = '???'` has reached `effMoveType` and `dmgRangeOneHit` since ROADMAP #144; the second
statement reached nothing. **17 of the 151 first-divergence rows named it, the largest bucket in the
artifact.**

### The tag regeneration, and what else moved

`engine/tag_dex.js`'s `setsOwnTypeAlways` now also returns `announce`, read by the file's existing
`announceIn` helper — the same reader `survivesFromFull` and `fractionalPriority` use, so no event
name and no prefix is typed. **Membership printed before it was wired: exactly one member,
`struggle`, `{event:'-activate', prefix:'move'}`.**

`data/tags.json` regenerated. **Nine leaves differ against the copy this session started from, and
that is the whole diff:**

| leaf | before | after |
|---|---|---|
| `moves.struggle.params.setsOwnTypeAlways.announce.event` | `undefined` | `"-activate"` |
| `moves.struggle.params.setsOwnTypeAlways.announce.prefix` | `undefined` | `"move"` |
| `tags[1].param` / `tags[1].why` | the old prose | the new prose |
| `tags[31] cantUseTwice` `used` / `consumedBy` | `false` / `null` | `true` / `cantusetwice` |
| `tags[227] privateWeather` `used` / `consumedBy` | `false` / `null` | `true` / `onWeatherModifyDamage` |
| `generated` | 2026-09-05T00:34Z | 2026-09-06T06:13Z |

Zero usage counts moved, zero linkage rows moved, zero entity tag-memberships moved. The two `used`
flips are the read-detector (a GREP for the probe string) catching up with engine work that landed on
2026-09-05 — Gigaton Hammer's `cantusetwice` and the private-weather damage modifier. Neither is a new
derivation and neither is a param.

`data/abra-tags.js` rebuilt from it; `node build/build_tags_js.js --check` reports *"is exactly what
data/tags.json would produce."* The fifth-drift hazard is closed for this pass.

### Red first

`tests/probe_struggle_announce.js`, knob `MEDI_NO_OWNTYPE_ANNOUNCE`. Two arms — `drained` (the
clicker holds ONE 5-PP move and the authority's own request replaces its whole menu with Struggle)
and `full` (the identical board with a live slot left). The claim is an ORDERED PAIR: the line printed
immediately above the `|move|...|struggle|` line.

```
before   authority above the move line: "|-activate|p1a|struggle"
         ours      above the move line: "|-boost|p1b|spd|0"
after    both: "|-activate|p1a|struggle"
```

**Three arms (`middle`, `top-tie-first`, `bottom-tie-first`) clear; the knob puts exactly two clauses
red on all three and moves no byte of the control.** The emptying turn is read off the AUTHORITY's own
request (`offered [struggle]`), never off this file's PP arithmetic.

### The measurement

**Board-material 50 → 50 (called). Protocol 151 → 137 (called 136).** Attribution joined on the FULL
by-cause list: the four `|-activate|pXY|struggle <> |move|pXY|struggle` rows go 6/6/3/2 → **0**, and
exactly three games re-classify onto a divergence that was sitting behind the missing line
(`-fail field 3` +1, `extra event emitted by medicham2` +1, `ordering` +1). 14 of 17 closed outright;
I called 15.

---

## 2. POLTERGEIST — `onTry` AND `onTryHit` ARE TWO MOMENTS AND THIS ENGINE RAN BOTH AT THE FIRST

### The authority, read

```
data/moves.ts:13607-13612, no Champions override
  onTry(source, target)          { return !!target.item; }
  onTryHit(target, source, move) { this.add('-activate', target, 'move: Poltergeist',
                                            this.dex.items.get(target.item).name); }
```

A MOVE's own `onTryHit` is `singleEvent('TryHit', moveData, {}, target, pokemon, move)` at
`battle-actions.ts:1044`, inside `spreadMoveHit`, which `hitStepMoveHitLoop` calls — and that is the
LAST entry in `moveSteps` (`:556-577`). So the announcement is owed BELOW invulnerability, the TryHit
event (Protect), type immunity, move-specific immunity, accuracy, break-protect and steal-boosts.

This engine emitted it beside the `onTry` refusal, two hundred lines above every gate, so a Protected,
immune or missed click still read the item out — **8 rows in the artifact, in three shapes:**

```
|-miss|p2b|p1a              <> |-activate|p1a|poltergeist|charizarditey
|-immune|p2a                <> |-activate|p2a|poltergeist|focussash
|-activate|p2a|protect      <> |-activate|p2a|poltergeist|leftovers
```

### The fix

The emission moved into a new `_stepAnnounceItem`, placed in `_STEPS` beside `_stepClearScreens` —
the OTHER move-owned `onTryHit` in this format, which is at that position for exactly the same reason.
It fires ONCE per move on the first surviving row, because `spreadMoveHit` opens
`const target = targets[0]` and its own comment says *"no spread moves have any kind of onTryHit
handler"*. Refusal is the driver's `R.out`, so it cannot drift from the six gates that set it. The
`onTry` `-fail` stays where it is, because `onTry` really is at use time.

### Red first, and the control had to be rebuilt

`tests/probe_poltergeist_announce_step.js`, knob `MEDI_ITEM_ANNOUNCE_AT_USE`. Four arms: `connected`
(control), `protected` (step 1), `immune` (step 2), `invulnerable` (step 0).

**THE FIRST VERSION OF THIS PROBE HAD ITS CONTROL SILENTLY DELETED BY A DIE AND IT IS WORTH RECORDING.**
Poltergeist is 90 accurate and the accuracy stream is SHARED, so on `top-tie-first` — a corner arm that
takes the extreme roll every time — all three of the control's clicks MISSED. The arm reported
`hp drop 0` and the probe accused the engine of not writing a line it was never owed. The clicker now
carries **No Guard**, checked against the species' own row, which removes the die from three arms; the
fourth deliberately takes the ability away from the same body, because No Guard also bypasses
semi-invulnerability and would erase that arm.

**All three differential arms clear; the knob puts exactly 6 clauses red on all three, and the
`connected` control does not move under it.**

### The measurement

**Board-material 50 → 50 (called). Protocol 137 → 130 (called 131).** All **8** poltergeist rows go
to zero and exactly one game re-classifies. My prediction listed SEVEN rows — I under-counted the
bucket by one while over-estimating the re-classification rate, and the two errors cancelled to a
one-game miss.

---

## 3. `mustrecharge` IS `onBeforeMovePriority: 11`, THE HIGHEST IN THE FORMAT, AND IT WAS ASKED LAST

### The ordering, derived

`runEvent` sorts handlers highest-first. Every `onBeforeMovePriority` in this regulation:

```
mustrecharge  data/conditions.ts:367   11
slp           data/conditions.ts:66    10      Champions overrides the BODY, not the priority
frz           data/conditions.ts:96    10
flinch        data/conditions.ts:201    8
confusion     data/conditions.ts:179    3
attract       data/moves.ts:742         2
par           data/conditions.ts:38     1
```

The probe re-derives this table off the loaded checkout on every run and **exits 2 rather than pass**
if recharge stops being the top of it.

### This is a BOARD claim, not a narration one

A body that is asleep and owes a recharge paid the SLEEP in this engine: it wrote `|cant|slp`, spent a
tick of a counter the authority does not touch, and carried the recharge into the following turn.
Measured at the turn-3 boundary, before the fix:

```
t3 {"path":"p1.party.machamp.status_counter","medicham":1,"showdown":0}
   {"path":"p1.active[0].status_counter",     "medicham":1,"showdown":0}
   {"path":"p1.active[0].vol.mustrecharge",   "medicham":1,"showdown":0}
```

### The fix

`spendRecharge` is extracted as the ONE implementation and called from two positions, which is the
authority's own two roads: the BeforeMove event at priority 11 (hoisted to the top of the block, below
the Destiny Bond clear), and the pre-existing site below the gate, kept as a COUNTED backstop for a
caller-supplied switch or pass. `MEDSEEN.rechargeSpentAtBeforeMove` and `rechargeSpentOffMove` are
separate so a driver inventing an action the format cannot produce is visible rather than pooled.

**The Destiny Bond clear stays ABOVE the recharge on purpose.** Destiny Bond's own handler is
`onBeforeMovePriority: -1` — the bottom — but it also carries `onMoveAborted`, which `runMove` raises
whenever BeforeMove returns falsy (`battle-actions.ts:256-257`), so the volatile goes whether the body
moves or is refused. Hoisting recharge above the clear would have kept a bond alive that the authority
drops.

### Red first

`tests/probe_recharge_priority.js`, knob `MEDI_RECHARGE_BELOW_STATUS`. Three arms — `both`,
`recharge-only`, `sleep-only` — and nothing depends on a die: Yawn has `accuracy: true` (read off the
format) and the recharge move is clicked by a No Guard body. Both conditions are read off the
AUTHORITY's own body at the turn-3 boundary (`status "slp"`, `recharge true`) rather than off the
probe's timing arithmetic. **4 clauses red before, all clear after, both controls untouched
throughout; three arms clear and the knob reproduces the 4 reds on every one.**

### The measurement, and the pool was called STILL before the run

**Board-material 50 → 50. Protocol 130 → 130. `first_divergences`, `state.first_board_divergences`,
`classes` and `end_state` are BYTE-IDENTICAL strings across the two runs — zero cause rows moved.**

That was written down first, with the reason: the defect needs a body to owe a recharge AND be asleep,
frozen, flinched, confused, attracted or paralysed on the same turn, and the artifact carried no cause
row naming a recharge at all. This is Will's 2026-08-23 ruling working as intended — the LAB carries
the obscure tail and the pinned pool is not where it lives.

**The wire is a READING, not an inference.** `game_differential.js` runs the engine out of the RELEASE
snapshot, so its `MEDSEEN` is a different module instance and the counters cannot be read off that
run. Two turns were staged against the LIVE module instead:
`rechargeSpentAtBeforeMove 0 → 1` (asleep + recharging: recharge spent, sleep counter still 0) and
`rechargeSpentOffMove 0 → 1` (a caller-supplied switch), with `rechargeBelowStatusRestored` at 0.

---

## 4. THE BIGGEST BUCKET NOBODY HAD NAMED — ROADMAP #84's OTHER HALF

### How it was found

`--dump-games 170` on release `25dc68013c82` wrote `data/divergence-turns.json` with 125 of the 130
diverging games and their surrounding lines. Bucketing the FULL by-cause list rather than the capped
`first_board_divergences`:

| bucket | games |
|---|---|
| **bare `\|-fail\|pXY` this engine never wrote** | **32** |
| 30% post-hit ability procs (Poison Touch / Cursed Body / Flame Body) | 11 |
| berry or item not consumed | 9 |
| freeze / status cure | 7 |
| zero-magnitude boost | 5 |
| mega / forme | 5 |

### The rule, read

```
sim/battle-actions.ts:508-513, inside `useMoveInner`, on the NON-field branch
  if (!targets.length) {
    this.battle.attrLastMove('[notarget]');
    this.battle.add(this.battle.gen >= 5 ? '-fail' : '-notarget', pokemon);
    return false;
  }
```

**ROADMAP #84 had already derived this and wired half of it.** The engine computes `_hadTargets` and,
when it is false, sets `m._mvRes = false` — the Stomping Tantrum half — and emits nothing. Its own
comment quotes `add('-fail', pokemon)` on the line above.

This is not an edge case: faints are collected as the turn resolves and replacements are only asked
for at the end of it, so any doubles turn in which a spread move takes both foes and a slower ally
still has a click queued produces one.

### The fix, and the carve-out is the authority's own

The emission is at the `!_hadTargets` site. The FIELD classes are excluded because `useMoveInner`
sends `all` / `foeSide` / `allySide` / `allyTeam` to `tryMoveHit` and the `-fail` lives in the `else` —
the class comes out of `targetClass.target`, the same reader `aimTravelsByLoc` and `defaultTargetOf`
use, and a class this engine cannot read is COUNTED (`MEDFAILS.noTargetClassUnknown`) and falls
through to the old silence rather than guessing. `[notarget]` is written too; it lands in the fifth
field of the `|move|` line, which the differ truncates, so it moves no counter and is here to match
the authority byte for byte.

### Red first

`tests/probe_no_legal_target_fail.js`, knob `MEDI_NO_TARGET_SILENT`. Three arms, none on a die (every
move is 100 accuracy, asserted off the format): `no-targets` (a fast ally's spread move takes both
foes and the slower prober's single-target click has nothing left), `one-target` and `both-alive`. The
arm's precondition is read off the AUTHORITY's own `|move|` order and its own two `|faint|` lines.
**Three differential arms clear; the knob puts 2 clauses red on all three; neither control writes a
`-fail` on either engine, which is the clause a blanket "the aimed body is gone, so fail" would break.**

### The measurement

**Board-material 50 → 50 (called). Protocol 130 → 114 (called 116).** Exactly **17** cause rows go to
zero — the number the prediction named as reachable — and exactly one game re-classifies. The close
rate was 16 of 17 rather than the 14 I modelled, which the prediction had said to expect: a `-fail` is
the last line of a failing move in a late-game turn, so there is less turn left for a second
divergence to hide behind.

**15 of the 32 `-fail` rows are NOT this cause and are untouched:** Ally Switch with no partner (3),
`|-fail|...|substitute|[weak]`, Yawn (2), Leech Seed (2), Last Resort, Trick, Instruct, Sucker Punch,
Rage Powder, and two `-fail` lines written on the TARGET rather than on the mover.

---

## 5. THE INSTRUMENT WAS THE SUSPECT FOUR TIMES AND WAS RIGHT THREE OF THEM

Every one of these was a probe accusing the engine of something the measurement it defends cannot see.
All four are now applied to all four new probes, each with the differ's own line and rule id beside it.

| what the probe reported | what it actually was |
|---|---|
| `\|-damage\|p2a\|h/h` twice on the authority and once on ours | `\|split\|SIDE` carries the omniscient line THEN the spectator line. `game_differential.js:2078` keeps the first. The probe kept both. |
| `\|move\|...\|[miss]` on the authority only | `attrLastMove` APPENDS to the move line; the differ truncates a `\|move\|` line to four fields (`move-target-field`, :2179). |
| two Yawn attribution gaps, **on the CONTROL arm** | `[of]` is dropped by `source-tag` (:2156) and `[silent]` by `display-flags` (:2171). Both are declared equivalences. |
| a missing `\|-ability\|p2a\|pressure` on a switch-in | `ability-announcement` (:2139) maps every `\|-ability\|` line to null. |

The fourth suspect — the accuracy die deleting the Poltergeist control on `top-tie-first` — was the
INSTRUMENT too, and it is the one that would have produced a false green rather than a false red.

---

## 6. A PYTHON REWRITE FLIPPED THE WHOLE ENGINE TO CRLF, AND THE ROSTER CAUGHT IT

Three of the engine edits were applied with a Python script. Python's text mode on Windows translates
`\n` to `\r\n` on write, so **`engine/medicham2-browser.js` came out with 40,622 CRLF line endings
where it had none.** JavaScript does not care; two things did:

1. `git diff --stat` was the whole 40k-line file rather than 243 lines.
2. **`tests/roster.js`'s red self-test plants are TEXT ANCHORS into that file**, and two of them stopped
   matching — reported as *"the anchor matched 0 time(s), not exactly once — an unapplied plant reads
   exactly like a comparator that found nothing"*, which turned the abilities and moves roster clauses
   RED.

Restored to LF; both anchors matched again; a new release was cut and **every clause the line-ending
change staled was re-run on it** (damage differential, three roster stages, the census, the mechanics
fire, and the whole-game republish).

### AND TWO OF THE FOUR REDS WERE PRE-EXISTING ROT THAT A SHIPPED ARTIFACT WAS HIDING

Testing the four dead anchors against `git show HEAD:engine/medicham2-browser.js` separated them:

| plant | matched at HEAD | cause |
|---|---|---|
| `move/boosts-self`, `move/needs-a-stat-stage-to-act-on` | **yes** | my CRLF |
| `ability/aids-its-ally` | **no** | the ally-guard site learned about Mold Breaker and now reads `_fgAb`, not `_pal.ability` |
| `move/needs-the-user-off-full-hp` | **no** | the Leech Seed seeder's return grew Big Root's multiplier on 2026-09-05 |

The last two were dead at HEAD and invisible, because `data/roster.{abilities,moves}.json` at HEAD
carry `reds: []` — written by a run that never armed the self-test. **That is the third time an
artifact has hidden a plant that could not go red** (docs/ENGINE.md records the same shape on
2026-09-04 and 2026-09-05). Both anchors are re-aimed in `tests/roster.js` with the diagnosis written
beside them, and all three stages now report **0 not-ok reds** — 18 / 29 / 35 demonstrations, every one
of them able to go red.

---

## 7. OWED AND NAMED, NOT FIXED HERE

- **THE IMMUNITY STEP IS SPLIT ACROSS THE AUTHORITY AND POOLED HERE — 5 games, derived, not probed.**
  `Pokemon#runImmunity` (`sim/pokemon.ts:2242-2268`) writes
  `|-immune|<body>|[from] ability: Levitate` and is called from `hitStepTypeImmunity` — **step 2**.
  Soundproof, Bulletproof and Overcoat answer `onTryHit` on the ABILITY, which is
  `runEvent('TryHit', ...)` — **step 1**. A move's own `onTryImmunity` is **step 3**. This engine puts
  all of them in `moveClassBlocked`, which it calls from `_stepTryImm` (step 3), so when a spread move
  meets two immune bodies the two `|-immune|` lines come out in the wrong order. The artifact carries
  four `ordering :: |-immune|pXY <> |-immune|pZW|[from]levitate` rows and one
  `|-immune|p2a|[from]soundproof <> |-immune|p2b`. **The fix is a `stage` param on `immuneToMoveClass`
  derived from WHICH HOOK each ability declares, plus a split in the step list** — a tag regeneration
  and a step-list change, which is the highest-risk shape in this engine and belongs in its own pass.
- The **remaining 15 bare `-fail` rows** listed in §4 — Ally Switch with no partner is the largest
  sub-shape at 3.
- The 30% post-hit ability procs (11) remain filed as INSTRUMENT: the draw is the `any` stream on both
  sides and `midGameVoid` DECLARES that stream unshared. Unchanged from batch A.
- The `active[].stall` rows, the berry-not-eaten games, the freeze-thaw games and the unattributed
  damage games are all carried forward from `docs/_reports/2026-09-05-longtail-batch-A.md`.

---

## 8. WHAT DID NOT MOVE, AND IS NOT CLAIMED

- **No fit, no self-play, no `status.js --write`, no commit.**
- `board.js`, `magnemite.js`, `engine-data.js`, `game_differential.js`, `board_state.js`,
  `steering.js`, `empirical_driver.js`, `move-priors.json` and `policy-weights.json` were **not
  touched.**
- `data/divergence-turns.json` WAS rewritten — it is the `--dump-games` artifact and that run is how
  §4 was found. `data/game-differential.json` was written only by the two deliberate republishes; the
  four attributed runs all used `--out`.
- **The living documents WERE updated after all, and the reason is a gate rather than a choice.** The
  first draft of this report said they were left alone to avoid colliding with the session rebuilding
  `build/` and the PDFs. Bumping `CHANGELOG.md` to 5.260.0 then turned `tests/test-docs-current.js`
  RED — six version-headed documents stranded at 5.259.0 — and the white paper's own lead paragraph
  was publishing `PROTOCOL FIRST-DIVERGENCE 151 OF 961`, which this pass supersedes. So the update was
  mandatory, not optional. `docs/{ABRA-whitepaper,SUMMARY,MODELS,ABRA-deck-plain-english,
  ABRA-technical-docs,DAMAGE-STAGES}.md` each gained a 5.260.0 block and a bumped header; the gate is
  back to **24 passed, 0 failed**, and `test-roadmap-register`, `test-artifact-rerunnable`,
  `engine/artifact_audit.js` and `test-no-silent-failure.js` are all green on the changed files. The
  other session had already committed its work (`324ae2b8`, `3c2ded88`) and held nothing modified in
  the working tree, so nothing was overwritten.
- **THE SIX `.pdf` FILES ARE NOW STALE AGAINST THEIR `.md` AND THAT IS OWED TO THE DOCS SESSION.** The
  PDF build belongs to the session that was running it; this pass did not touch `build/`.
- **`data/releases/` IS GITIGNORED** (`.gitignore:138`), so the five snapshots cut here —
  `778fbc72c360`, `3c082897e777`, `25dc68013c82`, `d7d83e49fa6c`, `a985300cb8ed` — will not be
  committed. `data/engine-release.json` is tracked and records the current id. That is the existing
  convention (556 directories on disk, a handful tracked from before the ignore) and is stated rather
  than changed.

---

## 9. FILES

Written:

- `engine/tag_dex.js` — `announce` on `setsOwnTypeAlways`, via the existing `announceIn` reader.
- `data/tags.json` regenerated (9 leaves differ, table in §1); `data/abra-tags.js` rebuilt and
  `--check` clean.
- `engine/medicham2-browser.js` — the own-type announcement above `TR.mv`; `_stepAnnounceItem` in the
  step list; `spendRecharge` + the hoisted BeforeMove position + the counted backstop; the
  targetless `-fail` and `FIELD_TARGET_CLASSES`; four knobs
  (`MEDI_NO_OWNTYPE_ANNOUNCE`, `MEDI_ITEM_ANNOUNCE_AT_USE`, `MEDI_RECHARGE_BELOW_STATUS`,
  `MEDI_NO_TARGET_SILENT`); eight counters.
- `tests/probe_struggle_announce.js`, `tests/probe_poltergeist_announce_step.js`,
  `tests/probe_recharge_priority.js`, `tests/probe_no_legal_target_fail.js` — all new.
- `tests/roster.js` — the two rotted red anchors re-aimed, each with its diagnosis.
- `data/verification/longtail-C-{struggle,poltergeist,recharge,notarget}.json` and the four
  `_prediction-longtail-C-*.json` written before their runs.
- `data/engine-release.json` + `data/releases/{778fbc72c360,3c082897e777,25dc68013c82,d7d83e49fa6c,a985300cb8ed}`.
- Regenerated on the settled release `a985300cb8ed`: `data/mechanics-census.json` (829/829/0),
  `data/engine-diff.json` (6000/6000, disagreed 0), `data/roster.{items,abilities,moves}.json`
  (140 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE, 0 not-ok reds), `data/all-mechanics-fire.json`
  (1313 games, 0 threw), `data/game-differential.json` (50 / 114).
