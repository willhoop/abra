# Five markers that could never run, and a clause that summed a ruler defect with a world defect — 2026-09-04 (MEASURE)

Scope: `docs/ROADMAP.md` (5 rows) and `engine/quarantine.js` only. No game was played, no instrument
was started, `data/register-reality.json` was not written, `engine/register_reality.js` was not run in
measuring mode and was not edited, nothing was committed.

---

## 1. What each of the five markers became

| row | state | was | is |
|---|---|---|---|
| #316 | closed | `SHOWDOWN_PATH=... node tests/roster.js --stage items --release <id>` | **`node tests/roster.js --selftest`** |
| #318 | **OPEN, asserts breakage** | `SHOWDOWN_PATH=... node tests/roster.js --stage moves` | **NO MARKER — `INSTRUMENT OWED`** |
| #319 | **OPEN, asserts breakage** | `SHOWDOWN_PATH=... node tests/roster.js --stage moves` | **`node tests/roster.js --stage moves`** |
| #330 | closed | `data/switchin-order.json` | **`node tests/test-resolution-order.js --only a2-red`** |
| #526 | closed | `SHOWDOWN_PATH=... node tests/probe_volley_collapse.js` | **`node tests/probe_volley_collapse.js`** |

Four are commands. One is a declared debt, and that is the measured answer rather than a shrug.

### The `SHOWDOWN_PATH=...` prefix was decoration in every case, and that was checked, not assumed

`engine/showdown_path.js` resolves the sibling checkout and **sets `process.env.SHOWDOWN_PATH` as a
deliberate side effect**. All three instruments require it before they look at the variable:

- `tests/roster.js:129` `require(D('engine', 'showdown_path.js'));` then `:131` the guard
- `tests/probe_volley_collapse.js:64` the same, then `:65` the guard
- `tests/test-resolution-order.js:113` the same, then `:114` the guard

The sibling checkout is present on this machine (`../pokemon-showdown/sim` exists). So dropping the
prefix removes nothing: it was a usage-doc convention copied into a cell that gets executed.

### `--release <id>` was removed rather than filled in, and that is the stronger repair

The brief allowed picking a real id. Neither row needs one, and pinning one would be worse:

- `tests/roster.js:145` — `ER.open(ARG('--release') || null)`, and `open(null)` **takes the newest
  release**. It does not cut.
- `tests/test-resolution-order.js:121` preloads `tests/_live_release.js` itself when `--release` is
  absent, so its `ER.cut` at `:138` freezes into the **temp** store. Nothing is cut into the real one.
- `tests/probe_volley_collapse.js:67` preloads `_live_release.js` the same way.

A literal id in a marker ages out. `docs/LESSONS.md` §12 records 168 of 200 releases stranded, and a
stranded id turns a marker into a THROW. "Newest" is self-correcting; a typed id is the fourteen stale
handoffs in a fifty-character costume.

### #316 — why the selftest and not a stage

The row's headline symptom is verbatim a selftest clause: *"the inert click focusenergy moves NO board
leaf in either engine over 3 turns"* is `selftest()` arm 1 (`tests/roster.js:8787`), and `main()`
returns its failure count, so the exit code is red exactly when the instrument is untrustworthy.

