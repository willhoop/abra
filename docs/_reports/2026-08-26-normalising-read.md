# The normalising read — one door, two sites routed, one third site named

MEASURE, 2026-08-26. Historical record; not current state. Superseded by whatever the register rows
and `node engine/status.js` say later.

---

## VERDICT

- **The door exists.** `engine/read_text.js` — `readText(file)` and `normalise(text)`, CR-to-LF at the
  read, errors deliberately not swallowed.
- **Both named sites are routed and both were shown red on real working-tree bytes**, not on a
  synthetic string.
- **`engine/conformance.js` — RED, measured, and the effect on the verdict is ZERO.** Its
  `stripComments()` removed **0** line comments across the **169** CRLF files in its 478-file scan,
  against **1,316** comment lines / **71,986** characters once normalised. But the full run before and
  after the fix is **byte-identical except for the file count** (478 → 479, my new module). The brief's
  "so it over-fires" was an inference; measured, the over-fire count today is **0**, because no CRLF
  file names a config value or a Pokemon term *exclusively* inside a `//` or `#` line comment. The
  mechanism was broken; the answer happened not to move.
- **`engine/orient.js` — RED on real bytes, and it does NOT surface loudly.** With `docs/MODELS.md`
  converted to CRLF, the `**Job:**` capture goes **32 → 0**, the model count **33 → 6**, and 29
  headings fall into "matched NEITHER shape" — while `orient.js` **exits 0**. The brief expected a
  `CANNOT DERIVE` and a non-zero exit; there is none, because `fail()` only fires when *nothing*
  carries a question and the six pipeline-table rows survive on a pattern ending `\s*$`. It degrades
  **quietly by 82%**, switched on by nothing but somebody's checkout.
- **The conformance ratchet did not move, and this is verified rather than assumed.**
  `data/conformance-baseline.json` is byte-identical before and after (md5 `c38b75d0…` both times).
  Both runs print `RATCHET — 96 baselined, 66 new (49 regression, 17 discovery), 14 fixed` and exit 1.
  The baseline is not rewritten while a regression stands, and 49 stand — all S13 `data/` churn from
  other divisions, none of it mine. **The fix therefore lowered no floor.**
- **A THIRD LIVE SITE, NAMED AND NOT FIXED: `build/md_to_pdf.js:61`.** `L.match(/^(#{1,6})\s+(.*)$/)`
  over `md.split('\n')`. Measured across the repo's 24 CRLF markdown files: **6 headings matched, 3,516
  once normalised — a 3,510-heading loss.** `CHANGELOG.md` alone loses 1,258 and `docs/ENGINE.md`
  1,214. Batches of one, and this batch is already two.
- **Sites still reading a file without the door: 222 of 224.** Two files require it, out of 409.

---

## 1. The setting, re-measured rather than quoted

`git config core.autocrlf` → `true`.

| measured here, 2026-08-26 | value | the brief said |
|---|---|---|
| tracked files | 1,937 | 1,753 |
| tracked files CRLF in the working tree | **600** | 510 |
| `data/abra-tags.js` CR bytes on disk | 41,252 | 41,252 |
| `data/abra-tags.js` CR bytes in the committed blob | **0** | 0 |

The two file counts differ because the tree grew between the two runs, not because either is wrong.
The `abra-tags.js` pair is the whole point in one line: **same content, different bytes**, which is why
the registered-artifact gate reported the browser and node engines reading different rulebooks and was
wrong.

## 2. Why a module and not two edits

`engine/status.js` carries a comment **dated 2026-08-07** describing this exact defect — a GENERATED
marker followed by CRLF failing to match a pattern ending `-->` plus a newline, so a whole ledger
printed *"no GENERATED block"* while frozen at an older run's numbers. It was fixed **in that one
file**. Nineteen days later `tests/test-workflow-paths.js` shipped with the same defect and matched
zero `git add` paths for its entire life.

That is the shape this repository has paid for three times with the species-key mismatch: found,
fixed, gated — twice — and the third instance walked past both gates because the ratchet enumerated
known-bad forms. So the fix is a door, not a list.

