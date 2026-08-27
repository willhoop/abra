# The two open-sheet stores were never judged. They are clean.

2026-08-27 — MEASURE. Instrument: `engine/validate_store.js`. Artifact: `data/store-validation.json`
(`generated 2026-08-27T06:19:40.063Z`).

Historical findings record. Not current state, never maintained, superseded by the register rows it
feeds. Read `node engine/status.js` and `node engine/open_work.js` for state.

---

## VERDICT

**Open-sheet contamination is ZERO.** Judged against the DECLARED team — the full six a Force-OTS
room publishes at team preview — `data/games.bo3.jsonl` flags **0 of 20,713** games and
`data/games.ots.jsonl` flags **0 of 4,167**. No species, no item, no move, no ability. Confirmed by a
second ruler that shares no code with the first.

**A species-and-item filter would remove nothing from either.** Raw 0, clean 0. There is no
enrichment factor to quote because the numerator is zero on both sides of the ratio.

**MAG's fitting corpus does not move by one game.** `fit_policy.loadCorpus()` scope `fit` is
`games.bo3.jsonl` alone and returns **13,711 clean games** today. The legality rule removes **0** of
them. The coverage gap `data/quality-filter.json` named in its own `known_limitation` is real and
costs nothing.

**The Illusion ratio does NOT hold on open sheets, and the reason is not the one the brief expected.**
Ladder move-only rejections are 86.8% Illusion (1,020 of 1,175). On bo3 it is **9.05%** (20 of 221)
and on ots **0.0%** (0 of 46). The disguise is not more visible on an open sheet; the open-sheet move
class is **a completely different population** — 90.5% of it is our own duplicated-move storage
artefact and the rest is mega-forme keys.

**Which is the real finding, and it is bigger than the legality question.** `g.sets` on an open-sheet
game merges the SHEET's move spelling with the LOG's move spelling without normalising, so
**32.12% of bo3's revealed sets (84,761 of 263,859) list the same move twice**, in **97.96% of its
games**. That is the corpus MAG is fitted on.

---

## 1. Coverage: what is now judged

Two rulers, run over the same bytes in one pass so the store cannot move between them.

- **REVEALED** — judge `g.sets`, what the battle exposed. All a closed-sheet game can offer. A partial
  set means the validator was never shown enough to object, so a clean verdict is weak evidence.
- **DECLARED** — judge `g.sheets`, the declared six. Four moves, ability and item on the declared
  species. A rejection is a fact about the TEAM rather than about what got revealed.

| store | lines | REVEALED judged | flagged | DECLARED judged | flagged |
|---|---|---|---|---|---|
| `games.ladder.jsonl` | 67,384 | 66,780 (604 revealed no set) | 1,252 — 1.858% of 67,384 | 1,432 (65,952 no sheet) | 40 — 2.793% |
| `games.bo3.jsonl` | 20,795 | 20,795 | 221 — 1.063% | 20,713 (82 no sheet) | **0 — 0.000%** |
| `games.ots.jsonl` | 4,167 | 4,167 | 46 — 1.104% | 4,167 | **0 — 0.000%** |

Never pooled. `engine/ingest_ots.js` refuses to pool the two open-sheet sources and that refusal is
respected here; every rate is against its own named denominator. 0 unreadable lines in all three.

A game with no sheet is **skipped by the DECLARED ruler and counted**, never quietly handed to the
other one. Mixing two rulers inside one number is the shape of every instrument failure this project
has paid for, and the selftest asserts the skip.

---

## 2. The open-sheet stores are clean — and a second ruler says so

The second ruler shares no code with `validate_store.js`: no `TeamValidator`, no `classify()`, no
`reasonClass()`, no `readLines()`. It walks `Dex.forFormat` directly (filtered: 347 legal species,
148 legal items, 500 legal moves) over every declared set.

| | bo3 | ots |
|---|---|---|
| declared sets walked | 248,556 | 50,004 |
| out-of-format declared **items** | **0** | **0** |
| out-of-format declared **moves** | **0** | **0** |
| out-of-format declared **species** | 4 games — **its own false positive, see below** | **0** |

**THE SECOND RULER WAS THE ONE THAT WAS WRONG, WHICH IS WHY IT IS RUN.** It flagged `florges-blue`
(1 game) and `alcremie-salted-cream` (3). Both are COSMETIC FORMES: `isNonstandard: null`, `tier: UU`,
listed in the base species' own `cosmeticFormes`, and byte-identical to the base in stats, types and
abilities. `D.species.all()` does not enumerate a cosmetic forme, so a set-membership test built from
that walk misses it while `D.species.get()` resolves it. The TeamValidator resolves it too, which is
why the tool said 0. **Tool right, second ruler wrong, and the disagreement is what surfaced it** —
this is the eighteenth instrument failure in three days and the first one caught before it was
reported.

