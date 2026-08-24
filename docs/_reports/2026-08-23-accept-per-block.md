# The reviewed-and-fine mark now works per block — 2026-08-23, MEASURE

Historical findings record. Not maintained, not current state, superseded by the register row it
feeds. Instrument: `node tests/test-no-silent-failure.js`.

**No game was played, no engine was loaded, no fit was run, no gate or test was added.**

## The verdict

The silent-catch gate is **GREEN**. It reads **201 baselined + 62 accepted after review + 0 NEW**,
and it goes **red again the moment any one of the 62 blocks is edited**.

## 1. What changed, in one sentence

`--accept` used to take a **file** and sweep every new block in it into the floor under one reason.
It now takes a **block**, named by the hash of its catch body that the detector already computes,
and it takes one block per run.

```
before   node tests/test-no-silent-failure.js --accept engine/tag_dex.js "reason"
after    node tests/test-no-silent-failure.js --accept engine/tag_dex.js 97676330579b "reason"
```

The hash was already the ratchet's key. Nothing new was invented to name a block, and the run now
**prints the hash beside every block it reports**, so the accept command is a copy-paste rather than
something you derive by hand. `accepted` had sat empty `{}` for ten days: the door was the wrong
shape, not unwanted.

## 2. Why the unit had to move

`docs/_reports/2026-08-23-eighty-silent-catches-triage.md` read all 80 new blocks one at a time: 18
were real (fixed earlier today, 80 → 62) and 62 are correct as written. **Three files hold both kinds
at once** — `engine/tag_dex.js`, `engine/medicham2-browser.js`, `tests/test-web-quarantine.js` — so
accepting by file would have blanket-excused blocks nobody judged. That is the whole reason the
backlog could not be closed by fixing or by the old door.

## 3. The four-step demonstration, in order

| step | command | result |
|---|---|---|
| 1. red | `node tests/test-no-silent-failure.js` | `NEW 62`, **exit 1** |
| 2. accept | 58 separate `--accept <file> <hash> "reason"` runs | `accepted 58 key(s); 0 already covered` |
| 3. green | `node tests/test-no-silent-failure.js` | `NEW 0`, **exit 0** |
| 4. tamper | one accepted body edited (a comment, in `tests/test-coverage-stop.js:133`) | `NEW 1`, **exit 1**, named by file, line and new hash |

Step 4 was then reverted with `git checkout` and the gate returned to exit 0. It was run twice — once
mid-build and once against the final code — so the property is demonstrated on the bytes that ship.

**58 keys, 62 blocks.** The difference is §5.

## 4. Every one of the 62 carries a human-written reason

Each reason is the judgement from the triage's §6 table for that exact block, copied across. Nothing
says "accepted", "pre-existing" or a bare date. Checked mechanically after the fact: **0 of the 58
entries has a missing or sub-20-character reason.** Every accepted key also records the date, the
lines the body sits on, and the body text itself, so the record can be read without re-running
anything.

A sample row of `data/silent-catch-baseline.json`:

```json
"engine/orient.js#604a40a7c4d6": {
 "at": "2026-08-23",
 "why": "LOUD ALREADY (:105): the manufactured string IS the report — 'NO SUCH FILE' is printed verbatim as the file's age, so a reader sees the failure.",
 "count": 1,
 "lines": [105],
 "body": "return 'NO SUCH FILE';"
}
```

The reasons fall out as the triage classified them: **38 loud already** (the failure is reported one
or two lines below, where the regex cannot see it), **15 cannot fail** (the guarded call provably does
not throw here), **9 correct silence** (failure is the expected, handled outcome).

## 5. The one thing a reader must know: identical bodies share a key

The key is `<file>#<hash of the catch body>`, so **byte-identical bodies in the same file are one
key**, and accepting it covers all of them under one reason. This is a property of the ratchet key
that predates this change; it is not something the per-block unit introduced. Five keys are affected:

| key | blocks it covers | in the floor already |
|---|---|---|
| `engine/medicham2-browser.js#a4956e4a5354` | :5205, :5287 | 0 |
| `engine/medicham2-browser.js#da39a3ee5e6b` (empty body) | :6737, :10567 | 2, at :2836 and :3325 |
| `tests/test-lownode.js#da39a3ee5e6b` | :74, :80 | 0 |
| `tests/test-policy-promote.js#da39a3ee5e6b` | :251, :296 | 0 |
| `engine/champions_sim.js#b958762b3701` | :587 | 1, at :344 |

For each, the recorded reason **names every line and says why each one is right**, and where a
byte-identical sibling sits in the baseline floor the reason says so explicitly and says it is not
what the acceptance covers. The tool prints a `NOTE` line whenever a key covers more than one block,
so this cannot be accepted by accident.

**The limit, stated:** if someone deletes one of the two accepted empty bodies in
`engine/medicham2-browser.js` and adds a different empty one elsewhere in that file, the count stays
at 2 and the gate does not notice. That is the pre-existing hash-collapse hazard the triage flagged
around `engine/tag_dex.js:8623`; it is unchanged by this work, reported and not touched.

## 6. What the output shows a reader now

```
  baselined                201   <- the ratchet floor, set 2026-08-18
  accepted after review    62   <- block(s) a person read and signed off, under 58 body key(s),
                                 each with a written reason in data/silent-catch-baseline.json
  FIXED since the baseline 6
  NEW since the baseline   0
```