### The discriminator (used, not re-derived)

**`\s` matches CR. `.` does not.**

- a pattern ending `\s*$` is **accidentally** immune;
- a pattern ending `(.+)$` or `(.*)$` is not, and captures **nothing** on a CRLF line;
- `/…$/m` is safe — `$` in multiline mode anchors before a LineTerminator, and CR is one;
- `=== '<a whole line>'` and `.endsWith(…)` are **silently false**.

The rest of the repository is fine **by luck rather than by design**. That sentence is in the module
header, which is where it needed to be.

## 3. `engine/conformance.js` — shown red on the bytes that are already on disk

No synthesis was needed: this site is live, so the working-tree bytes *are* the red.

```
CRLF files in the conformance scan set : 169   (of 478)
line comments stripped, REAL bytes     : 0     (0 chars)
line comments stripped, NORMALISED     : 1316  (71,986 chars)
```

Top files by comment lines going unstripped: `tests/test-mechanics.js` (256),
`engine/medicham2-browser.js` (219), `web/index.html` (100), `engine/porygon2_separation_gate.py` (73).

`stripComments()`'s own header states its purpose — *"Comments are PROSE, and prose may name a thing
in order to explain it… Only code is checked"*. That purpose was defeated on 169 files.

**And then the honest half.** Diffing the full run before and after routing `read` through the door:

```
3c3
<   478 source files, 254,360 lines
---
>   479 source files, 254,428 lines
```

Nothing else. Same 60 S12 findings, same 67 S13, same 20 convention, same `TOTAL 148 findings across
146 files`, same ratchet line. Cross-checked independently with a per-file probe over the two
`checkHardcodes` / `checkNamedPokemon` predicates: **60 findings on CRLF bytes, 60 after normalising,
0 appearing and 0 disappearing.**

So the correct statement is: **the door was broken on 35% of the scan and the verdict was unaffected
by coincidence.** The coincidence is one comment away from ending, and the ratchet would then record
the over-fire as a REGRESSION on an unchanged subject — the "UNEXPLAINED" class, which fails.

### What the ratchet read, before and after

| | before | after |
|---|---|---|
| `data/conformance-baseline.json` md5 | `c38b75d017612c000ecf35e77d76c7f7` | `c38b75d017612c000ecf35e77d76c7f7` |
| ratchet line | `96 baselined, 66 new (49 regression, 17 discovery), 14 fixed` | identical |
| exit code | 1 | 1 |

The gate is red both times on 49 S13 regressions, every one of them a `data/` file another division
added or rewrote (`data/artifact-rerunnable-baseline.json`, `data/whole-game-baseline.json`,
`data/fixture-legality-baseline.json`, …). **None of them is mine and none of them moved.** The
baseline file was not written, because `writeBaseline` is not reached while a regression stands — so
the floor is exactly where it was.

## 4. `engine/orient.js` — latent, flipped deliberately, restored and verified

`docs/MODELS.md` is **LF** in this working tree (0 CR bytes), so this site is latent here.

Procedure: SHA the file, copy to scratch, convert the working-tree copy to CRLF, run, restore from the
copy, re-SHA, confirm `git status` clean.

```
sha256 before  8c520a5733d8edffb2704519eac41356d58fade2505aedc8b8965d31e75a352f
sha256 after   8c520a5733d8edffb2704519eac41356d58fade2505aedc8b8965d31e75a352f   (git status: clean)
```

**Pre-fix, on CRLF bytes:**

```
6 models carry a question (6 from the per-turn pipeline table; ...)
29 ALL-CAPS heading(s) matched NEITHER shape and are NOT classified
orient exit=0
```

against `33 models carry a question (6 from the per-turn pipeline table)` on LF. The `**Job:**`
capture, probed directly on the CRLF bytes: **32 `**Job:**` lines, 0 matched.**

