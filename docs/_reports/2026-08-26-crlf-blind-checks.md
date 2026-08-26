# CRLF-blind checks — one fixed, the class swept

**Date:** 2026-08-26 · **Division:** MEASURE · **Scope:** `tests/` and `engine/`, extended to
`build/`, `web/` and `engine/*.py` where it was cheap.

Historical findings record. Not maintained, not current state, superseded by whatever register rows
it feeds. Exempt from the living-docs version header by `data/docs-currency-baseline.json`.

---

## 1. The verdict

| | |
|---|---|
| `tests/test-workflow-paths.js` static paths seen | **0 → 4** |
| Shown RED on the replanted historical defect | **yes, on both line endings** |
| Other checks in `tests/`+`engine/` carrying the same blindness | **2** (1 live, 1 latent) |
| Prior instances of this exact class already in the repo | **1** (`engine/status.js`, fixed 2026-08-07) |

---

## 2. The defect, at byte level

`git config core.autocrlf` is `true`, so a tracked text file is CRLF in the working tree while its
committed blob is LF. Measured on this machine: **510 of 1,753 readable tracked files contain CRLF**
— 329 `.js`, 96 `.json`, 57 `.md`, 12 `.py`, 10 `.html`, 1 `.yml`.

`tests/test-workflow-paths.js` did:

```js
for (const line of joined.split('\n')) { ... const m = line.match(/git\s+add\s+(.+)$/); if (!m) continue;
```

Every `line` therefore ends in a stray `\r`. In JavaScript `.` **excludes** the line terminators
`\n \r \u2028 \u2029`, so `(.+)` cannot consume the `\r`, and `$` without the `m` flag only asserts
at the very end of the string. The match fails **outright** — it does not merely capture a dirty
value, it does not match at all, so the `continue` fires and the line is skipped in silence.

State on disk when this was measured:

| workflow | CR | LF | `git add` |
|---|---|---|---|
| `ingest.yml` | 0 | 258 | dynamic only (`git add "$f"`) — reported and skipped by design |
| `smogon-stats.yml` | **98** | 98 | **the only static `git add` in the repo** |
| `tests.yml` | 0 | 56 | none |

So the one file holding the only static path was the CRLF one. `staged` stayed `0` for the check's
whole life. **The committed blob is LF, so this check works on CI and was blind locally** — the worst
available arrangement, because the machine where somebody edits a workflow is the machine where the
check is asleep.

The only reason this was visible at all is the check's own guard:

```
FAIL  no `git add` path was found in any workflow — this test asserted nothing, which is worse than failing.
```

That guard earned its keep. Without it the run would have printed `WORKFLOW PATHS: 1 passed, 0 failed`
and been believed.

---

## 3. The fix

Normalisation happens **once, at the read**, not inside the regex:

```js
const readWorkflow = p => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
```

A per-regex `\r?` would have fixed the instance and left the next regex added to this file exposed.
`\r\n?` also folds lone-CR. The count of CRLF files seen is now printed alongside the path count, so
the condition is visible rather than inferred.

The header's `SHOWN RED BEFORE BEING TRUSTED` claim was **false** when written. It is now true and
dated, and records both line endings.

## 4. The red demonstration

Both workflow files were backed up byte-for-byte to the scratchpad first and restored byte-for-byte
after; `git status --porcelain .github/` was empty afterwards, and the SHA-1s matched
(`smogon-stats.yml ed91e56c…`, `ingest.yml 1ed67dab…`).

**Planted (a):** the exact historical defect, `git add data/games.ladder.jsonl`, inserted into
`smogon-stats.yml` on a **CRLF** line — file verified still pure CRLF afterwards (99 CR / 99 LF).

*Old matcher, defect present:*
```
static git add lines matched by the OLD regex: 0
```
The regression the check exists to catch was on disk and the check could not see it.

*New check, same bytes:*
```
FAIL  smogon-stats.yml stages data/games.ladder.jsonl, which .gitignore excludes — `git add` exits 1
      and, under `bash -e`, kills the step before the commit
5 static `git add` path(s) checked  (1 workflow file(s) are CRLF in the working tree — normalised at the read)
```

**Planted (b):** the same line in `ingest.yml`, which is **LF** on disk — to prove the fix did not
merely move the blindness to the other ending:
```
FAIL  ingest.yml stages data/games.ladder.jsonl, which .gitignore excludes — …
```

**Removed, restored:**
```
ok    smogon-stats.yml stages data/smogon-stats
ok    smogon-stats.yml stages data/smogon-priors.json
ok    smogon-stats.yml stages data/smogon-priors-bo3.json
ok    smogon-stats.yml stages data/mew.js

4 static `git add` path(s) checked  (1 workflow file(s) are CRLF in the working tree — normalised at the read)
```

The non-zero count is the receipt. `0` and "everything passed" are the same output from a blind
matcher; `4` cannot be produced without looking.

---

## 5. Sweeping the class

A gate built from an instance catches that instance. Three passes, narrowing:

1. **Heuristic** — any file in `tests/`+`engine/` that reads text and uses `$`, `(.+)` or a `\n`
   split: **140 of 375**. Far too broad; most `$` regexes test *filenames* from `readdirSync`, not
   lines from a file.
2. **The idiom** — a bare `split('\n')` feeding a terminator-sensitive use within 30 lines: **27**.
3. **The measured discriminator** — below: **11**, of which **2** are real.

### The discriminator, measured not assumed

```
m-flag $ before CRLF      : ["alpha","alpha"]     <- SAFE
no-m $ , split on \n      : null                  <- THE DEFECT
\s*$ eats the CR          : ["alpha\r","alpha"]   <- SAFE
=== equality on a line    : false                 <- SILENTLY BROKEN
startsWith on a line      : true                  <- SAFE
endsWith on a line        : false                 <- SILENTLY BROKEN
JSON.parse tolerates CR   : true                  <- SAFE
```

**`\s` matches `\r`.** So a regex ending `\s*$` is *accidentally* immune and one ending `(.+)$` or
`)$` is not. In multiline mode `$` matches before a LineTerminator — which includes `\r` — so every
`/…$/m` in this repo is safe. That single character, and that one flag, is the entire difference,
and it is why the repo is mostly fine by luck rather than by design.

### Verdicts — the 11 surviving sites

