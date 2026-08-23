# The silent-failure ratchet, read rather than relayed — 2026-08-23, MEASURE

Historical findings record. Not maintained, not current state, superseded by ROADMAP #258.
Instrument: `node tests/test-no-silent-failure.js`. No game was played and the simulator was not loaded.

## 1. What the gate actually says

The relayed figure was right. Read directly, before I touched anything:

```
files scanned 386   catch blocks 878
silent 295 (34%)    of those MANUFACTURE 42 new / 96 total
baselined 201       FIXED 1       NEW 95      exit 1
```

After the two instrument fixes in §4: **91 NEW (40 manufacturing, 51 skip), exit 1.** Still red.
Two runs eight minutes apart both read 91 — no drift, despite ENGINE writing `game_differential.js`
throughout (it was last written 6 seconds before my first scan; see §5).

**The gate is auto-discovered by `tests/run-all.js`** (`readdirSync(tests/)` + `^test-.*\.js$`, no
exemption), so `run-all` is red for this reason too.

### "NEW since the baseline" does not mean "new since 2026-08-18"

The baseline stamps `generated: 2026-08-18`, which is the date of the last `--update`, not of its
contents. The floor was set on **2026-07-31** (`56ab7bb`) and `--update` is monotone since #258, so it
has only ever fallen: 229 → 234 → 232 → 220 → 216 → **201**. Nothing has ever been added back.
`accepted: {}` is **empty** — the only door into the floor has never been opened in the nine days
since it was built.

So the 91 are everything written since 2026-07-31 that nobody fixed or accepted.

### It has regressed, and that is the finding this report exists for

ROADMAP #258's status line records the last measurement, by MEASURE on 2026-08-19:
**67 NEW / 24 manufacturing**, after that session fixed 24 reachable blocks.

Today, on the same instrument (my pre-fix numbers, like-for-like): **95 NEW / 42 manufacturing.**

> **+28 NEW and +18 manufacturing in four days.** This is not a static pre-existing debt. It is
> growing faster than the one session that has ever worked it could clear it.

## 2. The risk split — 40 manufacturing blocks, every one read

| | count |
|---|---|
| **(a) DANGEROUS** — manufactures a value a consumer trusts, and the failure is plausible | **13** |
| (b) not a defect — LOUD CALLER: the sentinel is tested on the next lines and reported | 16 |
| (b) not a defect — cannot realistically fail, or the silence is correct | 11 |
| | **40** |

The 51 skip-class blocks are `continue` / comment-only bodies over ragged or optional input. Two
deserve a line and neither is urgent: `engine/gate_fail_and_silent.js:254` (an unreadable
`data/engine-release.json` makes its *measured against a different engine* clause silently not fire)
and `engine/mega_census.js:95` (torn store lines dropped uncounted).

### (a) The thirteen, ranked

| block | what it manufactures | why it matters |
|---|---|---|
| `tests/roster.js:1990` | `buildableSpecies` → `false` on a throwing `mcKey` | **Highest.** Used as a filter in 22+ places (`CANDIDATES.filter(s => buildableSpecies(s.id))`). A throw silently removes a body from every candidate pool, so the lab stages fewer scenarios and reports the ones it did stage as clean. This is `buildMon("Scizor")` returning null, inside a ruler that was already lying for nine days. Blame: **2026-08-08**. |
| `engine/million_run.js:1843` | `speciesGender` → `'N'` | Every body becomes genderless, so gender-reading mechanics never fire and the instrument reports the mechanic ABSENT — the exact failure the surrounding comment warns about. Blame 2026-08-11. **The old classifier had this in the SAFE column** (§4). |
| `tests/roster.js:1706` | `ok = false` → `COULD-NOT-STAGE` | A *thrown* precondition is reported as a fixture that did not land. "A COULD-NOT-STAGE verdict is a claim about the fixture, never about the mechanic" — you have corrected this twice. Blame 2026-08-10. |
| `tests/roster.js:8574` | `st = null` → `"not staged by the rule"` | Same conflation, heal-staging arm. |
| `engine/where.js:34,35,36,45` | `null`, `null`, `[]`, `[]` | An unreadable file reads as *nothing found* in the index tool whose whole job is "which file owns this fact". `sources()` → `[]` reports the frozen set as empty. Blame 2026-08-22. |
| `tests/test-unmodelled-clicks.js:95` | `prev = null` | An unreadable prior artifact skips the `did not GROW` comparison and **the ratchet passes**. A ratchet that stops ratcheting silently. |
| `tests/test-web-quarantine-loaders.js:290` | `w.ABRA_STATUS = null` | A bundle that throws gives `models = []`, so the evidence-leak check passes vacuously. |
| `engine/orient.js:94` | `rd` → `null`, consumed as `rd(...) \|\| ''` | A ledger that cannot be read reads as an empty ledger. Blame 2026-08-23. |
| `engine/orient.js:394` | `pending = 0` | An unreadable `docs/_inbox/` prints as an empty inbox. Blame 2026-08-23. |
| `engine/game_differential.js:3582` | `mediResult = null` | A throwing `battleResult` reads as "neither side won". **ENGINE holds this file — named and left.** |

