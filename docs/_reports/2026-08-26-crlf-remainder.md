# The CRLF remainder — the PDF builder was blind and is fixed; the other twelve sites are not blind

MEASURE, 2026-08-26. Historical record; not current state. Superseded by whatever the register rows
and `node engine/status.js` say later.

Follows `docs/_reports/2026-08-26-crlf-blind-checks.md` and `docs/_reports/2026-08-26-normalising-read.md`,
which built the door (`engine/read_text.js`) and named this site without fixing it.

---

## VERDICT

- **`build/md_to_pdf.js` WAS BLIND AND IS NOW FIXED.** Its one read is routed through
  `readText()`. Shown red on bytes that were already on disk — no synthesis, no flip needed:
  **`docs/ROADMAP.md` rendered ZERO headings**, `docs/SEARCH.md` zero, `docs/ENGINE.md` zero.
- **The headings were not demoted to paragraphs. They were DELETED.** All **43** of ROADMAP's
  heading strings — **including the document's own title, `ABRA — roadmap`** — appear nowhere in
  the rendered HTML. The paragraph fallback's guard rejects any line starting `#`, so the
  unmatched heading line falls through `else i++` and is discarded. A silently shorter document
  is worse than a badly styled one.
- **The blast radius was larger than "the four hand-published documents are LF".**
  `build/build_pdfs.js` derives its list from *every* `docs/*.md`. **23 of 78 are CRLF, and 12 of
  those have a PDF that is stale or missing** — so the next `node build/build_pdfs.js`, which the
  living-docs rule *requires* on every change, was going to publish twelve heading-less documents.
  That is not a latent hazard; it is a queued one.
- **Repo-wide, the loss is bigger than the previous pass measured and it is still growing:**
  heading matches went **2,937 raw → 6,965 normalised** across 239 tracked markdown files (previous
  pass: 6 → 3,516 across 24 CRLF files). **58 files are CRLF now, up from 24.**
- **`web/` — 6 utf8 read sites, ZERO blind.** Measured, not reasoned: each builder was run twice,
  once on the working tree's real bytes and once with every utf8 read normalised, and the outputs
  compared. All nine `web/*.html` are fully CRLF, so these sites are **live**, not latent.
- **`engine/*.py` — 84 read-mode `open()` sites, ZERO blind.** Python's text mode does
  universal-newline translation, measured on this interpreter (3.12.10) across every idiom the
  repository actually uses. The one binary read is `sha256_file`, where byte-exactness is the point.
- **The sentence that matters — safe by design vs safe by accident.** Of the 12 sites the brief
  listed as unverified plus the 3 I found beyond them, **13 are immune BY DESIGN, 2 by ACCIDENT,
  and 1 of those 2 is also latent.** The Python half is design-immune for a reason that has nothing
  to do with the JavaScript story, exactly as the brief warned.

---

## 1. `build/md_to_pdf.js` — red on real bytes, fixed, green, and no regression

### The mechanism

The renderer does `md.split('\n')` and then, per line:

```js
const h = L.match(/^(#{1,6})\s+(.*)$/);
```

On a CRLF checkout every element of that split carries a trailing CR. `.` does not match CR and
there is no `m` flag, so `(.*)$` can never reach the end of the string. `\s+` cannot rescue it
either, because the heading text sits between the whitespace and the CR.

The line then falls through to the paragraph accumulator, whose guard is

