# The one game where both sides brought six — `gen9championsvgc2026regmb-2676161109`

Dated findings record. Historical by construction: not a living document, not maintained, not to be
cited as current state. Read-only investigation; nothing in the store, the engine or the tests was
modified, and no git command was run.

**Verdict: ANSWER 1 — corpus contamination.** The replay really shows six bodies per side, because the
battle was played under **12 custom rules**, two of which remove the pick-4 restriction outright. The
extractor is innocent: re-running `extract()` over the live replay reproduces the stored row
**byte for byte**.

---

## 1. What was fetched, and what it hashes to

| | |
|---|---|
| Replay id | `gen9championsvgc2026regmb-2676161109` |
| Fetched | 2026-09-21, `https://replay.pokemonshowdown.com/<id>.log` and `<id>.json` |
| `.json` `uploadtime` | `1788633927` |
| `.json` `format` | `[Gen 9 Champions] VGC 2026 Reg M-B` |
| `.json` `rating` | `null` |
| sha256 of the log | `fd4c808dc988c50e2308efe214e88a1ef256cef52be9818aaaead6c23d24e212` (identical from `.log` and from the `.json` `log` field) |
| sha256 of the stored row (`JSON.stringify`) | `60b26f313249b91411d265eb9f7cf79036da88554d1cdbf0b67fa003e4582f5b` |
| sha256 of `extract(id, 1788633927, log)` | `60b26f313249b91411d265eb9f7cf79036da88554d1cdbf0b67fa003e4582f5b` — **the same** |

The replay is public and was available. Everything below is quoted from that log or from a file in
this repository; nothing is recalled.

## 2. The cause, in three lines of the log

Line 10:

```
|rated|Tournament battle
```

Line 15 — the custom-rule infobox Showdown emits whenever a room deviates from the format:

```
|raw|<div class="infobox"><details class="readmore"><summary><strong>12 custom rules:</strong></summary> Evasion Moves Clause, Gravity Sleep Clause, Endless Battle Clause, !Open Team Sheets, !Timer Starting, !Timer Grace, !Timer Add Per Turn, !Timer Max Per Turn, !Timer Max First Turn, !Item Clause, !Picked Team Size, !Min Team Size</details></div>
```

A leading `!` in Showdown's custom-rule syntax **removes** the named rule. Two of the twelve are the
whole anomaly:

- `!Picked Team Size` — removes the pick-4 restriction, so a player brings everything they built.
- `!Min Team Size` — removes the floor that goes with it.

Lines 37–38 are the direct consequence, and they are the cleanest single-line signature in the whole
investigation:

```
|teamsize|p1|6
|teamsize|p2|6
```

Every ordinary Reg M-B ladder log in this repository's archive emits `|teamsize|p1|4` and
`|teamsize|p2|4` (measured below: 76,569 of 76,569 that emit the line at all).

Two further removals in the same list explain two other oddities of the row without any extra
hypothesis: `!Open Team Sheets` is why `openSheet` is `false` and `sheets` is `{p1:null,p2:null}`, and
`!Item Clause` removes the one-of-each-item limit that every normal log carries as
`|rule|Item Clause: Limit 1 of each item`.

The two players' avatars in the `|player|` lines are `#scl6gible2` and `#wcop2026latinamerica2` —
tournament-team avatars, consistent with `|rated|Tournament battle`. This was a tournament room, not
the ladder. It reached the store because `engine/durable-ingest.js` line 666 discovers replays with
`https://replay.pokemonshowdown.com/search.json?format=${FORMAT}` and Showdown indexes a custom-rule
battle under its **base format id**. The format id is the only filter, and a format id does not encode
custom rules. That is the whole mechanism.

## 3. Six bodies really entered the field

Every `|switch|`, `|drag|`, `|replace|` and `|detailschange|` line in the log:

```
40  |switch|p1a: Aerodactyl|...        50  |switch|p2a: Archaludon|...
41  |switch|p1b: Kingambit|...         86  |switch|p2b: Basculegion|...
70  |switch|p1b: Floette|Floette-Eternal, L50, F|100/100
90  |switch|p1a: Incineroar|...       104  |switch|p2b: Charizard|...|[from] Flip Turn
155 |switch|p1b: Aerodactyl|...|1/100 130  |switch|p2a: Venusaur|...
173 |switch|p1b: Garchomp|...         220  |switch|p2a: Pelipper|...
177 |switch|p1b: Sinistcha|...
197 |switch|p1a: Garchomp|...
216 |switch|p1b: Kingambit|...
```