**Post-fix**, the same flip: output is **identical** to the LF run. And the post-fix LF run is
identical to the pre-fix LF run apart from clock ages and `219 → 220` modules (the new file).
`tests/test-orient.js` is GREEN, including its `non-zero everywhere: 5 divisions, 85 modules
downstream, 33 models`.

**Correction to the brief.** It said a `CANNOT DERIVE` there exits non-zero, so the failure would
surface loudly. It does not. `fail('THE MODELS', …)` fires only when `!named.length`, and the six
pipeline-table rows survive because their regex ends `\s*$`. The failure mode is a **quiet 82% loss**
— which is worse, and is exactly the silent-default shape this project keeps paying for.

**One residue, reported not hidden:** the flip bumped `docs/MODELS.md`'s mtime, so
`orient.js` now prints `[docs/MODELS.md age 0.0h]` instead of `3.3d`. Content is byte-identical and no
gate compares that file by mtime (every consumer — `tests/test-model-map.js`, `engine/docs_scan.js`,
`tests/test-stadium-roster.js` — reads its content). Cosmetic, and it will age back.

## 5. The sweep, re-run against the door

Question changed from *"which regex is fragile"* to *"which read does not go through the door"*.

```
js files scanned (engine, build, tests, web, mcp) : 409
files requiring the door                          : 2
readFileSync call sites                           : 548
  of those, utf8 (text)                           : 224
  raw AND carrying a CR-fragile idiom within 40 lines : 70
```

The 70 were triaged. `engine/` and `tests/` were already narrowed to 11 sites (2 real) by the previous
pass and that triage is not repeated here. `build/` was listed as unverified in that report; it is
verified now:

| site | verdict | why |
|---|---|---|
| `build/md_to_pdf.js:61` | **AFFECTED, LIVE — NAMED, NOT FIXED** | `/^(#{1,6})\s+(.*)$/` on a bare-split line |
| `build/strong_player_baseline.js:64` | safe | the row regex ends `\|`, not `$` |
| `build/strong_player_baseline.js:78` | safe | `/\s*\|\s*$/` — `\s*` eats the CR; accidentally immune |
| `build/build_scoreboard.js:89` | safe | JSONL, `JSON.parse` per line |
| `build/compress-stores.js:65` | safe | JSONL, `.trim()` + unanchored `"id":"…"`; and both stores are LF (0 CR bytes) |
| `build/merge-jsonl-store.js:50` | safe | JSONL, `.trim()` per line |
| `build/triggers.js:121` | safe | `JSON.parse` of the whole read |
| `build/md_to_pdf.js:115` | safe | the `$` is `/\.pdf$/` on a filename |
| `engine/engine_release.js:206` | safe | `/\.js$/` on a resolved path |
| `engine/tag_exposure.js:81` | safe | `/tag_dex\.js$/` on a filename |
| `tests/test-click-match.js:167` | safe | per-line patterns are unanchored; the comment filter is `^`-anchored |
| `tests/test-mc-key.js:246` | safe | same shape |
| `tests/test-mag-page.js:61` | safe | `.endsWith` is on strings pulled out of a quoted JS array, not on lines |

### The third site, measured

`build/md_to_pdf.js:61`, `const h = L.match(/^(#{1,6})\s+(.*)$/);` — `(.*)$`, no `m` flag, applied to a
line from `md.split('\n')` whose source is the read at line 115.

```
CRLF markdown files whose headings md_to_pdf.js:61 loses:
  CHANGELOG.md                      raw 0   normalised 1258
  docs/ENGINE.md                    raw 0   normalised 1214
  docs/MEDICHAM-SPRINT-NOTES.md     raw 0   normalised  565
  docs/SEARCH.md                    raw 0   normalised  197
  docs/ROADMAP.md                   raw 0   normalised   43
  ... 24 CRLF markdown files
  TOTAL  raw 6   normalised 3516
```

Every heading in a CRLF markdown file renders as a paragraph. The blast radius **today** is limited
because the four documents `build/build_pdfs.js` actually renders — the white paper, the deck, the
technical docs, SUMMARY — are all **LF** in this tree, so the published PDFs are not currently wrong.
That is the same coincidence as §3 and it is worth exactly as much.

