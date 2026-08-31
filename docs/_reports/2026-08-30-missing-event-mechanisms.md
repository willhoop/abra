# `event missing from medicham2` IS 19 MECHANISMS AND TWO OF THEM ARE HALF THE CLASS — 23 OF 54 GAMES ARE ONE MISSING BANNER AND ONE MISSING REFUSAL

**2026-08-30. Diagnosis only — nothing was fixed, nothing was run, no game was played.**

Read from `git show HEAD:data/verification/divergence-turns.stolenberry.json` and
`git show HEAD:data/verification/game-differential.stolenberry.json` (HEAD `5120cc32`; another agent
is writing `data/verification/`, so the stable read was used deliberately). Release `0e8ec5729a7b`,
showdown `20ad99ffc9a5`, pool `data/team-pool-frozen` `0d103fb9fa87`, census pin `9446a684709d`,
961 games, cap 12, arm `middle`, all 8 configs.

**THE CLASS IS 54 GAMES, NOT 51** — `classes[].games` for `event missing from medicham2`, 45 distinct
cause strings. It is the largest class in the run (54 of 173 protocol partings). **13 of the 54 part a
board** (`end_state[0].summary.by_cause[].board_parted`). The dump carries **52** of the 54; the two it
misses are read from the cause STRING alone and are marked as such.

**A board parting is CORRELATION, not attribution.** The differential does not attribute an end-state
difference to the line that split the stream, and on several of these the split is many turns upstream.

---

## THE RANKED TABLE

