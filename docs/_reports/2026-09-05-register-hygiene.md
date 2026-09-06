# Register hygiene — the nine were already six, one closure was real, and two rows carry tonight's confirmations

MEASURE, 2026-09-05/06. **Scope: `docs/ROADMAP.md` and this file. Nothing else on disk was written
except `data/open-work.json`, which `node engine/open_work.js` rewrites as its job** (it was already
modified in the working tree when this pass started — it is not clean-vs-dirty evidence about me).
No engine byte moved, nothing that plays a game ran, nothing heavy ran, **`engine/register_reality.js`
was NOT run in any mode** (ROADMAP #369: `--list` says it runs nothing and overwrites the verdict
artifact anyway), `engine/status.js` was not run in any mode, no `<!-- GENERATED -->` block was touched,
and nothing was committed. `engine/quarantine.js` was IMPORTED for its exported detectors and never
edited. Every artifact used to settle a claim was read with `git show HEAD:`.

HEAD is `6ab375cc`. `docs/ROADMAP.md` was byte-identical to HEAD when this pass began (mtime
2026-09-05 21:25:50, `git status` clean for that file) and no other agent touched it while the pass ran.

---

## THE NUMBER

| | before | after |
|---|---|---|
| register rows | 507 | **508** |
| marked closed | 284 | **285** |
| OPEN | 223 | 223 |
| **open AND asserting breakage** (what the gate counts) | **52** | **54** |
| rows whose status cell is cut by a pipe and whose verdict is unchanged | 14 | **12** |
| rows with a gate-visible verdict that depends on the parse | 0 | **0** |

Both open readings are `node engine/open_work.js`, which shares its closed-detector with the gate.
The cut-cell and parse-dependency figures are `node tests/test-register-cell-parse.js`, which passes
before and after. `node tests/test-roadmap-register.js` passes: 3 of 3.

**Three verdicts moved and every one is named below.** One row closed, one row gained a DEFECT
token, one new row was filed. Three more rows had a status WORD corrected with no verdict movement,
and two carry tonight's confirmed findings.

---

## 1. TASK 1 — "NINE ROWS READ OPEN AGAINST AN AUTHORED CLOSURE"

### The nine are a dated list, and six of them were repaired the day after it was written

The number comes from `tests/test-register-cell-parse.js`'s own header and from
`docs/_reports/2026-09-04-register-closures.md` §1, which names them:
**#167, #172, #282, #293, #294, #465, #122, #511, #514** (plus #196, whose cell parsed to the empty
string). That report deliberately left them — *"Closing them is somebody's evidence to restate, not
mine to infer from a parse artifact"*.

`docs/_reports/2026-09-04-pipe-class-repair.md` then repaired **six of the nine plus #196** the same
day, in NOTATION ONLY. Re-checked today through the shipping detectors, all six now read CLOSED and
each carries its evidence in its own cell:

| row | reads today | the evidence its cell carries |
|---|---|---|
| #167 | closed | `CLOSED 2026-08-11` — the Struggle-fallback diagnosis, with the trace quoted |
| #172 | closed | same closure, same diagnosis (one defect explained all four rows) |
| #282 | closed | artifact `data/seed-source-audit.json`, gate `tests/test-seed-clock.js` §7, shown RED on two deliberate breaks |
| #293 | closed | probes `ability/blocksMove` and `move/targetClass`, each with a named control |
| #294 | closed | probe `tests/test-mechanics.js` `move/spreadFoes`, shown RED on the pre-fix tree |
| #465 | closed | landed with `MEDI_PARTY_KEY_DISPLAY=1` as the positive control, figures republished as new |

**Spot-checked rather than taken on trust**, against `git show HEAD:data/mechanics-census.json`
(829 live / 829 probed / 0 missing, generated 2026-09-06T01:15:13Z): `move/spreadFoes` *"a
90-accuracy spread move can hit one target and miss the other"* is **live**, `ability/blocksMove`
*"a refused priority move names the ability that refused it"* is **live**, `move/targetClass`
*"an ally-aimed Helping Hand names the partner"* is **live**. #293 and #294's closures hold today.
The other four rest on their authors' evidence and were not re-run; that is stated, not hidden.

