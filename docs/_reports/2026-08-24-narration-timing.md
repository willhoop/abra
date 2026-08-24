# Narration timing, part two: four rules landed, three games cleared, board-material flat at 24

**ENGINE, 2026-08-24, overnight.** Will: *"i want us to announce failures and generally match the
timing of narration of showdown please fix."*

Historical record, per `docs/_reports/` convention. Not current state; superseded by the register rows
it feeds. Every figure is read out of `data/game-differential.json`, `data/mechanics-census.json`, the
roster artifacts, or a run whose command is printed beside it. Every expectation was OBSERVED in the
official simulator, never recalled.

---

## 0. VERDICT

**Four rules landed. Narration 22 → 19 games. Board-material 24 → 24 games, 23 → 23 causes — FLAT,
which was the stop condition. Census 674 → 677 live, 0 missing.**

| # | rule | narration games cleared | did state move? |
|---|---|---|---|
| 1 | **A spread drain heals at each target's OWN damage line** | **2** | no — the number is identical, only the position and the `[of]` changed |
| 2 | **Throat Chop's silence is two turns, not three, and its end is a line** | **1** | **YES — the clock. This is the fix, the line is the by-product** |
| 3 | **Perish Song writes no `-damage`, and its deaths are queued** | **0 (the game diverges later on the same line)** | no |
| 4 | **A re-banked Charge re-announces** — a RED FOUND ON ARRIVAL, not new work | 0 (a lab row) | no |

**One red was found on arrival and fixed rather than filed.** `data/mechanics-census.json` was
committed at HEAD reading **674 live / 674 probed / 0 missing**, and HEAD's own tree measures
**673 live / 1 missing**. The missing row is `ability/buffsHolderOnHit` — *"a second hit RE-ANNOUNCES
the Charge it re-banks"* — one of the six landed in
`docs/_reports/2026-08-24-mechanics-by-reach.md`. The probe was committed; **the one-line engine edit
it describes was not.** Measured before anything in this pass was written, by stashing this pass's
test edits and re-running. Re-applied here (§4).

---

## 1. THE WHOLE-GAME NUMBERS — A RE-BASELINE, NOT A DELTA

Arm **`middle`** (real dice, the default), release **`2535a9c59886`**, `--games 1200` resolving to
**961 played games**, turn cap 12, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json` — the same three pins the standing figure
used, so the steering is identical and the two are comparable.

| quantity, arm `middle` | before (`264f6d13d1e4`) | after (`2535a9c59886`) |
|---|---|---|
| protocol parted (raw `diverged`) | 46 | **43** |
| **undeclared = diverged − declared** (the published headline) | 33 of 961 = 3.4% | **30 of 961 = 3.1%** |
| **narration-only games** | 22 | **19** |
| narration-only causes | 20 | **18** |
| **board-material games** | **24** | **24** |
| **board-material causes** | **23** | **23** |
| unknown games | 0 | **0** |

**THE GAME-BY-GAME DIFF, WHICH IS THE ATTRIBUTION.** Keyed on `config|seed`, so this is the same 961
pairs and not a resampling:

```
diverged BEFORE and not now (3 games, all cleared):
    event missing from medicham2 :: |-heal|p2a|[from]drain <> |-damage|p1b       x2   -> rule 1
    event missing from medicham2 :: |-end|p2a|throatchop   <> |upkeep            x1   -> rule 2

diverge NOW and did not before:   NONE.  Zero new diverging games.

same game, cause CHANGED (2):
    was  extra event emitted by medicham2 :: |upkeep <> |-damage|p1b|0fnt   idx 71
    now  ordering                        :: |upkeep <> |faint|p1b          idx 71   -> rule 3, §5
    was  ordering :: |-heal|p1b|[from]drain <> |-damage|p2b                idx  90
    now  extra event emitted by medicham2 :: |faint|p2b <> |-status|p2a|brn idx 103  -> §6
