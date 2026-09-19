# 7.0.0 DRAFT — for Will to read before anything is published

**Status: DRAFT. NOT PUBLISHED.** Will, 2026-09-19: *"get as close to 7.0 as you can so i can read about it
before we publish"*. These five files are the 7.0.0 living-document fold-in, written as if the MEDICHAM gate
opens. They live in `docs/_reports/`, which is historical by construction and outside every live-document
gate. The live documents in `docs/` are unchanged. No `## [7.0.0]` CHANGELOG entry exists, and no version
header was bumped.

Every figure that depends on the final measurement is a `<<GATE: …>>` placeholder, never a guessed number.
There are 93 placeholder markers in total; lines with more than one count once in `grep -c`.

Drafted by a docs agent in an isolated worktree, starting from Will's held 2026-09-11 drafts and three-way
merged onto HEAD `bb38b6db` (6.52.0). Notes rows 6.28.0 to 6.52.0 are folded in. Saved here by the
coordinator, because the agent's own write of this report was refused.

| File | What it is |
|---|---|
| `ABRA-whitepaper.md` | technical paper; new 7.0.0 head block on the gate, three lattices, coverage limits, basis change |
| `ABRA-deck-plain-english.md` | plain-English deck; led by "one sample was not enough" |
| `ABRA-technical-docs.md` | ASD-STE100 docs; the seven gating clauses, 35 knob rows, 17 instruments, the lattice procedure |
| `SUMMARY.md` | whole-project table rebuilt around the three lattices |
| `MODELS.md` | per-model ledger; quarantined model figures stay withheld |

## Read these first

1. **The gate also requires narration to be zero, once the boards match.** The code arms the narration clause
   automatically when all three lattices read zero board-material. The last narration reading was
   0 / 11 / 24 (6.53.0). So the road to 7.0.0 is boards AND narration, which matches your 2026-08-22 ruling
   that narration is its own gate.
2. **"Could not stage" does not fail the gate in the code.** That contradicts your standing rule that unstaged
   in-scope mechanics block MEDICHAM. It is moot today, because every roster stage reads 0 COULD-NOT-STAGE,
   but the rule is not wired. That is being fixed, not asked.
3. **The releases the recent re-measures ran on are not in git.** A published figure has to cite a release
   that is in the repo, so the 7.0.0 release gets committed before any placeholder is filled.

## Other judgement calls

4. **A retraction owed on main now, independent of 7.0.0.** The published white paper's 2026-09-12 UPDATE
   still states the 1350 and 1950 board-material counts from release `bc8d7cf849dd`. The draft deletes them;
   main needs the same edit.
5. **Scanner defect.** The retraction registry registers every large number inside a struck span, including
   lattice game counts, so a correct later sentence stating a game count can be accused of restating a
   retraction.
6. **Six scanner hits that will fail at publish.** `14.757%` and `49.3%` in dated blocks are charged against
   `data/policy-weights.json` only because the digits also appear there. They need binding to their real
   sources.
7. **Edits the held drafts made inside dated 6.0.0 blocks were reverted** to the published text, because they
   left sentences that were true of no release. The white paper corrects its own 6.0.0 roster sentence in
   place, so the documents do not follow one practice.
8. **Figures removed from the held MODELS text because nothing binds them:** the value net's 66.92% ceiling,
   the profile shares, and the "69 downstream" count.
9. **A rule-of-three upper bound on the per-game divergence rate** (Hanley & Lippman-Hand, 1983) is new in
   the paper. Cut it if a generous bound is worse than none.
10. **Known defects still open when the gate opens** must each be stated open or closed, never omitted.
11. **Corner arms:** re-measuring them on the 7.0.0 release would remove a caveat from all five documents.
12. **Your "stay stale" quote** is dated 2026-09-09 in SUMMARY and 2026-08-11 elsewhere. Left as written.
13. One illegal name was found in the held technical docs (a Past move in the knob table) and reworded.

## Publish checklist (only when you say publish)

1. ~~Cut the 7.0.0 release, commit it under `data/releases/<id>`, and check `git ls-files` lists it.~~ DONE (pass 2): `4c9b0cc4a4da`, 29 files tracked.
2. ~~On that one release with the three pins, run the three lattices, the three roster stages
   (`--reds --write`), `engine-diff`, `all_mechanics_fire` and the census, then `engine/quarantine.js`,
   `engine/coverage.js` and `engine/open_work.js`.~~ DONE (6.60.0, 6.61.0; read again in pass 2). Corners NOT re-run.
3. ~~Fill every `<<GATE: …>>` from those outputs, then check `grep -c '<<GATE'` reads 0 in all five documents.~~ DONE (pass 2): 0 in all five.
4. Copy the five documents over `docs/`, and set each line-3 version header to 7.0.0 with the date.
5. Add `## [7.0.0]` to `CHANGELOG.md`, and a `## [7.0.0]` notes row with
   `**Basis.** CHANGED — <what a reader can no longer be told>`. Clause 5d refuses a major that names no basis
   change.
6. Run `node engine/status.js --write`, rebuild the PDFs, then run `tests/test-docs-current.js`,
   `engine/docs_scan.js --owed` (it should reach 0), `engine/major_readiness.js`, `engine/provenance.js` and
   `../portfolio/build/check_projects.py`.

## Checks at draft time

- `docs_scan` over the five documents: 0 citation mismatches, 0 retraction violations, 0 untraceable figures,
  1 unbound figure.