**So the live class today is not nine.** The three survivors of that list, plus three more found by
sweeping the whole register for the same shape, are below.

### The three survivors, adjudicated

**#514 — the AUTHORED TEXT is true and the detector was wrong. CLOSED.**
The row has **no status column at all**, and its closure — `**CLOSED 2026-08-28 BY ENGINE.**` — is
written 1,900 characters into the row, past the 600 the prose fallback reads. Nothing could see it.
Verified before closing it, from committed artifacts only:

- the derived tag `failsWithoutUserLatch` is **live** in `git show HEAD:data/mechanics-census.json`,
  on the row *"Belch is refused until its user has actually eaten a berry"*, and its own `detail`
  records the varied knob (no berry → `ateBerry` false, Belch dealt **0**; Sitrus → a real eat, Belch
  dealt **64**);
- `git show HEAD:engine/medicham2-browser.js` carries the gate: `_ateBerry` is read at the Belch
  precondition block (`:30832-30851`), not only by Harvest as the row's original filing said;
- the row names probe `tests/probe_two_gates.js`, release `cff226e4eef5` and CHANGELOG 5.195.0.

A status cell was ADDED saying `closed 2026-08-28 — ENGINE`, carrying the author's date and evidence
and stating that no claim was altered. **Verdict moved OPEN → CLOSED.**

**#511 — the DETECTOR is right. Still OPEN, and it now says so in a cell.**
The row's own words settle it: *"ONE OF THE THREE ROADS NAMED HERE IS CLOSED AND THIS ROW STAYS OPEN
FOR THE OTHER TWO"*. The busted-Disguise road closed under #526; the Focus Sash and Endure roads are
untouched and are staged RED by `tests/probe_volley_collapse.js`. It also had no status column, and
the inline `-hitcount` protocol line in its head carries pipes, so the shipping cell reader cut its
"status" out of the TITLE. A cell was added reading `open 2026-08-27 — engine DEFECT …`.

**This is the one edit that moves the gate, and it is stated rather than buried.** The DEFECT token
takes open-asserting-breakage from 52 to 53. It is a claim: a staged probe parts on three protocol
rows (5 `-damage` against 1, 5 effectiveness against 0, `-hitcount` 5 against none) with **HP agreeing
at 1/198 on both sides**, so it is a live divergence that is NOT board-material and belongs to the
narration-and-state half. The token was written because that is what the row states, and the direction
is the safe one — the detector's own comment says an ambiguous row keeps the gate shut.

**#122 — the DETECTOR is right. Still OPEN; the status WORD was wrong.**
The cell led `PART DONE 2026-08-10`, which a human reads as a closure and which the detector reads as
neither closed nor open, so the verdict rested on prose. The same cell says the work *"closes ZERO
trapping rows because Arena Trap and Magnet Pull have no legal carrier and Shadow Tag is mega-tier
with suppression measured dead"*. The cell now leads `open — the trapping half is not done`, with
the earlier status carried forward verbatim under the `THE CELL BELOW IS THE ROW'S EARLIER STATUS,
UNCHANGED:` convention. **No verdict moved** — the detector already read it open; what changed is
that a human and the detector now agree.

### Three more of the same shape, found by sweeping rather than by reading the old list

Swept over all 507 rows: for every row the detector reads OPEN, the AUTHORED status cell was
recovered (inline-code spans and escaped pipes masked, then the last column taken) and tested for a
leading closure word; separately, every open row whose tail carries closure evidence (`CHANGELOG n`,
`Release <digest>`, `LANDED`, `CLOSED 20…`) but whose cell does not begin `open` was printed.

**#204 — the DETECTOR is right. Still OPEN; the status word was wrong.** The cell led
`**rows CLOSED 2026-08-22**` — which reads as a closure at a glance, and whose emphasis markers also
hid it from the detector's cell clause — while the SAME cell ends *"Forecast A1 open — engine"*.
Now leads `open — Forecast A1`, with the three closed rows and their probe
(`tests/test-forme-assert.js`) carried forward verbatim.

**#275 — the DETECTOR is right. Still OPEN; the status word was wrong.** The cell led
`landed 2026-08-14`, which describes the CODE, while the same cell says the change is
`**UNMEASURED, owes its own arm**`. Now leads `open — the measurement is owed`, earlier status
carried forward.

