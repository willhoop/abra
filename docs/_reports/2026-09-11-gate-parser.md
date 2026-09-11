# The gate's own parser: a red marker missed on letter case, a status cell cut at a quoted pipe

2026-09-11, MEASURE. Release `534442d71183`. Everything below was measured on this tree; the
pre-edit bytes are preserved in the session scratchpad (`quarantine.old.js`) and every "old parser"
figure comes from running the shipping functions LIFTED out of those bytes, never from re-typing them.

The gate's own correctness is the subject because Will has approved releasing on the gate's verdict.
A gate that reads OPEN because its parser could not see a claim is worth less than no gate.

**TWO DEVIATIONS FROM THE BRIEF, BOTH FORCED BY THE TREE MOVING UNDER THIS PASS.** This work was asked
for as version 6.27.0 with 6.26.0 at the top of the logs. While it ran, another pass published
**6.27.0 and 6.28.0** and added ROADMAP **#603**; `docs/MEASURE.md`, `docs/ENGINE.md`, `CHANGELOG.md`
and `docs/RUNNING-NOTES.md` were all rewritten between 18:13 and 18:25. So this pass is **6.29.0** —
writing 6.27.0 would have put an older heading above newer ones — and the register measurement in §4
was taken TWICE, before and after, rather than once and dated. Nothing else was affected: the gate
figures below were read after that writer went quiet.

---

## 1. WHAT WAS WRONG, AND IT WAS FOUND BY ENGINE, NOT BY THIS FILE

**(a) THE BREAKAGE TOKEN WAS CASE-SENSITIVE.** `roadmapRowSaysBroken` tested `/\bDEFECT\b/`. ROADMAP
#601's status cell said `ENGINE defect`, its instrument was RED, and the row read `saysBroken: false`
— so the gate printed OPEN over an open row backed by a failing measurement. Capitalised by hand, the
same register read `GATE: CLOSED — 1 of 9` (docs/ENGINE.md, the 6.26.0 section).

**(b) A STATUS CELL COULD HOLD NO PIPE, NOT EVEN AN ESCAPED ONE.** `roadmapRowStatusCell` was
`/\|\s*([^|]*)\|\s*$/`. `[^|]` stops at the `|` of a `\|` exactly as at a bare one, so a cell quoting
a protocol line — `\|upkeep\|`, `` `|faint|p2b` `` — was cut at the quote and the detector read the
tail as the whole status. #601 and #440 both hit it and read STALE ROW. `roadmapRowIsClosed` carried a
SECOND copy of the same pipe regex for its closed clause, so the two disagreed about where a cell
starts.

Both are #148's lesson again — *"a defect register whose enforcement depends on word choice is a
structural weakness"* — arriving through LETTER CASE and through NOTATION rather than through word
choice.

## 2. THE FIXES ARE RULES, AND A BLIND `/i` WAS MEASURED TO BE WRONG BEFORE IT WAS REJECTED

Surveyed over all 564 register rows' status cells, counting defect-family words:

| spelling in a status cell | rows |
|---|---|
| `DEFECT` | 150 |
| `defect` (lower case) | 61 |
| `defects` / `DEFECTS` / `DEFECTs` | 6 / 3 / 1 |
| `open-defect` — the NAME of this clause | 3 |
| `-instrument-defects-` — a report FILENAME | 3 |
| `NOT A DEFECT` — the ruling | 11 |
| `NOT AN ENGINE DEFECT` and `no defect` — denials in words | 5 |

A case-fold alone turns *the open-defect clause*, a filename and four denials into breakage claims,
which is the over-firing gate #148 warns about. So the token is, deliberately:

- **the NOUN** `defect` or `defects`, in any case. The plural was as invisible as the case was.
- **standing alone.** A hyphen or word character either side makes it part of a NAME, and a name
  claims nothing. **`defective` is not the token** — it is an adjective, 0 status cells use it, and
  the register's declared vocabulary is the noun. The prose fallback keeps its own separate list.
- **never inside a denial** — `not a(n) [engine] defect`, `no [engine] defect(s)`. `NOT A DEFECT`
  remains THE RULING and the one escape hatch, in any case, and is still receipted by number. The
  other denials excuse nothing; they merely contribute no token, and every row where a denial is the
  only reason no token was read is now **printed by number on every run** (`DEFECT_DENIED`), on the
  same terms as the ruling: a door nobody can see being used is a hole.

