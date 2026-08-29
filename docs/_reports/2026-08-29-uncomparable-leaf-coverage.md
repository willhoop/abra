# The 24 leaves the board comparator can never see — who else covers them, and did it fire

MEASURE, 2026-08-29. Historical findings record. Not current state; superseded by whatever
`node engine/status.js` prints. No games were run for this: every number below is derived from
artifacts already on disk plus one streaming pass over the pinned team pool.

---

## The question

`engine/coverage.js` prints `board leaves compared 34 of 56`. 56 is the ceiling because **24** of the
80 leaves a legal mechanic can write can never be standing when the board is sampled:

| why | n | derived from |
|---|---|---|
| declared uncomparable (`board_state.js` `NOT_COMPARED`) | 4 | `BS.DECLARED_LEAVES` |
| a declared `duration: 1`, so `residualEvent` ends it before the boundary | 18 | `dex.conditions.getByID(name).duration` |
| removed inside its own action (`fling`, `sparklingaria`) | 2 | `selfRemovesWithinAction()` |

That reads as *24 unseen*. It is not. The board is one of **four** instruments, and a zero from any
of them is only evidence if the mechanic actually occurred.

**Answer: 1 of the 24 is genuinely UNCOVERED — `volatile:sparklingaria`.** A second,
`volatile:attract`, is covered by the one-engine census only and by **nothing that compares us against
Showdown**. The other 22 have at least one instrument that fired on them and agreed.

---

## Provenance — what was read, and how

ENGINE was mid-write on `engine/medicham2-browser.js`, `data/mechanics-census.json`,
`tests/test-mechanics.js` and `data/verification/game-differential.weightfix.json` throughout. So:

- `data/mechanics-census.json`, `data/verification/game-differential.empirical-after.json` and
  `data/verification/divergence-turns.empirical-after.json` were read via **`git show HEAD:<file>`**,
  never off the live tree. `data/mechanics-census.json` was rewritten at 07:12Z, 5 minutes before this
  report; the HEAD copy is stable.
- All three snapshots were **digest-verified against `HEAD` after the analysis finished** and are
  byte-identical (`038755da863b`, `59c7963d5ace`, `0ec2a3f5d683` at `bc19fafb`). HEAD advanced twice
  during the session and these three blobs did not move.
- `data/all-mechanics-fire.json`, `data/tags.json` and `data/move-priors.json` were read live and
  **checked equal to HEAD** (`acb84bbf62ad`, `1fa74e0fa571`, `e667fe8ab457`).
- The leaf split and the boundary count come from `tests/probe_uncompared_leaves.js` `derive()` and
  `boundaryCallSites()`. **One producer** — nothing here recomputes them. Pool reach comes from
  `tests/probe_leaf_name_map.js --pool`, the canonical `poolReach()`.
- `node engine/coverage.js` was run at the end and its shipped line is byte-for-byte the split used
  here: `34 of 56`, `4` declared + `18` duration-1 + `2` self-removed, `BS.snapshot has 1 call site`.

Ages at the time of reading (now = 2026-08-29T07:17Z):

| artifact | written |
|---|---|
| `data/verification/game-differential.empirical-after.json` | 05:58Z (1h19m) |
| `data/verification/divergence-turns.empirical-after.json` | 05:58Z (1h19m) |
| `data/all-mechanics-fire.json` | 03:17Z (4h00m) |
| `data/mechanics-census.json` (HEAD blob) | HEAD `bc19fafb` |
| `data/tags.json` | 02:44Z |
| `data/move-priors.json` | 01:18Z |

### The ceiling's load-bearing claim, re-checked rather than repeated

`boundaryCallSites()` reports `snapshot_calls: 1`, `other_snapshot_callers: []`,
`statecheck_call_lines: [3963, 4280]`. Both call sites were read: `stateCheck(0)` before any choice is
made, and `stateCheck(t + 1, play)` after the turn's bookkeeping. **Both are turn boundaries.** The
ceiling of 56 stands.

