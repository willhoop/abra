# Docs refresh A — white paper, deck, technical docs for abra/regmc 1.0.0

Branch `docs-1.0.0-a`, cut from `origin/draft/regmc-1.0.0` (`09bda887`). Not merged into draft or main.

## What was done

- `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md` rewritten from
  scratch. Mastheads: `Version 1.0.0`, `Line: abra/regmc`. They leave the closed `abra/regmb` line; the Reg M-B
  editions stay at `bfbf9cf9` (the 7.0.0 commit) and each document says how to read them.
- Emphasis per Will's guidance: the search plan leads and takes most of the space (white paper §2: pipeline,
  SLOWKING, MILTANK, MAG/DODUO, XATU, PORYGON2 + MEW/MACHAMP, HYPNO/GARY, WOBBUFFET/DUSK, the clock, ROTOM, how a
  version is judged, milestones M0–M8). MEDICHAM's certification is §4, the foundation.
- Clock: quoted verbatim from `pokemon-showdown-mc/data/rulesets.ts:778-785` (`vgctimer`: Starting 420, Grace 90,
  Add Per Turn 0, Max Per Turn 55, Max First Turn 90), with the Bo3 format's use of `VGC Timer` read at
  `config/formats.ts:295-299`. Checked that the Champions mod's timer line is commented out.
- ESS old-vs-new comparison: white paper §5.2. Reg M-B 7.0.0 figures bound to commit-pinned blobs
  (`bfbf9cf9:data/...`), Reg M-C 1.0.0 figures to `14c36f21:data/...-regmc.json`. Only the damage differential
  links; every other row is marked not linkable, with the reason. The M-B held-out draw is quoted as a readout.
- Fold-in: every `abra/regmc` row 0.1.0 → 1.0.0 summarised by phase in white paper §4.3, each phase naming its
  versions so its figures bind to CHANGELOG-REGMC entries.

## Judgement calls — Will should know

1. **Arena win rates are NOT printed**, although the brief asked for PRE-GATE figures "labelled as such". CLAUDE.md
   says a quarantined figure is withheld, not captioned, and CHANGELOG-REGMC 0.115.0/0.116.0 already declined to
   publish them for that reason. The documents say the shakedowns exist, point to their reports, and state what is
   owed before a strength figure: a release-pinned arena re-run at equal wall-clock, read by SPRT.
2. **Found: `solver/arena/arena.js` reads the live engine tree, not a frozen release** (its own artifact says so).
   Stated as owed in the white paper §3.8 and the technical docs §2.8.
3. **Found: no wide held-out draw has been run on Reg M-C.** Reg M-B had one (7,182 games); the M-C gate does not run
   it. Stated as owed (white paper §4.2, §7).
4. Offline solver figures are printed only where a CHANGELOG-REGMC entry carries them (MAG/DODUO 0.113.0, XATU
   0.114.0, tests 0.115.0/0.116.0, lean speed 0.116.1). Figures that exist only in reports (MAG recall@k, XATU top-1,
   human-dataset counts, meta counts) are described without numbers, pointing at the report, because no artifact
   the docs gate reads can bind them.
5. PokaiTrainer's figures are described, not quoted: the research report says they were read through a summary
   and must be re-read from the PDF before a living document cites them.
6. Heal Block (named in the solver log's menu-bug list) is `isNonstandard: 'Past'` in Reg M-C, so it is not named.

## Outside my three files

- `docs/RUNNING-NOTES.md`: one new row, `[abra/regmc 1.0.0] … fold-in, part A`, inserted above the draft's 1.0.0
  row. Required: the pre-commit note-check refuses a commit touching a living document without one. Expect a
  trivial conflict with part B's row at the same spot.
- `data/docs-currency-baseline.json`: the grandfathered-trace ratchet shrank (the old white paper's grandfathered
  sentences are gone). Written by `tests/test-docs-current.js` itself; committed as it requires.

## Checks

- `node tests/test-docs-current.js`: 39 passed, 0 failed.
- `node tests/test-docs-quarantine.js`: all checks passed.
- PDFs not built (another step).
