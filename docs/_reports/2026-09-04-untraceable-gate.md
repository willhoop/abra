# The untraceable-figure gate went red because of where a backtick landed

**2026-09-04 · MEASURE · files touched: `engine/docs_scan.js`, `tests/test-docs-current.js`**
Not committed. `data/docs-currency-baseline.json` NOT edited — it was not even written, because the
ratchet did not move.

---

## 1. The split of the 129 — this decides everything else

| class | count | what it is |
|---|---|---|
| **(a) the checker's fault** | **94** | figures that ARE written in `CHANGELOG.md` and that the scan could not see |
| **(b) genuinely untraceable** | **35** | exactly the pre-existing baseline, unchanged, per document |
| **(c) something else** | **0** | — |

Sub-split of (b), for routing: **10 of the 35 are bibliographic identifiers**, not measurements —
seven arXiv IDs and a DOI on `docs/SLOWKING-whitepaper.md:351`, and `2304.08272` (an arXiv ID) three
times across `docs/ROLE-FAMILY.md` and `docs/ABRA-whitepaper.md`. The other 25 are superseded fitted
coefficients quoted inside `WITHDRAWN` / `CORRECTED` change records (DODUO's `−5.054`, the joint-fit
`−3.3425 / −3.3318 / −3.2447`, `24,997 / 82,483 / 63,305`). None of that is new and none of it is
this pass's business.

## 2. The hypothesis I was handed is REFUTED as the mechanism

> *"If `docs_scan.js` scans dated historical blocks the same way it scans live claims, every dated
> block goes untraceable the moment its artifact is republished."*

Measured directly. I rebuilt the union of every number in `data/*.json` **as it stands at `HEAD`**
(273 artifacts, 44,154 distinct numbers) and compared it against the union on disk now:

**0 of the 129 figures were in an artifact at HEAD and absent from the artifacts now.**
Tonight's five republished artifacts cost the census nothing.

