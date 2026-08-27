# `fallenundefined` — the authority's own typo, already declared, and NOT open work

2026-08-27, ENGINE. HEAD `3b2ce47c` (the brief said `8b1bc48c`; that is an ancestor, two commits back).
Release `6a845424c450` — the id the differential artifact was measured on and the id the tree still
carries, so the whole-game clause is answering rather than withholding.

**No engine byte moved. Census unmoved at 754 live / 754 probed / 0 missing. Whole-game unmoved at
6 of 961. Board-material unmoved at 1 of 961.**

---

## LEAD — WHY THE AUTHORITY EMITS `undefined`, CITED

**Reading (1): the `-end` is emitted with the counter NEVER ASSIGNED.** Not cleared, and nothing is
dropped by our capture.

`data/abilities.ts` (**mainline — `supremeoverlord` does not appear anywhere in
`/data/mods/champions/`**, so Champions inherits it verbatim):

```
4722  supremeoverlord: {
4723    onStart(pokemon) {
4724      if (pokemon.side.totalFainted) {          <- THE GUARD
4725        this.add('-activate', pokemon, 'ability: Supreme Overlord');
4726        const fallen = Math.min(pokemon.side.totalFainted, 5);
4727        this.add('-start', pokemon, `fallen${fallen}`, '[silent]');
4728        this.effectState.fallen = fallen;       <- THE ONLY ASSIGNMENT, INSIDE THE GUARD
4729      }
4730    },
4731    onEnd(pokemon) {
4732      this.add('-end', pokemon, `fallen${this.effectState.fallen}`, '[silent]');   <- NO GUARD
4733    },
```

`onEnd` fires unconditionally from two places, neither of which asks whether `onStart` ever assigned
anything:

- `sim/battle-actions.ts:103` — `this.battle.singleEvent('End', oldActive.getAbility(), oldActive.abilityState, oldActive);`
  at *"will definitely switch out at this point"*, i.e. **before** the replacement's `|switch|` line.
- `sim/battle.ts:2553` — the same call inside `faintMessages()`, after `|faint|`.

**Reading (2) — "the counter lives in `effectState` and is already cleared when `-end` runs" — is
refuted by the code and by measurement.** `abilityState` is created fresh by `initEffectState`
(`sim/pokemon.ts:423`, and again on `setAbility` at `:1930`) and nothing ever deletes `.fallen`. The
only thing `clearVolatile` deletes from it is `started` (`sim/pokemon.ts:1562`), and `clearVolatile`
runs at `sim/battle-actions.ts:117` — **after** the End event at `:103`.

**Reading (3) — "our capture drops an argument" — is refuted by the artifact alone.** The captured
line is `|-end|p2b: Kingambit|fallenundefined|[silent]`: the `[silent]` argument *after* the token is
present, and the token itself is one word. Nothing was truncated.

So `` `fallen${this.effectState.fallen}` `` interpolates a property that was never written, and
JavaScript stringifies `undefined` to `"undefined"`.

### DERIVED, NOT ONLY READ — and the control could have failed

Run in the official simulator on `gen9championsvgc2026regmb`, one staged board, five arms. The
carrier is derived from the format by ability id (never typed); `side.totalFainted` is the arm knob,
written straight into the field line 4724 guards on. `effectState.fallen` is read off the live body
with `hasOwnProperty` one tick before it leaves, which is the reading that separates NEVER-ASSIGNED
from ASSIGNED-THEN-CLEARED — the printed string cannot.

