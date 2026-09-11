# 2026-09-11 — dated-block granularity: a same-day regeneration was judged as if it came first

MEASURE. No games played. Files edited: `engine/docs_scan.js`, `tests/test-docs-current.js` (comment only).
Nothing committed, nothing pushed; the coordinator's staged 6.10.0 commit was not touched (`git diff --cached --stat`
unchanged: 7 files, 507+/112-; my two files show as unstaged ` M`).

## Verdict

**Hypothesis CONFIRMED.** The "regenerated after the block" test compared at day granularity. In
`citationMismatches`, `file()` called a figure judgeable when `stamps.get(c) <= when`, both sides being `YYYY-MM-DD`,
so a same-day regeneration counted as "not after" and the figure was judged against bytes written later.
`untraceableCensus` had the same rule (`stamps.every(d => d && d > when)`).

## The red, measured

| | value | source |
|---|---|---|
| row | `docs/RUNNING-NOTES.md:144` (6.7.0, heading dated 2026-09-11), figure `856`, cites `data/mechanics-census.json` | `citationMismatches(['docs/RUNNING-NOTES.md'])` |
| row committed | `b439bc2b`, committer-time 1789110992 = **2026-09-11T07:16:32Z** | `git blame --porcelain -L 144,144` |
| census at HEAD | generated 2026-09-11T07:06:07.090Z, `live` 856, `missing` 0 | `git show HEAD:data/mechanics-census.json` |
| census in working tree | generated **08:55:31.770Z** at the start of this session, then **09:18:51.185Z** (`live` 868, `missing` 4) before the end, both from the ENGINE agent | `data/mechanics-census.json` |

The row was right at commit time: HEAD's census, generated 10 minutes before the commit, holds 856. The census was then
regenerated later the same day, and because the dates tied the row was judged against the newer bytes.

Row 134 (6.8.0, committed `f7ad7718` at 2026-09-11T08:22:47Z) states the same `856` about the same file, and is the
same ratchet key (`doc|figure|cites`). The gate printed `:144` because the map kept the last line with that key. Both
lines are the same case.

