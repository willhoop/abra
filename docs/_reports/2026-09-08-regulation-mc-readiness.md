# REGULATION M-C READINESS — what goes quiet when the ladder moves

**Will, 2026-09-08: M-C expected tonight — ~6 new megas, ~24 new species, probably new items; playable
on Showdown in a few days.** A regulation change is about WHAT IS LEGAL, not how the game works, so the
mechanics work is unaffected. **This report is only about the seams.**

Read-only OPS diagnosis. Nothing was edited. Every claim carries a file and line.
*(Written up by the coordinator because OPS has no Write tool — my brief asked for a file from an agent
that cannot produce one.)*

---

## THE RANKING — loud is fine, silent is the finding

**LOUD, and therefore fine:** the `::warning::A NEW CHAMPIONS VGC REGULATION IS LIVE` line and the
committed `data/next-regulation.json`; the `collectable_not_simulatable` counter; a `verify()` failure on
the two paths that call it.

**SILENT, worst first:**

1. **`data/meta-usage.json` pools M-B and M-C under an M-C label — and CHOMP reads it.**
   `engine/analyze.js:105` writes `format: ACTIVE_FORMAT` as a LABEL. `:23` calls `Q.loadGames()` and
   **never filters `g.format`**. `engine/quality.js` contains no format logic at all — its only two
   matches are prose comments. So the moment `active` flips, M-C rows pool onto ~79k M-B rows and the
   result is stamped `regmc`. **The segmentation key already exists in every row and nothing reads it:**
   `engine/durable-ingest.js:460-464` derives `champions-reg<token>` from the `|tier|` line, added
   2026-08-31 precisely so a rotation would be visible, and only `build/triggers.js:83` consumes it.

2. **Six new megas get no engine row, and the audit is aligned not to see it.**
   `engine/merge_mega_into_engine.js:105` — `if (!f.in_our_store && !MC.mons[key]) { skipped++; continue; }`.
   A new M-C mega has no games in an M-B store and no existing row, so it is **skipped into an anonymous
   counter**. No row → `buildMon` returns null on `!m.bs` → **every damage-derived feature reads zero**,
   which is the 2026-07-30 consequence exactly. `engine/artifact_audit.js:152-157` mirrors that same
   predicate BY DESIGN ("kept in step with merge_mega_into_engine.js"), so **the audit excludes exactly
   the rows the builder skipped**, and none of its checks A–G asks the format whether a legal `megaStone`
   has no row at all. The 2026-07-30 KEY mismatch is genuinely fixed (`:55-58` normalises both sides);
   this is a different door into the same room.

3. **`data/games.ladder.jsonl` stops growing at exit 0, with the shrink guard green.**
   The ingest is correctly DERIVED — `durable-ingest.js:15-23` reads `data/regulations.json`, and
   `next_regulation.js:79` recognises regulations by SHAPE, not id — but it collects the ACTIVE regulation
   only. When the M-B ladder empties the search endpoint keeps offering its rolling ~1,250 stale ids, so
   `idsSeen` is never 0 and **the ZERO-GAIN guard at `:643` cannot fire**. Flow is `newIds===0` → `:654` →
   exit 0. **A quiet ladder and a dead ladder are distinguishable; a quiet ladder and a ROTATED one are
   not.** The shrink guard (`ingest.yml:149-192`) checks monotonicity, so a store frozen at 79,363 passes
   cleanly.
   **And the rotation alarm is structurally dead until someone acts:** `build/triggers.js:78-96` needs a
   non-baseline format at ≥5% of the last 2,000 rows OF `games.ladder.jsonl`, which cannot happen until
   `active` is flipped. `next_regulation.js:12-14` says so itself — *"the alarm is downstream of the
   hole."* The one real signal is an Actions annotation on a `continue-on-error: true` step.