```
FIXTURES (derived from gen9championsvgc2026regmb on this run)
  supremeoverlord carrier: Kingambit    control body: Venusaur

ARM 0 fallen, supremeoverlord
  entry []
  exit  ["|-end|p1a: Kingambit|fallenundefined|[silent]"]
  effectState.fallen before it leaves: present=false value=undefined

ARM 1 fallen, supremeoverlord
  entry ["|-activate|p1a: Kingambit|ability: Supreme Overlord","|-start|p1a: Kingambit|fallen1|[silent]"]
  exit  ["|-end|p1a: Kingambit|fallen1|[silent]"]
  effectState.fallen before it leaves: present=true value=1

ARM 2 fallen, supremeoverlord   -> fallen2 on entry AND exit, present=true value=2
ARM 3 fallen, supremeoverlord   -> fallen3 on entry AND exit, present=true value=3

ARM 3 fallen, CONTROL ability defiant
  entry []
  exit  []
  effectState.fallen before it leaves: present=false value=undefined

  READING (1) counter NEVER SET       : true
  READING (2) counter CLEARED first   : false
  control emitted nothing             : true
```

**The rig is live and reading (2) had a way to win.** If the counter were cleared before `onEnd`, the
1/2/3 arms would print `fallenundefined` too. They print `fallen1` / `fallen2` / `fallen3`. And the
Defiant arm at 3 fallen — the same body, the same board, one ability changed — emits nothing at all
on entry or exit, so the `-end` line is attributable to the ability and not to the switch.

The script is in this session's scratchpad and is not landed (the census already carries three probes
over the same ground). It is reproducible from this report: stage a doubles battle in
`engine/champions_sim.js`'s `FORMAT`, put the derived carrier at party slot 3, set
`battle.p1.totalFainted` directly, `switch 3` in and then switch back out — and note that Showdown
**swaps party positions on a switch**, so the return choice is `switch 3` again, not `switch 1`. A
`switch 1` there is "switch to yourself", is rejected **silently**, and produces an empty exit log
that reads exactly like "the authority emits nothing". That cost one iteration here.

---

## THE VERDICT — THE TARGET IS A DECLARED ROW AND IS ALREADY SUBTRACTED FROM BOTH HEADLINES

The brief read `diverged: 11` out of `data/game-differential.json` and concluded the five
`fallenundefined` rows were the largest open cause. **They are the five DECLARED rows.** `node
engine/status.js`, reading that same artifact:

```
FAIL  whole-game differential ... 6 of 961 = 0.6% DIVERGE — the two engines disagree about 6 games
      (11 raw, less 5 declared and 0 cleared on decision impact).
      DECLARED / THE AUTHORITY IS WRONG ... [5 game(s), 1 row(s)] 5 Supreme Overlord `fallenundefined`

FAIL  mechanics ... 5 of 12 ... DECLARED — 1 diverging mechanic(s) subtracted ...
      ability:supremeoverlord  Supreme Overlord `fallenundefined`
```

`engine/quarantine.js:1416-1425` carries the row (`kind: 'AUTHORITY-WRONG'`, matcher
`/fallenundefined/`), and since ROADMAP #464 it has ONE reader shared by both clauses, so the two
cannot disagree about it. The brief's own arithmetic already contains the answer: `6 = 11 − 5`. The
"two declared Tailwind rows" it names are **not** declared — they are two live `ordering` causes, and
they are on the brief's own NOT-YOURS list.

**Landing the byte-match would make things worse, three ways:**

1. **It cannot lower the whole-game headline.** Those five games are not counted. Best case the
   number stays at 6; worst case it rises, because five games that currently stop at turn 2 would
   play on and may part later.
2. **It would put the census DOWN**, which is the one thing this division may never do.
   `tests/test-mechanics.js:15773` asserts `ends(zero).length === 0` — *"Supreme Overlord closes its
   fallen marker on the way OUT, **and refuses the authority `fallenundefined`**"*. Emitting the typo
   makes that clause false and the probe reports `works: false`.
3. **It contradicts the standing declaration**, whose whole content is *"reproducing a typo is not
   correctness"* — and the bar for that list is narrow and was checked: the ABILITY is right
   (`onBasePower` is guarded, the powMod table matches, and the three legitimate lines at counts
   1/2/3 are emitted and probed). Nothing here is a defect wearing a label.

**Nothing was changed. No probe was written, because none can fail: a probe demanding the typo would
be a probe demanding a regression.**

---