**#277 — REFUSED. I cannot adjudicate it and I did not touch it.** The cell reads
`worked 2026-08-14 — SEARCH; 3 carried, 3 refused by name, streak closed; gate
tests/test-seed-clock.js`. Six volatiles, three carried and three refused by name, is either a
complete disposition or a partial one, and nothing I can read settles which. Closing a row on an
inference is what #403 cost. **It is SEARCH's evidence to restate.**

**#195 and #67 — NOT this class, and deliberately left.** Their cells lead `closet` and
`**CLOSETED 2026-08-18**`. A closet is a declared deferral with an owner, not a closure; the detector
reading them OPEN is correct and a reader who knows the project's vocabulary is not misled. Reported,
not touched.

---

## 2. TASK 2 — UNREGISTERED DEFECTS: THE ANSWER IS ZERO, AND THE ZERO CARRIES NO INFORMATION

`node engine/open_work.js` prints `0 MEASURED BUT UNREGISTERED`. **That is not a clean board and no
row should be filed off it.** The UNREGISTERED half of that tool is fed by exactly one artifact —
`data/interaction-matrix.json`, whose `parting` list is its only source — and the tool's own last
line says it: *"WARNING: data/interaction-matrix.json is **25.2 days** old. Anything read out of it
describes the engine of that day, not this one."*

**This is already registered as ROADMAP #386**, filed 2026-08-23 by MEASURE when the same artifact
was 11.4 days old, whose headline is precisely *"the one tool built to print what the register cannot
see about itself is fed by a single artifact that is 11.4 days old, so it prints `UNREGISTERED: 0` and
that zero carries no information"*. The age has more than doubled since; the claim is unchanged.

**No row was filed for an unregistered defect, because no live instrument named one.** Inventing rows
here would be typing a list, which is the failure the tool exists to replace. The cross-check that
would settle it — a second instrument feeding the unregistered half — is #386's work and is not this
pass's to do. `engine/register_reality.js` was NOT run in any mode, in either direction: #369 records
that `--list` claims to run nothing and overwrites `data/register-reality.json` anyway, destroying
every verdict in it.

---

## 3. TASK 3 — TONIGHT'S TWO CONFIRMED FINDINGS, WRITTEN DOWN AND NOT ACTED ON

### #545 — NEW ROW. `PRIMARY_ARM = ARMS[0]` is the cause of all four `test-game-differential.js` failures

