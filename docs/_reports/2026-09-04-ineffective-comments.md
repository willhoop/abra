# Ineffective comments — a census over `engine/ tests/ build/ web/ app/ tools/` + top-level `.js`

Read-only. Nothing was changed, fixed, committed, or played. Taken 2026-09-03/04 by MEASURE.

An **ineffective comment** here is one that carries an OBLIGATION or an ASSERTION that nothing
checks. A comment explaining WHY code is shaped a certain way is GOOD and is not listed. This
repository's explanatory comments are the reason most of the mechanical routes below came back
CLEAN, and that result is reported as a result.

---

## 0. HOW THE COMMENTS WERE EXTRACTED, AND HOW THAT WAS VALIDATED

A previous attempt at this task regexed `//` and `/* */` off raw source and reported 182 where the
truth was 38. A `//` inside a string, a template literal or a URL is not a comment.

The extractor here is a character state machine that tracks single quotes, double quotes, template
literals (including `${}` nesting), and regex literals, and only then recognises a comment.
`scratchpad/extract.js`.

**Validation 1 — against a region read by hand.** `engine/durable-ingest.js` lines 425-515 were read
first, by eye. The expected set is: a block at 431-449, a block at 464-470, three line comments at
482/483/484, a line comment at 505, a block opening at 508. The extractor returned exactly that set
and nothing else. Lines 430 and 450-453 carry four regex literals containing `|` and `/`; none was
mistaken for a comment.

**Validation 2 — against the naive route, on the same file.** A line-based `//`-or-`/*` scan claims
67 comment lines; the extractor claims 63. Every one of the 4 extra is a Showdown replay URL inside
a template literal:

