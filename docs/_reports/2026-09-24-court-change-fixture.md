# Court Change under Reg M-B: NOT-IN-REGULATION, not COULD-NOT-STAGE — 2026-09-24 (abra/regmc 0.87.1)

## Verdict

The task was to build the fixture `probe_court_change` could not find under Reg M-B. That fixture cannot
exist. Court Change is not in Reg M-B. The claim is derived, not recalled. So the probe now reports
NOT-IN-REGULATION, asserts it three ways, and exits 0. The gate should not count it; details below.

## 1. The derived fact

Scratch derivation (Reg M-B checkout, `Dex.forFormat('gen9championsvgc2026regmb')`, legal filter
`x.exists && !x.isNonstandard && x.tier !== 'Illegal'`):

```
const {Dex}=require(process.env.SHOWDOWN_PATH+'/dist/sim');
const D=Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
D.moves.get('courtchange').isNonstandard                                  // 'Past'
D.species.all().filter(legal).filter(s => (D.species.getLearnsetData(s.id)||{}).learnset?.courtchange)  // []
```

Output on 2026-09-24:
- `move courtchange isNonstandard: Past`
- `347 legal species; 0 learn courtchange`. Walking the prevo and `changesFrom` chains also gives none.
- Unfiltered, the whole dex has one learner, `cinderace`, and it is itself `isNonstandard: 'Past'` in this format.

Under Reg M-C (`gen9championsvgc2026regmc`, the M-C checkout), the move is `isNonstandard: null`. It has one legal
learner, Cinderace (Blaze / Libero). The existing fixture uses it.

The probe re-derives these facts on every run and prints them.

## 2. What changed in `tests/probe_court_change.js`

A new section 0 runs before the cast is built. It calls `engine/legal_scope.js` `derive().verdict('move', 'courtchange')`,
which is the single scope implementation.

- **Out of scope** prints `NOT-IN-REGULATION` and asserts three things:
  - (a) The scope verdict is out. Under Reg M-B it is `NOT-LEGAL`, which is `verdict`'s fallback for an entity the format does
    not list at all. The three `OUT_CODES` are also accepted.
  - (b) `isNonstandard` is truthy, and 0 legal species learn the move.
  - (c) Validator control. Venusaur, the first legal body that passes `champions_sim.checkLegal` with Protect alone, is
    ACCEPTED. The same body with Protect + Court Change is REFUSED, and the refusal is an EXISTENCE problem
    (`classify` → `banned`) naming the move: *"Venusaur's move Court Change does not exist in Gen 9."*
  - Then the probe calls `K.finish()`: exit 0 on green, exit 1 on any red.
- **In scope, but no quiet-ability learner**: this was exit 2 and is now a RED assertion (exit 1). `legal_scope` guarantees
  that a learner exists, so an empty cast is a fixture failure to fix, never a verdict about the regulation.

## 3. RED on a deliberate break (before trusting it)

The break: in the arm, `'Court Change'` was replaced with `'Tailwind'`, a real move that Venusaur cannot learn. The
validator still refuses that set, but only with a PAIRING problem. The probe went RED, exit 1:
`RED ARM — ... refused as an EXISTENCE problem naming the move / Venusaur can't learn Tailwind.`
This shows the check cannot pass on just any refusal. The file was then restored.

There was also an unintended red before that. The first version accepted only `OUT_CODES`, but the real verdict is `NOT-LEGAL`
(exit 1). Fixed by also accepting `NOT-LEGAL`, which is legal_scope's own answer for a non-listed entity.

## 4. Runs (worktree, release cut locally for the run, not for measurement)

| run | exit |
|---|---|
| Reg M-B, before (`main` bytes) | 2 (booked as COULD-NOT-STAGE) |
| Reg M-B, after | **0**: 4 green (scope NOT-LEGAL, Past + 0/264 learners, control accepted, arm existence-refused) |
| Reg M-B, deliberate break | **1** |
| Reg M-C, after | **0**: section 0 reads `IN LEARNED`, the cinderace/sylveon/corviknight cast is unchanged, every assertion is green |
| Reg M-C, `MEDI_COURT_CHANGE_UNMODELLED=1` | **1** (3 red), unchanged |

The runs used releases `7822a83cc49b` (M-B) and `ec377f6f8159` (M-C). Both were cut in this worktree only because
`data/releases/89ac57f1f81b` is not present here. The tracked `data/engine-release.json` was restored afterwards. The
untracked `data/engine-release-regmc.json` that the cut wrote was left in place and is not committed.

The probe ran as plain `node`. It is a two-game scripted probe, and the worktree sandbox refused `cmd.exe /c tools\lownode.cmd`.

## 5. How the gate should count it

**Not at all. It is out of scope, not COULD-NOT-STAGE.**
- No gate reads probe exit codes. `engine/quarantine.js` has no reference to `probe_court_change`. The only place it was
  counted is the pass-10 report prose ("Treat it as COULD-NOT-STAGE").
- The gate's COULD-NOT-STAGE clause is `rosterStage`, and it has three buckets (quarantine.js ~L850). The rule there:
  *OUT OF SCOPE (no legal carrier, validator-refused, no legal reader) → not counted at all* (Will, 2026-09-09: "the
  abilities not tested are not in the game"). The Reg M-B roster moves artifact (`data/roster.moves.json`) holds no
  `courtchange` row. Only the Reg M-C one does, where it reads `FIRED-AND-BOARDS-MATCH`.
- So in the owed gate re-read, the `node tests/probe_court_change.js --regulation regmb` line becomes a regression check
  that should read exit 0. It contributes nothing to any clause.

## 6. Not done

- `node engine/status.js --write` was not run. It corrupts when run from a worktree (memory: status-write-corrupts-from-a-worktree),
  so it belongs to whoever merges.
- The Reg M-B check ran on a release cut in this worktree. After the merge, re-run it in main on the gate re-read's fresh release.
