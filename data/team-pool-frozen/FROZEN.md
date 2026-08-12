# The team pool, frozen — 2026-08-12

Will: *"freeze the team pool while we are building this"*.

## Why

`engine/game_differential.js` goes to considerable lengths to be a photograph: it opens a frozen
engine release, and it pins every die identically on both engines so any difference is a rule bug.
**It then took its SAMPLE from a file that moves underneath it.** `engine/diff_swarm.js` reads
`data/games.bo3.jsonl` and `data/games.ots.jsonl` LIVE, dedupes to distinct teams, and picks by a
STRIDE over the matching set — so one appended game shifts the stride and changes which teams get
played. OPS appends to both continuously.

That is why three runs of the same instrument reported three different denominators — 1,556 then
1,213 then 983 — and why every figure has had to be quoted as a rate rather than a count.

It has cost a run before. `diff_swarm.js` records it: on 2026-08-07 the corpus went 7,454 → 7,509
teams *between arm 3 and arm 4* of a fourteen-arm ladder, the pool digest moved, and the first three
rungs were sampling a different population from the rest.

## What is frozen

| file | lines | bytes | sha256 (12) |
|---|---|---|---|
| `games.bo3.jsonl` | 13,214 | 109,006,606 | `5e10d7ba991f` |
| `games.ots.jsonl` | 4,167 | 31,928,037 | `cd21077a4578` |

## How to use it

```bash
node engine/game_differential.js --release <id> --team-store data/team-pool-frozen --games 1200 --write
```

The artifact then stamps `team_store_pinned_to`, so a reader can tell a pinned run from a live one
rather than guessing. **A run without this flag is not comparable to one with it**, and neither is
comparable to a run taken at a different moment of the live store.

## When it comes off

This is frozen *for the spread work* — filling in the blank `evs` and spacing speeds so no tie can
fire changes every body in the sample, and a moving sample would make the before/after meaningless.
It should stay pinned until that lands and a new bar is stamped, and then it is a judgement whether
to re-freeze at a fresh corpus or go back to live. **Going back to live silently is the failure this
directory exists to prevent** — it would not look like anything.

*Nothing here is generated. It is a copy, taken deliberately, and the digests above are what make it
checkable rather than assumed.*