```js
!/^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|```|\s*\||\s*>)/.test(lines[i])
```

which rejects it immediately. `buf` stays empty, `else i++` runs, and **the line is dropped from
the document.** This is the sharpest correction to the brief: the failure is deletion, not
demotion, and a reader of the PDF has no way to see that anything is missing.

### Red — on unmodified working-tree bytes

`--html-only`, output directed to the scratchpad so nothing was written into `docs/`.

| document (already CRLF on disk) | `<h1..h6>` before | `<p>` before |
|---|---|---|
| `docs/ROADMAP.md` | **0** | 99 |
| `docs/SEARCH.md` | **0** | 483 |
| `docs/ENGINE.md` | **0** | 2,944 |

Text-survival check on ROADMAP: **43 source headings, 43 whose text does not appear anywhere in the
HTML.** The body began `<p><strong>2026-08-01</strong></p>` — the `<h1>` title was simply gone.

### Red — the published set, proved to be safe only by luck

The four hand-published documents are LF in this tree, so `docs/ABRA-whitepaper.md` was flipped to
CRLF in place, rendered, and restored.

```
sha256 before  c107583c9ede20fbc5eab36beae54f816775c27c7f4ae050b0f53e384bc63908
sha256 after   c107583c9ede20fbc5eab36beae54f816775c27c7f4ae050b0f53e384bc63908   (sha256sum -c: OK)
mtime before   2026-08-22 19:14:49.946986600 -0400
mtime after    2026-08-22 19:14:49.946986600 -0400   (restored with cp -p)
git status     clean for this file
```

**mtime was preserved deliberately**, unlike the `docs/MODELS.md` flip in the previous pass.
`build_pdfs.js` decides staleness by mtime, so bumping a published document's mtime would have
marked its PDF stale — a real state change to the repository for no measurement gain.

```
LF          -> 38 headings
CRLF        ->  0 headings      (pre-fix)
```

### The fix

One require and one call site. The read, not the regex:

```js
const { readText } = require('../engine/read_text.js');
...
${render(readText(IN))}
```

Adding the `m` flag would have fixed the heading and left every other line-oriented branch of the
renderer resting on the same accident. The door is the fix.

### Green, and the LF path proved unchanged

| document | `<h*>` before | `<h*>` after | CR in emitted HTML |
|---|---|---|---|
| `docs/ROADMAP.md` | 0 | **43** | 0 |
| `docs/SEARCH.md` | 0 | **195** | 0 |
| `docs/ENGINE.md` | 0 | **1,209** | 0 |
| `docs/ABRA-whitepaper.md` as CRLF | 0 | **38** | 0 |

Two identity checks, both byte-level `cmp`:

- **the LF render is byte-identical before and after the fix** — no published document changes;
- **the CRLF render is now byte-identical to the LF render** — the checkout no longer decides what
  the document says.

(195 rendered against 197 source headings in `SEARCH.md`, and 1,209 against 1,218 in `ENGINE.md`,
because the fenced-code branch consumes `#` lines inside code blocks first. That gap exists on LF
too and is correct.)

### The queued failure, enumerated

`docs/*.md` that are CRLF **and** whose PDF `build_pdfs.js` would rebuild or create on its next run:

```
STALE   ADR-003-exploitability-is-the-headline.md   ENGINE.md   GAME-DIFFERENTIAL-DESIGN.md
        GLOSSARY.md   OPS.md   ORIENTATION.md   ROADMAP.md   SEARCH.md   TAG-COVERAGE.md
MISSING MEDICHAM-SPRINT-NOTES.md   MEGA-FEATURES-SPEC.md   PRIOR-ART.md
```

Nine stale, three missing. Every one of them would have rendered with **no headings and no title**.

### Repo-wide, re-measured in Node

The previous pass's figure was computed correctly but is now stale; **the Python `re` module cannot
reproduce it**, because Python's `.` matches CR while JavaScript's does not. Measured with JS
semantics:

```
tracked .md                              239   (containing CR: 58, was 24)
heading matches by the old pattern       2,937
heading matches once normalised          6,965
loss                                     4,028   (was 3,510)
files losing headings                    58 — every CRLF file loses ALL of them
```

`docs/LOOKAHEAD-design.md` remains the one file with mixed line endings (6 LF headings, 15 CRLF).

---

## 2. `web/` — 6 utf8 read sites, none blind, verified by running both ways

The brief said 3; there are **6** `readFileSync(..., 'utf8')` sites in `web/`. The "3" in the
previous report counted bare `split('\n')` calls, all of which are in `figure-audit.js`.

**These are live, not latent.** Every `web/*.html` and every `web/*.js` in the working tree is
fully CRLF:

```
futuresight.html 9/9   index.html 2539/2539   models.html 605/605   orb.html 154/154
replay.html 121/121    scoreboard.html 194/194   stadium.html 2941/2941
status.html 1078/1078  tower.html 685/685        (CR lines / total lines)
```