Filed as an **instrument DEFECT** in `engine/game_differential.js`, open, verified, fix NOT applied.
`:1688` reads `const PRIMARY_ARM = ARMS[0]` and `:1692-1694` bind the module-scope `pinRandom`,
`PIN_CHANCE` and `mediRng` to it. The comment two lines above them states the invariant that is
broken — they are *"calibrated against the max-damage endpoint"*, which is `top-tie-first`
(`corner: CORNER_TOP`, `damageIndex: 0`) — and they are in fact bound to `middle` (`CORNER_BOTTOM`,
`damageIndex: 8`, live address-keyed dice), an arm whose own header says *"THE MIDDLE ARM IS OPT-IN
AND IS NOT PART OF THE DEFAULT SET"*. Dated at the commit: `git show
cf7a2c5a^:engine/game_differential.js` has `ARMS = [top-tie-first, bottom-tie-first]` with the same
`ARMS[0]`; `cf7a2c5a` (2026-08-13) prepended `middle` at index 0.

The row records what must NOT happen as loudly as what should: **`PRIMARY_ARM` must not be changed** —
`middle` is genuinely the arm the whole-game run plays and every published board-material figure is a
middle-arm figure. It is the STAGED measurements that must stop riding the same constant.

**Filed as a neighbour of #366, not as a duplicate**, and the row says so: #366 is the same constant
reached through a different door (call sites that omit `arm` and silently get live dice); #545 is the
module-scope binding itself. Account:
`docs/_reports/2026-09-05-red-endpoints-and-protect-prior.md`.

**This is the second of the two rows the brief asked for, and it takes the gate from 53 to 54.**

### #542 (a) Fairy Aura and #544 Beat Up — both updated to CONFIRMED REAL ENGINE DEFECT

Both rows were open with a derived hypothesis and no probe. Both now carry the measurement, appended
to their status cells, and **both fixes are recorded as derived and NOT applied** — the simulator is
held by a live ENGINE agent and both fixes were verified against a patched SNAPSHOT in a throwaway
release store, never against the working tree.

- **#542 (a)** — `tests/probe_fairy_aura.js`, 4 arms (2 red, 2 knob-cleared controls), release
  `63cbcc2ef605`, pin `middle`. All three doors reproduce: holder LEAVES 38 against 50 (1.3158),
  holder RETURNS 52 against 39 (0.7500), mega ARRIVAL agrees 51/51, and `aura-faints` reads 38
  against 50. The cross-arm claim is read off Showdown alone. Cause: `field.aura` is a cache with two
  writers only. The row also carries the exposure warning **before** the run rather than after it —
  Floette-Eternal is ~10.5% of ladder sides and megas 96.1% of the time, so the pinned pool should be
  expected to MOVE.
- **#544** — `tests/probe_beatup_ally_order.js`, 4 arms, same release. At pin `top-tie-first` the
  after-a-switch arm reads Showdown `[25, 22, 21, 16]` against medicham `[25, 16, 21, 22]` while the
  no-switch control reads `[25, 16, 21, 22]` on both engines: hit count 4 everywhere, same multiset,
  a pure permutation, and medicham's switch-arm sequence is byte-identical to the authority's
  NO-SWITCH sequence. The row carries what is OWED on application: `STATE_PLANTS` (`:5598`, `:5601`)
  and `benchedLiving` (`:5391`) in `engine/game_differential.js` select a party member by INDEX —
  expected harmless, NOT measured, `tests/test-end-state.js` is the gate that settles it.

**Two stale phrases at the HEAD of those two cells were corrected IN PLACE, not deleted**, because a
stale claim at the head of a cell is what a reader takes away: #542's `and UNPROBED.` and #544's
`and NOT probed.` each now say what they used to say, when they stopped being true, and where the
update is. Neither verdict moved; both rows stay open.

---

## 4. WHAT I REFUSED TO TOUCH, AND WHY

| | why |
|---|---|
| **#277** | `worked 2026-08-14 — 3 carried, 3 refused by name`. Neither a closure nor demonstrably open from anything I can read. SEARCH's evidence to restate. |
| **#195, #67** | `closet` / `CLOSETED` are declared deferrals with owners, not closures. The detector is right to read them open. |
| **#166, #517, #519** | The cell-parse gate names these as NOT READABLE — two defensible readings give two different cells, so no verdict can be asserted from either. Renotating them is real work; guessing which cell is theirs is not. Printed by the gate on every run. |
| **#6, #30** | Empty status cell; the detector falls through to prose. Reported by the gate every run, no verdict at risk. |
| **`engine/register_reality.js`** | Not run in any mode. #369: `--list` says it runs nothing and overwrites the verdict artifact anyway. |
| **the untracked files in the tree** | `tests/probe_fairy_aura.js`, `tests/probe_beatup_ally_order.js`, `data/verification/longtail-A-*.json` and the two `_reports` files are another agent's work in progress. Reported, left. Nothing was deleted. |
| **`data/interaction-matrix.json`** | 25.2 days old. No figure was read out of it and none is quoted here. |

---

## 5. WHAT IS OWED

1. **`node engine/status.js --write` was NOT run**, deliberately: another agent is writing the tree
   tonight and a restamp would stamp a moving target. The generated blocks in the division ledgers do
   not yet reflect 508 rows / 285 closed / 54 open-asserting-breakage.
2. **Nothing is committed.** `docs/ROADMAP.md` and this file are on disk only.
3. **The living-docs obligation for the three new/updated defect rows belongs with the fixes**, not
   with this hygiene pass — #542, #544 and #545 are all filed-not-fixed, and CHANGELOG entries are
   owed when the fixes land, not when the rows are written.
4. **#386 is the standing item behind Task 2** and nothing here advanced it. Until a second live
   instrument feeds `open_work.js`'s UNREGISTERED half, that zero is not evidence.
