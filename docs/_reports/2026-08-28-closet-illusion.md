# The closet's first two entries were refused — they were already in it

**2026-08-28 · MEASURE · ROADMAP #520 (new), #160 (re-ruled, appended) · CHANGELOG 5.196.0**

## Verdict

**BOTH ROWS REFUSED.** Bitter Malice and Night Daze are not the `CLOSETED` kind's first two entries,
because they are already shelved by a mechanism that derives, and a second exemption would have
matched nothing.

**Clause count: 6 of 8 PASS before, 6 of 8 PASS after.** Nothing moved, and nothing was supposed to.
Any improvement here is a **RULE CHANGE — specifically a reporting one — and not an engine change.**
No simulator byte was touched.

## What Will asked for

> *"we put illusion and zoroark into the closet cause its too ahrd to deal with"*

> *"bitter malice and night daze are only learned by zoroark i believe, which we put in the closet"*

> *"things in the closet shouldnt block a gate if we know why they fail and choose to accept it"*

Every word of that is right. What it asks for was built on **2026-08-13** and nobody could see it.

## The premise, verified — and my first derivation of it was wrong

A hand-walked prevo/`baseSpecies` chain reported Zoroark-Hisui as a Night Daze learner. It does not
inherit it. `TeamValidator` over the **347** legal species of `gen9championsvgc2026regmb`, filtered
`exists && !isNonstandard && tier !== 'Illegal'`:

```
Bitter Malice  ->  Zoroark-Hisui    1 legal learner
Night Daze     ->  Zoroark          1 legal learner
```

Both carriers hold `{"0":"Illusion"}` — one ability, no second slot — and they are the **only two
legal Illusion carriers in the regulation**. So neither move can be staged on a body without
Illusion. That is stronger than "the carrier happens to have Illusion": there is no fixture in which
either row could have parted for another reason.

When a legality question has an authority, ask the authority. A chain walk is a reimplementation of
one, and this repo names its own casualty for that.

## The divergence is Illusion — measured, not inferred from the cause string

Release `aea838766e7f`, `data/all-mechanics-fire.json`, generated 2026-08-28T05:56:07Z. Both rows
part at index 0 on `switch: a different body`:

```
showdown   |switch|p1a: Blastoise|Blastoise, L50|780/780
medicham2  |switch|p1a: Zoroark|zoroark-hisui, L50|780/780
```

**The same HP under different names.** A genuinely different body would carry a different maximum.
That is Illusion's signature and nothing else's.

## The no-board-effect measurement — earned, and here is the receipt

The brief said this is the field that may not be fudged. It was measured, by
`all_mechanics_fire.js`'s board comparator, on both rows:

| leaf | bittermalice | nightdaze |
|---|---|---|
| `board.verdict` | ANNOUNCEMENT-ONLY | ANNOUNCEMENT-ONLY |
| `boundaries` / `boundaries_agreed` | 4 / 4 | 4 / 4 |
| `boards_after_the_parting` | 4 | 4 |
| `state_parted_on_turn` | null | null |
| `diffs` | `[]` | `[]` |
| `leaves_compared` min/max | 402 / 402 | 402 / 402 |
| `uncomparable_leaves` | `[]` | `[]` |
| `core_leaf_unchecked` | **false** | **false** |

The last two rows are the load-bearing ones. `ANNOUNCEMENT-ONLY` is a claim that the boards agree
**in the fields we look at**, and it is worth nothing without the list of fields we do not — which is
why the instrument derives that list from the authority's own move entry. Both rows report the list
empty, so the verdict is not resting on a leaf nobody looked at.

That verdict is itself defended: `all_mechanics_fire.js` plant 6 applies a state difference with no
protocol line, through the live `statePlant` hook, with a control run first. It is a comparison shown
to catch something rather than one assumed to.

**Will's cost ruling was not used as evidence.** It is permission to stop working on Illusion; it says
nothing about what the engine does. The board numbers above are the evidence, and they are separate.

## Why the rows were refused

Three independent mechanisms already subtract them, and none of them is the declared list:

| already subtracts them | evidence |
|---|---|
| the artifact's own summary | `moves.diverged 6` against `diverged_including_shelved 8`; both rows carry `counts_against_the_gate: false` |
| `classifyMechanics` | skips a `deferred` row **before** it asks `declaredMatch` — a `CLOSETED` row could not be reached even if it matched |
| `game_differential.js` | drops every Illusion-carrying team from the pool before pairing (**43 teams**), so the whole-game clause holds **zero** zoroark causes |

The whole-game clause's six raw causes on `aea838766e7f` are five `fallenundefined` and one faint.
Not one mentions zoroark.

The shelf itself is `ILLUSION_SHELF` in `all_mechanics_fire.js`, keyed on `GD.CLOSET_SPECIES`, which
is derived from the **ability** rather than a name list — so a carrier added next regulation is
covered without an edit.

**A row here would have been a permanent exemption that fires on nothing** — the claim
`quarantine.js`'s own register printer names on every run as having quietly become false. The refusal
is written into `DECLARED_DIVERGENCE` as a comment beside the Outrage, Moody, speed-tie, Tailwind and
drag refusals, because a closet that silently loses rows teaches nobody and a refusal nobody can find
gets re-proposed.

## What was actually missing, and is now fixed

The mechanics clause printed the owner's shelf as the bare integer `4 shelved by the owner` — no
names, no dates, no rulings — while the DECLARED register **one line away in the same clause** printed
every row that MAY subtract whether or not it did. A fifth shelf entry could have appeared and nothing
would have named it. That is the invisible exception the roster's own header exists to prevent,
sitting inside the guard written to stop it.