---

## 3. The Illusion ratio, and what the open-sheet move class actually is

| | move-only games | Illusion carrier same side | share |
|---|---|---|---|
| ladder REVEALED | 1,175 | 1,020 | **86.8%** |
| bo3 REVEALED | 221 | 20 | **9.05%** |
| ots REVEALED | 46 | 0 | **0.0%** |
| bo3 DECLARED | 0 | 0 | — |
| ots DECLARED | 0 | 0 | — |

The ratio collapses. It does not collapse because the sheet exposes the disguise. It collapses because
the open-sheet move class is not made of the same thing. Complaints, by phrasing:

| family | ladder | bo3 | ots |
|---|---|---|---|
| `X has multiple copies of Y` | 15 of 1,697 — **0.9%** | 200 of 221 — **90.5%** | 43 of 46 — **93.5%** |
| `<megaforme> can't learn Y` | 28 (of 500 sampled rows) | 19 | 3 |
| other `can't learn` | 489 (of 500 sampled rows) | 2 | 0 |

Checked against the declared sheet of the same game:

- **duplicated-move complaints — the duplicate is OURS.** 199 of 200 on bo3 and 42 of 43 on ots name a
  move the declared sheet lists **exactly once**. It is in our revealed set and not in anybody's team.
- **mega-forme-key complaints — the base is on the sheet.** 19 of 19 on bo3 and 3 of 3 on ots. The
  player declared `absol`; the replay revealed `absolmega`, a body that only exists after a mega, and
  its learnset row rejects the base's moves. This is the same family as the `can't have <Ability>`
  rows the `OBSERVED` list already forgives — the ABILITY phrasing is forgiven and the MOVE phrasing
  is not.
- **the 2 leftovers on bo3** sit in games with no sheet at all (2 of the 82).

So **219 of bo3's 221 flags and 46 of ots's 46 are our own storage conventions**, not contamination
and not Illusion.

---

## 4. THE DEFECT THIS TURNED UP: `g.sets` duplicates every declared-and-clicked move

One game, printed rather than described — `gen9championsvgc2026regmbbo3-2653849509`:

```
revealed  g.sets.kangaskhan.moves = ["FakeOut","LastResort","Fake Out","Last Resort"]
declared  g.sheets.p2 kangaskhan  = ["FakeOut","LastResort"]
```

The same two moves in two spellings: the sheet's CamelCase and the log's spaced form, merged without
normalising. It has nothing to do with Parental Bond, which was the first guess and was wrong.

Scale:

| store | sets repeating a move id | games affected | sets with >4 revealed moves |
|---|---|---|---|
| `games.bo3.jsonl` | 84,761 / 263,859 — **32.12%** | 20,370 / 20,795 — **97.96%** | 90,531 |
| `games.ots.jsonl` | 16,695 / 52,964 — **31.52%** | 4,135 / 4,167 — **99.23%** | 17,950 |
| `games.ladder.jsonl` | 5,753 / 591,457 — 0.97% | 1,410 / 67,384 — 2.09% | 7,545 |

**The control is exact.** Of the ladder's 1,410 affected games, **1,410 carry a sheet and 0 do not**,
against 1,432 sheeted games in the store. The defect is caused by the sheet-merge path and by nothing
else — a closed-sheet game never shows it.

A Pokemon has four moves. 90,531 bo3 sets carry more than four, up to thirteen. Any consumer reading
`g.sets[x].moves` on an open-sheet game is reading a list that is up to twice as long as the team, in
two spellings. **Not fixed here** — `engine/durable-ingest.js` is ENGINE's and the store stays raw.
Filed as ROADMAP #473.

---

## 5. False positives: what the full declaration does to the species-and-item class

The 1,432 ladder games with sheets are the only place both rulers can run on the same game, so they
are the only place the revealed ruler can be audited.

```
  REVEALED species-or-declared-item flags on those games : 40
  DECLARED species-or-declared-item flags on those games : 40
  intersection                                           : 40
  revealed-flagged, declared-clean (false positive)      : 0
  declared-flagged, revealed-clean (false negative)      : 0
