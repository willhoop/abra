# Contributing to ABRA

## Before you change anything
1. Read `README.md` and `docs/`.
2. Run `node tests/test-parse.js` and confirm it passes.

## The rule for every change (same pass)
1. Change the code.
2. Update the white paper, the deck, and the technical documentation.
3. Add a `CHANGELOG.md` entry, bump the version, set the date.
4. Tests pass.

## Design rules specific to ABRA
- **Never design an analysis that forces re-pulling replays.** Store raw, analyse on top.
- Extractor changes must keep `tests/test-parse.js` green (derive expected values by hand).
- Anything that changes over time (format string, rating tiers) lives in one place.

Report problems at willjhooper@msn.com.