`SHELVED BY THE OWNER` now names each row with its carrier, cause, board verdict and dated ruling;
publishes `owner_shelved` / `owner_shelved_summary` / `owner_shelved_rows` as data; prints at zero as
well as at four; and compares the derived rows against the artifact's own summary rather than assuming
they agree.

### Naming it found something on the first render

| row | carrier | board verdict |
|---|---|---|
| `move:bittermalice` | zoroarkhisui | ANNOUNCEMENT-ONLY |
| `move:nightdaze` | zoroark | ANNOUNCEMENT-ONLY |
| `ability:forewarn` | musharna | ANNOUNCEMENT-ONLY |
| `item:metronome` | corviknight | **STATE — 859/960 against 868/960** |

Will's Metronome ruling is explicitly cost-based (*"metronome is a joke dont worry about that just put
it into a quarantined closet we can re examine once the project is successful"*) and it stands. The
point is narrower and it is real: **the shelf is not uniformly a no-board-effect shelf**, and until
this run nothing said which of its rows were which.

## Neutrality, measured rather than argued

`HEAD:engine/quarantine.js` and the working copy compiled in ONE process, same on-disk artifacts:

```
              HEAD        WORKING COPY
gate ok       false       false
failing       5 of 8      5 of 8
PASS PASS  SAME   game differential
FAIL FAIL  SAME   deliberate roster / items
FAIL FAIL  SAME   deliberate roster / abilities
FAIL FAIL  SAME   deliberate roster / moves
PASS PASS  SAME   coverage / every used mechanic is measured by something
FAIL FAIL  SAME   whole-game differential / the same game on both engines
FAIL FAIL  SAME   mechanics / each one staged and compared against showdown
PASS PASS  SAME   no open, known engine defect

EVERY CLAUSE VERDICT AND COUNT IDENTICAL: true
```

**Read that 5 of 8 as the environment, not as my result.** The gate stood at **2 of 8 failing (6 of 8
PASS)** when measured at 02:27 on release `aea838766e7f` with both artifacts clean at HEAD. The tree
then moved to `b035aa665740` while another division worked, `data/game-differential.json` was re-run
on the new release and `data/all-mechanics-fire.json` was not, so three more clauses correctly read
MEASURED-AGAINST-A-DIFFERENT-ENGINE. **Subtracting one of those numbers from the other would invent a
trend.** The claim this batch makes is the paired one: same artifacts, two code versions, identical
output.

## Shown RED before being trusted

Six selftest assertions added, **148 -> 154 passing, 0 failing**. Each deliberate break was applied,
run, and reverted byte-identically:

| break | result |
|---|---|
| drop the `ownerShelved.push` collector | 2 FAIL |
| drop `shelvedLine` from the printed `why` | 3 FAIL |
| drop the rows-vs-summary comparison | 1 FAIL |
| move the `deferred` skip **below** `declaredMatch` | **5 FAIL**, incl. the pre-existing `#291` assertion |

The last break is the one that matters: it is the ordering claim on which the refusal rests. If the
declared list were asked first, a hand-typed `CLOSETED` row would collect credit for a subtraction the
derived shelf had already made, and the register would report a hit that fires only because the shelf
was there.

`mechanicsClause` gained the `inject` door the file already uses twice. The first version of the
printer assertion read the live artifact and went RED mid-session when another division cut
`b035aa665740`. **A selftest that reads a live artifact is not a selftest** — a signal another agent
can flip is noise, and noise is how a red test becomes "one of the two known failures".

## Files

- `engine/quarantine.js` — the collector, the printer, the refusal comment, six assertions
- `docs/ROADMAP.md` — `#520` new, `#160` appended with the 2026-08-28 re-ruling
- `CHANGELOG.md` — 5.196.0
- `docs/MEDICHAM-SPRINT-NOTES.md`, `docs/MEASURE.md`

## OWED, NOT RUN

- **`node engine/status.js --write` was NOT run.** Three other agents were live and the coordinator
  withheld it. The `<!-- GENERATED -->` blocks in `docs/MEASURE.md` still carry `2 of 8 gate clauses
  fail`, which was true at 02:27 and is stale against the tree's current release. It needs one run
  when the machine is quiet; nothing in this batch changes what it will print.
- **`item:metronome` sits on the owner's shelf at `board_verdict: STATE`.** Not a defect report and
  not a challenge to Will's ruling — but the closet now visibly contains one row whose divergence
  moves a board, and nobody has decided whether that is intended. It is newly visible, so it is newly
  answerable. **No register row was opened for it; MEASURE does not own the call.**
- **The `deferred` shelf is not re-checked against its evidence the way a `CLOSETED` row is.**
  `closetEvidenceStale` ages a declaration's evidence against the artifact's release and prints when
  it has not been re-checked. The owner's shelf has no equivalent: the ILLUSION_SHELF board evidence
  happens to be re-measured on every `all_mechanics_fire.js` run, which is fine — but nothing asserts
  that, and the roster half of the shelf (`tests/roster.js DEFERRED`) carries no board evidence at
  all.
- **Whether the two moves would still diverge under a modelled Illusion is unmeasured**, and stays
  that way by decision — that is ROADMAP `#160`'s exit, not this batch's.
- **No game was played and no artifact was regenerated.** `game_differential.js`, the roster stages
  and `all_mechanics_fire.js` were all forbidden this session; every number above is read from
  artifacts already on disk, each stamped with the release it was measured on.