| # | Games | BM | Mechanism | Confidence | Already filed? |
|---|---|---|---|---|---|
| E1 | 11 | 2 | **Struggle's `-activate` banner is never emitted.** Everything after it agrees | HIGH — cited | no |
| E2 | 12 | 0 | **A move with no legal target left: the authority writes `-fail`, we write nothing** | HIGH — cited | no (#371 is the *other* class; #383 is the opposite direction) |
| E3 | 4 | 0 | **A boost clamped to zero by an ABILITY-sourced call is not announced** | HIGH — cited | family of #289 / #398, but a site **neither** closed |
| E4 | 4 | 0 | **Mega Sol's `-activate` banner on a sun-conditional move.** The mechanic itself is right | HIGH — cited | no |
| E5 | 3 | 0 | **Dire Claw's Champions-only `-fail` when the target already has a status** | HIGH — cited | no |
| E6 | 2 | 1 | **A move that fails on its target (Yawn into sleep, Leech Seed into seeded): no `-fail`** | MEDIUM | no |
| E7 | 2 | 0 | **Quick Claw does not fire** — banner missing AND the turn order differs | HIGH | **#498, open** |
| E8 | 2 | 0 | **A `[silent]` `-end` of a volatile.** One half is already declared NOT A DEFECT | HIGH | **#321 closed (!), #345 open** |
| E9 | 1 | 0 | **A multi-hit move stops at the hit that breaks a Substitute** — hit 2 and `-hitcount` both lost | MEDIUM | close to **#511** |
| E10 | 1 | 1 | **A two-hit drain does not heal per hit, and hit 2's damage differs** | MEDIUM | sibling of **#339**, **#500** |
| E11 | 1 | 1 | **Cursed Body does not fire from a body the same hit is killing** | MEDIUM | no |
| E12 | 1 | 1 | **Poison Touch does not fire after the target's Lum Berry cured the move's own status** | MEDIUM | no |
| E13 | 1 | 1 | **Close Combat's self-drop is lost when the hit was absorbed by a Substitute** | MEDIUM | no |
| E14 | 1 | 1 | **Skill Swap does not re-trigger the acquired switch-in ability on the recipient** | MEDIUM | no |
| E15 | 1 | 0 | **Heal Block (from Psychic Noise) never expires** — and the artifact says this cause `cannot_occur_in_format`, which is **WRONG** | HIGH — derived | **INSTRUMENT** |
| E16 | 1 | 1 | **A resist berry's `-enditem [eat]`/`[weaken]` pair is not emitted although the weaken IS applied** | MEDIUM | possible residue of tonight's berry batches |
| E17 | 1 | 0 | **A `thawsTarget` move thaws BEFORE its damage here and AFTER it there** — an ORDERING defect in this class | MEDIUM | no |
| E18 | 1 | 0 | **Perish faints are flushed before `\|upkeep\|` here and after it there** | HIGH | **#331, open** |
| E19 | 1 | 1 | **A terrain-conditional spread move does not expand to the second target** | LOW | no |
| — | 1 | 1 | **A damage MAGNITUDE divergence wearing this class's name** | **CANNOT EXPLAIN** | classification is **#349** |
| — | 1 | 1 | `\|-damage\|p2b\|H/H <> \|faint\|p2a` — **not in the dump** | **CANNOT EXPLAIN** | — |
| — | 1 | 1 | `\|-end\|p2a\|futuresight <> \|-sideend\|p1:\|reflect` — **not in the dump** | **CANNOT EXPLAIN** | likely #345 family |

**52 grouped from the dump + 2 unseen = 54. Board-parted 13, which reconciles with the artifact.**

---

## THE HEADLINE

**Two mechanisms are 23 of 54 games and both are a single missing line with identical state either
side.** E1 and E2 together are 43% of the largest remaining class, they are both cited to a source
line, and neither has a register row.

---

## THE ENTRIES

Row numbers are indices into `divergences[]`.

### E1 — Struggle's `-activate` banner (11 games, 2 BM)
Rows 23, 31, 55, 71, 79, 82, 91, 106, 113, 144, 160. Every one is the same three lines: the authority
writes `|-activate|POKEMON|move: Struggle`, then `|move|POKEMON|Struggle|TARGET`; we write only the
`|move|`. Every damage, recoil and hitcount line after it agrees.

`data/moves.ts:18218-18221` — Struggle's `onModifyMove` does two things, `move.type = '???'` and
`this.add('-activate', pokemon, 'move: Struggle')`. The typelessness is evidently already right here
(the damage matches on all 11), so **only the announcement is missing**.

**HYPOTHESIS: the banner is not emitted because it is produced by `onModifyMove` rather than by the
move's own execution, and this engine has no `onModifyMove` step for Struggle.**

**A QUESTION THAT IS NOT MINE TO ANSWER, AND IT SIZES THIS GROUP.** Three of the eleven Struggle on
**turn 2** (rows 23, 55, 106) — a fresh body with no PP left on any move. Both engines agree on
struggling, so the harness mirrors it, but 11 Struggles in 961 twelve-turn games looks high. If the PP
model or the empirical driver is pushing bodies into Struggle that a real game would not,
**E1's population is inflated and the mechanism is still real.** For MEASURE, not for this pass.

### E2 — a move with no legal target left (12 games, 0 BM)
Rows 4, 16, 22, 25, 28, 39, 40, 57, 62, 66, 154, 158. The signature is exact and identical in all
twelve: both engines have already agreed on a **self-addressed** `|move|X|<move>|X` line — which is
what Showdown writes when a move's chosen target is gone — and then the authority writes `|-fail|X`
and we write nothing.

`sim/battle-actions.ts:461-465` and `:510-514`: `this.battle.attrLastMove('[notarget]');
this.battle.add(this.battle.gen >= 5 ? '-fail' : '-notarget', pokemon);`

Every case is the last mover of a turn after both foes fainted. Nothing downstream differs.

**HYPOTHESIS: this engine has the retarget right and the refusal announcement missing — the move is
already being dropped, it is just dropped silently.**

**Not #371** — that row is explicitly *"8 of the 47 NON-`event-missing` divergences"* and is about the
authority refusing a move we EXECUTE. **Not #383** either, which is the opposite direction (we write a
bare `-fail` where the authority writes none). Both are worth reading beside this, and neither covers it.

### E3 — a zero-magnitude boost from an ABILITY-sourced call (4 games, 0 BM)
Rows 29, 88, 103, 30. Showdown writes `|-boost|X|atk|0` / `|-unboost|X|spe|0`; we write nothing.

`sim/battle.ts:2073-2077` — when `boostBy` is falsy the authority still emits, and for an Ability
effect it emits when `isSecondary || isSelf`. Both live sites qualify, derived not recalled:
Defiant is `this.boost({ atk: 2 }, target, target, null, …)` with `isSelf` (rows 29, 88, 103 —
Annihilape and Falinks, both of which carry Defiant), and Gooey is
`this.boost({ spe: -1 }, source, target, null, true)` with `isSecondary` (row 30, Goodra).