### (b) Why the other 27 are not defects

**Loud caller (16).** The dominant idiom in this repo: the catch assigns a sentinel and the very next
lines test it and shout. `engine/orient.js:152,186,300,323` each hit `fail(...)`;
`engine/medicham2-browser.js:5064,5146` write `MEDFAILS.residualUnplaced` /
`MEDFAILS.switchInPriorityTableMissing` with a worded `…Why`; `engine/game_differential.js:2342`
does `console.error` + `process.exit(2)`; `tests/roster.js:231` throws with a full explanation;
`engine/policy.js:81` sets `stallKnown`, which prints *"data/tags.json unreadable, so the stalling
family could not be DERIVED; not guessed"*. Also `roster.js:9262,9280`,
`test-farm-ram-guard.js:67`, `test-roadmap-register.js:179`, `test-state-differential.js:456`,
`test-web-quarantine.js:459`, `orient.js:99`.

These still discard *why*, so they are not free — but they are not the failure this gate was built
for, and the gate cannot see the next line. That limit is now stated in the file's own header
rather than left to be rediscovered.

**Cannot fail / correct silence (11).** `engine/tag_dex.js:749,915,8604` and
`engine/game_differential.js:457` wrap `dex.*.get()`, which does not realistically throw;
`engine/switchin_order.js:77` is documented and the artifact records `null` honestly;
`tests/staged_board.js:1007` falls back to the live validator (slower, still correct);
`tests/test-forme-assert.js:113` fails in the safe direction (a throw produces a FAILURE report);
plus three probe paths and `test-switch-carry.js:83`.

## 3. Is any dangerous one in the play layer? **No.**

- `engine/board.js` — **zero** blocks flagged, new or otherwise.
- `engine/medicham2-browser.js` — 2 flagged, and **both are loud MEDFAILS receipts**, verified by
  reading the lines below each.

All thirteen dangerous blocks are in **instruments and tooling**: the mechanics lab (3), the
million-run fixture builder (1), the whole-game differential (1, ENGINE-held), the index and
orientation tools (6), and two test-file ratchets.

That is better news than the brief feared and it is not good news. A leaf is worth what its ruler is
worth, and `roster.js:1990` is a ruler quietly shrinking its own population.

## 4. What I changed — `tests/test-no-silent-failure.js` only

Both are **class** fixes, not enumerations, and both were shown against constructed cases with
negative controls before being trusted (16/16 as specified).

**(i) The classifier was reading the wrong body, and it hid danger.** `blank()` replaces string,
template and regex literals with spaces so offsets still map — right for the brace scanner and for
`isSilent`, wrong for `manufactures`. `return 'NO SUCH FILE';` strips to `return              ;`,
which `/\breturn\b(?!\s*;)/` reads as a bare `return;`. **So a catch handing a made-up STRING to its
caller was filed under "merely skip/continue, usually legitimate."** New `declank()` rebuilds the
body with blanked regions as `0` instead of space; comments become runs of zeros, so a comment
containing the word "return" still cannot fool it. Used only by `manufactures()`, so it **cannot**
move a block between silent and speaking and **cannot** change whether the gate passes.

Recovered two real ones from the safe column: `engine/orient.js:99` and — the one that matters —
`engine/million_run.js:1843`, the genderless-fixture block, which had been sitting in the "usually
legitimate" list since 2026-08-11.

**(ii) `SPEAKS` did not recognise the caught binding being handed back.** `catch (e) { return e; }`
is the loudest possible report — the caller receives the Error itself. The file already forgave one
spelling of this (`.message`); this generalises it to the binding returned, assigned, or a property
of it read, and requires a plain identifier binding. Fifth correction of this kind in this file, same
justification each time: it can only **shrink** the silent set. Cleared `register_reality.js:618,749`,
`test-orient.js:51` (the only correct way to wrap `execFileSync`, which throws on non-zero exit) and
`test-lownode.js:49`.

> **95 → 91, and the gate stayed RED.** The detector change cannot be read as a way to make it pass.

Its header now states what it cannot see: the loud-caller class needs look-ahead into the enclosing
scope, which this file does not do and which is not a regex, and 16 of the 91 are that shape.

**I did not restamp the baseline.** `--update` is left unrun deliberately: my detector change made
4 *baselined* blocks speak, so `--update` would now lower the floor 201 → 197 on the strength of a
detector change rather than a code fix. That is your call, not mine.

## 5. Did tonight contribute? Barely.

- **23 of the 91** are in files that did not exist at the last `--update`; **10 of those in files
  created today** — `engine/orient.js` (8), `tests/test-red-run-writes.js` (1),
  `tests/probe_phaze_empty_bench.js` (1).
- **Of the 13 dangerous, 2 blame to today** (`orient.js:394`, `game_differential.js:3582`, both
  committed earlier today by other sessions). The rest date 2026-08-08 to 2026-08-22, and the worst
  one is **fifteen days old**.
