# 2026-08-26 — the Struggle lock: the handed diagnosis named the wrong function

ENGINE. Release `93a51075e83f`. Commit `49eb67b8`. CHANGELOG 5.143.0. ROADMAP #459 closed.

## Verdict

**ROADMAP #459 is fixed. The defect was NOT `mustStruggle`.** Census **742/745 -> 743 live / 746
probed / 3 missing**. The pinned pool did not move, and that was measured rather than asserted.

## What was actually wrong

`mustStruggle` reads every source of a closed slot and always did — `lockMenuMove` handles the
Choice item AND Encore. On the **broken** engine, Will's fixture ran `struggleFromEmptyMenu` 2,
`struggleFromDisabled` 2 and `encoreOverrodeAtExecution` 1: the chooser reached the authority's
verdict and built a real Struggle, and two lock-rewrite sites took it away again.

Both sites asked `a.kind === 'struggle'`. `struggleAction` builds
`playerAction(me,'struggle',target,field)`, whose `kind` is `'attack'` and whose id lives on
`move.id` — so the test matched nothing the mechanic ever produces.

- **WIRE 24**, in `mk()` — the Choice/Encore lock binding a chosen or handed-in action. No Struggle
  clause at all.
- **WIRE 143**, at execution — Encore's `onOverrideAction`. `it.a.kind !== 'struggle'`.

The authority excludes Struggle by **move id**, one line into `runMove`
(`sim/battle-actions.ts:226`):

```js
if (baseMove.id !== 'struggle' && !zMove && !maxMove && !externalMove) {
  const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
```

## The fix

One predicate in `engine/medicham2-browser.js`:

```js
function isStruggleAction(a){
  if(!a) return false;
  if(a.kind==='struggle') return true;                              // the {kind:'struggle'} sentinel
  if(STRUGGLE_KIND_ONLY){ MEDFAILS.struggleKindOnlyRestored=1; return false; }
  return actionMoveId(a)==='struggle';                              // the real attack action
}
```

Both sites call it through `_declineStruggle(a, where)`, which counts
`MEDSEEN.lockRewriteDeclinedStruggleCollect` / `…Exec`, so a decline is read rather than inferred.
The predicate's header names what still walks past it: a NEW override site that never calls it;
`a.kind !== 'switch'` / `!== 'pass'`, which stay kind tests and are correct; zMove/maxMove/
externalMove, which this format does not have; and the `|-activate|move: Struggle` line, which is a
protocol question with a different reader and is still not emitted here.

Knob: `MEDI_STRUGGLE_KIND_ONLY=1`.

## The Choice Scarf instance — general, not widened

Will, mid-pass: *"disable on a choice scarf mon also leads to struggle i believe"*. Correct, and it
is the everyday case: `choicescarf.isNonstandard` is null with `isChoice: true` while `choiceband`
and `choicespecs` are both `Past`, so it is the only legal Choice item in Reg M-B.

**It was already LIVE and needed no change.** The Choice lock has no execution-time override — WIRE
143 is Encore's alone — and the collect-site rewrite that did reach it was undone one clause later
by the Disable-binding re-ask. The Encore road had no such second chance. So the answer to *"general
or widened"* is: general, and the Choice arm is the evidence.

Its two missing arms are now a probe (`item / choiceLock`), both about the lock being READ LIVE:

| board | the authority's menu (`getMoveRequestData().moves`) | plays |
|---|---|---|
| locked into Body Slam, **Body Slam** Disabled | `["struggle"]` | `-activate\|move: Struggle`, Struggle |
| locked into Body Slam, **Crunch** Disabled | bodyslam, amnesia(X), crunch(X), icebeam(X) | Body Slam |
| locked + Disabled, then **Tricked out of the Scarf** | bodyslam(X), amnesia, crunch, icebeam | Amnesia |

## Two instrument errors, both caught before they were trusted

1. **The over-fire arm first clicked Taunt** — one of the fixture's declared four. Taunt taunts the
   FOE, so turn 2 read `|cant|p2a: garchomp|move: taunt|disable`, the seal never landed, `_sealed`
   stayed undefined, and the arm was green while testing a lock with no Disable near it. It clicks
   Swords Dance now and ASSERTS `sealed === 'swordsdance'` with `disableLeft` 2 on the decision turn.
2. **In the AUTHORITY, poking `pokemon.item = ''` mid-turn does not unlock the body** — the menu is
   rebuilt at `update()`, so the cached Struggle menu stands and it reads as a contradiction of
   `choicelock.onDisableMove`. Re-staged with Trick, which is the real route: menu comes back
   `bodyslam(X), amnesia, crunch, icebeam` and it plays Amnesia.