And the cell is the text between the last two **COLUMN DELIMITERS** — skipping a backslash-escaped
`\|` and any pipe inside an inline code span, with an unpaired backtick run read as literal
(CommonMark 6.1). `roadmapRowIsClosed`'s closed clause now reads THROUGH that one function instead of
carrying its own regex.

*Honest limit, stated rather than dressed up:* GitHub's GFM splits table cells before inline parsing,
so an UNESCAPED pipe inside backticks does split the rendered cell even though this reader keeps it.
Where the two disagree, this reader follows what the row's author meant; `\|` is read the same way by
both.

## 3. RED ON THE OLD PARSER, GREEN ON THE NEW — SHOWN, NOT ASSERTED

Thirteen arms, each run against BOTH parsers (the old side lifted from the pre-edit bytes):

```
  old RED   | new GREEN  want OPEN+BROKEN  (a) a lower-case `defect` in the cell is a breakage claim (the #601 shape)
  old RED   | new GREEN  want OPEN+BROKEN  (a) the PLURAL is the same claim
  old GREEN | new GREEN  want OPEN         (a) `NOT A DEFECT` still excuses, in lower case as in capitals
  old GREEN | new GREEN  want OPEN         (a) a hyphenated NAME is not a claim: "the open-defect clause"
  old RED   | new GREEN  want OPEN         (a) a DENIAL is not a claim: "NOT AN ENGINE DEFECT"
  old GREEN | new GREEN  want OPEN         (a) `defective` is an adjective and is not the token
  old RED   | new GREEN  want OPEN+BROKEN  (a) a denial does not cancel an independent claim in the same cell
  old RED   | new GREEN  want CLOSED       (b) a CLOSED cell quoting an escaped pipe is closed (the #601/#440 shape)
  old RED   | new GREEN  want CLOSED       (b) a CLOSED cell quoting a pipe inside inline code is closed
  old RED   | new GREEN  want OPEN+BROKEN  (b) THE DANGEROUS DIRECTION — an open DEFECT cell cut past its token
  old GREEN | new GREEN  want OPEN         (b) a cell that says `open` still outranks prose when it quotes a pipe
  old GREEN | new GREEN  want CLOSED       (b) control: a clean closed cell is unchanged
  old GREEN | new GREEN  want OPEN+BROKEN  (b) control: a clean open DEFECT cell is unchanged

  7 of 13 arms are RED on the old parser; 0 are RED on the new one.
```

All thirteen now live in `engine/quarantine.js --selftest` (267 passed, 0 failed), with the row head
padded past 600 characters on purpose: inside that window the PROSE fallback decides, and an arm
decided by the fallback tests nothing about the cell.