**PROVABLY ANNOUNCEMENT-ONLY** — `boostBy === 0` means nothing moved — and it still truncates the
comparison for the rest of the game.

**READ #289 AND #398 BEFORE TOUCHING THIS.** #289 fixed the trace emitter's `if(!d) return;` for three
opt-in sites; #398 closed the MOVE-primary path. This row's own doctrine is that *zero emission is
opt-in per call site*, so **a fourth site is the expected shape of the remainder, not a contradiction**
— but a grep of the register finds two closed rows over a live family, which is exactly what #398 was
filed to stop happening a second time.

### E4 — Mega Sol's `-activate` banner (4 games, 0 BM)
Rows 111, 127, 136, 150, all Meganium-Mega (derived: the only legal carrier of Mega Sol in this
format). Every one: `|move|…|solarbeam|…`, `|-prepare|…`, then the authority writes
`|-activate|X|ability: Mega Sol` and fires the beam the same turn. We skip the charge correctly and
the damage agrees; the banner is missing.

`sim/pokemon.ts:2195-2203` — `effectiveWeather(sourceEffect, message)` returns `sunnyday` for a Mega
Sol holder and emits the `-activate` **when the real weather is not sun**, called with `message = true`
from Solar Beam's `onTryMove` (`data/moves.ts:17227-17232`).

**HYPOTHESIS: this engine implements Mega Sol as a damage/charge rule and never routes it through an
`effectiveWeather` call that can announce.** Narration only on this evidence.

### E5 — Dire Claw's `-fail` on an already-statused target (3 games, 0 BM)
Rows 134, 157, 162. This is a **Champions-specific** emission and it is worth reading in full —
`data/mods/champions/moves.ts:194-208`:

```
if (target.status) {
  if (target.status === status) this.add('-fail', target, status);
  else                          this.add('-fail', target);
  return;
}
```

Row 134 is the same-status branch (`|-fail|p2a: Pelipper|par` into an already-paralysed body); rows
157 and 162 are the different-status branch (bare `-fail` into an already-poisoned body). All three
fire on a body the same hit has just taken to 0 HP, because the check is on `target.status` and runs
before `trySetStatus`.

**HYPOTHESIS: this engine uses the mainline secondary and never reaches the mod's early return.**
State-identical either way — the status does not change on either engine — so narration.

### E6 — a move that fails on its target (2 games, 1 BM)
Row 48 (Yawn into a body already asleep), row 107 (Leech Seed into an already-seeded body). Authority
writes `|-fail|SOURCE`; we write nothing and also do nothing else, so the effect is right.

**HYPOTHESIS: same root as E2 — the refusal path is silent — but through the `TryHit`/`onTry` gates
(`battle-actions.ts:594-596`, `:645-647`) rather than the no-target gate.** Filed separately because
E2's gate is cited and this one is a guess between two.

### E7 — Quick Claw (2 games, 0 BM) — ALREADY OPEN AS #498
Rows 78, 123. `|-activate|X|item: Quick Claw` is missing **and the move order differs** — in both rows
the authority moves the Quick Claw holder first and we do not. Board-material by structure; it did not
part a board in these two games.

### E8 — a `[silent]` `-end` of a volatile (2 games, 0 BM) — ONE HALF IS ALREADY CLOSED
Row 147 (`|-end|p1a: Kingambit|fallenundefined|[silent]`) and row 148
(`|-end|p1b: Ceruledge|ability: Flash Fire|[silent]`).

The comparator does not DROP `[silent]` lines — `game_differential.js:2051-2055` strips `[silent]`,
`[still]`, `[miss]`, `[spread]` as **fields** and still requires the line to be matched.

**Row 147 is #321, which is CLOSED 2026-08-27 as NOT A DEFECT** — *"the authority's own typo and this
engine refuses it on purpose. Nothing was emitted and nothing should be."* **It is still costing a
divergence.** That is a declared-gap hole, not an engine one: a deliberate refusal has to be declared
to the comparator or it reads as a defect forever. Row 148 belongs to #345 (silent volatile expiry).