- `tests/test-docs-current.js`: 36 passed, 1 failed, on a dated 3.68.0 sentence in SUMMARY ("64 games of
  1,995") that `data/wire-ladder.json` no longer holds.
- `node engine/docs_scan.js --owed`: 71 of 100 notes rows owed to this major.

## OWED, NOT RUN

```bash
# every measurement behind the placeholders, on one committed release
node engine/engine_release.js cut "7.0.0"
git add -f data/releases/<id>
node engine/quarantine.js
node engine/coverage.js
node engine/open_work.js
node tests/test-docs-current.js
node engine/docs_scan.js --owed
```

Also owed: the retraction on main (item 4), binding the six scanner hits (item 6), the registry defect
(item 5), and SUMMARY's "64 of 1,995" sentence.

## PASS 2 — 2026-09-19

**Placeholders: 93 filled, 0 remaining** (`grep -c '<<GATE'` reads 0 in all five documents). Every figure was
read this session from the artifacts on release `4c9b0cc4a4da` at HEAD `e85e48c8`, or printed by
`engine/quarantine.js`, `engine/coverage.js`, `engine/open_work.js` and `engine/docs_scan.js --owed`, all run
through `tools\lownode.cmd`. No figure is typed from memory. Every new name was checked against
`Dex.forFormat('gen9championsvgc2026regmb')`.

### Read these first (they replace items 1–3 above)

1. **`tests/test-docs-quarantine.js` is RED on main now.** Opening the gate turned its "no figure from an
   un-re-measured downstream artifact" check on, and it charges 15 figures in live `docs/` — several look
   like digit collisions (a store funnel count charged to `data/collinearity-joint.json`). The drafts had 3
   of them (whitepaper and SUMMARY `7,234`, tech docs `9,230`); I deleted those three in the draft. Main
   needs the same, plus the live deck's `22,000` and 12 more outside the five documents (`docs/ENGINE.md`, `docs/MEASURE.md` and others; run the test for the list).
2. **Four lattice games THREW** (1 / 1 / 2): the empirical driver clicked a move the authority had disabled
   that turn. They count as board-never-diverged because their boards agreed up to the stop. A driver defect,
   stated in every document, not fixed.
3. **Three narration leads are open and on no register row**, so the open-defect clause cannot see them:
   Coaching's `-fail` after `[notarget]` (6.57.0 row); Tidy Up's order and missing `-activate`, and
   `-unboost|0` at −6 (6.59.0 row). None parts a lattice game. The clause also warns
   `data/register-reality.json` (2026-09-12) is older than the register.
4. **Axe Kick's staged fixture parts a board** (the confusion counter, 1 against 2) in
   `data/all-mechanics-fire.json`. No clause counts it: it parts no protocol line and the move is deferred by
   you below the usage shelf. Stated in all five.
5. **The rule-of-three bound** uses the largest lattice alone (n = 1497, about 0.20%): no artifact records
   the count of distinct games across the three lattices. Cut the sentence if you prefer no bound.

### What changed in this pass

- Filled all 93 placeholders; rewrote the 7.0.0 heads from "if the gate opens" to the open reading.
- Folded 6.53.0–6.61.0: the 6.54.0/6.57.0/6.59.0 fixes, 38 new knob rows in the tech-docs table (each
  checked present in the release copy of `engine/medicham2-browser.js`), the lattice sequence
  0/1/2 → 0/1/1 → 0/0/0 and narration → 0/0/0, how the gate opened, what `coverage.js` says it does not
  cover, and the open leads. The seven 6.52.0 leads: six fixed at 6.54.0, the item lead was false.
- The roster-clause description now says an in-scope COULD-NOT-STAGE fails its stage (6.56.0) — the draft
  said the opposite. The owner-deferred list now names all nine from the artifacts (six abilities, three
  moves), not three.
- Merged the HEAD edits since `bb38b6db`: the `data/human-protect-ruler.json` and
  `a347d6d0:data/game-differential.json` bindings (whitepaper, tech docs, MODELS) and SUMMARY's
  `f038cdb3:data/wire-ladder.json` pin. The whitepaper retraction was already in the draft; the live
  roster sentence has no counterpart (the draft rewrote §3).
- Downstream figures stay withheld and say so: RE-RUNNABLE, not re-run, by your instruction.
- Wrote `CHANGELOG-7.0.0.md` and `NOTES-7.0.0.md` (Basis: CHANGED).
- Items 2, 3, 4 and 6 of the first pass are resolved on main (6.56.0). Item 5's registry fix also landed
  in 6.56.0.

### Checks

- `docs_scan` has no path flag, so its exported functions were called over the five draft paths
  (scratchpad script): **0 retraction violations, 0 citation mismatches, 0 quarantined figures, 0
  untraceable.** 0 unbound figures on any line this pass changed. The census reports 973 unbound on
  unchanged lines; those are grandfathered by `docs/` path and only count once the files sit there.
- `grep -c '<<GATE'`: 0, 0, 0, 0, 0.
- `node engine/docs_scan.js --owed`: 81 of 100 owed.

## OWED, NOT RUN

```bash
# at publish, after copying the five files over docs/ and setting the line-3 headers to 7.0.0
node tests/test-docs-current.js          # includes the grandfather ratchet on the real paths
node tests/test-docs-quarantine.js       # RED on main today; fix the 12 live-doc hits first
node engine/docs_scan.js --owed          # should reach 0
node engine/major_readiness.js
node engine/provenance.js
node engine/status.js --write
python ../portfolio/build/check_projects.py
```

Also owed: the corner arms on `4c9b0cc4a4da`; the driver's disabled-move refusals; register rows for the
three narration leads; `node engine/register_reality.js` (stale verdicts); the PDFs.
