# DIVISIONS — where a piece of work belongs

The divisions are the table below, and `node engine/orient.js` derives the live list from
`.claude/agents/` — **do not type a count here.** This line read *"Four divisions"* from 2026-08-04,
when WEB was added, until 2026-08-23, and CLAUDE.md said "four" in three places over the same period.
The count is cosmetic; what it cost was not — the living-docs rule named four ledgers, so a WEB change
carried no documented obligation to record itself anywhere.

The cut is on the **invalidation graph**, not on subject matter, because what makes
a handoff expensive here is not how much there is to say — it is that any change might invalidate
anything else, so the whole project has to be described every time.

Do not cut by Pokémon domain ("a weather division", "a Protect division"). That runs across the
graph below and makes every change touch every division, which is the situation this replaces.

## The graph

```
  MEDICHAM  ──►  board.js  ──►  MAG weights  ──►  MILTANK baselines  ──►  live
  (engine)       (features)     (the refit)       (every H2H result)

  MEW / SPRT / provenance / status  sit BESIDE all of it and invalidate nobody
```

It is one-way. That is the only reason dividing is worth doing — if ENGINE ever came to depend on a
SEARCH result, one big document would beat four small ones and this file should be deleted.

## The four

| Division | Owns | Its one number | Ledger |
|---|---|---|---|
| **ENGINE** | `medicham2-browser.js`, `abra-tags`, `tests/test-mechanics.js`, `tests/walk_tags.js`, `tests/test-engine-diff.js` | mechanics live (must never go down) | [ENGINE.md](ENGINE.md) |
| **MEASURE** | `mew.js`, `sprt.js`, `provenance.js`, `status.js`, `backtest_winrate.js`, the noise floor, the stamps | leaf calibration | [MEASURE.md](MEASURE.md) |
| **SEARCH** | `miltank.js` — bring/lead, opponent model, mega choice, post-KO replacement | SPRT verdict vs the named champion | [SEARCH.md](SEARCH.md) |
| **OPS** | `mag_bot.js`, Showdown, OTS/replays, ingest, the team pool | store usable %, battles recorded | [OPS.md](OPS.md) |
| **WEB** | `web/` — ABRA WORLD and every room in it | every rendered figure traces to an artifact | [WEB.md](WEB.md) |

**MAG is not a division — it is the seam.** It consumes ENGINE and feeds SEARCH, and its refit is
the expensive event on the one expensive edge. The refit therefore belongs to MEASURE, whose whole
job is knowing when a number stopped being true.

## Routing a bug: one question

> **Which artifact does fixing this invalidate?**

- The damage table → **ENGINE**
- A measurement claim, a stamp, a corpus → **MEASURE**
- What gets clicked, but not what is true → **SEARCH**
- Nothing → **OPS**

A bug that cannot be routed does not get held. It gets a division or it gets closed.

## The two rules that make the division real

### 1. SEARCH plays a frozen, named engine release — never HEAD

ENGINE batches fixes and cuts a release. Cutting the release is what triggers the refit and the
seven restamps. Between releases, SEARCH's baselines are frozen and valid, and ENGINE can land
twenty mechanics fixes without invalidating a running H2H.

This is not theoretical. `node engine/status.js` currently prints every R4 run as `PRE-CHANGE`:
the engine source moved after the games were played, so the headline result of 2026-08-04 already
describes a build that no longer exists.

It also fixes the schedule. ENGINE's work — tag probes, differential tests — is single-process and
cheap. SEARCH and MEASURE eat the 6-process budget. Under a release boundary those genuinely run
side by side; without one they collide.

### 2. If you trip over another division's bug, you file it — you do not fix it

Patching a mechanics bug in the middle of an H2H silently invalidates your own run, and the run
will not tell you. This is Lesson 1 wearing a different hat: the result still prints.

## What this costs

A division boundary is a new place for a **silent default** to live — a division working from a
stale artifact looks exactly like a division working. Two mitigations, both already built:

- `engine/provenance.js` checks artifact-against-artifact and is the authority on staleness.
- `engine/status.js` checks the edge provenance structurally cannot see — engine SOURCE against
  fitted weights — and prints `REFIT OWED`. It is mtime-based and says so.

Neither can catch an artifact that records a corpus it did not use. Only re-running the generator
can, and that is the generator's job.

## One agent per division

`.claude/agents/{engine,measure,search,ops,web}.md`. Each loads CLAUDE.md plus its own ledger and
nothing else, so it cannot reason wrongly about a part of the project it was never shown.

**WEB was added 2026-08-04, and the reason is worth recording** because it tests whether the cut
above is real. `web/` had no owner: ENGINE, MEASURE, SEARCH and OPS are all cuts on the model's
invalidation graph, and a website is not on that graph. So site work kept falling back to whoever
was holding it. WEB is the **leaf** — everything flows into it and nothing flows out — which is
exactly why it can be given hands on its own files and none anywhere else, and why its one
restriction is not about tools but about authority: it renders numbers and never authors one.

The point is not that an agent is an expert — it is a fresh context holding the right slice. What
the split actually buys is that the **may-not column becomes a tool restriction instead of a
sentence somebody might ignore**:

| Agent | Hands | The restriction that matters |
|---|---|---|
| `engine` | full | may not touch board.js / magnemite.js / engine-data.js, may not run a fit or self-play |
| `measure` | full | must ask before starting a refit — it is expensive and Will may be at the keyboard |
| `search` | full | prepares H2H runs and hands over the command; does not launch wide runs itself |
| `ops` | **read-only** | no Bash, no Write, no Edit — a mistake here forfeits a real game |
| `web` | full, inside `web/` only | **may not author a number** — every figure traces to an artifact or renders as NOT MEASURED |

**This is not parallelism.** Six processes is the cap and RAM is the real ceiling. ENGINE's work is
single-process and genuinely runs alongside a long SEARCH job; two search agents do not. The win is
clean scope and a small context, not throughput.

## The handoff

There is no longer a handoff document to write.

```bash
node engine/status.js
```

That output is the handoff. `--write` also stamps it into the four ledgers. The rules live in
CLAUDE.md and do not change; the lessons live in `docs/LESSONS.md` and are written once.

The `HANDOFF-*.md` files are history now, not state. Most of them moved to `docs/archive/` on
2026-08-05, each carrying a header saying what it claimed, what replaced it, and which of its figures
are retracted; `docs/archive/INDEX.md` is generated from those headers by
`build/build_archive_index.js`. Read one for narrative if you want it, but do not take a number out
of it — the 2026-08-04 handoff says "172 tags, 118 unprobed" and the artifact says 176 and 123.
Nobody mistyped anything. Prose cannot track a corpus.

**Archiving does not launder a document.** `tests/test-docs-current.js` scans `docs/archive/` exactly
as it scans a live document unless the file declares a named replacement, and the sixteen archived on
2026-08-05 deliberately declare none — so a retracted figure inside one is still caught.