### E9 — a multi-hit move stops at the Substitute break (1 game, 0 BM)
Row 6. Dual Wingbeat into a Substitute: the authority writes `-end|Substitute` (hit 1), then
`-damage|p1a|71/150` (hit 2 lands on the body), then `-hitcount|2`. We write the sub break and then
**nothing** — no second hit, no hitcount.

**HYPOTHESIS: the volley aborts when a hit is absorbed instead of continuing to the body.** HP differs,
so this is state-material even though this game's end board matched. See **#511**, which is the same
symptom (`-hitcount` dropped) from a different producer.

### E10 — a two-hit drain (1 game, 1 BM)
Row 122. Parental Bond Drain Punch: the authority interleaves `damage → drain heal → damage → drain
heal → -hitcount`; we emit damage, damage, one heal, hitcount — **and hit 2's damage differs**
(8 here against 16 there, after a resist berry was spent on hit 1).

**HYPOTHESIS: two things at once — the drain is settled once at the end of the volley (the shape
#339 describes for spread), and the berry's weaken is applied to the second hit as well as the first.**
Low confidence on the second half; nothing measured it.

### E11 — Cursed Body from a dying body (1 game, 1 BM)
Row 41. A spread Hyper Voice takes the Cursed Body holder to 0; the authority still writes
`|-start|TARGET|Disable|Hyper Voice|[from] ability: Cursed Body|[of] HOLDER` before the faints, we do
not. **HYPOTHESIS: the reaction is skipped once the holder is at zero HP, and the authority runs it
before `faintMessages`.**

### E12 — Poison Touch after a Lum Berry cure (1 game, 1 BM)
Row 76. Dire Claw paralyses, the target eats a Lum Berry and cures, and the authority THEN applies
Poison Touch's poison (and its end-of-turn chip). We apply neither. **HYPOTHESIS: Poison Touch is
evaluated at the same point as the move's own status and abandoned because the target was already
statused, rather than after the berry has cleared it.** State-material.

### E13 — Close Combat's self-drop behind a Substitute (1 game, 1 BM)
Row 43. The hit breaks a Substitute; the authority still writes `-unboost|def|1` and `-unboost|spd|1`
on the user, we write neither. **HYPOTHESIS: the `self:` boost rider is gated on the hit having reached
the body.** State-material.

### E14 — Skill Swap does not re-trigger the acquired ability (1 game, 1 BM)
Row 87. `|-activate|p1b: Wyrdeer|Skill Swap|flashfire|intimidate|[of] p2a: Ceruledge` — Wyrdeer's
Intimidate goes to Ceruledge, and the authority immediately fires it, writing
`|-unboost|p1b: Wyrdeer|atk|1`. We write nothing. **HYPOTHESIS: the swap moves the ability string and
never raises the recipient's `onStart`.** State-material.

### E15 — Heal Block never expires, AND THE ARTIFACT SAYS IT CANNOT HAPPEN (1 game, 0 BM)
Row 1. The authority writes `|-end|p1a: Chandelure|move: Heal Block` at the foot of turn 6; we do not.
`agreed_lines: 98`, so **the `-start` was agreed** — we have the volatile and never expire it.

**THE INSTRUMENT IS WRONG ON THIS ROW AND IT IS WRONG IN THE EXPENSIVE DIRECTION.** The artifact
annotates this cause `cannot_occur_in_format: true`, with
`mentions: [{ kind: 'moves', id: 'healblock', legal: false, nonstandard: 'Past' }]`. The **move** Heal
Block is Past — but the **volatile** is applied by Psychic Noise, which is legal:

```
D.moves.get('psychicnoise').isNonstandard  -> null
data/moves.ts:8286   secondary: { chance: 100, volatileStatus: 'healblock' }
data/moves.ts:8288   durationCallback -> 2 turns when the source is Psychic Noise
```

So a reachable, legal, board-material mechanic is labelled unreachable, and anyone triaging by that
flag closes it without looking. **This is the annotator matching an ID to the wrong entity kind, and
it will do the same for every volatile whose name collides with a `Past` move.**

### E16 — a resist berry's `-enditem` pair is not emitted (1 game, 1 BM)
Row 46. Roseli Berry against a Fairy-type spread hit: the authority writes `-enditem|…|[eat]` and
`-enditem|…|[weaken]` and then the damage; we write only the damage — **and the damage matches**, so
the weaken WAS applied. **HYPOTHESIS: the item is consumed in state and the announcement suppressed on
the spread path.** Worth checking against tonight's berry work (`docs/_reports/2026-08-30-eat-event.md`,
`…-stolen-berry.md`) before opening anything — it may be residue.