The 62 is on **its own line, always, even at zero**. It is not folded into the 201 — the floor is a
measurement of what existed on 2026-08-18 and an acceptance is a person's signature, and mixing them
would have made the floor unreadable and moved it to 263. `--in <file>` now prints `ACCEPTED` beside
a block and the reason underneath it, so the review record is readable where the code is.

## 7. The line this must not cross — what stops this being an off switch

- **No bulk mode exists, and none was added.** One key per invocation. The 62 were applied by a
  hand-written table of 58 reasons in a scratchpad driver, one `--accept` call each; a key with no
  row in that table would simply not have been accepted, and the gate would have stayed red and named
  it. The driver is not in the repository.
- **A reason is required and is checked for being a reason.** Refused, with exit 2 and no write:
  `"pre-existing"`, `"it is fine here"` (too short), a missing reason, and the old file-only form.
  Refused with exit 2: a hash that names no block (it then lists the hashes that file does hold).
- **An accepted block that changes fails again.** Demonstrated, twice, with exit codes.
- **The count is visible**, so "62 accepted" is a number somebody can be uncomfortable about.
- **A reason can be corrected** without touching the artifact by hand (the artifact says never to hand
  edit it). That path cannot change a count and cannot let a block through — it rewrites words only,
  and it prints the old and the new. Used twice, to name baselined siblings by their current lines.
- **The floor was not touched and `--update` was not run.** `entries` is byte-for-byte the same 166
  keys totalling 201.

## 8. Files changed

| file | what |
|---|---|
| `tests/test-no-silent-failure.js` | `--accept` takes a block; the hash is printed beside every reported block; the accepted total is printed on its own line; `--in` shows `ACCEPTED` and the reason |
| `data/silent-catch-baseline.json` | 58 accepted keys covering 62 blocks, each with a reason. `entries` unchanged at 201 |
| `.githooks/pre-commit` | **message only, no logic.** It printed the old two-argument `--accept` command, which my change made wrong. `bash -n` clean. Flagging it because this file is not MEASURE's — route it if that is not mine to touch |

The 62 blocks themselves were **not touched**. `git diff` on them is empty.

## 9. Proposed ROADMAP row text (MEASURE may not edit `docs/ROADMAP.md`)

> **#258 (accept granularity) — CLOSED 2026-08-23.** `--accept`'s unit is now a BLOCK, keyed by the
> hash of the catch body the detector already computes, one per invocation, reason required and
> checked. The 62 blocks the 2026-08-23 triage read and found correct as written are accepted under
> 58 keys, each carrying the reason written after reading that block; the count prints on its own
> line. The ratchet floor is untouched at 201 and `--update` was not run. Demonstrated red (62) →
> accepted → green → red again on editing one accepted body. Full account:
> `docs/_reports/2026-08-23-accept-per-block.md`.

> **NEW ROW — the hash-collapse hazard.** `engine/tag_dex.js:8623` — `catch (e) { v = null; }` around
> `t.of(o)` in the MAIN tag-derivation loop that writes `data/tags.json`, in the baselined floor and
> on nobody's list. Byte-identical bodies share one ratchet key, so a block of this shape can be
> swapped for another without the count moving. Reported by the 2026-08-23 triage, still untouched.

## 10. OWED, NOT RUN

| owed | why not |
|---|---|
| `CHANGELOG.md` entry and version bump | the coordinator said he would write it |
| `docs/ROADMAP.md` rows | MEASURE may not edit it; text proposed in §9 above |
| a line in `docs/MEASURE.md` recording this | not granted in the brief; the ledger is the coordinator's doc pass |
| `node engine/status.js --write` | **deliberately not run.** `status.js` publishes no silent-catch figure (checked), so `--write` would restamp every division ledger and race the other agents live in this tree. The read-only `node engine/status.js` was run and is unaffected by this change — its FAILs are the pre-existing MEDICHAM quarantine clauses |
| `node tests/run-all.js` | not run: it plays games, and the brief forbids that here |
| `node tests/test-no-silent-failure.js --update` | **deliberately not run.** It would drop the floor 201 → 197 on the strength of a detector change made today. The run says `6 baselined block(s) now speak` — that gain is real and is left unclaimed on purpose |
| the `engine/tag_dex.js:8623` decision | it is in the floor, not in the 62, and needs a register row (proposed in §9) |
| `data/_pair-pilot.json`, `data/medicham-represented-clicks.json` | untracked, not mine, **not touched and not deleted** — reported and left |

## 11. Two files moved under this run and were LEFT ALONE

`data/engine-release.json` and `data/provenance-stamp.json` are modified in the working tree and are
**not mine**. `engine-release.json` shows a release cut at 00:03:42Z with the reason *"ENGINE faint
restructure — baseline before any change"*, so another division is live in this tree right now. They
are reported and untouched; reverting them would clobber somebody else's work.

The read-only `node engine/status.js` this run made may have contributed the `provenance-stamp.json`
rewrite. Flagging it rather than guessing.

This does not put the result at risk. The acceptance is keyed on the **content** of each catch body,
so a tree moving underneath can only make the gate red on a genuinely new or edited block — it cannot
make an acceptance cover something nobody read. Re-checked at 00:04:54Z after the release cut:
`201 baselined + 62 accepted + 0 NEW`, exit 0.
