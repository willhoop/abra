# Control-arm partings wired into the gate — 2026-09-19, MEASURE (light mode)

A findings record, not a living document. It is not cited as current state; `node engine/status.js` is.
Main tree, no games played. Files edited: `engine/quarantine.js`, `CHANGELOG.md`, `docs/RUNNING-NOTES.md`,
`docs/MEASURE.md`. Nothing committed.

## 0. VERDICT

- **Wired into the mechanics clause** as its own sub-verdict, `controlArmCheck`. It is ANDed into both of
  the clause's return paths: the main path and the rows-missing / rows-vs-summary early exit.
- **Red on a plant, green on a clean fixture.** The selftest goes from **315 to 331 passed, 0 failed**. For
  the deliberate break, `&& CAC.ok` was removed from both verdicts. The result was **319 passed, 12 failed**:
  the failures are every red control-arm arm (12 after the strict change: 319 passed, 12 failed), and the green and excused arms stayed green.
- **The current artifact.** `data/all-mechanics-fire.json` is on release `d92bdfb50d88` and the tree is on
  `54d02066fd71`, so the clause is **WITHHELD by the release pin** before this half is reached. Read with the
  pin set aside, its contents give **CANNOT-ANSWER**: the file carries no `summary.control_arm_partings`
  because it predates 6.66.0.
- **6.66.1, PATCH.** No published figure moves (section 5).

## 1. WHERE, AND WHY NOT A NEW CLAUSE

- **Same artifact, same pin receipt, same owner shelves.** A new clause would parse the 2.8 MB file a
  second time. It would also be a second place where one artifact's verdict gets decided.
- **The gate stays at 10 clauses.** A new clause would move the published "N of 10" denominator. That
  would make this a MINOR, and `status.js`, `web/quarantine-data.js` and others would need a new name.
- **Kept apart from the subject-arm filters.** Reach, DECLARED and decision impact are all keyed on the
  row's subject. A control-arm parting belongs to the control: Hyper Cutter's row carried Anger Point's
  defect. So none of those three filters may subtract here. The half prints its own `CONTROL ARMS —`
  block and returns its own fields: `control_arm_ok`, `control_arm_cannot_answer`,
  `control_arm_denominator`, `control_arm_parted`, `control_arm_board_material`,
  `control_arm_failing_rows`, `control_arm_excused_rows`, `control_arm_announcement_only` and
  `control_arm_mismatch`.

## 2. THE BAR (read from the producer's verdicts, never re-derived)

| per-row `control_arm_parted` | reading |
|---|---|
| `board_material: true` (a STATE board) | **FAIL** |
| `NOT-ASKED` (the protocol parted and no board was taken after it) | **FAIL**, unanswered |
| a verdict outside {STATE, ANNOUNCEMENT-ONLY, NOT-ASKED}, or no verdict | **FAIL**, never read as quiet |
| ANNOUNCEMENT-ONLY | printed by name and not gated; this is narration's bar (Will, 2026-08-22) |

The following are CANNOT-ANSWER, which fails:

- No `summary.control_arm_partings`.
- `rows_with_control_arm` is 0. A "0 parted" read off an empty set is not a reading.
- A kind has no per-row list.
- The rows disagree with the summary on `parted`, `board_material` or `not_asked`.

**Excusals: STRICT** (coordinator, 2026-09-19, after this report first flagged the looser reading). A
parting is excused only in these cases:

- The CONTROL mechanic itself is in the artifact's `closet.ids` (tests/roster.js DEFERRED).
- The CONTROL mechanic is Illusion.
- The arm is played on a closeted Illusion body. Both arms share the carrier, so the closeted mechanic is
  in the control game itself.

A row is **never** excused because its SUBJECT is deferred. The control is a different mechanic, and a
deferred Frisk must not hide a defect in its control, Cursed Body. Every excusal is printed with the
control named. A `deferred` stamp excuses nothing. The proof half's predicate was extracted to
`ownerExcusal` without changing its behaviour. The control-arm half does not use it.

## 3. PROOF

Selftest arms, all driven through the shipping `mechanicsClause` on the fully PROVEN `PROW` fixture.
Each arm changes one row plus the matching summary. The subject arm is clean (`counted 0`, `proof_ok`),
so a red can come only from the control arm. The planted row is Hyper Cutter's real one: control Anger
Point, `boosts.atk us 6 sd 5` on `near-a` and `far-a`.

- GREEN control: 0 of 5 parted, and the clause is GREEN and says "none parted a board".
- RED: a BOARD-MATERIAL ability row gives exit 1. The row, the control and the parted leaf are all named,
  and the assembled `gateVerdict` turns red.