```

**BOARD-MATERIAL DID NOT RISE.** One board-material cause left and one appeared, and they are the SAME
GAME diverging **thirteen lines later** — the "one cause removed, one revealed behind it" shape
CLAUDE.md names about Cursed Body. Not a regression, and §6 says what the revealed one is.

---

## 2. RULE 1 — A SPREAD DRAIN HEALS AT EACH TARGET'S OWN DAMAGE LINE. 2 games.

`sim/battle.ts:2159-2171`. The heal is INSIDE `spreadDamage`'s per-target loop, four statements below
the `-damage` line the same iteration wrote:

```js
this.add('-damage', target, target.getHealth);                       // :2150
...
if (targetDamage && effect.effectType === 'Move') {
  if (this.gen > 4 && effect.drain && source) {
    const amount = Math.round(targetDamage * effect.drain[0] / effect.drain[1]);
    this.heal(amount, source, target, 'drain');                      // :2168
  }
}
```

**OBSERVED**, a chipped Sinistcha's Matcha Gotcha into Garchomp and a Swampert it kills:

```
|-damage|p2a: Garchomp|129/183
|-heal|p1a: Sinistcha|75/146|[from] drain|[of] p2a: Garchomp
|-damage|p2b: Swampert|0 fnt
|-heal|p1a: Sinistcha|146/146|[from] drain|[of] p2b: Swampert
|faint|p2b: Swampert
```

This engine wrote `-damage t1 / -damage t2 / -heal` — one lumped line, with no `[of]`.

**THE ARITHMETIC HALF WAS ALREADY RIGHT AND THIS IS THE OTHER HALF ITS OWN COMMENT NAMED.** ROADMAP
#339 landed one rounding per body on 2026-08-23 and wrote *"the authority also emits one `|-heal|…|
[from] drain|[of] TARGET` PER BODY and this engine still writes a single lumped line"*. The payment
moved from `_stepSelfPay` (once per move, after every target's damage) into `_stepApply` (per row,
directly under that row's damage line), which is where the authority's own loop is.

**STATE: NONE, AND IT IS CHECKABLE RATHER THAN CLAIMED.** Every row is paid `Math.min(dmg, tg.curHP)`
— byte for byte the number 2026-08-23 pushed into `_dealtEach` and summed — through the identical four
steps (`round`, clamp-to-1, `trunc`, the Big Root fixed-point modifier). Clamping per row against the
running `curHP` reaches the same final HP as one clamp against `_hpPreReact`, because nothing else
moves the user's HP between the rows. The two existing census probes that guard the NUMBER
(`move/drain` per-body rounding, `item/healMultBySource` Big Root) are green either side and were not
edited.

**WIRE 87 IS SATISFIED BY POSITION NOW, NOT BY A CAPTURED NUMBER.** The clamp was measured against
`_hpPreReact` because the contact toll used to be paid above the heal. `_stepDamagingHit` is a LATER
step than `_stepApply`, so at the payment point the toll has not been taken and `m.curHP` *is* the
pre-reaction HP.

**THE DOLL FEEDS A DRAIN MOVE AND THAT IS THE AUTHORITY'S RULE.**
`substitute.condition.onTryPrimaryHit` ends `if (move.drain) this.heal(Math.ceil(...), source, target,
'drain')` (`data/moves.ts:18359`), below the `-activate` / `-end` arm, so the payment is made there
too. **Two things about that line are deliberately NOT copied and are said rather than left to be
found:** it is `ceil` where the ordinary road is `round`, and its `damage` is clamped to the DOLL's
remaining HP where this engine passes the unclamped hit. Both are the open STATE item
`docs/_reports/2026-08-23-narration-timing.md` §10.3 already files. This pass moved a line and changed
no number.

**Probe:** `tests/test-mechanics.js`, `move`/`drain`, *"a SPREAD drain heals at each target's own
damage line, naming that target"*. **RED demonstrated with the existing knob** —
`MEDI_DRAIN_LUMP_ROUND=1` restores the whole of the old behaviour and the probe reads
`[dmg:garchomp dmg:swampert heal:undefined]` against the authority's
`[dmg:garchomp heal:garchomp dmg:swampert heal:swampert]`. **Two controls, and they fail different
wrong fixes:** a single-target Draining Kiss must still read one damage and one heal (an engine
healing per target including targets it never reached passes the spread arm), and a spread move with
NO drain — Bulldoze — must emit no heal at all (which is what stops "emit a heal after every damage
line" from passing).

---

## 3. RULE 2 — THROAT CHOP IS SILENT FOR TWO TURNS, NOT THREE. 1 game, and the clock is the fix.

`throatchop.condition` carries `duration: 2` and
`onEnd(target) { this.add('-end', target, 'Throat Chop', '[silent]'); }` (`data/moves.ts`).
`residualEvent` spends a duration on the turn the volatile was applied as well:

```
residual t1: 2 -> 1, survives      t2: the sound move is disabled
residual t2: 1 -> 0, `onEnd`       t3: FREE
```

**OBSERVED**, Weavile (145 spe) Throat Chops a Primarina (80 spe) that clicks Hyper Voice every turn,
read out of `battle.log` and `p.getMoves()`:

```
t1  |-start|p2a: Primarina|Throat Chop|[silent]   then  |cant|p2a: Primarina|move: Throat Chop
t2  volatile duration 1, hypervoice disabled=true, and at the residual
    |-end|p2a: Primarina|Throat Chop|[silent]
