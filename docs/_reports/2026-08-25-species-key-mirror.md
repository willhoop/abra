# 2026-08-25 — The roster mirror asked "which body is this?" of mutable display state

**Written by the coordinator, not by the agent that did the work.** The ENGINE agent's own operating
instructions forbid it writing report files, so its account went to `docs/ENGINE.md`
(§*"A SPECIES NAME IS DISPLAY STATE"*), `docs/MEDICHAM-SPRINT-NOTES.md` and CHANGELOG 5.131.6.
This file exists so `engine/orient.js` can collect the OWED block below — without it the handoff
chain breaks and the next session is not told what is outstanding.

## VERDICT IN ONE PARAGRAPH

`engine/game_differential.js` resolved roster identity from `id(body.name)` — the display name, which
seven abilities in this format rewrite mid-game (Disguise, Forecast, Hunger Switch, Illusion,
Imposter, Stance Change, Zero to Hero — derived from `data/tags.json`, printed every run). A renamed
body became a body nothing could ask for: the mirror returned `cannot`, the driver stopped the game,
and the scenario reported SHORT — **neither a divergence nor an agreement**. Fifth instance of the
class listed in `engine/mc_key.js`'s header. Fixed with one `rosterKey(x)` door that every
roster-identity caller routes through, with a counter printed every run for any read that falls back
on display state, because every instance of this class returns `undefined` — which reads as a
legitimate "never seen this Pokemon". Commit `e42f4be9`, both legs on release `d38d117e68e9`.

**Gate unmoved and correctly so: whole-game 17 of 961 before and after, the same 22 raw games by
`config|seed`, identical class table, census 706/706/0.** The LAB moved: `tests/staged_board.js`
22 → 24 of 25. Suite 132 green / 29 red / 2 skipped → 135 / 29 / 0, red set unchanged.

## THE PART WORTH READING — A SECOND INSTANCE WALKED PAST THE FIX INSIDE THE HOUR

The first `rosterKey` keyed the authority on `Pokemon#baseSpecies`. **`formeChange` rewrites
`baseSpecies` when `isPermanent`, and mega is permanent.** The old name-pair had agreed *through* a
mega because both engines rename together, which is why megas were never the visible half. The pinned
run went **22 parted → 227**, 70 unmirrorable. **Only the 961-game run caught it** — the rename sweep
is derived from ability tags and mega is not an ability. Ships on `Pokemon#set.species`.

**What still walks past, stated rather than implied:** a third object kind carrying neither stamp
(returns `null`, counted `neither`); a second *file* asking the same question its own way —
`test-mc-key.js` / `test-mc-seal.js` own `MC.mons`, this owns one decision in one file, and **nobody
owns "which roster entry is this" repo-wide**; and a rename produced by a mechanism with no tag.

## TWO THINGS THAT WERE FILED WRONG AND ARE NOW FILED RIGHT

- **The third failing scenario is not a keying bug at all.** `roar-drags-whoever-is-standing-there`
  refuses with a byte-identical message before and after. It is TEMPORAL: medicham2 resolves a whole
  turn at once, Showdown pauses mid-turn at a pivot's switch request, so a priority −6 phaze has not
  run there yet and the mirror is handed the end-of-turn occupant instead of the body sent in at the
  request. Fix is a switch-in journal at medicham2's `bringIn()`, keyed on the body OBJECT.
- **The sample moved once and it was the ruler.** Minting `switchTo` through the resolver also re-keys
  the coverage steering's bandit counter, merging a mega'd body's click history with its base's:
  22 → 27 parted, and **not one** of the seven new causes a switch line. Held, commented at the call
  site, and handed to MEASURE — re-keying the sample is a measurement decision, not an engine one.

## OWED, NOT RUN

```bash
# THE TEMPORAL MIRROR DEFECT — the remaining staged_board red. Own batch.
#   probe first: stage a pivot whose slot changes hands AGAIN later in the same turn
#   (U-turn then a priority -6 phaze) and require the full script; control = the same
#   board with no phaze, which must already pass.
#   fix: a switch-in journal at medicham2's bringIn(), keyed on the body OBJECT.
#   DO NOT read medicham2's own |switch| lines — Illusion narrates the disguised species.
node tests/staged_board.js                                   # currently 24 of 25

# the positive control for MEASURE's addressing audit, not re-run on this release
MEDI_SWITCH_BY_INITIAL_INDEX=1 node engine/game_differential.js --games 1200 --arm middle \
  --release d38d117e68e9 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state

# the same run at a LONGER cap — nothing here says anything about turn 13 onward
node engine/game_differential.js --games 1200 --arm middle \
  --release d38d117e68e9 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state --turns 30

# MEASURE's, not ENGINE's: should the coverage steering's switch bandit key be the ROSTER
# IDENTITY rather than the current species? It is more correct and it MOVES THE SAMPLE
# (22 -> 27 parted, 8 games in, 3 out). Held today so this batch stayed a photograph.

# not re-run on this release by this pass
node tests/interaction_matrix.js
node tests/mutation_harness.js
node engine/quarantine.js
node engine/wire_ladder.js      # data/wire-ladder.json is UNSAFE and its figure is withheld
```
