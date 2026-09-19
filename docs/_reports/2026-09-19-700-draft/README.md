# 7.0.0 DRAFT — for Will to read before anything is published

**Status: DRAFT. NOT PUBLISHED. Pass 3 (2026-09-19) rests on release `6180c4712761` (6.69.0); read PASS 3 at the end first — it supersedes the release and figures named in the sections above it.** Will, 2026-09-19: *"get as close to 7.0 as you can so i can read about it
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

## PASS 3 — 2026-09-19

**The draft now rests on release `6180c4712761` (CHANGELOG 6.69.0), not `4c9b0cc4a4da` (6.61.0).** The gate
reads `GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld`, ten of ten clauses, with the
blind-spot clauses in force. Every gate figure in the five documents, `CHANGELOG-7.0.0.md` and
`NOTES-7.0.0.md` was re-read this pass from `data/game-differential{,.g1350,.g1950}.json`,
`data/all-mechanics-fire.json`, `data/roster.{items,abilities,moves}.json`, `data/engine-diff.json`,
`data/mechanics-census.json` and `data/protocol-events.json` (all stamped `6180c4712761`, unchanged since
the 6.69.0 runs, no writer live), and from `node engine/quarantine.js`, `node engine/coverage.js` and
`node engine/open_work.js`, run through `tools\lownode.cmd` at HEAD `165b338c`. No figure typed from memory;
every new entity name checked against `Dex.forFormat('gen9championsvgc2026regmb')`.

**Placeholders: 0** (`grep -c '<<'` reads 0 in all five documents and both paste files).

### What changed in this pass

- **Gate figures replaced**: board 0/0/0 and narration 0/0/0 as before; `threw` 1/1/2 → **0/0/0**; boundaries
  10,705 / 11,842 / 16,713 → **10,716 / 11,856 / 16,725**; SAME-END-STATE 960/1068/1495 → **961/1069/1497**;
  census pin `1298f25115e3` → **`57deebd09273`**, driver digest **`faf70ecbca71`** added; census 955 →
  **969**; staged games 4700 → **4638** (planner 3836 → 3936); AMF diverged 1/1/0 → **0/0/0**, clause
  sentence now *0 diverge (+1 board-only) … 1 below the reach shelf*; protocol events 45/49 → **46/48**;
  `state.not_compared` 8 → **7** (Unburden became compared); nine clauses → **ten**. Roster, damage and red
  plants unchanged in value, re-read on the new release.
- **Folded in 6.62.0–6.69.0**: the blind-spot clauses (proof, board-only partings, the board-leaf clause,
  thrown games, control-arm partings, earned credit on a live control); the 6.63.0 engine fixes and the
  driver fix that ended the four thrown games; Anger Point (6.66.0); the quiet-control preference and the
  eleven re-staged rows (6.67.0, 6.68.0); the release-pin fix (6.65.1); the scanner collision fix and the
  six withdrawals (6.62.0). Twelve knob rows and ten probe rows added to the tech docs (§3.7, §3.8), each
  engine knob checked present in the release copy of `engine/medicham2-browser.js`; the driver and
  instrument knobs are named as such. The `7,234` sentence now carries main's pinned binding
  (`78bff6c1:data/quality-filter.json`) instead of the deletion, per the 6.62.0 row.
- **The coverage sections are rewritten in all five documents** to Will's rule: no "MEDICHAM is correct" or
  "done" — *"every gating clause passes, including the blind-spot clauses"* — then a plain list of what is
  NOT covered: Illusion (closeted, unmodelled); **Frisk and Axe Kick, OPEN and being fixed**; the sample
  (961 / 1,069 / 1,497 games, one frozen open-sheet pool, cap 50, one driver, rule-of-three ≈ 0.20%);
  closed-sheet and bo1 play not sampled; invented spreads; 76 effects that print nothing; uncomparable leaves
  covered only by other instruments (one by none); entities never exercised; ranged mechanics; two tags with
  no consumer; the declared divergence; the corners; downstream models re-runnable and NOT re-run. Six
  existing sentences that said the gate decides whether MEDICHAM "is correct" were reworded.
- **Basis** gains a fourth item in every document: a PASS no longer means what it meant at 6.61.0 (nine
  clauses → ten, stricter mechanics clause).