- The live ENGINE agent's working tree contributes **none**, confirming its stash test independently:
  the only working-tree-modified source file among the 91's files is `engine/game_differential.js`,
  and all three of its blocks blame to committed lines.

## 6. An instrument defect I found and deliberately did not fix

**`--accept`'s unit is a FILE; the unit of judgement is a BLOCK.** `engine/orient.js` has 5
loud-caller blocks and 2 real ones. There is no way to accept the 5 without also laundering the 2.
Nine days after `--accept` was built as the only door into the floor, `accepted` is still `{}` — it
has never been used once. That is evidence the door is the wrong shape, not that nobody tried.

Per-block acceptance would dissolve the "one file, one reason, owned by one division" discipline
#258 chose on purpose, so this is a design decision for Will, not a change I should make at 3am.

## 7. For Will to decide

1. **Do not re-baseline.** Confirmed not done. `--update` would drop the floor 201 → 197 off a
   detector change alone.
2. **Route the thirteen.** `tests/roster.js:1990` first — it is the one that can quietly shrink a
   measured population. Every fix keeps the conservative value and *adds* the reason (a counter or a
   named `console.error`); inventing a different answer is a second defect, not a fix.
3. **`--accept` granularity** — file or block (§6).
4. **If a waiver is the answer, it needs to name the growth, not the count.** The honest sentence is
   *"91 NEW, of which 13 manufacture a value something trusts, none in the simulator, and the
   population grew 28 in four days"* — not *"pre-existing"*, which is the word #258 exists because of.

### Proposed ROADMAP #258 status-column text (not applied — MEASURE may not edit ROADMAP.md)

> **RE-MEASURED 2026-08-23 BY MEASURE AND IT HAS REGRESSED, WHICH IS THE PART TO KEEP.** 878 catch
> blocks, 287 silent (33%), 201 baselined, **91 NEW of which 40 MANUFACTURE** (95/42 on the
> pre-fix instrument, which is the like-for-like figure). The 2026-08-19 entry recorded **67 NEW /
> 24 manufacturing** after that session cleared 24: **+28 NEW and +18 manufacturing in four days**,
> so this is a growing debt and not a static floor. All 40 manufacturing blocks were READ, not
> counted: **13 dangerous, 16 loud-caller (the sentinel is tested and reported one line down, which
> this gate structurally cannot see), 11 that cannot fail or are correct silence.** **NONE IS IN THE
> PLAY LAYER** — `board.js` flags zero and both `medicham2-browser.js` blocks are loud `MEDFAILS`
> receipts; the thirteen are in the rulers and the tooling, worst first `tests/roster.js:1990`
> (`buildableSpecies` returns false on a throwing `mcKey`, silently shrinking 22 candidate filters in
> the mechanics lab — blame 2026-08-08). **THE INSTRUMENT HAD A HOLE THAT HID DANGER AND IT IS
> FIXED**: `manufactures()` read the space-blanked body, so `return '<string literal>'` classified
> identically to a bare `return;` and sat in the "usually legitimate" column — `engine/million_run.js:1843`
> (`speciesGender` → `'N'`, making every staged body genderless so gender-reading mechanics read as
> ABSENT) had been filed safe since 2026-08-11. `SPEAKS` also now recognises the caught binding being
> handed back (`catch (e) { return e; }`), clearing 4. **95 → 91 AND THE GATE STAYED RED**, so neither
> change can be read as laundering; both shown against constructed cases with negative controls.
> **NOT RE-BASELINED** — `--update` would now lower the floor 201 → 197 on a detector change rather
> than a code fix. **AND THE ONLY DOOR INTO THE FLOOR IS THE WRONG SHAPE**: `--accept` takes a FILE
> while judgement is per BLOCK (`orient.js` = 5 loud-caller + 2 real, inseparable), and `accepted` is
> still `{}` nine days after it was built. Account: `docs/_reports/2026-08-23-no-silent-failure.md`.
> VERIFIED BY: `node tests/test-no-silent-failure.js`

## 8. OWED, NOT RUN

| owed | why not | command |
|---|---|---|
| The 13 dangerous fixes | cross-division files; ENGINE live tonight | per file |
| `--update` (floor 201 → 197) | would move the artifact off a detector change; Will's call | `node tests/test-no-silent-failure.js --update` |
| `docs/MEASURE.md` ledger + CHANGELOG for the gate change | coordinator owns CHANGELOG tonight; `status.js --write` forbidden while ENGINE is live | `node engine/status.js --write` |
| ROADMAP #258 status update | MEASURE may not edit ROADMAP.md tonight | §7 text above |
| Re-run after ENGINE's differential lands | 3 of the 91 are in `game_differential.js`, written during this measurement (no drift observed across two runs) | `node tests/test-no-silent-failure.js` |
| Whether the loud-caller class should be detected rather than judged | needs look-ahead into the enclosing scope; not a regex, and unproven machinery in a gate is worse than a stated limit | — |