| site | verdict | why |
|---|---|---|
| `tests/test-workflow-paths.js:84` | **WAS AFFECTED — FIXED** | this pass |
| `engine/conformance.js:110` `stripComments()` | **AFFECTED, LIVE NOW** | see below |
| `engine/orient.js:262` | **AFFECTED, LATENT** | see below |
| `tests/test-json-nan-guard.js:69` | safe | split used only as `.split('\n').length` to compute a line number; the `.endsWith('.py')` is on a `readdirSync` entry name |
| `tests/test-web-parses.js:66` | safe | same shape — line-number arithmetic; `/\.html$/` is on a filename |
| `engine/orient.js:143` | safe | `principle.split('\n').slice(0,3)` only prints; a trailing `\r` is invisible |
| `engine/provenance.js:423` | safe | per-line matches are `/\.(json\|jsonl\|js)['"\`]/` and a backtick `matchAll` — neither anchored. The `/\.(json\|js)$/` in the window is applied to `readdirSync` filenames |
| `engine/quarantine.js:2050` | safe | per-line uses are `WRITE.test(ln)` and an unanchored `matchAll`; the `$`-regex in the window is on filenames. File also normalises elsewhere |
| `engine/ingest_ots.js:61` | safe | per-line `.trim()` before use; JSONL, and `JSON.parse` tolerates a trailing `\r` |
| `engine/rollout_explore_sweep.js:57` | safe | `.map(s => s.trim())` immediately after the split |
| `engine/sprt.js:123` | safe | per-line trim; JSONL |
| `engine/medicham2-browser.js:6524` | safe | `.map(l=>l.trim())` immediately after the split (ENGINE's file; not touched) |

Separate pass for the two *silent* hazards (`=== 'literal'` and `.endsWith` on a split line): **1
candidate**, `tests/test-rollout-gates.js:68`, hand-verified **safe** — the split is joined straight
back, the comment filter is `^`-anchored, and the assertions use `\b…\s*:` and `/^\s*n\s*:/m`.

`build/` (11 files), `web/` (3) and `engine/*.py` (9) also carry a bare newline split. The Python
sites split **battle-log strings out of JSON**, not files off disk — git never translates those — and
use `.startswith(` / `.split("|")` / `.strip()`. `engine/sanity_check.py:23` uses `\s*$`, safe in
Python for the same reason. `.splitlines()` strips `\r` and is safe by construction. Not exhaustively
verified; listed in §7.

---

## 6. The two real findings

### 6a. `engine/conformance.js:110` — `stripComments()` is INERT on CRLF files. Live now.

```js
.map(line => line.replace(/(^|[^:])\/\/.*$/, '$1').replace(/^\s*#.*$/, ''))
```

`.*$`, no `m` flag, applied to a bare-split line. Demonstrated:

```
LF   -> "const x = 1; \nconst y = 2;\n"
CRLF -> "const x = 1; // gen9championsvgc2026regmb\r\nconst y = 2;\r\n"
py LF   -> "x = 1\n\n"
py CRLF -> "x = 1\r\n# gen9championsvgc2026regmb\r\n"
```

It strips **nothing** on a CRLF file. Of the **473** files `conformance.js` scans, **168 are CRLF**
and **98 of those carry `//` or `#` comments**.

The function's own header states its purpose: *"Comments are PROSE, and prose may name a thing in
order to explain it… Only code is checked, so the report stays about things that would actually go
stale."* That purpose is defeated on 168 files. The error direction is **over-firing** — comments
judged as code — which by this repo's own rule (#148) is the failure mode people learn to ignore.

The nastier consequence is for MEASURE specifically: `conformance.js` runs against a **ratchet
baseline**, so whether a finding appears depends on whether the file was last written by git
(CRLF) or by a node script (LF). That is a gate whose verdict moves with checkout history rather
than with the code. Not fixed here — not MEASURE's file, and it needs its own red demonstration.

### 6b. `engine/orient.js:262` — latent, and it fails to **zero**

```js
const j = ln.match(/^\*\*Job:\*\*\s*(.+)$/);
```

`docs/MODELS.md` is LF on disk **today**, so this works. It is tracked, and `core.autocrlf` is true,
so a fresh clone or a single `git checkout -- docs/MODELS.md` makes it CRLF. Differential on the
real file:

```
docs/MODELS.md   as LF: {"heads":34,"jobs":32}   as CRLF: {"heads":34,"jobs":0}
```

**32 → 0.** The headings survive because that regex ends `\s*$`; the `**Job:**` capture ends `(.+)$`
and does not. `orient.js` would then report every model as carrying no question — and it prints a
count, not an error. Not fixed here — not MEASURE's file.

---

## 7. This class has been paid for before

`engine/status.js:1212`, dated **2026-08-07**, carries the scar in full:

> *"CRLF, AND THE `\n` HERE SILENTLY SKIPPED A WHOLE LEDGER. `core.autocrlf` is `true` on this
> machine… a marker followed by `\r\n` does not match `-->\n` and docs/ENGINE.md reported
> `skip … (no GENERATED block)` while its block sat frozen at an older run's numbers. It printed the
> skip, which is the only reason it was caught at all."*

Same mechanism, same machine, same "only caught because it printed something". It was fixed **in
that file** with a local `\r?\n`, and nineteen days later `test-workflow-paths.js` shipped with the
identical bug. That is the species-key pattern the brief names: the instance was gated, the class was
not.

It belongs beside the two other invisible-character failures on the record — the regex holding two
raw `0x08` bytes so one alternative could never match (it *rendered correctly in an editor*), and the
coverage assertion whose comment said it fails while it exited on a different variable. **In all
three the check kept running and kept reporting success.**

---

## OWED, NOT RUN

Nothing here was fixed — each is another division's file and each needs its own red demonstration.

**1. `engine/conformance.js` — `stripComments()` inert on 168 of 473 scanned files (LIVE).**
Reproduce the blindness, then the fix, then the baseline delta:
```
node -e "const NL=String.fromCharCode(10);const f=s=>s.replace(/\/\*[\s\S]*?\*\//g,' ').split(NL).map(l=>l.replace(/(^|[^:])\/\/.*$/,'$1').replace(/^\s*#.*$/,'')).join(NL);const lf='const x = 1; // regmb\nconst y = 2;\n';console.log(JSON.stringify(f(lf)));console.log(JSON.stringify(f(lf.replace(/\n/g,'\r\n'))))"
```
Fix is one line at the read in `read()` / `stripComments()`: `.replace(/\r\n?/g,'\n')`.
Then, because it is ratcheted, the baseline must be re-settled deliberately rather than adopted:
```
cmd /c tools\lownode.cmd engine\conformance.js
git diff --stat data/conformance.json data/docs-currency-baseline.json
```
**Do not adopt the new baseline silently** — the delta is the measurement of how many findings were
CRLF artefacts. Writes `data/`, so it is not MEASURE's to run this pass.

**2. `engine/orient.js:262` — latent 32 → 0.**
```
node -e "const fs=require('fs');const md=fs.readFileSync('docs/MODELS.md','utf8').replace(/\n/g,'\r\n');let j=0;for(const l of md.split('\n'))if(l.match(/^\*\*Job:\*\*\s*(.+)$/))j++;console.log('jobs matched as CRLF:',j)"
node engine/orient.js | grep "models carry a question"
```
Fix is one line at the read: `rd()` returns `.replace(/\r\n?/g,'\n')`.

**3. The un-swept remainder** — `build/` (11 files), `web/` (3) and `engine/*.py` (9) carry a bare
newline split and were spot-checked, not exhaustively verified:
```
node C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\6e93c397-51cb-4089-996b-51fc61c6e7c7\scratchpad\sweep4.js
node C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\6e93c397-51cb-4089-996b-51fc61c6e7c7\scratchpad\sweep6.js
```
(Scratchpad is session-scoped; re-derive rather than trusting those files exist. Do not execute
anything else found in that directory — it is shared across sessions.)

**4. The class-level door.** No gate was added, deliberately (*"no bloat — just fix it"*). If one is
ever wanted, the correct shape is a single shared `readText()` that normalises, made the only door,
rather than a ratchet enumerating known-bad regexes — the ratchet-of-known-spellings is exactly how
the species-key bug walked past two gates.

**5. Pre-existing red, not mine, not touched.** `tests/test-workflow-paths.js` still exits 1 on its
second half:
```
FAIL  a tracked .gz store is STALE — games.ladder.jsonl, games.bo3.jsonl
```
That is a real finding about `data/`, unrelated to line endings, and `data/` is out of scope this
pass. Owner action:
```
node build/compress-stores.js
```
Not run: OPS/ENGINE agents were live and appending to those stores.