Method: each builder run twice under a preload that (a) optionally normalises every string returned
by `fs.readFileSync` and (b) **redirects every `writeFileSync` into the scratchpad**, so no page and
no data file was written. Web is paused; nothing in `web/` was modified by this pass.

| site | verdict | mechanism |
|---|---|---|
| `web/build-quarantine.js:197` | safe **by design** | `JSON.parse` — CR is whitespace in the JSON grammar |
| `web/build-quarantine.js:364` | safe **by design, explicitly** | its comparator is `norm = s => s.replace(/\r\n/g,'\n')…`, with a comment saying it was `--check`-drifting before. This site already carried the fix locally |
| `web/build-quarantine.js:372` | safe **by design** | `stampStadium` uses `html.indexOf(BEGIN)`; the markers contain no newline, so CRLF cannot separate them from their text |
| `web/build-status.js:105` | safe **by design** | `JSON.parse` |
| `web/build-status.js:559` | safe **by accident, and latent** | `.replace(/;\s*$/,'')` — `\s*` eats the CR. Also `JSON.parse`. And `data/live.js` is LF (0 CR) today |
| `web/figure-audit.js:298` | safe **by construction** | a character-at-a-time HTML scanner; every regex is unanchored or `^`-anchored, and the untraced-context string is `.replace(/\s+/g,' ')`-collapsed |

Measured results:

```
build-quarantine.js   stdout identical raw vs normalised;
                      quarantine-data.js and stadium.html identical after normalising both
figure-audit.js       every page identical: index 41/41 traced, stadium 112/112, models 7/7,
                      tower 2/2, OVERALL 100% 162/162, bad_strikes 0 — raw === normalised
build-status.js       both utf8 reads probed directly; data/live.js parses to the same 9-key
                      object raw and normalised. 61 of 253 data/*.json contain CR and 0 of them
                      fail JSON.parse on raw bytes
```

`build-status.js`'s many `/…$/m` patterns do not read files at all — they match `engine/status.js`
subprocess stdout, and `/m` is safe because CR is a LineTerminator for `$` in multiline mode.

**Nothing in `web/` was fixed, because nothing in `web/` is broken.** The brief's warning still
holds and is worth restating: the site was caught publishing a stale quarantine block for three
days, and that was not a line-ending failure.

---

## 3. `engine/*.py` — 84 read sites, none blind, and the mechanism is not the JavaScript one

The brief said 9; there are **84 read-mode `open()` call sites across 34 of 40 files**. The brief
was right that the discriminator does not transfer, and right about which mechanism to check.

**Two things differ from JavaScript at once, and both matter:**

1. Python's `open()` in text mode uses `newline=None`, which is universal-newline mode — `\r\n` and
   lone `\r` are translated to `\n` **before the string exists**. No CR ever reaches a regex.
2. Even if one did, Python's `.` matches CR (only `\n` is excluded without `re.DOTALL`). So a
   Python `(.*)$` would behave *unlike* its JavaScript twin.

Measured on this interpreter rather than assumed — a CRLF fixture with 3 CR bytes on disk:

| idiom | CR in the resulting string | used in `engine/*.py` |
|---|---|---|
| `open(p, encoding='utf-8').read()` | **0** | yes, the common case |
| `open(p).read()` | **0** | yes |
| `io.open(p, encoding='utf-8').read()` | **0** | yes — `refresh-site-data*.py`, `pory_baseline.py` |
| `for line in open(p, encoding='utf-8')` | **0** | yes — every JSONL scan |
| `gzip.open(p, 'rt', encoding='utf-8')` | **0** | yes — `porygon2.py:336`, `quality.py:50` |
| `subprocess.run(..., text=True).stdout` | **0** | yes — `flywheel.py:28`, and the `json.loads(out.stdout)` sites |
| `open(p, newline='').read()` | 3 | **never used anywhere** |
| `open(p, 'rb').read().decode()` | 3 | **once**, see below |

`python --version` → 3.12.10. `newline=` appears in **zero** call sites in `engine/*.py`.

