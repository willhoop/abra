# The mechanics clause now fails an unearned FIRED ability credit — 2026-09-19, MEASURE (light mode)

A findings record, not a living document. It is not cited as current state; `node engine/status.js` holds that.

Main tree, HEAD `97f68254` (the 6.67.0 commit; the brief's `5aaf3eeb` is the same change before the bot's
next-regulation commit landed under it — same message, not on a branch). No games played, no release cut, no
artifact written. Runs: `engine/quarantine.js --selftest` and scratch copies of it, all through
`tools/lownode.cmd`.

## 0. VERDICT

- **Wired.** An in-scope ability row that reads FIRED on a LIVE control (a loud control ability, a click swap
  or an item swap) and has no receipt from its own handler now fails the mechanics clause **as an unproven
  row**, named, in the same failing list, with the same scope and the same owner excusals.
- **Red and green shown.** Selftest **331 → 353 passed, 0 failed**. On a scratch copy with the per-row check
  forced to credit, **13** arms fail; with the cannot-answer door removed, **3** fail. Green arms stayed green
  in both.
- **Today's reading.** The artifact on disk (`data/all-mechanics-fire.json`, release `d92bdfb50d88`, generated
  2026-09-19T16:31:26Z) is **stale**: the tree is `54d02066fd71`, so the release pin withholds the whole
  clause. It also **predates 6.67.0**, so the new term reads **CANNOT-ANSWER** ("THE ARTIFACT PREDATES THE
  CONTROL WATCH"). No count from it is repeated here.
- **The ~40 click/item-swap rows are read on their RECEIPT.** The clause takes the receipt class, not only the
  A/B and not only the boolean. A selftest arm credits a row with `earned_by_subject_receipt: true` over receipt
  `none`, and the clause fails it.

## 1. WHAT THE TERM READS

`engine/quarantine.js`:

- `controlWatchTerm(j)` reads `summary.abilities.control_watch`. It returns CANNOT-ANSWER when any of these hold:
  - the block is missing, or `fired_on_live_control` / `fired_on_live_control_unearned` is not an array
    (an artifact written before 6.67.0);
  - `games`, `handler_calls`, `subject_games` or `subject_handler_calls` is not a number;
  - the watch is **BLIND**: control games were watched and no handler was called, or the same for the subject
    watch. The producer prints `!! BLIND` in this case. A blind watch would read every control as quiet.

  It also compares the rows with the summary. The set of rows carrying `control_live` must equal the ids in
  `fired_on_live_control`. The set whose credit is not `true` must equal `fired_on_live_control_unearned`.
  A mismatch fails the term.
- `unearnedReason(r)` runs only after `PROVEN.abilities` has passed (the row is FIRED with a control). It
  takes the producer's verdict and does not re-derive it, but it checks that verdict against the receipt:

| row | label | reading |
|---|---|---|
| no `control_live`, `control_watch.measured && quiet` | — | passes |
| no `control_live`, no measured quiet watch | `FIRED, CONTROL NEITHER WATCHED QUIET NOR MARKED LIVE` | fails |
| `control_live`, receipt `state` / `narrated` / `log`, `earned_by_subject_receipt: true` | — | passes |
| `control_live`, receipt `latent-only` / `none`, not credited | `FIRED ON A LIVE CONTROL, UNEARNED` | fails |
| credited, but receipt `latent-only` / `none` | `... CREDITED ON A RECEIPT THAT DOES NOT EARN IT` | fails |
| earning receipt, but not credited | `... THE STAMPS DISAGREE` | fails |
| a receipt class this reader does not know | `... RECEIPT CLASS UNRECOGNISED` | fails |

  The producer (`engine/all_mechanics_fire.js`) puts one of the two stamps on every FIRED ability row: a row
  with no measured watch gets `control_live.kind = 'ability-unmeasured'`. So a row with neither stamp was never
  looked at.
- **Excusals** go through the existing `ownerExcusal`. They cover the SUBJECT on `closet.ids` (tests/roster.js
  DEFERRED, read from the artifact) and the Illusion closet (the harness's `closet` block from the lattice
  artifacts). The rule is **strict**: the control's shelf excuses nothing, because the question is whether the
  subject is proven. A `deferred` stamp that neither source backs is named and excuses nothing.
- **Output.** The unearned rows appear under `PROOF` with their label. A `CONTROL WATCH —` line prints three
  things: the live count, the earned count by receipt class, and the unearned count, or the reason the term
  cannot answer. New result fields: `control_watch_ok`, `control_watch_cannot_answer`, `control_watch_mismatch`,
  `control_watch_live`, `control_watch_earned`, `control_watch_unearned`, `control_watch_by_receipt`. The
  clause's `why` line appends `AND THE CONTROL WATCH CANNOT ANSWER` so that "0 unproven" never reads as clean.
- **Exit code.** When only this term cannot answer, the clause exits **1** and not 2. The 6.66.1 control-arm
  half follows the same convention. The top-level `cannot_answer` is not set, because that would turn every
  other red in the clause into a 2. Either way it is not a pass.

## 2. THE ~40 ROWS THAT "PROVE NOTHING BY THE A/B"

These are the 39 click-swap controls plus 1 item swap (Shadow Tag) in the 6.67.0 sweep
(`docs/_reports/2026-09-19-quiet-controls-legacy.md` §4a, light mode, release `54d02066fd71`, not a
main-tree artifact). The producer stamps `control_live` on every one of them, so the clause credits each row
**only** through `unearnedReason`: a known earning receipt class **and** the credit, in agreement. The A/B
verdict alone (`FIRED` + `control`) no longer carries them.

On that sweep's receipts, 38 of the 40 would pass on their receipt: `state`, plus `log` for Levitate and
Parental Bond. Long Reach (`latent-only`) and Overgrow (`none`) would fail. That count comes from the 6.67.0
report's table and was not re-read here, because no main-tree artifact carries these fields yet.

Selftest arms that pin this:
- `state`, `narrated` and `log` on a click-swap row each clear;
- `state` on an item-swap row clears;
- `latent-only` fails;
- `earned: true` over `none` fails, with rows and summary agreeing, so only the receipt read can catch it.

## 3. PROOF

- `--selftest`: **353 passed, 0 failed** (baseline this session 331 / 0). 22 new arms, all under
  `CONTROL WATCH`. Three existing fixtures (`PROW`, the PIN GUARD `mBase` and the control-arm summaries) gained
  a clean `control_watch`. Without it they read CANNOT-ANSWER for a reason that is not what they test; one
  (`PIN GUARD / GREEN`) went red for exactly that reason and was fixed in the fixture, not in the clause.
- **Deliberate break 1**, a scratch copy (`engine/_tmp_q_break_unearned.js`, created and deleted by me) with
  `unearnedReason` returning `null`: **340 passed, 13 failed**. The 13 are every red and excused arm of the
  term: the planted unearned row, the gate turn, latent-only, the credit/receipt lie, the unknown class, the
  row with no stamp, the loud watch left unstamped, both excusals, the Illusion row with no closet, the strict
  control-shelf arm, the uncorroborated stamp, and the rows-missing early exit. Every GREEN arm stayed green.
- **Deliberate break 2**, `engine/_tmp_q_break_cannot.js`, created and deleted by me, with `controlWatchTerm`
  returning before any check: **350 passed, 3 failed**. The 3 are the pre-6.67.0 artifact, the blind watch
  and the rows-vs-summary mismatch.
- **The planted red** is Corrosion's shape: control Toxic Debris LOUD, receipt `none`. The row fails with exit
  1, `counted 0` and `control_arm_ok true`, so nothing else holds the clause red. **The planted green** is
  Aerilate's shape: a click swap with receipt `state`.

## 4. READING ON THE CURRENT ARTIFACT

`q.mechanicsClause()` on disk returns `withheld: true`: "MEASURED AGAINST A DIFFERENT ENGINE —
data/all-mechanics-fire.json ran on release d92bdfb50d88 and the tree is 54d02066fd71". I called the proof
half directly on the same file, bypassing the pin, only to read this term. It gives `earned.cannot_answer:
true`, with "THE ARTIFACT PREDATES THE CONTROL WATCH". The artifact holds 0 rows carrying `control_live` or
`control_watch`. The other proof counts from that call belong to a withheld artifact and are not reported.

## 5. FILES CHANGED

- `engine/quarantine.js`: `controlWatchTerm`, `unearnedReason`, `controlWatchLine`, the proof-half wiring in
  `mechanicsProof`, the new result fields, `cwTail` in the clause's `why`, 22 selftest arms and three fixture
  updates.
- `CHANGELOG.md`: 6.67.1 (PATCH).
- `docs/RUNNING-NOTES.md`: the 6.67.1 row.
- `docs/MEASURE.md`: the 6.67.1 section. The GENERATED block was not touched, and `status.js --write` was not
  run.
- This report.

`tests/test-docs-current.js` reads **exit 1** with two ratchet FAILs ("figures a cited artifact does not
contain" 18 → 29, "figures bound to no trace" 1884 → 1880 with new entries). Every NEW entry is in
`docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`, `docs/MODELS.md` or `docs/SUMMARY.md`. These
are the held next-major drafts, modified in the tree before this session and not touched by me. None is in a
file I edited.

No git commit or push. Every process I started exited on its own, and none was killed. Debris I saw and left:
the six untracked `docs/_reports/2026-09-11-*.md` files and the modified deck, technical-docs, MODELS and
SUMMARY `.md`/`.pdf` files. They predate this session.

## OWED, NOT RUN

1. **The first real reading.** It needs the full staged-game battery on `54d02066fd71` or later, pinned, which
   writes `summary.abilities.control_watch` into `data/all-mechanics-fire.json`. Until then the term cannot
   answer on disk. On the 6.67.0 light sweep, expect about nine unearned rows (Corrosion, Damp, Infiltrator,
   Leaf Guard, Long Reach, Overgrow, Pickpocket, Poison Touch, Sticky Hold), less any the owner has shelved.
   The ~146 statically quiet planner controls that were never watched are unmeasured.
2. **The docs gate is red on the held drafts** (§5), and it reads the working tree. The 6.67.0 commit set those
   drafts aside and restored them byte-identical afterwards, and this commit will need the same. I did not run
   the gate with the drafts set aside, because they are not mine to move.
3. **What a `state` receipt proves.** It proves the subject's handler changed a leaf, a modifier or a return
   value in the fixture game. It does not prove that the board leaf the A/B compared moved *because of* that
   change. A second opinion is owed on whether the credit should also require the moved leaves to intersect
   the subject watch's leaves.
4. **Exit-code convention.** A sub-term that cannot answer makes the clause exit 1 (like 6.66.1's control-arm
   half), not 2. If the register should read UNMEASURED for this case, both halves change together.
5. **Coordinator:** `node engine/status.js --write`, commit and push. Not run, by brief.
