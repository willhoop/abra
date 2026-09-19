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

1. Cut the 7.0.0 release, commit it under `data/releases/<id>`, and check `git ls-files` lists it.
2. On that one release with the three pins, run the three lattices, the three roster stages
   (`--reds --write`), `engine-diff`, `all_mechanics_fire` and the census, then `engine/quarantine.js`,
   `engine/coverage.js` and `engine/open_work.js`.
3. Fill every `<<GATE: …>>` from those outputs, then check `grep -c '<<GATE'` reads 0 in all five documents.
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