```
489  try{ const j=JSON.parse(await get(`https://replay.pokemonshowdown.com/${id}.json`)); ...
490  if(!log) log=await get(`https://replay.pokemonshowdown.com/${id}.log`);
537  for(let p=1;p<=PAGES;p++){const j=await get(`https://replay.pokemonshowdown.com/search.json...
541  const logs=await pool(items,x=>get(`https://replay.pokemonshowdown.com/${x.id}.log`)...
```

**Validation 3 — false negatives.** Every comment-start line the extractor reports does in fact
contain `//` or `/*`: 0 of 63 fail that. So the extractor is a strict subset of the naive route and
the difference is entirely the false positives above.

### The corpus

| | |
|---|---|
| files in scope (`git ls-files`, `data/releases/**` excluded) | **495** |
| lines of JS | **286,203** |
| comments | **17,519** (1,484 line, 16,035 block) |
| physical comment lines | **120,245** — 42% of the tree |
| by directory | engine 9,940 · tests 7,177 · build 263 · web 121 · app 10 · root 7 · tools 1 |

`data/releases/**/engine/*.js` are frozen release snapshots and are excluded on purpose — they are
copies, they are not editable, and including them triples every count with duplicates. (The first
run of this census pulled them in because a bare `*.js` git pathspec has no directory anchor and
`*` matches `/`.)

---

## 1. THE TOP 20 BY CONSEQUENCE

Ranked by what it costs if a person believes it. `→` gives the verified state today.

| # | file:line | the comment (short) | cat | what it costs if believed |
|---|---|---|---|---|
| 1 | `engine/engine_release.js:653` | "**Nine releases hold 23 MB of copied bytes**, and the five largest FILES in this repository are the same 26,348-line tag artifact five times over" | 2 | **STALE, and it is the header of the section titled "PRUNING, AND WHY IT IS SAFE".** → **523 release directories, 2.5 GB.** The retention argument is sized against a problem 58x smaller in count and ~110x in bytes. A reader concludes keeping everything is cheap. It is 2.5 GB. |
| 2 | `engine/durable-ingest.js:470` | "**RUN THIS BEFORE ANY REPARSE.** It is idempotent and does nothing when the archive is complete." | 1 | **Partial executor, and the missing half is the expensive one.** The reparse path DOES refuse (`:519`, `if(orphan && !process.env.FORCE)`), so the ORDER is enforced. Nothing runs backfill and nothing alarms on the drift between reparses, which is the failure mode the paragraph above it describes. See §6 for the live state. |
| 3 | `engine/pp.js:9` (+9 more) | "ROADMAP **#144**" | 5 | **`#144` has never been a register row.** 10 citations across `engine/board.js:1517`, `board_state.js:120`, `game_differential.js:428`, `medicham2-browser.js:232`, `pp.js:9`, `pp_board_probe.js:3`, `tag_dex.js:396`, `tests/staged_board.js:1227`, `test-mechanics.js:8889`, `test-pp-fact.js:3`. The PP-as-a-resource work reads as tracked; `open_work.js` cannot print a row that does not exist. |
| 4 | `engine/medicham2-browser.js:1306` (+3) | "ROADMAP **#307** — the copy is undone by leaving the field" | 5 | **`#307` has never been a register row.** Also `board_state.js:625`, `game_differential.js:5367`, `tests/test-mechanics.js:451`. Same cost as #3: invisible work wearing a receipt. |
| 5 | `engine/medicham2-browser.js:22079` | "…it does not abolish it. **See docs/MEDICHAM-SPRINT-NOTES.md for the measured size.**" | 5 | **The file was deleted** (commit `7b5e6b40`, deliberately, to re-arm the pre-commit living-docs rule). Three engine claims now cite evidence that is gone: also `medicham2-browser.js:12563` ("before and after") and `:28646` ("the digest sweep is in"). The claims may be true; they are no longer checkable. |
| 6 | `engine/board.js:1417` **and** `:4493` | "so the **40 files** that already require board.js do not each grow a new import" | 2 | **STALE.** → **53** in-scope files `require(…/board.js)`, confirmed by two routes (in-scope walk with comments stripped: 53; raw grep across `engine tests build web app tools *.js`: 54). Written twice, both stale. Low direct harm, high exemplar value: it is a count of this repo's own structure typed in prose. |
| 7 | `engine/million_run.js:38` | "…and PROVES the difference: **`--red-proof`** runs the same games with the rng pinned high and REQUIRES the instrument to flag the collapse." | 5 (→3) | **The flag does not exist.** `million_run.js` parses exactly `--no-write`, `--declaration-only`, `--staged`. Typing `--red-proof` is silently ignored by node and the run looks like the proof was requested. Mitigating: the red proof itself is real and runs unconditionally at `:1244`, so the capability is present and only the door is fictional. |
| 8 | `engine/game_differential.js:126` | names **`tests/rate_runner.js`** | 5 | **Never existed** (0 commits in history). Already reported by `tests/test-claim-truth.js`'s second census, which **does not gate**. |
| 9 | `engine/medicham2-browser.js:7033` | names **`tests/test-engine-contract.js`** | 5 | **Never existed.** Same census, same ungated status. A named contract test that is not there reads as coverage. |
| 10 | `engine/bench_speed.js:35` | "`--release` freezes the **26 SOURCE files** (CLAUDE.md: a measurement is a photograph)" | 2 | **TRUE TODAY** — `require('./engine_release.js').SOURCES.length === 26`. Listed anyway because it is the named liability: CLAUDE.md records this exact sentence going stale three times in its own text ("twelve" → "twenty-three" → current) and says in terms *read the count from `SOURCES`, never from this sentence.* This is the fourth copy of that sentence, in a different file, where nobody is looking. |
| 11 | `build/build_mag_variables.js:41` | "**Regenerate with:** `DROP=priorLogP OUT_WEIGHTS=data/policy-weights-nopop.json node engine/fit_policy.js`" | 1 | **NO EXECUTOR.** Nothing under `tests/`, `.github/`, `.githooks/` or `package.json` names `build_mag_variables`. `docs/MAG-VARIABLES.md` is a published table of MAG's weights and can rot silently — which is what its own line 9 warns about: *"a table of numbers nobody regenerated is worse than no table, because it reads as current."* |
| 12 | `build/gen_tags_master.js:1` and `build/gen_items_doc.js:1` | "**Regenerate, never edit.**" | 1 | **NO EXECUTOR for either.** Nothing in the repository names either file. "The single tag document" and "the ITEMS review list" are both generated artifacts with no freshness check and no byte-equality check. |
| 13 | `build/build_tags_js.js:10` | "GENERATED (S13) … **regenerate after any tag_dex run, never hand-edit**" | 1 | **Executor exists and is RED.** `tests/test-site-data-fresh.js` covers it — and reports `data/abra-tags.js` **5.6 d stale** right now, inside an overall **FAIL (5 passed, 2 failed, 14 stale bundles)**. The same applies to `build/build_meta_js.js:9` (`data/abra-meta.js` 28.2 d), `build/build_mew_bundle.js:6` (`data/mew.js` 28.2 d) and `engine/build-status.js:3` (`data/status.js` 28.2 d). An obligation whose enforcer is red is worse than one with no enforcer, because it reads as covered. See §7. |
| 14 | `engine/argmax_paired.js:29` (+`:518`) | "its only writer is `board.noteItem`, whose **ONE caller in the repository** is the live protocol reader `engine/magnemite.js`" | 3 | **A second door exists inside `board.js` itself.** `engine/board.js:1231` installs `set: (v) => { this.noteItem(side, mon.base, v); }` on every active slot's `item`, so *any* assignment `slot.item = x` calls `noteItem`. The claim is true today only because nothing assigns it on a live slot (`board.js:3967`, `position_features.js:150` write `buildMon` bodies, not board slots). It is load-bearing: it is what the "inert by construction" control arm's *exactly 0 flips* assertion rests on, and a control that becomes non-inert silently is the worst kind. |
| 15 | `engine/medicham2-browser.js:20873` | "MILTANK already enumerates every bring and only the two-stone brings would branch; **that is written down and not yet built.**" | 4 | Deferred work with **no register row named**. "Written down" points at nothing resolvable. |
| 16 | `engine/magnemite.js:411` | "**THE PROBABILITY IS A PLACEHOLDER AND IT IS THE WRONG SHAPE.** 0.85 was inherited from Showdown's RandomPlayerAI…" | 4 | Deferred work, **no register row**, and it sits eleven lines above this repository's own best statement of category 3: `:422` — *"THE DEFAULT SAID 0 WHILE THE COMMENT ABOVE SAID 1, so MAG could never mega evolve at all… A comment stating the intended value is not the value."* That one was found by Will playing a real game. |
| 17 | 25 WIRE ids, 48 citations, e.g. `engine/medicham2-browser.js:26341` "**WIRE 241**" (×14) | 5 (low conf.) | **`WIRE N` reads like a tracked identifier and there is no registry to look one up in.** 157 distinct ids are cited in comments; 126 appear in `docs/ENGINE.md`, 133 across all of `docs/**.md` + `CHANGELOG.md`, and **25 resolve nowhere outside the file that types them** (14, 16, 38, 39, 40, 45, 48, 50, 51, 52, 53, 55, 57, 58, 60, 61, 62, 63, 75, 76, 86, 88, 94, 148, 241). Not a rot finding — a design one. |
| 18 | `engine/conformance.js:68` | "169 of the **478 files this scan reads** are CRLF in the working tree" | 2 | **UNVERIFIED present-tense structural count.** The scan's file set is derived at run time and has certainly moved; the sentence has not. Listed for shape, not for a confirmed delta. |
| 19 | `tests/test-claim-truth.js:333` | "**THIS CENSUS DOES NOT GATE**, and that is a decision with a reason rather than a softening." | 1 | The only derived check that exists for category 5 is advisory. Its stated reason is sound (it would go red on files this division does not own) and it is still the reason two false file names have stood. Current reading: **3,230 references, 2 false.** |
| 20 | `engine/docs_scan.js:67` and `tests/test-web-quarantine.js:20` | quote the MEDICHAM sprint regime in the present tense, citing `docs/MEDICHAM-SPRINT-NOTES.md` | 5 | The regime **ended** and the file was deleted on purpose. `docs_scan.js:80` still holds `const SPRINT_LOG = 'docs/MEDICHAM-SPRINT-NOTES.md'`, which is correct — the code conditions on the file's existence, so the mechanism is fine and only the prose reads as live. |

---

## 2. COUNT PER CATEGORY

### Category 1 — IMPERATIVE WITH NO EXECUTOR

| | |
|---|---|
| loose detector (as first written) | 297 — **~95% false positives**, discarded |
| tight detector (`scratchpad/cat1.js`, 6 patterns) | **38** |
| of those, genuine procedural instructions to a human | **20** |
| … with a working executor | **10** |
| … with an executor that is **currently RED** | **6** |
| … with **NO executor at all** | **4** |

The 4 with nothing behind them: `build/build_mag_variables.js:41`, `build/gen_tags_master.js:1`,
`build/gen_items_doc.js:1`, and the un-enforced half of `engine/durable-ingest.js:470`.

The 6 whose executor is red are all `tests/test-site-data-fresh.js`'s: `build_tags_js.js:10`,
`build_meta_js.js:9`, `build_mew_bundle.js:6`, `engine/build-status.js:3`,
`build_engine_data.js:28`, and the `web/app` loader headers.

The 10 effective ones are not listed here because they are effective — that is the point of the
category. Two deserve naming as good practice: `build/build_engine_data.js:119` ("must be run by
hand") describes a refusal that is *in the code*, and `engine/docs_scan.js:72` ("remember to
remove") is enforced by `.githooks/pre-commit:120`, which conditions on the file's existence.

### Category 2 — A NUMBER OR COUNT TYPED IN PROSE

| | |
|---|---|
| comment lines carrying a number **and** a countable noun | **15,872** |
| of those, in the **present tense** about a countable thing | **674** |
| of those, carrying a date or "measured"/"as of" on the same line | 8,213 of the 15,872 broad set |
| verified by hand this pass | **9** |
| … **STALE** | **2 claims / 3 sites** |
| … TRUE today | **5** |
| … dated history rather than a live claim | **2** |

Verified STALE: `engine_release.js:653` (nine releases / 23 MB → 523 / 2.5 GB);
`board.js:1417` and `:4493` (40 → 53).

Verified TRUE: `bench_speed.js:35` (26 SOURCES → 26); `immunity_sweep.js:147` (SEVEN statusImmune
abilities → 7: immunity, insomnia, leafguard, limber, purifyingsalt, vitalspirit, waterbubble);
`medicham2-browser.js:24355` ("Champions: 25%/attempt, guaranteed thaw turn 3" → `frz.onStart`
sets `startTime = 3`, `onBeforeMove` does `randomChance(1, 4)`, DERIVED from
`data/mods/champions/conditions.ts`); `medicham2-browser.js:24403` ("33% wake turn 2, 100% turn 3"
→ `slp.onStart` does `this.sample([2, 3, 3])`, DERIVED); the 486 register rows.

Dated-history, correctly left standing: `engine_release.js:520` ("on 2026-08-12 that reached 168 of
200 releases"), `:756` ("MEASURED 2026-08-09 over the 65 release directories").

**Roughly a fifth of a verified sample of nine was stale, and both stale claims are counts of this
repository's own structure.** Counts about the GAME, derived from the mod, were all true — which is
what the `DERIVED:` / `READ:` provenance rule in `data/million-targets.json` already buys.

### Category 3 — A COMMENT THAT CONTRADICTS ITS OWN CODE

**No hard contradiction found. Three independent mechanical routes, 1,371 candidates, 0 real hits.**

| route | candidates | real |
|---|---|---|
| a comment's stated constant vs the constant on the line it annotates (all comments ≤3 lines) | 584 | 0 |
| trailing `// n` comments vs the numeric literals on their own code line | 245 examined, 217 disagreeing | 0 — every one is a cross-reference (`// ROADMAP #222`, `// WIRE 157`) |
| "exits N" / "exit code N" claims vs the same file's exit codes | 39 | 0 — the gate files compute `process.exit(v.code)` off a verdict table, which the regex cannot see |
| `` `symbol()` `` references vs the repository's symbol set | 748 | 0 — the 21 unresolvable are Showdown's API (`eatItem()`, `getAllActive()`, `ignoringItem()`…), functions living in `.html` (`magSelfCheck()`, `roomPory()`), or generic illustration (`assertOrDie()`) |

Two **near-misses** are in the top-20 (rows 7 and 14). Neither is a clean contradiction today.

This is a genuine result about the codebase and not a limitation of the search: the two historical
instances this task names (the failed-Roost comment, the runner's coverage assertion) were both
caught and both left a comment recording the catch. `engine/magnemite.js:422` is the third, and it
says the rule out loud: **"A comment stating the intended value is not the value."**

### Category 4 — TODO / FIXME / HACK / XXX / "for now" / "temporary"

**The literal-marker class is EMPTY.**

| | |
|---|---|
| `\b(TODO\|FIXME\|HACK\|XXX)\b` in 17,519 comments | **2**, both false positives |
| `for now` | **0** |
| deferred-work prose (`temporar*`, `placeholder`, `workaround`, `unimplemented`, `not yet …`, `revisit`) | **53** candidates |
| … genuine deferred work | **~6** |
| … naming a register row | **3** (`fit_policy.js:284` → #67; `medicham2-browser.js:14511` → #152; `gate_offfield_target.js:1` → #224) |
| … naming **no** row | **3** (`magnemite.js:411`; `medicham2-browser.js:20873`; `tests/interaction_matrix.js:163`) |

The two literal markers are `engine/medicham2-browser.js:8320`, which cites *Showdown's own* TODO at
`sim/battle.ts:993-999`, and `engine/quality.js:154`, which says *"It is not an oversight and it is
not a TODO."* Neither is deferred work.

Cross-referenced against `docs/ROADMAP.md`: 486 register rows, max id 534.

### Category 5 — A REFERENCE TO SOMETHING THAT NO LONGER EXISTS

**The largest confirmed class: 37 confirmed, plus 48 lower-confidence WIRE citations.**

| sub-class | references | unresolvable | confirmed real |
|---|---|---|---|
| `ROADMAP #N` → a `\| #N \|` row | 2,530 | 30 | **30** (9 distinct ids) |
| repo paths in comments (`engine/ tests/ build/ web/ app/ tools/ docs/ .github/ memory/ sim/`, any of 12 extensions) | 3,804 | 20 | **6** |
| `` `symbol()` `` → a symbol defined in the tree | 748 | 21 | **0** |
| `--flag` → the flag parsed anywhere | 1,166 | 6 | **1** (`--red-proof`) |
| `WIRE N` → any docs/CHANGELOG entry | (157 distinct ids) | 25 | 48 citations, low confidence |

**The 9 register rows that never existed** — verified three ways: absent from `docs/ROADMAP.md`
today; `git log -S "| #N |" -- docs/ROADMAP.md` returns 0 commits (method validated against `#88`,
which returns 1); and a scan of the last 120 revisions of `docs/ROADMAP.md` finds no `| #N |` row
for any of them. Nothing else in the repository holds a register in that shape.

| id | citations | example |
|---|---|---|
| #144 | 10 | `engine/pp.js:9` |
| #138 | 5 | `engine/merge_mega_into_engine.js:60` |
| #307 | 4 | `engine/medicham2-browser.js:1306` |
| #86 | 4 | `tests/test-speed-tie.js:16` — and also cited as authority in `docs/ABRA-whitepaper.md:933`, `docs/MODELS.md:581`, `docs/ENGINE.md:30841` and `:31725` for the figure "91.4% of legal species share a base Speed" |
| #104 | 2 | `engine/artifact_audit.js:268` |
| #73, #76, #305, #306 | 1 each | `engine/click_census.js:75`, `tests/bench-medicham.js:1`, `engine/medicham2-browser.js:33283`, `:1303` |

**The 6 real path references** (the other 14 hits are the Showdown checkout's `sim/battle.js`,
`sim/pokemon.js`, `sim/battle-actions.js`, `sim/battle-queue.js`, `sim/SIM-PROTOCOL.md` — external
and correct — and `memory/never-type-a-pokemon-fact-from-memory.md`, which lives in the user's
`.claude` memory, not in this repository):

- `docs/MEDICHAM-SPRINT-NOTES.md` × 3 — `engine/medicham2-browser.js:12563`, `:22079`, `:28646`
  (deleted on purpose; also cited from `engine/docs_scan.js:67` and `tests/test-web-quarantine.js:20`)
- `tests/rate_runner.js` — `engine/game_differential.js:126` (never existed)
- `tests/test-engine-contract.js` — `engine/medicham2-browser.js:7033` (never existed)
- `--red-proof` — `engine/million_run.js:38`

---

## 3. WHICH CATEGORIES DESERVE A DERIVED CHECK

Will's acceptance test: *"would this catch a second instance, spelled differently, arriving through
another door?"* A list rots exactly like the fourteen handoffs. Applied per category:

### Category 5 — **YES. Cheapest and strongest. Half of it already exists.**

`tests/test-claim-truth.js` already runs the SECOND CENSUS over comment file references. It answers
"another door" by construction: it re-derives on every run and reports what is true today. Four
extensions, all inside the file that already does this, none of which needs a new list:

1. **A `ROADMAP #N` resolver.** ~5 lines. Reuse `engine/register_reality.js`'s exported `parse()`
   for the row-id set rather than re-deriving it — same reason `status.js` shells out to
   `provenance.js`. This alone catches 30 of the 37 confirmed hits and every future one, however
   the id is spelled, because it resolves the id rather than matching a string.
2. **Widen `SRCTOK`** from `(engine|tests|build|web)/…\.(js|py|html)` to include `app/`, `tools/`,
   `docs/`, `.github/` and the extensions `.md .cmd .yml .sh`. That catches the deleted
   `docs/MEDICHAM-SPRINT-NOTES.md` class. Keep the deliberate `data/*.json` exclusion — its stated
   reason still holds.
3. **Walk `web/` and `app/` as source dirs**, which the census currently does not.
4. **Arm the two currently-clean routes as ratchets**: `` `symbol()` `` resolution (748 refs, 0 bad)
   and `--flag` resolution (1,166 refs, 1 bad). Both are cheap and both are clean *now*, which is
   exactly when a ratchet is worth installing — the alternative is arming it after it has already
   drifted, when it reads as a permanent red.

The one thing this must NOT do is start gating on names in files this division cannot fix. The
census's existing reasoning is right, and the answer it already gives — file the names as register
rows — should be kept.

### Category 2 — **YES, but not as a count-checker. As a PROVENANCE rule.**

Checking "is 40 still 40" needs to know what is being counted, which is not derivable from prose.
Checking that a number was *sourced* is trivial and self-correcting, and **this repository already
has the mechanism**: every row of `data/million-targets.json` carries `from`, one of
`DERIVED:<expr>` / `READ:<file>:<line>` / `HAND`, `add()` THROWS without it, and
`tests/test-target-provenance.js` fails on any `HAND` and on any citation naming a file that does
not exist.

Extend that rule from targets to comments: **a bare integer in a comment must carry a date, a
`DERIVED:` expression, or a `READ:file:line`.** A baseline of existing bare counts, ratcheted
downward, is the same shape as the silent-catch ratchet and the mtime-only ratchet already in
`data/provenance-stamp.json`.

Note what the evidence supports: in the sample of nine, every count about the GAME (freeze, sleep,
`statusImmune`) was true and was derivable; both stale counts were about the repository's own
structure and were typed. The rule should bite hardest exactly there.

### Category 1 — **PARTIALLY, and the useful half already exists.**

`tests/test-site-data-fresh.js` is the executor for the whole "regenerate after X" family and it
already derives its file list from the pages rather than carrying one. Two gaps:

- **A generator whose output no page loads is invisible to it** — `build/gen_tags_master.js`,
  `build/gen_items_doc.js`, `build/build_mag_variables.js` write documents, not bundles. One line
  each in the docs-currency baseline closes that; a generic answer is *every file matching
  `build/gen_*.js` or `build/build_*.js` must have its output named and its output must be newer
  than its input*, derived from the generator's own `SOURCES`/write call rather than listed.
- **It is RED.** See §7. An obligation whose enforcer is red reads as covered, which is the
  "one of the two known failures" failure in a new costume.

### Category 3 — **NO. Not mechanically checkable, and pretending otherwise is worse than nothing.**

Four routes over 1,371 candidates returned zero real hits. A fifth would too: deciding that a
comment contradicts its code means understanding both. The control that actually works here is the
one this repository already uses everywhere — **show the check red on a deliberate break before
trusting it** — and the three known instances were all caught that way or by a human at a keyboard.

### Category 4 — **NO CHECK NEEDED, but one line keeps the class empty.**

The class is genuinely empty: 2 literal markers in 17,519 comments, both false positives, 0 "for
now". Add `TODO|FIXME|HACK|XXX` as a **zero-ratchet in `engine/conformance.js`** (which already
ratchets findings and already reads every file with the CRLF-normalising door). One line, and it
answers "a second instance spelled differently" because the marker vocabulary is fixed and small.

The prose form (`unimplemented`, `placeholder`, `temporary`) is NOT worth a check — 53 candidates
resolved to ~6 genuine, and the 47 others are declared non-defects with reasons, which is the
behaviour we want. What those 6 need is a register row, and `open_work.js` already prints
UNREGISTERED defects.

---

## 4. THREE THINGS FOUND ON THE WAY THAT ARE NOT COMMENTS

**`tests/test-site-data-fresh.js` IS RED.** `5 passed, 2 failed`; 14 of 16 site bundles stale, worst
`data/nmf.js`/`data/xatu.js` at ~30 days; `data/abra-tags.js` 5.6 d, `data/engine-data.js` 3.8 d.
Reported, not filed, and not called a known failure. It is very likely the deliberate consequence of
WEB being paused behind MEDICHAM, in which case it wants a stated waiver rather than a standing red —
but that is not MEASURE's call to make and this census did not change it.

**A write appears to be in flight on the store's raw archive.**
`data/games.ladder.raw-logs.jsonl` was last written at 22:43:13 against a wall clock of 22:54, while
`data/games.ladder.jsonl` was last written at 19:05. Line counts read *at that moment* were 76,431
store / 76,833 archive and 25,350 / 24,921 for bo3 — **and those are not published as a gap.** A gap
is an id-set difference, not a line difference, and CLAUDE.md forbids reading an artifact another
process is writing: the torn read is not an error, it is a plausible well-formed fictitious answer.
Whoever is running that backfill owns the number.

**`docs/ROADMAP.md` has holes in its id sequence.** Between #70 and #110 the ids 73, 75, 76, 77, 78,
79, 85, 86, 93, 94, 97, 99, 104 and 106 are absent, and 305-307 are absent. Nine of those are cited
from source comments (§ category 5). Whether the ids were consumed and dropped or never allocated is
not decided here; either way, the citations are pointing at nothing.

---

## 5. WHAT THIS CENSUS DOES NOT COVER

Stated up front rather than discovered later.

1. **Prose in `docs/`, `CHANGELOG.md` and the ledgers.** Scope was source comments. `#86` alone is
   cited as an authority in four documents. `tests/test-docs-current.js` and `engine/docs_scan.js`
   own that half.
2. **Non-JS comments.** `.py` (`engine/sanity_check.py`, `engine/pory.py`, …), `.cmd`, `.yml`,
   `.githooks/pre-commit`, `.html`. `tools/lownode.cmd` alone is 40 lines of `REM`, several of them
   load-bearing claims.
3. **`data/releases/**` snapshots.** Excluded deliberately; they are frozen copies.
4. **Whether an *effective* check is a GOOD check.** A comment whose executor exists but asks
   nothing passes here. That is `docs/LESSONS.md`'s "a green test can be asking nothing", and it is
   a different census.
5. **`engine/graveyard/`**, skipped on the same footing as `docs/archive/`.

---

## 6. METHOD ARTIFACTS

Scripts are in this session's scratchpad and are not committed:
`extract.js` (the state machine), `classify.js`, `cat1.js`, `cat3.js`, `cat5.js`, `exits.js`,
`runner.js`. Every count above was produced by one of them and every hit in the top 20 was then
opened by hand. Counts checked by two routes where that was cheap: the comment extraction
(hand-read region + naive-route diff), the board.js requirers (in-scope walk + raw grep), the
register row ids (current file + `git log -S` + a 120-revision scan), and `SOURCES.length`
(runtime `require` + literal parse — the literal parse says 31 and is wrong, because the array
contains comments; the runtime value 26 is authoritative, and that disagreement is itself the
argument for deriving rather than parsing prose).
