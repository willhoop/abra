# 2026-08-25 — The three roster stages, re-run so their counts are quotable again

**Filed by the coordinator.** The ENGINE agent's operating instructions forbid it writing report
files; its account is in `docs/ENGINE.md` and `docs/MEDICHAM-SPRINT-NOTES.md`. This file exists only
so `engine/orient.js` collects the OWED block — it scans `docs/_reports/` and nothing else, so
without this the next session is simply not told.

## VERDICT IN ONE PARAGRAPH

Commit `86fd1220` (the Illusion closet) landed from an INTERRUPTED run and said so, which made every
roster count unquotable — and the roster is an instrument three MEDICHAM gate clauses read. All three
stages were re-run on release `d38d117e68e9` (`list` reported 0 of 26 files moved, so the re-cut
appended an event and returned the same id — the same 26 files the interrupted pass read). **Every
count came back identical**, the closet prints, the shelf is unchanged, and the gate did not move.
Committed `eae7ae81`.

| stage | tested | DIFFER | DID-NOT-FIRE | neither-column | could-not-stage | deferred |
|---|---|---|---|---|---|---|
| items | 139 of 148 | 0 | 0 | 0 | 8 | 1 |
| abilities | 129 of 202 | 0 | 0 | 45 | 141 | 1 |
| moves | 475 of 500 | 0 | 0 | 0 | 22 | 3 |

Abilities also carries 114 OUT OF SCOPE (no legal carrier). Gate unmoved: whole-game 17 of 961,
census 706/706, `planted_divergence_proof_ok` true, `mechanics` clause still FAIL at 10 of 17.

## THE PART THAT MATTERED — THE ARM RECEIPT

This instrument has the worst record in the repo: it once asked for its pinned dice **by omission**
and rolled live ones for nine days — **169 accusations against the simulator, 162 of them the ruler**,
with moves reading 157 DIFFER against a truth of 5. So the arm was asked for BY ID and the receipt
checked rather than the label: `arms_played` reads items `{top-tie-first: 280}`, abilities
`{top 444, bottom 19}`, moves `{top 741, bottom 246}` — **zero on `middle`, zero on `DRIVER-DEFAULT`**.
Verified independently by the coordinator against the artifacts. Under `ROSTER_ARM_FALLS_THROUGH=1`
the same items stage reports `{DRIVER-DEFAULT:middle: 280}` and the pin test fails by name.

**The closet's announcement was never missing** — the code shipped in `86fd1220` and had simply never
been watched run. Abilities prints `illusion on Zoroark`; items and moves print *"none in this stage —
the shelf is live and matched nothing here"*. The empty case is a printed sentence, which is the point:
a silent empty closet reads exactly like a closet with no members.

**Measured rather than assumed:** items was played twice, against the live pool (90 of 11,331) and the
pinned one (87 of 8,778), returning identical `0/0/1/139/0/8`. The team pool does not reach a roster
result. The published run is the pinned one.

## NEW, NOT FIXED

`tests/roster.js:9352` — the artifact projection is an explicit whitelist and drops `closet` and
`underlying_verdict`, both of which `closetShelf()` computes. So a published row cannot say WHICH shelf
took it or WHAT it would have scored. `test-closet-scope.js` is not blind (it re-derives membership),
but this is the same sentence that file's own comment uses about `deferred` one field earlier.

## OWED, NOT RUN

```bash
# the per-RULE red demonstrations — only the arm-pin and closet-scope reds were re-run
node tests/roster.js --stage items     --release d38d117e68e9 --team-store data/team-pool-frozen --reds
node tests/roster.js --stage abilities --release d38d117e68e9 --team-store data/team-pool-frozen --reds
node tests/roster.js --stage moves     --release d38d117e68e9 --team-store data/team-pool-frozen --reds

# the mechanics clause's artifact was READ, not re-derived — this is what re-derives it
node engine/all_mechanics_fire.js --kind all --write

# the full suite, not run by this pass
node tests/run-all.js

# NOT run deliberately: tests/test-mechanics.js. No mechanic changed, and regenerating the census
# would move a digest that other artifacts pin.

# NEXT BATCH, not taken here: engine/game_differential.js drops 51 teams to the Illusion closet and
# data/game-differential.json carries NO `closet` key — an undeclared exclusion in the artifact the
# gate reads. Also: the roster's own artifact whitelist drops `closet`/`underlying_verdict`.
node -e "console.log(!!require('./data/game-differential.json').closet)"   # false today
```