p1 entered six distinct bodies (Aerodactyl, Kingambit, Floette-Eternal, Incineroar, Garchomp,
Sinistcha); p2 entered six (Basculegion, Grimmsnarl, Archaludon, Charizard, Venusaur, Pelipper).
Eleven turns, nine faints, a natural `|win|bagel` at line 265 — `forfeit` is `false` and the game is
complete. There is nothing degenerate about it *as a game*; it is simply a different game from the one
the store is a corpus of.

### The forme-change hypothesis is refuted, not merely unsupported

Two mega evolutions occur:

```
94  |detailschange|p1b: Floette|Floette-Mega, L50, F
95  |-mega|p1b: Floette|Floette|Floettite
115 |detailschange|p2b: Charizard|Charizard-Mega-Y, L50, M
116 |-mega|p2b: Charizard|Charizard|Charizardite Y
```

The extractor handles both correctly. The stored `brought` lists carry `floetteeternal` and
`charizard` — the **pre-mega** names — while `floettemega` and `charizardmegay` appear only in `sets`
and in the `turns` event stream. This is precisely the defect `engine/sanity_check.py` line 144
records as historical ("Recording mega evolution once added the mega forme to `brought`, so a Pokemon
that megad counted twice; `brought` became 5 in ~4,700 games"). It is not what happened here: if it
were, the count would be 8, not 6, and the store-wide distribution would show a large `5` bucket. It
shows none.

The other body-disguising mechanic, Illusion, is this project's one declared unmodelled mechanic, and
it does not appear: no `|replace|` line exists in the log, which is the line Showdown emits when an
Illusion is broken.

## 4. The extractor is innocent — proven, not argued

`extract()` was re-run over the freshly fetched log with the replay's own `uploadtime`. The result is
**byte-identical to the stored row** (`JSON.stringify` equality, and the sha256 above). Every field
matches individually as well: `six`, `brought`, `lead`, `preTurn`, `turns`, `sets`, `p1`, `p2`,
`winner`, `forfeit`, `openSheet`, `format`, `date`.

So the store faithfully recorded what Showdown broadcast. **Answer 2 (an extractor defect) is
excluded.** No other game can be subtly wrong through this path, because there is no defect on this
path.

## 5. How much else could be affected

Two questions, and they have different answers.

### 5a. Pick-count contamination: one game, and the bound is measured

| measurement | value |
|---|---|
| Parsed ladder store (`data/games.ladder.jsonl`) | 94,360 rows, `2026-07-22 10:11` .. `2026-09-20 20:50` |
| Distinct ids in `data/games.ladder.raw-logs.jsonl` (mtime 2026-09-04) | 76,833 |
| Store rows with **no** local raw log | 17,527 (18.57%) |
| Archived log records scanned | 77,234 |
| — emitting `\|teamsize\|` **4/4** | 76,569 |
| — emitting no `\|teamsize\|` line at all | 665 |
| — emitting anything other than 4 | **0** |
| — carrying `!Picked Team Size` | **0** |
| — carrying `!Min Team Size` | **0** |

The anomalous game is dated 2026-09-05 and is one of the 17,527 with no local raw log, which is why
the archive scan does not contain it.

Two further bounds on the unarchived remainder:

- **Store-internal.** The `brought`-length distribution over 188,720 side-observations is
  `{0: 1524, 2: 12085, 3: 24549, 4: 150560, 6: 2}`. There is no `5` bucket and no second `6`. Any
  bring-6 game in which five or six bodies appeared would land in one of those buckets; exactly one
  game did. What this bound does *not* cover is a bring-6 game in which four or fewer bodies were
  revealed — that row is indistinguishable from a normal game by shape alone, and no store field
  records the pick count.
- **Probe.** 40 store rows drawn from the highest-risk stratum (both ratings `null`, i.e. not a rated
  ladder game, **and** no local raw log) were re-fetched on 2026-09-21 and their `|teamsize|` read.
  All 40 are `4/4`. Two of the 40 are `|rated|Tournament battle` with no custom rules at all, which is
  worth saying plainly: a tournament battle is not by itself contamination — most are played under the
  format's own rules.

Conclusion: **one game, both sides.** The residual risk is confined to bring-6 games that revealed four
or fewer bodies, and nothing in this investigation found one.

### 5b. A larger contamination sits beside it, and nothing checks for it

Scanning the same archive for the custom-rule infobox and joining to the store by id:

| | count |
|---|---|
| Store rows carrying a custom-rule infobox | **1,176** (1.25% of the store; 1.53% of the 76,833 checkable) |
| Distinct custom-rule strings among them | 19 |
| Of those, rules that alter **legality or pick count** | **129** |

The dominant strings are harmless to legality and interesting for another reason — 691 rows read
`Force Open Team Sheets, Best of = 3`, 170 read `Best of = 3, !OpenTeamSheets`, 101 read
`Best of = 3, !Open Team Sheets`, 56 read `!open team sheets, best of=3` — i.e. **bo3 tournament games
are sitting in the ladder store**, with their information regime set by a custom rule that
`extract()`'s `openSheet` test (`/\|showteam\|/` or a bo3 token in the `|tier|` line) reads only
indirectly.

The 129 that matter for legality:

| custom-rule string | rows |
|---|---|
| `+past, ! Obtainable Moves` | 41 |
| `!obtainable, forceopenteamsheets, bestof=3` | 34 |
| `!obtainable, bestof=3, +jirachi, forceopenteamsheets` | 31 |
| `+salamencite, force open team sheets, +salamence-mega` | 7 |
| `+ past, !obtainable moves` | 6 |
| `!obtainable, bestof=3, forceopenteamsheets` | 4 |
| `!obtainable, bestof=3, +jirachi, forceopenteamsheets+` | 4 |
| `+past, Best Of = 3, ! Obtainable Moves` | 2 |

Every one of these admits entities the regulation does not contain — `+jirachi`, `+past`,
`+salamencite`/`+salamence-mega`, and `!obtainable`, which switches off the obtainability check
wholesale. Two further groups are adjacent: 6 rows carry a long explicit ban list
(`-Sneasler, -Garchomp, -Incineroar, -Kingambit, -Basculegion, +Basculegion-F, -Sinistcha, -Floettite,
-Aerodactylite, -Charizardite-Y, ...`) — a restricted event whose usage is not this format's usage —
and 2 rows carry `-Drizzle, -Rain Dance, -Snow Warning, -Snowscape, -Chilly Reception`.

**None of these 129 rows trips any store-shape check**, because they change *what may be on a team*,
not *how many were brought*. They are invisible to `sanity_check.py` exactly as the fourteen stale
handoffs were invisible to anything that did not print state. `exclude_illegal_teams` catches a
*subset* by a different route — a species- or item-level `TeamValidator` rejection recorded in
`data/store-validation.json` — and that route did **not** catch this game (its id is absent from
`store-validation.json`, correctly, since its team is legal). Whether it catches all 129 was not
measured here and should not be assumed.

And this figure is itself a floor: it is 1,176 of the 76,833 rows whose raw log is on disk. The other
17,527 rows cannot be asked the question locally at all.

## 6. What is already mitigated

`engine/quality.js` line 283:

```js
if (r.require_full_bring.on) {
  const br = g.brought || {};
  if ((br.p1 || []).length !== 4 || (br.p2 || []).length !== 4) bad.push('partial_bring');
}
```

The test is `!== 4`, not `< 4`. This game's `6/6` is therefore already tagged `partial_bring` and is
**already out of the clean corpus for every consumer that goes through `loadGames`**. The only thing
it is not out of is `engine/sanity_check.py`, which is marked `RAW-STORE-OK` and reads every row on
purpose — so the red clause is doing exactly its job, and it will keep failing until the row is either
removed or declared.

Its win is therefore not counted anywhere downstream, and no published figure needs withdrawing on
account of it.

## 7. Recommendation

**1. Declare it — but not under `exclude_corrupt_winner`.** That rule's `reason` is `corrupt_winner`
and its evidence schema is about the `|win|` line. This row's winner is correct; what is wrong is the
ruleset. Declaring it there would file a ruleset defect under an outcome defect and make the next
reader of `declared` believe two things that are not true. The honest home is a sibling rule in
`data/quality-filter.json`, declared by id with evidence in the same shape — a suggested skeleton,
for OPS to own rather than for this report to write:

```
"exclude_nonstandard_ruleset": {
  "on": true,
  "reason": "nonstandard_ruleset",
  "test": "the game's id is a key of `declared` below — declared, never detected",
  "declared": {
    "gen9championsvgc2026regmb-2676161109": {
      "defect": "played under 12 custom rules including `!Picked Team Size` and `!Min Team Size`, which remove the pick-4 restriction. Both sides brought six.",
      "evidence": "|raw| custom-rule infobox at log line 15; |teamsize|p1|6 and |teamsize|p2|6 at lines 37-38, against 4/4 on 76,569 of 76,569 archived logs that emit the line",
      "rated": "Tournament battle",
      "refetched_log_sha256": "fd4c808dc988c50e2308efe214e88a1ef256cef52be9818aaaead6c23d24e212",
      "row_sha256": "60b26f313249b91411d265eb9f7cf79036da88554d1cdbf0b67fa003e4582f5b",
      "extractor": "INNOCENT — extract() over the refetched log reproduces the stored row byte for byte",
      "other_reasons_when_declared": "partial_bring (brought is 6/6, and require_full_bring tests !== 4). Already excluded, so this declaration removes nothing from the clean corpus.",
      "report": "docs/_reports/2026-09-21-six-bring-game.md"
    }
  }
}
```

`engine/sanity_check.py`'s `nobody brings more than four` clause then needs the same treatment its
winner clause already has: honour the declaration, count it, print it, and **fail on an undeclared
one** — and fail on a declaration whose row no longer breaches, so a declaration cannot outlive its
defect.

**2. Do not touch `extract()`.** It is correct on this game, proven byte for byte.

**3. Treat the 129 legality-altering rows as the real finding.** This one game is a single row already
excluded by a rule that happens to catch it; those 129 are admitted into the clean corpus today and
carry entities outside the regulation. They deserve their own register row and their own measured
pass — including the question this report did not answer, which is how many of them
`exclude_illegal_teams` already catches via `data/store-validation.json`.

**4. The durable fix is a schema addition, and it is a re-derive, not a re-pull.** `extract()` reads
neither `|rule|`, nor the `|raw|` custom-rule infobox, nor `|teamsize|` — so the store cannot answer
"was this played under the format's own rules?" without going back to the log. Recording the
`|teamsize|` pair and the custom-rule string at ingest would make every future contaminated row
self-declaring and detectable by a shape check rather than by a 413 MB scan. For the 76,833 rows whose
raw log is on disk this is a re-derive over stored raw logs, which is what "store raw, analyze on top"
is for. For the remaining 17,527 it is a re-fetch, which that principle says to avoid — so the honest
scope is: add the fields going forward, backfill what the archive can, and state the gap rather than
close it.

## 8. What was not done

- The bo3 store (`data/games.bo3.jsonl`) and the Reg M-C stores were not scanned. The same mechanism
  applies to them — the format id is the only filter there too — and the 977 `Best of = 3` custom-rule
  strings found in the *ladder* archive suggest the two populations already overlap.
- Whether `exclude_illegal_teams` already catches some or all of the 129 legality-altering rows was
  not measured.
- The 665 archived log records that emit no `|teamsize|` line at all were not characterised.
- No re-fetch was attempted for the 17,527 store rows with no local raw log beyond the 40-row probe.

## 9. Commands, for reproduction

```bash
# the row
grep -m1 "gen9championsvgc2026regmb-2676161109" data/games.ladder.jsonl

# the replay
curl -sS -L "https://replay.pokemonshowdown.com/gen9championsvgc2026regmb-2676161109.log"
curl -sS -L "https://replay.pokemonshowdown.com/gen9championsvgc2026regmb-2676161109.json"

# the reproduction
node -e "const {extract}=require('./engine/durable-ingest.js'); /* extract(id, 1788633927, log) */"
```

The three archive scans were one-off read-only scripts written to the session scratchpad and are not
checked in; each is a single streaming pass over `data/games.ladder.raw-logs.jsonl` and
`data/games.ladder.jsonl`, matching `<strong>(\d+) custom rules:</strong>`, `^\|teamsize\|p[12]\|(\d+)$`
and `^\|rated\|Tournament battle`, run through `tools/lownode.cmd`.
