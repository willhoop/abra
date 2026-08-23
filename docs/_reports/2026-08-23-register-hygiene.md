# Register hygiene — the six rows, the whole-game headline, and what was unregistered

MEASURE, 2026-08-23. Light mode: read-only probes, `node -e`, and edits to `docs/ROADMAP.md` only.
**No game was played.** `game_differential.js`, `tests/roster.js`, `all_mechanics_fire.js`,
`tests/test-engine-diff.js`, `quarantine.js` as a script and `status.js --write` were NOT run.
`engine/register_reality.js --list` was NOT run (ROADMAP #369).

Historical findings record. Not maintained, not current state, superseded by the register rows it
feeds.

---

## VERDICT

**The briefed premise was wrong in the way that matters, and so was the correction that followed it.**
`data/register-reality.json` does not hold six rows that disagree with their instrument. It holds
**one** — `tests/probe_red_demo.js`, closed and red. The other five were **never run at all**: their
`VERIFIED BY` markers carry a `SHOWDOWN_PATH=...` prefix and a literal placeholder, which the runner
refuses by design. A row nothing ran is not a row that disagrees; it is a row with no evidence, and
two of the five are open and asserting breakage while holding a gate shut.

**1 reopened, 8 re-scoped, 11 opened, 1 closed.** The whole-game headline is corrected on #218 with
both readings, both dates and both pins, and **no delta is claimed** because the two figures do not
measure the same quantity over the same denominator.

---

## 0. THE PREMISE, VERIFIED FIRST

`data/register-reality.json`, generated 2026-08-23T06:13:06Z, committed at `086dd25`, unmodified in
the working tree (`git status` clean for that path throughout this pass).

```
counts.stale_rows            0        (no open row whose instrument reads green)
counts.premature_closes      1        <- #273 only
counts.unrunnable            5
counts.cannot_answer         0
counts.exit_codes_undeclared 0
results                     35 rows: CONFIRMED 29, PREMATURE CLOSE 1, INSTRUMENT UNRUNNABLE 5
```

So the number 6 is right as a count of non-CONFIRMED rows and the word *disagree* is right for one
of them. The distinction is not pedantry: a stale row and an unrun row want opposite work. A stale
row wants a verdict changed. An unrun row wants an instrument that can be launched.

---

## 1. THE SIX ROWS, EACH WITH A VERDICT

### #273 — `tests/probe_red_demo.js` — PREMATURE CLOSE → **REOPENED**

The only genuine row-versus-instrument disagreement in the register. Closed 2026-08-15 on
`200 demonstrations, 0 failed`; the 2026-08-23 run of its own `VERIFIED BY` command read **exit 1
after 55.3 s**, classified `VERDICT-RED` under the exit-code rule landed the same day.

Reopened with the measurement recorded and **no mechanism claimed**. The failing rows were not read —
this pass could not run anything that plays a board. The row's own residue paragraph is the leading
candidate (*"an anchor that is a literal source string will go stale again on the next wire"*, and
eight days of wires have landed since) but a candidate is not a measurement, and it could equally be
a refusal spelled as exit 1, which the new classifier states in its own header it cannot tell apart
from a red. Status cell now `open — instrument DEFECT`, with the prior close preserved in parentheses
rather than deleted.

### #316, #318, #319, #320, #322 — INSTRUMENT UNRUNNABLE → **not stale, not evidence**

All five carry a marker of the shape `SHOWDOWN_PATH=... node tests/<x>.js` (#316 also carries a
literal `<id>`). `engine/register_reality.js`'s `SAFE` pattern accepts only
`node <engine|tests|build>/<file>.js [--flags]` — deliberately, so no marker can be shell-executed —
so all five file as `NOT-STARTED`.

Measured over the whole register with the shared closed-detector: **exactly these five, and no
others,** carry a marker the runner refuses. Two of them (#318, #319) are open and assert breakage,
so they hold the open-defect clause shut on claims no process has checked since they were typed.

Each of the five gained a dated note saying its marker is an instruction to a human rather than an
instrument, pointing at the new class row. Beyond that:

- **#319 re-scoped on measured evidence.** `data/roster.moves.json`, release `c36782953dee`, reads
  **5 FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE / 470 MATCH / 22 COULD-NOT-STAGE / 3 DEFERRED** out of
  500 in scope. The row said 157. **That is not published as a before/after** — different release,
  and #316's own withhold rule exists precisely so a roster count is never compared across bytes.
  What it establishes is the row's scope: five named entities, each now with its own home.
- **#318 given a real owe.** Its 632 learnset-refusal count is printed to stdout and written to no
  artifact — `data/roster.moves.json` carries `counts`, `scope`, `reds`, `mirror`, `results` and no
  refusal figure — so the row can only be decided by a human watching a run. `INSTRUMENT OWED:` the
  count published into the artifact.

---

## 2. #218 — THE WHOLE-GAME HEADLINE

### The two readings, stated together

| | 39.6% | 8.0% |
|---|---|---|
| figure | 480 of 1,213 | 77 of 961 |
| quantity | **RAW** (`diverged / games`) | **UNDECLARED** (`(diverged − declared − cleared) / games`) |
| date | 2026-08-12 | 2026-08-23, generated 06:10:58Z |
| release | `5a557b07821c` | `c36782953dee` |
| arm / pin | (pin corner of that run) | `A/middle/pins:1fd77b835ee2`, primary arm `middle` |
| team pool | — | pinned `data/team-pool-frozen`, digest `0d103fb9fa87` |
| census | — | digest `8c778268919e`, 634 rows, read **live**, `pinned: false` |

**No delta is claimed, for three independent reasons.**

1. **Different quantities.** The clause published a RAW rate until the declared-divergence exemption
   landed 2026-08-18 and an UNDECLARED rate since. The only same-quantity pair is **39.6% raw against
   8.5% raw** (82 of 961).
2. **Different denominators.** 1,213 against 961.
3. **Different samples by construction.** The census SELECTS the sample — `steering.rule` says so in
   as many words — and the clause agrees: its own `baseline_comparable` reads **false** and it
   withholds direction of travel.

### The 961, explained rather than waved at

The run requested 1200 and played 961. The shortfall is **structural, not a truncation**: the swarm
splits nine ways and two configs have almost no eligible pairs in the frozen pool —
`omit-protect` 99 available → 48 games, `omit-priority` 7 available → 3 games. The sample is real and
it under-weights those two corners.

### The correction I was sent, and why I did not act on it

The coordinator's correction was that `status.js` reports the **bottom-tie-first** arm (77) as the
headline where the primary arm is `middle` (82), i.e. that the gate asks for a corner by omission.

**The arm table is right and the mechanism is wrong.** The three arms do read middle 82,
top-tie-first 68, bottom-tie-first 77 of 961. But `wholeGameClause` reads `j.diverged` and `j.games`
at the **top level** and indexes no arm at all; the top-level 82 *is* the middle arm. The published
77 is **82 minus 5 declared** — all five the `Supreme Overlord fallenundefined` entry, where matching
the authority would make this engine less correct.

Proven by driving the shipping function on perturbed copies of the artifact rather than by reading
the source:

```
AS PUBLISHED          : div 82, declared 5, undeclared 77 -> 8.0%
bottom-tie-first ->999: div 82, declared 5, undeclared 77 -> 8.0%    (invariant)
middle arm       ->999: div 82, declared 5, undeclared 77 -> 8.0%    (invariant)
top-level        ->100: div 100, declared 5, undeclared 95 -> 9.9%   (moves)
declared cause removed: div 82, declared 0, undeclared 82 -> 8.5%    (moves)
```

The collision of 77 with the bottom-tie-first arm is a coincidence. **No arm-selection defect
exists and none was filed as one.** What was filed (#387) is the real residue: nothing in the printed
sentence names which quantity it is, so the register's own trend line has been comparing raw against
undeclared, and the same collision will recur every time raw-minus-declared lands on another arm.

### Two further facts carried into the row

- **The run measured PROTOCOL only** — `state_mode: false`, `end_state: null`. No count in it
  supports a claim about board-materiality, and none is made.
- **The 8.0% was already withheld by 02:46 local the same morning.** ENGINE cut further releases
  while this was being written; asked against the live tree, `wholeGameClause` returns
  `MEASURED AGAINST A DIFFERENT ENGINE` and publishes nothing at all. The figure is true of
  `c36782953dee` and of no other bytes.

---

## 3. WHAT WAS UNREGISTERED, AND WHAT `open_work.js` COULD NOT SEE

`node engine/open_work.js` prints `MEASURED BUT UNREGISTERED: 0`. **That zero carries no
information**, and finding out why is itself a result: the UNREGISTERED half reads exactly one
artifact, `data/interaction-matrix.json`, generated 2026-08-11T22:00:06Z. The tool prints its own
warning — *"11.4 days old"* — and then reports zero. Filed as **#386**.

So the unregistered set was assembled from today's reports and from the roster and differential
artifacts by hand, which is what #386 exists to stop being necessary.

**Opened (11):**

| row | subject | state |
|---|---|---|
| #377 | an empty bench consulted below the ability instead of above it — the phaze `-fail`/`[still]`, the Suction Cups `-activate`, and the move-result state | landed by ENGINE, **measurement owed** |
| #378 | a refused target still dragged by the damaging phaze — board-material | landed by ENGINE, **pool reading owed** |
| #379 | a gate that could not answer was published as a gate that found a defect | **CLOSED**, verified green |
| #380 | "what does this exit code mean" is decided in two files, and the open-defect clause's sentence is now false | open — instrument DEFECT |
| #381 | five markers no runner can launch; 35 open rows assert breakage with nothing deciding them | open — register hygiene, NOT A DEFECT |
| #382 | `engine/move_result_state.js` is read by one probe and by nothing at scale | open — INSTRUMENT OWED |
| #383 | ~70 `mvFail` sites write a bare `-fail`; the differential drops field 4 by design so nothing counts it | open — UNMEASURED, no verdict |
| #384 | the `vol.focusenergy` leaf parts on four moves in **both directions** | open — engine DEFECT |
| #385 | Big Root's drain multiplier rounds differently and the error compounds | open — engine DEFECT |
| #386 | the tool built to print what the register cannot see about itself is fed by one 11.4-day-old artifact | open — instrument coverage, NOT A DEFECT |
| #387 | the whole-game headline changed quantity in August and nothing labels which one it is | open — reporting clarity, NOT A DEFECT |

Three of these are rulings that deliberately do **not** hold the MEDICHAM gate shut and say so in
the status cell (`NOT A DEFECT`, the register's declared escape hatch, whose every use is counted and
printed). Nothing about the game is claimed wrong in #381, #386 or #387.

### The two engine rows were derived, not guessed

**#384 — the Focus Energy volatile.** Four of the move stage's five reds, and `vol.focusenergy` is
the only leaf that parts in any of them: `dragoncheer` (sd 0 / ours 1), `psychup` (0 / 1), `fakeout`
(1 / 0), `transform` (1 / 0). **Both directions appear**, which is why this is not "we forgot to set
it". Read from the running checkout: `data/moves.ts:5984` — Focus Energy's `onStart` opens
`if (target.volatiles['dragoncheer']) return false;` — and `data/moves.ts:4069` — Dragon Cheer's
opens `if (target.volatiles['focusenergy']) return false;`. The two volatiles are **mutually
exclusive**. Both conditions then carry an identical silent arm for exactly four effect ids,
`['costar', 'imposter', 'psychup', 'transform']` (`:5987`, `:4070`) — and two of the four roster rows
are `psychup` and `transform`, the copy path, with a third being the exclusion partner. Champions
overrides `dragoncheer` cosmetically only (`data/mods/champions/moves.ts:241` —
`{ inherit: true, flags: {..., sound: 1} }`) and carries no `focusenergy` key. **`fakeout` is not
explained by that and is not attributed**: the roster's control click *is* Focus Energy, so that arm
may be the control rather than the move.

**#385 — Big Root.** `kangaskhan party.hp` showdown 693 / ours 692 at turn 2, then **714 / 712** at
turn 3 — the gap grows, so it is a per-tick rounding rule. `data/items.ts:488-494`: the item is
`onTryHealPriority: 1` returning `this.chainModify([5324, 4096])`, i.e. the authority applies
5324/4096 through chained-modifier rounding rather than a plain multiply-and-floor. No `bigroot` key
in `data/mods/champions/items.ts`. **And the effect list is five, not one** —
`['drain', 'leechseed', 'ingrain', 'aquaring', 'strengthsap']` at `:490` — so a fix aimed at drain
alone closes one of five doors. Adjacent to but distinct from #339, which is the *spread* drain
summing before it rounds.

---

## 4. THE ROWS ENGINE IS ABOUT TO MAKE STALE — ALL SEVEN HAVE A HOME, AND NONE WAS CLOSED

The roster reds on release `c36782953dee` are exactly seven, and they are now three facts:

| red | row |
|---|---|
| `dragoncheer`, `fakeout`, `psychup`, `transform` | **#384** (new) |
| `matchagotcha` | **#339** (existing) — corroboration appended |
| `bigroot` | **#385** (new) |
| `greninjite` | **#356** (existing) — flagged UNDER RE-DERIVATION |

**#356 is marked under re-derivation, not rewritten.** The symptom reproduces on today's release
(`turn 1 party.types showdown normal / ours dark/water`, and again at turn 2, now under a Focus
Energy control click which is itself a Normal move). What is under re-derivation is the **latch**.
Will says Protean is once-per-switch-in rather than once-per-move, and the source agrees:
`pokemon-showdown/data/abilities.ts:3489` opens `onPrepareHit` with
`if (this.effectState.protean) return;` and sets `this.effectState.protean = true` at `:3494`;
`data/mods/champions/abilities.ts` carries no `protean` key. The row's title says only that the
ability fails to act on the mega forme and says nothing about the latch — **a fix written from the
title alone could retype on every click, which would be wrong from turn 2 onward and green on the one
staged turn.** ENGINE owns the mechanism and proposes the text; MEASURE's note is only that the fix
must be scored against the once-per-switch-in reading.

---

## 5. THE REGISTER'S EVIDENCE BASE, MEASURED

Derived over `docs/ROADMAP.md` with `quarantine.roadmapRowIsClosed` / `roadmapRowSaysBroken` — the
one closed-detector, imported and not copied.

```
351 register rows            (open_work.js's parse; register_reality counts 295 defect rows of 340 ids)
217 open
 53 open AND asserting breakage        (49 before this pass; +4 = #273 reopened, #380, #384, #385)
 35 of those have NEITHER a VERIFIED BY NOR an INSTRUMENT OWED
 35 rows carry a VERIFIED BY marker in total, of which 5 the runner refuses
 19 rows declare INSTRUMENT OWED
```

**35 open rows assert breakage, hold the open-defect clause shut, and nothing decides any of them.**
That is not an accusation that they are wrong — it is the statement that nothing can tell. Filed as
the second half of #381 with a coverage figure that can be ratcheted rather than rediscovered.

---

## 6. OWED, NOT RUN — AS COMMANDS

Nothing below was run and no number in this report comes from any of them.

```bash
# 1. The verdict artifact. Run only on a settled tree, AFTER the differential and the roster stages.
#    This is what gives the 12 rows this pass touched their first verdicts.
node engine/register_reality.js

# 2. The clause that reads it, and the ledgers. Read AFTER (1), never before.
node engine/quarantine.js
node engine/status.js
node engine/status.js --write

# 3. #273's instrument — the ONE row that disagrees. Read the failing rows and say which it is.
node tests/probe_red_demo.js

# 4. #218's instrument. Asked against the live tree today it returns CANNOT ANSWER (exit 2): the
#    published artifact is release c36782953dee and the tree has moved on twice since 02:46.
node engine/quarantine.js --whole-game

# 5. A fresh whole-game differential on the current release, which is what makes (4) able to answer.
SHOWDOWN_PATH=... node engine/game_differential.js --release <fresh id> --games 1200 \
    --team-store data/team-pool-frozen --write

# 6. The commit. NOT MADE — several agents are in this tree. By name:
git add docs/ROADMAP.md docs/_reports/2026-08-23-register-hygiene.md
```

Specifically owed, and why:

1. **`node engine/register_reality.js`.** Twelve rows moved in this pass and none of them has a
   verdict yet; #379 is closed on a marker I ran by hand (`--selftest`, 51/51, artifact byte-identical
   before and after, checked by md5) rather than through the register runner.
2. **#381's decision, which is not a patch.** Either the runner learns to supply `SHOWDOWN_PATH` from
   the environment it already has and to expand `<id>` from `data/engine-release.json`, or the five
   rows carry `INSTRUMENT OWED` and stop presenting a command as a verdict. **The first is better and
   it must not be done by relaxing `SAFE` into a shell.**
3. **#377 and #378 need a census regeneration and a whole-game run** before the ENGINE changes they
   record can be closed. Expectation stated before the run, per the pinned-pool rule: both are LAB
   mechanics, so the lab should move and the pinned pool is expected to sit still.
4. **A side effect I caused, reported rather than hidden:** running `node tests/test-docs-current.js`
   (22 passed, 0 failed) restamped `data/docs-currency-baseline.json` — `generated` and
   `changelog_top_at_baseline` `5.89.0 → 5.89.1` only. That is the ratchet doing what it does, and it
   tracks the coordinator's CHANGELOG edit, not mine.
5. **Not deleted, reported:** `data/_pair-pilot.json` and
   `docs/_reports/2026-08-23-wholegame-77-grouped.md` are untracked and are not mine. Left in place.

## 7. WHAT WAS DELIBERATELY NOT DONE

- **Nothing under `tests/`, `engine/`, `web/`, `CHANGELOG.md` or `docs/ENGINE.md` was edited.** The
  only file this pass wrote in the repository is `docs/ROADMAP.md` and this report.
- **No row belonging to the live ENGINE agent was closed.** #339 and #356 gained dated corroboration
  and a re-derivation flag; neither claim was rewritten.
- **`engine/register_reality.js --list` was not run** (#369 — it overwrites the verdict artifact and
  destroys every `green: false` row).
- **`data/register-reality.json` was not regenerated** and is byte-identical to `086dd25`.