The hypothesis was right about the *class* of thing at risk — recorded history losing its trace — and
wrong about the mechanism. `docs_scan.js` **already has** a dated-history exemption and already
documents it: `changelogHas()`, added for exactly this trap ("a gate that fires no matter what anyone
does is a gate that gets reported as a known failure"). It was not missing. It was broken.

## 3. What actually broke — a lexing bug, and it is a good one

`figuresIn()` strips inline code with

```js
.replace(/`[^`]*`/g, ' ')
```

`[^`]*` **matches newlines.** Every other strip in that chain is line-local — an ISO date, a version
string, a `lines N-M` citation — and this one silently was not. Three callers were handing it
multi-line input: `changelogHas` (the **entire** `CHANGELOG.md` as one string), `citationMismatches`
and `untraceableCensus` (a joined paragraph).

A markdown line carrying an **odd** number of backticks inverts the code/prose polarity of everything
after it. `CHANGELOG.md` is newest-first, so tonight's entry sits at the **top** — and it contains, at
line 29 of the working copy:

```
- **#332's TITLE CARRIED A CORRUPT `AND\|upkeep\`` FRAGMENT** with unpaired backticks, present since
```

An uncommitted changelog entry *about a corrupt backtick fragment* carries an unpaired backtick, and
that one character flipped the polarity of the 27,000 lines below it.

Measured, same tree, same moment:

| CHANGELOG.md scanned as… | distinct figures the exemption could see |
|---|---|
| one string (the shipped behaviour) | **889** |
| line by line | **2,431** |

63% of the recorded history was invisible. At `HEAD` — where the backtick count is even and the odd
lines pair off harmlessly — the same two numbers are **2,408 and 2,430**, which is why nobody saw this
before and why the baseline of 35 was recorded at the honest level rather than an inflated one.

That is the whole of it. `10 → 41` on the whitepaper and `1 → 11` on the technical docs, with no
figure added, from one character in a file neither document mentions.

## 4. The fix

`engine/docs_scan.js` gains `figuresInText(text)`: **fence-aware, line-oriented.** Fenced blocks are
skipped; inline code is stripped one line at a time so a backtick can never reach across a line break.
`changelogHas`, `citationMismatches` and `untraceableCensus` now call it. `paragraphs()` no longer
splits inside a fence, so a fenced block cannot be handed to the scanner as a fragment with its
opening ``` removed. Every fence in `docs/`, `docs/archive/` and `CHANGELOG.md` is balanced — checked
before this landed, 106 documents, zero unclosed.

**A naive per-line fix is wrong and I measured it being wrong.** It re-reads fenced blocks as prose
and immediately accused `docs/PRIOR-ART.md` of an untraceable `3,843` inside an illustrative ```
table of somebody else's dataset. The old span-eater had been excluding fences by *accident* — ``` is
three backticks. The exclusion is now deliberate and stated.

### Why this is a correction and not a loosening

- It adds **no exemption**. The sources are still `data/*.json` (minus the two files that are copies
  of documents) and `CHANGELOG.md`, exactly as before.
- On the document side it is **stricter** — per-line scanning reads prose the span-eater was deleting.
- I did **not** introduce a "dated block" rule, so there is nothing to game by dating a paragraph.
  The exemption is *"the figure is written in the CHANGELOG"*, and writing a figure into the CHANGELOG
  is a recorded claim under a version and a date, in a diff a reviewer sees. A heading cannot buy it.
- The baseline file was not touched. The gate reports **no ratchet movement**.

## 5. Proven red, both arms

**The lexer proof** (`LEXING_CASES` / `lexingProof()` in `docs_scan.js`, asserted as one clause in
3b(c)) is five synthetic cases run through the real function. Each rejected implementation fails
exactly one, in opposite directions, so no one-sided change can satisfy the set:

| case | must | new | whole-file (old) | naive per-line |
|---|---|---|---|---|
| `a-plain-figure-is-read` | read | ok | ok | ok |
| `inline-code-is-not-a-claim` | skip | ok | ok | ok |
| `odd-backtick-line-does-not-eat-the-next-line` | read | ok | **FAIL** | ok |
| `a-fenced-block-is-quoted-output-not-a-claim` | skip | ok | ok | **FAIL** |
| `prose-after-a-fence-is-still-read` | read | ok | ok | ok |

**The census proof.** `untraceableCensus` now takes an injectable `read` (same pattern
`retractionRegistry` already used), so a claim about what it catches is demonstrable on a document
whose content is known, without writing a file into `docs/`. `3,809` was chosen by search: the
smallest four-digit value present in **no** `data/*.json` and **not** in `CHANGELOG.md`.

| synthetic living document (version-headed) | must | result |
|---|---|---|
| live block: *"the leaf named the winner on 3,809 of the decisive pairs"* | **CATCH** | caught |
| dated block: *"**Change record for 3.47.0.** …compared 12,445 turn boundaries"* | be quiet | quiet |
| a figure the artifacts hold today (`961 paired games`) | be quiet | quiet |
| `3,809` inside a ``` fence | be quiet | quiet |
| `3,809` on the line after a stray backtick | **CATCH** | caught |
| **`3,809` inside a DATED `Change record for 3.47.0.` block** | **CATCH** | caught |

The last row is the one that matters for the "can it be gamed" question: **a dated block is not a
shield.** Only the figure's presence in the recorded history exempts it, and dating the paragraph
does nothing.

## 6. Gate state after the change

`node tests/test-docs-current.js` → **24 passed, 0 failed.**

```
== 3b(c). census: figures with no artifact behind them anywhere ==
  ok   the figure lexer reads what it must and skips what it must not (5/5 demonstration cases hold)
  ok   no living document gained untraceable figures (35 across 6 documents)
```

Every other ratchet is bit-identical: retracted-figures-restated 8→8, cited-artifact mismatches 66→66,
unversioned-exempt 56→56, archive-grandfathered 25→25, and the census set returns to exactly the
baseline's six documents at 14 / 10 / 7 / 2 / 1 / 1. `data/docs-currency-baseline.json` was left
untouched by the run.

---

## OWED

1. **Not committed.** `engine/docs_scan.js` and `tests/test-docs-current.js` are modified on disk
   only. A CHANGELOG entry and a version bump are owed with them — I did not write one because
   `CHANGELOG.md` is uncommitted and being written by another agent right now, and two writers on one
   file is how the later write silently wins.
2. **`CHANGELOG.md` line 29 (working copy) has an unpaired backtick** and renders wrong. Not mine and
   a writing agent is live, so I left it. It no longer affects the gate; it is a content defect.
   Route to whoever owns tonight's changelog pass.
3. **10 of the 35 residual untraceable figures are bibliographic identifiers, not measurements** —
   arXiv IDs and a DOI. This is the same class as `WIRE 117`, which `ID_WORD` already fixed once. A
   strip would tighten the ratchet (SLOWKING 7→0, ROLE-FAMILY 2→0, whitepaper 10→9) and therefore
   *writes* the baseline file, so it belongs in its own diff rather than riding along with this one.
   Not started.
4. **The other 25 residual figures are superseded fitted coefficients inside `WITHDRAWN` /
   `CORRECTED` blocks** (DODUO, the joint fit, the MAG refit). They are quarantined numbers by
   `CLAUDE.md`'s own rule and their artifacts are on the refit list. Nothing to do until the refit;
   listed so nobody re-derives it.