t3  |move|p2a: Primarina|Hyper Voice   — free, and the volatile is gone
```

This engine wrote `_noSound = turns + 1`, which is Heal Block's and Encore's convention and is the
wrong one here: it blocked turn 3 as well. **THREE turns of silence in a game that gives two, on 5,071
corpus uses.** That is STATE, and it is exactly why the 2026-08-23 pass refused to add the missing
line: emitting `-end` over a clock that is one turn long would have printed it in the wrong place.

**TWO SMALLER CORRECTIONS RIDE WITH IT AND ARE NAMED RATHER THAN SLIPPED IN:**
- the `-end` line itself, `|-end|BODY|Throat Chop|[silent]`, which this engine never wrote;
- the `-start` line's field 3. The authority writes `Throat Chop`; this engine wrote
  `move: Throat Chop`. Read off the authority's own logged line above, not from the source.

**THE POSITION OF THE `-end` IS THE DECLARED GAP AND IS UNCHANGED.**
`residualExpiryDeferred()` already names `throatchop@22` — this clock ticks in the foot-of-turn block
rather than at residual order 22 — and that list is printed from the artifact, not typed. What was
missing was the line, not its neighbourhood.

**STATE: YES, AND IT IS THE POINT.** Nothing on this path touches `_mvRes`; the moved state is the
volatile's own lifetime, and it moved TOWARD the authority. Asserted directly in the probe as the
OUTCOME (does the sound move land) rather than through the protocol.

**Probe:** `tests/test-mechanics.js`, `move`/`blocksSoundMoves`, *"the silence lasts the turn it lands
and ONE more, and its end is a line"*. Shown RED by reverting both engine lines and re-running:
`[silenced silenced silenced]` with the end line on turn(s) `[]`. Green:
`[silenced silenced HIT]` with the end line on turn `[2]` alone. **The chopper is the FASTER body and
that is not cosmetic** — chopping with a slower body puts the sound move ahead of the chop on turn 1,
so entry 1 reads HIT under every implementation and the arm asks nothing, which is what the first
draft of this probe did.

---

## 4. RULE 4 — THE CHARGE RE-BANK. A RED FOUND ON ARRIVAL.

`data/moves.ts`, the `charge` condition, declares `onStart` and `onRestart` as the **same six lines**,
so the authority announces on the re-bank too and names the move that just landed (field 4 is
`this.activeMove.name`). The engine's own comment at the bank site said *"`onRestart` re-announces and
does NOT stack"* and the line under it read `if (TR && !_had)` — the comment was right and the code
disagreed with it.

`docs/_reports/2026-08-24-mechanics-by-reach.md` reports this landed and the committed census reads
674/674 live. **The probe is in the committed tree; the engine edit is not.** Nothing else in that
batch is affected — the other five probes are green on the same run. New counter
`MEDSEEN.chargeReBanked`, the subset of `chargeBanked` that landed on a body already holding the
charge, so a silent re-bank and a re-bank that never happened stop reading identically.

---

## 5. RULE 3 — PERISH SONG. THE `-damage` IS GONE; THE FAINT'S POSITION IS A DECLARED REMAINDER.

`perishsong.condition.onEnd` is two statements —
`this.add('-start', target, 'perish0'); target.faint();` — and `Pokemon#faint()` writes no log line.
**So the `|-damage|…|0 fnt` this engine emitted is a line the authority never writes at all.** It
carried no state: `TR.dmg` is a single trace push.

**AND THE DEATHS DO NOT DRAIN BETWEEN BODIES.** `fieldEvent`'s duration-expiry branch
(`sim/battle.ts:514-524`) calls `handler.end` and then `continue`s — **skipping the
`this.faintMessages()` at `:565`.** OBSERVED, four bodies on a perish clock, turn 4: four
`-start|…|perish0` lines and then four `|faint|` lines, with no `-damage` anywhere. This engine wrote
`perish0 / -damage / faint` per body, interleaved.