`tests/test-register-cell-parse.js` was RE-DERIVED rather than left to pass by accident. Its three
pipe-shaped doors (#9001 code-span pipe, #9002 `\|` escape, #9007 the #175 direction) are no longer
doors, so they became CONTROLS asserting the reading the shipping parser must give — if the old regex
ever returns, they fail by name. Its lift arm was INVERTED: it used to assert the shipping reader DOES
cut at a code-span pipe, and now asserts it reads the cell whole through both a code span and an
escape. Live register: **0 rows whose verdict depends on the parse, 0 cut cells** (it reported 90 rows
carrying 631 non-delimiter pipes before), 3 rows whose backtick runs do not pair (#166, #517, #519 —
reported, not judged), 2 with an empty cell (#6, #30).

## 4. WHAT THE FIXED PARSER COUNTS DIFFERENTLY — THE WHOLE REGISTER, BOTH PARSERS

Every row's gate-visible verdict computed under both: **12 verdicts move, and every one moves in the
gate-SHUTTING direction** (open → open-and-asserting-breakage). There is no movement in the other
direction: nothing that used to count stops counting, and no closed row opens or vice versa.

**MEASURED TWICE, BECAUSE THE REGISTER MOVED UNDER THE MEASUREMENT.** First over **564 rows** at
17:45, and again over **566 rows** at 18:26 after another writer added ROADMAP #603 and a row of its
own: the same 12, the same direction, the same causes. The re-check is not decoration — a figure taken
across a moving corpus is the failure this repository is organised against, and the honest fix is to
take it again rather than to date it.

| row | old | new | why it moves |
|---|---|---|---|
| #67 | OPEN | OPEN+BROKEN | lower-case token |
| #207 | OPEN | OPEN+BROKEN | lower-case token |
| #284 | OPEN | OPEN+BROKEN | `ENGINE, documentation defect` |
| #285 | OPEN | OPEN+BROKEN | `instrument defects`, plural |
| #367 | OPEN | OPEN+BROKEN | lower-case token |
| #423 | OPEN | OPEN+BROKEN | lower-case token |
| #473 | OPEN | OPEN+BROKEN | lower-case token |
| #495 | OPEN | OPEN+BROKEN | lower-case token |
| #507 | OPEN | OPEN+BROKEN | lower-case token |
| #533 | OPEN | OPEN+BROKEN | `INSTRUMENT defect` |
| #543 | OPEN | OPEN+BROKEN | lower-case token |
| #550 | OPEN | OPEN+BROKEN | lower-case token |

**ALL TWELVE COME FROM THE CASE RULE. The cell rule moves no live verdict today** — because ENGINE had
already reworded #601's and #440's cells to say the protocol lines in words, which is the workaround
the defect forced. It is fixed so that the next row quoting a protocol line is not decided by where a
pipe fell.

**None of the twelve names an instrument.** Checked row by row: 0 carry a `VERIFIED BY:` marker (4
carry `INSTRUMENT OWED:` — #367, #495, #533, #543). Under the clause's own rule — *a row holds the
gate shut when it names an instrument and that instrument is RED* — all twelve are **DEBT**: printed
by name, counted, carried in the artifact, and holding nothing shut. That is not a loophole and it is
not an opinion of mine; it is the standard every other clause here meets, and it is why the gate's
verdict is decided by measurements rather than by twelve sentences somebody typed.

## 5. THE #440 CLOSETED DECLARATION IS WITHDRAWN

`engine/quarantine.js`'s `DECLARED_DIVERGENCE` carried one CLOSETED row: the perish drain sitting
above `|upkeep|`, closeted by Will on 2026-08-28 under the 2026-08-27 standing rule. ENGINE fixed the
underlying defect in 6.26.0 (#601's zombie walk; #440's follower was a corpse), the pinned pool went
**1 → 0 divergent games of 961**, and the whole-game register printed the row as *MATCHED NOTHING IN
THIS RUN* — which is falsifier (d) of the row's own written falsifier, arriving from the other end.

**Withdrawing a declaration that covers nothing TIGHTENS the gate.** It removes a standing permission
to subtract; nothing that diverges today stops being counted. Will's closeting is not reversed and it
is not reusable: the dated record stays in ROADMAP #440, and if the pair ever returns it is a new
divergence against the engine of the day and holds the gate shut until somebody measures it again.
The shipping closet now holds **no CLOSETED row** (the only remaining `kind: 'CLOSETED'` literal in
the file is the selftest's synthetic fixture, which is what keeps the door itself tested).

The row is preserved here verbatim, because a closet that silently loses rows teaches nobody:

```js
  {
    kind: 'CLOSETED',
    name: 'the perish drain sits above `|upkeep|` when the authority puts it below',
    match: (c, ev) => {
      if (!/ :: \|upkeep <> \|faint\|p[12][ab]$/.test(String(c || ''))) return false;
      const rows = (ev && ev.firsts) || [];
      /* NO EVIDENCE IS A DECLINE, NEVER A MATCH — `causeEvidence`'s own contract. */
      if (!rows.length) return false;
      return rows.every((r) => Array.isArray(r.showdown_before)
        && r.showdown_before.some((l) => /^\|-start\|p[12][ab][^|]*\|perish0$/.test(String(l))));
    },
    why: 'A REAL DEFECT, OURS, AND THE POSITION OF A LINE RATHER THAN THE STATE OF A BOARD. '
       + "`perishsong.condition.onEnd` is `add('-start', target, 'perish0'); target.faint()`, and "
       + '`Pokemon#faint()` only QUEUES — the line is written by a `faintMessages()`. `fieldEvent`\'s '
       + 'duration-expiry branch `continue`s past the one at sim/battle.ts:565, so the deaths are paid '
       + 'by the next handler that does not itself expire, and when none does they fall to the tail of '
       + '`runAction` at :2832, EIGHTEEN LINES BELOW the `|upkeep|` written at :2814. This engine\'s '
       + '`residualFollowerRuns` decides the same question from a derived handler list and answers '
       + "TRUE on this one board where the authority's walk answers false. One game of 961, turn 11.",
    closet: {
      by: 'Will',
      on: '2026-08-28',
      authority: 'ROADMAP #440',
      ruling: 'STANDING RULE, 2026-08-27, verbatim: "things in the closet shouldnt block a gate if we '
            + 'know why they fail and choose to accept it." APPLIED TO THIS ROW 2026-08-28 — Will '
            + 'authorised closing the last open MEDICHAM gate clause by declaring this divergence, '
            + 'with a note saying we could not make it work. THE 2026-08-28 AUTHORISATION IS RELAYED '
            + 'THROUGH THE COORDINATOR AND IS RECORDED AS RELAYED, NOT DRESSED AS A QUOTATION; the '
            + 'sentence in quotation marks is the 2026-08-27 standing rule and nothing else is quoted.',
    },
    evidence: {
      instrument: 'engine/game_differential.js (arm middle, pins ccb365985023, --team-store '
                + 'data/team-pool-frozen, cap 12, 961 games), comparing boards through '
                + 'engine/board_state.js',
      release: '5f3f7141227c',
      on: '2026-08-28',
      says: '12,445 turn boundaries compared and 12,445 IDENTICAL; games_board_never_diverged 961 of '
          + '961; protocol_diverged_games 6 and protocol_diverged_board_never_did 6; '
          + 'first_board_divergences []. The leaf a real faint difference would move is COMPARED and '
          + 'agreed — `fainted` with `hp`/`maxhp`/`status` on the active bodies (board_state.js:866), '
          + 'the party (:1034) and the bench (:769, :843) — so this is a leaf that was looked at, not '
          + "one of ROADMAP #528's 43 leaves in neither list.",
    },
    falsifiedBy:
      'ANY of: (a) the pair appearing on a first-divergence row whose `showdown_before` carries no '
    + '`perish0`, which would mean the exemption has spread to a different residual drain; (b) the '
    + 'board claim failing — `state.games_board_never_diverged` below `state.games`, or '
    + '`protocol_diverged_board_never_did` below `protocol_diverged_games`, or a non-empty '
    + '`state.first_board_divergences`; (c) `MEDFAILS.residualFollowerUnmapped` becoming non-empty, '
    + 'which would mean the predicate is BLIND to a follower rather than merely wrong about one board, '
    + 'and makes this a bigger claim than one game; (d) the cause reaching more than the single game '
    + 'measured here. Any one of those and this row comes out and #440 goes back on the gate.',
  },
```

## 6. A CLOSED ROW WHOSE INSTRUMENT CANNOT ANSWER — THE RULE, AND THE PROOF IT REACHES NO GATE

ROADMAP #375 and #467 are CLOSED rows whose probes read `ABRA-EXIT 2 CANNOT-ANSWER`, because the
pinned pool has no divergence left for them to attribute. The rule, stated:

- **It is PRINTED, and `engine/register_reality.js` still exits 1 on it.** An instrument that cannot
  answer is a hole in the RULER. Silence there is the "capability absent, everything reported success"
  shape, so it stays in `BAD`.
- **It is not a disagreement and must not be counted as one.** "N row(s) disagree with their own
  instrument" was a FALSE sentence about it — the same defect the rejected-marker split fixed on
  2026-09-04. `failureSummary()` now names three kinds separately (disagree / marker rejected /
  answered nothing), each row appearing in exactly one, asserted in that file's selftest (88 passed,
  0 failed).
- **It reaches NO gate clause in either direction when the row is CLOSED.** `registerEvidence` walks
  the OPEN list, and a closed row is skipped before any verdict is read. This is now ASSERTED rather
  than argued, with a control: the same CANNOT-ANSWER verdict on an OPEN row lands in `unrunnable` and
  does hold the clause shut, so the arm is a statement about open-versus-closed and not about the
  verdict being ignored everywhere.

## 7. `game_differential.js --out` WROTE NOTHING AND SAID NOTHING

The artifact write lives inside `if (WRITE)`; `--out` only chooses the PATH. So `--out <file>` without
`--write` played every game, printed the whole comparison, wrote no file and **exited 0**. Measured at
961 games on 2026-09-10 (`docs/_reports/2026-09-10-phase1-census-repin.md:220`) and again here.

**RED, on the pre-edit bytes** (pins: release `534442d71183`, `--census data/mechanics-census.json`,
`--team-store data/team-pool-frozen`, `--games 1`, `--turns 50`):

```
  ... DIVERGED (primary arm middle): 0 of 8 games ... 312 lines of output ...
  EXIT=0        data/verification/_gd-out-red-before.json: No such file or directory
```

**GREEN, after:** the same command refuses at second zero with exit 2, naming `--write`, and creates
no file. **CONTROL:** the same run WITH `--write` and no `--out` is untouched — it still falls to the
pre-existing coverage-arm refusal, so the new guard is specific rather than refusing everything.

It REFUSES rather than implying `--write`, for the reason the coverage-arm guard already gives: asking
by omission is what produced that reading in the first place, and `--write` is the one flag in that
file that means A FILE IS PUBLISHED. The guard is `require.main === module`-only, because `argv` there
is the whole process's argv and `engine/all_mechanics_fire.js` has an `--out` of its own; the two
probes that pass `--out` to this file (`tests/probe_corner_arm_measures.js`,
`tests/probe_state_void_exclusion.js`) both pass `--write` in their base args and are unaffected.
`tests/test-game-differential.js` PART 6 carries the arm and the control permanently (ALL PASSED).

## 8. THE REGISTER REPUBLISHED, AND THE GATE ON THE FIXED PARSER

`node engine/register_reality.js` — 185 verdicts, generated 2026-09-11T22:23:25Z, NEWER than
docs/ROADMAP.md (22:13:49Z), so no clause is judged on verdicts that predate it. Exit
`ABRA-EXIT 1 VERDICT-RED`, and the summary now names its three kinds apart: **7 rows disagree with
their own instrument, 9 markers REJECTED, 8 rows whose instrument answered nothing** (#273, #375,
#413, #424, #449, #467 CANNOT-ANSWER; #578, #579 UNRUNNABLE). The rows this pass touched:

| row | verdict |
|---|---|
| #601 | CONFIRMED (was STALE ROW — the parser could not read its cell) |
| #440 | CONFIRMED |
| #602 | CONFIRMED — the new row for this fix, decided by `node engine/quarantine.js --selftest` |
| #375, #467 | INSTRUMENT CANNOT ANSWER, on CLOSED rows — printed, and reaching no clause |

Then the gate, verbatim:

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
```

All nine clauses PASS. The open-defect clause, verbatim at its head:

```
    PASS  no open, known engine defect   clean: no open row names an instrument that is RED — no open
    defect is backed by a failing measurement (185 verdict(s) read)
```

**WHAT THE FIXED PARSER CHANGED IN THAT CLAUSE, IN ITS OWN RECEIPT:**

- **DEBT: 14 open rows → 26.** The twelve rows in §4 joined it: #175, #207, #220, #284, #285, #67,
  #334, #361, #362, #365, #367, #369, #393, #397, #400, #403, #421, #423, #441, #473, #495, #507,
  #530, #533, #543, #550. Every one asserts breakage and names no instrument, so every one is printed,
  counted, carried — and holds nothing shut.
- **The NOT A DEFECT receipt is unchanged**: 11 rows, of which 1 (#252) would otherwise have counted.
- **The new denial door prints 3 rows**: #266, #279, #420 — cells whose only `defect` token sits inside
  a denial. None is excused by it; the prose fallback still decides them.
- **The declared register is 1 row, CLOSETED: 0** (Supreme Overlord `fallenundefined`,
  AUTHORITY-WRONG, which is load-bearing in the mechanics clause). The closet is empty again.

**THE HONEST ANSWER TO "DOES THE GATE NOW CLOSE": NO, AND HERE IS WHY IT IS NOT A NARROWING.** The
clause fails on `withRed` or on an instrument that answered nothing — a MEASUREMENT, not a sentence.
The twelve rows the fixed parser newly counts name no instrument at all, so they cannot produce
either. Had one of them carried a RED `VERIFIED BY`, this section would report `GATE: CLOSED`; the
check was run row by row before the gate, not inferred from the verdict afterwards. What the fix buys
is that the NEXT row to say `defect` in lower case beside a red instrument will shut the gate, which
is exactly what #601 failed to do.

## 9. COMMANDS

```bash
node engine/quarantine.js --selftest                 # 267 passed, 0 failed
node engine/register_reality.js --selftest           # 88 passed, 0 failed
node tests/test-register-cell-parse.js               # PASSED — 0 rows' verdicts depend on the parse
node tests/test-game-differential.js                 # ALL PASSED, including PART 6
node tests/test-roadmap-register.js                  # 3 passed, 0 failed
node tests/test-docs-quarantine.js                   # all checks passed
node engine/register_reality.js                      # republished data/register-reality.json
node engine/quarantine.js                            # the gate — verdict in §9
```