`docs/LOOKAHEAD-design.md` is the one file with **mixed** line endings (6 headings LF, 15 CRLF), which
is worth knowing: "is this file CRLF" is not always a yes/no.

## 6. The control bytes — confirmed, inert, left in place

| file | line | byte | context |
|---|---|---|---|
| `CHANGELOG.md` | 951 | two `U+0008` | inside a backticked span quoting `` `/\bNOT A DEFECT\b/i` `` — the two `\b` in the prose are literal BACKSPACE bytes |
| `docs/MEDICHAM-SPRINT-NOTES.md` | 9543 | `U+000C` | `"a single kind of ␌ield 4 mismatch"` — a `\f` ate the `f` of "field" |
| `docs/MEDICHAM-SPRINT-NOTES.md` | 9878 | `U+000C` | `"The first mutated ␌iles AND stranded"` — same, "files" |

**Nothing matches against any of them.**

- `CHANGELOG.md` is on `engine/docs_scan.js`'s `EXEMPT_FILES` for every content rule. The two places it
  *is* read are `changelogTop()` (a version header on line 13) and `figuresIn()` (numeric figures for
  the traceability index) — line 951 carries no digits adjacent to the backspaces.
- `docs/MEDICHAM-SPRINT-NOTES.md` is exempted from the figure clauses by `sprintActive()` for as long
  as the file exists, and `.githooks/pre-commit` only checks that it is **staged**, never its content.

So: **inert prose, left alone.** Two notes rather than a fix:
1. The sprint-notes pair is not merely invisible, it is **lossy** — a character was consumed, so the
   rendered words read "ield" and "iles". Whoever writes the sprint batch up should retype those two
   words; it is their row, not mine.
2. The `CHANGELOG.md` pair is inside a **code span quoting a regex**. Copied out of the changelog into
   code it becomes a regex carrying two raw backspaces — which is the exact bug this repo already had,
   where one alternative could never match and it rendered correctly in the editor.

## 7. What was NOT done, on purpose

- **No third fix.** `build/md_to_pdf.js:61` is named and left. Batches of one; this was two.
- **No ratchet enumerating known-bad regexes.** That is the mechanism that failed twice on the
  species-key mismatch. The door is the fix; a test that asserts a caller uses the door would be the
  same list wearing a new name, and would go stale the moment a 223rd read site is added.
- **No BOM or U+2028 handling in `read_text.js`.** Different hazard, different fix, and a reader that
  quietly rewrites its input is the silent default this file replaces. Named in the module header.
- **`engine/status.js:1212` was not touched.** It already carries the 2026-08-07 fix in place. Routing
  it through the door is a real cleanup and it is a third batch.

---

## OWED, NOT RUN

1. **`build/md_to_pdf.js:61` is broken and unfixed.** Measured: 3,510 of 3,516 markdown headings lost
   on the repo's 24 CRLF markdown files. Not published-wrong today only because the four PDF'd
   documents happen to be LF. One-line fix (route line 115 through `readText`, or add the `m` flag);
   it needs its own batch and its own before/after render.
2. **220 of 222 raw utf8 read sites still do not use the door.** Most are safe by construction (JSONL
   + `JSON.parse`, `.trim()`, `^`-anchored patterns, filename tests). No claim is made that the
   triage above is exhaustive for `web/` (3 bare splits) or `engine/*.py` (9); the previous pass left
   those unverified and this one did not close them.
3. **The conformance gate is RED and was RED before this pass** — 49 S13 regressions, all `data/`
   artifacts other divisions added or rewrote. Not this batch's to fix, not filed as fixed, and named
   here so it is not later attributed to the line-ending change.
4. **The sprint-notes prose at lines 9543 and 9878 is missing a character each.** Left for the row's
   author.
5. **`docs/MODELS.md` mtime was bumped** by the deliberate CRLF flip (content byte-identical, SHA
   verified). No gate reads it by mtime; `orient.js` prints a younger age until it ages back.
