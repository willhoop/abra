# probe_protean_contrary under Reg M-C: the `itemboost` lead (2026-09-23, abra/regmc 0.69.1)

## Verdict

The `itemboost` lead read NOT STAGED under Reg M-C because of a fixture gap. The engine was correct. The lead now
stages four Contrary-and-seed arms with controls in Reg M-C. The probe is green in both regulations. No engine byte
moved.

## Cause

`L3` (`itemboost`) derives every legal item whose handler calls `boost()` or carries `boosts`. Its `cases()`
returned `[]` unconditionally. Its verdict was FALSE when the list was empty and NOT STAGED otherwise.

- Reg M-B: the list is empty, so the verdict is FALSE and the probe is green.
- Reg M-C (derived this run from `pokemon-showdown-mc`): `electricseed{"def":1} grassyseed{"def":1}
  mistyseed{"spd":1} psychicseed{"spd":1}`. The list is not empty and there were no arms, so the verdict was NOT
  STAGED and the probe exited 1. This has been the case since the seeds became legal, which is the 0.62.0 engine.

No Champions override exists for the seeds or for Contrary (`data/mods/champions/items.ts` and `abilities.ts`, checked
by the lead's own `overridden()` call, which now also gates the lead). Each seed's `onStart` and `onTerrainChange`
call `pokemon.useItem()`, which applies `boosts` through `boost()`, and Contrary's `onChangeBoost` inverts that.

## Fix (fixture only)

The carriers are derived from the M-C dex over legal species. Contrary: Malamar, Serperior, Malamar-Mega and
Staraptor-Mega. Electric Surge: Pincurchin and Raichu-Mega-X. Psychic Surge: Indeedee and Indeedee-F. The probe's
legality check (the validator's `canLearn`) passed on every row.

- `eseed-terrain@{top-tie-first,middle}` (check) goes against `ctl-` (control). Malamar holds an Electric Seed, with
  Contrary against Suction Cups, and leads beside Tinkaton. The foe's Pincurchin (Electric Surge) leads, so the seed
  is used from `onTerrainChange`.
- `pseed-switchin@...` (check) goes against `ctl-` (control). The foe's Indeedee (Psychic Surge) leads. Malamar holds
  a Psychic Seed and switches in on turn 1, so the seed is used from `onStart`.

The authority's outcome is Contrary -1 against control +1 on both roads at both pins, so the fixture is not blind.
MEDICHAM prints the same `-unboost` or `-boost` line, and every board agrees. The lead has no knob, because no
defect was found. The runner's `KNOB ABSENT` clause now applies only to a lead that declares a knob. The arms are
built only when `legal(dex.items.get(<seed>))`, so Reg M-B stages nothing and keeps the FALSE verdict.

## Results

- `node tests/probe_protean_contrary.js --regulation regmc`: **all 50 arms clear**, exit 0, release `485d0a6840ad`.
- `node tests/probe_protean_contrary.js` (Reg M-B): **all 42 arms clear**, `itemboost: FALSE`, exit 0, release
  `89ac57f1f81b`.
- The probe's `ER.cut()` rewrote `data/engine-release.json`. That change was reverted and is not committed.

## Limits

- The arms are `check` arms. They show that the engines agree today. No knob shows that the board would part if
  Contrary stopped inverting a seed. The authority's -1 against +1 separation shows the fixture reaches the
  mechanism, and the board compares `boosts`.
- Grassy and Misty seeds are not staged. The regulation has no legal Misty Surge body (derived: none). The Grassy road
  (Rillaboom) runs through the same `useItem` → `boost()` path as the Electric road.

## OWED, NOT RUN

- No lattice was re-run, because no engine byte moved. The pins stated in the brief are unchanged: Reg M-C 0/954,
  0/1075, 0/1537 and Reg M-B 0/961 at 0.69.0.
- `node engine/status.js --write` was not run, by instruction: this is a worktree.
- Not pushed, by instruction. The work is committed on the worktree branch only.