```

**Zero disagreements in either direction, 1,432 paired games.** Rule of three puts the upper 95% bound
on the revealed ruler's species-and-item false-positive rate at about **0.21%** — on the 77 ladder
games the filter currently removes, that is an expected zero to one wrongly removed. The class was
already the one chosen because a legal team cannot produce it; this is the first time anything
measured that against a declaration.

**The item false-positive path behaves differently on open sheets, and it disappears.**

| | declared-item complaints | forme-requirement complaints |
|---|---|---|
| ladder REVEALED | 54 | 18 |
| ladder DECLARED | 8 | **0** |
| bo3 / ots, both rulers | 0 | 0 |

The `needs to hold <X> to be in its <Y> forme` shape fires because a replay revealed a forme and never
revealed the item — our closed-sheet storage convention. Given a declaration, the item is on the
sheet and the complaint cannot arise. It cost zero games on the ladder and it costs zero on open
sheets, for a different and better reason.

**Where the ladder's contamination actually lives.** 40 of the 77 species/item-flagged ladder games —
**51.9%** — sit inside the 1,432 sheeted games, which are **2.13%** of the store. A **24.4x**
concentration. Custom-rules rooms tend to publish team sheets, so the ladder slice that opts into
Open Team Sheets is the dirtiest slice of the ladder. That does not transfer to bo3 or ots, where
sheets are forced by the ruleset and carry no self-selection.

---

## 6. What this does to the corpus MAG is fitted on

`engine/fit_policy.js` `SCOPES.fit` is `games.bo3.jsonl` alone, through `engine/quality.js`.
Measured today, read-only, nothing refitted and no weight touched:

```
  clean bo3 corpus                        13,711 games
  rejected: partial_bring                  6,342
            short                          1,253
            illusion_closeted                576
            forfeit_no_action                123
            bot                               62
            behavioural_bot                   57
  species-and-item filter would remove         0