Before the fix: `node tests/test-docs-current.js` gave **36 passed, 1 failed** ("figures a cited artifact does not
contain: no new entries (baseline 19, now 20)").

## The fix

`engine/docs_scan.js` adds `artifactInstant`, `lineCommitInstant` and `regeneratedAfter`, and both rules now route
through `regeneratedAfter`. No parallel mechanism was added: the day comparison is unchanged, and only a **tie** goes
to the clock.

- **Line instant**: the committer time that `git blame --porcelain` records for the figure's own line in the working
  tree. It is an upper bound on when the text was written, so ordering by it can never excuse a line written after
  the regeneration. Committer time is used rather than author time because an amend can change a line and keep its
  author time. Blame runs lazily, once per document and only when a tie needs it (107 ms for the notes page).
- **Artifact instant**: `generated`, but only when it carries a time AND a zone (`/^…T hh:mm[:ss[.fff]] (Z|±hh:mm)$/`).
  A bare date such as `data/nmf-roles.json` `2026-09-09`, or the zone-less `2026-09-08 05:36:17` that
  `data/protocol-events.json` writes, cannot be placed on the clock, so it stays judged.
- **Uncommitted lines** (working tree or index) have no instant, so they are **judged**. Git reports the all-zero sha
  for them, with committer-time set to now, and that is mapped to null. So every row is judged at least once, by the
  pre-commit hook at the commit that publishes it, and is excused afterwards only by a regeneration that git can show
  came after that commit.
- **It never overrides a date.** A block stamped for an earlier day stays predating even when a later commit touched
  its line. A reflow is not a re-statement, and dating by blame would re-judge every old paragraph a line-wrap
  touched. (That alternative was not measured; see OWED.)

## Plants — shown red on the old rule first

The cases were added to `CITATION_CASES` and `TRACE_CASES` together with the `instant` injection, **before** the rule
changed. The old code ignored the option.

| case | old rule | new rule |
|---|---|---|
| citation: same-day block committed 09:00Z, artifact regenerated 11:48Z, figure absent | **BROKE** (caught=true) | holds: predates |
| citation: same text committed 13:00Z, after the regeneration (CONTROL) | holds: caught | holds: caught |
| citation: same text, uncommitted | holds: caught | holds: caught |
| citation: same-day artifact with a bare-date stamp | holds: caught | holds: caught |
| citation: same-day artifact with a zone-less stamp | holds: caught | holds: caught |
| citation: 1.0.0 block, line committed after the regeneration (the date is not overridden) | holds: predates | holds: predates |
| trace: same-day block committed 09:00Z, artifact 12:00Z | **BROKE** (got unbound) | holds: predates |
| trace: same block committed 15:00Z (CONTROL) | holds: unbound | holds: unbound |

Totals: citation proof **25/26 → 26/26**, trace proof **24/25 → 25/25**. `PROOF_TRACE_JSON.generated` moved from
`T00:00:00Z` to `T12:00:00Z` so that a same-UTC-day earlier commit can exist; its date, which is all the existing
cases read, is unchanged.

## Live surface, old against new on the same bytes, in one process

Old = `instant: () => null`, which reproduces the old rule exactly. Surface = `livingDocs()` plus the notes page.

- citation rule: accused **23 → 21**, predates **216 → 218**. Moved accused → predates:
  `RUNNING-NOTES.md:134|856|data/mechanics-census.json` and `:144|856|…`. **0** moved the other way.
- same-day ties that stay judged, as designed: `:579` `0.682` (`data/nmf-roles.json`, bare date) and `:791` `47`
  (`data/protocol-events.json`, zone-less). Both were already baseline keys.
- census (3b(c) and 3b(d)): untraceable 22 → 22, unbound 0 → 0, predates 0 → 0. No change.

## Gate

After the fix: `node tests/test-docs-current.js` (through `tools/lownode.cmd`) gave **37 passed, 0 failed**, printing
"218 figure(s) sit in dated blocks whose cited artifact was regenerated after the block". The baseline was **not
rewritten**: `data/docs-currency-baseline.json` hash `fd035d53…` before and after, "no ratchet movement". The
`node engine/docs_scan.js` CLI still runs (exit 0). `engine/major_readiness.js` calls both rules with their defaults,
so it picks up the new rule with no interface change.

## Does it stay green once the ENGINE agent's artifacts land?

**The 856 row does, whatever the census becomes, with one exception.** Row 144 was committed at 07:16:32Z, and any
census generated after that instant orders after it, so the row is predating. The exception: if the census went back
to HEAD's bytes (07:06Z), the row would be judged again, and those bytes hold 856, so it would still pass.

What can still go red after ENGINE lands is not this defect:

- ENGINE's own **uncommitted** rows are judged against the disk at its commit. That is by design.
- **Undated** blocks in living documents that cite an artifact ENGINE regenerates are claims about the disk today,
  and are judged by design.
- Same-day ties against artifacts whose `generated` has no time or no zone are still judged.
- The coordinator's staged 6.10.0 row cites no `data/` artifact, so this rule cannot trip it.

One structural note, not fixed: the hook and gate read the **working-tree** artifacts, not the index. A commit that
leaves out another agent's in-flight regeneration is still judged against that regeneration. This only bites
uncommitted rows, which is the rule working as intended, but the bytes it judges against are not the bytes being
committed.

## Notes-row text (for the coordinator; I did not write `docs/RUNNING-NOTES.md` or `CHANGELOG.md`)

> ## [x.y.z] — 2026-09-11 — a notes row committed before a same-day regeneration is reported, not judged: the dated-block check orders a tie by the clock
>
> - **What changed.** `engine/docs_scan.js`: `citationMismatches` and `untraceableCensus` decided "the cited artifact was regenerated after the block" by DATE, so a row and a regeneration on the same day tied, and the row was judged against bytes written after it. The 6.7.0 row (`856`, committed 07:16:32Z) was accused against a census regenerated at 08:55:31Z, which blocked every commit. A tie is now ordered by the committer instant `git blame` records for the figure's line against the artifact's `generated` instant (`regeneratedAfter`); an uncommitted line, or a stamp with no time or no zone, is still judged, and the instant never overrides a date. Eight demonstration cases were added; `tests/test-docs-current.js` has a comment only.
> - **Measured.** Old rule against new on the same bytes: accused 23 → 21, predates 216 → 218, the two moved rows being `docs/RUNNING-NOTES.md:134` and `:144` (`856`); 0 moved from predates to accused; the census is unchanged. Proofs were red on the old rule (citation 25/26, trace 24/25) and are green after (26/26, 25/25), with the same-day control committed after the regeneration still accused. Gate 37 of 37, baseline unmoved. Detail: `docs/_reports/2026-09-11-dated-block-granularity.md`.
> - **Supersedes.** Nothing.
> - **Basis.** unchanged.
> - **Owed to the next major.** None — no published figure moved.

PATCH by the repository's scheme (SemVer clause 6): a gate fix, and no published figure moves.

## OWED, NOT RUN

Re-run the gate once the ENGINE agent's artifacts and rows have landed (expected green for row 144; anything red is an
uncommitted or undated claim, not this defect):

```bash
node tests/test-docs-current.js
```

Re-run it after the coordinator's staged 6.10.0 commit and this fix are committed. The committed lines then carry an
instant, and the pre-commit hook runs this same gate:

```bash
node tests/test-docs-current.js && node engine/docs_scan.js --owed
```

Not measured: how many verdicts would move if the blame instant were allowed to OVERRIDE a block's date rather than
only break a tie. This fix does not do that, and the number would say what that design costs:

```bash
node -e "const S=require('./engine/docs_scan.js');const fs=require('fs');const d=[...S.livingDocs(),S.NOTES_LOG].filter(x=>fs.existsSync(x));const m=S.citationMismatches(d);console.log(m.length,m.predates.length)"
```

(Run that before and after a local experiment that compares `instant` against the artifact's instant regardless of
date. Do not ship the experiment without a case that pins it.)

Not fixed: the gate judges working-tree artifacts while the commit records the index. Whether it should judge the index
for a staged commit is a design question for the gate's owner.