---

## The four instruments

| instrument | what it is | engines |
|---|---|---|
| **POOL** | `engine/game_differential.js`, 961 games, `empirical-click/v1` driver over the pinned pool, `turns_cap: 12` | **two** |
| **ROSTER** | `engine/all_mechanics_fire.js`, one deliberately staged scenario per entity (500 moves / 316 abilities / 148 items) | **two** |
| **CENSUS** | `tests/test-mechanics.js` → `data/mechanics-census.json`, 786 rows, each a knob varied against a cleared control | **one** |
| **PROBE** | a named `tests/probe_*.js` | varies |

**The census is the widest cover and the weakest kind of evidence.** It asks *does medicham2 do the
thing*, against a derived expectation. It cannot catch *ours fires half as often as Showdown's*.
That distinction decides two of the rows below.

### How each instrument was linked to a leaf, and where the link is weak

- **POOL:** two signals. `classes[].causes[].mentions[]` (a divergence naming the writer) and raw
  protocol lines in the divergence dump. The dump holds only the **225 diverged games of 961** and
  keeps a ~16-line window, so **every pool count below is a lower bound**, and a zero there is not a
  claim that the thing never happened.
- **ROSTER:** the row for the writer id — `resolved && medicham_resolved` for a move, `fired` for an
  ability or item.
- **CENSUS:** two links, reported apart because they are different strengths.
  - *derived*: the writer's own tags in `data/tags.json` → a census `kind:tag` row. Cannot go stale,
    but `statusInflict` covers a third of the move list, so a live row proves little.
  - *named*: the census row's `label`/`detail` names the writer. **This is a prose match** and is
    declared as one. It is not self-correcting and it does not belong in `coverage.js`, which forbids
    parsing prose.

**The named match over-matched on the first try, exactly as it always does.** Squashed to lowercase
it credited `volatile:counter` to **33** rows about the *stall counter* — the identical false
clearance `board_state.js` records having made itself. Re-run case-sensitively on the authority's own
display name with word boundaries, `volatile:counter` has **1** named row (`move:fixedDamage`,
"Mirror Coat answers the SPECIAL hitter and Counter the PHYSICAL one"). The same guard had been
suppressing `volatile:yawn` at a length threshold; it has 4.

---

## Reachability in the pinned pool — the discriminator

`data/team-pool-frozen`: **17,381 games, 208,224 sheet entries.**

This is what makes a pool zero readable. It is **not** `data/move-priors.json`: the empirical driver
gives an unobserved-but-legal move weight `UNOBSERVED = 0.02` (`engine/empirical_driver.js`), so
absence from the priors does **not** make a move unreachable. Carriage does.

**Correction against myself, and it is the standing rule.** I hand-rolled a streaming pass over the
store before noticing that `tests/probe_leaf_name_map.js --pool` already does exactly this — the
canonical `poolReach()` — and `coverage.js`'s own `why` string points at it. The canonical probe was
then run and **every figure agreed to the unit** (roost 4,074, followme 2,636, spikyshield 2,015,
quickguard 1,450, banefulbunker 1,443, kingsshield 345, chillyreception 65, fling 58, mirrorcoat 40,
beakblast 33, focuspunch 24, counter 22, endure 14, sparklingaria 11, electrify 8). Two producers
agreeing today is luck, not a defence; the figures below are quoted **from the canonical probe**.

Reach is an **upper bound** — a sheet carrying a move is not a game that clicked it, and the pool
brings 4 of 6.