Both halves are fixed. The faint now goes through `queueFaint` and drains at the foot of the residual
clock walk, which is `MEDSEEN.faintDrainResidualClocks`.

**AND IT IS STILL ONE LINE EARLY IN ONE GAME, WHICH IS WHY THAT GAME STILL COUNTS.** The pool's perish
game went from `|upkeep <> |-damage|p1b|0fnt` to `ordering :: |upkeep <> |faint|p1b` at the same index
71 — the spurious `-damage` is gone and the faint is now the whole of the divergence.

**THE REASON IS DERIVED AND THE NEXT PASS SHOULD READ IT RATHER THAN GUESS.** The authority's drain
point depends on **what other residual handler follows the perish group**, and I instrumented the
official simulator to find out rather than reasoning:

```
[handlers: perishsong/1 perishsong/1 perishsong/1 perishsong/1  stall/2/cb0  protect/1/cb0  stall/2/cb0  protect/1/cb0]
   the four perishsong handlers EXPIRE -> `continue`, no drain
   stall/2 does NOT expire -> falls through to `this.faintMessages()` at :565 -> DRAIN, before |upkeep|
```

So on the staged board — where every body had Protected, leaving `stall` and `protect` volatiles with
surviving durations — the faints land **before** `|upkeep`. In the pool game nothing followed the
perish expiry, the walk ended, and `sim/battle.ts:2814` writes `|upkeep|` **before** the tail-of-
`runAction` drain at `:2832`. **Both are the authority. The position is a function of the handler
list, and this engine has no handler list** — that is `residualExpiryDeferred()`, the declared gap, and
the residual sort is one of Will's four judgement cards. Not smuggled in behind a narration fix.

**Probe:** `tests/test-mechanics.js`, `move`/`perishClock`, *"the four perish deaths are announced
BELOW all four perish0 lines, with no -damage"*. Shown RED with the existing knob
`MEDI_FAINT_INLINE=1`, which reads `[perish0 faint perish0 faint perish0 faint perish0 faint]`; the
pre-fix engine additionally read a `DAMAGE` entry between each pair. **The control is a BURN death,
whose handler is registered per body** so `fieldEvent` reaches `:565` between bodies and the faint
lands immediately after that body's own chip — an engine that deferred every residual faint to the
foot of the turn passes the perish arm and breaks this one.

---

## 6. THE ONE REVEALED BOARD-MATERIAL CAUSE, AND WHAT IT IS

```
|move|p1b: Sinistcha|Matcha Gotcha|p2a: Excadrill|[spread] p2a,p2b
|-damage|p2a: Excadrill|21/185
|-heal|p1b: Sinistcha|146/146|[from] drain|[of] p2a: Excadrill
|-damage|p2b: Falinks|0 fnt
   showdown  |faint|p2b: Falinks
   medicham  |-status|p2a: Excadrill|brn
```

Same game as the old `ordering :: |-heal|p1b|[from]drain <> |-damage|p2b` row, now diverging at index
103 instead of 90. The authority writes the KO'd Falinks's `|faint|` before Matcha Gotcha's 20% burn
secondary lands; this engine applies the burn first. **Not investigated further** — it is a faint
boundary inside the hit loop, it is one game, and it is named here so the next pass stages it
deliberately rather than rediscovering it.

---

## 7. THE MUST-NOT-MOVE LIST, CHECKED

| | required | measured |
|---|---|---|
| damage differential `--n 6000 --seed 20260804` | 0 of 6000 | **0 of 6000, midpoint AND all 16 corners** |
| census | 674 probed / 674 live / 0 missing | **677 / 677 / 0** — three probes added, none missing |
| census ratchet | `unarmed` / `directCall` may not rise | **0 unarmed, 1 direct-call — unchanged, no `--accept`** |
| hollow probes | 0 | **0** |
| probes that threw | 0 | **0** |
| **board-material games** | **must not rise** | **24 → 24, causes 23 → 23** |

**THE DELIBERATE ROSTER WAS RE-RUN, ALL THREE STAGES, ON THE FINAL RELEASE `2535a9c59886`.** Moving
the engine withholds those artifacts, which is the release rule working. Every verdict vector is
byte-identical to the previous release's:

```
items      DIFFER 0  DID-NOT-FIRE 0  MATCH 139  COULD-NOT-STAGE 8    DEFERRED 1
abilities  DIFFER 0  DID-NOT-FIRE 0  MATCH 130  COULD-NOT-STAGE 141  CONTROL-NOT-QUIET 45
moves      DIFFER 0  DID-NOT-FIRE 0  MATCH 475  COULD-NOT-STAGE 22   DEFERRED 3
```

`engine/all_mechanics_fire.js --kind all` likewise: **moves 18 / abilities 4 / items 1 diverged**, and
the diverging SET is identical — zero cleared, zero newly diverging. **A trap avoided:** the first
roster and mechanics-fire runs were made without `--write`, so they printed correct numbers and left
the artifacts stamped to the OLD release. Re-run with `--write`, and `status.js` reads them.

**GATE SHAPE UNCHANGED: 5 of 8 clauses pass, the same three fail** — the whole-game differential (now
30 of 961 = 3.1%), the staged-mechanics comparison (16 of 23, unmoved), and the open-defect register
clause.

**ONE TRAP WORTH RECORDING:** running the census under `MEDI_DRAIN_LUMP_ROUND=1` to demonstrate the
red WRITES `data/mechanics-census.json`, and `status.js` then read 674/677 with 3 missing. Re-run
clean. A knob run is not a measurement and its artifact must not be left standing.

---

## 8. OWED, NOT RUN

```
node engine/replay_one.js --census <the pin> …           NOT RUN — still the way to attribute the
                                                          weather-upkeep 5; nothing here touched them
node engine/explain_divergence.js --dump-speeds           NOT RUN — the tie-settling command; no tie
                                                          row was touched, per the brief
node engine/quarantine.js                                 NOT RUN — its roster and differential clauses
                                                          were run directly, at the pins
node tests/run-all.js                                     NOT RUN
tests/interaction_matrix.js                               NOT RUN — last run 2026-08-11
tests/mutation_harness.js                                 NOT RUN — writes; needs --gate-only wiring
node engine/argmax_paired.js (decision impact)            NOT RUN — data/decision-impact.json still
                                                          absent, so nothing is excused on it
node engine/million_run.js                                NOT RUN
```

- **No fit, no self-play, no `mew.js`.** `board.js`, `magnemite.js` and `engine-data.js` untouched.
- **`docs/ROADMAP.md` was NOT edited.** Register row text is proposed in `docs/ENGINE.md`.
- **Two untracked files left alone as instructed:** `data/_pair-pilot.json` and
  `data/medicham-represented-clicks.json`.
- **The four judgement cards in `docs/_reports/2026-08-24-ordering-cards.md` were not touched**, nor
  the mega-phase and residual sorts they cover, nor Moody, nor the speed-tie rows, nor Tailwind.

**PRE-EXISTING REDS OBSERVED AND NOT CAUSED HERE.** The whole-game run prints *"THE STATE COMPARATOR
FAILED ITS OWN PROOF"* — six of its plants are `NOT APPLIED` because they want a BENCHED body the
fixture does not have — so the instrument's own STATE numbers carry a self-declared caveat. It is true
of the artifact committed at HEAD as well. It belongs to MEASURE. The same run reports
`MEDFAILS.traceBodyOffField = 10` (a `??` identifier, first: farigiraf), which matches the
pre-existing board-material row `|upkeep <> |move|??:farigiraf|roar`.

---

## 9. DEFECTS FOUND AND NOT FIXED — for the register

1. **A KO'd spread target's `|faint|` is announced above the move's own secondary.** The authority
   writes `|faint|p2b: Falinks` where this engine writes Matcha Gotcha's 20% burn on the surviving
   target. Board-material, 1 game, §6.
2. **A perish death's `|faint|` is one line early when nothing follows the perish group in the
   residual.** The authority's drain point is decided by the residual HANDLER LIST — a surviving
   duration-bearing handler drains before `|upkeep|`, an empty tail drains after it — and this engine
   has no handler list. Narration, 1 game, §5. Same root as `residualExpiryDeferred()`.
3. **A broken Substitute's drain is `round` where the authority is `ceil`, off an unclamped hit.**
   `data/moves.ts:18345-18359`. State, unchanged by this pass, §2. Restated from the 2026-08-23 report
   because the code that reads it moved.
4. **The census committed at HEAD did not match HEAD's engine.** 674/674 published, 673/1 measured.
   Not a game defect — a publishing one — and it is the reason §4 exists.