```

**Zero.** `exclude_illegal_teams` extended to bo3 is a confirmed no-op, and it is a no-op because
there is nothing there to remove rather than because it is unwired. The 49 games it removes from the
clean ladder corpus have no counterpart here.

Two things worth saying beside that zero:

1. **The Illusion population is already gone from the fit** by a different rule — `illusion_closeted`
   drops 576 bo3 games because the protocol names the disguise and not the mover. So the argument for
   never keying on the move class is doubly safe on this corpus.
2. **The fitting corpus has a real defect and it is not a legality one.** 32.12% of its revealed sets
   carry a duplicated move id (section 4). Whether that reaches MAG's features is ENGINE's and
   SEARCH's question, not answered here.

MAG is Will's and is under a declared pause. Nothing was refitted.

---

## 7. Instrument discipline

**Selftest 24 -> 43 assertions, 0 failed.** The 24 classifier, class and subject cases are unchanged.
The 19 new ones assert: a rejected and an accepted `(species, move)` pair exist in this format (the
fixture is DERIVED from `Dex.forFormat` on every run, never typed); the DECLARED ruler returns no
input on a game with no sheet and on an empty sheets object — it SKIPS rather than falling back; one
entry per sheet mon; side attribution for a one-sided sheet and for a species both players declared;
the REVEALED ruler's entry count and its side recovery from `six`/`brought`; end to end, that DECLARED
does not flag a sheet the validator accepts and does flag one whose declared move the species cannot
learn; that the Illusion screen reports no carrier when none is on the sheet **and flips to
carrier-on-the-same-side when Zoroark is added to the same sheet** (the knob-cleared control — an
unwired screen gives identical output on a varied input); that `readLines` keeps a final line with no
trailing newline and does not mangle a multi-byte character; and that the declared-item pattern was
actually READ from `data/quality-filter.json` rather than typed here.

**Shown RED on a deliberate break first.** Making the DECLARED ruler fall back to REVEALED when a
sheet is missing gives `42 passed of 43, 1 failed`, **exit 1**. Restored: `43 of 43`, **exit 0**.

**A NUMBER MOVED AND WAS CAUGHT BEFORE IT WAS PUBLISHED.** The refactor redefined `judged.games` from
lines-parsed to games-with-a-revealed-set — 67,384 -> 66,780 — which moved the published headline rate
**1.858% -> 1.875% with no measurement behind it**, and would have put `data/store-validation.json`
and `data/quality-filter.json` (`measured.judged_games: 67384`) into disagreement about the size of
the same store. The old meaning is restored exactly; the new denominator is published beside it as
`judged.games_with_revealed_sets` (66,780) and `judged.games_with_no_revealed_set` (604).

**No ladder number moved.** Compared key by key against the 05:14:06.849Z artifact:
`judged.games`, `judged.revealed_sets`, `judged.unreadable_lines`, `flagged_games`, `by_reason`,
`split.by_class_games`, `split.by_class_sets`, `split.combos`,
`split.species_keyed_filter_would_remove`, `split.move_only_games`,
`split.move_only_with_illusion_carrier_same_side`, `split.move_only_with_no_illusion_carrier_in_game`,
`split.illusion_carriers_derived`, `split.species_offenders`, `split.species_flagged_ids` and
`examples` are all **identical**. The stamp moved (05:14:06.849Z -> 06:19:40.063Z) and the artifact
grew 123 KB -> 323 KB. The store was byte-stable throughout: 67,384 / 20,795 / 4,167 lines before and
after, last appended 2026-08-27 00:04 local against a 02:04 run.

**The reader was not broken.** `data/store-validation.json` gains three top-level keys (`rulers`,
`stores`, `known_limitations`), three `judged` keys and three `split` keys. `engine/quality.js`
reads none of them. `node tests/test-quality.js`: **32 passed, 0 failed**, having read the NEW verdict
(`the legality verdict was read (2026-08-27T06:19:40.063Z)`), `77 resolved + 0 forme-only = 77
expected (unresolved 0)`, clean ladder **18,859** unchanged, JS == Python, sha `48a0ddfb104e7338`.

`split.item_flagged_ids` and `split.species_or_declared_item_flagged_ids` are now published because
`engine/quality.js` names the first of them in its own shortfall message. It does not read them, so
adding them changes no corpus today; it removes the reason the shortfall could ever exist.

---

## KNOWN LIMITATIONS, CARRIED

- **`engine/format_drift.js` has never existed.** `validate_store.js`'s header cites it as the thing
  that separates a contaminated game from a stale rulebook. Nothing distinguishes those two, on any
  store. Every verdict in `data/store-validation.json` is the union of "played under custom rules" and
  "our Showdown checkout is behind the regulation". Now stated inside the artifact itself, under
  `known_limitations.no_drift_detector`, so a reader cannot get the number without the caveat.
  **This matters less on the open-sheet stores than anywhere else**, because their verdict is zero —
  a drift detector can only turn a positive into a false positive, and there are no positives.
- **The ingest workflow never re-runs `validate_store.js`.** OPS appends to `games.ladder.jsonl` and
  `games.bo3.jsonl` hourly, so this verdict decays from the moment it is written. `judged.games` and
  every `stores.*.judged_games` are the denominators actually examined; anything appended since has
  not been judged at all. **The cron is not wired here — that is a scheduling decision, not a
  measurement one.**
- **Sets are validated one at a time**, so the classifier means the same thing under both rulers.
  Team-level clauses — Species Clause, Item Clause, any team-size rule — are therefore NOT checked
  even where a full declared six is available. See OWED.
- **82 bo3 games carry no sheet** and are judged by the REVEALED ruler only. 65,952 ladder games
  likewise. Counted and printed, never silently merged.

---

## OWED, NOT RUN

- **WHOLE-TEAM VALIDATION ON THE OPEN-SHEET STORES.** Every number here comes from validating one mon
  at a time, deliberately, so the classifier is comparable across rulers. That leaves the team-level
  clauses unasked on 20,713 + 4,167 games where the full declared six is sitting right there — Species
  Clause, Item Clause, and whatever else `gen9championsvgc2026regmb` carries as a ruleset. It is a
  different question with a different answer shape and it needs its own classifier cases.
- **THE DUPLICATED-MOVE DEFECT IS FILED, NOT FIXED.** ROADMAP #473. `engine/durable-ingest.js` is
  ENGINE's and the raw store stays raw; the repair is in the reveal path, not a rewrite of the store.
  Until it lands, no measurement may read `g.sets[x].moves` on an open-sheet game as a moveset.
- **WHETHER THE DUPLICATE REACHES MAG'S FEATURES.** 32.12% of the fitting corpus's revealed sets are
  affected and this pass did not open `engine/fit_policy.js`'s feature path to find out. SEARCH's, and
  it is downstream of the fix.
- **THE MEGA-FORME MOVE ROWS ARE NOT FORGIVEN.** The `OBSERVED` list forgives `can't have <Ability>`
  on a post-mega body and does not forgive `can't learn <Move>` on the same body, which is why 19 bo3
  and 3 ots games carry a move flag that no filter keys on. Adding the rule would be correct and it
  changes a published class count, so it is a separate pass with its own before/after.
- **THE CRON.** Nothing re-runs this tool. Not wired here.
- **`engine/format_drift.js`.** Still does not exist.
- **THE FILTER DECISION IS WILL'S.** `data/quality-filter.json` and `engine/quality.js` are untouched.
  Extending `exclude_illegal_teams` to bo3 and ots would remove **0** games, so there is nothing to
  decide today; the value of doing it is that the rule stops being a no-op by accident and starts
  being a no-op on the record.
- **`docs/MEASURE.md` LEDGER ROW.** Not written — `engine/status.js --write` was out of scope for this
  pass and the generated blocks may not be hand-edited.