| leaf | sheets | games (of 17,381) | medicham2 holds a state under the name |
|---|---:|---:|---|
| `volatile:protect` | 144,906 | 17,344 | MAPPED |
| `volatile:flinch` | 69,434 | 14,366 | MAPPED |
| `volatile:ragepowder` | 11,816 | 9,690 | MAPPED |
| `volatile:helpinghand` | 7,404 | 6,334 | MAPPED |
| `sideCondition:wideguard` | 5,703 | 5,176 | MAPPED |
| `volatile:roost` | 4,074 | 3,768 | MAPPED |
| `volatile:followme` | 2,636 | 2,538 | MAPPED |
| `volatile:spikyshield` | 2,015 | 1,925 | MAPPED |
| `sideCondition:quickguard` | 1,450 | 1,408 | MAPPED |
| `volatile:banefulbunker` | 1,443 | 1,390 | MAPPED |
| `volatile:kingsshield` | 345 | 342 | MAPPED |
| `volatile:chillyreception` | 65 | 65 | **NO-STATE** |
| `volatile:fling` | 58 | 58 | MAPPED |
| `volatile:mirrorcoat` | 40 | 40 | MAPPED |
| `volatile:beakblast` | 33 | 31 | MAPPED |
| `volatile:focuspunch` | 24 | 24 | MAPPED |
| `volatile:counter` | 22 | 22 | MAPPED |
| `volatile:endure` | 14 | 14 | MAPPED |
| **`volatile:sparklingaria`** | **11** | **11** | MAPPED |
| `volatile:electrify` | 8 | 8 | MAPPED |