### E17 — a `thawsTarget` move thaws on the wrong side of its own damage (1 game, 0 BM)
Row 2. Authority: `-damage|…|75/125 frz` → `-heal|…|drain` → `-curestatus|frz|[msg]`. Ours:
`-curestatus` → `-damage` → `-heal`. **Every line is present on both sides; only the order differs.**
This is an ORDERING defect that landed in this class because the reducer keys a frozen-status damage
line differently from an unfrozen one. **HYPOTHESIS: the thaw is applied at hit resolution and the
authority applies it after the whole hit effect.**

### E18 — perish faints flushed before `|upkeep|` (1 game, 0 BM) — ALREADY OPEN AS #331
Row 90. Three simultaneous perish faints: the authority writes `|upkeep|` then the three `|faint|`
lines; we write the faints first. Straight #331 (*"we announce a faint at the moment of lethal damage
and the authority batches it until the action completes"*).

### E19 — a terrain-conditional spread move does not expand (1 game, 1 BM)
Row 96. Expanding Force into one foe: the authority also writes `|-immune|p2b: Samurott` — i.e. it hit
BOTH foes — and we hit one. **HYPOTHESIS: the terrain-conditional retarget (`onModifyMove` widening
`move.target`) is not applied.** LOW confidence: the terrain lines are outside the dumped window, so
the premise that a terrain was up is inferred from the authority's behaviour rather than read.

---

## WHAT I CANNOT EXPLAIN — THREE ROWS, FOR WILL

1. **Row 81 — a damage MAGNITUDE divergence wearing this class's name (1 BM).** Authority
   `|-damage|p1a: Charizard|55/153`, ours `|-damage|p1a: Charizard|0 fnt` on the same Rising Voltage.
   We do at least 153 where the authority does 98. Both engines emit the line; the comparator treats
   `H/H` and `0fnt` as different EVENTS rather than as one event with a different field, so a damage
   defect is filed as a missing one. **That half is #349** (*"the class name describes the COMPARATOR,
   not the defect"*). The damage mechanism itself I cannot name from the dumped window — nothing in it
   says whether a terrain or a weather was up.
2. **`|-damage|p2b|H/H <> |faint|p2a` (1 game, 1 BM)** — not in the dump. Read from the cause string
   alone. Shape is consistent with the eager-faint family (#331) but nothing measured it.
3. **`|-end|p2a|futuresight <> |-sideend|p1:|reflect` (1 game, 1 BM)** — not in the dump. Shape is
   consistent with #345 (unannounced volatile expiry). Not measured.

---

## WHAT I AM WITHHOLDING

- **No claim that any group's board-parting is caused by that group.** The differential does not
  attribute; `board_parted` is a per-cause count over whole games.
- **No "narration-only" verdict except where the state is provably identical.** That is true by
  construction for E3 (delta is 0) and E5 (the mod's own early return skips the status attempt), and it
  is an *observation from the dumped window* everywhere else — which is not the same thing.
- **No re-derivation of the class's board-material share.** 13 of 54 is what the artifact says; 83
  board-parted across the whole run is the coordinator's figure and I did not re-derive it.
- **E1's population.** The mechanism is certain; whether 11 games is the right number depends on a PP
  question I did not measure.

---

## WHAT WOULD SETTLE THE OPEN ONES CHEAPLY

- **E15's instrument bug:** ask the annotator for the entity kind, not just the id — the volatile
  `healblock` and the move `healblock` are different things and only one is Past.
- **E8 row 147:** #321 declared a deliberate refusal and nothing told the comparator. It needs a
  `declared_gaps` entry, not an engine change.
- **The two undumped rows:** raise `--dump-games`; the dump holds 164 of 173.
- **E19, E10's second half, E17:** each is one staged probe, not an analysis.