## Deliberate breaks

Engine restored byte-identical each time (`md5 1b90baa12b10d7dca1bdb3c14fadf1f1`);
`engine_release.js verify 93a51075e83f` reports intact.

| break | result |
|---|---|
| `MEDI_STRUGGLE_KIND_ONLY=1` | 741 live, 4 missing — the Encore row only |
| `mustStruggle` returns true on "a lock and any disabled slot" (the list-of-reasons shape) | 742 live, 4 missing — **both** Choice halves red |
| `lockMenuMove`'s item re-read deleted (the lock LATCHES) | 742 live, 4 missing — the REMOVAL half only |

The last two fail differently on purpose: a single red that could come from either would not say
which.

## Numbers, predicted before the run

| quantity | before | after | predicted |
|---|---|---|---|
| census live | 742 | **743** | 743 |
| census probed | 745 | **746** | 746 |
| census missing | 3 | **3** | 3 |
| hollow / threw | 0 / 0 | 0 / 0 | unmoved |
| unarmed / directCall ratchets | 0 / 1 | 0 / 1 | unmoved |
| pinned pool (published config, both releases) | 961 games / 15 diverged | **961 / 15** | unmoved |
| whole-game clause | 10 of 961 | **10 of 961** | unmoved |
| `test-engine-diff.js --n 6000` | 0 of 6000 | **0 of 6000**, sixteen corners | unmoved |
| roster items / abilities / moves | 0 differ, 0 did-not-fire | **0 / 0** | unmoved |
| `all_mechanics_fire --kind all` STATE | 5 / 2 / 1 | **5 / 2 / 1** | unmoved |

The pool was run twice with identical pins —
`--games 1200 --turns 12 --end-state --census data/verification/census-pin-9446a684709d.json
--team-store data/team-pool-frozen` — on `9c71bc9b5815` and on `93a51075e83f`. `first_divergences`,
`classes`, `end_state`, `mid_void` and `coverage` are byte-identical.

Two instrument reader counters differ against the previous published artifact
(`duplicate_species_in_party` 20 -> 40, `display_name_lookups_that_missed` 2 -> 4). **Cleared with a
control**: the same command on the OLD release reproduces both, so it is the invocation, not the
engine. Neither is a board figure.

## Reported, not touched

- **`engine/all_mechanics_fire.js` reports success without `--write`.** The first run exited 0,
  printed 217 lines of results and left the artifact stamped at the OLD release. Ninth way a command
  reports success having done nothing.
- **`tests/roster.js` is the same shape** — three stages ran clean on the new release and left the
  artifacts at the old one until `--write` was added, which is what turned three status.js clauses
  from WITHHELD back to PASS.
- **Release `93a51075e83f`'s top-level `why` names a different batch's work.** Two cuts of this
  identical tree were appended at 17:36:04 and 17:36:10 before this batch's at 17:36:43.
  `engine_release.js list` was ruled out by test (running it appends nothing). By design `cut`/`why`
  mean the FIRST freeze and are never rewritten; `cuts.jsonl` carries all three, and the id and the
  digests are correct. `engine/engine_release.js` is not ENGINE's file.
- **The ROADMAP #119/#295 priors leak is visible in two probes now** — `rockslide` off a four-slot
  Snorlax and `flareblitz` off a four-slot Incineroar. Both affected arms assert not-null,
  not-Struggle and **not the sealed move**, and PRINT the leak rather than swallowing it.
- **The `|-activate|move: Struggle` line is not emitted here.** Board-correct, narration-open, no
  probe fails on it yet.
- **`.scratch_eng/` and the pre-modified `data/*.json`** (archetypes, conformance, divergence-turns,
  job-costs, kad-replays, partial-label-em, regulation-usage, rulebook-collision) are another
  session's — every one predates this session's first command by mtime. Left, nothing executed.

## OWED, NOT RUN

- `tests/interaction_matrix.js` — not re-run; stamped 2026-08-11, already stale before this pass.
- `engine/wire_ladder.js` — not re-run; the release ladder stays WITHHELD, as it already was.
- `tests/run-all.js` — not run in full. Run and green: `test-mechanics`, `test-roadmap-register`,
  `test-docs-current`, `test-encore-fail-silent`, `test-volatile-duration`,
  `test-engine-consistency`, `test-tag-wire`, `test-engine-diff --n 6000`. `staged_board.js` is 24
  of 25, unchanged.
- `engine/status.js` still prints `FEATURE SEMANTICS CHECK FAILED` — MEASURE's, firing before this
  pass, untouched.
- `tests/test-fixture-legality.js` is red at HEAD (#266), pre-existing.