### Read these first (they replace the PASS 2 list)

1. **Frisk and Axe Kick pass only by deferral.** Frisk DID-NOT-FIRE (the fixture's foes hold no item); Axe
   Kick's staged board parts on the confusion counter (2 vs 1) and is judged below the reach shelf. Both are
   stated OPEN in all five documents. If ENGINE lands either fix, the lab figures move and this draft needs a
   re-read, not a rewrite.
2. **Coaching's `-fail` after `[notarget]` is still open and on no register row** (6.57.0 notes row). The
   Tidy Up and `-unboost|0` leads of PASS 2 are closed (6.63.0).
3. **Scanner defect: a release hash that opens with four digits is lexed as a figure.** `figuresInText`
   reads `6180c4712761` as the figure 6180 (a hash opening with one digit, like `4c9b0cc4a4da`, lexes as
   nothing). It counts as "bound" wherever a paragraph happens to cite `data/game-differential.g1350.json`,
   which holds 6180 by collision, and is unbound on three heading lines here (white paper line 5, tech docs
   line 9, SUMMARY's MEDICHAM row). Deliberately not bound by collision; the lexer is owed a fix.
4. **Roster fixture-legality printouts are unexplained** (items 17, abilities 94, moves 57 sets printed
   illegal and not baselined on `6180c4712761`); stated as open in the tech docs.
5. `data/register-reality.json` is from 2026-09-12 and older than the register; the open-defect clause says
   so and passes.

### Checks

- `docs_scan` functions over the five draft paths (scratchpad script): **0 retraction violations, 0 citation
  mismatches, 0 quarantined figures, 0 untraceable.** Unbound figures on lines this pass changed: **3**, all
  the release-hash lexing in item 3.
- `node tests/test-docs-current.js` on the working tree: 35 passed, 2 failed — the same two clauses and
  counts as before this pass (baseline 18 → 29 and 1,884 → 1,880), from the held working-copy drafts in
  `docs/`; this folder is outside its scope.
- `node engine/docs_scan.js --owed`: **92 of 100** owed.
- `node engine/quarantine.js`: `GATE: OPEN`, ten PASS; 69 of 261 artifacts downstream and RE-RUNNABLE.

### Publish checklist (only when Will says publish)

1. ~~Cut and commit the release~~ DONE: `6180c4712761`, `git ls-files data/releases/6180c4712761` lists 29.
2. ~~Measure on it~~ DONE (6.69.0). Corners NOT re-run.
3. ~~Fill placeholders~~ DONE: 0.
4. Decide Frisk and Axe Kick: publish with them stated OPEN (as drafted), or wait for ENGINE's fixes and
   re-read the lab figures.
5. Copy the five documents over `docs/` (Will's held working copies there differ from HEAD; reconcile
   first), and set each line-3 version header to 7.0.0 with the date.
6. Paste `CHANGELOG-7.0.0.md` above the top CHANGELOG entry and `NOTES-7.0.0.md` above the top notes row
   (`**Basis.** CHANGED`; clause 5d refuses a major that names none).
7. Run `node engine/status.js --write`, rebuild the PDFs, then `tests/test-docs-current.js`,
   `tests/test-docs-quarantine.js`, `engine/docs_scan.js --owed` (should reach 0),
   `engine/major_readiness.js`, `engine/provenance.js` and `../portfolio/build/check_projects.py`.

## OWED, NOT RUN

```bash
# at publish, after copying the five files over docs/ and setting the line-3 headers to 7.0.0
node tests/test-docs-current.js          # the grandfather ratchet on the real paths; 3 hash-lexing unbound
node tests/test-docs-quarantine.js
node engine/docs_scan.js --owed          # should reach 0
node engine/major_readiness.js
node engine/provenance.js
node engine/status.js --write
python ../portfolio/build/check_projects.py
```

Also owed: Frisk's and Axe Kick's fixes (ENGINE, in progress); the corner arms on `6180c4712761`; a register
row for Coaching's `[notarget]` lead; `node engine/register_reality.js`; the release-hash lexing defect in
`engine/docs_scan.js`; the roster fixture-legality printouts; the PDFs.