- RED: the same on an item row.
- ANNOUNCEMENT-ONLY: printed by name, and the clause stays green.
- RED: NOT-ASKED. RED: an unrecognised verdict (`THREW`).
- RED (STRICT): a row whose SUBJECT is in the closet block and whose control is not. EXCUSED: an Illusion carrier. RED: the same Illusion row with the harness
  closet unread. EXCUSED: the control entity is on the shelf.
- RED: an uncorroborated `deferred` stamp, which is named.
- RED / CANNOT-ANSWER: the artifact predates the field, with everything else green. RED / CANNOT-ANSWER:
  an empty denominator.
- RED: the rows and the summary disagree, and the clause says so.
- RED: the rows-missing early exit, which would otherwise be green, is held shut by this half.

**The deliberate break.** A copy of the file with `&& CAC.ok` stripped from `mechOk` and from the
early-exit `ok` was compiled under the real filename from the scratchpad, so the tree was not touched.
Result, re-run on the strict version: **319 passed, 12 failed**. The 12 are exactly the RED arms above. The GREEN,
ANNOUNCEMENT-ONLY and EXCUSED arms passed, so the arms detect the term and are not red on their own
account.

## 4. READING ON THE CURRENT ARTIFACT

The mtime was checked against the clock: the artifact was written at 16:32:08Z and read at 18:08Z, and
no writer was live on it.

- **The gate's own read** (`mechanicsClause()` off disk): `ok false, withheld true`. The reason given is
  "MEASURED AGAINST A DIFFERENT ENGINE — ran on release d92bdfb50d88 and the tree is 54d02066fd71", and
  it names three moved sources: `medicham2-browser.js`, `abra-tags.js` and `tags.json`.
- **This half on the contents** (`controlArmCheck(j, ownerShelves(j))`): `ok false, cannot_answer true`,
  "THE ARTIFACT PREDATES CONTROL-ARM RECORDING".

**Why.** The file was written at 16:31Z by the pre-6.66.0 battery. It has 0 rows with
`control_arm_parted` and no summary block. Its raw legacy `board_control_arm` holds 1 STATE row, which is
`abilities:hypercutter`, control Anger Point (verified). I did not re-derive from that legacy field, for two reasons:

- The brief says an artifact without the field is CANNOT-ANSWER.
- A second reader of the planner's control boards would be a second producer.

## 5. VERSION

**6.66.1, PATCH. No published figure moves.**

- The gate stays at 10 clauses.
- The last published reading is "2 of 10" on `d92bdfb50d88`. The mechanics clause was already one of the
  two failing clauses there (9 unproven staged rows), so adding a CANNOT-ANSWER to it changes nothing.
- No artifact is rewritten.

The notes row declares `Basis. unchanged` and `Supersedes. Nothing.`. `tests/test-docs-current.js`
clause 5d accepts it: "top 6.66.1 is a patch bump".

## 6. OTHER CHECKS

- `node --check engine/quarantine.js`: OK.
- `tests/test-docs-current.js`: **35 passed, 2 failed.** Both failures are "no new entries" in the
  figure-trace clauses, and every entry lies in the held next-major drafts already modified in the
  working tree: `ABRA-deck-plain-english.md` 3, `ABRA-technical-docs.md` 12, `MODELS.md` 5 and
  `SUMMARY.md` 3. They are not in any file I touched. My row first tripped the check once, on a timestamp
  (`16:31:26Z` read as the figure 26). I removed the timestamp and the row is now clean. I did not touch
  the drafts, as instructed.
- `engine/all_mechanics_fire.js` is modified in the tree by the concurrent ENGINE agent. Its diff
  touches none of the fields this reader depends on.
- Exported `controlArmCheck` and `ownerShelves` for reuse, so the next reader does not hand-roll a copy.
- Processes: every process I started exited on its own, and I killed none. One of my background greps
  ran past its timeout and finished normally.

## OWED, NOT RUN

- **The first real reading.** Owed is a full battery on `54d02066fd71` or later:
  `SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write --release <id> --team-store data/team-pool-frozen`,
  then `engine/quarantine.js`. Until then this half reads CANNOT-ANSWER. ENGINE's report expects
  0 board-material after the Anger Point fix on the 8 named rows. The other ~300 rows are unmeasured.
- **Move rows.** The published artifact has no move control-arm verdict. `planned[].control_board` is
  new in 6.66.0, and whether the battery populates move control arms at all is unverified. Read the
  per-kind denominators (`summary.control_arm_partings.by_kind.moves.rows_with_control_arm`) on the first
  real artifact. A zero there means this half says nothing about moves. It is not a clean result for them.
- The full `node engine/quarantine.js` gate was not run (light mode). Only the selftest and a direct
  clause call on disk were run.
- `node engine/status.js --write` was not run, per the brief. The re-measure will run it.