The canonical probe prints the 42-leaf hole and therefore **not the 4 declared leaves**
(`attract`, `curse`, `healblock`, `yawn`). Those four come from my own pass and are marked as such:
**attract 2 sheet slots**, curse 207, psychicnoise (healblock's only writer) 400, yawn 1,703, plus
the two non-move writers — *ability* cutecharm **145**, *item* kingsrock 156.

Gender census, also from my own pass because the canonical probe does not carry one:
**98,337 M / 87,964 F / 0 N / 21,923 null.** A gendered fixture is trivially constructible from this
pool. The roster's is not gendered.

---

## The table

Pool columns are lower bounds from the 225-game dump. `SET` is the leaf's own announcement;
`CONSEQ` is what the leaf *does*.

| leaf | why uncomparable | POOL (lines / causes) | ROSTER | CENSUS named-live | verdict |
|---|---|---|---|---|---|
| `volatile:flinch` | dur 1 | 25 `\|cant\|..\|flinch` **CONSEQ** | 20/20 writers RESOLVED | 46 | **COVERED-AND-AGREED** |
| `volatile:protect` | dur 1 | 331 SET / **276 `-activate`** / 17 causes | RESOLVED | 42 | **COVERED-AND-AGREED** |
| `sideCondition:wideguard` | dur 1 | 28 SET / **30 `-activate`** / 6 causes | RESOLVED | 7 | **COVERED-AND-AGREED** |
| `sideCondition:quickguard` | dur 1 | 2 clicks, 2 SET, 0 `-activate` | RESOLVED | 4 (incl. "blocks a +1 priority move") | **COVERED-AND-AGREED** (block is census-only) |
| `volatile:helpinghand` | dur 1 | 24 SET / 2 causes | RESOLVED | 3 | **COVERED-AND-AGREED** (the ×1.5 itself is census-only) |
| `volatile:followme` | dur 1 | 42 SET | RESOLVED | 5 (redirect measured 3 ways) | **COVERED-AND-AGREED** |
| `volatile:ragepowder` | dur 1 | 37 SET / 1 cause | RESOLVED | **0 named** | **COVERED-AND-AGREED** for the redirect; the **powder immunity** is uncovered |
| `volatile:roost` | dur 1 | 4 SET | RESOLVED | 3 (`typeRemovedForTurn`) | **COVERED-AND-AGREED** |
| `volatile:curse` | **declared** | 2 SET | RESOLVED | 3 (both branches) | **COVERED-AND-AGREED** |
| `volatile:yawn` | **declared** | 4 lines | RESOLVED | 4 (`delayedSleep`) | **COVERED-AND-AGREED** |
| `volatile:healblock` | **declared** | 2 lines (`-end`) | RESOLVED | 3 (healed 85 → 0) | **COVERED-AND-AGREED** |
| `volatile:banefulbunker` | dur 1 | 14 clicks | RESOLVED | 2 (poison on a blocked contact) | **COVERED-AND-AGREED** |
| `volatile:spikyshield` | dur 1 | 8 clicks | RESOLVED | 4 | **COVERED-AND-AGREED** |
| `volatile:kingsshield` | dur 1 | 6 clicks | RESOLVED | 5 | **COVERED-AND-AGREED** |
| `volatile:chillyreception` | dur 1 | 0 | RESOLVED (`-prepare`) | 3 | **COVERED-AND-AGREED** |
| `volatile:beakblast` | dur 1 | 0 | RESOLVED (`-singleturn`) | 1 ("burns a contact attacker, and only a contact one") | **COVERED-AND-AGREED** |
| `volatile:focuspunch` | dur 1 | 0 | RESOLVED | 2 | **COVERED-AND-AGREED** |
| `volatile:endure` | dur 1 | 0 | RESOLVED (`-singleturn`) | 5 (incl. "Endure floors a lethal hit at 1 HP") | **COVERED-AND-AGREED** |
| `volatile:electrify` | dur 1 | 0 | RESOLVED | 1 (the `duration: 1` re-set exemption) | **COVERED-AND-AGREED** |
| `volatile:mirrorcoat` | dur 1 | 0 | RESOLVED — **on damage**, so the stored slot was real | 1 | **COVERED-AND-AGREED** |
| `volatile:counter` | dur 1 | 0 | RESOLVED — **on damage** | 1 | **COVERED-AND-AGREED** |
| `volatile:fling` | **self-removed** | 0 | RESOLVED at the `items` rung (`-enditem`) | 1 (`flingsOwnItem`) | **COVERED-AND-AGREED** |
| `volatile:attract` | **declared** | 0. attract = **2** slots; cutecharm = 145 but **0 causes** | **CANNOT-FIRE on both writers, all 7 rungs** | 2, both live | **COVERED-NOT-FIRED by every two-engine instrument** |
| `volatile:sparklingaria` | **self-removed** | 0. **11** slots | RESOLVED **on damage only** — the leaf's function unstaged | **0 named** | **UNCOVERED** |

### Why `RESOLVED` is weaker than it reads for eleven of these rows

`verdictFor()` in `all_mechanics_fire.js` counts any `-` event that is not in `NOT_A_CONSEQUENCE` as a
consequence, and `-singleturn` is not in that set. So for Protect, Detect, Spiky Shield, King's
Shield, Baneful Bunker, Quick Guard, Wide Guard, Endure, Electrify, Focus Punch and Beak Blast,
**`RESOLVED` is earned by the announcement alone.** Three things compound it:

1. the move ladder stops at the first rung that resolves — *"THE FIRST RUNG THAT RESOLVES WINS AND
   THE LADDER STOPS"* — which for all eleven is `bare`;
2. on the `bare` rung the receiver clicks `inert` (`clickOf(receiver, ['Agility','Iron Defense','Endure','Rest','Protect'])`),
   so **nothing attacks into the shield on the turn it goes up**;
3. `VOLATILE_THEN_WHAT` in `engine/faces.js` — the table that exists precisely to stage a follow-on
   consequence, and which already carries `attract` and `helpinghand` entries — is called at exactly
   one site, `all_mechanics_fire.js:1842`, **inside the ability ladder**. Measured:
   `moves rows with then_what: 0`, `items rows with then_what: 0`, abilities 18.

So the roster's two-engine comparison covers these eleven leaves' *creation* and not their *function*.
The census covers the function on one engine. Neither gap is invisible — but neither was printed.

---

## The two that need a consequence assertion

### 1. `volatile:sparklingaria` — genuinely UNCOVERED, and the cause is a missing tag

Nothing exercises it. The pool holds 11 carriers in 208,224 slots and never clicked it in the dump.
The roster's `RESOLVED` was earned by 90 BP of damage. The census has **no row naming it** — and it
cannot have one, because **`tag_dex.js` derives no tag for the mechanic**: 308 tags exist and not one
is about curing a status on the bodies a move hit. `tags.moves.sparklingaria.tags` is
`["pp","targetClass","spreadAll","sound","formatSecondaryCount","statusInflict","volatileAnnounce"]`,
and its `volatileAnnounce` param is `{"event":null,"desc":null,"why":"the condition declares no onStart"}`.
The condition itself does not resolve (`dex.conditions.getByID('sparklingaria').exists === false`) —
it is a bare marker.

**The boundary-visible consequence is `status`, which the board comparator already compares.**

> Burn the target the turn before (Will-O-Wisp, or a Flame Body contact), hit it with Sparkling Aria,
> read `status` at the next turn boundary. The authority cures it; an engine that skips the cure
> leaves `brn`.

Two arms are needed, because the authority's `onAfterMove` has two branches
(`(pokemon.removeVolatile("sparklingaria") || numberTargets > 1) && pokemon.status === "brn"`):
a **single** hit target, where the cure depends on the volatile still being there, and a **spread**
onto two burned bodies, where `numberTargets > 1` cures regardless. A singles-shaped fixture tests one
branch and reports the other as clean.

No new snapshot point. No new comparison leaf. The field is already read. The cheap structural half is
a `curesStatusOnHit` tag with a param naming the status and the recipient — that alone buys it a
census row and a roster consequence.

### 2. `volatile:attract` — covered by one engine, by nothing that compares us to Showdown

Both writers are blocked in the roster, and the artifact says so itself:

- `move:attract` — `-immune` on **all seven rungs**, `cannot_fire_clause: "gender"`,
  `cannot_fire_blocking: true`.
- `ability:cutecharm` — `DID-NOT-FIRE`, and the preflight names it exactly: *"'Cute Charm' READS
  `.gender` and this board declares N against N — the authority's own guard fails on a genderless
  body, so the ability correctly does nothing and the board cannot tell that apart from a dead
  mechanic."*

The pool cannot rescue it: Attract sits on 2 of 208,224 sheet slots. Cute Charm is on 145, so a
handful of carriers are expected in 961 games, but it needs a contact hit **and** a 30% roll **and**
opposite genders, and there are **0 causes mentioning it**. The census does stage it, live, on one
engine, with both controls — `ability:punishesAttacker` "Cute Charm attracts the contact attacker on
its 30%, and only across opposite genders", and `move:immunityGate` "Attract between two MALES
announces the immunity".

**The boundary-visible consequence is a move that did not happen.** Showdown writes
`|cant|SLOT|Attract`, and the **PP field is already compared** — every roster receipt reads
`pp_slots_occupied: 8, pp_slots_compared: 8`.

> Two turns, a **gendered** pair, Cute Charm as the carrier (145 slots against Attract's 2, and it
> fires off any contact hit). Read PP at the boundary after the infatuated body's turn: PP moves when
> it acts and does not move when the coin takes the turn. The pool is 98,337 M / 87,964 F / **0 N**,
> so a gendered fixture costs nothing — the roster's own carrier choice is the whole blocker.

### And one sub-mechanic, not a leaf: Rage Powder's powder immunity

`volatile:ragepowder` is covered — 37 SET lines and a divergence cause in the pool, and it shares the
`redirects` tag whose census rows are live. What is **not** covered is the half that separates it from
Follow Me: powder does not redirect a Grass-type or an Overcoat body. Note **Safety Goggles is banned
in this format**, so those two are the only immune paths. Boundary-visible consequence: the foe's move
lands on its **original** target, so the HP delta is on a different body and
`|move|SLOT|NAME|TARGET` names a different slot.

---

## What is better served by a counter comparison than by state

The brief's pattern — `MEDSEEN`/`MEDFAILS` totals on **both** sides — is the right instrument wherever
the leaf's effect is a numeric modifier that leaves no line of its own. It catches *ours fires half as
often*, which is exactly what a vanishing leaf hides, and it is the shape a board snapshot cannot see
however it is timed.

**The precedent already exists and its header already makes this argument.**
`MEDSEEN.flinch` was added because *"`_flinch` is set and CONSUMED inside a single turn … so no caller
can observe it afterwards and every post-turn check reads false whether or not the mechanic fired. The
instrument had to be inside the engine; there was no probe that could have worked from outside."*
That is a general statement about every `duration: 1` leaf in this list.

**What is missing is the other half.** `MEDSEEN` is exported as `M.seen` at
`medicham2-browser.js:35622` and **nothing in `engine/` or `tests/` reads it against a Showdown-side
count.** Grep for consumers returns only unrelated `.seen` fields on other objects. So the counters
are one-sided today: a zero is loud, a *halved* value is silent.

Ranked, best first:

| leaf | our counter | Showdown-side pair | why a counter and not state |
|---|---|---|---|
| the shield family (`protect`, `spikyshield`, `kingsshield`, `banefulbunker`, `quickguard`, `wideguard`) | blocks paid | `\|-activate\|..\|move: <Name>` | The pool shows **331 SET against 276 `-activate`** for Protect. A drift in the *block rate* leaves every `-singleturn` identical on both sides. This is the highest-usage row in the whole set. |
| `volatile:flinch` | `MEDSEEN.flinch` (**exists**) | count of `\|cant\|..\|flinch` | One line to pair it. The leaf is set and cleared inside a turn on 20 writers and 62,000+ ladder uses. |
| `volatile:helpinghand` | boosted arrivals | none — the ×1.5 is silent on both sides | A pure base-power multiplier with no protocol footprint at all. State can only see it through the damage number, which a hundred other things also move. |
| `volatile:endure` | clamped-to-1 events | `\|-activate\|..\|move: Endure` | The `-singleturn` fires whether or not anything lethal arrives; only the clamp count separates them. |
| `volatile:focuspunch` | focus lost | `\|cant\|..\|Focus Punch` | Same shape. |
| `volatile:counter` / `volatile:mirrorcoat` | answered-with-a-stored-slot vs failed-for-want-of-one | `-fail` naming the user | The two branches are indistinguishable at a boundary; only the split matters. |
| `volatile:electrify` | moves retyped | none | Silent unless the retyped move meets an immunity. |
| `volatile:roost` | Flying suppressed at damage time | none (`-singleturn` fires either way) | The type suppression is consumed inside the turn. |

---

## The mid-turn snapshot, costed and ranked last

As instructed, this is not the first move. Costs, all derived:

1. `M.battleTurn()` is atomic; Showdown stops inside a turn. That asymmetry is what caused the
   forced-switch mirror bug fixed earlier today, and a second sampling point re-opens it.
2. It **breaks the published ceiling**. `boundaryCallSites()` counts `BS.snapshot` call sites *on every
   run* precisely because the 56 rests on there being one. A second caller makes some of these 24
   reachable and **every leaf-coverage figure ever published has to be re-derived** — `34 of 56` is not
   a number that survives it.
3. It buys nothing the two routes above do not. Every one of the 24 has a boundary-visible consequence
   (a protocol line, or `hp` / `status` / `pp` / `item` / `boosts`, all already compared). The one that
   is genuinely invisible — a rate drift — is a counter problem and stays one at any snapshot cadence.

**Rank: consequence fixtures first, counter pairing second, mid-turn snapshot last and probably never.**

---

## Two corrections to figures quoted in the brief

1. **"protect appears in 34 protocol causes, helpinghand in 4, ragepowder in 2."** Measured at HEAD in
   `data/verification/game-differential.empirical-after.json`: **protect 17, helpinghand 2,
   ragepowder 1** (distinct causes; the `n` sums are 18 / 2 / 1, and the `mentions[]` counts are
   identical). `game-differential.empirical.json` — the same 961-game run two hours earlier — gives the
   same 17 / 2 / 1. Every quoted figure is exactly **2×** the measured one, which is what summing the
   two empirical files, or walking `classes` twice, produces. The *shape* of the point is unaffected:
   the protocol comparator does see Protect, Helping Hand and Rage Powder right now.
2. **The probe's own CLI mislabels the split.** `tests/probe_uncompared_leaves.js` prints
   *"the authority declares a duration of 1 on 20"*, computed as `hole.length - boundary` — which
   folds the 2 self-removed leaves into the duration-1 count. It is **18 + 2**. `engine/coverage.js`
   gets this right (`const dur1 = L.hole_duration1.length, selfrm = L.self_removed_within_action.length`),
   so the two published splits disagree by 2 today.

---

## OWED, NOT RUN

Nothing was committed and nothing outside this file was written. Four items are owed.

1. **`engine/coverage.js` — one derived line, warranted, not added.** The scope that is printed
   nowhere today is: *of the leaves this comparator can never see, how many have a writer that FIRED
   in the roster.* It is 23 of 24, and the one that has none is `volatile:attract`. Both inputs are
   derived (`UL.derive()` + `data/all-mechanics-fire.json`), no prose is parsed, and it extends the
   existing `COVFAILS` pattern rather than adding a bare `catch`. Form:

   ```
   add('uncomparable leaves with a firing writer', fired, UNCOMPARABLE.length,
       `a leaf this comparator can never see is only covered if ANOTHER instrument fired on it. `
       + `${UNCOMPARABLE.length - fired} have no writer that fired in data/all-mechanics-fire.json`
       + (dead.length ? ` (${dead.join(', ')})` : '') + ' — for those, a clean roster row is the '
       + 'fixture agreeing with itself.',
       'tests/probe_uncompared_leaves.js derive() x data/all-mechanics-fire.json rows[]; a move row '
       + 'counts when resolved AND medicham_resolved, an ability or item row when fired');
   ```

   **Not applied this pass** because the living-docs rule requires the CHANGELOG entry and the ledger
   restamp in the same pass, and `CHANGELOG.md`, `docs/MEASURE.md`, `docs/ENGINE.md` and
   `docs/SUMMARY.md` were all open in ENGINE's working tree. Editing a file another agent is mid-write
   on is the collision the repo rules forbid.

2. **The probe CLI's `18 + 2` mislabel** (correction 2 above). One line, same reason for deferral.

3. **The two consequence fixtures are specified but not built or run.** Sparkling Aria's burn cure
   (two arms: single target and a spread onto two burned bodies) and Attract on a gendered pair with
   Cute Charm as the carrier. Both are ENGINE/roster work; MEASURE specified the assertion and the
   boundary field, and ran no games.

4. **`M.seen` has no Showdown-side pair.** Stated as a finding, not built. Pairing `MEDSEEN.flinch`
   against a count of `|cant|..|flinch` is the smallest first instance and would prove the pattern
   before the seven rows behind it are wired.

Three things this report does **not** claim:

- **A pool zero is not an absence.** Every pool count is a lower bound off the 225-game divergence dump
  with a ~16-line window; Baneful Bunker, King's Shield and Spiky Shield were all clicked in the pool
  with no `-singleturn` retained beside the click, which is a property of the dump and not of the game.
- **The census's `live: true` is one engine.** It is real coverage against a derived expectation and it
  is not a comparison with Showdown. Two rows in the table rest on it alone and are marked.
- **The duration-1 and self-removal splits are evidence, not proof.** A clock rewritten in `onStart`
  would be misclassified. The falsifier is a staged boundary read of both engines
  (`tests/probe_volatile_leaves.js`), which was not run here.