**The one binary read: `engine/porygon2_separation_gate.py:198`, `sha256_file()`.** This is
CR-sensitive and correctly so — it is a digest of the file, and a digest of normalised bytes would
not be a digest of the file. It is used only to compare the four `UNFROZEN` paths before and after
a run on the same checkout (`:525`, `:663`, `:716`), so the comparison is CR-symmetric, and all four
are LF today anyway. **Safe by design; the only caveat is that such a digest is not portable
between an LF and a CRLF checkout, and it is never published across machines.**

So: **83 immune by design (universal newlines), 1 deliberately byte-exact, 0 blind.**

---

## 4. The tally, and what "by accident" now means

| population | sites | blind | safe by DESIGN | safe by ACCIDENT |
|---|---|---|---|---|
| `build/md_to_pdf.js` | 1 | **1 → fixed** | now routed through the door | — |
| `web/` utf8 reads | 6 | 0 | 5 | 1 (`build-status.js:559`, also latent) |
| `engine/*.py` reads | 84 | 0 | 84 | 0 |

Repository-wide after this pass: **223 utf8 `readFileSync` sites across 409 JS files; 3 files
require the door** (`engine/conformance.js`, `engine/orient.js`, `build/md_to_pdf.js`).

The distinction is not academic. The two "by accident" survivors in this pass survive on `\s*`
eating a CR — one comment edit or one tightened pattern away from ending. The Python 84 survive on
a language default that nobody in this repository chose and that no future edit here can revoke.
Those are not the same kind of safe, and only the second kind is worth leaving alone without a note.

---

## 5. What was NOT done, on purpose

- **No gate.** The door is the fix. A check that asserted "every read site uses `readText`" would be
  the enumerated ratchet that the species-key bug walked past twice, and it would go stale on the
  224th read site. If Will wants one, the argument to beat is: it would have caught this site, and
  it would also have flagged 220 sites that are correct.
- **No PDF was rebuilt and no page was published.** Every render in this report went to
  `--html-only` in the scratchpad. Rebuilding the twelve queued documents is a publish, and web is
  paused.
- **Nothing in `web/` was edited.** Nothing there is blind.
- **`engine/status.js:1212` still holds its own local 2026-08-07 fix** rather than the door. Same as
  the previous pass: a real cleanup, its own batch, and it is not broken today.
- **`.scratch_eng/` is untracked debris from a live ENGINE agent. Reported, left in place.**

---

## OWED, NOT RUN

1. **The twelve queued PDFs are still stale or missing.** The fix means they will now render
   correctly, but `node build/build_pdfs.js` was **not** run — that is a publish, and web is paused.
   Nine stale (`ADR-003`, `ENGINE`, `GAME-DIFFERENTIAL-DESIGN`, `GLOSSARY`, `OPS`, `ORIENTATION`,
   `ROADMAP`, `SEARCH`, `TAG-COVERAGE`) and three missing (`MEDICHAM-SPRINT-NOTES`,
   `MEGA-FEATURES-SPEC`, `PRIOR-ART`).
2. **220 of 223 utf8 read sites still do not use the door.** No claim is made that they are all
   safe — the claim is narrower and is the one the evidence supports: the 12 the brief named as
   unverified are now verified, and none of them is blind. `engine/` and `tests/` were triaged in
   the previous two passes; `build/` in the previous one.
3. **`engine/conformance.js` was RED for unrelated reasons and was NOT re-run this pass** — 49 S13
   regressions on `data/` artifacts other divisions rewrote, per
   `docs/_reports/2026-08-26-normalising-read.md`. That is a carried claim, not a fresh measurement.
   Named so the line-ending work is not later blamed for it.
4. **The sprint-notes prose at lines 9543 and 9878 is still missing a character each** (two
   `U+000C`). Still the row author's, still not mine, and now carried into a third report.
5. **`docs/ENGINE.md` was modified in the working tree by a live ENGINE agent throughout this pass.**
   Its heading counts here (1,218 source / 1,209 rendered) are a snapshot of a moving file and should
   not be diffed against a later run.
6. **Nothing measured whether a CRLF checkout changes any *other* generated document**, only the
   heading path. The renderer's table, list, blockquote and rule branches are `\s*$`-immune by
   accident; they were read, not exercised on CRLF input end to end.
