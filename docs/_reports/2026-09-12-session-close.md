# Session close — 2026-09-12

A long night on MEDICHAM. It started believing the gate was open and ends with the gate honestly closed,
because a 12,000-game run showed the published zero belonged to one team lattice.

## Where the gate stands

`node engine/quarantine.js` reads **CLOSED — 1 of 8 GATING clauses fail**. The one failing clause is the
whole-game BOARD-MATERIAL clause, which now reads three team lattices and requires zero on all of them.
It is **broken, not unmeasured**: real board divergences exist on two of the three lattices. Every other
gating clause passes, including the damage differential at every roll index, all three roster stages,
coverage, the staged-mechanics clause and the open-defect clause.

## What landed tonight

- The quarantine classifier, the documents' quarantine clause and the gate parser each had a blind spot,
  and each was fixed: a lowercase "defect" the open-defect clause could not match, a pipe character that
  split status cells, and an open gate that silently switched off the check against publishing stale
  figures.
- Engine defects fixed, each red before and green after: the per-hit survival clamp on multi-hit moves;
  a perish-zeroed body running its later residual handlers; the sleep counter counting turns elapsed where
  the authority counts ticks spent; Heal Bell doing nothing at all; Corrosive Gas ordering a spread
  click's refusals; Reflect Type's turn-boundary type broadcast; the charge volatile surviving an aborted
  move; mega evolution skipping the outgoing ability's End handler.
- The deliberate roster was re-staged from end to end. Out-of-scope abilities were removed from every
  count. Several control defects were found and fixed along the way — a control that counted its own
  bookkeeping, a null control that made the control arm the subject arm, a party collapse from a
  duplicated species, a delivery click that switched its own user out, a secondary effect that let a
  control win — and every greened row now rests on leaves that are the mechanic acting.
- The gate's whole-game clause was changed to read three team lattices.

## OWED — commands

The live tree differs from release `bc8d7cf849dd` on one frozen file, `data/abra-tags.js`, because that
release was cut with a stale bundle. The tag involved is not read by any engine path, so no measurement
was affected — but cut a release before the next measurement:

```bash
node engine/engine_release.js cut "abra-tags.js rebuilt with the Heal Bell tag; release bc8d7cf849dd froze a stale bundle"
```

Re-measure the three lattices on that release (substitute the new id):

```powershell
cmd /c tools\lownode.cmd engine\game_differential.js --release <new> --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --write
cmd /c tools\lownode.cmd engine\game_differential.js --release <new> --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1350 --turns 50 --steering empirical --end-state --write --out data/game-differential.g1350.json
cmd /c tools\lownode.cmd engine\game_differential.js --release <new> --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1950 --turns 50 --steering empirical --end-state --write --out data/game-differential.g1950.json
node engine/quarantine.js
```

Diagnose the parted games, mechanism by mechanism — nine leads are registered with worked examples in
ROADMAP #622, and a charge-volatile board split still appears on the 1950 lattice, so that fix is
incomplete:

```bash
node engine/open_work.js
```

Refresh the register. Six closed rows name the whole-game clause as their verification, and it now exits
1, so they will correctly read PREMATURE CLOSE:

```bash
node engine/register_reality.js
```

Remaining roster rows, each with a measured reason in `docs/_reports/2026-09-12-last-ten.md` and
`docs/_reports/2026-09-12-last-moves.md` — abilities Frisk, Good as Gold, Zero to Hero, Quick Feet,
Simple; moves Focus Energy and Struggle, which both wait on a second control click:

```powershell
cmd /c tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release <new>
cmd /c tools\lownode.cmd tests\roster.js --stage moves --reds --write --release <new>
```

Gastro Acid stays open (ROADMAP #618): the board compares the ability slot while the authority keeps the
slot and only makes the ability ignored, so the correct fix spans the tag-lookup sites rather than one.

## What is red, and not waived

- **The gate** — CLOSED on the whole-game clause, as above.
- **`tests/test-docs-current.js`** — flags figures in the four documents held by the unreleased 7.0.0
  (deck, technical docs, SUMMARY, MODELS). Their rewrite is on hold by Will's instruction; their stale
  numbers are owed a correction, built from HEAD so the held fold-in does not ride along.
- **`engine/register_reality.js`** — exits 1 on its own internal bar. It is not the gate.

Two web tests read red and are waived by Will by name.

## Held, deliberately

The 7.0.0 documentation release stays on hold until in-scope mechanics are staged and the gate opens on
every lattice. The four held documents and the six untracked `2026-09-11-700-*` reports remain uncommitted.