4. **`build/build_browser_data.js --check` passes against a stale M-B `mega-formes.js`.**
   `:67` builds the stone→forme map off a hardcoded M-B id with no fallback, and `--check` (`:45`) compares
   disk against *what the script would write today* — also M-B. **A green test asking nothing.**

5. **The oracle pin goes from verified to UNKNOWN.** `actualCommit()` (`next_regulation.js:136-145`) shells
   `git rev-parse HEAD`; an npm install has no `.git`, so it returns null and `commit_matches` (`:161`)
   becomes `null` — documented as UNKNOWN, **never `false`. The check does not fail; it stops asking.**
   Meanwhile `derive_protocol_events.js:340` and `game_differential.js:2390` keep stamping
   `CS.PINNED_COMMIT`, a constant. **Under npm that field must become a VERSION read from the installed
   package.** Note `sim/package.json:11` currently reads `"^0.11.9"` — **a caret range is not a pin.**

6. **The census does not move, and reads as "nothing broke".** `data/mechanics-census.json` is written by
   ~294 hand-staged probes (`tests/staged_board.js:12`) — a LAB, not a walk. `engine/steering.js:61` steers
   `game_differential.js` off it, so after M-C **the differential keeps aiming at M-B mechanics.**

---

## WHAT IS ALREADY RIGHT

- **The ingest is derived, and well built.** `next_regulation_ingest.js` (`ingest.yml:211-213`) collects a
  new regulation into `data/games.<formatid>.jsonl` **from day one, with no edit.**
- **Every dex walk that matters is filtered** and will pick up 24 species, 6 megas and new items with no
  edit: `tag_dex.js:130`, `tests/roster.js:199` plus `:364, :409, :542, :686, :910, :915` — `:910` walks
  `items.all()` for `megaStone`, so new megas enter the roster on their own — `build_engine_data.js:146`,
  `merge_mega_into_engine.js:81`.
- **`artifact_audit.js` IS a live gate** (`tests/run-all.js:85`). Its blind spot is the predicate, not the
  wiring.
- **A recovery path exists:** `build/archive-regulation.js`, fired by `build/triggers.js:114-128`, snapshots
  M-B before it is diluted.

## HARDCODED FORMAT IDS THAT WILL SIMPLY STOP BEING TRUE

`build/build_browser_data.js:67` (writes two FROZEN engine sources) · `engine/derive_switch_carry.js:33,:94`
(writes a frozen engine source) · `engine/fixture_preflight.js:37` · `engine/mega_harvest.js:39` (keeps
harvesting M-B replays).

**Legitimately pinned to M-B history — DO NOT TOUCH:** `data/team-pool-frozen/` (its `FROZEN.md` is explicit
that going back to live *"would not look like anything"*), `data/archive/regmb/`, and the seed ids and
measured reference numbers inside `tests/test-mechanics.js`, `engine/medicham2-browser.js` and
`tests/roster.js` — **those cite what was measured, and rewriting them would be editing the record.**

## THE PROCESS NOTE, WHICH IS THE REAL RISK

**Flipping `active` in `data/regulations.json` is ONE edit that simultaneously** re-points the ladder
collector, re-labels `meta-usage.json`, re-points `CS.FORMAT` for both live bots, and re-points the
simulator at a format the pinned oracle may not have. **Nothing sequences those.**
`next_regulation.js:302-303` deliberately leaves the flip to a person — correctly — **but there is no
checklist gating what must happen in the same pass.**

## ONE THING NOT SETTLED, AND IT IS ONE COMMAND

**What does `Dex.forFormat()` return for an unknown format id?** It may throw, or hand back a generic gen-9
dex. **Those are opposite outcomes — loud versus catastrophic.** `verify()` is called from only two places
(`mew.js:589`, `validate_selfplay.js:392`); `mag_bot.js`, `showdown_bot.js`, `tag_dex.js`, `roster.js`,
`merge_mega_into_engine.js` and `build_engine_data.js` all call `Dex.forFormat(FORMAT)` with **no existence
check.**