## THE SECONDARY ITEMS ARE A DIFFERENT ROOT — LEFT, AS INSTRUCTED

The brief allowed Zero to Hero's `-activate`, Supreme Overlord's `-activate`/`-start` and the Magic
Room item park **only if they share the fallen-counter root**. They do not.

- The fallen counter is an **authority typo** in one handler's template.
- Those three are the residue of **ROADMAP #481** (closed this morning): the authority announces every
  `|switch|` and *then* runs ONE batched `fieldEvent('SwitchIn', …)`, and three emissions in this
  engine still fire at the placement, so on a **double** replacement they sit between the two
  `|switch|` lines. That is an entry-phase ordering question, not a template question.

`docs/_reports/2026-08-27-replacement-entry.md` already records them, with the note that no card in
the pinned pool lands on any of them and no probe fails on them. They stay on the hand list. Batches
of one.

---

## ROADMAP #321 IS CLOSED — IT WAS THE THING THAT MISDIRECTED THIS BRIEF

#321 was filed 2026-08-21 as *"KINGAMBIT ANNOUNCES THE END OF ITS FALLEN COUNTER AND THIS ENGINE DOES
NOT"*, and its `VERIFIED BY` demanded that the `-end/fallen` group be **absent** from the divergence
report — i.e. it demanded the typo be emitted. Three things landed after it and settled it in the
opposite direction:

- Will's 2026-08-22 ruling — board-material now, narration as its own separate gate.
- The `AUTHORITY-WRONG` declaration in `engine/quarantine.js`, subtracting the five games in both
  clauses.
- Three census probes on 2026-08-26 that emit `-activate`, `-start fallenN` and `-end fallenN` at
  counts 1/2/3, on switch-out **and** on faint, and assert silence at 0.

The general question #321 wanted answered — *"does this engine mirror announcements that carry no
board?"* — has an answer, and it is Will's: yes, under a **separate narration gate**, not by
reproducing the authority's bugs one game at a time.

It was still open and still printed by `node engine/open_work.js`, without a `DEFECT` marker, with a
`VERIFIED BY` line that is now a demand for a regression. **A stale row is not inert.** This is the
same shape as the fourteen stale handoffs: a sentence written down once, kept past the thing it
described, and then acted on.

---

## WHAT I CHECKED SO THE VERDICT IS NOT ASSERTED

| claim | how |
|---|---|
| the artifact really holds five `fallenundefined` rows | `data/game-differential.json` `first_divergences` + `classes[cls='event missing from medicham2'].games = 5` |
| they are already subtracted | `node engine/status.js` — *"11 raw, less 5 declared"* and *"DECLARED — 1 diverging mechanic(s)"* |
| the artifact's release still matches the tree | artifact `engine_release: 6a845424c450`; `data/engine-release.json` `current: 6a845424c450` (dirty in the worktree, but only the cut COUNT moved — an identical tree re-cut appends) |
| Champions does not override the ability | `grep supremeoverlord data/mods/champions/abilities.ts` → no match |
| the counter is never assigned, not cleared | the five-arm derivation above, with a control that emits nothing |
| the census probe would break | `tests/test-mechanics.js:15773` — the clause is `ends(zero).length === 0` |

---

## OWED, NOT RUN

Nothing is owed by this pass, because no SOURCES file moved and no artifact was invalidated. No
release was cut. `node tests/test-mechanics.js` was **not** re-run and did not need to be — the engine
is byte-identical, so the census cannot have moved; the figures above are read from the artifacts
`status.js` reads.

If a later session wants the register closure corroborated rather than taken from this file:

```bash
# 1. the two clauses, read from the artifact rather than from prose
node engine/status.js

# 2. the census, regenerated — must print 754 live / 754 probed / 0 missing
node tests/test-mechanics.js

# 3. the authority derivation, re-run from scratch (see the reproduction note above)
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node <the five-arm script>

# 4. the row that used to demand the typo
node engine/open_work.js | grep '#321'          # must no longer appear as open
```