A stage run was rejected on a stated ground rather than a preference, and the ground is the REGISTER
rather than a run of my own: #319 records **5 FIRED-AND-BOARDS-DIFFER** on the moves stage, and its own
account puts `bigroot` (#385) and `greninjite` (#356) on the items stage. I re-ran neither — this pass
plays no games — so read it as *the register says these stages are red*, which is precisely the risk: a
stage marker on a CLOSED row sits one open defect away from filing that row as `PREMATURE CLOSE` on
somebody else's defect. A wrong verdict is worse than the silence it replaced.

Stated limit, in the row: one exit code cannot carry three claims. The stale-artifact withhold half is
`node engine/quarantine.js --selftest` and the control-shape cap is `--selftest --inert substitute`;
both are named in the row's account and neither is carried by this marker.

### #318 — no command can decide it, and the row already said so

This is the one that matters, because it is OPEN and asserting breakage.

`tests/roster.js:9167` passes `learnsetMode: 'report'` to `SB.fixtureAudit`. In
`tests/staged_board.js:1191-1202` a report-only refusal goes into `reported` and is **printed**;
`bad` never sees it. `bad` is the whole of the exit code:

```js
const bad = (by['FIRED-AND-BOARDS-DIFFER'] || []).length + (by['DID-NOT-FIRE'] || []).length
          + redRows.filter(r => !r.ok).length;        // tests/roster.js:9699
...
if (require.main === module) { const bad = main(); process.exit(bad ? 1 : 0); }
```

So `node tests/roster.js --stage moves` would exit **0 on 632 learnset refusals**. Repairing the
prefix would have produced a marker that reports this row CONFIRMED-and-green while the defect it
names is untouched — the "a capability was absent and everything reported success" shape, manufactured
on purpose. **Refused.**

The row already carried `INSTRUMENT OWED: the LEARNSET CLAUSE IS REPORT-ONLY count published into the
roster artifact` in its account, and `data/roster.moves.json` carries `counts`, `scope`, `reds`,
`mirror`, `results` and no refusal figure. `parse()` only reads `INSTRUMENT OWED` when there is no
`VERIFIED BY`, so removing the marker is what makes the declaration visible. Verified below.

### #330 — the old marker named an artifact, and neither thing the cell named is an instrument

`engine/switchin_order.js` prints its derivation and **falls off the end at exit 0 whatever it finds** —
it has one `process.exit`, at `:65`, for an absent checkout. A `MEDSEEN` counter is a number in a
process, not an exit code. Neither can decide a row.

Arm `a2-red` in `tests/test-resolution-order.js:355` **is** the row: card 5 rebuilt, Torkoal base Speed
20 against Sinistcha base Speed 70 with Hospitality's `onSwitchInPriority: -2`. It fails unless the
streams agree clean, PART under the surgical revert `entry-sort-speed-only`, and the
`switchInPrioritySeparated` delta is exactly 1 — a knob that moves, inside the arm's own accounting
(`tests/test-resolution-order.js:865`). The arm id was derived from the file, not remembered.

**Unmeasured and said so, in the row as well as here:** the file declares `ABRA-HEAP: 6144` for its
FULL 26-arm run, and `engine/register_reality.js` refuses `--max-old-space-size` by design
(`UNKNOWN NODE OPTION`). The header's own stated mechanism is that *each of the 26 arms OPENS A FROZEN
RELEASE and the snapshots accumulate inside one process*, so `--only` running one arm is expected to
fit the default heap. Nothing has measured that, because measuring it plays a game. If it does not
fit, the verdict is `EXIT CODE UNDECLARED` (134) — loud, and not a false green.

### Verified as `register_reality.js` would see them, without starting it

Requiring the module runs its driver, which `execFileSync`s all 124 markers. So `classifyMarker` was
lifted out of the **shipping bytes** by line span and driven directly, and the `MARKER` and `OWED`
regex literals were lifted the same way and compared to the probe's copies (a drift throws).

```
#316  closed=true   MARKER "node tests/roster.js --selftest"                  ADMITTED  FILE EXISTS
#318  closed=false  NO MARKER -> INSTRUMENT OWED
              OWES: the `LEARNSET CLAUSE IS REPORT-ONLY` count published into the roster artifact...
#319  closed=false  MARKER "node tests/roster.js --stage moves"               ADMITTED  FILE EXISTS
#330  closed=true   MARKER "node tests/test-resolution-order.js --only a2-red" ADMITTED FILE EXISTS
#526  closed=true   MARKER "node tests/probe_volley_collapse.js"              ADMITTED  FILE EXISTS
5 of 5 rows found by the shipping row regex
```

`closed` and `saysBroken` come from the shipping `Q.roadmapRowIsClosed` / `Q.roadmapRowSaysBroken`, so
the edits are confirmed not to have flipped a row's status. #318 and #319 are still open and still
assert breakage. Every admitted marker names a file that exists.

The probe is at
`C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\72879879-cc78-43c3-bf5d-01280add6e63\scratchpad\marker_verify.js`.

---

## 2. The clause now separates refused from broken. Yes.

`engine/quarantine.js`'s `openDefectClause` bucketed on the `green` tri-state alone, so `null` was one
heading — *"open row(s) name an instrument that WOULD NOT RUN"*. In the last real artifact **all 27
rows under it were `SAFE` rejections**: nothing had been asked of a single one of those instruments,
and a defect in the RULER was being reported in the words of a defect in the WORLD.

**Three changes, all in `engine/quarantine.js`:**

1. `REGISTER_REALITY.rejectedVerdict = 'MARKER REJECTED'` joins the shape contract that already lives
   on the reader's side. It is not typed inside the clause: the writer cannot be required from here
   (the dependency runs writer → reader, and requiring it executes the driver), so a selftest arm
   **compares the literal to `engine/register_reality.js`'s shipping bytes** instead. A rename on
   either side is red.
2. `registerEvidence(open, byRow)` — pure, exported, the **only** place that decides which of the two
   null facts a row carries. It returns five disjoint buckets *and* the two sentences, built beside
   the buckets they count, so a bucket cannot be renamed without its wording moving with it.
3. `rejected` is its own key in the clause's return value and is **never summed into** `unrunnable`.

The two sentences, on synthetic input:

```
>> 1 open row(s) name an instrument that WAS NEVER ASKED — engine/register_reality.js refused to
   READ the marker (`MARKER REJECTED`), so no instrument started and the row is neither verified nor
   reported as unverified. That is a defect in the RULER or in the ROW and never in the instrument,
   and it is repaired by fixing the marker, not the engine: #3.
>> 2 open row(s) name an instrument that WAS ASKED AND ANSWERED NOTHING USABLE — it would not start,
   or it ran and declared cannot-answer, or it exited outside {0,1}. That is not agreement and it is
   not evidence either: #4 [INSTRUMENT UNRUNNABLE], #5 [EXIT CODE UNDECLARED].
```

The three remaining null verdicts are **not** given three more buckets. They are one fact — *the
instrument was asked and said nothing usable* — and each row now carries its own verdict string on the
line, so a reader can see which without a fourth heading.

### Proof: 216 passed, 0 failed, and every new arm shown RED on its own break first

Six arms added (210 → 216). Each was shown red before being trusted, on four separate deliberate
breaks, restored to green after each:

| break | what failed |
|---|---|
| collapse the split back to one bucket (`if (false) rejected.push`) | **3 red** — arms A, B and the two-sentences arm. 213/3 |
| rename `rejectedVerdict` on the reader's side only | **1 red** — the source-comparison arm. 215/1 |
| drop a row instead of bucketing it (`debt.push` → `continue`) | **1 red** — the disjoint-and-total arm. 215/1 |
| over-fire the rejection bucket (`v.verdict !== 'INSTRUMENT UNRUNNABLE'`) | **4 red** — including the arm asserting a null verdict with no string is NOT a rejection. 212/4 |

`node engine/quarantine.js --selftest` → **216 passed, 0 failed** on the shipping bytes.

### The named consumer

`node tests/test-divergence-composition.js` → **exit 0, all checks passed.** It requires
`engine/quarantine.js` and drives `wholeGameClause` / `narrationClause`; it does not touch the
open-defect clause. **Not edited.** Reported as the brief asked.

No other reader exists: repo-wide, `withRed`, `staleRows`, `unrunnable` and the clause's key set appear
outside `engine/quarantine.js` only in `web/quarantine-data.js` and `app/quarantine-data.js`, which are
**generated snapshots holding a frozen `why` string** (WEB is paused; not touched). The stale snapshot
in `web/quarantine-data.js` corroborates the finding — it carries `2 open row(s) name an instrument
that WOULD NOT RUN ... #318, #319`.

### The live number does not move yet, and that is the honest state

```
{ ok: true, withRed: 0, staleRows: 3, rejected: 0, unrunnable: 7, debt: 64,
  verdicts_read: 112, verdicts_generated: "2026-08-27T20:06:53.681Z" }
```

`rejected` reads **0** because `data/register-reality.json` is nine days stale and predates the
`MARKER REJECTED` vocabulary entirely — every rejection in it is still spelled `INSTRUMENT UNRUNNABLE`.
The split becomes visible on the next regeneration. What is already visible is the per-row verdict:
`#318 [INSTRUMENT UNRUNNABLE], #319 [INSTRUMENT UNRUNNABLE], #438, #439, #440` — five of the seven are
exactly the markers `SAFE` refused, now readable as such on the line rather than hidden in a count.

The gate does not move: `ok` is still `withRed.length === 0`, and no row changed bucket.

---

## 3. Two things found and left alone

- **#320 and #322 carry the same `MARKER NOT MACHINE-RUNNABLE — NOTED 2026-08-23` paragraph and their
  markers are fine.** Both are `node -r ./tests/_live_release.js tests/…`, admitted since ROADMAP #521.
  The caveat is stale prose on two rows I was not asked to touch. Reported, not edited.
- **`web/quarantine-data.js` and `app/quarantine-data.js` are stale generated snapshots** carrying the
  old wording and a `#218 (94,313 uses), #273` headline. WEB is paused. Reported, not touched.

The three rows I did repair (#316, #318, #319) each carry that same dated paragraph; it is **left
standing** and given a dated supersession note pointing at the status cell, per the house rule that a
dated claim is not rewritten in place.

---

## OWED

1. **`data/register-reality.json` must be regenerated before `rejected` can read anything but 0.**
   It is 2026-08-27, 112 markers against 124, 416 rows against 460. **This is blocked on the decision
   already filed as OWED 2 in `docs/_reports/2026-09-04-safe-marker-rejection.md`:** the pass now runs
   14 artifact-writing scripts, two of which rewrite `data/all-mechanics-fire.json` and
   `data/game-differential.json`, both gate inputs. My #319 repair adds a **multi-minute full move-stage
   run** to that pass — it writes no artifact without `--write`, but it plays the whole stage. That
   decision has an owner and is not mine to take silently. **Do not run the full
   `node engine/register_reality.js` beside a live agent until it is settled.**
2. **#330's marker has never been executed and its heap cost is argued, not measured.** One run of
   `node tests/test-resolution-order.js --only a2-red`, beside no live agent, settles whether it fits
   the default heap. It plays a game, which this pass was forbidden.
3. **#318's debt is real work, not bookkeeping.** The `LEARNSET CLAUSE IS REPORT-ONLY` count must be
   published into `data/roster.moves.json` before any exit code can decide that row. Until then it is
   an open row asserting breakage with no instrument — printed by name in the clause's `debt` line,
   which is the honest place for it.
4. **`node engine/status.js --write` was NOT run, deliberately.** An ENGINE agent is live and playing
   games; the restamp reads gate artifacts that agent may be mid-rewrite of, and a torn read stamped
   into a ledger is a plausible, well-formed, fictitious number. Run it once the ENGINE pass lands.
5. **The living-docs obligations are unmet and are named rather than half-done:** no `docs/MEASURE.md`
   ledger entry, no `CHANGELOG.md` entry, no version bump. They belong with the commit, and this pass
   was told not to commit. A CHANGELOG version that matches no committed artifact is its own drift.
6. **#320 and #322 carry a superseded `MARKER NOT MACHINE-RUNNABLE` paragraph** (§3). One line each,
   somebody's next pass.
